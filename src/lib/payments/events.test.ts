import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import mongoose from "mongoose";
import type Stripe from "stripe";
import PaymentEvent from "@/models/PaymentEvent";
import {
  coinsOf,
  createPayment,
  createUser,
  startTestDb,
} from "@/lib/payments/test-utils";

const stripeMock = vi.hoisted(() => ({
  webhooks: { constructEvent: vi.fn() },
  checkout: { sessions: { retrieve: vi.fn() } },
}));
const authMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/stripe", () => ({ getStripe: () => stripeMock }));
vi.mock("@/lib/db", () => ({ connectDB: async () => mongoose }));
vi.mock("@/lib/auth", () => ({ auth: authMock }));

import { POST as webhook } from "@/app/api/v1/payments/stripe/webhook/route";
import { GET as eventsGet } from "@/app/api/v1/admin/payment-events/route";
import { POST as replayPost } from "@/app/api/v1/admin/payment-events/[id]/replay/route";
import {
  receivePaymentEvent,
  replayPaymentEvent,
  stripePayload,
} from "@/lib/payments/events";

let db: Awaited<ReturnType<typeof startTestDb>>;

beforeAll(async () => {
  db = await startTestDb("taskhub_payment_events_test");
}, 180_000);
afterAll(async () => {
  await db?.stop();
});
beforeEach(async () => {
  await db.reset();
  vi.clearAllMocks();
});

function session(paymentId: unknown, over: Partial<Stripe.Checkout.Session> = {}) {
  return {
    id: "cs_test_1",
    payment_status: "paid",
    amount_total: 1000,
    currency: "usd",
    customer_details: { email: "private@example.test" },
    metadata: { paymentId: String(paymentId), userId: "u" },
    ...over,
  } as unknown as Stripe.Checkout.Session;
}

const stripeEvent = (s: Stripe.Checkout.Session, id = "evt_1") => ({
  provider: "stripe" as const,
  eventId: id,
  type: "checkout.session.completed",
  payload: stripePayload(s),
});

describe("receivePaymentEvent", () => {
  it("logs the event, credits the payment and stores the outcome", async () => {
    const user = await createUser(0);
    const payment = await createPayment(user._id, { gateway: "stripe", price: 10 });

    const result = await receivePaymentEvent(stripeEvent(session(payment._id)));

    expect(result).toMatchObject({ ok: true, outcome: "credited" });
    expect(await coinsOf(user._id)).toBe(150);
    const row = await PaymentEvent.findOne({ provider: "stripe", eventId: "evt_1" });
    expect(row).toMatchObject({ ok: true, outcome: "credited", deliveries: 1, replays: 0 });
    expect(row?.paymentId).toBe(String(payment._id));
    expect(row?.processedAt).toBeInstanceOf(Date);
  });

  it("keeps no personal data in the stored payload", async () => {
    const user = await createUser(0);
    const payment = await createPayment(user._id, { gateway: "stripe" });
    await receivePaymentEvent(stripeEvent(session(payment._id)));
    const row = await PaymentEvent.findOne({}).lean();
    expect(JSON.stringify(row?.payload)).not.toContain("private@example.test");
  });

  it("keeps one row and credits once when the same event is delivered again", async () => {
    const user = await createUser(0);
    const payment = await createPayment(user._id, { gateway: "stripe", price: 10 });
    const ev = stripeEvent(session(payment._id));

    await receivePaymentEvent(ev);
    const second = await receivePaymentEvent(ev);

    expect(second).toMatchObject({ ok: true, outcome: "already_processed" });
    expect(await PaymentEvent.countDocuments()).toBe(1);
    expect((await PaymentEvent.findOne({}))?.deliveries).toBe(2);
    expect(await coinsOf(user._id)).toBe(150);
  });

  it("handles ten simultaneous deliveries: one row, one credit", async () => {
    const user = await createUser(0);
    const payment = await createPayment(user._id, { gateway: "stripe", price: 10 });
    const ev = stripeEvent(session(payment._id));

    await Promise.all(Array.from({ length: 10 }, () => receivePaymentEvent(ev)));

    expect(await PaymentEvent.countDocuments()).toBe(1);
    expect((await PaymentEvent.findOne({}))?.deliveries).toBe(10);
    expect(await coinsOf(user._id)).toBe(150);
  });

  it("logs a refused event with ok false and the reason", async () => {
    const user = await createUser(0);
    const payment = await createPayment(user._id, { gateway: "stripe" });
    await receivePaymentEvent(
      stripeEvent(session(payment._id, { payment_status: "unpaid" })),
    );
    const row = await PaymentEvent.findOne({});
    expect(row).toMatchObject({ ok: false, outcome: "not_paid" });
    expect(await coinsOf(user._id)).toBe(0);
  });

  it("records the delivery through the Stripe webhook route", async () => {
    const user = await createUser(0);
    const payment = await createPayment(user._id, { gateway: "stripe", price: 10 });
    stripeMock.webhooks.constructEvent.mockReturnValue({
      id: "evt_route",
      type: "checkout.session.completed",
      data: { object: session(payment._id) },
    });
    const res = await webhook(
      new NextRequest("https://app.test/api/v1/payments/stripe/webhook", {
        method: "POST",
        headers: { "stripe-signature": "sig" },
        body: "{}",
      }),
      undefined,
    );
    expect(res.status).toBe(200);
    expect(await PaymentEvent.findOne({ eventId: "evt_route" })).toMatchObject({
      provider: "stripe",
      ok: true,
    });
  });
});

describe("replayPaymentEvent", () => {
  it("replaying an event that already credited changes nothing", async () => {
    const user = await createUser(0);
    const payment = await createPayment(user._id, { gateway: "stripe", price: 10 });
    await receivePaymentEvent(stripeEvent(session(payment._id)));
    const row = await PaymentEvent.findOne({});

    const replay = await replayPaymentEvent(String(row!._id), "admin1");

    expect(replay).toMatchObject({ found: true, result: { ok: true, outcome: "already_processed" } });
    expect(await coinsOf(user._id)).toBe(150);
    const after = await PaymentEvent.findOne({});
    expect(after).toMatchObject({ replays: 1, lastReplayedBy: "admin1" });
  });

  it("replaying many times at once still credits once", async () => {
    const user = await createUser(0);
    const payment = await createPayment(user._id, { gateway: "stripe", price: 10 });
    // Logged but not credited yet: insert the row directly, as if processing had failed.
    const row = await PaymentEvent.create({
      ...stripeEvent(session(payment._id)),
      outcome: "error",
      ok: false,
    });

    await Promise.all(
      Array.from({ length: 6 }, () => replayPaymentEvent(String(row._id), "admin1")),
    );

    expect(await coinsOf(user._id)).toBe(150);
    expect((await PaymentEvent.findById(row._id))?.ok).toBe(true);
  });

  it("reports an unknown event", async () => {
    const res = await replayPaymentEvent(String(new mongoose.Types.ObjectId()), "a");
    expect(res).toEqual({ found: false });
  });
});

describe("admin payment-events routes", () => {
  const as = (role: string | null) =>
    authMock.mockResolvedValue(role ? { user: { id: "a1", role } } : null);
  const ctx = (id: unknown) => ({ params: Promise.resolve({ id: String(id) }) });
  const list = (qs = "") =>
    eventsGet(new NextRequest(`https://app.test/api/v1/admin/payment-events${qs}`));
  const replay = (id: unknown) =>
    replayPost(
      new NextRequest("https://app.test/x", { method: "POST" }),
      ctx(id),
    );

  it("lets admins and the demo admin list events, and nobody else", async () => {
    const user = await createUser(0);
    const payment = await createPayment(user._id, { gateway: "stripe" });
    await receivePaymentEvent(stripeEvent(session(payment._id)));

    for (const role of ["admin", "demo_admin"]) {
      as(role);
      const res = await list();
      expect(res.status).toBe(200);
      expect((await res.json()).total).toBe(1);
    }
    for (const role of ["buyer", "worker", null]) {
      as(role);
      expect((await list()).status).toBe(401);
    }
  });

  it("filters by provider and by whether the event credited", async () => {
    const user = await createUser(0);
    const payment = await createPayment(user._id, { gateway: "stripe" });
    await receivePaymentEvent(stripeEvent(session(payment._id, { payment_status: "unpaid" }), "evt_a"));
    as("admin");
    expect((await (await list("?ok=false")).json()).total).toBe(1);
    expect((await (await list("?ok=true")).json()).total).toBe(0);
    expect((await (await list("?provider=bkash")).json()).total).toBe(0);
    expect((await (await list("?provider=stripe")).json()).total).toBe(1);
  });

  it("lets only an admin replay, and refuses the demo admin", async () => {
    const user = await createUser(0);
    const payment = await createPayment(user._id, { gateway: "stripe", price: 10 });
    const row = await PaymentEvent.create({
      ...stripeEvent(session(payment._id)),
      outcome: "error",
      ok: false,
    });

    as("demo_admin");
    expect((await replay(row._id)).status).toBe(403);
    as("buyer");
    expect((await replay(row._id)).status).toBe(401);
    expect(await coinsOf(user._id)).toBe(0);

    as("admin");
    const res = await replay(row._id);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, outcome: "credited" });
    expect(await coinsOf(user._id)).toBe(150);

    // A second replay is harmless.
    const again = await replay(row._id);
    expect(await again.json()).toMatchObject({ outcome: "already_processed" });
    expect(await coinsOf(user._id)).toBe(150);
  });

  it("returns 404 for an unknown or malformed event ID", async () => {
    as("admin");
    expect((await replay(new mongoose.Types.ObjectId())).status).toBe(404);
    expect((await replay("not-an-id")).status).toBe(404);
  });
});

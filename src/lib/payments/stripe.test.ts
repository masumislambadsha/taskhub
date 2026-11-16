import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import mongoose from "mongoose";
import type Stripe from "stripe";
import Payment from "@/models/Payment";
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
import { POST as confirm } from "@/app/api/v1/payments/confirm/route";

let db: Awaited<ReturnType<typeof startTestDb>>;

beforeAll(async () => {
  db = await startTestDb("taskhub_stripe_test");
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
    payment_intent: "pi_1",
    metadata: { paymentId: String(paymentId) },
    ...over,
  } as Stripe.Checkout.Session;
}

async function sendWebhook(type: string, s: Stripe.Checkout.Session) {
  stripeMock.webhooks.constructEvent.mockReturnValue({ type, data: { object: s } });
  const req = new NextRequest("https://app.test/api/v1/payments/stripe/webhook", {
    method: "POST",
    body: "{}",
    headers: { "stripe-signature": "sig" },
  });
  return webhook(req, undefined);
}

function confirmReq(paymentId: unknown) {
  return confirm(
    new NextRequest("https://app.test/api/v1/payments/confirm", {
      method: "POST",
      body: JSON.stringify({ paymentId: String(paymentId) }),
    }),
    undefined,
  );
}

describe("Stripe webhook", () => {
  it("credits a paid, matching session once, however often it is delivered", async () => {
    const user = await createUser(0);
    const payment = await createPayment(user._id, { gateway: "stripe", stripeSessionId: "cs_test_1" });
    const s = session(payment._id);
    await Promise.all([
      sendWebhook("checkout.session.completed", s),
      sendWebhook("checkout.session.completed", s),
      sendWebhook("checkout.session.async_payment_succeeded", s),
    ]);
    await sendWebhook("checkout.session.completed", s);
    expect(await coinsOf(user._id)).toBe(150);
    const saved = await Payment.findById(payment._id);
    expect(saved?.status).toBe("success");
    expect(saved?.gatewayTransactionId).toBe("cs_test_1");
  });

  it("does not credit a completed session that is not paid, but credits it when the async payment succeeds", async () => {
    const user = await createUser(0);
    const payment = await createPayment(user._id, { gateway: "stripe" });
    await sendWebhook("checkout.session.completed", session(payment._id, { payment_status: "unpaid" }));
    expect(await coinsOf(user._id)).toBe(0);
    await sendWebhook("checkout.session.async_payment_succeeded", session(payment._id));
    expect(await coinsOf(user._id)).toBe(150);
  });

  it("refuses an amount or currency mismatch", async () => {
    const user = await createUser(0);
    const payment = await createPayment(user._id, { gateway: "stripe", price: 10 });
    await sendWebhook("checkout.session.completed", session(payment._id, { amount_total: 100 }));
    await sendWebhook("checkout.session.completed", session(payment._id, { currency: "eur" }));
    await sendWebhook("checkout.session.completed", session(payment._id, { amount_total: null }));
    expect(await coinsOf(user._id)).toBe(0);
    expect((await Payment.findById(payment._id))?.status).toBe("pending");
  });

  it("refuses a session that is not the one created for the payment", async () => {
    const user = await createUser(0);
    const payment = await createPayment(user._id, { gateway: "stripe", stripeSessionId: "cs_real" });
    await sendWebhook("checkout.session.completed", session(payment._id, { id: "cs_other" }));
    expect(await coinsOf(user._id)).toBe(0);
  });

  it("returns 400 for a bad signature and ignores other event types", async () => {
    stripeMock.webhooks.constructEvent.mockImplementation(() => {
      throw new Error("bad sig");
    });
    const res = await webhook(
      new NextRequest("https://app.test/x", { method: "POST", body: "{}", headers: { "stripe-signature": "x" } }),
      undefined,
    );
    expect(res.status).toBe(400);
    const user = await createUser(0);
    const payment = await createPayment(user._id, { gateway: "stripe" });
    await sendWebhook("payment_intent.succeeded", session(payment._id));
    expect(await coinsOf(user._id)).toBe(0);
  });
});

describe("POST /payments/confirm for Stripe", () => {
  it("asks Stripe and credits only a paid, matching session", async () => {
    const user = await createUser(0);
    authMock.mockResolvedValue({ user: { id: String(user._id), role: "buyer" } });
    const payment = await createPayment(user._id, { gateway: "stripe", stripeSessionId: "cs_test_1" });

    stripeMock.checkout.sessions.retrieve.mockResolvedValue(session(payment._id, { payment_status: "unpaid" }));
    let res = await confirmReq(payment._id);
    expect(stripeMock.checkout.sessions.retrieve).toHaveBeenCalledWith("cs_test_1");
    expect((await res.json()).status).toBe("pending");
    expect(await coinsOf(user._id)).toBe(0);

    stripeMock.checkout.sessions.retrieve.mockResolvedValue(session(payment._id, { amount_total: 100 }));
    res = await confirmReq(payment._id);
    expect((await res.json()).status).toBe("pending");
    expect(await coinsOf(user._id)).toBe(0);

    stripeMock.checkout.sessions.retrieve.mockResolvedValue(session(payment._id));
    res = await confirmReq(payment._id);
    expect(await res.json()).toEqual({ status: "success", coins: 150 });
    await confirmReq(payment._id);
    await sendWebhook("checkout.session.completed", session(payment._id));
    expect(await coinsOf(user._id)).toBe(150);
  });

  it("does not credit when webhook and confirm race", async () => {
    const user = await createUser(0);
    authMock.mockResolvedValue({ user: { id: String(user._id), role: "buyer" } });
    const payment = await createPayment(user._id, { gateway: "stripe", stripeSessionId: "cs_test_1" });
    stripeMock.checkout.sessions.retrieve.mockResolvedValue(session(payment._id));
    await Promise.all([
      confirmReq(payment._id),
      sendWebhook("checkout.session.completed", session(payment._id)),
      confirmReq(payment._id),
    ]);
    expect(await coinsOf(user._id)).toBe(150);
  });

  it("falls back to a legacy session ID kept in gatewayTransactionId, and returns status when none is stored", async () => {
    const user = await createUser(0);
    authMock.mockResolvedValue({ user: { id: String(user._id), role: "buyer" } });
    const legacy = await createPayment(user._id, { gateway: "stripe", gatewayTransactionId: "cs_legacy" });
    stripeMock.checkout.sessions.retrieve.mockResolvedValue(session(legacy._id, { id: "cs_legacy" }));
    await confirmReq(legacy._id);
    expect(stripeMock.checkout.sessions.retrieve).toHaveBeenCalledWith("cs_legacy");
    expect(await coinsOf(user._id)).toBe(150);

    stripeMock.checkout.sessions.retrieve.mockClear();
    const old = await createPayment(user._id, { gateway: "stripe" });
    const res = await confirmReq(old._id);
    expect(stripeMock.checkout.sessions.retrieve).not.toHaveBeenCalled();
    expect((await res.json()).status).toBe("pending");
    expect(await coinsOf(user._id)).toBe(150);
  });

  it("refuses a Stripe session whose metadata names another payment", async () => {
    const user = await createUser(0);
    authMock.mockResolvedValue({ user: { id: String(user._id), role: "buyer" } });
    const mine = await createPayment(user._id, { gateway: "stripe", stripeSessionId: "cs_test_1" });
    const other = await createPayment(user._id, { gateway: "stripe", stripeSessionId: "cs_other" });
    stripeMock.checkout.sessions.retrieve.mockResolvedValue(session(other._id));
    await confirmReq(mine._id);
    expect(await coinsOf(user._id)).toBe(0);
  });

  it("returns 502 if Stripe cannot be reached, without crediting", async () => {
    const user = await createUser(0);
    authMock.mockResolvedValue({ user: { id: String(user._id), role: "buyer" } });
    const payment = await createPayment(user._id, { gateway: "stripe", stripeSessionId: "cs_test_1" });
    stripeMock.checkout.sessions.retrieve.mockRejectedValue(new Error("network"));
    const res = await confirmReq(payment._id);
    expect(res.status).toBe(502);
    expect(await coinsOf(user._id)).toBe(0);
  });
});

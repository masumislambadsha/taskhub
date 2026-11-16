import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import mongoose from "mongoose";
import Payment from "@/models/Payment";
import {
  coinsOf,
  createPayment,
  createUser,
  startTestDb,
} from "@/lib/payments/test-utils";

const stripeMock = vi.hoisted(() => ({
  checkout: { sessions: { retrieve: vi.fn() } },
}));
const authMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/stripe", () => ({ getStripe: () => stripeMock }));
vi.mock("@/lib/db", () => ({ connectDB: async () => mongoose }));
vi.mock("@/lib/auth", () => ({ auth: authMock }));

import { POST as confirm } from "@/app/api/v1/payments/confirm/route";
import { POST as adminConfirm } from "@/app/api/v1/payments/admin-confirm/route";

let db: Awaited<ReturnType<typeof startTestDb>>;

beforeAll(async () => {
  db = await startTestDb("taskhub_confirm_test");
}, 180_000);
afterAll(async () => {
  await db?.stop();
});
beforeEach(async () => {
  await db.reset();
  vi.clearAllMocks();
});

const post = (path: string, body: unknown) =>
  new NextRequest(`https://app.test${path}`, { method: "POST", body: JSON.stringify(body) });

describe("POST /payments/confirm", () => {
  it.each(["bkash", "sslcommerz"] as const)(
    "does not credit a pending %s payment",
    async (gateway) => {
      const user = await createUser(0);
      authMock.mockResolvedValue({ user: { id: String(user._id), role: "buyer" } });
      const payment = await createPayment(user._id, { gateway });

      for (let i = 0; i < 3; i++) {
        const res = await confirm(post("/api/v1/payments/confirm", { paymentId: String(payment._id) }), undefined);
        expect(res.status).toBe(200);
        expect((await res.json()).status).toBe("pending");
      }
      expect(await coinsOf(user._id)).toBe(0);
      expect((await Payment.findById(payment._id))?.status).toBe("pending");
      expect(stripeMock.checkout.sessions.retrieve).not.toHaveBeenCalled();
    },
  );

  it("reports success for a payment the gateway callback already credited, without crediting again", async () => {
    const user = await createUser(0);
    authMock.mockResolvedValue({ user: { id: String(user._id), role: "buyer" } });
    const payment = await createPayment(user._id, { gateway: "bkash" });
    await Payment.updateOne({ _id: payment._id }, { status: "success" });
    const res = await confirm(post("/api/v1/payments/confirm", { paymentId: String(payment._id) }), undefined);
    expect(await res.json()).toEqual({ status: "success", coins: 150 });
    expect(await coinsOf(user._id)).toBe(0);
  });

  it("rejects unauthenticated callers, other users' payments and bad IDs", async () => {
    const owner = await createUser(0);
    const other = await createUser(0);
    const payment = await createPayment(owner._id, { gateway: "bkash" });

    authMock.mockResolvedValue(null);
    expect((await confirm(post("/x", { paymentId: String(payment._id) }), undefined)).status).toBe(401);

    authMock.mockResolvedValue({ user: { id: String(other._id), role: "buyer" } });
    expect((await confirm(post("/x", { paymentId: String(payment._id) }), undefined)).status).toBe(404);
    expect((await confirm(post("/x", { paymentId: { $ne: null } }), undefined)).status).toBe(404);
    expect((await confirm(post("/x", {}), undefined)).status).toBe(404);
  });
});

describe("POST /payments/admin-confirm", () => {
  it("is admin only and credits once", async () => {
    const user = await createUser(0);
    const admin = await createUser(0);
    const payment = await createPayment(user._id, { gateway: "bkash" });
    const body = { paymentId: String(payment._id) };

    authMock.mockResolvedValue({ user: { id: String(user._id), role: "buyer" } });
    expect((await adminConfirm(post("/x", body), undefined)).status).toBe(401);
    expect(await coinsOf(user._id)).toBe(0);

    authMock.mockResolvedValue({ user: { id: String(admin._id), role: "admin" } });
    expect((await adminConfirm(post("/x", body), undefined)).status).toBe(200);
    expect((await adminConfirm(post("/x", body), undefined)).status).toBe(404);
    expect(await coinsOf(user._id)).toBe(150);
    expect(String((await Payment.findById(payment._id))?.confirmedBy)).toBe(String(admin._id));
  });
});

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import mongoose from "mongoose";
import Payment from "@/models/Payment";
import { logger } from "@/lib/logger";
import {
  coinsOf,
  createPayment,
  createUser,
  jsonResponse,
  startTestDb,
} from "@/lib/payments/test-utils";

vi.hoisted(() => {
  process.env.NEXTAUTH_URL = "https://app.test";
  process.env.SSLCOMMERZ_BASE_URL = "https://ssl.test";
  process.env.SSLCOMMERZ_STORE_ID = "store";
  process.env.SSLCOMMERZ_STORE_PASSWORD = "secret-store-password";
});
vi.mock("@/lib/db", () => ({ connectDB: async () => mongoose }));

import { POST as successRoute } from "@/app/api/sslcommerz/success/route";
import { POST as ipnRoute } from "@/app/api/sslcommerz/ipn/route";

let db: Awaited<ReturnType<typeof startTestDb>>;
// val_id -> what the (mocked) SSLCommerz validation API answers.
let validations: Record<string, Record<string, string>>;

beforeAll(async () => {
  db = await startTestDb("taskhub_ssl_test");
}, 180_000);
afterAll(async () => {
  await db?.stop();
});
beforeEach(async () => {
  await db.reset();
  validations = {};
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      expect(String(url).startsWith("https://ssl.test/")).toBe(true);
      const valId = new URL(String(url)).searchParams.get("val_id") ?? "";
      return jsonResponse(validations[valId] ?? { status: "INVALID_TRANSACTION" });
    }),
  );
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function valid(tranId: unknown, valId: string, over: Record<string, string> = {}) {
  validations[valId] = {
    status: "VALID",
    tran_id: String(tranId),
    val_id: valId,
    amount: "1100.00",
    currency_type: "BDT",
    currency: "BDT",
    bank_tran_id: `BANK-${valId}`,
    ...over,
  };
}

function formReq(path: string, fields: Record<string, string>) {
  return new NextRequest(`https://app.test${path}`, {
    method: "POST",
    body: new URLSearchParams(fields),
  });
}
const callSuccess = (tran_id: unknown, val_id: string) =>
  successRoute(formReq("/api/sslcommerz/success", { tran_id: String(tran_id), val_id, status: "VALID" }));
const callIpn = (tran_id: unknown, val_id: string) =>
  ipnRoute(formReq("/api/sslcommerz/ipn", { tran_id: String(tran_id), val_id, status: "VALID" }), undefined);

describe("SSLCommerz success and IPN", () => {
  it("credits a valid, matching payment once even when success and IPN both arrive", async () => {
    const user = await createUser(0);
    const payment = await createPayment(user._id, { gateway: "sslcommerz", price: 10 });
    valid(payment._id, "VAL1");

    const [s, i] = await Promise.all([callSuccess(payment._id, "VAL1"), callIpn(payment._id, "VAL1")]);
    expect(s.headers.get("location")).toContain("/payment-return?status=success");
    expect(i.status).toBe(200);
    expect(await coinsOf(user._id)).toBe(150);
    const saved = await Payment.findById(payment._id);
    expect(saved?.gatewayValidationId).toBe("VAL1");

    // Replaying either callback adds nothing.
    await callIpn(payment._id, "VAL1");
    await callSuccess(payment._id, "VAL1");
    expect(await coinsOf(user._id)).toBe(150);
  });

  it("refuses a val_id that was issued for a different tran_id", async () => {
    const user = await createUser(0);
    const cheap = await createPayment(user._id, { gateway: "sslcommerz", price: 1, coins: 10 });
    const expensive = await createPayment(user._id, { gateway: "sslcommerz", price: 35, coins: 1000 });
    valid(cheap._id, "CHEAP", { amount: "110.00" });
    const warn = vi.spyOn(logger, "warn");

    const res = await callSuccess(expensive._id, "CHEAP");
    await callIpn(expensive._id, "CHEAP");

    expect(res.headers.get("location")).toContain("status=cancelled");
    expect(await coinsOf(user._id)).toBe(0);
    expect((await Payment.findById(expensive._id))?.status).toBe("pending");
    const logged = JSON.stringify(warn.mock.calls);
    expect(logged).toContain(String(expensive._id));
    expect(logged).toContain("gateway_mismatch");
    expect(logged).not.toContain("secret-store-password");

    // The cheap payment itself still credits, once.
    await callSuccess(cheap._id, "CHEAP");
    await callSuccess(cheap._id, "CHEAP");
    expect(await coinsOf(user._id)).toBe(10);
  });

  it("refuses a lower amount", async () => {
    const user = await createUser(0);
    const payment = await createPayment(user._id, { gateway: "sslcommerz", price: 10 });
    valid(payment._id, "LOW", { amount: "110.00" });
    const res = await callSuccess(payment._id, "LOW");
    await callIpn(payment._id, "LOW");
    expect(res.headers.get("location")).toContain("status=cancelled");
    expect(await coinsOf(user._id)).toBe(0);
  });

  it("refuses a wrong currency", async () => {
    const user = await createUser(0);
    const payment = await createPayment(user._id, { gateway: "sslcommerz", price: 10 });
    valid(payment._id, "CUR", { currency_type: "USD", currency: "USD" });
    await callSuccess(payment._id, "CUR");
    await callIpn(payment._id, "CUR");
    expect(await coinsOf(user._id)).toBe(0);
  });

  it("refuses validation statuses other than VALID/VALIDATED", async () => {
    const user = await createUser(0);
    const payment = await createPayment(user._id, { gateway: "sslcommerz" });
    valid(payment._id, "FAILED1", { status: "FAILED" });
    await callIpn(payment._id, "FAILED1");
    await callIpn(payment._id, "UNKNOWN");
    expect(await coinsOf(user._id)).toBe(0);
    valid(payment._id, "OK2", { status: "VALIDATED" });
    await callIpn(payment._id, "OK2");
    expect(await coinsOf(user._id)).toBe(150);
  });

  it("refuses a gateway mismatch (a bKash payment cannot be credited by SSLCommerz)", async () => {
    const user = await createUser(0);
    const payment = await createPayment(user._id, { gateway: "bkash" });
    valid(payment._id, "GW");
    await callIpn(payment._id, "GW");
    expect(await coinsOf(user._id)).toBe(0);
  });

  it("does not let one val_id credit two payments", async () => {
    const user = await createUser(0);
    const a = await createPayment(user._id, { gateway: "sslcommerz" });
    const b = await createPayment(user._id, { gateway: "sslcommerz" });
    valid(a._id, "ONE");
    await callIpn(a._id, "ONE");
    // A forged-looking validation answer naming b with the same val_id.
    valid(b._id, "ONE");
    await callIpn(b._id, "ONE");
    expect(await coinsOf(user._id)).toBe(150);
    expect((await Payment.findById(b._id))?.status).toBe("pending");
  });
});

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import mongoose from "mongoose";
import Payment from "@/models/Payment";
import {
  coinsOf,
  createPayment,
  createUser,
  jsonResponse,
  startTestDb,
} from "@/lib/payments/test-utils";

vi.hoisted(() => {
  process.env.NEXTAUTH_URL = "https://app.test";
  process.env.BKASH_BASE_URL = "https://bkash.test";
});
vi.mock("@/lib/db", () => ({ connectDB: async () => mongoose }));

import { GET as callback } from "@/app/api/bkash/callback/route";

let db: Awaited<ReturnType<typeof startTestDb>>;
let executeResponse: Record<string, unknown>;

beforeAll(async () => {
  db = await startTestDb("taskhub_bkash_test");
}, 180_000);
afterAll(async () => {
  await db?.stop();
});
beforeEach(async () => {
  await db.reset();
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      if (String(url).endsWith("/token/grant")) return jsonResponse({ id_token: "tok" });
      if (String(url).endsWith("/execute")) return jsonResponse(executeResponse);
      throw new Error(`unexpected fetch ${url}`);
    }),
  );
});
afterEach(() => vi.unstubAllGlobals());

function exec(invoice: unknown, over: Record<string, unknown> = {}) {
  executeResponse = {
    statusCode: "0000",
    transactionStatus: "Completed",
    paymentID: "BKP1",
    trxID: "TRX-1",
    amount: "1100.00",
    currency: "BDT",
    merchantInvoiceNumber: String(invoice),
    ...over,
  };
}
const call = (paymentID = "BKP1", status = "success") =>
  callback(new NextRequest(`https://app.test/api/bkash/callback?paymentID=${paymentID}&status=${status}`), undefined);

describe("bKash callback", () => {
  it("credits a completed payment with the right amount once", async () => {
    const user = await createUser(0);
    const payment = await createPayment(user._id, { gateway: "bkash", price: 10 });
    exec(payment._id);
    const res = await call();
    expect(res.headers.get("location")).toContain("success=1");
    await Promise.all([call(), call()]);
    expect(await coinsOf(user._id)).toBe(150);
    expect((await Payment.findById(payment._id))?.gatewayTransactionId).toBe("TRX-1");
  });

  it("refuses a lower amount", async () => {
    const user = await createUser(0);
    const payment = await createPayment(user._id, { gateway: "bkash", price: 35, coins: 1000 });
    exec(payment._id, { amount: "110.00" });
    const res = await call();
    expect(res.headers.get("location")).toContain("cancelled=1");
    expect(await coinsOf(user._id)).toBe(0);
  });

  it("refuses a wrong currency, an incomplete transaction and a mismatched paymentID", async () => {
    const user = await createUser(0);
    const payment = await createPayment(user._id, { gateway: "bkash" });
    exec(payment._id, { currency: "USD" });
    await call();
    exec(payment._id, { transactionStatus: "Initiated" });
    await call();
    exec(payment._id, { paymentID: "SOMETHING-ELSE" });
    await call();
    exec(payment._id, { trxID: "" });
    await call();
    expect(await coinsOf(user._id)).toBe(0);
  });

  it("refuses an invoice number that is not one of our payments, or is another gateway's", async () => {
    const user = await createUser(0);
    exec(new mongoose.Types.ObjectId());
    await call();
    exec("not-an-id");
    await call();
    const ssl = await createPayment(user._id, { gateway: "sslcommerz" });
    exec(ssl._id);
    await call();
    expect(await coinsOf(user._id)).toBe(0);
  });

  it("refuses a trxID that already credited another payment", async () => {
    const user = await createUser(0);
    const a = await createPayment(user._id, { gateway: "bkash" });
    const b = await createPayment(user._id, { gateway: "bkash" });
    exec(a._id);
    await call();
    exec(b._id);
    await call();
    expect(await coinsOf(user._id)).toBe(150);
    expect((await Payment.findById(b._id))?.status).toBe("pending");
  });
});

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import mongoose from "mongoose";
import Payment from "@/models/Payment";
import User from "@/models/User";
import { creditPayment, expectedCharge } from "@/lib/payments/credit";
import {
  coinsOf,
  createPayment,
  createUser,
  startTestDb,
} from "@/lib/payments/test-utils";

let db: Awaited<ReturnType<typeof startTestDb>>;

beforeAll(async () => {
  db = await startTestDb("taskhub_credit_test");
}, 180_000);
afterAll(async () => {
  await db?.stop();
});
beforeEach(async () => {
  await db.reset();
});

describe("creditPayment", () => {
  it("credits coins exactly once for 10 concurrent calls", async () => {
    const user = await createUser(50);
    const payment = await createPayment(user._id, { gateway: "bkash" });

    const results = await Promise.all(
      Array.from({ length: 10 }, () =>
        creditPayment({
          paymentId: String(payment._id),
          expected: { amount: 1100, currency: "BDT" },
          gateway: { name: "bkash", transactionId: "TRX1" },
        }),
      ),
    );

    expect(results.filter((r) => r.credited)).toHaveLength(1);
    expect(
      results.filter((r) => !r.credited).every((r) => r.reason === "already_processed"),
    ).toBe(true);
    expect(await coinsOf(user._id)).toBe(50 + 150);
    const saved = await Payment.findById(payment._id);
    expect(saved?.status).toBe("success");
    expect(saved?.gatewayTransactionId).toBe("TRX1");
    expect(saved?.paidAt).toBeInstanceOf(Date);
  });

  it("credits nothing on a second sequential call", async () => {
    const user = await createUser(0);
    const payment = await createPayment(user._id);
    const input = {
      paymentId: String(payment._id),
      gateway: { name: "sslcommerz" as const, transactionId: "B1", validationId: "V1" },
    };
    expect((await creditPayment(input)).credited).toBe(true);
    const second = await creditPayment(input);
    expect(second).toEqual({ credited: false, reason: "already_processed" });
    expect(await coinsOf(user._id)).toBe(150);
  });

  it("refuses a validation ID that already credited another payment", async () => {
    const user = await createUser(0);
    const first = await createPayment(user._id, { price: 1, coins: 10 });
    const second = await createPayment(user._id, { price: 35, coins: 1000 });

    const a = await creditPayment({
      paymentId: String(first._id),
      gateway: { name: "sslcommerz", transactionId: "BANK-A", validationId: "VAL-1" },
    });
    const b = await creditPayment({
      paymentId: String(second._id),
      gateway: { name: "sslcommerz", transactionId: "BANK-B", validationId: "VAL-1" },
    });

    expect(a.credited).toBe(true);
    expect(b).toEqual({ credited: false, reason: "duplicate_gateway_transaction" });
    expect(await coinsOf(user._id)).toBe(10);
    expect((await Payment.findById(second._id))?.status).toBe("pending");
  });

  it("refuses a provider transaction ID that already credited another payment", async () => {
    const user = await createUser(0);
    const first = await createPayment(user._id, { gateway: "bkash" });
    const second = await createPayment(user._id, { gateway: "bkash" });
    await creditPayment({
      paymentId: String(first._id),
      gateway: { name: "bkash", transactionId: "TRX-SAME" },
    });
    const again = await creditPayment({
      paymentId: String(second._id),
      gateway: { name: "bkash", transactionId: "TRX-SAME" },
    });
    expect(again.reason).toBe("duplicate_gateway_transaction");
    expect(await coinsOf(user._id)).toBe(150);
  });

  it("refuses a wrong amount, wrong currency or wrong gateway", async () => {
    const user = await createUser(0);
    const payment = await createPayment(user._id, { price: 10 });
    const id = String(payment._id);

    expect(
      (await creditPayment({ paymentId: id, expected: { amount: 10, currency: "BDT" }, gateway: { name: "sslcommerz", transactionId: "t" } })).reason,
    ).toBe("amount_mismatch");
    expect(
      (await creditPayment({ paymentId: id, expected: { amount: 1100, currency: "USD" }, gateway: { name: "sslcommerz", transactionId: "t" } })).reason,
    ).toBe("currency_mismatch");
    expect(
      (await creditPayment({ paymentId: id, expected: { amount: 1100, currency: "BDT" }, gateway: { name: "bkash", transactionId: "t" } })).reason,
    ).toBe("gateway_mismatch");
    expect(await coinsOf(user._id)).toBe(0);
    expect((await Payment.findById(id))?.status).toBe("pending");

    const ok = await creditPayment({ paymentId: id, expected: { amount: 1100.004, currency: "bdt" }, gateway: { name: "sslcommerz", transactionId: "t" } });
    expect(ok.credited).toBe(true);
  });

  it("returns not_found for unknown or malformed IDs", async () => {
    expect((await creditPayment({ paymentId: "nope", gateway: { name: "admin" } })).reason).toBe("not_found");
    expect(
      (await creditPayment({ paymentId: String(new mongoose.Types.ObjectId()), gateway: { name: "admin" } })).reason,
    ).toBe("not_found");
  });

  it("rolls the payment back when the user does not exist", async () => {
    const payment = await createPayment(new mongoose.Types.ObjectId());
    const result = await creditPayment({ paymentId: String(payment._id), gateway: { name: "admin" } });
    expect(result).toEqual({ credited: false, reason: "user_not_found" });
    expect((await Payment.findById(payment._id))?.status).toBe("pending");
  });

  it("records the admin on a manual confirmation", async () => {
    const user = await createUser(0);
    const admin = await createUser(0);
    const payment = await createPayment(user._id, { gateway: "stripe" });
    const r = await creditPayment({
      paymentId: String(payment._id),
      gateway: { name: "admin", adminUserId: String(admin._id) },
    });
    expect(r.credited).toBe(true);
    const saved = await Payment.findById(payment._id);
    expect(String(saved?.confirmedBy)).toBe(String(admin._id));
    expect(saved?.creditedVia).toBe("admin");
  });

  it("charges BDT gateways at 110 BDT per USD", () => {
    expect(expectedCharge({ gateway: "sslcommerz", amount: 10, currency: "bdt" })).toEqual({ amount: 1100, currency: "bdt" });
    expect(expectedCharge({ gateway: "stripe", amount: 10, currency: "usd" })).toEqual({ amount: 10, currency: "usd" });
  });

  it("builds the unique partial indexes", async () => {
    const indexes = await Payment.collection.indexes();
    const validation = indexes.find((i) => i.key.gatewayValidationId === 1);
    const tx = indexes.find((i) => i.key.gatewayTransactionId === 1);
    expect(validation?.unique).toBe(true);
    expect(validation?.partialFilterExpression).toBeDefined();
    expect(tx?.unique).toBe(true);
    expect(tx?.partialFilterExpression).toBeDefined();
    // Payments without the fields do not collide.
    const user = await User.create({ name: "x", email: "idx@example.test" });
    await createPayment(user._id);
    await createPayment(user._id);
    expect(await Payment.countDocuments({ userId: user._id })).toBe(2);
  });
});

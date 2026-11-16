import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import mongoose from "mongoose";
import LedgerAccount from "@/models/LedgerAccount";
import LedgerTransaction from "@/models/LedgerTransaction";
import User from "@/models/User";
import { coinsOf, createUser, startTestDb } from "@/lib/payments/test-utils";
import {
  adjustUserCoins,
  createUserWithBonus,
  isDuplicateKeyError,
  removeUser,
} from "@/lib/ledger/flows/users";

let db: Awaited<ReturnType<typeof startTestDb>>;

beforeAll(async () => {
  db = await startTestDb("taskhub_ledger_users_test");
}, 180_000);
afterAll(async () => {
  await db?.stop();
});
beforeEach(async () => {
  await db.reset();
});

const signup = (email: string, role: "worker" | "buyer", bonus: number) =>
  createUserWithBonus({ data: { name: "New User", email, role }, bonus });

describe("createUserWithBonus", () => {
  it("creates an opened user and grants the bonus from system:promotions", async () => {
    const { userId, coins } = await signup("w@example.test", "worker", 10);
    expect(coins).toBe(10);
    const user = await User.findById(userId);
    expect(user?.coins).toBe(10);
    expect(user?.ledgerOpenedAt).toBeInstanceOf(Date);
    expect(user?.status).toBe("active");
    const row = await LedgerTransaction.findOne({ idempotencyKey: `signup:${userId}` });
    expect(row?.type).toBe("signup_bonus");
    expect(row?.createdBy).toBe("system");
    expect((await LedgerAccount.findById("system:promotions"))?.balance).toBe(-10);
    // New users never need an opening entry.
    expect(await LedgerTransaction.countDocuments({ type: "opening" })).toBe(0);
  });

  it("keeps today's amounts per role", async () => {
    const { WORKER_INITIAL_COINS, BUYER_INITIAL_COINS } = await import("@/lib/constants");
    const w = await signup("w2@example.test", "worker", WORKER_INITIAL_COINS);
    const b = await signup("b2@example.test", "buyer", BUYER_INITIAL_COINS);
    expect(await coinsOf(w.userId)).toBe(10);
    expect(await coinsOf(b.userId)).toBe(50);
  });

  it("leaves nothing behind for a duplicate email", async () => {
    await signup("dup@example.test", "worker", 10);
    let error: unknown;
    try {
      await signup("dup@example.test", "worker", 10);
    } catch (err) {
      error = err;
    }
    expect(isDuplicateKeyError(error)).toBe(true);
    expect(await User.countDocuments({})).toBe(1);
    expect(await LedgerTransaction.countDocuments({ type: "signup_bonus" })).toBe(1);
    expect((await LedgerAccount.findById("system:promotions"))?.balance).toBe(-10);
  });

  it("two concurrent sign-ups with one email create one user and one bonus", async () => {
    const results = await Promise.allSettled(
      Array.from({ length: 6 }, () => signup("race@example.test", "buyer", 50)),
    );
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(await User.countDocuments({})).toBe(1);
    expect(await LedgerTransaction.countDocuments({ type: "signup_bonus" })).toBe(1);
  });

  it("rolls the user back if the bonus cannot be posted", async () => {
    await expect(signup("bad@example.test", "worker", 1.5)).rejects.toThrow(/integers/);
    expect(await User.countDocuments({})).toBe(0);
  });
});

describe("adjustUserCoins", () => {
  it("credits and debits against system:adjustments, createdBy the admin", async () => {
    const user = await createUser(10);
    const up = await adjustUserCoins({ userId: String(user._id), delta: 25, adminId: "adm", requestId: "r1", reason: "goodwill" });
    expect(up).toEqual({ ok: true, replayed: false });
    expect(await coinsOf(user._id)).toBe(35);
    const down = await adjustUserCoins({ userId: String(user._id), delta: -30, adminId: "adm", requestId: "r2" });
    expect(down.ok).toBe(true);
    expect(await coinsOf(user._id)).toBe(5);
    expect((await LedgerAccount.findById("system:adjustments"))?.balance).toBe(-25 + 30);
    const row = await LedgerTransaction.findOne({ idempotencyKey: "admin-adjust:r1" });
    expect(row?.createdBy).toBe("adm");
    expect(row?.meta.note).toBe("goodwill");
  });

  it("refuses a debit the balance cannot cover", async () => {
    const user = await createUser(5);
    const res = await adjustUserCoins({ userId: String(user._id), delta: -6, adminId: "adm", requestId: "r3" });
    expect(res).toEqual({ ok: false, reason: "insufficient_coins" });
    expect(await coinsOf(user._id)).toBe(5);
  });

  it("is idempotent by requestId and rejects unknown users", async () => {
    const user = await createUser(0);
    const args = { userId: String(user._id), delta: 10, adminId: "adm", requestId: "r4" };
    await adjustUserCoins(args);
    const again = await adjustUserCoins(args);
    expect(again).toEqual({ ok: true, replayed: true });
    expect(await coinsOf(user._id)).toBe(10);
    const ghost = await adjustUserCoins({ ...args, userId: String(new mongoose.Types.ObjectId()), requestId: "r5" });
    expect(ghost).toEqual({ ok: false, reason: "user_not_found" });
  });
});

describe("removeUser", () => {
  it("moves the user's coins to system:forfeited before deleting them", async () => {
    const user = await createUser(75);
    const res = await removeUser({ userId: String(user._id), adminId: "adm" });
    expect(res).toEqual({ ok: true, forfeited: 75 });
    expect(await User.findById(user._id)).toBeNull();
    expect((await LedgerAccount.findById("system:forfeited"))?.balance).toBe(75);
    const row = await LedgerTransaction.findOne({ type: "forfeit" });
    expect(row?.createdBy).toBe("adm");
    // The journal still balances for the removed user: opening +75, forfeit -75.
    const rows = await LedgerTransaction.find({ "entries.accountId": `user:${user._id}` });
    const sum = rows.flatMap((r) => r.entries).filter((e) => e.accountId === `user:${user._id}`).reduce((a, e) => a + e.amount, 0);
    expect(sum).toBe(0);
  });

  it("removes a user with no coins without any journal row", async () => {
    const user = await createUser(0);
    expect(await removeUser({ userId: String(user._id), adminId: "adm" })).toEqual({ ok: true, forfeited: 0 });
    expect(await LedgerTransaction.countDocuments({})).toBe(0);
    expect(await User.findById(user._id)).toBeNull();
  });

  it("reports a missing user", async () => {
    expect(await removeUser({ userId: String(new mongoose.Types.ObjectId()), adminId: "a" })).toEqual({
      ok: false,
      reason: "not_found",
    });
    expect(await removeUser({ userId: "nope", adminId: "a" })).toEqual({ ok: false, reason: "not_found" });
  });
});

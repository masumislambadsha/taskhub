import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import mongoose from "mongoose";
import LedgerAccount from "@/models/LedgerAccount";
import LedgerTransaction from "@/models/LedgerTransaction";
import User from "@/models/User";
import {
  IdempotencyConflictError,
  InsufficientCoinsError,
  InvalidTransactionError,
  SYSTEM_ACCOUNTS,
  UnknownAccountError,
  escrowAccount,
  inLedgerTransaction,
  parseAccount,
  postTransaction,
  userAccount,
  type PostInput,
} from "@/lib/ledger";
import { coinsOf, createUser, startTestDb } from "@/lib/payments/test-utils";

let db: Awaited<ReturnType<typeof startTestDb>>;

beforeAll(async () => {
  db = await startTestDb("taskhub_ledger_post_test");
}, 180_000);
afterAll(async () => {
  await db?.stop();
});
beforeEach(async () => {
  await db.reset();
});

function transfer(
  key: string,
  from: string,
  to: string,
  amount: number,
  overrides: Partial<PostInput> = {},
): PostInput {
  return {
    type: "admin_adjustment",
    idempotencyKey: key,
    entries: [
      { accountId: from, amount: -amount },
      { accountId: to, amount },
    ],
    createdBy: "system",
    ...overrides,
  };
}

const post = (input: PostInput) =>
  inLedgerTransaction((session) => postTransaction(input, session));

async function journalCount() {
  return LedgerTransaction.countDocuments({});
}

describe("account IDs", () => {
  it("parses user, escrow and system accounts and rejects the rest", () => {
    const id = new mongoose.Types.ObjectId().toString();
    expect(parseAccount(`user:${id}`)).toEqual({ kind: "user", userId: id });
    expect(parseAccount(`escrow:task:${id}`)).toEqual({ kind: "escrow", taskId: id });
    expect(parseAccount("system:issuance")).toEqual({ kind: "system", name: "system:issuance" });
    expect(parseAccount("system:made-up")).toBeNull();
    expect(parseAccount("user:not-an-id")).toBeNull();
    expect(parseAccount("wallet:1")).toBeNull();
  });
});

describe("postTransaction validation", () => {
  it("rejects non-integer amounts", async () => {
    const user = await createUser(0);
    await expect(
      post(transfer("k1", SYSTEM_ACCOUNTS.ISSUANCE, userAccount(user._id), 1.5)),
    ).rejects.toBeInstanceOf(InvalidTransactionError);
    expect(await journalCount()).toBe(0);
    expect(await coinsOf(user._id)).toBe(0);
  });

  it("rejects NaN, Infinity and zero amounts", async () => {
    const user = await createUser(0);
    for (const amount of [NaN, Infinity, 0]) {
      await expect(
        post({
          type: "admin_adjustment",
          idempotencyKey: `bad-${amount}`,
          entries: [
            { accountId: SYSTEM_ACCOUNTS.ISSUANCE, amount: -amount },
            { accountId: userAccount(user._id), amount },
          ],
          createdBy: "system",
        }),
      ).rejects.toBeInstanceOf(InvalidTransactionError);
    }
  });

  it("rejects entries that do not sum to 0", async () => {
    const user = await createUser(0);
    await expect(
      post({
        type: "admin_adjustment",
        idempotencyKey: "k2",
        entries: [
          { accountId: SYSTEM_ACCOUNTS.ISSUANCE, amount: -10 },
          { accountId: userAccount(user._id), amount: 11 },
        ],
        createdBy: "system",
      }),
    ).rejects.toThrow(/sum to 0/);
    expect(await coinsOf(user._id)).toBe(0);
  });

  it("rejects fewer than 2 entries", async () => {
    const user = await createUser(0);
    await expect(
      post({
        type: "admin_adjustment",
        idempotencyKey: "k3",
        entries: [{ accountId: userAccount(user._id), amount: 5 }],
        createdBy: "system",
      }),
    ).rejects.toThrow(/at least 2 entries/);
  });

  it("rejects the same account twice in one transaction", async () => {
    const user = await createUser(10);
    await expect(
      post({
        type: "admin_adjustment",
        idempotencyKey: "k4",
        entries: [
          { accountId: userAccount(user._id), amount: -5 },
          { accountId: userAccount(user._id), amount: 5 },
        ],
        createdBy: "system",
      }),
    ).rejects.toBeInstanceOf(InvalidTransactionError);
  });

  it("rejects unknown accounts: bad names, missing users, missing escrow", async () => {
    const user = await createUser(10);
    const ghost = new mongoose.Types.ObjectId().toString();
    const unknown = [
      "system:bogus",
      "wallet:1",
      `user:${ghost}`,
      `escrow:task:${ghost}`,
    ];
    for (const [i, accountId] of unknown.entries()) {
      await expect(
        post(transfer(`u${i}`, userAccount(user._id), accountId, 1)),
      ).rejects.toBeInstanceOf(UnknownAccountError);
    }
    expect(await coinsOf(user._id)).toBe(10);
    expect(await journalCount()).toBe(0);
  });

  it("refuses to run outside a transaction", async () => {
    const user = await createUser(0);
    const session = await mongoose.startSession();
    try {
      await expect(
        postTransaction(
          transfer("k5", SYSTEM_ACCOUNTS.ISSUANCE, userAccount(user._id), 1),
          session,
        ),
      ).rejects.toBeInstanceOf(InvalidTransactionError);
    } finally {
      await session.endSession();
    }
  });

  it("refuses to post opening entries by hand", async () => {
    const user = await createUser(0);
    await expect(
      post(
        transfer("k6", SYSTEM_ACCOUNTS.MIGRATION, userAccount(user._id), 5, {
          type: "opening",
        }),
      ),
    ).rejects.toBeInstanceOf(InvalidTransactionError);
  });
});

describe("postTransaction balances", () => {
  it("moves coins and records the journal row", async () => {
    const user = await createUser(0);
    const { transaction, replayed } = await post(
      transfer("topup-1", SYSTEM_ACCOUNTS.ISSUANCE, userAccount(user._id), 150, {
        type: "topup",
        meta: { paymentId: "p1" },
      }),
    );
    expect(replayed).toBe(false);
    expect(transaction.entries.map((e) => e.amount).sort((a, b) => a - b)).toEqual([-150, 150]);
    expect(await coinsOf(user._id)).toBe(150);
    const issuance = await LedgerAccount.findById(SYSTEM_ACCOUNTS.ISSUANCE);
    expect(issuance?.balance).toBe(-150);
    expect(issuance?.allowNegative).toBe(true);
    expect(issuance?.kind).toBe("system");
  });

  it("throws InsufficientCoinsError and rolls everything back", async () => {
    const user = await createUser(5);
    await expect(
      post(transfer("d1", userAccount(user._id), SYSTEM_ACCOUNTS.ISSUANCE, 6)),
    ).rejects.toBeInstanceOf(InsufficientCoinsError);
    expect(await coinsOf(user._id)).toBe(5);
    expect(await journalCount()).toBe(0);
    // The pre-ledger user's opening was part of the aborted transaction too.
    expect((await User.findById(user._id))?.ledgerOpenedAt).toBeUndefined();
    expect(await LedgerAccount.countDocuments({})).toBe(0);
  });

  it("never lets an escrow account go negative", async () => {
    const user = await createUser(100);
    const taskId = new mongoose.Types.ObjectId().toString();
    await LedgerAccount.create({
      _id: escrowAccount(taskId),
      kind: "escrow",
      balance: 10,
      allowNegative: false,
    });
    await expect(
      post(transfer("e1", escrowAccount(taskId), userAccount(user._id), 11)),
    ).rejects.toBeInstanceOf(InsufficientCoinsError);
    await post(transfer("e2", escrowAccount(taskId), userAccount(user._id), 10));
    expect((await LedgerAccount.findById(escrowAccount(taskId)))?.balance).toBe(0);
  });

  it("lets system accounts go negative", async () => {
    const user = await createUser(0);
    await post(transfer("s1", SYSTEM_ACCOUNTS.PROMOTIONS, userAccount(user._id), 10, { type: "signup_bonus" }));
    await post(transfer("s2", SYSTEM_ACCOUNTS.PROMOTIONS, userAccount(user._id), 10, { type: "signup_bonus" }));
    expect((await LedgerAccount.findById(SYSTEM_ACCOUNTS.PROMOTIONS))?.balance).toBe(-20);
  });
});

describe("idempotency", () => {
  it("posts the same key twice once", async () => {
    const user = await createUser(0);
    const input = transfer("same", SYSTEM_ACCOUNTS.ISSUANCE, userAccount(user._id), 40);
    const first = await post(input);
    const second = await post(input);
    expect(first.replayed).toBe(false);
    expect(second.replayed).toBe(true);
    expect(String(second.transaction._id)).toBe(String(first.transaction._id));
    expect(await coinsOf(user._id)).toBe(40);
    expect(await journalCount()).toBe(1);
  });

  it("posts the same key once under 10 concurrent attempts", async () => {
    const user = await createUser(0);
    const input = transfer("race", SYSTEM_ACCOUNTS.ISSUANCE, userAccount(user._id), 40);
    const results = await Promise.all(Array.from({ length: 10 }, () => post(input)));
    expect(results.filter((r) => !r.replayed)).toHaveLength(1);
    expect(await coinsOf(user._id)).toBe(40);
    expect(await journalCount()).toBe(1);
    expect((await LedgerAccount.findById(SYSTEM_ACCOUNTS.ISSUANCE))?.balance).toBe(-40);
  });

  it("refuses to reuse a key for different content", async () => {
    const user = await createUser(0);
    await post(transfer("reuse", SYSTEM_ACCOUNTS.ISSUANCE, userAccount(user._id), 40));
    await expect(
      post(transfer("reuse", SYSTEM_ACCOUNTS.ISSUANCE, userAccount(user._id), 41)),
    ).rejects.toBeInstanceOf(IdempotencyConflictError);
    expect(await coinsOf(user._id)).toBe(40);
  });
});

describe("lazy opening of users", () => {
  it("posts a journal-only opening entry before the first posting", async () => {
    const user = await createUser(70);
    await post(transfer("o1", SYSTEM_ACCOUNTS.ISSUANCE, userAccount(user._id), 30, { type: "topup" }));

    const saved = await User.findById(user._id);
    expect(saved?.coins).toBe(100);
    expect(saved?.ledgerOpenedAt).toBeInstanceOf(Date);

    const opening = await LedgerTransaction.findOne({ idempotencyKey: `opening:user:${user._id}` });
    expect(opening?.type).toBe("opening");
    expect(opening?.entries.find((e) => e.accountId === userAccount(user._id))?.amount).toBe(70);
    expect((await LedgerAccount.findById(SYSTEM_ACCOUNTS.MIGRATION))?.balance).toBe(-70);
  });

  it("opens exactly once under concurrent postings", async () => {
    const user = await createUser(100);
    await Promise.all(
      Array.from({ length: 8 }, (_, i) =>
        post(transfer(`c${i}`, SYSTEM_ACCOUNTS.ISSUANCE, userAccount(user._id), 5, { type: "topup" })),
      ),
    );
    expect(await coinsOf(user._id)).toBe(140);
    expect(await LedgerTransaction.countDocuments({ type: "opening" })).toBe(1);
    expect((await LedgerAccount.findById(SYSTEM_ACCOUNTS.MIGRATION))?.balance).toBe(-100);
  });

  it("opens a user with no coins without a journal row", async () => {
    const user = await createUser(0);
    await post(transfer("o2", SYSTEM_ACCOUNTS.ISSUANCE, userAccount(user._id), 5, { type: "topup" }));
    expect(await LedgerTransaction.countDocuments({ type: "opening" })).toBe(0);
    expect((await User.findById(user._id))?.ledgerOpenedAt).toBeInstanceOf(Date);
  });

  it("refuses to open a user holding a fractional balance", async () => {
    const user = await createUser(2.5);
    await expect(
      post(transfer("o3", SYSTEM_ACCOUNTS.ISSUANCE, userAccount(user._id), 5, { type: "topup" })),
    ).rejects.toBeInstanceOf(InvalidTransactionError);
    expect(await coinsOf(user._id)).toBe(2.5);
  });
});

describe("append-only journal", () => {
  it("refuses updates and deletes through Mongoose", async () => {
    const user = await createUser(0);
    const { transaction } = await post(
      transfer("ao", SYSTEM_ACCOUNTS.ISSUANCE, userAccount(user._id), 5, { type: "topup" }),
    );
    await expect(LedgerTransaction.updateOne({ _id: transaction._id }, { createdBy: "x" })).rejects.toThrow(/append-only/);
    await expect(LedgerTransaction.deleteMany({})).rejects.toThrow(/append-only/);
    await expect(LedgerTransaction.findByIdAndDelete(transaction._id)).rejects.toThrow(/append-only/);
    const loaded = await LedgerTransaction.findById(transaction._id);
    loaded!.createdBy = "tampered";
    await expect(loaded!.save()).rejects.toThrow(/append-only/);
    expect(await journalCount()).toBe(1);
  });
});

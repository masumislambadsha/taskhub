import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import mongoose from "mongoose";
import type { JWT } from "next-auth/jwt";
vi.mock("@/lib/db", () => ({ connectDB: async () => mongoose }));

import User from "@/models/User";
import { startTestDb } from "@/lib/payments/test-utils";
import { refreshToken, resolveBearerUser } from "@/lib/auth-session";

let db: Awaited<ReturnType<typeof startTestDb>>;

beforeAll(async () => {
  db = await startTestDb("taskhub_auth_session_test");
}, 180_000);
afterAll(async () => {
  await db?.stop();
});
beforeEach(async () => {
  await db.reset();
});

const makeUser = (extra: Record<string, unknown> = {}) =>
  User.create({
    name: "Wendy Worker",
    email: `w${Math.random().toString(36).slice(2)}@example.test`,
    role: "worker",
    coins: 10,
    ...extra,
  });

describe("refreshToken", () => {
  it("ignores a role sent by the client for an existing worker", async () => {
    const user = await makeUser();
    const token = await refreshToken(
      { id: user._id.toString(), role: "worker" } as JWT,
      { trigger: "update", session: { role: "admin", coins: 999 } },
    );
    expect(token?.role).toBe("worker");
    expect(token?.coins).toBe(10);
  });

  it("invalidates the session of a deleted user instead of keeping a client-sent admin role", async () => {
    const user = await makeUser();
    const id = user._id.toString();
    await User.deleteOne({ _id: user._id });
    const token = await refreshToken(
      { id, role: "worker" } as JWT,
      { trigger: "update", session: { role: "admin", coins: 999 } },
    );
    expect(token).toBeNull();
  });

  it("invalidates the token of a suspended user", async () => {
    const user = await makeUser({ status: "suspended" });
    const token = await refreshToken({
      id: user._id.toString(),
      role: "worker",
    } as JWT);
    expect(token).toBeNull();
  });

  it("invalidates a token whose id is not a valid user id", async () => {
    expect(await refreshToken({ id: "not-an-id" } as JWT)).toBeNull();
    expect(await refreshToken({} as JWT)).toBeNull();
  });

  it("shows role, coins and profile changes from the database for an active user", async () => {
    const user = await makeUser();
    const id = user._id.toString();
    await User.updateOne(
      { _id: user._id },
      { role: "buyer", coins: 77, name: "New Name", photoUrl: "https://x.test/p.png" },
    );
    const token = await refreshToken({ id, role: "worker", coins: 10 } as JWT);
    expect(token?.role).toBe("buyer");
    expect(token?.coins).toBe(77);
    expect(token?.name).toBe("New Name");
    expect(token?.picture).toBe("https://x.test/p.png");
  });
});

describe("resolveBearerUser", () => {
  it("resolves an active user from the database", async () => {
    const user = await makeUser({ role: "buyer", coins: 5 });
    const resolved = await resolveBearerUser({ id: user._id.toString() });
    expect(resolved).toMatchObject({
      id: user._id.toString(),
      role: "buyer",
      coins: 5,
    });
  });

  it("resolves a suspended user to no user", async () => {
    const user = await makeUser({ status: "suspended" });
    expect(await resolveBearerUser({ id: user._id.toString() })).toBeNull();
  });

  it("resolves a deleted user to no user", async () => {
    const user = await makeUser();
    const id = user._id.toString();
    await User.deleteOne({ _id: user._id });
    expect(await resolveBearerUser({ id })).toBeNull();
  });

  it("resolves a missing or malformed token to no user", async () => {
    expect(await resolveBearerUser(null)).toBeNull();
    expect(await resolveBearerUser({})).toBeNull();
    expect(await resolveBearerUser({ id: "nope" })).toBeNull();
  });
});

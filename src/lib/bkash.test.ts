import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import mongoose from "mongoose";
import BkashToken from "@/models/BkashToken";
import { jsonResponse, startTestDb } from "@/lib/payments/test-utils";

vi.hoisted(() => {
  process.env.NEXTAUTH_URL = "https://app.test";
  process.env.BKASH_BASE_URL = "https://bkash.test";
});
vi.mock("@/lib/db", () => ({ connectDB: async () => mongoose }));

import {
  BKASH_TOKEN_TTL_MS,
  createBkashPayment,
  executeBkashPayment,
  getBkashToken,
  invalidateBkashToken,
} from "@/lib/bkash";

const MINUTE = 60 * 1000;
let db: Awaited<ReturnType<typeof startTestDb>>;
let grants: number;
let createStatuses: number[];
let fetchMock: ReturnType<typeof vi.fn>;
const authHeaders: string[] = [];

beforeAll(async () => {
  db = await startTestDb("taskhub_bkash_token_test");
}, 180_000);
afterAll(async () => {
  await db?.stop();
});
beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
  await invalidateBkashToken(); // clears memory and the bkash_tokens document
  grants = 0;
  createStatuses = [];
  authHeaders.length = 0;
  fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    const u = String(url);
    if (u.endsWith("/token/grant")) {
      grants += 1;
      return jsonResponse({ id_token: `tok-${grants}` });
    }
    authHeaders.push((init?.headers as Record<string, string>).authorization);
    if (u.endsWith("/create")) {
      const status = createStatuses.shift() ?? 200;
      return status === 200
        ? jsonResponse({ bkashURL: "https://pay.test/1" })
        : jsonResponse({ message: "Unauthorized" }, status);
    }
    if (u.endsWith("/execute")) return jsonResponse({ statusCode: "0000" });
    throw new Error(`unexpected fetch ${u}`);
  });
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("bKash grant token cache", () => {
  it("makes one grant call for two payments 10 minutes apart", async () => {
    await createBkashPayment("100.00", "p1");
    vi.setSystemTime(Date.now() + 10 * MINUTE);
    await createBkashPayment("100.00", "p2");
    await executeBkashPayment("BKP1");
    expect(grants).toBe(1);
    expect(authHeaders).toEqual(["tok-1", "tok-1", "tok-1"]);
  });

  it("fetches a new grant at 50 minutes plus 1 second", async () => {
    await getBkashToken();
    vi.setSystemTime(Date.now() + BKASH_TOKEN_TTL_MS - 1000);
    expect(await getBkashToken()).toBe("tok-1");
    vi.setSystemTime(Date.now() + 2000); // now 50 min + 1 s after the grant
    expect(await getBkashToken()).toBe("tok-2");
    expect(grants).toBe(2);
  });

  it("reuses the stored token in a second instance with no grant call", async () => {
    expect(await getBkashToken()).toBe("tok-1");
    expect(await BkashToken.findById("grant").lean()).toMatchObject({ idToken: "tok-1" });
    vi.resetModules(); // a fresh module has an empty memory cache; the DB is kept
    const other = await import("@/lib/bkash");
    expect(await other.getBkashToken()).toBe("tok-1");
    expect(grants).toBe(1);
  });

  it("makes one grant call for five concurrent calls on a cold cache", async () => {
    const tokens = await Promise.all(Array.from({ length: 5 }, () => getBkashToken()));
    expect(tokens).toEqual(Array(5).fill("tok-1"));
    expect(grants).toBe(1);
  });

  it("retries create once after a 401 and succeeds", async () => {
    createStatuses = [401, 200];
    expect(await createBkashPayment("100.00", "p1")).toBe("https://pay.test/1");
    expect(grants).toBe(2);
    expect(authHeaders).toEqual(["tok-1", "tok-2"]);
    expect((await BkashToken.findById("grant").lean())?.idToken).toBe("tok-2");
  });

  it("gives an error after exactly one retry when create returns 401 twice", async () => {
    createStatuses = [401, 401, 200];
    await expect(createBkashPayment("100.00", "p1")).rejects.toThrow();
    expect(authHeaders).toHaveLength(2);
    expect(grants).toBe(2);
  });

  it("still returns a token when the token store throws", async () => {
    vi.spyOn(BkashToken, "findById").mockImplementation(() => {
      throw new Error("db down");
    });
    vi.spyOn(BkashToken, "findByIdAndUpdate").mockImplementation(() => {
      throw new Error("db down");
    });
    expect(await getBkashToken()).toBe("tok-1");
    expect(await getBkashToken()).toBe("tok-1"); // memory still works
    expect(grants).toBe(1);
  });
});

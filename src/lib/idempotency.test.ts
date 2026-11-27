import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import IdempotencyKey from "@/models/IdempotencyKey";
import { startTestDb } from "@/lib/payments/test-utils";

vi.mock("@/lib/db", () => ({ connectDB: async () => mongoose }));

import { STALE_LOCK_MS, withIdempotency } from "./idempotency";

let db: Awaited<ReturnType<typeof startTestDb>>;

beforeAll(async () => {
  db = await startTestDb("taskhub_idempotency_test");
  await IdempotencyKey.init();
}, 180_000);
afterAll(async () => {
  await db?.stop();
});
beforeEach(async () => {
  await db.reset();
  await IdempotencyKey.deleteMany({});
});

const KEY = "11111111-2222-3333-4444-555555555555";

function request(body: unknown, key: string | null = KEY, path = "/api/v1/x") {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (key !== null) headers["Idempotency-Key"] = key;
  return new NextRequest(`https://app.test${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

/** A handler that counts how often it ran and echoes the body it read. */
function counting(status = 201) {
  const fn = vi.fn(async () => NextResponse.json({ n: fn.mock.calls.length }, { status }));
  return fn;
}

describe("withIdempotency", () => {
  it("runs the handler as before when there is no key", async () => {
    const h = counting();
    await withIdempotency(request({ a: 1 }, null), "u1", h);
    await withIdempotency(request({ a: 1 }, null), "u1", h);
    expect(h).toHaveBeenCalledTimes(2);
    expect(await IdempotencyKey.countDocuments()).toBe(0);
  });

  it("rejects a malformed key", async () => {
    const h = counting();
    const res = await withIdempotency(request({ a: 1 }, "short"), "u1", h);
    expect(res.status).toBe(400);
    expect(h).not.toHaveBeenCalled();
  });

  it("replays the stored response and does not run the handler twice", async () => {
    const h = counting();
    const first = await withIdempotency(request({ a: 1 }), "u1", h);
    const second = await withIdempotency(request({ a: 1 }), "u1", h);

    expect(h).toHaveBeenCalledTimes(1);
    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(await second.json()).toEqual({ n: 1 });
    expect(second.headers.get("Idempotent-Replay")).toBe("true");
    expect(first.headers.get("Idempotent-Replay")).toBeNull();
  });

  it("lets the handler still read the request body", async () => {
    let seen: unknown;
    const req = request({ amount: 7 }, "99999999-aaaa-bbbb-cccc-dddddddddddd");
    await withIdempotency(req, "u1", async () => {
      seen = await req.json();
      return NextResponse.json({ ok: true });
    });
    expect(seen).toEqual({ amount: 7 });
  });

  it("returns 422 for the same key with a different body or path", async () => {
    const h = counting();
    await withIdempotency(request({ amount: 100 }), "u1", h);

    const otherBody = await withIdempotency(request({ amount: 999 }), "u1", h);
    expect(otherBody.status).toBe(422);

    const otherPath = await withIdempotency(request({ amount: 100 }, KEY, "/api/v1/y"), "u1", h);
    expect(otherPath.status).toBe(422);
    expect(h).toHaveBeenCalledTimes(1);
  });

  it("keeps each user's keys separate", async () => {
    const h = counting();
    await withIdempotency(request({ a: 1 }), "u1", h);
    await withIdempotency(request({ a: 1 }), "u2", h);
    expect(h).toHaveBeenCalledTimes(2);
  });

  it("runs the handler once when the same request arrives many times at once", async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const h = vi.fn(async () => {
      await gate;
      return NextResponse.json({ done: true }, { status: 201 });
    });

    const calls = Array.from({ length: 8 }, () => withIdempotency(request({ a: 1 }), "u1", h));
    // Let every call reach the claim step while the first handler is still running.
    await new Promise((r) => setTimeout(r, 200));
    release();
    const results = await Promise.all(calls);

    expect(h).toHaveBeenCalledTimes(1);
    const statuses = results.map((r) => r.status).sort();
    expect(statuses.filter((s) => s === 201).length).toBe(1);
    expect(statuses.filter((s) => s === 409).length).toBe(7);
  });

  it("releases the key after an error response so a corrected retry works", async () => {
    const fail = vi.fn(async () => NextResponse.json({ error: "Insufficient coins" }, { status: 400 }));
    const bad = await withIdempotency(request({ a: 1 }), "u1", fail);
    expect(bad.status).toBe(400);
    expect(await IdempotencyKey.countDocuments()).toBe(0);

    const ok = counting();
    const good = await withIdempotency(request({ a: 2 }), "u1", ok);
    expect(good.status).toBe(201);
    expect(ok).toHaveBeenCalledTimes(1);
  });

  it("releases the key when the handler throws, and rethrows", async () => {
    const boom = vi.fn(async () => {
      throw new Error("boom");
    });
    await expect(withIdempotency(request({ a: 1 }), "u1", boom)).rejects.toThrow("boom");
    expect(await IdempotencyKey.countDocuments()).toBe(0);

    const ok = counting();
    expect((await withIdempotency(request({ a: 1 }), "u1", ok)).status).toBe(201);
  });

  it("lets a retry take over a key whose first request looks crashed", async () => {
    await IdempotencyKey.create({
      userId: "u1",
      key: KEY,
      requestHash: "x",
      status: "in_progress",
      lockedAt: new Date(Date.now() - STALE_LOCK_MS - 1000),
    });
    // Same hash needed: build it the way the helper does by running once to learn it.
    const probe = await withIdempotency(request({ a: 1 }, "ffffffff-0000-1111-2222-333333333333"), "u1", counting());
    const stored = await IdempotencyKey.findOne({ key: "ffffffff-0000-1111-2222-333333333333" }).lean();
    await IdempotencyKey.updateOne(
      { key: KEY },
      { $set: { requestHash: stored!.requestHash } },
    );
    expect(probe.status).toBe(201);

    const h = counting();
    const res = await withIdempotency(request({ a: 1 }), "u1", h);
    expect(res.status).toBe(201);
    expect(h).toHaveBeenCalledTimes(1);
  });

  it("does not take over a key whose first request is still fresh", async () => {
    const probe = await withIdempotency(request({ a: 1 }, "ffffffff-0000-1111-2222-333333333333"), "u1", counting());
    expect(probe.status).toBe(201);
    const stored = await IdempotencyKey.findOne({ key: "ffffffff-0000-1111-2222-333333333333" }).lean();
    await IdempotencyKey.create({
      userId: "u1",
      key: KEY,
      requestHash: stored!.requestHash,
      status: "in_progress",
      lockedAt: new Date(),
    });
    const h = counting();
    const res = await withIdempotency(request({ a: 1 }), "u1", h);
    expect(res.status).toBe(409);
    expect(h).not.toHaveBeenCalled();
  });
});

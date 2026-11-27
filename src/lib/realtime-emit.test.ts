import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import mongoose from "mongoose";
import Redis from "ioredis";
import Notification from "@/models/Notification";
import Outbox from "@/models/Outbox";
import { startTestDb } from "@/lib/payments/test-utils";
import { closeRealtimeEmitter, emitToUser } from "@/lib/realtime-emit";
import { defaultHandlers, drainOutbox, queueNotification } from "@/lib/outbox";

vi.mock("@/lib/db", () => ({ connectDB: async () => mongoose }));

// A real Redis: set TEST_REDIS_URL (CI does). Each test file uses its own database number.
const BASE = process.env.TEST_REDIS_URL;
const URL = BASE ? `${BASE}/7` : undefined;

let db: Awaited<ReturnType<typeof startTestDb>>;

beforeAll(async () => {
  db = await startTestDb("taskhub_realtime_emit_test");
  await Promise.all([Outbox.init(), Notification.init()]);
}, 180_000);
afterAll(async () => {
  await db?.stop();
});
beforeEach(async () => {
  await Promise.all([Outbox.deleteMany({}), Notification.deleteMany({})]);
});
afterEach(async () => {
  await closeRealtimeEmitter();
  delete process.env.REDIS_URL;
});

const USER = "6b0000000000000000000b01";

/** Listens to the channels the Socket.io Redis adapter uses, as a realtime instance would. */
async function listen() {
  const sub = new Redis(URL!);
  const seen: Buffer[] = [];
  sub.on("pmessageBuffer", (_pattern: Buffer, _channel: Buffer, message: Buffer) => seen.push(message));
  await sub.psubscribe("socket.io*");
  return {
    seen,
    text: () => seen.map((b) => b.toString("latin1")).join("\n"),
    stop: async () => sub.disconnect(),
  };
}
const settle = () => new Promise((resolve) => setTimeout(resolve, 150));

describe("emitToUser", () => {
  it("does nothing, and says so, when Redis is not configured", async () => {
    delete process.env.REDIS_URL;
    expect(await emitToUser(USER, "notification:new", { message: "x" })).toBe(false);
  });

  it.skipIf(!URL)("publishes to the user's room so any realtime instance can deliver it", async () => {
    process.env.REDIS_URL = URL;
    const l = await listen();
    try {
      expect(await emitToUser(USER, "notification:new", { message: "hello" })).toBe(true);
      await settle();
      expect(l.seen.length).toBeGreaterThan(0);
      const text = l.text();
      expect(text).toContain("notification:new");
      expect(text).toContain(`user:${USER}`);
      expect(text).toContain("hello");
    } finally {
      await l.stop();
    }
  });

  it("never throws when Redis is unreachable", async () => {
    process.env.REDIS_URL = "redis://127.0.0.1:1";
    await expect(emitToUser(USER, "notification:new", {})).resolves.toBeDefined();
  });
});

describe.skipIf(!URL)("the outbox pushes a delivered notification live", () => {
  it("one push for a new notification, and none for a repeated delivery", async () => {
    process.env.REDIS_URL = URL;
    const l = await listen();
    try {
      const note = { toUserId: USER, toEmail: "u@example.test", message: "you were paid", actionRoute: "/worker/earnings", type: "success" as const };
      await queueNotification(note, "live-1");
      expect(await drainOutbox()).toMatchObject({ sent: 1 });
      await settle();
      const first = l.seen.length;
      expect(first).toBeGreaterThan(0);
      expect(l.text()).toContain("you were paid");
      expect(await Notification.countDocuments({ outboxKey: "live-1" })).toBe(1);

      // The same key delivered again (a crash before it was marked sent): no second notification, no second push.
      await defaultHandlers.notification(note, "live-1");
      await settle();
      expect(l.seen.length).toBe(first);
      expect(await Notification.countDocuments({ outboxKey: "live-1" })).toBe(1);
    } finally {
      await l.stop();
    }
  });

  it("a failing push never fails the delivery: the notification is saved and the row is sent", async () => {
    process.env.REDIS_URL = "redis://127.0.0.1:1";
    await queueNotification({ toUserId: USER, toEmail: "u@example.test", message: "saved anyway" }, "live-2");
    expect(await drainOutbox()).toMatchObject({ sent: 1, retried: 0 });
    expect(await Notification.countDocuments({ outboxKey: "live-2" })).toBe(1);
  }, 20_000);
});

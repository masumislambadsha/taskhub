import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import mongoose from "mongoose";
import AuditLog from "@/models/AuditLog";
import Notification from "@/models/Notification";
import Outbox from "@/models/Outbox";
import { startTestDb } from "@/lib/payments/test-utils";

const authMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/db", () => ({ connectDB: async () => mongoose }));
vi.mock("@/lib/auth", () => ({ auth: authMock }));

import { GET as listGet } from "@/app/api/v1/admin/outbox/route";
import { POST as retryPost } from "@/app/api/v1/admin/outbox/[id]/retry/route";
import { queueNotification } from "@/lib/outbox";

let db: Awaited<ReturnType<typeof startTestDb>>;

beforeAll(async () => {
  db = await startTestDb("taskhub_outbox_api_test");
  await Promise.all([Outbox.init(), Notification.init()]);
}, 180_000);
afterAll(async () => {
  await db?.stop();
});
beforeEach(async () => {
  await db.reset();
  await Promise.all([Outbox.deleteMany({}), Notification.deleteMany({})]);
});

const as = (role: string | null) =>
  authMock.mockResolvedValue(role ? { user: { id: "6b0000000000000000000a01", role } } : null);
const list = (qs = "") => listGet(new NextRequest(`https://app.test/api/v1/admin/outbox${qs}`));
const retry = (id: unknown) =>
  retryPost(new NextRequest("https://app.test/x", { method: "POST" }), { params: Promise.resolve({ id: String(id) }) });

async function seed() {
  const note = { toUserId: "6b0000000000000000000b01", toEmail: "u@example.test", message: "hi" };
  await queueNotification(note, "pending-1");
  await queueNotification(note, "failed-1");
  await queueNotification(note, "sent-1");
  await Outbox.updateOne({ idempotencyKey: "failed-1" }, { $set: { status: "failed", attempts: 8, lastError: "resend down" } });
  await Outbox.updateOne({ idempotencyKey: "sent-1" }, { $set: { status: "sent", sentAt: new Date() } });
  return (await Outbox.findOne({ idempotencyKey: "failed-1" }))!;
}

describe("admin outbox", () => {
  it("is for admins only; the demo admin, others and anonymous are turned away", async () => {
    await seed();
    as("demo_admin");
    expect((await list()).status).toBe(403);
    as("buyer");
    expect((await list()).status).toBe(401);
    as(null);
    expect((await list()).status).toBe(401);
  });

  it("lists failed and waiting rows by default, with counts, and filters by status", async () => {
    await seed();
    as("admin");
    const body = await (await list()).json();
    expect(body.rows.map((r: { idempotencyKey: string }) => r.idempotencyKey).sort()).toEqual(["failed-1", "pending-1"]);
    expect(body.counts).toEqual({ pending: 1, failed: 1, sent: 1 });
    expect((await (await list("?status=sent")).json()).rows).toHaveLength(1);
    expect((await (await list("?status=nonsense")).json()).rows).toHaveLength(2);
  });

  it("retrying a failed row sends it now and is audit-logged; a row that is not failed cannot be retried", async () => {
    const failed = await seed();
    as("admin");
    const res = await retry(failed._id);
    expect(res.status).toBe(200);
    expect((await Outbox.findById(failed._id))?.status).toBe("sent");
    expect(await Notification.countDocuments({ outboxKey: "failed-1" })).toBe(1);
    expect(await AuditLog.countDocuments({ action: "outbox.retry", targetId: String(failed._id) })).toBe(1);

    expect((await retry(failed._id)).status).toBe(404);
    expect((await retry("nope")).status).toBe(404);
    expect((await retry(new mongoose.Types.ObjectId())).status).toBe(404);
    expect(await AuditLog.countDocuments({ action: "outbox.retry" })).toBe(1);
  });

  it("only an admin can retry", async () => {
    const failed = await seed();
    for (const role of ["demo_admin", "worker", null]) {
      as(role);
      expect([401, 403]).toContain((await retry(failed._id)).status);
    }
    expect((await Outbox.findById(failed._id))?.status).toBe("failed");
  });
});

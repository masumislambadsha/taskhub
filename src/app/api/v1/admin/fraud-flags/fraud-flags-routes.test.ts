// @vitest-environment node
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import mongoose from "mongoose";
import { NextRequest } from "next/server";
import AuditLog from "@/models/AuditLog";
import FraudFlag from "@/models/FraudFlag";
import { startTestDb } from "@/lib/payments/test-utils";

const session = vi.hoisted(() => ({ current: null as unknown }));
vi.mock("@/lib/auth", () => ({ auth: async () => session.current }));
vi.mock("@/lib/db", () => ({ connectDB: async () => mongoose }));

import { GET } from "./route";
import { PATCH } from "./[id]/route";

let db: Awaited<ReturnType<typeof startTestDb>>;
beforeAll(async () => {
  db = await startTestDb("taskhub_fraud_routes_test");
  await FraudFlag.init();
}, 180_000);
afterAll(async () => {
  await db?.stop();
});
beforeEach(async () => {
  await db.reset();
  await AuditLog.collection.deleteMany({});
  session.current = { user: { id: new mongoose.Types.ObjectId().toString(), role: "admin" } };
});

const oid = () => new mongoose.Types.ObjectId();
const patch = (id: string, body: unknown) =>
  PATCH(new NextRequest("http://x/api", { method: "PATCH", body: JSON.stringify(body) }), { params: Promise.resolve({ id }) });

async function flag(severity: "high" | "medium" = "medium") {
  return FraudFlag.create({
    userId: oid(),
    submissionId: oid(),
    type: "duplicate_proof",
    severity,
    evidence: { otherSubmissionId: oid(), otherUserId: oid(), distance: 2, role: "copy" },
  });
}

describe("fraud flag routes", () => {
  it("only admins can read or review", async () => {
    session.current = { user: { id: oid().toString(), role: "buyer" } };
    expect((await GET(new NextRequest("http://x/api"))).status).toBe(401);
    const f = await flag();
    expect((await patch(String(f._id), { status: "dismissed" })).status).toBe(401);
    session.current = null;
    expect((await GET(new NextRequest("http://x/api"))).status).toBe(401);
    // The read-only demo admin can look but not decide.
    session.current = { user: { id: oid().toString(), role: "demo_admin" } };
    expect((await GET(new NextRequest("http://x/api"))).status).toBe(200);
    expect((await patch(String(f._id), { status: "dismissed" })).status).toBe(403);
    expect((await FraudFlag.findById(f._id).lean())?.status).toBe("open");
  });

  it("lists open flags with the high severity first", async () => {
    await flag("medium");
    await flag("high");
    const body = await (await GET(new NextRequest("http://x/api"))).json();
    expect(body.flags.map((f: { severity: string }) => f.severity)).toEqual(["high", "medium"]);
  });

  it("dismisses once, with an audit entry, and refuses a second review", async () => {
    const f = await flag();
    expect((await patch(String(f._id), { status: "bogus" })).status).toBe(400);
    expect((await patch(String(f._id), { status: "dismissed" })).status).toBe(200);
    const stored = await FraudFlag.findById(f._id).lean();
    expect(stored?.status).toBe("dismissed");
    expect(stored?.reviewedBy).toBeTruthy();
    expect(await AuditLog.countDocuments({ action: "fraud_flag.dismissed", targetId: String(f._id) })).toBe(1);

    expect((await patch(String(f._id), { status: "confirmed" })).status).toBe(404);
    expect((await FraudFlag.findById(f._id).lean())?.status).toBe("dismissed");
    expect(await AuditLog.countDocuments({ targetType: "fraud_flag" })).toBe(1);
    expect((await patch("not-an-id", { status: "dismissed" })).status).toBe(404);
    // A dismissed flag leaves the open queue.
    expect((await (await GET(new NextRequest("http://x/api"))).json()).flags).toHaveLength(0);
  });

  it("reviewing the same flag at the same moment records one decision", async () => {
    const f = await flag();
    const results = await Promise.all([patch(String(f._id), { status: "confirmed" }), patch(String(f._id), { status: "dismissed" })]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 404]);
    expect(await AuditLog.countDocuments({ targetType: "fraud_flag" })).toBe(1);
  });
});

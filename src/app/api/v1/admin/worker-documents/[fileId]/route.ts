import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { requireAdmin } from "@/lib/admin-guard";
import { auditContextFrom, recordAudit } from "@/lib/audit";
import { connectDB } from "@/lib/db";
import { readDocument, verifyDocumentSignature } from "@/lib/worker-verification";

/**
 * Streams one ID document or selfie. Only a full admin (never the demo admin), only
 * with an unexpired link signed for that admin, and every view is written to the audit log.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ fileId: string }> }) {
  const guard = await requireAdmin(await auth(), "write");
  if (!guard.ok) return guard.response;
  const { fileId } = await params;
  const q = new URL(req.url).searchParams;
  if (!verifyDocumentSignature(fileId, guard.userId, q.get("exp"), q.get("sig"))) {
    return NextResponse.json({ error: "This link has expired. Open the application again." }, { status: 403 });
  }
  await connectDB();
  const doc = await readDocument(fileId);
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await recordAudit(auditContextFrom(req, { userId: guard.userId, role: guard.role }), {
    action: "worker_document.view",
    targetType: "worker_document",
    targetId: fileId,
    after: { ownerId: doc.userId },
  });
  return new NextResponse(new Uint8Array(doc.data), {
    headers: { "Content-Type": doc.contentType, "Cache-Control": "private, no-store", "Content-Disposition": "inline", "X-Content-Type-Options": "nosniff" },
  });
}

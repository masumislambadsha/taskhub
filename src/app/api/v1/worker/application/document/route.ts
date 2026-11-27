import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { uploadDocument } from "@/lib/worker-verification";

/** Uploads the ID document (image or PDF) or the selfie (image) into private storage. `?kind=id|selfie`, multipart field `file`. */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== "worker") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const kind = new URL(req.url).searchParams.get("kind");
  if (kind !== "id" && kind !== "selfie") return NextResponse.json({ error: "kind must be id or selfie" }, { status: 400 });
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Attach a file" }, { status: 400 });
  await connectDB();
  const res = await uploadDocument(session.user.id, kind, Buffer.from(await file.arrayBuffer()));
  if (res.ok) return NextResponse.json({ ok: true });
  const [status, error] = {
    not_editable: [409, "Your application cannot be edited right now."],
    too_large: [413, "The file is larger than 5 MB."],
    bad_type: [400, "Upload a JPG, PNG or WebP image (a PDF is also fine for the ID document)."],
  }[res.reason] as [number, string];
  return NextResponse.json({ error }, { status });
}

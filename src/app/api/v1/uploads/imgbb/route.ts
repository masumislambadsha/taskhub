import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const UPLOADS_PER_MINUTE = 10;

/** The image type the first bytes of the file show, or `null` if not an image we accept. */
function sniffImageType(b: Uint8Array): string | null {
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (
    b[0] === 0x89 &&
    b[1] === 0x50 &&
    b[2] === 0x4e &&
    b[3] === 0x47 &&
    b[4] === 0x0d &&
    b[5] === 0x0a &&
    b[6] === 0x1a &&
    b[7] === 0x0a
  )
    return "image/png";
  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38)
    return "image/gif";
  if (
    b[0] === 0x52 &&
    b[1] === 0x49 &&
    b[2] === 0x46 &&
    b[3] === 0x46 &&
    b[8] === 0x57 &&
    b[9] === 0x45 &&
    b[10] === 0x42 &&
    b[11] === 0x50
  )
    return "image/webp";
  return null;
}

export async function POST(req: NextRequest) {
  const session = await auth();
  const user = session?.user as { id?: string; role?: string } | undefined;
  if (!user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (user.role === "demo_admin") {
    return NextResponse.json(
      { error: "Demo admin is read-only" },
      { status: 403 },
    );
  }

  const limit = rateLimit(`imgbb:${user.id}`, UPLOADS_PER_MINUTE, 60_000);
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Too many uploads. Try again shortly." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }

  const apiKey = process.env.IMGBB_API_KEY;
  if (!apiKey) {
    logger.error("IMGBB_API_KEY is not set");
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }

  let image: FormDataEntryValue | null;
  try {
    image = (await req.formData()).get("image");
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }
  if (!(image instanceof File)) {
    return NextResponse.json({ error: "No image" }, { status: 400 });
  }
  if (image.size === 0 || image.size > MAX_IMAGE_BYTES) {
    return NextResponse.json(
      { error: "Image must be under 5MB" },
      { status: 413 },
    );
  }
  const bytes = new Uint8Array(await image.slice(0, 12).arrayBuffer());
  if (!sniffImageType(bytes)) {
    return NextResponse.json(
      { error: "Only JPEG, PNG, GIF or WebP images are allowed" },
      { status: 415 },
    );
  }

  // The key goes in the request body, not the URL, so it never shows up in logs.
  const body = new FormData();
  body.append("key", apiKey);
  body.append("image", image);

  let res: Response;
  try {
    res = await fetch("https://api.imgbb.com/1/upload", {
      method: "POST",
      body,
    });
  } catch (err) {
    logger.error({ err }, "imgbb upload request failed");
    return NextResponse.json({ error: "Upload failed" }, { status: 502 });
  }
  if (!res.ok) {
    return NextResponse.json({ error: "Upload failed" }, { status: 502 });
  }

  const data = await res.json().catch(() => null);
  const url = data?.data?.url;
  if (typeof url !== "string") {
    return NextResponse.json({ error: "Upload failed" }, { status: 502 });
  }
  return NextResponse.json({ url });
}

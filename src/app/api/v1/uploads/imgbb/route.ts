import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const image = formData.get("image") as File;
  if (!image) return NextResponse.json({ error: "No image" }, { status: 400 });

  const body = new FormData();
  body.append("image", image);

  const res = await fetch(
    `https://api.imgbb.com/1/upload?key=${process.env.IMGBB_API_KEY}`,
    { method: "POST", body },
  );

  if (!res.ok)
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });

  const data = await res.json();
  return NextResponse.json({ url: data.data.url });
}

import { NextResponse } from "next/server";

export async function POST() {
  const url = `${process.env.BKASH_BASE_URL}/tokenized/checkout/token/grant`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      username: process.env.BKASH_USERNAME!,
      password: process.env.BKASH_PASSWORD!,
    },
    body: JSON.stringify({
      app_key: process.env.BKASH_APP_KEY,
      app_secret: process.env.BKASH_APP_SECRET,
    }),
  });

  const data = await response.json();

  if (!response.ok || !data.id_token) {
    return NextResponse.json(
      { error: data.statusMessage || "Authentication failed" },
      { status: 500 },
    );
  }

  return NextResponse.json(data);
}

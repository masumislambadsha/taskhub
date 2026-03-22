import { NextResponse } from "next/server";
import { COIN_PACKAGES } from "@/lib/constants";

export async function GET() {
  return NextResponse.json(COIN_PACKAGES);
}

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { requireAdmin } from "@/lib/roles";
import { connectDB } from "@/lib/db";
import PaymentEvent from "@/models/PaymentEvent";

const PROVIDERS = ["stripe", "sslcommerz", "bkash"];

export async function GET(req: NextRequest) {
  const guard = requireAdmin(await auth(), "read");
  if (!guard.ok) return guard.response;

  await connectDB();
  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1") || 1);
  const limit = 15;

  const query: Record<string, unknown> = {};
  const provider = searchParams.get("provider");
  if (provider && PROVIDERS.includes(provider)) query.provider = provider;
  const ok = searchParams.get("ok");
  if (ok === "true" || ok === "false") query.ok = ok === "true";

  const [events, total] = await Promise.all([
    PaymentEvent.find(query)
      .sort("-receivedAt")
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    PaymentEvent.countDocuments(query),
  ]);

  return NextResponse.json({
    events,
    total,
    page,
    pages: Math.ceil(total / limit),
  });
}

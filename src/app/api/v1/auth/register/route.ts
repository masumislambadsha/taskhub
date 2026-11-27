import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/db";
import User from "@/models/User";
import { registerSchema } from "@/lib/validators/auth";
import {
  createUserWithBonus,
  isDuplicateKeyError,
} from "@/lib/ledger/flows/users";
import { WORKER_INITIAL_COINS, BUYER_INITIAL_COINS } from "@/lib/constants";
import { clientIp, consume, rateLimitedResponse } from "@/lib/ratelimit";
import { evaluateLinks, normalizeEmail, recordSighting } from "@/lib/fraud/signals";

export async function POST(req: NextRequest) {
  // Per IP and device: a shared carrier IP is not blocked by one person's signups,
  // and one device cannot make accounts in bulk.
  const device = (req.headers.get("x-device-id") ?? "").slice(0, 64) || "none";
  const limit = await consume("signup", `${clientIp(req.headers)}:${device}`);
  if (!limit.ok) return rateLimitedResponse(limit.retryAfterSeconds);

  const body = await req.json();
  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 },
    );
  }

  await connectDB();
  const { name, email, password, role, photoUrl } = parsed.data;

  const existing = await User.findOne({ email });
  if (existing) {
    return NextResponse.json(
      { error: "Email already registered" },
      { status: 409 },
    );
  }

  // One inbox, one account: a Gmail address with dots or a +tag is the same inbox.
  const emailNormalized = normalizeEmail(email);
  if (await User.exists({ emailNormalized })) {
    return NextResponse.json({ error: "Email already registered" }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const coins = role === "buyer" ? BUYER_INITIAL_COINS : WORKER_INITIAL_COINS;

  let userId: string;
  try {
    ({ userId } = await createUserWithBonus({
      data: { name, email, emailNormalized, passwordHash, photoUrl, role },
      bonus: coins,
    }));
  } catch (err) {
    // Two sign-ups with the same email at once: the unique index picks one.
    if (isDuplicateKeyError(err)) {
      return NextResponse.json(
        { error: "Email already registered" },
        { status: 409 },
      );
    }
    throw err;
  }
  await recordSighting(userId, req.headers, "register");
  await evaluateLinks(userId);
  return NextResponse.json({ ok: true }, { status: 201 });
}

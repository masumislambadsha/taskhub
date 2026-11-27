import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/db";
import User from "@/models/User";
import { clientIp, consume, resetLimit } from "@/lib/ratelimit";
import { evaluateLinks, recordSighting } from "@/lib/fraud/signals";

/** A blocked sign-in. `auth.ts` turns it into the Auth.js error whose code carries the wait. */
export class LoginRateLimited extends Error {
  constructor(public retryAfterSeconds: number) {
    super("Too many sign-in attempts");
  }
}

export interface LoginUser {
  id: string;
  name: string;
  email: string;
  image?: string;
  role: string;
  coins: number;
}

/**
 * Checks an email and password. Every attempt counts against the account (5 in
 * 15 minutes) and against the IP (30 in 15 minutes), whether or not the account
 * exists, so the limit does not reveal which emails are registered. A correct
 * password clears the account's count: someone who mistyped a few times is not
 * locked out after getting in.
 *
 * Returns the user, or null for a wrong email or password. Throws
 * `LoginRateLimited` when blocked, and an error for a suspended account.
 */
export async function authorizeCredentials(
  credentials: Partial<Record<"email" | "password", unknown>> | undefined,
  request?: { headers?: Headers },
): Promise<LoginUser | null> {
  if (!credentials?.email || !credentials?.password) return null;

  const email = String(credentials.email).toLowerCase();
  const ip = request?.headers ? clientIp(request.headers) : "unknown";
  const [byAccount, byIp] = await Promise.all([consume("login_account", email), consume("login_ip", ip)]);
  if (!byAccount.ok || !byIp.ok) {
    throw new LoginRateLimited(Math.max(byAccount.retryAfterSeconds, byIp.retryAfterSeconds));
  }

  await connectDB();
  const user = await User.findOne({ email: credentials.email });
  if (!user || !user.passwordHash) return null;
  if (user.status === "suspended") throw new Error("Account suspended");
  const valid = await bcrypt.compare(String(credentials.password), user.passwordHash);
  if (!valid) return null;

  await resetLimit("login_account", email);
  if (request?.headers) {
    await recordSighting(user._id.toString(), request.headers, "login");
    await evaluateLinks(user._id.toString());
  }
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    image: user.photoUrl,
    role: user.role,
    coins: user.coins,
  };
}

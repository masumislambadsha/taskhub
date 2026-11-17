import mongoose from "mongoose";
import type { JWT } from "next-auth/jwt";
import { connectDB } from "./db";
import User from "@/models/User";

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  coins: number;
  image?: string;
};

type LeanUser = {
  _id: mongoose.Types.ObjectId;
  name: string;
  email: string;
  role: string;
  coins: number;
  photoUrl?: string;
  status?: string;
};

async function findActiveUser(id: unknown): Promise<LeanUser | null> {
  if (typeof id !== "string" || !mongoose.isValidObjectId(id)) return null;
  await connectDB();
  const user = (await User.findById(id).lean()) as LeanUser | null;
  if (!user || user.status === "suspended") return null;
  return user;
}

/**
 * Refreshes the token from the database. The database is the only source of
 * role, coins, name and picture; whatever the client sends through
 * `useSession().update(...)` is ignored. Returns `null` when the user no longer
 * exists or is suspended: Auth.js clears the session cookie when the `jwt`
 * callback returns `null`.
 */
export async function refreshToken(
  token: JWT,
  // The jwt callback's trigger and client payload. Deliberately unused.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _event?: { trigger?: string; session?: unknown },
): Promise<JWT | null> {
  const user = await findActiveUser(token.id);
  if (!user) return null;
  token.role = user.role;
  token.coins = user.coins;
  token.name = user.name;
  token.picture = user.photoUrl;
  return token;
}

/** The user a Bearer token stands for, or `null` if deleted or suspended. */
export async function resolveBearerUser(
  decoded: { id?: unknown } | null | undefined,
): Promise<SessionUser | null> {
  const user = await findActiveUser(decoded?.id);
  if (!user) return null;
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    role: user.role,
    coins: user.coins,
    image: user.photoUrl,
  };
}

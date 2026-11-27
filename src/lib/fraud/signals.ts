import { createHmac } from "node:crypto";
import { Types } from "mongoose";
import { clientIp } from "@/lib/audit";
import { logger } from "@/lib/logger";
import DeviceSighting from "@/models/DeviceSighting";
import FraudFlag from "@/models/FraudFlag";
import Submission from "@/models/Submission";
import User from "@/models/User";

const log = logger.child({ module: "fraud-signals" });

/** The same device on this many accounts is a strong signal. */
export const SHARED_DEVICE_MIN_ACCOUNTS = 3;

/**
 * One inbox, one account: lower case, and for Gmail remove the dots and
 * anything after a "+" in the local part (john.doe+a@gmail.com is john doe's inbox).
 */
export function normalizeEmail(email: string): string {
  const [localRaw, domainRaw] = email.trim().toLowerCase().split("@");
  if (!domainRaw) return email.trim().toLowerCase();
  let local = localRaw;
  let domain = domainRaw;
  if (domain === "googlemail.com") domain = "gmail.com";
  if (domain === "gmail.com") local = local.split("+")[0].replace(/\./g, "");
  else local = local.split("+")[0];
  return `${local}@${domain}`;
}

function ipSalt(): string {
  const salt = process.env.IP_HASH_SECRET || process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  if (!salt) {
    if (process.env.NODE_ENV === "production") throw new Error("IP_HASH_SECRET (or AUTH_SECRET) is required");
    return "dev-only-ip-salt";
  }
  return salt;
}

export function hashIp(ip: string): string {
  return createHmac("sha256", ipSalt()).update(ip).digest("hex");
}

/** The device ID the browser sent (header, or the cookie), cleaned up. */
export function deviceIdFrom(headers: Headers): string | null {
  const fromHeader = headers.get("x-device-id")?.trim();
  const fromCookie = /(?:^|;\s*)th_did=([^;]+)/.exec(headers.get("cookie") ?? "")?.[1];
  const id = (fromHeader && fromHeader !== "none" ? fromHeader : fromCookie) ?? "";
  return /^[A-Za-z0-9-]{8,64}$/.test(id) ? id : null;
}

export type SightingContext = "register" | "login" | "submit" | "withdraw";

/** Remembers that this user was seen on this device (and from this IP, hashed). Never throws. */
export async function recordSighting(userId: string, headers: Headers, context: SightingContext): Promise<void> {
  try {
    const deviceId = deviceIdFrom(headers);
    if (!deviceId) return;
    const now = new Date();
    await DeviceSighting.updateOne(
      { userId: new Types.ObjectId(userId), deviceId },
      {
        $set: {
          lastSeen: now,
          ipHash: hashIp(clientIp(headers) ?? "unknown"),
          userAgent: headers.get("user-agent")?.slice(0, 300) || undefined,
          context,
        },
        $setOnInsert: { firstSeen: now },
      },
      { upsert: true },
    );
  } catch (err) {
    log.warn({ err, userId }, "could not record device sighting");
  }
}

async function flagPair(userId: Types.ObjectId, otherUserId: Types.ObjectId, type: "shared_device" | "self_dealing", severity: "medium" | "high", accounts: number) {
  const res = await FraudFlag.updateOne(
    { userId, type, "evidence.otherUserId": otherUserId, accountLevel: true },
    { $setOnInsert: { severity, status: "open", createdAt: new Date(), evidence: { otherUserId, accounts } } },
    { upsert: true },
  );
  return res.upsertedCount ?? 0;
}

/**
 * Looks at the user's devices and flags accounts that share them.
 *
 * - The same device on 3 or more accounts: high, one flag per other account.
 * - A worker and a buyer on the same device where the worker did work for that buyer
 *   (self-dealing): high.
 * - The same IP alone is not a rule (carriers and offices share IPs).
 * - The same payout number on 2 or more accounts is handled where withdrawals are
 *   requested (withdrawal-risk.ts).
 *
 * Flags are unique per pair, so a dismissed pair never fires again. Never throws.
 */
export async function evaluateLinks(userId: string): Promise<{ created: number }> {
  try {
    const me = new Types.ObjectId(userId);
    const mine = await DeviceSighting.find({ userId: me }).select("deviceId").lean();
    let created = 0;
    for (const { deviceId } of mine) {
      const sharing = await DeviceSighting.find({ deviceId }).select("userId").lean();
      const others = sharing.map((s) => s.userId).filter((id) => !id.equals(me));
      if (others.length === 0) continue;
      const accounts = others.length + 1;
      if (accounts >= SHARED_DEVICE_MIN_ACCOUNTS) {
        for (const other of others) created += await flagPair(me, other, "shared_device", "high", accounts);
      }
      // Self-dealing: a worker's submissions on a task of a buyer who uses the same device.
      const people = await User.find({ _id: { $in: [me, ...others] } }).select("role").lean();
      const role = new Map(people.map((p) => [String(p._id), p.role]));
      for (const other of others) {
        const [a, b] = [role.get(String(me)), role.get(String(other))];
        const workerId = a === "worker" && b === "buyer" ? me : a === "buyer" && b === "worker" ? other : null;
        const buyerId = workerId === me ? other : me;
        if (!workerId) continue;
        const dealt = await Submission.exists({ workerId, taskBuyerId: buyerId });
        if (dealt) created += await flagPair(me, other, "self_dealing", "high", 2);
      }
    }
    if (created) log.info({ userId, created }, "linked accounts flagged");
    return { created };
  } catch (err) {
    log.warn({ err, userId }, "could not evaluate linked accounts");
    return { created: 0 };
  }
}

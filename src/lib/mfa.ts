import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import QRCode from "qrcode";
import MfaCredential, { type IMfaCredentialDoc } from "@/models/MfaCredential";
import MfaSession from "@/models/MfaSession";
import { decryptSecret, encryptSecret } from "@/lib/mfa-crypto";
import { currentStep, generateTotpSecret, otpauthUri, verifyTotp } from "@/lib/totp";

export const STEP_UP_WINDOW_MS = 15 * 60 * 1000;
export const MAX_FAILED_ATTEMPTS = 5;
export const FAIL_WINDOW_MS = 15 * 60 * 1000;
export const LOCK_MS = 15 * 60 * 1000;
export const RECOVERY_CODE_COUNT = 10;
const ISSUER = "TaskHub";

/** Two-factor is required for admins unless MFA_ENFORCED is explicitly "false" (tests and local development). */
export function mfaEnforced(): boolean {
  return process.env.MFA_ENFORCED !== "false";
}

/** Only the real admin role needs a second factor; the read-only demo admin has public credentials and cannot change anything. */
export function mfaRequiredFor(role: string | null | undefined): boolean {
  return role === "admin" && mfaEnforced();
}

export interface MfaState {
  enrolled: boolean;
  verified: boolean;
  stepUpFresh: boolean;
}

export async function getMfaState(
  userId: string,
  sid: string | undefined,
  now: number = Date.now(),
): Promise<MfaState> {
  const [cred, session] = await Promise.all([
    MfaCredential.findOne({ userId, enabledAt: { $exists: true } }).select("_id").lean(),
    sid ? MfaSession.findOne({ userId, sid }).lean() : null,
  ]);
  return {
    enrolled: Boolean(cred),
    verified: Boolean(session),
    stepUpFresh: Boolean(session && session.stepUpAt.getTime() > now - STEP_UP_WINDOW_MS),
  };
}

/** Starts (or restarts) enrollment: a new secret that only counts once a code from it is confirmed. */
export async function beginEnrollment(
  userId: string,
  account: string,
): Promise<{ ok: true; manualKey: string; otpauthUri: string; qrDataUrl: string } | { ok: false; reason: "already_enrolled" }> {
  const existing = await MfaCredential.findOne({ userId }).lean();
  if (existing?.enabledAt) return { ok: false, reason: "already_enrolled" };

  const secret = generateTotpSecret();
  await MfaCredential.updateOne(
    { userId },
    { $set: { pendingSecret: encryptSecret(secret) } },
    { upsert: true },
  );
  const uri = otpauthUri({ secret, account, issuer: ISSUER });
  return { ok: true, manualKey: secret, otpauthUri: uri, qrDataUrl: await QRCode.toDataURL(uri) };
}

/** Ten one-time codes, shown once. Only their bcrypt hashes are stored. */
export function newRecoveryCodes(): string[] {
  return Array.from({ length: RECOVERY_CODE_COUNT }, () => {
    const raw = randomBytes(5).toString("hex"); // 10 hex characters
    return `${raw.slice(0, 5)}-${raw.slice(5)}`;
  });
}

const isRecoveryCode = (input: string) => /^[0-9a-f]{5}-?[0-9a-f]{5}$/i.test(input.trim());
const normalizeRecovery = (input: string) => {
  const c = input.trim().toLowerCase().replace("-", "");
  return `${c.slice(0, 5)}-${c.slice(5)}`;
};

/**
 * Confirms enrollment with a code from the new secret. On success the secret
 * becomes active, the recovery codes are created, and this login session counts
 * as verified. Returns the recovery codes in plain text, once.
 */
export async function confirmEnrollment(
  userId: string,
  sid: string | undefined,
  code: string,
  now: number = Date.now(),
): Promise<{ ok: true; recoveryCodes: string[] } | { ok: false; reason: "no_setup" | "invalid" | "already_enrolled" }> {
  const cred = await MfaCredential.findOne({ userId }).lean();
  if (cred?.enabledAt) return { ok: false, reason: "already_enrolled" };
  if (!cred?.pendingSecret) return { ok: false, reason: "no_setup" };

  const step = verifyTotp(decryptSecret(cred.pendingSecret), code.trim(), now);
  if (step === null) return { ok: false, reason: "invalid" };

  const recoveryCodes = newRecoveryCodes();
  const hashes = await Promise.all(recoveryCodes.map((c) => bcrypt.hash(c.replace("-", ""), 10)));
  const res = await MfaCredential.updateOne(
    { userId, enabledAt: { $exists: false } },
    {
      $set: {
        secret: cred.pendingSecret,
        enabledAt: new Date(now),
        lastUsedStep: step,
        failedAttempts: 0,
        recoveryCodes: hashes.map((hash) => ({ hash })),
      },
      $unset: { pendingSecret: "", failWindowStart: "", lockedUntil: "" },
    },
  );
  if (res.modifiedCount === 0) return { ok: false, reason: "already_enrolled" };
  await markSessionVerified(userId, sid, now);
  return { ok: true, recoveryCodes };
}

export async function markSessionVerified(userId: string, sid: string | undefined, now: number): Promise<void> {
  if (!sid) return;
  await MfaSession.updateOne(
    { userId, sid },
    { $set: { verifiedAt: new Date(now), stepUpAt: new Date(now) }, $setOnInsert: { createdAt: new Date(now) } },
    { upsert: true },
  );
}

export type VerifyResult =
  | { ok: true; usedRecoveryCode: boolean; recoveryCodesLeft: number }
  | { ok: false; reason: "invalid" | "locked" | "not_enrolled"; retryAfterSeconds?: number };

/**
 * Checks an authenticator code or a recovery code for this admin, and on
 * success marks the login session verified and stepped up.
 *
 * - A code works once: the accepted time step is stored with a conditional
 *   update, so two requests carrying the same code cannot both succeed.
 * - Five wrong codes within 15 minutes lock verification for 15 minutes.
 * - A recovery code is spent the moment it is accepted.
 */
export async function verifyMfa(
  userId: string,
  sid: string | undefined,
  input: string,
  now: number = Date.now(),
): Promise<VerifyResult> {
  const cred = await MfaCredential.findOne({ userId, enabledAt: { $exists: true } }).lean();
  if (!cred?.secret) return { ok: false, reason: "not_enrolled" };

  if (cred.lockedUntil && cred.lockedUntil.getTime() > now) {
    return { ok: false, reason: "locked", retryAfterSeconds: Math.ceil((cred.lockedUntil.getTime() - now) / 1000) };
  }

  const text = input.trim();
  let usedRecovery = false;
  let accepted = false;

  if (/^\d{6}$/.test(text)) {
    const step = verifyTotp(decryptSecret(cred.secret), text, now);
    if (step !== null) {
      // Atomic: only the first request to present this step wins.
      const res = await MfaCredential.updateOne(
        { userId, lastUsedStep: { $lt: step } },
        { $set: { lastUsedStep: step } },
      );
      accepted = res.modifiedCount === 1;
    }
  } else if (isRecoveryCode(text)) {
    const plain = normalizeRecovery(text).replace("-", "");
    for (let i = 0; i < cred.recoveryCodes.length; i++) {
      const rc = cred.recoveryCodes[i];
      if (rc.usedAt || !(await bcrypt.compare(plain, rc.hash))) continue;
      const res = await MfaCredential.updateOne(
        { userId, [`recoveryCodes.${i}.usedAt`]: { $exists: false } },
        { $set: { [`recoveryCodes.${i}.usedAt`]: new Date(now) } },
      );
      accepted = res.modifiedCount === 1;
      usedRecovery = accepted;
      break;
    }
  }

  if (!accepted) return recordFailure(userId, now);

  await MfaCredential.updateOne(
    { userId },
    { $set: { failedAttempts: 0 }, $unset: { failWindowStart: "", lockedUntil: "" } },
  );
  await markSessionVerified(userId, sid, now);
  const fresh = await MfaCredential.findOne({ userId }).select("recoveryCodes").lean();
  return {
    ok: true,
    usedRecoveryCode: usedRecovery,
    recoveryCodesLeft: (fresh?.recoveryCodes ?? []).filter((c) => !c.usedAt).length,
  };
}

async function recordFailure(userId: string, now: number): Promise<VerifyResult> {
  const cutoff = new Date(now - FAIL_WINDOW_MS);
  const nowDate = new Date(now);
  const stale = { $or: [{ $eq: [{ $ifNull: ["$failWindowStart", null] }, null] }, { $lt: ["$failWindowStart", cutoff] }] };
  // One atomic pipeline update: start a new window or count within the current one.
  const after = (await MfaCredential.findOneAndUpdate(
    { userId },
    [
      {
        $set: {
          failedAttempts: { $cond: [stale, 1, { $add: ["$failedAttempts", 1] }] },
          failWindowStart: { $cond: [stale, nowDate, "$failWindowStart"] },
        },
      },
    ],
    { returnDocument: "after", updatePipeline: true },
  ).lean()) as IMfaCredentialDoc | null;

  if (after && after.failedAttempts >= MAX_FAILED_ATTEMPTS) {
    const lockedUntil = new Date(now + LOCK_MS);
    await MfaCredential.updateOne({ userId }, { $set: { lockedUntil, failedAttempts: 0 }, $unset: { failWindowStart: "" } });
    return { ok: false, reason: "locked", retryAfterSeconds: Math.ceil(LOCK_MS / 1000) };
  }
  return { ok: false, reason: "invalid" };
}

/** Removes a user's second factor and ends every verified session of theirs, so they must enroll again. */
export async function resetMfa(userId: string): Promise<boolean> {
  const [cred] = await Promise.all([
    MfaCredential.deleteOne({ userId }),
    MfaSession.deleteMany({ userId }),
  ]);
  return cred.deletedCount === 1;
}

export { currentStep };

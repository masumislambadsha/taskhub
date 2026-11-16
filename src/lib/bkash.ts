import { connectDB } from "@/lib/db";
import { logger } from "@/lib/logger";
import BkashToken from "@/models/BkashToken";

// We ask bKash for a new grant token once the one we hold is 50 minutes old,
// counted from when we received it (not from `expires_in`).
export const BKASH_TOKEN_TTL_MS = 50 * 60 * 1000;
const TOKEN_ID = "grant";

let memory: { idToken: string; expiresAt: number } | null = null;
let inflight: Promise<string> | null = null;
// Bumped by invalidateBkashToken so a lookup that started earlier can't put
// the rejected token back.
let generation = 0;

async function requestGrant(): Promise<string> {
  const res = await fetch(
    `${process.env.BKASH_BASE_URL}/tokenized/checkout/token/grant`,
    {
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
    },
  );

  const data = await res.json();
  if (!data.id_token)
    throw new Error(data.statusMessage || "bKash auth failed");
  return data.id_token;
}

// The shared cache must never block a payment, so DB errors are only logged.
async function readStoredToken(): Promise<{ idToken: string; expiresAt: number } | null> {
  try {
    await connectDB();
    const doc = await BkashToken.findById(TOKEN_ID).lean();
    if (!doc || doc.expiresAt.getTime() <= Date.now()) return null;
    return { idToken: doc.idToken, expiresAt: doc.expiresAt.getTime() };
  } catch (err) {
    logger.warn({ err }, "bKash token cache read failed");
    return null;
  }
}

async function storeToken(idToken: string, expiresAt: number) {
  try {
    await connectDB();
    // Two instances may race here; both tokens are valid, so last write wins.
    await BkashToken.findByIdAndUpdate(
      TOKEN_ID,
      { idToken, expiresAt: new Date(expiresAt) },
      { upsert: true },
    );
  } catch (err) {
    logger.warn({ err }, "bKash token cache write failed");
  }
}

async function loadToken(): Promise<string> {
  const gen = generation;
  let token = await readStoredToken();
  if (!token) {
    const idToken = await requestGrant();
    token = { idToken, expiresAt: Date.now() + BKASH_TOKEN_TTL_MS };
    if (gen === generation) await storeToken(token.idToken, token.expiresAt);
  }
  if (gen === generation) memory = token;
  return token.idToken;
}

export async function getBkashToken(): Promise<string> {
  if (memory && memory.expiresAt > Date.now()) return memory.idToken;
  // Callers that arrive during a lookup share it.
  if (!inflight) {
    const p: Promise<string> = loadToken().finally(() => {
      if (inflight === p) inflight = null;
    });
    inflight = p;
  }
  return inflight;
}

// Drops the cached token from memory and the shared store (e.g. bKash rejected it).
export async function invalidateBkashToken() {
  generation += 1;
  memory = null;
  inflight = null;
  try {
    await connectDB();
    await BkashToken.deleteOne({ _id: TOKEN_ID });
  } catch (err) {
    logger.warn({ err }, "bKash token cache clear failed");
  }
}

// POSTs to bKash with the cached token. A 401 means the token was rejected and
// the request was not processed, so one retry with a fresh token is safe.
async function postWithToken(path: string, body: unknown): Promise<Response> {
  const send = async () =>
    fetch(`${process.env.BKASH_BASE_URL}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        authorization: await getBkashToken(),
        "x-app-key": process.env.BKASH_APP_KEY!,
      },
      body: JSON.stringify(body),
    });

  const res = await send();
  if (res.status !== 401) return res;
  await invalidateBkashToken();
  return send();
}

export async function createBkashPayment(
  amountBDT: string,
  paymentId: string,
): Promise<string> {
  const res = await postWithToken("/tokenized/checkout/create", {
    mode: "0011",
    payerReference: paymentId,
    callbackURL: `${process.env.NEXTAUTH_URL}/api/bkash/callback`,
    amount: amountBDT,
    currency: "BDT",
    intent: "sale",
    merchantInvoiceNumber: paymentId,
  });

  const data = await res.json();
  if (!data.bkashURL)
    throw new Error(data.statusMessage || "bKash create failed");
  return data.bkashURL;
}

export async function executeBkashPayment(paymentID: string) {
  const res = await postWithToken("/tokenized/checkout/execute", { paymentID });
  return res.json();
}

import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import IdempotencyKey from "@/models/IdempotencyKey";
import { isDuplicateKeyError } from "@/lib/ledger/flows/users";

export const IDEMPOTENCY_HEADER = "Idempotency-Key";

/** A request that has held a key this long without finishing is treated as crashed. */
export const STALE_LOCK_MS = 60_000;

const KEY_PATTERN = /^[A-Za-z0-9_:.-]{8,128}$/;

function sha256(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

/**
 * Makes a state-changing route safe to retry.
 *
 * The client sends an `Idempotency-Key` header (a UUID made when the form
 * opens, reused on retries, replaced after success). Call this inside the
 * route after authentication, with the handler that does the work:
 *
 * - No header: the handler just runs, as before.
 * - First time a key is seen: the key is claimed atomically (unique index on
 *   `userId + key`), the handler runs, and a 2xx response is stored.
 * - Same key and same request again: the stored response is returned with
 *   `Idempotent-Replay: true`, and the handler does not run.
 * - Same key, different request (method, path or body): 422.
 * - Same key while the first request is still running: 409.
 * - A non-2xx response or a thrown error releases the key, so the client can
 *   fix the problem and retry with the same key. Handlers only change data on
 *   their success path, so nothing is lost by releasing.
 * - A request that held the key for over a minute without finishing (a crash)
 *   can be taken over by a retry.
 */
export async function withIdempotency(
  req: NextRequest,
  userId: string,
  handler: () => Promise<Response>,
): Promise<Response> {
  const key = req.headers.get(IDEMPOTENCY_HEADER);
  if (key === null) return handler();
  if (!KEY_PATTERN.test(key)) {
    return NextResponse.json(
      { error: "Invalid Idempotency-Key header" },
      { status: 400 },
    );
  }

  await connectDB();

  // Clone so the handler can still read the body.
  const body = await req.clone().text();
  const requestHash = sha256(
    `${req.method}\n${new URL(req.url).pathname}\n${body}`,
  );

  const claim = async (): Promise<Response | "claimed"> => {
    const now = new Date();
    try {
      await IdempotencyKey.create({
        userId,
        key,
        requestHash,
        status: "in_progress",
        lockedAt: now,
      });
      return "claimed";
    } catch (err) {
      if (!isDuplicateKeyError(err)) throw err;
    }

    const existing = await IdempotencyKey.findOne({ userId, key }).lean();
    // Expired between the failed insert and this read: try again.
    if (!existing) return claim();

    if (existing.requestHash !== requestHash) {
      return NextResponse.json(
        { error: "This Idempotency-Key was already used for a different request" },
        { status: 422 },
      );
    }

    if (existing.status === "completed") {
      return new Response(existing.responseBody ?? "", {
        status: existing.responseStatus ?? 200,
        headers: {
          "content-type": existing.responseContentType ?? "application/json",
          "Idempotent-Replay": "true",
        },
      });
    }

    // Still in progress. Take over only if the holder looks crashed.
    const took = await IdempotencyKey.findOneAndUpdate(
      {
        userId,
        key,
        status: "in_progress",
        lockedAt: { $lt: new Date(now.getTime() - STALE_LOCK_MS) },
      },
      { $set: { lockedAt: now } },
    );
    if (took) return "claimed";

    return NextResponse.json(
      { error: "This request is already being processed" },
      { status: 409 },
    );
  };

  const claimed = await claim();
  if (claimed !== "claimed") return claimed;

  let res: Response;
  try {
    res = await handler();
  } catch (err) {
    await IdempotencyKey.deleteOne({ userId, key, requestHash }).catch(() => {});
    throw err;
  }

  if (res.status >= 200 && res.status < 300) {
    await IdempotencyKey.updateOne(
      { userId, key },
      {
        $set: {
          status: "completed",
          responseStatus: res.status,
          responseBody: await res.clone().text(),
          responseContentType: res.headers.get("content-type") ?? "application/json",
        },
      },
    );
  } else {
    await IdempotencyKey.deleteOne({ userId, key, requestHash }).catch(() => {});
  }
  return res;
}

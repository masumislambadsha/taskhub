import type { NextRequest } from "next/server";
import { logger } from "@/lib/logger";
import { observeRequest } from "@/lib/metrics";

type RouteHandler<C> = (
  req: NextRequest,
  context: C,
) => Response | Promise<Response>;

/**
 * Wraps an App Router route handler with one structured log line per request.
 *
 * - Request ID comes from the `x-request-id` header (set by Nginx), or is
 *   generated. It is echoed back in the response `x-request-id` header.
 * - Logs `status` and `durationMs` on completion. Thrown errors are logged
 *   with the error serializer and rethrown unchanged.
 * - Request and webhook bodies, emails and passwords are never logged.
 */
export function withRequestLogging<C = unknown>(
  route: string,
  handler: RouteHandler<C>,
): (req: NextRequest, context: C) => Promise<Response> {
  return async (req, context) => {
    const requestId = req.headers.get("x-request-id") || crypto.randomUUID();
    const log = logger.child({ requestId, method: req.method, route });
    const start = Date.now();

    try {
      const res = await handler(req, context);
      try {
        res.headers.set("x-request-id", requestId);
      } catch {
        // Some Response objects have immutable headers; the log still has the ID.
      }
      observeRequest(route, req.method, res.status, (Date.now() - start) / 1000);
      log.info(
        { status: res.status, durationMs: Date.now() - start },
        "request completed",
      );
      return res;
    } catch (err) {
      observeRequest(route, req.method, 500, (Date.now() - start) / 1000);
      log.error(
        { err, durationMs: Date.now() - start },
        "request failed with unhandled error",
      );
      throw err;
    }
  };
}

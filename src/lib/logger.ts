import pino from "pino";

/**
 * Structured JSON logger. Logs go to stdout; no transports or worker threads
 * are used, so it bundles cleanly in Next.js. For readable local output run
 * `npm run dev:pretty`.
 */

// Standard error serializer, minus the request/response objects that HTTP
// client errors (axios) carry, which can hold auth headers and payloads.
function serializeError(err: unknown) {
  const out = pino.stdSerializers.err(err as Error) as unknown as Record<
    string,
    unknown
  >;
  delete out.config;
  delete out.request;
  delete out.response;
  return out;
}

export function createLogger(service: string) {
  return pino({
    level: process.env.LOG_LEVEL || "info",
    base: { service },
    timestamp: pino.stdTimeFunctions.isoTime,
    serializers: { err: serializeError },
    formatters: {
      level: (label) => ({ level: label }),
    },
    redact: {
      paths: [
        // Headers
        "authorization",
        "cookie",
        "headers.authorization",
        "headers.cookie",
        'headers["set-cookie"]',
        "*.headers.authorization",
        "*.headers.cookie",
        '*.headers["set-cookie"]',
        // Sensitive fields at the top level and up to three levels deep
        "password",
        "token",
        "otp",
        "secret",
        "*.password",
        "*.token",
        "*.otp",
        "*.secret",
        "*.*.password",
        "*.*.token",
        "*.*.otp",
        "*.*.secret",
        "*.*.*.password",
        "*.*.*.token",
        "*.*.*.otp",
        "*.*.*.secret",
      ],
      censor: "[Redacted]",
    },
  });
}

// LOG_SERVICE is set by the worker bundle (see build:worker) so shared code
// logs under the right service name.
export const logger = createLogger(process.env.LOG_SERVICE || "web");

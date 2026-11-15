import * as Sentry from "@sentry/nextjs";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

// Reports errors from Server Components, route handlers and middleware.
// Does nothing when Sentry was not initialised (no DSN).
export const onRequestError = Sentry.captureRequestError;

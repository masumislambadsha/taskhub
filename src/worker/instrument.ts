import * as Sentry from "@sentry/node";
import { parseSampleRate, sentryDataCollection } from "@/lib/sentry-options";

// Imported first by src/worker/index.ts. Sentry is disabled unless SENTRY_DSN
// is set.
const dsn = process.env.SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    dataCollection: sentryDataCollection,
    tracesSampleRate: parseSampleRate(process.env.SENTRY_TRACES_SAMPLE_RATE),
    environment: process.env.SENTRY_ENVIRONMENT || undefined,
    release: process.env.GIT_SHA || undefined,
    initialScope: { tags: { service: "worker" } },
  });
}

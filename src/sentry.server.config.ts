import * as Sentry from "@sentry/nextjs";
import { parseSampleRate, sentryDataCollection } from "@/lib/sentry-options";

// Sentry is fully disabled unless SENTRY_DSN is set.
const dsn = process.env.SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    dataCollection: sentryDataCollection,
    tracesSampleRate: parseSampleRate(process.env.SENTRY_TRACES_SAMPLE_RATE),
    environment: process.env.SENTRY_ENVIRONMENT || undefined,
    release: process.env.GIT_SHA || process.env.VERCEL_GIT_COMMIT_SHA || undefined,
  });
}

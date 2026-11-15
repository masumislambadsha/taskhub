import * as Sentry from "@sentry/nextjs";
import { parseSampleRate, sentryDataCollection } from "@/lib/sentry-options";

// Sentry is fully disabled in the browser unless NEXT_PUBLIC_SENTRY_DSN is
// set at build time. The NEXT_PUBLIC_SENTRY_ENVIRONMENT, _TRACES_SAMPLE_RATE
// and NEXT_PUBLIC_GIT_SHA values are filled from SENTRY_ENVIRONMENT,
// SENTRY_TRACES_SAMPLE_RATE and GIT_SHA by next.config.ts.
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    dataCollection: sentryDataCollection,
    tracesSampleRate: parseSampleRate(
      process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE,
    ),
    environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT || undefined,
    release: process.env.NEXT_PUBLIC_GIT_SHA || undefined,
  });
}

// Instruments client-side navigations.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;

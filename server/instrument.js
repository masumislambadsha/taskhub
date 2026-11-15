// Must be required before any other module (Sentry's Node SDK instruments
// libraries as they are loaded). Does nothing unless SENTRY_DSN is set.
require("dotenv").config();

const dsn = process.env.SENTRY_DSN;

if (dsn) {
  const Sentry = require("@sentry/node");

  const rate = Number(process.env.SENTRY_TRACES_SAMPLE_RATE);
  const tracesSampleRate =
    process.env.SENTRY_TRACES_SAMPLE_RATE && rate >= 0 && rate <= 1
      ? rate
      : 0.1;

  Sentry.init({
    dsn,
    // Sentry SDK v11 replaced sendDefaultPii with dataCollection. Collect no
    // user info, cookies, headers, bodies, query params or local variables.
    dataCollection: {
      userInfo: false,
      cookies: false,
      httpHeaders: false,
      httpBodies: [],
      urlQueryParams: false,
      databaseQueryData: false,
      queues: false,
      stackFrameVariables: false,
    },
    tracesSampleRate,
    environment: process.env.SENTRY_ENVIRONMENT || undefined,
    release: process.env.GIT_SHA || undefined,
    initialScope: { tags: { service: "realtime" } },
  });
}

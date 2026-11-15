import type { BrowserOptions } from "@sentry/nextjs";

type DataCollection = NonNullable<BrowserOptions["dataCollection"]>;

/**
 * Parses SENTRY_TRACES_SAMPLE_RATE. Returns the default (0.1) when the value
 * is unset, not a number, or outside 0..1.
 */
export function parseSampleRate(value: string | undefined, fallback = 0.1) {
  if (value === undefined || value.trim() === "") return fallback;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 && n <= 1 ? n : fallback;
}

/**
 * Sentry SDK v11 replaced `sendDefaultPii` with `dataCollection`, and its
 * defaults collect more than `sendDefaultPii: false` ever did. This keeps the
 * old "no PII" intent and goes further for a payments app: no user info,
 * cookies, headers, request bodies, query params, DB query data or local
 * variables.
 */
export const sentryDataCollection: DataCollection = {
  userInfo: false,
  cookies: false,
  httpHeaders: false,
  httpBodies: [],
  urlQueryParams: false,
  databaseQueryData: false,
  queues: false,
  stackFrameVariables: false,
  genAI: { inputs: false, outputs: false },
  mcp: { inputs: false, outputs: false },
  graphQL: { document: false, variables: false },
};

import client from "prom-client";
import { timingSafeEqual } from "node:crypto";

/**
 * Prometheus metrics for the web app. One registry per process, kept on
 * `globalThis` so Next's dev reloads do not register the same metric twice.
 */
const g = globalThis as unknown as { __taskhubMetrics?: ReturnType<typeof build> };

function build() {
  const registry = new client.Registry();
  registry.setDefaultLabels({ service: "web" });
  client.collectDefaultMetrics({ register: registry });

  const httpRequests = new client.Counter({
    name: "taskhub_http_requests_total",
    help: "HTTP requests handled by API routes",
    labelNames: ["route", "method", "status"] as const,
    registers: [registry],
  });
  const httpDuration = new client.Histogram({
    name: "taskhub_http_request_duration_seconds",
    help: "API route latency",
    labelNames: ["route", "method"] as const,
    buckets: [0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
    registers: [registry],
  });
  const ledgerTransactions = new client.Counter({
    name: "taskhub_ledger_transactions_total",
    help: "Ledger transactions posted inside a database transaction (replays excluded; a later rollback is not subtracted), by type",
    labelNames: ["type"] as const,
    registers: [registry],
  });
  return { registry, httpRequests, httpDuration, ledgerTransactions };
}

export function metrics() {
  return (g.__taskhubMetrics ??= build());
}

export function observeRequest(route: string, method: string, status: number, seconds: number) {
  const m = metrics();
  m.httpRequests.inc({ route, method, status: String(status) });
  m.httpDuration.observe({ route, method }, seconds);
}

export function countLedgerTransaction(type: string) {
  metrics().ledgerTransactions.inc({ type });
}

/** True when the Authorization header carries METRICS_TOKEN (constant-time compare). */
export function metricsAuthorized(header: string | null): boolean {
  const token = process.env.METRICS_TOKEN;
  if (!token || !header?.startsWith("Bearer ")) return false;
  const given = Buffer.from(header.slice(7));
  const want = Buffer.from(token);
  return given.length === want.length && timingSafeEqual(given, want);
}

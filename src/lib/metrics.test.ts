// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";
import { countLedgerTransaction, metrics, metricsAuthorized, observeRequest } from "./metrics";

describe("metrics", () => {
  afterEach(() => {
    delete process.env.METRICS_TOKEN;
  });

  it("counts requests by route, method and status, with a latency histogram", async () => {
    observeRequest("/api/v1/tasks", "GET", 200, 0.04);
    observeRequest("/api/v1/tasks", "GET", 500, 0.3);
    countLedgerTransaction("task_funded");
    const text = await metrics().registry.metrics();
    expect(text).toContain('taskhub_http_requests_total{route="/api/v1/tasks",method="GET",status="200",service="web"} 1');
    expect(text).toContain('status="500"');
    expect(text).toContain("taskhub_http_request_duration_seconds_bucket");
    expect(text).toContain('taskhub_ledger_transactions_total{type="task_funded",service="web"} 1');
  });

  it("only authorizes the exact token", () => {
    expect(metricsAuthorized("Bearer x")).toBe(false); // no token configured
    process.env.METRICS_TOKEN = "secret-token";
    expect(metricsAuthorized("Bearer secret-token")).toBe(true);
    expect(metricsAuthorized("Bearer secret-tokeX")).toBe(false);
    expect(metricsAuthorized("Bearer short")).toBe(false);
    expect(metricsAuthorized("secret-token")).toBe(false);
    expect(metricsAuthorized(null)).toBe(false);
  });
});

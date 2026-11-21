import { beforeEach, describe, expect, it } from "vitest";
import { rateLimit, resetRateLimits } from "./rate-limit";

describe("rateLimit", () => {
  beforeEach(() => resetRateLimits());

  it("allows up to the limit, then refuses with a retry time", () => {
    for (let i = 0; i < 3; i++) {
      expect(rateLimit("u1", 3, 60_000, 1_000).ok).toBe(true);
    }
    const blocked = rateLimit("u1", 3, 60_000, 1_000);
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("counts each key separately", () => {
    rateLimit("a", 1, 60_000, 1_000);
    expect(rateLimit("a", 1, 60_000, 1_000).ok).toBe(false);
    expect(rateLimit("b", 1, 60_000, 1_000).ok).toBe(true);
  });

  it("starts a new window once the old one ends", () => {
    rateLimit("u", 1, 1_000, 0);
    expect(rateLimit("u", 1, 1_000, 500).ok).toBe(false);
    expect(rateLimit("u", 1, 1_000, 1_000).ok).toBe(true);
  });
});

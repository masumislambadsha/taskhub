import { afterEach, describe, expect, it, vi } from "vitest";
import { checkMongo, getVersion, timedCheck, withTimeout } from "./health";

describe("withTimeout", () => {
  it("resolves with the value when the promise finishes in time", async () => {
    await expect(withTimeout(Promise.resolve("ok"), 200)).resolves.toBe("ok");
  });

  it("rejects with a timeout error when the promise is too slow", async () => {
    const slow = new Promise((resolve) => setTimeout(resolve, 500));
    await expect(withTimeout(slow, 20)).rejects.toThrow("timeout");
  });

  it("passes through the original rejection", async () => {
    await expect(
      withTimeout(Promise.reject(new Error("boom")), 200),
    ).rejects.toThrow("boom");
  });
});

describe("timedCheck", () => {
  it("returns ok with a non-negative duration on success", async () => {
    const result = await timedCheck(async () => "fine");
    expect(result.ok).toBe(true);
    expect(result.ms).toBeGreaterThanOrEqual(0);
    expect(Object.keys(result).sort()).toEqual(["ms", "ok"]);
  });

  it("returns not ok when the check throws", async () => {
    const result = await timedCheck(async () => {
      throw new Error("boom");
    });
    expect(result.ok).toBe(false);
    expect(result.ms).toBeGreaterThanOrEqual(0);
  });

  it("never leaks error details", async () => {
    const result = await timedCheck(async () => {
      throw new Error("mongodb://user:secret@db.internal:27017 refused");
    });
    expect(Object.keys(result).sort()).toEqual(["ms", "ok"]);
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain("secret");
    expect(serialized).not.toContain("mongodb");
    expect(serialized).not.toContain("refused");
  });

  it("reports a timeout as not ok", async () => {
    const result = await timedCheck(
      () => new Promise((resolve) => setTimeout(resolve, 3000)),
    );
    expect(result.ok).toBe(false);
    expect(result.ms).toBeGreaterThanOrEqual(900);
  }, 5000);
});

describe("checkMongo", () => {
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  it("is ok when connect and ping succeed", async () => {
    const result = await checkMongo(async () => {}, async () => {});
    expect(result.ok).toBe(true);
    expect(Object.keys(result).sort()).toEqual(["ms", "ok"]);
  });

  it("allows a connect slower than the 1 second ping budget", async () => {
    const result = await checkMongo(
      () => sleep(150),
      async () => {},
      { connectTimeoutMs: 500, pingTimeoutMs: 50 },
    );
    expect(result.ok).toBe(true);
    expect(result.ms).toBeGreaterThanOrEqual(140);
  });

  it("fails when connect exceeds the connect budget, without waiting for it", async () => {
    const ping = vi.fn(async () => {});
    const result = await checkMongo(() => sleep(500), ping, {
      connectTimeoutMs: 50,
      pingTimeoutMs: 50,
    });
    expect(result.ok).toBe(false);
    expect(result.ms).toBeLessThan(300);
    expect(ping).not.toHaveBeenCalled();
  });

  it("fails when the ping exceeds the ping budget", async () => {
    const result = await checkMongo(async () => {}, () => sleep(500), {
      connectTimeoutMs: 500,
      pingTimeoutMs: 50,
    });
    expect(result.ok).toBe(false);
    expect(result.ms).toBeLessThan(300);
  });

  it("fails without leaking the error when connect rejects", async () => {
    const result = await checkMongo(
      async () => {
        throw new Error("mongodb://user:secret@host refused");
      },
      async () => {},
    );
    expect(result.ok).toBe(false);
    expect(JSON.stringify(result)).not.toContain("secret");
  });
});

describe("getVersion", () => {
  const FULL = "0123456789abcdef0123456789abcdef01234567";

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  function stub(env: Record<string, string>) {
    for (const k of ["GIT_SHA", "VERCEL_GIT_COMMIT_SHA", "RENDER_GIT_COMMIT"]) {
      vi.stubEnv(k, env[k] ?? "");
    }
  }

  it("returns dev when nothing is set", () => {
    stub({});
    expect(getVersion()).toBe("dev");
  });

  it("prefers GIT_SHA and shortens it to 7 characters", () => {
    stub({ GIT_SHA: FULL, VERCEL_GIT_COMMIT_SHA: "bbbbbbbbbb" });
    expect(getVersion()).toBe("0123456");
  });

  it("falls back to VERCEL_GIT_COMMIT_SHA", () => {
    stub({ VERCEL_GIT_COMMIT_SHA: FULL, RENDER_GIT_COMMIT: "cccccccccc" });
    expect(getVersion()).toBe("0123456");
  });

  it("falls back to RENDER_GIT_COMMIT", () => {
    stub({ RENDER_GIT_COMMIT: FULL });
    expect(getVersion()).toBe("0123456");
  });

  it("keeps values shorter than 7 characters as they are", () => {
    stub({ GIT_SHA: "abc" });
    expect(getVersion()).toBe("abc");
  });
});

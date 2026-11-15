import { describe, expect, it } from "vitest";
import { timedCheck, withTimeout } from "./health";

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

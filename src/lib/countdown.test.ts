import { describe, expect, it } from "vitest";
import { autoApproveCountdown } from "./countdown";

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
const now = Date.UTC(2026, 10, 27, 12, 0, 0);
const at = (ms: number) => new Date(now + ms);

describe("autoApproveCountdown", () => {
  it("shows days and hours for a long wait", () => {
    expect(autoApproveCountdown(at(2 * DAY + 5 * HOUR + 10 * MIN), now)).toBe("Auto-approves in 2d 5h");
    expect(autoApproveCountdown(at(72 * HOUR), now)).toBe("Auto-approves in 3d 0h");
  });

  it("shows hours and minutes under a day", () => {
    expect(autoApproveCountdown(at(3 * HOUR + 20 * MIN), now)).toBe("Auto-approves in 3h 20m");
  });

  it("shows minutes under an hour", () => {
    expect(autoApproveCountdown(at(12 * MIN + 30_000), now)).toBe("Auto-approves in 12m");
  });

  it("says any moment now when it is due or past", () => {
    expect(autoApproveCountdown(at(30_000), now)).toBe("Auto-approves any moment now");
    expect(autoApproveCountdown(at(-5 * HOUR), now)).toBe("Auto-approves any moment now");
  });

  it("accepts an ISO string and returns nothing without a date", () => {
    expect(autoApproveCountdown(at(2 * HOUR).toISOString(), now)).toBe("Auto-approves in 2h 0m");
    expect(autoApproveCountdown(undefined, now)).toBe("");
    expect(autoApproveCountdown("not a date", now)).toBe("");
  });
});

import { describe, expect, it } from "vitest";
import { computeTrust, explainTrust, levelForScore, MIN_DECIDED_FOR_RATE, type TrustInput } from "./trust";

const base: TrustInput = {
  approved90: 0,
  rejected90: 0,
  approvedTotal: 0,
  accountAgeDays: 0,
  emailVerified: false,
  phoneVerified: false,
  lostDisputes90: 0,
  confirmedFlags: 0,
};
const score = (o: Partial<TrustInput>) => computeTrust({ ...base, ...o });

describe("trust components", () => {
  it("a brand new account has only the clean-record points", () => {
    const r = score({});
    expect(r.components).toEqual({ approvalRate: 0, volume: 0, accountAge: 0, verified: 0, disputes: 10, fraud: 15 });
    expect(r.score).toBe(25);
    expect(r.level).toBe(0);
  });

  it("approval rate counts only after 10 reviewed submissions, and is worth up to 40", () => {
    expect(score({ approved90: 9, rejected90: 0 }).components.approvalRate).toBe(0);
    expect(score({ approved90: MIN_DECIDED_FOR_RATE, rejected90: 0 }).components.approvalRate).toBe(40);
    expect(score({ approved90: 15, rejected90: 5 }).components.approvalRate).toBe(30);
    expect(score({ approved90: 0, rejected90: 20 }).components.approvalRate).toBe(0);
  });

  it("volume grows on a log scale up to 15", () => {
    const at = (n: number) => score({ approvedTotal: n }).components.volume;
    expect(at(0)).toBe(0);
    expect(at(10)).toBeGreaterThan(4);
    expect(at(10)).toBeLessThan(7);
    expect(at(200)).toBe(15);
    expect(at(100000)).toBe(15);
    expect(at(20) - at(10)).toBeLessThan(at(10) - at(0)); // the first approvals count most
  });

  it("account age grows linearly over 180 days up to 10", () => {
    expect(score({ accountAgeDays: 0 }).components.accountAge).toBe(0);
    expect(score({ accountAgeDays: 90 }).components.accountAge).toBe(5);
    expect(score({ accountAgeDays: 400 }).components.accountAge).toBe(10);
  });

  it("verified email and phone are 5 each", () => {
    expect(score({ emailVerified: true }).components.verified).toBe(5);
    expect(score({ emailVerified: true, phoneVerified: true }).components.verified).toBe(10);
  });

  it("each lost dispute costs 5 of the 10 dispute points", () => {
    expect(score({ lostDisputes90: 1 }).components.disputes).toBe(5);
    expect(score({ lostDisputes90: 2 }).components.disputes).toBe(0);
    expect(score({ lostDisputes90: 5 }).components.disputes).toBe(0);
  });

  it("a confirmed fraud flag removes the fraud points and caps the score at 20", () => {
    const perfect = { approved90: 50, approvedTotal: 500, accountAgeDays: 400, emailVerified: true, phoneVerified: true };
    expect(score(perfect).score).toBe(100);
    const flagged = score({ ...perfect, confirmedFlags: 1 });
    expect(flagged.components.fraud).toBe(0);
    expect(flagged.score).toBe(20);
    expect(flagged.capped).toBe(true);
    expect(flagged.level).toBe(0);
  });
});

describe("levels", () => {
  it("L0 below 30, L1 30-59, L2 60-79, L3 80+", () => {
    expect([0, 29, 30, 59, 60, 79, 80, 100].map(levelForScore)).toEqual([0, 0, 1, 1, 2, 2, 3, 3]);
  });

  it("an active, reliable worker reaches Trusted without verification", () => {
    const r = score({ approved90: 100, rejected90: 2, approvedTotal: 300, accountAgeDays: 200 });
    expect(r.score).toBeGreaterThanOrEqual(80);
    expect(r.level).toBe(3);
  });
});

describe("explainTrust", () => {
  it("says what the worker needs for the next level, and why the rate is not counted yet", () => {
    const input = { ...base, approved90: 3, rejected90: 1 };
    const lines = explainTrust(computeTrust(input), input);
    expect(lines[0]).toMatch(/Your level: New \(25\)\. 5 more points to reach Regular\./);
    expect(lines.join(" ")).toMatch(/after 10 reviewed submissions.*you have 4/);
  });

  it("mentions lost disputes and a fraud cap, and the top level", () => {
    const input = { ...base, approved90: 100, approvedTotal: 300, accountAgeDays: 300, lostDisputes90: 1, confirmedFlags: 1 };
    const text = explainTrust(computeTrust(input), input).join(" ");
    expect(text).toMatch(/1 lost dispute/);
    expect(text).toMatch(/caps your score at 20/);
    const top = { ...base, approved90: 100, approvedTotal: 300, accountAgeDays: 300, emailVerified: true, phoneVerified: true };
    expect(explainTrust(computeTrust(top), top)[0]).toMatch(/top level/);
  });
});

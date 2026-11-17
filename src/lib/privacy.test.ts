import { describe, expect, it } from "vitest";
import {
  maskAccount,
  maskAccountFields,
  maskEmail,
  maskEmailFields,
  redactEmailFields,
  shouldMaskEmails,
} from "@/lib/privacy";

describe("maskEmail", () => {
  it("keeps the first letter and the domain", () => {
    expect(maskEmail("mohammad@gmail.com")).toBe("m•••@gmail.com");
    expect(maskEmail("a@b.co")).toBe("a•••@b.co");
  });

  it("masks by the last @ and handles odd input", () => {
    expect(maskEmail("we@ird@example.com")).toBe("w•••@example.com");
    expect(maskEmail("@example.com")).toBe("•••@example.com");
    expect(maskEmail("nodomain")).toBe("n•••");
    expect(maskEmail("")).toBe("");
    expect(maskEmail(undefined)).toBe("");
    expect(maskEmail(null)).toBe("");
  });
});

describe("maskEmailFields", () => {
  const rows = [
    { _id: "1", name: "A", email: "alice@x.com" },
    { _id: "2", name: "B", email: "bob@x.com" },
  ];

  it("masks only for a demo admin, and never mutates the input", () => {
    const out = maskEmailFields(rows, ["email"], { id: "9", role: "demo_admin" });
    expect(out.map((r) => r.email)).toEqual(["a•••@x.com", "b•••@x.com"]);
    expect(rows[0].email).toBe("alice@x.com");
  });

  it("leaves the viewer's own row alone", () => {
    const out = maskEmailFields(rows, ["email"], { id: "2", role: "demo_admin" });
    expect(out.map((r) => r.email)).toEqual(["a•••@x.com", "bob@x.com"]);
  });

  it("returns the rows unchanged for an admin or anyone else", () => {
    expect(maskEmailFields(rows, ["email"], { id: "9", role: "admin" })).toBe(rows);
    expect(maskEmailFields(rows, ["email"], undefined)).toBe(rows);
    expect(shouldMaskEmails({ role: "demo_admin" })).toBe(true);
    expect(shouldMaskEmails({ role: "admin" })).toBe(false);
  });
});

describe("maskAccount", () => {
  it("keeps the first 3 and last 3 characters", () => {
    expect(maskAccount("01929686694")).toBe("019•••••694");
    expect(maskAccount("1234567")).toBe("123•567");
  });

  it("bullets a short value entirely and handles empty input", () => {
    expect(maskAccount("123456")).toBe("••••••");
    expect(maskAccount("12")).toBe("••");
    expect(maskAccount("")).toBe("");
    expect(maskAccount(undefined)).toBe("");
  });
});

describe("maskAccountFields", () => {
  const rows = [{ accountNumber: "01929686694", n: 1 }];
  it("masks only for a demo admin", () => {
    expect(maskAccountFields(rows, ["accountNumber"], { role: "demo_admin" })[0].accountNumber).toBe("019•••••694");
    expect(maskAccountFields(rows, ["accountNumber"], { role: "admin" })).toBe(rows);
    expect(rows[0].accountNumber).toBe("01929686694");
  });
});

describe("redactEmailFields", () => {
  const rows = [
    { _id: "t1", buyerId: "b1", buyerEmail: "one@x.com" },
    { _id: "t2", buyerId: "b2", buyerEmail: "two@x.com" },
  ];
  const run = (viewer: { id?: string; role?: string } | undefined) =>
    redactEmailFields(rows, ["buyerEmail"], viewer, "buyerId");

  it("leaves the field out for anonymous callers, workers and other buyers", () => {
    for (const v of [undefined, { id: "w1", role: "worker" }, { id: "b3", role: "buyer" }]) {
      for (const r of run(v)) expect("buyerEmail" in r).toBe(false);
    }
  });

  it("keeps it on the owner's own rows only", () => {
    const out = run({ id: "b1", role: "buyer" });
    expect(out[0].buyerEmail).toBe("one@x.com");
    expect("buyerEmail" in out[1]).toBe(false);
  });

  it("gives an admin the real values and a demo admin masked ones", () => {
    expect(run({ id: "a", role: "admin" })).toBe(rows);
    expect(run({ id: "d", role: "demo_admin" }).map((r) => r.buyerEmail)).toEqual(["o•••@x.com", "t•••@x.com"]);
  });

  it("does not change the input", () => {
    run(undefined);
    expect(rows[0].buyerEmail).toBe("one@x.com");
  });
});

import { describe, expect, it } from "vitest";
import { maskEmail, maskEmailFields, shouldMaskEmails } from "@/lib/privacy";

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

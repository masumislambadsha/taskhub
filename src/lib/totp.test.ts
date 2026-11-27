import { describe, expect, it } from "vitest";
import {
  base32Decode,
  base32Encode,
  currentStep,
  generateTotpSecret,
  otpauthUri,
  totpForStep,
  verifyTotp,
} from "./totp";
import { decryptSecret, encryptSecret } from "./mfa-crypto";

// RFC 6238 appendix B: the SHA-1 secret is the ASCII text 12345678901234567890.
const RFC_SECRET = base32Encode(Buffer.from("12345678901234567890"));

describe("TOTP (RFC 6238 test vectors, SHA-1, last 6 digits of the 8-digit values)", () => {
  const vectors: [number, string][] = [
    [59, "287082"],
    [1111111109, "081804"],
    [1111111111, "050471"],
    [1234567890, "005924"],
    [2000000000, "279037"],
    [20000000000, "353130"],
  ];
  for (const [seconds, code] of vectors) {
    it(`gives ${code} at ${seconds}s`, () => {
      expect(totpForStep(RFC_SECRET, currentStep(seconds * 1000))).toBe(code);
    });
  }
});

describe("base32", () => {
  it("round-trips and ignores case, spaces and padding", () => {
    const bytes = Buffer.from([0, 1, 2, 250, 255, 128, 7]);
    expect(base32Decode(base32Encode(bytes))).toEqual(bytes);
    const secret = generateTotpSecret();
    expect(secret).toMatch(/^[A-Z2-7]{32}$/);
    expect(base32Decode(secret.toLowerCase().replace(/(.{4})/g, "$1 "))).toEqual(base32Decode(secret));
    expect(() => base32Decode("not!base32")).toThrow();
  });
});

describe("verifyTotp", () => {
  const now = 1_700_000_000_000;
  const step = currentStep(now);

  it("accepts the current code and one step of drift either way, and returns the step", () => {
    expect(verifyTotp(RFC_SECRET, totpForStep(RFC_SECRET, step), now)).toBe(step);
    expect(verifyTotp(RFC_SECRET, totpForStep(RFC_SECRET, step - 1), now)).toBe(step - 1);
    expect(verifyTotp(RFC_SECRET, totpForStep(RFC_SECRET, step + 1), now)).toBe(step + 1);
  });

  it("rejects older, newer, wrong and malformed codes", () => {
    expect(verifyTotp(RFC_SECRET, totpForStep(RFC_SECRET, step - 2), now)).toBeNull();
    expect(verifyTotp(RFC_SECRET, totpForStep(RFC_SECRET, step + 2), now)).toBeNull();
    expect(verifyTotp(RFC_SECRET, "000000", now) === null || totpForStep(RFC_SECRET, step) === "000000").toBe(true);
    for (const bad of ["", "12345", "1234567", "abcdef", "12 345"]) {
      expect(verifyTotp(RFC_SECRET, bad, now)).toBeNull();
    }
  });

  it("builds the otpauth link the authenticator apps read", () => {
    const uri = otpauthUri({ secret: "ABC234", account: "me@example.test", issuer: "TaskHub" });
    expect(uri).toBe("otpauth://totp/TaskHub:me%40example.test?secret=ABC234&issuer=TaskHub&algorithm=SHA1&digits=6&period=30");
  });
});

describe("secret encryption", () => {
  it("round-trips, uses a fresh IV, and detects tampering", () => {
    process.env.MFA_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
    const a = encryptSecret("JBSWY3DPEHPK3PXP");
    const b = encryptSecret("JBSWY3DPEHPK3PXP");
    expect(a.data).not.toBe(b.data);
    expect(a.iv).not.toBe(b.iv);
    expect(JSON.stringify(a)).not.toContain("JBSWY3DPEHPK3PXP");
    expect(decryptSecret(a)).toBe("JBSWY3DPEHPK3PXP");

    const flipped = { ...a, data: Buffer.from(Buffer.from(a.data, "base64").map((x, i) => (i === 0 ? x ^ 1 : x))).toString("base64") };
    expect(() => decryptSecret(flipped)).toThrow();
    expect(() => decryptSecret({ ...a, tag: b.tag })).toThrow();
  });

  it("accepts a hex key and refuses a missing or wrong-sized key", () => {
    process.env.MFA_ENCRYPTION_KEY = "ab".repeat(32);
    expect(decryptSecret(encryptSecret("x"))).toBe("x");
    process.env.MFA_ENCRYPTION_KEY = "short";
    expect(() => encryptSecret("x")).toThrow(/32 bytes/);
    delete process.env.MFA_ENCRYPTION_KEY;
    expect(() => encryptSecret("x")).toThrow(/not set/);
  });
});

import { describe, expect, it } from "vitest";
import { jwtVerify } from "jose";
import {
  SOCKET_TOKEN_AUDIENCE,
  SOCKET_TOKEN_ISSUER,
  SocketSecretError,
  signSocketToken,
} from "./socket-token";

// Obviously fake secrets, long enough to be accepted.
const SECRET = "test-secret-test-secret-test-secret-123456";
const key = new TextEncoder().encode(SECRET);
const user = { id: "65f000000000000000000001", name: "Ada", role: "worker" };

describe("signSocketToken", () => {
  it("verifies with the right secret, issuer and audience", async () => {
    const token = await signSocketToken(user, SECRET);
    const { payload, protectedHeader } = await jwtVerify(token, key, {
      issuer: SOCKET_TOKEN_ISSUER,
      audience: SOCKET_TOKEN_AUDIENCE,
      algorithms: ["HS256"],
    });
    expect(protectedHeader.alg).toBe("HS256");
    expect(payload.sub).toBe(user.id);
    expect(payload.name).toBe("Ada");
    expect(payload.role).toBe("worker");
  });

  it("expires in about 600 seconds", async () => {
    const { payload } = await jwtVerify(await signSocketToken(user, SECRET), key);
    expect(payload.exp! - payload.iat!).toBe(600);
  });

  it("does not verify with another secret, issuer or audience", async () => {
    const token = await signSocketToken(user, SECRET);
    await expect(
      jwtVerify(token, new TextEncoder().encode("x".repeat(40))),
    ).rejects.toThrow();
    await expect(jwtVerify(token, key, { issuer: "other" })).rejects.toThrow();
    await expect(jwtVerify(token, key, { audience: "other" })).rejects.toThrow();
  });

  it("fails closed without a valid secret", async () => {
    await expect(signSocketToken(user, undefined)).rejects.toBeInstanceOf(
      SocketSecretError,
    );
    await expect(signSocketToken(user, "")).rejects.toBeInstanceOf(SocketSecretError);
    await expect(signSocketToken(user, "short-secret")).rejects.toBeInstanceOf(
      SocketSecretError,
    );
  });

  it("reads SOCKET_JWT_SECRET from the environment by default", async () => {
    const prev = process.env.SOCKET_JWT_SECRET;
    try {
      delete process.env.SOCKET_JWT_SECRET;
      await expect(signSocketToken(user)).rejects.toBeInstanceOf(SocketSecretError);
      process.env.SOCKET_JWT_SECRET = SECRET;
      await expect(signSocketToken(user)).resolves.toEqual(expect.any(String));
    } finally {
      if (prev === undefined) delete process.env.SOCKET_JWT_SECRET;
      else process.env.SOCKET_JWT_SECRET = prev;
    }
  });
});

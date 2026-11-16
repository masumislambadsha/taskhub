import { SignJWT } from "jose";

export const SOCKET_TOKEN_ISSUER = "taskhub-web";
export const SOCKET_TOKEN_AUDIENCE = "taskhub-realtime";
export const SOCKET_TOKEN_TTL_SECONDS = 600;
export const SOCKET_SECRET_MIN_LENGTH = 32;

export interface SocketTokenUser {
  id: string;
  name?: string | null;
  role?: string | null;
}

/** Thrown when SOCKET_JWT_SECRET is missing or too short (fail closed). */
export class SocketSecretError extends Error {
  constructor() {
    super("SOCKET_JWT_SECRET is missing or shorter than 32 characters");
    this.name = "SocketSecretError";
  }
}

/**
 * Signs a short-lived HS256 token the realtime server uses to identify a user.
 * `secret` defaults to SOCKET_JWT_SECRET; the secret is never logged or returned.
 */
export async function signSocketToken(
  user: SocketTokenUser,
  secret: string | undefined = process.env.SOCKET_JWT_SECRET,
): Promise<string> {
  if (!secret || secret.length < SOCKET_SECRET_MIN_LENGTH) {
    throw new SocketSecretError();
  }
  return new SignJWT({ name: user.name ?? "Unknown", role: user.role ?? "" })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(user.id)
    .setIssuer(SOCKET_TOKEN_ISSUER)
    .setAudience(SOCKET_TOKEN_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${SOCKET_TOKEN_TTL_SECONDS}s`)
    .sign(new TextEncoder().encode(secret));
}

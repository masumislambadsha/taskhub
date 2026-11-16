import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { withRequestLogging } from "@/lib/with-request-logging";
import {
  SOCKET_TOKEN_TTL_SECONDS,
  SocketSecretError,
  signSocketToken,
} from "@/lib/socket-token";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

// Issues a short-lived token the browser or mobile app passes to the realtime
// server in the socket handshake. auth() accepts the session cookie and the
// mobile app's Bearer token.
export const GET = withRequestLogging("/api/v1/socket-token", async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: NO_STORE },
    );
  }

  try {
    const token = await signSocketToken({
      id: session.user.id,
      name: session.user.name,
      role: session.user.role,
    });
    return NextResponse.json(
      { token, expiresIn: SOCKET_TOKEN_TTL_SECONDS },
      { headers: NO_STORE },
    );
  } catch (err) {
    if (err instanceof SocketSecretError) {
      logger.error(
        { route: "/api/v1/socket-token" },
        "SOCKET_JWT_SECRET is missing or shorter than 32 characters",
      );
    } else {
      logger.error({ err, route: "/api/v1/socket-token" }, "socket token signing failed");
    }
    return NextResponse.json(
      { error: "Could not issue token" },
      { status: 500, headers: NO_STORE },
    );
  }
});

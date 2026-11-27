import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { decode } from "next-auth/jwt";
import { headers } from "next/headers";
import { CredentialsSignin } from "next-auth";
import { LoginRateLimited, authorizeCredentials } from "@/lib/credentials-login";
import { randomUUID } from "node:crypto";
import { connectDB } from "./db";
import { refreshToken, resolveBearerUser } from "./auth-session";
import User from "@/models/User";
import { WORKER_INITIAL_COINS } from "@/lib/constants";
import {
  createUserWithBonus,
  isDuplicateKeyError,
} from "@/lib/ledger/flows/users";

/** Auth.js cannot answer 429, so a blocked sign-in fails with this code and the login page shows the wait. */
class TooManyLoginAttempts extends CredentialsSignin {
  constructor(retryAfterSeconds: number) {
    super();
    this.code = `rate_limited:${retryAfterSeconds}`;
  }
}

const { handlers, auth: nextAuthAuth, signIn, signOut } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, request) {
        try {
          return await authorizeCredentials(credentials, request);
        } catch (err) {
          if (err instanceof LoginRateLimited) throw new TooManyLoginAttempts(err.retryAfterSeconds);
          throw err;
        }
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === "google") {
        await connectDB();
        const existing = await User.findOne({ email: user.email! });
        if (!existing) {
          try {
            await createUserWithBonus({
              data: {
                name: user.name!,
                email: user.email!,
                photoUrl: user.image ?? undefined,
                role: "worker",
              },
              bonus: WORKER_INITIAL_COINS,
            });
          } catch (err) {
            // A concurrent first sign-in already created the user.
            if (!isDuplicateKeyError(err)) throw err;
          }
        }
      }
      return true;
    },
    async jwt({ token, user, trigger, session }) {
      if (user) {
        if (user.id && !user.id.match(/^[0-9a-fA-F]{24}$/) && user.email) {
          await connectDB();
          const dbUser = await User.findOne({
            email: user.email as string,
          }).lean();
          if (dbUser) token.id = dbUser._id.toString();
        } else {
          token.id = user.id;
        }
        token.role = (user as { role?: string }).role;
        token.coins = (user as { coins?: number }).coins;
        // A fresh random ID per login. The server remembers, against this ID,
        // whether this login has proved the admin second factor.
        token.sid = randomUUID();
      }
      // Never take anything from the client's update() payload: the database
      // is the only source of role, coins and profile. A null return ends the
      // session (deleted or suspended user).
      return refreshToken(token, { trigger, session });
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
        session.user.sid = token.sid as string | undefined;
        session.user.coins = token.coins as number;
        session.user.image = (token.picture as string) ?? session.user.image;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  session: { strategy: "jwt" },
  secret: process.env.NEXTAUTH_SECRET,
});

export const auth = async () => {
  const session = await nextAuthAuth();
  if (session) return session;

  try {
    const h = await headers();
    const authHeader = h.get("authorization");
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.slice(7);
      const url = process.env.NEXTAUTH_URL || "http://localhost:3000";
      const salt = url.startsWith("https://") ? "__Secure-authjs.session-token" : "authjs.session-token";
      const decoded = await decode({ token, salt, secret: process.env.NEXTAUTH_SECRET! });
      const user = await resolveBearerUser(decoded);
      if (user) return { user };
    }
  } catch {}

  return session;
};

export { handlers, signIn, signOut };

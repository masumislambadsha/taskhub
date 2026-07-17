import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import bcrypt from "bcryptjs";
import { connectDB } from "./db";
import User from "@/models/User";

export const { handlers, auth, signIn, signOut } = NextAuth({
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
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        await connectDB();
        const user = await User.findOne({ email: credentials.email });
        if (!user || !user.passwordHash) return null;
        if (user.status === "suspended") throw new Error("Account suspended");
        const valid = await bcrypt.compare(
          credentials.password as string,
          user.passwordHash,
        );
        if (!valid) return null;
        return {
          id: user._id.toString(),
          name: user.name,
          email: user.email,
          image: user.photoUrl,
          role: user.role,
          coins: user.coins,
        };
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === "google") {
        await connectDB();
        const existing = await User.findOne({ email: user.email! });
        if (!existing) {
          await User.create({
            name: user.name!,
            email: user.email!,
            photoUrl: user.image ?? undefined,
            role: "worker",
            coins: 10,
            status: "active",
          });
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
      }
      if (trigger === "update" && session) {
        token.coins = session.coins;
        token.role = session.role;
      }
      if (token.id) {
        await connectDB();
        const dbUser = await User.findById(token.id).lean();
        if (dbUser) {
          token.role = dbUser.role;
          token.coins = dbUser.coins;
          token.name = dbUser.name;
          token.picture = dbUser.photoUrl;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
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

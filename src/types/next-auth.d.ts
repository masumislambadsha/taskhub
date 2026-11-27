import "next-auth";

declare module "next-auth" {
  interface User {
    id: string;
    role?: string;
    coins?: number;
  }
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      role: string;
      coins: number;
      /** Random ID of this login, used to track its two-factor verification. */
      sid?: string;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    role?: string;
    coins?: number;
    sid?: string;
  }
}

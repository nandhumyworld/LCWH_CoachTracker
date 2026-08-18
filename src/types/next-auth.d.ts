import type { DefaultSession } from "next-auth";

export type AppRole = "admin" | "coach" | "student";

// Augment Auth.js types so `session.user.role` / `.id` are strongly typed.
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: AppRole;
    } & DefaultSession["user"];
  }

  interface User {
    role: AppRole;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: AppRole;
    uid?: string;
  }
}

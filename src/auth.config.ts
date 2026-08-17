import type { NextAuthConfig } from "next-auth";

// Edge-safe base config shared by the full server auth (`auth.ts`) and the
// middleware. It must NOT import Prisma, bcrypt, or anything Node-only, because
// the middleware bundle runs on the edge runtime. The Credentials provider
// (which does hit the DB) is added only in `auth.ts`.
export const authConfig = {
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [],
  callbacks: {
    jwt: ({ token, user }) => {
      if (user) {
        token.role = (user as { role: string }).role;
        token.uid = (user as { id: string }).id;
      }
      return token;
    },
    session: ({ session, token }) => {
      if (session.user) {
        session.user.role = token.role as "admin" | "coach" | "student";
        session.user.id = token.uid as string;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;

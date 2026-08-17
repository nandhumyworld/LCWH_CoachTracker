import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/auth.config";
import { hasRole, homePathForRole } from "@/lib/auth-helpers";
import type { AppRole } from "@/types/next-auth";

// Edge-safe auth built from the base config only (no Credentials/DB).
const { auth } = NextAuth(authConfig);

// Which role(s) may access each protected area.
const AREA_ROLES: { prefix: string; roles: AppRole[] }[] = [
  { prefix: "/admin", roles: ["admin"] },
  { prefix: "/coach", roles: ["coach"] },
  { prefix: "/student", roles: ["student"] },
];

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const area = AREA_ROLES.find((a) => pathname.startsWith(a.prefix));
  if (!area) return NextResponse.next();

  const role = req.auth?.user?.role;

  // Not signed in → login, preserving intended destination.
  if (!req.auth) {
    const url = new URL("/login", req.nextUrl.origin);
    url.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(url);
  }

  // Signed in but wrong role → send to the user's own home.
  if (!hasRole(role, area.roles)) {
    return NextResponse.redirect(
      new URL(homePathForRole(role as AppRole), req.nextUrl.origin),
    );
  }

  return NextResponse.next();
});

// Run only for the protected areas (keeps middleware off static/api/auth).
export const config = {
  matcher: ["/admin/:path*", "/coach/:path*", "/student/:path*"],
};

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { hasRole, homePathForRole, type SessionUser } from "@/lib/auth-helpers";
import type { AppRole } from "@/types/next-auth";

// Session-dependent guards for Server Components / actions. Kept separate from
// the pure helpers so unit tests never pull in the next-auth/next runtime.

// Returns the current user or null.
export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await auth();
  const u = session?.user;
  if (!u?.id || !u.role) return null;
  return {
    id: u.id,
    role: u.role,
    name: u.name ?? "",
    email: u.email ?? "",
  };
}

// Enforces authentication + role. Redirects to /login when unauthenticated, or
// to the user's own home when authenticated with the wrong role. Returns the
// user on success.
export async function requireRole(...allowed: AppRole[]): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (!hasRole(user.role, allowed)) redirect(homePathForRole(user.role));
  return user;
}

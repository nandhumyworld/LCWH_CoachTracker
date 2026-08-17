import type { AppRole } from "@/types/next-auth";

// Pure RBAC helpers — no session/IO imports, so they unit-test in isolation
// and stay usable from both server and edge (middleware) contexts.

export interface SessionUser {
  id: string;
  role: AppRole;
  name: string;
  email: string;
}

// Membership check.
export function hasRole(
  role: AppRole | undefined,
  allowed: AppRole[],
): boolean {
  return role !== undefined && allowed.includes(role);
}

// Landing path for a role after login / when redirected off a wrong area.
export function homePathForRole(role: AppRole): string {
  switch (role) {
    case "admin":
      return "/admin";
    case "coach":
      return "/coach";
    case "student":
      return "/student";
  }
}

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
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

export interface CoachContext {
  user: SessionUser;
  coachId: string;
}

// Enforces the coach role AND resolves the caller's own coachId, so every
// coach action is automatically scoped to their own data.
export async function requireCoach(): Promise<CoachContext> {
  const user = await requireRole("coach");
  const coach = await prisma.coach.findUnique({
    where: { userId: user.id },
    select: { id: true },
  });
  if (!coach) redirect("/login");
  return { user, coachId: coach.id };
}

export interface StudentContext {
  user: SessionUser;
  studentId: string;
  coachId: string;
  intakeComplete: boolean;
}

// Enforces the student role AND resolves the caller's own studentId + intake
// state, so student pages/actions are scoped to their own data.
export async function requireStudent(): Promise<StudentContext> {
  const user = await requireRole("student");
  const student = await prisma.student.findUnique({
    where: { userId: user.id },
    select: { id: true, coachId: true, intakeAt: true },
  });
  if (!student) redirect("/login");
  return {
    user,
    studentId: student.id,
    coachId: student.coachId,
    intakeComplete: student.intakeAt !== null,
  };
}

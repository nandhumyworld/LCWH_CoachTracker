"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth-guards";
import { hashPassword } from "@/lib/password";
import { createInvite } from "@/lib/invites";
import { originUrl } from "@/lib/origin";
import { writeProfilePanel } from "@/lib/profile-panel";
import {
  createUserSchema,
  identitySchema,
  passwordSchema,
  studentProfileSchema,
  normalizeEmail,
  isValidTimezone,
  buildAuditDetails,
  type AuditDetails,
} from "@/lib/admin-users-util";

export interface AdminActionResult {
  ok: boolean;
  error?: string;
  url?: string;
}

async function writeAudit(
  actorUserId: string,
  targetUserId: string,
  action: string,
  details: AuditDetails | null,
): Promise<void> {
  await prisma.adminAuditLog.create({
    data: {
      actorUserId,
      targetUserId,
      action,
      details: (details ?? undefined) as Prisma.InputJsonValue | undefined,
    },
  });
}

// Admin creates a coach or admin. Passwordless account + one-time reset link.
export async function createUser(input: {
  name: string;
  email: string;
  role: "coach" | "admin";
}): Promise<AdminActionResult> {
  const admin = await requireRole("admin");
  const parsed = createUserSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const email = normalizeEmail(parsed.data.email);
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return { ok: false, error: "A user with that email already exists." };

  const user = await prisma.user.create({
    data: {
      email,
      name: parsed.data.name.trim(),
      role: parsed.data.role,
      ...(parsed.data.role === "coach" ? { coach: { create: {} } } : {}),
    },
  });

  const { token } = await createInvite(user.id);
  const url = await originUrl(`/set-password?token=${token}`);
  await writeAudit(admin.id, user.id, "user.create", {
    role: { from: null, to: parsed.data.role },
    email: { from: null, to: email },
  });
  revalidatePath("/admin/users");
  return { ok: true, url };
}

// Edit name + email on any user (including self).
export async function updateUserIdentity(input: {
  userId: string;
  name: string;
  email: string;
}): Promise<AdminActionResult> {
  const admin = await requireRole("admin");
  const parsed = identitySchema.safeParse({ name: input.name, email: input.email });
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const email = normalizeEmail(parsed.data.email);
  const user = await prisma.user.findUnique({
    where: { id: input.userId },
    select: { id: true, name: true, email: true },
  });
  if (!user) return { ok: false, error: "User not found." };

  const clash = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (clash && clash.id !== user.id)
    return { ok: false, error: "A user with that email already exists." };

  const name = parsed.data.name.trim();
  await prisma.user.update({ where: { id: user.id }, data: { name, email } });
  await writeAudit(
    admin.id,
    user.id,
    "identity.update",
    buildAuditDetails({ name: user.name, email: user.email }, { name, email }, ["name", "email"]),
  );
  revalidatePath(`/admin/users/${user.id}`);
  return { ok: true };
}

// Set a password directly.
export async function setUserPassword(input: {
  userId: string;
  password: string;
}): Promise<AdminActionResult> {
  const admin = await requireRole("admin");
  const parsed = passwordSchema.safeParse({ password: input.password });
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const user = await prisma.user.findUnique({ where: { id: input.userId }, select: { id: true } });
  if (!user) return { ok: false, error: "User not found." };

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(parsed.data.password) },
  });
  await writeAudit(admin.id, user.id, "password.set", null);
  return { ok: true };
}

// Generate a one-time reset link the admin can copy.
export async function sendPasswordReset(userId: string): Promise<AdminActionResult> {
  const admin = await requireRole("admin");
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!user) return { ok: false, error: "User not found." };

  const { token } = await createInvite(user.id);
  const url = await originUrl(`/set-password?token=${token}`);
  await writeAudit(admin.id, user.id, "password.reset_link", null);
  return { ok: true, url };
}

// Edit a student's profile + coach assignment; recompute the profile panel.
export async function updateStudentProfile(input: {
  userId: string;
  timezone: string;
  status: "invited" | "active" | "paused";
  coachId: string;
  heightCm: number;
  currentWeightKg: number;
  targetWeightKg: number;
}): Promise<AdminActionResult> {
  const admin = await requireRole("admin");
  const parsed = studentProfileSchema.safeParse({
    timezone: input.timezone,
    status: input.status,
    coachId: input.coachId,
    heightCm: input.heightCm,
    currentWeightKg: input.currentWeightKg,
    targetWeightKg: input.targetWeightKg,
  });
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  if (!isValidTimezone(parsed.data.timezone))
    return { ok: false, error: "Unknown timezone." };

  const student = await prisma.student.findUnique({ where: { userId: input.userId } });
  if (!student) return { ok: false, error: "This user is not a student." };

  const coach = await prisma.coach.findUnique({
    where: { id: parsed.data.coachId },
    select: { id: true },
  });
  if (!coach) return { ok: false, error: "Coach not found." };

  const before = {
    timezone: student.timezone,
    status: student.status,
    coachId: student.coachId,
    heightCm: student.heightCm,
    currentWeightKg: student.currentWeightKg,
    targetWeightKg: student.targetWeightKg,
  };

  await prisma.student.update({
    where: { id: student.id },
    data: {
      timezone: parsed.data.timezone,
      status: parsed.data.status,
      coachId: parsed.data.coachId,
      heightCm: parsed.data.heightCm,
      currentWeightKg: parsed.data.currentWeightKg,
      targetWeightKg: parsed.data.targetWeightKg,
    },
  });

  await writeProfilePanel(student.id, {
    heightCm: parsed.data.heightCm,
    currentWeightKg: parsed.data.currentWeightKg,
    targetWeightKg: parsed.data.targetWeightKg,
  });

  await writeAudit(
    admin.id,
    input.userId,
    "student.profile.update",
    buildAuditDetails(before, parsed.data, [
      "timezone",
      "status",
      "coachId",
      "heightCm",
      "currentWeightKg",
      "targetWeightKg",
    ]),
  );
  revalidatePath(`/admin/users/${input.userId}`);
  return { ok: true };
}

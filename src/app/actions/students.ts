"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireCoach } from "@/lib/auth-guards";
import { createInvite } from "@/lib/invites";
import { originUrl } from "@/lib/origin";

export interface InviteResult {
  ok: boolean;
  error?: string;
  url?: string;
}

const inviteInput = z.object({
  name: z.string().min(1),
  email: z.string().email(),
});

// Coach invites a student by name + email. Creates a passwordless student user
// and returns a one-time set-password link for the coach to share.
export async function inviteStudent(
  input: z.infer<typeof inviteInput>,
): Promise<InviteResult> {
  const { coachId } = await requireCoach();
  const parsed = inviteInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Enter a name and valid email." };

  const email = parsed.data.email.trim().toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return { ok: false, error: "A user with that email already exists." };

  const user = await prisma.user.create({
    data: {
      email,
      name: parsed.data.name.trim(),
      role: "student",
      // Timezone is a placeholder until the student sets it at intake (FR-3).
      student: { create: { coachId, timezone: "UTC", status: "invited" } },
    },
  });

  const { token } = await createInvite(user.id);
  const url = await originUrl(`/set-password?token=${token}`);
  revalidatePath("/coach/students");
  return { ok: true, url };
}

// Issues a fresh set-password link for an existing student (e.g. link expired).
export async function resendInvite(studentId: string): Promise<InviteResult> {
  const { coachId } = await requireCoach();
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    select: { coachId: true, userId: true },
  });
  if (!student || student.coachId !== coachId)
    return { ok: false, error: "Student not found." };

  const { token } = await createInvite(student.userId);
  const url = await originUrl(`/set-password?token=${token}`);
  return { ok: true, url };
}

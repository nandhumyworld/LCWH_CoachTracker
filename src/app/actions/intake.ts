"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireStudent, requireCoach } from "@/lib/auth-guards";
import { writeProfilePanel } from "@/lib/profile-panel";

export interface ActionResult {
  ok: boolean;
  error?: string;
}

const intakeInput = z.object({
  timezone: z.string().min(1),
  heightCm: z.number().positive(),
  currentWeightKg: z.number().positive(),
  targetWeightKg: z.number().positive(),
});

// Validates an IANA timezone against the runtime's known zones.
function isValidTimezone(tz: string): boolean {
  try {
    // Throws RangeError for an unknown zone.
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

// Student completes intake once. Saves intake fields, activates the account,
// and generates the profile panel.
export async function submitIntake(
  input: z.infer<typeof intakeInput>,
): Promise<ActionResult> {
  const { studentId } = await requireStudent();
  const parsed = intakeInput.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  if (!isValidTimezone(parsed.data.timezone))
    return { ok: false, error: "Unknown timezone." };
  if (parsed.data.targetWeightKg > parsed.data.currentWeightKg)
    return { ok: false, error: "Target weight should not exceed current weight." };

  await prisma.student.update({
    where: { id: studentId },
    data: {
      timezone: parsed.data.timezone,
      heightCm: parsed.data.heightCm,
      currentWeightKg: parsed.data.currentWeightKg,
      targetWeightKg: parsed.data.targetWeightKg,
      intakeAt: new Date(),
      status: "active",
    },
  });

  await writeProfilePanel(studentId, parsed.data);
  revalidatePath("/student");
  return { ok: true };
}

// Coach regenerates a student's profile panel on demand (FR-5).
export async function regenerateProfile(studentId: string): Promise<ActionResult> {
  const { coachId } = await requireCoach();
  const student = await prisma.student.findUnique({ where: { id: studentId } });
  if (!student || student.coachId !== coachId)
    return { ok: false, error: "Student not found." };
  if (
    student.heightCm == null ||
    student.currentWeightKg == null ||
    student.targetWeightKg == null
  )
    return { ok: false, error: "Student has not completed intake yet." };

  await writeProfilePanel(studentId, {
    heightCm: student.heightCm,
    currentWeightKg: student.currentWeightKg,
    targetWeightKg: student.targetWeightKg,
  });
  revalidatePath(`/coach/students/${studentId}`);
  return { ok: true };
}

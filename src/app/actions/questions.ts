"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireCoach } from "@/lib/auth-guards";
import { QUESTION_TYPES, optionsSchemaFor, toKey } from "@/lib/questions";

export interface ActionResult {
  ok: boolean;
  error?: string;
  id?: string;
}

const baseInput = z.object({
  id: z.string().optional(),
  key: z.string().min(1),
  sectionTitle: z.string().min(1),
  orderIndex: z.number().int().nonnegative(),
  type: z.enum(QUESTION_TYPES),
  prompt: z.string().min(1),
  options: z.unknown().optional(),
  points: z.number().int().nonnegative().default(0),
  required: z.boolean().default(false),
  allowsImage: z.boolean().default(false),
  helpText: z.string().optional(),
});

// Create or update one question, scoped to the caller's coach.
export async function upsertQuestion(
  input: z.infer<typeof baseInput>,
): Promise<ActionResult> {
  const { coachId } = await requireCoach();
  const parsed = baseInput.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const data = parsed.data;

  // Validate the type-specific options payload.
  const optCheck = optionsSchemaFor(data.type).safeParse(data.options ?? {});
  if (!optCheck.success)
    return { ok: false, error: `Options invalid: ${optCheck.error.issues[0]?.message}` };

  const key = toKey(data.key);
  if (!key) return { ok: false, error: "Key must contain letters or digits." };

  const fields = {
    coachId,
    key,
    sectionTitle: data.sectionTitle,
    orderIndex: data.orderIndex,
    type: data.type,
    prompt: data.prompt,
    options: (optCheck.data ?? {}) as Prisma.InputJsonValue,
    points: data.points,
    required: data.required,
    allowsImage: data.allowsImage,
    helpText: data.helpText ?? null,
  };

  try {
    if (data.id) {
      // Ensure the target belongs to this coach before updating.
      const existing = await prisma.question.findUnique({ where: { id: data.id } });
      if (!existing || existing.coachId !== coachId)
        return { ok: false, error: "Question not found." };
      const updated = await prisma.question.update({ where: { id: data.id }, data: fields });
      revalidatePath("/coach/questions");
      return { ok: true, id: updated.id };
    }
    const created = await prisma.question.create({ data: fields });
    revalidatePath("/coach/questions");
    return { ok: true, id: created.id };
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002")
      return { ok: false, error: `The key "${key}" is already used by another question.` };
    throw err;
  }
}

// Persists a new ordering for the coach's questions.
export async function reorderQuestions(orderedIds: string[]): Promise<ActionResult> {
  const { coachId } = await requireCoach();
  const owned = await prisma.question.findMany({
    where: { coachId },
    select: { id: true },
  });
  const ownedSet = new Set(owned.map((q) => q.id));
  if (!orderedIds.every((id) => ownedSet.has(id)))
    return { ok: false, error: "Reorder contains a question you do not own." };

  await prisma.$transaction(
    orderedIds.map((id, index) =>
      prisma.question.update({ where: { id }, data: { orderIndex: index } }),
    ),
  );
  revalidatePath("/coach/questions");
  return { ok: true };
}

// Deletes one question owned by the caller.
export async function deleteQuestion(id: string): Promise<ActionResult> {
  const { coachId } = await requireCoach();
  const existing = await prisma.question.findUnique({ where: { id } });
  if (!existing || existing.coachId !== coachId)
    return { ok: false, error: "Question not found." };
  await prisma.question.delete({ where: { id } });
  revalidatePath("/coach/questions");
  return { ok: true };
}

const settingsInput = z.object({
  formDescription: z.string().optional(),
  submissionMessage: z.string().optional(),
});

// Upserts the coach's program-level form settings.
export async function updateProgramSettings(
  input: z.infer<typeof settingsInput>,
): Promise<ActionResult> {
  const { coachId } = await requireCoach();
  const parsed = settingsInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input." };
  await prisma.programSettings.upsert({
    where: { coachId },
    update: {
      formDescription: parsed.data.formDescription ?? null,
      submissionMessage: parsed.data.submissionMessage ?? null,
    },
    create: {
      coachId,
      formDescription: parsed.data.formDescription ?? null,
      submissionMessage: parsed.data.submissionMessage ?? null,
    },
  });
  revalidatePath("/coach/settings");
  return { ok: true };
}

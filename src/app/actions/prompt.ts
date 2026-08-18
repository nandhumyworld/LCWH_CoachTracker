"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth-guards";

export interface PromptActionResult {
  ok: boolean;
  error?: string;
  id?: string;
}

const input = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  body: z.string().min(1),
  modelId: z.string().min(1),
});

// Persists the AI report prompt template + model id (Admin-only, NFR-1/FR-26).
// Editing an existing template bumps its version. After saving, every coach's
// ProgramSettings is linked to this template so generateReport picks it up with
// no redeploy. In the single-coach MVP there is one template and one coach.
export async function updatePromptTemplate(
  raw: z.infer<typeof input>,
): Promise<PromptActionResult> {
  const user = await requireRole("admin");
  const parsed = input.safeParse(raw);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const { id, name, body, modelId } = parsed.data;

  const template = id
    ? await prisma.promptTemplate.update({
        where: { id },
        data: { name, body, modelId, updatedBy: user.email, version: { increment: 1 } },
      })
    : await prisma.promptTemplate.create({
        data: { name, body, modelId, updatedBy: user.email },
      });

  // Link every coach to this template (create ProgramSettings if missing).
  const coaches = await prisma.coach.findMany({ select: { id: true } });
  for (const c of coaches) {
    await prisma.programSettings.upsert({
      where: { coachId: c.id },
      update: { promptTemplateId: template.id },
      create: { coachId: c.id, promptTemplateId: template.id },
    });
  }

  revalidatePath("/admin/prompt");
  return { ok: true, id: template.id };
}

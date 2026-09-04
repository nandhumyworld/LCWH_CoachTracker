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
  kind: z.enum(["report", "extraction"]).default("report"),
  name: z.string().min(1),
  body: z.string().min(1),
  modelId: z.string().min(1),
});

// Persists a prompt template (report OR extraction) + its model (Admin-only,
// NFR-1/FR-26, CR-007). Editing bumps the version. After saving, every coach's
// ProgramSettings is linked to this template in the matching slot so the report
// / extraction pipeline picks it up with no redeploy.
export async function updatePromptTemplate(
  raw: z.infer<typeof input>,
): Promise<PromptActionResult> {
  const user = await requireRole("admin");
  const parsed = input.safeParse(raw);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const { id, kind, name, body, modelId } = parsed.data;

  const template = id
    ? await prisma.promptTemplate.update({
        where: { id },
        data: { name, body, modelId, kind, updatedBy: user.email, version: { increment: 1 } },
      })
    : await prisma.promptTemplate.create({
        data: { name, body, modelId, kind, updatedBy: user.email },
      });

  const linkField =
    kind === "extraction" ? "extractionTemplateId" : "promptTemplateId";

  const coaches = await prisma.coach.findMany({ select: { id: true } });
  for (const c of coaches) {
    await prisma.programSettings.upsert({
      where: { coachId: c.id },
      update: { [linkField]: template.id },
      create: { coachId: c.id, [linkField]: template.id },
    });
  }

  revalidatePath("/admin/prompt");
  return { ok: true, id: template.id };
}

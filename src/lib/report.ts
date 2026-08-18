import { prisma } from "@/lib/db";
import { getStorage } from "@/lib/storage";
import { env } from "@/lib/env";
import { fillPrompt, type PromptAnswer, type PromptContext } from "@/lib/prompt";
import { callOpenRouter, bufferToDataUrl } from "@/lib/openrouter";

// AI daily-report generation (spec §6, FR-26..30). Loads a submitted entry's
// answers + profile + images, fills the admin prompt template, calls OpenRouter
// (vision-capable, images as data URLs), and records the body + model + token
// usage + cost on the pending Report. Any failure is captured on the Report as
// `status=failed` + `error` so it can be retried from the Admin logs — the
// function does not throw, so callers (submit / auto-submit) never abort.

// Fallback prompt used until an Admin configures a PromptTemplate (Phase 6.3).
export const DEFAULT_PROMPT_BODY = `You are a supportive wellness coach's assistant. Using the client's daily check-in below, write a short, encouraging daily report (3-5 sentences). Note progress toward their goals and one concrete, kind suggestion for tomorrow. Do not invent data that is not provided.`;

const entryInclude = {
  answers: { include: { question: true, imageRef: true } },
  student: {
    include: {
      profilePanel: true,
      coach: {
        include: { programSettings: { include: { promptTemplate: true } } },
      },
    },
  },
} as const;

export async function generateReport(dailyEntryId: string): Promise<void> {
  const entry = await prisma.dailyEntry.findUnique({
    where: { id: dailyEntryId },
    include: entryInclude,
  });
  if (!entry) throw new Error(`DailyEntry ${dailyEntryId} not found.`);

  const template = entry.student.coach.programSettings?.promptTemplate ?? null;
  const body = template?.body ?? DEFAULT_PROMPT_BODY;
  const modelId = template?.modelId ?? env.OPENROUTER_DEFAULT_MODEL;

  try {
    const profile: PromptContext["profile"] = {
      bmi: entry.student.profilePanel?.bmi ?? null,
      bmr: entry.student.profilePanel?.bmr ?? null,
      weightToLoseKg: entry.student.profilePanel?.weightToLoseKg ?? null,
      currentWeight: entry.student.currentWeightKg ?? null,
      targetWeight: entry.student.targetWeightKg ?? null,
      height: entry.student.heightCm ?? null,
    };

    // Build answers keyed by question.key; image answers carry their image id.
    // Also index live (non-deleted) image bytes by id for the vision channel.
    const answers: Record<string, PromptAnswer> = {};
    const imageMeta = new Map<string, { storageKey: string; mimeType: string }>();
    for (const a of entry.answers) {
      const key = a.question.key;
      if (a.question.type === "image") {
        if (a.imageRefId) {
          answers[key] = { imageId: a.imageRefId };
          if (a.imageRef && !a.imageRef.deletedAt) {
            imageMeta.set(a.imageRefId, {
              storageKey: a.imageRef.storageKey,
              mimeType: a.imageRef.mimeType,
            });
          }
        }
      } else {
        answers[key] = a.value as PromptAnswer;
      }
    }

    const filled = fillPrompt(body, { profile, answers });

    const imageUrls: string[] = [];
    for (const vi of filled.images) {
      const meta = imageMeta.get(vi.imageId);
      if (!meta) continue; // expired/deleted or unknown — skip, don't fail
      const blob = await getStorage().get(meta.storageKey);
      if (!blob) continue;
      imageUrls.push(bufferToDataUrl(blob.body, blob.mimeType ?? meta.mimeType));
    }

    const result = await callOpenRouter({
      modelId,
      prompt: filled.text,
      images: imageUrls,
    });

    await prisma.report.update({
      where: { dailyEntryId },
      data: {
        body: result.text,
        modelId,
        promptTemplateId: template?.id ?? null,
        tokensIn: result.tokensIn,
        tokensOut: result.tokensOut,
        costEstimate: result.costEstimate,
        status: "done",
        error: null,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await prisma.report.update({
      where: { dailyEntryId },
      data: { status: "failed", error: message.slice(0, 1000), modelId },
    });
  }
}

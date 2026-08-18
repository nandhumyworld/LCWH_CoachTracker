import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getStorage } from "@/lib/storage";
import { fillPrompt, type PromptAnswer } from "@/lib/prompt";
import { callOpenRouter, bufferToDataUrl } from "@/lib/openrouter";
import { parseJsonObject, distributeDerived } from "@/lib/extraction-util";

// Image-extraction pass (CR-007). Fills the coach's editable extraction prompt
// with the day's photos, asks the model for structured JSON keyed by question
// key (e.g. { lunch_photo: { calories, items } }), and stores each result on the
// matching Answer.derived. No-op when no extraction template is configured or no
// referenced images exist. Best-effort: never throws (a failure just leaves
// `derived` unset so the report runs without it).

const entryInclude = {
  answers: { include: { question: true, imageRef: true } },
  student: {
    include: {
      coach: {
        include: { programSettings: { include: { extractionTemplate: true } } },
      },
    },
  },
} as const;

export async function runExtraction(dailyEntryId: string): Promise<void> {
  try {
    const entry = await prisma.dailyEntry.findUnique({
      where: { id: dailyEntryId },
      include: entryInclude,
    });
    if (!entry) return;

    const template = entry.student.coach.programSettings?.extractionTemplate ?? null;
    if (!template) return; // no extraction configured

    const answers: Record<string, PromptAnswer> = {};
    const imageMeta = new Map<string, { storageKey: string; mimeType: string }>();
    const answerIdByKey: Record<string, string> = {};
    for (const a of entry.answers) {
      const key = a.question.key;
      if (a.imageRefId) {
        answers[key] = { imageId: a.imageRefId };
        answerIdByKey[key] = a.id;
        if (a.imageRef && !a.imageRef.deletedAt) {
          imageMeta.set(a.imageRefId, {
            storageKey: a.imageRef.storageKey,
            mimeType: a.imageRef.mimeType,
          });
        }
      } else {
        answers[key] = a.value as PromptAnswer;
      }
    }

    const filled = fillPrompt(template.body, { profile: {}, answers });
    if (filled.images.length === 0) return; // nothing to analyze

    const imageUrls: string[] = [];
    for (const vi of filled.images) {
      const meta = imageMeta.get(vi.imageId);
      if (!meta) continue;
      const blob = await getStorage().get(meta.storageKey);
      if (!blob) continue;
      imageUrls.push(bufferToDataUrl(blob.body, blob.mimeType ?? meta.mimeType));
    }
    if (imageUrls.length === 0) return;

    const result = await callOpenRouter({
      modelId: template.modelId,
      prompt: filled.text,
      images: imageUrls,
    });
    const parsed = parseJsonObject(result.text);
    if (!parsed) return;

    // Only distribute results to answers whose image was referenced.
    const scoped: Record<string, string> = {};
    for (const vi of filled.images) {
      if (answerIdByKey[vi.questionKey]) scoped[vi.questionKey] = answerIdByKey[vi.questionKey];
    }

    for (const asg of distributeDerived(parsed, scoped)) {
      await prisma.answer.update({
        where: { id: asg.answerId },
        data: { derived: asg.derived as Prisma.InputJsonValue },
      });
    }
  } catch {
    // best-effort — leave derived unset, report still runs
  }
}

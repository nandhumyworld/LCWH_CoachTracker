import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getStorage } from "@/lib/storage";
import { callOpenRouter, bufferToDataUrl } from "@/lib/openrouter";
import { parseJsonObject, distributeDerived } from "@/lib/extraction-util";

// Image-extraction pass (CR-007 / CR-012). For every "meal" question (an
// image-type question), estimate structured values (e.g. { calories, items })
// from the student's PHOTO and their NOTE, and store the result on
// Answer.derived keyed by question key. Determination is automatic — all
// image-type questions are candidates. A meal with neither a photo nor a note
// is treated as "no meal logged" and never sent to the LLM. Best-effort: never
// throws.

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

// Derived value stored for a meal that had no photo and no note.
const NO_MEAL = { skipped: true, status: "no meal logged", calories: 0 } as const;

export async function runExtraction(dailyEntryId: string): Promise<void> {
  try {
    const entry = await prisma.dailyEntry.findUnique({
      where: { id: dailyEntryId },
      include: entryInclude,
    });
    if (!entry) return;

    const template = entry.student.coach.programSettings?.extractionTemplate ?? null;
    if (!template) return; // no extraction configured

    // Candidates = image-type ("meal") questions.
    const meals = entry.answers.filter((a) => a.question.type === "image");
    if (meals.length === 0) return;

    interface Target {
      key: string;
      answerId: string;
      note: string;
      storageKey: string | null;
      mimeType: string | null;
    }
    const toAnalyze: Target[] = [];
    const skippedIds: string[] = [];

    for (const a of meals) {
      const note = (a.note ?? "").trim();
      const hasImage = Boolean(a.imageRefId && a.imageRef && !a.imageRef.deletedAt);
      if (!hasImage && !note) {
        skippedIds.push(a.id); // no photo, no note → no meal
        continue;
      }
      toAnalyze.push({
        key: a.question.key,
        answerId: a.id,
        note,
        storageKey: hasImage ? a.imageRef!.storageKey : null,
        mimeType: hasImage ? a.imageRef!.mimeType : null,
      });
    }

    // Record the "no meal" answers without calling the model.
    for (const id of skippedIds) {
      await prisma.answer.update({
        where: { id },
        data: { derived: NO_MEAL as unknown as Prisma.InputJsonValue },
      });
    }

    if (toAnalyze.length === 0) return; // nothing worth analyzing

    // Build the request: the admin instruction body + a labeled line per meal
    // (with its note), and the photos as vision inputs in the same order.
    let prompt = template.body.trim() + "\n\nMeals to analyze (reply with JSON keyed by the label):\n";
    const imageUrls: string[] = [];
    const answerIdByKey: Record<string, string> = {};
    for (const t of toAnalyze) {
      answerIdByKey[t.key] = t.answerId;
      const noteText = t.note ? ` (note: ${t.note})` : "";
      if (t.storageKey) {
        const blob = await getStorage().get(t.storageKey);
        if (blob) {
          imageUrls.push(bufferToDataUrl(blob.body, blob.mimeType ?? t.mimeType ?? "image/jpeg"));
          prompt += `- ${t.key}${noteText}: [photo attached]\n`;
          continue;
        }
      }
      prompt += `- ${t.key}${noteText}: [no photo, estimate from the note]\n`;
    }

    const result = await callOpenRouter({
      modelId: template.modelId,
      prompt,
      images: imageUrls,
    });
    const parsed = parseJsonObject(result.text);
    if (!parsed) return;

    for (const asg of distributeDerived(parsed, answerIdByKey)) {
      await prisma.answer.update({
        where: { id: asg.answerId },
        data: { derived: asg.derived as Prisma.InputJsonValue },
      });
    }
  } catch {
    // best-effort — leave derived unset, report still runs
  }
}

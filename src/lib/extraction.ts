import { Prisma, type PromptTemplate } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getStorage } from "@/lib/storage";
import { callOpenRouter, bufferToDataUrl, pickImageMime } from "@/lib/openrouter";
import {
  parseJsonObject,
  distributeDerived,
  isNoMeal,
  NO_MEAL,
} from "@/lib/extraction-util";

// Image-extraction pass (CR-007 / CR-012). For every "meal" question (an
// image-type question), estimate structured values (e.g. { calories, items })
// from the student's PHOTO and their NOTE, and store the result on
// Answer.derived keyed by question key. Determination is automatic — all
// image-type questions are candidates. A meal with neither a photo nor a note
// is treated as "no meal logged" and never sent to the LLM. Best-effort: never
// throws.
//
// Two entry points share the same analysis core:
//   - runExtraction(dailyEntryId)        — the whole day's meals (report pipeline)
//   - runExtractionForAnswer(dailyEntryId, questionId) — one meal, on upload

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

// One meal to analyze: its question key, the answer id to write back to, the
// student's note, and (optionally) the stored photo.
interface Target {
  key: string;
  answerId: string;
  note: string;
  storageKey: string | null;
  mimeType: string | null;
}

// Sends one OpenRouter call for the given targets and writes each result to its
// Answer.derived. Returns the derived value keyed by answerId (empty on any
// failure). Never throws.
async function analyzeTargets(
  template: PromptTemplate,
  targets: Target[],
): Promise<Record<string, Record<string, unknown>>> {
  if (targets.length === 0) return {};

  // Build the request: the admin instruction body + a labeled line per meal
  // (with its note), and the photos as vision inputs in the same order.
  let prompt =
    template.body.trim() +
    "\n\nMeals to analyze (reply with JSON keyed by the label):\n";
  const imageUrls: string[] = [];
  const answerIdByKey: Record<string, string> = {};
  for (const t of targets) {
    answerIdByKey[t.key] = t.answerId;
    const noteText = t.note ? ` (note: ${t.note})` : "";
    if (t.storageKey) {
      const blob = await getStorage().get(t.storageKey);
      if (blob) {
        imageUrls.push(
          bufferToDataUrl(blob.body, pickImageMime(t.mimeType, blob.mimeType)),
        );
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
  if (!parsed) return {};

  const out: Record<string, Record<string, unknown>> = {};
  for (const asg of distributeDerived(parsed, answerIdByKey)) {
    await prisma.answer.update({
      where: { id: asg.answerId },
      data: { derived: asg.derived as Prisma.InputJsonValue },
    });
    out[asg.answerId] = asg.derived;
  }
  return out;
}

// Turns a loaded meal answer into a Target, or null when it's "no meal".
function toTarget(a: {
  id: string;
  note: string | null;
  imageRefId: string | null;
  imageRef: { deletedAt: Date | null; storageKey: string; mimeType: string } | null;
  question: { key: string };
}): Target | null {
  const note = (a.note ?? "").trim();
  const hasImage = Boolean(a.imageRefId && a.imageRef && !a.imageRef.deletedAt);
  if (isNoMeal({ hasImage, note })) return null;
  return {
    key: a.question.key,
    answerId: a.id,
    note,
    storageKey: hasImage ? a.imageRef!.storageKey : null,
    mimeType: hasImage ? a.imageRef!.mimeType : null,
  };
}

// Records a "no meal" marker on an answer without calling the model.
async function markNoMeal(answerId: string): Promise<Record<string, unknown>> {
  await prisma.answer.update({
    where: { id: answerId },
    data: { derived: NO_MEAL as unknown as Prisma.InputJsonValue },
  });
  return { ...NO_MEAL };
}

export async function runExtraction(dailyEntryId: string): Promise<void> {
  try {
    const entry = await prisma.dailyEntry.findUnique({
      where: { id: dailyEntryId },
      include: entryInclude,
    });
    if (!entry) return;

    const template =
      entry.student.coach.programSettings?.extractionTemplate ?? null;
    if (!template) return; // no extraction configured

    // Candidates = image-type ("meal") questions.
    const meals = entry.answers.filter((a) => a.question.type === "image");
    if (meals.length === 0) return;

    const toAnalyze: Target[] = [];
    for (const a of meals) {
      const target = toTarget(a);
      if (target) toAnalyze.push(target);
      else await markNoMeal(a.id); // no photo, no note → no meal
    }

    await analyzeTargets(template, toAnalyze);
  } catch {
    // best-effort — leave derived unset, report still runs
  }
}

// Single-meal extraction, run the moment a photo is uploaded (or re-uploaded)
// for an image-type question. Overwrites the answer's derived value and returns
// it so the caller can echo it back to the form. Best-effort: never throws;
// returns null when there's nothing to show (not a meal, no template, or the
// model failed).
export async function runExtractionForAnswer(
  dailyEntryId: string,
  questionId: string,
): Promise<Record<string, unknown> | null> {
  try {
    const answer = await prisma.answer.findUnique({
      where: { dailyEntryId_questionId: { dailyEntryId, questionId } },
      include: {
        question: true,
        imageRef: true,
        dailyEntry: {
          include: {
            student: {
              include: {
                coach: {
                  include: {
                    programSettings: { include: { extractionTemplate: true } },
                  },
                },
              },
            },
          },
        },
      },
    });
    if (!answer || answer.question.type !== "image") return null;

    const template =
      answer.dailyEntry.student.coach.programSettings?.extractionTemplate ?? null;
    if (!template) return null; // no extraction configured

    const target = toTarget(answer);
    if (!target) return markNoMeal(answer.id);

    const results = await analyzeTargets(template, [target]);
    return results[answer.id] ?? null;
  } catch {
    return null; // best-effort
  }
}

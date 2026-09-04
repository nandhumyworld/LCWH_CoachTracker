import { prisma } from "@/lib/db";
import { getStorage } from "@/lib/storage";
import { getDefaultModel } from "@/lib/settings";
import { fillPrompt, type PromptAnswer, type PromptContext } from "@/lib/prompt";
import { callOpenRouter, bufferToDataUrl, pickImageMime } from "@/lib/openrouter";
import { runExtraction } from "@/lib/extraction";
import { summarizeIntake } from "@/lib/intake-util";

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
  // Model: coach's template → admin default setting → env default.
  const modelId = template?.modelId ?? (await getDefaultModel());

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
    // Also index live (non-deleted) image bytes by id for the vision channel,
    // and collect AI-extracted values (Answer.derived) for {{q.key.field}}.
    const answers: Record<string, PromptAnswer> = {};
    const derived: Record<string, Record<string, unknown>> = {};
    const imageMeta = new Map<string, { storageKey: string; mimeType: string }>();
    for (const a of entry.answers) {
      const key = a.question.key;
      // Only a true photo question (type "image", e.g. lunch_photo) becomes a
      // vision input. Other question types keep their typed/selected value even
      // when a proof photo is attached — e.g. the weight photo is coach proof,
      // but {{q.today_weight}} must still resolve to the typed number, not the
      // image marker.
      if (a.question.type === "image" && a.imageRefId) {
        answers[key] = { imageId: a.imageRefId };
        if (a.imageRef && !a.imageRef.deletedAt) {
          imageMeta.set(a.imageRefId, {
            storageKey: a.imageRef.storageKey,
            mimeType: a.imageRef.mimeType,
          });
        }
      } else {
        answers[key] = a.value as PromptAnswer;
      }
      if (a.derived && typeof a.derived === "object" && !Array.isArray(a.derived)) {
        derived[key] = a.derived as Record<string, unknown>;
      }
    }

    // Deterministic intake math (small models add unreliably, so compute it):
    // meal calories from AI extraction + a fixed 200 kcal / 20 g per shake taken
    // (any question whose key contains "shake", answered "Yes"). Exposed as
    // profile.* placeholders the prompt just states verbatim.
    const mealCalories = entry.answers
      .filter((a) => a.question.type === "image")
      .map((a) => {
        const c = derived[a.question.key]?.calories;
        return typeof c === "number" ? c : 0;
      });
    const shakeAnswers = entry.answers
      .filter((a) => a.question.key.toLowerCase().includes("shake"))
      .map((a) => a.value);
    const intake = summarizeIntake({ mealCalories, shakeAnswers });
    profile.totalCalories = intake.totalCalories;
    profile.mealCalories = intake.mealCalories;
    profile.shakeCalories = intake.shakeCalories;
    profile.shakeProteinG = intake.shakeProteinG;
    profile.shakesTaken = intake.shakesTaken;

    const filled = fillPrompt(body, { profile, answers, derived });

    const imageUrls: string[] = [];
    for (const vi of filled.images) {
      const meta = imageMeta.get(vi.imageId);
      if (!meta) continue; // expired/deleted or unknown — skip, don't fail
      const blob = await getStorage().get(meta.storageKey);
      if (!blob) continue;
      imageUrls.push(bufferToDataUrl(blob.body, pickImageMime(meta.mimeType, blob.mimeType)));
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

// Full daily pipeline (CR-007): run the image-extraction pass first (populates
// Answer.derived, best-effort), then generate the report so it can reference the
// extracted values. Used by submit + auto-submit; regeneration can call either
// stage independently.
export async function runReportPipeline(dailyEntryId: string): Promise<void> {
  await runExtraction(dailyEntryId);
  await generateReport(dailyEntryId);
}

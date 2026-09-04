"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireStudent } from "@/lib/auth-guards";
import { saveAnswer, EntryLockedError } from "@/lib/daily-entry";
import { validateAnswerValue, type QuestionLike } from "@/lib/questions";
import { runReportPipeline } from "@/lib/report";

export interface SaveResult {
  ok: boolean;
  error?: string;
}

// Confirms the entry belongs to the calling student; returns its status.
async function ownedEntry(dailyEntryId: string, studentId: string) {
  const entry = await prisma.dailyEntry.findUnique({
    where: { id: dailyEntryId },
    select: { id: true, studentId: true, status: true },
  });
  if (!entry || entry.studentId !== studentId) return null;
  return entry;
}

// Persists one answer as the student edits (autosave). Locked entries reject.
// Only the fields present on `input` are written (partial), so a value edit and
// a note edit (CR-005) don't overwrite each other.
export async function saveAnswerAction(input: {
  dailyEntryId: string;
  questionId: string;
  value?: unknown;
  note?: string | null;
}): Promise<SaveResult> {
  const { studentId } = await requireStudent();
  const entry = await ownedEntry(input.dailyEntryId, studentId);
  if (!entry) return { ok: false, error: "Entry not found." };

  const patch: {
    dailyEntryId: string;
    questionId: string;
    value?: unknown;
    note?: string | null;
  } = { dailyEntryId: input.dailyEntryId, questionId: input.questionId };
  if ("value" in input) patch.value = input.value;
  if ("note" in input) patch.note = input.note ?? null;

  try {
    await saveAnswer(patch);
    return { ok: true };
  } catch (err) {
    if (err instanceof EntryLockedError) return { ok: false, error: err.message };
    throw err;
  }
}

export interface SubmitResult {
  ok: boolean;
  error?: string;
  missing?: string[]; // question prompts that failed validation
}

// Locks the day and enqueues report generation. Validates required answers;
// on success sets status=submitted and creates a pending Report.
export async function submitEntryAction(
  dailyEntryId: string,
): Promise<SubmitResult> {
  const { studentId, coachId } = await requireStudent();
  const entry = await ownedEntry(dailyEntryId, studentId);
  if (!entry) return { ok: false, error: "Entry not found." };
  if (entry.status !== "open") return { ok: true }; // idempotent

  const [questions, answers] = await Promise.all([
    prisma.question.findMany({ where: { coachId } }),
    prisma.answer.findMany({ where: { dailyEntryId } }),
  ]);
  const byQ = new Map(answers.map((a) => [a.questionId, a]));

  const missing: string[] = [];
  for (const q of questions) {
    const a = byQ.get(q.id);
    const value =
      q.type === "image" ? (a?.imageRefId ?? undefined) : (a?.value ?? undefined);
    const res = validateAnswerValue(
      { type: q.type, options: q.options, required: q.required } as QuestionLike,
      value,
    );
    if (!res.ok) missing.push(q.prompt);
  }
  if (missing.length > 0)
    return { ok: false, error: "Some required questions need an answer.", missing };

  await prisma.$transaction([
    prisma.dailyEntry.update({
      where: { id: dailyEntryId },
      data: { status: "submitted", submittedAt: new Date() },
    }),
    prisma.report.upsert({
      where: { dailyEntryId },
      update: {},
      create: { dailyEntryId, status: "pending" },
    }),
  ]);

  // Run the AI pipeline (image extraction → report). It records its own
  // success/failure on the Report row and never throws, so a generation error
  // still leaves the day submitted (the report is retryable from Admin logs).
  await runReportPipeline(dailyEntryId);

  revalidatePath("/student/today");
  revalidatePath("/student"); // dashboard progress reflects the new weight (CR-011)
  return { ok: true };
}

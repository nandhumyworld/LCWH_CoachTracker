import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { localDateFor } from "@/lib/day";
import { canEditEntry, localDateToUtc } from "@/lib/daily-entry-util";

// Ensures a DailyEntry exists for the given student's local date (creating it
// lazily the first time they open the form that day), and returns it.
export async function getOrCreateEntryForDate(
  studentId: string,
  localDate: string,
) {
  return prisma.dailyEntry.upsert({
    where: {
      studentId_localDate: { studentId, localDate: localDateToUtc(localDate) },
    },
    update: {},
    create: {
      studentId,
      localDate: localDateToUtc(localDate),
      status: "open",
    },
  });
}

// The entry for the student's current local date.
export async function getOrCreateTodayEntry(studentId: string) {
  const student = await prisma.student.findUniqueOrThrow({
    where: { id: studentId },
    select: { timezone: true },
  });
  return getOrCreateEntryForDate(studentId, localDateFor(student.timezone));
}

export class EntryLockedError extends Error {
  constructor() {
    super("This day is already submitted and can no longer be edited.");
    this.name = "EntryLockedError";
  }
}

export interface SaveAnswerInput {
  dailyEntryId: string;
  questionId: string;
  value?: unknown;
  note?: string | null;
  imageRefId?: string | null;
}

// Upserts a single answer, rejecting writes to a locked (non-open) entry.
export async function saveAnswer(input: SaveAnswerInput) {
  const entry = await prisma.dailyEntry.findUniqueOrThrow({
    where: { id: input.dailyEntryId },
    select: { status: true, studentId: true },
  });
  if (!canEditEntry(entry.status)) throw new EntryLockedError();

  const value =
    input.value === undefined
      ? Prisma.JsonNull
      : (input.value as Prisma.InputJsonValue);

  return prisma.answer.upsert({
    where: {
      dailyEntryId_questionId: {
        dailyEntryId: input.dailyEntryId,
        questionId: input.questionId,
      },
    },
    update: { value, note: input.note ?? null, imageRefId: input.imageRefId ?? null },
    create: {
      dailyEntryId: input.dailyEntryId,
      questionId: input.questionId,
      value,
      note: input.note ?? null,
      imageRefId: input.imageRefId ?? null,
    },
  });
}

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
//
// PARTIAL update: only the fields explicitly present on `input` are written, so
// saving a value never clobbers a sibling note/photo and vice versa. This lets
// value, note (CR-005), and a supplemental image (CR-006) coexist on one answer.
export async function saveAnswer(input: SaveAnswerInput) {
  const entry = await prisma.dailyEntry.findUniqueOrThrow({
    where: { id: input.dailyEntryId },
    select: { status: true, studentId: true },
  });
  if (!canEditEntry(entry.status)) throw new EntryLockedError();

  const patch: {
    value?: Prisma.InputJsonValue | typeof Prisma.JsonNull;
    note?: string | null;
    imageRefId?: string | null;
  } = {};
  if ("value" in input) {
    patch.value =
      input.value === undefined
        ? Prisma.JsonNull
        : (input.value as Prisma.InputJsonValue);
  }
  if ("note" in input) patch.note = input.note ?? null;
  if ("imageRefId" in input) patch.imageRefId = input.imageRefId ?? null;

  return prisma.answer.upsert({
    where: {
      dailyEntryId_questionId: {
        dailyEntryId: input.dailyEntryId,
        questionId: input.questionId,
      },
    },
    update: patch,
    create: {
      dailyEntryId: input.dailyEntryId,
      questionId: input.questionId,
      ...patch,
    },
  });
}

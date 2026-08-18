import { prisma } from "@/lib/db";
import { localDateFor } from "@/lib/day";
import { localDateToUtc } from "@/lib/daily-entry-util";
import { isSchedulableDate } from "@/lib/gate-util";
import type { DailyGateMessage } from "@prisma/client";

// Daily login-gate message + attendance (spec §8, FR-19..25). A coach schedules
// at most one message per calendar date (unique [coachId, scheduledDate]); each
// student sees the message for their own local date and must acknowledge it,
// which records attendance.

export interface ScheduleGateInput {
  coachId: string;
  scheduledDate: string; // "YYYY-MM-DD"
  bodyText: string;
  imageRefId?: string | null;
  ackButtonLabel?: string;
}

export type ScheduleGateResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

// Coach window "today" has no per-coach timezone in the schema, so the ≤7-day
// bound is computed in UTC (a convenience bound, not the hard student day-lock).
export async function scheduleGateMessage(
  input: ScheduleGateInput,
  now: Date = new Date(),
): Promise<ScheduleGateResult> {
  const body = input.bodyText.trim();
  if (!body) return { ok: false, error: "Message text is required." };
  if (!isSchedulableDate(input.scheduledDate, localDateFor("UTC", now)))
    return { ok: false, error: "Pick a date from today up to a week ahead." };

  const date = localDateToUtc(input.scheduledDate);
  const data = {
    bodyText: body,
    imageRefId: input.imageRefId ?? null,
    ackButtonLabel: input.ackButtonLabel?.trim() || "I acknowledge",
  };
  const row = await prisma.dailyGateMessage.upsert({
    where: { coachId_scheduledDate: { coachId: input.coachId, scheduledDate: date } },
    update: data,
    create: { coachId: input.coachId, scheduledDate: date, ...data },
  });
  return { ok: true, id: row.id };
}

// Deletes a scheduled gate message (coach-scoped). Editing content reuses
// scheduleGateMessage (upsert by date); this removes one entirely (CR-015).
export async function deleteGateMessage(
  coachId: string,
  gateMessageId: string,
): Promise<{ ok: boolean; error?: string }> {
  const msg = await prisma.dailyGateMessage.findUnique({
    where: { id: gateMessageId },
    select: { coachId: true },
  });
  if (!msg || msg.coachId !== coachId) return { ok: false, error: "Message not found." };
  await prisma.dailyGateMessage.delete({ where: { id: gateMessageId } });
  return { ok: true };
}

export interface GateForToday {
  message: DailyGateMessage | null;
  acknowledged: boolean;
}

// The gate the student must clear today, and whether they have acknowledged it.
// No message scheduled for the student's local date ⇒ { message: null } (FR-24).
export async function gateForStudentToday(
  studentId: string,
  now: Date = new Date(),
): Promise<GateForToday> {
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    select: { coachId: true, timezone: true },
  });
  if (!student) return { message: null, acknowledged: false };

  const localDate = localDateToUtc(localDateFor(student.timezone, now));
  const message = await prisma.dailyGateMessage.findUnique({
    where: {
      coachId_scheduledDate: { coachId: student.coachId, scheduledDate: localDate },
    },
  });
  if (!message) return { message: null, acknowledged: false };

  const ack = await prisma.gateAcknowledgement.findUnique({
    where: { gateMessageId_studentId: { gateMessageId: message.id, studentId } },
    select: { id: true },
  });
  return { message, acknowledged: ack !== null };
}

// Records the student's acknowledgement = attendance (FR-23/25). Idempotent:
// the unique (gateMessageId, studentId) makes a repeat ack a no-op.
export async function acknowledgeGate(
  gateMessageId: string,
  studentId: string,
  now: Date = new Date(),
): Promise<void> {
  await prisma.gateAcknowledgement.upsert({
    where: { gateMessageId_studentId: { gateMessageId, studentId } },
    update: {},
    create: { gateMessageId, studentId, acknowledgedAt: now },
  });
}

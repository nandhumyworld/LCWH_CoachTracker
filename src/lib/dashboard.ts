// Pure presentation helpers for the coach dashboard (no Prisma import) so the
// status/label logic is unit-testable. The pages do the DB reads.

import type { DailyEntryStatusLike } from "@/lib/daily-entry-util";

type ReportStatusLike = "pending" | "done" | "failed";

// Human label for a student's daily-entry status today; null = no entry yet.
export function todayStatusLabel(status: DailyEntryStatusLike | null): string {
  switch (status) {
    case "open":
      return "In progress";
    case "submitted":
      return "Submitted";
    case "auto_submitted":
      return "Auto-submitted";
    case "missed":
      return "Missed";
    default:
      return "Not started";
  }
}

// Human label for a report's generation status; null = no report row.
export function reportStatusLabel(status: ReportStatusLike | null): string {
  switch (status) {
    case "pending":
      return "Generating…";
    case "done":
      return "Ready";
    case "failed":
      return "Failed";
    default:
      return "—";
  }
}

interface AnswerLike {
  question: { key: string; type: string };
  value: unknown;
}

// The numeric value the student logged for the weight question (default key
// "weight"), or null when absent/non-numeric. Used for the roster's latest
// weight column.
export function pickWeight(answers: AnswerLike[], key = "weight"): number | null {
  const a = answers.find((x) => x.question.key === key);
  return typeof a?.value === "number" ? a.value : null;
}

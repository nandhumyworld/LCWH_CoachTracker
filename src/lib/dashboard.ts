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

// Human summary of an answer's AI-extracted values (Answer.derived, CR-007/009),
// e.g. "≈650 kcal · rice, dal". Null when there's nothing to show.
export function formatDerived(derived: unknown): string | null {
  if (!derived || typeof derived !== "object" || Array.isArray(derived)) return null;
  const d = derived as Record<string, unknown>;
  const parts: string[] = [];
  if (typeof d.calories === "number") parts.push(`≈${d.calories} kcal`);
  if (Array.isArray(d.items) && d.items.length > 0) parts.push(d.items.join(", "));
  for (const [k, v] of Object.entries(d)) {
    if (k === "calories" || k === "items") continue;
    if (typeof v === "string" || typeof v === "number") parts.push(`${k}: ${v}`);
  }
  return parts.length > 0 ? parts.join(" · ") : null;
}

// Pure helpers for the auto-submit sweep (no Prisma import) so they unit-test.

export type AutoSubmitStatus = "auto_submitted" | "missed";

// A day with no entered answers is "missed"; otherwise it is auto-submitted
// with whatever was entered (spec §7).
export function finalStatusForAutoSubmit(answerCount: number): AutoSubmitStatus {
  return answerCount > 0 ? "auto_submitted" : "missed";
}

// A Prisma `@db.Date` value is a JS Date at UTC midnight for that calendar date
// (we store it via localDateToUtc). Render it back to "YYYY-MM-DD".
export function dbDateToLocalDateString(d: Date): string {
  return d.toISOString().slice(0, 10);
}

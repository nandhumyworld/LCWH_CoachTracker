// Pure helpers for daily entries (no Prisma import) so they unit-test cleanly.

export type DailyEntryStatusLike =
  | "open"
  | "submitted"
  | "auto_submitted"
  | "missed";

// A student may only edit answers while the entry is still open (FR-14).
export function canEditEntry(status: DailyEntryStatusLike): boolean {
  return status === "open";
}

// Prisma `@db.Date` columns store a calendar date; represent it as UTC-midnight
// so reads/writes round-trip consistently regardless of server timezone.
export function localDateToUtc(localDate: string): Date {
  return new Date(`${localDate}T00:00:00.000Z`);
}

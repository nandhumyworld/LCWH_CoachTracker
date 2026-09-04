// Pure helpers for the daily login-gate message (no Prisma import) so the
// scheduling window is unit-testable. IO lives in src/lib/gate.ts.

// A coach may pre-schedule a gate message for today up to a week ahead
// (spec §8, FR-20): one message per calendar date.
export const MAX_SCHEDULE_DAYS_AHEAD = 7;

// Whole calendar days from `from` to `to` (both "YYYY-MM-DD"). Negative when
// `to` is earlier. Uses UTC midnight so DST never shifts the count.
export function daysBetweenLocalDates(from: string, to: string): number {
  const a = Date.parse(`${from}T00:00:00.000Z`);
  const b = Date.parse(`${to}T00:00:00.000Z`);
  return Math.round((b - a) / 86_400_000);
}

// True when `target` is today..+MAX_SCHEDULE_DAYS_AHEAD relative to `today`.
export function isSchedulableDate(target: string, today: string): boolean {
  const delta = daysBetweenLocalDates(today, target);
  return delta >= 0 && delta <= MAX_SCHEDULE_DAYS_AHEAD;
}

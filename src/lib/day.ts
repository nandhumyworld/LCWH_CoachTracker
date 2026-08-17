import { formatInTimeZone, fromZonedTime } from "date-fns-tz";

// All day-boundary logic is computed in the student's own IANA timezone
// (spec §7, FR-16). Never use server local time here.

// The student's local calendar date ("YYYY-MM-DD") for an instant.
export function localDateFor(tz: string, at: Date = new Date()): string {
  return formatInTimeZone(at, tz, "yyyy-MM-dd");
}

// The UTC instant of 23:59:59.999 on `localDate` in `tz` — the auto-submit
// cutoff for that day.
function cutoffInstant(tz: string, localDate: string): Date {
  // Interpret the wall-clock time as being in `tz`, convert to a UTC instant.
  return fromZonedTime(`${localDate}T23:59:59.999`, tz);
}

// True once `at` has reached/passed 23:59:59.999 of `localDate` in `tz`.
export function isPastLocalCutoff(
  tz: string,
  localDate: string,
  at: Date = new Date(),
): boolean {
  return at.getTime() >= cutoffInstant(tz, localDate).getTime();
}

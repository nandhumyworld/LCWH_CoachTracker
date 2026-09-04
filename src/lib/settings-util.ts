// Pure helpers for admin system settings (no Prisma import) so parsing/fallback
// logic is unit-testable. IO lives in src/lib/settings.ts.

// Keys stored in the SystemSetting key/value table (spec §10).
export const SETTING_KEYS = {
  photoRetentionDays: "photo_retention_days",
  openrouterDefaultModel: "openrouter_default_model",
  // Admin testing clock (CR-017): a signed millisecond offset added to real
  // time so the whole app can be moved to a simulated "now". 0 / unset = real
  // time. Stored as ms rather than a fixed instant so the clock keeps ticking.
  clockOffsetMs: "clock_offset_ms",
} as const;

// Parses the stored clock offset into a signed integer of milliseconds,
// defaulting to 0 (real time) when missing or malformed.
export function parseClockOffsetMs(raw: string | null): number {
  if (!raw) return 0;
  const trimmed = raw.trim();
  if (!/^-?\d+$/.test(trimmed)) return 0;
  const n = Number(trimmed);
  return Number.isSafeInteger(n) ? n : 0;
}

// The offset that makes `realNow` read as `targetMs`. Returns 0 when the target
// is not a valid instant (caller should treat that as "keep real time").
export function computeClockOffsetMs(targetMs: number, realNowMs: number): number {
  if (!Number.isFinite(targetMs)) return 0;
  return Math.trunc(targetMs - realNowMs);
}

// Parses a stored retention-days string into a positive integer, falling back
// to `fallback` (the env default) when missing or invalid.
export function parseRetentionDays(raw: string | null, fallback: number): number {
  if (!raw) return fallback;
  if (!/^\d+$/.test(raw.trim())) return fallback;
  const n = Number(raw.trim());
  return Number.isInteger(n) && n > 0 ? n : fallback;
}

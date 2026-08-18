// Pure helpers for admin system settings (no Prisma import) so parsing/fallback
// logic is unit-testable. IO lives in src/lib/settings.ts.

// Keys stored in the SystemSetting key/value table (spec §10).
export const SETTING_KEYS = {
  photoRetentionDays: "photo_retention_days",
  openrouterDefaultModel: "openrouter_default_model",
} as const;

// Parses a stored retention-days string into a positive integer, falling back
// to `fallback` (the env default) when missing or invalid.
export function parseRetentionDays(raw: string | null, fallback: number): number {
  if (!raw) return fallback;
  if (!/^\d+$/.test(raw.trim())) return fallback;
  const n = Number(raw.trim());
  return Number.isInteger(n) && n > 0 ? n : fallback;
}

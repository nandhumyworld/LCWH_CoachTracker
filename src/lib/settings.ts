import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { SETTING_KEYS, parseRetentionDays } from "@/lib/settings-util";

// Typed get/set over the SystemSetting key/value table with env fallbacks
// (spec §10). Lets an Admin change photo retention + the default AI model with
// no redeploy (NFR-1).

export async function getSetting(key: string): Promise<string | null> {
  const row = await prisma.systemSetting.findUnique({ where: { key } });
  return row?.value ?? null;
}

export async function setSetting(key: string, value: string): Promise<void> {
  await prisma.systemSetting.upsert({
    where: { key },
    update: { value },
    create: { key, value },
  });
}

// Effective photo-retention days: SystemSetting → env default.
export async function getPhotoRetentionDays(): Promise<number> {
  const raw = await getSetting(SETTING_KEYS.photoRetentionDays);
  return parseRetentionDays(raw, env.PHOTO_RETENTION_DAYS);
}

// Effective default OpenRouter model: SystemSetting → env default.
export async function getDefaultModel(): Promise<string> {
  const raw = await getSetting(SETTING_KEYS.openrouterDefaultModel);
  return raw && raw.trim() ? raw.trim() : env.OPENROUTER_DEFAULT_MODEL;
}

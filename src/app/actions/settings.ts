"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth-guards";
import { setSetting } from "@/lib/settings";
import { SETTING_KEYS } from "@/lib/settings-util";

export interface SettingsResult {
  ok: boolean;
  error?: string;
}

const input = z.object({
  photoRetentionDays: z.number().int().positive("Retention must be a positive whole number."),
  openrouterDefaultModel: z.string().min(1, "Default model is required."),
});

// Persists admin system settings (photo retention days + default AI model).
// Read back via getPhotoRetentionDays / getDefaultModel with env fallback — no
// redeploy needed (NFR-1, spec §10).
export async function updateSystemSettings(
  raw: z.infer<typeof input>,
): Promise<SettingsResult> {
  await requireRole("admin");
  const parsed = input.safeParse(raw);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };

  await setSetting(SETTING_KEYS.photoRetentionDays, String(parsed.data.photoRetentionDays));
  await setSetting(SETTING_KEYS.openrouterDefaultModel, parsed.data.openrouterDefaultModel.trim());

  revalidatePath("/admin/settings");
  return { ok: true };
}

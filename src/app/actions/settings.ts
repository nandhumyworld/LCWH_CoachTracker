"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth-guards";
import { setSetting } from "@/lib/settings";
import { SETTING_KEYS } from "@/lib/settings-util";
import { setSimulatedNow, clearSimulatedClock } from "@/lib/clock";
import { runAutoSubmit } from "@/lib/auto-submit";

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

// --- Admin testing clock (CR-017) --------------------------------------------
// Move the whole app to a simulated "now" (or back to real time) so scheduled
// behaviour — daily gate messages, the auto-submit cutoff, day rollover — can be
// tested without waiting for real calendar days. Admin-only. The client sends an
// absolute epoch-millisecond target (computed in the admin's own browser) to
// avoid server/browser timezone ambiguity.

export async function setSimulatedClockAction(
  targetMs: number,
): Promise<SettingsResult> {
  await requireRole("admin");
  if (!Number.isFinite(targetMs))
    return { ok: false, error: "Pick a valid date and time." };
  await setSimulatedNow(new Date(targetMs));
  // The clock affects "today" on every page, so revalidate the whole app.
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function resetSimulatedClockAction(): Promise<SettingsResult> {
  await requireRole("admin");
  await clearSimulatedClock();
  revalidatePath("/", "layout");
  return { ok: true };
}

// Manually run the auto-submit sweep now (what n8n calls on a schedule), so an
// admin can test it immediately at the current simulated clock instead of
// waiting for the cron. Admin-only.
export interface AutoSubmitActionResult {
  ok: boolean;
  scanned?: number;
  processed?: number;
  error?: string;
}

export async function runAutoSubmitNowAction(): Promise<AutoSubmitActionResult> {
  await requireRole("admin");
  const summary = await runAutoSubmit();
  revalidatePath("/", "layout");
  return { ok: true, ...summary };
}

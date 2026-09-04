import { requireRole } from "@/lib/auth-guards";
import { getPhotoRetentionDays, getDefaultModel } from "@/lib/settings";
import { getNow, isClockSimulated } from "@/lib/clock";
import { SettingsForm } from "./SettingsForm";
import { ClockPanel } from "./ClockPanel";

// Admin system settings: photo retention days + default OpenRouter model, plus a
// testing clock. Values shown are the effective ones (SystemSetting → env).
export default async function AdminSettingsPage() {
  await requireRole("admin");
  const [retentionDays, defaultModel, now, simulated] = await Promise.all([
    getPhotoRetentionDays(),
    getDefaultModel(),
    getNow(),
    isClockSimulated(),
  ]);

  return (
    <main className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground">
          Changes take effect immediately — no redeploy.
        </p>
      </div>
      <SettingsForm retentionDays={retentionDays} defaultModel={defaultModel} />
      <ClockPanel effectiveNowMs={now.getTime()} simulated={simulated} />
    </main>
  );
}

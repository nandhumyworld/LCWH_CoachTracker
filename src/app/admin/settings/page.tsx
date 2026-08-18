import { requireRole } from "@/lib/auth-guards";
import { getPhotoRetentionDays, getDefaultModel } from "@/lib/settings";
import { SettingsForm } from "./SettingsForm";

// Admin system settings: photo retention days + default OpenRouter model.
// Values shown are the effective ones (SystemSetting → env fallback).
export default async function AdminSettingsPage() {
  await requireRole("admin");
  const [retentionDays, defaultModel] = await Promise.all([
    getPhotoRetentionDays(),
    getDefaultModel(),
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
    </main>
  );
}

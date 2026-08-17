import { requireCoach } from "@/lib/auth-guards";
import { prisma } from "@/lib/db";
import { SettingsForm } from "./SettingsForm";

// Coach form-level settings: description shown atop the daily form + the
// custom submission/thank-you message.
export default async function SettingsPage() {
  const { coachId } = await requireCoach();
  const settings = await prisma.programSettings.findUnique({ where: { coachId } });

  return (
    <main className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Form settings</h1>
        <p className="text-muted-foreground">
          Shown to students on the daily check-in form.
        </p>
      </div>
      <SettingsForm
        formDescription={settings?.formDescription ?? ""}
        submissionMessage={settings?.submissionMessage ?? ""}
      />
    </main>
  );
}

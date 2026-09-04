import { redirect } from "next/navigation";
import { requireStudent } from "@/lib/auth-guards";
import { IntakeForm } from "./IntakeForm";

// Supported IANA timezones from the runtime; falls back to a small list if the
// runtime does not expose supportedValuesOf.
function timezones(): string[] {
  const anyIntl = Intl as unknown as {
    supportedValuesOf?: (k: string) => string[];
  };
  return anyIntl.supportedValuesOf?.("timeZone") ?? ["UTC", "Asia/Kolkata"];
}

export default async function IntakePage() {
  const { intakeComplete } = await requireStudent();
  if (intakeComplete) redirect("/student");

  return (
    <main className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Welcome — quick setup</h1>
        <p className="text-muted-foreground">
          Tell us a few things so we can tailor your daily reports.
        </p>
      </div>
      <IntakeForm timezones={timezones()} />
    </main>
  );
}

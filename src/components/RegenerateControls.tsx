"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { regenerateReportAction, type RegenStage } from "@/app/actions/report";
import { Button } from "@/components/ui/button";

// Coach/admin regeneration for a day (CR-010): re-run the report, re-run image
// extraction, or both — after editing a prompt/model in /admin/prompt.
export function RegenerateControls({ dailyEntryId }: { dailyEntryId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState<RegenStage | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  function run(stage: RegenStage, label: string) {
    setStatus(null);
    setBusy(stage);
    startTransition(async () => {
      const res = await regenerateReportAction({ dailyEntryId, stage });
      setBusy(null);
      if (res.ok) {
        setStatus(`${label} done.`);
        router.refresh();
      } else {
        setStatus(res.error ?? "Failed.");
      }
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        size="sm"
        variant="outline"
        disabled={pending}
        onClick={() => run("report", "Report")}
      >
        {busy === "report" ? "Regenerating…" : "Regenerate report"}
      </Button>
      <Button
        size="sm"
        variant="outline"
        disabled={pending}
        onClick={() => run("extraction", "Extraction")}
      >
        {busy === "extraction" ? "Re-running…" : "Re-run extraction"}
      </Button>
      <Button
        size="sm"
        variant="outline"
        disabled={pending}
        onClick={() => run("both", "Regenerate")}
      >
        {busy === "both" ? "Working…" : "Both"}
      </Button>
      {status && <span className="text-xs text-muted-foreground">{status}</span>}
    </div>
  );
}

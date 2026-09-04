"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { resetEntryAction } from "@/app/actions/report";
import { Button } from "@/components/ui/button";

// Coach/admin: clear a day's answers, report, and photos and reopen it so the
// student can submit again. Useful for re-testing scenarios on the same day.
export function ResetEntryButton({ dailyEntryId }: { dailyEntryId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<string | null>(null);

  function reset() {
    if (
      !window.confirm(
        "Reset this day? This deletes the answers, report, and uploaded photos, and reopens the day for the student. This cannot be undone.",
      )
    )
      return;
    setStatus(null);
    startTransition(async () => {
      const res = await resetEntryAction({ dailyEntryId });
      if (res.ok) {
        setStatus("Reset — the day is open again.");
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
        variant="destructive"
        disabled={pending}
        onClick={reset}
      >
        {pending ? "Resetting…" : "Reset day"}
      </Button>
      {status && <span className="text-xs text-muted-foreground">{status}</span>}
    </div>
  );
}

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { retryReport } from "@/app/actions/report";
import { Button } from "@/components/ui/button";

// Re-runs AI generation for a failed report (admin). Refreshes the log on done.
export function RetryButton({ reportId }: { reportId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function retry() {
    setError(null);
    startTransition(async () => {
      const res = await retryReport(reportId);
      if (res.ok) router.refresh();
      else setError(res.error ?? "Retry failed.");
    });
  }

  return (
    <span className="inline-flex items-center gap-2">
      <Button size="sm" variant="outline" onClick={retry} disabled={pending}>
        {pending ? "Retrying…" : "Retry"}
      </Button>
      {error && <span className="text-xs text-destructive">{error}</span>}
    </span>
  );
}

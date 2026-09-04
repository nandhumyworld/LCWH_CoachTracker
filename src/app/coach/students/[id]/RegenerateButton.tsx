"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { regenerateProfile } from "@/app/actions/intake";
import { Button } from "@/components/ui/button";

export function RegenerateButton({ studentId }: { studentId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  return (
    <div className="flex items-center gap-3">
      <Button
        variant="outline"
        size="sm"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const res = await regenerateProfile(studentId);
            setMsg(res.ok ? "Regenerated." : (res.error ?? "Failed."));
            if (res.ok) router.refresh();
          })
        }
      >
        {pending ? "Regenerating…" : "Regenerate profile"}
      </Button>
      {msg && <span className="text-sm text-muted-foreground">{msg}</span>}
    </div>
  );
}

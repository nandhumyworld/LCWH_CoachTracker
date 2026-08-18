"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { acknowledgeGateAction } from "@/app/actions/attendance";
import { Button } from "@/components/ui/button";

// Full-screen, mandatory daily message. Blocks the student app until the ack
// button is tapped (FR-21/22); acknowledging records attendance (FR-23) and
// dismisses the popup via a router refresh.
export function GateGuard({
  gateMessageId,
  bodyText,
  ackButtonLabel,
  imageRefId,
}: {
  gateMessageId: string;
  bodyText: string;
  ackButtonLabel: string;
  imageRefId: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function acknowledge() {
    setError(null);
    startTransition(async () => {
      const res = await acknowledgeGateAction(gateMessageId);
      if (res.ok) router.refresh();
      else setError(res.error ?? "Could not acknowledge. Try again.");
    });
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-background/95 p-4 backdrop-blur-sm"
    >
      <div className="w-full max-w-lg space-y-5 rounded-lg border bg-card p-6 shadow-lg">
        <h2 className="text-lg font-semibold">A message from your coach</h2>
        {imageRefId && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`/api/images/${imageRefId}`}
            alt="Coach message"
            className="max-h-72 w-full rounded-md object-contain"
          />
        )}
        <p className="whitespace-pre-wrap text-sm leading-relaxed">{bodyText}</p>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button onClick={acknowledge} disabled={pending} className="w-full">
          {pending ? "Saving…" : ackButtonLabel}
        </Button>
      </div>
    </div>
  );
}

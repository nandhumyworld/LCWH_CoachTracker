"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { acknowledgeGateAction } from "@/app/actions/attendance";
import { Button } from "@/components/ui/button";

// Full-screen daily message shown on every login while a message is scheduled
// (CR-014). The first acknowledgement records attendance (FR-23); after that,
// it is dismissed for the current browser session (re-appears on next login).
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
  const [dismissed, setDismissed] = useState(true); // hidden until we check session

  const storageKey = `gate-seen-${gateMessageId}`;

  useEffect(() => {
    setDismissed(sessionStorage.getItem(storageKey) === "1");
  }, [storageKey]);

  function acknowledge() {
    setError(null);
    startTransition(async () => {
      const res = await acknowledgeGateAction(gateMessageId);
      if (res.ok) {
        sessionStorage.setItem(storageKey, "1");
        setDismissed(true);
        router.refresh();
      } else {
        setError(res.error ?? "Could not acknowledge. Try again.");
      }
    });
  }

  if (dismissed) return null;

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

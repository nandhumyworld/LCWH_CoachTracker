"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  setSimulatedClockAction,
  resetSimulatedClockAction,
  runAutoSubmitNowAction,
} from "@/app/actions/settings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const DAY_MS = 24 * 60 * 60 * 1000;

// Formats an epoch-ms instant as the value a <input type="datetime-local">
// expects ("YYYY-MM-DDTHH:mm"), in the admin's own browser timezone.
function toLocalInput(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// Admin testing clock (CR-017): move the whole app to a simulated "now" so
// schedule-driven behaviour can be tested without waiting for real days.
export function ClockPanel({
  effectiveNowMs,
  simulated,
}: {
  effectiveNowMs: number;
  simulated: boolean;
}) {
  const router = useRouter();
  const [value, setValue] = useState(toLocalInput(effectiveNowMs));
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<string | null>(null);

  function apply(targetMs: number) {
    setStatus(null);
    startTransition(async () => {
      const res = await setSimulatedClockAction(targetMs);
      if (res.ok) {
        setStatus("Clock set. The whole app now uses this time.");
        router.refresh();
      } else {
        setStatus(res.error ?? "Could not set the clock.");
      }
    });
  }

  function applyFromInput() {
    const ms = new Date(value).getTime();
    if (Number.isNaN(ms)) {
      setStatus("Pick a valid date and time.");
      return;
    }
    apply(ms);
  }

  function shiftDays(days: number) {
    apply(effectiveNowMs + days * DAY_MS);
  }

  // Jump to 23:58 tonight (browser-local) so the auto-submit cutoff can be
  // reached with one "Run auto-submit" click.
  function jumpToTonight() {
    const d = new Date(effectiveNowMs);
    d.setHours(23, 58, 0, 0);
    apply(d.getTime());
  }

  function reset() {
    setStatus(null);
    startTransition(async () => {
      const res = await resetSimulatedClockAction();
      if (res.ok) {
        setStatus("Back to real time.");
        router.refresh();
      } else {
        setStatus(res.error ?? "Could not reset.");
      }
    });
  }

  function runAutoSubmit() {
    setStatus(null);
    startTransition(async () => {
      const res = await runAutoSubmitNowAction();
      if (res.ok) {
        setStatus(
          `Auto-submit ran: ${res.processed} of ${res.scanned} open day(s) submitted.`,
        );
        router.refresh();
      } else {
        setStatus(res.error ?? "Auto-submit failed.");
      }
    });
  }

  return (
    <section className="space-y-4 rounded-lg border p-4">
      <div>
        <h2 className="text-lg font-semibold">System clock (testing)</h2>
        <p className="text-sm text-muted-foreground">
          Move the whole app to a simulated date to test the daily gate,
          auto-submit cutoff, and day rollover — no waiting for real days.
        </p>
      </div>

      <p className="text-sm">
        Effective now:{" "}
        <span className="font-mono">{new Date(effectiveNowMs).toString()}</span>
        {simulated ? (
          <span className="ml-2 rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900">
            SIMULATED
          </span>
        ) : (
          <span className="ml-2 rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground">
            real time
          </span>
        )}
      </p>

      <div className="space-y-2">
        <Label htmlFor="simclock">Set simulated date &amp; time</Label>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            id="simclock"
            type="datetime-local"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="w-auto"
          />
          <Button size="sm" onClick={applyFromInput} disabled={pending}>
            Apply
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="outline" onClick={() => shiftDays(1)} disabled={pending}>
          +1 day
        </Button>
        <Button size="sm" variant="outline" onClick={() => shiftDays(-1)} disabled={pending}>
          −1 day
        </Button>
        <Button size="sm" variant="outline" onClick={jumpToTonight} disabled={pending}>
          Jump to 23:58 tonight
        </Button>
        <Button size="sm" variant="secondary" onClick={runAutoSubmit} disabled={pending}>
          Run auto-submit now
        </Button>
        <Button size="sm" variant="ghost" onClick={reset} disabled={pending}>
          Reset to real time
        </Button>
      </div>

      {status && <p className="text-sm text-muted-foreground">{status}</p>}
    </section>
  );
}

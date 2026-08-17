"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { submitIntake } from "@/app/actions/intake";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";

// Best-effort guess of the browser's timezone to preselect.
function guessTz(list: string[]): string {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return list.includes(tz) ? tz : "UTC";
  } catch {
    return "UTC";
  }
}

export function IntakeForm({ timezones }: { timezones: string[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [timezone, setTimezone] = useState(() => guessTz(timezones));
  const [heightCm, setHeightCm] = useState("");
  const [currentWeightKg, setCurrentWeightKg] = useState("");
  const [targetWeightKg, setTargetWeightKg] = useState("");

  function save() {
    setError(null);
    const h = Number(heightCm);
    const cw = Number(currentWeightKg);
    const tw = Number(targetWeightKg);
    if (!(h > 0) || !(cw > 0) || !(tw > 0)) {
      setError("Enter positive numbers for height and weights.");
      return;
    }
    startTransition(async () => {
      const res = await submitIntake({
        timezone,
        heightCm: h,
        currentWeightKg: cw,
        targetWeightKg: tw,
      });
      if (!res.ok) {
        setError(res.error ?? "Could not save.");
        return;
      }
      router.replace("/student");
    });
  }

  return (
    <Card>
      <CardContent className="space-y-4 p-4">
        <div className="space-y-2">
          <Label htmlFor="tz">Timezone</Label>
          <select
            id="tz"
            className="h-9 w-full rounded-md border bg-transparent px-2 text-sm"
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
          >
            {timezones.map((tz) => (
              <option key={tz} value={tz}>
                {tz}
              </option>
            ))}
          </select>
          <p className="text-xs text-muted-foreground">
            Your day locks at 11:59 PM in this timezone.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-2">
            <Label htmlFor="h">Height (cm)</Label>
            <Input id="h" type="number" value={heightCm} onChange={(e) => setHeightCm(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cw">Current (kg)</Label>
            <Input id="cw" type="number" value={currentWeightKg} onChange={(e) => setCurrentWeightKg(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="tw">Target (kg)</Label>
            <Input id="tw" type="number" value={targetWeightKg} onChange={(e) => setTargetWeightKg(e.target.value)} />
          </div>
        </div>

        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}
        <Button onClick={save} disabled={pending}>
          {pending ? "Saving…" : "Complete setup"}
        </Button>
      </CardContent>
    </Card>
  );
}

"use client";

import { useState, useTransition } from "react";
import { updateSystemSettings } from "@/app/actions/settings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function SettingsForm({
  retentionDays,
  defaultModel,
}: {
  retentionDays: number;
  defaultModel: string;
}) {
  const [days, setDays] = useState(String(retentionDays));
  const [model, setModel] = useState(defaultModel);
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<string | null>(null);

  function save() {
    setStatus(null);
    const parsedDays = Number(days);
    startTransition(async () => {
      const res = await updateSystemSettings({
        photoRetentionDays: parsedDays,
        openrouterDefaultModel: model,
      });
      setStatus(res.ok ? "Saved." : (res.error ?? "Could not save."));
    });
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="retention">Photo retention (days)</Label>
        <Input
          id="retention"
          type="number"
          min={1}
          value={days}
          onChange={(e) => setDays(e.target.value)}
        />
        <p className="text-xs text-muted-foreground">
          Uploaded photos are deleted this many days after upload.
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="model">Default OpenRouter model</Label>
        <Input
          id="model"
          value={model}
          onChange={(e) => setModel(e.target.value)}
          placeholder="e.g. openai/gpt-4o-mini"
        />
        <p className="text-xs text-muted-foreground">
          Used when a coach&apos;s prompt template has no model set.
        </p>
      </div>
      <div className="flex items-center gap-3">
        <Button onClick={save} disabled={pending}>
          {pending ? "Saving…" : "Save settings"}
        </Button>
        {status && <span className="text-sm text-muted-foreground">{status}</span>}
      </div>
    </div>
  );
}

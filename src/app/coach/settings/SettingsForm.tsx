"use client";

import { useState, useTransition } from "react";
import { updateProgramSettings } from "@/app/actions/questions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

export function SettingsForm({
  formDescription,
  submissionMessage,
}: {
  formDescription: string;
  submissionMessage: string;
}) {
  const [desc, setDesc] = useState(formDescription);
  const [msg, setMsg] = useState(submissionMessage);
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<string | null>(null);

  function save() {
    setStatus(null);
    startTransition(async () => {
      const res = await updateProgramSettings({
        formDescription: desc,
        submissionMessage: msg,
      });
      setStatus(res.ok ? "Saved." : (res.error ?? "Could not save."));
    });
  }

  return (
    <div className="max-w-2xl space-y-4">
      <div className="space-y-2">
        <Label>Form description</Label>
        <textarea
          className="min-h-[80px] w-full rounded-md border bg-transparent p-2 text-sm"
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label>Submission / thank-you message</Label>
        <textarea
          className="min-h-[80px] w-full rounded-md border bg-transparent p-2 text-sm"
          value={msg}
          onChange={(e) => setMsg(e.target.value)}
        />
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

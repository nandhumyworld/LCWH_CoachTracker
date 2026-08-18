"use client";

import { useState, useTransition } from "react";
import { updatePromptTemplate } from "@/app/actions/prompt";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function PromptEditor({
  id,
  name,
  body,
  modelId,
  version,
  questionKeys,
  profileFields,
}: {
  id: string | null;
  name: string;
  body: string;
  modelId: string;
  version: number | null;
  questionKeys: { key: string; prompt: string }[];
  profileFields: string[];
}) {
  const [nameVal, setNameVal] = useState(name);
  const [bodyVal, setBodyVal] = useState(body);
  const [modelVal, setModelVal] = useState(modelId);
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<string | null>(null);

  function save() {
    setStatus(null);
    startTransition(async () => {
      const res = await updatePromptTemplate({
        id: id ?? undefined,
        name: nameVal,
        body: bodyVal,
        modelId: modelVal,
      });
      setStatus(res.ok ? "Saved." : (res.error ?? "Could not save."));
    });
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="tpl-name">Template name</Label>
          <Input
            id="tpl-name"
            value={nameVal}
            onChange={(e) => setNameVal(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="tpl-model">OpenRouter model id</Label>
          <Input
            id="tpl-model"
            value={modelVal}
            onChange={(e) => setModelVal(e.target.value)}
            placeholder="e.g. anthropic/claude-3.5-sonnet"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="tpl-body">Prompt body</Label>
        <textarea
          id="tpl-body"
          className="min-h-[280px] w-full rounded-md border bg-transparent p-3 font-mono text-sm"
          value={bodyVal}
          onChange={(e) => setBodyVal(e.target.value)}
        />
      </div>

      <div className="rounded-md border p-4 text-sm">
        <p className="mb-2 font-medium">Available placeholders</p>
        <div className="space-y-3">
          <div>
            <p className="mb-1 text-muted-foreground">Answers</p>
            {questionKeys.length === 0 ? (
              <p className="text-muted-foreground">
                No questions yet — add questions to get {"{{q.<key>}}"} placeholders.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {questionKeys.map((q) => (
                  <code
                    key={q.key}
                    title={q.prompt}
                    className="rounded bg-muted px-1.5 py-0.5"
                  >{`{{q.${q.key}}}`}</code>
                ))}
              </div>
            )}
          </div>
          <div>
            <p className="mb-1 text-muted-foreground">Profile</p>
            <div className="flex flex-wrap gap-2">
              {profileFields.map((f) => (
                <code key={f} className="rounded bg-muted px-1.5 py-0.5">{`{{profile.${f}}}`}</code>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Button onClick={save} disabled={pending}>
          {pending ? "Saving…" : "Save prompt"}
        </Button>
        {version !== null && (
          <span className="text-sm text-muted-foreground">Version {version}</span>
        )}
        {status && <span className="text-sm text-muted-foreground">{status}</span>}
      </div>
    </div>
  );
}

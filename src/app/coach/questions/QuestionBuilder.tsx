"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  QUESTION_TYPES,
  toKey,
  type QuestionType,
} from "@/lib/questions";
import {
  upsertQuestion,
  deleteQuestion,
  reorderQuestions,
} from "@/app/actions/questions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";

export interface QItem {
  id: string;
  key: string;
  sectionTitle: string;
  orderIndex: number;
  type: QuestionType;
  prompt: string;
  options: Record<string, unknown>;
  points: number;
  required: boolean;
  allowsImage: boolean;
  helpText: string;
}

const TYPE_LABELS: Record<QuestionType, string> = {
  short_text: "Short text",
  number: "Number",
  date: "Date",
  paragraph: "Paragraph",
  multiple_choice: "Multiple choice",
  checkboxes: "Checkboxes",
  linear_scale: "Linear scale",
  image: "Image upload",
};

const CHOICE_TYPES: QuestionType[] = ["multiple_choice", "checkboxes"];

type Draft = {
  id?: string;
  prompt: string;
  key: string;
  sectionTitle: string;
  type: QuestionType;
  points: number;
  required: boolean;
  allowsImage: boolean;
  helpText: string;
  // options fields (flattened for the form)
  choicesText: string;
  gt: string;
  min: string;
  max: string;
  integer: boolean;
  minLabel: string;
  maxLabel: string;
};

function emptyDraft(sectionTitle = "General"): Draft {
  return {
    prompt: "",
    key: "",
    sectionTitle,
    type: "short_text",
    points: 0,
    required: false,
    allowsImage: false,
    helpText: "",
    choicesText: "",
    gt: "",
    min: "",
    max: "",
    integer: false,
    minLabel: "",
    maxLabel: "",
  };
}

function draftFromItem(q: QItem): Draft {
  const o = q.options ?? {};
  const num = (v: unknown) => (typeof v === "number" ? String(v) : "");
  const choices = Array.isArray(o.choices) ? (o.choices as string[]) : [];
  return {
    id: q.id,
    prompt: q.prompt,
    key: q.key,
    sectionTitle: q.sectionTitle,
    type: q.type,
    points: q.points,
    required: q.required,
    allowsImage: q.allowsImage,
    helpText: q.helpText,
    choicesText: choices.join("\n"),
    gt: num(o.gt),
    min: num(o.min),
    max: num(o.max),
    integer: o.integer === true,
    minLabel: typeof o.minLabel === "string" ? o.minLabel : "",
    maxLabel: typeof o.maxLabel === "string" ? o.maxLabel : "",
  };
}

// Builds the type-specific options payload from the flat draft fields.
function optionsFromDraft(d: Draft): Record<string, unknown> {
  if (CHOICE_TYPES.includes(d.type)) {
    const choices = d.choicesText
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    return { choices };
  }
  if (d.type === "linear_scale") {
    const opts: Record<string, unknown> = {
      min: Number(d.min || 1),
      max: Number(d.max || 5),
    };
    if (d.minLabel) opts.minLabel = d.minLabel;
    if (d.maxLabel) opts.maxLabel = d.maxLabel;
    return opts;
  }
  if (d.type === "number") {
    const opts: Record<string, unknown> = {};
    if (d.gt !== "") opts.gt = Number(d.gt);
    if (d.min !== "") opts.min = Number(d.min);
    if (d.max !== "") opts.max = Number(d.max);
    if (d.integer) opts.integer = true;
    return opts;
  }
  return {};
}

export function QuestionBuilder({ initial }: { initial: QItem[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) =>
    setDraft((d) => (d ? { ...d, [k]: v } : d));

  function startAdd() {
    setError(null);
    const lastSection = initial.at(-1)?.sectionTitle ?? "General";
    setDraft(emptyDraft(lastSection));
  }

  function save() {
    if (!draft) return;
    setError(null);
    const key = toKey(draft.key || draft.prompt);
    startTransition(async () => {
      const res = await upsertQuestion({
        id: draft.id,
        key,
        sectionTitle: draft.sectionTitle,
        orderIndex: draft.id
          ? (initial.find((q) => q.id === draft.id)?.orderIndex ?? initial.length)
          : initial.length,
        type: draft.type,
        prompt: draft.prompt,
        options: optionsFromDraft(draft),
        points: draft.points,
        required: draft.required,
        allowsImage: draft.allowsImage,
        helpText: draft.helpText || undefined,
      });
      if (!res.ok) {
        setError(res.error ?? "Could not save.");
        return;
      }
      setDraft(null);
      router.refresh();
    });
  }

  function remove(id: string) {
    startTransition(async () => {
      const res = await deleteQuestion(id);
      if (!res.ok) setError(res.error ?? "Could not delete.");
      router.refresh();
    });
  }

  function move(index: number, dir: -1 | 1) {
    const next = [...initial];
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    startTransition(async () => {
      const res = await reorderQuestions(next.map((q) => q.id));
      if (!res.ok) setError(res.error ?? "Could not reorder.");
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      {error && (
        <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      <ol className="space-y-2">
        {initial.length === 0 && (
          <li className="text-sm text-muted-foreground">No questions yet.</li>
        )}
        {initial.map((q, i) => (
          <li key={q.id}>
            <Card>
              <CardContent className="flex items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-secondary px-2 py-0.5 text-xs text-secondary-foreground">
                      {q.sectionTitle}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {TYPE_LABELS[q.type]} · {q.key} · {q.points} pt
                      {q.required ? " · required" : ""}
                    </span>
                  </div>
                  <p className="truncate font-medium">{q.prompt}</p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Button variant="ghost" size="sm" disabled={pending} onClick={() => move(i, -1)}>
                    ↑
                  </Button>
                  <Button variant="ghost" size="sm" disabled={pending} onClick={() => move(i, 1)}>
                    ↓
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={pending}
                    onClick={() => {
                      setError(null);
                      setDraft(draftFromItem(q));
                    }}
                  >
                    Edit
                  </Button>
                  <Button variant="ghost" size="sm" disabled={pending} onClick={() => remove(q.id)}>
                    Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          </li>
        ))}
      </ol>

      {draft ? (
        <Card>
          <CardContent className="space-y-4 p-4">
            <h2 className="font-semibold">{draft.id ? "Edit question" : "New question"}</h2>

            <div className="space-y-2">
              <Label>Question prompt</Label>
              <textarea
                className="min-h-[64px] w-full rounded-md border bg-transparent p-2 text-sm"
                value={draft.prompt}
                onChange={(e) => set("prompt", e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Key (for {"{{q.key}}"})</Label>
                <Input
                  value={draft.key}
                  placeholder={toKey(draft.prompt) || "auto"}
                  onChange={(e) => set("key", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Section</Label>
                <Input value={draft.sectionTitle} onChange={(e) => set("sectionTitle", e.target.value)} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Type</Label>
                <select
                  className="h-9 w-full rounded-md border bg-transparent px-2 text-sm"
                  value={draft.type}
                  onChange={(e) => set("type", e.target.value as QuestionType)}
                >
                  {QUESTION_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {TYPE_LABELS[t]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Points</Label>
                <Input
                  type="number"
                  value={draft.points}
                  onChange={(e) => set("points", Number(e.target.value))}
                />
              </div>
            </div>

            {/* Type-specific options */}
            {CHOICE_TYPES.includes(draft.type) && (
              <div className="space-y-2">
                <Label>Choices (one per line)</Label>
                <textarea
                  className="min-h-[80px] w-full rounded-md border bg-transparent p-2 text-sm"
                  value={draft.choicesText}
                  onChange={(e) => set("choicesText", e.target.value)}
                />
              </div>
            )}
            {draft.type === "linear_scale" && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Min</Label>
                  <Input type="number" value={draft.min} onChange={(e) => set("min", e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Max</Label>
                  <Input type="number" value={draft.max} onChange={(e) => set("max", e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Min label</Label>
                  <Input value={draft.minLabel} onChange={(e) => set("minLabel", e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Max label</Label>
                  <Input value={draft.maxLabel} onChange={(e) => set("maxLabel", e.target.value)} />
                </div>
              </div>
            )}
            {draft.type === "number" && (
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-2">
                  <Label>&gt; (exclusive)</Label>
                  <Input type="number" value={draft.gt} onChange={(e) => set("gt", e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Min (≥)</Label>
                  <Input type="number" value={draft.min} onChange={(e) => set("min", e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Max (≤)</Label>
                  <Input type="number" value={draft.max} onChange={(e) => set("max", e.target.value)} />
                </div>
                <label className="col-span-3 flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={draft.integer}
                    onChange={(e) => set("integer", e.target.checked)}
                  />
                  Whole numbers only
                </label>
              </div>
            )}

            <div className="space-y-2">
              <Label>Help text (optional)</Label>
              <Input value={draft.helpText} onChange={(e) => set("helpText", e.target.value)} />
            </div>

            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={draft.required}
                  onChange={(e) => set("required", e.target.checked)}
                />
                Required
              </label>
              {draft.type !== "image" && (
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={draft.allowsImage}
                    onChange={(e) => set("allowsImage", e.target.checked)}
                  />
                  Allow an attached photo
                </label>
              )}
            </div>

            <div className="flex gap-2">
              <Button onClick={save} disabled={pending || !draft.prompt.trim()}>
                {pending ? "Saving…" : "Save question"}
              </Button>
              <Button variant="outline" onClick={() => setDraft(null)} disabled={pending}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Button onClick={startAdd}>Add question</Button>
      )}
    </div>
  );
}

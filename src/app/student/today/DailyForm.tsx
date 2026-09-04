"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { QuestionType } from "@/lib/questions";
import { saveAnswerAction, submitEntryAction } from "@/app/actions/checkin";
import { uploadPhotoAction } from "@/app/actions/upload";
import { formatDerived } from "@/lib/dashboard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";

export interface FormQuestion {
  id: string;
  key: string;
  sectionTitle: string;
  type: QuestionType;
  prompt: string;
  options: Record<string, unknown>;
  required: boolean;
  allowsImage: boolean;
  helpText: string;
  value: unknown;
  note: string;
  imageId: string | null;
  derived: Record<string, unknown> | null;
}

type Values = Record<string, unknown>;
type Images = Record<string, string | null>;
type Notes = Record<string, string>;

export function DailyForm({
  entryId,
  status,
  questions,
  submissionMessage,
  reportStatus,
}: {
  entryId: string;
  status: "open" | "submitted" | "auto_submitted" | "missed";
  questions: FormQuestion[];
  submissionMessage: string;
  reportStatus: "pending" | "done" | "failed" | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const readOnly = status !== "open";

  const [values, setValues] = useState<Values>(() =>
    Object.fromEntries(questions.map((q) => [q.id, q.value])),
  );
  const [images, setImages] = useState<Images>(() =>
    Object.fromEntries(questions.map((q) => [q.id, q.imageId])),
  );
  const [notes, setNotes] = useState<Notes>(() =>
    Object.fromEntries(questions.map((q) => [q.id, q.note])),
  );
  // Live AI extraction per question (CR-007 on-upload). Seeded from the server
  // (e.g. a previously analyzed photo) and refreshed the moment a photo uploads.
  const [derivedMap, setDerivedMap] = useState<Record<string, Record<string, unknown> | null>>(
    () => Object.fromEntries(questions.map((q) => [q.id, q.derived])),
  );
  const [analyzing, setAnalyzing] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [missing, setMissing] = useState<string[]>([]);
  const [done, setDone] = useState(readOnly);

  const sections = useMemo(() => {
    const map = new Map<string, FormQuestion[]>();
    for (const q of questions) {
      if (!map.has(q.sectionTitle)) map.set(q.sectionTitle, []);
      map.get(q.sectionTitle)!.push(q);
    }
    return [...map.entries()];
  }, [questions]);

  function persistValue(questionId: string, value: unknown) {
    if (readOnly) return;
    saveAnswerAction({ dailyEntryId: entryId, questionId, value }).then((r) => {
      if (!r.ok) setError(r.error ?? "Could not save.");
    });
  }

  function persistNote(questionId: string, note: string) {
    if (readOnly) return;
    saveAnswerAction({ dailyEntryId: entryId, questionId, note }).then((r) => {
      if (!r.ok) setError(r.error ?? "Could not save note.");
    });
  }

  function setValue(questionId: string, value: unknown, save = true) {
    setValues((v) => ({ ...v, [questionId]: value }));
    if (save) persistValue(questionId, value);
  }

  async function upload(questionId: string, file: File) {
    setError(null);
    // A meal (image-type) photo is analyzed on the server as it uploads; show a
    // pending "Analyzing…" line until calories/items come back.
    const isMeal = questions.find((q) => q.id === questionId)?.type === "image";
    if (isMeal) setAnalyzing((m) => ({ ...m, [questionId]: true }));

    const fd = new FormData();
    fd.set("dailyEntryId", entryId);
    fd.set("questionId", questionId);
    fd.set("file", file);
    const res = await uploadPhotoAction(fd);

    if (isMeal) setAnalyzing((m) => ({ ...m, [questionId]: false }));
    if (!res.ok) {
      setError(res.error ?? "Upload failed.");
      return;
    }
    // The server links imageRefId (and, for image-type questions, the value).
    setImages((m) => ({ ...m, [questionId]: res.imageId ?? null }));
    // Overwrite the shown extraction with the fresh result for this photo.
    if (isMeal) setDerivedMap((m) => ({ ...m, [questionId]: res.derived ?? null }));
  }

  function submit() {
    setError(null);
    setMissing([]);
    startTransition(async () => {
      const res = await submitEntryAction(entryId);
      if (!res.ok) {
        setError(res.error ?? "Could not submit.");
        setMissing(res.missing ?? []);
        return;
      }
      setDone(true);
      router.refresh();
    });
  }

  if (done) {
    return (
      <Card>
        <CardContent className="space-y-3 p-6">
          <p className="font-medium">
            {status === "auto_submitted"
              ? "This day was auto-submitted at your local cutoff."
              : submissionMessage}
          </p>
          <p className="text-sm text-muted-foreground">
            Report: {reportStatus ?? "pending"}.
          </p>
          <div className="flex gap-3 pt-1">
            <Button onClick={() => router.push("/student")}>Back to dashboard</Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {sections.map(([section, qs]) => (
        <div key={section} className="space-y-3">
          <h2 className="font-semibold">{section}</h2>
          {qs.map((q) => (
            <Card key={q.id}>
              <CardContent className="space-y-2 p-4">
                <div className="flex items-baseline justify-between gap-2">
                  <label className="font-medium">
                    {q.prompt}
                    {q.required && <span className="text-destructive"> *</span>}
                  </label>
                </div>
                {q.helpText && (
                  <p className="text-xs text-muted-foreground">{q.helpText}</p>
                )}

                <QuestionInput
                  q={q}
                  value={values[q.id]}
                  imageId={images[q.id]}
                  readOnly={readOnly}
                  onChange={(v) => setValue(q.id, v)}
                  onBlurSave={(v) => persistValue(q.id, v)}
                  onUpload={(f) => upload(q.id, f)}
                />

                {/* Supplemental photo on non-image questions when enabled (CR-006). */}
                {q.type !== "image" && q.allowsImage && (
                  <div className="pt-1">
                    <p className="mb-1 text-xs text-muted-foreground">
                      Attach a photo (optional)
                    </p>
                    {readOnly ? (
                      images[q.id] ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={`/api/images/${images[q.id]}`}
                          alt="attachment"
                          className="max-h-48 rounded-md border"
                        />
                      ) : (
                        <p className="text-sm text-muted-foreground">No photo.</p>
                      )
                    ) : (
                      <ImageField imageId={images[q.id]} onUpload={(f) => upload(q.id, f)} />
                    )}
                  </div>
                )}

                {/* AI-extracted info from the photo (CR-009; live on upload). */}
                <DerivedLine derived={derivedMap[q.id]} analyzing={analyzing[q.id]} />

                {/* Note / comment on every question (CR-005). */}
                <NoteField
                  value={notes[q.id]}
                  readOnly={readOnly}
                  onSave={(n) => {
                    setNotes((m) => ({ ...m, [q.id]: n }));
                    persistNote(q.id, n);
                  }}
                />
              </CardContent>
            </Card>
          ))}
        </div>
      ))}

      {error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive" role="alert">
          <p>{error}</p>
          {missing.length > 0 && (
            <ul className="mt-1 list-disc pl-5">
              {missing.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {!readOnly && (
        <Button onClick={submit} disabled={pending}>
          {pending ? "Submitting…" : "Submit today"}
        </Button>
      )}
    </div>
  );
}

function DerivedLine({
  derived,
  analyzing,
}: {
  derived: Record<string, unknown> | null;
  analyzing?: boolean;
}) {
  if (analyzing) {
    return <p className="text-xs text-muted-foreground">Analyzing photo…</p>;
  }
  const s = formatDerived(derived);
  return s ? <p className="text-xs text-primary">AI: {s}</p> : null;
}

function NoteField({
  value,
  readOnly,
  onSave,
}: {
  value: string;
  readOnly: boolean;
  onSave: (v: string) => void;
}) {
  if (readOnly) {
    return value ? (
      <p className="text-sm text-muted-foreground">
        <span className="font-medium">Note:</span> {value}
      </p>
    ) : null;
  }
  return (
    <input
      type="text"
      placeholder="Add a note (optional)"
      defaultValue={value}
      onBlur={(e) => onSave(e.target.value)}
      className="w-full rounded-md border bg-transparent p-2 text-sm"
    />
  );
}

function QuestionInput({
  q,
  value,
  imageId,
  readOnly,
  onChange,
  onBlurSave,
  onUpload,
}: {
  q: FormQuestion;
  value: unknown;
  imageId: string | null;
  readOnly: boolean;
  onChange: (v: unknown) => void;
  onBlurSave: (v: unknown) => void;
  onUpload: (f: File) => void;
}) {
  const choices = Array.isArray(q.options.choices)
    ? (q.options.choices as string[])
    : [];

  if (readOnly) {
    return <ReadOnlyValue q={q} value={value} imageId={imageId} />;
  }

  switch (q.type) {
    case "short_text":
    case "date":
      return (
        <Input
          type={q.type === "date" ? "date" : "text"}
          defaultValue={(value as string) ?? ""}
          onBlur={(e) => onBlurSave(e.target.value)}
        />
      );
    case "paragraph":
      return (
        <textarea
          className="min-h-[80px] w-full rounded-md border bg-transparent p-2 text-sm"
          defaultValue={(value as string) ?? ""}
          onBlur={(e) => onBlurSave(e.target.value)}
        />
      );
    case "number":
      return (
        <Input
          type="number"
          defaultValue={value != null ? String(value) : ""}
          onBlur={(e) => onBlurSave(e.target.value === "" ? undefined : Number(e.target.value))}
        />
      );
    case "linear_scale": {
      const min = Number(q.options.min ?? 1);
      const max = Number(q.options.max ?? 5);
      const opts = [];
      for (let i = min; i <= max; i++) opts.push(i);
      return (
        <div className="flex flex-wrap gap-2">
          {opts.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => onChange(n)}
              className={`h-9 w-9 rounded-md border text-sm ${
                value === n ? "bg-primary text-primary-foreground" : ""
              }`}
            >
              {n}
            </button>
          ))}
        </div>
      );
    }
    case "multiple_choice":
      return (
        <div className="space-y-1">
          {choices.map((c) => (
            <label key={c} className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name={q.id}
                checked={value === c}
                onChange={() => onChange(c)}
              />
              {c}
            </label>
          ))}
        </div>
      );
    case "checkboxes": {
      const arr = Array.isArray(value) ? (value as string[]) : [];
      return (
        <div className="space-y-1">
          {choices.map((c) => (
            <label key={c} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={arr.includes(c)}
                onChange={(e) => {
                  const next = e.target.checked
                    ? [...arr, c]
                    : arr.filter((x) => x !== c);
                  onChange(next);
                }}
              />
              {c}
            </label>
          ))}
        </div>
      );
    }
    case "image":
      return <ImageField imageId={imageId} onUpload={onUpload} />;
  }
}

function ImageField({
  imageId,
  onUpload,
}: {
  imageId: string | null;
  onUpload: (f: File) => void;
}) {
  return (
    <div className="space-y-2">
      {imageId && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`/api/images/${imageId}`}
          alt="uploaded"
          className="max-h-48 rounded-md border"
        />
      )}
      <input
        type="file"
        accept="image/*"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onUpload(f);
        }}
      />
    </div>
  );
}

function ReadOnlyValue({
  q,
  value,
  imageId,
}: {
  q: FormQuestion;
  value: unknown;
  imageId: string | null;
}) {
  if (q.type === "image") {
    return imageId ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={`/api/images/${imageId}`} alt="answer" className="max-h-48 rounded-md border" />
    ) : (
      <p className="text-sm text-muted-foreground">No photo.</p>
    );
  }
  const display = Array.isArray(value)
    ? (value as string[]).join(", ")
    : value != null && value !== ""
      ? String(value)
      : "—";
  return <p className="text-sm">{display}</p>;
}

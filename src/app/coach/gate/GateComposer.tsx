"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { scheduleGateAction, uploadGateImageAction } from "@/app/actions/gate";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface ScheduledMessage {
  id: string;
  date: string;
  bodyText: string;
  ackButtonLabel: string;
  imageRefId: string | null;
  acks: number;
}

export function GateComposer({
  today,
  scheduled,
}: {
  today: string;
  scheduled: ScheduledMessage[];
}) {
  const router = useRouter();
  const [date, setDate] = useState(today);
  const [bodyText, setBodyText] = useState("");
  const [ackButtonLabel, setAckButtonLabel] = useState("I acknowledge");
  const [imageRefId, setImageRefId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<string | null>(null);

  async function onPickImage(file: File) {
    setStatus(null);
    setUploading(true);
    const fd = new FormData();
    fd.set("file", file);
    const res = await uploadGateImageAction(fd);
    setUploading(false);
    if (res.ok) setImageRefId(res.imageId ?? null);
    else setStatus(res.error ?? "Image upload failed.");
  }

  function save() {
    setStatus(null);
    startTransition(async () => {
      const res = await scheduleGateAction({
        scheduledDate: date,
        bodyText,
        ackButtonLabel,
        imageRefId,
      });
      if (res.ok) {
        setStatus("Scheduled.");
        setBodyText("");
        setImageRefId(null);
        router.refresh();
      } else {
        setStatus(res.error ?? "Could not schedule.");
      }
    });
  }

  return (
    <div className="space-y-6">
      <div className="max-w-2xl space-y-4 rounded-lg border p-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="gate-date">Date</Label>
            <Input
              id="gate-date"
              type="date"
              min={today}
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="gate-ack">Acknowledge button label</Label>
            <Input
              id="gate-ack"
              value={ackButtonLabel}
              onChange={(e) => setAckButtonLabel(e.target.value)}
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="gate-body">Message</Label>
          <textarea
            id="gate-body"
            className="min-h-[120px] w-full rounded-md border bg-transparent p-2 text-sm"
            value={bodyText}
            onChange={(e) => setBodyText(e.target.value)}
            placeholder="Good morning! Today's focus is…"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="gate-image">Picture (optional)</Label>
          {imageRefId && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={`/api/images/${imageRefId}`}
              alt="message"
              className="max-h-48 rounded-md border"
            />
          )}
          <input
            id="gate-image"
            type="file"
            accept="image/*"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onPickImage(f);
            }}
          />
          {uploading && <p className="text-xs text-muted-foreground">Uploading…</p>}
        </div>
        <div className="flex items-center gap-3">
          <Button onClick={save} disabled={pending || uploading}>
            {pending ? "Saving…" : "Schedule message"}
          </Button>
          {status && <span className="text-sm text-muted-foreground">{status}</span>}
        </div>
      </div>

      <div className="space-y-2">
        <h2 className="font-semibold">Scheduled</h2>
        {scheduled.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing scheduled yet.</p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {scheduled.map((m) => (
              <li key={m.id} className="flex items-start justify-between gap-4 p-3">
                <div className="flex min-w-0 gap-3">
                  {m.imageRefId && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={`/api/images/${m.imageRefId}`}
                      alt=""
                      className="h-12 w-12 rounded object-cover"
                    />
                  )}
                  <div className="min-w-0">
                    <p className="font-medium">{m.date}</p>
                    <p className="truncate text-sm text-muted-foreground">{m.bodyText}</p>
                  </div>
                </div>
                <span className="whitespace-nowrap text-sm text-muted-foreground">
                  {m.acks} acknowledged
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

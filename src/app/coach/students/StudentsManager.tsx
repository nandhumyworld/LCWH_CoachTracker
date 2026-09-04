"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { inviteStudent, resendInvite } from "@/app/actions/students";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";

export interface StudentRow {
  id: string;
  name: string;
  email: string;
  status: "invited" | "active" | "paused";
  timezone: string;
  intakeComplete: boolean;
}

function InviteLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center gap-2 rounded-md bg-secondary p-2 text-sm">
      <code className="min-w-0 flex-1 truncate">{url}</code>
      <Button
        size="sm"
        variant="outline"
        onClick={async () => {
          await navigator.clipboard.writeText(url);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
      >
        {copied ? "Copied" : "Copy"}
      </Button>
    </div>
  );
}

export function StudentsManager({ initial }: { initial: StudentRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [link, setLink] = useState<string | null>(null);

  function invite() {
    setError(null);
    setLink(null);
    startTransition(async () => {
      const res = await inviteStudent({ name, email });
      if (!res.ok) {
        setError(res.error ?? "Could not invite.");
        return;
      }
      setName("");
      setEmail("");
      setLink(res.url ?? null);
      router.refresh();
    });
  }

  function resend(id: string) {
    setError(null);
    setLink(null);
    startTransition(async () => {
      const res = await resendInvite(id);
      if (!res.ok) setError(res.error ?? "Could not resend.");
      else setLink(res.url ?? null);
    });
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="space-y-3 p-4">
          <h2 className="font-semibold">Invite a student</h2>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
          </div>
          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
          <Button onClick={invite} disabled={pending || !name.trim() || !email.trim()}>
            {pending ? "Inviting…" : "Create invite"}
          </Button>
          {link && (
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">
                Share this one-time link with the student:
              </p>
              <InviteLink url={link} />
            </div>
          )}
        </CardContent>
      </Card>

      <div className="space-y-2">
        {initial.length === 0 && (
          <p className="text-sm text-muted-foreground">No students yet.</p>
        )}
        {initial.map((s) => (
          <Card key={s.id}>
            <CardContent className="flex items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <p className="truncate font-medium">{s.name}</p>
                <p className="truncate text-sm text-muted-foreground">{s.email}</p>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <span className="rounded bg-secondary px-2 py-0.5 text-xs text-secondary-foreground">
                  {s.status}
                  {s.status !== "invited" &&
                    (s.intakeComplete ? " · intake ✓" : " · intake pending")}
                </span>
                <Button asChild variant="ghost" size="sm">
                  <Link href={`/coach/students/${s.id}`}>View</Link>
                </Button>
                <Button variant="outline" size="sm" disabled={pending} onClick={() => resend(s.id)}>
                  Resend link
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  updateUserIdentity,
  setUserPassword,
  sendPasswordReset,
  updateStudentProfile,
} from "@/app/actions/admin-users";
import { STUDENT_STATUS_OPTIONS } from "@/lib/admin-users-util";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";

type Status = (typeof STUDENT_STATUS_OPTIONS)[number];

export interface EditorData {
  id: string;
  name: string;
  email: string;
  role: "admin" | "coach" | "student";
  student: {
    timezone: string;
    status: Status;
    coachId: string;
    heightCm: number | null;
    currentWeightKg: number | null;
    targetWeightKg: number | null;
  } | null;
  coaches: { id: string; name: string }[];
  audit: {
    id: string;
    action: string;
    details: Record<string, { from: unknown; to: unknown }> | null;
    createdAt: string;
  }[];
}

const selectClass =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm";

export function UserEditor({ data }: { data: EditorData }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // Account
  const [name, setName] = useState(data.name);
  const [email, setEmail] = useState(data.email);

  // Password
  const [password, setPassword] = useState("");
  const [resetLink, setResetLink] = useState<string | null>(null);

  // Student profile
  const s = data.student;
  const [timezone, setTimezone] = useState(s?.timezone ?? "");
  const [status, setStatus] = useState<Status>(s?.status ?? "active");
  const [coachId, setCoachId] = useState(s?.coachId ?? "");
  const [heightCm, setHeightCm] = useState(s?.heightCm?.toString() ?? "");
  const [currentWeightKg, setCurrentWeightKg] = useState(s?.currentWeightKg?.toString() ?? "");
  const [targetWeightKg, setTargetWeightKg] = useState(s?.targetWeightKg?.toString() ?? "");

  const num = (v: string) => (v.trim() === "" ? undefined : Number(v));

  function run(fn: () => Promise<{ ok: boolean; error?: string; url?: string }>, okMsg: string) {
    setMsg(null);
    setErr(null);
    setResetLink(null);
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) {
        setErr(res.error ?? "Something went wrong.");
        return;
      }
      if (res.url) setResetLink(res.url);
      setMsg(okMsg);
      setPassword("");
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">
        Edit {data.name} <span className="text-base font-normal text-muted-foreground">({data.role})</span>
      </h1>

      {err && (
        <p className="text-sm text-destructive" role="alert">
          {err}
        </p>
      )}
      {msg && <p className="text-sm text-green-600">{msg}</p>}

      <Card>
        <CardContent className="space-y-3 p-4">
          <h2 className="font-semibold">Account</h2>
          <div className="space-y-2">
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <Button
            disabled={pending}
            onClick={() => run(() => updateUserIdentity({ userId: data.id, name, email }), "Account updated.")}
          >
            Save account
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-3 p-4">
          <h2 className="font-semibold">Password</h2>
          <div className="space-y-2">
            <Label>Set a new password</Label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
            />
          </div>
          <div className="flex gap-3">
            <Button
              disabled={pending || password.length < 8}
              onClick={() =>
                run(() => setUserPassword({ userId: data.id, password }), "Password set.")
              }
            >
              Set password
            </Button>
            <Button
              variant="outline"
              disabled={pending}
              onClick={() => run(() => sendPasswordReset(data.id), "Reset link generated.")}
            >
              Generate reset link
            </Button>
          </div>
          {resetLink && (
            <div className="flex items-center gap-2 rounded-md bg-secondary p-2 text-sm">
              <code className="min-w-0 flex-1 truncate">{resetLink}</code>
              <Button
                size="sm"
                variant="outline"
                onClick={() => navigator.clipboard.writeText(resetLink)}
              >
                Copy
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {s && (
        <Card>
          <CardContent className="space-y-3 p-4">
            <h2 className="font-semibold">Student profile</h2>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Timezone (IANA)</Label>
                <Input value={timezone} onChange={(e) => setTimezone(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <select className={selectClass} value={status} onChange={(e) => setStatus(e.target.value as Status)}>
                  {STUDENT_STATUS_OPTIONS.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Coach</Label>
                <select className={selectClass} value={coachId} onChange={(e) => setCoachId(e.target.value)}>
                  {data.coaches.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Height (cm)</Label>
                <Input type="number" value={heightCm} onChange={(e) => setHeightCm(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Current weight (kg)</Label>
                <Input
                  type="number"
                  value={currentWeightKg}
                  onChange={(e) => setCurrentWeightKg(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Target weight (kg)</Label>
                <Input
                  type="number"
                  value={targetWeightKg}
                  onChange={(e) => setTargetWeightKg(e.target.value)}
                />
              </div>
            </div>
            <Button
              disabled={pending}
              onClick={() =>
                run(
                  () =>
                    updateStudentProfile({
                      userId: data.id,
                      timezone,
                      status,
                      coachId,
                      heightCm: num(heightCm),
                      currentWeightKg: num(currentWeightKg),
                      targetWeightKg: num(targetWeightKg),
                    }),
                  "Profile updated.",
                )
              }
            >
              Save profile
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="space-y-3 p-4">
          <h2 className="font-semibold">Recent changes</h2>
          {data.audit.length === 0 && (
            <p className="text-sm text-muted-foreground">No changes recorded yet.</p>
          )}
          <ul className="space-y-1 text-sm">
            {data.audit.map((a) => (
              <li key={a.id} className="flex justify-between gap-3">
                <span>{a.action}</span>
                <span className="text-muted-foreground">
                  {new Date(a.createdAt).toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

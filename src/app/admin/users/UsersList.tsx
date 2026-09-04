"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";

export interface UserRow {
  id: string;
  name: string;
  email: string;
  role: "admin" | "coach" | "student";
  status: "invited" | "active" | "paused" | null;
}

export function UsersList({ initial }: { initial: UserRow[] }) {
  const [q, setQ] = useState("");
  const term = q.trim().toLowerCase();
  const rows = term
    ? initial.filter(
        (u) =>
          u.name.toLowerCase().includes(term) || u.email.toLowerCase().includes(term),
      )
    : initial;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Users</h1>
        <Button asChild>
          <Link href="/admin/users/new">Create user</Link>
        </Button>
      </div>

      <Input
        placeholder="Search by name or email…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />

      <div className="space-y-2">
        {rows.length === 0 && (
          <p className="text-sm text-muted-foreground">No matching users.</p>
        )}
        {rows.map((u) => (
          <Card key={u.id}>
            <CardContent className="flex items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <p className="truncate font-medium">{u.name}</p>
                <p className="truncate text-sm text-muted-foreground">{u.email}</p>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <span className="rounded bg-secondary px-2 py-0.5 text-xs text-secondary-foreground">
                  {u.role}
                  {u.status ? ` · ${u.status}` : ""}
                </span>
                <Button asChild variant="ghost" size="sm">
                  <Link href={`/admin/users/${u.id}`}>Edit</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

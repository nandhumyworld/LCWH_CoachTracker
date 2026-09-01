# Admin User Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an admin create coaches/admins and edit any user's identity, password, and (for students) profile, with every change recorded in an audit log.

**Architecture:** A new `/admin/users` area backed by admin-guarded server actions in `src/app/actions/admin-users.ts`. Pure validation/diff logic lives in `src/lib/admin-users-util.ts` (unit-tested). Passwords reuse `hashPassword`; reset links reuse `createInvite` + the `/set-password` route; student profile edits reuse `computeProfile`. A new `AdminAuditLog` Prisma model stores field-level diffs (never passwords).

**Tech Stack:** Next.js App Router (server components + server actions), Prisma/PostgreSQL, Zod, bcryptjs, Vitest, Tailwind + existing shadcn-style UI primitives.

**Spec:** `docs/superpowers/specs/2026-09-01-admin-user-management-design.md`

## Global Constraints

- Every `/admin/*` page and every admin action starts with `requireRole("admin")` (from `src/lib/auth-guards.ts`).
- Emails are stored trimmed + lowercased; uniqueness enforced on create and identity edit.
- Password minimum length is **8** characters (matches `setPasswordSchema` in `src/app/actions/auth.ts`).
- Passwords are **never** written to `AdminAuditLog`.
- Roles are chosen at creation and are **not** editable afterward.
- Admin can create only `coach` and `admin` roles; students continue via the coach invite flow.
- Server actions return `{ ok: boolean; error?: string; url?: string }`.
- Tests run with `npx vitest run <file>`; type-check with `npx tsc --noEmit`.

## File Structure

- Create `prisma/migrations/<ts>_admin_audit_log/migration.sql` — new table.
- Modify `prisma/schema.prisma` — add `AdminAuditLog` model.
- Create `src/lib/admin-users-util.ts` — Zod schemas, `normalizeEmail`, `isValidTimezone`, `buildAuditDetails`.
- Create `src/lib/__tests__/admin-users.test.ts` — unit tests for the util.
- Create `src/lib/origin.ts` — `originUrl` helper (extracted from `actions/students.ts`).
- Create `src/lib/profile-panel.ts` — `writeProfilePanel` (extracted from `actions/intake.ts`).
- Modify `src/app/actions/students.ts` — import `originUrl` from `src/lib/origin.ts`.
- Modify `src/app/actions/intake.ts` — import `writeProfilePanel` from `src/lib/profile-panel.ts`.
- Create `src/app/actions/admin-users.ts` — the 5 admin actions + `writeAudit`.
- Modify `src/app/admin/layout.tsx` — add "Users" and "Audit log" nav entries.
- Create `src/app/admin/users/page.tsx` + `src/app/admin/users/UsersList.tsx`.
- Create `src/app/admin/users/new/page.tsx` + `src/app/admin/users/new/CreateUserForm.tsx`.
- Create `src/app/admin/users/[id]/page.tsx` + `src/app/admin/users/[id]/UserEditor.tsx`.
- Create `src/app/admin/audit/page.tsx`.
- Modify `docs/local-manual-testing.md` — manual test steps.

---

### Task 1: AdminAuditLog model + migration

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_admin_audit_log/migration.sql` (generated)

**Interfaces:**
- Produces: Prisma model `AdminAuditLog { id, actorUserId, targetUserId, action, details Json?, createdAt }` and the generated `prisma.adminAuditLog` client accessor.

- [ ] **Step 1: Add the model to the schema**

Append to `prisma/schema.prisma`:

```prisma
// Admin actions on users, for accountability. Stores field-level diffs;
// never stores password values.
model AdminAuditLog {
  id           String   @id @default(cuid())
  actorUserId  String
  targetUserId String
  action       String
  details      Json?
  createdAt    DateTime @default(now())

  @@index([targetUserId])
  @@index([createdAt])
}
```

- [ ] **Step 2: Generate the migration + client**

Run: `npx prisma migrate dev --name admin_audit_log`
Expected: a new migration folder is created and `prisma generate` runs without error.

- [ ] **Step 3: Verify the client type exists**

Run: `npx tsc --noEmit`
Expected: PASS (no errors; `prisma.adminAuditLog` is now typed).

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat(db): add AdminAuditLog model"
```

---

### Task 2: admin-users-util (schemas + diff) — TDD

**Files:**
- Create: `src/lib/admin-users-util.ts`
- Test: `src/lib/__tests__/admin-users.test.ts`

**Interfaces:**
- Produces:
  - `ROLE_OPTIONS: readonly ["coach", "admin"]`
  - `createUserSchema`, `identitySchema`, `passwordSchema`, `studentProfileSchema` (Zod schemas)
  - `normalizeEmail(email: string): string`
  - `isValidTimezone(tz: string): boolean`
  - `buildAuditDetails<T extends Record<string, unknown>>(before: T, after: Partial<T>, fields: (keyof T)[]): AuditDetails` where `AuditDetails = Record<string, { from: unknown; to: unknown }>`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/__tests__/admin-users.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  createUserSchema,
  identitySchema,
  passwordSchema,
  studentProfileSchema,
  normalizeEmail,
  isValidTimezone,
  buildAuditDetails,
} from "@/lib/admin-users-util";

describe("normalizeEmail", () => {
  it("trims and lowercases", () => {
    expect(normalizeEmail("  Foo@Bar.COM ")).toBe("foo@bar.com");
  });
});

describe("createUserSchema", () => {
  it("accepts coach and admin roles", () => {
    expect(createUserSchema.safeParse({ name: "A", email: "a@b.com", role: "coach" }).success).toBe(true);
    expect(createUserSchema.safeParse({ name: "A", email: "a@b.com", role: "admin" }).success).toBe(true);
  });
  it("rejects student role and bad email", () => {
    expect(createUserSchema.safeParse({ name: "A", email: "a@b.com", role: "student" }).success).toBe(false);
    expect(createUserSchema.safeParse({ name: "A", email: "nope", role: "coach" }).success).toBe(false);
  });
});

describe("identitySchema", () => {
  it("requires a name and valid email", () => {
    expect(identitySchema.safeParse({ name: "", email: "a@b.com" }).success).toBe(false);
    expect(identitySchema.safeParse({ name: "A", email: "a@b.com" }).success).toBe(true);
  });
});

describe("passwordSchema", () => {
  it("rejects passwords under 8 chars", () => {
    expect(passwordSchema.safeParse({ password: "short" }).success).toBe(false);
    expect(passwordSchema.safeParse({ password: "longenough" }).success).toBe(true);
  });
});

describe("studentProfileSchema", () => {
  const base = {
    timezone: "Asia/Kolkata",
    status: "active" as const,
    coachId: "c1",
    heightCm: 170,
    currentWeightKg: 80,
    targetWeightKg: 70,
  };
  it("accepts valid input", () => {
    expect(studentProfileSchema.safeParse(base).success).toBe(true);
  });
  it("rejects target above current", () => {
    expect(studentProfileSchema.safeParse({ ...base, targetWeightKg: 90 }).success).toBe(false);
  });
});

describe("isValidTimezone", () => {
  it("accepts known zones and rejects junk", () => {
    expect(isValidTimezone("Asia/Kolkata")).toBe(true);
    expect(isValidTimezone("Not/AZone")).toBe(false);
  });
});

describe("buildAuditDetails", () => {
  it("returns only changed fields", () => {
    const d = buildAuditDetails(
      { name: "Old", email: "a@b.com" },
      { name: "New", email: "a@b.com" },
      ["name", "email"],
    );
    expect(d).toEqual({ name: { from: "Old", to: "New" } });
  });
  it("omits fields not present in the after object", () => {
    const d = buildAuditDetails({ name: "Old", email: "a@b.com" }, { name: "New" }, ["name", "email"]);
    expect(d).toEqual({ name: { from: "Old", to: "New" } });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/__tests__/admin-users.test.ts`
Expected: FAIL (cannot find module `@/lib/admin-users-util`).

- [ ] **Step 3: Write the util**

Create `src/lib/admin-users-util.ts`:

```ts
import { z } from "zod";

export const ROLE_OPTIONS = ["coach", "admin"] as const;
export const STUDENT_STATUS_OPTIONS = ["invited", "active", "paused"] as const;

export const createUserSchema = z.object({
  name: z.string().trim().min(1, "Name is required."),
  email: z.string().email("Enter a valid email."),
  role: z.enum(ROLE_OPTIONS),
});

export const identitySchema = z.object({
  name: z.string().trim().min(1, "Name is required."),
  email: z.string().email("Enter a valid email."),
});

export const passwordSchema = z.object({
  password: z.string().min(8, "Password must be at least 8 characters."),
});

export const studentProfileSchema = z
  .object({
    timezone: z.string().min(1, "Timezone is required."),
    status: z.enum(STUDENT_STATUS_OPTIONS),
    coachId: z.string().min(1, "Coach is required."),
    heightCm: z.number().positive(),
    currentWeightKg: z.number().positive(),
    targetWeightKg: z.number().positive(),
  })
  .refine((d) => d.targetWeightKg <= d.currentWeightKg, {
    message: "Target weight should not exceed current weight.",
    path: ["targetWeightKg"],
  });

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

// Validates an IANA timezone against the runtime's known zones.
export function isValidTimezone(tz: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export type AuditDetails = Record<string, { from: unknown; to: unknown }>;

// Field-level before/after diff. Only include fields present in `after` and
// actually changed. Never pass password values in.
export function buildAuditDetails<T extends Record<string, unknown>>(
  before: T,
  after: Partial<T>,
  fields: (keyof T)[],
): AuditDetails {
  const details: AuditDetails = {};
  for (const f of fields) {
    if (f in after && after[f] !== before[f]) {
      details[f as string] = { from: before[f], to: after[f] };
    }
  }
  return details;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/__tests__/admin-users.test.ts`
Expected: PASS (all tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/admin-users-util.ts src/lib/__tests__/admin-users.test.ts
git commit -m "feat(admin): validation + audit-diff util for user management"
```

---

### Task 3: Shared helpers + server actions

**Files:**
- Create: `src/lib/origin.ts`
- Create: `src/lib/profile-panel.ts`
- Modify: `src/app/actions/students.ts` (use extracted `originUrl`)
- Modify: `src/app/actions/intake.ts` (use extracted `writeProfilePanel`)
- Create: `src/app/actions/admin-users.ts`

**Interfaces:**
- Consumes: `admin-users-util` exports (Task 2); `hashPassword` (`src/lib/password.ts`); `createInvite` (`src/lib/invites.ts`); `computeProfile` (`src/lib/profile.ts`); `requireRole` (`src/lib/auth-guards.ts`); `prisma.adminAuditLog` (Task 1).
- Produces:
  - `originUrl(path: string): Promise<string>` in `src/lib/origin.ts`
  - `writeProfilePanel(studentId: string, input: { heightCm: number; currentWeightKg: number; targetWeightKg: number }): Promise<void>` in `src/lib/profile-panel.ts`
  - In `src/app/actions/admin-users.ts` (all `Promise<AdminActionResult>` where `interface AdminActionResult { ok: boolean; error?: string; url?: string }`):
    - `createUser(input: { name: string; email: string; role: "coach" | "admin" })`
    - `updateUserIdentity(input: { userId: string; name: string; email: string })`
    - `setUserPassword(input: { userId: string; password: string })`
    - `sendPasswordReset(userId: string)`
    - `updateStudentProfile(input: { userId: string; timezone: string; status: "invited" | "active" | "paused"; coachId: string; heightCm: number; currentWeightKg: number; targetWeightKg: number })`

- [ ] **Step 1: Extract `originUrl` into a shared lib**

Create `src/lib/origin.ts`:

```ts
import { headers } from "next/headers";

// Builds an absolute URL from the incoming request origin (falls back to
// AUTH_URL) so links work in dev and prod without hardcoding.
export async function originUrl(path: string): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "http";
  const base = host ? `${proto}://${host}` : (process.env.AUTH_URL ?? "");
  return `${base}${path}`;
}
```

In `src/app/actions/students.ts`: remove the local `originUrl` function and the now-unused `headers` import, and add `import { originUrl } from "@/lib/origin";`.

- [ ] **Step 2: Extract `writeProfilePanel` into a shared lib**

Create `src/lib/profile-panel.ts`:

```ts
import { prisma } from "@/lib/db";
import { computeProfile } from "@/lib/profile";

// Persists the profile panel for a student from their intake numbers.
export async function writeProfilePanel(
  studentId: string,
  input: { heightCm: number; currentWeightKg: number; targetWeightKg: number },
): Promise<void> {
  const p = computeProfile(input);
  await prisma.profilePanel.upsert({
    where: { studentId },
    update: {
      bmi: p.bmi,
      bmr: p.bmr,
      weightToLoseKg: p.weightToLoseKg,
      computed: { bmiCategory: p.bmiCategory },
      generatedAt: new Date(),
    },
    create: {
      studentId,
      bmi: p.bmi,
      bmr: p.bmr,
      weightToLoseKg: p.weightToLoseKg,
      computed: { bmiCategory: p.bmiCategory },
    },
  });
}
```

In `src/app/actions/intake.ts`: delete the local `writeProfilePanel` function and its now-unused `computeProfile` import, and add `import { writeProfilePanel } from "@/lib/profile-panel";`.

- [ ] **Step 3: Verify the refactor did not break anything**

Run: `npx tsc --noEmit && npx vitest run`
Expected: PASS (type-check clean; existing tests still green).

- [ ] **Step 4: Commit the refactor**

```bash
git add src/lib/origin.ts src/lib/profile-panel.ts src/app/actions/students.ts src/app/actions/intake.ts
git commit -m "refactor: extract originUrl and writeProfilePanel into shared libs"
```

- [ ] **Step 5: Write the admin actions**

Create `src/app/actions/admin-users.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth-guards";
import { hashPassword } from "@/lib/password";
import { createInvite } from "@/lib/invites";
import { originUrl } from "@/lib/origin";
import { writeProfilePanel } from "@/lib/profile-panel";
import {
  createUserSchema,
  identitySchema,
  passwordSchema,
  studentProfileSchema,
  normalizeEmail,
  isValidTimezone,
  buildAuditDetails,
  type AuditDetails,
} from "@/lib/admin-users-util";

export interface AdminActionResult {
  ok: boolean;
  error?: string;
  url?: string;
}

async function writeAudit(
  actorUserId: string,
  targetUserId: string,
  action: string,
  details: AuditDetails | null,
): Promise<void> {
  await prisma.adminAuditLog.create({
    data: { actorUserId, targetUserId, action, details: details ?? undefined },
  });
}

// Admin creates a coach or admin. Passwordless account + one-time reset link.
export async function createUser(input: {
  name: string;
  email: string;
  role: "coach" | "admin";
}): Promise<AdminActionResult> {
  const admin = await requireRole("admin");
  const parsed = createUserSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const email = normalizeEmail(parsed.data.email);
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return { ok: false, error: "A user with that email already exists." };

  const user = await prisma.user.create({
    data: {
      email,
      name: parsed.data.name.trim(),
      role: parsed.data.role,
      ...(parsed.data.role === "coach" ? { coach: { create: {} } } : {}),
    },
  });

  const { token } = await createInvite(user.id);
  const url = await originUrl(`/set-password?token=${token}`);
  await writeAudit(admin.id, user.id, "user.create", {
    role: { from: null, to: parsed.data.role },
    email: { from: null, to: email },
  });
  revalidatePath("/admin/users");
  return { ok: true, url };
}

// Edit name + email on any user (including self).
export async function updateUserIdentity(input: {
  userId: string;
  name: string;
  email: string;
}): Promise<AdminActionResult> {
  const admin = await requireRole("admin");
  const parsed = identitySchema.safeParse({ name: input.name, email: input.email });
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const email = normalizeEmail(parsed.data.email);
  const user = await prisma.user.findUnique({
    where: { id: input.userId },
    select: { id: true, name: true, email: true },
  });
  if (!user) return { ok: false, error: "User not found." };

  const clash = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (clash && clash.id !== user.id)
    return { ok: false, error: "A user with that email already exists." };

  const name = parsed.data.name.trim();
  await prisma.user.update({ where: { id: user.id }, data: { name, email } });
  await writeAudit(
    admin.id,
    user.id,
    "identity.update",
    buildAuditDetails({ name: user.name, email: user.email }, { name, email }, ["name", "email"]),
  );
  revalidatePath(`/admin/users/${user.id}`);
  return { ok: true };
}

// Set a password directly.
export async function setUserPassword(input: {
  userId: string;
  password: string;
}): Promise<AdminActionResult> {
  const admin = await requireRole("admin");
  const parsed = passwordSchema.safeParse({ password: input.password });
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const user = await prisma.user.findUnique({ where: { id: input.userId }, select: { id: true } });
  if (!user) return { ok: false, error: "User not found." };

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(parsed.data.password) },
  });
  await writeAudit(admin.id, user.id, "password.set", null);
  return { ok: true };
}

// Generate a one-time reset link the admin can copy.
export async function sendPasswordReset(userId: string): Promise<AdminActionResult> {
  const admin = await requireRole("admin");
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!user) return { ok: false, error: "User not found." };

  const { token } = await createInvite(user.id);
  const url = await originUrl(`/set-password?token=${token}`);
  await writeAudit(admin.id, user.id, "password.reset_link", null);
  return { ok: true, url };
}

// Edit a student's profile + coach assignment; recompute the profile panel.
export async function updateStudentProfile(input: {
  userId: string;
  timezone: string;
  status: "invited" | "active" | "paused";
  coachId: string;
  heightCm: number;
  currentWeightKg: number;
  targetWeightKg: number;
}): Promise<AdminActionResult> {
  const admin = await requireRole("admin");
  const parsed = studentProfileSchema.safeParse({
    timezone: input.timezone,
    status: input.status,
    coachId: input.coachId,
    heightCm: input.heightCm,
    currentWeightKg: input.currentWeightKg,
    targetWeightKg: input.targetWeightKg,
  });
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  if (!isValidTimezone(parsed.data.timezone))
    return { ok: false, error: "Unknown timezone." };

  const student = await prisma.student.findUnique({ where: { userId: input.userId } });
  if (!student) return { ok: false, error: "This user is not a student." };

  const coach = await prisma.coach.findUnique({
    where: { id: parsed.data.coachId },
    select: { id: true },
  });
  if (!coach) return { ok: false, error: "Coach not found." };

  const before = {
    timezone: student.timezone,
    status: student.status,
    coachId: student.coachId,
    heightCm: student.heightCm,
    currentWeightKg: student.currentWeightKg,
    targetWeightKg: student.targetWeightKg,
  };

  await prisma.student.update({
    where: { id: student.id },
    data: {
      timezone: parsed.data.timezone,
      status: parsed.data.status,
      coachId: parsed.data.coachId,
      heightCm: parsed.data.heightCm,
      currentWeightKg: parsed.data.currentWeightKg,
      targetWeightKg: parsed.data.targetWeightKg,
    },
  });

  await writeProfilePanel(student.id, {
    heightCm: parsed.data.heightCm,
    currentWeightKg: parsed.data.currentWeightKg,
    targetWeightKg: parsed.data.targetWeightKg,
  });

  await writeAudit(
    admin.id,
    input.userId,
    "student.profile.update",
    buildAuditDetails(before, parsed.data, [
      "timezone",
      "status",
      "coachId",
      "heightCm",
      "currentWeightKg",
      "targetWeightKg",
    ]),
  );
  revalidatePath(`/admin/users/${input.userId}`);
  return { ok: true };
}
```

- [ ] **Step 6: Verify it type-checks and tests stay green**

Run: `npx tsc --noEmit && npx vitest run`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/app/actions/admin-users.ts
git commit -m "feat(admin): server actions to create + edit users"
```

---

### Task 4: Users list + create page + nav

**Files:**
- Modify: `src/app/admin/layout.tsx`
- Create: `src/app/admin/users/page.tsx`
- Create: `src/app/admin/users/UsersList.tsx`
- Create: `src/app/admin/users/new/page.tsx`
- Create: `src/app/admin/users/new/CreateUserForm.tsx`

**Interfaces:**
- Consumes: `createUser` (Task 3); existing `Card`, `Input`, `Label`, `Button` from `src/components/ui/*`.
- Produces: routes `/admin/users` and `/admin/users/new`.

- [ ] **Step 1: Add nav entries**

In `src/app/admin/layout.tsx`, extend `NAV`:

```tsx
const NAV = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/prompt", label: "Report prompt" },
  { href: "/admin/settings", label: "Settings" },
  { href: "/admin/logs", label: "Generation logs" },
  { href: "/admin/audit", label: "Audit log" },
];
```

- [ ] **Step 2: Create the users list page (server component)**

Create `src/app/admin/users/page.tsx`:

```tsx
import { requireRole } from "@/lib/auth-guards";
import { prisma } from "@/lib/db";
import { UsersList, type UserRow } from "./UsersList";

export default async function AdminUsersPage() {
  await requireRole("admin");
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      student: { select: { status: true } },
    },
  });

  const rows: UserRow[] = users.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    status: u.student?.status ?? null,
  }));

  return <UsersList initial={rows} />;
}
```

- [ ] **Step 3: Create the users list client component**

Create `src/app/admin/users/UsersList.tsx`:

```tsx
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
```

- [ ] **Step 4: Create the create-user page (server component)**

Create `src/app/admin/users/new/page.tsx`:

```tsx
import { requireRole } from "@/lib/auth-guards";
import { CreateUserForm } from "./CreateUserForm";

export default async function NewUserPage() {
  await requireRole("admin");
  return (
    <main className="space-y-6">
      <h1 className="text-2xl font-bold">Create user</h1>
      <CreateUserForm />
    </main>
  );
}
```

- [ ] **Step 5: Create the create-user form (client component)**

Create `src/app/admin/users/new/CreateUserForm.tsx`:

```tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createUser } from "@/app/actions/admin-users";
import { ROLE_OPTIONS } from "@/lib/admin-users-util";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";

export function CreateUserForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<(typeof ROLE_OPTIONS)[number]>("coach");
  const [error, setError] = useState<string | null>(null);
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  function submit() {
    setError(null);
    setLink(null);
    startTransition(async () => {
      const res = await createUser({ name, email, role });
      if (!res.ok) {
        setError(res.error ?? "Could not create user.");
        return;
      }
      setName("");
      setEmail("");
      setLink(res.url ?? null);
      router.refresh();
    });
  }

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
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
        <div className="space-y-2">
          <Label>Role</Label>
          <select
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
            value={role}
            onChange={(e) => setRole(e.target.value as (typeof ROLE_OPTIONS)[number])}
          >
            {ROLE_OPTIONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>
        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}
        <Button onClick={submit} disabled={pending || !name.trim() || !email.trim()}>
          {pending ? "Creating…" : "Create user"}
        </Button>
        {link && (
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">
              Share this one-time set-password link with the new user:
            </p>
            <div className="flex items-center gap-2 rounded-md bg-secondary p-2 text-sm">
              <code className="min-w-0 flex-1 truncate">{link}</code>
              <Button
                size="sm"
                variant="outline"
                onClick={async () => {
                  await navigator.clipboard.writeText(link);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                }}
              >
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 6: Verify type-check + build the routes**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 7: Manual smoke test**

Run: `npm run dev`, sign in as admin, visit `/admin/users`, confirm the list renders and search filters; visit `/admin/users/new`, create a coach, confirm a copyable link appears and the new coach shows in the list.
Expected: all of the above work.

- [ ] **Step 8: Commit**

```bash
git add src/app/admin/layout.tsx src/app/admin/users
git commit -m "feat(admin): users list + create-user page"
```

---

### Task 5: User edit page + editor

**Files:**
- Create: `src/app/admin/users/[id]/page.tsx`
- Create: `src/app/admin/users/[id]/UserEditor.tsx`

**Interfaces:**
- Consumes: `updateUserIdentity`, `setUserPassword`, `sendPasswordReset`, `updateStudentProfile` (Task 3); `STUDENT_STATUS_OPTIONS` (Task 2).
- Produces: route `/admin/users/[id]`.

- [ ] **Step 1: Create the edit page (server component)**

Create `src/app/admin/users/[id]/page.tsx`:

```tsx
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth-guards";
import { prisma } from "@/lib/db";
import { UserEditor, type EditorData } from "./UserEditor";

export default async function EditUserPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole("admin");
  const { id } = await params;

  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      student: {
        select: {
          timezone: true,
          status: true,
          coachId: true,
          heightCm: true,
          currentWeightKg: true,
          targetWeightKg: true,
        },
      },
    },
  });
  if (!user) notFound();

  const [coaches, audit] = await Promise.all([
    prisma.coach.findMany({ select: { id: true, user: { select: { name: true } } } }),
    prisma.adminAuditLog.findMany({
      where: { targetUserId: id },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);

  const data: EditorData = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    student: user.student
      ? {
          timezone: user.student.timezone,
          status: user.student.status,
          coachId: user.student.coachId,
          heightCm: user.student.heightCm,
          currentWeightKg: user.student.currentWeightKg,
          targetWeightKg: user.student.targetWeightKg,
        }
      : null,
    coaches: coaches.map((c) => ({ id: c.id, name: c.user.name })),
    audit: audit.map((a) => ({
      id: a.id,
      action: a.action,
      details: a.details as Record<string, { from: unknown; to: unknown }> | null,
      createdAt: a.createdAt.toISOString(),
    })),
  };

  return <UserEditor data={data} />;
}
```

- [ ] **Step 2: Create the editor (client component)**

Create `src/app/admin/users/[id]/UserEditor.tsx`:

```tsx
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
                      heightCm: Number(heightCm),
                      currentWeightKg: Number(currentWeightKg),
                      targetWeightKg: Number(targetWeightKg),
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
```

- [ ] **Step 3: Verify type-check**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 4: Manual smoke test**

Run: `npm run dev`; from `/admin/users` click **Edit** on a student. Change name/email → Save account; set a password ≥ 8 chars → Set password; generate a reset link → Copy; change target weight and save profile. Confirm each shows a success message and "Recent changes" grows after a refresh.
Expected: all succeed; invalid inputs (e.g. target > current, duplicate email) show the error message.

- [ ] **Step 5: Commit**

```bash
git add "src/app/admin/users/[id]"
git commit -m "feat(admin): per-user edit page (identity, password, student profile)"
```

---

### Task 6: Global audit log page

**Files:**
- Create: `src/app/admin/audit/page.tsx`

**Interfaces:**
- Consumes: `prisma.adminAuditLog` (Task 1); the nav entry added in Task 4.
- Produces: route `/admin/audit`.

- [ ] **Step 1: Create the audit page (server component)**

Create `src/app/admin/audit/page.tsx`:

```tsx
import Link from "next/link";
import { requireRole } from "@/lib/auth-guards";
import { prisma } from "@/lib/db";
import { Card, CardContent } from "@/components/ui/card";

export default async function AdminAuditPage() {
  await requireRole("admin");

  const entries = await prisma.adminAuditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  // Resolve actor/target names in one round-trip.
  const ids = Array.from(
    new Set(entries.flatMap((e) => [e.actorUserId, e.targetUserId])),
  );
  const users = await prisma.user.findMany({
    where: { id: { in: ids } },
    select: { id: true, name: true },
  });
  const nameOf = new Map(users.map((u) => [u.id, u.name]));

  return (
    <main className="space-y-6">
      <h1 className="text-2xl font-bold">Audit log</h1>
      <div className="space-y-2">
        {entries.length === 0 && (
          <p className="text-sm text-muted-foreground">No audit entries yet.</p>
        )}
        {entries.map((e) => (
          <Card key={e.id}>
            <CardContent className="flex items-center justify-between gap-3 p-4 text-sm">
              <div className="min-w-0">
                <p className="font-medium">{e.action}</p>
                <p className="truncate text-muted-foreground">
                  by {nameOf.get(e.actorUserId) ?? e.actorUserId} on{" "}
                  <Link className="underline" href={`/admin/users/${e.targetUserId}`}>
                    {nameOf.get(e.targetUserId) ?? e.targetUserId}
                  </Link>
                </p>
              </div>
              <span className="shrink-0 text-muted-foreground">
                {e.createdAt.toLocaleString()}
              </span>
            </CardContent>
          </Card>
        ))}
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Verify type-check**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Manual smoke test**

Run: `npm run dev`; after making edits in Task 5, visit `/admin/audit` and confirm entries appear newest-first with actor/target names and each target links to its edit page.
Expected: entries render correctly.

- [ ] **Step 4: Commit**

```bash
git add src/app/admin/audit
git commit -m "feat(admin): global audit log page"
```

---

### Task 7: Manual-testing documentation

**Files:**
- Modify: `docs/local-manual-testing.md`

**Interfaces:**
- Consumes: everything above.

- [ ] **Step 1: Append a manual-test section**

Add to `docs/local-manual-testing.md`:

```markdown
## Admin user management

Sign in as an admin (see seed credentials).

1. **List + search:** Visit `/admin/users`. All users appear. Typing in
   the search box filters by name/email.
2. **Create a coach:** `/admin/users/new` → name + email, role "coach",
   Create. A copyable set-password link appears; the coach shows in the
   list. Open the link in a private window and set a password; the coach
   can log in.
3. **Create an admin:** same flow with role "admin".
4. **Edit identity:** Edit a user → change name/email → Save account.
   Re-using another user's email is rejected.
5. **Set password:** Edit a user → type a password (≥ 8) → Set password →
   the user can log in with it. A shorter password is rejected.
6. **Reset link:** Edit a user → Generate reset link → copy → set a new
   password via the link.
7. **Student profile:** Edit a student → change weights/timezone/status,
   reassign coach → Save profile. Target > current is rejected. The
   student's profile panel (BMI/BMR) reflects the new numbers.
8. **Audit log:** `/admin/audit` lists every change above, newest first,
   with actor + target; a password change shows no password value.
```

- [ ] **Step 2: Commit**

```bash
git add docs/local-manual-testing.md
git commit -m "docs: manual test steps for admin user management"
```

---

## Self-Review

**Spec coverage:**
- Create coach/admin → Task 3 `createUser` + Task 4 UI. ✓
- Edit name/email (any user, incl. self) → Task 3 `updateUserIdentity` + Task 5. ✓
- Password set-directly + reset-link → Task 3 `setUserPassword`/`sendPasswordReset` + Task 5. ✓
- Student profile + coach reassignment + recompute → Task 3 `updateStudentProfile` (uses `writeProfilePanel`) + Task 5. ✓
- Roles fixed (no role edit control) → no role field in editor; `createUser` limited to coach/admin. ✓
- Audit log (model, writes, per-user view, global page, no passwords) → Task 1 + `writeAudit` + Task 5 "Recent changes" + Task 6. ✓
- Admin guard on all pages/actions → `requireRole("admin")` throughout. ✓
- Email lowercase + uniqueness → `normalizeEmail` + clash checks. ✓
- Password min 8 → `passwordSchema`. ✓
- Unit tests → Task 2. ✓
- Manual tests → Task 7. ✓

**Placeholder scan:** No TBD/TODO; every code step has concrete code. ✓

**Type consistency:** `AdminActionResult` shape used uniformly; `EditorData`/`UserRow` defined where produced and imported where consumed; `ROLE_OPTIONS`/`STUDENT_STATUS_OPTIONS` used consistently; `writeProfilePanel` and `originUrl` signatures match caller usage. ✓
```

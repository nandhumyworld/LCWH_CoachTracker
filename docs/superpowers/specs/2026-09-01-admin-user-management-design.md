# Admin User Management — Design Spec

- **Date:** 2026-09-01
- **Branch:** feat/question-builder
- **Status:** Approved for planning
- **Related:** [Flary MVP design](2026-08-17-flary-mvp-design.md)

## 1. Purpose

Give an admin a single place to **create** and **edit** any user in the
system — including the admin's own account — so account data can be
corrected at any later point without touching the database or the seed
script.

Two gaps this closes:

1. There is no in-app way to create a **coach** or another **admin**
   today — they exist only via `prisma/seed.ts`.
2. There is no way for an admin to change a user's name, email,
   password, or a student's profile after creation.

## 2. Scope

### In scope

- A new **Users** area under `/admin`:
  - List of all users (any role).
  - Per-user edit page (works for every role, including editing self).
  - Create-user form.
  - Global audit-log page.
- **Create user** (admin only): role **coach** or **admin**. Passwordless
  account + one-time set-password link (reuses the invite mechanism).
- **Edit — every user:** `name`, `email`, password.
  - Password can be **set directly** (typed) **or** changed via a
    **one-time reset link** the admin copies and shares.
- **Edit — student users additionally:** `timezone`, `status`
  (invited/active/paused), `heightCm`, `currentWeightKg`,
  `targetWeightKg`, and **coach reassignment**. Changing any intake
  number recomputes the student's `ProfilePanel`.
- **Audit log:** every mutating admin action records who changed what,
  on whom, and when.

### Out of scope (YAGNI)

- **Role editing** — a user's role is fixed once created.
- Admin creating **students** — students continue to be created by
  coaches via the existing invite flow.
- Bulk edits, CSV import/export.
- Emailing reset links (the link is shown for the admin to copy, exactly
  like invites today).
- User deletion / deactivation beyond the existing student `status`.

### Terminology

There is no separate "username" field. Login identity is **`email`**;
**`name`** is the display name. "Change username" ⇒ edit `name` and/or
`email`.

## 3. Data model changes

New Prisma model for the audit trail:

```prisma
model AdminAuditLog {
  id           String   @id @default(cuid())
  actorUserId  String   // the admin who performed the action
  targetUserId String   // the user who was changed
  action       String   // e.g. "user.create", "identity.update",
                        //      "password.set", "password.reset_link",
                        //      "student.profile.update"
  details      Json?    // field-level before/after diff; never a password
  createdAt    DateTime @default(now())

  @@index([targetUserId])
  @@index([createdAt])
}
```

- No foreign-key relations are added to `User` to keep migrations simple
  and preserve log rows if a user is ever removed; `actorUserId` /
  `targetUserId` are plain string ids.
- A new migration is generated for this model. No changes to existing
  tables.

## 4. Server actions

New file `src/app/actions/admin-users.ts`. Every action begins with
`requireRole("admin")` and returns the existing `ActionResult` shape
(`{ ok, error? }`, extended with `url?` where a link is produced).

| Action | Input | Behavior |
|--------|-------|----------|
| `createUser` | `{ name, email, role: "coach" \| "admin" }` | Lowercase + uniqueness-check email. Create `User` with the chosen role, no password. For `coach`, also create the `Coach` record. Issue an invite token → return `/set-password?token=…` URL. Audit `user.create`. |
| `updateUserIdentity` | `{ userId, name, email }` | Validate name non-empty + email format. Lowercase email; reject if it belongs to a **different** user. Update. Audit `identity.update` with before/after. |
| `setUserPassword` | `{ userId, password }` | Validate password (min 8, matching `setPasswordSchema`). `hashPassword` → save `passwordHash`. Audit `password.set` (value never stored). |
| `sendPasswordReset` | `{ userId }` | `createInvite(userId)` → return `/set-password?token=…` URL. Audit `password.reset_link`. |
| `updateStudentProfile` | `{ userId, timezone, status, coachId, heightCm, currentWeightKg, targetWeightKg }` | Resolve the student by `userId`; 404 if the user is not a student. Validate: valid IANA timezone, `targetWeightKg ≤ currentWeightKg`, `coachId` exists. Update `Student`. If all three intake numbers are present, recompute `ProfilePanel` via `computeProfile` (same as `submitIntake`/`regenerateProfile`). Audit `student.profile.update` with before/after. |

### Reused building blocks

- `hashPassword` (`src/lib/password.ts`)
- `createInvite` (`src/lib/invites.ts`) + `/set-password?token=` route
- `originUrl` origin-resolution pattern (from `actions/students.ts`)
- `computeProfile` (`src/lib/profile.ts`)
- `requireRole("admin")` (`src/lib/auth-guards.ts`)

### Testable core — `src/lib/admin-users-util.ts`

Pure, runtime-free logic extracted for unit testing (mirrors
`intake-util` / `extraction-util`):

- Zod schemas: `createUserSchema`, `identitySchema`, `passwordSchema`,
  `studentProfileSchema`.
- `buildAuditDetails(before, after, fields)` → the `details` diff object,
  omitting unchanged fields and **never** including password values.
- `normalizeEmail(email)` → trimmed lowercase.

The server actions are thin wrappers that call these, run the guard, hit
Prisma, and write the audit row.

## 5. UI

Add **Users** to the admin nav in `src/app/admin/layout.tsx`.

- **`/admin/users/page.tsx`** (server component)
  - Loads all users with role + status (student status where applicable).
  - Renders a client `UsersList` with a name/email search box, a role
    badge per row, and a **Create user** button.
- **`/admin/users/new`** — create form (name, email, role select:
  coach/admin). On success shows the copyable set-password link, reusing
  the `InviteLink` copy-to-clipboard component pattern from
  `StudentsManager`.
- **`/admin/users/[id]/page.tsx`** (server component)
  - Loads the user, their student/coach record if any, the list of
    coaches (for reassignment), and recent audit entries for this user.
  - Renders `UserEditor` (client).
- **`UserEditor.tsx`** (client) — sections:
  1. **Account** — name, email → `updateUserIdentity`.
  2. **Password** — tab/toggle between "Set a new password" →
     `setUserPassword`, and "Generate reset link" → `sendPasswordReset`
     (shows copyable link).
  3. **Student profile** — only when the user is a student: timezone,
     status, coach dropdown, height, current/target weight →
     `updateStudentProfile`.
  4. **Recent changes** — read-only list of this user's audit entries.
- **`/admin/audit/page.tsx`** — global reverse-chronological audit list
  (actor, target, action, timestamp, summarized diff).

All UI reuses existing `Card`, `Input`, `Label`, `Button`, `Select`
primitives and the `useTransition` + `ActionResult` interaction pattern
from `StudentsManager`.

## 6. Security & validation

- Every page under `/admin/*` and every action is `admin`-guarded.
- Email uniqueness is enforced on create and on identity edit (excluding
  the user being edited).
- Password minimum length is 8, matching `setPasswordSchema`.
- Passwords are never written to the audit log.
- Because role is not editable, there is no self-lockout path to guard.
- Coach reassignment only accepts an existing `coachId`.

## 7. Testing

`src/lib/__tests__/admin-users.test.ts` (following the existing lib-test
style):

- `normalizeEmail` lowercases/trims.
- `createUserSchema` rejects bad email / invalid role.
- `passwordSchema` rejects < 8 chars.
- `studentProfileSchema` rejects `target > current` and invalid tz.
- `buildAuditDetails` returns only changed fields and omits password
  values.
- Profile-recompute expectation: given changed weights, the values fed
  to `computeProfile` match the new inputs (guards the recompute wiring).

Manual test steps are appended to `docs/local-manual-testing.md`.

## 8. Rollout

1. Prisma migration for `AdminAuditLog`.
2. `admin-users-util.ts` + tests (TDD).
3. Server actions.
4. Pages + `UserEditor` / `UsersList` components + nav entry.
5. Manual-testing doc update.

No change-request (CR) entry — this is a planned feature, tracked via
this spec and its implementation plan.

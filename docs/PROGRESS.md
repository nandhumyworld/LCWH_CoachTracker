# LCWH (Flary) — Build Progress

**Last updated:** 2026-08-18 (end of Phase 9)
**Active branch:** `feat/question-builder` (all phases stacked here; not yet merged to `main`)
**Plan:** `docs/superpowers/plans/2026-08-17-lcwh-mvp.md`
**Spec:** `docs/superpowers/specs/2026-08-17-flary-mvp-design.md`
**Deploy guide:** `docs/deploy-coolify.md`

---

## How to resume

1. `cd` into the repo, `git checkout feat/question-builder && git pull`.
2. `npm install` (if deps changed).
3. Ensure `.env` has a real `DATABASE_URL` (already set — remote Coolify Postgres `LCWH_test` at 69.62.84.73), `AUTH_SECRET`, `CRON_SECRET`. For Phase 6, add `OPENROUTER_API_KEY`.
4. Sanity check: `npm test` (should pass 24), `npm run build` (green), `npm run dev` → http://localhost:3000.

### Verification commands
- `npm test` — 56 unit tests (pure logic + mocked-IO report generation).
- `npm run typecheck` — tsc, clean.
- `npm run lint` — clean.
- `npm run build` — Next standalone, green.
- Live app: `npm run dev`, then log in as coach `flary@lcwh.local` / `changeme-coach` (seeded).

---

## Status by phase

| Phase | Scope | Status |
|-------|-------|--------|
| 0 | Foundation, Docker, Prisma schema, initial migration, seed | ✅ done |
| 1 | Auth.js credentials, RBAC, middleware, invite/set-password | ✅ done |
| 2 | Coach question builder (8 types, options, reorder), form settings | ✅ done |
| 3 | Student invite → intake → computed profile panel | ✅ done |
| 4 | Daily check-in, image storage + auth serving, submit/lock, past days | ✅ done |
| 5 | Per-timezone auto-submit engine + `/api/cron/auto-submit` (n8n) | ✅ done |
| 6 | AI reports (OpenRouter): prompt filling, generateReport, admin prompt editor | ✅ done |
| 7 | Daily gate message + attendance | ✅ done |
| 8 | Coach dashboard + attendance view | ✅ done |
| 9 | Admin settings + generation logs | ✅ done |
| **10** | **Photo retention cleanup + `/api/cron/photo-cleanup` (n8n)** | ⏭️ **NEXT** |
| 11 | Deploy hardening on Coolify | ⬜ todo |

---

## Phase 6 — DONE (AI reports via OpenRouter)

Delivered (branch `feat/question-builder`, commits 402343e → 2c32949):
- **6.1 Prompt filling** (`src/lib/prompt.ts`, unit-tested): `fillPrompt(body, ctx)` replaces `{{q.<key>}}` / `{{profile.<field>}}`; image answers become vision inputs `{questionKey, imageId}[]` (token stripped); unknown placeholders → empty + `warnings`.
- **6.2 OpenRouter client + generateReport** (`src/lib/openrouter.ts`, `src/lib/report.ts`): vision-capable `callOpenRouter` (pure `buildMessages`/`parseCompletion`/`bufferToDataUrl` unit-tested). `generateReport` loads answers+profile+images, resolves `modelId` (coach's linked `PromptTemplate` → `OPENROUTER_DEFAULT_MODEL`), fills prompt, sends images as data URLs, records body+model+tokens+cost, sets `done`/`failed`. **It never throws** (captures its own error on the Report). Wired into `submitEntryAction` (now awaits it) and `runAutoSubmit`. Admin `retryReport` in `src/app/actions/report.ts`.
- **6.3 Admin prompt editor** (`/admin/prompt` + `src/app/actions/prompt.ts`): edit `PromptTemplate.body` + `modelId`, bumps `version`, shows `{{q.<key>}}`/`{{profile.*}}` placeholders; saving links every coach's `ProgramSettings` to the template. Seed now creates a default template linked to the coach.

**Live-test note:** unit tests use a MOCKED OpenRouter client (`report.test.ts` mocks `@/lib/db`, `@/lib/storage`, `@/lib/openrouter`, `@/lib/env`). A full live test needs a real `OPENROUTER_API_KEY` in `.env` — then submit a day as a student and confirm the Report row fills in.

**Design note:** `submitEntryAction` awaits `generateReport`, so the submit response blocks on the LLM call (acceptable for MVP single-container; revisit if latency hurts UX — could move to a queue/background).

---

## Phase 7 — DONE (Daily gate message + attendance)

Delivered (commits 117a471 → ce96e8d):
- **7.1** `src/lib/gate-util.ts` (pure `isSchedulableDate`/`daysBetweenLocalDates`, today..+7, unit-tested) + `src/lib/gate.ts` IO (`scheduleGateMessage` one-per-`[coachId,scheduledDate]` upsert, `gateForStudentToday` resolves by the student's local date + acknowledged flag, `acknowledgeGate` idempotent). Actions: coach `scheduleGateAction`, student `acknowledgeGateAction` (re-checks the gate is today's before writing).
- **7.2** Coach `/coach/gate` composer (date + message + ack label, ≤1wk ahead, lists upcoming w/ ack counts). Student `GateGuard` full-screen blocking popup wired into `src/app/student/layout.tsx` (shows only after intake, when an unacknowledged gate exists); ack records attendance + `router.refresh()` to dismiss. "Daily message" added to coach nav.

**Note:** coach schedule-window "today" uses UTC (no per-coach timezone in schema) — a convenience bound, not the hard student day-lock. Gate IO verified via typecheck+build (dominant convention: prisma fns aren't vitest-tested).

---

## Phase 8 — DONE (Coach dashboard + attendance view)

Commits 7d01e42 → 43920b7. `src/lib/dashboard.ts` pure helpers (`todayStatusLabel`, `reportStatusLabel`, `pickWeight`, unit-tested). `/coach` = all-student roster with today's status/report/latest-weight (today per student tz). `/coach/students/[id]` gained a collapsible read-only daily history (answers incl. photos + report). `/coach/attendance` = per-date gate acknowledgements w/ date picker (FR-25). Nav updated.

## Phase 9 — DONE (Admin surface)

Commits 58918e7 → 3939a4f. `src/lib/settings-util.ts` (pure `parseRetentionDays` + `SETTING_KEYS`, unit-tested) + `src/lib/settings.ts` (get/set + `getPhotoRetentionDays`/`getDefaultModel`, SystemSetting → env fallback). `report.ts` fallback model now via `getDefaultModel`; `images.ts` upload expiry via `getPhotoRetentionDays`. New admin layout/nav + overview, `/admin/settings` (retention + default model), `/admin/logs` (reports w/ status/model/tokens/cost/error + Retry on failed → `retryReport`).

---

## Next up: Phase 10 (Photo retention cleanup — cron)

See plan § "Phase 10". TDD (mock prisma + storage) `src/lib/photo-cleanup.ts::runPhotoCleanup(now)`: find `StoredImage` with `expiresAt < now` and `deletedAt=null`, call `getStorage().delete(storageKey)`, set `deletedAt` (keep the metadata row, NFR-3). Retention days from `getPhotoRetentionDays()`. Wire `POST /api/cron/photo-cleanup` → `runPhotoCleanup()`. Then Phase 11 = deploy hardening.

---

## Key conventions / gotchas (carry forward)

- **Branch:** keep stacking phases on `feat/question-builder` until merges to `main` happen (GitHub merge was blocked; user merges manually).
- **Commits:** one per task, TDD (red → green → commit). Trailer: `Co-Authored-By: Claude Opus 4.8` + `Claude-Session`.
- **Migrations on hosted Postgres:** the DB role can't create Prisma's shadow DB, so `prisma migrate dev` FAILS. Use `prisma migrate diff --from-schema-datasource ... --to-schema-datamodel ... --script > migration.sql` then `prisma migrate deploy`. (See plan Phase 0.)
- **Pure vs IO split:** pure logic goes in `*-util.ts` / plain libs (unit-tested via vitest); anything importing `@/auth`, `next/*`, or Prisma is verified via DB integration scripts + HTTP, NOT vitest (importing `@/auth` drags in `next/server` and breaks node tests).
- **Guards:** `requireRole`, `requireCoach`, `requireStudent` in `src/lib/auth-guards.ts` scope every action to the caller.
- **Env:** access via `src/lib/env.ts` (lazy Zod validation — do not parse at import time or the build breaks).
- **Storage:** always via `getStorage()` (`src/lib/storage`); never touch `fs` in feature code. Local dev writes to `C:\data\uploads` (from `STORAGE_LOCAL_DIR=/data/uploads`).
- **Emails:** always lowercased on store and lookup.
- **Vitest on Windows:** config is `vitest.config.mts` with `pool: "threads"` (forks pool throws EPERM on teardown).
- **Test cleanup:** DB integration scripts create throwaway users and delete them (by email prefix / name) at the end. Don't leave test data in `LCWH_test`.
- **Seeded accounts:** admin `admin@lcwh.local` / `changeme-admin`, coach (Flary) `flary@lcwh.local` / `changeme-coach`.

---

## Tracked follow-ups (post-MVP, not blocking)

- Next 16 upgrade to clear transitive `sharp`/bundled-`postcss` high advisories (breaking major).
- `next lint` is deprecated in Next 15.5 → migrate to ESLint CLI.
- Auto-submit: optionally create entries for active students who never opened the form (stricter "missed" attendance).
- Stray `package-lock.json` in the user's home dir (`C:\Users\NANDHU\`) — unrelated; tracing root already pinned so it doesn't interfere.

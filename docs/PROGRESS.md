# LCWH (Flary) — Build Progress

**Last updated:** 2026-08-17 (end of Phase 5)
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
- `npm test` — 24 unit tests (pure logic).
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
| **6** | **AI reports (OpenRouter): prompt filling, generateReport, admin prompt editor** | ⏭️ **NEXT** |
| 7 | Daily gate message + attendance | ⬜ todo |
| 8 | Coach dashboard + attendance view | ⬜ todo |
| 9 | Admin settings + generation logs | ⬜ todo |
| 10 | Photo retention cleanup + `/api/cron/photo-cleanup` (n8n) | ⬜ todo |
| 11 | Deploy hardening on Coolify | ⬜ todo |

---

## Next up: Phase 6 (AI reports via OpenRouter)

Detailed tasks in the plan (§ "Phase 6"). Order:
1. **6.1 Prompt filling** (`src/lib/prompt.ts`, TDD): `fillPrompt(body, ctx)` → replaces `{{q.<key>}}` and `{{profile.<field>}}`; image answers become vision inputs `{questionKey, imageId}[]`; unknown placeholders → empty + warning.
2. **6.2 OpenRouter client + generateReport** (`src/lib/openrouter.ts`, `src/lib/report.ts`): replace the current no-op `generateReport` stub. Load answers+profile+images, resolve `modelId` (PromptTemplate → `OPENROUTER_DEFAULT_MODEL`), fill prompt, call OpenRouter (vision, images as data URLs), store body+model+tokens+cost, set status done/failed. Wire into `submitEntryAction` and `runAutoSubmit` (auto-submit already calls the stub). Add `retryReport` (admin).
3. **6.3 Admin prompt editor** (`/admin/prompt`): edit `PromptTemplate.body` + `modelId`, show available `{{q.<key>}}` placeholders.

**Note:** Build + unit-test with a MOCKED OpenRouter client. Full live test needs `OPENROUTER_API_KEY` in `.env`. The `generateReport` stub currently lives at `src/lib/report.ts` and is already called by `runAutoSubmit` (errors swallowed so the sweep never aborts). `submitEntryAction` creates the pending report but does NOT yet call `generateReport` — wire that in Phase 6.

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

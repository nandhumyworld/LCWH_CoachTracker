# LifeChanging Wellness Hub (LCWH)

Coaching-tracker app. A coach builds a daily check-in program; students answer
it every day; an AI generates a per-student daily report. Repo/working name:
**Flary**. See `requirements.md` and `docs/superpowers/specs/` for the spec, and
`docs/superpowers/plans/` for the implementation plan.

## Stack

- Next.js 15 (App Router, standalone output) · React 19 · TypeScript
- Tailwind CSS + shadcn/ui
- Prisma + PostgreSQL
- Auth.js (NextAuth v5), 3 roles: admin / coach / student
- OpenRouter for AI reports (vision-capable, model configurable by Admin)
- Local-disk image storage behind a swappable `StorageService` interface
- Scheduled jobs (auto-submit, photo cleanup) triggered by **n8n** hitting
  secret-protected `/api/cron/*` routes

## Run locally (Docker — matches production topology)

```bash
cp .env.example .env.local   # only needed for host-side prisma commands
docker compose up --build
# app  → http://localhost:3000
# db   → localhost:5432 (postgres/lcwh)
```

The app container runs `prisma migrate deploy` on boot (see
`docker-entrypoint.sh`). To seed the admin + coach users:

```bash
docker compose exec app node node_modules/prisma/build/index.js migrate deploy
docker compose exec app npx tsx prisma/seed.ts
```

## Run locally (without Docker)

```bash
npm install
# point DATABASE_URL at a local/remote Postgres in .env.local
npm run prisma:migrate      # create + apply migrations in dev
npm run db:seed
npm run dev
```

## Environment

Copy `.env.example` and fill in values. Key vars: `DATABASE_URL`,
`AUTH_SECRET`, `CRON_SECRET`, `OPENROUTER_API_KEY`, `STORAGE_LOCAL_DIR`,
`PHOTO_RETENTION_DAYS`.

## Production (Coolify)

See `docs/deploy-coolify.md` for the full walkthrough. Summary:

1. Create a **PostgreSQL** resource in Coolify; copy its internal connection
   string.
2. Create an **Application** from this Git repo (Dockerfile build).
3. Set env vars (`DATABASE_URL` = the internal string, `AUTH_SECRET`,
   `CRON_SECRET`, `OPENROUTER_API_KEY`, …).
4. Add a **persistent volume** mounted at `/data` (uploaded photos).
5. Set the health check path to `/api/health`.
6. In **n8n**, add two scheduled workflows that `POST` to
   `/api/cron/auto-submit` (every 15 min) and `/api/cron/photo-cleanup`
   (daily), each sending `Authorization: Bearer <CRON_SECRET>`.

## Scheduled jobs via n8n

Both cron routes are `POST`, reject anything without
`Authorization: Bearer <CRON_SECRET>`, and are safe to trigger manually from
n8n while testing.

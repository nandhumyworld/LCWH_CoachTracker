# Deploying LCWH to Coolify

This app is a single Next.js container plus an external PostgreSQL database,
both hosted on your Hostinger VPS via Coolify. Scheduled jobs are driven by
n8n, not by the app process.

## 1. Create the database

1. In Coolify → your project → **+ New Resource → Database → PostgreSQL**
   (v16). Give it a name (e.g. `lcwh-db`).
2. After it starts, open the DB → **Connection** and copy the **internal**
   connection string. It looks like:

   ```
   postgresql://<user>:<password>@<internal-host>:5432/<db>?schema=public
   ```

   Use the **internal** host (service name on Coolify's network), not the
   public one — the app talks to the DB over the internal network.

> When you create the DB, send me back this connection string (or set it
> yourself as `DATABASE_URL` in step 3). Nothing else in the app needs to
> change to point at it.

## 2. Create the application

1. **+ New Resource → Application → Public/Private Git Repository**, pick this
   repo and branch.
2. Build pack: **Dockerfile** (Coolify auto-detects `Dockerfile` at the repo
   root). No build command needed — the Dockerfile handles build + migrate.
3. Port: **3000**.

## 3. Environment variables

Set these on the Application (Coolify → app → **Environment Variables**):

| Variable | Value |
|---|---|
| `DATABASE_URL` | internal connection string from step 1 |
| `AUTH_SECRET` | `openssl rand -base64 32` |
| `AUTH_URL` | the app's public URL, e.g. `https://lcwh.yourdomain.com` |
| `CRON_SECRET` | `openssl rand -base64 32` (used by n8n) |
| `OPENROUTER_API_KEY` | your OpenRouter key |
| `OPENROUTER_DEFAULT_MODEL` | e.g. `openai/gpt-4o-mini` (Admin can override in-app) |
| `STORAGE_DRIVER` | `local` |
| `STORAGE_LOCAL_DIR` | `/data/uploads` |
| `PHOTO_RETENTION_DAYS` | e.g. `30` |
| `NEXT_PUBLIC_APP_NAME` | `LifeChanging Wellness Hub` |
| `NEXT_PUBLIC_APP_SHORT_NAME` | `LCWH` |

## 4. Persistent volume for photos

Coolify → app → **Storage / Volumes** → add a persistent volume mounted at
`/data`. Uploaded photos live in `/data/uploads`; this survives redeploys.

## 5. Health check

Set the health check path to `/api/health` (returns 200 when the app and DB
are up). Coolify uses it to gate deploys.

## 6. First deploy

Deploy. On boot the container runs `prisma migrate deploy` automatically. To
seed the Admin + Coach accounts once:

```bash
# From Coolify's app terminal (or an exec into the container):
SEED_ADMIN_EMAIL=admin@yourdomain.com \
SEED_ADMIN_PASSWORD='a-strong-password' \
SEED_COACH_EMAIL=flary@yourdomain.com \
SEED_COACH_PASSWORD='a-strong-password' \
npx tsx prisma/seed.ts
```

## 7. Scheduled jobs in n8n

Create two n8n workflows (both **Schedule Trigger → HTTP Request**):

1. **Auto-submit** — every 15 minutes:
   - Method: `POST`
   - URL: `https://lcwh.yourdomain.com/api/cron/auto-submit`
   - Header: `Authorization: Bearer <CRON_SECRET>`

2. **Photo cleanup** — daily (e.g. 03:00):
   - Method: `POST`
   - URL: `https://lcwh.yourdomain.com/api/cron/photo-cleanup`
   - Header: `Authorization: Bearer <CRON_SECRET>`

Both routes return JSON and are safe to run manually from n8n's "Execute
Workflow" button while testing. A missing/wrong bearer token returns `401`.

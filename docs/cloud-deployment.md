# LCWH — Cloud Deployment (Coolify)

How to deploy LCWH to a Coolify-managed VPS (e.g. Hostinger).

Two build packs work — pick one in step 2:

- **Dockerfile (recommended)** — Coolify builds the repo [`Dockerfile`](../Dockerfile)
  directly. Simplest for a single app + external DB; Coolify manages env, the
  persistent volume, the proxy, restarts, and health checks from its UI.
- **Docker Compose** — Coolify uses [`docker-compose.cloud.yml`](../docker-compose.cloud.yml).
  Choose this if you want the volume/health check/required-env declared in the
  repo, or plan to co-deploy sidecars later.

Everything else in this guide (env vars, DB, migrations, verification, cron) is
the same for both.

## Architecture

```
Internet ──HTTPS──▶ Coolify (Traefik proxy, TLS)
                         │  routes your domain → container:3000
                         ▼
                  ┌──────────────┐        ┌─────────────────────┐
                  │  app (Next)  │──SQL──▶ │ Postgres (external) │
                  │  container   │        │  managed / VPS DB   │
                  └──────┬───────┘        └─────────────────────┘
                         │ writes uploads
                         ▼
                  lcwh_uploads volume (/data/uploads)
```

- **One app container** built from the repo `Dockerfile` (Next.js standalone).
- **External Postgres** — this compose does **not** run its own DB. Point
  `DATABASE_URL` at a managed Postgres (the existing `LCWH_test`, or a Postgres
  you create in Coolify).
- **Coolify's proxy** terminates TLS and routes your domain to the container's
  exposed port `3000` (the compose uses `expose:`, not published host ports).
- **Migrations auto-apply**: the image entrypoint runs `prisma migrate deploy`
  on every boot, so pending migrations (including `AdminAuditLog`) are applied
  when the container starts.
- **Uploads** persist in the `lcwh_uploads` volume mounted at `/data`.

## Prerequisites

- A Coolify server connected to your VPS, with a wildcard/subdomain DNS record
  pointing at it (e.g. `app.yourdomain.com`).
- A reachable Postgres database and its connection string.
- The GitHub repo connected to Coolify (or a deploy key configured).

## Environment variables

Set these in the Coolify service's **Environment Variables** UI. Required vars
have no default. With the **Docker Compose** build pack the deploy fails fast
if a required var is missing (the `${VAR:?}` markers); with the **Dockerfile**
build pack there's no such guard, so double-check the required four are set or
the app will error at runtime (e.g. broken sign-in on a missing `AUTH_URL`).

| Variable | Required | Example / default | Notes |
|---|---|---|---|
| `DATABASE_URL` | ✅ | `postgres://user:pass@host:5432/LCWH_test` | Use the **internal** host if the DB is a Coolify service. URL-encode special chars in the password. |
| `AUTH_SECRET` | ✅ | `openssl rand -base64 32` | Auth.js session signing key. |
| `AUTH_URL` | ✅ | `https://app.yourdomain.com` | Must be the **public HTTPS domain** or sign-in callbacks break. |
| `CRON_SECRET` | ✅ | long random string | Bearer token n8n must send to `/api/cron/*`. |
| `OPENROUTER_API_KEY` | — | (empty) | Needed for AI reports/image extraction; set before using those features. |
| `OPENROUTER_DEFAULT_MODEL` | — | `openai/gpt-4o-mini` | Fallback model when the Admin hasn't set one. |
| `STORAGE_DRIVER` | — | `local` | Local-disk storage for the MVP. |
| `STORAGE_LOCAL_DIR` | — | `/data/uploads` | Must sit under the mounted volume. |
| `PHOTO_RETENTION_DAYS` | — | `90` | Photo-cleanup cron deletes files older than this. |
| `SEED_ADMIN_EMAIL` | — | `admin@lcwh.co.in` | Used only when you run the seed. |
| `SEED_ADMIN_PASSWORD` | — | `admin123` | Change for production. |
| `SEED_COACH_EMAIL` | — | `flary@lcwh.co.in` | |
| `SEED_COACH_PASSWORD` | — | `coach123` | Change for production. |
| `NEXT_PUBLIC_APP_NAME` | — | `Life Changing Wellness Hub` | Branding. |
| `NEXT_PUBLIC_APP_SHORT_NAME` | — | `LCWH` | Branding. |

> ⚠️ **Production passwords:** change the `SEED_ADMIN_PASSWORD` /
> `SEED_COACH_PASSWORD` from their defaults before seeding a production DB, or
> rotate them right after first login via the admin Users screen.

## Deployment steps

### 1. Provision Postgres

Either reuse the existing managed Postgres, or in Coolify create a **PostgreSQL**
resource. Note its **internal** connection string (host, port, db, user,
password) — that becomes `DATABASE_URL`.

### 2. Create the app resource

**Option A — Dockerfile build pack (recommended):**

1. Coolify → **+ New** → **Application** → your Git repository + branch.
2. Set **Build Pack** to **Dockerfile** (Coolify uses the repo `Dockerfile`).
3. Set the **Ports Exposes** field to `3000`.
4. Persistent volume + health check are configured in the UI — see steps 5–6.

**Option B — Docker Compose build pack:**

1. Coolify → **+ New** → **Docker Compose** → your Git repository + branch.
2. Set the **Compose file path** to `docker-compose.cloud.yml`. The volume,
   health check, and `${VAR:?}` required-env enforcement come from that file.

### 3. Configure domain

Assign a **Domain** to the `app` service (e.g. `https://app.yourdomain.com`).
Coolify provisions TLS (Let's Encrypt) and routes the domain to port `3000`.
Do **not** add published host ports — the proxy handles ingress.

### 4. Configure environment

Add every **Required** variable from the table above (plus
`OPENROUTER_API_KEY` if you're using AI features). Set `AUTH_URL` to the exact
domain from step 3.

### 5. Configure persistent storage

Uploaded images live under `/data` and must survive redeploys:

- **Dockerfile build pack:** Coolify → resource → **Storage** → add a
  **Persistent Storage** mount at `/data`.
- **Docker Compose build pack:** ensure the `lcwh_uploads` volume is marked
  **persistent** (Coolify lists named volumes under the Storage tab).

### 6. Deploy

Trigger **Deploy**. On boot the entrypoint runs `prisma migrate deploy` (watch
the logs for `[entrypoint] Running prisma migrate deploy...`), then starts the
Next.js server.

### 7. Seed the first admin + coach (first deploy only)

If the database is empty, open a terminal on the running container (Coolify →
resource → **Terminal / Execute Command**) and run:

```sh
node node_modules/prisma/build/index.js db seed
# or, if tsx is available in the image build:
# npx prisma db seed
```

This is idempotent (upserts by email). It creates the admin/coach from the
`SEED_*` env vars and the default AI prompt templates. Skip this if you're
deploying against a database that already has users.

## Post-deploy verification

```sh
# Health (also checks DB connectivity) — expect {"status":"ok","db":"up"}
curl -s https://app.yourdomain.com/api/health

# Login page renders
curl -s -o /dev/null -w "%{http_code}\n" https://app.yourdomain.com/login
```

Then sign in at `https://app.yourdomain.com/login` with your admin credentials
and confirm the admin area (`/admin`, `/admin/users`, `/admin/audit`) loads.

## Scheduled jobs (n8n / cron)

Two protected endpoints must be called on a schedule. Both are **POST** and
require the header `Authorization: Bearer <CRON_SECRET>`:

| Endpoint | Suggested schedule | Purpose |
|---|---|---|
| `POST /api/cron/auto-submit` | every ~15 min | Auto-submits students past local 23:59 and enqueues report generation. |
| `POST /api/cron/photo-cleanup` | daily | Deletes uploaded photos older than `PHOTO_RETENTION_DAYS`. |

Example (n8n HTTP Request node or curl):

```sh
curl -X POST https://app.yourdomain.com/api/cron/auto-submit \
  -H "Authorization: Bearer $CRON_SECRET"
```

## Redeploys & migrations

- Push to the deploy branch (or click **Redeploy**). Coolify rebuilds the image;
  the entrypoint applies any new migrations automatically.
- New migrations must be committed under `prisma/migrations/`. `migrate deploy`
  only applies already-generated migrations — it never creates them.

## Rollback

- Redeploy a previous commit/build from Coolify's deployment history.
- **Caution:** a rollback does **not** revert database migrations. If a release
  included a destructive migration, roll the DB back from a backup rather than
  relying on an app rollback.

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Deploy fails: `required variable X is missing a value` | A required env var isn't set in Coolify | Set it in the Environment UI and redeploy. |
| `/api/health` returns 503 `db: down` | Wrong/unreachable `DATABASE_URL` | Verify the internal host/port/credentials; confirm the DB resource is running. |
| Login fails with `CredentialsSignin` for known-good creds | App is pointed at the wrong DB, or no admin seeded | Confirm `DATABASE_URL` targets the intended DB; seed the admin (step 7). |
| Sign-in redirects/callbacks break | `AUTH_URL` not the real HTTPS domain | Set `AUTH_URL` to the exact public URL and redeploy. |
| Uploaded images disappear after redeploy | `lcwh_uploads` not persistent | Mark the volume persistent in the Storage tab. |
| Cron endpoints return 401 | Missing/incorrect Bearer token | Send `Authorization: Bearer <CRON_SECRET>` matching the env value. |

## Related

- [`Dockerfile`](../Dockerfile) — multi-stage build + runtime image (Dockerfile build pack).
- [`docker-compose.cloud.yml`](../docker-compose.cloud.yml) — deploy manifest for the Compose build pack.
- [`docker-entrypoint.sh`](../docker-entrypoint.sh) — runs `prisma migrate deploy` on boot.
- [`docker-compose.yml`](../docker-compose.yml) — local dev stack (app + Postgres).

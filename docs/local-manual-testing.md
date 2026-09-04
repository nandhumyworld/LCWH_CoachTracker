# LCWH — Local Manual Testing (Docker + Cloud DB)

Run the **real production container** on your machine, pointed at the **cloud
Postgres** (`LCWH_test` on the Coolify VPS). This is the closest thing to prod
without deploying.

> The app talks to the shared cloud DB. Anything you create (students, check-ins,
> reports) is **real data** in `LCWH_test`. Clean up test students when done.

---

## 0. Prerequisites (one time)

- **Docker Desktop** installed and **running** (whale icon steady, not spinning).
- `.env` present in the repo root with the cloud `DATABASE_URL` and secrets
  already filled in (done — `AUTH_SECRET`, `CRON_SECRET`, `OPENROUTER_API_KEY`
  are set). `.env` is gitignored; never commit it.

Check Docker is up:

```bash
docker info    # should print server info, not an error
```

---

## 1. Start the app

From the repo root (`C:\Users\NANDHU\Documents\SocialEagle\Digital Clients\Flary\LCWH`):

```bash
docker compose -f docker-compose.cloud.yml up -d --build
```

- First run builds the image (a few minutes). Later runs are fast.
- On boot the container runs `prisma migrate deploy` (a no-op when the DB is
  already up to date) and starts Next.js on port 3000.

Wait until healthy:

```bash
docker ps                     # STATUS should show "(healthy)"
curl http://localhost:3000/api/health
# → {"status":"ok","db":"up"}
```

Watch logs live if you want:

```bash
docker logs -f lcwh-app
```

Open the app: **http://localhost:3000**

---

## 2. Seeded accounts

| Role  | Email               | Password         |
|-------|---------------------|------------------|
| Admin | `admin@lcwh.local`  | `changeme-admin` |
| Coach | `flary@lcwh.local`  | `changeme-coach` |

Students are created by inviting them (below) — they set their own password.

If the accounts ever seem missing, re-seed (idempotent) from the host:

```bash
npm run db:seed
```

---

## 3. End-to-end test flow

### A. Coach sets up the program
1. Log in at `/login` as **coach** → lands on `/coach` (dashboard).
2. **Questions** (`/coach/questions`): add a few questions. Suggested set to
   exercise every feature:
   - `weight` — Number (required)
   - `mood` — Linear scale 1–5
   - `lunch_photo` — Image
   - `notes` — Paragraph
   (The prompt placeholders use each question's **key**, e.g. `{{q.weight}}`.)
3. **Form settings** (`/coach/settings`): set a description + a submission
   (thank-you) message.
4. **Daily message** (`/coach/gate`): schedule a message for **today** with an
   acknowledge-button label. (This is the full-screen gate the student must clear.)

### B. Coach invites a student
1. **Students** (`/coach/students`): invite by name + email.
2. Copy the generated **set-password link** (email delivery is out of MVP scope).

### C. Student onboards
1. Open the set-password link (use a separate browser / incognito) → set a
   password → log in.
2. First login hits the **gate popup** (from step A.4) — it blocks the app until
   you tap the acknowledge button. This records **attendance**.
3. **Intake** (`/student/intake`): pick a timezone (e.g. `Asia/Kolkata`), enter
   height + current/target weight → the **profile panel** (BMI/BMR/weight-to-lose)
   renders on the dashboard.

### D. Student daily check-in + AI report
1. **Today** (`/student/today`): answer the questions, upload a photo for the
   image question, then **Submit**.
2. On submit the app calls **OpenRouter** and generates the daily report
   (`OPENROUTER_API_KEY` is set, so this is live). Give it a few seconds.
3. The report appears on that day's view (`/student/day/<date>`).

### E. Coach reviews
1. `/coach` — the student now shows today's status + report status + latest weight.
2. `/coach/students/<id>` — expand the day to see answers (incl. the photo) and
   the AI report.
3. `/coach/attendance` — confirm the student's gate acknowledgement (with time).

### F. Admin
1. Log in as **admin** → `/admin`.
2. `/admin/prompt` — edit the report prompt + model; the placeholder chips show
   your question keys.
3. `/admin/settings` — change photo-retention days / default model.
4. `/admin/logs` — see each generated report (status, model, tokens, cost). If a
   report **Failed**, use **Retry**.

---

## 4. Testing the scheduled jobs (cron)

The cron routes are normally called by n8n. Trigger them manually with the
`CRON_SECRET` from `.env` (`Authorization: Bearer <secret>`):

```bash
# Auto-submit: locks open entries whose local 11:59 PM has passed + generates reports
curl -X POST http://localhost:3000/api/cron/auto-submit \
  -H "Authorization: Bearer <CRON_SECRET>"
# → {"ok":true,"scanned":N,"processed":M}

# Photo cleanup (Phase 10 — currently a secured stub until implemented)
curl -X POST http://localhost:3000/api/cron/photo-cleanup \
  -H "Authorization: Bearer <CRON_SECRET>"
```

Without the header both return **401** (that's correct).

---

## 5. Common operations

```bash
# Rebuild + restart after a code change
docker compose -f docker-compose.cloud.yml up -d --build

# Stop (keeps the uploads volume)
docker compose -f docker-compose.cloud.yml down

# Stop and wipe uploaded photos (the named volume)
docker compose -f docker-compose.cloud.yml down -v

# Tail logs
docker logs -f lcwh-app

# Open a shell in the container
docker exec -it lcwh-app sh
```

Uploaded photos live in the Docker named volume `lcwh_uploads` (mounted at
`/data/uploads` in the container). They are **not** in Postgres.

---

## 6. Troubleshooting

| Symptom | Fix |
|---|---|
| `docker info` errors / build fails to connect | Docker Desktop isn't running — start it, wait for the whale icon to settle. |
| `/api/health` shows `db:"down"` | The cloud DB is unreachable — check your network / the VPS (`69.62.84.73:5432`) and the `DATABASE_URL` in `.env`. |
| Report stays "Generating…" / shows Failed | Check `docker logs lcwh-app` around submit time; verify `OPENROUTER_API_KEY` is valid and the model id in `/admin/prompt` exists on OpenRouter. Use `/admin/logs` → Retry. |
| Login fails for a seeded account | Re-run `npm run db:seed` (idempotent). |
| Port 3000 already in use | Stop whatever owns it, or change the left side of `"3000:3000"` in `docker-compose.cloud.yml`. |
| Photo upload rejected | Must be an image ≤ 10 MB (jpg/png/webp/gif/heic). |

---

## 7. Cleanup after testing

- Delete test students you created (via the DB or a future admin tool — there's
  no delete-student UI in the MVP yet).
- `docker compose -f docker-compose.cloud.yml down` to stop the app.

Remember: this ran against the **shared cloud DB**, so test data persists there
until removed.

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

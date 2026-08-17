# Flary — Single-Coach Core-Loop MVP — Design Spec

**Date:** 2026-08-17
**Status:** Approved for planning (pending user review of this doc)
**Scope:** MVP #1 of a larger coaching-tracker platform. This spec covers the
single-coach core loop only. Billing, multi-coach self-signup, gamification,
and scheduled broadcasts are explicitly out of scope and will get their own
specs later.

---

## 1. Problem & Goal

Digital coaches (e.g. a weight-loss coach) cannot easily track their students'
daily adherence and progress. Flary lets a coach define a daily check-in
program; students answer it every day; an AI generates a per-student daily
report (including calorie estimation from meal photos and alignment to the
student's goal). This MVP proves the end-to-end loop with **one coach**.

**Success criteria:** A coach can build a daily question set, invite a student,
have that student complete intake + answer the daily form (with photos), and
receive an accurate AI daily report — with the day locking correctly at the
student's local 11:59 PM.

---

## 2. Roles

Three roles, all built in this MVP (Admin kept minimal):

| Role | Responsibilities |
|------|------------------|
| **Admin** (platform owner) | Manage the coach account. Create/edit the AI **report prompt template** (with answer-injection placeholders). Set the **AI model** (OpenRouter model id) and other system settings. View system/health + generation logs. |
| **Coach** | Build the program: intake fields, the fixed daily question set (sections, question types, options, points, required flags, help text), form description, submission message. Compose & pre-schedule the **daily login-gate message** (a week ahead). Invite students. View a dashboard across all their students, including daily attendance. Regenerate a student's profile panel if needed. |
| **Student** | Accept invite, set password, complete intake (timezone, height, weight, target weight). Answer the daily form each day (including photo uploads). View today's and past reports. Cannot edit past days. |

Auth: Auth.js (self-hosted), role stored on the user record. Route/API
authorization enforced by role.

---

## 3. Core Daily Loop

1. Student opens **today's form** — the single fixed question set the coach built.
2. Student answers; image-type questions accept a photo (weight photo, meal photo).
3. Student taps **Submit** → answers lock immediately, and the daily report is
   generated immediately (synchronously enqueued; report shown when ready).
4. If the student has **not** submitted by **23:59 in the student's own
   timezone**, a scheduled job **auto-submits** the entry (recording whatever
   was entered; unanswered required questions marked missed) and generates the
   report then.
5. Past days are **read-only**. The student can browse any past day and view
   that day's report.

Exactly **one report per student per day**.

---

## 3a. Daily Login-Gate Message (Attendance)

A daily coach message that gates entry to the app and doubles as attendance.

- The coach composes a **daily message**: text (e.g. a motivational statement)
  plus an **optional photo**, and defines the **acknowledgement button label**
  (e.g. "I am born for more", "Tap ❤️"). The coach can **pre-schedule a week**
  in advance — one message per calendar date.
- On the student's **first app entry each day**, the message for that calendar
  date appears as a **mandatory full-screen popup/banner — the first thing they
  see**. The student cannot access the rest of the app until they tap the
  acknowledgement button.
- Tapping the button = **acknowledge only** (no reply required). This records
  **attendance** (student + date + timestamp) and unlocks the app for the day.
- If **no message is scheduled** for a given date, there is no gate that day.
- The coach's dashboard shows a **daily attendance view** (who acknowledged,
  when) across all students.

Note: this is intentionally distinct from — and simpler than — the deferred
day-30-from-join and birthday-style broadcast messages (still out of scope).

## 4. Data Model (Postgres via Prisma)

Core entities (fields abbreviated):

- **User** — `id, email, passwordHash, role (admin|coach|student), name`.
- **Coach** — `id, userId`. (One coach in MVP, but modeled as a table for later.)
- **Student** — `id, userId, coachId, timezone (IANA, e.g. Asia/Kolkata),
  joinedDate, intake (heightCm, currentWeightKg, targetWeightKg), status`.
- **ProfilePanel** — `id, studentId, computed (bmi, bmr, weightToLoseKg, ...),
  narrative?, generatedAt`. One per student; regenerated on demand.
- **Question** — `id, coachId, sectionTitle, orderIndex, type, options (json),
  points, required (bool), allowsImage (bool), helpText`. The fixed daily set.
- **ProgramSettings** — `id, coachId, formDescription, submissionMessage,
  promptTemplateId`.
- **PromptTemplate** — `id, name, body (with placeholders), modelId, updatedBy,
  updatedAt`. Admin-owned. `modelId` = OpenRouter model.
- **DailyEntry** — `id, studentId, localDate, status
  (open|submitted|auto_submitted|missed), submittedAt`. Unique per
  (studentId, localDate).
- **Answer** — `id, dailyEntryId, questionId, value (json/text), imageRef?`.
- **StoredImage** — `id, storageKey, ownerStudentId, dailyEntryId?, mimeType,
  bytes, createdAt, expiresAt`. Pointer/metadata only; bytes live on disk.
- **Report** — `id, dailyEntryId, body, modelId, promptTemplateId,
  tokensIn, tokensOut, costEstimate, status (pending|done|failed), createdAt`.
- **DailyGateMessage** — `id, coachId, scheduledDate, bodyText, imageRef?,
  ackButtonLabel`. Unique per (coachId, scheduledDate). Coach-scheduled up to a
  week ahead; applies to all of the coach's students on that date.
- **GateAcknowledgement** — `id, gateMessageId, studentId, acknowledgedAt`.
  Unique per (gateMessageId, studentId). Presence = attendance for that date.

### Question types supported (from the coach's real example)
- Short answer (text)
- Number (with validation, e.g. `> 0`)
- Date
- Paragraph (long text)
- Multiple choice (single select; labels may include emoji)
- Checkboxes (multi-select)
- Linear scale (min/max with labels, e.g. 1–5)
- Image upload (images only, max 1) — optional accompanying note

Each question carries: section, order, `required`, `points`, `helpText`.

---

## 5. Image Storage

**Files are stored outside Postgres.** Postgres holds only the pointer +
metadata (`StoredImage`).

- **MVP storage backend:** local disk volume on the Hostinger VPS
  (cheapest/fastest), accessed through a small **StorageService interface**
  (`put`, `getUrl`, `delete`). This lets us swap to MinIO/S3 later with no
  application-code changes.
- **Retention/cleanup job:** a scheduled task deletes stored image files older
  than a configurable retention period (N days), removes the file, and nulls
  the DB pointer to free space. Retention period is a system setting.
- Images are served via app-authenticated routes (access controlled by role /
  ownership), never public directory listing.

---

## 6. AI Integration (OpenRouter)

- **Provider:** OpenRouter, so the model is swappable. `modelId` is stored on
  `PromptTemplate` / system settings and editable from the Admin screen — no
  redeploy needed to change models. A **vision-capable** model is used so meal
  photos can be analyzed for calorie estimation.
- **Report generation:** on submit (or auto-submit), the engine:
  1. Loads the student's `ProfilePanel` + today's `Answer`s + today's images.
  2. Fills the `PromptTemplate` placeholders (e.g. `{{q.weight}}`,
     `{{q.lunch_photo}}`, `{{profile.targetWeight}}`) with the student's data,
     attaching photos as vision inputs.
  3. Calls OpenRouter, stores the returned text as the `Report`, records
     model + token/cost metadata.
  4. On failure: `Report.status = failed`, surfaced in Admin logs; retryable.
- **Profile panel:** computed **once at onboarding** from height/weight/target
  — BMI, BMR, weight-to-lose, and other derivable parameters (deterministic
  formulas). An optional short AI narrative may accompany the numbers. Coach
  can regenerate on demand, but it is normally one-time.

### Prompt placeholder design
Placeholders reference questions by a stable key and profile fields by name.
The prompt editor (Admin) shows the available placeholders for the current
question set so the admin can insert them correctly.

---

## 7. Daily Lock / Auto-Submit Engine

- Each student has an IANA timezone. "The day" and the 23:59 cutoff are
  computed in that timezone.
- A scheduled job (runs frequently, e.g. every 15 min) finds students whose
  local time has passed 23:59 with an `open` DailyEntry, auto-submits them,
  and enqueues report generation.
- New `DailyEntry` rows are created lazily when a student first opens the form
  for their current local date, or by the job.

---

## 8. Deployment / Stack

- **App:** Next.js (single full-stack codebase), containerized (Docker).
- **Hosting:** Coolify on the existing Hostinger VPS.
- **DB:** existing self-hosted Postgres, accessed via Prisma.
- **Auth:** Auth.js, 3 roles.
- **AI:** OpenRouter (model configurable via Admin).
- **Images:** local disk volume behind a StorageService interface.
- **Scheduled jobs:** daily lock/auto-submit + photo retention cleanup.

---

## 9. Out of Scope (future specs)

- Subscription billing (monthly/yearly).
- Multi-coach self-signup and full multi-tenancy hardening.
- Gamification: leaderboards, awards, streak visualizations (points ARE
  captured per question in the data model, but no leaderboard UI yet).
- Scheduled broadcast messages: relative-to-join (e.g. day-30) and
  absolute-date (e.g. birthday) dashboard posts.
- Trend/history injected into reports (reports are today-only in MVP).
- Per-day / scheduled question variation (MVP is one fixed daily set).

---

## 10. Open Questions (non-blocking; can resolve during planning)

- Is "Flary" the **app/platform** name or the **coach's brand**? (Coach example
  signed "Flary Elsy Selva".) Affects branding, not architecture.
- OpenRouter default model + budget/cost guardrails per report.
- Exact retention period default for photo cleanup.

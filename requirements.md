# LifeChanging Wellness Hub (LCWH) — Requirements

**Internal/repo name:** Flary
**Coach (first client):** Flary Elsy Selva
**Document version:** 1.0 — 2026-08-17
**Source of truth:** `docs/superpowers/specs/2026-08-17-flary-mvp-design.md`

---

## 1. Overview

LCWH is a coaching-tracker application. A digital coach defines a daily
check-in program; students complete it every day; an AI generates a per-student
daily report (including calorie estimation from meal photos and alignment to
the student's goal).

This document specifies the **MVP scope: a single-coach core loop**. Billing,
multi-coach self-signup, gamification/leaderboards, and day-30/birthday
broadcast messages are **out of scope** for this release and will be specified
separately.

**Primary goal:** A coach can build a daily question set, invite a student,
have that student complete intake and answer the daily form (with photos), and
receive an accurate AI daily report — with the day locking correctly at the
student's local 11:59 PM.

---

## 2. Roles

| Role | Description |
|------|-------------|
| **Admin** | Platform owner. Manages the coach, owns the AI report prompt template, sets the AI model, views system health/logs. |
| **Coach** | Builds the program and daily questions, composes/schedules the daily login-gate message, invites students, views all-student dashboard + attendance. |
| **Student** | Completes intake, answers the daily form, acknowledges the daily gate message, views reports. |

---

## 3. Functional Requirements

### 3.1 Authentication & Onboarding
- **FR-1** The system shall support three roles — Admin, Coach, Student — with role-based access control.
- **FR-2** A coach shall invite a student by name and email; the student shall receive an invite link to set their own password.
- **FR-3** On first login, a student shall complete an intake form capturing: timezone (IANA), height, current weight, and target weight.
- **FR-4** Upon intake completion, the system shall compute a profile panel (BMI, BMR, weight-to-lose, and other derivable parameters) shown at the top of the student dashboard.
- **FR-5** The profile panel shall be generated once; a coach may regenerate it on demand (e.g. if intake changes), but it is normally one-time.

### 3.2 Question Builder (Coach)
- **FR-6** The coach shall build ONE fixed daily question set that the student answers every day.
- **FR-7** Questions shall be groupable into named sections with display order.
- **FR-8** Each question shall support a configurable answer type: short text, number (with validation, e.g. `> 0`), date, paragraph, multiple choice (single-select), checkboxes (multi-select), linear scale (min/max with labels), and image upload (images only, max 1, with optional note).
- **FR-9** Each question shall have: a required flag, a point value, and optional help/instruction text.
- **FR-10** The coach shall set a form-level description and a custom submission/thank-you message.

### 3.3 Daily Check-In (Student)
- **FR-11** Each day, the student shall see today's form (the fixed question set) for their current local date.
- **FR-12** The student shall be able to upload photos on image-type questions (e.g. weight photo, meal photo).
- **FR-13** On submit, the student's answers shall lock and a daily report generation shall be triggered immediately.
- **FR-14** The student shall NOT be able to edit answers for any day that is already submitted or past.
- **FR-15** There shall be exactly one report per student per day.

### 3.4 Daily Lock / Auto-Submit
- **FR-16** Each student's "day" and cutoff shall be evaluated in that student's own timezone.
- **FR-17** If a student has not submitted by 23:59 in their local timezone, the system shall auto-submit the day (recording entered answers; marking unanswered required questions as missed) and trigger report generation.
- **FR-18** A student shall be able to browse any past day and view that day's report.

### 3.5 Daily Login-Gate Message & Attendance
- **FR-19** The coach shall compose a daily gate message consisting of text, an optional photo, and a custom acknowledgement button label (e.g. "I am born for more").
- **FR-20** The coach shall be able to pre-schedule these messages up to a week in advance — one per calendar date — applied to all of that coach's students on that date.
- **FR-21** On a student's first app entry each day, the scheduled message for that date shall appear as a mandatory full-screen popup — the first thing shown.
- **FR-22** The student shall be unable to access the rest of the app until they tap the acknowledgement button (acknowledge only; no reply required).
- **FR-23** Tapping the button shall record attendance (student, date, timestamp) and unlock the app for that day.
- **FR-24** If no message is scheduled for a date, no gate shall be shown that day.
- **FR-25** The coach dashboard shall show a daily attendance view across all students.

### 3.6 AI Reports (Admin-owned prompt)
- **FR-26** The Admin shall create/edit a report prompt template containing answer-injection placeholders (e.g. `{{q.weight}}`, `{{q.lunch_photo}}`, `{{profile.targetWeight}}`), editable from a screen without redeploy.
- **FR-27** On report generation, the system shall fill the prompt with the student's profile, today's answers, and today's photos, then call the configured AI model.
- **FR-28** The report shall analyze meal photos (vision) to estimate calories and comment on alignment to the student's goal, including the logged weight.
- **FR-29** The system shall store each report with its model, prompt version, token usage, and cost estimate.
- **FR-30** On generation failure, the report shall be marked failed, surfaced in Admin logs, and be retryable.

### 3.7 Coach Dashboard
- **FR-31** The coach shall see a dashboard across all their students, including per-student status, daily answers/reports, and attendance statistics.

---

## 4. Non-Functional Requirements

- **NFR-1 (Model swappability)** The AI provider shall be OpenRouter; the model id shall be an Admin-configurable setting changeable from a screen without redeploy. A vision-capable model shall be used for photo analysis.
- **NFR-2 (Image storage)** Images shall be stored outside Postgres; Postgres shall store only the file pointer and metadata. The MVP backend shall be a local disk volume, accessed behind a storage-service interface that allows swapping to MinIO/S3 later with no application-code changes.
- **NFR-3 (Photo retention)** A scheduled cleanup job shall delete stored image files older than a configurable retention period and null their DB pointers to reclaim space.
- **NFR-4 (Access control)** Images shall be served via app-authenticated routes controlled by role/ownership — never public directory listing.
- **NFR-5 (Deployment)** The app shall be a single Next.js codebase, containerized and deployed via Coolify on the existing Hostinger VPS, using the existing self-hosted Postgres via Prisma.
- **NFR-6 (Scheduling)** Scheduled jobs shall exist for (a) per-timezone daily lock/auto-submit and (b) photo-retention cleanup.
- **NFR-7 (Branding)** The user-facing app shall be branded "LifeChanging Wellness Hub (LCWH)". The architecture shall keep branding as data so future coaches can be white-labeled per their community name.

---

## 5. Data Entities (summary)

`User`, `Coach`, `Student`, `ProfilePanel`, `Question`, `ProgramSettings`,
`PromptTemplate`, `DailyEntry`, `Answer`, `StoredImage`, `Report`,
`DailyGateMessage`, `GateAcknowledgement`.

(See the design spec for field-level detail.)

---

## 6. Out of Scope (future releases)

- Subscription billing (monthly/yearly).
- Multi-coach self-signup and full multi-tenant hardening / white-labeling.
- Gamification: leaderboards, awards, streak visualizations. (Points are
  captured per question in the data model, but no leaderboard UI in the MVP.)
- Broadcast messages: relative-to-join (e.g. day-30) and absolute-date (e.g.
  birthday) dashboard posts.
- Trend/history injected into reports (reports are today-only in the MVP).
- Per-day / scheduled variation of the daily question set (MVP is one fixed set).

---

## 7. Open Items (non-blocking)

- OpenRouter default model choice + per-report cost guardrails.
- Default photo-retention period.

# LCWH — Change Requests / Fix Log

Running log of fixes, tweaks, and new asks found during **manual testing** —
kept separate from the frozen spec (`docs/superpowers/specs/2026-08-17-flary-mvp-design.md`)
so testing feedback is tracked without silently overwriting the original
requirements. Grouped by the date it was reported. Each item has a stable ID.

**Workflow**
1. You report issues → I log each as a `CR-NNN` entry under today's date (status `Open`).
2. When you say **"consolidate"**, I group the open items into a batch, confirm
   scope, and implement them (TDD where it applies, one commit per fix).
3. On completion I set the item's status to `Done` and record the commit.

**Rule to avoid spec conflicts:** every entry is tagged with a **Type**:
- `Bug` — implementation doesn't match the spec/intent → just fix.
- `UX` — refinement within the spec's intent → fix, note it.
- `New` — a genuinely new/changed requirement not in the spec → **flag for spec
  reconciliation** before/while building, so the spec and code stay in sync.

**Status legend:** `Open` · `In progress` · `Done` · `Deferred` · `Won't do`
**Severity:** `Blocker` · `High` · `Medium` · `Low`

---

## Open items index

_Kept in sync as entries are added/closed. Newest first._

| ID | Date | Sev | Type | Area | Summary | Status |
|----|------|-----|------|------|---------|--------|
| CR-010 | 2026-08-18 | High | New | Reports | Coach + admin can regenerate extraction and/or report from a student's report anytime (after changing model/prompt) | Open |
| CR-009 | 2026-08-18 | Medium | New | Student report | Student sees the AI-extracted info (calories/items) per image on the report view | Open |
| CR-008 | 2026-08-18 | Medium | UX | Student form | After submit + report, no way to navigate back to home/dashboard — nav missing | Open |
| CR-007 | 2026-08-18 | High | New | AI prompt | Image-aware + multi-step ("tree of thoughts") prompt authoring: reference answer-key images in the prompt, label multiple images, chain steps (e.g. calories from photo → compute) | Open |
| CR-006 | 2026-08-18 | Medium | New | Daily form | Allow attaching a photo to ANY question when enabled (allowsImage), separate from the answer value | Open |
| CR-005 | 2026-08-18 | Medium | New | Daily form | Note/comment field on ALL question types, not just image | Open |
| CR-003 | 2026-08-18 | Medium | New | Student home | Let student browse past reports by a date they pick | Open |
| CR-002 | 2026-08-18 | High | New | Student home | Goal-oriented dashboard: latest weight, total reduced, days elapsed, progress to target | Open |
| CR-001 | 2026-08-18 | Medium | New | Student home | Show accumulated points on the student dashboard | Open |

---

## 2026-08-18

### CR-001 — Show accumulated points on the student dashboard
- **Reported:** 2026-08-18
- **Severity:** Medium
- **Type:** New
- **Area / Screen:** `/student` (home)
- **Observed:** The student home doesn't show the points they've accumulated.
- **Expected:** Surface total points earned (questions carry a `points` value in
  the schema — `Question.points`). Show a running total and likely today's / this
  period's points.
- **Related spec:** Points exist in the data model but no display requirement was
  specified → **new**. Open question: how are points earned? (per answered
  required question? per full submission? coach-configured per question — the
  `points` field suggests per-question.)
- **Status:** Open
- **Resolution:** —

### CR-002 — Goal-oriented student dashboard (weight progress)
- **Reported:** 2026-08-18
- **Severity:** High
- **Type:** New
- **Area / Screen:** `/student` (home) — currently shows the static ProfilePanel
  (BMI/BMR/weight-to-lose).
- **Observed:** Dashboard shows starting profile numbers but nothing about
  ongoing progress.
- **Expected:** A goal-oriented view: **latest logged weight**, **total kg
  reduced** (start − latest), **days elapsed** (since intake/join), and progress
  toward the target (e.g. reduced X kg of Y kg goal over N days). Motivational.
- **Related spec:** FR-3 (profile panel) exists; the *progress-over-time* view is
  **new**. Depends on the daily weight answer (question key, default `weight`).
- **DECISION (2026-08-18):** "days elapsed" is counted from the **intake date**
  (`Student.intakeAt`), not join date.
- **Status:** Open
- **Resolution:** —

### CR-003 — Browse past reports by chosen date
- **Reported:** 2026-08-18
- **Severity:** Medium
- **Type:** New / UX
- **Area / Screen:** `/student` → `/student/day/[date]`
- **Observed:** A past day + report is viewable at `/student/day/<date>` but the
  student has no way to pick/browse dates from the UI.
- **Expected:** A date picker (and/or a list of past days) so the student can
  open any past day's answers + AI report. (FR-18 = past days are read-only; this
  adds the navigation to reach them.)
- **Related spec:** FR-18 (read-only past days) — this is the missing navigation.
- **Status:** Open
- **Resolution:** —

### CR-004 — Checkbox: option to allow choosing only one (single-select / yes-no)
- **Reported:** 2026-08-18
- **Severity:** Medium
- **Type:** New
- **Area / Screen:** Question builder (`/coach/questions`) + daily form rendering
- **Observed:** `checkboxes` allows selecting many; there's no way to make a
  checkbox question that permits exactly one selection (e.g. a Yes/No).
- **Expected:** A per-question option to limit selections — e.g. `minSelect` /
  `maxSelect` on checkbox options; `maxSelect: 1` = choose only one. (Note:
  `multiple_choice` is already single-select radio; a Yes/No can also be a
  multiple_choice with Yes/No — but the ask is a *constrained checkbox*.)
- **Related spec:** FR-6..10 (question types) — **new** option on an existing type.
- **Status:** Won't do (2026-08-18) — dropped per user: `multiple_choice`
  already provides single-select, and a Yes/No is a `multiple_choice` with
  choices `["Yes","No"]`. No constrained-checkbox needed.
- **Resolution:** N/A — no code change.

### CR-005 — Note/comment field on ALL question types
- **Reported:** 2026-08-18
- **Severity:** Medium
- **Type:** New
- **Area / Screen:** Daily form (`/student/today`) + question builder toggle
- **Observed:** Only the image flow exposes extra detail; other question types
  have no place for a short note.
- **Expected:** A short **note/comment** input available on every question's
  answer (the schema already has `Answer.note`). Likely coach-toggle to
  show/require it per question.
- **Related spec:** FR-11..14 (daily check-in) — **new** enhancement. `Answer.note`
  already exists; mostly a UI + save-path change.
- **Status:** Open
- **Resolution:** —

### CR-006 — Attach a photo to ANY question (when enabled), separate from the answer
- **Reported:** 2026-08-18
- **Severity:** Medium
- **Type:** New
- **Area / Screen:** Daily form + question builder
- **Observed:** Photo attach only appears for `image`-type questions.
- **Expected:** When a question has `allowsImage = true` (flag already in schema),
  let the student attach a photo **in addition to** the normal answer — e.g. a
  number answer for weight *plus* a scale photo. Independent of the answer value.
- **Related spec:** `Question.allowsImage` + `Answer.imageRefId` already exist;
  the builder toggle + form UI + save path need wiring. **New** enhancement.
- **Design note:** Today an image lives in `Answer.imageRefId` (one per answer).
  A non-image question with an attached photo can reuse `imageRefId` for the
  supplemental image; the scalar answer stays in `Answer.value`. Confirm one
  attachment per question is enough (vs. multiple).
- **Status:** Open
- **Resolution:** —

### CR-007 — Image-aware & multi-step ("tree of thoughts") prompt authoring
- **Reported:** 2026-08-18
- **Severity:** High
- **Type:** New (design-heavy — needs decisions before build)
- **Area / Screen:** Admin prompt editor (`/admin/prompt`), `src/lib/prompt.ts`,
  `src/lib/report.ts`, `src/lib/openrouter.ts`
- **Observed / ask:** How does a coach/admin author a prompt that (a) attaches a
  specific answer's image for LLM vision analysis, (b) references **multiple**
  images unambiguously in one prompt, and (c) does **multi-step** reasoning —
  e.g. *estimate calories from the meal photo*, then *use that number in a later
  calculation* (tree-of-thoughts / chained prompts)?
- **Current state:** `{{q.<key>}}` for an image answer already sends that image to
  the model as a vision part — but the token is stripped to empty text, so with
  multiple images the model can't tell which is which, and there's no chaining
  (single call only).
- **Design proposal (to confirm):**
  1. **Referencing images inline:** when filling, replace an image `{{q.key}}`
     with a labeled marker (e.g. `[image: key]`) and place that image's vision
     part adjacent, so text + image stay correlated. Supports multiple images.
  2. **Multiple images in one prompt:** each `{{q.<imgkey>}}` (and CR-006
     attachments, e.g. `{{q.<key>.photo}}`) adds one labeled image part, in the
     order they appear in the prompt.
  3. **Multi-step / tree-of-thoughts:** two options —
     - **A (MVP, one call):** single vision call; prompt instructs the model to
       first analyze the photo, then compute — modern models chain internally.
       Cheapest, no infra change beyond #1/#2.
     - **B (true pipeline):** template defines ordered **steps**; step 1 extracts
       structured data (e.g. `{ calories }`) from the image, step 2+ consume prior
       outputs via `{{step1.calories}}`. Requires a step runner + stored
       intermediates + more tokens/cost.
     Recommendation: ship **A** now (covers most of the calorie example), design
     **B** as a follow-up if per-step control is needed.
- **DECISION (2026-08-18):** Go with **Option A**, but persist the intermediate
  value so it's visible and reusable. Concretely this becomes a lightweight
  **two-pass** generation (still "A", not the generic step engine):
  1. **Extraction pass** — for each image-analysis question, one vision call
     analyzes the photo and returns a **structured value** (e.g.
     `{ "calories": 650, "items": ["rice","dal"] }`).
  2. **Store the derived value** — NOT in the student's note/comment (CR-005/006
     are for the *human's* own text; keep them separate). Store AI output in a
     dedicated derived field. **Proposed:** a new `Answer.derived Json?` column
     (small schema change via the migrate diff+deploy workflow). Alternative:
     `StoredImage.analysis Json?` (since the analysis is about the image).
     → **Recommend `Answer.derived`.** Confirm before build.
  3. **Report pass** — the report prompt references the stored value via a new
     placeholder namespace, e.g. `{{q.lunch_photo.calories}}` (or
     `{{derived.<key>.calories}}`), and computes the day's total / advice in the
     final report.
  Also implement the **labeled inline image** referencing (design proposal #1/#2)
  so multiple photos are unambiguous to the model.
- **DECISION (2026-08-18):** storage = **`Answer.derived Json?`** (confirmed).
- **Confirmed 2-call flow (both prompts EDITABLE — updated 2026-08-18):**
  1. **Extraction call** — an **editable** extraction PromptTemplate with its
     **own model**, managed in the admin editor just like the report prompt. The
     admin controls **which attachments go** by including image placeholders
     (`{{q.lunch_photo}}`) in its body, and picks the extraction **model**. Runs
     over the referenced photo(s) → returns structured JSON **keyed by question
     key**, e.g. `{ "lunch_photo": { "calories": 650, "items": ["rice","dal"] } }`
     → each result saved to that answer's **`Answer.derived`**. (One call can
     cover multiple images; results distributed per key.)
  2. **Report call** — the **editable report prompt** (`/admin/prompt`) runs as
     today, now able to reference extracted values via `{{q.<key>.calories}}`
     (and photos via labeled inline images), producing the day's report.
- **DECISION (2026-08-18): the extraction prompt is admin-editable with its own
  model**, parallel to the report prompt (not fixed). Admin chooses attachments
  (via placeholders) + model for extraction.
- **Data model implication:** need a second prompt template for extraction. Options
  — add `PromptTemplate.kind` (`extraction` | `report`) + link both to the coach
  (`ProgramSettings.reportTemplateId` + `extractionTemplateId`), or keep a single
  global extraction template (admin-owned). Decide at build (single-coach MVP →
  either works; leaning `kind` + two links).
- **Open decisions (small):**
  - Extraction output schema: start `{ calories:number, items:string[] }` per key;
    extend later.
  - Extraction triggers whenever the extraction template references image
    placeholders that have uploads that day (no separate per-question flag needed —
    the admin's choice of placeholders IS the trigger).
- **Related spec:** FR-26..30 (AI reports, admin prompt). Extends the placeholder
  language + report pipeline + adds a second (extraction) template — **new**,
  reconcile with spec when scoped.
- **Status:** Open (Option A + `Answer.derived` + editable 2-call flow confirmed)
- **Resolution:** —

### CR-009 — Student sees AI-extracted info per image on the report view
- **Reported:** 2026-08-18
- **Severity:** Medium
- **Type:** New
- **Area / Screen:** `/student/day/[date]` (report view) and wherever the day's
  report is shown.
- **Observed / ask:** The calories/items the AI extracts from a photo aren't
  visible to the student.
- **Expected:** Next to each analyzed image, show the extracted info from
  `Answer.derived` (e.g. "≈650 kcal · rice, dal") when the report is viewed. Also
  visible to coach/admin on their report views.
- **Related spec:** Depends on CR-007 (`Answer.derived`). **New** display.
- **Status:** Open
- **Resolution:** —

### CR-010 — Coach + admin can regenerate extraction and/or report anytime
- **Reported:** 2026-08-18
- **Severity:** High
- **Type:** New
- **Area / Screen:** Student report views — coach at `/coach/students/[id]`
  (per day), admin at `/admin/logs` (and/or the student report).
- **Observed / ask:** Today only admin `retryReport` re-runs the **report** for
  failed ones. Need broader control.
- **Expected:** **Both coach and admin** can, from a student's report, **anytime**
  (not just on failure):
  - **Regenerate report** — re-run the report call with the current report prompt/model.
  - **Regenerate extraction** — re-run the photo→`{calories,items}` extraction
    (updates `Answer.derived`), then optionally the report.
  So after editing the extraction or report prompt/model (in `/admin/prompt`),
  they can re-run either stage on an existing day and see new output. Admin
  definitely has this; coach also.
- **Design note:** Generalize `retryReport` into `regenerate({ entryId, stage:
  "extraction" | "report" | "both" })`, guarded for coach (own students) + admin.
  "Change the model/prompt" happens by editing the template first, then
  regenerating (no per-run ad-hoc override in MVP).
- **Related spec:** Extends FR-29/30 (retry) to on-demand regenerate for coach+admin.
- **Status:** Open
- **Resolution:** —

### CR-008 — Missing navigation after submit / on the report view
- **Reported:** 2026-08-18
- **Severity:** Medium
- **Type:** UX
- **Area / Screen:** `/student/today` after submit (locked + report shown), and
  the day view `/student/day/[date]`.
- **Observed:** Once the day is submitted and the report is generated, there's no
  link/button to return to the home page / dashboard — the student is stuck on
  that screen.
- **Expected:** A clear "Back to dashboard / Home" link (and ideally consistent
  navigation across student screens — the student layout header could carry a
  Home link). `/student/day/[date]` already has a "← Home" link; `/student/today`
  needs one, especially in the post-submit state.
- **Related spec:** UX gap, within FR-11..18 intent.
- **Status:** Open
- **Resolution:** —

<!--
======================================================================
ENTRY TEMPLATE (copy for each new item — I fill this in from your report)
======================================================================

### CR-001 — <short title>
- **Reported:** 2026-08-18
- **Severity:** Medium
- **Type:** Bug | UX | New
- **Area / Screen:** e.g. /student/today, Coach dashboard, Auth
- **Observed:** what actually happens (steps to reproduce if relevant)
- **Expected:** what should happen instead
- **Related spec:** FR-xx / NFR-x, or "new" (needs spec reconciliation)
- **Status:** Open
- **Resolution:** (commit hash + note, filled on completion)
-->

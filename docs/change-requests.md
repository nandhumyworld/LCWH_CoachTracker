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
| _(none yet — report your first item and it lands here)_ | | | | | | |

---

## 2026-08-18

_No change requests logged yet. Paste what you found during testing and I'll
turn each into a CR entry below._

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

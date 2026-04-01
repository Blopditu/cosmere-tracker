# Codex Workboard

Last updated: 2026-04-01

This file is the running tracker for work done with Codex. Keep it current so future sessions can pick up the right feature, redesign, or styling pass without re-discovering project context.

## Status Legend

- `[ ]` Not started
- `[~]` In progress
- `[>]` Next up
- `[x]` Done
- `[-]` Dropped or deferred

## How To Use This File

1. Move one item into `[~]` before starting work with Codex.
2. Add file paths, routes, or short notes under the item while work is active.
3. When a task is finished, mark it `[x]` and add a short result note.
4. Keep "Redo / Revisit" separate from brand-new features so cleanup work stays visible.

## Current Product Surface

- `[x]` Session list and session dashboard
- `[x]` Campaign roster
- `[x]` Roll tracker
- `[x]` Combat list, setup, live tracker, and post-combat summary
- `[x]` Stage manager and player display
- `[x]` Campaign console
- `[~]` Handbook import review flow at `/gm/import/review`
- `[~]` Python handbook extraction tool in `tools/handbook_import/`

## Active Workstreams

- `[~]` Handbook import pipeline
  Notes:
  Tooling lives in `tools/handbook_import/`
  Current workflow is documented in `tools/handbook_import/README.md`
  Main output is deterministic import artifacts for handbook review and publishing

- `[~]` Import review desk
  Notes:
  Route: `/gm/import/review`
  Frontend: `src/app/features/campaign-import/`
  Backend wiring: `backend/src/services/import-artifact.service.ts`
  Goal is to register artifacts, review extracted candidates, edit payloads, and publish rules safely

## Feature Backlog

- `[>]` Finish handbook import end-to-end flow
  Definition of done:
  Artifact registration, candidate review, publish flow, and backend persistence all feel reliable

- `[ ]` Connect published handbook rules more clearly into the GM experience
  Notes:
  Review where imported rules should appear in campaign console, combat setup, or session tools

- `[ ]` Add better filtering and review controls for import candidates
  Notes:
  Likely includes stronger search, document status filters, and better review summaries

- `[ ]` Add import history or audit visibility
  Notes:
  Useful for understanding what was published, edited, rejected, merged, or split

## Redo / Revisit Queue

- `[>]` Revisit campaign import page structure
  Notes:
  Review whether document list, candidate list, and detail editor should stay in one page component or split further
  Confirm responsive behavior for narrower screens

- `[ ]` Revisit campaign console information architecture
  Notes:
  Route: `/gm/campaigns/:campaignId`
  Check whether the console is the right home for imported rules, campaign-level settings, and handbook outputs

- `[ ]` Revisit session-to-campaign navigation flow
  Notes:
  Check if movement between session list, campaign roster, dashboard, and GM tools feels coherent

- `[ ]` Revisit backend import service boundaries
  Notes:
  Keep controllers thin and make sure import orchestration stays in services with clear DTO boundaries

## Styling And UX Queue

- `[>]` Polish the import review desk UI
  Notes:
  Improve hierarchy between document list, candidate list, and editor
  Refine spacing, empty states, and feedback for publish / save / reject actions

- `[ ]` Run a consistency pass on global form controls and panels
  Notes:
  Shared styles live in `src/styles.scss`
  Review button, input, textarea, card, and focus-state consistency

- `[ ]` Audit route-level responsive layouts
  Notes:
  Start with `/gm/import/review`, then review campaign console and combat-heavy pages

- `[ ]` Add clearer loading, error, and success states across GM tools
  Notes:
  Especially important for import, publishing, and long-running review actions

- `[ ]` Review empty states across major screens
  Notes:
  Sessions, combats, imports, and stage manager should all have purposeful empty-state copy

## Tech Debt

- `[ ]` Replace scattered semantic literals with named constants where patterns are stabilizing

- `[ ]` Review larger components and stores for extraction once flows settle
  Notes:
  Keep page components focused on orchestration and move dense transforms into separate files as needed

- `[ ]` Confirm Angular forms usage stays reactive where complexity grows
  Notes:
  Current import page should be reviewed if the editor becomes more complex

## Session Log

- `2026-04-01`: Created `CODEX_WORKBOARD.md` as the shared tracker for future Codex sessions.

## Next Session Prompt Template

Use this when starting a new Codex session:

```text
Open CODEX_WORKBOARD.md and continue the [~] item under Active Workstreams.
If nothing is in progress, start the [>] item under Feature Backlog or Styling And UX Queue.
Before editing code, update the workboard with what you plan to change.
```

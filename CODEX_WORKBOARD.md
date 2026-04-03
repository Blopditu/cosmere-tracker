# Codex Workboard

Last updated: 2026-04-02

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

## Product Direction

- Personal GM tool first, not a generic platform.
- Local-first performance and fast table use matter more than cloud complexity.
- In-person table play comes before remote-first virtual tabletop features.
- No permanent Obsidian companion; important workflows should land in this app over time.
- Model the campaign as entities plus event log plus derived state.
- Capture real history now; defer replay-heavy simulation until the foundation is stable.

## Product Pillars

- `Session Control`: Stage manager, combat flow, rolls, prep tools, and player display.
- `War Room`: NPCs, locations, chapters, events, relationships, and campaign truth.
- `Atlas`: Roshar map, pinned places, linked entities, and place-driven navigation.
- `Codex`: Handbook import, structured rules, rule lookup, and rules-aware support.

## Current Product Surface

- `[x]` Session list and session dashboard
- `[x]` Campaign roster
- `[x]` Roll tracker
- `[x]` Combat list, setup, live tracker, and post-combat summary
- `[x]` Stage manager and player display
- `[x]` Campaign console
- `[~]` Handbook import review flow at `/gm/import/review`
- `[~]` Python handbook extraction tool in `tools/handbook_import/`

## Phase Roadmap

- `[~]` Phase 1: Session Ops Refresh
  Notes:
  Focus on in-person GM flow and reducing setup friction before and during a session.
  Keep this phase separate from deeper War Room modeling.
  Task cluster:
  Combat prep and setup improvements
  Reusable stages across sessions
  Reusable prep assets across sessions
  Player-safe notes and reveal flow for table use
  Custom-first NPC and enemy authoring where it directly improves session prep

- `[>]` Phase 2: Core Persistence Migration to SQLite
  Notes:
  Move remaining JSON-backed live-play and core data toward SQLite without overdesigning the schema.
  Preserve local-first behavior and current upload flows while making identifiers and links more durable.
  Task cluster:
  Migrate remaining JSON-backed core domains toward SQLite
  Keep schema flexible while entity columns and types are still moving
  Avoid a full normalization pass in this phase
  Make stable identifiers and important links more durable
  Enable later event-log and replay support through storage choices, not full feature work yet

- `[ ]` Phase 3: War Room v1
  Notes:
  This phase is not a combat UI expansion. It is the campaign-graph foundation.
  Task cluster:
  NPCs and locations first
  Relationships between people, places, and campaign context
  Event log for what happened
  Derived current state for what is true now
  Custom authoring first, imported content later

- `[ ]` Phase 4: Player-Safe Publishing and Reuse
  Notes:
  Separate GM-only material from revealable player content and support campaign continuity.
  Task cluster:
  GM-only vs player-safe content boundaries
  Publish and reveal workflows
  Cross-session reuse for stages, enemies, notes, and prep assets
  Continuity support between sessions

- `[ ]` Phase 5: Atlas v1
  Notes:
  Start simple and fast before considering deep-zoom map tooling.
  Task cluster:
  Pinned 2D Roshar map first
  Clickable places linked to locations, NPCs, and events
  No OpenSeadragon-first or deep-zoom-first commitment in v1

- `[ ]` Phase 6: Codex Return
  Notes:
  Bring handbook and rules work back after Session Ops, persistence, and War Room foundations are stronger.
  Task cluster:
  Handbook import pipeline
  Review and publish flow
  Structured rules integration
  Reconnect rules to combat, War Room, and Atlas features

## Immediate Queue

- `[x]` Stage reuse across sessions
  Notes:
  Add a clean way to copy or reuse previously created stages instead of rebuilding them per session.
  Files: `src/app/features/stage-manager/stage-manager-page.component.ts`, `src/app/features/stage-manager/stage-manager.store.ts`, `backend/src/services/stage.service.ts`, `backend/src/controllers/stage.controller.ts`, `backend/src/routes/stage.routes.ts`, `shared/domain/models.ts`, `src/styles.scss`.
  Routes: `POST /api/sessions/:sessionId/stage-scenes/import`, `GET /api/sessions/:sessionId/stage-scenes`, `/gm/stage-manager/:sessionId`.
  Completed: added atomic selected-scene import on the backend, inline Stage Manager import panel, duplicate warning and explicit confirm, append-at-end behavior, and first-imported-scene selection after success.
  Remaining: run manual browser verification for source-session filtering, duplicate warning copy flow, and live-scene draft separation.
  Next step: move to `Combat prep and setup improvements`.

- `[x]` Combat prep and setup improvements
  Notes:
  Reduce friction before initiative starts and make encounter setup faster.
  Files: `shared/domain/models.ts`, `backend/src/services/combat.service.ts`, `backend/src/controllers/combat.controller.ts`, `backend/src/routes/combat.routes.ts`, `backend/src/services/session.service.ts`, `src/app/features/combat-tracker/combat.store.ts`, `src/app/features/combat-tracker/combat-setup-page.component.ts`, `src/app/features/combat-tracker/combat-tracker-page.component.ts`, `src/app/shared/roshar-icons.ts`, `src/app/shared/roshar-icon.component.ts`, `src/styles.scss`.
  Routes: `POST /api/combats/:combatId/start`, `POST /api/combats/:combatId/rounds/current/commit`, `POST /api/combats/:combatId/rounds/current/advance`, `POST /api/combats/:combatId/rounds/current/reorder`, `POST /api/combats/:combatId/turns/:turnId/complete`, `POST /api/combats/:combatId/participants/:participantId/reaction/spend`, `POST /api/combats/:combatId/actions`.
  Completed: removed setup-time Fast/Slow assignment, moved combat to dynamic current-phase rounds, added unresolved-pool commitment flow, explicit phase advance, manual queue reordering, turn completion, round-scoped reaction state, handbook-aligned combat catalog, and a reaction-capable command slab.
  Remaining: manual browser verification for round start, unresolved reaction logging, phase advance gating, completed-turn reaction logging, and post-build smoke check once `ng build` can finish cleanly in the environment.
  Next step: move to `Reusable custom enemies and NPC prep flow`.

- `[~]` Combat tracker UX redesign for fast resolution logging
  Notes:
  Rework the live combat screen around a left tactical rail, central battle board, and wide resolution board so Strike and Custom logging can happen without a narrow scrolling slab.
  Files: `shared/domain/models.ts`, `backend/src/services/roll.service.ts`, `backend/src/services/combat.service.ts`, `backend/src/controllers/combat.controller.ts`, `backend/src/routes/combat.routes.ts`, `backend/src/services/session.service.ts`, `src/app/features/combat-tracker/combat.store.ts`, `src/app/features/combat-tracker/combat-tracker-page.component.ts`, `src/styles.scss`.
  Routes: `PATCH /api/combats/:combatId/participants/:participantId/strike-preset`, `POST /api/combats/:combatId/actions`.
  Completed: added per-combatant strike presets, structured opportunity/complication roll logging, damage formula/breakdown logging, left-rail phase planner, battle-board health/focus overview, and a wide tap-first resolution board for Strike, Custom, and Reaction flows.
  Remaining: tighten the phase-advance UX so unresolved combatants are not mistaken for blockers, auto-handle exhausted open turns during phase advance, clarify PC versus NPC commitment handoff, finish the logger-first cockpit polish, and complete the manual browser verification for preset save/reuse flow, chronicle behavior, and overall desktop responsiveness.
  In progress subtask: `Above-the-fold strike logger rewrite`.
  In progress subtask: `Clarify NPC-side phase handoff and auto-select the next eligible side after phase advance`.
  In progress subtask: `Add backend combat rule tests and a clearer next-turn handoff when a turn is exhausted`.
  Next step: finish the logger-first combat pass, then decide whether combat UX is finally good enough to move on to reusable custom enemies and NPC prep flow.

- `[~]` Reusable custom enemies and NPC prep flow
  Notes:
  Prioritize custom authoring that directly improves session preparation.
  Files: `shared/domain/models.ts`, `backend/src/services/session.service.ts`, `backend/src/services/combat.service.ts`, `backend/src/services/session.service.spec.ts`, `backend/src/services/combat.service.spec.ts`, `src/app/shared/combat-preset-action-editor.component.ts`, `src/app/shared/enemy-stat-block-editor.component.ts`, `src/app/shared/enemy-supplement-editor.component.ts`, `src/app/features/session/campaign-roster-page.component.ts`, `src/app/features/session/session-dashboard-page.component.ts`, `src/app/features/session/stonewalkers-adversaries.data.ts`, `src/app/features/combat-tracker/combat-setup-page.component.ts`, `src/app/features/combat-tracker/combat-tracker-page.component.ts`, `src/app/features/combat-tracker/combat-resolution-board.component.ts`, `src/app/features/combat-tracker/combat-tracker.types.ts`, `src/styles.scss`.
  Routes: existing session roster/session update routes, `POST /api/sessions/:sessionId/combats`, `POST /api/combats/:combatId/actions`.
  Completed: added reusable enemy preset actions on campaign roster and session dashboard templates, copied preset actions into combat setup and combat participant records, added combat-local preset editing in setup only, switched the live logger to `Action` / `Reaction` tabs with handbook and preset action chips, and logged preset actions by their own names instead of forcing them through generic `Custom`.
  Completed subtask: `Stonewalkers adversary draft import to campaign roster with enemy features, tactics, source refs, and richer preset action prose`.
  Active files: `shared/domain/models.ts`, `backend/src/services/session.service.ts`, `backend/src/services/combat.service.ts`, `backend/src/services/session.service.spec.ts`, `backend/src/services/combat.service.spec.ts`, `src/app/shared/combat-preset-action-editor.component.ts`, `src/app/shared/enemy-stat-block-editor.component.ts`, `src/app/shared/enemy-supplement-editor.component.ts`, `src/app/features/session/campaign-roster-page.component.ts`, `src/app/features/session/session-dashboard-page.component.ts`, `src/app/features/session/stonewalkers-adversaries.data.ts`, `src/app/features/combat-tracker/combat-tracker-page.component.ts`, `src/app/features/combat-tracker/combat-resolution-board.component.ts`, `src/styles.scss`.
  Decision: use a checked-in curated Stonewalkers adversary bundle and a campaign-roster-only import action that appends draft enemy templates directly into `enemyDraft`; duplicates are intentionally appended, not merged or skipped.
  Verification update: `npx ngc -p tsconfig.app.json` passed, `npm run test:backend` passed (12 tests), `npm run build:backend` passed after adding enemy `features`, `tactics`, `sourceAdversaryName`, richer preset action prose/range text, the shared enemy supplement editor, and the checked-in Stonewalkers adversary draft bundle.
  Manual verification update: campaign-roster Stonewalkers import, enemy supplement editing, and combat hover behavior were browser-checked and the enemies are ready for use.
  Remaining: optional cleanup for noisy OCR-derived adversary prose in the curated bundle and any follow-up UX polish after more table use.
  Next step: move to `Player-safe reveal and notes improvements`, unless the player-roster persistence bug is prioritized first.

- `[~]` Chapter 3 curated import and stat-sheet foundation
  Notes:
  Pull the first structured handbook chapter into the live product and use it to establish character stat sheets for party members, enemy templates, and combat seeding.
  Files: `shared/domain/character-stats.ts`, `shared/domain/models.ts`, `shared/domain/campaign-models.ts`, `shared/domain/campaign-utils.ts`, `backend/src/server.ts`, `backend/src/services/import-artifact.service.ts`, `backend/src/services/campaign-console.service.ts`, `backend/src/services/session.service.ts`, `backend/src/services/combat.service.ts`, `backend/src/controllers/combat.controller.ts`, `backend/src/routes/combat.routes.ts`, `src/app/shared/character-stat-sheet-editor.component.ts`, `src/app/features/session/campaign-roster-page.component.ts`, `src/app/features/session/session-dashboard-page.component.ts`, `src/app/features/session/session-list-page.component.ts`, `src/app/features/combat-tracker/combat-setup-page.component.ts`, `src/app/features/combat-tracker/combat-tracker-page.component.ts`, `src/app/features/combat-tracker/combat-resolution-board.component.ts`, `src/app/features/combat-tracker/combat-participant-row.component.ts`, `src/app/features/campaign-import/campaign-import-page.component.ts`, `src/styles.scss`, `tools/handbook_import/curated/chapter3-character-statistics.ts`, `tools/handbook_import/build-curated-chapter3.ts`, `tools/handbook_import/build-curated-chapter3-cli.ts`.
  Routes: `/api/import/artifacts/register-local`, `/api/import/review`, `POST /api/combats/:combatId/investiture-events`, existing campaign roster/session update routes, `POST /api/sessions/:sessionId/combats`.
  Completed: added first-class `statistic-definition`, `stat-table-definition`, and `skill-definition` import kinds; added shared Chapter 3 stat-sheet models and calculator; added full party and lean enemy stat-sheet editors; normalized legacy roster entries into stat sheets with materialized health/focus/investiture; seeded combat health/focus/investiture from stat sheets; added live investiture runtime events and battle-board controls; and created a deterministic Chapter 3 curated artifact builder that writes to `.import-cache/chapter-3-character-statistics`.
  Verification: `npx ngc -p tsconfig.app.json` passed, `npm run build:backend` passed, `npm run test:backend` passed (12 tests), `npm run build:chapter3-artifact` passed.
  Remaining: register the curated Chapter 3 artifact through `/gm/import/review`, manually accept/publish it, browser-check the new stat-sheet editors on roster and session dashboard, verify combat investiture controls and labels in live play, and confirm whether `ng build` is still environment-blocked or exposing a new production-only issue.
  Completed subtask: `Clustered reactive stat sheet layout refactor`.
  Active files: `src/app/shared/character-stat-sheet-editor.component.ts`, `src/app/shared/character-stat-sheet-editor.helpers.ts`, `src/app/shared/party-stat-sheet-editor.component.ts`, `src/app/shared/enemy-stat-block-editor.component.ts`, `src/app/shared/stat-cluster.component.ts`, `src/app/shared/resource-bar.component.ts`, `src/app/shared/attribute-control.component.ts`, `src/app/shared/skill-row.component.ts`, `src/styles.scss`.
  Decision: kept stat computation and mutation logic unchanged; refactored only presentation plus lightweight transient highlight state for affected resources, defenses, skills, and derived values.
  Verification update: `npx ngc -p tsconfig.app.json` passed after the cluster refactor, `npm run build:backend` passed after the cluster refactor.
  Remaining follow-up: browser-check both roster surfaces for real desktop readability, sticky resource bar behavior, cluster highlight timing, and whether the bottom utility rail needs another density pass after live use.
  Follow-up fix completed: swapped roster-side expertise creation from direct `crypto.randomUUID()` to the app’s local `createId()` helper and stopped stat-sheet normalization from stripping blank expertise rows, so `Add expertise` now renders a new editable card immediately.
  Completed subtask: `Add player Level field to roster character sheets and persistence`.
  Next step: do the browser pass, then either polish the cluster editor density further or return to the remaining combat UX cleanup.

- `[~]` SQLite migration slice 1: sessions and campaign roster
  Notes:
  Move `sessions`, `party_members`, and `participant_templates` off whole-file JSON and onto SQLite JSON-row tables without changing API contracts.
  Files: `backend/src/lib/sqlite.ts`, `backend/src/lib/json-store.ts`, `backend/src/repositories/session.repository.ts`, `backend/src/repositories/party-member.repository.ts`, `backend/src/repositories/participant-template.repository.ts`, `backend/src/services/session.service.spec.ts`.
  Completed: switched the three repositories to SQLite-backed async storage, added one-time lazy backfill from legacy JSON files, reused the existing `cosmere-tracker.sqlite` database path, and added a service-level backfill test proving SQLite remains the source of truth after initial import.
  Verification: `npm run test:backend` passed (13 tests), `npm run build:backend` passed, `npx ngc -p tsconfig.app.json` passed.
  Remaining: manual runtime smoke check with existing `backend/data/*.json` content, then decide whether Slice 2 should be stage runtime or whether the roster/session save semantics need tightening before more migration work.
  Next step: browser- and runtime-check existing local data against the SQLite-backed session/roster repositories, then move to the next migration slice.

- `[>]` Player-safe reveal and notes improvements
  Notes:
  Support table-safe reveals, handoff notes, and controlled display content.

- `[x]` SQLite migration planning for current JSON-backed domains
  Notes:
  Define migration order for sessions, stages, combats, rolls, and related core data.
  Completed: documented the phased SQLite migration strategy in `docs/sqlite-migration-plan.md`, using the existing `SqliteJsonRepository` pattern as the low-risk bridge away from whole-file JSON repositories.
  Next step: implement Slice 1 from the plan: move `sessions`, `party_members`, and `participant_templates` to SQLite with one-time JSON backfill and unchanged service/controller contracts.

## Deferred Later

- `[-]` Handbook import pipeline
  Notes:
  Important but no longer the current mainline. Revisit in Phase 6.
  Tooling lives in `tools/handbook_import/`.

- `[-]` Import review desk
  Notes:
  Route: `/gm/import/review`.
  Frontend lives in `src/app/features/campaign-import/`.

- `[-]` Import UI polish
  Notes:
  Return after the product focus comes back to Codex and handbook review.

- `[-]` Import filtering and history improvements
  Notes:
  Includes stronger search, status filters, and audit visibility for review decisions.

## Tech Debt / Architecture Notes

- `[ ]` Replace scattered semantic literals with named constants where patterns stabilize.
- `[ ]` Keep Angular page components focused on orchestration; extract dense transforms before files get risky to change.
- `[ ]` Confirm more complex editor flows use reactive forms as they grow.
- `[ ]` Keep Session Control and War Room surfaces separate in the UI to avoid one giant overloaded dashboard.
- `[ ]` Use SQLite migration to improve durability and linking, not to lock the domain into a rigid schema too early.
- `[ ]` Treat events as first-class historical records once War Room work starts, but defer replay and simulation-heavy features.

## Session Log

- `2026-04-01`: Created `CODEX_WORKBOARD.md` as the shared tracker for future Codex sessions.
- `2026-04-01`: Rewrote the workboard around phased roadmap planning. Session Ops is now the active phase, SQLite migration is next, and handbook import work moved to Deferred Later.
- `2026-04-01`: Finished the combat rules-alignment milestone for Session Ops. Combat setup no longer preplans round one, live tracking now uses dynamic Fast/Slow phase commitment with round-scoped reaction state, and the combat action catalog now matches the handbook chapter more closely.

## Next Session Prompt Template

Use this when starting a new Codex session:

```text
Open CODEX_WORKBOARD.md and continue the [~] phase or the highest-priority [>] item in Immediate Queue.
Before editing code, update the workboard with the task you are taking on, the files or routes involved, and the next step you expect after it.
If the active phase is blocked, advance the next phase-planning item without changing the overall roadmap.
```

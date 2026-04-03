# SQLite Migration Plan

## Goal

Move the remaining JSON-backed Session Ops domains into SQLite without forcing a premature relational redesign.

This migration is about:

- better durability
- safer multi-write flows
- clearer migration boundaries
- less risk of whole-file overwrites
- preserving the current local-first development model

This migration is **not** about:

- fully normalizing every nested object
- redesigning the domain model first
- changing API shapes
- changing frontend behavior

## Current Persistence Split

The backend currently uses two persistence styles:

### SQLite already in use

Codex / War Room style data already lives in SQLite via `SqliteJsonRepository`:

- rules and import artifacts
- campaign console data
- simulation data

Key files:

- [sqlite.ts](/Users/suja/Documents/vibecoding/cosmere-tracker/backend/src/lib/sqlite.ts)
- [server.ts](/Users/suja/Documents/vibecoding/cosmere-tracker/backend/src/server.ts)

### JSON files still in use

Session Ops is still backed by whole-file JSON repositories:

- `sessions.json`
- `party-members.json`
- `participant-templates.json`
- `rolls.json`
- `combats.json`
- `stage-scenes.json`
- `live-stage-state.json`

Key files:

- [json-store.ts](/Users/suja/Documents/vibecoding/cosmere-tracker/backend/src/lib/json-store.ts)
- [session.repository.ts](/Users/suja/Documents/vibecoding/cosmere-tracker/backend/src/repositories/session.repository.ts)
- [party-member.repository.ts](/Users/suja/Documents/vibecoding/cosmere-tracker/backend/src/repositories/party-member.repository.ts)
- [participant-template.repository.ts](/Users/suja/Documents/vibecoding/cosmere-tracker/backend/src/repositories/participant-template.repository.ts)
- [roll.repository.ts](/Users/suja/Documents/vibecoding/cosmere-tracker/backend/src/repositories/roll.repository.ts)
- [combat.repository.ts](/Users/suja/Documents/vibecoding/cosmere-tracker/backend/src/repositories/combat.repository.ts)
- [stage-scene.repository.ts](/Users/suja/Documents/vibecoding/cosmere-tracker/backend/src/repositories/stage-scene.repository.ts)
- [live-stage.repository.ts](/Users/suja/Documents/vibecoding/cosmere-tracker/backend/src/repositories/live-stage.repository.ts)

## Migration Principles

1. Migrate storage before redesigning schemas.
2. Reuse the current `SqliteJsonRepository` pattern first.
3. Keep API contracts stable while storage changes underneath.
4. Migrate domains in dependency order.
5. Prefer one-way import from JSON into SQLite over long-lived dual-write.
6. Keep old JSON files as migration source and safety backup until a slice is verified.

## Why JSON Files Are Now Risky

The current JSON repositories rewrite entire collections on save.

That is acceptable for small prototypes, but the app now has:

- campaign roster data shared across multiple screens
- active combat logs
- stage data
- multiple cross-domain write paths

The main risks are:

- whole-file overwrites when one screen saves stale state
- poor isolation between unrelated domains
- no transaction support for multi-repository writes
- weak auditing during migration

## Recommended Storage Shape

Use SQLite **JSON-row tables** first.

That means each repository still stores one domain object per row:

```sql
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  data TEXT NOT NULL
);
```

This keeps migration low-risk because:

- repository method shapes can stay almost identical
- services do not need immediate domain rewrites
- nested objects remain intact
- later normalization is still possible per table

## Domain Inventory And Cut Order

### Slice 1: Sessions and campaign roster

Tables:

- `sessions`
- `party_members`
- `participant_templates`

Why first:

- smallest blast radius
- foundational to roster and dashboard flows
- fixes the most obvious whole-file overwrite risks
- needed by almost every other Session Ops feature

Primary services:

- [session.service.ts](/Users/suja/Documents/vibecoding/cosmere-tracker/backend/src/services/session.service.ts)

### Slice 2: Stage runtime

Tables:

- `stage_scenes`
- `live_stage_states`

Why second:

- tightly scoped
- easy session-keyed storage
- minimal cross-domain coupling

Primary services:

- [stage.service.ts](/Users/suja/Documents/vibecoding/cosmere-tracker/backend/src/services/stage.service.ts)

### Slice 3: Rolls

Table:

- `rolls`

Why third:

- append-heavy but structurally simple
- linked to sessions and combats by ID only
- easy to validate against existing JSON exports

Primary services:

- [roll.service.ts](/Users/suja/Documents/vibecoding/cosmere-tracker/backend/src/services/roll.service.ts)

### Slice 4: Combats

Table:

- `combats`

Why fourth:

- highest complexity
- biggest payloads
- many embedded event arrays
- strongest need for transactions later, but safe to move as JSON rows first

Primary services:

- [combat.service.ts](/Users/suja/Documents/vibecoding/cosmere-tracker/backend/src/services/combat.service.ts)

## Cut Strategy

Each slice should follow the same pattern:

1. add SQLite repository implementation for that domain
2. add one-shot JSON-to-SQLite backfill
3. switch service construction in [server.ts](/Users/suja/Documents/vibecoding/cosmere-tracker/backend/src/server.ts)
4. keep public service/controller contracts unchanged
5. verify reads, writes, update flows, backups, and imports
6. only then retire that JSON repository from active use

## Repository Strategy

Do **not** change all services at once.

Instead:

- keep repository method names aligned with current JSON repositories:
  - `list()`
  - `get()`
  - `saveAll()`
  - `upsert()`
  - `remove()`
- add SQLite-backed equivalents with the same method contract
- swap wiring in `server.ts` slice by slice

Recommended repository additions:

- `SqliteCollectionRepository<T>` specialized wrappers for Session Ops domains
- or repository classes like:
  - `SqliteSessionRepository`
  - `SqlitePartyMemberRepository`
  - `SqliteParticipantTemplateRepository`

The important part is stable service contracts, not fancy abstraction.

## Migration Runtime Strategy

### Do first

At backend startup:

- open the main SQLite database
- for each migrated table:
  - if the SQLite table is empty
  - and the legacy JSON file exists with records
  - import those records once

### Do not do

- long-term dual-write to JSON and SQLite
- partial runtime reads from both sources forever

After a slice is verified, SQLite should be the source of truth for that slice.

## Transactions

JSON repositories could not do real transactions across domains.

Once Session Ops is in SQLite, we should use database transactions for multi-write service flows, especially:

- session deletion cleanup
- campaign roster updates affecting sessions
- combat updates with linked roll or event writes
- stage import and reorder flows if they expand

This does **not** require full relational schema redesign first.
It only requires sharing the same SQLite database connection for migrated tables.

## Backup And Import Expectations

Keep API backup/export shapes the same for now.

The backup system should continue exporting domain objects, not raw SQL.

That means:

- storage changes stay internal
- old backup/import semantics remain stable
- migration risk is lower

## Risks To Watch

### 1. Session dashboard save behavior

Current save paths can affect campaign-level player and template repositories.

SQLite reduces overwrite risk, but it does not fix bad service semantics by itself.
While migrating Slice 1, review write boundaries carefully.

### 2. Large combat payloads

Combat records are still large nested JSON objects.

That is acceptable for Slice 4, but it should be treated as an intermediate step, not the final combat storage design.

### 3. Duplicate domain patterns

The app already has both JSON repositories and SQLite JSON repositories.

The migration should converge on one Session Ops persistence path instead of keeping both permanently.

## Recommended Immediate Next Implementation Slice

Implement **Slice 1** only:

- `sessions`
- `party_members`
- `participant_templates`

Concrete steps:

1. create SQLite-backed repositories for those three domains
2. wire them into [server.ts](/Users/suja/Documents/vibecoding/cosmere-tracker/backend/src/server.ts)
3. add one-time import from the current JSON files if SQLite tables are empty
4. add tests proving:
   - campaign roster load/save still works
   - session dashboard still loads campaign players and enemy templates
   - session save updates `playerIds` without losing campaign records
5. leave `rolls`, `stage`, and `combats` on JSON until Slice 1 is stable

## Definition Of Done For Planning

Planning is complete when:

- the migration order is explicit
- the first implementation slice is chosen
- the repository strategy is clear
- the compatibility/backfill strategy is clear
- no one needs to rediscover how JSON and SQLite coexist today

This document satisfies that planning milestone.

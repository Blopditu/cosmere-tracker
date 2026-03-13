import { computed, effect, Injectable, signal } from '@angular/core';
import {
  AppData,
  CombatEventDraft,
  CombatantInstance,
  CombatantTemplate,
  FightDraft,
  FightRecord,
  Roster,
  SessionDraft,
  SessionRecord,
} from './models';
import {
  BUILT_IN_SUPPORT_TAGS,
  createDefaultRoster,
  createFightRecord,
  createId,
  createInitialData,
  createSessionFromRoster,
  nowIso,
  STORAGE_KEY,
} from './default-data';
import { buildAnalytics, summarizeFight, summarizeSession } from './combat-summary';

function clone<T>(value: T): T {
  return structuredClone(value);
}

function updateTimestamp<T extends { updatedAt?: string }>(value: T): T {
  return {
    ...value,
    updatedAt: nowIso(),
  };
}

function validateAppData(value: unknown): AppData {
  if (
    typeof value !== 'object' ||
    value === null ||
    !('schemaVersion' in value) ||
    (value as AppData).schemaVersion !== 1 ||
    !Array.isArray((value as AppData).rosters) ||
    !Array.isArray((value as AppData).sessions)
  ) {
    throw new Error('Invalid or unsupported tracker file.');
  }

  return value as AppData;
}

@Injectable({
  providedIn: 'root',
})
export class AppStoreService {
  readonly data = signal<AppData>(this.load());
  readonly rosters = computed(() => this.data().rosters);
  readonly sessions = computed(() =>
    [...this.data().sessions].sort((left, right) => right.playedOn.localeCompare(left.playedOn)),
  );
  readonly activeRoster = computed(() => {
    const rosterId = this.data().settings.activeRosterId;
    return this.data().rosters.find((entry) => entry.id === rosterId) ?? this.data().rosters[0];
  });
  readonly supportTags = computed(() => [
    ...BUILT_IN_SUPPORT_TAGS,
    ...this.data().settings.customSupportTags.filter((tag) => !BUILT_IN_SUPPORT_TAGS.includes(tag)),
  ]);

  constructor() {
    effect(() => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data()));
    });
  }

  sessionById(sessionId: string | null): SessionRecord | undefined {
    return this.data().sessions.find((entry) => entry.id === sessionId);
  }

  fightById(sessionId: string | null, fightId: string | null) {
    return this.sessionById(sessionId)?.fights.find((entry) => entry.id === fightId);
  }

  fightSummary(sessionId: string | null, fightId: string | null) {
    const fight = this.fightById(sessionId, fightId);
    return fight ? summarizeFight(fight) : undefined;
  }

  sessionSummary(sessionId: string | null) {
    const session = this.sessionById(sessionId);
    return session ? summarizeSession(session) : undefined;
  }

  analytics(sessionId?: string, fightId?: string) {
    return buildAnalytics(this.data(), sessionId, fightId);
  }

  createRoster(name = 'New Roster'): string {
    const roster = createDefaultRoster();
    roster.name = name;
    this.patchData((data) => ({
      ...data,
      rosters: [roster, ...data.rosters],
      settings: {
        ...data.settings,
        activeRosterId: roster.id,
      },
    }));
    return roster.id;
  }

  setActiveRoster(rosterId: string): void {
    this.patchData((data) => ({
      ...data,
      settings: {
        ...data.settings,
        activeRosterId: rosterId,
      },
    }));
  }

  updateRoster(rosterId: string, patch: Partial<Roster>): void {
    this.patchData((data) => ({
      ...data,
      rosters: data.rosters.map((roster) =>
        roster.id === rosterId ? updateTimestamp({ ...roster, ...patch }) : roster,
      ),
    }));
  }

  upsertTemplate(
    rosterId: string,
    side: 'party' | 'enemy',
    template: Partial<CombatantTemplate> & Pick<CombatantTemplate, 'name'>,
  ): void {
    this.patchData((data) => ({
      ...data,
      rosters: data.rosters.map((roster) => {
        if (roster.id !== rosterId) {
          return roster;
        }

        const key = side === 'party' ? 'partyTemplates' : 'enemyTemplates';
        const templates = [...roster[key]];
        const incoming: CombatantTemplate = {
          id: template.id ?? createId('template'),
          name: template.name,
          side,
          role: template.role,
          color: template.color,
          notes: template.notes,
        };
        const index = templates.findIndex((entry) => entry.id === incoming.id);
        if (index >= 0) {
          templates[index] = incoming;
        } else {
          templates.push(incoming);
        }

        return updateTimestamp({
          ...roster,
          [key]: templates,
        });
      }),
    }));
  }

  removeTemplate(rosterId: string, side: 'party' | 'enemy', templateId: string): void {
    this.patchData((data) => ({
      ...data,
      rosters: data.rosters.map((roster) => {
        if (roster.id !== rosterId) {
          return roster;
        }
        const key = side === 'party' ? 'partyTemplates' : 'enemyTemplates';
        return updateTimestamp({
          ...roster,
          [key]: roster[key].filter((entry) => entry.id !== templateId),
        });
      }),
    }));
  }

  createSession(draft?: Partial<SessionDraft>): string {
    const roster =
      this.data().rosters.find((entry) => entry.id === draft?.rosterId) ?? this.activeRoster();
    const base = createSessionFromRoster(roster);
    const session: SessionRecord = updateTimestamp({
      ...base,
      campaignName: draft?.campaignName?.trim() || base.campaignName,
      sessionName: draft?.sessionName?.trim() || base.sessionName,
      playedOn: draft?.playedOn || base.playedOn,
      notes: draft?.notes ?? '',
      rosterId: roster.id,
      party: draft?.party?.length ? clone(draft.party) : base.party,
    });

    this.patchData((data) => ({
      ...data,
      sessions: [session, ...data.sessions],
    }));
    return session.id;
  }

  updateSession(sessionId: string, patch: Partial<SessionRecord>): void {
    this.patchData((data) => ({
      ...data,
      sessions: data.sessions.map((session) => {
        if (session.id !== sessionId) {
          return session;
        }

        const next = updateTimestamp({ ...session, ...clone(patch) });
        if (patch.party) {
          next.fights = next.fights.map((fight) => ({
            ...fight,
            combatants: fight.combatants.map((combatant) => {
              if (combatant.side !== 'party') {
                return combatant;
              }
              const updated = patch.party!.find((entry) => entry.id === combatant.id);
              return updated ? { ...combatant, ...updated } : combatant;
            }),
          }));
        }
        return next;
      }),
    }));
  }

  archiveSession(sessionId: string, archived: boolean): void {
    this.updateSession(sessionId, { archived });
  }

  duplicateSession(sessionId: string): string | undefined {
    const session = this.sessionById(sessionId);
    if (!session) {
      return undefined;
    }

    const createdAt = nowIso();
    const idMap = new Map<string, string>();
    const party = session.party.map((actor) => {
      const nextId = createId('actor');
      idMap.set(actor.id, nextId);
      return { ...actor, id: nextId };
    });

    const fights = session.fights.map((fight, index) => ({
      ...fight,
      id: createId('fight'),
      sessionId: '',
      order: index + 1,
      combatants: fight.combatants.map((actor) =>
        actor.side === 'party' ? { ...actor, id: idMap.get(actor.id) ?? createId('actor') } : { ...actor, id: createId('actor') },
      ),
      events: fight.events.map((event) => ({
        ...event,
        id: createId('event'),
        fightId: '',
        actorId: idMap.get(event.actorId) ?? event.actorId,
        targetIds: event.targetIds.map((targetId) => idMap.get(targetId) ?? targetId),
      })),
    }));

    const duplicate: SessionRecord = {
      ...clone(session),
      id: createId('session'),
      sessionName: `${session.sessionName} Copy`,
      createdAt,
      updatedAt: createdAt,
      playedOn: new Date().toISOString().slice(0, 10),
      party,
      fights,
    };
    duplicate.fights = duplicate.fights.map((fight) => ({
      ...fight,
      sessionId: duplicate.id,
      events: fight.events.map((event) => ({
        ...event,
        fightId: fight.id,
      })),
    }));

    this.patchData((data) => ({
      ...data,
      sessions: [duplicate, ...data.sessions],
    }));

    return duplicate.id;
  }

  deleteSession(sessionId: string): void {
    this.patchData((data) => ({
      ...data,
      sessions: data.sessions.filter((session) => session.id !== sessionId),
    }));
  }

  createFight(sessionId: string, draft?: Partial<FightDraft>): string | undefined {
    const session = this.sessionById(sessionId);
    if (!session) {
      return undefined;
    }

    const fight = createFightRecord(sessionId, session.fights.length + 1, session.party);
    fight.name = draft?.name?.trim() || fight.name;
    fight.roundTrackingEnabled = draft?.roundTrackingEnabled ?? this.data().settings.preferredRoundTracking;
    fight.notes = draft?.notes ?? '';
    if (draft?.enemies?.length) {
      fight.combatants = [...fight.combatants, ...clone(draft.enemies)];
    }

    this.patchData((data) => ({
      ...data,
      sessions: data.sessions.map((entry) =>
        entry.id === sessionId
          ? updateTimestamp({
              ...entry,
              fights: [...entry.fights, fight],
            })
          : entry,
      ),
    }));
    return fight.id;
  }

  updateFight(sessionId: string, fightId: string, patch: Partial<FightDraft & FightRecord>): void {
    this.patchData((data) => ({
      ...data,
      sessions: data.sessions.map((session) => {
        if (session.id !== sessionId) {
          return session;
        }
        return updateTimestamp({
          ...session,
          fights: session.fights.map((fight) =>
            fight.id === fightId ? { ...fight, ...clone(patch) } : fight,
          ),
        });
      }),
    }));
  }

  duplicateFight(sessionId: string, fightId: string): string | undefined {
    const fight = this.fightById(sessionId, fightId);
    const session = this.sessionById(sessionId);
    if (!fight || !session) {
      return undefined;
    }

    const duplicate: typeof fight = clone(fight);
    duplicate.id = createId('fight');
    duplicate.sessionId = sessionId;
    duplicate.order = session.fights.length + 1;
    duplicate.name = `${fight.name} Copy`;
    duplicate.startedAt = undefined;
    duplicate.endedAt = undefined;

    const idMap = new Map<string, string>();
    duplicate.combatants = duplicate.combatants.map((combatant) => {
      if (combatant.side === 'party') {
        return combatant;
      }
      const id = createId('actor');
      idMap.set(combatant.id, id);
      return {
        ...combatant,
        id,
      };
    });
    duplicate.events = duplicate.events.map((event) => ({
      ...event,
      id: createId('event'),
      fightId: duplicate.id,
      actorId: idMap.get(event.actorId) ?? event.actorId,
      targetIds: event.targetIds.map((targetId) => idMap.get(targetId) ?? targetId),
    }));

    this.patchData((data) => ({
      ...data,
      sessions: data.sessions.map((entry) =>
        entry.id === sessionId
          ? updateTimestamp({
              ...entry,
              fights: [...entry.fights, duplicate],
            })
          : entry,
      ),
    }));

    return duplicate.id;
  }

  deleteFight(sessionId: string, fightId: string): void {
    this.patchData((data) => ({
      ...data,
      sessions: data.sessions.map((session) =>
        session.id === sessionId
          ? updateTimestamp({
              ...session,
              fights: session.fights.filter((fight) => fight.id !== fightId),
            })
          : session,
      ),
    }));
  }

  addEnemyToFight(sessionId: string, fightId: string, enemy: CombatantInstance): void {
    const fight = this.fightById(sessionId, fightId);
    if (!fight) {
      return;
    }
    this.updateFight(sessionId, fightId, {
      combatants: [...fight.combatants, enemy],
    });
  }

  removeCombatantFromFight(sessionId: string, fightId: string, combatantId: string): void {
    const fight = this.fightById(sessionId, fightId);
    if (!fight) {
      return;
    }
    this.updateFight(sessionId, fightId, {
      combatants: fight.combatants.filter((entry) => entry.id !== combatantId),
      events: fight.events.filter(
        (event) => event.actorId !== combatantId && !event.targetIds.includes(combatantId),
      ),
    });
  }

  addEvent(sessionId: string, fightId: string, draft: CombatEventDraft): string | undefined {
    const fight = this.fightById(sessionId, fightId);
    if (!fight) {
      return undefined;
    }
    const eventId = createId('event');
    const event = {
      id: eventId,
      fightId,
      timestamp: nowIso(),
      ...clone(draft),
      supportTags: draft.supportTags?.filter(Boolean),
    };
    this.updateFight(sessionId, fightId, {
      startedAt: fight.startedAt ?? nowIso(),
      events: [...fight.events, event],
    });
    return eventId;
  }

  deleteEvent(sessionId: string, fightId: string, eventId: string): void {
    const fight = this.fightById(sessionId, fightId);
    if (!fight) {
      return;
    }
    this.updateFight(sessionId, fightId, {
      events: fight.events.filter((entry) => entry.id !== eventId),
    });
  }

  markFightEnded(sessionId: string, fightId: string): void {
    this.updateFight(sessionId, fightId, {
      endedAt: nowIso(),
    });
  }

  setCustomSupportTags(tags: string[]): void {
    this.patchData((data) => ({
      ...data,
      settings: {
        ...data.settings,
        customSupportTags: [...new Set(tags.map((tag) => tag.trim()).filter(Boolean))],
      },
    }));
  }

  setPreferredRoundTracking(enabled: boolean): void {
    this.patchData((data) => ({
      ...data,
      settings: {
        ...data.settings,
        preferredRoundTracking: enabled,
      },
    }));
  }

  exportData(): string {
    return JSON.stringify(this.data(), null, 2);
  }

  importData(json: string, mode: 'replace' | 'merge'): void {
    const imported = validateAppData(JSON.parse(json));

    if (mode === 'replace') {
      this.data.set(imported);
      return;
    }

    const current = this.data();
    const rosterMap = new Map(current.rosters.map((entry) => [entry.id, entry]));
    const sessionMap = new Map(current.sessions.map((entry) => [entry.id, entry]));
    for (const roster of imported.rosters) {
      rosterMap.set(roster.id, roster);
    }
    for (const session of imported.sessions) {
      sessionMap.set(session.id, session);
    }
    this.data.set({
      schemaVersion: 1,
      rosters: Array.from(rosterMap.values()),
      sessions: Array.from(sessionMap.values()),
      settings: {
        ...current.settings,
        ...imported.settings,
      },
    });
  }

  resetToDemoData(): void {
    this.data.set(createInitialData());
  }

  private load(): AppData {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return createInitialData();
    }

    try {
      return validateAppData(JSON.parse(raw));
    } catch {
      return createInitialData();
    }
  }

  private patchData(patch: (data: AppData) => AppData): void {
    this.data.update((current) => patch(clone(current)));
  }
}

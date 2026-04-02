import { randomUUID } from 'node:crypto';
import {
  ACTION_CATALOG,
  ActionKind,
  CampaignRoster,
  CombatPresetAction,
  CombatRecord,
  CreateSessionInput,
  FullAppBackup,
  ImportResult,
  LiveStageState,
  ParticipantTemplate,
  PartyMember,
  RollEvent,
  SessionAnalytics,
  SessionAnalyticsRow,
  SessionBackup,
  SessionDashboard,
  SessionEntity,
  SessionSummary,
  StageScene,
  UpdateSessionInput,
} from '@shared/domain';
import { HttpError } from '../lib/http';
import { nowIso } from '../lib/time';
import { CombatRepository } from '../repositories/combat.repository';
import { RollRepository } from '../repositories/roll.repository';
import { SessionRepository } from '../repositories/session.repository';
import { StageSceneRepository } from '../repositories/stage-scene.repository';
import { LiveStageRepository } from '../repositories/live-stage.repository';
import { PartyMemberRepository } from '../repositories/party-member.repository';
import { ParticipantTemplateRepository } from '../repositories/participant-template.repository';

type LegacySessionEntity = SessionEntity & {
  partyMembers?: PartyMember[];
  participantTemplates?: ParticipantTemplate[];
};

function resolveActionKind(action: { actionType: string; actionKind?: ActionKind }): ActionKind | undefined {
  return action.actionKind ?? ACTION_CATALOG.find((item) => item.key === action.actionType || item.name === action.actionType)?.type;
}

function summarizeCombatRowsByName(combat: CombatRecord, combatRolls: RollEvent[]) {
  return combat.participants.map((participant) => {
    const actionEvents = combat.actionEvents.filter((event) => event.actorId === participant.id);
    const healthEvents = combat.healthEvents ?? [];
    const damageDealt =
      combat.damageEvents
        .filter((event) => event.sourceParticipantId === participant.id)
        .reduce((sum, event) => sum + event.amount, 0) +
      healthEvents
        .filter((event) => event.sourceParticipantId === participant.id && event.delta < 0)
        .reduce((sum, event) => sum + Math.abs(event.delta), 0);
    const damageTaken =
      combat.damageEvents
        .filter((event) => event.targetParticipantId === participant.id)
        .reduce((sum, event) => sum + event.amount, 0) +
      healthEvents
        .filter((event) => event.participantId === participant.id && event.delta < 0)
        .reduce((sum, event) => sum + Math.abs(event.delta), 0);
    const combatSpecificRolls = combatRolls.filter(
      (roll) => roll.combatId === combat.id && (roll.actorId === participant.participantId || roll.actorName === participant.name),
    );
    const hitCount = actionEvents.filter((event) => event.hitResult === 'hit' || event.hitResult === 'criticalHit').length;
    const missCount = actionEvents.filter((event) => event.hitResult === 'miss' || event.hitResult === 'criticalMiss').length;
    const grazeCount = actionEvents.filter((event) => event.hitResult === 'graze').length;

    return {
      actorName: participant.name,
      rollCount: combatSpecificRolls.length,
      averageRawD20: combatSpecificRolls.length
        ? combatSpecificRolls.reduce((sum, roll) => sum + roll.rawD20, 0) / combatSpecificRolls.length
        : 0,
      nat20Count: combatSpecificRolls.filter((roll) => roll.rawD20 === 20).length,
      nat1Count: combatSpecificRolls.filter((roll) => roll.rawD20 === 1).length,
      totalDamageDealt: damageDealt,
      totalDamageTaken: damageTaken,
      hitCount,
      missCount,
      grazeCount,
      hitRate: hitCount + missCount + grazeCount ? (hitCount + grazeCount) / (hitCount + missCount + grazeCount) : 0,
      critCount: actionEvents.filter((event) => event.hitResult === 'criticalHit').length,
      focusSpent: combat.focusEvents
        .filter((event) => event.participantId === participant.id && event.delta < 0)
        .reduce((sum, event) => sum + Math.abs(event.delta), 0),
      supportActionsUsed: actionEvents.filter(
        (event) => event.hitResult === 'support' || ['aid', 'gain-advantage'].includes(event.actionType),
      ).length,
      reactionsUsed: actionEvents.filter((event) => resolveActionKind(event) === 'reaction').length,
      biggestHit: Math.max(
        0,
        ...combat.damageEvents
          .filter((event) => event.sourceParticipantId === participant.id)
          .map((event) => event.amount),
      ),
    };
  });
}

function normalizePartyMember(member: PartyMember): PartyMember {
  return {
    ...member,
    name: member.name.trim(),
    side: member.side === 'ally' ? 'ally' : 'pc',
    role: member.role?.trim() || undefined,
    notes: member.notes?.trim() || undefined,
    imagePath: member.imagePath || undefined,
    maxHealth: member.maxHealth ?? undefined,
    maxFocus: member.maxFocus ?? undefined,
  };
}

function normalizeParticipantTemplate(template: ParticipantTemplate): ParticipantTemplate {
  return {
    ...template,
    name: template.name.trim(),
    side: template.side === 'npc' ? 'npc' : 'enemy',
    role: template.role?.trim() || undefined,
    notes: template.notes?.trim() || undefined,
    imagePath: template.imagePath || undefined,
    maxHealth: template.maxHealth ?? undefined,
    maxFocus: template.maxFocus ?? undefined,
    presetActions: normalizePresetActions(template.presetActions),
  };
}

function normalizePresetActions(actions: CombatPresetAction[] | undefined): CombatPresetAction[] {
  return (actions ?? [])
    .map((action) => normalizePresetAction(action))
    .filter((action): action is CombatPresetAction => Boolean(action));
}

function normalizePresetAction(action: CombatPresetAction | undefined): CombatPresetAction | null {
  if (!action) {
    return null;
  }
  const name = action.name.trim();
  if (!name) {
    return null;
  }
  return {
    ...action,
    name,
    kind: action.kind === 'reaction' || action.kind === 'free' ? action.kind : 'action',
    actionCost: action.actionCost ?? 0,
    focusCost: action.focusCost ?? 0,
    requiresTarget: Boolean(action.requiresTarget),
    requiresRoll: Boolean(action.requiresRoll),
    supportsDamage: Boolean(action.supportsDamage),
    defaultModifier: action.defaultModifier ?? undefined,
    defaultDamageFormula: action.defaultDamageFormula?.trim() || undefined,
  };
}

function participantSignature(
  entry: Pick<PartyMember | ParticipantTemplate, 'name' | 'side' | 'role' | 'maxHealth' | 'maxFocus' | 'notes' | 'imagePath'> &
    Partial<Pick<ParticipantTemplate, 'presetActions'>>,
): string {
  return JSON.stringify({
    name: entry.name.trim().toLowerCase(),
    side: entry.side,
    role: entry.role?.trim().toLowerCase() || '',
    maxHealth: entry.maxHealth ?? null,
    maxFocus: entry.maxFocus ?? null,
    notes: entry.notes?.trim().toLowerCase() || '',
    imagePath: entry.imagePath || '',
    presetActions: normalizePresetActions(entry.presetActions).map((action) => ({
      name: action.name.trim().toLowerCase(),
      kind: action.kind,
      actionCost: action.actionCost,
      focusCost: action.focusCost,
      requiresTarget: action.requiresTarget,
      requiresRoll: action.requiresRoll,
      supportsDamage: action.supportsDamage,
      defaultModifier: action.defaultModifier ?? null,
      defaultDamageFormula: action.defaultDamageFormula?.trim().toLowerCase() || '',
    })),
  });
}

function baseParticipantId(participantId: string | undefined): string | undefined {
  if (!participantId) {
    return undefined;
  }
  return participantId.split(':')[0] ?? participantId;
}

export class SessionService {
  private migrationChecked = false;

  constructor(
    private readonly sessionRepository: SessionRepository,
    private readonly partyMemberRepository: PartyMemberRepository,
    private readonly participantTemplateRepository: ParticipantTemplateRepository,
    private readonly rollRepository: RollRepository,
    private readonly combatRepository: CombatRepository,
    private readonly stageSceneRepository: StageSceneRepository,
    private readonly liveStageRepository: LiveStageRepository,
  ) {}

  private async ensureCampaignCollections(): Promise<void> {
    if (this.migrationChecked) {
      return;
    }

    const [storedSessions, storedPartyMembers, storedParticipantTemplates] = await Promise.all([
      this.sessionRepository.list() as Promise<LegacySessionEntity[]>,
      this.partyMemberRepository.list(),
      this.participantTemplateRepository.list(),
    ]);

    const hasLegacySessions = storedSessions.some(
      (session) => Array.isArray(session.partyMembers) || Array.isArray(session.participantTemplates),
    );

    if (!hasLegacySessions) {
      this.migrationChecked = true;
      return;
    }

    const partyMembers = [...storedPartyMembers];
    const participantTemplates = [...storedParticipantTemplates];
    const partyIds = new Set(partyMembers.map((member) => member.id));
    const templateIds = new Set(participantTemplates.map((template) => template.id));

    const sessions: SessionEntity[] = storedSessions.map((session) => {
      const legacyMembers = (session.partyMembers ?? []).map(normalizePartyMember);
      const legacyTemplates = (session.participantTemplates ?? []).map(normalizeParticipantTemplate);

      for (const member of legacyMembers) {
        if (!partyIds.has(member.id)) {
          partyMembers.push(member);
          partyIds.add(member.id);
        }
      }

      for (const template of legacyTemplates) {
        if (!templateIds.has(template.id)) {
          participantTemplates.push(template);
          templateIds.add(template.id);
        }
      }

      return {
        id: session.id,
        title: session.title,
        notes: session.notes,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
        playerIds: session.playerIds?.length ? session.playerIds : legacyMembers.map((member) => member.id),
      };
    });

    await Promise.all([
      this.sessionRepository.saveAll(sessions),
      this.partyMemberRepository.saveAll(partyMembers),
      this.participantTemplateRepository.saveAll(participantTemplates),
    ]);

    this.migrationChecked = true;
  }

  private async loadCampaignData(): Promise<{
    sessions: SessionEntity[];
    partyMembers: PartyMember[];
    participantTemplates: ParticipantTemplate[];
  }> {
    await this.ensureCampaignCollections();
    const [sessions, partyMembers, participantTemplates] = await Promise.all([
      this.sessionRepository.list(),
      this.partyMemberRepository.list(),
      this.participantTemplateRepository.list(),
    ]);

    return {
      sessions,
      partyMembers,
      participantTemplates,
    };
  }

  private summarizeSession(
    session: SessionEntity,
    partyMembers: PartyMember[],
    participantTemplates: ParticipantTemplate[],
    counts: { rollCount: number; combatCount: number; stageSceneCount: number },
  ): SessionSummary {
    const partyLookup = new Map(partyMembers.map((member) => [member.id, member]));
    const sessionPartyMembers = session.playerIds
      .map((playerId) => partyLookup.get(playerId))
      .filter((member): member is PartyMember => Boolean(member));

    return {
      ...session,
      partyMembers: sessionPartyMembers,
      enemyTemplateCount: participantTemplates.length,
      ...counts,
    };
  }

  private async summarizeSessionWithCounts(session: SessionEntity): Promise<SessionSummary> {
    const [{ partyMembers, participantTemplates }, rolls, combats, scenes] = await Promise.all([
      this.loadCampaignData(),
      this.rollRepository.list(),
      this.combatRepository.list(),
      this.stageSceneRepository.list(),
    ]);

    return this.summarizeSession(session, partyMembers, participantTemplates, {
      rollCount: rolls.filter((roll) => roll.sessionId === session.id).length,
      combatCount: combats.filter((combat) => combat.sessionId === session.id).length,
      stageSceneCount: scenes.filter((scene) => scene.sessionId === session.id).length,
    });
  }

  async list(): Promise<SessionSummary[]> {
    const [{ sessions, partyMembers, participantTemplates }, rolls, combats, scenes] = await Promise.all([
      this.loadCampaignData(),
      this.rollRepository.list(),
      this.combatRepository.list(),
      this.stageSceneRepository.list(),
    ]);

    return sessions
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
      .map((session) =>
        this.summarizeSession(session, partyMembers, participantTemplates, {
          rollCount: rolls.filter((roll) => roll.sessionId === session.id).length,
          combatCount: combats.filter((combat) => combat.sessionId === session.id).length,
          stageSceneCount: scenes.filter((scene) => scene.sessionId === session.id).length,
        }),
      );
  }

  async get(sessionId: string): Promise<SessionSummary> {
    await this.ensureCampaignCollections();
    const session = await this.sessionRepository.get(sessionId);
    if (!session) {
      throw new HttpError(404, 'Session not found.');
    }
    return this.summarizeSessionWithCounts(session);
  }

  async create(input: CreateSessionInput): Promise<SessionSummary> {
    const timestamp = nowIso();
    const [{ partyMembers, participantTemplates }] = await Promise.all([this.loadCampaignData()]);

    const createdPartyMembers = (input.partyMembers ?? [])
      .map((member) =>
        normalizePartyMember({
          ...member,
          id: randomUUID(),
          side: member.side === 'ally' ? 'ally' : 'pc',
        }),
      )
      .filter((member) => member.name);

    const createdTemplates = (input.participantTemplates ?? [])
      .map((template) =>
        normalizeParticipantTemplate({
          ...template,
          id: randomUUID(),
          side: template.side === 'npc' ? 'npc' : 'enemy',
        }),
      )
      .filter((template) => template.name);

    const validPlayerIds = new Set([...partyMembers, ...createdPartyMembers].map((member) => member.id));
    const playerIds = [...new Set([...(input.playerIds ?? []).filter((id) => validPlayerIds.has(id)), ...createdPartyMembers.map((member) => member.id)])];

    const session: SessionEntity = {
      id: randomUUID(),
      title: input.title.trim(),
      notes: input.notes?.trim(),
      createdAt: timestamp,
      updatedAt: timestamp,
      playerIds,
    };

    await Promise.all([
      this.sessionRepository.upsert(session),
      createdPartyMembers.length
        ? this.partyMemberRepository.saveAll([...partyMembers, ...createdPartyMembers])
        : Promise.resolve(),
      createdTemplates.length
        ? this.participantTemplateRepository.saveAll([...participantTemplates, ...createdTemplates])
        : Promise.resolve(),
      this.liveStageRepository.upsert({
        sessionId: session.id,
        liveSceneId: null,
        updatedAt: timestamp,
      }),
    ]);

    return this.summarizeSessionWithCounts(session);
  }

  async update(sessionId: string, patch: UpdateSessionInput): Promise<SessionSummary> {
    const { sessions, partyMembers, participantTemplates } = await this.loadCampaignData();
    const session = sessions.find((entry) => entry.id === sessionId);
    if (!session) {
      throw new HttpError(404, 'Session not found.');
    }

    const nextPartyMembers = patch.partyMembers
      ? patch.partyMembers.map(normalizePartyMember).filter((member) => member.name)
      : partyMembers;
    const nextParticipantTemplates = patch.participantTemplates
      ? patch.participantTemplates.map(normalizeParticipantTemplate).filter((template) => template.name)
      : participantTemplates;

    const validPlayerIds = new Set(nextPartyMembers.map((member) => member.id));
    const nextPlayerIds = (patch.playerIds ?? session.playerIds).filter((playerId) => validPlayerIds.has(playerId));
    const next: SessionEntity = {
      ...session,
      title: patch.title?.trim() || session.title,
      notes: patch.notes ?? session.notes,
      updatedAt: nowIso(),
      playerIds: nextPlayerIds,
    };

    const nextSessions = patch.partyMembers
      ? sessions.map((entry) =>
          entry.id === sessionId
            ? next
            : {
                ...entry,
                playerIds: entry.playerIds.filter((playerId) => validPlayerIds.has(playerId)),
              },
        )
      : sessions.map((entry) => (entry.id === sessionId ? next : entry));

    await Promise.all([
      this.sessionRepository.saveAll(nextSessions),
      patch.partyMembers ? this.partyMemberRepository.saveAll(nextPartyMembers) : Promise.resolve(),
      patch.participantTemplates ? this.participantTemplateRepository.saveAll(nextParticipantTemplates) : Promise.resolve(),
    ]);

    return this.summarizeSessionWithCounts(next);
  }

  async delete(sessionId: string): Promise<void> {
    await this.sessionRepository.remove(sessionId);

    const [rolls, combats, scenes] = await Promise.all([
      this.rollRepository.list(),
      this.combatRepository.list(),
      this.stageSceneRepository.list(),
    ]);

    await Promise.all([
      this.rollRepository.saveAll(rolls.filter((roll) => roll.sessionId !== sessionId)),
      this.combatRepository.saveAll(combats.filter((combat) => combat.sessionId !== sessionId)),
      this.stageSceneRepository.saveAll(scenes.filter((scene) => scene.sessionId !== sessionId)),
      this.liveStageRepository.remove(sessionId),
    ]);
  }

  async dashboard(sessionId: string): Promise<SessionDashboard> {
    const [{ partyMembers, participantTemplates }, session, rolls, combats] = await Promise.all([
      this.loadCampaignData(),
      this.get(sessionId),
      this.rollRepository.list(),
      this.combatRepository.list(),
    ]);

    return {
      session,
      campaignPartyMembers: [...partyMembers].sort((left, right) => left.name.localeCompare(right.name)),
      participantTemplates: [...participantTemplates].sort((left, right) => left.name.localeCompare(right.name)),
      recentRolls: rolls
        .filter((roll) => roll.sessionId === sessionId)
        .sort((left, right) => right.timestamp.localeCompare(left.timestamp))
        .slice(0, 8),
      recentCombats: combats
        .filter((combat) => combat.sessionId === sessionId)
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
        .slice(0, 5),
    };
  }

  async campaignRoster(): Promise<CampaignRoster> {
    const { partyMembers, participantTemplates } = await this.loadCampaignData();
    return {
      partyMembers: [...partyMembers].sort((left, right) => left.name.localeCompare(right.name)),
      participantTemplates: [...participantTemplates].sort((left, right) => left.name.localeCompare(right.name)),
    };
  }

  async updateCampaignRoster(patch: CampaignRoster): Promise<CampaignRoster> {
    const { sessions } = await this.loadCampaignData();
    const partyMembers = patch.partyMembers.map(normalizePartyMember).filter((member) => member.name);
    const participantTemplates = patch.participantTemplates
      .map(normalizeParticipantTemplate)
      .filter((template) => template.name);
    const validPlayerIds = new Set(partyMembers.map((member) => member.id));
    const nextSessions = sessions.map((session) => ({
      ...session,
      playerIds: session.playerIds.filter((playerId) => validPlayerIds.has(playerId)),
    }));

    await Promise.all([
      this.sessionRepository.saveAll(nextSessions),
      this.partyMemberRepository.saveAll(partyMembers),
      this.participantTemplateRepository.saveAll(participantTemplates),
    ]);

    return {
      partyMembers: [...partyMembers].sort((left, right) => left.name.localeCompare(right.name)),
      participantTemplates: [...participantTemplates].sort((left, right) => left.name.localeCompare(right.name)),
    };
  }

  async analytics(sessionId: string): Promise<SessionAnalytics> {
    await this.ensureCampaignCollections();
    const [session, rolls, combats] = await Promise.all([
      this.sessionRepository.get(sessionId),
      this.rollRepository.list(),
      this.combatRepository.list(),
    ]);
    if (!session) {
      throw new HttpError(404, 'Session not found.');
    }

    const sessionRolls = rolls.filter((roll) => roll.sessionId === sessionId);
    const sessionCombats = combats.filter((combat) => combat.sessionId === sessionId);
    const rowsByActor = new Map<string, SessionAnalyticsRow>();

    const ensureRow = (actorName: string): SessionAnalyticsRow => {
      const existing = rowsByActor.get(actorName);
      if (existing) {
        return existing;
      }
      const created: SessionAnalyticsRow = {
        actorName,
        rollCount: 0,
        averageRawD20: 0,
        nat20Count: 0,
        nat1Count: 0,
        totalDamageDealt: 0,
        totalDamageTaken: 0,
        hitCount: 0,
        missCount: 0,
        grazeCount: 0,
        hitRate: 0,
        critCount: 0,
        focusSpent: 0,
        supportActionsUsed: 0,
        reactionsUsed: 0,
        biggestHit: 0,
      };
      rowsByActor.set(actorName, created);
      return created;
    };

    for (const roll of sessionRolls) {
      const actorName = roll.actorName || roll.actorId || 'Unknown';
      const row = ensureRow(actorName);
      const nextCount = row.rollCount + 1;
      row.averageRawD20 = ((row.averageRawD20 * row.rollCount) + roll.rawD20) / nextCount;
      row.rollCount = nextCount;
      row.nat20Count += roll.rawD20 === 20 ? 1 : 0;
      row.nat1Count += roll.rawD20 === 1 ? 1 : 0;
    }

    for (const combat of sessionCombats) {
      const combatRows = summarizeCombatRowsByName(combat, sessionRolls);
      for (const combatRow of combatRows) {
        const row = ensureRow(combatRow.actorName);
        row.totalDamageDealt += combatRow.totalDamageDealt;
        row.totalDamageTaken += combatRow.totalDamageTaken;
        row.hitCount += combatRow.hitCount;
        row.missCount += combatRow.missCount;
        row.grazeCount += combatRow.grazeCount;
        row.critCount += combatRow.critCount;
        row.focusSpent += combatRow.focusSpent;
        row.supportActionsUsed += combatRow.supportActionsUsed;
        row.reactionsUsed += combatRow.reactionsUsed;
        row.biggestHit = Math.max(row.biggestHit, combatRow.biggestHit);
      }
    }

    const partyPerformance = [...rowsByActor.values()]
      .map((row) => ({
        ...row,
        hitRate: row.hitCount + row.missCount + row.grazeCount
          ? (row.hitCount + row.grazeCount) / (row.hitCount + row.missCount + row.grazeCount)
          : 0,
      }))
      .sort((left, right) => right.totalDamageDealt - left.totalDamageDealt || right.rollCount - left.rollCount);

    const awardName = (selector: (row: SessionAnalyticsRow) => number) => partyPerformance[0]
      ? [...partyPerformance].sort((left, right) => selector(right) - selector(left))[0]?.actorName ?? null
      : null;

    return {
      sessionId,
      totalRolls: sessionRolls.length,
      totalCombats: sessionCombats.length,
      nat20Count: sessionRolls.filter((roll) => roll.rawD20 === 20).length,
      nat1Count: sessionRolls.filter((roll) => roll.rawD20 === 1).length,
      averageRawD20: sessionRolls.length
        ? sessionRolls.reduce((sum, roll) => sum + roll.rawD20, 0) / sessionRolls.length
        : 0,
      totalDamageDealt: partyPerformance.reduce((sum, row) => sum + row.totalDamageDealt, 0),
      totalDamageTaken: partyPerformance.reduce((sum, row) => sum + row.totalDamageTaken, 0),
      totalFocusSpent: partyPerformance.reduce((sum, row) => sum + row.focusSpent, 0),
      partyPerformance,
      awards: {
        mostAccurate: awardName((row) => row.hitRate),
        biggestHit: awardName((row) => row.biggestHit),
        mostSupportOriented: awardName((row) => row.supportActionsUsed),
        focusPressureLeader: awardName((row) => row.focusSpent),
        mostDamageDealt: awardName((row) => row.totalDamageDealt),
        mostDamageTaken: awardName((row) => row.totalDamageTaken),
      },
      recentCombatSummaries: sessionCombats
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
        .slice(0, 5)
        .map((combat) => {
          const combatRows = summarizeCombatRowsByName(combat, sessionRolls);
          const topDamageDealer = [...combatRows].sort((left, right) => right.totalDamageDealt - left.totalDamageDealt)[0];
          const biggestHit = Math.max(0, ...combatRows.map((row) => row.biggestHit));
          return {
            combatId: combat.id,
            title: combat.title,
            status: combat.status,
            roundNumber: combat.currentRoundNumber,
            topDamageDealer: topDamageDealer?.actorName ?? null,
            biggestHit,
          };
        }),
    };
  }

  async exportSession(sessionId: string): Promise<SessionBackup> {
    const [{ partyMembers, participantTemplates }, session, rolls, combats, stageScenes, liveStageState] = await Promise.all([
      this.loadCampaignData(),
      this.sessionRepository.get(sessionId),
      this.rollRepository.list(),
      this.combatRepository.list(),
      this.stageSceneRepository.list(),
      this.liveStageRepository.get(sessionId),
    ]);
    if (!session) {
      throw new HttpError(404, 'Session not found.');
    }

    const playerIds = new Set(session.playerIds);

    return {
      metadata: {
        version: 1,
        exportedAt: nowIso(),
        format: 'cosmere-tracker-json',
        scope: 'session',
      },
      data: {
        session,
        partyMembers: partyMembers.filter((member) => playerIds.has(member.id)),
        participantTemplates,
        rolls: rolls.filter((roll) => roll.sessionId === sessionId),
        combats: combats.filter((combat) => combat.sessionId === sessionId),
        stageScenes: stageScenes.filter((scene) => scene.sessionId === sessionId),
        liveStageState: liveStageState ?? null,
      },
    };
  }

  async importSession(backup: SessionBackup): Promise<ImportResult> {
    const timestamp = nowIso();
    const source = backup.data;
    const sessionId = randomUUID();
    const [{ partyMembers: existingPartyMembers, participantTemplates: existingParticipantTemplates }] = await Promise.all([
      this.loadCampaignData(),
    ]);

    const legacySession = source.session as LegacySessionEntity;
    const sourcePartyMembers = (source.partyMembers ?? legacySession.partyMembers ?? []).map(normalizePartyMember);
    const sourceParticipantTemplates = (source.participantTemplates ?? legacySession.participantTemplates ?? []).map(normalizeParticipantTemplate);

    const partyMemberIds = new Map<string, string>();
    const templateIds = new Map<string, string>();
    const nextPartyMembers = [...existingPartyMembers];
    const nextParticipantTemplates = [...existingParticipantTemplates];
    const existingPartyBySignature = new Map(existingPartyMembers.map((member) => [participantSignature(member), member]));
    const existingTemplateBySignature = new Map(existingParticipantTemplates.map((template) => [participantSignature(template), template]));

    for (const member of sourcePartyMembers) {
      const existing = existingPartyBySignature.get(participantSignature(member));
      if (existing) {
        partyMemberIds.set(member.id, existing.id);
        continue;
      }
      const nextId = randomUUID();
      partyMemberIds.set(member.id, nextId);
      const created = { ...member, id: nextId };
      nextPartyMembers.push(created);
      existingPartyBySignature.set(participantSignature(member), created);
    }

    for (const template of sourceParticipantTemplates) {
      const existing = existingTemplateBySignature.get(participantSignature(template));
      if (existing) {
        templateIds.set(template.id, existing.id);
        continue;
      }
      const nextId = randomUUID();
      templateIds.set(template.id, nextId);
      const created = { ...template, id: nextId };
      nextParticipantTemplates.push(created);
      existingTemplateBySignature.set(participantSignature(template), created);
    }

    const sourcePlayerIds = legacySession.playerIds?.length
      ? legacySession.playerIds
      : sourcePartyMembers.map((member) => member.id);

    const session: SessionEntity = {
      id: sessionId,
      title: `${source.session.title} Copy`,
      notes: source.session.notes,
      createdAt: timestamp,
      updatedAt: timestamp,
      playerIds: sourcePlayerIds
        .map((playerId) => partyMemberIds.get(playerId))
        .filter((playerId): playerId is string => Boolean(playerId)),
    };

    const rollIds = new Map<string, string>();
    const combatIds = new Map<string, string>();
    const participantIds = new Map<string, string>();
    const roundIds = new Map<string, string>();
    const turnIds = new Map<string, string>();
    const actionIds = new Map<string, string>();

    const remapSourceParticipantId = (id: string | undefined) => {
      const baseId = baseParticipantId(id);
      if (!baseId) {
        return undefined;
      }
      return partyMemberIds.get(baseId) ?? templateIds.get(baseId) ?? baseId;
    };

    const combats = source.combats.map((combat) => {
      const nextCombatId = randomUUID();
      combatIds.set(combat.id, nextCombatId);

      const participants = combat.participants.map((participant) => {
        const nextParticipantId = randomUUID();
        participantIds.set(participant.id, nextParticipantId);
        const remappedSourceId = remapSourceParticipantId(participant.participantId) ?? participant.participantId;
        return {
          ...participant,
          id: nextParticipantId,
          combatId: nextCombatId,
          participantId: remappedSourceId,
        };
      });

      const rounds = combat.rounds.map((round) => {
        const nextRoundId = randomUUID();
        roundIds.set(round.id, nextRoundId);
        return {
          ...round,
          id: nextRoundId,
          combatId: nextCombatId,
        };
      });

      const turns = combat.turns.map((turn) => {
        const nextTurnId = randomUUID();
        turnIds.set(turn.id, nextTurnId);
        return {
          ...turn,
          id: nextTurnId,
          combatId: nextCombatId,
          roundId: roundIds.get(turn.roundId) ?? turn.roundId,
          participantId: participantIds.get(turn.participantId) ?? turn.participantId,
        };
      });

      const remappedRounds = rounds.map((round, index) => {
        const sourceRound = combat.rounds[index];
        return {
          ...round,
          participantStates: sourceRound?.participantStates?.map((state) => ({
            ...state,
            participantId: participantIds.get(state.participantId) ?? state.participantId,
            turnId: state.turnId ? turnIds.get(state.turnId) ?? state.turnId : undefined,
          })) ?? [],
          fastPCQueueIds: sourceRound?.fastPCQueueIds?.map((id) => turnIds.get(id) ?? id) ?? [],
          fastNPCQueueIds: sourceRound?.fastNPCQueueIds?.map((id) => turnIds.get(id) ?? id) ?? [],
          slowPCQueueIds: sourceRound?.slowPCQueueIds?.map((id) => turnIds.get(id) ?? id) ?? [],
          slowNPCQueueIds: sourceRound?.slowNPCQueueIds?.map((id) => turnIds.get(id) ?? id) ?? [],
          turnIds: sourceRound?.turnIds?.map((id) => turnIds.get(id) ?? id) ?? [],
        };
      });

      const actionEvents = combat.actionEvents.map((event) => {
        const nextActionId = randomUUID();
        actionIds.set(event.id, nextActionId);
        return {
          ...event,
          id: nextActionId,
          combatId: nextCombatId,
          roundId: roundIds.get(event.roundId) ?? event.roundId,
          turnId: event.turnId ? turnIds.get(event.turnId) ?? event.turnId : undefined,
          actorId: participantIds.get(event.actorId) ?? event.actorId,
          targetIds: event.targetIds.map((id) => participantIds.get(id) ?? id),
          linkedRollId: event.linkedRollId,
        };
      });

      const damageEvents = combat.damageEvents.map((event) => ({
        ...event,
        id: randomUUID(),
        combatId: nextCombatId,
        sourceParticipantId: event.sourceParticipantId ? participantIds.get(event.sourceParticipantId) ?? event.sourceParticipantId : undefined,
        targetParticipantId: participantIds.get(event.targetParticipantId) ?? event.targetParticipantId,
        causedByActionEventId: event.causedByActionEventId ? actionIds.get(event.causedByActionEventId) : undefined,
      }));

      const focusEvents = combat.focusEvents.map((event) => ({
        ...event,
        id: randomUUID(),
        combatId: nextCombatId,
        participantId: participantIds.get(event.participantId) ?? event.participantId,
        relatedActionEventId: event.relatedActionEventId ? actionIds.get(event.relatedActionEventId) : undefined,
      }));

      const healthEvents = (combat.healthEvents ?? []).map((event) => ({
        ...event,
        id: randomUUID(),
        combatId: nextCombatId,
        participantId: participantIds.get(event.participantId) ?? event.participantId,
        sourceParticipantId: event.sourceParticipantId ? participantIds.get(event.sourceParticipantId) ?? event.sourceParticipantId : undefined,
        relatedActionEventId: event.relatedActionEventId ? actionIds.get(event.relatedActionEventId) : undefined,
      }));

      const conditionEvents = combat.conditionEvents.map((event) => ({
        ...event,
        id: randomUUID(),
        combatId: nextCombatId,
        participantId: participantIds.get(event.participantId) ?? event.participantId,
      }));

      return {
        ...combat,
        id: nextCombatId,
        sessionId,
        createdAt: combat.createdAt || timestamp,
        participantIds: participants.map((participant) => participant.id),
        roundIds: remappedRounds.map((round) => round.id),
        participants,
        rounds: remappedRounds,
        turns,
        actionEvents,
        damageEvents,
        focusEvents,
        healthEvents,
        conditionEvents,
      };
    });

    const rolls = source.rolls.map((roll) => {
      const nextRollId = randomUUID();
      rollIds.set(roll.id, nextRollId);
      return {
        ...roll,
        id: nextRollId,
        sessionId,
        combatId: roll.combatId ? combatIds.get(roll.combatId) : undefined,
        turnId: roll.turnId ? turnIds.get(roll.turnId) : undefined,
        actorId: remapSourceParticipantId(roll.actorId),
        targetId: remapSourceParticipantId(roll.targetId),
      };
    });

    const updatedCombats = combats.map((combat) => ({
      ...combat,
      actionEvents: combat.actionEvents.map((event) => ({
        ...event,
        linkedRollId: event.linkedRollId ? rollIds.get(event.linkedRollId) : undefined,
      })),
    }));

    const stageScenes = source.stageScenes.map((scene) => ({
      ...scene,
      id: randomUUID(),
      sessionId,
      createdAt: timestamp,
      updatedAt: timestamp,
    }));

    const liveSceneMap = new Map<string, string>();
    source.stageScenes.forEach((scene, index) => {
      const mapped = stageScenes[index];
      if (mapped) {
        liveSceneMap.set(scene.id, mapped.id);
      }
    });

    const liveStageState: LiveStageState = {
      sessionId,
      liveSceneId: source.liveStageState?.liveSceneId ? liveSceneMap.get(source.liveStageState.liveSceneId) ?? null : null,
      updatedAt: timestamp,
    };

    await Promise.all([
      this.partyMemberRepository.saveAll(nextPartyMembers),
      this.participantTemplateRepository.saveAll(nextParticipantTemplates),
      this.sessionRepository.upsert(session),
      this.rollRepository.saveAll([...(await this.rollRepository.list()), ...rolls]),
      this.combatRepository.saveAll([...(await this.combatRepository.list()), ...updatedCombats]),
      this.stageSceneRepository.saveAll([...(await this.stageSceneRepository.list()), ...stageScenes]),
      this.liveStageRepository.upsert(liveStageState),
    ]);

    return {
      message: 'Session imported successfully.',
      importedSessionId: sessionId,
      importedSessionTitle: session.title,
    };
  }

  async exportFullApp(): Promise<FullAppBackup> {
    const [{ sessions, partyMembers, participantTemplates }, rolls, combats, stageScenes, liveStageStates] = await Promise.all([
      this.loadCampaignData(),
      this.rollRepository.list(),
      this.combatRepository.list(),
      this.stageSceneRepository.list(),
      this.liveStageRepository.list(),
    ]);

    return {
      metadata: {
        version: 1,
        exportedAt: nowIso(),
        format: 'cosmere-tracker-json',
        scope: 'full-app',
      },
      data: {
        sessions,
        partyMembers,
        participantTemplates,
        rolls,
        combats,
        stageScenes,
        liveStageStates,
      },
    };
  }

  async importFullApp(backup: FullAppBackup): Promise<ImportResult> {
    const legacySessions = backup.data.sessions as LegacySessionEntity[];
    const backupPartyMembers = backup.data.partyMembers ?? legacySessions.flatMap((session) => session.partyMembers ?? []);
    const backupParticipantTemplates = backup.data.participantTemplates ?? legacySessions.flatMap((session) => session.participantTemplates ?? []);
    const sessions = legacySessions.map((session) => ({
      id: session.id,
      title: session.title,
      notes: session.notes,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      playerIds: session.playerIds?.length ? session.playerIds : (session.partyMembers ?? []).map((member) => member.id),
    }));

    await Promise.all([
      this.sessionRepository.saveAll(sessions),
      this.partyMemberRepository.saveAll(backupPartyMembers.map(normalizePartyMember)),
      this.participantTemplateRepository.saveAll(backupParticipantTemplates.map(normalizeParticipantTemplate)),
      this.rollRepository.saveAll(backup.data.rolls),
      this.combatRepository.saveAll(backup.data.combats),
      this.stageSceneRepository.saveAll(backup.data.stageScenes),
    ]);
    await Promise.all(
      backup.data.liveStageStates.map((state) => this.liveStageRepository.upsert(state)),
    );
    const importedIds = new Set(backup.data.liveStageStates.map((state) => state.sessionId));
    const existingLiveStates = await this.liveStageRepository.list();
    await Promise.all(
      existingLiveStates
        .filter((state) => !importedIds.has(state.sessionId))
        .map((state) => this.liveStageRepository.remove(state.sessionId)),
    );

    this.migrationChecked = true;

    return {
      message: 'Full app data imported successfully.',
      replacedCollections: 7,
    };
  }
}

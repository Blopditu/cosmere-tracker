import { randomUUID } from 'node:crypto';
import {
  ACTION_CATALOG,
  ActionKind,
  CombatParticipantState,
  CombatPhase,
  CombatPresetAction,
  CombatRecord,
  CombatRound,
  CombatRoundParticipantState,
  CombatSummary,
  CombatSummaryRow,
  CombatTurn,
  CommitCurrentRoundInput,
  ConditionEvent,
  CreateActionEventInput,
  CreateCombatInput,
  CreateConditionEventInput,
  CreateDamageEventInput,
  CreateFocusEventInput,
  CreateHealthEventInput,
  CreateInvestitureEventInput,
  FocusEvent,
  HealthEvent,
  InvestitureEvent,
  ReorderCurrentRoundInput,
  RevertActionResult,
  TurnType,
  UpdateCombatStrikePresetInput,
} from '@shared/domain';
import { HttpError } from '../lib/http';
import { nowIso } from '../lib/time';
import { CombatRepository } from '../repositories/combat.repository';
import { SessionRepository } from '../repositories/session.repository';
import { RollService } from './roll.service';

const COMBAT_PHASES: CombatPhase[] = ['fast-pc', 'fast-npc', 'slow-pc', 'slow-npc'];
const PC_PHASES: CombatPhase[] = ['fast-pc', 'slow-pc'];

type QueueKey = 'fastPCQueueIds' | 'fastNPCQueueIds' | 'slowPCQueueIds' | 'slowNPCQueueIds';
type ResolvedCombatAction = {
  name: string;
  kind: ActionKind;
  catalogKey?: string;
  presetActionId?: string;
};

function actionsForTurn(turnType: TurnType): number {
  return turnType === 'fast' ? 2 : 3;
}

function phaseToTurnType(phase: CombatPhase): TurnType {
  return phase.startsWith('fast') ? 'fast' : 'slow';
}

function phaseToQueueKey(phase: CombatPhase): QueueKey {
  switch (phase) {
    case 'fast-pc':
      return 'fastPCQueueIds';
    case 'fast-npc':
      return 'fastNPCQueueIds';
    case 'slow-pc':
      return 'slowPCQueueIds';
    case 'slow-npc':
      return 'slowNPCQueueIds';
  }
}

function nextPhase(current: CombatPhase): CombatPhase | null {
  const index = COMBAT_PHASES.indexOf(current);
  if (index === -1 || index === COMBAT_PHASES.length - 1) {
    return null;
  }
  return COMBAT_PHASES[index + 1] ?? null;
}

function catalogAction(actionType: string) {
  return ACTION_CATALOG.find((item) => item.key === actionType || item.name === actionType);
}

function resolveActionKind(action: { actionType: string; actionKind?: ActionKind }): ActionKind | undefined {
  return action.actionKind ?? catalogAction(action.actionType)?.type;
}

function isReactionAction(action: { actionType: string; actionKind?: ActionKind }): boolean {
  return resolveActionKind(action) === 'reaction';
}

function isSupportAction(actionType: string, hitResult: string | undefined): boolean {
  return hitResult === 'support' || ['aid', 'gain-advantage'].includes(actionType);
}

function normalizeCombatSide(side: CombatParticipantState['side']): CombatParticipantState['side'] {
  return side === 'ally' ? 'npc' : side;
}

function normalizeCombatParticipant(participant: CombatParticipantState): CombatParticipantState {
  return {
    ...participant,
    side: normalizeCombatSide(participant.side),
    presetActions: normalizePresetActions(participant.presetActions),
    currentFocus: participant.currentFocus ?? participant.maxFocus ?? 0,
    maxInvestiture: participant.maxInvestiture ?? undefined,
    currentInvestiture: participant.currentInvestiture ?? participant.maxInvestiture ?? 0,
    conditions: participant.conditions ?? [],
  };
}

function normalizeCombatRecord(combat: CombatRecord): CombatRecord {
  return {
    ...combat,
    participants: combat.participants.map(normalizeCombatParticipant),
    focusEvents: combat.focusEvents ?? [],
    investitureEvents: combat.investitureEvents ?? [],
    healthEvents: combat.healthEvents ?? [],
    conditionEvents: combat.conditionEvents ?? [],
  };
}

function normalizePresetAction(action: CombatPresetAction): CombatPresetAction {
  return {
    ...action,
    name: action.name.trim(),
    kind: action.kind === 'reaction' || action.kind === 'free' ? action.kind : 'action',
    actionCost: action.actionCost ?? 0,
    focusCost: action.focusCost ?? 0,
    requiresTarget: Boolean(action.requiresTarget),
    requiresRoll: Boolean(action.requiresRoll),
    supportsDamage: Boolean(action.supportsDamage),
    defaultModifier: action.defaultModifier ?? undefined,
    defaultDamageFormula: action.defaultDamageFormula?.trim() || undefined,
    rangeText: action.rangeText?.trim() || undefined,
    description: action.description?.trim() || undefined,
  };
}

function normalizePresetActions(actions: CombatPresetAction[] | undefined): CombatPresetAction[] {
  return (actions ?? [])
    .filter((action) => action.name.trim())
    .map((action) => normalizePresetAction(action));
}

function resolveCombatAction(
  actor: CombatParticipantState,
  input: Pick<CreateActionEventInput, 'actionType' | 'actionKind' | 'presetActionId'>,
): ResolvedCombatAction | null {
  if (input.presetActionId) {
    const presetAction = actor.presetActions.find((action) => action.id === input.presetActionId);
    if (!presetAction) {
      return null;
    }
    return {
      name: presetAction.name,
      kind: presetAction.kind,
      presetActionId: presetAction.id,
    };
  }

  const item = catalogAction(input.actionType);
  if (!item) {
    return null;
  }
  return {
    name: item.key,
    kind: item.type,
    catalogKey: item.key,
  };
}

function isParticipantEligibleForPhase(participant: CombatParticipantState, phase: CombatPhase): boolean {
  return PC_PHASES.includes(phase) ? participant.side === 'pc' : participant.side !== 'pc';
}

function sortTurnIdsByOrder(turnIds: string[], turns: CombatTurn[]): string[] {
  return [...turnIds].sort((leftId, rightId) => {
    const left = turns.find((turn) => turn.id === leftId);
    const right = turns.find((turn) => turn.id === rightId);
    if (!left || !right) {
      return leftId.localeCompare(rightId);
    }
    return left.order - right.order || left.startedAt?.localeCompare(right.startedAt ?? '') || left.id.localeCompare(right.id);
  });
}

function currentRound(combat: CombatRecord): CombatRound | undefined {
  if (combat.currentRoundNumber <= 0) {
    return combat.rounds.at(-1);
  }
  return combat.rounds.find((round) => round.roundNumber === combat.currentRoundNumber) ?? combat.rounds.at(-1);
}

function previousRound(combat: CombatRecord, roundId: string): CombatRound | undefined {
  const index = combat.rounds.findIndex((round) => round.id === roundId);
  if (index <= 0) {
    return undefined;
  }
  return combat.rounds[index - 1];
}

function participantStateFor(round: CombatRound, participantId: string): CombatRoundParticipantState | undefined {
  return round.participantStates.find((state) => state.participantId === participantId);
}

function replaceRound(rounds: CombatRound[], nextRound: CombatRound): CombatRound[] {
  return rounds.map((round) => (round.id === nextRound.id ? nextRound : round));
}

function ensureCurrentRound(combat: CombatRecord): CombatRound {
  const round = currentRound(combat);
  if (!round) {
    throw new HttpError(400, 'Combat has no active round.');
  }
  return round;
}

function buildRound(
  combatId: string,
  roundNumber: number,
  participants: CombatParticipantState[],
  previous?: CombatRound,
): CombatRound {
  return {
    id: randomUUID(),
    combatId,
    roundNumber,
    currentPhase: 'fast-pc',
    participantStates: participants.map((participant) => ({
      participantId: participant.id,
      reactionAvailable: previous
        ? participantStateFor(previous, participant.id)?.reactionAvailable ?? true
        : true,
    })),
    fastPCQueueIds: [],
    fastNPCQueueIds: [],
    slowPCQueueIds: [],
    slowNPCQueueIds: [],
    turnIds: [],
    createdAt: nowIso(),
  };
}

function deriveReactionAvailability(
  combat: CombatRecord,
  round: CombatRound,
  participantId: string,
  turn: CombatTurn | undefined,
): boolean {
  const priorRound = previousRound(combat, round.id);
  let reactionAvailable = priorRound
    ? participantStateFor(priorRound, participantId)?.reactionAvailable ?? true
    : true;

  const timeline: Array<{ timestamp: string; priority: number; available: boolean }> = [];
  if (turn?.startedAt) {
    timeline.push({ timestamp: turn.startedAt, priority: 0, available: true });
  }

  for (const event of combat.actionEvents) {
    if (event.roundId !== round.id || event.actorId !== participantId || !isReactionAction(event)) {
      continue;
    }
    timeline.push({ timestamp: event.timestamp, priority: 1, available: false });
  }

  timeline.sort((left, right) => left.timestamp.localeCompare(right.timestamp) || left.priority - right.priority);
  for (const entry of timeline) {
    reactionAvailable = entry.available;
  }
  return reactionAvailable;
}

function rebuildRoundState(combat: CombatRecord, round: CombatRound): CombatRound {
  const roundTurns = combat.turns.filter((turn) => turn.roundId === round.id);
  const participantStates = combat.participants.map((participant) => {
    const turn = roundTurns.find((entry) => entry.participantId === participant.id);
    return {
      participantId: participant.id,
      turnId: turn?.id,
      turnType: turn?.turnType,
      turnStatus: turn?.status,
      reactionAvailable: deriveReactionAvailability(combat, round, participant.id, turn),
      committedAt: turn?.startedAt,
      completedAt: turn?.endedAt,
    };
  });

  return {
    ...round,
    participantStates,
    fastPCQueueIds: sortTurnIdsByOrder(round.fastPCQueueIds, roundTurns),
    fastNPCQueueIds: sortTurnIdsByOrder(round.fastNPCQueueIds, roundTurns),
    slowPCQueueIds: sortTurnIdsByOrder(round.slowPCQueueIds, roundTurns),
    slowNPCQueueIds: sortTurnIdsByOrder(round.slowNPCQueueIds, roundTurns),
    turnIds: sortTurnIdsByOrder(round.turnIds, roundTurns),
  };
}

function rebuildCombatRound(combat: CombatRecord, roundId: string): CombatRecord {
  const round = combat.rounds.find((entry) => entry.id === roundId);
  if (!round) {
    return combat;
  }
  const nextRound = rebuildRoundState(combat, round);
  return {
    ...combat,
    rounds: replaceRound(combat.rounds, nextRound),
  };
}

function openTurnsForPhase(combat: CombatRecord, round: CombatRound, phase: CombatPhase): CombatTurn[] {
  const queue = round[phaseToQueueKey(phase)];
  return queue
    .map((turnId) => combat.turns.find((turn) => turn.id === turnId))
    .filter((turn): turn is CombatTurn => turn !== undefined && turn.status === 'open');
}

function isTurnExhausted(turn: CombatTurn): boolean {
  return turn.actionsUsed >= turn.actionsAvailable;
}

function completeTurns(combat: CombatRecord, turnIds: string[]): CombatRecord {
  if (!turnIds.length) {
    return combat;
  }

  return {
    ...combat,
    turns: combat.turns.map((turn) =>
      turnIds.includes(turn.id)
        ? {
            ...turn,
            status: 'complete' as const,
            endedAt: turn.endedAt ?? nowIso(),
          }
        : turn,
    ),
  };
}

function summarizeCombatRows(
  combat: CombatRecord,
  combatRolls: Awaited<ReturnType<RollService['listBySession']>>,
): CombatSummaryRow[] {
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
      participantId: participant.id,
      name: participant.name,
      side: participant.side,
      rollCount: combatSpecificRolls.length,
      averageRawD20: combatSpecificRolls.length
        ? combatSpecificRolls.reduce((sum, roll) => sum + roll.rawD20, 0) / combatSpecificRolls.length
        : 0,
      totalDamageDealt: damageDealt,
      totalDamageTaken: damageTaken,
      hitCount,
      missCount,
      grazeCount,
      hitRate: hitCount + missCount + grazeCount ? (hitCount + grazeCount) / (hitCount + missCount + grazeCount) : 0,
      critCount: actionEvents.filter((event) => event.hitResult === 'criticalHit').length,
      nat20Count: combatSpecificRolls.filter((roll) => roll.rawD20 === 20).length,
      nat1Count: combatSpecificRolls.filter((roll) => roll.rawD20 === 1).length,
      focusSpent: combat.focusEvents
        .filter((event) => event.participantId === participant.id && event.delta < 0)
        .reduce((sum, event) => sum + Math.abs(event.delta), 0),
      supportActionsUsed: actionEvents.filter((event) => isSupportAction(event.actionType, event.hitResult)).length,
      reactionsUsed: actionEvents.filter((event) => isReactionAction(event)).length,
      biggestHit: Math.max(
        0,
        ...combat.damageEvents
          .filter((event) => event.sourceParticipantId === participant.id)
          .map((event) => event.amount),
      ),
    };
  });
}

export class CombatService {
  constructor(
    private readonly combatRepository: CombatRepository,
    private readonly sessionRepository: SessionRepository,
    private readonly rollService: RollService,
  ) {}

  async listBySession(sessionId: string): Promise<CombatRecord[]> {
    return (await this.combatRepository.list())
      .map(normalizeCombatRecord)
      .filter((combat) => combat.sessionId === sessionId)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }

  async get(combatId: string): Promise<CombatRecord> {
    const combat = await this.combatRepository.get(combatId);
    if (!combat) {
      throw new HttpError(404, 'Combat not found.');
    }
    return normalizeCombatRecord(combat);
  }

  async create(sessionId: string, input: CreateCombatInput): Promise<CombatRecord> {
    const session = await this.sessionRepository.get(sessionId);
    if (!session) {
      throw new HttpError(404, 'Session not found.');
    }

    const combatId = randomUUID();
    const participants: CombatParticipantState[] = input.participants.map((participant) => ({
      id: randomUUID(),
      combatId,
      participantId: participant.participantId,
      name: participant.name.trim(),
      side: normalizeCombatSide(participant.side),
      presetActions: normalizePresetActions(participant.presetActions),
      imagePath: participant.imagePath,
      maxHealth: participant.maxHealth,
      currentHealth: participant.currentHealth,
      maxFocus: participant.maxFocus,
      currentFocus: participant.currentFocus ?? participant.maxFocus ?? 0,
      maxInvestiture: participant.maxInvestiture,
      currentInvestiture: participant.currentInvestiture ?? participant.maxInvestiture ?? 0,
      conditions: [],
    }));

    const combat: CombatRecord = {
      id: combatId,
      sessionId,
      title: input.title.trim(),
      status: 'planned',
      createdAt: nowIso(),
      notes: input.notes?.trim() || undefined,
      participantIds: participants.map((participant) => participant.id),
      currentRoundNumber: 0,
      roundIds: [],
      participants,
      rounds: [],
      turns: [],
      actionEvents: [],
      damageEvents: [],
      focusEvents: [],
      investitureEvents: [],
      healthEvents: [],
      conditionEvents: [],
    };

    await this.combatRepository.upsert(combat);
    return combat;
  }

  async update(combatId: string, patch: Partial<CombatRecord>): Promise<CombatRecord> {
    const combat = await this.get(combatId);
    const next: CombatRecord = {
      ...combat,
      title: patch.title ?? combat.title,
      notes: patch.notes ?? combat.notes,
      status: patch.status ?? combat.status,
      startedAt: patch.startedAt ?? combat.startedAt,
      endedAt: patch.endedAt ?? combat.endedAt,
    };
    await this.combatRepository.upsert(next);
    return next;
  }

  async start(combatId: string): Promise<CombatRecord> {
    const combat = await this.get(combatId);
    const rounds = combat.rounds.length ? combat.rounds : [buildRound(combat.id, 1, combat.participants)];
    const next: CombatRecord = {
      ...combat,
      status: 'active',
      startedAt: combat.startedAt ?? nowIso(),
      currentRoundNumber: rounds.at(-1)?.roundNumber ?? 1,
      roundIds: rounds.map((round) => round.id),
      rounds,
    };
    const refreshed = rebuildCombatRound(next, rounds.at(-1)?.id ?? '');
    await this.combatRepository.upsert(refreshed);
    return refreshed;
  }

  async finish(combatId: string): Promise<CombatRecord> {
    return this.update(combatId, { status: 'finished', endedAt: nowIso() });
  }

  async updateStrikePreset(
    combatId: string,
    participantId: string,
    input: UpdateCombatStrikePresetInput,
  ): Promise<CombatRecord> {
    const combat = await this.get(combatId);
    const participant = combat.participants.find((entry) => entry.id === participantId);
    if (!participant) {
      throw new HttpError(404, 'Combat participant not found.');
    }

    const next: CombatRecord = {
      ...combat,
      participants: combat.participants.map((entry) =>
        entry.id === participantId
          ? {
              ...entry,
              defaultStrikePreset: {
                attackModifier: input.attackModifier,
                damageFormula: input.damageFormula?.trim() || undefined,
                defaultFocusCost: input.defaultFocusCost ?? 0,
              },
            }
          : entry,
      ),
    };
    await this.combatRepository.upsert(next);
    return next;
  }

  async commitCurrentRound(combatId: string, input: CommitCurrentRoundInput): Promise<CombatRecord> {
    const combat = await this.get(combatId);
    if (combat.status !== 'active') {
      throw new HttpError(400, 'Combat must be active before turns can be committed.');
    }

    const round = ensureCurrentRound(combat);
    const participant = combat.participants.find((entry) => entry.id === input.participantId);
    if (!participant) {
      throw new HttpError(404, 'Combat participant not found.');
    }
    if (!isParticipantEligibleForPhase(participant, round.currentPhase)) {
      throw new HttpError(400, 'Participant cannot commit during the current phase.');
    }

    const state = participantStateFor(round, participant.id);
    if (state?.turnId) {
      throw new HttpError(400, 'Participant already has a turn committed this round.');
    }

    const turnType = phaseToTurnType(round.currentPhase);
    const queueKey = phaseToQueueKey(round.currentPhase);
    const committedAt = nowIso();
    const turn: CombatTurn = {
      id: randomUUID(),
      combatId: combat.id,
      roundId: round.id,
      participantId: participant.id,
      phase: round.currentPhase,
      turnType,
      status: 'open',
      order: round[queueKey].length,
      actionsAvailable: actionsForTurn(turnType),
      actionsUsed: 0,
      focusAtStart: participant.currentFocus,
      focusAtEnd: participant.currentFocus,
      damageDealt: 0,
      damageTaken: 0,
      startedAt: committedAt,
    };

    const nextRound: CombatRound = {
      ...round,
      [queueKey]: [...round[queueKey], turn.id],
      turnIds: [...round.turnIds, turn.id],
    };
    const nextCombatBase: CombatRecord = {
      ...combat,
      turns: [...combat.turns, turn],
      rounds: replaceRound(combat.rounds, nextRound),
    };
    const nextCombat = rebuildCombatRound(nextCombatBase, round.id);
    await this.combatRepository.upsert(nextCombat);
    return nextCombat;
  }

  async advanceCurrentPhase(combatId: string): Promise<CombatRecord> {
    const combat = await this.get(combatId);
    if (combat.status !== 'active') {
      throw new HttpError(400, 'Combat must be active before phases can advance.');
    }

    const round = ensureCurrentRound(combat);
    const phaseOpenTurns = openTurnsForPhase(combat, round, round.currentPhase);
    const blockingOpenTurns = phaseOpenTurns.filter((turn) => !isTurnExhausted(turn));
    if (blockingOpenTurns.length) {
      throw new HttpError(400, 'Complete the open turns in the current phase before advancing.');
    }

    const combatWithClosedExhaustedTurns = completeTurns(
      combat,
      phaseOpenTurns.filter((turn) => isTurnExhausted(turn)).map((turn) => turn.id),
    );
    const refreshedRound = ensureCurrentRound(combatWithClosedExhaustedTurns);

    const followingPhase = nextPhase(refreshedRound.currentPhase);
    if (followingPhase) {
      const nextRound = rebuildRoundState(combatWithClosedExhaustedTurns, { ...refreshedRound, currentPhase: followingPhase });
      const nextCombat: CombatRecord = {
        ...combatWithClosedExhaustedTurns,
        rounds: replaceRound(combatWithClosedExhaustedTurns.rounds, nextRound),
      };
      await this.combatRepository.upsert(nextCombat);
      return nextCombat;
    }

    const completedRound = rebuildRoundState(combatWithClosedExhaustedTurns, { ...refreshedRound, completedAt: nowIso() });
    const nextRound = buildRound(combat.id, completedRound.roundNumber + 1, combatWithClosedExhaustedTurns.participants, completedRound);
    const nextCombat: CombatRecord = {
      ...combatWithClosedExhaustedTurns,
      currentRoundNumber: nextRound.roundNumber,
      roundIds: [...combatWithClosedExhaustedTurns.roundIds.filter((id) => id !== completedRound.id), completedRound.id, nextRound.id],
      rounds: [...replaceRound(combatWithClosedExhaustedTurns.rounds, completedRound), nextRound],
    };
    const refreshed = rebuildCombatRound(nextCombat, nextRound.id);
    await this.combatRepository.upsert(refreshed);
    return refreshed;
  }

  async reorderCurrentRound(combatId: string, input: ReorderCurrentRoundInput): Promise<CombatRecord> {
    const combat = await this.get(combatId);
    const round = ensureCurrentRound(combat);
    const queueKey = phaseToQueueKey(input.phase);
    const existingTurnIds = round[queueKey];
    if (
      existingTurnIds.length !== input.orderedTurnIds.length ||
      existingTurnIds.some((turnId) => !input.orderedTurnIds.includes(turnId))
    ) {
      throw new HttpError(400, 'Reorder payload must contain the same turn ids as the current phase queue.');
    }

    const nextTurns = combat.turns.map((turn) => {
      const index = input.orderedTurnIds.indexOf(turn.id);
      if (index === -1) {
        return turn;
      }
      return {
        ...turn,
        order: index,
      };
    });
    const nextRound = rebuildRoundState(
      {
        ...combat,
        turns: nextTurns,
      },
      {
        ...round,
        [queueKey]: [...input.orderedTurnIds],
      },
    );
    const nextCombat: CombatRecord = {
      ...combat,
      turns: nextTurns,
      rounds: replaceRound(combat.rounds, nextRound),
    };
    await this.combatRepository.upsert(nextCombat);
    return nextCombat;
  }

  async completeTurn(combatId: string, turnId: string): Promise<CombatRecord> {
    const combat = await this.get(combatId);
    const turn = combat.turns.find((entry) => entry.id === turnId);
    if (!turn) {
      throw new HttpError(404, 'Turn not found.');
    }

    const nextTurns = combat.turns.map((entry) =>
      entry.id === turnId
        ? {
            ...entry,
            status: 'complete' as const,
            endedAt: entry.endedAt ?? nowIso(),
          }
        : entry,
    );
    const nextCombatBase: CombatRecord = {
      ...combat,
      turns: nextTurns,
    };
    const nextCombat = rebuildCombatRound(nextCombatBase, turn.roundId);
    await this.combatRepository.upsert(nextCombat);
    return nextCombat;
  }

  async spendReaction(combatId: string, participantId: string): Promise<CombatRecord> {
    const combat = await this.get(combatId);
    const round = ensureCurrentRound(combat);
    const actor = combat.participants.find((participant) => participant.id === participantId);
    if (!actor) {
      throw new HttpError(404, 'Combat participant not found.');
    }
    if (!participantStateFor(round, participantId)?.reactionAvailable) {
      throw new HttpError(400, 'Reaction is not currently available.');
    }

    return this.logAction(combatId, {
      roundId: round.id,
      turnId: participantStateFor(round, participantId)?.turnId,
      actorId: participantId,
      actionType: 'custom-reaction',
      actionKind: 'reaction',
      targetIds: [],
      actionCost: 0,
      focusCost: 0,
      note: 'Manual reaction spend',
    });
  }

  async logAction(combatId: string, input: CreateActionEventInput): Promise<CombatRecord> {
    const combat = await this.get(combatId);
    const round = combat.rounds.find((entry) => entry.id === input.roundId);
    if (!round) {
      throw new HttpError(404, 'Round not found.');
    }
    const actor = combat.participants.find((participant) => participant.id === input.actorId);
    if (!actor) {
      throw new HttpError(404, 'Actor not found.');
    }

    const resolvedAction = resolveCombatAction(actor, input);
    if (!resolvedAction) {
      throw new HttpError(400, 'Unknown combat action.');
    }

    const turn = input.turnId ? combat.turns.find((entry) => entry.id === input.turnId) : undefined;
    if (input.turnId && !turn) {
      throw new HttpError(404, 'Turn not found.');
    }
    if (turn && turn.participantId !== input.actorId) {
      throw new HttpError(400, 'Turn does not belong to the selected actor.');
    }
    if (turn && turn.roundId !== input.roundId) {
      throw new HttpError(400, 'Turn does not belong to the selected round.');
    }
    if (resolvedAction.kind !== 'reaction' && !turn) {
      throw new HttpError(400, 'Actions and free actions require a committed turn.');
    }
    if (turn && resolvedAction.kind !== 'reaction' && turn.status !== 'open') {
      throw new HttpError(400, 'Only open turns can log actions or free actions.');
    }
    if (turn && resolvedAction.kind === 'action' && turn.actionsUsed + input.actionCost > turn.actionsAvailable) {
      throw new HttpError(400, 'This turn has no actions remaining for that log entry.');
    }
    if (resolvedAction.kind === 'reaction' && !participantStateFor(round, input.actorId)?.reactionAvailable) {
      throw new HttpError(400, 'Reaction is not currently available.');
    }

    let linkedRollId: string | undefined;
    if (input.linkedRoll) {
      const roll = await this.rollService.create(combat.sessionId, {
        ...input.linkedRoll,
        combatId: combat.id,
        roundNumber: round.roundNumber,
        turnId: input.turnId,
      });
      linkedRollId = roll.id;
    }

    const timestamp = nowIso();
    const actionEventId = randomUUID();
    const actionEvent = {
      id: actionEventId,
      combatId,
      roundId: input.roundId,
      turnId: input.turnId,
      actorId: input.actorId,
      actionType: resolvedAction.name,
      actionKind: resolvedAction.kind,
      presetActionId: resolvedAction.presetActionId,
      targetIds: input.targetIds,
      actionCost: input.actionCost,
      focusCost: input.focusCost,
      linkedRollId,
      hitResult: input.hitResult,
      damageAmount: input.damageAmount,
      damageFormula: input.damageFormula,
      damageBreakdown: input.damageBreakdown,
      actionLabel: input.actionLabel,
      note: input.note,
      timestamp,
    };

    const targetDamage = input.damageAmount ?? 0;
    const totalDamageDealt = targetDamage > 0 ? targetDamage * input.targetIds.length : 0;
    const damageEvents = [...combat.damageEvents];
    for (const targetId of input.targetIds) {
      if (targetDamage <= 0) {
        continue;
      }
      damageEvents.push({
        id: randomUUID(),
        combatId,
        sourceParticipantId: input.actorId,
        targetParticipantId: targetId,
        amount: targetDamage,
        causedByActionEventId: actionEventId,
        timestamp,
      });
    }

    const focusEvents = [...combat.focusEvents];
    if (input.focusCost > 0) {
      focusEvents.push({
        id: randomUUID(),
        combatId,
        participantId: input.actorId,
        delta: -Math.abs(input.focusCost),
        reason: resolvedAction.name,
        relatedActionEventId: actionEventId,
        timestamp,
      });
    }

    const nextParticipants = combat.participants.map((participant) => {
      let next = participant;
      if (participant.id === input.actorId && input.focusCost > 0) {
        next = {
          ...next,
          currentFocus: Math.max(0, participant.currentFocus - input.focusCost),
        };
      }

      const incomingDamage = damageEvents
        .filter((event) => event.causedByActionEventId === actionEventId && event.targetParticipantId === participant.id)
        .reduce((sum, event) => sum + event.amount, 0);
      if (incomingDamage > 0 && next.currentHealth !== undefined) {
        next = {
          ...next,
          currentHealth: Math.max(0, next.currentHealth - incomingDamage),
        };
      }
      return next;
    });

    const nextTurns = combat.turns.map((entry) => {
      if (entry.id !== input.turnId) {
        return entry;
      }
      return {
        ...entry,
        actionsUsed: resolvedAction.kind === 'action' ? entry.actionsUsed + input.actionCost : entry.actionsUsed,
        focusAtEnd: Math.max(0, entry.focusAtEnd - input.focusCost),
        damageDealt: entry.damageDealt + totalDamageDealt,
      };
    });

    const nextCombatBase: CombatRecord = {
      ...combat,
      participants: nextParticipants,
      turns: nextTurns,
      actionEvents: [...combat.actionEvents, actionEvent],
      damageEvents,
      focusEvents,
    };
    const nextCombat = rebuildCombatRound(nextCombatBase, round.id);
    await this.combatRepository.upsert(nextCombat);
    return nextCombat;
  }

  async revertAction(combatId: string, actionEventId: string): Promise<RevertActionResult> {
    const combat = await this.get(combatId);
    const action = combat.actionEvents.find((event) => event.id === actionEventId);
    if (!action) {
      throw new HttpError(404, 'Action event not found.');
    }

    const actionKind = resolveActionKind(action);
    const relatedDamageEvents = combat.damageEvents.filter((event) => event.causedByActionEventId === actionEventId);
    const relatedFocusEvents = combat.focusEvents.filter((event) => event.relatedActionEventId === actionEventId);
    const relatedHealthEvents = (combat.healthEvents ?? []).filter((event) => event.relatedActionEventId === actionEventId);
    const relatedConditionEvents = combat.conditionEvents.filter((event) => event.note === `action:${actionEventId}`);

    if (action.linkedRollId) {
      await this.rollService.delete(action.linkedRollId);
    }

    const nextParticipants = combat.participants.map((participant) => {
      let next = participant;
      if (participant.id === action.actorId && action.focusCost > 0) {
        next = {
          ...next,
          currentFocus: Math.min(next.maxFocus ?? Number.POSITIVE_INFINITY, next.currentFocus + action.focusCost),
        };
      }

      const restoredDamage = relatedDamageEvents
        .filter((event) => event.targetParticipantId === participant.id)
        .reduce((sum, event) => sum + event.amount, 0);
      if (restoredDamage > 0 && next.currentHealth !== undefined) {
        next = {
          ...next,
          currentHealth: Math.min(next.maxHealth ?? Number.POSITIVE_INFINITY, next.currentHealth + restoredDamage),
        };
      }

      for (const event of relatedHealthEvents.filter((entry) => entry.participantId === participant.id)) {
        if (next.currentHealth === undefined) {
          continue;
        }
        next = {
          ...next,
          currentHealth: Math.max(
            0,
            Math.min(next.maxHealth ?? Number.POSITIVE_INFINITY, next.currentHealth - event.delta),
          ),
        };
      }

      if (relatedConditionEvents.length && participant.id === action.actorId) {
        const set = new Set(next.conditions);
        for (const event of relatedConditionEvents) {
          if (event.operation === 'add') {
            set.delete(event.conditionName);
          } else {
            set.add(event.conditionName);
          }
        }
        next = {
          ...next,
          conditions: [...set],
        };
      }

      return next;
    });

    const nextTurns = combat.turns.map((turn) => {
      if (turn.id !== action.turnId) {
        return turn;
      }
      return {
        ...turn,
        actionsUsed: actionKind === 'action' ? Math.max(0, turn.actionsUsed - action.actionCost) : turn.actionsUsed,
        focusAtEnd: Math.max(0, turn.focusAtEnd + action.focusCost),
        damageDealt: Math.max(
          0,
          turn.damageDealt - relatedDamageEvents.reduce((sum, event) => sum + event.amount, 0),
        ),
      };
    });

    const nextCombatBase: CombatRecord = {
      ...combat,
      participants: nextParticipants,
      turns: nextTurns,
      actionEvents: combat.actionEvents.filter((event) => event.id !== actionEventId),
      damageEvents: combat.damageEvents.filter((event) => event.causedByActionEventId !== actionEventId),
      focusEvents: combat.focusEvents.filter((event) => event.relatedActionEventId !== actionEventId),
      healthEvents: (combat.healthEvents ?? []).filter((event) => event.relatedActionEventId !== actionEventId),
      conditionEvents: combat.conditionEvents.filter((event) => event.note !== `action:${actionEventId}`),
    };
    const nextCombat = rebuildCombatRound(nextCombatBase, action.roundId);
    await this.combatRepository.upsert(nextCombat);
    return { combat: nextCombat, revertedActionId: actionEventId };
  }

  async logDamage(combatId: string, input: CreateDamageEventInput): Promise<CombatRecord> {
    const combat = await this.get(combatId);
    const event = {
      id: randomUUID(),
      combatId,
      sourceParticipantId: input.sourceParticipantId,
      targetParticipantId: input.targetParticipantId,
      amount: input.amount,
      damageType: input.damageType,
      causedByActionEventId: input.causedByActionEventId,
      timestamp: nowIso(),
    };
    const next: CombatRecord = {
      ...combat,
      damageEvents: [...combat.damageEvents, event],
      participants: combat.participants.map((participant) => {
        if (participant.id !== input.targetParticipantId || participant.currentHealth === undefined) {
          return participant;
        }
        return {
          ...participant,
          currentHealth: Math.max(0, participant.currentHealth - input.amount),
        };
      }),
    };
    await this.combatRepository.upsert(next);
    return next;
  }

  async logFocus(combatId: string, input: CreateFocusEventInput): Promise<CombatRecord> {
    const combat = await this.get(combatId);
    const event: FocusEvent = {
      id: randomUUID(),
      combatId,
      participantId: input.participantId,
      delta: input.delta,
      reason: input.reason,
      relatedActionEventId: input.relatedActionEventId,
      timestamp: nowIso(),
    };
    const next: CombatRecord = {
      ...combat,
      focusEvents: [...combat.focusEvents, event],
      participants: combat.participants.map((participant) =>
        participant.id === input.participantId
          ? { ...participant, currentFocus: Math.max(0, participant.currentFocus + input.delta) }
          : participant,
      ),
    };
    await this.combatRepository.upsert(next);
    return next;
  }

  async logInvestiture(combatId: string, input: CreateInvestitureEventInput): Promise<CombatRecord> {
    const combat = await this.get(combatId);
    const event: InvestitureEvent = {
      id: randomUUID(),
      combatId,
      participantId: input.participantId,
      delta: input.delta,
      reason: input.reason,
      relatedActionEventId: input.relatedActionEventId,
      timestamp: nowIso(),
    };
    const next: CombatRecord = {
      ...combat,
      investitureEvents: [...combat.investitureEvents, event],
      participants: combat.participants.map((participant) =>
        participant.id === input.participantId
          ? {
              ...participant,
              currentInvestiture: Math.max(0, participant.currentInvestiture + input.delta),
            }
          : participant,
      ),
    };
    await this.combatRepository.upsert(next);
    return next;
  }

  async logHealth(combatId: string, input: CreateHealthEventInput): Promise<CombatRecord> {
    const combat = await this.get(combatId);
    const event: HealthEvent = {
      id: randomUUID(),
      combatId,
      participantId: input.participantId,
      delta: input.delta,
      reason: input.reason,
      sourceParticipantId: input.sourceParticipantId,
      relatedActionEventId: input.relatedActionEventId,
      timestamp: nowIso(),
    };

    const next: CombatRecord = {
      ...combat,
      healthEvents: [...(combat.healthEvents ?? []), event],
      participants: combat.participants.map((participant) => {
        if (participant.id !== input.participantId || participant.currentHealth === undefined) {
          return participant;
        }
        const nextHealth = participant.currentHealth + input.delta;
        const maxHealth = participant.maxHealth ?? Number.POSITIVE_INFINITY;
        return {
          ...participant,
          currentHealth: Math.max(0, Math.min(maxHealth, nextHealth)),
        };
      }),
    };
    await this.combatRepository.upsert(next);
    return next;
  }

  async logCondition(combatId: string, input: CreateConditionEventInput): Promise<CombatRecord> {
    const combat = await this.get(combatId);
    const event: ConditionEvent = {
      id: randomUUID(),
      combatId,
      participantId: input.participantId,
      conditionName: input.conditionName,
      operation: input.operation,
      note: input.note,
      timestamp: nowIso(),
    };
    const next: CombatRecord = {
      ...combat,
      conditionEvents: [...combat.conditionEvents, event],
      participants: combat.participants.map((participant) => {
        if (participant.id !== input.participantId) {
          return participant;
        }
        const set = new Set(participant.conditions);
        if (input.operation === 'add') {
          set.add(input.conditionName);
        } else {
          set.delete(input.conditionName);
        }
        return {
          ...participant,
          conditions: [...set],
        };
      }),
    };
    await this.combatRepository.upsert(next);
    return next;
  }

  async deleteBySession(sessionId: string): Promise<void> {
    const combats = await this.combatRepository.list();
    await this.combatRepository.saveAll(combats.filter((combat) => combat.sessionId !== sessionId));
  }

  async summary(combatId: string): Promise<CombatSummary> {
    const combat = await this.get(combatId);
    const combatRolls = await this.rollService.listBySession(combat.sessionId);

    return {
      combat,
      rows: summarizeCombatRows(combat, combatRolls),
      fullLog: [...combat.actionEvents, ...combat.damageEvents, ...combat.focusEvents, ...combat.investitureEvents, ...(combat.healthEvents ?? []), ...combat.conditionEvents].sort(
        (left, right) => left.timestamp.localeCompare(right.timestamp),
      ),
    };
  }
}

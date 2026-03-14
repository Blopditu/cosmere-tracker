import { randomUUID } from 'node:crypto';
import {
  ACTION_CATALOG,
  CombatParticipantState,
  CombatRecord,
  CombatRound,
  CombatSummary,
  CombatSummaryRow,
  CombatTurn,
  CreateActionEventInput,
  CreateCombatInput,
  CreateConditionEventInput,
  CreateDamageEventInput,
  CreateHealthEventInput,
  CreateFocusEventInput,
  CreateRoundInput,
  HealthEvent,
  RevertActionResult,
  UpdateTurnInput,
} from '@shared/domain';
import { HttpError } from '../lib/http';
import { nowIso } from '../lib/time';
import { CombatRepository } from '../repositories/combat.repository';
import { SessionRepository } from '../repositories/session.repository';
import { RollService } from './roll.service';

function actionsForTurn(turnType: 'fast' | 'slow'): number {
  return turnType === 'fast' ? 2 : 3;
}

function roundGroups(participants: CombatParticipantState[], input: CreateRoundInput) {
  return [
    ...input.fastPCIds.map((participantId) => ({ participantId, turnType: 'fast' as const })),
    ...input.fastNPCIds.map((participantId) => ({ participantId, turnType: 'fast' as const })),
    ...input.slowPCIds.map((participantId) => ({ participantId, turnType: 'slow' as const })),
    ...input.slowNPCIds.map((participantId) => ({ participantId, turnType: 'slow' as const })),
  ].map((entry) => {
    const participant = participants.find((item) => item.id === entry.participantId);
    if (!participant) {
      throw new HttpError(400, 'Round references an unknown participant.');
    }
    return { participant, turnType: entry.turnType };
  });
}

function mapSourceIdsToCombatIds(
  participants: CombatParticipantState[],
  input: CreateRoundInput,
): CreateRoundInput {
  const toCombatIds = (ids: string[]) =>
    ids
      .map((id) => participants.find((participant) => participant.participantId === id || participant.id === id)?.id)
      .filter((id): id is string => Boolean(id));

  return {
    fastPCIds: toCombatIds(input.fastPCIds),
    fastNPCIds: toCombatIds(input.fastNPCIds),
    slowPCIds: toCombatIds(input.slowPCIds),
    slowNPCIds: toCombatIds(input.slowNPCIds),
  };
}

function summarizeCombatRows(combat: CombatRecord, combatRolls: Awaited<ReturnType<RollService['listBySession']>>): CombatSummaryRow[] {
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
      supportActionsUsed: actionEvents.filter(
        (event) => event.hitResult === 'support' || ['aid', 'gain-advantage'].includes(event.actionType),
      ).length,
      reactionsUsed: combat.turns.filter((turn) => turn.participantId === participant.id && turn.reactionUsed).length,
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
      .filter((combat) => combat.sessionId === sessionId)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }

  async get(combatId: string): Promise<CombatRecord> {
    const combat = await this.combatRepository.get(combatId);
    if (!combat) {
      throw new HttpError(404, 'Combat not found.');
    }
    return combat;
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
      name: participant.name,
      side: participant.side,
      imagePath: participant.imagePath,
      maxHealth: participant.maxHealth,
      currentHealth: participant.currentHealth,
      maxFocus: participant.maxFocus,
      currentFocus: participant.currentFocus ?? participant.maxFocus ?? 0,
      conditions: [],
    }));

    let rounds: CombatRound[] = [];
    let turns: CombatTurn[] = [];

    if (input.initialRound) {
      const built = this.buildRound(
        combatId,
        participants,
        1,
        mapSourceIdsToCombatIds(participants, input.initialRound),
      );
      rounds = [built.round];
      turns = built.turns;
    }

    const combat: CombatRecord = {
      id: combatId,
      sessionId,
      title: input.title.trim(),
      status: 'planned',
      createdAt: nowIso(),
      notes: input.notes?.trim(),
      participantIds: participants.map((participant) => participant.id),
      currentRoundNumber: rounds[0]?.roundNumber ?? 0,
      roundIds: rounds.map((round) => round.id),
      participants,
      rounds,
      turns,
      actionEvents: [],
      damageEvents: [],
      focusEvents: [],
      healthEvents: [],
      conditionEvents: [],
    };

    await this.combatRepository.upsert(combat);
    return combat;
  }

  private buildRound(
    combatId: string,
    participants: CombatParticipantState[],
    roundNumber: number,
    input: CreateRoundInput,
  ): { round: CombatRound; turns: CombatTurn[] } {
    const roundId = randomUUID();
    const turnRefs = roundGroups(participants, input);
    const turns = turnRefs.map(({ participant, turnType }) => ({
      id: randomUUID(),
      combatId,
      roundId,
      participantId: participant.id,
      turnType,
      actionsAvailable: actionsForTurn(turnType),
      actionsUsed: 0,
      reactionAvailable: true,
      reactionUsed: false,
      focusAtStart: participant.currentFocus,
      focusAtEnd: participant.currentFocus,
      damageDealt: 0,
      damageTaken: 0,
    }));

    return {
      round: {
        id: roundId,
        combatId,
        roundNumber,
        fastPCIds: input.fastPCIds,
        fastNPCIds: input.fastNPCIds,
        slowPCIds: input.slowPCIds,
        slowNPCIds: input.slowNPCIds,
        turnIds: turns.map((turn) => turn.id),
        createdAt: nowIso(),
      },
      turns,
    };
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
    return this.update(combatId, { status: 'active', startedAt: nowIso() });
  }

  async finish(combatId: string): Promise<CombatRecord> {
    return this.update(combatId, { status: 'finished', endedAt: nowIso() });
  }

  async createRound(combatId: string, input: CreateRoundInput): Promise<CombatRecord> {
    const combat = await this.get(combatId);
    const roundNumber = combat.currentRoundNumber + 1;
    const built = this.buildRound(combat.id, combat.participants, roundNumber, input);
    const next: CombatRecord = {
      ...combat,
      currentRoundNumber: roundNumber,
      rounds: [...combat.rounds, built.round],
      roundIds: [...combat.roundIds, built.round.id],
      turns: [
        ...combat.turns.map((turn) => ({ ...turn, reactionAvailable: false })),
        ...built.turns,
      ],
    };
    await this.combatRepository.upsert(next);
    return next;
  }

  async updateRound(combatId: string, roundId: string, input: CreateRoundInput): Promise<CombatRecord> {
    const combat = await this.get(combatId);
    const round = combat.rounds.find((entry) => entry.id === roundId);
    if (!round) {
      throw new HttpError(404, 'Round not found.');
    }
    const rebuilt = this.buildRound(combat.id, combat.participants, round.roundNumber, input);
    const turns = combat.turns.filter((turn) => turn.roundId !== roundId);
    const next: CombatRecord = {
      ...combat,
      rounds: combat.rounds.map((entry) => (entry.id === roundId ? { ...rebuilt.round, id: roundId } : entry)),
      turns: [...turns, ...rebuilt.turns.map((turn) => ({ ...turn, roundId }))],
    };
    await this.combatRepository.upsert(next);
    return next;
  }

  async updateTurn(combatId: string, turnId: string, patch: UpdateTurnInput): Promise<CombatRecord> {
    const combat = await this.get(combatId);
    const next: CombatRecord = {
      ...combat,
      turns: combat.turns.map((turn) =>
        turn.id === turnId
          ? {
              ...turn,
              ...patch,
            }
          : turn,
      ),
      participants: combat.participants.map((participant) => {
        const updatedTurn = combat.turns.find((turn) => turn.id === turnId);
        if (!updatedTurn || updatedTurn.participantId !== participant.id || patch.focusAtEnd === undefined) {
          return participant;
        }
        return {
          ...participant,
          currentFocus: patch.focusAtEnd,
        };
      }),
    };
    await this.combatRepository.upsert(next);
    return next;
  }

  async logAction(combatId: string, input: CreateActionEventInput): Promise<CombatRecord> {
    const combat = await this.get(combatId);
    const turn = combat.turns.find((entry) => entry.id === input.turnId);
    if (!turn) {
      throw new HttpError(404, 'Turn not found.');
    }

    let linkedRollId: string | undefined;
    if (input.linkedRoll) {
      const roll = await this.rollService.create(combat.sessionId, {
        ...input.linkedRoll,
        combatId: combat.id,
        roundNumber: combat.rounds.find((round) => round.id === input.roundId)?.roundNumber,
        turnId: input.turnId,
      });
      linkedRollId = roll.id;
    }

    const actionEventId = randomUUID();
    const actionEvent = {
      id: actionEventId,
      combatId,
      roundId: input.roundId,
      turnId: input.turnId,
      actorId: input.actorId,
      actionType: input.actionType,
      targetIds: input.targetIds,
      actionCost: input.actionCost,
      focusCost: input.focusCost,
      linkedRollId,
      hitResult: input.hitResult,
      damageAmount: input.damageAmount,
      note: input.note,
      timestamp: nowIso(),
    };

    const nextParticipants = combat.participants.map((participant) => {
      if (participant.id !== input.actorId) {
        return participant;
      }
      return {
        ...participant,
        currentFocus: Math.max(0, participant.currentFocus - input.focusCost),
      };
    });

    const nextTurns = combat.turns.map((entry) => {
      if (entry.id !== input.turnId) {
        return entry;
      }
      const catalogItem = ACTION_CATALOG.find((item) => item.name === input.actionType || item.key === input.actionType);
      const isReaction = catalogItem?.type === 'reaction';
      return {
        ...entry,
        actionsUsed: entry.actionsUsed + input.actionCost,
        reactionUsed: isReaction ? true : entry.reactionUsed,
        focusAtEnd: Math.max(0, entry.focusAtEnd - input.focusCost),
        damageDealt: entry.damageDealt + (input.damageAmount ?? 0),
      };
    });

    const damageEvents = [...combat.damageEvents];
    const targetDamage = input.damageAmount ?? 0;
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
        timestamp: nowIso(),
      });
    }

    const participantsWithDamage = nextParticipants.map((participant) => {
      const received = damageEvents
        .filter((event) => event.targetParticipantId === participant.id)
        .reduce((sum, event) => sum + event.amount, 0);
      return participant.currentHealth === undefined
        ? participant
        : { ...participant, currentHealth: Math.max(0, (participant.maxHealth ?? participant.currentHealth) - received) };
    });

    const focusEvents = [...combat.focusEvents];
    if (input.focusCost > 0) {
      focusEvents.push({
        id: randomUUID(),
        combatId,
        participantId: input.actorId,
        delta: -Math.abs(input.focusCost),
        reason: input.actionType,
        relatedActionEventId: actionEventId,
        timestamp: nowIso(),
      });
    }

    const next: CombatRecord = {
      ...combat,
      participants: participantsWithDamage,
      turns: nextTurns,
      actionEvents: [...combat.actionEvents, actionEvent],
      damageEvents,
      focusEvents,
    };
    await this.combatRepository.upsert(next);
    return next;
  }

  async revertAction(combatId: string, actionEventId: string): Promise<RevertActionResult> {
    const combat = await this.get(combatId);
    const action = combat.actionEvents.find((event) => event.id === actionEventId);
    if (!action) {
      throw new HttpError(404, 'Action event not found.');
    }

    const relatedDamageEvents = combat.damageEvents.filter((event) => event.causedByActionEventId === actionEventId);
    const relatedFocusEvents = combat.focusEvents.filter((event) => event.relatedActionEventId === actionEventId);
    const relatedHealthEvents = (combat.healthEvents ?? []).filter((event) => event.relatedActionEventId === actionEventId);
    const relatedConditionEvents = combat.conditionEvents.filter((event) => event.note === `action:${actionEventId}`);
    const actionTurn = combat.turns.find((turn) => turn.id === action.turnId);
    const catalogItem = ACTION_CATALOG.find((item) => item.name === action.actionType || item.key === action.actionType);

    if (action.linkedRollId) {
      await this.rollService.delete(action.linkedRollId);
    }

    const nextParticipants = combat.participants.map((participant) => {
      let next = participant;
      if (participant.id === action.actorId) {
        const restoredFocus = participant.currentFocus + action.focusCost;
        next = {
          ...next,
          currentFocus: Math.min(next.maxFocus ?? Number.POSITIVE_INFINITY, restoredFocus),
        };
      }

      const restoredDamage = relatedDamageEvents
        .filter((event) => event.targetParticipantId === participant.id)
        .reduce((sum, event) => sum + event.amount, 0);
      if (restoredDamage && next.currentHealth !== undefined) {
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
      const otherReactionEvents = combat.actionEvents.filter(
        (event) =>
          event.turnId === turn.id &&
          event.id !== actionEventId &&
          ACTION_CATALOG.find((item) => item.name === event.actionType || item.key === event.actionType)?.type === 'reaction',
      );
      return {
        ...turn,
        actionsUsed: Math.max(0, turn.actionsUsed - action.actionCost),
        reactionUsed: catalogItem?.type === 'reaction' ? otherReactionEvents.length > 0 : turn.reactionUsed,
        focusAtEnd: Math.max(0, turn.focusAtEnd + action.focusCost),
        damageDealt: Math.max(0, turn.damageDealt - (action.damageAmount ?? 0)),
      };
    });

    const next: CombatRecord = {
      ...combat,
      participants: nextParticipants,
      turns: nextTurns,
      actionEvents: combat.actionEvents.filter((event) => event.id !== actionEventId),
      damageEvents: combat.damageEvents.filter((event) => event.causedByActionEventId !== actionEventId),
      focusEvents: combat.focusEvents.filter((event) => event.relatedActionEventId !== actionEventId),
      healthEvents: (combat.healthEvents ?? []).filter((event) => event.relatedActionEventId !== actionEventId),
      conditionEvents: combat.conditionEvents.filter((event) => event.note !== `action:${actionEventId}`),
    };
    await this.combatRepository.upsert(next);
    return { combat: next, revertedActionId: actionEventId };
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
    const event = {
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
    const event = {
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
      fullLog: [...combat.actionEvents, ...combat.damageEvents, ...combat.focusEvents, ...(combat.healthEvents ?? []), ...combat.conditionEvents].sort(
        (left, right) => left.timestamp.localeCompare(right.timestamp),
      ),
    };
  }
}

import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CreateCombatInput, SessionEntity } from '@shared/domain';
import { HttpError } from '../lib/http';
import { CombatRepository } from '../repositories/combat.repository';
import { RollRepository } from '../repositories/roll.repository';
import { SessionRepository } from '../repositories/session.repository';
import { CombatService } from './combat.service';
import { RollService } from './roll.service';

const SESSION_ID = 'session-1';
const COMBAT_TITLE = 'Test Skirmish';
const DEFAULT_COMBAT_INPUT: CreateCombatInput = {
  title: COMBAT_TITLE,
  participants: [
    {
      participantId: 'pc-1',
      name: 'Kaladin',
      side: 'pc',
      maxHealth: 18,
      currentHealth: 18,
      maxFocus: 4,
      currentFocus: 4,
      maxInvestiture: 3,
      currentInvestiture: 3,
    },
    {
      participantId: 'pc-2',
      name: 'Shallan',
      side: 'pc',
      maxHealth: 14,
      currentHealth: 14,
      maxFocus: 5,
      currentFocus: 5,
      maxInvestiture: 0,
      currentInvestiture: 0,
    },
    {
      participantId: 'enemy-1',
      name: 'Guard A',
      side: 'enemy',
      presetActions: [
        {
          id: 'enemy-1-debilitate',
          name: 'Debilitate',
          kind: 'action',
          actionCost: 1,
          focusCost: 2,
          requiresTarget: true,
          requiresRoll: true,
          supportsDamage: true,
          defaultModifier: 5,
          defaultDamageFormula: '2d8 + 5',
          rangeText: 'reach 5 ft.',
          description: 'Attack +5, reach 5 ft., one target. Graze ... Hit ...',
        },
        {
          id: 'enemy-1-brace-wall',
          name: 'Brace Wall',
          kind: 'reaction',
          actionCost: 0,
          focusCost: 1,
          requiresTarget: false,
          requiresRoll: false,
          supportsDamage: false,
        },
      ],
      maxHealth: 24,
      currentHealth: 24,
      maxFocus: 4,
      currentFocus: 4,
      maxInvestiture: 2,
      currentInvestiture: 2,
    },
  ],
};

function buildSession(): SessionEntity {
  const timestamp = '2026-04-02T10:00:00.000Z';
  return {
    id: SESSION_ID,
    title: 'Test Session',
    createdAt: timestamp,
    updatedAt: timestamp,
    playerIds: [],
  };
}

async function expectHttpError(
  promise: Promise<unknown>,
  statusCode: number,
  message: string,
): Promise<void> {
  try {
    await promise;
    throw new Error('Expected promise to reject with HttpError.');
  } catch (error) {
    expect(error).toBeInstanceOf(HttpError);
    expect((error as HttpError).statusCode).toBe(statusCode);
    expect((error as Error).message).toContain(message);
  }
}

describe('CombatService phase rules', () => {
  let dataDir: string;
  let combatService: CombatService;
  let sessionRepository: SessionRepository;

  beforeEach(async () => {
    dataDir = await mkdtemp(path.join(tmpdir(), 'cosmere-combat-service-'));
    const combatRepository = new CombatRepository(dataDir);
    sessionRepository = new SessionRepository(dataDir);
    const rollRepository = new RollRepository(dataDir);
    const rollService = new RollService(rollRepository);
    combatService = new CombatService(combatRepository, sessionRepository, rollService);
    await sessionRepository.upsert(buildSession());
  });

  afterEach(async () => {
    await rm(dataDir, { recursive: true, force: true });
  });

  it('allows PCs and rejects enemies during fast-pc', async () => {
    const combat = await combatService.create(SESSION_ID, DEFAULT_COMBAT_INPUT);
    const startedCombat = await combatService.start(combat.id);
    const pc = startedCombat.participants.find((participant) => participant.side === 'pc');
    const enemy = startedCombat.participants.find((participant) => participant.side === 'enemy');

    expect(pc).toBeDefined();
    expect(enemy).toBeDefined();
    await expectHttpError(
      combatService.commitCurrentRound(startedCombat.id, { participantId: enemy!.id }),
      400,
      'Participant cannot commit during the current phase.',
    );

    const withFastPcTurn = await combatService.commitCurrentRound(startedCombat.id, { participantId: pc!.id });
    const fastPcTurn = withFastPcTurn.turns.find((turn) => turn.participantId === pc!.id);
    expect(fastPcTurn?.phase).toBe('fast-pc');
  });

  it('allows non-PCs to commit after advancing into fast-npc', async () => {
    const combat = await combatService.create(SESSION_ID, DEFAULT_COMBAT_INPUT);
    const startedCombat = await combatService.start(combat.id);
    const enemy = startedCombat.participants.find((participant) => participant.side === 'enemy');

    const fastNpcCombat = await combatService.advanceCurrentPhase(startedCombat.id);
    expect(fastNpcCombat.rounds[0]?.currentPhase).toBe('fast-npc');

    const withFastNpcTurn = await combatService.commitCurrentRound(fastNpcCombat.id, { participantId: enemy!.id });
    const fastNpcTurn = withFastNpcTurn.turns.find((turn) => turn.participantId === enemy!.id);
    expect(fastNpcTurn?.phase).toBe('fast-npc');
  });

  it('auto-closes an exhausted turn when advancing the phase', async () => {
    const combat = await combatService.create(SESSION_ID, DEFAULT_COMBAT_INPUT);
    const startedCombat = await combatService.start(combat.id);
    const pc = startedCombat.participants.find((participant) => participant.side === 'pc');

    const withCommittedTurn = await combatService.commitCurrentRound(startedCombat.id, { participantId: pc!.id });
    const activeRound = withCommittedTurn.rounds.find((round) => round.roundNumber === withCommittedTurn.currentRoundNumber)!;
    const turn = withCommittedTurn.turns.find((entry) => entry.participantId === pc!.id)!;

    await combatService.logAction(withCommittedTurn.id, {
      roundId: activeRound.id,
      turnId: turn.id,
      actorId: pc!.id,
      actionType: 'move',
      actionKind: 'action',
      targetIds: [],
      actionCost: 1,
      focusCost: 0,
      note: 'Move 1',
    });

    const exhaustedCombat = await combatService.logAction(withCommittedTurn.id, {
      roundId: activeRound.id,
      turnId: turn.id,
      actorId: pc!.id,
      actionType: 'move',
      actionKind: 'action',
      targetIds: [],
      actionCost: 1,
      focusCost: 0,
      note: 'Move 2',
    });

    const advancedCombat = await combatService.advanceCurrentPhase(exhaustedCombat.id);
    const exhaustedTurn = advancedCombat.turns.find((entry) => entry.id === turn.id);
    const nextRound = advancedCombat.rounds.find((round) => round.roundNumber === advancedCombat.currentRoundNumber)!;

    expect(exhaustedTurn?.status).toBe('complete');
    expect(nextRound.currentPhase).toBe('fast-npc');
  });

  it('rejects non-reaction actions until the participant has a committed turn', async () => {
    const combat = await combatService.create(SESSION_ID, DEFAULT_COMBAT_INPUT);
    const startedCombat = await combatService.start(combat.id);
    const activeRound = startedCombat.rounds.find((round) => round.roundNumber === startedCombat.currentRoundNumber)!;
    const pc = startedCombat.participants.find((participant) => participant.side === 'pc')!;

    await expectHttpError(
      combatService.logAction(startedCombat.id, {
        roundId: activeRound.id,
        actorId: pc.id,
        actionType: 'move',
        actionKind: 'action',
        targetIds: [],
        actionCost: 1,
        focusCost: 0,
      }),
      400,
      'Actions and free actions require a committed turn.',
    );
  });

  it('copies preset actions onto combat participants when the combat is created', async () => {
    const combat = await combatService.create(SESSION_ID, DEFAULT_COMBAT_INPUT);
    const enemy = combat.participants.find((participant) => participant.participantId === 'enemy-1');

    expect(enemy?.presetActions).toHaveLength(2);
    expect(enemy?.presetActions[0]?.name).toBe('Debilitate');
    expect(enemy?.presetActions[1]?.kind).toBe('reaction');
    expect(enemy?.presetActions[0]?.rangeText).toBe('reach 5 ft.');
    expect(enemy?.presetActions[0]?.description).toContain('Attack +5');
  });

  it('counts preset reactions by stored action kind in combat summaries', async () => {
    const combat = await combatService.create(SESSION_ID, DEFAULT_COMBAT_INPUT);
    const startedCombat = await combatService.start(combat.id);
    const activeRound = startedCombat.rounds.find((round) => round.roundNumber === startedCombat.currentRoundNumber)!;
    const enemy = startedCombat.participants.find((participant) => participant.participantId === 'enemy-1')!;

    await combatService.logAction(startedCombat.id, {
      roundId: activeRound.id,
      actorId: enemy.id,
      actionType: 'Brace Wall',
      actionKind: 'reaction',
      presetActionId: 'enemy-1-brace-wall',
      targetIds: [],
      actionCost: 0,
      focusCost: 1,
      note: 'Preset reaction',
    });

    const summary = await combatService.summary(startedCombat.id);
    const enemyRow = summary.rows.find((row) => row.participantId === enemy.id);

    expect(enemyRow?.reactionsUsed).toBe(1);
    expect(summary.combat.actionEvents[0]?.actionType).toBe('Brace Wall');
  });

  it('tracks investiture adjustments on combat participants', async () => {
    const combat = await combatService.create(SESSION_ID, DEFAULT_COMBAT_INPUT);
    const actor = combat.participants.find((participant) => participant.participantId === 'pc-1')!;

    const updatedCombat = await combatService.logInvestiture(combat.id, {
      participantId: actor.id,
      delta: -1,
      reason: 'Manual surge spend',
    });

    const updatedActor = updatedCombat.participants.find((participant) => participant.id === actor.id);
    expect(updatedActor?.currentInvestiture).toBe(2);
    expect(updatedCombat.investitureEvents).toHaveLength(1);
    expect(updatedCombat.investitureEvents[0]?.reason).toBe('Manual surge spend');
  });

  it('backfills combats from legacy JSON once, then keeps SQLite as source of truth', async () => {
    const timestamp = '2026-04-04T12:00:00.000Z';
    await writeFile(
      path.join(dataDir, 'combats.json'),
      JSON.stringify(
        [
          {
            id: 'legacy-combat',
            sessionId: SESSION_ID,
            title: 'Legacy Combat',
            status: 'planned',
            createdAt: timestamp,
            participantIds: [],
            currentRoundNumber: 0,
            roundIds: [],
            participants: [],
            rounds: [],
            turns: [],
            actionEvents: [],
            damageEvents: [],
            focusEvents: [],
            investitureEvents: [],
            healthEvents: [],
            conditionEvents: [],
          },
        ],
        null,
        2,
      ),
      'utf8',
    );

    const initialCombats = await combatService.listBySession(SESSION_ID);
    expect(initialCombats.map((combat) => combat.title)).toContain('Legacy Combat');

    await writeFile(path.join(dataDir, 'combats.json'), JSON.stringify([], null, 2), 'utf8');

    const persistedCombats = await combatService.listBySession(SESSION_ID);
    expect(persistedCombats.map((combat) => combat.title)).toContain('Legacy Combat');

    const persistedCombat = await combatService.get('legacy-combat');
    expect(persistedCombat.title).toBe('Legacy Combat');
  });
});

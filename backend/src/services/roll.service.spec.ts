import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { RollRepository } from '../repositories/roll.repository';
import { RollService } from './roll.service';

describe('RollService SQLite backfill', () => {
  let dataDir: string;
  let rollService: RollService;

  beforeEach(async () => {
    dataDir = await mkdtemp(path.join(tmpdir(), 'cosmere-roll-service-'));
    rollService = new RollService(new RollRepository(dataDir));
  });

  afterEach(async () => {
    await rm(dataDir, { recursive: true, force: true });
  });

  it('backfills rolls from legacy JSON once, then keeps SQLite as source of truth', async () => {
    const timestamp = '2026-04-04T11:00:00.000Z';
    await writeFile(
      path.join(dataDir, 'rolls.json'),
      JSON.stringify(
        [
          {
            id: 'roll-1',
            sessionId: 'session-1',
            rollCategory: 'skill',
            rawD20: 17,
            modifier: 4,
            total: 21,
            outcome: 'success',
            actorName: 'Rockefeller',
            timestamp,
          },
        ],
        null,
        2,
      ),
      'utf8',
    );

    const initialRolls = await rollService.listBySession('session-1');
    const initialAnalytics = await rollService.analytics('session-1');

    expect(initialRolls.map((roll) => roll.actorName)).toEqual(['Rockefeller']);
    expect(initialAnalytics.totalRolls).toBe(1);

    await writeFile(path.join(dataDir, 'rolls.json'), JSON.stringify([], null, 2), 'utf8');

    const persistedRolls = await rollService.listBySession('session-1');
    expect(persistedRolls.map((roll) => roll.actorName)).toEqual(['Rockefeller']);

    const createdRoll = await rollService.create('session-1', {
      rollCategory: 'generic',
      rawD20: 12,
      modifier: 1,
      outcome: 'neutral',
    });

    const combinedRolls = await rollService.listBySession('session-1');
    expect(combinedRolls.some((roll) => roll.id === createdRoll.id)).toBe(true);
    expect(combinedRolls).toHaveLength(2);
  });
});

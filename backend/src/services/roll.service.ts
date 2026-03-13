import { randomUUID } from 'node:crypto';
import { CreateRollInput, RollAnalytics, RollEvent, RollOutcome } from '@shared/domain';
import { RollRepository } from '../repositories/roll.repository';
import { nowIso } from '../lib/time';

function normalizeOutcome(rawD20: number, outcome?: RollOutcome): RollOutcome {
  if (outcome) {
    return outcome;
  }
  if (rawD20 === 20) {
    return 'criticalSuccess';
  }
  if (rawD20 === 1) {
    return 'criticalFailure';
  }
  return 'neutral';
}

export class RollService {
  constructor(private readonly rollRepository: RollRepository) {}

  async listBySession(sessionId: string): Promise<RollEvent[]> {
    return (await this.rollRepository.list())
      .filter((roll) => roll.sessionId === sessionId)
      .sort((left, right) => right.timestamp.localeCompare(left.timestamp));
  }

  async create(sessionId: string, input: CreateRollInput): Promise<RollEvent> {
    const roll: RollEvent = {
      id: randomUUID(),
      sessionId,
      combatId: input.combatId,
      roundNumber: input.roundNumber,
      turnId: input.turnId,
      actorId: input.actorId,
      actorName: input.actorName,
      targetId: input.targetId,
      targetName: input.targetName,
      rollCategory: input.rollCategory,
      rawD20: input.rawD20,
      modifier: input.modifier,
      total: input.rawD20 + input.modifier,
      advantageNote: input.advantageNote,
      plotDie: input.plotDie,
      outcome: normalizeOutcome(input.rawD20, input.outcome),
      note: input.note,
      timestamp: nowIso(),
    };

    await this.rollRepository.upsert(roll);
    return roll;
  }

  async update(rollId: string, patch: Partial<RollEvent>): Promise<RollEvent | undefined> {
    const existing = await this.rollRepository.get(rollId);
    if (!existing) {
      return undefined;
    }

    const next: RollEvent = {
      ...existing,
      ...patch,
      total: (patch.rawD20 ?? existing.rawD20) + (patch.modifier ?? existing.modifier),
    };
    await this.rollRepository.upsert(next);
    return next;
  }

  async analytics(sessionId: string): Promise<RollAnalytics> {
    const rolls = await this.listBySession(sessionId);
    const attackRolls = rolls.filter((roll) => roll.rollCategory === 'attack');
    const groups = new Map<string, RollEvent[]>();

    for (const roll of rolls) {
      const key = roll.actorName || roll.actorId || 'Unknown';
      groups.set(key, [...(groups.get(key) ?? []), roll]);
    }

    const averageRawD20 = rolls.length
      ? rolls.reduce((sum, roll) => sum + roll.rawD20, 0) / rolls.length
      : 0;
    const nat20Count = rolls.filter((roll) => roll.rawD20 === 20).length;
    const nat1Count = rolls.filter((roll) => roll.rawD20 === 1).length;
    const successfulAttacks = attackRolls.filter((roll) =>
      ['success', 'criticalSuccess'].includes(roll.outcome),
    ).length;

    return {
      totalRolls: rolls.length,
      nat20Count,
      nat1Count,
      averageRawD20,
      attackAccuracy: attackRolls.length ? successfulAttacks / attackRolls.length : 0,
      luckDelta: averageRawD20 - 10.5,
      rollsPerCharacter: [...groups.entries()].map(([actorName, entries]) => ({
        actorName,
        count: entries.length,
        averageRawD20: entries.reduce((sum, roll) => sum + roll.rawD20, 0) / entries.length,
        nat20Count: entries.filter((roll) => roll.rawD20 === 20).length,
        nat1Count: entries.filter((roll) => roll.rawD20 === 1).length,
      })),
    };
  }

  async deleteBySession(sessionId: string): Promise<void> {
    const rolls = await this.rollRepository.list();
    await this.rollRepository.saveAll(rolls.filter((roll) => roll.sessionId !== sessionId));
  }
}

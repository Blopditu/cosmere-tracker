import { randomUUID } from 'node:crypto';
import {
  CampaignAnalyticsSummary,
  CreateSimulationInput,
  DiceRoll,
  Endeavor,
  EndeavorRun,
  EventLogEntry,
  Obstacle,
  SimulationDefinition,
  SimulationResult,
} from '@shared/domain';
import { HttpError } from '../lib/http';
import { SqliteJsonRepository } from '../lib/sqlite';
import { nowIso } from '../lib/time';

interface SimulationRepositories {
  simulations: SqliteJsonRepository<SimulationDefinition>;
  simulationResults: SqliteJsonRepository<SimulationResult>;
  endeavors: SqliteJsonRepository<Endeavor>;
  obstacles: SqliteJsonRepository<Obstacle>;
  events: SqliteJsonRepository<EventLogEntry>;
  diceRolls: SqliteJsonRepository<DiceRoll>;
  endeavorRuns: SqliteJsonRepository<EndeavorRun>;
}

function mulberry32(seed: number) {
  return function next(): number {
    let value = seed += 0x6d2b79f5;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function pickNumber(matrix: Record<string, unknown[]>, key: string, fallback: number): number {
  const value = matrix[key]?.[0];
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function applyTrackDelta(target: Record<string, number>, key: string | undefined, amount: number | undefined): void {
  if (!key || amount === undefined) {
    return;
  }
  target[key] = (target[key] ?? 0) + amount;
}

export class SimulationService {
  constructor(private readonly repositories: SimulationRepositories) {}

  async createDefinition(input: CreateSimulationInput): Promise<SimulationDefinition> {
    const now = nowIso();
    const definition: SimulationDefinition = {
      id: randomUUID(),
      createdAt: now,
      updatedAt: now,
      revision: 1,
      campaignId: input.campaignId,
      label: input.label,
      kind: input.kind,
      encounterSetupId: input.encounterSetupId,
      endeavorId: input.endeavorId,
      iterationCount: input.iterationCount,
      seed: input.seed,
      variableMatrix: input.variableMatrix,
      assumptions: input.assumptions,
    };
    this.repositories.simulations.upsert(definition);
    return definition;
  }

  async runSimulation(simulationDefinitionId: string): Promise<SimulationResult> {
    const definition = this.repositories.simulations.get(simulationDefinitionId);
    if (!definition) {
      throw new HttpError(404, 'Simulation definition not found.');
    }

    const generator = mulberry32(definition.seed ?? 1337);
    let result: SimulationResult;

    if (definition.kind === 'endeavor') {
      result = this.runEndeavorSimulation(definition, generator);
    } else if (definition.kind === 'resource-burn') {
      result = this.runResourceBurnSimulation(definition, generator);
    } else {
      result = this.runEncounterSimulation(definition, generator);
    }

    this.repositories.simulationResults.upsert(result);
    return result;
  }

  async listResults(simulationDefinitionId: string): Promise<SimulationResult[]> {
    return this.repositories.simulationResults
      .list()
      .filter((result) => result.simulationDefinitionId === simulationDefinitionId)
      .sort((left, right) => right.generatedAt.localeCompare(left.generatedAt));
  }

  async buildAnalytics(campaignId: string): Promise<CampaignAnalyticsSummary> {
    const diceRolls = this.repositories.diceRolls.list();
    const events = this.repositories.events.list();
    const simulationDefinitions = this.repositories.simulations.list().filter((definition) => definition.campaignId === campaignId);
    const simulationResults = this.repositories.simulationResults.list();
    const endeavorRuns = this.repositories.endeavorRuns.list();

    const diceByTag = new Map<string, { count: number; total: number }>();
    for (const roll of diceRolls) {
      const tags = roll.tags.length ? roll.tags : ['untagged'];
      for (const tag of tags) {
        const bucket = diceByTag.get(tag) ?? { count: 0, total: 0 };
        bucket.count += 1;
        bucket.total += roll.total;
        diceByTag.set(tag, bucket);
      }
    }

    const resourceBurnByKey = new Map<string, number>();
    const favorUsageById = new Map<string, number>();
    const conditionUsageById = new Map<string, number>();

    for (const event of events) {
      if (event.kind === 'resource.changed') {
        const resourceKey = String(event.payload['resourceKey'] ?? 'unknown');
        const delta = Number(event.payload['delta'] ?? 0);
        if (delta < 0) {
          resourceBurnByKey.set(resourceKey, (resourceBurnByKey.get(resourceKey) ?? 0) + Math.abs(delta));
        }
      }
      if (event.kind === 'favor.spent' || event.kind === 'favor.gained') {
        const favorId = String(event.payload['favorId'] ?? 'unknown');
        favorUsageById.set(favorId, (favorUsageById.get(favorId) ?? 0) + 1);
      }
      if (event.kind === 'condition.applied' || event.kind === 'condition.removed') {
        const conditionId = String(event.payload['conditionId'] ?? 'unknown');
        conditionUsageById.set(conditionId, (conditionUsageById.get(conditionId) ?? 0) + 1);
      }
    }

    const latestResultByDefinition = new Map<string, SimulationResult>();
    for (const result of simulationResults) {
      const existing = latestResultByDefinition.get(result.simulationDefinitionId);
      if (!existing || existing.generatedAt < result.generatedAt) {
        latestResultByDefinition.set(result.simulationDefinitionId, result);
      }
    }

    return {
      diceByTag: [...diceByTag.entries()]
        .map(([key, bucket]) => ({ key, count: bucket.count, average: Number((bucket.total / bucket.count).toFixed(2)) }))
        .sort((left, right) => right.count - left.count)
        .slice(0, 8),
      resourceBurnByKey: [...resourceBurnByKey.entries()]
        .map(([key, count]) => ({ key, count }))
        .sort((left, right) => right.count - left.count)
        .slice(0, 8),
      favorUsageById: [...favorUsageById.entries()]
        .map(([key, count]) => ({ key, count }))
        .sort((left, right) => right.count - left.count)
        .slice(0, 8),
      conditionUsageById: [...conditionUsageById.entries()]
        .map(([key, count]) => ({ key, count }))
        .sort((left, right) => right.count - left.count)
        .slice(0, 8),
      simulationComparisons: simulationDefinitions
        .map((definition) => {
          const latestResult = latestResultByDefinition.get(definition.id);
          const relatedRun = definition.endeavorId
            ? endeavorRuns.find((run) => run.endeavorId === definition.endeavorId)
            : undefined;
          const actualStatus: CampaignAnalyticsSummary['simulationComparisons'][number]['actualStatus'] =
            relatedRun?.status === 'success'
              ? 'success'
              : relatedRun?.status === 'failure'
                ? 'failure'
                : relatedRun
                  ? 'in-progress'
                  : undefined;
          return {
            simulationDefinitionId: definition.id,
            label: definition.label,
            expectedSuccessRate: latestResult?.successRate ?? 0,
            actualStatus,
          };
        })
        .slice(0, 8),
    };
  }

  private runEndeavorSimulation(definition: SimulationDefinition, nextRandom: () => number): SimulationResult {
    const endeavor = definition.endeavorId ? this.repositories.endeavors.get(definition.endeavorId) : undefined;
    if (!endeavor) {
      throw new HttpError(400, 'Endeavor simulations require a valid endeavor.');
    }
    const obstacles = this.repositories.obstacles
      .list()
      .filter((obstacle) => obstacle.endeavorId === endeavor.id)
      .sort((left, right) => (left.order ?? 0) - (right.order ?? 0));
    const successRate = pickNumber(definition.variableMatrix, 'successRate', 0.55);
    const mixedRate = pickNumber(definition.variableMatrix, 'mixedRate', 0.25);
    const progressKey = endeavor.tracks[0]?.key ?? 'progress';
    const failureTrack = endeavor.tracks.find((track) => track.failureAt !== undefined);
    const successTrack = endeavor.tracks.find((track) => track.successAt !== undefined) ?? endeavor.tracks[0];

    let successes = 0;
    let roundsTotal = 0;
    let progressTotal = 0;
    let failureTotal = 0;
    const outcomeDistribution = new Map<string, number>();

    for (let index = 0; index < definition.iterationCount; index += 1) {
      const trackValues = Object.fromEntries(endeavor.tracks.map((track) => [track.key, track.min]));
      let rounds = 0;
      let iterationSuccess = false;

      for (const obstacle of obstacles) {
        rounds += 1;
        const approach = obstacle.approaches[0];
        const roll = nextRandom();
        const outcome = roll < successRate ? 'success' : roll < successRate + mixedRate ? 'mixed' : 'failure';
        const effects =
          outcome === 'success' ? approach.onSuccess : outcome === 'mixed' ? approach.onMixed ?? approach.onFailure : approach.onFailure;
        for (const effect of effects) {
          if (effect.type === 'resource-delta') {
            applyTrackDelta(trackValues, effect.key, Number(effect.value ?? 0));
          }
        }
        if (failureTrack && trackValues[failureTrack.key] >= (failureTrack.failureAt ?? Number.MAX_SAFE_INTEGER)) {
          iterationSuccess = false;
          break;
        }
        if (successTrack && trackValues[successTrack.key] >= (successTrack.successAt ?? Number.MAX_SAFE_INTEGER)) {
          iterationSuccess = true;
          break;
        }
      }

      if (iterationSuccess) {
        successes += 1;
      }
      roundsTotal += rounds;
      progressTotal += trackValues[progressKey] ?? 0;
      if (failureTrack) {
        failureTotal += trackValues[failureTrack.key] ?? 0;
      }
      const outcomeKey = iterationSuccess ? 'success' : 'failure';
      outcomeDistribution.set(outcomeKey, (outcomeDistribution.get(outcomeKey) ?? 0) + 1);
    }

    return {
      id: randomUUID(),
      createdAt: nowIso(),
      updatedAt: nowIso(),
      revision: 1,
      simulationDefinitionId: definition.id,
      generatedAt: nowIso(),
      sampleSize: definition.iterationCount,
      successRate: Number((successes / definition.iterationCount).toFixed(4)),
      averageRounds: Number((roundsTotal / definition.iterationCount).toFixed(2)),
      averageResourceDelta: {
        [progressKey]: Number((progressTotal / definition.iterationCount).toFixed(2)),
        ...(failureTrack ? { [failureTrack.key]: Number((failureTotal / definition.iterationCount).toFixed(2)) } : {}),
      },
      distributions: {
        outcome: [...outcomeDistribution.entries()].map(([bucket, count]) => ({ bucket, count })),
      },
      notes: `Heuristic endeavor simulation for ${endeavor.title}`,
    };
  }

  private runResourceBurnSimulation(definition: SimulationDefinition, nextRandom: () => number): SimulationResult {
    const resourceKey = String(definition.variableMatrix['resourceKey']?.[0] ?? 'focus');
    const averageSpend = pickNumber(definition.variableMatrix, 'averageSpend', 2);
    const variance = pickNumber(definition.variableMatrix, 'variance', 1);
    const steps = pickNumber(definition.variableMatrix, 'steps', 4);
    let totalSpend = 0;
    const buckets = new Map<string, number>();

    for (let iteration = 0; iteration < definition.iterationCount; iteration += 1) {
      let spent = 0;
      for (let step = 0; step < steps; step += 1) {
        spent += Math.max(0, Math.round(averageSpend + (nextRandom() - 0.5) * variance * 2));
      }
      totalSpend += spent;
      const bucket = spent <= averageSpend * steps ? 'controlled' : 'spiky';
      buckets.set(bucket, (buckets.get(bucket) ?? 0) + 1);
    }

    return {
      id: randomUUID(),
      createdAt: nowIso(),
      updatedAt: nowIso(),
      revision: 1,
      simulationDefinitionId: definition.id,
      generatedAt: nowIso(),
      sampleSize: definition.iterationCount,
      successRate: 1,
      averageResourceDelta: { [resourceKey]: Number((-totalSpend / definition.iterationCount).toFixed(2)) },
      distributions: {
        spendPattern: [...buckets.entries()].map(([bucket, count]) => ({ bucket, count })),
      },
      notes: 'Generic resource burn simulation.',
    };
  }

  private runEncounterSimulation(definition: SimulationDefinition, nextRandom: () => number): SimulationResult {
    const threat = pickNumber(definition.variableMatrix, 'threatLevel', 0.5);
    const advantage = pickNumber(definition.variableMatrix, 'pcAdvantage', 0.5);
    let successes = 0;
    let rounds = 0;
    const distribution = new Map<string, number>();

    for (let iteration = 0; iteration < definition.iterationCount; iteration += 1) {
      const roll = nextRandom();
      const threshold = 0.45 + advantage * 0.35 - threat * 0.25;
      const success = roll <= threshold;
      if (success) {
        successes += 1;
      }
      rounds += success ? 3 : 5;
      distribution.set(success ? 'victory' : 'loss', (distribution.get(success ? 'victory' : 'loss') ?? 0) + 1);
    }

    return {
      id: randomUUID(),
      createdAt: nowIso(),
      updatedAt: nowIso(),
      revision: 1,
      simulationDefinitionId: definition.id,
      generatedAt: nowIso(),
      sampleSize: definition.iterationCount,
      successRate: Number((successes / definition.iterationCount).toFixed(4)),
      averageRounds: Number((rounds / definition.iterationCount).toFixed(2)),
      distributions: {
        outcome: [...distribution.entries()].map(([bucket, count]) => ({ bucket, count })),
      },
      notes: 'Heuristic encounter simulation.',
    };
  }
}

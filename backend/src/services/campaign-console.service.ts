import { randomUUID } from 'node:crypto';
import {
  ActionDefinition,
  AppliedCondition,
  Campaign,
  CampaignConsoleData,
  CampaignAnalyticsSummary,
  Chapter,
  ChapterState,
  Condition,
  ConditionMutationInput,
  CreateSimulationInput,
  DiceRoll,
  DiceRollInput,
  EndeavorApproachResolutionInput,
  EndeavorRun,
  EndeavorRunAdjustmentInput,
  EntityPointer,
  EventLogEntry,
  Favor,
  FavorAdjustmentInput,
  Hook,
  Location,
  NPC,
  NPCAppearance,
  Obstacle,
  Outcome,
  PC,
  QuickNoteInput,
  ResourceDefinition,
  ResourceAdjustmentInput,
  Reward,
  RuleEvaluationRequest,
  RuleEvaluationResult,
  RuleReference,
  SkillDefinition,
  SceneNode,
  SceneState,
  SceneStateMutationInput,
  SessionRun,
  SimulationDefinition,
  SimulationResult,
  StatisticDefinition,
  StatisticTableDefinition,
  buildCampaignConsoleData,
  evaluateStateExpression,
} from '@shared/domain';
import { HttpError } from '../lib/http';
import { SqliteJsonRepository } from '../lib/sqlite';
import { nowIso } from '../lib/time';
import { buildCampaignSeed } from './campaign-seed';
import { RulesEngineService } from './rules-engine.service';
import { SimulationService } from './simulation.service';

interface CampaignConsoleRepositories {
  campaigns: SqliteJsonRepository<Campaign>;
  chapters: SqliteJsonRepository<Chapter>;
  chapterStates: SqliteJsonRepository<ChapterState>;
  sessionRuns: SqliteJsonRepository<SessionRun>;
  sceneNodes: SqliteJsonRepository<SceneNode>;
  sceneEdges: SqliteJsonRepository<import('@shared/domain').SceneEdge>;
  sceneStates: SqliteJsonRepository<SceneState>;
  hooks: SqliteJsonRepository<Hook>;
  conditions: SqliteJsonRepository<Condition>;
  outcomes: SqliteJsonRepository<Outcome>;
  endeavors: SqliteJsonRepository<import('@shared/domain').Endeavor>;
  obstacles: SqliteJsonRepository<Obstacle>;
  encounters: SqliteJsonRepository<import('@shared/domain').EncounterSetup>;
  npcs: SqliteJsonRepository<NPC>;
  npcAppearances: SqliteJsonRepository<NPCAppearance>;
  pcs: SqliteJsonRepository<PC>;
  locations: SqliteJsonRepository<Location>;
  rules: SqliteJsonRepository<RuleReference>;
  resourceDefinitions: SqliteJsonRepository<ResourceDefinition>;
  statisticDefinitions: SqliteJsonRepository<StatisticDefinition>;
  statisticTableDefinitions: SqliteJsonRepository<StatisticTableDefinition>;
  skillDefinitions: SqliteJsonRepository<SkillDefinition>;
  actionDefinitions: SqliteJsonRepository<ActionDefinition>;
  resolutionHooks: SqliteJsonRepository<import('@shared/domain').ResolutionHook>;
  rewards: SqliteJsonRepository<Reward>;
  favors: SqliteJsonRepository<Favor>;
  endeavorRuns: SqliteJsonRepository<EndeavorRun>;
  simulations: SqliteJsonRepository<SimulationDefinition>;
  simulationResults: SqliteJsonRepository<SimulationResult>;
  events: SqliteJsonRepository<EventLogEntry>;
  diceRolls: SqliteJsonRepository<DiceRoll>;
}

interface CampaignContext {
  campaign: Campaign;
  chapter: Chapter;
  chapterState: ChapterState;
  sessionRun: SessionRun;
  sceneNodes: SceneNode[];
  sceneStates: SceneState[];
  npcs: NPC[];
  npcAppearances: NPCAppearance[];
  pcs: PC[];
  locations: Location[];
  rules: RuleReference[];
  resourceDefinitions: ResourceDefinition[];
  statisticDefinitions: StatisticDefinition[];
  statisticTableDefinitions: StatisticTableDefinition[];
  skillDefinitions: SkillDefinition[];
  actionDefinitions: ActionDefinition[];
  resolutionHooks: import('@shared/domain').ResolutionHook[];
  hooks: Hook[];
  conditions: Condition[];
  outcomes: Outcome[];
  favors: Favor[];
  rewards: Reward[];
  endeavors: import('@shared/domain').Endeavor[];
  obstacles: Obstacle[];
  encounters: import('@shared/domain').EncounterSetup[];
  endeavorRuns: EndeavorRun[];
  simulations: SimulationDefinition[];
  simulationResults: SimulationResult[];
  events: EventLogEntry[];
  diceRolls: DiceRoll[];
}

function uniquePush(items: string[], value: string): string[] {
  if (!items.includes(value)) {
    items.push(value);
  }
  return items;
}

function removeValue(items: string[], value: string): string[] {
  return items.filter((item) => item !== value);
}

function entityKey(entity: EntityPointer | { kind: 'pc' | 'npc'; id: string }): string {
  return `${entity.kind}:${entity.id}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export class CampaignConsoleService {
  private seedChecked = false;

  constructor(
    private readonly repositories: CampaignConsoleRepositories,
    private readonly rulesEngine: RulesEngineService,
    private readonly simulationService: SimulationService,
  ) {}

  async listCampaigns(): Promise<Campaign[]> {
    this.ensureSeedData();
    return this.repositories.campaigns.list().sort((left, right) => left.title.localeCompare(right.title));
  }

  async getConsole(campaignId: string): Promise<CampaignConsoleData> {
    this.ensureSeedData();
    const context = this.loadContext(campaignId);
    const resourceTargets = this.buildResourceTargets(context);
    const analytics = await this.simulationService.buildAnalytics(context.campaign.id);
    const activeEndeavorRun = this.findActiveEndeavorRun(context);
    const ruleAdvisories = this.rulesEngine.buildAmbientAdvisories({
      ruleMode: context.sessionRun.ruleMode,
      chapterState: context.chapterState,
      sessionRun: context.sessionRun,
      sceneNodes: context.sceneNodes,
      sceneStates: context.sceneStates,
      actionDefinitions: context.actionDefinitions,
      resolutionHooks: context.resolutionHooks,
      resourceTargets,
    });

    return buildCampaignConsoleData({
      campaign: context.campaign,
      chapter: context.chapter,
      chapterState: context.chapterState,
      sceneNodes: context.sceneNodes,
      sceneEdges: this.repositories.sceneEdges.list().filter((edge) => edge.chapterId === context.chapter.id),
      sceneStates: context.sceneStates,
      npcs: context.npcs,
      npcAppearances: context.npcAppearances,
      locations: context.locations,
      rules: context.rules,
      conditions: context.conditions,
      hooks: context.hooks,
      outcomes: context.outcomes,
      favors: context.favors,
      rewards: context.rewards,
      endeavors: context.endeavors,
      obstacles: context.obstacles,
      encounters: context.encounters,
      resourceDefinitions: context.resourceDefinitions,
      statisticDefinitions: context.statisticDefinitions,
      statisticTableDefinitions: context.statisticTableDefinitions,
      skillDefinitions: context.skillDefinitions,
      actionDefinitions: context.actionDefinitions,
      resolutionHooks: context.resolutionHooks,
      activeEndeavorRun,
      ruleAdvisories,
      analytics,
      simulationResults: context.simulationResults,
      sessionRun: context.sessionRun,
      recentEvents: [...context.events].sort((left, right) => right.occurredAt.localeCompare(left.occurredAt)).slice(0, 10),
      recentDiceRolls: [...context.diceRolls].sort((left, right) => right.createdAt.localeCompare(left.createdAt)).slice(0, 8),
      resourceTargets,
    });
  }

  async updateSceneState(campaignId: string, input: SceneStateMutationInput): Promise<CampaignConsoleData> {
    this.ensureSeedData();
    const context = this.loadContext(campaignId);
    const now = nowIso();
    const sceneNode = context.sceneNodes.find((scene) => scene.id === input.sceneNodeId);
    if (!sceneNode) {
      throw new HttpError(404, 'Scene not found.');
    }

    const sceneState = this.getOrCreateSceneState(context, sceneNode.id);
    const previousStatus = sceneState.status;
    if (previousStatus === input.status) {
      return this.getConsole(campaignId);
    }

    sceneState.status = input.status;
    sceneState.updatedAt = now;
    sceneState.revision += 1;

    if (input.status === 'active') {
      sceneState.activatedAt ??= now;
      context.chapterState.activeSceneId = sceneNode.id;
      context.sessionRun.activeSceneId = sceneNode.id;
      uniquePush(context.chapterState.unlockedSceneIds, sceneNode.id);
    }

    if (input.status === 'available') {
      uniquePush(context.chapterState.unlockedSceneIds, sceneNode.id);
    }

    if (input.status === 'completed') {
      sceneState.completedAt = now;
      context.chapterState.completedSceneIds = uniquePush(
        removeValue(context.chapterState.completedSceneIds, sceneNode.id),
        sceneNode.id,
      );
      context.chapterState.skippedSceneIds = removeValue(context.chapterState.skippedSceneIds, sceneNode.id);
      if (context.chapterState.activeSceneId === sceneNode.id) {
        context.chapterState.activeSceneId = undefined;
        context.sessionRun.activeSceneId = undefined;
      }
      this.applyCompletionEffects(context, sceneNode, previousStatus, now);
    }

    if (input.status === 'skipped') {
      sceneState.skippedAt = now;
      context.chapterState.skippedSceneIds = uniquePush(removeValue(context.chapterState.skippedSceneIds, sceneNode.id), sceneNode.id);
      context.chapterState.completedSceneIds = removeValue(context.chapterState.completedSceneIds, sceneNode.id);
      if (sceneNode.id === 'scene-monastery-infiltration' && !context.chapterState.flags['monasteryAlarmed']) {
        context.chapterState.flags['monasteryAlarmed'] = true;
        context.chapterState.escalation += 1;
        this.appendEvent(context, {
          kind: 'chapter.flag.changed',
          payload: { key: 'monasteryAlarmed', next: true },
          sceneNodeId: sceneNode.id,
        }, now);
      }
      if (context.chapterState.activeSceneId === sceneNode.id) {
        context.chapterState.activeSceneId = undefined;
        context.sessionRun.activeSceneId = undefined;
      }
    }

    this.repositories.sceneStates.upsert(sceneState);
    this.repositories.chapterStates.upsert({
      ...context.chapterState,
      updatedAt: now,
      revision: context.chapterState.revision + 1,
    });
    this.repositories.sessionRuns.upsert({
      ...context.sessionRun,
      updatedAt: now,
      revision: context.sessionRun.revision + 1,
    });

    this.appendEvent(
      context,
      {
        kind:
          input.status === 'active'
            ? 'scene.activated'
            : input.status === 'completed'
              ? 'scene.completed'
              : input.status === 'skipped'
                ? 'scene.skipped'
                : 'scene.unlocked',
        payload: { status: input.status },
        sceneNodeId: sceneNode.id,
        actor: { kind: 'scene', id: sceneNode.id },
      },
      now,
    );

    this.refreshUnlocks(context, now);
    return this.getConsole(campaignId);
  }

  async addQuickNote(campaignId: string, input: QuickNoteInput): Promise<CampaignConsoleData> {
    this.ensureSeedData();
    const context = this.loadContext(campaignId);
    const now = nowIso();
    const note = {
      id: randomUUID(),
      kind: 'note' as const,
      text: input.text.trim(),
    };

    if (!note.text) {
      throw new HttpError(400, 'Note text is required.');
    }

    context.sessionRun.quickNotes = [note, ...context.sessionRun.quickNotes];
    this.repositories.sessionRuns.upsert({
      ...context.sessionRun,
      updatedAt: now,
      revision: context.sessionRun.revision + 1,
    });

    if (input.sceneNodeId) {
      const sceneState = this.getOrCreateSceneState(context, input.sceneNodeId);
      sceneState.localNotes = [note.text, ...sceneState.localNotes];
      sceneState.updatedAt = now;
      sceneState.revision += 1;
      this.repositories.sceneStates.upsert(sceneState);
    }

    this.appendEvent(
      context,
      {
        kind: 'note.captured',
        payload: { text: note.text },
        sceneNodeId: input.sceneNodeId,
      },
      now,
    );

    return this.getConsole(campaignId);
  }

  async adjustFavor(campaignId: string, input: FavorAdjustmentInput): Promise<CampaignConsoleData> {
    this.ensureSeedData();
    const context = this.loadContext(campaignId);
    const now = nowIso();
    const favor = context.favors.find((entry) => entry.id === input.favorId);
    if (!favor) {
      throw new HttpError(404, 'Favor not found.');
    }

    const current = context.chapterState.favorUsesById[input.favorId] ?? 0;
    const max = favor.maxUses ?? Number.MAX_SAFE_INTEGER;
    const next = Math.max(0, Math.min(max, current + input.delta));
    context.chapterState.favorUsesById[input.favorId] = next;
    this.repositories.chapterStates.upsert({
      ...context.chapterState,
      updatedAt: now,
      revision: context.chapterState.revision + 1,
    });

    this.appendEvent(
      context,
      {
        kind: input.delta > 0 ? 'favor.spent' : 'favor.gained',
        payload: { favorId: input.favorId, delta: input.delta, next, note: input.note ?? null },
      },
      now,
    );

    return this.getConsole(campaignId);
  }

  async adjustResource(campaignId: string, input: ResourceAdjustmentInput): Promise<CampaignConsoleData> {
    this.ensureSeedData();
    const context = this.loadContext(campaignId);
    this.assertEntityExists(context, input.entity);

    this.appendEvent(
      context,
      {
        kind: 'resource.changed',
        sceneNodeId: context.chapterState.activeSceneId,
        actor: input.entity,
        payload: {
          entityKind: input.entity.kind,
          entityId: input.entity.id,
          resourceKey: input.resourceKey,
          delta: input.delta,
          note: input.note ?? null,
        },
      },
      nowIso(),
    );

    return this.getConsole(campaignId);
  }

  async mutateCondition(campaignId: string, input: ConditionMutationInput): Promise<CampaignConsoleData> {
    this.ensureSeedData();
    const context = this.loadContext(campaignId);
    this.assertEntityExists(context, input.entity);
    if (!context.conditions.find((condition) => condition.id === input.conditionId)) {
      throw new HttpError(404, 'Condition not found.');
    }

    this.appendEvent(
      context,
      {
        kind: input.operation === 'add' ? 'condition.applied' : 'condition.removed',
        sceneNodeId: context.chapterState.activeSceneId,
        actor: input.entity,
        payload: {
          entityKind: input.entity.kind,
          entityId: input.entity.id,
          conditionId: input.conditionId,
          note: input.note ?? null,
        },
      },
      nowIso(),
    );

    return this.getConsole(campaignId);
  }

  async logDiceRoll(campaignId: string, input: DiceRollInput): Promise<CampaignConsoleData> {
    this.ensureSeedData();
    const context = this.loadContext(campaignId);
    const now = nowIso();
    const roll: DiceRoll = {
      id: randomUUID(),
      sessionRunId: context.sessionRun.id,
      sceneNodeId: input.sceneNodeId,
      actor: input.actor,
      target: input.target,
      formula: input.formula,
      rawDice: input.rawDice,
      modifier: input.modifier,
      total: input.total,
      outcome: input.outcome,
      tags: input.tags,
      note: input.note,
      createdAt: now,
      updatedAt: now,
      revision: 1,
    };

    this.repositories.diceRolls.upsert(roll);
    this.appendEvent(
      context,
      {
        kind: 'dice.rolled',
        sceneNodeId: input.sceneNodeId,
        actor: input.actor,
        target: input.target,
        payload: {
          formula: input.formula,
          rawDice: input.rawDice,
          modifier: input.modifier,
          total: input.total,
          outcome: input.outcome ?? null,
        },
      },
      now,
    );

    return this.getConsole(campaignId);
  }

  async evaluateRules(input: RuleEvaluationRequest): Promise<RuleEvaluationResult> {
    this.ensureSeedData();
    const context = this.loadContext(input.campaignId);
    return this.rulesEngine.evaluate(this.buildRuleContext(context), input);
  }

  async startEndeavorRun(campaignId: string, endeavorId: string): Promise<CampaignConsoleData> {
    this.ensureSeedData();
    const context = this.loadContext(campaignId);
    const endeavor = context.endeavors.find((entry) => entry.id === endeavorId);
    if (!endeavor) {
      throw new HttpError(404, 'Endeavor not found.');
    }

    const existing = context.endeavorRuns.find((run) => run.endeavorId === endeavorId && run.status === 'active');
    if (existing) {
      return this.getConsole(campaignId);
    }

    const timestamp = nowIso();
    const sortedObstacleIds = context.obstacles
      .filter((obstacle) => obstacle.endeavorId === endeavorId)
      .sort((left, right) => (left.order ?? 0) - (right.order ?? 0))
      .map((obstacle) => obstacle.id);
    const firstObstacleId = sortedObstacleIds[0];
    const run: EndeavorRun = {
      id: `endeavor-run-${endeavorId}-${context.sessionRun.id}`,
      createdAt: timestamp,
      updatedAt: timestamp,
      revision: 1,
      sessionRunId: context.sessionRun.id,
      chapterId: context.chapter.id,
      sceneNodeId: endeavor.sceneNodeId,
      endeavorId,
      status: 'active',
      trackValues: Object.fromEntries(endeavor.tracks.map((track) => [track.key, Number(context.chapterState.custom[track.key] ?? track.min)])),
      obstacleStates: sortedObstacleIds.map((obstacleId) => ({
        obstacleId,
        status: endeavor.structure === 'unordered' ? 'available' : obstacleId === firstObstacleId ? 'available' : 'locked',
        attempts: 0,
      })),
      selectedOutcomeIds: [],
      eventIds: [],
    };
    context.endeavorRuns.push(run);
    this.repositories.endeavorRuns.upsert(run);
    this.appendEvent(
      context,
      {
        kind: 'endeavor.started',
        sceneNodeId: endeavor.sceneNodeId,
        actor: { kind: 'scene', id: endeavor.sceneNodeId ?? endeavorId },
        payload: { endeavorId },
      },
      timestamp,
    );

    return this.getConsole(campaignId);
  }

  async resolveEndeavorApproach(
    campaignId: string,
    runId: string,
    input: EndeavorApproachResolutionInput,
  ): Promise<CampaignConsoleData> {
    this.ensureSeedData();
    const context = this.loadContext(campaignId);
    const run = context.endeavorRuns.find((entry) => entry.id === runId);
    if (!run) {
      throw new HttpError(404, 'Endeavor run not found.');
    }
    const endeavor = context.endeavors.find((entry) => entry.id === run.endeavorId);
    if (!endeavor) {
      throw new HttpError(404, 'Endeavor not found.');
    }
    const obstacle = context.obstacles.find((entry) => entry.id === input.obstacleId && entry.endeavorId === endeavor.id);
    const obstacleState = run.obstacleStates.find((entry) => entry.obstacleId === input.obstacleId);
    if (!obstacle || !obstacleState) {
      throw new HttpError(404, 'Obstacle not found.');
    }
    if (obstacleState.status !== 'available') {
      throw new HttpError(400, 'Obstacle is not currently available.');
    }
    const approach = obstacle.approaches.find((entry) => entry.id === input.approachId);
    if (!approach) {
      throw new HttpError(404, 'Approach not found.');
    }

    const timestamp = nowIso();
    const effects =
      input.resolution === 'success'
        ? approach.onSuccess
        : input.resolution === 'mixed'
          ? approach.onMixed ?? approach.onFailure
          : approach.onFailure;
    this.applyEndeavorEffects(context, run, effects, input.actor, timestamp);
    obstacleState.status = 'completed';
    obstacleState.attempts += 1;
    obstacleState.lastApproachId = input.approachId;
    obstacleState.lastResolution = input.resolution;
    run.updatedAt = timestamp;
    run.revision += 1;
    this.unlockNextObstacles(endeavor, run);
    this.updateEndeavorOutcomeStatus(endeavor, run);
    this.repositories.endeavorRuns.upsert(run);
    this.repositories.chapterStates.upsert({
      ...context.chapterState,
      updatedAt: timestamp,
      revision: context.chapterState.revision + 1,
    });
    this.appendEvent(
      context,
      {
        kind: 'endeavor.approach.resolved',
        sceneNodeId: run.sceneNodeId,
        actor: input.actor,
        payload: {
          endeavorId: run.endeavorId,
          obstacleId: input.obstacleId,
          approachId: input.approachId,
          resolution: input.resolution,
        },
      },
      timestamp,
    );
    return this.getConsole(campaignId);
  }

  async adjustEndeavorRun(campaignId: string, runId: string, input: EndeavorRunAdjustmentInput): Promise<CampaignConsoleData> {
    this.ensureSeedData();
    const context = this.loadContext(campaignId);
    const run = context.endeavorRuns.find((entry) => entry.id === runId);
    if (!run) {
      throw new HttpError(404, 'Endeavor run not found.');
    }

    const timestamp = nowIso();
    for (const [trackKey, delta] of Object.entries(input.trackDeltas ?? {})) {
      run.trackValues[trackKey] = (run.trackValues[trackKey] ?? 0) + delta;
      context.chapterState.custom[trackKey] = run.trackValues[trackKey];
    }
    if (input.nextStatus) {
      run.status = input.nextStatus;
    }
    run.updatedAt = timestamp;
    run.revision += 1;
    this.repositories.endeavorRuns.upsert(run);
    this.repositories.chapterStates.upsert({
      ...context.chapterState,
      updatedAt: timestamp,
      revision: context.chapterState.revision + 1,
    });
    return this.getConsole(campaignId);
  }

  async createSimulation(input: CreateSimulationInput): Promise<SimulationDefinition> {
    this.ensureSeedData();
    return this.simulationService.createDefinition(input);
  }

  async runSimulation(simulationDefinitionId: string): Promise<SimulationResult> {
    this.ensureSeedData();
    return this.simulationService.runSimulation(simulationDefinitionId);
  }

  async listSimulationResults(simulationDefinitionId: string): Promise<SimulationResult[]> {
    this.ensureSeedData();
    return this.simulationService.listResults(simulationDefinitionId);
  }

  async getAnalytics(campaignId: string): Promise<CampaignAnalyticsSummary> {
    this.ensureSeedData();
    return this.simulationService.buildAnalytics(campaignId);
  }

  private ensureSeedData(): void {
    if (this.seedChecked) {
      return;
    }
    if (this.repositories.campaigns.count() > 0) {
      this.seedChecked = true;
      return;
    }

    const seed = buildCampaignSeed();
    this.repositories.campaigns.saveAll(seed.campaigns);
    this.repositories.chapters.saveAll(seed.chapters);
    this.repositories.chapterStates.saveAll(seed.chapterStates);
    this.repositories.sessionRuns.saveAll(seed.sessionRuns);
    this.repositories.sceneNodes.saveAll(seed.sceneNodes);
    this.repositories.sceneEdges.saveAll(seed.sceneEdges);
    this.repositories.sceneStates.saveAll(seed.sceneStates);
    this.repositories.hooks.saveAll(seed.hooks);
    this.repositories.conditions.saveAll(seed.conditions);
    this.repositories.outcomes.saveAll(seed.outcomes);
    this.repositories.endeavors.saveAll(seed.endeavors);
    this.repositories.obstacles.saveAll(seed.obstacles);
    this.repositories.encounters.saveAll(seed.encounters);
    this.repositories.npcs.saveAll(seed.npcs);
    this.repositories.npcAppearances.saveAll(seed.npcAppearances);
    this.repositories.pcs.saveAll(seed.pcs);
    this.repositories.locations.saveAll(seed.locations);
    this.repositories.rules.saveAll(seed.rules);
    this.repositories.resourceDefinitions.saveAll(seed.resourceDefinitions);
    this.repositories.statisticDefinitions.saveAll([]);
    this.repositories.statisticTableDefinitions.saveAll([]);
    this.repositories.skillDefinitions.saveAll([]);
    this.repositories.actionDefinitions.saveAll(seed.actionDefinitions);
    this.repositories.resolutionHooks.saveAll(seed.resolutionHooks);
    this.repositories.rewards.saveAll(seed.rewards);
    this.repositories.favors.saveAll(seed.favors);
    this.repositories.endeavorRuns.saveAll(seed.endeavorRuns);
    this.repositories.simulations.saveAll(seed.simulations);
    this.repositories.simulationResults.saveAll(seed.simulationResults);
    this.repositories.events.saveAll(seed.events);
    this.repositories.diceRolls.saveAll(seed.diceRolls);
    this.seedChecked = true;
  }

  private loadContext(campaignId: string): CampaignContext {
    const campaign = this.repositories.campaigns.get(campaignId) ?? this.repositories.campaigns.list()[0];
    if (!campaign) {
      throw new HttpError(404, 'Campaign not found.');
    }

    const activeChapterId = campaign.currentChapterId ?? campaign.chapterOrder[0];
    const chapter = this.repositories.chapters.get(activeChapterId);
    if (!chapter) {
      throw new HttpError(404, 'Active chapter not found.');
    }

    const sessionRun = campaign.activeSessionRunId
      ? this.repositories.sessionRuns.get(campaign.activeSessionRunId)
      : this.repositories.sessionRuns.list().find((entry) => entry.campaignId === campaign.id);
    if (!sessionRun) {
      throw new HttpError(404, 'Session run not found.');
    }

    const chapterState = this.repositories.chapterStates.list().find(
      (entry) => entry.sessionRunId === sessionRun.id && entry.chapterId === chapter.id,
    );
    if (!chapterState) {
      throw new HttpError(404, 'Chapter state not found.');
    }

    return {
      campaign,
      chapter,
      chapterState,
      sessionRun,
      sceneNodes: this.repositories.sceneNodes.list().filter((scene) => scene.chapterId === chapter.id),
      sceneStates: this.repositories.sceneStates.list().filter((state) => state.sessionRunId === sessionRun.id && state.chapterId === chapter.id),
      npcs: this.repositories.npcs.list().filter((npc) => npc.campaignId === campaign.id),
      npcAppearances: this.repositories.npcAppearances.list().filter((appearance) => appearance.chapterId === chapter.id),
      pcs: this.repositories.pcs.list().filter((pc) => pc.campaignId === campaign.id),
      locations: this.repositories.locations.list().filter((location) => location.campaignId === campaign.id),
      rules: this.repositories.rules.list(),
      resourceDefinitions: this.repositories.resourceDefinitions.list(),
      statisticDefinitions: this.repositories.statisticDefinitions.list(),
      statisticTableDefinitions: this.repositories.statisticTableDefinitions.list(),
      skillDefinitions: this.repositories.skillDefinitions.list(),
      actionDefinitions: this.repositories.actionDefinitions.list(),
      resolutionHooks: this.repositories.resolutionHooks.list(),
      hooks: this.repositories.hooks.list().filter((hook) => hook.chapterId === chapter.id),
      conditions: this.repositories.conditions.list(),
      outcomes: this.repositories.outcomes.list().filter((outcome) => outcome.chapterId === chapter.id),
      favors: this.repositories.favors.list().filter((favor) => favor.chapterId === chapter.id),
      rewards: this.repositories.rewards.list().filter((reward) => reward.chapterId === chapter.id),
      endeavors: this.repositories.endeavors.list().filter((endeavor) => endeavor.chapterId === chapter.id),
      obstacles: this.repositories.obstacles.list(),
      encounters: this.repositories.encounters.list().filter((encounter) => encounter.chapterId === chapter.id),
      endeavorRuns: this.repositories.endeavorRuns.list().filter((run) => run.sessionRunId === sessionRun.id && run.chapterId === chapter.id),
      simulations: this.repositories.simulations.list().filter((definition) => definition.campaignId === campaign.id),
      simulationResults: this.repositories.simulationResults.list().filter((result) =>
        this.repositories.simulations.list().some((definition) => definition.id === result.simulationDefinitionId && definition.campaignId === campaign.id),
      ),
      events: this.repositories.events.list().filter((event) => event.sessionRunId === sessionRun.id),
      diceRolls: this.repositories.diceRolls.list().filter((roll) => roll.sessionRunId === sessionRun.id),
    };
  }

  private getOrCreateSceneState(context: CampaignContext, sceneNodeId: string): SceneState {
    const existing = context.sceneStates.find((state) => state.sceneNodeId === sceneNodeId);
    if (existing) {
      return existing;
    }
    const scene = context.sceneNodes.find((entry) => entry.id === sceneNodeId);
    if (!scene) {
      throw new HttpError(404, 'Scene not found.');
    }
    const sceneState: SceneState = {
      id: `scene-state-${sceneNodeId}-${context.sessionRun.id}`,
      sessionRunId: context.sessionRun.id,
      chapterId: context.chapter.id,
      sceneNodeId,
      status: scene.unlockWhen.length ? 'locked' : 'available',
      createdAt: nowIso(),
      updatedAt: nowIso(),
      revision: 1,
      localNotes: [],
      chosenOutcomeIds: [],
      runtimeFlags: {},
      custom: {},
    };
    context.sceneStates.push(sceneState);
    this.repositories.sceneStates.upsert(sceneState);
    return sceneState;
  }

  private refreshUnlocks(context: CampaignContext, timestamp: string): void {
    let changed = true;
    while (changed) {
      changed = false;
      const statuses = Object.fromEntries(context.sceneNodes.map((scene) => [scene.id, this.getOrCreateSceneState(context, scene.id).status]));
      for (const scene of context.sceneNodes) {
        const state = this.getOrCreateSceneState(context, scene.id);
        if (state.status !== 'locked') {
          continue;
        }
        const shouldUnlock =
          scene.unlockWhen.length === 0 ||
          scene.unlockWhen.some((expression) => evaluateStateExpression(expression, statuses, context.chapterState));
        if (!shouldUnlock) {
          continue;
        }
        state.status = 'available';
        state.updatedAt = timestamp;
        state.revision += 1;
        uniquePush(context.chapterState.unlockedSceneIds, scene.id);
        this.repositories.sceneStates.upsert(state);
        this.appendEvent(
          context,
          {
            kind: 'scene.unlocked',
            sceneNodeId: scene.id,
            actor: { kind: 'scene', id: scene.id },
            payload: { status: 'available' },
          },
          timestamp,
        );
        changed = true;
      }
    }

    this.repositories.chapterStates.upsert({
      ...context.chapterState,
      updatedAt: timestamp,
      revision: context.chapterState.revision + 1,
    });
  }

  private applyCompletionEffects(context: CampaignContext, sceneNode: SceneNode, previousStatus: SceneState['status'], timestamp: string): void {
    if (previousStatus === 'completed') {
      return;
    }

    if (sceneNode.tags.includes('search')) {
      context.chapterState.counters['warcampIntel'] = (context.chapterState.counters['warcampIntel'] ?? 0) + 1;
      this.appendEvent(
        context,
        {
          kind: 'chapter.counter.changed',
          sceneNodeId: sceneNode.id,
          payload: { key: 'warcampIntel', delta: 1, next: context.chapterState.counters['warcampIntel'] },
        },
        timestamp,
      );
    }

    if (sceneNode.id === 'scene-contact-meeting') {
      context.chapterState.flags['contactMet'] = true;
      context.chapterState.flags['contactUnlocked'] = true;
      context.chapterState.counters['contactTrust'] = (context.chapterState.counters['contactTrust'] ?? 0) + 1;
      this.appendEvent(
        context,
        {
          kind: 'chapter.flag.changed',
          sceneNodeId: sceneNode.id,
          payload: { key: 'contactMet', next: true },
        },
        timestamp,
      );
    }

    if (sceneNode.id === 'scene-monastery-infiltration') {
      context.chapterState.flags['monasteryInside'] = true;
      uniquePush(context.chapterState.rewardIds, 'reward-monastery-map');
      this.appendEvent(
        context,
        {
          kind: 'reward.granted',
          sceneNodeId: sceneNode.id,
          payload: { rewardId: 'reward-monastery-map' },
        },
        timestamp,
      );
    }

    if (sceneNode.id === 'scene-escape-report') {
      uniquePush(context.chapterState.rewardIds, 'reward-cloister-ledger');
      this.appendEvent(
        context,
        {
          kind: 'reward.granted',
          sceneNodeId: sceneNode.id,
          payload: { rewardId: 'reward-cloister-ledger' },
        },
        timestamp,
      );
    }
  }

  private appendEvent(
    context: CampaignContext,
    input: Pick<EventLogEntry, 'kind' | 'payload' | 'sceneNodeId' | 'actor' | 'target'>,
    occurredAt: string,
  ): void {
    const event: EventLogEntry = {
      id: randomUUID(),
      sessionRunId: context.sessionRun.id,
      occurredAt,
      kind: input.kind,
      chapterId: context.chapter.id,
      sceneNodeId: input.sceneNodeId,
      actor: input.actor,
      target: input.target,
      payload: input.payload,
    };
    context.events.push(event);
    this.repositories.events.upsert(event);
  }

  private buildRuleContext(context: CampaignContext) {
    return {
      ruleMode: context.sessionRun.ruleMode,
      chapterState: context.chapterState,
      sessionRun: context.sessionRun,
      sceneNodes: context.sceneNodes,
      sceneStates: context.sceneStates,
      actionDefinitions: context.actionDefinitions,
      resolutionHooks: context.resolutionHooks,
      resourceTargets: this.buildResourceTargets(context),
    };
  }

  private findActiveEndeavorRun(context: CampaignContext): EndeavorRun | undefined {
    return context.endeavorRuns.find(
      (run) =>
        run.status === 'active' &&
        (!context.chapterState.activeSceneId || !run.sceneNodeId || run.sceneNodeId === context.chapterState.activeSceneId),
    ) ?? context.endeavorRuns.find((run) => run.status === 'active');
  }

  private unlockNextObstacles(endeavor: import('@shared/domain').Endeavor, run: EndeavorRun): void {
    if (endeavor.structure === 'unordered') {
      for (const state of run.obstacleStates) {
        if (state.status === 'locked') {
          state.status = 'available';
        }
      }
      return;
    }

    const ordered = [...run.obstacleStates].sort((left, right) => {
      const leftIndex = endeavor.obstacleIds.indexOf(left.obstacleId);
      const rightIndex = endeavor.obstacleIds.indexOf(right.obstacleId);
      return leftIndex - rightIndex;
    });
    const next = ordered.find((state) => state.status === 'locked');
    if (next) {
      next.status = 'available';
    }
  }

  private updateEndeavorOutcomeStatus(endeavor: import('@shared/domain').Endeavor, run: EndeavorRun): void {
    for (const track of endeavor.tracks) {
      const value = run.trackValues[track.key] ?? track.min;
      if (track.failureAt !== undefined && value >= track.failureAt) {
        run.status = 'failure';
        return;
      }
      if (track.successAt !== undefined && value >= track.successAt) {
        run.status = 'success';
      }
    }
  }

  private applyEndeavorEffects(
    context: CampaignContext,
    run: EndeavorRun,
    effects: Outcome['effects'],
    actor: EntityPointer | undefined,
    timestamp: string,
  ): void {
    for (const effect of effects) {
      switch (effect.type) {
        case 'resource-delta': {
          if (!effect.key) {
            break;
          }
          const delta = Number(effect.value ?? 0);
          run.trackValues[effect.key] = (run.trackValues[effect.key] ?? 0) + delta;
          context.chapterState.custom[effect.key] = run.trackValues[effect.key];
          break;
        }
        case 'set-flag':
          if (effect.key) {
            context.chapterState.flags[effect.key] = Boolean(effect.value);
          }
          break;
        case 'set-counter':
          if (effect.key) {
            context.chapterState.counters[effect.key] = Number(effect.value ?? 0);
          }
          break;
        case 'inc-counter':
          if (effect.key) {
            context.chapterState.counters[effect.key] = (context.chapterState.counters[effect.key] ?? 0) + Number(effect.value ?? 0);
          }
          break;
        case 'set-escalation':
          context.chapterState.escalation = Number(effect.value ?? context.chapterState.escalation);
          break;
        case 'grant-reward':
          if (effect.referenceId) {
            uniquePush(context.chapterState.rewardIds, effect.referenceId);
          }
          break;
        case 'grant-favor':
          if (effect.referenceId) {
            context.chapterState.favorUsesById[effect.referenceId] = 0;
          }
          break;
        case 'apply-condition':
          if (actor && effect.referenceId) {
            this.appendEvent(
              context,
              {
                kind: 'condition.applied',
                actor,
                payload: { entityKind: actor.kind, entityId: actor.id, conditionId: effect.referenceId },
              },
              timestamp,
            );
          }
          break;
        case 'remove-condition':
          if (actor && effect.referenceId) {
            this.appendEvent(
              context,
              {
                kind: 'condition.removed',
                actor,
                payload: { entityKind: actor.kind, entityId: actor.id, conditionId: effect.referenceId },
              },
              timestamp,
            );
          }
          break;
        default:
          break;
      }
    }
  }

  private assertEntityExists(context: CampaignContext, entity: EntityPointer): void {
    if (entity.kind === 'pc' && !context.pcs.find((pc) => pc.id === entity.id)) {
      throw new HttpError(404, 'PC not found.');
    }
    if (entity.kind === 'npc' && !context.npcs.find((npc) => npc.id === entity.id)) {
      throw new HttpError(404, 'NPC not found.');
    }
  }

  private buildResourceTargets(context: CampaignContext) {
    const targetMap = new Map<string, { entity: EntityPointer; label: string; resources: Record<string, number>; conditions: AppliedCondition[] }>();

    for (const pc of context.pcs) {
      targetMap.set(entityKey({ kind: 'pc', id: pc.id }), {
        entity: { kind: 'pc', id: pc.id },
        label: pc.characterName,
        resources: { ...pc.resources },
        conditions: [],
      });
    }

    for (const appearance of context.npcAppearances) {
      const npc = context.npcs.find((entry) => entry.id === appearance.npcId);
      if (!npc) {
        continue;
      }
      targetMap.set(entityKey({ kind: 'npc', id: npc.id }), {
        entity: { kind: 'npc', id: npc.id },
        label: appearance.aliasInScene || npc.canonicalName,
        resources: { ...npc.campaignState.resources },
        conditions: [],
      });
    }

    const orderedEvents = [...context.events].sort((left, right) => left.occurredAt.localeCompare(right.occurredAt));
    for (const event of orderedEvents) {
      if (!isRecord(event.payload)) {
        continue;
      }

      if (event.kind === 'resource.changed') {
        const kind = typeof event.payload['entityKind'] === 'string' ? event.payload['entityKind'] : undefined;
        const id = typeof event.payload['entityId'] === 'string' ? event.payload['entityId'] : undefined;
        const resourceKey = typeof event.payload['resourceKey'] === 'string' ? event.payload['resourceKey'] : undefined;
        const delta = typeof event.payload['delta'] === 'number' ? event.payload['delta'] : 0;
        if (!kind || !id || !resourceKey) {
          continue;
        }
        const target = targetMap.get(`${kind}:${id}`);
        if (!target) {
          continue;
        }
        target.resources[resourceKey] = (target.resources[resourceKey] ?? 0) + delta;
      }

      if (event.kind === 'condition.applied' || event.kind === 'condition.removed') {
        const kind = typeof event.payload['entityKind'] === 'string' ? event.payload['entityKind'] : undefined;
        const id = typeof event.payload['entityId'] === 'string' ? event.payload['entityId'] : undefined;
        const conditionId = typeof event.payload['conditionId'] === 'string' ? event.payload['conditionId'] : undefined;
        if (!kind || !id || !conditionId) {
          continue;
        }
        const target = targetMap.get(`${kind}:${id}`);
        if (!target) {
          continue;
        }
        if (event.kind === 'condition.applied') {
          target.conditions.push({
            conditionId,
            sourceEventId: event.id,
            startedAt: event.occurredAt,
          });
        } else {
          target.conditions = target.conditions.filter((condition) => condition.conditionId !== conditionId);
        }
      }
    }

    return Array.from(targetMap.values());
  }
}

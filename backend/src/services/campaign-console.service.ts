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
  DeepPartial,
  DiceRoll,
  DiceRollInput,
  EndeavorApproachResolutionInput,
  EndeavorRun,
  EndeavorRunAdjustmentInput,
  EntityPointer,
  EventLogEntry,
  Favor,
  FavorAdjustmentInput,
  GoalDeleteInput,
  GoalUpsertInput,
  Hook,
  Layered,
  Location,
  LocationDeleteInput,
  LocationUpsertInput,
  NPC,
  NPCAppearance,
  NpcDeleteInput,
  NpcUpsertInput,
  Obstacle,
  Outcome,
  PC,
  PCGoal,
  QuickNoteInput,
  ResourceDefinition,
  ResourceAdjustmentInput,
  Reward,
  RuleEvaluationRequest,
  RuleEvaluationResult,
  RuleReference,
  SceneEdgeCreateInput,
  SceneEdgeDeleteInput,
  SceneOutcomeSelectionInput,
  SkillDefinition,
  SceneNode,
  SceneNodeDeleteInput,
  SceneNodeDeletePreview,
  SceneNodeUpsertInput,
  SceneNpcAppearanceInput,
  SceneState,
  SceneStageLinkInput,
  SceneStateMutationInput,
  SessionRun,
  SimulationDefinition,
  SimulationResult,
  StatisticDefinition,
  StatisticTableDefinition,
  TextBlock,
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
  pcGoals: SqliteJsonRepository<PCGoal>;
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
  pcGoals: PCGoal[];
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
      pcGoals: context.pcGoals,
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

  async selectSceneOutcome(campaignId: string, input: SceneOutcomeSelectionInput): Promise<CampaignConsoleData> {
    this.ensureSeedData();
    const context = this.loadContext(campaignId);
    const sceneNode = context.sceneNodes.find((scene) => scene.id === input.sceneNodeId);
    if (!sceneNode) {
      throw new HttpError(404, 'Scene not found.');
    }

    const outcome = context.outcomes.find((entry) => entry.id === input.outcomeId);
    if (!outcome || outcome.sceneNodeId !== sceneNode.id) {
      throw new HttpError(404, 'Outcome not found for scene.');
    }

    const sceneState = this.getOrCreateSceneState(context, sceneNode.id);
    const chosenOutcomeIds = new Set(sceneState.chosenOutcomeIds);
    if (input.selected) {
      chosenOutcomeIds.add(outcome.id);
    } else {
      chosenOutcomeIds.delete(outcome.id);
    }

    sceneState.chosenOutcomeIds = [...chosenOutcomeIds];
    sceneState.updatedAt = nowIso();
    sceneState.revision += 1;
    this.repositories.sceneStates.upsert(sceneState);

    return this.getConsole(campaignId);
  }

  async linkSceneStage(campaignId: string, input: SceneStageLinkInput): Promise<CampaignConsoleData> {
    this.ensureSeedData();
    const context = this.loadContext(campaignId);
    const sceneNode = context.sceneNodes.find((scene) => scene.id === input.sceneNodeId);
    if (!sceneNode) {
      throw new HttpError(404, 'Scene not found.');
    }

    const sceneState = this.getOrCreateSceneState(context, sceneNode.id);
    sceneState.linkedStageSceneId = input.stageSceneId?.trim() || undefined;
    sceneState.updatedAt = nowIso();
    sceneState.revision += 1;
    this.repositories.sceneStates.upsert(sceneState);

    return this.getConsole(campaignId);
  }

  async previewSceneDelete(campaignId: string, sceneNodeId: string): Promise<SceneNodeDeletePreview> {
    this.ensureSeedData();
    const context = this.loadContext(campaignId);
    const sceneNode = context.sceneNodes.find((scene) => scene.id === sceneNodeId);
    if (!sceneNode) {
      throw new HttpError(404, 'Scene not found.');
    }

    return this.buildSceneDeletePreview(context, sceneNode);
  }

  async upsertSceneNode(campaignId: string, input: SceneNodeUpsertInput): Promise<CampaignConsoleData> {
    this.ensureSeedData();
    const context = this.loadContext(campaignId);
    const timestamp = nowIso();
    const trimmedTitle = input.title.trim();
    const trimmedKey = input.key.trim();
    if (!trimmedTitle) {
      throw new HttpError(400, 'Scene title is required.');
    }
    if (!trimmedKey) {
      throw new HttpError(400, 'Scene key is required.');
    }

    const existingScene =
      (input.sceneNodeId ? context.sceneNodes.find((scene) => scene.id === input.sceneNodeId) : undefined) ?? null;
    const duplicateKey = context.sceneNodes.find((scene) => scene.key === trimmedKey && scene.id !== existingScene?.id);
    if (duplicateKey) {
      throw new HttpError(409, 'Scene key already exists in this chapter.');
    }

    const sceneNode: SceneNode =
      existingScene ??
      ({
        id: randomUUID(),
        createdAt: timestamp,
        updatedAt: timestamp,
        revision: 1,
        campaignId: context.campaign.id,
        chapterId: context.chapter.id,
        key: trimmedKey,
        title: trimmedTitle,
        sceneKind: input.sceneKind,
        board: { x: 0, y: 0 },
        planning: {},
        content: {},
        passiveHookIds: [],
        activeHookIds: [],
        unlockWhen: [],
        linkedNpcAppearanceIds: [],
        linkedAdversaryTemplateIds: [],
        linkedLocationIds: [],
        linkedGoalIds: [],
        linkedRuleReferenceIds: [],
        outcomeIds: [],
        tags: [],
        sourceRefs: [],
      } satisfies SceneNode);

    sceneNode.key = trimmedKey;
    sceneNode.title = trimmedTitle;
    sceneNode.sceneKind = input.sceneKind;
    sceneNode.board = {
      x: Number.isFinite(input.board.x) ? input.board.x : 0,
      y: Number.isFinite(input.board.y) ? input.board.y : 0,
      lane: input.board.lane?.trim() || undefined,
    };
    sceneNode.planning = {
      classification: input.classification,
      readiness: input.readiness,
      focus: input.focus.trim(),
    };
    sceneNode.content = this.mergeLayeredContent(sceneNode.content, {
      summaryBlocks: this.makeTextBlocks('summary', [input.summary.trim()]),
      gmBlocks: this.makeTextBlocks('gm', [input.gmNote.trim()]),
      hiddenTruthBlocks: this.makeTextBlocks('truth', [input.hiddenTruth.trim()]),
      noteBlocks: this.makeTextBlocks('note', [input.note.trim()]),
    }, timestamp);
    sceneNode.tags = this.normalizeStringList(input.tags);
    sceneNode.linkedLocationIds = this.filterExistingIds(
      this.normalizeStringList(input.linkedLocationIds),
      context.locations.map((location) => location.id),
    );
    sceneNode.linkedGoalIds = this.filterExistingIds(
      this.normalizeStringList(input.linkedGoalIds),
      context.pcGoals.map((goal) => goal.id),
    );
    sceneNode.updatedAt = timestamp;
    sceneNode.revision = existingScene ? existingScene.revision + 1 : 1;

    this.syncSceneNpcAppearances(context, sceneNode, input.npcAppearances, timestamp);
    this.repositories.sceneNodes.upsert(sceneNode);

    const chapterSceneIds = context.chapter.sceneNodeIds.includes(sceneNode.id)
      ? context.chapter.sceneNodeIds
      : [...context.chapter.sceneNodeIds, sceneNode.id];
    const nextDefaultStartSceneId = input.isDefaultStartScene
      ? sceneNode.id
      : context.chapter.defaultStartSceneId === sceneNode.id
        ? undefined
        : context.chapter.defaultStartSceneId;
    const nextRequiredBeatSceneIds = input.isRequiredBeat
      ? uniquePush([...context.chapter.requiredBeatSceneIds], sceneNode.id)
      : removeValue(context.chapter.requiredBeatSceneIds, sceneNode.id);

    this.repositories.chapters.upsert({
      ...context.chapter,
      sceneNodeIds: chapterSceneIds,
      defaultStartSceneId: nextDefaultStartSceneId,
      requiredBeatSceneIds: nextRequiredBeatSceneIds,
      updatedAt: timestamp,
      revision: context.chapter.revision + 1,
    });

    if (!existingScene) {
      context.sceneNodes.push(sceneNode);
      this.getOrCreateSceneState(context, sceneNode.id);
      this.refreshUnlocks(context, timestamp);
    }

    return this.getConsole(campaignId);
  }

  async deleteSceneNode(campaignId: string, input: SceneNodeDeleteInput): Promise<CampaignConsoleData> {
    this.ensureSeedData();
    const context = this.loadContext(campaignId);
    const sceneNode = context.sceneNodes.find((scene) => scene.id === input.sceneNodeId);
    if (!sceneNode) {
      throw new HttpError(404, 'Scene not found.');
    }

    const timestamp = nowIso();
    const preview = this.buildSceneDeletePreview(context, sceneNode);
    const endeavorIds = context.endeavors.filter((endeavor) => endeavor.sceneNodeId === sceneNode.id).map((endeavor) => endeavor.id);

    for (const edge of this.repositories.sceneEdges.list().filter((entry) => entry.fromSceneId === sceneNode.id || entry.toSceneId === sceneNode.id)) {
      this.repositories.sceneEdges.remove(edge.id);
    }
    for (const state of this.repositories.sceneStates.list().filter((entry) => entry.sceneNodeId === sceneNode.id)) {
      this.repositories.sceneStates.remove(state.id);
    }
    for (const hook of this.repositories.hooks.list().filter((entry) => entry.sceneNodeId === sceneNode.id)) {
      this.repositories.hooks.remove(hook.id);
    }
    for (const outcome of this.repositories.outcomes.list().filter((entry) => entry.sceneNodeId === sceneNode.id)) {
      this.repositories.outcomes.remove(outcome.id);
    }
    for (const obstacle of this.repositories.obstacles.list().filter((entry) => endeavorIds.includes(entry.endeavorId))) {
      this.repositories.obstacles.remove(obstacle.id);
    }
    for (const run of this.repositories.endeavorRuns.list().filter((entry) => endeavorIds.includes(entry.endeavorId))) {
      this.repositories.endeavorRuns.remove(run.id);
    }
    for (const endeavor of this.repositories.endeavors.list().filter((entry) => entry.sceneNodeId === sceneNode.id)) {
      this.repositories.endeavors.remove(endeavor.id);
    }
    for (const encounter of this.repositories.encounters.list().filter((entry) => entry.sceneNodeId === sceneNode.id)) {
      this.repositories.encounters.remove(encounter.id);
    }
    for (const appearance of this.repositories.npcAppearances.list().filter((entry) => entry.sceneNodeId === sceneNode.id)) {
      this.repositories.npcAppearances.remove(appearance.id);
    }
    this.repositories.sceneNodes.remove(sceneNode.id);

    const nextSceneIds = removeValue(context.chapter.sceneNodeIds, sceneNode.id);
    const nextDefaultStartSceneId =
      context.chapter.defaultStartSceneId === sceneNode.id
        ? context.chapter.requiredBeatSceneIds.find((id) => id !== sceneNode.id && nextSceneIds.includes(id)) ??
          nextSceneIds[0]
        : context.chapter.defaultStartSceneId;
    this.repositories.chapters.upsert({
      ...context.chapter,
      sceneNodeIds: nextSceneIds,
      defaultStartSceneId: nextDefaultStartSceneId,
      requiredBeatSceneIds: removeValue(context.chapter.requiredBeatSceneIds, sceneNode.id),
      updatedAt: timestamp,
      revision: context.chapter.revision + 1,
    });

    for (const chapterState of this.repositories.chapterStates.list().filter((entry) => entry.chapterId === context.chapter.id)) {
      this.repositories.chapterStates.upsert({
        ...chapterState,
        activeSceneId: chapterState.activeSceneId === sceneNode.id ? undefined : chapterState.activeSceneId,
        unlockedSceneIds: removeValue(chapterState.unlockedSceneIds, sceneNode.id),
        completedSceneIds: removeValue(chapterState.completedSceneIds, sceneNode.id),
        skippedSceneIds: removeValue(chapterState.skippedSceneIds, sceneNode.id),
        updatedAt: timestamp,
        revision: chapterState.revision + 1,
      });
    }
    for (const sessionRun of this.repositories.sessionRuns.list().filter((entry) => entry.activeSceneId === sceneNode.id)) {
      this.repositories.sessionRuns.upsert({
        ...sessionRun,
        activeSceneId: undefined,
        updatedAt: timestamp,
        revision: sessionRun.revision + 1,
      });
    }
    for (const goal of this.repositories.pcGoals.list().filter((entry) => entry.triggerSceneIds.includes(sceneNode.id))) {
      this.repositories.pcGoals.upsert({
        ...goal,
        triggerSceneIds: removeValue(goal.triggerSceneIds, sceneNode.id),
        updatedAt: timestamp,
        revision: goal.revision + 1,
      });
    }

    this.appendEvent(
      context,
      {
        kind: 'note.captured',
        sceneNodeId: context.chapterState.activeSceneId,
        payload: {
          deletedSceneNodeId: sceneNode.id,
          deletedSceneTitle: sceneNode.title,
          cascade: {
            connectedEdgeCount: preview.connectedEdgeCount,
            sceneStateCount: preview.sceneStateCount,
            hookCount: preview.hookCount,
            outcomeCount: preview.outcomeCount,
            endeavorCount: preview.endeavorCount,
            obstacleCount: preview.obstacleCount,
            endeavorRunCount: preview.endeavorRunCount,
            encounterCount: preview.encounterCount,
            npcAppearanceCount: preview.npcAppearanceCount,
          },
        },
      },
      timestamp,
    );

    return this.getConsole(campaignId);
  }

  async createSceneEdge(campaignId: string, input: SceneEdgeCreateInput): Promise<CampaignConsoleData> {
    this.ensureSeedData();
    const context = this.loadContext(campaignId);
    const fromScene = context.sceneNodes.find((scene) => scene.id === input.fromSceneId);
    const toScene = context.sceneNodes.find((scene) => scene.id === input.toSceneId);
    if (!fromScene || !toScene) {
      throw new HttpError(404, 'Scene not found for edge.');
    }

    const duplicate = this.repositories.sceneEdges
      .list()
      .find((edge) => edge.fromSceneId === input.fromSceneId && edge.toSceneId === input.toSceneId && edge.kind === input.kind);
    if (duplicate) {
      throw new HttpError(409, 'That edge already exists.');
    }

    const timestamp = nowIso();
    const priorities = this.repositories.sceneEdges
      .list()
      .filter((edge) => edge.chapterId === context.chapter.id)
      .map((edge) => edge.priority);
    this.repositories.sceneEdges.upsert({
      id: randomUUID(),
      createdAt: timestamp,
      updatedAt: timestamp,
      revision: 1,
      chapterId: context.chapter.id,
      fromSceneId: input.fromSceneId,
      toSceneId: input.toSceneId,
      kind: input.kind,
      label: input.label?.trim() || undefined,
      priority: input.priority ?? (priorities.length ? Math.max(...priorities) + 1 : 1),
    });
    return this.getConsole(campaignId);
  }

  async deleteSceneEdge(campaignId: string, input: SceneEdgeDeleteInput): Promise<CampaignConsoleData> {
    this.ensureSeedData();
    if (!this.repositories.sceneEdges.get(input.edgeId)) {
      throw new HttpError(404, 'Edge not found.');
    }
    this.repositories.sceneEdges.remove(input.edgeId);
    return this.getConsole(campaignId);
  }

  async upsertNpc(campaignId: string, input: NpcUpsertInput): Promise<CampaignConsoleData> {
    this.ensureSeedData();
    const context = this.loadContext(campaignId);
    const timestamp = nowIso();
    const trimmedName = input.canonicalName.trim();
    const trimmedKey = input.key.trim();
    if (!trimmedName) {
      throw new HttpError(400, 'NPC name is required.');
    }
    if (!trimmedKey) {
      throw new HttpError(400, 'NPC key is required.');
    }

    const existingNpc = (input.npcId ? context.npcs.find((npc) => npc.id === input.npcId) : undefined) ?? null;
    const duplicateKey = context.npcs.find((npc) => npc.key === trimmedKey && npc.id !== existingNpc?.id);
    if (duplicateKey) {
      throw new HttpError(409, 'NPC key already exists in this campaign.');
    }

    const npc: NPC =
      existingNpc ??
      ({
        id: randomUUID(),
        createdAt: timestamp,
        updatedAt: timestamp,
        revision: 1,
        campaignId: context.campaign.id,
        key: trimmedKey,
        canonicalName: trimmedName,
        aliases: [],
        factionIds: [],
        content: {},
        campaignState: {
          statusTags: [],
          resources: {},
          relationshipByPcId: {},
          historyEventIds: [],
        },
      } satisfies NPC);

    npc.key = trimmedKey;
    npc.canonicalName = trimmedName;
    npc.aliases = this.normalizeStringList(input.aliases);
    npc.content = this.mergeLayeredContent(npc.content, {
      canonicalSummary: this.makeTextBlocks('summary', [input.canonicalSummary.trim()]),
      privateTruth: this.makeTextBlocks('truth', [input.privateTruth.trim()]),
      portrayalDefaults: this.makeTextBlocks('gm', [input.portrayalDefaults.trim()]),
    }, timestamp);
    npc.campaignState = {
      ...npc.campaignState,
      statusTags: this.normalizeStringList(input.statusTags),
    };
    npc.updatedAt = timestamp;
    npc.revision = existingNpc ? existingNpc.revision + 1 : 1;
    this.repositories.npcs.upsert(npc);

    if (!context.campaign.npcIds.includes(npc.id)) {
      this.repositories.campaigns.upsert({
        ...context.campaign,
        npcIds: [...context.campaign.npcIds, npc.id],
        updatedAt: timestamp,
        revision: context.campaign.revision + 1,
      });
    }

    return this.getConsole(campaignId);
  }

  async deleteNpc(campaignId: string, input: NpcDeleteInput): Promise<CampaignConsoleData> {
    this.ensureSeedData();
    const context = this.loadContext(campaignId);
    const npc = context.npcs.find((entry) => entry.id === input.npcId);
    if (!npc) {
      throw new HttpError(404, 'NPC not found.');
    }
    const timestamp = nowIso();
    for (const appearance of this.repositories.npcAppearances.list().filter((entry) => entry.npcId === npc.id)) {
      this.repositories.npcAppearances.remove(appearance.id);
    }
    for (const scene of this.repositories.sceneNodes.list().filter((entry) => entry.linkedNpcAppearanceIds.length > 0)) {
      const remainingAppearanceIds = scene.linkedNpcAppearanceIds.filter((appearanceId) =>
        !context.npcAppearances.some((appearance) => appearance.id === appearanceId && appearance.npcId === npc.id),
      );
      if (remainingAppearanceIds.length !== scene.linkedNpcAppearanceIds.length) {
        this.repositories.sceneNodes.upsert({
          ...scene,
          linkedNpcAppearanceIds: remainingAppearanceIds,
          updatedAt: timestamp,
          revision: scene.revision + 1,
        });
      }
    }
    for (const goal of this.repositories.pcGoals.list().filter((entry) => entry.triggerNpcIds.includes(npc.id))) {
      this.repositories.pcGoals.upsert({
        ...goal,
        triggerNpcIds: removeValue(goal.triggerNpcIds, npc.id),
        updatedAt: timestamp,
        revision: goal.revision + 1,
      });
    }
    this.repositories.npcs.remove(npc.id);
    this.repositories.campaigns.upsert({
      ...context.campaign,
      npcIds: removeValue(context.campaign.npcIds, npc.id),
      updatedAt: timestamp,
      revision: context.campaign.revision + 1,
    });
    return this.getConsole(campaignId);
  }

  async upsertLocation(campaignId: string, input: LocationUpsertInput): Promise<CampaignConsoleData> {
    this.ensureSeedData();
    const context = this.loadContext(campaignId);
    const timestamp = nowIso();
    const trimmedName = input.name.trim();
    const trimmedKey = input.key.trim();
    if (!trimmedName) {
      throw new HttpError(400, 'Location name is required.');
    }
    if (!trimmedKey) {
      throw new HttpError(400, 'Location key is required.');
    }

    const existingLocation = (input.locationId ? context.locations.find((location) => location.id === input.locationId) : undefined) ?? null;
    const duplicateKey = context.locations.find((location) => location.key === trimmedKey && location.id !== existingLocation?.id);
    if (duplicateKey) {
      throw new HttpError(409, 'Location key already exists in this campaign.');
    }

    const location: Location =
      existingLocation ??
      ({
        id: randomUUID(),
        createdAt: timestamp,
        updatedAt: timestamp,
        revision: 1,
        campaignId: context.campaign.id,
        key: trimmedKey,
        name: trimmedName,
        kind: input.kind,
        content: {},
        tags: [],
      } satisfies Location);

    location.key = trimmedKey;
    location.name = trimmedName;
    location.kind = input.kind;
    location.tags = this.normalizeStringList(input.tags);
    location.content = this.mergeLayeredContent(location.content, {
      publicSummary: this.makeTextBlocks('summary', [input.publicSummary.trim()]),
      gmTruth: this.makeTextBlocks('truth', [input.gmTruth.trim()]),
    }, timestamp);
    location.updatedAt = timestamp;
    location.revision = existingLocation ? existingLocation.revision + 1 : 1;
    this.repositories.locations.upsert(location);

    if (!context.campaign.locationIds.includes(location.id)) {
      this.repositories.campaigns.upsert({
        ...context.campaign,
        locationIds: [...context.campaign.locationIds, location.id],
        updatedAt: timestamp,
        revision: context.campaign.revision + 1,
      });
    }

    return this.getConsole(campaignId);
  }

  async deleteLocation(campaignId: string, input: LocationDeleteInput): Promise<CampaignConsoleData> {
    this.ensureSeedData();
    const context = this.loadContext(campaignId);
    const location = context.locations.find((entry) => entry.id === input.locationId);
    if (!location) {
      throw new HttpError(404, 'Location not found.');
    }
    const timestamp = nowIso();
    for (const scene of this.repositories.sceneNodes.list().filter((entry) => entry.linkedLocationIds.includes(location.id))) {
      this.repositories.sceneNodes.upsert({
        ...scene,
        linkedLocationIds: removeValue(scene.linkedLocationIds, location.id),
        updatedAt: timestamp,
        revision: scene.revision + 1,
      });
    }
    this.repositories.locations.remove(location.id);
    this.repositories.campaigns.upsert({
      ...context.campaign,
      locationIds: removeValue(context.campaign.locationIds, location.id),
      updatedAt: timestamp,
      revision: context.campaign.revision + 1,
    });
    return this.getConsole(campaignId);
  }

  async upsertGoal(campaignId: string, input: GoalUpsertInput): Promise<CampaignConsoleData> {
    this.ensureSeedData();
    const context = this.loadContext(campaignId);
    const timestamp = nowIso();
    const trimmedTitle = input.title.trim();
    const trimmedOwner = input.ownerLabel.trim();
    if (!trimmedTitle) {
      throw new HttpError(400, 'Goal title is required.');
    }
    if (!trimmedOwner) {
      throw new HttpError(400, 'Goal owner is required.');
    }

    const existingGoal = (input.goalId ? context.pcGoals.find((goal) => goal.id === input.goalId) : undefined) ?? null;
    const goal: PCGoal =
      existingGoal ??
      ({
        id: randomUUID(),
        createdAt: timestamp,
        updatedAt: timestamp,
        revision: 1,
        campaignId: context.campaign.id,
        ownerLabel: trimmedOwner,
        title: trimmedTitle,
        description: '',
        progressState: 'active',
        progressNotes: [],
        triggerSceneIds: [],
        triggerNpcIds: [],
      } satisfies PCGoal);

    goal.ownerLabel = trimmedOwner;
    goal.title = trimmedTitle;
    goal.description = input.description.trim();
    goal.progressState = input.progressState;
    goal.progressNotes = this.normalizeStringList(input.progressNotes);
    goal.triggerSceneIds = this.filterExistingIds(
      this.normalizeStringList(input.triggerSceneIds),
      context.sceneNodes.map((scene) => scene.id),
    );
    goal.triggerNpcIds = this.filterExistingIds(
      this.normalizeStringList(input.triggerNpcIds),
      context.npcs.map((npc) => npc.id),
    );
    goal.updatedAt = timestamp;
    goal.revision = existingGoal ? existingGoal.revision + 1 : 1;
    this.repositories.pcGoals.upsert(goal);
    return this.getConsole(campaignId);
  }

  async deleteGoal(campaignId: string, input: GoalDeleteInput): Promise<CampaignConsoleData> {
    this.ensureSeedData();
    const context = this.loadContext(campaignId);
    const goal = context.pcGoals.find((entry) => entry.id === input.goalId);
    if (!goal) {
      throw new HttpError(404, 'Goal not found.');
    }
    const timestamp = nowIso();
    for (const scene of this.repositories.sceneNodes.list().filter((entry) => (entry.linkedGoalIds ?? []).includes(goal.id))) {
      this.repositories.sceneNodes.upsert({
        ...scene,
        linkedGoalIds: removeValue(scene.linkedGoalIds ?? [], goal.id),
        updatedAt: timestamp,
        revision: scene.revision + 1,
      });
    }
    this.repositories.pcGoals.remove(goal.id);
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
      if (this.repositories.pcGoals.count() === 0) {
        this.repositories.pcGoals.saveAll(buildCampaignSeed().pcGoals);
      }
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
    this.repositories.pcGoals.saveAll(seed.pcGoals);
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
      pcGoals: this.repositories.pcGoals.list().filter((goal) => goal.campaignId === campaign.id),
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

  private buildSceneDeletePreview(context: CampaignContext, sceneNode: SceneNode): SceneNodeDeletePreview {
    const endeavorIds = context.endeavors.filter((endeavor) => endeavor.sceneNodeId === sceneNode.id).map((endeavor) => endeavor.id);
    return {
      sceneNodeId: sceneNode.id,
      sceneTitle: sceneNode.title,
      connectedEdgeCount: this.repositories.sceneEdges.list().filter((edge) => edge.fromSceneId === sceneNode.id || edge.toSceneId === sceneNode.id).length,
      sceneStateCount: this.repositories.sceneStates.list().filter((state) => state.sceneNodeId === sceneNode.id).length,
      hookCount: this.repositories.hooks.list().filter((hook) => hook.sceneNodeId === sceneNode.id).length,
      outcomeCount: this.repositories.outcomes.list().filter((outcome) => outcome.sceneNodeId === sceneNode.id).length,
      endeavorCount: endeavorIds.length,
      obstacleCount: this.repositories.obstacles.list().filter((obstacle) => endeavorIds.includes(obstacle.endeavorId)).length,
      endeavorRunCount: this.repositories.endeavorRuns.list().filter((run) => endeavorIds.includes(run.endeavorId)).length,
      encounterCount: this.repositories.encounters.list().filter((encounter) => encounter.sceneNodeId === sceneNode.id).length,
      npcAppearanceCount: this.repositories.npcAppearances.list().filter((appearance) => appearance.sceneNodeId === sceneNode.id).length,
    };
  }

  private syncSceneNpcAppearances(
    context: CampaignContext,
    sceneNode: SceneNode,
    inputs: SceneNpcAppearanceInput[],
    timestamp: string,
  ): void {
    const existingAppearances = this.repositories.npcAppearances
      .list()
      .filter((appearance) => appearance.chapterId === context.chapter.id && appearance.sceneNodeId === sceneNode.id);
    const existingById = new Map(existingAppearances.map((appearance) => [appearance.id, appearance]));
    const validNpcIds = new Set(context.npcs.map((npc) => npc.id));
    const nextAppearanceIds: string[] = [];

    for (const input of inputs) {
      if (!validNpcIds.has(input.npcId)) {
        continue;
      }

      const existingAppearance = (input.appearanceId ? existingById.get(input.appearanceId) : undefined) ?? null;
      const appearance: NPCAppearance =
        existingAppearance ??
        ({
          id: randomUUID(),
          createdAt: timestamp,
          updatedAt: timestamp,
          revision: 1,
          npcId: input.npcId,
          chapterId: context.chapter.id,
          sceneNodeId: sceneNode.id,
          roleIds: [],
          localSecrets: [],
          portrayalOverride: [],
          notes: [],
        } satisfies NPCAppearance);

      appearance.npcId = input.npcId;
      appearance.chapterId = context.chapter.id;
      appearance.sceneNodeId = sceneNode.id;
      appearance.aliasInScene = input.aliasInScene?.trim() || undefined;
      appearance.stance = input.stance;
      appearance.localGoal = input.localGoal?.trim() || undefined;
      appearance.localSecrets = this.makeTextBlocks('truth', input.localSecrets);
      appearance.portrayalOverride = this.makeTextBlocks('gm', input.portrayalOverride);
      appearance.notes = this.makeTextBlocks('note', input.notes);
      appearance.updatedAt = timestamp;
      appearance.revision = existingAppearance ? existingAppearance.revision + 1 : 1;
      this.repositories.npcAppearances.upsert(appearance);
      nextAppearanceIds.push(appearance.id);
      existingById.delete(appearance.id);
    }

    for (const appearance of existingById.values()) {
      this.repositories.npcAppearances.remove(appearance.id);
    }

    sceneNode.linkedNpcAppearanceIds = nextAppearanceIds;
  }

  private mergeLayeredContent<T extends object>(layered: Layered<T>, patch: DeepPartial<T>, timestamp: string): Layered<T> {
    return {
      ...layered,
      gm: {
        ...(layered.gm ?? { updatedAt: timestamp }),
        patch,
        updatedAt: timestamp,
      },
    };
  }

  private makeTextBlocks(kind: 'summary' | 'gm' | 'truth' | 'note', texts: string[]): TextBlock[] {
    return this.normalizeStringList(texts).map((text) => ({
      id: randomUUID(),
      kind,
      text,
    }));
  }

  private normalizeStringList(values: string[]): string[] {
    return Array.from(
      new Set(
        values
          .map((value) => value.trim())
          .filter(Boolean),
      ),
    );
  }

  private filterExistingIds(values: string[], validIds: string[]): string[] {
    const validIdSet = new Set(validIds);
    return this.normalizeStringList(values).filter((value) => validIdSet.has(value));
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

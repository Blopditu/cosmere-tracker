import {
  AppliedCondition,
  CampaignConsoleData,
  CampaignAnalyticsSummary,
  Chapter,
  ChapterState,
  Condition,
  DiceRoll,
  EndeavorRun,
  EventLogEntry,
  Favor,
  GMOverride,
  Hook,
  JsonValue,
  Layered,
  Location,
  NPC,
  NPCAppearance,
  Obstacle,
  Outcome,
  FlowNodeClassification,
  FlowNodeReadiness,
  Predicate,
  PCGoal,
  ResolvedChapterBoard,
  ResolvedNPCCard,
  ResolvedSceneNode,
  RuleReference,
  SceneContent,
  SceneEdge,
  SceneNode,
  SceneState,
  SessionRun,
  TextBlock,
  EncounterSetup,
  Reward,
  Endeavor,
  ActionDefinition,
  ResourceDefinition,
  ResolutionHook,
  StatisticDefinition,
  StatisticTableDefinition,
  SkillDefinition,
  RuleAdvisory,
  SimulationResult,
  RuntimeCommandState,
} from './campaign-models';

type PlainObject = Record<string, JsonValue>;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function deepMerge<T>(source: T, patch?: unknown): T {
  if (patch === undefined) {
    return structuredClone(source);
  }

  if (!isObject(source) || !isObject(patch)) {
    return structuredClone(patch as T);
  }

  const result: Record<string, unknown> = structuredClone(source);
  for (const [key, value] of Object.entries(patch)) {
    const current = result[key];
    if (Array.isArray(value)) {
      result[key] = structuredClone(value);
      continue;
    }
    if (isObject(current) && isObject(value)) {
      result[key] = deepMerge(current, value);
      continue;
    }
    result[key] = structuredClone(value);
  }
  return result as T;
}

function applyBlockOverrides(blocks: TextBlock[], overrides?: GMOverride<unknown>['blockOverrides']): TextBlock[] {
  if (!overrides?.length) {
    return blocks.map((block) => ({ ...block }));
  }

  const nextBlocks = blocks.map((block) => ({ ...block }));

  for (const override of overrides) {
    if (override.op === 'hide' && override.targetBlockId) {
      const index = nextBlocks.findIndex((block) => block.id === override.targetBlockId);
      if (index >= 0) {
        nextBlocks.splice(index, 1);
      }
      continue;
    }

    if (override.op === 'replace' && override.targetBlockId && override.newText) {
      const block = nextBlocks.find((entry) => entry.id === override.targetBlockId);
      if (block) {
        block.text = override.newText;
      }
      continue;
    }

    if (override.op === 'insertAfter' && override.targetBlockId && override.newText) {
      const index = nextBlocks.findIndex((block) => block.id === override.targetBlockId);
      const inserted: TextBlock = {
        id: override.id,
        kind: 'gm',
        text: override.newText,
      };
      if (index >= 0) {
        nextBlocks.splice(index + 1, 0, inserted);
      } else {
        nextBlocks.push(inserted);
      }
    }
  }

  return nextBlocks;
}

export function resolveLayered<T>(layered: Layered<T>): T {
  const sourceValue = (layered.source?.value ?? {}) as T;
  const patched = deepMerge(sourceValue, layered.gm?.patch);

  const resolved = { ...patched } as Record<string, unknown>;
  for (const [key, value] of Object.entries(resolved)) {
    if (
      Array.isArray(value) &&
      value.every((item) => isObject(item) && typeof item['id'] === 'string' && typeof item['text'] === 'string')
    ) {
      resolved[key] = applyBlockOverrides(value as TextBlock[], layered.gm?.blockOverrides);
    }
  }

  return resolved as T;
}

function resolveBlockDiff(sourceBlocks: TextBlock[], resolvedBlocks: TextBlock[], overrides?: GMOverride<unknown>['blockOverrides']) {
  const sourceMap = new Map(sourceBlocks.map((block) => [block.id, block]));
  const resolvedIds = new Set(resolvedBlocks.map((block) => block.id));
  const changedBlocks = resolvedBlocks.filter((block) => sourceMap.has(block.id) && sourceMap.get(block.id)?.text !== block.text).length;
  const insertedBlocks = resolvedBlocks.filter((block) => !sourceMap.has(block.id)).length;
  const hiddenBlocks = (overrides ?? []).filter(
    (override) => override.op === 'hide' && override.targetBlockId && !resolvedIds.has(override.targetBlockId),
  ).length;
  return { changedBlocks, insertedBlocks, hiddenBlocks };
}

function resolveSceneClassification(sceneNode: SceneNode, chapter: Chapter): FlowNodeClassification {
  if (sceneNode.planning?.classification) {
    return sceneNode.planning.classification;
  }

  if (sceneNode.sceneKind === 'endeavor' || sceneNode.sceneKind === 'transition') {
    return 'hub';
  }

  return chapter.requiredBeatSceneIds.includes(sceneNode.id) ? 'critical' : 'optional';
}

function resolveSceneReadiness(sceneNode: SceneNode): FlowNodeReadiness {
  if (sceneNode.planning?.readiness) {
    return sceneNode.planning.readiness;
  }

  const hasPreparation = Boolean(sceneNode.content.source?.value.summaryBlocks.length || sceneNode.content.source?.value.gmBlocks.length);
  return hasPreparation ? 'ready' : 'draft';
}

function resolveSceneFocus(sceneNode: SceneNode, resolvedContent: SceneContent): string {
  const explicitFocus = sceneNode.planning?.focus?.trim();
  if (explicitFocus) {
    return explicitFocus;
  }

  return (
    resolvedContent.noteBlocks[0]?.text ??
    resolvedContent.summaryBlocks[0]?.text ??
    'Prep focus has not been written for this scene yet.'
  );
}

export function evaluatePredicate(
  predicate: Predicate,
  sceneStatuses: Record<string, SceneState['status']>,
  chapterState: ChapterState,
): boolean {
  let left: JsonValue = null;

  switch (predicate.scope) {
    case 'chapter.flag':
      left = chapterState.flags[predicate.key] ?? false;
      break;
    case 'chapter.counter':
      left = chapterState.counters[predicate.key] ?? 0;
      break;
    case 'scene.status':
      left = sceneStatuses[predicate.key] ?? 'locked';
      break;
    case 'favor':
      left = chapterState.favorUsesById[predicate.key] ?? 0;
      break;
    case 'custom':
      left = chapterState.custom[predicate.key] ?? null;
      break;
    default:
      left = null;
      break;
  }

  switch (predicate.op) {
    case 'eq':
      return left === predicate.value;
    case 'neq':
      return left !== predicate.value;
    case 'gt':
      return Number(left) > Number(predicate.value);
    case 'gte':
      return Number(left) >= Number(predicate.value);
    case 'lt':
      return Number(left) < Number(predicate.value);
    case 'lte':
      return Number(left) <= Number(predicate.value);
    case 'includes':
      return Array.isArray(left) ? left.includes(predicate.value) : false;
    default:
      return false;
  }
}

export function evaluateStateExpression(
  expression: SceneNode['unlockWhen'][number] | undefined,
  sceneStatuses: Record<string, SceneState['status']>,
  chapterState: ChapterState,
): boolean {
  if (!expression) {
    return true;
  }

  const allPassed = (expression.all ?? []).every((predicate) => evaluatePredicate(predicate, sceneStatuses, chapterState));
  const anyPassed = expression.any?.length
    ? expression.any.some((predicate) => evaluatePredicate(predicate, sceneStatuses, chapterState))
    : true;
  const notPassed = (expression.not ?? []).every((predicate) => !evaluatePredicate(predicate, sceneStatuses, chapterState));

  return allPassed && anyPassed && notPassed;
}

export function buildResolvedSceneNodes(
  chapter: Chapter,
  chapterState: ChapterState,
  sceneNodes: SceneNode[],
  sceneStates: SceneState[],
): ResolvedSceneNode[] {
  const defaultStateMap = new Map<string, SceneState>();
  for (const sceneNode of sceneNodes) {
    defaultStateMap.set(sceneNode.id, {
      id: `${sceneNode.id}-state`,
      sessionRunId: '',
      chapterId: chapter.id,
      sceneNodeId: sceneNode.id,
      status: sceneNode.unlockWhen.length ? 'locked' : 'available',
      createdAt: sceneNode.createdAt,
      updatedAt: sceneNode.updatedAt,
      revision: 1,
      localNotes: [],
      chosenOutcomeIds: [],
      runtimeFlags: {},
      custom: {},
    });
  }
  for (const state of sceneStates) {
    defaultStateMap.set(state.sceneNodeId, state);
  }

  const sceneStatuses = Object.fromEntries(
    Array.from(defaultStateMap.values()).map((state) => [state.sceneNodeId, state.status]),
  );

  return sceneNodes.map((sceneNode) => {
    const state = defaultStateMap.get(sceneNode.id)!;
    const resolvedContent = resolveLayered<SceneContent>(sceneNode.content);
    const sourceBlocks = sceneNode.content.source?.value.gmBlocks ?? [];
    const gmDiff = resolveBlockDiff(sourceBlocks, resolvedContent.gmBlocks, sceneNode.content.gm?.blockOverrides);
    const isUnlocked =
      state.status !== 'locked' ||
      sceneNode.unlockWhen.length === 0 ||
      sceneNode.unlockWhen.some((expression) =>
        evaluateStateExpression(
          expression,
          sceneStatuses,
          chapterState,
        ),
      );

    return {
      ...sceneNode,
      linkedGoalIds: sceneNode.linkedGoalIds ?? [],
      resolvedPlanning: {
        classification: resolveSceneClassification(sceneNode, chapter),
        readiness: resolveSceneReadiness(sceneNode),
        focus: resolveSceneFocus(sceneNode, resolvedContent),
      },
      resolvedContent,
      gmDiff,
      state: state.status === 'locked' && isUnlocked ? { ...state, status: 'available' } : state,
      isUnlocked,
    };
  });
}

export function buildResolvedNPCCards(
  npcs: NPC[],
  appearances: NPCAppearance[],
  activeChapterId: string,
): ResolvedNPCCard[] {
  return npcs.map((npc) => {
    const appearance = appearances.find((entry) => entry.npcId === npc.id && entry.chapterId === activeChapterId);
    const resolved = resolveLayered(npc.content);
    const resolvedSummaryBlocks = [...resolved.canonicalSummary, ...(appearance?.notes ?? [])];
    const resolvedPortrayalBlocks = [...resolved.portrayalDefaults, ...(appearance?.portrayalOverride ?? [])];
    return {
      npc,
      appearance,
      resolvedSummaryBlocks,
      resolvedPortrayalBlocks,
    };
  });
}

export function buildResolvedBoard(
  chapter: Chapter,
  chapterState: ChapterState,
  sceneNodes: SceneNode[],
  sceneEdges: SceneEdge[],
  sceneStates: SceneState[],
): ResolvedChapterBoard {
  const nodes = buildResolvedSceneNodes(chapter, chapterState, sceneNodes, sceneStates);
  return {
    chapter,
    chapterState,
    nodes,
    edges: sceneEdges.sort((left, right) => left.priority - right.priority),
    availableSceneIds: nodes.filter((node) => node.state.status === 'available' || node.state.status === 'active').map((node) => node.id),
    activeSceneId: chapterState.activeSceneId,
  };
}

export function buildCampaignConsoleData(params: {
  campaign: CampaignConsoleData['campaign'];
  chapter: Chapter;
  chapterState: ChapterState;
  sceneNodes: SceneNode[];
  sceneEdges: SceneEdge[];
  sceneStates: SceneState[];
  npcs: NPC[];
  npcAppearances: NPCAppearance[];
  pcGoals: PCGoal[];
  locations: Location[];
  rules: RuleReference[];
  conditions: Condition[];
  hooks: Hook[];
  outcomes: Outcome[];
  favors: Favor[];
  rewards: Reward[];
  endeavors: Endeavor[];
  obstacles: Obstacle[];
  encounters: EncounterSetup[];
  resourceDefinitions: ResourceDefinition[];
  statisticDefinitions: StatisticDefinition[];
  statisticTableDefinitions: StatisticTableDefinition[];
  skillDefinitions: SkillDefinition[];
  actionDefinitions: ActionDefinition[];
  resolutionHooks: ResolutionHook[];
  activeEndeavorRun?: EndeavorRun;
  ruleAdvisories: RuleAdvisory[];
  analytics: CampaignAnalyticsSummary;
  simulationResults: SimulationResult[];
  sessionRun: SessionRun;
  recentEvents: EventLogEntry[];
  recentDiceRolls: DiceRoll[];
  resourceTargets: RuntimeCommandState['resourceTargets'];
}): CampaignConsoleData {
  const board = buildResolvedBoard(
    params.chapter,
    params.chapterState,
    params.sceneNodes,
    params.sceneEdges,
    params.sceneStates,
  );

  return {
    campaign: params.campaign,
    activeChapterId: params.chapter.id,
    board,
    sceneIndex: Object.fromEntries(board.nodes.map((node) => [node.id, node])),
    npcs: params.npcs,
    npcAppearances: params.npcAppearances,
    npcCards: buildResolvedNPCCards(params.npcs, params.npcAppearances, params.chapter.id),
    pcGoals: params.pcGoals,
    locations: params.locations,
    rules: params.rules,
    conditions: params.conditions,
    hooks: params.hooks,
    outcomes: params.outcomes,
    favors: params.favors,
    rewards: params.rewards,
    endeavors: params.endeavors,
    obstacles: params.obstacles,
    encounters: params.encounters,
    resourceDefinitions: params.resourceDefinitions,
    statisticDefinitions: params.statisticDefinitions,
    statisticTableDefinitions: params.statisticTableDefinitions,
    skillDefinitions: params.skillDefinitions,
    actionDefinitions: params.actionDefinitions,
    resolutionHooks: params.resolutionHooks,
    activeEndeavorRun: params.activeEndeavorRun,
    ruleAdvisories: params.ruleAdvisories,
    analytics: params.analytics,
    simulationResults: params.simulationResults,
    runtime: {
      sessionRun: params.sessionRun,
      chapterState: params.chapterState,
      activeSceneId: params.chapterState.activeSceneId,
      quickNotes: params.sessionRun.quickNotes,
      favorUsage: params.favors.map((favor) => {
        const spentUses = params.chapterState.favorUsesById[favor.id] ?? 0;
        const remainingUses = favor.maxUses !== undefined ? Math.max(0, favor.maxUses - spentUses) : undefined;
        return { favor, spentUses, remainingUses };
      }),
      resourceTargets: params.resourceTargets,
      recentDiceRolls: params.recentDiceRolls,
      recentEvents: params.recentEvents,
    },
  };
}

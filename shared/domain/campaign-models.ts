export type ID = string;
export type ISODateTime = string;
export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };
export type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends Array<infer U>
    ? Array<DeepPartial<U>>
    : T[K] extends object
      ? DeepPartial<T[K]>
      : T[K];
};

export type SourceKind = 'stormlight-handbook' | 'stonewalkers-adventure' | 'stonewalkers-gm-tools';
export type RuleMode = 'assistive' | 'strict';
export type SceneNodeStatus = 'locked' | 'available' | 'active' | 'completed' | 'skipped';
export type HookMode = 'active' | 'passive';
export type EndeavorKind = 'pursuit' | 'infiltration' | 'exploration' | 'mission' | 'discovery';
export type EncounterStatus = 'planned' | 'active' | 'paused' | 'finished';
export type EventKind =
  | 'scene.activated'
  | 'scene.completed'
  | 'scene.skipped'
  | 'scene.unlocked'
  | 'chapter.flag.changed'
  | 'chapter.counter.changed'
  | 'chapter.escalation.changed'
  | 'favor.gained'
  | 'favor.spent'
  | 'reward.granted'
  | 'resource.changed'
  | 'condition.applied'
  | 'condition.removed'
  | 'dice.rolled'
  | 'outcome.applied'
  | 'combat.started'
  | 'combat.action'
  | 'combat.finished'
  | 'note.captured';

export interface BaseRecord {
  id: ID;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
  revision: number;
}

export interface SourceRef {
  documentId: ID;
  sourceKind: SourceKind;
  locator: string;
  pageStart?: number;
  pageEnd?: number;
  excerpt?: string;
  confidence: number;
}

export interface TextBlock {
  id: ID;
  kind: 'summary' | 'gm' | 'boxed' | 'truth' | 'note';
  text: string;
}

export interface BlockOverride {
  id: ID;
  op: 'replace' | 'insertAfter' | 'hide';
  targetBlockId?: ID;
  newText?: string;
}

export interface SourceSnapshot<T> {
  value: T;
  importBatchId: ID;
  importedAt: ISODateTime;
  locked: true;
  refs: SourceRef[];
}

export interface GMOverride<T> {
  patch?: DeepPartial<T>;
  blockOverrides?: BlockOverride[];
  basedOnSourceRevision?: number;
  updatedAt: ISODateTime;
}

export interface Layered<T> {
  source?: SourceSnapshot<T>;
  gm?: GMOverride<T>;
}

export interface EntityPointer {
  kind:
    | 'campaign'
    | 'chapter'
    | 'scene'
    | 'npc'
    | 'npcAppearance'
    | 'pc'
    | 'faction'
    | 'location'
    | 'rule'
    | 'adversary'
    | 'encounter'
    | 'combat'
    | 'reward'
    | 'favor';
  id: ID;
}

export interface Predicate {
  scope: 'chapter.flag' | 'chapter.counter' | 'scene.status' | 'favor' | 'entity.tag' | 'custom';
  key: string;
  op: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'includes';
  value: JsonValue;
}

export interface StateExpression {
  all?: Predicate[];
  any?: Predicate[];
  not?: Predicate[];
}

export interface OutcomeEffect {
  type:
    | 'set-flag'
    | 'set-counter'
    | 'inc-counter'
    | 'unlock-scene'
    | 'grant-reward'
    | 'grant-favor'
    | 'set-escalation'
    | 'resource-delta'
    | 'apply-condition'
    | 'remove-condition'
    | 'start-combat';
  key?: string;
  value?: JsonValue;
  target?: EntityPointer;
  referenceId?: ID;
}

export interface CampaignContent {
  summaryBlocks: TextBlock[];
  gmNotes: TextBlock[];
}

export interface ChapterContent {
  summaryBlocks: TextBlock[];
  gmNotes: TextBlock[];
}

export interface SceneContent {
  summaryBlocks: TextBlock[];
  gmBlocks: TextBlock[];
  hiddenTruthBlocks: TextBlock[];
  noteBlocks: TextBlock[];
}

export interface NPCContent {
  canonicalSummary: TextBlock[];
  privateTruth: TextBlock[];
  portrayalDefaults: TextBlock[];
}

export interface LocationContent {
  publicSummary: TextBlock[];
  gmTruth: TextBlock[];
}

export interface Campaign extends BaseRecord {
  key: string;
  title: string;
  content: Layered<CampaignContent>;
  chapterOrder: ID[];
  pcIds: ID[];
  npcIds: ID[];
  factionIds: ID[];
  locationIds: ID[];
  activeSessionRunId?: ID;
  currentChapterId?: ID;
  defaultRuleMode: RuleMode;
}

export interface Chapter extends BaseRecord {
  campaignId: ID;
  key: string;
  title: string;
  order: number;
  content: Layered<ChapterContent>;
  sceneNodeIds: ID[];
  sceneEdgeIds: ID[];
  defaultStartSceneId?: ID;
  requiredBeatSceneIds: ID[];
  stateSchema: {
    flags: string[];
    counters: string[];
    customKeys: string[];
  };
  rewardIds: ID[];
  favorIds: ID[];
  sourceRefs: SourceRef[];
}

export interface SceneEdge extends BaseRecord {
  chapterId: ID;
  fromSceneId: ID;
  toSceneId: ID;
  kind: 'path' | 'unlock' | 'convergence' | 'fallback';
  label?: string;
  priority: number;
  when?: StateExpression;
}

export interface SceneNode extends BaseRecord {
  campaignId: ID;
  chapterId: ID;
  key: string;
  title: string;
  sceneKind: 'social' | 'investigation' | 'combat' | 'endeavor' | 'transition';
  board: { x: number; y: number; lane?: string };
  content: Layered<SceneContent>;
  passiveHookIds: ID[];
  activeHookIds: ID[];
  unlockWhen: StateExpression[];
  encounterSetupId?: ID;
  endeavorId?: ID;
  linkedNpcAppearanceIds: ID[];
  linkedAdversaryTemplateIds: ID[];
  linkedLocationIds: ID[];
  linkedRuleReferenceIds: ID[];
  outcomeIds: ID[];
  tags: string[];
  sourceRefs: SourceRef[];
}

export interface SceneState extends BaseRecord {
  sessionRunId: ID;
  chapterId: ID;
  sceneNodeId: ID;
  status: SceneNodeStatus;
  activatedAt?: ISODateTime;
  completedAt?: ISODateTime;
  skippedAt?: ISODateTime;
  localNotes: string[];
  chosenOutcomeIds: ID[];
  runtimeFlags: Record<string, boolean>;
  custom: Record<string, JsonValue>;
}

export interface Hook extends BaseRecord {
  chapterId: ID;
  sceneNodeId?: ID;
  mode: HookMode;
  title: string;
  prompt: string;
  revealWhen?: StateExpression;
  consumeWhen?: StateExpression;
  sourceRefs: SourceRef[];
}

export interface DurationSpec {
  unit: 'round' | 'turn' | 'scene' | 'chapter' | 'session' | 'custom';
  value?: number;
  endsWhen?: StateExpression;
}

export interface Condition extends BaseRecord {
  key: string;
  name: string;
  category: 'combat' | 'conversation' | 'endeavor' | 'environmental' | 'social';
  description: string;
  defaultDuration?: DurationSpec;
  stackMode: 'replace' | 'stack' | 'refresh';
  ruleReferenceIds: ID[];
}

export interface Outcome extends BaseRecord {
  chapterId: ID;
  sceneNodeId?: ID;
  key: string;
  title: string;
  summary: string;
  visibility: 'gm-only' | 'player-safe';
  effects: OutcomeEffect[];
  sourceRefs: SourceRef[];
}

export interface ProgressTrackDef {
  id: ID;
  key: string;
  label: string;
  min: number;
  max: number;
  successAt?: number;
  failureAt?: number;
}

export interface ObstacleApproach {
  id: ID;
  label: string;
  description: string;
  suggestedActionKeys?: string[];
  requirements?: StateExpression;
  linkedRuleReferenceIds: ID[];
  onSuccess: OutcomeEffect[];
  onMixed?: OutcomeEffect[];
  onFailure: OutcomeEffect[];
}

export interface Obstacle extends BaseRecord {
  endeavorId: ID;
  key: string;
  title: string;
  order?: number;
  required: boolean;
  summary: string;
  approaches: ObstacleApproach[];
  onEnter?: OutcomeEffect[];
  onBypass?: OutcomeEffect[];
}

export interface Endeavor extends BaseRecord {
  chapterId?: ID;
  sceneNodeId?: ID;
  key: string;
  title: string;
  kind: EndeavorKind;
  structure: 'ordered' | 'unordered' | 'hybrid';
  objective: string;
  content: Layered<{ gmGuidance: TextBlock[]; playerSummary?: TextBlock[] }>;
  obstacleIds: ID[];
  tracks: ProgressTrackDef[];
  successWhen: StateExpression;
  failureWhen?: StateExpression;
  consequenceOutcomeIds: ID[];
  linkedRuleReferenceIds: ID[];
}

export interface EncounterSlot {
  slotId: ID;
  role: 'frontline' | 'support' | 'elite' | 'hazard';
  adversaryTemplateId?: ID;
  npcAppearanceId?: ID;
  quantity: number;
}

export interface EncounterSetup extends BaseRecord {
  chapterId: ID;
  sceneNodeId?: ID;
  title: string;
  objective?: string;
  environmentNotes: string[];
  participantSlots: EncounterSlot[];
  rewardIds: ID[];
  linkedRuleReferenceIds: ID[];
}

export interface NPCRole extends BaseRecord {
  key: string;
  label: string;
  scope: 'campaign' | 'chapter' | 'scene';
  description: string;
}

export interface NPC extends BaseRecord {
  campaignId: ID;
  key: string;
  canonicalName: string;
  aliases: string[];
  factionIds: ID[];
  content: Layered<NPCContent>;
  campaignState: {
    statusTags: string[];
    resources: Record<string, number>;
    relationshipByPcId: Record<ID, { trust: number; notes?: string }>;
    historyEventIds: ID[];
  };
}

export interface NPCAppearance extends BaseRecord {
  npcId: ID;
  chapterId: ID;
  sceneNodeId?: ID;
  roleIds: ID[];
  aliasInScene?: string;
  stance?: 'hostile' | 'guarded' | 'neutral' | 'curious' | 'supportive';
  localGoal?: string;
  localSecrets: TextBlock[];
  portrayalOverride: TextBlock[];
  notes: TextBlock[];
  statePatch?: DeepPartial<NPC['campaignState']>;
}

export interface PC extends BaseRecord {
  campaignId: ID;
  playerName?: string;
  characterName: string;
  factionIds: ID[];
  resources: Record<string, number>;
  conditionIds: ID[];
  campaignNotes: TextBlock[];
  historyEventIds: ID[];
}

export interface Faction extends BaseRecord {
  campaignId: ID;
  name: string;
  summaryBlocks: TextBlock[];
  agenda: string[];
  memberNpcIds: ID[];
  relationshipByPcId: Record<ID, number>;
  locationIds: ID[];
}

export interface Location extends BaseRecord {
  campaignId: ID;
  key: string;
  name: string;
  kind: 'region' | 'settlement' | 'site' | 'room';
  parentLocationId?: ID;
  content: Layered<LocationContent>;
  tags: string[];
}

export interface RuleReference extends BaseRecord {
  key: string;
  title: string;
  category: 'combat' | 'conversation' | 'endeavor' | 'condition' | 'resource' | 'action';
  excerptBlocks: TextBlock[];
  parsedTerms: string[];
  sourceRefs: SourceRef[];
  formalizationStatus: 'candidate' | 'reviewed' | 'modeled';
}

export interface AdversaryTemplate extends BaseRecord {
  key: string;
  name: string;
  tier: string;
  resources: Record<string, number>;
  actionKeys: string[];
  traits: string[];
  defaultConditionKeys: string[];
  ruleReferenceIds: ID[];
}

export interface AppliedCondition {
  conditionId: ID;
  sourceEventId?: ID;
  startedAt: ISODateTime;
  endsAt?: ISODateTime;
  stacks?: number;
}

export interface CombatRuntimeParticipantState {
  entityKind: 'pc' | 'npc' | 'adversary';
  entityId: ID;
  appearanceId?: ID;
  nameSnapshot: string;
  initiativeGroup?: 'fast' | 'slow';
  resources: Record<string, number>;
  conditions: AppliedCondition[];
  notes?: string;
}

export interface RuntimeCombatInstance extends BaseRecord {
  sessionRunId: ID;
  chapterId: ID;
  sceneNodeId?: ID;
  encounterSetupId?: ID;
  status: EncounterStatus;
  roundNumber: number;
  activeParticipantId?: ID;
  participants: CombatRuntimeParticipantState[];
  actionEventIds: ID[];
  resolutionMode: RuleMode;
}

export interface Reward extends BaseRecord {
  chapterId?: ID;
  sceneNodeId?: ID;
  label: string;
  kind: 'item' | 'intel' | 'ally' | 'resource' | 'narrative';
  summary: string;
  effects: OutcomeEffect[];
}

export interface Favor extends BaseRecord {
  chapterId?: ID;
  sourceNpcId?: ID;
  label: string;
  summary: string;
  maxUses?: number;
  refreshPolicy: 'never' | 'chapter' | 'session';
  spendEffects: OutcomeEffect[];
}

export interface ChapterState extends BaseRecord {
  sessionRunId: ID;
  chapterId: ID;
  activeSceneId?: ID;
  flags: Record<string, boolean>;
  counters: Record<string, number>;
  escalation: number;
  favorUsesById: Record<ID, number>;
  custom: Record<string, JsonValue>;
  unlockedSceneIds: ID[];
  completedSceneIds: ID[];
  skippedSceneIds: ID[];
  rewardIds: ID[];
}

export interface SessionRun extends BaseRecord {
  campaignId: ID;
  label: string;
  startedAt: ISODateTime;
  endedAt?: ISODateTime;
  currentChapterId?: ID;
  activeSceneId?: ID;
  chapterStateIds: ID[];
  combatIds: ID[];
  quickNotes: TextBlock[];
  ruleMode: RuleMode;
}

export interface EventLogEntry {
  id: ID;
  sessionRunId: ID;
  occurredAt: ISODateTime;
  kind: EventKind;
  chapterId?: ID;
  sceneNodeId?: ID;
  actor?: EntityPointer;
  target?: EntityPointer;
  payload: Record<string, JsonValue>;
  ruleReferenceIds?: ID[];
}

export interface DiceRoll extends BaseRecord {
  sessionRunId: ID;
  combatId?: ID;
  sceneNodeId?: ID;
  actor?: EntityPointer;
  target?: EntityPointer;
  formula: string;
  rawDice: number[];
  modifier: number;
  total: number;
  outcome?: 'success' | 'failure' | 'criticalSuccess' | 'criticalFailure' | 'mixed';
  tags: string[];
  note?: string;
}

export interface SimulationDefinition extends BaseRecord {
  campaignId: ID;
  label: string;
  kind: 'encounter' | 'endeavor' | 'resource-burn';
  encounterSetupId?: ID;
  endeavorId?: ID;
  iterationCount: number;
  variableMatrix: Record<string, JsonValue[]>;
  assumptions: string[];
}

export interface SimulationResult extends BaseRecord {
  simulationDefinitionId: ID;
  generatedAt: ISODateTime;
  sampleSize: number;
  successRate: number;
  averageRounds?: number;
  averageResourceDelta?: Record<string, number>;
  distributions: Record<string, Array<{ bucket: string; count: number }>>;
  notes?: string;
}

export interface ResourceDefinition extends BaseRecord {
  key: string;
  label: string;
  min: number;
  max?: number;
  defaultValue?: number;
  warningAt?: number;
  ruleReferenceIds: ID[];
}

export interface RuleEffect {
  type: 'resource-delta' | 'apply-condition' | 'remove-condition' | 'progress-delta' | 'log-warning';
  resourceKey?: string;
  delta?: number;
  conditionId?: ID;
  trackKey?: string;
  message?: string;
}

export interface ActionDefinition extends BaseRecord {
  key: string;
  label: string;
  phase: 'combat' | 'conversation' | 'endeavor';
  actionType: 'action' | 'reaction' | 'free';
  requiresTarget: boolean;
  requiresRoll: boolean;
  defaultCosts: Record<string, number>;
  tags: string[];
  effects: RuleEffect[];
  ruleReferenceIds: ID[];
}

export interface ResolutionHook extends BaseRecord {
  key: string;
  when:
    | 'turn.start'
    | 'turn.end'
    | 'action.attempt'
    | 'action.resolve'
    | 'conversation.exchange'
    | 'condition.tick'
    | 'endeavor.approach.resolve';
  mode: 'suggest' | 'enforce';
  conditions: StateExpression[];
  messages: Array<{ severity: 'info' | 'warning' | 'error'; text: string }>;
  effects: RuleEffect[];
  ruleReferenceIds: ID[];
}

export interface ResolvedSceneNode extends SceneNode {
  resolvedContent: SceneContent;
  gmDiff: {
    changedBlocks: number;
    insertedBlocks: number;
    hiddenBlocks: number;
  };
  state: SceneState;
  isUnlocked: boolean;
}

export interface ResolvedNPCCard {
  npc: NPC;
  appearance?: NPCAppearance;
  resolvedSummaryBlocks: TextBlock[];
  resolvedPortrayalBlocks: TextBlock[];
}

export interface ResolvedChapterBoard {
  chapter: Chapter;
  chapterState: ChapterState;
  nodes: ResolvedSceneNode[];
  edges: SceneEdge[];
  availableSceneIds: ID[];
  activeSceneId?: ID;
}

export interface RuntimeResourceTarget {
  entity: EntityPointer;
  label: string;
  resources: Record<string, number>;
  conditions: AppliedCondition[];
}

export interface RuntimeCommandState {
  sessionRun: SessionRun;
  chapterState: ChapterState;
  activeSceneId?: ID;
  quickNotes: TextBlock[];
  favorUsage: Array<{ favor: Favor; remainingUses?: number; spentUses: number }>;
  resourceTargets: RuntimeResourceTarget[];
  recentDiceRolls: DiceRoll[];
  recentEvents: EventLogEntry[];
}

export interface CampaignConsoleData {
  campaign: Campaign;
  activeChapterId: ID;
  board: ResolvedChapterBoard;
  sceneIndex: Record<ID, ResolvedSceneNode>;
  npcCards: ResolvedNPCCard[];
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
  runtime: RuntimeCommandState;
}

export interface SceneStateMutationInput {
  sceneNodeId: ID;
  status: Extract<SceneNodeStatus, 'available' | 'active' | 'completed' | 'skipped'>;
}

export interface QuickNoteInput {
  text: string;
  sceneNodeId?: ID;
}

export interface ResourceAdjustmentInput {
  entity: EntityPointer;
  resourceKey: string;
  delta: number;
  note?: string;
}

export interface FavorAdjustmentInput {
  favorId: ID;
  delta: number;
  note?: string;
}

export interface ConditionMutationInput {
  entity: EntityPointer;
  conditionId: ID;
  operation: 'add' | 'remove';
  note?: string;
}

export interface DiceRollInput {
  sceneNodeId?: ID;
  actor?: EntityPointer;
  target?: EntityPointer;
  formula: string;
  rawDice: number[];
  modifier: number;
  total: number;
  outcome?: DiceRoll['outcome'];
  tags: string[];
  note?: string;
}

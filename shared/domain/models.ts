export type ParticipantSide = 'pc' | 'npc' | 'enemy' | 'ally';
export type RollCategory = 'attack' | 'skill' | 'defense' | 'recovery' | 'injury' | 'generic';
export type RollOutcome = 'success' | 'failure' | 'criticalSuccess' | 'criticalFailure' | 'neutral';
export type CombatStatus = 'planned' | 'active' | 'finished';
export type TurnType = 'fast' | 'slow';
export type ActionKind = 'action' | 'reaction' | 'free';
export type ConditionOperation = 'add' | 'remove';

export interface SessionEntity {
  id: string;
  title: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  partyMembers: PartyMember[];
  participantTemplates: ParticipantTemplate[];
}

export interface SessionSummary {
  id: string;
  title: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  partyMembers: PartyMember[];
  participantTemplates: ParticipantTemplate[];
  stageSceneCount: number;
  combatCount: number;
  rollCount: number;
}

export interface PartyMember {
  id: string;
  sessionId: string;
  name: string;
  side: ParticipantSide;
  role?: string;
  maxHealth?: number;
  maxFocus?: number;
  notes?: string;
  imagePath?: string;
}

export interface ParticipantTemplate {
  id: string;
  sessionId: string;
  name: string;
  side: ParticipantSide;
  role?: string;
  maxHealth?: number;
  maxFocus?: number;
  notes?: string;
  imagePath?: string;
}

export interface RollEvent {
  id: string;
  sessionId: string;
  combatId?: string;
  roundNumber?: number;
  turnId?: string;
  actorId?: string;
  actorName?: string;
  targetId?: string;
  targetName?: string;
  rollCategory: RollCategory;
  rawD20: number;
  modifier: number;
  total: number;
  advantageNote?: string;
  plotDie?: number;
  outcome: RollOutcome;
  note?: string;
  timestamp: string;
}

export interface ActionCatalogItem {
  key: string;
  name: string;
  type: ActionKind;
  defaultActionCost: number;
  defaultFocusCost: number;
  requiresTarget: boolean;
  requiresRoll: boolean;
  supportsDamage: boolean;
  tags: string[];
}

export interface CombatParticipantState {
  id: string;
  combatId: string;
  participantId: string;
  name: string;
  side: ParticipantSide;
  maxHealth?: number;
  currentHealth?: number;
  maxFocus?: number;
  currentFocus: number;
  conditions: string[];
}

export interface CombatTurn {
  id: string;
  combatId: string;
  roundId: string;
  participantId: string;
  turnType: TurnType;
  actionsAvailable: number;
  actionsUsed: number;
  reactionAvailable: boolean;
  reactionUsed: boolean;
  focusAtStart: number;
  focusAtEnd: number;
  damageDealt: number;
  damageTaken: number;
  startedAt?: string;
  endedAt?: string;
  notes?: string;
}

export interface CombatRound {
  id: string;
  combatId: string;
  roundNumber: number;
  fastPCIds: string[];
  fastNPCIds: string[];
  slowPCIds: string[];
  slowNPCIds: string[];
  turnIds: string[];
  createdAt: string;
}

export interface ActionEvent {
  id: string;
  combatId: string;
  roundId: string;
  turnId: string;
  actorId: string;
  actionType: string;
  targetIds: string[];
  actionCost: number;
  focusCost: number;
  linkedRollId?: string;
  hitResult?: 'hit' | 'miss' | 'crit' | 'support' | 'neutral';
  damageAmount?: number;
  note?: string;
  timestamp: string;
}

export interface DamageEvent {
  id: string;
  combatId: string;
  sourceParticipantId?: string;
  targetParticipantId: string;
  amount: number;
  damageType?: string;
  causedByActionEventId?: string;
  timestamp: string;
}

export interface FocusEvent {
  id: string;
  combatId: string;
  participantId: string;
  delta: number;
  reason: string;
  relatedActionEventId?: string;
  timestamp: string;
}

export interface ConditionEvent {
  id: string;
  combatId: string;
  participantId: string;
  conditionName: string;
  operation: ConditionOperation;
  note?: string;
  timestamp: string;
}

export interface CombatRecord {
  id: string;
  sessionId: string;
  title: string;
  status: CombatStatus;
  createdAt: string;
  startedAt?: string;
  endedAt?: string;
  notes?: string;
  participantIds: string[];
  currentRoundNumber: number;
  roundIds: string[];
  participants: CombatParticipantState[];
  rounds: CombatRound[];
  turns: CombatTurn[];
  actionEvents: ActionEvent[];
  damageEvents: DamageEvent[];
  focusEvents: FocusEvent[];
  conditionEvents: ConditionEvent[];
}

export interface StageScene {
  id: string;
  sessionId: string;
  title: string;
  backgroundImagePath: string;
  youtubeUrl?: string;
  gmNotes?: string;
  order: number;
  createdAt: string;
  updatedAt: string;
}

export interface LiveStageState {
  sessionId: string;
  liveSceneId: string | null;
  updatedAt: string;
}

export interface SessionDashboard {
  session: SessionSummary;
  recentRolls: RollEvent[];
  recentCombats: CombatRecord[];
}

export interface RollAnalytics {
  totalRolls: number;
  nat20Count: number;
  nat1Count: number;
  averageRawD20: number;
  attackAccuracy: number;
  luckDelta: number;
  rollsPerCharacter: Array<{
    actorName: string;
    count: number;
    averageRawD20: number;
    nat20Count: number;
    nat1Count: number;
  }>;
}

export interface CombatSummary {
  combat: CombatRecord;
  rows: CombatSummaryRow[];
  fullLog: Array<ActionEvent | DamageEvent | FocusEvent | ConditionEvent>;
}

export interface CombatSummaryRow {
  participantId: string;
  name: string;
  side: ParticipantSide;
  totalDamageDealt: number;
  totalDamageTaken: number;
  hitCount: number;
  missCount: number;
  hitRate: number;
  critCount: number;
  nat20Count: number;
  nat1Count: number;
  focusSpent: number;
  supportActionsUsed: number;
  reactionsUsed: number;
  biggestHit: number;
}

export interface CreateSessionInput {
  title: string;
  notes?: string;
  partyMembers?: Array<Omit<PartyMember, 'id' | 'sessionId'>>;
  participantTemplates?: Array<Omit<ParticipantTemplate, 'id' | 'sessionId'>>;
}

export interface UpdateSessionInput {
  title?: string;
  notes?: string;
  partyMembers?: PartyMember[];
  participantTemplates?: ParticipantTemplate[];
}

export interface CreateRollInput {
  combatId?: string;
  roundNumber?: number;
  turnId?: string;
  actorId?: string;
  actorName?: string;
  targetId?: string;
  targetName?: string;
  rollCategory: RollCategory;
  rawD20: number;
  modifier: number;
  advantageNote?: string;
  plotDie?: number;
  outcome?: RollOutcome;
  note?: string;
}

export interface CreateCombatInput {
  title: string;
  notes?: string;
  participants: Array<{
    participantId: string;
    name: string;
    side: ParticipantSide;
    maxHealth?: number;
    currentHealth?: number;
    maxFocus?: number;
    currentFocus?: number;
  }>;
  initialRound?: {
    fastPCIds: string[];
    fastNPCIds: string[];
    slowPCIds: string[];
    slowNPCIds: string[];
  };
}

export interface CreateRoundInput {
  fastPCIds: string[];
  fastNPCIds: string[];
  slowPCIds: string[];
  slowNPCIds: string[];
}

export interface UpdateTurnInput {
  actionsUsed?: number;
  reactionUsed?: boolean;
  focusAtEnd?: number;
  damageDealt?: number;
  damageTaken?: number;
  startedAt?: string;
  endedAt?: string;
  notes?: string;
}

export interface CreateActionEventInput {
  roundId: string;
  turnId: string;
  actorId: string;
  actionType: string;
  targetIds: string[];
  actionCost: number;
  focusCost: number;
  hitResult?: 'hit' | 'miss' | 'crit' | 'support' | 'neutral';
  damageAmount?: number;
  note?: string;
  linkedRoll?: CreateRollInput;
}

export interface CreateDamageEventInput {
  sourceParticipantId?: string;
  targetParticipantId: string;
  amount: number;
  damageType?: string;
  causedByActionEventId?: string;
}

export interface CreateFocusEventInput {
  participantId: string;
  delta: number;
  reason: string;
  relatedActionEventId?: string;
}

export interface CreateConditionEventInput {
  participantId: string;
  conditionName: string;
  operation: ConditionOperation;
  note?: string;
}

export const ACTION_CATALOG: ActionCatalogItem[] = [
  { key: 'strike', name: 'Strike', type: 'action', defaultActionCost: 1, defaultFocusCost: 0, requiresTarget: true, requiresRoll: true, supportsDamage: true, tags: ['attack'] },
  { key: 'move', name: 'Move', type: 'action', defaultActionCost: 1, defaultFocusCost: 0, requiresTarget: false, requiresRoll: false, supportsDamage: false, tags: ['movement'] },
  { key: 'brace', name: 'Brace', type: 'action', defaultActionCost: 1, defaultFocusCost: 0, requiresTarget: false, requiresRoll: false, supportsDamage: false, tags: ['defense'] },
  { key: 'disengage', name: 'Disengage', type: 'action', defaultActionCost: 1, defaultFocusCost: 0, requiresTarget: false, requiresRoll: false, supportsDamage: false, tags: ['movement'] },
  { key: 'gain-advantage', name: 'Gain Advantage', type: 'action', defaultActionCost: 1, defaultFocusCost: 0, requiresTarget: false, requiresRoll: false, supportsDamage: false, tags: ['setup'] },
  { key: 'interact-skill', name: 'Interact / Use Skill', type: 'action', defaultActionCost: 1, defaultFocusCost: 0, requiresTarget: false, requiresRoll: true, supportsDamage: false, tags: ['utility'] },
  { key: 'grapple', name: 'Grapple', type: 'action', defaultActionCost: 1, defaultFocusCost: 0, requiresTarget: true, requiresRoll: true, supportsDamage: false, tags: ['control'] },
  { key: 'ready', name: 'Ready', type: 'action', defaultActionCost: 1, defaultFocusCost: 0, requiresTarget: false, requiresRoll: false, supportsDamage: false, tags: ['setup'] },
  { key: 'recover', name: 'Recover', type: 'action', defaultActionCost: 1, defaultFocusCost: 0, requiresTarget: false, requiresRoll: false, supportsDamage: false, tags: ['recovery'] },
  { key: 'shove', name: 'Shove', type: 'action', defaultActionCost: 1, defaultFocusCost: 0, requiresTarget: true, requiresRoll: true, supportsDamage: false, tags: ['control'] },
  { key: 'aid', name: 'Aid', type: 'action', defaultActionCost: 1, defaultFocusCost: 0, requiresTarget: true, requiresRoll: false, supportsDamage: false, tags: ['support'] },
  { key: 'dodge', name: 'Dodge', type: 'action', defaultActionCost: 1, defaultFocusCost: 0, requiresTarget: false, requiresRoll: false, supportsDamage: false, tags: ['defense'] },
  { key: 'reactive-strike', name: 'Reactive Strike', type: 'reaction', defaultActionCost: 0, defaultFocusCost: 0, requiresTarget: true, requiresRoll: true, supportsDamage: true, tags: ['reaction', 'attack'] },
  { key: 'avoid-danger', name: 'Avoid Danger', type: 'reaction', defaultActionCost: 0, defaultFocusCost: 0, requiresTarget: false, requiresRoll: true, supportsDamage: false, tags: ['reaction', 'defense'] },
  { key: 'custom', name: 'Custom', type: 'action', defaultActionCost: 1, defaultFocusCost: 0, requiresTarget: false, requiresRoll: false, supportsDamage: false, tags: ['custom'] },
];

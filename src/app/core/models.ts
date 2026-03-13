export type Side = 'party' | 'enemy';

export type EventType =
  | 'attack-roll'
  | 'damage'
  | 'healing'
  | 'saving-throw'
  | 'support'
  | 'utility'
  | 'kill'
  | 'death'
  | 'condition'
  | 'note';

export type EventOutcome = 'hit' | 'miss' | 'crit' | 'success' | 'failure';

export type BuiltInSupportTag =
  | 'heal'
  | 'buff'
  | 'debuff'
  | 'crowd-control'
  | 'setup'
  | 'save'
  | 'utility';

export type SupportTag = BuiltInSupportTag | string;

export interface AppSettings {
  activeRosterId?: string;
  customSupportTags: string[];
  preferredRoundTracking: boolean;
  exportFileNamePrefix: string;
}

export interface AppData {
  schemaVersion: 1;
  rosters: Roster[];
  sessions: SessionRecord[];
  settings: AppSettings;
}

export interface Roster {
  id: string;
  name: string;
  partyTemplates: CombatantTemplate[];
  enemyTemplates: CombatantTemplate[];
  createdAt: string;
  updatedAt: string;
}

export interface CombatantTemplate {
  id: string;
  name: string;
  side: Side;
  role?: string;
  color?: string;
  notes?: string;
}

export interface SessionRecord {
  id: string;
  rosterId?: string;
  campaignName: string;
  sessionName: string;
  playedOn: string;
  party: CombatantInstance[];
  fights: FightRecord[];
  notes?: string;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface FightRecord {
  id: string;
  sessionId: string;
  name: string;
  order: number;
  startedAt?: string;
  endedAt?: string;
  roundTrackingEnabled: boolean;
  combatants: CombatantInstance[];
  events: CombatEvent[];
  notes?: string;
}

export interface CombatantInstance {
  id: string;
  templateId?: string;
  name: string;
  side: Side;
  role?: string;
  color?: string;
  active: boolean;
}

export interface CombatEvent {
  id: string;
  fightId: string;
  timestamp: string;
  round?: number;
  actorId: string;
  targetIds: string[];
  type: EventType;
  diceFormula?: string;
  rollTotal?: number;
  modifier?: number;
  outcome?: EventOutcome;
  amount?: number;
  damageType?: string;
  supportTags?: SupportTag[];
  note?: string;
}

export interface SessionDraft {
  campaignName: string;
  sessionName: string;
  playedOn: string;
  rosterId?: string;
  party: CombatantInstance[];
  notes?: string;
}

export interface FightDraft {
  name: string;
  roundTrackingEnabled: boolean;
  enemies: CombatantInstance[];
  notes?: string;
}

export interface CombatEventDraft {
  round?: number;
  actorId: string;
  targetIds: string[];
  type: EventType;
  diceFormula?: string;
  rollTotal?: number;
  modifier?: number;
  outcome?: EventOutcome;
  amount?: number;
  damageType?: string;
  supportTags?: SupportTag[];
  note?: string;
}

export interface ActorSummary {
  actorId: string;
  name: string;
  side: Side;
  role?: string;
  color?: string;
  kills: number;
  deaths: number;
  assists: number;
  supportActions: number;
  damageDealt: number;
  damageTaken: number;
  healingDone: number;
  rollCount: number;
  critCount: number;
  hitAttempts: number;
  hits: number;
  accuracy: number;
  saveSuccesses: number;
  saveFailures: number;
  tagCounts: Record<string, number>;
  badges: string[];
}

export interface FightSummary {
  fight: FightRecord;
  timeline: CombatEvent[];
  party: ActorSummary[];
  enemies: ActorSummary[];
}

export interface SessionSummary {
  session: SessionRecord;
  party: ActorSummary[];
  enemies: ActorSummary[];
  fights: FightSummary[];
}

export interface AnalyticsPoint {
  key: string;
  label: string;
  side: Side;
  value: number;
}

export interface AnalyticsBundle {
  damageDealt: AnalyticsPoint[];
  damageTaken: AnalyticsPoint[];
  kills: AnalyticsPoint[];
  supportActions: AnalyticsPoint[];
  rollVolume: AnalyticsPoint[];
  accuracy: AnalyticsPoint[];
  crits: AnalyticsPoint[];
}

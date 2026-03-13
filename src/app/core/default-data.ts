import {
  AppData,
  CombatantInstance,
  CombatantTemplate,
  FightRecord,
  Roster,
  SessionRecord,
} from './models';

const PARTY_COLORS = ['#10b981', '#f59e0b', '#38bdf8'];
const ENEMY_COLORS = ['#f97316', '#ef4444', '#fb7185'];

export const STORAGE_KEY = 'cosmere-combat-tracker.app-data';
export const BUILT_IN_SUPPORT_TAGS = [
  'heal',
  'buff',
  'debuff',
  'crowd-control',
  'setup',
  'save',
  'utility',
];

export function createId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}-${Date.now().toString(36)}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}

function makeTemplate(
  name: string,
  side: 'party' | 'enemy',
  color: string,
  role?: string,
): CombatantTemplate {
  return {
    id: createId('template'),
    name,
    side,
    role,
    color,
  };
}

function makePartyFromTemplates(templates: CombatantTemplate[]): CombatantInstance[] {
  return templates.map((template) => ({
    id: createId('actor'),
    templateId: template.id,
    name: template.name,
    side: template.side,
    role: template.role,
    color: template.color,
    active: true,
  }));
}

export function createDefaultRoster(): Roster {
  const createdAt = nowIso();
  const partyTemplates = [
    makeTemplate('Hero 1', 'party', PARTY_COLORS[0], 'Frontline'),
    makeTemplate('Hero 2', 'party', PARTY_COLORS[1], 'Support'),
    makeTemplate('Hero 3', 'party', PARTY_COLORS[2], 'Caster'),
  ];
  const enemyTemplates = [
    makeTemplate('Cultist', 'enemy', ENEMY_COLORS[0], 'Skirmisher'),
    makeTemplate('Fused', 'enemy', ENEMY_COLORS[1], 'Elite'),
    makeTemplate('Voidbringer', 'enemy', ENEMY_COLORS[2], 'Bruiser'),
  ];

  return {
    id: createId('roster'),
    name: 'Default Campaign Roster',
    partyTemplates,
    enemyTemplates,
    createdAt,
    updatedAt: createdAt,
  };
}

export function createSessionFromRoster(roster: Roster): SessionRecord {
  const createdAt = nowIso();
  const party = makePartyFromTemplates(roster.partyTemplates);

  return {
    id: createId('session'),
    rosterId: roster.id,
    campaignName: 'Cosmere Campaign',
    sessionName: `Session ${new Date().toLocaleDateString()}`,
    playedOn: new Date().toISOString().slice(0, 10),
    party,
    fights: [],
    notes: '',
    archived: false,
    createdAt,
    updatedAt: createdAt,
  };
}

export function createFightRecord(
  sessionId: string,
  order: number,
  party: CombatantInstance[],
): FightRecord {
  return {
    id: createId('fight'),
    sessionId,
    name: `Fight ${order}`,
    order,
    roundTrackingEnabled: true,
    combatants: party.map((member) => ({ ...member })),
    events: [],
    notes: '',
  };
}

export function createInitialData(): AppData {
  const roster = createDefaultRoster();
  const starterSession = createSessionFromRoster(roster);
  starterSession.fights = [createFightRecord(starterSession.id, 1, starterSession.party)];

  return {
    schemaVersion: 1,
    rosters: [roster],
    sessions: [starterSession],
    settings: {
      activeRosterId: roster.id,
      customSupportTags: [],
      preferredRoundTracking: true,
      exportFileNamePrefix: 'cosmere-combat-tracker',
    },
  };
}

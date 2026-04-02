import type { JsonValue } from './campaign-models';

export type StatFacet = 'physical' | 'cognitive' | 'spiritual' | 'general';
export type StatisticGroup = 'attribute' | 'defense' | 'derived';
export type StatisticValueType = 'number' | 'distance' | 'weight' | 'die' | 'duration';
export type CharacterResourceKey = 'health' | 'focus' | 'investiture';
export type CharacterAttributeKey = 'strength' | 'speed' | 'intellect' | 'willpower' | 'awareness' | 'presence';
export type CharacterDefenseKey = 'physical-defense' | 'cognitive-defense' | 'spiritual-defense';
export type CharacterDerivedKey =
  | 'deflect'
  | 'movement-rate'
  | 'lifting-capacity'
  | 'carrying-capacity'
  | 'recovery-die'
  | 'senses-range'
  | 'established-connections';
export type CharacterExpertiseCategory = 'armor' | 'cultural' | 'utility' | 'weapon' | 'specialist';
export type SkillModifierFacet = Exclude<StatFacet, 'general'>;

export interface CharacterExpertise {
  id: string;
  name: string;
  category: CharacterExpertiseCategory;
}

export interface CharacterStatSheet {
  attributeScores: Record<string, number>;
  skillRanks: Record<string, number>;
  expertises: CharacterExpertise[];
  resourceBonuses: Partial<Record<CharacterResourceKey, number>>;
  resourceOverrides: Partial<Record<CharacterResourceKey, number>>;
  defenseBonuses: Partial<Record<CharacterDefenseKey, number>>;
  derivedOverrides: Partial<Record<CharacterDerivedKey, JsonValue>>;
}

export interface CharacterSkillDefinition {
  key: string;
  label: string;
  attributeKey: CharacterAttributeKey;
  facet: SkillModifierFacet;
  summary: string;
  relevantTasks: string[];
  specialRules: string[];
  gainAdvantageExamples: string[];
}

export interface CharacterStatisticTableRow {
  min: number;
  max?: number;
  outputs: Record<string, JsonValue>;
}

export interface CharacterStatisticTableTemplate {
  key: string;
  label: string;
  sourceStatisticKey: CharacterAttributeKey;
  outputKeys: CharacterDerivedKey[];
  rows: CharacterStatisticTableRow[];
}

export interface CharacterStatisticTemplate {
  key: CharacterAttributeKey | CharacterDefenseKey | CharacterDerivedKey;
  label: string;
  group: StatisticGroup;
  facet: StatFacet;
  valueType: StatisticValueType;
  summary: string;
  calculation:
    | { kind: 'formula'; expression: string }
    | { kind: 'lookup'; tableKey: string; sourceKey: CharacterAttributeKey }
    | { kind: 'manual' };
}

export interface ComputedCharacterStatSheet {
  resources: Record<CharacterResourceKey, number>;
  defenses: Record<CharacterDefenseKey, number>;
  skillModifiers: Record<string, number>;
  derived: Record<CharacterDerivedKey, JsonValue>;
}

const ZERO = 0;
const BASE_HEALTH = 10;
const BASE_FOCUS = 2;
const BASE_INVESTITURE = 2;
const BASE_DEFENSE = 10;
const DEFAULT_DEFLECT = 0;
const TABLE_ROW_OPEN_MAX = 999;

export const CHARACTER_RESOURCE_KEYS = ['health', 'focus', 'investiture'] as const satisfies readonly CharacterResourceKey[];
export const CHARACTER_ATTRIBUTE_KEYS = [
  'strength',
  'speed',
  'intellect',
  'willpower',
  'awareness',
  'presence',
] as const satisfies readonly CharacterAttributeKey[];
export const CHARACTER_DEFENSE_KEYS = [
  'physical-defense',
  'cognitive-defense',
  'spiritual-defense',
] as const satisfies readonly CharacterDefenseKey[];
export const CHARACTER_DERIVED_KEYS = [
  'deflect',
  'movement-rate',
  'lifting-capacity',
  'carrying-capacity',
  'recovery-die',
  'senses-range',
  'established-connections',
] as const satisfies readonly CharacterDerivedKey[];
export const CHARACTER_EXPERTISE_CATEGORIES = [
  'armor',
  'cultural',
  'utility',
  'weapon',
  'specialist',
] as const satisfies readonly CharacterExpertiseCategory[];

export const CHARACTER_ATTRIBUTE_METADATA: ReadonlyArray<{
  key: CharacterAttributeKey;
  label: string;
  facet: SkillModifierFacet;
  summary: string;
}> = [
  { key: 'strength', label: 'Strength', facet: 'physical', summary: 'Physical power, toughness, and athleticism.' },
  { key: 'speed', label: 'Speed', facet: 'physical', summary: 'Quickness, finesse, and maneuverability.' },
  { key: 'intellect', label: 'Intellect', facet: 'cognitive', summary: 'Applied intelligence, wit, and deduction.' },
  { key: 'willpower', label: 'Willpower', facet: 'cognitive', summary: 'Mental fortitude, determination, and resilience.' },
  { key: 'awareness', label: 'Awareness', facet: 'spiritual', summary: 'Wisdom, intuition, and connection to the world.' },
  { key: 'presence', label: 'Presence', facet: 'spiritual', summary: 'Charisma, bearing, and ability to influence others.' },
];

export const CHARACTER_STATISTIC_TEMPLATES: ReadonlyArray<CharacterStatisticTemplate> = [
  ...CHARACTER_ATTRIBUTE_METADATA.map((attribute) => ({
    key: attribute.key,
    label: attribute.label,
    group: 'attribute' as const,
    facet: attribute.facet,
    valueType: 'number' as const,
    summary: attribute.summary,
    calculation: { kind: 'manual' as const },
  })),
  {
    key: 'physical-defense',
    label: 'Physical Defense',
    group: 'defense',
    facet: 'physical',
    valueType: 'number',
    summary: 'Protects against physical tests and attacks.',
    calculation: { kind: 'formula', expression: '10 + strength + speed + defense bonus' },
  },
  {
    key: 'cognitive-defense',
    label: 'Cognitive Defense',
    group: 'defense',
    facet: 'cognitive',
    valueType: 'number',
    summary: 'Protects against cognitive tests and influence.',
    calculation: { kind: 'formula', expression: '10 + intellect + willpower + defense bonus' },
  },
  {
    key: 'spiritual-defense',
    label: 'Spiritual Defense',
    group: 'defense',
    facet: 'spiritual',
    valueType: 'number',
    summary: 'Protects against spiritual tests and influence.',
    calculation: { kind: 'formula', expression: '10 + awareness + presence + defense bonus' },
  },
  {
    key: 'deflect',
    label: 'Deflect',
    group: 'derived',
    facet: 'general',
    valueType: 'number',
    summary: 'Reduces incoming impact, keen, and energy damage.',
    calculation: { kind: 'manual' },
  },
  {
    key: 'movement-rate',
    label: 'Movement Rate',
    group: 'derived',
    facet: 'physical',
    valueType: 'distance',
    summary: 'Distance you can move per action.',
    calculation: { kind: 'lookup', tableKey: 'speed-movement', sourceKey: 'speed' },
  },
  {
    key: 'lifting-capacity',
    label: 'Lifting Capacity',
    group: 'derived',
    facet: 'physical',
    valueType: 'weight',
    summary: 'Maximum weight you can lift in a single attempt.',
    calculation: { kind: 'lookup', tableKey: 'strength-lifting-carrying', sourceKey: 'strength' },
  },
  {
    key: 'carrying-capacity',
    label: 'Carrying Capacity',
    group: 'derived',
    facet: 'physical',
    valueType: 'weight',
    summary: 'Weight you can comfortably carry while walking.',
    calculation: { kind: 'lookup', tableKey: 'strength-lifting-carrying', sourceKey: 'strength' },
  },
  {
    key: 'recovery-die',
    label: 'Recovery Die',
    group: 'derived',
    facet: 'cognitive',
    valueType: 'die',
    summary: 'Die size used to recover during rests.',
    calculation: { kind: 'lookup', tableKey: 'willpower-recovery-die', sourceKey: 'willpower' },
  },
  {
    key: 'senses-range',
    label: 'Senses Range',
    group: 'derived',
    facet: 'spiritual',
    valueType: 'distance',
    summary: 'Range at which you can sense while your primary sense is obscured.',
    calculation: { kind: 'lookup', tableKey: 'awareness-senses-range', sourceKey: 'awareness' },
  },
  {
    key: 'established-connections',
    label: 'Established Connections',
    group: 'derived',
    facet: 'spiritual',
    valueType: 'duration',
    summary: 'Guidance for how quickly your character establishes local connections.',
    calculation: { kind: 'lookup', tableKey: 'presence-connections', sourceKey: 'presence' },
  },
] satisfies ReadonlyArray<CharacterStatisticTemplate>;

export const CHARACTER_STATISTIC_TABLES: ReadonlyArray<CharacterStatisticTableTemplate> = [
  {
    key: 'strength-lifting-carrying',
    label: 'Lifting and Carrying Capacity',
    sourceStatisticKey: 'strength',
    outputKeys: ['lifting-capacity', 'carrying-capacity'],
    rows: [
      { min: 0, max: 0, outputs: { 'lifting-capacity': '100 lb.', 'carrying-capacity': '50 lb.' } },
      { min: 1, max: 2, outputs: { 'lifting-capacity': '200 lb.', 'carrying-capacity': '100 lb.' } },
      { min: 3, max: 4, outputs: { 'lifting-capacity': '500 lb.', 'carrying-capacity': '250 lb.' } },
      { min: 5, max: 6, outputs: { 'lifting-capacity': '1,000 lb.', 'carrying-capacity': '500 lb.' } },
      { min: 7, max: 8, outputs: { 'lifting-capacity': '5,000 lb.', 'carrying-capacity': '2,500 lb.' } },
      { min: 9, outputs: { 'lifting-capacity': '10,000 lb.', 'carrying-capacity': '5,000 lb.' } },
    ],
  },
  {
    key: 'speed-movement',
    label: 'Movement Rate',
    sourceStatisticKey: 'speed',
    outputKeys: ['movement-rate'],
    rows: [
      { min: 0, max: 0, outputs: { 'movement-rate': '20 feet per action' } },
      { min: 1, max: 2, outputs: { 'movement-rate': '25 feet per action' } },
      { min: 3, max: 4, outputs: { 'movement-rate': '30 feet per action' } },
      { min: 5, max: 6, outputs: { 'movement-rate': '40 feet per action' } },
      { min: 7, max: 8, outputs: { 'movement-rate': '60 feet per action' } },
      { min: 9, outputs: { 'movement-rate': '80 feet per action' } },
    ],
  },
  {
    key: 'willpower-recovery-die',
    label: 'Recovery Die',
    sourceStatisticKey: 'willpower',
    outputKeys: ['recovery-die'],
    rows: [
      { min: 0, max: 0, outputs: { 'recovery-die': '1d4' } },
      { min: 1, max: 2, outputs: { 'recovery-die': '1d6' } },
      { min: 3, max: 4, outputs: { 'recovery-die': '1d8' } },
      { min: 5, max: 6, outputs: { 'recovery-die': '1d10' } },
      { min: 7, max: 8, outputs: { 'recovery-die': '1d12' } },
      { min: 9, outputs: { 'recovery-die': '1d20' } },
    ],
  },
  {
    key: 'awareness-senses-range',
    label: 'Senses Range',
    sourceStatisticKey: 'awareness',
    outputKeys: ['senses-range'],
    rows: [
      { min: 0, max: 0, outputs: { 'senses-range': '5 ft.' } },
      { min: 1, max: 2, outputs: { 'senses-range': '10 ft.' } },
      { min: 3, max: 4, outputs: { 'senses-range': '20 ft.' } },
      { min: 5, max: 6, outputs: { 'senses-range': '50 ft.' } },
      { min: 7, max: 8, outputs: { 'senses-range': '100 ft.' } },
      { min: 9, outputs: { 'senses-range': 'Unaffected by obscured senses' } },
    ],
  },
  {
    key: 'presence-connections',
    label: 'Establishing Connections',
    sourceStatisticKey: 'presence',
    outputKeys: ['established-connections'],
    rows: [
      { min: 0, max: 0, outputs: { 'established-connections': '1 year' } },
      { min: 1, max: 2, outputs: { 'established-connections': '50 days' } },
      { min: 3, max: 4, outputs: { 'established-connections': '5 days' } },
      { min: 5, max: 6, outputs: { 'established-connections': '1 day' } },
      { min: 7, max: 8, outputs: { 'established-connections': '1 hour' } },
      { min: 9, outputs: { 'established-connections': 'Your reputation precedes you.' } },
    ],
  },
] satisfies ReadonlyArray<CharacterStatisticTableTemplate>;

export const CHARACTER_SKILL_DEFINITIONS: ReadonlyArray<CharacterSkillDefinition> = [
  {
    key: 'agility',
    label: 'Agility',
    attributeKey: 'speed',
    facet: 'physical',
    summary: 'Maneuvering through the environment with reflexes, mobility, and precision.',
    relevantTasks: ['Acrobatics', 'riding', 'pilot vehicles', 'maneuvering through hazards'],
    specialRules: ['Use for acrobatic movement and vehicle piloting when reflexes or maneuverability matter.'],
    gainAdvantageExamples: ['Roll to attack from an unexpected angle', 'throw an opponent off-balance', 'slip inside a guard'],
  },
  {
    key: 'athletics',
    label: 'Athletics',
    attributeKey: 'strength',
    facet: 'physical',
    summary: 'Physical prowess, endurance, and feats of strength.',
    relevantTasks: ['Lift', 'push', 'climb', 'jump', 'pull', 'unarmed attacks'],
    specialRules: ['Longer jumps require an Athletics test; unarmed attacks use Athletics.'],
    gainAdvantageExamples: ['Leap onto a foe', 'seize an enemy shield', 'flex to shake resolve'],
  },
  {
    key: 'crafting',
    label: 'Crafting',
    attributeKey: 'intellect',
    facet: 'cognitive',
    summary: 'Designing and building physical objects with ingenuity and available tools.',
    relevantTasks: ['Build simple machines', 'repair items', 'craft impromptu tools', 'improvise traps'],
    specialRules: ['Complex items require the corresponding expertise to craft.'],
    gainAdvantageExamples: ['Make a powderbomb', 'alter a weapon trajectory', 'flash light into someone’s eyes'],
  },
  {
    key: 'deception',
    label: 'Deception',
    attributeKey: 'presence',
    facet: 'spiritual',
    summary: 'Misleading others with lies, insinuation, omission, or misleading behavior.',
    relevantTasks: ['Lie', 'deflect suspicion', 'falsify evidence', 'mislead body language'],
    specialRules: ['Long-distance deception is usually made with a disadvantage when the target cannot sense you.'],
    gainAdvantageExamples: ['Fake an attack line', 'wear an enemy uniform', 'rattle a foe with a lie'],
  },
  {
    key: 'deduction',
    label: 'Deduction',
    attributeKey: 'intellect',
    facet: 'cognitive',
    summary: 'Interpreting evidence through logic and reason.',
    relevantTasks: ['Connect clues', 'infer motives', 'analyze a scene', 'reason through uncertainty'],
    specialRules: ['Useful for complex inference when evidence must be assembled into a conclusion.'],
    gainAdvantageExamples: ['Infer a weakness', 'discern true motives', 'identify the most useful asset'],
  },
  {
    key: 'discipline',
    label: 'Discipline',
    attributeKey: 'willpower',
    facet: 'cognitive',
    summary: 'Controlling outward reactions and steadying yourself under duress.',
    relevantTasks: ['Resist fear', 'maintain composure', 'steel nerves', 'overcome distraction'],
    specialRules: ['Can be used reactively to avoid or later overcome unwanted effects.'],
    gainAdvantageExamples: ['Wait for the perfect moment', 'hold firm under pressure', 'march into danger without fear'],
  },
  {
    key: 'heavy-weaponry',
    label: 'Heavy Weaponry',
    attributeKey: 'strength',
    facet: 'physical',
    summary: 'Wielding devastating heavy weapons such as axes, hammers, and most Shardblades.',
    relevantTasks: ['Attack with heavy weapons', 'lead weapon drills', 'use a heavy weapon creatively'],
    specialRules: ['Heavy weapons trade maneuverability for reach and heft.'],
    gainAdvantageExamples: ['Wind up a dangerous swing', 'dramatically draw a heavy weapon', 'perform a practiced kata'],
  },
  {
    key: 'insight',
    label: 'Insight',
    attributeKey: 'awareness',
    facet: 'spiritual',
    summary: 'Reading emotions, motives, and hidden truths in others.',
    relevantTasks: ['Discern feelings', 'see through deception', 'sense when something is off'],
    specialRules: ['Represents social instinct and emotional intelligence.'],
    gainAdvantageExamples: ['Provoke a revealing response', 'follow a hunch', 'appeal to a conflicting desire'],
  },
  {
    key: 'intimidation',
    label: 'Intimidation',
    attributeKey: 'willpower',
    facet: 'cognitive',
    summary: 'Inducing fear or compliance through threats and dominance.',
    relevantTasks: ['Threaten', 'project dominance', 'cow opposition', 'coerce through fear'],
    specialRules: ['Preposterous bluffs can impose a disadvantage on Intimidation tests.'],
    gainAdvantageExamples: ['Use contentious rhythms', 'mock the enemy', 'display signs of the Thrill'],
  },
  {
    key: 'leadership',
    label: 'Leadership',
    attributeKey: 'presence',
    facet: 'spiritual',
    summary: 'Inspiring people, taking command, and directing allies.',
    relevantTasks: ['Inspire', 'command', 'delegate', 'manage a crowd', 'bait an enemy'],
    specialRules: ['Leadership appeals to ideals and control; Persuasion appeals to logic or self-interest.'],
    gainAdvantageExamples: ['Challenge a foe to a duel', 'call allies to cover', 'ask a companion to help'],
  },
  {
    key: 'light-weaponry',
    label: 'Light Weaponry',
    attributeKey: 'speed',
    facet: 'physical',
    summary: 'Using quick, subtle, and precise armaments with finesse.',
    relevantTasks: ['Attack with knives', 'use bows', 'fight with short swords', 'perform feints'],
    specialRules: ['Light weapons emphasize precision and subtlety over heft.'],
    gainAdvantageExamples: ['Use an intricate flourish', 'call attention to a concealed weapon', 'throw a weapon as a distraction'],
  },
  {
    key: 'lore',
    label: 'Lore',
    attributeKey: 'intellect',
    facet: 'cognitive',
    summary: 'Recalling history, current events, folklore, religions, places, and science.',
    relevantTasks: ['Recall facts', 'identify cultural context', 'understand folklore', 'apply known science'],
    specialRules: ['Relevant expertises can remove the need for a test on basic information or unlock deeper questions.'],
    gainAdvantageExamples: ['Expose contradictions with beliefs', 'recall weaknesses', 'recognize useful properties'],
  },
  {
    key: 'medicine',
    label: 'Medicine',
    attributeKey: 'intellect',
    facet: 'cognitive',
    summary: 'Healing, diagnosis, and practical anatomy or surgery.',
    relevantTasks: ['Diagnose', 'treat wounds', 'support illness recovery', 'determine cause of death'],
    specialRules: [
      'In combat, a character with at least one rank can spend 2 focus and Use a Skill for a DC 15 Medicine test to treat an ally.',
      'During a long rest, Medicine can reduce an injury duration on a DC 20 test.',
    ],
    gainAdvantageExamples: ['Exploit a previous injury', 'think of a specific medicine', 'alleviate an ally’s pain'],
  },
  {
    key: 'perception',
    label: 'Perception',
    attributeKey: 'awareness',
    facet: 'spiritual',
    summary: 'Noticing details, searching, and recognizing things in the environment.',
    relevantTasks: ['Search', 'spot hidden objects', 'notice details', 'recognize described things'],
    specialRules: ['All characters test Perception in the same way regardless of which senses they access.'],
    gainAdvantageExamples: ['Spot something useful nearby', 'gauge exact distance', 'observe a weakness in stance'],
  },
  {
    key: 'persuasion',
    label: 'Persuasion',
    attributeKey: 'presence',
    facet: 'spiritual',
    summary: 'Negotiating, debating, and appealing to trust or self-interest.',
    relevantTasks: ['Barter', 'reason', 'appeal to self-interest', 'seek agreement'],
    specialRules: ['Attitudes can change the DC significantly when you already have rapport or friction.'],
    gainAdvantageExamples: ['Negotiate duel terms', 'distract with banter', 'make a genuine offer of peace'],
  },
  {
    key: 'stealth',
    label: 'Stealth',
    attributeKey: 'speed',
    facet: 'physical',
    summary: 'Avoiding attention, hiding, and slipping away unnoticed.',
    relevantTasks: ['Sneak', 'hide', 'blend into crowds', 'lose pursuers'],
    specialRules: ['In combat, Use a Skill to hide against Spiritual defense if cover or obscured senses allow it.'],
    gainAdvantageExamples: ['Duck out of view', 'use a hidden object', 'feint one direction before moving another'],
  },
  {
    key: 'survival',
    label: 'Survival',
    attributeKey: 'awareness',
    facet: 'spiritual',
    summary: 'Obtaining shelter and resources while navigating or reading the natural world.',
    relevantTasks: ['Track', 'forage', 'navigate', 'handle wildlife', 'avoid environmental threats'],
    specialRules: ['During a short rest, foraging with Survival replaces the other benefits of resting.'],
    gainAdvantageExamples: ['Coordinate with an animal companion', 'find favorable terrain', 'adjust for weather conditions'],
  },
  {
    key: 'thievery',
    label: 'Thievery',
    attributeKey: 'speed',
    facet: 'physical',
    summary: 'Precise manual dexterity for skulduggery and covert tasks.',
    relevantTasks: ['Pickpocket', 'lockpick', 'sleight of hand', 'escape bonds', 'tie knots', 'create disguises'],
    specialRules: ['Pickpocketing in combat is a Use a Skill test against Spiritual defense with raised stakes.'],
    gainAdvantageExamples: ['Make an item vanish', 'subtly draw a weapon', 'shock a target with a disguise'],
  },
] satisfies ReadonlyArray<CharacterSkillDefinition>;

function sanitizedNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function normalizeNumberRecord<T extends string>(
  keys: readonly T[],
  source: Record<string, number> | undefined,
): Partial<Record<T, number>> {
  return Object.fromEntries(
    keys.flatMap((key) => {
      const normalized = sanitizedNumber(source?.[key]);
      return normalized === undefined ? [] : [[key, normalized] as const];
    }),
  ) as Partial<Record<T, number>>;
}

function normalizeSkillRanks(source: Record<string, number> | undefined): Record<string, number> {
  if (!source) {
    return {};
  }
  return Object.fromEntries(
    Object.entries(source)
      .map(([key, value]) => [key, sanitizedNumber(value)] as const)
      .filter((entry): entry is [string, number] => entry[1] !== undefined),
  );
}

function normalizeExpertises(expertises: CharacterExpertise[] | undefined): CharacterExpertise[] {
  return (expertises ?? [])
    .map((expertise) => {
      const name = expertise.name?.trim();
      if (!name) {
        return null;
      }
      return {
        id: expertise.id,
        name,
        category: CHARACTER_EXPERTISE_CATEGORIES.includes(expertise.category) ? expertise.category : 'utility',
      } satisfies CharacterExpertise;
    })
    .filter((expertise): expertise is CharacterExpertise => Boolean(expertise));
}

function normalizeDerivedOverrides(
  overrides: Partial<Record<CharacterDerivedKey, JsonValue>> | undefined,
): Partial<Record<CharacterDerivedKey, JsonValue>> {
  if (!overrides) {
    return {};
  }
  return Object.fromEntries(
    CHARACTER_DERIVED_KEYS.flatMap((key) => (overrides[key] === undefined ? [] : [[key, overrides[key]] as const])),
  ) as Partial<Record<CharacterDerivedKey, JsonValue>>;
}

export function createEmptyCharacterStatSheet(): CharacterStatSheet {
  return {
    attributeScores: Object.fromEntries(CHARACTER_ATTRIBUTE_KEYS.map((key) => [key, ZERO] as const)),
    skillRanks: {},
    expertises: [],
    resourceBonuses: {},
    resourceOverrides: {},
    defenseBonuses: {},
    derivedOverrides: {},
  };
}

export function normalizeCharacterStatSheet(
  input: Partial<CharacterStatSheet> | undefined,
  legacyResources?: Partial<Record<CharacterResourceKey, number | undefined>>,
): CharacterStatSheet {
  const base = createEmptyCharacterStatSheet();
  const attributeScores = {
    ...base.attributeScores,
    ...Object.fromEntries(
      CHARACTER_ATTRIBUTE_KEYS.map((key) => [key, sanitizedNumber(input?.attributeScores?.[key]) ?? ZERO] as const),
    ),
  };

  const resourceOverrides = {
    ...normalizeNumberRecord(CHARACTER_RESOURCE_KEYS, input?.resourceOverrides),
  };
  for (const resourceKey of CHARACTER_RESOURCE_KEYS) {
    if (resourceOverrides[resourceKey] === undefined) {
      const legacyValue = sanitizedNumber(legacyResources?.[resourceKey]);
      if (legacyValue !== undefined) {
        resourceOverrides[resourceKey] = legacyValue;
      }
    }
  }

  return {
    attributeScores,
    skillRanks: normalizeSkillRanks(input?.skillRanks),
    expertises: normalizeExpertises(input?.expertises),
    resourceBonuses: normalizeNumberRecord(CHARACTER_RESOURCE_KEYS, input?.resourceBonuses),
    resourceOverrides,
    defenseBonuses: normalizeNumberRecord(CHARACTER_DEFENSE_KEYS, input?.defenseBonuses),
    derivedOverrides: normalizeDerivedOverrides(input?.derivedOverrides),
  };
}

function attributeScore(sheet: CharacterStatSheet, key: CharacterAttributeKey): number {
  return sheet.attributeScores[key] ?? ZERO;
}

function numericJsonValue(value: JsonValue | undefined): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function lookupTableRow(table: CharacterStatisticTableTemplate, value: number): CharacterStatisticTableRow {
  return (
    table.rows.find((row) => value >= row.min && value <= (row.max ?? TABLE_ROW_OPEN_MAX)) ??
    table.rows[table.rows.length - 1]!
  );
}

export function tableValue(
  tableKey: CharacterStatisticTableTemplate['key'],
  sourceValue: number,
  outputKey: CharacterDerivedKey,
): JsonValue {
  const table = CHARACTER_STATISTIC_TABLES.find((entry) => entry.key === tableKey);
  if (!table) {
    throw new Error(`Unknown statistic table: ${tableKey}`);
  }
  return lookupTableRow(table, sourceValue).outputs[outputKey] ?? null;
}

export function computeCharacterStatSheet(sheet: CharacterStatSheet): ComputedCharacterStatSheet {
  const strength = attributeScore(sheet, 'strength');
  const speed = attributeScore(sheet, 'speed');
  const intellect = attributeScore(sheet, 'intellect');
  const willpower = attributeScore(sheet, 'willpower');
  const awareness = attributeScore(sheet, 'awareness');
  const presence = attributeScore(sheet, 'presence');

  const physicalDefense =
    BASE_DEFENSE + strength + speed + (sheet.defenseBonuses['physical-defense'] ?? ZERO);
  const cognitiveDefense =
    BASE_DEFENSE + intellect + willpower + (sheet.defenseBonuses['cognitive-defense'] ?? ZERO);
  const spiritualDefense =
    BASE_DEFENSE + awareness + presence + (sheet.defenseBonuses['spiritual-defense'] ?? ZERO);

  const calculatedResources: Record<CharacterResourceKey, number> = {
    health: BASE_HEALTH + strength + (sheet.resourceBonuses.health ?? ZERO),
    focus: BASE_FOCUS + willpower + (sheet.resourceBonuses.focus ?? ZERO),
    investiture: BASE_INVESTITURE + Math.max(awareness, presence) + (sheet.resourceBonuses.investiture ?? ZERO),
  };
  const resources = Object.fromEntries(
    CHARACTER_RESOURCE_KEYS.map((key) => [key, sheet.resourceOverrides[key] ?? calculatedResources[key]] as const),
  ) as Record<CharacterResourceKey, number>;

  const skillModifiers = Object.fromEntries(
    CHARACTER_SKILL_DEFINITIONS.map((skill) => [
      skill.key,
      attributeScore(sheet, skill.attributeKey) + (sheet.skillRanks[skill.key] ?? ZERO),
    ]),
  );

  const derived: Record<CharacterDerivedKey, JsonValue> = {
    deflect: numericJsonValue(sheet.derivedOverrides.deflect) ?? DEFAULT_DEFLECT,
    'movement-rate':
      sheet.derivedOverrides['movement-rate'] ??
      tableValue('speed-movement', speed, 'movement-rate'),
    'lifting-capacity':
      sheet.derivedOverrides['lifting-capacity'] ??
      tableValue('strength-lifting-carrying', strength, 'lifting-capacity'),
    'carrying-capacity':
      sheet.derivedOverrides['carrying-capacity'] ??
      tableValue('strength-lifting-carrying', strength, 'carrying-capacity'),
    'recovery-die':
      sheet.derivedOverrides['recovery-die'] ??
      tableValue('willpower-recovery-die', willpower, 'recovery-die'),
    'senses-range':
      sheet.derivedOverrides['senses-range'] ??
      tableValue('awareness-senses-range', awareness, 'senses-range'),
    'established-connections':
      sheet.derivedOverrides['established-connections'] ??
      tableValue('presence-connections', presence, 'established-connections'),
  };

  return {
    resources,
    defenses: {
      'physical-defense': physicalDefense,
      'cognitive-defense': cognitiveDefense,
      'spiritual-defense': spiritualDefense,
    },
    skillModifiers,
    derived,
  };
}

export function resourceMaximum(sheet: CharacterStatSheet, key: CharacterResourceKey): number {
  return computeCharacterStatSheet(sheet).resources[key];
}

export function derivedDisplayValue(value: JsonValue | undefined): string {
  if (value === undefined || value === null) {
    return '—';
  }
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return `${value}`;
  }
  return JSON.stringify(value);
}

export function skillDefinitionByKey(key: string): CharacterSkillDefinition | undefined {
  return CHARACTER_SKILL_DEFINITIONS.find((skill) => skill.key === key);
}

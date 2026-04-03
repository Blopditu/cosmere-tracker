import {
  CHARACTER_ATTRIBUTE_METADATA,
  CHARACTER_EXPERTISE_CATEGORIES,
  CHARACTER_SKILL_DEFINITIONS,
  CharacterAttributeKey,
  CharacterDefenseKey,
  CharacterDerivedKey,
  CharacterExpertiseCategory,
  CharacterResourceKey,
  CharacterSkillDefinition,
  CharacterStatSheet,
  ComputedCharacterStatSheet,
  derivedDisplayValue,
  normalizeCharacterStatSheet,
} from '@shared/domain';

export interface CharacterStatSheetEditorActions {
  stepAttribute(key: CharacterAttributeKey, delta: number): void;
  setSkillRank(key: string, value: number): void;
  stepResourceBonus(key: CharacterResourceKey, delta: number): void;
  stepResourceOverride(key: CharacterResourceKey, delta: number): void;
  stepDefenseBonus(key: CharacterDefenseKey, delta: number): void;
  stepDerivedNumber(key: CharacterDerivedKey, delta: number): void;
  updateDerivedOverride(key: CharacterDerivedKey, value: string): void;
  addExpertise(): void;
  updateExpertiseName(index: number, value: string): void;
  updateExpertiseCategory(index: number, category: CharacterExpertiseCategory): void;
  removeExpertise(index: number): void;
}

export interface StatSheetSectionLink {
  id: string;
  label: string;
}

export interface SkillGroup {
  facet: 'physical' | 'cognitive' | 'spiritual';
  label: string;
  skills: typeof CHARACTER_SKILL_DEFINITIONS;
}

export type StatClusterFacet = 'physical' | 'cognitive' | 'spiritual';
export type StatHighlightKind = 'attribute' | 'resource' | 'defense' | 'skill' | 'derived';
export type StatHighlightToken = `${StatHighlightKind}:${string}`;

export interface StatClusterDefinition {
  key: StatClusterFacet;
  label: string;
  defenseKey: CharacterDefenseKey;
  formulaHint: string;
  attributeKeys: readonly [CharacterAttributeKey, CharacterAttributeKey];
  resourceKeys: readonly CharacterResourceKey[];
  derivedKeys: readonly CharacterDerivedKey[];
  skills: ReadonlyArray<CharacterSkillDefinition>;
}

export const CHARACTER_SHEET_RESOURCE_KEYS = ['health', 'focus', 'investiture'] as const satisfies readonly CharacterResourceKey[];

export const PARTY_DERIVED_KEYS: readonly CharacterDerivedKey[] = [
  'deflect',
  'movement-rate',
  'lifting-capacity',
  'carrying-capacity',
  'recovery-die',
  'senses-range',
  'established-connections',
];

export const ENEMY_DERIVED_KEYS: readonly CharacterDerivedKey[] = [
  'deflect',
  'movement-rate',
  'senses-range',
];

export const PARTY_ADVANCED_DERIVED_KEYS: readonly CharacterDerivedKey[] = PARTY_DERIVED_KEYS.filter(
  (key) => key !== 'deflect',
);

export const ENEMY_ADVANCED_DERIVED_KEYS: readonly CharacterDerivedKey[] = ENEMY_DERIVED_KEYS.filter(
  (key) => key !== 'deflect',
);

export const ENEMY_SKILL_KEYS = new Set([
  'athletics',
  'deception',
  'discipline',
  'heavy-weaponry',
  'insight',
  'intimidation',
  'light-weaponry',
  'perception',
  'stealth',
  'survival',
  'thievery',
]);

export const LEAN_ENEMY_SKILLS = CHARACTER_SKILL_DEFINITIONS.filter((skill) => ENEMY_SKILL_KEYS.has(skill.key));
export const EXPERTISE_CATEGORIES = CHARACTER_EXPERTISE_CATEGORIES;
export const ATTRIBUTE_METADATA = CHARACTER_ATTRIBUTE_METADATA;
export const ATTRIBUTE_ABBREVIATIONS: Readonly<Record<CharacterAttributeKey, string>> = {
  strength: 'STR',
  speed: 'SPD',
  intellect: 'INT',
  willpower: 'WIL',
  awareness: 'AWR',
  presence: 'PRE',
};

const PHYSICAL_ATTRIBUTE_KEYS = ['strength', 'speed'] as const satisfies readonly CharacterAttributeKey[];
const COGNITIVE_ATTRIBUTE_KEYS = ['intellect', 'willpower'] as const satisfies readonly CharacterAttributeKey[];
const SPIRITUAL_ATTRIBUTE_KEYS = ['awareness', 'presence'] as const satisfies readonly CharacterAttributeKey[];

const PARTY_CLUSTER_BLUEPRINTS: readonly Omit<StatClusterDefinition, 'skills'>[] = [
  {
    key: 'physical',
    label: 'Physical',
    defenseKey: 'physical-defense',
    formulaHint: '10 + Strength + Speed',
    attributeKeys: PHYSICAL_ATTRIBUTE_KEYS,
    resourceKeys: ['health'],
    derivedKeys: ['movement-rate', 'lifting-capacity', 'carrying-capacity'],
  },
  {
    key: 'cognitive',
    label: 'Cognitive',
    defenseKey: 'cognitive-defense',
    formulaHint: '10 + Intellect + Willpower',
    attributeKeys: COGNITIVE_ATTRIBUTE_KEYS,
    resourceKeys: ['focus'],
    derivedKeys: ['recovery-die'],
  },
  {
    key: 'spiritual',
    label: 'Spiritual',
    defenseKey: 'spiritual-defense',
    formulaHint: '10 + Awareness + Presence',
    attributeKeys: SPIRITUAL_ATTRIBUTE_KEYS,
    resourceKeys: ['investiture'],
    derivedKeys: ['senses-range', 'established-connections'],
  },
] as const;

function buildStatClusters(skillFilter?: ReadonlySet<string>): readonly StatClusterDefinition[] {
  return PARTY_CLUSTER_BLUEPRINTS.map((cluster) => ({
    ...cluster,
    skills: CHARACTER_SKILL_DEFINITIONS.filter(
      (skill) => skill.facet === cluster.key && (!skillFilter || skillFilter.has(skill.key)),
    ),
  }));
}

export const PARTY_STAT_CLUSTERS = buildStatClusters();
export const ENEMY_STAT_CLUSTERS = buildStatClusters(ENEMY_SKILL_KEYS);

function createHighlightToken(kind: StatHighlightKind, key: string): StatHighlightToken {
  return `${kind}:${key}`;
}

export function attributeHighlightToken(key: CharacterAttributeKey): StatHighlightToken {
  return createHighlightToken('attribute', key);
}

export function resourceHighlightToken(key: CharacterResourceKey): StatHighlightToken {
  return createHighlightToken('resource', key);
}

export function defenseHighlightToken(key: CharacterDefenseKey): StatHighlightToken {
  return createHighlightToken('defense', key);
}

export function skillHighlightToken(key: string): StatHighlightToken {
  return createHighlightToken('skill', key);
}

export function derivedHighlightToken(key: CharacterDerivedKey): StatHighlightToken {
  return createHighlightToken('derived', key);
}

export function highlightsForAttribute(key: CharacterAttributeKey): ReadonlySet<StatHighlightToken> {
  switch (key) {
    case 'strength':
      return new Set([
        attributeHighlightToken(key),
        resourceHighlightToken('health'),
        defenseHighlightToken('physical-defense'),
        skillHighlightToken('athletics'),
        skillHighlightToken('heavy-weaponry'),
        derivedHighlightToken('lifting-capacity'),
        derivedHighlightToken('carrying-capacity'),
      ]);
    case 'speed':
      return new Set([
        attributeHighlightToken(key),
        defenseHighlightToken('physical-defense'),
        skillHighlightToken('agility'),
        skillHighlightToken('light-weaponry'),
        skillHighlightToken('stealth'),
        skillHighlightToken('thievery'),
        derivedHighlightToken('movement-rate'),
      ]);
    case 'intellect':
      return new Set([
        attributeHighlightToken(key),
        defenseHighlightToken('cognitive-defense'),
        skillHighlightToken('crafting'),
        skillHighlightToken('deduction'),
        skillHighlightToken('lore'),
        skillHighlightToken('medicine'),
      ]);
    case 'willpower':
      return new Set([
        attributeHighlightToken(key),
        resourceHighlightToken('focus'),
        defenseHighlightToken('cognitive-defense'),
        skillHighlightToken('discipline'),
        skillHighlightToken('intimidation'),
        derivedHighlightToken('recovery-die'),
      ]);
    case 'awareness':
      return new Set([
        attributeHighlightToken(key),
        resourceHighlightToken('investiture'),
        defenseHighlightToken('spiritual-defense'),
        skillHighlightToken('insight'),
        skillHighlightToken('perception'),
        skillHighlightToken('survival'),
        derivedHighlightToken('senses-range'),
      ]);
    case 'presence':
      return new Set([
        attributeHighlightToken(key),
        resourceHighlightToken('investiture'),
        defenseHighlightToken('spiritual-defense'),
        skillHighlightToken('deception'),
        skillHighlightToken('leadership'),
        skillHighlightToken('persuasion'),
        derivedHighlightToken('established-connections'),
      ]);
  }
}

export function highlightsForSkill(skillKey: string): ReadonlySet<StatHighlightToken> {
  return new Set([skillHighlightToken(skillKey)]);
}

export function resourceLabel(key: CharacterResourceKey): string {
  switch (key) {
    case 'health':
      return 'Health';
    case 'focus':
      return 'Focus';
    case 'investiture':
      return 'Investiture';
  }
}

export function defenseLabel(key: CharacterDefenseKey): string {
  switch (key) {
    case 'physical-defense':
      return 'Physical Defense';
    case 'cognitive-defense':
      return 'Cognitive Defense';
    case 'spiritual-defense':
      return 'Spiritual Defense';
  }
}

export function derivedLabel(key: CharacterDerivedKey): string {
  switch (key) {
    case 'deflect':
      return 'Deflect';
    case 'movement-rate':
      return 'Movement Rate';
    case 'lifting-capacity':
      return 'Lifting Capacity';
    case 'carrying-capacity':
      return 'Carrying Capacity';
    case 'recovery-die':
      return 'Recovery Die';
    case 'senses-range':
      return 'Senses Range';
    case 'established-connections':
      return 'Established Connections';
  }
}

export function attributeLabel(key: CharacterAttributeKey): string {
  return ATTRIBUTE_METADATA.find((attribute) => attribute.key === key)?.label ?? key;
}

export function attributeMetadataForKey(key: CharacterAttributeKey) {
  return ATTRIBUTE_METADATA.find((attribute) => attribute.key === key) ?? ATTRIBUTE_METADATA[0];
}

export function attributeAbbreviation(key: CharacterAttributeKey): string {
  return ATTRIBUTE_ABBREVIATIONS[key];
}

export function displayDerivedValue(value: unknown): string {
  return derivedDisplayValue(value as never);
}

export function derivedOverrideValue(stats: CharacterStatSheet, key: CharacterDerivedKey): string {
  const value = stats.derivedOverrides[key];
  return value === undefined ? '' : `${value}`;
}

export function defenseRows(computedStats: ComputedCharacterStatSheet): ReadonlyArray<{
  key: CharacterDefenseKey;
  label: string;
  value: number;
}> {
  return [
    {
      key: 'physical-defense',
      label: defenseLabel('physical-defense'),
      value: computedStats.defenses['physical-defense'],
    },
    {
      key: 'cognitive-defense',
      label: defenseLabel('cognitive-defense'),
      value: computedStats.defenses['cognitive-defense'],
    },
    {
      key: 'spiritual-defense',
      label: defenseLabel('spiritual-defense'),
      value: computedStats.defenses['spiritual-defense'],
    },
  ];
}

export function nextSteppedValue(value: number, delta: number, minimum?: number): number {
  const next = value + delta;
  if (minimum === undefined) {
    return next;
  }
  return Math.max(minimum, next);
}

export function cloneNormalizedStatSheet(stats: CharacterStatSheet): CharacterStatSheet {
  return normalizeCharacterStatSheet(structuredClone(stats));
}

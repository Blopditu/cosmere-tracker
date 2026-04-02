import {
  CHARACTER_ATTRIBUTE_METADATA,
  CHARACTER_EXPERTISE_CATEGORIES,
  CHARACTER_SKILL_DEFINITIONS,
  CharacterAttributeKey,
  CharacterDefenseKey,
  CharacterDerivedKey,
  CharacterExpertiseCategory,
  CharacterResourceKey,
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

export const CHARACTER_SHEET_RESOURCE_KEYS = ['health', 'focus', 'investiture'] as const satisfies readonly CharacterResourceKey[];

export const PARTY_SHEET_SECTION_LINKS: readonly StatSheetSectionLink[] = [
  { id: 'party-sheet-attributes', label: 'Attributes' },
  { id: 'party-sheet-resources', label: 'Resources' },
  { id: 'party-sheet-skills', label: 'Skills' },
  { id: 'party-sheet-derived', label: 'Derived' },
  { id: 'party-sheet-expertises', label: 'Expertises' },
  { id: 'party-sheet-advanced', label: 'Advanced' },
];

export const ENEMY_SHEET_SECTION_LINKS: readonly StatSheetSectionLink[] = [
  { id: 'enemy-sheet-core', label: 'Core' },
  { id: 'enemy-sheet-skills', label: 'Skills' },
  { id: 'enemy-sheet-advanced', label: 'Advanced' },
];

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

export const PARTY_SKILL_GROUPS: readonly SkillGroup[] = [
  {
    facet: 'physical',
    label: 'Physical',
    skills: CHARACTER_SKILL_DEFINITIONS.filter((skill) => skill.facet === 'physical'),
  },
  {
    facet: 'cognitive',
    label: 'Cognitive',
    skills: CHARACTER_SKILL_DEFINITIONS.filter((skill) => skill.facet === 'cognitive'),
  },
  {
    facet: 'spiritual',
    label: 'Spiritual',
    skills: CHARACTER_SKILL_DEFINITIONS.filter((skill) => skill.facet === 'spiritual'),
  },
] as const;

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

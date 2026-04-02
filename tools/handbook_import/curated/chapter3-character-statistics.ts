import type { ImportCandidateKind, JsonValue } from '../../../shared/domain/campaign-models';
import {
  CHARACTER_ATTRIBUTE_METADATA,
  CHARACTER_SKILL_DEFINITIONS,
  CHARACTER_STATISTIC_TABLES,
  CHARACTER_STATISTIC_TEMPLATES,
} from '../../../shared/domain/character-stats';

export interface CuratedChapterCandidateSource {
  kind: ImportCandidateKind;
  title: string;
  key: string;
  pageNumber: number;
  excerpt: string;
  payload: Record<string, JsonValue>;
}

export const CHAPTER_3_DOCUMENT_ID = 'doc-curated-chapter3-character-statistics';
export const CHAPTER_3_SOURCE_KIND = 'stormlight-handbook' as const;
export const CHAPTER_3_PROFILE = 'stormlight-handbook-curated';
export const CHAPTER_3_TITLE = 'Chapter 3 Character Statistics';
export const CHAPTER_3_SOURCE_PATH = 'SL001_Stormlight_Handbook_digital/003_Character_Statistics.pdf';
export const CHAPTER_3_EXTRACTOR_VERSION = 'curated-chapter3-v1';
export const CHAPTER_3_PAGE_NUMBERS = [47, 48, 49, 50, 51, 52, 53, 54, 55] as const;

function asJsonValue(value: unknown): JsonValue {
  return JSON.parse(JSON.stringify(value)) as JsonValue;
}

const STATISTIC_PAGE_BY_KEY: Record<string, number> = {
  strength: 48,
  speed: 48,
  intellect: 49,
  willpower: 49,
  awareness: 50,
  presence: 50,
  'physical-defense': 51,
  'cognitive-defense': 51,
  'spiritual-defense': 51,
  deflect: 51,
  'movement-rate': 48,
  'lifting-capacity': 48,
  'carrying-capacity': 48,
  'recovery-die': 49,
  'senses-range': 54,
  'established-connections': 54,
};

const STATISTIC_TABLE_PAGE_BY_KEY: Record<string, number> = {
  'strength-lifting-carrying': 48,
  'speed-movement': 48,
  'willpower-recovery-die': 49,
  'awareness-senses-range': 54,
  'presence-connections': 54,
};

const SKILL_PAGE_NUMBER = 55;
const RESOURCE_PAGE_NUMBER = 54;

const RULE_SECTION_SOURCES: ReadonlyArray<CuratedChapterCandidateSource> = [
  {
    kind: 'rule-section',
    title: 'Physical Cognitive and Spiritual Statistics',
    key: 'physical-cognitive-spiritual-statistics',
    pageNumber: 47,
    excerpt:
      'Character statistics are organized into physical, cognitive, and spiritual facets. Each facet groups attributes, defenses, and related skills so tests and derived values line up with the same part of the character sheet.',
    payload: {
      keywords: ['physical', 'cognitive', 'spiritual', 'statistics', 'facets'],
    },
  },
  {
    kind: 'rule-section',
    title: 'Expertises',
    key: 'expertises',
    pageNumber: 51,
    excerpt:
      'Expertises are freeform specialties that sharpen how a character applies their skills. Chapter 3 treats them as open-ended tags instead of a closed master list and groups examples into armor, cultural, utility, weapon, and specialist categories.',
    payload: {
      keywords: ['expertises', 'armor', 'cultural', 'utility', 'weapon', 'specialist'],
    },
  },
  {
    kind: 'rule-section',
    title: 'Known Languages',
    key: 'known-languages',
    pageNumber: 54,
    excerpt:
      'Languages live alongside the Awareness and Presence side of the sheet. Chapter 3 frames known languages as learned proficiencies that matter when understanding speech, reading, and establishing social footing in unfamiliar places.',
    payload: {
      keywords: ['languages', 'known languages', 'communication'],
    },
  },
  {
    kind: 'rule-section',
    title: 'Senses',
    key: 'senses',
    pageNumber: 54,
    excerpt:
      'A character can still operate when their primary sense is obscured, but the effective range depends on Awareness. The chapter gives a lookup table from short tactile range through complete immunity to obscured senses.',
    payload: {
      keywords: ['senses', 'awareness', 'obscured senses', 'range'],
    },
  },
  {
    kind: 'rule-section',
    title: 'Skill Tests and Difficulty Classes',
    key: 'skill-tests-and-difficulty-classes',
    pageNumber: 55,
    excerpt:
      'Skill tests combine the governing attribute with the skill rank, then compare the result against a difficulty set by the GM. Chapter 3 positions these tests as the default way to resolve uncertain tasks outside direct combat attacks.',
    payload: {
      keywords: ['skills', 'tests', 'difficulty class', 'dc'],
    },
  },
  {
    kind: 'rule-section',
    title: 'Opposed Tests',
    key: 'opposed-tests',
    pageNumber: 55,
    excerpt:
      'Opposed tests happen when one character actively contests another. Instead of a fixed DC, the two sides roll against each other and compare totals to determine whose effort wins the exchange.',
    payload: {
      keywords: ['opposed tests', 'contested rolls'],
    },
  },
  {
    kind: 'rule-section',
    title: 'Advantages and Disadvantages',
    key: 'advantages-and-disadvantages',
    pageNumber: 55,
    excerpt:
      'Advantage and disadvantage adjust how favorable the situation is before the roll is resolved. The chapter calls out circumstance, preparation, and leverage as common reasons to grant one or the other.',
    payload: {
      keywords: ['advantage', 'disadvantage'],
    },
  },
  {
    kind: 'rule-section',
    title: 'Trying Again',
    key: 'trying-again',
    pageNumber: 55,
    excerpt:
      'Retrying a failed attempt is not automatic. Chapter 3 expects the fiction to change, costs to matter, or the stakes to rise before the same character meaningfully attempts the task again.',
    payload: {
      keywords: ['trying again', 'retry'],
    },
  },
  {
    kind: 'rule-section',
    title: 'Working Together',
    key: 'working-together',
    pageNumber: 55,
    excerpt:
      'Characters can cooperate on difficult tasks instead of acting in isolation. The chapter frames teamwork as a way to improve the acting character’s chances when assistance is actually relevant in the scene.',
    payload: {
      keywords: ['working together', 'help', 'cooperation'],
    },
  },
];

const RESOURCE_SOURCES: ReadonlyArray<CuratedChapterCandidateSource> = [
  {
    kind: 'resource-definition',
    title: 'Health',
    key: 'health',
    pageNumber: RESOURCE_PAGE_NUMBER,
    excerpt:
      'Health measures how much punishment a character can take before dropping. Chapter 3 sets the baseline from Strength, then lets bonuses and overrides adjust the final maximum.',
    payload: {
      label: 'Health',
      min: 0,
      defaultValue: 0,
      warningAt: 0,
      keywords: ['health', 'resource', 'strength'],
    },
  },
  {
    kind: 'resource-definition',
    title: 'Focus',
    key: 'focus',
    pageNumber: RESOURCE_PAGE_NUMBER,
    excerpt:
      'Focus is the core spendable resource for exertion, special maneuvers, and intense effort. Chapter 3 derives it from Willpower before bonuses or overrides are applied.',
    payload: {
      label: 'Focus',
      min: 0,
      defaultValue: 0,
      warningAt: 0,
      keywords: ['focus', 'resource', 'willpower'],
    },
  },
  {
    kind: 'resource-definition',
    title: 'Investiture',
    key: 'investiture',
    pageNumber: RESOURCE_PAGE_NUMBER,
    excerpt:
      'Investiture is the spiritual power pool used by magic-forward characters and effects. Chapter 3 defines its maximum from the better of Awareness or Presence before bonuses or overrides are applied.',
    payload: {
      label: 'Investiture',
      min: 0,
      defaultValue: 0,
      warningAt: 0,
      keywords: ['investiture', 'resource', 'awareness', 'presence'],
    },
  },
];

const STATISTIC_SOURCES: ReadonlyArray<CuratedChapterCandidateSource> = CHARACTER_STATISTIC_TEMPLATES.map((statistic) => ({
  kind: 'statistic-definition',
  title: statistic.label,
  key: statistic.key,
  pageNumber: STATISTIC_PAGE_BY_KEY[statistic.key] ?? 48,
  excerpt: statistic.summary,
  payload: {
    label: statistic.label,
    group: statistic.group,
    facet: statistic.facet,
    valueType: statistic.valueType,
    summary: statistic.summary,
    calculation: statistic.calculation,
    keywords: [statistic.key, statistic.label.toLowerCase(), statistic.group, statistic.facet],
  },
}));

const STATISTIC_TABLE_SOURCES: ReadonlyArray<CuratedChapterCandidateSource> = CHARACTER_STATISTIC_TABLES.map((table) => ({
  kind: 'stat-table-definition',
  title: table.label,
  key: table.key,
  pageNumber: STATISTIC_TABLE_PAGE_BY_KEY[table.key] ?? 48,
  excerpt: `${table.label} maps ${table.sourceStatisticKey} scores to ${table.outputKeys.join(', ')} outcomes.`,
  payload: {
    label: table.label,
    sourceStatisticKey: table.sourceStatisticKey,
    outputKeys: table.outputKeys,
    rows: asJsonValue(table.rows),
    keywords: [table.key, table.label.toLowerCase(), table.sourceStatisticKey],
  },
}));

const SKILL_SOURCES: ReadonlyArray<CuratedChapterCandidateSource> = CHARACTER_SKILL_DEFINITIONS.map((skill) => ({
  kind: 'skill-definition',
  title: skill.label,
  key: skill.key,
  pageNumber: SKILL_PAGE_NUMBER,
  excerpt: skill.summary,
  payload: {
    label: skill.label,
    attributeKey: skill.attributeKey,
    facet: skill.facet,
    summary: skill.summary,
    relevantTasks: skill.relevantTasks,
    specialRules: skill.specialRules,
    gainAdvantageExamples: skill.gainAdvantageExamples,
    keywords: [skill.key, skill.label.toLowerCase(), skill.attributeKey, skill.facet],
  },
}));

export const CHAPTER_3_CURATED_CANDIDATES: ReadonlyArray<CuratedChapterCandidateSource> = [
  ...RESOURCE_SOURCES,
  ...STATISTIC_SOURCES,
  ...STATISTIC_TABLE_SOURCES,
  ...SKILL_SOURCES,
  ...RULE_SECTION_SOURCES,
];

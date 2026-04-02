import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  CHARACTER_SKILL_DEFINITIONS,
  CHARACTER_STATISTIC_TABLES,
  CHARACTER_STATISTIC_TEMPLATES,
  ActionDefinition,
  Condition,
  ResourceDefinition,
  ResolutionHook,
  RuleReference,
  SkillDefinition,
  StatisticDefinition,
  StatisticTableDefinition,
} from '@shared/domain';
import { openSqliteDatabase, SqliteDatabase, SqliteJsonRepository } from '../lib/sqlite';
import { ImportArtifactService } from './import-artifact.service';
import { writeChapter3CuratedArtifact } from '../../../tools/handbook_import/build-curated-chapter3';

describe('ImportArtifactService curated Chapter 3 flow', () => {
  let dataDir: string;
  let database: SqliteDatabase;
  let ruleRepository: SqliteJsonRepository<RuleReference>;
  let resourceRepository: SqliteJsonRepository<ResourceDefinition>;
  let statisticRepository: SqliteJsonRepository<StatisticDefinition>;
  let statisticTableRepository: SqliteJsonRepository<StatisticTableDefinition>;
  let skillRepository: SqliteJsonRepository<SkillDefinition>;
  let service: ImportArtifactService;

  beforeEach(async () => {
    dataDir = await mkdtemp(path.join(tmpdir(), 'cosmere-import-artifact-'));
    database = openSqliteDatabase(path.join(dataDir, 'import.sqlite'));
    ruleRepository = new SqliteJsonRepository<RuleReference>(database, 'rules');
    resourceRepository = new SqliteJsonRepository<ResourceDefinition>(database, 'resource_definitions');
    statisticRepository = new SqliteJsonRepository<StatisticDefinition>(database, 'statistic_definitions');
    statisticTableRepository = new SqliteJsonRepository<StatisticTableDefinition>(database, 'statistic_table_definitions');
    skillRepository = new SqliteJsonRepository<SkillDefinition>(database, 'skill_definitions');

    service = new ImportArtifactService(database, {
      rules: ruleRepository,
      conditions: new SqliteJsonRepository<Condition>(database, 'conditions'),
      resourceDefinitions: resourceRepository,
      statisticDefinitions: statisticRepository,
      statisticTableDefinitions: statisticTableRepository,
      skillDefinitions: skillRepository,
      actionDefinitions: new SqliteJsonRepository<ActionDefinition>(database, 'action_definitions'),
      resolutionHooks: new SqliteJsonRepository<ResolutionHook>(database, 'resolution_hooks'),
    });
  });

  afterEach(async () => {
    database.close();
    await rm(dataDir, { recursive: true, force: true });
  });

  it('registers and publishes the curated Chapter 3 artifact into first-class rule data', async () => {
    const artifactPath = await writeChapter3CuratedArtifact(path.join(dataDir, 'artifact'));
    const reviewDocument = await service.registerLocalArtifact({ artifactPath });

    expect(reviewDocument.candidates.length).toBe(51);
    expect(reviewDocument.candidates.filter((candidate) => candidate.kind === 'resource-definition')).toHaveLength(3);
    expect(reviewDocument.candidates.filter((candidate) => candidate.kind === 'statistic-definition')).toHaveLength(
      CHARACTER_STATISTIC_TEMPLATES.length,
    );
    expect(reviewDocument.candidates.filter((candidate) => candidate.kind === 'stat-table-definition')).toHaveLength(
      CHARACTER_STATISTIC_TABLES.length,
    );
    expect(reviewDocument.candidates.filter((candidate) => candidate.kind === 'skill-definition')).toHaveLength(
      CHARACTER_SKILL_DEFINITIONS.length,
    );

    for (const candidate of reviewDocument.candidates) {
      await service.decideCandidate(candidate.id, {
        action: 'accept',
        kind: candidate.kind,
      });
    }

    const publishedDocument = await service.publishDocument(reviewDocument.summary.document.id);
    const expectedPublishedRefs =
      reviewDocument.candidates.length +
      3 +
      CHARACTER_STATISTIC_TEMPLATES.length +
      CHARACTER_STATISTIC_TABLES.length +
      CHARACTER_SKILL_DEFINITIONS.length;

    expect(publishedDocument.summary.publishedCount).toBe(expectedPublishedRefs);
    expect(resourceRepository.count()).toBe(3);
    expect(statisticRepository.count()).toBe(CHARACTER_STATISTIC_TEMPLATES.length);
    expect(statisticTableRepository.count()).toBe(CHARACTER_STATISTIC_TABLES.length);
    expect(skillRepository.count()).toBe(CHARACTER_SKILL_DEFINITIONS.length);
    expect(ruleRepository.count()).toBe(reviewDocument.candidates.length);
    expect(resourceRepository.get('resource-health')?.label).toBe('Health');
    expect(statisticRepository.get('stat-strength')?.label).toBe('Strength');
    expect(statisticTableRepository.get('stat-table-speed-movement')?.sourceStatisticKey).toBe('speed');
    expect(skillRepository.get('skill-agility')?.attributeKey).toBe('speed');
  });
});

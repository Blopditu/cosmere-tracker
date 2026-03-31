import { randomUUID } from 'node:crypto';
import { createReadStream, promises as fs } from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import {
  ActionDefinition,
  Condition,
  ImportArtifactManifest,
  ImportBatch,
  ImportCandidate,
  ImportDocumentSummary,
  ImportedBlockArtifact,
  ImportedCandidateArtifact,
  ImportedPageArtifact,
  ImportReviewCandidateDetail,
  ImportReviewDocumentData,
  PublishedArtifactRef,
  RegisterArtifactInput,
  ResolutionHook,
  ResourceDefinition,
  ReviewDecision,
  ReviewDecisionInput,
  RuleReference,
  SourceBlock,
  SourceDocument,
  SourcePage,
} from '@shared/domain';
import { HttpError } from '../lib/http';
import { SqliteDatabase, SqliteJsonRepository } from '../lib/sqlite';
import { nowIso } from '../lib/time';

interface ImportArtifactRepositories {
  rules: SqliteJsonRepository<RuleReference>;
  conditions: SqliteJsonRepository<Condition>;
  resourceDefinitions: SqliteJsonRepository<ResourceDefinition>;
  actionDefinitions: SqliteJsonRepository<ActionDefinition>;
  resolutionHooks: SqliteJsonRepository<ResolutionHook>;
}

interface ImportJobRow {
  id: string;
  document_id: string;
  job_type: string;
  status: string;
  artifact_path: string;
  created_at: string;
  updated_at: string;
  error_message: string | null;
}

function parseJson<T>(value: string): T {
  return JSON.parse(value) as T;
}

async function readJsonl<T>(filePath: string): Promise<T[]> {
  const rows: T[] = [];
  const stream = createReadStream(filePath, { encoding: 'utf-8' });
  const reader = readline.createInterface({ input: stream, crlfDelay: Infinity });
  for await (const line of reader) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }
    rows.push(JSON.parse(trimmed) as T);
  }
  return rows;
}

function asString(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function normalizeEffects(value: unknown): ActionDefinition['effects'] {
  return Array.isArray(value) ? (value as ActionDefinition['effects']) : [];
}

function normalizeMessages(value: unknown): ResolutionHook['messages'] {
  return Array.isArray(value)
    ? (value.filter((entry) => typeof entry === 'object' && entry !== null) as ResolutionHook['messages'])
    : [];
}

export class ImportArtifactService {
  constructor(
    private readonly database: SqliteDatabase,
    private readonly repositories: ImportArtifactRepositories,
  ) {
    this.database.exec(`
      CREATE TABLE IF NOT EXISTS source_documents (
        id TEXT PRIMARY KEY,
        data TEXT NOT NULL,
        checksum TEXT NOT NULL UNIQUE,
        status TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS source_pages (
        document_id TEXT NOT NULL,
        page_number INTEGER NOT NULL,
        data TEXT NOT NULL,
        PRIMARY KEY (document_id, page_number)
      );

      CREATE TABLE IF NOT EXISTS source_blocks (
        id TEXT PRIMARY KEY,
        document_id TEXT NOT NULL,
        page_number INTEGER NOT NULL,
        block_index INTEGER NOT NULL,
        text TEXT NOT NULL,
        data TEXT NOT NULL
      );

      CREATE VIRTUAL TABLE IF NOT EXISTS source_block_fts USING fts5(
        block_id UNINDEXED,
        document_id UNINDEXED,
        text
      );

      CREATE TABLE IF NOT EXISTS import_batches (
        id TEXT PRIMARY KEY,
        document_id TEXT NOT NULL,
        data TEXT NOT NULL,
        status TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS import_jobs (
        id TEXT PRIMARY KEY,
        document_id TEXT NOT NULL,
        job_type TEXT NOT NULL,
        status TEXT NOT NULL,
        artifact_path TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        error_message TEXT
      );

      CREATE TABLE IF NOT EXISTS import_candidates (
        id TEXT PRIMARY KEY,
        document_id TEXT NOT NULL,
        batch_id TEXT NOT NULL,
        decision TEXT NOT NULL,
        title TEXT NOT NULL,
        kind TEXT NOT NULL,
        data TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS review_decisions (
        id TEXT PRIMARY KEY,
        candidate_id TEXT NOT NULL,
        data TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS published_artifact_refs (
        id TEXT PRIMARY KEY,
        document_id TEXT NOT NULL,
        candidate_id TEXT NOT NULL,
        data TEXT NOT NULL
      );
    `);
  }

  async registerLocalArtifact(input: RegisterArtifactInput): Promise<ImportReviewDocumentData> {
    const artifactPath = path.resolve(process.cwd(), input.artifactPath);
    const manifestPath = path.join(artifactPath, 'manifest.json');
    const pagesPath = path.join(artifactPath, 'pages.jsonl');
    const blocksPath = path.join(artifactPath, 'blocks.jsonl');
    const candidatesPath = path.join(artifactPath, 'candidates.jsonl');

    for (const filePath of [manifestPath, pagesPath, blocksPath, candidatesPath]) {
      try {
        await fs.access(filePath);
      } catch {
        throw new HttpError(400, `Artifact file missing: ${path.basename(filePath)}`);
      }
    }

    const manifest = parseJson<ImportArtifactManifest>(await fs.readFile(manifestPath, 'utf-8'));
    this.assertManifest(manifest);
    if (this.findDocumentByChecksum(manifest.fileChecksum) || this.getDocument(manifest.documentId)) {
      throw new HttpError(409, 'This handbook artifact has already been imported.');
    }

    const pages = await readJsonl<ImportedPageArtifact>(pagesPath);
    const blocks = await readJsonl<ImportedBlockArtifact>(blocksPath);
    const candidates = await readJsonl<ImportedCandidateArtifact>(candidatesPath);
    this.assertArtifacts(manifest, pages, blocks, candidates);

    const timestamp = nowIso();
    const batchId = `batch-${manifest.documentId}`;
    const document: SourceDocument = {
      id: manifest.documentId,
      createdAt: timestamp,
      updatedAt: timestamp,
      revision: 1,
      sourceKind: manifest.sourceKind,
      title: manifest.title,
      profile: manifest.profile,
      sourcePath: manifest.sourcePath,
      checksum: manifest.fileChecksum,
      extractorVersion: manifest.extractorVersion,
      pageCount: manifest.pageCount,
      artifactPath,
      status: 'review',
      latestBatchId: batchId,
    };
    const batch: ImportBatch = {
      id: batchId,
      createdAt: timestamp,
      updatedAt: timestamp,
      revision: 1,
      documentId: manifest.documentId,
      artifactPath,
      profile: manifest.profile,
      extractorVersion: manifest.extractorVersion,
      sourceChecksum: manifest.fileChecksum,
      status: 'review',
      candidateCount: candidates.length,
      acceptedCount: 0,
      rejectedCount: 0,
    };
    const jobId = randomUUID();

    const transaction = this.database.transaction(() => {
      this.database.prepare(`INSERT INTO source_documents (id, data, checksum, status) VALUES (?, ?, ?, ?)`).run(
        document.id,
        JSON.stringify(document),
        document.checksum,
        document.status,
      );
      this.database.prepare(`INSERT INTO import_batches (id, document_id, data, status) VALUES (?, ?, ?, ?)`).run(
        batch.id,
        batch.documentId,
        JSON.stringify(batch),
        batch.status,
      );
      this.database.prepare(
        `INSERT INTO import_jobs (id, document_id, job_type, status, artifact_path, created_at, updated_at, error_message)
         VALUES (?, ?, ?, ?, ?, ?, ?, NULL)`,
      ).run(jobId, document.id, 'register-local', 'completed', artifactPath, timestamp, timestamp);

      const pageStatement = this.database.prepare(
        `INSERT INTO source_pages (document_id, page_number, data) VALUES (?, ?, ?)`,
      );
      for (const page of pages) {
        const sourcePage: SourcePage = {
          id: `${page.documentId}:page:${page.pageNumber}`,
          createdAt: timestamp,
          updatedAt: timestamp,
          revision: 1,
          documentId: page.documentId,
          pageNumber: page.pageNumber,
          width: page.width,
          height: page.height,
          wordCount: page.wordCount,
          checksum: page.checksum,
          previewText: page.previewText,
          hasText: page.hasText,
          needsOcr: page.needsOcr,
        };
        pageStatement.run(sourcePage.documentId, sourcePage.pageNumber, JSON.stringify(sourcePage));
      }

      this.database.prepare(`DELETE FROM source_block_fts WHERE document_id = ?`).run(document.id);
      const blockStatement = this.database.prepare(
        `INSERT INTO source_blocks (id, document_id, page_number, block_index, text, data) VALUES (?, ?, ?, ?, ?, ?)`,
      );
      const ftsStatement = this.database.prepare(
        `INSERT INTO source_block_fts (block_id, document_id, text) VALUES (?, ?, ?)`,
      );
      for (const block of blocks) {
        const sourceBlock: SourceBlock = {
          id: block.id,
          createdAt: timestamp,
          updatedAt: timestamp,
          revision: 1,
          documentId: block.documentId,
          pageNumber: block.pageNumber,
          blockIndex: block.blockIndex,
          kind: block.kind,
          headingLevel: block.headingLevel,
          bbox: block.bbox,
          text: block.text,
          checksum: block.checksum,
        };
        blockStatement.run(
          sourceBlock.id,
          sourceBlock.documentId,
          sourceBlock.pageNumber,
          sourceBlock.blockIndex,
          sourceBlock.text,
          JSON.stringify(sourceBlock),
        );
        ftsStatement.run(sourceBlock.id, sourceBlock.documentId, sourceBlock.text);
      }

      const candidateStatement = this.database.prepare(
        `INSERT INTO import_candidates (id, document_id, batch_id, decision, title, kind, data) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      );
      for (const candidate of candidates) {
        const importCandidate: ImportCandidate = {
          id: candidate.id,
          createdAt: timestamp,
          updatedAt: timestamp,
          revision: 1,
          batchId,
          documentId: candidate.documentId,
          kind: candidate.kind,
          title: candidate.title,
          key: candidate.key,
          confidence: candidate.confidence,
          excerpt: candidate.excerpt,
          sourceBlockIds: candidate.sourceBlockIds,
          payload: candidate.payload,
          decision: 'pending',
          supersededByIds: [],
        };
        candidateStatement.run(
          importCandidate.id,
          importCandidate.documentId,
          importCandidate.batchId,
          importCandidate.decision,
          importCandidate.title,
          importCandidate.kind,
          JSON.stringify(importCandidate),
        );
      }
    });

    transaction();
    return this.getReviewDocument(document.id);
  }

  async listReviewDocuments(): Promise<ImportDocumentSummary[]> {
    const documents = this.database
      .prepare(`SELECT data FROM source_documents ORDER BY id`)
      .all()
      .map((row) => parseJson<SourceDocument>(String((row as { data: string }).data)));
    return documents.map((document) => this.buildDocumentSummary(document.id));
  }

  async getReviewDocument(documentId: string): Promise<ImportReviewDocumentData> {
    const document = this.getDocument(documentId);
    if (!document) {
      throw new HttpError(404, 'Imported document not found.');
    }
    const pages = this.database
      .prepare(`SELECT data FROM source_pages WHERE document_id = ? ORDER BY page_number`)
      .all(documentId)
      .map((row) => parseJson<SourcePage>(String((row as { data: string }).data)));
    const candidates = this.database
      .prepare(`SELECT data FROM import_candidates WHERE document_id = ? ORDER BY title`)
      .all(documentId)
      .map((row) => parseJson<ImportCandidate>(String((row as { data: string }).data)));
    return {
      summary: this.buildDocumentSummary(documentId),
      pages,
      candidates,
    };
  }

  async getCandidateDetail(candidateId: string): Promise<ImportReviewCandidateDetail> {
    const candidate = this.getCandidate(candidateId);
    if (!candidate) {
      throw new HttpError(404, 'Import candidate not found.');
    }
    const blocks = candidate.sourceBlockIds
      .map((id) => this.database.prepare(`SELECT data FROM source_blocks WHERE id = ?`).get(id) as { data: string } | undefined)
      .filter((row): row is { data: string } => Boolean(row))
      .map((row) => parseJson<SourceBlock>(row.data))
      .sort((left, right) => left.pageNumber - right.pageNumber || left.blockIndex - right.blockIndex);
    const decisions = this.database
      .prepare(`SELECT data FROM review_decisions WHERE candidate_id = ? ORDER BY created_at DESC`)
      .all(candidateId)
      .map((row) => parseJson<ReviewDecision>(String((row as { data: string }).data)));
    return {
      candidate,
      blocks,
      pageNumbers: [...new Set(blocks.map((block) => block.pageNumber))],
      decisions,
    };
  }

  async decideCandidate(candidateId: string, input: ReviewDecisionInput): Promise<ImportReviewCandidateDetail> {
    const candidate = this.getCandidate(candidateId);
    if (!candidate) {
      throw new HttpError(404, 'Import candidate not found.');
    }

    const now = nowIso();
    const decision: ReviewDecision = {
      id: randomUUID(),
      createdAt: now,
      updatedAt: now,
      revision: 1,
      candidateId,
      action: input.action,
      note: input.note,
      payload: input.payload,
      mergeCandidateIds: input.mergeCandidateIds,
      splitCandidateIds: undefined,
    };

    const transaction = this.database.transaction(() => {
      if (input.action === 'split') {
        if (!input.splitCandidates?.length) {
          throw new HttpError(400, 'Split requires at least one replacement candidate.');
        }
        const newIds: string[] = [];
        for (const splitCandidate of input.splitCandidates) {
          const next: ImportCandidate = {
            ...candidate,
            id: `${candidate.id}-split-${newIds.length + 1}-${randomUUID().slice(0, 8)}`,
            createdAt: now,
            updatedAt: now,
            revision: 1,
            title: splitCandidate.title,
            key: splitCandidate.key,
            kind: splitCandidate.kind,
            excerpt: splitCandidate.excerpt,
            sourceBlockIds: splitCandidate.sourceBlockIds,
            payload: splitCandidate.payload,
            decision: 'pending',
            supersededByIds: [],
          };
          this.upsertCandidate(next);
          newIds.push(next.id);
        }
        candidate.decision = 'split';
        candidate.supersededByIds = newIds;
        decision.splitCandidateIds = newIds;
      } else if (input.action === 'merge') {
        const mergeCandidates = (input.mergeCandidateIds ?? [])
          .map((id) => this.getCandidate(id))
          .filter((entry): entry is ImportCandidate => Boolean(entry));
        if (!mergeCandidates.length) {
          throw new HttpError(400, 'Merge requires companion candidates.');
        }
        const mergedId = `${candidate.id}-merged-${randomUUID().slice(0, 8)}`;
        const sourceBlockIds = [...new Set([candidate, ...mergeCandidates].flatMap((entry) => entry.sourceBlockIds))];
        const merged: ImportCandidate = {
          ...candidate,
          id: mergedId,
          createdAt: now,
          updatedAt: now,
          revision: 1,
          title: asString(input.title, candidate.title),
          key: asString(input.key, candidate.key),
          excerpt: asString((input.payload ?? {})['excerpt'], candidate.excerpt),
          sourceBlockIds,
          payload: input.payload ?? candidate.payload,
          decision: 'pending',
          supersededByIds: [],
        };
        this.upsertCandidate(merged);
        for (const mergedSource of [candidate, ...mergeCandidates]) {
          mergedSource.decision = 'merged';
          mergedSource.supersededByIds = [mergedId];
          this.upsertCandidate(mergedSource);
        }
      } else {
        candidate.title = asString(input.title, candidate.title);
        candidate.key = asString(input.key, candidate.key);
        candidate.payload = input.payload ?? candidate.payload;
        candidate.updatedAt = now;
        candidate.revision += 1;
        candidate.decision = input.action === 'reject' ? 'rejected' : input.action === 'edit' ? 'edited' : 'accepted';
      }

      if (input.action !== 'merge') {
        this.upsertCandidate(candidate);
      }

      this.database
        .prepare(`INSERT INTO review_decisions (id, candidate_id, data, created_at) VALUES (?, ?, ?, ?)`)
        .run(decision.id, candidateId, JSON.stringify(decision), now);
      this.recountBatch(candidate.batchId);
    });

    transaction();
    return this.getCandidateDetail(candidateId);
  }

  async publishDocument(documentId: string): Promise<ImportReviewDocumentData> {
    const document = this.getDocument(documentId);
    if (!document) {
      throw new HttpError(404, 'Imported document not found.');
    }
    const batch = this.getBatch(document.latestBatchId ?? '');
    if (!batch) {
      throw new HttpError(404, 'Import batch not found.');
    }

    const candidates = this.database
      .prepare(`SELECT data FROM import_candidates WHERE document_id = ?`)
      .all(documentId)
      .map((row) => parseJson<ImportCandidate>(String((row as { data: string }).data)))
      .filter((candidate) => candidate.decision === 'accepted' || candidate.decision === 'edited');
    const now = nowIso();

    const transaction = this.database.transaction(() => {
      for (const candidate of candidates) {
        const sourceRef = {
          documentId: document.id,
          sourceKind: document.sourceKind,
          locator: `Pages ${this.candidatePageLabel(candidate)}`,
          pageStart: Number(this.candidatePageLabel(candidate).split('-')[0]),
          excerpt: candidate.excerpt,
          confidence: candidate.confidence,
        };

        const ruleReferenceId = `rule-ref-${candidate.key}`;
        const existingRule = this.repositories.rules.get(ruleReferenceId);
        const ruleReference: RuleReference = {
          id: ruleReferenceId,
          createdAt: existingRule?.createdAt ?? now,
          updatedAt: now,
          revision: (existingRule?.revision ?? 0) + 1,
          key: candidate.key,
          title: candidate.title,
          category: this.ruleCategoryForCandidate(candidate.kind),
          excerptBlocks: [{ id: `${ruleReferenceId}-excerpt`, kind: 'boxed', text: candidate.excerpt }],
          parsedTerms: Array.isArray(candidate.payload['keywords']) ? (candidate.payload['keywords'] as string[]) : [candidate.key],
          sourceRefs: [sourceRef],
          formalizationStatus: candidate.kind === 'rule-section' ? 'reviewed' : 'modeled',
        };
        this.repositories.rules.upsert(ruleReference);
        this.upsertPublishedRef({
          id: `pub-${candidate.id}-rule`,
          createdAt: now,
          updatedAt: now,
          revision: 1,
          documentId: document.id,
          batchId: batch.id,
          candidateId: candidate.id,
          publishedEntityKind: 'ruleReference',
          publishedEntityId: ruleReference.id,
        });

        if (candidate.kind === 'resource-definition') {
          const existing = this.repositories.resourceDefinitions.get(`resource-${candidate.key}`);
          this.repositories.resourceDefinitions.upsert({
            id: `resource-${candidate.key}`,
            createdAt: existing?.createdAt ?? now,
            updatedAt: now,
            revision: (existing?.revision ?? 0) + 1,
            key: candidate.key,
            label: asString(candidate.payload['label'], candidate.title),
            min: Number(candidate.payload['min'] ?? 0),
            max: candidate.payload['max'] === undefined ? undefined : Number(candidate.payload['max']),
            defaultValue: candidate.payload['defaultValue'] === undefined ? undefined : Number(candidate.payload['defaultValue']),
            warningAt: candidate.payload['warningAt'] === undefined ? undefined : Number(candidate.payload['warningAt']),
            ruleReferenceIds: [ruleReference.id],
          });
          this.upsertPublishedRef({
            id: `pub-${candidate.id}-resource`,
            createdAt: now,
            updatedAt: now,
            revision: 1,
            documentId: document.id,
            batchId: batch.id,
            candidateId: candidate.id,
            publishedEntityKind: 'resourceDefinition',
            publishedEntityId: `resource-${candidate.key}`,
          });
        }

        if (candidate.kind === 'action-definition') {
          const existing = this.repositories.actionDefinitions.get(`action-${candidate.key}`);
          this.repositories.actionDefinitions.upsert({
            id: `action-${candidate.key}`,
            createdAt: existing?.createdAt ?? now,
            updatedAt: now,
            revision: (existing?.revision ?? 0) + 1,
            key: candidate.key,
            label: asString(candidate.payload['label'], candidate.title),
            phase: (candidate.payload['phase'] as ActionDefinition['phase']) ?? 'combat',
            actionType: (candidate.payload['actionType'] as ActionDefinition['actionType']) ?? 'action',
            requiresTarget: Boolean(candidate.payload['requiresTarget']),
            requiresRoll: candidate.payload['requiresRoll'] !== false,
            defaultCosts: (candidate.payload['defaultCosts'] as Record<string, number>) ?? {},
            preconditions: Array.isArray(candidate.payload['preconditions']) ? (candidate.payload['preconditions'] as ActionDefinition['preconditions']) : [],
            tags: Array.isArray(candidate.payload['tags']) ? (candidate.payload['tags'] as string[]) : [candidate.key],
            resolutionTags: Array.isArray(candidate.payload['resolutionTags'])
              ? (candidate.payload['resolutionTags'] as string[])
              : [candidate.key],
            effects: normalizeEffects(candidate.payload['effects']),
            ruleReferenceIds: [ruleReference.id],
          });
          this.upsertPublishedRef({
            id: `pub-${candidate.id}-action`,
            createdAt: now,
            updatedAt: now,
            revision: 1,
            documentId: document.id,
            batchId: batch.id,
            candidateId: candidate.id,
            publishedEntityKind: 'actionDefinition',
            publishedEntityId: `action-${candidate.key}`,
          });
        }

        if (candidate.kind === 'condition-definition') {
          const existing = this.repositories.conditions.get(`condition-${candidate.key}`);
          this.repositories.conditions.upsert({
            id: `condition-${candidate.key}`,
            createdAt: existing?.createdAt ?? now,
            updatedAt: now,
            revision: (existing?.revision ?? 0) + 1,
            key: candidate.key,
            name: asString(candidate.payload['name'], candidate.title),
            category: (candidate.payload['category'] as Condition['category']) ?? 'combat',
            description: asString(candidate.payload['description'], candidate.excerpt),
            defaultDuration:
              typeof candidate.payload['defaultDuration'] === 'object' && candidate.payload['defaultDuration'] !== null
                ? (candidate.payload['defaultDuration'] as unknown as Condition['defaultDuration'])
                : undefined,
            stackMode: (candidate.payload['stackMode'] as Condition['stackMode']) ?? 'replace',
            ruleReferenceIds: [ruleReference.id],
          });
          this.upsertPublishedRef({
            id: `pub-${candidate.id}-condition`,
            createdAt: now,
            updatedAt: now,
            revision: 1,
            documentId: document.id,
            batchId: batch.id,
            candidateId: candidate.id,
            publishedEntityKind: 'condition',
            publishedEntityId: `condition-${candidate.key}`,
          });
        }

        if (candidate.kind === 'combat-procedure' || candidate.kind === 'conversation-procedure' || candidate.kind === 'endeavor-procedure' || candidate.kind === 'duration-mechanic') {
          const existing = this.repositories.resolutionHooks.get(`hook-${candidate.key}`);
          this.repositories.resolutionHooks.upsert({
            id: `hook-${candidate.key}`,
            createdAt: existing?.createdAt ?? now,
            updatedAt: now,
            revision: (existing?.revision ?? 0) + 1,
            key: candidate.key,
            when: (candidate.payload['when'] as ResolutionHook['when']) ?? 'action.resolve',
            mode: (candidate.payload['mode'] as ResolutionHook['mode']) ?? 'suggest',
            phase: (candidate.payload['phase'] as ResolutionHook['phase']) ?? this.phaseForCandidate(candidate.kind),
            resolutionTags: Array.isArray(candidate.payload['resolutionTags'])
              ? (candidate.payload['resolutionTags'] as string[])
              : [candidate.key],
            conditions: [],
            messages: normalizeMessages(candidate.payload['messages']),
            effects: normalizeEffects(candidate.payload['effects']),
            ruleReferenceIds: [ruleReference.id],
          });
          this.upsertPublishedRef({
            id: `pub-${candidate.id}-hook`,
            createdAt: now,
            updatedAt: now,
            revision: 1,
            documentId: document.id,
            batchId: batch.id,
            candidateId: candidate.id,
            publishedEntityKind: 'resolutionHook',
            publishedEntityId: `hook-${candidate.key}`,
          });
        }

        candidate.decision = 'published';
        candidate.updatedAt = now;
        candidate.revision += 1;
        this.upsertCandidate(candidate);
      }

      batch.status = 'published';
      batch.updatedAt = now;
      batch.revision += 1;
      document.status = 'published';
      document.updatedAt = now;
      document.revision += 1;
      this.upsertBatch(batch);
      this.upsertDocument(document);
      this.recountBatch(batch.id);
    });

    transaction();
    return this.getReviewDocument(documentId);
  }

  private assertManifest(manifest: ImportArtifactManifest): void {
    if (!manifest.documentId || !manifest.sourceKind || !manifest.fileChecksum || !manifest.pageCount) {
      throw new HttpError(400, 'Artifact manifest is incomplete.');
    }
  }

  private assertArtifacts(
    manifest: ImportArtifactManifest,
    pages: ImportedPageArtifact[],
    blocks: ImportedBlockArtifact[],
    candidates: ImportedCandidateArtifact[],
  ): void {
    if (pages.length !== manifest.pageCount) {
      throw new HttpError(400, 'Artifact page count does not match the manifest.');
    }
    if (pages.some((page) => page.documentId !== manifest.documentId)) {
      throw new HttpError(400, 'A page artifact references the wrong document id.');
    }
    if (blocks.some((block) => block.documentId !== manifest.documentId)) {
      throw new HttpError(400, 'A block artifact references the wrong document id.');
    }
    if (candidates.some((candidate) => candidate.documentId !== manifest.documentId)) {
      throw new HttpError(400, 'A candidate artifact references the wrong document id.');
    }
  }

  private getDocument(documentId: string): SourceDocument | undefined {
    const row = this.database.prepare(`SELECT data FROM source_documents WHERE id = ?`).get(documentId) as { data: string } | undefined;
    return row ? parseJson<SourceDocument>(row.data) : undefined;
  }

  private findDocumentByChecksum(checksum: string): SourceDocument | undefined {
    const row = this.database.prepare(`SELECT data FROM source_documents WHERE checksum = ?`).get(checksum) as { data: string } | undefined;
    return row ? parseJson<SourceDocument>(row.data) : undefined;
  }

  private getBatch(batchId: string): ImportBatch | undefined {
    const row = this.database.prepare(`SELECT data FROM import_batches WHERE id = ?`).get(batchId) as { data: string } | undefined;
    return row ? parseJson<ImportBatch>(row.data) : undefined;
  }

  private getCandidate(candidateId: string): ImportCandidate | undefined {
    const row = this.database.prepare(`SELECT data FROM import_candidates WHERE id = ?`).get(candidateId) as { data: string } | undefined;
    return row ? parseJson<ImportCandidate>(row.data) : undefined;
  }

  private buildDocumentSummary(documentId: string): ImportDocumentSummary {
    const document = this.getDocument(documentId);
    if (!document) {
      throw new HttpError(404, 'Imported document not found.');
    }
    const batch = document.latestBatchId ? this.getBatch(document.latestBatchId) : undefined;
    const candidates = this.database
      .prepare(`SELECT decision FROM import_candidates WHERE document_id = ?`)
      .all(documentId)
      .map((row) => String((row as { decision: string }).decision));
    const publishedCount = (
      this.database.prepare(`SELECT COUNT(*) as count FROM published_artifact_refs WHERE document_id = ?`).get(documentId) as {
        count: number;
      }
    ).count;
    return {
      document,
      batch,
      pendingCount: candidates.filter((decision) => decision === 'pending').length,
      acceptedCount: candidates.filter((decision) => decision === 'accepted' || decision === 'edited' || decision === 'published').length,
      rejectedCount: candidates.filter((decision) => decision === 'rejected').length,
      publishedCount,
    };
  }

  private recountBatch(batchId: string): void {
    const batch = this.getBatch(batchId);
    if (!batch) {
      return;
    }
    const decisions = this.database
      .prepare(`SELECT decision FROM import_candidates WHERE batch_id = ?`)
      .all(batchId)
      .map((row) => String((row as { decision: string }).decision));
    batch.acceptedCount = decisions.filter((decision) => decision === 'accepted' || decision === 'edited' || decision === 'published').length;
    batch.rejectedCount = decisions.filter((decision) => decision === 'rejected').length;
    batch.updatedAt = nowIso();
    batch.revision += 1;
    this.upsertBatch(batch);
  }

  private upsertDocument(document: SourceDocument): void {
    this.database
      .prepare(
        `INSERT INTO source_documents (id, data, checksum, status) VALUES (?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET data = excluded.data, checksum = excluded.checksum, status = excluded.status`,
      )
      .run(document.id, JSON.stringify(document), document.checksum, document.status);
  }

  private upsertBatch(batch: ImportBatch): void {
    this.database
      .prepare(
        `INSERT INTO import_batches (id, document_id, data, status) VALUES (?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET data = excluded.data, status = excluded.status`,
      )
      .run(batch.id, batch.documentId, JSON.stringify(batch), batch.status);
  }

  private upsertCandidate(candidate: ImportCandidate): void {
    this.database
      .prepare(
        `INSERT INTO import_candidates (id, document_id, batch_id, decision, title, kind, data) VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET decision = excluded.decision, title = excluded.title, kind = excluded.kind, data = excluded.data`,
      )
      .run(candidate.id, candidate.documentId, candidate.batchId, candidate.decision, candidate.title, candidate.kind, JSON.stringify(candidate));
  }

  private upsertPublishedRef(reference: PublishedArtifactRef): void {
    this.database
      .prepare(
        `INSERT INTO published_artifact_refs (id, document_id, candidate_id, data) VALUES (?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET data = excluded.data`,
      )
      .run(reference.id, reference.documentId, reference.candidateId, JSON.stringify(reference));
  }

  private candidatePageLabel(candidate: ImportCandidate): string {
    const pages = candidate.sourceBlockIds
      .map((id) => this.database.prepare(`SELECT page_number FROM source_blocks WHERE id = ?`).get(id) as { page_number: number } | undefined)
      .filter((row): row is { page_number: number } => Boolean(row))
      .map((row) => row.page_number);
    if (!pages.length) {
      return '0';
    }
    const min = Math.min(...pages);
    const max = Math.max(...pages);
    return min === max ? `${min}` : `${min}-${max}`;
  }

  private ruleCategoryForCandidate(candidateKind: ImportCandidate['kind']): RuleReference['category'] {
    switch (candidateKind) {
      case 'resource-definition':
        return 'resource';
      case 'action-definition':
        return 'action';
      case 'condition-definition':
        return 'condition';
      case 'conversation-procedure':
        return 'conversation';
      case 'endeavor-procedure':
        return 'endeavor';
      default:
        return 'combat';
    }
  }

  private phaseForCandidate(candidateKind: ImportCandidate['kind']): ActionDefinition['phase'] {
    switch (candidateKind) {
      case 'conversation-procedure':
        return 'conversation';
      case 'endeavor-procedure':
        return 'endeavor';
      default:
        return 'combat';
    }
  }
}

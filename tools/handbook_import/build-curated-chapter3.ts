import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type {
  ImportArtifactManifest,
  ImportedBlockArtifact,
  ImportedCandidateArtifact,
  ImportedPageArtifact,
} from '../../shared/domain/campaign-models';
import {
  CHAPTER_3_CURATED_CANDIDATES,
  CHAPTER_3_DOCUMENT_ID,
  CHAPTER_3_EXTRACTOR_VERSION,
  CHAPTER_3_PAGE_NUMBERS,
  CHAPTER_3_PROFILE,
  CHAPTER_3_SOURCE_KIND,
  CHAPTER_3_SOURCE_PATH,
  CHAPTER_3_TITLE,
  type CuratedChapterCandidateSource,
} from './curated/chapter3-character-statistics';

const DEFAULT_OUTPUT_DIR = '.import-cache/chapter-3-character-statistics';
const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const MAX_EXCERPT_LENGTH = 320;

export interface CuratedArtifactData {
  manifest: ImportArtifactManifest;
  pages: ImportedPageArtifact[];
  blocks: ImportedBlockArtifact[];
  candidates: ImportedCandidateArtifact[];
}

function sha256Text(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function normalizeText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function candidateId(source: CuratedChapterCandidateSource): string {
  const digest = sha256Text([source.kind, source.key, source.pageNumber, CHAPTER_3_EXTRACTOR_VERSION].join('|')).slice(0, 20);
  return `${CHAPTER_3_DOCUMENT_ID}:cand:${digest}`;
}

function blockId(pageNumber: number, blockIndex: number): string {
  return `${CHAPTER_3_DOCUMENT_ID}:block:${pageNumber}:${blockIndex}`;
}

function blockBoundingBox(blockIndex: number): ImportedBlockArtifact['bbox'] {
  const top = 72 + blockIndex * 26;
  return {
    x0: 48,
    y0: top,
    x1: 564,
    y1: top + 18,
  };
}

function writeJsonLines(filePath: string, rows: readonly object[]): Promise<void> {
  const contents = rows.map((row) => `${JSON.stringify(row, null, 0)}\n`).join('');
  return writeFile(filePath, contents, 'utf-8');
}

export function buildChapter3CuratedArtifactData(extractedAt = new Date().toISOString()): CuratedArtifactData {
  const nextBlockIndexByPage = new Map<number, number>();
  const pageTexts = new Map<number, string[]>();
  const blocks: ImportedBlockArtifact[] = [];
  const candidates: ImportedCandidateArtifact[] = [];

  for (const source of CHAPTER_3_CURATED_CANDIDATES) {
    const blockIndex = nextBlockIndexByPage.get(source.pageNumber) ?? 0;
    nextBlockIndexByPage.set(source.pageNumber, blockIndex + 1);

    const excerpt = normalizeText(source.excerpt).slice(0, MAX_EXCERPT_LENGTH);
    const block: ImportedBlockArtifact = {
      id: blockId(source.pageNumber, blockIndex),
      documentId: CHAPTER_3_DOCUMENT_ID,
      pageNumber: source.pageNumber,
      blockIndex,
      kind: 'body',
      bbox: blockBoundingBox(blockIndex),
      text: excerpt,
      checksum: sha256Text(excerpt),
    };
    blocks.push(block);
    pageTexts.set(source.pageNumber, [...(pageTexts.get(source.pageNumber) ?? []), excerpt]);

    candidates.push({
      id: candidateId(source),
      documentId: CHAPTER_3_DOCUMENT_ID,
      kind: source.kind,
      title: source.title,
      key: source.key,
      confidence: 0.99,
      excerpt,
      sourceBlockIds: [block.id],
      payload: source.payload,
    });
  }

  const pages: ImportedPageArtifact[] = CHAPTER_3_PAGE_NUMBERS.map((pageNumber) => {
    const previewText = normalizeText((pageTexts.get(pageNumber) ?? []).join(' ')).slice(0, 280);
    return {
      documentId: CHAPTER_3_DOCUMENT_ID,
      pageNumber,
      width: PAGE_WIDTH,
      height: PAGE_HEIGHT,
      wordCount: previewText ? previewText.split(/\s+/).length : 0,
      checksum: sha256Text(previewText || `page-${pageNumber}`),
      previewText,
      hasText: true,
      needsOcr: false,
    };
  });

  const fileChecksum = sha256Text(
    JSON.stringify({
      title: CHAPTER_3_TITLE,
      pages,
      blocks,
      candidates,
    }),
  );

  const manifest: ImportArtifactManifest = {
    documentId: CHAPTER_3_DOCUMENT_ID,
    sourceKind: CHAPTER_3_SOURCE_KIND,
    profile: CHAPTER_3_PROFILE,
    title: CHAPTER_3_TITLE,
    sourcePath: CHAPTER_3_SOURCE_PATH,
    fileChecksum,
    extractorVersion: CHAPTER_3_EXTRACTOR_VERSION,
    extractedAt,
    pageCount: CHAPTER_3_PAGE_NUMBERS.length,
  };

  return {
    manifest,
    pages,
    blocks,
    candidates,
  };
}

export async function writeChapter3CuratedArtifact(outputDir = DEFAULT_OUTPUT_DIR): Promise<string> {
  const absoluteOutputDir = path.resolve(process.cwd(), outputDir);
  const artifact = buildChapter3CuratedArtifactData();
  await mkdir(absoluteOutputDir, { recursive: true });
  await writeFile(path.join(absoluteOutputDir, 'manifest.json'), `${JSON.stringify(artifact.manifest, null, 2)}\n`, 'utf-8');
  await writeJsonLines(path.join(absoluteOutputDir, 'pages.jsonl'), artifact.pages);
  await writeJsonLines(path.join(absoluteOutputDir, 'blocks.jsonl'), artifact.blocks);
  await writeJsonLines(path.join(absoluteOutputDir, 'candidates.jsonl'), artifact.candidates);
  return absoluteOutputDir;
}

async function main(): Promise<void> {
  const outputIndex = process.argv.indexOf('--out');
  const outputDir = outputIndex >= 0 ? process.argv[outputIndex + 1] ?? DEFAULT_OUTPUT_DIR : DEFAULT_OUTPUT_DIR;
  const artifactPath = await writeChapter3CuratedArtifact(outputDir);
  process.stdout.write(`Wrote curated Chapter 3 artifact to ${artifactPath}\n`);
}

export { DEFAULT_OUTPUT_DIR, main as runChapter3CuratedArtifactBuild };

from __future__ import annotations

import argparse
import hashlib
import json
import re
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from statistics import median
from typing import Iterable

import fitz

from . import EXTRACTOR_VERSION


STOP_WORDS = {
    'about',
    'after',
    'against',
    'among',
    'before',
    'between',
    'chapter',
    'during',
    'every',
    'focus',
    'handbook',
    'their',
    'there',
    'these',
    'those',
    'through',
    'under',
    'while',
    'would',
}


@dataclass(frozen=True)
class BlockRecord:
    id: str
    page_number: int
    block_index: int
    kind: str
    heading_level: int | None
    text: str
    checksum: str
    bbox: dict[str, float]
    font_size: float


def sha256_text(value: str) -> str:
    return hashlib.sha256(value.encode('utf-8')).hexdigest()


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open('rb') as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b''):
            digest.update(chunk)
    return digest.hexdigest()


def normalize_text(value: str) -> str:
    return re.sub(r'\s+', ' ', value).strip()


def slugify(value: str) -> str:
    slug = re.sub(r'[^a-z0-9]+', '-', value.lower()).strip('-')
    return slug or 'untitled'


def infer_keywords(title: str, body: str) -> list[str]:
    words = re.findall(r"[A-Za-z][A-Za-z'-]{3,}", f'{title} {body}'.lower())
    seen: list[str] = []
    for word in words:
        if word in STOP_WORDS or word in seen:
            continue
        seen.append(word)
    return seen[:6]


def infer_category(title: str, body: str) -> str:
    text = f'{title} {body}'.lower()
    if 'conversation' in text or 'focus' in text or 'social' in text:
        return 'conversation'
    if 'condition' in text or 'fatigue' in text or 'injury' in text:
        return 'condition'
    if 'action' in text or 'reaction' in text or 'attack' in text:
        return 'action'
    if 'resource' in text or 'health' in text or 'investiture' in text:
        return 'resource'
    if 'endeavor' in text or 'infiltration' in text or 'obstacle' in text:
        return 'endeavor'
    return 'combat'


def infer_phase(title: str, body: str) -> str:
    text = f'{title} {body}'.lower()
    if 'conversation' in text or 'focus' in text or 'social' in text:
        return 'conversation'
    if 'endeavor' in text or 'infiltration' in text or 'obstacle' in text or 'mission' in text:
        return 'endeavor'
    return 'combat'


def infer_action_type(title: str, body: str) -> str:
    text = f'{title} {body}'.lower()
    if 'reaction' in text:
        return 'reaction'
    if 'free' in text:
        return 'free'
    return 'action'


def infer_hook_when(kind: str) -> str:
    if kind == 'conversation-procedure':
        return 'conversation.exchange'
    if kind == 'duration-mechanic':
        return 'condition.tick'
    if kind == 'endeavor-procedure':
        return 'endeavor.approach.resolve'
    return 'action.resolve'


def classify_candidate_kind(title: str, body: str) -> str:
    text = f'{title} {body}'.lower()
    if 'condition' in text or 'fatigued' in text or 'restrained' in text:
        return 'condition-definition'
    if 'health' in text or 'focus' in text or 'investiture' in text or 'resource' in text:
        return 'resource-definition'
    if 'reaction' in text or 'action' in text or 'attack' in text or 'maneuver' in text:
        return 'action-definition'
    if 'duration' in text or 'until' in text or 'rounds' in text or 'turns' in text:
        return 'duration-mechanic'
    if 'conversation' in text or 'focus' in text or 'leverage' in text:
        return 'conversation-procedure'
    if 'endeavor' in text or 'obstacle' in text or 'infiltration' in text or 'mission' in text:
        return 'endeavor-procedure'
    if 'combat' in text or 'turn' in text or 'initiative' in text:
        return 'combat-procedure'
    return 'rule-section'


def build_payload(kind: str, title: str, body: str, excerpt: str) -> dict[str, object]:
    key = slugify(title)
    keywords = infer_keywords(title, body)
    if kind == 'resource-definition':
      return {
            'key': key,
            'label': title,
            'min': 0,
            'max': 10,
            'defaultValue': 0,
            'warningAt': 1,
            'excerpt': excerpt,
            'keywords': keywords,
        }

    if kind == 'action-definition':
        text = f'{title} {body}'.lower()
        costs: dict[str, int] = {'focus': 1} if 'focus' in text else {}
        return {
            'key': key,
            'label': title,
            'phase': infer_phase(title, body),
            'actionType': infer_action_type(title, body),
            'requiresTarget': 'target' in text or 'creature' in text,
            'requiresRoll': True,
            'defaultCosts': costs,
            'preconditions': [],
            'tags': keywords,
            'resolutionTags': keywords[:3],
            'effects': [],
            'excerpt': excerpt,
        }

    if kind == 'condition-definition':
        duration = {'unit': 'scene'} if 'scene' in body.lower() else {'unit': 'turn', 'value': 1}
        return {
            'key': key,
            'name': title,
            'category': infer_phase(title, body),
            'description': excerpt,
            'stackMode': 'replace',
            'defaultDuration': duration,
        }

    if kind in {'combat-procedure', 'conversation-procedure', 'endeavor-procedure', 'duration-mechanic'}:
        return {
            'key': key,
            'title': title,
            'phase': infer_phase(title, body),
            'when': infer_hook_when(kind),
            'mode': 'suggest',
            'resolutionTags': keywords[:3],
            'messages': [{'severity': 'info', 'text': excerpt}],
            'effects': [],
        }

    return {
        'key': key,
        'title': title,
        'category': infer_category(title, body),
        'excerpt': excerpt,
        'parsedTerms': keywords,
    }


def write_json(path: Path, payload: object) -> None:
    path.write_text(json.dumps(payload, indent=2, ensure_ascii=True) + '\n', encoding='utf-8')


def write_jsonl(path: Path, rows: Iterable[object]) -> None:
    with path.open('w', encoding='utf-8') as handle:
        for row in rows:
            handle.write(json.dumps(row, ensure_ascii=True, sort_keys=True))
            handle.write('\n')


def extract_blocks(document_id: str, page_number: int, page: fitz.Page) -> list[BlockRecord]:
    raw = page.get_text('dict')
    text_blocks: list[tuple[str, tuple[float, float, float, float], float]] = []
    for block in raw.get('blocks', []):
        lines = block.get('lines', [])
        spans = [
            span
            for line in lines
            for span in line.get('spans', [])
            if normalize_text(str(span.get('text', '')))
        ]
        if not spans:
            continue
        text = normalize_text(' '.join(str(span.get('text', '')) for span in spans))
        if not text:
            continue
        sizes = [float(span.get('size', 0.0)) for span in spans if span.get('size')]
        font_size = round(sum(sizes) / len(sizes), 2) if sizes else 0.0
        bbox = tuple(float(value) for value in block.get('bbox', (0.0, 0.0, 0.0, 0.0)))
        text_blocks.append((text, bbox, font_size))

    if not text_blocks:
        return []

    font_sizes = [font_size for _, _, font_size in text_blocks if font_size > 0]
    baseline = median(font_sizes) if font_sizes else 10.0
    records: list[BlockRecord] = []

    for block_index, (text, bbox, font_size) in enumerate(text_blocks):
        is_heading = (
            font_size >= baseline * 1.14 and len(text) <= 160
        ) or (text.isupper() and len(text) <= 120) or text.endswith(':')
        kind = 'list' if re.match(r'^[\-\u2022*]\s', text) else 'heading' if is_heading else 'body'
        heading_level = 1 if is_heading and font_size >= baseline * 1.28 else 2 if is_heading else None
        records.append(
            BlockRecord(
                id=f'{document_id}:p{page_number}:b{block_index}',
                page_number=page_number,
                block_index=block_index,
                kind=kind,
                heading_level=heading_level,
                text=text,
                checksum=sha256_text(text),
                bbox={'x0': bbox[0], 'y0': bbox[1], 'x1': bbox[2], 'y1': bbox[3]},
                font_size=font_size,
            )
        )

    return records


def build_candidate_artifacts(document_id: str, blocks: list[BlockRecord]) -> list[dict[str, object]]:
    candidates: list[dict[str, object]] = []
    heading_indices = [index for index, block in enumerate(blocks) if block.kind == 'heading']

    if not heading_indices:
        return candidates

    for offset, start_index in enumerate(heading_indices):
        end_index = heading_indices[offset + 1] if offset + 1 < len(heading_indices) else len(blocks)
        section_blocks = blocks[start_index:end_index]
        title = section_blocks[0].text
        body_blocks = section_blocks[1:] or section_blocks[:1]
        body = normalize_text(' '.join(block.text for block in body_blocks))
        excerpt = normalize_text(body[:320] or title[:320])
        candidate_kind = classify_candidate_kind(title, body)
        key = slugify(title)
        source_block_ids = [block.id for block in section_blocks]
        candidate_id = f'{document_id}:cand:{sha256_text("|".join([candidate_kind, key, EXTRACTOR_VERSION, *source_block_ids]))[:20]}'
        confidence = 0.88 if candidate_kind != 'rule-section' else 0.72
        payload = build_payload(candidate_kind, title, body, excerpt)
        candidates.append(
            {
                'id': candidate_id,
                'documentId': document_id,
                'kind': candidate_kind,
                'title': title,
                'key': key,
                'confidence': confidence,
                'excerpt': excerpt,
                'sourceBlockIds': source_block_ids,
                'payload': payload,
            }
        )

    return candidates


def extract(source: Path, profile: str, out_dir: Path) -> None:
    checksum = sha256_file(source)
    document_id = f'doc-{checksum[:16]}'
    out_dir.mkdir(parents=True, exist_ok=True)

    document = fitz.open(source)
    extracted_at = datetime.fromtimestamp(source.stat().st_mtime, timezone.utc).isoformat()
    page_rows: list[dict[str, object]] = []
    block_rows: list[dict[str, object]] = []
    candidate_rows: list[dict[str, object]] = []

    for page_index in range(document.page_count):
        page = document.load_page(page_index)
        page_number = page_index + 1
        blocks = extract_blocks(document_id, page_number, page)
        preview_text = normalize_text(' '.join(block.text for block in blocks)[:280])
        page_checksum = sha256_text('\n'.join(block.text for block in blocks))
        word_count = len(re.findall(r'\S+', preview_text))
        page_rows.append(
            {
                'documentId': document_id,
                'pageNumber': page_number,
                'width': round(float(page.rect.width), 2),
                'height': round(float(page.rect.height), 2),
                'wordCount': word_count,
                'checksum': page_checksum,
                'previewText': preview_text,
                'hasText': bool(blocks),
                'needsOcr': not bool(blocks),
            }
        )
        for block in blocks:
            block_rows.append(
                {
                    'id': block.id,
                    'documentId': document_id,
                    'pageNumber': block.page_number,
                    'blockIndex': block.block_index,
                    'kind': block.kind,
                    'headingLevel': block.heading_level,
                    'bbox': block.bbox,
                    'text': block.text,
                    'checksum': block.checksum,
                }
            )
        candidate_rows.extend(build_candidate_artifacts(document_id, blocks))

    manifest = {
        'documentId': document_id,
        'sourceKind': 'stormlight-handbook',
        'profile': profile,
        'title': source.stem.replace('_', ' '),
        'sourcePath': str(source.resolve()),
        'fileChecksum': checksum,
        'extractorVersion': EXTRACTOR_VERSION,
        'extractedAt': extracted_at,
        'pageCount': document.page_count,
    }

    write_json(out_dir / 'manifest.json', manifest)
    write_jsonl(out_dir / 'pages.jsonl', page_rows)
    write_jsonl(out_dir / 'blocks.jsonl', block_rows)
    write_jsonl(out_dir / 'candidates.jsonl', candidate_rows)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description='Extract deterministic handbook import artifacts.')
    subparsers = parser.add_subparsers(dest='command', required=True)

    extract_parser = subparsers.add_parser('extract')
    extract_parser.add_argument('--source', required=True)
    extract_parser.add_argument('--profile', required=True)
    extract_parser.add_argument('--out', required=True)
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    if args.command != 'extract':
        raise ValueError(f'Unsupported command: {args.command}')

    source = Path(args.source)
    out_dir = Path(args.out)
    if not source.exists():
        raise FileNotFoundError(f'Source PDF not found: {source}')

    extract(source=source, profile=args.profile, out_dir=out_dir)
    return 0

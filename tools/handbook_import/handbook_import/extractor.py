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

RESOURCE_LABELS = ('health', 'focus', 'investiture')
KNOWN_CONDITIONS = {
    'bleeding',
    'blinded',
    'dazed',
    'disoriented',
    'exhausted',
    'fatigued',
    'frightened',
    'grappled',
    'immobilized',
    'incapacitated',
    'prone',
    'restrained',
    'stunned',
    'unconscious',
}
RULE_SECTION_HEADINGS = {
    'how many scenes?',
}
ACTION_SECTION_HEADINGS = {'actions', 'reactions'}
SECTION_LABELS = {'actions', 'reactions', 'features'}
PROCEDURE_TITLES = {
    'building combat scenes': 'combat-procedure',
    'using events': 'combat-procedure',
    'flow of play': 'combat-procedure',
    'current and maximum': 'combat-procedure',
    'defeated adversaries': 'combat-procedure',
    'transitioning between scenes': 'conversation-procedure',
    'consider objectives': 'conversation-procedure',
    'conversation opportunities and complications': 'conversation-procedure',
    'socializing opportunities and complications': 'conversation-procedure',
    'conversation order': 'conversation-procedure',
    'endeavors': 'endeavor-procedure',
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


@dataclass(frozen=True)
class SectionRecord:
    title_block: BlockRecord
    body_blocks: tuple[BlockRecord, ...]
    title: str
    body: str

    @property
    def all_blocks(self) -> tuple[BlockRecord, ...]:
        return (self.title_block, *self.body_blocks)


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


def looks_like_footer(text: str) -> bool:
    lowered = text.lower()
    return lowered.startswith('chapter ') or re.fullmatch(r'\d+', text.strip()) is not None


def looks_like_heading(text: str, font_size: float, baseline: float) -> bool:
    cleaned = normalize_text(text)
    if not cleaned or looks_like_footer(cleaned):
        return False
    if len(cleaned) > 96:
        return False
    if cleaned.endswith('.') and ':' not in cleaned:
        return False
    lowered = cleaned.lower()
    if lowered in SECTION_LABELS:
        return True
    if font_size >= baseline * 1.45:
        return True
    if font_size >= baseline * 1.18 and not re.search(r'[.!?]\s', cleaned):
        return True
    if font_size >= baseline * 1.08 and len(cleaned.split()) <= 2 and len(cleaned) <= 24 and ':' not in cleaned:
        return True
    return cleaned.isupper() and len(cleaned) <= 72


def block_sort_key(block: tuple[str, tuple[float, float, float, float], float], page_width: float) -> tuple[int, int, float, float]:
    _, bbox, _ = block
    x0, y0, x1, _ = bbox
    width = max(0.0, x1 - x0)
    full_width = width >= page_width * 0.55
    column = 0 if full_width else 1 if x0 < page_width * 0.5 else 2
    row_band = int(round(y0 / 14))
    return (row_band, column, y0, x0)


def extract_blocks(document_id: str, page_number: int, page: fitz.Page) -> list[BlockRecord]:
    raw = page.get_text('dict')
    page_width = float(page.rect.width)
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

    text_blocks.sort(key=lambda entry: block_sort_key(entry, page_width))
    font_sizes = [font_size for _, _, font_size in text_blocks if font_size > 0]
    baseline = median(font_sizes) if font_sizes else 10.0
    records: list[BlockRecord] = []

    for block_index, (text, bbox, font_size) in enumerate(text_blocks):
        if looks_like_footer(text):
            kind = 'quote'
            heading_level = None
        else:
            is_heading = looks_like_heading(text, font_size, baseline)
            is_list = bool(re.match(r'^[\-\u2022*]\s', text))
            kind = 'list' if is_list else 'heading' if is_heading else 'body'
            heading_level = 1 if is_heading and font_size >= baseline * 1.32 else 2 if is_heading else None
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


def build_sections(blocks: list[BlockRecord]) -> list[SectionRecord]:
    sections: list[SectionRecord] = []
    heading_indices = [index for index, block in enumerate(blocks) if block.kind == 'heading']
    for offset, start_index in enumerate(heading_indices):
        end_index = heading_indices[offset + 1] if offset + 1 < len(heading_indices) else len(blocks)
        title_block = blocks[start_index]
        body_blocks = tuple(
            block
            for block in blocks[start_index + 1:end_index]
            if block.kind in {'body', 'list'} and not looks_like_footer(block.text)
        )
        body = normalize_text(' '.join(block.text for block in body_blocks))
        sections.append(
            SectionRecord(
                title_block=title_block,
                body_blocks=body_blocks,
                title=title_block.text,
                body=body,
            )
        )
    return sections


def make_candidate(
    document_id: str,
    kind: str,
    title: str,
    source_blocks: Iterable[BlockRecord],
    payload: dict[str, object],
    confidence: float,
    excerpt: str,
) -> dict[str, object]:
    block_ids = list(dict.fromkeys(block.id for block in source_blocks))
    key = slugify(title)
    candidate_id = f'{document_id}:cand:{sha256_text("|".join([kind, key, EXTRACTOR_VERSION, *block_ids]))[:20]}'
    return {
        'id': candidate_id,
        'documentId': document_id,
        'kind': kind,
        'title': title,
        'key': key,
        'confidence': round(confidence, 2),
        'excerpt': normalize_text(excerpt[:320] or title[:320]),
        'sourceBlockIds': block_ids,
        'payload': payload,
    }


def action_title_from_text(text: str) -> str | None:
    compact = normalize_text(text)
    if not compact or len(compact) < 12:
        return None
    colon = re.match(r'^([A-Z][A-Za-z0-9\'’\-\s]{2,48}?):\s', compact)
    if colon:
        return normalize_text(colon.group(1))
    sentence = compact.split('. ', 1)[0].rstrip('.')
    if 2 <= len(sentence.split()) <= 8 and len(sentence) <= 64 and sentence[:1].isupper():
        return sentence
    return None


def parse_action_costs(text: str) -> dict[str, int]:
    match = re.search(r'costs?\s+(\d+)\s+focus', text, flags=re.IGNORECASE)
    return {'focus': int(match.group(1))} if match else {}


def build_action_candidates(document_id: str, section: SectionRecord) -> list[dict[str, object]]:
    candidates: list[dict[str, object]] = []
    subsection_markers = [
        index
        for index, block in enumerate(section.body_blocks)
        if normalize_text(block.text).lower() in ACTION_SECTION_HEADINGS
    ]
    if normalize_text(section.title).lower() in ACTION_SECTION_HEADINGS:
        subsection_markers = [-1, *subsection_markers]
    if not subsection_markers:
        return []

    section_breaks = [
        index
        for index, block in enumerate(section.body_blocks)
        if normalize_text(block.text).lower() in SECTION_LABELS
    ]
    for marker_index in subsection_markers:
        marker_block = section.title_block if marker_index == -1 else section.body_blocks[marker_index]
        marker_title = normalize_text(marker_block.text).lower()
        if marker_title not in ACTION_SECTION_HEADINGS:
            continue
        end_index = len(section.body_blocks)
        for candidate_break in section_breaks:
            if candidate_break > marker_index:
                end_index = candidate_break
                break
        start_index = 0 if marker_index == -1 else marker_index + 1
        for block in section.body_blocks[start_index:end_index]:
            entry_title = action_title_from_text(block.text)
            if not entry_title:
                continue
            lowered = block.text.lower()
            strong_signal_count = sum(
                1
                for signal in ('attack', 'graze', 'hit', 'costs', 'target', 'dc ', 'test', 'feet', 'damage')
                if signal in lowered
            )
            if strong_signal_count < 2:
                continue
            payload = {
                'key': slugify(entry_title),
                'label': entry_title,
                'phase': 'combat',
                'actionType': 'reaction' if marker_title == 'reactions' or 'reaction' in lowered else 'action',
                'requiresTarget': any(token in lowered for token in ('target', 'enemy', 'ally', 'character', 'creature')),
                'requiresRoll': any(token in lowered for token in ('attack', 'test', 'dc ', 'opposed')),
                'defaultCosts': parse_action_costs(lowered),
                'preconditions': [],
                'tags': infer_keywords(entry_title, block.text),
                'resolutionTags': infer_keywords(entry_title, block.text)[:3],
                'effects': [],
                'excerpt': block.text[:320],
            }
            candidates.append(
                make_candidate(
                    document_id=document_id,
                    kind='action-definition',
                    title=entry_title,
                    source_blocks=(section.title_block, marker_block, block),
                    payload=payload,
                    confidence=0.97,
                    excerpt=block.text,
                )
            )
    return candidates


def parse_resource_matches(text: str) -> list[tuple[str, int, int | None, int | None]]:
    pattern = re.compile(
        r'\b(Health|Focus|Investiture)\s*:\s*(\d+)(?:\s*\((\d+)\s*[–-]\s*(\d+)\))?',
        flags=re.IGNORECASE,
    )
    matches: list[tuple[str, int, int | None, int | None]] = []
    for label, current, minimum, maximum in pattern.findall(text):
        matches.append(
            (
                label.lower(),
                int(current),
                int(minimum) if minimum else None,
                int(maximum) if maximum else None,
            )
        )
    return matches


def build_resource_candidates(document_id: str, blocks: list[BlockRecord]) -> list[dict[str, object]]:
    candidates: list[dict[str, object]] = []
    for block in blocks:
        matches = parse_resource_matches(block.text)
        if len(matches) < 2:
            continue
        for label, current, minimum, maximum in matches:
            payload: dict[str, object] = {
                'key': label,
                'label': label.title(),
                'min': minimum if minimum is not None else 0,
                'excerpt': block.text[:320],
            }
            if maximum is not None:
                payload['max'] = maximum
            else:
                payload['max'] = current
            payload['defaultValue'] = current
            candidates.append(
                make_candidate(
                    document_id=document_id,
                    kind='resource-definition',
                    title=label.title(),
                    source_blocks=(block,),
                    payload=payload,
                    confidence=0.99,
                    excerpt=block.text,
                )
            )
    return candidates


def default_duration_from_text(text: str) -> dict[str, object] | None:
    lowered = text.lower()
    if 'until the end of the scene' in lowered:
        return {'unit': 'scene'}
    round_match = re.search(r'for\s+(\d+)\s+rounds?', lowered)
    if round_match:
        return {'unit': 'round', 'value': int(round_match.group(1))}
    if 'until the end of their next turn' in lowered or 'until the end of the next turn' in lowered:
        return {'unit': 'turn', 'value': 1}
    return None


def build_condition_candidates(document_id: str, sections: list[SectionRecord]) -> list[dict[str, object]]:
    candidates: list[dict[str, object]] = []
    for section in sections:
        title = normalize_text(section.title)
        lowered_title = title.lower()
        if lowered_title not in KNOWN_CONDITIONS and 'condition' not in lowered_title:
            continue
        if len(section.body) < 60:
            continue
        payload: dict[str, object] = {
            'key': slugify(title),
            'name': title,
            'category': 'combat',
            'description': section.body[:320],
            'stackMode': 'replace',
        }
        duration = default_duration_from_text(section.body)
        if duration:
            payload['defaultDuration'] = duration
        candidates.append(
            make_candidate(
                document_id=document_id,
                kind='condition-definition',
                title=title,
                source_blocks=section.all_blocks,
                payload=payload,
                confidence=0.9,
                excerpt=section.body,
            )
        )
    return candidates


def classify_procedure_section(section: SectionRecord) -> str | None:
    title = normalize_text(section.title).lower()
    body = section.body.lower()
    if title in PROCEDURE_TITLES:
        return PROCEDURE_TITLES[title]
    if len(section.body) < 160:
        return None
    if 'duration' in title and any(token in body for token in ('each round', 'each turn', 'until the end', 'until the start')):
        return 'duration-mechanic'
    return None


def build_procedure_candidates(document_id: str, sections: list[SectionRecord]) -> list[dict[str, object]]:
    candidates: list[dict[str, object]] = []
    for section in sections:
        kind = classify_procedure_section(section)
        if not kind:
            continue
        payload = {
            'key': slugify(section.title),
            'title': section.title,
            'phase': 'conversation'
            if kind == 'conversation-procedure'
            else 'endeavor'
            if kind == 'endeavor-procedure'
            else 'combat',
            'when': 'conversation.exchange'
            if kind == 'conversation-procedure'
            else 'endeavor.approach.resolve'
            if kind == 'endeavor-procedure'
            else 'condition.tick'
            if kind == 'duration-mechanic'
            else 'action.resolve',
            'mode': 'suggest',
            'resolutionTags': infer_keywords(section.title, section.body)[:3],
            'messages': [{'severity': 'info', 'text': section.body[:320]}],
            'effects': [],
        }
        candidates.append(
            make_candidate(
                document_id=document_id,
                kind=kind,
                title=section.title,
                source_blocks=section.all_blocks,
                payload=payload,
                confidence=0.9,
                excerpt=section.body,
            )
        )
    return candidates


def build_rule_section_candidates(document_id: str, sections: list[SectionRecord]) -> list[dict[str, object]]:
    candidates: list[dict[str, object]] = []
    for section in sections:
        title = normalize_text(section.title).lower()
        if title not in RULE_SECTION_HEADINGS:
            continue
        if len(section.body) < 120:
            continue
        payload = {
            'key': slugify(section.title),
            'title': section.title,
            'category': 'combat' if 'combat' in section.body.lower() or 'adversary' in section.body.lower() else 'endeavor',
            'excerpt': section.body[:320],
            'parsedTerms': infer_keywords(section.title, section.body),
        }
        candidates.append(
            make_candidate(
                document_id=document_id,
                kind='rule-section',
                title=section.title,
                source_blocks=section.all_blocks,
                payload=payload,
                confidence=0.84,
                excerpt=section.body,
            )
        )
    return candidates


def dedupe_candidates(candidates: list[dict[str, object]]) -> list[dict[str, object]]:
    deduped: list[dict[str, object]] = []
    seen: set[str] = set()
    for candidate in candidates:
        candidate_id = str(candidate['id'])
        if candidate_id in seen:
            continue
        seen.add(candidate_id)
        deduped.append(candidate)
    return deduped


def build_candidate_artifacts(document_id: str, blocks: list[BlockRecord]) -> list[dict[str, object]]:
    sections = build_sections(blocks)
    candidates: list[dict[str, object]] = []
    candidates.extend(build_resource_candidates(document_id, blocks))
    candidates.extend(build_condition_candidates(document_id, sections))
    candidates.extend(build_procedure_candidates(document_id, sections))
    candidates.extend(build_rule_section_candidates(document_id, sections))
    for section in sections:
        candidates.extend(build_action_candidates(document_id, section))
    return dedupe_candidates(candidates)


def write_json(path: Path, payload: object) -> None:
    path.write_text(json.dumps(payload, indent=2, ensure_ascii=True) + '\n', encoding='utf-8')


def write_jsonl(path: Path, rows: Iterable[object]) -> None:
    with path.open('w', encoding='utf-8') as handle:
        for row in rows:
            handle.write(json.dumps(row, ensure_ascii=True, sort_keys=True))
            handle.write('\n')


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

# Handbook Import Tool

Create a local venv and install the pinned dependency:

```bash
python3 -m venv .venv-import
./.venv-import/bin/pip install -r tools/handbook_import/requirements.txt
```

Run the extractor against the local handbook PDF:

```bash
./.venv-import/bin/python -m handbook_import extract \
  --source .pdffiles/SL001_Stormlight_Handbook_digital.pdf \
  --profile stormlight-handbook \
  --out .import-cache/stormlight-handbook-clean
```

The tool emits:

- `manifest.json`
- `pages.jsonl`
- `blocks.jsonl`
- `candidates.jsonl`

This extractor is intentionally high-precision. It emits fewer candidates and is designed for a fresh re-import, not compatibility with older noisy handbook artifact batches.

For the first curated chapter import, build the checked-in Chapter 3 artifact with:

```bash
npm run build:chapter3-artifact
```

That writes a review-ready artifact bundle to `.import-cache/chapter-3-character-statistics`.

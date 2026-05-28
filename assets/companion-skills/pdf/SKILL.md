---
name: "pdf"
description: "Use when tasks involve reading, creating, or reviewing PDF files where rendering and layout matter; prefer visual checks by rendering pages and use Python tools such as reportlab, pdfplumber, and pypdf for generation and extraction."
---

# PDF Skill

## When to Use

- Read or review PDF content where layout and visuals matter.
- Create PDFs programmatically with reliable formatting.
- Validate final rendering before delivery.

## Workflow

1. Prefer visual review: render PDF pages to PNGs and inspect them.
2. Use `reportlab` to generate PDFs when creating new documents.
3. Use `pdfplumber` or `pypdf` for text extraction and quick checks; do not rely on text extraction for layout fidelity.
4. After each meaningful update, re-render pages and verify alignment, spacing, and legibility.

## Temp and Output Conventions

- Use `tmp/pdfs/` for intermediate files.
- Write final artifacts under `output/pdf/` when working in this repo.
- Keep filenames stable and descriptive.

## Dependencies

Prefer `uv` for Python dependencies:

```bash
uv pip install reportlab pdfplumber pypdf
```

If `uv` is unavailable:

```bash
python3 -m pip install reportlab pdfplumber pypdf
```

System rendering tools:

```bash
# macOS
brew install poppler

# Ubuntu/Debian
sudo apt-get install -y poppler-utils
```

If installation is not possible in this environment, tell the user which dependency is missing and how to install it locally.

## Rendering Command

```bash
pdftoppm -png "$INPUT_PDF" "$OUTPUT_PREFIX"
```

## Quality Expectations

- Maintain consistent typography, spacing, margins, and section hierarchy.
- Avoid clipped text, overlapping elements, broken tables, black squares, or unreadable glyphs.
- Charts, tables, and images must be sharp, aligned, and clearly labeled.
- Use ASCII hyphens only.
- Citations and references must be human-readable; never leave tool tokens or placeholders.

## Final Checks

- Do not deliver until the latest PNG inspection shows no visual or formatting defects.
- Confirm headers, footers, page numbering, and section transitions.
- Keep intermediate files organized or remove them after final approval.

# OPL Publishing

Owner: `one-person-lab-app`
Purpose: `opl_publishing_pipeline`
State: `active`
Machine boundary: Shared guide publishing templates and maintenance rules. Guide content, screenshots, release receipts, and runtime evidence remain in their owning guide, workflow, or release surfaces.

OPL install guides use a Quarto-first publishing pipeline:

- Human-readable body source: `.qmd`.
- Machine metadata: guide manifest JSON.
- Screenshot provenance: `screenshots.manifest.json`.
- Published reading outputs: Quarto Book HTML and PDF.
- Shared style: `docs/publishing/templates/opl-guide`.

This keeps the maintenance boundary simple: edit QMD for prose, edit manifest JSON for paths and validation terms, edit screenshot manifest for image provenance, and edit templates for brand or layout.

## Templates

- [`templates/opl-guide`](templates/opl-guide/): beginner screenshot guide template for installation and onboarding manuals.
- [`templates/opl-whitepaper`](templates/opl-whitepaper/): reserved for formal whitepapers and institution-facing reports. It should stay Quarto-based but may use stricter PDF requirements.
- [`templates/opl-quickstart`](templates/opl-quickstart/): reserved for shorter quickstart guides.

The active guide template is intentionally small: Quarto owns the book build, while the template owns HTML theme selection, SCSS, and LaTeX header polish. Typst is the preferred future PDF engine for guide-style documents, but the current stable local engine is XeLaTeX until the OPL Typst book template is hardened and verified with Chinese content.

## Build And Validation

Use:

```bash
npm run docs:guides
```

The generator validates:

- QMD placeholders are resolved.
- Required terms are present in generated PDF text.
- Forbidden secret-like markers are absent.
- Referenced screenshots are declared.
- Screenshot files exist and match declared dimensions or SHA256 when provided.
- HTML and PDF are generated.
- PDF is portrait and has a reasonable page count.

Generated HTML, Markdown, PDFs, and verification JSON are build artifacts. Do not hand-edit them as content sources.

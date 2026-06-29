# macOS App Install Guide Delivery

Owner: `one-person-lab-app`
Purpose: `app_user_guide_delivery_artifacts`
State: `active`
Machine boundary: Generated artifacts, Quarto manifests, and verification records. Human-readable guide prose is maintained under `docs/guides/macos-app-install/`.

This directory is not the clean end-user reading surface and is not the prose
editing area. Link users to
[`../../../public/macos-app-install/`](../../../public/macos-app-install/) instead.

Canonical source files:

- [`../../../guides/macos-app-install/guide.qmd`](../../../guides/macos-app-install/guide.qmd):
  long-form HTML/PDF body source.
- [`../../../guides/macos-app-install/slides.qmd`](../../../guides/macos-app-install/slides.qmd):
  Quarto presentation source for the shareable PDF/PPTX walkthrough.
- [`../../../guides/macos-app-install/screenshots.manifest.json`](../../../guides/macos-app-install/screenshots.manifest.json):
  screenshot provenance, locale, dimensions, expected UI text, and SHA256.
- [`../../../guides/macos-app-install/screenshots/`](../../../guides/macos-app-install/screenshots/):
  Chinese screenshot assets referenced by QMD.

Delivery and generated files:

- [`source/macos-app-install.quarto.json`](source/macos-app-install.quarto.json):
  machine manifest for output paths, download links, publishing template,
  screenshot manifest reference, required terms, and validation boundaries.
- [`generated/macos-app-install.md`](generated/macos-app-install.md):
  generated long-form Markdown snapshot.
- [`generated/macos-app-install-slides.qmd`](generated/macos-app-install-slides.qmd):
  generated expanded presentation snapshot.
- `verification/macos-app-install-verification.json`,
  `verification/macos-app-install-html-verification.json`, and
  `verification/macos-app-install-slides-verification.json`: generated
  verification records.

Generated reading artifacts:

- [macOS App install guide](../../../public/macos-app-install/index.html)
- [macOS App install detailed PDF](../../../public/macos-app-install/macos-app-install-detailed-guide.pdf)
- [macOS App install slides PDF](../../../public/macos-app-install/macos-app-install-slides.pdf)
- [macOS App install slides PPTX](../../../public/macos-app-install/macos-app-install-slides.pptx)

Update flow:

1. Edit `docs/guides/macos-app-install/guide.qmd` for the long-form guide.
2. Edit `docs/guides/macos-app-install/slides.qmd` for the presentation.
3. Replace screenshots under `docs/guides/macos-app-install/screenshots/`, then
   update `screenshots.manifest.json` with source, locale, dimensions, expected
   UI text, and SHA256.
4. Run `npm run docs:macos-guide`.
5. Review the generated verification JSON files before publishing.

Long-form HTML/PDF rendering uses Quarto Book with the shared
[`../../../publishing/templates/opl-guide`](../../../publishing/templates/opl-guide/)
template. Slides use Quarto presentation to generate PPTX, then LibreOffice
converts the PPTX to the shareable slide PDF. Do not reintroduce long-form
guide prose into JSON or hand-maintain generated outputs as content sources.

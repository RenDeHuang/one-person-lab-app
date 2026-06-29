# User Guide Sources

Owner: `one-person-lab-app`
Purpose: `app_user_guide_sources`
State: `active`
Machine boundary: Human-readable guide source and generation maintenance.

This directory is the maintenance area for Quarto guide source, screenshot
provenance, generated Marp source, fixtures, and verification records. It is not
the clean end-user reading surface. Link users to
[`../../../public/macos-app-install/`](../../../public/macos-app-install/) instead.

Clean user entry:

- [macOS App install guide](../../../public/macos-app-install/index.html): primary user-facing
  walkthrough. Use this in release notes and onboarding links because it gives
  users a navigable page, generated attachments, FAQ, and screenshot provenance
  in one place.

Generated reading artifacts live beside that HTML entry:

- [macOS App install slides PDF](../../../public/macos-app-install/macos-app-install-slides.pdf): generated 16:9
  screenshot walkthrough for forwarding to users who will follow the guide on a
  computer. This is the primary shareable visual PDF and is exported from the
  Marp Markdown deck with the repo theme.
- [macOS App install slides PPTX](../../../public/macos-app-install/macos-app-install-slides.pptx): generated 16:9
  sharing deck exported from the same Marp Markdown deck and theme as the PDF,
  so the visual PDF and PPTX stay aligned.
- [macOS App install detailed PDF](../../../public/macos-app-install/macos-app-install-detailed-guide.pdf):
  generated long-form companion.
- [macOS App install Markdown](generated/macos-app-install.md): generated long-form text
  source for the detailed PDF. It is not the public onboarding entry.

Source and verification files:

- [`source/macos-app-install.guide.qmd`](source/macos-app-install.guide.qmd):
  canonical long-form guide body source for HTML, generated Markdown, and
  detailed PDF.
- [`source/macos-app-install.quarto.json`](source/macos-app-install.quarto.json):
  Quarto manifest for long-form HTML/PDF output paths, publishing template,
  screenshot manifest reference, required terms, and validation boundaries.
- [`source/macos-app-install.guide.json`](source/macos-app-install.guide.json):
  structured slide source for the Marp PDF/PPTX walkthrough and its speaker
  notes. Keep this aligned with the QMD guide body when changing the user flow.
- [`generated/macos-app-install-slides.md`](generated/macos-app-install-slides.md) and
  [`generated/macos-app-install-marp-theme.css`](generated/macos-app-install-marp-theme.css):
  generated Marp deck source and CSS theme for the shareable visual PDF/PPTX.
- [`source/screenshots.manifest.json`](source/screenshots.manifest.json): canonical
  screenshot provenance, dimensions, and SHA256 manifest for the Quarto guide.
- [`source/macos-app-install-assets.json`](source/macos-app-install-assets.json): legacy
  screenshot provenance input still consumed by the Marp slide generator.
- `verification/macos-app-install-html-verification.json`,
  `verification/macos-app-install-slides-verification.json`, and
  `verification/macos-app-install-verification.json`: generated verification records.

Read generated Markdown, public PDFs/PPTX, and HTML as artifacts derived from
the QMD guide body, slide JSON, and screenshot manifest. If their embedded
metadata or titles look source-like, the canonical edit path still starts from
`source/macos-app-install.guide.qmd` for long-form text, from
`source/macos-app-install.guide.json` for slides, and then regeneration; do not
hand-edit generated artifacts as a second content source.

Release evidence screenshots have a separate owner. The `screenshots/runtime.png`,
`screenshots/full.png`, and `screenshots/action.png` paths belong to the
release evidence bundle defined by `contracts/app-release-channel.json` and
validated by the release evidence scripts. User-guide screenshots and generated
guide verification prove guide artifact integrity only; they are post-promotion
documentation assets, not App release-ready, runtime-ready, domain-ready, or
family production-ready proof.

Update flow:

1. Refresh screenshots from the Chinese 1080p macOS VM guide artifact under
   `docs/delivery/user-guides/macos-app-install/assets/`, then update
   `source/screenshots.manifest.json` with each screenshot source, width,
   height, SHA256, locale, and expected UI text when available. The Quarto guide
   generator fails if the PNGs do not match this manifest. Keep
   `source/macos-app-install-assets.json` aligned until the slide deck is moved
   from Marp to Quarto presentation.
2. Update `source/macos-app-install.guide.qmd` when long-form user-facing copy,
   FAQ, artifact links, or detailed PDF text changes.
3. Update `source/macos-app-install.guide.json` when the slide walkthrough,
   speaker notes, or step ordering changes. Keep it aligned with the QMD guide
   body.
4. Run `npm run docs:macos-guide` to refresh the public HTML guide, copied
   public assets, Marp slides PDF/PPTX, detailed companion PDF, generated
   Markdown, and all verification JSON files.
5. For targeted regeneration, run `npm run docs:macos-guide:html`,
   `npm run docs:macos-guide:slides`, or `npm run docs:macos-guide:pdf`.
6. Verify `verification/macos-app-install-html-verification.json`,
   `verification/macos-app-install-slides-verification.json`, and
   `verification/macos-app-install-verification.json` before publishing.

Long-form HTML/PDF rendering uses Quarto Book with the shared
[`../../../publishing/templates/opl-guide`](../../../publishing/templates/opl-guide/)
template. The preferred future guide PDF engine is Typst, but the current stable
engine is XeLaTeX because the local Quarto 1.9.38 Typst Book smoke fails before
the OPL Typst template is hardened for Chinese book output. Slides remain on
Marp for now; the publishing target is to move PPTX/slide PDF generation onto
Quarto presentation rather than maintaining a second long-term rendering stack.

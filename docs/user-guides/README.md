# User Guides

Owner: `one-person-lab-app`
Purpose: `app_user_guides`
State: `active`
Machine boundary: Human-readable user documentation.

This directory is the entry point for end-user installation, first-run, update,
and troubleshooting guides. Framework developer docs remain in
`gaofeng21cn/one-person-lab`.

Primary user guide entry:

- [macOS App install HTML guide](site/index.html): primary user-facing
  walkthrough. Use this in release notes and onboarding links because it gives
  users a navigable page, generated attachments, FAQ, and screenshot provenance
  in one place.

Generated reading artifacts:

- [macOS App install slides PDF](macos-app-install-slides.pdf): generated 16:9
  screenshot walkthrough for forwarding to users who will follow the guide on a
  computer. This is the primary shareable visual PDF and is exported from the
  Marp Markdown deck with the repo theme.
- [macOS App install slides PPTX](macos-app-install-slides.pptx): generated 16:9
  sharing deck exported from the same Marp Markdown deck and theme as the PDF,
  so the visual PDF and PPTX stay aligned.
- [macOS App install detailed PDF](macos-app-install-detailed-guide.pdf):
  generated long-form companion.
- [macOS App install Markdown](macos-app-install.md): generated long-form text
  source for the detailed PDF. It is not the public onboarding entry.

Source and verification files:

- [`macos-app-install.guide.json`](macos-app-install.guide.json): canonical
  user-guide content source for HTML, slides, Markdown, and detailed PDF.
- [`macos-app-install-slides.md`](macos-app-install-slides.md) and
  [`macos-app-install-marp-theme.css`](macos-app-install-marp-theme.css):
  generated Marp deck source and CSS theme for the shareable visual PDF/PPTX.
- [`macos-app-install-assets.json`](macos-app-install-assets.json): screenshot
  provenance, dimensions, and SHA256 manifest.
- `macos-app-install-html-verification.json`,
  `macos-app-install-slides-verification.json`, and
  `macos-app-install-verification.json`: generated verification records.

Read generated Markdown, PDFs, PPTX, and HTML as artifacts derived from the
guide source and screenshot manifest. If their embedded metadata or titles look
source-like, the canonical edit path still starts from `macos-app-install.guide.json`
and regeneration; do not hand-edit generated artifacts as a second content
source.

Release evidence screenshots have a separate owner. The `screenshots/runtime.png`,
`screenshots/full.png`, and `screenshots/action.png` paths belong to the
release evidence bundle defined by `contracts/app-release-channel.json` and
validated by the release evidence scripts. User-guide screenshots and generated
guide verification prove guide artifact integrity only; they are post-promotion
documentation assets, not App release-ready, runtime-ready, domain-ready, or
family production-ready proof.

Update flow:

1. Refresh screenshots from the Chinese 1080p macOS VM guide artifact under
   `docs/user-guides/assets/`, then update `macos-app-install-assets.json` with
   each screenshot source, width, height, and SHA256. The guide generators fail
   if the PNGs do not match this manifest. Do not force a shared canvas size;
   keep the VM/CDP output dimensions recorded per image.
2. Update `macos-app-install.guide.json` when the user flow, copy, FAQ,
   artifact links, or step ordering changes. Do not edit generated Markdown or
   slide copy as a second source of truth.
3. Run `npm run docs:macos-guide` to refresh the HTML guide, Marp slides
   PDF/PPTX, detailed companion PDF, generated Markdown, and all verification
   JSON files.
4. For targeted regeneration, run `npm run docs:macos-guide:html`,
   `npm run docs:macos-guide:slides`, or `npm run docs:macos-guide:pdf`.
5. Verify `macos-app-install-html-verification.json`,
   `macos-app-install-slides-verification.json`, and
   `macos-app-install-verification.json` before publishing.

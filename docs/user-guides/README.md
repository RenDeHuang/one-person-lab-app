# User Guides

Owner: `one-person-lab-app`
Purpose: `app_user_guides`
State: `active`
Machine boundary: Human-readable user documentation.

This directory is the entry point for end-user installation, first-run, update,
and troubleshooting guides. Framework developer docs remain in
`gaofeng21cn/one-person-lab`.

Primary user artifact:

- [macOS App install slides PDF](macos-app-install-slides.pdf): primary
  user-facing screenshot tutorial. Use this in release notes and onboarding
  links.

Editable and detailed companion artifacts:

- [macOS App install slides PPTX](macos-app-install-slides.pptx): editable
  16:9 slide source with larger type and one task per slide.
- [macOS App install detailed PDF](macos-app-install-detailed-guide.pdf):
  detailed long-form companion generated from the Markdown source with Pandoc.
- [macOS App install Markdown](macos-app-install.md): canonical text source for
  the detailed guide and the content checklist.

Update flow:

1. Refresh screenshots under `docs/user-guides/assets/`, then update
   `macos-app-install-assets.json` with each screenshot source, source size,
   source SHA256, and normalized SHA256. The guide generators fail if the PNGs
   do not match this manifest.
2. Update `macos-app-install.md` and the slide copy in
   `scripts/build-user-guide-slides.ts` when the user flow changes.
3. Run `npm run docs:macos-guide` to refresh the primary slide PDF, editable
   PPTX, and detailed companion PDF together.
4. For targeted regeneration, run `npm run docs:macos-guide:slides` or
   `npm run docs:macos-guide:pdf`.
5. Verify `macos-app-install-slides-verification.json` and
   `macos-app-install-verification.json` before publishing.

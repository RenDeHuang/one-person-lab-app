# Whitepapers

Owner: `one-person-lab-app`
Purpose: `whitepaper_source_root`
State: `active`
Machine boundary: Source prose for public whitepapers. Generated HTML/PDF live
under local `docs/site/latest/` and are published from the local build to the
latest GitHub Pages copy, not tracked release-by-release files on `main`.

OPL-family whitepapers use the shared local builder
`scripts/opl-whitepaper-builder.ts`; this repo's
`scripts/build-opl-app-whitepaper.ts` is only the App-specific configuration
wrapper for the common Pandoc/XeLaTeX style profile.

This repo follows the OPL-wide whitepaper pattern:

- Keep canonical Markdown source under `docs/whitepapers/`.
- Keep shared style and publishing templates under `docs/publishing/`.
- Write verification records under `docs/delivery/whitepapers/`.
- Generate current public HTML/PDF into `docs/site/latest/whitepapers/`.
- Publish only the latest public copy through the shared local
  `scripts/publish-docs-latest.sh` pattern.

Current source:

- `opl-app-whitepaper.md`

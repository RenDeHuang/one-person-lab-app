# GUI Docs Cleanup Notes

## 2026-07-07 docs/assets/wrapper cleanup

Boundary:

- Removed the one-hop `scripts/build-docker-webui-guide.ts` wrapper. `npm run docs:docker-webui-guide` now calls `scripts/build-quarto-guide.ts docker-webui-install` directly.
- Removed the equivalent `docs:macos-guide:html` and `docs:macos-guide:pdf` aliases. Use `npm run docs:macos-guide:quarto` for the shared Quarto HTML/PDF build.
- `scripts/build-user-guide-slides.ts` now references canonical screenshots under `docs/guides/macos-app-install/screenshots` from generated Marp markdown, so tracked duplicate delivery PNGs are not needed for slide generation.
- Deleted only delivery PNGs whose SHA256 matched the canonical screenshots manifest source. Kept `docs/delivery/user-guides/macos-app-install/assets/06-research-data-folder.png` because its hash differs from `docs/guides/macos-app-install/screenshots/06-research-data-folder.png`; this cleanup does not decide whether that nonduplicate historical asset still has product value.

Verification commands:

```bash
npm run docs:docker-webui-guide
npm run docs:macos-guide:slides
git diff --check
```

# Over-Engineering Cleanup Boundary

Status: active cleanup boundary
Scope: guide generation, release helper scripts, and active-shell validator cleanup
Last updated: 2026-07-07

## Landed Safe Slices

### 2026-07-07 guide generation and delivery assets

- Removed the one-hop `scripts/build-docker-webui-guide.ts` wrapper. `npm run docs:docker-webui-guide` now calls `scripts/build-quarto-guide.ts docker-webui-install` directly.
- Removed the equivalent `docs:macos-guide:html` and `docs:macos-guide:pdf` aliases. Use `npm run docs:macos-guide:quarto` for the shared Quarto HTML/PDF build.
- `scripts/build-user-guide-slides.ts` now references canonical screenshots under `docs/guides/macos-app-install/screenshots` from generated Marp markdown, so tracked duplicate delivery PNGs are not needed for slide generation.
- Deleted only delivery PNGs whose SHA256 matched the canonical screenshots manifest source. Kept `docs/delivery/user-guides/macos-app-install/assets/06-research-data-folder.png` because its hash differs from `docs/guides/macos-app-install/screenshots/06-research-data-folder.png`; this cleanup does not decide whether that nonduplicate historical asset still has product value.
- Verification required for this slice: `npm run docs:docker-webui-guide`, `npm run docs:macos-guide:slides`, and `git diff --check`.

### 2026-07-07 release notes sanitization

- `scripts/release-notes-ai-writer.ts` factored repeated developer-term cleanup inside `sanitizePreTechnicalDeveloperTerms` into private string helpers.
- Why safe: the split stays in one file, preserves the existing pre-Technical-details vs Technical-details behavior, and does not change provider selection, command execution, JSON parsing, release-note validation, or publish flow.
- Verification required for this slice: `git diff --check` plus a focused release-notes test or direct `release-notes-ai-writer.ts --input/--evidence` command that exercises the sanitization path.

### 2026-07-07 delivery asset and simple CLI parser cleanup

- Removed `docs/delivery/user-guides/macos-app-install/assets/06-research-data-folder.png`; current guide, generated delivery markdown, slide markdown, and verification refs point at the canonical `docs/guides/macos-app-install/screenshots/06-research-data-folder.png` source instead.
- `scripts/generate-release-notes.ts` was already on `node:util.parseArgs`, so this slice left it unchanged.
- `scripts/publish-release.ts` now uses `node:util.parseArgs` for its simple boolean and string release options instead of a hand-rolled argv loop.
- Kept `scripts/cli-option-args.ts` because release cohort, readiness, operator, evidence, and Docker/WebUI dispatch scripts still import it.
- Verification required for this slice: `git diff --check`, focused parser probes for `generate-release-notes.ts` and `publish-release.ts`, and `rg` checks proving the deleted delivery asset path and `cli-option-args.ts` imports are understood.

## No-Safe-Semantic-Split Boundaries

The following cleanup classes must not be landed as broad mechanical refactors without a focused semantic split and matching verification:

- Command runner unification across `scripts/release-cleanup-helpers.ts`, `scripts/release-notes/command.ts`, `scripts/build-full-first-install-package/process.ts`, and `scripts/guide-script-helpers.ts`.
  These runners intentionally differ in capture behavior, error handling, env propagation, `maxBuffer`, null-vs-throw semantics, and inherited stdio. A shared runner is only safe when one caller group is isolated and its observable stdout/stderr/status behavior is covered.
- JSON helper consolidation across `scripts/release-json-helpers.ts`, release notes, publish, and cleanup scripts.
  Some call sites need strict object/array coercion, others intentionally allow raw `JSON.parse` failures or line-delimited parsing. Consolidation must keep parse-error wording and schema-boundary behavior visible.
- Active-shell validator cleanup under `scripts/validate-active-shell/*`.
  Validator structure encodes App product truth and shell adapter expectations. Do not reshape it for aesthetics; first identify one validator rule, its owning contract/doc, and the command proving that rule still gates the intended behavior.
- Release cleanup helper expansion.
  `release-cleanup-helpers.ts` is currently scoped to destructive-release cleanup scripts. Do not promote it into a general release runner unless the new caller shares dry-run/execute semantics and has a destructive-action safety check.

## Future Slice Requirements

Each future cleanup slice must include:

- one owner surface or script family;
- explicit preserved behavior, including stdout/stderr/status and file-write side effects when relevant;
- one focused verification command that fails on the preserved behavior if the cleanup is wrong;
- no edits to contracts, release workflow package metadata, CLI parseArgs worker files, or broad validator structure unless the user explicitly opens that write set.

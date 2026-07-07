# Over-Engineering Cleanup Boundary

Status: active cleanup boundary
Scope: release helper scripts and active-shell validator cleanup
Last updated: 2026-07-07

## Landed Safe Slice

- `scripts/release-notes-ai-writer.ts`: factored repeated developer-term cleanup inside `sanitizePreTechnicalDeveloperTerms` into private string helpers.
- Why safe: the split stays in one file, preserves the existing pre-Technical-details vs Technical-details behavior, and does not change provider selection, command execution, JSON parsing, release-note validation, or publish flow.
- Verification required for this slice: `git diff --check` plus a focused release-notes test or direct `release-notes-ai-writer.ts --input/--evidence` command that exercises the sanitization path.

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

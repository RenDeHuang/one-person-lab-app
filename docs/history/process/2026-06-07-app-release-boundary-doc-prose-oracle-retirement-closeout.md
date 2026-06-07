# App release-boundary docs prose oracle retirement closeout

Owner: `one-person-lab-app`
Purpose: `app_release_boundary_docs_prose_oracle_retirement_closeout`
State: `history_closeout`
Machine boundary: Human-readable process closeout. Current App release, install, Homebrew, WebUI, Full runtime, GUI validation, CI operations, and live-conformance truth stays in App contracts, package scripts, release workflows, validation scripts, release-boundary tests, active-shell validators, generated release artifacts, updater metadata, and OPL Framework read-model output consumed by the App. Narrative docs remain operator guidance and public/product explanation, not release-boundary machine interfaces.

## Scope

This lane retired release-boundary assertions that treated narrative Markdown as an exact oracle:

```text
docs/release/README.md
docs/testing/README.md
docs/status.md
docs/architecture.md
scripts/README.md
```

The retired checks covered installer wording, Full size policy prose, first-install maintenance prose, updater reference prose, Homebrew guide prose, Stable/Nightly/WebUI release matrix prose, cleanup command prose, release CI operations prose, GUI shell validation prose, and live OPL conformance prose.

## Change

- Removed Markdown reads and regex assertions from release-boundary cases.
- Removed `macos_stable_local_authorization_docs` from `scripts/validate-release-boundary.ts`.
- Kept machine checks against `install.sh`, `install-stable.sh`, `package.json`, `.fallowrc.json`, App contracts, release workflows, active-shell validators, release scripts, local authorization validators, first-run matrix, runtime bridge contract, fixtures, and cleanup scripts.
- Changed no release workflows, release contracts, installer behavior, release artifacts, updater metadata, shell implementation, candidate records, or runtime behavior.

## Verification

Required verification for this lane:

```bash
rtk npm run ensure:shell
rtk npm run validate:release-boundary
rtk npm run test:release-boundary -- --runInBand
rtk git diff --check
rtk rg -n -I -e '^(<<<<<<< |=======|>>>>>>> |\|\|\|\|\|\|\| )' tests docs scripts contracts .github
rtk rg -n "readFileSync\(path\.join\(appRoot, 'docs|readFileSync\(path\.join\(appRoot, 'scripts', 'README'|docs/.+README|docs', 'release|docs', 'testing|docs', 'status|scripts', 'README|releaseDocs|testingDocs|scriptsDocs|statusDocs|combinedDocs|macos_stable_local_authorization_docs" tests/release/app-release-boundary-cases scripts/validate-release-boundary.ts
```

Observed result:

- `rtk npm run ensure:shell`: pass; `shells/aionui` prepared from `gaofeng21cn/opl-aion-shell` at `4a1154d4c313`.
- `rtk npm run validate:release-boundary`: pass.
- `rtk npm run test:release-boundary -- --runInBand`: 115/115 pass.
- `rtk git diff --check`: pass.
- Conflict-marker scan for `tests docs scripts contracts .github`: no matches.
- Targeted release-boundary docs-prose oracle scan: no matches.
- `rtk opl-doc-doctor doctor . --format json`: `finding_count=0`.

## Remaining Boundary

This closeout is a test/validator ownership cleanup. It does not claim a new App release cohort, does not produce release evidence, and does not change public docs. Future release-boundary tests may assert machine-readable contracts, scripts, workflows, generated artifacts, CLI/API behavior, and validator output, but must not lock narrative documentation wording.

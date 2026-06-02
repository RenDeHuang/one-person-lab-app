# App docs portfolio coverage ledger archive

Owner: `one-person-lab-app`
Purpose: `docs_portfolio_coverage_ledger_archive`
State: `history_provenance`
Machine boundary: Human-readable historical coverage ledger. Machine truth stays in `contracts/`, source, release artifacts, updater metadata, test outputs, active shell validation, and OPL Framework CLI/read-model output consumed by the App.

This document archives dated coverage tranches that previously lived in `docs/docs_portfolio_consolidation.md`. It records historical docs-governance scope and foldback context only; current App docs lifecycle truth lives in `docs/docs_portfolio_consolidation.md`, the core docs, `docs/active/app-ideal-state-gap-plan.md`, App contracts, source, tests, and release evidence artifacts.

## Coverage Ledger

### 2026-05-29 packaged-skill-boundary and user-guide currentness tranche

This tranche refreshes the App repo-local coverage ledger after the latest
packaged-skill boundary and macOS user-guide changes. It keeps the global OPL
series `/goal` active and does not reopen the full App docs inventory because
the prior 2026-05-28 tranche already completed the paragraph/body pass for the
then-current repo-root `README*` plus `docs/**/*.md` set.

Fresh live truth inputs:

- App commits `a52cad4` and `f0a2c35`, covering the home packaged-skill
  boundary and the 26.5.28 macOS user-guide refresh.
- App current docs: `README.md`, `README.zh-CN.md`, `docs/README.md`,
  `docs/active/aionui-builtin-skills.md`,
  `docs/active/app-ideal-state-gap-plan.md`, `docs/status.md`,
  `docs/project.md`, `docs/architecture.md`, `docs/invariants.md`,
  `docs/decisions.md`, `docs/release/README.md`, `docs/testing/README.md`,
  `docs/user-guides/README.md`, and `docs/user-guides/macos-app-install.md`.
- App machine refs: `contracts/app-product-profile.json`,
  `contracts/app-gui-product-contract.json`,
  `contracts/app-first-run-test-matrix.json`,
  `contracts/app-install-exposure-policy.json`,
  `contracts/app-runtime-bridge.json`, `contracts/app-shell-adapter.json`,
  `scripts/validate-active-shell.ts`, `scripts/app-product-profile.ts`,
  `scripts/build-user-guide-pdf.ts`, `scripts/build-user-guide-slides.ts`,
  `tests/release/app-release-boundary.test.ts`, and current user-guide
  verification JSON.
- Framework read-model smoke:
  `opl app state --profile fast --json`, read as App/operator consumed input
  rather than App-owned runtime truth.

Reviewed documents / sections:

| Repo | Reviewed docs / sections | Edited docs this tranche |
| --- | --- | --- |
| `one-person-lab-app` | Targeted currentness pass over the current App public entries, core current-truth docs, active plan, active-shell builtin-skills support doc, release/testing/user-guide support docs, package/product contracts, user-guide generation scripts, active-shell validation, release-boundary tests, and verification JSON. | `docs/docs_portfolio_consolidation.md` |
| `one-person-lab` | OPL App/operator fast-state read model was sampled only to confirm the App docs still describe consumed framework state as refs/read-model input. | none |

Fresh semantic result:

- No prose body correction was needed in App canonical docs. The current docs
  already keep one App-level packaged-skill boundary:
  `companion_payloads.default_packaged_codex_skill_ids` plus
  `companion_payloads.packaged_not_default_visible_codex_skill_ids`.
- MAS/MAG/RCA remain default App purpose entries and packaged domain skills,
  not companion mirrors. OPL Meta Agent remains explicit-only and outside the
  default home assistant set.
- The refreshed macOS user guide keeps visible downloads on
  `releases/latest`, treats the Full DMG as the first-install recommendation,
  and leaves fixed-version screenshot/verification details as provenance rather
  than public release authority.
- The App/operator fast-state readout still belongs to the Framework/App
  consumption boundary. It can confirm available actions and refs for the App
  surface, but it does not become domain readiness, owner receipt authority, or
  App release-ready proof.

Archived / tombstoned / deleted docs:

- none. This was a currentness ledger tranche only.

Unreviewed docs:

- `one-person-lab-app`: no full reopened body tail for repo-root `README*` plus
  `docs/**/*.md` in this tranche; the exact full inventory was covered on
  2026-05-28, and this pass covered the newly relevant packaged-skill and
  user-guide truth surfaces.
- Other OPL series repos were not semantically re-governed in this tranche
  beyond the App/operator fast-state sample from `one-person-lab`.

Remaining stale / retire candidates:

- Future stale pollution remains any prose that turns App packaged skill
  membership, App user-guide screenshots/downloads, OPL App/operator read-model
  refs, updater metadata, or release artifact existence into MAS/MAG/RCA
  readiness, App release-ready authority, owner receipt authority, or family
  production readiness.
- Packaged GUI Codex-path evidence still requires a fresh DMG/App smoke before
  the `packaged_gui_codex_path_evidence` gap can close.

Next tranche write scope:

- Continue OPL series governance from repos with remaining exact-inventory
  tails, stale/retire candidates, or newly reopened contract/read-model facts.
  Revisit App only when a new App product contract, release/user-guide asset,
  shell sync, packaged-GUI evidence, first-run policy, or App/operator
  read-model change reopens App docs truth.

### 2026-05-28 active-shell upstream and Codex-output foldback tranche

This tranche folds the post-upstream active shell state back into the App
active truth after the shell absorbed AionUI through upstream commit
`83eb8bda02af44df9795a10f32fa938dd62b628c`. It keeps the global OPL series
`/goal` active and does not promote shell validation into packaged release
readiness.

Fresh live truth inputs:

- App guidance and core docs: `AGENTS.md`, `TASTE.md`,
  `docs/active/app-ideal-state-gap-plan.md`, `docs/status.md`,
  `docs/project.md`, `docs/architecture.md`, `docs/invariants.md`, and
  `docs/decisions.md`.
- App machine refs: `contracts/app-shell-adapter.json`,
  `contracts/app-gui-product-contract.json`,
  `contracts/app-product-profile.json`, and
  `tests/release/app-release-boundary.test.ts`.
- Shell implementation refs: `docs/guides/opl-app-shell-boundary.md`,
  `packages/desktop/src/common/chat/normalizeToolCall.ts`,
  `tests/unit/common/normalizeToolCall.test.ts`,
  `packages/desktop/src/renderer/components/agent/AcpModelSelector.tsx`,
  conversation selector tests, and active-shell validation output.
- Framework support refs:
  `/Users/gaofeng/workspace/one-person-lab/docs/references/current-support/opl-gui-shell-adapter-boundary.md`.

Reviewed documents / sections:

| Repo | Reviewed docs / sections | Edited docs this tranche |
| --- | --- | --- |
| `one-person-lab-app` | Active plan, status, docs coverage ledger, GUI product contract, product profile, shell adapter contract, release-boundary test, and current App core docs for Codex App wrapper / fixed executor truth. | `docs/active/app-ideal-state-gap-plan.md`, `docs/status.md`, `docs/docs_portfolio_consolidation.md` |
| `opl-aion-shell` | Shell boundary guide plus Codex ACP output normalization and fixed Codex selector implementation/tests. | `docs/guides/opl-app-shell-boundary.md` |
| `one-person-lab` | GUI shell adapter support reference for the Framework/App/shell state-source split. | `docs/references/current-support/opl-gui-shell-adapter-boundary.md` |

Fresh semantic result:

- The App ordinary path remains the intended Codex App equivalent: fixed
  `Codex CLI` executor, MAS/MAG/RCA built-in purpose entries, no normal
  backend/model/permission selector, and App-owned route receipt policy.
- The active shell upstream ref is now current and explicit in App contract
  truth. App main still does not merge shell implementation history.
- The Codex CLI no-newline symptom was a shell ACP normalization issue, not a
  Codex CLI setting. The shell now consumes Codex ACP `raw_output`
  `aggregated_output` / `formatted_output` / `stdout` / `stderr` fields and
  preserves newline-bearing output in the rendered tool-call body.
- The Framework support reference is aligned with the current runtime bridge:
  normal GUI state comes from `opl app state --profile fast --json`; full App
  state and runtime drilldown are explicit diagnostic / release-evidence
  surfaces, not ordinary page-state truth.

Archived / tombstoned / deleted docs:

- none. The touched docs remain active plan, active support, or support
  reference surfaces.

Unreviewed docs:

- `one-person-lab-app`: no reopened repo-root `README*` / `docs/**/*.md`
  body tail in this tranche; the change was a targeted foldback over the
  reopened shell-sync and Codex-output facts.
- `opl-aion-shell`: broader upstream AionUI docs remain upstream/product docs
  and were not governed in this App-boundary tranche.
- `one-person-lab`: full framework docs portfolio was not re-governed here;
  only the App/shell support reference was updated because it contradicted the
  current App state-source split.

Remaining stale / retire candidates:

- Packaged GUI screenshot/click evidence for the fixed Codex path remains open
  until a real DMG/App bundle smoke proves MAS/MAG/RCA selection, `@` badge,
  hidden backend/model/permission selectors, and route receipt in the packaged
  app.
- Future stale pollution remains any prose that turns active-shell tests,
  raw-output rendering fixes, App UI rendering, updater metadata, release
  artifact existence, OPL read-model availability, or user-path refs into
  domain readiness, quality verdict, artifact authority, App release readiness,
  or family production readiness.

Next tranche write scope:

- Continue OPL series coverage from repos with remaining exact-inventory tails
  or stale/retire candidates. Revisit App only when a new contract, release,
  shell, first-run, packaged-GUI evidence, or App/operator read-model change
  reopens App product truth.

### 2026-05-28 runtime-page README truth and body coverage tranche

This tranche completes paragraph-level governance for the current App
repo-root `README*` plus `docs/**/*.md` inventory. It keeps the global OPL
series `/goal` active and does not rewrite App runtime or release authority.

Fresh live truth inputs:

- Current repo guidance: `AGENTS.md` and `TASTE.md`.
- Public entries and canonical docs: `README.md`, `README.zh-CN.md`,
  `docs/README.md`, `docs/project.md`, `docs/status.md`,
  `docs/architecture.md`, `docs/invariants.md`, and `docs/decisions.md`.
- Active truth and governance owner docs:
  `docs/active/app-ideal-state-gap-plan.md`,
  `docs/active/aionui-builtin-skills.md`, and this ledger.
- Support docs: `docs/release/README.md`, `docs/testing/README.md`,
  `docs/user-guides/README.md`, `docs/user-guides/macos-app-install.md`,
  `docs/screenshots/README.md`, and `docs/history/README.md`.
- Machine refs: `contracts/app-runtime-bridge.json`,
  `contracts/app-page-state-matrix.json`,
  `contracts/app-gui-product-contract.json`,
  `contracts/app-product-profile.json`,
  `contracts/app-shell-candidates.json`, and `package.json`.

Reviewed documents / sections:

| Repo | Reviewed docs / sections | Edited docs this tranche |
| --- | --- | --- |
| `one-person-lab-app` | Full paragraph/body pass over the current exact `README*` + `docs/**/*.md` inventory: `README.md`, `README.zh-CN.md`, `docs/README.md`, `docs/active/aionui-builtin-skills.md`, `docs/active/app-ideal-state-gap-plan.md`, `docs/architecture.md`, `docs/decisions.md`, `docs/docs_portfolio_consolidation.md`, `docs/history/README.md`, `docs/invariants.md`, `docs/project.md`, `docs/release/README.md`, `docs/screenshots/README.md`, `docs/status.md`, `docs/testing/README.md`, `docs/user-guides/README.md`, and `docs/user-guides/macos-app-install.md`. | `README.md`, `README.zh-CN.md`, `docs/architecture.md`, `docs/docs_portfolio_consolidation.md`, `docs/invariants.md`, `docs/release/README.md`, `docs/status.md` |

Fresh semantic result:

- The App docs have one active truth owner, one docs index, public bilingual
  App entries, durable current product-boundary docs, release/testing/user
  support guides, screenshot/user-guide support, and history provenance.
- The stale prose found in the current inventory was the runtime page read-model
  wording. The Chinese README still named `runtime_visualization_projection` and
  `runtime_tray_snapshot.app_operator_drilldown` as a compatibility read model,
  while several docs described `opl app state --profile full --json` as the
  ordinary refresh source. The edited docs now match the current App runtime
  bridge and validation tests: summary and refresh from
  `opl app state --profile fast --json`, `opl app state --profile full --json`
  only for explicit full-state diagnostic or release evidence, on-demand full
  Framework drilldown, and refs-only safe action routing.
- `docs/release/README.md`, `docs/testing/README.md`, and the core App docs
  already align on the App boundary: release evidence and runtime-page output
  are App/operator acceptance surfaces, not runtime truth, provider
  implementation, domain truth, memory body, artifact authority, owner receipt
  authority, or quality/export verdict ownership.

Archived / tombstoned / deleted docs:

- none. The current App inventory has legitimate long-term roles after the
  runtime-page README truth correction.

Unreviewed docs:

- `one-person-lab-app`: none for repo-root `README*` plus `docs/**/*.md` at this
  tranche's inventory snapshot.
- `scripts/README.md` was read as support context, but it is outside the exact
  `README*` / `docs/**/*.md` coverage set.

Remaining stale / retire candidates:

- Future stale pollution remains any prose that turns App UI rendering, updater
  metadata, release artifact existence, release evidence collector output,
  first-run contract presence, or OPL read-model availability into MAS/MAG/RCA
  domain readiness, quality verdict, artifact authority, owner receipt
  authority, App release readiness without evidence, or family production
  readiness.

Next tranche write scope:

- Continue OPL series coverage from repos that still have exact-inventory
  tails or stale/retire candidates; do not revisit App docs unless new contract,
  release, shell, or first-run changes reopen the App doc boundary.

### 2026-05-27 repo-local ledger bootstrap tranche

This tranche adds the App repo-local docs governance ledger so the App repository has a local coverage accounting entry instead of relying only on the OPL family ledger. It does not rewrite App active truth, does not touch existing dirty release/testing files in the main checkout, does not add release/readiness claims, and does not close the OPL series global `/goal`.

Fresh live truth inputs:

- App `AGENTS.md`, `TASTE.md`, root `README.md`, `README.zh-CN.md`, `docs/README.md`, `docs/active/app-ideal-state-gap-plan.md`, `docs/status.md`, `docs/project.md`, `docs/architecture.md`, `docs/invariants.md`, and new `docs/decisions.md`.
- App machine refs: `contracts/app-product-profile.json`, `contracts/app-shell-adapter.json`, `contracts/app-first-run-test-matrix.json`, `contracts/app-page-state-matrix.json`, and `package.json`.
- Current App exact inventory over repo-root `README*` plus `docs/**/*.md`:
  - `README.md`
  - `README.zh-CN.md`
  - `docs/README.md`
  - `docs/active/app-ideal-state-gap-plan.md`
  - `docs/architecture.md`
  - `docs/decisions.md`
  - `docs/docs_portfolio_consolidation.md`
  - `docs/history/README.md`
  - `docs/invariants.md`
  - `docs/project.md`
  - `docs/release/README.md`
  - `docs/screenshots/README.md`
  - `docs/status.md`
  - `docs/testing/README.md`
  - `docs/user-guides/README.md`
  - `docs/user-guides/macos-app-install.md`
- Support README role read: `scripts/README.md`.

Fresh semantic result:

- App docs already have one active truth owner, one docs entry, durable current product-boundary docs, a still-active decisions record, and App-owned contract surfaces for product profile, active shell, first-run, page-state, release channel, and release/evidence scripts.
- The missing pieces were repo-local governance ledger / exact-coverage accounting and the lightweight `docs/decisions.md` core-doc owner. Because the main checkout currently has unrelated dirty release/testing files, this tranche intentionally does not rewrite existing release/testing prose bodies.
- Current contracts confirm the App boundary: the App owns product defaults, release assets, updater metadata, first-run UX checks, GUI page-state tests, and user documentation; it consumes framework contracts, OPL CLI JSON outputs, runtime snapshots, provider receipts, and domain-owned projections; it does not own runtime truth, provider implementation, domain truth, domain quality verdict, or domain artifact authority.
- Active shell remains `aionui` under `shells/aionui`, sourced from `gaofeng21cn/opl-aion-shell` with `history_policy=external_checkout_not_merged_into_app_default_branch`.
- First-run and page-state contracts keep release evidence and runtime-page behavior contract-backed but not domain-ready or production-ready proof.

Reviewed documents / sections:

| Repo | Reviewed docs / sections | Edited docs this tranche |
| --- | --- | --- |
| `one-person-lab-app` | First-screen / role read of App `README*`, current docs index, active plan, core product-boundary docs including decisions, release/testing/user-guide/screenshot/history indexes, support `scripts/README.md`, and App contracts listed above. | `docs/README.md`, `docs/active/app-ideal-state-gap-plan.md`, `docs/decisions.md`, `docs/docs_portfolio_consolidation.md` |

Archived / tombstoned / deleted docs:

- none. The reviewed App paths currently have legitimate long-term roles as public entry, docs index, active plan, current product truth, release/testing/user support, screenshot guide, history provenance, or script support.

Unreviewed docs:

- `one-person-lab-app`: existing App docs were first-screen / role-read in this tranche, but full paragraph-level semantic governance remains open because release / GUI lanes were dirty and outside this tranche's ownership. Future App tranche should cover the body text of `README*`, `docs/status.md`, `docs/release/README.md`, `docs/testing/README.md`, `docs/user-guides/**`, `docs/screenshots/**`, `docs/history/**`, and `scripts/README.md` once the dirty release/testing lane is safe or explicitly assigned.
- `scripts/README.md` was used as support README context; it is not part of the exact `README*` / `docs/**/*.md` inventory but remains an App docs-governance support file.

Remaining stale / retire candidates:

- App: any prose that treats App UI rendering, active shell validation, updater metadata, release artifact existence, provider completion, OPL read-model availability, release collector output, or first-run contract presence as MAS/MAG/RCA/OMA domain ready, quality verdict, artifact authority, owner receipt authority, App release ready without evidence, or family production ready is stale pollution.
- App: any future prose that moves active shell implementation truth, shell history, OPL runtime/provider ownership, domain truth, release evidence bodies, owner receipt bodies, memory bodies, artifact bodies, or domain action authority into this repo reopens the active plan.
- App: dirty release/testing lanes remain the gating factor for body-level docs governance in this repo.

Next tranche write scope:

- When the dirty App release/testing lane is safe or explicitly assigned, perform paragraph-level governance of App `README*`, `docs/status.md`, `docs/release/README.md`, `docs/testing/README.md`, `docs/user-guides/**`, `docs/screenshots/**`, `docs/history/**`, and `scripts/README.md` against App contracts, release/evidence scripts, shell validation, and real release artifacts.
- Until then, continue only newly reopened exact-inventory tails in OPL/MAS/MAG/RCA/OMA or App ledger/accounting items that do not touch externally dirty files.

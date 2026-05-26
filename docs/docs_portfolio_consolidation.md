# One Person Lab App Docs Portfolio Governance

Owner: `one-person-lab-app`
Purpose: `docs_lifecycle_governance`
State: `active_support`
Machine boundary: Human-readable governance entry and coverage ledger. Machine truth stays in `contracts/`, source, release artifacts, updater metadata, test outputs, active shell validation, and OPL Framework CLI/read-model output consumed by the App.

## Current Conclusion

`one-person-lab-app` owns the desktop product repository: packaging, release assets, updater metadata, first-run product policy, App-level contracts, screenshots, user guides, and App validation wrappers. It consumes OPL Framework CLI JSON, framework contracts, runtime snapshots, provider receipts, and domain-owned projections. It does not own runtime truth, provider implementation, domain truth, domain quality/export verdicts, memory body, artifact body, artifact authority, or owner receipt authority.

The single Active Truth owner for App product progress, gaps, and next-round baton is `docs/active/app-ideal-state-gap-plan.md`. Durable current truth is split across `docs/status.md`, `docs/project.md`, `docs/architecture.md`, and `docs/invariants.md`; `docs/README.md` is the docs index. `shells/aionui/` remains an external checkout from `gaofeng21cn/opl-aion-shell`; shell implementation history must not be merged into the App default branch.

This repository intentionally uses a lighter docs taxonomy than the framework and domain-agent repos. It currently has `docs/active/`, `docs/history/`, `docs/release/`, `docs/screenshots/`, `docs/testing/`, and `docs/user-guides/`. Future `public/`, `product/`, `runtime/`, `delivery/`, `source/`, `policies/`, `specs/`, or `references/` directories should be created only when App-owned long-lived material has a clear owner, purpose, state, and machine boundary.

## Directory Responsibilities

| Path group | Current role | Machine boundary |
| --- | --- | --- |
| `README.md`, `README.zh-CN.md` | Public bilingual App entry and install/product overview | Human-readable product docs; release readiness comes from artifacts, manifests, and validation outputs |
| `docs/README.md` | Docs entry and App docs index | Navigation only |
| `docs/active/app-ideal-state-gap-plan.md` | Single Active Truth owner for current progress, gaps, and next-round Agent prompt | Human-readable active plan; contracts/tests/artifacts prove machine claims |
| `docs/status.md` | Current App repository, shell, release, runtime-page, and validation state | Human-readable status; no runtime/provider/domain authority |
| `docs/project.md`, `docs/architecture.md`, `docs/invariants.md` | Product boundary, architecture split, and non-ownership rules | Durable human-readable current truth; machine decisions use contracts/source/tests |
| `docs/release/` | Release, updater, Full first-install, and release-evidence notes | Release truth stays in produced assets, updater metadata, evidence manifests, CI/logs, and validation commands |
| `docs/testing/` | Validation and test guidance | Tests and scripts are authoritative |
| `docs/user-guides/`, `docs/screenshots/` | User-facing guides and visual tutorial assets | User docs; not production/readiness proof |
| `docs/history/` | Retired topology and migration provenance | Historical only; not active product/runtime truth |
| `scripts/README.md` | App wrapper and release script guide | Scripts/tests/contracts determine behavior |

## Governance Rules

- App docs must not promote UI rendering, updater metadata, release artifact existence, provider completion, zero-open worklists, or OPL projection into MAS/MAG/RCA/OMA readiness, quality verdict, artifact authority, domain ready, App release ready, or family production ready.
- App release evidence must be classified as present, missing, typed blocker, or not applicable. Missing screenshots, VM smoke, settings smoke, remote Release checks, or runtime JSON cannot be written as release-ready proof.
- App-owned product/release contract changes stay in this repo. Active shell implementation changes stay in `gaofeng21cn/opl-aion-shell` unless the App contract or wrapper changes.
- Completed process traces, release command logs, screenshots, VM logs, and remote verification output belong in release artifacts, evidence manifests, CI logs, history/provenance, or commit history. Active docs keep current state and next baton only.
- Machine consumers must use contracts, source, release artifacts, updater metadata, test outputs, or OPL CLI/read-model output. Markdown paths and headings are human navigation only.

## Coverage Ledger

### 2026-05-27 repo-local ledger bootstrap tranche

This tranche adds the App repo-local docs governance ledger so the App repository has a local coverage accounting entry instead of relying only on the OPL family ledger. It does not rewrite App active truth, does not touch existing dirty release/testing files in the main checkout, does not add release/readiness claims, and does not close the OPL series global `/goal`.

Fresh live truth inputs:

- App `AGENTS.md`, `TASTE.md`, root `README.md`, `README.zh-CN.md`, `docs/README.md`, `docs/active/app-ideal-state-gap-plan.md`, `docs/status.md`, `docs/project.md`, `docs/architecture.md`, and `docs/invariants.md`.
- App machine refs: `contracts/app-product-profile.json`, `contracts/app-shell-adapter.json`, `contracts/app-first-run-test-matrix.json`, `contracts/app-page-state-matrix.json`, and `package.json`.
- Current App exact inventory over repo-root `README*` plus `docs/**/*.md`:
  - `README.md`
  - `README.zh-CN.md`
  - `docs/README.md`
  - `docs/active/app-ideal-state-gap-plan.md`
  - `docs/architecture.md`
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

- App docs already have one active truth owner, one docs entry, durable current product-boundary docs, and App-owned contract surfaces for product profile, active shell, first-run, page-state, release channel, and release/evidence scripts.
- The missing piece was repo-local governance ledger / exact-coverage accounting. Because the main checkout currently has unrelated dirty release/testing files, this tranche intentionally does not rewrite existing App prose bodies.
- Current contracts confirm the App boundary: the App owns product defaults, release assets, updater metadata, first-run UX checks, GUI page-state tests, and user documentation; it consumes framework contracts, OPL CLI JSON outputs, runtime snapshots, provider receipts, and domain-owned projections; it does not own runtime truth, provider implementation, domain truth, domain quality verdict, or domain artifact authority.
- Active shell remains `aionui` under `shells/aionui`, sourced from `gaofeng21cn/opl-aion-shell` with `history_policy=external_checkout_not_merged_into_app_default_branch`.
- First-run and page-state contracts keep release evidence and runtime-page behavior contract-backed but not domain-ready or production-ready proof.

Reviewed documents / sections:

| Repo | Reviewed docs / sections | Edited docs this tranche |
| --- | --- | --- |
| `one-person-lab-app` | First-screen / role read of App `README*`, current docs index, active plan, core product-boundary docs, release/testing/user-guide/screenshot/history indexes, support `scripts/README.md`, and App contracts listed above. | `docs/docs_portfolio_consolidation.md` |

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

# One Person Lab App Docs Portfolio Governance

Owner: `one-person-lab-app`
Purpose: `docs_lifecycle_governance`
State: `active_support`
Machine boundary: Human-readable governance entry and docs role inventory. Machine truth stays in `contracts/`, source, release artifacts, updater metadata, test outputs, active shell validation, and OPL Framework CLI/read-model output consumed by the App.

## Current Conclusion

`one-person-lab-app` owns the desktop product repository: packaging, release assets, updater metadata, first-run product policy, App-level contracts, screenshots, user guides, and App validation wrappers. It consumes OPL Framework CLI JSON, framework contracts, runtime snapshots, provider receipts, and domain-owned projections. It does not own runtime truth, provider implementation, domain truth, domain quality/export verdicts, memory body, artifact body, artifact authority, or owner receipt authority.

The single Active Truth owner for App product progress, gaps, and next-round baton is `docs/active/app-ideal-state-gap-plan.md`. Durable current truth is split across `docs/status.md`, `docs/project.md`, `docs/architecture.md`, `docs/invariants.md`, and `docs/decisions.md`; `docs/README.md` is the docs index. `shells/aionui/` remains an external checkout from `gaofeng21cn/opl-aion-shell`; shell implementation history must not be merged into the App default branch.

This repository intentionally uses a lighter docs taxonomy than the framework and domain-agent repos. It currently has `docs/active/`, `docs/history/`, `docs/release/`, `docs/screenshots/`, `docs/testing/`, and `docs/user-guides/`. Future `public/`, `product/`, `runtime/`, `delivery/`, `source/`, `policies/`, `specs/`, or `references/` directories should be created only when App-owned long-lived material has a clear owner, purpose, state, and machine boundary.

## Directory Responsibilities

| Path group | Current role | Machine boundary |
| --- | --- | --- |
| `README.md`, `README.zh-CN.md` | Public bilingual App entry and install/product overview | Human-readable product docs; release readiness comes from artifacts, manifests, and validation outputs |
| `docs/README.md` | Docs entry and App docs index | Navigation only |
| `docs/active/app-ideal-state-gap-plan.md` | Single Active Truth owner for current progress, gaps, and next-round Agent prompt | Human-readable active plan; contracts/tests/artifacts prove machine claims |
| `docs/status.md` | Current App repository, shell, release, runtime-page, and validation state | Human-readable status; no runtime/provider/domain authority |
| `docs/project.md`, `docs/architecture.md`, `docs/invariants.md`, `docs/decisions.md` | Product boundary, architecture split, non-ownership rules, and still-active App decisions | Durable human-readable current truth; machine decisions use contracts/source/tests |
| `docs/app-ideal-gui-interaction-spec.md`, `docs/codex-to-opl-app-delta.md`, `docs/app-gui-feature-inventory.md` | GUI 定义栈：理想 Codex App 形态交互、OPL 专用产品增量、跨 shell 能力清单和 reference mapping | 人读 design/product definitions；implementation claims 由 App contracts、page-state matrices、package manifests、UI smoke 和 release evidence 证明 |
| `docs/app-gui-element-audit.md` | Human review of ordinary user GUI elements, placement, gaps, and interaction logic | Review note only; machine acceptance stays in contracts/page-state matrices/tests |
| `docs/agui-codex-candidate-verification.md` | Candidate shell verification runbook for AG-UI/CopilotKit explicit adapter command order and false-authority boundaries | Executable candidate acceptance stays in `contracts/app-shell-candidates.json`, `contracts/shell-adapters/agui-codex.json`, `scripts/validate-shell-candidates/*`, candidate manifests, shell artifacts, CI logs, release evidence, or history |
| `docs/release/` | Release, updater, Full first-install, and release-evidence notes | Release truth stays in produced assets, updater metadata, evidence manifests, CI/logs, and validation commands |
| `docs/testing/` | Validation command entry, release evidence classification guidance, and test-surface orientation | Tests, scripts, contracts, workflows and release artifacts are authoritative; release policy itself stays in `docs/release/` and `contracts/app-release-channel.json` |
| `docs/user-guides/`, `docs/screenshots/` | User-facing guides and visual tutorial assets | User docs; not production/readiness proof |
| `docs/history/` | Retired topology, process provenance, and archived dated evidence | Historical only; not active product/runtime truth |
| `docs/history/process/README.md` | Compressed process-history index and coverage summary | Historical archive index only; current truth stays in active/core docs, contracts, source, tests, artifacts, manifests, workflows, validators, or CI logs |
| `docs/history/process/retired-surface-provenance.md` | Retired surface, stale evidence, duplicate test, workflow, route, alias, and docs-prose no-resurrection provenance | Historical provenance only; current owner refs are contracts, source, validation scripts, release-boundary tests, workflows, artifacts, candidate manifests, and owner docs |
| `scripts/README.md` | App wrapper and release script guide | Scripts/tests/contracts determine behavior |

## Governance Rules

- App docs must not promote UI rendering, updater metadata, release artifact existence, provider completion, zero-open worklists, or OPL projection into MAS/MAG/RCA/OMA readiness, quality verdict, artifact authority, domain ready, App release ready, or family production ready.
- App release evidence must be classified as present, missing, typed blocker, or not applicable. Missing screenshots, VM smoke, settings smoke, remote Release checks, or runtime JSON cannot be written as release-ready proof.
- App-owned product/release contract changes stay in this repo. Active shell implementation changes stay in `gaofeng21cn/opl-aion-shell` unless the App contract or wrapper changes.
- GUI candidate and external reference docs must keep their lifecycle role clear: candidate runbooks describe boundaries and command order; executable acceptance criteria stay in contracts, validators, manifests and candidate artifacts. PilotDeck, Stitch, AG-UI, CopilotKit, and other external materials are implementation/reference inputs until App-owned contracts and adapter gates adopt them.
- Completed process traces, release command logs, screenshots, VM logs, and remote verification output belong in release artifacts, evidence manifests, CI logs, history/provenance, or commit history. Active docs keep current state and next baton only.
- Machine consumers must use contracts, source, release artifacts, updater metadata, test outputs, or OPL CLI/read-model output. Markdown paths and headings are human navigation only.

## Coverage Ledger Foldback

Dated coverage entries, closeout ledgers, candidate smoke notes, local release/source evidence, and stale-surface retirement notes are compressed under [App process history](./history/process/README.md), with durable no-resurrection rules in [App retired surface provenance](./history/process/retired-surface-provenance.md).

The current process index is topic-level only: it records SSOT owners, compressed provenance groups, coverage summary, remaining unreviewed scope, and next write scope. It must not grow back into per-tranche release/candidate evidence logs, VM smoke transcripts, screenshot logs, branch/worktree closeout, or proof-by-proof tranches.

Future coverage belongs in the narrowest owner:

| Future evidence | Owner |
| --- | --- |
| Durable App product or release rule | Core docs, active gap plan, App contracts, source, tests, or release validation docs |
| Install exposure / Codex-visible domain skill rule | `contracts/app-install-exposure-policy.json`, product profile, status/decisions/active plan and `validate:agent-installation`; README/release/user docs may only point to that owner |
| Release proof, remote checks, VM smoke, packaged route receipts | Release artifacts, evidence manifests, CI logs, or release history/provenance |
| Candidate shell technical smoke, adoption gate, or replacement decision | `contracts/app-shell-candidates.json`, `contracts/shell-adapters/agui-codex.json`, `scripts/validate-shell-candidates/*`, candidate manifests, shell artifacts, focused tests, or candidate history/provenance; default-shell replacement requires `contracts/app-shell-adapter.json` and release gates |
| GUI definition / interaction target | `docs/app-ideal-gui-interaction-spec.md`, `docs/codex-to-opl-app-delta.md`, `docs/app-gui-feature-inventory.md`, `docs/app-gui-element-audit.md`, App GUI/page-state/first-run contracts and active-shell validation |
| Docs lifecycle tranche closeout | `docs/history/process/README.md` as a compressed theme row, not a dated proof ledger |
| Testing-doc release evidence guidance | `docs/testing/README.md` for command entry and evidence classification only; release cohort policy stays in `docs/release/README.md`, `contracts/app-release-channel.json`, workflows, validators and release-boundary tests |

The current App process index keeps topic-level App docs-governance coverage.
App `README*` and `docs/**/*.md` have no tracked unreviewed docs-governance
theme remaining in the App process ledger; open App work is
implementation/evidence-tail work under the owners above. This App coverage
does not close the parent OPL series docs-governance goal, because the seven-repo
goal remains open until every repo ledger has no unreviewed docs or unresolved
stale/retire candidates.

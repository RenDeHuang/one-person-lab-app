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
| `docs/active/app-interaction-logic-command-center.md` | Active interaction handoff note for App-owned GUI requirements and shell implementation coordination | Human-readable support note; contracts/page-state matrices/validation scripts decide acceptance |
| `docs/status.md` | Current App repository, shell, release, runtime-page, and validation state | Human-readable status; no runtime/provider/domain authority |
| `docs/project.md`, `docs/architecture.md`, `docs/invariants.md`, `docs/decisions.md` | Product boundary, architecture split, non-ownership rules, and still-active App decisions | Durable human-readable current truth; machine decisions use contracts/source/tests |
| `docs/app-ideal-gui-interaction-spec.md`, `docs/codex-to-opl-app-delta.md`, `docs/app-gui-feature-inventory.md` | GUI 定义栈：理想 Codex App 形态交互、OPL 专用产品增量、跨 shell 能力清单和 reference mapping | 人读 design/product definitions；implementation claims 由 App contracts、page-state matrices、package manifests、UI smoke 和 release evidence 证明 |
| `docs/app-gui-element-audit.md` | Human review of ordinary user GUI elements, placement, gaps, and interaction logic | Review note only; machine acceptance stays in contracts/page-state matrices/tests |
| `docs/agui-codex-candidate-verification.md` | Candidate shell verification runbook for AG-UI/CopilotKit explicit adapter builds | Candidate evidence stays in candidate manifests, shell artifacts, CI logs, release evidence, or history |
| `docs/release/` | Release, updater, Full first-install, and release-evidence notes | Release truth stays in produced assets, updater metadata, evidence manifests, CI/logs, and validation commands |
| `docs/testing/` | Validation and test guidance | Tests and scripts are authoritative |
| `docs/user-guides/`, `docs/screenshots/` | User-facing guides and visual tutorial assets | User docs; not production/readiness proof |
| `docs/history/` | Retired topology, process provenance, and archived dated evidence | Historical only; not active product/runtime truth |
| `docs/history/process/2026-06-02-aionui-builtin-skill-intake.md` | Dated AionUI builtin skill candidate intake and whitelist rationale | Historical provenance only; current packaging policy is App contracts and decisions |
| `docs/history/process/2026-06-03-app-docs-lifecycle-cleanup-archive.md` | Dated release/candidate/local-smoke evidence classes removed from active docs | Historical provenance only; durable rules fold back into active governance, core docs, active gap plan, contracts, source, tests, release evidence artifacts, or validation scripts |
| `scripts/README.md` | App wrapper and release script guide | Scripts/tests/contracts determine behavior |

## Governance Rules

- App docs must not promote UI rendering, updater metadata, release artifact existence, provider completion, zero-open worklists, or OPL projection into MAS/MAG/RCA/OMA readiness, quality verdict, artifact authority, domain ready, App release ready, or family production ready.
- App release evidence must be classified as present, missing, typed blocker, or not applicable. Missing screenshots, VM smoke, settings smoke, remote Release checks, or runtime JSON cannot be written as release-ready proof.
- App-owned product/release contract changes stay in this repo. Active shell implementation changes stay in `gaofeng21cn/opl-aion-shell` unless the App contract or wrapper changes.
- GUI candidate and external reference docs must keep their lifecycle role clear: candidate runbooks describe boundaries, commands, and acceptance criteria; PilotDeck, Stitch, AG-UI, CopilotKit, and other external materials are implementation/reference inputs until App-owned contracts and adapter gates adopt them.
- Completed process traces, release command logs, screenshots, VM logs, and remote verification output belong in release artifacts, evidence manifests, CI logs, history/provenance, or commit history. Active docs keep current state and next baton only.
- Machine consumers must use contracts, source, release artifacts, updater metadata, test outputs, or OPL CLI/read-model output. Markdown paths and headings are human navigation only.

## Coverage Ledger Foldback

Dated coverage entries that previously lived in this active governance document are archived in [App docs portfolio coverage ledger archive](./history/process/2026-06-02-app-docs-portfolio-coverage-ledger-archive.md). Dated evidence and current-source notes removed during the 2026-06-03 lifecycle cleanup are archived in [App docs lifecycle cleanup archive](./history/process/2026-06-03-app-docs-lifecycle-cleanup-archive.md).

This file now keeps only current lifecycle rules, directory responsibilities, governance rules, and reopening conditions. Do not append future release/candidate evidence logs, VM smoke transcripts, screenshot logs, branch/worktree closeout, or proof-by-proof tranches here. New dated coverage belongs under `docs/history/process/`, release artifacts, evidence manifests, CI logs, or another precise history/provenance owner; durable conclusions must be folded back into the core docs, active gap plan, App contracts, source, tests, or release validation docs.

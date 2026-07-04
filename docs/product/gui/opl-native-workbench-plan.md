# OPL Native Workbench Candidate Plan

Owner: `one-person-lab-app`
Purpose: `opl_native_workbench_candidate_plan`
State: `active_candidate_plan`
Machine boundary: Human-readable candidate decision and landing plan. Machine
truth lives in `contracts/app-shell-candidates.json`,
`contracts/shell-adapters/opl-native-workbench.json`,
`contracts/app-shell-adapter.json`, validation output, shell artifacts, and
release owner records.

## Decision

`opl-native-workbench` is the new foreground alternative GUI candidate. It is
an independent shell repository checked out under
`shells/opl-native-workbench`, in the same external-checkout class as AionUI,
Hermes, and AGUI. The App repo governs it through
`contracts/app-shell-candidates.json` and
`contracts/shell-adapters/opl-native-workbench.json`.

This is not active-shell adoption. AionUI remains the active release shell and
`contracts/app-shell-adapter.json` remains the default stable/nightly release
adapter. Switching the default release shell requires a later explicit edit to
`contracts/app-shell-adapter.json` plus the App shell adapter, product profile,
page-state, first-run, package, WebUI, release, and owner gates.

Hermes Desktop / `hermes-codex` becomes the retained prior foreground
alternative reference. Its upstream-first compatibility lessons remain useful,
but it is no longer the default foreground implementation scope once the
candidate registry points to `opl-native-workbench`. AGUI / `agui-codex` remains
archived technical proof and must not be revived unless AGUI replay is
explicitly requested.

## Topology

| Surface | Decision |
| --- | --- |
| Candidate id | `opl-native-workbench` |
| Shell checkout | `shells/opl-native-workbench` |
| Adapter contract | `contracts/shell-adapters/opl-native-workbench.json` |
| Candidate registry | `contracts/app-shell-candidates.json` |
| Active release shell | Still `aionui` via `contracts/app-shell-adapter.json` |
| Release participation before adoption | Explicit candidate build and smoke only |
| Authority boundary | App state/action and contracts only; no runtime, provider, domain, artifact, or owner-receipt authority transfer |

## External Learning Landing

| Source / pattern | Class | Landing rule |
| --- | --- | --- |
| K-Dense delivery experience: project sandbox, files, previews, result delivery, and structured launch forms | adopt/adapt | Use the delivery shape for App-owned workspace/project UX, but keep file bodies, artifacts, receipts, and domain verdicts behind OPL Framework/domain refs. Forms become App action dry-run / confirmation surfaces, not shell-owned execution logic. |
| K-Dense local file sandbox and session persistence | adapt | Map to selected workspace, conversation refs, artifact refs, and delivery refs. The shell may render project context and previews; Framework/domain producers own artifact bodies and provenance. |
| K-Dense Markdown, Mermaid, math, code, and LaTeX rendering choices | adopt | Prefer maintained renderer/editor modules or already-installed shell primitives. Do not add dependencies from this plan alone. |
| OpenClaudeScience / Claude Science workbench framing | adapt | Borrow the user-facing story: one workbench, results with provenance, resource continuity, connectors, reviewer/action refs. Land it through existing Runtime task awareness and inspector slices, not a new shell dashboard or task system. |
| AGUI shared Electron/WebUI renderer and protocol bridge proof | adapt | Keep the shared-renderer and bridge lesson: one App-owned renderer shape across desktop and WebUI, with delivery-surface adapters. Do not expose AGUI protocol/debug concepts in ordinary UI. |
| External runtime / agent authority, Pi SDK, DeepAgents, LangGraph-like runtimes, provider/backend marketplaces | watch_only/reject | They may inform future adapter research only. They must not become the App executor, backend selector, provider truth, runtime authority, or ordinary-user marketplace. |
| External domain truth, artifact authority, owner receipts, billing, provider implementation, or release readiness | reject | These remain with OPL Framework, domain owners, Console/Fabric, provider owners, release artifacts, and owner receipts. |

## Landing Order

| Order | Item | Completion meaning | Required evidence before stronger claim |
| ---: | --- | --- | --- |
| 1 | Candidate registration | `contracts/app-shell-candidates.json` declares `opl-native-workbench` as the foreground alternative and default candidate validation scope. | Registry validation. |
| 2 | Adapter contract | `contracts/shell-adapters/opl-native-workbench.json` selects the independent shell checkout and explicit candidate build path. | Adapter validation and no active-shell switch. |
| 3 | External repo / checkout | `shells/opl-native-workbench` or its source repo is available as an external checkout without vendoring history into the App repo. | Checkout readback and source ref. |
| 4 | State/action bridge | Candidate consumes `opl app state --profile fast --json` and `opl app action execute ... --json` only. | Source tests or bridge smoke. |
| 5 | Shared renderer | Desktop and claimed WebUI use one App-owned renderer shape with delivery adapters. | Source/WebUI smoke when WebUI is claimed. |
| 6 | Package manifest | Explicit candidate package emits a real `.app` manifest without changing stable/nightly release packaging. | Candidate package manifest and release-isolation check. |
| 7 | Source / WebUI smoke | Source smoke and WebUI smoke prove the claimed technical path only. | Smoke artifacts for the exact candidate cohort. |
| 8 | Docs / runbook | Product docs, feature inventory, status, decisions, and scripts guide point to the new candidate boundary. | Markdown diff check and residual wording scan. |
| 9 | Later visual / live evidence | Screenshots, packaged app smoke, clean VM, same-cohort user path, and owner acceptance. | Required only before visual acceptance, release-ready, active-shell-adopted, or live/currentness claims. |

## False-Ready Boundary

This plan can close a docs or candidate-structure lane only. It must not be
used to claim `release-ready`, `active-shell-adopted`, `live evidence`,
`production-ready`, `domain-ready`, packaged GUI acceptance, or owner
acceptance. Candidate smoke proves only the exact candidate cohort that emitted
the artifact. Active release adoption still requires the later
`contracts/app-shell-adapter.json` switch and full release-owner gates.

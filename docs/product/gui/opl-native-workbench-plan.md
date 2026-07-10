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

Hermes Desktop / `hermes-codex` remains a retained explicit candidate. Its
upstream-first compatibility lessons, adapter contract, checkout policy, and
candidate package path stay live for explicit validation and feature comparison,
but it is not the default foreground implementation scope while the candidate
registry points to `opl-native-workbench`. AGUI / `agui-codex` remains archived
technical proof and must not be revived unless AGUI replay is explicitly
requested.

## Topology

| Surface | Decision |
| --- | --- |
| Candidate id | `opl-native-workbench` |
| Shell checkout | `shells/opl-native-workbench` |
| Adapter contract | `contracts/shell-adapters/opl-native-workbench.json` |
| Candidate registry | `contracts/app-shell-candidates.json` |
| Active release shell | Still `aionui` via `contracts/app-shell-adapter.json` |
| Retained candidate | `hermes-codex` via `contracts/shell-adapters/hermes-codex.json` |
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

The current closeable slice is the non-live candidate product surface. It
turns the previous partial audit items into the next landing target; it does
not claim that the active release shell, live user path, VM, owner acceptance,
or release package has changed.

| Order | Item | Current non-live landing meaning | Required evidence before stronger claim |
| ---: | --- | --- | --- |
| 1 | Candidate registration | `contracts/app-shell-candidates.json` declares `opl-native-workbench` as the foreground alternative and default candidate validation scope. | Registry validation. |
| 2 | Adapter contract | `contracts/shell-adapters/opl-native-workbench.json` selects the independent shell checkout and explicit candidate build path. | Adapter validation and no active-shell switch. |
| 3 | External repo / checkout | `shells/opl-native-workbench` or its source repo is available as an external checkout without vendoring history into the App repo. | Checkout readback and source ref. |
| 4 | State/action bridge | Candidate consumes `opl app state --profile fast --json` and `opl app action execute ... --json` only. | Source tests or bridge smoke. |
| 5 | Codex app-server conversation bridge | Candidate uses Codex app-server JSON-RPC (`initialize`, `model/list`, `thread/start`, `turn/start`, model/effort overrides, streaming delta notifications, `turn/completed`, and resume-capable thread ids) instead of a shell-owned one-shot `codex exec` wrapper. Known model order is fallback/display preference, not an allowlist. Auto consumes the complete paginated catalog from `contracts/app-product-profile.json#codex.auto_model_policy`: current 5.6 Sol uses `xhigh`, an unknown future CLI `isDefault` model remains eligible and uses its highest advertised reasoning effort, and choosing another model or reasoning level creates a fixed override. | Native bridge compile, app-server protocol smoke, candidate package manifest, known/unknown/catalog-fallback/persistence behavior validation, and live model-list/turn probes when release evidence is claimed. |
| 6 | Basic UI modules | The candidate targets ChatGPT Codex macOS 26.707.31428: a persistent project/conversation rail, one dominant chat timeline, compact conversation header, functional model/reasoning controls in the composer, floating user-requested environment details, and a separate Settings route. Build 26.707.31123 remains only a superseded observation until candidate source and pixels are revalidated. Language, persistent model defaults, workspace, and runtime connection belong in Settings; the composer controls write the same persisted model/reasoning values and pass them to app-server. | Source module inspection, source validation, screenshot comparison, and no hidden runtime/domain authority. |
| 7 | Artifact preview tabs | Files, result refs, delivery refs, receipts, and review refs are shown through preview tabs or equivalent inspector panes. They are refs-only; artifact bodies and quality/export verdicts stay domain-owned. | Source UI evidence plus App state/action refs proving the preview is not shell-owned artifact authority. |
| 8 | Provenance drawer | A drawer or inspector panel shows source refs, receipts, owner handoff state, and next action provenance without owning memory body, artifact body, runtime truth, or owner receipts. | Source UI evidence plus explicit forbidden-authority checks. |
| 9 | Starter forms | Research, Grant, and Presentation starters become structured forms that prepare App action payloads and dry-run previews. They do not execute hidden shell-local workflows. | Source form evidence plus dry-run action receipt mapping. |
| 10 | Confirmation / interview cards | User-input, permission, confirmation, and interview prompts render as explicit cards with accepted return shape and dry-run/execute separation. | Source UI evidence plus App action/user-input refs. |
| 11 | Desktop / WebUI same renderer | Desktop and claimed WebUI use one App-owned renderer shape with Electron and browser delivery adapters. | Source/WebUI smoke when WebUI is claimed. |
| 12 | Source visual smoke | A source-level visual smoke proves the non-live candidate surface paints visible pixels for the workbench modules above. | Source visual artifact for the exact candidate cohort; packaged/VM evidence remains separate. |
| 13 | Package manifest | Explicit candidate package emits a real `.app` manifest with `status=candidate_app_bundle_built` without changing stable/nightly release packaging or claiming release readiness. | Candidate package manifest and release-isolation check. |
| 14 | Docs / runbook | Product docs, feature inventory, status, product index, and scripts guide describe the non-live product surface closure and the residual live-only gates. | Markdown diff check and residual wording scan. |
| 15 | Local candidate live smoke | The candidate repo can launch the packaged `.app` locally with `npm run smoke:native-live` and write `out/native-live-smoke.json` / `out/native-live-smoke.png`. | This proves only local candidate launch/process/window evidence; clean VM, same-cohort owner acceptance, active-shell adoption, and release-ready proof remain separate. |
| 16 | Later release / owner evidence | Clean VM, same-cohort user path, release owner acceptance, active-shell adoption, and release-ready proof stay outside this candidate product-surface closure. | Required only before visual acceptance, release-ready, active-shell-adopted, or release/currentness claims. |

## Current Non-Live Acceptance

The current shell implementation slice now has candidate-level evidence for a
real native `.app` bundle, Codex app-server thread/turn bridge, chat-first
layout, Settings route, source/WebUI smoke, source visual smoke, and package
manifest. This remains candidate technical evidence only: it does not prove
clean-VM behavior, visual owner acceptance, active-shell adoption, release
readiness, or live App release currentness.

The current visual acceptance baseline is ChatGPT Codex macOS 26.707.31428,
inspected on July 10, 2026. Build 26.707.31123 is retained only as a superseded
observation. The candidate must realign its layout density,
typography, project/conversation hierarchy, single timeline, compact header,
bottom composer, model/reasoning placement, floating environment details, and
account-row Settings entry to that build. OPL branding and OPL-owned contracts
remain authoritative; no ChatGPT/Codex source or brand asset is copied.
K-Dense and Open Science are demoted to feature references for delivery,
scientific previews, provenance, and structured actions. Their three-column
workbench layouts are not ordinary Home references. The older July 5 imagegen
mockup remains historical input only and is no longer a visual acceptance
baseline.
The current landing target also converges packaged macOS candidate, WebUI, and
source around one renderer entry and one bridge/event shape. That is a
candidate-structure claim only; it still does not imply same-cohort visual
parity acceptance, active-shell adoption, clean-VM proof, or release readiness.

## Functional MVP Closeout Status

| Status | Scope | Evidence boundary |
| --- | --- | --- |
| Implemented | Codex chat runtime path | Source and behavior validators require `codex app-server --stdio`, `initialize`, App-owned `codex.auto_model_policy` consumption, `model/list` catalog/default/reasoning parsing, known 5.6 Sol `xhigh`, unknown-default highest-supported reasoning, catalog fallback, Auto-mode-only persistence, fixed override persistence, stale fixed-selection normalization, `thread/start`, `turn/start`, `model` / `effort` overrides, `item/agentMessage/delta`, `turn/completed`, and `thread/resume` markers across the bridge and native host. |
| Implemented | Chat history and local session resume | Candidate sidebar persists local chat sessions, reopens saved drafts, and reuses a saved Codex `threadId` when available. |
| Implemented | OPL App state context | Source validators require fast state, full state, full drilldown, secondary runtime context, and active-project-line markers. |
| Implemented | App action preview and receipt | Source validators require `opl app action execute --action`, `--dry-run`, visible action preview controls, visible receipt markers, confirmed execute, and rollback-preview request markers. |
| Implemented | Settings route | Source validators require the Settings route, App-profile-injected model order, default `5.6 Sol` / `xhigh`, the five reasoning efforts `low / medium / high / xhigh / ultra`, locale toggle, packaged route switch markers, runtime profile readback, and refresh controls. The locale choice drives ordinary user-visible chrome in the shared renderer. |
| Implemented | Bridge readback normalization | Candidate bridge normalizes state, drilldown, action receipt, message, and event readbacks into typed envelopes consumable by the renderer. |
| Implemented candidate evidence | Local packaged `.app` smoke | Candidate repo `npm run smoke:native-live` launches the packaged AppKit/WKWebView `.app`, records process/window evidence, and writes a local screenshot artifact. |
| Partial | Packaged/WebUI/source shared renderer convergence | Current checks prove one candidate renderer target plus source/package/local-live/WebUI structural evidence. They do not prove same-cohort owner-accepted user-path behavior, clean-VM behavior, or release adoption. |
| Partial | Artifact preview, provenance, starters, confirmations, export | These are richer refs-only candidate UI surfaces with live action/state derivation and editable starter fields. Artifact bodies, domain truth, export verdicts, and owner receipts remain outside the shell. |
| Not ready | Release and authority claims | `active_shell_adopted`, `release_ready`, `production_ready`, `domain_ready`, `clean_vm_ready`, `full_release_ready`, `live_evidence`, `owner_receipt`, `runtime_authority_transfer`, and `domain_truth_owned` must stay false until the App owner runs the later adoption and release gates. |

## False-Ready Boundary

This plan can close a docs or candidate-structure lane only. It must not be
used to claim `release-ready`, `active-shell-adopted`, `live evidence`,
`production-ready`, `domain-ready`, packaged GUI acceptance, or owner
acceptance. Candidate smoke proves only the exact candidate cohort that emitted
the artifact. Active release adoption still requires the later
`contracts/app-shell-adapter.json` switch and full release-owner gates.

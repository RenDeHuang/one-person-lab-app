# One Person Lab App Ideal-State Gap Plan

Owner: `one-person-lab-app`
Purpose: `app_ideal_state_gap_plan`
State: `active_plan`
Machine boundary: Human-readable active truth and gap plan. Machine-readable truth lives in `contracts/`, source, release artifacts, updater metadata, and test results.
Date: `2026-05-30`

## Current Completion Progress

| Area | Current status | Current readout |
| --- | --- | --- |
| App product boundary | `active_truth` | App owns desktop packaging, release assets, updater metadata, first-run checks, screenshots, user guides, App contracts, and GUI page-state validation. |
| Framework / domain split | `active_truth` | OPL Framework owns runtime/provider/read-model/action execution; MAS/MAG/RCA/OMA own domain truth, quality/export verdicts, memory body, artifact body, owner receipts, and typed blockers. |
| Active shell boundary | `active_external_checkout` | `shells/aionui/` is an external checkout from `gaofeng21cn/opl-aion-shell`; shell implementation history is not merged into the App repo default branch. |
| Product contracts | `landed_with_release_evidence_tail` | `contracts/app-product-profile.json`, `contracts/app-page-state-matrix.json`, `contracts/app-first-run-test-matrix.json`, and `contracts/app-release-channel.json` hold App-owned machine policy, including packaged assistant route smoke evidence. |
| Runtime progress projection | `landed_contract_backed` | Runtime display consumes OPL shared progress projection fields only: `deliverable_progress_delta`, `platform_repair_delta`, and `progress_delta_classification`. Platform repair is infrastructure repair and cannot be displayed as deliverable, paper, manuscript, or submission progress. |
| Agent installation exposure | `landed_contract_and_live_root_guard_backed` | `contracts/app-install-exposure-policy.json` now owns `agent_installation_contract`: MAS/MAG/RCA are plugin-packaged skill entries with direct skill compatibility, OMA remains an OPL-generated skill surface, and `npm run validate:agent-installation` can verify both real plugin roots and a Codex skills root for duplicate bare MAS/MAG/RCA mirrors. |
| Release user-path evidence | `current_cohort_refs_verified` | Fresh OPL App/operator summary reads `app_release_user_path_evidence_gate_count=5`, `app_release_user_path_evidence_open_gate_count=0`, `app_release_user_path_evidence_verified_ledger_receipt_ref_count=6`, and `app_release_user_path_production_user_path_ready=true`; this is refs-only user-path evidence, not App release-ready or family production-ready authority. |
| Codex App positioning | `active_contract_truth` | The App ordinary path is a Codex CLI fixed-executor experience with built-in MAS/MAG/RCA purpose entries; AionUI multi-backend choices are implementation material, not the user-facing App model. |
| Active shell upstream intake | `landed_verified` | The active shell has absorbed AionUI upstream through `83eb8bda02af44df9795a10f32fa938dd62b628c`; App `contracts/app-shell-adapter.json` records that upstream ref while shell implementation history stays in `gaofeng21cn/opl-aion-shell`. |
| Home shell conformance | `landed_contract_backed` | App contracts and shell tests now require the home input to hide executor/model/permission selectors and show MAS/MAG/RCA as purpose-first entries. |
| Conversation shell conformance | `landed_contract_backed` | App contracts now require ordinary Codex conversations to keep backend/model/permission selectors hidden after send; shell tests cover the conversation header and sendbox. |
| Codex CLI tool-output rendering | `landed_shell_tested` | The active shell normalizes Codex ACP `raw_output` from `aggregated_output`, `formatted_output`, `stdout`, and `stderr` fields and preserves newline-bearing tool output in the conversation view; the shell regression test covers the newline case. |
| Built-in assistant route receipt | `landed_release_gate_backed` | App contracts and release evidence validation now require MAS/MAG/RCA packaged GUI route smoke to persist a Codex CLI `builtin_capability` route receipt so selection is observable beyond the UI badge. |
| Settings diagnostics partition | `landed_contract_backed` | App contracts and product profile now require ordinary Settings tabs to be Overview, Runtime, Capabilities, Access, Appearance, System, and About. Legacy model/agent/assistants/skills-hub/tools/display/webui/pet routes redirect to App-owned pages, and active-shell validation plus shell tests cover the modal, router, and Guid Access shortcut. |
| Docs lifecycle | `single_active_truth_owner` | This file holds current App product gaps and next-round baton; `docs/status.md`, `docs/project.md`, `docs/architecture.md`, `docs/invariants.md`, and `docs/decisions.md` hold durable current truth. |

## Current-State vs Ideal-State Gaps

| Gap | Current state | Completion gate |
| --- | --- | --- |
| `repeat_release_evidence` | App release evidence collector, manifest validation, and OPL ledger projection exist. The current OPL-selected App release/user-path cohort has five evidence gates observed and six verified ledger refs, while per-bundle evidence can still be missing for future release cohorts. | Each release cohort has real artifacts or explicit missing evidence entries, then any release/user-path ledger refs are recorded and verified without claiming App release-ready or family production-ready. |
| `full_first_install_vm_evidence` | Full first-install policy is contract-backed; clean no-CLT VM evidence remains a release gate when requested. | Full first-install reaches Core ready from bundled runtime on a clean Mac, with deferred maintenance proven by VM smoke artifacts. |
| `runtime_page_operator_evidence` | Runtime page consumes OPL App/operator drilldown and refs-only safe action routes. | Page-state tests and GUI smoke show summary-first read model, lazy full detail, dry-run/execute controls, receipt/count refresh, and authority-boundary fields. |
| `active_shell_sync` | App root wrappers prepare App-owned payloads and call the external shell. | Product profile and release contracts are generated into the active shell before build/release, without merging shell history into App mainline. |
| `packaged_gui_codex_path_evidence` | Home and ordinary conversation conformance are contract-backed and unit-tested. The packaged GUI assistant route smoke script and release evidence bundle require MAS/MAG/RCA selection, `@MAS/@MAG/@RCA` badges, hidden backend/model/permission selectors, persisted `opl_assistant_route` receipts, MAS/MAG/RCA screenshots, Full first-run screenshot, Runtime action screenshot, clean VM summary, and same-cohort remote release verification. The 2026-05-31 current-source 26.5.31 bundle at `/Users/gaofeng/workspace/opl-release-evidence/app-current-source-dmg-route-smoke-20260531/evidence-manifest.json` now validates as `passed` with `packaged_app_evidence=true`, 15 contracted artifacts, zero missing evidence, and zero blocked evidence. Its same-cohort GitHub `v26.5.31` release remains a draft with all 11 standard and Full assets verified remotely. | Release evidence stays cohort-bound: each promoted release must provide real packaged route receipts, screenshots, VM summaries, updater/Full assets, and remote verification. A draft evidence bundle can close the current evidence tail, but stable/latest promotion, updater publication, and family production readiness remain separate owner decisions and evidence gates. |
| `agui_codex_candidate_gate` | `contracts/app-shell-candidates.json` declares `agui-codex`; `contracts/shell-adapters/agui-codex.json` can explicitly select the linked `shells/agui-codex` external repo for a technical verification `.app` build. The target is Codex App-style chat-first OPL UI across Electron and WebUI, not a full workbench first screen or AionUI modification list. CopilotKit is the visible UI/runtime layer for chat/sidebar/popup and agent runtime binding; AG-UI is the internal event/protocol layer and must not appear as ordinary user-facing product copy. On 2026-05-30 the candidate gate requires `default_context_collapsed_chat_first_home`: ordinary home opens on the conversation canvas with `without-rail` and `without-inspector`, while the workspace/session rail and right-side inspector are optional context surfaces opened by explicit user action. Candidate evidence covers shared React/CopilotKit renderer, browser `window.oplCandidate` transport bridge with HTTP actions and SSE Codex events, WebUI smoke, Electron source/package smoke, page-state mapping, first-run mapping, runtime summary/full-drilldown, safe App action dry-run, Codex app-server `OK` turn evidence, and release isolation. | Candidate validation proves fixed Codex home, purpose entries, CopilotKit visible UI/runtime integration, AG-UI internal event mapping, OPL App state/action consumption, first-run/page-state mapping, runtime summary/detail/action bridge behavior, shared Electron/WebUI renderer, Web transport bridge, WebUI smoke, default-collapsed chat-first home, PilotDeck-informed reference-only information architecture with no PilotDeck source/runtime authority, App-wrapper launchable `.app` bundle output, source and packaged visible-pixel smoke against a real Codex app-server turn, no ordinary AG-UI/debug protocol copy, and release isolation before any default active-shell switch is considered. |
| `pilotdeck_reference_intake` | OpenBMB PilotDeck has been evaluated at `33394d1069c3528052c3f12eb1d905060b34cc2f` as a reference-only information-organization source. It is valuable for optional lightweight workspace/session rail, nested session list, chat-first main pane, grouped Files, Skills, Routing, Memory, Always-On context, process traces, and compact composer density. It is AGPL-3.0 and owns its own gateway/runtime/memory/router/always-on state, so it is not an App source dependency or runtime authority. | OPL re-expresses the useful organization patterns in App-owned GUI inventory and selected shell work without making them first-screen panels or a full workbench first screen. The ordinary App path remains chat-first by default, while `contracts/app-shell-candidates.json#design_references` keeps PilotDeck as reference-only with no vendored code, no runtime authority transfer, and no candidate promotion without license and adapter gates. |

Current `packaged_gui_codex_path_evidence` remote tail:

- Same-cohort `v26.5.31` now exists as a GitHub draft release with all 11 expected standard and Full assets uploaded. `remote-release-verification.json` reports `status=passed`, `verified_asset_count=11`, and a passed Full first-install budget. The bundle manifest now reports `status=passed`, `packaged_app_evidence=true`, `missing_evidence=[]`, and `blocked_evidence=[]`. The release is still `isDraft=true` and `isPrerelease=false`; it has not been promoted to stable/latest and is not an App release-ready, domain-ready, or family production-ready claim.

## Next-Round Agent Prompt

Objective:

- Govern the One Person Lab App product docs and evidence lifecycle without moving runtime/provider/domain authority into the App repo.

Write scope:

- `docs/active/app-ideal-state-gap-plan.md`, `docs/status.md`, `docs/project.md`, `docs/architecture.md`, `docs/invariants.md`, `docs/decisions.md`, App contracts, release scripts, testing docs, and focused App tests that affect App product boundary, release evidence, first-run policy, or page-state validation.

Live truth inputs:

- `AGENTS.md`, `TASTE.md`, `README.md`, `docs/README.md`, `docs/status.md`, this plan, App contracts, release/test scripts, shell adapter contract, release evidence manifests, active shell validation outputs, focused shell tests for App-owned GUI behavior, and live `npm run validate:agent-installation` output when install exposure is touched.
- OPL Framework runtime/App drilldown CLI JSON only as consumed input; it remains framework-owned truth.

Required actions:

- Keep App docs, contracts, release wrappers, evidence manifests, and page-state tests aligned with the App product boundary.
- Keep Runtime progress display bound to OPL shared progress projection classifications only; platform repair must stay an infrastructure repair signal, not a deliverable or manuscript/submission progress claim.
- Keep the independent agent installation contract aligned with App/Framework/domain ownership: MAS/MAG/RCA are plugin-packaged skill entries, OMA is OPL-generated, optional live plugin roots must contain `.codex-plugin/plugin.json` plus `skills/<id>/SKILL.md`, and optional Codex skills root validation must fail closed on duplicate bare MAS/MAG/RCA mirrors.
- Keep the App ordinary path aligned with the Codex App equivalent positioning: Codex CLI fixed executor, no home or ordinary-conversation backend/model/permission selector, MAS/MAG/RCA as built-in purpose entries, precise model details limited to technical/connected-state surfaces.
- Keep Codex CLI conversation output rendering aligned with native Codex behavior: ACP tool-call normalization must preserve newline-bearing `raw_output` / `stdout` / `stderr` content instead of collapsing command output into one visual line.
- Keep built-in assistant sends observable with a route receipt: `route_kind=builtin_capability`, `executor=codex_cli`, `assistant_id`, `assistant_short_name`, and `source=opl_app_home`.
- Keep ordinary Settings aligned with the App-owned navigation partition: Overview, Runtime, Capabilities, Access, Appearance, System, and About. Treat model/agent/assistants/skills-hub/tools/display/webui/pet as legacy or diagnostics routes that redirect to App-owned pages.
- Keep shell candidate work isolated in `contracts/app-shell-candidates.json`, `contracts/shell-adapters/<candidate>.json`, and linked `shells/<candidate>` external repos until adoption; default release wrappers continue to use `contracts/app-shell-adapter.json` unless `OPL_APP_SHELL_ADAPTER_CONTRACT` is explicitly set for a candidate build.
- Keep AG-UI/CopilotKit candidate docs aligned with `docs/app-gui-feature-inventory.md`: the target is Codex App-style chat-first OPL UI across Electron and WebUI, CopilotKit is the visible UI/runtime layer, AG-UI is the internal event/protocol layer, and candidate verification must include explicit adapter selection, App-root packaging, shared renderer proof, Web transport bridge proof, WebUI smoke, source UI smoke, packaged UI smoke, and release isolation.
- Use PilotDeck only as a design reference for information organization and navigation shape. Re-express useful ideas as OPL-owned lightweight workspace/session rail and right-side collapsible inspector requirements; do not copy AGPL source, adopt PilotDeck runtime authority, expose its provider/model/router controls, or make a full workbench first screen on the ordinary App path.
- For each release cohort, classify evidence as present, missing, typed blocker, or not applicable; never promote missing evidence to release-ready proof.
- When OPL App/operator drilldown reports current cohort release/user-path refs, reflect the verified refs-only state in App docs without converting it into release-ready, domain-ready, or production-ready authority.
- Keep active shell intake explicit: App-owned product/release contract changes stay here, shell implementation changes stay in `opl-aion-shell`.

Non-goals:

- Do not own OPL runtime truth, provider implementation, action-route authority, domain truth, domain quality/export verdict, memory body, artifact body, artifact authority, owner receipt authority, or shell implementation history.
- Do not use App UI rendering, provider completion, updater metadata, or release artifact existence as proof of MAS/MAG/RCA readiness or family production readiness.

Verification commands:

- Docs-only: `rtk git diff --check`, `rtk rg -n "^(<<<<<<<|=======|>>>>>>>)" docs`, `python3 /Users/gaofeng/workspace/opl-doc-governance/scripts/opl_doc_doctor.py doctor /Users/gaofeng/workspace/one-person-lab-app --format json`.
- App contract/release boundary changes: `rtk npm run test:release-boundary`, `rtk npm run validate:agent-installation`, live `npm run validate:agent-installation -- --codex-skills-root ~/.codex/skills --agent-root mas=<path> --agent-root mag=<path> --agent-root rca=<path>` when plugin roots are available, `rtk node --experimental-strip-types scripts/validate-active-shell.ts --quick`, and the touched release/evidence validation script.
- AG-UI/CopilotKit candidate contract/docs changes: `rtk npm run validate:shell-candidates`, `rtk env OPL_APP_SHELL_ADAPTER_CONTRACT=contracts/shell-adapters/agui-codex.json node --experimental-strip-types scripts/validate-active-shell.ts --quick`, `rtk npm --prefix shells/agui-codex run smoke:webui`, and, when packaging evidence is being claimed, `rtk env OPL_APP_SHELL_ADAPTER_CONTRACT=contracts/shell-adapters/agui-codex.json npm run package`.
- Shell implementation changes: focused `vitest` for Guid/home/conversation selectors, Settings modal, Guid Access shortcut, and route receipt, `bunx tsc --noEmit`, `bunx oxfmt --check` on touched shell files, and packaged GUI smoke with `--assistant-route-smoke` for release evidence.

Completion gate:

- The App active plan, status, project, architecture, invariants, decisions, contracts, and test docs agree on App ownership and non-ownership.
- Agent installation exposure has a single semantic path: MAS/MAG/RCA plugin-packaged skills plus direct skill compatibility, no duplicate bare skill mirrors, and OMA as an OPL-generated skill surface.
- Home, ordinary conversation, ordinary Settings, and built-in assistant route receipt behavior are enforced by App contracts, active-shell validation, and active shell tests.
- Release evidence gaps are explicit; packaged assistant route smoke must be present before claiming packaged GUI Codex-path evidence, and no App doc claims runtime truth, domain ready, release ready, or production ready beyond the available artifacts and contracts.

Foldback target:

- Durable product truth folds back to `docs/status.md`, `docs/project.md`, `docs/architecture.md`, `docs/invariants.md`, `docs/decisions.md`, or App contracts.
- Release proof, screenshots, VM logs, remote verification, and command traces stay in release artifacts, evidence manifests, CI logs, history docs, or commit history, not in active docs as execution logs.

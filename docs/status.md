# One Person Lab App Status

Owner: `one-person-lab-app`
Purpose: `app_status`
State: `active`
Machine boundary: Human-readable status. Use `contracts/` and release/test
artifacts for machine decisions.

Plugin native profile pointer: `contracts/opl-native-profile.json` only declares
the repo-native profile used by OPL Flow / OPL Doc plugin sync and drift checks.
It is not GUI product truth, release authority, runtime truth, domain truth, or
installation evidence.

## Current State

- GitHub repo: `gaofeng21cn/one-person-lab-app`.
- App product repo history policy: clean App-owned history only.
- Active shell: `aionui`.
- Active shell root: `shells/aionui` as an external checkout.
- Active shell source repo: `gaofeng21cn/opl-aion-shell`.
- App product profile: `contracts/app-product-profile.json`.
- Framework dependency: `gaofeng21cn/one-person-lab`.
- Local App repo path on the maintainer Mac:
  `/Users/gaofeng/workspace/one-person-lab-app`.
- Local shell repo path on the maintainer Mac:
  `/Users/gaofeng/workspace/opl-aion-shell`.

The App repo must not merge AionUI history into its default branch. AionUI
upstream-following work stays in `opl-aion-shell`; App product release and user
docs stay in `one-person-lab-app`.

The App product profile is the current owner for desktop session defaults and
user-facing product policy: Codex default model/reasoning, default visible
companion skills, first-run deferred maintenance behavior, and Settings
presentation keys. The active shell consumes the generated copy at the
`shell_contract.paths.product_profile_target` path declared in
`contracts/app-shell-adapter.json`; runtime truth, provider implementation, and
domain truth remain outside App ownership.

The current product boundary is purpose-first: the App is the Codex wrapper and
product truth for ordinary users entering research, grant, presentation, and
general work. It owns the App user path and contracts that make MAS/MAG/RCA
visible as built-in purpose entries; it does not own domain readiness,
owner-receipt authority, artifact authority, memory body, or OPL family
production readiness.

The active shell currently tracks AionUI upstream through
`82262a3f6cfe479bef7f7f464c3208e28db57ce8` while preserving the App-owned
product profile. That intake is recorded in `contracts/app-shell-adapter.json`,
which is the active shell source of truth; the upstream code is implementation
material, not product authority. The shell also keeps Codex ACP tool-call
output display aligned with native Codex behavior by preserving newline-bearing
`raw_output` / `stdout` / `stderr` content in the conversation view.

GUI interaction status: Home/Guid is contract-backed as a composer-first Codex
canvas with visible GPT-5.5（超高） model status, purpose entries `科研`/`基金`/
`演示`, collapsed workspace/session rail, and a collapsed right context
inspector. The element audit lives in
`docs/app-gui-element-audit.md`; the target interaction definition lives in
`docs/app-ideal-gui-interaction-spec.md`; machine acceptance is enforced by
`contracts/app-gui-product-contract.json`,
`contracts/app-page-state-matrix.json`,
`contracts/app-product-profile.json`, `scripts/validate-active-shell.ts`, and
focused release-boundary tests. The active shell implements the right inspector
as a user-opened auxiliary surface with Files, Capabilities, Routing/runtime,
Memory, Automations, and Settings tabs while keeping runtime truth, domain
truth, memory body, and artifact body outside shell authority.

Install/exposure policy is now contract-backed in
`contracts/app-install-exposure-policy.json`. The public semantic ABI is the
domain skill; Codex App plugins are distribution/capability bundles, and CLI,
App, direct skill, and product-entry surfaces converge on the same
domain-owned action/stage metadata. MAS/MAG/RCA are default App purpose entries
and plugin-visible domain skills, not companion skill mirrors under
`~/.codex/skills/{mas,mag,rca}`. OPL Meta Agent remains an OPL-generated Codex
surface and an App/CLI-managed ecosystem module, but not a default home
assistant. Companion skill sync stays limited to the App-level packaged
whitelist such as Superpowers, cron, the OfficeCLI family, PDF, MinerU, and
UI/UX helpers. AionUI builtin skills remain candidate shell capabilities unless
the App profile explicitly whitelists them. `agent_installation_contract` now
also separates ordinary module/agent-pack maintenance from Developer Profile
checkout overrides: ordinary users consume App/CLI-managed maintenance after the
App is installed, while GitHub repo or local checkout sources are an explicit
`source_channel` opt-in. Settings now shows Developer Profile
capabilities instead of a single Developer Mode switch: `source_channel`,
`workspace_trust`, `github_authority`, `agent_automation`, and
`runtime_mutation_scope`. `opl-flow` is a Codex workflow/profile plugin and not
a WebUI image, standard updater target, or `one-person-lab-modules/*` package.
The independent agent installation path is pinned by
`contracts/app-install-exposure-policy.json`: MAS/MAG/RCA must register through
Codex plugin registry targets while keeping direct skill compatibility and the
same action/stage metadata; OMA stays on the OPL-generated local Codex plugin
surface. Managed agent-pack distribution now fails closed when a stable package
channel is unavailable and uses bundled Full runtime modules before any explicit
Developer Profile checkout override. The machine gate is
`npm run validate:agent-installation`, with optional
`--agent-root <id>=<path>` checks for real plugin roots and
`--codex-skills-root <path>` checks that MAS/MAG/RCA are not also installed as
duplicate bare Codex skill mirrors.

First-install policy is now contract-backed in
`contracts/app-product-profile.json` and
`contracts/app-first-run-test-matrix.json`: `ready_to_launch` runs before
`/guid` and requires only Core readiness: workspace root, Codex CLI, and Codex
config. Full first-install reaches Core ready from bundled runtime on a clean
Mac without requiring CLT, Homebrew, Node, or Git first. Domain modules, the
Temporal-backed family runtime provider, recommended skills, native helpers,
repo sync, module reconcile, CLT installation, companion skills installation,
and ecosystem module updates are Full readiness or App/CLI-managed background
maintenance instead of blocking first launch. Standard packages prefer
App-managed bootstrap and maintenance and cannot use “install
Homebrew/Node/Git first” as the first-screen terminal state. CLT requests use
`xcode-select --install` and wait for user confirmation inside Apple's system
installer. `officecli`, MinerU, and `opl-meta-agent` are App/CLI-managed
ecosystem modules.

First conversation readiness is now part of the App-owned setup contract. The
active shell must warm the ACP conversation and wait for the conversation record
before sending the initial `/guid` message. Slow first-run dependency unpacking
therefore becomes a retryable setup/send state instead of a fixed ACP handshake
timeout or a lost prompt. This does not make Full readiness block first launch.

Temporal auto-configuration is now explicit in the install contract and release
channel. The packaged wrapper exports `OPL_FAMILY_RUNTIME_PROVIDER=temporal`,
`OPL_TEMPORAL_ADDRESS=127.0.0.1:7233`, `OPL_TEMPORAL_NAMESPACE=default`, and
`OPL_TEMPORAL_TASK_QUEUE=opl-stage-attempts`; OPL Framework still owns service
start, worker lifecycle, readiness diagnostics, residency proof, and repair
receipts. Temporal provider readiness remains Full readiness/background
maintenance for ordinary first launch.

First-run progress is also contract-backed. The shared progress model is
produced by `opl system initialize --json` at
`system_initialize.setup_flow`; App, CLI one-shot install, and Docker/WebUI
surfaces must derive phase, Core progress, Full readiness progress, background
maintenance counts, blockers, and next visible steps from that model instead of
maintaining separate installer-specific progress truth. The active shell renders
this model only and does not own private first-run progress state.

Runtime bridge command resolution is part of the App-owned runtime contract.
The active shell may prefer an App-managed `opl` only when that shim resolves to
an existing CLI payload. If a stale managed Node shim points at a removed
temporary install or missing `dist/cli.js`, the adapter must skip it and fall
through to a healthy system `opl` such as `/opt/homebrew/bin/opl`. A damaged
managed shim must not make first-run display `0/0` progress or override
`opl system initialize --json` when the framework CLI is otherwise available.

Runtime progress display is contract-backed separately from first-run progress.
The Runtime page is now user-task-status first. Its first screen answers four
ordinary user questions before showing any technical runtime evidence: how many
tasks are running, how many projects/tasks are active, how many are queued, and
how many need attention. Each visible task line must then show title, status,
stage, progress label, next step, owner, and last progress. The App derives that
view from the OPL Framework refs-only App state projection:
`app_state.operator.workbench.summary_cards`,
`activity_center`, `task_drilldowns`, and
`operator.visual_ref_groups.active_project_refs`.

The mature product lesson is durable but simple: a status page starts with the
user's job-to-be-done, not with implementation telemetry. Users need to know
whether work is moving, what is queued, what needs them, and where each task is
stuck or progressing. Provider runs, projections, refs, ledgers, stage attempts,
and `current_control_state` are valuable evidence, but they are diagnostic
vocabulary. They stay behind secondary disclosure, explicit full detail, audit,
or release evidence paths. The daily Runtime page must not default-display the
words Temporal, provider, projection, ref, stage attempt, ledger, or
current_control_state.

The user-visible counts stay display-only and refs-only. `running_task_count`
counts tasks projected as actively running or advancing, not raw provider
attempts. `active_project_count` and `queued_project_count` come from
framework-owned project/task line projections and preserve status, active run
presence, and next step without claiming worker execution. `attention_count`
comes from projected blockers, human gates, failed safe actions, or owner
attention states. Project progress still classifies
`deliverable_progress_delta` separately from `platform_repair_delta`; platform
repair is shown as infrastructure repair and cannot be presented as substantive
deliverable, paper, manuscript, or submission progress.

Runtime task drilldown now also consumes the OPL Stage Artifact Kernel workbench
projection as artifact-native refs. The App may display current pointer,
canonical artifact refs, export artifact refs, lineage refs, retention policy
ref, conformance summary ref, and related manifest/hash/receipt/blocker refs
from `app_state.operator.workbench.task_drilldowns.artifact_native_drilldown`.
This remains a refs-only read model: the App does not read domain artifact
body, does not mutate artifact body, and does not declare MAS/MAG/RCA/OMA
quality verdicts, export readiness, domain readiness, App release readiness, or
family production readiness from those refs.

Runtime task drilldown also consumes the OPL State Index Kernel / SQLite sidecar
only through Framework-projected read-model refs. The allowed App path is
`opl app state --profile fast --json`, explicit full App state, or task
operator drilldown JSON; refs may drill down to the Stage Folder, but the App
does not directly read or write the SQLite sidecar, mutate the State Index
Kernel, write domain truth, create owner receipts, inspect artifact bodies, or
authorize readiness, quality/export verdicts, artifact authority, App release
readiness, or family production readiness.

`running_provider_attempt_count` remains diagnostic. It may include checkpointed
provider refs and must not be displayed as the user's running task count.
`domain_lane_map.active_task_count`, `module_runtime dirty`, module readiness,
repo/worktree diagnostics, and assistant purpose cards remain forbidden
running-task sources. The `validate:active-shell --quick` and focused
release-boundary/runtime-bridge tests lock this user-task-first distinction.

Non-running project lines are now a separate collapsed group. Queued, pending,
waiting, stopped, parked, checkpointed, blocked, or attention-needed project
lines preserve their status, `active_run_id`, and next visible step, but only
explicit `running`, `in_progress`, or `advancing` status/state contributes to
the visible running task count. `active_run_id` alone is context, not liveness
proof.

The upstream AionUI Team surface is disabled for ordinary OPL App use. Team
mode is off by default, the Team sidebar entry is hidden, Team-created redirects
no-op, Team deep links are not whitelisted, and compatible `/team/*` routes
return to the App-owned home path. This keeps the fork delta thin while avoiding
an upstream team-leader configuration that does not map to OPL purpose routing.

The App first-run screen presents that shared model in a beginner-first way:
the primary view shows a plain readiness summary, three user-facing setup
steps, the required Core progress, the single primary start action, and only
the next user-relevant step. Technical phase labels, refresh controls, runtime
settings, raw errors, maintenance actions, Full readiness, background
maintenance, raw command refs, and module/provider/tool details stay inside
collapsed technical details by default. Clean-machine users should see whether
the App is preparing, ready, or needs their attention without being asked to
interpret Homebrew, Node, Git, CLT, runtime provider, module maintenance, or
raw command output as the main installation goal.

This follows mature first-run patterns rather than a custom App-only wizard.
GNOME Initial Setup frames first boot around only a few essential steps that
lack good defaults; VS Code walkthrough guidance keeps onboarding checklists
short and action-oriented; Homebrew's installer history shows that ambiguous
terminal prompts can confuse non-technical users. OPL therefore keeps the App
first screen essential, action-led, and user-language first, while retaining
full diagnostics in collapsed technical details.

## Release State

Standard App release assets and updater metadata are App-owned and currently
macOS arm64-only. Full first-install assets remain explicitly separate from
standard updater metadata. The updater must not select assets whose names
include `Full`. Standard App updates download in the background and apply after
restart when ready; they do not block first-run Core ready. This follows the
Electron autoUpdater background-download and download-ready restart prompt
model. Full assets are available as GitHub Release first-install downloads and
as the explicit stable `one-person-lab-full` Homebrew cask; they do not enter
updater metadata. GitHub Release uploads, standard DMG, Full DMG, GUI smoke,
Homebrew cask smoke, and user tutorials are all App-owned. The Framework repo is only a
runtime/CLI/contracts payload source for Full DMG and a machine-interface
provider for the App.

Stable macOS releases currently use local authorization policy assets rather
than requiring paid Apple Developer ID signing. First-run VM smokes must clear
quarantine after installing the App, write
`artifacts/gatekeeper-launch-policy.json`, and record `codesign` / `spctl`
diagnostics as the local-authorization evidence for the same release cohort.
Stable release assets must publish `standard-local-authorization-policy.json`
and `full-local-authorization-policy.json`; Homebrew tap sync requires the
matching policy asset before updating a cask.

Full release packaging also treats native runtime executable trust as a release
gate. Full builds must publish `full-runtime-native-trust.json`, include that
file and `full-local-authorization-policy.json` in `SHA256SUMS.txt`, and keep
the remote verifier's runtime-size hard gate in the release contract. Full DMG
compressed-size thresholds are release-review warnings, while checksum,
manifest, native-trust, remote verification, VM, and local-authorization gates
remain the release truth.

Release and user-path evidence remains cohort-bound App evidence. Verified
release bundle refs, screenshots, remote asset checks, or packaged route smoke
can support release-owner review for the same App cohort, but they do not
promote stable/latest by themselves and do not prove domain readiness or OPL
family production readiness.

Current release validation is App-root first: root wrappers call the active shell
build/release scripts, then the produced standard package can replace
`/Applications/One Person Lab.app` for a real local GUI startup smoke.
`hygiene:fallow` is only the App-root wrapper hygiene gate and does not replace
active shell validation or GUI compile evidence. Use `npm run
validate:gui-shell` when the change must prove the active shell still validates
and compiles through the App wrapper path.

Runtime page evidence path is declared in
`contracts/app-page-state-matrix.json`: the active shell reads default task
status through `opl app state --profile fast --json`, uses
`opl runtime app-operator-drilldown --json` only for secondary runtime
diagnostics, keeps `opl app state --profile full --json` for explicit full-state
diagnostic or release evidence, and lazy-loads full detail through `opl runtime
app-operator-drilldown --detail full --json`. The page stays user-task-first,
loads full detail only on demand, uses a 5-10 second lightweight polling
fallback when push projection is unavailable, and exposes only refs-only
`opl app action execute --action <id> [--payload json] [--dry-run] --json`
controls. Execution refreshes the App state projection so receipt/count fields
stay framework-owned; MAS/MAG/RCA verdicts and artifact authority remain
domain-owned refs.

Current GUI product truth 现在有明确的人读定义栈：
`docs/app-ideal-gui-interaction-spec.md` 定义 Codex App 形态、chat-first 的交互
目标；`docs/codex-to-opl-app-delta.md` 定义 Codex App 之上的 OPL 产品增量；
`docs/app-gui-feature-inventory.md` 跟踪跨 shell 能力清单和参考模式。机器可读
GUI truth 声明在 `contracts/app-gui-product-contract.json`：the default executor experience is
fixed to Codex CLI on the ordinary App path; the home screen exposes three
beginner-facing purpose entries: 科研, 基金, and 演示. Those entries route to
MAS, MAG, and RCA respectively, and the selected entry is presented as a compact
`@` purpose tag instead of a full agent-title hero. The home input does not
expose Aion CLI, Claude Code, backend switching, provider lists, or permission
mode controls; ordinary Codex conversations must not reintroduce those selector
surfaces after send. Built-in MAS/MAG/RCA sends must persist a route receipt
showing `builtin_capability`, `codex_cli`, the assistant id, the assistant short
name, and `opl_app_home`, so the route is observable beyond the visible badge.
It shows a compact Codex model selector/status derived from the App product
profile, currently `GPT-5.5（超高）`, on Home and ordinary Codex conversation
composer surfaces; this remains App-owned and must not become backend or
permission selection. Conversation pending/running state now shows elapsed seconds so users
can see the App is working while a Codex response is still in progress.
Each default purpose entry also owns an assistant-scoped skill profile: MAS
requires `mas`, MAG requires `mag`, and RCA requires `rca`; optional companion
skills are selected from that assistant profile after passing the App packaged
skill set boundary；Settings auto-injected skills are filtered through the same
App packaged whitelist, so AionUI helper skills such as `aionui-skills` do not
surface as OPL App capabilities。Home surface 不显示 runtime activity、continue-work、
needs-attention/active/recent refs、per-assistant running badges 或底部
feedback/favorite/web 图标；这些信息属于 Runtime、右侧 inspector、drawer 或其他
secondary context surface，必须保持 refs-only，不能变成 ordinary home first-screen
workbench。Settings 的 General/Access/Agents &
Capabilities/Local Environment/Appearance/Advanced/About & Updates surfaces、
module path source explanation、stable/nightly release gates 和 OPL Agent Codex
context 都是 App-owned requirements。Upstream overview、runtime、system、model、
agent、assistants、skills-hub、tools、display、webui、pet routes redirect 到
App-owned pages，不是 ordinary user tabs。`/guid` quick shortcut 打开 Access，
而不是 WebUI-branded entry。OPL Meta Agent 仍是 App/CLI-managed ecosystem
module，不是 default home assistant entry。MDS 不是 default GUI module，只保留
historical 或 explicit-reference。`contracts/app-shell-adapter.json` 要求 active
shell 实现该 App contract，并保持 upstream AionUI 只是 implementation material，
不是 product authority。Home runtime suppression、secondary runtime refs、
forbidden display fields 和 Settings page sections now have matching page-state matrix entries,
and `validate:active-shell --quick` plus the focused release-boundary GUI tests
fail closed if the contract and matrix drift.

Experimental shell candidate work is separated from the active release adapter.
`contracts/app-shell-candidates.json` now declares `agui-codex` under
`shells/agui-codex/` as a linked external repo for a thinner AG-UI/Codex shell.
`contracts/shell-adapters/agui-codex.json` can be selected with
`OPL_APP_SHELL_ADAPTER_CONTRACT` so the same App wrapper syncs the product
profile and builds the candidate launchable `.app` bundle. Default
stable/nightly release packaging still resolves `contracts/app-shell-adapter.json`
and the active `aionui` shell. Candidate validation now requires fixed Codex
home behavior, purpose-first MAS/MAG/RCA entries, CopilotKit visible UI,
AG-UI internal event mapping, `opl app state/action` consumption, active project
line state-model validation, first-run/page-state mapping, shared
Electron/WebUI renderer, Web transport bridge, WebUI smoke, explicit `.app`
packaging with `Contents/Info.plist` and a `Contents/MacOS` executable, and
release isolation without changing the active release shell.

Candidate shell work enters App product truth only through App-owned contract
updates and validation gates. Shell implementation roadmaps, upstream GUI
defaults, and candidate package evidence remain technical verification until a
separate active-shell adoption decision changes the default adapter contract.

The `agui-codex` target is the Codex App-like OPL chat-first inventory, not an
AionUI patch list or full workbench first screen. The intended first-class
experience is workspace-aware conversation, fixed Codex execution, MAS/MAG/RCA
purpose routing, lightweight workspace/session rail, right-side collapsible
Files/Skills/Routing/Memory/Always-On context tabs, compact runtime/status refs,
App-owned Settings, WebUI delivery from the same renderer, and packaged `.app`
verification through the App wrapper. CopilotKit is the
visible UI/runtime layer for chat, sidebar, popup, and agent runtime binding.
AG-UI is the internal event/protocol layer between that renderer runtime and
Codex app-server or ACP compatibility adapters; AG-UI protocol naming and debug
dashboards are not ordinary user concepts. WebUI uses the same
`window.oplCandidate` bridge shape through local HTTP actions and SSE Codex
events, not a separate product state source.

OpenBMB PilotDeck has been recorded as a design reference for information
organization, not as a source, runtime dependency, or first-screen product
template. The useful reference is its polished lightweight workspace/project
rail, nested conversations, chat-first main pane, grouped Files, Skills,
Routing, Memory, and Always-On context, and compact composer controls. OPL maps
those ideas to App-owned conversation, Files, Capabilities, Runtime/cost refs,
Memory refs, Automations, and Settings as right-side collapsible inspector
surfaces while keeping Codex app-server as the primary backend and `opl app
state/action` as the runtime bridge. PilotDeck is AGPL-3.0, so its code,
gateway, runtime, memory, router, always-on store, provider model list, and
WorkSpace state model remain excluded unless a separate license and
candidate-adoption decision is made.

The candidate command surface is explicit. App-root guard and packaging use:

```bash
node --experimental-strip-types scripts/validate-active-shell.ts --quick
npm run validate:shell-candidates
OPL_APP_SHELL_ADAPTER_CONTRACT=contracts/shell-adapters/agui-codex.json node --experimental-strip-types scripts/validate-active-shell.ts --quick
OPL_APP_SHELL_ADAPTER_CONTRACT=contracts/shell-adapters/agui-codex.json npm run package
```

Candidate-shell source and smoke checks use:

```bash
cd shells/agui-codex
npm install
npm run validate:adapter-events
npm run validate:state-model
npm run validate:candidate
npm run build:renderer
npm run smoke:webui
npx electron . --ui-smoke-test
'./out/One Person Lab AG-UI Codex Candidate.app/Contents/MacOS/One Person Lab AG-UI Codex Candidate' --ui-smoke-test
```

Minimum candidate acceptance is App-root AionUI release guard still passing,
candidate registry validation, explicit adapter selection only, App-owned
generated product profile consumption, shell-side `npm run validate:state-model`
proof that the candidate consumes active project line projection from `opl app
state --profile fast --json`, source renderer build, shared Electron/WebUI
renderer proof, WebUI smoke, PilotDeck-informed reference-only information
organization proof, source and packaged visible-pixel UI smoke against a real Codex
app-server `OK` turn, a launchable `.app` bundle with `Contents/Info.plist` and
`Contents/MacOS`, page-state/first-run matrix mapping, runtime summary plus
explicit full drilldown, safe App action dry-run receipts, and no AG-UI/debug
protocol copy on the ordinary chat surface. Default release promotion is still
an explicit release decision: stable/nightly packaging continues to use AionUI
until `contracts/app-shell-adapter.json` is deliberately changed.

Candidate and release evidence currentness is intentionally kept outside this
status file. `agui-codex` remains an explicit technical verification candidate:
it can be selected through
`OPL_APP_SHELL_ADAPTER_CONTRACT=contracts/shell-adapters/agui-codex.json`, but
it is not the default release shell, not App product authority, and not
domain-ready or production-ready evidence. Current candidate claims must be
proved by the candidate registry, explicit adapter validation, shell-side
state-model validation, source/WebUI/package smoke, candidate manifests, and
App-root release isolation checks.

Release evidence collection is App-owned but cohort-bound. The collector and
manifest validator can import OPL App state JSON, drilldown JSON, safe-action
dry-run or execute receipts, screenshots, clean VM summaries, settings smoke,
assistant route smoke, remote Release verification, Codex functional check
receipts, typed blockers, and explicit artifact mappings. Each required artifact
is classified as `present`, `missing`, `typed_blocker`, or `not_applicable`;
only an all-present verified bundle can set `packaged_app_evidence=true`.
Current-source or local smoke evidence does not update a published cohort, does
not promote stable/latest, and does not prove MAS/MAG/RCA domain readiness or
OPL family production readiness.

Dated local smoke, candidate, current-source release, and migration notes have
been moved to
`docs/history/process/2026-06-03-app-docs-lifecycle-cleanup-archive.md`. New
proof-by-proof records belong in release artifacts, candidate manifests, CI logs,
or precise history/provenance docs; durable rules fold back into contracts,
core docs, release/testing docs, or the active gap plan.

## Validation Entry Points

```bash
npm run ensure:shell
bun install --cwd shells/aionui --frozen-lockfile
node --experimental-strip-types scripts/validate-active-shell.ts --quick
npm run test:release-boundary
npm run validate:release-boundary
npm run hygiene:fallow -- --format json --summary
npm run validate:gui-shell
npm run validate:shell-candidates
OPL_APP_SHELL_ADAPTER_CONTRACT=contracts/shell-adapters/agui-codex.json npm run package
bun run i18n:types
bun run test
node --experimental-strip-types scripts/prepare-release-assets.ts build-artifacts release-assets
node --experimental-strip-types scripts/validate-release.ts release-assets
```

Page-state and first-run expectations are declared in
`contracts/app-page-state-matrix.json` and
`contracts/app-first-run-test-matrix.json`.
Product defaults are declared in `contracts/app-product-profile.json`.

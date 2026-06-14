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
`70974c59a275e565e8fc2bd7ecaf2dcac74227f0` while preserving the App-owned
product profile. That intake is recorded in `contracts/app-shell-adapter.json`,
which is the active shell source of truth; the upstream code is implementation
material, not product authority. The shell also keeps Codex ACP tool-call
output display aligned with native Codex behavior by preserving newline-bearing
`raw_output` / `stdout` / `stderr` content in the conversation view. The updater
now selects the macOS ZIP for in-app updates, uses an App-managed local
authorization installer to replace the local App bundle, clears quarantine,
records diagnostics, and relaunches the updated App.

Active shell upgrade hardening is now App-owned and machine-checked. The adapter
contract records upstream feature classifications and required implementation
probes before release. AionUI Team is classified as rejected for ordinary App
surfaces; Team route redirects, sidebar gating, Team-created redirect no-op,
ordinary conversation MCP snapshot scrub, agent switching without Team MCP
inheritance, Team deep-link rejection, and the IPC bridge mutation gate are
required probes. Ordinary MCP filtering is represented as executable
`forbidden_mcp_matchers` plus `scrub_extra_keys` data in both the GUI contract
and product profile.

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

First-run and Runtime readouts are contract-backed App consumers of OPL
Framework surfaces. First-run progress derives from `opl system initialize
--json#system_initialize.setup_flow`, and the Runtime page defaults to
`opl app state --profile fast --json`; explicit full App state and
`opl runtime app-operator-drilldown --detail full --json` remain on-demand
diagnostic or release-evidence surfaces. Runtime bridge command resolution,
provider readiness repair commands, user-task counts, project progress
classification, State Index refs and Stage Artifact refs are owned by
`contracts/app-runtime-bridge.json`, `contracts/app-page-state-matrix.json`,
`contracts/app-gui-product-contract.json`, `docs/architecture.md`,
`docs/decisions.md`, `scripts/validate-active-shell.ts`, and focused
release-boundary tests.

The current Runtime product rule is user-task-status first: the first screen
answers running, active, queued, attention, and each task's next visible step
before exposing provider or ledger diagnostics. Provider readiness repair stays
infrastructure-only; `running_provider_attempt_count`, raw provider refs,
State Index / SQLite sidecar refs, Stage Artifact refs, active run ids and
full drilldown fields remain secondary or on-demand evidence. The App displays
refs-only projections and never owns runtime truth, provider implementation,
domain truth, artifact body, owner receipts, typed blockers, domain verdicts,
App release readiness, or family production readiness.

The upstream AionUI Team surface is disabled for ordinary OPL App use. Team
mode is off by default, the Team sidebar entry is hidden, Team-created redirects
no-op, Team deep links are not whitelisted, and compatible `/team/*` routes
return to the App-owned home path. User feedback showed a separate exposure path:
ordinary conversations could inherit historical Team MCP snapshots such as
`aionui-team`, `team_members`, `team_list_models`, and `team_spawn_agent`. The
active shell now also scrubs Team MCP names and Team metadata from ordinary
conversation snapshots before rendering loaded MCP state or creating derived
ACP conversations. This keeps the fork delta thin while avoiding an upstream
team-leader configuration that does not map to OPL purpose routing.

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
standard updater metadata. The standard updater is desktop-App-assets only; Full
assets stay as GitHub Release first-install downloads and the explicit stable
`one-person-lab-full` Homebrew cask. Standard updater ZIP trust, App-managed
local authorization, Full native-runtime trust, size budgets, Homebrew tap
policy, and release workflow sequencing are governed by
`contracts/app-release-channel.json`, `docs/release/README.md`, release
workflows, validators, and release artifacts.

The standard updater now treats downloaded and applied as separate states.
`update_downloaded` only proves that the package is cached. Installation success
requires `update_apply_started`, a post-restart running-version switch to the
downloaded target version, and either an applied-version receipt or an explicit
`install-not-applied` recovery state. Active-shell validation checks the
App-managed local authorized macOS installer plus
`auto-update-diagnostics.json#quit-and-install` /
`auto-update-diagnostics.json#install-not-applied`, so a failed replacement is
visible and retryable instead of being mistaken for a completed update.

The managed update plane is now App consumption of the OPL Framework update
runner: status/check/plan are read surfaces, and apply/repair/rollback stay
Framework runner results. The App may display component receipt refs,
lock/runner status, post-apply sync state, skip reasons, reload guidance and
safe update actions; it still does not implement the update kernel, read managed
artifact bodies, write runtime or domain truth, create owner receipts, mutate
dirty/developer checkouts, silently upgrade Homebrew/system tools, or claim
MAS/MAG/RCA quality/export verdicts.

Release and user-path evidence remains cohort-bound. Evidence manifests
classify required artifacts as `present`, `missing`, `typed_blocker`, or
`not_applicable`; only all-present verified bundles can set
`packaged_app_evidence=true`. `l5_evidence_readout` and
`release_owner_verdict` are App release-owner inputs for the same cohort:
passing evidence yields `release_owner_verdict_pending`, missing or blocked
required evidence yields `release_owner_typed_blocker_required`. The pending
readout includes `install_evidence_ref` and `release_owner_typed_blocker_ref`;
stable promotion still requires a same-cohort `release_owner_verdict_ref` or
`release_owner_receipt_ref`. Pending, typed-blocker, install-evidence, and
human-gate refs do not authorize release-ready, stable/latest promotion, domain
readiness, or OPL family production readiness.

For `v26.6.12`, the App release owner resolved the pending release-owner gate
with
`release_owner_receipt_ref://one-person-lab-app/release-owner/v26.6.12/receipt-20260612-owner-verdict`,
recorded in `docs/release/records/v26.6.12-release-owner-receipt.json`. The
receipt closes the App release-owner verdict path for that cohort only; it does
not claim OPL family production readiness, domain readiness, or MAS/MAG/RCA
quality/export verdicts.

The detailed `v26.6.12` run/timing/asset profile is historical provenance under
`docs/history/process/2026-06-12-stable-release-profile.md`. Current release
status stays on the owner receipt, release artifacts, release records,
contracts, workflows, validators, and CI outputs rather than the dated profile.

Current release validation is App-root first. Root wrappers prepare App-owned
payloads and call active-shell build/release scripts; `validate:app-root-boundary`
guards that the App root remains the product wrapper and shell build outputs
stay under the active shell checkout. Use `validate:gui-shell` when a change
must prove active-shell validation and GUI compile evidence through the App
wrapper path.

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
module path source explanation、stable/nightly release gates 和 OPL Flow
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
`contracts/app-shell-candidates.json` declares `agui-codex` as an explicit
candidate, `contracts/shell-adapters/agui-codex.json` owns its selectable adapter
contract, and `docs/agui-codex-candidate-verification.md` owns candidate command
order, smoke expectations, minimum acceptance, and evidence lifecycle. Default
stable/nightly packaging continues to resolve `contracts/app-shell-adapter.json`
and the active `aionui` shell until an explicit release-owner decision changes
that contract.

The current candidate read is technical verification only: `agui-codex` targets
the Codex App-like OPL chat-first inventory described by the GUI definition
stack and `docs/app-gui-feature-inventory.md`; CopilotKit is the visible
UI/runtime layer, AG-UI is the internal event/protocol boundary, WebUI uses the
same candidate bridge shape, and PilotDeck remains reference-only information
organization input with no source, runtime, provider, memory, router, or
WorkSpace authority transfer.

Candidate adoption and evidence currentness stay outside this status file.
Candidate smoke, manifests, package evidence, shell roadmaps, and upstream GUI
defaults prove only technical verification unless App-owned contracts,
validators, release-boundary tests, release artifacts, and release-owner
decision update the default adapter. `agui-codex` is not the default release
shell, not App product authority, and not domain-ready, clean-VM-ready,
Full-release-ready, App-production-ready, or family-production-ready evidence.

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

Dated local smoke, candidate, current-source release, and migration notes are
compressed under `docs/history/process/`, with no-resurrection rules in
`docs/history/process/retired-surface-provenance.md`. New proof-by-proof records
belong in release artifacts, candidate manifests, CI logs, or precise
history/provenance docs; durable rules fold back into contracts, core docs,
release/testing docs, or the active gap plan.

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
bun run i18n:types
bun run test
node --experimental-strip-types scripts/prepare-release-assets.ts build-artifacts release-assets
node --experimental-strip-types scripts/validate-release.ts release-assets
```

Page-state and first-run expectations are declared in
`contracts/app-page-state-matrix.json` and
`contracts/app-first-run-test-matrix.json`.
Product defaults are declared in `contracts/app-product-profile.json`.

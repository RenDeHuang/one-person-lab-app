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

The active shell currently tracks AionUI upstream through
`83eb8bda02af44df9795a10f32fa938dd62b628c` while preserving the App-owned
product profile. That intake is recorded in `contracts/app-shell-adapter.json`;
the upstream code is implementation material, not product authority. The shell
also keeps Codex ACP tool-call output display aligned with native Codex
behavior by preserving newline-bearing `raw_output` / `stdout` / `stderr`
content in the conversation view.

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
pins the independent agent installation path: MAS/MAG/RCA must register through
Codex plugin registry targets while keeping direct skill compatibility and the
same action/stage metadata; OMA stays on the OPL-generated skill surface. The
machine gate is `npm run validate:agent-installation`, with optional
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

First-run progress is also contract-backed. The shared progress model is
produced by `opl system initialize --json` at
`system_initialize.setup_flow`; App, CLI one-shot install, and Docker/WebUI
surfaces must derive phase, Core progress, Full readiness progress, background
maintenance counts, blockers, and next visible steps from that model instead of
maintaining separate installer-specific progress truth. The active shell renders
this model only and does not own private first-run progress state.

Runtime progress display is contract-backed separately from first-run progress.
The Runtime page is a project-progress surface first: it consumes
`app_state.operator.workbench.task_drilldowns` to show which projects are
running, their current state and stage, projected next step, blockers, and
human-readable progress delta labels. Operator summary, safe actions, evidence
refs, and full detail are secondary diagnostics. The same projection still
classifies `deliverable_progress_delta` separately from
`platform_repair_delta`. Platform repair is shown as infrastructure repair and
cannot be presented as substantive deliverable, paper, manuscript, or
submission progress.

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
model. Full assets are GitHub Release first-install downloads and do not enter
updater metadata. GitHub Release uploads, standard DMG, Full DMG, GUI smoke,
and user tutorials are all App-owned. The Framework repo is only a
runtime/CLI/contracts payload source for Full DMG and a machine-interface
provider for the App.

Current release validation is App-root first: root wrappers call the active shell
build/release scripts, then the produced standard package can replace
`/Applications/One Person Lab.app` for a real local GUI startup smoke.
`hygiene:fallow` is only the App-root wrapper hygiene gate and does not replace
active shell validation or GUI compile evidence. Use `npm run
validate:gui-shell` when the change must prove the active shell still validates
and compiles through the App wrapper path.

Runtime page evidence path is declared in
`contracts/app-page-state-matrix.json`: the active shell loads the summary read
model through `opl app state --profile fast --json`, refreshes through the same
fast App state surface, keeps `opl app state --profile full --json` for explicit
full-state diagnostic or release evidence, lazy-loads full detail through `opl
runtime app-operator-drilldown --detail full --json`, and presents a
multi-task runtime base view with action queue refs, a vertical dynamic map,
single-task drilldown, and MAS paper lens refs. The page stays summary-first,
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
beginner-facing purpose entries: 科研, 基金, and PPT. Those entries route to
MAS, MAG, and RCA respectively, and the selected entry is presented as a compact
`@` purpose tag instead of a full agent-title hero. The home input does not
expose Aion CLI, Claude Code, backend switching, model override, or permission
mode controls; ordinary Codex conversations must not reintroduce those selector
surfaces after send. Built-in MAS/MAG/RCA sends must persist a route receipt
showing `builtin_capability`, `codex_cli`, the assistant id, the assistant short
name, and `opl_app_home`, so the route is observable beyond the visible badge.
It shows only a compact automatic Codex model status label; the precise model
and reasoning effort belong in technical details or a connected state surface.
Each default purpose entry also owns an assistant-scoped skill profile: MAS
requires `mas`, MAG requires `mag`, and RCA requires `rca`; optional companion
skills are selected from that assistant profile after passing the App packaged
skill set boundary。Home surface 可以在 input 附近显示紧凑 continue-work
activity center，用于 needs-attention、active、recent project refs，但必须保持
refs-only，不能变成 full workbench。Settings 的 General/Access/Agents &
Capabilities/Local Environment/Appearance/Advanced/About & Updates surfaces、
module path source explanation、stable/nightly release gates 和 OPL Agent Codex
context 都是 App-owned requirements。Upstream overview、runtime、system、model、
agent、assistants、skills-hub、tools、display、webui、pet routes redirect 到
App-owned pages，不是 ordinary user tabs。`/guid` quick shortcut 打开 Access，
而不是 WebUI-branded entry。OPL Meta Agent 仍是 App/CLI-managed ecosystem
module，不是 default home assistant entry。MDS 不是 default GUI module，只保留
historical 或 explicit-reference。`contracts/app-shell-adapter.json` 要求 active
shell 实现该 App contract，并保持 upstream AionUI 只是 implementation material，
不是 product authority。Home activity center item fields、forbidden display
fields 和 Settings page sections now have matching page-state matrix entries,
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
AG-UI internal event mapping, `opl app state/action` consumption,
first-run/page-state mapping, shared Electron/WebUI renderer, Web transport
bridge, WebUI smoke, explicit `.app` packaging with `Contents/Info.plist` and a
`Contents/MacOS` executable, and release isolation without changing the active
release shell.

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
npm run validate:candidate
npm run build:renderer
npm run smoke:webui
npx electron . --ui-smoke-test
'./out/One Person Lab AG-UI Codex Candidate.app/Contents/MacOS/One Person Lab AG-UI Codex Candidate' --ui-smoke-test
```

Minimum candidate acceptance is App-root AionUI release guard still passing,
candidate registry validation, explicit adapter selection only, App-owned
generated product profile consumption, source renderer build, shared
Electron/WebUI renderer proof, WebUI smoke, PilotDeck-informed reference-only
information organization proof, source and packaged visible-pixel UI smoke against a real Codex
app-server `OK` turn, a launchable `.app` bundle with `Contents/Info.plist` and
`Contents/MacOS`, page-state/first-run matrix mapping, runtime summary plus
explicit full drilldown, safe App action dry-run receipts, and no AG-UI/debug
protocol copy on the ordinary chat surface. Default release promotion is still
an explicit release decision: stable/nightly packaging continues to use AionUI
until `contracts/app-shell-adapter.json` is deliberately changed.

On 2026-05-30, the `agui-codex` candidate shell was corrected back to the
Codex App-style chat-first target. The ordinary home opens on the conversation
canvas with `without-rail` and `without-inspector`; the workspace/session rail
and right-side inspector remain collapsed until the user explicitly opens them.
The candidate contract and validation now require
`default_context_collapsed_chat_first_home` in addition to shared
Electron/WebUI renderer evidence, Web transport bridge evidence, WebUI smoke,
source UI smoke, packaged UI smoke, page-state/first-run mapping, runtime
summary/full-drilldown evidence, safe App action dry-run receipts, and real
Codex app-server `OK` turn evidence. PilotDeck remains reference-only
information organization for optional rail/inspector surfaces, not a first
screen workbench template. This is candidate evidence only; the default release
shell remains AionUI until `contracts/app-shell-adapter.json` is deliberately
promoted.

2026-05-22 App release evidence collection now has an App-owned CLI wrapper:
`scripts/collect-release-evidence.ts` fills `app-state-summary.json`,
`app-state-full.json`, `drilldown-full.json`, `action-dry-run-result.json`, and,
when explicitly requested, `action-execute-result.json` by calling the live OPL
CLI. It then writes `evidence-manifest.json` through the existing manifest
writer and immediately validates the bundle in `--allow-missing-evidence`
mode. It can also attach externally produced contracted artifact files with
`--artifact <artifact_id>=<source_path>`. On 2026-05-31 the same collector was
extended with `--evidence-source-dir <dir>` so standard packaged/VM/remote smoke
directories can be imported without hand-mapping every contracted artifact;
explicit `--artifact` mappings still take precedence. Imported files are copied
into the contract path and then validated by the same bundle validator. The
collector also accepts `--typed-blocker <artifact_id>=<source_path>` for a
producer run that actually happened but could not yield the required artifact.
Typed blockers are copied under `typed-blockers/`, must name owner, blocker
kind, reason, evidence refs, and next action, and keep
`packaged_app_evidence=false`. Screenshot, clean first-run VM, settings smoke,
packaged assistant route smoke, and remote Release verification artifacts remain
required release evidence and stay marked `missing` or `blocked` until real
artifacts exist; malformed OPL JSON, malformed attached evidence, malformed
typed blockers, or contract drift still fails the collector. The collector is a
user-path evidence bridge, not a packaged App release closeout.

2026-05-28 OPL App/operator summary currently reads the selected App
release/user-path cohort as refs-observed: five release/user-path evidence gates,
zero open gates, six verified ledger receipt refs, and
`app_release_user_path_production_user_path_ready=true`. That readout means the
current cohort has body-free release package, screenshot/reload/user-path,
provider linkage, and long-operator refs available to the App/operator surface.
It remains a refs-only user-path projection from OPL runtime evidence; it is not
an App release-ready claim, a domain readiness claim, or a family production
readiness claim. Future release cohorts must still provide real artifacts or
explicit missing evidence entries through the release evidence bundle and OPL
ledger before being treated as observed.

2026-05-29 packaged GUI assistant route evidence remains open for the local
26.5.28 Full DMG. The smoke harness now writes a fail-closed
`assistant-route-smoke-summary.json` when MAS/MAG/RCA route controls do not meet
the App contract. The current local run at
`/tmp/opl-packaged-route-smoke-20260529063512-fail-summary/assistant-route-smoke-summary.json`
failed on MAS because the installed App exposed no `preset-pill-mas/mag/rca`
purpose-entry controls and still showed the ordinary permission selector. This
is a release-evidence blocker for the packaged Codex path until a DMG/App smoke
produces passed MAS/MAG/RCA route receipts with hidden ordinary selectors.

Later on 2026-05-29, the current-source shell App bundle and current-source DMG
both produced passed packaged GUI assistant route smoke evidence after the
receipt verifier was corrected to read the backend REST `{success,data}`
envelope. The evidence artifacts are
`/tmp/opl-current-build-route-smoke-20260529065519/assistant-route-smoke-summary.json`
for the `.app` bundle and
`/tmp/opl-current-dmg-route-smoke-20260529065705/assistant-route-smoke-summary.json`
for the DMG installed into `/tmp/opl-current-dmg-install-20260529065705`.
Each artifact records passed MAS/MAG/RCA selection, hidden ordinary selectors,
and persisted Codex ACP route receipts with `route_kind=builtin_capability`,
`executor=codex_cli`, `backend=codex`, and `source=opl_app_home`. This is
current-source evidence only; it does not change the published 26.5.28 Full DMG
release evidence. The App release evidence contract now treats
`artifacts/assistant-route-smoke-summary.json` and
`artifacts/assistant-route-smoke/{mas,mag,rca}.png` as required packaged GUI
Codex-path artifacts, so a future release cohort cannot claim packaged App
evidence from the route summary alone. The validator also applies an
`image_evidence_policy` to all release screenshot artifacts: minimum
`640x360px`, at least `4096` bytes, no placeholder screenshots, and readable
PNG/JPEG/WebP dimensions. This keeps real packaged UI evidence distinct from
contract-only or 1x1 image fixtures.

On 2026-05-31 the current-source DMG route smoke artifacts were assembled into
`/Users/gaofeng/workspace/opl-release-evidence/app-current-source-dmg-route-smoke-20260531/evidence-manifest.json`
through `collect-release-evidence.ts`. The same cohort now has a complete
GitHub `v26.5.31` draft release and validates as `passed` with
`packaged_app_evidence=true`: 15 contracted artifacts are present, with zero
missing evidence and zero blocked evidence. The bundle includes live OPL App
state, full drilldown, action dry-run and execute JSON, Runtime screenshot,
clean standard first-run VM summary, packaged first-run smoke, MAS/MAG/RCA
assistant-route summary and screenshots, Full first-install screenshot and VM
summary, Runtime action screenshot, and remote release verification.

The same-cohort standard VM run at
`/tmp/opl-current-standard-vm-smoke-20260531-current-source-archive-1/tart-smoke-summary.json`
passed Core first-run, Settings navigation, MAS/MAG/RCA route smoke, and
Runtime action dry-run evidence. The Full first-install DMG at
`/Users/gaofeng/workspace/opl-release-evidence/app-current-source-dmg-route-smoke-20260531/full-package/One-Person-Lab-Full-26.5.31-mac-arm64.dmg`
was verified by a real Tart Full clean-VM run under
`full-vm-smoke/tart-smoke-summary.json` with Codex wizard seen and submitted,
Core ready before `/guid`, Settings navigation passed, MAS/MAG/RCA route smoke
passed, and Runtime action evidence passed. Its imported
`screenshots/full.png` is `1536x912`, `98746` bytes, SHA-256
`7ce5bd8c2abe8245f52d1ab36fe99849818eae02e7203ea288758650715fee15`; Runtime
action evidence is present at `screenshots/action.png` with
`runtime-action-evidence.json` recording `dryRunCompleted=true`.

The `v26.5.31` GitHub release remains a draft and is not stable/latest. Remote
verification downloaded and verified all 11 standard and Full assets:
standard DMG, standard ZIP, two blockmaps, `latest-mac.yml`,
`latest-arm64-mac.yml`, Full DMG, `full-package-manifest.json`,
`runtime-cache-events.json`, `README-Full-First-Install.txt`, and
`SHA256SUMS.txt`. `remote-release-verification.json` reports `status=passed`,
`verified_asset_count=11`, Full DMG size `508995657` bytes, runtime
uncompressed bytes `632065216`, and passed Full first-install budget. This
closes the current-source draft release evidence tail only; stable publication,
updater/latest promotion, App release-ready, domain readiness, and family
production readiness remain separate owner decisions and evidence gates.

Also on 2026-05-31, the active AionUI shell smoke producer was extended so
future Full clean first-run CDP runs write the beginner-first screenshot into
`screenshots/full.png`, and Runtime page dry-run action evidence writes
`screenshots/action.png` plus `runtime-action-evidence.json`. It now also keeps
Settings/page evidence and MAS/MAG/RCA assistant-route evidence independent from
the Runtime action screenshot lane: when no safe App action route is exposed, it
writes `runtime-action-evidence-blocker.json` and still lets the remaining
packaged GUI smoke run. The Tart host wrapper writes a structured
`tart-smoke-summary.json` on guest-smoke failure after artifacts are copied, so
future bundles get a precise failure stage instead of an unstructured missing VM
summary.

2026-05-15 migration note: this local checkout is the clean App repo. It has no
tracked `shells/aionui` source, and local `shells/aionui` points to
`/Users/gaofeng/workspace/opl-aion-shell`. Remote migration keeps
`gaofeng21cn/opl-aion-shell` as the history-rich shell repo and uses
`gaofeng21cn/one-person-lab-app` as the clean App product repo.

2026-05-17 release note: the stable release channel is narrowed to macOS arm64
standard update assets plus separate macOS arm64 Full first-install assets.
Docker/WebUI compatibility remains a validation lane, not a desktop release
asset lane.

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

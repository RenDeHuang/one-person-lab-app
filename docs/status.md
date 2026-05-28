# One Person Lab App Status

Owner: `one-person-lab-app`
Purpose: `app_status`
State: `active`
Machine boundary: Human-readable status. Use `contracts/` and release/test
artifacts for machine decisions.

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
the App profile explicitly whitelists them.

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
model through `opl app state --profile fast --json`, refreshes through
`opl app state --profile full --json`, lazy-loads full detail through
`opl runtime app-operator-drilldown --detail full --json`, and presents a
multi-task runtime base view with action queue refs, a vertical dynamic map,
single-task drilldown, and MAS paper lens refs. The page stays summary-first,
loads full detail only on demand, uses a 5-10 second lightweight polling
fallback when push projection is unavailable, and exposes only refs-only
`opl app action execute --action <id> [--payload json] [--dry-run] --json`
controls. Execution refreshes the App state projection so receipt/count fields
stay framework-owned; MAS/MAG/RCA verdicts and artifact authority remain
domain-owned refs.

Current GUI product truth is declared in
`contracts/app-gui-product-contract.json`: the default executor experience is
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
skills are selected from that assistant profile, and AionUI-specific internal
skills stay out of the home skill menu. Settings System/Runtime/About/Update/Theme
surfaces, module path source explanation, stable/nightly release gates, and OPL
Agent Codex context are App-owned requirements. Ordinary Settings navigation is
also App-owned: Overview, Runtime, Capabilities, Access, Appearance, System, and
About are the visible tabs. Upstream model, agent, assistants, skills-hub,
tools, display, webui, and pet routes redirect to those App-owned pages and are
not ordinary user tabs. The `/guid` quick shortcut opens Access rather than a
WebUI-branded entry. OPL Meta Agent remains an App/CLI-managed ecosystem module
rather than a default home assistant entry. MDS is not a default GUI module and
remains historical or explicit-reference only. `contracts/app-shell-adapter.json`
requires the active shell to implement that App contract and keeps upstream
AionUI as implementation material rather than product authority.

2026-05-22 App release evidence collection now has an App-owned CLI wrapper:
`scripts/collect-release-evidence.ts` fills `app-state-summary.json`,
`app-state-full.json`, `drilldown-full.json`, `action-dry-run-result.json`, and,
when explicitly requested, `action-execute-result.json` by calling the live OPL
CLI. It then writes `evidence-manifest.json` through the existing manifest
writer. Screenshot, clean first-run VM, settings smoke, and remote Release
verification artifacts remain required release evidence and stay marked
`missing` until real artifacts exist; the collector is a user-path evidence
bridge, not a packaged App release closeout.

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
bun run i18n:types
bun run test
node --experimental-strip-types scripts/prepare-release-assets.ts build-artifacts release-assets
node --experimental-strip-types scripts/validate-release.ts release-assets
```

Page-state and first-run expectations are declared in
`contracts/app-page-state-matrix.json` and
`contracts/app-first-run-test-matrix.json`.
Product defaults are declared in `contracts/app-product-profile.json`.

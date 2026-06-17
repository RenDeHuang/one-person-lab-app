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

The active shell upstream intake ref is recorded in
`contracts/app-shell-adapter.json#shell_source.upstream_ref` while preserving
the App-owned product profile. That contract is the active shell source of
truth; the upstream code is implementation material, not product authority. The
shell also keeps Codex ACP tool-call
output display aligned with native Codex behavior by preserving newline-bearing
`raw_output` / `stdout` / `stderr` content in the conversation view. The updater
now selects the macOS ZIP for in-app updates, uses an App-managed local
authorization installer to replace the local App bundle, clears quarantine,
records diagnostics, and relaunches the updated App.

Active shell upgrade hardening is App-owned and machine-checked. The adapter and
GUI contracts own upstream feature classification, ordinary capability filtering,
Team-surface rejection policy, and required implementation probes; this status
file keeps only the current boundary. Use
`contracts/app-shell-adapter.json`, `contracts/app-gui-product-contract.json`,
`contracts/app-product-profile.json`, `scripts/validate-active-shell.ts`, and
the focused release-boundary GUI tests for executable Team and MCP-filtering
truth.

GUI interaction status is contract-backed as a composer-first Codex canvas with
purpose entries, App-owned model status, collapsed contextual surfaces, and
secondary inspector/detail views. The element audit lives in
`docs/app-gui-element-audit.md`; the target interaction definition lives in
`docs/app-ideal-gui-interaction-spec.md`; machine acceptance is enforced by
`contracts/app-gui-product-contract.json`,
`contracts/app-page-state-matrix.json`,
`contracts/app-product-profile.json`, `scripts/validate-active-shell.ts`, and
focused release-boundary tests. The active shell keeps runtime truth, domain
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

The upstream AionUI Team surface is disabled for ordinary OPL App use. The
current owner for the exact redirect, sidebar, deep-link, Team MCP scrub,
agent-switching, and IPC mutation gates is the App GUI / shell adapter contract
set plus active-shell validation. This status file does not freeze the probe
list, test names, or historical snapshot examples.

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

Release and user-path evidence remains cohort-bound. Evidence manifests,
release-owner records, validators, release artifacts, and workflow outputs own
the artifact classification fields, package-evidence flags, owner-verdict refs,
typed-blocker refs, and install-evidence refs for each cohort. Pending,
typed-blocker, install-evidence, and human-gate refs do not authorize
release-ready, stable/latest promotion, domain readiness, or OPL family
production readiness.

App release-owner receipt records live in `docs/release/records/` and are
validated through `npm run release:owner-candidate-record:verify`. A recorded
same-cohort owner receipt closes only the App release-owner verdict path for
that cohort; it does not claim OPL family production readiness, domain
readiness, or MAS/MAG/RCA quality/export verdicts.

Detailed run/timing/asset profiles are historical provenance under
`docs/history/process/`. Current release status stays on release owner records,
release artifacts, contracts, workflows, validators, CI outputs, and the release
guide rather than dated status prose.

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

Current GUI product truth has a compact owner stack: human-readable intent lives
in `docs/app-ideal-gui-interaction-spec.md`,
`docs/codex-to-opl-app-delta.md`, and `docs/app-gui-feature-inventory.md`;
machine-readable GUI truth lives in
`contracts/app-gui-product-contract.json`,
`contracts/app-page-state-matrix.json`, `contracts/app-product-profile.json`,
and `contracts/app-shell-adapter.json`. These owners define the ordinary Codex
CLI path, purpose entries, route receipts, model-status surface, Settings
partition, forbidden selectors, secondary runtime refs, OMA/MDS visibility, and
legacy-route redirects. This status file does not duplicate field-level GUI
requirements, literal labels, forbidden-display lists, or test matrices.

Experimental shell candidate work is separated from the active release adapter.
`contracts/app-shell-candidates.json` owns the candidate registry,
`contracts/shell-adapters/agui-codex.json` and
`contracts/shell-adapters/hermes-codex.json` own selectable adapters, and
candidate-specific docs own human runbooks and target plans:
`docs/agui-codex-candidate-verification.md`,
`docs/opl-hermes-gui-adaptation-plan.md`, and
`docs/opl-hermes-first-run-flow.md`. Default stable/nightly packaging continues
to resolve `contracts/app-shell-adapter.json` and the active `aionui` shell
until an explicit release-owner decision changes that contract.

The latest local candidate read after syncing the App, OPL Framework, AionUI
shell, and Hermes shell repos to their GitHub `main` branches is:
`hermes-codex` validates at the App contract/registry level with no candidate
blockers, while remaining an explicit technical verification candidate. The
Hermes shell's bootstrap/gateway focused tests pass, but package/runtime/visual
acceptance is not complete: shell `npm run validate:candidate` currently needs
the `magick` binary for icon alpha validation, and a focused model-settings UI
test still fails on the auxiliary "use main model" rows. Therefore the current
state is contract-valid and partially source-tested, not packaged-App usable,
release-ready, active-shell-adopted, or production-ready.

The current candidate read is technical verification only. Candidate smoke,
manifests, package evidence, shell roadmaps, upstream GUI defaults, and external
reference material do not become App product truth, active-shell adoption, release
readiness, clean-VM readiness, domain readiness, or family production readiness.

Candidate adoption and evidence currentness stay outside this status file.
Adoption requires deliberate App-owned contract changes plus validators,
release-boundary tests, release artifacts, and release-owner decision for the
default adapter.

Release evidence collection is App-owned but cohort-bound. The collector,
manifest validator, release artifacts, release owner records, and release
workflow outputs own the artifact classes and evidence fields for each cohort.
This status file keeps only the authority boundary: current-source or local smoke
evidence does not update a published cohort, does not promote stable/latest, and
does not prove MAS/MAG/RCA domain readiness or OPL family production readiness.

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

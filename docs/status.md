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

Live Evidence deferred / functional structure first is the current App
development rule. Normal App work should first close functional and structural
gaps: App-owned contracts, active-shell sync, AionUI mainline behavior,
`opl-native-workbench` foreground-alternative boundaries, page-state validation, first-run policy,
Settings / Storage / route receipts, and no-authority runtime/domain guards.
Release cohorts, clean-VM proof, packaged GUI smoke, same-cohort user-path
evidence, real user-directory E2E, owner acceptance, and production-ready
claims remain release/lifecycle evidence lanes. They must not block independent
contract/shell cleanup, and contract validation or shell tests must not be
promoted into release-ready or family production-ready proof.

## Current State

- GitHub repo: `gaofeng21cn/one-person-lab-app`.
- App product repo history policy: clean App-owned history only.
- Active shell: `aionui`.
- Active shell root: `shells/aionui` as an external checkout.
- Active shell source repo: `gaofeng21cn/opl-aion-shell`.
- Foreground alternative GUI candidate: `opl-native-workbench`, an independent shell checkout governed by the App candidate registry and adapter contract.
- Prior foreground alternative reference: `hermes-codex`, based on Hermes Desktop.
- Archived technical GUI proof: `agui-codex`; do not update or improve it unless AGUI is explicitly requested.
- App product profile: `contracts/app-product-profile.json`.
- Framework dependency: `gaofeng21cn/one-person-lab`.
- Local App repo path on the maintainer Mac:
  `/Users/gaofeng/workspace/one-person-lab-app`.
- Local shell repo path on the maintainer Mac:
  `/Users/gaofeng/workspace/opl-aion-shell`.

The App repo must not merge AionUI history into its default branch. AionUI
upstream-following work stays in `opl-aion-shell`; App product release and user
docs stay in `one-person-lab-app`.

Current GUI development follows one mainline and one foreground alternative:
AionUI is the stable App GUI mainline, and `opl-native-workbench` is the
foreground alternative candidate once the candidate registry selects it. Hermes
Desktop / `hermes-codex` is retained as the prior foreground alternative
reference, not the default foreground scope. The previous AG-UI/CopilotKit work
remains useful as technical verification provenance and explicit replay
material, but it is not a default candidate lane and should not receive routine
updates or polish work. Treat
`candidate` in AGUI filenames, manifests, scripts, and adapter contracts as a
backward-compatible replay label only; it does not reopen AGUI as a foreground
candidate or default validation target. The App-owned convergence aggregate is
`npm run validate:shell-convergence`: it reuses the active-shell and
shell-candidate validators as structure evidence only. It cannot claim App release readiness,
active-shell adoption, packaged GUI acceptance, production readiness, live user
path evidence, or Live Evidence.

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
`docs/product/gui/element-audit.md`; the target interaction definition lives in
`docs/product/gui/ideal-interaction-spec.md`; machine acceptance is enforced by
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
`~/.codex/skills/{med-autoscience,med-autogrant,redcube-ai}`. OPL Meta Agent remains an OPL-generated Codex
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
surface. Managed agent-pack distribution now fails closed when the GHCR
`latest` package pointer or its resolved digest is unavailable and uses bundled
Full runtime modules before any explicit Developer Profile checkout source.
`latest` is the only ordinary user channel; immutable version tags plus digests
are the installed truth. The machine gate is
`npm run validate:agent-installation`, with optional
`--agent-root <id>=<path>` checks for real plugin roots and
`--codex-skills-root <path>` checks that `med-autoscience` / `med-autogrant` / `redcube-ai` are not also installed as
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
`contracts/app-release-channel.json`, `docs/delivery/release/README.md`, release
workflows, validators, and release artifacts.

Release efficiency now has an explicit target architecture:
`build-once/promote-many`. A frozen App/Shell/Framework cohort should build and
qualify artifacts once, then use the release cohort manifest as the retry and
promote entrypoint. Same-cohort recovery should rerun the failed gate, VM
diagnostic, or promote path instead of restarting the whole release train.
Current target timing is standard 10-20 minutes, Full 35-50 minutes,
same-cohort retry 3-15 minutes, and promote under 5 minutes. The current RCA
classification treats delay as mostly workflow design and retry-shape debt
with a smaller implementation-bug share; status summaries should therefore
name the failed gate and owner route instead of defaulting to full reruns.
Release publish/promote must consume prepared release notes and must not call
AI to generate notes on the critical path. Full runtime bundle preparation is
owned by OPL Framework and consumed by the App through manifest/lock/readback
refs; VM smoke qualifies the exact release artifact for the same cohort.
Standard Stable readiness is now the default critical path: standard publish,
standard remote verification, the standard VM gate, and one-shot installer
smoke. Full, Docker/WebUI, and Homebrew keep running as same-cohort add-on
gates/assets whose status is recorded in `release-addon-readiness-summary`
without delaying the Standard readiness record.

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

App release-owner receipt records live in `docs/delivery/release/records/` and are
validated through `npm run release:owner-candidate-record:verify`. A recorded
same-cohort owner receipt closes only the App release-owner verdict path for
that cohort; it does not claim OPL family production readiness, domain
readiness, or MAS/MAG/RCA quality/export verdicts.

Detailed run/timing/asset profiles are historical provenance under
`docs/history/process/`. Current release status stays on release owner records,
release artifacts, contracts, workflows, validators, CI outputs, and the release
guide rather than dated status prose.

Current cleanup state: release helper JSON/file access is consolidated under
`scripts/release-json-helpers.ts` and `scripts/release-file-helpers.ts`,
readiness-summary gate construction uses shared helper builders instead of
inline duplicate blocks, release readiness JSON reads use the shared JSON file
helper, Settings control-plane redirect expectations derive from the App
contract constants, page-state Settings validation no longer repeats route
identity checks already covered by the Settings control-plane validator, and GUI
contract validation derives hidden legacy tabs and Developer Profile axis
consistency from the GUI contract instead of mirrored constants. Agent package
and shortcut ids used by the App product profile, active-shell product profile
validator, and GUI home validator share the existing App product profile helper
constants instead of maintaining three local copies; professional-agent package
policy validation and the OPL Flow intelligence enhancement mode assertion are
also shared instead of repeated across product-profile and active-shell
validators. Release size scripts share byte-size formatting through
`scripts/release-size-reporting.ts` instead of local `formatBytes` copies.
Product-profile package entry lookup is private to its validator module, Full
runtime trust/prune scripts use Node's native argument parser instead of local
argv walkers, and active-shell boundary validators reuse the App shell adapter's
boundary types and constants instead of copying the same adoption gates and
state-surface expectations. Shell replacement gate validation is now shared
through the App shell adapter helper while preserving the Hermes candidate
chain as explicit-candidate validation, and Full first-install filesystem
copying reuses local directory traversal and portable-symlink helpers instead
of repeating the same recurse-and-copy blocks. `npm run hygiene:fallow -- --format json --summary`
is the production hygiene check for unused files/exports and duplicate exports.
This is code-health and validation-structure evidence only; it is not a
release-ready, currentness, packaged-App, clean-VM, owner-acceptance, or Live
Evidence claim.

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
in `docs/product/gui/ideal-interaction-spec.md`,
`docs/product/gui/codex-to-opl-app-delta.md`, and `docs/product/gui/feature-inventory.md`;
machine-readable GUI truth lives in
`contracts/app-gui-product-contract.json`,
`contracts/app-page-state-matrix.json`, `contracts/app-product-profile.json`,
and `contracts/app-shell-adapter.json`. These owners define the ordinary Codex
CLI path, purpose entries, route receipts, model-status surface, Settings
partition, forbidden selectors, secondary runtime refs, OMA/MDS visibility, and
legacy-route redirects. This status file does not duplicate field-level GUI
requirements, literal labels, forbidden-display lists, or test matrices.

Shell alternative work is separated from the active release adapter.
`contracts/app-shell-candidates.json` owns the registry,
`contracts/shell-adapters/opl-native-workbench.json` owns the foreground
alternative adapter when selected, and
`contracts/shell-adapters/agui-codex.json` remains explicit replay only.
`npm run validate:shell-convergence` is the thin aggregate gate for that policy:
it runs the active-shell quick guard and shell-candidate registry validator
without maintaining a second JSON readback surface. `docs/product/gui/opl-native-workbench-plan.md`
owns the active candidate plan. Hermes docs remain prior-candidate reference:
`docs/product/shell-alternatives/hermes-gui-adaptation-plan.md` and
`docs/product/shell-alternatives/hermes-first-run-flow.md`.
`docs/history/shell-candidates/agui-codex-candidate-verification.md` is read only
for explicit AGUI replay or historical audit. Default stable/nightly packaging
continues to resolve `contracts/app-shell-adapter.json` and the active `aionui`
shell until an explicit release-owner decision changes that contract.

The `opl-native-workbench` route is candidate-structure and non-live product
surface first: candidate registration, adapter contract, independent external
checkout, state/action bridge, basic UI modules, artifact preview tabs,
provenance drawer, starter forms, confirmation/interview cards, desktop/WebUI
same renderer, source visual smoke, package manifest when claimed, docs/runbook,
then later live evidence. K-Dense, OpenClaudeScience / Claude Science, and AGUI
lessons are intake material only: delivery experience, project sandbox,
file/preview/result delivery, structured forms, shared renderer, and
task/provenance framing can be adopted or adapted; external runtime/agent
authority, Pi/DeepAgents/LangGraph-like runtimes, provider/backend marketplaces,
and domain truth ownership are watch-only or rejected.

The closeable current slice is the non-live candidate product surface. It does
not include Live Evidence, packaged GUI acceptance, clean VM proof,
same-cohort user-path evidence, owner acceptance, active-shell adoption, or
release-ready proof. Candidate source/WebUI validation, source visual smoke, and
candidate package evidence must stay tied to the exact candidate cohort before
any stronger technical claim is made.

The current candidate read is technical verification only. Candidate smoke,
manifests, package evidence, shell roadmaps, upstream GUI defaults, and external
reference material do not become App product truth, active-shell adoption, release
readiness, domain readiness, or family production readiness.

Candidate adoption and evidence currentness stay outside this status file.
Adoption requires deliberate App-owned contract changes plus validators,
release-boundary tests, release artifacts, and release-owner decision for the
default adapter.

Release evidence collection is App-owned but cohort-bound. The collector,
manifest validator, release artifacts, release owner records, and release
workflow outputs own the artifact classes and evidence fields for each cohort.
This status file keeps only the authority boundary: current-source or local smoke
evidence does not update a published cohort, does not promote stable/latest, and
does not prove MAS/MAG/RCA/BookForge domain readiness or OPL family production readiness.

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

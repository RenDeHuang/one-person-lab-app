# One Person Lab App Architecture

Owner: `one-person-lab-app`
Purpose: `app_architecture_boundary`
State: `active_truth`
Machine boundary: Human-readable architecture note. Machine-readable truth lives in `contracts/`, source, release artifacts, updater metadata, and test results.

The App product layer is a consumer of the OPL Framework and domain agents:

```text
One Person Lab App
  -> App product contracts and release wrappers
  -> active shell checkout
  -> OPL Framework CLI JSON / contracts / provider receipts
  -> domain-owned projections from MAS, MAG, RCA, OMA, and future agents
```

The App owns desktop packaging, update flow, first-run product behavior, release evidence collection, user guides, screenshots, GUI product truth, page-state tests, and stable/nightly release gates. OPL Framework owns stage runtime, provider management, queue/attempt ledger, generated surfaces, action execution, runtime read models, `opl app state`, and `opl app action` producers. Domain agents own their own truth, quality/export verdicts, memory body, artifact body, owner receipts, and typed blockers.

GUI 产品定义刻意分层。`docs/app-ideal-gui-interaction-spec.md` 定义不绑定具体 shell 的目标交互：Codex App 形态、chat-first、次级 context 默认收起。`docs/codex-to-opl-app-delta.md` 定义 Codex baseline 之上的 OPL 专用增量：purpose routing、domain skill profiles、runtime bridge refs、installation policy、evidence 和 authority boundaries。`docs/app-gui-feature-inventory.md` 跟踪跨 shell 能力清单和参考模式。机器可读验收再进入 `contracts/`、page-state matrices、source、package manifests、smoke evidence 和 release gates。

`contracts/app-gui-product-contract.json` is the canonical App-owned GUI product contract. It covers the Codex CLI fixed executor experience, hidden home and ordinary-conversation backend/provider/permission selectors, an App-owned Codex model selector/status, purpose-first home entries for Research/MAS, Grant/MAG, and Presentation/RCA, assistant-scoped skill profiles for those entries, the required built-in assistant route receipt, the home prompt, App-owned ordinary Settings navigation for General, Access, Agents & Capabilities, Local Environment, Appearance, Advanced, and About & Updates, legacy upstream route redirects, first-launch `ready_to_launch` before `/guid`, module path source explanation, release stable/nightly gates, MDS retirement from default display, and the OPL Flow context shown in Settings. OMA remains available through explicit/settings surfaces, but it is not a default home entry. `contracts/app-install-exposure-policy.json` owns the App-facing install/exposure policy: `skill` is the public semantic ABI, Codex App plugins are distribution/capability bundles, and CLI/App/direct skill paths must converge on the same domain-owned action/stage metadata. `contracts/app-runtime-bridge.json` is the App-owned bridge contract that binds a replaceable shell adapter to OPL-owned CLI state/action/drilldown surfaces. `contracts/app-product-profile.json` carries desktop session defaults, visible companion skills, first-run Core readiness, Full readiness/background maintenance behavior, Settings presentation policy, legacy settings route redirects, install exposure refs, assistant skill profile data, route receipt policy, and generated shell profile data. `contracts/app-page-state-matrix.json` and `contracts/app-first-run-test-matrix.json` define page-state and first-run expectations.

Home entry ownership is split deliberately for GUI replacement. The App contract owns `home_purpose_entries` as the user-facing click targets and labels, while `default_assistants` are implementation targets for those entries. Shells render the purpose entries, route to the target assistant ids, and persist the App-owned route receipt fields for MAS/MAG/RCA. They do not decide which assistants are default, what labels they use, whether OMA appears on the home screen, or whether the route is exposed as a backend selector.

Assistant skill ownership is similarly App-owned. `assistant_skill_profiles` defines the required Codex skill that makes each home assistant do domain work: MAS requires `mas`, MAG requires `mag`, and RCA requires `rca`. `companion_payloads.default_packaged_codex_skill_ids` is the App-level default package whitelist: only skills in that list are default packaged and default visible, independent of whether a candidate originated in AionUI builtin assets, Skills Manager, a Codex local skill, or a plugin payload. `packaged_not_default_visible_codex_skill_ids` carries explicit-only packaged skills such as OMA. The ordinary Home composer and ordinary conversation loaded-capability display use the narrower `gui.ordinary_capability_selector_policy`: visible skills come only from MAS/MAG/RCA assistant profiles, visible MCP servers default to an empty App allowlist, and non-allowlisted AionUI implementation skills or MCP servers do not enter the ordinary UI or new conversation payload. Optional companion skills are visible only within the selected assistant's home skill menu after they pass that App-owned ordinary allowlist. `cron` can be packaged as a companion capability, but stays out of MAS/MAG/RCA assistant-scoped home skill menus because it is not part of those assistant profiles; AionUI-specific internal skills such as `aionui-skills`, `aionui-webui-setup`, and `skill-creator` stay out of ordinary App capability selection. The global skill hub remains a Settings/Capabilities surface, not the normal home input menu.

The home executor boundary is intentionally narrower than upstream AionUI. The App is a Codex CLI wrapper with built-in OPL assistants, not a general multi-backend agent launcher. Active shells may retain upstream AionUI agent/backend settings for development or diagnostics, but the App home path and ordinary Codex conversation path must not surface Aion CLI, Claude Code, backend switching, provider lists, or permission-mode choices as normal user controls. The visible model selector is App-owned and bounded by the product profile.

Settings boundary 也遵循同样拆分。普通 Settings navigation 是 General、Access、Agents & Capabilities、Local Environment、Appearance、Advanced、About & Updates。Overview、runtime、system、model、agent、assistants、skills-hub、tools、display、webui、pet 等 legacy upstream routes redirect 到 App-owned pages。Shell 仍可保留 diagnostic 或 redirected sub-content 的实现组件，但这些组件不定义普通 App navigation 或 product authority。

Installation exposure uses separate classes so user-facing defaults do not become install-time duplication. MAS/MAG/RCA are family domain plugin surfaces: they can be default App entries and Codex-visible plugin-packaged skills, but they must not be mirrored into duplicate bare `~/.codex/skills/{mas,mag,rca}` directories. OPL Meta Agent is an OPL-generated Codex surface and remains out of the default home assistant list. Homebrew is only the App cask transport; MAS/MAG/RCA/OMA agent packs are App/CLI-managed maintenance surfaces, not Homebrew formulae. App release packaging copies only the declared App packaged skill ids: default packaged skills plus explicit-only packaged skills. The default companion set includes Superpowers, cron, the OfficeCLI family, PDF, MinerU document extraction, and UI/UX helpers. AionUI builtin skills are candidate shell capabilities, not a parallel packaging policy. OPL Framework owns plugin registry refresh and generated surface production, while App release packaging owns only the user-facing policy and payload assembly.

The runtime page contract is display and routing only. Its default user view
consumes `opl app state --profile fast --json`; OPL Framework owns the
task/project projection, action execution, provider diagnostics and full
drilldown surfaces. App architecture keeps only the boundary: user-visible
running, active, queued and attention counts come from framework-projected user
task status, while provider activity, module diagnostics, repo/worktree
diagnostics, stale run ids and assistant cards stay diagnostic-only and cannot
become default running-task sources. Progress and artifact-native drilldown
mapping is owned by `contracts/app-runtime-bridge.json`,
`contracts/app-page-state-matrix.json`, `contracts/app-gui-product-contract.json`,
active-shell validation and release-boundary tests. The App displays refs-only
runtime projections and cannot read artifact bodies, own artifact authority, or
turn runtime refs into domain quality, export, readiness, App release or family
production claims.

The default Runtime page attention model is user-task-status first. The
ordinary view answers which tasks are explicitly running or advancing, which
projects/tasks are active or queued, what needs attention, and what the next
visible step is. Running or attention rows stay visible; queued, waiting,
stopped, parked, checkpointed, blocked, or otherwise non-running project lines
are collapsed by default with count/status/next-step summary. Project title,
stage, next owner, blockers, progress deltas, operator summary, safe actions,
refs-only evidence, provider activity, and full ledger detail are secondary
disclosures. A release/user-path evidence bundle can support the same App
release cohort and release-owner review, but it cannot by itself promote
stable/latest, prove domain readiness, or prove OPL family production readiness.

The upstream AionUI Team surface is not an OPL ordinary-user capability. It is
configured around shell-local team leaders and agents, so the active shell keeps
Team mode disabled, hides the Team sidebar entry, rejects Team deep links, and
redirects any compatible `/team/*` route back to the App-owned home path. Future
shells may implement their own collaboration features only through App-owned
contracts and page-state gates.

Active shell upgrades now carry an App-owned upstream intake ledger in
`contracts/app-shell-adapter.json#upstream_intake`. Each upstream feature must be
classified as `accepted`, `rejected`, `redirected`, or `requires_app_contract`
before it can ride a release. AionUI Team is classified `rejected` for ordinary
surfaces. The corresponding `implementation_probes` are required release gates:
Team mode disabled, `/team` route redirect, sidebar gate, Team-created redirect
no-op, ordinary conversation Team MCP snapshot scrub, agent switching without
Team MCP inheritance, Team deep-link rejection, and IPC bridge mutation
rejection before HTTP. Ordinary capability MCP filtering is executable data in
the GUI contract and product profile through `forbidden_mcp_matchers` and
`scrub_extra_keys`, not example text.

Live bridge conformance is intentionally opt-in. `validate-active-shell.ts
--quick` validates the App-owned bridge contract by default. When
`OPL_APP_LIVE_CONFORMANCE=1`, `OPL_APP_LIVE_OPL_ROOT` points at a local OPL
Framework checkout, and `OPL_APP_LIVE_ACTION_FIXTURE` names a safe action id,
the same validation runs `./bin/opl app state --profile fast --json`,
`./bin/opl app state --profile full --json`, and `./bin/opl app action execute
--action <fixture> --dry-run --json`. The live check only asserts JSON
availability, fast output below 500KB, and `opl_app_state.v1` schema/surface; it
does not import Framework runtime state or domain truth into the App repo.

The active shell is an external checkout and an implementation carrier. `contracts/app-shell-adapter.json` requires the shell to implement the App GUI contract and declares that upstream AionUI behavior is implementation material only, never App product authority. Root release and validation scripts prepare App-owned payloads and call shell build/test commands, but shell implementation changes belong in `gaofeng21cn/opl-aion-shell` unless the App contract or wrapper itself changes.

Future shell candidates are intentionally separated from the default release adapter while still remaining selectable for technical verification builds. `contracts/app-shell-candidates.json` declares experimental candidates such as `agui-codex` and `hermes-codex`, with alternate adapter contracts under `contracts/shell-adapters/`. The default `contracts/app-shell-adapter.json` continues to define the stable AionUI release shell. AG-UI remains a contract-heavy candidate route for App product-profile, page-state, first-run, WebUI, and `opl app state/action` mapping. Hermes is currently different: it is a minimal-adapter candidate based on `NousResearch/hermes-agent/apps/desktop`, preserving the upstream Hermes Desktop feature baseline while replacing candidate branding and icon assets, seeding Codex app-server and OPL domain skill defaults through the official Hermes config surface, keeping the Codex bridge as a scoped reference rather than a full backend replacement, and producing an explicit `.app` package. The Hermes route is upstream-first OPL customization, not a blank-slate GUI rewrite: later upgrades should record the upstream ref, compare official Hermes Desktop features, reapply the smallest OPL delta, and only then decide what to hide, rename, replace, or elevate through App-owned gates. Hermes must not inherit AionUI/AGUI stable payload, page-state, first-run, Full runtime, or WebUI assumptions until a Hermes-native feature comparison records what should be preserved, replaced, or hidden. A candidate enters App product truth only through App-owned contract updates and validation gates; implementation roadmaps and candidate package evidence remain technical verification until an explicit active-shell adoption decision changes `contracts/app-shell-adapter.json`. A candidate becomes the default release shell only when `contracts/app-shell-adapter.json` is updated deliberately and the runtime bridge remains satisfied, App product profile syncs into its configured target, App page-state and first-run matrices pass, shared desktop/WebUI evidence passes when claimed, App-root active-shell validation passes, GUI package compile succeeds through the App wrapper, and the external checkout history policy is preserved.

WebUI is a delivery surface for the same chat-first App UI, not a second product authority. A candidate that claims WebUI support must reuse the same React/CopilotKit renderer as Electron, preserve the App-owned `window.oplCandidate` API shape, and route browser actions/events through a local transport bridge to Codex app-server and `opl app state/action`. Electron may use native preload/IPC and native directory picking; browser WebUI may use HTTP actions and SSE event streams. Neither path may introduce a separate product profile, runtime truth source, provider selector, memory body store, artifact authority, release channel, or full workbench first screen; ordinary WebUI home uses the same default-collapsed chat canvas as desktop.

External agent UI projects can also be recorded as design references without
becoming shell candidates or first-screen product templates. OpenBMB PilotDeck is
currently in that class: its workspace/project rail, chat-first main pane,
grouped files, memory, routing, and always-on context are useful
information-organization references for OPL. OPL maps that reference into a
Codex App-style chat-first surface whose workspace/session rail and right-side
contextual tabs are available only as optional expanded context. Its AGPL-3.0 source, gateway, agent
runtime, memory store, router, always-on store, provider selection, and
WorkSpace state model do not enter App authority. Any future use beyond
reference requires a separate license decision and a normal
`shells/<candidate>` external checkout plus adapter contract, App-owned
state/action bridge, page-state/first-run gates, `.app` package verification,
and release isolation.

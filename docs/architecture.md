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

GUI 产品定义刻意分层。`docs/product/gui/ideal-interaction-spec.md` 定义不绑定具体 shell 的目标交互：Codex App 形态、chat-first、次级 context 默认收起。`docs/product/gui/codex-to-opl-app-delta.md` 定义 Codex baseline 之上的 OPL 专用增量：purpose routing、domain skill profiles、runtime bridge refs、installation policy、evidence 和 authority boundaries。`docs/product/gui/feature-inventory.md` 跟踪跨 shell 能力清单和参考模式。机器可读验收再进入 `contracts/`、page-state matrices、source、package manifests、smoke evidence 和 release gates。

`contracts/app-gui-product-contract.json` is the canonical App-owned GUI product contract. It covers the Codex CLI fixed executor experience, hidden home and ordinary-conversation backend/provider/permission selectors, an App-owned Codex model selector/status, purpose-first home entries for Research/MAS, Grant/MAG, and Presentation/RCA, assistant-scoped skill profiles for those entries, the required built-in assistant route receipt, the home prompt, App-owned ordinary Settings navigation for Overview, Setup & Access, Capabilities, Maintenance & Updates, Data & Storage, Preferences, and Advanced, secondary About/Update/Theme surfaces, legacy upstream route redirects, first-launch `ready_to_launch` before `/guid`, module path source explanation, release stable/nightly gates, MDS retirement from default display, and the OPL Flow context shown in Settings. Storage owns local data lifecycle inventory, archive/restore proof, runtime pointer prune, updater cache cleanup, and bounded log rotation controls. OMA remains available through explicit/settings surfaces, but it is not a default home entry. `contracts/app-install-exposure-policy.json` owns the App-facing install/exposure policy: `skill` is the public semantic ABI, Codex App plugins are distribution/capability bundles, and CLI/App/direct skill paths must converge on the same domain-owned action/stage metadata. `contracts/app-runtime-bridge.json` is the App-owned bridge contract that binds a replaceable shell adapter to OPL-owned CLI state/action/drilldown surfaces. `contracts/app-product-profile.json` carries desktop session defaults, visible companion skills, first-run Core readiness, Full readiness/background maintenance behavior, Settings presentation policy, legacy settings route redirects, install exposure refs, assistant skill profile data, route receipt policy, and generated shell profile data. `contracts/app-page-state-matrix.json` and `contracts/app-first-run-test-matrix.json` define page-state and first-run expectations.

Home entry ownership is split deliberately for GUI replacement. The App contract owns `home_purpose_entries` as the user-facing click targets and labels, while `default_assistants` are implementation targets for those entries. Shells render the purpose entries, route to the target assistant ids, and persist the App-owned route receipt fields for MAS/MAG/RCA. They do not decide which assistants are default, what labels they use, whether OMA appears on the home screen, or whether the route is exposed as a backend selector.

Assistant skill ownership is similarly App-owned. `assistant_skill_profiles` defines the required Codex skill that makes each home assistant do domain work: MAS requires `mas`, MAG requires `mag`, and RCA requires `rca`. `companion_payloads.default_packaged_codex_skill_ids` is the App-level default package whitelist: only skills in that list are default packaged and default visible, independent of whether a candidate originated in AionUI builtin assets, Skills Manager, a Codex local skill, or a plugin payload. `packaged_not_default_visible_codex_skill_ids` carries explicit-only packaged skills such as OMA. The ordinary Home composer and ordinary conversation loaded-capability display use the narrower `gui.ordinary_capability_selector_policy`: visible skills come only from MAS/MAG/RCA assistant profiles, visible MCP servers default to an empty App allowlist, and non-allowlisted AionUI implementation skills or MCP servers do not enter the ordinary UI or new conversation payload. Optional companion skills are visible only within the selected assistant's home skill menu after they pass that App-owned ordinary allowlist. `cron` can be packaged as a companion capability, but stays out of MAS/MAG/RCA assistant-scoped home skill menus because it is not part of those assistant profiles; AionUI-specific internal skills such as `aionui-skills`, `aionui-webui-setup`, and `skill-creator` stay out of ordinary App capability selection. The global skill hub remains a Settings/Capabilities surface, not the normal home input menu.

The home executor boundary is intentionally narrower than upstream AionUI. The App is a Codex CLI wrapper with built-in OPL assistants, not a general multi-backend agent launcher. Active shells may retain upstream AionUI agent/backend settings for development or diagnostics, but the App home path and ordinary Codex conversation path must not surface Aion CLI, Claude Code, backend switching, provider lists, or permission-mode choices as normal user controls. The visible model selector is App-owned and bounded by the product profile.

Settings boundary 也遵循同样拆分。普通 Settings navigation 是 Overview、Setup & Access、Capabilities、Maintenance & Updates、Data & Storage、Preferences、Advanced，对应 route ids `general`、`access`、`capabilities`、`environment`、`storage`、`appearance`、`advanced`。About、Update、Theme 是 secondary or deep-link surfaces。Overview、runtime、system、model、agent、assistants、skills-hub、tools、display、webui、pet 等 legacy upstream routes redirect 到 App-owned pages。Storage owns local data lifecycle inventory and cleanup controls; Shell 仍可保留 diagnostic 或 redirected sub-content 的实现组件，但这些组件不定义普通 App navigation 或 product authority。

Installation exposure uses separate classes so user-facing defaults do not become install-time duplication. The App install/update taxonomy has seven user-facing layers:

| Layer | Architecture boundary |
| --- | --- |
| Installation Carrier | The host/container carrier: macOS desktop `.app` bundle and updater metadata, Docker/WebUI image, or Linux package carrier. The standard updater is macOS App carrier-only; Docker/WebUI image updates use host update routes and volume-preservation proof. |
| OPL Runtime Fabric | App-owned runtime foundation needed to launch or recover OPL. User-facing grouping is Agent Execution Core (Codex executor, Temporal task runner, OPL Framework runtime), Environment Materializer (managed language runtimes, package/env resolvers, env cache, isolated prefixes, and receipts), and OPL System Bridge (native helper only where platform boundaries require it). `runtime_substrate` remains the machine id. Ordinary defaults use the App-owned runtime; system PATH, Homebrew, global tools, and developer checkouts are diagnostic or explicit expert opt-in unmanaged sources. |
| Capability Packages | MAS/MAG/RCA/OMA/BookForge/ScholarSkills OPL Packages. Clean managed roots may be silently updated by OPL maintenance; dirty checkouts, developer checkouts, idempotency locks, verification failures, and manual-required conditions fail closed instead of being overwritten. |
| Companion Tools | Support tools and skills such as Superpowers, cron, OfficeCLI, PDF, MinerU, and UI/UX helpers. They are App-visible helpers, not domain-authority owners. |
| Codex Surface | Codex plugin registry entries, plugin-packaged skills, generated OMA/BookForge surfaces, post-apply sync status, reload guidance, and exposure readiness. It is a visibility/readiness layer over one semantic entry, not a duplicate skill/plugin truth source. |
| Workflow Profile | OPL Flow workflow profile material and Codex guidance. Profile sync must not silently overwrite existing user `AGENTS.md` or `TASTE.md`; existing profiles are handled through Codex semantic merge packets. |
| User Data/Artifacts | Workspaces, conversations, deliverables, logs, caches, receipts, and local cleanup/restore state. User artifacts are inventory/archive/restore/confirm surfaces, not silent updater targets. |

MAS/MAG/RCA are family domain plugin surfaces: they can be default App entries and Codex-visible plugin-packaged skills, but they must not be mirrored into duplicate bare `~/.codex/skills/{mas,mag,rca}` directories. OPL Meta Agent is an OPL-generated Codex surface and remains out of the default home assistant list. Homebrew is only the App cask transport; MAS/MAG/RCA/OMA agent packs are Capability Packages managed by App/CLI maintenance, not Homebrew formulae. App release packaging copies only the declared App packaged skill ids: default packaged skills plus explicit-only packaged skills. The default companion set includes Superpowers, cron, the OfficeCLI family, PDF, MinerU document extraction, and UI/UX helpers. AionUI builtin skills are candidate shell capabilities, not a parallel packaging policy. OPL Framework owns plugin registry refresh and generated surface production, while App release packaging owns only the user-facing policy and payload assembly.

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

OPL App and OPL Workspace are deployment surfaces for the same App experience.
The local desktop App, Docker/WebUI, and OPL Workspace present the same
chat-first product model and consume the same Framework state/action contracts.
OPL Workspace may add hosted URL, account, isolation, storage volume, and
managed-resource receipts, and the user still sees the same App task flow:
select a Workspace or local App surface, confirm the resource plan, run the
task, and receive receipts. OPL Console manages organization policy, users,
quota, billing, Workspace lifecycle, connector approval, environment policy,
and managed resource packages for Console-managed resources. User-provided
local, SSH, or HPC resources remain self-managed unless Framework projections
explicitly mark them as Console-managed.

OPL Fabric is the resource capability layer behind App and Workspace, not a new
ordinary Settings top-level product. In App contracts it appears as refs-only
resource context: OPL Gateway for AI access, OPL Connect for connector
readiness, OPL Compute for local/remote/managed execution, Storage refs for
where work lands, and Environment Catalog refs for template, version, source,
and task fit. The user-facing flow is plan, approve, execute, monitor, collect,
and receipt. The App may display those refs and call `opl app action`; it does
not own compute scheduling, storage authority, connector credentials,
environment bodies, billing, or Console policy truth.

The App runtime/resource/task/data-lifecycle split is kept in one owner matrix
instead of a new control layer. `contracts/app-runtime-bridge.json#runtime_surface_owner_matrix`
binds OPL Runtime Fabric, Environment Materializer, TaskRunProjection v2, OPL
Fabric resource refs, local data lifecycle, the active shell, and Homebrew into
their owner roles. The matrix is deliberately narrow: App owns product policy
and release gates, OPL Framework owns family projections and runtime receipts,
Aion renders, and Homebrew mirrors release cohorts only. New runtime/resource
surfaces should extend that matrix and the existing projection contracts before
adding any shell-local task store, resource state machine, cleanup authority, or
distribution currentness gate.

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

Claude Science-style task awareness lands inside this Runtime model rather than
as a new dashboard. The Runtime page remains the global task-awareness center;
chat and the right inspector may show only the current-task slice of the same
`opl app state` projection. Artifact provenance, reviewer receipts, reusable
workflow refs, connector readiness, and reproducibility export actions are
Framework/domain refs consumed through App contracts. Temporal workflow,
activity, worker, queue, attempt, and Search Attribute details remain
diagnostic substrate fields and must not become the ordinary user task model.
The active shell's role is a thin renderer over App state/profile and App action
routes, not reviewer logic, artifact-body access, readiness judgment, or a
shell-owned runtime store. The active landing plan is
`docs/product/gui/claude-science-runtime-task-awareness-plan.md`.

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

Shell alternatives are intentionally separated from the default release adapter while still remaining selectable for explicit technical verification builds. `contracts/app-shell-candidates.json` declares one foreground alternative: `hermes-codex`, with its adapter under `contracts/shell-adapters/hermes-codex.json`. The default `contracts/app-shell-adapter.json` continues to define the stable AionUI release shell. `agui-codex` is now an archived AG-UI/CopilotKit technical proof: it remains replayable through its explicit adapter only when AGUI is requested, but it is not a routine candidate lane and should not receive default polish or feature work. Hermes Desktop / `hermes-codex` is the only foreground alternative, but its current source/package/smoke evidence is still technical verification evidence until an explicit App-owned adoption decision changes the active-shell contract. Hermes is currently a minimal-adapter lane based on `NousResearch/hermes-agent/apps/desktop`, preserving the upstream Hermes Desktop feature baseline while replacing candidate branding and icon assets, seeding Codex app-server and OPL domain skill defaults through the official Hermes config surface, keeping the Codex bridge as a scoped reference rather than a full backend replacement, and producing an explicit `.app` package. The Hermes route is upstream-first OPL customization, not a blank-slate GUI rewrite: later upgrades should record the upstream ref, compare official Hermes Desktop features, reapply the smallest OPL delta, and only then decide what to hide, rename, replace, or elevate through App-owned gates. Hermes must not inherit AionUI/AGUI stable payload, page-state, Full runtime, or WebUI assumptions until a Hermes-native feature comparison records what should be preserved, replaced, or hidden.

Hermes 的 first-run 是一个例外的最低可用性要求：可以复用 Hermes Desktop 的
onboarding/progress UI module，但行为 owner 必须是 OPL App/OPL CLI，不能默认
下载或执行 Hermes Agent installer。候选包启动路径必须分成四条线：每次 launch
只做轻量检查 marker、One Person Lab CLI、Codex CLI、可用 Codex 模型访问和 Codex
adapter startup；只有 marker 缺失、marker 过旧或核心组件缺失时才进入一次性本机
初始化 checklist；完全没有可用模型访问时进入“OPL Gateway”向导，通过
`opl system configure-codex --api-key-stdin --json` 写入 OPL Gateway 访问密钥。已有
Codex/OpenAI 登录或其它可用 provider 时可跳过首启 Gateway 配置，Settings 保留
OPL Gateway 配置入口用于后续切换；`opl system initialize --json`、
`opl system startup-maintenance --json`、`opl system reconcile-modules --json`、
MAS/MAG/RCA 状态和 contract diagnostics 在 OPL Codex adapter ready、主界面可见后
后台异步执行，不能阻塞热启动进入主界面。如果 `setup.status` 已显示 Codex 模型访问
配置存在，则直接进入 OPL Codex adapter，不等待 `setup.runtime_check`，也不把
runtime 超时作为普通用户首启主错误。Hermes candidate 的 macOS 图标也属于最低可用性边界：
Dock 中必须使用 OPL/AionUI 官方图标族，并保留安全边距，当前 contract 要求 alpha
bounds 不超过 900px，目标资源为 `840x840+92+92`。

A candidate enters App product truth only through App-owned contract updates and validation gates; implementation roadmaps and candidate package evidence remain technical verification until an explicit active-shell adoption decision changes `contracts/app-shell-adapter.json`. A candidate becomes the default release shell only when `contracts/app-shell-adapter.json` is updated deliberately and the runtime bridge remains satisfied, App product profile syncs into its configured target, App page-state and first-run matrices pass, shared desktop/WebUI evidence passes when claimed, App-root active-shell validation passes, GUI package compile succeeds through the App wrapper, and the external checkout history policy is preserved.

WebUI is a delivery surface for the same chat-first App UI, not a second product
authority. A candidate that claims WebUI support must use the same App-owned
product semantics as its desktop shell, preserve the App-owned
`window.oplCandidate` API shape or an explicitly equivalent browser bridge, and
route browser actions/events through a local transport bridge to Codex app-server
and `opl app state/action`. Renderer technology is candidate-specific: AGUI's
React/CopilotKit shared renderer belongs only to explicit AGUI archived-proof
replay, while Hermes WebUI support must be claimed and validated through the
Hermes candidate route before it can count as foreground-alternative evidence.
Electron may use native preload/IPC and native directory picking; browser WebUI
may use HTTP actions and SSE event streams. Neither path may introduce a
separate product profile, runtime truth source, provider selector, memory body
store, artifact authority, release channel, or full workbench first screen;
ordinary WebUI home uses the same default-collapsed chat canvas as desktop.

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

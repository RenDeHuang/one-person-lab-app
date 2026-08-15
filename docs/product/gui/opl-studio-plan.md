# One Person Lab App Successor Product Boundary

Owner: `one-person-lab-app`
Purpose: `opl_app_successor_product_boundary`
State: `active_product_development_release_admission_separate`
Machine boundary: 本文记录轻量 OPL GUI 方向的人读产品边界。产品、mainline owner 与 adoption
真值归 App contracts，source/tests 归独立 OPL Studio；package、pixel、install 与
release 结论归对应 owner evidence。本文不改变当前 active AionUI release adapter。

## Decision

`opl-studio` is the internal repo and candidate id for the approved One Person Lab App successor:
one DSH-derived React renderer, one shared Node host core, an Electron thin desktop carrier for macOS,
Windows, and Linux, plus HTTP/SSE adapters for standalone headless WebUI and Docker WebUI. All runtime
forms expose the same App-owned bridge ABI and product behavior. The product supports Codex CLI/App
Server only and must not require, start, package, or read AionUI/AionCore.

AionUI remains the active release shell until the App adapter and release surfaces complete a separate
adoption transition. That current release role does not make AionUI the target renderer, feature inventory,
or runtime dependency. The successor is required product development, but it has no full-AionUI-parity
obligation. Electron is now the selected thin desktop carrier for all three desktop platforms; each
platform still needs its own packaging, signing, updater, install, and runtime admission before support can
be claimed. Windows process placement remains adapter-owned and unresolved until native/WSL evidence exists.

The current mainline decision is `retain_aionui_with_thin_adapter`: AionUI may render the OPL-owned
UI-contribution ABI through existing App state/action surfaces, while only OPL Studio may directly reuse
the pinned DeepSeek Harness AppFrame, sidebar, conversation/composer, Settings, theme, slots, renderer
contracts, and MIT GUI primitives as its host base. OPL-specific behavior enters those slots through the
Codex/OPL bridge instead of wrapping the DSH source in a separately imitated workbench. Neither shell may
create another runtime or product-truth owner.

The vendored DSH GUI snapshot is an upstream intake boundary, not a private fork body. Selected vendor
files should remain byte-identical to the pinned source whenever possible; OPL branding, bridge logic,
state projection, and contributions live outside that tree. Updating the GUI means advancing one pinned
DSH ref, reviewing its exact source diff, then rerunning Studio type, interaction, desktop/web pixel,
package, and notice checks. Floating refs and automatic promotion are forbidden.

The product layout is intentionally small and follows the pinned DSH composition directly:

- The left rail contains only projects, conversations, search, and Settings. Runtime, capabilities,
  project context, files, and results are not standalone Home destinations.
- The central surface remains the DSH conversation timeline and composer.
- The user-requested right details surface contains exactly Run status, Files and results, and Agents and
  capabilities. Package install, update, repair, and removal remain in Settings.
- Run status combines the current Codex thread state with App-projected `active_project_lines`.
  Package-owned hypotheses, roadmaps, and other task modules render through `runtime.detail` contribution
  readback; the shell does not invent them.
- Files shows only files or directories the user actually added. Results show owner-projected artifacts;
  App state refs and action JSON are not displayed as files or results.
- In-app identity is text-only `One Person Lab`. `OPL Studio` is an internal repository, development-line,
  and candidate-artifact codename and must not appear as the user-facing product name. No Logo is rendered
  in the workbench; platform bundle icons remain normal operating-system assets.

The prior unified coordination plan is superseded by the repo-owned boundaries in
[`aionui-mainline-gui-convergence-plan.md`](../../active/aionui-mainline-gui-convergence-plan.md),
[`feature-inventory.md`](feature-inventory.md), and [`decisions.md`](../../decisions.md).
Historical experiments involving model-triggered cross-thread tools, private delivery ledgers,
cross-host handoff, or a second thread runtime are evidence of those experiments only. They are not
required capabilities, release blockers, or an authority source for product behavior.

## Current Source Baseline

The current Studio source baseline directly reuses the pinned DSH AppFrame, conversation/composer,
Settings shell, theme tokens, Appearance control and slot host. It now renders only `One Person Lab`,
disambiguates Auto from a fixed model, presents effort values without a redundant “reasoning” prefix,
and lists owner-projected OPL standard Agents separately in the composer palette. These are source and
local visual results only; they do not prove installed, active-shell or release adoption.

The App contract now defines the missing successor P1 binding without adding an Agent activation action.
Selecting a standard Agent captures the owner-projected `package_id`, `shortcut_id`, `codex_visible_entry`,
and `required_skill_ids`, then launches the canonical conversation through Codex `thread/start` and
`turn/start`. During an active turn, accepted follow-up input uses `turn/steer`; otherwise it uses
`turn/start`. Any visible queue is renderer-ephemeral until App Server acceptance and is never a persistent
Shell queue. Studio source must still implement and freshly read back this contract before the capability is
complete.

## Minimum Complete Product And Ordered Gaps

Studio completion follows the App profile's minimum-complete contract, not AionUI feature parity.

| Surface | Current Studio baseline | Required closure |
| --- | --- | --- |
| Agent management | Dynamic catalog and projected installed/enabled state; OPL standard Agents are separated from Skills and connections; App P1 transport and lifecycle binding is canonical | Implement the contract-owned `thread/start` + `turn/start` launch, active-turn `turn/steer`, dynamic projected lifecycle actions, automatic-update policy and fresh readback; do not add an Agent activation action or Shell queue |
| Run and research state | Thread turn state and `active_project_lines` are available | Project current Agent phase, queued/active work, hypotheses, roadmap and owner task modules through `runtime.detail`; never synthesize research state in the shell |
| App update | One App-owned logical update contract is canonical | Implement Electron, standalone-service/package, and container-image adapters without turning them into separate product updaters; each route requires restart/recreate and running-version readback |
| OPL Base update | Framework managed-update status/action/receipt authority and shared host-core binding are canonical | Render Base independently and invoke only the existing Framework managed-update bridge with terminal readback |
| OPL Packages and Agent updates | Dynamic Package actions, managed automatic-update policy and shared host-core binding are canonical | Render aggregate currentness and projected per-Package lifecycle independently from App/Base; Agent Packages never become a fourth updater |
| Capabilities | Composer skill picker and `settings.section` contributions exist | Replace counts-only Settings content with the dynamic Skill/Plugin/MCP/managed-companion directory |
| Workspace and storage | Owner state is readable | Add owner-projected select/rebind and cleanup actions; never create a second store |
| Account and access | Gateway projection, projected non-secret actions and dedicated login secret bridge are canonical | Implement Settings controls and post-action readback; never place password material in generic App actions or renderer persistence |
| Preferences and diagnostics | DSH System/Light/Dark is wired to the real renderer theme | Add necessary language, notifications and local behavior controls, service diagnostics/export and About/notices without copying DSH runtime settings |

P1 contract closure is now explicit in `app-runtime-bridge.json#native_minimum_product_bridge`, the Studio
adapter, candidate requirements and focused validation. Source implementation remains open for Agent launch,
active-turn submission, Gateway Settings actions, dynamic lifecycle and the three update objects. P1 closes
only after those paths execute and freshly read back in Studio alongside live run status and `runtime.detail`.
P2 adds connections, notifications,
storage maintenance, diagnostic export and repeatable DSH upstream intake. AionUI-only provider, Team,
scheduler or AionCore surfaces are not parity requirements unless a current OPL user outcome independently
requires them.

## Composition Rule

The product kernel owns navigation, Codex thread/turn transport, the Settings
host, permissions, and the action broker. Packages may contribute only through
declared `settings.section`, `runtime.detail`, and `composer.palette` slots.
Studio reuses pinned DeepSeek Harness registration, ordering, error isolation,
and disposal. AionUI and Studio consume one App Client Contribution ABI and one
App-owned profile/slot policy. Each shell's Client Cordis graph derives from the
Framework Host graph projection; neither Cordis nor DSH becomes an independent
Host, Package registry, currentness, state store, updater, session, action, or
runtime authority.

## Current Boundary

- Codex Core/App Server owns canonical thread identity, history, lifecycle, permissions, and turn state.
- The candidate consumes the minimal user-triggered thread operations owned by Codex App Server:
  list, read, start, resume, fork, archive, and restore.
- Session/thread is the primary identity. Project affinity is zero-or-one: a project or directory may provide
  a new session's initial cwd, and a projectless session may be adopted once after canonical readback. A bound
  session is not arbitrarily reassigned; runtime `pwd` changes do not rewrite affinity, and the directory does
  not own sessions, context, or artifacts.
- Ordinary conversation starts Codex CLI App Server directly; no ACP/AionCore carrier is required.
- The successor does not require, start, package, or read AionCore. Its shared Node host core resolves an exact Codex executable through
  `OPL_CODEX_BIN` or an App-owned equivalent, starts Codex App Server directly, and consumes OPL only
  through Framework `opl app state/action` contracts.
- Electron desktop owns only windows, preload IPC, OS integration, packaging, signing, and the desktop update
  adapter. Business logic and Codex/OPL transports stay in the shared Node host core. Standalone headless WebUI
  and Docker use the same host core through HTTP/SSE and run neither Electron nor AionCore.
- The existing `install.sh --headless` remains Base-only. Standalone headless WebUI requires a new explicit
  runtime form or service entry and a separate migration decision; the current packaged Desktop `--webui`
  path is not evidence that the Electron-free host is complete.
- Candidate-specific storage, protocol, renderer, package, or live-smoke evidence never proves active-shell
  adoption, release readiness, or shared physical Runtime parity.
- macOS, Windows, and Linux must reuse the same renderer, host core, and bridge ABI. Source support does not
  establish platform support, and the Windows adapter must not pre-decide native versus WSL process placement.
- AionUI and OpenChamber are bounded references only. Any source reuse requires a separate decision and must
  not bring their runtime authority, provider abstraction, session store, or control plane into OPL.
- Model dynamic tools, JSONL audit/idempotency ledgers, write-set advisory control planes, pending-request
  coordination UI, and cross-host task handoff require a separate future product decision.

## Release Admission Gate

Successor development follows the minimum-complete product contract. It does not create a full AionUI
parity plan. Active-shell adoption, installed-App replacement, platform updater
participation, and release promotion still require separate App-owner qualification and evidence. App release
validators must not infer those states from source, local package, or candidate evidence.

## Optional Design Evaluation Tooling

For an explicit, bounded UI hypothesis, maintainers may use the `build-web-apps`
frontend design and React review skills as authoring and visual-QA aids. The App
design system remains the specification: concept generation must preserve its
information architecture and contracts, and any implementation claim still
requires browser screenshots and focused interaction checks against the selected
acceptance surface.

This tooling is not a Native runtime or package dependency, a routine validation
gate, or a reason to start an unsolicited redesign. A full visual redesign is
appropriate only when a manual evaluation task names the target screen or flow
and its acceptance surface.

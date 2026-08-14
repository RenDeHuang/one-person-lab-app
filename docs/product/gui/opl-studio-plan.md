# OPL Studio Lightweight Architecture Evaluation Boundary

Owner: `one-person-lab-app`
Purpose: `opl_studio_candidate_boundary`
State: `manual_evaluation_not_in_active_release_scope`
Machine boundary: 本文记录轻量 OPL GUI 方向的人读候选边界。产品、mainline owner 与 adoption
真值归 App contracts，候选 source/tests 归独立 OPL Studio；package、pixel、install 与
release 结论归对应 owner evidence。本文不改变当前 active AionUI release adapter。

## Decision

`opl-studio` remains the foreground alternative candidate used to evaluate the approved lightweight
OPL GUI direction: an OPL-owned React renderer, Swift/AppKit + WKWebView macOS host, lightweight OPL
Studio Node Web host, and their shared typed bridge. The candidate supports Codex CLI/App Server only and
must not require, start, package, or read AionUI/AionCore.

AionUI remains the active release shell until the App adapter and release surfaces complete a separate
adoption transition. That current release role does not make AionUI the future lightweight renderer or runtime
dependency. OPL Studio remains manual, non-periodic, non-mainline, non-blocking, and without feature-parity or
cross-platform delivery obligation. Windows/Linux are a future product direction using the same renderer;
Electron versus Tauri and the implementation owner remain deferred.

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
- In-app identity is text-only `OPL Studio` / `One Person Lab`. No Logo is rendered in the workbench;
  the macOS bundle icon remains a normal operating-system asset.

The prior unified coordination plan is superseded by the repo-owned boundaries in
[`aionui-mainline-gui-convergence-plan.md`](../../active/aionui-mainline-gui-convergence-plan.md),
[`feature-inventory.md`](feature-inventory.md), and [`decisions.md`](../../decisions.md).
Historical candidate experiments involving model-triggered cross-thread tools, private delivery ledgers,
cross-host handoff, or a second thread runtime are evidence of those experiments only. They are not
required capabilities, release blockers, or an authority source for product mainline ownership.

## Current Boundary

- Codex Core/App Server owns canonical thread identity, history, lifecycle, permissions, and turn state.
- The candidate consumes the minimal user-triggered thread operations owned by Codex App Server:
  list, read, start, resume, fork, archive, and restore.
- Session/thread is the primary identity. Project affinity is zero-or-one: a project or directory may provide
  a new session's initial cwd, and a projectless session may be adopted once after canonical readback. A bound
  session is not arbitrarily reassigned; runtime `pwd` changes do not rewrite affinity, and the directory does
  not own sessions, context, or artifacts.
- Ordinary conversation starts Codex CLI App Server directly; no ACP/AionCore carrier is required.
- Native does not require, start, package, or read AionCore. It resolves an exact Codex executable through
  `OPL_CODEX_BIN` or an App-owned equivalent, starts Codex App Server directly, and consumes OPL only
  through Framework `opl app state/action` contracts.
- Native macOS uses Swift/AppKit + WKWebView; OPL Studio WebUI uses a lightweight Node HTTP/SSE host and Codex
  state volume. Both load the same OPL renderer and bridge shape. Docker runs neither Electron nor AionCore.
- Candidate-specific storage, protocol, renderer, package, or live-smoke evidence never proves active-shell
  adoption, release readiness, or shared physical Runtime parity.
- Windows/Linux wrapper work requires the separate adoption decision recorded in the delivery topology; it
  must reuse the OPL renderer, stay Codex-only, and cannot claim current platform support from source alone.
- AionUI and OpenChamber are bounded references only. Any source reuse requires a separate decision and must
  not bring their runtime authority, provider abstraction, session store, or control plane into OPL.
- Model dynamic tools, JSONL audit/idempotency ledgers, write-set advisory control planes, pending-request
  coordination UI, and cross-host task handoff require a separate future product decision.

## Manual Evaluation Gate

OPL Studio may be evaluated or improved only through an explicit manual task with a bounded objective
and focused acceptance surface. Ordinary technical evaluation does not create a parity plan, mainline backlog,
cross-platform workstream, release relationship, or product-completion obligation. Product expansion,
mainline ownership, active-shell adoption, or release participation requires a separate App owner decision and
corresponding contract delta. App release validators must not infer those states from candidate evidence.

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

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

The source implementation now includes the successor P1 skeleton without adding an Agent activation action.
It projects the dynamic Agent catalog and lifecycle, captures the selected standard Agent's owner-projected
`package_id`, `shortcut_id`, `codex_visible_entry`, and `required_skill_ids`, and routes new conversations
through Codex `thread/start` plus `turn/start`. During an active turn, accepted follow-up input uses
`turn/steer`; otherwise it uses `turn/start`. Any visible queue is renderer-ephemeral until App Server
acceptance and is never a persistent Shell queue. The same source baseline includes the `runtime.detail`
renderer skeleton. Electron Desktop and standalone Headless have App-updater callers, and Base/Package
action entries exist, but those facts do not establish three complete update objects: Docker/OCI has no
host-side updater caller, the fast App projection does not yet supply managed-update and OPL Flow dependency
state, and currentness readback is incomplete. Dynamic Codex Skills/Plugins/Apps reading is canonical; the
searchable Settings directory, onboarding, workspace/storage controls and updater UX remain in an active
Studio lane rather than canonical source. `managed_companions` and other owner capability details are not
yet preserved by the compact projection. Source presence does not replace canonical post-action readback,
live producer evidence, interaction qualification, or user acceptance.

## Minimum Complete Product And Ordered Gaps

Studio completion follows the App profile's minimum-complete contract, not AionUI feature parity. The status
labels below distinguish canonical source, an unabsorbed active lane, missing producer/caller work, and work
intentionally deferred to release admission; none of them implies user acceptance.

| Surface | Current status | Current evidence and required closure |
| --- | --- | --- |
| Agent management | Canonical source-complete skeleton; correctness gaps open | Dynamic catalog, projected installed/enabled/readiness lifecycle, standard-Agent selection, `thread/start` + `turn/start`, and active-turn `turn/steer` are present. Still prove post-launch `thread/read(includeTurns=true)` against the returned canonical thread, restore `activeTurnId` when an active thread is reopened, and hard-block launch when `launch_allowed` or `operational_ready` is false. Lifecycle and automatic-update outcomes require fresh owner readback; do not add an Agent activation action or Shell queue. |
| Run and research state | Canonical renderer skeleton; producer missing | Thread/turn status, `active_project_lines`, and scoped `runtime.detail` rendering exist. A real owner producer for phase, hypotheses, roadmap and task modules plus an authoritative thread-to-`work_item` identity ABI are still required before work-item-scoped data may render; never synthesize research state in the shell. |
| App update | Desktop/Headless callers canonical; Docker/OCI caller missing; UX active lane; release deferred | Electron and standalone Headless status/check/apply/restart callers exist. Add the Docker/OCI host-side caller, then qualify restart or recreate and running-version readback. The Settings/Updater interaction and failure-state flow is pending in the active Studio lane. Signing, publication and public-feed mutation remain release work. |
| OPL Base update | Action entry canonical; producer/readback missing | The Settings action entry exists, but the fast App projection does not yet provide managed-update state. Add that producer projection and qualify terminal post-action readback through the Framework-managed authority. |
| OPL Packages and Agent updates | Action entries canonical; producer/readback missing | Dynamic action entries exist, but OPL Flow dependency/currentness state is absent from the fast projection. Preserve Package and Agent Package identity, version, policy and terminal outcomes in the owner projection; Agent Packages remain part of this object and never become a fourth updater. |
| Capabilities | Codex catalog canonical; Settings directory active lane; projection producer incomplete | Dynamic Codex Skills/Plugins/Apps reading and composer selection exist. The searchable Settings directory is pending in the active Studio lane. Preserve `managed_companions`, Flow dependencies, MCP, image/voice capability, owner, version and actions through the compact projection, then qualify empty, loading, partial and error states. |
| Channel access | Framework projection and Studio source consumer complete | Provider callback, Framework `app_state.transport_bindings` projection, fast-state preservation and Studio merge consumer are source E2E complete. Render projected connection, QR, pairing and authorized-user state with exact action inputs; treat absence as normal, keep an unbound transport row visible, and never persist QR payloads or infer/write bindings. |
| Computer Use | Shared ABI canonical; Studio consumption active lane | Complete and qualify the Host-projected Computer Use contribution consumer without granting the renderer a second capability authority. |
| Workspace and storage | Active Studio lane; carrier-host producer missing | Workspace chooser/rebind, storage inventory and related Settings/Onboarding UX are pending outside canonical main. The carrier host also needs a cleanup plan/execute/restore ABI and terminal owner readback; never create a second store. |
| Account and access | Core Gateway bridge canonical; UX active lane | Gateway projection, cache, non-secret action path and dedicated login secret bridge exist. First-run/startup and stale/error/post-action Settings behavior remains pending interaction qualification; never place password material in generic App actions or renderer persistence. |
| Preferences and diagnostics | Basic canonical settings; expanded UX active lane; recovery projection incomplete | Theme and basic local preferences exist. Top-level Runtime Overview, first-run/onboarding, updater UX and macOS tray/menu are in the active Studio lane. Service recovery must preserve root cause, mutation guard, repair/restart/recheck actions and terminal readback before acceptance. |

P1 contract closure is now explicit in `app-runtime-bridge.json#native_minimum_product_bridge`, the Studio
adapter, candidate requirements and focused validation. Agent launch/steer and dynamic lifecycle have a
canonical source skeleton; the other rows above remain either active-lane work or producer/caller gaps and
must not be summarized as three complete update objects, a complete capability directory, or accepted
Settings. The functional baseline remains open until canonical Agent thread/turn readback and active-turn
restoration, readiness false-gates, a real `runtime.detail` producer with authoritative `work_item` identity,
current Settings/Onboarding/Updater interaction qualification, Computer Use consumption,
and end-to-end user acceptance are complete. Connections, notifications, storage maintenance, diagnostic
export and repeatable DSH upstream intake follow the same evidence boundary. AionUI-only provider, Team,
scheduler or AionCore surfaces are not parity requirements unless a current OPL user outcome independently
requires them.

## Composition Rule

The product kernel owns navigation, Codex thread/turn transport, the Settings
host, permissions, and the action broker. Packages may contribute only through
declared `settings.section`, `runtime.detail`, and `composer.palette` slots, including the App-owned
`channel_access` standard view for Weixin/channel providers and the separate `remote_companion_access`
standard view for OPL Link. Canonical conversation/thread bindings come only from Framework-projected
`app_state.transport_bindings`; Studio joins them by exact host and thread identity and never infers or writes
bindings from workspace/title state.
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
  a new session's initial cwd, and a projectless session may be adopted once into versioned Studio UI metadata
  keyed by the exact canonical thread ID. Studio does not claim an App Server `projectId` field or require a
  `thread/read.projectId` readback that the current protocol does not provide. A bound session is not arbitrarily
  reassigned; runtime `pwd` changes do not rewrite UI affinity, and the directory does not own sessions, context,
  or artifacts.
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

The current objective stops at the functional baseline and local user acceptance. AionUI active-shell
replacement or retirement, protected release admission, signing/notarization, publication, deployment and
public update-feed mutation are deferred to separate App-owner decisions after that baseline is accepted.

The approved delivery order now has an explicit Preview and transition runway. Studio first ships only as
the separately identified `One Person Lab Preview`, using its own bundle, user-data root, repository, and
updater feed for feature validation and internal users. A Preview release may be publicly downloadable and
automatically update later Preview builds after its own signing, notarization, feed, artifact, install, and
restart qualification. It remains outside the App Stable/Dev/Nightly identity and does not change the active
shell.

After functional and internal acceptance, adoption converges both installed populations on the existing
`One Person Lab` identity defined by `contracts/app-release-channel.json#shell_transition_policy`:

- Existing AionUI App installations receive Studio renderer bytes as a normal strictly newer update from
  the preserved App Stable feed. Bundle ID, install path, user-data root, repository, and updater metadata
  namespace stay unchanged.
- Existing Studio Preview installations receive a terminal Preview update that performs a signed handoff
  to one exact notarized App release. Preview never changes its bundle ID or feed to impersonate the App.

The target's first launch owns one idempotent, versioned migration before normal renderer startup. It imports
only allowlisted shell-local preferences, canonical-thread-keyed UI metadata, and unsent drafts. Codex
threads, Gateway credentials/account, Framework Package/runtime/receipts, Workspace source, and domain
artifacts remain at their existing owners and are reused without copying. AionUI/AionCore databases,
credentials, cookies, Electron cache/session data, and updater identity files are excluded. An optional last
AionUI pre-cutover release may emit migration inventory for early diagnosis, but correctness must not depend
on users installing that intermediate version; direct upgrade from every supported source version remains
mandatory.

The future implementation sequence is:

1. close the Studio functional baseline and internal-user acceptance;
2. qualify signed/notarized Studio Preview publication and Preview-to-Preview automatic updates;
3. implement the App target migrator, AionUI supported-source readers, and Preview handoff exporter/helper;
4. freeze the supported source window and qualify AionUI-only, Preview-only, both-installed, interrupted
   migration, existing-target, and rollback scenarios in clean VMs;
5. explicitly switch the App adapter and publish Studio bytes through the preserved App Stable identity;
6. publish the terminal Preview handoff, then retain source bytes and rollback artifacts until post-update
   owner readback is accepted.

No source, local package, migration receipt, or Preview release authorizes step 5. The cutover requires a
separate App-owner production decision and exact public/installed readback for both upgrade routes.

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

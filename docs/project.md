# One Person Lab App Project

Owner: `one-person-lab-app`
Purpose: `app_project_boundary`
State: `active_truth`
Machine boundary: Human-readable project boundary. Machine-readable truth lives in `contracts/`, source, release artifacts, updater metadata, and test results.

One Person Lab App is the desktop product repository for One Person Lab. It owns packaging, release assets, updater metadata, user guides, screenshots, first-run checks, App product contracts, GUI runtime bridge contract, GUI product truth, and GUI page-state validation.

The intended product shape is a local-first, cloud-continuous workbench for the
OPL family: users start from a chat-first App, choose the work they want to do,
and keep the same project/task/artifact/receipt language whether they are on the
macOS desktop App, Docker/WebUI in a browser, or hosted OPL Workspace. Codex CLI
is the fixed executor on the ordinary user path. Professional agents such as
MAS, MAG, RCA, BookForge, and OMA are first-party starter packages and shortcuts
for research, grants, presentation work, book writing, and agent-building work;
future compliant user, organization, or third-party packages should use the same
management and launch path. The App does not present upstream AionUI
multi-backend selection as a normal user workflow. Selecting a shortcut creates
a Codex CLI conversation with an App-owned invocation receipt; it is not a
backend switcher or a session-behavior contract.

Docker/WebUI is the browser runtime form of the same App workbench, suitable for
Linux, Windows, servers, and cloud VMs. OPL Workspace is the hosted product form
of that WebUI when account, storage, isolation, and managed-resource policy are
attached. This keeps the user promise simple: start where your files and work
already are, then move to remote or cloud execution without learning a second
work system.

不绑定具体 shell 的目标交互写在 `docs/product/gui/ideal-interaction-spec.md`。
Codex App 到 OPL App 的产品增量写在 `docs/product/gui/codex-to-opl-app-delta.md`。跨 shell
能力清单仍由 `docs/product/gui/feature-inventory.md` 维护。

The App consumes OPL Framework CLI JSON, machine-readable contracts, provider receipts, and domain-owned projections. It does not own OPL runtime truth, provider implementation, MAS/MAG/RCA/BookForge domain truth, domain quality verdicts, memory body, artifact body, or artifact authority.

The Runtime page is an App product projection, not a runtime ledger owner. Its default view is user-task-status first: running task count, active project count, queued project count, attention count, then task rows with status, stage, progress label, next step, owner, and last progress. Project progress refs, safe actions, provider/current_control_state diagnostics, and full evidence ledger detail stay secondary or on-demand for diagnostics or release evidence. App release and user-path evidence is cohort-bound App evidence and cannot be promoted into MAS/MAG/RCA/BookForge readiness or OPL family production readiness.

The active GUI shell is `aionui`, checked out from `gaofeng21cn/opl-aion-shell` under `shells/aionui/`. Shell implementation history stays in the shell repository; this repository keeps App product, release, contract, testing, screenshot, and user documentation in the App mainline. Replacing the active shell changes the implementation carrier only; App GUI behavior and runtime bridge remain governed by `contracts/app-shell-adapter.json`, `contracts/app-runtime-bridge.json`, `contracts/app-product-profile.json`, `contracts/app-page-state-matrix.json`, `contracts/app-first-run-test-matrix.json`, and `contracts/app-release-channel.json`.

Experimental GUI candidates are declared separately in `contracts/app-shell-candidates.json`. The current foreground alternative is `opl-native-workbench`, selected through `contracts/shell-adapters/opl-native-workbench.json` and governed by the App-owned candidate policy. Hermes Desktop / `hermes-codex` is retained as the prior foreground alternative reference through `contracts/shell-adapters/hermes-codex.json`. `agui-codex` is no longer a foreground candidate: it remains a linked archived technical proof under `shells/agui-codex/` with its selectable replay adapter at `contracts/shell-adapters/agui-codex.json`. Candidate shells do not participate in default stable, nightly, updater, Docker/WebUI, or Full first-install release packaging until the active adapter is deliberately switched, and AGUI should not receive routine updates, polish, or adoption work unless AGUI replay is explicitly requested. Candidate shell work enters App product truth only through App-owned contracts and validation gates, not through a shell implementation roadmap.

Foreground candidate adapter contracts identify the candidate with `candidate_shell`
and must not rewrite `active_shell`. `active_shell` remains reserved for the
default release adapter in `contracts/app-shell-adapter.json` until an explicit
App-owned adoption gate switches it.

Default current status is [status.md](status.md). Documentation entry is [README.md](README.md).

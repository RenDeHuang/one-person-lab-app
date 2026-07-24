# One Person Lab App Project

Owner: `one-person-lab-app`
Purpose: `app_project_boundary`
State: `active_truth`
Machine boundary: Human-readable project boundary. Machine-readable truth lives in `contracts/`, source, release artifacts, updater metadata, and test results.

One Person Lab App is the desktop product repository for One Person Lab. It owns packaging, release assets, updater metadata, user guides, screenshots, first-run checks, App product contracts, GUI runtime bridge contract, GUI product truth, and GUI page-state validation.

The current required product shape is a local-first workbench for the OPL family:
users start from a chat-first App, choose the work they want to do, and keep the
same project/task/artifact/receipt language on the macOS desktop App and
Docker/WebUI in a browser. Hosted OPL Workspace is an X0-03 conditional route,
enabled only when account, storage, isolation, backend, and owner policy exist.
Codex CLI is the fixed executor on the ordinary user path. Installed Agent
Packages can expose shortcuts for research, grants, presentation work, book
writing, agent-building work, or future domains through the same discovery,
management, and launch path. Current first-party examples include MAS, MAG,
RCA, BookForge, and OMA, but they are neither an App allowlist nor an ecosystem
ceiling. The App does not present upstream AionUI
multi-backend selection as a normal user workflow. Selecting a shortcut currently
creates a Codex CLI conversation and may record an App-owned invocation receipt
for compatibility. Phase 2 replaces that ledger with an optional owner-projected
launch/route reference and ordinary App task events; the receipt is not binding,
closure, domain-readiness or release evidence. This is not a backend switcher or
a session-behavior contract.

Docker/WebUI is the U1-05 browser runtime form of the same App workbench,
suitable for Linux, Windows, servers, and cloud VMs. A hosted OPL Workspace may
reuse that surface only after its X0-03 owner/backend gates exist; it is not a
current ordinary App requirement, default release gate, or placeholder state.

不绑定具体 shell 的目标交互写在 `docs/product/gui/ideal-interaction-spec.md`。
Codex App 到 OPL App 的产品增量写在 `docs/product/gui/codex-to-opl-app-delta.md`。跨 shell
能力清单仍由 `docs/product/gui/feature-inventory.md` 维护。

The App consumes OPL Framework CLI JSON, machine-readable contracts, provider receipts, and domain-owned projections. It does not own OPL runtime truth, provider implementation, MAS/MAG/RCA/BookForge domain truth, domain quality verdicts, memory body, artifact body, or artifact authority.

The retained X0-01 Runtime page is an optional App projection, not a runtime ledger, core product gate, or operations console. When enabled it shows only Agent -> Project scope, one row per canonical Work Item, user-facing task status, running state, elapsed time, current and total Token usage, Stage order, current/next Stage, current Attempt, and task archive/restore. The next action and owner are read-only Work Item semantics; Runtime does not expose a safe-action catalog or platform mutation controls. Provider/platform repair, managed dependencies, software updates, raw diagnostics, State Index, and operator drilldown belong to Maintenance; Agent Package lifecycle belongs to Agents; Skills, Plugins, OPL Flow, MCP, image, and voice capability health belongs to Capabilities; artifact provenance belongs to the task/conversation Inspector; complete same-cohort evidence belongs to release tooling. Default machine gates retain the Framework producer/authority contract but do not require the route; full route detail is validated explicitly. App release and user-path evidence is cohort-bound App evidence and cannot be promoted into MAS/MAG/RCA/BookForge readiness or OPL family production readiness.

The active GUI shell is `aionui`, checked out from `gaofeng21cn/opl-aion-shell` under `shells/aionui/`. Shell implementation history stays in the shell repository; this repository keeps App product, release, contract, testing, screenshot, and user documentation in the App mainline. Replacing the active shell changes the implementation carrier only; App GUI behavior and runtime bridge remain governed by `contracts/app-shell-adapter.json`, `contracts/app-runtime-bridge.json`, `contracts/app-product-profile.json`, `contracts/app-page-state-matrix.json`, `contracts/app-first-run-test-matrix.json`, and `contracts/app-release-channel.json`.

Experimental GUI candidates are declared separately in `contracts/app-shell-candidates.json`. The current foreground alternative is `opl-native-workbench`, selected through `contracts/shell-adapters/opl-native-workbench.json` and governed by the App-owned candidate policy. Hermes Desktop / `hermes-codex` is retained as the prior foreground alternative reference through `contracts/shell-adapters/hermes-codex.json`. `agui-codex` is no longer a foreground candidate: it remains a linked archived technical proof under `shells/agui-codex/` with its selectable replay adapter at `contracts/shell-adapters/agui-codex.json`. Candidate shells do not participate in default Stable, updater, Docker/WebUI, or Full first-install release packaging until the active adapter is deliberately switched. Public Nightly publication is retired; historical Nightly bytes remain read-compatible only. Distribution and installation terminology, including approved future carriers, is maintained in `docs/delivery/distribution-and-install-ssot.md`. AGUI should not receive routine updates, polish, or adoption work unless AGUI replay is explicitly requested. Candidate shell work enters App product truth only through App-owned contracts and validation gates, not through a shell implementation roadmap.

Foreground candidate adapter contracts identify the candidate with `candidate_shell`
and must not rewrite `active_shell`. `active_shell` remains reserved for the
default release adapter in `contracts/app-shell-adapter.json` until an explicit
App-owned adoption gate switches it.

Default current status is [status.md](status.md). Documentation entry is [README.md](README.md).

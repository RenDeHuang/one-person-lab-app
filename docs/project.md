# One Person Lab App Project

Owner: `one-person-lab-app`
Purpose: `app_project_boundary`
State: `active_truth`
Machine boundary: Human-readable project boundary. Machine-readable truth lives in `contracts/`, source, release artifacts, updater metadata, and test results.

One Person Lab App is the desktop product repository for One Person Lab. It owns packaging, release assets, updater metadata, user guides, screenshots, first-run checks, App product contracts, GUI runtime bridge contract, GUI product truth, and GUI page-state validation.

The intended product shape is a Codex App equivalent wrapper for the OPL family: Codex CLI is the fixed executor on the ordinary user path, and MAS, MAG, and RCA are built-in intelligent task entries for research, grants, and presentation work. The App does not present upstream AionUI multi-backend selection as a normal user workflow. Selecting a built-in entry creates a Codex CLI conversation with an App-owned route receipt; it is not a backend switcher.

不绑定具体 shell 的目标交互写在 `docs/app-ideal-gui-interaction-spec.md`。
Codex App 到 OPL App 的产品增量写在 `docs/codex-to-opl-app-delta.md`。跨 shell
能力清单仍由 `docs/app-gui-feature-inventory.md` 维护。

The App consumes OPL Framework CLI JSON, machine-readable contracts, provider receipts, and domain-owned projections. It does not own OPL runtime truth, provider implementation, MAS/MAG/RCA domain truth, domain quality verdicts, memory body, artifact body, or artifact authority.

The active GUI shell is `aionui`, checked out from `gaofeng21cn/opl-aion-shell` under `shells/aionui/`. Shell implementation history stays in the shell repository; this repository keeps App product, release, contract, testing, screenshot, and user documentation in the App mainline. Replacing the active shell changes the implementation carrier only; App GUI behavior and runtime bridge remain governed by `contracts/app-shell-adapter.json`, `contracts/app-runtime-bridge.json`, `contracts/app-product-profile.json`, `contracts/app-page-state-matrix.json`, `contracts/app-first-run-test-matrix.json`, and `contracts/app-release-channel.json`.

Experimental GUI candidates are declared separately in `contracts/app-shell-candidates.json`. The current `agui-codex` candidate is a linked external shell repo under `shells/agui-codex/` with its own selectable adapter contract at `contracts/shell-adapters/agui-codex.json`. It does not participate in default stable, nightly, updater, Docker/WebUI, or Full first-install release packaging. For technical verification, the same App wrapper can target it by setting `OPL_APP_SHELL_ADAPTER_CONTRACT=contracts/shell-adapters/agui-codex.json`; the candidate package must compile a launchable `.app` bundle and manifest rather than a text-only smoke artifact.

Default current status is [status.md](status.md). Documentation entry is [README.md](README.md).

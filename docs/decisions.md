# One Person Lab App Decisions

Owner: `one-person-lab-app`
Purpose: `app_decisions`
State: `active_truth_with_history_notes`
Machine boundary: Human-readable decision record. Machine-readable truth lives in `contracts/`, source, release artifacts, updater metadata, test outputs, active shell validation, and OPL Framework CLI/read-model output consumed by the App.

## Current Decisions

| Decision | Current reading | Machine boundary |
| --- | --- | --- |
| App repo owns GUI product truth | App-level page behavior, model-selection policy, onboarding policy, screenshots, release/user docs, and release gates are governed from this repo. | `contracts/app-gui-product-contract.json`, `contracts/app-product-profile.json`, `contracts/app-page-state-matrix.json`, `contracts/app-first-run-test-matrix.json`, release scripts, and App tests. |
| Home executor is fixed to Codex CLI | The App home path is a Codex App equivalent wrapper with built-in MAS/MAG/RCA entries. Aion CLI, Claude Code, generic backend switching, home model override lists, and permission-mode controls are not normal user choices. | `contracts/app-gui-product-contract.json#executor_policy`, `contracts/app-product-profile.json#gui.home`, `contracts/app-page-state-matrix.json#guid_home`, active-shell validation, and shell GUI tests. |
| Active shell stays an external implementation carrier | `shells/aionui/` is the current active shell checkout from `gaofeng21cn/opl-aion-shell`; shell history and implementation truth stay in the shell repo. | `contracts/app-shell-adapter.json` and active-shell validation decide whether a shell satisfies the App contract. |
| Runtime page is a consumer of OPL read models | The App consumes `opl app state`, `opl app action`, and on-demand Framework drilldown output; it does not own runtime truth, provider implementation, domain truth, memory body, artifact body, owner receipt authority, or domain verdicts. | `contracts/app-runtime-bridge.json`, `contracts/app-page-state-matrix.json`, and OPL Framework CLI/read-model output. |
| Standard updater and Full first-install assets stay separate | Standard updater metadata must never select `Full` assets. Full first-install evidence remains a separate release gate and must not be promoted from missing artifacts. | `contracts/app-release-channel.json`, release evidence manifests, remote release verification, and first-run VM evidence. |
| App docs use a lighter lifecycle taxonomy | The App keeps only App-owned long-lived docs directories. Framework/domain-agent taxonomy directories are added only when App material has a clear owner, purpose, state, and machine boundary. | `docs/docs_portfolio_consolidation.md`, `docs/README.md`, and repo docs inventory. |

## Superseded Readings

| Superseded reading | Current reading |
| --- | --- |
| AionUI implementation defaults can define One Person Lab App product truth. | AionUI is implementation material; App product truth is contract-backed from this repo. |
| Upstream AionUI multi-Agent controls are power-user App features. | They are implementation material or diagnostics; the App home path is fixed Codex CLI plus built-in MAS/MAG/RCA purpose entries. |
| App release or UI rendering can prove MAS/MAG/RCA/OMA readiness. | App release artifacts, UI rendering, and provider/read-model availability are App or Framework evidence only; domain readiness remains domain-owned. |
| Full first-install assets can be served through the standard updater channel. | Full assets are separate first-install downloads and remain outside updater metadata. |

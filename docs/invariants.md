# One Person Lab App Invariants

Owner: `one-person-lab-app`
Purpose: `app_invariants`
State: `active_truth`
Machine boundary: Human-readable invariants. Machine-readable truth lives in `contracts/`, source, release artifacts, updater metadata, and test results.

- The App repo owns desktop product packaging, release metadata, first-run product policy, App-level contracts, screenshots, user guides, and App validation wrappers.
- The App repo owns One Person Lab App GUI product truth. The active shell may implement renderer/process/package/test/release-hook details and absorb upstream AionUI changes, but App page behavior, model-selection policy, onboarding policy, screenshots, and release/user docs stay App-owned.
- The App ordinary path is a Codex CLI fixed-executor experience with built-in MAS/MAG/RCA purpose entries. It must not expose Aion CLI, Claude Code, generic backend switching, home or conversation model override lists, or permission-mode selectors as normal user choices.
- The App home assistant entries are not backend selectors. MAS, MAG, and RCA route to Codex with assistant-scoped skill profiles, each default entry must require its matching Codex skill by default, and each created conversation must carry an App-owned route receipt.
- Ordinary Settings navigation is App-owned. Overview, Runtime, Capabilities, Access, Appearance, System, and About are the visible tabs; legacy model/agent/assistants/skills-hub/tools/display/webui/pet routes must redirect to App-owned pages instead of becoming normal user paths.
- GUI behavior changes must land first in App-owned contracts, docs, page-state tests, and release gates. Shell implementation follows those App-owned boundaries.
- App install/exposure policy keeps `skill` as the public semantic ABI. Codex App plugins may package MAS/MAG/RCA skills, but plugin packaging must not create second semantics or duplicate bare `~/.codex/skills/{mas,mag,rca}` mirrors.
- Companion skill sync is separate from family domain plugin surfaces. `default_packaged_codex_skill_ids` is the App-level whitelist for default packaged and default visible skills, regardless of whether a candidate comes from AionUI builtin assets, Skills Manager, Codex local skills, or plugin payloads. Shared skills such as Superpowers, cron, the OfficeCLI family, PDF, MinerU, and UI/UX helpers may sync to user skill discovery paths; MAS/MAG/RCA stay plugin-visible domain routes, and OPL Meta Agent stays an OPL-generated surface outside the default home assistant list through `packaged_not_default_visible_codex_skill_ids`.
- The App repo owns the GUI runtime bridge contract; OPL owns the runtime/app CLI protocol; the active shell only implements the replaceable adapter.
- `opl app state --profile fast --json` is the default GUI state and refresh source; `opl app state --profile full --json` is explicit full-state diagnostic or release-evidence state; `opl app action execute --action <id> [--payload <json>] [--dry-run] --json` is the App mutation boundary.
- `opl runtime app-operator-drilldown --detail full --json` is only the runtime/Operator full drilldown exception.
- The App must not own OPL runtime truth, provider implementation, domain truth, domain quality verdicts, memory body, artifact body, artifact authority, or owner receipt authority.
- `shells/aionui/` remains an external checkout of `gaofeng21cn/opl-aion-shell`; this repo must not merge or vendor AionUI history into the App default branch.
- Future GUI shell candidates are declared in `contracts/app-shell-candidates.json`; selectable candidates also get their own repo-relative adapter contract under `contracts/shell-adapters/`. The default release shell remains `contracts/app-shell-adapter.json`; explicit candidate builds must set `OPL_APP_SHELL_ADAPTER_CONTRACT`, compile a launchable `.app` bundle manifest, and must not change stable/nightly release gates or updater metadata. A candidate becomes the default release shell only after `contracts/app-shell-adapter.json` is changed deliberately and the App shell adapter, product profile sync, page-state/first-run matrices, active-shell validation, GUI package compile, and external checkout history policy all pass.
- Standard updater assets and Full first-install assets stay separate. Updater metadata must not select assets whose names include `Full`.
- First-run Core ready can use bundled runtime payloads; repo sync, module reconcile, CLT installation, companion skills, and ecosystem module updates remain background maintenance after Core ready.
- App page-state behavior must consume framework-owned read models and refs-only action routes; it must not infer domain ready, production ready, quality verdict, release ready, or artifact authority from provider completion or UI rendering alone.
- App docs are human-readable navigation and product guidance. Machine decisions must use contracts, source, release artifacts, updater metadata, and test outputs.

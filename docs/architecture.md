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

`contracts/app-gui-product-contract.json` is the canonical App-owned GUI product contract. It covers the Codex CLI fixed executor experience, hidden home and ordinary-conversation backend/model/permission selectors, a compact automatic Codex model status label, purpose-first home entries for Research/MAS, Grant/MAG, and PPT/RCA, assistant-scoped skill profiles for those entries, the required built-in assistant route receipt, the home prompt, Settings System/Runtime/About/Update/Theme behavior, ordinary Settings tabs, first-launch `ready_to_launch` before `/guid`, module path source explanation, release stable/nightly gates, MDS retirement from default display, and the OPL Agent Codex context shown in Settings. OMA remains available through explicit/settings surfaces, but it is not a default home entry. `contracts/app-install-exposure-policy.json` owns the App-facing install/exposure policy: `skill` is the public semantic ABI, Codex App plugins are distribution/capability bundles, and CLI/App/direct skill paths must converge on the same domain-owned action/stage metadata. `contracts/app-runtime-bridge.json` is the App-owned bridge contract that binds a replaceable shell adapter to OPL-owned CLI state/action/drilldown surfaces. `contracts/app-product-profile.json` carries desktop session defaults, visible companion skills, first-run Core readiness, Full readiness/background maintenance behavior, Settings presentation policy, legacy settings route redirects, install exposure refs, assistant skill profile data, route receipt policy, and generated shell profile data. `contracts/app-page-state-matrix.json` and `contracts/app-first-run-test-matrix.json` define page-state and first-run expectations.

Home entry ownership is split deliberately for GUI replacement. The App contract owns `home_purpose_entries` as the user-facing click targets and labels, while `default_assistants` are implementation targets for those entries. Shells render the purpose entries, route to the target assistant ids, and persist the App-owned route receipt fields for MAS/MAG/RCA. They do not decide which assistants are default, what labels they use, whether OMA appears on the home screen, or whether the route is exposed as a backend selector.

Assistant skill ownership is similarly App-owned. `assistant_skill_profiles` defines the required Codex skill that makes each home assistant do domain work: MAS requires `mas`, MAG requires `mag`, and RCA requires `rca`. `companion_payloads.default_packaged_codex_skill_ids` is the App-level default package whitelist: only skills in that list are default packaged and default visible, independent of whether a candidate originated in AionUI builtin assets, Skills Manager, a Codex local skill, or a plugin payload. `packaged_not_default_visible_codex_skill_ids` carries explicit-only packaged skills such as OMA. Optional companion skills are visible only within the selected assistant's home skill menu. `cron` is a default packaged global capability, but stays out of MAS/MAG/RCA assistant-scoped home skill menus; AionUI-specific internal skills such as `aionui-skills`, `aionui-webui-setup`, and `skill-creator` stay out of the home path. The global skill hub remains a Settings/Capabilities surface, not the normal home input menu.

The home executor boundary is intentionally narrower than upstream AionUI. The App is a Codex CLI wrapper with built-in OPL assistants, not a general multi-backend agent launcher. Active shells may retain upstream AionUI agent/backend settings for development or diagnostics, but the App home path and ordinary Codex conversation path must not surface Aion CLI, Claude Code, backend switching, model override lists, or permission-mode choices as normal user controls.

The Settings boundary follows the same split. Ordinary Settings navigation is Overview, Runtime, Capabilities, Access, Appearance, System, and About. Legacy upstream routes for model, agent, assistants, skills-hub, tools, display, webui, and pet redirect to App-owned Runtime, Capabilities, Access, or Appearance pages. The shell can still contain implementation components for diagnostics or redirected sub-content, but those components do not define ordinary App navigation or product authority.

Installation exposure uses separate classes so user-facing defaults do not become install-time duplication. MAS/MAG/RCA are family domain plugin surfaces: they can be default App entries and Codex-visible plugin-packaged skills, but they must not be mirrored into duplicate bare `~/.codex/skills/{mas,mag,rca}` directories. OPL Meta Agent is an OPL-generated Codex surface and remains out of the default home assistant list. App release packaging copies only the declared App packaged skill ids: default packaged skills plus explicit-only packaged skills. The default companion set includes Superpowers, cron, the OfficeCLI family, PDF, MinerU document extraction, and UI/UX helpers. AionUI builtin skills are candidate shell capabilities, not a parallel packaging policy. OPL Framework owns plugin registry refresh and generated surface production, while App release packaging owns only the user-facing policy and payload assembly.

The runtime page contract is display and routing only. It consumes `opl app state --profile fast --json` as the summary source, `opl app state --profile full --json` for explicit refresh, and whitelisted `opl app action execute` routes for operator-selected actions. Full Framework drilldown remains an on-demand exception. Runtime truth, action execution authority, domain verdicts, memory bodies, and artifact bodies remain outside the App.

Live bridge conformance is intentionally opt-in. `validate-active-shell.ts
--quick` validates the App-owned bridge contract by default. When
`OPL_APP_LIVE_CONFORMANCE=1`, `OPL_APP_LIVE_OPL_ROOT` points at a local OPL
Framework checkout, and `OPL_APP_LIVE_ACTION_FIXTURE` names a safe action id,
the same validation runs `./bin/opl app state --profile fast --json`,
`./bin/opl app state --profile full --json`, and `./bin/opl app action execute
--action <fixture> --dry-run --json`. The live check only asserts JSON
availability, fast output below 500KB, and `opl_app_state.v1` schema/surface; it
does not import Framework runtime state or domain truth into the App repo.

The active shell is an external checkout and an implementation carrier. `contracts/app-shell-adapter.json` requires the shell to implement the App GUI contract and declares that upstream AionUI behavior is implementation material only, never App product authority. Root release and validation scripts prepare App-owned payloads and call shell build/test commands, but shell implementation changes belong in `gaofeng21cn/opl-aion-shell` unless the App contract or wrapper itself changes. A future shell can live under `shells/<candidate>`, but it remains a candidate until `contracts/app-shell-adapter.json` declares it, `contracts/app-runtime-bridge.json` remains satisfied, the App product profile syncs into its configured target, App page-state and first-run matrices pass, App-root active-shell validation passes, GUI package compile succeeds through the App wrapper, and the external checkout history policy is preserved.

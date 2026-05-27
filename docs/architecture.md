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

The App owns desktop packaging, update flow, first-run product behavior, release evidence collection, user guides, screenshots, GUI product truth, page-state tests, and stable/nightly release gates. OPL Framework owns stage runtime, provider management, queue/attempt ledger, generated surfaces, action execution, runtime read models, and operator projections. Domain agents own their own truth, quality/export verdicts, memory body, artifact body, owner receipts, and typed blockers.

`contracts/app-gui-product-contract.json` is the canonical App-owned GUI product contract. It covers the Codex-only default executor experience, MAS/MAG/RCA/OMA default assistant entries, the home prompt, Settings System/Runtime/About/Update/Theme behavior, module path source explanation, release stable/nightly gates, MDS retirement from default display, and the OPL Agent Codex context shown in Settings. `contracts/app-runtime-bridge.json` is the App-owned bridge contract that binds a replaceable shell adapter to OPL-owned CLI state/action/drilldown surfaces. `contracts/app-product-profile.json` carries desktop session defaults, visible companion skills, first-run maintenance behavior, Settings presentation policy, and generated shell profile data. `contracts/app-page-state-matrix.json` and `contracts/app-first-run-test-matrix.json` define page-state and first-run expectations.

The runtime page contract is display and routing only. It consumes `opl app state --profile fast --json` as the summary source, `opl app state --profile full --json` for explicit refresh, and whitelisted `opl app action execute` routes for operator-selected actions. Full Framework drilldown remains an on-demand exception. Runtime truth, action execution authority, domain verdicts, memory bodies, and artifact bodies remain outside the App.

The active shell is an external checkout and an implementation carrier. `contracts/app-shell-adapter.json` requires the shell to implement the App GUI contract and declares that upstream AionUI behavior is implementation material only, never App product authority. Root release and validation scripts prepare App-owned payloads and call shell build/test commands, but shell implementation changes belong in `gaofeng21cn/opl-aion-shell` unless the App contract or wrapper itself changes. A future shell can live under `shells/<candidate>`, but it remains a candidate until `contracts/app-shell-adapter.json` declares it, `contracts/app-runtime-bridge.json` remains satisfied, the App product profile syncs into its configured target, App page-state and first-run matrices pass, App-root active-shell validation passes, GUI package compile succeeds through the App wrapper, and the external checkout history policy is preserved.

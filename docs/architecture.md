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

The App owns desktop packaging, update flow, first-run product behavior, release evidence collection, user guides, screenshots, and page-state tests. OPL Framework owns stage runtime, provider management, queue/attempt ledger, generated surfaces, action execution, runtime read models, and operator projections. Domain agents own their own truth, quality/export verdicts, memory body, artifact body, owner receipts, and typed blockers.

`contracts/app-product-profile.json` is the App-owned machine source for desktop session defaults, visible companion skills, first-run maintenance behavior, and Settings presentation policy. `contracts/app-page-state-matrix.json` and `contracts/app-first-run-test-matrix.json` define page-state and first-run expectations.

The runtime page contract is display and routing only. It consumes framework-owned runtime projections for the multi-task base view, action queue, vertical dynamic map, single-task drilldown, and safe action routes; it consumes MAS paper lens as domain-owned refs. Summary data is the default surface, full detail loads on demand, and 5-10 second lightweight polling is only a fallback when push projection is unavailable. Runtime truth, action execution authority, domain verdicts, memory bodies, and artifact bodies remain outside the App.

The active shell is an external checkout. Root release and validation scripts prepare App-owned payloads and call shell build/test commands, but shell implementation changes belong in `gaofeng21cn/opl-aion-shell` unless the App contract or wrapper itself changes.

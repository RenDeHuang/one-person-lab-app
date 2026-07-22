# App maintenance complexity boundary

Owner: `one-person-lab-app`
Purpose: `maintenance_complexity_boundary_and_cleanup_ledger`
State: `active_support`
Machine boundary: This document is the human-readable reopening guard and the
single active ledger for cleanup scope, risk order, and execution state. Current
behavior belongs to App contracts, source, tests, validators, release artifacts,
and the selected shell adapter; this ledger does not authorize product or
implementation retirement by itself.

## Current conclusion

The dated 2026-07-10 cleanup tranche is complete. Its scope and verification are archived in
[`2026-07-10-over-engineering-cleanup.md`](../history/process/2026-07-10-over-engineering-cleanup.md).
The current reduction program is owned and ordered here. Other active plans may
point to a candidate id or report independent Contract / Source / Pixel / Install /
Release evidence, but they must not copy or advance cleanup status. In particular,
[`app-ideal-state-gap-plan.md`](app-ideal-state-gap-plan.md) remains a product-gap
and evidence-axis index, not a second cleanup ledger.

Each tranche must start from a current owner surface, a real consumer, and a
focused behavioral failure or maintenance cost. The governing rule is to inherit
AionUI/AionCore official capability by default, preserve explicitly required OPL
product results, and remove only unauthorized cuts, private substitutes, duplicate
authority, or implementation-literal gates. An App allowlist governs only its
declared surface; it cannot disable unrelated upstream capability. A complex
feature absent upstream is not privately rebuilt unless a protected B0/R1/U1
result requires it. A defect confined to Team, another rejected surface, or
retired/private legacy does not enter the ordinary product repair line.

The GUI role boundary remains fixed: AionUI is active,
`opl-native-workbench` is the foreground alternative, Hermes is retained, and
AGUI is archived technical proof. Documentation cleanup cannot change those
roles, remove their owner contracts, or claim adoption, release readiness, or
retirement.

## Current risk boundaries

| Surface | Why broad cleanup is unsafe | Reopening gate |
| --- | --- | --- |
| App product, page-state, release, install-exposure, shell-adapter, and first-run contracts | These contracts encode product and release truth rather than duplicate prose. | Name the replacement owner for every removed requirement and prove the same behavior through focused validation and readback. |
| Carrier-neutral `B0 / R1 / U1 / X0` product model | A carrier-specific simplification can silently remove a required B0/R1/U1 user result or promote an X0 surface into routine maintenance. | Preserve the shell-neutral feature owner and show the affected carrier's contract/source evidence separately; X0 classification is not delete authority. |
| Upstream official baseline | Treating an OPL allowlist or a missing OPL-specific entry as global disable authority creates silent upstream regressions and permanent fork work. | Classify each delta as inherit, thin adapt, explicit contract cut, or protected OPL addition. Team is an explicit cut; configured user/third-party MCP is inherited after the Team/internal negative filter. |
| OPL Package ecosystem and lifecycle | Treating OPL Packages as GUI duplication would remove an ecosystem that remains necessary without any App or GUI. | Preserve discovery, install, update, repair, enable/disable, show/hide, uninstall, managed Codex materialization, receipts, and terminal readback. Framework remains lifecycle authority; App and Shell may only remove duplicate parsers, verdicts, state machines, and copied identity/version truth after a compatibility migration. |
| AI-first Agent activation | Replacing `ready / degraded / package_unavailable` with one global readiness gate would turn a maintenance cleanup into a product regression. | Preserve owner-projected repair, JIT prepare, safe degradation/fallback, and only the local identity/version/entrypoint/safe-target/permission fail-closed gates. |
| Active-shell and release validators | Their structure carries fail-closed product, packaging, and evidence semantics. | Isolate one rule and preserve its failure mode, stdout/stderr/status behavior, and file-write effects in focused tests. |
| Command, JSON, timing, and destructive-cleanup helpers | Similar-looking helpers intentionally differ in parsing, capture, fallback, timing, and dry-run/apply behavior. | Share an abstraction only inside one behaviorally equivalent caller group with regression coverage. |
| Storage owner projections | A generic Docker image/container/volume/build-cache cockpit would create a second operations surface and permanent Docker-specific maintenance cost. | Keep only Agent Package store and WebUI data volume owner projections. Package lifecycle stays in Agents; WebUI cleanup is conditionally carrier-host executed through one authenticated plan/execute/restore ABI. Missing capability stays status-only and fail-open; Shell must not add a filesystem scanner, raw-path deletion IPC, or generic prune path. |
| Shell alternatives and historical carriers | Their role, replay, package, and release participation are owner-controlled. | Require an explicit role decision and matching contract, validator, source, package, and evidence changes; prose alone is insufficient. |
| Codex subagents and AionUI Team | Team is a separate upstream collaboration product and remains disabled in the ordinary App. Codex subagents are real delegated execution and must not be erased with Team or expanded into a second orchestration product. | Keep the upstream Team body intact, hidden, and covered by no-resurrection tests. Start from a real `codex-acp` delegated-turn fixture; add only thin metadata/display adaptation after proving the existing App Server adapter cannot represent the required state. Do not add a second App Server client, Team store, scheduler, or shell-owned execution authority. |
| Upstream Markdown compiler / render pipeline | The large pipeline includes parsing, sanitization, Shadow DOM, code, Mermaid, KaTeX, preview, export, and accessibility behavior. A line-count target is not evidence that the whole pipeline is unused. | Allow only narrow rule-level shrink with focused renderer/security/accessibility tests. Do not treat a roughly 12k-line aggregate deletion as an authorized cleanup package, and never delete upstream fork body from App governance. |
| Release, pixel, install, and production evidence | Source/tests or docs compression cannot substitute for exact-cohort artifacts and installed readback. | Keep each evidence axis explicit and close it only through its owning release or verification surface. |

## Ordered machine-cleanup candidates

This table is the only cleanup execution ledger. It is sorted by regression and
authority-migration risk, not by how quickly a deletion can be made. A high-risk
candidate normally waits for more prerequisites. Its state must not be used to
infer Pixel, Install, Release, or adoption evidence, and X0 classification alone
is never delete authority.

| Risk order | Candidate | Current state | Safe boundary and acceptance |
| --- | --- | --- | --- |
| 1 - high (`A1`) | OPL Package duplicate-authority consolidation | Blocked: a canonical Framework `launch_state`, versioned schema, and exact owner fixture are not yet on Framework `main`. No App/Shell deletion is authorized in the current tranche. | Follow the four-stage compatibility sequence below. Preserve the entire OPL Package ecosystem and user lifecycle; delete only duplicate App/Shell classification, recovery, parsing, version, fixture, and identity authority after exact canonical readback. |
| 2 - high (`A2`) | Existing-conversation Agent rebind transaction pruning | Completed/readback-proven: retained consumer count is zero; canonical Shell removed the private rebind UI, IPC, and owner projection; Framework and bundled/reachable AionCore expose no rebind API. | Existing conversations keep their Agent identity. Agent selection applies only before the first send or to a new conversation. Remove private rebind API, WAL/CAS/TOCTOU/database transaction and recovery machinery only after proving no retained path consumes them; do not replace them with another App state machine. |
| 3 - medium (`A3`) | Waiting `StartupGate` removal | Source implemented: canonical Shell enters `/guid` directly and hydrates local state in the background. The exact-installed-build `<=1500 ms` target remains unverified and is not an SLA. | Mount a usable Guid composer without waiting for fast App state. Hydrate allowlisted state and managed-agent discovery in the background; failures stay local. `<=1500 ms` is an exact-installed-build target from OS launch request to a visible, enabled, focusable composer, not a source-test result or SLA. Preserve explicit `/first-run` and startup-failure support. |
| 4 - medium (`P1a`) | X0-01 Runtime default-gate and optional-detail pruning | App Contract is aligned and the retained Runtime route is Source implemented; later evidence axes remain independent. | Preserve the Framework Work Item producer and optional AionUI route, keep route-specific checks in `validate:runtime-route`, and exclude Runtime from B0/R1/U1, P0, default release/design-system gates, and Native phase-1 parity. Treat `opl_app.domain_detail_views.v2` separately as an optional enhancement: absence hides only dependent detail and never fails App activation or Runtime core. |
| 5 - medium (`P1c`) | X0-05 private cross-thread pruning | App machine truth and Native Source implement the intended boundary; later evidence axes remain independent. | Preserve one App Server directory/user-action adapter, standard thread lifecycle, and read-only Codex subagent metadata/source kinds/thread items. Keep the private host, model-triggered tools, OPL queue, ledger/receipts, advisory/idempotency, and cross-host layer absent. |
| 6 - low (`P1b`) | X0-03/X0-04 Workspace/Fabric/HPC/Console literal-gate pruning | App Contract is aligned; carrier evidence remains independently owned. | Optional owner refs appear only with a canonical projection and absent projections create no placeholder. Keep App-owned scheduling, billing, credentials, storage execution, and provider truth absent. |
| 7 - low (`M1`) | Alternative-carrier default-gate decoupling | Implemented: default scope is `role_registry_only`; Native detail is explicit; Hermes/AGUI are role tombstones backed by adapters and replay runbooks. | Keep default AionUI/full/release/model-policy/design-system maintenance independent of untouched candidate detail. Preserve explicit candidate validators; do not turn Source validation into Pixel, Install, Release, or adoption evidence. |
| 8 - low (`A4`) | Implementation-literal acceptance pruning | Partially implemented/readback-proven: the three narrow meta-test slices `6a2b617e`, `911128be`, and `4f308343` are absorbed; all remaining literal-gate pruning stays candidate-only, with no bulk test deletion authorized. | Replace source strings, function names, CSS literals, and exact callsite counts as primary acceptance with behavior, accessibility, owner readback, and installed-pixel evidence. Retain only narrow structural smoke checks that detect a real unsupported integration boundary. |
| 9 - low (`A5`) | Hand-copied upstream/version truth pruning | Partially implemented: the first static runtime-version slice `b33e969d` is absorbed; all remaining copied-version cleanup stays candidate-only, and exact source/release locks remain required. | Generate the App-facing projection from the Shell source lock, managed manifest, Framework Release Set, and release receipt. Remove stale intake refs or hand-maintained AionCore/Framework constants only after exact owner refs remain visible and fail closed. |

### `A1` Package authority migration sequence

`A1` is deliberately not executable as one broad deletion. The only valid order is:

1. Framework publishes a versioned candidate canonical `launch_state`, its schema,
   and an exact fixture from the lifecycle owner.
2. App and Shell land a dual-read compatibility bridge that prefers canonical
   `launch_state`, preserves the legacy read long enough for mixed versions, and
   proves identical user-visible lifecycle outcomes.
3. The Framework authority enters canonical `main`; App and Shell verify the exact
   owner ref and terminal readback before tightening consumers.
4. Only then may App/Shell delete their private reason classifier, duplicate
   recovery state machine, manifest parser, hand-maintained Framework SHA,
   non-exact fixture, and duplicate first-party package ids.

This sequence removes duplicate authority, not Package capability. It does not
authorize moving lifecycle ownership into the App, reducing lifecycle verbs, or
folding Package update into the App updater. The current documentation tranche
records the sequence only; it does not perform this cross-repository migration.

## Future slice requirements

Each future cleanup slice must identify one owner surface, its real consumers,
the behavior that remains invariant, one focused command that fails when the
change is wrong, and the evidence axis it does not close. It must update candidate
state here rather than creating another cleanup ledger. If that semantic split
cannot be stated precisely, the candidate remains closed rather than becoming a
broad mechanical refactor. A failure seen only on a rejected or retired private
surface is not a reason to reopen the ordinary product line.

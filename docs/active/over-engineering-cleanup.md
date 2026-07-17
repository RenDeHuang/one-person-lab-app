# App maintenance complexity boundary

Owner: `one-person-lab-app`
Purpose: `maintenance_complexity_boundary`
State: `active_support`
Machine boundary: This document is a human-readable reopening guard. Current
behavior belongs to App contracts, source, tests, validators, release artifacts,
and the selected shell adapter; it does not authorize product or implementation
retirement by itself.

## Current conclusion

The approved cleanup tranche is complete and is not an active work queue. Its
dated scope and verification are archived in
[`2026-07-10-over-engineering-cleanup.md`](../history/process/2026-07-10-over-engineering-cleanup.md).
New cleanup work must start from a current owner surface, a real consumer, and a
focused behavioral failure or maintenance cost.

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
| AI-first Agent activation | Replacing `ready / degraded / package_unavailable` with one global readiness gate would turn a maintenance cleanup into a product regression. | Preserve owner-projected repair, JIT prepare, safe degradation/fallback, and only the local identity/version/entrypoint/safe-target/permission fail-closed gates. |
| Active-shell and release validators | Their structure carries fail-closed product, packaging, and evidence semantics. | Isolate one rule and preserve its failure mode, stdout/stderr/status behavior, and file-write effects in focused tests. |
| Command, JSON, timing, and destructive-cleanup helpers | Similar-looking helpers intentionally differ in parsing, capture, fallback, timing, and dry-run/apply behavior. | Share an abstraction only inside one behaviorally equivalent caller group with regression coverage. |
| Shell alternatives and historical carriers | Their role, replay, package, and release participation are owner-controlled. | Require an explicit role decision and matching contract, validator, source, package, and evidence changes; prose alone is insufficient. |
| Codex subagents and AionUI Team | Team is a separate upstream collaboration product and remains disabled in the ordinary App. Codex subagents are real delegated execution and must not be erased with Team or expanded into a second orchestration product. | Keep the upstream Team body intact, hidden, and covered by no-resurrection tests. Start from a real `codex-acp` delegated-turn fixture; add only thin metadata/display adaptation after proving the existing App Server adapter cannot represent the required state. Do not add a second App Server client, Team store, scheduler, or shell-owned execution authority. |
| Upstream Markdown compiler / render pipeline | The large pipeline includes parsing, sanitization, Shadow DOM, code, Mermaid, KaTeX, preview, export, and accessibility behavior. A line-count target is not evidence that the whole pipeline is unused. | Allow only narrow rule-level shrink with focused renderer/security/accessibility tests. Do not treat a roughly 12k-line aggregate deletion as an authorized cleanup package, and never delete upstream fork body from App governance. |
| Release, pixel, install, and production evidence | Source/tests or docs compression cannot substitute for exact-cohort artifacts and installed readback. | Keep each evidence axis explicit and close it only through its owning release or verification surface. |

## Ordered machine-cleanup candidates

These are docs-only candidates, not authorization to edit machine surfaces in this
tranche:

| Order | Candidate | Safe boundary and acceptance |
| --- | --- | --- |
| P1c | X0-05 private cross-thread pruning | Preserve the single App Server directory/user-action adapter and B0 thread operations. Remove Native candidate hard requirements for private host, dynamic model tools, ledger/receipts, advisory/idempotency, and cross-host parity. Candidate validation must still prove one adapter and no private layer. |
| M1 | Alternative-carrier default-gate decoupling | After P1c, default AionUI/full/release gates keep only minimal fixed-role registry integrity. Native, Hermes, and AGUI detail validation becomes explicit on demand; archived/reference schemas shrink to role tombstones and replay refs. Active AionUI gates must not fail on untouched candidate drift, while `validate:candidate:native` and other explicit replay commands remain functional. |

## Future slice requirements

Each future cleanup slice must identify one owner surface, its real consumers,
the behavior that remains invariant, one focused command that fails when the
change is wrong, and the evidence axis it does not close. If that semantic split
cannot be stated precisely, the candidate remains closed rather than becoming a
broad mechanical refactor.

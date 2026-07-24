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

The 2026-07-24 follow-up supersedes the earlier “one Framework resolver plus
installed lock” target. Preserve the Package ecosystem and all user outcomes,
but delegate Package bytes and lifecycle to Codex Plugin Manager, Git, OS
package managers, or other native platforms. Framework should retain only thin
adapters, installed discovery, required-presence/callability checks, status
aggregation, and Agent/Temporal Runtime join. Version/ABI resolution, lock,
payload, receipt, LKG, materialization, rollback machinery, fixed Package/Agent/
Skill/Tool/Plugin lists, and copied domain schemas are migration debt, not
protected Package capability.

The App has one Official Profile for first install and explicit restore. Standard
and Full consume the same roots; Full adds offline seed only. The Profile is not
a continuous desired-state controller, so user removal persists. Detailed
functionality-equivalence, phase, and deletion gates live only in
[`opl-package-platform-composition-migration.md`](opl-package-platform-composition-migration.md).
This ledger owns cleanup state; that plan owns the target sequence.

Package identity, carrier, and executor are separate. First-party owners keep
independent GHCR publication and advance only their own `latest-stable`. Base
retains a thin OCI download adapter; Codex owns Plugin/config/cache activation,
while Package-declared carrier/runtime activation and fresh aggregate readback remain
mandatory. Codex Plugin Manager is therefore one carrier adapter, not Package
identity, complete installed truth, or ecosystem authority. Executor changes
must not reinstall Packages or discard preferences, tasks, dependencies, or
typed views.

This is a target and migration boundary, not a landed claim. Legacy writers stay
until their consumers have moved to the minimum native-backed projection, then
must be deleted rather than retained as fallback. Live proof still includes App
Stable/Latest, WebUI `:stable`, same-profile Standard/Full install, user-removal
persistence, independent Package update, dynamic Agent Runtime, and legacy
zero-consumer/removal.

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
| OPL Package ecosystem and lifecycle | Treating OPL Packages as GUI duplication would remove an ecosystem that remains necessary without any App or GUI. | Preserve install, installed discovery, independent silent update, enable/disable, show/hide, uninstall, dependency presence, Home shortcut, Agent task status, typed views, and fresh terminal readback. Platform-native managers own bytes; Framework is a thin adapter/aggregator. Custom resolver/lock/payload/receipt/LKG/materialization/rollback state is removable after functional equivalence. |
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
| 1 - high (`A1`) | Native Package lifecycle migration and old authority removal | **Target/planned:** current Framework resolver/lock/receipt/materialization path remains active compatibility truth. No native-backed minimum projection or zero-consumer deletion proof exists yet. | Migrate by platform adapter -> installed discovery/presence projection -> consumer switch -> old writer deletion. Preserve the functionality-equivalence matrix; do not create a smaller custom Package manager as the destination. |
| 2 - high (`A6`) | One Official Profile and fixed-composition removal | **Target/planned:** open-composition work removed some fixed-count/Release Set gates, but App starter metadata and Full/first-run compatibility lists remain. | Standard/Full use the same first-install roots; Full adds offline seed. User removal persists until explicit Restore. Delete fixed seven/count/dual-list gates after clean-install and removal proofs. |
| 3 - high (`A7`) | GHCR currentness and carrier migration | **Target/planned:** independent Package GHCR `latest-stable` pointers exist, but ordinary currentness still reads the shared Release Set bridge and Framework still owns resolver/lock state. | First-party owner `latest-stable` is publication current stable; Base OCI is a thin download/verification adapter; Codex owns Plugin/config/cache; Package-declared carrier/runtime activation and Framework aggregate readback remain. Remove the shared manifest from ordinary updates and all OPL lifecycle state only after the active migration plan's terminal proofs. |
| 4 - high (`A2`) | Existing-conversation Agent rebind transaction pruning | Completed/readback-proven: retained consumer count is zero; canonical Shell removed the private rebind UI, IPC, and owner projection; Framework and bundled/reachable AionCore expose no rebind API. | Existing conversations keep their Agent identity. Agent selection applies only before the first send or to a new conversation. Remove private rebind API, WAL/CAS/TOCTOU/database transaction and recovery machinery only after proving no retained path consumes them; do not replace them with another App state machine. |
| 5 - medium (`A3`) | Waiting `StartupGate` removal | Source implemented: canonical Shell enters `/guid` directly and hydrates local state in the background. The exact-installed-build `<=1500 ms` target remains unverified and is not an SLA. | Mount a usable Guid composer without waiting for fast App state. Hydrate allowlisted state and managed-agent discovery in the background; failures stay local. `<=1500 ms` is an exact-installed-build target from OS launch request to a visible, enabled, focusable composer, not a source-test result or SLA. Preserve explicit `/first-run` and startup-failure support. |
| 6 - medium (`A8`) | Carrier/channel/cadence simplification | Source tranche landed locally: App Standard and WebUI are independently qualified carriers, legacy desktop aliases are absent, and Framework Daily is reconciliation-only. Live Stable/Latest, WebUI `:stable`, and single-Package terminal proofs remain pending. | Keep Stable as release policy, Docker/WebUI/Homebrew as carriers, Full as an exact snapshot, and Daily as cadence/index reconciliation. Public Nightly is retired and read-only; Canary is a separate validation-only schedule, not a release channel. Do not call the source change release-ready until each retained carrier has exact public readback. |
| 7 - medium (`P1a`) | Dynamic Agent Runtime promotion | **Target/planned:** current optional `X0-01` WorkItem route is a compatibility bridge. It still copies fixed Agent scope/availability and MAS-specific view schema. | Promote Runtime to a core dynamic Agent task surface. Agent owns business lifecycle, Temporal owns execution, Framework joins, App renders by generic fields/`view_kind`. Delete fixed ids, optional-route gate, and MAS schema only after new producer/consumer/installed proofs. |
| 8 - medium (`P1c`) | X0-05 private cross-thread pruning | App machine truth and Native Source implement the intended boundary; later evidence axes remain independent. | Preserve one App Server directory/user-action adapter, standard thread lifecycle, and read-only Codex subagent metadata/source kinds/thread items. Keep the private host, model-triggered tools, OPL queue, ledger/receipts, advisory/idempotency, and cross-host layer absent. |
| 9 - low (`P1b`) | X0-03/X0-04 Workspace/Fabric/HPC/Console literal-gate pruning | App Contract is aligned; carrier evidence remains independently owned. | Optional owner refs appear only with a canonical projection and absent projections create no placeholder. Keep App-owned scheduling, billing, credentials, storage execution, and provider truth absent. |
| 10 - low (`M1`) | Alternative-carrier default-gate decoupling | Implemented: default scope is `role_registry_only`; Native detail is explicit; Hermes/AGUI are role tombstones backed by adapters and replay runbooks. | Keep default AionUI/full/release/model-policy/design-system maintenance independent of untouched candidate detail. Preserve explicit candidate validators; do not turn Source validation into Pixel, Install, Release, or adoption evidence. |
| 11 - low (`A4`) | Implementation-literal acceptance pruning | Partially implemented/readback-proven: the three narrow meta-test slices `6a2b617e`, `911128be`, and `4f308343` are absorbed; all remaining literal-gate pruning stays candidate-only, with no bulk test deletion authorized. | Replace source strings, function names, CSS literals, and exact callsite counts as primary acceptance with behavior, accessibility, owner readback, and installed-pixel evidence. Retain only narrow structural smoke checks that detect a real unsupported integration boundary. |
| 12 - low (`A5`) | Hand-copied upstream/version truth pruning | Partially implemented: the first static runtime-version slice `b33e969d` is absorbed; all remaining copied-version cleanup stays candidate-only. Exact refs remain required only for bytes already installed, qualified, or built, never as a composition prerequisite. | Generate App-facing projections from owner manifests and Framework state. Record exact source refs in the operation or artifact that actually selected them; do not require a family Release Set or pre-existing lock. |

### `A1` Package authority migration sequence

`A1` is deliberately not executable as one broad deletion. The valid order is:

1. Prove one native platform adapter with minimum Package/capability descriptor,
   installed discovery, presence/callability, and terminal actions.
2. Framework publishes one executor-neutral aggregate projection with no
   version/ABI/lock/payload/digest/receipt composition fields. Carrier readback
   and executor route readiness remain separate.
3. App and Shell dual-read that projection and prove all functional outcomes
   in the migration plan, including user-removal persistence and dynamic Runtime.
4. Each Package owner enters canonical `main`, followed by Framework authority,
   then App/Shell consumers; incompatible changes use a compatibility bridge.
5. Verify retained consumers are zero, then delete old resolver, lock, payload,
   receipt, LKG, materialization, rollback writers and App/Shell mirrors.

This sequence removes custom lifecycle machinery, not Package functionality.
The current documentation tranche records the target only; it does not perform
the cross-repository migration.

### `A7` source migration owner

The authoritative A7 sequence, dual-read exit order, Package/carrier/executor
split, and no-regression terminal proofs live only in
[`opl-package-platform-composition-migration.md`](opl-package-platform-composition-migration.md).
This ledger records only that A7 is open. It must not copy a second resolver,
index, receipt, or deletion plan.

## Future slice requirements

Each future cleanup slice must identify one owner surface, its real consumers,
the behavior that remains invariant, one focused command that fails when the
change is wrong, and the evidence axis it does not close. It must update candidate
state here rather than creating another cleanup ledger. If that semantic split
cannot be stated precisely, the candidate remains closed rather than becoming a
broad mechanical refactor. A failure seen only on a rejected or retired private
surface is not a reason to reopen the ordinary product line.

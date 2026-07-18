# Stable Release Control-Plane RCA - 2026-07-18

Owner: `one-person-lab-app`
Status: `remediation_in_progress_release_blocked`
Severity: `SEV-1 delivery_control_plane`
Affected channel: `Stable`
Evidence cutoff: `2026-07-18`

## Executive Conclusion

The primary root cause was not a slow test or one unreliable runner. Stable
release execution was not enforced as one immutable, resumable transaction.
Instead, a long interactive task manually coordinated independently mutable
workflows, run discovery, retries, cancellation, qualification, promotion, and
closeout. The repository had useful checks, but the credential boundary still
allowed a normal Codex session to bypass the intended release owner and mutate
GitHub Actions directly.

This design made duplicate or conflicting attempts possible, lost exact run
identity across handoffs, rebuilt work that should have been reconciled, and
turned a bounded release into an open-ended debugging session. The 90-minute
target was advisory rather than a machine circuit breaker.

The code in the recovery worktree is a remediation candidate, not completion
proof. No successor Stable release may start until the external broker and
credential isolation are provisioned and all P0 fail-closed gaps are validated.

## Incident And Impact

Two Codex tasks exposed different parts of the same control-plane failure:

| Evidence source | Observed facts |
| --- | --- |
| `019f642d-dc53-71c0-a260-bb8be1e7b80d`, full release window | The Stable target was fixed at `2026-07-15T14:18:49Z`. The first dispatch came `4h16m48.842s` later, and the last VM failure came `67h36m50.842s` after target fixation. The task repeatedly rebuilt and reinstalled moving App/Shell/Framework cohorts, but never executed canonical `release:stable promote --execute` or `complete-local`. |
| `019f642d-dc53-71c0-a260-bb8be1e7b80d`, focused coordination range `35501-39317` | About 14 hours 21 minutes; 415 custom tool calls; 200 `wait_agent` calls, of which 179 timed out; five context compactions; zero executions of the canonical `release:stable start`, `promote`, or `complete-local` commands in that range. |
| `019f6df2-d308-7f52-81e3-b0a5eeb1436e`, supervisory RCA window | The conversation became a shadow scheduler: one audited interval alone contained 75 `wait_agent` calls, 68 timeouts, repeated process/status reads, and about 30 route messages. It did not own a durable release transition and could not take over after interruption. |
| GitHub live run history for `v26.7.18` | Across `10h30m15s`, 12 Desktop Release runs spanned five refs and four App SHAs: 5 failures, 7 cancellations, 0 successes, and about `8h40m10s` of aggregate run wall time. |

The windows may overlap and must not be added together as a total duration.
They show that both the execution task and its supervisory task spent hours
operating around the release controller rather than reaching a terminal release
receipt through it.

### Where the expected 90 minutes went

| Expected bounded behavior | Actual behavior | Delivery effect |
| --- | --- | --- |
| Freeze one admitted cohort before the clock starts | App, Shell, Framework, controller, and visual expectations kept moving during builds and VM runs | Expensive green evidence became stale and candidates were rebuilt or reinstalled. |
| One brokered dispatch with exact run identity | Multiple refs and App SHAs were dispatched, cancelled, or rerun through a shared write-capable OAuth identity | 12 runs consumed over eight hours of aggregate runner time without a success. |
| Resume failed nodes from receipts | Passed Standard/Docker/build work was discarded when later gates failed or evidence readback was uncertain | Broad trains repeated instead of reconciling the exact attempt. |
| Stop new broad work at `90:00` | The deadline was advisory and each newly discovered product, fixture, environment, or verifier issue extended the same task | A 90-minute release became a `67h36m50s` open-ended repair session. |
| One durable controller that survives handoff | Two conversations polled, routed ownership, and reconstructed state from chat history | Context compaction and task interruption lost operational continuity. |

At the evidence cutoff:

- the public GitHub Latest release was still `v26.7.12`;
- `v26.7.18` was still a draft;
- no same-cohort terminal Stable proof existed for `v26.7.18`.

Therefore the user-visible outcome was no new Stable release despite multiple
days of engineering and workflow activity. Failed, cancelled, queued, or empty
workflow state is not release completion.

## Root Cause

### Primary root cause: authority was conversational, not transactional

There was no credential-enforced, globally serialized Stable saga with one
durable identity from candidate freeze through installed-path readback. The
release was assembled through low-level dispatch, polling, cancellation,
diagnosis, and rerun decisions made across long-lived conversations.

The missing enforcement boundary had four direct consequences:

1. More than one actor could dispatch, cancel, or rerun release work for the
   same channel and version.
2. Local state could not prove whether an external mutation was accepted before
   a timeout, interruption, or context handoff.
3. A controller revision, an artifact App SHA, and a discovered GitHub run could
   drift independently while still looking superficially related.
4. The operator had no mandatory terminal transition at 90 minutes, so each new
   failure extended the same release attempt indefinitely.

The correct control point is the mutation credential, not a prompt, document,
lock file, workflow concurrency group, or protected environment alone.

## Contributing Factors

### Candidate and identity drift

- Candidate, toolchain, and dependency inputs were not frozen once and carried
  through every gate as an immutable qualification manifest.
- Controller workflow SHA and artifact App SHA were treated as one axis even
  though the controller may advance without changing already-built bytes.
- Time-window or "latest run" discovery could attach the controller to the
  wrong run instead of an exact broker-returned numeric run ID.
- Calendar rollover and manually handled refs increased the chance of version
  or SHA mismatch during a long attempt.

### Retry and recovery were too broad

- A failed expensive gate could trigger a new build-and-release train instead
  of classification followed by same-artifact recovery.
- Environment contamination and repeated Electron/AionHub downloads were paid
  again because the execution environment and resolved toolchain inputs were
  not fully hermetic.
- Standard, Full, Docker/WebUI, VM, distribution, and local activation were
  treated as one long completion boundary even when their ownership and failure
  semantics differ.
- Cancellation and rerun were available as low-level operator actions rather
  than separately authorized, idempotent saga transitions.

### Terminal truth was inferred

- Closeout logic could infer `ready_to_promote` or `published` from preflight,
  remote shape, or source-run heuristics rather than an exact canonical session
  plus promotion-saga receipt.
- Product semantics and `/Applications/One Person Lab.app` installed-path QA
  arrived too late. A packaged build or screenshot cannot prove the actual
  installed user path.
- Partial closeout evidence could be replaced non-atomically, allowing mixed
  generations or missing artifacts to affect operator interpretation.

### Interactive monitoring became the scheduler

- Repeated polling, 179 wait timeouts in one evidence range, and five context
  compactions consumed attention without advancing remote execution.
- Context handoff had to reconstruct state from task history because there was
  no single durable receipt ledger that could resume independently of a chat.
- The release task remained active during transport uncertainty instead of
  reconciling once and returning a typed state.

## Why Green Tests Did Not Close The Release

A fresh local release-boundary run reported 446 tests: 444 passed, 0 failed,
and 2 skipped. That is useful implementation evidence, but it cannot prove any
of the following external facts:

- the candidate code was absorbed into canonical `main` and is the workflow
  revision actually executing remotely;
- the normal Codex credential is read-only for GitHub Actions mutations;
- the isolated release broker, signing key, caller admission, and global
  idempotency ledger are provisioned;
- a broker accepted one exact mutation and returned the exact GitHub run ID;
- the exact candidate bytes passed remote verification and installed-path QA;
- the promotion saga published a non-draft Latest release and synchronized its
  distribution receipts;
- `/Applications/One Person Lab.app` was activated from those exact bytes and
  produced the required live readback.

Tests, dry runs, draft assets, candidate records, and local packaged builds are
different evidence classes. None may be promoted to release truth without the
corresponding live receipt.

## Stable SLO And Circuit Breaker

### Clock definition

The 90-minute SLO covers the Standard Stable critical path.

- **Start:** the canonical `release:stable start --execute` invocation
  atomically creates the create-if-absent Stable session and freezes the
  version, cohort, controller revision, artifact inputs, and attempt identity.
  The clock starts at `session_started_at`, before any external mutation.
- **Successful end:** the session reaches `standard_stable_terminal` from exact
  receipts for Standard artifact qualification, publication/readback,
  distribution, Latest activation, and `/Applications` local activation/live
  readback.
- **Blocked end:** the controller records a typed terminal blocker. This is an
  operationally bounded outcome, not an SLO success and not a published release.
- **Not an end:** test green, workflow success without bound receipts, draft
  publication, queue empty, candidate creation, or a closeout heuristic.

Full and Docker/WebUI are same-cohort add-ons with independent terminal
receipts. Each add-on clock starts when the broker accepts its independent
dispatch, targets 35-50 minutes, and cannot block, revoke, or reopen Standard
Stable.

### Stage budget

| Elapsed budget | Required stage | Stop condition |
| --- | --- | --- |
| `0-5 min` | Broker/credential admission, session create-if-absent, immutable cohort freeze | Any missing authority, secret isolation, ref, or conflicting session returns a typed blocker before dispatch. |
| `5-15 min` | Deduplicated preflight and source gates; broker dispatch returns exact run ID | No expensive build starts if source or environment admission fails. |
| `15-50 min` | One Standard build, draft publish, checksum/updater metadata, remote verification | Build once per cohort; uncertain dispatch is reconciled, never duplicated. |
| `50-65 min` | Exact-byte Standard clean-install/VM qualification | Fixture/environment failures may use only bounded same-artifact recovery. Product-byte failure requires a new cohort. |
| `65-80 min` | Owner receipt, promotion saga, Standard distribution/Homebrew verification, Latest activation | Every mutation requires a fresh broker acceptance and exact saga receipt. |
| `80-90 min` | `/Applications` activation, nonblank live readback, terminal receipt and final currentness check | Missing exact evidence fails closed; closeout cannot infer success. |

At 60 minutes the controller writes a warning with the current stage, exact
blocker, remaining budget, and legal next action. At 90 minutes the new-release
train circuit opens. It forbids another broad dispatch and permits only one
explicitly bounded same-artifact targeted recovery or a typed blocked terminal
state. A recovery that continues after 90 minutes remains an SLO miss and is
recorded as such; it cannot reset the clock by creating another session.

## Mandatory Machine Invariants

The remediation is acceptable only when all of these are machine-enforced:

1. **One global release identity.** The durable idempotency key is repository,
   channel, and version. The same attempt returns the same receipt; a different
   session or cohort is rejected.
2. **Immutable cohort.** Version, App artifact SHA, Shell SHA, Framework SHA,
   toolchain/qualification inputs, and semantic digests freeze once. Controller
   workflow SHA is recorded separately from artifact App SHA.
3. **Pure planning.** `plan` and every dry run are read-only and create no
   session, lock, dispatch, cancellation, rerun, release, tag, or asset.
4. **Create-if-absent start.** A second `start` for an existing identity routes
   to `status`, `reconcile`, or `resume`; it cannot dispatch another train.
5. **Credential-enforced single writer.** All dispatch, cancel, rerun,
   publication, promotion, and cross-repository distribution mutations go
   through the isolated broker. Normal Codex credentials are read-only.
6. **Durable pre-mutation ledger.** `planned` and `dispatching` are written with
   an exclusive lock and revision CAS before external mutation. Every lease is
   Ed25519-signed, short-lived, single-mutation, and bound to the exact payload,
   attempt, controller SHA, artifact SHA, and planned revision.
7. **Exact run binding.** Broker acceptance includes one non-null numeric GitHub
   run ID, and workflow `run-name` includes the attempt ID. The controller reads
   only that run; time-window and newest-run selection are forbidden.
   Workflow entry obtains that acceptance through a signed, linearizable,
   GitHub-OIDC-authenticated lookup bound to its own run ID, run attempt,
   controller SHA, payload digest, and a fresh challenge. A local-only broker
   executable is not an Actions lookup transport.
8. **Bounded monitor and reconcile.** One absolute-deadline watcher is used.
   Transport retries are bounded to three. Unknown API outcomes reconcile the
   broker ledger and exact run before any new mutation.
9. **Classified recovery.** Every failure is typed before retry. Product or
   runtime byte changes require a new version/cohort. Fixture, environment, or
   infrastructure recovery must reuse exact artifact bytes and has a bounded
   attempt count.
10. **Independent terminals.** Standard terminal truth is independent of Full
    and Docker/WebUI. Each artifact and add-on has its own receipt and debt
    disposition.
11. **Receipt-only terminal authority.** Only the canonical Stable session plus
    exact qualification, promotion, distribution, Latest, and local activation
    receipts can set terminal state. Closeout, preflight, remote-shape checks,
    and docs are diagnostics only.
12. **Atomic evidence generations.** Downloads land in staging, validate against
    one generation identity, and atomically replace prior evidence. A failed
    refresh leaves the last complete generation intact and authorizes no
    mutation.
13. **Hard SLO.** The warning and circuit-breaker transitions are persisted and
    cannot be bypassed by a new conversation, context compaction, manual
    workflow command, or process restart.

## External Broker Provisioning Blocker

The checked-in broker authority currently says
`status=unprovisioned_release_blocking`. Its observed state also says normal
Codex Actions writes remain allowed and the release-broker write token is not
isolated. The executable digest and code-signing identity are unset, and no
trusted Ed25519 public key is installed.

Before any successor Stable mutation, an operator outside this repository must:

1. provision the dedicated GitHub App/bot identity and least-privilege Actions
   mutation token;
2. remove Actions write/cancel/rerun authority from normal Codex credentials;
3. protect canonical `main` and every release-control workflow path so normal
   Codex credentials cannot push around the verifier, and make the broker admit
   only an externally approved controller SHA;
4. install the broker executable at the declared path and record its SHA-256 and
   code-signing identity;
5. keep the broker private key outside the repository, register the trusted
   Ed25519 public key, and enforce authenticated caller admission;
6. provision the durable global idempotency/fencing ledger;
7. expose a read-only HTTPS broker lookup endpoint authenticated with GitHub
   OIDC so each workflow can obtain and verify its post-dispatch exact-run
   acceptance; transport failure, `not_found`, and `outcome_unknown` must all
   block mutation and must never authorize redispatch;
8. emit a fresh credential-isolation receipt proving separate actors and token
   fingerprints, with no same-identity direct API bypass;
9. make every accepted dispatch return the exact numeric GitHub run ID.

Repository tests cannot provision or prove these controls. Until a fresh
readback satisfies every item, release code must fail closed and the current
draft must remain non-Latest.

## Remediation Status And Remaining P0 Work

The recovery worktree contains candidate mechanisms for a v3 Stable session,
revision-CAS atomic state writes, an append-only mutation attempt ledger,
signed broker leases and acceptances, credential-isolation receipts, bounded
monitoring, reconciliation, frozen qualification inputs, a 90-minute breaker,
and independent Standard/add-on terminals.

These mechanisms are not yet authoritative. Before merge or rollout, the
following P0 gaps must be closed and adversarially tested:

- closeout must become diagnostics-only and must never infer
  `ready_to_promote` or `published` from source-run or remote heuristics;
- all planning and dry-run commands must be proven side-effect free;
- broker acceptance must require a non-null exact run ID; controller
  time-window discovery must be removed from every dispatch path;
- cohort planning must emit only the canonical `release:stable start` path, not
  direct `gh workflow run` instructions;
- the contract must state one meaning consistently: `include_full_package` is
  nonblocking add-on intent, not a Standard terminal requirement;
- closeout evidence refresh must use staging, validation, and atomic generation
  replacement.

No local test result, clean diff, commit, or mainline merge may change the
broker blocker to release-ready without external provisioning evidence.

## Validation And Rollout Plan

### 1. Close the local fail-closed implementation

- Add focused tests for dry-run purity, exact run binding, duplicate start,
  revision conflict, stale-lock recovery, dispatch accepted/local write lost,
  partial closeout generation, and diagnostics-only closeout.
- Run typecheck, workflow syntax/actionlint, focused state-machine and failure
  injection tests, and the complete release-boundary suite.
- Perform an independent adversarial review of mutation authority, terminal
  state transitions, and every direct GitHub mutation call site.

### 2. Integrate exact canonical bytes

- Rebase or merge against fresh canonical `main`, resolve contracts as the App
  source of truth, and rerun all validation on final `main` bytes.
- Confirm that release workflows on `main` use the same controller schema and
  cannot call a retired direct mutation path.
- Keep `v26.7.18` quarantined as a draft. Reconcile it read-only; resume only if
  every artifact and receipt binds one exact frozen cohort. If not, use a new
  immutable version rather than overwriting or promoting mixed bytes.

### 3. Provision and prove the external authority boundary

- Read back broker binary identity, trusted key, caller admission, GitHub actor,
  token separation, and global ledger state.
- Verify normal Codex can read workflow/release state but cannot dispatch,
  cancel, rerun, publish, or promote.
- Verify the broker can perform only a lease-bound mutation and returns the
  exact run ID and signed acceptance receipt.

### 4. Run a bounded canary before Stable

Use a non-Latest canary identity and inject controlled failures with a bounded
blast radius:

- submit the same attempt twice and prove there is one external run;
- lose the controller response after broker acceptance and prove `reconcile`
  attaches the exact run without redispatch;
- expose an unrelated newer run and prove it cannot be selected;
- attempt a cross-cohort resume and prove it is rejected;
- interrupt and restart the controller and prove the session resumes from the
  durable ledger;
- exceed the monitor and 90-minute deadlines and prove only targeted recovery
  or typed terminal block remains legal;
- withhold or corrupt a closeout receipt and prove promotion stays forbidden.

### 5. Release and close only on live proof

For the next Stable, record the session SLO artifact and exact receipts for each
stage. Completion requires public non-draft Latest readback, exact assets and
checksums, distribution receipts, `/Applications` process-path and bundle
identity, live health/readback, and final remote currentness. Only then may the
incident status change from remediation in progress to closed.

## Permanent Prevention Rules

- `npm run release:stable` is the only Stable operator entrypoint. Direct
  release `gh workflow run`, `gh run cancel`, and `gh run rerun` commands are
  forbidden outside the isolated broker implementation.
- A conversation is never the scheduler, state store, watcher, or authority.
  It may inspect the canonical session and explain its typed next action.
- Release coordination may use one bounded coordinator and non-overlapping
  implementation writers, but it may not create recursive monitor/audit trees,
  duplicate supervisors, or repeated `wait_agent` polling loops. A handoff reads
  the durable session once, performs one typed reconcile, and either acts on the
  unique legal transition or stops.
- One artifact is built once per cohort. Broad rebuild is allowed only after a
  proven product/runtime byte change creates a new immutable version.
- No low-level retry occurs before failure classification and receipt
  reconciliation.
- Standard and add-on status are always reported separately. Add-on failure is
  debt, not retroactive Standard failure.
- Every release-control change must keep failure-injection coverage for duplicate
  dispatch, lost response, stale state, credential bypass, wrong-run capture,
  partial evidence, timeout, and restart recovery.
- Delivery metrics report full session wall time, cancelled/failed run tax,
  rebuild count, dispatch count, recovery count, and time spent in each stage.
  Reporting only the final successful workflow duration is prohibited.
- A 60-minute warning requires a machine-written blocker and remaining-budget
  report. A 90-minute miss automatically opens the circuit and incident review;
  it cannot be waived silently.
- Terminal claims always cite fresh same-cohort live evidence. Docs, tests,
  plans, candidate assets, and queue state never substitute for release,
  install, or currentness proof.

## Closure Criteria

This incident is closed only when all of the following are true:

1. the remediation is integrated and revalidated on canonical `main`;
2. all P0 gaps above are closed;
3. external broker provisioning and credential-isolation readback pass;
4. branch/ruleset readback proves normal Codex cannot alter the approved release
   controller or its verifier on canonical `main`;
5. a GitHub-hosted canary proves the OIDC lookup returns a fresh signed
   acceptance for only the current exact run and fails closed on unavailable,
   `not_found`, `outcome_unknown`, wrong challenge, wrong attempt, and stale
   proof;
6. the bounded canary proves idempotency, recovery, exact-run binding, timeout,
   and credential denial;
7. one real Stable reaches `standard_stable_terminal` in at most 90 minutes on
   exact live receipts;
8. the public Latest, published assets, distribution, and installed App all
   read back the same release identity.

Until then, the correct status is `remediation_in_progress_release_blocked`, not
`fixed`, `ready`, or `released`.

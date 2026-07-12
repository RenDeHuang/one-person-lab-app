# v26.7.12 Stable Release Overrun

## Incident

- Codex task: `019f51aa-a718-7471-8d4b-5656e18d90d2`
- Release turn start: `2026-07-12 00:32:27 +0800`
- User budget: 90 minutes
- Independent audit point: after 7 hours; the whole task event log then covered almost 9 hours.
- The task was still active rather than blocked on one long-running command.
- At the user's later review point the task had remained open for about 18
  hours, so the earlier audit was a midpoint rather than final wall time.

The local session log contained 1,416 `exec` calls, 471 `wait` calls, 71 patch
applications, and six context compactions. It issued 40 commands containing
`gh workflow run`; 17 named `desktop-release.yml` directly and 10 named
`opl-first-run-vm.yml` directly. Referenced historical run IDs are not counted
as dispatches unless the task actually issued the workflow command.

## Root Cause

The first long loop was a cross-cohort test. VM diagnostics repeatedly reused a
Standard DMG from run `29167917181` while changing the Shell smoke contract and
expected App/Shell refs. UI selector failures from that mismatch were treated as
new product or smoke defects, producing another patch and another VM run.

The later Full gate exposed a separate runtime-selection defect. The packaged
Full runtime and all five package locks were healthy, but the desktop bridge
selected `~/.opl/one-person-lab`. That Standard carrier had been unpacked as a
nested `one-person-lab-main` directory and had no root `bin/opl`. The bridge
failure was then projected as `package_not_installed`, so longer Home polling
could never make the state ready.

Process defects amplified both failures:

1. The release absorbed moving App, Shell, Framework, GUI, Settings, and smoke
   changes instead of freezing one cohort and deferring unrelated lanes.
2. Raw workflow dispatches bypassed the release operator's cohort and reuse
   guidance.
3. Old DMGs were paired with new smoke contracts, creating false failures.
4. Failures were debugged selector by selector instead of reading the complete
   same-cohort guest state first.
5. Full builds and VM runs were repeated when a previously passed gate or the
   exact DMG could have been reused.
6. Polling used overlapping short waits, increasing event volume and context
   pressure without reducing remote run time.
7. A large failure JSON was copied into `$GITHUB_STEP_SUMMARY`; its 2.3 MB size
   exceeded GitHub's 1 MB limit and created a secondary failure.
8. The 90-minute checkpoint was treated as advisory and did not force an early
   strategy change. It is an efficiency threshold, not permission to abandon an
   authorized release.
9. The pre-package Home gate covered renderer fixtures but not the packaged VM
   smoke contract, so canonical package-id drift was found only after a Full DMG
   had been built.

## Why Full Was Not Published

Standard was published, but Full remained quarantined because its exact-cohort
clean-VM qualification did not pass. Build run `29211495991` produced the Full
DMG successfully. VM run `29212234534` verified the cohort, opened Settings,
showed all four Home starters, selected MAS, displayed `能力：科研`, and exposed
the `完全访问` permission control. The remaining assertion reported that the
selected built-in assistant did not expose the complete selected-capability and
composer-decision-control state for `mas`, most likely the model-selector
condition. That is a real Full acceptance blocker or a stale smoke-contract
boundary, not a packaging failure. Publishing the Full DMG before resolving
that distinction would have mislabeled an unqualified artifact as Stable.

## Corrective Actions

- Bind every VM run to an exact App, Shell, Framework, version, artifact, and
  build-run cohort manifest before allocating the VM.
- Reuse the same DMG for diagnostics; rebuild only after a product/runtime
  change that affects packaged bytes.
- Use one `gh run watch --interval 60` monitor and eliminate nested short polling.
- Require a same-cohort reuse plan after three attempts or 90 minutes.
- Run profile, runtime-carrier, package-state, Home, and send-gate focused tests
  before Electron packaging.
- Route non-update Full commands to the packaged Full runtime. Developer Mode
  checkouts remain first priority, while update commands continue to use the
  managed carrier that owns the update kernel.
- Qualify the DMG-only Full artifact in a clean VM before public Full upload and
  Homebrew promotion.
- Keep large VM evidence as an artifact and cap the job-summary preview at 64 KB.
- Run both host and guest first-run smoke contract tests in the pre-package gate,
  including canonical package ids and route receipts.
- Read exact SHAs from Git or cohort manifests; never manually complete SHA text.
- Preserve the release version as `26.7.12`; calendar rollover during the task
  must not produce a `26.7.13` build.

## Operating Rule

At 90 minutes, publish an efficiency checkpoint with the exact blocker, owner,
same-cohort evidence, reusable gates, and shortest legal next path. Continue to
terminal release success unless a real external or human-owned gate blocks the
release; do not continue an unclassified build-and-VM loop.

## Durable Redesign

The original controls were individually correct but operationally incomplete:
the cohort plan, raw workflow dispatch, run-id discovery, monitoring, owner
handoff, and promotion were separate manual steps. That allowed an operator to
bypass the frozen plan after every failure and recreate the same cross-cohort
mistake.

`npm run release:stable` is now the single persisted release state machine. It
defaults to dry-run and requires `--execute` for external mutation. One session
binds version plus App/Shell/Framework SHAs, runs the deduplicated cheap gates,
allows one desktop-release dispatch, discovers the exact run id automatically,
uses one 60-second monitor, and carries that run id into owner-receipt-gated
promotion. Remote branch movement, cross-cohort artifacts, skipped phases, a
second desktop release for the same cohort, and promotion without an owner
receipt are rejected before expensive work.

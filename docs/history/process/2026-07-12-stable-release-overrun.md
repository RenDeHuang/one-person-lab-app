# v26.7.12 Stable Release Overrun

## Incident

- Codex task: `019f51aa-a718-7471-8d4b-5656e18d90d2`
- Release turn start: `2026-07-12 00:32:27 +0800`
- User budget: 90 minutes
- Independent audit point: after 7 hours; the whole task event log then covered almost 9 hours.
- The task was still active rather than blocked on one long-running command.

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
- Read exact SHAs from Git or cohort manifests; never manually complete SHA text.
- Preserve the release version as `26.7.12`; calendar rollover during the task
  must not produce a `26.7.13` build.

## Operating Rule

At 90 minutes, publish an efficiency checkpoint with the exact blocker, owner,
same-cohort evidence, reusable gates, and shortest legal next path. Continue to
terminal release success unless a real external or human-owned gate blocks the
release; do not continue an unclassified build-and-VM loop.

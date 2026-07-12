# v26.7.12 Stable Release Overrun

## Incident

- Codex task: `019f51aa-a718-7471-8d4b-5656e18d90d2`
- Release turn start: `2026-07-12 00:32:27 +0800`
- User budget: 90 minutes
- Independent audit point: after 7 hours; the whole task event log then covered
  almost 9 hours.
- The task was still active rather than blocked on one long-running command.

The local session log contained 1,416 `exec` calls, 471 `wait` calls, 71 patch
applications, and six context compactions. It issued 40 commands containing
`gh workflow run`; 17 named `desktop-release.yml` directly and 10 named
`opl-first-run-vm.yml` directly. Referenced historical run IDs are not counted
as dispatches unless the session actually issued the workflow command.

## Root Cause

The immediate long loop was a cross-cohort test. VM diagnostics repeatedly
reused the Standard DMG from run `29167917181` while changing the Shell smoke
contract and expected App/Shell refs. The old artifact contained App
`84deec960...` and Shell `3fb6f98ed...`; later diagnostics expected the final
App/Shell cohort. UI selector failures from that mismatch were treated as new
product or smoke defects, producing another patch and another 6-10 minute VM
run.

Three process defects amplified it:

1. The release turn absorbed moving App, Shell, Framework, GUI, Settings, and
   release-smoke work instead of freezing one release cohort and deferring
   unrelated owner lanes.
2. `release:operator` and the documented 75/90-minute diagnostic checkpoints
   were advisory. Raw `gh workflow run` calls bypassed both the same-cohort
   route and the required efficiency diagnosis/evidence-reuse step.
3. VM failure summaries did not initially expose every ready-condition result,
   so several failures were debugged one selector at a time through remote VM
   reruns.

Frequent 20-30 second polling inflated the event log and context pressure, but
it was not the primary wall-time cause. The primary cost was repeated remote
build/VM work against changing or mismatched cohorts.

## Corrective Actions

Implemented in the App repository:

- macOS DMG builds emit `opl-build-cohort.json` with exact App SHA, Shell SHA,
  and version, plus a small sibling `-cohort` artifact;
- manual or same-run VM workflows validate that cohort in the Ubuntu input job
  before allocating the self-hosted macOS VM;
- a mismatched App/Shell/version fails with `cross-cohort VM smoke` instead of
  entering UI diagnostics;
- Desktop Release runs use a versioned run name and report recent same-version
  attempts in the preflight summary;
- three or more attempts in 90 minutes emit an efficiency warning and require
  root-cause classification and evidence reuse, but never block an authorized
  release from continuing.

The active task was first steered too aggressively to treat run `29172581123`
as its final build or VM attempt. That instruction was withdrawn after operator
review: elapsed time is a strategy-switch signal, not authority to abandon the
release. The task must continue to terminal release success unless a real
external or human-owned gate blocks it.

## Operating Rule

For a Stable release:

1. Freeze App, Shell, and Framework SHAs before the first release dispatch.
2. Use `release:operator` and the cohort manifest rather than raw repeated
   workflow dispatches.
3. After repeated attempts or 90 minutes, stop blind repetition, classify the
   failure, and switch to the shortest evidence-backed same-cohort path. Do not
   stop the authorized release merely because time or attempt counts are high.
4. A same-artifact VM retry must use the artifact's App/Shell cohort. If the
   product or its smoke contract changed, build a new cohort once.
5. At 90 minutes, publish an efficiency checkpoint with the blocker, owning
   surface, evidence reference, legal retry entry, and next strategy, then keep
   working until release success or a real external/human gate.

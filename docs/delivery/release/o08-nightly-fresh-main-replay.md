# O08 Nightly Fresh-Main Replay

This runbook is the executable, authority-zero input for the sole App
Integrator. It does not authorize a main/ref write, workflow dispatch, tag,
release, Latest, Tap, public mutation, cleanup, or archive.

The machine source of truth is
`contracts/o08-nightly-fresh-main-replay-manifest.json`. The manifest is bound
to the read-only O11 order-correction receipt at:

```text
/Users/gaofeng/Documents/Codex/2026-07-26/opl-closeout-successor-20260726/outputs/opl-o11-app-exact30-order-correction-20260726.md
SHA256 b5e389bee7ef3e7301ac0bcbfab2bdfbed57b77226aec77ae31a28544dcc77c0
bytes 1913
mode 0444
```

There is one replay order and no alternate:

1. apply the e306 Stable/source-qualification exact16 semantic hunks;
2. apply the O08 Nightly exact17 semantic hunks;
3. resolve the exact3 overlap hunk-by-hunk;
4. require the exact30 payload and exact combined overlap blobs.

Historical source deltas and current replay ancestry use separate identities:

```text
source basis dbdbe9e4049893078ac1394b42ff06bd8527c8d7
source tree  4bd490da2260fe1bccdaed8daa26f518d6b179e4
fresh main  d1a7e7a9da1bc5a73ee03b653145c79b9f35bfdd
fresh tree  4dfe9ae51c6b42ec54953baa68f42726ec60d315
process     588052b0c11c218be34edefb0d012efdeccf144d
process tree 7de36e354be56f2144a0156911c4889a92616feb
Nightly     ba1031416bb4b2bf768bd9b01685bad457e0f2da
Nightly tree 553da90abfcc9e056adc5c2a9abf42858bcb9905
Shell       b8c180c77f4d5cef8bbaa041e41cfd01dc6809a9
Shell tree  edda1786b2f515be0aa0b6fba601b7cac52c0ff5
Framework   53129eba55c26ecb9c95625c93b3951b39ffeaa5
Framework tree aa3ec51fd7666cd063864b9a44e077636d28c690
```

The exact16 and exact17 source inventories and the exact3 replay-overlap hunk
digests are computed from the historical source basis. The replay layer is the
exact parent chain `d1a7 -> 588052b0 -> ba103141`. The support task-ref tip must
descend from `ba103141`, and the cumulative `ba103141..tip` delta must remain
exact4 additions. This permits an ordinary non-force currentness rebind on the
same task ref without admitting a fifth path. The two fresh-main changes are
not discarded while applying e306:

- `.github/workflows/release-source-qualification.yml` preserves the ad-hoc
  signing semantics from fresh main plus the e306 wire-main/profile-consumer
  semantics;
- `tests/release/release-source-qualification-workflow.test.ts` preserves the
  assertions for both semantic sets.

Both exact2 combined blobs are manifest-bound. Selecting either fresh-main or
e306 as a whole file fails validation.

The four validator support files are an explicit, disjoint support slice. They
do not expand the replay payload beyond exact30. Any other changed path is an
unknown/31st payload path and stops the operation.

## Fail-Closed Boundaries

The validator reads App, Shell, Framework, e306, and O08 wire refs directly.
Before replay or post-commit validation it requires the manifest's fresh App
main and source refs to remain current. A changed App/Shell/Framework main,
source ref, source tree, successor parent/tree, source-basis ancestry, fresh-main exact2 delta,
exact16/exact17 inventory, exact2 or exact3 hunk digest, path status, file mode,
or blob stops the operation. The O08 owner must then refresh this manifest from
the new wire main; the Integrator must not guess a replacement.

For each overlap, the validator rejects both single-source blobs before checking
the combined blob. Therefore whole-file `ours` or `theirs`, even when it is
syntactically valid, cannot pass.

A source-gate receipt is forbidden in `replay`, `gates`, and `post-commit`.
Only `absorption` accepts one, and then only when it:

- has schema `opl_app_release_source_gate.v1`;
- passes every required gate;
- binds the absorbed App main plus the exact Shell and Framework cohort;
- was generated after the absorbed App commit.

All other generated source/admission/Nightly receipts and the build cohort must
also be regenerated after integration. No old JSON is replay input.

## Replay Validation

Run from the candidate App checkout after the exact30 and the exact4 support
slice are present:

```bash
receipt=/Users/gaofeng/Documents/Codex/2026-07-26/opl-closeout-successor-20260726/outputs/opl-o11-app-exact30-order-correction-20260726.md
report_root="$(mktemp -d "${TMPDIR:-/tmp}/opl-o08-replay.XXXXXX")"

node --experimental-strip-types scripts/validate-o08-nightly-fresh-main-replay.ts \
  --phase replay \
  --repo-root "$PWD" \
  --authority-receipt "$receipt" \
  --output "$report_root/replay.json" \
  --json
```

This phase performs no replay itself. It verifies that the current candidate was
derived from fresh wire main, the two historical source deltas are exact
relative to the source basis, the fresh-main exact2 overlay survives, the path
set is exact30 plus exact4 support, and every payload blob is the expected
semantic result.

## No-Main Gates

The `gates` phase reruns the replay validator and then stops on the first failed
command:

```bash
export OPL_FULL_OPL_FLOW_ROOT=/Users/gaofeng/workspace/opl-flow
export OPL_FLOW_WORKFLOW_POLICY="$OPL_FULL_OPL_FLOW_ROOT/contracts/workflow-policy.json"

node --experimental-strip-types scripts/validate-o08-nightly-fresh-main-replay.ts \
  --phase gates \
  --repo-root "$PWD" \
  --authority-receipt "$receipt" \
  --output "$report_root/gates.json" \
  --json
```

The manifest order is:

1. replay-validator focused tests;
2. e306 Stable/source focused tests;
3. expanded O08 Nightly focused tests with the canonical Node runner;
4. static App release-boundary validation;
5. aggregate App release-boundary tests;
6. aggregate active-shell validation.

These commands contain no packaging, source qualification workflow, release
dispatch, publication, or cleanup.

## Post-Commit Readback

After the support owner creates the exact4 task commit, with no canonical main
write:

```bash
candidate_commit="$(git rev-parse HEAD)"

node --experimental-strip-types scripts/validate-o08-nightly-fresh-main-replay.ts \
  --phase post-commit \
  --repo-root "$PWD" \
  --authority-receipt "$receipt" \
  --post-commit-sha "$candidate_commit" \
  --output "$report_root/post-commit.json" \
  --json
```

This requires a clean checkout, the support tip descended from `ba103141`, the
cumulative support delta still exact4 additions, the frozen fresh main as an
ancestor, neither historical source commit as an ancestor, exact2 overlay and
exact30 payload blobs, all exact4 support paths, and a complete commit tree/blob
inventory. Passing this phase is not absorption or release authority.

## Absorption Readback

Only after the separate P0/Acceptance decision and the sole Integrator's
canonical main operation, generate a new source-gate receipt from the absorbed
main. Do not pass an earlier receipt:

```bash
absorbed_main="$(git rev-parse HEAD)"
fresh_source_gate="$report_root/source-gate.json"

npm run release:source-gate -- \
  --version <approved-version> \
  --app-ref "$absorbed_main" \
  --shell-ref b8c180c77f4d5cef8bbaa041e41cfd01dc6809a9 \
  --framework-ref 53129eba55c26ecb9c95625c93b3951b39ffeaa5 \
  --require-shell-format true \
  --run-shell-tests true \
  --output "$fresh_source_gate" \
  --json

node --experimental-strip-types scripts/validate-o08-nightly-fresh-main-replay.ts \
  --phase absorption \
  --repo-root "$PWD" \
  --authority-receipt "$receipt" \
  --post-commit-sha "$candidate_commit" \
  --source-gate-receipt "$fresh_source_gate" \
  --output "$report_root/absorption.json" \
  --json
```

Absorption passes only when local main equals wire main, the candidate commit is
an ancestor, the exact payload and support blobs remain present, the checkout
is clean, cohort currentness still matches, and the new source-gate receipt
binds that absorbed main. Receipt generation or absorption readback does not
authorize a Stable or Nightly workflow, tag, release, Latest, Tap, or public
mutation.

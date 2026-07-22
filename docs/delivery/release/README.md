# OPL App Release Guide

## Read This First

The live release authority is the immutable Framework Release Bundle described
in [`immutable-release-bundle.md`](immutable-release-bundle.md) and
`contracts/app-release-channel.json#release_bundle_control_plane`.

Framework `opl release` owns Bundle identity, storage, portable checkpoints,
operation receipts, and reconciliation. The App owns product policy and the
local or GitHub executor. The only Stable operations are `standard`, `resume_standard`, and `append_full`.

The former App Stable controller, release operator, mutation broker, and session
state machine are retired. These legacy surfaces are read-only historical
receipt parsers whose source remains only so old data can be read and explained.
They cannot admit, schedule, dispatch, rebuild,
publish, promote, rerun, cancel, or claim readiness for a new release.

## Single Source Of Truth

| Concern | Authority |
| --- | --- |
| Bundle schema, canonical digest, store, checkpoint, executor and operation receipts | OPL Framework `opl release` |
| Stable product operations and public asset policy | `contracts/app-release-channel.json#release_bundle_control_plane` |
| Stable manual entry | `.github/workflows/release-stable.yml` |
| Temporary Manual Full preview entry | `.github/workflows/release-manual-full-preview.yml`, protected non-Stable `publish|cleanup` only |
| Nightly entry | `.github/workflows/release-nightly.yml`, schedule only |
| App executor implementation | App reusable Bundle workflows and the thin local executor |
| Historical broker/session receipt parsing | `contracts/app-release-broker-authority.json` and retained legacy scripts, read-only |

Passing a contract test is not release admission and does not make a Bundle
publishable. Admission is performed independently by the live App executor
against canonical refs, the Framework checkpoint, remote state, protected
environment policy, and the operation deadline.

## Framework ABI

The App consumes the current Framework ABI exactly:

```text
opl release freeze --request <request.json> [--source-root <directory>] [--store <directory>]
opl release operation admit --bundle <sha256:digest> --operation <standard|resume_standard|append_full> --operation-id <id> --operation-started-at <timestamp> --operation-deadline-at <timestamp> [--store <directory>]
opl release build --bundle <sha256:digest> --executor-receipt <receipt.json> --operation <standard|resume_standard|append_full> --operation-id <id> --operation-started-at <timestamp> --operation-deadline-at <timestamp> [--store <directory>]
opl release checkpoint export --bundle <sha256:digest> --output <directory> [--store <directory>]
opl release checkpoint import --checkpoint <checkpoint.json> [--store <directory>]
opl release verify --bundle <sha256:digest> --qualification-receipt <receipt.json> --operation <standard|resume_standard|append_full> --operation-id <id> --operation-started-at <timestamp> --operation-deadline-at <timestamp> [--track <standard|full>] [--store <directory>]
opl release publish --bundle <sha256:digest> --executor-receipt <remote-inspect.json> --operation <standard|resume_standard|append_full> --operation-id <id> --operation-started-at <timestamp> --operation-deadline-at <timestamp> [--store <directory>]
opl release reconcile --bundle <sha256:digest> --executor-receipt <receipt.json> --operation <standard|resume_standard|append_full> --operation-id <id> --operation-started-at <timestamp> --operation-deadline-at <timestamp> [--store <directory>]
opl release status --bundle <sha256:digest> [--store <directory>]
```

Do not pass a Bundle JSON path where the ABI requires `sha256:<digest>`. Publish
derives the track from the remote-inspect executor receipt; it has no `--track`
argument.

## Stable Operations

`standard` freezes one new Bundle, builds and qualifies Standard, exports a
portable checkpoint, qualifies the actual updater ZIP before any public Release
mutation, and then publishes, reads back, updates Homebrew, and activates Latest.
Its absolute operation budget is 90 minutes.

`resume_standard` imports an existing Framework checkpoint and completes the
remaining Standard publication path without rebuilding a completed stage. It
inherits the checkpoint's original Standard operation id, start, and absolute
deadline; dispatching a resume cannot refresh that clock.

`append_full` imports a checkpoint at or after `standard_qualified`, builds or
qualifies only missing Full stages, and appends the Full DMG and manifest without
changing Standard assets, updater metadata, prepared notes, or Latest. Its
absolute operation budget is 50 minutes.

Every mutation job rechecks the admitted operation and the absolute deadline
before each remote write. `github.run_attempt` must be `1`; partial workflow
reruns are rejected. Recovery uses a fresh executor invocation over the exact
Framework checkpoint and inherited operation control, never an Actions rerun or
a reconstructed App session.

## Checkpoint Handoff

Portable checkpoint stages are:

1. `frozen`
2. `standard_built`
3. `standard_qualified`
4. `full_built`
5. `full_qualified`

Local and GitHub executors transfer only the checkpoint, exact assets, and
receipts. Import revalidates every size and SHA-256, skips completed work, and
records `rebuild_performed=false`.

Build provenance and transport provenance are independent:

- `source_build_executor` and `source_build_run_id` identify where bytes were built.
- `checkpoint_transport_executor` and `transport_run_id` identify the handoff.

Moving a GitHub artifact into another run must not rewrite source build
provenance. A checkpoint cannot import publish or promotion state. The recipient
must perform a fresh remote inspection before upload or promotion.

Unknown build or publish outcomes make checkpoint export ineligible. Inspect and
run Framework reconcile first. Do not infer success, retry the mutation, or move
the Bundle to another executor while the result is unknown.

## Version And Admission

Stable allocation compares all public Stable releases, not only the item marked
Latest. The base `YY.M.D` and every same-day `-rN` are independent immutable
releases. Both display version and machine updater version must increase.

The updater baseline includes current Latest and the highest public Stable.
Source and remote version checks complete before an expensive build. Stable and
Nightly share one repository-wide mutation mutex so two channels cannot write
Release, Latest, updater, or Homebrew state concurrently.

The failed Bundle below is permanently ineligible for checkpoint import,
publication, promotion, or reuse:

```text
sha256:91d5ea069757fca6bb9aa2280615dc952caeff55b6b4bc13e08e40df32378f49
```

The rejected v26.7.20 Full artifact remains separately recorded in
`incidents/2026-07-20-v26.7.20-full-catalog-mismatch.json`.

## Updater And Publication

Updater qualification uses the exact candidate ZIP bytes. Its receipt binds both
`size_bytes` and SHA-256 computed from the file, rather than trusting only a
digest copied from updater metadata. The test installs the public predecessor,
applies that exact ZIP without downgrade, proves the running machine version,
and proves the next check reports no update.

This qualification completes before the first public GitHub Release mutation.
Afterward publication is digest-idempotent:

- a missing asset is uploaded;
- the same name and digest is already complete;
- the same name with a different digest fails closed;
- an unknown API result permits Framework reconcile only.

Typed failure evidence is persisted before a failing job exits or cleans its
workspace and is uploaded even on failure. Missing failure evidence cannot be
reinterpreted as a passed gate.

## Temporary Manual Full Preview

The Manual Full preview is a temporary public download lane, not a Stable
operation and not a Framework Release Bundle state transition. Its only entry is
`.github/workflows/release-manual-full-preview.yml`, with the two exact
operations `publish` and `cleanup`. The mutation job is bound to the protected
`release-stable` environment and the repository-wide release mutex. Ordinary
developer credentials and the Manual Full builder cannot create, edit, or
delete the preview Release or tag.

`publish` is admitted only after a fresh `MANUAL_USABLE_DELIVERED` receipt binds
the exact Manual Full DMG, source lock, build receipt, public manifests, and a
passed minimum Host QA receipt. The preview tag is derived as
`manual-full-preview-<YY.M.D>-m1-<source-lock-sha256-first12>` and never starts
with `v`. The Release is published with `prerelease=true` and
`make_latest=false`; its notes state that M2 clean-VM/full qualification is
pending and that it is neither Stable nor an automatic update.

Large handoff bytes enter through the fixed
`OPL_MANUAL_PREVIEW_INGRESS_ROOT/<nonce>` directory on the dedicated macOS ARM64
runner. The read-only ingress job rejects symlinks, extra files, arbitrary
paths, and digest drift, then uploads one immutable run-scoped Actions artifact.
The protected job downloads that artifact by ID only after reading back its
owner run, digest, and expiry. The repository variable must have an independent
settings receipt before this executor can be enabled.

The publisher uploads a missing asset once, treats the same name and digest as
complete, and fails closed on a conflicting digest. An unknown mutation result
allows at most three read-only postcondition inspections and never allows a
retry, workflow rerun, redispatch, or cancel. The mutation allowlist contains
only the derived preview Release, its assets, and its tag; Stable tags, Latest,
updater metadata, Homebrew, and Framework checkpoints are read-only.

`cleanup` is admitted only after M2 reports `standard_qualified` and an exact
receipt proves that formal Standard plus `append_full` are published and read
back, the Stable Release is Latest, and updater metadata and Full asset digests
match the frozen cohort. The M2 and Stable receipts must bind the same Framework
Bundle, Full DMG, and release manifest; remote readback covers all six Standard
assets plus both Full assets. Cleanup deletes the preview Release first, proves
its absence, deletes the preview tag, proves both are absent, and then repeats
the formal Stable remote readback.

## Homebrew Distribution Boundary

Homebrew has one writer per track inside the protected Bundle executor. A push is
successful only after exact remote commit and cask digest readback.

An unknown push result never triggers another push. The executor performs at
most three read-only remote reconciliations. If exact state remains unknown, the
operation stops with typed failure evidence and a later bounded checkpoint
operation must inspect again.

Standard Homebrew publication and clean-VM readback are required before Latest.
Full Homebrew publication is additive and cannot change the Standard cask or
Latest.

## Install And Update Taxonomy

The Standard updater mutates only the App binary. OPL Base and OPL Packages
remain Framework lifecycle objects and reconcile through `opl update` and
`opl packages`; a release workflow cannot become a second package lifecycle
authority.

The local-install profile is a development and QA path for one Mac. It cannot
publish, promote, write Homebrew, or stand in for public clean-VM evidence.

## Release Efficiency Target Architecture

Build once means one exact Bundle and one exact asset byte set. Changing executor
is transport, not a new build system. Standard reaches its own terminal before
the optional Full add-on. Failed steps resume from the highest verified
checkpoint instead of replaying the whole DAG.

Canonical `main` and unrelated development worktrees are never reserved for a
long build. A release uses its own immutable checkout and Bundle store.

## Full Size Policy

Full keeps its clean-machine offline first-install promise. Size thresholds open
review; they do not authorize removal of required runtime, package, native trust,
or readiness payloads. Full remains first-install-only and updater-invisible.

## Diagnostics

Use Framework status for Bundle state:

```text
opl release status --bundle <sha256:digest> --json
```

Use Framework reconcile only with a fresh executor receipt describing the exact
remote observation. GitHub run and artifact inspection can explain executor
progress, but neither is release state authority.

VM, updater, Homebrew, and remote-readback receipts must bind the same Bundle and
asset digests. Diagnostic reruns may inspect exact bytes but cannot rebuild,
publish, promote, or upgrade a failed receipt to passed.

## Historical Receipt Compatibility

The retired broker authority contract deliberately retains its v1 parser fields
so historical signatures and receipts can still be inspected. Its lifecycle is
`retired_historical_receipt_verification_only`; mutation execution, new admission,
workflow lookup, dispatch, publish, promote, rebuild, and cancel are disabled.

The same rule applies to the retained Stable session and operator source files.
They are evidence readers, not callable package scripts or workflow mutation
entries. New code must not depend on their state schemas, broker ledger, or
controller commands.

## Validation

Focused machine checks:

```bash
node --experimental-strip-types --test \
  tests/release/release-control-plane-contract.test.ts \
  tests/release/release-bundle-control-plane-contract.test.ts \
  tests/release/release-legacy-entry-retirement.test.ts
```

Contract or App wrapper changes also require:

```bash
bun run validate:active-shell
```

These checks prove contract consistency only. The release executor still performs
independent live admission and remote readback before any public mutation.

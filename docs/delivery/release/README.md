# OPL App Release Guide

## Read This First

The live release authority is the immutable Framework Release Bundle described
in [`immutable-release-bundle.md`](immutable-release-bundle.md) and
`contracts/app-release-channel.json#release_bundle_control_plane`.
Channel, Latest/Stable, Standard/Full, Desktop/WebUI, Homebrew, and install-path
semantics are maintained once in
[`../distribution-and-install-ssot.md`](../distribution-and-install-ssot.md).
This guide owns operator mechanics only and must not redefine that model.

Framework `opl release` owns Bundle identity, storage, portable checkpoints,
operation receipts, and reconciliation. The App owns product policy and the
local or GitHub executor. The only Stable operations are `standard`, `resume_standard`, and `append_full`.

The former App Stable controller, release operator, mutation broker, and session
state machine are retired. These legacy surfaces are read-only historical
receipt parsers whose source remains only so old data can be read and explained.
They cannot admit, schedule, dispatch, rebuild,
publish, promote, rerun, cancel, or claim readiness for a new release.

## Progress-First Delivery

Release work in the development environment is progress-first. Diagnose the
first real breakpoint as either a product-byte failure or a delivery-path
failure:

- If product bytes, provenance, required qualification, or public readback are
  wrong or unverifiable, repair or rebuild the affected bytes.
- If exact product bytes are already correct and the failure is confined to a
  deterministic tool, test harness, CI orchestration, documentation, or
  automation path, do not rebuild the product or hold an independently
  publishable carrier merely to perfect that path.

For a delivery-path failure, finish the current delivery through the narrowest
compliant route: direct manual qualification that emits the required receipt,
checkpoint resume, reuse of already verified bytes, or a carrier-specific
protected and digest-idempotent publish/promotion entry. If no such entry
exists, add the smallest one-purpose protected bridge instead of redesigning
the release controller. The durable automation repair proceeds independently
or immediately afterward; it is not a prerequisite for publishing unchanged,
verified bytes.

The fast path never relaxes Bundle or artifact identity, required product
qualification, protected mutation authority, exact namespace scope,
same-name/different-digest fail-closed behavior, or read-only reconciliation
after an unknown external result. Stop only when the bytes themselves are
wrong or unverifiable, data/security/permission boundaries are at risk, the
target name has a conflicting digest, an external mutation result is unknown,
or required human/owner authority is unavailable.

Desktop source qualification is the pre-release cost-control gate. Run
`.github/workflows/release-source-qualification.yml` on exact `main` before a
new Standard operation. It performs one unsigned local Standard build and one
clean Tart VM qualification on the self-hosted macOS runner, then emits an
immutable `opl_app_source_qualification_receipt.v1` binding the App, Shell, and
Framework cohort. The receipt is `development_validation`: it reserves no
version, proves no final signed byte, grants no release authority, and performs
no public mutation. Its purpose is to expose source, packaging, install, and VM
smoke defects before the protected signing/notarization path pays for them.

Before consuming a dispatch nonce, run the App source gate and
`release:dispatch-guard preflight` against the exact App, Shell, and Framework
SHAs. The source gate projects the current App product profile into a temporary
archive of the exact Shell commit and runs
`tests/unit/common-config/oplProductProfile.test.ts`; it never writes the source
Shell checkout. The dispatch guard resolves all three main identities through
Git wire reads and performs one logical owner workflow-runs API query. Each
read-only transport operation has at most three attempts.
The preflight command requires the passed source-gate JSON and rebinds its exact
cohort before any wire or owner API read.

TLS handshake timeouts, unexpected EOF, and read timeouts are transport
failures, not credential failures. A pre-nonce failure consumes no nonce and
permits only a replacement read-only guard. After the exact dispatch invocation,
the controller parses the owner API JSON in Node and requires one run matching
workflow path, App SHA, `workflow_dispatch`, `main`, attempt 1, and the bounded
operation-start window. Zero, ambiguous, or unreadable results are
`outcome_unknown`; mutation retry, replacement dispatch, rerun, and cancellation
remain forbidden.

## Development And Production Modes

WebUI has two explicit task modes that share the same carrier build,
qualification, protected promotion, and public readback implementation:

- `development_validation` enters through
  `.github/workflows/release-webui-development.yml`. It may build, qualify,
  publish, and promote the WebUI before Desktop Latest so the real carrier path
  can be proven without inheriting production follower order. Public mutation
  remains protected and digest-idempotent. Its receipt does not satisfy
  production Latest or follower handoff.
- `.github/workflows/release-webui-development-promote.yml` is a promotion-only
  delivery bridge for exact bytes from a prior first-attempt development
  publication. It cannot rebuild or requalify the carrier.
- `production_release` enters only through
  `.github/workflows/release-webui-follower.yml` after Desktop Latest
  activation. The follower binds the exact Stable handoff, current App main,
  carrier receipt, and protected promotion readback.

The development path proves and repairs the mechanism; the production path
restores final release ordering. Neither mode permits force, cross-run artifact
selection, a second tag attempt after an unknown result, or a development
receipt to be relabeled as production evidence.

## Ecology Release Topology

The OPL release surface follows the same composable model used by the package
manager:

```text
OPL Base ~= R
OPL App ~= RStudio / replaceable GUI or deployment carrier
OPL Package ~= R Package
Registry ~= discovery index
Full or Release Set ~= exact snapshot of inputs selected for that artifact
```

Stable, WebUI, Full, Nightly, and Daily are not competing package authorities:

| Object | Correct meaning | Currentness authority |
| --- | --- | --- |
| OPL Base | Framework release; Homebrew Formula and headless installer are carriers | Framework Base release receipt |
| Desktop Stable | App release policy and public Latest/updater metadata | Framework Bundle plus App release executor |
| Container WebUI | Current browser/server App carrier consuming an exact App receipt/digest | Successful Desktop Stable Latest activation -> `release-webui-follower.yml` `workflow_run` -> carrier-specific publish and anonymous-pull readback |
| Native WebUI | Approved host-native browser target; not currently an OPL publication or install path | No currentness authority until immutable OPL assets and public readback exist |
| Full | Same Official Profile with additional first-install/offline seeds; additive to Standard | Frozen Bundle and exact refs/digests only for inputs selected in that artifact |
| Nightly | Standard-density automated prerelease semantics are retained; the current public publication implementation is retired and historical bytes remain readable | No currentness authority until a newly qualified publication path exists; daily validation uses Canary |
| OPL Package | Independently published complete Package bytes | Package owner GHCR `latest-stable` plus thin Base download/verification, configured carrier activation, and Framework fresh aggregation |
| Daily | Scheduled candidate/index reconciliation and audit cadence | Daily receipt only; it is not a release channel |

The roots selected by the current Official Profile are replaceable defaults. A
Release Set may bind exact package refs for Full or qualification, but it must
not require a fixed Package count to publish atomically or make an unrelated Package
wait for App/Base. Developer checkout, external registry, manual manifest, and
offline seed remain source adapters for explicit profiles and recovery; they
cannot define ordinary Stable currentness.

## Live Proof Boundary

This guide deliberately does not pin a current public version or digest.
Currentness comes only from fresh terminal owner readbacks, never from this
document, contract tests, a green build, a candidate artifact, or a
non-terminal workflow run:

```text
App Stable -> GitHub Latest -> updater readback
WebUI exact digest -> :stable -> anonymous pull
one Package update -> unchanged Base/App/other Packages remain unchanged
```

## Single Source Of Truth

| Concern | Authority |
| --- | --- |
| Bundle schema, canonical digest, store, checkpoint, executor and operation receipts | OPL Framework `opl release` |
| Stable product operations and public asset policy | `contracts/app-release-channel.json#release_bundle_control_plane` |
| Desktop source qualification | `.github/workflows/release-source-qualification.yml` plus `opl_app_source_qualification_receipt.v1`; development validation only |
| Stable pre-nonce and post-dispatch guard | `scripts/release-dispatch-guard.ts`; Git wire identity plus one structured owner-run query, read-only only |
| Stable manual entry | `.github/workflows/release-stable.yml` |
| Protected same-run credential check and version/cohort admission | `release-stable.yml#protected-admission`; read-only `release-stable` environment gate |
| Per-attempt failure timing and stage observation | `.github/workflows/release-attempt-observability.yml`; append-only read-only follower without retry authority |
| Temporary Manual Full preview entry | `.github/workflows/release-manual-full-preview.yml`, protected non-Stable `publish|cleanup` only |
| Daily release validation | `.github/workflows/release-bundle-canary.yml`, validation-only schedule |
| App executor implementation | App reusable Bundle workflows and the thin local executor |
| Package publication/current stable | Each Package owner and its declared publication store; not the App release controller or shared Release Set |
| Package installed/callable state | Fresh configured-carrier readback aggregated by OPL Framework; not App release state |
| Exact Package refs/digests in one App/Full build | The immutable build snapshot for only the inputs actually included; not ordinary Package composition or currentness |
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
Its absolute operation budget is 90 minutes. The manual dispatch accepts only
the exact successful source-qualification run id and receipt digest. The same
Stable run enters `release-stable`, verifies Apple credentials without
submission, allocates the unoccupied version, seals the cohort/admission
manifest, and only then calls the Standard Bundle implementation. Raw version or
source refs are not Standard inputs.

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

After a Stable attempt reaches terminal state,
`.github/workflows/release-attempt-observability.yml` records the first terminal
job, stage, conclusion, and wall time in one artifact named for that run. This
follower is diagnostic only: it cannot change Framework state or authorize a
retry, rerun, redispatch, cancellation, or release mutation.

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
Source and remote version checks complete before an expensive build. Stable is
the only live release mutation channel and owns the repository-wide mutation
mutex; the scheduled Canary cannot write Release, Latest, updater, or Homebrew
state.

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

This preview remains a transitional compatibility lane. Once formal
`append_full` has a fresh terminal proof for the same frozen Bundle and the
preview cleanup receipt is read back, the preview workflow is a deletion
candidate. Documentation of the candidate does not authorize its removal.

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

The Standard updater mutates only the App binary. Current `opl update` and
`opl packages` routes remain compatibility bridges while Package lifecycle moves
to configured carriers and Framework fresh aggregation; release workflows cannot
become Package lifecycle or currentness authority.

The normal user-facing channel is therefore one App Stable updater plus
independent owner Package channels. Docker/WebUI and Homebrew carry exact owner bytes;
Full seeds an offline composition; Nightly remains the Standard-density
prerelease concept while its current public publication implementation is
retired; Daily is a scheduled reconciliation cadence. Historical Nightly
distribution stays read-compatible. Canary is an independent validation
workflow, not a release channel. A Package update must not require an App, Base,
or unrelated Package release, and a carrier failure must not rewrite owner
publication currentness.

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

# Immutable Release Bundle

Owner: `one-person-lab-app` for product policy
Generic authority: OPL Framework
Status: Bundle authority active; first terminal Stable proof pending

## Decision

One release is one immutable Framework-owned Release Bundle. Local execution and
GitHub Actions are transports for the same Bundle, not separate build or
publication products. Build once, then verify, publish, promote, and reconcile
the exact bytes as many times as the legal state permits. Moving work between
executors never authorizes a rebuild.

The generic schema, store, canonical digest, receipts, publisher ledger, and
executor ABI belong to OPL Framework under `opl_release_bundle.v1`. The App
does not redefine that closed shape. It owns only the product adapter, public
asset policy, prepared AI notes policy, installed-App acceptance, and Standard
updater readback.

The Framework command surface is:

```text
opl release freeze --request <request.json> [--source-root <directory>] [--store <directory>]
opl release build --bundle <sha256:digest> --executor-receipt <receipt.json> [--store <directory>]
opl release checkpoint export --bundle <sha256:digest> --output <directory> [--store <directory>]
opl release checkpoint import --checkpoint <checkpoint.json> [--store <directory>]
opl release verify --bundle <sha256:digest> --qualification-receipt <receipt.json> [--track <standard|full>] [--store <directory>]
opl release publish --bundle <sha256:digest> --executor-receipt <remote-inspect.json> [--store <directory>]
opl release reconcile --bundle <sha256:digest> --executor-receipt <receipt.json> [--store <directory>]
opl release status --bundle <sha256:digest> [--store <directory>]
```

Framework receipts use `opl_release_bundle_executor_receipt.v1` and
`opl_release_bundle_operation_receipt.v1`, qualifications use
`opl_release_bundle_qualification_receipt.v1`, and transport uses
`opl_release_bundle_checkpoint.v1`. The App references those schemas and does
not duplicate their closed shapes.

Framework checkpoint state plus one App product executor is the only live
mutation authority. The protected `release-stable` environment constrains the
executor but is not a second state authority. Existing broker, Stable-session,
and operator receipts remain readable for audit, but they cannot admit,
schedule, dispatch, rebuild, rerun, cancel, publish, promote, or reconcile a new
release.

The App-owned source qualification receipt is also not Bundle or mutation
authority. It binds one exact main-only App/Shell/Framework cohort to one local
unsigned Standard build and one clean Tart VM pass. It exists to move repeatable
source, packaging, install, Settings, assistant-route, and Runtime smoke failures
ahead of protected signing and public publication. It does not reserve a
version, bind final signed bytes, or permit a Standard dispatch by itself.

## Portable Checkpoints

The five portable stages are `frozen`, `standard_built`,
`standard_qualified`, `full_built`, and `full_qualified`. Local and GitHub
executors may switch at any completed stage by transferring only the checkpoint,
exact assets, and receipts. Import revalidates every size and SHA-256, skips
completed work, and records `rebuild_performed=false`.

`source_build_executor` and `source_build_run_id` remain the byte provenance.
`checkpoint_transport_executor` and `transport_run_id` describe only the
handoff; moving an artifact to another run cannot rewrite its build provenance.

Checkpoint import never imports publish or promotion state. The recipient does
a fresh remote inspection, uploads only missing names, treats matching names and
digests as complete, and fails closed on a same-name digest mismatch. An unknown
build or publish outcome blocks export and executor switching until inspect and
Framework reconcile resolve it.

## Bundle Identity

App, Shell, and Framework SHAs are necessary but not sufficient. A Full/offline
Bundle also binds the exact package profile resolved for that build: every
selected root and dependency has a package version, owner source commit, and
payload-manifest digest. The selected roots come from the App-owned Official
Profile at Bundle freeze; this document does not copy its membership, count, or
ordering. That profile is a replaceable first-install default, not the Package
ecosystem boundary.

The binding is either the explicit resolved package closure or an exact
Framework Release Set digest whose readback transitively proves the same
closure. The Framework catalog or manifest digest is also frozen. A source
checkout, packaged payload, catalog, manifest, or Release Set mismatch fails
before an expensive build. Standard App publication does not require this Full
package snapshot.

The canonical Bundle digest also covers the release channel, display version,
updater version,
prepared AI notes plus evidence, Standard assets and qualification, optional
Full assets and qualification, and relevant App product-policy inputs.

## Freeze Currentness Boundary

Remote currentness is resolved once, before Bundle freeze. Freeze records the
selected source refs, checkout trees, package members, projected catalog or
Release Set digest, and every other identity input. After that boundary,
currentness means only that those frozen checkouts, bytes, and digests remain
unchanged. A newer remote main, tag, package patch version, or remote-tracking
ref does not invalidate the Bundle and does not authorize a rebuild.

A release-owned task-local catalog projection may bind the exact frozen package
owner refs without first mutating the live Framework catalog. Its generated
bytes and digest become Bundle inputs. Host installed/effective state is not a
pre-freeze source-authority requirement; installation and effective readback
belong to post-build qualification of the exact artifact. Stable still requires
its configured artifact qualification before Latest activation.

Only a frozen byte or digest mismatch, artifact build or integrity failure, or
an explicit security revocation can invalidate the frozen cohort. Changing
executors, later development, post-build qualification, publication, or
unrelated package advancement must continue with the same artifact bytes.

## Assets And Latest

Prepared AI notes are generated and validated before the expensive build and
become immutable Bundle inputs. Publish and promote may not regenerate notes or
use a template fallback.

Stable may become Latest only after the prepared English AI notes, all six
Standard assets, exact-byte qualification, remote digest readback, a real
upgrade from the public predecessor using the same candidate ZIP, and the
Standard Homebrew cask publication plus clean-VM readback pass:

1. Standard DMG
2. Standard ZIP
3. ZIP blockmap
4. `latest-arm64-mac.yml`
5. `opl-app-component-manifest.json`
6. `standard-local-authorization-policy.json`

The updater hard gate uses both current Latest and the highest public Stable as
its baseline, installs the public predecessor DMG, discovers and downloads the
same ZIP bound above, applies it without `allowDowngrade`, restarts, proves
`app.getVersion()` equals the Bundle `updater_version`, and then proves a second
check reports no update. Its receipt binds the actual ZIP `size_bytes` and
SHA-256 computed from the file; metadata alone is insufficient. This gate passes
before the first public GitHub Release mutation. The Homebrew cask uses
`updater_version` for ordering,
but its URL, Release tag, and asset name use `display_version`; it must retain
`depends_on formula: "opl"`.

Full is an additive same-Bundle-cohort track. Its DMG and
`opl-release-manifest.json` may be added after Latest. Adding Full must not
change Standard assets, updater metadata, prepared notes, or Latest selection.
Full is never a Standard updater target.

After Full assets pass and are appended, the Bundle may update only
`one-person-lab-full`, then run its own Homebrew clean-VM readback. This cannot
change the Standard cask, Standard assets, updater metadata, notes, or Latest.

## Display And Machine Versions

Tags, Release names, asset names, and UI use `display_version`, for example
`26.7.20-r1`. `app.getVersion()`, both CFBundle versions,
`latest-arm64-mac.yml`, manual/automatic updater comparison, and Homebrew cask
ordering use `updater_version`, for example `26.7.2001`. SemVer compares the
three core segments as decimal integers; no zero padding or string ordering is
allowed. Historical `26.7.20` keeps machine version `26.7.20`. New Stable
versions encode patch as `day * 100 + revision`, with revisions limited to
`r1` through `r9`. Allocation compares every public Stable release, not only
Latest, and both display and machine versions must increase.

## Workflow Boundary

`.github/workflows/release-stable.yml` is the only Stable
`workflow_dispatch`. Lower-level release workflows are reusable
`workflow_call` implementation details. Nightly has a separate schedule-only
Standard prerelease workflow that reuses the physical build implementation but
not the Stable Bundle, Stable mutex, Latest authority, Full density, or WebUI
carrier mutation. Historical Nightly tags, assets, updater metadata, and
receipts remain readable. Canary is an independent validation-only schedule.

A new `standard` operation consumes an exact successful
`.github/workflows/release-source-qualification.yml` run id and receipt digest.
The Stable run first verifies that main-only, first-attempt, no-secret receipt,
then its read-only `protected-admission` job enters `release-stable`, performs
the Apple credential probes, allocates the version, and seals the same-run
Stable admission manifest. Standard receives version and cohort only from that
protected job; the caller cannot inject raw version or source refs. The
standalone Apple credential workflow remains diagnostic-only and cannot create
the manifest or dispatch Standard.

Desktop/WebUI and Standard/Full form four independently qualified product
cells. Each carrier may move only its own Latest after exact qualification and
readback; success in one cell does not qualify or publish another.
`.github/workflows/release-webui-follower.yml` is an internal WebUI carrier
follower: it consumes an admitted exact Stable handoff, verifies surface,
density and cohort, then owns that carrier's build, promotion and
anonymous-pull readback. Its failure cannot rewrite another cell's terminal
result. This workflow shape does not itself prove any WebUI cell is currently
public.

Stable exposes exactly `standard`, `resume_standard`, and `append_full`.
Stable alone owns the repository-wide mutation mutex. Each operation
derives one absolute deadline from the GitHub run start, every mutating job
checks it before its first remote API, and partial `github.run_attempt` reruns
are rejected. Typed failure evidence is persisted before a failing job exits or
cleans its workspace.

Only the publish job may receive bounded write permission, under the protected
`release-stable` environment. Every other job is read-only. The publisher is
digest-idempotent: upload a missing asset, treat the same name and digest as
complete, and fail closed on the same name with a different digest. An unknown
API result permits reconcile only, never redispatch, rerun, or cancel.

`.github/workflows/release-attempt-observability.yml` follows completed Stable
runs and writes one append-only observation artifact per run. Its stage and
timing classification is operational evidence only; it has no Framework state,
release-state, retry, rerun, redispatch, cancellation, or mutation authority.

Homebrew mutations are performed inside protected Bundle jobs with the scoped
tap credential. Each cask push is attempted once and accepted only after exact
remote commit and cask digest readback. An unknown result permits at most three
read-only reconciliations and never a second push. GHCR WebUI publishing is explicitly not a desktop
Stable critical-path asset; it remains a separate App-owned continuous server
image publication and runtime-readback path.

## Compatibility And Cutover

`opl_app_release_bundle.v1`, `scripts/release-bundle.ts`, the previous Stable
state machine, operator projection, and broker receipts are historical receipt
compatibility inputs only. Their parsers
may assemble, verify, or report historical state, but they cannot dispatch,
publish, rebuild, promote, or claim release readiness.

The machine policy is
`contracts/app-release-channel.json#release_bundle_control_plane`. The cutover is
complete only after Framework and App authority mains contain their respective
interfaces, the Stable workflow and scheduled Canary match this document,
the `release-stable` protected environment is configured and read back, and a
no-public-mutation canary passes.

Contract or canary success does not itself admit a release or prove a Bundle is
publishable. The live executor performs independent admission and remote
readback.

## Permanently Rejected Bundle

Bundle
`sha256:91d5ea069757fca6bb9aa2280615dc952caeff55b6b4bc13e08e40df32378f49`
is permanently ineligible for checkpoint import, executor handoff, publication,
promotion, or reuse.

## Rejected v26.7.20 Full Artifact

The Full DMG with SHA-256
`3b34e0831609b9c593798d335a757643c4a7f2cfafbe38b818704c03ea42fb1e`
and size `708064535` bytes failed clean-VM configuration because packaged
package bytes did not match the Framework catalog. It is permanently rejected:
do not publish it, retry its upload, or requalify the same bytes. The immutable
receipt is
`docs/delivery/release/incidents/2026-07-20-v26.7.20-full-catalog-mismatch.json`.

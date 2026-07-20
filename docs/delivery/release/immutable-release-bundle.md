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
opl release freeze --request <request.json>
opl release build --bundle <bundle.json> --executor-receipt <receipt.json>
opl release verify --bundle <bundle.json>
opl release publish --bundle <bundle.json> --track <standard|full> --executor-receipt <remote-inspect-receipt.json>
opl release reconcile --bundle <bundle.json>
opl release status --bundle <bundle.json>
```

Framework receipts use `opl_release_bundle_executor_receipt.v1` and
`opl_release_bundle_operation_receipt.v1`; the App references those schemas and
does not duplicate their closed shapes.

The Framework CLI, App adapter, Bundle workflows, and `release-stable`
environment are the live authority. Existing broker and Stable state-machine
receipts remain readable for audit, but they are not a live mutation authority
and cannot dispatch, rerun, cancel, publish, or promote.

## Bundle Identity

App, Shell, and Framework SHAs are necessary but not sufficient. The Bundle
also binds exactly these seven Framework packages:

- `mas`
- `mag`
- `rca`
- `oma`
- `obf`
- `mas-scholar-skills`
- `opl-flow`

The binding is either the exact seven members with package version, owner source
commit, and payload-manifest digest, or an exact Framework Release Set digest
whose readback transitively proves those same members. The Framework catalog or
manifest digest is also frozen. A source checkout, packaged payload, catalog,
manifest, or Release Set mismatch fails before an expensive build.

The canonical Bundle digest also covers the release channel, display version,
updater version,
prepared AI notes plus evidence, Standard assets and qualification, optional
Full assets and qualification, and relevant App product-policy inputs.

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

The updater hard gate installs the previous Latest DMG, discovers and downloads
the same ZIP bound above, applies it without `allowDowngrade`, restarts, proves
`app.getVersion()` equals the Bundle `updater_version`, and then proves a second
check reports no update. The Homebrew cask uses `updater_version` for ordering,
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
`r1` through `r9`.

## Workflow Boundary

`.github/workflows/release-stable.yml` is the only Stable
`workflow_dispatch`. Lower-level release workflows are reusable
`workflow_call` implementation details. Nightly uses the same Framework CLI and
release DAG through `.github/workflows/release-nightly.yml`, is schedule-only,
publishes a prerelease, and can never become Latest.

Only the publish job may receive bounded write permission, under the protected
`release-stable` environment. Every other job is read-only. The publisher is
digest-idempotent: upload a missing asset, treat the same name and digest as
complete, and fail closed on the same name with a different digest. An unknown
API result permits reconcile only, never redispatch, rerun, or cancel.

Homebrew mutations are performed inside protected Bundle jobs with the scoped
tap credential. Each cask push is attempted once and accepted only after exact
remote commit readback. GHCR WebUI publishing is explicitly not a desktop
Stable critical-path asset; it remains a separate App-owned continuous server
image publication and runtime-readback path.

## Compatibility And Cutover

`opl_app_release_bundle.v1`, `scripts/release-bundle.ts`, the previous Stable
state machine, and broker receipts are compatibility inputs only. Their parsers
may assemble, verify, or report historical state, but they cannot dispatch,
publish, rebuild, promote, or claim release readiness.

The machine policy is
`contracts/app-release-channel.json#release_bundle_control_plane`. The cutover is
complete only after Framework and App authority mains contain their respective
interfaces, the Stable and Nightly workflow entrypoints match this document,
the `release-stable` protected environment is configured and read back, and a
no-public-mutation canary passes.

## Rejected v26.7.20 Full Artifact

The Full DMG with SHA-256
`3b34e0831609b9c593798d335a757643c4a7f2cfafbe38b818704c03ea42fb1e`
and size `708064535` bytes failed clean-VM configuration because packaged
package bytes did not match the Framework catalog. It is permanently rejected:
do not publish it, retry its upload, or requalify the same bytes. The immutable
receipt is
`docs/delivery/release/incidents/2026-07-20-v26.7.20-full-catalog-mismatch.json`.

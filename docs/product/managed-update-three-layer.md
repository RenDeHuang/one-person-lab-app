# OPL App Managed Update Model

Owner: `one-person-lab-app`
Purpose: `managed_update_three_layer_product_model`
State: `active_product_support`
Machine boundary: 本文解释 App carrier、Framework lifecycle 与用户状态的分层。
机器真相归 App update/install contracts、Framework update contracts and CLI、source、tests、
lifecycle receipts 与 installed readback；本文不证明 currentness 或 release readiness。

OPL App presents one consistent maintenance experience regardless of how the
App was installed. The implementation is divided into three layers so an
installer never becomes a second update owner.

## 1. Installation Source

The standard updater, signed DMG or installer, Homebrew Cask, Full package, and
every other App runtime carrier declared by the install-exposure registry only
provide candidate App bytes or offline seeds. A copied, downloaded, or bundled
payload is not currentness proof for OPL Base or OPL Packages.

First-party OPL Packages use per-Package GHCR repositories as their official
online storage and delivery carrier:

```text
ghcr.io/<owner>/one-person-lab-packages/<package-id>:<semver>
ghcr.io/<owner>/one-person-lab-packages/<package-id>:latest-stable
```

GHCR stores immutable Package bytes and one Package-owner moving pointer. It
does not decide installed state, App readiness, or a family release cohort. A
thin repository index supplies discovery metadata; the Package owner defines
that source's current stable pointer and Framework follows the configured
source. The legacy
`one-person-lab-manifest:latest-stable` catalog remains only a migration bridge
and Full/offline/QA snapshot, not the target ordinary update source.

On startup after core readiness, the App compares the running App version or
image digest plus carrier identity with its last reconciled checkpoint. A
missing checkpoint means first launch. A changed checkpoint means an install or
upgrade occurred, regardless of which carrier performed it.

## 2. Management Path

OPL Framework is the sole Base and Packages lifecycle owner. The App requests:

```text
opl update check --json
opl update plan --json
opl update apply --json
```

The Framework plan is the only dependency and package update catalog. The App
does not copy that catalog, select package versions, mutate Base or Packages,
delete skills, edit AGENTS.md, or write lifecycle receipts.

For an ordinary first-party Package update, the Framework path is:

```text
repository index -> configured Package source
  -> resolve Package latest-stable to one immutable OCI digest
  -> thin Base OCI adapter downloads the Package
  -> Codex platform activates Plugin/config/cache
  -> Framework activates any Package runtime
  -> one lifecycle receipt + terminal readback
```

Codex Plugin Manager currently accepts local or Git marketplace sources rather
than GHCR OCI references. The OCI adapter is therefore retained only as
transport glue. It must not duplicate marketplace discovery, Plugin state,
config editing semantics, cache ownership, or update currentness already owned
by Codex and Framework. Package runtime bytes outside the Plugin directory must
also be activated when the Package declares them; replacing the full Package
with its Plugin carrier would be a functional regression.

A plan item is eligible for silent background apply only when
`auto_apply.eligible` and `app_background_safe` are both true. The executable
route comes from `command_ref`. Developer checkouts, dirty roots, user-managed
installs, global Homebrew/npm/PATH tools, incompatible changes, and failed
verification remain unchanged and surface as attention with an owner action.

The running-version checkpoint is committed after terminal Framework readback,
including a successful no-op when nothing needs updating. A lifecycle receipt
is required only when apply actually executes. A failed run leaves the
checkpoint pending so the next App startup retries the same idempotent
reconciliation.

## 3. User Behavior

The ordinary UI collapses owner receipts into five states:

| State | User meaning |
| --- | --- |
| Current | No action is needed. |
| Updating in background | A clean OPL-managed target is being verified and applied silently. |
| Restart to finish | A staged OPL Base runtime or App carrier will switch on the next App restart. |
| Refresh Codex recommended | OPL Packages are active, but Codex should refresh its plugin/skill projection. |
| Attention required | A protected, dirty, user-managed, incompatible, or failed target was not overwritten. |

OPL Packages normally activate immediately after the Framework receipt. Package
post-apply hooks own Codex Surface sync and OPL Flow profile migration, including
declared conflict retirement, backup, semantic merge, rollback receipt, and a
review packet when automatic merge cannot complete.

Package owners advance their Package independently. One Package publication or
update must not require a new App, Base, Full, Release Set, or unrelated Package
publication. Daily automation may reconcile the thin index and audit anonymous
readback, but cadence never becomes a shared publisher.

Required dependencies are checked by Package id and usable platform surface.
They do not default to SemVer/ABI range solving. A version or ABI condition may
exist only when the Package owner can demonstrate an actual runtime
incompatibility that presence checking cannot detect.

OPL Base runtime generations are downloaded, verified, and staged in the
background, then switched on the next App restart with a rollback reference.
The App carrier follows its own updater or host route and counts as installed
only after the new version or image is actually running.

## Authority Boundary

The App owns the user-facing states, carrier update UI, and request timing. OPL
Framework owns Base and Packages catalogs, plan eligibility, execution,
activation, rollback, and receipts. OPL Package manifests own their declared
post-apply hooks. The shell only schedules the request and renders App/Framework
readback.

GHCR owns immutable transport bytes, Codex owns Plugin/config/cache mechanics,
and Full/Release Set owns only the exact offline or reproducible snapshot it
builds. None of those surfaces may independently claim ordinary Package
currentness.

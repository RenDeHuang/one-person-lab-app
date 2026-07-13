# OPL App Managed Update Model

OPL App presents one consistent maintenance experience regardless of how the
App was installed. The implementation is divided into three layers so an
installer never becomes a second update owner.

## 1. Installation Source

The standard updater, signed DMG or installer, Homebrew Cask, Full package, and
every other App runtime carrier declared by the install-exposure registry only
provide candidate App bytes or offline seeds. A copied, downloaded, or bundled
payload is not currentness proof for OPL Base or OPL Packages.

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

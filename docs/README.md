# One Person Lab App Docs

Owner: `one-person-lab-app`
Purpose: `app_docs_entry`
State: `active`
Machine boundary: Human-readable App documentation. Machine-readable truth lives
in `contracts/`, source, release artifacts, updater metadata, and test results.

This documentation set describes the end-user App repository. It does not define
OPL Framework runtime truth or MAS/MAG/RCA domain truth.

## Current Docs

- [`status.md`](status.md): current App repository and active shell status.
- [`release/`](release/): App release, updater, and Full first-install notes.
- [`testing/`](testing/): App validation and page-state test guidance.
- [`user-guides/`](user-guides/): user-facing guide entry point.
- [`screenshots/`](screenshots/): screenshot and visual tutorial asset entry.
- [`history/`](history/): retired App topology and migration notes.

The App-owned product profile lives at
[`../contracts/app-product-profile.json`](../contracts/app-product-profile.json).
It is the machine-readable source for desktop session defaults, visible
companion skills, first-run maintenance behavior, and Settings presentation
policy. Release preparation generates the shell-facing copy consumed by
`opl-aion-shell`.

The current stable GUI shell is checked out at `shells/aionui/` from
`gaofeng21cn/opl-aion-shell`. AionUI-specific implementation docs remain in the
shell repository. This App repository keeps only App-owned product, release,
contract, and user documentation in its default branch.

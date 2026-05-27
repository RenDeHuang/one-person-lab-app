# One Person Lab App Docs

Owner: `one-person-lab-app`
Purpose: `app_docs_entry`
State: `active`
Machine boundary: Human-readable App documentation. Machine-readable truth lives
in `contracts/`, source, release artifacts, updater metadata, and test results.

This documentation set describes the end-user App repository. The App owns GUI
truth, release policy, and App-owned documentation. OPL Framework owns the
`opl app state` and `opl app action` producers consumed by the GUI bridge. The
active shell is a replaceable renderer and adapter; it does not become product,
runtime, provider, or domain authority.

## Current Docs

- [`active/app-ideal-state-gap-plan.md`](active/app-ideal-state-gap-plan.md):
  App product active truth, current gaps, and next-round governance baton.
- [`status.md`](status.md): current App repository and active shell status.
- [`project.md`](project.md): App product repository role and ownership boundary.
- [`architecture.md`](architecture.md): App, shell, OPL Framework, and domain-agent ownership split.
- [`invariants.md`](invariants.md): App repository invariants and non-ownership rules.
- [`decisions.md`](decisions.md): still-active App product, shell, runtime bridge, release, and docs lifecycle decisions.
- [`release/`](release/): App release, updater, and Full first-install notes.
- [`testing/`](testing/): App validation and page-state test guidance.
- [`user-guides/`](user-guides/): user-facing guide entry point.
- [`screenshots/`](screenshots/): screenshot and visual tutorial asset entry.
- [`history/`](history/): retired App topology and migration notes.

The App-owned product profile lives at
[`../contracts/app-product-profile.json`](../contracts/app-product-profile.json).
It is the machine-readable source for desktop session defaults, visible
companion skills, first-run maintenance behavior, Settings presentation policy,
and GUI product defaults. Release preparation generates the shell-facing copy
consumed by `opl-aion-shell`.

The current stable GUI shell is checked out at `shells/aionui/` from
`gaofeng21cn/opl-aion-shell`. AionUI-specific implementation docs remain in the
shell repository. This App repository keeps only App-owned product, release,
contract, and user documentation in its default branch. A future GUI shell must
enter as `shells/<candidate>` and pass the App-owned shell adapter, product
profile sync, page-state, first-run, validation, and package compile gates
before it can become active.

`contracts/app-runtime-bridge.json` also declares an opt-in live conformance
gate. Normal local and CI validation does not require a live Framework checkout.
When explicitly enabled with `OPL_APP_LIVE_CONFORMANCE=1`, the App validation
checks a local OPL root's `./bin/opl app state/action` protocol without copying
runtime or domain truth into this repo.

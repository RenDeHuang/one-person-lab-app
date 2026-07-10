# GUI Shell Candidates

Owner: `one-person-lab-app`
Purpose: `gui_shell_candidate_map`
State: `active`
Machine boundary: Human-readable map for active and candidate GUI shells.
Machine truth lives in `contracts/app-shell-adapter.json`,
`contracts/app-shell-candidates.json`, `contracts/shell-adapters/*.json`,
package scripts, validation output, and candidate package artifacts.

## Current Map

| Role | Shell | Physical checkout | Adapter contract | Default scope |
| --- | --- | --- | --- | --- |
| Active App GUI | `aionui` | `shells/aionui` or `OPL_APP_SHELL_ROOT` | `contracts/app-shell-adapter.json` | Stable/nightly App wrapper commands |
| Foreground candidate | `opl-native-workbench` | `shells/opl-native-workbench` or `../opl-native-workbench` | `contracts/shell-adapters/opl-native-workbench.json` | Default candidate validation |
| Retained candidate | `hermes-codex` | `shells/hermes` or `../opl-hermes-shell` | `contracts/shell-adapters/hermes-codex.json` | Explicit candidate validation and package builds |
| Archived proof | `agui-codex` | `shells/agui-codex` | `contracts/shell-adapters/agui-codex.json` | Explicit AGUI replay only |

Stable role marker:
`gui_shell_roles: active=aionui; foreground=opl-native-workbench; retained=hermes-codex; archived=agui-codex`.

Hermes Desktop / `hermes-codex` is not cleanup waste. It is a retained
candidate line: keep its adapter contract, wrapper commands, and checkout
policy unless the App owner explicitly retires the candidate.

## Design System Governance

The governance entry is `docs/product/gui/README.md`. It routes
the three-layer definition stack and the four foundation documents:

- Product definition: `docs/product/gui/README.md`,
  `docs/product/gui/ideal-interaction-spec.md`,
  `docs/product/gui/codex-to-opl-app-delta.md`,
  `docs/product/gui/feature-inventory.md`, and App contracts.
- Visual system: `docs/product/gui/visual-system.md`.
- Shell implementation and conformance:
  `docs/product/gui/shell-implementation-guide.md` and
  `docs/product/gui/shell-conformance-matrix.md`.

The priority marker is
`gui_definition_stack: product_definition > visual_system > shell_implementation_conformance`.
Shell authority is `gui_shell_authority: implementation_only`: a shell
implements the higher layers and records deviations, but cannot reverse-define
the product from renderer code, screenshots, upstream defaults, or visual QA.

The current visual and interaction reference is ChatGPT Codex macOS
`26.707.31123` observed on `2026-07-10`. The ideal/native target keeps the
desktop workspace/session rail visible and the inspector closed by default.
The conformance matrix reads active AionUI state from
`contracts/app-product-profile.json#gui.home.home_layout`, compares it with the
App-owned ideal, and allows later active convergence without copying or freezing
the current profile value.

## Commands

Validate the default active GUI:

```bash
npm run validate:active-shell -- --quick
```

Validate retained or foreground candidates without changing the active GUI:

```bash
npm run validate:shell-candidates
npm run validate:candidate:native
npm run validate:candidate:hermes
```

Build explicit candidate apps through the App wrapper:

```bash
npm run package:candidate:native
npm run package:candidate:hermes
```

If the candidate checkout is a sibling repo instead of `shells/<candidate>`,
set `OPL_APP_SHELL_ROOT` for that command:

```bash
OPL_APP_SHELL_ROOT=../opl-hermes-shell npm run package:candidate:hermes
OPL_APP_SHELL_ROOT=../opl-native-workbench npm run package:candidate:native
```

## Boundaries

Candidate package builds are technical candidate artifacts. They do not switch
the active release shell, stable/nightly release packaging, release readiness,
owner acceptance, runtime truth, domain truth, artifact authority, or current
App release status.

The active GUI changes only when `contracts/app-shell-adapter.json` is edited
and the App shell adapter, product profile, page-state, first-run, package,
release, and owner gates pass for that adoption.

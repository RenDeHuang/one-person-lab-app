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

Hermes Desktop / `hermes-codex` is not cleanup waste. It is a retained
candidate line: keep its adapter contract, wrapper commands, and checkout
policy unless the App owner explicitly retires the candidate.

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

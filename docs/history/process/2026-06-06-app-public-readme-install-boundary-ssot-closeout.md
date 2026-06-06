# 2026-06-06 App public README install boundary SSOT closeout

Owner: `one-person-lab-app`
Purpose: `app_public_readme_install_boundary_ssot_closeout`
State: `history_provenance`
Machine boundary: Human-readable closeout ledger. Current App release, install, updater, Full package, Homebrew, local authorization, Runtime page bridge, and agent exposure truth stays in `contracts/`, release workflows, release scripts, updater metadata, release artifacts, validation scripts, tests, and active App status docs.

## Snapshot

- `RUN_SNAPSHOT_TS`: `2026-06-06T11:20:00Z`
- Repo: `/Users/gaofeng/workspace/one-person-lab-app`
- Semantic theme: `public README narrative / install-release boundary coverage`
- Governance mode: SSOT-first content-level audit. Start from public README role, then classify install/release/runtime/agent-exposure details against contracts, release guide, user guides, status, and active gap plan.

## Single Source Of Truth

Public entry owner:

- `README.md`
- `README.zh-CN.md`

These files own the public product narrative, user-facing install choices, and next-hop navigation. They do not own release gates, updater metadata, Full package contents, local authorization policy, App runtime bridge truth, Codex plugin exposure truth, domain skill semantics, or evidence readiness.

Machine SSOT:

- `contracts/app-release-channel.json`
  - owns standard versus Full package boundaries, updater visibility, Homebrew cask distribution, Full first-install policy, Stable local authorization, release evidence gates, and workflow shape.
- `contracts/app-install-exposure-policy.json`
  - owns App install/exposure policy, Codex-visible skill/plugin exposure, App-managed maintenance, and duplicate skill prevention.
- `contracts/app-runtime-bridge.json`
  - owns App Runtime page bridge behavior and fast/full/detail read-model boundaries.
- Release workflows, scripts, updater metadata, release artifacts, and release-boundary tests own executable release truth.

Human support owners:

- `docs/release/README.md` owns release/operator runbook details.
- `docs/user-guides/` owns screenshot-based install walkthroughs and generated user-facing guide artifacts.
- `docs/status.md` owns current App status summary.
- `docs/active/app-ideal-state-gap-plan.md` owns remaining App product gaps and next-round prompt.

## Peer Surface Classification

| Surface | Classification | Action |
| --- | --- | --- |
| `README.md` install and technical sections | `current_public_entry` mixed with `covered_by_ssot` detail | Kept user choices, commands, and next-hop links; thinned Homebrew, one-shot, Stable helper, Full package, release/updater, Runtime bridge, and agent-exposure implementation detail into pointers. |
| `README.zh-CN.md` install and technical sections | `current_public_entry` mixed with `covered_by_ssot` detail | Kept bilingual parity with the English README and removed duplicated release/install implementation detail from the public entry. |
| `docs/release/README.md` | `more_specific_detail` | Kept as release/operator SSOT for Homebrew, Stable, Full, updater, local authorization, VM, and evidence gates. |
| `docs/user-guides/**` | `more_specific_detail` | Kept as install walkthrough/generator support; README points to the generated guide outputs. |
| `docs/status.md` and `docs/active/app-ideal-state-gap-plan.md` | `covered_by_ssot` human current/active owners | Kept as current status and gap owners. README now points to them instead of duplicating current state machinery. |
| `contracts/*.json`, release workflows, scripts, and tests | `machine_ssot` | Read as current truth; not edited in this docs-only lane. |

## Content-Level Consolidation

- The public README no longer repeats detailed release mechanics, signed/unsigned App handling, local authorization helper flags, Gatekeeper/codesign/spctl diagnostics, Full payload component lists, plugin/skill sync mechanics, Temporal provider configuration, duplicate skill guard commands, first-run Core/Full readiness internals, or Runtime bridge field ordering.
- The public README keeps public product narrative, Homebrew, one-shot installer, stable install helper, direct download, Full package, update entry paths, user guide links, App/domain/framework boundary summary, and technical next-hop links.
- Release/install/runtime/agent-exposure details are now routed by owner: contracts for machine truth, `docs/release/README.md` for operator detail, `docs/status.md` for current summary, and `docs/active/app-ideal-state-gap-plan.md` for remaining gaps.

## Verification

Commands run from `/Users/gaofeng/workspace/one-person-lab-app`:

```bash
rtk git diff --check
rtk rg -n "^(<<<<<<<|=======|>>>>>>>)" README.md README.zh-CN.md docs/history/process/README.md docs/history/process/2026-06-06-app-public-readme-install-boundary-ssot-closeout.md
rtk rg -n "authorize-local|Developer ID|Gatekeeper|quarantine|codesign|spctl|Temporal provider|plugin/skill sync|module reconciliation|one-person-lab-modules|agent-specific Homebrew|agent 专属 Homebrew|Full DMG|latest Full|current Stable install path|standard updater metadata|release cohort|local authorization" README.md README.zh-CN.md
rtk /Users/gaofeng/.local/bin/opl-doc-doctor doctor . --format json
```

Result:

- `git diff --check` passed.
- Conflict-marker scan found no matches.
- Targeted README stale detail scan found no matches.
- OPL Doc doctor reported `finding_count=0`.

## Remaining Scope

This lane closes the public README install/release boundary pass. It does not publish a release, change release workflows, change contracts, regenerate guide artifacts, retire the legacy tag-push workflow, create new Full VM evidence, or close the broader App docs portfolio. Future App lanes should continue with future-cohort Full VM artifacts, user-guide/screenshot freshness, or broader docs portfolio sections after fresh SSOT intake.

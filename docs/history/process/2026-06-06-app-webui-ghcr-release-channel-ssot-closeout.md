# 2026-06-06 App WebUI GHCR release-channel SSOT closeout

Owner: `one-person-lab-app`
Purpose: `app_webui_ghcr_release_channel_docs_governance_closeout`
State: `history_provenance`
Machine boundary: Human-readable closeout ledger. Current WebUI GHCR release truth stays in `contracts/app-release-channel.json`, App release workflows, release readiness summaries, GHCR package settings, validation scripts, tests, and release artifacts.

## Snapshot

- Repo: `/Users/gaofeng/workspace/one-person-lab-app`
- Semantic theme: `WebUI GHCR publishing and release-train stop-condition boundary`
- Governance mode: SSOT-first content-level audit. Start from the release-channel contract, then classify release guide, release-train design, workflow tests, scripts docs, and history/provenance surfaces.

## Single Source Of Truth

Machine SSOT:

- `contracts/app-release-channel.json#webui_ghcr_image`
  - owns App-side WebUI GHCR image coordinate, stable/nightly tags, OCI source label, App-owned publishing role, Framework references-only role, Full DMG exclusion, package access requirements, and retention policy.
  - owns the GHCR package settings boundary: `one-person-lab-webui` must grant write Actions access to `gaofeng21cn/one-person-lab-app`, and package association should point to the App repo through GitHub Packages settings UI when available.
  - owns the fail-closed signal for missing GHCR package write access: `permission_denied: write_package` and `ghcr_write_package_denied`.
- `.github/workflows/desktop-release.yml` and `.github/workflows/nightly-standard-release.yml`
  - own the actual publish jobs, Docker/WebUI smoke ordering, pushed tags, and source labels.
- `scripts/summarize-release-readiness.ts` and `scripts/cleanup-webui-ghcr-versions.ts`
  - own readiness readout and dry-run-first GHCR cleanup behavior.
- `tests/release/app-release-boundary-cases/workflow-release-channels.ts`, `tests/release/release-readiness/readiness-summary-cases.ts`, and `tests/release/webui-ghcr-cleanup.test.ts`
  - guard App-owned publish semantics, required tags, package access failure readout, and cleanup retention behavior.

Human-doc owners:

- `docs/release/README.md`
  - owns operator-facing release guide wording and must point to the machine contract instead of carrying dated policy as a second truth.
- `docs/release/release-train-optimization-design.md`
  - owns release train design principles and should keep reusable stop conditions, not one historical run id.
- `scripts/README.md`
  - owns script/runbook support notes; it already keeps GHCR cleanup as dry-run-first package admin operation.

## Peer Docs Classification

| Document / section | Classification | Action |
| --- | --- | --- |
| `contracts/app-release-channel.json#webui_ghcr_image` | `covered_by_ssot` machine owner | No edit. It already owns coordinate, tags, App owner role, Framework references-only role, GHCR package access, and retention. |
| `.github/workflows/desktop-release.yml`, `.github/workflows/nightly-standard-release.yml` | `covered_by_ssot` workflow truth | No edit. Publish jobs and tag behavior remain workflow-owned. |
| `tests/release/app-release-boundary-cases/workflow-release-channels.ts` | `covered_by_ssot` guard | No edit. It still guards `Manage Actions access`, `permission_denied: write_package`, `ghcr_write_package_denied`, Framework image-coordinate-only role, and Full DMG exclusion. |
| `docs/release/README.md` / WebUI GHCR tail section | `covered_by_ssot` duplicate plus `history_or_provenance` dated wording | Rewrote dated `2026-06-01 release policy` prose into a current contract-pointer boundary. Kept operator-critical failure and package-settings terms. |
| `docs/release/README.md` / Stable stop conditions | `history_or_provenance` pollution | Removed the historical run id from active runbook language. Kept the structured stop condition. |
| `docs/release/release-train-optimization-design.md` / CI polling layer | `history_or_provenance` pollution | Removed the historical run id from active design. Kept the general release-train rule. |
| `scripts/README.md` / release operations notes | `more_specific_detail` support plus `history_or_provenance` pollution | Kept the GHCR cleanup support note and removed the historical run id from active script runbook language. |
| `docs/history/process/*` previous release closeouts | `history_or_provenance` | Left as provenance. This closeout records the new WebUI GHCR SSOT lane. |

## Content-Level Consolidation

- WebUI GHCR publishing current truth now has one semantic owner: `contracts/app-release-channel.json#webui_ghcr_image`.
- The release guide now mirrors the contract boundary instead of presenting the GHCR rule as a dated release policy.
- Active release-train docs and script runbooks no longer preserve the historical run id `019e9556`; reusable stop conditions remain tied to candidate records, readiness summaries, remote verification JSON, and named gate results.
- No release contract, workflow, test, script, updater metadata, package artifact, GHCR package setting, or release asset changed in this lane.

## Verification

Commands run from `/Users/gaofeng/workspace/one-person-lab-app`:

```bash
rtk git diff --check
rtk rg -n "^(<<<<<<<|=======|>>>>>>>)" docs/release docs/history/process scripts/README.md
rtk rg -n "019e9556|2026-06-01 release policy" docs/release scripts/README.md
rtk /Users/gaofeng/.local/bin/opl-doc-doctor doctor . --format json
rtk node --experimental-strip-types --test tests/release/app-release-boundary.test.ts --test-name-pattern "stable validation profile covers every user installation surface|release automation workflows cover remote verification, Full cache warmup, and draft promotion|release CI operations policy distinguishes workflow hygiene from release evidence"
```

Result:

- `git diff --check` passed.
- Conflict-marker scan found no matches.
- The stale active/support scan found no remaining `019e9556` or `2026-06-01 release policy` in `docs/release` or `scripts/README.md`.
- OPL Doc doctor reported `finding_count=0`.
- `node --experimental-strip-types --test tests/release/app-release-boundary.test.ts --test-name-pattern "stable validation profile covers every user installation surface|release automation workflows cover remote verification, Full cache warmup, and draft promotion|release CI operations policy distinguishes workflow hygiene from release evidence"` passed. Node's test-name matching still loaded the full release-boundary file; result was `86` tests passed.

## Remaining Scope

This lane covers App WebUI GHCR release-channel docs and release-train stop-condition wording. It does not complete the App docs portfolio or global six-repo OPL series docs governance goal.

Carry forward:

- `docs/release/README.md` remains a long active operator runbook. Future lanes can continue compressing long current-support sections only after identifying their machine SSOT and the tests that bind human guide wording.
- Release guide sections with concrete version baselines, package-size thresholds, VM workflow settings, Homebrew tap policy, and Full payload details remain scoped support material unless a future SSOT lane proves they are stale or duplicated.
- Full OPL series coverage still requires continuing the six-repo ledger until every `README*` and `docs/**/*.md` section is reviewed or explicitly carried forward.

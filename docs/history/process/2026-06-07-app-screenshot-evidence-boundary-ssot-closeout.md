# 2026-06-07 App screenshot evidence boundary closeout

Owner: `one-person-lab-app`
Purpose: `app_screenshot_evidence_boundary_ssot_closeout`
State: `history_provenance`
Machine boundary: Human-readable no-rewrite closeout. Current release screenshot evidence truth stays in `contracts/app-release-channel.json#operator_evidence_bundle`, release evidence manifests, `scripts/validate-release-evidence-bundle.ts`, `scripts/validate-active-shell/release-contract-validator.ts`, release-boundary tests, release artifacts, and generated user-guide manifests.

## Semantic Theme

`screenshot_visual_guide_vs_release_evidence_boundary`: App screenshots can be user-guide assets, release evidence bundle artifacts, or shell/test implementation artifacts. They must not become a second source for runtime truth, domain truth, artifact authority, quality verdict, App release readiness, or family production readiness.

## Single Source Of Truth

- Release evidence screenshot SSOT: `contracts/app-release-channel.json#operator_evidence_bundle`.
- Release contract validator SSOT: `scripts/validate-active-shell/release-contract-validator.ts`.
- Evidence bundle validator SSOT: `scripts/validate-release-evidence-bundle.ts`.
- Release-boundary test SSOT: `tests/release/app-release-boundary-cases/runtime-page-evidence-boundary.ts`, `tests/release/app-release-boundary-cases/release-evidence-validation.ts`, and release evidence collector tests.
- User-guide screenshot SSOT: `docs/user-guides/macos-app-install-assets.json` plus generated verification JSON.

These owners beat prose because they define required artifact ids, paths, image policy, missing evidence policy, dimensions, byte checks, and generated guide provenance.

## Peer Docs / Evidence

| Surface | Classification | Decision |
| --- | --- | --- |
| `docs/screenshots/README.md` | `covered_by_ssot` | No rewrite. It is a visual guide index and already points release screenshots back to the release evidence bundle. |
| `docs/user-guides/README.md` | `more_specific_detail` | No rewrite. It correctly owns user-guide source/asset regeneration and treats generated outputs as artifacts. |
| `docs/release/README.md` | `more_specific_detail` | No rewrite. It keeps operator runbook detail for release evidence capture and post-promotion user-guide screenshot refresh. |
| `docs/testing/README.md` | `more_specific_detail` | No rewrite. It describes validation commands and release evidence bundle expectations without becoming screenshot SSOT. |
| `README.md` / `README.zh-CN.md` | `covered_by_ssot` | No rewrite. Public entries point users to the generated install guide and release guide without claiming screenshots prove readiness. |
| `contracts/app-release-channel.json#operator_evidence_bundle` | `machine_ssot` | Owns required release screenshot ids and paths, missing evidence policy, refs-only role, and image evidence policy. |
| Release validators and tests | `machine_ssot` / `more_specific_detail` | Own real screenshot byte/dimension checks, placeholder rejection, artifact classification, and no-readiness-overclaim guards. |

## No-Rewrite Decision

No current App doc in the audited peer set needs compression or rewrite for this lane:

- `docs/screenshots/README.md` is already an index, not a release-evidence owner.
- Required release screenshot paths are contract-owned: `screenshots/runtime.png`, `screenshots/full.png`, and `screenshots/action.png`.
- Placeholder and undersized screenshot rejection is validator/test-owned.
- User-guide screenshot provenance is manifest-owned and generator-verified.
- Current docs do not use screenshots as proof of runtime truth, domain readiness, quality/export verdict, App release readiness, or family production readiness.

## Retired / Guarded Surface

The retired semantic surface is any prose that treats screenshot presence, screenshot directory membership, user-guide assets, or shell-local screenshots as release-ready proof or as runtime/domain/artifact authority. That surface remains guarded by release evidence classification, image evidence validation, refs-only wording, and history provenance. No compatibility alias, facade, wrapper, or second screenshot truth owner was added.

## Verification

Commands run from `/Users/gaofeng/workspace/one-person-lab-app`:

```bash
rtk rg -n "operator_evidence_bundle|runtime_screenshot|full_screenshot|action_screenshot|placeholder_screenshot|screenshots/runtime.png|screenshots/full.png|screenshots/action.png|image_evidence_policy|screenshot" contracts/app-release-channel.json scripts/validate-active-shell/release-contract-validator.ts scripts/validate-release-evidence-bundle.ts tests docs/release/README.md docs/testing/README.md docs/screenshots/README.md docs/user-guides/README.md
rtk jq '.operator_evidence_bundle' contracts/app-release-channel.json
```

Result:

- The release contract declares the screenshot artifact ids and paths plus `placeholder_screenshot_allowed=false`.
- The release contract validator checks image policy and required screenshot paths.
- The evidence bundle validator rejects placeholder, invalid, unreadable, or undersized image evidence.
- Release-boundary tests cover runtime/full/action screenshots, assistant route smoke screenshots, artifact status classification, missing evidence behavior, and image policy validation.
- Current screenshot and user-guide docs remain user-facing support/index docs, not machine truth owners.

Additional scoped verification for this closeout:

```bash
rtk git diff --check
rtk sh -lc '! rg -n "^(<<<<<<<|=======|>>>>>>>)" docs/history/process/README.md docs/history/process/2026-06-07-app-screenshot-evidence-boundary-ssot-closeout.md'
python3 /Users/gaofeng/workspace/opl-doc/scripts/opl_doc_doctor.py doctor /Users/gaofeng/workspace/one-person-lab-app --format json
```

## Remaining Scope

This lane does not create new screenshots, run VM capture, regenerate user guides, publish a release, promote Stable/latest, alter release contracts, change screenshot validation, or close future release evidence gaps. Broader App docs portfolio coverage remains open under the global OPL series goal.

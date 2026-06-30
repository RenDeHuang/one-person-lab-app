# Settings Control Center Completion Audit

Owner: `one-person-lab-app`
Purpose: `settings_control_center_completion_audit`
State: `active_audit`
Audit date: `2026-06-30`
Machine boundary: Human-readable completion audit. Machine-readable Settings
truth stays in `contracts/app-settings-control-plane.json`,
`contracts/app-gui-product-contract.json`, `contracts/app-page-state-matrix.json`,
the active shell source, validators, tests, and release/user-path evidence.

## Scope

This audit uses
`contracts/app-settings-control-plane.json#product_system_checklist` as the
completion source for the Settings Control Center product-system plan. The
checklist supersedes older page-by-page planning notes: it tracks the Control
Center product system, shell adapter boundary, state/action protocol, user task
UX, visual evidence, lane hygiene, and release/currentness separation.

The audit deliberately separates three evidence classes:

- Settings product-system evidence: App contracts, page-state matrix, product
  profile projection, active-shell validation, shell route/DOM tests, and visual
  QA manifest.
- Release-owner evidence: release workflow, release artifacts, owner receipts,
  and GitHub release readback for a concrete cohort.
- Installed/running currentness evidence: notarization, installed App version,
  running App version, and local user-path readback. These are not implied by
  Settings tests or by the Settings visual manifest.

## Fresh Evidence

Fresh evidence used for this audit:

- App remote main: `62ca6b9b6e9b1ad18bdaa18ec27c58d9edd4e176`.
- Shell main: `7a7120cc2bd6fd725f4805f4819543959a36ae9d`, aligned with
  live `gh-https/main`.
- Settings checklist source:
  `contracts/app-settings-control-plane.json#product_system_checklist`.
- Product profile projection:
  `contracts/app-product-profile.json#settings.control_plane`.
- Settings design and validation boundary:
  `docs/product/gui/settings-control-center.md`.
- Shell visual QA manifest:
  `/Users/gaofeng/workspace/opl-aion-shell/tests/e2e/screenshots/settings-control-center-manifest.json`.
  The manifest was regenerated on `2026-06-30T02:46:31.904Z`, has 22 entries,
  records commit `7a7120cc2bd6fd725f4805f4819543959a36ae9d`, has no coverage
  gaps, and keeps `release_readiness_claim: false`.
- Release owner record:
  `docs/delivery/release/records/v26.6.29-release-owner-receipt.json`.
- GitHub release readback:
  `gh release view v26.6.29 --repo gaofeng21cn/one-person-lab-app`.
- GitHub release workflow readback:
  `gh run view 28412088570 --repo gaofeng21cn/one-person-lab-app`.

Important local-state caveat: the App root checkout had unrelated uncommitted
user-guide and slide-generation edits, and the existing
`codex/app-functional-closure` worktree carried unrelated uncommitted contract
validator edits. This audit work intentionally avoided both write sets.

## Completion Table

| Checklist item | Status | Completion | Fresh evidence | Gap or boundary |
| --- | --- | ---: | --- | --- |
| Control Center positioning | done | 100% | `docs/product/gui/settings-control-center.md` defines Settings as OPL Control Center; App control-plane contract and shell visual manifest use the Control Center framing. | No Settings product gap found. |
| Seven-entry IA | done | 100% | `contracts/app-settings-control-plane.json#ordinary_routes` and product profile projection list exactly `general`, `access`, `capabilities`, `environment`, `storage`, `appearance`, `advanced`; shell visual manifest covers the seven route paths. | Route ids intentionally remain shell implementation ids, not prose group names. |
| Secondary route strategy | done | 100% | Contract and product profile list `about`, `update`, `theme`, `workspace`, `local-services` as secondary/deep-link pages; visual manifest covers Workspace and Local Services. | About/Update/Theme are secondary by contract, not ordinary tabs. |
| Single Settings Control Plane | done | 100% | `contracts/app-settings-control-plane.json` owns routes, slots, redirects, search policy, visual QA policy, page adapter policy, and checklist; product profile projection points back to this contract. | Future IA changes must update contract, projection, validators, and tests together. |
| Host adapter slot | done | 100% | Control-plane contract declares `SettingsHost` and `SettingsShellAdapterSlot`; active-shell adapter contract and validators require the slot boundary. | This proves App-owned slot/registry behavior, not a full source-code inventory of every renderer component. |
| View-model layer | done | 95% | Contract requires typed adapters for Access, Maintenance, Storage, and Capabilities and names the adapter entries; shell main has absorbed the adapter lanes. | Main `RuntimeSettings` can still be further split for maintainability, but the required adapter boundary is present. |
| Issue/action protocol | done | 100% | `settings_ia.v1` protocols define issue statuses, action route, card fields, confirmation fields, diagnostics policy, and post-update notice fields. | Runtime/domain truth remains outside App and shell ownership. |
| Make OPL usable reconcile | done | 95% | `make_usable_action` protocol declares allowed steps, forbidden steps, post-action notice, and safe composite boundary. | It remains a shell-orchestrated composite over existing actions, not a new updater kernel. |
| Maintenance noise reduction | done | 95% | Maintenance design and protocols require summary, recommendation, disclosure, and capability/package status instead of competing update planes. | Fine-grained visual polish can continue, but no structural duplicate update-plane gap remains. |
| Update/rollback UX | done | 95% | Confirmation and post-update notice protocols require `will_change`, `will_not_change`, receipt/rollback reference, next check, and restart/reload guidance. | Live rollback success is a component/action evidence issue, not Settings IA evidence. |
| Workspace task page | done | 100% | Workspace is a declared secondary route, visible through Overview task entry policy, and included in shell visual manifest coverage. | Real filesystem permission repair still depends on action/runtime evidence for a concrete user machine. |
| Local Services page | done | 100% | Local Services is a declared secondary Maintenance route and included in shell visual manifest coverage. | Starting/restarting concrete services remains runtime-action evidence, not contract evidence. |
| Access / Model & Account | done | 95% | Access route is ordinary, adapter policy forbids raw provider implementation as ordinary UI, and visual manifest includes API key/configuration anchors plus Web/Remote anchor. | Real model access still requires live account/API-key verification. |
| Capabilities experience | done | 95% | Capabilities route is ordinary, purpose-based, adapter-backed, and covered by the shell visual manifest. | Domain capability quality/export verdicts remain domain-owner evidence, not App Settings evidence. |
| Data & Storage safety | done | 95% | Storage is an ordinary top-level route; adapter policy and design require inventory, preview, receipt, and safety language; visual manifest covers Storage. | Actual cleanup/restore proof is per-action evidence for a real execution. |
| Preferences purity | done | 100% | Appearance route maps to Preferences; docs explicitly keep maintenance, account, and About controls elsewhere. | No Settings product gap found. |
| Advanced diagnostics | done | 100% | Diagnostics protocol requires collapsed advanced-only visibility; About is secondary/deep-link; visual QA policy includes diagnostics-collapsed anchors. | Raw evidence remains available by disclosure; it is intentionally not ordinary setup content. |
| Developer Profile warning | done | 95% | Contract and docs assign Developer Profile/source/dirty checkout impact to Advanced and Maintenance copy. | Real developer checkout state remains runtime/local readback, not static product evidence. |
| User copy system | done | 95% | Card protocol requires summary and recommended action; diagnostics policy gates raw refs; visual/DOM evidence protects ordinary anchors. | Future copy changes should keep avoiding unexplained dry-run/plan/apply-selected wording. |
| Settings search | done | 100% | `settings_search` protocol covers route labels, task entries, action keywords, secondary pages, and empty state without internal ids; shell visual manifest includes `settings_search_empty_state`. | No Settings product gap found. |
| Visual system | done | 95% | Docs define the quiet engineering-control-center visual system; visual manifest covers desktop and mobile route framing with no coverage gaps. | This is screenshot/anchor evidence, not a design QA claim that no further aesthetic polish is possible. |
| Screenshot QA | done | 100% | Visual manifest schema is present, records command/commit/route/viewport/screenshot path/status anchors, covers seven top-level routes plus Workspace and Local Services, has `coverage_gaps: []`, and is bound to Shell commit `7a7120cc2bd6fd725f4805f4819543959a36ae9d`. | Manifest explicitly has `release_readiness_claim: false`. |
| Contract validators | done | 100% | Settings control-plane validator and release-boundary test cover checklist, route behavior, legacy redirects, promotion drift, slot boundary, visual QA policy, and release/currentness separation. | Validators prevent structural drift; they do not prove installed App readiness. |
| Worktree/lane hygiene | partial | 85% | Settings lanes in the ops ledger are absorbed; Shell root is aligned to live remote main; this audit work is isolated in a dedicated documentation worktree. | App root currently has unrelated user-guide/slide-generation edits, and an existing unrelated worktree has uncommitted contract validator edits. These are not Settings completion blockers but prevent a repo-wide-clean claim. |
| Installed/release currentness separation | done for Settings boundary; partial for release evidence | 85% | Settings contract and visual manifest forbid release/currentness claims; v26.6.29 owner receipt is recorded; GitHub release `v26.6.29` is published and remote release readback lists standard and Full assets. | Do not claim installed/running App currentness or notarization from Settings evidence. Local installed App version and running-version readback remain separate release/user-path gates. |

## Summary

Settings Control Center product-system completion is effectively closed: the
Control Center IA, App-owned control plane, shell adapter slot, view-model
boundary, state/action protocols, user task UX, visual QA manifest, and drift
validators are now all represented in durable App-owned surfaces and the active
shell evidence surface.

The remaining caution is not a Settings implementation gap. It is an evidence
boundary: release-owner and installed/running currentness claims must continue to
come from release and user-path evidence. The v26.6.29 owner receipt and GitHub
release readback improve the release evidence row, but they still do not turn
Settings tests, contract validators, or visual QA into installed App currentness
proof.

## Recommended Order From Here

1. Keep `contracts/app-settings-control-plane.json` as the first stop for any
   future Settings IA or upstream AionUI Settings intake change.
2. Keep shell Settings implementation changes behind `SettingsHost`,
   `SettingsShellAdapterSlot`, and typed view-model adapters.
3. Treat future copy, visual, or action changes as incremental polish unless a
   validator or visual manifest gap reappears.
4. Route installed App, notarization, running-version, and same-cohort user-path
   evidence through release owner gates, not Settings completion audits.

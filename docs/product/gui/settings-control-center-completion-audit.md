
# Settings Control Center Completion Audit

Audit date: 2026-07-10
Authority owner: one-person-lab-app
Scope: Settings product contracts, page-state matrix, documentation, validators,
and focused contract tests

## Conclusion

The App product-authority and Shell implementation slices recorded by this
audit were `done` for the then-current decision. The Codex-style quiet visual
direction was superseded on 2026-07-10 by an explicit owner decision to restore
the established OPL card-based Settings baseline while retaining the page
organization, state projection, and action semantics. This audit remains a
historical implementation record, not current visual authority.

Integration must synchronize the App product profile and active Shell generated
profile to `opl_baseline_card_control_center` and
`bounded_page_section_cards_with_flat_internal_rows`. The restoration is not
contract-complete while either projection still publishes the superseded
quiet-workbench values.

Fresh screenshot pixels were generated on the baseline-restoration Shell lane.
They remain implementation evidence for that exact lane commit; the integration
owner must rerun the declared screenshot command after semantic absorption.

No runtime, installed-App, currentness, notarization, or release-ready claim is
made by this audit.

## Plan Completion Audit

| Item | Status | Completion | Fresh evidence | Remaining gap / next action |
| --- | --- | ---: | --- | --- |
| Eight ordinary product pages | done | 100% | `ordinary_routes[].product_page_id` maps to `overview/access/workspace/capabilities/resources/maintenance/storage/preferences`; Shell DOM tests cover all entries | None |
| Secondary page boundary | done | 100% | `secondary_pages` contains only `advanced` and `about`; About has an independent render slot and route | None |
| Compatibility redirects | done | 100% | Machine contract and Shell router implement `update -> environment#updates`, `theme -> appearance#themes`, `local-services -> environment#services` with `?section=` anchors | None |
| About independence | done | 100% | `about` is absent from redirect maps and renders `AboutModalContent` at `/settings/about` | None |
| Single global search contract | done | 100% | One `settings-search-input`, bilingual item indexing, `page > item` labels, Enter navigation, and anchor focus are covered by DOM and E2E source tests | Fresh pixel capture remains separate |
| Codex-style visual contract | superseded | 0% current authority | The prior quiet-workbench CSS and contract were implemented and tested | Current authority is the OPL card-based Settings baseline in `settings-control-center.md` and `app-settings-control-plane.json` |
| Per-page experience contracts | done | 100% | Ten page contracts are implemented with declared primary information, action, exception, technical details, DOM anchors, Access browser entry, AssistantSettings tab, and resource action lifecycle | None in source/DOM scope |
| Prior UX audit incorporation | done | 100% | 概览、访问方式、工作区、智能体与能力、资源与连接、维护、数据与存储、偏好、高级、关于 requirements are present in Shell source and focused tests | None in source/DOM scope |
| Page-state matrix | done | 100% | Product pages, redirect states, Preferences route, anchors, and action states are consumed by App validators and Shell tests | None |
| Contract validators | done | 100% | Active-shell quick validation passes against the Settings Shell checkout, including ordinary-conversation Team MCP scrub evidence | Re-run on absorbed main |
| Focused and full tests | done | 100% | Shell `bun run test:full`: 248 files passed, 1 skipped; 1873 tests passed, 3 skipped. App release boundary: 158 passed, 2 platform skips | Re-run on absorbed main |
| Product documentation | done | 100% | `settings-control-center.md` is the current route, search, visual, page, DOM, and evidence boundary | None in App authority scope |
| Shell DOM and interaction implementation | done | 100% | Full node/DOM/integration suite, TypeScript, i18n, lint, format, and production Vite package build pass | Re-run on absorbed main |
| Visual QA collector | partial | 95% | E2E source covers desktop/narrow viewports, eight ordinary routes, Advanced/About, compatibility redirects, bilingual Enter search, anchor evidence, screenshots, and manifest output. State-changing confirmation remains covered by focused DOM tests. | The backend-independent visual fixture records action confirmation as an explicit coverage gap instead of claiming pixels it did not capture. |
| Fresh Shell screenshot pixels | done | 100% | The baseline-restoration lane generated and reviewed 28 desktop/mobile route, redirect, and interaction-state screenshots plus the manifest. | Re-run on the absorbed integration commit before installation. |
| Running-shell/runtime evidence | not_started | 0% | Contract and tests intentionally do not provide live runtime proof | Collect live readback only when runtime evidence is requested |
| Installed App / release currentness | blocked | 0% | Separate release-owner gate required | Release owner supplies installed version, signing/notarization, artifact, and currentness evidence |

## Implemented Shell Contract

The Shell lane implements and tests:

1. Exactly one mounted `settings-search-input`.
2. Chinese and English item-level indexing.
3. Search labels formatted as `页面 > 条目`.
4. Search selection routes to the owner page and focuses
   `data-settings-anchor`.
5. `update` resolves to `environment` plus `updates`.
6. `theme` resolves to `appearance` plus `themes`.
7. `local-services` resolves to `environment` plus `services`.
8. The hash router carries the anchor as `section=<anchor>` or an equivalent
   internal route-id-plus-anchor object.
9. About remains an independent `/settings/about` page.
10. All `settings-page-*`, primary, action, exception, and technical-details
    test ids declared by `experience_contract`.
11. Exact anchors: Overview `status/next-action`; Access
    `provider-source/model/authentication`; Workspace
    `current-workspace/permissions`; Agents & Capabilities
    `availability/source/home-visibility/custom-assistants`; Resources
    `resource-readiness/action-readiness/external-resources`; Maintenance
    `health/updates/services/packages`; Data & Storage
    `storage-categories/cleanup-preview/cleanup-history`; Preferences
    `behavior/tray/hardware/themes`; Advanced `working-directories`; About
    `version/channel/updates`.
12. No nested cards, no page-directory duplication, no more than one primary
    action, muted normal states, exception-only emphasis, and collapsed
    technical details.
13. Access is labeled `访问方式`, reads
    `app_state.core.codex.model_access_source`, and always renders
    `settings-access-browser-access` for browser access to this computer.
14. Legacy `assistants` resolves to
    `/settings/capabilities?tab=assistants&section=custom-assistants`, opens the
    third on-demand tab, mounts `AssistantSettings`, and focuses the anchor.
15. Resource `Open` navigates to the exact projected `browser_url`; `Diagnose`
    executes and renders a result or receipt; mutating actions require precheck,
    explicit confirmation, execution, and a result or receipt. Dry-run success
    is precheck evidence only.
16. Preferences exposes timeout, tray, hardware acceleration, and themes in
    user language.
17. Advanced is read-only working directories.
18. About main surface is version, channel, and update status only.

## Evidence Boundary

`done` above means the App-owned authority artifact and its validator coverage
exist and pass. It does not mean the parallel shell implementation, running App,
packaged App, or release is ready.

The terminal Settings product claim requires both:

- App authority evidence from this lane;
- fresh Shell DOM/behavior and visual evidence from the Shell owner lane.

Release/currentness remains outside Settings completion. The remaining Settings
evidence action is fresh screenshot capture outside the current macOS GUI
sandbox; managed-agent owns the subsequent build, installation, running-App
readback, and release/currentness checks.

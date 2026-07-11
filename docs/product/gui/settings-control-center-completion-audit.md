
# Settings Control Center Completion Audit

Audit date: 2026-07-10
Authority owner: one-person-lab-app
Scope: Settings product contracts, page-state matrix, documentation, validators,
and focused contract tests
Visual evidence status: historical evidence superseded by the 2026-07-11
baseline-card remediation

## Conclusion

This document retains a historical 2026-07-10 snapshot. It is not the current
visual acceptance authority. User testing rejected the Preferences flat theme
swatch list, so the visual conclusion tied to Shell
`5e46f49ab33fea3734db9a6fb6db79f73507bf07` is superseded by the baseline-card
remediation in `settings-control-center.md` and
`contracts/app-settings-control-plane.json`.

The 28 screenshots, visual E2E result, and manifest recorded below remain
historical evidence for that exact Shell commit only. They do not demonstrate
the remediated one-question-per-card grouping, compact return-to-chat/theme
footer, or recognizable theme preview tiles. This App authority lane records no
replacement screenshot or pixel claim.

No runtime, installed-App, currentness, notarization, or release-ready claim is
made by this audit.

## Plan Completion Audit

| Item | Status | Completion | Fresh evidence | Remaining gap / next action |
| --- | --- | ---: | --- | --- |
| Eight ordinary product pages | done | 100% | `ordinary_routes[].product_page_id` maps to `overview/access/workspace/capabilities/resources/maintenance/storage/preferences`; Shell DOM tests cover all entries | None |
| Secondary page boundary | done | 100% | `secondary_pages` contains only `advanced` and `about`; About has an independent render slot and route | None |
| Compatibility redirects | done | 100% | Machine contract and Shell router implement `update -> environment#updates`, `theme -> appearance#themes`, `local-services -> environment#services` with `?section=` anchors | None |
| About independence | done | 100% | `about` is absent from redirect maps and renders `AboutModalContent` at `/settings/about` | None |
| Single global search contract | done | 100% | One `settings-search-input`, bilingual item indexing, `page > item` labels, Enter navigation, and anchor focus are covered by DOM and E2E source tests | Old screenshot pixels are historical only and do not establish current visual acceptance |
| OPL card-based visual contract | superseded | not accepted | The prior card/swatch conclusion and Shell `5e46f49ab33fea3734db9a6fb6db79f73507bf07` screenshots are historical evidence only | Shell/main integration must sync the generated profile and collect fresh baseline-card visual evidence |
| Per-page experience contracts | done | 100% | Ten page contracts are implemented with declared primary information, action, exception, technical details, DOM anchors, Access browser entry, AssistantSettings tab, and resource action lifecycle | None in source/DOM scope |
| Prior UX audit incorporation | done | 100% | 概览、访问方式、工作区、智能体与能力、资源与连接、维护、数据与存储、偏好、高级、关于 requirements are present in Shell source and focused tests | None in source/DOM scope |
| Page-state matrix | done | 100% | Product pages, redirect states, Preferences route, anchors, and action states are consumed by App validators and Shell tests | None |
| Contract validators | done | 100% | Active-shell quick validation passes against the Settings Shell checkout, including ordinary-conversation Team MCP scrub evidence | Re-run on absorbed main |
| Focused and full tests | done | 100% | Shell `bun run test:full`: 248 files passed, 1 skipped; 1873 tests passed, 3 skipped. App release boundary: 158 passed, 2 platform skips | Re-run on absorbed main |
| Product documentation | done | 100% | `settings-control-center.md` is the current route, search, visual, page, DOM, and evidence boundary | None in App authority scope |
| Shell DOM and interaction implementation | historical_only | not current | Focused Settings DOM and interaction evidence is retained for the recorded Shell revision | Shell integration must implement and verify the remediated card/footer/gallery structure |
| Visual QA collector | superseded | not accepted | The collector and manifest shape are historical implementation evidence | Re-run it only after the remediated Shell generated profile and UI are integrated |
| Fresh Shell screenshot pixels | superseded | not accepted | Exact Shell `5e46f49ab33fea3734db9a6fb6db79f73507bf07`: 28 screenshots were generated at `2026-07-10T15:41:59.631Z` | They include the rejected flat swatch-list baseline; no new screenshot claim is made here |
| Running-shell/runtime evidence | not_started | 0% | Contract and tests intentionally do not provide live runtime proof | Collect live readback only when runtime evidence is requested |
| Installed App / release currentness | blocked | 0% | Separate release-owner gate required | Release owner supplies installed version, signing/notarization, artifact, and currentness evidence |

## Historical Shell Contract

The following records the previous Shell lane only. It does not assert current
visual acceptance after the baseline-card remediation:

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
12. The old evidence records no nested cards, no page-directory duplication,
    no more than one primary action, muted normal states, exception-only
    emphasis, and collapsed technical details. It does not prove the remediated
    grouping, footer, or theme gallery structure.
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

Historical `done` rows preserve what existed at their exact recorded commits.
They do not establish current visual acceptance for the remediated baseline.

The current App authority is the Settings control-plane contract and its
profile projection. The Shell/main integration lane must regenerate its product
profile and collect new UI and screenshot evidence before any visual acceptance
claim. This document adds no replacement screenshots or pixel evidence.

Release/currentness remains outside Settings completion. Final integration owns
the combined gates, rebuilt installation, running-App readback, release
currentness, and worktree cleanup. The visual manifest intentionally sets
`release_readiness_claim` to `false`.

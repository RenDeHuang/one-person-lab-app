
# Settings Control Center Completion Audit

Audit date: 2026-07-11
Authority owner: one-person-lab-app
Scope: Settings product contracts, page-state matrix, documentation, validators,
and focused contract tests
Visual evidence status: current baseline-card active-shell evidence

## Conclusion

Current visual evidence binds to `opl-aion-shell`
`90a9e692464ac870b464e01080ad25fd71604483` and its
`tests/e2e/screenshots/settings-control-center-manifest.json`. The manifest was
generated at `2026-07-11T02:27:19.698Z`, contains 28 desktop/mobile route,
secondary-route, compatibility-route, and interaction-state screenshots, and
sets `release_readiness_claim` to `false`. Its SHA-256 is
`d1fc0bf10eabe0cb7e094d0b20a35ce5813def5710c7e48915327b3856315951`.

The evidence verifies the remediated bounded-card baseline: one user question
per page-section card, flat internal rows, a compact return-to-chat/theme
footer, recognizable theme preview tiles, and correct navigation state before
each capture. Listed routes expose one current item; mobile secondary routes
expose no stale primary selection. Screenshot capture moves the pointer away
from navigation items so an old `:hover` state cannot masquerade as the selected
route.

No runtime, installed-App, currentness, notarization, or release-ready claim is
made by this audit.

## Plan Completion Audit

| Item | Status | Completion | Fresh evidence | Remaining gap / next action |
| --- | --- | ---: | --- | --- |
| Eight ordinary product pages | done | 100% | `ordinary_routes[].product_page_id` maps to `overview/access/workspace/capabilities/resources/maintenance/storage/preferences`; Shell DOM tests cover all entries | None |
| Secondary page boundary | done | 100% | `secondary_pages` contains only `advanced` and `about`; About has an independent render slot and route | None |
| Compatibility redirects | done | 100% | Machine contract and Shell router implement `update -> environment#updates`, `theme -> appearance#themes`, `local-services -> environment#services` with `?section=` anchors | None |
| About independence | done | 100% | `about` is absent from redirect maps and renders `AboutModalContent` at `/settings/about` | None |
| Single global search contract | done | 100% | One `settings-search-input`, bilingual item indexing, `page > item` labels, Enter navigation, and anchor focus are covered by DOM and E2E source tests | None in active-shell source scope |
| OPL card-based visual contract | done | 100% | App bounded-card contract plus Shell `90a9e692464ac870b464e01080ad25fd71604483` screenshots verify one-question card grouping, flat rows, compact footer, and theme preview tiles | Installed-App evidence remains separate |
| Per-page experience contracts | done | 100% | Ten page contracts are implemented with declared primary information, action, exception, technical details, DOM anchors, Access browser entry, AssistantSettings tab, and resource action lifecycle | None in source/DOM scope |
| Prior UX audit incorporation | done | 100% | 概览、访问方式、工作区、智能体与能力、资源与连接、维护、数据与存储、偏好、高级、关于 requirements are present in Shell source and focused tests | None in source/DOM scope |
| Page-state matrix | done | 100% | Product pages, redirect states, Preferences route, anchors, and action states are consumed by App validators and Shell tests | None |
| Contract validators | done | 100% | `OPL_APP_SHELL_ROOT=<pinned shell> bun run validate:active-shell -- --quick` passed; `npm run validate:gui-design-system` reported `consistent` | None in App contract scope |
| Focused product validation | done | 100% | Shell `bun run package`, `bunx tsc --noEmit`, Settings DOM `13 files / 86 tests`, and Settings visual E2E `2 tests` passed; App `npm run test:release-boundary` passed | Full-suite and installed-App evidence are separate, non-required claims |
| Product documentation | done | 100% | `settings-control-center.md` is the current route, search, visual, page, DOM, and evidence boundary | None in App authority scope |
| Shell DOM and interaction implementation | done | 100% | The focused Shell DOM suite covers 13 Settings surfaces and the E2E route loop asserts a unique selected item before capture | None in active-shell source scope |
| Visual QA collector | done | 100% | Collector waits for the resolved selected route, clears sidebar hover, and records route/viewport/anchor evidence | None in active-shell source scope |
| Fresh Shell screenshot pixels | done | 100% | Exact Shell `90a9e692464ac870b464e01080ad25fd71604483`: 28 entries in the 2026-07-11 manifest across desktop and mobile | No release/currentness claim is implied |
| Running-shell/runtime evidence | not_started | 0% | Contract and tests intentionally do not provide live runtime proof | Collect live readback only when runtime evidence is requested |
| Installed App / release currentness | blocked | 0% | Separate release-owner gate required | Release owner supplies installed version, signing/notarization, artifact, and currentness evidence |

## Historical Shell Contract

The following records the prior route and action surface. The 2026-07-10
flat-swatch screenshots at Shell `5e46f49ab33fea3734db9a6fb6db79f73507bf07`
remain historical comparison evidence only; they do not establish current
visual acceptance.

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
The current visual claim is limited to the manifest-bound Shell source listed
above and the App contracts it consumes.

Release/currentness remains outside Settings completion. Final integration owns
the combined gates, rebuilt installation, running-App readback, release
currentness, and worktree cleanup. The current visual manifest intentionally
sets `release_readiness_claim` to `false`.


# Settings Control Center Completion Audit

Audit date: 2026-07-11
Authority owner: one-person-lab-app
Scope: Settings product contracts, page-state matrix, documentation, validators,
and focused contract tests
Visual evidence status: default desktop Light check bound to final Settings source

## 2026-07-11 Surface-Ownership Correction

The prior bounded-card remediation restored visual hierarchy but applied cards
mechanically and left repeated status and diagnostic disclosures inline. The
current correction uses focused DOM/type/package checks and one default desktop
light inspection; the historical 42-image manifest does not prove this source.

| Item | Required terminal state |
| --- | --- |
| Card eligibility | Pure state is never a standalone card; columns are limited to comparable independent decisions |
| Workspace | One owner card containing path, writability, actions, and attention-only recovery |
| Preferences | Two full-width groups; no 2+1 card grid |
| Themes | Built-in choices are exactly Light, Dark, and Codex; user-managed themes and manual add remain |
| Diagnostics | Raw paths, refs, action ids, receipts, enums, payloads, and logs are absent inline and available from one explicit modal/drawer entry |
| Capabilities | User-facing source labels never fall through to raw enums; Home visibility and Manage are discoverable; AionUI custom assistants are absent |
| Home shortcut state | Settings and Home share one reactive owner; successful actions commit and failed actions roll back |
| About | Version/channel/update share one card; update action is adjacent to status; help arrows reach the row edge |

This correction is `done`. The current Shell source passes focused tests,
TypeScript, package compilation, and one default desktop Light check.

## Conclusion

The 42-image manifest at Shell
`74848adf77360903c5ac7d64c32455a78fb3901a` is historical comparison evidence.
Current Settings acceptance intentionally uses one default desktop light check
after a production package build because page organization is still being
refined. Visual evidence never establishes release readiness or runtime currentness.

The current screenshot binds to Shell
`a2571751bdee6382c69187ade743ebbf0e97f399` and is archived at
`docs/product/gui/assets/settings-capabilities-desktop-light-20260711.png`.
Its SHA-256 is
`ae13e05988cb9fbeb14d36354c61574cc02b7c4b8575580b8af10088715a8d74`.
It verifies a stable loaded page, restrained multi-hue navigation icons, a
visible capability object accent, bounded-card hierarchy, no custom-assistant
surface, and no overlap or clipping at the default desktop viewport.

The evidence verifies the remediated bounded-card baseline: one user question
per page-section card, flat internal rows, a compact return-to-chat/theme
footer, recognizable theme preview tiles, and correct navigation state before
each capture. Listed routes expose one current item; mobile secondary routes
expose no stale primary selection. Screenshot capture moves the pointer away,
clears focus, and waits for navigation color transitions to finish so a stale
interaction frame cannot masquerade as a second selected route.

The local arm64 build was installed at `/Applications/One Person Lab.app` and
read back as version `26.7.11`; its main and renderer processes launch from the
installed bundle and deep signature verification passes. This local ad-hoc
build is not notarized and does not establish public release currentness.

## Plan Completion Audit

| Item | Status | Completion | Fresh evidence | Remaining gap / next action |
| --- | --- | ---: | --- | --- |
| Eight ordinary product pages | done | 100% | `ordinary_routes[].product_page_id` maps to `overview/access/workspace/capabilities/resources/maintenance/storage/preferences`; Shell DOM tests cover all entries | None |
| Secondary page boundary | done | 100% | `secondary_pages` contains only `advanced` and `about`; About has an independent render slot and route | None |
| Compatibility redirects | done | 100% | Machine contract and Shell router implement `update -> environment#updates`, `theme -> appearance#themes`, `local-services -> environment#services` with `?section=` anchors | None |
| About independence | done | 100% | `about` is absent from redirect maps and renders `AboutModalContent` at `/settings/about` | None |
| Single global search contract | done | 100% | One `settings-search-input`, bilingual item indexing, `page > item` labels, Enter navigation, and anchor focus are covered by DOM and E2E source tests | None in active-shell source scope |
| OPL card-based visual contract | done | 100% | App bounded-card contract plus Shell `74848adf77360903c5ac7d64c32455a78fb3901a` screenshots verify decision-based card grouping, flat internal rows, compact footer, light/dark dividers, and uncropped actions | None |
| Per-page experience contracts | done | 100% | Ten page contracts declare primary information, action, exception, non-duplicative diagnostics, DOM anchors, model/access ownership, OPL-only capability tabs, and resource action lifecycle | None in source/DOM scope |
| Prior UX audit incorporation | done | 100% | 概览、模型与访问、工作区、智能体与能力、资源与连接、维护、数据与存储、偏好、高级、关于 requirements are present in Shell source and focused tests | None in source/DOM scope |
| Page-state matrix | done | 100% | Product pages, redirect states, Preferences route, anchors, and action states are consumed by App validators and Shell tests | None |
| Contract validators | done | 100% | `OPL_APP_SHELL_ROOT=<pinned shell> bun run validate:active-shell -- --quick` passed; `npm run validate:gui-design-system` reported `consistent` | None in App contract scope |
| Focused product validation | done | 100% | Shell `bun run package`, `bunx tsc --noEmit`, Settings DOM `15 files / 85 tests`, Settings visual E2E `2 tests`, and App Settings contract tests `7/7` passed | None in Settings scope |
| Product documentation | done | 100% | `settings-control-center.md` is the current route, search, visual, page, DOM, and evidence boundary | None in App authority scope |
| Shell DOM and interaction implementation | done | 100% | The focused Shell DOM suite covers 13 Settings surfaces and the E2E route loop asserts a unique selected item before capture | None in active-shell source scope |
| Visual QA collector | done | 100% | Collector waits for the resolved selected route, clears focus and hover, settles navigation transitions, and records route/viewport/anchor evidence | None in active-shell source scope |
| Fresh Shell screenshot pixels | done | 100% | Exact Shell `a2571751bdee6382c69187ade743ebbf0e97f399`; archived desktop Light capability screenshot SHA-256 `ae13e05988cb9fbeb14d36354c61574cc02b7c4b8575580b8af10088715a8d74` | No public release or runtime-currentness claim is implied |
| Running installed App | done | 100% | `/Applications/One Person Lab.app` version `26.7.11`; main and renderer process paths and deep signature were read back after launch | None for local testing |
| Public release currentness | not_started | 0% | Local build is intentionally ad-hoc signed and not notarized | Separate release-owner evidence is required before a public release claim |

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
10. All `settings-page-*`, primary, action, exception, and non-duplicative
    diagnostic test ids declared by `experience_contract`.
11. Exact anchors: Overview `status/next-action`; Access
    `provider-source/model/authentication`; Workspace
    `current-workspace/permissions`; Agents & Capabilities
    `availability/source/home-visibility`; Resources
    `resource-readiness/action-readiness/external-resources`; Maintenance
    `health/updates/services/packages`; Data & Storage
    `storage-categories/cleanup-preview/cleanup-history`; Preferences
    `behavior/tray/hardware/themes`; Advanced `working-directories`; About
    `version/channel/updates`.
12. The old evidence records no nested cards, no page-directory duplication,
    no more than one primary action, muted normal states, exception-only
    emphasis, and collapsed technical details. It does not prove the remediated
    grouping, footer, or theme gallery structure.
13. Access was previously labeled `访问方式` and owned browser access. The
    current product page is `模型与访问`; browser/WebUI/remote connection
    ownership now belongs to Resources & Connections.
14. Legacy `assistants` now resolves to `/settings/capabilities?tab=skills`;
    AionUI `AssistantSettings` is intentionally excluded from OPL Settings.
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

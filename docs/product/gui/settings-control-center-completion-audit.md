
# Settings Control Center Completion Audit

Audit date: 2026-07-10
Authority owner: one-person-lab-app
Scope: Settings product contracts, page-state matrix, documentation, validators,
and focused contract tests

## Conclusion

The App product-authority slice is `done`. The contracts now fully describe the
confirmed Codex-style Settings experience.

The Shell implementation slice is `partial` until the parallel Aion shell lane
implements and proves the required DOM, search, anchors, redirects, and visual
behavior.

No runtime, installed-App, currentness, notarization, or release-ready claim is
made by this audit.

## Plan Completion Audit

| Item | Status | Completion | Fresh evidence | Remaining gap / next action |
| --- | --- | ---: | --- | --- |
| Eight ordinary product pages | done | 100% | `ordinary_routes[].product_page_id` maps to `overview/access/workspace/capabilities/resources/maintenance/storage/preferences` | Shell must render the eight entries in contract order |
| Secondary page boundary | done | 100% | `secondary_pages` contains only `advanced` and `about` | Shell must keep About at `/settings/about` |
| Compatibility redirects | done | 100% | Machine contract fixes `update -> environment#updates`, `theme -> appearance#themes`, `local-services -> environment#services` | Shell must parse route plus anchor, using `?section=` under the hash router |
| About independence | done | 100% | `about` is absent from `legacy_route_redirects` and `extension_anchor_remap` | Shell route readback must confirm no About-to-Advanced redirect |
| Single global search contract | done | 100% | `global_entry_count=1`, bilingual item index, `page > item` format, route-plus-anchor selection | Shell must remove duplicate Settings search inputs and render item results |
| Codex-style visual contract | done | 100% | Quiet workbench, no nested cards, radius <= 8, 12/16/24 spacing, compact headings, one primary action, muted normal state, collapsed details | Desktop/mobile screenshot QA remains |
| Per-page experience contracts | done | 100% | Ten page contracts define primary information, primary action, exception state, technical details, DOM, anchors, search ids, Access browser entry, AssistantSettings tab, and resource action behavior | Shell must implement every declared page contract |
| Prior UX audit incorporation | done | 100% | 概览、访问方式、工作区、智能体与能力、资源与连接、维护、数据与存储、偏好、高级、关于 requirements are encoded in contracts and docs | Shell behavior and copy readback remain |
| Page-state matrix | done | 100% | Product pages mirror DOM/anchor/search requirements; Update and Local Services are redirect states; Preferences uses ordinary `appearance` route | Shell page tests must consume the matrix |
| Contract validators | done | 100% | Validators reject product-label drift, secondary/About drift, compatibility and search-anchor drift, missing bilingual fields, missing browser access, empty AssistantSettings tab, resource dry-run completion claims, and matrix drift | Re-run after Shell lane lands |
| Focused negative tests | done | 100% | Fresh run: `settings-control-plane-validation.ts` passes 4/4 focused tests | Keep the test focused; do not expand into duplicate release shadow coverage |
| Product documentation | done | 100% | `settings-control-center.md` is the current route, search, visual, page, DOM, and evidence boundary | None in App authority scope |
| Shell DOM and interaction implementation | partial | 0% verified | Fresh `validate:active-shell -- --quick` reached Shell implementation validation and failed first at missing `workspace_root_set` in `SystemModalContent`; no complete Settings DOM/behavior evidence is available | Shell owner fixes the current substrate probe, then implements and verifies the exact DOM/behavior list below |
| Shell visual QA | not_started | 0% | No fresh desktop/mobile screenshot manifest for this contract revision | Run declared Settings screenshot command after Shell behavior passes |
| Running-shell/runtime evidence | not_started | 0% | Contract and tests intentionally do not provide live runtime proof | Collect live readback only when runtime evidence is requested |
| Installed App / release currentness | blocked | 0% | Separate release-owner gate required | Release owner supplies installed version, signing/notarization, artifact, and currentness evidence |

## Shell Handoff

The Shell lane must implement and verify:

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

Release/currentness remains outside Settings completion.

Fresh repository-wide `test:release-boundary` evidence is also separate: 117 of
122 tests passed, 2 were skipped, and 3 failed because this App worktree does
not contain the external `shells/aionui` checkout files expected by those
release tests. Those failures do not prove a Settings contract defect and were
not repaired from this lane.

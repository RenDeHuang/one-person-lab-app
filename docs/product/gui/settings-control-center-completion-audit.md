# Settings Control Center Completion Audit

Audit date: 2026-07-12

State: `historical_snapshot_superseded_for_information_architecture`

Authority owner: `one-person-lab-app`

App Settings authority source: `1dd03b0f0f720d2314d4a8a77360c147b5635173`

Verified Shell source: `fadd91f9f0808eb090087f48c34d7c26d69df6ab`

This file is immutable evidence for the 2026-07-12 Settings cohort, not current
Settings authority. The later `settings_ia.v1` reorganization replaces its
combined Model/Access, Agents/Capabilities, and standalone Advanced structure.
Current authority is `contracts/app-settings-control-plane.json` and
`docs/product/gui/settings-control-center.md`; current installed visual/timing
acceptance requires a new cohort.

## Conclusion

The Settings control center was complete for its 2026-07-12 product scope. The
implementation now separates four different user concerns instead of mixing
them in generic cards or technical-detail lists:

1. **Configure**: values the user can change and persist.
2. **View**: concise current state needed for a decision.
3. **Act**: explicit checks, repairs, updates, archive, restore, cleanup, and
   navigation actions with result or receipt semantics.
4. **Diagnose**: raw paths, refs, payloads, logs, receipts, and implementation
   detail behind one deliberate diagnostic entry.

This audit records the superseded 2026-07-12 visual cohort. The current visual
authority keeps the same OPL information architecture and flat-row grouping,
but replaces multi-hue navigation and responsive card grids with the Codex
quiet single-column treatment: monochrome utility icons, white bounded groups,
and color reserved for typed status or brand actions. AionUI custom assistants
remain outside the OPL product surface and their underlying data is not deleted.

## Historical Page Audit (2026-07-12)

| Page | Configure | View | Act | Diagnose | Terminal state |
| --- | --- | --- | --- | --- | --- |
| Overview | None; it is a control-center summary | Codex readiness, OPL Gateway account and usage, and actionable attention | Open the owning page for the next action | Compact technical facts remain inline; raw paths and receipts stay elsewhere | No empty overview, no workspace-path primary card, and no duplicated technical state |
| Model & Access | Model, reasoning, access source and supported credential choices | Codex CLI and Gateway readiness | Open the owning access flow | Non-duplicative access diagnostics only | Model/access ownership is explicit |
| Workspace | Workspace location and supported workspace behavior | Current path and meaningful writability/attention state | Choose or open workspace | Raw path detail only when needed | One owner surface; no repeated `available` badges |
| Agents & Capabilities | Home visibility for adopted OPL capabilities | Canonical package identity, purpose and readiness | Open capability management/maintenance owner | Package/source detail on demand | No AionUI custom-assistant product entry |
| Resources & Connections | OPL Connect handle-based connection records | Redacted connection and resource readiness | Create, edit, test, set default, delete, open or diagnose as supported | Connection receipts and raw transport detail on demand | Secrets never enter generic App state or logs |
| Maintenance | Update channel where supported | Health, update, service and package attention summaries | Check, update, repair and rollback through owner actions | Raw logs, refs, locks, payloads and receipts on demand | Unknown backend fields are not presented as ordinary errors |
| Data & Storage | Retention choices where supported | Category usage and cleanup/archive state | Preview, archive, restore, delete and clean with required confirmation | Restore proof and cleanup receipts on demand | Archive-before-delete is preserved; restore remains reachable after reopen |
| Preferences | App behavior, notifications, performance, display, fonts, system `AGENTS.md`, OPL App additional context, and themes | Current local preference values | Apply, restore supported defaults, and manage user themes | No generic technical-details list | Built-ins are exactly Light, Dark and Codex; personalization is not degraded |
| Advanced | No duplicated ordinary preference | Canonical working, runtime and log paths | Open/copy a path where supported | The page itself is the secondary expert surface | No redundant summary plus collapsed copy |
| About | Update channel only where it is a real preference | App/Shell version and update state | Check updates and open help/feedback destinations | Version receipts on demand | Version, update action and help rows align as one coherent surface |

## Contract And Interaction Audit

| Boundary | Result | Evidence |
| --- | --- | --- |
| Information architecture | Superseded | This row records the 2026-07-12 eight-route cohort; current `settings_ia.v1` has ten ordinary routes, About as the only independent secondary page, and Advanced as a redirect to Maintenance diagnostics |
| Single global search | Done | One bilingual item-level search routes to the owner page and anchor; empty state has visual evidence |
| Configuration ownership | Done | Framework, App-local and credential/connection items each declare one truth owner, write route, persistence target and verification route |
| State/action separation | Done | Read models do not masquerade as actions; mutating actions retain precheck, confirmation and result/receipt semantics |
| Diagnostic separation | Done | Raw implementation data is absent from ordinary rows and available through explicit diagnostic surfaces |
| Visual hierarchy | Superseded | The bounded-card cohort is historical; current authority requires Codex quiet single-column groups, monochrome utility icons, and fresh scene-bound visual evidence |
| Capability scope | Done | Adopted OPL packages remain manageable; unadopted AionUI custom assistants are hidden without deleting data |
| Personalization | Done | System `AGENTS.md` restore uses confirmation and stale guards; OPL App context keeps a generated read-only base plus editable additional instructions |
| Compatibility | Done | `update`, `theme`, and `local-services` resolve to their current owner route and anchor before rendering |
| Upstream maintainability | Done | Product truth stays in App contracts; Shell changes remain OPL overlays/adapters and do not redefine Settings from upstream defaults |

## Fresh Verification

The final Shell source passed:

- full lint, format, TypeScript, and i18n validation;
- 155 test files and 1,390 tests;
- focused canonical package and runtime projection tests: 2 files and 9 tests;
- production `bun run package`;
- Settings visual E2E: 2 tests;
- remote readback of `gh-https/main` at
  `fadd91f9f0808eb090087f48c34d7c26d69df6ab`.

The App Settings authority passed 9 focused contract tests and active-shell
quick validation against the synchronized product profile.

## Visual Evidence

Visual acceptance is intentionally limited to the default desktop Light mode
while the page organization is the primary acceptance target. It does not use
the historical 42-image desktop/mobile/light/dark matrix.

- Contact sheet:
  `docs/product/gui/assets/settings-desktop-light-contact-sheet-20260712.png`
- Contact sheet SHA-256:
  `411b38a6ac1538df6311ab1c76d58ab887cc698f75aac3631a57aa4ded0a3649`
- Machine manifest:
  `docs/product/gui/assets/settings-desktop-light-manifest-20260712.json`
- Manifest SHA-256:
  `48e753193a77290f2df093ee9cda5eccd39c337385292874cb3f736767fb435d`
- Manifest binding: 14 entries, desktop, Light, exact Shell commit
  `fadd91f9f0808eb090087f48c34d7c26d69df6ab`, and zero entry-level anchor
  gaps.

The contact sheet contains the ten actual Settings pages. The manifest also
records the search empty state and three compatibility redirects. Confirmation
dialogs for backend mutations remain covered by focused interaction tests rather
than the backend-independent visual fixture; this is recorded in the manifest
and is not hidden as visual proof.

## Evidence Boundary

This audit proves Settings product contracts, source behavior, focused
interaction coverage, production compilation, and default desktop visual
conformance at the exact commits above. It does **not** prove that an installed
App bundle is current, that the running process uses these bytes, that Framework
runtime state is ready, or that a public release is signed/notarized. Those
claims require a rebuilt bundle plus installed/running and release-owner
readback after final cross-repository integration.

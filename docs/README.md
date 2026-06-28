# One Person Lab App Docs

Owner: `one-person-lab-app`
Purpose: `app_docs_entry`
State: `active`
Machine boundary: Human-readable App documentation index. Machine-readable truth
lives in `contracts/`, source, release artifacts, updater metadata, validation
outputs, and OPL Framework CLI/read-model output consumed by the App.

This directory is the App docs entry point. The App owns desktop product
documentation, GUI/product shell intent, release/install documentation, public
user guides, and App validation guidance. It consumes OPL Framework runtime
output and domain-owned projections; it does not own provider runtime truth,
domain truth, owner receipts, artifact bodies, artifact authority, or quality
verdicts.

## Core Current Docs

The root docs layer stays small: current state, durable decisions, and portfolio
governance only.

| Doc | Owner / purpose / state | Machine boundary |
| --- | --- | --- |
| [`project.md`](project.md) | App repository role and product ownership boundary; `active` | Human-readable product scope; contracts/source/artifacts prove machine claims |
| [`status.md`](status.md) | Current App repository, shell, release, runtime-page, and validation state; `active` | Status summary only; no runtime/provider/domain authority |
| [`architecture.md`](architecture.md) | App, shell, OPL Framework, and domain-agent ownership split; `active` | Architecture narrative; executable truth stays in contracts/source/tests |
| [`invariants.md`](invariants.md) | App repository invariants and non-ownership rules; `active` | Human-readable constraints; guards live in contracts, scripts, workflows, and tests |
| [`decisions.md`](decisions.md) | Still-active App product, shell, runtime bridge, release, and docs lifecycle decisions; `active` | Durable human-readable decisions; machine gates use contracts/source/tests |
| [`docs_portfolio_consolidation.md`](docs_portfolio_consolidation.md) | Docs lifecycle governance and directory role inventory; `active_support` | Governance index only; not release/runtime proof |
| [`active/app-ideal-state-gap-plan.md`](active/app-ideal-state-gap-plan.md) | Active App product progress, gaps, and next-round baton; `active_plan` | Plan/read-model only; not runnable behavior or owner acceptance |

## Directory Index

| Directory | Owner / purpose / state | Use it for | Machine boundary |
| --- | --- | --- | --- |
| [`public/`](public/) | App public docs; `app_public_docs_entry`; `active` | End-user reading surfaces. Start with [`public/macos-app-install/README.md`](public/macos-app-install/README.md), [`index.html`](public/macos-app-install/index.html), PDF, and PPTX. | Public docs are human-readable artifacts, not release/readiness proof. |
| `product/` | App/workbench/product shell design and GUI support; target state while the product IA lane lands | Product requirements, GUI support docs, App/workbench shell design, and product-facing decisions. | Product acceptance stays in App contracts, page-state matrices, shell validation, source, and tests. |
| `delivery/` | Release, artifact/package/export, user-guide generation source, and verification; target state while the delivery IA lane lands | Release operator docs, generated guide source/provenance, screenshots, and package/export lifecycle support. | Release truth stays in produced assets, updater metadata, evidence manifests, CI/logs, workflows, validators, and release-boundary tests. |
| [`testing/`](testing/) | App testing entry; `app_testing_docs`; `active` | Test, validation, release-evidence classification, and smoke command orientation. | Test code, contracts, workflows, validators, and artifacts are executable truth. |
| [`history/`](history/) | App historical index; `app_history`; `history_index` | Retired routes, candidate verification provenance, stale-surface no-resurrection notes, and compressed process history. | Historical only; not active product/runtime/release truth. |
| [`release/`](release/) | Current release docs directory pending delivery-lane absorption | Release operator map and release policy while the delivery lane finalizes paths. | Same release boundary as `delivery/`; do not add new root-level release topics here from this lane. |
| [`user-guides/`](user-guides/) | Current guide source directory pending delivery-lane absorption | macOS install guide JSON source, generated Markdown/deck source, screenshot provenance, and verification records. | Source/verification maintenance only; public reading artifacts live in `public/`. |
| [`screenshots/`](screenshots/) | Current visual-guide index pending delivery-lane absorption | Screenshot provenance and visual tutorial routing. | Screenshot docs do not prove runtime/domain/release readiness. |

If another lane lands `docs/product/` or `docs/delivery/`, keep this index as a
directory-level pointer and avoid moving files in this lane. The canonical
public user entry is `docs/public/macos-app-install/`; source and generated
maintenance material belong under the delivery owner.

## Public User Entry

Use [`public/macos-app-install/README.md`](public/macos-app-install/README.md)
for links to the publishable macOS App install guide:

- [`public/macos-app-install/index.html`](public/macos-app-install/index.html)
- [`public/macos-app-install/macos-app-install-slides.pdf`](public/macos-app-install/macos-app-install-slides.pdf)
- [`public/macos-app-install/macos-app-install-slides.pptx`](public/macos-app-install/macos-app-install-slides.pptx)
- [`public/macos-app-install/macos-app-install-detailed-guide.pdf`](public/macos-app-install/macos-app-install-detailed-guide.pdf)

Do not link ordinary users to `docs/user-guides/`; it is a maintenance/source
surface until the delivery lane finishes its final path.

## GUI And Candidate Docs

GUI definition and candidate verification material is being separated from the
root index into product/history ownership. Until those lanes finalize paths,
current files remain readable in place:

- `app-ideal-gui-interaction-spec.md`, `app-gui-element-audit.md`,
  `codex-to-opl-app-delta.md`, and `app-gui-feature-inventory.md` are product
  design/reference material.
- `opl-hermes-gui-adaptation-plan.md` and `opl-hermes-first-run-flow.md`
  describe the Hermes Desktop foreground alternative.
- `agui-codex-candidate-verification.md` is archived AG-UI/CopilotKit
  technical-proof replay material; use only for explicit AGUI replay or
  historical audit.

Executable acceptance for GUI/candidate work stays in contracts, adapter
manifests, validators, shell artifacts, tests, release artifacts, workflows, and
CI logs.

## Documentation Language

App internal development docs default to Chinese so GUI, release, contract, and
runtime-boundary reviews stay direct for maintainers. Public README surfaces may
remain bilingual or English when product distribution needs it.

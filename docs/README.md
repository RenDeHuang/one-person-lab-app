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
| [`product/`](product/) | App/workbench/product shell design and GUI support; `active_support` | Product requirements, GUI support docs, App/workbench shell design, and product-facing decisions. | Product acceptance stays in App contracts, page-state matrices, shell validation, source, and tests. |
| [`delivery/`](delivery/) | Release, artifact/package/export, user-guide generation source, and verification; `active_support` | Release operator docs, generated guide source/provenance, screenshots, and package/export lifecycle support. | Release truth stays in produced assets, updater metadata, evidence manifests, CI/logs, workflows, validators, and release-boundary tests. |
| [`testing/`](testing/) | App testing entry; `app_testing_docs`; `active` | Test, validation, release-evidence classification, and smoke command orientation. | Test code, contracts, workflows, validators, and artifacts are executable truth. |
| [`history/`](history/) | App historical index; `app_history`; `history_index` | Retired routes, candidate verification provenance, stale-surface no-resurrection notes, and compressed process history. | Historical only; not active product/runtime/release truth. |
The canonical public user install entries are `docs/public/macos-app-install/`
and `docs/public/docker-webui-install/`; source and generated maintenance
material belongs under `docs/delivery/`.

## Public User Entry

Use [`public/macos-app-install/README.md`](public/macos-app-install/README.md)
and [`public/docker-webui-install/README.md`](public/docker-webui-install/README.md)
for links to publishable install guides:

- [`public/macos-app-install/index.html`](public/macos-app-install/index.html)
- [`public/macos-app-install/macos-app-install-slides.pdf`](public/macos-app-install/macos-app-install-slides.pdf)
- [`public/macos-app-install/macos-app-install-slides.pptx`](public/macos-app-install/macos-app-install-slides.pptx)
- [`public/macos-app-install/macos-app-install-detailed-guide.pdf`](public/macos-app-install/macos-app-install-detailed-guide.pdf)
- [`public/docker-webui-install/index.html`](public/docker-webui-install/index.html)
- [`public/docker-webui-install/docker-webui-install-detailed-guide.pdf`](public/docker-webui-install/docker-webui-install-detailed-guide.pdf)

Do not link ordinary users to `docs/delivery/user-guides/*`; those are
maintenance/source surfaces.

## GUI And Candidate Docs

GUI definition and candidate verification material is separated into
product/history ownership:

- [`product/gui/`](product/gui/) holds the ideal interaction spec, element
  audit, Codex-to-OPL product delta, and GUI feature inventory.
- [`product/shell-alternatives/`](product/shell-alternatives/) holds Hermes
  Desktop foreground-alternative material.
- [`history/shell-candidates/`](history/shell-candidates/) holds archived
  AG-UI/CopilotKit technical-proof replay material for explicit AGUI replay or
  historical audit.

Executable acceptance for GUI/candidate work stays in contracts, adapter
manifests, validators, shell artifacts, tests, release artifacts, workflows, and
CI logs.

## Documentation Language

App internal development docs default to Chinese so GUI, release, contract, and
runtime-boundary reviews stay direct for maintainers. Public README surfaces may
remain bilingual or English when product distribution needs it.

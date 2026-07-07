# Public Docs

Owner: `one-person-lab-app`
Purpose: `app_public_docs_entry`
State: `active`
Machine boundary: Human-readable public documentation entry. Public docs are
publishable user artifacts, not release readiness, runtime readiness, domain
readiness, or owner-receipt evidence.

This directory contains clean end-user reading surfaces. It should stay small:
one folder per public guide or public doc bundle. Source maintenance material
belongs under the delivery owner (`docs/delivery/`). Generated HTML, PDF, PPTX,
and screenshot copies are publishable outputs; keep only the active public entry
bundles here, and prefer release assets or regenerated local output for new
shareable binaries instead of adding another tracked copy.

## Public Entries

| Entry | Purpose | Boundary |
| --- | --- | --- |
| [OPL App whitepaper](whitepaper/README.md) | Public whitepaper for the OPL App workbench positioning, local-first/cloud-continuous model, professional-agent entry points, and user trust narrative. Start with [`opl-app-whitepaper.md`](whitepaper/opl-app-whitepaper.md), then use the PDF when a shareable file is needed. | Human-readable product whitepaper only. App release, runtime, domain quality, owner receipt, production readiness, and currentness truth stay in App contracts, release artifacts, runtime readback, domain owner surfaces, and evidence records. |
| [macOS App install guide bundle](macos-app-install/README.md) | User-facing install and first-run guide bundle. Start with [`index.html`](macos-app-install/index.html), then use the PDF/PPTX attachments when a shareable file is needed. | Human-readable onboarding artifact only. Release/install truth stays in App contracts, release artifacts, VM smoke, workflows, validators, and evidence manifests. |
| [Docker/WebUI install guide bundle](docker-webui-install/README.md) | User-facing Docker/WebUI guide for Linux, Windows, and server users. Start with [`index.html`](docker-webui-install/index.html), then use the detailed PDF when a shareable file is needed. | Human-readable onboarding artifact only. WebUI image truth stays in App contracts, release artifacts, GHCR publish receipts, shell Dockerfile/web-cli behavior, and live container smoke. |

Do not point ordinary users at guide source, generated maintenance material, or
screenshot provenance directories. Do not add new generated public binaries
unless they are the canonical public entry for a maintained guide and have a
delivery manifest plus regeneration command.

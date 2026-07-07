# Public Docs

Owner: `one-person-lab-app`
Purpose: `app_public_docs_entry`
State: `active`
Machine boundary: Human-readable public documentation entry. Public docs are
publishable user artifacts, not release readiness, runtime readiness, domain
readiness, or owner-receipt evidence.

This directory contains clean end-user reading entrypoints. It should stay
small: one folder per public guide or public doc bundle. Source maintenance
material belongs under the delivery owner (`docs/delivery/`), and latest
generated HTML, PDF, PPTX, whitepaper, and screenshot outputs belong under
`docs/site/latest/`.

## Public Entries

| Entry | Purpose | Boundary |
| --- | --- | --- |
| [OPL App whitepaper](whitepaper/README.md) | Public whitepaper entry for the OPL App workbench positioning, local-first/cloud-continuous model, professional-agent entry points, and user trust narrative. Source Markdown lives in `docs/whitepapers/`; generated HTML/PDF lives in `docs/site/latest/whitepapers/`. | Human-readable product whitepaper only. App release, runtime, domain quality, owner receipt, production readiness, and currentness truth stay in App contracts, release artifacts, runtime readback, domain owner surfaces, and evidence records. |
| [macOS App install guide bundle](macos-app-install/README.md) | User-facing install and first-run guide entry. Generated HTML/PDF/PPTX attachments live in `docs/site/latest/macos-app-install/`. | Human-readable onboarding artifact only. Release/install truth stays in App contracts, release artifacts, VM smoke, workflows, validators, and evidence manifests. |
| [Docker/WebUI install guide bundle](docker-webui-install/README.md) | User-facing Docker/WebUI guide entry for Linux, Windows, and server users. Generated HTML/PDF attachments live in `docs/site/latest/docker-webui-install/`. | Human-readable onboarding artifact only. WebUI image truth stays in App contracts, release artifacts, GHCR publish receipts, shell Dockerfile/web-cli behavior, and live container smoke. |

Do not point ordinary users at guide source, generated maintenance material, or
screenshot provenance directories. Do not add new generated public binaries
outside `docs/site/latest/` unless they are a release asset or have a delivery
manifest plus regeneration command.

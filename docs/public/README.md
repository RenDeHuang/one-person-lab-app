# Public Docs

Owner: `one-person-lab-app`
Purpose: `app_public_docs_entry`
State: `active`
Machine boundary: Human-readable public documentation entry. Public docs are
publishable user artifacts, not release readiness, runtime readiness, domain
readiness, or owner-receipt evidence.

This directory contains clean end-user reading surfaces. It should stay small:
one folder per public guide or public doc bundle. Generated/source maintenance
material belongs under the delivery owner (`docs/delivery/`).

## Public Entries

| Entry | Purpose | Boundary |
| --- | --- | --- |
| [macOS App install guide bundle](macos-app-install/README.md) | User-facing install and first-run guide bundle. Start with [`index.html`](macos-app-install/index.html), then use the PDF/PPTX attachments when a shareable file is needed. | Human-readable onboarding artifact only. Release/install truth stays in App contracts, release artifacts, VM smoke, workflows, validators, and evidence manifests. |

Do not point ordinary users at guide source or screenshot provenance directories.

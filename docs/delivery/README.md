# Delivery Docs

Owner: `one-person-lab-app`
Purpose: `app_delivery_docs_entry`
State: `active_support`
Machine boundary: Human-readable delivery, release, guide-generation, and
evidence-support documentation. Delivery truth stays in produced assets,
updater metadata, release records, evidence manifests, workflows, validators,
release-boundary tests, CI logs, and App contracts.

This directory holds maintainer-facing delivery material. Public user reading
surfaces live under `docs/public/`.

## Entries

| Path | Role |
| --- | --- |
| [`release/README.md`](release/README.md) | App release, updater, Full first-install, Homebrew, and release-owner operator map. |
| [`release/records/`](release/records/) | Release owner receipt records and verdict records. |
| [`release/release-train-optimization-design.md`](release/release-train-optimization-design.md) | Release train optimization design support. |
| [`release-evidence/screenshots.md`](release-evidence/screenshots.md) | Screenshot and visual tutorial evidence routing. |
| [`user-guides/macos-app-install/README.md`](user-guides/macos-app-install/README.md) | macOS install guide source, generated Markdown/deck source, screenshot provenance, fixtures, and verification records. |
| [`user-guides/docker-webui-install/README.md`](user-guides/docker-webui-install/README.md) | Docker/WebUI install guide source, generated Markdown, and verification records. |

Do not link ordinary users to this directory. Use
`docs/public/macos-app-install/` and `docs/public/docker-webui-install/` for
publishable guide bundles.

# Docker/WebUI Operator Install Guide

Owner: `one-person-lab-app`
Purpose: `docker_webui_operator_install_guide`
State: `active_support`
Machine boundary: Human-readable operator install guide and SSOT route map.
Machine policy stays in `contracts/app-install-exposure-policy.json`; readiness
evidence stays in smoke gate artifacts, release workflows, GHCR publish
receipts, shell Dockerfile/WebUI behavior, and live container smoke evidence.

This is the maintained operator entry for the Docker/WebUI beginner install
path. It does not duplicate the user guide body, public bundle, generated
Markdown, or smoke gate runbook.

## SSOT Roles

- Machine policy: [`../../../contracts/app-install-exposure-policy.json`](../../../contracts/app-install-exposure-policy.json)
  owns installer surface, data mounts, Access key transport, startup diagnostics, and
  false-ready boundaries.
- Operator guide: this file owns the maintainer-facing install route and points
  to the guide source, public bundle, and verification support.
- Verification support:
  [`docker-webui-smoke-gates.md`](docker-webui-smoke-gates.md) owns smoke gate
  commands, artifact readback, typed blockers, and completion boundaries.
- Public entry:
  [`../../public/docker-webui-install/README.md`](../../public/docker-webui-install/README.md)
  is the user-facing starting point.
- Generated payload:
  [`../user-guides/docker-webui-install/generated/docker-webui-install.md`](../user-guides/docker-webui-install/generated/docker-webui-install.md)
  is a generated artifact and must not become a current truth owner.

## Canonical Entries

- Maintainer QMD source and screenshot provenance:
  [`../../guides/docker-webui-install/guide.qmd`](../../guides/docker-webui-install/guide.qmd)
- Generated Markdown, delivery manifest, and verification:
  [`../user-guides/docker-webui-install/README.md`](../user-guides/docker-webui-install/README.md)
- Public user bundle:
  [`../../public/docker-webui-install/README.md`](../../public/docker-webui-install/README.md)
- Public HTML:
  [`../../public/docker-webui-install/index.html`](../../public/docker-webui-install/index.html)
- Public detailed PDF:
  [`../../public/docker-webui-install/docker-webui-install-detailed-guide.pdf`](../../public/docker-webui-install/docker-webui-install-detailed-guide.pdf)

## Operator Boundary

The beginner path is: one-click installer, browser WebUI, Access key entry in
the WebUI, runtime proxy smoke through stdin transport, startup diagnostics
when needed, and preserved host `OnePersonLab/data` /
`OnePersonLab/projects` mounts.

Do not duplicate the generated guide content here. Update the Quarto body source
`../../guides/docker-webui-install/guide.qmd` for guide text, update the delivery
JSON manifest only for commands, output paths, required terms, and release gates,
update `../../guides/docker-webui-install/screenshots.manifest.json` for
screenshot provenance, and run `npm run docs:docker-webui-guide` instead.

Do not use this guide, generated Markdown, public README, contract tests, local
container smoke, or a clean doctor result to claim Docker/WebUI release-ready,
clean-VM-ready, production-ready, or real-install-ready status.

# Docker/WebUI Install Guide Sources

Owner: `one-person-lab-app`
Purpose: `docker_webui_install_guide_sources`
State: `active`
Machine boundary: Human-readable guide source and generation maintenance.

This directory maintains the Docker/WebUI Quarto guide source, generated
Markdown, and verification records. It is not the clean end-user reading
surface. Link users to
[`../../../public/docker-webui-install/`](../../../public/docker-webui-install/)
instead.

Generated reading artifacts:

- [Docker/WebUI install HTML guide](../../../public/docker-webui-install/index.html)
- [Docker/WebUI install detailed PDF](../../../public/docker-webui-install/docker-webui-install-detailed-guide.pdf)
- [Docker/WebUI install Markdown](generated/docker-webui-install.md)

Source and verification files:

- [`source/docker-webui-install.guide.qmd`](source/docker-webui-install.guide.qmd):
  canonical human-readable guide body source.
- [`source/docker-webui-install.guide.json`](source/docker-webui-install.guide.json):
  Quarto manifest for commands, output paths, assets, required terms, and
  validation boundaries.
- `verification/docker-webui-install-verification.json`: generated HTML/PDF
  verification record.

Update flow:

1. Update `source/docker-webui-install.guide.qmd` when the user-facing guide
   body, FAQ, or boundary text changes.
2. Update `source/docker-webui-install.guide.json` only when commands, output
   paths, asset inventory, required terms, or validation boundaries change.
3. Run `npm run docs:docker-webui-guide`.
4. Verify `verification/docker-webui-install-verification.json` before
   publishing.

This guide intentionally does not claim Docker/WebUI release readiness. App
release contracts, GHCR publish evidence, shell Dockerfile/web-cli behavior, and
live container smoke remain the machine truth.

Long-form HTML/PDF rendering uses Quarto Book. Do not hand-maintain generated
HTML, generated Markdown, or PDF output as a second content source.

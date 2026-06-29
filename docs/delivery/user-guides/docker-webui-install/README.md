# Docker/WebUI Install Guide Sources

Owner: `one-person-lab-app`
Purpose: `docker_webui_install_guide_sources`
State: `active`
Machine boundary: Human-readable guide source and generation maintenance.

This directory maintains the Docker/WebUI guide source, generated Markdown, and
verification records. It is not the clean end-user reading surface. Link users
to [`../../../public/docker-webui-install/`](../../../public/docker-webui-install/)
instead.

Generated reading artifacts:

- [Docker/WebUI install HTML guide](../../../public/docker-webui-install/index.html)
- [Docker/WebUI install detailed PDF](../../../public/docker-webui-install/docker-webui-install-detailed-guide.pdf)
- [Docker/WebUI install Markdown](generated/docker-webui-install.md)

Source and verification files:

- [`source/docker-webui-install.guide.json`](source/docker-webui-install.guide.json):
  canonical guide content source.
- `verification/docker-webui-install-verification.json`: generated HTML/PDF
  verification record.

Update flow:

1. Update `source/docker-webui-install.guide.json` when Docker/WebUI entry,
   commands, FAQ, or boundary text changes.
2. Run `npm run docs:docker-webui-guide`.
3. Verify `verification/docker-webui-install-verification.json` before
   publishing.

This guide intentionally does not claim Docker/WebUI release readiness. App
release contracts, GHCR publish evidence, shell Dockerfile/web-cli behavior, and
live container smoke remain the machine truth.

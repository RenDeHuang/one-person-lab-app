# Docker/WebUI Guide Entry

Owner: `one-person-lab-app`
Purpose: `docker_webui_guide_compat_entry`
State: `active_support`
Machine boundary: Human-readable route only. Docker/WebUI release truth stays in
App contracts, GHCR publish receipts, shell Dockerfile/web-cli behavior, and live
container smoke evidence.

This file keeps the older `docs/delivery/install/docker-webui-guide.*` entry
stable while the maintained guide source lives under
[`../user-guides/docker-webui-install/`](../user-guides/docker-webui-install/).

Use these canonical entries:

- Maintainer source, generated Markdown, screenshots, and verification:
  [`../user-guides/docker-webui-install/README.md`](../user-guides/docker-webui-install/README.md)
- Public user bundle:
  [`../../public/docker-webui-install/README.md`](../../public/docker-webui-install/README.md)
- Public HTML:
  [`../../public/docker-webui-install/index.html`](../../public/docker-webui-install/index.html)
- Public detailed PDF:
  [`../../public/docker-webui-install/docker-webui-install-detailed-guide.pdf`](../../public/docker-webui-install/docker-webui-install-detailed-guide.pdf)

Do not duplicate the generated guide content here; update
`../user-guides/docker-webui-install/source/docker-webui-install.guide.json` and
run `npm run docs:docker-webui-guide` instead.

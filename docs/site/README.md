# Latest Published Docs

Owner: `one-person-lab-app`
Purpose: `latest_published_docs_output_boundary`
State: `active_support`
Machine boundary: `docs/site/latest/` is generated output for GitHub Pages.
Source truth stays in `docs/guides/`, `docs/whitepapers/`, `docs/publishing/`,
and `docs/delivery/` manifests and verification records.

The App publishes one current user-facing documentation set, not one copy per
release. CI builds `docs/site/latest/` and deploys `docs/site/` to GitHub Pages.
Generated HTML files use artifact-aligned names such as
`macos-app-install.html`, not `index.html`.

Tracked source:

- User guide prose: `docs/guides/**`.
- Whitepaper prose: `docs/whitepapers/**`.
- Publishing templates: `docs/publishing/**`.
- Generation manifests and verification records: `docs/delivery/**`.

Generated output:

- `docs/site/latest/macos-app-install/macos-app-install.html`
- `docs/site/latest/macos-app-install/macos-app-install-detailed-guide.pdf`
- `docs/site/latest/macos-app-install/macos-app-install-slides.pdf`
- `docs/site/latest/macos-app-install/macos-app-install-slides.pptx`
- `docs/site/latest/docker-webui-install/docker-webui-install.html`
- `docs/site/latest/docker-webui-install/docker-webui-install-detailed-guide.pdf`
- `docs/site/latest/whitepapers/opl-app-whitepaper.html`
- `docs/site/latest/whitepapers/opl-app-whitepaper.pdf`

Do not commit `docs/site/latest/`. Rebuild it with `npm run docs:latest`.

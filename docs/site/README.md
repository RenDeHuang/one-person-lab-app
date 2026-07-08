# Latest Published Docs

Owner: `one-person-lab-app`
Purpose: `latest_published_docs_output_boundary`
State: `active_support`
Machine boundary: `docs/site/latest/` is local generated output for GitHub
Pages. It is not tracked on `main`.
Source truth stays in `docs/guides/`, `docs/whitepapers/`, `docs/publishing/`,
and `docs/delivery/` manifests and verification records.

The App publishes one current user-facing documentation set, not one copy per
release. Build locally, then publish the final user-facing files to the
`gh-pages` branch with `npm run docs:publish`. GitHub Actions does not rebuild
these docs.
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

Do not commit `docs/site/latest/` on `main`. Rebuild it with
`npm run docs:latest`; publish it with `npm run docs:publish`. The publish
script filters out process files such as generated Markdown and JSON. Remove the
local generated copy with `npm run cleanup:local-artifacts -- --scope docs --execute`
when it is no longer needed for preview or publish.

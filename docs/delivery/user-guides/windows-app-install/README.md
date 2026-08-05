# Windows App Install Guide Delivery

Owner: `one-person-lab-app`
Purpose: `windows_app_install_guide_delivery_artifacts`
State: `active_stable_release_asset`
Machine boundary: Generated artifacts, Quarto manifest, and verification records. Human-readable guide prose is maintained under `docs/guides/windows-app-install/`.

This directory is a maintenance surface. After owner-controlled publication
and public readback, the user-facing Pages targets are:

- `https://gaofeng21cn.github.io/one-person-lab-app/latest/windows-app-install/windows-app-install.html`
- `https://gaofeng21cn.github.io/one-person-lab-app/latest/windows-app-install/windows-app-install-detailed-guide.pdf`

Canonical source and machine files:

- [`../../../guides/windows-app-install/guide.qmd`](../../../guides/windows-app-install/guide.qmd):
  long-form Windows x64 install and configuration guide.
- [`source/windows-app-install.quarto.json`](source/windows-app-install.quarto.json):
  exact Stable Release asset, output, required-term, and safety-boundary manifest.
- `generated/windows-app-install.md`: generated Markdown snapshot, recreated by
  `npm run docs:windows-guide` and ignored by Git.
- `verification/windows-app-install-verification.json`: generated HTML/PDF
  verification record.

Update flow:

1. Update the exact Stable Release tag, installer name, size, digest, and
   signing status in the machine manifest only after public owner readback.
2. Edit the QMD for user-visible steps and limitations.
3. Run `npm run docs:windows-guide`.
4. Review the verification JSON and rendered PDF before `npm run docs:publish`.

The guide describes the current public Windows x64 asset on the Stable Release
carrier. That publication fact does not prove WSL2 runtime acceptance, installed
behavior, signing, supported-platform completion, or release-wide readiness.

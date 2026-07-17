# AionUI 41301 Parity GUI Evidence

Owner: `one-person-lab-app`
Purpose: `aionui_41301_final_parity_packaged_route_visual_evidence`
State: `historical_exact_cohort_evidence`
Machine boundary: `manifest.json` and `source-manifest.json` bind this exact
historical cohort. These files prove only the declared packaged visual states;
they do not prove installed acceptance, whole-product parity, or release.

This directory promotes the final parity cohort from the Shell-local generated
evidence surface into App-owned evidence. It is bound to
`opl-aion-shell@b2c05a1c8dc4ef81094323b49a67b601e3c425f5`.

The nine packaged macOS arm64 states cover Home desktop/mobile, the mobile
composer action sheet, Runtime unavailable projection, ordinary conversation
composer/model controls, Environment, Files, and mobile Preview. Every declared
anchor and layout check passed, and each PNG is non-empty. The manifest does not
claim 1:1 visual parity, installed-path acceptance, public release readiness, or
completion of states outside this matrix.

The package was built but not installed:

- bundle id: `cn.onepersonlab.opl`
- version: `26.7.13`
- `app.asar` SHA-256:
  `726200362ed6038211dfb610b7639cb7fe395df54b92bade752c9b8f5a538823`
- codesign: verified
- installed: `false`

- [`manifest.json`](manifest.json) binds promoted PNG bytes, hashes, package
  metadata, and the exact Shell HEAD.
- [`source-manifest.json`](source-manifest.json) preserves route, viewport,
  theme, locale, state, anchor, layout-check, and coverage-gap readback.

The historical eight-state cohort remains unchanged under
[`../aionui-41301/`](../aionui-41301/).

Regenerate from the exact clean Shell checkout with:

```bash
AIONUI_E2E_PRODUCT_PROFILE=1 E2E_PACKAGED=1 E2E_SCREENSHOTS=1 \
  bun run test:e2e -- tests/e2e/features/visual-evidence/gui-baseline.e2e.ts
```

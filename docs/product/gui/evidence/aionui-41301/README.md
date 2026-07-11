# AionUI 41301 GUI Evidence

Owner: `one-person-lab-app`
Purpose: `aionui_41301_packaged_route_visual_evidence`
State: `current_cohort_evidence`

This directory promotes the final packaged route screenshots from the Shell-local
ignored evidence directory into an App-owned, manifest-backed evidence surface.
It is bound to `opl-aion-shell@bbf94f2e44ef806e33451da568a3814658484619`.

The evidence proves that the eight declared Home and ordinary-conversation states
rendered non-empty pixels and passed their required anchor and layout checks in the
packaged macOS App. It does not prove 1:1 visual parity, public release readiness,
runtime currentness, or owner promotion.

- [`manifest.json`](manifest.json) binds promoted PNG bytes and hashes.
- [`source-manifest.json`](source-manifest.json) preserves the complete route,
  viewport, theme, locale, state, anchor, and layout-check readback.

Regenerate from the exact clean Shell checkout with:

```bash
AIONUI_E2E_PRODUCT_PROFILE=1 E2E_PACKAGED=1 E2E_SCREENSHOTS=1 \
  bun run test:e2e -- tests/e2e/features/visual-evidence/gui-baseline.e2e.ts
```

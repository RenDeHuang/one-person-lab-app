# App Testing

Owner: `one-person-lab-app`
Purpose: `app_testing_docs`
State: `active`
Machine boundary: Human-readable testing guide. Test code, contracts, and
artifacts are the executable truth.

## Active Shell Checks

```bash
bun install --cwd shells/aionui --frozen-lockfile
bun run --cwd shells/aionui i18n:types
cd shells/aionui && node scripts/check-i18n.js
bun run test
bun run --cwd shells/aionui lint
bun run --cwd shells/aionui validate:opl-package
```

`bun run test` is the App-level stable runner. It reads
`contracts/app-shell-adapter.json`, enumerates the active shell Vitest suites,
and runs them as isolated sequential `node` / `dom` chunks. The upstream shell
entrypoint remains available as `bun run --cwd shells/aionui test` for direct
AionUI intake work.

## App-Level Checks

```bash
node scripts/validate-active-shell.mjs --quick
npm run test:release-boundary
node scripts/validate-release-boundary.mjs
node scripts/prepare-release-assets.mjs build-artifacts release-assets
node scripts/validate-release.mjs release-assets
```

The App page-state matrix is declared in
`contracts/app-page-state-matrix.json`. The first-run matrix is declared in
`contracts/app-first-run-test-matrix.json`.

## Installed App Smoke

After a standard macOS build, replace the installed app and run the packaged GUI
smoke against the real `/Applications` bundle:

```bash
node shells/aionui/scripts/opl-first-run-vm-smoke.mjs \
  --app "/Applications/One Person Lab.app" \
  --artifacts artifacts/opl-installed-smoke-<stamp> \
  --timeout-ms 180000
```

2026-05-15 evidence: `/Applications/One Person Lab.app` was replaced with the
26.5.15 arm64 build, the bundle included `Contents/Resources/opl-full-runtime`,
and the smoke passed with `status=passed` and label `opl-guid-entry`. Final
evidence directory: `artifacts/opl-installed-smoke-20260515-154821`.

## Release Matrix

- Contracts/unit: `npm run test:release-boundary`.
- Standard release metadata: `node scripts/validate-release.mjs release-assets`.
- App-owned release boundary: `node scripts/validate-release-boundary.mjs`.
- Full first-install package: `npm run release:full -- --version <version>`.
- GUI smoke: installed `/Applications/One Person Lab.app` smoke or the App repo
  VM workflow.
- Docker/WebUI: build from `shells/aionui/Dockerfile` and verify the WebUI
  starts against the Framework runtime surfaces.

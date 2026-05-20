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
node --experimental-strip-types scripts/validate-active-shell.ts --quick
npm run test:release-boundary
node --experimental-strip-types scripts/validate-release-boundary.ts
node --experimental-strip-types scripts/prepare-release-assets.ts build-artifacts release-assets
node --experimental-strip-types scripts/validate-release.ts release-assets
```

The App page-state matrix is declared in
`contracts/app-page-state-matrix.json`. The first-run matrix is declared in
`contracts/app-first-run-test-matrix.json`.
The App product profile is declared in
`contracts/app-product-profile.json`; `validate-active-shell.ts --quick` and
`npm run test:release-boundary` verify that the profile still owns only
desktop product defaults and still excludes runtime/provider/domain authority.

## Installed App Smoke

After a standard macOS build, replace the installed app and run the packaged GUI
smoke against the real `/Applications` bundle:

```bash
node shells/aionui/scripts/opl-first-run-vm-smoke.mjs \
  --dmg shells/aionui/out/One-Person-Lab-<version>-mac-arm64.dmg \
  --artifacts artifacts/opl-installed-smoke-<stamp> \
  --timeout-ms 180000
```

2026-05-15 evidence: the standard 26.5.15 arm64 DMG replaced
`/Applications/One Person Lab.app`; the previously installed 1.5G app bundle
contained `Contents/Resources/opl-full-runtime`, and the replacement bundle was
354M with no `opl-full-runtime`. The smoke passed with `status=passed` and
label `opl-guid-entry`. Final evidence directory:
`artifacts/opl-installed-smoke-20260515-204923`.

Tart clean-VM smoke reached `wait_for_ssh` against
`opl-first-run-tahoe-base`, received guest IP `192.168.64.87`, timed out before
guest execution, and cleaned up the temporary VM. Evidence directory:
`artifacts/opl-first-run-tart-20260515-205500`.

## Release Matrix

- Contracts/unit: `npm run test:release-boundary`.
- Standard release metadata: `node --experimental-strip-types scripts/validate-release.ts release-assets`.
- App-owned release boundary: `node --experimental-strip-types scripts/validate-release-boundary.ts`.
- App product profile sync: standard and Full release preparation must generate
  `shells/aionui/src/common/config/oplProductProfile.generated.json`.
- Full first-install package: `npm run release:full -- --version <version>`.
- GUI smoke: installed `/Applications/One Person Lab.app` smoke or the App repo
  VM workflow. The release-blocking Full first-install VM gate uses a clean
  no-CLT Tart base, the Full DMG, `1920x1080px`, Codex/OpenAI API key wizard
  submission, Settings page coverage, and Full runtime readiness. CLT, git, and
  managed repo sync are deferred maintenance and must not block Core, Domain
  module, or family runtime provider readiness.
- Docker/WebUI: build from `shells/aionui/Dockerfile` and verify the WebUI
  starts against the Framework runtime surfaces.

2026-05-15 Docker/WebUI evidence: `docker build -t
one-person-lab-webui:26.5.15-smoke .` completed from `shells/aionui`, the image
size was `1132840811` bytes, and a container on `127.0.0.1:33015` returned HTTP
200 for `/` and `manifest.webmanifest`.

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
npm run validate:gui-shell
```

`bun run test` is the App-level stable runner. It reads
`contracts/app-shell-adapter.json`, enumerates the active shell Vitest suites,
and runs them as isolated sequential `node` / `dom` chunks. The upstream shell
entrypoint remains available as `bun run --cwd shells/aionui test` for direct
AionUI intake work.

`validate:gui-shell` is the App-root gate for active shell health plus GUI
compile evidence. It runs the full active shell validation list from
`contracts/app-shell-adapter.json`, syncs App-owned release payloads into the
active shell, and compiles the Electron main, preload, and renderer bundles
through the shell `bun run package` entry.

## App-Level Checks

```bash
node --experimental-strip-types scripts/validate-active-shell.ts --quick
npm run test:release-boundary
npm run validate:release-boundary
node --experimental-strip-types scripts/collect-release-evidence.ts --bundle-dir release-evidence/<version> --action-id <opl-runtime-safe-action-id> --execute-action --overwrite
npm run release:evidence:manifest -- --bundle-dir release-evidence/<version> --overwrite
npm run release:evidence:validate -- --bundle-dir release-evidence/<version>
node --experimental-strip-types scripts/prepare-release-assets.ts build-artifacts release-assets
node --experimental-strip-types scripts/validate-release.ts release-assets
npm run hygiene:fallow -- --format json --summary
```

The App page-state matrix is declared in
`contracts/app-page-state-matrix.json`. The first-run matrix is declared in
`contracts/app-first-run-test-matrix.json`.
The App product profile is declared in
`contracts/app-product-profile.json`; `validate-active-shell.ts --quick` and
`npm run test:release-boundary` verify that the profile still owns only
desktop product defaults and still excludes runtime/provider/domain authority.
The runtime page matrix also verifies the App/operator evidence path: summary
read model first, lazy full-detail load, refs-only dry-run/execute action
commands, receipt/count refresh after execute, and explicit authority-boundary
fields.

Release evidence bundle validation requires `evidence-manifest.json` plus the
contracted artifact files. When a local lane cannot produce a clean VM smoke,
settings smoke, remote Release verification, OPL runtime JSON, or screenshots,
the manifest must mark those entries as `missing`; `--allow-missing-evidence`
then validates the gap report without treating it as packaged App evidence.
`collect-release-evidence.ts` can fill the OPL runtime JSON and selected
safe-action dry-run/execute artifacts from the live Framework CLI before that
validation step.

`hygiene:fallow` is scoped to App-owned root wrappers, contracts, and docs.
`.fallowrc.json` excludes the ignored `shells/aionui/**` external checkout so
App hygiene does not report shell-owned dependency or source findings. It is
not GUI shell build or runtime evidence; use `npm run validate:gui-shell` for
active shell validation and GUI compile proof. Run shell hygiene in the
`gaofeng21cn/opl-aion-shell` repository.

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
- App-owned release boundary: `npm run validate:release-boundary`.
- Fallow production hygiene: `npm run hygiene:fallow -- --format json --summary`.
- Active GUI shell validation: `npm run validate:gui-shell`.
- App product profile sync: standard and Full release preparation must generate
  the active shell `shell_contract.paths.product_profile_target` declared in
  `contracts/app-shell-adapter.json`.
- Full first-install package: `npm run release:full -- --version <version>`.
- GUI smoke: installed `/Applications/One Person Lab.app` smoke or the App repo
  VM workflow. The release-blocking Full first-install VM gate uses a clean
  no-CLT Tart base, the Full DMG, `1920x1080px`, Codex/OpenAI API key wizard
  submission, Settings page coverage, and Full runtime readiness. CLT, git, and
  managed repo sync are deferred maintenance and must not block Core, Domain
  module, or family runtime provider readiness.
- Scheduled VM smoke backlog: the App repo VM workflow must cancel stale
  scheduled runs through GitHub Actions concurrency while keeping manual and
  release-called validation runs serialized in a separate non-cancelling group.
  `npm run test:release-boundary` locks this workflow policy.
- Docker/WebUI: build from `shells/aionui/Dockerfile` and verify the WebUI
  starts against the Framework runtime surfaces.

2026-05-15 Docker/WebUI evidence: `docker build -t
one-person-lab-webui:26.5.15-smoke .` completed from `shells/aionui`, the image
size was `1132840811` bytes, and a container on `127.0.0.1:33015` returned HTTP
200 for `/` and `manifest.webmanifest`.

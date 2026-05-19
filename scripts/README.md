# App Root Scripts

The root `scripts/` directory exposes App-level wrappers. The active Electron
shell implementation is checked out from `gaofeng21cn/opl-aion-shell` and
exposes its shell-specific helpers under `shells/aionui/scripts/`.

| Script | Purpose |
| --- | --- |
| `ensure-active-shell.ts` | Clones or validates the external active shell checkout at `shells/aionui`. |
| `validate-active-shell.ts` | Validates `contracts/app-shell-adapter.json` and runs selected active shell validation commands. |
| `prepare-release-assets.ts` | Calls the active shell release asset normalizer from the App root. |
| `validate-release.ts` | Verifies release assets and enforces that standard updater metadata excludes Full first-install assets. |
| `publish-release.ts` | Creates or refreshes App GitHub Release assets from local shell output, prebuilt standard assets, and optional Full first-install assets. |

Examples:

```bash
node --experimental-strip-types scripts/ensure-active-shell.ts
node --experimental-strip-types scripts/validate-active-shell.ts --quick
node --experimental-strip-types scripts/validate-active-shell.ts --only i18n_types,i18n_check,typecheck
node --experimental-strip-types scripts/prepare-release-assets.ts build-artifacts release-assets
node --experimental-strip-types scripts/validate-release.ts release-assets
npm run release:publish -- --no-build --version <version> --standard-artifacts-dir release-assets
```

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
| `verify-remote-release-assets.ts` | Downloads GitHub Release assets and verifies remote size, sha256 digest, updater metadata, Full manifest, Full README language, Full checksums, and Full size budgets. |
| `publish-release.ts` | Creates or refreshes App GitHub Release assets from local shell output, prebuilt standard assets, and optional Full first-install assets. |
| `plan-release-candidate.ts` | Prints the release lane plan, including the serialized clean no-CLT Full first-install VM gate. |
| `write-release-evidence-manifest.ts` | Writes `evidence-manifest.json` for a release evidence bundle and marks absent VM/remote artifacts as missing evidence. |
| `validate-release-evidence-bundle.ts` | Validates a release evidence bundle manifest and artifact files; default validation fails closed when required evidence is missing. |

Examples:

```bash
node --experimental-strip-types scripts/ensure-active-shell.ts
node --experimental-strip-types scripts/validate-active-shell.ts --quick
node --experimental-strip-types scripts/validate-active-shell.ts --only i18n_types,i18n_check,typecheck
node --experimental-strip-types scripts/prepare-release-assets.ts build-artifacts release-assets
node --experimental-strip-types scripts/validate-release.ts release-assets
npm run release:publish -- --no-build --version <version> --standard-artifacts-dir release-assets
npm run verify-remote-release -- --version <version> --include-full-package
node --experimental-strip-types scripts/write-release-evidence-manifest.ts --bundle-dir release-evidence/<version>
node --experimental-strip-types scripts/validate-release-evidence-bundle.ts --bundle-dir release-evidence/<version>
npm run test:opl-first-run-vm:tart -- --dry-run --source-vm opl-first-run-no-clt-clean-base --dmg dist/opl-full-release/One-Person-Lab-Full-<version>-mac-arm64.dmg --smoke-profile no-clt-clean-vm --display 1920x1080px --settings-smoke --runtime-profile full
```

Full size policy lives in `docs/release/README.md`: release review records the
compressed DMG size, uncompressed runtime size, and layer breakdown, then uses
`verify-remote-release-assets.ts` as the remote verifier size budget check for
published GitHub Release assets. The remote verifier enforces the compressed
Full DMG budget from the GitHub asset size and the uncompressed runtime budget
from `full-package-manifest.json` `size_breakdown.total_runtime_uncompressed_bytes`.

The clean no-CLT first-install gate is wired through
`.github/workflows/opl-first-run-vm.yml` and the active shell Tart smoke helper.
It downloads a `One-Person-Lab-Full-*-mac-arm64.dmg`, clones a clean no-CLT Tart
base VM, fixes the logical display at `1920x1080px`, submits the Codex/OpenAI
API key configuration wizard, sweeps the packaged Settings pages, and keeps
Full runtime readiness on the release-blocking path. Command Line Tools, git
availability, and managed repo sync are deferred maintenance and must not block
Core, Domain module, or family runtime provider readiness for the Full
first-run gate.

<h1 align="center">One Person Lab App</h1>

<p align="center"><strong>The desktop workbench for One Person Lab.</strong></p>
<p align="center">Package the framework, domain agents, and companion tools into one app for research, grants, presentations, and general knowledge work.</p>

## Download

Download the current desktop package from the App repository releases:

[Download One Person Lab App](https://github.com/gaofeng21cn/one-person-lab-app/releases/latest)

For a first-time macOS arm64 install, choose `One-Person-Lab-Full-<version>-mac-arm64.dmg`. The Full first-install package is for new users and can include the desktop app, One Person Lab framework payloads, MAS/MAG/RCA, the current family runtime payload, `officecli`, and recommended skill payloads.

Normal in-app updates use the standard App packages and `latest*.yml` updater metadata. Full first-install packages are published as separate complete-install assets.

## What The App Does

One Person Lab App is the daily workbench users open:

- Start general work, medical research, grant writing, and presentation preparation from one desktop interface.
- Enter Research Foundry, Grant Foundry, and Presentation Foundry.
- View progress, files, runtime status, and recoverable work context.
- Check the local environment, framework dependency, domain modules, companion tools, and package readiness on first launch.
- Present the One Person Lab framework and domain agents as a usable product experience.

## User Path

1. Download the App package from Releases.
2. Open `One Person Lab.app`.
3. Let first launch check the local environment and framework dependency.
4. Choose a workspace directory.
5. Start general work or enter Research, Grant, or Presentation Foundry.
6. Use progress, files, and runtime status views to continue work and inspect deliverables.

## Product Boundaries

One Person Lab App owns the desktop product experience: packaging, release assets, updater metadata, first-run checks, GUI state tests, screenshots, and user documentation.

The One Person Lab framework owns CLI, activation, stage control, runtime providers, queue, contracts, module discovery, skill sync, runtime snapshots, and progress projections. MAS, MAG, and RCA own their domain judgment, quality verdicts, stage semantics, and deliverables.

Need framework, runtime, or contract details? Go to [`gaofeng21cn/one-person-lab`](https://github.com/gaofeng21cn/one-person-lab).

## Technical Entry

<details>
  <summary><strong>Developer and release notes</strong></summary>

### Repository Layout

```text
one-person-lab-app/
  docs/                 App product, release, testing, screenshot, and user docs
  contracts/            App-level machine-readable contracts
  scripts/              App-level validation and release wrappers
  shells/
    aionui/             External checkout of gaofeng21cn/opl-aion-shell
```

`shells/aionui/` is intentionally not tracked by this repository. It is checked
out from `gaofeng21cn/opl-aion-shell` for builds and validation, keeping AionUI
history and contributors outside the clean App product repository.

### Validation Commands

```bash
npm run ensure:shell
bun install --cwd shells/aionui --frozen-lockfile
bun run validate:active-shell
bun run i18n:types
bun run test
bun run build-mac
```

Release asset normalization and validation are exposed from the App root:

```bash
bun run prepare-release-assets -- build-artifacts release-assets
bun run validate-release -- release-assets
```

The active shell is declared in [`contracts/app-shell-adapter.json`](contracts/app-shell-adapter.json):

- active shell: `aionui`
- shell root: `shells/aionui`
- upstream family: `AionUI`
- shell source: `gaofeng21cn/opl-aion-shell`
- shell history policy: external checkout, not merged into App default branch

See [`docs/status.md`](docs/status.md) for the current migration and release state.

</details>

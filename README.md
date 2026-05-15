<p align="center">
  <img src="assets/branding/opl-banner.png" alt="One Person Lab App banner" width="100%" />
</p>

<p align="center">
  <a href="./README.md"><strong>English</strong></a> | <a href="./README.zh-CN.md">中文</a>
</p>

<h1 align="center">One Person Lab App</h1>

<p align="center"><strong>The desktop workbench for One Person Lab</strong></p>
<p align="center">Package One Person Lab, domain agents, and companion tools into one app for research, grants, presentations, and general knowledge work.</p>

<p align="center">
  <img src="assets/branding/opl-app-product-map.png" alt="One Person Lab App product packaging map" width="100%" />
</p>

## Download And Install

macOS users can use the one-shot installer. It prepares the One Person Lab runtime environment and installs or opens the desktop App:

```bash
curl -fsSL https://raw.githubusercontent.com/gaofeng21cn/one-person-lab-app/main/install.sh | bash
```

You can also download the current desktop package from the App repository releases:

[Download One Person Lab App](https://github.com/gaofeng21cn/one-person-lab-app/releases/latest)

For a first-time macOS arm64 install, choose `One-Person-Lab-Full-<version>-mac-arm64.dmg`. The complete first-install package includes the desktop app, One Person Lab, the Research/Grant/Presentation agents, current runtime payloads, `officecli`, and recommended skill payloads.

Daily updates are handled by the in-app update channel. Releases also publish standard App packages, updater metadata, and separate complete first-install assets.

For Docker or server deployment, see the [Docker/WebUI install guide](https://github.com/gaofeng21cn/one-person-lab/blob/main/docs/references/current-support/opl-docker-webui-deployment.md).

## What The App Does

One Person Lab App is the daily workbench for users:

- Enter general work, medical research, grant writing, and presentation preparation from one desktop interface.
- Enter Research Foundry, Grant Foundry, and Presentation Foundry.
- View progress, files, runtime status, and recoverable work context for continuing long tasks and inspecting deliverables.
- Check the local environment, framework dependency, domain modules, companion tools, and package readiness on first launch.
- Present One Person Lab and domain agents as a usable product experience.

## User Path

1. Download the App package from Releases.
2. Open `One Person Lab.app`.
3. Let first launch check the local environment, framework dependency, and domain modules.
4. Choose a workspace directory.
5. Start general work or enter Research, Grant, or Presentation Foundry.
6. Use progress, files, and runtime status views to continue work and inspect deliverables.

## Product Boundaries

One Person Lab App owns the desktop product experience: packaging, release assets, updater metadata, first-run checks, GUI state tests, screenshots, and user documentation.

One Person Lab provides CLI, activation, stage control, runtime providers, queue, contracts, module discovery, skill sync, runtime snapshots, and progress projections. MAS, MAG, and RCA carry their domain judgment, quality verdicts, stage semantics, and deliverables.

Need framework, runtime, or contract details? Go to [`gaofeng21cn/one-person-lab`](https://github.com/gaofeng21cn/one-person-lab).

## Technical Entry

<details>
  <summary><strong>Developer and release notes</strong></summary>

### Repository Layout

```text
one-person-lab-app/
  assets/               App README and product visual assets
  docs/                 App product, release, testing, screenshot, and user docs
  contracts/            App-level machine-readable contracts
  scripts/              App-level validation and release wrappers
  shells/
    aionui/             External checkout of gaofeng21cn/opl-aion-shell
```

`shells/aionui/` is intentionally not tracked by this repository. It is checked out from `gaofeng21cn/opl-aion-shell` for builds and validation, keeping AionUI history and contributors outside the clean App product repository.

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

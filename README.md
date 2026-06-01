<p align="center">
  <img src="assets/branding/opl-banner.png" alt="One Person Lab App banner" width="100%" />
</p>

<p align="center">
  <a href="./README.md"><strong>English</strong></a> | <a href="./README.zh-CN.md">中文</a>
</p>

<h1 align="center">One Person Lab App</h1>

<p align="center"><strong>A chat-first desktop AI app for complex knowledge work</strong></p>
<p align="center">Start research, grants, presentations, and general tasks from one app; track progress, resume long-running work, and inspect deliverables.</p>

<p align="center">
  <img src="assets/branding/opl-app-product-map.png" alt="One Person Lab App product packaging map" width="100%" />
</p>

## Why It Exists

AI is already strong at answering questions and generating content. The harder part begins when the work becomes a paper, a grant proposal, a presentation package, or a long-running project. Users need to know:

- Where do I start, and what should happen next?
- How far did the previous task get?
- Which files were produced, and what still needs review?
- Is the background work still running, and where did it stop if it failed?
- Can research, grant, and presentation agents live behind one clear entry point?

**One Person Lab App is that entry point.** It packages One Person Lab, professional agents, and companion tools into a desktop app for complex knowledge work.

## Core Highlights

**One entry point for professional AI work**<br/>
Enter general work, medical research, grant writing, and presentation preparation from the desktop app instead of jumping across commands, repositories, and tools.

**Visible progress for long tasks**<br/>
The app shows task progress, files, runtime status, and recoverable work context. When you come back, you can see what happened, what was produced, and whether anything needs human attention.

**First install feels like a product**<br/>
New macOS users can start with the complete first-install package, open the App first, and let background maintenance prepare the framework, professional agents, skills, and tool payloads.

**Professional agents with clear roles**<br/>
Research Foundry, Grant Foundry, and Presentation Foundry focus on different deliverables. Users get one interface while each agent keeps its own professional boundary.

**Built for daily use and long-running work**<br/>
The app is not just for one chat. It supports work that needs multiple rounds, background maintenance, recovery after failure, and continuing delivery.

## Download And Install

macOS users can use the one-shot installer. It prepares the One Person Lab runtime environment and installs or opens the desktop App:

```bash
curl -fsSL https://raw.githubusercontent.com/gaofeng21cn/one-person-lab-app/main/install.sh | bash
```

The installer defaults to an App-first setup so a clean Mac can open the App before Git-backed module maintenance finishes. Use `--complete` when you explicitly want the full framework/module install from the terminal.

You can also download the current desktop package from the App repository releases:

[Download One Person Lab App](https://github.com/gaofeng21cn/one-person-lab-app/releases/latest)

For a first-time macOS arm64 install, choose `One-Person-Lab-Full-<version>-mac-arm64.dmg`. The complete first-install package includes the desktop app, One Person Lab, the Research/Grant/Presentation agents, current runtime payloads, `officecli`, and recommended skill payloads.

For a screenshot-based first-run walkthrough, use the primary [macOS App install slides PDF](docs/user-guides/macos-app-install-slides.pdf). The detailed long-form companion is [macOS App install detailed PDF](docs/user-guides/macos-app-install-detailed-guide.pdf).

Daily updates are handled by the in-app update channel. Releases also publish standard App packages, updater metadata, and separate complete first-install assets.

For Docker or server deployment, see the [Docker/WebUI install guide](https://github.com/gaofeng21cn/one-person-lab/blob/main/docs/references/current-support/opl-docker-webui-deployment.md).

## What The App Does

One Person Lab App is the daily chat-first desktop entry point for users and the purpose-first Codex wrapper product truth:

- Enter general work, medical research, grant writing, and presentation preparation from one desktop interface.
- Enter Research Foundry, Grant Foundry, and Presentation Foundry.
- View progress, files, runtime status, and recoverable work context for continuing long tasks and inspecting deliverables.
- Consume `opl app state --profile fast --json` as the runtime page summary and refresh source, keep `opl app state --profile full --json` for explicit full-state diagnostic or release evidence, and lazy-load full Framework drilldown only on demand. The page defaults to project progress and next owner action first: next step, next owner, delta class, and blocker state appear before full evidence ledger detail. Full ledger detail is on-demand diagnostic, audit, or release evidence.
- Display task movement only from OPL shared progress projection delta classifications. Platform repair is shown as infrastructure repair and must not be counted as deliverable, paper, manuscript, or submission progress.
- On first launch, reach `ready_to_launch` before `/guid` from the Core checks: workspace root, Codex CLI, and Codex config. Domain modules, the family runtime provider, recommended skills, native helpers, repo sync, CLT, and ecosystem updates remain Full readiness or background maintenance.
- Show first-launch phase, Core progress, Full readiness progress, background maintenance counts, blockers, and next steps from the shared `opl system initialize --json` model rather than installer-specific progress state.
- Expose Foundry Agents through one public semantic path: the domain skill is the ABI. Codex App may receive MAS/MAG/RCA through plugin-packaged skills, while CLI and direct Codex use the same skill/action/stage metadata. Plugin packaging must not create a second semantic map or duplicate bare `~/.codex/skills/{mas,mag,rca}` mirrors.
- Validate independent agent installation and Codex plugin registration through one machine gate: `npm run validate:agent-installation`. External installers and user-provided agents can pass `-- --agent-root mas=<path> --agent-root mag=<path> --agent-root rca=<path>` to verify real `.codex-plugin/plugin.json` plus `skills/<id>/SKILL.md` layouts, and `-- --codex-skills-root <path>` to fail closed when MAS/MAG/RCA are mirrored as duplicate bare skills.
- Present One Person Lab and domain agents as a usable product experience.

## User Path

1. Download the App package from Releases.
2. Open `One Person Lab.app`.
3. Let first launch complete Core readiness before `/guid`: workspace root, Codex CLI, and Codex config. The visible progress bar and step list come from OPL Framework initialization state.
4. Choose a workspace directory.
5. Start general work or enter Research, Grant, or Presentation Foundry.
6. Use progress, files, and runtime status views to continue work and inspect deliverables.

## Product Boundaries

One Person Lab App owns the desktop product experience: packaging, release assets, updater metadata, first-run checks, GUI state tests, screenshots, and user documentation. App release/user-path evidence proves only the same release cohort's App user-path evidence; it does not promote stable/latest or prove MAS/MAG/RCA domain readiness or OPL family production readiness.

App-owned product defaults are declared in [`contracts/app-product-profile.json`](contracts/app-product-profile.json). Installation and Codex-visible exposure policy is declared in [`contracts/app-install-exposure-policy.json`](contracts/app-install-exposure-policy.json): the App decides the user-facing install surfaces and default visible entries, while OPL Framework produces the install/sync/read-model surfaces and domain repos keep skill semantics. The same contract now owns the `agent_installation_contract`, which keeps MAS/MAG/RCA plugin registry entries, direct skill compatibility, OPL Meta Agent generated skill exposure, optional live `~/.codex/skills` duplicate-mirror checks, and duplicate bare-skill prevention behind `npm run validate:agent-installation`. The runtime bridge is declared in [`contracts/app-runtime-bridge.json`](contracts/app-runtime-bridge.json): OPL owns the runtime/app CLI protocol, the App owns the GUI bridge contract, and `opl-aion-shell` is the current replaceable adapter implementation. Release scripts sync App-owned contracts into the active shell before standard and Full packaging so Codex defaults, visible companion skills, first-run maintenance behavior, and user-facing Settings labels are configured by the App repository instead of being scattered through the AionUI fork.

GUI product truth is App-owned as well. The active shell implements the current renderer and package surface, but page behavior, model-selection policy, onboarding behavior, screenshots, release docs, and user-facing defaults are governed by App contracts. Future shells stay under `shells/<candidate>` until the App shell adapter, product profile sync, page-state and first-run matrices, active-shell validation, GUI package compile, and external checkout history policy all pass. A technical verification shell can be selected explicitly with `OPL_APP_SHELL_ADAPTER_CONTRACT=contracts/shell-adapters/<candidate>.json`; that selected wrapper path must compile a launchable `.app` bundle and package manifest for the candidate. Candidate shells enter product truth only through App-owned contracts and validation gates, not shell roadmaps or upstream defaults. The default release shell remains `contracts/app-shell-adapter.json`.

The GUI definition stack starts with the shell-independent ideal interaction spec in [`docs/app-ideal-gui-interaction-spec.md`](docs/app-ideal-gui-interaction-spec.md), then the Codex-to-OPL product delta in [`docs/codex-to-opl-app-delta.md`](docs/codex-to-opl-app-delta.md), then the cross-shell capability inventory in [`docs/app-gui-feature-inventory.md`](docs/app-gui-feature-inventory.md). Use them in that order when designing or reviewing a GUI shell. The target is a Codex App-shaped, chat-first OPL product; AionUI notes, `agui-codex` candidate work, and external references such as PilotDeck remain implementation or reference material rather than product authority.

One Person Lab provides CLI, activation, stage control, runtime providers, queue, contracts, module discovery, skill sync, runtime snapshots, and shared progress projections. The App consumes those projections as display-only refs; MAS, MAG, and RCA carry their domain judgment, quality verdicts, stage semantics, and deliverables.

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

`shells/aionui/` is intentionally not tracked by this repository. It is checked out from `gaofeng21cn/opl-aion-shell` for builds and validation, keeping AionUI history and contributors outside the clean App product repository. Candidate shells follow the same external-checkout rule; for example, `shells/agui-codex/` links to `gaofeng21cn/opl-agui-codex-shell` and is selected only for explicit technical verification builds.

### Validation Commands

```bash
npm run ensure:shell
bun install --cwd shells/aionui --frozen-lockfile
bun run validate:active-shell
npm run validate:gui-shell
bun run i18n:types
bun run test
bun run build-mac
```

`hygiene:fallow` intentionally covers only App-root wrappers and contracts. The
active GUI shell remains validated and compiled through `validate:gui-shell`.

Release asset normalization and validation are exposed from the App root:

```bash
bun run prepare-release-assets -- build-artifacts release-assets
bun run validate-release -- release-assets
```

The active shell is declared in [`contracts/app-shell-adapter.json`](contracts/app-shell-adapter.json):

- active shell: `aionui`
- shell root: `shells/aionui`
- runtime bridge contract: `contracts/app-runtime-bridge.json`
- upstream family: `AionUI`
- shell source: `gaofeng21cn/opl-aion-shell`
- shell history policy: external checkout, not merged into App default branch

An experimental shell can be selected without changing the default release adapter:

```bash
OPL_APP_SHELL_ADAPTER_CONTRACT=contracts/shell-adapters/agui-codex.json npm run package
```

Candidate package validation requires the manifest to declare `candidate_app_bundle_ready`, `explicit_candidate_app_bundle`, and a relative `.app` bundle path with `Contents/Info.plist` plus a `Contents/MacOS` executable. Text-only smoke artifacts are not accepted as candidate App packages.

The App product profile is declared in [`contracts/app-product-profile.json`](contracts/app-product-profile.json) and generated into the active shell path declared by [`contracts/app-shell-adapter.json`](contracts/app-shell-adapter.json) during release preparation.

See [`docs/status.md`](docs/status.md) for the current migration and release state.

</details>

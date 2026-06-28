<p align="center">
  <img src="assets/branding/opl-banner.png" alt="One Person Lab App banner" width="100%" />
</p>

<p align="center">
  <a href="./README.md"><strong>English</strong></a> | <a href="./README.zh-CN.md">中文</a>
</p>

<h1 align="center">One Person Lab App</h1>

<p align="center"><strong>A chat-first desktop AI app for complex knowledge work</strong></p>
<p align="center">Start research, grants, presentations, books, and general tasks from one app; track progress, resume long-running work, and inspect deliverables.</p>

<!--
Owner: `one-person-lab-app`
Purpose: `public_app_entry`
State: `active_public_entry`
Machine boundary: Human-readable product overview. Machine truth lives in `contracts/`, source, release artifacts, updater metadata, validation outputs, and OPL Framework/domain projections consumed by the App.
-->

<p align="center">
  <img src="assets/branding/opl-app-product-map.png" alt="One Person Lab App product packaging map" width="100%" />
</p>

## Why It Exists

AI is already strong at answering questions and generating content. The harder part begins when the work becomes a paper, a grant proposal, a presentation package, or a long-running project. Users need to know:

- Where do I start, and what should happen next?
- How far did the previous task get?
- Which files were produced, and what still needs review?
- Is the background work still running, and where did it stop if it failed?
- Can research, grant, presentation, and book-writing agents live behind one clear entry point?

**One Person Lab App is that entry point.** It packages One Person Lab, professional agents, and companion tools into a desktop app for complex knowledge work.

It does not reduce research, grants, presentations, and books to a row of buttons. It brings start, resume, progress, files, and blockers into one product experience. Users do not need to know which professional agent is working behind the scenes; they need to see where the task stands, what was produced, what is missing, and how to continue.

## Core Highlights

**One entry point for professional AI work**<br/>
Enter general work, medical research, grant writing, presentation preparation, and book writing from the desktop app instead of jumping across commands, repositories, and tools.

**Visible progress for long tasks**<br/>
The app shows task progress, files, runtime status, and recoverable work context. When you come back, you can see what happened, what was produced, and whether anything needs human attention.

**First install feels like a product**<br/>
New macOS users can start with the complete first-install package, open the App first, and let background maintenance prepare the framework, professional agents, skills, and tool payloads.

**Professional agents with clear roles**<br/>
Research Foundry, Grant Foundry, Presentation Foundry, and Book Foundry focus on different deliverables. Users get one interface while each agent keeps its own professional boundary.

**Professional AI keeps professional room**<br/>
The App makes entries, progress, files, and delivery usable. Medical research, grant writing, visual-delivery, and book-writing judgment remain with the corresponding professional agents. When work enters a professional stage, users can watch AI read material, compare options, accept review, keep revising, and produce the next deliverable version.

**Built for daily use and long-running work**<br/>
The app is not just for one chat. It supports work that needs multiple rounds, background maintenance, recovery after failure, and continuing delivery.

## Download And Install

### Homebrew

For macOS arm64 users who already use Homebrew, this is the shortest terminal
path:

```bash
brew install --cask gaofeng21cn/one-person-lab/one-person-lab
open -a "One Person Lab"
```

Nightly builds are opt-in:

```bash
brew install --cask gaofeng21cn/one-person-lab/one-person-lab-nightly
```

For the complete first-install payload:

```bash
brew install --cask gaofeng21cn/one-person-lab/one-person-lab-full
open -a "One Person Lab"
```

Update with the standard Homebrew flow:

```bash
brew update
brew upgrade --cask one-person-lab
```

Homebrew is an App cask distribution path. After installation, open
`One Person Lab.app`; first launch uses the shared App setup flow, then the App
continues any required maintenance in the background. If the App reports that
setup or repair is needed, follow the in-app prompt. Terminal diagnostics remain
available when needed:

```bash
opl system initialize --json
```

Use `one-person-lab-full` when you want the complete first-install package
through Homebrew. Release-channel, updater, Full package, and macOS trust
details are maintained in the
[App release guide](docs/release/README.md) and App contracts.

### One-Shot Installer

macOS users can also use the one-shot installer. It prepares the One Person Lab
runtime environment and installs or opens the desktop App:

```bash
curl -fsSL https://raw.githubusercontent.com/gaofeng21cn/one-person-lab-app/main/install.sh | bash
```

The installer uses the same App-first setup model: a clean Mac can open the App
before Git-backed maintenance finishes. Use `--complete` when you explicitly
want the full framework/module install from the terminal.

Stable macOS users who do not want Homebrew can use the stable install helper:

```bash
curl -fsSL https://raw.githubusercontent.com/gaofeng21cn/one-person-lab-app/main/install.sh | bash -s -- --stable-macos-install --yes
```

Mac-specific trust diagnostics and internal-build handling stay in the release
guide rather than this public entry.

### Direct Download

You can also download the current desktop package from the App repository releases:

[Download One Person Lab App](https://github.com/gaofeng21cn/one-person-lab-app/releases/latest)

For a first-time macOS arm64 install without Homebrew, choose
`One-Person-Lab-Full-<version>-mac-arm64.dmg`. The same complete first-install
package is also available as the `one-person-lab-full` Homebrew cask.

For a screenshot-based first-run walkthrough, start from the
[macOS App install user guide](docs/user-guides/site/index.html). The same
guide source also generates the shareable
[PDF](docs/user-guides/macos-app-install-slides.pdf) and
[PPTX](docs/user-guides/macos-app-install-slides.pptx), plus a
[detailed PDF](docs/user-guides/macos-app-install-detailed-guide.pdf).

Daily updates are handled by Homebrew or the in-app update channel, depending on
how the App was installed. Release asset, updater metadata, and Full
first-install boundaries are governed by the App release guide and contracts.

For Docker or server deployment, use the App-owned `one-person-lab-webui` GHCR
image. It is separate from the desktop App GUI shell, which is bundled into the
App package from the active AionUI shell, and it is not an OPL Packages module.
See the [Docker/WebUI install guide](https://github.com/gaofeng21cn/one-person-lab/blob/main/docs/references/current-support/opl-docker-webui-deployment.md).

## What The App Does

One Person Lab App is the daily chat-first desktop entry point for users:

- Enter general work, medical research, grant writing, presentation preparation, and book writing from one desktop interface.
- Enter Research Foundry, Grant Foundry, Presentation Foundry, and Book Foundry.
- View progress, files, runtime status, and recoverable work context for continuing long tasks and inspecting deliverables.
- Complete the minimum first-run setup before the user starts, then let fuller runtime and professional-agent payloads continue as background maintenance.
- Offer Homebrew, direct download, and complete first-install package paths.
- Present One Person Lab and domain agents as a usable product experience.

## User Path

1. Download the App package from Releases.
2. Open `One Person Lab.app`.
3. Let first launch complete the basic setup; the app shows preparation progress and the next step.
4. Choose a workspace directory.
5. Start general work or enter Research, Grant, Presentation, or Book Foundry.
6. Use progress, files, and runtime status views to continue work and inspect deliverables.

## Product Boundaries

One Person Lab App owns the desktop product experience: packaging, releases, updates, first-run setup, GUI state, screenshots, and user documentation. It proves whether a user can install, open, start work, see progress, and inspect files. Medical research, grant writing, visual-delivery quality, and book-writing quality remain with the corresponding professional agents and human decisions.

The App decides what users see during install, first launch, task entry, and settings. One Person Lab Framework provides the runtime, initialization, and progress data behind those views, while MAS, MAG, RCA, and BookForge keep their professional judgment and deliverables. The App turns those capabilities into a desktop product experience without replacing professional-agent judgment.

OPL BookForge is admitted into the App-owned default Home and Codex-visible skill surface through product contracts and active-shell validation. That default visibility supports the user entry point; it does not authorize production-ready book-writing, publication approval, owner acceptance, or hosted runtime parity claims.

GUI product truth is App-owned as well. The current GUI mainline is the OPL-branded AionUI shell. Hermes Desktop is the only foreground alternative candidate. `agui-codex`, PilotDeck, and similar references are archived technical verification or inspiration material; they are not routine implementation, validation, or polish lanes. The user-facing interface, default behavior, and release experience are governed by this App repository's product docs, contracts, and validation.

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

`shells/aionui/` is intentionally not tracked by this repository. It is checked out from `gaofeng21cn/opl-aion-shell` for builds and validation, keeping AionUI history and contributors outside the clean App product repository. Hermes Desktop follows the same external-checkout rule as the only foreground alternative candidate. `shells/agui-codex/` remains an archived technical-proof link to `gaofeng21cn/opl-agui-codex-shell` and is selected only when AGUI replay is explicitly requested.

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

The Hermes Desktop alternative can be selected without changing the default release adapter:

```bash
OPL_APP_SHELL_ADAPTER_CONTRACT=contracts/shell-adapters/hermes-codex.json npm run package
```

The archived AGUI technical proof remains replayable only when explicitly requested; it is not part of the normal GUI development path:

```bash
OPL_APP_SHELL_ADAPTER_CONTRACT=contracts/shell-adapters/agui-codex.json npm run package
```

Explicit replay package validation requires the manifest to declare `candidate_app_bundle_ready`, `explicit_candidate_app_bundle`, and a relative `.app` bundle path with `Contents/Info.plist` plus a `Contents/MacOS` executable. Text-only smoke artifacts are not accepted as replayable App packages.

See [`docs/status.md`](docs/status.md) for the current migration and release state.

### Product And Installation Contracts

App-owned product defaults are declared in
[`contracts/app-product-profile.json`](contracts/app-product-profile.json).
Installation and Codex-visible exposure policy is declared in
[`contracts/app-install-exposure-policy.json`](contracts/app-install-exposure-policy.json),
runtime bridge policy is declared in
[`contracts/app-runtime-bridge.json`](contracts/app-runtime-bridge.json), and
release-channel policy is declared in
[`contracts/app-release-channel.json`](contracts/app-release-channel.json).
Those contracts own user-facing install surfaces, standard versus Full package
boundaries, updater visibility, Homebrew cask policy, Runtime page bridge
behavior, App-managed skill/plugin exposure, and release validation gates.

The OPL Framework still produces install/sync/read-model surfaces, runtime
state, and action execution. MAS/MAG/RCA/BookForge/OMA keep domain skill semantics,
quality/export/publication judgment, artifact authority, and owner receipts. Release scripts
sync App-owned product contracts into the active shell before packaging so the
shell consumes App truth instead of defining it.

For current release operations, Full package policy, macOS trust diagnostics,
updater metadata, and evidence gates, read the
[App release guide](docs/release/README.md). For current App product state and
remaining gaps, read [`docs/status.md`](docs/status.md) and
[`docs/active/app-ideal-state-gap-plan.md`](docs/active/app-ideal-state-gap-plan.md).

The GUI definition stack starts with the shell-independent ideal interaction spec in [`docs/app-ideal-gui-interaction-spec.md`](docs/app-ideal-gui-interaction-spec.md), then the Codex-to-OPL product delta in [`docs/codex-to-opl-app-delta.md`](docs/codex-to-opl-app-delta.md), then the cross-shell capability inventory in [`docs/app-gui-feature-inventory.md`](docs/app-gui-feature-inventory.md). Use them in that order when designing or reviewing a GUI shell.

### Agent / Framework Boundary

- The App displays next steps, blockers, files, and status from OPL route and progress projections, but those views are not MAS/MAG/RCA/BookForge domain verdicts.
- Foundry Agent work still happens inside each agent's stage attempts. The App does not prescribe which tools a professional agent must use or in what order it must think.
- Tool and skill entries are capability entries from the App's perspective. Permission, credential, write-scope, and quality-judgment boundaries remain governed by Framework and domain-agent contracts and receipts.

</details>

<p align="center">
  <img src="assets/branding/opl-banner.png" alt="One Person Lab App banner" width="100%" />
</p>

<p align="center">
  <a href="./README.md"><strong>English</strong></a> | <a href="./README.zh-CN.md">中文</a>
</p>

<h1 align="center">One Person Lab App</h1>

<p align="center"><strong>A chat-first desktop AI app for complex knowledge work</strong></p>
<p align="center">Start research, grants, presentations, and general tasks from one app; track progress, resume long-running work, and inspect deliverables.</p>

Owner: `one-person-lab-app`<br>
Purpose: `public_app_entry`<br>
State: `active_public_entry`<br>
Machine boundary: Human-readable product overview. Machine truth lives in
`contracts/`, source, release artifacts, updater metadata, validation outputs,
and OPL Framework/domain projections consumed by the App.

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

It does not reduce research, grants, and presentations to a row of buttons. It brings start, resume, progress, files, and blockers into one product experience. Users do not need to know which professional agent is working behind the scenes; they need to see where the task stands, what was produced, what is missing, and how to continue.

## Core Highlights

**One entry point for professional AI work**<br/>
Enter general work, medical research, grant writing, and presentation preparation from the desktop app instead of jumping across commands, repositories, and tools.

**Visible progress for long tasks**<br/>
The app shows task progress, files, runtime status, and recoverable work context. When you come back, you can see what happened, what was produced, and whether anything needs human attention.

**First install feels like a product**<br/>
New macOS users can start with the complete first-install package, open the App first, and let background maintenance prepare the framework, professional agents, skills, and tool payloads.

**Professional agents with clear roles**<br/>
Research Foundry, Grant Foundry, and Presentation Foundry focus on different deliverables. Users get one interface while each agent keeps its own professional boundary.

**Professional AI keeps professional room**<br/>
The App makes entries, progress, files, and delivery usable. Medical research, grant writing, and visual-delivery judgment remain with the corresponding professional agents. When work enters a professional stage, users can watch AI read material, compare options, accept review, keep revising, and produce the next deliverable version.

**Built for daily use and long-running work**<br/>
The app is not just for one chat. It supports work that needs multiple rounds, background maintenance, recovery after failure, and continuing delivery.

## Download And Install

### Homebrew

For macOS arm64 users who already use Homebrew, this is the shortest terminal
path:

```bash
brew tap gaofeng21cn/one-person-lab
brew install --cask one-person-lab
open -a "One Person Lab"
```

Nightly builds are opt-in:

```bash
brew install --cask one-person-lab-nightly
```

For the complete first-install payload:

```bash
brew install --cask one-person-lab-full
open -a "One Person Lab"
```

Update with the standard Homebrew flow:

```bash
brew update
brew upgrade --cask one-person-lab
```

Homebrew installs the standard desktop App from the same signed GitHub Release
assets as direct downloads. After installation, open `One Person Lab.app`; first
launch prepares the workspace, Foundry Agents, skills, and runtime maintenance
in the background. The normal user path is install, open the App, choose a
workspace, and start work.
The App-managed background maintenance path runs module reconciliation, Codex
plugin/skill sync, and local Temporal provider configuration without requiring a
second manual Codex plugin setup.

If the App reports that setup or repair is needed, follow the in-app prompt.
Terminal diagnostics remain available when needed:

```bash
opl system initialize --json
```

The Homebrew path intentionally targets macOS arm64 and requires Homebrew.
Use `one-person-lab-full` when you want the complete first-install payload
through Homebrew; use Releases when the Mac does not have Homebrew yet.

### One-Shot Installer

macOS users can also use the one-shot installer. It prepares the One Person Lab
runtime environment and installs or opens the desktop App:

```bash
curl -fsSL https://raw.githubusercontent.com/gaofeng21cn/one-person-lab-app/main/install.sh | bash
```

The installer defaults to an App-first setup so a clean Mac can open the App before Git-backed module maintenance finishes. Use `--complete` when you explicitly want the full framework/module install from the terminal.

The Stable macOS installer path does not require paid Apple Developer ID
signing. It downloads the latest Full DMG, copies the App into `/Applications`,
removes recursive macOS quarantine attributes, prints `codesign`/`spctl`
diagnostics, and opens the App:

```bash
curl -fsSL https://raw.githubusercontent.com/gaofeng21cn/one-person-lab-app/main/install-stable.sh | bash
```

If you already copied an unsigned developer or internal test build into
`/Applications`, run only the local authorization helper:

```bash
curl -fsSL https://raw.githubusercontent.com/gaofeng21cn/one-person-lab-app/main/install.sh \
  | bash -s -- --authorize-local-app-only \
      --app-path "/Applications/One Person Lab.app" \
      --yes
```

This is the current Stable install path. Apple Developer ID signing remains an
optional future enhancement for a smoother Gatekeeper verdict.

### Direct Download

You can also download the current desktop package from the App repository releases:

[Download One Person Lab App](https://github.com/gaofeng21cn/one-person-lab-app/releases/latest)

For a first-time macOS arm64 install without Homebrew, choose `One-Person-Lab-Full-<version>-mac-arm64.dmg`. The same complete first-install payload is also available as the `one-person-lab-full` Homebrew cask. It includes the desktop app, One Person Lab, the Research/Grant/Presentation agents, current runtime payloads, `officecli`, and recommended skill payloads.

For a screenshot-based first-run walkthrough, use the primary [macOS App install slides PDF](docs/user-guides/macos-app-install-slides.pdf). The detailed long-form companion is [macOS App install detailed PDF](docs/user-guides/macos-app-install-detailed-guide.pdf).

Daily updates are handled by Homebrew or the in-app update channel, depending on
how the App was installed. Releases also publish standard App packages, updater
metadata, and separate complete first-install assets.

For Docker or server deployment, see the [Docker/WebUI install guide](https://github.com/gaofeng21cn/one-person-lab/blob/main/docs/references/current-support/opl-docker-webui-deployment.md).

## What The App Does

One Person Lab App is the daily chat-first desktop entry point for users:

- Enter general work, medical research, grant writing, and presentation preparation from one desktop interface.
- Enter Research Foundry, Grant Foundry, and Presentation Foundry.
- View progress, files, runtime status, and recoverable work context for continuing long tasks and inspecting deliverables.
- Complete the minimum first-run setup before the user starts, then let fuller runtime and professional-agent payloads continue as background maintenance.
- Offer Homebrew, direct download, and complete first-install package paths.
- Present One Person Lab and domain agents as a usable product experience.

## User Path

1. Download the App package from Releases.
2. Open `One Person Lab.app`.
3. Let first launch complete the basic setup; the app shows preparation progress and the next step.
4. Choose a workspace directory.
5. Start general work or enter Research, Grant, or Presentation Foundry.
6. Use progress, files, and runtime status views to continue work and inspect deliverables.

## Product Boundaries

One Person Lab App owns the desktop product experience: packaging, releases, updates, first-run setup, GUI state, screenshots, and user documentation. It proves whether a user can install, open, start work, see progress, and inspect files. Medical research, grant writing, and visual-delivery quality remain with the corresponding professional agents and human decisions.

The App decides what users see during install, first launch, task entry, and settings. One Person Lab Framework provides the runtime, initialization, and progress data behind those views, while MAS, MAG, and RCA keep their professional judgment and deliverables. The App turns those capabilities into a desktop product experience without replacing professional-agent judgment.

GUI product truth is App-owned as well. AionUI, `agui-codex`, PilotDeck, and similar references are implementation or inspiration material; the user-facing interface, default behavior, and release experience are governed by this App repository's product docs, contracts, and validation.

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

See [`docs/status.md`](docs/status.md) for the current migration and release state.

### Product And Installation Contracts

App-owned product defaults are declared in [`contracts/app-product-profile.json`](contracts/app-product-profile.json). Installation and Codex-visible exposure policy is declared in [`contracts/app-install-exposure-policy.json`](contracts/app-install-exposure-policy.json): the App decides the user-facing install surfaces and default visible entries, while OPL Framework produces the install/sync/read-model surfaces and domain repos keep skill semantics. The same contract owns the Homebrew App cask boundary and the `agent_installation_contract`, which keeps MAS/MAG/RCA plugin registry entries, the OMA OPL-generated local Codex plugin surface, App/CLI-managed agent-pack maintenance, optional live `~/.codex/skills` duplicate-mirror checks, and duplicate bare-skill prevention behind `npm run validate:agent-installation`.

Release scripts sync App-owned contracts into the active shell before standard and Full packaging so Codex defaults, visible companion skills, first-run maintenance behavior, and user-facing Settings labels are configured by the App repository instead of being scattered through the AionUI fork.

The runtime bridge is declared in [`contracts/app-runtime-bridge.json`](contracts/app-runtime-bridge.json): OPL owns the runtime/app CLI protocol, the App owns the GUI bridge contract, and `opl-aion-shell` is the current replaceable adapter implementation. Runtime pages consume `opl app state --profile fast --json` as the summary and refresh source, keep `opl app state --profile full --json` for explicit full-state diagnostic or release evidence, and lazy-load full Framework drilldown only on demand.

First launch reaches `ready_to_launch` before `/guid` from the Core checks: workspace root, Codex CLI, and Codex config. Domain modules, the family runtime provider, recommended skills, native helpers, repo sync, CLT, and ecosystem updates remain Full readiness or background maintenance. First-launch UI state comes from the shared `opl system initialize --json` model rather than installer-specific progress state.

The App warms the ACP conversation before sending the first `/guid` message so slow first-run dependency unpacking becomes a retryable setup state instead of a lost prompt.

Foundry Agents are exposed through one public semantic path: the domain skill is the ABI. Codex App may receive MAS/MAG/RCA through plugin-packaged skills, while CLI and direct Codex use the same skill/action/stage metadata. Plugin packaging must not create a second semantic map or duplicate bare `~/.codex/skills/{mas,mag,rca}` mirrors. Homebrew remains the App cask install/update path; MAS/MAG/RCA/OMA agent packs are prepared by App/CLI maintenance after the App is installed.

Independent agent installation and Codex plugin registration are validated through one machine gate: `npm run validate:agent-installation`. External installers and user-provided agents can pass `-- --agent-root mas=<path> --agent-root mag=<path> --agent-root rca=<path>` to verify real `.codex-plugin/plugin.json` plus `skills/<id>/SKILL.md` layouts, and `-- --codex-skills-root <path>` to fail closed when MAS/MAG/RCA are mirrored as duplicate bare skills.

The GUI definition stack starts with the shell-independent ideal interaction spec in [`docs/app-ideal-gui-interaction-spec.md`](docs/app-ideal-gui-interaction-spec.md), then the Codex-to-OPL product delta in [`docs/codex-to-opl-app-delta.md`](docs/codex-to-opl-app-delta.md), then the cross-shell capability inventory in [`docs/app-gui-feature-inventory.md`](docs/app-gui-feature-inventory.md). Use them in that order when designing or reviewing a GUI shell.

### Agent / Framework Boundary

- The App displays next steps, blockers, files, and status from OPL route and progress projections, but those views are not MAS/MAG/RCA domain verdicts.
- Foundry Agent work still happens inside each agent's stage attempts. The App does not prescribe which tools a professional agent must use or in what order it must think.
- Tool and skill entries are capability entries from the App's perspective. Permission, credential, write-scope, and quality-judgment boundaries remain governed by Framework and domain-agent contracts and receipts.

</details>

# OPL App GUI Feature Inventory

Owner: `one-person-lab-app`
Purpose: product-level GUI feature inventory
State: `active`
Machine boundary: Human-readable feature inventory. Machine-readable GUI truth
lives in App-owned contracts, page-state matrices, adapter contracts, and
release evidence.

This document lists the target GUI capabilities of One Person Lab App independent
of the current shell implementation. It is not an AionUI modification list.
AionUI and future shells implement this inventory through App-owned contracts,
page-state matrices, and release validation.

## Product Shape

The ideal OPL App GUI is a Codex App-shaped desktop workbench:

- Start a conversation from a selected workspace directory.
- Keep Codex CLI as the fixed executor and show model status as automatic.
- Route home entries to OPL capabilities: Research/MAS, Grant/MAG, and
  Presentation/RCA.
- Preserve a chat-first first screen with no dashboard or explanatory landing
  page copy.
- Provide a persistent workspace frame with navigation rail, conversation area,
  and a collapsible right-side panel.
- Keep backend, model, and permission choices out of ordinary home and
  conversation flow.

This inventory describes the total App target, not a list of changes to the
current AionUI shell. A conforming shell should feel like a Codex App workbench
for OPL work: workspace-first, chat-first, executor-first, and able to expose
runtime status, purpose routing, receipts, and packaged App settings from the
same frame.

## Core Conversation Features

- Create a new conversation.
- Select or change the workspace directory before sending.
- Send a text instruction to Codex.
- Attach files or folders when the shell supports native file picking.
- Show streaming or pending assistant state while Codex is running.
- Keep assistant replies in a readable chat thread.
- Allow purpose routing to be changed without leaving the conversation.
- Preserve the selected purpose route as a compact `@` tag.
- Keep conversation history available from the navigation rail.
- Allow a pop-out or collapsible right-side Copilot panel for secondary context.
- Show safe tool, process, diff, and file/context events when the backend emits
  them, without turning protocol details into user-facing navigation.
- Keep user-input prompts and permission confirmations in the conversation
  workbench when Codex requires a decision.
- Keep logs, raw protocol frames, and adapter diagnostics in technical or
  developer surfaces rather than ordinary chat UI.

## OPL Capability Entries

- `科研` routes to MAS.
- `基金` routes to MAG.
- `PPT` routes to RCA.
- OMA remains explicit or settings-only until a product decision makes it
  default visible.
- Assistant-scoped skills are shown from App-owned packaged skill profiles, not
  from shell-local discovery.

## Runtime And Settings Features

- Read ordinary page state from `opl app state --profile fast --json`.
- Refresh ordinary page state from the same fast profile.
- Keep full state and Operator full drilldown on explicit diagnostic/release
  paths.
- Show runtime status summary before detailed drilldown.
- Show module and path refs as refs only, without taking runtime or domain
  authority.
- Provide Settings sections for System, Runtime, Capabilities, Access,
  Appearance, About, and Update.
- Keep update state and release channel labels localized.

## First-Run Features

- Gate launch readiness on Core items: workspace root, Codex CLI, and Codex
  config.
- Show first-run phase, Core progress, Full readiness progress, background
  maintenance counts, blockers, and next visible step from
  `opl system initialize --json`.
- Allow the user to reach the main guide once Core readiness is complete.
- Keep Full readiness and background maintenance non-blocking unless the
  App-owned contract says otherwise.

## Shell Requirements

Any shell candidate must implement this inventory without becoming product
authority:

- Consume generated App product profile from the adapter contract.
- Use App-owned state/action command surfaces.
- Compile through the App wrapper into a launchable `.app`.
- Pass App-owned page-state and first-run matrices before adoption.
- Remain selectable only through an explicit candidate adapter until adopted.
- Prove both source and packaged UI smoke with visible pixels when changing the
  primary workbench surface.

## AG-UI/CopilotKit Candidate Projection

The AG-UI/CopilotKit candidate should use:

- CopilotKit React v2 as the user-visible UI/runtime layer for chat, popup,
  sidebar, and agent runtime binding.
- AG-UI events as the internal event/protocol layer between the renderer runtime
  and Codex or ACP adapters.
- Codex app-server as the primary Codex backend behind the protocol boundary.
- `codex-acp` only as an ACP interoperability lane when testing external ACP
  clients or non-Codex agents.
- CopilotKit examples as UI integration reference, especially the v2 React
  Router and React demo examples.
- AG-UI Dojo as protocol capability and debugging reference, not as a desktop
  shell to copy wholesale.
- `namanrajpal/acp-to-agui` as the closest public ACP-to-AG-UI reference,
  because it bridges ACP agent streams to AG-UI and includes a CopilotKit demo.
- `agentclientprotocol/agent-client-protocol` as the ACP wire contract and
  capability negotiation reference.
- Zed `codex-acp`, AionUi ACP setup, `formulahendry/acp-ui`, Harnss,
  OpenClaw `acpx`, Datalayer Agent Runtimes, `beyond5959/acp-adapter`,
  `cola-io/codex-acp`, and `0xcaff/codex-web` as compatibility and
  implementation references, not as the primary OPL Codex path.

The 2026-05-29 research conclusion is that there is no mature public project
that can be used as a complete Codex ACP adapter to AG-UI/CopilotKit desktop
shell. The reusable parts are separate: Codex app-server for the native Codex
GUI protocol, codex-acp style adapters for ACP compatibility, and AG-UI plus
CopilotKit for the visible event/UI layer. OPL therefore keeps a normalized
adapter contract between Codex or ACP session events and AG-UI events.

AG-UI is not a user-visible product concept for the ordinary App path. Users
should see the OPL workbench, purpose entries, conversation state, receipts, and
runtime status. Protocol names, event frames, and debug dashboards belong only
in diagnostics or developer verification material.

The current candidate proof path is:

- Electron thin shell loads the generated App product profile.
- The renderer uses CopilotKit React v2 chat primitives and a compact OPL frame
  derived from the public chat-agent demo shape, not a dashboard or explanatory
  landing page.
- The main process owns Codex app-server JSON-RPC over stdio.
- Codex `thread/start`, `turn/start`, and `item/agentMessage/delta` events are
  mapped to AG-UI run/text/step events.
- The workspace selector opens a native directory picker, and changing the
  directory starts subsequent Codex turns from a fresh app-server thread in that
  workspace.
- The new-conversation action resets the current Codex thread while preserving
  the selected workspace.
- Candidate packaging must produce a launchable `.app` and pass source plus
  packaged UI smoke against the real Codex backend.
- Candidate UI smoke must include a pixel-visible paint check, so a DOM-only
  pass cannot mask a visually blank window.
- Candidate UI smoke must keep AG-UI as an internal event boundary and reject
  user-visible AG-UI/debug dashboard copy on the ordinary chat surface.

## AG-UI/CopilotKit Candidate Verification

The candidate is selected only by an explicit adapter contract:

```bash
OPL_APP_SHELL_ADAPTER_CONTRACT=contracts/shell-adapters/agui-codex.json
```

App-root verification and packaging commands:

```bash
node --experimental-strip-types scripts/validate-active-shell.ts --quick
npm run validate:shell-candidates
OPL_APP_SHELL_ADAPTER_CONTRACT=contracts/shell-adapters/agui-codex.json node --experimental-strip-types scripts/validate-active-shell.ts --quick
OPL_APP_SHELL_ADAPTER_CONTRACT=contracts/shell-adapters/agui-codex.json npm run package
```

Candidate-shell verification commands:

```bash
cd shells/agui-codex
npm install
npm run validate:candidate
npm run build:renderer
npx electron . --ui-smoke-test
'./out/One Person Lab AG-UI Codex Candidate.app/Contents/MacOS/One Person Lab AG-UI Codex Candidate' --ui-smoke-test
```

Minimum acceptance for this candidate is:

- App-root active-shell validation still resolves the default release shell as
  AionUI.
- Candidate registry validation passes and confirms explicit candidate build
  participation only.
- The generated product profile is App-owned and contains the Codex fixed
  executor, MAS/MAG/RCA purpose entries, and hidden ordinary selectors.
- Source renderer build succeeds.
- Source UI smoke paints visible pixels, shows the purpose entries, starts a
  real Codex app-server turn, and receives `OK`.
- Candidate packaging produces a launchable `.app` with `Contents/Info.plist`
  and a `Contents/MacOS` executable.
- Packaged UI smoke passes against the `.app` bundle and keeps AG-UI/debug
  protocol copy out of the ordinary chat surface.
- Page-state, first-run, runtime, and release replacement gates remain open
  until App-owned matrices and release evidence promote the candidate.

2026-05-29 technical verification evidence:

- Source renderer build passed in `/Users/gaofeng/workspace/opl-agui-codex-shell`.
- Source UI smoke passed with screenshot
  `/tmp/opl-agui-codex-ui-smoke-final.png`, purpose entries `科研`, `基金`,
  `PPT`, pixel-visible paint ratio `0.09426579354378173`, and Codex reply
  `OK`.
- Candidate `.app` bundle built at
  `/Users/gaofeng/workspace/opl-agui-codex-shell/out/One Person Lab AG-UI Codex Candidate.app`.
- Packaged UI smoke passed with screenshot
  `/tmp/opl-agui-codex-packaged-ui-smoke.png`, `packaged=true`,
  pixel-visible paint ratio `0.08607183930837563`, and Codex reply `OK`.

The current default release shell remains AionUI until this candidate satisfies
the shell replacement gate in `contracts/app-shell-candidates.json`.

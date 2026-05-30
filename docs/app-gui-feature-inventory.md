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

The ideal OPL App GUI is a Codex App-shaped chat-first desktop surface:

- Start a conversation from a selected workspace directory.
- Keep Codex CLI as the fixed executor and show model status as automatic.
- Route home entries to OPL capabilities: Research/MAS, Grant/MAG, and
  Presentation/RCA.
- Preserve a chat-first first screen with no dashboard or explanatory landing
  page copy.
- Provide a persistent workspace frame with a lightweight workspace/session
  rail, conversation area, and a collapsible right-side context panel.
- Keep backend, model, and permission choices out of ordinary home and
  conversation flow.

This inventory describes the total App target, not a list of changes to the
current AionUI shell. A conforming shell should feel like Codex App specialized
for OPL work: workspace-aware, chat-first, executor-first, and able to expose
runtime status, purpose routing, receipts, and packaged App settings without
turning the first screen into a dashboard.

## Codex App Target Feature Set

The App target is the Codex App experience specialized for OPL work, not a
generic agent dashboard. The total feature set is:

- Open the App on a selected workspace directory and keep that workspace visible
  in the frame.
- Start a new conversation, resume recent conversations, and keep thread/session
  history in the workspace rail.
- Keep the main surface as a working chat canvas with a pinned composer, compact
  route tag, file/context controls, and visible run state.
- Bind ordinary turns to Codex app-server/Codex CLI as the fixed executor.
- Stream assistant text, tool/process progress, user-input prompts, and receipts
  into user-safe conversation surfaces.
- Show file and artifact refs for the selected workspace/conversation without
  taking ownership of artifact bodies.
- Surface diffs, command/process output, review refs, and runtime receipts near
  the conversation when the backend emits them.
- Provide a collapsible right-side panel for secondary context, runtime
  inspection, and App-owned settings, with the chat canvas remaining primary.
- Offer right-side contextual inspector tabs for Files, Skills/Capabilities,
  Routing/runtime refs, Memory refs, Always-On/Automations, and Settings without
  competing with the main chat canvas.
- Keep MAS/MAG/RCA as built-in purpose entries over Codex, represented as
  compact tags and route receipts rather than separate backend choices.
- Keep backend, model, provider, and permission mode selectors out of ordinary
  home and conversation flows.
- Use the same App product truth for desktop Electron and WebUI surfaces.

The WebUI target shares the same React/CopilotKit renderer as the Electron
candidate. Electron uses native preload/IPC for `window.oplCandidate`; browser
mode uses a local Web transport bridge that exposes the same App-owned API shape
through HTTP actions and SSE Codex events. This makes WebUI a delivery surface
for the same chat-first surface, not a second product with separate state or
authority.

## PilotDeck-Informed Information Organization

PilotDeck is useful as an interaction and visual reference for information
organization, not as source code, runtime authority, or a first-screen
workbench template. The 2026-05-30 review used
`OpenBMB/PilotDeck@33394d1069c3528052c3f12eb1d905060b34cc2f` and its public demo.
PilotDeck is AGPL-3.0, while this App repo is Apache-2.0, so OPL must not copy
or vendor PilotDeck code without an explicit license decision. The reusable
lesson is information organization:

- A lightweight left rail groups work by workspace or project, then by
  conversation, without becoming the primary UI.
- The main pane stays chat-first and keeps a composer pinned at the bottom, so
  the first screen is a working surface rather than a dashboard or landing page.
- Compact grouped tabs expose adjacent context without forcing the user to leave
  the selected chat: Agent, Files, Skills, Routing, Memory, and Always-On in
  PilotDeck; OPL should map these to right-side collapsible inspector tabs for
  conversation context, Files, Capabilities, Runtime/cost refs, Memory refs,
  Automations, and Settings.
- File browsing, process traces, routing/cost readouts, memory inspection, and
  long-running work views are contextual surfaces behind or beside the chat, not
  first-screen panels that compete with the conversation.
- The composer uses compact controls for mode, attachments, mentions, context
  usage, and send state. OPL should keep the same density but replace mode and
  permission controls with App-owned MAS/MAG/RCA purpose tags, file attachment,
  refs, and Codex status.

The OPL adaptation is deliberately narrower than PilotDeck. OPL keeps Codex
app-server as the primary backend, App-owned purpose routing as the ordinary
path, and OPL Framework/domain projections as the source of runtime, memory,
action, and artifact refs. PilotDeck's gateway, agent runtime, memory store,
router, always-on store, provider model list, and WorkSpace state model remain
implementation material to study, not App authority.

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
- Keep user-input prompts and permission confirmations in the conversation when
  Codex requires a decision.
- Keep logs, raw protocol frames, and adapter diagnostics in technical or
  developer surfaces rather than ordinary chat UI.
- Keep the composer dense and work-focused: purpose tag, file attach, mention or
  ref insertion, context status, and send/stop state should fit without turning
  the composer into a backend settings panel.

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
- Present runtime, memory, automations, files, and capabilities as collapsible
  contextual tabs or inspector surfaces scoped to the selected
  workspace/conversation.
- Surface long-running work as plans, runs, receipts, deliverable refs, and
  operator actions; do not represent it as an unmanaged background daemon.
- Show cost/routing/model details as technical or connected-state readouts, not
  as a normal model picker on the home or ordinary conversation path.

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
- When claiming WebUI support, use the same renderer and App-owned bridge shape
  as the Electron shell, with Web transport evidence and WebUI smoke.
- Pass App-owned page-state and first-run matrices before adoption.
- Remain selectable only through an explicit candidate adapter until adopted.
- Prove both source and packaged UI smoke with visible pixels when changing the
  primary chat surface.

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
- OpenBMB PilotDeck as an information-organization reference for a polished
  lightweight workspace/session rail, chat-first main pane, and grouped Files,
  Skills, Routing, Memory, and Always-On context. PilotDeck's AGPL code and
  runtime must not be copied into the App repo; OPL should re-express the useful
  organization pattern through App-owned contracts and the selected shell.

The 2026-05-29 research conclusion is that there is no mature public project
that can be used as a complete Codex ACP adapter to AG-UI/CopilotKit desktop
shell. The reusable parts are separate: Codex app-server for the native Codex
GUI protocol, codex-acp style adapters for ACP compatibility, and AG-UI plus
CopilotKit for the visible event/UI layer. OPL therefore keeps a normalized
adapter contract between Codex or ACP session events and AG-UI events.

AG-UI is not a user-visible product concept for the ordinary App path. Users
should see the OPL chat surface, purpose entries, conversation state, receipts, and
runtime status. Protocol names, event frames, and debug dashboards belong only
in diagnostics or developer verification material.

The current candidate proof path is:

- Electron thin shell loads the generated App product profile.
- The renderer uses CopilotKit React v2 chat primitives and a compact OPL frame
  derived from the public chat-agent demo shape, not a dashboard or explanatory
  landing page.
- The same renderer must be usable as WebUI through a browser bridge that creates
  `window.oplCandidate` only when Electron preload is absent.
- The main process owns Codex app-server JSON-RPC over stdio.
- The WebUI gateway owns local HTTP action routes and an SSE Codex event stream
  while still consuming App-owned `opl app state/action` and Codex app-server
  surfaces.
- Codex `thread/start`, `turn/start`, and `item/agentMessage/delta` events are
  mapped to AG-UI run/text/step events.
- The workspace selector opens a native directory picker, and changing the
  directory starts subsequent Codex turns from a fresh app-server thread in that
  workspace.
- The new-conversation action resets the current Codex thread while preserving
  the selected workspace.
- The ordinary UI stays chat-first, with a lightweight workspace/session rail and
  right-side collapsible Files/Skills/Routing/Memory/Always-On inspector tabs
  inspired by PilotDeck's information organization.
- Candidate packaging must produce a launchable `.app` and pass source plus
  packaged UI smoke against the real Codex backend.
- Candidate WebUI smoke must prove the shared renderer, browser transport
  bridge, HTTP action routes, and SSE event stream.
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
npm run validate:adapter-events
npm run validate:candidate
npm run build:renderer
npm run smoke:webui
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
- WebUI smoke passes using the same renderer, browser `window.oplCandidate`
  bridge, HTTP action routes, and SSE Codex event stream.
- Source UI smoke paints visible pixels on the default chat-first home, shows
  the purpose entries, starts a real Codex app-server turn, receives `OK`, and
  proves the workspace/session rail plus inspector are collapsed by default.
- The UI exposes a lightweight workspace/session rail and right-side collapsible
  Files, Skills, Routing, Memory, and Always-On inspector tabs as optional
  context surfaces without adopting PilotDeck runtime authority or making them
  first-screen panels.
- Candidate packaging produces a launchable `.app` with `Contents/Info.plist`
  and a `Contents/MacOS` executable.
- Packaged UI smoke passes against the `.app` bundle, keeps AG-UI/debug
  protocol copy out of the ordinary chat surface, and proves the same
  default-collapsed chat-first home.
- Page-state, first-run, runtime summary/full-drilldown, and safe App action
  dry-run evidence are recorded by the candidate smoke and checked by
  App-root candidate validation.
- Release replacement remains explicit: the candidate does not become the
  default stable/nightly shell until `contracts/app-shell-adapter.json` is
  deliberately changed.

2026-05-30 chat-first technical verification evidence:

- Source renderer build passed in `/Users/gaofeng/workspace/opl-agui-codex-shell`.
- Source UI smoke passed with screenshot
  `/tmp/opl-agui-codex-source-ui-smoke-chat-first-final.png`, purpose entries
  `科研`, `基金`, `PPT`, `default_home_layout_status=passed`, stage classes
  `without-rail` and `without-inspector`, visible paint, and Codex reply `OK`.
- Candidate `.app` bundle built at
  `/Users/gaofeng/workspace/opl-agui-codex-shell/out/One Person Lab AG-UI Codex Candidate.app`.
- Packaged UI smoke passed with screenshot
  `/tmp/opl-agui-codex-packaged-ui-smoke-chat-first-final.png`,
  `packaged=true`, `default_home_layout_status=passed`, visible paint, and
  Codex reply `OK`.
- WebUI uses the same renderer and passed smoke; browser visual inspection
  captured `/tmp/opl-agui-codex-webui-chat-first-final.png` with the ordinary
  home on the chat canvas and both side context surfaces collapsed.
- The final manifest records `source_ui_smoke_status=passed`,
  `packaged_ui_smoke_status=passed`, `webui_smoke_status=passed`,
  `default_home_layout_status=passed`, `page_state_matrix_mapping_status=passed`,
  `first_run_matrix_mapping_status=passed`,
  `runtime_summary_detail_action_bridge_status=passed`, and
  `action_dry_run_status=passed`.

The current default release shell remains AionUI until this candidate satisfies
the shell replacement gate in `contracts/app-shell-candidates.json`.

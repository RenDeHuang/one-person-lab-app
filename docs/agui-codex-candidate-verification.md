# AG-UI/CopilotKit Codex Candidate Verification

Owner: `one-person-lab-app`
Purpose: candidate shell verification runbook
State: `active_experimental`
Machine boundary: Human-readable verification guide. Machine-readable candidate
policy lives in `contracts/app-shell-candidates.json` and
`contracts/shell-adapters/agui-codex.json`.

## Boundary

`agui-codex` is an experimental shell candidate for a Codex App-like OPL
chat-first desktop/WebUI surface. It is not the default release shell and it is
not an AionUI patch list.

The default stable/nightly release path continues to use
`contracts/app-shell-adapter.json`, where `active_shell` remains `aionui`.
The candidate is selected only when the App wrapper is run with:

```bash
OPL_APP_SHELL_ADAPTER_CONTRACT=contracts/shell-adapters/agui-codex.json
```

App product truth, GUI requirements, page-state expectations, first-run policy,
release gates, and generated product profile content remain owned by this App
repo. The linked candidate shell may own only shell-local implementation,
candidate packaging, and candidate-specific smoke validation.

## Layering

The user-visible product target is a Codex App-like OPL chat surface:

- workspace directory selection;
- lightweight workspace/session rail for current work and recent conversations;
- new conversation and thread reset;
- Codex fixed executor with automatic model status;
- MAS/MAG/RCA purpose entries and compact purpose tags;
- chat-first conversation surface;
- right-side collapsible Files, Skills/Capabilities, Routing/runtime refs,
  Memory refs, and Always-On/Automations inspector tabs beside the chat canvas
  or hidden behind a compact context toggle;
- secondary context panel;
- summary-first runtime/status refs;
- App-owned Settings and release/update surfaces;
- packaged `.app` verification through the App wrapper.

CopilotKit is the visible UI/runtime layer for chat, sidebar, popup, and agent
runtime binding.

AG-UI is the internal event/protocol layer between the renderer runtime and
Codex app-server or ACP compatibility adapters. Ordinary users should not see
AG-UI as a product concept, dashboard, or debug surface.

Codex app-server is the primary Codex backend. ACP and `codex-acp` remain
compatibility references for non-Codex agents or protocol harnesses.

The WebUI surface is a delivery surface for the same chat-first UI. Electron uses
preload/IPC to provide `window.oplCandidate`; browser WebUI uses a local bridge
that provides the same App-owned API shape through HTTP actions and
`/api/codex-events` SSE. WebUI must not introduce a separate product profile,
runtime truth source, provider selector, or memory/artifact authority.

PilotDeck is a reference-only information-organization input. Its workspace
rail, project/session list, chat-first main pane, Files, Skills, Routing,
Memory, and Always-On grouping inform only the OPL lightweight rail and
right-side contextual inspector layout. Its AGPL-3.0 source, gateway, runtime,
memory, router, always-on store, provider list, and WorkSpace state model remain
excluded from this App repo and from candidate runtime authority.

## App-Root Commands

Guard the default release shell:

```bash
node --experimental-strip-types scripts/validate-active-shell.ts --quick
```

Validate the candidate registry without running candidate package commands:

```bash
npm run validate:shell-candidates
```

Validate the candidate adapter by explicit selection:

```bash
OPL_APP_SHELL_ADAPTER_CONTRACT=contracts/shell-adapters/agui-codex.json node --experimental-strip-types scripts/validate-active-shell.ts --quick
```

Build the candidate `.app` through the App wrapper:

```bash
OPL_APP_SHELL_ADAPTER_CONTRACT=contracts/shell-adapters/agui-codex.json npm run package
```

Expected package output:

```text
shells/agui-codex/out/One Person Lab AG-UI Codex Candidate.app
shells/agui-codex/out/agui-codex-candidate-manifest.json
```

## Candidate-Shell Commands

Run these from `shells/agui-codex`, which is a linked external checkout of
`/Users/gaofeng/workspace/opl-agui-codex-shell` on the maintainer Mac:

```bash
npm install
npm run validate:adapter-events
npm run validate:candidate
npm run build:renderer
npm run smoke:webui
npx electron . --ui-smoke-test
'./out/One Person Lab AG-UI Codex Candidate.app/Contents/MacOS/One Person Lab AG-UI Codex Candidate' --ui-smoke-test
```

The UI smoke sends `只回复 OK` through a real Codex app-server thread and turn,
then requires a visible `OK` assistant reply.

## Minimum Acceptance

- Default App release adapter validation still resolves `aionui`.
- `npm run validate:shell-candidates` passes and reports explicit candidate
  participation only.
- Candidate adapter validation passes only when
  `OPL_APP_SHELL_ADAPTER_CONTRACT=contracts/shell-adapters/agui-codex.json` is
  set.
- The candidate consumes the App-owned generated product profile.
- Source renderer build succeeds.
- Source renderer is shared by Electron and WebUI.
- WebUI smoke passes and proves browser `window.oplCandidate`, HTTP action
  routes, and SSE Codex app-server events.
- Source UI smoke paints the ordinary home as a chat-first canvas with
  `without-rail` and `without-inspector`, shows MAS/MAG/RCA purpose entries,
  and receives `OK` from Codex app-server.
- App-wrapper packaging produces a launchable `.app` with `Contents/Info.plist`
  and a `Contents/MacOS` executable.
- Packaged UI smoke passes against the `.app` bundle and proves the same
  default-collapsed chat-first home.
- PilotDeck-informed information organization is present as OPL-owned UI:
  optional lightweight workspace/session rail, session list, context tabs, and
  right-side collapsible Files, Skills, Routing, Memory, and Always-On
  inspector surfaces that stay closed on ordinary home until explicitly opened.
- Page-state matrix mapping, first-run matrix mapping, runtime summary/full
  drilldown, and safe App action dry-run evidence are recorded in the candidate
  smoke evidence and package manifest.
- Ordinary chat UI presents the OPL chat surface and CopilotKit-backed chat
  surface, not AG-UI protocol/debug dashboard copy.
- Backend, model, and permission selectors stay hidden on the ordinary home and
  conversation paths.

## Release Promotion

The candidate can be verified end to end without changing the current release.
It becomes the default stable/nightly shell only after an intentional
`contracts/app-shell-adapter.json` promotion. Until then, release isolation from
the default AionUI path is a required invariant, not an unfinished technical
mapping gate.

## Current Evidence

2026-05-30 chat-first candidate evidence:

- App-wrapper build produced
  `/Users/gaofeng/workspace/opl-agui-codex-shell/out/One Person Lab AG-UI Codex Candidate.app`.
- Source UI smoke passed with screenshot
  `/tmp/opl-agui-codex-source-ui-smoke-chat-first-final.png`,
  `default_home_layout_status=passed`, `home_stage_class_name` containing
  `without-rail` and `without-inspector`,
  `codex_app_server_turn_status=passed`, and visible paint.
- Packaged UI smoke passed with screenshot
  `/tmp/opl-agui-codex-packaged-ui-smoke-chat-first-final.png`,
  `packaged=true`, `default_home_layout_status=passed`,
  `codex_app_server_turn_status=passed`, and visible paint.
- WebUI smoke passed and browser visual inspection captured
  `/tmp/opl-agui-codex-webui-chat-first-final.png`, proving the shared renderer
  opens on the chat canvas with workspace/session rail and inspector collapsed.
- `out/agui-codex-candidate-manifest.json` records
  `source_ui_smoke_status=passed`, `packaged_ui_smoke_status=passed`,
  `webui_smoke_status=passed`, `default_home_layout_status=passed`,
  `page_state_matrix_mapping_status=passed`,
  `first_run_matrix_mapping_status=passed`,
  `runtime_summary_detail_action_bridge_status=passed`,
  `action_dry_run_status=passed`, and `runtime_safe_action_count=20`.

The remaining promotion boundary is product adoption, not missing technical
candidate evidence. AionUI remains the default release shell until
`contracts/app-shell-adapter.json` is intentionally promoted after the normal
release gate.

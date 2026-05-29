# AG-UI/CopilotKit Codex Candidate Verification

Owner: `one-person-lab-app`
Purpose: candidate shell verification runbook
State: `active_experimental`
Machine boundary: Human-readable verification guide. Machine-readable candidate
policy lives in `contracts/app-shell-candidates.json` and
`contracts/shell-adapters/agui-codex.json`.

## Boundary

`agui-codex` is an experimental shell candidate for a Codex App-like OPL
desktop workbench. It is not the default release shell and it is not an AionUI
patch list.

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

The user-visible product target is a Codex App-like OPL workbench:

- workspace directory selection;
- new conversation and thread reset;
- Codex fixed executor with automatic model status;
- MAS/MAG/RCA purpose entries and compact purpose tags;
- chat-first conversation surface;
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
npm run validate:candidate
npm run build:renderer
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
- Source UI smoke paints visible pixels, shows MAS/MAG/RCA purpose entries, and
  receives `OK` from Codex app-server.
- App-wrapper packaging produces a launchable `.app` with `Contents/Info.plist`
  and a `Contents/MacOS` executable.
- Packaged UI smoke passes against the `.app` bundle.
- Ordinary chat UI presents the OPL workbench and CopilotKit-backed chat
  surface, not AG-UI protocol/debug dashboard copy.
- Backend, model, and permission selectors stay hidden on the ordinary home and
  conversation paths.

## Open Gates Before Adoption

The candidate remains experimental until App-owned gates prove:

- page-state matrix mapping;
- first-run matrix mapping;
- runtime summary and explicit full-drilldown mapping;
- state/action bridge behavior;
- packaged release evidence for the candidate cohort;
- release isolation from default AionUI stable/nightly packaging;
- an intentional change to `contracts/app-shell-adapter.json` when promotion is
  approved.

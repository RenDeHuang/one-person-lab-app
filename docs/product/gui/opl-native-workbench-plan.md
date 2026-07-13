# OPL Native Workbench Unified Implementation and Acceptance Plan

Owner: `one-person-lab-app`
Purpose: `opl_native_workbench_unified_candidate_plan`
State: `local_p0_p1_implemented_verified_candidate_only`
Current interaction reference: `ChatGPT Codex macOS 26.707.41301 (2026-07-11)`
Superseded observations: `26.707.31428 (2026-07-10)`,
`26.707.31123 (2026-07-10)`

Machine truth lives in `contracts/app-shell-candidates.json`,
`contracts/shell-adapters/opl-native-workbench.json`, the App GUI/runtime/page
contracts, validator output, exact shell artifacts, and release-owner records.
This document records the implementation and acceptance route. The exact local
candidate cohort is machine-bound in the two contracts above; this document
alone is not evidence of active-shell adoption, release, clean-VM, or remote
readiness.

## Decision

`opl-native-workbench` remains the only foreground alternative candidate.
AionUI remains the active release shell. The native candidate has implemented
and locally verified one candidate-only product cohort containing both:

- **P0:** local cross-top-level thread discovery, read, dispatch, steering,
  queue, safety gates, and bilateral receipts;
- **P1:** lifecycle actions plus model-initiated coordination through
  client-executed `dynamicTools`, reusing the same typed host gate;
- **P2:** authenticated remote-host aggregation, explicitly deferred and not a
  dependency of local P0 or P1 acceptance.

Candidate acceptance does not switch `contracts/app-shell-adapter.json`, enter
stable/nightly packaging, or establish release readiness. A later adoption
decision must separately change the active adapter and pass the full App
release-owner gates.

The candidate may be installed and launched alongside AionUI as an independent
local GUI client. That is a per-launch developer choice governed by
[`gui-shell-candidates.md`](gui-shell-candidates.md), not a second active release
shell. Side-by-side bundle identity and sequential switching prove neither shared
physical Runtime parity nor safe simultaneous writes to one workspace/thread.
Launcher-started Candidate runs consume explicit App-resolved `opl`/`codex`
identity and emit exact Runtime readback; direct bundle launch still has a
host-PATH fallback. Codex App Server is now the sole thread and history
authority: the renderer rebuilds history through `thread/list/read/resume`, and
localStorage is limited to UI metadata and drafts. Before stronger cross-GUI
parity claims, AionUI must expose the same cohort and both clients must
participate in the same host coordination/conflict gates.

For repeatable local comparison, the foreground alternative has one formal test
identity: the visible name is `One Person Lab Native`, the installed bundle is
`/Applications/One Person Lab Native.app`, and the isolated bundle ID remains
`cn.gflab.opl.native-workbench.candidate`. It uses the OPL icon with a restrained
Native badge so Dock and application-switcher state are distinguishable from
`/Applications/One Person Lab.app`. `npm run gui -- --shell
opl-native-workbench` opens the installed bundle; `--rebuild` rebuilds the
candidate checkout, verifies the bundle ID, and replaces only that installed
Native bundle. This local test identity does not rename, restyle, replace, or
adopt the AionUI release App.

## Authority Inputs

This plan absorbs the latest product semantics from rebased GUI authority
source `1a9c1b4162c199e24d0e16fdfdadabe12bd28d16` and the cross-thread ADR in
`36b922a6a1ff071f0185fc4a71df0da52395cb74` without copying active AionUI
implementation changes into this candidate lane.

The authority order is:

1. App GUI, runtime, page-state, first-run, release, and candidate contracts;
2. the native candidate adapter contract;
3. the App-root local GUI launcher and shared Runtime resolver contracts;
4. the typed host bridge and its fixture/live evidence;
5. Desktop/WebUI renderer implementations and tests;
6. packaged and owner evidence for any stronger claim.

## Verified Local Candidate Cohort

The local P0 plus P1 implementation and formal side-by-side package are bound to
App product authority `3615b0e4d338a46f21882a8d9b13e2f0adb5a12e`, Native source and pushed
`origin/main` `c1d9dbda821d95137722e5ff0e40e984486226c5`, and Codex CLI
`0.144.1`, observed on `2026-07-13`.

- the complete Native test bundle passed, including 10 coordination security
  cases and 9 WebUI host tests;
- the bounded GUI projection was `132753` bytes;
- dynamic-tools live thread
  `019f599c-ea66-7523-bc3f-85106d15540c` preserved its request ID and
  completed;
- coordination source `019f599d-399d-7ec1-9274-433e7481c630`, target
  `019f599d-4557-7351-a74d-c8f41c697fbc`, and fork
  `019f599d-f0c4-7933-9487-9cab6d18d140` completed direct `turn/start`,
  nonurgent host queue followed by `turn/start`, and urgent `turn/steer`;
- the packaged candidate launched with bundle ID
  `cn.gflab.opl.native-workbench.candidate`; Accessibility inspection was
  denied with `-25211`, so the same PID was verified through CoreGraphics window
  `111241`; its target-window screenshot contained `Codex` and `5.6 Sol`, and
  the process was terminated after capture;
- packaged renderer, package manifest, and screenshot SHA-256 fingerprints are
  recorded in the machine contracts and enforced by the candidate validator.
- `/Applications/One Person Lab Native.app` was installed alongside
  `/Applications/One Person Lab.app`; its visible name, isolated bundle ID,
  badged icon, exact renderer bytes, explicit Runtime cohort, selected workspace,
  and launcher-default `dry_run_only` policy were read back from the installed
  process without changing release adoption or updater state.

This closes local candidate P0 plus P1 implementation evidence. It does not set
`active_shell_adopted`, `release_ready`, `production_ready`, `clean_vm_ready`,
or `remote_ready`.

Codex Core/App Server owns opaque thread IDs, thread history, persistence,
status, lifecycle, and turns. The OPL App typed host bridge owns authorization,
scope checks, routing, conflict gates, and a minimal append-only coordination
queue/receipt ledger. That ledger contains no thread history and never becomes
thread truth. The renderer owns presentation and user intent only. Renderer or
shell code must not create a second thread store, agent registry, or permission
store.

The App-root launcher is now implemented for local selection. It injects exact
OPL/Codex executable identity into the packaged Candidate, keeps the Candidate
bundle distinct from AionUI, and defaults App actions to dry-run-only. This is
launcher-scoped implementation evidence only: active AionUI Runtime parity,
direct-bundle Runtime resolution, canonical cross-GUI conversation continuity,
adoption, and release readiness remain unproven.

## Three Authority Layers

| Layer | Scope | Owner and transport | Candidate decision |
| --- | --- | --- | --- |
| L0 | One root agent tree | Codex runtime `spawn_agent`, `send_input`, `wait_agent` | Retained for descendants only. It is forbidden as a global cross-top-level message bus. |
| L1 | Independent top-level threads on one local machine | OPL typed host bridge over local Codex App Server `thread/*` and `turn/*` | P0 plus P1, required for native candidate acceptance. |
| L2 | Host-scoped threads across authenticated machines | Future OPL host connection adapters over each host's App Server | P2 deferred. `remote_ready=false`; local evidence cannot close it. |

The same-agent-tree and cross-top-level paths may coexist, but they are not
interchangeable. Models and renderers never invent thread IDs or route directly
to arbitrary App Server connections.

## Typed Host Bridge

The candidate must expose typed request, response, event, failure, and receipt
envelopes for:

- `thread/list`, `thread/read`, `thread/resume`, `thread/fork`;
- `thread/archive`, `thread/unarchive`;
- `turn/start`, `turn/steer`;
- `thread/status/changed` consumption;
- capability-detected parent/ancestor metadata.

The host resolves an App-visible thread key to an explicit host plus opaque App
Server `threadId`. Renderer code must not issue raw App Server JSON-RPC, parse
Codex JSONL, write host ledgers, or infer permission from UI state.

The thread directory defaults to the current project and exposes summary,
status, project, workspace, host, owner, goal, archived state, optional
relationships, active turn, and claimed write set. Archived, cross-project, and
future remote scopes require explicit selection and their own permission check.

## P0: Local Coordination Closure

P0 is one end-to-end local-machine path across at least two independent root
threads:

1. list and filter threads with pagination and opaque IDs;
2. read metadata first and history only when required;
3. resume an unloaded target before `turn/start`;
4. send to an idle loaded target with `turn/start`;
5. use explicitly labeled `turn/steer` only for urgent input to a running turn;
6. queue nonurgent input in the host and deliver it with `turn/start` when idle;
7. project a coordination event and status to both source and target timelines;
8. return target result summary/ref to the source thread;
9. expose typed failures instead of silently creating or substituting threads.

Every dispatch passes permission/scope confirmation, idempotency and duplicate
checks, delegation-cycle and hop-budget checks, project/workspace/host identity,
claimed/expected write-set conflict, source-target identity, and no-permission-
escalation gates. A write-set conflict fails closed or routes to explicit owner
coordination; it is not treated as an operating-system lock.

The host queue may store delivery metadata and payload needed for the pending
message. It must not copy or own target history. Queue decisions are visible in
the same bilateral receipt as immediate dispatch.

## P1: Lifecycle and Model Tools

P1 adds:

- fork, archive, unarchive, wait, timeout, and result aggregation;
- capability-detected parent/ancestor projection;
- user preauthorization policy for low-risk same-project actions;
- client-executed model tools for list, read, send, fork, archive, unarchive,
  and wait.

The final model-tool transport is client-executed `dynamicTools`. Tool handlers
must call the same typed host bridge and pass the same permission, dedupe, loop,
scope, write-set, queue, failure, and receipt path used by user-driven GUI
actions. A dynamic tool must never call App Server or a receipt store directly.

Fresh `codex-cli 0.144.1` `generate-ts` output does not contain a
`dynamicTools` field, while a fresh ephemeral live probe accepted dynamic tool
registration, emitted `item/tool/call`, and completed the turn. This is an
explicit schema/runtime drift, not a reason to replace runtime evidence with
generated-schema inference.

Each supported runtime cohort therefore requires a capability probe and a
schema-drift record. If the probe fails, the App preserves user-driven typed
host coordination and exposes a typed model-tool-unavailable state. That
fallback must not claim P1 model-tool readiness. Future schema convergence can
remove the drift exception only after fresh protocol and behavior readback.

## P2: Remote Hosts Deferred

P2 is outside local candidate acceptance. Its future scope is limited to:

- saved and authenticated App Server connections;
- host-scoped directory, identity, health, and route selection;
- cross-host permission and disconnect recovery;
- bilateral receipts that retain source and target host identity.

Remote storage remains owned by each host's App Server. OPL must not merge
remote histories into a custom global thread database. Remote readiness requires
real connected-host list/read/send/recovery evidence; local fixtures, Desktop
smoke, WebUI smoke, or P0/P1 packaged evidence do not satisfy that gate.

## Desktop and WebUI Parity

Desktop and WebUI may use different delivery transports, but both must expose
the same typed host contract and equivalent:

- thread directory, read, resume, fork, archive, and unarchive actions;
- idle start, running steer, nonurgent queue, and stale-status behavior;
- confirmation, permission, dedupe, loop, scope, and write-set decisions;
- source/target receipt status, result navigation, and typed failures;
- `dynamicTools` capability state and fallback explanation.

Desktop-only coordination is not acceptable. The WebUI browser renderer must
not access App Server directly; the Node WebUI host is the typed App Server
adapter and may access it through the same host contract. Narrow layouts may
use sheets or full-height details instead of desktop popovers, but they may not
hide lifecycle actions, conflict results, or receipt readback.

## Unified Candidate Work Packages

| Order | Work package | Required output | Claim boundary |
| ---: | --- | --- | --- |
| 1 | Authority sync | Candidate registry, adapter, plan, validator, and negative tests agree on 41301, L0/L1/L2, local P0/P1, remote P2 deferred, and false-ready fields. | Contract target only. |
| 2 | Typed host core | Typed envelopes, opaque ID mapping, App Server adapter, pagination/status subscription, and no duplicate stores. | Source/fixture evidence only. |
| 3 | P0 routing | Resume/start/steer/queue state machine with typed failures. | No GUI or package claim. |
| 4 | Safety and receipts | Permission, dedupe, loop/hop, scope, write-set, identity, no-escalation gates and bilateral receipt projection. | No owner or release claim. |
| 5 | P1 lifecycle | Fork/archive/unarchive/wait/result aggregation and capability-detected relationships. | Local lifecycle target only. |
| 6 | P1 model tools | Client-executed `dynamicTools`, runtime probe, schema-drift record, fallback, and shared host gates. | P1 unavailable when probe falls back. |
| 7 | Shared product UI | 41301-aligned project/thread rail, single timeline, compact header, bottom composer, on-demand details, coordination actions/events, and Settings. | Visual/source target only. |
| 8 | Desktop/WebUI adapters | Same coordination capabilities and semantics through platform delivery adapters. | Parity requires both evidence sets. |
| 9 | OPL state/actions and refs | Existing App state/action, task awareness, preview, provenance, starter, confirmation, and receipt refs remain App/domain-authority compliant. | No artifact or domain authority transfer. |
| 10 | Candidate package | Explicit candidate `.app` plus source, packaged, local-live, and WebUI artifacts from one fixed cohort. | Still not active or release-ready. |
| 11 | Local packaged acceptance | Two independent root threads complete list -> read -> dispatch/queue or steer -> target result -> source readback, with negative safety cases. | Local P0/P1 candidate evidence only. |
| 12 | Adoption and release | Explicit active-adapter change, clean VM, owner acceptance, release cohort, and release gates. | Separate later decision. |
| 13 | Remote P2 | Authenticated multi-host implementation and real recovery evidence. | Deferred; separate readiness claim. |

The base chat, model/reasoning policy, App state/action bridge, refs-only
previews, provenance, starter forms, confirmation cards, settings, and
shared-renderer work remain part of the candidate. Prior source or smoke output
was revalidated with the unified local P0/P1 cohort. Work packages 1 through 11
are closed for this local candidate cohort. Adoption/release package 12 and
remote-host package 13 remain separate, unstarted readiness decisions.

## Acceptance Matrix

| Gate | Must prove | Required negative evidence |
| --- | --- | --- |
| App contract | Registry/adapter/plan agree; active adapter remains AionUI; 41301 is current and 31123/31428 are superseded. | Old baseline, missing protocol method, P2-ready, or any false-ready mutation is rejected. |
| Host fixture | Paginated list/read, opaque IDs, status routing, resume/start/steer/queue, lifecycle, and typed failures. | Duplicate, loop, same-target, stale, archived, cross-scope, permission escalation, and write-set overlap fail closed. |
| Dynamic tools | Runtime probe registers client tools, receives `item/tool/call`, completes, routes through host gates, and records schema drift. | Generated-schema-only inference and probe-failure-as-ready are rejected. |
| Renderer source/DOM | Rail/detail/composer/timeline consume typed projections and expose bilateral receipts and actionable failures. | Raw JSON-RPC, shell-owned thread store, hidden WebUI actions, and protocol debug copy are rejected. |
| Visual | 41301-based desktop and narrow/WebUI states are readable and unobstructed for directory, confirmation, queue, receipt, failure, and conflict. | Superseded reference and desktop-only evidence are rejected. |
| Desktop/WebUI behavior | Equivalent actions, queue/safety decisions, receipts, and dynamic-tool state on the exact candidate cohort. | Transport differences may not change product semantics or authority. |
| Packaged local P0/P1 | Real package, two independent top-level threads, result readback, and negative gates tied to exact App/Shell/Codex fingerprints. | Source tests, mocks, or one-thread resume do not prove packaged closure. |
| Release isolation | Candidate build remains explicit; active adapter and stable/nightly assets remain unchanged. | Candidate package or local smoke cannot set adoption/release/production/clean-VM ready. |
| Local GUI and Runtime isolation | Candidate uses a distinct bundle/user-data identity, local launch does not mutate adoption, and Runtime path/version/cohort readback exposes any resolver deviation. | Side-by-side install, host PATH, resume smoke, or shared workspace selection cannot prove Runtime parity or concurrent-write safety. |
| Remote P2 | Real authenticated hosts complete list/read/send/disconnect recovery with host-scoped receipts. | Local evidence cannot be reused as remote evidence. |

## Required Verification Route

Authority-lane closeout runs only App-owned focused gates:

```bash
node -e "for (const f of ['package.json', 'contracts/app-shell-candidates.json', 'contracts/shell-adapters/opl-native-workbench.json']) JSON.parse(require('fs').readFileSync(f, 'utf8'))"
npm run validate:shell-candidates -- --candidate opl-native-workbench
node --experimental-strip-types --test tests/release/native-candidate-cross-thread-authority.test.ts tests/release/app-release-boundary-cases/gui-design-system-validation.ts
git diff --check
```

The shell-owned tests, runtime capability probe, package build, Desktop/WebUI
behavior, local coordination, and packaged-window evidence were executed on the
fixed cohort above. Their exact summary is now recorded as App authority; ignored
local artifacts remain reproducibility inputs rather than committed product
truth.

After absorption into a checkout with the pinned OPL Flow authority source and
active/candidate shell checkouts, the wider `npm run test:release-boundary`,
`npm run test:smoke`, explicit candidate adapter quick gate, and candidate shell
commands remain integration gates. A missing checkout is a typed blocker, not a
reason to synthesize evidence or weaken the candidate contract.

## False-Ready Boundary

Local P0 plus P1 now records `local_p0_p1_implemented=true`. The following
broader claims stay false:

- whole-product or active-shell `implementation_complete`;
- `active_shell_adopted`;
- `release_ready` and `production_ready`;
- `clean_vm_ready` and packaged user-path acceptance;
- `remote_ready`;
- runtime/domain/artifact authority transfer.

Docs, contracts, focused tests, generated schemas, fixture adapters, ephemeral
probes, source smoke, package manifests, or local candidate smoke are each
insufficient alone. The closed local P0/P1 claim therefore binds exact App and
Native SHAs, Codex/App Server version, runtime capability-probe receipt, package
fingerprints, Desktop/WebUI gates, and the two-independent-thread path. Remote
P2 and active release adoption remain separate later gates.

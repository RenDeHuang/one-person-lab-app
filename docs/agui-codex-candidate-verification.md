# AG-UI/CopilotKit Codex 候选 Shell 验证

Owner: `one-person-lab-app`
Purpose: `candidate_shell_verification_runbook`
State: `active_experimental`
机器边界：本文是人读验证 runbook。机器可读候选策略在
`contracts/app-shell-candidates.json` 和
`contracts/shell-adapters/agui-codex.json` 中。

## 边界

`agui-codex` 是面向 Codex App-like OPL chat-first desktop/WebUI 的实验性
shell candidate。它不是默认 release shell，也不是 AionUI 修改清单。

默认 stable/nightly release path 继续使用 `contracts/app-shell-adapter.json`，
其中 `active_shell` 仍是 `aionui`。只有显式设置下面的 adapter contract 时，
App wrapper 才会选择该候选 shell：

```bash
OPL_APP_SHELL_ADAPTER_CONTRACT=contracts/shell-adapters/agui-codex.json
```

App repo 继续拥有 product truth、GUI requirements、page-state expectations、
first-run policy、release gates 和 generated product profile。链接进来的候选
shell 只拥有 shell-local implementation、candidate packaging 和
candidate-specific smoke validation。

## 分层

用户可见产品目标是 Codex App-like OPL chat surface：

- workspace directory selection；
- 当前 workspace/recent conversations 的轻量 workspace/session rail；
- new conversation 和 thread reset；
- 固定 Codex executor 和 automatic model status；
- MAS/MAG/RCA purpose entries 和 compact purpose tags；
- chat-first conversation surface；
- chat canvas 旁边的右侧可收起 Files、Skills/Capabilities、
  Routing/runtime refs、Memory refs、Always-On/Automations inspector tabs；
- secondary context panel；
- summary-first runtime/status refs；
- App-owned Settings 和 release/update surfaces；
- 通过 App wrapper 验证 packaged `.app`。

CopilotKit 是 chat、sidebar、popup 和 agent runtime binding 的用户可见
UI/runtime layer。

AG-UI 是 renderer runtime 与 Codex app-server 或 ACP compatibility adapters
之间的内部 event/protocol layer。普通用户不应看到 AG-UI 作为产品概念、
dashboard 或 debug surface。

Codex app-server 是 primary Codex backend。ACP 和 `codex-acp` 保留为 non-Codex
agents 或 protocol harness 的 compatibility references。

WebUI 是同一 chat-first UI 的 delivery surface。Electron 使用 preload/IPC
提供 `window.oplCandidate`；browser WebUI 使用 local bridge，通过 HTTP actions
和 `/api/codex-events` SSE 提供同样 App-owned API shape。WebUI 不能引入第二套
product profile、runtime truth source、provider selector、memory authority 或
artifact authority。

PilotDeck 只作为信息组织参考。可借鉴的是 workspace rail、project/session
list、chat-first main pane、Files、Skills、Routing、Memory、Always-On grouping。
PilotDeck 的 AGPL-3.0 source、gateway、runtime、memory、router、always-on
store、provider list 和 WorkSpace state model 不进入本 App repo，也不转移到
candidate runtime authority。

Google Stitch `One Person Lab` 设计稿只作为视觉参考。可借鉴的是 Quiet Utility
风格、灰阶 tonal layers、1px outline、固定 reading lane、底部 pinned composer、
窄 icon rail 和右侧 inspector 组件比例。不可复制 Stitch 生成源码或 demo data；
不可把 Stitch 中的 local inference、model/VRAM 或 inspector 默认展开语义提升为
OPL App 产品真相。

## App-Root 命令

保护默认 release shell：

```bash
node --experimental-strip-types scripts/validate-active-shell.ts --quick
```

验证 candidate registry：

```bash
npm run validate:shell-candidates
```

显式选择 candidate adapter 做 active-shell quick validation：

```bash
OPL_APP_SHELL_ADAPTER_CONTRACT=contracts/shell-adapters/agui-codex.json node --experimental-strip-types scripts/validate-active-shell.ts --quick
```

通过 App wrapper 构建 candidate `.app`：

```bash
OPL_APP_SHELL_ADAPTER_CONTRACT=contracts/shell-adapters/agui-codex.json npm run package
```

期望输出：

```text
shells/agui-codex/out/One Person Lab AG-UI Codex Candidate.app
shells/agui-codex/out/agui-codex-candidate-manifest.json
```

## Candidate-Shell 命令

在 `shells/agui-codex` 运行。该路径是 maintainer Mac 上
`/Users/gaofeng/workspace/opl-agui-codex-shell` 的 linked external checkout。

```bash
npm install
npm run validate:adapter-events
npm run validate:candidate
npm run build:renderer
npm run smoke:webui
npx electron . --ui-smoke-test
'./out/One Person Lab AG-UI Codex Candidate.app/Contents/MacOS/One Person Lab AG-UI Codex Candidate' --ui-smoke-test
npm run validate:candidate -- --require-app --require-smoke
```

UI smoke 会通过真实 Codex app-server thread/turn 发送 `只回复 OK`，并要求
assistant reply 可见为 `OK`。

## 最低验收

- 默认 App release adapter validation 仍解析到 `aionui`。
- `npm run validate:shell-candidates` 通过，并报告 candidate 只参与 explicit
  candidate build。
- 只有设置 `OPL_APP_SHELL_ADAPTER_CONTRACT=contracts/shell-adapters/agui-codex.json`
  时 candidate adapter validation 才参与。
- Candidate 消费 App-owned generated product profile。
- Source renderer build 通过。
- Electron 和 WebUI 共享同一个 renderer。
- WebUI smoke 证明 browser `window.oplCandidate`、HTTP action routes、
  SSE Codex app-server events、Settings IA、secondary activity refs surface、
  conversation event rendering 和 default-collapsed home parity。
- Source UI smoke 把普通 home 绘制为 chat-first canvas，stage class 同时包含
  `without-rail` 和 `without-inspector`，展示 `科研`/`基金`/`演示` purpose entries，并
  收到 Codex app-server 的 `OK`。当前 App contract 要求普通 home 不显示 runtime
  activity、continue-work、per-agent running badges 或 footer quick icons；refs
  只能进入 Runtime 或 secondary context。
- Source UI smoke 还必须打开 workspace/session rail、右侧 inspector 和 Routing
  tab，证明普通用户层 chrome 在中文状态下仍使用 `科研`、`基金`、`演示`、`本机助手`、
  `本机能力`、`自动`、`状态摘要` 等用户层文案，不显示 `PPT`、`Codex CLI`、`MAS`、
  `MAG`、`RCA`、`app_state.actions`、`opl_app_state.v1`、AG-UI/ACP/app-server 等技术标签。
- Source 和 packaged UI smoke 还必须把窗口压到窄桌面/WebUI 宽度验证 context
  layer：workspace/session rail 与 inspector 仍是默认收起的二级层，但显式打开后
  inspector、context tabs 和 Routing tab 必须有真实可见尺寸。
- App-wrapper packaging 产出可启动 `.app`，包含 `Contents/Info.plist` 和
  `Contents/MacOS` executable。
- Packaged UI smoke 针对 `.app` bundle 通过，并证明同样的 default-collapsed
  chat-first home。
- PilotDeck-informed information organization 以 OPL-owned UI 形式出现：optional
  lightweight workspace/session rail、session list、context tabs，以及右侧可收起
  Files、Skills、Routing、Memory、Always-On inspector surfaces；这些 surface 在
  ordinary home 中默认关闭。
- Page-state matrix mapping、first-run matrix mapping、runtime summary/full
  drilldown 和 safe App action dry-run evidence 写入 candidate smoke evidence 和
  package manifest。
- Ordinary chat UI 展示 OPL chat surface 和 CopilotKit-backed chat surface，不显示
  AG-UI protocol/debug dashboard copy。`Codex CLI`、`MAS`、`MAG`、`RCA` 和命令/schema
  id 只进入 route receipt、diagnostics、developer evidence 或原始详情，不作为普通
  chrome 的主要文案。
- Backend、model、permission selectors 不进入 ordinary home 和 conversation
  paths。

## Release Promotion

Candidate 可以端到端验证而不改变当前 release。只有明确修改
`contracts/app-shell-adapter.json` 之后，它才会成为默认 stable/nightly shell。
在此之前，和默认 AionUI release path 的隔离是必需 invariant。

## 当前证据

2026-06-02 current candidate evidence：

- Candidate shell `npm run validate:candidate -- --source-only --require-profile`
  通过。
- Candidate shell `npm run build:renderer` 通过；Vite 仍有 node-fetch browser
  externalization 和大 chunk warning，未导致 build failure。
- Candidate shell `npm run package` 构建出
  `/Users/gaofeng/workspace/opl-agui-codex-shell/out/One Person Lab AG-UI Codex Candidate.app`
  和 `out/agui-codex-candidate-manifest.json`。
- Package 之后重新运行 `npm run smoke:webui`，写回
  `webui_smoke_status=passed`，并证明 `bilingual_ui_status=passed`、
  `secondary_runtime_context_refs_status=passed`、`default_home_layout_status=passed`
  和 `webui_parity_status=passed`。
- Package 之后重新运行 source UI smoke：
  `npx electron . --ui-smoke-test`。证据记录 `packaged=false`、
  `route_label="科研本机助手/Users/gaofeng"`、`model_status="自动"`、
  `purpose_labels=["科研","基金","演示"]`、
  `home_stage_class_name="stage-shell without-rail without-inspector"`、
  `home_continue_work_visible=false`、`home_runtime_activity_visible=false`、
  `bilingual_ui_status=passed`、`locale_switch_status=passed`，并覆盖
  expanded rail/inspector 与 Routing tab 的中文用户层文案检查；
  `responsive_context_layer_status=passed`、`responsive_context_layer_width=998`、
  `responsive_inspector_visible=true`、`responsive_context_tabs_visible=true`、
  `responsive_routing_tab_visible=true`；
  `codex_app_server_turn_status=passed` 和 `last_assistant_text="OK"`。
- Package 之后重新运行 packaged UI smoke：
  `./out/One Person Lab AG-UI Codex Candidate.app/Contents/MacOS/One Person Lab AG-UI Codex Candidate --ui-smoke-test`。
  证据记录 `packaged=true`，并证明同样的 default-collapsed chat-first home、
  中文默认 UI、英文切换、secondary runtime context refs、七类 conversation
  events、998px 下 inspector/context tabs/Routing tab 实际可见、safe App action
  dry-run、visible paint 和 Codex reply `OK`。
- Candidate shell final gate
  `npm run validate:candidate -- --require-app --require-smoke` 通过。
- Final manifest 当前记录 `source_ui_smoke_status=passed`、
  `packaged_ui_smoke_status=passed`、`webui_smoke_status=passed`、
  `bilingual_ui_status=passed`、`default_home_layout_status=passed`、
  `responsive_context_layer_status=passed`、
  `secondary_runtime_context_refs_status=passed`、`codex_app_server_turn_status=passed`
  和 `action_dry_run_status=passed`；普通 home 的
  `home_runtime_activity_visible=false`、`home_continue_work_visible=false`、
  `home_footer_quick_icons_visible=false`。

注意：`npm run package` 会重建 `out/` 并把 smoke 字段初始化为 pending。完整闭环
顺序必须是先 package，再跑 WebUI smoke、source UI smoke、packaged UI smoke，最后
跑 `npm run validate:candidate -- --require-app --require-smoke`。

剩余边界是产品采纳，而不是 candidate 技术证据缺口。AionUI 仍是默认 release
shell，直到 `contracts/app-shell-adapter.json` 在正常 release gate 下被明确提升。

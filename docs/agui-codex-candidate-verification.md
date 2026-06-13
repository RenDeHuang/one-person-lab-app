# AG-UI/CopilotKit Codex 候选 Shell 验证

Owner: `one-person-lab-app`
Purpose: `candidate_shell_verification_runbook`
State: `active_experimental`
Machine boundary: 本文是人读验证 runbook。机器可读候选策略在
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

State-model validation 也是 App-owned gate material。候选 shell 必须运行
`npm run validate:state-model`，并证明它消费来自
`opl app state --profile fast --json` 的 OPL Framework active project line
projection，而不拥有 runtime truth、domain truth 或 readiness verdict。

## SSOT 分工

本文只拥有候选 shell 的人读验证 runbook：边界、命令顺序、最低验收和
evidence lifecycle。候选 registry、adoption gate、forbidden entry routes 和
reference implementation 清单的机器 SSOT 是
`contracts/app-shell-candidates.json`；显式 adapter 选择和 candidate shell root
的机器 SSOT 是 `contracts/shell-adapters/agui-codex.json`；默认 stable/nightly
release shell 的机器 SSOT 是 `contracts/app-shell-adapter.json`。

因此，candidate package、source/WebUI/package smoke、state-model validation 或
candidate manifest 只能证明 technical verification。它们不能把 `agui-codex`
提升为默认 release shell，不能改变 App product truth，也不能证明 App release
ready、domain ready、family production ready、clean-VM ready、Full release ready
或 active-shell adopted。若要采纳为默认 release shell，先改
`contracts/app-shell-adapter.json` 并通过 App-owned product contracts、
page-state / first-run matrices、active-shell validation、GUI package compile、
release isolation 和外部 checkout history policy；不要通过追加本文执行日志、
候选 smoke 摘要或设计说明来表达采纳。

## 分层

用户可见产品目标是 Codex App-like OPL chat surface：

- workspace directory selection；
- 当前 workspace/recent conversations 的轻量 workspace/session rail；
- new conversation 和 thread reset；
- 固定 Codex executor 和 automatic model status；
- MAS/MAG/RCA purpose entries 和 compact purpose tags；
- chat-first conversation surface；
- conversation 内的 live run artifact，用于当前 turn 的 running、event refs、
  action receipt 和 failure recovery；
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

Codex App-like chat-first 是 candidate 的主目标。Google Stitch 只是可持续使用
的在线设计工具和视觉参考输入，可用于生成草图、校准字体、比例、圆角、留白和
层级；它不是唯一参考，也不是 product truth。若 Stitch、PilotDeck、CopilotKit
demo 或 AG-UI demo 的形态与 Codex App-like 目标冲突，以 Codex App-like 为准。
验证时不能把上一轮 Stitch 生成稿当成目标稿继续优化。Stitch 可以继续用于设计
探索，但 candidate acceptance 只看它是否更接近 Codex App：chat-first、轻 chrome、
中心 reading lane、底部多行 composer、workspace rail 和 inspector 默认收起。

Google Stitch `One Person Lab` 设计稿只作为视觉参考。可借鉴的是 Quiet Utility
风格、灰阶 tonal layers、1px outline、约 780-820px fixed reading lane、底部
pinned multiline composer、窄 icon rail 和右侧 inspector 组件比例。不可复制
Stitch 生成源码或 demo data；不可把 Stitch 中的 local inference、model/VRAM、
表格化工作台或 inspector 默认展开语义提升为 OPL App 产品真相。

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

注意：App wrapper package 会重建 renderer 并重写
`out/agui-codex-candidate-manifest.json`，因此会把 smoke 证据字段重新置为
`pending`。最终 `--require-smoke` 验收必须在 package 之后重新运行 WebUI smoke
和 packaged UI smoke，让 manifest 记录新的 renderer/package 证据。

## Candidate-Shell 命令

在 `shells/agui-codex` 运行。该路径是 maintainer Mac 上
`/Users/gaofeng/workspace/opl-agui-codex-shell` 的 linked external checkout。

```bash
npm install
npm run validate:adapter-events
npm run validate:state-model
npm run validate:candidate
npm run build:renderer
npm run smoke:webui
npx electron . --ui-smoke-test
'./out/One Person Lab AG-UI Codex Candidate.app/Contents/MacOS/One Person Lab AG-UI Codex Candidate' --ui-smoke-test
npm run smoke:webui
npm run validate:candidate -- --require-app --require-smoke
```

若刚刚通过 App repo 执行过 `npm run package`，以 package 后的顺序为准：
先跑 packaged executable UI smoke，再跑 `npm run smoke:webui`，最后跑
`npm run validate:candidate -- --require-app --require-smoke`。

UI smoke 会通过真实 Codex app-server thread/turn 发送 `只回复 OK`，并要求
assistant reply 可见为 `OK`。

## 最低验收

- 默认 App release adapter validation 仍解析到 `aionui`。
- `npm run validate:shell-candidates` 通过，并报告 candidate 只参与 explicit
  candidate build。
- 只有设置 `OPL_APP_SHELL_ADAPTER_CONTRACT=contracts/shell-adapters/agui-codex.json`
  时 candidate adapter validation 才参与。
- Candidate 消费 App-owned generated product profile。
- Candidate `npm run validate:state-model` 通过，并证明 active project line
  projection/state model 来自 `opl app state --profile fast --json`，覆盖
  `status`、`active_run_id`、`next_visible_step`、
  `progress_delta_classification`、`deliverable_progress_delta`、
  `platform_repair_delta` 和 `next_forced_delta`；该证据不能写成 domain ready、
  production ready、clean-VM ready、Full release ready 或 active-shell adoption。
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
- Source UI smoke 必须证明当前 turn 的运行证据以 conversation live artifact 或
  compact event refs 呈现，而不是常驻工作台：idle home 没有 runtime/activity block，
  发送消息后出现 running/receipt refs，完成后保留 turn-level summary。
- Source UI smoke 还必须打开 workspace/session rail、右侧 inspector 和 Routing
  tab，证明普通用户层 chrome 在中文状态下仍使用 `科研`、`基金`、`演示`、`本机助手`、
  `本机能力`、`自动`、`状态摘要` 等用户层文案，不显示 `PPT`、`Codex CLI`、`MAS`、
  `MAG`、`RCA`、`app_state.actions`、`opl_app_state.v1`、AG-UI/ACP/app-server 等技术标签。
- Source 和 packaged UI smoke 还必须把窗口压到窄桌面/WebUI 宽度验证 context
  layer：workspace/session rail 与 inspector 仍是默认收起的二级层，但显式打开后
  inspector、context tabs 和 Routing tab 必须有真实可见尺寸。
- Source 和 packaged UI smoke 还必须验证 chat-first visual polish：composer
  只有一层可见圆润输入 surface，radius 至少 32px，surface 默认高度至少约
  100px，textarea 至少约 60px 且 line-height/placeholder 按多行任务输入设计；
  overflow clipping 生效，外层 CopilotKit/adapter container 透明，内部 layout
  子层无额外白底或阴影；send、workspace、purpose 和 icon controls 使用
  pill/circle 半径，不能回退到方块式 4-10px 随机圆角，也不能让输入体验退化成
  单行文本框。
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
- Backend 和 permission selectors 不进入 ordinary home 和 conversation paths；
  model selector/status 只能作为 App-owned Codex model control 出现。

## Release Promotion

Candidate 可以端到端验证而不改变当前 release。只有明确修改
`contracts/app-shell-adapter.json` 之后，它才会成为默认 stable/nightly shell。
在此之前，和默认 AionUI release path 的隔离是必需 invariant。

## Evidence Lifecycle

本文只保留候选 shell 的边界、命令和最低验收。具体 source/WebUI/package smoke
结果、manifest 字段、绝对路径和 dated pass/fail 记录属于 candidate shell artifacts、
candidate manifests、CI logs 或 `docs/history/process/`。旧的 2026-06-02
candidate smoke 和 2026-06-03 active-doc cleanup 过程记录已压缩到
[App retired surface provenance](./history/process/retired-surface-provenance.md)；
当前 candidate 边界和命令仍以本文、candidate contracts、candidate manifests、
shell artifacts、CI logs 和 App-root validation 为准。

注意：`npm run package` 会重建 `out/` 并把 smoke 字段初始化为 pending。完整闭环
顺序必须是先 package，再跑 WebUI smoke、source UI smoke、packaged UI smoke，最后
跑 `npm run validate:candidate -- --require-app --require-smoke`。

剩余边界是产品采纳，而不是在本文追加执行日志。AionUI 仍是默认 release shell，
直到 `contracts/app-shell-adapter.json` 在正常 release gate 下被明确提升。

# App 交互逻辑 Command Center

Owner: `one-person-lab-app`
State: `active_plan`
机器边界：本文记录 App-owned 交互要求和 active shell implementation 的交接
规则。Contracts 和 validation scripts 仍是机器真相来源。

## 目标

One Person Lab App 应该表现为一个 Codex App 风格的 agent command surface。主
路径是：在当前 workspace 里直接输入任务、启动特定 purpose 的 agent task，并
在需要时打开 Runtime 或 context 查看运行状态。Settings 是偏好与 readiness
surface，不是日常 workbench，也不是 upstream AionUI configuration dump。

## Source Of Truth

- `contracts/app-gui-product-contract.json` 拥有 product IA、Home minimal command
  surface、Runtime running activity、Settings tabs 和 App/Shell authority
  boundary。
- `contracts/app-page-state-matrix.json` 拥有 page-state acceptance
  expectations。
- `contracts/app-product-profile.json` 是 shell-consumed generated profile
  source；`scripts/app-product-profile.ts` 负责同步到 active shell。
- `scripts/validate-active-shell.ts` 是 App-root gate，用于检查 active shell
  是否实现这些 surfaces。

## Home

Home 必须固定 Codex CLI，并隐藏 executor/model/permission selectors。它不展示
runtime activity、continue-work、needs-attention/active/recent refs、
per-assistant running badges 或底部 feedback/favorite/web 图标。Home 只承担
composer-first 的开始/继续对话职责。

Runtime 读取 `opl runtime app-operator-drilldown --json` 的
`current_control_state.summary` 和 `current_control_state.states`。它先展示真实
active provider executions、running domains、task kinds 和 heartbeat。
`running_provider_attempt_count` 可以包含 checkpointed provider refs，只能进入
高级诊断，不能当成正在运行任务数。Project
progress refs 读取 `app_state.operator.workbench.task_drilldowns`，但只作为二级
project refs，不能作为 running task truth。`domain_lane_map.active_task_count`、
`module_runtime dirty`、module readiness、repo/worktree diagnostics 和 assistant
cards 都不能推导“正在运行的任务数”。

## Settings

普通 Settings navigation 是：

- General
- Access
- Agents & Capabilities
- Local Environment
- Appearance
- Advanced
- About & Updates

Legacy routes 只作为兼容 redirect：
`overview -> general`、`runtime -> environment`、`system -> advanced`、
`model -> environment`、`agent/assistants/skills-hub/tools -> capabilities`、
`display/pet -> appearance`、`webui -> access`。

Access 优先回答 App 现在能否工作。Capabilities 先按 purpose 和 agent domain
分组，再展示 Skills 或 MCP/tool details。Local Environment 拥有 Codex CLI、
Temporal、modules、paths 和 release readiness。Advanced 拥有 developer mode、
raw refs、logs、diagnostics 和 OPL Flow context。

## Shell 协作

`shells/aionui` 是可替换 implementation carrier。Upstream AionUI changes 只能
在对照 App-owned contracts 和 page-state matrix 后作为 implementation
material 使用。新 shell candidates 留在 `shells/<candidate>`，直到
active-shell validation、page-state matrix、first-run matrix、product profile
sync 和 package compile 全部通过。

## Fork Delta Budget

当前 active shell 是 AionUI fork，因此 GUI 优化按 thin-shell 原则推进：

- 产品 IA、Home 行为、Settings 命名、purpose entries、runtime truth source 和
  first-run gate 先写入 App contracts/profile/matrix。
- Shell 侧只做 generated profile 读取、route redirect、薄 renderer 组合、
  App state/action bridge、必要 i18n/CSS 和 focused tests。
- 优先复用或组合 AionUI 现有 frame、modal、route、settings section 和 renderer
  primitives，不把 OPL 产品逻辑散落到 fork-local core rewrites。
- 新普通 Settings tab、新 Home surface、新 capability/purpose entry、新可见
  model/provider/permission 控件、新 runtime/action truth source，都必须先有
  App-owned contract。
- 可以随时更换到 `shells/<candidate>`：candidate 应实现同一组 App contracts 和
  generated profile，而不是继承 AionUI 特有的产品逻辑。

## 验证

修改这一区域后，至少运行：

```bash
npm run validate:active-shell
npm run test:release-boundary
```

如果修改了 shell renderer files，还要在 `shells/aionui` 中运行：

```bash
bun run i18n:types
node scripts/check-i18n.js
bunx vitest run tests/unit/guid/GuidPage.dom.test.tsx tests/unit/settings/SettingsModal.dom.test.tsx tests/unit/skills/SkillsHubSettings.dom.test.tsx
```

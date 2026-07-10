# OPL App GUI Shell Conformance Matrix

Owner: `one-person-lab-app`
Purpose: `app_gui_shell_conformance_read_model`
State: `active_read_model`
Snapshot basis: `2026-07-10`
Machine boundary: 本文是人读 read model，不是第二真相源。状态必须能回指 App
contracts、adapter/candidate contracts、shell source/tests 或 fresh evidence；本文不能
改变 product truth、active shell、candidate stage 或 release readiness。

设计体系入口见 [`README.md`](README.md)，实现方法见
[`shell-implementation-guide.md`](shell-implementation-guide.md)。

## 读法

状态词只表达当前 source relationship：

| Status | 含义 |
| --- | --- |
| `aligned-contract` | App target 与 carrier contract 一致；不等于实现或视觉已通过。 |
| `current-deviation` | carrier 的当前 machine contract 与理想目标不同，已明确记录。 |
| `candidate-target` | 只属于候选 contract，不能推导 active-shell adoption。 |
| `evidence-required` | 有目标或 contract，但本 read model 没有足够 source/package/VM evidence。 |
| `not-claimed` | 当前 source set 不应作该项声明。 |

本矩阵的功能/交互目标来自：

- `contracts/app-gui-product-contract.json`
- `contracts/app-product-profile.json`
- `contracts/app-page-state-matrix.json`
- [`feature-inventory.md`](feature-inventory.md)
- [`ideal-interaction-spec.md`](ideal-interaction-spec.md)
- [`visual-system.md`](visual-system.md)

Carrier 角色和候选边界读取 active adapter、`contracts/app-shell-candidates.json` 和
`contracts/shell-adapters/opl-native-workbench.json`。后者只描述实现/候选边界，不能
覆盖上面的 App product authority。

Active AionUI 默认状态通过 README 治理段声明的动态 state source 读取。本快照解析为
`collapsed`；该值可随 owner contract 与实现收敛而变化。

## 验证入口

| ID | Entry | 证明边界 |
| --- | --- | --- |
| `A1` | `bun run validate:active-shell -- --quick` | Active adapter、contracts 和 source probes 的快速结构检查。 |
| `A2` | `bun run validate:active-shell` | Active shell 完整 App-root contract validation。 |
| `N1` | `npm run validate:candidate:native` | Native candidate registry 与声明边界。 |
| `N2` | `OPL_APP_SHELL_ADAPTER_CONTRACT=contracts/shell-adapters/opl-native-workbench.json node --experimental-strip-types scripts/validate-active-shell.ts --quick` | Explicit native adapter contract 结构。 |
| `N3` | Candidate repo `npm run validate:candidate` 和 `npm run validate:state-model` | Candidate source 与 state-model consumption。 |
| `N4` | Candidate repo `npm run smoke:visual` | Manual/foreground visual smoke；不等于 packaged acceptance。 |
| `N5` | `npm run package:candidate:native` | Explicit candidate package path；不改变 active release shell。 |
| `V1` | Route/viewport/ref-bound screenshots、pixel checks、packaged/VM evidence | 对应视觉、package 或用户路径；每层 evidence 只证明自身。 |

## Matrix

| 功能或交互要求 | AionUI active carrier | `opl-native-workbench` candidate | 验证入口 | 允许偏差与当前边界 |
| --- | --- | --- | --- | --- |
| App repo 拥有 GUI product truth | `aligned-contract`：active adapter 明确 shell 只是 implementation carrier。 | `candidate-target`：candidate adapter 同样禁止 authority transfer。 | `A1/A2`, `N1/N2` | 不允许 shell-local product truth。 |
| Home 是 chat-first，不是 dashboard/landing | `aligned-contract` requirement；是否完成由 active validation 和 visual evidence 决定。 | `candidate-target`，明确 composer-first 与 single timeline。 | `A2`, `N3`, `V1` | 不允许普通 Home 回到 activity grid 或三列 workbench。 |
| 宽桌面项目/对话 rail 默认可见 | `current-deviation`：动态 active state marker 在本快照解析为 `collapsed`。 | `aligned-contract` target：candidate contract 为 `workspace_session_rail_default_visible: true`。 | `A2`, `N1-N4`, `V1` | AionUI 的当前 collapsed 状态是可收敛的 implementation deviation，只可作为 transition 记录，不能写成永久规则、ideal 或 Codex visual parity 已对齐。 |
| 窄窗口 rail 可收起并以 drawer/overlay 打开 | `evidence-required`。 | `candidate-target`; visual proof required。 | `A2`, `N3/N4`, `V1` | 可因 viewport 收起；不能点击后仍是 hidden DOM 或 0 宽。 |
| Right inspector 默认关闭 | `aligned-contract`：`collapsed`。 | `aligned-contract` candidate target：`inspector_default_visible: false`。 | `A1/A2`, `N1-N4`, `V1` | 无默认打开例外；用户请求后可按 viewport 变 drawer。 |
| 主区保持单一 conversation timeline | `aligned-contract` requirement，视觉一致性仍需证据。 | `candidate-target` 的 explicit required surface。 | `A2`, `N3/N4`, `V1` | 不允许把 Runtime、Files、artifact board 常驻成并列主区。 |
| Composer 是底部主 command surface | `aligned-contract` requirement。 | `candidate-target`，包含 model/reasoning controls。 | `A2`, `N3/N4`, `V1` | 允许 shell primitive 不同；不允许双层 composer、settings bar 或单行退化。 |
| 模型与推理策略由 App profile 驱动 | `aligned-contract` requirement。 | `candidate-target`，visual parity contract 引用 product profile。 | `A1/A2`, `N2/N3` | 文档和 shell 都不得复制 allowlist；当前默认读数为 `5.6 Sol / ultra`。 |
| Codex CLI 固定 executor；普通路径隐藏 backend/provider/permission | `aligned-contract` requirement。 | `candidate-target`。 | `A2`, `N2/N3` | 无普通用户例外；技术信息只进 details/diagnostics。 |
| OPL purpose 与 package shortcuts | `aligned-contract` requirement，具体 exposure 从 profile/package state 读取。 | `candidate-target`。 | `A2`, `N3`, page-state probes | Shell 不拥有 workflow、stage、artifact 或 domain verdict。 |
| 普通 state 读取走 fast App state | `aligned-contract` bridge requirement。 | `candidate-target` bridge requirement。 | `A1/A2`, `N2/N3` | Full/detail 只能在明确 diagnostic path；不得本地推断 readiness。 |
| Mutation 走 App action route | `aligned-contract` bridge requirement。 | `candidate-target` bridge requirement。 | `A2`, `N2/N3` | 高风险动作需要 dry-run/confirmation/receipt；不允许 shell-local mutation kernel。 |
| Runtime/Files/Memory/Artifacts 只展示 refs | `aligned-contract` requirement。 | `candidate-target`。 | `A2`, `N3`, page-state probes | 不允许取得 runtime、domain、memory body、artifact body 或 owner-receipt authority。 |
| Settings 由 Control Plane registry/slots 承接 | `aligned-contract` implementation probe 存在。 | `candidate-target` adapter slot 存在。 | `A2`, `N2/N3` | Legacy routes 只 redirect；不能新增 shell-owned ordinary IA。 |
| ChatGPT Codex macOS 26.707.31123 视觉基准 | `current-deviation/evidence-required`：AionUI 是 active carrier 和 regression floor，不自动视为 1:1 baseline。 | `candidate-target`：candidate visual parity contract 明确该 baseline。 | `A2`, `N4`, `V1` | OPL branding 是允许例外；AionUI 现状不能反向降低理想目标。 |
| OPL 品牌、双语与普通语言一致 | `aligned-contract` requirement；实际像素与 copy 仍需检查。 | `candidate-target`。 | `A2`, `N3/N4`, `V1` | 不允许 carrier branding、混合语言或 technical ids 成为 ordinary chrome。 |
| Keyboard、focus、contrast、reduced motion | `evidence-required`。 | `candidate-target/evidence-required`。 | Focused accessibility checks, `V1` | 视觉相似不能替代可访问性；无 carrier-specific 豁免。 |
| First-run 使用 App-owned readiness/page-state | `aligned-contract` requirement。 | `candidate-target` adoption gate。 | `A2`, `N2/N3`, first-run matrix validation | Contract-only 不证明 clean-machine path。 |
| Desktop/WebUI 同 product semantics | `not-claimed` by this docs lane；按 active release evidence 单独判断。 | `candidate-target`，要求 shared renderer/bridge parity。 | `N3`, WebUI smoke, `V1` | Native candidate 的 source parity 不等于 packaged/VM parity；不得对 AionUI 补作无证据声明。 |
| Release role | Active stable shell，由 active adapter/release contracts 决定。 | Explicit experimental candidate；不是默认 stable/nightly shell。 | `A2`, `N1/N2/N5`, release gates | Candidate contract、package 或 smoke 不允许推导 active-shell adoption/release-ready。 |

## Rail 收敛说明

Rail 是当前唯一被明确允许记录的目标/实现默认差异：

- 理想交互与视觉层：宽桌面 persistent rail。
- Active AionUI dynamic readback：本快照为 `collapsed`，可随 owner contract/实现收敛。
- Native candidate contract：default visible。
- Right inspector：三方均默认关闭。

在 App contracts 被 owner lane 显式修改并通过 validators 前，active AionUI 的 machine
读数仍按 `collapsed` 解释；但任何基础设计文档、视觉验收或新 candidate 不应把它
当成理想目标。未来收敛时必须同步 product profile、GUI contract、page-state matrix、
active-shell behavior、validators 和 visual evidence，不能只改本文。

## 更新规则

更新本矩阵时：

1. 先读取 fresh contracts、adapter/candidate source 和对应 evidence。
2. 每个状态至少保留一个 source/validation owner。
3. Contracted 只写 `aligned-contract` 或 `candidate-target`，不写“已实现”。
4. Source screenshot、package smoke、VM、owner acceptance 和 release promotion 分层记录。
5. Product target 变化先改 owner contract/design doc；本文最后同步 read model。

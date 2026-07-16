# Codex App 视觉 1:1 对齐规范

Owner: `one-person-lab-app`
Purpose: `codex_app_visual_parity_execution_and_acceptance`
State: `clean_candidate_source_verified_installed_pixels_pending`
Reference: `ChatGPT Codex macOS 26.707.72221 (build 5307, observed 2026-07-15)`

## 结论

OPL App 的主界面以当前 Codex App 为 1:1 视觉目标。除 One Person Lab 品牌、OPL
原生 Agent Package/Runtime/Settings 能力及其必要状态外，用户不应在第一眼从字体、颜色、
图标、间距、阴影、圆角、排版或交互反馈上感知到另一套设计系统。

这里的 1:1 指同一机器、同一缩放、同一窗口尺寸和同一内容状态下，对稳定界面 chrome
做可测量复刻。它不授权复制 Codex 的品牌、专有实现、云端能力或内部数据模型；OPL 只
复用视觉语法、空间关系和交互位置。

本规范与 [`visual-system.md`](visual-system.md) 都是
`contracts/app-gui-product-contract.json#interaction_baseline.visual_target` 的人读投影；发生
数值冲突时只修正文档或 Shell，不建立第二套视觉 token authority。

## 当前落实状态

`2026-07-15` 的 clean Shell candidate 从 canonical base
`b6bba802b83dcb472e4de894aa5c0dd4bff1b871` 重建，并选择性重放本轮用户可见差异。当前
candidate identity 必须在验证时从 active Shell checkout 读取，不能把过渡 HEAD 固化在本
文档中：

- 对话搜索从独立一级 row 移至“对话历史”标题右侧，桌面与窄窗均为 `32x32px` icon action，
  保留 tooltip、accessible name 和原搜索交互；
- 对话历史空状态使用 `20px` IconPark `MessageOne` 单色 outline 与 `13/18` 次级文案，移除
  carrier 默认的大号抽屉插画和装饰性 empty-state frame；
- rail 使用最新 reference 的中性 light/dark surface；项目组直接显示 sessions，source 与 DOM
  均不存在 project-owned“上下文 / 添加上下文”层；
- Home 与 conversation composer 共用中性 border、resting/focus shadow 和 `14/20` textarea；
- Settings 导航图标改为中性色，content lane 收敛为 `760px`，彩色 section 边条和多余 card
  shadow 已移除；
- Account & Access 的 connected Gateway state 使用 unframed identity/metrics/action group；
  stale 文案内联呈现，账户、指标、footer 和操作不再由多层矩形边框包围；
- Home 的 prompt、content-sized agent shortcuts 与 composer 进入一个 bottom reading lane；入口无
  chevron，所有可见官方智能体都可选择，运行就绪只在发送时以 typed guidance 阻止；
- 项目、Local/Worktree 与 branch 控件并入 composer 内部，不再形成独立灰色顶栏或第二条能力标签；
- Workspace 使用 content-container 响应式单列，Codex instructions 与新对话附加说明保持 unframed；
- clean candidate 的 full Node `1584/1584`、full DOM `814 passed / 6 skipped`、focused Node
  `24/24`、focused DOM `55/55`、typecheck、format、i18n、lint `0 error` 与 diff-check 均通过。

历史视觉 lane `984995d5c9d2ef591007ec38206bb4d4517539b0`（parent
`af58910708af814147499d2b35d28269d1350390`）只作为逐文件视觉提取来源；它的祖先包含已撤销
能力，因此不得整体吸收，也不得作为最终 release cohort 或安装证据。

这些结果只证明本轮 candidate source 结构和自动化行为门，不证明 WebUI 或安装版 pixels，
也不等于完整 1:1 或 release-ready。普通
conversation 的真实多状态、zh-CN/en-US 全矩阵、同尺寸 reference/candidate mask diff、macOS
安装包、最终 Shell main 和安装后 readback 仍须在 release cohort 上重跑。状态标记为：

- `candidate_shell_commit_source=active_shell_checkout_git_head`
- `historical_visual_extraction_commit=984995d5c9d2ef591007ec38206bb4d4517539b0`
- `candidate_webui_pixels=pending_on_clean_release_cohort`
- `installed_pixel_acceptance=pending`
- `visual_parity_complete=false`

## 产品模型

- `session/thread` 是唯一对话身份；`project/workspace/directory` 只是新对话的初始 cwd、
  可变分组和可见 metadata。
- `project_owns_session=false`。更换 cwd 只重新归组同一 session，必须保留 thread id、
  transcript、turn history、title 和 task state。
- 项目下直接显示 sessions。禁止显示“上下文 / 添加上下文”层级，禁止把目录描述成
  session、附件或 artifact 的 owner。
- 拖动 session 到另一目录不是本版本硬要求；可见且键盘可达的“更改工作目录”是等价
  能力。未来增加拖动时仍必须调用同一 canonical rebinding path。
- MAS、MAG、RCA、OMA、BookForge 等在产品认知上是 Codex 插件；在 OPL 中由 Agent
  Package 提供更强的安装、更新、启停、可见性和运行状态能力，但不得把普通对话改成
  agent dashboard。

## 允许的视觉差异

只允许以下 OPL-owned delta：

1. App 名称、图标、About、release identity 和低频品牌强调使用 One Person Lab。
2. Home starter、Agent Package 状态、Runtime、Gateway 和 OPL Settings IA 使用 App
   contracts 定义的数据与文案。
3. Codex 没有的 blocker、repair、receipt 或运行状态可以增加紧凑 disclosure，但必须复用
   Codex 的排版、surface、图标和状态层级。
4. WebUI/mobile 因平台能力产生的响应式变化可以适配，但不能形成第二套视觉主题。

下列差异不被允许：AionUI 默认蓝紫色主题、彩色 Settings 图标墙、过重卡片、不同字号、
不同 icon stroke、无 resting shadow 的 composer、搜索作为完整一级导航行、项目“上下文”
层、常驻 provider/backend selector，以及用 OPL 品牌色覆盖中性主界面。

## Reference Cohort

每轮 parity 工作先记录以下不可变信息：

- Codex App `CFBundleShortVersionString`、`CFBundleVersion` 和采集日期；
- OPL Shell commit、package identity、主题、locale、系统缩放和字体设置；
- 窗口 CSS/physical 尺寸、DPR、route、fixture 和交互状态；
- reference 与 candidate 的原图路径和 SHA-256。

当前 reference 为本机 `/Applications/ChatGPT.app` 的 `26.707.72221` / build `5307`。
`26.707.41301` 继续保留为既有交互合同 observation，但不再代表最新视觉像素。

## 视觉 Token

### Typography

| Surface | Font | Size / line-height | Weight |
| --- | --- | --- | --- |
| App chrome | `-apple-system`, `BlinkMacSystemFont`, `SF Pro Text`, system fallback | `13/18` | `500` active, `400` secondary |
| Conversation body | 同上 | `15/22` | `400` |
| Composer textarea | 同上 | `14/20` | `400` |
| Page title | `SF Pro Display` first, same fallback | `20/28` | `600` |
| Metadata | `SF Pro Text` first | `12/18` | `400` |
| Code/path | `SF Mono`, `ui-monospace` | `12/18` | `400` |

禁止 viewport 字号缩放、负字距和组件私有 font stack。中英文使用同一字号层级，通过宽度
和换行适配。

### Light

| Token | Target |
| --- | --- |
| Canvas / active surface | `#FFFFFF` |
| Rail | `#FCFCFC` |
| Hover | `rgba(0, 0, 0, 0.045)` over rail/surface |
| Selected row | `#F0F0F0` |
| Primary text | `#202124` |
| Secondary text | `#5F6368` |
| Muted text | `#80868B` |
| Hairline border | `rgba(0, 0, 0, 0.10)` |
| Focus ring | `rgba(37, 99, 235, 0.34)` |
| Composer shadow | `0 1px 2px rgba(0,0,0,.07), 0 8px 24px rgba(0,0,0,.08)` |

### Dark

| Token | Target |
| --- | --- |
| Canvas | `#171819` |
| Active surface | `#202224` |
| Rail | `#1B1C1E` |
| Hover | `rgba(255, 255, 255, 0.06)` |
| Selected row | `rgba(255, 255, 255, 0.09)` |
| Primary text | `#F4F5F6` |
| Secondary text | `#AEB4BC` |
| Hairline border | `rgba(255, 255, 255, 0.12)` |
| Composer shadow | `0 1px 2px rgba(0,0,0,.30), 0 8px 24px rgba(0,0,0,.24)` |

OPL accent 只用于品牌动作和必要状态，不参与普通 rail、Settings 导航或 composer chrome。

## Surface Checklist

### Rail 与对话历史

- 桌面宽度 `280-340px` 可调；默认 row 高 `30-32px`，section label 高 `24px`。
- New task、Runtime、Archived 保留在顶部；账户、help、Settings 保留在底部。
- 对话搜索位于“对话历史”标题右侧，使用 `32x32px` icon button；展开/窄窗时均有
  tooltip、accessible name、focus-visible 和 `Cmd/Ctrl+Shift+F`。
- Search 不占用一整行，不与 Runtime/Archived 同级呈现。
- 项目行使用 16px folder icon 和 13px label；展开后直接显示 sessions。
- 不渲染“上下文 / 添加上下文”、project-owned attachment 或 project-level delete。
- Session row 保持稳定高度；hover actions 不挤压标题，selected state 不改变几何。

### Conversation 与 Composer

- Timeline 保持单列，assistant 正文 unframed；内容宽度、Markdown、代码块和 diff 与 Codex
  reference 对齐。
- 默认 assistant Markdown 使用 `15/22`、段落上下 `10px`、列表项上下 `2px`；行内代码使用
  `12/18` 中性浅灰胶囊。不得继续使用 AionUI 的 `16/28` 松散正文或按 viewport 缩小字号。
- Tool/process 过程使用本地化的低对比度 disclosure row；展开内容仍按行与 hairline 组织，
  不出现整块灰底卡片。复制/时间仅在 hover/focus 显示，不能为每条消息永久预留 `32px` 空行。
- 首批加载 skeleton 使用无框文本线，不画 bordered assistant/user bubble。
- Composer 单层 surface，桌面最大宽度 `736-800px`，圆角 `20-22px`，1px hairline。
- Resting shadow 必须存在：light 使用 `0 1px 2px rgba(0,0,0,.07), 0 8px 24px rgba(0,0,0,.08)`；
  dark 使用 `0 1px 2px rgba(0,0,0,.30), 0 8px 24px rgba(0,0,0,.24)`。
- Focus 只增强 border/ring，不删除 resting shadow，不改变尺寸。
- Textarea 使用 `14/20`、正常字重、无私有字距；placeholder 与正文基线必须一致。
- Attachment、permission、model/reasoning、voice 和 send/stop 使用稳定 action row；图标
  `16px`，同层 stroke 视觉重量一致。

### Settings

- Full-window、左 rail、单一顶部返回、search、右侧内容列与 Codex reference 保持同一空间
  关系；OPL IA 和 route 不变。
- 导航图标统一中性色，不用不同品牌色区分类目；16px icon，13-14px label，34px row。
- 主内容优先 section heading + grouped rows + hairline divider。只有确有边界的重复实体或
  confirmation 才使用 card。
- Settings 的 OPL-owned 图标统一来自 `@icon-park/react`，使用 16px 单色 outline；不混用
  Font Awesome、彩色图标块、filled 插画式图标或字母头像。
- 移除彩色左边条、重灰背景、卡片套卡片和营销式说明块；状态色只用于状态本身。
- Toggle、segmented control、select、stepper 和 swatch 按控件语义使用，不用文本胶囊模拟。

### Menus、Popover、Modal

- Radius `8-12px`，1px border，轻 shadow；禁止 20px 以上装饰性大圆角。
- 打开、关闭、hover、pressed 为 `80-180ms`，只动画 opacity、color、shadow 和 transform。
- Escape、focus return、keyboard traversal、screen-reader name 必须完整。

## AionUI 改造边界

优先级从低维护到高维护：

1. 语义 token 和 OPL baseline CSS；不写 page-specific hex。
2. 现有组件 props/className/CSS module；不复制组件树。
3. OPL-owned 小 adapter，例如 rail search placement 或 session grouping。
4. 只有缺少稳定 hook 时才改 AionUI fork body，并在 upstream intake matrix 记录冲突面。

禁止修改 AionCore、引入第二套状态源、复制 Codex 专有代码、依赖构建后 hash class、使用
`:nth-child` 绑定业务含义，或用整页 `!important` 覆盖掩盖结构问题。所有行为数据仍来自
App contracts、Framework projection 和既有 Shell state。

## 验收矩阵

必须覆盖：

- Home/rail、普通 conversation、Composer、Settings、search modal、menu/popover；
- light/dark、zh-CN/en-US；
- `1440x900`、`1024x768`、最小支持窗口和 mobile/WebUI viewport；
- default、hover、pressed、focus-visible、disabled、loading、error、streaming；
- reduced motion、键盘遍历、ARIA/accessibility name 和正文对比度。

同 cohort 稳定 chrome 的目标：关键几何每轴误差不超过 `1px`；对动态文本、时间、头像和
系统 chrome 做 mask 后，主要稳定区域 pixel mismatch 不超过 `1%`。像素阈值是回归信号，
人工检查仍需确认没有文本截断、重叠、错误层级或功能入口丢失。

完成声明必须同时具备：App contract/docs、Shell source、focused DOM、typecheck/lint/i18n、
同 cohort screenshots、安装版 readback。Docs、DOM、candidate screenshot 或 source gate
任一项都不能单独宣称 visual parity 或 release-ready。

## 机器治理标记

- `visual_parity_target=codex_app_1_to_1_except_opl_owned_deltas`
- `visual_reference=ChatGPT Codex macOS 26.707.72221 build 5307 (2026-07-15)`
- `project_owns_session=false`
- `project_context_row=forbidden`
- `conversation_search_location=rail_history_header_icon_button`
- `composer_resting_shadow=required`
- `aioncore_modification=forbidden`
- `visual_acceptance=source_dom_and_installed_pixels`
- `stable_geometry_tolerance_px=1`
- `stable_masked_pixel_mismatch_max_percent=1`

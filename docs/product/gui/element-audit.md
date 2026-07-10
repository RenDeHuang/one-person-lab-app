# OPL App GUI 元素位置与漂移审计

Owner: `one-person-lab-app`
Purpose: `app_gui_stable_element_placement_and_drift_review`
State: `active_design_review`
Machine boundary: 本文是人读元素位置理由与漂移检查。机器可读 GUI truth、当前
carrier 状态和 release evidence 仍归 contracts、source/tests、validators 与 artifacts。

设计体系入口见 [`README.md`](README.md)。

Active implementation state source:
`active_aionui.state_source=contracts/app-product-profile.json#gui.home.home_layout`。
该 marker 用于动态读取 active AionUI state，不把当前值固化为永久产品规则。

## 审计目标

本审计不记录某一轮“缺口清单”。它固定每类元素为什么放在当前位置，以及 shell、
响应式或产品迭代时要检查哪些漂移。功能归
[`feature-inventory.md`](feature-inventory.md)，交互归
[`ideal-interaction-spec.md`](ideal-interaction-spec.md)，视觉归
[`visual-system.md`](visual-system.md)，实现差距归
[`shell-conformance-matrix.md`](shell-conformance-matrix.md)。

## 稳定位置表

| 元素 | 稳定位置 | 位置理由 | 漂移信号 |
| --- | --- | --- | --- |
| Product identity | Window/titlebar、About、release assets | 用户必须知道正在使用 One Person Lab App，而不是 carrier/upstream。 | Carrier name/logo 进入 ordinary chrome。 |
| Current workspace | Rail header 或 main header 的低权重稳定位置 | Workspace 决定文件权限和 turn context，应持续可见。 | 只在 Settings/raw path 中可见，或被做成 Home 大卡片。 |
| Project/conversation rail | 宽桌面左侧 persistent；窄窗口 drawer | Navigation 是连续工作所需，不应占用 conversation 主区。 | 宽桌面缺失、被移到 Home grid，或关闭 drawer 后丢 selection。 |
| New/resume conversation | Rail header 与 conversation rows | 与 conversation history 同属 navigation task。 | 藏在 Settings、command palette only 或 dashboard card。 |
| Conversation timeline | Main canvas | 用户需要按时间理解任务、输出和决策。 | 与 Runtime/Files 并列成多个主面，或被 dashboard 替代。 |
| Composer | Main canvas bottom | 输入是普通路径主动作，应始终接近当前 conversation。 | 变成浮动营销卡、单行 input、settings bar 或多层 card。 |
| Purpose control | Composer control row / compact conversation context | Purpose 是当前 turn 的工作意图，与输入最相关。 | 变成 backend selector、agent dashboard 或 rail 一级产品树。 |
| Model/reasoning control | Composer 中的 App-owned model control | 用户可见但不应抢占输入；策略由 product profile 统一。 | Shell 复制 allowlist、Home/Conversation 不一致、provider 进入普通层。 |
| Attach/context controls | Composer action row | 附件和 refs 直接影响下一次发送。 | 藏在 Settings，或 overlay 覆盖输入/不可点击。 |
| Send/stop | Composer 主动作 | 与当前 draft/running state 同一决策点。 | 位置随状态跳动、running 时无 stop、disabled 无原因。 |
| Pending/elapsed state | 当前 assistant turn 或 composer status | 用户需要持续知道请求仍在推进。 | 只在 console/raw event 中可见，或 tool event 后状态消失。 |
| Tool/process/diff/file event | 对应 turn 内 compact disclosure | 事件属于当前 conversation，但细节不应压过正文。 | 全部 raw log 常驻，或移到独立主 dashboard 导致上下文断裂。 |
| Permission/user-input prompt | 对应 turn 内 | 决策必须和触发它的工作上下文相邻。 | 跳到不相关全局 modal，关闭后无法找回触发原因。 |
| Turn receipt / result refs | Turn summary/details | 证明本轮发生了什么，同时保持 timeline 可读。 | Raw JSON 默认展开，或 receipt 被当成 domain/release verdict。 |
| Right inspector toggle | Header/composer 附近的次级 icon action | Context 必须随时可达，但不占普通路径主权重。 | Toggle active 但 panel hidden，或默认把 inspector 常驻打开。 |
| Files/Artifacts/Runtime inspector | Right inspector / responsive drawer | 它们是 selected conversation 的相邻上下文。 | 放回 Home activity grid，或取得 artifact/runtime authority。 |
| Runtime overview | 独立 Runtime page | 跨 project/conversation 状态需要更大 scope 与筛选。 | Running/queued/attention 混成 Home badge 或 assistant card。 |
| Safe runtime action | Runtime/Settings 的 action area 与 confirmation surface | Action 需要状态、影响和 receipt context。 | Composer 直接执行隐藏 mutation，或绕过 dry-run/confirmation。 |
| Settings ordinary navigation | OPL Control Center | 全局配置、维护和偏好需要稳定信息架构。 | Upstream tabs 自动加入、每个功能新增一级 route。 |
| Raw diagnostics | Details disclosure / Advanced | 技术信息用于解释异常，不是 ordinary user task。 | Paths、ids、schema、JSON 成为首屏主文案。 |
| First-run blocker / next step | First-run 主区 | 新用户只需知道能否进入 App 和下一步。 | Full maintenance、domain status 或 terminal narrative 抢占 Core gate。 |

## 位置理由

### Home 与 Conversation

Home 的用户问题是“我现在要在这个 workspace 里做什么”。因此主区只保留
conversation、composer、purpose、model、attachments 和 current-turn feedback。
跨项目 Runtime、continue-work、evidence ledger、package maintenance 和 raw diagnostics
必须留在 secondary surface。

### Rail

Rail 的用户问题是“我在哪个项目/对话，下一步切到哪里”。宽桌面 persistent 可以减少
恢复成本；窄窗口 drawer 化可以保护 main canvas。Rail 不应承担运行总览、provider
配置或 package catalog。

### Inspector

Inspector 的用户问题是“当前 conversation 旁边还有哪些上下文”。它默认关闭，打开后
只扩展 selected scope，并保留 timeline、draft 和 scroll。Files、Artifacts、Runtime、
Capabilities、Memory 与 Settings shortcuts 可以共存，但都只展示 refs/projections。

### Runtime 与 Settings

Runtime 回答“工作现在处于什么状态、下一步是谁”；Settings 回答“App 如何配置、维护
和个性化”。把 progress 放进 Settings 会混淆配置与工作，把 maintenance 放进 Runtime
会混淆任务与平台。两者可以互相 deep link，但不合并 authority 或首屏。

## 漂移检查

### 结构漂移

- 宽桌面是否仍有 persistent project/conversation rail？
- Main 是否仍是一条 timeline，而不是 dashboard 或三列 workbench？
- Right inspector 是否默认关闭，且打开/关闭不丢 draft、scroll、selection？
- 窄窗口是否把 secondary context 变成可见 drawer，而不是 hidden DOM？
- Composer、toolbar、rail rows 和 icon controls 是否保持稳定尺寸？

### Authority 漂移

- Model/reasoning 是否只读 product profile，而非 shell-local list？
- State 是否来自 App state，mutation 是否来自 App action？
- Runtime/domain/artifact/memory/receipt/release truth 是否仍由原 owner 持有？
- Settings route/label/redirect 是否来自 Control Plane，而非 upstream discovery？
- UI 是否把 docs、cache、module dirt 或 active id 包装成 ready/running/current？

### 交互漂移

- 发送后是否持续有 pending/elapsed feedback？
- Error/disabled/blocked 是否说明原因和 next action？
- Permission、user-input 和 confirmation 是否保留触发上下文？
- Popover/drawer 关闭后是否把焦点返回触发器？
- Rail、timeline、inspector 与 Settings 是否都可 keyboard-only 使用？

### 视觉与文案漂移

- 是否出现 card-in-card、双层 composer、随机 radius、重 shadow 或营销 hero？
- 中文/英文普通 chrome 是否同屏单一语言？
- Carrier、protocol、route id、command、receipt id 是否进入 ordinary first screen？
- 长中文/英文是否换行或扩容，而不是缩小字体、负字距或遮挡相邻控件？
- 状态是否同时使用文字/图标，不只靠颜色？

## 审计输出格式

实际审计应逐项给出：

| Field | 内容 |
| --- | --- |
| `element` | 被检查的稳定元素。 |
| `expected_location` | 本文定义的位置。 |
| `observed_surface` | Source、packaged App 或 WebUI 的实际位置。 |
| `status` | `aligned / drift / not_evidenced`。 |
| `source_ref` | Contract、source/test、route/viewport screenshot 或 package ref。 |
| `impact` | 对用户流程、authority、响应式或可访问性的影响。 |
| `owner_route` | 应修改 product contract、shell adapter、visual CSS、bridge、validator 或 evidence 的 owner。 |

Docs-only 检查不能把 `not_evidenced` 改写成 `aligned`。当前 carrier 的默认差异只在
[`shell-conformance-matrix.md`](shell-conformance-matrix.md) 记录，元素位置理由保持
shell-neutral。

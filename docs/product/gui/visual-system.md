# OPL App GUI 视觉系统

Owner: `one-person-lab-app`
Purpose: `app_gui_visual_and_interaction_system`
State: `active_design_target`
Machine boundary: 本文定义人读视觉与交互基准。具体 token、组件和响应式实现由
shell source 承接；机器可读产品状态、模型策略、page-state 和 release gate 仍归
现有 contracts、validators、tests 与 evidence。

设计体系入口见 [`README.md`](README.md)。

## 基准与例外

当前视觉像素基准固定为 **ChatGPT Codex macOS 26.707.72221 / build 5307
(2026-07-15)**，执行与验收细节见 [`codex-app-visual-parity.md`](codex-app-visual-parity.md)。
`26.707.41301` 继续保留为既有交互 observation；`26.707.31428` 与 `26.707.31123` 只保留为
历史 observation，不再称为 latest/current。使用范围仅限布局、密度、层级、时间线、
composer、项目 rail 和按需环境详情交互的对齐；不得复制 ChatGPT/Codex 源码、品牌资产、
文案、账户权限或产品 authority。

OPL App 在基准上保留以下产品例外：

- App icon、窗口/metadata identity 和发布资产继续使用 One Person Lab App；普通导航栏与
  移动端标题栏只显示文字 `One Person Lab`，不搭配 logo，也不要求深浅主题变体资产。
- 普通工作入口使用 OPL purpose language。默认显示科研、基金、演示和元智能体；写书默认关闭，
  但继续作为可在 Settings → Agents & Capabilities 中开启并排序的入口。
- Executor、模型策略和当前默认值由 `contracts/app-product-profile.json` 决定；本文
  不复制 model/reasoning 值或模型 allowlist。
- Runtime、Home capability starters、Settings → Agents / Capabilities、first-run、receipts 和 action refs 使用
  App-owned contracts 与 OPL authority boundary。
- OPL accent、状态语义和双语 copy 可以偏离 Codex 品牌，但不能改变 Codex-based
  chat-first composition。

Codex baseline 是视觉参照，不是 machine truth。当前 carrier 的差异和证据状态见
[`shell-conformance-matrix.md`](shell-conformance-matrix.md)。

## 视觉原则

1. **Conversation first。** 主视觉锚点是单一对话时间线和底部 composer。
2. **Quiet utility。** 用层级、留白、细边界和稳定尺寸表达结构，不用装饰性 hero、
   渐变、浮动装饰物或大面积营销卡片。
3. **Secondary context on demand。** Environment、files、artifacts 与 Runtime details
   以 floating surface、preview 或 drawer 按需出现。
4. **Dense where repeated。** Rail、Settings 列表、tool events 可以紧凑；空白 Home
   和 conversation reading lane 保持呼吸感。
5. **State before decoration。** 颜色、图标和动效首先表达可操作状态，不承担纯装饰。
6. **One surface, one owner。** Composer、drawer、popover、Settings section 不使用
   card-in-card 或重复边框制造层级。

## Frame 与布局

宽桌面目标由四个稳定区域组成：

| 区域 | 目标 | 建议约束 |
| --- | --- | --- |
| 项目/对话 rail | 默认可见，承载全局入口、project 和 conversation history。 | `280-340px` 可调；列表滚动，不随动态标签改变宽度。 |
| Main canvas | 单一 conversation timeline 与 composer。 | 可用宽度不得低于 `620px`；reading lane 目标 `760-840px`。 |
| Conversation chrome | 当前 task identity、轻量状态和直接动作。 | 不承载 model/access 等 composer 配置，不做第二工具栏。 |
| Environment details | Changes、local、branch、commit/push、subagents、sources 与 OPL 次级 refs。 | 默认关闭；wide desktop 使用右上 anchored floating surface，空间不足时改 drawer。 |

布局规则：

- 宽桌面保持项目/对话 rail persistent；当 rail 加 main minimum width 无法同时成立时，
  rail 转为 drawer，不压缩 conversation 到不可读。
- Environment/details 不作为默认第三列。打开时保留 timeline scroll、composer draft
  和当前 selection；关闭后不改变业务数据。
- Conversation chrome、timeline 和 composer 使用同一水平节奏。宽屏增加外侧留白，不无限拉宽
  正文或把 composer 缩成小卡片。
- Home、Runtime、Settings 是全宽页面/主布局，不把整个 section 包成悬浮 card。
- Home starter 使用紧凑固定宽度，但容器不写死四列或五列；按当前可见入口数量居中并
  响应式换行，用户开启或关闭入口后不得留下偏斜的固定网格空位。

## Typography

默认使用平台原生 UI 字体栈：

```text
-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", sans-serif
```

代码、命令、路径、receipt 和固定宽度技术值使用：

```text
"SFMono-Regular", "JetBrains Mono", ui-monospace, monospace
```

推荐层级：

| Token | Size / line-height | 使用 |
| --- | --- | --- |
| `title` | `20/28`, weight `600` | 页面标题、空状态主标题。 |
| `section` | `16/24`, weight `600` | Settings section、drawer 标题。 |
| `conversation` | `15/22`, weight `400` | 用户与 assistant 正文。 |
| `body` | `14/20`, weight `400` | 普通 UI、列表摘要。 |
| `label` | `13/18`, weight `500` | 按钮、tabs、field labels。 |
| `meta` | `12/18`, weight `400` | 时间、状态、refs 摘要。 |
| `code` | `12/18`, weight `400` | 命令、路径和 receipt。 |

不得按 viewport width 缩放字号；不得使用负 letter spacing。中文与英文使用相同
字号层级，必要时通过容器换行、宽度和行高适配，不压缩字形。

## Color 与 Surface

以下表格是
`contracts/app-gui-product-contract.json#interaction_baseline.visual_target` 的人读投影，不是
独立 token source。视觉以中性灰阶为主；OPL teal 只用于品牌、typed status 和明确品牌动作，
不参与普通 rail、selected row、Settings 图标或 composer chrome。

Light target：

| Token | Value | 用途 |
| --- | --- | --- |
| `canvas` | `#FFFFFF` | Main canvas 与 conversation reading area。 |
| `surface` | `#FFFFFF` | Composer、popover、drawer、Settings bounded group 和 active content。 |
| `rail` | `#FCFCFC` | Navigation rail；与白色主画布形成极轻层级。 |
| `surface-subtle` | `#F0F0F0` | Selected row、tool event、secondary controls。 |
| `hover` | `rgba(0, 0, 0, 0.045)` | 普通 hover。 |
| `border` | `rgba(0, 0, 0, 0.10)` | 1px 分隔和 outline。 |
| `text-primary` | `#202124` | 正文和主标签。 |
| `text-secondary` | `#5F6368` | 元信息和说明。 |
| `text-muted` | `#80868B` | 低优先级 metadata。 |
| `focus` | `rgba(37, 99, 235, 0.34)` | Keyboard focus ring。 |
| `success` | `#15803D` | 成功。 |
| `warning` | `#B45309` | 需要注意。 |
| `danger` | `#B42318` | 失败或破坏性动作。 |

Dark target：

| Token | Value | 用途 |
| --- | --- | --- |
| `canvas` | `#171819` | App 背景。 |
| `surface` | `#202224` | Active content。 |
| `rail` | `#1B1C1E` | Navigation rail。 |
| `surface-subtle` | `rgba(255, 255, 255, 0.09)` | Selected row 和 tool event。 |
| `hover` | `rgba(255, 255, 255, 0.06)` | 普通 hover。 |
| `border` | `rgba(255, 255, 255, 0.12)` | 1px 分隔和 outline。 |
| `text-primary` | `#F4F5F6` | 正文和主标签。 |
| `text-secondary` | `#AEB4BC` | 元信息和说明。 |
| `accent` | `#5EEAD4` | OPL 选中态和品牌动作。 |
| `focus` | `#60A5FA` | Keyboard focus ring。 |
| `success` | `#4ADE80` | 成功。 |
| `warning` | `#FBBF24` | 需要注意。 |
| `danger` | `#FB7185` | 失败或破坏性动作。 |

状态不能只靠颜色表达；必须同时有文字、图标或可读形态。普通 surface 不使用彩色
渐变、强投影或透明模糊作为主要分层手段。

## Spacing

使用 4px 基准：`4 / 8 / 12 / 16 / 24 / 32 / 48`。

- Inline icon/text gap：`6-8px`。
- Compact row vertical padding：`6-8px`。
- 普通 control height：`32-36px`。
- Settings row 或 message event 内边距：`12-16px`。
- Section 间距：`24-32px`。
- 主 reading lane 上下留白：至少 `24px`，composer 区域按窗口安全区增加。

动态内容不得改变 rail、toolbar、icon button、tab 或 composer action row 的稳定尺寸。

## Radius 与 Border

| Element | Radius | Border / shadow |
| --- | --- | --- |
| 普通 card / list group | `6-8px` | 1px border，默认无 shadow。 |
| Button / segmented control | `6-8px` 或 pill | 由语义决定，不混用随机半径。 |
| Icon button | circle | 固定正方形 hit area。 |
| Chip / status | pill | 文本短、单行；长状态改普通文本。 |
| Popover / drawer panel | `10-12px` | 1px border，轻 shadow。 |
| Composer | `20-22px` | 单层 surface、单层 outline、resting shadow；focus 不改变几何。 |

禁止 nested cards、重复白底、双重 shadow 和未裁剪的矩形 adapter container。

## Icons

- OPL-owned Settings 导航、Overview 状态图标和 utility icon 统一使用 Font Awesome Free；普通
  utility/navigation icon 使用单色，只有 typed warning、error、success 和品牌动作使用语义色。不手画
  SVG，也不借此批量改写 upstream fork-body 图标。纯刷新动作只显示 refresh icon，并用
  tooltip 与 accessible name 提供文字。
- 全局标题栏帮助/反馈入口使用 Font Awesome Free Regular 的线框圆形问号，保留 tooltip、
  accessible name 和既有 GitHub issue 路由；不再使用 AionUI 的对话气泡图标。
- 已连接账户在 rail footer 使用绿色圆形 identity avatar。非中文姓名显示前两个词的首字母，
  连续中文姓名只显示第一个汉字；无姓名时回退到邮箱 local part 的前两个字符，再回退到 `OP`。
- Model/reasoning 紧凑控件直接显示模型与推理档位文字和 disclosure，不显示大脑图标。
- 常规尺寸 `16-20px`，stroke 保持 `1.5-1.75px` 的统一视觉重量。
- Undo、redo、attach、send、stop、search、settings、close、expand 等熟悉动作只用图标
  或 icon + 必要文字，不使用冗长 rounded text buttons。
- 不熟悉图标必须有 tooltip、accessible name 和 keyboard focus。
- Product icon 与 App identity 使用 OPL 品牌资产，不使用 Codex 或 carrier logo；普通导航
  chrome 是例外，按 text-only `One Person Lab` 呈现。

## Composer

Composer 是底部唯一主 command surface：

- Home 桌面参考几何固定为 composer 最大宽度 `736px`、最小高度 `98px`、圆角 `22px`；
  上方 context bar 高 `52px`、水平内缩 `12px`，与 composer 重叠 `13px`，避免项目条比输入区更抢眼。
- 桌面默认高度至少 `104px`，textarea 可见高度至少 `64px`；按内容增长到合理上限后
  内部滚动。
- Composer 浮于底部或贴近底部安全距，不能与窗口边缘、bottom panel 或系统 safe area
  相撞。
- 只保留一层 visible surface。外部 bridge/adapter container 必须透明。
- Home root、composer shell 与 footer account/Settings entry 在每个 viewport 各只有一个实例；
  resize 后必须完整重绘，不能留下旧 composer frame。
- Project/local/branch 不在 composer 常驻重复：工作目录由 rail 表达，branch/locality 由
  Environment 表达。Textarea 承载任务正文；底部 action row 承载 attachment、active
  capability、permission/access mode、单一紧凑 model/reasoning menu、可选 voice 和 send/stop。
- 当前 session 的 attachment、paste/drop 与 `/open` 是唯一显式文件输入，不从 rail/workspace
  预载 context，也不做隐藏注入；attachment 使用同一层文件预览，不形成第二层卡片。
- Purpose 不作为常驻可变 selector；active capability chip 可按上下文更换，但不得呈现
  为 backend/provider。
- 模型与推理状态及当前默认值读取 App product profile，不得在 shell 或文档复制
  model/reasoning 值或 allowlist。
- Backend、provider、executor 不进入普通 composer。Permission/access mode 保持可见，
  用自动化与文件权限的用户语言表达并保留安全透明度。
- Send/stop 使用稳定圆形主动作；running、stopping、blocked、failed 有明确文本或
  tooltip，不靠颜色猜测。
- Hover、focus、validation 和附件变化不能推动整个 timeline 跳动。

## Project / Conversation Rail

- 宽桌面默认可见，宽度在 `280-340px` 内可调，窄窗口改 drawer。
- 顶部固定 New task、Runtime、Archived；capability starter 属于 Home，package/capability
  管理属于 Settings。Sites/Chat 没有 OPL 对应能力时不显示。
- 中段按当前 cwd metadata 组织 canonical sessions，同时容纳 projectless sessions；分组是可变
  projection，不拥有 session、context 或 artifact。切换目录只移动同一 canonical-thread row 的分组，
  不复制 row/history，也不按标题或 workspace 去重。
- Directory group 展开后只显示 conversations 与“使用此工作目录新建对话”；不显示“添加上下文”或组级删除，
  更不得级联删除分组内 sessions。Canonical App Server overview 可用时排除未返回的 stale Codex ACP
  cache rows；只有 overview unavailable 时 fallback cache，非 Codex local rows 保留。
- 底部固定 account、help、Settings；常用 row actions 在 hover/focus
  出现，但 keyboard 用户可达。
- Active row 使用 tonal fill、清晰标题和轻量状态；不使用大色块或每行独立 card。
- 标题单行截断，完整值在 tooltip 或 details；状态 badge 不改变行高。
- 窄窗口转为 drawer，关闭后不丢失 selection；重新打开时保留 scroll position。
- Search 作为“对话历史”标题右侧的 icon-only action，不再占用独立文字 row；pin、rename、
  archive、reset 同样不得改变 row 稳定尺寸，Archived 使用独立 surface。
- Desktop application menu 与 conversation header 共享 Back/Forward、Previous/Next Task
  和 New Window 语义；不可用项 disabled，不能用无反馈菜单伪装成功。

## Conversation Timeline

- 主区只有一条时间线。Assistant 正文默认 unframed；用户消息可以使用轻量 bounded
  surface，但不做同权重大气泡墙。
- Tool、process、diff、file、receipt 和 permission event 使用 compact disclosure row。
- Approval、permission、user-input 与 MCP elicitation pending 使用同一层级的 compact bounded
  disclosure。后台 target 可放在 selected thread detail，但必须显示 thread/turn/item context；
  不使用无上下文全局 modal，也不把 pending 绘制成 error。
- 当前 turn 的 running artifact 显示 elapsed time、最近事件和可执行下一步；完成后
  收敛成摘要。
- 可 pin current-task summary bar 使用稳定单行/双行布局，固定容纳 status、elapsed、
  progress、next action、stop，不因状态文字长度推动 composer。
- Raw protocol、schema id、路径和完整 JSON 在 details/diagnostics 中显示。
- 长文本、代码和表格必须在 main width 内换行或滚动，不遮挡 composer 和后续消息。

## Popover、Drawer 与 Environment Details

- Model/reasoning、workspace switch 和 compact action sets 使用 anchored
  popover；短选项不升级为整页。
- Environment 使用右上 anchored floating surface，首层汇总 changes、local、branch、
  commit/push、subagents 和 sources。
- Environment 使用带 folder icon 的“切换工作目录”命令调用系统目录选择器；它更新同一 session 的
  canonical cwd，成功后刷新 workspace summary 与 rail 分组，running/失败状态就地显示且不伪造移动成功。
- OPL Artifacts/Evidence 进入 Environment 次级 section、preview 或 conversation
  disclosure；Runtime/Actions/Memory 不升级为同权 tabs。
- Popover 关闭后焦点回到触发器；drawer 有明确标题、close control 和焦点边界。
- Environment/details 打开时是当前 conversation 的辅助层，不是独立 dashboard。
- Worktree 只提供目录选择、简单 create/reuse 与 starting branch，默认保留；不显示 cleanup、
  snapshot receipt、restore 或 cross-host handoff 控制面。
- Drawer 内避免卡片套卡片；用 section header、divider、row 和 disclosure 表达层级。
- Bottom panel、file tree、Terminal、Browser 默认关闭；打开时尺寸稳定且不得遮挡 composer。

## Settings

Settings 保留 OPL 信息架构，但视觉采用 Codex 式窄内容列与 quiet grouped-row Control Center 基线：

- 使用 full-window shell，提供明确 return、search 和 grouped rows。
- Ordinary navigation 按当前 App-owned Settings IA 渲染；具体 route、label 和顺序从
  contracts/Control Plane 读取，不由 shell 自行扩展。
- 左侧 section navigation 稳定并使用单色 utility icon；右侧采用单列 reading lane，优先使用
  section heading、grouped rows、hairline divider 和不超过 8px 的安静 bounded list group。
  只有重复实体、confirmation 或确有独立边界的工具才使用 card，不为每个字段或操作再套一层 card。
- 侧栏在任一时刻只显示一个选中项；兼容路由完成跳转后，选中态归属实际落地页。
- bounded group 用于清晰分组；禁止 nested group、彩色 category 边条和重 shadow，也禁止
  用贯穿全页的裸横线堆叠出空旷、低密度页面，或把同一个用户问题拆成营销式卡片墙。
- 重复实体使用一组共享列头；逐行重复“名称 / 状态 / 来源 / 操作”等字段标签会降低
  扫描效率，不作为默认布局。
- 主操作贴近其拥有的对象或 section；不把对象级动作抽离成远端页面工具栏动作。
- 首屏先给结论、影响范围和下一步；raw path、id、receipt、JSON 和诊断默认折叠。
- 二元设置用 toggle/checkbox，模式用 segmented control，数值用 input/stepper/slider，
  多选项用 menu，颜色用 swatch，命令才使用 text 或 icon + text button。
- 破坏性或状态改变动作进入 confirmation drawer，明确 `will change`、
  `will not change`、recovery/receipt 和 preview/proof。

## 状态系统

所有 interactive element 至少定义：

- default、hover、focus-visible、pressed/selected；
- disabled 并解释原因；
- loading/running、success、warning、error；
- empty、unavailable、stale 或需要 refresh 的可理解文案。

Loading 不用无限旋转器代替进度。可获得阶段或 elapsed time 时必须展示；没有可执行
动作时不渲染空按钮。Disabled control 不仅变灰，还要通过 tooltip 或 nearby copy
说明为什么不可用。

Home package starter 的状态不得只靠颜色：`unavailable` 使用 disabled control + 原因 +
允许动作，`activating` 保持稳定尺寸并显示明确进行中状态，`blocked` 保留修复入口但不得
继续 launch。Activation 成功后才进入 selected/active capability 视觉状态；选中态同时使用
accent border、轻量 fill 与 check indicator，不能只靠低对比背景色。

## 响应式

- 不按 viewport 缩放字体。
- 优先保住 main canvas minimum width；空间不足时依次把 Environment/details、project rail
  转成 overlay/drawer，而不是压扁所有列。
- 窄桌面/平板保持 timeline 与 composer；secondary context 以全高 drawer 打开。
- 极窄宽度下 composer controls 可以换行或进入 overflow menu，但 send/stop、输入、
  workspace 和当前模型状态仍可达。
- 固定格式元素使用明确 width、min/max、aspect ratio 或 grid track，避免动态内容造成
  layout shift。

## 可访问性

- 正文与背景对比至少 `4.5:1`；大字、非文本边界和 focus indicator 至少 `3:1`。
- 所有功能可 keyboard-only 完成，Tab order 与视觉顺序一致。
- Focus ring 清晰，不被 overflow 裁掉；drawer/modal 使用正确 focus trap 和 Escape。
- Icon button 有 accessible name；tooltip 不作为唯一信息来源。
- 桌面 pointer target 通常不小于 `32x32px`，关键动作和触控 surface 目标不小于
  `44x44px`。
- 支持 reduced motion、系统字号和屏幕阅读器；状态变化使用适当 live region，避免
  重复朗读 streaming token。

## 双语

- 普通 UI 支持简体中文和英文，同一屏保持单一语言。
- 无显式语言偏好的首次启动在首帧前检测系统语言；显式选择优先且跨启动保留。
- OPL、Codex 可作为品牌保留；命令、路径、receipt id 和用户原文在技术区域保留原样。
- 中文 labels 优先描述工作目的，不用 MAS/MAG/RCA、route id 或 backend 名称替代。
- 为英文长词和中文扩展预留至少约 30% 文案空间；不能靠缩小字体或负字距塞入控件。
- 日期、时间、数字和 plural rules 使用 locale-aware formatter。

## Motion

- Hover/focus feedback：`80-120ms`。
- Popover、drawer、rail transition：`140-200ms`，只动画 opacity/transform 等不会
  触发布局抖动的属性。
- Streaming、progress 和 running indicator 应平稳，不使用装饰性循环动画。
- `prefers-reduced-motion` 下取消位移和弹性效果，只保留必要状态切换。
- Motion 不得延迟输入、send/stop、close、permission 或 destructive confirmation。

## 视觉 QA 边界

实现视觉变更时至少检查：

1. 宽桌面：persistent project rail、单一 timeline、composer、Environment details closed。
2. Environment/details open：右上浮层不遮挡关键内容，close/focus/scroll 正常。
3. 窄桌面/WebUI：rail 与 Environment/details 以 drawer/overlay 实际可见，不是 hidden DOM。
4. Home、conversation、Runtime、Settings、first-run 的 light/dark 与中英文。
5. Composer 的单层 surface、稳定尺寸、model/reasoning controls、send/stop states。
6. Visual screenshot 与 ChatGPT Codex macOS 26.707.72221 / build 5307 的同 cohort
   布局、密度和稳定像素比较；`26.707.41301` 仅用于既有交互 observation，并明确记录 OPL
   branding exception。
7. Environment floating details 保持按需、anchored 和 summary-first；OPL 次级 refs 与
   advanced work surfaces 默认折叠或关闭。
8. Settings 截图在记录证据前校验 requested/resolved route 与 expected/visible page title；
   任一不匹配即停止截图，避免把 Resources、Appearance 或其他页面记到错误目标。
9. Settings 至少分别有桌面、窄屏和深色 fresh visual evidence，并检查单一侧栏选中态、
   bounded group、重复实体列头和对象附近主操作。

Source screenshot、DOM test 或 contract validation 只证明对应层。Packaged App、
WebUI parity、clean VM、release readiness 和 owner acceptance 必须由各自 evidence
surface 单独证明。

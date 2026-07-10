# 首启设置工作台

Owner: `one-person-lab-app`
Purpose: `focused_first_run_setup_workspace`
State: `implemented_active`
Machine boundary: 本文定义 App 首启产品体验；机器真相归
`contracts/app-gui-product-contract.json`、`contracts/app-page-state-matrix.json`、
`contracts/app-first-run-test-matrix.json`、Framework initialize 输出、active shell source、
focused tests 与用户路径截图。

## 背景

旧首启页把完成百分比、三张检查卡、阻塞项、下一步、密钥表单和普通产品导航同时放在第一屏。
它能展示状态，但更像运行状态面板，不像面向首次使用者的设置流程。用户需要先解释多个重复信号，
才能找到真正要完成的模型访问配置。

2026-07-10 已批准的目标，是把首启改成一个专注的三步设置工作台。首启流程内始终隐藏普通产品导航；
配置完成后先在原位显示完成态，只有用户主动点击“进入 OPL”才恢复正常 App shell 并进入 `/guid`。

## 目标

首启第一屏只回答四个问题：

1. 当前是三步中的哪一步。
2. 已经完成了什么。
3. 现在只需要做什么。
4. 完成后从哪里进入 OPL。

页面必须保留真实启动 gate、阻塞原因、初始化阶段、后台维护和诊断能力，但技术信息默认折叠。

## 桌面布局

- 使用全视口 `focused_setup_workspace`，覆盖普通 Titlebar、Sider 和会话历史区。
- 顶部是精简品牌栏，只显示 One Person Lab 品牌与帮助入口。
- macOS 品牌栏保留 traffic lights 安全区；Windows/Linux 复用现有最小化、最大化和关闭按钮。
- 主工作区最大宽度约 1040px，采用 `240px + 1fr` 两栏。
- 左侧固定三步：工作目录、本机助手、模型访问。
- 左侧只显示步骤状态和 `已完成数 / 总数`，不显示百分比。
- 右侧一次只承载当前任务；检查中、需要配置、失败和完成在同一位置原位替换。
- 技术详情在工作区下方折叠，帮助入口可以打开该折叠区。

普通导航在用户主动进入 `/guid` 之前不可见，包括 `ready_to_launch` 已成立但仍停留在完成态时。
背景 shell 同时必须设置 `inert` 和 `aria-hidden`，首焦点留在 FirstRun；卸载首启页时恢复原属性。
首启页不得把新会话、搜索、定时任务、运行状态、设置或空会话历史作为首次配置的视觉或交互竞争项。

## 模型访问

模型访问是唯一需要用户输入的常见首启步骤，提供两条真实路径：

- `OPL Gateway`：输入访问密钥，验证后刷新 initialize 状态。
- `已有 Codex 配置`：重新检测本机已有模型访问；检测仍未通过时保留当前页，并允许切回 Gateway。

两条路径使用分段控件切换。当前路径只能有一个主操作，不同时展示多个竞争按钮。
配置或重检请求进行中时，禁用路径切换和另一条动作，直到当前请求结束。
密钥输入必须有可见字段标签、密码显隐和“保存在本机，仅发送到已配置模型端点”的安全说明。

## 状态模型

### 检查中

- 当前步骤显示明确的检查状态。
- 右侧显示 initialize event 的用户可读标签和耗时。
- 不显示伪精确百分比，不允许进入 OPL。
- initialize payload 返回前不得显示“没有待处理项”或“可以开始使用”。

### 需要操作

- 标题直接说明当前任务。
- 多个 Core 项同时未就绪时，按固定三步顺序选择第一个未就绪项，rail active 状态与右侧任务必须一致。
- 正文解释缺少什么、为什么需要、下一步是什么。
- 错误靠近当前任务显示本地化文案；技术原文只放在技术详情，不进入 beginner toast。

### 验证中

- 主按钮原位显示 loading，防止重复提交。
- 不清空密钥，除非验证成功。

### 完成

- 右侧当前任务原位替换为完成态。
- 不显示巨大 `100%`。
- 页面只保留一个主操作：进入 OPL。
- initialize 结果不得自动跳转；只有用户点击完成态主操作才进入 `/guid`。
- 进入 `/guid` 时继续携带 `postInstallSelfCheck` route state。

## 响应式与可访问性

- 窄屏下步骤栏移动到任务面板上方，保持三步顺序和状态语义。
- 输入框、分段控件和主按钮在手机宽度下改为单列，不产生横向滚动。
- 状态必须同时使用图标和文本，不只依赖颜色。
- 交互控件触控目标不小于 44px。
- 所有交互使用 Arco 组件，保留键盘焦点与可见字段标签；可访问名称使用本地化可见文本或 `aria-labelledby`，不得使用 testid。
- initialize、模型访问和维护动作共享一个页面级请求锁；任一请求进行中时不得启动竞争动作。
- 技术详情只在首启页内展开，不提供提前离开到普通 Settings 的入口。
- 访问密钥可以保存在本机并只发送到已配置的模型端点；任何 renderer 错误和诊断在显示前必须脱敏本次提交的密钥。
- 中英文都只显示 App-owned beginner copy；raw setup fields、命令、路径和 provider 细节默认隐藏。

## 不做的事

- 不改变 `ready_to_launch` 语义和 Core required items。
- 不让 full readiness 或后台维护阻塞进入 `/guid`。
- 不增加新的 runtime、provider 或配置真相源。
- 不修改 AionUI 通用 Layout/Sider fork body；专注模式由 OPL FirstRun overlay 实现。
- 不引入新 UI 依赖、插画、渐变、玻璃效果或营销式首屏。

## 验收

完成需要同时具备：

- App 合同和 page-state matrix 校验通过。
- first-run test matrix 覆盖专注模式、三步栏、无百分比和两条访问路径。
- active shell DOM 测试覆盖 initialize pending、Gateway 配置、已有 Codex 重检、完成态和技术详情。
- i18n、TypeScript 与 package build 通过。
- 桌面与窄屏截图证明普通导航被遮蔽、文本无溢出、主操作清晰、状态切换不造成结构跳动。

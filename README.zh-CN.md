<p align="center">
  <img src="assets/branding/opl-banner.png" alt="One Person Lab App banner" width="100%" />
</p>

<p align="center">
  <a href="./README.md">English</a> | <a href="./README.zh-CN.md"><strong>中文</strong></a>
</p>

<h1 align="center">One Person Lab App</h1>

<p align="center"><strong>面向复杂知识工作的 chat-first 桌面 AI 应用</strong></p>
<p align="center">从一个应用进入研究、基金、汇报和通用任务，查看进度、继续长任务、检查交付物</p>

<!--
Owner: `one-person-lab-app`
Purpose: `public_app_entry_zh_cn`
State: `active_public_entry`
Machine boundary: 人读产品入口。机器真相在 `contracts/`、源码、release artifacts、updater metadata、validation outputs，以及 App 消费的 OPL Framework/domain projections。
-->

<p align="center">
  <img src="assets/branding/opl-app-product-map.png" alt="One Person Lab App 产品打包关系图" width="100%" />
</p>

## 为什么需要它

AI 已经很擅长回答问题和生成内容，但当工作变成一篇论文、一个基金本子、一套汇报材料或一个长期项目时，用户真正关心的是：

- 从哪里开始，下一步该做什么？
- 之前跑过的任务进展到哪一步了？
- 生成了哪些文件，哪些还需要检查？
- 后台任务是否还在运行，失败时卡在哪里？
- 研究、基金、汇报这些专业 Agent 能不能放在一个统一入口里使用？

**One Person Lab App 就是这个入口。** 它把 One Person Lab、专业 Agent 和常用工具打包成桌面应用，让用户用一个界面进入复杂知识工作。

它不是把研究、基金、汇报压成一排按钮，而是把“开始、继续、查看进度、打开文件、处理阻塞”放到同一个产品里。用户不用关心背后是哪一个专业 Agent 在工作，只需要看到当前任务做到哪一步、生成了什么、还缺什么、下一步怎么继续。

## 核心亮点

**一个入口进入多类专业 AI 工作**<br/>
从桌面应用进入通用工作、医学研究、基金写作和汇报材料准备，不需要在多个命令、仓库和工具之间切换。

**看得见长任务进度**<br/>
应用展示任务进展、文件、运行状态和可继续的上下文。用户回来时可以直接看到做到了哪一步、有哪些结果、是否需要人工处理。

**把首次安装做成产品体验**<br/>
macOS 新用户可以使用完整首次安装包，先打开 App，再让后台继续准备框架、专业 Agent、技能和工具载荷。

**专业 Agent 保持清晰分工**<br/>
Research Foundry、Grant Foundry、Presentation Foundry 面向不同类型成果。用户看到统一入口，背后仍保留各自专业判断和交付边界。

**让专业 AI 保持专业空间**<br/>
App 负责把入口、进度、文件和交付体验做好；医学研究、基金写作和视觉交付的具体判断，仍交给对应专业 Agent 完成。当任务进入专业阶段时，用户可以看到 AI 读资料、比较方案、接受审阅、继续修订并形成下一版交付物。

**适合从日常使用走向长期托管**<br/>
它不只服务一次对话，也面向需要多轮推进、后台维护、失败恢复和持续交付的工作。

## 下载与安装

### Homebrew

已经使用 Homebrew 的 macOS arm64 用户，可以走最短终端路径：

```bash
brew tap gaofeng21cn/one-person-lab
brew install --cask one-person-lab
open -a "One Person Lab"
```

Nightly 构建需要显式选择：

```bash
brew install --cask one-person-lab-nightly
```

需要完整首次安装载荷时：

```bash
brew install --cask one-person-lab-full
open -a "One Person Lab"
```

更新使用标准 Homebrew 流程：

```bash
brew update
brew upgrade --cask one-person-lab
```

Homebrew 是 App cask 分发路径。安装后打开 `One Person Lab.app`；首次启动使用共享的 App 设置流程，然后由 App 在后台继续所需维护。如果 App 提示需要设置或修复，按应用内提示操作。需要终端诊断时，可以运行：

```bash
opl system initialize --json
```

希望通过 Homebrew 一次拿到完整首次安装包时，使用
`one-person-lab-full`。release channel、updater、Full package 和 macOS trust
细节由
[App release guide](docs/delivery/release/README.md) 与 App contracts 维护。

### 一键安装

macOS 用户也可以使用一键安装入口。它会准备 One Person Lab 运行环境，并安装或打开桌面应用：

```bash
curl -fsSL https://raw.githubusercontent.com/gaofeng21cn/one-person-lab-app/main/install.sh | bash
```

该入口使用同一套 App-first 设置模型，让全新 Mac 可以先打开 App，Git-backed 维护随后继续处理。需要从终端执行完整框架/模块安装时，可显式追加 `--complete`。

不使用 Homebrew 的稳定版 macOS 用户，可以使用稳定版安装助手：

```bash
curl -fsSL https://raw.githubusercontent.com/gaofeng21cn/one-person-lab-app/main/install-stable.sh | bash
```

macOS trust 诊断和内部版本处理细节留在 release guide，不放在公开入口里重复维护。

### 直接下载

也可以从发布页下载当前桌面包：

[下载 One Person Lab App](https://github.com/gaofeng21cn/one-person-lab-app/releases/latest)

没有 Homebrew 的 macOS arm64 新用户优先选择
`One-Person-Lab-Full-<version>-mac-arm64.dmg`。同一完整首次安装包也可以通过
`one-person-lab-full` Homebrew cask 安装。

macOS 可以通过 DMG、一键安装、Homebrew 或 Docker/WebUI 安装。首次启动图文教程以
[macOS App install user guide](docs/public/macos-app-install/index.html)
为主入口；同一份 guide 也提供
[可转发 PDF](docs/public/macos-app-install/macos-app-install-slides.pdf)、
[可转发 PPTX](docs/public/macos-app-install/macos-app-install-slides.pptx) 和
[detailed PDF](docs/public/macos-app-install/macos-app-install-detailed-guide.pdf)。

日常更新由 Homebrew 或应用内更新通道完成，取决于安装方式。release asset、updater metadata 和 Full first-install 边界由 App release guide 与 contracts 维护。

Linux、Windows 或服务器用户默认使用 Docker/WebUI，请从
[Docker/WebUI install guide](docs/public/docker-webui-install/index.html) 开始；同一份
guide 也提供
[detailed PDF](docs/public/docker-webui-install/docker-webui-install-detailed-guide.pdf)。

## 应用能做什么

One Person Lab App 是面向用户的日常 chat-first 桌面入口：

- 从一个桌面界面进入通用工作、医学研究、基金写作和汇报材料准备。
- 提供研究工坊、基金工坊、汇报工坊入口。
- 展示进度、文件、运行状态和可恢复的工作上下文，帮助用户继续长任务和检查交付物。
- 首次启动先完成最基本的可用准备，再让更完整的运行环境和专业 Agent 载荷在后台维护。
- 通过 Homebrew、直接下载或完整首次安装包提供安装和更新路径。
- 把 One Person Lab 和领域智能体呈现为可直接使用的产品体验。

## 用户路径

1. 从发布页下载应用包。
2. 打开 `One Person Lab.app`。
3. 让首次启动完成基础设置；界面会显示准备进度和下一步。
4. 选择工作目录。
5. 开始通用工作，或进入研究工坊、基金工坊、汇报工坊。
6. 通过进度、文件和运行状态视图继续任务、检查交付物。

## 产品边界

One Person Lab App 负责桌面产品体验：打包、发布、更新、首次启动、界面状态、截图和用户文档。它证明的是用户能否顺利安装、打开、进入任务、查看进度和处理文件；医学研究、基金写作和视觉交付是否合格，仍由对应专业 Agent 和人工决策来判断。

App 决定用户看到的安装形态、默认入口、首次启动体验和设置界面。One Person Lab Framework 提供背后的运行、初始化和进度数据，MAS、MAG、RCA 承载各自专业判断和交付物。App 只负责把这些能力呈现为用户能使用的桌面产品体验，不替专业 Agent 做领域判断。

GUI 产品事实也由 App 仓维护。当前 GUI 主线是基于 AionUI 的 OPL 品牌壳；Hermes Desktop / `hermes-codex` 是唯一前台备选。`agui-codex`、PilotDeck 等只作为已归档技术验证或参考材料，不再作为日常实现、默认验证或抛光路线；真正进入产品的界面、默认行为和发布体验，以 App 仓的产品文档、合同和验证结果为准。

需要框架、运行时和合同信息时，请进入 [`gaofeng21cn/one-person-lab`](https://github.com/gaofeng21cn/one-person-lab)。

## 技术入口

<details>
  <summary><strong>展开开发者与发布说明</strong></summary>

### 仓库结构

```text
one-person-lab-app/
  assets/               应用首页和产品视觉资产
  docs/                 应用产品、发布、测试、截图和用户文档
  contracts/            应用层机器可读合同
  scripts/              应用层验证和发布包装脚本
  shells/
    aionui/             gaofeng21cn/opl-aion-shell 的外部检出目录
```

`shells/aionui/` 不纳入本仓跟踪。构建和验证时从 `gaofeng21cn/opl-aion-shell` 检出，AionUI 历史和贡献者记录保留在独立 shell 仓库中。Hermes Desktop / `hermes-codex` 作为唯一前台备选也遵循外部检出规则。`shells/agui-codex/` 只保留到 `gaofeng21cn/opl-agui-codex-shell` 的已归档技术验证链接；除非明确要求 AGUI replay，不再默认更新、完善或抛光。

### 常用验证命令

```bash
npm run ensure:shell
bun install --cwd shells/aionui --frozen-lockfile
bun run validate:active-shell
npm run validate:gui-shell
bun run i18n:types
bun run test
bun run build-mac
```

发布资产归一化和验证从应用根目录暴露：

```bash
bun run prepare-release-assets -- build-artifacts release-assets
bun run validate-release -- release-assets
```

当前活动界面由 [`contracts/app-shell-adapter.json`](contracts/app-shell-adapter.json) 声明：

- 活动界面：`aionui`
- 界面目录：`shells/aionui`
- 运行桥接合同：`contracts/app-runtime-bridge.json`
- 上游家族：`AionUI`
- 界面来源：`gaofeng21cn/opl-aion-shell`
- 历史策略：外部检出，不合并进 App 默认分支

不改变默认发布 adapter 的情况下，可以显式选择 Hermes Desktop 备选：

```bash
OPL_APP_SHELL_ADAPTER_CONTRACT=contracts/shell-adapters/hermes-codex.json npm run package
```

已归档 AGUI 技术验证只在明确要求 AGUI replay 时回放，不属于正常 GUI 开发路径：

```bash
OPL_APP_SHELL_ADAPTER_CONTRACT=contracts/shell-adapters/agui-codex.json npm run package
```

显式回放 package validation 要求 manifest 声明 `candidate_app_bundle_ready`、`explicit_candidate_app_bundle`，以及相对路径形式的 `.app` bundle；该 bundle 必须包含 `Contents/Info.plist` 和 `Contents/MacOS` 可执行文件。纯文本 smoke artifact 不算可回放 App package。

当前迁移与发布状态见 [`docs/status.md`](docs/status.md)。

### 产品与安装合同

App 产品默认策略由
[`contracts/app-product-profile.json`](contracts/app-product-profile.json)
声明。安装与 Codex 可见暴露策略由
[`contracts/app-install-exposure-policy.json`](contracts/app-install-exposure-policy.json)
声明，运行桥接策略由
[`contracts/app-runtime-bridge.json`](contracts/app-runtime-bridge.json)
声明，release channel 策略由
[`contracts/app-release-channel.json`](contracts/app-release-channel.json)
声明。这些 contracts 维护用户可见安装面、standard 与 Full package 边界、
updater 可见性、Homebrew cask policy、运行状态页桥接行为、App 管理的
skill/plugin 暴露和 release validation gates。

OPL Framework 仍生产 install/sync/read-model surfaces、runtime state 和 action
execution。MAS/MAG/RCA/OMA 继续持有 domain skill semantics、quality/export
judgment、artifact authority 和 owner receipts。发布脚本会在打包前把 App-owned
product contracts 同步到活动 shell，让 shell 消费 App truth，而不是定义 App
truth。

当前 release 操作、Full package policy、macOS trust 诊断、updater metadata 和 evidence
gates 见 [App release guide](docs/delivery/release/README.md)。当前 App 产品状态和剩余
gap 见 [`docs/status.md`](docs/status.md) 与
[`docs/active/app-ideal-state-gap-plan.md`](docs/active/app-ideal-state-gap-plan.md)。

GUI 定义栈按顺序阅读：[`docs/product/gui/ideal-interaction-spec.md`](docs/product/gui/ideal-interaction-spec.md) 定义不绑定具体 shell 的理想交互形态，[`docs/product/gui/codex-to-opl-app-delta.md`](docs/product/gui/codex-to-opl-app-delta.md) 定义 Codex App 变成 OPL App 需要追加、隐藏和治理的产品增量，[`docs/product/gui/feature-inventory.md`](docs/product/gui/feature-inventory.md) 维护跨 shell 的能力清单。后续设计或评审 GUI 时先看这三份，再看 contracts 和 page-state 矩阵；AionUI 是当前实现主线，Hermes Desktop / `hermes-codex` 是唯一前台备选，`agui-codex` 和 PilotDeck 只提供已归档技术验证或参考材料，不能反过来定义 OPL App 产品事实。

### Agent / Framework Boundary

- App 展示 OPL route 和 progress projection 给出的下一步、阻塞、文件和状态，但不把它们当成 MAS/MAG/RCA 的领域裁决。
- Foundry Agents 的具体工作仍发生在各自 stage attempt 内部；App 不规定专业 Agent 必须按什么工具顺序思考或创作。
- 工具和技能入口对 App 来说是可用能力目录；权限、凭据、可写范围和质量裁决仍由 Framework 与 domain agent 的合同和回执约束。

</details>

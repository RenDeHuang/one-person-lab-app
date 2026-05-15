<p align="center">
  <img src="assets/branding/opl-banner.png" alt="One Person Lab App banner" width="100%" />
</p>

<p align="center">
  <a href="./README.md">English</a> | <a href="./README.zh-CN.md"><strong>中文</strong></a>
</p>

<h1 align="center">One Person Lab App</h1>

<p align="center"><strong>One Person Lab 的桌面工作台</strong></p>
<p align="center">把 One Person Lab、领域智能体和配套工具打包到一个应用里，用统一界面进入研究、基金、汇报和通用知识工作</p>

<p align="center">
  <img src="assets/branding/opl-app-product-map.png" alt="One Person Lab App 产品打包关系图" width="100%" />
</p>

## 下载与安装

macOS 用户可以使用一键安装入口。它会准备 One Person Lab 运行环境，并安装或打开桌面应用：

```bash
curl -fsSL https://raw.githubusercontent.com/gaofeng21cn/one-person-lab-app/main/install.sh | bash
```

也可以从发布页下载当前桌面包：

[下载 One Person Lab App](https://github.com/gaofeng21cn/one-person-lab-app/releases/latest)

macOS arm64 新用户优先选择 `One-Person-Lab-Full-<version>-mac-arm64.dmg`。完整首次安装包包含桌面应用、One Person Lab、研究/基金/汇报智能体、当前运行载荷、`officecli` 和推荐技能载荷。

日常更新由应用内更新通道完成。发布页保留标准应用包和更新元数据，完整首次安装包作为独立安装资产发布。

Docker 或服务器部署请参考 [Docker/WebUI 安装说明](https://github.com/gaofeng21cn/one-person-lab/blob/main/docs/references/current-support/opl-docker-webui-deployment.md)。

## 应用能做什么

One Person Lab App 是面向用户的日常工作台：

- 从一个桌面界面进入通用工作、医学研究、基金写作和汇报材料准备。
- 提供研究工坊、基金工坊、汇报工坊入口。
- 展示进度、文件、运行状态和可恢复的工作上下文，帮助用户继续长任务和检查交付物。
- 首次启动时检查本机环境、框架依赖、领域模块、配套工具和包就绪状态。
- 把 One Person Lab 和领域智能体呈现为可直接使用的产品体验。

## 用户路径

1. 从发布页下载应用包。
2. 打开 `One Person Lab.app`。
3. 让首次启动检查本机环境、框架依赖和领域模块。
4. 选择工作目录。
5. 开始通用工作，或进入研究工坊、基金工坊、汇报工坊。
6. 通过进度、文件和运行状态视图继续任务、检查交付物。

## 产品边界

One Person Lab App 负责桌面产品体验：打包、发布资产、更新元数据、首次启动检查、界面状态测试、截图和用户文档。

One Person Lab 提供命令行、激活、阶段控制、运行时提供者、队列、合同、模块发现、技能同步、运行快照和进度投影。MAS、MAG、RCA 承载各自领域的专业判断、质量裁决、阶段语义和交付物。

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

`shells/aionui/` 不纳入本仓跟踪。构建和验证时从 `gaofeng21cn/opl-aion-shell` 检出，AionUI 历史和贡献者记录保留在独立 shell 仓库中。

### 常用验证命令

```bash
npm run ensure:shell
bun install --cwd shells/aionui --frozen-lockfile
bun run validate:active-shell
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
- 上游家族：`AionUI`
- 界面来源：`gaofeng21cn/opl-aion-shell`
- 历史策略：外部检出，不合并进 App 默认分支

当前迁移与发布状态见 [`docs/status.md`](docs/status.md)。

</details>

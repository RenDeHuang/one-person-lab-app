# One Person Lab App 首次安装图文教程

Owner: `one-person-lab-app`
Purpose: `macos_app_install_user_guide_pdf_source`
State: `active`
Machine boundary: Human-readable user guide. Release contracts, workflows, VM smoke artifacts, screenshot manifest, and App release metadata remain the machine truth.

适用对象：医生、PI、课题负责人；不要求计算机基础。本文以 macOS App 首次启动为主线，说明如何下载、安装、配置 One Person Lab，并从科研、基金、演示或写书入口开始工作；下文以 Research Foundry / Med Auto Science 的首次科研任务为例。

下载最新版本：https://github.com/gaofeng21cn/one-person-lab-app/releases/latest

> 涉及访问权限配置时，请联系 gflabtoken 管理员获取访问密钥。不要自行购买、复制来源不明的密钥，或把密钥写入研究数据目录。

## 准备清单

- 一台 Apple Silicon Mac 或可运行 macOS App 的 Mac。
- 稳定网络，用于下载 One Person Lab 和完成首次环境检查。
- gflabtoken 开通状态；涉及访问权限时请联系 gflabtoken 管理员获取访问密钥。
- 本地研究数据文件夹，数据需完成脱敏并符合本机构数据管理要求。
- 变量说明、纳排标准、终点定义、统计计划、参考文献或已有草稿；可以先放入专病 workspace 的 `raw_data/`。

## 1. 下载 One Person Lab

访问 One Person Lab App 最新 Release 页面，下载 macOS Apple Silicon DMG。首次安装或干净机器建议选择 Full 版 DMG。

![1. 下载 One Person Lab](assets/01-download-release.png)

- 最新版本页面：https://github.com/gaofeng21cn/one-person-lab-app/releases/latest
- 最简单的稳定版安装命令：`curl -fsSL https://raw.githubusercontent.com/gaofeng21cn/one-person-lab-app/main/install.sh | bash -s -- --stable-macos-install --yes`。
- 稳定安装器默认下载 latest Full DMG、复制到 Applications，并尽量清理 macOS quarantine，减少首次启动时反复授权；需要轻量标准包时可追加 `--standard`。
- Full 版 DMG 是首次安装资产，包含 OPL Framework runtime、MAS/MAG/RCA、officecli、mineru-open-api 与推荐 skills 等 payload。
- 标准 mac-arm64 DMG 体积更小，适合已经安装过 One Person Lab App 的用户和后续自动更新。

## 2. 安装 App

打开 DMG，将 One Person Lab 拖入 Applications。首次打开如出现 macOS 安全提示，按系统提示确认。

![2. 安装 App](assets/02-install-dmg.png)

- 安装完成后从 Applications 启动 App。
- 不要长期在 DMG 挂载窗口内运行 App。

## 3. 配置访问权限

首次启动如果提示访问权限未配置，请联系 gflabtoken 管理员获取访问密钥，并在首启页面完成配置。

![3. 配置访问权限](assets/03-codex-config-needed.png)

- 管理员开通后，在页面输入访问密钥并点击完成配置。
- 不要把密钥截图、转发或写入研究数据目录。

## 4. 等待首次环境检查

OPL 会先检查开始使用所需的关键项：工作目录、本机助手和访问权限。首屏只显示“正在准备 / 可以开始 / 需要处理”的简短状态、三步准备进度、下一步，以及进入 OPL 的主按钮。

![4. 等待首次环境检查](assets/04-first-run-checking.png)

- 首启准备可能需要几分钟，进度来自 OPL 底层初始化状态；App 只负责展示，不单独维护另一套安装进度。
- 模块、skills、运行底座和本机工具属于后台维护；技术 phase、刷新、运行时设置、原始错误和维护动作默认收在“技术细节”里，不会把新手停在 Homebrew、Node、Git 或命令行工具清单上。
- 遇到阻塞时先阅读界面提示，再联系技术支持处理。

## 5. 进入科研入口

准备完成后，根据目标选择科研、基金、演示或写书入口。本教程以科研入口为例，进入 Research Foundry / Med Auto Science 工作流。

![5. 进入科研入口](assets/05-opl-ready-research-entry.png)

- MAS 通过 OPL 内的 Research Foundry / Med Auto Science 入口使用。
- 基金、演示和写书入口分别对应 MAG、RCA 和 BookForge。
- 用户不需要另行获取这些专业 Agent 的分发资产。

## 6. 确认工作目录和运行设置

在本机运行环境中确认工作目录、Codex CLI、Temporal 和本机基础状态；在智能体与能力查看专业入口；在关于与更新查看 App 与 OPL Packages 维护状态。需要调整数据目录或运行设置时，从这里进入。

![6. 确认工作目录和运行设置](assets/06-research-data-folder.png)

- 建议按一个病种或稳定研究主题建立本地 workspace，再把原始或脱敏材料集中放入工作目录。
- 患者数据需先脱敏，并遵守本机构数据管理要求。

## 7. 发起首次科研任务

第一条任务可直接用自然语言描述，让 MAS 先判断研究方向、证据缺口和下一步。

![7. 发起首次科研任务](assets/07-first-research-entry.png)

- 示例提示词：我有一批肺结节随访数据，专病 workspace 在“肺结节真实世界研究”，原始材料在 raw_data/，请先判断最值得推进的研究问题，并说明还缺哪些证据，目标是形成一篇可投稿论文。

## 8. 查看进度与结果

任务启动后，重点查看当前阶段、阻塞项、下一步和产物位置。

![8. 查看进度与结果](assets/08-opl-runtime-status.png)

- 看到需要人工确认的项目时，由研究者或 PI 判断是否继续。
- 投稿前最终科学判断、伦理合规和署名安排仍由研究团队负责。

## 常见问题

- 下载失败：换网络后重试，或请技术支持人员确认 GitHub Release 是否可访问。
- 打不开 App：优先使用稳定安装命令重新安装；手动安装时确认已拖入 Applications，并按 macOS 安全提示允许打开。
- 访问权限未配置：联系 gflabtoken 管理员获取访问密钥，并在首启页面完成配置。
- 模块未就绪：在 App 的本机运行环境或关于与更新中重新检查维护状态，确认 OPL 完整安装资产与本机网络状态。
- 数据路径看不到：确认选择的是本机可访问的专病 workspace，或能看到其中的 `raw_data/`。
- 任务启动后不知道看哪里：查看运行状态页的当前阶段、下一步和需要人工确认的项目。

## 截图与验证来源

- 截图主要来自 v26.6.27 的中文 1080p VM guide artifact 与同一次 VM smoke 的 App CDP 截图；本机运行环境截图来自修复后的 `runtime-environment-currentness.fixture.json` 渲染，用于替换旧 VM artifact 中 stale packaged-runtime 导致的“未知”模块状态。PNG 保留各自原始输出尺寸，不做统一画布要求。当前文案按 App contracts、安装脚本和最新 Release 面重新核对；截图只作为首启流程示意，不作为最新版本发布证据。
- VM smoke 使用真实 DMG 安装到 `/Applications/One Person Lab.app`；标准版验证 GUID 输入页、Settings 和 MAS/MAG/RCA 入口可用。首启截图和 layout gate 会验证新手首屏保持简化，技术细节默认折叠。
- 每张截图的来源、尺寸和 SHA256 记录在 `macos-app-install-assets.json` 与生成后的 verification JSON 中。
- Release、DMG、首启日志和模块状态以 App repo contracts / workflow / VM smoke artifacts 为机器真相。

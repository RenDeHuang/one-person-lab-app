---
marp: true
theme: opl-guide
size: 16:9
paginate: false
title: "One Person Lab App 首次安装图文教程"
description: "按下载安装、首次配置、环境检查、科研入口和进度查看的顺序演示。"
author: "one-person-lab-app"
---

<!-- _class: cover -->
<div class="brand"><strong>One Person Lab App</strong><span>macOS 首次安装与首启</span></div>

<div class="cover-copy">
  <h1>One Person Lab App 首次安装图文教程</h1>
  <p class="lede">按下载安装、首次配置、环境检查、科研入口和进度查看的顺序演示。</p>
  <div class="command">curl -fsSL <a href="https://raw.githubusercontent.com/gaofeng21cn/one-person-lab-app/main/install.sh">https://raw.githubusercontent.com/gaofeng21cn/one-person-lab-app/main/install.sh</a> | bash -s -- --stable-macos-install --yes</div>
  <div class="checklist"><ul><li>一台 Apple Silicon Mac 或可运行 macOS App 的 Mac。</li>
<li>稳定网络，用于下载 One Person Lab 和完成首次环境检查。</li>
<li>gflabtoken 开通状态；涉及访问权限时请联系 gflabtoken 管理员获取访问密钥。</li>
<li>本地研究数据文件夹，数据需完成脱敏并符合本机构数据管理要求。</li></ul></div>
</div>

<figure class="cover-shot">
  <img src="../assets/05-opl-ready-research-entry.png" alt="按下载安装、首次配置、环境检查、科研入口和进度查看的顺序演示。" />
</figure>

<div class="footer"><span>中文 1080p VM 截图 · v26.6.27</span><span>1 / 10</span></div>

<!--
本教程用于 macOS App 首次安装和首启说明。截图来自 v26.6.27 的中文 1080p VM guide artifact 与同一次 VM smoke 的 App CDP 截图。
-->

---

<!-- _class: step -->
<div class="brand"><strong>One Person Lab App</strong><span>macOS 首次安装与首启</span></div>

<header class="step-title">
  <h1>1. 下载 One Person Lab</h1>
  <p>从 App repo 的最新 Release 下载 macOS Apple Silicon DMG。</p>
</header>

<main class="step-layout">
  <figure class="shot-frame">
    <img src="../assets/01-download-release.png" alt="1. 下载 One Person Lab" />
  </figure>
  <aside class="focus">
    <h2>本页重点</h2>
    <ul><li>从 GitHub Releases latest 页面下载。</li>
<li>最简单命令：install.sh --stable-macos-install --yes。</li>
<li>首次安装建议使用 Full 版 DMG。</li>
<li>需要轻量 App 包时可显式选择标准 DMG。</li></ul>
  </aside>
</main>

<p class="body-line">访问 One Person Lab App 最新 Release 页面，下载 macOS Apple Silicon DMG。首次安装或干净机器建议选择 Full 版 DMG。</p>
<div class="footer"><span class="source-line">截图来自 v26.6.27；PNG 保留原始 VM/CDP 尺寸。</span><span>2 / 10</span></div>

<!--
最简单的稳定版安装命令：curl -fsSL https://raw.githubusercontent.com/gaofeng21cn/one-person-lab-app/main/install.sh | bash -s -- --stable-macos-install --yes。也可以打开 One Person Lab App 最新 Release 页面下载 DMG。
-->

---

<!-- _class: step -->
<div class="brand"><strong>One Person Lab App</strong><span>macOS 首次安装与首启</span></div>

<header class="step-title">
  <h1>2. 安装 App</h1>
  <p>打开 DMG，把 One Person Lab 拖入 Applications。</p>
</header>

<main class="step-layout">
  <figure class="shot-frame">
    <img src="../assets/02-install-dmg.png" alt="2. 安装 App" />
  </figure>
  <aside class="focus">
    <h2>本页重点</h2>
    <ul><li>安装完成后从 Applications 启动。</li>
<li>不要长期在 DMG 挂载窗口中运行 App。</li></ul>
  </aside>
</main>

<p class="body-line">打开 DMG，将 One Person Lab 拖入 Applications。首次打开如出现 macOS 安全提示，按系统提示确认。</p>
<div class="footer"><span class="source-line">截图来自 v26.6.27；PNG 保留原始 VM/CDP 尺寸。</span><span>3 / 10</span></div>

<!--
打开下载的 DMG，将 One Person Lab.app 拖入 Applications。首次打开如出现 macOS 安全提示，按系统提示确认。
-->

---

<!-- _class: step -->
<div class="brand"><strong>One Person Lab App</strong><span>macOS 首次安装与首启</span></div>

<header class="step-title">
  <h1>3. 配置访问权限</h1>
  <p>如果首启页面提示访问权限未配置，请联系 gflabtoken 管理员获取访问密钥。</p>
</header>

<main class="step-layout">
  <figure class="shot-frame">
    <img src="../assets/03-codex-config-needed.png" alt="3. 配置访问权限" />
  </figure>
  <aside class="focus">
    <h2>本页重点</h2>
    <ul><li>管理员开通后，在页面输入访问密钥。</li>
<li>点击完成配置后继续首启检查。</li>
<li>不要截图、转发或保存密钥到研究目录。</li></ul>
  </aside>
</main>

<p class="body-line">首次启动如果提示访问权限未配置，请联系 gflabtoken 管理员获取访问密钥，并在首启页面完成配置。</p>
<div class="footer"><span class="source-line">截图来自 v26.6.27；PNG 保留原始 VM/CDP 尺寸。</span><span>4 / 10</span></div>

<!--
涉及访问权限配置时，请联系 gflabtoken 管理员获取访问密钥。不要自行购买、复制来源不明的密钥，或把密钥写入研究数据目录。
-->

---

<!-- _class: step -->
<div class="brand"><strong>One Person Lab App</strong><span>macOS 首次安装与首启</span></div>

<header class="step-title">
  <h1>4. 等待首次环境检查</h1>
  <p>首屏只显示准备状态、三步进度、下一步和进入 OPL 的主按钮。</p>
</header>

<main class="step-layout">
  <figure class="shot-frame">
    <img src="../assets/04-first-run-checking.png" alt="4. 等待首次环境检查" />
  </figure>
  <aside class="focus">
    <h2>本页重点</h2>
    <ul><li>先检查工作目录、本机助手和访问权限。</li>
<li>技术 phase、刷新和原始错误默认收在技术细节里。</li>
<li>遇到阻塞时先阅读界面提示。</li></ul>
  </aside>
</main>

<p class="body-line">OPL 会先检查开始使用所需的关键项：工作目录、本机助手和访问权限。首屏只显示“正在准备 / 可以开始 / 需要处理”的简短状态、三步准备进度、下一步，以及进入 OPL 的主按钮。</p>
<div class="footer"><span class="source-line">截图来自 v26.6.27；PNG 保留原始 VM/CDP 尺寸。</span><span>5 / 10</span></div>

<!--
OPL 会先检查开始使用所需的关键项：工作目录、本机助手和访问权限。首屏只显示“正在准备 / 可以开始 / 需要处理”的简短状态、三步准备进度、下一步，以及进入 OPL 的主按钮。模块、skills、运行底座和本机工具属于后台维护，技术细节默认折叠。
-->

---

<!-- _class: step -->
<div class="brand"><strong>One Person Lab App</strong><span>macOS 首次安装与首启</span></div>

<header class="step-title">
  <h1>5. 进入科研入口</h1>
  <p>准备完成后，在主界面选择科研、基金、演示或写书入口。</p>
</header>

<main class="step-layout">
  <figure class="shot-frame">
    <img src="../assets/05-opl-ready-research-entry.png" alt="5. 进入科研入口" />
  </figure>
  <aside class="focus">
    <h2>本页重点</h2>
    <ul><li>通过 Research Foundry / Med Auto Science 进入 MAS。</li>
<li>基金、演示和写书入口分别对应 MAG、RCA 和 BookForge。</li>
<li>用户不需要另行获取这些专业 Agent 的分发资产。</li></ul>
  </aside>
</main>

<p class="body-line">准备完成后，根据目标选择科研、基金、演示或写书入口。本教程以科研入口为例，进入 Research Foundry / Med Auto Science 工作流。</p>
<div class="footer"><span class="source-line">截图来自 v26.6.27；PNG 保留原始 VM/CDP 尺寸。</span><span>6 / 10</span></div>

<!--
准备完成后，在主界面选择科研、基金、演示或写书入口。本教程以 Research Foundry / Med Auto Science 为例，MAS 通过 OPL 内的入口使用。
-->

---

<!-- _class: step -->
<div class="brand"><strong>One Person Lab App</strong><span>macOS 首次安装与首启</span></div>

<header class="step-title">
  <h1>6. 确认工作目录和运行设置</h1>
  <p>在本机运行环境、智能体与能力、关于与更新中确认工作目录、Codex CLI、Temporal、更新状态和智能体模块。</p>
</header>

<main class="step-layout">
  <figure class="shot-frame">
    <img src="../assets/06-research-data-folder.png" alt="6. 确认工作目录和运行设置" />
  </figure>
  <aside class="focus">
    <h2>本页重点</h2>
    <ul><li>数据目录和运行入口从 Settings 的本机运行环境进入。</li>
<li>专业 Agent 能力在智能体与能力中查看。</li>
<li>App 与 OPL Packages 维护状态在关于与更新中查看。</li>
<li>患者数据需先脱敏，并遵守机构要求。</li></ul>
  </aside>
</main>

<p class="body-line">在本机运行环境中确认工作目录、Codex CLI、Temporal 和本机基础状态；在智能体与能力查看专业入口；在关于与更新查看 App 与 OPL Packages 维护状态。需要调整数据目录或运行设置时，从这里进入。</p>
<div class="footer"><span class="source-line">截图来自 v26.6.27；PNG 保留原始 VM/CDP 尺寸。</span><span>7 / 10</span></div>

<!--
在本机运行环境中确认工作目录、Codex CLI、Temporal 和本机基础状态；在智能体与能力查看专业入口；在关于与更新查看 App 与 OPL Packages 维护状态。建议按一个病种或稳定研究主题建立本地 workspace，把原始或脱敏材料集中放入工作目录。
-->

---

<!-- _class: step -->
<div class="brand"><strong>One Person Lab App</strong><span>macOS 首次安装与首启</span></div>

<header class="step-title">
  <h1>7. 发起首次科研任务</h1>
  <p>用自然语言描述数据、workspace 和目标，让 MAS 先判断下一步。</p>
</header>

<main class="step-layout">
  <figure class="shot-frame">
    <img src="../assets/07-first-research-entry.png" alt="7. 发起首次科研任务" />
  </figure>
  <aside class="focus">
    <h2>本页重点</h2>
    <ul><li>写清数据类型、专病 workspace、目标产物。</li>
<li>让 MAS 先判断研究方向和证据缺口。</li></ul>
  </aside>
</main>

<p class="body-line">第一条任务可直接用自然语言描述，让 MAS 先判断研究方向、证据缺口和下一步。</p>
<div class="footer"><span class="source-line">截图来自 v26.6.27；PNG 保留原始 VM/CDP 尺寸。</span><span>8 / 10</span></div>

<!--
示例提示词：我有一批肺结节随访数据，专病 workspace 在“肺结节真实世界研究”，原始材料在 raw_data/，请先判断最值得推进的研究问题，并说明还缺哪些证据，目标是形成一篇可投稿论文。
-->

---

<!-- _class: step -->
<div class="brand"><strong>One Person Lab App</strong><span>macOS 首次安装与首启</span></div>

<header class="step-title">
  <h1>8. 查看进度与结果</h1>
  <p>任务启动后，重点查看当前阶段、阻塞项、下一步和产物位置。</p>
</header>

<main class="step-layout">
  <figure class="shot-frame">
    <img src="../assets/08-opl-runtime-status.png" alt="8. 查看进度与结果" />
  </figure>
  <aside class="focus">
    <h2>本页重点</h2>
    <ul><li>看到人工确认项时，由研究者或 PI 判断。</li>
<li>投稿前科学判断、伦理合规和署名仍由团队负责。</li></ul>
  </aside>
</main>

<p class="body-line">任务启动后，重点查看当前阶段、阻塞项、下一步和产物位置。</p>
<div class="footer"><span class="source-line">截图来自 v26.6.27；PNG 保留原始 VM/CDP 尺寸。</span><span>9 / 10</span></div>

<!--
任务启动后，重点查看当前阶段、阻塞项、下一步和产物位置。投稿前最终科学判断、伦理合规和署名安排仍由研究团队负责。
-->

---

<!-- _class: final -->
<div class="brand"><strong>One Person Lab App</strong><span>macOS 首次安装与首启</span></div>

<header class="final-title">
  <h1>常见问题与验证来源</h1>
  <p>遇到下载、权限、模块、数据路径问题时，先按界面提示和本页检查。</p>
</header>

<main class="final-grid">
  <div class="faq-list">
    <h2>常见问题</h2>
    <ul><li>下载失败：换网络后重试，或请技术支持人员确认 GitHub Release 是否可访问。</li>
<li>打不开 App：优先使用稳定安装命令重新安装；手动安装时确认已拖入 Applications，并按 macOS 安全提示允许打开。</li>
<li>访问权限未配置：联系 gflabtoken 管理员获取访问密钥，并在首启页面完成配置。</li>
<li>模块未就绪：在 App 的本机运行环境或关于与更新中重新检查维护状态，确认 OPL 完整安装资产与本机网络状态。</li></ul>
  </div>
  <div class="notes">
    <h2>验证来源</h2>
    <ul><li>截图保留各来源原始尺寸。</li>
<li>主要来源对应 v26.6.27 中文 1080p VM；本机运行环境截图由修复后的 app-state fixture 重新渲染。</li>
<li>真实 DMG 安装到 /Applications/One Person Lab.app。</li>
<li>verification JSON 记录每张图的来源和 SHA。</li></ul>
  </div>
</main>

<div class="security">涉及访问权限配置时，请联系 gflabtoken 管理员获取访问密钥。不要自行购买、复制来源不明的密钥，或把密钥写入研究数据目录。</div>
<div class="footer"><span>Release、DMG、首启日志和模块状态以 App repo contracts / workflow / VM smoke artifacts 为机器真相。</span><span>10 / 10</span></div>

<!--
截图主要来自 v26.6.27 的中文 1080p VM guide artifact 与同一次 VM smoke 的 App CDP 截图；本机运行环境截图来自修复后的 `runtime-environment-currentness.fixture.json` 渲染，用于替换旧 VM artifact 中 stale packaged-runtime 导致的“未知”模块状态。PNG 保留各自原始输出尺寸，不做统一画布要求。当前文案按 App contracts、安装脚本和最新 Release 面重新核对；截图只作为首启流程示意，不作为最新版本发布证据。 VM smoke 使用真实 DMG 安装到 `/Applications/One Person Lab.app`；标准版验证 GUID 输入页、Settings 和 MAS/MAG/RCA 入口可用。首启截图和 layout gate 会验证新手首屏保持简化，技术细节默认折叠。 每张截图的来源、尺寸和 SHA256 记录在 `macos-app-install-assets.json` 与生成后的 verification JSON 中。 Release、DMG、首启日志和模块状态以 App repo contracts / workflow / VM smoke artifacts 为机器真相。
-->

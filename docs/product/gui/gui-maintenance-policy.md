# GUI 主线升级与 Codex 视觉维护政策

Owner: `one-person-lab-app`
Purpose: `gui_upstream_and_visual_maintenance_policy`
State: `active`
Machine boundary: 机器约束归
`contracts/app-gui-product-contract.json#gui_maintenance_policy`、
`contracts/app-shell-adapter.json#upstream_intake`、App validators、Shell audit/tests
和 exact-cohort visual manifests；本文解释运维流程，不创建第二套状态。

## 结论

OPL App 同时维持两条独立轨道：

1. AionUI 只跟随正式 stable tag，通过审计和选择性吸收持续升级；
2. ChatGPT Codex 以观察时最新可验证的官方版本提供设计参考；OPL 自有 baseline 承担像素回归。

两条轨道不能互相冒充。看到新 AionUI tag 不等于已经吸收；看到新 Codex 截图不等于
自动替换产品合同；App 合同、Shell source、像素证据、package、安装与 release 继续分别
给出结论。

Reference 内部分轴：外部 Codex observation 记录观察时最新官方版本的精确身份，只用于
composition、placement、density 和 interaction 设计审查；OPL App 自有 baseline 绑定
16-scene PNG SHA、审批 receipt 和人工 verdict，用于正式像素回归。历史外部 build 不再是
active baseline，也不是下载、安装、Pixel、Release 或 Stable 前置条件。

“尽可能 1:1”解释为：对已声明 route/state、viewport、theme、locale 和 App-owned baseline
做可重复比较，并显式记录 OPL 差异。没有 exact cohort 和比较 manifest 时，不使用无范围的
“全产品 1:1”结论。

## 固定职责

- App repo 决定产品行为、OPL 保留能力、reference cohort、视觉协议和验收预算。
- Shell repo 负责 AionUI upstream audit、OPL overlay、token 映射、组件适配和 focused tests。
- AionUI upstream 提供实现材料，不覆盖 OPL Settings IA、Runtime、模型策略或 owner truth。
- ChatGPT Codex 提供 composition、交互位置和视觉参考，不提供代码、品牌、账户或产品 authority。
- AionUI/AionCore 官方能力默认继承；只有 App contract 的 `adapt`、`redirect` 或 `reject`
  可以改变 ordinary surface。OPL allowlist 不得被解释为禁用无关上游能力的通用授权。
- 上游没有且 B0/R1/U1 不要求的复杂功能默认不私有实现；只存在于 rejected、retired 或
  private legacy surface 的问题不进入主线修复。

## Codex Reference Promotion

外部 design reference policy 由
`contracts/app-gui-product-contract.json#interaction_baseline.external_design_reference` 指定；
pixel baseline 由
`contracts/app-gui-product-contract.json#interaction_baseline.pixel_baseline` 和
`contracts/app-gui-visual-reference-cohort.json` 指定。发现更新的官方 Codex build 后按最新版本
建立 observation receipt，不自动改变 OPL baseline；只有以下证据齐全才把观察转成产品 delta：

1. 官方来源、精确 product/build 和观察日期；截图按本次设计审查需要选取；
2. literal observation 与推断/OPL delta 分开记录；
3. contract delta 按 `accept/adapt/redirect/reject` 分类；
4. Runtime、Settings、双语、first-run、Agent Packages、用户触发的 canonical thread operations
   与独立的 Codex subagent event/display 轴等 protected surfaces 完成非降级复核；
5. 桌面与窄窗、light/dark、中文/英文比较 manifest 完整；
6. App GUI validator 通过。

新观察不会自动替换 OPL pixel baseline。历史观察保留为 provenance；外部 reference、
OPL baseline、Shell source、package、安装与 release 各自独立取证。

## AionUI Stable Intake

每轮 upstream 检查只接受 GitHub 正式 release：tag 必须符合 `vMAJOR.MINOR.PATCH`，且
`draft=false`、`prerelease=false`。固定顺序为：

1. 读取 release metadata 与 tag commit；
2. 计算 merge base、双方 commits、双方 changed files、overlap 和 renderer overlap；
3. 对新增 upstream surface 分类；
4. 只在 `accept` 或 `adapt` 有明确价值时建立窄 patch；
5. 运行 focused gates，再由集成 owner 运行 authoritative active-shell/release gates；
6. 回写 reviewed、absorbed、deferred 或 rejected 的精确 ref 和证据。

分类含义：

| 分类 | 处理 |
| --- | --- |
| `accept` | 直接复用，但不得改变 App authority。 |
| `adapt` | 通过 App contract/profile/bridge/overlay 复用。 |
| `redirect` | 仅保留历史重定向入口，转到 App-owned surface。 |
| `reject` | 不进入 ordinary App 行为。 |

Stable currentness 的机器权威来自 active Shell checkout 中的
`contracts/aionui-upstream-intake.json`。App 只读消费该 receipt，校验 schema、official stable
metadata、Shell package pin、implementation ancestry，以及 AionCore source/archive、managed
manifest、ACP lock 和 Codex binary 的 exact digest/source-lock/qualification 绑定。新 stable 只进入
`review_required`，网络或 API 不确定一律 fail closed，不自动 merge 或触发 release mutation。

`app-gui-product-contract.json#gui_maintenance_policy.maintenance_budgets` 中的
`v2.1.34@0fea1eb82634f3746b9ccf68507277c347fa08a3` 继续作为历史 GUI overlap 测量与维护预算基线；
它不是 stable currentness 指针，也不随 Shell receipt advance 而重写。

## Maintenance Budgets

预算基线记录在 `gui_maintenance_policy.maintenance_budgets`。Shell audit 默认比较：

- overlap files 与 renderer overlap files 不得无审阅增长；
- Codex overlay 的 `!important` declarations 与 selector blocks 不得无授权增长；
- token bridge 与 component adapter 分开计数，新增视觉值优先落 token；
- 预算失败表示必须人工分类或重设基线，不自动触发 merge/rebase。

数值基线绑定 exact Shell ref 与 upstream tag。更新基线必须同时记录原因、影响文件、分类和
focused evidence，不能只把阈值调大让 gate 变绿。

## Visual Comparison Protocol

比较 manifest 至少绑定：OPL reference baseline ID、approval receipt SHA、App contract ref、Shell commit、
package 或 dev build identity、OS、架构、display scale、viewport、theme、locale、route/state、
reference/candidate screenshot SHA-256。

Approved baseline 的 reference 目录必须包含 `baseline-approval-receipt.json`；cohort 中的
receipt SHA-256 必须匹配该文件 bytes。Receipt 绑定 reviewer、reviewed-at、
`human_visual_review`、总 `accepted` verdict，以及全部 16 个 scene 的 canonical PNG 名称、
SHA-256 和逐场景 verdict。缺失、伪造、scene 不完整或批准后 PNG 漂移均 fail-closed。

每个场景同时做 side-by-side human review 和带显式 mask/threshold 的 pixel diff。允许声明：
`scene_compared`、`layout_checked`、`visual_delta_reviewed`。不得从中推导：全产品 1:1、
release-ready、installed-current 或 upstream 已吸收。

Settings 的最小比较集包含：展开侧栏、收起侧栏/窄窗、中文、英文、light、dark，以及从带
query/hash 的普通页面进入 Settings 后点击 `返回应用 / Back to app` 的路径恢复。

## Settings Return Contract

Settings 侧栏第一行固定为左箭头和 `返回应用 / Back to app`，位于搜索框之前。它读取进入
Settings 前最后一个合法非 Settings location，完整保留 pathname、query 和 hash；存储不可用、
值为空或指向 Settings 时回退 `/guid`。

展开态显示图标和文案；收起态显示图标、tooltip 和 accessible name；窄窗 Titlebar 复用同一个
resolver。该入口是导航，不改变 Settings IA，也不替代浏览器/应用历史前进后退。

## Appearance And Update Entry

Settings 左下 footer 不再提供明暗快捷切换，也不常驻“检查更新”。只有 `opl_app` 已确认存在
更高版本时，Gateway 账号或 Settings 单行入口最右侧才显示轻量更新图标；点击复用既有
carrier update modal。该入口不可实现第二套 updater，必要时只回退到
`/settings/environment?section=updates`。

明暗外观移入 Preferences 的 Display 区，固定为 `系统 / System`、`浅色 / Light`、
`深色 / Dark` 三态。OPL 视觉基线始终启用；CSS theme preset、Codex preset 和自定义主题编辑器
不再暴露。旧主题数据保留用于兼容和回退，但 active preset 会迁回 `default-theme`，不会继续
覆盖产品基线；系统模式跟随 OS 变化。

## Closeout Boundary

一轮维护只有在 exact topic commits、文件清单和 focused evidence 完整后才能交给集成 owner。
Topic 不自行 push、merge、package、install 或宣称 release-ready。最终 active-shell full gate、
installed-App UI acceptance、发布和 currentness 由对应 owner 在吸收后的 exact cohort 完成。

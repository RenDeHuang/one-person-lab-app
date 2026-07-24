# OPL App 分发与安装 SSOT

Owner: `one-person-lab-app`
State: `active_support`
Machine owners:
[`contracts/app-release-channel.json#distribution_semantics`](../../contracts/app-release-channel.json)
和
[`contracts/app-install-exposure-policy.json#distribution_install_model`](../../contracts/app-install-exposure-policy.json)

本文是 OPL App 发布、安装、运行形态和一致终态的唯一人类可读维护入口。
机器事实仍由上述两份合同分别拥有；本文不替代 Release Bundle、发布 receipt、
远端 readback 或 Framework package lifecycle。

## 结论

按“受管理的用户载体族”计数，而不是把每条命令、每种 DMG 密度和每个 tag
都算成独立渠道：

- 当前有 **4 类主要发布路径**：Desktop GitHub Release、Standard Homebrew
  Cask、Container WebUI GHCR、临时 Manual Full Preview。
- 当前有 **4 类主要安装路径**：直接 DMG、Standard Homebrew Cask、App
  `install.sh` bootstrap、Docker/WebUI 一键安装。
- `Full` 是 Standard 同 cohort 的离线 seed 密度，不是第五个频道。
- `Latest` 是推荐生产版本指针，不是质量等级。
- `install.sh --stable-macos-install` 和 `install-stable.sh` 是现行兼容路径，
  不再作为新文档首选。
- `one-person-lab-nightly` 只保留历史兼容。它历史上是 Standard Nightly，
  不是 Full；公开 Nightly 发布当前已退休，恢复发布没有获得批准。
- `one-person-lab-full` Cask 公开存在，但不在当前 Release Bundle
  发布流水线中，且仍额外依赖 Formula `opl`。它不是当前推荐安装路径。
- Native WebUI 是已批准的运行载体目标，但尚无 OPL-owned 正式资产、
  安装器和 clean-host 证据，因此不能计入当前安装路径。

目标形态是 **5 类安装载体**：DMG、Homebrew、通用一键安装、Native WebUI、
Container WebUI。不同入口必须收敛到同一产品行为与 Official Profile 意图，
但不要求物理字节相同。

## 正交语义

过去的主要混乱来自把频道、指针、载荷和运行形态混在同一个名字里。以后按
以下六个维度表达：

| 维度 | 取值 | 含义 |
| --- | --- | --- |
| 质量 | Stable / Preview；Nightly 仅历史兼容 | 是否通过对应发布资格；不说明载荷或运行形态 |
| 推荐指针 | Latest | 当前推荐的生产 Release，可移动 |
| 载荷密度 | Standard / Full | 在线收敛或预置离线 seed |
| 运行形态 | Desktop / Native WebUI / Container WebUI | 用户如何运行 App |
| 构建来源 | Automated / Manual | 谁触发构建；不决定质量 |
| 任务模式 | Development Validation / Production Release | 验证路径或正式生产编排 |

必须遵守：

1. Stable 是质量结论；Latest 是可变指针。
2. Latest 默认指向最新通过生产门禁的 Stable。
3. 手工构建只有通过与自动构建相同的 Stable 门禁并正式晋升后，才可成为
   Latest。未经门禁的手工版本仍是 Preview。
4. 下一个合格 Stable 发布时，Latest 自动回到该 Stable。
5. Preview、历史 Nightly、Canary 和单纯的开发环境覆盖都不能成为 Latest。
6. Full 不拥有独立版本频道、更新器或 Package currentness。

## 当前发布侧

| 发布路径 | 当前状态 | 产物或指针 | 维护规则 |
| --- | --- | --- | --- |
| Desktop Stable GitHub Release | Active | Standard DMG/ZIP、updater metadata、prepared notes、Latest | 唯一入口是 `release-stable.yml`；`standard` / `resume_standard` / `append_full` |
| Full additive publish | Active，属于 Desktop Stable | Full DMG + manifest | 与 Standard 同 frozen Bundle/Official Profile；只增加离线 seed，不改 Latest/updater |
| Standard Homebrew Cask | Active managed | `one-person-lab` 指向 Standard DMG | Formula `opl` 承载 Base；Cask 承载 App |
| Container WebUI GHCR | Active separate carrier | OCI digest、`:stable` 等 moving tag | 开发可双轨验证；生产通过 Desktop handoff follower，失败不改写 Desktop 终态 |
| Manual Full Preview | Active temporary non-Stable lane | 非 `v` prerelease tag、Full preview DMG | `make_latest=false`；不能改 updater、Homebrew 或 Stable |
| Nightly | Retired | 历史 Standard Nightly assets/Cask 只读兼容 | 不发布新版本；Canary 不是 Nightly |
| Full Homebrew Cask | Legacy public presence, unmanaged | `one-person-lab-full` 指向旧 Full DMG | 当前发布流水线不更新；完成迁移门槛前不推荐 |
| Native WebUI artifacts | Approved target, not published | 未来的 host-native tarball/manifest | 上游 AionUI artifact 不能充当 OPL 发布证据 |
| Canary | Validation-only，不是发布路径 | 无用户产物、无 moving tag mutation | 不继承发布 secrets，不执行公开写入 |

远端“现在具体是哪一个版本”必须从对应 owner 的 fresh receipt/readback 获取，
不能从本文、README、测试通过或本地 Cask 文件推导。

## 当前安装侧

| 用户入口 | 当前结果 | 状态 | 建议 |
| --- | --- | --- | --- |
| GitHub Release Standard DMG | Desktop App；首启由 Framework 补齐 Base/Packages | Supported | 不使用 Homebrew 时的直接 GUI 路径 |
| GitHub Release Full DMG | Desktop App + Base/Package offline seeds | Supported | 首次离线或希望最快达到完整能力时使用 |
| Standard Homebrew Cask | Formula `opl` Base + Standard DMG App | Supported | macOS 终端用户首选 |
| App `install.sh` | 当前委托 Framework `--with-app --skip-packages` | Supported transitional | 目前不是 Official Profile 一步收敛 |
| Stable macOS helper/wrapper | 下载 DMG、复制、显式清 quarantine、打开 App | Compatibility | 保留兼容，不再作为新用户首选 |
| Docker/WebUI 一键安装 | Container WebUI + 挂载的数据/项目目录 | Supported browser/server path | Linux/Windows/server 当前默认浏览器路径 |
| Manual Docker/Compose | 与 Docker/WebUI 相同载体 | Advanced fallback | 只用于运维和故障排查 |
| Nightly Cask | 历史 Standard Nightly | Historical only | 不作为持续更新安装路径 |
| Full Cask | Full DMG + Formula `opl`，存在重复 Base carrier 风险 | Legacy/unmanaged | 迁移完成前改用直接 Full DMG |
| Native WebUI | 只有源码开发/上游打包能力 | Not published | 不得写成当前 OPL 安装命令 |
| Framework headless installer | Base-only，无 App runtime form | Supported Framework boundary | 不是 OPL App 安装路径 |

## 平台默认目标

| 场景 | 当前默认 | 批准目标 |
| --- | --- | --- |
| macOS 个人电脑 | Homebrew Standard 或直接 DMG，运行 Desktop | 保持 Desktop；通用脚本也选择 Desktop |
| Linux 个人电脑 | Container WebUI | Native WebUI |
| Windows 个人电脑 | Container WebUI | Native 需单独完成资格验证后再决定 |
| Server / cloud / isolation | Container WebUI | 保持 Container WebUI |
| Headless automation | Framework Base-only | 保持 Base-only |

通用一键安装器的目标路由：

```text
macOS personal       -> Desktop
Linux personal       -> Native WebUI
server / isolation   -> Container WebUI (explicit)
--headless            -> OPL Base only
```

当前 `install.sh` 还没有达到该目标。必须等 Native WebUI 正式分发与
Official Profile 收敛可验证后，才能切换平台默认；之后才能退休重复的 Stable
macOS helper。

## 一致终态

“所有安全渠道最后效果一致”定义为 `official_profile_converged`：

- 只存在一个 Framework-owned active Base，`active_framework_count=1`。
- App、Base、Packages 各自保持独立版本和生命周期，不要求版本号锁步。
- 所有 App 载体消费相同产品行为合同与 Official Profile 意图。
- Framework reconciliation 产生可验证 terminal receipt。
- Standard 可在线补齐；Full 只提供相同目标所需的离线 seed。
- Desktop、Native WebUI、Container WebUI 可使用不同平台字节、目录、
  service manager 和隔离方式。
- Package currentness 由各 Package owner/carrier 与 Framework fresh
  aggregation 决定，不绑定 Desktop、DMG、Homebrew、WebUI 或 App Release
  的版本。

因此“一致”不是下面任何一种错误要求：

- 所有载体 SHA256 相同；
- Base/App/Packages 使用同一个版本号；
- Full 创建独立长期更新频道；
- Docker 的 Linux 目录直接复制到 Native host；
- App Release 决定所有 Package 的 latest/current。

## Homebrew 规则

### Standard

`one-person-lab` Cask 安装 Standard DMG，依赖 Formula `opl` 提供 Base。
这是当前受管理的 macOS 终端入口。

### Nightly

`one-person-lab-nightly` 历史 Cask 使用 Standard Nightly DMG，并依赖 Formula
`opl`；它从未等同于 Full。当前新发布已退休，任何恢复都需要新的显式产品
决策、工作流、不可变资产与 clean-install readback。

### Full

当前 `one-person-lab-full` 同时消费已经内嵌 Base/seeds 的 Full DMG 和 Formula
`opl`，产生重复物理字节，并可能让不同操作选择不同 Base carrier。

批准目标是：

```text
Full Cask -> Full Stable DMG -> embedded Base/seeds -> Framework activation
Formula dependency -> absent
active Framework -> exactly one
```

在切换公开 Cask 前必须同时完成：

1. Shell 对普通、状态、repair/update 操作都选择同一 Framework-owned Base。
2. Cask 生成器只为 Standard（以及历史上如重新批准的 Nightly）生成 Formula
   dependency，Full 不生成。
3. Tap CI、同步逻辑和 App 合同一起更新。
4. clean VM 证明 Formula 未安装、Full 首启成功、Official Profile 收敛、
   `active_framework_count=1`。
5. 新 Cask 与 DMG digest、tap commit、安装和升级 readback 精确绑定。

### Quarantine

Homebrew 当前不会自动替 OPL 清除 quarantine。现有 VM smoke 是安装后由测试
harness 额外执行 `xattr -dr`，不能代表普通用户体验。

长期目标是 Developer ID 签名和 notarization，并保留 Homebrew/Gatekeeper
默认安全行为。签名完成前如使用本地授权，必须是显式用户动作并有 readback；
不得把隐藏 `--no-quarantine` 或测试私有补丁写成公共能力。

## Native WebUI 规则

Native WebUI 表示直接在宿主系统运行浏览器工作台，不需要 Electron，也不需要
Docker。它不是“因为 Docker 里是 Linux，所以天然已经支持”的同义推导。

当前只有：

- Shell 源码 `webui` 开发入口；
- 可打包的上游 Web CLI 技术能力；
- Docker 内运行同类 WebUI runtime 的证明。

当前缺少：

- OPL-owned immutable versioned artifacts；
- host 可写 data/projects/recovery 路径；
- 一套 canonical 开发/打包/Docker entrypoint；
- 安装、升级、回滚与数据保留；
- 非 root clean-host qualification；
- App/Shell/Framework exact refs、manifest、digest 和公开 readback。

Container 的批准目标是包装同一 frozen Linux WebUI payload，只增加 OCI
基础层、mount adapter 和 entrypoint；它不能独立重编译成第二套产品字节。

## Desktop 与 WebUI cohort

当前仍是开发期双轨：

- Desktop 和 Container WebUI 可以独立开发、验证和暂时使用不同版本节奏。
- 开发发布不能声称已经是同一生产 cohort。
- 两边仍必须遵守相同产品行为合同，并最终通过 Framework reconciliation
  收敛。

Desktop 发布路径稳定后的生产目标：

```text
one App Stable cohort/version
  -> Desktop
  -> Native WebUI
  -> Container WebUI
```

三种形态独立构建、资格验证和失败隔离；同一版本与 Official Profile 是生产
cohort 要求，物理字节一致不是要求。WebUI follower 失败不得撤销已经完成的
Desktop Stable/Latest。

## 维护与晋升规则

任何新增或变更路径必须按顺序更新：

1. 发布语义与实现状态：
   `contracts/app-release-channel.json#distribution_semantics`。
2. 用户入口、平台路由和一致终态：
   `contracts/app-install-exposure-policy.json#distribution_install_model`。
3. 本文的 current/target 表。
4. `distribution-install-ssot-validator.ts` 与 mutation tests。
5. 对应构建、安装、升级、回滚、clean-host 和公开 readback。
6. 最后才可在根 README 或公共用户指南中标为当前支持。

状态晋升必须是：

```text
idea
-> approved_target
-> implementation_present
-> qualified
-> publicly_published
-> fresh_public_readback
-> supported/recommended
```

不能跳级。源码可运行、CI build、Actions artifact、测试通过、旧 Cask 存在或
文档写好都不能单独把路径晋升为 supported。

## 不在本 SSOT 中拥有的事实

- Release Bundle schema、checkpoint、receipt 与 reconcile：OPL Framework。
- Stable 的实际公共版本和 Latest：GitHub fresh readback。
- GHCR `:stable` 的实际 digest：GHCR anonymous pull readback。
- Homebrew 的实际公开 commit/Cask digest：tap publication/readback receipt。
- Package release/currentness：各 Package owner 与 Framework aggregation。
- App/Framework/Packages 的兼容关系：对应 compatibility contract。
- 历史事故与某次发布证据：`docs/delivery/release/records/` 和 incidents。

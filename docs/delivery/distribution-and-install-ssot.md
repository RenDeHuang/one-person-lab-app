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

跨目标并发、objective owner和开发清洁规则统一消费
[`../active/parallel-delivery-and-clean-development-ssot.md`](../active/parallel-delivery-and-clean-development-ssot.md)
及其机器快照
[`../active/active-objective-ledger.json`](../active/active-objective-ledger.json)，本文不复制
易漂移的 thread heartbeat、run id或worktree清单。

## 执行协调与开发清洁

- 最新直接用户目标是当前SSOT；旧合同、ledger、callback或失败operation与其冲突时，
  先修订流程和实现，不得用旧记录拒绝用户终态。
- Desktop Stable/Latest、WebUI GHCR `stable/latest`、Native/Homebrew exposure、managed
  install和GUI same-artifact acceptance可以独立并行；一个载体的失败不阻止另一个已经
  具备权限和输入的载体继续交付。
- 依赖只约束最终消费顺序：GUI必须等待fresh immutable published artifact，installer
  readback必须等待对应公开carrier；但source、fixture、compatibility bridge和本地测试
  可以先行。
- 小范围write-set overlap不阻止独立worktree开发；每个repo最终main mutation串行，
  后吸收owner按fresh SSOT semantic replay并解决冲突。
- 手工开发local-first/push-last；远端Actions只补hosted OS、受保护secret/public mutation
  和owner-authoritative readback，不作为第一轮调试器。
- 开发清洁以`stale=0 / ownerless=0 / duplicate_writer=0 / unexpected_dirty=0 / git_locks=0`
  为终态。活跃owner lane可以保留；已吸收lane必须由原owner完成worktree/ref/receipt/temp
  的guarded close，不能按标题或clean状态批量删除。

## 结论

“OPL 有多少条路径”不能只给一个总数，因为产品表面、载荷密度、发布载体、
用户安装入口和远端指针是不同层。当前产品口径是：

| 层 | 数量 | 成员 |
| --- | ---: | --- |
| 发布载体族 | 3 | App GitHub Releases、Homebrew Tap、WebUI GHCR |
| 普通安装入口族 | 4 | 直接 GitHub Release 资产、Homebrew Cask、Release `opl-install.sh`、Container WebUI helper/Compose |
| 产品表面 | 2 | Desktop、WebUI |
| 载荷密度 | 2 | Standard、Full |
| 支持的产品单元 | 4 | Desktop Standard、Desktop Full、WebUI Standard、WebUI Full |

因此：

- Desktop/WebUI 是用户选择的产品表面；Standard/Full 是同一产品和 Official
  Profile 的两种载荷密度。两轴正交，不是四套产品，也不产生四种质量等级。
- Native 与 Container 只描述 WebUI 的内部部署 carrier。它们不再是产品表面、
  质量、密度或面向用户的独立产品频道。
- 四格支持矩阵是产品合同，不是 public/install completion receipt。任一 exact
  版本、资产、tag、digest、安装结果或升级结果仍必须由对应 owner 的 fresh
  public/install readback 证明，不能从本文或矩阵本身推导。
- `Latest` 是某个载体命名空间内供自动更新器消费的可变指针，不是质量、频道或
  “最新构建”的同义词。
- Desktop GitHub `Latest` 与 WebUI GHCR `:latest` 是两个载体各自的指针；生产
  默认由各自新发布的合格 Stable 接管。用户明确确认后，任一载体也可以把自己的
  `latest` 指向一个已经发布、身份和 digest 均可核验的 exact Stable 或 Preview
 版本；选择必须消费该载体保留的
  `carrier_owned_durable_publication_record`，而不是短期 Actions artifact。该记录
  绑定载体命名空间、exact version/tag、不可变 artifact/image digest、质量与
  Preview kind、qualification disclosure 及 public readback；这不会改变该版本的
  质量，也不会改动其他载体的指针。
- 手工 WebUI independent Preview 的 `latest` promotion 只接受该记录的 exact
  `publication_record_ref`（GHCR `:receipt-<version>`）；protected workflow 用 ORAS
  拉取并 canonical-validate sidecar 后，才从记录派生 frozen cohort、qualification、
  source authority、image 与实际 publication run attempt。它不接受 run id、executor
  SHA 或会过期的 Actions artifact 作为选择输入，也不改动 WebUI `stable` 或 Desktop
  指针。
- `one-person-lab-nightly` 的产品语义保留：Nightly 是 Automated Preview 的派生
  kind，不是质量或载荷密度。当前实现每天自动复用与 Stable 相同的物理 Standard build，
  发布不可变 GitHub prerelease，再由独立 digest-bound follower 更新 Nightly Cask；
  schedule 默认不改变 Latest，也不进入 Stable Bundle 或重型 VM 门禁。用户可以
  通过独立的 protected single-use pointer operation 临时让某个 exact Nightly
  接管 Latest；该操作不改变 Preview 质量。低频 clean-VM 只作发布后抽样、失败
  不阻塞该次 Nightly。
- `one-person-lab-full` 是 Full 密度的 Homebrew carrier 名称；它不把 Full 限定为
  Desktop，也不建立独立更新频道。其 public/install currentness 必须从 Tap、Release
  和安装 readback 获取。
- WebUI 可由 host-native 或 Container carrier 实现。carrier 选择由平台能力、
  隔离要求和 exact Release 资产决定，但不得改变 WebUI 表面或 Standard/Full 密度。
- 历史 Native tarball、Container image、DMG 或 Cask receipt 只能证明其绑定的 exact
  carrier 字节；不得把历史证据外推为当前四格均已公开、可安装或通过 clean-host。
- `install.sh --stable-macos-install` 与 `install-stable.sh` 只保留兼容；Homebrew、
  直接 DMG 和版本冻结的公共 `opl-install.sh` 覆盖同类用户需求后应退休重复实现。

## 用户认知模型

用户不需要先理解 GitHub、Homebrew 或 GHCR。第一层只选择产品表面：

| 用户选择 | 含义 |
| --- | --- |
| Desktop | 独立应用窗口和系统集成 |
| WebUI | 在浏览器使用同一工作台 |

第二层选择载荷密度：

| 密度 | 含义 |
| --- | --- |
| Standard | 较小交付，首次启动后在线收敛到同一 Official Profile |
| Full | 同一表面和 Profile，额外携带离线 Base/Package seed |

第三层才由入口或平台 adapter 选择内部 carrier：

| 载体 | 用户何时选择 |
| --- | --- |
| `opl-install.sh` | Unix-like shell 的默认统一入口；同一份按 Release 冻结的脚本按平台和显式模式路由，并固定 App/Shell/Framework cohort、Release tag 与版本化 Container tag |
| Homebrew | 已使用 Homebrew，希望由包管理器安装和更新 |
| 直接 Release 资产 | 离线、固定版本或人工安装 |
| Docker/Compose | 隔离、服务器、NAS 或跨平台浏览器部署 |

开发者维护三个 carrier authority：

```text
GitHub Release -> Desktop/WebUI versioned assets + manifests + frozen installer
Homebrew Tap   -> GitHub Release 的包管理器索引/follower
GHCR           -> WebUI 的 Container carrier
```

Native/Container 是 WebUI 内部 carrier，不参与产品表面计数。Headless 只安装
Framework Base/CLI，是 Framework 边界，不是第五个 App 产品单元。

## 正交语义

过去的主要混乱来自把频道、指针、载荷和运行形态混在同一个名字里。以后按
以下七个维度表达：

| 维度 | 取值 | 含义 |
| --- | --- | --- |
| `quality_status` | Stable / Preview | 唯一质量轴；Stable 是完整生产资格，Preview 尚未取得或尚未声明该资格 |
| `build_trigger` | Manual / Automated | 构建如何触发；不单独决定质量或 Latest |
| `preview_kind` | Dev / Nightly / `null` | 只读派生值：Preview + Manual = Dev，Preview + Automated = Nightly，Stable = `null` |
| 更新指针 | Latest | 自动更新器当前选择的 exact published version；可移动且不改变质量 |
| 产品表面 | Desktop / WebUI | 用户如何使用 App |
| 载荷密度 | Standard / Full | 在线收敛或预置离线 seed；适用于两个产品表面 |
| 内部 carrier | Native / Container / 平台包 | 交付和运行适配；不改变产品表面或密度 |
| 任务模式 | Development Validation / Production Release | 验证路径或正式生产编排 |

必须遵守：

1. `quality_status`、`build_trigger` 和 Latest 是互相独立的轴；Nightly 只是当前
   产品中的 automated Preview，Dev 只是 manual Preview，不是第三、第四种质量。
2. `preview_kind` 只能由前两轴派生，不得由调用方独立写入或制造非法组合。
3. `promote_quality` 只把同一 exact artifact digest 的 Preview 晋升为 Stable；
   它必须消费与直接 Stable 完全相同的门禁和 qualification receipt，不移动 Latest，
   也不得回写不可变 build manifest 来伪造质量。
4. `move_latest_pointer` 只移动自动更新指针。目标可以是任一 exact published
   Stable、Dev Preview 或 Nightly Preview，质量必须保持不变。
5. Preview 接管 Latest 必须具备用户明确要求、protected single-use authority、
   expected-current CAS、exact digest/tag 绑定和 public readback，并持续披露
   non-Stable 与 skipped/failed gates。
6. single-use authority 只授权当前一次 CAS，不形成持久 override。最新 qualified
   Stable 默认接管 Latest；下一个 qualified Stable 默认 reclaim。
7. 任一发布、晋升或指针操作失败时，现有 Latest/LKG 保持不变。
8. Canary 和单纯的开发环境覆盖没有 exact published artifact，不能成为 Latest。
9. Full 不拥有独立版本频道、更新器或 Package currentness；Desktop/WebUI 两个表面
   都必须保持 Standard 与 Full 的同一产品行为和 Official Profile 终态。

### 默认与自由

下面的两层行为同时成立，不能互相替代：

| 目标 | 默认行为 | 用户明确确认后的自由行为 |
| --- | --- | --- |
| 新合格 Stable | 该载体推进自己的 `latest`；Container WebUI 同时推进 `stable` 兼容 alias | 可以不改 `latest`，或随后按 exact CAS 指到另一个已验证版本 |
| 手工 Dev/Nightly Preview | 只发布 immutable version，不自动改 `latest` 或 `stable` | 单独 dispatch 一次 protected pointer operation，把该载体 `latest` 指向该 exact Preview |
| Docker/WebUI 紧急修复 | 不等待 Desktop Stable 或 Desktop Latest | 用 exact App/Shell/Framework refs 发布 immutable Preview，再显式只改 Docker `latest`；Docker `stable`、Desktop Latest 均保持不变 |

“自由”指选择目标版本的业务权限，不是放弃身份校验：目标必须是已经公开、不可变、
已验证并且可由 carrier receipt/source authority 反向绑定的版本。选择资格只在该
`carrier_owned_durable_publication_record` 仍为 retained、未 retired、未 revoked 时
存在；Actions artifact 只能作为发布前传输或诊断证据，artifact 过期或保留期变化
不得决定已发布版本是否可选。工作流不接受裸 tag、裸 digest 或 `force` 作为绕过该
证据链的输入。

## 当前发布侧

| 发布路径 | 当前状态 | 产物或指针 | 维护规则 |
| --- | --- | --- | --- |
| Desktop Standard | 产品单元已定义；远端 currentness 由 fresh readback 决定 | Desktop Standard assets、updater metadata、prepared notes、carrier-local Latest | qualified Stable 默认接管该 carrier 的 Latest；不证明其他三格 |
| Desktop Full | 产品单元已定义；远端 currentness 由 fresh readback 决定 | 与 Desktop Standard 同 cohort 的 Full assets/manifest | 只增加离线 seed，不改 Standard updater |
| WebUI Standard | 产品单元已定义；远端 currentness 由 fresh readback 决定 | host-native 或 Container Standard carrier、carrier-local pointer | carrier 必须绑定 exact cohort/digest；不证明 WebUI Full |
| WebUI Full | 产品单元已定义；远端 currentness 由 fresh readback 决定 | 同一 WebUI 表面的 Full payload/manifest | 只增加离线 seed；不得变成第二产品或暗改质量 |
| Standard Homebrew Cask | Active managed | `one-person-lab` 指向 Standard DMG | Formula `opl` 承载 Base；Cask 承载 App |
| Container WebUI GHCR | Active separate carrier | immutable OCI version、`:latest`，`:stable` 为兼容 alias | Production follower 默认把合格 Stable 同时推进 `stable`/`latest`；手工 independent Preview 可独立发布，只有用户显式 promotion 才从 durable publication record 选择并改 Docker `latest`，且不得改 `stable` 或 Desktop 指针 |
| Manual Full Preview | Active temporary non-Stable lane | 非 `v` prerelease tag、Full preview DMG | 发布默认 `make_latest=false`；独立 protected pointer operation 可选择 exact Preview，但不能暗升 Stable 或改写 Homebrew |
| Windows x64 RC Preview | opt-in WSL2-only Preview capability；当前公开状态只由 fresh public receipt/readback 决定 | exact prerelease tag、Windows EXE、SHA256SUMS、Windows RC cohort | 三路 Codex-backed runtime、物理重启持久性、正常退出和 final-zero 必须绑定同一公开 EXE；仍禁止 native Windows fallback、Latest、Stable updater、Homebrew 和 Stable Bundle admission |
| Nightly | Implemented；公开 currentness 由 fresh readback 决定 | Standard DMG/ZIP/updater prerelease + Nightly Cask follower | 生产默认是每日 schedule；用户显式要求时可用 `development_validation` 的 protected `workflow_dispatch` 立即运行同一条 Nightly path，frozen request/receipt 必须保留 invocation、event、authority 和 exact run identity；两者均不改 Latest；独立 protected pointer operation 可临时选择 exact Nightly；不含 Full/WebUI、不复用 Stable mutex；抽样 VM 非阻塞 |
| Full Homebrew Cask | 目标 carrier 已定义；具体公开状态由 fresh Tap/Release readback 决定 | Full density carrier | 完成受保护 CAS、公开字节和安装 readback 前不得宣称可用 |
| WebUI internal carriers | Native / Container 均为内部实现选择 | 与产品单元绑定的平台资产、OCI digest、manifest 和 qualification receipt | 每个 exact carrier 独立 qualification/readback；不增加产品表面或暗示另一格完成 |
| Canary | Validation-only，不是发布路径 | 无用户产物、无 moving tag mutation | 不继承发布 secrets，不执行公开写入 |

远端“现在具体是哪一个版本”必须从对应 owner 的 fresh receipt/readback 获取，不能从本文、
README、测试通过或本地 Cask 文件推导。

Windows Preview 的弱网下载从下一份 RC 起把 `download-windows-preview.ps1` 与
`SHA256SUMS.txt` 作为同一不可变 Release 资产发布。助手使用当前用户的 BITS 持久任务，
允许关闭窗口或短暂断网后按相同 tag/asset 重新附着，显示真实字节和状态，并在最终命名前
核对 Release checksum、GitHub asset digest 和本地 SHA-256。浏览器直接下载仍是备用。
任何自动镜像回退都必须由 App owner 预先登记 HTTPS 来源并绑定同一 exact digest；任意
第三方镜像、网盘或用户侧 `registry-mirrors` 不构成产品自动选择 authority。

Stable 的默认 required/blocking 平台精确为 `macos-arm64` 与 `linux-x64`。`macos-x64`、
`macos-universal` 和 `linux-arm64` 保留为默认关闭的 optional/nonblocking capability；
Windows x64/ARM64
保留构建能力，但只属于默认关闭、非阻塞的 Preview/RC policy，不能进入 Stable admission、
qualification、Latest activation 或同制品 Standard install/readback 的 required 集合。
所有入口只选择机器合同登记的 policy 或 platform ID，由
`scripts/resolve-release-platform-matrix.ts` 生成 reusable build matrix。单次 Stable 的
optional ID 数组必须由 pre-issued authority 绑定并随 operation control/checkpoint 原样传递，
不能由 follower 自行扩选。

Linux x64 的发布后安装认证由同一只读 `workflow_run` follower 在 GitHub-hosted
`ubuntu-latest` 上执行。它只在成功的 Standard operation 已公开 immutable Release、
Latest admission 和 exact `opl-app-component-manifest.json` 后启动，并同时绑定：

- `One-Person-Lab-<version>-linux-x64.deb` 的公开 SHA256；
- 公开 `opl-app-installer.sh` 的 SHA256；
- component manifest digest、Release tag 与 App/Shell/Framework cohort。

执行路径必须是下载并校验该公开 installer 后运行
`--desktop --release-tag <exact-tag> --no-open`，不得从 checkout 重建 `.deb` 或 installer。
执行前必须证明目标 Debian package 不存在；执行后必须把公开 `.deb` 解包得到的
executable digest 与 `dpkg` 已安装路径的 executable digest 精确比较，version/architecture
相同本身不能替代安装字节一致性。
GitHub-hosted admission 使用
`opl_app_optional_certification_hosted_admission.v1` exact typed evidence；认证只产生
`passed` 或 `failed`。网络、队列或 hosted runner 故障一律按执行失败处理，绝不能伪装成 `unavailable`。
失败 receipt 必须分别记录 `.deb` 与 installer 是否已从公开 Release 下载，不能把下载前失败
写成已下载。
失败路径也必须先上传 receipt、installer 输出与安装
readback evidence，再让这个独立 follower job 失败。该 follower 永不进入 Stable/Latest
DAG，不能撤销、阻塞或改写已完成的 publication。源码实现不等于首次 public/install
终态；仍须由未来 exact Stable cohort 的公开资产和安装 receipt fresh readback 晋升。

Full macOS DMG 是同一 Stable cohort 的受保护自动 post-success additive follower：
它必须绑定相同 App/Shell/Framework refs、version 与 Standard identity，并用独立
`append_full` operation 生成 durable receipt。因为基础 Stable GitHub Release 在终态是
immutable，Full DMG 及其 manifest 发布到由基础 tag 与 Bundle digest 派生的独立 immutable
adjunct Release，而不是回写基础 tag。optional 平台同样使用内容寻址的独立 immutable adjunct
Release。两类 receipt 都必须给出基础 tag、adjunct tag、Release/下载 URL、三仓 cohort、
Bundle/manifest/资产 digest；用户从该 adjunct Release 下载附加 DMG 或平台安装包。
任一 follower 的失败或延迟不得撤销、阻塞或改写基础 Stable publication、Latest activation
或 Standard 同制品安装终态；恢复必须使用绑定同 cohort 的 distinct operation。

### Container WebUI 紧急路径

Docker 紧急修复使用两次明确且可独立验收的操作：

```text
exact App/Shell/Framework refs
  -> source authority
  -> immutable <YY.M.D-preview.rN> OCI publication and qualification
  -> explicit user-confirmed Latest-only promotion
  -> public Stable-unchanged + Latest-exact-digest readback
```

第一步由 `release-webui-development.yml` 执行，输入是版本和三条 exact SHA；它只
发布不可变 version tag，不能写 `:latest` 或 `:stable`。第二步由
`release-webui-development-promote.yml` 执行，输入是同一 immutable carrier 的
receipt/run identity；它只能写 `:latest`，并以预先冻结的 `:stable` prestate 做
读回证明。两步均不依赖 Desktop Stable 或 Desktop Latest。

因此，紧急 Docker 修复能在 Desktop Stable 尚未发布、正在排队或失败时独立交付；
同时不会把 Preview 伪装成 Stable，也不会用 Docker 的成功或失败重写 Desktop 发布
终态。

## 当前安装侧

| 用户入口 | 当前结果 | 状态 | 建议 |
| --- | --- | --- | --- |
| Desktop Standard | Desktop App；首启由 Framework 补齐 Base/Packages | 产品单元支持；具体安装可用性需 fresh readback | 选择 exact qualified carrier |
| Desktop Full | Desktop App + Base/Package offline seeds | 产品单元支持；具体安装可用性需 fresh readback | 同一 Desktop 表面，额外离线 seed |
| WebUI Standard | Browser workbench + 在线收敛 | 产品单元支持；具体安装可用性需 fresh readback | 平台选择 Native 或 Container internal carrier |
| WebUI Full | Browser workbench + offline seeds | 产品单元支持；具体安装可用性需 fresh readback | 同一 WebUI 表面，额外离线 seed |
| Standard Homebrew Cask | Formula `opl` Base + Standard DMG App | carrier contract 已定义；exact Tap/install currentness 需 fresh readback | macOS 终端用户入口 |
| Release `opl-install.sh` | 选择 Desktop/WebUI 和 Standard/Full 两个独立轴；macOS 显式密度解析到 exact DMG，Linux 仅支持 Standard，显式 Full 在任何 Release 资产查询前失败关闭；headless 仍是独立 Framework 边界 | 入口模型已定义；exact Release 可用性需 readback | 固定 App/Shell/Framework SHA、Release tag 和资产 digest |
| Source `install.sh` | 与公共入口共享路由逻辑；显式 `--standard`/`--full` 使用相同平台密度约束，无显式密度时保留 Framework `--with-app` compatibility | Developer compatibility | 仅供 reviewed checkout；不得从可变 `main` 直接管道执行 |
| Stable macOS helper/wrapper | 下载 DMG、复制、显式清 quarantine、打开 App | Compatibility | 保留兼容，不再作为新用户首选 |
| Docker/WebUI 一键安装 | WebUI 的 Container internal carrier + 挂载的数据/项目目录 | carrier 路径；具体公开/安装状态需 fresh readback | 适合 server/isolation，不是第三产品表面 |
| GitHub Prerelease Windows x64 EXE | Desktop App Preview carrier | exact 公开与安装状态需 fresh Release/receipt readback | 不从历史 RC、另一格或支持矩阵推导 Latest、Stable updater 或当前可安装性 |
| Manual Docker/Compose | 与 Docker/WebUI 相同载体 | Advanced fallback | 只用于运维和故障排查 |
| Nightly Cask | Standard Nightly + Formula `opl` | Implemented，首个 follower readback 待完成 | 仅由成功 GitHub Nightly publication 的 digest-bound follower 更新，不得改 Stable Cask |
| Full Cask | 公开旧 Cask 为 Full DMG + Formula `opl`，存在重复 Base carrier 风险 | Legacy public / target implemented unpublished | 当前改用直接 Full DMG；目标 Cask 只安装 Full DMG，不安装 Formula |
| Native WebUI | WebUI 的 host-native internal carrier | carrier 路径；具体公开/安装状态需 fresh readback | 不作为独立产品表面或独立密度 |
| Framework headless installer | Base-only，无 App runtime form | Framework source boundary | 不是 OPL App 产品单元；exact 可安装性仍需 owner readback |

Full follower 只消费 `append_full` handoff 中的 `release.base_tag` 与
`release.adjunct_tag`：前者绑定同 cohort Standard identity，后者绑定实际 Full
Release、下载 URL、Homebrew Cask 与 same-artifact certification。GitHub Actions
executor 固定运行在 canonical `main`，因此不得再把 workflow run `head_branch`
误当 Release tag，也不得回退读取已退役的 `release.tag`。

## 平台默认目标

| 场景 | 当前默认 | 批准目标 |
| --- | --- | --- |
| macOS 个人电脑 | 先选 Desktop 或 WebUI，再选 Standard 或 Full | 由 exact Release manifest 解析可用 carrier |
| Linux x86_64 个人电脑 | 先选 Desktop 或 WebUI，再选 Standard 或 Full | 由 exact Release manifest 解析可用 carrier |
| Windows 个人电脑 | 先选 Desktop 或 WebUI，再选 Standard 或 Full | Preview/Stable 与安装资格仍由 exact receipt 决定 |
| Server / cloud / isolation | WebUI，默认 Standard；需要离线 seed 时选 Full | 内部优先 Container carrier |
| Headless automation | Framework Base-only | 保持 Base-only |

统一入口的产品路由合同：

```text
personal             -> Desktop or WebUI + Standard (default) or Full (explicit)
server / isolation   -> WebUI + Standard (default) or Full (explicit)
payload density       -> only when the exact platform manifest exposes the cell
WebUI carrier         -> Native or Container, selected by exact platform manifest
--headless             -> OPL Base only
```

矩阵定义不能替代平台资格。任何平台上的四格都必须分别绑定 exact public artifact、
qualification receipt、安装/升级/回滚与 anonymous/authenticated readback；缺一项时只
能报告该 exact carrier 的事实，不能把其他平台或其他格子的结果外推过来。

## 一致终态

“所有安全渠道最后效果一致”定义为 `official_profile_converged`：

- 只存在一个 Framework-owned active Base，`active_framework_count=1`。
- App、Base、Packages 各自保持独立版本和生命周期，不要求版本号锁步。
- 所有 App 载体消费相同产品行为合同与 Official Profile 意图。
- 每个 configured carrier / Package-declared adapter 产生 fresh terminal readback；
  Framework 只聚合完整 Package 的 installed/callable 状态；operation/release receipt
  不作为 Package installed truth。
- Standard 可在线补齐；Full 只提供相同目标所需的离线 seed。
- Desktop 与 WebUI 可使用不同平台字节；WebUI 内部 Native/Container carrier 也可
  使用不同目录、service manager 和隔离方式，但都消费同一产品行为合同。
- Package 发布 current stable 只由各 owner 的 per-Package GHCR `latest-stable`
  定义；本机 installed/callable 只由 carrier readback 经 Framework 聚合定义。
  两者都不绑定 Desktop、DMG、Homebrew、WebUI 或 App Release 版本。
- Package 的 immutable version tag 是 exact identity；`candidate` 是 Preview 指针，
  `latest-stable` 是 Stable/current 指针，bare `latest` 保持退休。Nightly 只表示
  automated build provenance，不另建消费 channel。
- 同一自动日更 digest 可以先作为 Nightly candidate，通过完整 Stable qualification
  后以同 digest 晋升 Stable 并更新 `latest-stable`；这表示三轴指向同一 digest，
  不是 `latest = stable = nightly` 的概念等号。失败或无变化时 `latest-stable`
  保持上一 LKG。
- 当前 Package 自动闭环仍未完成：daily workflow 只负责 fingerprint detection 和
  candidate evidence，immutable candidate publication、完整 qualification、protected
  automatic promotion 与 anonymous/public readback 仍需由 Framework/Package owner
  串成闭环。App 只记录该边界，不并写 Package authority。

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

### Linux 与 Browser WebUI

Homebrew 本身支持 macOS 和 Linux，但 Cask 是 macOS App bundle 载体；因此现有
`brew install --cask one-person-lab` 不能直接变成 Linux Desktop 安装命令。

技术上可以新增普通 Formula `one-person-lab-webui`，让 macOS 和 Linux 使用同一
命令安装 Browser WebUI。该 Formula 必须消费 GitHub Release 中同一 frozen Native
payload、digest 和 lifecycle contract，不能从 `main` 重新构建，也不能制造第二份
更新 authority。这个目标认知成本低、实现可行，但当前尚未实现。

Linux Desktop 也可以强行用 Formula 分发，但 `.deb`/AppImage 更符合桌面集成与
系统更新习惯。用户入口仍可保持统一：`opl-install.sh --desktop`；底层由平台选择
DMG、DEB/AppImage 或未来的 package manager carrier。

### Nightly

`one-person-lab-nightly` 使用 Standard Nightly DMG，并依赖 Formula `opl`；它从未
等同于 Full。每日 schedule 通过共享 `_build-reusable.yml` 生成 Standard 资产，
发布 immutable GitHub prerelease，随后独立 follower 只更新
`Casks/one-person-lab-nightly.rb`。它不进入 Stable Bundle/mutex，schedule 默认
不改变 Latest；只有独立 protected single-use pointer operation 才能临时选择某个
exact Nightly，且不得改变其 Preview 质量。每周抽样 clean-VM 是非阻塞发布后
follower。首个远端 publication、Cask 和抽样 receipt 出现前，只能称“实现完成、
公开 readback 待完成”，不能称通道终态已验证。

### Full

Homebrew Cask 不会把 Full DMG 拆成“GUI 部分”再另装 Base。它会安装整个 App
bundle，所以 Full DMG 内嵌的 Base/seeds 仍然存在。当前公开 `one-person-lab-full`
又额外声明 Formula `opl`，因此不是“特意剥离 Base”，而是同时引入两个 Base
carrier，产生重复物理字节和选择歧义。

批准目标是：

```text
Full Cask -> Full Stable DMG -> embedded Base/seeds -> Framework activation
Formula dependency -> absent
active Framework -> exactly one
```

生成器和合同已完成第 2 项，但在切换公开 Cask 前仍必须完成全部终态：

1. Shell 对普通、状态、repair/update 操作都选择同一 Framework-owned Base。
2. Cask 生成器只为 Standard 和 Nightly 生成 Formula
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

## WebUI 内部 carrier 规则

WebUI 是产品表面。Native 表示直接在宿主运行浏览器工作台，Container 表示由 OCI
基础层、mount adapter 和 entrypoint 承载同一 WebUI 产品行为。两者只是内部 carrier：

- 不增加第三个产品表面；
- 不改变 Standard/Full 密度；
- 不改变 Stable/Preview 质量；
- 不共享未绑定 digest 的 installed/public 结论；
- 不允许某个 carrier 重新编译出一套独立产品逻辑。

四格产品拓扑为：

```text
surface=Desktop x density=Standard
surface=Desktop x density=Full
surface=WebUI   x density=Standard
surface=WebUI   x density=Full
```

四格共享产品行为、Official Profile 和 V3 质量/Latest 语义，但可以独立构建、
qualification、发布和失败隔离。任何一格成功都不证明其他格已经公开、安装或通过
clean-host；Native/Container 任一 follower 失败也不得撤销其他已完成格的终态。

平台 carrier currentness 与产品支持矩阵分开记录。Linux Desktop、Windows Desktop、
host-native WebUI、Container WebUI、DMG、DEB、EXE、Cask 和 OCI 都必须由各自 exact
artifact、updater metadata、安装/升级/回滚、数据保留和 public readback 证明。本文
不把 source capability、历史 receipt 或另一平台成功改写成当前 public/install 终态。

## 最优维护模型

以后只维护以下 owner 链，不再让 README、脚本或下游 Tap 各自解释产品语义：

```text
App contracts
  -> 本 SSOT
  -> build/publish/install implementation
  -> clean-host + public readback
  -> ordinary README/user guides
```

职责固定如下：

| 事实 | 唯一 owner |
| --- | --- |
| `quality_status`、`build_trigger`、派生 `preview_kind`、Latest、载体状态、cohort | `contracts/app-release-channel.json#distribution_semantics` |
| 安装入口、平台路由、Homebrew profile、统一终态 | `contracts/app-install-exposure-policy.json#distribution_install_model` |
| Base/Package 激活、installed/callable、Official Profile reconciliation | OPL Framework |
| 当前公共版本、资产、tag/digest、Tap commit | 对应远端 fresh readback/receipt |
| 普通用户说明 | README/用户指南，只消费上述事实，不自创新状态 |

维护原则：

1. 新入口优先复用 `install.sh` 路由，不新增平行的一键脚本。
2. 新载体复用同一 frozen App/WebUI payload，再增加平台 adapter；不独立编译第二套
   产品逻辑。
3. Standard 与 Full 在 Desktop/WebUI 两个表面都只改变载荷密度；首次启动后的
   管理、更新和卸载行为一致。
4. Homebrew 只负责索引和安装 App/Base carrier，不拥有 Package lifecycle。
5. 对外标记 `supported` 前必须同时具备公开不可变资产、clean-host、升级/回滚、
   数据保留、Official Profile 和 fresh public readback。
6. 临时 Dev/Nightly Preview 可以独立交付；只有独立的 protected single-use exact
   CAS operation 可以移动 Latest，且不得伪装成 Stable。下一 qualified Stable
   默认 reclaim。

## 维护与晋升规则

任何新增或变更路径必须按顺序更新：

1. 发布语义与实现状态：
   `contracts/app-release-channel.json#distribution_semantics`。
2. 用户入口、平台路由和一致终态：
   `contracts/app-install-exposure-policy.json#distribution_install_model`。
3. 本文的 current/target 表。
4. `distribution-install-ssot-validator.ts` 与 mutation tests。
5. 对应构建、安装、升级、回滚、数据保留、Official Profile、clean-host 和公开 readback。
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
- GHCR `:latest` 与 `:stable` 的实际 digest 及两者是否一致：GHCR anonymous pull readback。
- Homebrew 的实际公开 commit/Cask digest：tap publication/readback receipt。
- Package release/currentness：各 Package owner 与 Framework aggregation。
- App/Framework/Packages 的兼容关系：对应 compatibility contract。
- 历史事故与某次发布证据：`docs/delivery/release/records/` 和 incidents。

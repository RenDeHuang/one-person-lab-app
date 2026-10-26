# Stable 26.10.26 发布复盘

Standard 与全部适用附加渠道已公开完成：[v26.10.26](https://github.com/gaofeng21cn/one-person-lab-app/releases/tag/v26.10.26) 为 Latest，包含 19 项资产。覆盖 macOS Standard／Full、Windows／Linux、两个 Homebrew Cask 与双架构 Docker。macOS 已通过签名、公证、普通 Gateway 专用账号 clean-VM、Framework／Codex 就绪和 Runtime 刷新；Full 另通过 Temporal 生命周期。Windows 按当前合同发布 unsigned 包。本次未升级本机 `/Applications`。

## 候选与恢复

Standard App/tag 为 `6cdac73e63bd718b518e2427d4e9c9aa9b47fae1`，Shell 为 `f7d9d72422b2e9dffd97362c538950542bb324a1`，Framework 为 `f6d0d8886e33bec1fa9485c3c6ecf9eb3c019bd0`；Full 恢复执行器为 `add96c0b690d4195a65f41a60716096fce196554`。显示版本 `26.10.26`，机器版本 `26.10.2691`。

以下时间为北京时间（UTC+8），来自相应 run 的 step 与实际日志。耗时包含失败恢复，不用成功 run 的单段耗时代表端到端时间。

| 阶段 | 时间／run | 结果与处理 |
| --- | --- | --- |
| Standard 首轮 | 08:59:50–09:26:20；[40252014307](https://github.com/gaofeng21cn/one-person-lab-app/actions/runs/40252014307) | `Verify packaged active Shell assets` 失败：updater 读取尚未初始化的 Host。 |
| Standard 恢复 | 09:34:15 开始；[40254856134](https://github.com/gaofeng21cn/one-person-lab-app/actions/runs/40254856134) | 10:14:09 Standard 公开并成为 Latest；10:15:13 Cask、10:18:50 Docker promotion 完成；含 Windows／Linux 的主 run 10:30:20 成功。 |
| Full 首轮 | 10:15:38–10:20:35；[40258219160](https://github.com/gaofeng21cn/one-person-lab-app/actions/runs/40258219160) | `Resolve Full runtime cache keys` 命中 runner 的 Node 24.21.0，被 carrier 安全策略拒绝。 |
| Full 恢复 | 10:29:14–11:30:06；[40259324270](https://github.com/gaofeng21cn/one-person-lab-app/actions/runs/40259324270) | Full、普通账号 clean-VM 与 Full Cask 完成，上传 `full_qualified` checkpoint。 |

Studio 修复 `f7d9d724` 将 updater 资格验收接入 Host 就绪 promise，再调用原有 updater operation，保留启动错误传播；15 项定点测试与 typecheck 通过。旧 run 没有可复用的签名安装包，且内嵌 updater／main 字节发生改变，因此重建有依据。

App 修复 `add96c0b6` 为 Full workflow 三处 Node 24 setup 启用 `check-latest: true`，继续由 carrier 校验实际版本；9 项 Full 定点测试、仓库正式参数的 actionlint 与 release boundary 通过。Standard 已公开，此次只恢复 Full，没有取消或重发 Standard。修复提交的 [Source Validation 40259218486](https://github.com/gaofeng21cn/one-person-lab-app/actions/runs/40259218486) 成功。

## 耗时依据与效率改进

Full 恢复中的构建为 10:33:25–10:48:58；ULMO 压缩约从 10:39:57 开始。ARM finalizer 10:52:14 开始，Apple 实际提交在 10:54:54，签名／公证 step 于 11:06:14 成功。Full DMG 下载为 11:13:52–11:21:19，约 7 分 27 秒；11:21:43 出现 VM 网络 marker，11:23:14 页面就绪，11:25:17 基础 smoke 通过，其后 Temporal 生命周期通过。11:27:33 上传 qualified checkpoint，约 11:29 公开。

保留 ULMO 缩小下载体积的取舍。当前证据不能证明改压缩格式能减少整体交付耗时。存在已验证的 `full_built` 或更后 checkpoint 时，应消费它继续验收／公开，避免重复签名构建。

本机首次准备还暴露了两个能更早发现的问题：Shell 安装目录仍含 DSH 0.2.0-rc.2，而冻结 lockfile 要求 0.2.1-rc.2；默认 Node 26.10.0 低于 carrier 的安全下限。依赖按冻结 lockfile 重装，Node 选择已有安全运行时后继续。另有一次公开 Package 下载失败，经有界只读重读校验成功，没有修改源码或扩大重试。

本次后续改进已将 Node admission 和离线 Shell 直接依赖检查接入正式 source gate 的 pre-admission，在昂贵 consumer 与公开源下载前阻断这两类环境问题。Node 规则仍由冻结 Shell carrier 持有，依赖判断复用 npm；不新增版本表、lock 或安装器。回归覆盖两个失败都阻止昂贵 required gates。未测量下一次发布的节省时间，不给出估算承诺。

运行中 GitHub job-log API 曾返回 404／BlobNotFound。Chrome 当前日志能提供 `phase`／`at`、签名与 VM marker；后期确认本机就是 GUI VM runner，可直接读取当前 job 的 wrapper stderr。后续先核对 runner 身份，再选最短证据路径；API 无日志和 `child_running: true` 都不能证明业务进展或卡死。已核实日志通过现有 incident CLI 的 `--job-id`／`--job-log-file` 分析。

## 公开回读

| 对象 | 公开身份 |
| --- | --- |
| Standard DMG | SHA-256 `5d8f79bbb75bc1c67a76adc3f6ee7ced4d54ee4f8d384b0027e107ae928689f7` |
| Full DMG | 937303084 bytes；SHA-256 `cbc98be9b0a087b3755d3e4b164c74d86f632afcba402e4886b575047fbf4bac` |
| Full manifest | SHA-256 `d74cab429bca94ff57e36985a161bc6cd214b3f36ea52ae244b43625010b31f6` |
| Homebrew | Standard／Full Cask 均为 `26.10.2691,26.10.26`，摘要各自匹配公开 DMG。 |
| Docker | `26.10.26`、`stable`、`latest` 同指向 `sha256:d350632922b1af0b38a532db6e45f16c19e4c4b14020c03c6c1606b91a0cbe2f`，含 amd64／arm64。 |

以上是本轮历史证据，后续操作从当前发布合同、owner run 与实时 checkpoint 读取，不将这些版本、run 或摘要用作默认参数。通用操作见 [发布 SOP](../stable-release-sop.md)。

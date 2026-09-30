# 2026 年 9 月 Studio 切换证据

Owner: `one-person-lab-app`
Purpose: 原始 Studio 切换的发布与迁移出处。
State: `historical_cohort_evidence`

本文保留原 [Studio 产品边界](../product/gui/opl-studio-plan.md) 记录的固定版本事实。
它说明旧 AionUI 退役和迁移资格的来源，不代表当前 Latest、安装状态或后续版本验收。
当前身份与路线归 [分发与安装参考](../delivery/distribution-and-install-ssot.md)，
发布操作归 [发布指南](../delivery/release/README.md)。

## 原始公开产物

| 产物 | 原记录及范围 |
| --- | --- |
| macOS Standard | `v26.9.25-r1` 同 tag 修复包，机器版本 `26.9.2594`；构建运行 [36118012448](https://github.com/gaofeng21cn/one-person-lab-app/actions/runs/36118012448)，原字节首装验收 [36120104132](https://github.com/gaofeng21cn/one-person-lab-app/actions/runs/36120104132)。原记录包含签名、公证、Gateway 登录、Official Profile 首装和运行就绪。 |
| macOS Full | 运行 [36114062851](https://github.com/gaofeng21cn/one-person-lab-app/actions/runs/36114062851) 发布 `26.9.2592` 首装包，记录准确签名包首装与 Temporal 生命周期验收；后续更新通过 Standard feed。 |
| Studio Preview | `0.1.19` 保留固定签名的 `26.9.2593` 交接目标，再由 Stable 更新器接续。该目标不随后续 Latest 自动改变。 |
| Docker WebUI | 运行 [36109952035](https://github.com/gaofeng21cn/one-person-lab-app/actions/runs/36109952035) 发布 Studio `26.9.25-r1`；当时 `stable`、`latest` 与版本 tag 回读为 `sha256:319ffc9cc3d5078a6363bc673b85176cda1a489d29e390338bfd1b96ac2b124b`。原生 amd64/arm64 验收覆盖启动、登录、Framework/Codex 就绪、上传与数据卷重启持久化；保留旧仅密码配置并持久保存自动生成的会话密钥。 |
| Windows x64 | 安装器、blockmap、更新元数据与实际构建来源追加至同一 Stable Release，明确未签名；该发布记录不证明真实 Windows 旧版升级认证。 |

## 已记录迁移路线

- Preview `0.1.17`、`0.1.18` 经原生更新到 `0.1.19`，再交接其固定 Stable 目标，记录隔离 VM 验收。
- AionUI `26.9.23` 的连续升级链为 `26.9.2391 → 26.9.2593 → 26.9.2594`。
- AionUI `26.8.8` 的连续升级链为 `26.8.890 → 26.9.2592 → 26.9.2593 → 26.9.2594`。

旧版链的原记录在真实 Codex `0.157` 下验证普通与归档中文历史、置顶、附件、原数据库
保留及重复更新检查。连续升级证据不能改写为每个旧版本都已一步直达；这些记录也不
资格化后续 App、Codex 或迁移来源字节。Nightly、其他平台和 Cloud activation 各自取证。

`opl-aion-shell` 的生产构建入口已迁出，归档保留源码、tags、Release 和固定测试夹具。
这些材料只用于 provenance、恢复和旧版迁移，不能恢复为当前生产来源。

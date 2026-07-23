# OPL 能力治理

本文件说明 OPL App 如何消费能力图，不定义第二份 Skill、Plugin、CLI 或 MCP 清单。机器边界在
`contracts/app-install-exposure-policy.json#capability_governance`，能力声明本身归 OPL Flow，安装状态和
生命周期证据归 OPL Framework。

## 权威分工

| 层 | 负责 | 不负责 |
| --- | --- | --- |
| OPL Flow | 能力图、来源与版本要求、默认安装、激活方式、离线载体策略、冲突与凭据策略 | 安装状态、锁、用户秘密、App UI 或发布执行 |
| OPL Base / Framework | release-lock 解析、安装、更新、回滚、currentness、reconciliation、receipt 和统一投影 | 第二份能力清单或领域能力判断 |
| OPL App | GUI、安装进度、用户选择、载体入口和 release-frozen projection | Skill、Plugin、CLI、MCP 的生命周期真相 |

App 可以维护名称、说明、排序、分组等产品展示元数据，但不得用这些元数据决定 managed capability
是否安装或 current。Settings 必须读取 Framework 统一投影，并把 Flow-managed 与用户/第三方能力分组展示。

能力身份固定为 `(kind, id)`。例如 `codex_skill:officecli` 与 `cli:officecli` 是两个能力，不能因文本 id
相同而折叠。

## Standard 与 Full

Standard 和 Full 是同一目标安装形态的两种交付方式，不是两个功能版本。

```text
standard_target_closure == full_target_closure
standard_source = online_exact_release_lock
full_source = embedded_exact_release_lock
standard_final_projection == full_final_projection
```

`online_install_default=true` 表示 Standard 和 Full 的最终 managed installation 都必须包含该能力。
`offline_bundle=full` 表示 Full 必须预置同一 release lock 的精确字节。它不表示 Full 独占该能力。
`activation` 只决定安装后何时加载，不改变是否安装。

最终一致性在 Framework terminal reconciliation receipt 上验收，至少包括版本、digest、lock、Skill/Plugin
discovery 和 capability projection。GUI 已打开或 `ready_to_launch` 不足以证明 Full readiness。

## Full 冻结投影

`contracts/app-full-third-party-source-manifest.json` 是发行期冻结投影，不是依赖 authority。它绑定：

- OPL Flow policy 的 exact commit、schema 和 SHA-256；
- Framework Release Set 与 bundled catalog 的 exact commit 和 SHA-256；
- 第三方源、toolchain 与 runtime payload 的精确版本、ref 和 digest；
- Framework lifecycle receipt 与 Standard/Full 最终投影等价 receipt 要求。

Full 构建只消费上述冻结闭包。Standard 在线取得相同闭包时也必须使用该发行 cohort 的精确版本和 digest，
不能把构建时或安装时的 latest 当作真相。

## MCP 与凭据

Flow 可以用同一能力图声明 MCP，但默认安装的 MCP 必须先有 Framework lifecycle adapter，并具备安装、更新、
回滚和 currentness receipt。声明本身不等于已安装。

API Key、OAuth token、账户状态和其他秘密始终由用户或 provider 持有，不进入 Flow policy 或 Full 安装包。
迁移不得复制凭据。未由 Flow 声明的用户和第三方 MCP 必须保留，不能因不在 managed graph 中而删除或覆盖。

模型访问检测优先解析本机 Codex `config.toml` 中当前 selected provider：已有可用 access 时直接复用，不重复
要求 API Key，也不重写 provider。`opl system configure-codex --api-key-stdin` 只用于用户明确新增或轮换凭据，
不得安装、更新、修复、启停或同步任何 Package/Skill/Plugin。

Package reconciliation 与 provider 配置完全解耦。API Key 或 provider 缺失不得阻止 Standard、Full、DMG、
本地安装或后续 currentness；Framework 必须按 Release Set 与 payload digest 通过 carrier-neutral managed
update plane 处理 bundled locks 和在线 locks，并给出 terminal receipt。

## 模型策略

App 模型选择优先级固定为：

```text
用户显式选择
> 已安装 OPL Flow recommendation
> fresh Codex live default
> Flow 不可用时的 App fallback
```

App profile 中的具体模型和 reasoning 值是可用性 fallback，不与已安装 Flow policy 竞争。App 负责展示 live
catalog 和提交用户选择，Framework 负责需要持久化的受控配置 mutation。

## 工作流状态权限

Flow 可以定义 `ACTIVE` 与 `SAFE_TO_ARCHIVE` 等协调语义。`SAFE_TO_ARCHIVE` 只允许改标题和登记完成证据；
实际归档必须等待用户针对具体任务或对话的 fresh 验收。Git、Package、安装、发布和归档 mutation 仍分别服从
对应 owner 和权限边界。

## 验收

- Flow policy/schema 通过验证，package payload 中提供的 Skills 与 manifest 一致。
- Framework lock、payload、owner ref 和 fresh Codex discovery 一致。
- Standard 与 Full 解析出同一默认 `(kind, id)` 闭包和 exact release lock。
- 每个 managed dependency 有 install/update/rollback/currentness evidence。
- Full 字节与 release lock 一致且不含秘密。
- App 只消费 Framework 统一投影，不存在第二份 managed inventory。
- Flow 未安装时 App fallback 可用，安装后 Flow recommendation 优先。

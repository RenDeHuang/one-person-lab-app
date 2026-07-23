# OPL 能力治理

本文件说明 OPL App 如何消费能力图，不定义第二份 Skill、Plugin、CLI 或 MCP 清单。机器边界在
`contracts/app-install-exposure-policy.json#capability_governance`，能力声明本身归 OPL Flow，安装状态和
生命周期证据归 OPL Framework。

## 权威分工

| 层 | 负责 | 不负责 |
| --- | --- | --- |
| OPL Flow | 能力意图、可选来源/版本提示、默认安装、激活方式、冲突与凭据策略 | 安装状态、锁、payload、用户秘密、App UI 或发布执行 |
| OPL Base / Framework | 兼容能力解析、安装动作、更新、回滚、currentness、reconciliation、receipt 和统一投影 | 第二份能力清单或领域能力判断 |
| OPL App | GUI、安装进度、用户选择、载体入口和 Framework 投影 | Skill、Plugin、CLI、MCP 的依赖或生命周期真相 |

App 可以维护名称、说明、排序、分组等产品展示元数据，但不得用这些元数据决定 managed capability
是否安装或 current。Settings 必须读取 Framework 统一投影，并把 Flow-managed 与用户/第三方能力分组展示。

能力身份固定为 `(kind, id)`。例如 `codex_skill:officecli` 与 `cli:officecli` 是两个能力，不能因文本 id
相同而折叠。

## 开放组合

Base、App 和 Package 独立版本、独立发布，默认可以自由组合。Flow 是便于管理的一组能力意图，不是锁定
具体安装字节的环境文件。

```text
Flow requires/recommends
  -> Framework 复用已有兼容能力
  -> 缺失时投影通用 install action
  -> App 只展示并执行 Framework projection
```

`source`、`version_requirement`、`install_source` 和 `offline_bundle` 都是可选提示，不是 capability identity，
也不是 Flow、Standard、Full 或 App readiness 的前置。lock 只在具体安装或发布实际发生后记录结果；
没有安装就不要求预先存在 lock。

Full 可以携带构建时已有的兼容 payload，减少首次安装成本；缺少某个可选 payload 时继续由 Framework
解析已有能力或给出安装动作。Standard 与 Full 不要求字节、目标闭包或最终投影完全相同。

## Full 冻结投影

`contracts/app-full-third-party-source-manifest.json` 只记录某次 Full 构建实际选择的输入，不是依赖 authority。
正式发布仍可为其实际包含的字节记录 commit、digest 和 receipt，但这些记录不能反向成为 Flow 依赖前置。
它可以绑定：

- OPL Flow policy 的 exact commit、schema 和 SHA-256；
- Framework Release Set 与 bundled catalog 的 exact commit 和 SHA-256；
- 第三方源、toolchain 与 runtime payload 的精确版本、ref 和 digest；
- Framework lifecycle receipt 与实际 payload inventory receipt。

某次 Full 构建内的已选 payload 仍应可复现和校验；未选择的能力不因此无效，也不阻断 App 或 Flow。

## MCP 与凭据

Flow 可以用同一能力图声明 MCP，但默认安装的 MCP 必须先有 Framework lifecycle adapter，并具备安装、更新、
回滚和 currentness receipt。声明本身不等于已安装。

API Key、OAuth token、账户状态和其他秘密始终由用户或 provider 持有，不进入 Flow policy 或 Full 安装包。
迁移不得复制凭据。未由 Flow 声明的用户和第三方 MCP 必须保留，不能因不在 managed graph 中而删除或覆盖。

模型访问检测优先解析本机 Codex `config.toml` 中当前 selected provider：已有可用 access 时直接复用，不重复
要求 API Key，也不重写 provider。`opl system configure-codex --api-key-stdin` 只用于用户明确新增或轮换凭据，
不得安装、更新、修复、启停或同步任何 Package/Skill/Plugin。

Package reconciliation 与 provider 配置完全解耦。API Key 或 provider 缺失不得阻止 Standard、Full、DMG、
本地安装或后续 currentness；Framework 通过 carrier-neutral managed update plane 解析当前能力并给出
projection、action 或 receipt。

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

- Flow policy/schema 通过验证，`agent-reach` 等依赖由 `(kind, id)` 声明。
- Framework 优先复用已有兼容能力，缺失时返回通用安装动作。
- lock 与 payload 不作为声明或 readiness 前置。
- Full 只校验自己实际携带的字节，未携带的可选 Skill 不阻断发布或安装。
- App 只消费 Framework 统一投影，不存在第二份 managed inventory。
- Flow 未安装时 App fallback 可用，安装后 Flow recommendation 优先。

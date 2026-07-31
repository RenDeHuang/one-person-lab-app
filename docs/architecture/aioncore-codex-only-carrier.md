# AionCore Codex-Only Carrier

Owner: `one-person-lab-app`
Purpose: `aioncore_codex_only_packaging_ssot`
State: `source_implemented_packaged_runtime_evidence_pending`
Machine boundary: `contracts/app-shell-adapter.json#codex_executable_contract.carrier.target_packaging_policy`

## 结论

OPL 不 fork、不 patch AionCore，也不维护第二套 Codex 下载器或版本 SSOT。AionCore
`prepare-managed-resources` 继续完整导出 Node、Claude 和 Codex，但该导出只进入临时
staging。Shell 从上游 manifest 选择 Node 和 Codex，生成 OPL-owned projection；Standard
与 Full 最终包都只携带 AionCore、Node 和 Codex，并物理排除 Claude。

这是当前开发和维护成本最低的平衡点：

- AionCore 版本、Node/Codex 字节与 digest 继续跟随上游 AionCore release。
- OPL 只维护一次小而显式的打包投影，不接管 AionCore 内部实现。
- Standard 与 Full 共用 `bundled-aioncore`，无需两套 carrier。
- 未来 Native GUI 可替换 shell/carrier，不需要迁移 Framework 或 Codex thread authority。

App PR #149 与 Shell PR #32 已把 Codex-only projection、resolver、最终树排除策略和
source tests 吸收到 canonical main。当前不再存在“Shell source 仍打包 raw export”的
已知实现缺口；尚未完成的是新的 Standard/Full installed artifact replay，不能用 source
tests 代替最终下载、安装与运行时证据。

## 三层 SSOT

| 层 | Owner | 内容 | 是否进入最终包 |
| --- | --- | --- | --- |
| Producer export | AionCore | schema v2；Node + Claude + Codex；版本和 digest 来源 | 否，只作临时 staging |
| Packaged projection | `opl-aion-shell` | `opl_aioncore_managed_resources_projection.v1`；Node + Codex；引用 producer manifest digest | 是 |
| Distributed bundle | `one-person-lab-app` release | 必需 AionCore、Node、Codex，并带 projection manifest 和 producer digest provenance；CLI set 恰为 Codex；Standard/Full 共用 | 是；Claude 必须物理不存在 |

Projection 不是第二个版本源。它只能复制 producer export 已声明并校验的 Node/Codex entry，
记录 producer manifest digest，并证明 Claude 被排除。禁止把 `clis=["codex"]` 冒充
AionCore schema v2，也禁止把原始含 Claude 的 manifest 留在 distributed root。

目标 manifest 的最小语义为：

```json
{
  "schema": "opl_aioncore_managed_resources_projection.v1",
  "runtimeKey": "darwin-arm64",
  "source": {
    "schemaVersion": 2,
    "manifestSha256": "<producer-manifest-sha256>",
    "cliNames": ["claude", "codex"]
  },
  "node": "<exact producer node entry>",
  "clis": ["<exact producer codex entry>"],
  "projection": {
    "includedCliNames": ["codex"],
    "excludedCliNames": ["claude"],
    "requiredAbsentPaths": ["cli/claude"]
  }
}
```

字段细节由 Shell source 和测试固定，但不得改变上述 owner、来源和物理缺失语义。

## 当前与目标

| 事项 | 当前 source 状态 | 剩余终态 |
| --- | --- | --- |
| AionCore | upstream release，OPL 不修改 | 保持 |
| Producer export | Node + Claude + Codex | 保持，仅作 staging |
| Final `managed-resources` | source verifier要求 OPL projection，只含 Node + Codex | 新 artifact tree readback |
| Standard | source/package policy携带 slim `bundled-aioncore` | clean install/Finder replay |
| Full | 与 Standard 共用 slim AionCore carrier，无 Framework duplicate Codex | Full clean install后再执行 Standard update |
| CI cold cache | 仍可下载 Node + Claude + Codex 到 task-scoped staging | 保持；不得进入用户 artifact |
| 用户下载/安装 | source 已要求 Claude 五类物理缺失 | 新 Standard/Full artifact tree 逐项证明 |
| Framework headless | 独立 carrier | 保持，不进入 App bundle |

macOS arm64 当前 Claude payload 约 `247,124,336` bytes（`235.7 MiB`）installed、
gzip 约 `72,579,289` bytes（`69.2 MiB`）。实际 release 节省量以最终各平台 artifact
diff 为准，不能把单平台估算写成所有平台的完成证据。

## 必须实现

### App SSOT

Owner: `one-person-lab-app`

- 已固定三层 owner 和不 fork AionCore 的边界。
- 已固定 Standard/Full required components、CLI exact set 和 Claude physical-absence policy。
- source implementation 已完成；packaged/runtime evidence 仍须单独登记。
- 保留 Framework headless carrier 和未来 Native carrier independence。

### Shell producer

Owner: `gaofeng21cn/opl-aion-shell`

- 已由 canonical source 实现 task-scoped staging、producer schema v2 校验、Codex-only
  projection、cache currentness、失败清理和 projection resolver。
- AionCore 继续从其预期物理目录启动；OPL 不 patch AionCore。
- 新 source binding 在 packaged startup 生成 `opl_codex_runtime_identity.v1`，并把同一
  Codex path、`CODEX_HOME`、identity JSON、cohort ref 和 PATH 传给 direct App Server
  与 AionCore child。

### Consumers 和 release gates

Owner: `gaofeng21cn/opl-aion-shell`，App 只消费最终证据。

- 目标 Standard/Full Desktop 必须接受同一 projection schema。
- Standard/Full package verifier证明 AionCore、Node、Codex 存在且 digest 对齐 producer。
- 最终树证明 `managed-resources/cli/claude`、Claude executable、Anthropic
  package/archive 和 distribution cache entry 均不存在。
- 原始 producer manifest 不得进入 final distributed root。
- OPL 不发现、不验证、不支持 Claude route；同时不删除用户自行安装的文件。
- Windows WSL2 与 Web CLI 若消费同一 `bundled-aioncore`，必须在各自下一次 publication
  前通过 compatibility gate，但不阻塞本 App SSOT lane。

## Issue 122 Runtime Identity SSOT

本次 carrier 裁剪与 Issue 122 的 runtime identity closure 正交。它减少重复 payload，
但 Claude 是否存在不影响单一 Codex identity 能否成立。当前机器 SSOT 是
`contracts/app-runtime-bridge.json#shared_gui_runtime_resolution_policy`，证据格式是
`contracts/opl-codex-runtime-identity-evidence.schema.json`。

### 已落实的 source binding

- Shell 从 Codex-only projection 生成 `opl_codex_runtime_identity.v1`。
- identity 固定 `path`、`realpath`、version、binary SHA-256、`CODEX_HOME`、runtime key、
  cohort ref、producer manifest digest 和 projection manifest digest。
- direct `codex app-server` 在 spawn 前重新验证 realpath、digest、`CODEX_HOME` 和 cohort；
  identity 存在时禁止回退 global Codex、其他 managed path 或 host PATH。
- AionCore child 继承同一 `OPL_CODEX_BIN`、`CODEX_HOME`、identity JSON、cohort ref 和
  Codex-first PATH；managed projection 中 Codex candidate 数量必须恰为 1。
- 本地缺失、不可执行、未激活和 identity drift 保留 typed OPL error：
  `USER_AGENT_NOT_INSTALLED`、`USER_AGENT_COMMAND_NOT_FOUND`、
  `MANAGED_RUNTIME_UNAVAILABLE`、`RUNTIME_ACTIVATION_REQUIRED`、
  `RUNTIME_IDENTITY_MISMATCH`。

### 明确不做

- 不 fork、不 patch、也不等待 AionCore 增加 API。
- 不声称 AionCore 提供了不存在的 native identity readback。
- 不把 exact identity 变成 App install/runtime readiness gate；能力与版本化 schema
  compatibility 仍是产品 admission basis。
- 不要求 App GUI 与 Framework headless 安装使用同一物理 Codex。Framework headless
  carrier 是独立部署边界，不进入 Standard/Full App bundle。

### 仍需真实 artifact trigger

`same_physical_runtime_currently_claimed` 保持 `false`，直到同一批真实安装证据同时包含：

1. `full_clean_install_finder`：无 global Codex、`PATH=/usr/bin:/bin`、Finder 启动、
   direct initialize 与 ACP ordinary conversation real response 均通过。
2. `standard_update_after_full_finder`：先安装 Full，再应用 Standard update，完全退出并从
   Finder 重启；同样两条 handshake 通过。
3. 两个 run 都比较 path、realpath、version、SHA-256、`CODEX_HOME` 和 cohort ref，并附
   artifact tree、environment、process inspection 与 handshake log digest。
4. 两个 run 都执行五类 typed-error negative probes。
5. `validate:codex-runtime-identity-evidence` 只有在 artifact 与全部 evidence ref 文件真实
   存在且 SHA-256 匹配时才报告 `artifact_evidence_complete=true`；仅通过 JSON shape
   校验不得升级为运行时完成证据。

ACP 侧证据的正式 claim scope 是
`opl_controlled_input_and_successful_handshake_without_aioncore_native_readback`。这能在不改
AionCore 的前提下证明 OPL 控制边界和真实功能结果，但不能改写成“AionCore 自己回报了
identity”。

## 问题清单与验收

| ID | 状态 | 问题 / 计划 | Owner / 完成条件 | 实际工时 |
| --- | --- | --- | --- | --- |
| A3 | source完成 | Codex-only projection、Claude 排除、App consumption | App PR #149 + Shell PR #32 canonical/parity/close | 已完成 |
| R1-S | source完成 | 唯一 identity、direct 强校验、AionCore env、typed errors | Shell focused/type/lint/full + canonical parity/close | 约 6-8 小时 |
| R1-C | source完成 | evidence schema、validator、negative tests、App SSOT | App focused/release/active-shell + canonical parity/close | 约 4-6 小时 |
| R1-F | 待 artifact trigger | Full clean install + minimal PATH + Finder 双 handshake | 新 Full artifact、独立安装环境、evidence validator passed | 2-4 小时 |
| R1-U | 待 artifact trigger | Full 后应用 Standard update + restart/Finder 双 handshake | 新 Standard artifact、真实 updater、同一 evidence record passed | 3-5 小时 |
| R1-N | 待 artifact trigger | 五类 typed error probes | 两个 run 均保存 typed machine evidence | 2-3 小时，可与 R1-F/U 重叠 |
| U1 | optional | AionCore native identity/readback API | 仅上游自然提供时再消费 | 不纳入计划 |

source slice 约 `10-14` 工程小时。若可用的签名 Full/Standard artifacts、更新通道和干净
macOS 环境均已就绪，最终 artifact replay 约 `1` 个工作日；若需要重建/签名 artifact
或修复首个真实安装断点，合理总 ETA 是 `1-2` 个工作日。任何 upstream review/release
时间都不是关键路径。

## 并行执行图

```text
Shell identity source + tests
  -> Shell canonical integration
       -> App contract/schema/tool + active-shell cross gate
            -> App canonical integration

Artifact phase:
  Full artifact build --------\
                               -> clean install/Finder run
  Standard artifact build ----/     -> Standard update/restart/Finder run
  typed negative fixtures ---------> both runs
```

Full 与 Standard artifact build、negative fixture 准备可以并行；同一安装 VM 上的
Full clean install -> Standard update -> restart 必须串行。两仓 canonical `main` 吸收也
必须使用各自 expected-head 短时串行，不能创建第二 writer。

## 精确门禁

1. App JSON parse、runtime identity evidence validator、contract negative tests。
2. Shell identity/resolver/startup focused tests、typecheck、lint、format、full unit aggregate。
3. fresh App/Shell main replay、cross-repo active-shell gate、remote tree/blob parity。
4. artifact trigger 时验证 Full/Standard SHA-256、installed tree 和 Finder minimal PATH。
5. direct App Server initialize、ACP real response、process/environment inspection与 typed errors。
6. `npm run validate:codex-runtime-identity-evidence -- --input <evidence.json>`。

测试通过、task branch、PR 或 candidate package都不是 #122 终态。source lane 必须
canonical/parity/official close；Issue 仍保持 OPEN，直到 packaged evidence validator
通过且获得单独的 Issue 回复/关闭授权。

## 非目标

- fork、patch 或等待 AionCore 增加新 CLI/API。
- 让 OPL 自己下载、升级或选择 Codex 版本。
- 删除 Framework headless carrier。
- 禁止用户机器上独立安装 Claude。
- 在没有 packaged smoke 时关闭 Issue 122 或声称 runtime identity 已完全证明。

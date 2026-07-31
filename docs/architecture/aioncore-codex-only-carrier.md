# AionCore Codex-Only Carrier

Owner: `one-person-lab-app`
Purpose: `aioncore_codex_only_packaging_ssot`
State: `target_policy_implementation_pending`
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

当前 Shell 仍把完整 AionCore export 放进最终包。因此本文和机器合同定义的是已授权目标，
不是完成证明；只有 Shell canonical source、跨平台测试和 packaged artifact readback
通过后，状态才可改为 implemented。

## 三层 SSOT

| 层 | Owner | 内容 | 是否进入最终包 |
| --- | --- | --- | --- |
| Producer export | AionCore | schema v2；Node + Claude + Codex；版本和 digest 来源 | 否，只作临时 staging |
| Packaged projection | `opl-aion-shell` | `opl_aioncore_managed_resources_projection.v1`；Node + Codex；引用 producer manifest digest | 是 |
| Distributed bundle | `one-person-lab-app` release | AionCore + Node + Codex；Standard/Full 共用 | 是；Claude 必须物理不存在 |

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

| 事项 | 当前真实状态 | 目标 |
| --- | --- | --- |
| AionCore | upstream release，OPL 不修改 | 保持 |
| Producer export | Node + Claude + Codex | 保持，仅作 staging |
| Final `managed-resources` | raw AionCore schema v2，含 Claude | OPL projection，只含 Node + Codex |
| Standard | 携带完整 `bundled-aioncore` | 携带 slim `bundled-aioncore` |
| Full | Standard AionCore 之外已移除 Framework duplicate Codex | 与 Standard 使用同一 slim AionCore carrier |
| CI cold cache | 下载 Node + Claude + Codex | 暂时保持；不是用户下载或安装成本 |
| 用户下载/安装 | 仍包含 Claude | Claude 目录、binary、package/archive/cache 均不存在 |
| Framework headless | 独立 carrier | 保持，不进入 App bundle |

macOS arm64 当前 Claude payload 约 `247,124,336` bytes（`235.7 MiB`）installed、
gzip 约 `72,579,289` bytes（`69.2 MiB`）。实际 release 节省量以最终各平台 artifact
diff 为准，不能把单平台估算写成所有平台的完成证据。

## 必须实现

### App SSOT

Owner: `one-person-lab-app`

- 固定三层 owner 和不 fork AionCore 的边界。
- 固定 Standard/Full exact packaged components 和 Claude physical-absence policy。
- 区分 current raw manifest 与 target projection，禁止提前声明 implemented。
- 保留 Framework headless carrier 和未来 Native carrier independence。

### Shell producer

Owner: `gaofeng21cn/opl-aion-shell`

- `prepareAioncore` 将上游完整导出写到 task-scoped staging。
- 校验 producer schema v2 恰有 Node、Claude、Codex。
- 只复制 Node/Codex 到最终 `managed-resources`，生成 OPL projection。
- cache key 增加 projection schema/version，旧 full cache 不得命中。
- `finally` 清理 staging；失败不得留下可被打包的 partial projection。
- Codex resolver 改读 OPL projection，同时 AionCore 继续按物理目录启动。

### Consumers 和 release gates

Owner: `gaofeng21cn/opl-aion-shell`，App 只消费最终证据。

- macOS/Linux desktop、Windows WSL2 和 Web CLI 接受同一 projection schema。
- Standard/Full package verifier证明 AionCore、Node、Codex 存在且 digest 对齐 producer。
- 最终树证明 `managed-resources/cli/claude`、Claude executable、Anthropic
  package/archive 和 distribution cache entry 均不存在。
- 原始 producer manifest 不得进入 final distributed root。
- 保留可选 system Claude discovery；“OPL 不随包提供 Claude”不等于禁止用户自行安装。

## Issue 122 Runtime Identity 边界

本次 carrier 裁剪是 Issue 122 的必要基线，但不等于完整 runtime identity closure。
OPL 必须在自己控制的边界完成以下工作，且不要求修改 AionCore：

- Shell 从 projection 解析 Codex，向 direct App Server 和 AionCore ACP 注入同一
  `OPL_CODEX_BIN` / managed-resource directory。
- App/Shell 记录 path、realpath、version、sha256、`CODEX_HOME` 和 release cohort。
- Standard update + restart、packaged Finder launch、Full 和 Windows WSL2 分别 replay。
- OPL adapter 将本地缺失、不可执行、digest 不匹配和启动失败映射为 typed local errors。

AionCore 内部增加 identity readback 或更细 typed errors 仅是 upstream enhancement，
不是 OPL 的 blocker，也不应成为计划前提。若没有 AionCore 内部 readback，OPL 用受控输入、
启动结果和实际 child-process/artifact inspection 证明边界；不能声称看到了 AionCore
未暴露的内部状态。

## 问题清单与验收

| ID | 问题 | Owner / write surface | 完成条件 | 估时 |
| --- | --- | --- | --- | --- |
| C1 | App 仍把 raw manifest/Claude 当 packaged dependency | App exact9 contract/docs/test | canonical main + remote blob parity；状态仍为 pending | 0.5-1 日 |
| S1 | Shell prepare 直接把完整 export 放入 final root | Shell producer/projection/verifier/cache | focused tests；cold-cache prepare；final manifest exactly Codex | 1-1.5 日 |
| S2 | Desktop resolver 只认识 AionCore schema v2 | Shell resolver/tests | macOS/Linux resolver从 projection返回 exact Codex | 含在 S1 |
| X1 | Windows/Web/CI fixtures 固化 raw manifest | Shell consumers/fixtures/workflow | Windows WSL2、Web CLI、reusable build gates通过 | 0.5-1 日 |
| Q1 | 尚无真实 packaged absence evidence | Shell package smoke + App release consumption | Standard/Full final tree四类 Claude absence evidence | 0.5 日，可与 X1 重叠 |
| R1 | Issue 122 runtime identity 尚未闭合 | App/Shell runtime contract/tests | 同一 identity 六字段跨 direct/ACP/update/restart/Finder readback | 1-2 日，可在 S1 schema冻结后并行 |
| U1 | AionCore native identity/typed-error API 不存在 | upstream optional | 仅在上游自然提供时消费；不 fork、不阻塞 OPL | 不纳入关键路径 |

总工程量约 `2-3.5` 工程日；schema 冻结后并行推进，预计 `1.5-2.5` 个工作日，
另加 hosted CI 排队和跨平台 runner 可用时间。真实 ETA 以第一个 cold-cache/package
smoke 断点为准。

## 并行执行图

```text
App contract/docs/test (C1)
  -> canonical App SSOT
       -> Shell producer + projection + verifier (S1/S2)
       -> Windows/Web fixtures and CI gates (X1)
       -> runtime identity instrumentation/tests (R1)
            -> serialized fresh-main integration
            -> macOS/Linux/Windows/Web packaged smoke (Q1)
            -> App cross-repo gate and status update
```

`S1/S2` 冻结 projection schema 后，`X1` 与 `R1` 可以独立 worktree 并行。共享 Shell
`main` 吸收、真实 package build、App contract状态从 pending 改为 implemented，必须串行。

## 精确门禁

1. App JSON parse、Codex carrier focused test、adapter contract validator。
2. Shell producer/resolver/verifier focused tests、typecheck、lint、full unit aggregate。
3. macOS cold-cache `prepareAioncore`，证明 staging 清理和 slim cache currentness。
4. macOS packaged `afterPack` 与 Standard/Full tree inspection。
5. Linux Web CLI smoke。
6. Windows WSL2 reusable build/guest bootstrap 和 projection readback。
7. fresh App/Shell main replay、cross-repo active-shell gate、remote tree/blob parity。

测试通过、task branch、PR 或 candidate package都不是终态。只有 canonical source、
packaged artifact readback 和 task-owned lifecycle cleanup 完成，才能把
`implementation_status` 改为 implemented。

## 非目标

- fork、patch 或等待 AionCore 增加新 CLI/API。
- 让 OPL 自己下载、升级或选择 Codex 版本。
- 删除 Framework headless carrier。
- 禁止用户机器上独立安装 Claude。
- 在没有 packaged smoke 时关闭 Issue 122 或声称 runtime identity 已完全证明。

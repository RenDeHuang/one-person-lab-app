# v26.9.29 发布恢复复盘

本次产品发布已完成。本文件记录发布时发现的断点、实际恢复证据及发布后的防复发修改；通用操作规则以 [发布 SOP](../stable-release-sop.md) 为准。本次改进不派发新产品、不替换公开资产，也不重复已通过的签名、公证和 clean-VM 门禁。

## 时间与产物

以下为北京时间（UTC+8）。Standard owner [36457965279](https://github.com/gaofeng21cn/one-person-lab-app/actions/runs/36457965279) 于 2026-09-29 01:25:03 创建，01:54:44 Standard 已公开，约 29 分 41 秒。该 run 最终 failure 来自附加渠道，不能据此否定 Standard 已公开的事实。

Full 最终恢复 run [36471644453](https://github.com/gaofeng21cn/one-person-lab-app/actions/runs/36471644453) 于 03:21:15 创建，03:36:24 已确认整轮 success，包含 Full 与 Homebrew Full；03:36:24 是观测时间，不能冒充精确完成时间。从首次 Standard 派发到这个成功观测约 2 小时 11 分 21 秒，包含失败与恢复；不能用最后成功一轮约 15 分钟的观测窗口替代完整耗时。

冻结产品源码为 App `9af1a21ebdcafbfb0d3b30fef200a97a4f5089eb`、Studio `9d90fa944efde6fe6944070fcff22866c7faf59a`、Framework `33bed849a13852e6d4b3942bfd0866442e4841d3`。最终 Full receipt 的 `qualification.run_id` 为 `36471644453`，`source_artifact_run_id` 仍为 `36462870631`，证明复用原产物完成验收。

公开 Full 文件为 `One-Person-Lab-Full-26.9.29-mac-arm64.dmg`，480435679 bytes，SHA-256 `bf906b6245d154a75d67b097a4526bedbe8fbb6614e321bdb38872216a7e2e1b`。Windows 恢复成功 run 为 [36463382776](https://github.com/gaofeng21cn/one-person-lab-app/actions/runs/36463382776)。本次记录不新增 Windows 签名或旧版本升级资格声明。

## 真实断点与改动

| 断点 | 已证事实 | 处理及验证位置 |
| --- | --- | --- |
| 插件迁移后 App 仍校验旧路径 | 干净工作区的 active-shell 检查指向已删除的 Host core；对应合同和文档改动留在原任务工作区 | 审阅并吸收已准备的 DSH package layout、真实插件路径和文档；保留原工作区，Studio conformance 与载体验证通过 |
| Windows guest Host 缺 Bun | Studio 的 Linux guest Host 闭包需要构建 DSH 插件，caller 未安装 Bun | 发布时在 `_build-reusable.yml` 增加 Bun 1.4.0；本轮补充检查 Bun setup 位于真实 `prepare-wsl-host-payload.mjs` caller 前 |
| Gateway 失败原因被丢弃 | 原 Full 登录通过，`gateway_account_use_for_model_access` 返回 error／exitCode 4；旧报告只保留 `gateway_model_access_not_confirmed` | Studio `c294f875b059f0d6bf67c3adc21ee03cbf8e4368` 保留脱敏 machine reason code，并只读回查 owner projection，不重复 mutation |
| 共用 smoke probe 被 scope 拒绝 | [36468760410](https://github.com/gaofeng21cn/one-person-lab-app/actions/runs/36468760410) 在 Full refs admission 失败；Stable smoke 实际复用 Preview probes | 精确纳入 `preview-smoke.mjs` 与其测试，产品/runtime 路径继续拒绝；Standard/Full 正例和反例已覆盖 |
| Full 恢复默认追随 main | controller 将 checkpoint 与当前 App／Shell／Framework refs 比较，误退回 Standard，报源 run 无 Standard checkpoint | controller 恢复默认读取 checkpoint cohort；明确修改产品 refs 才进入相应新候选分支，指定准确 Full artifact 时拒绝冲突 |
| 前置校验通过，回执写入才失败 | [36469592605](https://github.com/gaofeng21cn/one-person-lab-app/actions/runs/36469592605) 的 smoke 已通过，writer 却报 `qualification harness scope proof fields are inconsistent`；前置 scope 来自新 executor，writer import 来自旧 App checkout | 在 VM input job 调用选定 App 的同一 consumer；真实执行 workflow 中的命令，证明旧规则失败、新规则通过、身份不匹配仍拒绝 |
| 运行中已失败，但监控仍显示上传日志 | job 尚未终结时 `first_failure` 为空，最早失败业务 step 被 cleanup／上传步骤掩盖 | incident-status 纳入运行中 job 的失败 step；显式容错及成功 job 保持独立语义 |
| 下载 EOF 输出签名 URL | `gh run download` 的错误带 Azure SAS query，原 formatter 直接回显 | controller 和共享 GitHub CLI error formatter 移除 URL query／fragment、userinfo 和 Authorization 值，保留 host、path、EOF 等诊断 |
| 可选安装包名并不表示上传成功 | 主上传与一次重试均可容错失败，但 `identity` 步骤无条件输出名字，后续提示 Artifact not found | 只有任一上传 outcome 成功才暴露 artifact 名；覆盖主成功、重试成功、双失败及 skipped 状态 |

本次恢复成功时，Shell smoke harness 为 `c294f875b059f0d6bf67c3adc21ee03cbf8e4368`，App verifier 为纯验收修复提交 `fdaa53eb6f03f24d7985d4714117153d614418fa`。这些 SHA 是历史证据，不是以后应复制的默认参数。

## 原因边界与效率结论

首次 Gateway 失败未留下足够 owner 原因，无法从后续相同签名产物的成功倒推出当次根因；已修的是诊断缺失，持续故障仍须依据新的 reason code 定位。恢复不把单次网络或 Gateway 错误自动转换成重复写入。

本轮消除了可复现的恢复默认值错误、晚期 verifier 不兼容、失败识别延迟、签名 URL 泄漏和虚假预备资产名。代码只提前检查确定性输入并复用已有产物，未放宽发布准入。静态与模拟回归可以证明上述行为，不能承诺未经下一次正式发布实测的节省分钟数。

验收使用 controller／incident focused tests、真实 VM 输入命令的隔离执行、Full scope/admission tests、TypeScript、workflow actionlint 及仓库 release-boundary 检查。工作区依赖缺失先通过现有 `ensure:shell` 准备准确 Shell，不修改已发布产品。

本轮本地结果：release-boundary 共 1478 项，首次 1470 通过、7 条件跳过、1 项因新工作区缺少历史 AionUI 夹具而失败；通过现有 OPL_AIONUI_TEST_SHELL_ROOT 指向只读历史夹具后，该唯一受影响用例复测通过。另有 5 项载体合同测试、Studio candidate conformance、active-shell 结构校验、TypeScript 和两份修改 workflow 的 actionlint 通过。未重跑已通过的产品发布或 VM。

# App Security Remediation Correction

状态：`ssot_projection_of_sealed_scan`

本文件是对 2026-07-30 sealed security scan 的产品 SSOT 纠偏投影，不修改、不重跑
原扫描。原扫描仍以其 sealed report、revision 和 finding fingerprint 为证据来源；
本文件只决定这些 finding 应如何进入 App 的修复路线。

## 依据与边界

- Scan：`22ac28a3-c239-4497-a440-4f4437adb4df`
- Revision：`329f84f7163323936166f03765eca2f6622d3096`
- Finding 数：`11`
- Scan manifest SHA-256：`3d40e6d124343042f0393d4307a6e90a9d36a2c179253e8cb32733d9eef450ef`
- Findings SHA-256：`4a3f2d0ea53e46d9ac369e40f1a23e6be51a30469592bb891786591a43225991`
- Sealed report SHA-256：`1f834325c1295b9704bebab3818fd11ea99156f417440bc78557763c8f88a1a2`
- 原始 sealed report：`/private/var/folders/zs/xgbvv4x933d66thpsgz0kqm00000gn/T/codex-security-scans-wUSygV/security-scan-app-20260730/329f84f7163323936166f03765eca2f6622d3096_20260730T143218Z__2izc6vj/report.md`
- 原扫描字节：保持不变；本投影不把 branch、PR、测试或 draft 说成已发布修复。

App 当前组件合同是
`contracts/app-install-exposure-policy.json#component_interoperability`。下载后执行的
安全身份只属于被选中的那个 artifact：owner authority、immutable release tag、asset
URL/name、size、SHA-256，以及适用时的 signature/notarization。匿名/认证下载必须得到
同一字节，安装字节必须等于所选 carrier artifact。

App、Shell、Framework、Base、Package 可以独立发布和组合。跨组件兼容性只能表达为
capability id + versioned schema、minimum version 或 SemVer range；任何精确版本、commit、
SHA、Bundle/BOM 或 same-cohort 相等都不得成为 install/run 拒绝条件。组件 refs 可以作为
build provenance 记录，但 `may_gate_install_or_runtime=false`。

## Finding 分流

| Finding | 标题 | 分流 | 修复边界 |
| --- | --- | --- | --- |
| `csf_a139a080ef77d2e206961d94` | Container WebUI bootstrap executes the mutable App main branch | `retain_self_artifact_integrity` | 选择并校验 App 自身 immutable asset；不绑定其他组件 |
| `csf_32d04f29014d1cb0e19d99e8` | Desktop bootstrap executes the mutable Framework main branch | `retain_self_artifact_integrity` | 选择并校验 Framework 自身 immutable asset；不绑定 App/Shell/Base/Package |
| `csf_bc602d1b659afca6df00f8d3` | Headless bootstrap executes the mutable Framework main branch | `retain_self_artifact_integrity` | 同上，保持 headless 与 App carrier 独立 |
| `csf_e0e64790e0fe02ef693e7fa8` | Official Unix Docker/WebUI command executes the mutable App main branch | `retain_self_artifact_integrity` | 选择并校验被执行的 App installer 自身 identity |
| `csf_563e30ee4eed58f832df9293` | Windows administrator prerequisite command executes a mutable-main script | `retain_self_artifact_integrity` | PowerShell 执行前校验同一 Release asset 的 owner/tag/size/SHA |
| `csf_3e6c24867a64c7b196a07deb` | Windows port troubleshooting command executes a mutable-main script | `retain_self_artifact_integrity` | 下载和执行绑定同一 artifact manifest digest |
| `csf_9d5c856d80d15802ef62256f` | Windows diagnostics troubleshooting command executes a mutable-main script | `retain_self_artifact_integrity` | 同一 artifact identity；不增加 cohort gate |
| `csf_9dff6218e5c46d6654fcc1b6` | Official Windows one-click command executes a mutable-main script | `retain_self_artifact_integrity` | 执行前校验 immutable Release asset 及适用平台 attestation |
| `csf_2fbbb441cb9d9f3aae753163` | Elevated Windows prerequisite flow can execute a user-PATH docker.exe | `retain_independent_security_finding` | 独立修复 PATH hijack 和 elevation trust boundary |
| `csf_ae86ccfcc56b80335d60c74d` | Default MinerU extraction uploads local documents without a separate consent step | `retain_independent_security_finding` | 上传前要求明确目的地和逐次隐私确认，并保留本地替代路径 |
| `csf_c71b6a2c51f4a254567285a3` | Secret scanner republishes matched credentials in CI output and artifacts | `retain_independent_security_finding` | 在 JSON/stdout/artifact 前只保留 redacted typed marker |

## 机器验收语义

8 条 mutable-main 入口的修复必须在执行 sink 前完成：

1. 从 owner-authorized immutable Release 选择脚本 artifact；
2. 绑定该 artifact 自身的 tag、URL、name、size、SHA-256 和适用签名/公证；
3. 校验下载字节与 manifest/receipt 一致；
4. 校验失败时 fail closed，不执行脚本。

上述步骤不要求 App 与 Framework 或其他组件的精确版本相等。兼容性 admission 若存在，
由 App-owned requirements 和 canonical Framework-owner receipt 以 capability/minimum/range
评估；缺 receipt、过期、producer identity 漂移或 coverage 不完整时 fail closed。

本报告不声称上述 11 项已有 canonical 修复、发布或安装生效；它只防止 sealed finding
在后续修复中被错误转译成跨组件锁定。

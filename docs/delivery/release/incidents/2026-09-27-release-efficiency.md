# v26.9.27 发布复盘与效率优化

本次 Stable Standard 最终成功 run 为 [36301525442](https://github.com/gaofeng21cn/one-person-lab-app/actions/runs/36301525442)，耗时约 50 分钟；Full 最终成功 run 为 [36318447257](https://github.com/gaofeng21cn/one-person-lab-app/actions/runs/36318447257)，耗时约 13 分钟。最终成功单轮已经较短，但完整交付仍被此前多轮失败、取消和恢复拉长。

## 重复断点

| 断点 | 证据 | 处理 |
| --- | --- | --- |
| MAS Scholar Skills ref 在 VM harness 才被发现不可用 | [36308561466](https://github.com/gaofeng21cn/one-person-lab-app/actions/runs/36308561466) | Full admission 前移精确 commit 可达性检查 |
| recovery harness scope 在 VM runner 才被发现不允许复用 | [36315467321](https://github.com/gaofeng21cn/one-person-lab-app/actions/runs/36315467321)、[36315982575](https://github.com/gaofeng21cn/one-person-lab-app/actions/runs/36315982575) | recovery 输入在 admission 先运行同一 scope 证明；最终 VM 仍重复证明 |
| Codex 安装 tarball 上传在大文件传输阶段失败 | [36308986326](https://github.com/gaofeng21cn/one-person-lab-app/actions/runs/36308986326)、[36315467321](https://github.com/gaofeng21cn/one-person-lab-app/actions/runs/36315467321) | 保留 cache fallback；上传失败时直接消费内容绑定缓存，避免把合法候选判为 Full 不可用 |
| VM 内联 heredoc 在 guest 写入阶段死锁 | [36303250295](https://github.com/gaofeng21cn/one-person-lab-app/actions/runs/36303250295) | 使用独立 provisioning 脚本，并保留精确 checkpoint 恢复 |
| 恢复参数曾混用产品 SHA 与 harness SHA | [36312766449](https://github.com/gaofeng21cn/one-person-lab-app/actions/runs/36312766449)、[36313001318](https://github.com/gaofeng21cn/one-person-lab-app/actions/runs/36313001318) | controller 继续绑定 source、verification 和 executor 身份；不使用当前 main 猜测恢复参数 |

## 已落地的流程优化

1. Full append admission 现在先运行 `scripts/validate-full-addon-admission.ts`。无效的 Scholar Skills ref 或不允许的 harness 复用会在构建和 VM runner 之前失败。
2. Full 构建、静态包校验和 clean-VM 继续消费同一候选并行执行；恢复优先使用 `full_built` / `full_qualified` checkpoint，不重复构建、签名或公证。
3. 大体积 Codex tarball 保留内容绑定的 Actions cache fallback。缓存只是传输恢复手段，最终 VM 仍按 cohort digest 校验。
4. VM provisioning 改为独立脚本，避免 Bash heredoc 在 guest stdin 边界上的死锁。
5. 跟进时以最早真实失败 step 为准；页面静止、旧 REST 快照和五分钟无日志不能单独授权取消。已公开 Standard 和其他附加渠道保持独立恢复。

后续发布继续分别记录首次尝试、Standard 公开、Full 完成、附加渠道终态、最终成功单轮和失败恢复区间。不能用最终成功单轮替代完整端到端耗时，也不能把估算节省时间当作实测收益。

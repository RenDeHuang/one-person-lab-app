# Codex 自动模型策略

Owner: `one-person-lab-app`
Purpose: `codex_auto_model_product_policy`
State: `active`
Machine boundary: 本文解释 App-owned Codex Auto 产品策略。机器真相只在
`contracts/app-product-profile.json#codex.auto_model_policy`；Shell、安装器、候选 GUI
和本文都不得复制或改写选择逻辑。Codex CLI 的模型目录是运行时输入，不是 App
产品 authority。

## 结论

One Person Lab App 默认保存的是 `Auto` 模式，不是某次解析得到的具体模型。每次需要
解析 Auto 时，消费者读取 Codex CLI `model/list`：

1. CLI 用 `isDefault` 标记的模型是 App 当前自动模型候选。
2. 已知模型可使用 App 明确覆盖；当前 `gpt-5.6-sol` 固定使用 `xhigh`。
3. 未知新默认模型不得因为不在已知列表中被过滤；它使用 CLI
   `supportedReasoningEfforts` 广告顺序中的最高档。
4. CLI 目录不可用时回退到 `gpt-5.6-sol + xhigh`。
5. 用户选择固定模型或固定推理档后，持久化具体选择；用户恢复 Auto 后，只持久化
   Auto 模式，下次重新读取目录。

因此，如果未来 Codex CLI 将 GPT-6 标记为 `isDefault`，即使 App 尚未发布包含 GPT-6
名称的新版静态列表，Auto 也必须选择 GPT-6，并使用 CLI 为它声明的最高推理档。

## 已知列表的角色

`frontier_model_preference_order` 只承担两项职责：

- CLI 没有给出默认模型时的已知 fallback 顺序；
- 固定模型菜单中已知模型的展示偏好。

它不是 allowlist。未知的 CLI 默认模型仍可进入 Auto；固定模型菜单是否展示其它目录
模型属于 Shell 展示适配，但不得影响 Auto 解析结果。

## Owner 边界

| Surface | 职责 | 不得拥有 |
| --- | --- | --- |
| App product profile | 定义 Auto 算法、已知覆盖、fallback 和持久化语义。 | CLI 实时目录、provider readiness、用户凭证。 |
| Codex CLI | 通过 `model/list` 提供 `isDefault` 和 `supportedReasoningEfforts`。 | App fallback、用户选择持久化、GUI 文案。 |
| AionUI / Native / 其它 Shell | 读取 product profile 和 CLI 目录，解析并展示 Auto，保存 mode 或 fixed override。 | 私有 allowlist、私有模型排序、私有 fallback。 |
| OPL Framework 安装器 | 从同一 product profile 生成首次安装默认配置。 | 另一份默认模型/推理策略。 |

安装初始化的 `gpt-5.6-sol + xhigh` 是“目录不可用或首次生成配置”的 seed，不代表用户
进入 Auto 后永远固定在 5.6。Shell 当前解析出的具体模型也只是运行时结果，不得回写
成新的 App product truth。

## 验证边界

App contract 和 focused tests 能证明策略结构及消费者引用没有漂移；Shell 行为测试应
覆盖已知 5.6、未知 GPT-6、目录不可用和 fixed/Auto 重启四类场景。真实 GPT-6 是否已
进入当前 CLI 目录，必须由届时 fresh `model/list` readback 证明，不能由本文或静态测试
提前宣称。

# Codex 默认模型与 UI 同步设计

Owner: `one-person-lab-app`  
Purpose: `codex_default_model_and_ui_sync_design`  
State: `accepted_for_implementation`  
Machine boundary: 本文记录跨仓设计与验收边界；实际配置、GUI 产品真相和 shell 行为分别以 Framework Codex default profile、App machine-readable contracts 与 AionUI OPL profile consumer 为准。

## 目标

OPL App 新配置与新会话默认使用 `gpt-5.6-sol`，Codex `config.toml` 写入 `model_reasoning_effort = "ultra"`。普通 UI 参考 Codex App，默认显示 `5.6 Sol` 与推理强度“极高”，并按以下顺序展示模型：

1. `gpt-5.6-sol` -> `5.6 Sol`
2. `gpt-5.5` -> `5.5`
3. `gpt-5.6-terra` -> `5.6 Terra`
4. `gpt-5.6-luna` -> `5.6 Luna`
5. `gpt-5.4` -> `5.4`
6. `gpt-5.4-mini` -> `5.4 Mini`
7. `gpt-5.3-codex-spark` -> `5.3 Codex Spark`

## 权威与数据流

- OPL Framework 的 `contracts/opl-framework/codex-default-profile.json` 持有实际 Codex 默认配置，既有 installer/reconcile 路径继续负责写入 `config.toml`。
- App 的 `contracts/app-product-profile.json` 持有 App 会话默认值、模型顺序和用户显示名；GUI product contract 与 page-state matrix 必须与它一致。
- AionUI shell 只消费 App 生成的 product profile，并在 OPL-owned model selector/formatter 中呈现；不得成为第二套默认值权威。
- 首页继续不显示独立模型副标题。模型信息只出现在首页模型选择器和普通 Codex 会话 composer。

## UI 行为

自动选项解析为 `5.6 Sol / ultra`，主按钮显示 `5.6 Sol 极高`。推理菜单保留 `low / medium / high / ultra`，其中 `ultra` 的中文完整标签为“推理极高”、紧凑标签为“极高”，英文为 `Ultra reasoning` / `Ultra`。本次不增加截图中的速度或高级菜单，也不改变模型/推理的用户覆盖与恢复自动选择行为。

## 失败保护与验证

Framework fresh-install/configure/readback tests 必须证明默认 profile 会写入新值，同时显式 model/reasoning override 仍保持原语义。App validators 必须拒绝默认值、顺序或显示名漂移。shell focused profile/formatter tests 与 Guid/conversation DOM tests 必须证明默认按钮、菜单顺序、自动恢复和发送参数均使用 `gpt-5.6-sol / ultra`。最终再运行 App active-shell gate，证明 App contract 与 shell 投影一致。

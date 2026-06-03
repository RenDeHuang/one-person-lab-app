# One Person Lab App Docs

Owner: `one-person-lab-app`
Purpose: `app_docs_entry`
State: `active`
Machine boundary: Human-readable App documentation. Machine-readable truth lives
in `contracts/`, source, release artifacts, updater metadata, and test results.

This documentation set describes the end-user App repository. The App owns GUI
truth, release policy, and App-owned documentation. OPL Framework owns the
`opl app state` and `opl app action` producers consumed by the GUI bridge. The
active shell is a replaceable renderer and adapter; it does not become product,
runtime, provider, or domain authority.

## Current Docs

- [`active/app-ideal-state-gap-plan.md`](active/app-ideal-state-gap-plan.md):
  App product active truth, current gaps, and next-round governance baton.
- [`active/app-interaction-logic-command-center.md`](active/app-interaction-logic-command-center.md):
  active interaction handoff note for App-owned GUI requirements and shell implementation.
- [`status.md`](status.md): current App repository and active shell status.
- [`project.md`](project.md): App product repository role and ownership boundary.
- [`architecture.md`](architecture.md): App, shell, OPL Framework, and domain-agent ownership split.
- [`invariants.md`](invariants.md): App repository invariants and non-ownership rules.
- [`decisions.md`](decisions.md): still-active App product, shell, runtime bridge, release, and docs lifecycle decisions.
- [`docs_portfolio_consolidation.md`](docs_portfolio_consolidation.md):
  docs lifecycle governance and unique-role inventory.
- [`app-ideal-gui-interaction-spec.md`](app-ideal-gui-interaction-spec.md)：
  不绑定具体 shell 的理想 GUI 交互定义，目标是 Codex App 形态的 OPL App。
- [`app-gui-element-audit.md`](app-gui-element-audit.md)：逐项审计普通用户路径
  的页面元素、作用、缺口和位置判断。
- [`codex-to-opl-app-delta.md`](codex-to-opl-app-delta.md)：Codex App 变成
  OPL App 时需要新增、隐藏和治理的产品增量。
- [`app-gui-feature-inventory.md`](app-gui-feature-inventory.md)：跨 shell 的
  GUI 能力清单、reference mapping 和验证类别。
- [`agui-codex-candidate-verification.md`](agui-codex-candidate-verification.md):
  AG-UI/CopilotKit candidate shell verification runbook; candidate evidence
  remains in candidate manifests, shell artifacts, CI logs, release evidence, or history.
- [`release/`](release/): App release, updater, and Full first-install notes.
- [`testing/`](testing/): App validation and page-state test guidance.
- [`user-guides/`](user-guides/): user-facing guide entry point.
- [`screenshots/`](screenshots/): screenshot and visual tutorial asset entry.
- [`history/`](history/): retired App topology and migration notes.

Recent AionUI builtin skill intake and candidate smoke records are archived
under [`history/process/`](history/process/); current skill packaging and shell
candidate truth return to App contracts, validation scripts, and candidate
runbooks.

The App-owned product profile lives at
[`../contracts/app-product-profile.json`](../contracts/app-product-profile.json).
It is the machine-readable source for desktop session defaults, visible
companion skills, first-run maintenance behavior, Settings presentation policy,
and GUI product defaults. Release preparation generates the shell-facing copy
consumed by `opl-aion-shell`.

The App-owned install/exposure policy lives at
[`../contracts/app-install-exposure-policy.json`](../contracts/app-install-exposure-policy.json).
It keeps domain `skill` as the public ABI, treats Codex App `plugin` packages
as distribution shells, separates family domain plugin surfaces from companion
skill sync, and prevents MAS/MAG/RCA from being duplicated as bare user skill
mirrors.

The current stable GUI shell is checked out at `shells/aionui/` from
`gaofeng21cn/opl-aion-shell`. AionUI-specific implementation docs remain in the
shell repository. This App repository keeps only App-owned product, release,
contract, and user documentation in its default branch. Experimental shell
candidates are declared in
[`../contracts/app-shell-candidates.json`](../contracts/app-shell-candidates.json)
and stay outside default release packaging until adoption. A selectable
candidate also has an adapter contract under `../contracts/shell-adapters/`;
for example `OPL_APP_SHELL_ADAPTER_CONTRACT=contracts/shell-adapters/agui-codex.json`
targets the linked `shells/agui-codex` checkout for a launchable `.app` bundle
technical verification build. Candidate package validation rejects text-only
smoke outputs and requires a `.app` manifest with `Contents/Info.plist` and a
`Contents/MacOS` executable. A candidate becomes the default release shell only after
`contracts/app-shell-adapter.json` is changed deliberately and the App-owned
shell adapter, product profile sync, page-state, first-run, validation, package
compile, and external checkout history gates pass.

`contracts/app-runtime-bridge.json` also declares an opt-in live conformance
gate. Normal local and CI validation does not require a live Framework checkout.
When explicitly enabled with `OPL_APP_LIVE_CONFORMANCE=1`, the App validation
checks a local OPL root's `./bin/opl app state/action` protocol without copying
runtime or domain truth into this repo.

## GUI 定义栈

设计或评审 GUI 变更时，按以下顺序阅读：

1. [`app-ideal-gui-interaction-spec.md`](app-ideal-gui-interaction-spec.md)
   定义目标用户交互模型。
2. [`app-gui-element-audit.md`](app-gui-element-audit.md) 说明当前普通用户路径
   上每个页面元素的作用、缺口和位置判断。
3. [`codex-to-opl-app-delta.md`](codex-to-opl-app-delta.md) 定义 Codex App
   baseline 之上的 OPL 增量。
4. [`app-gui-feature-inventory.md`](app-gui-feature-inventory.md) 跟踪跨 shell
   能力清单、reference mapping 和验证类别。
5. [`agui-codex-candidate-verification.md`](agui-codex-candidate-verification.md)
   只在需要验证 AG-UI/CopilotKit candidate shell 时阅读。
6. `contracts/` 和 page-state matrices 承载机器可读 gates。

## 文档语言

App 内部开发文档默认使用中文，便于维护者直接评审 GUI、release、contract 和
runtime boundary。公共 README 可以保留双语或英文入口。

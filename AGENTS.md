# One Person Lab App Repository Guide

This repository is the One Person Lab App product repository. It owns desktop
App packaging, release assets, updater metadata, user guides, screenshots,
first-run checks, GUI product requirements, and GUI page-state tests.
It is the sole control root for GUI product truth, App-owned documentation,
machine-readable GUI contracts, page-state validation, and App release gates.

The OPL Framework remains in `gaofeng21cn/one-person-lab`. App code must consume
framework-owned machine-readable contracts, CLI JSON, provider receipts, and
domain-owned projections. Do not copy runtime truth, domain truth, provider
implementation, or domain artifact authority into this repository.

The user-level `~/.codex/TASTE.md` records the shared OPL family maintenance
taste for architecture, code, docs, tests, review, cleanup, and closeout
decisions. Use it as the preference layer, then apply this App repository guide,
contracts, docs, and source truth.

## Repository Boundaries

- `origin/main` is the clean One Person Lab App product mainline.
- `shells/aionui/` is an external checkout of the upstream-following AionUI fork
  repository, currently `gaofeng21cn/opl-aion-shell`; it is an implementation
  carrier, not an App-owned design surface.
- The App repo must not merge or vendor the AionUI Git history into its default
  branch. Keep AionUI upstream intake and shell implementation commits in the
  shell repository.
- Current GUI direction is fixed: AionUI is the active implementation carrier,
  `opl-native-workbench` is the foreground alternative, Hermes Desktop /
  `hermes-codex` is a retained reference candidate, and AGUI / `agui-codex` is
  archived technical proof. Do not update or polish AGUI unless the user
  explicitly requests AGUI replay work.
- GUI role marker: `gui_shell_roles: active=aionui; foreground=opl-native-workbench; retained=hermes-codex; archived=agui-codex`.

Root `docs/`, `contracts/`, and `scripts/` describe the App product layer.
AionUI-specific source, package metadata, tests, shell release hooks, and
upstream intake rules live in the shell repository and are consumed here through
the active shell checkout. Do not use App work to slim, refactor, restyle, or
rewrite upstream AionUI fork-body code or tests; App-owned work is limited to
contracts, adapters, OPL overlays, packaging/readback hooks, and validation of
those surfaces. If fork-body files are touched by mistake, revert that local
change before continuing.
When a behavior changes what users see, what page state is accepted, or what
counts as release-ready, change the App-owned contract, docs, and tests first;
then implement the shell behavior in the shell checkout. Do not let shell code,
upstream AionUI defaults, or local GUI implementation details become the hidden
source of App truth.

## GUI Product Authority

- The App repo is the authority for what the One Person Lab App GUI should be,
  regardless of which shell implementation is currently active.
- Product-level GUI decisions, user-facing page behavior, model-selection
  policy, onboarding flow, release screenshots, and page-state expectations must
  be documented, contracted, or tested from this repo when they define App truth.
- `contracts/app-gui-product-contract.json` owns the GUI product requirements.
  `contracts/app-page-state-matrix.json` owns GUI page-state expectations.
  `contracts/app-shell-adapter.json` owns the active shell implementation
  boundary. `contracts/app-release-channel.json` owns stable/nightly release
  gating.
- Default GUI state reads use `opl app state --profile fast --json`. Explicit
  refresh/detail reads use `opl app state --profile full --json`, with
  `opl runtime app-operator-drilldown --detail full --json` reserved for the
  runtime/Operator full drilldown exception. Mutations go through
  `opl app action execute --action <id> [--payload <json>] [--dry-run] --json`.
- `shells/aionui/` is the current implementation carrier and upstream-sync
  surface. It may change shape as AionUI evolves, but upstream fork-body code is
  read-only by default and must not become the source of product authority.
- When a GUI behavior is implemented in the shell repo, keep the App-level
  rationale and acceptance boundary in this repo, then apply the shell code
  change in the shell checkout.
- Upstream AionUI behavior can be reused as implementation material only after
  checking it against App-owned GUI requirements and contracts.
- Codex and other external products are interaction references, not feature
  authorities. Alignment may relocate an OPL-owned capability, but it must not
  remove it. Any entry relocation must land a visible and keyboard-reachable
  replacement in the same change, update contract/source/tests together, and
  preserve the cross-project Runtime cockpit separately from conversation-level
  Runtime details.
- Replacing the GUI shell changes the implementation carrier only. Future shells
  must remain under `shells/<candidate>` until the App shell adapter, product
  profile sync, page-state matrix, first-run matrix, active-shell validation,
  GUI package compile, and external checkout history policy all pass.

## GUI Design System Governance

- Start GUI design and implementation work from
  `docs/product/gui/README.md`.
- The definition priority is
  `gui_definition_stack: product_definition > visual_system > shell_implementation_conformance`.
  Product docs and App contracts define behavior first, the visual system
  translates that product truth, and shell guides/matrices implement and verify
  it.
- Shell authority is `gui_shell_authority: implementation_only`. A shell may
  implement or report a tracked deviation, but it cannot redefine App product
  truth from renderer code, screenshots, upstream defaults, or local behavior.
- The current visual and interaction reference is ChatGPT Codex macOS
  `26.707.31123` observed on `2026-07-10`. It is a reference only; OPL contracts
  remain authoritative.

## Working Rules

- Start App product work from `origin/main`.
- Use the shell repository only for explicit AionUI upstream-intake or
  OPL-owned overlay/adapter work; do not route general cleanup or test slimming
  into the fork body.
- Keep App-level changes at the root when they define product, release, testing,
  or user documentation behavior.
- Keep shell implementation changes in the shell repository unless they are
  changing the active shell contract or root release wrapper.
- Run root contract validation after changing App-level contracts or wrappers:

```bash
bun run validate:active-shell
```

Run `npm run ensure:shell` before local build or validation if
`shells/aionui/` has not been checked out yet.

## OPL App Full Profile Boundary

- If the machine was provisioned through OPL App Full, prefer the Superpowers
  execution surface packaged by the App distribution.
- OPL Flow supplies routing, guardrail, and acceptance semantics for that
  environment. It must not replace the packaged Superpowers skill surface.
- Keep the current local Superpowers profile by default. Switch to another
  Superpowers profile only when the operator explicitly requests it.

<!-- OPL_FLOW_MANAGED_START -->
OPL Flow managed surface: repo_agent_instructions
Plugin: opl-flow
Plugin version: 0.1.7
Profile pointer: contracts/opl-native-profile.json
本块只声明 OPL Flow 工作流 profile 指针；repo-specific 规则、项目事实、contracts、source、tests 和 runtime 输出继续归本仓既有 owner。
请只通过 OPL Flow repo_profile sync 更新本块；本块外内容由目标 repo 自己维护。
<!-- OPL_FLOW_MANAGED_END -->

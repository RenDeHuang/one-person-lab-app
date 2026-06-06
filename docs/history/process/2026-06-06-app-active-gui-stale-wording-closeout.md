# App active GUI stale wording closeout

Owner: `one-person-lab-app`
Purpose: `app_active_gui_stale_wording_retirement_closeout`
State: `history_closeout`
Machine boundary: 本文是本轮文档治理证据。当前 GUI 机器真相继续归 `contracts/app-gui-product-contract.json`、`contracts/app-page-state-matrix.json`、active-shell validation、release-boundary tests 和 active shell implementation output。
Date: `2026-06-06`

## Planned

- 退役 active docs 中把 Home 写成隐藏 `model selector` 的旧说法。
- 退役 element audit 中把 right context inspector 写成仍缺普通用户可打开辅助面的旧缺口。
- 退役 status 中 `OPL Agent Codex context` 旧 section name，统一到 `OPL Flow Context`。

## Done

- `docs/active/app-interaction-logic-command-center.md` 现在明确 Home 隐藏 executor / backend / provider / permission selectors，但保留 App-owned model selector/status。
- `docs/active/app-ideal-state-gap-plan.md` 的 Home shell conformance 读法同步到同一 contract truth。
- `docs/app-gui-element-audit.md` 移除 right context inspector 已落地事项在现有缺口中的 stale 记录。
- `docs/status.md` 将 Advanced section wording 收敛为 `OPL Flow Context`。

## Deferred

- 无。本轮只处理已由 contracts、matrix 和 validators 支撑的 stale wording，不改 shell implementation、contracts 或 tests。

## Skipped

- 未把 validator 中的 `opl_agent_codex_context` negative guard 删除；它仍用于防止旧 active section 复活。
- 未重写 GUI element audit 的其它产品缺口；它们继续由 active gap plan 和后续 GUI evidence lane 管理。

## Verification

Commands run from `/Users/gaofeng/workspace/one-person-lab-app/.worktrees/app-active-gui-stale-wording-20260606`:

```bash
rtk npm run ensure:shell
rtk rg -n "隐藏 executor/model/permission|hide executor/model/permission|model selector.*hide|model selector.*hidden|OPL Agent Codex|opl_agent_codex_context|右侧 context inspector 需要|active shell 还需要完整内容" docs contracts scripts tests
rtk node --experimental-strip-types scripts/validate-active-shell.ts --quick
rtk npm run test:release-boundary -- --runInBand
rtk git diff --check
rtk sh -lc '! rg -n "^(<<<<<<<|=======|>>>>>>>)" docs contracts scripts tests'
```

Result:

- `ensure:shell` prepared `shells/aionui` from `gaofeng21cn/opl-aion-shell@4a1154d4c313`.
- Targeted stale wording scan found only this history closeout plus validator/test negative guards for `opl_agent_codex_context`.
- `validate-active-shell.ts --quick` passed.
- `test:release-boundary -- --runInBand` passed with `124` tests.
- `git diff --check` passed.
- Conflict-marker scan found no matches.

## Commit-Push State

- Commit pending at closeout verification time.
- Push not performed in this tranche.

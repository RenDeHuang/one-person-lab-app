# GUI Shell Candidates

Owner: `one-person-lab-app`
Purpose: `gui_shell_candidate_map`
State: `active`
Machine boundary: Human-readable map for active and candidate GUI shells.
Machine truth lives in `contracts/app-shell-adapter.json`,
`contracts/app-shell-candidates.json`, `contracts/shell-adapters/*.json`,
package scripts, validation output, and candidate package artifacts.

## Current Map

| Role | Shell | Physical checkout | Adapter contract | Default scope |
| --- | --- | --- | --- | --- |
| Active App GUI | `aionui` | `shells/aionui` or `OPL_APP_SHELL_ROOT` | `contracts/app-shell-adapter.json` | Stable/nightly App wrapper commands |
| Foreground candidate | `opl-native-workbench` | `shells/opl-native-workbench` or `../opl-native-workbench` | `contracts/shell-adapters/opl-native-workbench.json` | Default candidate validation |
| Retained candidate | `hermes-codex` | `shells/hermes` or `../opl-hermes-shell` | `contracts/shell-adapters/hermes-codex.json` | Explicit candidate validation and package builds |
| Archived proof | `agui-codex` | `shells/agui-codex` | `contracts/shell-adapters/agui-codex.json` | Explicit AGUI replay only |

Stable role marker:
`gui_shell_roles: active=aionui; foreground=opl-native-workbench; retained=hermes-codex; archived=agui-codex`.

## 双 GUI、单控制面

OPL App 采用“同一逻辑基座、多个独立 GUI 客户端”的运行模型。AionUI 与
`opl-native-workbench` 都消费 App-owned product contracts、OPL state/action surface
和 Codex App Server authority，但不共享 renderer 源码、前端依赖目录、GUI 私有数据库
或构建链。这个关系类似同一个语言 Runtime 可以被多个 IDE 使用，而不是把两个 IDE
合并进同一个依赖树。

| Surface | Owner / sharing rule | Current boundary |
| --- | --- | --- |
| GUI product truth、profile、page-state | `one-person-lab-app`，两个 shell 共用 | 已有 machine contracts。 |
| OPL state/action 与 domain/package refs | OPL Framework/domain owner，两个 shell 只消费 | 已有 canonical bridge；shell 不得创建第二 truth。 |
| Codex thread history 与 opaque thread id | Codex Core/App Server | Authority 已固定；AionUI private repository 与 Native full-transcript localStorage cache 都是 current deviations，跨 GUI directory/read/resume continuity 未证明。 |
| OPL/Codex executable identity | App command-resolution policy + OPL runtime owner | 必须同 cohort 才能声明 parity；Native 当前 host-PATH resolution 是明确偏差。 |
| Workspace、source files、artifact refs | 用户 workspace / domain owner | 可由两个 GUI 指向同一逻辑工作区，但不据此声明并发写安全。 |
| Renderer、framework、lockfile、`node_modules` | 每个 shell 独立 | AionUI 与 Native 不共享依赖树。 |
| Window state、panel layout、draft、UI cache | 每个 GUI 私有、可重建 | 不允许直接读取或写入另一个 GUI 的 SQLite、localStorage 或 user-data store。 |
| Bundle id、updater、release artifact | 每个安装身份隔离；release authority 仍归 App | 可并存安装；candidate updater/package 不进入 stable/nightly。 |

“共享逻辑基座”不等于“当前共享同一份物理 Runtime”。AionUI 走 managed/packaged
runtime 路径；Native 当前仍从宿主 PATH 解析 `opl` 和 `codex`。在两者都返回相同
executable path/version/cohort readback 前，不得声称物理 Runtime parity。

## 两条选择轴

| Decision | Meaning | Authority / effect |
| --- | --- | --- |
| `active release shell` | Stable/nightly 默认发布 GUI | 只由 `contracts/app-shell-adapter.json` 决定；当前为 AionUI。 |
| `local GUI launch target` | 本机本次打开 AionUI 或 Native | 每次 launch 局部选择；不得修改 active adapter、release role 或 updater channel。 |
| `adoption / promotion` | 候选正式替换默认发布 GUI | 显式修改 active adapter，并完成完整 adoption/release/owner gates。 |

本地启动 candidate 只证明该 bundle 可被选择和打开，不证明 adoption、release readiness
或与 AionUI 的 Runtime/session parity。两个 bundle 可并存，但在 host coordination 与并发
负向证据完成前，只承诺快速顺序切换，不承诺两个 GUI 同时写同一 workspace/thread 的安全性。

Hermes Desktop / `hermes-codex` is not cleanup waste. It is a retained
candidate line: keep its adapter contract, wrapper commands, and checkout
policy unless the App owner explicitly retires the candidate.

## Design System Governance

The governance entry is `docs/product/gui/README.md`. It routes
the three-layer definition stack and the four foundation documents:

- Product definition: `docs/product/gui/README.md`,
  `docs/product/gui/feature-inventory.md`, and App contracts.
- Visual and ideal interaction system:
  `docs/product/gui/ideal-interaction-spec.md`,
  `docs/product/gui/visual-system.md`,
  `docs/product/gui/codex-to-opl-app-delta.md`, and
  `docs/product/gui/element-audit.md`.
- Shell implementation and conformance:
  `docs/product/gui/shell-implementation-guide.md` and
  `docs/product/gui/shell-conformance-matrix.md`.

The priority marker is
`gui_definition_stack: product_definition > visual_system > shell_implementation_conformance`.
Shell authority is `gui_shell_authority: implementation_only`: a shell
implements the higher layers and records deviations, but cannot reverse-define
the product from renderer code, screenshots, upstream defaults, or visual QA.

The current visual and interaction reference is ChatGPT Codex macOS
`26.707.41301` observed on `2026-07-11`. Builds `26.707.31428` and
`26.707.31123` are retained only as superseded observations. The ideal/native target keeps the
desktop workspace/session rail visible and the inspector closed by default.
The conformance matrix reads active AionUI state from
`contracts/app-product-profile.json#gui.home.home_layout`, compares it with the
App-owned ideal, and allows later active convergence without copying or freezing
the current profile value.

## Commands

### Current explicit routes

当前还没有统一 launcher。主线开发启动继续走 active adapter；sibling checkout 场景使用：

```bash
OPL_APP_SHELL_ROOT=../opl-aion-shell npm start
```

Native candidate 先通过显式 adapter 构建，再打开独立 bundle：

```bash
OPL_APP_SHELL_ROOT=../opl-native-workbench \
OPL_APP_RELEASE_ICON_ICNS=../opl-aion-shell/resources/app.icns \
npm run package:candidate:native
open "../opl-native-workbench/out/One Person Lab Native Workbench Candidate.app"
```

这些命令是当前开发入口，不是长期的用户级 interface。顺序切换时应先退出另一个 GUI；
当前手工命令不提供 running-client conflict gate。

### Target launcher

合同目标是由一个 App-root launcher 隐藏 adapter、checkout、build/open 与 Runtime
resolver 差异：

```bash
npm run gui -- --shell aionui --mode dev
npm run gui -- --shell opl-native-workbench --mode packaged
```

该命令目前为 `implementation_status=pending`，不能当作已经可用。实现必须从 candidate
registry 解析允许目标，默认读取 active adapter，缺失 checkout/bundle 时 fail closed 并返回
可操作 blocker；任何 launch 都不得改写 `contracts/app-shell-adapter.json`。

### Validation and packaging

Validate the default active GUI:

```bash
npm run validate:active-shell -- --quick
```

Validate retained or foreground candidates without changing the active GUI:

```bash
npm run validate:shell-candidates
npm run validate:candidate:native
npm run validate:candidate:hermes
```

Build explicit candidate apps through the App wrapper:

```bash
npm run package:candidate:native
npm run package:candidate:hermes
```

If the candidate checkout is a sibling repo instead of `shells/<candidate>`,
set `OPL_APP_SHELL_ROOT` for that command:

```bash
OPL_APP_SHELL_ROOT=../opl-hermes-shell npm run package:candidate:hermes
OPL_APP_SHELL_ROOT=../opl-native-workbench npm run package:candidate:native
```

## Boundaries

Candidate package builds and local launches are technical candidate artifacts.
They do not switch the active release shell, stable/nightly release packaging,
release readiness, owner acceptance, runtime truth, domain truth, artifact
authority, or current App release status.

The default release GUI changes only when `contracts/app-shell-adapter.json` is
edited and the App shell adapter, product profile, page-state, first-run,
package, release, and owner gates pass for that adoption. Local launch selection
is deliberately outside that authority path.

## Landing order

| Order | Work package | Completion rule | Current status |
| ---: | --- | --- | --- |
| 1 | Operating policy | Contracts declare launcher selection, shared Runtime resolution and conversation continuity boundaries; validators reject policy drift and false-ready flags. | Policy and declarative checks landed; executable/readback validation pending. |
| 2 | App-root launcher | One `--shell/--mode` interface selects active or foreground shell without mutating release adoption. | Pending. |
| 3 | Shared Runtime resolver | Both GUI clients consume the App resolver and emit exact OPL/Codex path, version and cohort readback. | Native host-PATH deviation remains. |
| 4 | Canonical conversation continuity | Both clients project App Server `thread/list/read/resume`; local stores contain UI state/drafts/rebuildable cache only. | AionUI private repository and Native full-transcript localStorage cache remain current deviations. |
| 5 | Side-by-side acceptance | Distinct bundle identities, sequential switching, same-workspace readback and negative concurrent-write cases use one exact cohort. | Pending; no simultaneous-write claim. |
| 6 | Optional adoption | Candidate changes the active adapter and passes full release/owner gates. | Separate later decision. |

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
| Active App GUI | `aionui` | `shells/aionui` or `OPL_APP_SHELL_ROOT` | `contracts/app-shell-adapter.json` | Stable plus Dev/Nightly Preview wrapper commands |
| Foreground candidate | `opl-native-workbench` | `shells/opl-native-workbench` or `../opl-native-workbench` | `contracts/shell-adapters/opl-native-workbench.json` | Explicit Native validation/build only |
| Retained candidate | `hermes-codex` | `shells/hermes` or `../opl-hermes-shell` | `contracts/shell-adapters/hermes-codex.json` | Role registry by default; explicit source validation or manual technical replay only |
| Archived proof | `agui-codex` | `shells/agui-codex` | `contracts/shell-adapters/agui-codex.json` | Explicit AGUI replay only |

Stable role marker:
`gui_shell_roles: active=aionui; foreground=opl-native-workbench; retained=hermes-codex; archived=agui-codex`.

Default maintenance validates only this four-role registry. Detailed candidate
contracts are intentionally carrier-owned and explicit:

| Validation scope | Owner entry | Default/release participation |
| --- | --- | --- |
| Fixed role registry | `npm run validate:shell-candidates` | Included in default structural gates; does not inspect candidate implementation detail. |
| Native foreground detail | `npm run validate:candidate:native` / `npm run test:candidate:native` | Explicit on demand; full candidate evidence is Native-only. |
| Hermes retained detail | `npm run validate:candidate:hermes` | Explicit source check; package/smoke command replay additionally requires `--manual-reference-replay`. |
| AGUI archived proof | `npm run validate:candidate:agui` | Explicit historical replay only. |

Hermes and AGUI are role tombstones in the active registry. Their detailed
commands and source/package expectations live in their adapter contracts and
replay runbooks, so changes to dormant candidate detail cannot block AionUI,
model-policy, design-system, full, or release-boundary maintenance.

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
| Codex thread history 与 opaque thread id | Codex Core/App Server | Authority 已固定。P1c candidate bytes remove the Native private coordination/cache requirement and preserve one App Server adapter, but canonical App/Native absorption and cross-GUI directory/read/resume continuity are not yet proved. AionUI private repository remains outside this candidate cleanup. |
| OPL/Codex executable identity | App command-resolution policy + OPL runtime owner | App launcher 已向 Native 注入 exact path/version/cohort；AionUI physical parity 仍未证明，Native 直接打开 bundle 时仍是 host-PATH fallback。 |
| Workspace、source files、artifact refs | 用户 workspace / domain owner | 可由两个 GUI 指向同一逻辑工作区，但不据此声明并发写安全。 |
| Renderer、framework、lockfile、`node_modules` | 每个 shell 独立 | AionUI 与 Native 不共享依赖树。 |
| Window state、panel layout、draft、UI cache | 每个 GUI 私有、可重建 | 不允许直接读取或写入另一个 GUI 的 SQLite、localStorage 或 user-data store。 |
| Bundle id、updater、release artifact | 每个安装身份隔离；release authority 仍归 App | 可并存安装；candidate shell 在 adoption 前不进入 Stable、Dev 或 Nightly build。Latest pointer selection 不改变 shell role。 |

“共享逻辑基座”不等于“当前共享同一份物理 Runtime”。AionUI 走 managed/packaged
runtime 路径；Native 通过 App launcher 使用显式 `opl`/`codex` 路径，但直接打开 bundle
仍回退到宿主 PATH。在两者都返回相同
executable path/version/cohort readback 前，不得声称物理 Runtime parity。

## 两条选择轴

| Decision | Meaning | Authority / effect |
| --- | --- | --- |
| `active release shell` | Stable 与当前 Dev/Nightly Preview 的发布 GUI | 只由 `contracts/app-shell-adapter.json` 决定；当前为 AionUI。 |
| `local GUI launch target` | 本机本次打开 AionUI 或 Native | 每次 launch 局部选择；不得修改 active adapter、release role 或 updater channel。 |
| `adoption / promotion` | 候选正式替换默认发布 GUI | 显式修改 active adapter，并完成完整 adoption/release/owner gates。 |

本地启动 candidate 只证明该 bundle 可被选择和打开，不证明 adoption、release readiness
或与 AionUI 的 Runtime/session parity。两个 bundle 可并存，但在 host coordination 与并发
负向证据完成前，只承诺快速顺序切换，不承诺两个 GUI 同时写同一 workspace/thread 的安全性。

Hermes Desktop / `hermes-codex` remains a retained technical reference, not a
second routinely maintained product line. Keep its role tombstone, adapter,
wrapper commands, checkout policy, and runbook unless the App owner explicitly
retires the replay route; do not duplicate its detailed state in the active
candidate registry.
Hermes is not a continuously built candidate. Push, pull-request, scheduled,
watch/on-save, daily-patrol, and routine-validation paths must not compile it.
Package, smoke, and install evidence is produced only when an actual Hermes
development task explicitly requests a manual technical replay.

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

### Local launcher

默认命令只激活已安装的 AionUI 主线，不重建、不改 user-data，也不改变 release adapter：

```bash
npm run gui
```

Native candidate 使用独立 bundle，可与正在运行的主线并存。默认 action 只允许 dry-run：

```bash
npm run gui -- --shell opl-native-workbench
npm run gui -- --shell opl-native-workbench --rebuild
npm run gui -- --shell opl-native-workbench --workspace /path/to/project
npm run gui -- --shell opl-native-workbench --plan
```

只有明确需要测试真实 mutation 时才使用：

```bash
npm run gui -- --shell opl-native-workbench --allow-actions
```

切换权限模式前先退出已运行的 Native Candidate；`open` 不创建第二个 Candidate 实例，
已运行进程不会接收新的环境变量。Launcher 从 candidate registry 读取目标与 build/open
规则，缺失 checkout/bundle 时 fail closed，并输出 exact Runtime identity 与
`release_adoption_changed=false`。主线开发模式仍可显式运行
`npm run gui -- --shell aionui --mode dev`。

### Validation and packaging

Validate the default active GUI:

```bash
npm run validate:active-shell -- --quick
```

Validate the fixed role registry, then select candidate detail explicitly
without changing the active GUI:

```bash
npm run validate:shell-candidates
npm run validate:candidate:native
npm run validate:candidate:hermes
npm run validate:candidate:agui
```

Build the foreground candidate through the App wrapper. Full Native evidence is
owned by the Native candidate path. Hermes/AGUI command chains are read from
their adapters; Hermes packaging remains a separate manual replay justified by
an actual Hermes development need:

```bash
npm run package:candidate:native
npm run validate:shell-candidates -- --candidate hermes-codex --run-candidate-commands --manual-reference-replay
```

If the candidate checkout is a sibling repo instead of `shells/<candidate>`,
set `OPL_APP_SHELL_ROOT` for that command:

```bash
OPL_APP_SHELL_ROOT=../opl-hermes-shell npm run validate:shell-candidates -- --candidate hermes-codex --run-candidate-commands --manual-reference-replay
OPL_APP_SHELL_ROOT=../opl-native-workbench npm run package:candidate:native
```

## Boundaries

Candidate package builds and local launches are technical candidate artifacts.
They do not switch the active release shell, Stable release packaging,
Dev/Nightly Preview packaging, release readiness, owner acceptance, runtime
truth, domain truth, artifact authority, or current App release status.

The default release GUI changes only when `contracts/app-shell-adapter.json` is
edited and the App shell adapter, product profile, page-state, first-run,
package, release, and owner gates pass for that adoption. Local launch selection
is deliberately outside that authority path.

## Landing order

| Order | Work package | Completion rule | Current status |
| ---: | --- | --- | --- |
| 1 | Operating policy | Contracts declare launcher selection, shared Runtime resolution and conversation continuity boundaries; validators reject policy drift and false-ready flags. | Implemented for local launch policy; stronger parity/readiness claims remain gated. |
| 2 | App-root launcher | One `--shell/--mode` interface selects active or foreground shell without mutating release adoption. | Implemented with plan/readback, isolated bundle identity and Candidate default read-only policy. |
| 3 | Shared Runtime resolver | Both GUI clients consume the App resolver and emit exact OPL/Codex path, version and cohort readback. | Implemented for launcher-started Native only; active AionUI parity and Native direct-launch fallback remain unproven. |
| 4 | Canonical conversation continuity | Both clients project App Server `thread/list/read/resume`; local stores contain UI state/drafts/rebuildable cache only. | P1c App/Native candidate bytes remove the Native private coordination/cache requirement, but canonical absorption and cross-GUI continuity evidence remain pending; AionUI private repository is unchanged by this slice. |
| 5 | Side-by-side acceptance | Distinct bundle identities, sequential switching, same-workspace readback and negative concurrent-write cases use one exact cohort. | Pending; no simultaneous-write claim. |
| 6 | Optional adoption | Candidate changes the active adapter and passes full release/owner gates. | Separate later decision. |

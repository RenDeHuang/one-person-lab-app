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
| Foreground candidate | `opl-studio` | `shells/opl-studio` or `../opl-studio` | `contracts/shell-adapters/opl-studio.json` | Explicit validation/build and dedicated Studio Preview release only; never App Stable/Dev/Nightly before adoption |

Stable role marker:
`gui_shell_roles: active=aionui; foreground=opl-studio`.

Default maintenance validates this two-role registry. Detailed candidate
contracts are intentionally carrier-owned and explicit:

| Validation scope | Owner entry | Default/release participation |
| --- | --- | --- |
| Fixed role registry | `npm run validate:shell-candidates` | Included in default structural gates; does not inspect candidate implementation detail. |
| OPL Studio foreground detail | `npm run validate:candidate:studio` / `npm run test:candidate:studio` | Explicit on demand; full candidate evidence is Studio-only. |

## 双 GUI、单控制面

在 `OPL Base + OPL App + OPL Packages + optional OPL Cloud` 四层生态中，
本文件只管理 App 的 Shell carrier 选择。Package topology/发布、Framework Host
composition 与 Cloud 服务都不因 Shell 切换而迁移 authority；跨仓品牌名也只是
capability domains，不是 Shell plugin 或 Package 清单。

OPL App 采用“同一逻辑基座、多个独立 GUI 客户端”的运行模型。AionUI 与
`opl-studio` 都消费 App-owned product contracts、OPL state/action surface
和 Codex App Server authority，但不共享 renderer 源码、前端依赖目录、GUI 私有数据库
或构建链。这个关系类似同一个语言 Runtime 可以被多个 IDE 使用，而不是把两个 IDE
合并进同一个依赖树。

两个 Shell 的 Client Cordis 必须消费同一 Host-projected allowlisted graph、typed
slots/actions、RPC/events 与产品状态语义。Client 只渲染并经 canonical App action bridge
派发：不得自行发现/安装 plugin、维护 registry/currentness、获得 release-operation，或拥有
task、Package、product truth。Framework Host producer/projection 已 canonical；本节只冻结
两个 Shell 的统一 consumer contract，不替代各 Shell 自己的 runtime conformance 证据。

三仓的终态关系固定为“一个产品 authority、两个可替换 Shell 实现”：

| 仓库 | 终态职责 | 明确不拥有 |
| --- | --- | --- |
| `one-person-lab-app` | 产品行为、导航、页面状态、GUI contribution ABI、Client Cordis profile、active shell、版本组合与发布门禁 | Electron/React 具体实现、AionUI/DSH 上游源码 |
| `opl-aion-shell` | 当前 Stable 的 AionUI renderer、Electron/preload、AionCore/Codex 适配和安装实现 | OPL 产品定义、插件名单、发布策略 |
| `opl-studio` | 完整 DSH/Cordis Application Host、`opl-codex-native`、Framework bridge、Client Cordis、renderer 与三种 carrier 的下一代候选实现 | 第二套 Framework runtime/Package authority、第二套 App 产品 authority、擅自声明 active/release-ready |

共享产品逻辑只能沉淀为 App contracts/profile、Framework ABI、GUI contribution schema
或独立 Package；不能从一个 Shell 复制到另一个。Shell 切换只需在 App 主仓通过
`app-shell-adapter.json` 冻结新的 selected Shell 和组合版本，不需要迁移 Framework
authority 或重写另一 Shell。

| Surface | Owner / sharing rule | Current boundary |
| --- | --- | --- |
| GUI product truth、profile、page-state | `one-person-lab-app`，两个 shell 共用 | 已有 machine contracts。 |
| OPL state/action 与 domain/package refs | OPL Framework/domain owner，两个 shell 只消费 | 已有 canonical bridge；shell 不得创建第二 truth。 |
| Codex thread history 与 opaque thread id | Codex Core/App Server | Authority 已固定。P1c candidate bytes remove the Native private coordination/cache requirement and preserve one App Server adapter, but canonical App/Native absorption and cross-GUI directory/read/resume continuity are not yet proved. AionUI private repository remains outside this candidate cleanup. |
| OPL/Codex executable identity | App command-resolution policy + OPL runtime owner | App launcher 已向 Native 注入 exact path/version/cohort；AionUI physical parity 仍未证明，Native 直接打开 bundle 时仍是 host-PATH fallback。 |
| Workspace、source files、artifact refs | 用户 workspace / domain owner | 可由两个 GUI 指向同一逻辑工作区，但不据此声明并发写安全。 |
| Renderer、framework、lockfile、`node_modules` | 每个 shell 独立 | AionUI 与 Native 不共享依赖树。 |
| Window state、panel layout、draft、UI cache | 每个 GUI 私有、可重建 | 不允许直接读取或写入另一个 GUI 的 SQLite、localStorage 或 user-data store。 |
| Bundle id、updater、release artifact | 每个安装身份隔离；release authority 仍归 App | 可并存安装；candidate 在 adoption 前只进入独立 Studio Preview repository/feed，不进入 App Stable、Dev 或 Nightly identity。Latest pointer selection 不改变 shell role。 |

“共享逻辑基座”不等于“当前共享同一份物理 Runtime”。AionUI 走 managed/packaged
runtime 路径；Native 通过 App launcher 使用显式 `opl`/`codex` 路径，但直接打开 bundle
仍回退到宿主 PATH。在两者都返回相同
executable path/version/cohort readback 前，不得声称物理 Runtime parity。

Codex carrier 选择也不进入共享产品 truth。Active AionUI 当前从 raw AionCore
managed-resources manifest 解析 exact Codex；目标由 Shell 从同一上游导出生成
`opl_aioncore_managed_resources_projection.v1`，只保留 Node + Codex，再通过
`OPL_CODEX_BIN` 交给单一 App Server adapter。Standard/Full 最终包必须物理排除 Claude，
并继续排除 Framework managed Codex archive、cache 或 generation。Framework headless
carrier 作为独立 Base 安装能力保留，不得因为 App 选择 AionCore 而打入 App bundle。
OPL Studio candidate 与后续 adopted shell 继续使用同一 resolver/protocol，但其
carrier 必须是 Studio-owned 或 exact external binary，不能要求 AionCore，也不能读取
AionUI 私有 manifest parser。这保证替换 GUI 时只切换 executable source，不迁移
canonical thread history。迁移计划见
[`../../architecture/aioncore-codex-only-carrier.md`](../../architecture/aioncore-codex-only-carrier.md)。

## 两条选择轴

| Decision | Meaning | Authority / effect |
| --- | --- | --- |
| `active release shell` | Stable 与当前 Dev/Nightly Preview 的发布 GUI | 只由 `contracts/app-shell-adapter.json` 决定；当前为 AionUI。 |
| `local GUI launch target` | 本机本次打开 AionUI 或 Native | 每次 launch 局部选择；不得修改 active adapter、release role 或 updater channel。 |
| `adoption / promotion` | 候选正式替换默认发布 GUI | 显式修改 active adapter，并完成完整 adoption/release/owner gates。 |

## Preview 到正式 App 的升级路线

完整机器合同是
`contracts/app-release-channel.json#shell_transition_policy`；本节只解释 Shell 角色，
不复制 release/version/data truth。

正式切换保留当前 `One Person Lab` 的 Bundle ID、`/Applications/One Person Lab.app`、
user-data 根和 App Stable feed，仅把实现从 AionUI 换成 Studio。这样当前主线用户可以沿
现有 updater 原地升级，且第一版 Studio 正式 App 在正常启动 renderer 前执行一次幂等、
可恢复的 allowlisted local-state migration。

Studio Preview 继续保持独立 Bundle ID、应用名、user-data 和 repository/feed。不同身份的
Electron App 不能被描述为原地自动更新：Preview 的 terminal release 必须通过受签名保护的
handoff 安装 exact 正式 App，迁移 Preview 私有设置和未发送草稿，并在正式 App 的启动、
版本、数据和 owner state 回读成功后才允许清理 Preview。Preview feed 不得被重定向或改名
为 App Stable feed。

切换不迁移 Codex thread truth、Gateway credential、Framework Package/runtime/receipt、
Workspace 或 domain artifact；这些数据继续由原 owner 提供。AionUI/Preview 的数据库、
cookie、Electron cache、updater identity 和凭据不得整体复制到新 renderer。两边都存在时，
触发 handoff 的来源只填充正式 App 尚不存在的允许字段；草稿按来源命名空间保留，禁止静默
覆盖。

在 Preview 内测结束前，这条路线只是 `planned_not_authorized`。后续开发必须分别证明：
AionUI supported-source window 到正式 App 的直接更新、Preview 到正式 App 的 handoff、
双安装共存的单 writer、迁移中断恢复、回滚路径，以及更新后 Gateway/thread/workspace/
settings 的 owner readback。通过这些门禁后，才修改 `app-shell-adapter.json`。

每次 App wrapper 解析 active 或显式 candidate adapter 时，都必须先通过 App-owned
`client_renderer_compatibility` / `client_renderer_admission`。该门禁验证两条 renderer 共享
Host-derived graph、App allowlist、typed slots/actions、RPC/events 和 state semantics 后才允许
启动命令；它不改变 active release shell，也不构成无验证热切换或 Studio release admission。

本地启动 candidate 只证明该 bundle 可被选择和打开，不证明 adoption、release readiness
或与 AionUI 的 Runtime/session parity。两个 bundle 可并存，但在 host coordination 与并发
负向证据完成前，只承诺快速顺序切换，不承诺两个 GUI 同时写同一 workspace/thread 的安全性。

DeepSeek Harness is not another shell role. Its pinned Application Host and selected
renderer/slot source form the implementation base of the sole foreground candidate,
`opl-studio`.
AionUI consumes the OPL-owned contribution ABI plus only the bounded visual source
cohort through `OplVisualProvider` and `OplIcon`; it does not import DeepSeek Harness
Application Host, session, router, provider, connection, complete renderer, or Client
Cordis. Both shells may run the single App-approved Client Cordis graph derived from
the Framework Host graph and App profile/allowlist. Studio's separate server-side Host
is scoped to DSH/plugin/Codex/transport composition; neither shell may create a second
Framework runtime/Package graph, discover or install OPL Packages, maintain a Package
registry/currentness view, receive release-operation, or own App state/action authority.
The evaluation and controlled migration plan lives in
[`deepseek-harness-composition-plan.md`](deepseek-harness-composition-plan.md).

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

The external visual and interaction reference is the latest official ChatGPT Codex macOS
version verified at observation time, with exact identity recorded in that observation receipt.
Builds `26.707.41301`, `26.707.31428`, and `26.707.31123` are retained only as historical
observations. The ideal/native target keeps the
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

OPL Studio candidate 使用独立 bundle，可与正在运行的主线并存。默认 action 只允许 dry-run：

```bash
npm run gui -- --shell opl-studio
npm run gui -- --shell opl-studio --rebuild
npm run gui -- --shell opl-studio --workspace /path/to/project
npm run gui -- --shell opl-studio --plan
```

只有明确需要测试真实 mutation 时才使用：

```bash
npm run gui -- --shell opl-studio --allow-actions
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
npm run validate:candidate:studio
```

Build the foreground candidate through the App wrapper. Full Studio evidence is
owned by the OPL Studio candidate path. The wrapper injects the current App
checkout as an absolute `OPL_APP_REPO_ROOT`; Studio then requires committed,
tracked-clean source and produces the Electron, standalone WebUI, Docker smoke,
and exact-commit carrier manifest required by the App contract:

```bash
npm run package:candidate:studio
```

If the candidate checkout is a sibling repo instead of `shells/<candidate>`,
set `OPL_APP_SHELL_ROOT` for that command:

```bash
OPL_APP_SHELL_ROOT=../opl-studio npm run package:candidate:studio
```

The generated carrier manifest is ignored candidate evidence. It does not
change `app-shell-adapter.json`, wire any distribution/update channel, or prove
signing, notarization, public publication, release admission, or adoption.

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
| 4 | Canonical conversation continuity | Both clients project App Server `thread/list/read/resume`; local stores contain UI state/drafts/rebuildable cache only. | P1c App/Studio candidate bytes remove the Studio private coordination/cache requirement, but canonical absorption and cross-GUI continuity evidence remain pending; AionUI private repository is unchanged by this slice. |
| 5 | Side-by-side acceptance | Distinct bundle identities, sequential switching, same-workspace readback and negative concurrent-write cases use one exact cohort. | Pending; no simultaneous-write claim. |
| 6 | Preview qualification | Dedicated Preview feed proves signed/notarized install, update, restart and current-version readback without changing the active App identity. | Current phase after functional acceptance. |
| 7 | Dual-source migration | AionUI direct in-place update and Preview exact handoff preserve allowlisted local state and reuse owner state without copying databases or secrets. | Planned; implementation and clean-VM proof pending. |
| 8 | Optional adoption | Candidate changes the active adapter and publishes Studio bytes on the preserved App Stable identity only after full release/owner gates. | Separate later decision. |
| 9 | Legacy retirement | Terminal Preview handoff and old Shell data are removed only after post-update owner readback and rollback retention. | Deferred until adoption acceptance. |

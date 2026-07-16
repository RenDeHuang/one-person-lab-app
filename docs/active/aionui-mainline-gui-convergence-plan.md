# AionUI 主线 GUI 薄壳收敛方案

Owner: `one-person-lab-app`
State: `release_closeout_in_progress`
Updated: `2026-07-15`

本文只记录 AionUI active shell 的薄壳执行边界和终态验收。产品行为归 App machine
contract，Shell 只负责实现；本文不复制第二套 machine authority，也不把 source、focused tests
或历史截图解释为 release-ready。

## 结论

OPL App 是 AionUI 上的可信本机薄壳，目标是在不长期维护上游私有 fork 的前提下，尽可能
1:1 对齐 Codex App 的桌面交互和视觉。当前产品模型固定为：

1. session/thread 是唯一会话身份；
2. project/directory 只是当前工作目录、历史分组和新会话快捷入口，不拥有会话或上下文；
3. 同一 session 可以切换到任意本机目录，同时保留 thread、transcript、turn history、title 和 task state；
4. OPL Agent Package 是受管的官方插件，提供更强安装和状态管理，但不改变 Codex 的会话模型；
5. AionUI 基础 ACP 和一个 Codex App Server adapter 承载普通会话与用户触发的线程操作；
6. App 定义产品和验收，Shell 不建立第二状态源，AionCore 保持 no-write。

因此项目下不显示“上下文 / 添加上下文”，也不把会话描述成归属于某个项目。Workspace selector
只设置新 session 初始 cwd；既有 session 不提供目录重绑。

## 当前发布边界

| Surface | 当前目标 | 不进入本版 |
| --- | --- | --- |
| ACP 与会话 | 普通 create/send/stop/resume、模型与权限、slash command、warmup | OPL 私有 ACP 扩展、AionCore deep host gate |
| Thread 操作 | 一个 App Server adapter；用户触发 list/read/start/resume/fork/archive 和必要 turn 操作 | 第二 JSON-RPC client、独立 coordination 页面、model delivery |
| Session / cwd | 新任务选择初始 cwd；projectless session 可直接开始；Environment 只读 | project 拥有 session/context、既有 session cwd 重绑或 rail 重分组 |
| Worktree | 当前版本不提供 managed Worktree/Handoff | Local/Worktree launch mode、starting branch、create/reuse、snapshot、cleanup、restore |
| Agent Package | package ID、installed/root version、canonical managed target、current selection、`launch_allowed` 和 typed error | owner ledger、single-use token、anti-replay、provenance、deep alias/provider closure |
| Review | 复用普通 diff/files；上游无 typed 能力时 truthful unavailable | 私有行级 annotation、伪造成功、cross-host/model-delivery 依赖 |
| Settings | 单一 Settings IA、System/Light/Dark、账户行复用现有 updater | 主题预设画廊、侧栏重复返回、第二 updater |
| Visual | Codex App 的字体、颜色、图标、间距、排版和阴影作为 human target | 用合同或 source gate 代替 installed pixels |

动态跨顶层线程 tools、cross-host handoff、request replay ledger、write-set advisory、pending-server-request
控制面和私有 delivery audit 均已撤销，不是 source、build、install 或 Stable blocker。

## 单一 Authority

人工维护边界保持最小：

1. `contracts/app-gui-product-contract.json` 记录用户可见产品行为；
2. `contracts/app-runtime-bridge.json` 只记录 App 与 Shell 的必要运行时 ABI；
3. page state、fixtures 和文档只做单向派生或示例，不得重新发明 required target；
4. Shell focused behavior/DOM tests证明实现，不以大段 source-string 断言替代行为验证；
5. release profile 将 local install 与 explicit public Stable 分开。

Agent Package 的失败语义只要求 fail closed：无匹配 package、版本或受管目标时，不创建用户可见
成功状态，并返回明确 typed error。普通 conversation 不受 package 路径误伤。

## 视觉收敛

当前 Codex App 参考值固定为：

- navigation rail `#FCFCFC`；
- main surface `#FFFFFF`；
- selected row `#F0F0F0`；
- hover `rgba(0, 0, 0, 0.045)`；
- neutral 16px icons 与 13px rail labels；
- composer 使用可见但克制的边框阴影，输入为 `14px/20px`；
- 历史搜索位于“对话历史”标题右侧；
- Settings 内容宽度、三态外观预览和窄窗层次对齐 Codex App。

这些数值属于 App human target。只有同一 final cohort 的 light、dark、narrow installed screenshots
和像素检查通过，才能声明视觉完成；历史截图、DOM 或 source check 只能证明局部实现。

## 当前执行状态

- Framework component 固定为
  `e10ec54f29b8a7d5b54c9a44f49ba4d5c492f252`，不恢复复杂 provenance/family/deep-host 规划；
- App 合同已沿最小 package/session/visual authority 收缩，仍需 final-byte gates 和 canonical main；
- Shell 已从 clean canonical base 重建薄壳 stack，仍需全门、最终视觉像素和 canonical main；
- 当前未 build、未安装、未发布，历史 package 和截图不提升本 cohort 状态。

## 当前事实快照

- `a0ce713b65801fd9ca7f46ad168c977c75a187de` 是最低已验证 GUI ancestor；当前 source
  HEAD 必须由 active Shell checkout 实时读取并包含该 ancestor，不在本文复制 transient HEAD；
- `0ebc1fdd278e8a79602458e15e28cf814dfd917d` 只绑定历史 41301 packaged pixel evidence，
  不代表当前 source、当前 pixels、安装完成或 release-ready；
- 当前 cohort 只有在 App/Shell final-byte gates、installed light/dark/narrow pixels 和远端回读全部完成后
  才能提升状态。

## Terminal 验收

1. App/Shell 最终 diff 不含 dynamic-tools、cross-host、旧 coordination 控制面或自动 worktree cleanup/restore；
2. App contract、page state、runtime bridge、release boundary 和 active-shell gates 在最终字节上通过；
3. Shell Node/DOM、TypeScript、i18n、lint、format、diff-check 和基础 ACP/Session/Review/Agent Package
   focused tests通过；
4. App、Shell canonical `main` push 后通过 HTTPS 与 SSH:443 精确回读；
5. 只构建并安装一个 exact Framework/App/Shell cohort；
6. 安装版完成 Gateway、反馈 URL、Settings、Session/cwd、Agent Package、light/dark/narrow 和日志路径 QA；
7. QA 通过后，按 repo-native saga 发布新的 `v26.7.15` Stable，不移动或覆盖旧 tag；
8. 远端 tag、release、assets、checksums、updater manifest 与已验 cohort 一致；
9. 最后按 absorbed / exact-equivalent / semantic-superseded 证据清理本任务接管的 worktree、branch、
   stash、patch 和本地 snapshot ref。

`v26.7.15` public Stable 已由用户显式授权，因此 QA 后会运行完整 public profile；但 GHCR、clean VM、
attestation、notarization 和 promotion 仍不得反向阻断本机 build/install。若 public profile 出现真实
签名或资产 blocker，保留已验 local cohort，不创建半套 Stable，也不移动 tag。

## 维护规则

- 不整体 merge AionUI upstream，只按能力选择性 intake；
- 不为理论本机攻击增加 ledger、token、数据库迁移或长期私有 fork；
- 不把 project/workspace 变成权限域或 session 所有者；
- 不以 Settings 完成度替代 Home、conversation 和 composer 主体验；
- 不以 docs、focused tests、dry-run、candidate package 或历史 evidence 宣称完成；
- 新能力若需要跨两个以上外部仓、第二 writer 或新的持久化状态，必须由用户重新立项。

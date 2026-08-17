# OPL Link 产品基线

Owner: `one-person-lab-app`  
Purpose: `opl_link_conversation_first_product_ssot`  
State: `approved_product_baseline_source_realign_pending`

## 结论

OPL Link 是 OPL App 的原生 iOS 连接器。它让用户离开电脑后继续使用桌面端的 Codex 对话，
不是移动版 OPL App、第二个 Codex runtime、第二个历史库，也不是 OPL Flow、OPL Ledger 或
Linear 的任务控制面。

用户看到和操作的主对象是 **对话**。对话由桌面 OPL App/Codex App Server 持有，使用
`canonical_thread_id` 作为跨端身份。OPL Link 只读取桌面投影并提交有限的对话操作；腾讯云 IM
和 Cloud broker 只负责加密传输、配对、凭据与席位，不能成为对话历史或业务状态的 owner。

## 用户闭环

```text
安全配对 -> 查看对话列表 -> 打开对话 -> 阅读历史/流式输出
        -> 继续发送消息或停止当前生成 -> 前后台恢复后重新同步
```

首发闭环只需要：

- 配对一台正在运行的桌面 OPL App；
- 查看桌面已有对话的标题、摘要、最近更新时间和当前状态；
- 打开一条对话，阅读历史消息与流式输出；
- 继续发送文字；
- 新建一条对话，沿用桌面的默认工作区、模型、权限和 Agent 配置；
- 停止当前 turn；
- 处理桌面明确投影的低/中影响审批；
- 接收不含正文的通用更新提醒，打开 App 后重新同步。

### 任务与对话

OPL Link 中“任务”不是产品主对象。它只可能是：

- 桌面对话的标题、状态或其他元数据；
- OPL Flow/OPL Ledger/Linear 在用户启用这些系统时提供的外部分组或引用。

OPL Link 不负责任务的负责人、截止时间、依赖、阶段、工作流、Ledger receipt、Linear issue
状态或任务迁移。没有 OPL Flow/Linear 时，对话仍然可以独立使用；启用后也由对应 owner 管理，
OPL Link 只在桌面投影允许时显示引用。

### 不做什么

以下能力不属于当前产品闭环：

- 任意终端、shell、文件系统读写或文件上传；
- 手机端模型、Provider、权限策略、Package 或 Agent 配置；
- 离线命令队列、云端任务迁移、多用户共享工作区；
- Linear/OPL Ledger 任务生命周期管理；
- 在没有桌面 canonical API 的情况下自行实现搜索、归档、重命名或删除。

直接打开或投影桌面 WebUI 是开发验证、手动应急和技术下限，不是 OPL Link 的产品语义，也不是
自动 transport fallback。正式 OPL Link 投影的是对话数据和事件，而不是桌面像素：这样可以减少
流量、缩短加载、正确处理前后台恢复，并保持桌面端作为唯一历史 authority。

## 信息架构

- **对话**：默认首页，按最近活动显示桌面 canonical conversation directory。
- **对话详情**：消息历史、流式输出、输入框、停止当前 turn、允许的审批和刷新。
- **设置**：配对、连接、通知、隐私、诊断摘要和撤销配对。
- **任务/项目**：不是 OPL Link 的一级入口；需要时作为对话元数据或外部引用展示。

当前 iOS source 仍有 `TaskListView`、`TaskSummary` 和 `canonical_task.*` 内部实现名。它们
不是产品 authority，正在按本基线重对齐；在迁移完成前，不能宣称对话优先 UI 已经实现。

## 连接与隐私边界

桌面和 iPhone 都向托管服务主动建立出站连接，用户不需要公网 IP、端口转发、VPN、Tailscale
或局域网配置。腾讯云 IM 体验版是当前 MVP provider；Ably 只是未来替换候选，不能双写、
自动 fallback 或使用 provider history 作为业务真相。

对话正文、workspace 路径、审批正文和密钥在桌面与 iPhone 之间端到端加密。Cloud 和 provider
只能看到不透明路由标识、密文和必要的生命周期状态。推送仅发送“有更新”的通用信号。

配对需要一次性邀请和 QR/完整 payload，成功配对才消耗 Cloud active pair seat。TestFlight
只是 Beta 分发载体，不是容量或准入 authority。撤销配对必须由 Cloud owner 完成 provider
账号删除与 absence readback 后才释放席位。

## Authority

| 主题 | 唯一 owner | OPL Link 角色 |
| --- | --- | --- |
| OPL Link 产品与跨端语义 | `one-person-lab-app` | 定义合同并验收 |
| 对话历史、turn、模型和执行 | Codex App Server + 桌面 OPL App | 只读投影和有限 action |
| iOS UI、Keychain、E2EE、transport adapter | `opl-link` | 实现 |
| 桌面 connector 与 canonical bridge | `opl-aion-shell` | 提供真实读/action |
| 邀请、席位、UserSig、Tencent UserID、revoke | `one-person-lab-cloud` | 提供 broker 状态 |
| OPL Flow、OPL Ledger、Linear 任务 | 对应产品/领域 owner | 可选外部引用 |
| 实时消息投递 | Tencent Cloud IM（未来可替换 Ably） | 只传密文 |

机器边界见 [`contracts/app-remote-companion.json`](../../contracts/app-remote-companion.json) 和
[`contracts/app-remote-companion-wire.json`](../../contracts/app-remote-companion-wire.json)。
实现、真实 Tencent 配置、安装后配对、三网、TestFlight 和 App Store 状态必须分别由对应 owner
的 source、runtime 或 carrier readback 证明。

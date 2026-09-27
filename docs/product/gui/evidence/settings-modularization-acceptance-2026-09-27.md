# 设置模块化与能力整合验收（2026-09-27）

本轮完成 App、Studio、Framework 的源码实现和本地运行验证。未提交、发布或替换 `/Applications/One Person Lab.app`；本报告不作为正式版本或 clean-VM 验收证据。保留工作区此前的维护和设置修复。

## 已落实的建议

| 建议 | 当前实现 |
| --- | --- |
| 设置按功能维护 | Studio 的 `SettingsPanel.tsx` 缩减为 130 行；16 个页面位于 `src/workbench/settings/pages`，导航、状态、目录、动作和维护组件分别维护。共享上下文保留集中读取，不新增业务状态来源。 |
| Host 明确归属 | 生产代码与相邻测试迁到 `src/host`；Cordis 插件在 `src/host/dsh/plugins`。桌面、WebUI、Docker、headless 更新和验收入口同步改用新路径。 |
| 工作台服务分工 | Framework 的 `memory.ts`、`storage.ts` 和 `resource-files.ts` 分别持有记忆、存储及共同路径检查。`resources.ts` 仅为兼容门面，仍是一个 Workbench Services 插件。 |
| 清理陈旧 truth | 设置合同 active shell 改为 `opl-studio`；Studio 将采用状态指向 App 合同，候选仍不声明 release-ready；更新旧页面路径和验证器的源码定位。 |
| 状态语义 | DSH “已接入”只表示源码适配，不宣称本机可用；能力列表区分安装、启用与 callable。连接状态保留唯一配置页。 |
| 计划任务归位 | 主导航有独立计划任务页；设置“后台任务”只说明运行条件并跳转。沿用 DSH TaskManager 的内容宽度、留白、列表与控件；共享应用级预览确认弹窗。 |
| 能力目录 | 增加按用途配置入口；技术类型作为目录筛选；能力 Package 复用既有生命周期动作、清单安装、预览和确认，不复制连接表单。 |
| 权限归位 | 权限、Auto Review、时间上下文放在“模型与执行”，与输入框保持同一权限设置。偏好保留语言、主题、字号、通知、快捷键和听写。 |
| 快捷键 | 搜索、录入、冲突和系统保留键提示、恢复默认，绑定新对话、设置及计划任务真实入口；复用 DSH Input、Button、ShortcutKeys。 |
| Auto Review | 设置通过原有 sendMessage 传给 Codex `turn/start.approvalsReviewer`，使用 `auto_review` / `user`；不建立第二个审批器，不改变 sandbox。完全访问模式不会产生此类审批。 |
| 时间上下文 | 可选择在每次发送时附带当前时间与时区，使用公开文本输入，作用于新会话及既有会话的下一次发送。 |
| 语音输入 | 支持浏览器 SpeechRecognition 的环境可启用输入框听写，文本仅追加草稿，不自动发送；识别期间编辑的草稿不会被覆盖。缺少服务时明确提示系统听写或支持的网页端。 |
| OPL Link 暂不内置 | Framework 按 `development_only` 排除默认注册和未安装推荐，Link 不再投影内置设置入口，发布清单继续排除；保留 descriptor、显式发现、已安装实例及用户数据。 |

## 验证

- App `bun run validate:active-shell` 通过：其中 Studio Node 套件 378 项通过，renderer 套件 66 项通过；模型、状态、候选合同及其余必需检查通过。
- Studio 类型检查、renderer/WebUI 构建通过；设置与 UI composition 43 项通过；新增执行偏好测试 3 项通过，覆盖新旧会话、自动审阅开关、时间上下文、sandbox 保持及非法类型拒绝。
- Framework 类型检查与构建通过；记忆/存储安全测试 5 项、默认曝光及开发中连接器排除测试 4 项通过。
- 隔离 Temporal 与 fake Codex App Server 完整工作台测试通过：创建、预览、确认、编辑、时区、暂停/恢复、真实单次定时触发、手动运行、并发 revision 冲突、重启及已删除任务历史保留；记忆纠错不修改主记忆；清理检查指纹和 receipt。
- 本机源码 WebUI 的 16 个设置页逐页检查：1280×720 浅色与 780×900 深色均无设置容器横向溢出，各页保持唯一主标题。
- 浏览器实际验证快捷键冲突、修改后导航、恢复默认；Auto Review 与时间上下文重载持久化后恢复测试前值；计划任务“新建→预览→确认弹窗→取消”通过，确认弹窗实例数为 1，没有保存测试任务。
- 合成语音识别器验证开关、录入、识别期间草稿编辑与不自动发送。未录制真实麦克风音频，也未验证识别服务网络、识别准确率或 Electron 原生语音服务。

截图保存在 Studio `output/playwright/`：`settings-model-execution-dark.png`、`settings-final-preferences.png`、`schedules-workbench-dark-narrow.png`、`schedules-confirmation-dark-narrow.png`。浏览器控制台仍有上游图标 key 提示；未将其当作功能验收失败或“无控制台告警”。

## 验证边界

源码、浏览器运行和隔离服务验证已完成；本机正式安装包、远端主线、正式发布及附加渠道均未因本轮改变。Auto Review 验证了公开 schema 与请求路由，没有人为触发真实危险操作来测试拒绝；语音在缺少识别服务的载体中仍不可启用，不能称为该载体已经支持原生录音。

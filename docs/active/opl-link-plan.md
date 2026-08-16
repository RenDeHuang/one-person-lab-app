# OPL Link 跨仓落地计划

Owner: `one-person-lab-app`
Purpose: `opl_link_cross_surface_product_and_delivery_plan`
State: `approved_design_repository_initialized_source_not_implemented`

Machine truth 归本文件引用的 App contracts、OPL Link/Cloud/Shell owner source 与 tests、Apple
carrier、provider readback 和运行时证据。本文件组织跨仓依赖，不证明 iOS、Cloud、腾讯 IM、
TestFlight 或公开发布已经完成。

## 当前结论

对外产品名和主屏短名均为 **OPL Link**，应用内母品牌为 **One Person Lab**；`remote_companion`
仅保留为内部 surface/protocol ID。OPL Link 是连接运行中桌面 OPL App 的原生 iOS 远程伴侣，
不是 iPhone 本地 runtime、第二任务库、第二 action bus 或云工作台。

首发使用腾讯云 IM 体验版。电脑和 iPhone 均主动建立出站连接，用户不需要公网 IP、端口转发、
VPN、Tailscale 或局域网配置。业务协议保持 `opl_remote_transport.v1`，provider SDK 只存在于
adapter 边界；Ably 是替换候选，不在 MVP 双写、镜像 history 或自动 fallback。

## 统一产品边界

- 桌面 OPL App/Codex runtime 拥有 task history、turn execution、model、permission、Package
  和 canonical action authority。
- iPhone 显示 desktop projection，允许列出/读取/刷新/启动任务、发送文本、停止 turn、处理
  owner 投影的低/中影响审批以及撤销 pair。
- iPhone 不执行 shell、任意文件读写、provider/model/permission 编辑、Package 生命周期、离线
  命令或云端任务迁移。
- task content 在 desktop/iPhone 之间 E2EE；Cloud 和腾讯只能看到不透明路由标识、密文和最小
  生命周期状态。provider history 不是业务 truth。
- 连接成功不等于任务或桌面 readiness；前台恢复/重连后必须先读取 desktop canonical state。

## 邀请与席位

腾讯体验版规划快照按 100 个注册 UserID、峰值 DAU 100 计算。一个 active pair seat 使用一对
pair-specific desktop/iOS UserID；最多 40 席占用 80 个 UserID，约 20 个保留给 App Review、
内部测试、换机和回收。35 席预警，40 席停止新配对。该数字必须在 Beta 和公开发布前重新对照
腾讯官方当前文档。

只有成功配对才创建腾讯 IM UserID；下载、安装、打开 App、发邀请或失败的扫码不占席位。
Cloud 负责 invitation entitlement、5 分钟原子 seat reservation、UserSig、账号创建/删除和
absence readback。撤销必须先阻止新 UserSig、踢下线并 detach desktop；两个 UserID 删除并由
owner readback 确认不存在后才释放 seat。iOS 只渲染 broker 返回的 `capacity_unavailable`、
`revoking` 等状态。

TestFlight 只用于 Beta 载体，不承担长期容量控制；正式版可上架，但未获邀请或达到 40 席时
不能创建新 pair。App Review 使用保留的 sandbox pair 或完整 demo access。

## Owner 与吸收顺序

| Owner | 当前职责 | 不应复制的 authority |
| --- | --- | --- |
| `one-person-lab-app` | 产品名、MVP outcome、page state、action allowlist、E2EE、capacity policy、发布门槛 | iOS source、Tencent SDK、Cloud seat ledger |
| `opl-link` | SwiftUI、客户端状态/Keychain、E2EE client、`RemoteTransport`、Tencent adapter、Apple carrier | desktop action、Cloud invite/seat/UserID、task history |
| `one-person-lab-cloud` | invite、原子 seat、UserSig、腾讯 UserID provisioning/delete/readback、revoke | task content/history、iOS UI、desktop action |
| `opl-aion-shell` 或已准入 successor | desktop QR/pairing Settings、Tencent desktop adapter、canonical read/action bridge | 第二任务库、Cloud product truth、iOS release |

各仓独立完成 source、focused tests 和 checkpoint；最终集成前从最新 canonical main 重放，
重新跑受影响 contract/aggregate gates，再普通推送唯一 canonical main。候选分支、测试通过或
callback 不是完成证据。

## 阶段

### Phase 0：本次设计准入（已完成）

- 建立独立 `opl-link` repo、OPL Doc、iOS profile、transport adapter 和 pairing-client contracts。
- App contracts 改为 OPL Link/Tencent/邀请制 40 席语义，并指向新仓。
- 只声明“设计仓已建立”；iOS/Cloud/Shell source、provider 配置和发布仍为 active gap。

### Phase 1：iOS 本地纵向链路（`opl-link`）

创建 SwiftUI project、provider-neutral reducer、E2EE envelope、Keychain/storage、fake transport、
pair/task/conversation/settings 页面和 accessibility/unit tests。先证明真实 UI action → encrypted
request → fake desktop event → state projection 的链路；不把 mock 通过写成 Tencent 可用。

### Phase 2：腾讯 IM adapter（`opl-link` + Cloud fixture）

在 adapter 内实现 pair-specific login、短时 UserSig refresh、C2C custom encrypted message、
reconnect、heartbeat/timeout 和 generic push signal。禁止 SecretKey 入 client/binary/log，禁止
provider 类型泄漏到 domain/UI，未知发送终态先 refresh，不重发。

### Phase 3：真实跨仓 pair（Cloud + Shell + iOS）

Cloud 落地 invite/seat/UserSig/Tencent identity/revoke；Shell 落地 desktop connector 和既有
App read/action bridge；iOS 跑通邀请、扫码、SAS、本地确认、首同步、发送/流式输出、停止、
允许审批、断网恢复、撤销与 seat reclaim。各 owner 的 mock/loopback 必须再由真实 owner
runtime/readback 取代。

### Phase 4：TestFlight Beta

完成 bundle ID、签名、APNs/腾讯推送可选配置、真实 Review sandbox pair；小范围邀请制 Beta
验证 Wi-Fi/移动三网、前后台、UserSig 过期、换机、撤销、seat 回收、隐私日志和更新。TestFlight
容量不是准入 authority。

### Phase 5：App Store public carrier

公开上架并保留 invite gate。35 席发出运营告警，40 席停止新配对；现有 pair 在容量告警期间
继续服务。发布前重核腾讯配额、隐私文案、production push、监控与客服/回收 runbook。

## Ably 替换条件

只有腾讯硬配额、成本、可靠性、地区可达性或能力通过真实 telemetry 证明不再合适时启动。
先实现 Ably adapter 并复用同一 protocol/crypto/dedupe/revoke tests，再以单 provider release
cohort 切换；既有 pair 明确重新配对。不得为“未来可切换”提前加入双 SDK、双写、跨 provider
mirror 或隐式 fallback。

## 当前 active gaps

- `opl-link`：Xcode project、Swift source、真实 iOS tests、签名和 carrier 尚未实现。
- Cloud：invite、40-seat ledger、UserSig、Tencent identity/reclaim/revoke 尚未实现。
- Shell：desktop connector、Settings pairing、Tencent desktop adapter 尚未实现。
- External：腾讯 IM app、Apple namespace、APNs/TestFlight/App Store 尚未配置。
- Evidence：三网、App Review、安装生效、远端 provider quota 和 public readback 均未知。

## 参考

- [OPL Link iOS 仓库](https://github.com/gaofeng21cn/opl-link)
- [App remote companion contract](../../contracts/app-remote-companion.json)
- [腾讯云 IM 文档](https://cloud.tencent.com/document/product/269)

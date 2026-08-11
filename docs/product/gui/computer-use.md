# OPL Computer Use

Owner: `one-person-lab-app` for product policy and user experience; OPL Framework
for installation, repair, MCP registration, health, and installed-state projection.
State: `active_ssot`.

## 结论

OPL App 默认具备 macOS Desktop Computer Use，provider 固定为 KimiCU。OPL
不依赖 ChatGPT App、Kimi App 或 Kimi Code CLI，也不自行维护屏幕识别、窗口
截图、Accessibility 输入注入或 Agent loop。

KimiCU 按用户已核实的 MIT 依赖处理。Full 版本可以携带它的离线 seed；这不
构成第二个 provider 或第二套行为。Standard 与 Full 只在首次 materialization
来源不同：Standard 从固定网络归档下载，Full 从同一归档的随包 seed 展开。
安装完成后，两者必须使用同一版本、路径、签名身份、MCP 注册、工具集、权限
模型和健康检查。

## 固定身份

| 字段 | SSOT |
| --- | --- |
| Provider | `kimi-cu` |
| KimiCU | `0.5.4` |
| 归档 | `https://cdn.kimi.com/kimi-computer-use/0.5.4/KimiCU.app.zip` |
| SHA-256 | `77a7515cf7fd4b7bfa46a95eab0dff7378d00a2c5003bcf7ad93f17667e2808e` |
| Bundle ID / Team ID | `ai.kimi.cu` / `2J9472RW75` |
| 平台 | macOS 14+ arm64 |
| 安装路径 | `/Applications/KimiCU.app` |
| MCP | `/Applications/KimiCU.app/Contents/MacOS/kimi-cu mcp` |
| Full 增量 | 归档下载约 `1.43 MiB`；安装后约 `3.7 MiB` |

工具集合由 release qualification input manifest 唯一声明：
`list_apps`、`get_app_state`、`click`、`type_text`、`press_key`、`scroll`、
`set_value`、`perform_secondary_action`、`select_text`、`drag`。

## 运行时拓扑

```text
OPL App
  -> OPL Framework materializer / status projection
      -> /Applications/KimiCU.app (service + XPC)
      -> OPL-managed CODEX_HOME MCP registration
          -> Codex app-server / Codex CLI session
```

App 只拥有产品策略、Settings 状态、权限引导和 release/distribution contract。
Framework 是唯一 materializer 和 lifecycle owner：它生成一次 capability build
lock，供 Standard 下载、Full seed、安装/修复、MCP 注册和状态聚合共同使用。
Shell 只消费 projection，不复制 provider 清单或 MCP registry。

## 默认状态与权限

安装、注册、启用均默认开启。macOS Accessibility 和 Screen Recording 属于
系统 TCC，不能伪造或绕过。未授权时的正确状态是：

```text
installed=true
registered=true
enabled=true
permission=required
ready=false
```

这不会阻塞普通 OPL 或 plain Codex 对话，只会让 Computer Use capability 显示
`permission_required` 并提供一次性授权引导。用户授权后，Framework 重新执行
`service-status`、`xpc-ping`、`doctor`、MCP `initialize` 和 `tools/list`，状态变为
`ready=true`。下载失败、服务故障或版本不匹配同样只降级该 capability，并提供
可重试/修复动作。

## 浏览器策略

Playwright MCP 是结构化、可重复浏览器自动化的默认 provider 目标；它适合
DOM、导航、选择器和回归任务。KimiCU 负责桌面视觉操作，也可作为 Chrome 的
兜底路径。现有 Chrome 登录态后续单独验证 Kimi WebBridge/CDP；不把 Codex
Chrome 插件或 ChatGPT App 作为 OPL 的硬依赖。

## Standard / Full 验收

两种载体都必须通过同一组 identity、state、MCP handshake 和 tools/list 检查：

1. Standard 能在网络正常时下载并校验固定归档；Full 能在无网络时从精确 seed
   物化同一归档。
2. 两者的安装路径、Bundle ID、Team ID、版本、MCP command/args、默认启用和
   TCC 状态完全一致。
3. Full manifest 只能描述离线 seed，不得出现第二 provider、第二版本、第二
   MCP 注册或第二行为清单。
4. clean VM 的权限提示可以由人工完成；未完成时必须记录
   `permission_required + ready=false`，不能伪造 ready。

## 落地总账

| 工作包 | 状态 | Owner | 交付 / 剩余证据 |
| --- | --- | --- | --- |
| CU1 SSOT 与 build lock | `canonical_source_complete` | App + Framework | App qualification identity 和 Framework derived lock 唯一绑定 KimiCU `0.5.4` |
| CU2 Materializer | `canonical_source_complete` | Framework | Standard 下载、Full seed、SHA/Bundle/Team/version/arch/codesign/Gatekeeper 校验、`ditto` staged replace 和 service install 已进入 Framework `main` |
| CU3 MCP/state bridge | `canonical_source_complete` | Framework | 复用现有 Codex registry 唯一 writer；已实现 service/XPC/`doctor`/MCP tools 健康检查、`managed_companions[]` 和 owner actions |
| CU4 默认启动 | `canonical_source_complete` | Framework + AionUI Shell | Desktop 初始化自动调用 `opl system startup-maintenance --json`；失败只降级 Computer Use，不阻塞普通 OPL/Codex |
| CU4 Capabilities/TCC UX | `canonical_source_complete` | App + AionUI Shell | 专用状态行只消费 `managed_companions[]`，授权/复查/修复/重装按钮只调用 Framework projection actions，并在动作后执行 full readback |
| CU5 Desktop qualification | `unverified` | Release owner | Standard/Full clean VM、真实安装路径、TCC prompt、installed MCP handshake/tools 和 release evidence |
| CU6 Browser | `planned` | Framework + Shell | Playwright MCP 结构化路径；KimiCU 视觉兜底；WebBridge/CDP 单独验证 |

当前 canonical source 已完成 App contracts、Full 离线 seed、Framework
materializer/MCP/state/actions，以及 AionUI desktop 默认 startup caller 和专用
Capabilities/TCC projection UX。剩余桌面工作不再是实现第二套 Computer Use 引擎，
而是 clean-VM installed qualification 和 packaged pixel/user-path readback。Playwright
浏览器 provider 仍是独立后续。
不得把本文件或源码测试视为 KimiCU 已安装、TCC 已授权或 release 已完成。

## 机器合同与验证入口

- 产品策略：`contracts/app-gui-product-contract.json#computer_use_policy`
- 分发 parity：`contracts/app-release-channel.json#computer_use_distribution`
- 固定 identity：`contracts/app-release-qualification-input-manifest.json#runtime_payloads.kimi_cu`
- Full seed：`contracts/app-full-third-party-source-manifest.json#runtime_payloads.kimi_cu`
- 首次安装矩阵：`contracts/app-first-run-test-matrix.json#computer_use_qualification`
- focused test：`node --experimental-strip-types --test tests/release/computer-use-distribution-contract.test.ts`

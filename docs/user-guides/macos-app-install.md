# macOS App Install Guide

Owner: `one-person-lab-app`
Purpose: `macos_app_install_user_guide`
State: `active`
Machine boundary: Human-readable user guide. Release contracts and workflows
remain the machine truth.

## 下载

打开 App 仓的最新 Release：

https://github.com/gaofeng21cn/one-person-lab-app/releases/latest

首次安装或干净机器优先选择：

```text
One-Person-Lab-Full-<version>-mac-arm64.dmg
```

已经安装过 One Person Lab App 的用户，使用标准 DMG 或 App 内更新：

```text
One-Person-Lab-<version>-mac-arm64.dmg
```

Full 版 DMG 是首次安装资产，不进入 `latest*.yml` updater metadata。

## 安装

1. 打开下载的 DMG。
2. 将 `One Person Lab.app` 拖入 `/Applications`。
3. 从 Applications 启动 `One Person Lab.app`。
4. 如果 macOS 提示需要确认打开，按系统安全提示允许。

![One Person Lab first launch](/Users/gaofeng/workspace/one-person-lab-app/artifacts/opl-installed-smoke-20260515-154821/first-launch.png)

## 首次启动

首次启动会检查 OPL Framework runtime、domain modules、Codex CLI、推荐
skills 和 Full online runtime readiness。Full 版 DMG 内的 Framework runtime
/ CLI / contracts payload 来自 `gaofeng21cn/one-person-lab`，但发布流程归
App 仓。

看到 One Person Lab 主入口后，可以进入 Research Foundry / MAS 工作流。
如需要配置 Codex API key 或权限，请联系 gflabtoken 管理员开通。

## 更新

普通更新走标准 App updater metadata。Full 版 DMG 只用于首次安装或重新
准备完整本地 runtime，不作为 App 自动更新目标。

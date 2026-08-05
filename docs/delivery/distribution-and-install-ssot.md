# OPL App 分发与安装 SSOT

## 产品边界

OPL App 对用户发布的产品只有 **Desktop**。浏览器访问不是第二个 App 产品：
macOS 与 Linux Desktop 可在无图形会话中运行，并通过 Desktop 自带的 WebUI 提供同一工作台。

`--headless` 只安装 Framework Base/CLI，不安装 App，因此不属于 Desktop 发布产品。
Docker WebUI 保留为独立容器产品线，使用 GHCR 自己的版本、资格与移动标签；它不是
Desktop Stable 的 follower，也不参与 Desktop GitHub Release 的资产集合。

## Stable Desktop Release Set

每个 Stable 版本只有一个 GitHub Release 和一个 `v<version>` tag：

| 成员 | 角色 | 发布位置 |
| --- | --- | --- |
| macOS arm64 Desktop Standard | 主发布、Latest 激活门槛 | 同一 Stable Release/tag |
| macOS arm64 Desktop Full | 可追加的离线密度 | 同一 Stable Release/tag |
| Linux x64 Desktop | 同版本 Desktop 成员 | 同一 Stable Release/tag |
| Windows x64 Desktop | 同版本 Desktop 成员 | 同一 Stable Release/tag |

Linux、Windows 和 Full 不创建 optional、adjunct 或独立 Release/tag。追加操作必须对
同名资产执行 digest CAS：缺失则上传，同名同 digest 视为幂等，同名不同 digest 失败关闭。
这些追加不得改写主 macOS 资产、release body、updater identity 或 Latest。

不再发布独立 Native WebUI tarball、WebUI qualification tarball、`install-web.sh`，也不再
运行 WebUI follower、Native WebUI follower 或 optional existing-base publisher。

## 安装入口

### macOS

Homebrew 用户安装 Desktop Standard：

```bash
brew install --cask gaofeng21cn/one-person-lab/one-person-lab
open -a "One Person Lab"
```

直接安装使用 exact Stable tag 中的 DMG，或同 tag 的 `opl-install.sh`。Full 只从该
Release 的 `opl-release-manifest.json` 解析；缺失、重复或 digest 不一致均失败关闭。

### Linux

Linux 使用 exact Stable tag 中的 `.deb`、`opl-install.sh`、
`opl-app-component-manifest.json` 与 `opl-desktop-platforms-manifest.json`。安装器必须证明
这些文件来自同一个 Release/tag，再校验 digest 并安装。Desktop 可在 headless host 上
启动内置 WebUI，用户通过浏览器访问该 Desktop 实例。

### Windows

Windows x64 installer、blockmap、`latest.yml` 与 updater receipt 均属于同一个 Stable
Release/tag。Windows Preview/RC 是独立的非 Stable 验证通道，不能变成第二个 Stable
Release，也不能替代同 tag Stable 资产。

## 质量与指针

Stable/Preview 是质量；Manual/Automated 是触发方式；Latest 是可移动指针，三者互不替代。
Desktop GitHub Latest 只由合格的 macOS arm64 主发布激活。Full、Linux、Windows 的同 tag
追加不移动 Latest。

Docker WebUI 使用独立的 `independent_stable` 与 `independent_preview` authority：

- Stable 发布不可变版本，并在显式确认后以一次 CAS 同时移动 `:stable` 与 `:latest`；
- Preview 发布不可变版本，并在显式确认后只移动 `:latest`，保持 `:stable` 不变；
- 两者都消费 durable GHCR publication record 和独立 source authority，不接受 Desktop
  Stable run、短期 Actions artifact 或 recovery chain 作为发布 authority。

## 真实完成

合同、测试、candidate、task branch 或单次 API 写入都不等于发布完成。终态至少需要：

1. canonical `main` 的 commit/tree/blob 回读；
2. 本地与 hosted 非发布门禁通过；
3. GitHub Release 的 exact asset name/size/SHA-256、Latest、draft/prerelease 状态回读；
4. 临时 Release/tag 的 exact absence；
5. 安装或公开下载的实际字节校验；
6. task-owned 临时目录、ref、worktree 与 lifecycle receipt 清理，`remaining=[]`。

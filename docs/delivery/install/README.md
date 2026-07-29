# One Person Lab 安装指南

先选择产品表面和载荷密度，不需要先理解发布渠道：

| 我想要 | 选择 |
| --- | --- |
| 独立应用窗口、系统菜单和桌面集成 | Desktop |
| 在浏览器使用工作台 | WebUI |
| 服务器、NAS、隔离部署 | WebUI；内部通常选择 Container carrier |
| 较小交付、联网后收敛 | Standard |
| 预置离线 Base/Package seed | Full |
| 只要命令行和运行基础 | Headless |

Desktop/WebUI 与 Standard/Full 是两条正交轴，形成 Desktop Standard、Desktop
Full、WebUI Standard、WebUI Full 四个受支持产品单元。Native/Container 只是 WebUI
内部 carrier。矩阵不证明任何 exact 版本已经公开或安装成功；这仍需 Release 和安装
readback。

## 统一入口

从包含 `opl-install.sh` 的 GitHub Release 开始，macOS 和 Linux 使用同一个、
按版本冻结的入口。不要把可变 `main` 分支脚本直接管道执行。

```bash
VERSION=<release-version>
BASE="https://github.com/gaofeng21cn/one-person-lab-app/releases/download/v${VERSION}"

curl -fLO "${BASE}/opl-install.sh"
curl -fLO "${BASE}/opl-app-component-manifest.json"

EXPECTED="$(
  jq -r '.artifacts[] | select(.name == "opl-install.sh") | .digest | sub("^sha256:"; "")' \
    opl-app-component-manifest.json
)"
if command -v shasum >/dev/null 2>&1; then
  ACTUAL="$(shasum -a 256 opl-install.sh | awk '{print $1}')"
else
  ACTUAL="$(sha256sum opl-install.sh | awk '{print $1}')"
fi
test -n "$EXPECTED" && test "$ACTUAL" = "$EXPECTED"

chmod 0755 opl-install.sh
./opl-install.sh
```

产品路由：

```text
personal             -> Desktop or WebUI + Standard (default) or Full (explicit)
server / isolated   -> WebUI + Standard (default) or Full (explicit)
payload density      -> selected only when the exact platform manifest exposes it
WebUI carrier        -> Native or Container, selected by exact platform manifest
--headless           -> OPL Base only
```

当前公共入口的产品表面选择使用：

```bash
./opl-install.sh --desktop
./opl-install.sh --webui
./opl-install.sh --headless
```

`--desktop` / `--webui` 选择表面。当前 macOS Stable carrier 通过
`--stable-macos-install --standard|--full` 选择密度；其他平台只有在 exact Release
manifest 暴露对应格子时才能选择，缺失必须 fail closed。需要固定 WebUI 内部 carrier
时，现有 Native/Container compatibility flags 只属于高级部署；它们不能建立额外产品
表面。入口必须从 exact Release manifest 解析平台资产和 digest，不得用可变 `latest`
或文档中的历史版本代替。

macOS 的直接 Release 安装会先匿名读取 GitHub Release API。若该请求失败（包括
API 限流返回 HTTP 403），安装器只会在本机已有 `gh` 且 `gh auth` 已登录
`github.com` 时，使用 `gh api` 读取同一个 `latest` 或精确 tag 的 Release
记录；它不会切换版本或跳过 digest 校验。没有 GitHub CLI 或有效登录时会在下载和
目标 App 修改前失败关闭。

## 产品支持矩阵

| 产品表面 | Standard | Full |
| --- | --- | --- |
| Desktop | 同一 Desktop 行为，在线收敛 Official Profile | 同一 Desktop 行为，额外携带离线 seed |
| WebUI | 同一 WebUI 行为，在线收敛 Official Profile | 同一 WebUI 行为，额外携带离线 seed |

四格是支持的产品合同，不是当前公开资产目录。安装前必须从目标 Release 的 component
manifest 和 owner readback 确认所选平台是否有对应 exact carrier、qualification 和
digest；缺失时应明确报告不可用，不能借另一表面、另一密度或历史 carrier 的成功兜底
成“已安装”。

## WebUI 内部 carrier

Native 在宿主直接运行 WebUI，Container 通过 OCI 隔离运行 WebUI。两者共享 WebUI
表面、产品行为和 Official Profile，但可以使用不同目录、service manager、mount 和
更新 adapter。carrier 选择不会改变 Standard/Full，也不会把 WebUI 变成两套产品。

## Homebrew

当前 Homebrew 入口：

```bash
# macOS Desktop
brew install --cask gaofeng21cn/one-person-lab/one-person-lab

# macOS / Linux 的 OPL Base/CLI
brew install gaofeng21cn/one-person-lab/opl
```

Homebrew 支持 Linux，但 Cask 是 macOS App bundle 载体，所以现有 Desktop Cask
不能在 Linux 上安装。技术上可以新增普通 Formula `one-person-lab-webui`，让
macOS/Linux 用同一命令安装 Browser WebUI；它应消费同一 GitHub Release 的
frozen Native payload，而不是重新构建一套字节。该 Formula 是已批准的可行目标，
当前尚未实现。

## 更新归属

| 安装方式 | 谁负责更新 |
| --- | --- |
| Desktop Standard / Full | 对应 Desktop carrier；Full 不进入 Standard updater metadata |
| WebUI Standard / Full | 对应 WebUI carrier；Native/Container 只负责其自身 installed readback |
| OPL Base / Packages | Framework managed update |

Standard 和 Full 在 Desktop/WebUI 两个表面都只表示载荷密度，不是两套更新频道。
Native 和 Container 只表示 WebUI 的内部 carrier，不是两套产品。

产品与维护边界见
[`../distribution-and-install-ssot.md`](../distribution-and-install-ssot.md)。

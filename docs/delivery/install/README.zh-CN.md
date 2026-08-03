<p align="center">
  <a href="./README.md">English</a> | <strong>中文</strong>
</p>

# One Person Lab 安装指南

开始前只需确定两件事：使用桌面应用还是浏览器，以及选择轻量安装包还是完整安装包。
不必先了解发布渠道和内部实现。

| 使用需求 | 建议选择 |
| --- | --- |
| 独立应用窗口、系统菜单和桌面集成 | Desktop |
| 在浏览器中使用工作台 | WebUI |
| 部署到服务器、NAS 或隔离环境 | WebUI，通常使用 Container 载体 |
| 初始下载较小，联网后补齐所需组件 | Standard |
| 安装包内预置离线 Base 和 Package 种子 | Full |
| 只安装命令行和运行基础 | Headless |

Desktop 与 WebUI 决定使用形态，Standard 与 Full 决定安装包规格，两组选择互不冲突，
共同组成 Desktop Standard、Desktop Full、WebUI Standard 和 WebUI Full 四种受支持组合。
Native 与 Container 只是 WebUI 的内部运行载体，不是额外产品。这个矩阵只说明产品合同，
不代表每个平台都已经公开了对应安装包；实际可用性仍应以目标发布版本和安装回读为准。

## 统一安装入口

请从包含 `opl-install.sh` 的 GitHub 发布版本开始安装。macOS 与 Linux 共用同一份按版本
冻结的脚本。不要把 `main` 分支中会继续变化的脚本直接通过管道交给 shell 执行。

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

安装路线如下：

```text
个人使用           -> Desktop 或 WebUI + Standard（默认）或 Full（明确选择）
服务器或隔离部署   -> WebUI + Standard（默认）或 Full（明确选择）
安装包规格         -> 仅在对应平台清单明确提供时可选
WebUI 运行载体     -> 按对应平台清单选择 Native 或 Container
--headless         -> 仅安装 OPL Base
```

当前公开入口通过以下参数选择使用形态：

```bash
./opl-install.sh --desktop
./opl-install.sh --webui
./opl-install.sh --headless
```

`--desktop` 和 `--webui` 用于选择使用形态。当前 macOS 稳定版通过
`--stable-macos-install --standard|--full` 选择安装包规格。其他平台只有在目标发布版本的
清单中明确提供对应组合时才能选择；缺少所需安装包时必须停止，不能自动换用其他版本。
Native/Container 兼容参数只服务于高级 WebUI 部署，不会增加新的产品形态。安装器必须从
目标发布版本的清单中读取平台文件和摘要，不能依赖会变化的 `latest` 地址，也不能照搬文档
里记录的历史版本。

macOS 直接安装时会先匿名读取 GitHub Release API。如果请求失败，包括 API 限流导致的
HTTP 403，只有本机已安装 `gh`，且 `gh auth` 已登录 `github.com`，安装器才会改用
`gh api` 读取同一个 `latest` 或指定标签。这个备用通道不会切换版本，也不会跳过摘要校验。
如果 GitHub CLI 不存在或登录无效，安装会在下载文件和修改目标 App 之前明确停止。

## 支持的产品组合

| 使用形态 | Standard | Full |
| --- | --- | --- |
| Desktop | 使用统一的桌面体验，联网后收敛到官方配置 | 使用相同桌面体验，并额外携带离线种子 |
| WebUI | 使用统一的浏览器体验，联网后收敛到官方配置 | 使用相同浏览器体验，并额外携带离线种子 |

这四种组合是产品合同，不是当前已发布文件的目录。安装前应从目标发布版本的组件清单和
所有者回读中确认：所选平台确实提供对应载体，并且资格状态和摘要都匹配。缺少任何一项时，
应明确报告当前不可用；不能用其他使用形态、其他安装包规格或历史载体的成功结果代替。

## WebUI 运行载体

Native 直接在宿主机上运行 WebUI；Container 通过 OCI 容器隔离运行。两者提供相同的
WebUI 产品行为和官方配置，但可以使用不同的目录、服务管理方式、挂载点和更新适配器。
选择运行载体不会改变 Standard/Full，也不会把 WebUI 拆成两套产品。

## Homebrew

当前 Homebrew 安装入口如下：

```bash
# macOS 桌面应用
brew install --cask gaofeng21cn/one-person-lab/one-person-lab

# macOS 或 Linux 上的 OPL Base/CLI
brew install gaofeng21cn/one-person-lab/opl
```

Homebrew 也支持 Linux，但 Cask 承载的是 macOS 应用包，因此当前 Desktop Cask 不能用于
Linux。未来可以提供普通 Formula `one-person-lab-webui`，复用同一 GitHub 发布版本中的
冻结 Native 载荷；这是已经认可的方向，但目前还不是可用的安装入口。

## 更新由谁负责

| 安装内容 | 更新责任方 |
| --- | --- |
| Desktop Standard / Full | 所选 Desktop 载体；Full 不进入 Standard 更新元数据 |
| WebUI Standard / Full | 所选 WebUI 载体；Native/Container 只回读各自的安装状态 |
| OPL Base / Packages | Framework 托管更新 |

在 Desktop 和 WebUI 中，Standard 与 Full 都只表示安装包规格，不是两条更新渠道；
Native 与 Container 也只是 WebUI 的运行载体，不是两套产品。

产品和维护边界见
[`distribution-and-install-ssot.md`](../distribution-and-install-ssot.md)。

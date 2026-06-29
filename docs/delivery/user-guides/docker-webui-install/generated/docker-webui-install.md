# One Person Lab Docker/WebUI 新手安装教程

Owner: `one-person-lab-app`
Purpose: `docker_webui_install_user_guide_source`
State: `active`
Machine boundary: Human-readable Docker/WebUI user guide source. App release contracts, GHCR publish receipts, shell Dockerfile, WebUI backend behavior, and live container smoke remain the machine truth.

适用对象：Linux、Windows 或服务器用户；默认没有 Docker 经验。

macOS 用户可以继续使用 DMG、一键安装、Homebrew 或 Docker；Linux 和 Windows 用户从本教程开始，通过浏览器打开 One Person Lab。

镜像：`ghcr.io/gaofeng21cn/one-person-lab-webui:latest`

参考：https://github.com/gaofeng21cn/one-person-lab/blob/main/docs/references/current-support/opl-docker-webui-deployment.md

> Docker/WebUI 默认会自动完成本机浏览器登录，不需要手动输入用户名和密码。如果要让别人通过网络访问这台电脑上的 WebUI，请先让技术支持配置内网、反向代理、TLS 和访问控制。访问密钥、登录密码和研究数据不要写入公开文档或截图。

## 准备清单

- 一台 Windows 10/11、Ubuntu Linux 或 Linux 服务器。
- 稳定网络，用于安装 Docker 和下载 One Person Lab WebUI 镜像。
- 如果是 Windows，先确认电脑可以启用 WSL 2 和虚拟化；普通个人电脑优先使用 Docker Desktop。
- 如果是 Linux，准备一个可以使用 `sudo` 的账号。
- 如果需要模型访问，联系管理员获取访问密钥；不要把密钥发到群里或写进截图。
- 准备一个固定的本机目录保存数据和项目：Windows 使用 `C:\Users\你的用户名\OnePersonLab`，Linux 使用 `~/OnePersonLab`。

## 1. 先看你是哪种电脑

如果你面前是 Windows 电脑，先安装 Docker Desktop，再在 PowerShell 里启动 One Person Lab。如果你面前是 Ubuntu Linux 或 Linux 服务器，直接在终端里安装 Docker 并启动 WebUI。macOS 用户仍然优先看 macOS App 图文教程。

**入口选择**

```text
Windows 10/11 -> 安装 Docker Desktop -> PowerShell 启动 OPL
Ubuntu Linux / Linux 服务器 -> 终端安装 Docker -> 终端启动 OPL
macOS -> DMG / 一键安装 / Homebrew / Docker
```

重点：

- Windows 新手不要先打开 Linux 命令；先装 Docker Desktop。
- Linux 用户重点是复制终端命令运行。
- 所有系统最后都在浏览器打开 `http://localhost:3000/`。

说明：

- 如果你不确定自己的系统，Windows 左下角有开始菜单；Ubuntu/Linux 通常会使用 Terminal/终端。
- 本教程只覆盖非 macOS 的 Docker/WebUI 路径。

## 2A. Windows：安装 Docker Desktop

打开 Docker 官方 Windows 安装页面，下载 Docker Desktop Installer。双击安装器，普通个人电脑选择推荐的 per-user 安装；看到 WSL 2 相关选项时保持启用。安装完成后，从开始菜单打开 Docker Desktop，等它显示正在运行。

**Windows 要做的事**

```text
1. 打开 Docker Desktop for Windows 下载页
2. 下载并双击 Docker Desktop Installer.exe
3. 保持 WSL 2 backend / Use WSL 2 选项启用
4. 安装完成后打开 Docker Desktop
```

重点：

- 新手优先选择 Docker Desktop，不需要理解 Docker 内部结构。
- Docker Desktop 窗口打开并显示运行后，再继续下一步。
- 如果提示 WSL 2 或虚拟化未启用，按 Docker Desktop 的提示修复或请技术支持处理。

说明：

- Docker 官方文档建议多数用户使用 per-user 安装；该模式使用 WSL 2 backend。
- Windows Server 不是 Docker Desktop 的普通支持场景；服务器由技术支持单独部署。

## 3A. Windows：启动 One Person Lab

Docker Desktop 正在运行后，打开 PowerShell。先创建 One Person Lab 的本机保存目录，再运行 WebUI。即使电脑里还没有 `OnePersonLab` 文件夹，下面两行 `New-Item` 也会自动创建 `data` 和 `projects` 子目录。第一次运行会下载预热好的 One Person Lab WebUI 镜像，可能需要几分钟。看到终端持续输出日志时，不要关闭这个窗口。

**PowerShell 命令**

```text
New-Item -ItemType Directory -Force "$env:USERPROFILE\OnePersonLab\data"
New-Item -ItemType Directory -Force "$env:USERPROFILE\OnePersonLab\projects"
docker run --rm -p 3000:3000 `
  -v "$env:USERPROFILE\OnePersonLab\data:/data" `
  -v "$env:USERPROFILE\OnePersonLab\projects:/projects" `
  -e AIONUI_ALLOW_REMOTE=true `
  -e AIONUI_DATA_DIR=/data `
  ghcr.io/gaofeng21cn/one-person-lab-webui:latest
```

重点：

- 这个窗口就是 One Person Lab WebUI 的运行窗口。
- 窗口关掉后 WebUI 会停止；重新运行同一条命令即可再次打开。
- 如果 `C:\Users\你的用户名\OnePersonLab` 原本不存在，命令会自动创建。
- `OnePersonLab\data` 保存配置、登录会话、对话历史、SQLite、日志和缓存。
- `OnePersonLab\projects` 保存你的项目文件；在界面里选择项目目录时，从 `/projects` 里选择。

说明：

- 如果提示 `docker` 命令不存在，先确认 Docker Desktop 已启动，再重新打开 PowerShell。
- 如果下载镜像很慢，先换网络或请技术支持确认 GitHub/GHCR 是否可访问。
- 收到 WebUI/Docker 镜像更新通知时，可以拉取新镜像并重新运行这条命令；`OnePersonLab` 目录里的数据和项目不会因为替换容器而丢失。

## 2B. Linux：安装 Docker

在 Ubuntu 上打开 Terminal/终端，先安装 Docker Engine。下面是官方 apt repository 路线的简化命令，适合新机器首次安装。每一行都可以复制到终端执行。

**Ubuntu 安装命令**

```text
sudo apt update
sudo apt install ca-certificates curl
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc
sudo apt update
sudo apt install docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
```

重点：

- 终端要求输入密码时，输入电脑登录密码；输入时屏幕可能不显示字符，这是正常的。
- 安装完成后用 `sudo docker run hello-world` 验证 Docker 可用。
- 如果不是 Ubuntu，不要硬套这段命令，请按 Docker 官方对应系统文档安装。

说明：

- Docker 官方 Ubuntu 文档要求先配置 apt repository，再安装 Docker packages。
- 如果 `sudo docker run hello-world` 成功，说明 Docker 已经可以运行容器。

## 3B. Linux：启动 One Person Lab

Docker 安装完成后，在终端先创建 One Person Lab 的本机保存目录，再启动 WebUI。即使 Home 目录下还没有 `OnePersonLab` 文件夹，`mkdir -p` 也会自动创建 `data` 和 `projects` 子目录。第一次运行会下载预热好的 One Person Lab WebUI 镜像。看到日志持续输出后，保持终端窗口打开。

**Linux 终端命令**

```text
mkdir -p "$HOME/OnePersonLab/data" "$HOME/OnePersonLab/projects"
sudo docker run --rm -p 3000:3000 \
  -v "$HOME/OnePersonLab/data:/data" \
  -v "$HOME/OnePersonLab/projects:/projects" \
  -e AIONUI_ALLOW_REMOTE=true \
  -e AIONUI_DATA_DIR=/data \
  ghcr.io/gaofeng21cn/one-person-lab-webui:latest
```

重点：

- 本机使用时，浏览器访问 `http://localhost:3000/`。
- 服务器使用时，技术支持应配置服务器地址、反向代理和访问控制。
- 不要关闭运行命令的终端窗口；关闭后 WebUI 会停止。
- 如果 `~/OnePersonLab` 原本不存在，`mkdir -p` 会自动创建。
- `~/OnePersonLab/data` 保存配置、登录会话、对话历史、SQLite、日志和缓存。
- `~/OnePersonLab/projects` 保存你的项目文件；在界面里选择项目目录时，从 `/projects` 里选择。

说明：

- 如果你已经配置了 Docker 非 root 用户，也可以去掉命令开头的 `sudo`。
- 需要后台长期运行时，请让技术支持改成 Docker Compose 或系统服务。
- 收到 WebUI/Docker 镜像更新通知时，可以拉取新镜像并重新运行这条命令；`~/OnePersonLab` 目录里的数据和项目不会因为替换容器而丢失。

## 4. 打开浏览器访问 WebUI

打开 Chrome、Edge 或 Firefox，在地址栏输入 `http://localhost:3000/`。如果是在服务器上部署，请输入技术支持给你的服务器访问地址。Docker/WebUI 会自动完成登录配置；正常情况下你会直接看到 One Person Lab 的工作台或启动检查页面。

**浏览器地址和自动进入**

```text
本机电脑：http://localhost:3000/
服务器：使用技术支持提供的 https 地址
正常情况：不需要输入用户名/密码，直接进入 One Person Lab
```

![浏览器地址和自动进入](../assets/01-browser-open-webui.png)

重点：

- 地址要输入到浏览器地址栏，不是搜索框里的关键词。
- 如果页面打不开，先确认 Docker/终端窗口还在运行。
- 如果看到登录页，不要自己猜用户名密码；先刷新一次，仍不行就重启容器或联系技术支持。

说明：

- 截图来自本机 Docker 容器运行的 WebUI，浏览器已自动进入界面。
- 本教程截图统一使用中文界面；如果你的浏览器显示其他语言，可在设置里切换为中文。

## 5. 看到首启检查页

浏览器进入 One Person Lab 后，会先看到首启检查页。页面会检查工作目录、本机助手和访问权限。这里不需要输入 WebUI 用户名或密码；如果访问权限还没配置，继续下一步填写访问密钥。

**自动登录后的首启检查页**

```text
1. 浏览器进入 One Person Lab
2. 页面显示侧边栏、设置、退出登录和首启检查
3. 工作目录和本机助手就绪后，检查访问权限
4. 保持 Docker/终端窗口运行
```

![自动登录后的首启检查页](../assets/02-first-run-overview.png)

重点：

- 看到“退出登录”说明浏览器已经处于登录状态。
- 不需要手动输入 WebUI 用户名和密码。
- 模型访问密钥和 WebUI 登录不是一回事；如果界面后续要求配置模型，按管理员提供的信息填写。

说明：

- 截图来自 Docker/WebUI 自动登录后的真实浏览器页面。
- 实际 WebUI 页面会随版本、启动检查状态和语言设置略有不同。

## 6. 配置访问密钥

如果首启检查页提示“访问权限”需要处理，请联系管理员获取访问密钥。拿到密钥后，粘贴到“输入访问密钥”输入框，点击“完成配置”。访问密钥用于模型访问配置，不是 WebUI 登录密码，也不要把密钥写进聊天、文档或截图。

**首启页中的访问密钥配置入口**

```text
1. 找到“访问权限”这一项
2. 在“输入访问密钥”里粘贴管理员提供的密钥
3. 点击“完成配置”
4. 页面检查通过后，点击“进入 OPL”开始使用
```

![首启页中的访问密钥配置入口](../assets/03-access-key-config.png)

重点：

- 这是模型访问密钥，不是 WebUI 用户名密码。
- 密钥只需要填写一次；后续配置会保存在本机 `OnePersonLab/data`。
- 不要在截图里展示真实密钥。

说明：

- 截图来自干净 Docker 数据目录首次启动后的真实中文 WebUI。
- 如果之后需要重新检查访问配置，可以从左侧“设置”进入“访问”。

## 7. 以后从设置进入访问配置

首次配置完成后，日常一般不需要反复填写访问密钥。如果需要重新检查访问状态，点击左侧“设置”，在设置页里选择“访问”，就能看到 Codex CLI、访问密钥、本机后台服务和权限模式的状态。

**设置页中的访问入口**

```text
1. 点击左侧“设置”
2. 在设置页找到“访问”
3. 点击“访问”查看访问密钥和本机权限状态
```

![设置页中的访问入口](../assets/04-settings-entry.png)

重点：

- 这是后续检查入口，不是首次启动必须步骤。
- 真实访问密钥不要展示在截图或文档里。
- 如果访问状态显示需要处理，联系管理员确认密钥是否有效。

说明：

- 截图来自同一个干净 Docker WebUI 环境。
- 不同版本的设置项位置可能略有调整，但入口名称保持为“访问”。

## 8. 下次怎么打开和关闭

下次使用时，先打开 Docker Desktop 或确认 Linux Docker 服务正在运行，然后重新运行启动 One Person Lab 的命令，再用浏览器访问 `http://localhost:3000/`。不用时可以在终端按 Ctrl+C 停止。进入 WebUI 以后，运行环境、模块和访问配置主要由 One Person Lab 自己的启动检查和维护功能处理；收到 WebUI/Docker 镜像更新通知时，再拉取最新镜像并用同样的挂载命令启动。不要删除本机 `OnePersonLab` 目录。

**日常使用**

```text
打开：运行同一条 docker run 命令
访问：浏览器打开 http://localhost:3000/
关闭：终端按 Ctrl+C
保留：不要删除本机 OnePersonLab/data 和 OnePersonLab/projects
模块维护：在 WebUI 中按提示完成启动检查和更新维护
入口镜像更新：收到通知时 docker pull ghcr.io/gaofeng21cn/one-person-lab-webui:latest 后重新运行启动命令
```

重点：

- `OnePersonLab/data` 是 WebUI 内部数据保存位置，不要随便删除。
- `OnePersonLab/projects` 是项目文件保存位置，建议把长期项目都放在这里。
- 运行环境、Codex 配置和模块维护主要通过 WebUI 进入后的 OPL 维护机制完成。
- 更新入口镜像时，只要挂载目录不变，数据和项目会继续保留。
- 镜像更新主要用于更新 WebUI 外壳、启动器、bundled AionCore、bootstrap 脚本和基础系统层。
- 正式服务器部署请交给技术支持配置长期运行。

说明：

- 这份教程面向新手日常使用，不展开 Docker 内部概念。
- Docker/WebUI 镜像不是静态全家桶，也不是纯裸 Linux；它是预热好的 WebUI 运行镜像，内含 WebUI、AionCore、启动器、OPL bootstrap 和镜像清单。
- 新手教程默认使用 `latest`，它对应预热的 `webui-full` 镜像；`-slim` 镜像只给开发和 CI 使用，不作为普通安装入口。
- 首次初始化和后续运行会把 OPL Framework、Codex CLI、访问配置、会话历史、日志、缓存和维护记录等写入本机挂载的 `OnePersonLab/data`。
- 持久化在 `OnePersonLab/data` 里的运行环境和模块，以 WebUI 首启检查、运行状态和后续 OPL 维护动作的结果为准；镜像内的预热内容用于更快补齐首启环境。
- Docker/WebUI 的发布真相仍以 App release workflow、GHCR publish summary 和 contracts 为准。

## 常见问题

- Windows 上找不到 Docker 命令：先启动 Docker Desktop，等它显示 running，再重新打开 PowerShell。
- Windows 提示 WSL 2 或虚拟化问题：按 Docker Desktop 提示启用 WSL 2 / virtualization，或让技术支持处理。
- Linux 上 `docker` 权限不够：先用 `sudo docker ...`；后续是否配置非 root 用户由技术支持决定。
- 镜像下载很慢或失败：换网络，或让技术支持确认 GHCR 是否可访问。
- 浏览器打不开 `localhost:3000`：确认启动命令窗口还在运行，且没有其他程序占用 3000 端口。
- 服务器给别人访问：不要直接裸露端口，请配置 TLS、域名、反向代理和访问控制。
- 看到登录页怎么办：先刷新浏览器；仍然停在登录页时，回到终端按 Ctrl+C 停止，再重新运行启动命令。如果还是不行，联系技术支持。
- 为什么不用输入用户名密码：Docker/WebUI 启动时会自动配置本机浏览器会话，新手只需要打开浏览器访问地址。
- 配置、登录会话和对话历史保存在哪里：都在本机 `OnePersonLab/data`，容器内对应 `/data`。
- 项目文件保存在哪里：建议都放在本机 `OnePersonLab/projects`，容器内对应 `/projects`。在界面里选择项目目录时，从 `/projects` 下选择。
- 新机器没有 `OnePersonLab` 目录怎么办：按教程命令运行即可，Windows 的 `New-Item -Force` 和 Linux 的 `mkdir -p` 会创建目录；Docker 挂载和 WebUI 启动也会继续创建内部子目录。
- 访问密钥在哪里填：首次打开后看“准备开始使用”页面，在“访问权限”区域的“输入访问密钥”里填写，然后点击“完成配置”。
- 这个 Docker 镜像是不是完整全家桶：不能按静态全家桶理解。它是预热好的 WebUI 运行镜像，包含 WebUI、AionCore、本机启动器、OPL bootstrap 和镜像清单；OPL Framework、Codex CLI、companion skills、访问配置、会话历史和缓存会在首次初始化或运行维护过程中写入本机 `OnePersonLab/data`。
- 我应该用 full 还是 slim 镜像：新手只使用教程里的 `latest`，它会指向预热的 full 镜像。`-slim` 是开发和 CI 变体，不会被标记为 `stable` 或 `latest`。
- 是不是可以只靠 WebUI 维护模块：大体可以这样理解。进入 WebUI 后，运行环境、模块和 Codex 配置主要通过 OPL 自己的启动检查、维护和更新动作处理，数据保存在 `OnePersonLab/data`。但镜像仍然建议在收到通知时更新，因为 WebUI 外壳、启动器、bundled AionCore、bootstrap 脚本、预热内容和基础系统层属于镜像内容。
- 为什么 Docker 镜像里要打包 WebUI：因为用户第一次启动时，OPL Framework 还没有安装在 `OnePersonLab/data` 里。镜像内置 WebUI 后，用户只需要运行 Docker 命令并打开浏览器，WebUI 就能完成自动登录、首启检查、访问密钥配置和 OPL 初始化。
- 安装模式怎么理解：面向新手可以理解成两类体验。macOS 优先使用桌面 App 安装，包括 DMG、一键安装和 Homebrew；Windows、Linux 和服务器优先使用 WebUI 安装体验，Docker 镜像是这个 WebUI 体验在 Linux 容器里的预装入口。macOS 也可以使用 Docker/WebUI，但不是桌面新手的首选路径。

## 验证方式

- Windows 路径按 Docker Desktop 官方 Windows 安装页核对：per-user 安装推荐给多数用户，WSL 2 backend 覆盖大多数 Docker Desktop 用户需求。
- Linux 路径按 Docker Engine Ubuntu 官方 apt repository 安装页核对：先配置 apt repository，再安装 Docker packages，并用 `hello-world` 验证。
- WebUI 自动登录行为由 Web CLI / web-host runtime 验证：无用户名密码请求 `/api/auth/user` 返回 `success: true` 且下发 session cookie。
- Docker 持久化边界按 active shell Dockerfile 和 web-cli 实现核对：`AIONUI_DATA_DIR=/data` 保存 WebUI 内部状态，`/projects` 是用户项目文件挂载点。
- Docker 镜像内容边界按 active shell Dockerfile、`scripts/pack-web-cli.js` 和本地镜像 inspect 核对：镜像包含 WebUI 静态资源、`aionui-web`、bundled AionCore、`opl-install.sh`、镜像清单，并声明 `/data`、`/projects` 挂载点。
- WebUI 维护边界按 web-host runtime proxy 核对：WebUI 通过 `/api/opl-runtime/*` 调用 `opl system initialize`、`opl system startup-maintenance`、`opl system reconcile-modules`、`opl update status/check/plan/apply/repair/rollback` 等 OPL 维护命令。
- 新机器目录创建行为用干净宿主目录验证：`OnePersonLab` 原本不存在时，Docker bind mount 创建 `data` 和 `projects`，WebUI 再创建 `logs`、`runtime`、`.codex`、`.opl`、`opl/state` 等内部目录。
- 浏览器界面截图来自本机干净 Docker 容器的 Playwright 截图，容器端口映射为 `127.0.0.1:64022 -> 3000/tcp`，页面 URL 覆盖 `/#/first-run`，界面语言为中文。

## 来源与边界

- 本教程是新手 onboarding artifact，不是 Docker 官方文档复刻，也不是 release-ready 或 runtime-ready 证明。
- Docker/WebUI 镜像坐标、构建发布和 release gate 归 `one-person-lab-app`；plain WebUI runtime 变量以 active shell Dockerfile / web-cli / web-host 为实现真相。
- Docker/WebUI 的自动登录只用于 standalone WebUI/Docker 新手入口；桌面 App 设置里的 WebUI 密码管理仍保持独立语义。
- 截图资产保存在 `docs/delivery/user-guides/docker-webui-install/assets/`，生成器会校验文件存在、尺寸和 SHA256。

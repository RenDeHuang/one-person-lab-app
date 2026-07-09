# OPL Docker/WebUI 云端部署

这个目录用于服务器、VPS 或云主机部署。它和本机一键安装不同：本机路径为了方便默认免 WebUI 密码；云端路径必须启用 WebUI 用户名/密码，并通过 Caddy 提供 HTTPS。

## 文件说明

- `compose.yaml`：WebUI + Caddy HTTPS 反向代理。
- `compose.gateway-key.yaml`：可选 overlay，用 Docker secret 预配置 OPL Gateway API Key。
- `.env.example`：复制为 `.env`，填写域名、邮箱、镜像和 WebUI 用户名。
- `Caddyfile`：把 HTTPS 流量转发到 WebUI 容器。
- `secrets.example/README.md`：secret 文件写法。

## 1. 准备目录

```bash
cp .env.example .env
mkdir -p secrets data projects
```

编辑 `.env`：

```dotenv
OPL_WEBUI_DOMAIN=opl.example.com
OPL_CADDY_EMAIL=admin@example.com
OPL_WEBUI_IMAGE=ghcr.io/gaofeng21cn/one-person-lab-webui:stable
OPL_WEBUI_USERNAME=opl
OPL_WEBUI_PASSWORD_FILE=./secrets/webui_password
OPL_GATEWAY_API_KEY_FILE=./secrets/gateway_api_key
```

`.env` 只放路径和非 secret 配置。不要把真实 WebUI 密码或 API Key 直接写进 `.env`。

## 2. 放置 WebUI 登录密码

WebUI 登录密码是云端部署必需项，放在主机文件 `secrets/webui_password`：

```bash
printf '%s\n' '<strong WebUI password>' > secrets/webui_password
chmod 600 secrets/webui_password
```

默认登录用户名是 `.env` 里的 `OPL_WEBUI_USERNAME`，默认值 `opl`。浏览器访问时输入这个用户名和 `secrets/webui_password` 文件里的密码。

## 3. 启动 WebUI

```bash
docker compose -f compose.yaml up -d
```

访问：

```text
https://<OPL_WEBUI_DOMAIN>/
username: opl
password: secrets/webui_password 文件里的内容
```

## 4. 可选：启动时预配置 OPL Gateway API Key

如果管理员希望容器启动时就写入 OPL Gateway API Key，把 key 放在 `secrets/gateway_api_key`，然后使用 overlay：

```bash
printf '%s\n' '<OPL Gateway API key>' > secrets/gateway_api_key
chmod 600 secrets/gateway_api_key
docker compose -f compose.yaml -f compose.gateway-key.yaml up -d
```

如果不需要预配置 API Key，不要创建 `secrets/gateway_api_key`，也不要使用 `compose.gateway-key.yaml`。用户仍可以登录 WebUI 后在首启访问页或 Settings -> Access 里填写访问密钥。

## Secret 映射

| 内容 | 主机文件 | `.env` 指向 | 容器内路径 | 用途 |
| --- | --- | --- | --- | --- |
| WebUI 登录密码 | `secrets/webui_password` | `OPL_WEBUI_PASSWORD_FILE=./secrets/webui_password` | `/run/secrets/opl_webui_password` | 云端浏览器登录 WebUI |
| OPL Gateway API Key | `secrets/gateway_api_key` | `OPL_GATEWAY_API_KEY_FILE=./secrets/gateway_api_key` | `/run/secrets/opl_gateway_api_key` | 可选；启动时预配置 Gateway/Codex 访问 |

## 规则

- WebUI 登录密码和 OPL Gateway API Key 是两件事；API Key 不能替代登录密码。
- 只传 Gateway API Key、没有 WebUI 密码时，容器必须拒绝启动。
- 推荐使用 `*_FILE` 和 Docker secrets；明文环境变量只作为高级兜底。
- 不要提交 `secrets/`、`.env`、`data/` 或 `projects/`。
- 不要直接把 WebUI 容器端口裸露到公网；公网入口走 Caddy/HTTPS。

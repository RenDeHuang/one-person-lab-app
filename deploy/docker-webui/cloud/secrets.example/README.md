# Docker secrets

启动 cloud compose stack 前，先在上一级 `../secrets/` 创建真实 secret 文件。

`webui_password` 是浏览器登录云端 WebUI 的密码，云端部署必需。
`gateway_api_key` 是可选的 OPL Gateway API Key，只用于启动时预配置访问密钥。
API Key 不是 WebUI 登录密码，不能替代 `webui_password`。

必需：

```bash
mkdir -p secrets
printf '%s\n' '<strong WebUI password>' > secrets/webui_password
chmod 600 secrets/webui_password
```

可选：启动时预配置 OPL Gateway API Key：

```bash
printf '%s\n' '<OPL Gateway API key>' > secrets/gateway_api_key
chmod 600 secrets/gateway_api_key
```

不要提交 `secrets/`，也不要把这些值粘贴到支持日志里。

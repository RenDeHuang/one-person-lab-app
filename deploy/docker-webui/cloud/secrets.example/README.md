# Docker secrets

Create real files under `../secrets/` before starting the cloud compose stack.

Required:

```bash
mkdir -p secrets
printf '%s\n' '<strong WebUI password>' > secrets/webui_password
chmod 600 secrets/webui_password
```

Optional OPL Gateway API key preconfiguration:

```bash
printf '%s\n' '<OPL Gateway API key>' > secrets/gateway_api_key
chmod 600 secrets/gateway_api_key
```

Do not commit `secrets/` or paste these values into support logs.

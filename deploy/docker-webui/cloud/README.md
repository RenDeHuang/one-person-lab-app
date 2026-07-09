# OPL Docker/WebUI cloud deployment

This package is for server or cloud deployment. The local one-click installer
keeps browser auto-login for beginner desktop use; this cloud template requires
a WebUI username/password and disables auto-login.

## Files

- `compose.yaml`: WebUI plus Caddy reverse proxy with HTTPS.
- `compose.gateway-key.yaml`: optional overlay that preconfigures the OPL
  Gateway API key from a Docker secret.
- `.env.example`: copy to `.env` and set your domain, email, image, and username.
- `Caddyfile`: TLS reverse proxy to the WebUI service.
- `secrets.example/README.md`: secret file setup.

## Start

```bash
cp .env.example .env
mkdir -p secrets data projects
printf '%s\n' '<strong WebUI password>' > secrets/webui_password
chmod 600 secrets/webui_password
docker compose -f compose.yaml up -d
```

With Gateway key preconfiguration:

```bash
printf '%s\n' '<OPL Gateway API key>' > secrets/gateway_api_key
chmod 600 secrets/gateway_api_key
docker compose -f compose.yaml -f compose.gateway-key.yaml up -d
```

The default login username is `opl`, unless `OPL_WEBUI_USERNAME` is set in
`.env`. The Gateway API key is not the WebUI login password; if any Gateway key
secret is provided without a WebUI password secret, the container must fail
closed.

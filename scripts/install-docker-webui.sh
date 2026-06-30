#!/usr/bin/env bash
set -euo pipefail

DEFAULT_IMAGE='ghcr.io/gaofeng21cn/one-person-lab-webui:latest'
OPL_WEBUI_HOME=${OPL_WEBUI_HOME:-"$HOME/OnePersonLab"}
DATA_DIR=${OPL_WEBUI_DATA_DIR:-"$OPL_WEBUI_HOME/data"}
PROJECTS_DIR=${OPL_WEBUI_PROJECTS_DIR:-"$OPL_WEBUI_HOME/projects"}
COMPOSE_FILE=${OPL_WEBUI_COMPOSE_FILE:-"$OPL_WEBUI_HOME/compose.yaml"}
IMAGE=${OPL_WEBUI_IMAGE:-"$DEFAULT_IMAGE"}
PORT=${OPL_WEBUI_PORT:-3000}
HEALTH_TIMEOUT=${OPL_WEBUI_HEALTH_TIMEOUT:-120}
HEALTH_URL=${OPL_WEBUI_HEALTH_URL:-}
DIAGNOSTICS_DIR=${OPL_WEBUI_DIAGNOSTICS_DIR:-}
DIAGNOSTICS_ARCHIVE=${OPL_WEBUI_DIAGNOSTICS_ARCHIVE:-}
DRY_RUN=0
YES=0
UPDATE=0
OPEN_BROWSER=1
DETACH=1
PRE_DATA_INVENTORY=''
PRE_PROJECTS_INVENTORY=''

usage() {
  cat <<'USAGE'
Usage:
  scripts/install-docker-webui.sh [options]

Options:
  --dry-run                 Print the actions without installing Docker or starting the container.
  --yes                     Allow Ubuntu Docker Engine installation without an interactive prompt.
  --update                  Pull the configured WebUI image and recreate the host-side compose service.
  --port <port>             Host port for http://localhost:<port>/ (default: 3000).
  --health-timeout <sec>    Seconds to wait for the WebUI HTTP endpoint (default: 120).
  --health-url <url>        HTTP endpoint to probe (default: http://localhost:<port>/).
  --diagnostics-dir <path>  Write a diagnostic directory after startup.
  --diagnostics-archive <path>
                            Write a .tar.gz diagnostic package after startup.
  --tag <tag>               Use ghcr.io/gaofeng21cn/one-person-lab-webui:<tag>.
  --image <image>           Use a full image reference instead of the default GHCR image.
  --data-dir <path>         Host directory mounted as /data.
  --projects-dir <path>     Host directory mounted as /projects.
  --no-open                 Do not open the browser after startup.
  --detach                  Start with docker compose up -d. This is the default.
  --help                    Show this help.

The installer never accepts API keys. Add access keys inside the WebUI.
USAGE
}

log() {
  printf '[opl-webui] %s\n' "$*"
}

log_user_path_status() {
  log "User path status:"
  log "  one_click_install: create compose.yaml, data/projects directories, and start the WebUI image."
  log "  browser_webui: open ${HEALTH_URL} after the health check passes."
  log "  access_key_settings: enter access keys in the WebUI first-run Access panel or Settings -> Access."
  log "  runtime_proxy: WebUI uses /api/opl-runtime/configure-codex -> opl system configure-codex --api-key-stdin --json."
  log "  startup_recovery: if startup fails, collect redacted startup diagnostics and rerun after fixing Docker, port, image, or data issues."
  log "  data_preservation: keep OnePersonLab/data and OnePersonLab/projects mounted and preserved."
  log "  host_update: rerun this installer, or pass --update, to pull the WebUI image from the host and recreate the compose service."
}

die() {
  printf '[opl-webui] ERROR: %s\n' "$*" >&2
  exit 1
}

need_value() {
  local option="$1"
  local value="${2:-}"
  if [ -z "$value" ]; then
    die "Missing value for $option"
  fi
}

is_uint() {
  case "$1" in
    ''|*[!0-9]*)
      return 1
      ;;
    *)
      return 0
      ;;
  esac
}

reject_compose_unsafe_value() {
  local label="$1"
  local value="$2"
  case "$value" in
    *$'\n'*|*'"'*)
      die "$label must not contain newlines or double quotes because it is written to compose.yaml"
      ;;
  esac
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --dry-run)
      DRY_RUN=1
      ;;
    --yes)
      YES=1
      ;;
    --update)
      UPDATE=1
      ;;
    --port)
      shift
      need_value --port "${1:-}"
      PORT="$1"
      ;;
    --port=*)
      PORT="${1#--port=}"
      ;;
    --health-timeout)
      shift
      need_value --health-timeout "${1:-}"
      HEALTH_TIMEOUT="$1"
      ;;
    --health-timeout=*)
      HEALTH_TIMEOUT="${1#--health-timeout=}"
      ;;
    --health-url)
      shift
      need_value --health-url "${1:-}"
      HEALTH_URL="$1"
      ;;
    --health-url=*)
      HEALTH_URL="${1#--health-url=}"
      need_value --health-url "$HEALTH_URL"
      ;;
    --diagnostics-dir)
      shift
      need_value --diagnostics-dir "${1:-}"
      DIAGNOSTICS_DIR="$1"
      ;;
    --diagnostics-dir=*)
      DIAGNOSTICS_DIR="${1#--diagnostics-dir=}"
      need_value --diagnostics-dir "$DIAGNOSTICS_DIR"
      ;;
    --diagnostics-archive)
      shift
      need_value --diagnostics-archive "${1:-}"
      DIAGNOSTICS_ARCHIVE="$1"
      ;;
    --diagnostics-archive=*)
      DIAGNOSTICS_ARCHIVE="${1#--diagnostics-archive=}"
      need_value --diagnostics-archive "$DIAGNOSTICS_ARCHIVE"
      ;;
    --tag)
      shift
      need_value --tag "${1:-}"
      IMAGE="ghcr.io/gaofeng21cn/one-person-lab-webui:$1"
      ;;
    --tag=*)
      need_value --tag "${1#--tag=}"
      IMAGE="ghcr.io/gaofeng21cn/one-person-lab-webui:${1#--tag=}"
      ;;
    --image)
      shift
      need_value --image "${1:-}"
      IMAGE="$1"
      ;;
    --image=*)
      IMAGE="${1#--image=}"
      need_value --image "$IMAGE"
      ;;
    --data-dir)
      shift
      need_value --data-dir "${1:-}"
      DATA_DIR="$1"
      ;;
    --data-dir=*)
      DATA_DIR="${1#--data-dir=}"
      need_value --data-dir "$DATA_DIR"
      ;;
    --projects-dir)
      shift
      need_value --projects-dir "${1:-}"
      PROJECTS_DIR="$1"
      ;;
    --projects-dir=*)
      PROJECTS_DIR="${1#--projects-dir=}"
      need_value --projects-dir "$PROJECTS_DIR"
      ;;
    --no-open)
      OPEN_BROWSER=0
      ;;
    --detach)
      DETACH=1
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    --api-key|--api-key=*|--*-api-key|--*-api-key=*|--*api_key|--*api_key=*)
      die "Do not pass API keys to this installer. Enter access keys inside the WebUI after it opens."
      ;;
    *)
      die "Unknown option: $1"
      ;;
  esac
  shift
done

if ! is_uint "$PORT" || [ "$PORT" -lt 1 ] || [ "$PORT" -gt 65535 ]; then
  die "Port must be an integer from 1 to 65535: $PORT"
fi
if ! is_uint "$HEALTH_TIMEOUT" || [ "$HEALTH_TIMEOUT" -lt 1 ]; then
  die "Health timeout must be a positive integer: $HEALTH_TIMEOUT"
fi
if [ -z "$HEALTH_URL" ]; then
  HEALTH_URL="http://localhost:${PORT}/"
fi

if [ -z "$IMAGE" ]; then
  die "Image reference must not be empty"
fi
reject_compose_unsafe_value "Image reference" "$IMAGE"
reject_compose_unsafe_value "Data directory" "$DATA_DIR"
reject_compose_unsafe_value "Projects directory" "$PROJECTS_DIR"
reject_compose_unsafe_value "Compose file path" "$COMPOSE_FILE"
reject_compose_unsafe_value "Health URL" "$HEALTH_URL"
reject_compose_unsafe_value "Diagnostics directory" "$DIAGNOSTICS_DIR"
reject_compose_unsafe_value "Diagnostics archive" "$DIAGNOSTICS_ARCHIVE"

OS_NAME="$(uname -s)"

run() {
  log "+ $*"
  if [ "$DRY_RUN" = "0" ]; then
    "$@"
  fi
}

run_shell() {
  local command="$1"
  log "+ $command"
  if [ "$DRY_RUN" = "0" ]; then
    bash -lc "$command"
  fi
}

confirm_ubuntu_docker_install() {
  if [ "$YES" = "1" ]; then
    return 0
  fi
  if [ ! -r /dev/tty ]; then
    die "Docker Engine is missing. Re-run with --yes to install Docker Engine on Ubuntu non-interactively."
  fi
  {
    printf '%s\n' "Docker Engine is not available. This installer can install Docker Engine on Ubuntu using Docker's official apt repository."
    printf 'Type "install docker" to continue: '
  } > /dev/tty
  local reply
  if ! IFS= read -r reply < /dev/tty; then
    die "Docker installation needs a controlling terminal, or pass --yes."
  fi
  if [ "$reply" != "install docker" ]; then
    die "Docker installation cancelled."
  fi
}

install_docker_engine_on_ubuntu() {
  [ -r /etc/os-release ] || die "Cannot read /etc/os-release; install Docker Compose manually and rerun."
  # shellcheck disable=SC1091
  . /etc/os-release
  if [ "${ID:-}" != "ubuntu" ]; then
    die "Docker is not available. Automatic Docker Engine installation is supported only on Ubuntu; install Docker with Compose manually and rerun."
  fi
  if [ -z "${VERSION_CODENAME:-}" ]; then
    die "Ubuntu VERSION_CODENAME is missing in /etc/os-release; install Docker manually and rerun."
  fi
  command -v sudo >/dev/null 2>&1 || die "sudo is required to install Docker Engine on Ubuntu."
  command -v apt-get >/dev/null 2>&1 || die "apt-get is required to install Docker Engine on Ubuntu."

  confirm_ubuntu_docker_install
  run sudo apt-get update
  run sudo apt-get install -y ca-certificates curl gnupg
  run sudo install -m 0755 -d /etc/apt/keyrings
  run_shell 'curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor --yes -o /etc/apt/keyrings/docker.gpg'
  run sudo chmod a+r /etc/apt/keyrings/docker.gpg
  run_shell "printf '%s\n' \"deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu ${VERSION_CODENAME} stable\" | sudo tee /etc/apt/sources.list.d/docker.list >/dev/null"
  run sudo apt-get update
  run sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  run sudo usermod -aG docker "$USER"
  log "Docker Engine installed. If docker commands still need sudo, log out and back in, then rerun this installer."
}

ensure_docker() {
  if [ "$DRY_RUN" = "1" ]; then
    log "Would verify Docker availability."
    case "$OS_NAME" in
      Linux)
        log "On Ubuntu, would install Docker Engine with --yes if the docker command is missing."
        ;;
      Darwin)
        log "On macOS, would only check Docker availability; Docker Desktop, OrbStack, or Colima must already be installed and running."
        ;;
      *)
        die "Unsupported OS: $OS_NAME. This installer supports Linux and macOS."
        ;;
    esac
    return 0
  fi

  if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
    return 0
  fi
  if command -v docker >/dev/null 2>&1; then
    die "Docker is installed but the daemon is not reachable. Start Docker, or fix Docker group permissions, then rerun this installer."
  fi

  case "$OS_NAME" in
    Linux)
      install_docker_engine_on_ubuntu
      command -v docker >/dev/null 2>&1 || die "Docker command is still missing after installation."
      docker info >/dev/null 2>&1 || die "Docker daemon is not reachable. Start Docker or retry after logging into the docker group."
      ;;
    Darwin)
      die "Docker is not available. Install and start Docker Desktop, OrbStack, or Colima, then rerun this installer."
      ;;
    *)
      die "Unsupported OS: $OS_NAME. This installer supports Linux and macOS."
      ;;
  esac
}

ensure_compose() {
  if [ "$DRY_RUN" = "1" ]; then
    log "Would verify docker compose."
    return 0
  fi
  if ! docker compose version >/dev/null 2>&1; then
    die "docker compose is required. Install the Docker Compose plugin, then rerun this installer."
  fi
}

compose_content() {
  cat <<YAML
# Generated by One Person Lab Docker/WebUI installer.
services:
  one-person-lab-webui:
    image: ${IMAGE}
    pull_policy: always
    ports:
      - "127.0.0.1:${PORT}:3000"
    environment:
      AIONUI_ALLOW_REMOTE: "true"
      AIONUI_DATA_DIR: /data
      OPL_PROJECTS_DIR: /projects
    volumes:
      - "${DATA_DIR}:/data"
      - "${PROJECTS_DIR}:/projects"
    restart: unless-stopped
YAML
}

write_compose_file() {
  local existing_marker='Generated by One Person Lab Docker/WebUI installer.'
  if [ "$DRY_RUN" = "1" ]; then
    log "Would create directories:"
    log "  data: $DATA_DIR"
    log "  projects: $PROJECTS_DIR"
    log "Would write compose file: $COMPOSE_FILE"
    compose_content
    return 0
  fi

  PRE_DATA_INVENTORY="$(build_path_inventory "$DATA_DIR")"
  PRE_PROJECTS_INVENTORY="$(build_path_inventory "$PROJECTS_DIR")"
  mkdir -p "$DATA_DIR" "$PROJECTS_DIR" "$(dirname "$COMPOSE_FILE")"
  if [ -f "$COMPOSE_FILE" ] && ! grep -q "$existing_marker" "$COMPOSE_FILE"; then
    die "Refusing to overwrite existing compose file without One Person Lab marker: $COMPOSE_FILE"
  fi
  compose_content > "$COMPOSE_FILE"
}

open_browser() {
  [ "$OPEN_BROWSER" = "1" ] || return 0
  local url="http://localhost:${PORT}/"
  if [ "$DRY_RUN" = "1" ]; then
    log "Would open $url"
    return 0
  fi
  case "$OS_NAME" in
    Darwin)
      if command -v open >/dev/null 2>&1; then
        open "$url" >/dev/null 2>&1 || log "Could not open browser automatically. Open $url"
      else
        log "Open $url"
      fi
      ;;
    Linux)
      if command -v xdg-open >/dev/null 2>&1; then
        xdg-open "$url" >/dev/null 2>&1 || log "Could not open browser automatically. Open $url"
      else
        log "Open $url"
      fi
      ;;
  esac
}

start_webui() {
  local pull_args=(compose -f "$COMPOSE_FILE" pull)
  local up_args=(compose -f "$COMPOSE_FILE" up)
  if [ "$DETACH" = "1" ]; then
    up_args+=(-d)
  fi
  if [ "$DRY_RUN" = "1" ]; then
    if [ "$UPDATE" = "1" ]; then
      run docker "${pull_args[@]}"
    fi
    run docker "${up_args[@]}"
    return 0
  fi
  if [ "$UPDATE" = "1" ]; then
    log "+ docker ${pull_args[*]}"
    if ! docker "${pull_args[@]}"; then
      die "Docker Compose image pull failed. Check Docker/GHCR network access, then rerun this installer."
    fi
  fi
  log "+ docker ${up_args[*]}"
  if ! docker "${up_args[@]}"; then
    if [ -n "$DIAGNOSTICS_DIR" ] || [ -n "$DIAGNOSTICS_ARCHIVE" ]; then
      collect_diagnostics "compose-up-failed" "$DIAGNOSTICS_DIR" || true
    fi
    die "Docker Compose failed. Check Docker status and the compose file at $COMPOSE_FILE, then rerun this installer."
  fi
}

redact_diagnostic_stream() {
  sed -E \
    -e 's/([A-Za-z0-9_.-]*(api[_-]?key|token|credential)[A-Za-z0-9_.-]*[[:space:]]*[:=][[:space:]]*)[^[:space:]"'\'']+/\1[redacted]/Ig' \
    -e 's/(Bearer[[:space:]]+)[A-Za-z0-9._~+\/=-]+/\1[redacted]/Ig' \
    -e 's/sk-[A-Za-z0-9_-]{20,}/sk-[redacted]/g'
}

capture_diagnostic_command() {
  local output_file="$1"
  shift
  {
    printf '$'
    printf ' %q' "$@"
    printf '\n'
    "$@" 2>&1 || printf '\n[command exited with status %s]\n' "$?"
  } | redact_diagnostic_stream > "$output_file"
}

write_http_probe_summary() {
  local output_file="$1"
  {
    printf 'url=%s\n' "$HEALTH_URL"
    printf 'timeout_seconds=%s\n' "$HEALTH_TIMEOUT"
    if command -v curl >/dev/null 2>&1; then
      local http_code
      http_code="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 5 "$HEALTH_URL" 2>&1)" || true
      printf 'curl_http_code_or_error=%s\n' "$http_code"
    elif command -v python3 >/dev/null 2>&1; then
      HEALTH_URL="$HEALTH_URL" python3 - <<'PY'
import os
import urllib.error
import urllib.request

url = os.environ["HEALTH_URL"]
try:
    with urllib.request.urlopen(url, timeout=5) as response:
        print(f"python_http_status={response.status}")
except Exception as exc:
    print(f"python_http_error={type(exc).__name__}: {exc}")
PY
    else
      printf 'http_probe_error=curl and python3 are unavailable\n'
    fi
  } | redact_diagnostic_stream > "$output_file"
}

write_directory_summary() {
  local output_file="$1"
  {
    printf 'compose_file=%s\n' "$COMPOSE_FILE"
    printf 'data_dir=%s exists=%s\n' "$DATA_DIR" "$([ -d "$DATA_DIR" ] && printf yes || printf no)"
    printf 'projects_dir=%s exists=%s\n' "$PROJECTS_DIR" "$([ -d "$PROJECTS_DIR" ] && printf yes || printf no)"
    printf 'compose_dir=%s exists=%s\n' "$(dirname "$COMPOSE_FILE")" "$([ -d "$(dirname "$COMPOSE_FILE")" ] && printf yes || printf no)"
    if command -v ls >/dev/null 2>&1; then
      ls -ld "$DATA_DIR" "$PROJECTS_DIR" "$(dirname "$COMPOSE_FILE")" 2>&1 || true
    fi
  } | redact_diagnostic_stream > "$output_file"
}

build_path_inventory() {
  local target_path="$1"
  if [ ! -e "$target_path" ]; then
    printf 'path=%s\nexists=false\n' "$target_path"
    return 0
  fi

  {
    printf 'path=%s\n' "$target_path"
    printf 'exists=true\n'
    if [ -d "$target_path" ]; then
      printf 'type=directory\n'
      if command -v find >/dev/null 2>&1; then
        local total_entries
        total_entries="$(find "$target_path" -mindepth 1 -maxdepth 3 2>/dev/null | wc -l | tr -d '[:space:]')" || total_entries='unknown'
        printf 'total_entries_max_depth_3=%s\n' "$total_entries"
        printf 'sample_entries_max_depth_3:\n'
        find "$target_path" -mindepth 1 -maxdepth 3 -print 2>/dev/null | sort | head -50 | sed "s#^$target_path#.#" || true
      else
        printf 'inventory_error=find_unavailable\n'
      fi
    else
      printf 'type=file\n'
      ls -l "$target_path" 2>/dev/null || true
    fi
  } | redact_diagnostic_stream
}

write_preservation_summary() {
  local output_file="$1"
  local post_data_inventory post_projects_inventory verdict
  post_data_inventory="$(build_path_inventory "$DATA_DIR")"
  post_projects_inventory="$(build_path_inventory "$PROJECTS_DIR")"
  verdict='preserved_or_reused'
  if printf '%s' "$PRE_DATA_INVENTORY" | grep -q '^exists=false$'; then
    verdict='created_new_data_dir'
  fi
  {
    printf 'verdict=%s\n' "$verdict"
    printf 'policy=existing OnePersonLab data/projects directories must be preserved or migrated without delete\n'
    printf '\n[pre_data_inventory]\n%s\n' "${PRE_DATA_INVENTORY:-not_recorded}"
    printf '\n[post_data_inventory]\n%s\n' "$post_data_inventory"
    printf '\n[pre_projects_inventory]\n%s\n' "${PRE_PROJECTS_INVENTORY:-not_recorded}"
    printf '\n[post_projects_inventory]\n%s\n' "$post_projects_inventory"
  } | redact_diagnostic_stream > "$output_file"
}

collect_diagnostics() {
  local reason="$1"
  local target_dir="$2"
  if [ -z "$target_dir" ]; then
    target_dir="$OPL_WEBUI_HOME/diagnostics/opl-webui-diagnostics-$(date +%Y%m%d-%H%M%S)"
  fi

  if [ "$DRY_RUN" = "1" ]; then
    log "Would write diagnostic directory: $target_dir"
    log "Would include compose.yaml, docker versions, compose ps/logs, HTTP probe summary, directory/port/image metadata."
    if [ -n "$DIAGNOSTICS_ARCHIVE" ]; then
      log "Would write diagnostic archive: $DIAGNOSTICS_ARCHIVE"
    fi
    return 0
  fi

  mkdir -p "$target_dir"
  {
    printf 'reason=%s\n' "$reason"
    printf 'created_at=%s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
    printf 'image=%s\n' "$IMAGE"
    printf 'host_port=%s\n' "$PORT"
    printf 'health_url=%s\n' "$HEALTH_URL"
    printf 'compose_file=%s\n' "$COMPOSE_FILE"
    printf 'data_dir=%s\n' "$DATA_DIR"
    printf 'projects_dir=%s\n' "$PROJECTS_DIR"
  } | redact_diagnostic_stream > "$target_dir/metadata.txt"
  cat > "$target_dir/diagnostics-manifest.json" <<'JSON'
{
  "schema": "opl_docker_webui_diagnostics_manifest.v1",
  "required_files": [
    "metadata.txt",
    "diagnostics-manifest.json",
    "compose.yaml",
    "docker-version.txt",
    "docker-compose-version.txt",
    "docker-compose-ps.txt",
    "docker-compose-logs.txt",
    "docker-image.txt",
    "http-probe.txt",
    "directories.txt",
    "data-preservation.txt"
  ]
}
JSON

  if [ -f "$COMPOSE_FILE" ]; then
    redact_diagnostic_stream < "$COMPOSE_FILE" > "$target_dir/compose.yaml"
  fi
  capture_diagnostic_command "$target_dir/docker-version.txt" docker version
  capture_diagnostic_command "$target_dir/docker-compose-version.txt" docker compose version
  capture_diagnostic_command "$target_dir/docker-compose-ps.txt" docker compose -f "$COMPOSE_FILE" ps
  capture_diagnostic_command "$target_dir/docker-compose-logs.txt" docker compose -f "$COMPOSE_FILE" logs --no-color --tail=300
  capture_diagnostic_command "$target_dir/docker-image.txt" docker image inspect "$IMAGE"
  write_http_probe_summary "$target_dir/http-probe.txt"
  write_directory_summary "$target_dir/directories.txt"
  write_preservation_summary "$target_dir/data-preservation.txt"

  if [ -n "$DIAGNOSTICS_ARCHIVE" ]; then
    mkdir -p "$(dirname "$DIAGNOSTICS_ARCHIVE")"
    tar -czf "$DIAGNOSTICS_ARCHIVE" -C "$(dirname "$target_dir")" "$(basename "$target_dir")"
    log "Diagnostic archive written: $DIAGNOSTICS_ARCHIVE"
  fi
  log "Diagnostic directory written: $target_dir"
}

probe_http_once() {
  if command -v curl >/dev/null 2>&1; then
    local http_code
    http_code="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 5 "$HEALTH_URL" 2>/dev/null)" || return 1
    case "$http_code" in
      2*|3*)
        return 0
        ;;
      *)
        return 1
        ;;
    esac
  fi

  command -v python3 >/dev/null 2>&1 || return 1
  HEALTH_URL="$HEALTH_URL" python3 - <<'PY'
import os
import sys
import urllib.request

try:
    with urllib.request.urlopen(os.environ["HEALTH_URL"], timeout=5) as response:
        sys.exit(0 if 200 <= response.status < 400 else 1)
except Exception:
    sys.exit(1)
PY
}

wait_for_health() {
  if [ "$DRY_RUN" = "1" ]; then
    log "Would wait up to ${HEALTH_TIMEOUT}s for WebUI HTTP health at $HEALTH_URL."
    return 0
  fi

  log "Waiting up to ${HEALTH_TIMEOUT}s for WebUI HTTP health at $HEALTH_URL."
  local start now
  start="$(date +%s)"
  while true; do
    if probe_http_once; then
      log "WebUI HTTP health check passed: $HEALTH_URL"
      return 0
    fi
    now="$(date +%s)"
    if [ $((now - start)) -ge "$HEALTH_TIMEOUT" ]; then
      local failure_dir="${DIAGNOSTICS_DIR:-}"
      if [ -z "$failure_dir" ]; then
        failure_dir="$OPL_WEBUI_HOME/diagnostics/opl-webui-health-timeout-$(date +%Y%m%d-%H%M%S)"
      fi
      collect_diagnostics "health-timeout" "$failure_dir" || true
      die "WebUI did not become reachable at $HEALTH_URL within ${HEALTH_TIMEOUT}s. Diagnostic directory: $failure_dir"
    fi
    sleep 2
  done
}

log "One Person Lab Docker/WebUI installer"
log "Image: $IMAGE"
log "Data directory: $DATA_DIR -> /data"
log "Projects directory: $PROJECTS_DIR -> /projects"
log "Compose file: $COMPOSE_FILE"
log "URL: $HEALTH_URL"
if [ "$UPDATE" = "1" ]; then
  log "Update mode: pull the configured WebUI image from the host and recreate the compose service."
else
  log "Update model: rerun this installer, or pass --update, to pull the WebUI image from the host; the WebUI does not self-update through Docker."
fi
log "Image/seed: default latest/stable WebUI image uses the full seed; --tag and --image are advanced overrides."
log "API keys are not accepted by this installer; enter access keys inside the WebUI first-run Access panel or Settings -> Access."
log_user_path_status

ensure_docker
ensure_compose
write_compose_file
start_webui
wait_for_health
if [ -n "$DIAGNOSTICS_DIR" ] || [ -n "$DIAGNOSTICS_ARCHIVE" ]; then
  collect_diagnostics "requested" "$DIAGNOSTICS_DIR"
fi
open_browser

log "Docker/WebUI startup command completed."
log "To stop it later: docker compose -f \"$COMPOSE_FILE\" down"

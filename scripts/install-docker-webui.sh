#!/usr/bin/env bash
set -euo pipefail

DEFAULT_IMAGE='ghcr.io/gaofeng21cn/one-person-lab-webui:latest'
OPL_WEBUI_HOME=${OPL_WEBUI_HOME:-"$HOME/OnePersonLab"}
DATA_DIR=${OPL_WEBUI_DATA_DIR:-"$OPL_WEBUI_HOME/data"}
PROJECTS_DIR=${OPL_WEBUI_PROJECTS_DIR:-"$OPL_WEBUI_HOME/projects"}
COMPOSE_FILE=${OPL_WEBUI_COMPOSE_FILE:-"$OPL_WEBUI_HOME/compose.yaml"}
IMAGE=${OPL_WEBUI_IMAGE:-"$DEFAULT_IMAGE"}
PORT=${OPL_WEBUI_PORT:-3000}
DRY_RUN=0
YES=0
OPEN_BROWSER=1
DETACH=1

usage() {
  cat <<'USAGE'
Usage:
  scripts/install-docker-webui.sh [options]

Options:
  --dry-run                 Print the actions without installing Docker or starting the container.
  --yes                     Allow Ubuntu Docker Engine installation without an interactive prompt.
  --port <port>             Host port for http://localhost:<port>/ (default: 3000).
  --tag <tag>               Use ghcr.io/gaofeng21cn/one-person-lab-webui:<tag>.
  --image <image>           Use a full image reference instead of the default GHCR image.
  --data-dir <path>         Host directory mounted as /data.
  --projects-dir <path>     Host directory mounted as /projects.
  --no-open                 Do not open the browser after startup.
  --detach                  Start with docker compose up -d. This is the default.
  --help                    Show this help.

The installer never accepts API keys. Add model/provider keys inside the WebUI.
USAGE
}

log() {
  printf '[opl-webui] %s\n' "$*"
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
    --port)
      shift
      need_value --port "${1:-}"
      PORT="$1"
      ;;
    --port=*)
      PORT="${1#--port=}"
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
      die "Do not pass API keys to this installer. Enter provider keys inside the WebUI after it opens."
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

if [ -z "$IMAGE" ]; then
  die "Image reference must not be empty"
fi
reject_compose_unsafe_value "Image reference" "$IMAGE"
reject_compose_unsafe_value "Data directory" "$DATA_DIR"
reject_compose_unsafe_value "Projects directory" "$PROJECTS_DIR"
reject_compose_unsafe_value "Compose file path" "$COMPOSE_FILE"

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
  local up_args=(compose -f "$COMPOSE_FILE" up)
  if [ "$DETACH" = "1" ]; then
    up_args+=(-d)
  fi
  run docker "${up_args[@]}"
}

log "One Person Lab Docker/WebUI installer"
log "Image: $IMAGE"
log "Data directory: $DATA_DIR -> /data"
log "Projects directory: $PROJECTS_DIR -> /projects"
log "Compose file: $COMPOSE_FILE"
log "URL: http://localhost:${PORT}/"
log "API keys are not accepted by this installer; enter provider keys inside the WebUI."

ensure_docker
ensure_compose
write_compose_file
start_webui
open_browser

log "Docker/WebUI startup command completed."
log "To stop it later: docker compose -f \"$COMPOSE_FILE\" down"

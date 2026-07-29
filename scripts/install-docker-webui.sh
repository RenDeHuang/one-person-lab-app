#!/usr/bin/env bash
set -euo pipefail

DEFAULT_IMAGE='ghcr.io/gaofeng21cn/one-person-lab-webui:stable'
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OPL_WEBUI_HOME=${OPL_WEBUI_HOME:-"$HOME/OnePersonLab"}
DATA_DIR=${OPL_WEBUI_DATA_DIR:-"$OPL_WEBUI_HOME/data"}
PROJECTS_DIR=${OPL_WEBUI_PROJECTS_DIR:-"$OPL_WEBUI_HOME/projects"}
COMPOSE_FILE=${OPL_WEBUI_COMPOSE_FILE:-"$OPL_WEBUI_HOME/compose.yaml"}
CLOUD_TEMPLATE_DIR=${OPL_WEBUI_CLOUD_TEMPLATE_DIR:-"$OPL_WEBUI_HOME/cloud"}
IMAGE=${OPL_WEBUI_IMAGE:-"$DEFAULT_IMAGE"}
PORT=${OPL_WEBUI_PORT:-3000}
HEALTH_TIMEOUT=${OPL_WEBUI_HEALTH_TIMEOUT:-120}
HEALTH_URL=${OPL_WEBUI_HEALTH_URL:-}
DIAGNOSTICS_DIR=${OPL_WEBUI_DIAGNOSTICS_DIR:-}
DIAGNOSTICS_ARCHIVE=${OPL_WEBUI_DIAGNOSTICS_ARCHIVE:-}
DRY_RUN=0
YES=0
UPDATE=0
ENABLE_AUTO_UPDATE=0
DISABLE_AUTO_UPDATE=0
AUTO_UPDATE_STATUS=0
AUTO_UPDATE_TIME=${OPL_WEBUI_AUTO_UPDATE_TIME:-03:00}
OPEN_BROWSER=1
DETACH=1
CLOUD_TEMPLATE=0
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
  --enable-auto-update      Enable a current-user host scheduler for the default :stable channel.
  --disable-auto-update     Disable the current-user host scheduler. Manual --update remains available.
  --auto-update-status      Show the current-user host scheduler and last update result.
  --auto-update-time <HH:MM>
                            Daily local time for automatic updates (default: 03:00).
  --port <port>             Host port for http://localhost:<port>/ (default: 3000).
  --health-timeout <sec>    Seconds to wait for the WebUI HTTP endpoint (default: 120).
  --health-url <url>        HTTP endpoint to probe (default: http://localhost:<port>/).
  --diagnostics-dir <path>  Write a diagnostic directory after startup.
  --diagnostics-archive <path>
                            Write a .tar.gz diagnostic package after startup.
  --cloud-template          Copy the cloud deployment compose/Caddy/secrets template and exit.
  --cloud-template-dir <path>
                            Target directory for --cloud-template (default: $OPL_WEBUI_HOME/cloud).
  --tag <tag>               Use ghcr.io/gaofeng21cn/one-person-lab-webui:<tag>.
  --image <image>           Use a full image reference instead of the default GHCR image.
  --data-dir <path>         Host directory mounted as /data.
  --projects-dir <path>     Host directory mounted as /projects.
  --no-open                 Do not open the browser after startup.
  --detach                  Start with docker compose up -d. This is the default.
  --help                    Show this help.

The installer never accepts Gateway account credentials or API keys. Enter them inside the WebUI.
USAGE
}

log() {
  printf '[opl-webui] %s\n' "$*"
}

log_user_path_status() {
  log "User path status:"
  log "  one_click_install: create compose.yaml, data/projects directories, and start the WebUI image."
  log "  browser_webui: open ${HEALTH_URL} after the health check passes."
  log "  access_key_settings: sign in to Gateway or enter an API key in WebUI first-run or Settings -> Account & Access."
  log "  runtime_proxy: WebUI sends Gateway sign-in and API-key configuration through the existing OPL runtime provider."
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
    --enable-auto-update)
      ENABLE_AUTO_UPDATE=1
      ;;
    --disable-auto-update)
      DISABLE_AUTO_UPDATE=1
      ;;
    --auto-update-status)
      AUTO_UPDATE_STATUS=1
      ;;
    --auto-update-time)
      shift
      need_value --auto-update-time "${1:-}"
      AUTO_UPDATE_TIME="$1"
      ;;
    --auto-update-time=*)
      AUTO_UPDATE_TIME="${1#--auto-update-time=}"
      need_value --auto-update-time "$AUTO_UPDATE_TIME"
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
    --cloud-template)
      CLOUD_TEMPLATE=1
      ;;
    --cloud-template-dir)
      shift
      need_value --cloud-template-dir "${1:-}"
      CLOUD_TEMPLATE_DIR="$1"
      ;;
    --cloud-template-dir=*)
      CLOUD_TEMPLATE_DIR="${1#--cloud-template-dir=}"
      need_value --cloud-template-dir "$CLOUD_TEMPLATE_DIR"
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
case "$AUTO_UPDATE_TIME" in
  [01][0-9]:[0-5][0-9]|2[0-3]:[0-5][0-9])
    ;;
  *)
    die "Auto-update time must use 24-hour HH:MM format: $AUTO_UPDATE_TIME"
    ;;
esac
auto_update_action_count=$((ENABLE_AUTO_UPDATE + DISABLE_AUTO_UPDATE + AUTO_UPDATE_STATUS))
if [ "$auto_update_action_count" -gt 1 ]; then
  die "Choose only one of --enable-auto-update, --disable-auto-update, or --auto-update-status."
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
reject_compose_unsafe_value "Cloud template directory" "$CLOUD_TEMPLATE_DIR"
if [ "$ENABLE_AUTO_UPDATE" = "1" ] && [ "$IMAGE" != "$DEFAULT_IMAGE" ]; then
  die "Automatic updates support only $DEFAULT_IMAGE. Use manual --update for custom images, tags, or digests."
fi

OS_NAME="$(uname -s)"
AUTO_UPDATE_HOME="$OPL_WEBUI_HOME/updater"
AUTO_UPDATE_RUNNER="$AUTO_UPDATE_HOME/update-webui.sh"
AUTO_UPDATE_LOG_DIR="$AUTO_UPDATE_HOME/logs"
AUTO_UPDATE_CURRENT_LOG="$AUTO_UPDATE_LOG_DIR/current.log"
AUTO_UPDATE_PREVIOUS_LOG="$AUTO_UPDATE_LOG_DIR/previous.log"
AUTO_UPDATE_RESULT="$AUTO_UPDATE_HOME/last-result.env"
AUTO_UPDATE_CONFIG="$AUTO_UPDATE_HOME/config.env"
AUTO_UPDATE_SYSTEMD_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/systemd/user"
AUTO_UPDATE_SYSTEMD_SERVICE="$AUTO_UPDATE_SYSTEMD_DIR/one-person-lab-webui-update.service"
AUTO_UPDATE_SYSTEMD_TIMER="$AUTO_UPDATE_SYSTEMD_DIR/one-person-lab-webui-update.timer"
AUTO_UPDATE_LAUNCHD_DIR="$HOME/Library/LaunchAgents"
AUTO_UPDATE_LAUNCHD_PLIST="$AUTO_UPDATE_LAUNCHD_DIR/cn.onepersonlab.webui-update.plist"
AUTO_UPDATE_LAUNCHD_LABEL="cn.onepersonlab.webui-update"

if [ "$DISABLE_AUTO_UPDATE" = "1" ]; then
  disable_auto_update_after_definitions=1
else
  disable_auto_update_after_definitions=0
fi
if [ "$AUTO_UPDATE_STATUS" = "1" ]; then
  show_auto_update_status_after_definitions=1
else
  show_auto_update_status_after_definitions=0
fi

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

write_auto_update_runner() {
  local temporary_path="${AUTO_UPDATE_RUNNER}.new"
  local docker_bin curl_bin
  if [ "$DRY_RUN" = "1" ]; then
    docker_bin=docker
    curl_bin=curl
  else
    docker_bin="$(command -v docker)" || die "Docker CLI is required before enabling automatic updates."
    curl_bin="$(command -v curl)" || die "curl is required before enabling automatic updates."
  fi
  local compose_file_quoted health_url_quoted image_quoted log_dir_quoted result_quoted health_timeout_quoted
  local docker_bin_quoted curl_bin_quoted
  printf -v compose_file_quoted '%q' "$COMPOSE_FILE"
  printf -v health_url_quoted '%q' "$HEALTH_URL"
  printf -v image_quoted '%q' "$DEFAULT_IMAGE"
  printf -v log_dir_quoted '%q' "$AUTO_UPDATE_LOG_DIR"
  printf -v result_quoted '%q' "$AUTO_UPDATE_RESULT"
  printf -v health_timeout_quoted '%q' "$HEALTH_TIMEOUT"
  printf -v docker_bin_quoted '%q' "$docker_bin"
  printf -v curl_bin_quoted '%q' "$curl_bin"
  if [ "$DRY_RUN" = "1" ]; then
    log "Dry run: would write local automatic updater: $AUTO_UPDATE_RUNNER"
    return 0
  fi
  mkdir -p "$AUTO_UPDATE_HOME" "$AUTO_UPDATE_LOG_DIR"
  {
    printf '%s\n' '#!/usr/bin/env bash' 'set -uo pipefail'
    printf 'COMPOSE_FILE=%s\n' "$compose_file_quoted"
    printf 'HEALTH_URL=%s\n' "$health_url_quoted"
    printf 'IMAGE=%s\n' "$image_quoted"
    printf 'LOG_DIR=%s\n' "$log_dir_quoted"
    printf 'RESULT_FILE=%s\n' "$result_quoted"
    printf 'HEALTH_TIMEOUT=%s\n' "$health_timeout_quoted"
    printf 'DOCKER_BIN=%s\n' "$docker_bin_quoted"
    printf 'CURL_BIN=%s\n' "$curl_bin_quoted"
    cat <<'RUNNER'
CURRENT_LOG="$LOG_DIR/current.log"
PREVIOUS_LOG="$LOG_DIR/previous.log"
LOCK_DIR="$LOG_DIR/update.lock"
LOCK_OWNER="$LOCK_DIR/owner.pid"
mkdir -p "$LOG_DIR"

acquire_lock() {
  if mkdir "$LOCK_DIR" 2>/dev/null; then
    printf '%s\n' "$$" > "$LOCK_OWNER"
    return 0
  fi
  local lock_pid='' lock_command=''
  if [ -f "$LOCK_OWNER" ]; then
    IFS= read -r lock_pid < "$LOCK_OWNER" || true
  fi
  case "$lock_pid" in
    ''|*[!0-9]*)
      ;;
    *)
      if kill -0 "$lock_pid" 2>/dev/null; then
        lock_command="$(ps -p "$lock_pid" -o command= 2>/dev/null || true)"
        case "$lock_command" in
          *"$0"*)
            return 1
            ;;
        esac
      fi
      ;;
  esac
  rm -f "$LOCK_OWNER"
  rmdir "$LOCK_DIR" 2>/dev/null || return 1
  mkdir "$LOCK_DIR" 2>/dev/null || return 1
  printf '%s\n' "$$" > "$LOCK_OWNER"
}

if ! acquire_lock; then
  exit 0
fi
cleanup() {
  rm -f "$LOCK_OWNER"
  rmdir "$LOCK_DIR" 2>/dev/null || true
}
trap cleanup EXIT
if [ -f "$CURRENT_LOG" ]; then
  mv -f "$CURRENT_LOG" "$PREVIOUS_LOG"
fi
exec >"$CURRENT_LOG" 2>&1

write_result() {
  local status="$1"
  local phase="$2"
  local rollback_status="$3"
  local temporary="${RESULT_FILE}.new"
  {
    printf 'schema=opl_webui_host_auto_update_result.v1\n'
    printf 'status=%s\n' "$status"
    printf 'phase=%s\n' "$phase"
    printf 'rollback=%s\n' "$rollback_status"
    printf 'completed_at=%s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
    printf 'image=%s\n' "$IMAGE"
    printf 'previous_image_id=%s\n' "${PREVIOUS_IMAGE_ID:-unknown}"
    printf 'resolved_image_id=%s\n' "${RESOLVED_IMAGE_ID:-unknown}"
  } > "$temporary"
  mv -f "$temporary" "$RESULT_FILE"
}

wait_until_healthy() {
  local deadline
  deadline=$(( $(date +%s) + HEALTH_TIMEOUT ))
  while [ "$(date +%s)" -lt "$deadline" ]; do
    if "$CURL_BIN" -fsS --max-time 5 "$HEALTH_URL" >/dev/null 2>&1; then
      return 0
    fi
    sleep 2
  done
  return 1
}

restore_previous() {
  if [ -z "${PREVIOUS_IMAGE_ID:-}" ]; then
    printf 'No previous image ID was available for rollback.\n' >&2
    return 1
  fi
  "$DOCKER_BIN" image tag "$PREVIOUS_IMAGE_ID" "$IMAGE" &&
    "$DOCKER_BIN" compose -f "$COMPOSE_FILE" up -d --pull never --force-recreate &&
    wait_until_healthy
}

PREVIOUS_CONTAINER_ID="$("$DOCKER_BIN" compose -f "$COMPOSE_FILE" ps -q one-person-lab-webui 2>/dev/null | sed -n '1p' || true)"
if [ -n "$PREVIOUS_CONTAINER_ID" ]; then
  PREVIOUS_IMAGE_ID="$("$DOCKER_BIN" inspect "$PREVIOUS_CONTAINER_ID" --format '{{.Image}}' 2>/dev/null || true)"
else
  PREVIOUS_IMAGE_ID="$("$DOCKER_BIN" image inspect "$IMAGE" --format '{{.Id}}' 2>/dev/null || true)"
fi
if ! "$DOCKER_BIN" compose -f "$COMPOSE_FILE" pull; then
  write_result failed pull not_required
  exit 1
fi
RESOLVED_IMAGE_ID="$("$DOCKER_BIN" image inspect "$IMAGE" --format '{{.Id}}' 2>/dev/null || true)"
if ! "$DOCKER_BIN" compose -f "$COMPOSE_FILE" up -d --pull never --force-recreate; then
  if restore_previous; then
    write_result failed compose_up passed
  else
    write_result failed compose_up failed
  fi
  exit 1
fi

if wait_until_healthy; then
  write_result passed health not_required
  exit 0
fi
if restore_previous; then
  write_result failed health passed
else
  write_result failed health failed
fi
exit 1
RUNNER
  } > "$temporary_path"
  chmod 0755 "$temporary_path"
  mv -f "$temporary_path" "$AUTO_UPDATE_RUNNER"
}

write_systemd_auto_update_units() {
  local hour="${AUTO_UPDATE_TIME%:*}"
  local minute="${AUTO_UPDATE_TIME#*:}"
  local runner_path="$AUTO_UPDATE_RUNNER"
  runner_path="${runner_path//\\/\\\\}"
  runner_path="${runner_path//\"/\\\"}"
  runner_path="${runner_path//%/%%}"
  local service_temporary="${AUTO_UPDATE_SYSTEMD_SERVICE}.new"
  local timer_temporary="${AUTO_UPDATE_SYSTEMD_TIMER}.new"
  if [ "$DRY_RUN" = "1" ]; then
    log "Dry run: would register systemd user timer one-person-lab-webui-update.timer at $AUTO_UPDATE_TIME and after user-manager startup."
    return 0
  fi
  command -v systemctl >/dev/null 2>&1 ||
    die "systemd user services are unavailable. Keep manual --update or configure an administrator-owned server scheduler."
  mkdir -p "$AUTO_UPDATE_SYSTEMD_DIR"
  {
    printf '%s\n' \
      '[Unit]' \
      'Description=Update One Person Lab WebUI from the host' \
      '' \
      '[Service]' \
      'Type=oneshot' \
      "ExecStart=\"$runner_path\""
  } > "$service_temporary"
  {
    printf '%s\n' \
      '[Unit]' \
      'Description=Daily One Person Lab WebUI update' \
      '' \
      '[Timer]' \
      "OnCalendar=*-*-* ${hour}:${minute}:00" \
      'OnStartupSec=5m' \
      'Persistent=true' \
      'Unit=one-person-lab-webui-update.service' \
      '' \
      '[Install]' \
      'WantedBy=timers.target'
  } > "$timer_temporary"
  mv -f "$service_temporary" "$AUTO_UPDATE_SYSTEMD_SERVICE"
  mv -f "$timer_temporary" "$AUTO_UPDATE_SYSTEMD_TIMER"
  systemctl --user daemon-reload
  systemctl --user enable --now one-person-lab-webui-update.timer
}

write_launchd_auto_update_agent() {
  local hour="${AUTO_UPDATE_TIME%:*}"
  local minute="${AUTO_UPDATE_TIME#*:}"
  local runner_xml
  runner_xml="$(printf '%s' "$AUTO_UPDATE_RUNNER" | sed \
    -e 's/&/\&amp;/g' \
    -e 's/</\&lt;/g' \
    -e 's/>/\&gt;/g')"
  local temporary_path="${AUTO_UPDATE_LAUNCHD_PLIST}.new"
  if [ "$DRY_RUN" = "1" ]; then
    log "Dry run: would register LaunchAgent $AUTO_UPDATE_LAUNCHD_LABEL at $AUTO_UPDATE_TIME and current-user login."
    return 0
  fi
  command -v launchctl >/dev/null 2>&1 || die "launchctl is required for macOS automatic updates."
  mkdir -p "$AUTO_UPDATE_LAUNCHD_DIR"
  cat > "$temporary_path" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>$AUTO_UPDATE_LAUNCHD_LABEL</string>
  <key>ProgramArguments</key>
  <array>
    <string>$runner_xml</string>
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>StartCalendarInterval</key>
  <dict>
    <key>Hour</key>
    <integer>$hour</integer>
    <key>Minute</key>
    <integer>$minute</integer>
  </dict>
  <key>ProcessType</key>
  <string>Background</string>
</dict>
</plist>
PLIST
  plutil -lint "$temporary_path" >/dev/null
  mv -f "$temporary_path" "$AUTO_UPDATE_LAUNCHD_PLIST"
  launchctl bootout "gui/$(id -u)/$AUTO_UPDATE_LAUNCHD_LABEL" >/dev/null 2>&1 || true
  launchctl bootstrap "gui/$(id -u)" "$AUTO_UPDATE_LAUNCHD_PLIST"
}

write_auto_update_config() {
  local scheduler="$1"
  local temporary_path="${AUTO_UPDATE_CONFIG}.new"
  if [ "$DRY_RUN" = "1" ]; then
    log "Dry run: would record automatic update time $AUTO_UPDATE_TIME for $scheduler."
    return 0
  fi
  {
    printf 'schema=opl_webui_host_auto_update_config.v1\n'
    printf 'scheduler=%s\n' "$scheduler"
    printf 'channel=%s\n' "$DEFAULT_IMAGE"
    printf 'daily_time=%s\n' "$AUTO_UPDATE_TIME"
  } > "$temporary_path"
  mv -f "$temporary_path" "$AUTO_UPDATE_CONFIG"
}

enable_auto_update() {
  [ "$IMAGE" = "$DEFAULT_IMAGE" ] ||
    die "Automatic updates support only $DEFAULT_IMAGE. Use manual --update for custom images, tags, or digests."
  write_auto_update_runner
  case "$OS_NAME" in
    Linux)
      write_systemd_auto_update_units
      write_auto_update_config systemd_user
      ;;
    Darwin)
      write_launchd_auto_update_agent
      write_auto_update_config launchd_user
      ;;
    *)
      die "Automatic updates are supported only on Linux and macOS by this installer."
      ;;
  esac
  log "Automatic WebUI updates enabled for $DEFAULT_IMAGE at $AUTO_UPDATE_TIME."
}

disable_auto_update() {
  case "$OS_NAME" in
    Linux)
      if [ "$DRY_RUN" = "1" ]; then
        log "Dry run: would disable systemd user timer one-person-lab-webui-update.timer."
      else
        if command -v systemctl >/dev/null 2>&1; then
          systemctl --user disable --now one-person-lab-webui-update.timer >/dev/null 2>&1 || true
        fi
        rm -f "$AUTO_UPDATE_SYSTEMD_SERVICE" "$AUTO_UPDATE_SYSTEMD_TIMER"
        if command -v systemctl >/dev/null 2>&1; then
          systemctl --user daemon-reload >/dev/null 2>&1 || true
        fi
      fi
      ;;
    Darwin)
      if [ "$DRY_RUN" = "1" ]; then
        log "Dry run: would unload LaunchAgent $AUTO_UPDATE_LAUNCHD_LABEL."
      else
        launchctl bootout "gui/$(id -u)/$AUTO_UPDATE_LAUNCHD_LABEL" >/dev/null 2>&1 || true
        rm -f "$AUTO_UPDATE_LAUNCHD_PLIST"
      fi
      ;;
    *)
      die "Automatic updates are supported only on Linux and macOS by this installer."
      ;;
  esac
  if [ "$DRY_RUN" = "0" ]; then
    rm -f "$AUTO_UPDATE_RUNNER" "$AUTO_UPDATE_CONFIG"
  fi
  log "Automatic WebUI updates are disabled. Manual --update remains available."
}

show_auto_update_status() {
  local enabled=false scheduler=unknown
  case "$OS_NAME" in
    Linux)
      scheduler=systemd_user
      if command -v systemctl >/dev/null 2>&1 &&
        systemctl --user is-enabled --quiet one-person-lab-webui-update.timer 2>/dev/null; then
        enabled=true
      fi
      ;;
    Darwin)
      scheduler=launchd_user
      if launchctl print "gui/$(id -u)/$AUTO_UPDATE_LAUNCHD_LABEL" >/dev/null 2>&1; then
        enabled=true
      fi
      ;;
    *)
      die "Automatic updates are supported only on Linux and macOS by this installer."
      ;;
  esac
  printf 'scheduler=%s\n' "$scheduler"
  printf 'enabled=%s\n' "$enabled"
  printf 'runner=%s\n' "$AUTO_UPDATE_RUNNER"
  printf 'result=%s\n' "$AUTO_UPDATE_RESULT"
  if [ -f "$AUTO_UPDATE_CONFIG" ]; then
    cat "$AUTO_UPDATE_CONFIG"
  else
    printf 'channel=%s\n' "$DEFAULT_IMAGE"
    printf 'daily_time=not_configured\n'
  fi
  if [ -f "$AUTO_UPDATE_RESULT" ]; then
    cat "$AUTO_UPDATE_RESULT"
  else
    printf 'status=not_run\n'
  fi
}

auto_update_is_configured() {
  if [ -f "$AUTO_UPDATE_CONFIG" ] || [ -f "$AUTO_UPDATE_RUNNER" ] ||
    [ -f "$AUTO_UPDATE_SYSTEMD_SERVICE" ] || [ -f "$AUTO_UPDATE_SYSTEMD_TIMER" ] ||
    [ -f "$AUTO_UPDATE_LAUNCHD_PLIST" ]; then
    return 0
  fi
  case "$OS_NAME" in
    Linux)
      command -v systemctl >/dev/null 2>&1 &&
        systemctl --user is-enabled --quiet one-person-lab-webui-update.timer 2>/dev/null
      ;;
    Darwin)
      command -v launchctl >/dev/null 2>&1 &&
        launchctl print "gui/$(id -u)/$AUTO_UPDATE_LAUNCHD_LABEL" >/dev/null 2>&1
      ;;
    *)
      return 1
      ;;
  esac
}

if [ "$disable_auto_update_after_definitions" = "1" ]; then
  disable_auto_update
  exit 0
fi
if [ "$show_auto_update_status_after_definitions" = "1" ]; then
  show_auto_update_status
  exit 0
fi
if [ "$IMAGE" != "$DEFAULT_IMAGE" ] && auto_update_is_configured; then
  die "Automatic updates are already enabled for $DEFAULT_IMAGE. Run --disable-auto-update before switching to a custom image, tag, or digest."
fi

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
  # Keep dry-run output in-process. On resource-saturated hosts Bash can block
  # while feeding a heredoc pipe before the reader process has started.
  printf '%s\n' \
    '# Generated by One Person Lab Docker/WebUI installer.' \
    'services:' \
    '  one-person-lab-webui:' \
    "    image: ${IMAGE}" \
    '    pull_policy: always' \
    '    ports:' \
    "      - \"127.0.0.1:${PORT}:3000\"" \
    '    environment:' \
    '      AIONUI_ALLOW_REMOTE: "true"' \
    '      AIONUI_DATA_DIR: /data' \
    '      OPL_PROJECTS_DIR: /projects' \
    '    volumes:' \
    "      - \"${DATA_DIR}:/data\"" \
    "      - \"${PROJECTS_DIR}:/projects\"" \
    '    restart: unless-stopped'
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

write_cloud_template() {
  local source_dir="$SCRIPT_DIR/../deploy/docker-webui/cloud"
  if [ ! -d "$source_dir" ]; then
    die "Cloud template source not found: $source_dir. Run this option from a checkout that includes deploy/docker-webui/cloud."
  fi
  if [ "$DRY_RUN" = "1" ]; then
    log "Would copy cloud deployment template:"
    log "  from: $source_dir"
    log "  to:   $CLOUD_TEMPLATE_DIR"
    log "Would then require: copy .env.example to .env, create secrets/webui_password, set domain/email, and run docker compose -f compose.yaml up -d."
    return 0
  fi
  mkdir -p "$CLOUD_TEMPLATE_DIR"
  cp -R "$source_dir"/. "$CLOUD_TEMPLATE_DIR"/
  log "Cloud deployment template written: $CLOUD_TEMPLATE_DIR"
  log "Next steps:"
  log "  1. cd \"$CLOUD_TEMPLATE_DIR\""
  log "  2. cp .env.example .env and set OPL_WEBUI_DOMAIN / OPL_CADDY_EMAIL"
  log "  3. create secrets/webui_password"
  log "  4. docker compose -f compose.yaml up -d"
  log "Optional Gateway key overlay: docker compose -f compose.yaml -f compose.gateway-key.yaml up -d"
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
    -e 's/([A-Za-z0-9_.-]*(api[_-]?key|token|credential|password)[A-Za-z0-9_.-]*[[:space:]]*[:=][[:space:]]*)[^[:space:]"'\'']+/\1[redacted]/Ig' \
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
log "Image/seed: default stable WebUI image uses the full seed; use --tag latest only to opt in to Preview, or --image for an advanced override."
log "Gateway account credentials and API keys are not accepted by this installer; enter them inside WebUI first-run or Settings -> Account & Access."
log_user_path_status

if [ "$CLOUD_TEMPLATE" = "1" ]; then
  write_cloud_template
  exit 0
fi

ensure_docker
ensure_compose
write_compose_file
start_webui
wait_for_health
if [ "$ENABLE_AUTO_UPDATE" = "1" ]; then
  enable_auto_update
elif [ "$UPDATE" = "0" ]; then
  log "Automatic WebUI updates are not enabled. Rerun with --enable-auto-update or run --update regularly."
fi
if [ -n "$DIAGNOSTICS_DIR" ] || [ -n "$DIAGNOSTICS_ARCHIVE" ]; then
  collect_diagnostics "requested" "$DIAGNOSTICS_DIR"
fi
open_browser

log "Docker/WebUI startup command completed."
log "To stop it later: docker compose -f \"$COMPOSE_FILE\" down"

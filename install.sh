#!/usr/bin/env bash
set -euo pipefail

OPL_INSTALL_SCRIPT_URL=${OPL_INSTALL_SCRIPT_URL:-https://raw.githubusercontent.com/gaofeng21cn/one-person-lab/main/install.sh}
OPL_APP_INSTALL_MODE=${OPL_APP_INSTALL_MODE:-app-first}
OPL_LOCAL_APP_PATH=${OPL_LOCAL_APP_PATH:-/Applications/One Person Lab.app}

INSTALL_ARGS=()
COMPLETE_INSTALL=0
AUTHORIZE_LOCAL_APP=0
AUTHORIZE_LOCAL_APP_ONLY=0
AUTHORIZE_LOCAL_APP_YES=${OPL_AUTHORIZE_LOCAL_APP_YES:-0}

usage() {
  cat <<'USAGE'
Usage:
  install.sh [--complete|--app-first] [OPL install args...]
  install.sh --authorize-local-app-only [--app-path "/Applications/One Person Lab.app"] [--yes]

Options:
  --complete                 Run complete framework/module setup from the terminal.
  --app-first                Keep the default App-first setup and defer modules.
  --authorize-local-app      After setup, remove macOS quarantine from a local App bundle.
  --authorize-local-app-only Only run the local App authorization helper.
  --app-path <path>          App bundle path for the local authorization helper.
  --yes                     Confirm local App authorization non-interactively.

The local App authorization helper is for unsigned developer/local builds only.
Stable releases still require Developer ID signing and notarization.
USAGE
}

while [ "$#" -gt 0 ]; do
  arg="$1"
  case "$arg" in
    --complete)
      COMPLETE_INSTALL=1
      ;;
    --app-first)
      COMPLETE_INSTALL=0
      ;;
    --authorize-local-app)
      AUTHORIZE_LOCAL_APP=1
      ;;
    --authorize-local-app-only)
      AUTHORIZE_LOCAL_APP=1
      AUTHORIZE_LOCAL_APP_ONLY=1
      ;;
    --app-path)
      shift
      if [ "$#" -eq 0 ]; then
        printf 'Missing value for --app-path\n' >&2
        exit 1
      fi
      OPL_LOCAL_APP_PATH="$1"
      ;;
    --app-path=*)
      OPL_LOCAL_APP_PATH="${arg#--app-path=}"
      ;;
    --yes)
      AUTHORIZE_LOCAL_APP_YES=1
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      INSTALL_ARGS+=("$arg")
      ;;
  esac
  shift
done

arg_present() {
  local expected="$1"
  for arg in "${INSTALL_ARGS[@]}"; do
    if [ "$arg" = "$expected" ]; then
      return 0
    fi
  done
  return 1
}

is_macos() {
  [ "$(uname -s)" = "Darwin" ]
}

count_quarantine_attrs() {
  local target="$1"
  local count=0
  local item
  while IFS= read -r -d '' item; do
    if xattr -p com.apple.quarantine "$item" >/dev/null 2>&1; then
      count=$((count + 1))
    fi
  done < <(find "$target" -print0)
  printf '%s\n' "$count"
}

confirm_local_app_authorization() {
  if [ "$AUTHORIZE_LOCAL_APP_YES" = "1" ]; then
    return 0
  fi
  if [ ! -r /dev/tty ]; then
    printf 'Local App authorization needs confirmation. Re-run with --yes when using a non-interactive installer.\n' >&2
    exit 1
  fi
  {
    printf 'One Person Lab will remove macOS quarantine from this local App bundle:\n'
    printf '  %s\n' "$OPL_LOCAL_APP_PATH"
    printf 'This is only for unsigned developer/local builds and does not replace Developer ID signing or notarization.\n'
    printf 'Type "authorize" to continue: '
  } > /dev/tty
  local reply
  if ! IFS= read -r reply < /dev/tty; then
    printf 'Local App authorization needs a controlling terminal, or pass --yes for explicit non-interactive confirmation.\n' >&2
    exit 1
  fi
  if [ "$reply" != "authorize" ]; then
    printf 'Local App authorization cancelled.\n' >&2
    exit 1
  fi
}

diagnostic_status() {
  local label="$1"
  shift
  if "$@" >/tmp/opl-local-app-authorization."$label".log 2>&1; then
    printf 'passed\n'
  else
    printf 'failed\n'
  fi
}

authorize_local_app() {
  if ! is_macos; then
    printf 'Local App authorization is macOS-only.\n' >&2
    exit 1
  fi
  if [ ! -d "$OPL_LOCAL_APP_PATH" ]; then
    printf 'App bundle not found: %s\n' "$OPL_LOCAL_APP_PATH" >&2
    printf 'Copy One Person Lab.app into /Applications first, or pass --app-path <path>.\n' >&2
    exit 1
  fi
  if ! command -v xattr >/dev/null 2>&1; then
    printf 'Missing required command: xattr\n' >&2
    exit 1
  fi
  if ! command -v find >/dev/null 2>&1; then
    printf 'Missing required command: find\n' >&2
    exit 1
  fi

  confirm_local_app_authorization

  local before_quarantine
  local after_quarantine
  local codesign_status
  local spctl_status
  before_quarantine=$(count_quarantine_attrs "$OPL_LOCAL_APP_PATH")
  xattr -dr com.apple.quarantine "$OPL_LOCAL_APP_PATH" 2>/tmp/opl-local-app-authorization.xattr.log || {
    printf 'Failed to remove macOS quarantine from: %s\n' "$OPL_LOCAL_APP_PATH" >&2
    cat /tmp/opl-local-app-authorization.xattr.log >&2 || true
    exit 1
  }
  after_quarantine=$(count_quarantine_attrs "$OPL_LOCAL_APP_PATH")

  if command -v codesign >/dev/null 2>&1; then
    codesign_status=$(diagnostic_status codesign codesign --verify --deep --strict --verbose=2 "$OPL_LOCAL_APP_PATH")
  else
    codesign_status='skipped_missing_codesign'
  fi
  if command -v spctl >/dev/null 2>&1; then
    spctl_status=$(diagnostic_status spctl spctl --assess --type execute --verbose=4 "$OPL_LOCAL_APP_PATH")
  else
    spctl_status='skipped_missing_spctl'
  fi

  printf 'One Person Lab local App authorization finished.\n'
  printf '  app_path: %s\n' "$OPL_LOCAL_APP_PATH"
  printf '  quarantine_before: %s\n' "$before_quarantine"
  printf '  quarantine_after: %s\n' "$after_quarantine"
  printf '  codesign_status: %s\n' "$codesign_status"
  printf '  spctl_status: %s\n' "$spctl_status"
  if [ "$after_quarantine" != "0" ]; then
    printf 'Some quarantine attributes remain. Inspect /tmp/opl-local-app-authorization.xattr.log and retry from an administrator account.\n' >&2
    exit 1
  fi
  if [ "$spctl_status" != "passed" ]; then
    printf 'Gatekeeper assessment did not pass. This helper reduces repeated quarantine prompts for local builds; signed and notarized releases are still required for the smooth stable path.\n' >&2
  fi
}

if [ "$AUTHORIZE_LOCAL_APP_ONLY" = "1" ]; then
  authorize_local_app
  exit 0
fi

if ! command -v curl >/dev/null 2>&1; then
  printf 'Missing required command: curl\n' >&2
  exit 1
fi

if [ "$COMPLETE_INSTALL" != "1" ] && [ "$OPL_APP_INSTALL_MODE" = "app-first" ]; then
  if ! arg_present "--skip-modules"; then
    INSTALL_ARGS+=("--skip-modules")
  fi
fi

curl -fsSL "$OPL_INSTALL_SCRIPT_URL" | bash -s -- "${INSTALL_ARGS[@]}"

if [ "$AUTHORIZE_LOCAL_APP" = "1" ]; then
  authorize_local_app
fi

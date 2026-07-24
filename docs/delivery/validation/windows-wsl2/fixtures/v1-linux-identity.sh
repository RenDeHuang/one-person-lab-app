#!/usr/bin/env bash
set -euo pipefail

printf 'uname=%s\n' "$(uname -m)"
printf 'kernel=%s\n' "$(uname -r)"

# shellcheck disable=SC1091
. /etc/os-release
printf 'os=%s %s\n' "$ID" "$VERSION_ID"
printf 'uid=%s\n' "$(id -u)"

test -f /etc/wsl.conf
printf 'wsl_conf=present\n'
test -x /usr/lib/wsl/wsl-setup
printf 'wsl_setup=present\n'

df -B1 /

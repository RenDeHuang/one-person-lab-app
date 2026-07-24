#!/usr/bin/env bash
set -uo pipefail

name="${1:?fixture name is required}"
script="${2:?fixture script is required}"
staging=/mnt/c/Users/oplrunner/OnePersonLab/staging
stdout_log="$staging/$name.stdout.txt"
stderr_log="$staging/$name.stderr.txt"
status="$staging/$name.status.txt"

rm -f "$stdout_log" "$stderr_log" "$status"

bash "$script" >"$stdout_log" 2>"$stderr_log"
exit_code=$?

{
  printf 'observed_at=%s\n' "$(date --iso-8601=seconds)"
  printf 'name=%s\n' "$name"
  printf 'exit_code=%s\n' "$exit_code"
} >"$status"

exit "$exit_code"

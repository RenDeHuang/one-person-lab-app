#!/usr/bin/env bash
set -uo pipefail

run_id="${1:?run id is required}"
node_archive="${2:-}"
staging=/mnt/c/Users/oplrunner/OnePersonLab/staging
stdout_log="$staging/$run_id.stdout.txt"
stderr_log="$staging/$run_id.stderr.txt"
status="$staging/$run_id.status.txt"

rm -f "$stdout_log" "$stderr_log" "$status"

/mnt/c/Users/oplrunner/OnePersonLab/staging/v1-prepare-managed-resources.sh \
  "$run_id" \
  "$node_archive" \
  >"$stdout_log" \
  2>"$stderr_log"
exit_code=$?

{
  printf 'observed_at=%s\n' "$(date --iso-8601=seconds)"
  printf 'run_id=%s\n' "$run_id"
  printf 'exit_code=%s\n' "$exit_code"
} >"$status"

exit "$exit_code"

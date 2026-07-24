#!/usr/bin/env bash
set -euo pipefail

run_id="${1:?run id is required}"
script="${2:?fixture script is required}"
root="/opt/opl-validation/v2-v3/$run_id"
private_dir="$root/private"

umask 077
mkdir -p "$private_dir"
chmod 700 "$private_dir"

bash "$script" "$run_id" \
  >"$private_dir/runner.stdout.log" \
  2>"$private_dir/runner.stderr.log"

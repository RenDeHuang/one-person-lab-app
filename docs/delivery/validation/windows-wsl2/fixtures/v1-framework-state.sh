#!/usr/bin/env bash
set -euo pipefail

root=/opt/opl-validation/framework
managed_root=/opt/opl-validation/managed-resource-attempts/20260724-v1-managed-g0005/bundle
node_bin="$managed_root/node/node-v24.11.0-linux-x64/bin"
evidence=/opt/opl-validation/evidence/framework-state.txt
private_dir=/opt/opl-validation/private
state_json="$private_dir/framework-state.json"

umask 077
mkdir -p "$private_dir"
chmod 700 "$private_dir"
trap 'rm -f "$state_json"' EXIT
export PATH="$node_bin:$PATH"
cd "$root"

npm ci --ignore-scripts --no-audit --no-fund

node --experimental-strip-types \
  src/entrypoints/cli.ts \
  app state \
  --profile fast \
  --json >"$state_json"

jq -e 'type == "object"' "$state_json" >/dev/null

{
  printf 'observed_at=%s\n' "$(date --iso-8601=seconds)"
  printf 'framework_ref=%s\n' e260ad46e2cf73ea334d2453d901ee448248d9e0
  printf 'node_version=%s\n' "$(node --version)"
  printf 'npm_version=%s\n' "$(npm --version)"
  printf 'source_entrypoint=%s\n' "$root/src/entrypoints/cli.ts"
  printf 'state_json_sha256=%s\n' "$(sha256sum "$state_json" | awk '{print $1}')"
  printf 'state_top_level_type=%s\n' "$(jq -r 'type' "$state_json")"
  printf 'state_top_level_keys=%s\n' "$(jq -r 'keys | sort | join(",")' "$state_json")"
} >"$evidence"

cat "$evidence"

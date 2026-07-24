#!/usr/bin/env bash
set -euo pipefail

node_bin=/opt/opl-validation/managed-resource-attempts/20260724-v1-managed-g0005/bundle/node/node-v24.11.0-linux-x64/bin/node
script=/mnt/c/Users/oplrunner/OnePersonLab/staging/v1-codex-app-server.mjs
evidence=/opt/opl-validation/evidence/codex-app-server.json

mkdir -p /opt/opl-validation/codex-home /opt/opl-validation/work
"$node_bin" "$script" >"$evidence"
jq -e '.initialize_ok == true and .thread_list_ok == true' "$evidence" >/dev/null

if pgrep -x codex >/dev/null; then
  printf 'Codex survivor detected after app-server cleanup\n' >&2
  exit 1
fi

jq '. + {cleanup: "no_survivors"}' "$evidence" >"$evidence.tmp"
mv "$evidence.tmp" "$evidence"
jq -c . "$evidence"

#!/usr/bin/env bash
set -euo pipefail

root=/opt/opl-validation
bundle="$root/managed-resources"
prepare_data="$root/prepare-data"
evidence="$root/evidence/managed-resources.txt"
run_id="${1:-$(date --utc +%Y%m%dT%H%M%SZ)}"
node_archive="${2:-}"
attempt_root="$root/managed-resource-attempts/$run_id"
attempt_bundle="$attempt_root/bundle"
attempt_data="$attempt_root/data"
attempt_evidence="$attempt_root/evidence.txt"
node_version=v24.11.0
node_dir_name=node-v24.11.0-linux-x64
node_archive_sha256=b3c071cdf47aab867c3b2aa287257df12ec5d7c962bf922b32fd33226c4295fd
node_archive_size=58899117

if pgrep -af 'aioncore.*prepare-managed-resources' >/dev/null; then
  printf 'A managed-resource preparation process is already running\n' >&2
  exit 1
fi
if [[ -e "$attempt_root" ]]; then
  printf 'Run-specific attempt path already exists: %s\n' "$attempt_root" >&2
  exit 1
fi

mkdir -p "$attempt_bundle" "$attempt_data" "$(dirname "$evidence")"

if [[ -n "$node_archive" ]]; then
  actual_size="$(stat -c '%s' "$node_archive")"
  actual_sha256="$(sha256sum "$node_archive" | awk '{print $1}')"
  if [[ "$actual_size" != "$node_archive_size" ]] ||
    [[ "$actual_sha256" != "$node_archive_sha256" ]]; then
    printf 'Node bridge artifact identity mismatch\n' >&2
    exit 1
  fi

  node_parent="$attempt_data/runtime/node"
  node_temp="$node_parent/.${node_dir_name}.tmp"
  rm -rf "$node_temp"
  mkdir -p "$node_temp"
  tar -xzf "$node_archive" -C "$node_temp" --strip-components=1
  if [[ "$("$node_temp/bin/node" --version)" != "$node_version" ]]; then
    printf 'Unexpected bridged Node version\n' >&2
    exit 1
  fi
  mv "$node_temp" "$node_parent/$node_dir_name"
fi

"$root/bin/aioncore" \
  --data-dir "$attempt_data" \
  prepare-managed-resources \
  --bundle-out "$attempt_bundle"

codex_bin="$(
  find "$attempt_bundle" -type f -path '*/@openai/codex-linux-x64/vendor/*/bin/codex' \
    -print -quit
)"
if [[ -z "$codex_bin" ]]; then
  printf 'Linux x64 Codex binary was not materialized\n' >&2
  exit 1
fi

{
  printf 'observed_at=%s\n' "$(date --iso-8601=seconds)"
  printf 'run_id=%s\n' "$run_id"
  printf 'bundle=%s\n' "$attempt_bundle"
  printf 'bundle_files=%s\n' "$(find "$attempt_bundle" -type f | wc -l)"
  printf 'codex_bin=%s\n' "$codex_bin"
  printf 'codex_sha256=%s\n' "$(sha256sum "$codex_bin" | awk '{print $1}')"
  printf 'codex_file=%s\n' "$(file -b "$codex_bin")"
  printf 'codex_version=%s\n' "$("$codex_bin" --version)"
} >"$attempt_evidence"

rm -rf "$bundle" "$prepare_data"
ln -s "$attempt_bundle" "$bundle"
ln -s "$attempt_data" "$prepare_data"
ln -s "$attempt_evidence" "$evidence"
cat "$attempt_evidence"

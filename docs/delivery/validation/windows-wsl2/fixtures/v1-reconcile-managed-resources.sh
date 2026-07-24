#!/usr/bin/env bash
set -euo pipefail

root=/opt/opl-validation
bundle="$root/managed-resources"
evidence="$root/evidence/managed-resources.txt"

printf 'observed_at=%s\n' "$(date --iso-8601=seconds)"
printf 'linux_identity=%s\n' "$(uname -a)"
printf 'aioncore_path=%s\n' "$(readlink -f "$root/bin/aioncore")"
printf 'aioncore_sha256=%s\n' "$(sha256sum "$root/bin/aioncore" | awk '{print $1}')"
printf 'aioncore_survivors=%s\n' "$(pgrep -xc aioncore || true)"
printf 'prepare_processes=%s\n' "$(
  pgrep -af 'aioncore.*prepare-managed-resources' |
    wc -l
)"

if [[ -d "$bundle" ]]; then
  printf 'managed_resources=present\n'
  printf 'managed_resource_files=%s\n' "$(find "$bundle" -type f | wc -l)"
  printf 'managed_resource_bytes=%s\n' "$(du -sb "$bundle" | awk '{print $1}')"
  find "$bundle" -maxdepth 5 -type f -printf 'managed_resource_file=%s %s\n' |
    sort
else
  printf 'managed_resources=absent\n'
fi

if [[ -f "$evidence" ]]; then
  printf 'managed_resource_evidence=present\n'
else
  printf 'managed_resource_evidence=absent\n'
fi

if [[ -d "$root/managed-resource-attempts" ]]; then
  while IFS= read -r attempt; do
    printf 'managed_resource_attempt=%s files=%s bytes=%s\n' \
      "${attempt##*/}" \
      "$(find "$attempt" -type f | wc -l)" \
      "$(du -sb "$attempt" | awk '{print $1}')"
    find "$attempt" -type f -printf 'managed_resource_attempt_file=%p bytes=%s\n' |
      sort
  done < <(find "$root/managed-resource-attempts" -mindepth 1 -maxdepth 1 -type d | sort)
fi

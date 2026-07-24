#!/usr/bin/env bash
set -euo pipefail

root=/opt/opl-validation/framework
archive=/mnt/c/Users/oplrunner/OnePersonLab/staging/one-person-lab-fe1fafa26f2c59922596718b305761bbc7558c9c.tar.gz
expected_archive_sha256=dc941070a4173d403f5da056e16d365e2b1afd144ca62d26cc80364c6729ec00
expected_lock_sha256=de38ef719945e95fbf0802f741d4c9e73cd93be9285c667fb6b1bba8375016b3

actual_archive_sha256="$(sha256sum "$archive" | awk '{print $1}')"
if [[ "$actual_archive_sha256" != "$expected_archive_sha256" ]]; then
  printf 'Unexpected Framework archive SHA256: %s\n' "$actual_archive_sha256" >&2
  exit 1
fi

rm -rf "$root"
mkdir -p "$root"
tar -xzf "$archive" -C "$root"

actual_lock_sha256="$(sha256sum "$root/package-lock.json" | awk '{print $1}')"
if [[ "$actual_lock_sha256" != "$expected_lock_sha256" ]]; then
  printf 'Unexpected Framework package-lock SHA256: %s\n' "$actual_lock_sha256" >&2
  exit 1
fi

{
  printf 'observed_at=%s\n' "$(date --iso-8601=seconds)"
  printf 'framework_ref=%s\n' fe1fafa26f2c59922596718b305761bbc7558c9c
  printf 'archive_sha256=%s\n' "$actual_archive_sha256"
  printf 'package_lock_sha256=%s\n' "$actual_lock_sha256"
  printf 'package_version=%s\n' "$(jq -r '.version' "$root/package.json")"
  printf 'api_version=%s\n' "$(jq -r '.version' "$root/contracts/opl-framework/public-surface-index.json")"
} > /opt/opl-validation/evidence/framework-provision.txt

cat /opt/opl-validation/evidence/framework-provision.txt

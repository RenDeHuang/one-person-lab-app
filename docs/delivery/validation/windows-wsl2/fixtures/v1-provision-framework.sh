#!/usr/bin/env bash
set -euo pipefail

root=/opt/opl-validation/framework
archive=/mnt/c/Users/oplrunner/OnePersonLab/staging/one-person-lab-e260ad46e2cf73ea334d2453d901ee448248d9e0.tar.gz
expected_archive_sha256=054c66c8675fee976ad066095c92138ab2f50adb11780b2c262a23067b764d1a
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
  printf 'framework_ref=%s\n' e260ad46e2cf73ea334d2453d901ee448248d9e0
  printf 'archive_sha256=%s\n' "$actual_archive_sha256"
  printf 'package_lock_sha256=%s\n' "$actual_lock_sha256"
  printf 'package_version=%s\n' "$(jq -r '.version' "$root/package.json")"
  printf 'api_version=%s\n' "$(jq -r '.version' "$root/contracts/opl-framework/public-surface-index.json")"
} > /opt/opl-validation/evidence/framework-provision.txt

cat /opt/opl-validation/evidence/framework-provision.txt

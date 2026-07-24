#!/usr/bin/env bash
set -euo pipefail

export DEBIAN_FRONTEND=noninteractive

archive=/mnt/c/Users/oplrunner/OnePersonLab/staging/aioncore-v0.1.50-x86_64-unknown-linux-gnu.tar.gz
expected_archive_sha256=381a480b69e307f5f0bfafd4494b45b99341c046b425f0c1daa55a9cea3bf88c
expected_binary_sha256=6be976dc5edec98ef83342eb37d4673a02717a5314f2fe72fedd204d9b0f8632

apt-get update
apt-get install -y --no-install-recommends \
  ca-certificates \
  curl \
  file \
  jq \
  procps \
  xz-utils

install -d -m 0755 /opt/opl-validation/bin
install -d -m 0755 /opt/opl-validation/aioncore
install -d -m 0755 /opt/opl-validation/data
install -d -m 0755 /opt/opl-validation/logs
install -d -m 0755 /opt/opl-validation/work
install -d -m 0755 /opt/opl-validation/evidence

archive_sha256="$(sha256sum "$archive" | awk '{print $1}')"
if [[ "$archive_sha256" != "$expected_archive_sha256" ]]; then
  printf 'Unexpected AionCore archive SHA256: %s\n' "$archive_sha256" >&2
  exit 1
fi

rm -rf /opt/opl-validation/aioncore
install -d -m 0755 /opt/opl-validation/aioncore
tar -xzf \
  "$archive" \
  -C /opt/opl-validation/aioncore

binary_sha256="$(sha256sum /opt/opl-validation/aioncore/aioncore | awk '{print $1}')"
if [[ "$binary_sha256" != "$expected_binary_sha256" ]]; then
  printf 'Unexpected AionCore binary SHA256: %s\n' "$binary_sha256" >&2
  exit 1
fi

install -m 0755 \
  /opt/opl-validation/aioncore/aioncore \
  /opt/opl-validation/bin/aioncore

{
  printf 'observed_at=%s\n' "$(date --iso-8601=seconds)"
  printf 'aioncore_version='
  /opt/opl-validation/bin/aioncore --version
  printf 'aioncore_archive_sha256=%s\n' "$archive_sha256"
  printf 'aioncore_sha256='
  sha256sum /opt/opl-validation/bin/aioncore | awk '{print $1}'
  printf 'aioncore_file='
  file -b /opt/opl-validation/bin/aioncore
  printf 'curl_version='
  curl --version | head -n 1
} > /opt/opl-validation/evidence/provision.txt

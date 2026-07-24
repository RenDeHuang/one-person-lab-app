#!/usr/bin/env bash
set -euo pipefail

root=/opt/opl-validation/codex
archive=/mnt/c/Users/oplrunner/OnePersonLab/staging/openai-codex-0.144.6-linux-x64.tgz
expected_size=131212687
expected_sha256=b6752eb2e8c10e6fcc96ac5c1c8ad8342cdb9a74504fb84686addf081a7d2868
expected_sha512=4E7EnzCg0OnBxCyYnwJ+qnZwWHYe0YScr5ucKWbngE9u4+0XrpWELqq2Kn9jl5GZK8MDjU7PrJwFIwusHOHjuw==

actual_size="$(stat -c '%s' "$archive")"
actual_sha256="$(sha256sum "$archive" | awk '{print $1}')"
actual_sha512="$(openssl dgst -sha512 -binary "$archive" | base64 -w0)"
if [[ "$actual_size" != "$expected_size" ]] ||
  [[ "$actual_sha256" != "$expected_sha256" ]] ||
  [[ "$actual_sha512" != "$expected_sha512" ]]; then
  printf 'Codex platform bridge artifact identity mismatch\n' >&2
  exit 1
fi

rm -rf "$root"
mkdir -p "$root"
tar -xzf "$archive" -C "$root" --strip-components=1

codex_bin="$root/vendor/x86_64-unknown-linux-musl/bin/codex"
test -x "$codex_bin"
version="$("$codex_bin" --version)"
if [[ "$version" != "codex-cli 0.144.6" ]]; then
  printf 'Unexpected Codex version: %s\n' "$version" >&2
  exit 1
fi

{
  printf 'observed_at=%s\n' "$(date --iso-8601=seconds)"
  printf 'source_package=%s\n' '@openai/codex@0.144.6-linux-x64'
  printf 'archive_size=%s\n' "$actual_size"
  printf 'archive_sha256=%s\n' "$actual_sha256"
  printf 'archive_sha512_base64=%s\n' "$actual_sha512"
  printf 'codex_bin=%s\n' "$codex_bin"
  printf 'codex_sha256=%s\n' "$(sha256sum "$codex_bin" | awk '{print $1}')"
  printf 'codex_file=%s\n' "$(file -b "$codex_bin")"
  printf 'codex_version=%s\n' "$version"
} > /opt/opl-validation/evidence/codex-provision.txt

cat /opt/opl-validation/evidence/codex-provision.txt

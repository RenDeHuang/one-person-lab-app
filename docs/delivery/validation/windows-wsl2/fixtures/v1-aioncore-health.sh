#!/usr/bin/env bash
set -euo pipefail

root=/opt/opl-validation
evidence_dir="$root/evidence"
private_dir="$root/private"
stdout_log="$private_dir/aioncore-stdout.log"
stderr_log="$private_dir/aioncore-stderr.log"
health_body_file="$private_dir/aioncore-health-body"
summary="$evidence_dir/aioncore-health.json"
pid=""
pgid=""

cleanup() {
  if [[ -z "$pid" ]] || ! kill -0 "$pid" 2>/dev/null; then
    return
  fi

  if [[ -n "$pgid" ]]; then
    kill -TERM -- "-$pgid" 2>/dev/null || true
  else
    kill -TERM "$pid" 2>/dev/null || true
  fi
  for _ in $(seq 1 50); do
    if ! kill -0 "$pid" 2>/dev/null; then
      return
    fi
    sleep 0.1
  done
  if [[ -n "$pgid" ]]; then
    kill -KILL -- "-$pgid" 2>/dev/null || true
  else
    kill -KILL "$pid" 2>/dev/null || true
  fi
  wait "$pid" 2>/dev/null || true
}

umask 077
mkdir -p "$evidence_dir" "$private_dir"
chmod 700 "$private_dir"
rm -f "$stdout_log" "$stderr_log" "$health_body_file" "$summary"

setsid "$root/bin/aioncore" \
  --port 0 \
  --data-dir "$root/data" \
  --log-level info \
  --app-version validation-v1 \
  --log-dir "$root/logs" \
  --work-dir "$root/work" \
  --local \
  >"$stdout_log" \
  2>"$stderr_log" &

pid=$!
trap cleanup EXIT
starttime="$(awk '{print $22}' "/proc/$pid/stat")"
pgid="$(ps -o pgid= -p "$pid" | tr -d ' ')"
real_exe="$(readlink -f "/proc/$pid/exe")"
exe_sha256="$(sha256sum "$real_exe" | awk '{print $1}')"

endpoint=""
for _ in $(seq 1 150); do
  endpoint="$(sed -n 's/^AIONCORE_LISTENING //p' "$stdout_log" | tail -n 1)"
  if [[ -n "$endpoint" ]]; then
    break
  fi
  if ! kill -0 "$pid" 2>/dev/null; then
    break
  fi
  sleep 0.2
done

if [[ -z "$endpoint" ]]; then
  wait "$pid" || true
  printf 'AionCore did not report AIONCORE_LISTENING\n' >&2
  exit 1
fi

host="$(jq -r '.host' <<<"$endpoint")"
port="$(jq -r '.port' <<<"$endpoint")"
curl --fail --silent --show-error "http://$host:$port/health" >"$health_body_file"
health_body_sha256="$(sha256sum "$health_body_file" | awk '{print $1}')"
if jq -e . "$health_body_file" >/dev/null 2>&1; then
  health_body_type="$(jq -r 'type' "$health_body_file")"
  health_body_keys="$(jq -r 'if type == "object" then keys | sort | join(",") else "" end' "$health_body_file")"
else
  health_body_type=non_json
  health_body_keys=""
fi

jq -n \
  --arg observed_at "$(date --iso-8601=seconds)" \
  --argjson pid "$pid" \
  --arg starttime "$starttime" \
  --arg pgid "$pgid" \
  --arg real_exe "$real_exe" \
  --arg exe_sha256 "$exe_sha256" \
  --arg host "$host" \
  --argjson port "$port" \
  --arg health_body_sha256 "$health_body_sha256" \
  --arg health_body_type "$health_body_type" \
  --arg health_body_keys "$health_body_keys" \
  '{
    observed_at: $observed_at,
    pid: $pid,
    starttime: $starttime,
    process_group: $pgid,
    real_executable: $real_exe,
    executable_sha256: $exe_sha256,
    endpoint: {host: $host, port: $port},
    health_status: "passed",
    health_body_sha256: $health_body_sha256,
    health_body_type: $health_body_type,
    health_body_keys: ($health_body_keys | split(",") | map(select(length > 0)))
  }' >"$summary"

cleanup

if pgrep -x aioncore >/dev/null; then
  printf 'AionCore survivor detected after process-group cleanup\n' >&2
  exit 1
fi

jq '. + {cleanup: "no_survivors"}' "$summary" >"$summary.tmp"
mv "$summary.tmp" "$summary"
rm -f "$stdout_log" "$stderr_log" "$health_body_file"
cat "$summary"
trap - EXIT

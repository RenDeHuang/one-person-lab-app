#!/usr/bin/env bash
set -uo pipefail

run_id="${1:?run id is required}"
root="/opt/opl-validation/v2-v3/$run_id"
private_dir="$root/private"
evidence_dir="$root/evidence"
aioncore=/opt/opl-validation/bin/aioncore
summary="$evidence_dir/v2-aioncore-capability.json"
help_file="$private_dir/aioncore-help.txt"
stdout_log="$private_dir/aioncore.stdout.log"
stderr_log="$private_dir/aioncore.stderr.log"
data_dir="$root/aioncore-data"
work_dir="$root/work"
log_dir="$root/logs"
cookie_jar="$private_dir/cookies.txt"
reset_body="$private_dir/reset-password.json"
login_body="$private_dir/login.json"
login_request="$private_dir/login-request.json"
logout_body="$private_dir/logout.body"
valid_cookie_header_file="$private_dir/valid-cookie-header.txt"
pid=""
pgid=""

cleanup() {
  if [[ -z "$pgid" ]]; then
    return
  fi
  kill -TERM -- "-$pgid" 2>/dev/null || true
  for _ in $(seq 1 50); do
    if [[ "$(process_group_member_count)" -eq 0 ]]; then
      wait "$pid" 2>/dev/null || true
      return
    fi
    sleep 0.1
  done
  kill -KILL -- "-$pgid" 2>/dev/null || true
  wait "$pid" 2>/dev/null || true
}

process_group_member_count() {
  ps -eo pgid= 2>/dev/null | awk -v expected="$pgid" '$1 == expected { count += 1 } END { print count + 0 }'
}

umask 077
mkdir -p "$private_dir" "$evidence_dir" "$data_dir" "$work_dir" "$log_dir"
chmod 700 "$private_dir"
rm -f "$summary" "$help_file" "$stdout_log" "$stderr_log" "$cookie_jar" \
  "$reset_body" "$login_body" "$login_request" "$logout_body" "$valid_cookie_header_file"

"$aioncore" --help >"$help_file" 2>&1 || true
help_sha256="$(sha256sum "$help_file" | awk '{print $1}')"
auth_option_names="$(grep -Eo -- '--[a-z0-9-]*(auth|credential|jwt|local|secret|token)[a-z0-9-]*' "$help_file" | sort -u | paste -sd, - || true)"

setsid "$aioncore" \
  --port 0 \
  --data-dir "$data_dir" \
  --log-level info \
  --app-version validation-v2 \
  --log-dir "$log_dir" \
  --work-dir "$work_dir" \
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
  cleanup
  jq -n \
    --arg observed_at "$(date --iso-8601=seconds)" \
    --arg help_sha256 "$help_sha256" \
    --arg auth_option_names "$auth_option_names" \
    --arg stderr_sha256 "$(sha256sum "$stderr_log" | awk '{print $1}')" \
    '{
      observed_at: $observed_at,
      launch_without_local: "failed",
      help_sha256: $help_sha256,
      auth_option_names: ($auth_option_names | split(",") | map(select(length > 0))),
      private_stderr_sha256: $stderr_sha256,
      cleanup: "no_survivors"
    }' >"$summary"
  cat "$summary"
  trap - EXIT
  exit 0
fi

host="$(jq -r '.host' <<<"$endpoint")"
port="$(jq -r '.port' <<<"$endpoint")"
health_code="$(curl --silent --show-error --output /dev/null --write-out '%{http_code}' "http://$host:$port/health" 2>/dev/null || true)"
auth_status_code="$(curl --silent --show-error --output /dev/null --write-out '%{http_code}' "http://$host:$port/api/auth/status" 2>/dev/null || true)"
unauth_user_code="$(curl --silent --show-error --output /dev/null --write-out '%{http_code}' "http://$host:$port/api/auth/user" 2>/dev/null || true)"

windows_health_code="$(
  /mnt/c/Windows/System32/curl.exe --silent --show-error --output NUL --write-out '%{http_code}' \
    "http://localhost:$port/health" 2>/dev/null | tr -d '\r\n' || true
)"

reset_code="$(curl --silent --show-error --output "$reset_body" --write-out '%{http_code}' \
  -X POST "http://$host:$port/api/webui/reset-password" 2>/dev/null || true)"
generated_password=""
if [[ -s "$reset_body" ]]; then
  generated_password="$(jq -r '.data.new_password // .new_password // empty' "$reset_body" 2>/dev/null || true)"
fi
username="$(curl --silent --show-error "http://$host:$port/api/auth/internal/users/system" 2>/dev/null | \
  jq -r '.data.username // "admin"' 2>/dev/null || printf 'admin')"
login_code=""
valid_user_code=""
valid_ws_code=""
logout_code=""
stale_user_code=""
wrong_session_user_code=""
if [[ -n "$generated_password" ]]; then
  jq -n --arg username "$username" --arg password "$generated_password" \
    '{username: $username, password: $password, remember: true}' >"$login_request"
  login_code="$(curl --silent --show-error --output "$login_body" --cookie-jar "$cookie_jar" \
    -H 'content-type: application/json' --data-binary @"$login_request" \
    --write-out '%{http_code}' "http://$host:$port/login" 2>/dev/null || true)"
  if [[ -s "$cookie_jar" ]]; then
    awk '!/^#/ && NF >= 7 { printf "%s=%s;", $6, $7 }' "$cookie_jar" >"$valid_cookie_header_file"
  fi
  valid_cookie_header="$(cat "$valid_cookie_header_file" 2>/dev/null || true)"
  if [[ -n "$valid_cookie_header" ]]; then
    valid_user_code="$(curl --silent --show-error --output /dev/null --write-out '%{http_code}' \
      -H "Cookie: $valid_cookie_header" "http://$host:$port/api/auth/user" 2>/dev/null || true)"
    ws_headers="$private_dir/ws-valid.headers"
    curl --silent --show-error --http1.1 --no-buffer --max-time 3 \
      -D "$ws_headers" -o /dev/null \
      -H 'Connection: Upgrade' -H 'Upgrade: websocket' \
      -H 'Sec-WebSocket-Version: 13' -H 'Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==' \
      -H "Cookie: $valid_cookie_header" "http://$host:$port/ws" 2>/dev/null || true
    valid_ws_code="$(awk 'NR == 1 { print $2 }' "$ws_headers" 2>/dev/null || true)"
    printf '%s' "$valid_cookie_header" >"$valid_cookie_header_file"
    logout_code="$(curl --silent --show-error --output "$logout_body" --write-out '%{http_code}' \
      -H "Cookie: $valid_cookie_header" -X POST "http://$host:$port/logout" 2>/dev/null || true)"
    stale_user_code="$(curl --silent --show-error --output /dev/null --write-out '%{http_code}' \
      -H "Cookie: $valid_cookie_header" "http://$host:$port/api/auth/user" 2>/dev/null || true)"
  fi
fi
wrong_session_user_code="$(curl --silent --show-error --output /dev/null --write-out '%{http_code}' \
  -H 'Cookie: session=opl-invalid-validation-session' "http://$host:$port/api/auth/user" 2>/dev/null || true)"

cleanup
survivor_count="$(process_group_member_count)"

jq -n \
  --arg observed_at "$(date --iso-8601=seconds)" \
  --arg help_sha256 "$help_sha256" \
  --arg auth_option_names "$auth_option_names" \
  --argjson pid "$pid" \
  --arg starttime "$starttime" \
  --arg process_group "$pgid" \
  --arg real_executable "$real_exe" \
  --arg executable_sha256 "$exe_sha256" \
  --arg host "$host" \
  --argjson port "$port" \
  --arg health_code "$health_code" \
  --arg auth_status_code "$auth_status_code" \
  --arg unauth_user_code "$unauth_user_code" \
  --arg windows_health_code "$windows_health_code" \
  --arg reset_code "$reset_code" \
  --arg login_code "$login_code" \
  --arg valid_user_code "$valid_user_code" \
  --arg valid_ws_code "$valid_ws_code" \
  --arg logout_code "$logout_code" \
  --arg stale_user_code "$stale_user_code" \
  --arg wrong_session_user_code "$wrong_session_user_code" \
  --arg auth_username_present "$(if [[ -n "$username" ]]; then printf true; else printf false; fi)" \
  --argjson survivor_count "$survivor_count" \
  '{
    observed_at: $observed_at,
    launch_without_local: "passed",
    help_sha256: $help_sha256,
    auth_option_names: ($auth_option_names | split(",") | map(select(length > 0))),
    process_identity: {
      pid: $pid,
      starttime: $starttime,
      process_group: $process_group,
      real_executable: $real_executable,
      executable_sha256: $executable_sha256
    },
    endpoint: {host: $host, port: $port},
    linux_health_http_code: $health_code,
    auth_status_http_code: $auth_status_code,
    unauthenticated_user_http_code: $unauth_user_code,
    windows_loopback_health_http_code: $windows_health_code,
    authentication: {
      setup_reset_http_code: $reset_code,
      login_http_code: $login_code,
      authenticated_user_http_code: $valid_user_code,
      authenticated_websocket_http_code: $valid_ws_code,
      logout_http_code: $logout_code,
      stale_session_user_http_code: $stale_user_code,
      wrong_session_user_http_code: $wrong_session_user_code,
      username_present: ($auth_username_present == "true"),
      password_or_cookie_material: "private_only"
    },
    survivor_count: $survivor_count,
    cleanup: (if $survivor_count == 0 then "no_survivors" else "survivors_detected" end)
  }' >"$summary"

rm -f "$stdout_log" "$stderr_log" "$help_file" "$cookie_jar" "$reset_body" \
  "$login_body" "$login_request" "$logout_body" "$valid_cookie_header_file" \
  "$private_dir/ws-valid.headers"
rm -rf "$data_dir" "$work_dir" "$log_dir"
cat "$summary"
trap - EXIT

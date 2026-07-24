#!/usr/bin/env bash
set -uo pipefail

run_id="${1:?run id is required}"
root="/opt/opl-validation/v2-v3/$run_id"
private_dir="$root/private"
evidence_dir="$root/evidence"
summary="$evidence_dir/v2-process-ownership.json"
record="$private_dir/operation-record.json"
progress="$private_dir/process.progress"
carrier_id='OPL-Validation-g0001'

umask 077
mkdir -p "$private_dir" "$evidence_dir"
chmod 700 "$private_dir"
rm -f "$summary" "$record" "$record.tmp" "$progress"
mark() { printf '%s\n' "$1" >>"$progress"; }
trap 'mark exit' EXIT
mark start

operation_token="$(od -An -N16 -tx1 /dev/urandom | tr -d ' \n')"
session_id="$(od -An -N12 -tx1 /dev/urandom | tr -d ' \n')"

read_starttime() {
  awk '{print $22}' "/proc/$1/stat" 2>/dev/null
}

read_pgid() {
  ps -o pgid= -p "$1" 2>/dev/null | tr -d ' '
}

write_record() {
  local pid="$1"
  local mode="$2"
  local starttime pgid executable executable_sha256 uid gid mode_bits
  starttime="$(read_starttime "$pid")"
  pgid="$(read_pgid "$pid")"
  executable="$(readlink -f "/proc/$pid/exe" 2>/dev/null)"
  executable_sha256="$(sha256sum "$executable" 2>/dev/null | awk '{print $1}')"
  uid="$(stat -c '%u' "/proc/$pid" 2>/dev/null)"
  gid="$(stat -c '%g' "/proc/$pid" 2>/dev/null)"
  mode_bits="$(stat -c '%a' "$record" 2>/dev/null || printf '600')"
  jq -n \
    --arg token "$operation_token" \
    --arg session "$session_id" \
    --arg carrier "$carrier_id" \
    --arg mode "$mode" \
    --argjson pid "$pid" \
    --arg starttime "$starttime" \
    --arg pgid "$pgid" \
    --arg executable "$executable" \
    --arg executable_sha256 "$executable_sha256" \
    --arg uid "$uid" \
    --arg gid "$gid" \
    '{operation_token: $token, session_id: $session, carrier_id: $carrier, mode: $mode,
      pid: $pid, starttime: $starttime, process_group: $pgid,
      executable: $executable, executable_sha256: $executable_sha256,
      uid: $uid, gid: $gid, record_mode: "0600"}' >"$record.tmp"
  mv "$record.tmp" "$record"
}

record_matches() {
  local token="$1"
  local session="$2"
  local carrier="$3"
  local pid="$4"
  local expected_starttime="$5"
  local expected_pgid="$6"
  local expected_executable="$7"
  local expected_sha="$8"
  [[ "$token" == "$operation_token" ]] || return 1
  [[ "$session" == "$session_id" ]] || return 1
  [[ "$carrier" == "$carrier_id" ]] || return 1
  [[ -r "/proc/$pid/stat" ]] || return 1
  [[ "$(read_starttime "$pid")" == "$expected_starttime" ]] || return 1
  [[ "$(read_pgid "$pid")" == "$expected_pgid" ]] || return 1
  [[ "$(readlink -f "/proc/$pid/exe" 2>/dev/null)" == "$expected_executable" ]] || return 1
  [[ "$(sha256sum "$expected_executable" 2>/dev/null | awk '{print $1}')" == "$expected_sha" ]] || return 1
  tr '\0' '\n' <"/proc/$pid/environ" 2>/dev/null | grep -Fx "OPL_OPERATION_TOKEN=$operation_token" >/dev/null 2>&1 || return 1
  return 0
}

wait_gone() {
  local pid="$1"
  for _ in $(seq 1 40); do
    if [[ ! -e "/proc/$pid" ]]; then
      return 0
    fi
    sleep 0.1
  done
  return 1
}

count_token_survivors() {
  local count=0 env_file
  for env_file in /proc/[0-9]*/environ; do
    [[ -r "$env_file" ]] || continue
    if tr '\0' '\n' <"$env_file" 2>/dev/null | grep -Fx "OPL_OPERATION_TOKEN=$operation_token" >/dev/null 2>&1; then
      count=$((count + 1))
    fi
  done
  printf '%s' "$count"
}

env OPL_OPERATION_TOKEN="$operation_token" OPL_SESSION_ID="$session_id" OPL_CARRIER_ID="$carrier_id" \
  setsid bash -c 'trap "exit 0" TERM INT; sleep 300 & wait' &
graceful_pid=$!
mark graceful_spawned
graceful_starttime="$(read_starttime "$graceful_pid")"
graceful_pgid="$(read_pgid "$graceful_pid")"
graceful_executable="$(readlink -f "/proc/$graceful_pid/exe" 2>/dev/null)"
graceful_sha="$(sha256sum "$graceful_executable" 2>/dev/null | awk '{print $1}')"
write_record "$graceful_pid" graceful
valid_match=0
record_matches "$operation_token" "$session_id" "$carrier_id" "$graceful_pid" \
  "$graceful_starttime" "$graceful_pgid" "$graceful_executable" "$graceful_sha" && valid_match=1
wrong_token_rejected=0
record_matches wrong-token "$session_id" "$carrier_id" "$graceful_pid" \
  "$graceful_starttime" "$graceful_pgid" "$graceful_executable" "$graceful_sha" || wrong_token_rejected=1
wrong_session_rejected=0
record_matches "$operation_token" wrong-session "$carrier_id" "$graceful_pid" \
  "$graceful_starttime" "$graceful_pgid" "$graceful_executable" "$graceful_sha" || wrong_session_rejected=1
wrong_carrier_rejected=0
record_matches "$operation_token" "$session_id" wrong-carrier "$graceful_pid" \
  "$graceful_starttime" "$graceful_pgid" "$graceful_executable" "$graceful_sha" || wrong_carrier_rejected=1
wrong_starttime_rejected=0
record_matches "$operation_token" "$session_id" "$carrier_id" "$graceful_pid" \
  wrong-starttime "$graceful_pgid" "$graceful_executable" "$graceful_sha" || wrong_starttime_rejected=1
kill -TERM -- "-$graceful_pgid" 2>/dev/null || true
mark graceful_term_sent
graceful_term_stopped=0
wait_gone "$graceful_pid" && graceful_term_stopped=1

env OPL_OPERATION_TOKEN="$operation_token" OPL_SESSION_ID="$session_id" OPL_CARRIER_ID="$carrier_id" \
  setsid bash -c 'trap "" TERM INT; while :; do sleep 1; done' &
forced_pid=$!
mark forced_spawned
forced_starttime="$(read_starttime "$forced_pid")"
forced_pgid="$(read_pgid "$forced_pid")"
forced_executable="$(readlink -f "/proc/$forced_pid/exe" 2>/dev/null)"
forced_sha="$(sha256sum "$forced_executable" 2>/dev/null | awk '{print $1}')"
write_record "$forced_pid" forced
kill -TERM -- "-$forced_pgid" 2>/dev/null || true
sleep 0.5
forced_term_ignored=0
[[ -e "/proc/$forced_pid" ]] && forced_term_ignored=1
kill -KILL -- "-$forced_pgid" 2>/dev/null || true
mark forced_kill_sent
forced_kill_stopped=0
wait_gone "$forced_pid" && forced_kill_stopped=1

setsid sleep 300 &
decoy_pid=$!
mark decoy_spawned
decoy_pgid="$(read_pgid "$decoy_pid")"
env OPL_OPERATION_TOKEN="$operation_token" OPL_SESSION_ID="$session_id" OPL_CARRIER_ID="$carrier_id" \
  setsid bash -c 'trap "exit 0" TERM INT; sleep 300 & wait' &
target_pid=$!
target_pgid="$(read_pgid "$target_pid")"
kill -TERM -- "-$target_pgid" 2>/dev/null || true
target_stopped=0
wait_gone "$target_pid" && target_stopped=1
decoy_survived_target_cancel=0
[[ -e "/proc/$decoy_pid" ]] && decoy_survived_target_cancel=1
kill -KILL -- "-$decoy_pgid" 2>/dev/null || true
wait_gone "$decoy_pid" || true

stale_pid_rejected=0
record_matches "$operation_token" "$session_id" "$carrier_id" "$graceful_pid" \
  "$graceful_starttime" "$graceful_pgid" "$graceful_executable" "$graceful_sha" || stale_pid_rejected=1

survivor_count="$(count_token_survivors)"
mark before_summary
jq -n \
  --arg observed_at "$(date --iso-8601=seconds)" \
  --arg carrier_id "$carrier_id" \
  --argjson valid_match "$valid_match" \
  --argjson wrong_token_rejected "$wrong_token_rejected" \
  --argjson wrong_session_rejected "$wrong_session_rejected" \
  --argjson wrong_carrier_rejected "$wrong_carrier_rejected" \
  --argjson wrong_starttime_rejected "$wrong_starttime_rejected" \
  --argjson stale_pid_rejected "$stale_pid_rejected" \
  --argjson graceful_term_stopped "$graceful_term_stopped" \
  --argjson forced_term_ignored "$forced_term_ignored" \
  --argjson forced_kill_stopped "$forced_kill_stopped" \
  --argjson target_stopped "$target_stopped" \
  --argjson decoy_survived_target_cancel "$decoy_survived_target_cancel" \
  --argjson survivor_count "$survivor_count" \
  '{
    observed_at: $observed_at,
    validation_subject: "disposable_direct_child_control_predicate",
    product_integration: "unimplemented",
    carrier_id: $carrier_id,
    operation_record: {
      fields: ["opaque_token", "session_id", "carrier_id", "pid", "starttime", "process_group", "executable", "executable_sha256", "uid", "gid"],
      write_strategy: "atomic_rename",
      mode: "0600"
    },
    identity_match: ($valid_match == 1),
    negatives: {
      wrong_token_rejected: ($wrong_token_rejected == 1),
      wrong_session_rejected: ($wrong_session_rejected == 1),
      wrong_carrier_rejected: ($wrong_carrier_rejected == 1),
      wrong_starttime_rejected: ($wrong_starttime_rejected == 1),
      stale_pid_rejected: ($stale_pid_rejected == 1)
    },
    cancellation: {
      graceful_term_stopped: ($graceful_term_stopped == 1),
      forced_term_ignored: ($forced_term_ignored == 1),
      forced_kill_stopped: ($forced_kill_stopped == 1),
      targeted_cancel_left_decoy_alive: ($decoy_survived_target_cancel == 1),
      target_stopped: ($target_stopped == 1)
    },
    survivor_count: ($survivor_count | tonumber),
    cleanup: (if ($survivor_count | tonumber) == 0 then "no_survivors" else "survivors_detected" end)
  }' >"$summary"

rm -f "$record" "$record.tmp"
cat "$summary"

#!/usr/bin/env bash
set -uo pipefail

run_id="${1:?run id is required}"
root="/opt/opl-validation/v2-v3/$run_id"
private_dir="$root/private"
evidence_dir="$root/evidence"
summary="$evidence_dir/v3-independent-routes.json"
node_bin=/opt/opl-validation/managed-resource-attempts/20260724-v1-managed-g0005/bundle/node/node-v24.11.0-linux-x64/bin/node
codex_bin=/opt/opl-validation/codex/vendor/x86_64-unknown-linux-musl/bin/codex
framework_root=/opt/opl-validation/framework
framework_cli="$framework_root/src/entrypoints/cli.ts"
staging=/mnt/c/Users/oplrunner/OnePersonLab/staging
codex_receipt="$private_dir/codex-app-server.json"
framework_state="$private_dir/framework-state.json"
framework_help="$private_dir/framework-help.txt"

umask 077
mkdir -p "$private_dir" "$evidence_dir"
chmod 700 "$private_dir"
rm -f "$summary" "$codex_receipt" "$framework_state" "$framework_help"

direct_codex_status='unavailable'
direct_codex_exit=''
direct_codex_sha256=''
direct_codex_realpath=''
direct_codex_home=''
direct_codex_initialize_ok=false
direct_codex_thread_list_ok=false
direct_codex_cleanup='direct_candidate_cleanup_not_independently_recorded'
if [[ -x "$node_bin" && -x "$codex_bin" && -f "$staging/v1-codex-app-server.mjs" ]]; then
  "$node_bin" "$staging/v1-codex-app-server.mjs" >"$codex_receipt" 2>/dev/null
  direct_codex_exit=$?
  if [[ -s "$codex_receipt" ]]; then
    direct_codex_status="$(jq -r '.status // (if .initialize_ok == true and .thread_list_ok == true then "passed" else "partial" end)' "$codex_receipt" 2>/dev/null || printf 'partial')"
    direct_codex_sha256="$(jq -r '.executable_sha256 // empty' "$codex_receipt" 2>/dev/null || true)"
    direct_codex_realpath="$(jq -r '.executable // empty' "$codex_receipt" 2>/dev/null || true)"
    direct_codex_home="$(jq -r '.codex_home // empty' "$codex_receipt" 2>/dev/null || true)"
    direct_codex_initialize_ok="$(jq -r '.initialize_ok == true' "$codex_receipt" 2>/dev/null || printf false)"
    direct_codex_thread_list_ok="$(jq -r '.thread_list_ok == true' "$codex_receipt" 2>/dev/null || printf false)"
    direct_codex_cleanup="$(jq -r '.cleanup // "direct_candidate_cleanup_not_independently_recorded"' "$codex_receipt" 2>/dev/null || printf direct_candidate_cleanup_not_independently_recorded)"
  fi
fi

framework_state_status='unavailable'
framework_state_sha256=''
framework_state_keys=''
framework_cli_version=''
if [[ -x "$node_bin" && -f "$framework_cli" ]]; then
  "$node_bin" --experimental-strip-types "$framework_cli" app state --profile fast --json >"$framework_state" 2>/dev/null
  framework_state_exit=$?
  if [[ "$framework_state_exit" -eq 0 && -s "$framework_state" ]] && jq -e 'type == "object"' "$framework_state" >/dev/null 2>&1; then
    framework_state_status='passed'
    framework_state_sha256="$(sha256sum "$framework_state" | awk '{print $1}')"
    framework_state_keys="$(jq -r 'keys | sort | join(",")' "$framework_state")"
  else
    framework_state_status='failed_reproducibly'
  fi
  "$node_bin" --experimental-strip-types "$framework_cli" --help >"$framework_help" 2>/dev/null
  framework_help_exit=$?
  framework_cli_version="$(sha256sum "$framework_help" 2>/dev/null | awk '{print $1}')"
else
  framework_state_exit='unavailable'
  framework_help_exit='unavailable'
fi

route_probe() {
  local route="$1"
  local output="$private_dir/route-${route// /-}.txt"
  "$node_bin" --experimental-strip-types "$framework_cli" $route --help >"$output" 2>/dev/null
  local exit_code=$?
  jq -n --arg route "$route" --argjson exit_code "$exit_code" --arg output_sha256 "$(sha256sum "$output" 2>/dev/null | awk '{print $1}')" \
    '{route: $route, help_exit_code: $exit_code, help_sha256: $output_sha256}'
}

typed_route_results='[]'
if [[ -x "$node_bin" && -f "$framework_cli" ]]; then
  route_app_action="$(route_probe 'app action execute')"
  route_gateway_login="$(route_probe 'connect gateway login')"
  route_system_update="$(route_probe 'system update')"
  route_system_repair="$(route_probe 'system repair')"
  typed_route_results="$(jq -n -c \
    --argjson app_action "$route_app_action" \
    --argjson gateway_login "$route_gateway_login" \
    --argjson system_update "$route_system_update" \
    --argjson system_repair "$route_system_repair" \
    '[$app_action, $gateway_login, $system_update, $system_repair]')"
fi

managed_codex_path=/opt/opl-validation/managed-resource-attempts/20260724-v1-managed-g0005/bundle/acp/codex-acp
managed_codex_materialized=false
if [[ -e "$managed_codex_path" ]]; then
  managed_codex_materialized=true
fi

jq -n \
  --arg observed_at "$(date --iso-8601=seconds)" \
  --arg direct_codex_status "$direct_codex_status" \
  --arg direct_codex_exit "$direct_codex_exit" \
  --arg direct_codex_sha256 "$direct_codex_sha256" \
  --arg direct_codex_realpath "$direct_codex_realpath" \
  --arg direct_codex_home "$direct_codex_home" \
  --argjson direct_codex_initialize_ok "$direct_codex_initialize_ok" \
  --argjson direct_codex_thread_list_ok "$direct_codex_thread_list_ok" \
  --arg direct_codex_cleanup "$direct_codex_cleanup" \
  --arg framework_state_status "$framework_state_status" \
  --arg framework_state_exit "${framework_state_exit:-}" \
  --arg framework_state_sha256 "$framework_state_sha256" \
  --arg framework_state_keys "$framework_state_keys" \
  --arg framework_help_sha256 "$framework_cli_version" \
  --arg framework_help_exit "${framework_help_exit:-}" \
  --argjson typed_route_results "$typed_route_results" \
  --argjson managed_codex_materialized "$managed_codex_materialized" \
  '{
    observed_at: $observed_at,
    status: (if $direct_codex_status == "passed" and $framework_state_status == "passed" and $managed_codex_materialized == false then "partial" else "blocked_or_partial" end),
    acp_route: {
      status: (if $managed_codex_materialized then "candidate_present" else "blocked_upstream_artifact" end),
      managed_codex_materialized: $managed_codex_materialized
    },
    direct_codex_app_server: {
      status: $direct_codex_status,
      exit_code: $direct_codex_exit,
      initialize_ok: $direct_codex_initialize_ok,
      thread_list_ok: $direct_codex_thread_list_ok,
      cleanup: $direct_codex_cleanup,
      executable_realpath: $direct_codex_realpath,
      executable_sha256: $direct_codex_sha256,
      codex_home: $direct_codex_home
    },
    framework: {
      state_status: $framework_state_status,
      state_exit_code: $framework_state_exit,
      state_sha256: $framework_state_sha256,
      state_top_level_keys: ($framework_state_keys | split(",") | map(select(length > 0))),
      help_exit_code: $framework_help_exit,
      help_sha256: $framework_help_sha256,
      typed_owner_route_help: $typed_route_results,
      mutations_executed: false
    },
    single_codex_owner_binding: "blocked_direct_and_framework_receipts_not_equal",
    renderer_secret_isolation: "unattempted_no_product_broker",
    non_root_product_identity: "unattempted_validation_runs_as_root"
  }' >"$summary"

rm -f "$codex_receipt" "$framework_state" "$framework_help" "$private_dir"/route-*.txt
cat "$summary"

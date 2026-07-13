#!/usr/bin/env bash

set -euo pipefail

target="${1:-}"
if [ "$target" != candidate ] && [ "$target" != latest-stable ]; then
  echo "usage: framework-release-promotion-step.sh <candidate|latest-stable>" >&2
  exit 2
fi

: "${GH_TOKEN:?GH_TOKEN is required for cross-repository Framework dispatch.}"
: "${OPL_FRAMEWORK_REPO:?OPL_FRAMEWORK_REPO is required.}"
: "${OPL_FRAMEWORK_WORKFLOW:?OPL_FRAMEWORK_WORKFLOW is required.}"
: "${OPL_RELEASE_SET_GENERATION:?OPL_RELEASE_SET_GENERATION is required.}"
: "${OPL_RELEASE_GATE:?OPL_RELEASE_GATE is required.}"
: "${OPL_APP_VERSION:?OPL_APP_VERSION is required.}"
: "${OPL_PROMOTION_REQUEST_ID:?OPL_PROMOTION_REQUEST_ID is required.}"
: "${OPL_SOURCE_APP_RUN_ID:?OPL_SOURCE_APP_RUN_ID is required.}"
: "${OPL_APP_SOURCE_COMMIT:?OPL_APP_SOURCE_COMMIT is required.}"
: "${OPL_APP_ARTIFACT_DIGEST:?OPL_APP_ARTIFACT_DIGEST is required.}"
: "${OPL_FRAMEWORK_SOURCE_COMMIT:?OPL_FRAMEWORK_SOURCE_COMMIT is required.}"
: "${OPL_RECEIPT_OUTPUT_DIR:?OPL_RECEIPT_OUTPUT_DIR is required.}"

if [ "$target" = latest-stable ]; then
  : "${OPL_EXPECTED_CARRIER_DIGEST:?OPL_EXPECTED_CARRIER_DIGEST is required for Stable promotion.}"
  : "${OPL_CANDIDATE_RECEIPT:?OPL_CANDIDATE_RECEIPT is required for Stable promotion.}"
fi

artifact="opl-release-promotion-receipt-${OPL_PROMOTION_REQUEST_ID}-${target}"
mkdir -p "$OPL_RECEIPT_OUTPUT_DIR"

run_id="$(gh api --method GET "repos/${OPL_FRAMEWORK_REPO}/actions/artifacts" \
  -f name="$artifact" -f per_page=100 \
  --jq '[.artifacts[] | select(.expired == false)] | sort_by(.created_at) | reverse | .[0].workflow_run.id // empty')"

if [ -z "$run_id" ]; then
  before="$RUNNER_TEMP/framework-${target}-before.json"
  gh run list --repo "$OPL_FRAMEWORK_REPO" --workflow "$OPL_FRAMEWORK_WORKFLOW" \
    --event workflow_dispatch --limit 100 --json databaseId > "$before"
  dispatched_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  fields=(
    --field "release_set_generation=$OPL_RELEASE_SET_GENERATION"
    --field "release_gate=$OPL_RELEASE_GATE"
    --field "promotion_target=$target"
    --field "app_version=$OPL_APP_VERSION"
    --field "promotion_request_id=$OPL_PROMOTION_REQUEST_ID"
    --field "source_app_run_id=$OPL_SOURCE_APP_RUN_ID"
    --field "expected_app_source_commit=$OPL_APP_SOURCE_COMMIT"
    --field "expected_app_artifact_digest=$OPL_APP_ARTIFACT_DIGEST"
    --field "expected_framework_source_commit=$OPL_FRAMEWORK_SOURCE_COMMIT"
  )
  if [ "$target" = latest-stable ]; then
    fields+=(--field "expected_carrier_digest=$OPL_EXPECTED_CARRIER_DIGEST")
  fi
  gh workflow run "$OPL_FRAMEWORK_WORKFLOW" --repo "$OPL_FRAMEWORK_REPO" --ref main "${fields[@]}"

  for _attempt in $(seq 1 20); do
    current="$RUNNER_TEMP/framework-${target}-current.json"
    gh run list --repo "$OPL_FRAMEWORK_REPO" --workflow "$OPL_FRAMEWORK_WORKFLOW" \
      --event workflow_dispatch --limit 100 \
      --json databaseId,createdAt,displayTitle,headBranch > "$current"
    run_id="$(BEFORE="$before" CURRENT="$current" DISPATCHED_AT="$dispatched_at" REQUEST_ID="$OPL_PROMOTION_REQUEST_ID" node --input-type=module <<'NODE'
import fs from 'node:fs';
const before = new Set(JSON.parse(fs.readFileSync(process.env.BEFORE, 'utf8')).map((run) => run.databaseId));
const earliest = Date.parse(process.env.DISPATCHED_AT) - 5000;
const run = JSON.parse(fs.readFileSync(process.env.CURRENT, 'utf8'))
  .filter((item) => !before.has(item.databaseId)
    && item.headBranch === 'main'
    && item.displayTitle.includes(process.env.REQUEST_ID)
    && Date.parse(item.createdAt) >= earliest)
  .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))[0];
process.stdout.write(run ? String(run.databaseId) : '');
NODE
    )"
    [ -n "$run_id" ] && break
    sleep 3
  done
  [ -n "$run_id" ] || { echo "::error::Unable to discover exact Framework $target run for $OPL_PROMOTION_REQUEST_ID."; exit 1; }
  timeout 3660 gh run watch "$run_id" --repo "$OPL_FRAMEWORK_REPO" --interval 60 --exit-status
fi

gh run download "$run_id" --repo "$OPL_FRAMEWORK_REPO" --name "$artifact" --dir "$OPL_RECEIPT_OUTPUT_DIR"
receipt="$(find "$OPL_RECEIPT_OUTPUT_DIR" -name '*.json' -type f -print -quit)"
[ -n "$receipt" ] && [ -f "$receipt" ] || { echo "::error::Framework receipt artifact $artifact has no JSON receipt."; exit 1; }

args=(
  node --experimental-strip-types scripts/validate-framework-release-promotion-receipt.ts
  --receipt "$receipt"
  --target "$target"
  --promotion-request-id "$OPL_PROMOTION_REQUEST_ID"
  --release-set-generation "$OPL_RELEASE_SET_GENERATION"
  --release-gate "$OPL_RELEASE_GATE"
  --source-app-run-id "$OPL_SOURCE_APP_RUN_ID"
  --app-version "$OPL_APP_VERSION"
  --app-source-commit "$OPL_APP_SOURCE_COMMIT"
  --app-artifact-digest "$OPL_APP_ARTIFACT_DIGEST"
  --framework-source-commit "$OPL_FRAMEWORK_SOURCE_COMMIT"
  --framework-run-id "$run_id"
)
if [ "$target" = latest-stable ]; then
  args+=(--expected-carrier-digest "$OPL_EXPECTED_CARRIER_DIGEST" --candidate-receipt "$OPL_CANDIDATE_RECEIPT")
fi
validation="$("${args[@]}")"
carrier_digest="$(node -e 'const value=JSON.parse(process.argv[1]); process.stdout.write(value.carrier_digest)' "$validation")"
receipt_sha256="$(shasum -a 256 "$receipt" | awk '{print $1}')"

if [ -n "${GITHUB_OUTPUT:-}" ]; then
  {
    echo "run_id=$run_id"
    echo "carrier_digest=$carrier_digest"
    echo "receipt_sha256=$receipt_sha256"
    echo "receipt_path=$receipt"
    echo "artifact_name=$artifact"
  } >> "$GITHUB_OUTPUT"
fi
printf '%s\n' "$validation"

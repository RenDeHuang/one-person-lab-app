#!/usr/bin/env bash

set -euo pipefail

target="${1:-}"
if [ "$target" != candidate ] && [ "$target" != latest-stable ]; then
  echo "usage: framework-release-promotion-step.sh <candidate|latest-stable>" >&2
  exit 2
fi

: "${GH_TOKEN:?GH_TOKEN is required for read-only Framework receipt discovery.}"
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

[ -n "$run_id" ] || {
  echo "::error::The isolated mutation broker has not produced Framework $target receipt $artifact. App workflows cannot dispatch cross-repository mutations."
  exit 1
}

gh run download "$run_id" --repo "$OPL_FRAMEWORK_REPO" --name "$artifact" --dir "$OPL_RECEIPT_OUTPUT_DIR"
receipts=()
while IFS= read -r candidate; do receipts+=("$candidate"); done < <(
  find "$OPL_RECEIPT_OUTPUT_DIR" -name '*.json' -type f -print | LC_ALL=C sort
)
if [ "${#receipts[@]}" -ne 1 ]; then
  echo "::error::Framework receipt artifact $artifact must contain exactly one JSON receipt; found ${#receipts[@]}."
  exit 1
fi
receipt="${receipts[0]}"
[ -f "$receipt" ] && [ ! -L "$receipt" ] || { echo "::error::Framework receipt artifact $artifact has an invalid JSON receipt path."; exit 1; }

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

#!/usr/bin/env bash
set -euo pipefail

phase="${1:-}"
if [ -z "$phase" ]; then
  echo "Usage: $0 <prepare|build|inspect|smoke|tag|publish>" >&2
  exit 2
fi

: "${OPL_VERSION:?Set OPL_VERSION.}"

image_owner="$(printf '%s' "${GITHUB_REPOSITORY_OWNER:?Set GITHUB_REPOSITORY_OWNER.}" | tr '[:upper:]' '[:lower:]')"
ghcr_image="ghcr.io/${image_owner}/one-person-lab-webui"
channel_tags_csv="${WEBUI_CHANNEL_TAGS:-stable,latest}"
workflow_job="${WEBUI_WORKFLOW_JOB:-publish-webui-ghcr}"
release_mode="${RELEASE_MODE:-new_release}"
publish_failure_exit_code="${WEBUI_PUBLISH_FAILURE_EXIT_CODE:-1}"

write_publish_summary() {
  local status="$1"
  local error_code="${2:-}"
  local error_message="${3:-}"
  STATUS="$status" ERROR_CODE="$error_code" ERROR_MESSAGE="$error_message" GHCR_IMAGE="$ghcr_image" node <<'NODE'
const fs = require('node:fs');
const version = process.env.OPL_VERSION;
const channelTags = (process.env.WEBUI_CHANNEL_TAGS || 'stable,latest')
  .split(',')
  .map((tag) => tag.trim())
  .filter(Boolean);
const tags = [version, `${version}-slim`, ...channelTags];
const releaseMode = process.env.RELEASE_MODE || 'new_release';
const payload = {
  status: process.env.STATUS,
  image: process.env.GHCR_IMAGE,
  tags,
  draft_candidate_push: releaseMode !== 'draft_candidate',
  source_repository: `https://github.com/${process.env.GITHUB_REPOSITORY}`,
  shell_repository: 'https://github.com/gaofeng21cn/opl-aion-shell',
  shell_revision: process.env.SHELL_SHA || '',
  build_reuse: {
    mode: process.env.WEBUI_BUILD_REUSE_MODE || 'webui_only_release_workflow',
    source_gate: process.env.WEBUI_SOURCE_GATE || 'webui-ghcr-release',
    repeated_docker_build: process.env.WEBUI_REPEATED_DOCKER_BUILD === 'true',
    image_profiles: ['webui-full', 'webui-slim'],
  },
  package_access_required: {
    package_url: 'https://github.com/users/gaofeng21cn/packages/container/package/one-person-lab-webui/settings',
    required_actions_access_repository: 'gaofeng21cn/one-person-lab-app',
    required_actions_access_permission: 'write',
    configuration_surface: 'GitHub Packages settings Manage Actions access',
    failure_signal: 'docker push denied: permission_denied: write_package',
  },
};
if (process.env.ERROR_CODE) {
  payload.error = { code: process.env.ERROR_CODE, message: process.env.ERROR_MESSAGE };
}
fs.writeFileSync('/tmp/opl-webui-ghcr-publish.json', `${JSON.stringify(payload)}\n`);
NODE
}

write_smoke_contract() {
  node <<'NODE'
const fs = require('node:fs');
const policy = JSON.parse(fs.readFileSync('contracts/app-install-exposure-policy.json', 'utf8'));
const dockerWebui = policy.installer_surfaces.find((surface) => surface.surface === 'docker_webui');
const smokeGate = dockerWebui && dockerWebui.smoke_gate_contract;
if (!smokeGate) {
  throw new Error('contracts/app-install-exposure-policy.json missing docker_webui.smoke_gate_contract');
}
const payload = {
  status: 'contract_record_only_not_live_smoke_evidence',
  source_policy: 'contracts/app-install-exposure-policy.json#installer_surfaces.docker_webui.smoke_gate_contract',
  workflow_job: process.env.WEBUI_WORKFLOW_JOB || 'publish-webui-ghcr',
  workflow_artifact: smokeGate.workflow_artifact,
  required_gates: smokeGate.required_gates,
  health_check_surfaces: smokeGate.health_check_surfaces,
  diagnostic_bundle_artifacts: smokeGate.diagnostic_bundle_artifacts,
  false_ready_boundary: smokeGate.false_ready_boundary,
  note: 'This artifact declares required Docker/WebUI smoke gates. Clean Linux VM, clean Windows VM, existing Docker, and old OnePersonLab data-dir evidence must be supplied by fresh workflow/manual smoke artifacts or typed blockers before release-ready claims.',
};
fs.writeFileSync('/tmp/docker-webui-smoke-gate-contract.json', `${JSON.stringify(payload, null, 2)}\n`);
NODE
}

docker_build_args() {
  printf '%s\0' --label "org.opencontainers.image.source=https://github.com/${GITHUB_REPOSITORY:?Set GITHUB_REPOSITORY.}"
  if [ -n "${SHELL_SHA:-}" ]; then
    printf '%s\0' --label "org.opencontainers.image.revision=${SHELL_SHA}"
  fi
  if [ -n "${OPL_FRAMEWORK_SHA:-}" ]; then
    printf '%s\0' --build-arg "OPL_FRAMEWORK_REF=${OPL_FRAMEWORK_SHA}"
  fi
}

case "$phase" in
  prepare)
    if ! [[ "$OPL_VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+([-+][0-9A-Za-z.-]+)?$ ]]; then
      echo "::error::Invalid OPL version: $OPL_VERSION"
      exit 1
    fi
    write_publish_summary "started"
    write_smoke_contract
    ;;

  build)
    mapfile -d '' build_args < <(docker_build_args)
    docker build \
      "${build_args[@]}" \
      -t "one-person-lab-webui:${OPL_VERSION}" \
      shells/aionui
    docker build \
      --build-arg OPL_WEBUI_IMAGE_PROFILE=webui-slim \
      "${build_args[@]}" \
      -t "one-person-lab-webui:${OPL_VERSION}-slim" \
      shells/aionui
    ;;

  inspect)
    docker image inspect "one-person-lab-webui:${OPL_VERSION}" \
      --format '{{.Size}}' > /tmp/opl-webui-image-size-bytes.txt
    docker image inspect "one-person-lab-webui:${OPL_VERSION}" > /tmp/opl-webui-image-inspect.json
    docker image inspect "one-person-lab-webui:${OPL_VERSION}-slim" > /tmp/opl-webui-slim-image-inspect.json
    docker run --rm --entrypoint cat "one-person-lab-webui:${OPL_VERSION}" \
      /opt/opl/image-manifest.json > /tmp/opl-webui-image-manifest.json
    docker run --rm --entrypoint cat "one-person-lab-webui:${OPL_VERSION}" \
      /opt/opl/seed/metadata.json > /tmp/opl-webui-seed-metadata.json
    docker run --rm --entrypoint sh "one-person-lab-webui:${OPL_VERSION}" -lc \
      'command -v opl && command -v codex && test "$(find /opt/opl/seed/payload -type f | wc -l)" -gt 0' \
      > /tmp/opl-webui-runtime-readback.txt
    docker run --rm --entrypoint cat "one-person-lab-webui:${OPL_VERSION}-slim" \
      /opt/opl/image-manifest.json > /tmp/opl-webui-slim-image-manifest.json
    docker run --rm --entrypoint cat "one-person-lab-webui:${OPL_VERSION}-slim" \
      /opt/opl/seed/metadata.json > /tmp/opl-webui-slim-seed-metadata.json
    node --experimental-strip-types scripts/validate-webui-runtime-image.ts \
      --image-inspect /tmp/opl-webui-image-inspect.json \
      --image-manifest /tmp/opl-webui-image-manifest.json \
      --seed-metadata /tmp/opl-webui-seed-metadata.json \
      --expected-profile webui-full \
      --summary-path /tmp/opl-webui-runtime-image-validation.json
    node --experimental-strip-types scripts/validate-webui-runtime-image.ts \
      --image-inspect /tmp/opl-webui-slim-image-inspect.json \
      --image-manifest /tmp/opl-webui-slim-image-manifest.json \
      --seed-metadata /tmp/opl-webui-slim-seed-metadata.json \
      --expected-profile webui-slim \
      --summary-path /tmp/opl-webui-slim-runtime-image-validation.json
    ;;

  smoke)
    webui_smoke_dir="$(mktemp -d)"
    mkdir -p "$webui_smoke_dir/data" "$webui_smoke_dir/projects"
    printf '%s\n' "projects mount smoke" > "$webui_smoke_dir/projects/.opl-projects-smoke"
    container="$(docker run --rm -d -p 127.0.0.1::3000 \
      -v "$webui_smoke_dir/data:/data" \
      -v "$webui_smoke_dir/projects:/projects" \
      "one-person-lab-webui:${OPL_VERSION}")"
    cleanup() {
      docker logs "$container" >/tmp/opl-webui-container.log 2>&1 || true
      docker rm -f "$container" >/dev/null 2>&1 || true
    }
    trap cleanup EXIT
    port="$(docker port "$container" 3000/tcp | sed -E 's/.*:([0-9]+)$/\1/')"
    for _attempt in $(seq 1 60); do
      if curl -fsS "http://127.0.0.1:${port}/" >/tmp/opl-webui-index.html; then
        break
      fi
      sleep 2
    done
    curl -fsS "http://127.0.0.1:${port}/manifest.webmanifest" >/tmp/opl-webui-manifest.webmanifest
    auth_headers="$(mktemp)"
    auth_body="$(mktemp)"
    for _attempt in $(seq 1 60); do
      if curl -fsS -D "$auth_headers" "http://127.0.0.1:${port}/api/auth/user" -o "$auth_body" \
        && grep -q '"success":[[:space:]]*true' "$auth_body" \
        && grep -iq '^set-cookie:' "$auth_headers"; then
        break
      fi
      sleep 2
    done
    grep -q '"success":[[:space:]]*true' "$auth_body"
    grep -iq '^set-cookie:' "$auth_headers"
    cp "$auth_body" /tmp/opl-webui-auth-user.json
    curl -fsS -X POST -H 'content-type: application/json' -d '{}' \
      "http://127.0.0.1:${port}/api/opl-runtime/startup-maintenance" \
      >/tmp/opl-webui-startup-maintenance.json
    curl -fsS -X POST -H 'content-type: application/json' -d '{}' \
      "http://127.0.0.1:${port}/api/opl-runtime/update-status" \
      >/tmp/opl-webui-update-status.json
    grep -q '"success":[[:space:]]*true' /tmp/opl-webui-startup-maintenance.json
    grep -q '"success":[[:space:]]*true' /tmp/opl-webui-update-status.json
    for _attempt in $(seq 1 60); do
      if [ -s "$webui_smoke_dir/data/opl/state/install-manifest.json" ]; then
        break
      fi
      sleep 1
    done
    test -s "$webui_smoke_dir/data/opl/state/install-manifest.json"
    test -f "$webui_smoke_dir/projects/.opl-projects-smoke"
    docker exec "$container" cat /projects/.opl-projects-smoke >/tmp/opl-webui-projects-readback.txt
    grep -q 'projects mount smoke' /tmp/opl-webui-projects-readback.txt
    cp "$webui_smoke_dir/data/opl/state/install-manifest.json" /tmp/opl-webui-install-manifest.json
    node --experimental-strip-types scripts/validate-webui-runtime-smoke-receipts.ts \
      --startup-maintenance /tmp/opl-webui-startup-maintenance.json \
      --update-status /tmp/opl-webui-update-status.json \
      --install-manifest /tmp/opl-webui-install-manifest.json \
      --summary-path /tmp/opl-webui-runtime-smoke-receipts-validation.json
    docker logs "$container" >/tmp/opl-webui-container.log 2>&1
    grep -q 'running OPL seed apply' /tmp/opl-webui-container.log
    grep -Eq 'running OPL (runtime substrate )?startup maintenance' /tmp/opl-webui-container.log
    ! grep -q 'OPL maintenance CLI not found; skipping startup maintenance' /tmp/opl-webui-container.log
    ;;

  tag)
    docker tag "one-person-lab-webui:${OPL_VERSION}" "${ghcr_image}:${OPL_VERSION}"
    docker tag "one-person-lab-webui:${OPL_VERSION}-slim" "${ghcr_image}:${OPL_VERSION}-slim"
    IFS=',' read -r -a channel_tags <<< "$channel_tags_csv"
    for tag in "${channel_tags[@]}"; do
      tag="$(printf '%s' "$tag" | xargs)"
      if [ -n "$tag" ]; then
        docker tag "one-person-lab-webui:${OPL_VERSION}" "${ghcr_image}:${tag}"
      fi
    done
    ;;

  publish)
    if [ "$release_mode" = "draft_candidate" ]; then
      write_publish_summary "draft_not_pushed"
      exit 0
    fi
    if ! printf '%s' "${GH_TOKEN:?Set GH_TOKEN.}" | docker login ghcr.io -u "${GITHUB_ACTOR:?Set GITHUB_ACTOR.}" --password-stdin; then
      write_publish_summary "failed" "ghcr_login_failed" "GHCR login failed before pushing one-person-lab-webui tags."
      exit "$publish_failure_exit_code"
    fi
    publish_tags=("${OPL_VERSION}" "${OPL_VERSION}-slim")
    IFS=',' read -r -a channel_tags <<< "$channel_tags_csv"
    for tag in "${channel_tags[@]}"; do
      tag="$(printf '%s' "$tag" | xargs)"
      if [ -n "$tag" ]; then
        publish_tags+=("$tag")
      fi
    done
    for tag in "${publish_tags[@]}"; do
      if ! docker push "${ghcr_image}:${tag}"; then
        write_publish_summary "failed" "ghcr_write_package_denied" "GHCR ${tag} tag push failed. Ensure the one-person-lab-webui package grants write Actions access to gaofeng21cn/one-person-lab-app."
        exit "$publish_failure_exit_code"
      fi
    done
    write_publish_summary "published"
    ;;

  *)
    echo "Unknown phase: $phase" >&2
    exit 2
    ;;
esac

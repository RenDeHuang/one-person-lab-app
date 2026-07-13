#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

usage() {
  cat <<'USAGE'
Usage:
  scripts/verify.sh [lane...]

Lanes:
  smoke             Active shell structural quick check. This is the default.
  active-shell      Full active shell validation commands from the shell adapter.
  release-boundary  App release-boundary validator and parallel release tests.
  candidate-shell   Shell candidate registry and package-command contract check.
  structure         Active shell and App release-boundary static checks without release packaging.
  full              active-shell + release-boundary + candidate-shell; each full shell suite runs once.

This wrapper intentionally does not build DMGs, publish releases, or run VM smoke
tests. Use the explicit release:* and test:opl-first-run-vm:* commands for those
release lanes.
USAGE
}

run_lane() {
  local lane="$1"
  case "$lane" in
    smoke)
      npm run ensure:shell
      npm run validate:active-shell -- --quick
      ;;
    active-shell)
      npm run ensure:shell
      npm run validate:active-shell
      ;;
    release-boundary)
      npm run ensure:shell
      npm run test:release-boundary
      ;;
    candidate-shell)
      npm run ensure:shell
      npm run validate:shell-candidates
      ;;
    structure)
      npm run ensure:shell
      npm run validate:active-shell -- --quick
      npm run validate:release-boundary
      ;;
    full)
      run_lane active-shell
      run_lane release-boundary
      run_lane candidate-shell
      ;;
    -h|--help|help)
      usage
      ;;
    *)
      printf 'Unknown verify lane: %s\n\n' "$lane" >&2
      usage >&2
      return 2
      ;;
  esac
}

if [ "$#" -eq 0 ]; then
  set -- smoke
fi

for lane in "$@"; do
  run_lane "$lane"
done

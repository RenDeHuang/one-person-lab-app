#!/usr/bin/env bash
set -euo pipefail

OPL_APP_INSTALLER_URL=${OPL_APP_INSTALLER_URL:-https://raw.githubusercontent.com/gaofeng21cn/one-person-lab-app/main/install.sh}
installer_url="$OPL_APP_INSTALLER_URL"

# ponytail: compatibility wrapper; keep stable install logic in install.sh.
curl -fsSL "$installer_url" | bash -s -- --stable-macos-install --yes "$@"

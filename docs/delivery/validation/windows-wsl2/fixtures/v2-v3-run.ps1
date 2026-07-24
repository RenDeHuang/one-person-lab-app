param(
  [string]$RunId = '20260724-v2-v3-g0001'
)

$ErrorActionPreference = 'Stop'

$distro = 'OPL-Validation-g0001'
$staging = '/mnt/c/Users/oplrunner/OnePersonLab/staging/v2-v3'
$wsl = Join-Path $env:SystemRoot 'System32\wsl.exe'

New-Item -ItemType Directory -Force -Path 'C:\Users\oplrunner\OnePersonLab\staging\v2-v3\evidence' | Out-Null

& $wsl --distribution $distro --user root --exec bash `
  "$staging/v2-v3-run-private.sh" `
  $RunId `
  "$staging/v2-aioncore-capability-probe.sh"
if ($LASTEXITCODE -ne 0) {
  throw "V2 AionCore capability probe failed with exit code $LASTEXITCODE"
}

& $wsl --distribution $distro --user root --exec cp `
  "/opt/opl-validation/v2-v3/$RunId/evidence/v2-aioncore-capability.json" `
  "$staging/evidence/$RunId-v2-aioncore-capability.json"
if ($LASTEXITCODE -ne 0) {
  throw "Failed to copy V2 evidence with exit code $LASTEXITCODE"
}

& $wsl --distribution $distro --user root --exec bash `
  "$staging/v2-v3-run-private.sh" `
  "$RunId" `
  "$staging/v2-process-ownership-probe.sh"
if ($LASTEXITCODE -ne 0) {
  throw "V2 process ownership probe failed with exit code $LASTEXITCODE"
}

& $wsl --distribution $distro --user root --exec cp `
  "/opt/opl-validation/v2-v3/$RunId/evidence/v2-process-ownership.json" `
  "$staging/evidence/$RunId-v2-process-ownership.json"
if ($LASTEXITCODE -ne 0) {
  throw "Failed to copy V2 process evidence with exit code $LASTEXITCODE"
}

& $wsl --distribution $distro --user root --exec bash `
  "$staging/v2-v3-run-private.sh" `
  "$RunId" `
  "$staging/v3-route-probe.sh"
if ($LASTEXITCODE -ne 0) {
  throw "V3 independent route probe failed with exit code $LASTEXITCODE"
}

& $wsl --distribution $distro --user root --exec cp `
  "/opt/opl-validation/v2-v3/$RunId/evidence/v3-independent-routes.json" `
  "$staging/evidence/$RunId-v3-independent-routes.json"
if ($LASTEXITCODE -ne 0) {
  throw "Failed to copy V3 evidence with exit code $LASTEXITCODE"
}

param(
  [string]$RunId = '20260724-v1-codex-app-server-candidate'
)

$ErrorActionPreference = 'Stop'

$distro = 'OPL-Validation-g0001'
$staging = '/mnt/c/Users/oplrunner/OnePersonLab/staging'
$wsl = Join-Path $env:SystemRoot 'System32\wsl.exe'

& $wsl --distribution $distro --user root --exec bash `
  "$staging/v1-run-linux-fixture.sh" `
  $RunId `
  "$staging/v1-codex-app-server.sh"
if ($LASTEXITCODE -ne 0) {
  throw "Codex App Server fixture failed with exit code $LASTEXITCODE"
}

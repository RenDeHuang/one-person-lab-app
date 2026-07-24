param(
  [string]$RunId = '20260724-v1-managed-g0004'
)

$ErrorActionPreference = 'Continue'

$distro = 'OPL-Validation-g0001'
$staging = 'C:\Users\oplrunner\OnePersonLab\staging'
$wsl = Join-Path $env:SystemRoot 'System32\wsl.exe'
$nodeArchive = '/mnt/c/Users/oplrunner/OnePersonLab/staging/node-v24.11.0-linux-x64.tar.gz'

& $wsl --distribution $distro --user root --exec bash `
  /mnt/c/Users/oplrunner/OnePersonLab/staging/v1-run-managed-resources.sh `
  $RunId `
  $nodeArchive
$exitCode = $LASTEXITCODE

exit $exitCode

$ErrorActionPreference = 'Continue'

$distro = 'OPL-Validation-g0001'
$wsl = Join-Path $env:SystemRoot 'System32\wsl.exe'

& $wsl --distribution $distro --user root --exec bash `
  /mnt/c/Users/oplrunner/OnePersonLab/staging/v1-run-linux-fixture.sh `
  20260724-v1-framework-state-g0001 `
  /mnt/c/Users/oplrunner/OnePersonLab/staging/v1-framework-state.sh

exit $LASTEXITCODE

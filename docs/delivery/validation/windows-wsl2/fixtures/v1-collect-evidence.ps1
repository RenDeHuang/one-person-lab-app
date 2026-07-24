$ErrorActionPreference = 'Stop'

$distro = 'OPL-Validation-g0001'
$guestRoot = '/opt/opl-validation/evidence'
$hostRoot = 'C:\Users\oplrunner\OnePersonLab\staging\evidence'
$wsl = Join-Path $env:SystemRoot 'System32\wsl.exe'

New-Item -ItemType Directory -Force -Path $hostRoot | Out-Null

$files = @(
  'provision.txt',
  'aioncore-health.json',
  'framework-provision.txt',
  'framework-state.txt',
  'managed-resources.txt',
  'codex-provision.txt',
  'codex-app-server.json',
  'restart-survivor.txt'
)

foreach ($file in $files) {
  $linuxPath = "$guestRoot/$file"
  & $wsl --distribution $distro --user root --exec test -f $linuxPath
  if ($LASTEXITCODE -eq 0) {
    & $wsl --distribution $distro --user root --exec cp `
      $linuxPath `
      "/mnt/c/Users/oplrunner/OnePersonLab/staging/evidence/$file"
    if ($LASTEXITCODE -ne 0) {
      throw "Failed to copy evidence file: $file"
    }
  }
}

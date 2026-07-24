$ErrorActionPreference = 'Stop'

$distro = 'OPL-Validation-g0001'
$output = 'C:\Users\oplrunner\OnePersonLab\staging\v1-guest-readback.txt'
$wsl = Join-Path $env:SystemRoot 'System32\wsl.exe'

$lines = [System.Collections.Generic.List[string]]::new()
$lines.Add("observed_at=$((Get-Date).ToString('o'))")
$lines.Add("windows_build=$([Environment]::OSVersion.Version)")
$lines.Add("wsl_version=$((& $wsl --version | Select-Object -First 1) -replace [char]0, '')")

$distributionLines = @(& $wsl --list --verbose) -replace [char]0, ''
$defaultLine = $distributionLines |
  Where-Object { $_ -match '^\s*\*' } |
  Select-Object -First 1
$lines.Add("wsl_default=$($defaultLine.Trim())")
$lines.Add('wsl_distributions_begin')
$lines.AddRange([string[]]$distributionLines)
$lines.Add('wsl_distributions_end')

$distroNames = @(& $wsl --list --quiet) -replace [char]0, ''
if ($distroNames.Trim() -notcontains $distro) {
  throw "Owned validation distribution is missing: $distro"
}

$linuxLines = @(
  & $wsl --distribution $distro --user root --exec bash `
    /mnt/c/Users/oplrunner/OnePersonLab/staging/v1-reconcile-managed-resources.sh
)
if ($LASTEXITCODE -ne 0) {
  throw "Linux readback failed with exit code $LASTEXITCODE"
}
$lines.Add('linux_readback_begin')
$lines.AddRange([string[]]$linuxLines)
$lines.Add('linux_readback_end')

$shutdownEvents = Get-WinEvent -FilterHashtable @{
  LogName = 'System'
  Id = 1074, 6006, 6008, 41
  StartTime = (Get-Date).AddHours(-12)
} -ErrorAction SilentlyContinue |
  Select-Object -First 12
$lines.Add('shutdown_events_begin')
foreach ($event in $shutdownEvents) {
  $classification = switch ($event.Id) {
    1074 { 'planned_shutdown' }
    6006 { 'event_log_stopped' }
    6008 { 'unexpected_shutdown' }
    41 { 'kernel_power' }
    default { 'other' }
  }
  $lines.Add(
    "$($event.TimeCreated.ToString('o')) id=$($event.Id) provider=$($event.ProviderName) classification=$classification"
  )
}
$lines.Add('shutdown_events_end')

$lines | Set-Content -Encoding utf8 $output

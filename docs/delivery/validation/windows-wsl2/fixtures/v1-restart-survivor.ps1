$ErrorActionPreference = 'Stop'

$distro = 'OPL-Validation-g0001'
$expectedDefault = 'docker-desktop'
$output = 'C:\Users\oplrunner\OnePersonLab\staging\evidence\restart-survivor.txt'
$wsl = Join-Path $env:SystemRoot 'System32\wsl.exe'

function Get-WslRows {
  return @(& $wsl --list --verbose) -replace [char]0, ''
}

function Get-DefaultName([string[]]$Rows) {
  $defaultRow = $Rows |
    Where-Object { $_ -match '^\s*\*' } |
    Select-Object -First 1
  if (-not $defaultRow) {
    throw 'WSL default distribution row is missing'
  }
  return (($defaultRow -replace '^\s*\*\s*', '') -split '\s{2,}')[0].Trim()
}

function Get-DistroState([string[]]$Rows, [string]$Name) {
  $row = $Rows |
    Where-Object { ($_ -replace '^\s*\*\s*', '').TrimStart().StartsWith($Name) } |
    Select-Object -First 1
  if (-not $row) {
    throw "WSL distribution row is missing: $Name"
  }
  $parts = ($row -replace '^\s*\*\s*', '').Trim() -split '\s{2,}'
  return $parts[1].Trim()
}

$beforeRows = Get-WslRows
$defaultBefore = Get-DefaultName $beforeRows
if ($defaultBefore -ne $expectedDefault) {
  throw "Unexpected default distribution before terminate: $defaultBefore"
}

& $wsl --terminate $distro
if ($LASTEXITCODE -ne 0) {
  throw "Failed to terminate validation distribution: $LASTEXITCODE"
}

$stoppedRows = Get-WslRows
$stateAfterTerminate = Get-DistroState $stoppedRows $distro
if ($stateAfterTerminate -ne 'Stopped') {
  throw "Validation distribution did not stop: $stateAfterTerminate"
}

$aioncorePids = @(
  & $wsl --distribution $distro --user root --exec pgrep -x aioncore
)
if ($LASTEXITCODE -notin @(0, 1)) {
  throw "Failed to inspect AionCore survivors: $LASTEXITCODE"
}
$codexPids = @(
  & $wsl --distribution $distro --user root --exec pgrep -x codex
)
if ($LASTEXITCODE -notin @(0, 1)) {
  throw "Failed to inspect Codex survivors: $LASTEXITCODE"
}
if ($aioncorePids.Count -ne 0 -or $codexPids.Count -ne 0) {
  throw 'Linux AionCore or Codex survivor detected after distribution restart'
}

$afterRows = Get-WslRows
$defaultAfter = Get-DefaultName $afterRows
$stateAfterRestart = Get-DistroState $afterRows $distro
if ($defaultAfter -ne $expectedDefault) {
  throw "Default distribution changed after restart: $defaultAfter"
}
if ($stateAfterRestart -ne 'Running') {
  throw "Validation distribution did not restart: $stateAfterRestart"
}

$nativeNames = @('aioncore.exe', 'codex.exe', 'opl.exe')
$nativeProcesses = @(
  Get-CimInstance Win32_Process |
    Where-Object { $nativeNames -contains $_.Name.ToLowerInvariant() }
)
if ($nativeProcesses.Count -ne 0) {
  throw 'Native Windows executor process detected'
}

$nativeCommands = @(
  foreach ($name in @('aioncore', 'codex', 'opl')) {
    Get-Command $name -ErrorAction SilentlyContinue
  }
)
if ($nativeCommands.Count -ne 0) {
  throw 'Native Windows executor command detected'
}

@(
  "observed_at=$((Get-Date).ToString('o'))"
  "default_before=$defaultBefore"
  "state_after_terminate=$stateAfterTerminate"
  "default_after=$defaultAfter"
  "state_after_restart=$stateAfterRestart"
  "aioncore_survivors=$($aioncorePids.Count)"
  "codex_survivors=$($codexPids.Count)"
  'native_executor_processes=0'
  'native_executor_commands=0'
  'cleanup=no_survivors'
) | Set-Content -Encoding utf8 $output

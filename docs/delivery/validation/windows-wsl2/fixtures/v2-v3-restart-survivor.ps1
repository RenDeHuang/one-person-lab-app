param(
  [string]$RunId = '20260724-v2-v3-g0020'
)

$ErrorActionPreference = 'Stop'

$distro = 'OPL-Validation-g0001'
$expectedDefault = 'docker-desktop'
$output = "C:\Users\oplrunner\OnePersonLab\staging\v2-v3\evidence\$RunId-restart-survivor.txt"
$wsl = Join-Path $env:SystemRoot 'System32\wsl.exe'

function Get-WslRows {
  return @(& $wsl --list --verbose) -replace [char]0, ''
}

function Get-DefaultName([string[]]$Rows) {
  $defaultRow = $Rows | Where-Object { $_ -match '^\s*\*' } | Select-Object -First 1
  if (-not $defaultRow) { throw 'WSL default distribution row is missing' }
  return (($defaultRow -replace '^\s*\*\s*', '') -split '\s{2,}')[0].Trim()
}

function Get-DistroState([string[]]$Rows, [string]$Name) {
  $row = $Rows |
    Where-Object {
      $normalized = ($_ -replace '^\s*\*\s*', '').Trim()
      $normalized -match "^$([regex]::Escape($Name))\s{2,}"
    } |
    Select-Object -First 1
  if (-not $row) { throw "WSL distribution row is missing: $Name" }
  $parts = ($row -replace '^\s*\*\s*', '').Trim() -split '\s{2,}'
  return $parts[1].Trim()
}

$beforeRows = Get-WslRows
$defaultBefore = Get-DefaultName $beforeRows
if ($defaultBefore -ne $expectedDefault) { throw "Unexpected default distribution: $defaultBefore" }

& $wsl --terminate $distro
if ($LASTEXITCODE -ne 0) { throw "Failed to terminate validation distribution: $LASTEXITCODE" }
$stoppedRows = Get-WslRows
$stateAfterTerminate = Get-DistroState $stoppedRows $distro
if ($stateAfterTerminate -ne 'Stopped') { throw "Validation distribution did not stop: $stateAfterTerminate" }

$aioncorePids = @(& $wsl --distribution $distro --user root --exec pgrep -x aioncore)
$aioncoreExit = $LASTEXITCODE
$codexPids = @(& $wsl --distribution $distro --user root --exec pgrep -x codex)
$codexExit = $LASTEXITCODE
if ($aioncoreExit -notin @(0, 1) -or $codexExit -notin @(0, 1)) {
  throw "Failed to inspect Linux survivors: aioncore=$aioncoreExit codex=$codexExit"
}

$afterRows = Get-WslRows
$defaultAfter = Get-DefaultName $afterRows
$stateAfterRestart = Get-DistroState $afterRows $distro
if ($defaultAfter -ne $expectedDefault) { throw "Default distribution changed: $defaultAfter" }
if ($stateAfterRestart -ne 'Running') { throw "Validation distribution did not restart: $stateAfterRestart" }

$nativeNames = @('aioncore.exe', 'codex.exe', 'opl.exe')
$nativeProcesses = @(
  Get-CimInstance Win32_Process |
    Where-Object { $nativeNames -contains $_.Name.ToLowerInvariant() }
)
$nativeCommands = @(
  foreach ($name in @('aioncore', 'codex', 'opl')) {
    Get-Command $name -ErrorAction SilentlyContinue
  }
)
if ($nativeProcesses.Count -ne 0 -or $nativeCommands.Count -ne 0) {
  throw 'Native Windows executor detected'
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
) | Set-Content -Encoding utf8 -LiteralPath $output

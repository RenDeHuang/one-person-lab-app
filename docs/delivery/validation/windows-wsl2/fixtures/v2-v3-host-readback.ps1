param(
  [string]$RunId = '20260724-v2-v3-g0001'
)

$ErrorActionPreference = 'Stop'

$distro = 'OPL-Validation-g0001'
$stagingRoot = 'C:\Users\oplrunner\OPLValidationStaging'
$evidenceRoot = Join-Path $stagingRoot 'evidence'
$output = Join-Path $evidenceRoot "$RunId-host-readback.json"
$wsl = Join-Path $env:SystemRoot 'System32\wsl.exe'

New-Item -ItemType Directory -Force -Path $evidenceRoot | Out-Null

function Get-WslRows {
  return @(& $wsl --list --verbose) -replace [char]0, ''
}

function Get-DefaultDistro([string[]]$Rows) {
  $row = $Rows | Where-Object { $_ -match '^\s*\*' } | Select-Object -First 1
  if (-not $row) {
    throw 'WSL default distribution row is missing'
  }
  return (($row -replace '^\s*\*\s*', '') -split '\s{2,}')[0].Trim()
}

function Get-DistroState([string[]]$Rows, [string]$Name) {
  $row = $Rows |
    Where-Object {
      $normalized = ($_ -replace '^\s*\*\s*', '').Trim()
      $normalized -match "^$([regex]::Escape($Name))\s{2,}"
    } |
    Select-Object -First 1
  if (-not $row) {
    return 'Absent'
  }
  $parts = ($row -replace '^\s*\*\s*', '').Trim() -split '\s{2,}'
  return $parts[1].Trim()
}

$rows = Get-WslRows
$defaultDistro = Get-DefaultDistro $rows
$validationState = Get-DistroState $rows $distro
$dockerState = Get-DistroState $rows 'docker-desktop'
$distroNames = @(& $wsl --list --quiet) -replace [char]0, '' |
  ForEach-Object { $_.Trim() } |
  Where-Object { $_ }

$wslVersionLine = ((& $wsl --version | Select-Object -First 1) -replace [char]0, '').Trim()
$networkingMode = 'default_or_unspecified'
$wslConfig = Join-Path $env:USERPROFILE '.wslconfig'
if (Test-Path -LiteralPath $wslConfig) {
  $networkLine = Get-Content -LiteralPath $wslConfig |
    Where-Object { $_ -match '^\s*networkingMode\s*=' } |
    Select-Object -Last 1
  if ($networkLine) {
    $networkingMode = ($networkLine -split '=', 2)[1].Trim()
  }
}

$dockerPresent = [bool](Get-Command docker.exe -ErrorAction SilentlyContinue)
$dockerServerReachable = $false
$dockerContainerCount = $null
$dockerImageCount = $null
if ($dockerPresent) {
  $savedErrorActionPreference = $ErrorActionPreference
  $ErrorActionPreference = 'SilentlyContinue'
  try {
    $containerIds = @(& docker.exe ps -a --quiet 2>$null)
    if ($LASTEXITCODE -eq 0) {
      $dockerServerReachable = $true
      $dockerContainerCount = $containerIds.Count
      $imageIds = @(& docker.exe image ls --quiet 2>$null | Sort-Object -Unique)
      if ($LASTEXITCODE -eq 0) {
        $dockerImageCount = $imageIds.Count
      }
    }
  } finally {
    $ErrorActionPreference = $savedErrorActionPreference
  }
}

$nativeNames = @('aioncore.exe', 'codex.exe', 'opl.exe')
$nativeExecutors = @(
  Get-CimInstance Win32_Process |
    Where-Object { $nativeNames -contains $_.Name.ToLowerInvariant() }
)

$payload = [ordered]@{
  observed_at = (Get-Date).ToString('o')
  run_id = $RunId
  windows_build = [Environment]::OSVersion.Version.ToString()
  wsl_version_line = $wslVersionLine
  wsl_default = $defaultDistro
  wsl_distributions = @($distroNames)
  validation_distro_state = $validationState
  docker_desktop_state = $dockerState
  networking_mode = $networkingMode
  preserved_webui_root_present = Test-Path -LiteralPath 'C:\Users\oplrunner\OnePersonLab'
  isolated_validation_staging_present = Test-Path -LiteralPath $stagingRoot
  docker_cli_present = $dockerPresent
  docker_server_reachable = $dockerServerReachable
  docker_container_count = $dockerContainerCount
  docker_image_count = $dockerImageCount
  native_executor_process_count = $nativeExecutors.Count
}

$payload | ConvertTo-Json -Depth 4 | Set-Content -Encoding utf8 -LiteralPath $output

param(
  [string]$RunId = 'manual',
  [string]$OutputPath = 'C:\Users\oplrunner\OnePersonLabValidation\webui-host-readback.json',
  [string]$InstallRoot = 'C:\Users\oplrunner\OnePersonLab',
  [string]$HealthUrl = 'http://localhost:3000/'
)

$ErrorActionPreference = 'Stop'

function Invoke-NativeCapture {
  param(
    [Parameter(Mandatory = $true)][string]$FilePath,
    [string[]]$Arguments = @()
  )

  $savedPreference = $ErrorActionPreference
  try {
    $ErrorActionPreference = 'Continue'
    $output = & $FilePath @Arguments 2>&1 | Out-String
    $exitCode = $LASTEXITCODE
  } finally {
    $ErrorActionPreference = $savedPreference
  }

  return [ordered]@{
    exit_code = $exitCode
    output = $output.Trim()
  }
}

function Get-DirectoryInventory {
  param([Parameter(Mandatory = $true)][string]$PathValue)

  if (-not (Test-Path -LiteralPath $PathValue)) {
    return [ordered]@{
      path = $PathValue
      exists = $false
      file_count = 0
      bytes = 0
    }
  }

  $files = @(Get-ChildItem -LiteralPath $PathValue -File -Recurse -Force -ErrorAction SilentlyContinue)
  $size = ($files | Measure-Object -Property Length -Sum).Sum
  if ($null -eq $size) {
    $size = 0
  }
  return [ordered]@{
    path = $PathValue
    exists = $true
    file_count = $files.Count
    bytes = [int64]$size
  }
}

function Get-FileSummary {
  param([Parameter(Mandatory = $true)][string]$PathValue)

  if (-not (Test-Path -LiteralPath $PathValue -PathType Leaf)) {
    return [ordered]@{
      path = $PathValue
      exists = $false
    }
  }

  $item = Get-Item -LiteralPath $PathValue
  return [ordered]@{
    path = $PathValue
    exists = $true
    bytes = $item.Length
    sha256 = (Get-FileHash -LiteralPath $PathValue -Algorithm SHA256).Hash.ToLowerInvariant()
    modified_at = $item.LastWriteTime.ToString('o')
  }
}

function Get-ServiceSummary {
  param([Parameter(Mandatory = $true)][string]$Name)

  $service = Get-CimInstance Win32_Service -Filter "Name='$Name'" -ErrorAction SilentlyContinue
  if ($null -eq $service) {
    return [ordered]@{
      name = $Name
      exists = $false
    }
  }
  return [ordered]@{
    name = $service.Name
    exists = $true
    state = $service.State
    start_mode = $service.StartMode
    process_id = $service.ProcessId
  }
}

function Get-ProcessSummary {
  param([Parameter(Mandatory = $true)][string[]]$Names)

  return @(
    Get-Process -ErrorAction SilentlyContinue |
      Where-Object { $Names -contains $_.ProcessName } |
      Select-Object ProcessName, Id, CPU, WorkingSet64, StartTime
  )
}

function Get-HttpSummary {
  param([Parameter(Mandatory = $true)][string]$Url)

  try {
    $response = Invoke-WebRequest -UseBasicParsing -Uri $Url -Method Get -TimeoutSec 10
    return [ordered]@{
      url = $Url
      reachable = $true
      status_code = [int]$response.StatusCode
      content_length = $response.RawContentLength
    }
  } catch {
    return [ordered]@{
      url = $Url
      reachable = $false
      error = $_.Exception.Message
    }
  }
}

$outputDirectory = Split-Path -Parent $OutputPath
New-Item -ItemType Directory -Force -Path $outputDirectory | Out-Null

$os = Get-CimInstance Win32_OperatingSystem
$systemDrive = Get-CimInstance Win32_LogicalDisk -Filter "DeviceID='C:'"
$composePath = Join-Path $InstallRoot 'compose.yaml'
$dataPath = Join-Path $InstallRoot 'data'
$projectsPath = Join-Path $InstallRoot 'projects'
$updaterPath = Join-Path $InstallRoot 'updater\update-webui.ps1'
$updaterLogPath = Join-Path $InstallRoot 'updater\logs\current.log'

$dockerCommand = Get-Command docker.exe -ErrorAction SilentlyContinue
$docker = [ordered]@{
  cli_present = $null -ne $dockerCommand
}
if ($null -ne $dockerCommand) {
  $docker.cli_version = Invoke-NativeCapture -FilePath $dockerCommand.Source -Arguments @('--version')
  $docker.server_version = Invoke-NativeCapture -FilePath $dockerCommand.Source -Arguments @('info', '--format', '{{.ServerVersion}}')
  $docker.compose_version = Invoke-NativeCapture -FilePath $dockerCommand.Source -Arguments @('compose', 'version')
  $docker.containers = Invoke-NativeCapture -FilePath $dockerCommand.Source -Arguments @(
    'ps', '-a', '--format', '{{json .}}'
  )
  $docker.images = Invoke-NativeCapture -FilePath $dockerCommand.Source -Arguments @(
    'image', 'ls', '--digests', '--format', '{{json .}}'
  )
  $docker.webui_images = Invoke-NativeCapture -FilePath $dockerCommand.Source -Arguments @(
    'image', 'inspect', 'ghcr.io/gaofeng21cn/one-person-lab-webui:latest',
    '--format', '{{json .RepoDigests}}'
  )
  if (Test-Path -LiteralPath $composePath -PathType Leaf) {
    $docker.compose_ps = Invoke-NativeCapture -FilePath $dockerCommand.Source -Arguments @(
      'compose', '-f', $composePath, 'ps', '--format', 'json'
    )
    $docker.compose_config_images = Invoke-NativeCapture -FilePath $dockerCommand.Source -Arguments @(
      'compose', '-f', $composePath, 'config', '--images'
    )
  }
}

$wslCommand = Join-Path $env:SystemRoot 'System32\wsl.exe'
$wsl = [ordered]@{
  present = Test-Path -LiteralPath $wslCommand -PathType Leaf
}
if ($wsl.present) {
  $wsl.version = Invoke-NativeCapture -FilePath $wslCommand -Arguments @('--version')
  $wsl.status = Invoke-NativeCapture -FilePath $wslCommand -Arguments @('--status')
  $wsl.distributions = Invoke-NativeCapture -FilePath $wslCommand -Arguments @('--list', '--verbose')
}

$taskName = 'One Person Lab WebUI Latest Update'
$scheduledTask = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
$taskSummary = [ordered]@{
  name = $taskName
  exists = $null -ne $scheduledTask
}
if ($null -ne $scheduledTask) {
  $taskInfo = $scheduledTask | Get-ScheduledTaskInfo
  $taskSummary.state = $scheduledTask.State.ToString()
  $taskSummary.last_run_time = $taskInfo.LastRunTime.ToString('o')
  $taskSummary.last_task_result = $taskInfo.LastTaskResult
  $taskSummary.next_run_time = $taskInfo.NextRunTime.ToString('o')
  $taskSummary.actions = @($scheduledTask.Actions | Select-Object Execute, Arguments, WorkingDirectory)
  $taskSummary.triggers = @($scheduledTask.Triggers | Select-Object Enabled, StartBoundary)
  $taskSummary.principal = $scheduledTask.Principal | Select-Object UserId, LogonType, RunLevel
}

$payload = [ordered]@{
  schema = 'opl_windows_docker_webui_host_readback.v1'
  observed_at = (Get-Date).ToString('o')
  run_id = $RunId
  computer_name = $env:COMPUTERNAME
  current_user = [Security.Principal.WindowsIdentity]::GetCurrent().Name
  windows = [ordered]@{
    caption = $os.Caption
    version = $os.Version
    build_number = $os.BuildNumber
    last_boot_time = $os.LastBootUpTime.ToString('o')
  }
  system_drive = [ordered]@{
    device_id = $systemDrive.DeviceID
    bytes_total = [int64]$systemDrive.Size
    bytes_free = [int64]$systemDrive.FreeSpace
  }
  docker_desktop = [ordered]@{
    service = Get-ServiceSummary -Name 'com.docker.service'
    processes = Get-ProcessSummary -Names @('Docker Desktop', 'com.docker.backend', 'com.docker.build')
  }
  wsl = $wsl
  docker = $docker
  install = [ordered]@{
    root = Get-DirectoryInventory -PathValue $InstallRoot
    data = Get-DirectoryInventory -PathValue $dataPath
    projects = Get-DirectoryInventory -PathValue $projectsPath
    compose = Get-FileSummary -PathValue $composePath
    updater = Get-FileSummary -PathValue $updaterPath
    updater_current_log = Get-FileSummary -PathValue $updaterLogPath
  }
  automatic_update = $taskSummary
  health = Get-HttpSummary -Url $HealthUrl
}

$payload | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $OutputPath -Encoding UTF8
Write-Output $OutputPath

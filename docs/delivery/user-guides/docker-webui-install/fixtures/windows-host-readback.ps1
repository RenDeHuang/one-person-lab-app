param(
  [string]$RunId = 'manual',
  [string]$OutputPath = 'C:\Users\oplrunner\OnePersonLabValidation\webui-host-readback.json',
  [string]$InstallRoot = 'C:\Users\oplrunner\OnePersonLab',
  [string]$HealthUrl = 'http://localhost:3000/',
  [ValidateRange(1, 300)][int]$NativeCommandTimeoutSeconds = 30,
  [ValidateRange(1, 300)][int]$InventoryTimeoutSeconds = 30
)

$ErrorActionPreference = 'Stop'

function Convert-ToPowerShellSingleQuotedLiteral {
  param([Parameter(Mandatory = $true)][string]$Value)

  return "'" + ($Value -replace "'", "''") + "'"
}

function Invoke-NativeCapture {
  param(
    [Parameter(Mandatory = $true)][string]$FilePath,
    [string[]]$Arguments = @(),
    [ValidateRange(1, 300)][int]$TimeoutSeconds = $NativeCommandTimeoutSeconds
  )

  $temporaryDir = Join-Path ([System.IO.Path]::GetTempPath()) ("opl-host-readback-" + [Guid]::NewGuid().ToString('N'))
  $wrapperPath = Join-Path $temporaryDir 'invoke-native.ps1'
  $outputPath = Join-Path $temporaryDir 'output.txt'
  $argumentLiterals = @($Arguments | ForEach-Object { Convert-ToPowerShellSingleQuotedLiteral -Value $_ })
  $wrapper = @"
`$ErrorActionPreference = 'Continue'
`$nativeFile = $(Convert-ToPowerShellSingleQuotedLiteral -Value $FilePath)
`$nativeArguments = @($($argumentLiterals -join ', '))
`$output = & `$nativeFile @nativeArguments 2>&1 | Out-String
`$exitCode = `$LASTEXITCODE
Set-Content -LiteralPath $(Convert-ToPowerShellSingleQuotedLiteral -Value $outputPath) -Value `$output -Encoding UTF8
exit `$exitCode
"@

  try {
    New-Item -ItemType Directory -Force -Path $temporaryDir | Out-Null
    Set-Content -LiteralPath $wrapperPath -Value $wrapper -Encoding UTF8
    $powershell = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
    $process = Start-Process `
      -FilePath $powershell `
      -ArgumentList @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', ('"' + $wrapperPath + '"')) `
      -WindowStyle Hidden `
      -PassThru

    if (-not $process.WaitForExit($TimeoutSeconds * 1000)) {
      & taskkill.exe /PID $process.Id /T /F 2>&1 | Out-Null
      $killDeadline = (Get-Date).AddSeconds(5)
      while (-not $process.HasExited -and (Get-Date) -lt $killDeadline) {
        Start-Sleep -Milliseconds 100
        $process.Refresh()
      }
      if (-not $process.HasExited) {
        Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
      }
      $output = if (Test-Path -LiteralPath $outputPath -PathType Leaf) {
        Get-Content -LiteralPath $outputPath -Raw
      } else {
        ''
      }
      if ($null -eq $output) { $output = '' }
      return [ordered]@{
        exit_code = 124
        output = $output.Trim()
        timed_out = $true
        timeout_seconds = $TimeoutSeconds
      }
    }

    $output = if (Test-Path -LiteralPath $outputPath -PathType Leaf) {
      Get-Content -LiteralPath $outputPath -Raw
    } else {
      ''
    }
    if ($null -eq $output) { $output = '' }
    return [ordered]@{
      exit_code = $process.ExitCode
      output = $output.Trim()
      timed_out = $false
      timeout_seconds = $TimeoutSeconds
    }
  } finally {
    Remove-Item -LiteralPath $temporaryDir -Force -Recurse -ErrorAction SilentlyContinue
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

  $deadline = [DateTime]::UtcNow.AddSeconds($InventoryTimeoutSeconds)
  $fileCount = 0
  $size = [int64]0
  $timedOut = $false
  $errorMessage = $null
  try {
    foreach ($filePath in [System.IO.Directory]::EnumerateFiles($PathValue, '*', [System.IO.SearchOption]::AllDirectories)) {
      if ([DateTime]::UtcNow -ge $deadline) {
        $timedOut = $true
        break
      }
      try {
        $file = [System.IO.FileInfo]::new($filePath)
        $fileCount += 1
        $size += $file.Length
      } catch {
        continue
      }
    }
  } catch {
    $errorMessage = $_.Exception.Message
  }
  return [ordered]@{
    path = $PathValue
    exists = $true
    file_count = $fileCount
    bytes = [int64]$size
    timed_out = $timedOut
    timeout_seconds = $InventoryTimeoutSeconds
    error = $errorMessage
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
  $docker.cli_version = Invoke-NativeCapture -FilePath $dockerCommand.Source -Arguments @('--version') -TimeoutSeconds 10
  $docker.compose_version = Invoke-NativeCapture -FilePath $dockerCommand.Source -Arguments @('compose', 'version') -TimeoutSeconds 10
  $docker.server_version = Invoke-NativeCapture -FilePath $dockerCommand.Source -Arguments @('info', '--format', '{{.ServerVersion}}')
  $docker.daemon_available = $docker.server_version.exit_code -eq 0
  if ($docker.daemon_available) {
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
  } else {
    $docker.breakpoint = [ordered]@{
      code = if ($docker.server_version.timed_out) { 'docker_daemon_probe_timed_out' } else { 'docker_daemon_unavailable' }
      operation_stopped = $true
      objective_status = 'repair_required'
      resume_after = 'repair Docker Desktop, then rerun this readback'
    }
    $docker.skipped_after_breakpoint = @(
      'containers',
      'images',
      'webui_images',
      'compose_ps',
      'compose_config_images'
    )
  }
}

$wslCommand = Join-Path $env:SystemRoot 'System32\wsl.exe'
$wsl = [ordered]@{
  present = Test-Path -LiteralPath $wslCommand -PathType Leaf
}
if ($wsl.present) {
  $wsl.version = Invoke-NativeCapture -FilePath $wslCommand -Arguments @('--version') -TimeoutSeconds 10
  $wsl.status = Invoke-NativeCapture -FilePath $wslCommand -Arguments @('--status')
  if ($wsl.status.exit_code -eq 0) {
    $wsl.distributions = Invoke-NativeCapture -FilePath $wslCommand -Arguments @('--list', '--verbose')
  } else {
    $wsl.skipped_after_breakpoint = @('distributions')
  }
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

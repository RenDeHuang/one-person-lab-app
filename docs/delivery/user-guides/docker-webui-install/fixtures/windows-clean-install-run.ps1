param(
  [string]$RunId = 'manual',
  [string]$InstallRoot = 'C:\Users\oplrunner\OnePersonLab',
  [string]$ValidationRoot = 'C:\Users\oplrunner\OnePersonLabValidation',
  [string]$InstallerSourcePath,
  [ValidateRange(5, 60)][int]$WorkerTimeoutMinutes = 55,
  [ValidateRange(1, 64)][int]$MinimumSystemDriveFreeGiB = 5,
  [ValidateRange(1, 60)][int]$SupervisorPollSeconds = 5,
  [switch]$CollectEvidence,
  [switch]$InteractiveWorker
)

$ErrorActionPreference = 'Stop'
$backupRoot = "$InstallRoot.before-$RunId"
$runRoot = Join-Path $ValidationRoot $RunId
$runnerErrorPath = Join-Path $runRoot 'runner-error.txt'
trap {
  New-Item -ItemType Directory -Force -Path $runRoot | Out-Null
  ($_ | Out-String) | Set-Content -LiteralPath $runnerErrorPath -Encoding UTF8
  exit 1
}
$installerPath = Join-Path $runRoot 'install-docker-webui.ps1'
$transcriptPath = Join-Path $runRoot 'clean-install-transcript.txt'
$installerStdoutPath = Join-Path $runRoot 'installer-stdout.txt'
$installerStderrPath = Join-Path $runRoot 'installer-stderr.txt'
$workerPath = Join-Path $runRoot 'interactive-worker.ps1'
$workerResultPath = Join-Path $runRoot 'interactive-worker-result.json'
$previousWorkerResultPath = Join-Path $runRoot 'interactive-worker-result.previous.json'
$previousRuntimeDownMarkerPath = Join-Path $runRoot 'previous-runtime-down.txt'
$validationDockerConfig = Join-Path $runRoot 'docker-config'
$validationTaskName = "One Person Lab WebUI Validation $RunId"
$supervisorBreakpointPath = Join-Path $runRoot 'supervisor-breakpoint.json'
$minimumSystemDriveFreeBytes = [int64]$MinimumSystemDriveFreeGiB * 1GB

New-Item -ItemType Directory -Force -Path $runRoot | Out-Null

function Convert-ToPowerShellSingleQuotedLiteral {
  param([Parameter(Mandatory = $true)][string]$Value)

  return "'" + ($Value -replace "'", "''") + "'"
}

function Invoke-NativeCommandWithTimeout {
  param(
    [Parameter(Mandatory = $true)][string]$FilePath,
    [Parameter(Mandatory = $true)][string[]]$Arguments,
    [ValidateRange(1, 300)][int]$TimeoutSeconds = 120
  )

  $temporaryDir = Join-Path ([System.IO.Path]::GetTempPath()) ("opl-validation-command-" + [Guid]::NewGuid().ToString('N'))
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
      return [ordered]@{ exit_code = 124; timed_out = $true; output = '' }
    }
    $output = if (Test-Path -LiteralPath $outputPath -PathType Leaf) {
      Get-Content -LiteralPath $outputPath -Raw
    } else {
      ''
    }
    if ($null -eq $output) { $output = '' }
    return [ordered]@{ exit_code = $process.ExitCode; timed_out = $false; output = $output.Trim() }
  } finally {
    Remove-Item -LiteralPath $temporaryDir -Force -Recurse -ErrorAction SilentlyContinue
  }
}

function Write-SupervisorBreakpoint {
  param(
    [Parameter(Mandatory = $true)][string]$Code,
    [Parameter(Mandatory = $true)][string]$FailedOperation,
    [Parameter(Mandatory = $true)][string]$RepairAction,
    [Nullable[int64]]$SystemDriveFreeBytes = $null
  )

  [ordered]@{
    schema = 'opl_windows_docker_webui_validation_breakpoint.v1'
    observed_at = (Get-Date).ToString('o')
    run_id = $RunId
    code = $Code
    operation_status = 'stopped'
    objective_status = 'repair_required'
    failed_operation = $FailedOperation
    repair_action = $RepairAction
    resume_run_id = $RunId
    system_drive_free_bytes = $SystemDriveFreeBytes
    minimum_system_drive_free_bytes = $minimumSystemDriveFreeBytes
  } | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $supervisorBreakpointPath -Encoding UTF8
}

function Stop-ValidationWorkerOperation {
  $task = Get-ScheduledTask -TaskName $validationTaskName -ErrorAction SilentlyContinue
  if ($null -ne $task -and $task.State.ToString() -eq 'Running') {
    Stop-ScheduledTask -TaskName $validationTaskName -ErrorAction SilentlyContinue
  }

  $workerPattern = [Regex]::Escape($workerPath)
  $workerProcesses = @(
    Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
      Where-Object { -not [string]::IsNullOrWhiteSpace($_.CommandLine) -and $_.CommandLine -match $workerPattern }
  )
  foreach ($workerProcess in $workerProcesses) {
    & taskkill.exe /PID $workerProcess.ProcessId /T /F 2>&1 | Out-Null
  }
}

function Remove-ValidationTaskIfStopped {
  $task = Get-ScheduledTask -TaskName $validationTaskName -ErrorAction SilentlyContinue
  if ($null -ne $task -and $task.State.ToString() -ne 'Running') {
    Unregister-ScheduledTask -TaskName $validationTaskName -Confirm:$false
  }
}

function Wait-ValidationTaskStopped {
  param([ValidateRange(1, 60)][int]$TimeoutSeconds = 30)

  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  while ((Get-Date) -lt $deadline) {
    $task = Get-ScheduledTask -TaskName $validationTaskName -ErrorAction SilentlyContinue
    if ($null -eq $task -or $task.State.ToString() -ne 'Running') {
      return $true
    }
    Start-Sleep -Milliseconds 500
  }
  return $false
}

if ([string]::IsNullOrWhiteSpace($InstallerSourcePath)) {
  Invoke-WebRequest `
    -UseBasicParsing `
    -Uri 'https://github.com/gaofeng21cn/one-person-lab-app/releases/latest/download/install-docker-webui.ps1' `
    -OutFile $installerPath
} else {
  $sourceFullPath = [System.IO.Path]::GetFullPath($InstallerSourcePath)
  $destinationFullPath = [System.IO.Path]::GetFullPath($installerPath)
  if (-not $sourceFullPath.Equals($destinationFullPath, [System.StringComparison]::OrdinalIgnoreCase)) {
    Copy-Item -LiteralPath $InstallerSourcePath -Destination $installerPath -Force
  }
}

if (-not $InteractiveWorker) {
  if (Test-Path -LiteralPath $workerResultPath -PathType Leaf) {
    Move-Item -LiteralPath $workerResultPath -Destination $previousWorkerResultPath -Force
  }
  $workerContent = @"
& '$($MyInvocation.MyCommand.Path)' -RunId '$RunId' -InstallRoot '$InstallRoot' -ValidationRoot '$ValidationRoot' -InstallerSourcePath '$installerPath' -WorkerTimeoutMinutes $WorkerTimeoutMinutes -MinimumSystemDriveFreeGiB $MinimumSystemDriveFreeGiB -SupervisorPollSeconds $SupervisorPollSeconds$(if ($CollectEvidence) { ' -CollectEvidence' } else { '' }) -InteractiveWorker
"@
  Set-Content -LiteralPath $workerPath -Value $workerContent -Encoding UTF8
  $powershell = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
  $action = New-ScheduledTaskAction `
    -Execute $powershell `
    -Argument ('-NoProfile -ExecutionPolicy Bypass -File "' + $workerPath + '"')
  $principal = New-ScheduledTaskPrincipal `
    -UserId ([Security.Principal.WindowsIdentity]::GetCurrent().Name) `
    -LogonType Interactive `
    -RunLevel Limited
  $settings = New-ScheduledTaskSettingsSet `
    -MultipleInstances IgnoreNew `
    -ExecutionTimeLimit (New-TimeSpan -Minutes ($WorkerTimeoutMinutes + 5))
  Register-ScheduledTask `
    -TaskName $validationTaskName `
    -Action $action `
    -Principal $principal `
    -Settings $settings `
    -Description 'Temporary interactive validation task for the public OPL WebUI installer.' `
    -Force | Out-Null
  Start-ScheduledTask -TaskName $validationTaskName

  $deadline = (Get-Date).AddMinutes($WorkerTimeoutMinutes)
  try {
    while ((Get-Date) -lt $deadline) {
      if (Test-Path -LiteralPath $workerResultPath -PathType Leaf) {
        $workerResult = Get-Content -LiteralPath $workerResultPath -Raw | ConvertFrom-Json
        if ($workerResult.exit_code -ne 0) {
          $workerStopped = Wait-ValidationTaskStopped -TimeoutSeconds 30
          if (-not $workerStopped) {
            Stop-ValidationWorkerOperation
            Wait-ValidationTaskStopped -TimeoutSeconds 10 | Out-Null
          }
          Write-SupervisorBreakpoint `
            -Code 'installer_worker_failed' `
            -FailedOperation $workerResult.phase `
            -RepairAction 'Read runner-error.txt and the bounded host readback, repair the first reported issue, then resume with the same RunId.'
          throw "The current installer operation stopped with code $($workerResult.exit_code); the validation objective remains open. Repair phase '$($workerResult.phase)' and resume RunId '$RunId'."
        }
        $taskStopped = Wait-ValidationTaskStopped -TimeoutSeconds 30
        $task = Get-ScheduledTask -TaskName $validationTaskName -ErrorAction SilentlyContinue
        if (-not $taskStopped -and $null -ne $task -and $task.State.ToString() -eq 'Running') {
          Write-SupervisorBreakpoint `
            -Code 'worker_did_not_exit_after_result' `
            -FailedOperation 'worker_finalization' `
            -RepairAction 'Inspect the run directory, stop only the validation worker tree, and resume the same RunId after preserving its result.'
          Stop-ValidationWorkerOperation
          throw "The worker wrote a result but did not exit within 30 seconds; the current operation was stopped and RunId '$RunId' remains resumable."
        }
        Write-Output $runRoot
        exit 0
      }

      $systemDrive = Get-CimInstance Win32_LogicalDisk -Filter "DeviceID='C:'"
      if ($null -ne $systemDrive -and [int64]$systemDrive.FreeSpace -lt $minimumSystemDriveFreeBytes) {
        Write-SupervisorBreakpoint `
          -Code 'system_drive_free_below_floor' `
          -FailedOperation 'interactive_installer_worker' `
          -RepairAction 'Free only unreferenced validation artifacts or expand the VM disk, then resume the same RunId.' `
          -SystemDriveFreeBytes ([int64]$systemDrive.FreeSpace)
        Stop-ValidationWorkerOperation
        throw "The current installer operation was stopped because C: fell below ${MinimumSystemDriveFreeGiB} GiB free. The validation objective remains open; repair storage and resume RunId '$RunId'."
      }
      Start-Sleep -Seconds $SupervisorPollSeconds
    }
    Write-SupervisorBreakpoint `
      -Code 'interactive_worker_timeout' `
      -FailedOperation 'interactive_installer_worker' `
      -RepairAction 'Inspect the bounded readback and installer logs, repair the first reported issue, then resume the same RunId.'
    Stop-ValidationWorkerOperation
    throw "The current installer operation exceeded ${WorkerTimeoutMinutes} minutes and was stopped. The validation objective remains open; repair the first breakpoint and resume RunId '$RunId'."
  } finally {
    Wait-ValidationTaskStopped -TimeoutSeconds 10 | Out-Null
    Remove-ValidationTaskIfStopped
  }
}

$exitCode = 1
$previousRuntimeDown = $false
$installRootMoved = $false
$phase = 'preflight'
try {
  Remove-Item -LiteralPath $workerResultPath, $installerStdoutPath, $installerStderrPath, $transcriptPath, $runnerErrorPath -Force -ErrorAction SilentlyContinue
  New-Item -ItemType Directory -Force -Path $validationDockerConfig | Out-Null
  Set-Content -LiteralPath (Join-Path $validationDockerConfig 'config.json') -Value '{}' -Encoding ASCII
  $env:DOCKER_CONFIG = $validationDockerConfig
  Start-Transcript -LiteralPath $transcriptPath -Force | Out-Null
  $systemDrive = Get-CimInstance Win32_LogicalDisk -Filter "DeviceID='C:'"
  if ($null -ne $systemDrive -and [int64]$systemDrive.FreeSpace -lt $minimumSystemDriveFreeBytes) {
    throw "C: has less than ${MinimumSystemDriveFreeGiB} GiB free; repair storage before the clean-install operation."
  }
  if (Test-Path -LiteralPath $backupRoot) {
    if (Test-Path -LiteralPath $InstallRoot) {
      if (-not (Test-Path -LiteralPath $previousRuntimeDownMarkerPath -PathType Leaf) -or -not (Test-Path -LiteralPath $previousWorkerResultPath -PathType Leaf)) {
        throw "Both the install and rollback directories exist without a resumable validation checkpoint; refusing an ambiguous clean-install retry."
      }
      $previousWorkerResult = Get-Content -LiteralPath $previousWorkerResultPath -Raw | ConvertFrom-Json
      if ($previousWorkerResult.run_id -ne $RunId -or $previousWorkerResult.objective_status -ne 'repair_required') {
        throw "Both the install and rollback directories exist, but the previous checkpoint does not authorize this RunId to resume."
      }
      $previousRuntimeDown = $true
      $installRootMoved = $true
      $phase = 'resume_existing_install'
      Write-Output "Resuming the same clean-install RunId after a bounded repair checkpoint."
    }
    elseif (-not (Test-Path -LiteralPath $previousRuntimeDownMarkerPath -PathType Leaf)) {
      throw "The rollback directory exists without a previous-runtime-down marker; refusing an ambiguous clean-install retry."
    }
    else {
      $previousRuntimeDown = $true
      $installRootMoved = $true
    }
  } elseif (Test-Path -LiteralPath $InstallRoot) {
    $previousComposePath = Join-Path $InstallRoot 'compose.yaml'
    if (Test-Path -LiteralPath $previousComposePath -PathType Leaf) {
      $phase = 'previous_compose_down'
      Write-Output "Removing the previous Compose project before the clean-install run."
      $dockerCommand = Get-Command docker.exe -ErrorAction Stop
      $downResult = Invoke-NativeCommandWithTimeout `
        -FilePath $dockerCommand.Source `
        -Arguments @('compose', '--project-directory', $InstallRoot, '-f', $previousComposePath, 'down', '--remove-orphans') `
        -TimeoutSeconds 120
      if ($downResult.timed_out) {
        throw "The previous Compose down operation exceeded 120 seconds and its process tree was stopped; repair Docker Desktop, then resume this RunId."
      }
      if ($downResult.exit_code -ne 0) {
        throw "Failed to remove the previous Compose project; repair Docker Desktop and resume this RunId. Details: $($downResult.output)"
      }
      $previousRuntimeDown = $true
      Set-Content -LiteralPath $previousRuntimeDownMarkerPath -Value 'true' -Encoding ASCII
    }
    else {
      Set-Content -LiteralPath $previousRuntimeDownMarkerPath -Value 'not_applicable' -Encoding ASCII
    }
    Move-Item -LiteralPath $InstallRoot -Destination $backupRoot
    $installRootMoved = $true
  }
  $phase = 'public_installer'
  $installerArguments = @{
    EnableAutoUpdate = $true
    Yes = $true
    NoOpen = $true
  }
  if ($CollectEvidence) {
    $installerArguments.EvidenceDir = Join-Path $runRoot 'evidence'
  }
  & $installerPath @installerArguments
  $exitCode = 0
} finally {
  Stop-Transcript | Out-Null
  [ordered]@{
    schema = 'opl_windows_docker_webui_interactive_worker_result.v1'
    completed_at = (Get-Date).ToString('o')
    run_id = $RunId
    exit_code = $exitCode
    phase = $phase
    operation_status = if ($exitCode -eq 0) { 'completed' } else { 'stopped' }
    objective_status = if ($exitCode -eq 0) { 'completed' } else { 'repair_required' }
    resume_run_id = $RunId
  } | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $workerResultPath -Encoding UTF8
}

[ordered]@{
  schema = 'opl_windows_docker_webui_clean_install_run.v1'
  completed_at = (Get-Date).ToString('o')
  run_id = $RunId
  rollback_root = $backupRoot
  install_root = $InstallRoot
  previous_runtime_down = $previousRuntimeDown
  install_root_moved = $installRootMoved
  previous_runtime_down_marker = $previousRuntimeDownMarkerPath
  installer_sha256 = (Get-FileHash -LiteralPath $installerPath -Algorithm SHA256).Hash.ToLowerInvariant()
  transcript = $transcriptPath
  installer_stdout = $installerStdoutPath
  installer_stderr = $installerStderrPath
} | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath (Join-Path $runRoot 'clean-install-run.json') -Encoding UTF8

Write-Output $runRoot

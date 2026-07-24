param(
  [string]$RunId = 'manual',
  [string]$InstallRoot = 'C:\Users\oplrunner\OnePersonLab',
  [string]$ValidationRoot = 'C:\Users\oplrunner\OnePersonLabValidation',
  [string]$InstallerSourcePath,
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
$previousRuntimeDownMarkerPath = Join-Path $runRoot 'previous-runtime-down.txt'
$validationDockerConfig = Join-Path $runRoot 'docker-config'
$validationTaskName = "One Person Lab WebUI Validation $RunId"

New-Item -ItemType Directory -Force -Path $runRoot | Out-Null

if ([string]::IsNullOrWhiteSpace($InstallerSourcePath)) {
  Invoke-WebRequest `
    -UseBasicParsing `
    -Uri 'https://raw.githubusercontent.com/gaofeng21cn/one-person-lab-app/main/scripts/install-docker-webui.ps1' `
    -OutFile $installerPath
} else {
  $sourceFullPath = [System.IO.Path]::GetFullPath($InstallerSourcePath)
  $destinationFullPath = [System.IO.Path]::GetFullPath($installerPath)
  if (-not $sourceFullPath.Equals($destinationFullPath, [System.StringComparison]::OrdinalIgnoreCase)) {
    Copy-Item -LiteralPath $InstallerSourcePath -Destination $installerPath -Force
  }
}

if (-not $InteractiveWorker) {
  $workerContent = @"
& '$($MyInvocation.MyCommand.Path)' -RunId '$RunId' -InstallRoot '$InstallRoot' -ValidationRoot '$ValidationRoot' -InstallerSourcePath '$installerPath'$(if ($CollectEvidence) { ' -CollectEvidence' } else { '' }) -InteractiveWorker
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
    -ExecutionTimeLimit (New-TimeSpan -Minutes 45)
  Register-ScheduledTask `
    -TaskName $validationTaskName `
    -Action $action `
    -Principal $principal `
    -Settings $settings `
    -Description 'Temporary interactive validation task for the public OPL WebUI installer.' `
    -Force | Out-Null
  Start-ScheduledTask -TaskName $validationTaskName

  $deadline = (Get-Date).AddMinutes(40)
  while ((Get-Date) -lt $deadline) {
    if (Test-Path -LiteralPath $workerResultPath -PathType Leaf) {
      $workerResult = Get-Content -LiteralPath $workerResultPath -Raw | ConvertFrom-Json
      if ($workerResult.exit_code -ne 0) {
        throw "The interactive public installer worker exited with code $($workerResult.exit_code)."
      }
      Write-Output $runRoot
      exit 0
    }
    Start-Sleep -Seconds 2
  }
  throw "Timed out waiting for the interactive public installer worker."
}

$exitCode = 1
$previousRuntimeDown = $false
$installRootMoved = $false
try {
  Remove-Item -LiteralPath $workerResultPath, $installerStdoutPath, $installerStderrPath, $transcriptPath, $runnerErrorPath -Force -ErrorAction SilentlyContinue
  New-Item -ItemType Directory -Force -Path $validationDockerConfig | Out-Null
  Set-Content -LiteralPath (Join-Path $validationDockerConfig 'config.json') -Value '{}' -Encoding ASCII
  $env:DOCKER_CONFIG = $validationDockerConfig
  Start-Transcript -LiteralPath $transcriptPath -Force | Out-Null
  if (Test-Path -LiteralPath $backupRoot) {
    if (Test-Path -LiteralPath $InstallRoot) {
      throw "Both the install and rollback directories exist; refusing an ambiguous clean-install retry."
    }
    if (-not (Test-Path -LiteralPath $previousRuntimeDownMarkerPath -PathType Leaf)) {
      throw "The rollback directory exists without a previous-runtime-down marker; refusing an ambiguous clean-install retry."
    }
    $previousRuntimeDown = $true
  } elseif (Test-Path -LiteralPath $InstallRoot) {
    $previousComposePath = Join-Path $InstallRoot 'compose.yaml'
    if (Test-Path -LiteralPath $previousComposePath -PathType Leaf) {
      Write-Output "Removing the previous Compose project before the clean-install run."
      & docker.exe compose `
        --project-directory $InstallRoot `
        -f $previousComposePath `
        down --remove-orphans
      if ($LASTEXITCODE -ne 0) {
        throw "Failed to remove the previous Compose project; clean-install validation would otherwise be ambiguous."
      }
      $previousRuntimeDown = $true
      Set-Content -LiteralPath $previousRuntimeDownMarkerPath -Value 'true' -Encoding ASCII
    }
    Move-Item -LiteralPath $InstallRoot -Destination $backupRoot
    $installRootMoved = $true
  }
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

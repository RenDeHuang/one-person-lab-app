# One Person Lab Docker/WebUI Windows installer.
# Prepares local folders, writes compose.yaml, and starts the WebUI image.

[CmdletBinding()]
param(
  [switch]$DryRun,
  [switch]$Yes,
  [ValidateRange(1, 65535)]
  [int]$Port = 3000,
  [string]$Image = "ghcr.io/gaofeng21cn/one-person-lab-webui",
  [string]$Tag = "latest",
  [string]$DataDir,
  [string]$ProjectsDir,
  [ValidateRange(1, 86400)]
  [int]$HealthTimeoutSeconds = 600,
  [string]$HealthUrl,
  [string]$DiagnosticsDir,
  [string]$DiagnosticsArchive,
  [string]$EvidenceDir,
  [string]$EvidenceArchive,
  [switch]$InstallPrerequisites,
  [switch]$Update,
  [switch]$EnableAutoUpdate,
  [switch]$DisableAutoUpdate,
  [ValidatePattern("^(?:[01]\d|2[0-3]):[0-5]\d$")]
  [string]$AutoUpdateTime = "03:00",
  [switch]$NoOpen,
  [switch]$Foreground
)

Set-StrictMode -Version 3.0
$ErrorActionPreference = "Stop"
$script:PreDataInventory = ""
$script:PreProjectsInventory = ""
$script:AutoUpdateTaskName = "One Person Lab WebUI Latest Update"
$script:AutoUpdateInstallerUrl = "https://raw.githubusercontent.com/gaofeng21cn/one-person-lab-app/main/scripts/install-docker-webui.ps1"

function Write-Step {
  param([string]$Message)
  Write-Host "[One Person Lab] $Message"
}

function Write-UserPathStatus {
  param([Parameter(Mandatory = $true)][string]$Url)

  Write-Step "User path status:"
  Write-Step "  one_click_install: create compose.yaml, data/projects directories, and start the WebUI image."
  Write-Step "  browser_webui: open $Url after the health check passes."
  Write-Step "  access_key_settings: sign in to Gateway or enter an API key in WebUI first-run or Settings -> Account & Access."
  Write-Step "  runtime_proxy: WebUI sends Gateway sign-in and API-key configuration through the existing OPL runtime provider."
  Write-Step "  startup_recovery: if startup fails, collect redacted startup diagnostics and rerun after fixing Docker, port, image, or data issues."
  Write-Step "  data_preservation: keep OnePersonLab/data and OnePersonLab/projects mounted and preserved."
  Write-Step "  host_update: rerun this installer, pass -Update, or enable the user-scoped Windows latest update task."
}

function Test-Administrator {
  if (-not (Test-WindowsHost)) {
    return $false
  }
  $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
  $principal = [Security.Principal.WindowsPrincipal]::new($identity)
  return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Invoke-StepCommand {
  param(
    [Parameter(Mandatory = $true)][string]$Display,
    [Parameter(Mandatory = $true)][scriptblock]$Command
  )

  if ($DryRun) {
    Write-Step "Dry run: would run $Display"
    return
  }
  Write-Step "Running $Display"
  & $Command
  if ($LASTEXITCODE -ne 0) {
    throw "Command failed: $Display"
  }
}

function ConvertFrom-DiagnosticSensitiveText {
  param([AllowNull()][string]$Text)
  if ($null -eq $Text) {
    return ""
  }
  $redacted = $Text -replace "(?i)([A-Za-z0-9_.-]*(api[_-]?key|token|credential|password)[A-Za-z0-9_.-]*\s*[:=]\s*)[^\s`"']+", '$1[redacted]'
  $redacted = $redacted -replace "(?i)(Bearer\s+)[A-Za-z0-9._~+/=-]+", '$1[redacted]'
  $redacted = $redacted -replace "sk-[A-Za-z0-9_-]{20,}", "sk-[redacted]"
  return $redacted
}

function Write-DiagnosticText {
  param(
    [Parameter(Mandatory = $true)][string]$PathValue,
    [AllowNull()][string]$Content
  )
  Set-Content -Path $PathValue -Value (ConvertFrom-DiagnosticSensitiveText $Content) -Encoding UTF8
}

function Invoke-DiagnosticDockerCommand {
  param(
    [Parameter(Mandatory = $true)][string]$OutputPath,
    [Parameter(Mandatory = $true)][string[]]$Arguments
  )

  $display = "docker " + (($Arguments | ForEach-Object { if ($_ -match "\s") { '"' + $_ + '"' } else { $_ } }) -join " ")
  $output = & docker @Arguments 2>&1 | Out-String
  $exitCode = $LASTEXITCODE
  $content = "`$ $display`n$output"
  if ($exitCode -ne 0) {
    $content += "`n[command exited with status $exitCode]`n"
  }
  Write-DiagnosticText -PathValue $OutputPath -Content $content
}

function Install-Wsl2Prerequisites {
  if (-not $InstallPrerequisites) {
    return
  }
  if (-not (Test-Administrator)) {
    throw "Run PowerShell as Administrator when using -InstallPrerequisites to enable WSL 2."
  }

  $wsl = Get-Command wsl.exe -ErrorAction SilentlyContinue
  if ($null -ne $wsl) {
    Invoke-StepCommand -Display "wsl.exe --install --no-distribution" -Command { & wsl.exe --install --no-distribution }
    Invoke-StepCommand -Display "wsl.exe --set-default-version 2" -Command { & wsl.exe --set-default-version 2 }
    return
  }

  Invoke-StepCommand -Display "dism.exe /online /enable-feature /featurename:Microsoft-Windows-Subsystem-Linux /all /norestart" -Command {
    & dism.exe /online /enable-feature /featurename:Microsoft-Windows-Subsystem-Linux /all /norestart
  }
  Invoke-StepCommand -Display "dism.exe /online /enable-feature /featurename:VirtualMachinePlatform /all /norestart" -Command {
    & dism.exe /online /enable-feature /featurename:VirtualMachinePlatform /all /norestart
  }
  Write-Step "WSL 2 prerequisites were requested. Reboot if Windows asks, then rerun this script."
}

function Install-DockerDesktopPrerequisite {
  if (-not $InstallPrerequisites) {
    return
  }
  if (-not (Test-Administrator)) {
    throw "Run PowerShell as Administrator when using -InstallPrerequisites to install Docker Desktop."
  }
  $winget = Get-Command winget.exe -ErrorAction SilentlyContinue
  if ($null -eq $winget) {
    throw "winget was not found. Install Docker Desktop manually from https://docs.docker.com/desktop/setup/install/windows-install/, then rerun this script."
  }
  Invoke-StepCommand -Display "winget install --id Docker.DockerDesktop --exact --accept-package-agreements --accept-source-agreements" -Command {
    & winget.exe install --id Docker.DockerDesktop --exact --accept-package-agreements --accept-source-agreements
  }
}

function Start-DockerDesktopIfPresent {
  if ($DryRun) {
    Write-Step "Dry run: would ask Docker Desktop to start."
    return
  }

  Write-Step "Starting Docker Desktop."
  $desktopStart = Invoke-DockerCommandCapture -Arguments @("desktop", "start")
  if ($desktopStart.ExitCode -eq 0) {
    return
  }

  $dockerDesktop = @(
    Join-Path ${env:ProgramFiles} "Docker\Docker\Docker Desktop.exe"
    Join-Path ${env:LOCALAPPDATA} "Docker\Docker Desktop.exe"
  ) | Where-Object { -not [string]::IsNullOrWhiteSpace($_) -and (Test-Path $_) } | Select-Object -First 1

  if ($null -eq $dockerDesktop) {
    throw "Docker CLI is installed but Docker Desktop could not be started. Open Docker Desktop, finish any setup prompts, then rerun this script. Details: $($desktopStart.Output)"
  }
  Write-Step "Docker Desktop CLI start was unavailable; starting the installed app."
  Start-Process -FilePath $dockerDesktop | Out-Null
}

function Invoke-DockerCommandCapture {
  param([Parameter(Mandatory = $true)][string[]]$Arguments)

  $previousErrorActionPreference = $ErrorActionPreference
  try {
    # Windows PowerShell 5.1 can promote native stderr to a terminating
    # NativeCommandError while the daemon is still starting.
    $ErrorActionPreference = "Continue"
    $output = & docker @Arguments 2>&1 | Out-String
    $exitCode = $LASTEXITCODE
  } finally {
    $ErrorActionPreference = $previousErrorActionPreference
  }

  return [pscustomobject]@{
    ExitCode = $exitCode
    Output = $output.Trim()
  }
}

function Wait-DockerDaemon {
  if ($DryRun) {
    return
  }
  for ($i = 1; $i -le 90; $i++) {
    $info = Invoke-DockerCommandCapture -Arguments @("info", "--format", "{{.ServerVersion}}")
    if ($info.ExitCode -eq 0) {
      return
    }
    Start-Sleep -Seconds 2
  }
  throw "Docker Desktop did not become ready within 180 seconds. Open Docker Desktop, finish any setup prompts, then rerun this script."
}

function Test-WindowsHost {
  $isWindowsVariable = Get-Variable -Name IsWindows -ErrorAction SilentlyContinue
  if ($null -ne $isWindowsVariable) {
    return [bool]$isWindowsVariable.Value
  }
  return [System.Environment]::OSVersion.Platform -eq [System.PlatformID]::Win32NT
}

function Get-DefaultUserProfile {
  if (-not [string]::IsNullOrWhiteSpace($env:USERPROFILE)) {
    return $env:USERPROFILE
  }
  if (-not [string]::IsNullOrWhiteSpace($env:HOMEDRIVE) -and -not [string]::IsNullOrWhiteSpace($env:HOMEPATH)) {
    return "$($env:HOMEDRIVE)$($env:HOMEPATH)"
  }
  throw "USERPROFILE is not set. Pass -DataDir and -ProjectsDir explicitly."
}

function Resolve-FullPath {
  param([Parameter(Mandatory = $true)][string]$PathValue)
  return [System.IO.Path]::GetFullPath([System.Environment]::ExpandEnvironmentVariables($PathValue))
}

function Resolve-ImageReference {
  param(
    [Parameter(Mandatory = $true)][string]$ImageName,
    [Parameter(Mandatory = $true)][string]$ImageTag,
    [Parameter(Mandatory = $true)][bool]$TagWasProvided
  )

  if ($ImageName.Contains("@")) {
    if ($TagWasProvided) {
      throw "Do not pass -Tag with a digest image reference."
    }
    return $ImageName
  }

  $lastSegment = ($ImageName -split "/")[-1]
  if (-not $TagWasProvided -and $lastSegment.Contains(":")) {
    return $ImageName
  }

  return "${ImageName}:${ImageTag}"
}

function Get-ImageRepositoryName {
  param([Parameter(Mandatory = $true)][string]$ImageReference)

  $withoutDigest = ($ImageReference -split "@", 2)[0]
  $lastSlash = $withoutDigest.LastIndexOf("/")
  $lastColon = $withoutDigest.LastIndexOf(":")
  if ($lastColon -gt $lastSlash) {
    return $withoutDigest.Substring(0, $lastColon)
  }
  return $withoutDigest
}

function Resolve-PinnedImageReference {
  param([Parameter(Mandatory = $true)][string]$RequestedImageReference)

  if ($RequestedImageReference.Contains("@") -and $RequestedImageReference -notmatch "@sha256:[0-9a-f]{64}$") {
    throw "WebUI image digest references must end in @sha256:<64 lowercase hex>."
  }

  if ($DryRun) {
    if ($RequestedImageReference.Contains("@")) {
      Write-Step "Dry run: would pull and verify immutable WebUI image $RequestedImageReference."
      return $RequestedImageReference
    }
    $repository = Get-ImageRepositoryName -ImageReference $RequestedImageReference
    Write-Step "Dry run: would pull $RequestedImageReference once, read back its RepoDigest, and pin compose to ${repository}@sha256:<resolved-digest>."
    return "${repository}@sha256:$('0' * 64)"
  }

  Write-Step "Resolving WebUI image once at installer entry: $RequestedImageReference"
  $pull = Invoke-DockerCommandCapture -Arguments @("pull", $RequestedImageReference)
  if (-not [string]::IsNullOrWhiteSpace($pull.Output)) {
    Write-Host $pull.Output
  }
  if ($pull.ExitCode -ne 0) {
    throw "Docker could not pull the requested WebUI image. Check Docker/GHCR access and retry. Details: $($pull.Output)"
  }

  if ($RequestedImageReference.Contains("@")) {
    return $RequestedImageReference
  }

  $repository = Get-ImageRepositoryName -ImageReference $RequestedImageReference
  $repoDigestsJson = & docker image inspect --format "{{json .RepoDigests}}" $RequestedImageReference 2>&1
  if ($LASTEXITCODE -ne 0) {
    throw "Docker could not read the pulled WebUI image RepoDigests: $repoDigestsJson"
  }
  $repoDigests = @($repoDigestsJson | ConvertFrom-Json)
  $matchingDigests = @($repoDigests | Where-Object { $_ -match "^$([regex]::Escape($repository))@sha256:[0-9a-f]{64}$" })
  if ($matchingDigests.Count -ne 1) {
    throw "Expected one immutable RepoDigest for $repository after pulling $RequestedImageReference, got $($matchingDigests.Count)."
  }
  return [string]$matchingDigests[0]
}

function Convert-ToComposeScalar {
  param([Parameter(Mandatory = $true)][string]$Value)
  return "'" + ($Value -replace "'", "''") + "'"
}

function Write-ComposeFile {
  param(
    [Parameter(Mandatory = $true)][string]$ComposePath,
    [Parameter(Mandatory = $true)][string]$ImageReference,
    [Parameter(Mandatory = $true)][string]$HostDataDir,
    [Parameter(Mandatory = $true)][string]$HostProjectsDir,
    [Parameter(Mandatory = $true)][int]$HostPort
  )

  $compose = @"
services:
  one-person-lab-webui:
    image: $(Convert-ToComposeScalar $ImageReference)
    pull_policy: missing
    ports:
      - $(Convert-ToComposeScalar "127.0.0.1:${HostPort}:3000")
    environment:
      AIONUI_ALLOW_REMOTE: "true"
      AIONUI_DATA_DIR: /data
      OPL_PROJECTS_DIR: /projects
    volumes:
      - $(Convert-ToComposeScalar "${HostDataDir}:/data")
      - $(Convert-ToComposeScalar "${HostProjectsDir}:/projects")
"@

  if ($DryRun) {
    Write-Step "Dry run: would write $ComposePath"
    Write-Host $compose
    return
  }

  Set-Content -Path $ComposePath -Value $compose -Encoding UTF8
}

function Confirm-Run {
  param(
    [Parameter(Mandatory = $true)][string]$ComposePath,
    [Parameter(Mandatory = $true)][string]$DataPath,
    [Parameter(Mandatory = $true)][string]$ProjectsPath,
    [Parameter(Mandatory = $true)][string]$Url
  )

  if ($Yes -or $DryRun) {
    return
  }

  Write-Host ""
  Write-Host "This will create or reuse:"
  Write-Host "  Data:     $DataPath"
  Write-Host "  Projects: $ProjectsPath"
  Write-Host "  Compose:  $ComposePath"
  Write-Host "Then it will run Docker Compose and open: $Url"
  $answer = Read-Host "Continue? Type Y to continue"
  if ($answer -notin @("Y", "y", "YES", "Yes", "yes")) {
    throw "Cancelled. Rerun with -Yes to skip this prompt."
  }
}

function Assert-WindowsHost {
  if (Test-WindowsHost) {
    Write-Step "Windows host detected."
    return
  }

  $message = "This installer is for Windows PowerShell. Use the Linux/macOS Docker instructions on non-Windows hosts."
  if ($DryRun) {
    Write-Step "Dry run: $message"
    return
  }
  throw $message
}

function Assert-PowerShellVersion {
  $minimum = [Version]"5.1"
  if ($PSVersionTable.PSVersion -ge $minimum) {
    Write-Step "PowerShell $($PSVersionTable.PSVersion) detected."
    return
  }
  throw "PowerShell $minimum or newer is required. Install a supported Windows PowerShell or PowerShell 7 release."
}

function Assert-DockerCli {
  if ($DryRun) {
    if ($InstallPrerequisites) {
      Write-Step "Dry run: would install Docker Desktop with winget if docker CLI is missing."
    } else {
      Write-Step "Dry run: would check Docker Desktop/docker CLI availability."
    }
    return
  }

  $docker = Get-Command docker -ErrorAction SilentlyContinue
  if ($null -eq $docker) {
    Install-DockerDesktopPrerequisite
    $docker = Get-Command docker -ErrorAction SilentlyContinue
  }
  if ($null -eq $docker) {
    throw "docker CLI was not found. Install Docker Desktop, for example: winget install Docker.DockerDesktop, then open Docker Desktop and rerun this script."
  }

  $client = Invoke-DockerCommandCapture -Arguments @("--version")
  if ($client.ExitCode -ne 0) {
    throw "docker CLI could not run. Reinstall or update Docker Desktop, then rerun this script. Details: $($client.Output)"
  }

  $info = Invoke-DockerCommandCapture -Arguments @("info", "--format", "{{.ServerVersion}}")
  if ($info.ExitCode -ne 0) {
    Start-DockerDesktopIfPresent
    Wait-DockerDaemon
    Write-Step "Docker CLI and Docker Desktop daemon are available."
    return
  }
  Write-Step "Docker CLI and Docker Desktop daemon are available."
}

function Assert-DockerCompose {
  if ($DryRun) {
    Write-Step "Dry run: would check Docker Compose plugin availability."
    return
  }

  $compose = Invoke-DockerCommandCapture -Arguments @("compose", "version")
  if ($compose.ExitCode -ne 0) {
    throw "Docker Compose plugin is not available. Update Docker Desktop, then rerun this script. Details: $($compose.Output)"
  }
  Write-Step "Docker Compose plugin is available."
}

function Assert-Wsl2 {
  if ($DryRun) {
    if ($InstallPrerequisites) {
      Write-Step "Dry run: would enable WSL 2 prerequisites before checking wsl --status."
    } else {
      Write-Step "Dry run: would check WSL 2 availability with wsl --status."
    }
    return
  }

  $wsl = Get-Command wsl.exe -ErrorAction SilentlyContinue
  if ($null -eq $wsl) {
    Install-Wsl2Prerequisites
    $wsl = Get-Command wsl.exe -ErrorAction SilentlyContinue
  }
  if ($null -eq $wsl) {
    throw "WSL is not available. Run 'wsl --install' from an elevated PowerShell if Windows asks for it, reboot if prompted, then install/open Docker Desktop."
  }

  $statusOutput = & wsl.exe --status 2>&1
  if ($LASTEXITCODE -ne 0) {
    Install-Wsl2Prerequisites
    $statusOutput = & wsl.exe --status 2>&1
  }
  if ($LASTEXITCODE -ne 0) {
    throw "WSL status check failed. Run 'wsl --install' from an elevated PowerShell if Windows asks for it, reboot if prompted, then reopen Docker Desktop. Details: $statusOutput"
  }

  $statusText = ($statusOutput | Out-String)
  if ($statusText -notmatch "2" -and $statusText -notmatch "WSL2") {
    Write-Warning "WSL is installed, but this script could not confirm WSL 2 from 'wsl --status'. Docker Desktop may still guide you through the WSL 2 backend setup."
  } else {
    Write-Step "WSL status check completed."
  }
}

function New-DirectoryIfNeeded {
  param([Parameter(Mandatory = $true)][string]$PathValue)

  if ($DryRun) {
    Write-Step "Dry run: would create directory $PathValue"
    return
  }

  New-Item -ItemType Directory -Force -Path $PathValue | Out-Null
}

function Convert-ToPowerShellSingleQuoted {
  param([Parameter(Mandatory = $true)][string]$Value)
  return "'" + ($Value -replace "'", "''") + "'"
}

function Write-WebUiAutoUpdater {
  param(
    [Parameter(Mandatory = $true)][string]$UpdaterPath,
    [Parameter(Mandatory = $true)][string]$DataPath,
    [Parameter(Mandatory = $true)][string]$ProjectsPath,
    [Parameter(Mandatory = $true)][int]$HostPort,
    [Parameter(Mandatory = $true)][string]$Url,
    [Parameter(Mandatory = $true)][int]$TimeoutSeconds
  )

  $updaterDir = Split-Path -Parent $UpdaterPath
  if ($DryRun) {
    Write-Step "Dry run: would write automatic updater $UpdaterPath"
    return
  }

  New-Item -ItemType Directory -Force -Path $updaterDir | Out-Null
  $lines = @(
    "[CmdletBinding()]",
    "param()",
    "",
    "Set-StrictMode -Version 3.0",
    "`$ErrorActionPreference = `"Stop`"",
    "`$installerUrl = $(Convert-ToPowerShellSingleQuoted $script:AutoUpdateInstallerUrl)",
    "`$updaterDir = $(Convert-ToPowerShellSingleQuoted $updaterDir)",
    "`$installerPath = Join-Path `$updaterDir `"install-docker-webui.ps1`"",
    "`$downloadPath = `"`$installerPath.download`"",
    "`$logDir = Join-Path `$updaterDir `"logs`"",
    "`$currentLog = Join-Path `$logDir `"current.log`"",
    "`$previousLog = Join-Path `$logDir `"previous.log`"",
    "`$mutex = New-Object System.Threading.Mutex(`$false, `"Local\OnePersonLabWebUiLatestUpdate`")",
    "`$lockTaken = `$false",
    "`$transcriptStarted = `$false",
    "",
    "try {",
    "  `$lockTaken = `$mutex.WaitOne(0)",
    "  if (-not `$lockTaken) {",
    "    exit 0",
    "  }",
    "  New-Item -ItemType Directory -Force -Path `$logDir | Out-Null",
    "  if (Test-Path -LiteralPath `$currentLog) {",
    "    Move-Item -LiteralPath `$currentLog -Destination `$previousLog -Force",
    "  }",
    "  Start-Transcript -Path `$currentLog -Force | Out-Null",
    "  `$transcriptStarted = `$true",
    "  Invoke-WebRequest -UseBasicParsing -Uri `$installerUrl -OutFile `$downloadPath",
    "  Move-Item -LiteralPath `$downloadPath -Destination `$installerPath -Force",
    "  `$powershell = Join-Path `$env:SystemRoot `"System32\WindowsPowerShell\v1.0\powershell.exe`"",
    "  `$installerArgs = @(",
    "    `"-NoProfile`",",
    "    `"-ExecutionPolicy`",",
    "    `"Bypass`",",
    "    `"-File`",",
    "    `$installerPath,",
    "    `"-Update`",",
    "    `"-Yes`",",
    "    `"-NoOpen`",",
    "    `"-DataDir`",",
    "    $(Convert-ToPowerShellSingleQuoted $DataPath),",
    "    `"-ProjectsDir`",",
    "    $(Convert-ToPowerShellSingleQuoted $ProjectsPath),",
    "    `"-Port`",",
    "    $(Convert-ToPowerShellSingleQuoted ([string]$HostPort)),",
    "    `"-HealthUrl`",",
    "    $(Convert-ToPowerShellSingleQuoted $Url),",
    "    `"-HealthTimeoutSeconds`",",
    "    $(Convert-ToPowerShellSingleQuoted ([string]$TimeoutSeconds))",
    "  )",
    "  & `$powershell @installerArgs",
    "  if (`$LASTEXITCODE -ne 0) {",
    "    throw `"One Person Lab WebUI automatic update failed with exit code `$LASTEXITCODE.`"",
    "  }",
    "} finally {",
    "  Remove-Item -LiteralPath `$downloadPath -Force -ErrorAction SilentlyContinue",
    "  if (`$transcriptStarted) {",
    "    Stop-Transcript | Out-Null",
    "  }",
    "  if (`$lockTaken) {",
    "    `$mutex.ReleaseMutex()",
    "  }",
    "  `$mutex.Dispose()",
    "}"
  )
  $content = ($lines -join "`r`n") + "`r`n"
  $temporaryPath = "$UpdaterPath.download"
  Set-Content -Path $temporaryPath -Value $content -Encoding UTF8
  Move-Item -LiteralPath $temporaryPath -Destination $UpdaterPath -Force
}

function Disable-WebUiAutoUpdate {
  param([Parameter(Mandatory = $true)][string]$UpdaterPath)

  if ($DryRun) {
    Write-Step "Dry run: would unregister scheduled task $script:AutoUpdateTaskName and remove $UpdaterPath"
    return
  }

  $task = Get-ScheduledTask -TaskName $script:AutoUpdateTaskName -ErrorAction SilentlyContinue
  if ($null -ne $task) {
    Unregister-ScheduledTask -TaskName $script:AutoUpdateTaskName -Confirm:$false
  }
  Remove-Item -LiteralPath $UpdaterPath -Force -ErrorAction SilentlyContinue
  Write-Step "Automatic WebUI updates are disabled. Manual -Update remains available."
}

function Register-WebUiAutoUpdate {
  param(
    [Parameter(Mandatory = $true)][string]$UpdaterPath,
    [Parameter(Mandatory = $true)][string]$DataPath,
    [Parameter(Mandatory = $true)][string]$ProjectsPath,
    [Parameter(Mandatory = $true)][int]$HostPort,
    [Parameter(Mandatory = $true)][string]$Url,
    [Parameter(Mandatory = $true)][int]$TimeoutSeconds
  )

  Write-WebUiAutoUpdater -UpdaterPath $UpdaterPath -DataPath $DataPath -ProjectsPath $ProjectsPath -HostPort $HostPort -Url $Url -TimeoutSeconds $TimeoutSeconds
  if ($DryRun) {
    Write-Step "Dry run: would register scheduled task $script:AutoUpdateTaskName at $AutoUpdateTime for the current user."
    return
  }

  foreach ($command in @(
    "Get-ScheduledTask",
    "New-ScheduledTaskAction",
    "New-ScheduledTaskPrincipal",
    "New-ScheduledTaskSettingsSet",
    "New-ScheduledTaskTrigger",
    "Register-ScheduledTask"
  )) {
    if ($null -eq (Get-Command $command -ErrorAction SilentlyContinue)) {
      throw "Windows Scheduled Tasks support is unavailable: missing $command. Run updates manually with -Update."
    }
  }

  $powershell = Join-Path $env:SystemRoot "System32\WindowsPowerShell\v1.0\powershell.exe"
  $actionArguments = '-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File "' + $UpdaterPath + '"'
  $action = New-ScheduledTaskAction -Execute $powershell -Argument $actionArguments
  $scheduleTime = [datetime]::ParseExact($AutoUpdateTime, "HH:mm", [Globalization.CultureInfo]::InvariantCulture)
  $trigger = New-ScheduledTaskTrigger -Daily -At $scheduleTime
  $settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Minutes 30)
  $currentUser = [Security.Principal.WindowsIdentity]::GetCurrent().Name
  $principal = New-ScheduledTaskPrincipal -UserId $currentUser -LogonType Interactive -RunLevel Limited
  Register-ScheduledTask `
    -TaskName $script:AutoUpdateTaskName `
    -Action $action `
    -Trigger $trigger `
    -Settings $settings `
    -Principal $principal `
    -Description "Checks the One Person Lab WebUI latest image from the Windows host and preserves data/projects." `
    -Force | Out-Null

  $task = Get-ScheduledTask -TaskName $script:AutoUpdateTaskName -ErrorAction Stop
  $taskInfo = $task | Get-ScheduledTaskInfo
  Write-Step "Automatic WebUI updates enabled: $($task.TaskName), next run $($taskInfo.NextRunTime)."
}

function Invoke-DockerComposeUp {
  param(
    [Parameter(Mandatory = $true)][string]$ComposePath,
    [Parameter(Mandatory = $true)][string]$Url
  )

  $pullArgs = @("compose", "-f", $ComposePath, "pull")
  $upArgs = @("compose", "-f", $ComposePath, "up")
  if (-not $Foreground) {
    $upArgs += "-d"
  }

  $displayPullCommand = "docker " + (($pullArgs | ForEach-Object { if ($_ -match "\s") { '"' + $_ + '"' } else { $_ } }) -join " ")
  $displayUpCommand = "docker " + (($upArgs | ForEach-Object { if ($_ -match "\s") { '"' + $_ + '"' } else { $_ } }) -join " ")
  if ($DryRun) {
    if ($Update) {
      Write-Step "Dry run: would run $displayPullCommand"
    }
    Write-Step "Dry run: would run $displayUpCommand"
    return
  }

  if ($Update) {
    Write-Step "Running $displayPullCommand"
    $pull = Invoke-DockerCommandCapture -Arguments $pullArgs
    if (-not [string]::IsNullOrWhiteSpace($pull.Output)) {
      Write-Host $pull.Output
    }
    if ($pull.ExitCode -ne 0) {
      throw "Docker Compose image pull failed. Check Docker/GHCR network access, then rerun this script. Details: $($pull.Output)"
    }
  }
  Write-Step "Running $displayUpCommand"
  $up = Invoke-DockerCommandCapture -Arguments $upArgs
  if (-not [string]::IsNullOrWhiteSpace($up.Output)) {
    Write-Host $up.Output
  }
  if ($up.ExitCode -ne 0) {
    throw "Docker Compose failed. Check Docker Desktop status and the compose file at $ComposePath, then rerun this script. Details: $($up.Output)"
  }
}

function Test-WebUiHttpHealth {
  param([Parameter(Mandatory = $true)][string]$Url)

  try {
    $response = Invoke-WebRequest -Uri $Url -Method Head -TimeoutSec 5 -UseBasicParsing -ErrorAction Stop
    return ($response.StatusCode -ge 200 -and $response.StatusCode -lt 400)
  } catch {
    try {
      $response = Invoke-WebRequest -Uri $Url -Method Get -TimeoutSec 5 -UseBasicParsing -ErrorAction Stop
      return ($response.StatusCode -ge 200 -and $response.StatusCode -lt 400)
    } catch {
      return $false
    }
  }
}

function Write-HttpProbeSummary {
  param(
    [Parameter(Mandatory = $true)][string]$OutputPath,
    [Parameter(Mandatory = $true)][string]$Url,
    [Parameter(Mandatory = $true)][int]$TimeoutSeconds
  )

  $lines = [System.Collections.Generic.List[string]]::new()
  $lines.Add("url=$Url")
  $lines.Add("timeout_seconds=$TimeoutSeconds")
  try {
    $response = Invoke-WebRequest -Uri $Url -Method Head -TimeoutSec 5 -UseBasicParsing -ErrorAction Stop
    $lines.Add("head_status=$($response.StatusCode)")
  } catch {
    $lines.Add("head_error=$($_.Exception.GetType().Name): $($_.Exception.Message)")
  }
  try {
    $response = Invoke-WebRequest -Uri $Url -Method Get -TimeoutSec 5 -UseBasicParsing -ErrorAction Stop
    $lines.Add("get_status=$($response.StatusCode)")
  } catch {
    $lines.Add("get_error=$($_.Exception.GetType().Name): $($_.Exception.Message)")
  }
  Write-DiagnosticText -PathValue $OutputPath -Content ($lines -join "`n")
}

function Write-DirectorySummary {
  param(
    [Parameter(Mandatory = $true)][string]$OutputPath,
    [Parameter(Mandatory = $true)][string]$ComposePath,
    [Parameter(Mandatory = $true)][string]$DataPath,
    [Parameter(Mandatory = $true)][string]$ProjectsPath
  )

  $composeParent = Split-Path -Parent $ComposePath
  $paths = @($composeParent, $DataPath, $ProjectsPath)
  $lines = [System.Collections.Generic.List[string]]::new()
  $lines.Add("compose_file=$ComposePath")
  foreach ($pathValue in $paths) {
    $item = Get-Item -LiteralPath $pathValue -ErrorAction SilentlyContinue
    if ($null -eq $item) {
      $lines.Add("path=$pathValue exists=false")
    } elseif ($item.PSIsContainer) {
      $lines.Add("path=$pathValue exists=true type=directory mode=$($item.Mode)")
    } else {
      $lines.Add("path=$pathValue exists=true type=file mode=$($item.Mode) length=$($item.Length)")
    }
  }
  Write-DiagnosticText -PathValue $OutputPath -Content ($lines -join "`n")
}

function Get-PathInventoryText {
  param([Parameter(Mandatory = $true)][string]$PathValue)

  $lines = [System.Collections.Generic.List[string]]::new()
  $lines.Add("path=$PathValue")
  if (-not (Test-Path -LiteralPath $PathValue)) {
    $lines.Add("exists=false")
    return ($lines -join "`n")
  }

  $item = Get-Item -LiteralPath $PathValue
  $lines.Add("exists=true")
  if (-not $item.PSIsContainer) {
    $lines.Add("type=file")
    $lines.Add("length=$($item.Length)")
    return ($lines -join "`n")
  }

  $lines.Add("type=directory")
  $entries = @(Get-ChildItem -LiteralPath $PathValue -Recurse -Depth 3 -Force -ErrorAction SilentlyContinue)
  $lines.Add("total_entries_max_depth_3=$($entries.Count)")
  $lines.Add("sample_entries_max_depth_3:")
  foreach ($entry in ($entries | Sort-Object FullName | Select-Object -First 50)) {
    $relative = $entry.FullName.Substring($PathValue.Length).TrimStart([System.IO.Path]::DirectorySeparatorChar, [System.IO.Path]::AltDirectorySeparatorChar)
    $lines.Add("./$relative")
  }
  return (ConvertFrom-DiagnosticSensitiveText ($lines -join "`n"))
}

function Write-PreservationSummary {
  param(
    [Parameter(Mandatory = $true)][string]$OutputPath,
    [Parameter(Mandatory = $true)][string]$DataPath,
    [Parameter(Mandatory = $true)][string]$ProjectsPath
  )

  $postDataInventory = Get-PathInventoryText -PathValue $DataPath
  $postProjectsInventory = Get-PathInventoryText -PathValue $ProjectsPath
  $verdict = "preserved_or_reused"
  if ($script:PreDataInventory -match "(?m)^exists=false$") {
    $verdict = "created_new_data_dir"
  }
  $content = @(
    "verdict=$verdict",
    "policy=existing OnePersonLab data/projects directories must be preserved or migrated without delete",
    "",
    "[pre_data_inventory]",
    $(if ([string]::IsNullOrWhiteSpace($script:PreDataInventory)) { "not_recorded" } else { $script:PreDataInventory }),
    "",
    "[post_data_inventory]",
    $postDataInventory,
    "",
    "[pre_projects_inventory]",
    $(if ([string]::IsNullOrWhiteSpace($script:PreProjectsInventory)) { "not_recorded" } else { $script:PreProjectsInventory }),
    "",
    "[post_projects_inventory]",
    $postProjectsInventory
  ) -join "`n"
  Write-DiagnosticText -PathValue $OutputPath -Content $content
}

function Collect-WebUiDiagnostics {
  param(
    [Parameter(Mandatory = $true)][string]$Reason,
    [string]$TargetDir,
    [Parameter(Mandatory = $true)][string]$ComposePath,
    [Parameter(Mandatory = $true)][string]$ImageReference,
    [Parameter(Mandatory = $true)][string]$DataPath,
    [Parameter(Mandatory = $true)][string]$ProjectsPath,
    [Parameter(Mandatory = $true)][int]$HostPort,
    [Parameter(Mandatory = $true)][string]$Url
  )

  if ([string]::IsNullOrWhiteSpace($TargetDir)) {
    $TargetDir = Join-Path (Join-Path (Split-Path -Parent $ComposePath) "diagnostics") ("opl-webui-diagnostics-" + (Get-Date -Format "yyyyMMdd-HHmmss"))
  }

  if ($DryRun) {
    Write-Step "Dry run: would write diagnostic directory $TargetDir"
    Write-Step "Dry run: would include compose.yaml, docker versions, compose ps/logs, HTTP probe summary, directory/port/image metadata."
    if (-not [string]::IsNullOrWhiteSpace($DiagnosticsArchive)) {
      Write-Step "Dry run: would write diagnostic archive $DiagnosticsArchive"
    }
    return $TargetDir
  }

  New-Item -ItemType Directory -Force -Path $TargetDir | Out-Null
  $metadata = @(
    "reason=$Reason",
    "created_at=$((Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ"))",
    "image=$ImageReference",
    "host_port=$HostPort",
    "health_url=$Url",
    "compose_file=$ComposePath",
    "data_dir=$DataPath",
    "projects_dir=$ProjectsPath"
  ) -join "`n"
  Write-DiagnosticText -PathValue (Join-Path $TargetDir "metadata.txt") -Content $metadata
  $manifest = @{
    schema = "opl_docker_webui_diagnostics_manifest.v1"
    required_files = @(
      "metadata.txt",
      "diagnostics-manifest.json",
      "compose.yaml",
      "docker-version.txt",
      "docker-compose-version.txt",
      "docker-compose-ps.txt",
      "docker-compose-logs.txt",
      "docker-image.txt",
      "http-probe.txt",
      "directories.txt",
      "data-preservation.txt"
    )
  } | ConvertTo-Json -Depth 4
  Write-DiagnosticText -PathValue (Join-Path $TargetDir "diagnostics-manifest.json") -Content $manifest

  if (Test-Path -LiteralPath $ComposePath) {
    Write-DiagnosticText -PathValue (Join-Path $TargetDir "compose.yaml") -Content (Get-Content -LiteralPath $ComposePath -Raw)
  }
  Invoke-DiagnosticDockerCommand -OutputPath (Join-Path $TargetDir "docker-version.txt") -Arguments @("version")
  Invoke-DiagnosticDockerCommand -OutputPath (Join-Path $TargetDir "docker-compose-version.txt") -Arguments @("compose", "version")
  Invoke-DiagnosticDockerCommand -OutputPath (Join-Path $TargetDir "docker-compose-ps.txt") -Arguments @("compose", "-f", $ComposePath, "ps")
  Invoke-DiagnosticDockerCommand -OutputPath (Join-Path $TargetDir "docker-compose-logs.txt") -Arguments @("compose", "-f", $ComposePath, "logs", "--no-color", "--tail=300")
  Invoke-DiagnosticDockerCommand -OutputPath (Join-Path $TargetDir "docker-image.txt") -Arguments @("image", "inspect", $ImageReference)
  Write-HttpProbeSummary -OutputPath (Join-Path $TargetDir "http-probe.txt") -Url $Url -TimeoutSeconds $HealthTimeoutSeconds
  Write-DirectorySummary -OutputPath (Join-Path $TargetDir "directories.txt") -ComposePath $ComposePath -DataPath $DataPath -ProjectsPath $ProjectsPath
  Write-PreservationSummary -OutputPath (Join-Path $TargetDir "data-preservation.txt") -DataPath $DataPath -ProjectsPath $ProjectsPath

  if (-not [string]::IsNullOrWhiteSpace($DiagnosticsArchive)) {
    $archiveParent = Split-Path -Parent ([System.IO.Path]::GetFullPath($DiagnosticsArchive))
    if (-not [string]::IsNullOrWhiteSpace($archiveParent)) {
      New-Item -ItemType Directory -Force -Path $archiveParent | Out-Null
    }
    if (Test-Path -LiteralPath $DiagnosticsArchive) {
      Remove-Item -LiteralPath $DiagnosticsArchive -Force
    }
    Compress-Archive -Path (Join-Path $TargetDir "*") -DestinationPath $DiagnosticsArchive -Force
    Write-Step "Diagnostic archive written: $DiagnosticsArchive"
  }
  Write-Step "Diagnostic directory written: $TargetDir"
  return $TargetDir
}

function Convert-ToEvidenceRelativePath {
  param(
    [Parameter(Mandatory = $true)][string]$EvidenceRoot,
    [Parameter(Mandatory = $true)][string]$PathValue
  )

  $root = [System.IO.Path]::GetFullPath($EvidenceRoot).TrimEnd([System.IO.Path]::DirectorySeparatorChar, [System.IO.Path]::AltDirectorySeparatorChar)
  $full = [System.IO.Path]::GetFullPath($PathValue)
  $isRoot = $full.Equals($root, [System.StringComparison]::OrdinalIgnoreCase)
  $isChild = $full.StartsWith($root + [System.IO.Path]::DirectorySeparatorChar, [System.StringComparison]::OrdinalIgnoreCase) -or $full.StartsWith($root + [System.IO.Path]::AltDirectorySeparatorChar, [System.StringComparison]::OrdinalIgnoreCase)
  if (-not ($isRoot -or $isChild)) {
    throw "Evidence member must stay inside EvidenceDir: $PathValue"
  }
  $relative = $full.Substring($root.Length).TrimStart([System.IO.Path]::DirectorySeparatorChar, [System.IO.Path]::AltDirectorySeparatorChar)
  return ($relative -replace "\\", "/")
}

function Get-JsonProperty {
  param(
    [AllowNull()]$ObjectValue,
    [Parameter(Mandatory = $true)][string]$Name
  )

  if ($null -eq $ObjectValue) {
    return $null
  }
  $property = $ObjectValue.PSObject.Properties[$Name]
  if ($null -eq $property) {
    return $null
  }
  return $property.Value
}

function Write-WebUiAccessReceipt {
  param(
    [Parameter(Mandatory = $true)][string]$TargetDir,
    [Parameter(Mandatory = $true)][string]$Url
  )

  if ([string]::IsNullOrWhiteSpace($TargetDir)) {
    return
  }
  if ($DryRun) {
    Write-Step "Dry run: would collect WebUI access receipt in $TargetDir"
    return
  }

  New-Item -ItemType Directory -Force -Path $TargetDir | Out-Null
  $accessReceiptFile = "api" + "-key-flow-evidence.json"
  $accessReceiptSchema = "opl_docker_webui_" + "api" + "_key_flow_evidence.v1"
  $accessReceiptPath = Join-Path $TargetDir $accessReceiptFile
  $endpoint = $Url.TrimEnd("/") + "/api/opl-runtime/configure-codex"
  $submittedPlaceholder = "opl-smoke-placeholder-key"
  $payload = @{}
  $payload["api" + "Key"] = $submittedPlaceholder
  $errors = New-Object System.Collections.Generic.List[string]
  $retryErrors = New-Object System.Collections.Generic.List[string]
  $responseStatus = $null
  $responseSuccess = $false
  $command = "opl system configure-codex --api-key-stdin --json"
  $stdinTransport = $false
  $responseText = ""
  $accessReceiptAttempt = 0
  $maxAccessReceiptAttempts = 12
  $accessReceiptRetryDelaySeconds = 5

  for ($attempt = 1; $attempt -le $maxAccessReceiptAttempts; $attempt++) {
    $accessReceiptAttempt = $attempt
    $errors = New-Object System.Collections.Generic.List[string]
    $responseStatus = $null
    $responseSuccess = $false
    $stdinTransport = $false
    $responseText = ""

    try {
      $response = Invoke-WebRequest -Uri $endpoint -Method Post -ContentType "application/json" -Body ($payload | ConvertTo-Json -Compress) -UseBasicParsing -TimeoutSec 30
      $responseStatus = [int]$response.StatusCode
      $responseText = [string]$response.Content
      $body = $null
      try {
        $body = $responseText | ConvertFrom-Json
      } catch {
        $errors.Add("WebUI access response was not JSON.")
      }
      $responseSuccess = (Get-JsonProperty -ObjectValue $body -Name "success") -eq $true
      $data = Get-JsonProperty -ObjectValue $body -Name "data"
      $observedCommand = Get-JsonProperty -ObjectValue $data -Name "command"
      if ([string]::IsNullOrWhiteSpace($observedCommand)) {
        $observedCommand = Get-JsonProperty -ObjectValue $data -Name "redactedCommand"
      }
      if (-not [string]::IsNullOrWhiteSpace($observedCommand)) {
        $command = [string]$observedCommand
      }
      $argsValue = Get-JsonProperty -ObjectValue $data -Name "args"
      if ($null -ne $argsValue) {
        $stdinTransport = @($argsValue) -contains "--api-key-stdin"
      } else {
        $stdinTransport = $command.Contains("--api-key-stdin")
      }
      if ($responseStatus -ne 200) {
        $errors.Add("WebUI access endpoint returned HTTP $responseStatus.")
      }
      if (-not $responseSuccess) {
        $errors.Add("WebUI access endpoint did not report success=true.")
      }
      if (-not $stdinTransport) {
        $errors.Add("WebUI access endpoint did not use stdin transport.")
      }
      if ($responseText.Contains($submittedPlaceholder)) {
        $errors.Add("WebUI access response echoed the submitted placeholder.")
      }
    } catch {
      $errors.Add("WebUI access request failed: $($_.Exception.Message)")
    }

    if ($errors.Count -eq 0) {
      break
    }

    foreach ($errorMessage in @($errors)) {
      $retryErrors.Add("attempt ${attempt}/${maxAccessReceiptAttempts}: $errorMessage")
    }

    if ($attempt -lt $maxAccessReceiptAttempts) {
      Write-Step "WebUI access receipt attempt $attempt failed; retrying in ${accessReceiptRetryDelaySeconds}s."
      Start-Sleep -Seconds $accessReceiptRetryDelaySeconds
    }
  }

  $receipt = [ordered]@{
    schema = $accessReceiptSchema
    status = $(if ($errors.Count -eq 0) { "passed" } else { "failed" })
    mode = "webui_proxy_configure_codex"
    endpoint = $endpoint
    response_http_status = $responseStatus
    response_success = $responseSuccess
    command = $command
    stdin_transport = $stdinTransport
    attempts = $accessReceiptAttempt
    retry_errors = @($retryErrors)
    key_material_recorded = $false
    errors = @($errors)
  }
  Set-Content -Path $accessReceiptPath -Value ($receipt | ConvertTo-Json -Depth 6) -Encoding UTF8
  if ($errors.Count -ne 0) {
    throw "WebUI access receipt collection failed. Receipt: $accessReceiptPath"
  }
  Write-Step "WebUI access receipt written: $accessReceiptPath"
}

function Write-WindowsSmokeEvidence {
  param(
    [Parameter(Mandatory = $true)][string]$TargetDir,
    [Parameter(Mandatory = $true)][string]$DiagnosticsPath
  )

  if ([string]::IsNullOrWhiteSpace($TargetDir)) {
    return
  }
  if ($DryRun) {
    Write-Step "Dry run: would write Windows smoke evidence manifest in $TargetDir"
    return
  }

  New-Item -ItemType Directory -Force -Path $TargetDir | Out-Null
  $manifestPath = Join-Path $TargetDir "windows-smoke-evidence.json"
  $accessReceiptFile = "api" + "-key-flow-evidence.json"
  $accessReceiptField = "api" + "_key_flow_evidence"
  $accessReceiptPath = Join-Path $TargetDir $accessReceiptFile
  $readmePath = Join-Path $TargetDir "README.txt"
  $diagnosticsRelative = Convert-ToEvidenceRelativePath -EvidenceRoot $TargetDir -PathValue $DiagnosticsPath
  $accessReceiptRelative = Convert-ToEvidenceRelativePath -EvidenceRoot $TargetDir -PathValue $accessReceiptPath
  $installerCommand = "powershell -ExecutionPolicy Bypass -File scripts/install-docker-webui.ps1 -Yes -NoOpen -DiagnosticsDir diagnostics -EvidenceDir ."
  $manifest = [ordered]@{
    schema = "opl_docker_webui_windows_smoke_evidence.v1"
    gate_id = "clean_windows_vm"
    status = "passed"
    host_platform = "win32"
    observed_at = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
    installer_command = $installerCommand
    diagnostics_dir = $diagnosticsRelative
  }
  $manifest[$accessReceiptField] = $accessReceiptRelative
  Set-Content -Path $manifestPath -Value ($manifest | ConvertTo-Json -Depth 4) -Encoding UTF8
  if (-not (Test-Path -LiteralPath $accessReceiptPath)) {
    throw "Missing WebUI access receipt: $accessReceiptPath"
  }
  $readme = @(
    "One Person Lab Docker/WebUI clean Windows VM evidence",
    "",
    "Upload this directory as the Windows clean VM evidence artifact.",
    "The installer collected the WebUI access receipt through the browser backend",
    "without putting access material in installer arguments or diagnostics.",
    "",
    "Validate from the App repo:",
    "npm run smoke:docker-webui:windows-clean-vm -- --evidence <this-directory> --artifacts tmp/docker-webui-smoke/windows-clean-import",
    "",
    "Expected files:",
    "- windows-smoke-evidence.json",
    "- diagnostics/",
    "- access receipt JSON"
  ) -join "`n"
  Write-DiagnosticText -PathValue $readmePath -Content $readme
  Write-Step "Windows smoke evidence manifest written: $manifestPath"
}

function Write-WindowsEvidenceArchive {
  param(
    [Parameter(Mandatory = $true)][string]$SourceDir,
    [Parameter(Mandatory = $true)][string]$ArchivePath
  )

  if ([string]::IsNullOrWhiteSpace($SourceDir) -or [string]::IsNullOrWhiteSpace($ArchivePath)) {
    return
  }
  if ($DryRun) {
    Write-Step "Dry run: would write Windows smoke evidence archive $ArchivePath"
    return
  }
  if (-not (Test-Path -LiteralPath (Join-Path $SourceDir "windows-smoke-evidence.json"))) {
    throw "Windows smoke evidence archive requires windows-smoke-evidence.json in $SourceDir"
  }
  $archiveParent = Split-Path -Parent ([System.IO.Path]::GetFullPath($ArchivePath))
  if (-not [string]::IsNullOrWhiteSpace($archiveParent)) {
    New-Item -ItemType Directory -Force -Path $archiveParent | Out-Null
  }
  if (Test-Path -LiteralPath $ArchivePath) {
    Remove-Item -LiteralPath $ArchivePath -Force
  }
  Compress-Archive -Path (Join-Path $SourceDir "*") -DestinationPath $ArchivePath -Force
  Write-Step "Windows smoke evidence archive written: $ArchivePath"
}

function Wait-WebUiHealth {
  param(
    [Parameter(Mandatory = $true)][string]$Url,
    [Parameter(Mandatory = $true)][int]$TimeoutSeconds,
    [Parameter(Mandatory = $true)][string]$ComposePath,
    [Parameter(Mandatory = $true)][string]$ImageReference,
    [Parameter(Mandatory = $true)][string]$DataPath,
    [Parameter(Mandatory = $true)][string]$ProjectsPath,
    [Parameter(Mandatory = $true)][int]$HostPort
  )

  if ($DryRun) {
    Write-Step "Dry run: would wait up to ${TimeoutSeconds}s for WebUI HTTP health at $Url."
    return
  }

  Write-Step "Waiting up to ${TimeoutSeconds}s for WebUI HTTP health at $Url."
  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  while ((Get-Date) -lt $deadline) {
    if (Test-WebUiHttpHealth -Url $Url) {
      Write-Step "WebUI HTTP health check passed: $Url"
      return
    }
    Start-Sleep -Seconds 2
  }

  $failureDir = $DiagnosticsDir
  if ([string]::IsNullOrWhiteSpace($failureDir)) {
    $failureDir = Join-Path (Join-Path (Split-Path -Parent $ComposePath) "diagnostics") ("opl-webui-health-timeout-" + (Get-Date -Format "yyyyMMdd-HHmmss"))
  }
  Collect-WebUiDiagnostics -Reason "health-timeout" -TargetDir $failureDir -ComposePath $ComposePath -ImageReference $ImageReference -DataPath $DataPath -ProjectsPath $ProjectsPath -HostPort $HostPort -Url $Url | Out-Null
  throw "WebUI did not become reachable at $Url within ${TimeoutSeconds}s. Diagnostic directory: $failureDir"
}

function Open-WebUiBrowser {
  param([Parameter(Mandatory = $true)][string]$Url)

  if ($NoOpen) {
    return
  }
  if ($DryRun) {
    Write-Step "Dry run: would open $Url"
    return
  }
  Start-Process $Url
}

if ($EnableAutoUpdate -and $DisableAutoUpdate) {
  throw "Use only one of -EnableAutoUpdate or -DisableAutoUpdate."
}

$tagWasProvided = $PSBoundParameters.ContainsKey("Tag")
if ([string]::IsNullOrWhiteSpace($DataDir)) {
  $userProfile = Get-DefaultUserProfile
  $defaultRoot = Join-Path $userProfile "OnePersonLab"
  $DataDir = Join-Path $defaultRoot "data"
}
if ([string]::IsNullOrWhiteSpace($ProjectsDir)) {
  if ($null -eq (Get-Variable -Name defaultRoot -ErrorAction SilentlyContinue)) {
    $userProfile = Get-DefaultUserProfile
    $defaultRoot = Join-Path $userProfile "OnePersonLab"
  }
  $ProjectsDir = Join-Path $defaultRoot "projects"
}

$resolvedDataDir = Resolve-FullPath $DataDir
$resolvedProjectsDir = Resolve-FullPath $ProjectsDir
$composeDir = Split-Path -Parent $resolvedDataDir
$composePath = Join-Path $composeDir "compose.yaml"
$autoUpdaterPath = Join-Path $composeDir "updater\update-webui.ps1"
$resolvedEvidenceDir = ""
if (-not [string]::IsNullOrWhiteSpace($EvidenceDir)) {
  $resolvedEvidenceDir = Resolve-FullPath $EvidenceDir
  if ([string]::IsNullOrWhiteSpace($DiagnosticsDir)) {
    $DiagnosticsDir = Join-Path $resolvedEvidenceDir "diagnostics"
  }
}
$resolvedEvidenceArchive = ""
if (-not [string]::IsNullOrWhiteSpace($EvidenceArchive)) {
  if ([string]::IsNullOrWhiteSpace($resolvedEvidenceDir)) {
    throw "-EvidenceArchive requires -EvidenceDir so the installer knows which evidence directory to package."
  }
  $resolvedEvidenceArchive = Resolve-FullPath $EvidenceArchive
}
$requestedImageReference = Resolve-ImageReference -ImageName $Image -ImageTag $Tag -TagWasProvided $tagWasProvided
if ($EnableAutoUpdate -and $requestedImageReference -ne "ghcr.io/gaofeng21cn/one-person-lab-webui:latest") {
  throw "-EnableAutoUpdate supports only the default ghcr.io/gaofeng21cn/one-person-lab-webui:latest channel. Use -Update manually for custom images, tags, or digests."
}
if ([string]::IsNullOrWhiteSpace($HealthUrl)) {
  $HealthUrl = "http://localhost:$Port/"
}
$url = $HealthUrl

Assert-WindowsHost
Assert-PowerShellVersion
if ($DisableAutoUpdate) {
  Disable-WebUiAutoUpdate -UpdaterPath $autoUpdaterPath
  exit 0
}
Assert-DockerCli
Assert-DockerCompose
Assert-Wsl2
$imageReference = Resolve-PinnedImageReference -RequestedImageReference $requestedImageReference
Confirm-Run -ComposePath $composePath -DataPath $resolvedDataDir -ProjectsPath $resolvedProjectsDir -Url $url

$script:PreDataInventory = Get-PathInventoryText -PathValue $resolvedDataDir
$script:PreProjectsInventory = Get-PathInventoryText -PathValue $resolvedProjectsDir
New-DirectoryIfNeeded $composeDir
New-DirectoryIfNeeded $resolvedDataDir
New-DirectoryIfNeeded $resolvedProjectsDir
Write-ComposeFile -ComposePath $composePath -ImageReference $imageReference -HostDataDir $resolvedDataDir -HostProjectsDir $resolvedProjectsDir -HostPort $Port

Write-Step "Requested WebUI image: $requestedImageReference"
Write-Step "Pinned WebUI image: $imageReference"
Write-Step "Runtime pull policy: pull_policy: always is disabled; compose uses pull_policy: missing with the pinned digest."
Write-Step "Data directory: $resolvedDataDir"
Write-Step "Projects directory: $resolvedProjectsDir"
Write-Step "Compose file: $composePath"
Write-Step "Browser URL: $url"
if ($Update) {
  Write-Step "Update mode: pull the configured WebUI image from the host and recreate the compose service at the resolved digest."
} else {
  Write-Step "Update model: rerun this installer to resolve the channel once again; compose never follows a moving tag at runtime."
}
Write-Step "Image/seed: default latest WebUI image uses the full seed; -Tag and -Image are advanced overrides."
Write-Step "Gateway account credentials and API keys are entered inside WebUI first-run or Settings -> Account & Access. This script does not accept or write them."
Write-UserPathStatus -Url $url

try {
  Invoke-DockerComposeUp -ComposePath $composePath -Url $url
} catch {
  if (-not [string]::IsNullOrWhiteSpace($DiagnosticsDir) -or -not [string]::IsNullOrWhiteSpace($DiagnosticsArchive)) {
    Collect-WebUiDiagnostics -Reason "compose-up-failed" -TargetDir $DiagnosticsDir -ComposePath $composePath -ImageReference $imageReference -DataPath $resolvedDataDir -ProjectsPath $resolvedProjectsDir -HostPort $Port -Url $url | Out-Null
  }
  throw
}
Wait-WebUiHealth -Url $url -TimeoutSeconds $HealthTimeoutSeconds -ComposePath $composePath -ImageReference $imageReference -DataPath $resolvedDataDir -ProjectsPath $resolvedProjectsDir -HostPort $Port
if ($EnableAutoUpdate) {
  Register-WebUiAutoUpdate -UpdaterPath $autoUpdaterPath -DataPath $resolvedDataDir -ProjectsPath $resolvedProjectsDir -HostPort $Port -Url $url -TimeoutSeconds $HealthTimeoutSeconds
} elseif (-not $Update) {
  Write-Step "Automatic WebUI updates are not enabled. Rerun with -EnableAutoUpdate or run -Update at least monthly."
}
if (-not [string]::IsNullOrWhiteSpace($resolvedEvidenceDir)) {
  Write-WebUiAccessReceipt -TargetDir $resolvedEvidenceDir -Url $url
}
if (-not [string]::IsNullOrWhiteSpace($DiagnosticsDir) -or -not [string]::IsNullOrWhiteSpace($DiagnosticsArchive)) {
  $collectedDiagnosticsDir = Collect-WebUiDiagnostics -Reason "requested" -TargetDir $DiagnosticsDir -ComposePath $composePath -ImageReference $imageReference -DataPath $resolvedDataDir -ProjectsPath $resolvedProjectsDir -HostPort $Port -Url $url
  if (-not [string]::IsNullOrWhiteSpace($resolvedEvidenceDir)) {
    Write-WindowsSmokeEvidence -TargetDir $resolvedEvidenceDir -DiagnosticsPath $collectedDiagnosticsDir
    if (-not [string]::IsNullOrWhiteSpace($resolvedEvidenceArchive)) {
      Write-WindowsEvidenceArchive -SourceDir $resolvedEvidenceDir -ArchivePath $resolvedEvidenceArchive
    }
  }
}
Open-WebUiBrowser -Url $url

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
  [int]$HealthTimeoutSeconds = 120,
  [string]$HealthUrl,
  [string]$DiagnosticsDir,
  [string]$DiagnosticsArchive,
  [switch]$InstallPrerequisites,
  [switch]$NoOpen,
  [switch]$Foreground
)

Set-StrictMode -Version 3.0
$ErrorActionPreference = "Stop"
$script:PreDataInventory = ""
$script:PreProjectsInventory = ""

function Write-Step {
  param([string]$Message)
  Write-Host "[One Person Lab] $Message"
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
  $redacted = $Text -replace "(?i)([A-Za-z0-9_.-]*(api[_-]?key|token|credential)[A-Za-z0-9_.-]*\s*[:=]\s*)[^\s`"']+", '$1[redacted]'
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
  $dockerDesktop = @(
    Join-Path ${env:ProgramFiles} "Docker\Docker\Docker Desktop.exe"
    Join-Path ${env:LOCALAPPDATA} "Docker\Docker Desktop.exe"
  ) | Where-Object { -not [string]::IsNullOrWhiteSpace($_) -and (Test-Path $_) } | Select-Object -First 1

  if ($null -eq $dockerDesktop) {
    return
  }
  if ($DryRun) {
    Write-Step "Dry run: would start Docker Desktop at $dockerDesktop"
    return
  }
  Write-Step "Starting Docker Desktop."
  Start-Process -FilePath $dockerDesktop | Out-Null
}

function Wait-DockerDaemon {
  if ($DryRun) {
    return
  }
  for ($i = 1; $i -le 90; $i++) {
    $infoOutput = & docker info --format "{{.ServerVersion}}" 2>&1
    if ($LASTEXITCODE -eq 0) {
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

  & docker version --format "{{.Client.Version}}" | Out-Null
  $infoOutput = & docker info --format "{{.ServerVersion}}" 2>&1
  if ($LASTEXITCODE -ne 0) {
    if ($InstallPrerequisites) {
      Start-DockerDesktopIfPresent
      Wait-DockerDaemon
      Write-Step "Docker CLI and Docker Desktop daemon are available."
      return
    }
    throw "Docker CLI is installed but Docker Desktop is not ready. Open Docker Desktop, wait until it is running, then rerun this script. Details: $infoOutput"
  }
  Write-Step "Docker CLI and Docker Desktop daemon are available."
}

function Assert-DockerCompose {
  if ($DryRun) {
    Write-Step "Dry run: would check Docker Compose plugin availability."
    return
  }

  $composeOutput = & docker compose version 2>&1
  if ($LASTEXITCODE -ne 0) {
    throw "Docker Compose plugin is not available. Update Docker Desktop, then rerun this script. Details: $composeOutput"
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

function Invoke-DockerComposeUp {
  param(
    [Parameter(Mandatory = $true)][string]$ComposePath,
    [Parameter(Mandatory = $true)][string]$Url
  )

  $composeArgs = @("compose", "-f", $ComposePath, "up")
  if (-not $Foreground) {
    $composeArgs += "-d"
  }

  $displayCommand = "docker " + (($composeArgs | ForEach-Object { if ($_ -match "\s") { '"' + $_ + '"' } else { $_ } }) -join " ")
  if ($DryRun) {
    Write-Step "Dry run: would run $displayCommand"
    return
  }

  Write-Step "Running $displayCommand"
  & docker @composeArgs
  if ($LASTEXITCODE -ne 0) {
    throw "Docker Compose failed. Check Docker Desktop status and the compose file at $ComposePath, then rerun this script."
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
    } else {
      $lines.Add("path=$pathValue exists=true mode=$($item.Mode) length=$($item.Length)")
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
$imageReference = Resolve-ImageReference -ImageName $Image -ImageTag $Tag -TagWasProvided $tagWasProvided
if ([string]::IsNullOrWhiteSpace($HealthUrl)) {
  $HealthUrl = "http://localhost:$Port/"
}
$url = $HealthUrl

Assert-WindowsHost
Assert-PowerShellVersion
Assert-DockerCli
Assert-DockerCompose
Assert-Wsl2
Confirm-Run -ComposePath $composePath -DataPath $resolvedDataDir -ProjectsPath $resolvedProjectsDir -Url $url

$script:PreDataInventory = Get-PathInventoryText -PathValue $resolvedDataDir
$script:PreProjectsInventory = Get-PathInventoryText -PathValue $resolvedProjectsDir
New-DirectoryIfNeeded $composeDir
New-DirectoryIfNeeded $resolvedDataDir
New-DirectoryIfNeeded $resolvedProjectsDir
Write-ComposeFile -ComposePath $composePath -ImageReference $imageReference -HostDataDir $resolvedDataDir -HostProjectsDir $resolvedProjectsDir -HostPort $Port

Write-Step "WebUI image: $imageReference"
Write-Step "Data directory: $resolvedDataDir"
Write-Step "Projects directory: $resolvedProjectsDir"
Write-Step "Compose file: $composePath"
Write-Step "Browser URL: $url"
Write-Step "Access keys are configured inside the WebUI first-run Access panel or Settings -> Access. This script does not accept or write API keys."

try {
  Invoke-DockerComposeUp -ComposePath $composePath -Url $url
} catch {
  if (-not [string]::IsNullOrWhiteSpace($DiagnosticsDir) -or -not [string]::IsNullOrWhiteSpace($DiagnosticsArchive)) {
    Collect-WebUiDiagnostics -Reason "compose-up-failed" -TargetDir $DiagnosticsDir -ComposePath $composePath -ImageReference $imageReference -DataPath $resolvedDataDir -ProjectsPath $resolvedProjectsDir -HostPort $Port -Url $url | Out-Null
  }
  throw
}
Wait-WebUiHealth -Url $url -TimeoutSeconds $HealthTimeoutSeconds -ComposePath $composePath -ImageReference $imageReference -DataPath $resolvedDataDir -ProjectsPath $resolvedProjectsDir -HostPort $Port
if (-not [string]::IsNullOrWhiteSpace($DiagnosticsDir) -or -not [string]::IsNullOrWhiteSpace($DiagnosticsArchive)) {
  Collect-WebUiDiagnostics -Reason "requested" -TargetDir $DiagnosticsDir -ComposePath $composePath -ImageReference $imageReference -DataPath $resolvedDataDir -ProjectsPath $resolvedProjectsDir -HostPort $Port -Url $url | Out-Null
}
Open-WebUiBrowser -Url $url

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
  [switch]$NoOpen,
  [switch]$Detach
)

Set-StrictMode -Version 3.0
$ErrorActionPreference = "Stop"

function Write-Step {
  param([string]$Message)
  Write-Host "[One Person Lab] $Message"
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
    Write-Step "Dry run: would check Docker Desktop/docker CLI availability."
    return
  }

  $docker = Get-Command docker -ErrorAction SilentlyContinue
  if ($null -eq $docker) {
    throw "docker CLI was not found. Install Docker Desktop, for example: winget install Docker.DockerDesktop, then open Docker Desktop and rerun this script."
  }

  & docker version --format "{{.Client.Version}}" | Out-Null
  $infoOutput = & docker info --format "{{.ServerVersion}}" 2>&1
  if ($LASTEXITCODE -ne 0) {
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
    Write-Step "Dry run: would check WSL 2 availability with wsl --status."
    return
  }

  $wsl = Get-Command wsl.exe -ErrorAction SilentlyContinue
  if ($null -eq $wsl) {
    throw "WSL is not available. Run 'wsl --install' from an elevated PowerShell if Windows asks for it, reboot if prompted, then install/open Docker Desktop."
  }

  $statusOutput = & wsl.exe --status 2>&1
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
  if ($Detach) {
    $composeArgs += "-d"
  }

  $displayCommand = "docker " + (($composeArgs | ForEach-Object { if ($_ -match "\s") { '"' + $_ + '"' } else { $_ } }) -join " ")
  if ($DryRun) {
    Write-Step "Dry run: would run $displayCommand"
    if (-not $NoOpen) {
      Write-Step "Dry run: would open $Url"
    }
    return
  }

  Write-Step "Running $displayCommand"
  & docker @composeArgs
  if ($LASTEXITCODE -ne 0) {
    throw "Docker Compose failed. Check Docker Desktop status and the compose file at $ComposePath, then rerun this script."
  }

  if (-not $NoOpen) {
    Start-Process $Url
  }
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
$url = "http://localhost:$Port/"

Assert-WindowsHost
Assert-PowerShellVersion
Assert-DockerCli
Assert-DockerCompose
Assert-Wsl2
Confirm-Run -ComposePath $composePath -DataPath $resolvedDataDir -ProjectsPath $resolvedProjectsDir -Url $url

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

Invoke-DockerComposeUp -ComposePath $composePath -Url $url

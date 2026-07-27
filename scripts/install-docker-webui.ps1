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
  [ValidateRange(30, 7200)]
  [int]$DockerPullTimeoutSeconds = 1800,
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
  Write-Step "  daily_start: use the One Person Lab desktop shortcut to start Docker Desktop, wait for WebUI health, and open the browser."
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

function Refresh-ProcessPathFromEnvironment {
  param(
    [AllowNull()][string]$MachinePath,
    [AllowNull()][string]$UserPath
  )

  if (-not $PSBoundParameters.ContainsKey("MachinePath")) {
    $MachinePath = [System.Environment]::GetEnvironmentVariable("Path", [System.EnvironmentVariableTarget]::Machine)
  }
  if (-not $PSBoundParameters.ContainsKey("UserPath")) {
    $UserPath = [System.Environment]::GetEnvironmentVariable("Path", [System.EnvironmentVariableTarget]::User)
  }
  $segments = [System.Collections.Generic.List[string]]::new()
  $seen = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::OrdinalIgnoreCase)
  foreach ($value in @(
      $MachinePath,
      $UserPath,
      $env:Path
    )) {
    if ([string]::IsNullOrWhiteSpace($value)) {
      continue
    }
    foreach ($segment in ($value -split [regex]::Escape([string][System.IO.Path]::PathSeparator))) {
      $trimmed = $segment.Trim()
      if (-not [string]::IsNullOrWhiteSpace($trimmed) -and $seen.Add($trimmed)) {
        $segments.Add($trimmed) | Out-Null
      }
    }
  }
  $env:Path = $segments -join [System.IO.Path]::PathSeparator
}

function Resolve-DockerDesktopApplicationPath {
  $candidates = [System.Collections.Generic.List[string]]::new()
  if (-not [string]::IsNullOrWhiteSpace($env:ProgramFiles)) {
    $candidates.Add((Join-Path $env:ProgramFiles "Docker\Docker\Docker Desktop.exe")) | Out-Null
  }
  if (-not [string]::IsNullOrWhiteSpace($env:LOCALAPPDATA)) {
    $candidates.Add((Join-Path $env:LOCALAPPDATA "Programs\DockerDesktop\Docker Desktop.exe")) | Out-Null
    $candidates.Add((Join-Path $env:LOCALAPPDATA "Docker\Docker Desktop.exe")) | Out-Null
    $candidates.Add((Join-Path $env:LOCALAPPDATA "Programs\Docker\Docker Desktop.exe")) | Out-Null
    $candidates.Add((Join-Path $env:LOCALAPPDATA "Programs\Docker\Docker\Docker Desktop.exe")) | Out-Null
  }
  foreach ($candidate in $candidates) {
    if (Test-Path -LiteralPath $candidate -PathType Leaf) {
      return [System.IO.Path]::GetFullPath($candidate)
    }
  }
  return $null
}

function Resolve-DockerCliPath {
  $command = Get-Command docker.exe -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($null -ne $command) {
    $commandPath = if (-not [string]::IsNullOrWhiteSpace($command.Source)) { $command.Source } else { $command.Path }
    if (-not [string]::IsNullOrWhiteSpace($commandPath) -and (Test-Path -LiteralPath $commandPath -PathType Leaf)) {
      return [System.IO.Path]::GetFullPath($commandPath)
    }
  }

  $candidates = [System.Collections.Generic.List[string]]::new()
  if (-not [string]::IsNullOrWhiteSpace($env:ProgramFiles)) {
    $candidates.Add((Join-Path $env:ProgramFiles "Docker\Docker\resources\bin\docker.exe")) | Out-Null
  }
  if (-not [string]::IsNullOrWhiteSpace($env:LOCALAPPDATA)) {
    $candidates.Add((Join-Path $env:LOCALAPPDATA "Programs\DockerDesktop\resources\bin\docker.exe")) | Out-Null
    $candidates.Add((Join-Path $env:LOCALAPPDATA "Docker\resources\bin\docker.exe")) | Out-Null
    $candidates.Add((Join-Path $env:LOCALAPPDATA "Programs\Docker\resources\bin\docker.exe")) | Out-Null
    $candidates.Add((Join-Path $env:LOCALAPPDATA "Programs\Docker\Docker\resources\bin\docker.exe")) | Out-Null
  }
  foreach ($candidate in $candidates) {
    if (Test-Path -LiteralPath $candidate -PathType Leaf) {
      return [System.IO.Path]::GetFullPath($candidate)
    }
  }
  return $null
}

function Invoke-DiagnosticDockerCommand {
  param(
    [Parameter(Mandatory = $true)][string]$DockerCliPath,
    [Parameter(Mandatory = $true)][string]$OutputPath,
    [Parameter(Mandatory = $true)][string[]]$Arguments
  )

  $display = "docker " + (($Arguments | ForEach-Object { if ($_ -match "\s") { '"' + $_ + '"' } else { $_ } }) -join " ")
  $output = & $DockerCliPath @Arguments 2>&1 | Out-String
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
  if ($null -ne (Resolve-DockerCliPath) -or $null -ne (Resolve-DockerDesktopApplicationPath)) {
    Write-Step "Docker Desktop is already installed; skipping duplicate winget installation."
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
  Refresh-ProcessPathFromEnvironment
}

function Start-DockerDesktopIfPresent {
  param([Parameter(Mandatory = $true)][string]$DockerCliPath)

  if ($DryRun) {
    Write-Step "Dry run: would ask Docker Desktop to start."
    return
  }

  Write-Step "Starting Docker Desktop."
  $desktopStart = Invoke-DockerCommandCapture `
    -DockerCliPath $DockerCliPath `
    -Arguments @("desktop", "start") `
    -TimeoutSeconds 30
  if ($desktopStart.ExitCode -eq 0) {
    return
  }

  $dockerDesktop = Resolve-DockerDesktopApplicationPath

  if ($null -eq $dockerDesktop) {
    throw "Docker CLI is installed but Docker Desktop could not be started. Open Docker Desktop, finish any setup prompts, then rerun this script. Details: $($desktopStart.Output)"
  }
  Write-Step "Docker Desktop CLI start was unavailable; starting the installed app."
  Start-Process -FilePath $dockerDesktop | Out-Null
}

function Convert-ToWindowsProcessArgument {
  param([Parameter(Mandatory = $true)][string]$Value)

  if ($Value.Length -eq 0) {
    return '""'
  }
  if ($Value -notmatch '[\s"]') {
    return $Value
  }
  $quoted = [System.Text.StringBuilder]::new()
  [void]$quoted.Append('"')
  $backslashCount = 0
  foreach ($character in $Value.ToCharArray()) {
    if ($character -eq '\') {
      $backslashCount++
      continue
    }
    if ($character -eq '"') {
      [void]$quoted.Append([string]::new([char]92, ($backslashCount * 2) + 1))
      [void]$quoted.Append('"')
      $backslashCount = 0
      continue
    }
    if ($backslashCount -gt 0) {
      [void]$quoted.Append([string]::new([char]92, $backslashCount))
      $backslashCount = 0
    }
    [void]$quoted.Append($character)
  }
  if ($backslashCount -gt 0) {
    [void]$quoted.Append([string]::new([char]92, $backslashCount * 2))
  }
  [void]$quoted.Append('"')
  return $quoted.ToString()
}

function Invoke-DockerCommandCaptureWithTimeout {
  param(
    [Parameter(Mandatory = $true)][string]$DockerCliPath,
    [Parameter(Mandatory = $true)][string[]]$Arguments,
    [Parameter(Mandatory = $true)][int]$TimeoutSeconds,
    [switch]$StreamOutput
  )

  $argumentLine = (@($Arguments | ForEach-Object { Convert-ToWindowsProcessArgument -Value $_ }) -join ' ')
  $process = [System.Diagnostics.Process]::new()
  try {
    $startInfo = [System.Diagnostics.ProcessStartInfo]::new()
    $startInfo.FileName = $DockerCliPath
    $startInfo.Arguments = $argumentLine
    $startInfo.UseShellExecute = $false
    $startInfo.CreateNoWindow = $true
    $startInfo.RedirectStandardOutput = $true
    $startInfo.RedirectStandardError = $true
    $process.StartInfo = $startInfo
    if (-not $process.Start()) {
      throw "Docker process did not start."
    }
    $streamStates = @(
      [pscustomobject]@{
        Reader = $process.StandardOutput
        Buffer = (New-Object char[] 4096)
        PendingRead = $null
        Completed = $false
      },
      [pscustomobject]@{
        Reader = $process.StandardError
        Buffer = (New-Object char[] 4096)
        PendingRead = $null
        Completed = $false
      }
    )
    foreach ($streamState in $streamStates) {
      $streamState.PendingRead = $streamState.Reader.ReadAsync(
        $streamState.Buffer,
        0,
        $streamState.Buffer.Length
      )
    }
    $output = [System.Text.StringBuilder]::new()
    $drainOutput = {
      $receivedOutput = $false
      foreach ($streamState in $streamStates) {
        while (-not $streamState.Completed -and $streamState.PendingRead.IsCompleted) {
          $readCount = $streamState.PendingRead.GetAwaiter().GetResult()
          if ($readCount -le 0) {
            $streamState.Completed = $true
            break
          }
          $chunk = [string]::new($streamState.Buffer, 0, $readCount)
          [void]$output.Append($chunk)
          if ($StreamOutput) {
            Write-Host $chunk -NoNewline
          }
          $receivedOutput = $true
          $streamState.PendingRead = $streamState.Reader.ReadAsync(
            $streamState.Buffer,
            0,
            $streamState.Buffer.Length
          )
        }
      }
      return $receivedOutput
    }.GetNewClosure()

    $outputWasStreamed = $false
    $startedAt = Get-Date
    $deadline = $startedAt.AddSeconds($TimeoutSeconds)
    $nextHeartbeatAt = $startedAt.AddSeconds(20)
    $timedOut = $false
    $processExited = $false

    while (-not $processExited -or @($streamStates | Where-Object { -not $_.Completed }).Count -gt 0) {
      if (-not $processExited) {
        $processExited = $process.WaitForExit(250)
      } else {
        Start-Sleep -Milliseconds 50
      }
      if (& $drainOutput) {
        if ($StreamOutput) {
          $outputWasStreamed = $true
          $nextHeartbeatAt = (Get-Date).AddSeconds(20)
        }
      } elseif ($StreamOutput -and (Get-Date) -ge $nextHeartbeatAt) {
        $elapsedSeconds = [math]::Floor(((Get-Date) - $startedAt).TotalSeconds)
        Write-Step "Docker is still downloading the WebUI image (${elapsedSeconds}s without new layer output). If this persists, set the proxy in Docker Desktop -> Settings -> Resources -> Proxies; Windows proxy/VPN settings are not always inherited by Docker Engine."
        $nextHeartbeatAt = (Get-Date).AddSeconds(20)
      }
      if (-not $processExited -and (Get-Date) -ge $deadline) {
        $timedOut = $true
        break
      }
    }

    if ($timedOut) {
      $process.Kill()
      $process.WaitForExit()
    } else {
      $process.WaitForExit()
    }
    if (& $drainOutput) {
      if ($StreamOutput) {
        $outputWasStreamed = $true
      }
    }
    $outputText = $output.ToString().Trim()

    if ($timedOut) {
      return [pscustomobject]@{
        ExitCode = 124
        Output = $outputText
        TimedOut = $true
        OutputWasStreamed = $outputWasStreamed
      }
    }
    return [pscustomobject]@{
      ExitCode = $process.ExitCode
      Output = $outputText
      TimedOut = $false
      OutputWasStreamed = $outputWasStreamed
    }
  } finally {
    $process.Dispose()
  }
}

function Invoke-DockerCommandCapture {
  param(
    [Parameter(Mandatory = $true)][string]$DockerCliPath,
    [Parameter(Mandatory = $true)][string[]]$Arguments,
    [ValidateRange(1, 900)][int]$TimeoutSeconds = 120
  )

  return Invoke-DockerCommandCaptureWithTimeout `
    -DockerCliPath $DockerCliPath `
    -Arguments $Arguments `
    -TimeoutSeconds $TimeoutSeconds
}

function Test-PublicOplGhcrImageReference {
  param([Parameter(Mandatory = $true)][string]$ImageReference)

  return $ImageReference -match '(?i)^ghcr\.io/gaofeng21cn/one-person-lab-webui(?::|@|$)'
}

function Invoke-PublicGhcrAnonymousDockerCommandCapture {
  param(
    [Parameter(Mandatory = $true)][string]$DockerCliPath,
    [Parameter(Mandatory = $true)][string[]]$Arguments,
    [Parameter(Mandatory = $true)][int]$TimeoutSeconds,
    [switch]$StreamOutput
  )

  $temporaryConfigDir = Join-Path ([System.IO.Path]::GetTempPath()) ("opl-docker-anonymous-" + [Guid]::NewGuid().ToString('N'))
  try {
    New-Item -ItemType Directory -Force -Path $temporaryConfigDir | Out-Null
    Set-Content `
      -LiteralPath (Join-Path $temporaryConfigDir 'config.json') `
      -Value '{"auths":{}}' `
      -Encoding ASCII
    return Invoke-DockerCommandCaptureWithTimeout `
      -DockerCliPath $DockerCliPath `
      -Arguments (@('--config', $temporaryConfigDir) + $Arguments) `
      -TimeoutSeconds $TimeoutSeconds `
      -StreamOutput:$StreamOutput
  } finally {
    Remove-Item -LiteralPath $temporaryConfigDir -Force -Recurse -ErrorAction SilentlyContinue
  }
}

function Invoke-DockerPullWithPublicGhcrIsolation {
  param(
    [Parameter(Mandatory = $true)][string]$DockerCliPath,
    [Parameter(Mandatory = $true)][string[]]$Arguments,
    [Parameter(Mandatory = $true)][string]$ImageReference
  )

  if (Test-PublicOplGhcrImageReference -ImageReference $ImageReference) {
    Write-Step 'Pulling the public OPL GHCR image with an isolated anonymous Docker config.'
    return Invoke-PublicGhcrAnonymousDockerCommandCapture `
      -DockerCliPath $DockerCliPath `
      -Arguments $Arguments `
      -TimeoutSeconds $DockerPullTimeoutSeconds `
      -StreamOutput
  }
  return Invoke-DockerCommandCaptureWithTimeout `
    -DockerCliPath $DockerCliPath `
    -Arguments $Arguments `
    -TimeoutSeconds $DockerPullTimeoutSeconds `
    -StreamOutput
}

function Wait-DockerDaemon {
  param([Parameter(Mandatory = $true)][string]$DockerCliPath)

  if ($DryRun) {
    return
  }
  for ($i = 1; $i -le 45; $i++) {
    $info = Invoke-DockerCommandCapture `
      -DockerCliPath $DockerCliPath `
      -Arguments @("info", "--format", "{{.ServerVersion}}") `
      -TimeoutSeconds 2
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
  param(
    [Parameter(Mandatory = $true)][string]$DockerCliPath,
    [Parameter(Mandatory = $true)][string]$RequestedImageReference
  )

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
  $pull = Invoke-DockerPullWithPublicGhcrIsolation `
    -DockerCliPath $DockerCliPath `
    -Arguments @("pull", $RequestedImageReference) `
    -ImageReference $RequestedImageReference
  if (-not $pull.OutputWasStreamed -and -not [string]::IsNullOrWhiteSpace($pull.Output)) {
    Write-Host $pull.Output
  }
  if ($pull.TimedOut) {
    throw "Docker did not finish pulling the requested WebUI image within ${DockerPullTimeoutSeconds}s. The stalled pull was stopped. Check GHCR access, proxy/VPN settings, and Docker Desktop networking, then rerun this installer."
  }
  if ($pull.ExitCode -ne 0) {
    throw "Docker could not pull the requested WebUI image. Check Docker/GHCR access and retry. Details: $($pull.Output)"
  }

  if ($RequestedImageReference.Contains("@")) {
    return $RequestedImageReference
  }

  $repository = Get-ImageRepositoryName -ImageReference $RequestedImageReference
  $repoDigestReadback = Invoke-DockerCommandCapture `
    -DockerCliPath $DockerCliPath `
    -Arguments @("image", "inspect", "--format", "{{json .RepoDigests}}", $RequestedImageReference) `
    -TimeoutSeconds 30
  if ($repoDigestReadback.ExitCode -ne 0) {
    throw "Docker could not read the pulled WebUI image RepoDigests: $($repoDigestReadback.Output)"
  }
  $repoDigests = @($repoDigestReadback.Output | ConvertFrom-Json)
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
    restart: unless-stopped
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
    return "docker.exe"
  }

  Refresh-ProcessPathFromEnvironment
  $dockerCliPath = Resolve-DockerCliPath
  if ($null -eq $dockerCliPath) {
    Install-DockerDesktopPrerequisite
    Refresh-ProcessPathFromEnvironment
    $dockerCliPath = Resolve-DockerCliPath
  }
  if ($null -eq $dockerCliPath) {
    if ($null -ne (Resolve-DockerDesktopApplicationPath)) {
      throw "Docker Desktop is installed, but docker.exe could not be found in its supported installation locations. Repair or update Docker Desktop, then rerun this script."
    }
    throw "docker CLI was not found. Install Docker Desktop, for example: winget install Docker.DockerDesktop, then open Docker Desktop and rerun this script."
  }
  $client = Invoke-DockerCommandCapture `
    -DockerCliPath $dockerCliPath `
    -Arguments @("--version") `
    -TimeoutSeconds 10
  if ($client.ExitCode -ne 0) {
    throw "docker CLI could not run. Reinstall or update Docker Desktop, then rerun this script. Details: $($client.Output)"
  }

  $info = Invoke-DockerCommandCapture `
    -DockerCliPath $dockerCliPath `
    -Arguments @("info", "--format", "{{.ServerVersion}}") `
    -TimeoutSeconds 5
  if ($info.ExitCode -ne 0) {
    Start-DockerDesktopIfPresent -DockerCliPath $dockerCliPath
    Wait-DockerDaemon -DockerCliPath $dockerCliPath
    Write-Step "Docker CLI and Docker Desktop daemon are available."
    return $dockerCliPath
  }
  Write-Step "Docker CLI and Docker Desktop daemon are available."
  return $dockerCliPath
}

function Assert-DockerCompose {
  param([Parameter(Mandatory = $true)][string]$DockerCliPath)

  if ($DryRun) {
    Write-Step "Dry run: would check Docker Compose plugin availability."
    return
  }

  $compose = Invoke-DockerCommandCapture `
    -DockerCliPath $DockerCliPath `
    -Arguments @("compose", "version") `
    -TimeoutSeconds 30
  if ($compose.ExitCode -ne 0) {
    throw "Docker Compose plugin is not available. Update Docker Desktop, then rerun this script. Details: $($compose.Output)"
  }
  Write-Step "Docker Compose plugin is available."
}

function Invoke-WslStatus {
  param([Parameter(Mandatory = $true)][string]$WslPath)

  $temporaryDir = Join-Path ([System.IO.Path]::GetTempPath()) ("opl-wsl-status-" + [Guid]::NewGuid().ToString('N'))
  $stdoutPath = Join-Path $temporaryDir "stdout.txt"
  $stderrPath = Join-Path $temporaryDir "stderr.txt"
  try {
    New-Item -ItemType Directory -Force -Path $temporaryDir | Out-Null
    $process = Start-Process `
      -FilePath $WslPath `
      -ArgumentList @("--status") `
      -Wait `
      -PassThru `
      -NoNewWindow `
      -RedirectStandardOutput $stdoutPath `
      -RedirectStandardError $stderrPath
    $output = @(
      if (Test-Path -LiteralPath $stdoutPath -PathType Leaf) {
        Get-Content -LiteralPath $stdoutPath -Raw
      }
      if (Test-Path -LiteralPath $stderrPath -PathType Leaf) {
        Get-Content -LiteralPath $stderrPath -Raw
      }
    ) | Where-Object { -not [string]::IsNullOrWhiteSpace($_) }
    return [pscustomobject]@{
      ExitCode = $process.ExitCode
      Output = ($output -join [Environment]::NewLine).Trim()
    }
  } finally {
    Remove-Item -LiteralPath $temporaryDir -Force -Recurse -ErrorAction SilentlyContinue
  }
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

  $status = Invoke-WslStatus -WslPath $wsl.Source
  if ($status.ExitCode -ne 0) {
    Install-Wsl2Prerequisites
    $status = Invoke-WslStatus -WslPath $wsl.Source
  }
  if ($status.ExitCode -ne 0) {
    throw "WSL status check failed. Run 'wsl --install' from an elevated PowerShell if Windows asks for it, reboot if prompted, then reopen Docker Desktop. Details: $($status.Output)"
  }

  $statusText = $status.Output
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

function Write-WebUiLauncher {
  param(
    [Parameter(Mandatory = $true)][string]$LauncherPath,
    [Parameter(Mandatory = $true)][string]$DockerCliPath,
    [AllowEmptyString()][string]$DockerDesktopPath,
    [Parameter(Mandatory = $true)][string]$ComposePath,
    [Parameter(Mandatory = $true)][string]$Url,
    [Parameter(Mandatory = $true)][int]$TimeoutSeconds
  )

  $dockerDesktopLiteral = if ([string]::IsNullOrWhiteSpace($DockerDesktopPath)) {
    '$null'
  } else {
    Convert-ToPowerShellSingleQuoted $DockerDesktopPath
  }
  $template = @'
[CmdletBinding()]
param()

Set-StrictMode -Version 3.0
$ErrorActionPreference = "Stop"
$dockerCliPath = __DOCKER_CLI__
$dockerDesktopPath = __DOCKER_DESKTOP__
$composePath = __COMPOSE_PATH__
$url = __WEBUI_URL__
$healthTimeoutSeconds = __HEALTH_TIMEOUT__

try {
  $Host.UI.RawUI.WindowTitle = "One Person Lab"
} catch {
}

function Test-DockerReady {
  & $dockerCliPath info --format "{{.ServerVersion}}" 2>$null | Out-Null
  return $LASTEXITCODE -eq 0
}

function Start-OnePersonLabDocker {
  if (Test-DockerReady) {
    return
  }

  Write-Host "[One Person Lab] Starting Docker Desktop..."
  try {
    $desktopStart = Start-Process `
      -FilePath $dockerCliPath `
      -ArgumentList @("desktop", "start") `
      -WindowStyle Hidden `
      -PassThru
    if (-not $desktopStart.WaitForExit(30000)) {
      Stop-Process -Id $desktopStart.Id -Force -ErrorAction SilentlyContinue
    }
  } catch {
  }
  if (-not (Test-DockerReady) -and
      -not [string]::IsNullOrWhiteSpace($dockerDesktopPath) -and
      (Test-Path -LiteralPath $dockerDesktopPath -PathType Leaf)) {
    Start-Process -FilePath $dockerDesktopPath | Out-Null
  }

  $deadline = (Get-Date).AddSeconds(180)
  while ((Get-Date) -lt $deadline) {
    if (Test-DockerReady) {
      return
    }
    Start-Sleep -Seconds 2
  }
  throw "Docker Desktop did not become ready within 180 seconds. Open Docker Desktop and finish any setup prompts."
}

function Test-OnePersonLabHealth {
  try {
    $response = Invoke-WebRequest -Uri $url -Method Head -TimeoutSec 5 -UseBasicParsing -ErrorAction Stop
    return ($response.StatusCode -ge 200 -and $response.StatusCode -lt 400)
  } catch {
    try {
      $response = Invoke-WebRequest -Uri $url -Method Get -TimeoutSec 5 -UseBasicParsing -ErrorAction Stop
      return ($response.StatusCode -ge 200 -and $response.StatusCode -lt 400)
    } catch {
      return $false
    }
  }
}

try {
  if (-not (Test-Path -LiteralPath $composePath -PathType Leaf)) {
    throw "compose.yaml was not found at $composePath. Run the One Person Lab installer once to repair it."
  }

  Start-OnePersonLabDocker
  Write-Host "[One Person Lab] Starting the WebUI container..."
  $composeOutput = & $dockerCliPath compose -f $composePath up -d 2>&1 | Out-String
  if ($LASTEXITCODE -ne 0) {
    throw "Docker Compose failed: $composeOutput"
  }

  Write-Host "[One Person Lab] Waiting for WebUI health..."
  $deadline = (Get-Date).AddSeconds($healthTimeoutSeconds)
  while ((Get-Date) -lt $deadline) {
    if (Test-OnePersonLabHealth) {
      Write-Host "[One Person Lab] Ready. Opening $url"
      Start-Process -FilePath $url
      exit 0
    }
    Start-Sleep -Seconds 2
  }
  throw "WebUI did not become reachable at $url within $healthTimeoutSeconds seconds."
} catch {
  Write-Host ""
  Write-Host "[One Person Lab] Startup failed: $($_.Exception.Message)" -ForegroundColor Red
  Write-Host "Run the installer again to repair the local startup files."
  Read-Host "Press Enter to close this window"
  exit 1
}
'@

  $content = $template.Replace("__DOCKER_CLI__", (Convert-ToPowerShellSingleQuoted $DockerCliPath))
  $content = $content.Replace("__DOCKER_DESKTOP__", $dockerDesktopLiteral)
  $content = $content.Replace("__COMPOSE_PATH__", (Convert-ToPowerShellSingleQuoted $ComposePath))
  $content = $content.Replace("__WEBUI_URL__", (Convert-ToPowerShellSingleQuoted $Url))
  $content = $content.Replace("__HEALTH_TIMEOUT__", [string]$TimeoutSeconds)
  $tokens = $null
  $parseErrors = $null
  [System.Management.Automation.Language.Parser]::ParseInput(
    $content,
    [ref]$tokens,
    [ref]$parseErrors
  ) | Out-Null
  if ($parseErrors.Count -gt 0) {
    $parseSummary = ($parseErrors | ForEach-Object { $_.Message }) -join "; "
    throw "Generated One Person Lab launcher is invalid: $parseSummary"
  }
  if ($DryRun) {
    Write-Step "Dry run: would write daily launcher $LauncherPath"
    return
  }

  $temporaryPath = "$LauncherPath.download"
  Set-Content -LiteralPath $temporaryPath -Value $content -Encoding UTF8
  Move-Item -LiteralPath $temporaryPath -Destination $LauncherPath -Force
}

function Install-WebUiLauncher {
  param(
    [Parameter(Mandatory = $true)][string]$DockerCliPath,
    [Parameter(Mandatory = $true)][string]$ComposePath,
    [Parameter(Mandatory = $true)][string]$Url,
    [Parameter(Mandatory = $true)][int]$TimeoutSeconds
  )

  $installRoot = Split-Path -Parent $ComposePath
  $launcherPath = Join-Path $installRoot "Start-OnePersonLab.ps1"
  $dockerDesktopPath = Resolve-DockerDesktopApplicationPath
  Write-WebUiLauncher `
    -LauncherPath $launcherPath `
    -DockerCliPath $DockerCliPath `
    -DockerDesktopPath $(if ($null -eq $dockerDesktopPath) { "" } else { $dockerDesktopPath }) `
    -ComposePath $ComposePath `
    -Url $Url `
    -TimeoutSeconds $TimeoutSeconds

  if ($DryRun) {
    Write-Step "Dry run: would create desktop shortcut %USERPROFILE%\Desktop\One Person Lab.lnk"
    return
  }

  $desktopPath = [Environment]::GetFolderPath([Environment+SpecialFolder]::DesktopDirectory)
  if ([string]::IsNullOrWhiteSpace($desktopPath)) {
    $desktopPath = Join-Path (Get-DefaultUserProfile) "Desktop"
  }
  New-Item -ItemType Directory -Force -Path $desktopPath | Out-Null
  $shortcutPath = Join-Path $desktopPath "One Person Lab.lnk"
  $powershell = Join-Path $env:SystemRoot "System32\WindowsPowerShell\v1.0\powershell.exe"
  $shell = New-Object -ComObject WScript.Shell
  $shortcut = $shell.CreateShortcut($shortcutPath)
  $shortcut.TargetPath = $powershell
  $shortcut.Arguments = '-NoProfile -ExecutionPolicy Bypass -File "' + $launcherPath + '"'
  $shortcut.WorkingDirectory = $installRoot
  $shortcut.Description = "Start One Person Lab and open the local WebUI"
  $shortcut.IconLocation = "$powershell,0"
  $shortcut.Save()
  Write-Step "Daily launcher installed: $shortcutPath"
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
    Write-Step "Dry run: would register scheduled task $script:AutoUpdateTaskName at $AutoUpdateTime and at the current user's next logon."
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
  $currentUser = [Security.Principal.WindowsIdentity]::GetCurrent().Name
  $triggers = @(
    (New-ScheduledTaskTrigger -Daily -At $scheduleTime),
    (New-ScheduledTaskTrigger -AtLogOn -User $currentUser)
  )
  $settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Minutes 30)
  $principal = New-ScheduledTaskPrincipal -UserId $currentUser -LogonType Interactive -RunLevel Limited
  Register-ScheduledTask `
    -TaskName $script:AutoUpdateTaskName `
    -Action $action `
    -Trigger $triggers `
    -Settings $settings `
    -Principal $principal `
    -Description "Checks the One Person Lab WebUI latest image from the Windows host and preserves data/projects." `
    -Force | Out-Null

  $task = Get-ScheduledTask -TaskName $script:AutoUpdateTaskName -ErrorAction Stop
  $taskInfo = $task | Get-ScheduledTaskInfo
  Write-Step "Automatic WebUI updates enabled: $($task.TaskName), daily at $AutoUpdateTime and at the current user's next logon; next scheduled run $($taskInfo.NextRunTime)."
}

function Invoke-DockerComposeUp {
  param(
    [Parameter(Mandatory = $true)][string]$DockerCliPath,
    [Parameter(Mandatory = $true)][string]$ComposePath,
    [Parameter(Mandatory = $true)][string]$Url,
    [Parameter(Mandatory = $true)][string]$ImageReference
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
    $pull = Invoke-DockerPullWithPublicGhcrIsolation `
      -DockerCliPath $DockerCliPath `
      -Arguments $pullArgs `
      -ImageReference $ImageReference
    if (-not [string]::IsNullOrWhiteSpace($pull.Output)) {
      Write-Host $pull.Output
    }
    if ($pull.TimedOut) {
      throw "Docker Compose did not finish pulling the WebUI image within ${DockerPullTimeoutSeconds}s. The stalled pull was stopped. Check GHCR access, proxy/VPN settings, and Docker Desktop networking, then rerun this installer."
    }
    if ($pull.ExitCode -ne 0) {
      throw "Docker Compose image pull failed. Check Docker/GHCR network access, then rerun this script. Details: $($pull.Output)"
    }
  }
  Write-Step "Running $displayUpCommand"
  $up = Invoke-DockerCommandCapture -DockerCliPath $DockerCliPath -Arguments $upArgs
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
    [Parameter(Mandatory = $true)][string]$DockerCliPath,
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
  Invoke-DiagnosticDockerCommand -DockerCliPath $DockerCliPath -OutputPath (Join-Path $TargetDir "docker-version.txt") -Arguments @("version")
  Invoke-DiagnosticDockerCommand -DockerCliPath $DockerCliPath -OutputPath (Join-Path $TargetDir "docker-compose-version.txt") -Arguments @("compose", "version")
  Invoke-DiagnosticDockerCommand -DockerCliPath $DockerCliPath -OutputPath (Join-Path $TargetDir "docker-compose-ps.txt") -Arguments @("compose", "-f", $ComposePath, "ps")
  Invoke-DiagnosticDockerCommand -DockerCliPath $DockerCliPath -OutputPath (Join-Path $TargetDir "docker-compose-logs.txt") -Arguments @("compose", "-f", $ComposePath, "logs", "--no-color", "--tail=300")
  Invoke-DiagnosticDockerCommand -DockerCliPath $DockerCliPath -OutputPath (Join-Path $TargetDir "docker-image.txt") -Arguments @("image", "inspect", $ImageReference)
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
    [Parameter(Mandatory = $true)][string]$DockerCliPath,
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
  $startedAt = Get-Date
  $deadline = $startedAt.AddSeconds($TimeoutSeconds)
  $nextHeartbeatAt = $startedAt.AddSeconds(20)
  while ((Get-Date) -lt $deadline) {
    if (Test-WebUiHttpHealth -Url $Url) {
      Write-Step "WebUI HTTP health check passed: $Url"
      return
    }
    if ((Get-Date) -ge $nextHeartbeatAt) {
      $elapsedSeconds = [math]::Floor(((Get-Date) - $startedAt).TotalSeconds)
      Write-Step "WebUI is still completing first-time setup (${elapsedSeconds}s). The image download may already be complete; Docker Engine also needs GitHub/GHCR access for initial managed components. If this does not advance, set the proxy in Docker Desktop -> Settings -> Resources -> Proxies."
      $nextHeartbeatAt = (Get-Date).AddSeconds(20)
    }
    Start-Sleep -Seconds 2
  }

  $failureDir = $DiagnosticsDir
  if ([string]::IsNullOrWhiteSpace($failureDir)) {
    $failureDir = Join-Path (Join-Path (Split-Path -Parent $ComposePath) "diagnostics") ("opl-webui-health-timeout-" + (Get-Date -Format "yyyyMMdd-HHmmss"))
  }
  Collect-WebUiDiagnostics -DockerCliPath $DockerCliPath -Reason "health-timeout" -TargetDir $failureDir -ComposePath $ComposePath -ImageReference $ImageReference -DataPath $DataPath -ProjectsPath $ProjectsPath -HostPort $HostPort -Url $Url | Out-Null
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
$dockerCliPath = Assert-DockerCli
Assert-DockerCompose -DockerCliPath $dockerCliPath
Assert-Wsl2
$imageReference = Resolve-PinnedImageReference -DockerCliPath $dockerCliPath -RequestedImageReference $requestedImageReference
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
  Invoke-DockerComposeUp -DockerCliPath $dockerCliPath -ComposePath $composePath -Url $url -ImageReference $imageReference
} catch {
  if (-not [string]::IsNullOrWhiteSpace($DiagnosticsDir) -or -not [string]::IsNullOrWhiteSpace($DiagnosticsArchive)) {
    Collect-WebUiDiagnostics -DockerCliPath $dockerCliPath -Reason "compose-up-failed" -TargetDir $DiagnosticsDir -ComposePath $composePath -ImageReference $imageReference -DataPath $resolvedDataDir -ProjectsPath $resolvedProjectsDir -HostPort $Port -Url $url | Out-Null
  }
  throw
}
Wait-WebUiHealth -DockerCliPath $dockerCliPath -Url $url -TimeoutSeconds $HealthTimeoutSeconds -ComposePath $composePath -ImageReference $imageReference -DataPath $resolvedDataDir -ProjectsPath $resolvedProjectsDir -HostPort $Port
Install-WebUiLauncher -DockerCliPath $dockerCliPath -ComposePath $composePath -Url $url -TimeoutSeconds $HealthTimeoutSeconds
if ($EnableAutoUpdate) {
  Register-WebUiAutoUpdate -UpdaterPath $autoUpdaterPath -DataPath $resolvedDataDir -ProjectsPath $resolvedProjectsDir -HostPort $Port -Url $url -TimeoutSeconds $HealthTimeoutSeconds
} elseif (-not $Update) {
  Write-Step "Automatic WebUI updates are not enabled. Rerun with -EnableAutoUpdate or run -Update at least monthly."
}
if (-not [string]::IsNullOrWhiteSpace($resolvedEvidenceDir)) {
  Write-WebUiAccessReceipt -TargetDir $resolvedEvidenceDir -Url $url
}
if (-not [string]::IsNullOrWhiteSpace($DiagnosticsDir) -or -not [string]::IsNullOrWhiteSpace($DiagnosticsArchive)) {
  $collectedDiagnosticsDir = Collect-WebUiDiagnostics -DockerCliPath $dockerCliPath -Reason "requested" -TargetDir $DiagnosticsDir -ComposePath $composePath -ImageReference $imageReference -DataPath $resolvedDataDir -ProjectsPath $resolvedProjectsDir -HostPort $Port -Url $url
  if (-not [string]::IsNullOrWhiteSpace($resolvedEvidenceDir)) {
    Write-WindowsSmokeEvidence -TargetDir $resolvedEvidenceDir -DiagnosticsPath $collectedDiagnosticsDir
    if (-not [string]::IsNullOrWhiteSpace($resolvedEvidenceArchive)) {
      Write-WindowsEvidenceArchive -SourceDir $resolvedEvidenceDir -ArchivePath $resolvedEvidenceArchive
    }
  }
}
Open-WebUiBrowser -Url $url

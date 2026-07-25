param(
  [Parameter(Mandatory = $true)]
  [ValidateSet('stopped', 'running')]
  [string]$ExpectedPhase,

  [Parameter(Mandatory = $true)]
  [ValidatePattern('^[0-9a-fA-F]{64}$')]
  [string]$ExpectedArtifactSha256,

  [Parameter(Mandatory = $true)]
  [ValidatePattern('^[0-9a-fA-F]{64}$')]
  [string]$ExpectedWriterHandoffSha256,

  [Parameter(Mandatory = $true)]
  [ValidatePattern('^[0-9a-fA-F]{40}$')]
  [string]$AppSha,

  [Parameter(Mandatory = $true)]
  [ValidatePattern('^[0-9a-fA-F]{40}$')]
  [string]$ShellSha,

  [Parameter(Mandatory = $true)]
  [ValidatePattern('^[0-9a-fA-F]{40}$')]
  [string]$FrameworkSha,

  [Parameter(Mandatory = $true)]
  [ValidatePattern('^[a-zA-Z0-9][a-zA-Z0-9._-]{2,80}$')]
  [string]$RunId,

  [Parameter(Mandatory = $true)]
  [ValidatePattern('^[0-9a-f-]{36}$')]
  [string]$PreviousWriterTaskId,

  [Parameter(Mandatory = $true)]
  [ValidatePattern('^[a-zA-Z0-9][a-zA-Z0-9._:-]{2,160}$')]
  [string]$WriterHandoffReceiptId,

  [Parameter(Mandatory = $true)]
  [datetime]$WriterReleasedAt,

  [Parameter(Mandatory = $true)]
  [ValidatePattern('^[a-zA-Z0-9][a-zA-Z0-9._:-]{2,160}$')]
  [string]$VmIdentity,

  [string]$CandidateZipPath = 'C:\Users\oplrunner\OnePersonLabValidation\20260725-wsl2-v6\OPL-Windows-WSL2-Validation-v6.zip',

  [string]$WriterHandoffReceiptPath = 'C:\Users\oplrunner\OnePersonLabValidation\20260725-wsl2-v6\writer-handoff.json',

  [string]$EvidenceRoot = 'C:\Users\oplrunner\OnePersonLabValidation\20260725-wsl2-v6\evidence'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$validationGateName = 'OPL_WINDOWS_WSL2_VALIDATION'
$validationGateValue = '1'
$validationDistro = 'OPL-Validation-g0001'
$approvedArtifactSha256 = '3b126175f77cad7c0b1ddc83f2008d2102539cef29f87dfd839ee70be86df9dd'
$approvedExecutableSha256 = '60b86b47b4557e51e12d6d1f687f1544f420841356cdf1d6bae8523a6ebf6c42'
$approvedShellSha = '868d6e818583547a5ec982b10b34464a3fa47c10'
$approvedFrameworkSha = 'fe1fafa26f2c59922596718b305761bbc7558c9c'
$approvedRoot = 'C:\Users\oplrunner\OnePersonLabValidation\20260725-wsl2-v6'
$expectedZipPath = Join-Path $approvedRoot 'OPL-Windows-WSL2-Validation-v6.zip'
$expectedHandoffReceiptPath = Join-Path $approvedRoot 'writer-handoff.json'
$expectedEvidenceRoot = Join-Path $approvedRoot 'evidence'
$candidateExecutableFileName = 'OPL Windows WSL2 Validation.exe'
$protectedOnePersonLabRoot = 'C:\Users\oplrunner\OnePersonLab'
$wslPath = Join-Path $env:SystemRoot 'System32\wsl.exe'
$candidateProcessName = 'OPL Windows WSL2 Validation.exe'
$windowTitle = 'OPL Windows WSL2 Validation'
$runDirectory = Join-Path $EvidenceRoot $RunId
$receiptPath = Join-Path $runDirectory 'v6-visible-smoke-receipt.json'
$screenshotPath = Join-Path $runDirectory 'v6-visible-window.png'
$runCandidateRoot = Join-Path $runDirectory 'candidate-from-verified-zip'
$launchExecutablePath = Join-Path $runCandidateRoot $candidateExecutableFileName
$rootProcess = $null
$rootProcessStartTime = $null
$launchStartedAt = $null
$trackedProcessIds = [System.Collections.Generic.HashSet[int]]::new()
$ownedProcessIdentity = @{}
$wslProcessIdsBefore = @()
$protectedPathWatch = $null
$validationPhaseSamples = [System.Collections.Generic.List[string]]::new()
$windowHandle = [IntPtr]::Zero
$forcedCleanup = $false
$receiptWritten = $false
$candidateLaunched = $false

function Get-NormalizedPath([string]$PathValue) {
  return [System.IO.Path]::GetFullPath($PathValue).TrimEnd('\')
}

function Assert-ExactPath(
  [string]$Actual,
  [string]$Expected,
  [string]$Label
) {
  $actualPath = Get-NormalizedPath $Actual
  $expectedPath = Get-NormalizedPath $Expected
  if (-not [string]::Equals($actualPath, $expectedPath, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "$Label must use the approved V6 path: $expectedPath"
  }
}

function Invoke-BoundedNative(
  [string]$FilePath,
  [string[]]$Arguments,
  [int]$TimeoutSeconds = 15
) {
  foreach ($argument in $Arguments) {
    if ($argument -notmatch '^[a-zA-Z0-9._/-]+$') {
      throw "Unsupported native argument: $argument"
    }
  }

  $startInfo = [System.Diagnostics.ProcessStartInfo]::new()
  $startInfo.FileName = $FilePath
  $startInfo.Arguments = $Arguments -join ' '
  $startInfo.UseShellExecute = $false
  $startInfo.CreateNoWindow = $true
  $startInfo.RedirectStandardOutput = $true
  $startInfo.RedirectStandardError = $true

  $process = [System.Diagnostics.Process]::new()
  $process.StartInfo = $startInfo
  if (-not $process.Start()) {
    throw "Failed to start bounded native process: $FilePath"
  }
  $stdoutTask = $process.StandardOutput.ReadToEndAsync()
  $stderrTask = $process.StandardError.ReadToEndAsync()
  $timedOut = -not $process.WaitForExit($TimeoutSeconds * 1000)
  if ($timedOut) {
    try {
      $process.Kill()
    } catch {
      # The bounded query may have exited between the timeout and cleanup.
    }
    $process.WaitForExit()
  }

  return [pscustomobject]@{
    exit_code = if ($timedOut) { $null } else { $process.ExitCode }
    timed_out = $timedOut
    stdout = (($stdoutTask.Result -replace [char]0, '').Trim())
    stderr = (($stderrTask.Result -replace [char]0, '').Trim())
  }
}

function Get-WslInventory {
  $verbose = Invoke-BoundedNative -FilePath $wslPath -Arguments @('--list', '--verbose')
  if ($verbose.timed_out -or $verbose.exit_code -ne 0) {
    throw 'WSL inventory query failed or timed out'
  }
  $version = Invoke-BoundedNative -FilePath $wslPath -Arguments @('--version')
  if ($version.timed_out -or $version.exit_code -ne 0) {
    throw 'WSL version query failed or timed out'
  }

  $defaultDistro = $null
  $validationState = 'Absent'
  $validationVersion = $null
  $dockerDesktopState = 'Absent'
  foreach ($rawLine in ($verbose.stdout -split "\r?\n")) {
    $hasDefaultMarker = $rawLine -match '^\s*\*'
    $line = ($rawLine -replace '^\s*\*\s*', '').Trim()
    if (-not $line) {
      continue
    }
    $parts = @($line -split '\s{2,}' | Where-Object { $_ })
    if ($parts.Count -lt 2) {
      continue
    }
    $name = $parts[0].Trim()
    if ($hasDefaultMarker) {
      $defaultDistro = $name
    }
    if ($name -eq $validationDistro) {
      $validationState = $parts[1].Trim()
      if ($parts.Count -ge 3 -and $parts[-1] -match '^\d+$') {
        $validationVersion = [int]$parts[-1]
      }
    }
    if ($name -eq 'docker-desktop') {
      $dockerDesktopState = $parts[1].Trim()
    }
  }

  return [pscustomobject]@{
    default_distro = $defaultDistro
    validation_state = $validationState
    validation_version = $validationVersion
    docker_desktop_state = $dockerDesktopState
    wsl_version = ($version.stdout -split "\r?\n" | Select-Object -First 1)
  }
}

function Get-ZipEntrySha256(
  [string]$ZipPath,
  [string]$EntryFileName
) {
  Add-Type -AssemblyName System.IO.Compression.FileSystem
  $archive = [System.IO.Compression.ZipFile]::OpenRead($ZipPath)
  try {
    $matchingEntries = @(
      $archive.Entries |
        Where-Object { [System.IO.Path]::GetFileName($_.FullName) -eq $EntryFileName }
    )
    if ($matchingEntries.Count -ne 1) {
      throw "Candidate ZIP must contain exactly one $EntryFileName entry"
    }
    $stream = $matchingEntries[0].Open()
    $sha256 = [System.Security.Cryptography.SHA256]::Create()
    try {
      $hashBytes = $sha256.ComputeHash($stream)
    } finally {
      $sha256.Dispose()
      $stream.Dispose()
    }
    return ([System.BitConverter]::ToString($hashBytes) -replace '-', '').ToLowerInvariant()
  } finally {
    $archive.Dispose()
  }
}

function Get-CandidateProcesses {
  return @(
    Get-CimInstance Win32_Process -Filter "Name='$candidateProcessName'" -ErrorAction Stop |
      Select-Object ProcessId, ParentProcessId, ExecutablePath, CreationDate
  )
}

function Get-TrackedCandidateProcesses {
  if (-not $launchStartedAt) {
    return @()
  }
  $rows = Get-CandidateProcesses
  $eligibleRows = @(
    $rows |
      Where-Object {
        $resolvedPath = if ($_.ExecutablePath) { Get-NormalizedPath $_.ExecutablePath } else { $null }
        $createdAt = if ($_.CreationDate) { ([datetime]$_.CreationDate).ToUniversalTime() } else { $null }
        $resolvedPath -and
        $createdAt -and
        $createdAt -ge $launchStartedAt.AddSeconds(-2) -and
        [string]::Equals(
          $resolvedPath,
          (Get-NormalizedPath $launchExecutablePath),
          [System.StringComparison]::OrdinalIgnoreCase
        )
      }
  )

  $madeProgress = $true
  while ($madeProgress) {
    $madeProgress = $false
    foreach ($row in $eligibleRows) {
      $processId = [int]$row.ProcessId
      if ($trackedProcessIds.Contains($processId)) {
        if ($rootProcess -and $processId -eq $rootProcess.Id) {
          $ownedProcessIdentity[[string]$processId] = [pscustomobject]@{
            executable_path = (Get-NormalizedPath $row.ExecutablePath)
            created_at = ([datetime]$row.CreationDate).ToUniversalTime().ToString('o')
            parent_process_id = [int]$row.ParentProcessId
          }
        }
        continue
      }
      if (
        ($rootProcess -and $processId -eq $rootProcess.Id) -or
        $trackedProcessIds.Contains([int]$row.ParentProcessId)
      ) {
        [void]$trackedProcessIds.Add($processId)
        $ownedProcessIdentity[[string]$processId] = [pscustomobject]@{
          executable_path = (Get-NormalizedPath $row.ExecutablePath)
          created_at = ([datetime]$row.CreationDate).ToUniversalTime().ToString('o')
          parent_process_id = [int]$row.ParentProcessId
        }
        $madeProgress = $true
      }
    }
  }
  return @(
    $rows |
      Where-Object {
        $identity = $ownedProcessIdentity[[string]$_.ProcessId]
        $identity -and
        $_.CreationDate -and
        ([datetime]$_.CreationDate).ToUniversalTime().ToString('o') -eq $identity.created_at
      }
  )
}

function Get-WslProcessIds {
  return @(
    Get-CimInstance Win32_Process -Filter "Name='wsl.exe'" -ErrorAction Stop |
      ForEach-Object { [int]$_.ProcessId }
  )
}

function Remove-RunCandidateTree {
  if (-not (Test-Path -LiteralPath $runCandidateRoot)) {
    return $true
  }
  $expectedRunCandidateRoot = Join-Path $runDirectory 'candidate-from-verified-zip'
  Assert-ExactPath `
    -Actual $runCandidateRoot `
    -Expected $expectedRunCandidateRoot `
    -Label 'RunCandidateRoot'
  [System.IO.Directory]::Delete($runCandidateRoot, $true)
  return -not (Test-Path -LiteralPath $runCandidateRoot)
}

function Start-ProtectedPathWatch {
  $protectedPathPresent = Test-Path -LiteralPath $protectedOnePersonLabRoot
  $watchRoot = if ($protectedPathPresent) {
    $protectedOnePersonLabRoot
  } else {
    Split-Path -Parent $protectedOnePersonLabRoot
  }
  $watchFilter = if ($protectedPathPresent) {
    '*'
  } else {
    Split-Path -Leaf $protectedOnePersonLabRoot
  }
  if (-not (Test-Path -LiteralPath $watchRoot -PathType Container)) {
    throw 'Protected-path watch root is unavailable'
  }
  $watcher = [System.IO.FileSystemWatcher]::new($watchRoot, $watchFilter)
  $watcher.IncludeSubdirectories = $protectedPathPresent
  $watcher.NotifyFilter =
    [System.IO.NotifyFilters]::FileName -bor
    [System.IO.NotifyFilters]::DirectoryName -bor
    [System.IO.NotifyFilters]::LastWrite -bor
    [System.IO.NotifyFilters]::Size
  $sourceIdentifiers = @()
  foreach ($eventName in @('Changed', 'Created', 'Deleted', 'Renamed')) {
    $sourceIdentifier = "opl-v6-$RunId-protected-$eventName"
    Register-ObjectEvent `
      -InputObject $watcher `
      -EventName $eventName `
      -SourceIdentifier $sourceIdentifier | Out-Null
    $sourceIdentifiers += $sourceIdentifier
  }
  $errorSourceIdentifier = "opl-v6-$RunId-protected-Error"
  Register-ObjectEvent `
    -InputObject $watcher `
    -EventName Error `
    -SourceIdentifier $errorSourceIdentifier | Out-Null
  $watcher.EnableRaisingEvents = $true
  return [pscustomobject]@{
    watcher = $watcher
    source_identifiers = $sourceIdentifiers
    error_source_identifier = $errorSourceIdentifier
  }
}

function Stop-ProtectedPathWatch([object]$Watch) {
  if (-not $Watch) {
    return [pscustomobject]@{
      mutation_event_count = $null
      overflow_event_count = $null
    }
  }
  $Watch.watcher.EnableRaisingEvents = $false
  Start-Sleep -Milliseconds 500
  $eventCount = 0
  foreach ($sourceIdentifier in $Watch.source_identifiers) {
    $events = @(Get-Event -SourceIdentifier $sourceIdentifier -ErrorAction SilentlyContinue)
    $eventCount += $events.Count
    Unregister-Event -SourceIdentifier $sourceIdentifier -ErrorAction SilentlyContinue
    Remove-Event -SourceIdentifier $sourceIdentifier -ErrorAction SilentlyContinue
  }
  $overflowEvents = @(
    Get-Event -SourceIdentifier $Watch.error_source_identifier -ErrorAction SilentlyContinue
  )
  $overflowEventCount = $overflowEvents.Count
  Unregister-Event `
    -SourceIdentifier $Watch.error_source_identifier `
    -ErrorAction SilentlyContinue
  Remove-Event `
    -SourceIdentifier $Watch.error_source_identifier `
    -ErrorAction SilentlyContinue
  $Watch.watcher.Dispose()
  return [pscustomobject]@{
    mutation_event_count = $eventCount
    overflow_event_count = $overflowEventCount
  }
}

function Wait-CandidateWindow([int]$TimeoutSeconds = 30) {
  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  while ((Get-Date) -lt $deadline) {
    foreach ($row in (Get-TrackedCandidateProcesses)) {
      $process = Get-Process -Id $row.ProcessId -ErrorAction SilentlyContinue
      if ($process -and $process.MainWindowHandle -ne 0) {
        if ($process.MainWindowTitle -ne $windowTitle) {
          continue
        }
        return [pscustomobject]@{
          process_id = [int]$row.ProcessId
          handle = [IntPtr]$process.MainWindowHandle
        }
      }
    }
    Start-Sleep -Milliseconds 250
  }
  throw 'Candidate process did not expose a visible MainWindowHandle'
}

function Get-AutomationContentRoot([IntPtr]$Handle) {
  $window = [System.Windows.Automation.AutomationElement]::FromHandle($Handle)
  if (-not $window) {
    throw 'UI Automation could not resolve the candidate window'
  }
  $condition = [System.Windows.Automation.PropertyCondition]::new(
    [System.Windows.Automation.AutomationElement]::ControlTypeProperty,
    [System.Windows.Automation.ControlType]::Document
  )
  $document = $window.FindFirst(
    [System.Windows.Automation.TreeScope]::Descendants,
    $condition
  )
  if ($document) {
    return [pscustomobject]@{
      element = $document
      root_type = 'document'
    }
  }
  return [pscustomobject]@{
    element = $window
    root_type = 'window_fallback'
  }
}

function Get-AutomationSnapshot([System.Windows.Automation.AutomationElement]$Root) {
  $elements = $Root.FindAll(
    [System.Windows.Automation.TreeScope]::Descendants,
    [System.Windows.Automation.Condition]::TrueCondition
  )
  $items = [System.Collections.Generic.List[object]]::new()
  foreach ($element in $elements) {
    try {
      $items.Add([pscustomobject]@{
        name = [string]$element.Current.Name
        control_type = [string]$element.Current.ControlType.ProgrammaticName
        is_enabled = [bool]$element.Current.IsEnabled
      })
    } catch {
      # Ignore an accessibility node that disappeared during the bounded refresh.
    }
  }
  return @($items)
}

function Wait-SettledProjection(
  [System.Windows.Automation.AutomationElement]$Root,
  [int]$TimeoutSeconds = 30
) {
  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  $lastSignature = $null
  $stableCount = 0
  while ((Get-Date) -lt $deadline) {
    $items = Get-AutomationSnapshot $Root
    $buttons = @(
      $items |
        Where-Object {
          $_.control_type -eq 'ControlType.Button' -and
          $_.name -in @('Refresh', '刷新')
        }
    )
    if ($buttons.Count -eq 1 -and $buttons[0].is_enabled) {
      try {
        $projection = Assert-VisibleProjection -Items $items
        $signature = @(
          $projection.guest.state,
          $projection.guest.detail,
          $projection.aioncore.state,
          $projection.aioncore.detail,
          $projection.codex.state,
          $projection.codex.detail,
          $projection.framework.state,
          $projection.framework.detail
        ) -join '|'
        if ($signature -eq $lastSignature) {
          $stableCount += 1
        } else {
          $lastSignature = $signature
          $stableCount = 1
        }
        if ($stableCount -ge 2) {
          return [pscustomobject]@{
            items = $items
            projection = $projection
          }
        }
      } catch {
        $lastSignature = $null
        $stableCount = 0
      }
    }
    Start-Sleep -Milliseconds 250
  }
  throw 'Candidate did not finish its bounded status refresh'
}

function Invoke-RefreshAndWait(
  [System.Windows.Automation.AutomationElement]$Root,
  [int]$TimeoutSeconds = 30
) {
  $buttonCondition = [System.Windows.Automation.PropertyCondition]::new(
    [System.Windows.Automation.AutomationElement]::ControlTypeProperty,
    [System.Windows.Automation.ControlType]::Button
  )
  $buttonElements = $Root.FindAll(
    [System.Windows.Automation.TreeScope]::Descendants,
    $buttonCondition
  )
  $refreshButtons = @(
    $buttonElements |
      Where-Object { $_.Current.Name -in @('Refresh', '刷新') }
  )
  if ($refreshButtons.Count -ne 1) {
    throw 'UI Automation could not resolve exactly one Refresh button'
  }
  $invokePattern = $refreshButtons[0].GetCurrentPattern(
    [System.Windows.Automation.InvokePattern]::Pattern
  )
  if (-not $invokePattern) {
    throw 'Refresh button does not expose the UI Automation Invoke pattern'
  }
  $invokePattern.Invoke()

  $disabledObserved = $false
  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  while ((Get-Date) -lt $deadline) {
    try {
      $isEnabled = [bool]$refreshButtons[0].Current.IsEnabled
      if (-not $isEnabled) {
        $disabledObserved = $true
      } elseif ($disabledObserved) {
        return $true
      }
    } catch {
      throw 'Refresh button became unavailable during the invoked readback'
    }
    Start-Sleep -Milliseconds 100
  }
  throw 'Invoked Refresh did not expose a disabled-to-enabled readback cycle'
}

function Find-TextIndex(
  [object[]]$Items,
  [string[]]$Names,
  [int]$StartAt = 0
) {
  for ($index = $StartAt; $index -lt $Items.Count; $index++) {
    if (
      $Items[$index].control_type -eq 'ControlType.Text' -and
      $Items[$index].name -in $Names
    ) {
      return $index
    }
  }
  return -1
}

function Read-StatusGroup(
  [object[]]$Items,
  [string[]]$TitleNames,
  [string[]]$NextTitleNames,
  [string[]]$AllowedStates,
  [string[]]$AllowedDetails
) {
  $titleIndex = Find-TextIndex -Items $Items -Names $TitleNames
  if ($titleIndex -lt 0) {
    throw "Missing status group: $($TitleNames -join ' / ')"
  }
  $endIndex = $Items.Count
  if ($NextTitleNames.Count -gt 0) {
    $nextIndex = Find-TextIndex -Items $Items -Names $NextTitleNames -StartAt ($titleIndex + 1)
    if ($nextIndex -gt $titleIndex) {
      $endIndex = $nextIndex
    }
  }

  $state = $null
  $detail = $null
  for ($index = $titleIndex + 1; $index -lt $endIndex; $index++) {
    if ($Items[$index].control_type -ne 'ControlType.Text') {
      continue
    }
    $name = $Items[$index].name.Trim()
    $normalized = $name.ToLowerInvariant()
    if (-not $state -and $normalized -in $AllowedStates) {
      $state = $normalized
      continue
    }
    if ($state -and $name -in $AllowedDetails) {
      $detail = $name
      break
    }
  }
  if (-not $state) {
    throw "Status group has no allowed state: $($TitleNames -join ' / ')"
  }
  if (-not $detail) {
    throw "Status group has no allowed bounded detail: $($TitleNames -join ' / ')"
  }
  return [pscustomobject]@{
    state = $state
    detail = $detail
  }
}

function Assert-VisibleProjection([object[]]$Items) {
  $textNames = @(
    $Items |
      Where-Object { $_.control_type -eq 'ControlType.Text' } |
      ForEach-Object { $_.name }
  )
  if ('validation_only_non_binding' -notin $textNames) {
    throw 'The visible validation-only gate label is missing'
  }

  $buttons = @(
    $Items |
      Where-Object {
        $_.control_type -eq 'ControlType.Button' -and
        $_.name -in @('Refresh', '刷新')
      }
  )
  if ($buttons.Count -ne 1) {
    throw 'The candidate must expose exactly one Refresh button'
  }
  $edits = @($Items | Where-Object { $_.control_type -eq 'ControlType.Edit' })
  $hyperlinks = @($Items | Where-Object { $_.control_type -eq 'ControlType.Hyperlink' })
  if ($edits.Count -ne 0 -or $hyperlinks.Count -ne 0) {
    throw 'The candidate must not expose composer, input, or link controls'
  }

  $forbiddenControlName = '(?i)^(chat|聊天|login|登录|update|更新|repair|修复|install|安装|reset password|密码重置)$'
  $forbiddenControls = @(
    $Items |
      Where-Object {
        $_.control_type -in @('ControlType.Button', 'ControlType.Edit') -and
        $_.name -match $forbiddenControlName
      }
  )
  if ($forbiddenControls.Count -ne 0) {
    throw 'The candidate exposes a forbidden product command control'
  }

  $forbiddenReadyStates = @(
    'ready',
    'healthy',
    'passed',
    'success',
    'connected',
    'authenticated',
    'supported',
    'release_ready',
    'release-ready'
  )
  foreach ($textName in $textNames) {
    if ($textName.ToLowerInvariant() -in $forbiddenReadyStates) {
      throw "The candidate rendered a forbidden readiness claim: $textName"
    }
  }

  $guestTitleIndex = Find-TextIndex -Items $Items -Names @('Guest identity', 'Guest 身份')
  $aioncoreTitleIndex = Find-TextIndex -Items $Items -Names @('AionCore health', 'AionCore 健康状态')
  $codexTitleIndex = Find-TextIndex -Items $Items -Names @('Direct Codex App Server')
  $frameworkTitleIndex = Find-TextIndex -Items $Items -Names @('Framework state', 'Framework 状态')
  if (
    $guestTitleIndex -lt 0 -or
    $aioncoreTitleIndex -le $guestTitleIndex -or
    $codexTitleIndex -le $aioncoreTitleIndex -or
    $frameworkTitleIndex -le $codexTitleIndex
  ) {
    throw 'Status groups are missing or out of the required visible order'
  }

  $englishBoundaries = @(
    'Not Available In This Candidate',
    'ACP conversation',
    'Authenticated bootstrap',
    'WebSocket conversation',
    'Login, update, repair, installer, and arbitrary guest commands'
  )
  $chineseBoundaries = @(
    '此候选不提供的能力',
    'ACP 对话',
    '认证 bootstrap',
    'WebSocket 对话',
    '登录、更新、修复、安装和任意 guest 命令'
  )
  if (@($englishBoundaries | Where-Object { $_ -notin $textNames }).Count -eq 0) {
    $matchedBoundarySet = $englishBoundaries
  } elseif (@($chineseBoundaries | Where-Object { $_ -notin $textNames }).Count -eq 0) {
    $matchedBoundarySet = $chineseBoundaries
  } else {
    $matchedBoundarySet = $null
  }
  if (-not $matchedBoundarySet) {
    throw 'The candidate does not visibly declare all unavailable capability boundaries'
  }

  $guestAllowedDetails = if ($ExpectedPhase -eq 'stopped') {
    @(
      "$validationDistro is Stopped; the status candidate does not start it.",
      "$validationDistro is stopped; the status candidate does not start it."
    )
  } else {
    @("Observed $validationDistro (x86_64).")
  }
  $guest = Read-StatusGroup `
    -Items $Items `
    -TitleNames @('Guest identity', 'Guest 身份') `
    -NextTitleNames @('AionCore health', 'AionCore 健康状态') `
    -AllowedStates $(if ($ExpectedPhase -eq 'stopped') { @('unavailable') } else { @('observed') }) `
    -AllowedDetails $guestAllowedDetails

  $aioncore = Read-StatusGroup `
    -Items $Items `
    -TitleNames @('AionCore health', 'AionCore 健康状态') `
    -NextTitleNames @('Direct Codex App Server') `
    -AllowedStates $(if ($ExpectedPhase -eq 'stopped') { @('unavailable') } else { @('unverified', 'unavailable') }) `
    -AllowedDetails @(
      'No validation-owned AionCore health endpoint is active.',
      'Process observed; no health endpoint is exposed.',
      'Unexpected process without fixture binary.',
      'Fixture binary exists; no validation-owned AionCore process is running.',
      'Fixture AionCore binary is missing.'
    )
  $codex = Read-StatusGroup `
    -Items $Items `
    -TitleNames @('Direct Codex App Server') `
    -NextTitleNames @('Framework state', 'Framework 状态') `
    -AllowedStates $(if ($ExpectedPhase -eq 'stopped') { @('unavailable') } else { @('unverified', 'unavailable') }) `
    -AllowedDetails @(
      'Direct Codex App Server is not started by this status-only candidate.',
      'Fixture binary exists; Direct Codex App Server is intentionally not started.',
      'Fixture Direct Codex binary is missing.'
    )
  $framework = Read-StatusGroup `
    -Items $Items `
    -TitleNames @('Framework state', 'Framework 状态') `
    -NextTitleNames @() `
    -AllowedStates $(if ($ExpectedPhase -eq 'stopped') { @('unavailable') } else { @('unverified', 'unavailable') }) `
    -AllowedDetails @(
      'Framework state is not executed by this status-only candidate.',
      'Fixture CLI exists; Framework state is intentionally not executed.',
      'Fixture Framework CLI is missing.'
    )

  return [pscustomobject]@{
    refresh_button_name = $buttons[0].name
    edit_control_count = $edits.Count
    hyperlink_control_count = $hyperlinks.Count
    forbidden_command_control_count = $forbiddenControls.Count
    boundary_set = @($matchedBoundarySet)
    guest = $guest
    aioncore = $aioncore
    codex = $codex
    framework = $framework
  }
}

function Save-TargetWindowScreenshot(
  [IntPtr]$Handle,
  [string]$OutputPath
) {
  if (-not [OplValidationNativeWindow]::IsVisibleAndRestored($Handle)) {
    throw 'Candidate window is hidden or minimized'
  }
  $rect = [OplValidationNativeWindow]::GetWindowBounds($Handle)
  $width = $rect.Right - $rect.Left
  $height = $rect.Bottom - $rect.Top
  if ($width -lt 320 -or $height -lt 240) {
    throw 'Candidate window bounds are not visibly usable'
  }
  $bitmap = [System.Drawing.Bitmap]::new($width, $height)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $deviceContext = $graphics.GetHdc()
  try {
    $captured = [OplValidationNativeWindow]::PrintTargetWindow($Handle, $deviceContext)
  } finally {
    $graphics.ReleaseHdc($deviceContext)
    $graphics.Dispose()
  }
  if (-not $captured) {
    $bitmap.Dispose()
    throw 'PrintWindow failed for the candidate window'
  }

  $sampledColors = [System.Collections.Generic.HashSet[int]]::new()
  for ($x = 0; $x -lt $width; $x += 24) {
    for ($y = 0; $y -lt $height; $y += 24) {
      [void]$sampledColors.Add($bitmap.GetPixel($x, $y).ToArgb())
    }
  }
  if ($sampledColors.Count -lt 3) {
    $bitmap.Dispose()
    throw 'Candidate window screenshot is blank or not visibly rendered'
  }
  try {
    $bitmap.Save($OutputPath, [System.Drawing.Imaging.ImageFormat]::Png)
  } finally {
    $bitmap.Dispose()
  }

  return [pscustomobject]@{
    width = $width
    height = $height
    sha256 = (Get-FileHash -Algorithm SHA256 -LiteralPath $OutputPath).Hash.ToLowerInvariant()
  }
}

function Request-CandidateClose([IntPtr]$Handle) {
  $window = [System.Windows.Automation.AutomationElement]::FromHandle($Handle)
  if (-not $window) {
    return $false
  }
  $pattern = $window.GetCurrentPattern([System.Windows.Automation.WindowPattern]::Pattern)
  if (-not $pattern) {
    return $false
  }
  $pattern.Close()
  return $true
}

function Test-RootProcessIdentity {
  if (-not $rootProcess -or -not $rootProcessStartTime) {
    return $false
  }
  $current = Get-Process -Id $rootProcess.Id -ErrorAction SilentlyContinue
  if (-not $current) {
    return $false
  }
  try {
    return $current.StartTime.ToUniversalTime().ToString('o') -eq $rootProcessStartTime
  } catch {
    return $false
  }
}

function Stop-OwnedCandidateProcesses {
  $deadline = (Get-Date).AddSeconds(15)
  $inventoryReadable = $true
  $remaining = @()
  while ((Get-Date) -lt $deadline) {
    try {
      $remaining = @(Get-TrackedCandidateProcesses)
    } catch {
      $inventoryReadable = $false
      break
    }
    if ($remaining.Count -eq 0) {
      return [pscustomobject]@{
        survivors = @()
        inventory_readable = $true
      }
    }
    Start-Sleep -Milliseconds 250
  }

  $script:forcedCleanup = $true
  if (Test-RootProcessIdentity) {
    & taskkill.exe /PID $rootProcess.Id /T /F 2>$null | Out-Null
  }
  if ($inventoryReadable) {
    foreach ($row in $remaining) {
      $identity = $ownedProcessIdentity[[string]$row.ProcessId]
      if (
        $identity -and
        ([datetime]$row.CreationDate).ToUniversalTime().ToString('o') -eq $identity.created_at
      ) {
        Stop-Process -Id ([int]$row.ProcessId) -Force -ErrorAction SilentlyContinue
      }
    }
  }
  Start-Sleep -Milliseconds 500
  try {
    $survivors = @(Get-TrackedCandidateProcesses)
  } catch {
    return [pscustomobject]@{
      survivors = @()
      inventory_readable = $false
    }
  }
  return [pscustomobject]@{
    survivors = $survivors
    inventory_readable = $true
  }
}

function Write-Receipt([System.Collections.IDictionary]$Payload) {
  $json = $Payload | ConvertTo-Json -Depth 12
  [System.IO.File]::WriteAllText(
    $receiptPath,
    $json,
    [System.Text.UTF8Encoding]::new($false)
  )
  $script:receiptWritten = $true
}

if ($env:OS -ne 'Windows_NT') {
  throw 'V6 visible smoke must run inside the authorized Windows VM'
}

Assert-ExactPath -Actual $CandidateZipPath -Expected $expectedZipPath -Label 'CandidateZipPath'
Assert-ExactPath `
  -Actual $WriterHandoffReceiptPath `
  -Expected $expectedHandoffReceiptPath `
  -Label 'WriterHandoffReceiptPath'
Assert-ExactPath -Actual $EvidenceRoot -Expected $expectedEvidenceRoot -Label 'EvidenceRoot'
if (Test-Path -LiteralPath $runDirectory) {
  throw "Run evidence directory already exists: $runDirectory"
}
New-Item -ItemType Directory -Path $runDirectory | Out-Null

$receipt = [ordered]@{
  schema = 'opl_windows_wsl2_v6_visible_smoke.v1'
  validation_state = 'validation_only_non_binding'
  assessment_scope = 'status_projection_only'
  receipt_stage = 'guest_smoke_pending_host_closeout'
  terminal_v6_verdict = $false
  status = 'failed'
  run_id = $RunId
  expected_phase = $ExpectedPhase
  observed_at = (Get-Date).ToUniversalTime().ToString('o')
  app_sha = $AppSha.ToLowerInvariant()
  shell_sha = $ShellSha.ToLowerInvariant()
  framework_sha = $FrameworkSha.ToLowerInvariant()
  artifact = [ordered]@{
    sha256 = $ExpectedArtifactSha256.ToLowerInvariant()
    executable_sha256 = $null
    zip_entry_sha256_matches = $false
    tree_origin = 'pending'
    source_ref_binding = 'operator_recorded_not_embedded'
    size_bytes = $null
    zip_file_name = [System.IO.Path]::GetFileName($CandidateZipPath)
    executable_file_name = $candidateExecutableFileName
    gate_environment = "$validationGateName=$validationGateValue"
  }
  vm = [ordered]@{
    identity = $VmIdentity
    storage_class = 'external_ssd'
    external_ssd = $true
    writer_handoff = [ordered]@{
      previous_owner_task_id = $PreviousWriterTaskId
      receipt_id = $WriterHandoffReceiptId
      released_at = $WriterReleasedAt.ToUniversalTime().ToString('o')
      receipt_sha256 = $null
    }
    writer_release = [ordered]@{
      status = 'pending_host_soft_shutdown'
      receipt_id = $null
      released_at = $null
    }
  }
  preflight = [ordered]@{
    windows_build = [Environment]::OSVersion.Version.ToString()
    windows_x64 = [Environment]::Is64BitOperatingSystem
    artifact_path_identity = 'pending'
    artifact_sha256_matches = $false
    no_residual_candidate_processes = $false
    wsl_inventory_readable = $false
    wsl_version = $null
    default_distro = $null
    validation_distro = $validationDistro
    validation_distro_state = $null
    validation_distro_version = $null
    expected_phase_matches = $false
    docker_desktop_state = $null
    protected_onepersonlab_present = $false
    protected_onepersonlab_watch_active = $false
  }
  visible_window = [ordered]@{
    observed = $false
    title = $windowTitle
    process_id = $null
    main_window_handle_observed = $false
    ui_automation_document_observed = $false
    ui_automation_root_type = $null
    refresh_button_name = $null
    refresh_invoked = $false
    refresh_disabled_observed = $false
    status_group_order = @(
      'guest_identity',
      'aioncore_health',
      'direct_codex_app_server',
      'framework_state'
    )
  }
  status_groups = [ordered]@{
    guest_identity = [ordered]@{
      projection_result = 'not_observed'
      visible_state = $null
      capability_verification = 'identity_only'
    }
    aioncore_health = [ordered]@{
      projection_result = 'not_observed'
      visible_state = $null
      capability_verification = 'unverified_or_unavailable'
    }
    direct_codex_app_server = [ordered]@{
      projection_result = 'not_observed'
      visible_state = $null
      capability_verification = 'unverified_or_unavailable'
    }
    framework_state = [ordered]@{
      projection_result = 'not_observed'
      visible_state = $null
      capability_verification = 'unverified_or_unavailable'
    }
  }
  negative_boundaries = [ordered]@{
    validation_gate_visible = $false
    only_refresh_button = $false
    edit_control_count = $null
    hyperlink_control_count = $null
    forbidden_command_control_count = $null
    acp_visible_as_unavailable = $false
    authentication_visible_as_unavailable = $false
    websocket_visible_as_unavailable = $false
    forbidden_ready_states_absent = $false
    status = 'not_observed'
  }
  process_cleanup = [ordered]@{
    launched_root_pid = $null
    tracked_pids = @()
    close_requested = $false
    forced_cleanup = $false
    inventory_readable = $false
    wsl_survivor_count = $null
    candidate_tree_removed = $false
    survivor_count = $null
    status = 'not_run'
  }
  post_readback = [ordered]@{
    default_distro_unchanged = $false
    docker_desktop_state_unchanged = $false
    validation_distro_state_unchanged = $false
    protected_onepersonlab_present_before = $false
    protected_onepersonlab_present_after = $false
    protected_onepersonlab_presence_unchanged = $false
    protected_onepersonlab_mutation_event_count = $null
    protected_onepersonlab_watch_overflow_count = $null
    protected_onepersonlab_no_mutation_events_observed = $false
    validation_distro_state_samples = @()
    status = 'not_run'
  }
  screenshot = [ordered]@{
    sha256 = $null
    width = $null
    height = $null
    format = 'png'
    target_window_only = $true
  }
  blocked_or_unavailable_items = @(
    'aioncore_health_not_verified_by_status_only_candidate',
    'direct_codex_app_server_not_started_by_status_only_candidate',
    'framework_fast_state_not_executed_by_status_only_candidate',
    'managed_acp_unverified',
    'authenticated_bootstrap_unverified',
    'websocket_conversation_unverified'
    'source_refs_not_embedded_in_candidate'
  )
  error = $null
}

try {
  Add-Type -AssemblyName UIAutomationClient
  Add-Type -AssemblyName UIAutomationTypes
  Add-Type -AssemblyName System.Drawing
  if (-not ('OplValidationNativeWindow' -as [type])) {
    Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;

public static class OplValidationNativeWindow
{
    [StructLayout(LayoutKind.Sequential)]
    public struct Rect
    {
        public int Left;
        public int Top;
        public int Right;
        public int Bottom;
    }

    [DllImport("user32.dll")]
    private static extern bool GetWindowRect(IntPtr window, out Rect rect);

    [DllImport("user32.dll")]
    private static extern bool PrintWindow(IntPtr window, IntPtr deviceContext, uint flags);

    [DllImport("user32.dll")]
    private static extern bool IsWindowVisible(IntPtr window);

    [DllImport("user32.dll")]
    private static extern bool IsIconic(IntPtr window);

    public static Rect GetWindowBounds(IntPtr window)
    {
        Rect rect;
        if (!GetWindowRect(window, out rect))
        {
            throw new InvalidOperationException("GetWindowRect failed");
        }
        return rect;
    }

    public static bool IsVisibleAndRestored(IntPtr window)
    {
        return IsWindowVisible(window) && !IsIconic(window);
    }

    public static bool PrintTargetWindow(IntPtr window, IntPtr deviceContext)
    {
        const uint printWindowRenderFullContent = 2;
        return PrintWindow(window, deviceContext, printWindowRenderFullContent);
    }
}
'@
  }

  if (-not [Environment]::Is64BitOperatingSystem) {
    throw 'V6 candidate requires Windows x64'
  }
  if ($ExpectedArtifactSha256.ToLowerInvariant() -ne $approvedArtifactSha256) {
    throw 'Expected artifact is not the approved V6 candidate ZIP'
  }
  if ($ShellSha.ToLowerInvariant() -ne $approvedShellSha) {
    throw 'Shell SHA is not the approved V6 candidate source'
  }
  if ($FrameworkSha.ToLowerInvariant() -ne $approvedFrameworkSha) {
    throw 'Framework SHA is not the V6 guest fixture source'
  }
  if ($WriterReleasedAt.ToUniversalTime() -gt (Get-Date).ToUniversalTime()) {
    throw 'Writer handoff release time cannot be in the future'
  }
  if (-not (Test-Path -LiteralPath $CandidateZipPath -PathType Leaf)) {
    throw 'Candidate ZIP is missing'
  }
  if (-not (Test-Path -LiteralPath $WriterHandoffReceiptPath -PathType Leaf)) {
    throw 'Writer handoff receipt is missing'
  }
  $actualWriterHandoffSha256 =
    (Get-FileHash -Algorithm SHA256 -LiteralPath $WriterHandoffReceiptPath).Hash.ToLowerInvariant()
  if ($actualWriterHandoffSha256 -ne $ExpectedWriterHandoffSha256.ToLowerInvariant()) {
    throw 'Writer handoff receipt SHA256 does not match the host-provided identity'
  }
  $handoffReceipt = Get-Content -Raw -LiteralPath $WriterHandoffReceiptPath | ConvertFrom-Json
  if (
    $handoffReceipt.schema -ne 'opl_vm_writer_release.v1' -or
    $handoffReceipt.vmx_storage_class -ne 'external_ssd' -or
    $handoffReceipt.vm_identity -ne $VmIdentity -or
    $handoffReceipt.previous_owner_task_id -ne $PreviousWriterTaskId -or
    $handoffReceipt.receipt_id -ne $WriterHandoffReceiptId -or
    ([datetime]$handoffReceipt.released_at).ToUniversalTime() -ne $WriterReleasedAt.ToUniversalTime()
  ) {
    throw 'Writer handoff receipt does not match the authorized VM lease'
  }
  $receipt.vm.writer_handoff.receipt_sha256 = $actualWriterHandoffSha256
  $receipt.artifact.size_bytes = (Get-Item -LiteralPath $CandidateZipPath).Length
  $actualArtifactSha256 = (Get-FileHash -Algorithm SHA256 -LiteralPath $CandidateZipPath).Hash.ToLowerInvariant()
  if ($actualArtifactSha256 -ne $ExpectedArtifactSha256.ToLowerInvariant()) {
    throw 'Candidate ZIP SHA256 does not match the expected artifact'
  }
  $receipt.preflight.artifact_path_identity = 'approved_exact_path'
  $receipt.preflight.artifact_sha256_matches = $true
  Expand-Archive -LiteralPath $CandidateZipPath -DestinationPath $runCandidateRoot
  if (-not (Test-Path -LiteralPath $launchExecutablePath -PathType Leaf)) {
    throw 'Verified ZIP expansion does not contain the candidate executable'
  }
  $executableSha256 = (Get-FileHash -Algorithm SHA256 -LiteralPath $launchExecutablePath).Hash.ToLowerInvariant()
  $zipExecutableSha256 = Get-ZipEntrySha256 `
    -ZipPath $CandidateZipPath `
    -EntryFileName $candidateExecutableFileName
  if ($executableSha256 -ne $zipExecutableSha256) {
    throw 'Extracted candidate executable does not match the verified ZIP entry'
  }
  if ($executableSha256 -ne $approvedExecutableSha256) {
    throw 'Extracted executable is not the approved V6 candidate executable'
  }
  $receipt.artifact.executable_sha256 = $executableSha256
  $receipt.artifact.zip_entry_sha256_matches = $true
  $receipt.artifact.tree_origin = 'verified_zip_expansion'

  $residualProcesses = @(Get-CandidateProcesses)
  if ($residualProcesses.Count -ne 0) {
    throw 'Residual V6 candidate processes exist before the run'
  }
  $receipt.preflight.no_residual_candidate_processes = $true
  $wslProcessIdsBefore = @(Get-WslProcessIds)

  $preInventory = Get-WslInventory
  $receipt.preflight.wsl_inventory_readable = $true
  $receipt.preflight.wsl_version = $preInventory.wsl_version
  $receipt.preflight.default_distro = $preInventory.default_distro
  $receipt.preflight.validation_distro_state = $preInventory.validation_state
  $receipt.preflight.validation_distro_version = $preInventory.validation_version
  $receipt.preflight.docker_desktop_state = $preInventory.docker_desktop_state
  $receipt.preflight.protected_onepersonlab_present = Test-Path -LiteralPath $protectedOnePersonLabRoot
  if ($preInventory.validation_version -ne 2) {
    throw "$validationDistro is missing or is not WSL2"
  }
  $actualPhase = $preInventory.validation_state.ToLowerInvariant()
  if ($actualPhase -ne $ExpectedPhase) {
    throw "Expected $ExpectedPhase fixture phase, observed $actualPhase"
  }
  $receipt.preflight.expected_phase_matches = $true
  $validationPhaseSamples.Add($preInventory.validation_state)
  $protectedPathWatch = Start-ProtectedPathWatch
  $receipt.preflight.protected_onepersonlab_watch_active = $true

  $previousGateValue = [Environment]::GetEnvironmentVariable($validationGateName, 'Process')
  $launchStartedAt = (Get-Date).ToUniversalTime()
  try {
    [Environment]::SetEnvironmentVariable($validationGateName, $validationGateValue, 'Process')
    $rootProcess = Start-Process -FilePath $launchExecutablePath -PassThru
  } finally {
    [Environment]::SetEnvironmentVariable($validationGateName, $previousGateValue, 'Process')
  }
  $candidateLaunched = $true
  $rootProcessStartTime = $rootProcess.StartTime.ToUniversalTime().ToString('o')
  [void]$trackedProcessIds.Add([int]$rootProcess.Id)
  $ownedProcessIdentity[[string]$rootProcess.Id] = [pscustomobject]@{
    executable_path = (Get-NormalizedPath $launchExecutablePath)
    created_at = $rootProcessStartTime
    parent_process_id = $null
  }
  $receipt.process_cleanup.launched_root_pid = [int]$rootProcess.Id

  $windowResult = Wait-CandidateWindow
  $windowHandle = $windowResult.handle
  $receipt.visible_window.observed = $true
  $receipt.visible_window.process_id = $windowResult.process_id
  $receipt.visible_window.main_window_handle_observed = $true

  $automationRoot = Get-AutomationContentRoot -Handle $windowHandle
  $receipt.visible_window.ui_automation_document_observed =
    $automationRoot.root_type -eq 'document'
  $receipt.visible_window.ui_automation_root_type = $automationRoot.root_type
  $settled = Wait-SettledProjection -Root $automationRoot.element
  $items = $settled.items
  $projection = $settled.projection
  $receipt.visible_window.refresh_button_name = $projection.refresh_button_name
  $initialProjectionInventory = Get-WslInventory
  $validationPhaseSamples.Add($initialProjectionInventory.validation_state)
  if ($initialProjectionInventory.validation_state.ToLowerInvariant() -ne $ExpectedPhase) {
    throw 'Validation fixture phase changed during the initial projection'
  }

  $receipt.visible_window.refresh_invoked = $true
  $receipt.visible_window.refresh_disabled_observed =
    Invoke-RefreshAndWait -Root $automationRoot.element
  $settled = Wait-SettledProjection -Root $automationRoot.element
  $items = $settled.items
  $projection = $settled.projection
  $refreshProjectionInventory = Get-WslInventory
  $validationPhaseSamples.Add($refreshProjectionInventory.validation_state)
  if ($refreshProjectionInventory.validation_state.ToLowerInvariant() -ne $ExpectedPhase) {
    throw 'Validation fixture phase changed during the invoked refresh'
  }

  foreach ($groupName in @('guest', 'aioncore', 'codex', 'framework')) {
    $receiptGroupName = switch ($groupName) {
      'guest' { 'guest_identity' }
      'aioncore' { 'aioncore_health' }
      'codex' { 'direct_codex_app_server' }
      'framework' { 'framework_state' }
    }
    $projectionGroup = $projection.PSObject.Properties[$groupName].Value
    $receipt.status_groups[$receiptGroupName].projection_result = 'passed'
    $receipt.status_groups[$receiptGroupName].visible_state = $projectionGroup.state
  }

  $receipt.negative_boundaries.validation_gate_visible = $true
  $receipt.negative_boundaries.only_refresh_button = $true
  $receipt.negative_boundaries.edit_control_count = $projection.edit_control_count
  $receipt.negative_boundaries.hyperlink_control_count = $projection.hyperlink_control_count
  $receipt.negative_boundaries.forbidden_command_control_count = $projection.forbidden_command_control_count
  $receipt.negative_boundaries.acp_visible_as_unavailable = $true
  $receipt.negative_boundaries.authentication_visible_as_unavailable = $true
  $receipt.negative_boundaries.websocket_visible_as_unavailable = $true
  $receipt.negative_boundaries.forbidden_ready_states_absent = $true
  $receipt.negative_boundaries.status = 'passed'

  $screenshot = Save-TargetWindowScreenshot -Handle $windowHandle -OutputPath $screenshotPath
  $receipt.screenshot.sha256 = $screenshot.sha256
  $receipt.screenshot.width = $screenshot.width
  $receipt.screenshot.height = $screenshot.height

  $receipt.process_cleanup.close_requested = Request-CandidateClose -Handle $windowHandle
  $cleanup = Stop-OwnedCandidateProcesses
  $survivors = @($cleanup.survivors)
  $receipt.process_cleanup.tracked_pids = @($trackedProcessIds | Sort-Object)
  $receipt.process_cleanup.forced_cleanup = $forcedCleanup
  $receipt.process_cleanup.inventory_readable = $cleanup.inventory_readable
  $receipt.process_cleanup.survivor_count = $survivors.Count
  if (-not $cleanup.inventory_readable -or $survivors.Count -ne 0) {
    $receipt.process_cleanup.status = 'cleanup_reconciliation_required'
    throw 'Candidate process cleanup could not be reconciled'
  }
  $receipt.process_cleanup.status = 'passed'

  $postInventory = Get-WslInventory
  $receipt.post_readback.default_distro_unchanged = $postInventory.default_distro -eq $preInventory.default_distro
  $receipt.post_readback.docker_desktop_state_unchanged =
    $postInventory.docker_desktop_state -eq $preInventory.docker_desktop_state
  $receipt.post_readback.validation_distro_state_unchanged =
    $postInventory.validation_state -eq $preInventory.validation_state
  $receipt.post_readback.protected_onepersonlab_present_before =
    $receipt.preflight.protected_onepersonlab_present
  $receipt.post_readback.protected_onepersonlab_present_after =
    Test-Path -LiteralPath $protectedOnePersonLabRoot
  $receipt.post_readback.protected_onepersonlab_presence_unchanged =
    $receipt.post_readback.protected_onepersonlab_present_after -eq
      $receipt.post_readback.protected_onepersonlab_present_before
  $protectedPathWatchResult = Stop-ProtectedPathWatch -Watch $protectedPathWatch
  $protectedPathWatch = $null
  $receipt.post_readback.protected_onepersonlab_mutation_event_count =
    $protectedPathWatchResult.mutation_event_count
  $receipt.post_readback.protected_onepersonlab_watch_overflow_count =
    $protectedPathWatchResult.overflow_event_count
  $receipt.post_readback.protected_onepersonlab_no_mutation_events_observed =
    $receipt.post_readback.protected_onepersonlab_mutation_event_count -eq 0 -and
      $receipt.post_readback.protected_onepersonlab_watch_overflow_count -eq 0
  $validationPhaseSamples.Add($postInventory.validation_state)
  $receipt.post_readback.validation_distro_state_samples = @($validationPhaseSamples)
  Start-Sleep -Milliseconds 250
  $wslProcessIdsAfter = @(Get-WslProcessIds)
  $newWslProcessIds = @($wslProcessIdsAfter | Where-Object { $_ -notin $wslProcessIdsBefore })
  $receipt.process_cleanup.wsl_survivor_count = $newWslProcessIds.Count
  $postReadbackPassed =
    $receipt.post_readback.default_distro_unchanged -and
    $receipt.post_readback.docker_desktop_state_unchanged -and
    $receipt.post_readback.validation_distro_state_unchanged -and
    $receipt.post_readback.protected_onepersonlab_presence_unchanged -and
    $receipt.post_readback.protected_onepersonlab_no_mutation_events_observed -and
    $receipt.process_cleanup.wsl_survivor_count -eq 0
  $receipt.post_readback.status = if ($postReadbackPassed) { 'passed' } else { 'failed' }
  if (-not $postReadbackPassed) {
    throw 'Post-run WSL or protected-path readback changed'
  }
  $receipt.process_cleanup.candidate_tree_removed = Remove-RunCandidateTree
  if (-not $receipt.process_cleanup.candidate_tree_removed) {
    throw 'Run-owned candidate tree was not removed'
  }

  $receipt.status = 'passed'
} catch {
  $receipt.status = if ($candidateLaunched) { 'failed' } else { 'blocked' }
  $errorMessage = (($_.Exception.Message -replace '[\r\n]+', ' ').Trim())
  $receipt.error = $errorMessage.Substring(0, [Math]::Min(500, $errorMessage.Length))
  if ($rootProcess) {
    $cleanup = Stop-OwnedCandidateProcesses
    $survivors = @($cleanup.survivors)
    $receipt.process_cleanup.tracked_pids = @($trackedProcessIds | Sort-Object)
    $receipt.process_cleanup.forced_cleanup = $forcedCleanup
    $receipt.process_cleanup.inventory_readable = $cleanup.inventory_readable
    $receipt.process_cleanup.survivor_count = $survivors.Count
    $receipt.process_cleanup.status =
      if ($cleanup.inventory_readable -and $survivors.Count -eq 0) {
        'passed'
      } else {
        'cleanup_reconciliation_required'
      }
    if ($receipt.process_cleanup.status -eq 'passed') {
      $receipt.process_cleanup.candidate_tree_removed = Remove-RunCandidateTree
    }
  }
  if ($protectedPathWatch) {
    $protectedPathWatchResult = Stop-ProtectedPathWatch -Watch $protectedPathWatch
    $receipt.post_readback.protected_onepersonlab_mutation_event_count =
      $protectedPathWatchResult.mutation_event_count
    $receipt.post_readback.protected_onepersonlab_watch_overflow_count =
      $protectedPathWatchResult.overflow_event_count
    $receipt.post_readback.protected_onepersonlab_no_mutation_events_observed =
      $receipt.post_readback.protected_onepersonlab_mutation_event_count -eq 0 -and
        $receipt.post_readback.protected_onepersonlab_watch_overflow_count -eq 0
    $protectedPathWatch = $null
  }
  if (-not $rootProcess -and (Test-Path -LiteralPath $runCandidateRoot)) {
    $receipt.process_cleanup.candidate_tree_removed = Remove-RunCandidateTree
  }
} finally {
  if (-not $receiptWritten) {
    Write-Receipt -Payload $receipt
  }
}

if ($receipt.status -ne 'passed') {
  throw "V6 visible smoke failed; sanitized receipt: $receiptPath"
}

Write-Output $receiptPath

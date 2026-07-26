param(
  [Parameter(Mandatory = $true)]
  [ValidateSet('stopped', 'running', 'restart_persistence')]
  [string]$ExpectedPhase,

  [Nullable[datetime]]$PreRestartWindowsBootTime,

  [Parameter(Mandatory = $true)]
  [ValidatePattern('^[0-9a-fA-F]{64}$')]
  [string]$ExpectedArtifactSha256,

  [Parameter(Mandatory = $true)]
  [ValidatePattern('^[0-9a-fA-F]{64}$')]
  [string]$ExpectedIntakeManifestSha256,

  [Parameter(Mandatory = $true)]
  [ValidatePattern('^[0-9a-fA-F]{64}$')]
  [string]$ExpectedBuildReceiptSha256,

  [Parameter(Mandatory = $true)]
  [ValidatePattern('^[0-9a-fA-F]{64}$')]
  [string]$ExpectedWriterLeaseSha256,

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
  [ValidatePattern('^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')]
  [string]$PlatformOwnerTaskId,

  [Parameter(Mandatory = $true)]
  [ValidatePattern('^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')]
  [string]$ExecutorTaskId,

  [Parameter(Mandatory = $true)]
  [ValidatePattern('^[a-zA-Z0-9][a-zA-Z0-9._:-]{2,160}$')]
  [string]$WriterLeaseId,

  [Parameter(Mandatory = $true)]
  [datetime]$WriterLeaseIssuedAt,

  [Parameter(Mandatory = $true)]
  [datetime]$WriterLeaseExpiresAt,

  [Parameter(Mandatory = $true)]
  [ValidatePattern('^hyperv-vmid:[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$')]
  [string]$VmIdentity,

  [string]$ValidationRoot = 'C:\Users\Public\Documents\OnePersonLabValidation\windows-wsl2-v6-v1'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function ConvertFrom-CodePoints([int[]]$CodePoints) {
  return -join @($CodePoints | ForEach-Object { [char]$_ })
}

$validationGateName = 'OPL_WINDOWS_WSL2_VALIDATION'
$validationGateValue = '1'
$validationDistro = 'OPL-Validation-g0001'
$approvedRoot = 'C:\Users\Public\Documents\OnePersonLabValidation\windows-wsl2-v6-v1'
$sourceCustodianTaskId = '019f9bc5-8707-78b2-b221-5453d9d9b855'
if (
  $PlatformOwnerTaskId -eq $sourceCustodianTaskId -or
  $ExecutorTaskId -eq $sourceCustodianTaskId -or
  $ExecutorTaskId -eq $PlatformOwnerTaskId
) {
  throw 'The source custodian, native-Windows platform owner, and V6 executor must be distinct.'
}
$expectedZipPath = Join-Path $approvedRoot 'OPL-Windows-WSL2-Validation-v6.zip'
$expectedWriterLeasePath = Join-Path $approvedRoot 'writer-lease.json'
$expectedIntakeManifestPath = Join-Path $approvedRoot 'windows-wsl2-v6-intake-manifest.json'
$expectedBuildReceiptPath = Join-Path $approvedRoot 'v6-build-seal-receipt.json'
$expectedEvidenceRoot = Join-Path $approvedRoot 'evidence'
$CandidateZipPath = $expectedZipPath
$WriterLeasePath = $expectedWriterLeasePath
$IntakeManifestPath = $expectedIntakeManifestPath
$BuildReceiptPath = $expectedBuildReceiptPath
$EvidenceRoot = $expectedEvidenceRoot
$candidateExecutableFileName = 'OPL Windows WSL2 Validation.exe'
$protectedOnePersonLabRoot = 'C:\Users\oplrunner\OnePersonLab'
$wslPath = Join-Path $env:SystemRoot 'System32\wsl.exe'
$candidateProcessName = 'OPL Windows WSL2 Validation.exe'
$expectedRuntimePhase = if ($ExpectedPhase -eq 'restart_persistence') { 'running' } else { $ExpectedPhase }
$windowTitle = 'OPL Windows WSL2 Validation'
$refreshNameZh = ConvertFrom-CodePoints @(0x5237, 0x65b0)
$chatNameZh = ConvertFrom-CodePoints @(0x804a, 0x5929)
$loginNameZh = ConvertFrom-CodePoints @(0x767b, 0x5f55)
$updateNameZh = ConvertFrom-CodePoints @(0x66f4, 0x65b0)
$repairNameZh = ConvertFrom-CodePoints @(0x4fee, 0x590d)
$installNameZh = ConvertFrom-CodePoints @(0x5b89, 0x88c5)
$resetPasswordNameZh = ConvertFrom-CodePoints @(0x5bc6, 0x7801, 0x91cd, 0x7f6e)
$guestTitleZh = 'Guest ' + (ConvertFrom-CodePoints @(0x8eab, 0x4efd))
$aioncoreTitleZh =
  'AionCore ' + (ConvertFrom-CodePoints @(0x5065, 0x5eb7, 0x72b6, 0x6001))
$frameworkTitleZh =
  'Framework ' + (ConvertFrom-CodePoints @(0x72b6, 0x6001))
$boundaryTitleZh =
  ConvertFrom-CodePoints @(0x6b64, 0x5019, 0x9009, 0x4e0d, 0x63d0, 0x4f9b, 0x7684, 0x80fd, 0x529b)
$acpBoundaryZh = 'ACP ' + (ConvertFrom-CodePoints @(0x5bf9, 0x8bdd))
$authenticationBoundaryZh =
  (ConvertFrom-CodePoints @(0x8ba4, 0x8bc1)) + ' bootstrap'
$websocketBoundaryZh = 'WebSocket ' + (ConvertFrom-CodePoints @(0x5bf9, 0x8bdd))
$commandsBoundaryZh = ConvertFrom-CodePoints @(
  0x767b,
  0x5f55,
  0x3001,
  0x66f4,
  0x65b0,
  0x3001,
  0x4fee,
  0x590d,
  0x3001,
  0x5b89,
  0x88c5,
  0x548c,
  0x4efb,
  0x610f
) + ' guest ' + (ConvertFrom-CodePoints @(0x547d, 0x4ee4))
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
$candidateTreeLocks = @()
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

function Get-StreamSha256([System.IO.Stream]$Stream) {
  $sha256 = [System.Security.Cryptography.SHA256]::Create()
  try {
    $hashBytes = $sha256.ComputeHash($Stream)
    return ([System.BitConverter]::ToString($hashBytes) -replace '-', '').ToLowerInvariant()
  } finally {
    $sha256.Dispose()
  }
}

function Expand-VerifiedCandidateZip(
  [string]$ZipPath,
  [string]$DestinationRoot,
  [string]$ExpectedSha256,
  [string]$ExpectedExecutableFileName
) {
  Add-Type -AssemblyName System.IO.Compression
  Add-Type -AssemblyName System.IO.Compression.FileSystem
  $zipStream = [System.IO.File]::Open(
    $ZipPath,
    [System.IO.FileMode]::Open,
    [System.IO.FileAccess]::Read,
    [System.IO.FileShare]::Read
  )
  try {
    $sizeBytes = $zipStream.Length
    $actualSha256 = Get-StreamSha256 -Stream $zipStream
    if ($actualSha256 -ne $ExpectedSha256.ToLowerInvariant()) {
      throw 'Candidate ZIP SHA256 does not match the expected artifact'
    }
    $zipStream.Position = 0

    $normalizedRoot = Get-NormalizedPath $DestinationRoot
    $rootPrefix = $normalizedRoot + '\'
    [void][System.IO.Directory]::CreateDirectory($normalizedRoot)
    $entryPaths = [System.Collections.Generic.HashSet[string]]::new(
      [System.StringComparer]::OrdinalIgnoreCase
    )
    $candidateEntryCount = 0
    $candidateEntrySha256 = $null
    $archive = [System.IO.Compression.ZipArchive]::new(
      $zipStream,
      [System.IO.Compression.ZipArchiveMode]::Read,
      $true
    )
    try {
      foreach ($entry in $archive.Entries) {
        $normalizedEntryName = ([string]$entry.FullName).Replace('\', '/')
        $isDirectory = $normalizedEntryName.EndsWith('/')
        $canonicalEntryName = $normalizedEntryName.TrimEnd('/')
        if (
          -not $canonicalEntryName -or
          $normalizedEntryName.StartsWith('/') -or
          [System.IO.Path]::IsPathRooted($normalizedEntryName) -or
          $normalizedEntryName.Contains(':')
        ) {
          throw "Candidate ZIP contains an unsafe entry path: $normalizedEntryName"
        }
        $segments = @($canonicalEntryName.Split('/'))
        if (@($segments | Where-Object { -not $_ -or $_ -in @('.', '..') }).Count -ne 0) {
          throw "Candidate ZIP contains an unsafe entry path: $normalizedEntryName"
        }
        if (-not $entryPaths.Add($canonicalEntryName)) {
          throw "Candidate ZIP contains a duplicate entry path: $canonicalEntryName"
        }

        $outputPath = [System.IO.Path]::GetFullPath(
          (Join-Path $normalizedRoot ($segments -join '\'))
        )
        if (
          -not $outputPath.StartsWith(
            $rootPrefix,
            [System.StringComparison]::OrdinalIgnoreCase
          )
        ) {
          throw "Candidate ZIP entry escapes the run-owned tree: $normalizedEntryName"
        }
        if ($isDirectory) {
          [void][System.IO.Directory]::CreateDirectory($outputPath)
          continue
        }

        [void][System.IO.Directory]::CreateDirectory(
          [System.IO.Path]::GetDirectoryName($outputPath)
        )
        $entryStream = $entry.Open()
        $outputStream = [System.IO.File]::Open(
          $outputPath,
          [System.IO.FileMode]::CreateNew,
          [System.IO.FileAccess]::Write,
          [System.IO.FileShare]::None
        )
        $entrySha = [System.Security.Cryptography.SHA256]::Create()
        try {
          $buffer = [byte[]]::new(65536)
          while (($readCount = $entryStream.Read($buffer, 0, $buffer.Length)) -gt 0) {
            $outputStream.Write($buffer, 0, $readCount)
            [void]$entrySha.TransformBlock($buffer, 0, $readCount, $buffer, 0)
          }
          [void]$entrySha.TransformFinalBlock([byte[]]@(), 0, 0)
          $entrySha256 =
            ([System.BitConverter]::ToString($entrySha.Hash) -replace '-', '').ToLowerInvariant()
        } finally {
          $entrySha.Dispose()
          $outputStream.Dispose()
          $entryStream.Dispose()
        }

        if ($canonicalEntryName -eq $ExpectedExecutableFileName) {
          $candidateEntryCount += 1
          $candidateEntrySha256 = $entrySha256
        }
      }
    } finally {
      $archive.Dispose()
    }

    if ($candidateEntryCount -ne 1) {
      throw "Candidate ZIP must contain exactly one root $ExpectedExecutableFileName entry"
    }
    $extractedExecutablePath = Join-Path $normalizedRoot $ExpectedExecutableFileName
    $extractedExecutableSha256 =
      (Get-FileHash -Algorithm SHA256 -LiteralPath $extractedExecutablePath).Hash.ToLowerInvariant()
    if ($extractedExecutableSha256 -ne $candidateEntrySha256) {
      throw 'Extracted candidate executable does not match the locked ZIP entry'
    }
    return [pscustomobject]@{
      sha256 = $actualSha256
      size_bytes = $sizeBytes
      executable_sha256 = $candidateEntrySha256
    }
  } finally {
    $zipStream.Dispose()
  }
}

function Get-CandidateTreeIdentity([string]$RootPath) {
  $normalizedRoot = Get-NormalizedPath $RootPath
  $files = [string[]]@(
    [System.IO.Directory]::GetFiles(
      $normalizedRoot,
      '*',
      [System.IO.SearchOption]::AllDirectories
    )
  )
  [System.Array]::Sort($files, [System.StringComparer]::Ordinal)
  if ($files.Count -eq 0) {
    throw 'Verified candidate tree is empty'
  }

  $manifest = [System.IO.MemoryStream]::new()
  $utf8 = [System.Text.UTF8Encoding]::new($false)
  try {
    foreach ($filePath in $files) {
      $relativePath = $filePath.Substring($normalizedRoot.Length + 1).Replace('\', '/')
      $fileInfo = [System.IO.FileInfo]::new($filePath)
      $fileSha256 =
        (Get-FileHash -Algorithm SHA256 -LiteralPath $filePath).Hash.ToLowerInvariant()
      $recordBytes = $utf8.GetBytes(
        "$relativePath`0$($fileInfo.Length)`0$fileSha256`n"
      )
      $manifest.Write($recordBytes, 0, $recordBytes.Length)
    }
    $manifest.Position = 0
    return [pscustomobject]@{
      sha256 = Get-StreamSha256 -Stream $manifest
      file_count = $files.Count
    }
  } finally {
    $manifest.Dispose()
  }
}

function Open-CandidateTreeLocks(
  [string]$RootPath,
  [string]$ExpectedTreeSha256,
  [int]$ExpectedFileCount
) {
  $normalizedRoot = Get-NormalizedPath $RootPath
  $files = [string[]]@(
    [System.IO.Directory]::GetFiles(
      $normalizedRoot,
      '*',
      [System.IO.SearchOption]::AllDirectories
    )
  )
  [System.Array]::Sort($files, [System.StringComparer]::Ordinal)
  if ($files.Count -ne $ExpectedFileCount) {
    throw 'Candidate tree file count changed before write locks were acquired'
  }

  $locks = [System.Collections.Generic.List[System.IO.FileStream]]::new()
  try {
    foreach ($filePath in $files) {
      $locks.Add(
        [System.IO.File]::Open(
          $filePath,
          [System.IO.FileMode]::Open,
          [System.IO.FileAccess]::Read,
          [System.IO.FileShare]::Read
        )
      )
    }
    $lockedIdentity = Get-CandidateTreeIdentity -RootPath $normalizedRoot
    if (
      $lockedIdentity.file_count -ne $ExpectedFileCount -or
      $lockedIdentity.sha256 -ne $ExpectedTreeSha256
    ) {
      throw 'Candidate tree changed while write locks were acquired'
    }
    return @($locks)
  } catch {
    foreach ($lock in $locks) {
      $lock.Dispose()
    }
    throw
  }
}

function Close-CandidateTreeLocks {
  foreach ($lock in $script:candidateTreeLocks) {
    $lock.Dispose()
  }
  $script:candidateTreeLocks = @()
}

function Get-CandidateProcesses {
  return @(
    Get-CimInstance Win32_Process -Filter "Name='$candidateProcessName'" -ErrorAction Stop |
      Select-Object Name, ProcessId, ParentProcessId, ExecutablePath, CreationDate
  )
}

function Get-ProcessInventory {
  return @(
    Get-CimInstance Win32_Process -ErrorAction Stop |
      Select-Object Name, ProcessId, ParentProcessId, ExecutablePath, CreationDate
  )
}

function Get-TrackedCandidateProcesses {
  if (-not $launchStartedAt) {
    return @()
  }
  $rows = Get-ProcessInventory

  # Normalize the root to CIM identity and invalidate reused tracked PIDs before
  # following any parent links from this inventory snapshot.
  foreach ($row in $rows) {
    $processId = [int]$row.ProcessId
    if (-not $trackedProcessIds.Contains($processId)) {
      continue
    }
    $identity = $ownedProcessIdentity[[string]$processId]
    $createdAt =
      if ($row.CreationDate) { ([datetime]$row.CreationDate).ToUniversalTime() } else { $null }
    $resolvedPath =
      if ($row.ExecutablePath) { Get-NormalizedPath $row.ExecutablePath } else { $null }

    if ($rootProcess -and $processId -eq $rootProcess.Id) {
      $rootPathMatches =
        $resolvedPath -and
        [string]::Equals(
          $resolvedPath,
          (Get-NormalizedPath $launchExecutablePath),
          [System.StringComparison]::OrdinalIgnoreCase
        )
      if ($createdAt -and $createdAt -ge $launchStartedAt.AddSeconds(-2) -and $rootPathMatches) {
        $ownedProcessIdentity[[string]$processId] = [pscustomobject]@{
          executable_path = $resolvedPath
          created_at = $createdAt.ToString('o')
          parent_process_id = [int]$row.ParentProcessId
        }
      } else {
        [void]$trackedProcessIds.Remove($processId)
        $ownedProcessIdentity.Remove([string]$processId)
      }
      continue
    }

    $identityMatches =
      $identity -and
      $createdAt -and
      $createdAt.ToString('o') -eq $identity.created_at -and
      (
        -not $identity.executable_path -or
        [string]::Equals(
          $resolvedPath,
          $identity.executable_path,
          [System.StringComparison]::OrdinalIgnoreCase
        )
      )
    if (-not $identityMatches) {
      [void]$trackedProcessIds.Remove($processId)
      $ownedProcessIdentity.Remove([string]$processId)
    }
  }

  $eligibleRows = @(
    $rows |
      Where-Object {
        $createdAt = if ($_.CreationDate) { ([datetime]$_.CreationDate).ToUniversalTime() } else { $null }
        $createdAt -and
        $createdAt -ge $launchStartedAt.AddSeconds(-2)
      }
  )

  $madeProgress = $true
  while ($madeProgress) {
    $madeProgress = $false
    foreach ($row in $eligibleRows) {
      $processId = [int]$row.ProcessId
      if ($trackedProcessIds.Contains($processId)) {
        continue
      }
      $parentIdentity = $ownedProcessIdentity[[string]([int]$row.ParentProcessId)]
      $createdAt = ([datetime]$row.CreationDate).ToUniversalTime()
      $parentCreatedAt =
        if ($parentIdentity) { [datetime]$parentIdentity.created_at } else { $null }
      if ($parentIdentity -and $createdAt -ge $parentCreatedAt) {
        [void]$trackedProcessIds.Add($processId)
        $ownedProcessIdentity[[string]$processId] = [pscustomobject]@{
          executable_path =
            if ($row.ExecutablePath) { Get-NormalizedPath $row.ExecutablePath } else { $null }
          created_at = $createdAt.ToString('o')
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
        $resolvedPath =
          if ($_.ExecutablePath) { Get-NormalizedPath $_.ExecutablePath } else { $null }
        $identity -and
        $_.CreationDate -and
        ([datetime]$_.CreationDate).ToUniversalTime().ToString('o') -eq $identity.created_at -and
        (
          -not $identity.executable_path -or
          [string]::Equals(
            $resolvedPath,
            $identity.executable_path,
            [System.StringComparison]::OrdinalIgnoreCase
          )
        )
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
          $_.name -in @('Refresh', $refreshNameZh)
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
      Where-Object { $_.Current.Name -in @('Refresh', $refreshNameZh) }
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
        $_.name -in @('Refresh', $refreshNameZh)
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

  $forbiddenControlNames = @(
    'chat',
    $chatNameZh,
    'login',
    $loginNameZh,
    'update',
    $updateNameZh,
    'repair',
    $repairNameZh,
    'install',
    $installNameZh,
    'reset password',
    $resetPasswordNameZh
  )
  $forbiddenControls = @(
    $Items |
      Where-Object {
        $_.control_type -in @('ControlType.Button', 'ControlType.Edit') -and
        $_.name.ToLowerInvariant() -in $forbiddenControlNames
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

  $guestTitleIndex = Find-TextIndex -Items $Items -Names @('Guest identity', $guestTitleZh)
  $aioncoreTitleIndex = Find-TextIndex -Items $Items -Names @('AionCore health', $aioncoreTitleZh)
  $codexTitleIndex = Find-TextIndex -Items $Items -Names @('Direct Codex App Server')
  $frameworkTitleIndex = Find-TextIndex -Items $Items -Names @('Framework state', $frameworkTitleZh)
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
    $boundaryTitleZh,
    $acpBoundaryZh,
    $authenticationBoundaryZh,
    $websocketBoundaryZh,
    $commandsBoundaryZh
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
    -TitleNames @('Guest identity', $guestTitleZh) `
    -NextTitleNames @('AionCore health', $aioncoreTitleZh) `
    -AllowedStates $(if ($ExpectedPhase -eq 'stopped') { @('unavailable') } else { @('observed') }) `
    -AllowedDetails $guestAllowedDetails

  $aioncore = Read-StatusGroup `
    -Items $Items `
    -TitleNames @('AionCore health', $aioncoreTitleZh) `
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
    -NextTitleNames @('Framework state', $frameworkTitleZh) `
    -AllowedStates $(if ($ExpectedPhase -eq 'stopped') { @('unavailable') } else { @('unverified', 'unavailable') }) `
    -AllowedDetails @(
      'Direct Codex App Server is not started by this status-only candidate.',
      'Fixture binary exists; Direct Codex App Server is intentionally not started.',
      'Fixture Direct Codex binary is missing.'
    )
  $framework = Read-StatusGroup `
    -Items $Items `
    -TitleNames @('Framework state', $frameworkTitleZh) `
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

function Get-OwnedListenerCount {
  try {
    return @(
      Get-NetTCPConnection -State Listen -ErrorAction Stop |
        Where-Object { $trackedProcessIds.Contains([int]$_.OwningProcess) }
    ).Count
  } catch {
    return $null
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
$currentWindowsBootTime =
  (Get-CimInstance Win32_OperatingSystem -ErrorAction Stop).LastBootUpTime.ToUniversalTime()
$restartPersistenceRequired = $ExpectedPhase -eq 'restart_persistence'
$restartBootTimeAdvanced = $false
if ($restartPersistenceRequired) {
  if (-not $PreRestartWindowsBootTime.HasValue) {
    throw 'PreRestartWindowsBootTime is required for restart persistence evidence'
  }
  $restartBootTimeAdvanced =
    $currentWindowsBootTime -gt $PreRestartWindowsBootTime.Value.ToUniversalTime()
  if (-not $restartBootTimeAdvanced) {
    throw 'Windows boot time did not advance for restart persistence evidence'
  }
}

Assert-ExactPath -Actual $ValidationRoot -Expected $approvedRoot -Label 'ValidationRoot'
Assert-ExactPath -Actual $CandidateZipPath -Expected $expectedZipPath -Label 'CandidateZipPath'
Assert-ExactPath `
  -Actual $WriterLeasePath `
  -Expected $expectedWriterLeasePath `
  -Label 'WriterLeasePath'
Assert-ExactPath `
  -Actual $IntakeManifestPath `
  -Expected $expectedIntakeManifestPath `
  -Label 'IntakeManifestPath'
Assert-ExactPath `
  -Actual $BuildReceiptPath `
  -Expected $expectedBuildReceiptPath `
  -Label 'BuildReceiptPath'
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
  restart_persistence = [ordered]@{
    required = $restartPersistenceRequired
    pre_restart_windows_boot_time = if ($PreRestartWindowsBootTime.HasValue) {
      $PreRestartWindowsBootTime.Value.ToUniversalTime().ToString('o')
    } else { $null }
    observed_windows_boot_time = $currentWindowsBootTime.ToString('o')
    boot_time_advanced = $restartBootTimeAdvanced
  }
  observed_at = (Get-Date).ToUniversalTime().ToString('o')
  app_sha = $AppSha.ToLowerInvariant()
  shell_sha = $ShellSha.ToLowerInvariant()
  framework_sha = $FrameworkSha.ToLowerInvariant()
  artifact = [ordered]@{
    sha256 = $ExpectedArtifactSha256.ToLowerInvariant()
    intake_manifest_sha256 = $ExpectedIntakeManifestSha256.ToLowerInvariant()
    build_receipt_sha256 = $ExpectedBuildReceiptSha256.ToLowerInvariant()
    executable_sha256 = $null
    zip_entry_sha256_matches = $false
    tree_origin = 'pending'
    tree_sha256 = $null
    tree_file_count = $null
    tree_write_locks_held = $false
    tree_unchanged_after_process_exit = $false
    source_ref_binding = 'sealed_from_exact_source_packet'
    size_bytes = $null
    zip_file_name = [System.IO.Path]::GetFileName($CandidateZipPath)
    executable_file_name = $candidateExecutableFileName
    gate_environment = "$validationGateName=$validationGateValue"
  }
  vm = [ordered]@{
    identity = $VmIdentity
    host_platform = 'windows_hyperv'
    vm_name = 'OPL-V6-WSL2-01'
    writer_lease = [ordered]@{
      platform_owner_task_id = $PlatformOwnerTaskId
      executor_task_id = $ExecutorTaskId
      lease_id = $WriterLeaseId
      issued_at = $WriterLeaseIssuedAt.ToUniversalTime().ToString('o')
      expires_at = $WriterLeaseExpiresAt.ToUniversalTime().ToString('o')
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
    listener_survivor_count = $null
    writer_count = $null
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
    'source_refs_bound_by_external_build_seal'
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
  $nowUtc = (Get-Date).ToUniversalTime()
  if ($WriterLeaseIssuedAt.ToUniversalTime() -gt $nowUtc) {
    throw 'Writer lease issue time cannot be in the future'
  }
  if ($WriterLeaseExpiresAt.ToUniversalTime() -le $nowUtc) {
    throw 'Writer lease has expired'
  }
  if (-not (Test-Path -LiteralPath $CandidateZipPath -PathType Leaf)) {
    throw 'Candidate ZIP is missing'
  }
  if (-not (Test-Path -LiteralPath $WriterLeasePath -PathType Leaf)) {
    throw 'Writer lease receipt is missing'
  }
  if (-not (Test-Path -LiteralPath $IntakeManifestPath -PathType Leaf)) {
    throw 'V6 intake manifest is missing'
  }
  if (-not (Test-Path -LiteralPath $BuildReceiptPath -PathType Leaf)) {
    throw 'V6 build-seal receipt is missing'
  }
  $actualIntakeManifestSha256 =
    (Get-FileHash -Algorithm SHA256 -LiteralPath $IntakeManifestPath).Hash.ToLowerInvariant()
  if ($actualIntakeManifestSha256 -ne $ExpectedIntakeManifestSha256.ToLowerInvariant()) {
    throw 'V6 intake manifest SHA256 does not match the contract-owner packet'
  }
  $intakeManifest = Get-Content -Raw -LiteralPath $IntakeManifestPath | ConvertFrom-Json
  if (
    $intakeManifest.schema -ne 'opl_windows_wsl2_v6_intake_manifest.v1' -or
    $intakeManifest.validation_state -ne 'validation_only_non_binding' -or
    $intakeManifest.authority -ne 'one_person_lab_app_acceptance_contract' -or
    $intakeManifest.target.host_platform -ne 'windows_hyperv' -or
    $intakeManifest.target.vm_name -ne 'OPL-V6-WSL2-01' -or
    $intakeManifest.target.factory_root -ne 'C:\OPL-VMs' -or
    $intakeManifest.target.validation_root -ne $approvedRoot -or
    $intakeManifest.source_refs.app_acceptance_sha -ne $AppSha.ToLowerInvariant() -or
    $intakeManifest.source_refs.shell.git_sha -ne $ShellSha.ToLowerInvariant() -or
    $intakeManifest.source_refs.framework_fixture_sha -ne $FrameworkSha.ToLowerInvariant() -or
    $intakeManifest.authority_bindings.source_custodian_task_id -ne $sourceCustodianTaskId -or
    $intakeManifest.authority_bindings.platform_owner_task_id -ne $PlatformOwnerTaskId -or
    $intakeManifest.authority_bindings.executor_task_id -ne $ExecutorTaskId
  ) {
    throw 'V6 intake manifest does not match the authorized source packet'
  }
  $actualBuildReceiptSha256 =
    (Get-FileHash -Algorithm SHA256 -LiteralPath $BuildReceiptPath).Hash.ToLowerInvariant()
  if ($actualBuildReceiptSha256 -ne $ExpectedBuildReceiptSha256.ToLowerInvariant()) {
    throw 'V6 build-seal receipt SHA256 does not match the host-provided identity'
  }
  $buildReceipt = Get-Content -Raw -LiteralPath $BuildReceiptPath | ConvertFrom-Json
  if (
    $buildReceipt.schema -ne 'opl_windows_wsl2_v6_build_seal.v1' -or
    $buildReceipt.status -ne 'sealed' -or
    $buildReceipt.receipt_stage -ne 'candidate_sealed_pending_guest_smoke' -or
    $buildReceipt.terminal_v6_verdict -ne $false -or
    $buildReceipt.packet.intake_manifest_sha256 -ne $actualIntakeManifestSha256 -or
    $buildReceipt.packet.writer_lease_sha256 -ne
      $ExpectedWriterLeaseSha256.ToLowerInvariant() -or
    $buildReceipt.packet.vm_identity -ne $VmIdentity -or
    $buildReceipt.source_refs.app_acceptance_sha -ne $AppSha.ToLowerInvariant() -or
    $buildReceipt.source_refs.shell_sha -ne $ShellSha.ToLowerInvariant() -or
    $buildReceipt.source_refs.framework_fixture_sha -ne $FrameworkSha.ToLowerInvariant() -or
    $buildReceipt.source_refs.framework_tree_sha -ne
      $intakeManifest.source_refs.framework.root_tree_sha -or
    $buildReceipt.source_refs.framework_cli_blob_git_sha -ne
      $intakeManifest.source_refs.framework.cli_blob_git_sha -or
    $buildReceipt.source_refs.framework_cli_blob_sha256 -ne
      $intakeManifest.source_refs.framework.cli_blob_sha256 -or
    $buildReceipt.artifact.sha256 -ne $ExpectedArtifactSha256.ToLowerInvariant() -or
    $buildReceipt.artifact.file_name -ne 'OPL-Windows-WSL2-Validation-v6.zip'
  ) {
    throw 'V6 build-seal receipt does not bind the authorized packet and artifact'
  }
  $actualWriterLeaseSha256 =
    (Get-FileHash -Algorithm SHA256 -LiteralPath $WriterLeasePath).Hash.ToLowerInvariant()
  if ($actualWriterLeaseSha256 -ne $ExpectedWriterLeaseSha256.ToLowerInvariant()) {
    throw 'Writer lease receipt SHA256 does not match the host-provided identity'
  }
  $writerLease = Get-Content -Raw -LiteralPath $WriterLeasePath | ConvertFrom-Json
  $writerLeaseVmId = ([string]$writerLease.vm_identity) -replace '^hyperv-vmid:', ''
  if (
    $writerLease.schema -ne 'opl_windows_v6_vm_writer_lease.v2' -or
    $writerLease.status -ne 'active' -or
    $writerLease.host_platform -ne 'windows_hyperv' -or
    $writerLease.factory_root -ne 'C:\OPL-VMs' -or
    $writerLease.vm_name -ne 'OPL-V6-WSL2-01' -or
    $writerLease.vm_identity -ne $VmIdentity -or
    $writerLease.platform_owner_task_id -ne $PlatformOwnerTaskId -or
    $writerLease.executor_task_id -ne $ExecutorTaskId -or
    $writerLease.request.schema -ne 'opl_windows_vm_lease_request.v2' -or
    $writerLease.request.factory_root -ne 'C:\OPL-VMs' -or
    $writerLease.packet.manifest_sha256 -ne $actualIntakeManifestSha256 -or
    $writerLease.localization.ui_language -ne 'zh-CN' -or
    $writerLease.localization.default_input_method_tip -ne '0804:00000804' -or
    $writerLease.network.writable_surface_overlap_count -ne 0 -or
    $writerLease.lease_id -ne $WriterLeaseId -or
    ([datetime]$writerLease.issued_at).ToUniversalTime() -ne
      $WriterLeaseIssuedAt.ToUniversalTime() -or
    ([datetime]$writerLease.expires_at).ToUniversalTime() -ne
      $WriterLeaseExpiresAt.ToUniversalTime() -or
    @($writerLease.allowed_operations).Count -ne 4 -or
    $writerLease.allowed_operations -notcontains 'v6_build_seal' -or
    $writerLease.allowed_operations -notcontains 'v6_fixture_phase_transition' -or
    $writerLease.allowed_operations -notcontains 'v6_guest_visible_smoke' -or
    $writerLease.allowed_operations -notcontains 'v6_soft_shutdown' -or
    $writerLease.clean_vm_attestation.status -ne 'attested' -or
    $writerLease.clean_vm_attestation.vm_id -ne $writerLeaseVmId -or
    $writerLease.clean_vm_attestation.vm_identity -ne $writerLease.vm_identity -or
    $writerLease.clean_vm_attestation.vm_state -ne 'Off' -or
    $writerLease.clean_vm_attestation.config_path -ne $writerLease.vm_paths.config_path -or
    $writerLease.clean_vm_attestation.active_vhdx_path -ne $writerLease.vm_paths.active_vhdx_path -or
    $writerLease.clean_vm_attestation.checkpoint_name -notlike 'OPL-Clean-Windows-zh-CN-*' -or
    $writerLease.clean_vm_attestation.localization.default_input_method_tip -ne '0804:00000804' -or
    $writerLease.clean_vm_attestation.network.switch_id -ne $writerLease.network.switch_id -or
    ([datetime]$writerLease.clean_vm_attestation.attested_at).ToUniversalTime() -gt
      $nowUtc
  ) {
    throw 'Writer lease receipt does not match the authorized VM lease'
  }
  $receipt.vm.writer_lease.receipt_sha256 = $actualWriterLeaseSha256
  $expandedArtifact = Expand-VerifiedCandidateZip `
    -ZipPath $CandidateZipPath `
    -DestinationRoot $runCandidateRoot `
    -ExpectedSha256 $ExpectedArtifactSha256 `
    -ExpectedExecutableFileName $candidateExecutableFileName
  $receipt.artifact.size_bytes = $expandedArtifact.size_bytes
  $receipt.preflight.artifact_path_identity = 'approved_exact_path'
  $receipt.preflight.artifact_sha256_matches = $true
  if (-not (Test-Path -LiteralPath $launchExecutablePath -PathType Leaf)) {
    throw 'Verified ZIP expansion does not contain the candidate executable'
  }
  $executableSha256 = $expandedArtifact.executable_sha256
  if ($executableSha256 -ne $buildReceipt.artifact.executable_sha256) {
    throw 'Extracted executable does not match the build-seal receipt'
  }
  $candidateTreeIdentity = Get-CandidateTreeIdentity -RootPath $runCandidateRoot
  if (
    [int64]$buildReceipt.artifact.size_bytes -ne [int64]$expandedArtifact.size_bytes -or
    [int]$buildReceipt.artifact.tree_file_count -ne [int]$candidateTreeIdentity.file_count -or
    $buildReceipt.artifact.tree_sha256 -ne $candidateTreeIdentity.sha256
  ) {
    throw 'Verified ZIP expansion does not match the build-seal tree identity'
  }
  $receipt.artifact.executable_sha256 = $executableSha256
  $receipt.artifact.zip_entry_sha256_matches = $true
  $receipt.artifact.tree_origin = 'verified_zip_expansion'
  $receipt.artifact.tree_sha256 = $candidateTreeIdentity.sha256
  $receipt.artifact.tree_file_count = $candidateTreeIdentity.file_count

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
  if ($actualPhase -ne $expectedRuntimePhase) {
    throw "Expected $expectedRuntimePhase fixture phase, observed $actualPhase"
  }
  $receipt.preflight.expected_phase_matches = $true
  $validationPhaseSamples.Add($preInventory.validation_state)
  $protectedPathWatch = Start-ProtectedPathWatch
  $receipt.preflight.protected_onepersonlab_watch_active = $true

  $candidateTreeLocks = @(
    Open-CandidateTreeLocks `
      -RootPath $runCandidateRoot `
      -ExpectedTreeSha256 $candidateTreeIdentity.sha256 `
      -ExpectedFileCount $candidateTreeIdentity.file_count
  )
  if ($candidateTreeLocks.Count -ne $candidateTreeIdentity.file_count) {
    throw 'Candidate tree write locks do not cover every extracted file'
  }
  $receipt.artifact.tree_write_locks_held = $true

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
  if ($initialProjectionInventory.validation_state.ToLowerInvariant() -ne $expectedRuntimePhase) {
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
  if ($refreshProjectionInventory.validation_state.ToLowerInvariant() -ne $expectedRuntimePhase) {
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

  $postProcessTreeIdentity = Get-CandidateTreeIdentity -RootPath $runCandidateRoot
  if (
    $postProcessTreeIdentity.file_count -ne $candidateTreeIdentity.file_count -or
    $postProcessTreeIdentity.sha256 -ne $candidateTreeIdentity.sha256
  ) {
    throw 'Candidate tree changed before the owned processes exited'
  }
  $receipt.artifact.tree_unchanged_after_process_exit = $true
  Close-CandidateTreeLocks

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
  $receipt.process_cleanup.listener_survivor_count = Get-OwnedListenerCount
  $postReadbackPassed =
    $receipt.post_readback.default_distro_unchanged -and
    $receipt.post_readback.docker_desktop_state_unchanged -and
    $receipt.post_readback.validation_distro_state_unchanged -and
    $receipt.post_readback.protected_onepersonlab_presence_unchanged -and
    $receipt.post_readback.protected_onepersonlab_no_mutation_events_observed -and
    $receipt.process_cleanup.wsl_survivor_count -eq 0 -and
    $receipt.process_cleanup.listener_survivor_count -eq 0
  $receipt.post_readback.status = if ($postReadbackPassed) { 'passed' } else { 'failed' }
  if (-not $postReadbackPassed) {
    throw 'Post-run WSL or protected-path readback changed'
  }
  $receipt.process_cleanup.candidate_tree_removed = Remove-RunCandidateTree
  $receipt.process_cleanup.writer_count =
    if ($receipt.process_cleanup.candidate_tree_removed) { 0 } else { $null }
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
      Close-CandidateTreeLocks
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
    Close-CandidateTreeLocks
    $receipt.process_cleanup.candidate_tree_removed = Remove-RunCandidateTree
  }
} finally {
  Close-CandidateTreeLocks
  if (-not $receiptWritten) {
    Write-Receipt -Payload $receipt
  }
}

if ($receipt.status -ne 'passed') {
  throw "V6 visible smoke failed; sanitized receipt: $receiptPath"
}

Write-Output $receiptPath

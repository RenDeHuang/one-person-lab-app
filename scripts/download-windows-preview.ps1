# Downloads one immutable One Person Lab Windows Preview installer with BITS.

[CmdletBinding()]
param(
  [ValidatePattern("^windows-rc-[0-9]+\.[0-9]+\.[0-9]+-rc\.[1-9][0-9]*$")]
  [string]$ReleaseTag = "__OPL_WINDOWS_PREVIEW_RELEASE_TAG__",
  [ValidatePattern("^One-Person-Lab-[0-9]+\.[0-9]+\.[0-9]+-rc\.[1-9][0-9]*-win-x64\.exe$")]
  [string]$AssetName = "__OPL_WINDOWS_PREVIEW_INSTALLER_ASSET__",
  [string]$OutputDirectory = (Join-Path ([Environment]::GetFolderPath("UserProfile")) "Downloads\OPL-RC"),
  [ValidateRange(5, 1440)]
  [int]$MaxWaitMinutes = 120
)

Set-StrictMode -Version 3.0
$ErrorActionPreference = "Stop"
$repository = "__OPL_WINDOWS_PREVIEW_REPOSITORY__"
$embeddedReleaseTag = "__OPL_WINDOWS_PREVIEW_RELEASE_TAG__"
$embeddedInstallerAsset = "__OPL_WINDOWS_PREVIEW_INSTALLER_ASSET__"
$embeddedInstallerSha256 = "__OPL_WINDOWS_PREVIEW_INSTALLER_SHA256__"
[int64]$embeddedInstallerSizeBytes = __OPL_WINDOWS_PREVIEW_INSTALLER_SIZE_BYTES__
$checksumAssetName = "SHA256SUMS.txt"

function Write-Step {
  param([Parameter(Mandatory = $true)][string]$Message)
  Write-Host "[One Person Lab] $Message"
}

function Get-InstallerChecksum {
  param(
    [Parameter(Mandatory = $true)][string]$ChecksumPath,
    [Parameter(Mandatory = $true)][string]$InstallerName
  )

  $escapedName = [regex]::Escape($InstallerName)
  $matches = @(
    Get-Content -LiteralPath $ChecksumPath |
      ForEach-Object {
        if ($_ -match "^([0-9a-fA-F]{64})\s+\*?${escapedName}$") {
          $Matches[1].ToLowerInvariant()
        }
      }
  )
  if ($matches.Count -ne 1) {
    throw "Expected exactly one SHA-256 entry for $InstallerName in $checksumAssetName."
  }
  return [string]$matches[0]
}

function Test-FileSha256 {
  param(
    [Parameter(Mandatory = $true)][string]$PathValue,
    [Parameter(Mandatory = $true)][string]$ExpectedSha256
  )

  if (-not (Test-Path -LiteralPath $PathValue -PathType Leaf)) {
    return $false
  }
  $actual = (Get-FileHash -LiteralPath $PathValue -Algorithm SHA256).Hash.ToLowerInvariant()
  return $actual -ceq $ExpectedSha256
}

function Test-InstallerIdentity {
  param(
    [Parameter(Mandatory = $true)][string]$PathValue,
    [Parameter(Mandatory = $true)][int64]$ExpectedSizeBytes,
    [Parameter(Mandatory = $true)][string]$ExpectedSha256
  )

  if (-not (Test-Path -LiteralPath $PathValue -PathType Leaf)) {
    return $false
  }
  $actualSizeBytes = (Get-Item -LiteralPath $PathValue).Length
  if ($actualSizeBytes -ne $ExpectedSizeBytes) {
    return $false
  }
  return Test-FileSha256 -PathValue $PathValue -ExpectedSha256 $ExpectedSha256
}

function Move-InvalidDownloadAside {
  param([Parameter(Mandatory = $true)][string]$PathValue)

  if (-not (Test-Path -LiteralPath $PathValue -PathType Leaf)) {
    return
  }
  $timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
  $invalidPath = "${PathValue}.invalid-${timestamp}"
  Move-Item -LiteralPath $PathValue -Destination $invalidPath
  Write-Step "Existing bytes did not match the expected SHA-256 and were preserved at $invalidPath."
}

function Get-MatchingBitsJob {
  param(
    [Parameter(Mandatory = $true)][string]$DisplayName,
    [Parameter(Mandatory = $true)][string]$Source,
    [Parameter(Mandatory = $true)][string]$Destination
  )

  $jobs = @(Get-BitsTransfer | Where-Object { $_.DisplayName -ceq $DisplayName })
  if ($jobs.Count -gt 1) {
    throw "Found multiple BITS jobs named $DisplayName. Remove the duplicate jobs with Get-BitsTransfer and Remove-BitsTransfer, then rerun."
  }
  if ($jobs.Count -eq 0) {
    return $null
  }

  $job = $jobs[0]
  $files = @($job.FileList)
  if ($files.Count -ne 1) {
    throw "Existing BITS job $DisplayName has an unexpected file count."
  }
  $expectedDestination = [System.IO.Path]::GetFullPath($Destination)
  $actualDestination = [System.IO.Path]::GetFullPath([string]$files[0].LocalName)
  if (
    $files[0].RemoteName -cne $Source -or
    -not [string]::Equals(
      $actualDestination,
      $expectedDestination,
      [System.StringComparison]::OrdinalIgnoreCase
    )
  ) {
    throw "Existing BITS job $DisplayName is bound to different source or destination bytes."
  }
  return $job
}

function Receive-BitsFile {
  param(
    [Parameter(Mandatory = $true)][string]$Source,
    [Parameter(Mandatory = $true)][string]$Destination,
    [Parameter(Mandatory = $true)][string]$DisplayName,
    [Parameter(Mandatory = $true)][datetime]$Deadline
  )

  $job = Get-MatchingBitsJob -DisplayName $DisplayName -Source $Source -Destination $Destination
  if ($null -eq $job) {
    Write-Step "Starting persistent BITS transfer: $DisplayName"
    $job = Start-BitsTransfer `
      -Source $Source `
      -Destination $Destination `
      -DisplayName $DisplayName `
      -Description "Official immutable One Person Lab Windows Preview asset" `
      -Asynchronous
  } else {
    Write-Step "Resuming persistent BITS transfer: $DisplayName"
    if ($job.JobState -eq "Suspended") {
      Resume-BitsTransfer -BitsJob $job
    }
  }

  $nextHeartbeatAt = Get-Date
  while ($true) {
    $job = Get-BitsTransfer -Id $job.Id
    switch ([string]$job.JobState) {
      "Transferred" {
        Complete-BitsTransfer -BitsJob $job
        Write-Progress -Activity $DisplayName -Completed
        return
      }
      "Error" {
        $description = [string]$job.ErrorDescription
        Remove-BitsTransfer -BitsJob $job
        throw "BITS could not download $DisplayName. $description"
      }
      "Cancelled" {
        throw "BITS transfer $DisplayName was cancelled."
      }
      "Acknowledged" {
        if (Test-Path -LiteralPath $Destination -PathType Leaf) {
          return
        }
        throw "BITS acknowledged $DisplayName without creating the destination file."
      }
      "Suspended" {
        Resume-BitsTransfer -BitsJob $job
      }
    }

    $total = [int64]$job.BytesTotal
    $transferred = [int64]$job.BytesTransferred
    $status = if ($total -gt 0) {
      $percent = [math]::Min(100, [math]::Floor(($transferred * 100.0) / $total))
      Write-Progress -Activity $DisplayName -Status "$transferred / $total bytes" -PercentComplete $percent
      "$percent% ($transferred / $total bytes), state $($job.JobState)"
    } else {
      Write-Progress -Activity $DisplayName -Status "$transferred bytes, state $($job.JobState)"
      "$transferred bytes, state $($job.JobState)"
    }
    if ((Get-Date) -ge $nextHeartbeatAt) {
      Write-Step "${DisplayName}: $status. Closing this PowerShell window does not discard the BITS job; rerun the same command to reattach."
      $nextHeartbeatAt = (Get-Date).AddSeconds(15)
    }
    if ((Get-Date) -ge $Deadline) {
      Suspend-BitsTransfer -BitsJob $job
      throw "Download wait limit reached. The BITS job was preserved in a suspended state. Rerun the same command to continue."
    }
    Start-Sleep -Seconds 1
  }
}

if ($PSVersionTable.PSVersion.Major -lt 5) {
  throw "Windows PowerShell 5.1 or PowerShell 7 is required."
}
if ([Environment]::OSVersion.Platform -ne [PlatformID]::Win32NT) {
  throw "This helper runs only on Windows."
}

Import-Module BitsTransfer -ErrorAction Stop
New-Item -ItemType Directory -Force -Path $OutputDirectory | Out-Null
$resolvedOutputDirectory = [System.IO.Path]::GetFullPath($OutputDirectory)
if ($ReleaseTag -cne $embeddedReleaseTag) {
  throw "This helper is bound to $embeddedReleaseTag and cannot download $ReleaseTag."
}
if ($AssetName -cne $embeddedInstallerAsset) {
  throw "This helper is bound to $embeddedInstallerAsset and cannot download $AssetName."
}
if ($embeddedInstallerSha256 -notmatch "^[0-9a-f]{64}$") {
  throw "This helper does not contain a valid release-bound installer SHA-256."
}
if ($embeddedInstallerSizeBytes -le 0) {
  throw "This helper does not contain a valid release-bound installer size."
}
$releaseAssetBaseUrl = "https://github.com/$repository/releases/download/$ReleaseTag"
$checksumAssetUrl = "$releaseAssetBaseUrl/$checksumAssetName"
$installerAssetUrl = "$releaseAssetBaseUrl/$AssetName"
Write-Step "Using embedded exact identity for immutable Windows Preview $ReleaseTag."
Write-Step "Expected installer: $AssetName ($embeddedInstallerSizeBytes bytes)."
$deadline = (Get-Date).AddMinutes($MaxWaitMinutes)

$checksumPath = Join-Path $resolvedOutputDirectory $checksumAssetName
$checksumDownloadPath = "${checksumPath}.download"
Move-InvalidDownloadAside -PathValue $checksumDownloadPath
Receive-BitsFile `
  -Source $checksumAssetUrl `
  -Destination $checksumDownloadPath `
  -DisplayName "OPL $ReleaseTag checksums" `
  -Deadline $deadline
Move-Item -LiteralPath $checksumDownloadPath -Destination $checksumPath -Force
$expectedSha256 = Get-InstallerChecksum -ChecksumPath $checksumPath -InstallerName $AssetName
if ($expectedSha256 -cne $embeddedInstallerSha256) {
  throw "The release-bound installer digest and $checksumAssetName disagree for $AssetName."
}

$installerPath = Join-Path $resolvedOutputDirectory $AssetName
if (
  Test-InstallerIdentity `
    -PathValue $installerPath `
    -ExpectedSizeBytes $embeddedInstallerSizeBytes `
    -ExpectedSha256 $expectedSha256
) {
  Write-Step "Verified installer already exists: $installerPath"
  exit 0
}
Move-InvalidDownloadAside -PathValue $installerPath
$installerDownloadPath = "${installerPath}.download"
if (
  -not (
    Test-InstallerIdentity `
      -PathValue $installerDownloadPath `
      -ExpectedSizeBytes $embeddedInstallerSizeBytes `
      -ExpectedSha256 $expectedSha256
  )
) {
  Move-InvalidDownloadAside -PathValue $installerDownloadPath
  Receive-BitsFile `
    -Source $installerAssetUrl `
    -Destination $installerDownloadPath `
    -DisplayName "OPL $ReleaseTag installer" `
    -Deadline $deadline
}

Write-Step "Verifying exact size and SHA-256 before exposing the installer."
if (
  -not (
    Test-InstallerIdentity `
      -PathValue $installerDownloadPath `
      -ExpectedSizeBytes $embeddedInstallerSizeBytes `
      -ExpectedSha256 $expectedSha256
  )
) {
  Move-InvalidDownloadAside -PathValue $installerDownloadPath
  throw "Downloaded installer bytes do not match the immutable Release identity."
}
Move-Item -LiteralPath $installerDownloadPath -Destination $installerPath
Write-Step "Download, size, and SHA-256 verification passed: $installerPath"
Write-Step "Expected SHA-256: $expectedSha256"
Write-Step "This Preview may still show SmartScreen until it has production Authenticode signing. Do not disable Defender or SmartScreen."

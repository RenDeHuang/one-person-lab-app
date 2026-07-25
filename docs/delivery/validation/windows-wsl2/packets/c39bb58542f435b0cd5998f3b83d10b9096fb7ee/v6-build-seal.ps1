param(
  [Parameter(Mandatory = $true)]
  [ValidatePattern('^[0-9a-fA-F]{64}$')]
  [string]$ExpectedIntakeManifestSha256,

  [Parameter(Mandatory = $true)]
  [ValidatePattern('^[0-9a-fA-F]{64}$')]
  [string]$ExpectedWriterLeaseSha256,

  [string]$ValidationRoot = 'C:\Users\Public\Documents\OnePersonLabValidation\windows-wsl2-v6-v1',

  [string]$GitPath = 'git.exe',

  [string]$BunPath = 'bun.exe',

  [string]$NodePath = 'node.exe'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$shellSha = '868d6e818583547a5ec982b10b34464a3fa47c10'
$shellTreeSha = '1dc9960a357d9f64eaaac7eadf44b9c1a1d00ca7'
$shellRepository = 'https://github.com/gaofeng21cn/opl-aion-shell.git'
$approvedRoot = 'C:\Users\Public\Documents\OnePersonLabValidation\windows-wsl2-v6-v1'
$manifestPath = Join-Path $ValidationRoot 'windows-wsl2-v6-intake-manifest.json'
$writerLeasePath = Join-Path $ValidationRoot 'writer-lease.json'
$receiptPath = Join-Path $ValidationRoot 'v6-build-seal-receipt.json'
$sealedZipPath = Join-Path $ValidationRoot 'OPL-Windows-WSL2-Validation-v6.zip'
$logsRoot = Join-Path $ValidationRoot 'build-logs'
$sourceRoot = Join-Path $ValidationRoot ('opl-aion-shell-' + $shellSha.Substring(0, 12))
$sourceZipRelativePath =
  'out\windows-wsl2-validation\OPL Windows WSL2 Validation-0.0.0-validation.0-win.zip'
$sourceExeRelativePath =
  'out\windows-wsl2-validation\win-unpacked\OPL Windows WSL2 Validation.exe'
$candidateExeName = 'OPL Windows WSL2 Validation.exe'

function Get-NormalizedPath([string]$PathValue) {
  return [System.IO.Path]::GetFullPath($PathValue).TrimEnd('\')
}

function Get-FileSha256([string]$PathValue) {
  return (Get-FileHash -Algorithm SHA256 -LiteralPath $PathValue).Hash.ToLowerInvariant()
}

function Get-CommandIdentity([string]$CommandName, [string[]]$VersionArguments) {
  $resolvedPath = (Get-Command $CommandName -ErrorAction Stop).Source
  $version = (& $resolvedPath @VersionArguments).Trim()
  if ($LASTEXITCODE -ne 0) {
    throw "Failed to read tool version: $resolvedPath"
  }
  return [ordered]@{
    version = $version
    path = $resolvedPath
    sha256 = Get-FileSha256 $resolvedPath
  }
}

function Get-EnvironmentEvidence([string]$Name) {
  $value = [Environment]::GetEnvironmentVariable($Name, 'Process')
  if ($null -eq $value) {
    return [ordered]@{
      present = $false
      value_sha256 = $null
    }
  }
  $bytes = [System.Text.UTF8Encoding]::new($false).GetBytes($value)
  $hasher = [System.Security.Cryptography.SHA256]::Create()
  try {
    $digest = (
      [System.BitConverter]::ToString($hasher.ComputeHash($bytes)) -replace '-', ''
    ).ToLowerInvariant()
  } finally {
    $hasher.Dispose()
  }
  return [ordered]@{
    present = $true
    value_sha256 = $digest
  }
}

function Get-StreamSha256([System.IO.Stream]$Stream) {
  $sha256 = [System.Security.Cryptography.SHA256]::Create()
  try {
    return (
      [System.BitConverter]::ToString($sha256.ComputeHash($Stream)) -replace '-', ''
    ).ToLowerInvariant()
  } finally {
    $sha256.Dispose()
  }
}

function Invoke-LoggedCommand(
  [string]$Label,
  [string]$FilePath,
  [string[]]$Arguments,
  [string]$WorkingDirectory
) {
  $logPath = Join-Path $logsRoot ($Label + '.log')
  if (Test-Path -LiteralPath $logPath) {
    throw "Build log already exists: $logPath"
  }
  Push-Location $WorkingDirectory
  $startedAt = (Get-Date).ToUniversalTime()
  try {
    & $FilePath @Arguments 2>&1 | Out-File -LiteralPath $logPath -Encoding utf8
    $exitCode = $LASTEXITCODE
  } finally {
    Pop-Location
  }
  $finishedAt = (Get-Date).ToUniversalTime()
  if ($exitCode -ne 0) {
    throw "$Label exited with code $exitCode"
  }
  return [ordered]@{
    label = $Label
    executable = (Get-Command $FilePath -ErrorAction Stop).Source
    executable_sha256 = Get-FileSha256 (Get-Command $FilePath -ErrorAction Stop).Source
    argv = @($Arguments)
    working_directory = Get-NormalizedPath $WorkingDirectory
    started_at = $startedAt.ToString('o')
    finished_at = $finishedAt.ToString('o')
    exit_code = $exitCode
    log_file_name = [System.IO.Path]::GetFileName($logPath)
    log_sha256 = Get-FileSha256 $logPath
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
    throw 'Candidate tree is empty'
  }
  $manifest = [System.IO.MemoryStream]::new()
  $utf8 = [System.Text.UTF8Encoding]::new($false)
  try {
    foreach ($filePath in $files) {
      $relativePath = $filePath.Substring($normalizedRoot.Length + 1).Replace('\', '/')
      $fileInfo = [System.IO.FileInfo]::new($filePath)
      $recordBytes = $utf8.GetBytes(
        "$relativePath`0$($fileInfo.Length)`0$(Get-FileSha256 $filePath)`n"
      )
      $manifest.Write($recordBytes, 0, $recordBytes.Length)
    }
    $manifest.Position = 0
    return [ordered]@{
      sha256 = Get-StreamSha256 $manifest
      file_count = $files.Count
    }
  } finally {
    $manifest.Dispose()
  }
}

function Expand-And-InspectZip([string]$ZipPath, [string]$DestinationRoot) {
  Add-Type -AssemblyName System.IO.Compression
  Add-Type -AssemblyName System.IO.Compression.FileSystem
  $zipStream = [System.IO.File]::Open(
    $ZipPath,
    [System.IO.FileMode]::Open,
    [System.IO.FileAccess]::Read,
    [System.IO.FileShare]::Read
  )
  try {
    $zipSha256 = Get-StreamSha256 $zipStream
    $zipStream.Position = 0
    [void][System.IO.Directory]::CreateDirectory($DestinationRoot)
    $normalizedRoot = Get-NormalizedPath $DestinationRoot
    $rootPrefix = $normalizedRoot + '\'
    $entryPaths = [System.Collections.Generic.HashSet[string]]::new(
      [System.StringComparer]::OrdinalIgnoreCase
    )
    $entries = [System.Collections.Generic.List[object]]::new()
    $archive = [System.IO.Compression.ZipArchive]::new(
      $zipStream,
      [System.IO.Compression.ZipArchiveMode]::Read,
      $true
    )
    try {
      foreach ($entry in $archive.Entries) {
        $entryName = ([string]$entry.FullName).Replace('\', '/')
        $isDirectory = $entryName.EndsWith('/')
        $canonicalName = $entryName.TrimEnd('/')
        if (
          -not $canonicalName -or
          $entryName.StartsWith('/') -or
          [System.IO.Path]::IsPathRooted($entryName) -or
          $entryName.Contains(':') -or
          @($canonicalName.Split('/') | Where-Object { -not $_ -or $_ -in @('.', '..') }).Count -ne 0
        ) {
          throw "Unsafe ZIP entry: $entryName"
        }
        if (-not $entryPaths.Add($canonicalName)) {
          throw "Duplicate ZIP entry: $canonicalName"
        }
        $outputPath = [System.IO.Path]::GetFullPath(
          (Join-Path $normalizedRoot ($canonicalName.Replace('/', '\')))
        )
        if (-not $outputPath.StartsWith(
          $rootPrefix,
          [System.StringComparison]::OrdinalIgnoreCase
        )) {
          throw "ZIP entry escapes the seal tree: $entryName"
        }
        if ($isDirectory) {
          [void][System.IO.Directory]::CreateDirectory($outputPath)
          continue
        }
        [void][System.IO.Directory]::CreateDirectory(
          [System.IO.Path]::GetDirectoryName($outputPath)
        )
        $inputStream = $entry.Open()
        $outputStream = [System.IO.File]::Open(
          $outputPath,
          [System.IO.FileMode]::CreateNew,
          [System.IO.FileAccess]::Write,
          [System.IO.FileShare]::None
        )
        try {
          $inputStream.CopyTo($outputStream)
        } finally {
          $outputStream.Dispose()
          $inputStream.Dispose()
        }
        $entries.Add([ordered]@{
          path = $canonicalName
          size_bytes = ([System.IO.FileInfo]::new($outputPath)).Length
          sha256 = Get-FileSha256 $outputPath
        })
      }
    } finally {
      $archive.Dispose()
    }
    $entryManifestBytes = [System.Text.UTF8Encoding]::new($false).GetBytes(
      (($entries | Sort-Object { $_.path } | ConvertTo-Json -Depth 4 -Compress) + "`n")
    )
    return [ordered]@{
      zip_sha256 = $zipSha256
      zip_size_bytes = $zipStream.Length
      entry_manifest_sha256 = (
        [System.BitConverter]::ToString(
          [System.Security.Cryptography.SHA256]::Create().ComputeHash($entryManifestBytes)
        ) -replace '-', ''
      ).ToLowerInvariant()
      tree = Get-CandidateTreeIdentity $normalizedRoot
      executable_sha256 = Get-FileSha256 (Join-Path $normalizedRoot $candidateExeName)
      app_asar_sha256 = Get-FileSha256 (Join-Path $normalizedRoot 'resources\app.asar')
    }
  } finally {
    $zipStream.Dispose()
  }
}

if ($env:OS -ne 'Windows_NT') {
  throw 'V6 build seal must run on the authorized Windows host'
}
if ((Get-NormalizedPath $ValidationRoot) -ne (Get-NormalizedPath $approvedRoot)) {
  throw "ValidationRoot must be $approvedRoot"
}
foreach ($pathValue in @($receiptPath, $sealedZipPath, $sourceRoot, $logsRoot)) {
  if (Test-Path -LiteralPath $pathValue) {
    throw "Create-once V6 path already exists: $pathValue"
  }
}
if (-not (Test-Path -LiteralPath $manifestPath -PathType Leaf)) {
  throw 'V6 intake manifest is missing'
}
if (-not (Test-Path -LiteralPath $writerLeasePath -PathType Leaf)) {
  throw 'V6 writer lease is missing'
}
$actualManifestSha256 = Get-FileSha256 $manifestPath
if ($actualManifestSha256 -ne $ExpectedIntakeManifestSha256.ToLowerInvariant()) {
  throw 'V6 intake manifest SHA256 mismatch'
}
$manifest = Get-Content -Raw -LiteralPath $manifestPath | ConvertFrom-Json
if (
  $manifest.schema -ne 'opl_windows_wsl2_v6_intake_manifest.v1' -or
  $manifest.validation_state -ne 'validation_only_non_binding' -or
  $manifest.target.host_platform -ne 'windows_hyperv' -or
  $manifest.target.vm_name -ne 'OPL-V6-WSL2-01' -or
  $manifest.target.factory_root -ne 'C:\OPL-VMs' -or
  $manifest.source_refs.shell.repository -ne $shellRepository -or
  $manifest.source_refs.shell.git_sha -ne $shellSha -or
  $manifest.source_refs.shell.root_tree_sha -ne $shellTreeSha -or
  $manifest.source_refs.framework_fixture_sha -ne
    'fe1fafa26f2c59922596718b305761bbc7558c9c' -or
  $manifest.source_refs.framework.repository -ne
    'https://github.com/gaofeng21cn/one-person-lab.git' -or
  $manifest.source_refs.framework.root_tree_sha -ne
    '5b27bf9fbe74815446e9ee401e81e0a192973d75' -or
  $manifest.source_refs.framework.cli_blob_git_sha -ne
    '9a81790365e5140c7965cad870c109c6afa4b564' -or
  $manifest.source_refs.framework.cli_blob_sha256 -ne
    'e040d5ddab2e4c6cb660e5ba728e61172fe9e7e2f272974b19c7c4b653e159a5'
) {
  throw 'V6 intake manifest is outside the approved source contract'
}
$actualWriterLeaseSha256 = Get-FileSha256 $writerLeasePath
if ($actualWriterLeaseSha256 -ne $ExpectedWriterLeaseSha256.ToLowerInvariant()) {
  throw 'V6 writer lease SHA256 mismatch'
}
$writerLease = Get-Content -Raw -LiteralPath $writerLeasePath | ConvertFrom-Json
$nowUtc = (Get-Date).ToUniversalTime()
$writerLeaseVmId = ([string]$writerLease.vm_identity) -replace '^hyperv-vmid:', ''
if (
  $writerLease.schema -ne 'opl_windows_v6_vm_writer_lease.v2' -or
  $writerLease.status -ne 'active' -or
  $writerLease.host_platform -ne 'windows_hyperv' -or
  $writerLease.factory_root -ne 'C:\OPL-VMs' -or
  $writerLease.vm_name -ne 'OPL-V6-WSL2-01' -or
  $writerLease.vm_identity -notmatch
    '^hyperv-vmid:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' -or
  $writerLease.platform_owner_task_id -ne
    '019f972b-f550-7961-90be-9873600cd895' -or
  $writerLease.executor_task_id -ne '019f97e4-288a-7140-8850-925c657d8c71' -or
  $writerLease.request.schema -ne 'opl_windows_vm_lease_request.v2' -or
  $writerLease.request.factory_root -ne 'C:\OPL-VMs' -or
  $writerLease.packet.manifest_sha256 -ne $actualManifestSha256 -or
  $writerLease.localization.ui_language -ne 'zh-CN' -or
  $writerLease.localization.system_locale -ne 'zh-CN' -or
  $writerLease.localization.user_locale -ne 'zh-CN' -or
  $writerLease.localization.default_input_method_tip -ne '0804:00000804' -or
  $writerLease.network.writable_surface_overlap_count -ne 0 -or
  ([datetime]$writerLease.issued_at).ToUniversalTime() -gt $nowUtc -or
  ([datetime]$writerLease.expires_at).ToUniversalTime() -le $nowUtc -or
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
  throw 'V6 writer lease does not authorize this build seal'
}
foreach ($name in @(
  'OPL_ELECTRON_BUILDER_CLI',
  'OPL_WINDOWS_WSL2_ELECTRON_DIST',
  'USE_SYSTEM_7ZA',
  'ELECTRON_BUILDER_COMPRESSION_LEVEL'
)) {
  if (Test-Path "Env:$name") {
    throw "Build override must be absent: $name"
  }
}
$env:CI = 'true'

[void][System.IO.Directory]::CreateDirectory($logsRoot)
$commands = [System.Collections.Generic.List[object]]::new()
$commands.Add((Invoke-LoggedCommand 'git-clone' $GitPath @(
  'clone', '--no-checkout', $shellRepository, $sourceRoot
) $ValidationRoot))
$commands.Add((Invoke-LoggedCommand 'git-checkout' $GitPath @(
  'checkout', '--detach', $shellSha
) $sourceRoot))
$head = (& $GitPath -C $sourceRoot rev-parse HEAD).Trim()
$tree = (& $GitPath -C $sourceRoot rev-parse 'HEAD^{tree}').Trim()
$dirty = @(& $GitPath -C $sourceRoot status --porcelain --untracked-files=all)
if ($LASTEXITCODE -ne 0 -or $head -ne $shellSha -or $tree -ne $shellTreeSha -or $dirty.Count -ne 0) {
  throw 'Fresh Shell checkout identity or cleanliness mismatch'
}
$outputRoot = Join-Path $sourceRoot 'out\windows-wsl2-validation'
if (Test-Path -LiteralPath $outputRoot) {
  throw 'Shell validation output must be absent before build'
}
if (
  (Get-FileSha256 (Join-Path $sourceRoot 'bun.lock')) -ne
    $manifest.source_refs.shell.bun_lock_sha256 -or
  (Get-FileSha256 (Join-Path $sourceRoot 'packages\desktop\src\validation\windows-wsl2\build.cjs')) -ne
    $manifest.source_refs.shell.build_script_sha256 -or
  (Get-FileSha256 (Join-Path $sourceRoot 'packages\desktop\src\validation\windows-wsl2\package.json')) -ne
    $manifest.source_refs.shell.harness_package_sha256
) {
  throw 'Shell lock or validation build source bytes changed'
}

$commands.Add((Invoke-LoggedCommand 'bun-install' $BunPath @(
  'install', '--frozen-lockfile', '--ignore-scripts'
) $sourceRoot))
$commands.Add((Invoke-LoggedCommand 'focused-test' $BunPath @(
  'run', 'test:windows:wsl2:validation'
) $sourceRoot))
$commands.Add((Invoke-LoggedCommand 'candidate-build' $BunPath @(
  'run', 'build:windows:wsl2:validation'
) $sourceRoot))

$gitIdentity = Get-CommandIdentity $GitPath @('--version')
$bunIdentity = Get-CommandIdentity $BunPath @('--version')
$nodeIdentity = Get-CommandIdentity $NodePath @('--version')
Push-Location $sourceRoot
try {
  $builderCliPath = (& $NodePath -p "require.resolve('electron-builder/cli.js')").Trim()
  $sevenZipPath = (& $NodePath -p "require('7zip-bin').path7za").Trim()
  $dependencyVersions = [ordered]@{
    electron = (& $NodePath -p "require('electron/package.json').version").Trim()
    electron_builder = (& $NodePath -p "require('electron-builder/package.json').version").Trim()
    app_builder_lib = (& $NodePath -p "require('app-builder-lib/package.json').version").Trim()
    builder_util = (& $NodePath -p "require('builder-util/package.json').version").Trim()
    seven_zip_bin = (& $NodePath -p "require('7zip-bin/package.json').version").Trim()
    app_builder_bin = (& $NodePath -p "require('app-builder-bin/package.json').version").Trim()
  }
} finally {
  Pop-Location
}
$appBuilderPath = Join-Path $sourceRoot 'node_modules\app-builder-bin\win\x64\app-builder.exe'
foreach ($toolPath in @($builderCliPath, $sevenZipPath, $appBuilderPath)) {
  if (-not (Test-Path -LiteralPath $toolPath -PathType Leaf)) {
    throw "Resolved build tool is missing: $toolPath"
  }
}
if (
  $dependencyVersions.electron -ne '37.10.3' -or
  $dependencyVersions.electron_builder -ne '26.8.1' -or
  $dependencyVersions.app_builder_lib -ne '26.8.1' -or
  $dependencyVersions.builder_util -ne '26.8.1' -or
  $dependencyVersions.seven_zip_bin -ne '5.2.0' -or
  $dependencyVersions.app_builder_bin -ne '5.0.0-alpha.12'
) {
  throw 'Lock-resolved Windows validation build toolchain changed'
}

$sourceZipPath = Join-Path $sourceRoot $sourceZipRelativePath
$sourceExePath = Join-Path $sourceRoot $sourceExeRelativePath
if (
  -not (Test-Path -LiteralPath $sourceZipPath -PathType Leaf) -or
  -not (Test-Path -LiteralPath $sourceExePath -PathType Leaf)
) {
  throw 'Expected Shell validation build artifacts are missing'
}
[System.IO.File]::Copy($sourceZipPath, $sealedZipPath, $false)
$sealTree = Join-Path $ValidationRoot 'build-seal-tree'
try {
  $artifact = Expand-And-InspectZip $sealedZipPath $sealTree
} finally {
  if (Test-Path -LiteralPath $sealTree) {
    Remove-Item -LiteralPath $sealTree -Recurse -Force
  }
}
if ($artifact.executable_sha256 -ne (Get-FileSha256 $sourceExePath)) {
  throw 'ZIP executable does not match the unpacked build executable'
}

$receipt = [ordered]@{
  schema = 'opl_windows_wsl2_v6_build_seal.v1'
  validation_state = 'validation_only_non_binding'
  receipt_stage = 'candidate_sealed_pending_guest_smoke'
  terminal_v6_verdict = $false
  status = 'sealed'
  receipt_id = 'windows-v6-build-seal-v1'
  sealed_at = (Get-Date).ToUniversalTime().ToString('o')
  packet = [ordered]@{
    intake_manifest_sha256 = $actualManifestSha256
    app_acceptance_sha = $manifest.source_refs.app_acceptance_sha
    writer_lease_sha256 = $actualWriterLeaseSha256
    vm_identity = $writerLease.vm_identity
  }
  source_refs = [ordered]@{
    app_acceptance_sha = $manifest.source_refs.app_acceptance_sha
    shell_sha = $shellSha
    shell_tree_sha = $tree
    framework_fixture_sha = $manifest.source_refs.framework_fixture_sha
    framework_tree_sha = $manifest.source_refs.framework.root_tree_sha
    framework_cli_blob_git_sha = $manifest.source_refs.framework.cli_blob_git_sha
    framework_cli_blob_sha256 = $manifest.source_refs.framework.cli_blob_sha256
  }
  checkout = [ordered]@{
    repository = $shellRepository
    head_sha = $head
    root_tree_sha = $tree
    clean = $true
    output_absent_before_build = $true
  }
  toolchain = [ordered]@{
    windows_build = [Environment]::OSVersion.Version.ToString()
    windows_architecture = [System.Runtime.InteropServices.RuntimeInformation]::OSArchitecture.ToString()
    powershell_version = $PSVersionTable.PSVersion.ToString()
    git = $gitIdentity
    bun = $bunIdentity
    node = $nodeIdentity
    dependency_versions = $dependencyVersions
    electron_builder_cli = [ordered]@{
      path = $builderCliPath
      sha256 = Get-FileSha256 $builderCliPath
    }
    seven_zip = [ordered]@{
      path = $sevenZipPath
      sha256 = Get-FileSha256 $sevenZipPath
    }
    app_builder = [ordered]@{
      path = $appBuilderPath
      sha256 = Get-FileSha256 $appBuilderPath
    }
    overrides_absent = $true
    environment = [ordered]@{
      CI = Get-EnvironmentEvidence 'CI'
      OPL_ELECTRON_BUILDER_CLI = Get-EnvironmentEvidence 'OPL_ELECTRON_BUILDER_CLI'
      OPL_WINDOWS_WSL2_ELECTRON_DIST =
        Get-EnvironmentEvidence 'OPL_WINDOWS_WSL2_ELECTRON_DIST'
      USE_SYSTEM_7ZA = Get-EnvironmentEvidence 'USE_SYSTEM_7ZA'
      ELECTRON_BUILDER_COMPRESSION_LEVEL =
        Get-EnvironmentEvidence 'ELECTRON_BUILDER_COMPRESSION_LEVEL'
      ELECTRON_MIRROR = Get-EnvironmentEvidence 'ELECTRON_MIRROR'
      ELECTRON_CACHE = Get-EnvironmentEvidence 'ELECTRON_CACHE'
      HTTP_PROXY = Get-EnvironmentEvidence 'HTTP_PROXY'
      HTTPS_PROXY = Get-EnvironmentEvidence 'HTTPS_PROXY'
      NO_PROXY = Get-EnvironmentEvidence 'NO_PROXY'
      timezone_id = [TimeZoneInfo]::Local.Id
      culture_name = [System.Globalization.CultureInfo]::CurrentCulture.Name
    }
  }
  commands = @($commands)
  artifact = [ordered]@{
    file_name = [System.IO.Path]::GetFileName($sealedZipPath)
    sha256 = $artifact.zip_sha256
    size_bytes = $artifact.zip_size_bytes
    executable_sha256 = $artifact.executable_sha256
    app_asar_sha256 = $artifact.app_asar_sha256
    zip_entry_manifest_sha256 = $artifact.entry_manifest_sha256
    tree_sha256 = $artifact.tree.sha256
    tree_file_count = $artifact.tree.file_count
  }
  error = $null
}
$json = $receipt | ConvertTo-Json -Depth 12
[System.IO.File]::WriteAllText(
  $receiptPath,
  $json,
  [System.Text.UTF8Encoding]::new($false)
)
Write-Output $receiptPath

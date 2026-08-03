[CmdletBinding()]
param(
    [ValidateSet('Preflight', 'DryRun')]
    [string]$Mode = 'Preflight',

    [Parameter(Mandatory)]
    [string]$CandidateDirectory,

    [Parameter(Mandatory)]
    [ValidatePattern('^[0-9]+\.[0-9]+\.[0-9]+(?:[-+][0-9A-Za-z.-]+)?$')]
    [string]$CandidateDisplayVersion,

    [Parameter(Mandatory)]
    [ValidatePattern('^[0-9]+\.[0-9]+\.[0-9]+(?:-[0-9A-Za-z.-]+)?$')]
    [string]$CandidateUpdaterVersion,

    [Parameter(Mandatory)]
    [ValidatePattern('^[0-9a-f]{64}$')]
    [string]$ExpectedUpdaterAssetsReceiptSha256,

    [Parameter(Mandatory)]
    [ValidatePattern('^[0-9a-f]{64}$')]
    [string]$ExpectedAuthenticodeReceiptSha256,

    [Parameter(Mandatory)]
    [ValidatePattern('^[0-9a-f]{64}$')]
    [string]$ExpectedCompatibilityReceiptSha256,

    [Parameter(Mandatory)]
    [ValidatePattern('^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')]
    [string]$ExpectedExecutionOwnerThread,

    [string]$PlatformLeasePath = 'C:\OPL-VMs\Leases\OPL-V6-WSL2-01.lease.json',
    [string]$CleanAttestationPath = 'C:\OPL-VMs\Guests\OPL-V6-WSL2-01\Evidence\clean-vm-attestation.json',
    [string]$OutputPath = '.\opl-windows-updater-upgrade-vm-dry-run.json',
    [switch]$FixtureMode
)

$ErrorActionPreference = 'Stop'
$canonicalRoot = 'C:\OPL-VMs'
$vmName = 'OPL-V6-WSL2-01'

function Get-LowerSha256 {
    param([Parameter(Mandatory)][string]$LiteralPath)
    $stream = [IO.File]::OpenRead($LiteralPath)
    try {
        $sha256 = [Security.Cryptography.SHA256]::Create()
        try {
            return ([BitConverter]::ToString($sha256.ComputeHash($stream))).Replace('-', '').ToLowerInvariant()
        } finally {
            $sha256.Dispose()
        }
    } finally {
        $stream.Dispose()
    }
}

function Read-JsonFile {
    param(
        [Parameter(Mandatory)][string]$LiteralPath,
        [Parameter(Mandatory)][string]$Label
    )
    $item = Get-Item -LiteralPath $LiteralPath -ErrorAction Stop
    if (-not $item.PSIsContainer -and $item.Length -gt 0) {
        return Get-Content -LiteralPath $LiteralPath -Raw | ConvertFrom-Json
    }
    throw "$Label must be one non-empty regular file: $LiteralPath"
}

function Assert-ExactDigest {
    param(
        [Parameter(Mandatory)][string]$LiteralPath,
        [Parameter(Mandatory)][string]$Expected,
        [Parameter(Mandatory)][string]$Label
    )
    $actual = Get-LowerSha256 -LiteralPath $LiteralPath
    if ($actual -cne $Expected) {
        throw "$Label digest drifted: expected $Expected, observed $actual."
    }
    return $actual
}

if ($FixtureMode -and $Mode -ne 'DryRun') {
    throw 'FixtureMode is accepted only for DryRun and never authorizes live host work.'
}

$CandidateDirectory = [IO.Path]::GetFullPath($CandidateDirectory).TrimEnd('\')
$PlatformLeasePath = [IO.Path]::GetFullPath($PlatformLeasePath)
$CleanAttestationPath = [IO.Path]::GetFullPath($CleanAttestationPath)
$OutputPath = [IO.Path]::GetFullPath($OutputPath)

$installerName = "One-Person-Lab-$CandidateDisplayVersion-win-x64.exe"
$installerPath = Join-Path $CandidateDirectory $installerName
$blockmapPath = "$installerPath.blockmap"
$metadataPath = Join-Path $CandidateDirectory 'latest.yml'
$assetsReceiptPath = Join-Path $CandidateDirectory 'opl-windows-updater-assets.json'
$authenticodeReceiptPath = Join-Path $CandidateDirectory 'opl-windows-authenticode-receipt.json'
$compatibilityReceiptPath = Join-Path $CandidateDirectory 'opl-component-compatibility-receipt.json'

foreach ($requiredPath in @(
    $installerPath,
    $blockmapPath,
    $metadataPath,
    $assetsReceiptPath,
    $authenticodeReceiptPath,
    $compatibilityReceiptPath,
    $PlatformLeasePath,
    $CleanAttestationPath
)) {
    $item = Get-Item -LiteralPath $requiredPath -ErrorAction Stop
    if ($item.PSIsContainer -or $item.Length -le 0) {
        throw "Windows upgrade VM input must be one non-empty regular file: $requiredPath"
    }
}

$assetsReceiptSha256 = Assert-ExactDigest -LiteralPath $assetsReceiptPath -Expected $ExpectedUpdaterAssetsReceiptSha256 -Label 'Updater assets receipt'
$authenticodeReceiptSha256 = Assert-ExactDigest -LiteralPath $authenticodeReceiptPath -Expected $ExpectedAuthenticodeReceiptSha256 -Label 'Authenticode receipt'
$compatibilityReceiptSha256 = Assert-ExactDigest -LiteralPath $compatibilityReceiptPath -Expected $ExpectedCompatibilityReceiptSha256 -Label 'Framework compatibility receipt'
$installerSha256 = Get-LowerSha256 -LiteralPath $installerPath
$installerSize = (Get-Item -LiteralPath $installerPath).Length
$blockmapSha256 = Get-LowerSha256 -LiteralPath $blockmapPath
$blockmapSize = (Get-Item -LiteralPath $blockmapPath).Length
$metadataSha256 = Get-LowerSha256 -LiteralPath $metadataPath
$metadataSize = (Get-Item -LiteralPath $metadataPath).Length

$assetsReceipt = Read-JsonFile -LiteralPath $assetsReceiptPath -Label 'Updater assets receipt'
$authenticodeReceipt = Read-JsonFile -LiteralPath $authenticodeReceiptPath -Label 'Authenticode receipt'
$compatibilityReceipt = Read-JsonFile -LiteralPath $compatibilityReceiptPath -Label 'Framework compatibility receipt'
$platformLease = Read-JsonFile -LiteralPath $PlatformLeasePath -Label 'Platform lease'
$attestation = Read-JsonFile -LiteralPath $CleanAttestationPath -Label 'Clean VM attestation'

if (
    $assetsReceipt.schema -ne 'opl_windows_updater_assets_receipt.v1' -or
    $assetsReceipt.status -ne 'passed' -or
    $assetsReceipt.platform -ne 'windows-x64' -or
    $assetsReceipt.release_version -ne $CandidateDisplayVersion -or
    $assetsReceipt.updater_version -ne $CandidateUpdaterVersion -or
    $assetsReceipt.assets.installer.name -ne $installerName -or
    [int64]$assetsReceipt.assets.installer.size_bytes -ne $installerSize -or
    ([string]$assetsReceipt.assets.installer.sha256).Replace('sha256:', '') -cne $installerSha256 -or
    $assetsReceipt.assets.metadata.name -ne 'latest.yml' -or
    [int64]$assetsReceipt.assets.metadata.size_bytes -ne $metadataSize -or
    ([string]$assetsReceipt.assets.metadata.sha256).Replace('sha256:', '') -cne $metadataSha256 -or
    $assetsReceipt.assets.blockmap.name -ne "$installerName.blockmap" -or
    [int64]$assetsReceipt.assets.blockmap.size_bytes -ne $blockmapSize -or
    ([string]$assetsReceipt.assets.blockmap.sha256).Replace('sha256:', '') -cne $blockmapSha256 -or
    $assetsReceipt.metadata_binding.path -ne $installerName -or
    $assetsReceipt.metadata_binding.file_url -ne $installerName -or
    [int64]$assetsReceipt.metadata_binding.size_bytes -ne $installerSize -or
    $assetsReceipt.metadata_binding.sha512 -ne $assetsReceipt.assets.installer.sha512 -or
    $assetsReceipt.code_signing.policy -ne 'optional_nonblocking' -or
    $assetsReceipt.code_signing.status -ne 'valid_timestamped_authenticode' -or
    $assetsReceipt.code_signing.authenticode_receipt -ne 'opl-windows-authenticode-receipt.json' -or
    $assetsReceipt.code_signing.required_for_publication -ne $false
) {
    throw 'Updater assets receipt does not bind the exact Windows candidate EXE, blockmap, latest.yml, and optional signed certification.'
}
if (
    $authenticodeReceipt.schema -ne 'opl_windows_authenticode_receipt.v1' -or
    $authenticodeReceipt.status -ne 'passed' -or
    $authenticodeReceipt.platform -ne 'windows-x64' -or
    $authenticodeReceipt.installer.name -ne $installerName -or
    [int64]$authenticodeReceipt.installer.size_bytes -ne $installerSize -or
    ([string]$authenticodeReceipt.installer.sha256).Replace('sha256:', '') -cne $installerSha256 -or
    $authenticodeReceipt.signature.status -ne 'Valid' -or
    $authenticodeReceipt.signature.signature_type -ne 'Authenticode' -or
    $authenticodeReceipt.signature.timestamp_verified -ne $true
) {
    throw 'Authenticode receipt does not bind one valid timestamped signature to the exact installer.'
}
$compatibilityIssuedAt = [DateTimeOffset]::Parse([string]$compatibilityReceipt.issued_at).ToUniversalTime()
$compatibilityGeneratedAt = [DateTimeOffset]::Parse([string]$compatibilityReceipt.generated_at).ToUniversalTime()
$compatibilityExpiresAt = [DateTimeOffset]::Parse([string]$compatibilityReceipt.expires_at).ToUniversalTime()
$compatibilityNow = [DateTimeOffset]::UtcNow
$selectedArtifact = $compatibilityReceipt.subject.selected_app_artifact
$requirementIds = @($compatibilityReceipt.requirements | ForEach-Object { [string]$_.requirement_id })
$coverageIds = @($compatibilityReceipt.coverage | ForEach-Object { [string]$_.requirement_id })
if (
    $compatibilityReceipt.schema -ne 'opl_component_compatibility_receipt.v1' -or
    $compatibilityReceipt.owner -ne 'one-person-lab' -or
    $compatibilityReceipt.producer_role -ne 'opl_framework' -or
    $compatibilityReceipt.status -ne 'compatible' -or
    @($compatibilityReceipt.requirements).Count -lt 1 -or
    @($compatibilityReceipt.observed_components).Count -lt 1 -or
    @($compatibilityReceipt.coverage).Count -ne @($compatibilityReceipt.requirements).Count -or
    @($compatibilityReceipt.coverage | Where-Object status -ne 'satisfied').Count -ne 0 -or
    @($compatibilityReceipt.failures).Count -ne 0 -or
    @($requirementIds | Sort-Object -Unique).Count -ne $requirementIds.Count -or
    @($coverageIds | Sort-Object -Unique).Count -ne $coverageIds.Count -or
    @(Compare-Object -ReferenceObject $requirementIds -DifferenceObject $coverageIds).Count -ne 0 -or
    @($compatibilityReceipt.requirements | Where-Object {
        $_.kind -notin @('capability_id_with_versioned_schema', 'minimum_version', 'semver_range')
    }).Count -ne 0 -or
    $compatibilityGeneratedAt -ne $compatibilityIssuedAt -or
    $compatibilityIssuedAt -gt $compatibilityNow -or
    $compatibilityExpiresAt -le $compatibilityNow -or
    ($compatibilityExpiresAt - $compatibilityIssuedAt).TotalSeconds -gt 300 -or
    $selectedArtifact.owner_authority -ne 'gaofeng21cn/one-person-lab-app' -or
    [string]::IsNullOrWhiteSpace([string]$selectedArtifact.immutable_release_tag) -or
    [string]::IsNullOrWhiteSpace([string]$selectedArtifact.asset_url) -or
    $selectedArtifact.asset_name -ne $installerName -or
    [int64]$selectedArtifact.byte_size -ne $installerSize -or
    ([string]$selectedArtifact.sha256).Replace('sha256:', '') -cne $installerSha256 -or
    $compatibilityReceipt.authority_boundary.compatibility_only -ne $true -or
    $compatibilityReceipt.authority_boundary.selected_artifact_binding_is_subject_evidence_only -ne $true -or
    $compatibilityReceipt.authority_boundary.may_require_exact_cross_component_version_or_sha -ne $false -or
    $compatibilityReceipt.authority_boundary.may_require_same_cohort -ne $false -or
    $compatibilityReceipt.authority_boundary.may_define_package_currentness -ne $false -or
    $compatibilityReceipt.authority_boundary.may_claim_release_ready -ne $false -or
    $compatibilityReceipt.authority_boundary.may_claim_install_ready -ne $false
) {
    throw 'Framework compatibility receipt is stale, incomplete, over-authoritative, or not bound to the exact candidate.'
}

$attestationSha256 = Get-LowerSha256 -LiteralPath $CleanAttestationPath
$expectedAttestationPath = [IO.Path]::GetFullPath([string]$platformLease.clean_vm_attestation.path)
if (
    $platformLease.schema -ne 'opl_windows_vm_lease.v2' -or
    $platformLease.status -ne 'active' -or
    $platformLease.factory_root -ne $canonicalRoot -or
    $platformLease.vm_name -ne $vmName -or
    $platformLease.execution_owner_thread -ne $ExpectedExecutionOwnerThread -or
    $platformLease.next_owner_thread -ne $ExpectedExecutionOwnerThread -or
    $platformLease.lease_authorized -ne $true -or
    [int]$platformLease.writable_surface_overlap_count -ne 0 -or
    $platformLease.clean_vm_attestation.schema -ne 'opl_windows_clean_vm_attestation.v2' -or
    ([string]$platformLease.clean_vm_attestation.sha256).Replace('sha256:', '') -cne $attestationSha256 -or
    (-not $FixtureMode -and -not $expectedAttestationPath.Equals($CleanAttestationPath, [StringComparison]::OrdinalIgnoreCase))
) {
    throw 'Platform lease does not authorize the exact Windows qualification owner and clean attestation.'
}
if (
    $attestation.schema -ne 'opl_windows_clean_vm_attestation.v2' -or
    $attestation.status -ne 'attested' -or
    $attestation.factory_root -ne $canonicalRoot -or
    $attestation.vm_name -ne $vmName -or
    $attestation.vm_state -ne 'Off' -or
    $attestation.vm_id -ne $platformLease.vm_uuid -or
    $attestation.vm_identity -ne $platformLease.clean_vm_attestation.vm_identity -or
    $attestation.checkpoint_id -ne $platformLease.clean_vm_attestation.checkpoint_id -or
    $attestation.checkpoint_name -ne $platformLease.clean_vm_attestation.checkpoint_name -or
    $attestation.checkpoint_name -notlike 'OPL-Clean-Windows-zh-CN-*' -or
    $attestation.localization.ui_language -ne 'zh-CN' -or
    $attestation.localization.default_input_method_tip -ne '0804:00000804'
) {
    throw 'Clean VM attestation does not match the leased powered-off VM and exact checkpoint.'
}

$liveVm = $null
if (-not $FixtureMode) {
    $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($identity)
    if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
        throw 'Windows upgrade VM preflight requires an elevated PowerShell process for read-only Hyper-V identity checks.'
    }
    Import-Module Hyper-V -ErrorAction Stop
    $vm = Get-VM -Name $vmName -ErrorAction Stop
    $checkpoint = Get-VMSnapshot -VMName $vmName | Where-Object {
        ([string]$_.Id).ToLowerInvariant() -eq ([string]$attestation.checkpoint_id).ToLowerInvariant()
    } | Select-Object -First 1
    $disk = Get-VMHardDiskDrive -VMName $vmName | Select-Object -First 1
    if (
        [string]$vm.State -ne 'Off' -or
        ([string]$vm.VMId).ToLowerInvariant() -ne ([string]$attestation.vm_id).ToLowerInvariant() -or
        -not $checkpoint -or
        $checkpoint.Name -ne $attestation.checkpoint_name -or
        [string]$disk.Path -ne [string]$attestation.active_vhdx_path
    ) {
        throw 'Live Hyper-V VM identity, powered-off state, checkpoint, or VHDX drifted from the lease.'
    }
    $signature = Get-AuthenticodeSignature -LiteralPath $installerPath
    if (
        [string]$signature.Status -ne 'Valid' -or
        -not $signature.SignerCertificate -or
        -not $signature.TimeStamperCertificate -or
        ([string]$signature.SignerCertificate.Thumbprint).ToLowerInvariant() -ne ([string]$authenticodeReceipt.signature.signer_thumbprint).ToLowerInvariant() -or
        ([string]$signature.TimeStamperCertificate.Thumbprint).ToLowerInvariant() -ne ([string]$authenticodeReceipt.signature.timestamper_thumbprint).ToLowerInvariant()
    ) {
        throw 'Live Get-AuthenticodeSignature readback does not match the frozen timestamp receipt.'
    }
    $liveVm = [ordered]@{
        state = [string]$vm.State
        vm_id = ([string]$vm.VMId).ToLowerInvariant()
        checkpoint_id = ([string]$checkpoint.Id).ToLowerInvariant()
        checkpoint_name = [string]$checkpoint.Name
        active_vhdx_path = [string]$disk.Path
    }
}

$sequence = @(
    'validate_exact_signed_candidate',
    'validate_framework_compatibility_receipt',
    'validate_active_factory_lease_and_clean_attestation',
    'restore_exact_clean_checkpoint',
    'install_exact_predecessor',
    'write_persistent_data_sentinel',
    'start_predecessor_with_exact_candidate_feed',
    'download_candidate_with_electron_updater',
    'fully_exit_and_apply_update',
    'restart_updated_app',
    'verify_version_runtime_and_data_preservation',
    'repeat_update_check_expect_no_update',
    'write_terminal_receipt',
    'graceful_shutdown_and_owner_readback'
)

$receipt = [ordered]@{
    schema = 'opl_windows_updater_upgrade_vm_dry_run_receipt.v1'
    status = if ($Mode -eq 'DryRun') { 'dry_run_passed' } else { 'preflight_passed' }
    mode = $Mode.ToLowerInvariant()
    observed_at = (Get-Date).ToUniversalTime().ToString('o')
    mutation_attempt_count = 0
    publication_mutation_allowed = $false
    install_mutation_allowed = $false
    release_blocking = $false
    fixture_mode = [bool]$FixtureMode
    candidate = [ordered]@{
        display_version = $CandidateDisplayVersion
        updater_version = $CandidateUpdaterVersion
        installer_name = $installerName
        installer_size_bytes = $installerSize
        installer_sha256 = "sha256:$installerSha256"
        updater_assets_receipt_sha256 = "sha256:$assetsReceiptSha256"
        authenticode_receipt_sha256 = "sha256:$authenticodeReceiptSha256"
        compatibility_receipt_sha256 = "sha256:$compatibilityReceiptSha256"
        timestamp_verified = $true
    }
    factory = [ordered]@{
        root = $canonicalRoot
        vm_name = $vmName
        execution_owner_thread = $ExpectedExecutionOwnerThread
        vm_uuid = [string]$platformLease.vm_uuid
        checkpoint_id = [string]$attestation.checkpoint_id
        checkpoint_name = [string]$attestation.checkpoint_name
        lease_sha256 = "sha256:$(Get-LowerSha256 -LiteralPath $PlatformLeasePath)"
        clean_attestation_sha256 = "sha256:$attestationSha256"
        live_readback = $liveVm
    }
    ordered_upgrade_sequence = $sequence
    execute_available = $false
    execute_blockers = @(
        'separate_protected_execute_authority',
        'dpapi_protected_guest_credential_bound_to_runner_identity',
        'fixed_windows_electron_updater_guest_driver',
        'fresh_clean_checkpoint_restore_operation'
    )
    next_action = 'Use these exact inputs only in a separate protected execute operation after every blocker is satisfied.'
}

$outputDirectory = Split-Path -Parent $OutputPath
if ($outputDirectory -and -not (Test-Path -LiteralPath $outputDirectory)) {
    New-Item -ItemType Directory -Path $outputDirectory -Force | Out-Null
}
$temporaryPath = "$OutputPath.$PID.tmp"
if (Test-Path -LiteralPath $OutputPath) {
    throw "Dry-run receipt output already exists and will not be overwritten: $OutputPath"
}
$receipt | ConvertTo-Json -Depth 12 | Set-Content -LiteralPath $temporaryPath -Encoding UTF8
Move-Item -LiteralPath $temporaryPath -Destination $OutputPath
$receipt | ConvertTo-Json -Depth 12

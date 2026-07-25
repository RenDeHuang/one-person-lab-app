[CmdletBinding()]
param(
    [Parameter(Mandatory)]
    [ValidateSet('OPL-V6-WSL2-01', 'OPL-WEBUI-CLEAN-01')]
    [string]$Name,

    [Parameter(Mandatory)]
    [ValidatePattern('^[0-9a-f]{40}$')]
    [string]$AppAcceptanceSha,

    [Parameter(Mandatory)]
    [ValidatePattern('^[0-9a-f]{40}$')]
    [string]$DeliveryCommit,

    [Parameter(Mandatory)]
    [ValidatePattern('^[0-9a-f]{64}$')]
    [string]$IntakeManifestSha256,

    [Parameter(Mandatory)]
    [ValidatePattern('^[0-9a-f]{64}$')]
    [string]$PostResizeGateReceiptSha256,

    [Parameter(Mandatory)]
    [ValidatePattern('^[0-9a-f]{64}$')]
    [string]$StorageProbeReceiptSha256,

    [string]$Root = 'C:\OPL-VMs'
)

$ErrorActionPreference = 'Stop'
$canonicalRoot = 'C:\OPL-VMs'
$resolvedRoot = [IO.Path]::GetFullPath($Root).TrimEnd('\')
if (-not $resolvedRoot.Equals($canonicalRoot, [StringComparison]::OrdinalIgnoreCase)) {
    throw "Windows VM requests must target the canonical factory root: $canonicalRoot"
}
if (-not (Test-Path -LiteralPath $resolvedRoot -PathType Container)) {
    throw "Factory root is missing: $resolvedRoot"
}

$leasesRoot = Join-Path $resolvedRoot 'Leases'
$requestPath = Join-Path $leasesRoot "$Name.request.json"
if (Test-Path -LiteralPath $requestPath) {
    throw "Create-once VM request already exists: $requestPath"
}

$postResizeReceiptPath = Join-Path $resolvedRoot 'Evidence\post-resize-gate-factory-ready.json'
$storageProbeReceiptPath = Join-Path $resolvedRoot 'Evidence\hyperv-storage-compatibility-receipt.json'
foreach ($inputPath in @($postResizeReceiptPath, $storageProbeReceiptPath)) {
    if (-not (Test-Path -LiteralPath $inputPath -PathType Leaf)) {
        throw "Required factory receipt is missing: $inputPath"
    }
}
if ((Get-FileHash -Algorithm SHA256 -LiteralPath $postResizeReceiptPath).Hash.ToLowerInvariant() -ne $PostResizeGateReceiptSha256) {
    throw 'Post-resize factory gate receipt SHA256 mismatch.'
}
if ((Get-FileHash -Algorithm SHA256 -LiteralPath $storageProbeReceiptPath).Hash.ToLowerInvariant() -ne $StorageProbeReceiptSha256) {
    throw 'Storage probe receipt SHA256 mismatch.'
}

$isV6 = $Name -eq 'OPL-V6-WSL2-01'
$executionOwner = if ($isV6) {
    '019f97e4-288a-7140-8850-925c657d8c71'
} else {
    '019f972b-f550-7961-90be-9873600cd895'
}
$guestRoot = Join-Path $resolvedRoot "Guests\$Name"
$evidenceRoot = Join-Path $guestRoot 'Evidence'
$subnetIndex = if ($isV6) { 102 } else { 101 }
$portLease = if ($isV6) { '33101-33119' } else { '33001-33019' }
$requestedAt = (Get-Date).ToUniversalTime()

$request = [ordered]@{
    schema = 'opl_windows_vm_lease_request.v2'
    status = 'prepared_factory_ready'
    factory_root = $canonicalRoot
    lease_id = if ($isV6) { 'opl-v6-wsl2-01' } else { 'opl-webui-clean-01' }
    vm_name = $Name
    execution_owner_thread = $executionOwner
    source_contract = [ordered]@{
        app_acceptance_sha = $AppAcceptanceSha
        delivery_commit = $DeliveryCommit
        intake_manifest_sha256 = $IntakeManifestSha256
        post_resize_gate_receipt_sha256 = $PostResizeGateReceiptSha256
    }
    guest_localization = [ordered]@{
        installation_media_language = 'zh-CN'
        ui_language = 'zh-CN'
        system_locale = 'zh-CN'
        user_locale = 'zh-CN'
        default_input_method_tip = '0804:00000804'
    }
    lease_transition = [ordered]@{
        previous_owner_thread = $null
        next_owner_thread = $executionOwner
        request_receipt_id = [guid]::NewGuid().ToString().ToLowerInvariant()
        requested_at = $requestedAt.ToString('o')
    }
    shared_read_only_inputs = @(
        (Join-Path $resolvedRoot 'ISO'),
        (Join-Path $resolvedRoot 'Base')
    )
    exclusive_paths = [ordered]@{
        guest = $guestRoot
        config = Join-Path $guestRoot 'Virtual Machines'
        evidence = $evidenceRoot
        vhdx = Join-Path $guestRoot "Virtual Hard Disks\$Name.vhdx"
    }
    capacity = [ordered]@{
        processor_count = 4
        startup_memory_bytes = [int64]8GB
        minimum_memory_bytes = [int64]4GB
        maximum_memory_bytes = [int64]16GB
        dynamic_memory = $true
        vhdx_max_bytes = [int64]128GB
        nested_virtualization = $true
    }
    network = [ordered]@{
        temporary_oobe_switch = 'Default Switch'
        isolated_switch = "OPL-NAT-$Name"
        nat_name = "OPL-NAT-$Name"
        subnet = "172.28.$subnetIndex.0/24"
        host_gateway = "172.28.$subnetIndex.1"
        guest_ip = "172.28.$subnetIndex.10"
        prefix_length = 24
        inbound_nat_mappings = 0
        host_loopback_port_lease = $portLease
    }
    runtime_namespace = $Name
    receipt_namespace = $evidenceRoot
    storage_compatibility = [ordered]@{
        drive = 'C:'
        filesystem = 'NTFS'
        minimum_free_bytes = [int64]30GB
        probe_receipt_sha256 = $StorageProbeReceiptSha256
    }
    writable_surface_overlap_count = 0
    lease_authorized = $false
}

[void][IO.Directory]::CreateDirectory($leasesRoot)
$request | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $requestPath -Encoding utf8
$requestSha256 = (Get-FileHash -Algorithm SHA256 -LiteralPath $requestPath).Hash.ToLowerInvariant()
[ordered]@{
    schema = 'opl_windows_vm_request_create_receipt.v1'
    status = 'passed'
    request_path = $requestPath
    request_sha256 = $requestSha256
    factory_root = $canonicalRoot
    vm_name = $Name
    execution_owner_thread = $executionOwner
    created_at = (Get-Date).ToUniversalTime().ToString('o')
} | ConvertTo-Json -Depth 5

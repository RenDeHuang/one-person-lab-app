[CmdletBinding()]
param(
    [Parameter(Mandatory)]
    [string]$PacketRoot,

    [Parameter(Mandatory)]
    [ValidatePattern('^[0-9a-f]{64}$')]
    [string]$ExpectedRequestSha256,

    [Parameter(Mandatory)]
    [ValidatePattern('^[0-9a-f]{40}$')]
    [string]$ExpectedDeliveryCommit,

    [Parameter(Mandatory)]
    [ValidatePattern('^[0-9a-f]{40}$')]
    [string]$ExpectedDeliveryTree,

    [Parameter(Mandatory)]
    [ValidatePattern('^[0-9a-f]{40}$')]
    [string]$ExpectedFrozenAcceptance,

    [Parameter(Mandatory)]
    [ValidatePattern('^[0-9a-f]{40}$')]
    [string]$ExpectedAcceptanceTree,

    [Parameter(Mandatory)]
    [ValidatePattern('^[0-9a-f]{64}$')]
    [string]$ExpectedManifestSha256,

    [string]$Root = 'C:\OPL-VMs',

    [ValidateRange(1, 24)]
    [int]$ValidityHours = 8
)

$ErrorActionPreference = 'Stop'
$canonicalRoot = 'C:\OPL-VMs'
$Root = [IO.Path]::GetFullPath($Root).TrimEnd('\')
if (-not $Root.Equals($canonicalRoot, [StringComparison]::OrdinalIgnoreCase)) {
    throw "V6 writer lease must target the canonical factory root: $canonicalRoot"
}
$expectedPacketRoot = Join-Path $Root "Packets\$ExpectedFrozenAcceptance"
$PacketRoot = [IO.Path]::GetFullPath($PacketRoot).TrimEnd('\')
if (-not $PacketRoot.Equals($expectedPacketRoot, [StringComparison]::OrdinalIgnoreCase)) {
    throw "V6 packet root must match the frozen acceptance identity: $expectedPacketRoot"
}

$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = [Security.Principal.WindowsPrincipal]::new($identity)
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    throw 'Grant-OPLV6WriterLease.ps1 must run from an elevated PowerShell process.'
}

$name = 'OPL-V6-WSL2-01'
$sourceCustodianTaskId = '019f9bc5-8707-78b2-b221-5453d9d9b855'
$expectedGuestRoot = Join-Path $Root 'Guests\OPL-V6-WSL2-01'
$expectedConfigRoot = Join-Path $expectedGuestRoot 'Virtual Machines'
$expectedEvidenceRoot = Join-Path $expectedGuestRoot 'Evidence'
$expectedVhdxPath = Join-Path $expectedGuestRoot 'Virtual Hard Disks\OPL-V6-WSL2-01.vhdx'
$expectedSwitchName = 'OPL-NAT-OPL-V6-WSL2-01'
$requestPath = Join-Path $Root 'Leases\OPL-V6-WSL2-01.request.json'
$platformLeasePath = Join-Path $Root 'Leases\OPL-V6-WSL2-01.lease.json'
$evidenceRoot = Join-Path $Root 'Guests\OPL-V6-WSL2-01\Evidence'
$attestationPath = Join-Path $evidenceRoot 'clean-vm-attestation.json'
$vmCreatePath = Join-Path $evidenceRoot 'vm-create-receipt.json'
$networkReceiptPath = Join-Path $evidenceRoot 'isolated-network-receipt.json'
$manifestPath = Join-Path $PacketRoot 'windows-wsl2-v6-intake-manifest.json'
$schemaPath = Join-Path $PacketRoot 'windows-wsl2-v6-writer-lease.schema.json'
$getVmReceiptPath = Join-Path $evidenceRoot 'get-vm-writer-lease-readback.json'
$writerLeasePath = Join-Path $Root 'Leases\OPL-V6-WSL2-01.writer-lease.json'
$terminalReceiptPath = Join-Path $Root 'Leases\OPL-V6-WSL2-01.writer-lease-receipt.json'

foreach ($path in @(
    $requestPath,
    $platformLeasePath,
    $attestationPath,
    $vmCreatePath,
    $networkReceiptPath,
    $manifestPath,
    $schemaPath
)) {
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
        throw "Required V6 writer lease input is missing: $path"
    }
}
foreach ($path in @($getVmReceiptPath, $writerLeasePath, $terminalReceiptPath)) {
    if (Test-Path -LiteralPath $path) {
        throw "Create-once V6 writer lease output already exists: $path"
    }
}

$requestSha256 = (Get-FileHash -Algorithm SHA256 -LiteralPath $requestPath).Hash.ToLowerInvariant()
if ($requestSha256 -ne $ExpectedRequestSha256) {
    throw 'V6 request bytes do not match the fresh platform authority.'
}
$manifestSha256 = (Get-FileHash -Algorithm SHA256 -LiteralPath $manifestPath).Hash.ToLowerInvariant()
if ($manifestSha256 -ne $ExpectedManifestSha256) {
    throw 'V6 intake manifest SHA256 does not match the fresh immutable packet.'
}

$request = Get-Content -LiteralPath $requestPath -Raw | ConvertFrom-Json
$manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
$platformLease = Get-Content -LiteralPath $platformLeasePath -Raw | ConvertFrom-Json
$attestation = Get-Content -LiteralPath $attestationPath -Raw | ConvertFrom-Json
$platformOwnerTaskId = [string]$request.platform_owner_task_id
$executorTaskId = [string]$request.execution_owner_thread
if (
    $request.schema -ne 'opl_windows_vm_lease_request.v2' -or
    $request.status -ne 'prepared_factory_ready' -or
    $request.factory_root -ne $canonicalRoot -or
    $request.vm_name -ne $name -or
    $platformOwnerTaskId -notmatch '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' -or
    $platformOwnerTaskId -eq $sourceCustodianTaskId -or
    $executorTaskId -notmatch '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' -or
    $executorTaskId -eq $sourceCustodianTaskId -or
    $executorTaskId -eq $platformOwnerTaskId -or
    $request.execution_owner_thread -ne $executorTaskId -or
    $request.lease_transition.next_owner_thread -ne $executorTaskId -or
    $request.lease_id -ne 'opl-v6-wsl2-01' -or
    $request.source_contract.app_acceptance_sha -ne $ExpectedFrozenAcceptance -or
    $request.source_contract.delivery_commit -ne $ExpectedDeliveryCommit -or
    $request.source_contract.intake_manifest_sha256 -ne $ExpectedManifestSha256 -or
    -not ([IO.Path]::GetFullPath([string]$request.exclusive_paths.guest).TrimEnd('\')).Equals($expectedGuestRoot, [StringComparison]::OrdinalIgnoreCase) -or
    -not ([IO.Path]::GetFullPath([string]$request.exclusive_paths.config).TrimEnd('\')).Equals($expectedConfigRoot, [StringComparison]::OrdinalIgnoreCase) -or
    -not ([IO.Path]::GetFullPath([string]$request.exclusive_paths.evidence).TrimEnd('\')).Equals($expectedEvidenceRoot, [StringComparison]::OrdinalIgnoreCase) -or
    -not ([IO.Path]::GetFullPath([string]$request.exclusive_paths.vhdx)).Equals($expectedVhdxPath, [StringComparison]::OrdinalIgnoreCase) -or
    $request.network.isolated_switch -ne $expectedSwitchName -or
    $request.network.nat_name -ne $expectedSwitchName -or
    $request.network.subnet -ne '172.28.102.0/24' -or
    $request.network.guest_ip -ne '172.28.102.10' -or
    $request.network.host_loopback_port_lease -ne '33101-33119'
) {
    throw 'V6 request is outside the fresh C-root source contract.'
}
if (
    $manifest.schema -ne 'opl_windows_wsl2_v6_intake_manifest.v1' -or
    $manifest.source_refs.app_acceptance_sha -ne $ExpectedFrozenAcceptance -or
    $manifest.source_refs.app_acceptance_tree_sha -ne $ExpectedAcceptanceTree -or
    $manifest.target.factory_root -ne $canonicalRoot -or
    $manifest.target.vm_name -ne $name -or
    $manifest.target.host_platform -ne 'windows_hyperv' -or
    $manifest.target.clean_vm_required -ne $true -or
    $manifest.authority_bindings.source_custodian_task_id -ne $sourceCustodianTaskId -or
    $manifest.authority_bindings.platform_owner_task_id -ne $platformOwnerTaskId -or
    $manifest.authority_bindings.executor_task_id -ne $executorTaskId
) {
    throw 'V6 intake manifest is outside the fresh Windows platform contract.'
}
foreach ($entry in @($manifest.packet_files)) {
    $payloadPath = Join-Path $PacketRoot ([string]$entry.file_name)
    if (-not (Test-Path -LiteralPath $payloadPath -PathType Leaf)) {
        throw "V6 packet payload is missing: $($entry.file_name)"
    }
    $payload = Get-Item -LiteralPath $payloadPath
    $payloadSha256 = (Get-FileHash -Algorithm SHA256 -LiteralPath $payloadPath).Hash.ToLowerInvariant()
    if ($payload.Length -ne [int64]$entry.size_bytes -or $payloadSha256 -ne [string]$entry.sha256) {
        throw "V6 packet payload identity mismatch: $($entry.file_name)"
    }
}
if (
    $platformLease.schema -ne 'opl_windows_vm_lease.v2' -or
    $platformLease.status -ne 'active' -or
    $platformLease.factory_root -ne $canonicalRoot -or
    $platformLease.vm_name -ne $name -or
    $platformLease.platform_owner_task_id -ne $platformOwnerTaskId -or
    $platformLease.execution_owner_thread -ne $executorTaskId -or
    $platformLease.next_owner_thread -ne $executorTaskId -or
    $platformLease.lease_id -ne 'opl-v6-wsl2-01' -or
    $platformLease.request_sha256 -ne $ExpectedRequestSha256 -or
    $platformLease.source_contract.delivery_commit -ne $ExpectedDeliveryCommit -or
    $platformLease.source_contract.app_acceptance_sha -ne $ExpectedFrozenAcceptance -or
    $platformLease.source_contract.intake_manifest_sha256 -ne $ExpectedManifestSha256 -or
    -not ([IO.Path]::GetFullPath([string]$platformLease.config_path).TrimEnd('\')).Equals($expectedConfigRoot, [StringComparison]::OrdinalIgnoreCase) -or
    -not ([IO.Path]::GetFullPath([string]$platformLease.active_vhdx_path)).StartsWith($expectedGuestRoot.TrimEnd('\') + '\', [StringComparison]::OrdinalIgnoreCase) -or
    -not ([IO.Path]::GetFullPath([string]$platformLease.exclusive_paths.guest).TrimEnd('\')).Equals($expectedGuestRoot, [StringComparison]::OrdinalIgnoreCase) -or
    -not ([IO.Path]::GetFullPath([string]$platformLease.exclusive_paths.config).TrimEnd('\')).Equals($expectedConfigRoot, [StringComparison]::OrdinalIgnoreCase) -or
    -not ([IO.Path]::GetFullPath([string]$platformLease.exclusive_paths.evidence).TrimEnd('\')).Equals($expectedEvidenceRoot, [StringComparison]::OrdinalIgnoreCase) -or
    -not ([IO.Path]::GetFullPath([string]$platformLease.exclusive_paths.vhdx)).Equals($expectedVhdxPath, [StringComparison]::OrdinalIgnoreCase) -or
    $platformLease.network.current_switch -ne $expectedSwitchName -or
    $platformLease.network.nat_name -ne $expectedSwitchName -or
    $platformLease.network.subnet -ne '172.28.102.0/24' -or
    $platformLease.network.guest_ip -ne '172.28.102.10' -or
    $platformLease.network.host_loopback_port_lease -ne '33101-33119' -or
    $platformLease.writable_surface_overlap_count -ne 0 -or
    $platformLease.lease_authorized -ne $true
) {
    throw 'Platform VM lease does not match the fresh V6 identity and executor.'
}
$attestationSha256 = (Get-FileHash -Algorithm SHA256 -LiteralPath $attestationPath).Hash.ToLowerInvariant()
if (
    $attestation.schema -ne 'opl_windows_clean_vm_attestation.v2' -or
    $attestation.status -ne 'attested' -or
    $attestation.factory_root -ne $canonicalRoot -or
    $attestation.vm_name -ne $name -or
    $platformLease.clean_vm_attestation.sha256 -ne $attestationSha256 -or
    $platformLease.clean_vm_attestation.path -ne $attestationPath
) {
    throw 'Clean VM attestation does not match the current platform lease.'
}

Import-Module Hyper-V -ErrorAction Stop
$vm = Get-VM -Name $name -ErrorAction Stop
if ([string]$vm.State -ne 'Off') {
    throw 'V6 VM must be powered off before issuing its writer lease.'
}
$vmId = ([string]$vm.VMId).ToLowerInvariant()
$vmIdentity = "hyperv-vmid:$vmId"
$configPath = if ($vm.PSObject.Properties.Name -contains 'ConfigurationLocation') { [string]$vm.ConfigurationLocation } else { [string]$vm.Path }
$disk = Get-VMHardDiskDrive -VMName $name | Select-Object -First 1
$networkAdapter = Get-VMNetworkAdapter -VMName $name | Select-Object -First 1
$checkpoint = Get-VMSnapshot -VMName $name | Where-Object {
    ([string]$_.Id).ToLowerInvariant() -eq ([string]$attestation.checkpoint_id).ToLowerInvariant()
} | Select-Object -First 1
if (
    $platformLease.vm_uuid -ne $vmId -or
    $attestation.vm_id -ne $vmId -or
    $attestation.vm_identity -ne $vmIdentity -or
    $platformLease.config_path -ne $configPath -or
    $platformLease.active_vhdx_path -ne [string]$disk.Path -or
    $attestation.config_path -ne $configPath -or
    $attestation.active_vhdx_path -ne [string]$disk.Path -or
    -not $checkpoint -or
    $checkpoint.Name -ne [string]$attestation.checkpoint_name -or
    $checkpoint.Name -notlike 'OPL-Clean-Windows-zh-CN-*'
) {
    throw 'Powered-off Hyper-V identity does not match the platform lease and clean attestation.'
}
if (
    ($platformLease.vhdx_chain | ConvertTo-Json -Depth 8 -Compress) -ne
        ($attestation.vhdx_chain | ConvertTo-Json -Depth 8 -Compress)
) {
    throw 'Platform lease and clean attestation VHDX chains differ.'
}
$network = [ordered]@{
    switch_name = [string]$platformLease.network.current_switch
    switch_id = ([string]$platformLease.network.switch_id).ToLowerInvariant()
    nat_name = [string]$platformLease.network.nat_name
    nat_id = [string]$platformLease.network.nat_id
    subnet = [string]$platformLease.network.subnet
    guest_ip = [string]$platformLease.network.guest_ip
    static_mac_address = [string]$platformLease.network.static_mac_address
    host_loopback_port_lease = [string]$platformLease.network.host_loopback_port_lease
    inbound_nat_mappings = [int]$platformLease.network.inbound_nat_mappings
    writable_surface_overlap_count = [int]$platformLease.writable_surface_overlap_count
}
if (
    $networkAdapter.SwitchName -ne $network.switch_name -or
    $networkAdapter.MacAddress -ne $network.static_mac_address -or
    ($network | ConvertTo-Json -Depth 8 -Compress) -ne
        ($attestation.network | ConvertTo-Json -Depth 8 -Compress)
) {
    throw 'Live V6 network identity does not match the platform lease and clean attestation.'
}

$observedAt = (Get-Date).ToUniversalTime()
$getVmReceipt = [ordered]@{
    schema = 'opl_windows_v6_get_vm_readback.v1'
    status = 'passed'
    observed_at = $observedAt.ToString('o')
    factory_root = $canonicalRoot
    vm_name = $name
    vm_id = $vmId
    vm_identity = $vmIdentity
    state = [string]$vm.State
    config_path = $configPath
    active_vhdx_path = [string]$disk.Path
    vhdx_chain = @($platformLease.vhdx_chain)
    checkpoint_id = ([string]$checkpoint.Id).ToLowerInvariant()
    checkpoint_name = [string]$checkpoint.Name
    localization = $request.guest_localization
    network = $network
}
$getVmJson = $getVmReceipt | ConvertTo-Json -Depth 12
[IO.File]::WriteAllText($getVmReceiptPath, "$getVmJson`n", [Text.UTF8Encoding]::new($false))
$getVmReceiptSha256 = (Get-FileHash -Algorithm SHA256 -LiteralPath $getVmReceiptPath).Hash.ToLowerInvariant()

$issuedAt = (Get-Date).ToUniversalTime()
$expiresAt = $issuedAt.AddHours($ValidityHours)
$writerLease = [ordered]@{
    schema = 'opl_windows_v6_vm_writer_lease.v2'
    status = 'active'
    host_platform = 'windows_hyperv'
    factory_root = $canonicalRoot
    vm_name = $name
    vm_identity = $vmIdentity
    platform_owner_task_id = $platformOwnerTaskId
    executor_task_id = $executorTaskId
    lease_id = "opl-v6-$($issuedAt.ToString('yyyyMMddTHHmmssZ'))-$($vmId.Substring(0, 8))"
    issued_at = $issuedAt.ToString('o')
    expires_at = $expiresAt.ToString('o')
    request = [ordered]@{
        path = $requestPath
        sha256 = $requestSha256
        schema = [string]$request.schema
        factory_root = [string]$request.factory_root
    }
    packet = [ordered]@{
        root = $PacketRoot
        delivery_commit = $ExpectedDeliveryCommit
        delivery_tree = $ExpectedDeliveryTree
        frozen_acceptance = $ExpectedFrozenAcceptance
        acceptance_tree = $ExpectedAcceptanceTree
        manifest_sha256 = $manifestSha256
        payload_count = @($manifest.packet_files).Count
    }
    vm_paths = [ordered]@{
        config_path = $configPath
        active_vhdx_path = [string]$disk.Path
        vhdx_chain = @($platformLease.vhdx_chain)
        evidence_root = $evidenceRoot
        receipt_namespace = [string]$platformLease.receipt_namespace
        get_vm_receipt_path = $getVmReceiptPath
        get_vm_receipt_sha256 = $getVmReceiptSha256
    }
    localization = $request.guest_localization
    network = $network
    allowed_operations = @(
        'v6_build_seal',
        'v6_fixture_phase_transition',
        'v6_guest_visible_smoke',
        'v6_soft_shutdown'
    )
    clean_vm_attestation = [ordered]@{
        status = 'attested'
        vm_id = $vmId
        vm_identity = $vmIdentity
        vm_state = 'Off'
        config_path = $configPath
        active_vhdx_path = [string]$disk.Path
        vhdx_chain = @($platformLease.vhdx_chain)
        checkpoint_id = ([string]$checkpoint.Id).ToLowerInvariant()
        checkpoint_name = [string]$checkpoint.Name
        localization = $request.guest_localization
        network = $network
        clean_user_receipt_path = [string]$attestation.clean_user_receipt_path
        clean_user_receipt_sha256 = [string]$attestation.clean_user_receipt_sha256
        attestation_path = $attestationPath
        attestation_sha256 = $attestationSha256
        attested_at = ([datetime]$attestation.attested_at).ToUniversalTime().ToString('o')
    }
}
$writerLeaseJson = $writerLease | ConvertTo-Json -Depth 14
[IO.File]::WriteAllText($writerLeasePath, "$writerLeaseJson`n", [Text.UTF8Encoding]::new($false))
$writerLeaseSha256 = (Get-FileHash -Algorithm SHA256 -LiteralPath $writerLeasePath).Hash.ToLowerInvariant()

$terminalReceipt = [ordered]@{
    schema = 'opl_windows_v6_writer_lease_terminal_receipt.v2'
    status = 'passed'
    observed_at = (Get-Date).ToUniversalTime().ToString('o')
    platform_owner_task_id = $platformOwnerTaskId
    executor_task_id = $executorTaskId
    delivery_commit = $ExpectedDeliveryCommit
    delivery_tree = $ExpectedDeliveryTree
    frozen_acceptance = $ExpectedFrozenAcceptance
    acceptance_tree = $ExpectedAcceptanceTree
    intake_manifest_sha256 = $manifestSha256
    payload_count = @($manifest.packet_files).Count
    request_sha256 = $requestSha256
    platform_lease_sha256 = (Get-FileHash -Algorithm SHA256 -LiteralPath $platformLeasePath).Hash.ToLowerInvariant()
    clean_vm_attestation_sha256 = $attestationSha256
    vm_create_receipt_sha256 = (Get-FileHash -Algorithm SHA256 -LiteralPath $vmCreatePath).Hash.ToLowerInvariant()
    network_receipt_sha256 = (Get-FileHash -Algorithm SHA256 -LiteralPath $networkReceiptPath).Hash.ToLowerInvariant()
    get_vm_receipt_sha256 = $getVmReceiptSha256
    writer_lease_path = $writerLeasePath
    writer_lease_sha256 = $writerLeaseSha256
    lease_id = $writerLease.lease_id
    vm_identity = $writerLease.vm_identity
    clean_checkpoint_id = $writerLease.clean_vm_attestation.checkpoint_id
    issued_at = $writerLease.issued_at
    expires_at = $writerLease.expires_at
    allowed_operations = $writerLease.allowed_operations
    vm_power_state = [string]$vm.State
    writable_surface_overlap_count = $platformLease.writable_surface_overlap_count
    webui_runtime_authority = 0
}
$terminalJson = $terminalReceipt | ConvertTo-Json -Depth 10
[IO.File]::WriteAllText($terminalReceiptPath, "$terminalJson`n", [Text.UTF8Encoding]::new($false))
$terminalReceipt | ConvertTo-Json -Depth 10

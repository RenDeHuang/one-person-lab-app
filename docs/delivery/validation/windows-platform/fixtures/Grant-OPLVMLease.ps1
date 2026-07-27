[CmdletBinding()]
param(
    [Parameter(Mandatory)]
    [ValidateSet('OPL-WEBUI-CLEAN-01', 'OPL-V6-WSL2-01')]
    [string]$Name,
    [string]$Root = 'C:\OPL-VMs'
)

$ErrorActionPreference = 'Stop'
$canonicalRoot = 'C:\OPL-VMs'
$Root = [IO.Path]::GetFullPath($Root).TrimEnd('\')
if (-not $Root.Equals($canonicalRoot, [StringComparison]::OrdinalIgnoreCase)) {
    throw "Platform lease grant must target the canonical factory root: $canonicalRoot"
}
$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = [Security.Principal.WindowsPrincipal]::new($identity)
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    throw 'Grant-OPLVMLease.ps1 must run from an elevated PowerShell process.'
}

Import-Module Hyper-V -ErrorAction Stop
$requestPath = Join-Path $Root "Leases\$Name.request.json"
$postResizePath = Join-Path $Root 'Evidence\post-resize-gate-factory-ready.json'
$storageProbePath = Join-Path $Root 'Evidence\hyperv-storage-compatibility-receipt.json'
if (-not (Test-Path -LiteralPath $requestPath -PathType Leaf)) {
    throw "Required lease input is missing: $requestPath"
}
$request = Get-Content -LiteralPath $requestPath -Raw | ConvertFrom-Json
if (
    $request.schema -ne 'opl_windows_vm_lease_request.v2' -or
    $request.status -ne 'prepared_factory_ready' -or
    $request.factory_root -ne $canonicalRoot -or
    $request.vm_name -ne $Name -or
    $request.lease_authorized -ne $false -or
    $request.execution_owner_thread -ne $request.lease_transition.next_owner_thread
) {
    throw 'Platform lease request is outside the current C-root contract.'
}
$isV6 = $Name -eq 'OPL-V6-WSL2-01'
$sourceCustodianTaskId = '019f9bc5-8707-78b2-b221-5453d9d9b855'
$platformOwnerTaskId = [string]$request.platform_owner_task_id
if (
    $platformOwnerTaskId -notmatch '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' -or
    $platformOwnerTaskId -eq $sourceCustodianTaskId
) {
    throw 'Platform lease requires a distinct activated native-Windows owner task ID.'
}
$expectedOwner = if ($isV6) { [string]$request.execution_owner_thread } else { $platformOwnerTaskId }
if ($isV6 -and $expectedOwner -eq $sourceCustodianTaskId) {
    throw 'The V6 executor task must be distinct from the source custodian.'
}
if ($isV6 -and $expectedOwner -eq $platformOwnerTaskId) {
    throw 'The V6 executor task must be distinct from the native-Windows platform owner.'
}
$expectedLeaseId = if ($isV6) { 'opl-v6-wsl2-01' } else { 'opl-webui-clean-01' }
$expectedGuestPath = Join-Path $Root "Guests\$Name"
$expectedConfigPath = Join-Path $expectedGuestPath 'Virtual Machines'
$expectedEvidencePath = Join-Path $expectedGuestPath 'Evidence'
$expectedVhdPath = Join-Path $expectedGuestPath "Virtual Hard Disks\$Name.vhdx"
$expectedSwitchName = "OPL-NAT-$Name"
$expectedSubnet = if ($isV6) { '172.28.102.0/24' } else { '172.28.101.0/24' }
$expectedGuestIp = if ($isV6) { '172.28.102.10' } else { '172.28.101.10' }
$expectedPortLease = if ($isV6) { '33101-33119' } else { '33001-33019' }
if (
    $request.lease_id -ne $expectedLeaseId -or
    $request.execution_owner_thread -ne $expectedOwner -or
    $request.lease_transition.next_owner_thread -ne $expectedOwner -or
    -not ([IO.Path]::GetFullPath([string]$request.exclusive_paths.guest).TrimEnd('\')).Equals($expectedGuestPath, [StringComparison]::OrdinalIgnoreCase) -or
    -not ([IO.Path]::GetFullPath([string]$request.exclusive_paths.config).TrimEnd('\')).Equals($expectedConfigPath, [StringComparison]::OrdinalIgnoreCase) -or
    -not ([IO.Path]::GetFullPath([string]$request.exclusive_paths.evidence).TrimEnd('\')).Equals($expectedEvidencePath, [StringComparison]::OrdinalIgnoreCase) -or
    -not ([IO.Path]::GetFullPath([string]$request.exclusive_paths.vhdx)).Equals($expectedVhdPath, [StringComparison]::OrdinalIgnoreCase) -or
    $request.network.isolated_switch -ne $expectedSwitchName -or
    $request.network.nat_name -ne $expectedSwitchName -or
    $request.network.subnet -ne $expectedSubnet -or
    $request.network.guest_ip -ne $expectedGuestIp -or
    $request.network.host_loopback_port_lease -ne $expectedPortLease
) {
    throw 'Platform lease request paths, owner, or network do not match the exact target VM namespace.'
}
$evidenceRoot = [IO.Path]::GetFullPath([string]$request.exclusive_paths.evidence)
$vmCreatePath = Join-Path $evidenceRoot 'vm-create-receipt.json'
$networkReceiptPath = Join-Path $evidenceRoot 'isolated-network-receipt.json'
$attestationPath = Join-Path $evidenceRoot 'clean-vm-attestation.json'
foreach ($path in @($postResizePath, $storageProbePath, $vmCreatePath, $networkReceiptPath, $attestationPath)) {
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
        throw "Required lease input is missing: $path"
    }
}
$postResize = Get-Content -LiteralPath $postResizePath -Raw | ConvertFrom-Json
$storageProbe = Get-Content -LiteralPath $storageProbePath -Raw | ConvertFrom-Json
$vmCreate = Get-Content -LiteralPath $vmCreatePath -Raw | ConvertFrom-Json
$networkReceipt = Get-Content -LiteralPath $networkReceiptPath -Raw | ConvertFrom-Json
$attestation = Get-Content -LiteralPath $attestationPath -Raw | ConvertFrom-Json
if (
    $postResize.status -ne 'passed' -or
    $postResize.factory_root -ne $canonicalRoot -or
    $storageProbe.status -ne 'passed' -or
    $storageProbe.factory_root -ne $canonicalRoot -or
    $vmCreate.status -ne 'passed' -or
    $vmCreate.name -ne $Name -or
    $networkReceipt.status -ne 'passed' -or
    $networkReceipt.vm_name -ne $Name -or
    $attestation.status -ne 'attested' -or
    $attestation.vm_name -ne $Name
) {
    throw 'Post-resize, storage, VM create, isolated network and clean baseline receipts must all pass.'
}
if ((Get-FileHash -Algorithm SHA256 -LiteralPath $postResizePath).Hash.ToLowerInvariant() -ne $request.source_contract.post_resize_gate_receipt_sha256) {
    throw 'Post-resize receipt does not match the current request.'
}
if ((Get-FileHash -Algorithm SHA256 -LiteralPath $storageProbePath).Hash.ToLowerInvariant() -ne $request.storage_compatibility.probe_receipt_sha256) {
    throw 'Storage probe receipt does not match the current request.'
}
if ($vmCreate.storage_compatibility.live_vm_create_checkpoint_gate -ne 'passed') {
    throw 'Live VM create/checkpoint compatibility gate has not passed.'
}
if ($vmCreate.storage_compatibility.filesystem -ne $request.storage_compatibility.filesystem) {
    throw 'Live VM create receipt filesystem does not match the lease request.'
}
if (
    $null -eq $request.guest_localization -or
    $null -eq $vmCreate.guest_localization_policy -or
    $vmCreate.guest_localization_policy.installation_media_language -ne $request.guest_localization.installation_media_language -or
    $vmCreate.guest_localization_policy.ui_language -ne $request.guest_localization.ui_language -or
    $vmCreate.guest_localization_policy.system_locale -ne $request.guest_localization.system_locale -or
    $vmCreate.guest_localization_policy.user_locale -ne $request.guest_localization.user_locale -or
    $vmCreate.guest_localization_policy.default_input_method_tip -ne $request.guest_localization.default_input_method_tip
) {
    throw 'VM create receipt localization policy does not match the current lease request.'
}
$requestSha256 = (Get-FileHash -Algorithm SHA256 -LiteralPath $requestPath).Hash.ToLowerInvariant()
if ($requestSha256 -ne $vmCreate.request_sha256) {
    throw 'VM create receipt is not bound to the current lease request bytes.'
}
$vm = Get-VM -Name $Name -ErrorAction Stop
$network = Get-VMNetworkAdapter -VMName $Name | Select-Object -First 1
$processor = Get-VMProcessor -VMName $Name
$memory = Get-VMMemory -VMName $Name
$security = Get-VMSecurity -VMName $Name
$disk = Get-VMHardDiskDrive -VMName $Name | Select-Object -First 1
$checkpoint = Get-VMSnapshot -VMName $Name | Where-Object {
    ([string]$_.Id).ToLowerInvariant() -eq ([string]$attestation.checkpoint_id).ToLowerInvariant()
} | Select-Object -First 1
$checkpoints = @(Get-VMSnapshot -VMName $Name | Sort-Object CreationTime | ForEach-Object {
    [ordered]@{ id = ([string]$_.Id).ToLowerInvariant(); name = $_.Name; created_at = $_.CreationTime.ToUniversalTime().ToString('o') }
})
$switch = Get-VMSwitch -Name ([string]$request.network.isolated_switch) -ErrorAction Stop
$nat = Get-NetNat -Name ([string]$request.network.nat_name) -ErrorAction Stop
if (
    ([string]$vmCreate.vm_id).ToLowerInvariant() -ne ([string]$vm.VMId).ToLowerInvariant() -or
    ([string]$networkReceipt.vm_uuid).ToLowerInvariant() -ne ([string]$vm.VMId).ToLowerInvariant() -or
    ([string]$attestation.vm_id).ToLowerInvariant() -ne ([string]$vm.VMId).ToLowerInvariant() -or
    $attestation.schema -ne 'opl_windows_clean_vm_attestation.v2' -or
    $attestation.factory_root -ne $canonicalRoot -or
    $attestation.vm_identity -ne "hyperv-vmid:$(([string]$vm.VMId).ToLowerInvariant())"
) {
    throw 'VM create or network receipt belongs to a different VM identity.'
}

$configPath = if ($vm.PSObject.Properties.Name -contains 'ConfigurationLocation') { [string]$vm.ConfigurationLocation } else { [string]$vm.Path }
if (-not ([IO.Path]::GetFullPath($configPath).TrimEnd('\')).Equals($expectedConfigPath, [StringComparison]::OrdinalIgnoreCase)) {
    throw "VM configuration path does not match its exact requested config root: $configPath"
}
if (-not [IO.Path]::GetFullPath([string]$disk.Path).StartsWith($expectedGuestPath.TrimEnd('\') + '\', [StringComparison]::OrdinalIgnoreCase)) {
    throw "Active disk path does not match its exclusive lease path: $($disk.Path)"
}
if ($processor.Count -ne [int]$request.capacity.processor_count -or -not $processor.ExposeVirtualizationExtensions) {
    throw 'VM processor capacity or nested virtualization does not match the request.'
}
if ($memory.Startup -ne [int64]$request.capacity.startup_memory_bytes -or -not $memory.DynamicMemoryEnabled) {
    throw 'VM memory capacity does not match the request.'
}
if (-not $security.SecureBootEnabled -or -not $security.TpmEnabled -or $vm.AutomaticCheckpointsEnabled) {
    throw 'VM security or checkpoint policy does not match the request.'
}
if (-not $checkpoint -or $checkpoint.Name -ne [string]$attestation.checkpoint_name -or $checkpoint.Name -notlike 'OPL-Clean-Windows-zh-CN-*') {
    throw 'The exact clean zh-CN baseline checkpoint is required before lease grant.'
}
if ([string]$vm.State -ne 'Off') {
    throw 'VM must be powered off before a writer lease can be granted.'
}
if ($network.DynamicMacAddressEnabled -or [string]::IsNullOrWhiteSpace($network.MacAddress)) {
    throw 'A static VM MAC address is required before lease grant.'
}
if ($network.SwitchName -ne $switch.Name -or $networkReceipt.switch_id -ne [string]$switch.Id) {
    throw 'VM isolated switch identity does not match the network receipt.'
}
$natId = if ($nat.PSObject.Properties.Name -contains 'InstanceID') { [string]$nat.InstanceID } else { "$($nat.Name)|$($nat.InternalIPInterfaceAddressPrefix)" }
$attestationSha256 = (Get-FileHash -Algorithm SHA256 -LiteralPath $attestationPath).Hash.ToLowerInvariant()
if (
    $attestation.active_vhdx_path -ne [string]$disk.Path -or
    $attestation.config_path -ne $configPath -or
    $attestation.localization.installation_media_language -ne 'zh-CN' -or
    $attestation.localization.ui_language -ne 'zh-CN' -or
    $attestation.localization.system_locale -ne 'zh-CN' -or
    $attestation.localization.user_locale -ne 'zh-CN' -or
    $attestation.localization.default_input_method_tip -ne '0804:00000804' -or
    $attestation.network.switch_id -ne ([string]$switch.Id).ToLowerInvariant() -or
    $attestation.network.nat_id -ne $natId -or
    $attestation.network.static_mac_address -ne [string]$network.MacAddress -or
    $attestation.network.writable_surface_overlap_count -ne 0
) {
    throw 'Clean VM attestation does not match live disk, localization, or isolated network identity.'
}
if ($networkReceipt.nat_id -ne $natId -or $nat.InternalIPInterfaceAddressPrefix -ne $request.network.subnet) {
    throw 'VM NAT identity or subnet does not match the request and network receipt.'
}

$otherName = if ($Name -eq 'OPL-WEBUI-CLEAN-01') { 'OPL-V6-WSL2-01' } else { 'OPL-WEBUI-CLEAN-01' }
$otherRequest = Get-Content -LiteralPath (Join-Path $Root "Leases\$otherName.request.json") -Raw | ConvertFrom-Json
$pathOverlap = @($request.exclusive_paths.psobject.Properties.Value | Where-Object { $otherRequest.exclusive_paths.psobject.Properties.Value -contains $_ })
$runtimeNamespaceOverlap = @(@($request.runtime_namespace, $request.receipt_namespace) | Where-Object { @($otherRequest.runtime_namespace, $otherRequest.receipt_namespace) -contains $_ })
$networkOverlap = @(
    if ($request.network.isolated_switch -eq $otherRequest.network.isolated_switch) { 'switch' }
    if ($request.network.nat_name -eq $otherRequest.network.nat_name) { 'nat' }
    if ($request.network.subnet -eq $otherRequest.network.subnet) { 'subnet' }
    if ($request.network.guest_ip -eq $otherRequest.network.guest_ip) { 'guest_ip' }
    if ($request.network.host_loopback_port_lease -eq $otherRequest.network.host_loopback_port_lease) { 'ports' }
)
$writableSurfaceOverlapCount = $pathOverlap.Count + $runtimeNamespaceOverlap.Count + $networkOverlap.Count
if ($writableSurfaceOverlapCount -ne 0) {
    throw "Writable/runtime/network surfaces overlap with $otherName."
}

$vhdxChain = @()
$nextVhdPath = [string]$disk.Path
while (-not [string]::IsNullOrWhiteSpace($nextVhdPath)) {
    if (-not $nextVhdPath.StartsWith($expectedGuestPath, [StringComparison]::OrdinalIgnoreCase)) {
        throw "VHDX chain escapes the exclusive guest path: $nextVhdPath"
    }
    $vhd = Get-VHD -Path $nextVhdPath
    $parentPath = if ([string]::IsNullOrWhiteSpace([string]$vhd.ParentPath)) { $null } else { [string]$vhd.ParentPath }
    $vhdxChain += [ordered]@{
        path = [string]$vhd.Path
        parent_path = $parentPath
        vhd_type = [string]$vhd.VhdType
        file_size_bytes = [int64]$vhd.FileSize
        maximum_size_bytes = [int64]$vhd.Size
    }
    $nextVhdPath = $parentPath
}
if (@($vhdxChain | Where-Object { $_.path -eq $expectedVhdPath }).Count -ne 1) {
    throw 'VHDX chain does not contain the exact requested base VHDX.'
}
if (($vhdxChain | ConvertTo-Json -Depth 8 -Compress) -ne (@($attestation.vhdx_chain) | ConvertTo-Json -Depth 8 -Compress)) {
    throw 'Live VHDX chain does not match the clean VM attestation.'
}

$receiptId = [guid]::NewGuid().ToString().ToLowerInvariant()
$grantedAt = (Get-Date).ToUniversalTime().ToString('o')
$leaseReceiptPath = Join-Path $Root "Leases\$Name.lease-receipt.json"
$leasePath = Join-Path $Root "Leases\$Name.lease.json"
foreach ($outputPath in @($leasePath, $leaseReceiptPath)) {
    if (Test-Path -LiteralPath $outputPath) {
        throw "Create-once platform lease output already exists: $outputPath"
    }
}
$lease = [ordered]@{
    schema = 'opl_windows_vm_lease.v2'
    status = 'active'
    factory_root = $canonicalRoot
    receipt_id = $receiptId
    granted_at = $grantedAt
    released_at = $null
    lease_id = $request.lease_id
    vm_name = $Name
    platform_owner_task_id = $platformOwnerTaskId
    execution_owner_thread = $request.execution_owner_thread
    previous_owner_thread = $request.lease_transition.previous_owner_thread
    next_owner_thread = $request.lease_transition.next_owner_thread
    source_contract = $request.source_contract
    generation = $vm.Generation
    vm_uuid = ([string]$vm.VMId).ToLowerInvariant()
    config_path = $configPath
    active_vhdx_path = $disk.Path
    vhdx_chain = $vhdxChain
    checkpoint_chain = $checkpoints
    network = [ordered]@{
        current_switch = $network.SwitchName
        switch_id = ([string]$switch.Id).ToLowerInvariant()
        nat_name = $nat.Name
        nat_id = $natId
        subnet = $request.network.subnet
        guest_ip = $request.network.guest_ip
        host_loopback_port_lease = $request.network.host_loopback_port_lease
        static_mac_address = $network.MacAddress
        inbound_nat_mappings = [int]$networkReceipt.inbound_host_port_mappings
    }
    guest_localization = $request.guest_localization
    exclusive_paths = $request.exclusive_paths
    runtime_namespace = $request.runtime_namespace
    receipt_namespace = $request.receipt_namespace
    clean_vm_attestation = [ordered]@{
        path = $attestationPath
        sha256 = $attestationSha256
        schema = [string]$attestation.schema
        vm_identity = [string]$attestation.vm_identity
        checkpoint_id = ([string]$attestation.checkpoint_id).ToLowerInvariant()
        checkpoint_name = [string]$attestation.checkpoint_name
        clean_user_receipt_sha256 = [string]$attestation.clean_user_receipt_sha256
    }
    request_sha256 = $requestSha256
    post_resize_gate_receipt_sha256 = $request.source_contract.post_resize_gate_receipt_sha256
    storage_probe_receipt_sha256 = $request.storage_compatibility.probe_receipt_sha256
    vm_create_receipt_sha256 = (Get-FileHash -Algorithm SHA256 -LiteralPath $vmCreatePath).Hash.ToLowerInvariant()
    network_receipt_sha256 = (Get-FileHash -Algorithm SHA256 -LiteralPath $networkReceiptPath).Hash.ToLowerInvariant()
    writable_surface_overlap_count = $writableSurfaceOverlapCount
    lease_authorized = $true
}
$leaseJson = $lease | ConvertTo-Json -Depth 12
[IO.File]::WriteAllText($leasePath, "$leaseJson`n", [Text.UTF8Encoding]::new($false))
$leaseSha256 = (Get-FileHash -Algorithm SHA256 -LiteralPath $leasePath).Hash.ToLowerInvariant()
$leaseReceipt = [ordered]@{
    schema = 'opl_windows_vm_lease_terminal_receipt.v1'
    status = 'passed'
    receipt_id = $receiptId
    vm_name = $Name
    previous_owner_thread = $request.lease_transition.previous_owner_thread
    next_owner_thread = $request.lease_transition.next_owner_thread
    granted_at = $grantedAt
    released_at = $null
    request_path = $requestPath
    request_sha256 = $requestSha256
    lease_path = $leasePath
    lease_sha256 = $leaseSha256
    powered_off = ([string]$vm.State -eq 'Off')
    writable_surface_overlap_count = $writableSurfaceOverlapCount
}
$leaseReceiptJson = $leaseReceipt | ConvertTo-Json -Depth 8
[IO.File]::WriteAllText($leaseReceiptPath, "$leaseReceiptJson`n", [Text.UTF8Encoding]::new($false))
$lease | ConvertTo-Json -Depth 10

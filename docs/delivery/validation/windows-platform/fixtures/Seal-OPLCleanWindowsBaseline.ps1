[CmdletBinding(SupportsShouldProcess)]
param(
    [Parameter(Mandatory)]
    [ValidateSet('OPL-V6-WSL2-01', 'OPL-WEBUI-CLEAN-01')]
    [string]$Name,

    [Parameter(Mandatory)]
    [string]$GuestBaselineReceiptPath,

    [string]$Root = 'C:\OPL-VMs'
)

$ErrorActionPreference = 'Stop'
$canonicalRoot = 'C:\OPL-VMs'
$Root = [IO.Path]::GetFullPath($Root).TrimEnd('\')
if (-not $Root.Equals($canonicalRoot, [StringComparison]::OrdinalIgnoreCase)) {
    throw "Clean baseline sealing must target the canonical factory root: $canonicalRoot"
}
$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = [Security.Principal.WindowsPrincipal]::new($identity)
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    throw 'Seal-OPLCleanWindowsBaseline.ps1 must run from an elevated PowerShell process.'
}

Import-Module Hyper-V -ErrorAction Stop
$requestPath = Join-Path $Root "Leases\$Name.request.json"
if (-not (Test-Path -LiteralPath $requestPath -PathType Leaf)) {
    throw "VM lease request not found: $requestPath"
}
if (-not (Test-Path -LiteralPath $GuestBaselineReceiptPath -PathType Leaf)) {
    throw "Guest baseline receipt not found: $GuestBaselineReceiptPath"
}
$request = Get-Content -LiteralPath $requestPath -Raw | ConvertFrom-Json
if (
    $request.schema -ne 'opl_windows_vm_lease_request.v2' -or
    $request.status -ne 'prepared_factory_ready' -or
    $request.factory_root -ne $canonicalRoot -or
    $request.vm_name -ne $Name
) {
    throw 'Clean baseline request is outside the current C-root factory contract.'
}
$isV6 = $Name -eq 'OPL-V6-WSL2-01'
$expectedGuestRoot = Join-Path $Root "Guests\$Name"
$expectedConfigRoot = Join-Path $expectedGuestRoot 'Virtual Machines'
$expectedEvidenceRoot = Join-Path $expectedGuestRoot 'Evidence'
$expectedVhdxPath = Join-Path $expectedGuestRoot "Virtual Hard Disks\$Name.vhdx"
$expectedSwitchName = "OPL-NAT-$Name"
$expectedSubnet = if ($isV6) { '172.28.102.0/24' } else { '172.28.101.0/24' }
$expectedGuestIp = if ($isV6) { '172.28.102.10' } else { '172.28.101.10' }
$expectedPortLease = if ($isV6) { '33101-33119' } else { '33001-33019' }
if (
    -not ([IO.Path]::GetFullPath([string]$request.exclusive_paths.guest).TrimEnd('\')).Equals($expectedGuestRoot, [StringComparison]::OrdinalIgnoreCase) -or
    -not ([IO.Path]::GetFullPath([string]$request.exclusive_paths.config).TrimEnd('\')).Equals($expectedConfigRoot, [StringComparison]::OrdinalIgnoreCase) -or
    -not ([IO.Path]::GetFullPath([string]$request.exclusive_paths.evidence).TrimEnd('\')).Equals($expectedEvidenceRoot, [StringComparison]::OrdinalIgnoreCase) -or
    -not ([IO.Path]::GetFullPath([string]$request.exclusive_paths.vhdx)).Equals($expectedVhdxPath, [StringComparison]::OrdinalIgnoreCase) -or
    $request.network.isolated_switch -ne $expectedSwitchName -or
    $request.network.nat_name -ne $expectedSwitchName -or
    $request.network.subnet -ne $expectedSubnet -or
    $request.network.guest_ip -ne $expectedGuestIp -or
    $request.network.host_loopback_port_lease -ne $expectedPortLease
) {
    throw 'Clean baseline request paths or network do not match the exact target VM namespace.'
}
$expectedEvidenceRoot = [IO.Path]::GetFullPath([string]$request.exclusive_paths.evidence).TrimEnd('\')
$resolvedGuestBaselineReceiptPath = [IO.Path]::GetFullPath((Resolve-Path -LiteralPath $GuestBaselineReceiptPath).Path)
if (-not $resolvedGuestBaselineReceiptPath.StartsWith($expectedEvidenceRoot + '\', [StringComparison]::OrdinalIgnoreCase)) {
    throw 'Clean user receipt must be exported into the exact VM evidence namespace.'
}
$baseline = Get-Content -LiteralPath $GuestBaselineReceiptPath -Raw | ConvertFrom-Json
if (
    $baseline.schema -ne 'opl_clean_windows_user_baseline.v1' -or
    $baseline.status -ne 'passed' -or
    $baseline.user.preexisting_opl_evidence -ne $false -or
    $baseline.windows.installation_media_language -ne 'zh-CN' -or
    $baseline.windows.ui_language -ne 'zh-CN' -or
    $baseline.windows.system_locale -ne 'zh-CN' -or
    $baseline.windows.user_locale -ne 'zh-CN' -or
    $baseline.windows.primary_user_language -ne 'zh-CN' -or
    @($baseline.windows.input_method_tips) -notcontains '0804:00000804'
) {
    throw 'Guest baseline receipt does not prove a fresh Simplified Chinese Windows user baseline.'
}

$vm = Get-VM -Name $Name -ErrorAction Stop
if ([string]$vm.State -ne 'Off') {
    throw 'VM must be powered off before sealing the clean Windows baseline.'
}
$disk = Get-VMHardDiskDrive -VMName $Name | Select-Object -First 1
if (-not $disk -or -not $disk.Path.StartsWith([string]$request.exclusive_paths.guest, [StringComparison]::OrdinalIgnoreCase)) {
    throw 'VM active disk does not match the exclusive request path.'
}
$configPath = if ($vm.PSObject.Properties.Name -contains 'ConfigurationLocation') { [string]$vm.ConfigurationLocation } else { [string]$vm.Path }
if (-not [IO.Path]::GetFullPath($configPath).StartsWith([IO.Path]::GetFullPath([string]$request.exclusive_paths.config), [StringComparison]::OrdinalIgnoreCase)) {
    throw 'VM configuration path does not match the clean baseline request.'
}
$networkReceiptPath = Join-Path $expectedEvidenceRoot 'isolated-network-receipt.json'
if (-not (Test-Path -LiteralPath $networkReceiptPath -PathType Leaf)) {
    throw "Isolated network receipt is missing: $networkReceiptPath"
}
$networkReceipt = Get-Content -Raw -LiteralPath $networkReceiptPath | ConvertFrom-Json
$networkAdapter = Get-VMNetworkAdapter -VMName $Name | Select-Object -First 1
if (
    $networkReceipt.status -ne 'passed' -or
    ([string]$networkReceipt.vm_uuid).ToLowerInvariant() -ne ([string]$vm.VMId).ToLowerInvariant() -or
    $networkReceipt.switch_name -ne $request.network.isolated_switch -or
    $networkReceipt.nat_name -ne $request.network.nat_name -or
    $networkReceipt.subnet -ne $request.network.subnet -or
    $networkReceipt.guest_ip -ne $request.network.guest_ip -or
    $networkReceipt.host_loopback_port_lease -ne $request.network.host_loopback_port_lease -or
    $networkReceipt.inbound_host_port_mappings -ne 0 -or
    $networkAdapter.SwitchName -ne $request.network.isolated_switch -or
    [string]::IsNullOrWhiteSpace([string]$networkAdapter.MacAddress)
) {
    throw 'Isolated network identity does not match the clean baseline request and VM.'
}
$existingClean = @(Get-VMSnapshot -VMName $Name | Where-Object Name -like 'OPL-Clean-Windows-zh-CN-*')
if ($existingClean.Count -ne 0) {
    throw 'A clean Windows baseline checkpoint already exists; reconcile instead of creating another.'
}

$evidenceDirectory = [string]$request.exclusive_paths.evidence
$attestationPath = Join-Path $evidenceDirectory 'clean-vm-attestation.json'
if (Test-Path -LiteralPath $attestationPath) {
    throw "Clean VM attestation already exists: $attestationPath"
}
$checkpointName = "OPL-Clean-Windows-zh-CN-$((Get-Date).ToUniversalTime().ToString('yyyyMMddTHHmmssZ'))"
if ($PSCmdlet.ShouldProcess($Name, "Create clean Windows baseline checkpoint $checkpointName")) {
    Checkpoint-VM -VMName $Name -SnapshotName $checkpointName
}
$checkpoint = Get-VMSnapshot -VMName $Name -Name $checkpointName -ErrorAction Stop
$disk = Get-VMHardDiskDrive -VMName $Name | Select-Object -First 1
$vhdxChain = @()
$nextVhdPath = [string]$disk.Path
while (-not [string]::IsNullOrWhiteSpace($nextVhdPath)) {
    if (-not $nextVhdPath.StartsWith([string]$request.exclusive_paths.guest, [StringComparison]::OrdinalIgnoreCase)) {
        throw "Clean baseline VHDX chain escapes the exclusive guest root: $nextVhdPath"
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
if (@($vhdxChain | Where-Object { $_.path -eq [string]$request.exclusive_paths.vhdx }).Count -ne 1) {
    throw 'Clean baseline VHDX chain does not include the exact requested base disk.'
}
$attestedAt = (Get-Date).ToUniversalTime().ToString('o')
$attestation = [ordered]@{
    schema = 'opl_windows_clean_vm_attestation.v2'
    status = 'attested'
    factory_root = $canonicalRoot
    attested_at = $attestedAt
    vm_name = $Name
    vm_id = ([string]$vm.VMId).ToLowerInvariant()
    vm_identity = "hyperv-vmid:$(([string]$vm.VMId).ToLowerInvariant())"
    checkpoint_id = ([string]$checkpoint.Id).ToLowerInvariant()
    checkpoint_name = $checkpoint.Name
    checkpoint_created_at = $checkpoint.CreationTime.ToUniversalTime().ToString('o')
    vm_state = [string]$vm.State
    config_path = $configPath
    active_vhdx_path = [string]$disk.Path
    vhdx_chain = $vhdxChain
    clean_user_receipt_path = $resolvedGuestBaselineReceiptPath
    clean_user_receipt_sha256 = (Get-FileHash -Algorithm SHA256 -LiteralPath $GuestBaselineReceiptPath).Hash.ToLowerInvariant()
    request_path = $requestPath
    request_sha256 = (Get-FileHash -Algorithm SHA256 -LiteralPath $requestPath).Hash.ToLowerInvariant()
    localization = [ordered]@{
        installation_media_language = $baseline.windows.installation_media_language
        ui_language = $baseline.windows.ui_language
        system_locale = $baseline.windows.system_locale
        user_locale = $baseline.windows.user_locale
        default_input_method_tip = '0804:00000804'
    }
    network = [ordered]@{
        switch_name = [string]$networkReceipt.switch_name
        switch_id = ([string]$networkReceipt.switch_id).ToLowerInvariant()
        nat_name = [string]$networkReceipt.nat_name
        nat_id = [string]$networkReceipt.nat_id
        subnet = [string]$networkReceipt.subnet
        guest_ip = [string]$networkReceipt.guest_ip
        static_mac_address = [string]$networkAdapter.MacAddress
        host_loopback_port_lease = [string]$networkReceipt.host_loopback_port_lease
        inbound_nat_mappings = [int]$networkReceipt.inbound_host_port_mappings
        writable_surface_overlap_count = 0
    }
    network_receipt_path = $networkReceiptPath
    network_receipt_sha256 = (Get-FileHash -Algorithm SHA256 -LiteralPath $networkReceiptPath).Hash.ToLowerInvariant()
}
$attestationJson = $attestation | ConvertTo-Json -Depth 12
[IO.File]::WriteAllText($attestationPath, "$attestationJson`n", [Text.UTF8Encoding]::new($false))
$attestation | ConvertTo-Json -Depth 8

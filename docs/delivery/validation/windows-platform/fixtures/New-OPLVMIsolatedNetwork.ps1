[CmdletBinding(SupportsShouldProcess)]
param(
    [Parameter(Mandatory)]
    [ValidateSet('OPL-V6-WSL2-01', 'OPL-WEBUI-CLEAN-01')]
    [string]$Name,

    [Parameter(Mandatory)]
    [ValidatePattern('^[0-9]{1,3}(\.[0-9]{1,3}){3}/[0-9]{1,2}$')]
    [string]$Subnet,

    [Parameter(Mandatory)]
    [ValidatePattern('^[0-9]{1,3}(\.[0-9]{1,3}){3}$')]
    [string]$GatewayAddress,

    [ValidateRange(8, 30)]
    [int]$PrefixLength = 24,
    [string]$Root = 'C:\OPL-VMs'
)

$ErrorActionPreference = 'Stop'
$canonicalRoot = 'C:\OPL-VMs'
$Root = [IO.Path]::GetFullPath($Root).TrimEnd('\')
if (-not $Root.Equals($canonicalRoot, [StringComparison]::OrdinalIgnoreCase)) {
    throw "Network creation must target the canonical factory root: $canonicalRoot"
}
$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = [Security.Principal.WindowsPrincipal]::new($identity)
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    throw 'New-OPLVMIsolatedNetwork.ps1 must run from an elevated PowerShell process.'
}

Import-Module Hyper-V -ErrorAction Stop
$vm = Get-VM -Name $Name -ErrorAction Stop
$switchName = "OPL-NAT-$Name"
$natName = "OPL-NAT-$Name"
$requestPath = Join-Path $Root "Leases\$Name.request.json"
if (-not (Test-Path -LiteralPath $requestPath -PathType Leaf)) {
    throw "VM lease request not found: $requestPath"
}
$request = Get-Content -LiteralPath $requestPath -Raw | ConvertFrom-Json
$expectedSwitchName = "OPL-NAT-$Name"
$isV6 = $Name -eq 'OPL-V6-WSL2-01'
$expectedSubnet = if ($isV6) { '172.28.102.0/24' } else { '172.28.101.0/24' }
$expectedGatewayAddress = if ($isV6) { '172.28.102.1' } else { '172.28.101.1' }
$expectedGuestIp = if ($isV6) { '172.28.102.10' } else { '172.28.101.10' }
$expectedPortLease = if ($isV6) { '33101-33119' } else { '33001-33019' }
$expectedEvidenceDirectory = Join-Path $Root "Guests\$Name\Evidence"
if (
    $request.schema -ne 'opl_windows_vm_lease_request.v2' -or
    $request.status -ne 'prepared_factory_ready' -or
    $request.factory_root -ne $canonicalRoot -or
    $request.vm_name -ne $Name -or
    $request.network.isolated_switch -ne $expectedSwitchName -or
    $request.network.nat_name -ne $expectedSwitchName -or
    $request.network.subnet -ne $Subnet -or
    $request.network.host_gateway -ne $GatewayAddress -or
    $request.network.prefix_length -ne $PrefixLength -or
    $Subnet -ne $expectedSubnet -or
    $GatewayAddress -ne $expectedGatewayAddress -or
    $request.network.guest_ip -ne $expectedGuestIp -or
    $request.network.host_loopback_port_lease -ne $expectedPortLease -or
    -not ([IO.Path]::GetFullPath([string]$request.exclusive_paths.evidence).TrimEnd('\')).Equals($expectedEvidenceDirectory, [StringComparison]::OrdinalIgnoreCase)
) {
    throw 'Isolated network arguments do not match the exact C-root VM namespace.'
}
$evidenceDirectory = [string]$request.exclusive_paths.evidence
$receiptPath = Join-Path $evidenceDirectory 'isolated-network-receipt.json'
if (Test-Path -LiteralPath $receiptPath) {
    throw "Create-once isolated network receipt already exists: $receiptPath"
}
[void][IO.Directory]::CreateDirectory($evidenceDirectory)

if ([string]$vm.State -ne 'Off') {
    throw 'VM must be powered off before isolated network creation.'
}
if (Get-VMSwitch -Name $switchName -ErrorAction SilentlyContinue) {
    throw "Target switch already exists; reconcile without replay: $switchName"
}
if (Get-NetNat -Name $natName -ErrorAction SilentlyContinue) {
    throw "Target NAT already exists; reconcile without replay: $natName"
}

$conflictingNat = Get-NetNat -ErrorAction SilentlyContinue | Where-Object {
    $_.Name -ne $natName -and $_.InternalIPInterfaceAddressPrefix -eq $Subnet
}
if ($conflictingNat) {
    throw "Subnet is already owned by another NAT: $Subnet"
}

if ($PSCmdlet.ShouldProcess($switchName, 'Create per-VM internal switch')) {
    New-VMSwitch -Name $switchName -SwitchType Internal | Out-Null
}
$adapter = Get-NetAdapter -Name "vEthernet ($switchName)" -ErrorAction Stop
if (-not (Get-NetIPAddress -InterfaceIndex $adapter.ifIndex -AddressFamily IPv4 -ErrorAction SilentlyContinue | Where-Object IPAddress -eq $GatewayAddress)) {
    if ($PSCmdlet.ShouldProcess($adapter.Name, "Assign gateway $GatewayAddress/$PrefixLength")) {
        New-NetIPAddress -InterfaceIndex $adapter.ifIndex -IPAddress $GatewayAddress -PrefixLength $PrefixLength | Out-Null
    }
}
if ($PSCmdlet.ShouldProcess($natName, "Create NAT for $Subnet")) {
    New-NetNat -Name $natName -InternalIPInterfaceAddressPrefix $Subnet | Out-Null
}

$vmAdapter = Get-VMNetworkAdapter -VMName $Name | Select-Object -First 1
if ($vmAdapter.SwitchName -ne $switchName) {
    if ($PSCmdlet.ShouldProcess($Name, "Connect VM to isolated switch $switchName")) {
        Connect-VMNetworkAdapter -VMName $Name -SwitchName $switchName
    }
}
$vmAdapter = Get-VMNetworkAdapter -VMName $Name | Select-Object -First 1
$nat = Get-NetNat -Name $natName
$switch = Get-VMSwitch -Name $switchName
$receipt = [ordered]@{
    schema = 'opl_windows_vm_isolated_network_receipt.v1'
    status = 'passed'
    observed_at = (Get-Date).ToUniversalTime().ToString('o')
    factory_root = $canonicalRoot
    vm_name = $Name
    vm_uuid = [string]$vm.VMId
    switch_name = $switchName
    switch_id = [string]$switch.Id
    switch_type = [string]$switch.SwitchType
    nat_name = $nat.Name
    nat_id = if ($nat.PSObject.Properties.Name -contains 'InstanceID') { [string]$nat.InstanceID } else { "$($nat.Name)|$($nat.InternalIPInterfaceAddressPrefix)" }
    subnet = $nat.InternalIPInterfaceAddressPrefix
    guest_ip = [string]$request.network.guest_ip
    host_gateway = $GatewayAddress
    prefix_length = $PrefixLength
    host_adapter_ifindex = $adapter.ifIndex
    vm_adapter_id = [string]$vmAdapter.Id
    vm_mac_address = $vmAdapter.MacAddress
    vm_connected_switch = $vmAdapter.SwitchName
    inbound_host_port_mappings = @(Get-NetNatStaticMapping -NatName $natName -ErrorAction SilentlyContinue).Count
    host_loopback_port_lease = [string]$request.network.host_loopback_port_lease
    writable_surface_overlap_count = 0
    request_path = $requestPath
    request_sha256 = (Get-FileHash -Algorithm SHA256 -LiteralPath $requestPath).Hash.ToLowerInvariant()
}
$receiptJson = $receipt | ConvertTo-Json -Depth 8
[IO.File]::WriteAllText($receiptPath, "$receiptJson`n", [Text.UTF8Encoding]::new($false))
$receipt | ConvertTo-Json -Depth 8

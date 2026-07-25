[CmdletBinding(SupportsShouldProcess)]
param(
    [Parameter(Mandatory)]
    [ValidateSet('OPL-V6-WSL2-01', 'OPL-WEBUI-CLEAN-01')]
    [string]$Name,

    [Parameter(Mandatory)]
    [string]$IsoPath,

    [string]$Root = 'C:\OPL-VMs',
    [string]$RequestPath,
    [string]$SwitchName = 'Default Switch'
)

$ErrorActionPreference = 'Stop'
$canonicalRoot = 'C:\OPL-VMs'
$Root = [IO.Path]::GetFullPath($Root).TrimEnd('\')
if (-not $Root.Equals($canonicalRoot, [StringComparison]::OrdinalIgnoreCase)) {
    throw "VM creation must target the canonical factory root: $canonicalRoot"
}
$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = [Security.Principal.WindowsPrincipal]::new($identity)
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    throw 'New-OPLWindows11VM.ps1 must run from an elevated PowerShell process.'
}
if (-not (Test-Path -LiteralPath $IsoPath -PathType Leaf)) {
    throw "ISO not found: $IsoPath"
}

Import-Module Hyper-V -ErrorAction Stop
if (Get-VM -Name $Name -ErrorAction SilentlyContinue) {
    throw "VM already exists: $Name"
}
if (-not (Get-VMSwitch -Name $SwitchName -ErrorAction SilentlyContinue)) {
    throw "Hyper-V switch not found: $SwitchName"
}

$requestPath = if ([string]::IsNullOrWhiteSpace($RequestPath)) {
    Join-Path $Root "Leases\$Name.request.json"
} else {
    $RequestPath
}
if (-not (Test-Path -LiteralPath $requestPath -PathType Leaf)) {
    throw "VM lease request not found: $requestPath"
}
$request = Get-Content -LiteralPath $requestPath -Raw | ConvertFrom-Json
if (
    $request.schema -ne 'opl_windows_vm_lease_request.v2' -or
    $request.factory_root -ne $canonicalRoot -or
    $request.vm_name -ne $Name -or
    $request.status -ne 'prepared_factory_ready' -or
    $request.lease_authorized -ne $false
) {
    throw 'VM lease request identity or status does not match this create operation.'
}
$expectedGuestDirectory = Join-Path $Root "Guests\$Name"
$expectedConfigDirectory = Join-Path $expectedGuestDirectory 'Virtual Machines'
$expectedEvidenceDirectory = Join-Path $expectedGuestDirectory 'Evidence'
$expectedVhdPath = Join-Path $expectedGuestDirectory "Virtual Hard Disks\$Name.vhdx"
if (
    -not ([IO.Path]::GetFullPath([string]$request.exclusive_paths.guest).TrimEnd('\')).Equals($expectedGuestDirectory, [StringComparison]::OrdinalIgnoreCase) -or
    -not ([IO.Path]::GetFullPath([string]$request.exclusive_paths.config).TrimEnd('\')).Equals($expectedConfigDirectory, [StringComparison]::OrdinalIgnoreCase) -or
    -not ([IO.Path]::GetFullPath([string]$request.exclusive_paths.evidence).TrimEnd('\')).Equals($expectedEvidenceDirectory, [StringComparison]::OrdinalIgnoreCase) -or
    -not ([IO.Path]::GetFullPath([string]$request.exclusive_paths.vhdx)).Equals($expectedVhdPath, [StringComparison]::OrdinalIgnoreCase)
) {
    throw 'VM request paths do not match the exact target VM namespace.'
}
$postResizeReceiptPath = Join-Path $Root 'Evidence\post-resize-gate-factory-ready.json'
$storageProbeReceiptPath = Join-Path $Root 'Evidence\hyperv-storage-compatibility-receipt.json'
foreach ($inputPath in @($postResizeReceiptPath, $storageProbeReceiptPath)) {
    if (-not (Test-Path -LiteralPath $inputPath -PathType Leaf)) {
        throw "Required factory receipt is missing: $inputPath"
    }
}
if ((Get-FileHash -Algorithm SHA256 -LiteralPath $postResizeReceiptPath).Hash.ToLowerInvariant() -ne $request.source_contract.post_resize_gate_receipt_sha256) {
    throw 'Post-resize gate receipt does not match the current VM request.'
}
if ((Get-FileHash -Algorithm SHA256 -LiteralPath $storageProbeReceiptPath).Hash.ToLowerInvariant() -ne $request.storage_compatibility.probe_receipt_sha256) {
    throw 'Storage probe receipt does not match the current VM request.'
}
$postResizeReceipt = Get-Content -Raw -LiteralPath $postResizeReceiptPath | ConvertFrom-Json
$storageProbeReceipt = Get-Content -Raw -LiteralPath $storageProbeReceiptPath | ConvertFrom-Json
if (
    $postResizeReceipt.status -ne 'passed' -or
    $postResizeReceipt.factory_root -ne $canonicalRoot -or
    $storageProbeReceipt.status -ne 'passed' -or
    $storageProbeReceipt.factory_root -ne $canonicalRoot -or
    $storageProbeReceipt.drive -ne 'C:' -or
    $storageProbeReceipt.filesystem -ne 'NTFS'
) {
    throw 'Factory readiness or storage compatibility receipt is outside the C-root contract.'
}
$resolvedIsoPath = (Resolve-Path -LiteralPath $IsoPath).Path
if (
    -not $resolvedIsoPath.Equals([string]$postResizeReceipt.iso.path, [StringComparison]::OrdinalIgnoreCase) -or
    (Get-Item -LiteralPath $resolvedIsoPath).Length -ne [int64]$postResizeReceipt.iso.size_bytes -or
    (Get-FileHash -Algorithm SHA256 -LiteralPath $resolvedIsoPath).Hash.ToLowerInvariant() -ne [string]$postResizeReceipt.iso.sha256
) {
    throw 'ISO bytes do not match the official zh-CN post-resize gate identity.'
}
if ($SwitchName -ne [string]$request.network.temporary_oobe_switch) {
    throw 'VM creation switch does not match the temporary OOBE switch in the request.'
}
$requiredLanguage = 'zh-CN'
$requiredInputMethodTip = '0804:00000804'
$localization = $request.guest_localization
if (
    $null -eq $localization -or
    $localization.installation_media_language -ne $requiredLanguage -or
    $localization.ui_language -ne $requiredLanguage -or
    $localization.system_locale -ne $requiredLanguage -or
    $localization.user_locale -ne $requiredLanguage -or
    $localization.default_input_method_tip -ne $requiredInputMethodTip
) {
    throw 'VM request must bind the Simplified Chinese Windows localization policy.'
}
$guestDirectory = [string]$request.exclusive_paths.guest
$evidenceDirectory = [string]$request.exclusive_paths.evidence
$vhdPath = [string]$request.exclusive_paths.vhdx
$rootPrefix = $Root + '\'
foreach ($path in @($guestDirectory, [string]$request.exclusive_paths.config, $evidenceDirectory, $vhdPath)) {
    if (-not [IO.Path]::GetFullPath($path).StartsWith($rootPrefix, [StringComparison]::OrdinalIgnoreCase)) {
        throw "Request path escapes the VM factory root: $path"
    }
}
if (-not [IO.Path]::GetFullPath((Split-Path -Parent $vhdPath)).StartsWith([IO.Path]::GetFullPath($guestDirectory).TrimEnd('\') + '\', [StringComparison]::OrdinalIgnoreCase)) {
    throw 'Requested VHDX must be contained by the exclusive guest directory.'
}
$vmParentDirectory = Split-Path -Parent $guestDirectory
if (Test-Path -LiteralPath $guestDirectory) {
    throw "Guest directory already exists: $guestDirectory"
}

if ($PSCmdlet.ShouldProcess($Name, 'Create isolated Windows 11 Hyper-V VM')) {
    New-Item -ItemType Directory -Path $guestDirectory -Force | Out-Null
    New-Item -ItemType Directory -Path (Split-Path -Parent $vhdPath) -Force | Out-Null
    New-Item -ItemType Directory -Path $evidenceDirectory -Force | Out-Null
    try {
        $vm = New-VM -Name $Name -Generation 2 -Path $guestDirectory `
            -MemoryStartupBytes ([UInt64]$request.capacity.startup_memory_bytes) `
            -NewVHDPath $vhdPath `
            -NewVHDSizeBytes ([UInt64]$request.capacity.vhdx_max_bytes) `
            -SwitchName $SwitchName
        Set-VM -VM $vm -AutomaticCheckpointsEnabled $false -AutomaticStartAction Nothing -AutomaticStopAction ShutDown -CheckpointType Standard
        Set-VMMemory -VMName $Name -DynamicMemoryEnabled $true `
            -MinimumBytes ([UInt64]$request.capacity.minimum_memory_bytes) `
            -StartupBytes ([UInt64]$request.capacity.startup_memory_bytes) `
            -MaximumBytes ([UInt64]$request.capacity.maximum_memory_bytes)
        Set-VMProcessor -VMName $Name -Count ([int]$request.capacity.processor_count) `
            -ExposeVirtualizationExtensions ([bool]$request.capacity.nested_virtualization)
        Set-VMFirmware -VMName $Name -EnableSecureBoot On -SecureBootTemplate MicrosoftWindows
        Set-VMKeyProtector -VMName $Name -NewLocalKeyProtector
        Enable-VMTPM -VMName $Name
        $dvd = Add-VMDvdDrive -VMName $Name -Path $IsoPath -Passthru
        Set-VMFirmware -VMName $Name -FirstBootDevice $dvd

        $networkAdapter = Get-VMNetworkAdapter -VMName $Name | Select-Object -First 1
        Set-VMNetworkAdapter -VMName $Name -StaticMacAddress $networkAdapter.MacAddress
        $factoryCheckpointName = "OPL-Factory-MediaAttached-$((Get-Date).ToUniversalTime().ToString('yyyyMMddTHHmmssZ'))"
        Checkpoint-VM -VMName $Name -SnapshotName $factoryCheckpointName

        $readback = Get-VM -Name $Name
        $processor = Get-VMProcessor -VMName $Name
        $memory = Get-VMMemory -VMName $Name
        $security = Get-VMSecurity -VMName $Name
        $networkAdapter = Get-VMNetworkAdapter -VMName $Name
        $checkpoint = Get-VMSnapshot -VMName $Name -Name $factoryCheckpointName
        $activeDisk = Get-VMHardDiskDrive -VMName $Name | Select-Object -First 1
        $driveLetter = [IO.Path]::GetPathRoot($Root).Substring(0, 1)
        $drive = Get-Volume -DriveLetter $driveLetter
        $vhdHash = Get-FileHash -Algorithm SHA256 -LiteralPath $vhdPath
        $vhdxChain = @()
        $nextVhdPath = [string]$activeDisk.Path
        while (-not [string]::IsNullOrWhiteSpace($nextVhdPath)) {
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
        $receipt = [ordered]@{
            schema = 'opl_windows_11_vm_create_receipt.v1'
            status = 'passed'
            observed_at = (Get-Date).ToUniversalTime().ToString('o')
            factory_root = $canonicalRoot
            name = $Name
            vm_id = [string]$readback.VMId
            state = [string]$readback.State
            generation = $readback.Generation
            config_path = if ($readback.PSObject.Properties.Name -contains 'ConfigurationLocation') { [string]$readback.ConfigurationLocation } else { [string]$readback.Path }
            guest_directory = $guestDirectory
            vhd_path = $vhdPath
            active_vhdx_path = [string]$activeDisk.Path
            vhd_size_bytes = [int64]$request.capacity.vhdx_max_bytes
            vhdx_chain = $vhdxChain
            iso_path = $resolvedIsoPath
            guest_localization_policy = [ordered]@{
                installation_media_language = [string]$localization.installation_media_language
                ui_language = [string]$localization.ui_language
                system_locale = [string]$localization.system_locale
                user_locale = [string]$localization.user_locale
                default_input_method_tip = [string]$localization.default_input_method_tip
            }
            switch = $SwitchName
            network_adapter_id = [string]$networkAdapter.Id
            static_mac_address = $networkAdapter.MacAddress
            processor_count = $processor.Count
            nested_virtualization = [bool]$processor.ExposeVirtualizationExtensions
            dynamic_memory = [bool]$memory.DynamicMemoryEnabled
            startup_memory_bytes = $memory.Startup
            minimum_memory_bytes = $memory.Minimum
            maximum_memory_bytes = $memory.Maximum
            secure_boot = [bool]$security.SecureBootEnabled
            tpm_enabled = [bool]$security.TpmEnabled
            automatic_checkpoints = [bool]$readback.AutomaticCheckpointsEnabled
            factory_checkpoint = [ordered]@{
                id = [string]$checkpoint.Id
                name = $checkpoint.Name
                created_at = $checkpoint.CreationTime.ToUniversalTime().ToString('o')
            }
            disk_sha256 = $vhdHash.Hash.ToLowerInvariant()
            request_path = $requestPath
            request_sha256 = (Get-FileHash -Algorithm SHA256 -LiteralPath $requestPath).Hash.ToLowerInvariant()
            post_resize_gate_receipt_sha256 = $request.source_contract.post_resize_gate_receipt_sha256
            storage_probe_receipt_sha256 = $request.storage_compatibility.probe_receipt_sha256
            storage_compatibility = [ordered]@{
                drive = "$driveLetter`:"
                filesystem = [string]$drive.FileSystem
                vm_create_passed = $true
                checkpoint_passed = [bool]$checkpoint
                vhdx_hash_read_passed = -not [string]::IsNullOrWhiteSpace($vhdHash.Hash)
                live_vm_create_checkpoint_gate = 'passed'
            }
        }
        $receiptPath = Join-Path $evidenceDirectory 'vm-create-receipt.json'
        if (Test-Path -LiteralPath $receiptPath) {
            throw "Create-once VM receipt already exists: $receiptPath"
        }
        $receiptJson = $receipt | ConvertTo-Json -Depth 10
        [IO.File]::WriteAllText($receiptPath, "$receiptJson`n", [Text.UTF8Encoding]::new($false))
        $receipt | ConvertTo-Json -Depth 6
    }
    catch {
        Get-VM -Name $Name -ErrorAction SilentlyContinue | Remove-VM -Force -ErrorAction SilentlyContinue
        throw
    }
}

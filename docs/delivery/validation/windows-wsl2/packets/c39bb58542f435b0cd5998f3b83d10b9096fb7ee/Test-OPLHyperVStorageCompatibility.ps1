[CmdletBinding()]
param(
    [string]$Root = 'C:\OPL-VMs',
    [string]$ProbeName = 'OPL-STORAGE-PROBE-01'
)

$ErrorActionPreference = 'Stop'
$canonicalRoot = 'C:\OPL-VMs'
$Root = [IO.Path]::GetFullPath($Root).TrimEnd('\')
if (-not $Root.Equals($canonicalRoot, [StringComparison]::OrdinalIgnoreCase)) {
    throw "Storage probe must target the canonical factory root: $canonicalRoot"
}
$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = [Security.Principal.WindowsPrincipal]::new($identity)
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    throw 'Test-OPLHyperVStorageCompatibility.ps1 must run elevated.'
}

Import-Module Hyper-V -ErrorAction Stop
$probeRoot = Join-Path $Root "Probes\$ProbeName"
$vhdPath = Join-Path $probeRoot "$ProbeName.vhdx"
$receiptPath = Join-Path $Root 'Evidence\hyperv-storage-compatibility-receipt.json'
if (Test-Path -LiteralPath $receiptPath) {
    throw "Create-once storage probe receipt already exists: $receiptPath"
}
[void][IO.Directory]::CreateDirectory((Split-Path -Parent $receiptPath))
$startedAt = (Get-Date).ToUniversalTime().ToString('o')
$failure = $null
$readback = $null

if (Get-VM -Name $ProbeName -ErrorAction SilentlyContinue) {
    throw "Probe VM already exists: $ProbeName"
}
if (Test-Path -LiteralPath $probeRoot) {
    throw "Probe root must be absent before the operation: $probeRoot"
}

try {
    New-Item -ItemType Directory -Path $probeRoot -Force | Out-Null
    $vm = New-VM -Name $ProbeName -Generation 2 -Path $probeRoot `
        -MemoryStartupBytes 1GB -NewVHDPath $vhdPath -NewVHDSizeBytes 2GB
    Set-VM -VM $vm -AutomaticCheckpointsEnabled $false -AutomaticStartAction Nothing `
        -AutomaticStopAction ShutDown -CheckpointType Standard
    $checkpointName = "OPL-Storage-Probe-$((Get-Date).ToUniversalTime().ToString('yyyyMMddTHHmmssZ'))"
    Checkpoint-VM -VMName $ProbeName -SnapshotName $checkpointName

    $vmReadback = Get-VM -Name $ProbeName
    $checkpoint = Get-VMSnapshot -VMName $ProbeName -Name $checkpointName
    $disk = Get-VMHardDiskDrive -VMName $ProbeName | Select-Object -First 1
    $vhd = Get-VHD -Path $disk.Path
    $vhdHash = Get-FileHash -Algorithm SHA256 -LiteralPath $vhdPath
    $readback = [ordered]@{
        vm_id = [string]$vmReadback.VMId
        state = [string]$vmReadback.State
        generation = $vmReadback.Generation
        config_path = if ($vmReadback.PSObject.Properties.Name -contains 'ConfigurationLocation') {
            [string]$vmReadback.ConfigurationLocation
        } else {
            [string]$vmReadback.Path
        }
        active_vhdx_path = [string]$disk.Path
        vhd_type = [string]$vhd.VhdType
        vhd_file_size_bytes = [int64]$vhd.FileSize
        vhd_maximum_size_bytes = [int64]$vhd.Size
        base_vhdx_sha256 = $vhdHash.Hash.ToLowerInvariant()
        checkpoint_id = [string]$checkpoint.Id
        checkpoint_name = $checkpoint.Name
    }
}
catch {
    $failure = $_.Exception.Message
}
finally {
    Get-VM -Name $ProbeName -ErrorAction SilentlyContinue |
        Remove-VM -Force -ErrorAction SilentlyContinue
    if (Test-Path -LiteralPath $probeRoot) {
        Remove-Item -LiteralPath $probeRoot -Recurse -Force -ErrorAction SilentlyContinue
    }
}

$driveLetter = [IO.Path]::GetPathRoot($Root).Substring(0, 1)
$drive = Get-Volume -DriveLetter $driveLetter
$receipt = [ordered]@{
    schema = 'opl_windows_hyperv_storage_compatibility_receipt.v1'
    status = if ($failure -or (Test-Path -LiteralPath $probeRoot) -or
        (Get-VM -Name $ProbeName -ErrorAction SilentlyContinue)) { 'failed' } else { 'passed' }
    observed_at = (Get-Date).ToUniversalTime().ToString('o')
    started_at = $startedAt
    factory_root = $canonicalRoot
    drive = "$driveLetter`:"
    filesystem = [string]$drive.FileSystem
    drive_health = [string]$drive.HealthStatus
    probe_name = $ProbeName
    probe_root = $probeRoot
    operation = 'create_vhdx_register_off_vm_checkpoint_hash_remove'
    readback = $readback
    failure = $failure
    cleanup = [ordered]@{
        vm_absent = -not [bool](Get-VM -Name $ProbeName -ErrorAction SilentlyContinue)
        probe_root_absent = -not (Test-Path -LiteralPath $probeRoot)
    }
}
$receiptJson = $receipt | ConvertTo-Json -Depth 8
[IO.File]::WriteAllText($receiptPath, "$receiptJson`n", [Text.UTF8Encoding]::new($false))
$receipt | ConvertTo-Json -Depth 8
if ($receipt.status -ne 'passed') {
    throw "Hyper-V storage compatibility probe failed. See $receiptPath"
}

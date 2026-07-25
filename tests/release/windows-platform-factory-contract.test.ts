import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { appRoot } from './release-readiness/helpers.ts';
import { validateWindowsPlatformFactoryContract } from '../../scripts/validate-windows-platform-factory.ts';

const platformRoot = path.join(
  appRoot,
  'docs',
  'delivery',
  'validation',
  'windows-platform',
);
const requestSchemaPath = path.join(platformRoot, 'windows-platform-vm-request.schema.json');
const leaseSchemaPath = path.join(platformRoot, 'windows-platform-vm-lease.schema.json');
const cleanAttestationSchemaPath = path.join(
  platformRoot,
  'windows-platform-clean-vm-attestation.schema.json',
);
const gateSchemaPath = path.join(platformRoot, 'windows-platform-post-resize-gate.schema.json');
const sha = 'a'.repeat(64);
const commit = 'b'.repeat(40);

function compile(filePath: string) {
  const ajv = new Ajv2020({ allErrors: true, strictSchema: true, strictTypes: false });
  addFormats(ajv);
  return ajv.compile(JSON.parse(fs.readFileSync(filePath, 'utf8')));
}

function makeRequest(name: 'OPL-V6-WSL2-01' | 'OPL-WEBUI-CLEAN-01') {
  const isV6 = name === 'OPL-V6-WSL2-01';
  const subnet = isV6 ? '172.28.102' : '172.28.101';
  const owner = isV6
    ? '019f97e4-288a-7140-8850-925c657d8c71'
    : '019f972b-f550-7961-90be-9873600cd895';
  const guest = `C:\\OPL-VMs\\Guests\\${name}`;
  return {
    schema: 'opl_windows_vm_lease_request.v2',
    status: 'prepared_factory_ready',
    factory_root: 'C:\\OPL-VMs',
    lease_id: isV6 ? 'opl-v6-wsl2-01' : 'opl-webui-clean-01',
    vm_name: name,
    execution_owner_thread: owner,
    source_contract: {
      app_acceptance_sha: commit,
      delivery_commit: commit,
      intake_manifest_sha256: sha,
      post_resize_gate_receipt_sha256: sha,
    },
    guest_localization: {
      installation_media_language: 'zh-CN',
      ui_language: 'zh-CN',
      system_locale: 'zh-CN',
      user_locale: 'zh-CN',
      default_input_method_tip: '0804:00000804',
    },
    lease_transition: {
      previous_owner_thread: null,
      next_owner_thread: owner,
      request_receipt_id: '11111111-2222-3333-4444-555555555555',
      requested_at: '2026-07-26T00:00:00.000Z',
    },
    shared_read_only_inputs: ['C:\\OPL-VMs\\ISO', 'C:\\OPL-VMs\\Base'],
    exclusive_paths: {
      guest,
      config: `${guest}\\Virtual Machines`,
      evidence: `${guest}\\Evidence`,
      vhdx: `${guest}\\Virtual Hard Disks\\${name}.vhdx`,
    },
    capacity: {
      processor_count: 4,
      startup_memory_bytes: 8589934592,
      minimum_memory_bytes: 4294967296,
      maximum_memory_bytes: 17179869184,
      dynamic_memory: true,
      vhdx_max_bytes: 137438953472,
      nested_virtualization: true,
    },
    network: {
      temporary_oobe_switch: 'Default Switch',
      isolated_switch: `OPL-NAT-${name}`,
      nat_name: `OPL-NAT-${name}`,
      subnet: `${subnet}.0/24`,
      host_gateway: `${subnet}.1`,
      guest_ip: `${subnet}.10`,
      prefix_length: 24,
      inbound_nat_mappings: 0,
      host_loopback_port_lease: isV6 ? '33101-33119' : '33001-33019',
    },
    runtime_namespace: name,
    receipt_namespace: `${guest}\\Evidence`,
    storage_compatibility: {
      drive: 'C:',
      filesystem: 'NTFS',
      minimum_free_bytes: 32212254720,
      probe_receipt_sha256: sha,
    },
    writable_surface_overlap_count: 0,
    lease_authorized: false,
  };
}

function makeVmIdentity(name: 'OPL-V6-WSL2-01' | 'OPL-WEBUI-CLEAN-01') {
  const guest = `C:\\OPL-VMs\\Guests\\${name}`;
  const isV6 = name === 'OPL-V6-WSL2-01';
  const subnet = isV6 ? '172.28.102' : '172.28.101';
  const portLease = isV6 ? '33101-33119' : '33001-33019';
  const switchName = `OPL-NAT-${name}`;
  const activeVhdxPath = `${guest}\\Virtual Hard Disks\\${name}.vhdx`;
  return {
    name,
    vm_id: '11111111-2222-3333-4444-555555555555',
    generation: 2,
    state: 'Off',
    config_path: `${guest}\\Virtual Machines`,
    active_vhdx_path: activeVhdxPath,
    vhdx_chain: [{
      path: activeVhdxPath,
      parent_path: null,
      vhd_type: 'Dynamic',
      file_size_bytes: 1073741824,
      maximum_size_bytes: 137438953472,
    }],
    checkpoint_id: '22222222-3333-4444-5555-666666666666',
    checkpoint_name: `OPL-Clean-Windows-zh-CN-${name}`,
    localization: {
      ui_language: 'zh-CN',
      system_locale: 'zh-CN',
      user_locale: 'zh-CN',
      default_input_method_tip: '0804:00000804',
    },
    clean_baseline: true,
    network: {
      switch_name: switchName,
      switch_id: isV6
        ? '33333333-4444-5555-6666-777777777777'
        : '44444444-5555-6666-7777-888888888888',
      nat_name: switchName,
      nat_id: `${switchName}|${subnet}.0/24`,
      subnet: `${subnet}.0/24`,
      guest_ip: `${subnet}.10`,
      static_mac_address: isV6 ? '00155D010203' : '00155D010204',
      host_loopback_port_lease: portLease,
      inbound_nat_mappings: 0,
      writable_surface_overlap_count: 0,
    },
    network_receipt_sha256: sha,
  };
}

function makeWriterLeaseSummary() {
  return {
    path: 'C:\\OPL-VMs\\Leases\\OPL-V6-WSL2-01.writer-lease.json',
    sha256: sha,
    request_sha256: sha,
    vm_identity: 'hyperv-vmid:11111111-2222-3333-4444-555555555555',
    executor_task_id: '019f97e4-288a-7140-8850-925c657d8c71',
    powered_off: true,
    operation_count: 0,
  };
}

function makeCleanAttestation(
  name: 'OPL-V6-WSL2-01' | 'OPL-WEBUI-CLEAN-01',
) {
  const vm = makeVmIdentity(name);
  const evidence = `C:\\OPL-VMs\\Guests\\${name}\\Evidence`;
  return {
    schema: 'opl_windows_clean_vm_attestation.v2',
    status: 'attested',
    factory_root: 'C:\\OPL-VMs',
    attested_at: '2026-07-26T00:00:00.000Z',
    vm_name: name,
    vm_id: vm.vm_id,
    vm_identity: `hyperv-vmid:${vm.vm_id}`,
    vm_state: 'Off',
    config_path: vm.config_path,
    active_vhdx_path: vm.active_vhdx_path,
    vhdx_chain: vm.vhdx_chain,
    checkpoint_id: vm.checkpoint_id,
    checkpoint_name: vm.checkpoint_name,
    checkpoint_created_at: '2026-07-26T00:00:00.000Z',
    localization: {
      installation_media_language: 'zh-CN',
      ...vm.localization,
    },
    network: vm.network,
    clean_user_receipt_path: `${evidence}\\clean-user-receipt.json`,
    clean_user_receipt_sha256: sha,
    request_path: `C:\\OPL-VMs\\Leases\\${name}.request.json`,
    request_sha256: sha,
    network_receipt_path: `${evidence}\\isolated-network-receipt.json`,
    network_receipt_sha256: sha,
  };
}

function makePlatformLease(
  name: 'OPL-V6-WSL2-01' | 'OPL-WEBUI-CLEAN-01',
) {
  const request = makeRequest(name);
  const vm = makeVmIdentity(name);
  const attestation = makeCleanAttestation(name);
  return {
    schema: 'opl_windows_vm_lease.v2',
    status: 'active',
    factory_root: 'C:\\OPL-VMs',
    receipt_id: '55555555-6666-7777-8888-999999999999',
    granted_at: '2026-07-26T00:00:00.000Z',
    released_at: null,
    lease_id: request.lease_id,
    vm_name: name,
    execution_owner_thread: request.execution_owner_thread,
    previous_owner_thread: request.lease_transition.previous_owner_thread,
    next_owner_thread: request.lease_transition.next_owner_thread,
    source_contract: request.source_contract,
    generation: 2,
    vm_uuid: vm.vm_id,
    config_path: vm.config_path,
    active_vhdx_path: vm.active_vhdx_path,
    vhdx_chain: vm.vhdx_chain,
    checkpoint_chain: [{
      id: vm.checkpoint_id,
      name: vm.checkpoint_name,
      created_at: '2026-07-26T00:00:00.000Z',
    }],
    network: {
      current_switch: vm.network.switch_name,
      switch_id: vm.network.switch_id,
      nat_name: vm.network.nat_name,
      nat_id: vm.network.nat_id,
      subnet: vm.network.subnet,
      guest_ip: vm.network.guest_ip,
      host_loopback_port_lease: vm.network.host_loopback_port_lease,
      static_mac_address: vm.network.static_mac_address,
      inbound_nat_mappings: 0,
    },
    guest_localization: request.guest_localization,
    exclusive_paths: request.exclusive_paths,
    runtime_namespace: request.runtime_namespace,
    receipt_namespace: request.receipt_namespace,
    clean_vm_attestation: {
      path: `${request.exclusive_paths.evidence}\\clean-vm-attestation.json`,
      sha256: sha,
      schema: attestation.schema,
      vm_identity: attestation.vm_identity,
      checkpoint_id: attestation.checkpoint_id,
      checkpoint_name: attestation.checkpoint_name,
      clean_user_receipt_sha256: attestation.clean_user_receipt_sha256,
    },
    request_sha256: sha,
    post_resize_gate_receipt_sha256: sha,
    storage_probe_receipt_sha256: sha,
    vm_create_receipt_sha256: sha,
    network_receipt_sha256: sha,
    writable_surface_overlap_count: 0,
    lease_authorized: true,
  };
}

function makeFactoryGate() {
  const scriptNames = [
    'Test-OPLHyperVStorageCompatibility.ps1',
    'New-OPLWindows11VM.ps1',
    'New-OPLVMIsolatedNetwork.ps1',
    'Seal-OPLCleanWindowsBaseline.ps1',
    'Grant-OPLVMLease.ps1',
    'Grant-OPLV6WriterLease.ps1',
  ];
  return {
    schema: 'opl_windows_platform_post_resize_gate.v1',
    stage: 'factory_ready',
    status: 'passed',
    observed_at: '2026-07-26T00:00:00.000Z',
    factory_root: 'C:\\OPL-VMs',
    capacity: {
      drive: 'C:',
      filesystem: 'NTFS',
      size_bytes: 2046137724928,
      free_bytes: 1789256577024,
      minimum_free_bytes: 32212254720,
      gate_passed: true,
    },
    weston_crash_loop: {
      observation_seconds: 180,
      dump_count_before: 1,
      dump_count_after: 1,
      new_dump_count: 0,
      stopped: true,
    },
    disk_layout: {
      disk_number: 0,
      partition_style: 'GPT',
      system_drive: 'C:',
      system_drive_size_bytes: 2046137724928,
      winre_enabled: true,
      receipt_sha256: sha,
    },
    released_volumes: {
      f_drive_required: false,
      f_drive_present: false,
      release_proven: true,
    },
    iso: {
      path: 'C:\\OPL-VMs\\ISO\\26200.6584.250915-1905.25h2_ge_release_svc_refresh_CLIENTENTERPRISEEVAL_OEMRET_x64FRE_zh-cn.iso',
      language: 'zh-CN',
      edition: 'Windows 11 Enterprise Evaluation 25H2 x64',
      size_bytes: 7371034624,
      sha256: '7b4ac87391b659f7724229682b642256289a1c00504056249f0f12029157d3d2',
      source: 'microsoft_official_evaluation',
      verified: true,
    },
    cutover: {
      source_root: 'E:\\_Original-E-20260726\\OPL-VMs',
      source_mode: 'read_only_recovery',
      target_root: 'C:\\OPL-VMs',
      manifest_sha256: sha,
      file_count: 10,
      total_bytes: 7371034624,
      verified: true,
      source_deleted: false,
    },
    script_bundle: scriptNames.map((name) => ({
      name,
      path: `C:\\OPL-VMs\\Scripts\\${name}`,
      sha256: sha,
      factory_root_binding: 'C:\\OPL-VMs',
      source_classification: 'task_owned_sealed_host_script',
    })),
    source_integration: {
      canonical_main_commit: commit,
      canonical_main_tree: commit,
      source_commit: commit,
      source_tree: commit,
      delivery_commit: commit,
      delivery_tree: commit,
      packet_manifest_sha256: sha,
      absorption_audit_sha256: sha,
      remote_ref_tree_blob_parity: true,
      authenticated_raw_parity: true,
      anonymous_raw_parity: true,
      source_absorbed: true,
      task_worktree_removed: false,
      local_task_branch_removed: false,
      remote_task_branch_removed: false,
      remaining_source_cleanup_count: 3,
    },
    vms: [],
    v6_writer_lease: null,
  };
}

test('Windows platform contract statically binds one C-root factory and two isolated zh-CN targets', () => {
  assert.deepEqual(validateWindowsPlatformFactoryContract(), {
    factoryRoot: 'C:\\OPL-VMs',
    recoverySource: 'E:\\_Original-E-20260726\\OPL-VMs',
    targetCount: 2,
    runtimeInputsValidated: [],
  });
});

test('C-root VM requests pass while E-root, path escape, owner, and target mismatches fail closed', () => {
  const validate = compile(requestSchemaPath);
  const v6 = makeRequest('OPL-V6-WSL2-01');
  const webui = makeRequest('OPL-WEBUI-CLEAN-01');
  assert.equal(validate(v6), true, JSON.stringify(validate.errors));
  assert.equal(validate(webui), true, JSON.stringify(validate.errors));

  const eRoot = structuredClone(v6);
  eRoot.factory_root = 'E:\\OPL-VMs';
  assert.equal(validate(eRoot), false);

  const escaped = structuredClone(v6);
  escaped.exclusive_paths.vhdx = 'C:\\outside\\OPL-V6-WSL2-01.vhdx';
  assert.equal(validate(escaped), false);

  const wrongOwner = structuredClone(v6);
  wrongOwner.execution_owner_thread = '019f972b-f550-7961-90be-9873600cd895';
  assert.equal(validate(wrongOwner), false);

  const crossTargetPaths = structuredClone(v6);
  crossTargetPaths.exclusive_paths = structuredClone(webui.exclusive_paths);
  assert.equal(validate(crossTargetPaths), false);

  const crossTargetNetwork = structuredClone(v6);
  crossTargetNetwork.network = structuredClone(webui.network);
  assert.equal(validate(crossTargetNetwork), false);

  const wrongNextOwner = structuredClone(v6);
  wrongNextOwner.lease_transition.next_owner_thread = webui.execution_owner_thread;
  assert.equal(validate(wrongNextOwner), false);
});

test('post-resize factory gate accepts exact C capacity, zh-CN ISO, cutover and script hashes', () => {
  const validate = compile(gateSchemaPath);
  const gate = makeFactoryGate();
  assert.equal(validate(gate), true, JSON.stringify(validate.errors));
  const stale = structuredClone(gate);
  stale.iso.path = stale.iso.path.replace('C:\\OPL-VMs', 'E:\\OPL-VMs');
  assert.equal(validate(stale), false);

  const staleRecoverySource = structuredClone(gate);
  staleRecoverySource.cutover.source_root = 'E:\\OPL-VMs';
  assert.equal(validate(staleRecoverySource), false);

  const prematureTerminal = structuredClone(gate);
  prematureTerminal.stage = 'terminal_closeout';
  assert.equal(validate(prematureTerminal), false);

  const terminal = structuredClone(gate);
  terminal.stage = 'terminal_closeout';
  terminal.vms = [
    makeVmIdentity('OPL-V6-WSL2-01'),
    makeVmIdentity('OPL-WEBUI-CLEAN-01'),
  ];
  terminal.v6_writer_lease = makeWriterLeaseSummary();
  terminal.source_integration.task_worktree_removed = true;
  terminal.source_integration.local_task_branch_removed = true;
  terminal.source_integration.remote_task_branch_removed = true;
  terminal.source_integration.remaining_source_cleanup_count = 0;
  assert.equal(validate(terminal), true, JSON.stringify(validate.errors));
});

test('platform lease schema is strict and contains no E-root admission path', () => {
  const schema = JSON.parse(fs.readFileSync(leaseSchemaPath, 'utf8'));
  const cleanAttestationSchema = JSON.parse(
    fs.readFileSync(cleanAttestationSchemaPath, 'utf8'),
  );
  assert.equal(schema.additionalProperties, false);
  assert.equal(cleanAttestationSchema.additionalProperties, false);
  assert.equal(schema.properties.factory_root.const, 'C:\\OPL-VMs');
  assert.doesNotMatch(fs.readFileSync(leaseSchemaPath, 'utf8'), /E:\\\\OPL-VMs/);
  assert.doesNotMatch(
    fs.readFileSync(cleanAttestationSchemaPath, 'utf8'),
    /E:\\\\OPL-VMs/,
  );
});

test('clean attestation and platform lease validate exact C-root identities', () => {
  const validateAttestation = compile(cleanAttestationSchemaPath);
  const validateLease = compile(leaseSchemaPath);
  const attestation = makeCleanAttestation('OPL-V6-WSL2-01');
  const lease = makePlatformLease('OPL-V6-WSL2-01');
  const webuiAttestation = makeCleanAttestation('OPL-WEBUI-CLEAN-01');
  const webuiLease = makePlatformLease('OPL-WEBUI-CLEAN-01');
  assert.equal(
    validateAttestation(attestation),
    true,
    JSON.stringify(validateAttestation.errors),
  );
  assert.equal(validateLease(lease), true, JSON.stringify(validateLease.errors));
  assert.equal(
    validateAttestation(webuiAttestation),
    true,
    JSON.stringify(validateAttestation.errors),
  );
  assert.equal(validateLease(webuiLease), true, JSON.stringify(validateLease.errors));

  const stale = structuredClone(attestation);
  stale.active_vhdx_path = stale.active_vhdx_path.replace(
    'C:\\OPL-VMs',
    'E:\\OPL-VMs',
  );
  assert.equal(validateAttestation(stale), false);

  const crossTargetAttestation = structuredClone(attestation);
  crossTargetAttestation.config_path = webuiAttestation.config_path;
  crossTargetAttestation.active_vhdx_path = webuiAttestation.active_vhdx_path;
  crossTargetAttestation.vhdx_chain = structuredClone(webuiAttestation.vhdx_chain);
  crossTargetAttestation.network = structuredClone(webuiAttestation.network);
  crossTargetAttestation.clean_user_receipt_path = webuiAttestation.clean_user_receipt_path;
  crossTargetAttestation.request_path = webuiAttestation.request_path;
  crossTargetAttestation.network_receipt_path = webuiAttestation.network_receipt_path;
  assert.equal(validateAttestation(crossTargetAttestation), false);

  const crossTargetLease = structuredClone(lease);
  crossTargetLease.config_path = webuiLease.config_path;
  crossTargetLease.active_vhdx_path = webuiLease.active_vhdx_path;
  crossTargetLease.vhdx_chain = structuredClone(webuiLease.vhdx_chain);
  crossTargetLease.network = structuredClone(webuiLease.network);
  crossTargetLease.exclusive_paths = structuredClone(webuiLease.exclusive_paths);
  crossTargetLease.receipt_namespace = webuiLease.receipt_namespace;
  crossTargetLease.clean_vm_attestation.path = webuiLease.clean_vm_attestation.path;
  assert.equal(validateLease(crossTargetLease), false);
});

test('canonical host scripts bind C-root and contain no E-volume receipt fallback', () => {
  for (const scriptName of [
    'Test-OPLHyperVStorageCompatibility.ps1',
    'New-OPLWindows11VM.ps1',
    'New-OPLVMIsolatedNetwork.ps1',
    'Seal-OPLCleanWindowsBaseline.ps1',
    'Grant-OPLVMLease.ps1',
    'Grant-OPLV6WriterLease.ps1',
  ]) {
    const script = fs.readFileSync(
      path.join(platformRoot, 'fixtures', scriptName),
      'utf8',
    );
    assert.ok(script.includes("$canonicalRoot = 'C:\\OPL-VMs'"), scriptName);
    assert.doesNotMatch(script, /E:\\OPL-VMs/, scriptName);
    assert.doesNotMatch(script, /Get-Volume -DriveLetter E/, scriptName);
  }
  for (const scriptName of [
    'New-OPLWindows11VM.ps1',
    'New-OPLVMIsolatedNetwork.ps1',
    'Seal-OPLCleanWindowsBaseline.ps1',
    'Grant-OPLVMLease.ps1',
  ]) {
    const script = fs.readFileSync(
      path.join(platformRoot, 'fixtures', scriptName),
      'utf8',
    );
    assert.match(script, /exact target VM namespace|exact C-root VM namespace/, scriptName);
  }
});

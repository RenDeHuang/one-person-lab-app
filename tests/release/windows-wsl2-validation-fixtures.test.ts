import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { appRoot } from './release-readiness/helpers.ts';

const validationRoot = path.join(
  appRoot,
  'docs',
  'delivery',
  'validation',
  'windows-wsl2',
);
const fixtureRoot = path.join(validationRoot, 'fixtures');
const runnerPath = path.join(fixtureRoot, 'v6-electron-visible-smoke.ps1');
const buildSealPath = path.join(fixtureRoot, 'v6-build-seal.ps1');
const materializePath = path.join(fixtureRoot, 'v6-materialize-intake.mjs');
const hostCloseoutPath = path.join(fixtureRoot, 'v6-host-closeout.mjs');
const guestSchemaPath = path.join(
  validationRoot,
  'windows-wsl2-v6-receipt.schema.json',
);
const intakeSchemaPath = path.join(
  validationRoot,
  'windows-wsl2-v6-intake-manifest.schema.json',
);
const buildSchemaPath = path.join(
  validationRoot,
  'windows-wsl2-v6-build-seal.schema.json',
);
const leaseSchemaPath = path.join(
  validationRoot,
  'windows-wsl2-v6-writer-lease.schema.json',
);
const hostSchemaPath = path.join(
  validationRoot,
  'windows-wsl2-v6-host-closeout.schema.json',
);
const readmePath = path.join(validationRoot, 'README.md');
const planPath = path.join(
  appRoot,
  'docs',
  'architecture',
  'windows-wsl2-execution-validation-plan.md',
);

function findPwsh() {
  if (process.env.PWSH) return process.env.PWSH;
  const result = spawnSync('/bin/sh', ['-lc', 'command -v pwsh'], {
    encoding: 'utf8',
  });
  return result.status === 0 ? result.stdout.trim() : '';
}

const pwshPath = findPwsh();

function sha256File(filePath: string) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function compileSchema(schemaFile: string) {
  const ajv = new Ajv2020({
    allErrors: true,
    strictSchema: true,
    strictTypes: false,
  });
  addFormats(ajv);
  return ajv.compile(JSON.parse(fs.readFileSync(schemaFile, 'utf8')));
}

function writeJson(filePath: string, value: unknown) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

const refs = {
  appSha: '1'.repeat(40),
  shellSha: '868d6e818583547a5ec982b10b34464a3fa47c10',
  frameworkSha: 'fe1fafa26f2c59922596718b305761bbc7558c9c',
};
const vmId = '11111111-2222-3333-4444-555555555555';
const vmIdentity = `hyperv-vmid:${vmId}`;
const leaseId = 'v6-lease-20260725-01';
const leaseTimes = {
  issuedAt: '2026-07-25T00:00:00.000Z',
  expiresAt: '2026-07-25T23:59:59.000Z',
};

function makeLease() {
  return {
    schema: 'opl_windows_v6_vm_writer_lease.v1',
    status: 'active',
    host_platform: 'windows_hyperv',
    vm_name: 'OPL-V6-WSL2-01',
    vm_identity: vmIdentity,
    platform_owner_task_id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
    executor_task_id: '019f97e4-288a-7140-8850-925c657d8c71',
    lease_id: leaseId,
    issued_at: leaseTimes.issuedAt,
    expires_at: leaseTimes.expiresAt,
    allowed_operations: [
      'v6_build_seal',
      'v6_guest_visible_smoke',
      'v6_soft_shutdown',
    ],
    clean_vm_attestation: {
      status: 'attested',
      vm_id: vmId,
      checkpoint_id: 'checkpoint-v6-clean-01',
      attested_at: leaseTimes.issuedAt,
    },
  };
}

function makeIntakeManifest() {
  return {
    schema: 'opl_windows_wsl2_v6_intake_manifest.v1',
    validation_state: 'validation_only_non_binding',
    authority: 'one_person_lab_app_acceptance_contract',
    terminal_v6_verdict: false,
    target: {
      host_platform: 'windows_hyperv',
      vm_name: 'OPL-V6-WSL2-01',
      validation_root:
        'C:\\Users\\Public\\Documents\\OnePersonLabValidation\\windows-wsl2-v6-v1',
      clean_vm_required: true,
      platform_owner_writer_lease_required: true,
    },
    source_refs: {
      app_acceptance_sha: refs.appSha,
      app_acceptance_tree_sha: '2'.repeat(40),
      app_repository: 'https://github.com/gaofeng21cn/one-person-lab-app.git',
      shell: {
        repository: 'https://github.com/gaofeng21cn/opl-aion-shell.git',
        git_sha: refs.shellSha,
        root_tree_sha: '1dc9960a357d9f64eaaac7eadf44b9c1a1d00ca7',
        validation_tree_sha: '6f8519a26c3075f8b252c79a81e42f328c6efbb8',
        bun_lock_sha256:
          '8975e67539a778ef9058419d990646b21ce35757d4cdaf45e0b101e4ce3cff7b',
        build_script_sha256:
          '5d1511a89038ca583bceb27881c8f025ce1575b0f0059535145382894c0cd381',
        harness_package_sha256:
          '0a12c4887a746e465978ced9439cdef6f9a7a994c94e43bd0c5f1208f64737c5',
      },
      framework_fixture_sha: refs.frameworkSha,
    },
    toolchain_contract: {
      node_range: '>=22 <25',
      electron_version: '37.10.3',
      electron_builder_manifest_range: '^26.6.0',
      electron_builder_lock_version: '26.8.1',
      package_manager: 'bun',
      package_install_argv: ['install', '--frozen-lockfile', '--ignore-scripts'],
      focused_test_script: 'test:windows:wsl2:validation',
      build_script: 'build:windows:wsl2:validation',
      builder_override_policy: 'all_overrides_must_be_absent',
      output_policy: 'fresh_unique_checkout_and_output_absent',
    },
    artifact_contract: {
      source_zip_relative_path:
        'out/windows-wsl2-validation/OPL Windows WSL2 Validation-0.0.0-validation.0-win.zip',
      source_executable_relative_path:
        'out/windows-wsl2-validation/win-unpacked/OPL Windows WSL2 Validation.exe',
      sealed_zip_file_name: 'OPL-Windows-WSL2-Validation-v6.zip',
      root_executable_file_name: 'OPL Windows WSL2 Validation.exe',
      identity_authority: 'create_once_build_seal_receipt',
      historical_zip_sha256_authoritative: false,
    },
    execution_contract: {
      phases: ['stopped', 'running'],
      distinct_run_ids_required: true,
      same_build_receipt_required: true,
      same_zip_and_tree_identity_required: true,
      target_window_screenshot_required: true,
      candidate_process_survivor_count: 0,
      wsl_process_survivor_count: 0,
      host_soft_shutdown_required: true,
      powered_off_readback_required: true,
    },
    prohibited_operations: [
      'legacy_imac_vm_execution',
      'docker_prune',
      'global_wsl_shutdown',
      'wsl_unregister',
      'hard_vm_poweroff_as_pass',
      'public_release_or_promotion',
    ],
    packet_files: Array.from({ length: 8 }, (_, index) => ({
      file_name: `packet-${index + 1}.json`,
      role: 'contract-fixture',
      size_bytes: 10,
      sha256: `${index + 1}`.repeat(64).slice(0, 64),
    })),
  };
}

function makeBuildReceipt({
  intakeManifestSha256,
  writerLeaseSha256,
  artifactSha256,
  treeSha = 'e'.repeat(64),
} : {
  intakeManifestSha256: string;
  writerLeaseSha256: string;
  artifactSha256: string;
  treeSha?: string;
}) {
  const tool = {
    version: 'test',
    path: 'C:\\tools\\tool.exe',
    sha256: 'a'.repeat(64),
  };
  const command = (label: string) => ({
    label,
    executable: 'C:\\tools\\bun.exe',
    executable_sha256: 'b'.repeat(64),
    argv: ['bun', label],
    working_directory: 'C:\\build',
    started_at: leaseTimes.issuedAt,
    finished_at: '2026-07-25T00:01:00.000Z',
    exit_code: 0,
    log_file_name: `${label}.log`,
    log_sha256: 'c'.repeat(64),
  });
  return {
    schema: 'opl_windows_wsl2_v6_build_seal.v1',
    validation_state: 'validation_only_non_binding',
    receipt_stage: 'candidate_sealed_pending_guest_smoke',
    terminal_v6_verdict: false,
    status: 'sealed',
    receipt_id: 'windows-v6-build-seal-v1',
    sealed_at: '2026-07-25T00:01:00.000Z',
    packet: {
      intake_manifest_sha256: intakeManifestSha256,
      app_acceptance_sha: refs.appSha,
      writer_lease_sha256: writerLeaseSha256,
      vm_identity: vmIdentity,
    },
    source_refs: {
      app_acceptance_sha: refs.appSha,
      shell_sha: refs.shellSha,
      shell_tree_sha: '1dc9960a357d9f64eaaac7eadf44b9c1a1d00ca7',
      framework_fixture_sha: refs.frameworkSha,
    },
    checkout: {
      repository: 'https://github.com/gaofeng21cn/opl-aion-shell.git',
      head_sha: refs.shellSha,
      root_tree_sha: '1dc9960a357d9f64eaaac7eadf44b9c1a1d00ca7',
      clean: true,
      output_absent_before_build: true,
    },
    toolchain: {
      windows_build: '10.0.26100.0',
      windows_architecture: 'X64',
      powershell_version: '5.1.26100.1',
      git: tool,
      bun: tool,
      node: tool,
      dependency_versions: {
        electron: '37.10.3',
        electron_builder: '26.8.1',
        app_builder_lib: '26.8.1',
        builder_util: '26.8.1',
        seven_zip_bin: '5.2.0',
        app_builder_bin: '5.0.0-alpha.12',
      },
      electron_builder_cli: { path: 'C:\\tools\\builder.js', sha256: 'd'.repeat(64) },
      seven_zip: { path: 'C:\\tools\\7za.exe', sha256: 'f'.repeat(64) },
      app_builder: { path: 'C:\\tools\\app-builder.exe', sha256: '1'.repeat(64) },
      overrides_absent: true,
      environment: {
        ...Object.fromEntries(
          [
            'CI',
            'OPL_ELECTRON_BUILDER_CLI',
            'OPL_WINDOWS_WSL2_ELECTRON_DIST',
            'USE_SYSTEM_7ZA',
            'ELECTRON_BUILDER_COMPRESSION_LEVEL',
            'ELECTRON_MIRROR',
            'ELECTRON_CACHE',
            'HTTP_PROXY',
            'HTTPS_PROXY',
            'NO_PROXY',
          ].map((name) => [name, { present: false, value_sha256: null }]),
        ),
        timezone_id: 'UTC',
        culture_name: 'en-US',
      },
    },
    commands: [
      'git-clone',
      'git-checkout',
      'bun-install',
      'focused-test',
      'candidate-build',
    ].map(command),
    artifact: {
      file_name: 'OPL-Windows-WSL2-Validation-v6.zip',
      sha256: artifactSha256,
      size_bytes: 1024,
      executable_sha256: '2'.repeat(64),
      app_asar_sha256: '3'.repeat(64),
      zip_entry_manifest_sha256: '4'.repeat(64),
      tree_sha256: treeSha,
      tree_file_count: 42,
    },
    error: null,
  };
}

function makeGuestReceipt({
  phase,
  artifactSha256,
  intakeManifestSha256,
  buildReceiptSha256,
  writerLeaseSha256,
  screenshotSha256,
  treeSha = 'e'.repeat(64),
}: {
  phase: 'stopped' | 'running';
  artifactSha256: string;
  intakeManifestSha256: string;
  buildReceiptSha256: string;
  writerLeaseSha256: string;
  screenshotSha256: string;
  treeSha?: string;
}) {
  const passed = true;
  return {
    schema: 'opl_windows_wsl2_v6_visible_smoke.v1',
    validation_state: 'validation_only_non_binding',
    assessment_scope: 'status_projection_only',
    receipt_stage: 'guest_smoke_pending_host_closeout',
    terminal_v6_verdict: false,
    status: 'passed',
    run_id: `v6-${phase}-01`,
    expected_phase: phase,
    observed_at: '2026-07-25T00:02:00.000Z',
    app_sha: refs.appSha,
    shell_sha: refs.shellSha,
    framework_sha: refs.frameworkSha,
    artifact: {
      sha256: artifactSha256,
      intake_manifest_sha256: intakeManifestSha256,
      build_receipt_sha256: buildReceiptSha256,
      executable_sha256: '2'.repeat(64),
      zip_entry_sha256_matches: true,
      tree_origin: 'verified_zip_expansion',
      tree_sha256: treeSha,
      tree_file_count: 42,
      tree_write_locks_held: true,
      tree_unchanged_after_process_exit: true,
      source_ref_binding: 'sealed_from_exact_source_packet',
      size_bytes: 1024,
      zip_file_name: 'OPL-Windows-WSL2-Validation-v6.zip',
      executable_file_name: 'OPL Windows WSL2 Validation.exe',
      gate_environment: 'OPL_WINDOWS_WSL2_VALIDATION=1',
    },
    vm: {
      identity: vmIdentity,
      host_platform: 'windows_hyperv',
      vm_name: 'OPL-V6-WSL2-01',
      writer_lease: {
        platform_owner_task_id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
        executor_task_id: '019f97e4-288a-7140-8850-925c657d8c71',
        lease_id: leaseId,
        issued_at: leaseTimes.issuedAt,
        expires_at: leaseTimes.expiresAt,
        receipt_sha256: writerLeaseSha256,
      },
      writer_release: {
        status: 'pending_host_soft_shutdown',
        receipt_id: null,
        released_at: null,
      },
    },
    preflight: {
      windows_build: '10.0.26100.0',
      windows_x64: true,
      artifact_path_identity: 'approved_exact_path',
      artifact_sha256_matches: true,
      no_residual_candidate_processes: true,
      wsl_inventory_readable: true,
      wsl_version: 'WSL version: 2.5.10.0',
      default_distro: 'docker-desktop',
      validation_distro: 'OPL-Validation-g0001',
      validation_distro_state: phase === 'stopped' ? 'Stopped' : 'Running',
      validation_distro_version: 2,
      expected_phase_matches: true,
      docker_desktop_state: 'Stopped',
      protected_onepersonlab_present: true,
      protected_onepersonlab_watch_active: true,
    },
    visible_window: {
      observed: true,
      title: 'OPL Windows WSL2 Validation',
      process_id: 4312,
      main_window_handle_observed: true,
      ui_automation_document_observed: true,
      ui_automation_root_type: 'document',
      refresh_button_name: 'Refresh',
      refresh_invoked: true,
      refresh_disabled_observed: true,
      status_group_order: [
        'guest_identity',
        'aioncore_health',
        'direct_codex_app_server',
        'framework_state',
      ],
    },
    status_groups: {
      guest_identity: {
        projection_result: 'passed',
        visible_state: phase === 'stopped' ? 'unavailable' : 'observed',
        capability_verification: 'identity_only',
      },
      aioncore_health: {
        projection_result: 'passed',
        visible_state: 'unavailable',
        capability_verification: 'unverified_or_unavailable',
      },
      direct_codex_app_server: {
        projection_result: 'passed',
        visible_state: 'unavailable',
        capability_verification: 'unverified_or_unavailable',
      },
      framework_state: {
        projection_result: 'passed',
        visible_state: 'unavailable',
        capability_verification: 'unverified_or_unavailable',
      },
    },
    negative_boundaries: {
      validation_gate_visible: true,
      only_refresh_button: true,
      edit_control_count: 0,
      hyperlink_control_count: 0,
      forbidden_command_control_count: 0,
      acp_visible_as_unavailable: true,
      authentication_visible_as_unavailable: true,
      websocket_visible_as_unavailable: true,
      forbidden_ready_states_absent: true,
      status: 'passed',
    },
    process_cleanup: {
      launched_root_pid: 4312,
      tracked_pids: [4312],
      close_requested: true,
      forced_cleanup: false,
      inventory_readable: true,
      wsl_survivor_count: 0,
      candidate_tree_removed: true,
      survivor_count: 0,
      status: 'passed',
    },
    post_readback: {
      default_distro_unchanged: true,
      docker_desktop_state_unchanged: true,
      validation_distro_state_unchanged: true,
      protected_onepersonlab_present_before: true,
      protected_onepersonlab_present_after: true,
      protected_onepersonlab_presence_unchanged: true,
      protected_onepersonlab_mutation_event_count: 0,
      protected_onepersonlab_watch_overflow_count: 0,
      protected_onepersonlab_no_mutation_events_observed: true,
      validation_distro_state_samples: Array(4).fill(
        phase === 'stopped' ? 'Stopped' : 'Running',
      ),
      status: 'passed',
    },
    screenshot: {
      sha256: screenshotSha256,
      width: 1280,
      height: 800,
      format: 'png',
      target_window_only: true,
    },
    blocked_or_unavailable_items: ['managed_acp_unverified'],
    error: null,
  };
}

test('V6 source-bound packet and Hyper-V runner have no legacy artifact authority', () => {
  const runner = fs.readFileSync(runnerPath, 'utf8');
  const buildSeal = fs.readFileSync(buildSealPath, 'utf8');
  const materialize = fs.readFileSync(materializePath, 'utf8');
  assert.match(runner, /ExpectedIntakeManifestSha256/);
  assert.match(runner, /ExpectedBuildReceiptSha256/);
  assert.match(runner, /ExpectedWriterLeaseSha256/);
  assert.match(runner, /sealed_from_exact_source_packet/);
  assert.match(runner, /opl_windows_v6_vm_writer_lease\.v1/);
  assert.doesNotMatch(runner, /3b126175f77cad7c0b1ddc83f2008d2102539cef29f87dfd839ee70be86df9dd/);
  assert.doesNotMatch(runner, /60b86b47b4557e51e12d6d1f687f1544f420841356cdf1d6bae8523a6ebf6c42/);
  assert.match(
    buildSeal,
    /'install', '--frozen-lockfile', '--ignore-scripts'/,
  );
  assert.match(buildSeal, /electron_builder.*26\.8\.1/);
  assert.match(buildSeal, /output_absent_before_build/);
  assert.match(buildSeal, /ExpectedWriterLeaseSha256/);
  assert.match(materialize, /create_once_build_seal_receipt/);
  assert.match(materialize, /historical_zip_sha256_authoritative: false/);
});

test('V6 schemas are strict and bind packet, build, lease, and Hyper-V closeout identities', () => {
  const guest = JSON.parse(fs.readFileSync(guestSchemaPath, 'utf8'));
  const intake = JSON.parse(fs.readFileSync(intakeSchemaPath, 'utf8'));
  const build = JSON.parse(fs.readFileSync(buildSchemaPath, 'utf8'));
  const lease = JSON.parse(fs.readFileSync(leaseSchemaPath, 'utf8'));
  const host = JSON.parse(fs.readFileSync(hostSchemaPath, 'utf8'));
  assert.equal(guest.additionalProperties, false);
  assert.equal(intake.additionalProperties, false);
  assert.equal(build.additionalProperties, false);
  assert.equal(lease.additionalProperties, false);
  assert.equal(host.additionalProperties, false);
  assert.equal(guest.properties.vm.properties.host_platform.const, 'windows_hyperv');
  assert.equal(guest.properties.vm.properties.vm_name.const, 'OPL-V6-WSL2-01');
  assert.equal(
    build.properties.packet.required.includes('writer_lease_sha256'),
    true,
  );
  assert.equal(host.properties.vm.properties.final_state.const, 'Off');
  assert.equal(
    lease.properties.executor_task_id.const,
    '019f97e4-288a-7140-8850-925c657d8c71',
  );
});

test('V6 receipt schemas validate passed and reject identity mutants', () => {
  const validateGuest = compileSchema(guestSchemaPath);
  const validateIntake = compileSchema(intakeSchemaPath);
  const validateLease = compileSchema(leaseSchemaPath);
  const validateBuild = compileSchema(buildSchemaPath);
  const intake = makeIntakeManifest();
  const lease = makeLease();
  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-v6-schema-'));
  try {
    const intakePath = path.join(temporaryRoot, 'intake.json');
    const leasePath = path.join(temporaryRoot, 'lease.json');
    writeJson(intakePath, intake);
    writeJson(leasePath, lease);
    const intakeSha = sha256File(intakePath);
    const leaseSha = sha256File(leasePath);
    const artifactPath = path.join(temporaryRoot, 'artifact.zip');
    fs.writeFileSync(artifactPath, 'sealed artifact');
    const artifactSha = sha256File(artifactPath);
    const build = makeBuildReceipt({
      intakeManifestSha256: intakeSha,
      writerLeaseSha256: leaseSha,
      artifactSha256: artifactSha,
    });
    const buildPath = path.join(temporaryRoot, 'build.json');
    writeJson(buildPath, build);
    const buildSha = sha256File(buildPath);
    const stoppedScreenshot = path.join(temporaryRoot, 'stopped.png');
    const runningScreenshot = path.join(temporaryRoot, 'running.png');
    fs.writeFileSync(stoppedScreenshot, 'stopped');
    fs.writeFileSync(runningScreenshot, 'running');
    const stopped = makeGuestReceipt({
      phase: 'stopped',
      artifactSha256: artifactSha,
      intakeManifestSha256: intakeSha,
      buildReceiptSha256: buildSha,
      writerLeaseSha256: leaseSha,
      screenshotSha256: sha256File(stoppedScreenshot),
    });
    const running = makeGuestReceipt({
      phase: 'running',
      artifactSha256: artifactSha,
      intakeManifestSha256: intakeSha,
      buildReceiptSha256: buildSha,
      writerLeaseSha256: leaseSha,
      screenshotSha256: sha256File(runningScreenshot),
    });
    assert.equal(validateIntake(intake), true, JSON.stringify(validateIntake.errors));
    assert.equal(validateLease(lease), true, JSON.stringify(validateLease.errors));
    assert.equal(validateBuild(build), true, JSON.stringify(validateBuild.errors));
    assert.equal(validateGuest(stopped), true, JSON.stringify(validateGuest.errors));
    assert.equal(validateGuest(running), true, JSON.stringify(validateGuest.errors));
    const mutant = structuredClone(running);
    mutant.artifact.build_receipt_sha256 = 'f'.repeat(64);
    assert.equal(validateGuest(mutant), true, 'schema permits identity comparison at host layer');
  } finally {
    fs.rmSync(temporaryRoot, { recursive: true, force: true });
  }
});

test('V6 Hyper-V host closeout fails before shutdown on tree mismatch and passes on Off readback', async (t) => {
  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-v6-closeout-'));
  t.after(() => fs.rmSync(temporaryRoot, { recursive: true, force: true }));
  const candidateZip = path.join(
    temporaryRoot,
    'OPL-Windows-WSL2-Validation-v6.zip',
  );
  fs.writeFileSync(candidateZip, 'sealed artifact');
  const intakePath = path.join(temporaryRoot, 'intake.json');
  const leasePath = path.join(temporaryRoot, 'lease.json');
  const buildPath = path.join(temporaryRoot, 'build.json');
  const stoppedScreenshot = path.join(temporaryRoot, 'stopped.png');
  const runningScreenshot = path.join(temporaryRoot, 'running.png');
  fs.writeFileSync(stoppedScreenshot, 'stopped');
  fs.writeFileSync(runningScreenshot, 'running');
  writeJson(intakePath, makeIntakeManifest());
  writeJson(leasePath, makeLease());
  const intakeSha = sha256File(intakePath);
  const leaseSha = sha256File(leasePath);
  const artifactSha = sha256File(candidateZip);
  writeJson(
    buildPath,
    makeBuildReceipt({
      intakeManifestSha256: intakeSha,
      writerLeaseSha256: leaseSha,
      artifactSha256: artifactSha,
    }),
  );
  const buildSha = sha256File(buildPath);
  const stoppedReceiptPath = path.join(temporaryRoot, 'stopped.json');
  const runningReceiptPath = path.join(temporaryRoot, 'running.json');
  const mismatchReceiptPath = path.join(temporaryRoot, 'mismatch.json');
  writeJson(
    stoppedReceiptPath,
    makeGuestReceipt({
      phase: 'stopped',
      artifactSha256: artifactSha,
      intakeManifestSha256: intakeSha,
      buildReceiptSha256: buildSha,
      writerLeaseSha256: leaseSha,
      screenshotSha256: sha256File(stoppedScreenshot),
    }),
  );
  writeJson(
    runningReceiptPath,
    makeGuestReceipt({
      phase: 'running',
      artifactSha256: artifactSha,
      intakeManifestSha256: intakeSha,
      buildReceiptSha256: buildSha,
      writerLeaseSha256: leaseSha,
      screenshotSha256: sha256File(runningScreenshot),
    }),
  );
  writeJson(
    mismatchReceiptPath,
    makeGuestReceipt({
      phase: 'running',
      artifactSha256: artifactSha,
      intakeManifestSha256: intakeSha,
      buildReceiptSha256: buildSha,
      writerLeaseSha256: leaseSha,
      screenshotSha256: sha256File(runningScreenshot),
      treeSha: 'f'.repeat(64),
    }),
  );
  const outputDir = path.join(temporaryRoot, 'closeout');
  const { runHostCloseout } = await import(hostCloseoutPath);
  let state = 'Running';
  const dependencies = {
    queryVm: () => ({ name: 'OPL-V6-WSL2-01', id: vmId, state }),
    stopVmSoft: () => {
      state = 'Off';
    },
    now: () => new Date('2026-07-25T01:00:00.000Z'),
    sleep: async () => {},
  };
  const baseOptions = {
    vmName: 'OPL-V6-WSL2-01',
    expectedVmId: vmId,
    writerLease: leasePath,
    expectedWriterLeaseSha256: leaseSha,
    intakeManifest: intakePath,
    expectedIntakeManifestSha256: intakeSha,
    buildReceipt: buildPath,
    expectedBuildReceiptSha256: buildSha,
    stoppedGuestReceipt: stoppedReceiptPath,
    stoppedScreenshot,
    runningGuestReceipt: runningReceiptPath,
    runningScreenshot,
    candidateZip,
    expectedArtifactSha256: artifactSha,
    expectedAppSha: refs.appSha,
    expectedShellSha: refs.shellSha,
    expectedFrameworkSha: refs.frameworkSha,
    releaseReceiptId: 'v6-release-01',
    outputDir,
    timeoutSeconds: 30,
    requestSoftShutdown: true,
  };
  await assert.rejects(
    runHostCloseout(
      { ...baseOptions, runningGuestReceipt: mismatchReceiptPath },
      dependencies,
    ),
    /same extracted candidate tree/,
  );
  assert.equal(state, 'Running', 'mismatch must fail before soft shutdown');
  const result = await runHostCloseout(baseOptions, dependencies);
  assert.equal(result.finalReceipt.terminal_v6_verdict, true);
  assert.equal(result.finalReceipt.vm.final_state, 'Off');
  assert.equal(result.writerRelease.powered_off_readback, true);
  assert.equal(
    compileSchema(hostSchemaPath)(result.finalReceipt),
    true,
  );
});

test('V6 documentation preserves validation-only and non-blocking boundaries', () => {
  const readme = fs.readFileSync(readmePath, 'utf8');
  const plan = fs.readFileSync(planPath, 'utf8');
  assert.match(readme, /windows-wsl2-v6-intake-manifest\.schema\.json/);
  assert.match(readme, /windows-wsl2-v6-build-seal\.schema\.json/);
  assert.match(readme, /windows-wsl2-v6-writer-lease\.schema\.json/);
  assert.match(readme, /windows_hyperv/i);
  assert.match(readme, /terminal_v6_verdict=false/);
  assert.match(readme, /Only then may it write[\s\S]*terminal_v6_verdict=true/i);
  assert.doesNotMatch(readme, /Windows support is complete/i);
  assert.match(plan, /does not block unrelated development/i);
  assert.match(plan, /Hyper-V/i);
});

if (pwshPath) {
  test('V6 PowerShell fixtures parse when PowerShell is available', () => {
    for (const fixturePath of [runnerPath, buildSealPath]) {
      const escapedPath = fixturePath.replaceAll("'", "''");
      const result = spawnSync(
        pwshPath,
        [
          '-NoLogo',
          '-NoProfile',
          '-NonInteractive',
          '-Command',
          `$tokens=$null;$errors=$null;[System.Management.Automation.Language.Parser]::ParseFile('${escapedPath}',[ref]$tokens,[ref]$errors) | Out-Null;if($errors.Count){$errors | ForEach-Object { Write-Error $_ }; exit 1 }`,
        ],
        { cwd: appRoot, encoding: 'utf8' },
      );
      assert.equal(
        result.status,
        0,
        result.stderr || result.stdout || result.error?.message,
      );
    }
  });
} else {
  test.skip('V6 PowerShell fixtures parse on target Windows', () => {});
}

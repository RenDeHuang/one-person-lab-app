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
const schemaPath = path.join(validationRoot, 'windows-wsl2-v6-receipt.schema.json');
const hostSchemaPath = path.join(
  validationRoot,
  'windows-wsl2-v6-host-closeout.schema.json',
);
const hostCloseoutPath = path.join(fixtureRoot, 'v6-host-closeout.mjs');
const readmePath = path.join(validationRoot, 'README.md');
const planPath = path.join(
  appRoot,
  'docs',
  'architecture',
  'windows-wsl2-execution-validation-plan.md',
);
const pwshPath = findPwsh();

function findPwsh() {
  if (process.env.PWSH) {
    return process.env.PWSH;
  }
  const result = spawnSync('/bin/sh', ['-lc', 'command -v pwsh'], {
    encoding: 'utf8',
  });
  return result.status === 0 ? result.stdout.trim() : '';
}

function sha256File(filePath: string) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function makeGuestReceipt({
  phase = 'running',
  status = 'passed',
  runId = `v6-${phase}`,
  artifactSha = 'a'.repeat(64),
  handoffSha = 'b'.repeat(64),
  screenshotSha = 'c'.repeat(64),
  appSha = '1'.repeat(40),
  shellSha = '2'.repeat(40),
  frameworkSha = '3'.repeat(40),
  vmIdentity = `vmware-bios:${'4'.repeat(32)}`,
} = {}) {
  const passed = status === 'passed';
  const blocked = status === 'blocked';
  const guestState = phase === 'stopped' ? 'unavailable' : 'observed';
  const receipt: any = {
    schema: 'opl_windows_wsl2_v6_visible_smoke.v1',
    validation_state: 'validation_only_non_binding',
    assessment_scope: 'status_projection_only',
    receipt_stage: 'guest_smoke_pending_host_closeout',
    terminal_v6_verdict: false,
    status,
    run_id: runId,
    expected_phase: phase,
    observed_at: '2026-07-25T00:00:00.000Z',
    app_sha: appSha,
    shell_sha: shellSha,
    framework_sha: frameworkSha,
    artifact: {
      sha256: artifactSha,
      executable_sha256: passed ? 'd'.repeat(64) : null,
      zip_entry_sha256_matches: passed,
      tree_origin: passed ? 'verified_zip_expansion' : 'pending',
      source_ref_binding: 'operator_recorded_not_embedded',
      size_bytes: passed ? 1024 : null,
      zip_file_name: 'OPL-Windows-WSL2-Validation-v6.zip',
      executable_file_name: 'OPL Windows WSL2 Validation.exe',
      gate_environment: 'OPL_WINDOWS_WSL2_VALIDATION=1',
    },
    vm: {
      identity: vmIdentity,
      storage_class: 'external_ssd',
      external_ssd: true,
      writer_handoff: {
        previous_owner_task_id: '019f91db-b1d4-7011-9429-6694cf3b3224',
        receipt_id: 'webui-to-v6',
        released_at: '2026-07-25T00:00:00.000Z',
        receipt_sha256: passed ? handoffSha : null,
      },
      writer_release: {
        status: 'pending_host_soft_shutdown',
        receipt_id: null,
        released_at: null,
      },
    },
    preflight: {
      windows_build: '10.0.26100.0',
      windows_x64: passed,
      artifact_path_identity: passed ? 'approved_exact_path' : 'pending',
      artifact_sha256_matches: passed,
      no_residual_candidate_processes: passed,
      wsl_inventory_readable: passed,
      wsl_version: passed ? 'WSL version: 2.5.10.0' : null,
      default_distro: passed ? 'OPL-Validation-g0001' : null,
      validation_distro: 'OPL-Validation-g0001',
      validation_distro_state: passed
        ? phase === 'stopped'
          ? 'Stopped'
          : 'Running'
        : null,
      validation_distro_version: passed ? 2 : null,
      expected_phase_matches: passed,
      docker_desktop_state: passed ? 'Stopped' : null,
      protected_onepersonlab_present: passed,
      protected_onepersonlab_watch_active: passed,
    },
    visible_window: {
      observed: passed,
      title: 'OPL Windows WSL2 Validation',
      process_id: passed ? 4312 : null,
      main_window_handle_observed: passed,
      ui_automation_document_observed: passed,
      ui_automation_root_type: passed ? 'document' : null,
      refresh_button_name: passed ? 'Refresh' : null,
      refresh_invoked: passed,
      refresh_disabled_observed: passed,
      status_group_order: [
        'guest_identity',
        'aioncore_health',
        'direct_codex_app_server',
        'framework_state',
      ],
    },
    status_groups: {
      guest_identity: {
        projection_result: passed ? 'passed' : 'not_observed',
        visible_state: passed ? guestState : null,
        capability_verification: 'identity_only',
      },
      aioncore_health: {
        projection_result: passed ? 'passed' : 'not_observed',
        visible_state: passed ? 'unavailable' : null,
        capability_verification: 'unverified_or_unavailable',
      },
      direct_codex_app_server: {
        projection_result: passed ? 'passed' : 'not_observed',
        visible_state: passed ? 'unavailable' : null,
        capability_verification: 'unverified_or_unavailable',
      },
      framework_state: {
        projection_result: passed ? 'passed' : 'not_observed',
        visible_state: passed ? 'unavailable' : null,
        capability_verification: 'unverified_or_unavailable',
      },
    },
    negative_boundaries: {
      validation_gate_visible: passed,
      only_refresh_button: passed,
      edit_control_count: passed ? 0 : null,
      hyperlink_control_count: passed ? 0 : null,
      forbidden_command_control_count: passed ? 0 : null,
      acp_visible_as_unavailable: passed,
      authentication_visible_as_unavailable: passed,
      websocket_visible_as_unavailable: passed,
      forbidden_ready_states_absent: passed,
      status: passed ? 'passed' : 'not_observed',
    },
    process_cleanup: {
      launched_root_pid: passed ? 4312 : status === 'failed' ? 4312 : null,
      tracked_pids: passed || status === 'failed' ? [4312] : [],
      close_requested: passed,
      forced_cleanup: false,
      inventory_readable: passed,
      wsl_survivor_count: passed ? 0 : null,
      candidate_tree_removed: passed,
      survivor_count: passed ? 0 : null,
      status: passed ? 'passed' : 'not_run',
    },
    post_readback: {
      default_distro_unchanged: passed,
      docker_desktop_state_unchanged: passed,
      validation_distro_state_unchanged: passed,
      protected_onepersonlab_present_before: passed,
      protected_onepersonlab_present_after: passed,
      protected_onepersonlab_presence_unchanged: passed,
      protected_onepersonlab_mutation_event_count: passed ? 0 : null,
      protected_onepersonlab_watch_overflow_count: passed ? 0 : null,
      protected_onepersonlab_no_mutation_events_observed: passed,
      validation_distro_state_samples: passed
        ? Array(4).fill(phase === 'stopped' ? 'Stopped' : 'Running')
        : status === 'failed'
          ? ['Running']
          : [],
      status: passed ? 'passed' : 'not_run',
    },
    screenshot: {
      sha256: passed ? screenshotSha : null,
      width: passed ? 1280 : null,
      height: passed ? 800 : null,
      format: 'png',
      target_window_only: true,
    },
    blocked_or_unavailable_items: ['managed_acp_unverified'],
    error: passed ? null : blocked ? 'preflight blocked' : 'postlaunch failed',
  };
  return receipt;
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

test('V6 Windows Electron smoke runner is exact, visible, and cleanup-bounded', () => {
  const runner = fs.readFileSync(runnerPath, 'utf8');

  assert.match(runner, /OPL_WINDOWS_WSL2_VALIDATION/);
  assert.match(runner, /OPL-Validation-g0001/);
  assert.match(
    runner,
    /C:\\Users\\oplrunner\\OnePersonLabValidation\\20260725-wsl2-v6/,
  );
  assert.match(runner, /ExpectedPhase/);
  assert.match(runner, /ExpectedWriterHandoffSha256/);
  assert.match(
    runner,
    /3b126175f77cad7c0b1ddc83f2008d2102539cef29f87dfd839ee70be86df9dd/,
  );
  assert.match(
    runner,
    /60b86b47b4557e51e12d6d1f687f1544f420841356cdf1d6bae8523a6ebf6c42/,
  );
  assert.match(
    runner,
    /868d6e818583547a5ec982b10b34464a3fa47c10/,
  );
  assert.match(runner, /Get-FileHash -Algorithm SHA256/);
  assert.match(runner, /Get-ZipEntrySha256/);
  assert.match(runner, /zip_entry_sha256_matches/);
  assert.match(runner, /Expand-Archive -LiteralPath \$CandidateZipPath/);
  assert.match(runner, /Start-Process -FilePath \$launchExecutablePath -PassThru/);
  assert.match(runner, /opl_vm_writer_release\.v1/);
  assert.match(runner, /receipt_sha256/);
  assert.match(runner, /MainWindowHandle/);
  assert.match(runner, /UIAutomationClient/);
  assert.match(runner, /ControlType\]::Document/);
  assert.match(runner, /ControlType\.Button/);
  assert.match(runner, /ControlType\.Edit/);
  assert.match(runner, /ControlType\.Hyperlink/);
  assert.match(runner, /InvokePattern/);
  assert.match(runner, /refresh_disabled_observed/);
  assert.match(runner, /FileSystemWatcher/);
  assert.match(runner, /protected_onepersonlab_mutation_event_count/);
  assert.match(runner, /protected_onepersonlab_watch_overflow_count/);
  assert.match(runner, /protected_onepersonlab_no_mutation_events_observed/);
  assert.match(runner, /Status groups are missing or out of the required visible order/);
  assert.match(runner, /GetWindowRect/);
  assert.match(runner, /PrintWindow/);
  assert.doesNotMatch(runner, /CopyFromScreen/);
  assert.match(runner, /taskkill\.exe \/PID \$rootProcess\.Id \/T \/F/);
  assert.match(runner, /Stop-Process -Id \(\[int\]\$row\.ProcessId\) -Force/);
  assert.match(runner, /ParentProcessId/);
  assert.match(runner, /CreationDate/);
  assert.match(runner, /pending_host_soft_shutdown/);
  assert.match(runner, /guest_smoke_pending_host_closeout/);
  assert.match(runner, /terminal_v6_verdict = \$false/);
  assert.match(runner, /validation_only_non_binding/);
  assert.doesNotMatch(runner, /Invoke-Expression/);
  assert.doesNotMatch(runner, /--shutdown/);
  assert.doesNotMatch(runner, /--unregister/);
  assert.doesNotMatch(runner, /\bdocker(?:\.exe)?\s+(?:system\s+)?prune\b/i);
  assert.doesNotMatch(runner, /Remove-Item[\s\S]{0,160}OnePersonLab/i);
  assert.doesNotMatch(
    runner,
    /SetEnvironmentVariable\([^,]+,[^,]+,\s*'(?:User|Machine)'\)/,
  );
});

test('V6 visible-smoke receipt schema is strict and non-binding', () => {
  const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));

  assert.equal(schema.$schema, 'https://json-schema.org/draft/2020-12/schema');
  assert.equal(schema.additionalProperties, false);
  assert.equal(
    schema.properties.schema.const,
    'opl_windows_wsl2_v6_visible_smoke.v1',
  );
  assert.equal(
    schema.properties.validation_state.const,
    'validation_only_non_binding',
  );
  assert.equal(schema.properties.assessment_scope.const, 'status_projection_only');
  assert.equal(
    schema.properties.receipt_stage.const,
    'guest_smoke_pending_host_closeout',
  );
  assert.equal(schema.properties.terminal_v6_verdict.const, false);
  assert.deepEqual(schema.properties.status.enum, ['passed', 'failed', 'blocked']);
  assert.ok(Array.isArray(schema.allOf));
  assert.ok(
    schema.allOf.some(
      (rule: any) =>
        rule.if?.properties?.status?.const === 'passed' &&
        rule.then?.properties?.process_cleanup?.properties?.status?.const ===
          'passed',
    ),
    'passed receipts must be conditionally bound to cleanup and evidence',
  );
  for (const field of [
    'artifact',
    'vm',
    'preflight',
    'visible_window',
    'status_groups',
    'negative_boundaries',
    'process_cleanup',
    'post_readback',
    'screenshot',
    'blocked_or_unavailable_items',
  ]) {
    assert.ok(schema.required.includes(field), `${field} must be required`);
    assert.equal(
      schema.properties[field].additionalProperties ?? false,
      false,
      `${field} must reject unknown fields`,
    );
  }
  assert.equal(
    schema.properties.artifact.properties.gate_environment.const,
    'OPL_WINDOWS_WSL2_VALIDATION=1',
  );
  assert.ok(schema.properties.artifact.required.includes('executable_sha256'));
  assert.ok(
    schema.properties.artifact.required.includes('zip_entry_sha256_matches'),
  );
  assert.deepEqual(
    schema.properties.artifact.properties.tree_origin.enum,
    ['pending', 'verified_zip_expansion'],
  );
  assert.equal(
    schema.properties.artifact.properties.source_ref_binding.const,
    'operator_recorded_not_embedded',
  );
  assert.equal(schema.properties.vm.properties.external_ssd.const, true);
  assert.equal(
    schema.properties.vm.properties.writer_release.properties.status.const,
    'pending_host_soft_shutdown',
  );
  assert.equal(
    schema.properties.vm.properties.writer_release.properties.receipt_id.const,
    null,
  );
  assert.equal(
    schema.properties.vm.properties.writer_release.properties.released_at.const,
    null,
  );
  assert.equal(
    schema.properties.post_readback.properties.validation_distro_state_samples
      .minItems,
    undefined,
  );
  assert.equal(
    schema.properties.preflight.properties.validation_distro.const,
    'OPL-Validation-g0001',
  );
  assert.equal(
    schema.$defs.unverifiedProjection.properties.capability_verification.const,
    'unverified_or_unavailable',
  );
  assert.equal(schema.properties.screenshot.properties.target_window_only.const, true);

  const passedRule = schema.allOf.find(
    (rule: any) => rule.if?.properties?.status?.const === 'passed',
  );
  assert.equal(
    passedRule.then.properties.artifact.properties.tree_origin.const,
    'verified_zip_expansion',
  );
  assert.equal(
    passedRule.then.properties.post_readback.properties
      .validation_distro_state_samples.minItems,
    4,
  );
  assert.equal(
    passedRule.then.properties.post_readback.properties
      .protected_onepersonlab_watch_overflow_count.const,
    0,
  );

  const nonPassingRule = schema.allOf.find((rule: any) =>
    rule.if?.properties?.status?.enum?.includes('failed'),
  );
  assert.equal(nonPassingRule.then.properties.error.type, 'string');
  assert.equal(nonPassingRule.then.properties.error.minLength, 1);

  const blockedRule = schema.allOf.find(
    (rule: any) => rule.if?.properties?.status?.const === 'blocked',
  );
  assert.equal(
    blockedRule.then.properties.process_cleanup.properties.launched_root_pid.const,
    null,
  );
  assert.equal(
    blockedRule.then.properties.visible_window.properties.observed.const,
    false,
  );
});

test('V6 receipt schema validates runner-shaped terminal and failure states', () => {
  const validate = compileSchema(schemaPath);
  const passed = makeGuestReceipt();
  const blocked = makeGuestReceipt({ status: 'blocked' });
  const failed = makeGuestReceipt({ status: 'failed' });

  for (const [label, receipt] of [
    ['passed', passed],
    ['blocked', blocked],
    ['failed', failed],
  ] as const) {
    assert.equal(
      validate(receipt),
      true,
      `${label}: ${JSON.stringify(validate.errors)}`,
    );
  }

  const invalidMutants = [
    { label: 'passed without cleanup', mutate: (value: any) => (value.process_cleanup.status = 'not_run') },
    { label: 'passed with short samples', mutate: (value: any) => (value.post_readback.validation_distro_state_samples = ['Running']) },
    { label: 'passed with promoted capability', mutate: (value: any) => (value.status_groups.aioncore_health.capability_verification = 'verified') },
    { label: 'blocked with a root PID', mutate: (value: any) => (value.process_cleanup.launched_root_pid = 4312) },
    { label: 'blocked without an error', mutate: (value: any) => (value.error = null) },
    { label: 'pending guest receipt released', mutate: (value: any) => (value.vm.writer_release.status = 'released') },
  ];
  for (const { label, mutate } of invalidMutants) {
    const candidate = structuredClone(
      label.startsWith('blocked') ? blocked : passed,
    );
    mutate(candidate);
    assert.equal(validate(candidate), false, label);
  }
});

test('V6 host closeout binds two guest phases before releasing the writer', async (t) => {
  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-v6-closeout-'));
  t.after(() => fs.rmSync(temporaryRoot, { recursive: true, force: true }));

  const vmxPath = path.join(temporaryRoot, 'validation.vmx');
  const candidateZip = path.join(
    temporaryRoot,
    'OPL-Windows-WSL2-Validation-v6.zip',
  );
  const stoppedScreenshot = path.join(temporaryRoot, 'stopped.png');
  const runningScreenshot = path.join(temporaryRoot, 'running.png');
  const handoffPath = path.join(temporaryRoot, 'writer-handoff.json');
  const stoppedReceiptPath = path.join(temporaryRoot, 'stopped.json');
  const runningReceiptPath = path.join(temporaryRoot, 'running.json');
  const outputDir = path.join(temporaryRoot, 'closeout');
  const canonicalVmxPath =
    '/Volumes/Test SSD/Virtual Machines.localized/validation.vmwarevm/validation.vmx';
  const biosUuid = '56 4d 23 d9 29 b6 71 8c-5f 6f 79 3c 85 41 96 85';
  const vmIdentity = `vmware-bios:${biosUuid.replaceAll(/[^0-9a-f]/gi, '').toLowerCase()}`;
  const ownerId = 'windows-wsl2-v6-owner';

  fs.writeFileSync(vmxPath, `uuid.bios = "${biosUuid}"\n`);
  fs.writeFileSync(candidateZip, 'candidate-zip');
  fs.writeFileSync(stoppedScreenshot, 'stopped-window');
  fs.writeFileSync(runningScreenshot, 'running-window');
  const vmxSha = sha256File(vmxPath);
  const handoff = {
    schema: 'opl_vm_writer_release.v1',
    vmx_storage_class: 'external_ssd',
    vm_identity: vmIdentity,
    previous_owner_task_id: '019f91db-b1d4-7011-9429-6694cf3b3224',
    receipt_id: 'webui-to-v6',
    released_at: '2026-07-25T00:00:00.000Z',
    vmx_path: canonicalVmxPath,
    vmx_sha256: vmxSha,
    external_volume_uuid: 'F38D7FC5-E974-4B63-87DE-23E685F05E7E',
    next_owner_id: ownerId,
  };
  fs.writeFileSync(handoffPath, `${JSON.stringify(handoff)}\n`);
  const handoffSha = sha256File(handoffPath);
  const artifactSha = sha256File(candidateZip);
  const refs = {
    appSha: '1'.repeat(40),
    shellSha: '2'.repeat(40),
    frameworkSha: '3'.repeat(40),
  };
  fs.writeFileSync(
    stoppedReceiptPath,
    `${JSON.stringify(
      makeGuestReceipt({
        phase: 'stopped',
        runId: 'v6-stopped',
        artifactSha,
        handoffSha,
        screenshotSha: sha256File(stoppedScreenshot),
        vmIdentity,
        ...refs,
      }),
    )}\n`,
  );
  fs.writeFileSync(
    runningReceiptPath,
    `${JSON.stringify(
      makeGuestReceipt({
        phase: 'running',
        runId: 'v6-running',
        artifactSha,
        handoffSha,
        screenshotSha: sha256File(runningScreenshot),
        vmIdentity,
        ...refs,
      }),
    )}\n`,
  );

  const { runHostCloseout } = await import(hostCloseoutPath);
  let poweredOn = true;
  const result = await runHostCloseout(
    {
      vmxPath,
      expectedVmxSha256: vmxSha,
      expectedVmBiosUuid: biosUuid,
      expectedVolumeUuid: 'F38D7FC5-E974-4B63-87DE-23E685F05E7E',
      expectedDeviceIdentifier: 'disk3s2',
      hostWriterHandoff: handoffPath,
      expectedWriterHandoffSha256: handoffSha,
      stoppedGuestReceipt: stoppedReceiptPath,
      stoppedScreenshot,
      runningGuestReceipt: runningReceiptPath,
      runningScreenshot,
      candidateZip,
      expectedArtifactSha256: artifactSha,
      expectedAppSha: refs.appSha,
      expectedShellSha: refs.shellSha,
      expectedFrameworkSha: refs.frameworkSha,
      currentOwnerId: ownerId,
      releaseReceiptId: 'v6-writer-release',
      outputDir,
      timeoutSeconds: 30,
      requestSoftShutdown: true,
    },
    {
      canonicalizeVmxPath: () => canonicalVmxPath,
      volumeRootFromVmxPath: () => '/Volumes/Test SSD',
      readDiskIdentity: () => ({
        internal: false,
        solidState: true,
        busProtocol: 'USB',
        volumeUuid: 'F38D7FC5-E974-4B63-87DE-23E685F05E7E',
        deviceIdentifier: 'disk3s2',
      }),
      listRunningVms: () => (poweredOn ? [canonicalVmxPath] : []),
      listVmxProcesses: () =>
        poweredOn ? [`vmware-vmx ${canonicalVmxPath}`] : [],
      stopVmSoft: () => {
        poweredOn = false;
      },
      sleep: async () => {},
      now: () => new Date('2026-07-25T01:00:00.000Z'),
    },
  );

  assert.equal(result.finalReceipt.terminal_v6_verdict, true);
  assert.equal(result.finalReceipt.status, 'passed');
  assert.equal(result.writerRelease.powered_off_readback, true);
  const validateHostReceipt = compileSchema(hostSchemaPath);
  assert.equal(
    validateHostReceipt(result.finalReceipt),
    true,
    JSON.stringify(validateHostReceipt.errors),
  );
});

test('V6 documentation preserves the non-binding and prior-launch boundary', () => {
  const readme = fs.readFileSync(readmePath, 'utf8');
  const plan = fs.readFileSync(planPath, 'utf8');

  assert.match(readme, /v6-electron-visible-smoke\.ps1/);
  assert.match(readme, /windows-wsl2-v6-receipt\.schema\.json/);
  assert.match(readme, /windows-wsl2-v6-host-closeout\.schema\.json/);
  assert.match(readme, /v6-host-closeout\.mjs/);
  assert.match(readme, /eleven committed PowerShell fixtures/);
  assert.match(
    readme,
    /previous uncontrolled candidate launch[\s\S]*does not count as a V6 smoke/i,
  );
  assert.match(readme, /does not start, stop,/i);
  assert.match(readme, /import, unregister,\s+or adopt a WSL distribution/i);
  assert.match(readme, /guest_smoke_pending_host_closeout/);
  assert.match(readme, /terminal_v6_verdict=false/);
  assert.match(readme, /requests only a bounded\s+VMware soft shutdown/i);
  assert.match(
    readme,
    /Only then may it write[\s\S]*terminal_v6_verdict=true/i,
  );
  assert.match(
    plan,
    /visible-smoke pass validates the bounded projection,\s+not the\s+unavailable capabilities/i,
  );
  assert.doesNotMatch(readme, /Windows support is complete/i);
});

if (pwshPath) {
  test('V6 PowerShell runner parses when PowerShell is available', () => {
    const escapedPath = runnerPath.replaceAll("'", "''");
    const result = spawnSync(
      pwshPath,
      [
        '-NoLogo',
        '-NoProfile',
        '-NonInteractive',
        '-Command',
        `$tokens=$null;$errors=$null;[System.Management.Automation.Language.Parser]::ParseFile('${escapedPath}',[ref]$tokens,[ref]$errors) | Out-Null;if($errors.Count){$errors | ForEach-Object { Write-Error $_ }; exit 1 }`,
      ],
      {
        cwd: appRoot,
        encoding: 'utf8',
      },
    );
    assert.equal(result.status, 0, result.stderr || result.stdout || result.error?.message);
  });
} else {
  test.skip('V6 PowerShell runner parses on target Windows', () => {
    // The target-Windows AST parse is a required guest-only acceptance item.
  });
}

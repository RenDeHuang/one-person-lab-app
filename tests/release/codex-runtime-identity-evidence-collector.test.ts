import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

import {
  ISSUE_122_RUNTIME_EXECUTION_STEPS,
  assembleCodexRuntimeIdentityEvidence,
  buildCodexRuntimeIdentityCollectionPlan,
  collectEligibilityProtectedPaths,
  commitCodexRuntimeIdentityEvidenceOutputs,
} from '../../scripts/codex-runtime-identity-evidence-collector.ts';
import {
  CODEX_RUNTIME_IDENTITY_FIELDS,
  REQUIRED_CODEX_RUNTIME_ERROR_CODES,
} from '../../scripts/codex-runtime-identity-evidence.ts';

const eligibilityDigest = `sha256:${'1'.repeat(64)}`;
const runtimeCohortRef = `sha256:${'2'.repeat(64)}`;
const isolatedCodexHome =
  '/Users/opl/Library/Application Support/OPL-Evidence/issue-122/op-1/codex-home';

function sha256(value: string | Buffer): string {
  return `sha256:${crypto.createHash('sha256').update(value).digest('hex')}`;
}

function writeFile(root: string, relativePath: string, contents = relativePath) {
  const filePath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, contents, 'utf8');
  return { path: relativePath, sha256: sha256(contents) };
}

function writeJsonFile(root: string, relativePath: string, value: unknown) {
  return writeFile(root, relativePath, `${JSON.stringify(value, null, 2)}\n`);
}

function evidenceRef(root: string, kind: string, suffix: string, value?: unknown) {
  const reference = value === undefined
    ? writeFile(root, `captures/${suffix}.txt`, `${suffix}\n`)
    : writeJsonFile(root, `captures/${suffix}.json`, value);
  return {
    kind,
    ...reference,
  };
}

function rewriteJsonReference(
  root: string,
  reference: { path: string; sha256: string },
  mutate: (value: Record<string, any>) => void,
): void {
  const filePath = path.join(root, reference.path);
  const value = JSON.parse(fs.readFileSync(filePath, 'utf8')) as Record<string, any>;
  mutate(value);
  const bytes = `${JSON.stringify(value, null, 2)}\n`;
  fs.writeFileSync(filePath, bytes, 'utf8');
  reference.sha256 = sha256(bytes);
}

function identity() {
  return {
    schema: 'opl_codex_runtime_identity.v1',
    path:
      '/Applications/One Person Lab.app/Contents/Resources/bundled-aioncore/darwin-arm64/managed-resources/cli/codex',
    realpath:
      '/Applications/One Person Lab.app/Contents/Resources/bundled-aioncore/darwin-arm64/managed-resources/cli/codex',
    version: '0.144.6',
    sha256: `sha256:${'3'.repeat(64)}`,
    codex_home: isolatedCodexHome,
    runtime_key: 'darwin-arm64',
    runtime_cohort_ref: runtimeCohortRef,
    carrier: {
      kind: 'aioncore_managed_resources_projection',
      producer_manifest_sha256: `sha256:${'4'.repeat(64)}`,
      projection_manifest_sha256: `sha256:${'5'.repeat(64)}`,
      aioncore_native_readback: false,
    },
  };
}

function eligibility(root: string) {
  const standard = writeFile(root, 'artifacts/standard.dmg', 'standard artifact\n');
  const full = writeFile(root, 'artifacts/full.dmg', 'full artifact\n');
  return {
    schema: 'opl_codex_runtime_artifact_eligibility_validation.v1' as const,
    status: 'passed' as const,
    eligibility_digest: eligibilityDigest,
    version: '26.7.31',
    bundle_digest: `sha256:${'6'.repeat(64)}`,
    release_cohort_ref: `sha256:${'6'.repeat(64)}`,
    source: {
      app_sha: 'a'.repeat(40),
      shell_sha: 'b'.repeat(40),
      framework_sha: 'c'.repeat(40),
      app_floor: 'd'.repeat(40),
      shell_floor: 'e'.repeat(40),
      ancestry_verified: true as const,
    },
    operations: {
      standard_operation_id: 'standard-operation',
      append_full_operation_id: 'append-full-operation',
      standard_run_id: '1001',
      append_full_run_id: '1002',
      serialized_checkpoint_link_verified: true as const,
    },
    artifacts: {
      standard: {
        name: 'standard.dmg',
        sha256: standard.sha256,
        size_bytes: fs.statSync(path.join(root, standard.path)).size,
        file_path: standard.path,
      },
      full: {
        name: 'full.dmg',
        sha256: full.sha256,
        size_bytes: fs.statSync(path.join(root, full.path)).size,
        file_path: full.path,
      },
    },
    verified_file_count: 10 as const,
    authority: {
      source_pins_role: 'build_provenance_only' as const,
      may_gate_install_or_runtime: false as const,
      exact_cross_component_compatibility_gate: false as const,
    },
  };
}

const executionBase = Date.parse('2026-07-31T02:00:00.000Z');

function execution(guestMachineUuid = 'guest-machine-uuid-1') {
  return ISSUE_122_RUNTIME_EXECUTION_STEPS.map((id, index) => ({
    sequence: index + 1,
    id,
    status: 'passed',
    started_at: new Date(executionBase + index * 2_000).toISOString(),
    completed_at: new Date(executionBase + index * 2_000 + 1_000).toISOString(),
    guest_machine_uuid: guestMachineUuid,
  }));
}

function capturedAt(stepId: (typeof ISSUE_122_RUNTIME_EXECUTION_STEPS)[number]): string {
  const index = ISSUE_122_RUNTIME_EXECUTION_STEPS.indexOf(stepId);
  return new Date(executionBase + index * 2_000 + 500).toISOString();
}

function runStep(
  runId: 'full_clean_install_finder' | 'standard_update_after_full_finder',
  suffix:
    | 'direct_app_server_captured'
    | 'aioncore_acp_captured'
    | 'typed_errors_probed'
    | 'graceful_quit_verified',
) {
  const prefix = runId === 'full_clean_install_finder' ? 'full' : 'standard';
  return `${prefix}_${suffix}` as (typeof ISSUE_122_RUNTIME_EXECUTION_STEPS)[number];
}

function runPids(runId: 'full_clean_install_finder' | 'standard_update_after_full_finder') {
  const base = runId === 'full_clean_install_finder' ? 1_000 : 2_000;
  return { app: base + 1, aioncore: base + 2, direct: base + 3 };
}

function runtimeRun(
  root: string,
  runId: 'full_clean_install_finder' | 'standard_update_after_full_finder',
  artifact: { file_path: string; sha256: string },
) {
  const full = runId === 'full_clean_install_finder';
  const managedCandidate = identity();
  const pids = runPids(runId);
  const finderCapture = {
    schema: 'opl_issue_122_finder_process_capture.v1',
    status: 'captured',
    run_id: runId,
    guest_machine_uuid: 'guest-machine-uuid-1',
    launch: {
      entrypoint: 'finder',
      executable: '/usr/bin/osascript',
      arguments: [
        '-e',
        'tell application "Finder" to open POSIX file "/Applications/One Person Lab.app"',
      ],
      app_bundle_path: '/Applications/One Person Lab.app',
    },
    environment: {
      path: '/usr/bin:/bin',
      codex_home: isolatedCodexHome,
      opl_codex_bin: managedCandidate.path,
      shell_profile_loaded: false,
      global_codex_present: false,
    },
    processes: {
      app: {
        pid: pids.app,
        executable_path: '/Applications/One Person Lab.app/Contents/MacOS/One Person Lab',
        bundle_id: 'cn.onepersonlab.opl',
      },
      aioncore: {
        pid: pids.aioncore,
        parent_pid: pids.app,
        executable_path:
          '/Applications/One Person Lab.app/Contents/Resources/bundled-aioncore/darwin-arm64/aioncore',
      },
    },
    managed_candidate_count: 1,
    managed_candidate: structuredClone(managedCandidate),
    captured_at: capturedAt(runStep(runId, 'aioncore_acp_captured')),
  };
  const directProcessCapture = {
    schema: 'opl_issue_122_direct_app_server_process_capture.v1',
    status: 'captured',
    run_id: runId,
    guest_machine_uuid: 'guest-machine-uuid-1',
    observation_mode: 'resolver_verified_spawn_input',
    process: {
      pid: pids.direct,
      parent_pid: pids.app,
      executable_path: managedCandidate.path,
      realpath: managedCandidate.realpath,
      arguments: ['app-server', '--stdio'],
      environment: {
        path: '/usr/bin:/bin',
        codex_home: isolatedCodexHome,
        opl_codex_bin: managedCandidate.path,
      },
    },
    identity_input: structuredClone(managedCandidate),
    captured_at: capturedAt(runStep(runId, 'direct_app_server_captured')),
  };
  const handshakeCapture = (
    boundary: 'direct_app_server' | 'aioncore_acp',
    processPid: number,
    handshake: string,
  ) => ({
    schema: 'opl_issue_122_runtime_handshake_capture.v1',
    status: 'captured',
    run_id: runId,
    guest_machine_uuid: 'guest-machine-uuid-1',
    boundary,
    process_pid: processPid,
    handshake,
    identity_binding_mode:
      boundary === 'direct_app_server'
        ? 'resolver_spawn_input'
        : 'unique_managed_candidate_controlled_input',
    native_runtime_identity_readback: false,
    identity_input: structuredClone(managedCandidate),
    request_sha256: sha256(`${runId}-${boundary}-request`),
    response_sha256: sha256(`${runId}-${boundary}-response`),
    captured_at: capturedAt(
      runStep(
        runId,
        boundary === 'direct_app_server'
          ? 'direct_app_server_captured'
          : 'aioncore_acp_captured',
      ),
    ),
  });
  return {
    id: runId,
    status: 'passed',
    runtime_profile: full ? 'full' : 'standard',
    transition: full ? 'clean_install' : 'full_to_standard_update',
    launch: {
      entrypoint: 'finder',
      path: '/usr/bin:/bin',
      shell_profile_loaded: false,
      global_codex_present: false,
      restarted: true,
    },
    artifact: {
      profile: full ? 'full' : 'standard',
      app_version: '26.7.31',
      path: artifact.file_path,
      sha256: artifact.sha256,
      evidence_refs: [
        evidenceRef(root, 'artifact_tree', `${runId}-artifact-tree`),
      ],
    },
    managed_candidate: managedCandidate,
    direct_app_server: {
      observation_mode: 'resolver_verified_spawn_input',
      handshake: 'initialize_passed',
      identity: structuredClone(managedCandidate),
      evidence_refs: [
        evidenceRef(
          root,
          'process_inspection',
          `${runId}-direct-process`,
          directProcessCapture,
        ),
        evidenceRef(
          root,
          'handshake_log',
          `${runId}-direct-handshake`,
          handshakeCapture('direct_app_server', pids.direct, 'initialize_passed'),
        ),
      ],
    },
    aioncore_acp: {
      observation_mode:
        'unique_managed_candidate_inherited_environment_and_conversation_handshake',
      native_readback: false,
      managed_candidate_count: 1,
      handshake: 'ordinary_conversation_real_response_passed',
      identity: structuredClone(managedCandidate),
      evidence_refs: [
        evidenceRef(
          root,
          'environment_capture',
          `${runId}-acp-environment`,
          finderCapture,
        ),
        evidenceRef(
          root,
          'handshake_log',
          `${runId}-acp-handshake`,
          handshakeCapture(
            'aioncore_acp',
            pids.aioncore,
            'ordinary_conversation_real_response_passed',
          ),
        ),
      ],
    },
    identity_comparison: {
      fields: CODEX_RUNTIME_IDENTITY_FIELDS,
      status: 'matched',
      claim_scope:
        'opl_controlled_input_and_successful_handshake_without_aioncore_native_readback',
      may_gate_install_or_runtime: false,
    },
    typed_error_probes: REQUIRED_CODEX_RUNTIME_ERROR_CODES.map((code) => ({
      code,
      status: 'passed',
      evidence_refs: [
        evidenceRef(
          root,
          'typed_error_probe',
          `${runId}-${code.toLowerCase()}`,
          {
            schema: 'opl_issue_122_typed_error_probe_capture.v1',
            status: 'captured',
            run_id: runId,
            guest_machine_uuid: 'guest-machine-uuid-1',
            boundary: 'opl_shell_adapter',
            code,
            request_sha256: sha256(`${runId}-${code}-request`),
            response_sha256: sha256(`${runId}-${code}-response`),
            response: {
              ok: false,
              code,
              kind: 'local_runtime',
              actionable: true,
              unknown_upstream_error: false,
            },
            captured_at: capturedAt(runStep(runId, 'typed_errors_probed')),
          },
        ),
      ],
    })),
  };
}

function capture(root: string, artifactEligibility = eligibility(root)) {
  const sourceVm = 'macos-base';
  const taskVm = 'opl-issue-122-runtime-evidence-op-1';
  const guestMachineUuid = 'guest-machine-uuid-1';
  const custodyReceipt = writeJsonFile(root, 'captures/task-vm-custody.json', {
    schema: 'opl_issue_122_task_vm_custody_capture.v1',
    status: 'captured',
    source_vm: sourceVm,
    task_vm: taskVm,
    guest_machine_uuid: guestMachineUuid,
    source_vm_mutated: false,
    target_absent_before_clone: true,
    clone_completed: true,
    clone_operation_id: 'clone-op-1',
    captured_at: capturedAt('task_vm_cloned'),
  });
  const fullPids = runPids('full_clean_install_finder');
  const standardPids = runPids('standard_update_after_full_finder');
  const fullQuitReceipt = writeJsonFile(root, 'captures/full-quit.json', {
    schema: 'opl_issue_122_graceful_quit_capture.v1',
    status: 'captured',
    run_id: 'full_clean_install_finder',
    guest_machine_uuid: guestMachineUuid,
    bundle_id: 'cn.onepersonlab.opl',
    method: 'graceful_bundle_id_quit',
    app_pid: fullPids.app,
    owned_pids_before: [fullPids.app, fullPids.direct, fullPids.aioncore],
    owned_pids_after: [],
    completed_at: capturedAt('full_graceful_quit_verified'),
  });
  const standardQuitReceipt = writeJsonFile(root, 'captures/standard-quit.json', {
    schema: 'opl_issue_122_graceful_quit_capture.v1',
    status: 'captured',
    run_id: 'standard_update_after_full_finder',
    guest_machine_uuid: guestMachineUuid,
    bundle_id: 'cn.onepersonlab.opl',
    method: 'graceful_bundle_id_quit',
    app_pid: standardPids.app,
    owned_pids_before: [standardPids.app, standardPids.direct, standardPids.aioncore],
    owned_pids_after: [],
    completed_at: capturedAt('standard_graceful_quit_verified'),
  });
  const restoreReceipt = writeJsonFile(root, 'captures/environment-restore.json', {
    schema: 'opl_issue_122_launch_environment_restore_capture.v1',
    status: 'captured',
    guest_machine_uuid: guestMachineUuid,
    path_restored: true,
    codex_home_restored: true,
    captured_at: capturedAt('guest_launch_environment_restored'),
  });
  return {
    schema: 'opl_codex_runtime_identity_structured_capture.v1',
    eligibility_digest: eligibilityDigest,
    vm: {
      source_vm: sourceVm,
      task_vm: taskVm,
      task_vm_ownership_token: custodyReceipt.sha256,
      guest_machine_uuid: guestMachineUuid,
      source_vm_mutated: false,
      custody_receipt: custodyReceipt,
    },
    environment: {
      app_bundle_path: '/Applications/One Person Lab.app',
      path: '/usr/bin:/bin',
      isolated_codex_home: isolatedCodexHome,
      shell_profile_loaded: false,
      global_codex_present: false,
    },
    execution: execution(),
    transition: {
      full_install: 'clean_install',
      standard_update: 'in_place_update_after_full',
      full_graceful_quit: true,
      full_owned_pids_after_quit: [],
      standard_graceful_quit: true,
      standard_owned_pids_after_quit: [],
      launch_environment_restored: true,
      full_quit_receipt: fullQuitReceipt,
      standard_quit_receipt: standardQuitReceipt,
      environment_restore_receipt: restoreReceipt,
    },
    evidence: {
      schema: 'opl_codex_runtime_identity_evidence.v1',
      status: 'passed',
      authority: {
        policy_owner: 'one-person-lab-app',
        runtime_identity_producer: 'gaofeng21cn/opl-aion-shell',
        carrier: 'aioncore_managed_resources_projection',
        aioncore_modified: false,
        aioncore_native_readback: false,
        exact_identity_may_gate_install_or_runtime: false,
        claim_scope:
          'opl_controlled_input_and_successful_handshake_without_aioncore_native_readback',
      },
      runs: [
        runtimeRun(root, 'full_clean_install_finder', artifactEligibility.artifacts.full),
        runtimeRun(
          root,
          'standard_update_after_full_finder',
          artifactEligibility.artifacts.standard,
        ),
      ],
      created_at: '2026-07-31T03:00:00.000Z',
    },
  };
}

function assembleCapture(
  root: string,
  artifactEligibility: ReturnType<typeof eligibility>,
  captureValue: ReturnType<typeof capture>,
  suffix: string,
  evidenceOutputRelativePath = 'result/runtime-evidence.json',
) {
  const captureReference = writeJsonFile(root, `inputs/${suffix}.json`, captureValue);
  return assembleCodexRuntimeIdentityEvidence(captureValue, {
    evidenceRoot: root,
    eligibility: artifactEligibility,
    evidenceOutputRelativePath,
    capture: captureReference,
  });
}

function withFixture(
  callback: (
    root: string,
    artifactEligibility: ReturnType<typeof eligibility>,
    captureValue: ReturnType<typeof capture>,
  ) => void,
) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-codex-evidence-collector-'));
  try {
    const artifactEligibility = eligibility(root);
    callback(root, artifactEligibility, capture(root, artifactEligibility));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

test('plan is explicit, serial, Finder-bound, and incapable of mutation', () => {
  const plan = buildCodexRuntimeIdentityCollectionPlan({
    eligibilityDigest,
    evidenceRoot: '/tmp/issue-122-evidence',
    sourceVm: 'macos-base',
    taskVm: 'opl-issue-122-runtime-evidence-op-1',
    appBundlePath: '/Applications/One Person Lab.app',
    isolatedCodexHome,
    createdAt: '2026-07-31T01:00:00.000Z',
  });
  assert.equal(plan.status, 'plan_only');
  assert.equal(plan.vm.source_vm_mutation_allowed, false);
  assert.equal(plan.helper_policy.clone_allowed_in_plan_mode, false);
  assert.equal(plan.helper_policy.boot_allowed_in_plan_mode, false);
  assert.equal(plan.helper_policy.install_allowed_in_plan_mode, false);
  assert.equal(plan.process_policy.pkill_allowed, false);
  assert.equal(plan.process_policy.force_kill_allowed, false);
  assert.equal(plan.finder_launch.executable, '/usr/bin/osascript');
  assert.deepEqual(plan.finder_launch.arguments, [
    '-e',
    'tell application "Finder" to open POSIX file "/Applications/One Person Lab.app"',
  ]);
  assert.equal(plan.environment.path, '/usr/bin:/bin');
  assert.equal(plan.environment.isolated_codex_home, isolatedCodexHome);
  assert.equal(plan.collector.execute_mode_available, false);
  assert.deepEqual(plan.execution.ordered_steps, ISSUE_122_RUNTIME_EXECUTION_STEPS);
});

test('plan rejects base VM reuse, non-task VM names, and non-isolated CODEX_HOME', () => {
  const input = {
    eligibilityDigest,
    evidenceRoot: '/tmp/issue-122-evidence',
    sourceVm: 'macos-base',
    taskVm: 'opl-issue-122-runtime-evidence-op-1',
    appBundlePath: '/Applications/One Person Lab.app',
    isolatedCodexHome,
    createdAt: '2026-07-31T01:00:00.000Z',
  };
  assert.throws(
    () =>
      buildCodexRuntimeIdentityCollectionPlan({
        ...input,
        taskVm: input.sourceVm,
      }),
    /task_vm must differ from source_vm/,
  );
  assert.throws(
    () =>
      buildCodexRuntimeIdentityCollectionPlan({
        ...input,
        taskVm: 'user-existing-vm',
      }),
    /task namespace/,
  );
  assert.throws(
    () =>
      buildCodexRuntimeIdentityCollectionPlan({
        ...input,
        isolatedCodexHome: '/Users/opl/.codex',
      }),
    /task-owned/,
  );
});

test('assemble accepts only complete structured same-VM evidence and seals exact output bytes', () => {
  withFixture((root, artifactEligibility, captureValue) => {
    const assembled = assembleCapture(root, artifactEligibility, captureValue, 'valid');
    assert.equal(assembled.receipt.status, 'structured_consistency_passed');
    assert.equal(assembled.receipt.eligibility_digest, eligibilityDigest);
    assert.equal(assembled.receipt.vm.same_task_vm_claim_consistent, true);
    assert.equal(assembled.receipt.vm.runtime_vm_identity_verified, false);
    assert.equal(assembled.receipt.execution.declared_strict_serial_consistent, true);
    assert.equal(assembled.receipt.execution.runtime_execution_verified, false);
    assert.ok(assembled.receipt.execution.structured_receipt_count >= 20);
    assert.equal(assembled.receipt.strict_validation.artifact_evidence_complete, true);
    assert.ok(assembled.receipt.strict_validation.verified_file_count > 0);
    assert.equal(
      assembled.receipt.evidence.sha256,
      sha256(assembled.evidence_bytes),
    );
    assert.equal(assembled.receipt.authority.collector_execute_mode_available, false);
    assert.equal(assembled.receipt.authority.shell_text_parsing_used, false);
    assert.equal(assembled.receipt.authority.may_gate_install_or_runtime, false);
    assert.equal(assembled.receipt.authority.structured_receipts_parsed, true);
    assert.equal(assembled.receipt.authority.runtime_execution_verified, false);
    const capturePath = path.join(root, assembled.receipt.capture.path);
    assert.equal(assembled.receipt.capture.sha256, sha256(fs.readFileSync(capturePath)));
  });
});

test('assemble rejects multi-VM, non-serial, incomplete-quit, and cross-run identity drift', () => {
  withFixture((root, artifactEligibility, captureValue) => {
    const anotherVm = structuredClone(captureValue);
    anotherVm.execution[3].guest_machine_uuid = 'guest-machine-uuid-2';
    assert.throws(
      () => assembleCapture(root, artifactEligibility, anotherVm, 'another-vm'),
      /guest_machine_uuid/,
    );

    const overlapping = structuredClone(captureValue);
    overlapping.execution[1].started_at = overlapping.execution[0].started_at;
    assert.throws(
      () => assembleCapture(root, artifactEligibility, overlapping, 'overlapping'),
      /monotonic and strictly serial/,
    );

    const livePid = structuredClone(captureValue);
    livePid.transition.full_owned_pids_after_quit = [42];
    assert.throws(
      () => assembleCapture(root, artifactEligibility, livePid, 'live-pid'),
      /full_owned_pids_after_quit must be \[\]/,
    );

    const drift = structuredClone(captureValue);
    drift.evidence.runs[1].managed_candidate.sha256 = `sha256:${'9'.repeat(64)}`;
    drift.evidence.runs[1].direct_app_server.identity.sha256 =
      drift.evidence.runs[1].managed_candidate.sha256;
    drift.evidence.runs[1].aioncore_acp.identity.sha256 =
      drift.evidence.runs[1].managed_candidate.sha256;
    assert.throws(
      () => assembleCapture(root, artifactEligibility, drift, 'identity-drift'),
      /Standard managed_candidate\.sha256/,
    );
  });
});

test('assemble rejects artifact substitution, absolute refs, symlinks, and missing typed probes', () => {
  withFixture((root, artifactEligibility, captureValue) => {
    const substituted = structuredClone(captureValue);
    substituted.evidence.runs[0].artifact.sha256 = `sha256:${'0'.repeat(64)}`;
    assert.throws(
      () => assembleCapture(root, artifactEligibility, substituted, 'substituted'),
      /artifact\.sha256 does not match/,
    );

    const absoluteRef = structuredClone(captureValue);
    absoluteRef.evidence.runs[0].direct_app_server.evidence_refs[0].path =
      path.join(root, absoluteRef.evidence.runs[0].direct_app_server.evidence_refs[0].path);
    assert.throws(
      () => assembleCapture(root, artifactEligibility, absoluteRef, 'absolute-ref'),
      /portable relative path/,
    );

    const symlinkRef = structuredClone(captureValue);
    const original = path.join(
      root,
      symlinkRef.evidence.runs[0].direct_app_server.evidence_refs[0].path,
    );
    const link = path.join(root, 'captures/symlink.json');
    fs.symlinkSync(original, link);
    symlinkRef.evidence.runs[0].direct_app_server.evidence_refs[0].path =
      path.relative(root, link).split(path.sep).join('/');
    assert.throws(
      () => assembleCapture(root, artifactEligibility, symlinkRef, 'symlink-ref'),
      /must not traverse a symbolic link/,
    );

    const missingProbe = structuredClone(captureValue);
    missingProbe.evidence.runs[1].typed_error_probes.pop();
    assert.throws(
      () => assembleCapture(root, artifactEligibility, missingProbe, 'missing-probe'),
      /typed_error_probes must contain exactly 5 probes/,
    );
  });
});

test('assemble rejects free-form receipts and structurally inconsistent custody, typed errors, and quit evidence', () => {
  withFixture((root, artifactEligibility, captureValue) => {
    const freeForm = structuredClone(captureValue);
    const reference = freeForm.evidence.runs[0].direct_app_server.evidence_refs[0];
    const bytes = 'not structured JSON\n';
    fs.writeFileSync(path.join(root, reference.path), bytes, 'utf8');
    reference.sha256 = sha256(bytes);
    assert.throws(
      () => assembleCapture(root, artifactEligibility, freeForm, 'free-form'),
      /must contain structured JSON/,
    );
  });

  withFixture((root, artifactEligibility, captureValue) => {
    const badCustody = structuredClone(captureValue);
    badCustody.vm.task_vm_ownership_token = `sha256:${'8'.repeat(64)}`;
    assert.throws(
      () => assembleCapture(root, artifactEligibility, badCustody, 'bad-custody'),
      /task_vm_ownership_token/,
    );
  });

  withFixture((root, artifactEligibility, captureValue) => {
    const wrongTypedError = structuredClone(captureValue);
    const reference =
      wrongTypedError.evidence.runs[0].typed_error_probes[0].evidence_refs[0];
    rewriteJsonReference(root, reference, (value) => {
      value.response.code = 'UNKNOWN_UPSTREAM_ERROR';
    });
    assert.throws(
      () => assembleCapture(root, artifactEligibility, wrongTypedError, 'wrong-typed-error'),
      /typed probe response\.code/,
    );
  });

  withFixture((root, artifactEligibility, captureValue) => {
    const wrongFinderLaunch = structuredClone(captureValue);
    const reference =
      wrongFinderLaunch.evidence.runs[0].aioncore_acp.evidence_refs[0];
    rewriteJsonReference(root, reference, (value) => {
      value.launch.executable = '/usr/bin/open';
    });
    assert.throws(
      () => assembleCapture(root, artifactEligibility, wrongFinderLaunch, 'wrong-finder'),
      /Finder capture launch\.executable/,
    );
  });

  withFixture((root, artifactEligibility, captureValue) => {
    const wrongHandshakeProcess = structuredClone(captureValue);
    const reference =
      wrongHandshakeProcess.evidence.runs[1].aioncore_acp.evidence_refs[1];
    rewriteJsonReference(root, reference, (value) => {
      value.process_pid = 999_999;
    });
    assert.throws(
      () =>
        assembleCapture(
          root,
          artifactEligibility,
          wrongHandshakeProcess,
          'wrong-handshake-process',
        ),
      /handshake capture process_pid/,
    );
  });

  withFixture((root, artifactEligibility, captureValue) => {
    const incompleteQuit = structuredClone(captureValue);
    rewriteJsonReference(root, incompleteQuit.transition.full_quit_receipt, (value) => {
      value.owned_pids_after = [1002];
    });
    assert.throws(
      () => assembleCapture(root, artifactEligibility, incompleteQuit, 'incomplete-quit'),
      /owned_pids_after/,
    );
  });
});

test('assemble requires one digest-bound capture file inside the evidence root', () => {
  withFixture((root, artifactEligibility, captureValue) => {
    const captureReference = writeJsonFile(root, 'inputs/bound-capture.json', captureValue);
    assert.throws(
      () =>
        assembleCodexRuntimeIdentityEvidence(captureValue, {
          evidenceRoot: root,
          eligibility: artifactEligibility,
          evidenceOutputRelativePath: 'result/evidence.json',
          capture: {
            ...captureReference,
            sha256: `sha256:${'0'.repeat(64)}`,
          },
        }),
      /capture input\.sha256/,
    );
    assert.throws(
      () =>
        assembleCodexRuntimeIdentityEvidence(captureValue, {
          evidenceRoot: root,
          eligibility: artifactEligibility,
          evidenceOutputRelativePath: 'result/evidence.json',
          capture: {
            path: '../outside.json',
            sha256: captureReference.sha256,
          },
        }),
      /must not escape the evidence root/,
    );
  });
});

test('output pair is create-once, rejects symlink ancestors and input collisions, and rolls back partial commit', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-codex-output-'));
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-codex-output-outside-'));
  try {
    const protectedInput = writeFile(root, 'inputs/capture.json', 'capture\n');
    const protectedPath = path.join(root, protectedInput.path);
    assert.throws(
      () =>
        commitCodexRuntimeIdentityEvidenceOutputs({
          evidenceRoot: root,
          outputPath: protectedPath,
          receiptPath: path.join(root, 'result/receipt.json'),
          evidenceBytes: Buffer.from('evidence\n'),
          receipt: { status: 'structured_consistency_passed' },
          protectedInputPaths: [protectedPath],
        }),
      /create-once|collides with a validated input/,
    );
    assert.equal(fs.readFileSync(protectedPath, 'utf8'), 'capture\n');

    fs.symlinkSync(outside, path.join(root, 'escape'));
    assert.throws(
      () =>
        commitCodexRuntimeIdentityEvidenceOutputs({
          evidenceRoot: root,
          outputPath: path.join(root, 'escape/new/evidence.json'),
          receiptPath: path.join(root, 'result/receipt.json'),
          evidenceBytes: Buffer.from('evidence\n'),
          receipt: { status: 'structured_consistency_passed' },
          protectedInputPaths: [protectedPath],
        }),
      /must not traverse a symbolic link/,
    );
    assert.equal(fs.existsSync(path.join(outside, 'new')), false);

    const successfulOutput = path.join(root, 'committed/evidence.json');
    const successfulReceipt = path.join(root, 'committed/receipt.json');
    commitCodexRuntimeIdentityEvidenceOutputs({
      evidenceRoot: root,
      outputPath: successfulOutput,
      receiptPath: successfulReceipt,
      evidenceBytes: Buffer.from('exact evidence\n'),
      receipt: { status: 'structured_consistency_passed' },
      protectedInputPaths: [protectedPath],
    });
    assert.equal(fs.readFileSync(successfulOutput, 'utf8'), 'exact evidence\n');
    assert.deepEqual(
      JSON.parse(fs.readFileSync(successfulReceipt, 'utf8')),
      { status: 'structured_consistency_passed' },
    );
    assert.throws(
      () =>
        commitCodexRuntimeIdentityEvidenceOutputs({
          evidenceRoot: root,
          outputPath: successfulOutput,
          receiptPath: successfulReceipt,
          evidenceBytes: Buffer.from('replacement\n'),
          receipt: { status: 'replacement' },
          protectedInputPaths: [protectedPath],
        }),
      /create-once/,
    );
    assert.equal(fs.readFileSync(successfulOutput, 'utf8'), 'exact evidence\n');

    const outputPath = path.join(root, 'atomic/evidence.json');
    const receiptPath = path.join(root, 'atomic/receipt.json');
    assert.throws(
      () =>
        commitCodexRuntimeIdentityEvidenceOutputs(
          {
            evidenceRoot: root,
            outputPath,
            receiptPath,
            evidenceBytes: Buffer.from('evidence\n'),
            receipt: { status: 'structured_consistency_passed' },
            protectedInputPaths: [protectedPath],
          },
          {
            beforeReceiptCommit: (target) => fs.writeFileSync(target, 'racing writer\n', 'utf8'),
          },
        ),
      /EEXIST/,
    );
    assert.equal(fs.existsSync(outputPath), false);
    assert.equal(fs.readFileSync(receiptPath, 'utf8'), 'racing writer\n');
    assert.deepEqual(
      fs.readdirSync(path.dirname(receiptPath)).filter((name) => name.endsWith('.tmp')),
      [],
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(outside, { recursive: true, force: true });
  }
});

test('eligibility output protection covers all custody, checkpoint, receipt, and artifact inputs', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-codex-protected-inputs-'));
  try {
    const makeReferences = (prefix: string, names: readonly string[]) =>
      Object.fromEntries(
        names.map((name) => [name, writeFile(root, `${prefix}/${name}.json`)]),
      );
    const packet = {
      evidence: makeReferences('eligibility', [
        'framework_bundle',
        'standard_checkpoint',
        'full_checkpoint',
        'standard_operation_receipt',
        'append_full_operation_receipt',
      ]),
      standard: {
        files: makeReferences('standard', [
          'primary_artifact',
          'updater_artifact',
          'updater_blockmap',
          'updater_metadata',
          'release_manifest',
          'release_inspection',
          'build_cohort',
          'qualification_receipt',
        ]),
      },
      full: {
        files: makeReferences('full', [
          'primary_artifact',
          'release_manifest',
          'release_inspection',
          'build_cohort',
          'qualification_receipt',
        ]),
      },
    };

    const protectedPaths = collectEligibilityProtectedPaths(packet, root);
    assert.equal(protectedPaths.size, 18);
    for (const reference of [
      ...Object.values(packet.evidence),
      ...Object.values(packet.standard.files),
      ...Object.values(packet.full.files),
    ]) {
      assert.equal(protectedPaths.has(fs.realpathSync(path.join(root, reference.path))), true);
    }

    const custodyPath = path.join(root, packet.evidence.standard_checkpoint.path);
    assert.throws(
      () =>
        commitCodexRuntimeIdentityEvidenceOutputs({
          evidenceRoot: root,
          outputPath: custodyPath,
          receiptPath: path.join(root, 'result/receipt.json'),
          evidenceBytes: Buffer.from('replacement\n'),
          receipt: { status: 'replacement' },
          protectedInputPaths: protectedPaths,
        }),
      /create-once|collides with a validated input/,
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('CLI has no default or execute mode', () => {
  for (const args of [[], ['execute']]) {
    const result = spawnSync(
      process.execPath,
      [
        '--experimental-strip-types',
        'scripts/codex-runtime-identity-evidence-collector.ts',
        ...args,
      ],
      { encoding: 'utf8' },
    );
    assert.equal(result.status, 1);
    assert.match(result.stderr, /execute mode is unavailable/);
  }
});

import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import {
  CODEX_RUNTIME_IDENTITY_FIELDS,
  REQUIRED_CODEX_RUNTIME_ERROR_CODES,
  REQUIRED_CODEX_RUNTIME_EVIDENCE_RUNS,
  validateCodexRuntimeIdentityEvidence,
} from '../../scripts/codex-runtime-identity-evidence.ts';

const digest = (character: string): string => `sha256:${character.repeat(64)}`;

function writeEvidenceFile(root: string, relativePath: string, contents = relativePath) {
  const filePath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, contents, 'utf8');
  return {
    path: relativePath,
    sha256: `sha256:${crypto.createHash('sha256').update(contents).digest('hex')}`,
  };
}

function identity() {
  return {
    schema: 'opl_codex_runtime_identity.v1',
    path: '/Applications/One Person Lab.app/Contents/Resources/bundled-aioncore/darwin-arm64/managed-resources/cli/codex',
    realpath:
      '/Applications/One Person Lab.app/Contents/Resources/bundled-aioncore/darwin-arm64/managed-resources/cli/codex',
    version: '0.144.6',
    sha256: digest('a'),
    codex_home: '/Users/operator/.codex',
    runtime_key: 'darwin-arm64',
    runtime_cohort_ref: digest('b'),
    carrier: {
      kind: 'aioncore_managed_resources_projection',
      producer_manifest_sha256: digest('c'),
      projection_manifest_sha256: digest('d'),
      aioncore_native_readback: false,
    },
  };
}

function evidenceRef(kind: string, suffix: string, evidenceRoot?: string) {
  const file = evidenceRoot
    ? writeEvidenceFile(evidenceRoot, `evidence/${suffix}.json`)
    : {
        path: `/tmp/opl-codex-runtime-evidence/${suffix}.json`,
        sha256: digest('e'),
      };
  return {
    kind,
    ...file,
  };
}

function typedErrorProbes(runId: string, evidenceRoot?: string) {
  return REQUIRED_CODEX_RUNTIME_ERROR_CODES.map((code) => ({
    code,
    status: 'passed',
    evidence_refs: [evidenceRef('typed_error_probe', `${runId}-${code.toLowerCase()}`, evidenceRoot)],
  }));
}

function run(id: (typeof REQUIRED_CODEX_RUNTIME_EVIDENCE_RUNS)[number], evidenceRoot?: string) {
  const full = id === 'full_clean_install_finder';
  const managedCandidate = identity();
  const artifact = evidenceRoot
    ? writeEvidenceFile(evidenceRoot, `artifacts/${full ? 'full' : 'standard'}.dmg`, `${id}-artifact`)
    : {
        path: full ? '/tmp/One-Person-Lab-Full.dmg' : '/tmp/One-Person-Lab-Standard.dmg',
        sha256: digest(full ? 'f' : '0'),
      };
  return {
    id,
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
      app_version: full ? '1.0.0' : '1.0.1',
      ...artifact,
      evidence_refs: [
        evidenceRef('artifact_tree', `${id}-installed-artifact-tree`, evidenceRoot),
      ],
    },
    managed_candidate: managedCandidate,
    direct_app_server: {
      observation_mode: 'resolver_verified_spawn_input',
      handshake: 'initialize_passed',
      identity: structuredClone(managedCandidate),
      evidence_refs: [
        evidenceRef('process_inspection', `${id}-direct-process`, evidenceRoot),
        evidenceRef('handshake_log', `${id}-direct-handshake`, evidenceRoot),
      ],
    },
    aioncore_acp: {
      observation_mode: 'unique_managed_candidate_inherited_environment_and_conversation_handshake',
      native_readback: false,
      managed_candidate_count: 1,
      handshake: 'ordinary_conversation_real_response_passed',
      identity: structuredClone(managedCandidate),
      evidence_refs: [
        evidenceRef('environment_capture', `${id}-acp-environment`, evidenceRoot),
        evidenceRef('handshake_log', `${id}-acp-handshake`, evidenceRoot),
      ],
    },
    identity_comparison: {
      fields: CODEX_RUNTIME_IDENTITY_FIELDS,
      status: 'matched',
      claim_scope: 'opl_controlled_input_and_successful_handshake_without_aioncore_native_readback',
      may_gate_install_or_runtime: false,
    },
    typed_error_probes: typedErrorProbes(id, evidenceRoot),
  };
}

function evidence(evidenceRoot?: string) {
  return {
    schema: 'opl_codex_runtime_identity_evidence.v1',
    status: 'passed',
    authority: {
      policy_owner: 'one-person-lab-app',
      runtime_identity_producer: 'gaofeng21cn/opl-aion-shell',
      carrier: 'aioncore_managed_resources_projection',
      aioncore_modified: false,
      aioncore_native_readback: false,
      exact_identity_may_gate_install_or_runtime: false,
      claim_scope: 'opl_controlled_input_and_successful_handshake_without_aioncore_native_readback',
    },
    runs: REQUIRED_CODEX_RUNTIME_EVIDENCE_RUNS.map((runId) => run(runId, evidenceRoot)),
    created_at: '2026-07-31T05:00:00.000Z',
  };
}

test('Codex runtime identity evidence schema freezes the honest AionCore boundary and two packaged runs', () => {
  const schema = JSON.parse(
    fs.readFileSync('contracts/opl-codex-runtime-identity-evidence.schema.json', 'utf8'),
  );
  assert.equal(schema.properties.schema.const, 'opl_codex_runtime_identity_evidence.v1');
  assert.equal(schema.properties.authority.properties.aioncore_modified.const, false);
  assert.equal(schema.properties.authority.properties.aioncore_native_readback.const, false);
  assert.equal(
    schema.properties.authority.properties.exact_identity_may_gate_install_or_runtime.const,
    false,
  );
  assert.equal(schema.properties.runs.minItems, 2);
  assert.equal(schema.properties.runs.maxItems, 2);
  assert.equal(
    schema.properties.runs.prefixItems[0].allOf[1].properties.id.const,
    'full_clean_install_finder',
  );
  assert.equal(
    schema.properties.runs.prefixItems[1].allOf[1].properties.id.const,
    'standard_update_after_full_finder',
  );
  assert.equal(
    schema.$defs.run.properties.artifact.properties.evidence_refs.contains.properties.kind.const,
    'artifact_tree',
  );
  assert.deepEqual(
    schema.$defs.run.properties.identity_comparison.properties.fields.const,
    CODEX_RUNTIME_IDENTITY_FIELDS,
  );
  assert.deepEqual(
    schema.$defs.typed_error_probe.properties.code.enum,
    REQUIRED_CODEX_RUNTIME_ERROR_CODES,
  );
});

test('validator accepts Full clean install and Full-to-Standard Finder evidence without native readback', () => {
  assert.deepEqual(validateCodexRuntimeIdentityEvidence(evidence()), {
    schema: 'opl_codex_runtime_identity_evidence_validation.v1',
    status: 'passed',
    run_ids: REQUIRED_CODEX_RUNTIME_EVIDENCE_RUNS,
    aioncore_native_readback: false,
    evidence_manifest_valid: true,
    artifact_evidence_complete: false,
    verified_file_count: 0,
  });
});

test('validator rejects identity drift, PATH fallback, invented readback, and incomplete typed probes', () => {
  const identityDrift = evidence();
  identityDrift.runs[0].aioncore_acp.identity.sha256 = digest('9');
  assert.throws(
    () => validateCodexRuntimeIdentityEvidence(identityDrift),
    /aioncore_acp\.identity\.sha256 must match managed_candidate\.sha256/,
  );

  const pathFallback = evidence();
  pathFallback.runs[0].launch.path = '/usr/local/bin:/usr/bin:/bin';
  assert.throws(
    () => validateCodexRuntimeIdentityEvidence(pathFallback),
    /launch\.path must be "\/usr\/bin:\/bin"/,
  );

  const inventedReadback = evidence();
  inventedReadback.runs[0].aioncore_acp.native_readback = true;
  assert.throws(
    () => validateCodexRuntimeIdentityEvidence(inventedReadback),
    /aioncore_acp\.native_readback must be false/,
  );

  const incompleteErrors = evidence();
  incompleteErrors.runs[1].typed_error_probes.pop();
  assert.throws(
    () => validateCodexRuntimeIdentityEvidence(incompleteErrors),
    /typed_error_probes must contain exactly 5 probes/,
  );

  const wrongDirectRefs = evidence();
  wrongDirectRefs.runs[0].direct_app_server.evidence_refs = [
    evidenceRef('environment_capture', 'wrong-direct-environment'),
    evidenceRef('handshake_log', 'wrong-direct-handshake'),
  ];
  assert.throws(
    () => validateCodexRuntimeIdentityEvidence(wrongDirectRefs),
    /direct_app_server\.evidence_refs must include a process_inspection reference/,
  );

  const missingArtifactTree = evidence();
  missingArtifactTree.runs[0].artifact.evidence_refs = [
    evidenceRef('environment_capture', 'missing-artifact-tree'),
  ];
  assert.throws(
    () => validateCodexRuntimeIdentityEvidence(missingArtifactTree),
    /artifact\.evidence_refs must include a artifact_tree reference/,
  );

  const reversedRuns = evidence();
  reversedRuns.runs.reverse();
  assert.throws(
    () => validateCodexRuntimeIdentityEvidence(reversedRuns),
    /evidence\.runs ordered ids/,
  );
});

test('validator verifies artifact and referenced-file bytes before reporting complete evidence', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-codex-runtime-evidence-files-'));
  try {
    const payload = evidence(tempRoot);
    const summary = validateCodexRuntimeIdentityEvidence(payload, {
      evidenceRoot: tempRoot,
      verifyReferencedFiles: true,
    });
    assert.equal(summary.evidence_manifest_valid, true);
    assert.equal(summary.artifact_evidence_complete, true);
    assert.ok(summary.verified_file_count > 0);

    const firstRef = payload.runs[0].direct_app_server.evidence_refs[0];
    fs.appendFileSync(path.join(tempRoot, firstRef.path), '\ntampered\n', 'utf8');
    assert.throws(
      () =>
        validateCodexRuntimeIdentityEvidence(payload, {
          evidenceRoot: tempRoot,
          verifyReferencedFiles: true,
        }),
      /sha256 does not match/,
    );
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('CLI validates a captured evidence file and returns a machine-readable summary', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-codex-runtime-evidence-'));
  try {
    const inputPath = path.join(tempRoot, 'evidence.json');
    fs.writeFileSync(inputPath, JSON.stringify(evidence(tempRoot)), 'utf8');
    const result = spawnSync(
      process.execPath,
      [
        '--experimental-strip-types',
        'scripts/codex-runtime-identity-evidence.ts',
        '--input',
        inputPath,
      ],
      { encoding: 'utf8' },
    );
    assert.equal(result.status, 0, result.stderr);
    const summary = JSON.parse(result.stdout);
    assert.equal(summary.status, 'passed');
    assert.equal(summary.evidence_manifest_valid, true);
    assert.equal(summary.artifact_evidence_complete, true);
    assert.equal(summary.aioncore_native_readback, false);
    assert.ok(summary.verified_file_count > 0);
    assert.deepEqual(summary.run_ids, REQUIRED_CODEX_RUNTIME_EVIDENCE_RUNS);
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('canonical Issue 122 closeout receipt binds the immutable artifact pair and honest ACP claim', () => {
  const receiptPath =
    'docs/delivery/release-evidence/issue-122-codex-runtime-identity-v26.8.1-r5.json';
  const receipt = JSON.parse(fs.readFileSync(receiptPath, 'utf8'));
  const runtimeBridge = JSON.parse(fs.readFileSync('contracts/app-runtime-bridge.json', 'utf8'));
  const policy = runtimeBridge.shared_gui_runtime_resolution_policy;

  assert.equal(receipt.schema, 'opl_codex_runtime_identity_closeout_receipt.v1');
  assert.equal(receipt.status, 'passed');
  assert.equal(receipt.artifact_pair.standard.release_id, 363488678);
  assert.equal(receipt.artifact_pair.standard.immutable, true);
  assert.equal(
    receipt.artifact_pair.standard.sha256,
    'sha256:8c4a01859827af6db599faf641df1c1330437a5d477b732ad2a68eedfcb01ce0',
  );
  assert.equal(receipt.artifact_pair.full.release_id, 363934248);
  assert.equal(receipt.artifact_pair.full.immutable, true);
  assert.equal(receipt.artifact_pair.full.append_full_run_id, 30773752205);
  assert.equal(receipt.artifact_pair.full.append_full_status, 'success');
  assert.equal(
    receipt.artifact_pair.full.sha256,
    'sha256:6a44266d936a031b949b0eac0951ab84d2e540f4a1d39eb92b3b9a0645b889cc',
  );

  assert.deepEqual(
    receipt.validation.run_ids,
    REQUIRED_CODEX_RUNTIME_EVIDENCE_RUNS,
  );
  assert.equal(receipt.validation.status, 'passed');
  assert.equal(receipt.validation.artifact_evidence_complete, true);
  assert.equal(receipt.validation.verified_file_count, 20);
  assert.equal(receipt.validation.aioncore_native_readback, false);
  assert.match(receipt.validation.evidence_manifest_sha256, /^sha256:[0-9a-f]{64}$/);

  for (const run of receipt.runs) {
    assert.equal(run.direct_app_server_handshake, 'initialize_passed');
    assert.equal(run.aioncore_acp_handshake, 'ordinary_conversation_real_response_passed');
    assert.equal(run.identity_comparison, 'matched');
    assert.deepEqual(run.typed_error_codes, REQUIRED_CODEX_RUNTIME_ERROR_CODES);
    assert.equal(Object.keys(run.evidence_ref_sha256).length, 9);
    for (const value of Object.values(run.evidence_ref_sha256)) {
      assert.match(value as string, /^sha256:[0-9a-f]{64}$/);
    }
  }
  assert.equal(receipt.runs[0].identity.path, receipt.runs[1].identity.path);
  assert.equal(receipt.runs[0].identity.version, receipt.runs[1].identity.version);
  assert.equal(receipt.runs[0].identity.codex_home, receipt.runs[1].identity.codex_home);
  assert.notEqual(receipt.runs[0].identity.sha256, receipt.runs[1].identity.sha256);
  assert.equal(receipt.cross_artifact_observation.exact_binary_sha256_equality_required, false);
  assert.equal(receipt.limitations.aioncore_native_readback_claimed, false);
  assert.equal(receipt.limitations.github_issue_comment_or_close_performed, false);

  assert.equal(policy.same_physical_runtime_currently_claimed, true);
  assert.equal(policy.packaged_evidence_contract.artifact_trigger_status, 'complete');
  assert.equal(policy.packaged_evidence_contract.evidence_receipt, receiptPath);
});

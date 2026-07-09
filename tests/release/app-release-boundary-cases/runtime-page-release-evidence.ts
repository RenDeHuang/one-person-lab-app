import {
  assert,
  fs,
  path,
  test,
  appRoot,
} from './helpers.ts';
import { validateReleaseEvidenceBundle } from '../../../scripts/validate-active-shell/release-evidence-bundle-validator.ts';

const readJson = (relativePath: string) => JSON.parse(
  fs.readFileSync(path.join(appRoot, relativePath), 'utf8'),
);
const assertIncludesAll = (actual: string[], expected: string[], label: string) => {
  for (const entry of expected) {
    assert.ok(actual.includes(entry), `${label}: ${entry}`);
  }
};
const ids = (entries = []) => entries.map((entry) => entry.id);

test('release evidence bundle keeps Runtime page evidence refs behind the bundle validator', () => {
  const releaseContract = readJson('contracts/app-release-channel.json');
  const pageStateMatrix = readJson('contracts/app-page-state-matrix.json');
  const firstRunMatrix = readJson('contracts/app-first-run-test-matrix.json');
  const bundle = releaseContract.operator_evidence_bundle;

  assert.doesNotThrow(() => validateReleaseEvidenceBundle(releaseContract, pageStateMatrix, firstRunMatrix));
  assert.equal(bundle.refs_only, true);
  assertIncludesAll(ids(bundle.required_artifacts), [
    'app_state_summary',
    'drilldown_full',
    'action_dry_run_result',
    'action_execute_result',
    'runtime_screenshot',
    'remote_release_verification',
  ], 'required release evidence artifacts');
  assertIncludesAll(ids(bundle.optional_diagnostic_artifacts), [
    'codex_ai_self_check_summary',
  ], 'optional diagnostic evidence artifacts');
  assertIncludesAll(bundle.forbidden_authority, [
    'runtime_truth',
    'provider_implementation',
    'domain_truth',
    'domain_quality_verdict',
    'domain_artifact_authority',
  ], 'forbidden App authority');
  assert.equal(bundle.l5_evidence_readout.release_ready_claim_allowed, false);
  assert.equal(bundle.l5_evidence_readout.family_l5_claim_allowed, false);
});

test('source material user path stays refs-only before domain agent handoff', () => {
  const runtimeBridge = readJson('contracts/app-runtime-bridge.json');
  const guiContract = readJson('contracts/app-gui-product-contract.json');
  const pageStateMatrix = readJson('contracts/app-page-state-matrix.json');
  const sourceMaterial = runtimeBridge.source_material_projection;
  const guiRoute = guiContract.source_material_user_path;
  const ordinaryPage = pageStateMatrix.pages.find((page) => page.id === 'ordinary_conversation');
  const inspectorPage = pageStateMatrix.pages.find((page) => page.id === 'right_context_inspector');
  const requiredRefs = [
    'source_material_refs',
    'source_material_receipt_refs',
    'reference_design_packet_refs',
  ];

  assert.equal(sourceMaterial.refs_only, true);
  assert.equal(guiRoute.refs_only, true);
  for (const field of [
    'source_body_access',
    'pdf_parse_access',
    'artifact_body_access',
    'domain_truth_write_access',
    'owner_receipt_write_access',
    'domain_verdict_authority',
    'readiness_authority',
  ]) {
    assert.equal(sourceMaterial[field], false, `source material ${field}`);
  }
  for (const field of [
    'source_body_access',
    'pdf_parse_access',
    'artifact_body_access',
    'domain_verdict_authority',
    'owner_receipt_write_access',
    'release_readiness_authority',
  ]) {
    assert.equal(guiRoute[field], false, `GUI source route ${field}`);
  }
  for (const refField of requiredRefs) {
    assert.ok(sourceMaterial.required_ref_fields.includes(refField), refField);
    assert.ok(guiRoute.machine_ref_fields.includes(refField), refField);
    assert.ok(guiContract.ordinary_conversation.current_task_slice.fields.includes(refField), refField);
    assert.ok(guiContract.right_context_inspector.current_task_evidence.fields.includes(refField), refField);
    assert.ok(ordinaryPage.conversation_view_model.current_task_slice.fields.includes(refField), refField);
    assert.ok(inspectorPage.inspector_view_model.current_task_evidence.fields.includes(refField), refField);
  }
  assert.equal(guiRoute.route_contract_ref, 'contracts/app-runtime-bridge.json#source_material_projection');
  assert.equal(guiRoute.framework_ingest_command, sourceMaterial.ingest_command);
  assert.equal(
    inspectorPage.inspector_view_model.current_task_evidence.source_material_projection_ref,
    'contracts/app-runtime-bridge.json#source_material_projection',
  );
});

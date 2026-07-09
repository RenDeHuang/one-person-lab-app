import {
  assert,
  fs,
  path,
  test,
  appRoot,
} from './helpers.ts';

test('release evidence bundle records Runtime page acceptance artifacts without App authority', () => {
  const releaseContract = JSON.parse(
    fs.readFileSync(path.join(appRoot, 'contracts', 'app-release-channel.json'), 'utf8'),
  );
  const pageStateMatrix = JSON.parse(
    fs.readFileSync(path.join(appRoot, 'contracts', 'app-page-state-matrix.json'), 'utf8'),
  );
  const firstRunMatrix = JSON.parse(
    fs.readFileSync(path.join(appRoot, 'contracts', 'app-first-run-test-matrix.json'), 'utf8'),
  );
  const runtimePage = pageStateMatrix.pages.find((page) => page.id === 'runtime');
  const fullFirstRun = firstRunMatrix.scenarios.find((scenario) => scenario.id === 'full_first_install_clean_machine');
  const bundle = releaseContract.operator_evidence_bundle;
  const artifactById = new Map(bundle.required_artifacts.map((artifact) => [artifact.id, artifact]));
  const diagnosticById = new Map((bundle.optional_diagnostic_artifacts ?? []).map((artifact) => [artifact.id, artifact]));

  assert.equal(bundle.purpose, 'runtime_page_operator_evidence_acceptance');
  assert.equal(bundle.acceptance_path, 'Runtime page');
  assert.equal(bundle.runtime_page_contract, 'contracts/app-page-state-matrix.json#runtime');
  assert.equal(bundle.refs_only, true);
  assert.equal(bundle.bundle_root_pattern, 'release-evidence/<version>/');
  assert.equal(bundle.manifest_path, 'evidence-manifest.json');
  assert.deepEqual(bundle.missing_evidence_policy, {
    default_validation: 'fail_closed',
    allow_missing_evidence_flag: '--allow-missing-evidence',
    missing_status: 'missing_evidence',
    allowed_artifact_statuses: [
      'present',
      'missing',
      'typed_blocker',
      'not_applicable',
    ],
    typed_blocker_status_requires: [
      'reason',
      'typed_blocker_ref',
    ],
    typed_blocker_path_pattern: 'typed-blockers/<artifact_id>.json',
    not_applicable_status_requires: [
      'reason',
      'not_applicable_reason',
    ],
    packaged_app_evidence_requires: 'all_required_artifacts_present_and_verified',
  });
  assert.deepEqual(bundle.image_evidence_policy, {
    applies_to_kind: 'image',
    minimum_width_px: 640,
    minimum_height_px: 360,
    minimum_file_size_bytes: 4096,
    placeholder_screenshot_allowed: false,
  });
  assert.equal(
    artifactById.get('app_state_summary').producer,
    'opl app state --profile fast --json',
  );
  assert.equal(
    artifactById.get('app_state_full').producer,
    'opl app state --profile full --json',
  );
  assert.equal(
    artifactById.get('drilldown_full').producer,
    runtimePage.operator_evidence_acceptance_path.full_drilldown_command,
  );
  assert.equal(
    artifactById.get('action_dry_run_result').producer,
    runtimePage.operator_evidence_acceptance_path.action_dry_run_command,
  );
  assert.equal(
    artifactById.get('action_execute_result').producer,
    runtimePage.operator_evidence_acceptance_path.action_execute_command,
  );
  assert.deepEqual(
    [...artifactById.values()].map((artifact) => artifact.path),
    [
      'app-state-summary.json',
      'app-state-full.json',
      'drilldown-full.json',
      'action-dry-run-result.json',
      'action-execute-result.json',
      'screenshots/runtime.png',
      'screenshots/full.png',
      'screenshots/action.png',
      'tart-smoke-summary.json',
      'artifacts/smoke-summary.json',
      'artifacts/assistant-route-smoke-summary.json',
      'artifacts/codex-functional-check-summary.json',
      'artifacts/assistant-route-smoke/mas.png',
      'artifacts/assistant-route-smoke/mag.png',
      'artifacts/assistant-route-smoke/rca.png',
      'remote-release-verification.json',
    ],
  );
  assert.deepEqual(diagnosticById.get('codex_ai_self_check_summary'), {
    id: 'codex_ai_self_check_summary',
    path: 'artifacts/codex-ai-self-check-summary.json',
    kind: 'json',
    producer: 'packaged GUI Codex AI-first post-install self-check',
    source_kind: 'packaged_gui_codex_ai_self_check',
  });
  assert.deepEqual(
    [...artifactById.values()].map((artifact) => artifact.source_kind),
    [
      'opl_app_state_summary',
      'opl_app_state_full',
      'opl_app_operator_drilldown_full',
      'opl_app_action_dry_run',
      'opl_app_action_execute',
      'app_runtime_page_screenshot',
      'full_first_install_release_screenshot',
      'app_runtime_action_screenshot',
      'clean_first_run_vm_smoke',
      'packaged_gui_first_run_smoke',
      'packaged_gui_assistant_route_smoke',
      'packaged_gui_codex_functional_check',
      'packaged_gui_assistant_route_smoke_screenshot',
      'packaged_gui_assistant_route_smoke_screenshot',
      'packaged_gui_assistant_route_smoke_screenshot',
      'remote_release_verification',
    ],
  );
  assert.deepEqual(fullFirstRun.release_evidence_artifacts, [
    'app-wrapper-diagnostics.json',
    'app-wrapper-preflight.log',
    'app-wrapper-smoke-command-preview.txt',
    'app-wrapper-smoke.stdout.log',
    'app-wrapper-smoke.stderr.log',
    'tart-smoke-summary.json',
    'artifacts/smoke-summary.json',
    'artifacts/system-initialize.json',
    'artifacts/settings-smoke-summary.json',
    'artifacts/assistant-route-smoke-summary.json',
    'artifacts/codex-functional-check-summary.json',
    'artifacts/assistant-route-smoke/mas.png',
    'artifacts/assistant-route-smoke/mag.png',
    'artifacts/assistant-route-smoke/rca.png',
  ]);
  for (const forbiddenAuthority of [
    'runtime_truth',
    'provider_implementation',
    'domain_truth',
    'domain_quality_verdict',
    'domain_artifact_authority',
  ]) {
    assert.ok(bundle.forbidden_authority.includes(forbiddenAuthority), forbiddenAuthority);
  }
  assert.match(bundle.acceptance_rule, /does not reinterpret the bundle as runtime truth/);
  assert.deepEqual(bundle.l5_evidence_readout, {
    schema: 'opl_app_release_l5_evidence_readout_contract.v1',
    scope: 'app_release_user_path_evidence_for_opl_console_l5_input',
    framework_l5_contract_ref: 'one-person-lab/contracts/opl-framework/brand-module-l5-operating-evidence.json',
    target_l5_module: 'opl_console',
    ordinary_cockpit_excluded: true,
    ordinary_cockpit_policy_ref: 'contracts/app-gui-product-contract.json#ordinary_cockpit_surface_budget',
    forbidden_default_surfaces: [
      'guid_home',
      'ordinary_conversation',
      'runtime_default_cockpit',
      'settings_general',
    ],
    release_ready_claim_allowed: false,
    family_l5_claim_allowed: false,
    evidence_classes: [
      {
        class_id: 'live_user_path',
        accepted_ref_shapes: ['user_path_evidence_ref', 'operator_evidence_ref', 'typed_blocker_ref'],
        artifact_ids: ['app_state_summary', 'runtime_screenshot', 'guest_smoke_summary', 'first_run_vm_summary'],
        gate_ids: ['standard_dmg_clean_vm', 'one_shot_app_installer'],
      },
      {
        class_id: 'cross_agent_scaleout',
        accepted_ref_shapes: ['scaleout_receipt_ref', 'per_agent_receipt_ref', 'typed_blocker_ref'],
        artifact_ids: [
          'assistant_route_smoke_summary',
          'assistant_route_smoke_mas_screenshot',
          'assistant_route_smoke_mag_screenshot',
          'assistant_route_smoke_rca_screenshot',
          'codex_functional_check_summary',
        ],
        gate_ids: ['operator_evidence_bundle'],
      },
      {
        class_id: 'long_soak_recovery',
        accepted_ref_shapes: ['long_soak_ref', 'recovery_ref', 'dead_letter_ref', 'typed_blocker_ref'],
        artifact_ids: ['drilldown_full', 'action_dry_run_result', 'action_execute_result'],
        gate_ids: ['operator_evidence_bundle'],
      },
      {
        class_id: 'release_install_evidence',
        accepted_ref_shapes: ['release_evidence_ref', 'install_evidence_ref', 'descriptor_drift_ref', 'typed_blocker_ref'],
        artifact_ids: ['remote_release_verification', 'docker_webui_clean_vm_evidence', 'first_run_vm_summary', 'guest_smoke_summary'],
        gate_ids: [
          'remote_release_verification',
          'stable_homebrew_tap_update',
          'full_homebrew_tap_update',
          'homebrew_standard_cask_clean_vm',
          'full_dmg_clean_vm',
          'full_size_cache_timing',
        ],
      },
      {
        class_id: 'operator_repair_loop',
        accepted_ref_shapes: ['repair_loop_ref', 'current_owner_delta_ref', 'safe_action_ref', 'typed_blocker_ref'],
        artifact_ids: [
          'app_state_summary',
          'app_state_full',
          'drilldown_full',
          'action_dry_run_result',
          'action_execute_result',
          'action_screenshot',
        ],
        gate_ids: ['operator_evidence_bundle'],
      },
      {
        class_id: 'owner_acceptance',
        accepted_ref_shapes: ['owner_acceptance_ref', 'owner_receipt_ref', 'typed_blocker_ref', 'human_gate_ref'],
        owner_acceptance_required: true,
      },
      {
        class_id: 'no_second_truth_regression',
        accepted_ref_shapes: ['no_resurrection_guard_ref', 'negative_guard_ref', 'source_scan_ref', 'typed_blocker_ref'],
        gate_ids: ['operator_evidence_bundle', 'docker_webui', 'webui_ghcr_publish', 'docker_webui_clean_vm_evidence'],
      },
    ],
  });
});

test('source material user path stays refs-only before domain agent handoff', () => {
  const runtimeBridge = JSON.parse(
    fs.readFileSync(path.join(appRoot, 'contracts', 'app-runtime-bridge.json'), 'utf8'),
  );
  const guiContract = JSON.parse(
    fs.readFileSync(path.join(appRoot, 'contracts', 'app-gui-product-contract.json'), 'utf8'),
  );
  const pageStateMatrix = JSON.parse(
    fs.readFileSync(path.join(appRoot, 'contracts', 'app-page-state-matrix.json'), 'utf8'),
  );
  const sourceMaterial = runtimeBridge.source_material_projection;
  const guiRoute = guiContract.source_material_user_path;
  const ordinaryPage = pageStateMatrix.pages.find((page) => page.id === 'ordinary_conversation');
  const inspectorPage = pageStateMatrix.pages.find((page) => page.id === 'right_context_inspector');
  const requiredRefs = [
    'source_material_refs',
    'source_material_receipt_refs',
    'reference_design_packet_refs',
  ];

  assert.equal(
    sourceMaterial.ingest_command,
    'opl workspace source ingest --workspace <workspace_ref> --files <file_refs> --goal <user_goal> --json',
  );
  assert.equal(sourceMaterial.authority, 'opl_framework_source_material_refs_projection');
  assert.equal(sourceMaterial.reference_design_consumer, 'opl-meta-agent');
  assert.equal(sourceMaterial.refs_only, true);
  assert.equal(sourceMaterial.source_body_access, false);
  assert.equal(sourceMaterial.pdf_parse_access, false);
  assert.equal(sourceMaterial.artifact_body_access, false);
  assert.equal(sourceMaterial.domain_truth_write_access, false);
  assert.equal(sourceMaterial.owner_receipt_write_access, false);
  assert.equal(sourceMaterial.domain_verdict_authority, false);
  assert.equal(sourceMaterial.readiness_authority, false);
  for (const refField of requiredRefs) {
    assert.ok(sourceMaterial.required_ref_fields.includes(refField), refField);
    assert.ok(guiRoute.machine_ref_fields.includes(refField), refField);
    assert.ok(guiContract.ordinary_conversation.current_task_slice.fields.includes(refField), refField);
    assert.ok(guiContract.right_context_inspector.current_task_evidence.fields.includes(refField), refField);
    assert.ok(ordinaryPage.conversation_view_model.current_task_slice.fields.includes(refField), refField);
    assert.ok(inspectorPage.inspector_view_model.current_task_evidence.fields.includes(refField), refField);
  }
  for (const forbiddenClaim of [
    'source_body',
    'pdf_parse_quality',
    'reference_design_quality_verdict',
    'domain_truth',
    'owner_receipt_authority',
    'app_release_readiness',
  ]) {
    assert.ok(sourceMaterial.forbidden_claims.includes(forbiddenClaim), forbiddenClaim);
  }
  assert.equal(guiRoute.route_contract_ref, 'contracts/app-runtime-bridge.json#source_material_projection');
  assert.equal(guiRoute.framework_ingest_command, sourceMaterial.ingest_command);
  assert.equal(guiRoute.ui_implementation_status, 'route_contract_landed_no_live_drag_drop_ui_evidence');
  assert.match(guiRoute.domain_handoff_policy, /OMA/);
  assert.match(guiRoute.domain_handoff_policy, /MAS/);
  assert.equal(
    inspectorPage.inspector_view_model.current_task_evidence.source_material_projection_ref,
    'contracts/app-runtime-bridge.json#source_material_projection',
  );
});

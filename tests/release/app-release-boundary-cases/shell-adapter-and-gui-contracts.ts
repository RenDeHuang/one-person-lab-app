import {
  assert,
  fs,
  path,
  test,
  appRoot,
  activeShellRoot,
  expectedOrdinaryCockpitForbiddenTerms,
  expectedSettingsPageSections,
  runNode,
  readProductProfile,
} from './helpers.ts';

test('tag-triggered release workflow stamps package metadata from tag version', () => {
  const workflow = fs.readFileSync(path.join(appRoot, '.github', 'workflows', '_build-reusable.yml'), 'utf8');
  const tagVersionResolver = [
    'if [ -z "$version" ] && [[ "$GITHUB_REF" == refs/tags/v* ]]; then',
    'version="${REF_NAME#v}"',
    'echo "OPL_RELEASE_VERSION=$version" >> "$GITHUB_ENV"',
  ];

  for (const expectedLine of tagVersionResolver) {
    assert.match(workflow, new RegExp(expectedLine.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
});

test('active shell command wrapper injects App release version for local builds', () => {
  const today = new Date();
  const expectedDefaultVersion = `${String(today.getUTCFullYear()).slice(-2)}.${today.getUTCMonth() + 1}.${today.getUTCDate()}`;
  const printVersion = ['scripts/run-active-shell-command.ts', process.execPath, '-e', 'process.stdout.write(process.env.OPL_RELEASE_VERSION || "")'];

  const defaultResult = runNode(printVersion, { env: { OPL_RELEASE_VERSION: '' } });
  assert.equal(defaultResult.status, 0, defaultResult.stderr || defaultResult.stdout);
  assert.equal(defaultResult.stdout, expectedDefaultVersion);

  const explicitResult = runNode(printVersion, { env: { OPL_RELEASE_VERSION: '30.1.2-test.3' } });
  assert.equal(explicitResult.status, 0, explicitResult.stderr || explicitResult.stdout);
  assert.equal(explicitResult.stdout, '30.1.2-test.3');
});

test('release code-quality uses App active-shell test runner', () => {
  const workflow = fs.readFileSync(path.join(appRoot, '.github', 'workflows', '_build-reusable.yml'), 'utf8');

  assert.match(workflow, /node --experimental-strip-types scripts\/run-active-shell-tests\.ts/);
  assert.doesNotMatch(workflow, /run:\s*bunx vitest run/);
});

test('release build uses App wrappers for cross-shell active-shell commands', () => {
  const workflow = fs.readFileSync(path.join(appRoot, '.github', 'workflows', '_build-reusable.yml'), 'utf8');
  const packageJson = JSON.parse(fs.readFileSync(path.join(appRoot, 'package.json'), 'utf8'));
  const adapterContract = JSON.parse(fs.readFileSync(path.join(appRoot, 'contracts', 'app-shell-adapter.json'), 'utf8'));
  const shellBuildScript = fs.readFileSync(path.join(activeShellRoot, 'scripts', 'build-with-builder.js'), 'utf8');
  const shellViteConfig = fs.readFileSync(
    path.join(activeShellRoot, 'packages', 'desktop', 'electron.vite.config.ts'),
    'utf8',
  );

  assert.match(workflow, /command:\s*bun install --cwd shells\/aionui --frozen-lockfile/);
  assert.doesNotMatch(workflow, /command:\s*cd shells\/aionui && bun install --frozen-lockfile/);
  assert.equal(adapterContract.shell_contract.layout_id, 'aionui_v2_workspace');
  assert.equal(adapterContract.shell_contract.paths.product_profile_target, 'packages/desktop/src/common/config/oplProductProfile/oplProductProfile.generated.json');
  assert.equal(adapterContract.shell_contract.paths.electron_builder_config, 'packages/desktop/electron-builder.yml');
  assert.equal(adapterContract.shell_source.upstream_ref, '19bc89cca3114af9856d09886362aed615dfa1e2');
  assert.match(
    workflow,
    /name: Prepare standard App payload[\s\S]*working-directory: \$\{\{ github\.workspace \}\}[\s\S]*run: node --experimental-strip-types scripts\/prepare-standard-release-payload\.ts/,
  );
  assert.match(
    workflow,
    /name: Verify packaged bundled bun assets[\s\S]*working-directory: \$\{\{ github\.workspace \}\}[\s\S]*run: bun run validate:opl-package/,
  );
  assert.equal(packageJson.scripts['test:packaged:bun'], 'node --experimental-strip-types scripts/run-active-shell-command.ts bun run validate:opl-package');
  assert.equal(packageJson.scripts['validate:app-root-boundary'], 'node --experimental-strip-types scripts/app-root-boundary.ts');
  assert.equal(packageJson.scripts['install:shell'], 'node --experimental-strip-types scripts/run-active-shell-command.ts bun install --frozen-lockfile');
  assert.equal(
    packageJson.scripts['validate:gui-shell'],
    'node --experimental-strip-types scripts/validate-active-shell.ts && node --experimental-strip-types scripts/prepare-standard-release-payload.ts && node --experimental-strip-types scripts/run-active-shell-command.ts bun run package',
  );
  assert.doesNotMatch(JSON.stringify(packageJson.scripts), /--cwd shells\/aionui|cd shells\/aionui/);
  assert.match(shellBuildScript, /--config\.extraMetadata\.version=\$\{version\}/);
  assert.match(shellBuildScript, /\$\{publishArg\} \$\{oplReleaseVersionConfigArg\}/);
  assert.match(shellViteConfig, /const appReleaseVersion = injectedOplReleaseVersion \|\| rootPackageJson\.version/);
  assert.match(shellViteConfig, /__APP_VERSION__:\s*JSON\.stringify\(appReleaseVersion\)/);
});

test('active shell adapter keeps GUI authority and replacement gates in the App repo', () => {
  const adapterContract = JSON.parse(fs.readFileSync(path.join(appRoot, 'contracts', 'app-shell-adapter.json'), 'utf8'));

  assert.equal(adapterContract.gui_authority.source_of_truth, 'one-person-lab-app');
  assert.equal(adapterContract.gui_authority.implementation_role, 'active_shell_implementation_carrier');
  for (const contractRef of [
    'contracts/app-gui-product-contract.json',
    'contracts/app-product-profile.json',
    'contracts/app-install-exposure-policy.json',
    'contracts/app-page-state-matrix.json',
    'contracts/app-first-run-test-matrix.json',
    'contracts/app-release-channel.json',
  ]) {
    assert.ok(adapterContract.gui_authority.product_contracts.includes(contractRef), contractRef);
  }
  assert.deepEqual(adapterContract.gui_authority.shell_may_own, [
    'concrete renderer implementation',
    'process and preload implementation',
    'shell package metadata',
    'shell tests and release hooks',
    'upstream AionUI intake',
    'shell-local implementation details',
    'shell-local tests that prove App contracts are implemented',
  ]);
  assert.deepEqual(adapterContract.gui_authority.shell_must_not_own, [
    'App GUI product truth',
    'App user-facing page-state authority',
    'App model-selection policy',
    'App onboarding policy',
    'App release/user documentation authority',
    'App release gate policy',
    'OPL runtime truth',
    'domain truth',
    'provider implementation',
  ]);
  assert.equal(
    adapterContract.gui_authority.upstream_intake_policy,
    'check_against_app_owned_gui_contracts_before_acceptance',
  );
  assert.equal(adapterContract.gui_product_contract, 'contracts/app-gui-product-contract.json');
  assert.deepEqual(adapterContract.gui_product_contract_policy, {
    must_implement: true,
    source_of_truth: 'one-person-lab-app',
    upstream_override_allowed: false,
    upstream_family_role: 'implementation_material_only',
    aionui_upstream_must_not_override_app_truth: true,
  });
  assert.deepEqual(adapterContract.state_surface_contract, {
    primary_read_command: 'opl app state --profile fast --json',
    refresh_read_command: 'opl app state --profile fast --json',
    full_state_read_command: 'opl app state --profile full --json',
    full_state_policy: 'diagnostic_or_release_evidence_only',
    action_command: 'opl app action execute --action <action_id> [--payload json] [--dry-run] --json',
    full_drilldown_exception: 'opl runtime app-operator-drilldown --detail full --json',
    forbidden_gui_truth_sources: [
      'direct opl connect modules --json page aggregation',
      'direct opl system developer-supervisor page aggregation',
      'direct opl family-runtime worker status page aggregation',
      'application.systemInfo as OPL path truth',
      'application.appVersions as OPL release truth',
      'direct reads of OPL internal state files',
    ],
  });
  for (const capability of [
    'app_owned_gui_product_contract',
    'opl_app_state_bridge',
    'opl_app_action_bridge',
    'app_gui_release_channel_gating',
  ]) {
    assert.ok(adapterContract.shell_contract.capabilities.includes(capability), capability);
  }
  assert.ok(!('docker_webui_contract' in adapterContract));

  assert.equal(adapterContract.shell_replacement_policy.candidate_root_pattern, 'shells/<candidate>');
  assert.equal(
    adapterContract.shell_replacement_policy.candidate_state,
    'candidate_until_contracts_and_tests_complete',
  );
  assert.equal(adapterContract.shell_replacement_policy.authority_transfer_allowed, false);
  for (const gate of [
    'declare candidate in contracts/app-shell-candidates.json',
    'implement contracts/app-gui-product-contract.json',
    'sync App product profile into the candidate shell target',
    'pass App page-state and first-run matrices',
    'pass App-root active shell validation',
    'pass GUI package compile through App wrapper',
    'preserve external checkout history policy',
  ]) {
    assert.ok(adapterContract.shell_replacement_policy.adoption_gate.includes(gate), gate);
  }
  assert.ok(
    !adapterContract.shell_replacement_policy.adoption_gate.includes('declare candidate in contracts/app-shell-adapter.json'),
  );
});

test('App shell candidates are isolated from active AionUI release shell', () => {
  const packageJson = JSON.parse(fs.readFileSync(path.join(appRoot, 'package.json'), 'utf8'));
  const adapterContract = JSON.parse(fs.readFileSync(path.join(appRoot, 'contracts', 'app-shell-adapter.json'), 'utf8'));
  const candidateRegistry = JSON.parse(
    fs.readFileSync(path.join(appRoot, 'contracts', 'app-shell-candidates.json'), 'utf8'),
  );
  const aguiCandidate = candidateRegistry.candidates.find((candidate) => candidate.id === 'agui-codex');

  assert.equal(packageJson.scripts['validate:shell-candidates'], 'node --experimental-strip-types scripts/validate-shell-candidates.ts');
  assert.equal(candidateRegistry.owner, 'one-person-lab-app');
  assert.equal(candidateRegistry.purpose, 'app_shell_candidate_registry');
  assert.equal(candidateRegistry.state, 'active_experimental');
  assert.equal(candidateRegistry.active_shell_unchanged, adapterContract.active_shell);
  assert.equal(candidateRegistry.release_shell_contract, 'contracts/app-shell-adapter.json');
  assert.equal(candidateRegistry.candidate_policy.release_participation_until_adopted, 'explicit_candidate_build_only');
  assert.equal(candidateRegistry.candidate_policy.release_scripts_must_use_active_shell_adapter, true);
  assert.equal(candidateRegistry.candidate_policy.authority_transfer_allowed, false);
  assert.ok(candidateRegistry.candidate_policy.adoption_gate.includes('candidate is declared in contracts/app-shell-candidates.json'));
  assert.ok(
    candidateRegistry.candidate_policy.adoption_gate.includes(
      'contracts/app-shell-adapter.json is changed only when candidate becomes active release shell',
    ),
  );
  assert.ok(aguiCandidate);
  assert.equal(aguiCandidate.state, 'technical_verification');
  assert.equal(aguiCandidate.candidate_root, 'shells/agui-codex');
  assert.equal(aguiCandidate.adapter_contract, 'contracts/shell-adapters/agui-codex.json');
  assert.equal(aguiCandidate.source_topology, 'external_checkout_linked_shell_repo');
  assert.equal(aguiCandidate.release_participation, 'selectable_for_explicit_candidate_build');
  assert.equal(aguiCandidate.target_product_shape.codex_cli_fixed_executor, true);
  assert.equal(aguiCandidate.target_product_shape.home_executor_selector_visible, false);
  assert.equal(aguiCandidate.target_product_shape.home_backend_selector_visible, false);
  assert.equal(aguiCandidate.target_product_shape.home_model_selector_visible, true);
  assert.equal(aguiCandidate.target_product_shape.permission_mode_selector_visible, false);
  assert.deepEqual(aguiCandidate.target_product_shape.purpose_entries, ['research', 'grant', 'ppt']);
  assert.equal(aguiCandidate.framework_surfaces.state, 'opl app state --profile fast --json');
  assert.equal(
    aguiCandidate.framework_surfaces.action,
    'opl app action execute --action <action_id> [--payload json] [--dry-run] --json',
  );
  assert.ok(aguiCandidate.required_capabilities.includes('agui_event_contract_map'));
  assert.ok(aguiCandidate.required_capabilities.includes('release_isolation'));
  assert.ok(aguiCandidate.required_capabilities.includes('candidate_app_bundle_package'));
  assert.ok(aguiCandidate.validation_commands.some((entry) => (
    entry.id === 'candidate_app_bundle_build'
    && /OPL_APP_SHELL_ADAPTER_CONTRACT=contracts\/shell-adapters\/agui-codex\.json npm run package/.test(entry.command)
  )));
  assert.ok(aguiCandidate.must_not_own.includes('App GUI product truth'));
  assert.ok(aguiCandidate.must_not_own.includes('OPL runtime truth'));
  assert.ok(aguiCandidate.must_not_own.includes('domain truth'));
  assert.ok(aguiCandidate.non_goals.includes('do not switch active_shell away from aionui'));
  assert.ok(aguiCandidate.non_goals.includes('do not enter default stable or nightly release packaging'));
});

test('explicit AG-UI/Codex adapter contract selects linked external candidate shell', () => {
  const result = runNode(
    [
      '-e',
      "import('./scripts/app-shell-adapter.ts').then(({ resolveActiveShellPaths }) => { const shell = resolveActiveShellPaths(); console.log(JSON.stringify({ active_shell: shell.contract.active_shell, shell_root: shell.contract.shell_root, shell_root_for_display: shell.shellRootForDisplay, product_profile_target: shell.productProfileTargetPath, release_role: shell.contract.release_role })); })",
    ],
    {
      env: {
        OPL_APP_SHELL_ADAPTER_CONTRACT: 'contracts/shell-adapters/agui-codex.json',
        OPL_APP_SHELL_ROOT: '',
      },
    },
  );

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const resolved = JSON.parse(result.stdout);
  assert.equal(resolved.active_shell, 'agui-codex');
  assert.equal(resolved.shell_root, 'shells/agui-codex');
  assert.equal(resolved.shell_root_for_display, 'shells/agui-codex');
  assert.match(resolved.product_profile_target, /shells\/agui-codex\/src\/generated\/oplProductProfile\.generated\.json$/);
  assert.equal(resolved.release_role, 'experimental_candidate_shell');
});

test('AG-UI/Codex candidate package validation requires a real app bundle manifest', () => {
  const dispatcherSource = fs.readFileSync(path.join(appRoot, 'scripts', 'validate-shell-candidates.ts'), 'utf8');
  const packageValidationSource = fs.readFileSync(
    path.join(appRoot, 'scripts', 'validate-shell-candidates', 'candidate-evidence.ts'),
    'utf8',
  );
  const candidateAdapter = JSON.parse(
    fs.readFileSync(path.join(appRoot, 'contracts', 'shell-adapters', 'agui-codex.json'), 'utf8'),
  );

  assert.equal(candidateAdapter.shell_contract.layout_id, 'agui_codex_app_bundle');
  assert.ok(candidateAdapter.shell_contract.capabilities.includes('candidate_app_bundle_package'));
  assert.ok(candidateAdapter.validation_commands.some((entry) => entry.id === 'candidate_app_bundle_build'));
  assert.match(dispatcherSource, /runCandidateCommands\(candidate\)/);
  assert.match(packageValidationSource, /validateCandidatePackageManifest/);
  assert.match(packageValidationSource, /candidate_app_bundle_ready/);
  assert.match(packageValidationSource, /explicit_candidate_app_bundle/);
  assert.match(packageValidationSource, /\.endsWith\('\.app'\)/);
  assert.match(packageValidationSource, /assertDirectory\(appBundleRoot/);
  assert.match(packageValidationSource, /Contents', 'Info\.plist'/);
  assert.match(packageValidationSource, /Contents', 'MacOS'/);
  assert.match(packageValidationSource, /findMacAppExecutable/);
  assert.match(packageValidationSource, /assertNoAbsoluteSymlinks/);
  assert.match(packageValidationSource, /App-owned product profile input/);
  assert.doesNotMatch(JSON.stringify(candidateAdapter), /candidate_package_smoke|candidate_package_smoke_ready|\.txt/);
});

test('default shell adapter remains stable AionUI when no candidate adapter is selected', () => {
  const result = runNode([
    '-e',
    "import('./scripts/app-shell-adapter.ts').then(({ resolveActiveShellPaths }) => { const shell = resolveActiveShellPaths(); console.log(JSON.stringify({ active_shell: shell.contract.active_shell, shell_root: shell.contract.shell_root, release_role: shell.contract.release_role })); })",
  ], { env: { OPL_APP_SHELL_ADAPTER_CONTRACT: '' } });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const resolved = JSON.parse(result.stdout);
  assert.equal(resolved.active_shell, 'aionui');
  assert.equal(resolved.shell_root, 'shells/aionui');
  assert.equal(resolved.release_role, 'stable_app_shell');
});

test('App GUI product contract owns GUI requirements and unified OPL state/action boundaries', () => {
  const guiContract = JSON.parse(
    fs.readFileSync(path.join(appRoot, 'contracts', 'app-gui-product-contract.json'), 'utf8'),
  );
  const releaseContract = JSON.parse(
    fs.readFileSync(path.join(appRoot, 'contracts', 'app-release-channel.json'), 'utf8'),
  );
  const pageStateMatrix = JSON.parse(
    fs.readFileSync(path.join(appRoot, 'contracts', 'app-page-state-matrix.json'), 'utf8'),
  );
  const productProfile = readProductProfile();

  assert.equal(guiContract.owner, 'one-person-lab-app');
  assert.equal(guiContract.purpose, 'app_owned_gui_product_contract');
  assert.equal(guiContract.product_authority.source_of_truth, 'one-person-lab-app');
  assert.equal(guiContract.product_authority.active_shell_role, 'implementation_carrier');
  assert.equal(guiContract.product_authority.upstream_gui_role, 'implementation_material_only');
  assert.equal(
    guiContract.product_authority.upstream_behavior_acceptance_policy,
    'must_match_app_owned_gui_product_contract_before_release',
  );
  assert.equal(guiContract.product_authority.shell_upgrade_policy.role, 'replaceable_implementation_carrier');
  assert.ok(guiContract.product_authority.shell_upgrade_policy.app_repo_controls.includes('settings information architecture'));
  assert.ok(guiContract.product_authority.shell_upgrade_policy.app_repo_controls.includes('home command center requirements'));
  assert.ok(guiContract.product_authority.shell_upgrade_policy.app_repo_controls.includes('page-state acceptance matrix'));
  assert.ok(guiContract.product_authority.shell_upgrade_policy.shell_repo_controls.includes('renderer implementation details'));
  assert.ok(guiContract.product_authority.shell_upgrade_policy.shell_repo_controls.includes('upstream AionUI intake patches'));
  assert.match(guiContract.product_authority.shell_upgrade_policy.upgrade_rule, /App-owned contracts/);
  assert.match(guiContract.product_authority.shell_upgrade_policy.replacement_rule, /active-shell validation/);
  assert.equal(guiContract.framework_surfaces.canonical_state.default_command, 'opl app state --profile fast --json');
  assert.equal(guiContract.framework_surfaces.canonical_state.refresh_command, 'opl app state --profile fast --json');
  assert.equal(guiContract.framework_surfaces.canonical_state.default_operator_payload, 'current_owner_delta');
  assert.equal('compatibility_operator_payload' in guiContract.framework_surfaces.canonical_state, false);
  assert.equal(guiContract.framework_surfaces.canonical_state.default_profile, 'fast');
  assert.equal(guiContract.framework_surfaces.canonical_state.manual_refresh_profile, 'fast');
  assert.equal(guiContract.framework_surfaces.canonical_state.full_profile_policy, 'diagnostic_or_release_evidence_only');
  assert.deepEqual(guiContract.framework_surfaces.canonical_state.default_read_surface_policy, {
    default_projection: 'opl_current_owner_delta',
    source_path: 'app_state.operator.default_read_surface_policy',
    foundry_agent_os_cockpit_policy: 'first_screen_current_owner_delta_only_raw_worklist_evidence_provider_trace_drilldown_only',
    default_next_action_source: 'current_owner_delta',
    raw_worklist_generates_default_next_action: false,
    release_evidence_counts_as_release_ready: false,
    stage_run_cockpit_projection_ref: 'contracts/app-runtime-bridge.json#stage_run_cockpit_projection',
    first_screen_answers: [
      'next_safe_action_or_none',
      'current_owner',
      'required_delta',
      'accepted_return_shapes',
      'readiness_false_flags',
      'count_summary',
    ],
    full_detail_policy: 'explicit_full_detail_or_lazy_diagnostic_only',
    raw_refs_policy: 'raw_refs_require_explicit_full_detail',
    full_detail_auto_poll: false,
    shell_must_not_use_full_drilldown_as_normal_state: true,
    shell_must_not_derive_layout_from_raw_runtime_projection: true,
    forbidden_default_state_fields: [
      'runtime_tray_snapshot',
      'raw_evidence_envelope',
      'stage_replay_packet_body',
      'private_residue_inventory_body',
      'provider_internal_ledger_body',
    ],
  });
  assert.equal(
    guiContract.framework_surfaces.canonical_action.command,
    'opl app action execute --action <action_id> [--payload json] [--dry-run] --json',
  );
  assert.equal(
    guiContract.framework_surfaces.runtime_full_drilldown.command,
    'opl runtime app-operator-drilldown --detail full --json',
  );
  assert.equal(guiContract.framework_surfaces.runtime_full_drilldown.policy, 'on_demand_only');
  assert.deepEqual(guiContract.framework_surfaces.stage_run_cockpit, {
    projection_ref: 'contracts/app-runtime-bridge.json#stage_run_cockpit_projection',
    source: 'app_state.operator.workbench.task_drilldowns.stage_run_cockpit + app_state.operator.workbench.task_drilldowns.stage_run_cockpit_summary',
    equivalent_source: 'app_state.operator.workbench.task_drilldowns.stage_run_current_owner_delta',
    derived_from: 'current_owner_delta',
    display_policy: 'refs_only_stage_run_cockpit_display_guard_no_runtime_truth_claims',
    ordinary_fast_state_required: true,
    app_role: 'display_only_stage_run_cockpit_consumer',
  });
  assert.deepEqual(guiContract.framework_surfaces.runtime_default_attention.active_project_line_fields, [
    'app_state.operator.workbench.summary_cards[active_projects]',
    'app_state.operator.workbench.activity_center.active_projects',
    'app_state.operator.visual_ref_groups.active_project_refs',
  ]);
  assert.equal(
    guiContract.framework_surfaces.runtime_default_attention.active_project_line_policy,
    'queued_or_escalated_owner_handled_project_lines_count_as_user_visible_active_projects_without_claiming_active_worker_run',
  );
  assert.deepEqual(guiContract.framework_surfaces.runtime_default_attention.project_group_expansion_policy, {
    running_group_default: 'expanded',
    attention_group_default: 'visible_when_nonempty',
    inactive_group_default: 'collapsed',
    inactive_states: ['queued', 'pending', 'waiting', 'stopped', 'parked', 'checkpointed', 'blocked', 'attention_needed'],
    inactive_summary_fields: ['count', 'status', 'next_visible_step'],
  });
  assert.deepEqual(
    guiContract.framework_surfaces.runtime_default_attention.must_not_default_display_terms,
    [
      'Temporal',
      'provider',
      'projection',
      'ref',
      'stage attempt',
      'ledger',
      'current_control_state',
      'AionUI',
      'backend selector',
      'shell candidate',
      'runtime implementation selector',
    ],
  );
  assert.deepEqual(guiContract.ordinary_cockpit_surface_budget, {
    surface_id: 'ordinary_app_cockpit_surface_budget',
    purpose: 'keep Home, Runtime, and Settings focused on purpose, task status, next owner, artifact/blocker, and release facts',
    stage_run_cockpit_projection_ref: 'contracts/app-runtime-bridge.json#stage_run_cockpit_projection',
    stage_run_consumption_policy: 'ordinary fast App state must consume refs-only stage_run_cockpit, stage_run_cockpit_summary, or equivalent stage_run_current_owner_delta derived from current_owner_delta as display guard only',
    foundry_agent_os_cockpit_policy: 'first_screen_current_owner_delta_only_raw_worklist_evidence_provider_trace_drilldown_only',
    default_next_action_source: 'current_owner_delta',
    raw_worklist_generates_default_next_action: false,
    release_evidence_counts_as_release_ready: false,
    applies_to_pages: [
      'guid_home',
      'runtime',
      'settings_general',
      'access',
      'capabilities',
      'environment',
      'settings_theme',
      'advanced',
      'about',
      'update',
    ],
    ordinary_allowed_answer_shapes: [
      'purpose_entry',
      'task_status',
      'next_owner',
      'accepted_answer_shape',
      'artifact_or_blocker',
      'release_fact',
      'app_profile',
      'access_status',
      'agent_capability',
      'local_environment_status',
      'appearance_preference',
      'advanced_diagnostic_link',
      'about_update_fact',
      'provider_readiness_repair',
    ],
    ordinary_must_not_default_display_terms: expectedOrdinaryCockpitForbiddenTerms,
    diagnostics_escape_hatch: 'Advanced, release evidence, developer detail, or explicit full-detail drilldown only',
    source_policy: 'ordinary views consume opl app state --profile fast --json and must not derive first-screen layout from raw runtime drilldown',
  });
  assert.equal(guiContract.executor_policy.default_executor, 'codex_cli');
  assert.equal(guiContract.executor_policy.codex_cli_fixed_executor, true);
  assert.equal(guiContract.executor_policy.codex_only_default, true);
  assert.equal(guiContract.executor_policy.home_executor_selector_visible, false);
  assert.equal(guiContract.executor_policy.executor_tab_visible_when_single_executor, false);
  assert.equal(guiContract.executor_policy.default_model_strategy, 'codex_cli_auto_latest_available_frontier');
  assert.equal(guiContract.executor_policy.default_model_display_value, 'GPT-5.5（超高）');
  assert.equal(guiContract.executor_policy.home_model_status_label, 'GPT-5.5（超高）');
  assert.equal(
    guiContract.executor_policy.home_model_status_policy,
    'display_default_model_and_reasoning_with_visible_selector',
  );
  assert.equal(
    guiContract.executor_policy.conversation_model_status_policy,
    'display_same_model_and_reasoning_with_visible_selector_in_codex_conversation',
  );
  assert.equal(
    guiContract.executor_policy.conversation_pending_feedback_policy,
    'display_elapsed_seconds_while_ai_processing_or_backend_running',
  );
  assert.equal(guiContract.executor_policy.precise_model_display_policy, 'friendly_default_model_and_reasoning_visible');
  assert.equal(guiContract.executor_policy.permission_mode_selector_visible_on_home, false);
  assert.equal(guiContract.executor_policy.model_selector_visible_on_new_conversation, true);
  assert.equal(guiContract.executor_policy.model_selector_visible_in_conversation, true);
  assert.equal(guiContract.executor_policy.backend_selector_visible_in_conversation, false);
  assert.equal(guiContract.executor_policy.permission_mode_selector_visible_in_conversation, false);
  assert.equal(guiContract.executor_policy.user_model_override_allowed, true);
  assert.equal(guiContract.executor_policy.restore_auto_model_selection_allowed, true);
  assert.deepEqual(guiContract.executor_policy.frontier_model_preference_order, [
    'gpt-5.5',
    'gpt-5.4',
    'gpt-5.3-codex',
    'gpt-5.2',
  ]);
  assert.deepEqual(guiContract.default_assistants.map((assistant) => assistant.id), ['mas', 'mag', 'rca']);
  assert.ok(guiContract.default_assistants.every((assistant) => assistant.home_entry_policy === 'purpose_entry_target'));
  assert.deepEqual(guiContract.assistant_skill_profiles.map((profile) => profile.assistant_id), ['mas', 'mag', 'rca']);
  assert.deepEqual(
    Object.fromEntries(guiContract.assistant_skill_profiles.map((profile) => [profile.assistant_id, profile.required_skills])),
    { mas: ['mas'], mag: ['mag'], rca: ['rca'] },
  );
  assert.ok(
    guiContract.assistant_skill_profiles.every(
      (profile) => profile.skill_menu_policy === 'assistant_scoped_required_checked_optional_visible',
    ),
  );
  const guiContractPackagedSkillIds = new Set(productProfile.companion_payloads.default_packaged_codex_skill_ids);
  assert.ok(
    guiContract.assistant_skill_profiles.every((profile) =>
      [...profile.required_skills, ...profile.optional_skills].every((skill) => guiContractPackagedSkillIds.has(skill)),
    ),
  );
  assert.ok(guiContract.assistant_skill_profiles.every((profile) => !('hidden_home_skill_names' in profile)));
  assert.ok(guiContract.assistant_skill_profiles.every((profile) => !profile.optional_skills.includes('morph-ppt')));
  assert.equal(guiContract.builtin_assistant_route_receipt_policy.scope, 'home_purpose_entry_to_conversation');
  assert.deepEqual(guiContract.builtin_assistant_route_receipt_policy.required_for_assistants, ['mas', 'mag', 'rca']);
  assert.equal(guiContract.builtin_assistant_route_receipt_policy.route_kind, 'builtin_capability');
  assert.equal(guiContract.builtin_assistant_route_receipt_policy.executor, 'codex_cli');
  assert.equal(guiContract.builtin_assistant_route_receipt_policy.source, 'opl_app_home');
  assert.deepEqual(guiContract.builtin_assistant_route_receipt_policy.required_fields, [
    'route_kind',
    'executor',
    'assistant_id',
    'assistant_short_name',
    'source',
  ]);
  assert.equal(guiContract.builtin_assistant_route_receipt_policy.must_not_depend_on_visible_backend_selection, true);
  assert.deepEqual(guiContract.ordinary_capability_selector_policy, {
    scope: 'home_composer_and_ordinary_conversation',
    authority: 'app_owned_opl_allowlist',
    skill_source_ref: 'assistant_skill_profiles.required_skills + optional_skills',
    skill_menu_policy: 'assistant_scoped_required_checked_optional_visible',
    conversation_loaded_skill_display_policy: 'filter_to_ordinary_skill_allowlist',
    mcp_server_source_ref: 'contracts/app-product-profile.json#gui.ordinary_capability_selector_policy.visible_mcp_server_ids',
    mcp_menu_policy: 'empty_until_app_explicitly_whitelists_opl_mcp_servers',
    visible_mcp_server_ids: [],
    conversation_loaded_mcp_display_policy: 'filter_to_visible_mcp_server_ids',
    forbidden_skill_examples: ['aionui-skills', 'aionui-webui-setup', 'skill-creator', 'cron'],
    forbidden_mcp_policy: 'do_not_surface_user_or_aionui_mcp_servers_in_ordinary_home_without_app_profile_allowlist',
  });
  assert.deepEqual(guiContract.home_purpose_entries.map((entry) => entry.id), ['research', 'grant', 'ppt']);
  assert.deepEqual(guiContract.home_purpose_entries.map((entry) => entry.primary_label), ['科研', '基金', '演示']);
  assert.deepEqual(guiContract.home_purpose_entries.map((entry) => entry.target_assistant_id), ['mas', 'mag', 'rca']);
  assert.ok(guiContract.home_purpose_entries.every((entry) => entry.display_policy === 'purpose_first'));
  assert.equal(guiContract.non_default_assistants.find((assistant) => assistant.id === 'oma').home_default_visible, false);
  assert.equal(guiContract.retired_domain_agents.find((agent) => agent.id === 'mds').default_display_allowed, false);
  assert.equal(
    guiContract.product_authority.shell_upgrade_policy.fork_delta_budget.policy,
    'app_contract_first_thin_shell_delta',
  );
  assert.ok(
    guiContract.product_authority.shell_upgrade_policy.fork_delta_budget.preferred_optimization_path.includes(
      'encode product behavior in App contracts and product profile',
    ),
  );
  assert.ok(
    guiContract.product_authority.shell_upgrade_policy.fork_delta_budget.allowed_shell_delta.includes(
      'thin renderer components for App-owned pages',
    ),
  );
  assert.ok(
    guiContract.product_authority.shell_upgrade_policy.fork_delta_budget.requires_app_contract_before_shell_change.includes(
      'new visible model/provider/permission control',
    ),
  );
  assert.ok(
    guiContract.product_authority.shell_upgrade_policy.fork_delta_budget.forbidden_shell_delta.includes(
      'shell-owned product IA',
    ),
  );
  assert.equal(
    guiContract.product_authority.shell_upgrade_policy.fork_delta_budget.replacement_rule,
    'a candidate shell should implement the same App contracts by swapping adapters/profile consumers, not by inheriting AionUI-specific product logic',
  );
  assert.equal(guiContract.pages.guid_home.hero_prompt, '把研究、基金和汇报交给 One Person Lab 自动推进');
  assert.equal(guiContract.pages.guid_home.model_status.display_value, 'GPT-5.5（超高）');
  assert.equal(guiContract.pages.guid_home.model_status.selector_visible, true);
  assert.equal(
    guiContract.pages.guid_home.conversation_feedback_policy.pending_indicator,
    'visible elapsed seconds while request is pending or backend is running',
  );
  assert.equal(
    guiContract.pages.guid_home.conversation_feedback_policy.model_status,
    'same model status and selector appear in Codex conversation composer',
  );
  assert.equal(guiContract.pages.guid_home.conversation_feedback_policy.raw_trace_visible, false);
  assert.ok(guiContract.pages.guid_home.must_show.includes('single composer-first home input'));
  assert.ok(guiContract.pages.guid_home.must_show.includes('runtime/task progress available from Runtime page, not Home activity grid'));
  assert.ok(guiContract.pages.guid_home.must_not_show.includes('expanded workbench or activity refs grid on ordinary home'));
  assert.ok(guiContract.pages.guid_home.must_not_show.includes('compact continue-work entry near the home input'));
  assert.ok(guiContract.pages.guid_home.must_not_show.includes('Home footer feedback icon'));
  assert.ok(guiContract.pages.guid_home.must_not_show.includes('Home footer favorite/star icon'));
  assert.ok(guiContract.pages.guid_home.must_not_show.includes('Home footer web/access globe icon'));
  assert.equal(
    guiContract.pages.guid_home.activity_center_policy.source,
    'runtime page only; Home does not query running task lists',
  );
  assert.equal(guiContract.pages.guid_home.activity_center_policy.authority, 'app_owned_home_minimal_command_surface');
  assert.equal(
    guiContract.pages.guid_home.activity_center_policy.role,
    'home_runtime_activity_suppressed_to_keep_composer_first',
  );
  assert.equal(
    guiContract.pages.guid_home.activity_center_policy.default_placement,
    'not_rendered_on_ordinary_home',
  );
  assert.equal(
    guiContract.pages.guid_home.activity_center_policy.home_surface_policy,
    'ordinary_home_must_not_render_activity_center_or_continue_work_grid',
  );
  assert.deepEqual(guiContract.pages.guid_home.activity_center_policy.allowed_home_runtime_context, []);
  assert.ok(guiContract.pages.guid_home.activity_center_policy.must_not_display.includes('expanded continue-work center'));
  assert.ok(guiContract.pages.guid_home.activity_center_policy.must_not_display.includes('needs attention / active / recent activity groups'));
  assert.ok(guiContract.pages.guid_home.activity_center_policy.must_not_display.includes('domain artifact body'));
  assert.ok(guiContract.pages.guid_home.activity_center_policy.must_not_display.includes('memory body'));
  assert.ok(guiContract.pages.settings_advanced.must_show.includes('OPL Flow Context'));
  assert.ok(!guiContract.pages.settings_advanced.sections.includes('opl_agent_codex_context'));
  assert.ok(!('legacy_state_sections' in guiContract.pages.settings_advanced));
  for (const pageId of guiContract.ordinary_cockpit_surface_budget.applies_to_pages) {
    const matrixPage = pageStateMatrix.pages.find((page) => page.id === pageId);
    assert.equal(
      matrixPage.ordinary_cockpit_surface_budget_ref,
      'contracts/app-gui-product-contract.json#ordinary_cockpit_surface_budget',
      `${pageId} must consume the ordinary cockpit surface budget`,
    );
  }
  assert.deepEqual(guiContract.settings_navigation.ordinary_visible_tabs, [
    'general',
    'access',
    'capabilities',
    'environment',
    'appearance',
    'advanced',
    'about',
  ]);
  assert.deepEqual(guiContract.settings_navigation.legacy_route_redirects, {
    overview: 'general',
    runtime: 'environment',
    system: 'advanced',
    model: 'environment',
    agent: 'capabilities',
    assistants: 'capabilities',
    'skills-hub': 'capabilities',
    tools: 'capabilities',
    display: 'appearance',
    webui: 'access',
    pet: 'appearance',
  });
  assert.deepEqual(guiContract.settings_navigation.ordinary_hidden_legacy_tabs, [
    'overview',
    'runtime',
    'system',
    'model',
    'agent',
    'assistants',
    'skills-hub',
    'tools',
    'display',
    'webui',
    'pet',
  ]);
  assert.deepEqual(guiContract.settings_navigation.required_sections, [
    'general',
    'access',
    'capabilities',
    'environment',
    'appearance',
    'advanced',
    'about',
    'update',
    'theme',
  ]);
  assert.deepEqual(guiContract.settings_navigation.ordinary_hidden_upstream_surfaces, [
    'AionUI Team',
    'Team nav entry',
    'Team leader configuration',
    'team deep link navigation',
  ]);
  assert.deepEqual(guiContract.settings_navigation.team_surface_policy, {
    ordinary_visible: false,
    route_policy: 'disabled_or_redirect_to_app_owned_home',
    deep_link_policy: 'not_whitelisted',
    rationale: 'upstream AionUI Team is configured around shell-local agents and is not an OPL ordinary-user capability',
  });
  assert.equal(guiContract.settings_navigation.source, 'opl app state --profile fast --json');
  assert.equal(guiContract.settings_navigation.refresh_source, 'opl app state --profile fast --json');
  assert.equal(guiContract.settings_navigation.primary_tabs.general.label_zh, '通用');
  assert.equal(guiContract.settings_navigation.primary_tabs.environment.label_en, 'Local Environment');
  for (const [pageId, expected] of Object.entries(expectedSettingsPageSections)) {
    assert.deepEqual(guiContract.pages[pageId].sections, expected.sections);
    for (const item of expected.mustShow) {
      assert.ok(guiContract.pages[pageId].must_show.includes(item), `${pageId} must show ${item}`);
    }
    for (const item of expected.mustNotShow) {
      assert.ok(guiContract.pages[pageId].must_not_show.includes(item), `${pageId} must not show ${item}`);
    }
  }
  assert.equal(
    guiContract.pages.settings_capabilities.builtin_skill_catalog_policy.allowed_set_ref,
    'contracts/app-product-profile.json#companion_payloads.default_packaged_codex_skill_ids + packaged_not_default_visible_codex_skill_ids',
  );
  assert.ok(
    guiContract.pages.settings_capabilities.builtin_skill_catalog_policy.forbidden_examples.includes('aionui-skills'),
  );
  assert.equal(
    guiContract.pages.settings_capabilities.auto_injected_skills_policy.allowed_set_ref,
    'contracts/app-product-profile.json#companion_payloads.default_packaged_codex_skill_ids',
  );
  assert.ok(
    guiContract.pages.settings_capabilities.must_show.includes(
      'builtin skill catalog and auto-injected skills filtered to App packaged skill ids',
    ),
  );
  assert.ok(
    guiContract.pages.settings_capabilities.must_not_show.includes(
      'AionUI implementation skills such as aionui-skills',
    ),
  );
  assert.ok(guiContract.pages.settings_capabilities.auto_injected_skills_policy.forbidden_examples.includes('aionui-skills'));
  assert.equal(guiContract.desktop_tray_policy.default_visible, true);
  assert.equal(guiContract.desktop_tray_policy.desktop_startup_behavior, 'create_tray_by_default');
  assert.equal(guiContract.desktop_tray_policy.e2e_startup_behavior, 'destroy_tray_and_disable_close_to_tray');
  assert.equal(guiContract.desktop_tray_policy.close_to_tray_role, 'window_close_behavior_only');
  assert.equal(guiContract.desktop_tray_policy.settings_key, 'system.closeToTray');
  assert.equal(guiContract.desktop_tray_policy.must_not_gate_tray_visibility_on_close_to_tray, true);
  assert.equal(
    guiContract.first_launch_readiness_policy.beginner_presentation.post_install_ai_self_check_entry.target_route,
    '/guid',
  );
  assert.equal(
    guiContract.first_launch_readiness_policy.beginner_presentation.post_install_ai_self_check_entry.route_state,
    'postInstallSelfCheck',
  );
  assert.deepEqual(
    guiContract.first_launch_readiness_policy.beginner_presentation.post_install_ai_self_check_entry.target_state_checks,
    [
      'codex_cli_callable',
      'ui_language_policy',
      'session_scoped_opl_flow_context',
      'user_agents_md_respected_no_overwrite',
      'mas_mag_rca_routes_visible',
      'opl_meta_agent_capability_visible',
      'codex_skills_plugins_visible',
      'module_update_skill_plugin_continuity',
    ],
  );
  assert.equal(
    guiContract.first_launch_readiness_policy.beginner_presentation.post_install_ai_self_check_entry.mutation_policy,
    'diagnose_first_no_file_mutation_without_user_confirmation',
  );
  assert.equal(
    guiContract.module_path_source_policy.source,
    'app_state.modules[].source + app_state.modules[].path + app_state.paths',
  );
  assert.ok(guiContract.module_path_source_policy.must_explain.includes('whether a module comes from the bundled Full runtime payload'));
  assert.ok(guiContract.module_path_source_policy.must_explain.includes('whether a module comes from the App/CLI-managed GHCR agent package channel'));
  assert.ok(guiContract.module_path_source_policy.must_explain.includes('whether a module comes from the App/CLI-managed GHCR agent package channel moving tags'));
  assert.ok(guiContract.module_path_source_policy.must_explain.includes('whether a module comes from a local domain repository checkout'));
  assert.ok(guiContract.module_path_source_policy.must_explain.includes('whether Developer Profile source_channel uses a GitHub repo or local checkout'));
  assert.ok(guiContract.module_path_source_policy.must_explain.includes('whether a module is managed by App/CLI maintenance'));
  assert.ok(guiContract.module_path_source_policy.must_explain.includes('that module path display is refs-only and not domain truth authority'));
  assert.equal(guiContract.module_path_source_policy.ordinary_user_source, 'app_cli_managed_ghcr_agent_package_channel');
  assert.equal(guiContract.module_path_source_policy.ordinary_user_transport, 'app_cli_managed');
  assert.equal(guiContract.module_path_source_policy.developer_override_surface, 'Developer Profile source_channel capability');
  assert.equal(guiContract.module_path_source_policy.developer_override_policy, 'explicit_opt_in_only');
  assert.equal(guiContract.module_path_source_policy.developer_profile_ref, 'developer_profile.capabilities.source_channel');
  assert.deepEqual(guiContract.developer_profile.capability_axes, [
    'source_channel',
    'workspace_trust',
    'github_authority',
    'agent_automation',
    'runtime_mutation_scope',
  ]);
  assert.equal(guiContract.developer_profile.default_profile, 'standard_user');
  assert.equal(guiContract.developer_profile.opt_in_policy, 'explicit_opt_in_only');
  assert.equal(guiContract.developer_profile.ordinary_user_defaults.source_channel, 'agent_latest_package_channel');
  assert.equal(guiContract.developer_profile.ordinary_user_defaults.agent_automation, 'silent_background_agent_package_updates');
  assert.equal(guiContract.developer_profile.capabilities.source_channel.developer_opt_in, 'github_repo_or_local_checkout');
  assert.equal(guiContract.developer_profile.capabilities.workspace_trust.standard_default, 'selected_workspace_only');
  assert.equal(guiContract.developer_profile.capabilities.github_authority.developer_opt_in, 'repo_checkout_and_remote_intent_visible');
  assert.equal(guiContract.developer_profile.capabilities.agent_automation.standard_default, 'silent_background_agent_package_updates');
  assert.equal(guiContract.developer_profile.capabilities.runtime_mutation_scope.standard_default, 'app_action_route_only');
  assert.equal('legacy_developer_mode_alias' in guiContract.developer_profile, false);
  assert.ok(guiContract.module_path_source_policy.must_not_use.includes('raw OPL_MODULE_SOURCE_MODE as ordinary Settings UI'));
  assert.equal(guiContract.pages.settings_environment.module_path_source_policy_ref, 'module_path_source_policy');
  assert.ok(guiContract.pages.about.must_show.includes('OPL Framework revision'));
  assert.equal(guiContract.theme_and_branding.default_theme_id, 'default-theme');
  assert.deepEqual(guiContract.theme_and_branding.allowed_theme_ids, ['default-theme', 'codex']);
  assert.ok(guiContract.pages.settings_theme.must_show.includes('Default theme option'));
  assert.ok(guiContract.pages.settings_theme.must_show.includes('Codex theme option'));
  assert.deepEqual(
    guiContract.release_channel_policy.stable.must_gate,
    releaseContract.release_validation_profiles.stable.required_lanes,
  );
  assert.deepEqual(
    guiContract.release_channel_policy.nightly.must_gate,
    releaseContract.release_validation_profiles.nightly_standard.required_lanes,
  );
  assert.deepEqual(
    guiContract.release_channel_policy.nightly.must_not_gate,
    releaseContract.release_validation_profiles.nightly_standard.forbidden_lanes,
  );
  assert.ok(!('docker_webui' in guiContract));
  assert.doesNotMatch(JSON.stringify(guiContract), /username input gate|must_skip_username_input|manifest_name|logo_policy/);
});

test('App fallow hygiene is not the active GUI shell validation gate', () => {
  const packageJson = JSON.parse(fs.readFileSync(path.join(appRoot, 'package.json'), 'utf8'));
  const fallowConfig = JSON.parse(fs.readFileSync(path.join(appRoot, '.fallowrc.json'), 'utf8'));

  assert.deepEqual(fallowConfig.ignorePatterns, ['shells/aionui/**', 'shells/agui-codex/**']);
  assert.equal(packageJson.scripts['hygiene:fallow'], 'npx --yes fallow@latest --root . --no-cache --production');
  assert.match(packageJson.scripts['validate:gui-shell'], /validate-active-shell\.ts/);
  assert.match(packageJson.scripts['validate:gui-shell'], /run-active-shell-command\.ts bun run package/);
});

test('active shell validation exposes opt-in live OPL conformance without making it default', () => {
  const packageJson = JSON.parse(fs.readFileSync(path.join(appRoot, 'package.json'), 'utf8'));
  const activeShellValidator = fs.readFileSync(path.join(appRoot, 'scripts', 'validate-active-shell.ts'), 'utf8');
  const shellImplementationValidator = fs.readFileSync(
    path.join(appRoot, 'scripts', 'validate-active-shell', 'shell-implementation-validator.ts'),
    'utf8',
  );
  const runtimeBridge = JSON.parse(
    fs.readFileSync(path.join(appRoot, 'contracts', 'app-runtime-bridge.json'), 'utf8'),
  );

  assert.equal(packageJson.scripts['validate:active-shell'], 'node --experimental-strip-types scripts/validate-active-shell.ts');
  assert.match(activeShellValidator, /validateLiveOplConformance\(runtimeBridge\)/);
  assert.match(shellImplementationValidator, /useAcpInitialMessage\.ts/);
  assert.match(shellImplementationValidator, /await warmupConversation\(conversation_id\)/);
  assert.equal(runtimeBridge.live_conformance_gate.mode, 'explicit_env_opt_in');
  assert.equal(runtimeBridge.live_conformance_gate.default_enforcement, 'disabled');
  assert.equal(runtimeBridge.live_conformance_gate.opl_bin, './bin/opl');
  assert.equal(runtimeBridge.live_conformance_gate.fast_state_command, './bin/opl app state --profile fast --json');
  assert.equal(runtimeBridge.live_conformance_gate.full_state_command, './bin/opl app state --profile full --json');
  assert.equal(
    runtimeBridge.live_conformance_gate.action_dry_run_command,
    './bin/opl app action execute --action <fixture> --dry-run --json',
  );
  assert.equal(runtimeBridge.live_conformance_gate.fast_state_max_bytes, 500000);
  assert.equal(
    runtimeBridge.live_conformance_gate.golden_fast_state_fixture,
    'contracts/fixtures/opl-app-state-fast.fixture.json',
  );
  assert.deepEqual(runtimeBridge.live_conformance_gate.state_schema_paths, [
    'app_state.schema_version',
    'app_state.surface_kind',
    'app_state.schema',
    'app_state.surface',
    'schema',
    'surface',
  ]);
  const fixture = JSON.parse(
    fs.readFileSync(path.join(appRoot, runtimeBridge.live_conformance_gate.golden_fast_state_fixture), 'utf8'),
  );
  assert.equal(fixture.app_state.surface_kind, 'opl_app_state.v1');
  assert.equal(fixture.app_state.operator.workbench.view_model_schema, 'opl_app_operator_workbench.v1');
  assert.equal(
    fixture.app_state.operator.workbench.performance_policy.shell_must_not_derive_layout_from_raw_runtime_projection,
    true,
  );
  const fixtureTaskDrilldowns = fixture.app_state.operator.workbench.task_drilldowns;
  const stageRunCockpitExample = fixtureTaskDrilldowns.find(
    (task) => task.stage_run_cockpit || task.stage_run_current_owner_delta,
  );
  assert.ok(stageRunCockpitExample, 'fast App state fixture must include a StageRun cockpit projection');
  assert.equal(stageRunCockpitExample.stage_run_cockpit.derived_from, 'current_owner_delta');
  assert.equal(stageRunCockpitExample.stage_run_cockpit.refs_only, true);
  assert.deepEqual(
    Object.keys(stageRunCockpitExample.stage_run_cockpit_summary),
    ['current_owner', 'required_delta', 'next_safe_action_ref', 'artifact_or_blocker_refs'],
  );
  for (const forbidden of [
    'runtime_truth',
    'domain_truth',
    'owner_receipt_authority',
    'typed_blocker_authority',
    'artifact_authority',
    'domain_ready',
    'app_release_ready',
    'production_ready',
  ]) {
    assert.equal(forbidden in stageRunCockpitExample.stage_run_cockpit, false);
    assert.equal(forbidden in stageRunCockpitExample.stage_run_cockpit_summary, false);
  }

  const defaultResult = runNode(['scripts/validate-active-shell.ts', '--quick'], {
    env: {
      OPL_APP_LIVE_CONFORMANCE: '',
      OPL_APP_LIVE_OPL_ROOT: '',
      OPL_APP_LIVE_ACTION_FIXTURE: '',
    },
  });
  assert.equal(defaultResult.status, 0, defaultResult.stderr || defaultResult.stdout);

  const enabledWithoutRoot = runNode(['scripts/validate-active-shell.ts', '--quick'], {
    env: {
      OPL_APP_LIVE_CONFORMANCE: '1',
      OPL_APP_LIVE_OPL_ROOT: '',
      OPL_APP_LIVE_ACTION_FIXTURE: 'fixture',
    },
  });
  assert.notEqual(enabledWithoutRoot.status, 0);
  assert.match(enabledWithoutRoot.stderr, /Set OPL_APP_LIVE_OPL_ROOT/);
});

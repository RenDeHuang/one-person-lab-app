import {
  assert,
  fs,
  os,
  path,
  test,
  appRoot,
  activeShellRoot,
  expectedAionuiTeamProbeIds,
  runNode,
  spawnSync,
  writeExecutable,
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
  const expectedDefaultIconPath = path.join(appRoot, 'shells', 'aionui', 'resources', 'app.icns');
  const printReleaseEnv = [
    'scripts/run-active-shell-command.ts',
    process.execPath,
    '-e',
    'process.stdout.write(JSON.stringify({ version: process.env.OPL_RELEASE_VERSION || "", icon: process.env.OPL_APP_RELEASE_ICON_ICNS || "" }))',
  ];

  const defaultResult = runNode(printReleaseEnv, { env: { OPL_RELEASE_VERSION: '', OPL_APP_RELEASE_ICON_ICNS: '' } });
  assert.equal(defaultResult.status, 0, defaultResult.stderr || defaultResult.stdout);
  assert.deepEqual(JSON.parse(defaultResult.stdout), {
    version: expectedDefaultVersion,
    icon: expectedDefaultIconPath,
  });

  const explicitResult = runNode(printReleaseEnv, {
    env: {
      OPL_RELEASE_VERSION: '30.1.2-test.3',
      OPL_APP_RELEASE_ICON_ICNS: '/tmp/custom-opl-release-icon.icns',
    },
  });
  assert.equal(explicitResult.status, 0, explicitResult.stderr || explicitResult.stdout);
  assert.deepEqual(JSON.parse(explicitResult.stdout), {
    version: '30.1.2-test.3',
    icon: '/tmp/custom-opl-release-icon.icns',
  });
});

test('release code-quality uses App active-shell test runner', () => {
  const workflow = fs.readFileSync(path.join(appRoot, '.github', 'workflows', '_build-reusable.yml'), 'utf8');
  const packageJson = JSON.parse(fs.readFileSync(path.join(appRoot, 'package.json'), 'utf8'));
  const adapterContract = JSON.parse(fs.readFileSync(path.join(appRoot, 'contracts', 'app-shell-adapter.json'), 'utf8'));

  assert.match(workflow, /node --experimental-strip-types scripts\/run-active-shell-tests\.ts/);
  assert.doesNotMatch(workflow, /run:\s*bunx vitest run/);
  assert.equal(packageJson.scripts.test, 'npm run test:smoke');
  assert.equal(packageJson.scripts['test:smoke'], 'node --experimental-strip-types scripts/validate-active-shell.ts --quick');
  assert.equal(packageJson.scripts['test:full'], 'node --experimental-strip-types scripts/run-active-shell-tests.ts');
  assert.ok(adapterContract.validation_commands.some((entry) => (
    entry.id === 'test'
    && entry.cwd === '.'
    && entry.command === 'bun run test:full'
  )));
});

test('active shell test runner opts into shell project test lanes', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-active-shell-tests-'));
  const shellRoot = path.join(tempRoot, 'shell');
  const binRoot = path.join(tempRoot, 'bin');
  const capturePath = path.join(tempRoot, 'bunx-calls.jsonl');

  fs.mkdirSync(path.join(shellRoot, 'tests', 'unit'), { recursive: true });
  fs.mkdirSync(path.join(shellRoot, 'tests', 'integration'), { recursive: true });
  fs.writeFileSync(path.join(shellRoot, 'vitest.config.ts'), 'export default {};\n');
  fs.writeFileSync(path.join(shellRoot, 'tests', 'unit', 'node-example.test.ts'), 'export {};\n');
  fs.writeFileSync(path.join(shellRoot, 'tests', 'unit', 'dom-example.dom.test.tsx'), 'export {};\n');
  fs.writeFileSync(path.join(shellRoot, 'tests', 'integration', 'integration-example.test.ts'), 'export {};\n');
  const realShellRoot = fs.realpathSync(shellRoot);
  writeExecutable(path.join(binRoot, 'bunx'), `#!/usr/bin/env node
const fs = require('node:fs');
fs.appendFileSync(process.env.OPL_ACTIVE_SHELL_TEST_ENV_CAPTURE, JSON.stringify({
  cwd: process.cwd(),
  args: process.argv.slice(2),
  env: {
    VITEST_INCLUDE_DOM: process.env.VITEST_INCLUDE_DOM || '',
    VITEST_INCLUDE_INTEGRATION: process.env.VITEST_INCLUDE_INTEGRATION || '',
  },
}) + '\\n');
`);

  const baseEnv = {
    OPL_APP_SHELL_ROOT: shellRoot,
    OPL_ACTIVE_SHELL_TEST_ENV_CAPTURE: capturePath,
    PATH: `${binRoot}${path.delimiter}${process.env.PATH ?? ''}`,
    VITEST_INCLUDE_DOM: '',
    VITEST_INCLUDE_INTEGRATION: '',
  };

  const domResult = runNode([
    'scripts/run-active-shell-tests.ts',
    '--project',
    'dom',
    '--chunk-size',
    '8',
    '--max-workers',
    '2',
  ], { env: baseEnv });
  assert.equal(domResult.status, 0, domResult.stderr || domResult.stdout);

  const [domCall] = fs.readFileSync(capturePath, 'utf8').trim().split('\n').map((line) => JSON.parse(line));
  assert.equal(domCall.cwd, realShellRoot);
  assert.deepEqual(domCall.env, {
    VITEST_INCLUDE_DOM: '1',
    VITEST_INCLUDE_INTEGRATION: '',
  });
  assert.deepEqual(domCall.args.slice(0, 4), ['vitest', 'run', '--project', 'dom']);
  assert.ok(domCall.args.includes('tests/unit/dom-example.dom.test.tsx'));

  fs.writeFileSync(capturePath, '');
  const nodeResult = runNode([
    'scripts/run-active-shell-tests.ts',
    '--project',
    'node',
    '--chunk-size',
    '8',
    '--max-workers',
    '2',
  ], { env: baseEnv });
  assert.equal(nodeResult.status, 0, nodeResult.stderr || nodeResult.stdout);

  const [nodeCall] = fs.readFileSync(capturePath, 'utf8').trim().split('\n').map((line) => JSON.parse(line));
  assert.equal(nodeCall.cwd, realShellRoot);
  assert.deepEqual(nodeCall.env, {
    VITEST_INCLUDE_DOM: '',
    VITEST_INCLUDE_INTEGRATION: '1',
  });
  assert.deepEqual(nodeCall.args.slice(0, 4), ['vitest', 'run', '--project', 'node']);
  assert.ok(nodeCall.args.includes('tests/unit/node-example.test.ts'));
  assert.ok(nodeCall.args.includes('tests/integration/integration-example.test.ts'));
});

test('release build uses App wrappers for cross-shell active-shell commands', () => {
  const workflow = fs.readFileSync(path.join(appRoot, '.github', 'workflows', '_build-reusable.yml'), 'utf8');
  const packageJson = JSON.parse(fs.readFileSync(path.join(appRoot, 'package.json'), 'utf8'));
  const adapterContract = JSON.parse(fs.readFileSync(path.join(appRoot, 'contracts', 'app-shell-adapter.json'), 'utf8'));
  const releaseContract = JSON.parse(fs.readFileSync(path.join(appRoot, 'contracts', 'app-release-channel.json'), 'utf8'));
  const shellBuildScript = fs.readFileSync(path.join(activeShellRoot, 'scripts', 'build-with-builder.js'), 'utf8');
  const electronBuilderConfig = fs.readFileSync(
    path.join(activeShellRoot, 'packages', 'desktop', 'electron-builder.yml'),
    'utf8',
  );
  const shellViteConfig = fs.readFileSync(
    path.join(activeShellRoot, 'packages', 'desktop', 'electron.vite.config.ts'),
    'utf8',
  );

  assert.match(workflow, /command:\s*bun install --cwd shells\/aionui --frozen-lockfile/);
  assert.doesNotMatch(workflow, /command:\s*cd shells\/aionui && bun install --frozen-lockfile/);
  assert.equal(adapterContract.shell_contract.layout_id, 'aionui_v2_workspace');
  assert.equal(adapterContract.shell_contract.paths.product_profile_target, 'packages/desktop/src/common/config/oplProductProfile/oplProductProfile.generated.json');
  assert.equal(adapterContract.shell_contract.paths.electron_builder_config, 'packages/desktop/electron-builder.yml');
  assert.equal(adapterContract.shell_source.upstream_ref, '70974c59a275e565e8fc2bd7ecaf2dcac74227f0');
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
  assert.equal(releaseContract.standard_updater.dmg_compression.default_format, 'ULFO');
  assert.match(electronBuilderConfig, new RegExp(`dmg:[\\s\\S]*format:\\s+${releaseContract.standard_updater.dmg_compression.default_format}`));
  assert.match(shellViteConfig, /const appReleaseVersion = injectedOplReleaseVersion \|\| defaultOplReleaseVersion\(\)/);
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
  assert.equal(adapterContract.upstream_intake.classification_policy, 'classify_each_upstream_feature_before_app_release');
  assert.deepEqual(adapterContract.upstream_intake.allowed_classifications, [
    'accepted',
    'rejected',
    'redirected',
    'requires_app_contract',
  ]);
  assert.deepEqual(adapterContract.upstream_intake.required_feature_record_fields, [
    'id',
    'upstream_surface',
    'classification',
    'app_contract_ref',
    'release_gate',
  ]);
  const teamIntake = adapterContract.upstream_intake.feature_classifications.find((entry) => entry.id === 'aionui_team');
  assert.deepEqual(teamIntake, {
    id: 'aionui_team',
    upstream_surface: 'Team mode, /team routes, Team sidebar, Team-created redirects, and Team MCP snapshots',
    classification: 'rejected',
    ordinary_surface: 'forbidden',
    app_contract_ref: 'contracts/app-gui-product-contract.json#settings_navigation.team_surface_policy',
    release_gate: 'implementation_probes.aionui_team_disabled_surface',
  });
  assert.deepEqual(adapterContract.disabled_feature_policy.aionui_team, {
    state: 'disabled',
    ordinary_surface: 'rejected',
    route_policy: 'redirect_to_app_home',
    mutation_policy: 'team_created_redirect_noop',
    deep_link_policy: 'not_whitelisted',
    capability_snapshot_policy: 'scrub_before_render_or_inherit',
    agent_switching_policy: 'must_not_inherit_team_mcp',
  });
  assert.deepEqual(
    adapterContract.implementation_probes.aionui_team_disabled_surface.probes.map((probe) => probe.id),
    expectedAionuiTeamProbeIds,
  );
  assert.ok(
    adapterContract.implementation_probes.aionui_team_disabled_surface.probes.every((probe) => (
      probe.source_ref === 'contracts/app-gui-product-contract.json#settings_navigation.team_surface_policy'
      && probe.required === true
    )),
  );
  assert.ok(
    adapterContract.implementation_probes.aionui_team_disabled_surface.probes.some((probe) => (
      probe.id === 'ordinary_conversation_team_snapshot_scrub'
      && probe.required_evidence.includes('disabled Team MCP state is removed before ordinary conversation rendering')
    )),
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
  const nativeCandidate = candidateRegistry.candidates.find((candidate) => candidate.id === 'opl-native-workbench');
  const hermesCandidate = candidateRegistry.candidates.find((candidate) => candidate.id === 'hermes-codex');
  const nativeAdapter = JSON.parse(
    fs.readFileSync(path.join(appRoot, 'contracts', 'shell-adapters', 'opl-native-workbench.json'), 'utf8'),
  );
  const hermesAdapter = JSON.parse(
    fs.readFileSync(path.join(appRoot, 'contracts', 'shell-adapters', 'hermes-codex.json'), 'utf8'),
  );

  assert.equal(packageJson.scripts['validate:shell-candidates'], 'node --experimental-strip-types scripts/validate-shell-candidates.ts');
  assert.equal(candidateRegistry.owner, 'one-person-lab-app');
  assert.equal(candidateRegistry.purpose, 'app_shell_candidate_registry');
  assert.equal(candidateRegistry.state, 'active_gui_route_policy');
  assert.equal(candidateRegistry.active_shell_unchanged, adapterContract.active_shell);
  assert.equal(candidateRegistry.active_gui_mainline.shell, 'aionui');
  assert.equal(candidateRegistry.active_gui_mainline.shell_root, 'shells/aionui');
  assert.equal(candidateRegistry.active_gui_mainline.source_repo, 'gaofeng21cn/opl-aion-shell');
  assert.equal(candidateRegistry.active_gui_mainline.role, 'stable_app_gui_mainline');
  assert.equal(candidateRegistry.alternative_gui_policy.only_foreground_alternative, 'opl-native-workbench');
  assert.equal(candidateRegistry.alternative_gui_policy.basis, 'OPL native workbench');
  assert.deepEqual(candidateRegistry.alternative_gui_policy.default_candidate_validation_scope, ['opl-native-workbench']);
  assert.deepEqual(candidateRegistry.alternative_gui_policy.reference_only_candidates, ['hermes-codex']);
  assert.equal(
    candidateRegistry.alternative_gui_policy.reference_candidate_policy,
    'kept_for_explicit_reference_replay_not_default_foreground_scope',
  );
  assert.deepEqual(candidateRegistry.alternative_gui_policy.archived_technical_proofs, ['agui-codex']);
  assert.equal(candidateRegistry.alternative_gui_policy.archived_proof_policy, 'do_not_update_or_improve_unless_user_explicitly_requests_agui');
  assert.equal(candidateRegistry.release_shell_contract, 'contracts/app-shell-adapter.json');
  assert.equal(candidateRegistry.candidate_policy.release_participation_until_adopted, 'explicit_candidate_build_only');
  assert.equal(candidateRegistry.candidate_policy.default_validation_scope, 'foreground_alternative_only');
  assert.equal(candidateRegistry.candidate_policy.archived_technical_proof_policy, 'explicit_user_request_only');
  assert.deepEqual(candidateRegistry.candidate_policy.no_resurrection_policy, {
    policy_id: 'app.shell_candidate.no_resurrection.v1',
    default_validation_scope_must_exclude_archived_proofs: true,
    candidate_label_does_not_imply_foreground_status: true,
    archived_proof_update_requires_explicit_user_request: true,
    archived_proof_release_participation: 'explicit_user_requested_technical_replay_only',
    archived_proof_must_not_appear_in_adoption_gate: true,
    foreground_adoption_gate_must_be_shell_agnostic: true,
    active_shell_switch_contract: 'contracts/app-shell-adapter.json',
    forbidden_default_routes: [
      'agui-codex in alternative_gui_policy.default_candidate_validation_scope',
      'agui-codex in candidate_policy.adoption_gate',
      'candidate filename label treated as foreground alternative',
      'archived proof validation run by default',
      'release wrapper default switched without contracts/app-shell-adapter.json',
    ],
  });
  assert.equal(candidateRegistry.candidate_policy.release_scripts_must_use_active_shell_adapter, true);
  assert.equal(candidateRegistry.candidate_policy.authority_transfer_allowed, false);
  assert.ok(candidateRegistry.candidate_policy.adoption_gate.includes('candidate is declared in contracts/app-shell-candidates.json'));
  assert.ok(candidateRegistry.candidate_policy.adoption_gate.includes('candidate is the foreground alternative declared by alternative_gui_policy.only_foreground_alternative'));
  assert.ok(
    candidateRegistry.candidate_policy.adoption_gate.includes(
      'contracts/app-shell-adapter.json is changed only when candidate becomes active release shell',
    ),
  );
  assert.equal(candidateRegistry.candidate_policy.adoption_gate.some((gate) => gate.includes('agui-codex')), false);
  assert.equal(candidateRegistry.alternative_gui_policy.default_candidate_validation_scope.includes('agui-codex'), false);
  assert.equal(candidateRegistry.alternative_gui_policy.default_candidate_validation_scope.includes('hermes-codex'), false);
  assert.ok(aguiCandidate);
  assert.equal(aguiCandidate.state, 'archived_technical_proof');
  assert.equal(aguiCandidate.default_update_policy, 'do_not_update_or_improve_unless_user_explicitly_requests_agui');
  assert.equal(aguiCandidate.candidate_root, 'shells/agui-codex');
  assert.equal(aguiCandidate.adapter_contract, 'contracts/shell-adapters/agui-codex.json');
  assert.equal(aguiCandidate.source_topology, 'external_checkout_linked_shell_repo');
  assert.equal(aguiCandidate.release_participation, 'explicit_user_requested_technical_replay_only');
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
  assert.ok(nativeCandidate);
  assert.equal(nativeCandidate.state, 'technical_verification');
  assert.equal(nativeCandidate.foreground_alternative_role, 'only_foreground_alternative');
  assert.equal(nativeCandidate.candidate_root, 'shells/opl-native-workbench');
  assert.equal(nativeCandidate.adapter_contract, 'contracts/shell-adapters/opl-native-workbench.json');
  assert.equal(nativeCandidate.source_topology, 'external_checkout_linked_shell_repo');
  assert.equal(nativeCandidate.source_upstream.repo, 'gaofeng21cn/opl-native-workbench');
  assert.equal(nativeCandidate.source_upstream.license, 'Apache-2.0');
  assert.ok(nativeCandidate.required_capabilities.includes('native_react_workbench_renderer'));
  assert.ok(nativeCandidate.required_capabilities.includes('results_and_delivery_first_presentation'));
  assert.ok(nativeCandidate.validation_commands.some((entry) => (
    entry.id === 'candidate_app_bundle_build'
    && /OPL_APP_SHELL_ADAPTER_CONTRACT=contracts\/shell-adapters\/opl-native-workbench\.json npm run package/.test(entry.command)
  )));
  assert.equal(nativeAdapter.active_shell, 'opl-native-workbench');
  assert.equal(nativeAdapter.shell_root, 'shells/opl-native-workbench');
  assert.equal(nativeAdapter.release_role, 'experimental_candidate_shell');
  assert.equal(nativeAdapter.shell_source.history_policy, 'external_checkout_not_merged_into_app_default_branch');
  assert.ok(hermesCandidate);
  assert.equal(hermesCandidate.state, 'technical_reference');
  assert.equal(hermesCandidate.foreground_alternative_role, 'superseded_foreground_alternative_reference');
  assert.ok(hermesCandidate.settings_information_architecture.ordinary_tabs.includes('Storage'));
  assert.ok(hermesCandidate.settings_information_architecture.opl_semantics.includes('存储'));
  assert.ok(hermesAdapter.settings_information_architecture.ordinary_tabs.includes('Storage'));
  assert.ok(hermesAdapter.settings_information_architecture.opl_semantics.includes('存储'));
});

test('shell candidate validator derives foreground and archived policy from registry', () => {
  const dispatcherSource = fs.readFileSync(path.join(appRoot, 'scripts', 'validate-shell-candidates.ts'), 'utf8');
  const candidateContractSource = fs.readFileSync(
    path.join(appRoot, 'scripts', 'validate-shell-candidates', 'candidate-contract.ts'),
    'utf8',
  );

  assert.match(dispatcherSource, /candidateValidationPolicyFromRegistry\(registry\)/);
  assert.match(dispatcherSource, /validateCandidate\(candidate,\s*validationPolicy\)/);
  assert.match(candidateContractSource, /registry\.alternative_gui_policy/);
  assert.match(candidateContractSource, /policy\.archivedTechnicalProofs\.includes\(candidate\.id\)/);
  assert.match(candidateContractSource, /policy\.referenceOnlyCandidates\.includes\(candidate\.id\)/);
  assert.match(candidateContractSource, /candidate\.default_update_policy !== policy\.archivedProofUpdatePolicy/);
  assert.match(candidateContractSource, /alternative_gui_policy\.archived_proof_policy/);
  const registrySource = fs.readFileSync(
    path.join(appRoot, 'scripts', 'validate-shell-candidates', 'registry.ts'),
    'utf8',
  );
  assert.match(registrySource, /validateCandidateNoResurrectionPolicy\(registry\)/);
  assert.match(registrySource, /default_validation_scope_must_exclude_archived_proofs/);
  assert.match(registrySource, /default_candidate_validation_scope\.filter/);
  assert.match(registrySource, /default candidate validation scope must not include reference-only candidates/);
  assert.match(registrySource, /adoptionGateText\.includes\(archivedProof\)/);
  assert.doesNotMatch(
    candidateContractSource,
    /candidate\.id\s*={2,3}\s*['"]agui-codex['"][\s\S]{0,120}archived_technical_proof/,
  );
  assert.doesNotMatch(
    candidateContractSource,
    /candidate\.id\s*={2,3}\s*['"]agui-codex['"][\s\S]{0,160}explicit_user_requested_technical_replay_only/,
  );
  assert.doesNotMatch(
    candidateContractSource,
    /candidate\.id\s*={2,3}\s*['"]agui-codex['"][\s\S]{0,160}archived_technical_verification_shell/,
  );
});

test('App shell convergence uses existing active-shell and candidate gates without a second readback script', () => {
  const packageJson = JSON.parse(fs.readFileSync(path.join(appRoot, 'package.json'), 'utf8'));

  assert.equal(
    packageJson.scripts['validate:shell-convergence'],
    'npm run validate:active-shell -- --quick && npm run validate:shell-candidates',
  );
  assert.equal(fs.existsSync(path.join(appRoot, 'scripts', 'validate-shell-convergence.ts')), false);

  const result = spawnSync('npm', ['run', 'validate:shell-convergence'], {
    cwd: appRoot,
    encoding: 'utf8',
    env: { ...process.env, OPL_APP_SHELL_ROOT: '/Users/gaofeng/workspace/opl-aion-shell' },
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
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
  assert.equal(resolved.release_role, 'archived_technical_verification_shell');
  const aguiAdapter = JSON.parse(
    fs.readFileSync(path.join(appRoot, 'contracts', 'shell-adapters', 'agui-codex.json'), 'utf8'),
  );
  assert.equal(aguiAdapter.gui_authority.implementation_role, 'archived_technical_proof_replay_carrier');
  assert.equal(aguiAdapter.shell_replacement_policy.candidate_state, 'archived_technical_proof_replay_only');
  for (const gate of [
    'declare archived replay surface in contracts/app-shell-candidates.json',
    'consume contracts/app-gui-product-contract.json as replay acceptance input only',
    'sync App product profile into the archived replay shell target',
    'preserve archived page-state and first-run replay boundaries without default release claims',
    'pass App-root explicit adapter validation only when AGUI replay is requested',
    'pass explicit AGUI replay package compile through App wrapper',
    'preserve external checkout history policy and release isolation',
  ]) {
    assert.ok(aguiAdapter.shell_replacement_policy.adoption_gate.includes(gate), gate);
  }
  for (const oldAdoptionGate of [
    'implement contracts/app-gui-product-contract.json',
    'pass App-root active shell validation',
    'pass GUI package compile through App wrapper',
  ]) {
    assert.ok(!aguiAdapter.shell_replacement_policy.adoption_gate.includes(oldAdoptionGate), oldAdoptionGate);
  }
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

test('App fallow hygiene is not the active GUI shell validation gate', () => {
  const packageJson = JSON.parse(fs.readFileSync(path.join(appRoot, 'package.json'), 'utf8'));
  const fallowConfig = JSON.parse(fs.readFileSync(path.join(appRoot, '.fallowrc.json'), 'utf8'));

  assert.deepEqual(fallowConfig.entry, [
    'scripts/assert-full-runtime-currentness.ts',
    'scripts/validate-hermes-candidate.ts',
    'scripts/setup-release-notes-codex-config.ts',
  ]);
  assert.deepEqual(fallowConfig.ignorePatterns, [
    'docs/delivery/user-guides/macos-app-install/generated/macos-app-install-marp-theme.css',
    'docs/publishing/templates/opl-guide/styles.scss',
    'docs/publishing/templates/opl-quickstart/styles.scss',
    'docs/publishing/templates/opl-whitepaper/styles.scss',
    'shells/aionui/**',
    'shells/agui-codex/**',
  ]);
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
  const shellOrdinaryExperienceValidator = fs.readFileSync(
    path.join(appRoot, 'scripts', 'validate-active-shell', 'shell-ordinary-experience-validator.ts'),
    'utf8',
  );
  const shellImplementationValidationSources = `${shellImplementationValidator}\n${shellOrdinaryExperienceValidator}`;
  const runtimeBridge = JSON.parse(
    fs.readFileSync(path.join(appRoot, 'contracts', 'app-runtime-bridge.json'), 'utf8'),
  );

  assert.equal(packageJson.scripts['validate:active-shell'], 'node --experimental-strip-types scripts/validate-active-shell.ts');
  assert.match(activeShellValidator, /validateLiveOplConformance\(runtimeBridge\)/);
  assert.match(shellImplementationValidationSources, /useAcpInitialMessage\.ts/);
  assert.match(shellImplementationValidationSources, /await warmupConversation\(conversation_id\)/);
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

import {
  assert,
  fs,
  path,
  test,
  appRoot,
  readProductProfile,
} from './helpers.ts';
import {
  buildHydratedSettingsRegistry,
  remapSettingsExtensionAnchor,
  resolveSettingsControlPlaneRoute,
  validateSettingsControlPlane,
} from '../../../scripts/validate-active-shell/settings-control-plane-validator.ts';
import { appOwnedSettingsUpstreamIntakeClassifications } from '../../../scripts/validate-active-shell/app-contract-constants.ts';

test('Settings control-plane validator binds contract, profile, page-state, and shell adapter behavior', () => {
  const controlPlaneContract = JSON.parse(
    fs.readFileSync(path.join(appRoot, 'contracts', 'app-settings-control-plane.json'), 'utf8'),
  );
  const guiContract = JSON.parse(
    fs.readFileSync(path.join(appRoot, 'contracts', 'app-gui-product-contract.json'), 'utf8'),
  );
  const pageStateMatrix = JSON.parse(
    fs.readFileSync(path.join(appRoot, 'contracts', 'app-page-state-matrix.json'), 'utf8'),
  );
  const adapterContract = JSON.parse(
    fs.readFileSync(path.join(appRoot, 'contracts', 'app-shell-adapter.json'), 'utf8'),
  );
  const productProfile = readProductProfile();

  assert.doesNotThrow(() =>
    validateSettingsControlPlane(controlPlaneContract, guiContract, pageStateMatrix, productProfile, adapterContract),
  );

  const invalidActionRoute = structuredClone(guiContract);
  invalidActionRoute.settings_navigation.settings_ia.protocols.action_catalog.action_route = 'direct shell mutation';
  assert.throws(
    () =>
      validateSettingsControlPlane(
        controlPlaneContract,
        invalidActionRoute,
        pageStateMatrix,
        productProfile,
        adapterContract,
      ),
    /App action route/,
  );

  const invalidMatrix = structuredClone(pageStateMatrix);
  invalidMatrix.pages.find((page) => page.id === 'settings_workspace').route_scope = 'ordinary';
  assert.throws(
    () =>
      validateSettingsControlPlane(
        controlPlaneContract,
        guiContract,
        invalidMatrix,
        productProfile,
        adapterContract,
      ),
    /settings_workspace route_scope must be secondary_or_deep_link/,
  );
});

test('Settings control plane hydrates registry, route resolver, and extension anchor remap behavior', () => {
  const controlPlaneContract = JSON.parse(
    fs.readFileSync(path.join(appRoot, 'contracts', 'app-settings-control-plane.json'), 'utf8'),
  );

  const registry = buildHydratedSettingsRegistry(controlPlaneContract);
  assert.deepStrictEqual(
    registry.ordinary_routes.map((route) => `${route.id}:${route.slot_id}:${route.component_key}`),
    [
      'general:settings_general:OverviewSettings',
      'access:settings_access:AccessSettingsContent',
      'capabilities:settings_capabilities:CapabilitiesSettingsContent',
      'environment:settings_environment:RuntimeSettings',
      'storage:settings_storage:StorageSettings',
      'appearance:settings_theme:AppearanceModalContent',
      'advanced:settings_advanced:SystemModalContent',
    ],
  );
  assert.deepStrictEqual(
    registry.secondary_pages.map((route) => `${route.id}:${route.route_scope}`),
    [
      'about:secondary_or_deep_link',
      'update:secondary_or_deep_link',
      'theme:secondary_or_deep_link',
      'workspace:secondary_or_deep_link',
      'local-services:secondary_or_deep_link',
      'resources:secondary_or_deep_link',
    ],
  );
  assert.deepStrictEqual(resolveSettingsControlPlaneRoute(controlPlaneContract, 'general'), {
    input: 'general',
    id: 'general',
    target_id: 'general',
    path: '/settings/general',
    route_scope: 'ordinary',
    slot_id: 'settings_general',
    component_key: 'OverviewSettings',
  });
  assert.deepStrictEqual(resolveSettingsControlPlaneRoute(controlPlaneContract, 'workspace'), {
    input: 'workspace',
    id: 'workspace',
    target_id: 'workspace',
    path: '/settings/workspace',
    route_scope: 'secondary_or_deep_link',
    slot_id: 'workspace',
    component_key: 'WorkspaceSettings',
  });
  assert.deepStrictEqual(resolveSettingsControlPlaneRoute(controlPlaneContract, 'resources'), {
    input: 'resources',
    id: 'resources',
    target_id: 'resources',
    path: '/settings/resources',
    route_scope: 'secondary_or_deep_link',
    slot_id: 'settings_resources',
    component_key: 'AccessSettingsContent',
  });
  assert.deepStrictEqual(resolveSettingsControlPlaneRoute(controlPlaneContract, 'skills-hub'), {
    input: 'skills-hub',
    id: 'skills-hub',
    target_id: 'capabilities',
    path: '/settings/capabilities?tab=skills',
    route_scope: 'legacy_redirect',
    slot_id: 'settings_capabilities',
    component_key: 'CapabilitiesSettingsContent',
  });
  assert.strictEqual(remapSettingsExtensionAnchor(controlPlaneContract, 'skills-hub'), 'capabilities');
  assert.strictEqual(remapSettingsExtensionAnchor(controlPlaneContract, 'unknown-upstream-anchor'), 'advanced');
});

test('Settings adapter slot and upstream intake classification are machine-readable gates', () => {
  const controlPlaneContract = JSON.parse(
    fs.readFileSync(path.join(appRoot, 'contracts', 'app-settings-control-plane.json'), 'utf8'),
  );
  const guiContract = JSON.parse(
    fs.readFileSync(path.join(appRoot, 'contracts', 'app-gui-product-contract.json'), 'utf8'),
  );
  const pageStateMatrix = JSON.parse(
    fs.readFileSync(path.join(appRoot, 'contracts', 'app-page-state-matrix.json'), 'utf8'),
  );
  const adapterContract = JSON.parse(
    fs.readFileSync(path.join(appRoot, 'contracts', 'app-shell-adapter.json'), 'utf8'),
  );
  const productProfile = readProductProfile();

  assert.strictEqual(controlPlaneContract.shell_adapter_slot.host_component, 'SettingsHost');
  assert.strictEqual(controlPlaneContract.shell_adapter_slot.adapter_slot, 'SettingsShellAdapterSlot');
  assert.deepStrictEqual(
    controlPlaneContract.upstream_intake_checklist.allowed_classifications,
    appOwnedSettingsUpstreamIntakeClassifications,
  );
  assert.deepStrictEqual(
    controlPlaneContract.upstream_intake_checklist.records.map((record) => record.id),
    [
      'team-ordinary-surface-disabled',
      'skills-tools-settings-routed-to-capabilities',
      'provider-model-setup-routed-to-access-and-environment',
      'layout-accessibility-i18n-settings-fixes',
      'webui-advanced-deployment-redirected-to-access',
    ],
  );
  assert.deepStrictEqual(
    controlPlaneContract.upstream_intake_checklist.records.map((record) => record.classification),
    ['reject', 'adapt', 'adapt', 'accepted', 'redirect'],
  );
  assert.deepStrictEqual(
    controlPlaneContract.upstream_intake_checklist.records.find(
      (record) => record.id === 'skills-tools-settings-routed-to-capabilities',
    ).route_or_slot_impact,
    {
      route_id: 'capabilities',
      slot_id: 'settings_capabilities',
      adapter_slot: 'SettingsShellAdapterSlot',
      legacy_redirects: ['skills-hub', 'tools'],
    },
  );
  assert.strictEqual(
    controlPlaneContract.upstream_intake_checklist.records.find(
      (record) => record.id === 'team-ordinary-surface-disabled',
    ).route_or_slot_impact.forbidden_probe,
    'Team MCP ordinary surface',
  );
  assert.deepStrictEqual(
    adapterContract.implementation_probes.settings_control_plane_shell_adapter_slot.required_evidence,
    [
      'SettingsHost renders ordinary routes from the hydrated App settings registry',
      'SettingsShellAdapterSlot mounts App-owned route slots without shell-owned product IA',
      'legacy route redirects and extension anchor remaps are resolved before shell rendering',
      'AionUI upstream settings intake is classified as accepted/adapt/redirect/reject before registry or slot changes',
    ],
  );

  const invalidAdapter = structuredClone(adapterContract);
  delete invalidAdapter.implementation_probes.settings_control_plane_shell_adapter_slot.slots.SettingsShellAdapterSlot;
  assert.throws(
    () =>
      validateSettingsControlPlane(
        controlPlaneContract,
        guiContract,
        pageStateMatrix,
        productProfile,
        invalidAdapter,
      ),
    /SettingsShellAdapterSlot/,
  );

  const invalidIntake = structuredClone(controlPlaneContract);
  invalidIntake.upstream_intake_checklist.allowed_classifications = ['accepted', 'redirect'];
  assert.throws(
    () =>
      validateSettingsControlPlane(
        invalidIntake,
        guiContract,
        pageStateMatrix,
        productProfile,
        adapterContract,
      ),
    /upstream intake classifications/,
  );

  const invalidRecordClassification = structuredClone(controlPlaneContract);
  invalidRecordClassification.upstream_intake_checklist.records[0].classification = 'maybe';
  assert.throws(
    () =>
      validateSettingsControlPlane(
        invalidRecordClassification,
        guiContract,
        pageStateMatrix,
        productProfile,
        adapterContract,
      ),
    /classification must be accepted\/adapt\/redirect\/reject/,
  );

  const invalidAdaptEvidence = structuredClone(controlPlaneContract);
  invalidAdaptEvidence.upstream_intake_checklist.records.find(
    (record) => record.id === 'skills-tools-settings-routed-to-capabilities',
  ).route_or_slot_impact = {};
  assert.throws(
    () =>
      validateSettingsControlPlane(
        invalidAdaptEvidence,
        guiContract,
        pageStateMatrix,
        productProfile,
        adapterContract,
      ),
    /accepted\/adapt records must bind/,
  );

  const invalidRedirectEvidence = structuredClone(controlPlaneContract);
  invalidRedirectEvidence.upstream_intake_checklist.records.find(
    (record) => record.id === 'webui-advanced-deployment-redirected-to-access',
  ).route_or_slot_impact = {};
  invalidRedirectEvidence.upstream_intake_checklist.records.find(
    (record) => record.id === 'webui-advanced-deployment-redirected-to-access',
  ).app_contract_ref = 'contracts/app-settings-control-plane.json';
  assert.throws(
    () =>
      validateSettingsControlPlane(
        invalidRedirectEvidence,
        guiContract,
        pageStateMatrix,
        productProfile,
        adapterContract,
      ),
    /redirect\/reject records must bind/,
  );
});

test('Settings page adapters and visual QA policy are machine-readable gates', () => {
  const controlPlaneContract = JSON.parse(
    fs.readFileSync(path.join(appRoot, 'contracts', 'app-settings-control-plane.json'), 'utf8'),
  );
  const guiContract = JSON.parse(
    fs.readFileSync(path.join(appRoot, 'contracts', 'app-gui-product-contract.json'), 'utf8'),
  );
  const pageStateMatrix = JSON.parse(
    fs.readFileSync(path.join(appRoot, 'contracts', 'app-page-state-matrix.json'), 'utf8'),
  );
  const adapterContract = JSON.parse(
    fs.readFileSync(path.join(appRoot, 'contracts', 'app-shell-adapter.json'), 'utf8'),
  );
  const productProfile = readProductProfile();

  assert.deepStrictEqual(Object.keys(controlPlaneContract.page_adapter_policy.required_pages), [
    'access',
    'environment',
    'storage',
    'capabilities',
  ]);
  assert.strictEqual(
    controlPlaneContract.page_adapter_policy.required_pages.access.adapter_entry,
    'packages/desktop/src/renderer/pages/settings/accessProjection.ts',
  );
  assert.strictEqual(
    controlPlaneContract.page_adapter_policy.required_pages.environment.adapter_entry,
    'packages/desktop/src/renderer/pages/settings/RuntimeSettings/runtimeSettingsViewModel.ts',
  );
  assert.strictEqual(
    controlPlaneContract.ordinary_routes.find((route) => route.id === 'capabilities').state_source,
    'opl app state --profile fast --json#app_state.agent_packages.directory + app_state.agent_packages.status_index + home_agent_shortcuts + app_state.operator.workbench.task_drilldowns',
  );
  assert.strictEqual(
    controlPlaneContract.page_adapter_policy.required_pages.capabilities.state_source,
    'opl app state --profile fast --json#app_state.agent_packages.directory + app_state.agent_packages.status_index + home_agent_shortcuts + app_state.operator.workbench.task_drilldowns',
  );
  assert.deepStrictEqual(controlPlaneContract.page_adapter_policy.required_pages.capabilities.directory_projection_surface, {
    surface: 'settings_capabilities',
    primary_identity: 'installed_package_directory',
    purpose_role: 'secondary_tag_filter_only',
    home_shortcut_integration: 'inline_visibility_and_order_controls_on_package_rows',
    canonical_projection:
      'opl app state --profile fast --json#app_state.agent_packages.directory + app_state.agent_packages.status_index',
    legacy_fallback_projection:
      'opl app state --profile fast --json#app_state.modules.items[] + home_agent_shortcuts + app_state.operator.workbench.task_drilldowns',
    normalization_policy:
      'shell must prefer canonical agent_packages projection and only fall back to modules.items when older runtime payloads or partial projections are still in circulation',
    status_model: {
      policy: 'multi_axis_package_status_no_single_repair_bucket',
      axes: ['install_state', 'update_state', 'source_state', 'trust_state', 'codex_surface_state'],
      developer_source_policy:
        'developer checkout semantics must surface explicitly and must not collapse into a generic repair bucket',
      must_not_collapse: ['developer_checkout', 'dirty_checkout', 'git_behind', 'unknown', 'needs_sync'],
    },
    detail_surface: {
      kind: 'desktop_right_side_panel_mobile_drawer',
      detail_fields: [
        'receipt_refs',
        'rollback_ref',
        'action_receipt_ref',
        'physical_surface',
        'workflow_refs',
        'connector_readiness_refs',
        'resource_source_refs',
        'environment_refs',
      ],
      first_screen_policy:
        'receipt_refs_physical_surface_and_workflow_connector_resource_refs_are_detail_only_not_primary_row_density',
    },
    completion_boundary:
      'this control-plane contract requires canonical agent_packages projection and allows modules.items fallback only as rollout compatibility',
  });
  assert.deepStrictEqual(controlPlaneContract.visual_qa_policy.required_viewports, ['desktop', 'mobile']);
  assert.deepStrictEqual(controlPlaneContract.visual_qa_policy.required_routes, [
    '/settings/general',
    '/settings/access',
    '/settings/capabilities',
    '/settings/environment',
    '/settings/storage',
    '/settings/appearance',
    '/settings/advanced',
  ]);
  assert.deepStrictEqual(controlPlaneContract.visual_qa_policy.required_secondary_routes, [
    '/settings/workspace',
    '/settings/local-services',
    '/settings/resources',
  ]);
  assert.deepStrictEqual(controlPlaneContract.visual_qa_policy.required_status_anchors, [
    'diagnostics_collapsed_by_default',
    'state_changing_action_confirmation',
    'post_action_recovery_notice',
    'legacy_redirect_landing',
  ]);
  assert.deepStrictEqual(controlPlaneContract.visual_qa_policy.evidence_manifest.required_fields, [
    'command',
    'commit',
    'viewport',
    'route',
    'screenshot_path',
    'status_anchors',
  ]);
  assert.ok(controlPlaneContract.visual_qa_policy.evidence_command.includes('E2E_SCREENSHOTS=1'));
  assert.deepStrictEqual(controlPlaneContract.visual_qa_policy.does_not_prove, [
    'release readiness',
    'packaged App readiness',
    'runtime currentness',
    'owner acceptance',
  ]);

  const invalidAdapterPolicy = structuredClone(controlPlaneContract);
  delete invalidAdapterPolicy.page_adapter_policy.required_pages.environment;
  assert.throws(
    () =>
      validateSettingsControlPlane(
        invalidAdapterPolicy,
        guiContract,
        pageStateMatrix,
        productProfile,
        adapterContract,
      ),
    /required pages/,
  );

  const invalidAccessCloudBoundary = structuredClone(controlPlaneContract);
  delete invalidAccessCloudBoundary.page_adapter_policy.required_pages.access.cloud_remote_boundary;
  assert.throws(
    () =>
      validateSettingsControlPlane(
        invalidAccessCloudBoundary,
        guiContract,
        pageStateMatrix,
        productProfile,
        adapterContract,
      ),
    /cloud_remote_boundary/,
  );

  const invalidCapabilitiesResourceGrouping = structuredClone(controlPlaneContract);
  delete invalidCapabilitiesResourceGrouping.page_adapter_policy.required_pages.capabilities.resource_grouping_surface;
  assert.throws(
    () =>
      validateSettingsControlPlane(
        invalidCapabilitiesResourceGrouping,
        guiContract,
        pageStateMatrix,
        productProfile,
        adapterContract,
      ),
    /resource grouping surface/,
  );

  const invalidCapabilitiesDirectoryProjection = structuredClone(controlPlaneContract);
  invalidCapabilitiesDirectoryProjection.page_adapter_policy.required_pages.capabilities.directory_projection_surface.status_model.must_not_collapse =
    ['repair'];
  assert.throws(
    () =>
      validateSettingsControlPlane(
        invalidCapabilitiesDirectoryProjection,
        guiContract,
        pageStateMatrix,
        productProfile,
        adapterContract,
      ),
    /forbidden collapsed states/,
  );

  const invalidVisualQaPolicy = structuredClone(controlPlaneContract);
  invalidVisualQaPolicy.visual_qa_policy.does_not_prove = ['release readiness'];
  assert.throws(
    () =>
      validateSettingsControlPlane(
        invalidVisualQaPolicy,
        guiContract,
        pageStateMatrix,
        productProfile,
        adapterContract,
      ),
    /non-release evidence boundary/,
  );

  const invalidVisualQaManifest = structuredClone(controlPlaneContract);
  invalidVisualQaManifest.visual_qa_policy.evidence_manifest.required_fields = ['route'];
  assert.throws(
    () =>
      validateSettingsControlPlane(
        invalidVisualQaManifest,
        guiContract,
        pageStateMatrix,
        productProfile,
        adapterContract,
      ),
    /evidence manifest fields/,
  );
});

test('Settings model and reasoning policy is App-owned and shells are adapters only', () => {
  const controlPlaneContract = JSON.parse(
    fs.readFileSync(path.join(appRoot, 'contracts', 'app-settings-control-plane.json'), 'utf8'),
  );
  const guiContract = JSON.parse(
    fs.readFileSync(path.join(appRoot, 'contracts', 'app-gui-product-contract.json'), 'utf8'),
  );
  const pageStateMatrix = JSON.parse(
    fs.readFileSync(path.join(appRoot, 'contracts', 'app-page-state-matrix.json'), 'utf8'),
  );
  const adapterContract = JSON.parse(
    fs.readFileSync(path.join(appRoot, 'contracts', 'app-shell-adapter.json'), 'utf8'),
  );
  const productProfile = readProductProfile();
  const policy = controlPlaneContract.model_reasoning_policy_source;

  assert.equal(policy.owner, 'one-person-lab-app');
  assert.deepStrictEqual(policy.source_refs, [
    'contracts/app-product-profile.json#codex',
    'contracts/app-product-profile.json#gui.home.codex_model_display_options',
    'contracts/app-gui-product-contract.json#executor_policy',
  ]);
  assert.equal(policy.default_model_ref, 'contracts/app-product-profile.json#codex.default_model');
  assert.equal(policy.default_reasoning_effort_ref, 'contracts/app-product-profile.json#codex.default_reasoning_effort');
  assert.equal(policy.settings_surface, 'settings_access.opl_gateway');
  assert.equal(policy.adapter_policy, 'Aion/Hermes/shell render App-derived model and reasoning policy only');
  assert.deepStrictEqual(policy.shell_must_not_own, [
    'default model',
    'frontier model preference order',
    'reasoning effort options',
    'model access readiness truth',
    'provider selector as ordinary UI',
  ]);
  assert.equal(guiContract.executor_policy.default_model, productProfile.codex.default_model);
  assert.equal(guiContract.executor_policy.default_reasoning_effort, productProfile.codex.default_reasoning_effort);

  const invalidPolicy = structuredClone(controlPlaneContract);
  invalidPolicy.model_reasoning_policy_source.adapter_policy = 'shell owns its model selector';
  assert.throws(
    () => validateSettingsControlPlane(invalidPolicy, guiContract, pageStateMatrix, productProfile, adapterContract),
    /shells as adapters only/,
  );
});

test('Settings product system checklist is the completion-audit source and keeps release currentness separate', () => {
  const controlPlaneContract = JSON.parse(
    fs.readFileSync(path.join(appRoot, 'contracts', 'app-settings-control-plane.json'), 'utf8'),
  );
  const guiContract = JSON.parse(
    fs.readFileSync(path.join(appRoot, 'contracts', 'app-gui-product-contract.json'), 'utf8'),
  );
  const pageStateMatrix = JSON.parse(
    fs.readFileSync(path.join(appRoot, 'contracts', 'app-page-state-matrix.json'), 'utf8'),
  );
  const adapterContract = JSON.parse(
    fs.readFileSync(path.join(appRoot, 'contracts', 'app-shell-adapter.json'), 'utf8'),
  );
  const productProfile = readProductProfile();

  assert.strictEqual(controlPlaneContract.product_system_checklist.schema, 'settings_product_system_checklist.v1');
  assert.strictEqual(controlPlaneContract.product_system_checklist.items.length, 25);
  assert.deepStrictEqual(
    controlPlaneContract.product_system_checklist.items.map((item) => item.id),
    [
      'control_center_positioning',
      'seven_entry_ia',
      'secondary_route_strategy',
      'single_control_plane',
      'host_adapter_slot',
      'view_model_layer',
      'issue_action_protocol',
      'make_opl_usable_reconcile',
      'maintenance_noise_reduction',
      'update_rollback_ux',
      'workspace_task_page',
      'local_services_page',
      'access_information_architecture',
      'capabilities_experience',
      'data_storage_safety',
      'preferences_purity',
      'advanced_diagnostics',
      'developer_profile_warning',
      'user_copy_system',
      'settings_search',
      'visual_system',
      'screenshot_qa',
      'contract_validators',
      'worktree_lane_hygiene',
      'installed_release_currentness',
    ],
  );
  assert.strictEqual(
    controlPlaneContract.product_system_checklist.release_currentness_policy,
    'installed app, notarization, running version, and release readiness remain release-owner gates and must not be inferred from Settings tests',
  );
  assert.deepStrictEqual(
    controlPlaneContract.product_system_checklist.items.find((item) => item.id === 'installed_release_currentness')
      .evidence_required,
    [
      'release_currentness_policy separates this item from Settings tests',
      'visual QA and contract validators list what they do not prove',
      'release owner gate supplies any future installed/release evidence',
    ],
  );
  assert.strictEqual(
    controlPlaneContract.product_system_checklist.items.find((item) => item.id === 'capabilities_experience').goal,
    'Capabilities are organized as an installed package directory with integrated Home shortcut management, multi-axis status, and detail disclosure; purpose remains a secondary tag/filter.',
  );
  assert.deepStrictEqual(
    controlPlaneContract.product_system_checklist.items.find((item) => item.id === 'capabilities_experience')
      .evidence_required,
    [
      'Capabilities adapter is required',
      'Capabilities task entry is package-directory based with inline Home shortcut management',
      'current-runtime boundary records canonical agent_packages projection plus the allowed modules.items fallback',
    ],
  );

  const invalidMissingChecklistItem = structuredClone(controlPlaneContract);
  invalidMissingChecklistItem.product_system_checklist.items =
    invalidMissingChecklistItem.product_system_checklist.items.filter((item) => item.id !== 'settings_search');
  assert.throws(
    () =>
      validateSettingsControlPlane(
        invalidMissingChecklistItem,
        guiContract,
        pageStateMatrix,
        productProfile,
        adapterContract,
      ),
    /checklist item ids/,
  );

  const invalidReleasePolicy = structuredClone(controlPlaneContract);
  invalidReleasePolicy.product_system_checklist.release_currentness_policy = 'Settings visual QA proves release readiness';
  assert.throws(
    () =>
      validateSettingsControlPlane(
        invalidReleasePolicy,
        guiContract,
        pageStateMatrix,
        productProfile,
        adapterContract,
      ),
    /release\/currentness gates/,
  );

  const invalidEvidence = structuredClone(controlPlaneContract);
  invalidEvidence.product_system_checklist.items.find((item) => item.id === 'screenshot_qa').evidence_required = [
    'run screenshots',
  ];
  assert.throws(
    () =>
      validateSettingsControlPlane(
        invalidEvidence,
        guiContract,
        pageStateMatrix,
        productProfile,
        adapterContract,
      ),
    /at least three evidence requirements/,
  );
});

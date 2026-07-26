#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function readJson(relativePath: string): any {
  return JSON.parse(fs.readFileSync(path.join(appRoot, relativePath), 'utf8'));
}

function fail(message: string): never {
  throw new Error(message);
}

function assertEqual(actual: unknown, expected: unknown, label: string): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    fail(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function assertNoForbiddenConsumerSurface(value: unknown, label: string): void {
  const forbiddenKeys = new Set([
    'starter_package_metadata',
    'first_party_manifest_fixture_dir',
    'home_agent_shortcuts',
    'agent_package_invocation_receipt_policy',
    'builtin_assistant_route_receipt_policy',
    'package_lock_receipt_contract',
    'receipt_physical_surface_detail_policy',
    'advanced_manifest_install_contract',
    'manifest_url_install_advanced',
    'route_receipt_source_ref',
    'legacy_route_receipt_alias_source_ref',
    'route_receipt_required_fields',
    'route_receipt_must_not_govern',
    'default_assistant_required_skills',
    'default_agent_package_required_skills',
  ]);
  const visit = (entry: unknown): void => {
    if (!entry || typeof entry !== 'object') return;
    if (Array.isArray(entry)) {
      entry.forEach(visit);
      return;
    }
    for (const [key, nested] of Object.entries(entry)) {
      if (forbiddenKeys.has(key)) {
        fail(`${label} must not restore private Package consumer surface ${key}`);
      }
      visit(nested);
    }
  };
  visit(value);
}

function validateProjectedAction(action: any): void {
  const fields = [
    'action_id',
    'action_ref',
    'semantic',
    'surface',
    'payload',
    'required_payload_fields',
    'confirmation_required',
  ];
  assertEqual(Object.keys(action).sort(), fields.sort(), 'unknown Package projected action fields');
  if (
    typeof action.action_id !== 'string' ||
    action.action_ref !== `app_state.actions#${action.action_id}` ||
    typeof action.semantic !== 'string' ||
    typeof action.surface !== 'string' ||
    !action.payload ||
    typeof action.payload !== 'object' ||
    !Array.isArray(action.required_payload_fields) ||
    typeof action.confirmation_required !== 'boolean'
  ) {
    fail('unknown Package projected action must be complete and Framework-owned');
  }
}

function validateContract(): void {
  const installExposure = readJson('contracts/app-install-exposure-policy.json');
  const gui = readJson('contracts/app-gui-product-contract.json');
  const profile = readJson('contracts/app-product-profile.json');
  const pageState = readJson('contracts/app-page-state-matrix.json');
  const settings = readJson('contracts/app-settings-control-plane.json');
  const schema = readJson('contracts/agent-package-surfaces.schema.json');
  const fixture = readJson('contracts/fixtures/opl-app-state-unknown-agent.fixture.json');

  const installContract = installExposure.agent_installation_contract;
  if ('sync_and_install_contract' in installExposure) {
    fail('install exposure must not restore the legacy Framework Package sync transaction contract');
  }
  if ('transaction_internal_states' in installExposure.software_lifecycle) {
    fail('install exposure must not restore Package transaction internal state authority');
  }
  assertEqual(
    installExposure.capability_governance.lifecycle_authority,
    'configured_carrier',
    'Package lifecycle authority',
  );
  assertEqual(
    installExposure.software_lifecycle.lifecycle_owners.opl_packages,
    'configured_carrier',
    'Package lifecycle owner',
  );
  assertEqual(installContract.schema, 'opl_app_package_consumer_install_exposure.v1', 'install exposure schema');
  assertEqual(
    installContract.directory_contract.collection_source,
    'app_state.agent_packages.directory.entries',
    'install exposure directory source',
  );
  assertEqual(
    installContract.action_contract.source,
    'app_state.agent_packages.directory.entries[].available_actions[]',
    'install exposure action source',
  );
  assertEqual(installContract.action_contract.action_id_allowlist_allowed, false, 'App action-id allowlist policy');
  assertEqual(
    installContract.directory_contract.App_or_Shell_installed_inference_allowed,
    false,
    'App installed inference policy',
  );

  const registry = profile.gui.agent_package_registry;
  assertEqual(registry.directory_projection_authority, 'app_state.agent_packages.directory.entries', 'profile directory authority');
  assertEqual(registry.presentation_source, 'app_state.agent_packages.directory.entries', 'profile presentation source');
  assertEqual(registry.unknown_package_policy, 'render_without_app_package_id_branch', 'profile unknown Package policy');
  assertEqual(registry.manifest_lock_receipt_parser_allowed, false, 'profile private parser policy');
  assertEqual(registry.action_id_allowlist_allowed, false, 'profile action allowlist policy');
  if ('home_agent_shortcuts' in profile.gui.home) {
    fail('App product profile must not contain an App-owned Home shortcut list');
  }

  const settingsAgents = gui.pages.settings_agents;
  assertEqual(
    settingsAgents.primary_identity_policy.presentation_source,
    'app_state.agent_packages.directory.entries',
    'Settings presentation source',
  );
  assertEqual(
    settingsAgents.agent_package_lifecycle_ux.directory_controls.row_actions_source,
    'directory.entries[].available_actions[]',
    'Settings row action source',
  );
  assertEqual(
    settingsAgents.agent_package_lifecycle_ux.consistent_action_interaction.action_id_allowlist_allowed,
    false,
    'Settings action allowlist policy',
  );

  const unknownEntry = fixture.app_state.agent_packages.directory.entries[0];
  if (unknownEntry.package_id !== 'future.agent-lab' || unknownEntry.package_role !== 'standard_agent') {
    fail('unknown Agent fixture must remain outside the first-party Package identity set');
  }
  if (!Array.isArray(unknownEntry.home_shortcuts) || unknownEntry.home_shortcuts.length === 0) {
    fail('unknown Agent fixture must project an owner-defined Home shortcut');
  }
  if (!Array.isArray(unknownEntry.available_actions) || unknownEntry.available_actions.length === 0) {
    fail('unknown Agent fixture must project at least one Settings action');
  }
  unknownEntry.available_actions.forEach(validateProjectedAction);
  const runtime = fixture.app_state.operator.workbench.work_item_projection_v2;
  assertEqual(runtime.agent_catalog.map((entry: any) => entry.package_id), ['future.agent-lab'], 'Runtime Agent catalog');
  assertEqual(runtime.items.map((entry: any) => entry.agent_id), ['future.agent-lab'], 'Runtime work item owner');

  const schemaDefs = Object.keys(schema.$defs ?? {}).sort();
  assertEqual(
    schemaDefs,
    ['agent_package_activation_result', 'directory_entry', 'home_shortcut', 'localized_text', 'projected_action'],
    'App Package consumer schema definitions',
  );

  const agentsPage = pageState.pages.find((page: any) => page.id === 'agents');
  const settingsAgentsRoute = settings.experience_contract.page_contracts.agents;
  for (const [label, value] of [
    ['install exposure', installContract],
    ['GUI Settings/Home consumer', { settingsAgents, home: gui.home_layout, ordinary: gui.pages.ordinary_conversation }],
    ['product profile Package consumer', { registry, home: profile.gui.home }],
    ['page-state Package consumer', agentsPage],
    ['settings control-plane Package consumer', settingsAgentsRoute],
    ['App Package consumer schema', schema],
  ] as const) {
    assertNoForbiddenConsumerSurface(value, label);
  }
}

validateContract();
console.log(JSON.stringify({
  status: 'passed',
  surface_id: 'opl_app_generic_package_consumer_contract_validation',
  unknown_package_fixture: 'contracts/fixtures/opl-app-state-unknown-agent.fixture.json',
  package_id_allowlist_allowed: false,
  manifest_lock_receipt_parser_allowed: false,
}, null, 2));
console.log('PASS: App consumes generic Package directory, status, presentation, Runtime, and projected actions.');

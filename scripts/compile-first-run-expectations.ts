#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputPath = path.join(appRoot, 'contracts', 'app-first-run-compiled-expectations.json');
const scenarioIds = ['standard_dmg_clean_vm_smoke', 'homebrew_standard_cask_clean_vm_smoke'];
const fullScenarioIds = ['full_first_install_clean_machine', 'full_dmg_clean_vm_smoke'];

type JsonRecord = Record<string, any>;

function readJson(relativePath: string): JsonRecord {
  return JSON.parse(fs.readFileSync(path.join(appRoot, relativePath), 'utf8')) as JsonRecord;
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => [key, canonicalize(entry)]),
  );
}

export function canonicalJson(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

export function sha256Canonical(value: unknown): string {
  return crypto.createHash('sha256').update(canonicalJson(value)).digest('hex');
}

function requireExact(label: string, actual: unknown, expected: unknown): void {
  if (canonicalJson(actual) !== canonicalJson(expected)) {
    throw new Error(`${label} is inconsistent with the Standard qualification expectation SSOT.`);
  }
}

export function buildFirstRunCompiledExpectations(input: {
  gui: JsonRecord;
  matrix: JsonRecord;
  pageState: JsonRecord;
  productProfile: JsonRecord;
  release: JsonRecord;
}) {
  const shortcutProjection = {
    role: 'owner_projected_package_presentation',
    shortcut_source_ref: 'app_state.agent_packages.directory.entries[].home_shortcuts[]',
    preference_source_ref: 'app_state.agent_packages.status_index.home_shortcut_preferences[]',
    package_id_allowlist_allowed: false,
    fallback_policy: 'omit_invalid_shortcut_and_preserve_other_packages',
  };
  requireExact('GUI Home shortcut projection', input.gui.home_agent_shortcuts_metadata_policy, shortcutProjection);
  requireExact(
    'Product profile Home shortcut projection',
    input.productProfile.gui?.home?.home_agent_shortcuts_metadata_policy,
    shortcutProjection,
  );
  const homePage = (input.pageState.pages ?? []).find((page: JsonRecord) => page.id === 'guid_home');
  requireExact(
    'Page-state Home shortcut projection',
    homePage?.home_view_model?.home_agent_shortcuts_metadata_policy,
    shortcutProjection,
  );
  const composerProjection = {
    membership_source_ref: 'app_state.agent_packages.directory.entries[package_role=standard_agent]',
    preference_source_ref: 'app_state.agent_packages.status_index.home_shortcut_preferences[]',
    availability_source_ref:
      'app_state.agent_packages.directory.entries + app_state.agent_packages.status_index.packages[].presence',
    unknown_standard_agent_allowed: true,
  };
  requireExact('Product profile Home composer projection', {
    membership_source_ref:
      input.productProfile.gui?.home?.home_composer_state_contract?.shortcut_package_membership_source_ref,
    preference_source_ref:
      input.productProfile.gui?.home?.home_composer_state_contract?.shortcut_preference_source_ref,
    availability_source_ref:
      input.productProfile.gui?.home?.home_composer_state_contract?.shortcut_availability_source_ref,
    unknown_standard_agent_allowed:
      input.productProfile.gui?.home?.home_composer_state_contract?.unknown_standard_agent_allowed,
  }, composerProjection);
  requireExact('Page-state Home composer projection', {
    membership_source_ref:
      homePage?.home_view_model?.home_composer_state_contract?.shortcut_package_membership_source_ref,
    preference_source_ref:
      homePage?.home_view_model?.home_composer_state_contract?.shortcut_preference_source_ref,
    availability_source_ref:
      homePage?.home_view_model?.home_composer_state_contract?.shortcut_availability_source_ref,
    unknown_standard_agent_allowed:
      homePage?.home_view_model?.home_composer_state_contract?.unknown_standard_agent_allowed,
  }, composerProjection);
  const targetFixture = input.matrix.release_qualification_agent_target_fixture;
  requireExact('Release qualification Agent target fixture boundary', {
    role: targetFixture?.role,
    runtime_authority: targetFixture?.runtime_authority,
    catalog_membership_authority: targetFixture?.catalog_membership_authority,
    visibility_authority: targetFixture?.visibility_authority,
    action_authority: targetFixture?.action_authority,
  }, {
    role: 'release_qualification_probe_input_only',
    runtime_authority: false,
    catalog_membership_authority: false,
    visibility_authority: false,
    action_authority: false,
  });
  const shortcutSelectionPolicy =
    'explicit_user_or_navigation_selection_only_no_saved_preset_restore_and_never_disabled_by_launch_readiness';
  if (input.productProfile.gui?.home?.home_layout?.shortcut_selection_policy !== shortcutSelectionPolicy) {
    throw new Error('Product profile Home shortcut selection policy conflicts with the qualification SSOT.');
  }
  if (homePage?.home_view_model?.home_layout?.shortcut_selection_policy !== shortcutSelectionPolicy) {
    throw new Error('Page-state Home shortcut selection policy conflicts with the qualification SSOT.');
  }
  const standardPolicy = input.release.release_acceleration?.assistant_route_smoke_policy?.standard;
  requireExact('Release Standard assistant route policy', standardPolicy, {
    required: [
      'compiled_release_qualification_targets_visible',
      'unavailable_projected_targets_selectable',
      'launch_allowed_false_at_send',
      'readiness_and_repair_hint_visible',
    ],
    forbidden: [
      'unavailable_projected_target_disabled_before_selection',
      'claim_full_route_receipt_from_standard_launch_gate',
    ],
    verification_mode: 'launch_gate',
  });
  const fullPolicy = input.release.release_acceleration?.assistant_route_smoke_policy?.full;
  requireExact('Release Full assistant route policy', fullPolicy, {
    required: [
      'compiled_release_qualification_targets_visible',
      'projected_targets_launchable',
      'selected_project_directory_applied_to_session_and_domain_workspace_identity',
      'real_guid_composer_send_without_shell_package_activation_per_target',
      'conversation_get_readback_per_target',
      'Framework_stage_runtime_activation_uses_Stage_workspace_locator_per_target',
      'Framework_stage_runtime_activation_evidence_per_target',
      'release_evidence_route_receipt_per_target',
    ],
    forbidden: [
      'direct_conversation_post',
      'Shell_agent_package_activation_before_or_during_send',
      'synthetic_Framework_stage_runtime_activation_evidence',
      'synthetic_release_evidence_route_receipt',
    ],
    verification_mode: 'route_receipt',
  });
  const scenarios = new Map((input.matrix.scenarios ?? []).map((scenario: JsonRecord) => [scenario.id, scenario]));
  const targetMappings = (targetFixture?.targets ?? []).map((target: JsonRecord) => {
    if (
      typeof target.assistant_id !== 'string' || !target.assistant_id.trim() ||
      typeof target.shortcut_id !== 'string' || !target.shortcut_id.trim() ||
      typeof target.package_id !== 'string' || !target.package_id.trim() ||
      typeof target.codex_visible_entry !== 'string' || !target.codex_visible_entry.trim() ||
      !Array.isArray(target.required_skill_ids) || target.required_skill_ids.length === 0 ||
      target.required_skill_ids.some((entry: unknown) => typeof entry !== 'string' || !entry.trim()) ||
      typeof target.badge !== 'string' || !target.badge.trim()
    ) {
      throw new Error('Release qualification Agent target fixture contains an incomplete target mapping.');
    }
    return {
      assistant_id: target.assistant_id,
      shortcut_id: target.shortcut_id,
      package_id: target.package_id,
      codex_visible_entry: target.codex_visible_entry,
      required_skill_ids: target.required_skill_ids,
      badge: target.badge,
    };
  });
  if (targetMappings.length === 0) {
    throw new Error('Release qualification Agent target fixture must contain at least one target.');
  }
  for (const identityField of ['assistant_id', 'shortcut_id', 'package_id'] as const) {
    const values = targetMappings.map((target) => target[identityField]);
    if (new Set(values).size !== values.length) {
      throw new Error(`Release qualification Agent target fixture has duplicate ${identityField}.`);
    }
  }
  for (const scenarioId of scenarioIds) {
    const scenario = scenarios.get(scenarioId);
    if (!scenario) throw new Error(`Missing Standard first-run scenario ${scenarioId}.`);
    if (scenario.package_type !== 'standard' || scenario.vm?.runtime_profile !== 'standard') {
      throw new Error(`${scenarioId} must remain a Standard package/runtime scenario.`);
    }
    if (scenario.compiled_expectation_ref !== 'contracts/app-first-run-compiled-expectations.json#profiles.standard') {
      throw new Error(`${scenarioId} must reference the compiled Standard expectation profile.`);
    }
    const joined = (scenario.expects ?? []).join('\n');
    if (/visible but disabled/i.test(joined)) {
      throw new Error(`${scenarioId} still requires disabled Home shortcuts.`);
    }
    if (!/visible and selectable before selection/.test(joined) || !/blocks only that send/.test(joined)) {
      throw new Error(`${scenarioId} must describe selectable shortcuts with selected-package send-time blocking.`);
    }
  }
  for (const scenarioId of fullScenarioIds) {
    const scenario = scenarios.get(scenarioId);
    if (!scenario) throw new Error(`Missing Full first-run scenario ${scenarioId}.`);
    if (scenario.package_type !== 'full' || scenario.vm?.runtime_profile !== 'full') {
      throw new Error(`${scenarioId} must remain a Full package/runtime scenario.`);
    }
    if (scenario.compiled_expectation_ref !== 'contracts/app-first-run-compiled-expectations.json#profiles.full') {
      throw new Error(`${scenarioId} must reference the compiled Full expectation profile.`);
    }
  }

  const semantics = {
    artifact_kind: 'standard',
    scenario_ids: scenarioIds,
    assistant_targets: targetMappings,
    target_fixture_role: 'release_qualification_probe_input_only',
    target_projection: {
      membership_source_ref: composerProjection.membership_source_ref,
      shortcut_source_ref: shortcutProjection.shortcut_source_ref,
      preference_source_ref: shortcutProjection.preference_source_ref,
      runtime_catalog_authority: false,
      unknown_standard_agent_allowed: true,
    },
    projected_home_shortcut: {
      visible: true,
      selectable_before_selection: true,
    },
    unavailable_selected_package: {
      state: 'package_unavailable',
      enforcement_phase: 'selected_package_send',
      send_allowed: false,
      launch_allowed: false,
      typed_reason_required: true,
      draft_preserved: true,
      owner_repair_guidance_required: true,
    },
    successful_invocation_receipt_expected: false,
  } as const;
  const probes = {
    home_control_testid_templates: ['home-starter-<package_id>', 'preset-pill-<package_id>'],
    composer_selector: '[data-testid="opl-guid-entry"]',
    input_selector: 'textarea[data-testid="guid-input"], input[data-testid="guid-input"]',
    send_selector: '[data-testid="guid-send-btn"]',
    blocking_message_selector: '[data-testid="opl-agent-package-launch-blocked"]',
    polling_contract: ['select', 'composer_active', 'input_event', 'send', 'blocking_message', 'passed'],
  } as const;
  const fullSemantics = {
    artifact_kind: 'full',
    scenario_ids: fullScenarioIds,
    assistant_targets: targetMappings,
    required: fullPolicy.required,
    forbidden: fullPolicy.forbidden,
    verification_mode: 'route_receipt',
  } as const;
  const fullProbes = {
    composer_selector: '[data-testid="opl-guid-entry"]',
    send_selector: '[data-testid="guid-send-btn"]',
    observation_contract: [
      'selection',
      'session_cwd',
      'composer_send_without_activation',
      'conversation_readback',
      'Framework_stage_runtime_activation',
      'route_receipt',
    ],
  } as const;
  return {
    schema: 'opl_app_first_run_compiled_expectations.v1',
    source_contracts: {
      behavior: 'contracts/app-gui-product-contract.json#home_agent_shortcuts_metadata_policy',
      scenarios: 'contracts/app-first-run-test-matrix.json',
      target_fixture:
        'contracts/app-first-run-test-matrix.json#release_qualification_agent_target_fixture',
      product_profile: 'contracts/app-product-profile.json#gui.home.home_layout.shortcut_selection_policy',
      page_state: 'contracts/app-page-state-matrix.json#pages[id=guid_home].home_view_model.home_layout.shortcut_selection_policy',
      release: 'contracts/app-release-channel.json#release_acceleration.assistant_route_smoke_policy.standard',
    },
    profiles: {
      standard: {
        semantics,
        semantic_digest: sha256Canonical(semantics),
        probes,
        probe_digest: sha256Canonical(probes),
      },
      full: {
        semantics: fullSemantics,
        semantic_digest: sha256Canonical(fullSemantics),
        probes: fullProbes,
        probe_digest: sha256Canonical(fullProbes),
      },
    },
  };
}

export function compileCurrentFirstRunExpectations() {
  return buildFirstRunCompiledExpectations({
    gui: readJson('contracts/app-gui-product-contract.json'),
    matrix: readJson('contracts/app-first-run-test-matrix.json'),
    pageState: readJson('contracts/app-page-state-matrix.json'),
    productProfile: readJson('contracts/app-product-profile.json'),
    release: readJson('contracts/app-release-channel.json'),
  });
}

export function renderCompiledFirstRunExpectations(value = compileCurrentFirstRunExpectations()): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function main(): void {
  const rendered = renderCompiledFirstRunExpectations();
  if (process.argv.includes('--write')) {
    fs.writeFileSync(outputPath, rendered, 'utf8');
    process.stdout.write(`${JSON.stringify({ status: 'written', output: outputPath })}\n`);
    return;
  }
  if (!fs.existsSync(outputPath) || fs.readFileSync(outputPath, 'utf8') !== rendered) {
    throw new Error('Compiled first-run expectations are stale; run compile-first-run-expectations.ts --write.');
  }
  process.stdout.write(`${JSON.stringify({ status: 'passed', output: outputPath })}\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();

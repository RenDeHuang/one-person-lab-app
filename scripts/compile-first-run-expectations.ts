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
  const interaction = input.gui.agent_package_activation_policy?.home_shortcut_interaction;
  requireExact('GUI Home shortcut interaction', interaction, {
    configured_shortcut_visible: true,
    configured_shortcut_selectable_before_selection: true,
    directory_entry_ordinary_discovery_visible_is_separate: true,
    launch_readiness_enforcement_phase: 'selected_package_send',
    package_unavailable_send_allowed: false,
    typed_reason_required: true,
    draft_preserved: true,
    owner_repair_guidance_required: true,
    successful_invocation_receipt_expected_before_launch: false,
  });
  const shortcutSelectionPolicy =
    'explicit_user_or_navigation_selection_only_no_saved_preset_restore_and_never_disabled_by_launch_readiness';
  if (input.productProfile.gui?.home?.home_layout?.shortcut_selection_policy !== shortcutSelectionPolicy) {
    throw new Error('Product profile Home shortcut selection policy conflicts with the qualification SSOT.');
  }
  const homePage = (input.pageState.pages ?? []).find((page: JsonRecord) => page.id === 'guid_home');
  if (homePage?.home_view_model?.home_layout?.shortcut_selection_policy !== shortcutSelectionPolicy) {
    throw new Error('Page-state Home shortcut selection policy conflicts with the qualification SSOT.');
  }
  const standardPolicy = input.release.release_acceleration?.assistant_route_smoke_policy?.standard;
  requireExact('Release Standard assistant route policy', standardPolicy, {
    required: [
      'MAS_MAG_RCA_home_starters_visible',
      'package_not_installed_starters_selectable',
      'launch_allowed_false_at_send',
      'readiness_and_repair_hint_visible',
    ],
    forbidden: [
      'package_not_installed_starter_disabled_before_selection',
      'claim_agent_package_shortcut_route_receipt',
    ],
    verification_mode: 'launch_gate',
  });
  const fullPolicy = input.release.release_acceleration?.assistant_route_smoke_policy?.full;
  requireExact('Release Full assistant route policy', fullPolicy, {
    required: [
      'MAS_MAG_RCA_home_starters_visible',
      'starters_launchable',
      'owner_projected_required_payload_fields_satisfied_before_send',
      'agent_package_activate_action_per_starter',
      'real_guid_composer_send_per_starter',
      'conversation_get_readback_per_starter',
      'agent_package_activation_receipt_per_starter',
      'agent_package_shortcut_route_receipt_per_starter',
    ],
    forbidden: [
      'direct_conversation_post',
      'synthetic_agent_package_activation_receipt',
      'synthetic_agent_package_route_receipt',
    ],
    verification_mode: 'route_receipt',
  });
  const scenarios = new Map((input.matrix.scenarios ?? []).map((scenario: JsonRecord) => [scenario.id, scenario]));
  const targetMappings = ['mas', 'mag', 'rca'].map((assistantId) => {
    const shortcut = (input.gui.home_agent_shortcuts ?? []).find(
      (entry: JsonRecord) => entry.agent_id === assistantId,
    );
    if (!shortcut) throw new Error(`Missing Home shortcut mapping for ${assistantId}.`);
    if (
      typeof shortcut.package_id !== 'string' || !shortcut.package_id.trim() ||
      typeof shortcut.codex_visible_entry !== 'string' || !shortcut.codex_visible_entry.trim() ||
      !Array.isArray(shortcut.required_skill_ids) || shortcut.required_skill_ids.length === 0
    ) {
      throw new Error(`Missing package, Codex entry, or required Skill mapping for ${assistantId}.`);
    }
    return {
      assistant_id: shortcut.agent_id,
      shortcut_id: shortcut.shortcut_id,
      package_id: shortcut.package_id,
      codex_visible_entry: shortcut.codex_visible_entry,
      required_skill_ids: shortcut.required_skill_ids,
      badge: `@${shortcut.primary_label}`,
    };
  });
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
    configured_home_shortcut: {
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
    observation_contract: ['selection', 'activation', 'send', 'conversation_readback', 'route_receipt'],
  } as const;
  return {
    schema: 'opl_app_first_run_compiled_expectations.v1',
    source_contracts: {
      behavior: 'contracts/app-gui-product-contract.json#agent_package_activation_policy.home_shortcut_interaction',
      scenarios: 'contracts/app-first-run-test-matrix.json',
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

#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

type AgentRootMap = Map<string, string>;

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const policyPath = path.join(appRoot, 'contracts', 'app-install-exposure-policy.json');
const profilePath = path.join(appRoot, 'contracts', 'app-product-profile.json');
const packageJsonPath = path.join(appRoot, 'package.json');
const expectedDefaultPluginAgentIds = ['mas', 'mag', 'rca', 'bookforge'];
const expectedRepoPackagedPluginAgentIds = ['mas', 'mag', 'rca'];
const expectedGeneratedAgentIds = ['oma', 'bookforge'];
const expectedRequiredAgentIds = ['mas', 'mag', 'rca', 'oma', 'bookforge', 'scholarskills'];
const expectedDefaultVisibleDomainSkillIds = ['mas', 'mag', 'rca', 'opl-bookforge'];
const expectedGeneratedPluginSkillIds = ['opl-meta-agent', 'opl-bookforge'];
const expectedCompanionSkillSyncIds = [
  'superpowers',
  'cron',
  'officecli',
  'officecli-docx',
  'officecli-pptx',
  'officecli-xlsx',
  'officecli-academic-paper',
  'officecli-data-dashboard',
  'officecli-financial-model',
  'officecli-pitch-deck',
  'pdf',
  'mineru-document-extractor',
  'ui-ux-pro-max',
];
const expectedFailClosedStates = [
  'dirty_managed_checkout',
  'ahead_or_diverged_managed_checkout',
  'missing_plugin_manifest',
  'missing_skill_entry',
  'duplicate_codex_visible_domain_skill',
  'unavailable_managed_agent_pack_channel',
  'invalid_package_manifest',
  'missing_package_lock_receipt',
  'package_source_validation_failed',
  'atomic_package_unit_incomplete',
];
const expectedPackageLifecycleActions = [
  'discover',
  'install',
  'update',
  'repair',
  'rollback',
  'uninstall',
  'enable',
  'disable',
  'hide',
  'unhide',
  'manual_check',
  'apply_selected',
];
const expectedManualThirdPartySourceKinds = [
  'local_manifest_file',
  'manifest_url',
  'manifest_import',
];
const expectedManualThirdPartyRequires = [
  'explicit_user_action',
  'manifest_validation',
  'trust_tier_assignment',
  'package_lock_receipt',
  'rollback_ref',
];
const expectedPackageSourceKinds = [
  'first_party_managed_cohort',
  'bundled_full_runtime_modules',
  'local_manifest_file',
  'manifest_url',
  'manifest_import',
  'developer_checkout_override',
];
const expectedPackageLockReceiptFields = [
  'package_id',
  'version_or_source_digest',
  'installed_at',
  'updated_at',
  'codex_visible_entry',
  'bundled_required_skill_ids',
  'optional_skill_refs',
  'source_kind',
  'trust_tier',
  'action_receipt_id',
  'rollback_ref',
];
const expectedAtomicPackageUnitIncludes = [
  'plugin_manifest',
  'bundled_required_skill_entries',
  'optional_companion_skill_refs',
];

function readJson(filePath: string): any {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function fail(message: string): never {
  console.error(`FAIL: ${message}`);
  process.exit(1);
}

function assertEqual(actual: unknown, expected: unknown, label: string): void {
  if (actual !== expected) {
    fail(`${label} expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function assertArrayEqual(actual: unknown, expected: string[], label: string): void {
  if (!Array.isArray(actual) || JSON.stringify(actual) !== JSON.stringify(expected)) {
    fail(`${label} expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function assertIncludesAll(actual: unknown, expected: string[], label: string): void {
  if (!Array.isArray(actual)) {
    fail(`${label} must be an array`);
  }
  const missing = expected.filter((item) => !actual.includes(item));
  if (missing.length > 0) {
    fail(`${label} missing ${missing.join(', ')}`);
  }
}

function assertFieldsEqual(actual: any, expectedFields: Record<string, unknown>, label: string): void {
  for (const [field, expected] of Object.entries(expectedFields)) {
    assertEqual(actual?.[field], expected, `${label}.${field}`);
  }
}

function assertArrayFieldsEqual(actual: any, expectedFields: Record<string, string[]>, label: string): void {
  for (const [field, expected] of Object.entries(expectedFields)) {
    assertArrayEqual(actual?.[field], expected, `${label}.${field}`);
  }
}

function assertArrayFieldsInclude(actual: any, expectedFields: Record<string, string[]>, label: string): void {
  for (const [field, expected] of Object.entries(expectedFields)) {
    assertIncludesAll(actual?.[field], expected, `${label}.${field}`);
  }
}

type ParsedArgs = {
  agentRoots: AgentRootMap;
  codexSkillsRoot: string | null;
};

function parseArgs(argv: string[]): ParsedArgs {
  const roots = new Map<string, string>();
  let codexSkillsRoot: string | null = null;
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--codex-skills-root') {
      const root = argv[index + 1]?.trim();
      if (!root) {
        fail('--codex-skills-root requires <path>');
      }
      index += 1;
      codexSkillsRoot = path.resolve(root);
      continue;
    }
    if (token !== '--agent-root') {
      fail(`Unknown argument: ${token}`);
    }
    const spec = argv[index + 1];
    if (!spec || !spec.includes('=')) {
      fail('--agent-root requires <agent_id>=<path>');
    }
    index += 1;
    const [agentId, ...pathParts] = spec.split('=');
    const root = pathParts.join('=').trim();
    if (!expectedRequiredAgentIds.includes(agentId) || !root) {
      fail(`Invalid --agent-root value: ${spec}`);
    }
    roots.set(agentId, path.resolve(root));
  }
  return { agentRoots: roots, codexSkillsRoot };
}

function findExposureClass(policy: any, id: string): any {
  const entry = policy.exposure_classes?.find((item: any) => item.id === id);
  if (!entry) {
    fail(`missing exposure class ${id}`);
  }
  return entry;
}

function findDomainExposure(policy: any, domainId: string): any {
  const entry = policy.domain_exposure?.find((item: any) => item.domain_id === domainId);
  if (!entry) {
    fail(`missing domain exposure ${domainId}`);
  }
  return entry;
}

function findInstallAgent(contract: any, agentId: string): any {
  const entry = contract.agents?.find((item: any) => item.agent_id === agentId);
  if (!entry) {
    fail(`missing agent installation entry ${agentId}`);
  }
  return entry;
}

function validatePluginRoot(agentId: string, root: string, installAgent: any): void {
  const pluginName = installAgent.codex_visible_entry;
  if (typeof pluginName !== 'string' || !pluginName.trim()) {
    fail(`${agentId} installation entry is missing codex_visible_entry`);
  }
  const pluginManifestPath = path.join(root, '.codex-plugin', 'plugin.json');
  const skillPath = path.join(root, 'skills', pluginName, 'SKILL.md');
  if (!fs.existsSync(pluginManifestPath)) {
    fail(`${agentId} plugin root is missing .codex-plugin/plugin.json: ${root}`);
  }
  if (!fs.existsSync(skillPath)) {
    fail(`${agentId} plugin root is missing skills/${pluginName}/SKILL.md: ${root}`);
  }
  const pluginManifest = readJson(pluginManifestPath);
  assertEqual(pluginManifest.name, pluginName, `${agentId} plugin manifest name`);
  assertEqual(pluginManifest.skills, './skills/', `${agentId} plugin manifest skills path`);
}

function validateNoDuplicateBareDomainSkills(root: string | null): string | null {
  if (!root) {
    return null;
  }
  if (!fs.existsSync(root)) {
    fail(`Codex skills root does not exist: ${root}`);
  }
  for (const skillId of expectedDefaultVisibleDomainSkillIds) {
    const skillPath = path.join(root, skillId, 'SKILL.md');
    if (fs.existsSync(skillPath)) {
      fail(`${skillId} must not be mirrored as a bare Codex skill at ${skillPath}`);
    }
  }
  return root;
}

function validateContract(policy: any, profile: any, packageJson: any, agentRoots: AgentRootMap): void {
  validatePublicAbi(policy, packageJson);
  const contract = validateAgentInstallationContract(policy);
  validateManagedAgentPackDistribution(contract);
  validatePluginRegistrationInputs(contract);
  validateExposureClasses(policy, contract);
  validateProfileCompanionPayloads(profile);
  validateAgentInstallEntries(policy, contract, agentRoots);
}

function validatePublicAbi(policy: any, packageJson: any): void {
  assertFieldsEqual(policy, {
    owner: 'one-person-lab-app',
    producer_owner: 'one-person-lab',
  }, 'policy');
  assertFieldsEqual(policy.public_abi, {
    primary_semantic_entry: 'skill',
    plugin_role: 'codex_app_distribution_and_capability_bundle',
    direct_skill_compatibility_required: true,
    plugin_must_not_create_second_semantics: true,
    app_must_not_mirror_plugin_skill_as_duplicate_bare_skill: true,
  }, 'public ABI');
  assertEqual(
    packageJson.scripts?.['validate:agent-installation'],
    'node --experimental-strip-types scripts/validate-agent-installation-contract.ts',
    'package validate:agent-installation script',
  );
}

function validateAgentInstallationContract(policy: any): any {
  const contract = policy.agent_installation_contract;
  if (!contract) {
    fail('missing agent_installation_contract');
  }
  assertFieldsEqual(contract, {
    owner: 'one-person-lab-app',
    producer_owner: 'one-person-lab',
    unified_sync_command: 'opl connect sync-skills',
    managed_install_source: 'opl_managed_modules',
    user_agent_installation_mode: 'consume_shared_skill_action_stage_metadata',
    codex_plugin_registry_target: 'codex_plugin_registry',
    direct_skill_target: 'codex_user_skill_discovery_path',
    product_entry_target: 'family-product-entry-manifest-v2',
    may_use_developer_checkout_by_default: false,
    developer_checkout_override_policy: 'explicit_opt_in_only',
    developer_checkout_override_surface: 'Developer Profile source_channel capability',
    ordinary_user_module_source: 'app_cli_managed_ghcr_opl_packages_channel',
    duplicate_bare_skill_policy: 'forbid_domain_plugin_skill_mirrors',
  }, 'agent contract');
  assertArrayEqual(contract.required_agent_ids, expectedRequiredAgentIds, 'required agent ids');
  assertArrayEqual(contract.default_plugin_agent_ids, expectedDefaultPluginAgentIds, 'default plugin agent ids');
  assertArrayEqual(contract.generated_plugin_agent_ids, expectedGeneratedAgentIds, 'generated plugin agent ids');
  assertArrayEqual(contract.fail_closed_states, expectedFailClosedStates, 'agent contract fail closed states');
  assertArrayEqual(policy.sync_and_install_contract?.fail_closed_states, expectedFailClosedStates, 'sync fail closed states');
  assertArrayEqual(contract.fail_closed_states, policy.sync_and_install_contract.fail_closed_states, 'shared fail closed states');
  assertArrayEqual(contract.module_package_channel_agent_ids, expectedRequiredAgentIds, 'module package channel agent ids');
  validatePackageManagerLifecycle(contract);
  validateThirdPartyManualSourcePolicy(contract);
  validatePackageLockReceiptContract(contract);
  validateAtomicBundlePolicy(contract);
  return contract;
}

function validatePackageManagerLifecycle(contract: any): void {
  const lifecycle = contract.package_manager_lifecycle;
  assertFieldsEqual(lifecycle, {
    policy_surface: 'Settings Capabilities package manager and app/cli action receipts',
    manual_check_policy: 'explicit_user_action_only',
    apply_selected_policy: 'explicit_user_selected_package_set_only',
    mutating_actions_require_action_receipt: true,
    rollback_ref_required_for_mutating_actions: true,
    package_lock_required: true,
    domain_truth_authority_allowed: false,
  }, 'package manager lifecycle');
  assertArrayEqual(lifecycle?.actions, expectedPackageLifecycleActions, 'package manager lifecycle actions');
}

function validateThirdPartyManualSourcePolicy(contract: any): void {
  const sourcePolicy = contract.third_party_manual_source_policy;
  assertArrayEqual(
    sourcePolicy?.ordinary_user_default_source_kinds,
    ['first_party_managed_cohort', 'bundled_full_runtime_modules'],
    'manual source ordinary defaults',
  );
  assertArrayEqual(
    sourcePolicy?.manual_third_party_allowed_source_kinds,
    expectedManualThirdPartySourceKinds,
    'manual third-party source kinds',
  );
  assertArrayEqual(
    sourcePolicy?.manual_third_party_requires,
    expectedManualThirdPartyRequires,
    'manual third-party source requirements',
  );
  assertFieldsEqual(sourcePolicy, {
    developer_override_source_kind: 'developer_checkout_override',
    app_hardcoded_repo_path_allowed: false,
    duplicate_bare_skill_mirrors_allowed: false,
    homebrew_package_formula_allowed: false,
    third_party_catalog_required: false,
  }, 'manual source policy');
  if (!sourcePolicy?.validation_scope?.includes('without hardcoding exact third-party package ids')) {
    fail('manual source policy must validate shape without hardcoding exact third-party package ids');
  }
}

function validatePackageLockReceiptContract(contract: any): void {
  const receiptContract = contract.package_lock_receipt_contract;
  assertFieldsEqual(receiptContract, {
    lock_owner: 'one-person-lab',
    app_role: 'require_and_display_package_lock_refs_without_owning_domain_semantics',
    trust_tier_required: true,
    rollback_ref_required: true,
    codex_visible_entry_required: true,
    optional_skill_refs_are_refs_only: true,
  }, 'package lock receipt contract');
  assertArrayEqual(
    receiptContract?.required_fields,
    expectedPackageLockReceiptFields,
    'package lock receipt fields',
  );
  assertArrayEqual(
    receiptContract?.source_kind_allowed_values,
    expectedPackageSourceKinds,
    'package lock source kinds',
  );
}

function validateAtomicBundlePolicy(contract: any): void {
  const atomicPolicy = contract.atomic_bundle_policy;
  assertArrayEqual(
    atomicPolicy?.managed_package_unit_agent_ids,
    expectedRequiredAgentIds,
    'atomic package unit agent ids',
  );
  assertArrayEqual(
    atomicPolicy?.package_unit_includes,
    expectedAtomicPackageUnitIncludes,
    'atomic package unit includes',
  );
  assertFieldsEqual(atomicPolicy, {
    reconcile_update_uninstall_as_unit: true,
    domain_repo_remains_semantic_owner: true,
    app_package_manager_scope: 'install_exposure_package_lock_action_receipts_and_codex_visible_entries_only',
  }, 'atomic bundle policy');
  assertFieldsEqual(atomicPolicy?.mas_professional_skill_pack_unit, {
    package_id: 'opl.mas',
    agent_id: 'mas',
    required_skill_pack_id: 'mas-professional-skill-pack',
    atomic_with_agent_package: true,
    domain_repo_remains_semantic_owner: true,
  }, 'MAS professional skill pack unit');
  assertArrayEqual(
    atomicPolicy?.mas_professional_skill_pack_unit?.lifecycle_actions,
    ['install', 'update', 'repair', 'rollback', 'uninstall'],
    'MAS professional skill pack lifecycle actions',
  );
}

function validateManagedAgentPackDistribution(contract: any): void {
  const distribution = contract.managed_agent_pack_distribution;
  assertFieldsEqual(distribution, {
    channel_id: 'opl_distribution_cohort',
    default_transport: 'app_cli_managed_background_maintenance',
    default_update_mode: 'silent_background',
    default_manifest_tag: 'latest',
    must_not_depend_on_fixed_version_tag_by_default: true,
    github_packages_unavailable_policy: 'fail_closed_with_actionable_background_maintenance_error',
    homebrew_distribution_allowed: false,
    homebrew_formula_allowed: false,
    must_not_write_user_codex_state: true,
    must_not_define_agent_semantics: true,
    cohort_manifest_required: true,
  }, 'agent-pack distribution');
  assertArrayFieldsEqual(distribution, {
    post_update_sync_required: ['codex_plugin_registry', 'plugin_packaged_skills', 'opl_generated_plugin_surface', 'codex_surface'],
    package_agent_ids: expectedRequiredAgentIds,
    activation_commands: ['opl connect reconcile-modules', 'opl connect sync-skills'],
    fallback_source_order: [
      'bundled_full_runtime_modules',
      'app_cli_managed_ghcr_opl_packages_channel',
      'explicit_developer_checkout_override',
    ],
    forbidden_homebrew_formulae: ['one-person-lab-modules', 'one-person-lab-modules-nightly'],
  }, 'agent-pack distribution');
}

function validatePluginRegistrationInputs(contract: any): void {
  assertEqual(contract.plugin_registration_validation_command, 'npm run validate:agent-installation', 'agent validation command');
  assertFieldsEqual(contract.plugin_registration_validation_inputs, {
    plugin_root_flag: '--agent-root <agent_id>=<path>',
    codex_skills_root_flag: '--codex-skills-root <path>',
    default_live_codex_skills_root: '~/.codex/skills',
    codex_skills_root_validation_scope: 'fail if mas, mag, rca, or opl-bookforge exists as a bare Codex skill mirror at <codex_skills_root>/<codex_visible_entry>/SKILL.md',
  }, 'agent validation inputs');
  assertArrayEqual(
    contract.plugin_registration_validation_inputs?.validated_output_fields,
    ['validated_plugin_roots', 'validated_codex_skills_root'],
    'agent validation output fields',
  );
}

function validateExposureClasses(policy: any, contract: any): void {
  const domainPluginClass = findExposureClass(policy, 'codex_surface');
  assertArrayEqual(domainPluginClass.members, expectedDefaultVisibleDomainSkillIds, 'domain plugin exposure members');
  assertEqual(domainPluginClass.sync_target, contract.codex_plugin_registry_target, 'domain plugin sync target');
  assertEqual(domainPluginClass.legacy_alias, 'family_domain_plugin_surfaces', 'domain plugin exposure legacy alias');
  assertArrayEqual(domainPluginClass.must_not_sync_to, [
    '~/.codex/skills/mas',
    '~/.codex/skills/mag',
    '~/.codex/skills/rca',
    '~/.codex/skills/opl-bookforge',
  ], 'domain plugin forbidden sync targets');

  const generatedClass = findExposureClass(policy, 'opl_generated_plugin_surfaces');
  assertArrayEqual(generatedClass.members, expectedGeneratedPluginSkillIds, 'generated plugin exposure members');
  assertEqual(generatedClass.sync_target, 'opl_generated_codex_plugin_surface', 'generated plugin sync target');

  const companionClass = findExposureClass(policy, 'companion_tools_codex_skills');
  assertArrayEqual(companionClass.members, expectedCompanionSkillSyncIds, 'companion skill sync members');
  assertEqual(companionClass.legacy_alias, 'companion_skill_sync', 'companion skill sync legacy alias');
  for (const agentId of expectedRepoPackagedPluginAgentIds) {
    if (companionClass.members.includes(agentId)) {
      fail(`companion skill sync must not include domain plugin ${agentId}`);
    }
  }
}

function validateProfileCompanionPayloads(profile: any): void {
  const companionPayloads = profile.companion_payloads;
  assertArrayFieldsEqual(companionPayloads, {
    domain_plugin_skill_ids: expectedDefaultVisibleDomainSkillIds,
    companion_skill_sync_default_ids: expectedCompanionSkillSyncIds,
  }, 'profile companion payloads');
  assertEqual(companionPayloads?.domain_plugin_skills_must_not_be_companion_mirrors, true, 'profile domain plugin mirror guard');
  assertArrayFieldsInclude(companionPayloads, {
    default_packaged_codex_skill_ids: expectedDefaultVisibleDomainSkillIds,
    packaged_not_default_visible_codex_skill_ids: ['opl-meta-agent'],
  }, 'profile companion payloads');
}

function validateAgentInstallEntries(policy: any, contract: any, agentRoots: AgentRootMap): void {
  for (const agentId of expectedRepoPackagedPluginAgentIds) {
    const exposure = findDomainExposure(policy, agentId);
    const installAgent = findInstallAgent(contract, agentId);
    assertEqual(exposure.preferred_app_distribution, 'plugin_packaged_skill', `${agentId} exposure distribution`);
    assertEqual(exposure.direct_skill_semantics_required, true, `${agentId} direct skill semantics`);
    assertEqual(installAgent.preferred_distribution, exposure.preferred_app_distribution, `${agentId} install distribution`);
    assertEqual(installAgent.codex_visible_entry, exposure.codex_visible_entry, `${agentId} codex visible entry`);
    assertEqual(installAgent.plugin_registry_required, true, `${agentId} plugin registry required`);
    assertEqual(installAgent.direct_skill_compatibility_required, true, `${agentId} direct skill required`);
    assertEqual(installAgent.plugin_must_package_skill, true, `${agentId} plugin packages skill`);
    assertEqual(installAgent.must_not_create_second_semantics, true, `${agentId} second semantics guard`);
    assertEqual(installAgent.sync_command, contract.unified_sync_command, `${agentId} sync command`);
    assertEqual(installAgent.product_entry_manifest, contract.product_entry_target, `${agentId} product entry manifest`);
    assertEqual(
      installAgent.canonical_metadata_source,
      'domain_action_catalog_and_stage_control_plane',
      `${agentId} canonical metadata source`,
    );
  }

  const bookforgeExposure = findDomainExposure(policy, 'bookforge');
  const bookforgeInstallAgent = findInstallAgent(contract, 'bookforge');
  assertEqual(bookforgeExposure.default_home_visible, true, 'BookForge default visibility');
  assertEqual(bookforgeExposure.preferred_app_distribution, 'opl_generated_codex_plugin_surface', 'BookForge exposure distribution');
  assertEqual(bookforgeExposure.codex_visible_entry, 'opl-bookforge', 'BookForge Codex visible entry');
  assertEqual(bookforgeInstallAgent.preferred_distribution, 'opl_generated_codex_plugin_surface', 'BookForge install distribution');
  assertEqual(bookforgeInstallAgent.module_id, 'oplbookforge', 'BookForge module id');
  assertEqual(bookforgeInstallAgent.plugin_registry_required, true, 'BookForge plugin registry policy');
  assertEqual(bookforgeInstallAgent.plugin_must_package_skill, false, 'BookForge plugin packaging policy');
  assertEqual(bookforgeInstallAgent.codex_visible_entry, 'opl-bookforge', 'BookForge Codex visible entry');
  assertEqual(
    bookforgeInstallAgent.canonical_metadata_source,
    'opl_generated_interface_contract_pack',
    'BookForge canonical metadata source',
  );

  const omaExposure = findDomainExposure(policy, 'oma');
  const omaInstallAgent = findInstallAgent(contract, 'oma');
  assertEqual(omaExposure.preferred_app_distribution, 'opl_generated_codex_plugin_surface', 'OMA exposure distribution');
  assertEqual(omaInstallAgent.plugin_registry_required, true, 'OMA plugin registry policy');
  assertEqual(omaInstallAgent.plugin_must_package_skill, false, 'OMA plugin packaging policy');
  assertEqual(omaInstallAgent.codex_visible_entry, 'opl-meta-agent', 'OMA Codex visible entry');
  assertEqual(
    omaInstallAgent.canonical_metadata_source,
    'opl_generated_interface_contract_pack',
    'OMA canonical metadata source',
  );

  for (const [agentId, root] of agentRoots.entries()) {
    validatePluginRoot(agentId, root, findInstallAgent(contract, agentId));
  }
}

const { agentRoots, codexSkillsRoot } = parseArgs(process.argv.slice(2));
validateContract(readJson(policyPath), readJson(profilePath), readJson(packageJsonPath), agentRoots);
const validatedCodexSkillsRoot = validateNoDuplicateBareDomainSkills(codexSkillsRoot);

console.log(JSON.stringify({
  status: 'passed',
  surface_id: 'opl_app_agent_installation_contract_validation',
  checked_agents: expectedRequiredAgentIds,
  plugin_agents: expectedDefaultPluginAgentIds,
  default_visible_domain_skills: expectedDefaultVisibleDomainSkillIds,
  generated_plugin_agents: expectedGeneratedAgentIds,
  generated_plugin_skills: expectedGeneratedPluginSkillIds,
  package_lifecycle_actions: expectedPackageLifecycleActions,
  package_lock_receipt_fields: expectedPackageLockReceiptFields,
  validated_plugin_roots: Object.fromEntries(agentRoots),
  validated_codex_skills_root: validatedCodexSkillsRoot,
}, null, 2));
console.log('PASS: App agent installation contract is consistent.');

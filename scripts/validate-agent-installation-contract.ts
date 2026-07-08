#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

type AgentRootMap = Map<string, string>;

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const policyPath = path.join(appRoot, 'contracts', 'app-install-exposure-policy.json');
const profilePath = path.join(appRoot, 'contracts', 'app-product-profile.json');
const registryPath = path.join(appRoot, 'contracts', 'agent-package-registry.json');
const agentPackageSurfaceSchemaPath = path.join(appRoot, 'contracts', 'agent-package-surfaces.schema.json');
const agentPackageManifestFixtureDir = path.join(appRoot, 'contracts', 'fixtures', 'agent-package-manifests');
const packageJsonPath = path.join(appRoot, 'package.json');
const expectedDefaultPluginAgentIds = ['med-autoscience', 'med-autogrant', 'redcube-ai', 'opl-bookforge'];
const expectedRepoPackagedPluginAgentIds = ['med-autoscience', 'med-autogrant', 'redcube-ai'];
const expectedGeneratedAgentIds = ['opl-meta-agent', 'opl-bookforge'];
const expectedRequiredAgentIds = ['med-autoscience', 'med-autogrant', 'redcube-ai', 'opl-meta-agent', 'opl-bookforge', 'mas-scholar-skills'];
const expectedDefaultVisibleDomainSkillIds = ['med-autoscience', 'med-autogrant', 'redcube-ai', 'opl-bookforge'];
const expectedGeneratedPluginSkillIds = ['opl-meta-agent', 'opl-bookforge'];
const expectedSkillPackSources: Record<string, string> = {
  'med-autoscience': 'github:gaofeng21cn/med-autoscience/plugins/med-autoscience/skills/med-autoscience',
  'med-autogrant': 'github:gaofeng21cn/med-autogrant/plugins/med-autogrant/skills/med-autogrant',
  'redcube-ai': 'github:gaofeng21cn/redcube-ai/plugins/redcube-ai/skills/redcube-ai',
  'opl-bookforge': 'github:gaofeng21cn/opl-bookforge/contracts/pack_compiler_input.json',
  'opl-meta-agent': 'github:gaofeng21cn/opl-meta-agent/contracts/pack_compiler_input.json',
};
const expectedGeneratedPluginSourceRefs: Record<string, string> = {
  'opl-bookforge': 'opl_generated:gaofeng21cn/opl-bookforge/contracts/pack_compiler_input.json',
  'opl-meta-agent': 'opl_generated:gaofeng21cn/opl-meta-agent/contracts/pack_compiler_input.json',
};
const expectedGeneratedSemanticPackRoots: Record<string, string> = {
  'opl-bookforge': 'github:gaofeng21cn/opl-bookforge/agent',
  'opl-meta-agent': 'github:gaofeng21cn/opl-meta-agent/agent',
};
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
  'refresh_registry',
  'install_from_manifest_url',
  'agent_package_update',
  'agent_package_repair',
  'agent_package_uninstall',
  'agent_package_preferences_set',
];
const expectedRegistrySourceKinds = [
  'default_opl_registry',
  'organization_registry_url',
  'user_registry_url',
];
const expectedRegistryManagementActions = [
  'refresh_registry',
  'install_from_manifest_url',
];
const expectedRegistryEntryFields = [
  'package_id',
  'display_name',
  'publisher',
  'source',
  'manifest_url',
  'latest_version',
  'trust_tier',
];
const expectedManifestRequiredFields = [
  'package_id',
  'agent_id',
  'display_name',
  'publisher',
  'version',
  'source',
  'codex_surface',
  'skill_packs',
  'entrypoints',
  'health_check',
  'permissions',
  'update_channel',
  'rollback_ref',
];
const expectedDistributionPayloadFields = [
  'payload_kind',
  'payload_ref',
  'payload_digest_ref',
  'required_skill_pack_lock_refs',
  'proof_status',
  'live_download_proof',
  'installed_reload_proof',
  'oci_ref',
  'oci_media_type',
  'immutable_tag',
  'rolling_tag',
  'promotion_policy',
  'install_truth',
];
const expectedHomeShortcutRequiredFields = [
  'shortcut_id',
  'package_id',
  'primary_label',
  'codex_visible_entry',
  'required_skill_ids',
  'source',
  'executor',
  'display_policy',
  'default_visible',
  'user_configurable',
];
const expectedInvocationReceiptRequiredFields = [
  'receipt_type',
  'executor',
  'package_id',
  'agent_id',
  'skill_ids',
  'source',
  'launched_from',
  'display_policy',
];
const expectedRegistryExcludedFields = [
  'session_contract_ref',
  'domain_workflow_schema',
  'prompt_body',
  'artifact_schema',
  'readiness_verdict_rule',
  'quality_verdict_rule',
  'owner_receipt_authority',
];
const expectedRegistryPackageIds = ['med-autoscience', 'med-autogrant', 'redcube-ai', 'opl-bookforge', 'opl-meta-agent'];
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
const expectedRemoteDistributionPayloadFields = [
  'remote_manifest_url',
  'distribution_payload_ref',
  'source_digest_ref',
  'trust_tier',
  'package_lock_receipt',
  'rollback_ref',
  'oci_ref',
  'oci_digest',
];
const expectedFirstPartyDistributionPayloadFields = [
  'cohort_manifest_ref',
  'distribution_payload_ref',
  'payload_digest_ref',
  'required_skill_pack_lock_refs',
  'rollback_ref',
  'oci_ref',
  'oci_media_type',
  'immutable_tag',
  'rolling_tag',
  'promotion_policy',
  'install_truth',
];
const expectedPackageSourceKinds = [
  'first_party_ghcr_oci_artifact',
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
  'physical_surface',
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

function isGeneratedAgent(agentId: string): boolean {
  return expectedGeneratedAgentIds.includes(agentId);
}

function localWorkspaceRoots(): string[] {
  const configured = process.env.OPL_AGENT_SOURCE_ROOTS?.trim();
  const roots = configured ? configured.split(path.delimiter) : ['/Users/gaofeng/workspace'];
  return roots.map((root) => root.trim()).filter(Boolean);
}

function parseGithubSource(source: string): { repo: string; repoPath: string } | null {
  const match = source.match(/^github:[^/]+\/([^/]+)\/(.+)$/);
  if (!match) {
    return null;
  }
  return { repo: match[1], repoPath: match[2] };
}

function validateGithubSourcePathIfAvailable(source: string, label: string): string | null {
  const parsed = parseGithubSource(source);
  if (!parsed) {
    fail(`${label} must be a github:<owner>/<repo>/<path> ref`);
  }
  for (const root of localWorkspaceRoots()) {
    const repoRoot = path.join(root, parsed.repo);
    if (!fs.existsSync(repoRoot)) {
      continue;
    }
    const localPath = path.join(repoRoot, parsed.repoPath);
    if (!fs.existsSync(localPath)) {
      fail(`${label} does not resolve in local sibling checkout: ${localPath}`);
    }
    return localPath;
  }
  return null;
}

function frontmatterName(skillPath: string): string | null {
  const content = fs.readFileSync(skillPath, 'utf8');
  if (!content.startsWith('---\n')) {
    return null;
  }
  const end = content.indexOf('\n---', 4);
  if (end < 0) {
    return null;
  }
  const match = content.slice(4, end).match(/^name:\s*(.+?)\s*$/m);
  return match?.[1]?.replace(/^['"]|['"]$/g, '') ?? null;
}

function validateSkillFrontmatterName(skillPath: string, expectedName: string, label: string): void {
  if (!fs.existsSync(skillPath)) {
    fail(`${label} is missing SKILL.md: ${skillPath}`);
  }
  assertEqual(frontmatterName(skillPath), expectedName, `${label} frontmatter name`);
}

function validateRepoPluginSkillSource(skillDir: string, pluginName: string, label: string): void {
  const pluginRoot = path.dirname(path.dirname(skillDir));
  const pluginManifestPath = path.join(pluginRoot, '.codex-plugin', 'plugin.json');
  if (!fs.existsSync(pluginManifestPath)) {
    fail(`${label} is missing .codex-plugin/plugin.json: ${pluginRoot}`);
  }
  const pluginManifest = readJson(pluginManifestPath);
  assertEqual(pluginManifest.name, pluginName, `${label} plugin manifest name`);
  assertEqual(pluginManifest.skills, './skills/', `${label} plugin manifest skills path`);
  validateSkillFrontmatterName(path.join(skillDir, 'SKILL.md'), pluginName, label);
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
  validateSkillFrontmatterName(skillPath, pluginName, `${agentId} plugin skill`);
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

function validateContract(
  policy: any,
  profile: any,
  registry: any,
  agentPackageSurfaceSchema: any,
  packageJson: any,
  agentRoots: AgentRootMap
): void {
  validatePublicAbi(policy, packageJson);
  const contract = validateAgentInstallationContract(policy);
  validateAgentPackageSurfaceSchema(contract, registry, agentPackageSurfaceSchema);
  validateAgentRegistryPolicy(contract, profile, registry);
  validateFirstPartyManifestFixtures(profile, registry, agentPackageSurfaceSchema);
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
    ordinary_user_module_source: 'app_cli_managed_ghcr_oci_agent_packages_latest_channel',
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
  validateRegistryPolicyShape(contract);
  validateThirdPartyManualSourcePolicy(contract);
  validatePackageLockReceiptContract(contract);
  validateAtomicBundlePolicy(contract);
  return contract;
}

function validateRegistryPolicyShape(contract: any): void {
  const registryPolicy = contract.agent_registry_policy;
  assertFieldsEqual(registryPolicy, {
    policy_surface: 'Settings Capabilities registry discovery, manifest URL install entry, and package receipt display',
    default_registry_ref: 'contracts/agent-package-registry.json',
    default_registry_source_kind: 'default_opl_registry',
    default_registry_url: 'https://raw.githubusercontent.com/gaofeng21cn/one-person-lab-app/main/contracts/agent-package-registry.json',
    manifest_schema_ref: 'contracts/agent-package-surfaces.schema.json#/$defs/agent_package_manifest',
    home_shortcut_schema_ref: 'contracts/agent-package-surfaces.schema.json#/$defs/home_shortcut_metadata',
    invocation_receipt_schema_ref: 'contracts/agent-package-surfaces.schema.json#/$defs/invocation_receipt',
    package_lock_receipt_schema_ref: 'contracts/agent-package-surfaces.schema.json#/$defs/package_lock_receipt',
    first_party_manifest_fixture_dir: 'contracts/fixtures/agent-package-manifests',
    registry_is_discovery_only: true,
    registry_install_authority_allowed: false,
    manifest_url_required_for_install: true,
    manifest_validation_required_before_install: true,
    install_authority: 'validated_agent_package_manifest_plus_framework_package_lock_receipt',
    mutating_actions_owner: 'one-person-lab',
    app_role: 'fetch_or_import_registry_entries_display_candidates_and_route_selected_manifest_url_to_framework_without_owning_agent_semantics',
    direct_manifest_url_install_allowed: true,
    third_party_registry_required_for_manual_install: false,
    third_party_entry_policy: 'registry_entries_may_be_listed_for_discovery_but_install_requires_explicit_user_action_trust_tier_assignment_manifest_validation_package_lock_receipt_and_rollback_ref',
    session_contract_allowed: false,
    app_hardcoded_agent_ids_required: false,
  }, 'agent registry policy');
  assertArrayEqual(registryPolicy?.allowed_registry_source_kinds, expectedRegistrySourceKinds, 'registry source kinds');
  assertArrayEqual(registryPolicy?.registry_management_actions, expectedRegistryManagementActions, 'registry management actions');
  assertArrayEqual(registryPolicy?.entry_required_fields, expectedRegistryEntryFields, 'registry entry fields');
  assertArrayEqual(registryPolicy?.manifest_required_fields, expectedManifestRequiredFields, 'manifest required fields');
}

function schemaDef(schema: any, name: string): any {
  const def = schema?.$defs?.[name];
  if (!def || typeof def !== 'object') {
    fail(`agent package surface schema missing $defs.${name}`);
  }
  return def;
}

function validateAgentPackageSurfaceSchema(contract: any, registry: any, schema: any): void {
  assertFieldsEqual(schema, {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    $id: 'https://onepersonlab.dev/contracts/agent-package-surfaces.schema.json',
    title: 'OPL Agent Package Surfaces',
  }, 'agent package surface schema');
  assertArrayEqual(
    schemaDef(schema, 'agent_package_manifest').required,
    expectedManifestRequiredFields,
    'agent package manifest schema required fields',
  );
  assertArrayEqual(
    schemaDef(schema, 'agent_package_manifest').properties?.distribution_payload?.required,
    expectedDistributionPayloadFields,
    'agent package manifest distribution payload fields',
  );
  if (schemaDef(schema, 'agent_package_manifest').properties?.codex_surface?.properties?.plugin_payload_manifest_url?.type !== 'string') {
    fail('agent package manifest codex_surface must allow plugin_payload_manifest_url');
  }
  const physicalSurfaceProperties = schemaDef(schema, 'package_lock_receipt').properties?.physical_surface?.properties;
  for (const field of ['plugin_payload_manifest_url', 'plugin_payload_manifest_sha256', 'plugin_payload_cache_path']) {
    if (physicalSurfaceProperties?.[field]?.type !== 'string') {
      fail(`package lock physical_surface must allow ${field}`);
    }
  }
  assertArrayEqual(
    schemaDef(schema, 'home_shortcut_metadata').required,
    expectedHomeShortcutRequiredFields,
    'home shortcut metadata schema required fields',
  );
  assertArrayEqual(
    schemaDef(schema, 'invocation_receipt').required,
    expectedInvocationReceiptRequiredFields,
    'invocation receipt schema required fields',
  );
  assertArrayEqual(
    schemaDef(schema, 'package_lock_receipt').required,
    expectedPackageLockReceiptFields,
    'package lock receipt schema required fields',
  );
  assertEqual(
    contract.agent_registry_policy.manifest_schema_ref,
    registry.manifest_schema_ref,
    'registry manifest schema ref',
  );
  assertEqual(
    contract.agent_registry_policy.first_party_manifest_fixture_dir,
    registry.first_party_manifest_fixture_dir,
    'registry first-party manifest fixture dir',
  );
}

function validateAgentRegistryPolicy(contract: any, profile: any, registry: any): void {
  const registryPolicy = contract.agent_registry_policy;
  assertFieldsEqual(registry, {
    owner: 'one-person-lab-app',
    purpose: 'agent_package_registry_catalog_contract',
    state: 'active_app_discovery_contract',
    version: 1,
    policy_ref: 'contracts/app-install-exposure-policy.json#agent_installation_contract.agent_registry_policy',
    manifest_schema_ref: 'contracts/agent-package-surfaces.schema.json#/$defs/agent_package_manifest',
    first_party_manifest_fixture_dir: 'contracts/fixtures/agent-package-manifests',
    registry_id: 'opl-default-agent-registry',
    registry_name: 'OPL Agent Registry',
    registry_source_kind: 'default_opl_registry',
    registry_url: registryPolicy.default_registry_url,
    discovery_only: true,
    install_authority_allowed: false,
  }, 'agent registry catalog');
  if (!registry.machine_boundary?.includes('discovery catalog fixture')) {
    fail('agent registry catalog must state that it is discovery-only App-owned fixture material');
  }
  assertArrayEqual(registry.entry_required_fields, expectedRegistryEntryFields, 'registry catalog entry fields');
  assertArrayEqual(registry.manifest_required_fields, expectedManifestRequiredFields, 'registry catalog manifest fields');
  assertArrayEqual(registry.excluded_registry_fields, expectedRegistryExcludedFields, 'registry catalog excluded fields');

  const profilePackages = profile.gui?.professional_agent_packages ?? [];
  assertArrayEqual(
    profilePackages.map((entry: any) => entry.package_id),
    expectedRegistryPackageIds,
    'profile professional package ids',
  );
  const entries = registry.entries ?? [];
  assertArrayEqual(
    entries.map((entry: any) => entry.package_id),
    expectedRegistryPackageIds,
    'registry package ids',
  );
  const profileById = new Map(profilePackages.map((entry: any) => [entry.package_id, entry]));
  for (const entry of entries) {
    for (const field of expectedRegistryEntryFields) {
      if (entry[field] === undefined || entry[field] === null || entry[field] === '') {
        fail(`registry entry ${entry.package_id} missing ${field}`);
      }
    }
    if (!String(entry.manifest_url).startsWith('https://raw.githubusercontent.com/')) {
      fail(`registry entry ${entry.package_id} manifest_url must be a raw GitHub HTTPS URL`);
    }
    assertEqual(entry.source, 'first_party', `registry entry ${entry.package_id} source`);
    assertEqual(entry.trust_tier, 'first_party', `registry entry ${entry.package_id} trust tier`);
    assertEqual(entry.display_policy, 'refs_only_no_domain_verdict', `registry entry ${entry.package_id} display policy`);
    for (const excludedField of expectedRegistryExcludedFields) {
      if (entry[excludedField] !== undefined) {
        fail(`registry entry ${entry.package_id} must not define ${excludedField}`);
      }
    }
    const profileEntry = profileById.get(entry.package_id);
    if (!profileEntry) {
      fail(`registry entry ${entry.package_id} has no matching profile package`);
    }
    assertEqual(entry.codex_visible_entry, profileEntry.codex_visible_entry, `${entry.package_id} registry codex entry`);
    assertArrayEqual(entry.required_skill_ids, profileEntry.required_skill_ids, `${entry.package_id} registry required skills`);
    assertArrayEqual(entry.optional_skill_ids, profileEntry.optional_skill_ids, `${entry.package_id} registry optional skills`);
    assertArrayEqual(entry.home_shortcut_ids, profileEntry.home_shortcut_ids, `${entry.package_id} registry home shortcuts`);
    assertEqual(entry.starter_default, profileEntry.package_kind === 'starter_professional_agent_package', `${entry.package_id} registry starter default`);
  }
}

function validateFirstPartyManifestFixtures(profile: any, registry: any, schema: any): void {
  if (!fs.existsSync(agentPackageManifestFixtureDir)) {
    fail(`missing first-party agent package manifest fixture dir: ${agentPackageManifestFixtureDir}`);
  }
  const manifestSchema = schemaDef(schema, 'agent_package_manifest');
  const profilePackages = new Map(
    (profile.gui?.professional_agent_packages ?? []).map((entry: any) => [entry.package_id, entry]),
  );
  const registryEntries = registry.entries ?? [];
  assertArrayEqual(
    fs.readdirSync(agentPackageManifestFixtureDir).filter((entry) => entry.endsWith('.json')).sort(),
    expectedRegistryPackageIds.map((packageId) => `${packageId}.json`).sort(),
    'agent package manifest fixture files',
  );
  for (const registryEntry of registryEntries) {
    const fixturePath = path.join(agentPackageManifestFixtureDir, `${registryEntry.package_id}.json`);
    const manifest = readJson(fixturePath);
    const missing = expectedManifestRequiredFields.filter((field) => manifest[field] === undefined || manifest[field] === null || manifest[field] === '');
    if (missing.length > 0) {
      fail(`manifest fixture ${registryEntry.package_id} missing ${missing.join(', ')}`);
    }
    for (const forbiddenField of expectedRegistryExcludedFields) {
      if (manifest[forbiddenField] !== undefined) {
        fail(`manifest fixture ${registryEntry.package_id} must not define ${forbiddenField}`);
      }
    }
    if (!manifestSchema?.not?.anyOf || !Array.isArray(manifestSchema.not.anyOf)) {
      fail('agent package manifest schema must forbid session/domain authority fields');
    }
    const profileEntry = profilePackages.get(registryEntry.package_id);
    if (!profileEntry) {
      fail(`manifest fixture ${registryEntry.package_id} has no matching profile package`);
    }
    assertEqual(manifest.package_id, registryEntry.package_id, `${registryEntry.package_id} manifest package id`);
    assertEqual(manifest.display_name, registryEntry.display_name, `${registryEntry.package_id} manifest display name`);
    assertEqual(manifest.publisher, registryEntry.publisher, `${registryEntry.package_id} manifest publisher`);
    assertEqual(manifest.source, registryEntry.source, `${registryEntry.package_id} manifest source`);
    assertEqual(manifest.version, registryEntry.latest_version, `${registryEntry.package_id} manifest version`);
    assertEqual(manifest.update_channel, 'managed_opl_packages', `${registryEntry.package_id} manifest update channel`);
    assertEqual(manifest.health_check?.kind, 'opl_package_receipt', `${registryEntry.package_id} manifest health check kind`);
    assertArrayEqual(
      Object.keys(manifest.distribution_payload ?? {}),
      expectedDistributionPayloadFields,
      `${registryEntry.package_id} manifest distribution payload fields`,
    );
    assertFieldsEqual(manifest.distribution_payload, {
      payload_kind: 'ghcr_oci_agent_package',
      proof_status: 'contract_fixture_non_live',
      live_download_proof: false,
      installed_reload_proof: false,
      oci_media_type: 'application/vnd.onepersonlab.agent.package.v1+tar',
      rolling_tag: 'latest',
      promotion_policy: 'daily_candidate_gates_then_promote_latest',
      install_truth: 'resolved_digest_lock',
    }, `${registryEntry.package_id} manifest distribution payload`);
    if (!String(manifest.distribution_payload.oci_ref ?? '').startsWith(`ghcr.io/gaofeng21cn/opl-agent-${registryEntry.package_id}:latest`)) {
      fail(`manifest fixture ${registryEntry.package_id} must use a GHCR latest OCI ref`);
    }
    assertEqual(
      manifest.distribution_payload.immutable_tag,
      manifest.version,
      `${registryEntry.package_id} manifest immutable OCI tag`,
    );
    assertArrayEqual(
      manifest.codex_surface?.plugin_ids,
      [registryEntry.codex_visible_entry],
      `${registryEntry.package_id} manifest plugin ids`,
    );
    assertArrayEqual(
      manifest.codex_surface?.required_skill_ids,
      registryEntry.required_skill_ids,
      `${registryEntry.package_id} manifest required skill ids`,
    );
    assertArrayEqual(
      manifest.codex_surface?.optional_skill_ids,
      registryEntry.optional_skill_ids,
      `${registryEntry.package_id} manifest optional skill ids`,
    );
    assertArrayEqual(
      manifest.codex_surface?.required_skill_ids,
      profileEntry.required_skill_ids,
      `${registryEntry.package_id} manifest profile required skill ids`,
    );
    if (!Array.isArray(manifest.skill_packs) || manifest.skill_packs.length !== 1) {
      fail(`manifest fixture ${registryEntry.package_id} must declare one bundled required skill pack`);
    }
    const skillPack = manifest.skill_packs[0];
    assertEqual(
      skillPack.id,
      `${registryEntry.package_id}-professional-skill-pack`,
      `${registryEntry.package_id} manifest required skill pack id`,
    );
    assertEqual(
      skillPack.install_mode,
      'bundled_required',
      `${registryEntry.package_id} manifest required skill pack install mode`,
    );
    if (skillPack.lock_ref === 'registry.latest_version') {
      fail(`manifest fixture ${registryEntry.package_id} required skill pack lock_ref must not use registry.latest_version`);
    }
    assertArrayEqual(
      manifest.distribution_payload.required_skill_pack_lock_refs,
      [skillPack.lock_ref],
      `${registryEntry.package_id} manifest distribution payload skill pack locks`,
    );
    const expectedSource = expectedSkillPackSources[registryEntry.package_id];
    if (!expectedSource) {
      fail(`manifest fixture ${registryEntry.package_id} has no expected skill pack source`);
    }
    assertEqual(skillPack.source, expectedSource, `${registryEntry.package_id} manifest required skill pack source`);
    if (!String(skillPack.source ?? '').startsWith('github:')) {
      fail(`manifest fixture ${registryEntry.package_id} required skill pack source must be a github ref`);
    }
    const localSourcePath = validateGithubSourcePathIfAvailable(
      skillPack.source,
      `${registryEntry.package_id} manifest required skill pack source`,
    );
    if (isGeneratedAgent(registryEntry.package_id)) {
      assertEqual(
        skillPack.source_kind,
        'opl_generated_plugin_surface',
        `${registryEntry.package_id} manifest skill pack source kind`,
      );
      assertEqual(
        skillPack.generated_surface_owner,
        'one-person-lab',
        `${registryEntry.package_id} manifest skill pack generated owner`,
      );
      assertEqual(
        skillPack.semantic_pack_root,
        expectedGeneratedSemanticPackRoots[registryEntry.package_id],
        `${registryEntry.package_id} manifest semantic pack root`,
      );
      assertEqual(
        manifest.codex_surface?.plugin_source_ref,
        expectedGeneratedPluginSourceRefs[registryEntry.package_id],
        `${registryEntry.package_id} manifest generated plugin source ref`,
      );
      assertEqual(
        manifest.codex_surface?.generated_surface_owner,
        'one-person-lab',
        `${registryEntry.package_id} manifest generated plugin owner`,
      );
      validateGithubSourcePathIfAvailable(
        skillPack.semantic_pack_root,
        `${registryEntry.package_id} manifest semantic pack root`,
      );
    } else {
      assertEqual(skillPack.source_kind, 'repo_plugin_skill', `${registryEntry.package_id} manifest skill pack source kind`);
      if (localSourcePath) {
        validateRepoPluginSkillSource(
          localSourcePath,
          registryEntry.codex_visible_entry,
          `${registryEntry.package_id} manifest source skill`,
        );
      }
    }
    const expectedShortcutIds = registryEntry.home_shortcut_ids ?? [];
    assertArrayEqual(
      manifest.entrypoints.map((entry: any) => entry.shortcut_id),
      expectedShortcutIds,
      `${registryEntry.package_id} manifest entrypoint shortcuts`,
    );
    for (const entrypoint of manifest.entrypoints) {
      assertArrayEqual(
        entrypoint.required_skill_ids,
        registryEntry.required_skill_ids,
        `${registryEntry.package_id} manifest entrypoint required skills`,
      );
      assertEqual(entrypoint.shortcut_eligible, true, `${registryEntry.package_id} manifest entrypoint eligibility`);
    }
  }
}

function validatePackageManagerLifecycle(contract: any): void {
  const lifecycle = contract.package_manager_lifecycle;
  assertFieldsEqual(lifecycle, {
    policy_surface: 'Settings Capabilities package manager and app/cli action receipts',
    manual_check_policy: 'automatic_daily_check_plus_explicit_user_refresh',
    apply_selected_policy: 'automatic_apply_for_clean_managed_roots_explicit_apply_for_selected_packages',
    mutating_actions_require_action_receipt: true,
    rollback_ref_required_for_mutating_actions: true,
    package_lock_required: true,
    domain_truth_authority_allowed: false,
    home_shortcut_preferences_owner: 'one-person-lab',
    home_shortcut_preferences_action: 'agent_package_preferences_set',
    home_shortcut_preferences_readback: 'opl connect agent-packages list/status#home_shortcut_preferences',
  }, 'package manager lifecycle');
  assertArrayEqual(lifecycle?.actions, expectedPackageLifecycleActions, 'package manager lifecycle actions');
  assertFieldsEqual(lifecycle?.automatic_apply_policy, {
    cadence: 'daily_after_core_ready_and_app_startup_check',
    user_visible_channel: 'latest',
    receipt_required: true,
  }, 'package manager lifecycle automatic apply policy');
  assertArrayEqual(
    lifecycle?.automatic_apply_policy?.apply_when,
    ['latest_digest_changed', 'managed_root_clean', 'manifest_permissions_unchanged', 'compatibility_gate_passed'],
    'package manager lifecycle automatic apply conditions',
  );
  assertArrayEqual(
    lifecycle?.automatic_apply_policy?.require_user_action_when,
    ['developer_checkout', 'dirty_checkout', 'permission_scope_changed', 'major_compatibility_break', 'verification_failed'],
    'package manager lifecycle manual action conditions',
  );
}

function validateThirdPartyManualSourcePolicy(contract: any): void {
  const sourcePolicy = contract.third_party_manual_source_policy;
  assertArrayEqual(
    sourcePolicy?.ordinary_user_default_source_kinds,
    ['first_party_ghcr_oci_artifact', 'bundled_full_runtime_modules'],
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
  assertArrayEqual(
    sourcePolicy?.remote_distribution_payload_contract?.required_fields,
    expectedRemoteDistributionPayloadFields,
    'manual source remote distribution payload fields',
  );
  assertFieldsEqual(sourcePolicy?.remote_distribution_payload_contract, {
    download_execution_owner: 'one-person-lab',
    app_contract_claim: 'validate_and_route_refs_only_without_claiming_live_download_or_installed_reload',
    live_download_proof_claim_allowed: false,
    installed_reload_proof_claim_allowed: false,
  }, 'manual source remote distribution payload contract');
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
    framework_local_payload_validation: 'repo_plugin_skill sources must resolve to .codex-plugin/plugin.json plus skills/<required_skill_id>/SKILL.md; opl_generated_plugin_surface sources must resolve to the domain pack compiler input and generated_surface_owner=one-person-lab',
    required_skill_pack_lock_policy: 'skill_packs[].lock_ref must be a release or digest lock and must not equal registry.latest_version or a moving tag',
    reconcile_update_uninstall_as_unit: true,
    domain_repo_remains_semantic_owner: true,
    app_package_manager_scope: 'install_exposure_package_lock_action_receipts_and_codex_visible_entries_only',
    release_payload_proof_live_claim_allowed: false,
    installed_codex_reload_proof_deferred: true,
  }, 'atomic bundle policy');
  assertArrayEqual(
    atomicPolicy?.release_payload_proof_required_fields,
    expectedDistributionPayloadFields,
    'atomic bundle release payload proof fields',
  );
  assertArrayEqual(
    atomicPolicy?.physical_surface_required_skill_readback_fields,
    ['materialized_required_skill_ids', 'materialized_required_skill_paths'],
    'atomic bundle physical surface required skill readback fields',
  );
  assertFieldsEqual(atomicPolicy?.med_autoscience_professional_skill_pack_unit, {
    package_id: 'med-autoscience',
    agent_id: 'med-autoscience',
    required_skill_pack_id: 'med-autoscience-professional-skill-pack',
    atomic_with_agent_package: true,
    domain_repo_remains_semantic_owner: true,
  }, 'MAS professional skill pack unit');
  assertArrayEqual(
    atomicPolicy?.med_autoscience_professional_skill_pack_unit?.lifecycle_actions,
    ['install', 'update', 'repair', 'uninstall'],
    'MAS professional skill pack lifecycle actions',
  );
}

function validateManagedAgentPackDistribution(contract: any): void {
  const distribution = contract.managed_agent_pack_distribution;
  assertFieldsEqual(distribution, {
    channel_id: 'opl_agent_packages_rolling_latest',
    default_transport: 'app_cli_managed_background_maintenance',
    default_update_mode: 'automatic_apply_for_clean_managed_roots',
    default_manifest_tag: 'latest',
    distribution_format: 'ghcr_oci_artifact',
    registry: 'ghcr.io',
    ordinary_user_channel_model: 'rolling_latest_only',
    internal_candidate_channel: 'candidate_ci_only_not_user_visible',
    publication_cadence: 'daily_when_source_digest_changes',
    promotion_policy: 'build_candidate_validate_manifest_skill_plugin_surface_install_smoke_sign_then_promote_latest',
    immutable_tag_required: true,
    digest_lock_required: true,
    latest_is_moving_channel: true,
    stable_or_nightly_user_channels_allowed: false,
    first_party_distribution_payload_status: 'contract_required_non_live_until_release_owner_publishes_payload',
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
    user_visible_channels: ['latest'],
    package_agent_ids: expectedRequiredAgentIds,
    package_ids: [...expectedRequiredAgentIds, 'opl-flow'],
    activation_commands: ['opl connect reconcile-modules', 'opl connect sync-skills'],
    first_party_distribution_payload_required_fields: expectedFirstPartyDistributionPayloadFields,
    fallback_source_order: [
      'bundled_full_runtime_modules',
      'app_cli_managed_ghcr_oci_agent_packages_latest_channel',
      'explicit_developer_checkout_override',
    ],
    forbidden_homebrew_formulae: ['one-person-lab-modules', 'one-person-lab-modules-nightly'],
  }, 'agent-pack distribution');
  assertEqual(distribution?.package_kinds?.['opl-flow'], 'workflow_plugin_package', 'OPL Flow package kind');
  assertFieldsEqual(distribution?.opl_flow_package, {
    package_id: 'opl-flow',
    package_kind: 'workflow_plugin_package',
    consumer: 'optional_user_modes.intelligence_enhancement',
    install_or_refresh_command: 'python3 scripts/install_local_plugin.py --no-profile',
    profile_mutation_allowed: false,
    workflow_profile_semantic_merge_ref: 'managed_update_plane.planes[workflow_profile]',
    standard_updater_allowed: false,
  }, 'OPL Flow package policy');
  assertArrayEqual(distribution?.opl_flow_package?.required_before_actions, ['status', 'enable', 'repair'], 'OPL Flow package preflight actions');
  assertFieldsEqual(distribution?.auto_apply, {
    enabled_for: 'clean_managed_roots_only',
    trigger: 'daily_or_startup_latest_digest_check',
    receipt_required: true,
  }, 'agent-pack distribution auto apply');
  assertArrayEqual(
    distribution?.auto_apply?.skip_when,
    ['developer_checkout_override', 'dirty_checkout', 'permission_scope_changed', 'major_compatibility_break', 'verification_failed', 'idempotency_lock_in_progress'],
    'agent-pack distribution auto apply skips',
  );
}

function validatePluginRegistrationInputs(contract: any): void {
  assertEqual(contract.plugin_registration_validation_command, 'npm run validate:agent-installation', 'agent validation command');
  assertFieldsEqual(contract.plugin_registration_validation_inputs, {
    plugin_root_flag: '--agent-root <agent_id>=<path>',
    codex_skills_root_flag: '--codex-skills-root <path>',
    default_live_codex_skills_root: '~/.codex/skills',
    codex_skills_root_validation_scope: 'fail if med-autoscience, med-autogrant, redcube-ai, or opl-bookforge exists as a bare Codex skill mirror at <codex_skills_root>/<codex_visible_entry>/SKILL.md',
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
    '~/.codex/skills/med-autoscience',
    '~/.codex/skills/med-autogrant',
    '~/.codex/skills/redcube-ai',
    '~/.codex/skills/opl-bookforge',
  ], 'domain plugin forbidden sync targets');

  const generatedClass = findExposureClass(policy, 'opl_generated_plugin_surfaces');
  assertArrayEqual(generatedClass.members, expectedGeneratedPluginSkillIds, 'generated plugin exposure members');
  assertEqual(generatedClass.sync_target, 'opl_generated_codex_plugin_surface', 'generated plugin sync target');

  const companionClass = findExposureClass(policy, 'companion_tools_codex_skills');
  assertArrayEqual(companionClass.members, expectedCompanionSkillSyncIds, 'companion skill sync members');
  assertEqual(companionClass.legacy_alias, 'companion_skill_sync', 'companion skill sync legacy alias');
  for (const skillId of expectedDefaultVisibleDomainSkillIds) {
    if (companionClass.members.includes(skillId)) {
      fail(`companion skill sync must not include domain plugin ${skillId}`);
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

  const bookforgeExposure = findDomainExposure(policy, 'opl-bookforge');
  const bookforgeInstallAgent = findInstallAgent(contract, 'opl-bookforge');
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

  const omaExposure = findDomainExposure(policy, 'opl-meta-agent');
  const omaInstallAgent = findInstallAgent(contract, 'opl-meta-agent');
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
validateContract(
  readJson(policyPath),
  readJson(profilePath),
  readJson(registryPath),
  readJson(agentPackageSurfaceSchemaPath),
  readJson(packageJsonPath),
  agentRoots,
);
const validatedCodexSkillsRoot = validateNoDuplicateBareDomainSkills(codexSkillsRoot);

console.log(JSON.stringify({
  status: 'passed',
  surface_id: 'opl_app_agent_installation_contract_validation',
  checked_agents: expectedRequiredAgentIds,
  plugin_agents: expectedDefaultPluginAgentIds,
  default_visible_domain_skills: expectedDefaultVisibleDomainSkillIds,
  generated_plugin_agents: expectedGeneratedAgentIds,
  generated_plugin_skills: expectedGeneratedPluginSkillIds,
  registry_packages: expectedRegistryPackageIds,
  registry_source_kinds: expectedRegistrySourceKinds,
  package_lifecycle_actions: expectedPackageLifecycleActions,
  package_lock_receipt_fields: expectedPackageLockReceiptFields,
  agent_package_surface_schema: path.relative(appRoot, agentPackageSurfaceSchemaPath),
  agent_package_manifest_fixture_dir: path.relative(appRoot, agentPackageManifestFixtureDir),
  validated_plugin_roots: Object.fromEntries(agentRoots),
  validated_codex_skills_root: validatedCodexSkillsRoot,
}, null, 2));
console.log('PASS: App agent installation contract is consistent.');

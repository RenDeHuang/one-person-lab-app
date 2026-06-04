#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

type AgentRootMap = Map<string, string>;

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const policyPath = path.join(appRoot, 'contracts', 'app-install-exposure-policy.json');
const profilePath = path.join(appRoot, 'contracts', 'app-product-profile.json');
const packageJsonPath = path.join(appRoot, 'package.json');
const expectedPluginAgentIds = ['mas', 'mag', 'rca'];
const expectedGeneratedAgentIds = ['oma'];
const expectedRequiredAgentIds = [...expectedPluginAgentIds, ...expectedGeneratedAgentIds];
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

function validatePluginRoot(agentId: string, root: string): void {
  const pluginManifestPath = path.join(root, '.codex-plugin', 'plugin.json');
  const skillPath = path.join(root, 'skills', agentId, 'SKILL.md');
  if (!fs.existsSync(pluginManifestPath)) {
    fail(`${agentId} plugin root is missing .codex-plugin/plugin.json: ${root}`);
  }
  if (!fs.existsSync(skillPath)) {
    fail(`${agentId} plugin root is missing skills/${agentId}/SKILL.md: ${root}`);
  }
  const pluginManifest = readJson(pluginManifestPath);
  assertEqual(pluginManifest.name, agentId, `${agentId} plugin manifest name`);
  assertEqual(pluginManifest.skills, './skills/', `${agentId} plugin manifest skills path`);
}

function validateNoDuplicateBareDomainSkills(root: string | null): string | null {
  if (!root) {
    return null;
  }
  if (!fs.existsSync(root)) {
    fail(`Codex skills root does not exist: ${root}`);
  }
  for (const agentId of expectedPluginAgentIds) {
    const skillPath = path.join(root, agentId, 'SKILL.md');
    if (fs.existsSync(skillPath)) {
      fail(`${agentId} must not be mirrored as a bare Codex skill at ${skillPath}`);
    }
  }
  return root;
}

function validateContract(policy: any, profile: any, packageJson: any, agentRoots: AgentRootMap): void {
  assertEqual(policy.owner, 'one-person-lab-app', 'policy.owner');
  assertEqual(policy.producer_owner, 'one-person-lab', 'policy.producer_owner');
  assertEqual(policy.public_abi?.primary_semantic_entry, 'skill', 'public ABI primary semantic entry');
  assertEqual(
    policy.public_abi?.plugin_role,
    'codex_app_distribution_and_capability_bundle',
    'public ABI plugin role',
  );
  assertEqual(policy.public_abi?.direct_skill_compatibility_required, true, 'direct skill compatibility');
  assertEqual(policy.public_abi?.plugin_must_not_create_second_semantics, true, 'plugin second semantics guard');
  assertEqual(
    policy.public_abi?.app_must_not_mirror_plugin_skill_as_duplicate_bare_skill,
    true,
    'duplicate bare skill guard',
  );
  assertEqual(
    packageJson.scripts?.['validate:agent-installation'],
    'node --experimental-strip-types scripts/validate-agent-installation-contract.ts',
    'package validate:agent-installation script',
  );

  const contract = policy.agent_installation_contract;
  if (!contract) {
    fail('missing agent_installation_contract');
  }
  assertEqual(contract.owner, 'one-person-lab-app', 'agent contract owner');
  assertEqual(contract.producer_owner, 'one-person-lab', 'agent contract producer owner');
  assertEqual(contract.unified_sync_command, 'opl skill sync', 'agent contract unified sync command');
  assertEqual(contract.managed_install_source, 'opl_managed_modules', 'agent contract managed source');
  assertEqual(
    contract.user_agent_installation_mode,
    'consume_shared_skill_action_stage_metadata',
    'agent contract user installation mode',
  );
  assertEqual(contract.codex_plugin_registry_target, 'codex_plugin_registry', 'plugin registry target');
  assertEqual(contract.direct_skill_target, 'codex_user_skill_discovery_path', 'direct skill target');
  assertEqual(contract.product_entry_target, 'family-product-entry-manifest-v2', 'product entry target');
  assertArrayEqual(contract.required_agent_ids, expectedRequiredAgentIds, 'required agent ids');
  assertArrayEqual(contract.default_plugin_agent_ids, expectedPluginAgentIds, 'default plugin agent ids');
  assertArrayEqual(contract.generated_skill_agent_ids, expectedGeneratedAgentIds, 'generated skill agent ids');
  assertArrayEqual(contract.fail_closed_states, expectedFailClosedStates, 'agent contract fail closed states');
  assertArrayEqual(policy.sync_and_install_contract?.fail_closed_states, expectedFailClosedStates, 'sync fail closed states');
  assertArrayEqual(contract.fail_closed_states, policy.sync_and_install_contract.fail_closed_states, 'shared fail closed states');
  assertEqual(contract.may_use_developer_checkout_by_default, false, 'developer checkout default policy');
  assertEqual(contract.developer_checkout_override_policy, 'explicit_opt_in_only', 'developer checkout override policy');
  assertEqual(
    contract.developer_checkout_override_surface,
    'Developer Profile source_channel capability',
    'developer checkout override surface',
  );
  assertEqual(contract.ordinary_user_module_source, 'app_cli_managed_stable_package_channel', 'ordinary user module source');
  assertArrayEqual(contract.module_package_channel_agent_ids, expectedRequiredAgentIds, 'module package channel agent ids');
  assertEqual(contract.managed_agent_pack_distribution?.channel_id, 'opl_distribution_cohort', 'agent-pack distribution channel');
  assertEqual(
    contract.managed_agent_pack_distribution?.default_transport,
    'app_cli_managed_background_maintenance',
    'agent-pack distribution default transport',
  );
  assertArrayEqual(
    contract.managed_agent_pack_distribution?.package_agent_ids,
    expectedRequiredAgentIds,
    'agent-pack distribution package agent ids',
  );
  assertArrayEqual(
    contract.managed_agent_pack_distribution?.activation_commands,
    ['opl module reconcile', 'opl skill sync'],
    'agent-pack distribution activation commands',
  );
  assertEqual(
    contract.managed_agent_pack_distribution?.homebrew_distribution_allowed,
    false,
    'agent-pack Homebrew distribution guard',
  );
  assertEqual(
    contract.managed_agent_pack_distribution?.homebrew_formula_allowed,
    false,
    'agent-pack Homebrew formula guard',
  );
  assertArrayEqual(
    contract.managed_agent_pack_distribution?.forbidden_homebrew_formulae,
    ['one-person-lab-modules', 'one-person-lab-modules-nightly'],
    'agent-pack forbidden Homebrew formulae',
  );
  assertEqual(
    contract.managed_agent_pack_distribution?.must_not_write_user_codex_state,
    true,
    'agent-pack distribution user state guard',
  );
  assertEqual(
    contract.managed_agent_pack_distribution?.must_not_define_agent_semantics,
    true,
    'agent-pack distribution semantic authority guard',
  );
  assertEqual(
    contract.managed_agent_pack_distribution?.cohort_manifest_required,
    true,
    'agent-pack distribution cohort manifest requirement',
  );
  assertEqual(contract.duplicate_bare_skill_policy, 'forbid_domain_plugin_skill_mirrors', 'duplicate bare skill policy');
  assertEqual(
    contract.plugin_registration_validation_command,
    'npm run validate:agent-installation',
    'agent validation command',
  );
  assertEqual(
    contract.plugin_registration_validation_inputs?.plugin_root_flag,
    '--agent-root <agent_id>=<path>',
    'agent validation plugin root flag',
  );
  assertEqual(
    contract.plugin_registration_validation_inputs?.codex_skills_root_flag,
    '--codex-skills-root <path>',
    'agent validation Codex skills root flag',
  );
  assertEqual(
    contract.plugin_registration_validation_inputs?.default_live_codex_skills_root,
    '~/.codex/skills',
    'agent validation default Codex skills root',
  );
  assertArrayEqual(
    contract.plugin_registration_validation_inputs?.validated_output_fields,
    ['validated_plugin_roots', 'validated_codex_skills_root'],
    'agent validation output fields',
  );

  const domainPluginClass = findExposureClass(policy, 'family_domain_plugin_surfaces');
  assertArrayEqual(domainPluginClass.members, expectedPluginAgentIds, 'domain plugin exposure members');
  assertEqual(domainPluginClass.sync_target, contract.codex_plugin_registry_target, 'domain plugin sync target');
  assertArrayEqual(domainPluginClass.must_not_sync_to, [
    '~/.codex/skills/mas',
    '~/.codex/skills/mag',
    '~/.codex/skills/rca',
  ], 'domain plugin forbidden sync targets');

  const generatedClass = findExposureClass(policy, 'opl_generated_skill_surfaces');
  assertArrayEqual(generatedClass.members, ['opl-meta-agent'], 'generated skill exposure members');
  assertEqual(generatedClass.sync_target, 'opl_generated_codex_surface', 'generated skill sync target');

  const companionClass = findExposureClass(policy, 'companion_skill_sync');
  assertArrayEqual(companionClass.members, expectedCompanionSkillSyncIds, 'companion skill sync members');
  for (const agentId of expectedPluginAgentIds) {
    if (companionClass.members.includes(agentId)) {
      fail(`companion skill sync must not include domain plugin ${agentId}`);
    }
  }

  assertArrayEqual(profile.companion_payloads?.domain_plugin_skill_ids, expectedPluginAgentIds, 'profile domain plugin ids');
  assertArrayEqual(
    profile.companion_payloads?.companion_skill_sync_default_ids,
    expectedCompanionSkillSyncIds,
    'profile companion skill sync ids',
  );
  assertEqual(
    profile.companion_payloads?.domain_plugin_skills_must_not_be_companion_mirrors,
    true,
    'profile domain plugin mirror guard',
  );
  assertIncludesAll(
    profile.companion_payloads?.default_packaged_codex_skill_ids,
    expectedPluginAgentIds,
    'profile default packaged skill ids',
  );
  assertIncludesAll(
    profile.companion_payloads?.packaged_not_default_visible_codex_skill_ids,
    ['opl-meta-agent'],
    'profile explicit packaged skill ids',
  );

  for (const agentId of expectedPluginAgentIds) {
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

  const omaExposure = findDomainExposure(policy, 'oma');
  const omaInstallAgent = findInstallAgent(contract, 'oma');
  assertEqual(omaExposure.preferred_app_distribution, 'opl_generated_skill_surface', 'OMA exposure distribution');
  assertEqual(omaInstallAgent.plugin_registry_required, false, 'OMA plugin registry policy');
  assertEqual(omaInstallAgent.plugin_must_package_skill, false, 'OMA plugin packaging policy');
  assertEqual(omaInstallAgent.codex_visible_entry, 'opl-meta-agent', 'OMA Codex visible entry');
  assertEqual(
    omaInstallAgent.canonical_metadata_source,
    'opl_generated_interface_contract_pack',
    'OMA canonical metadata source',
  );

  for (const [agentId, root] of agentRoots.entries()) {
    if (!expectedPluginAgentIds.includes(agentId)) {
      fail(`--agent-root is only valid for plugin-packaged agents, got ${agentId}`);
    }
    validatePluginRoot(agentId, root);
  }
}

const { agentRoots, codexSkillsRoot } = parseArgs(process.argv.slice(2));
validateContract(readJson(policyPath), readJson(profilePath), readJson(packageJsonPath), agentRoots);
const validatedCodexSkillsRoot = validateNoDuplicateBareDomainSkills(codexSkillsRoot);

console.log(JSON.stringify({
  status: 'passed',
  surface_id: 'opl_app_agent_installation_contract_validation',
  checked_agents: expectedRequiredAgentIds,
  plugin_agents: expectedPluginAgentIds,
  generated_skill_agents: expectedGeneratedAgentIds,
  validated_plugin_roots: Object.fromEntries(agentRoots),
  validated_codex_skills_root: validatedCodexSkillsRoot,
}, null, 2));
console.log('PASS: App agent installation contract is consistent.');

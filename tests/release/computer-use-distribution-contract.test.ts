import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const appRoot = path.resolve(import.meta.dirname, '../..');
const readJson = (relativePath: string) =>
  JSON.parse(fs.readFileSync(path.join(appRoot, relativePath), 'utf8'));

const gui = readJson('contracts/app-gui-product-contract.json');
const release = readJson('contracts/app-release-channel.json');
const qualification = readJson('contracts/app-first-run-test-matrix.json');
const identityManifest = readJson('contracts/app-release-qualification-input-manifest.json');
const fullManifest = readJson('contracts/app-full-third-party-source-manifest.json');
const profile = readJson('contracts/app-product-profile.json');
const settings = readJson('contracts/app-settings-control-plane.json');
const exposure = readJson('contracts/app-install-exposure-policy.json');

const identity = identityManifest.runtime_payloads.kimi_cu;
const provider = gui.computer_use_policy.desktop_provider;
const distribution = release.computer_use_distribution;

test('Computer Use has one pinned KimiCU identity across all App contracts', () => {
  assert.deepEqual(
    {
      provider_id: identity.provider_id,
      version: identity.version,
      archive_url: identity.archive_url,
      archive_sha256: identity.archive_sha256,
      bundle_id: identity.bundle.bundle_id,
      team_id: identity.bundle.team_id,
      target_install_path: identity.bundle.target_install_path,
      executable: identity.bundle.executable,
      mcp_args: identity.mcp.args,
      required_tools: identity.mcp.required_tools,
    },
    {
      provider_id: 'kimi-cu',
      version: '0.5.4',
      archive_url: 'https://cdn.kimi.com/kimi-computer-use/0.5.4/KimiCU.app.zip',
      archive_sha256: '77a7515cf7fd4b7bfa46a95eab0dff7378d00a2c5003bcf7ad93f17667e2808e',
      bundle_id: 'ai.kimi.cu',
      team_id: '2J9472RW75',
      target_install_path: '/Applications/KimiCU.app',
      executable: '/Applications/KimiCU.app/Contents/MacOS/kimi-cu',
      mcp_args: ['mcp'],
      required_tools: [
        'list_apps',
        'get_app_state',
        'click',
        'type_text',
        'press_key',
        'scroll',
        'set_value',
        'perform_secondary_action',
        'select_text',
        'drag',
      ],
    },
  );

  assert.equal(provider.provider_id, identity.provider_id);
  assert.equal(provider.provider_identity_ref, 'contracts/app-release-qualification-input-manifest.json#runtime_payloads.kimi_cu');
  assert.equal(provider.mcp_command, identity.bundle.executable);
  assert.deepEqual(provider.mcp_args, identity.mcp.args);
  assert.equal(distribution.provider_id, identity.provider_id);
  assert.equal(distribution.qualification_identity_ref, provider.provider_identity_ref);
  assert.equal(qualification.computer_use_qualification.provider_id, identity.provider_id);
  assert.equal(profile.computer_use.desktop_default_provider, identity.provider_id);
  assert.equal(settings.managed_computer_use.provider_identity_ref, provider.provider_identity_ref);
});

test('Standard and Full use different materialization sources but the same installed behavior', () => {
  assert.equal(distribution.standard.source, 'pinned_vendor_archive_download');
  assert.equal(distribution.standard.network_required_for_first_materialization, true);
  assert.equal(distribution.full.source, 'bundled_exact_vendor_archive_seed');
  assert.equal(distribution.full.network_required_for_first_materialization, false);
  assert.equal(distribution.standard.target_path, identity.bundle.target_install_path);
  assert.equal(distribution.full.target_path, identity.bundle.target_install_path);

  for (const field of [
    'same_version',
    'same_archive_sha256',
    'same_bundle_id',
    'same_signing_team_id',
    'same_target_path',
    'same_mcp_command_and_args',
    'same_default_enabled_state',
    'same_required_tool_set',
    'same_permission_and_health_readback',
  ]) {
    assert.equal(distribution.post_install_parity[field], true, field);
  }
  assert.equal(distribution.post_install_parity.full_second_manifest_or_provider_allowed, false);

  assert.equal(profile.computer_use.distribution_forms.standard.offline_seed, false);
  assert.equal(profile.computer_use.distribution_forms.full.offline_seed, true);
  assert.equal(profile.computer_use.distribution_forms.same_installed_identity_and_behavior_required, true);
  assert.equal(profile.computer_use.distribution_forms.full_additional_provider_or_behavior_allowed, false);

  assert.equal(fullManifest.runtime_payloads.kimi_cu.materialization_role, 'full_offline_seed_only');
  assert.equal(fullManifest.authority_boundary.kimi_cu_is_the_same_managed_dependency_as_standard, true);
  assert.equal(fullManifest.authority_boundary.kimi_cu_full_seed_may_define_second_provider_or_behavior, false);
  assert.equal(fullManifest.runtime_payloads.kimi_cu.version, identity.version);
  assert.equal(fullManifest.runtime_payloads.kimi_cu.archive_sha256, identity.archive_sha256);
});

test('Computer Use is default-on without fabricating macOS TCC permission', () => {
  assert.equal(provider.default_install, true);
  assert.equal(provider.default_register, true);
  assert.equal(provider.default_enabled, true);
  assert.equal(distribution.default_install, true);
  assert.equal(distribution.default_register, true);
  assert.equal(distribution.default_enabled, true);
  assert.equal(settings.managed_computer_use.default_install, true);
  assert.equal(settings.managed_computer_use.default_enabled, true);

  assert.deepEqual(provider.permission_model.permission_missing_state, {
    installed: true,
    registered: true,
    enabled: true,
    permission: 'required',
    ready: false,
  });
  assert.deepEqual(provider.permission_model.permission_granted_state, {
    installed: true,
    registered: true,
    enabled: true,
    permission: 'granted',
    ready: true,
  });
  assert.equal(provider.permission_model.permission_can_be_bypassed_or_fabricated, false);
  assert.equal(qualification.computer_use_qualification.computer_use_missing_permission_blocks_app_or_plain_codex_use, false);
  assert.equal(settings.managed_computer_use.manual_and_third_party_mutation_rule_applies, false);
  assert.equal(
    exposure.capability_governance.mcp_policy.default_desktop_computer_use_provider_ref,
    'contracts/app-release-qualification-input-manifest.json#runtime_payloads.kimi_cu',
  );
  assert.equal(exposure.capability_governance.mcp_policy.managed_companion_is_not_manual_third_party, true);
});

test('Computer Use product qualification is deterministic while AI UI review remains exploratory', () => {
  const aiPolicy = release.release_acceleration.ai_exploratory_policy;
  assert.equal(aiPolicy.computer_use_product_capability, 'default_managed_and_release_qualified');
  assert.equal(aiPolicy.computer_use_as_ai_release_reviewer, 'non_blocking_exploratory_only');
  assert.match(
    aiPolicy.rule,
    /installation, registration, enablement, MCP handshake, tools, permissions state, and health are deterministic/,
  );
  assert.equal(distribution.release_qualification.both_require_mcp_initialize_and_tools_list, true);
  assert.equal(distribution.release_qualification.permission_prompt_completion_may_be_manual, true);
});

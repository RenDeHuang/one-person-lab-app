import { spawnSync } from 'node:child_process';
import { assertDeepEqualJson } from '../assertions.ts';

const REQUIRED_TEAM_PROBE_IDS = [
  'team_mode_disabled',
  'team_route_redirect',
  'team_sidebar_gate',
  'team_created_redirect_noop',
  'ordinary_conversation_team_snapshot_scrub',
  'agent_switching_drops_team_mcp',
  'team_deep_link_not_whitelisted',
  'team_bridge_mutation_gate',
];

export function defaultIsGitAncestor(ref, shellRoot) {
  const result = spawnSync('git', ['merge-base', '--is-ancestor', ref, 'HEAD'], {
    cwd: shellRoot,
    encoding: 'utf8',
    stdio: 'pipe',
  });
  if (result.error) throw result.error;
  if (result.status === 0) return true;
  if (result.status === 1) return false;
  const detail = (result.stderr || result.stdout || '').trim();
  throw new Error(`Unable to verify active shell ancestor ${ref}: ${detail || `git exited ${result.status}`}`);
}

export function validateActiveShellAncestry(upstreamIntake, records, shellRoot, isGitAncestor) {
  const refs = [{
    label: 'selective absorption',
    ref: upstreamIntake.source_refs.selective_absorption_head.ref,
  }];
  for (const record of records) {
    if (record.remediation_ref) refs.push({ label: 'remediation', ref: record.remediation_ref });
  }

  const checked = new Set();
  for (const entry of refs) {
    if (checked.has(entry.ref)) continue;
    checked.add(entry.ref);
    if (!isGitAncestor(entry.ref, shellRoot)) {
      throw new Error(`active shell HEAD must contain ${entry.label} ref ${entry.ref}`);
    }
  }
}

export function validateRejectedBoundaries(contract, capabilityById) {
  const nonZhEnLocales = capabilityById.get('non_zh_en_locales');
  if (
    nonZhEnLocales.classification !== 'rejected' ||
    nonZhEnLocales.release_gate !== 'non_zh_en_locale_payload_must_remain_absent'
  ) {
    throw new Error('Active shell upstream intake must keep non-Chinese/English locale payloads rejected');
  }

  const teamIntake = capabilityById.get('aionui_team');
  if (
    teamIntake.classification !== 'rejected' ||
    teamIntake.ordinary_surface !== 'forbidden' ||
    teamIntake.owner_ref !== 'contracts/app-gui-product-contract.json#settings_navigation.team_surface_policy' ||
    teamIntake.release_gate !== 'implementation_probes.aionui_team_disabled_surface'
  ) {
    throw new Error('Active shell upstream intake must classify AionUI Team as rejected for ordinary surfaces');
  }
  const teamPolicy = contract.disabled_feature_policy?.aionui_team;
  for (const [field, expected] of Object.entries({
    state: 'disabled',
    ordinary_surface: 'rejected',
    route_policy: 'redirect_to_app_home',
    mutation_policy: 'team_created_redirect_noop',
    deep_link_policy: 'not_whitelisted',
    capability_snapshot_policy: 'scrub_before_render_or_inherit',
    agent_switching_policy: 'must_not_inherit_team_mcp',
  })) {
    if (teamPolicy?.[field] !== expected) {
      throw new Error(`Active shell disabled_feature_policy.aionui_team.${field} must be ${expected}`);
    }
  }
  const probeGroup = contract.implementation_probes?.aionui_team_disabled_surface;
  if (
    probeGroup?.source !== 'app_shell_upgrade_architecture_hardening' ||
    probeGroup?.policy !== 'fail_closed_required_for_active_shell_upgrade'
  ) {
    throw new Error('Active shell AionUI Team implementation probes must be fail-closed upgrade probes');
  }
  assertDeepEqualJson(
    (probeGroup.probes ?? []).map((probe) => probe.id),
    REQUIRED_TEAM_PROBE_IDS,
    'Active shell AionUI Team implementation probe ids',
  );
  for (const probe of probeGroup.probes ?? []) {
    if (
      probe.source_ref !== 'contracts/app-gui-product-contract.json#settings_navigation.team_surface_policy' ||
      probe.required !== true ||
      !Array.isArray(probe.required_evidence) ||
      probe.required_evidence.length === 0
    ) {
      throw new Error(`Active shell implementation probe ${probe.id} must bind required evidence to the App GUI Team policy`);
    }
  }
}

import { assertDeepEqualJson } from './assertions.ts';

export function validateUpstreamIntakePolicy(contract) {
  const upstreamIntake = contract.upstream_intake;
  if (upstreamIntake?.classification_policy !== 'classify_each_upstream_feature_before_app_release') {
    throw new Error('Active shell upstream_intake.classification_policy must classify every upstream feature before release');
  }
  assertDeepEqualJson(
    upstreamIntake.allowed_classifications,
    ['accepted', 'rejected', 'redirected', 'requires_app_contract'],
    'Active shell upstream intake classifications',
  );
  assertDeepEqualJson(
    upstreamIntake.required_feature_record_fields,
    ['id', 'upstream_surface', 'classification', 'app_contract_ref', 'release_gate'],
    'Active shell upstream intake required record fields',
  );
  const teamIntake = (upstreamIntake.feature_classifications ?? []).find((entry) => entry.id === 'aionui_team');
  if (
    teamIntake?.classification !== 'rejected' ||
    teamIntake?.ordinary_surface !== 'forbidden' ||
    teamIntake?.app_contract_ref !== 'contracts/app-gui-product-contract.json#settings_navigation.team_surface_policy' ||
    teamIntake?.release_gate !== 'implementation_probes.aionui_team_disabled_surface'
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
    [
      'team_mode_disabled',
      'team_route_redirect',
      'team_sidebar_gate',
      'team_created_redirect_noop',
      'ordinary_conversation_team_snapshot_scrub',
      'agent_switching_drops_team_mcp',
      'team_deep_link_not_whitelisted',
      'team_bridge_mutation_gate',
    ],
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

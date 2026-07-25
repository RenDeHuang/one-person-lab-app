const TEAM_ID_PATTERN = /^[A-Z0-9]{10}$/;
const SHA256_PATTERN = /^[0-9a-f]{64}$/;

export function assertAppleNotarizationReceipt(receipt: any, name = 'Apple notarization receipt') {
  if (
    receipt?.schema !== 'opl_apple_notarized_dmg_receipt.v1'
    || receipt?.status !== 'passed'
    || !TEAM_ID_PATTERN.test(receipt?.team_identifier ?? '')
    || receipt?.notarization?.status !== 'Accepted'
    || typeof receipt?.notarization?.id !== 'string'
    || !receipt.notarization.id
    || receipt?.stapler_validate_status !== 'passed'
    || receipt?.dmg_spctl_status !== 'passed'
    || receipt?.app_spctl_status !== 'passed'
    || !SHA256_PATTERN.test(receipt?.final_stapled_dmg_sha256 ?? '')
    || !Number.isInteger(receipt?.final_stapled_dmg_size_bytes)
    || receipt.final_stapled_dmg_size_bytes <= 0
  ) {
    throw new Error(`${name} must bind accepted Apple notarization, stapler validation, Gatekeeper, and final DMG bytes.`);
  }
  return receipt;
}

export function assertGatekeeperLaunchPolicy(policy: any, packageKind: string, name = 'Gatekeeper launch policy') {
  if (
    policy?.schema !== 'opl_gatekeeper_launch_policy.v1'
    || policy?.package_kind !== packageKind
    || policy?.distribution_mode !== 'developer_id_notarized'
    || !TEAM_ID_PATTERN.test(policy?.team_identifier ?? '')
    || policy?.codesign_status !== 'passed'
    || policy?.spctl_status !== 'passed'
    || policy?.dmg_codesign_status !== 'passed'
    || policy?.dmg_spctl_status !== 'passed'
    || policy?.stapler_validate_status !== 'passed'
    || policy?.notarization_status !== 'Accepted'
    || !SHA256_PATTERN.test(policy?.notarization_receipt_sha256 ?? '')
    || policy?.local_authorization_required !== false
    || policy?.quarantine_removal_required !== false
  ) {
    throw new Error(`${name} must declare Developer ID signing, accepted notarization, stapling, and Gatekeeper without local authorization.`);
  }
  if (packageKind === 'app_full_first_install' && policy?.runtime_native_trust_status !== 'passed') {
    throw new Error(`${name} must record passed Full runtime native trust.`);
  }
  return policy;
}

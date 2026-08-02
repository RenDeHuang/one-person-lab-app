export type MacosCodeSignatureKind = 'developer_id_application' | 'adhoc' | 'other' | 'missing';

export type MacosCodeSignatureDetails = {
  team_identifier: string | null;
  signature: string | null;
  signature_kind: MacosCodeSignatureKind;
  authorities: string[];
};

export function parseMacosCodeSignatureOutput(output: string): MacosCodeSignatureDetails {
  const authorities = [...output.matchAll(/^Authority=(.+)$/gm)]
    .map((match) => match[1].trim())
    .filter(Boolean);
  const explicitSignature = output.match(/^Signature=(.+)$/m)?.[1]?.trim() || null;
  const signature = explicitSignature || authorities[0] || null;
  const signatureKind: MacosCodeSignatureKind = signature === 'adhoc'
    ? 'adhoc'
    : authorities.some((authority) => authority.startsWith('Developer ID Application:'))
      || signature?.startsWith('Developer ID Application:')
      ? 'developer_id_application'
      : signature
        ? 'other'
        : 'missing';

  return {
    team_identifier: output.match(/^TeamIdentifier=(.+)$/m)?.[1]?.trim() || null,
    signature,
    signature_kind: signatureKind,
    authorities,
  };
}

export function isDeveloperIdApplicationSignature(
  details: Pick<MacosCodeSignatureDetails, 'team_identifier' | 'signature' | 'signature_kind'>,
  expectedTeamIdentifier = '',
): boolean {
  return details.signature_kind === 'developer_id_application'
    && Boolean(details.signature)
    && details.signature !== 'adhoc'
    && Boolean(details.team_identifier)
    && (!expectedTeamIdentifier || details.team_identifier === expectedTeamIdentifier);
}

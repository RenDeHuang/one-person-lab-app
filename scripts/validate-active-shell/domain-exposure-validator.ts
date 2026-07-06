export function expectedDomainExposureEntryMap(domainExposure, expectedDomainExposure, missingMessage) {
  const exposureById = new Map((domainExposure ?? []).map((entry) => [entry.domain_id, entry]));
  if (!Array.isArray(expectedDomainExposure) || expectedDomainExposure.length === 0) {
    throw new Error('Expected domain exposure entries must be a non-empty array');
  }
  return expectedDomainExposure.map((expected) => {
    const entry = exposureById.get(expected.domain_id);
    if (!entry) {
      throw new Error(missingMessage(expected.domain_id));
    }
    return { expected, entry };
  });
}

export function expectedDomainExposureFromProductProfile(productProfile) {
  const shortcutsByPackageId = new Map(
    (productProfile.gui?.home?.home_agent_shortcuts ?? []).map((shortcut) => [shortcut.package_id, shortcut]),
  );
  return (productProfile.companion_payloads?.domain_exposure ?? []).map((entry) => {
    const shortcut = shortcutsByPackageId.get(entry.domain_id);
    return {
      ...entry,
      home_purpose_entry: shortcut?.default_visible === true ? shortcut.shortcut_id : null,
      default_home_visible: shortcut?.default_visible === true,
    };
  });
}

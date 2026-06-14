import { domainExposureEntries } from './app-contract-constants.ts';

export function expectedDomainExposureEntryMap(domainExposure, missingMessage) {
  const exposureById = new Map((domainExposure ?? []).map((entry) => [entry.domain_id, entry]));
  return domainExposureEntries.map((expected) => {
    const entry = exposureById.get(expected.domain_id);
    if (!entry) {
      throw new Error(missingMessage(expected.domain_id));
    }
    return { expected, entry };
  });
}

import type { ShellCandidate } from './types.ts';
import type { CandidateValidationPolicy } from './candidate-contract-parts/host-and-bridge.ts';
import {
  candidateValidationPolicyFromRegistry,
  readCandidateAdapterContract,
  validateCandidateAdapterContract,
  validateCandidateRegistryEntry,
  validateNativeP1BaselineBridge,
  validateNativeThreadAdapterBoundary,
} from './candidate-contract-parts/host-and-bridge.ts';
import {
  appProductProfile,
  validateCandidateAuthorityBoundaries,
  validateCandidateFrameworkSurfaces,
  validateCandidateMinimumAcceptance,
  validateCandidatePackageScriptSurfaces,
  validateCandidateSeriesDisplayContract,
  validateCandidateStateModelCommand,
  validateCandidateTargetProductShape,
  validateCandidateValidationCommands,
  validateMinimumCompleteProductContract,
} from './candidate-contract-parts/product-and-acceptance.ts';
import {
  requiredDSHSourceReuseSurfaces,
  validateCandidateCarrierEvidenceContract,
  validateCandidateImplementationBasis,
  validateCandidateImplementationFiles,
  validateOPLStudioCandidateContract,
} from './candidate-contract-parts/source-and-implementation.ts';
import { validateCandidateChatTarget, validateCandidateWebUiTransport } from './candidate-contract-parts/transport.ts';

export { requiredDSHSourceReuseSurfaces };
export { validateMinimumCompleteProductContract };
export type { CandidateValidationPolicy };
export { candidateValidationPolicyFromRegistry };
export { validateNativeThreadAdapterBoundary, validateNativeP1BaselineBridge };
export { validateCandidateCarrierEvidenceContract };

export function validateCandidate(candidate: ShellCandidate, policy: CandidateValidationPolicy): void {
  validateCandidateRegistryEntry(candidate, policy);
  if (candidate.id !== policy.onlyForegroundAlternative) {
    throw new Error(`${candidate.id} detailed candidate entry must be the explicit foreground alternative`);
  }
  const adapterContract = readCandidateAdapterContract(candidate);
  validateCandidateAdapterContract(candidate, adapterContract, policy);
  validateCandidateImplementationBasis(candidate);
  validateCandidateCarrierEvidenceContract(candidate);
  validateOPLStudioCandidateContract(candidate);
  validateCandidateChatTarget(candidate);
  validateCandidateWebUiTransport(candidate);
  validateCandidateTargetProductShape(candidate);
  validateCandidateMinimumAcceptance(candidate);
  validateCandidateFrameworkSurfaces(candidate);
  validateCandidateStateModelCommand(candidate);
  validateCandidateSeriesDisplayContract(candidate);
  validateCandidateAuthorityBoundaries(candidate);
  validateCandidateValidationCommands(candidate);
  validateCandidatePackageScriptSurfaces(candidate);
}

export { validateCandidateImplementationFiles };

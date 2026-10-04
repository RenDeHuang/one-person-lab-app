import {
  assertCanonicalThreadAffinityConvergenceSources,
  assertCanonicalThreadDirectoryGroupingSources,
  assertCanonicalThreadDirectoryTimeoutBoundarySources,
} from './shell-ordinary-experience-validator-parts/conversation-thread.ts';
import {
  assertCurrentGuidHomeSelectionSources,
  assertProjectlessGuidFileAccessSources,
  validateGuidAgentSelection,
  validateGuidAssistantsAndSkills,
  validateGuidHomeImplementation,
} from './shell-ordinary-experience-validator-parts/guid-selection.ts';
import {
  validateCodexConversationImplementation,
  validateComposerCapabilityPaletteImplementation,
  validateExistingConversationAgentRebindRemoval,
  validateProductProfileDefaults,
  validateStaticAuthorityConsumerRemoval,
} from './shell-ordinary-experience-validator-parts/model-composer.ts';
import {
  validateReadOnlySessionEnvironmentImplementation,
  validateSessionFirstDirectoryImplementation,
} from './shell-ordinary-experience-validator-parts/directory.ts';
import {
  assertRuntimePageSourceBoundary,
  validateRuntimePageImplementation,
} from './shell-ordinary-experience-validator-parts/runtime-page.ts';
import {
  assertSkillsHubScopeSource,
  validateSkillsHubImplementation,
  validateStorageCarrierImplementation,
} from './shell-ordinary-experience-validator-parts/skills-storage.ts';
import { assertTextIncludesAll, readShellText } from './shell-implementation-helpers.ts';

export {
  assertCanonicalThreadAffinityConvergenceSources,
  assertCanonicalThreadDirectoryGroupingSources,
  assertCanonicalThreadDirectoryTimeoutBoundarySources,
  assertProjectlessGuidFileAccessSources,
  assertCurrentGuidHomeSelectionSources,
  assertRuntimePageSourceBoundary,
  validateRuntimePageImplementation,
  assertSkillsHubScopeSource,
};

export function validateShellOrdinaryExperienceImplementation(
  shellPaths,
  dshVisualSourceImplemented = false,
) {
  const guidPage = validateGuidHomeImplementation(shellPaths);
  validateGuidAgentSelection(shellPaths);
  validateProductProfileDefaults(shellPaths);
  validateStaticAuthorityConsumerRemoval(shellPaths);
  validateExistingConversationAgentRebindRemoval(shellPaths);
  validateGuidAssistantsAndSkills(shellPaths, guidPage);
  validateCodexConversationImplementation(shellPaths, dshVisualSourceImplemented);
  validateComposerCapabilityPaletteImplementation(shellPaths);
  validateSessionFirstDirectoryImplementation(shellPaths);
  assertTextIncludesAll(
    readShellText(shellPaths, 'packages/desktop/src/common/types/opl/uiContributions.ts'),
    [
      'const bindingIdentities = bindings.map(',
      '`${binding.providerId}:${binding.accountId}:${binding.channelSessionId}`',
      'if (new Set(bindingIdentities).size !== bindingIdentities.length) return unavailableTransportBindingsProjection()',
    ],
    'Active shell Framework transport binding projection reader',
  );
  validateReadOnlySessionEnvironmentImplementation(shellPaths);
  validateRuntimePageImplementation(shellPaths);
  validateSkillsHubImplementation(shellPaths);
  validateStorageCarrierImplementation(shellPaths);
}

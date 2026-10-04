import { existsSync } from 'node:fs';
import path from 'node:path';
import {
  assertTextExcludesAll,
  assertTextIncludesAll,
  readShellText,
} from '../shell-implementation-helpers.ts';

export function validateStaticAuthorityConsumerRemoval(shellPaths) {
  const profileLoader = readShellText(
    shellPaths,
    'packages/desktop/src/common/config/oplProductProfile/index.ts',
  );
  assertTextIncludesAll(
    profileLoader,
    [
      "authority: 'owner_or_carrier_skill_projection_and_mcp_negative_filter'",
      "conversation_loaded_skill_display_policy: 'preserve_owner_or_carrier_projected_loaded_skills'",
      'getOplNewConversationAdditionalInstructionsPolicy',
      "value.content_owner !== 'user'",
      "value.empty_value_policy !== 'inject_nothing'",
      'return names.flatMap((name) =>',
      'return skills.flatMap((skill) =>',
    ],
    'Active shell Product Profile dynamic Skill and user-instruction consumers',
  );
  assertTextExcludesAll(
    profileLoader,
    [
      'readProfessionalAgentPackages',
      'readDefaultHomeAssistants',
      'readNonDefaultAssistants',
      'readHomePurposeEntries',
      'getOplProfessionalAgentPackage',
      'getOplProfessionalAgentPackages',
      'getOplDefaultHomeAssistants',
      'getOplDefaultCodexSkills',
      'getOplSkillPriority',
      'getOplAppSessionContextPolicy',
      'getOplCodexSessionContextForLocale',
      'getOplDefaultPackagedCodexSkills',
      'getOplPackagedCodexSkills',
      "const forbidden = new Set(OPL_PRODUCT_PROFILE.gui.ordinary_capability_selector_policy.forbidden_skill_examples)",
    ],
    'Active shell retired static Product Profile consumers',
  );

  const conversationParams = readShellText(
    shellPaths,
    'packages/desktop/src/common/utils/buildAgentConversationParams.ts',
  );
  assertTextIncludesAll(
    conversationParams,
    [
      'mergeNewConversationInstructions',
      "configService.get('codex.oplAppSessionContextAdditional')?.trim()",
      'if (presetContext) extra.preset_context = presetContext',
      'if (additionalInstructions)',
    ],
    'Active shell optional user-authored new-conversation instructions',
  );
  assertTextExcludesAll(
    conversationParams,
    [
      'getOplAppSessionContextPolicy',
      'getOplCodexSessionContextForLocale',
      'resolveEffectiveOplAppSessionContext',
      'opl_app_session_context',
      'appState',
      '## Additional User Instructions',
      '## 用户附加说明',
    ],
    'Active shell generated session-context fallback and diagnostics',
  );

  const ipcBridge = readShellText(shellPaths, 'packages/desktop/src/common/adapter/ipcBridge.ts');
  assertTextExcludesAll(
    ipcBridge,
    ['opl_app_session_context'],
    'Active shell retired session-context diagnostics IPC type',
  );

  const personalization = readShellText(
    shellPaths,
    'packages/desktop/src/renderer/components/settings/SettingsModal/contents/SystemModalContent/OplPersonalizationSettings.tsx',
  );
  assertTextIncludesAll(
    personalization,
    [
      "id='additional-instructions'",
      "data-testid='settings-additional-instructions-editor'",
      "configService.set('codex.oplAppSessionContextAdditional', additionalContextDraft)",
      "configService.set('codex.oplAppSessionContextAdditional', '')",
    ],
    'Active shell user-authored additional-instructions settings surface',
  );
  assertTextExcludesAll(
    personalization,
    [
      'resolveEffectiveOplAppSessionContext',
      'generatedContext',
      'settings-generated-context-action',
      'settings-generated-context-preview',
      'agent_packages',
    ],
    'Active shell generated Agent guidance preview and route fallback',
  );
}
export function validateExistingConversationAgentRebindRemoval(shellPaths) {
  for (const retiredPath of [
    'packages/desktop/src/renderer/pages/conversation/components/ConversationAgentRebindControl.tsx',
    'tests/unit/conversation/ConversationAgentRebindControl.dom.test.tsx',
  ]) {
    if (existsSync(path.join(shellPaths.shellRoot, retiredPath))) {
      throw new Error(`Active shell must remove private existing-conversation Agent rebind surface ${retiredPath}`);
    }
  }

  for (const [sourcePath, forbidden] of [
    [
      'packages/desktop/src/common/adapter/ipcBridge.ts',
      ['rebindAssistant', '/assistant/rebind', 'IRebindConversationAssistantParams'],
    ],
    [
      'packages/desktop/src/common/config/storage.ts',
      ['TConversationAssistantIdentity', 'assistant?: TConversationAssistantIdentity'],
    ],
    [
      'packages/desktop/src/common/config/oplProductProfile/index.ts',
      ['existing_conversation_rebinding_contract', 'aioncore_atomic_conversation_owner_rebind_api', 'REQUIRED_AGENT_REBIND'],
    ],
    ['packages/desktop/src/renderer/hooks/agent/usePresetAssistantInfo.ts', ['conversation.assistant']],
    [
      'packages/desktop/src/renderer/pages/conversation/components/ChatConversation.tsx',
      ['ConversationAgentRebindControl'],
    ],
    ['tests/unit/common-adapter/ipcBridgeAgents.test.ts', ['rebindAssistant', '/assistant/rebind']],
  ] as const) {
    assertTextExcludesAll(
      readShellText(shellPaths, sourcePath),
      forbidden,
      `Active shell private existing-conversation Agent rebind removal in ${sourcePath}`,
    );
  }
}

import {
  assertShellTextIncludesAll,
  assertTextExcludesAll,
  assertTextIncludesAll,
  readShellText,
} from '../shell-implementation-helpers.ts';

export function validateSkillsHubImplementation(shellPaths) {
  const skillsHubPath = 'packages/desktop/src/renderer/pages/settings/SkillsHubSettings.tsx';
  const skillsHub = readShellText(shellPaths, skillsHubPath);
  assertSkillsHubScopeSource(skillsHub, skillsHubPath);
  assertTextExcludesAll(
    skillsHub,
    [
      'getOplDefaultPackagedCodexSkills',
      'getOplPackagedCodexSkills',
      'appVisibleSkills',
      'appPackagedSkills',
    ],
    'Active shell SkillsHubSettings retired App-packaged Skill allowlist',
  );
}

export function assertSkillsHubScopeSource(
  skillsHub: string,
  skillsHubPath = 'SkillsHubSettings.tsx',
): void {
  assertTextIncludesAll(
    skillsHub,
    [
      'const skills = await ipcBridge.fs.listAvailableSkills.invoke()',
      'setAvailableSkills(skills)',
      "flowManagedSkillIds === undefined ? 'my-skills-section' : 'manual-and-third-party-capabilities'",
      "t('settings.skillsHub.mySkillsTitle', { defaultValue: 'Global User Skills' })",
      "t('settings.skillsHub.globalUserSkillsPath'",
    ],
    `Active shell SkillsHubSettings owner and carrier Skill projection in ${skillsHubPath}`,
  );
  assertTextExcludesAll(
    skillsHub,
    [
      'ipcBridge.fs.listBuiltinAutoSkills.invoke()',
      'setBuiltinAutoSkills(',
      'builtinAutoSkills',
      "data-testid='auto-skills-section'",
      'auto-injected-skills',
    ],
    `Active shell SkillsHubSettings upstream auto-injected Skill scope in ${skillsHubPath}`,
  );
}

export function validateStorageCarrierImplementation(shellPaths) {
  assertShellTextIncludesAll(
    shellPaths,
    'packages/desktop/src/renderer/pages/settings/StorageSettings/index.tsx',
    [
      "import { isElectronDesktop } from '@/renderer/utils/platform'",
      'const desktopCarrier = isElectronDesktop()',
      'const ownerInventoryRefresh = Promise.allSettled',
      'if (!desktopCarrier)',
      'desktopCarrier &&',
    ],
    'Active shell Storage carrier split',
  );
  assertShellTextIncludesAll(
    shellPaths,
    'tests/unit/settings/StorageSettings.dom.test.tsx',
    [
      'keeps the WebUI Storage core route fail-open without invoking desktop local lifecycle',
      'expect(bridgeMocks.getInventorySnapshot).not.toHaveBeenCalled()',
      'expect(bridgeMocks.refreshInventory).not.toHaveBeenCalled()',
    ],
    'Active shell WebUI Storage carrier regression',
  );
  assertShellTextIncludesAll(
    shellPaths,
    'packages/web-host/src/static-server.unit.test.ts',
    ["'/settings/storage'", 'SPA fallback: %s returns index.html'],
    'Active shell Web host Storage core-route regression',
  );
}

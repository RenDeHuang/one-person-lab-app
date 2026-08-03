import {
  assert,
  fs,
  test,
  validateAppGuiProductContract,
  validatePrimaryInteractionPages,
  validateProductProfile,
  assertCanonicalThreadDirectoryGroupingSources,
  assertCanonicalThreadDirectoryTimeoutBoundarySources,
  assertCanonicalThreadAffinityConvergenceSources,
  assertCurrentGuidHomeSelectionSources,
  assertProjectlessGuidFileAccessSources,
  assertRuntimePageSourceBoundary,
  assertSkillsHubScopeSource,
  validateShellVisualTokenBindings,
  assertCodexModelPolicyProjection,
  projectCodexModelPolicyContracts,
  readJson,
  readModelPolicyBundle,
} from "./fixtures.ts";

test('active-shell source gate requires Home starters and Capabilities routing instead of retired selectors', () => {
  const currentSources = {
    guidPage: [
      'HomeStarters',
      'activeCapabilityId={activeShortcut?.package_id}',
      'activeShortcutId={activeShortcut?.shortcut_id}',
      "const { appState } = useOplAppState('fast')",
      'handleSelectShortcut(assistantId)',
      'onSelect={(assistantId) =>',
      'onClear={() =>',
      'sameActiveShortcut',
      'setActiveShortcut((current) => {',
      'const next = resolveOplActiveShortcut(navState.selectedCapabilityId, appState)',
      'return sameActiveShortcut(current, next) ? current : next',
      'agentSelection.setSelectedAgentKey(agentSelection.defaultAgentKey)',
    ].join('\n'),
    guidInputCard: [
      'const DESKTOP_TEXTAREA_AUTO_SIZE = { minRows: 1, maxRows: 12 };',
      '${styles.guidInputInner} opl-codex-composer',
      "isInputActive ? 'opl-codex-composer--focused' : ''",
      "fileDraggingActive ? 'opl-codex-composer--dragging' : ''",
      "data-composer-palette-boundary='true'",
      'activeBorderColor',
      'inactiveBorderColor',
      '!pl-5px',
    ].join('\n'),
    homeStarters: [
      "data-testid='opl-home-starters'",
      'assistant.opl_package_id === activeCapabilityId && assistant.opl_shortcut_id === activeShortcutId',
      'aria-pressed={active}',
      'data-opl-active={String(active)}',
      'resolveOplPackageLaunchGate(appState, assistant.opl_package_id)',
      "const launchReady = launchGate.state !== 'package_unavailable'",
      'data-opl-launch-ready={String(launchReady)}',
      'active && styles.homeStarterActive',
      'starterIcon()',
      'active && onClear ? onClear() : onSelect(assistant.opl_shortcut_id)',
    ].join('\n'),
    guidStyles: [
      '.guidComposerDock',
      'width: min(100%, 736px);',
      '.guidInputInner',
      'min-height: 98px;',
      'border-radius: 22px;',
      '.actionRow',
      'align-items: center;',
      'width: 100%;',
      '.workspaceContextBar',
      'height: 52px;',
      'margin: 0 12px -13px;',
      'padding: 0 12px;',
      '.homeStarterGrid',
      'display: flex;',
      'flex-wrap: wrap;',
      'justify-content: center;',
      'width: auto !important;',
      'height: 34px !important;',
    ].join('\n'),
    capabilitiesPage: [
      'useCustomAgentsLoader',
      "navigate('/guid', {",
      'state: { selectedCapabilityId: capability.id }',
    ].join('\n'),
  };
  assert.doesNotThrow(() => assertCurrentGuidHomeSelectionSources(currentSources));
  for (const [current, legacy] of [
    [
      [
        'setActiveShortcut((current) => {',
        'const next = resolveOplActiveShortcut(navState.selectedCapabilityId, appState)',
        'return sameActiveShortcut(current, next) ? current : next',
      ].join('\n'),
      'setActiveShortcut(resolveOplActiveShortcut(navState.selectedCapabilityId, appState))',
    ],
    ['activeShortcutId={activeShortcut?.shortcut_id}', 'activeShortcutId={activeShortcut?.package_id}'],
    ["const { appState } = useOplAppState('fast')", 'const appState = undefined'],
  ]) {
    assert.throws(() =>
      assertCurrentGuidHomeSelectionSources({
        ...currentSources,
        guidPage: currentSources.guidPage.replace(current, legacy),
      }),
    );
  }
  for (const [current, legacy] of [
    [
      'assistant.opl_package_id === activeCapabilityId && assistant.opl_shortcut_id === activeShortcutId',
      'assistant.id === activeCapabilityId',
    ],
    ['resolveOplPackageLaunchGate(appState, assistant.opl_package_id)', 'resolveOplPackageLaunchGate(appState, assistant.id)'],
    ['starterIcon()', 'starterIcon(assistant.opl_package_id)'],
    ['starterIcon()', 'starterIcon(assistant.id)'],
    [
      'active && onClear ? onClear() : onSelect(assistant.opl_shortcut_id)',
      'active && onClear ? onClear() : onSelect(assistant.id)',
    ],
  ]) {
    assert.throws(() =>
      assertCurrentGuidHomeSelectionSources({
        ...currentSources,
        homeStarters: currentSources.homeStarters.replace(current, legacy),
      }),
    );
  }
  assert.throws(() =>
    assertCurrentGuidHomeSelectionSources({
      ...currentSources,
      guidStyles: currentSources.guidStyles.replace('align-items: center;', 'align-items: flex-end;'),
    }),
    /must include align-items: center/,
  );
  assert.throws(() =>
    assertCurrentGuidHomeSelectionSources({
      ...currentSources,
      guidPage: `${currentSources.guidPage}\nAssistantSelectionArea\nMentionSelectorBadge`,
    }),
  );
  assert.throws(() =>
    assertCurrentGuidHomeSelectionSources({
      ...currentSources,
      homeStarters: `${currentSources.homeStarters}\n<CheckOne theme='outline' />`,
    }),
  );
  assert.throws(
    () =>
      assertCurrentGuidHomeSelectionSources({
        ...currentSources,
        homeStarters: currentSources.homeStarters.replace(
          'active && styles.homeStarterActive',
          "active ? '!border-primary-5 !bg-primary-1 !text-primary-6' : ''",
        ),
      }),
    /must include active && styles\.homeStarterActive/,
  );
  assert.throws(() =>
    assertCurrentGuidHomeSelectionSources({
      ...currentSources,
      homeStarters: `${currentSources.homeStarters}\nfaChevronRight`,
    }),
  );
  assert.throws(() =>
    assertCurrentGuidHomeSelectionSources({
      ...currentSources,
      guidStyles: `${currentSources.guidStyles}\ngrid-template-columns: repeat(4, minmax(0, 1fr));`,
    }),
  );
  assert.throws(() =>
    assertCurrentGuidHomeSelectionSources({
      ...currentSources,
      guidStyles: currentSources.guidStyles.replace('width: min(100%, 736px);', 'width: min(100%, 680px);'),
    }),
  );
  assert.throws(() =>
    assertCurrentGuidHomeSelectionSources({
      ...currentSources,
      guidInputCard: 'const DESKTOP_TEXTAREA_AUTO_SIZE = { minRows: 2, maxRows: 20 };',
    }),
  );
  for (const marker of [
    '${styles.guidInputInner} opl-codex-composer',
    "isInputActive ? 'opl-codex-composer--focused' : ''",
    "fileDraggingActive ? 'opl-codex-composer--dragging' : ''",
    "data-composer-palette-boundary='true'",
  ]) {
    assert.throws(
      () =>
        assertCurrentGuidHomeSelectionSources({
          ...currentSources,
          guidInputCard: currentSources.guidInputCard.replace(marker, ''),
        }),
      new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
    );
  }
});

test('active-shell source gate preserves explicit local file inputs independently of workspace readiness', () => {
  const currentSource = [
    'const workspaceAccessBlocked = coreReadiness.known && !coreReadiness.workspaceRootReady;',
    'workspaceAccessDisabled={workspaceAccessBlocked}',
    'const guidInput = useGuidInput({',
    'locationState: navState',
    'onFilesUploaded={guidInput.handleFilesUploaded}',
    'onPaste={guidInput.onPaste}',
    'dragHandlers={guidInput.dragHandlers}',
    "name: 'open'",
  ].join('\n');

  assert.doesNotThrow(() => assertProjectlessGuidFileAccessSources(currentSource));
  for (const legacyWorkspaceGate of [
    'fileContextEnabled={!fileAccessBlocked && Boolean(guidInput.dir)}',
    'fileAccessDisabled={fileAccessBlocked || !guidInput.dir}',
    'fileAccessEnabled={!fileAccessBlocked && Boolean(guidInput.dir)}',
    'const fileAccessBlocked = coreReadiness.known && !coreReadiness.workspaceRootReady;',
    'fileAccessDisabled={coreReadiness.known && !coreReadiness.workspaceRootReady}',
    'fileAccessEnabled={!coreReadiness.known || coreReadiness.workspaceRootReady}',
    'fileAccessEnabled: !workspaceAccessBlocked',
    'fileAccessDisabled={workspaceAccessBlocked}',
    'fileAccessEnabled={!workspaceAccessBlocked}',
    [
      'const hasWorkspace = Boolean(guidInput.dir);',
      'const canUseFiles = hasWorkspace;',
      'fileAccessEnabled={canUseFiles}',
    ].join('\n'),
  ]) {
    assert.throws(() => assertProjectlessGuidFileAccessSources(`${currentSource}\n${legacyWorkspaceGate}`));
  }
});

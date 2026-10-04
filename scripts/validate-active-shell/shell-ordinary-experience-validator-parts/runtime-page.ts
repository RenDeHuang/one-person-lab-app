import {
  assertShellTextIncludesAll,
  assertTextExcludesAll,
  assertTextIncludesAll,
  readShellText,
} from '../shell-implementation-helpers.ts';

const runtimePageExpected = [
  "const appStateQuery = useOplAppState('fast')",
  'readRuntimeWorkItemProjectionV2(appStateQuery.appState)',
  'const [selectedAgentId, setSelectedAgentId]',
  'const [selectedProjectId, setSelectedProjectId]',
  'const [selectedStatusView, setSelectedStatusView]',
  'projection.projects.filter((project) => project.agentId === selectedAgentId)',
  'scopedVisibleItems.filter((item) => matchesStatusView(item, selectedStatusView))',
  'i18n.resolvedLanguage ?? i18n.language',
  '<RuntimeScopeBar',
  '<RuntimeStatusBar',
  '<RuntimeWorkItemList',
  '<RuntimeDetailDrawer',
  "data-testid='runtime-v2-page'",
];

const runtimeProjectionExpected = [
  'workbench?.work_item_projection_v2',
  'const itemEnvelopeId = requiredString(value.item_id)',
  'const workItemId = requiredString(identity.work_item_id)',
  'const projectedPrimaryStatus = enumValue(lifecycle.primary_state, PRIMARY_STATUSES)',
  'const stageMap = parseStageMap(value.stage_map)',
  'const projectedAction = parseAction(value.action)',
  'const currentStageId = optionalString(execution.current_stage_id) ?? optionalString(lifecycle.current_stage_id)',
  'const nextStageId = optionalString(execution.next_stage_id)',
  'const attemptId = optionalString(execution.attempt_id)',
  'attemptId,',
  'id: itemEnvelopeId',
];

const runtimeStagePopoverExpected = [
  "data-testid='runtime-stage-popover'",
  "data-testid='runtime-stage-attempt'",
  "data-testid='runtime-stage-trigger'",
  'item.execution.attemptId',
  'item.stageMap.map',
  'event.stopPropagation()',
];

const runtimeFocusedTestsExpected = [
  'keeps platform maintenance actions and operator drilldown out of the project Runtime page',
  'opens a stage popup with the complete stage list and current attempt',
  'shows all nine visible items and keeps repeated work item ids distinct by canonical item id',
  'rejects an item envelope that does not match its canonical identity',
  'preserves projected stages and actions for the detail view',
  'never promotes a telemetry verification attempt to the business stage of a delivered item',
];

const runtimePageForbidden = [
  'normalizeRuntimeProjection',
  'dedupeTaskItems',
  'runtimeTaskItem(',
  'appStateToRuntimeProjection(',
  'compactCurrentControlState(',
  'controlStateFallbackForTask(',
  'record(controlState?.provider_run)',
  'getDrilldown.invoke',
  'RuntimeCockpitPanel',
  'AgentAvailability',
];

export function assertRuntimePageSourceBoundary(runtimePage: string): void {
  assertTextExcludesAll(runtimePage, runtimePageForbidden, 'Active shell Runtime page provider/run fallbacks');
}

export function validateRuntimePageImplementation(shellPaths) {
  const primaryNav = assertShellTextIncludesAll(
    shellPaths,
    'packages/desktop/src/renderer/components/layout/Sider/SiderNav/SiderPrimaryNav.tsx',
    ["key: 'runtime'", "t('common.runtime.sidebarEntry')", "active: pathname.startsWith('/runtime')"],
    'Active AionUI primary navigation Runtime status entry',
  );
  const runtimeIndex = primaryNav.indexOf("key: 'runtime'");
  const scheduledIndex = primaryNav.indexOf("key: 'scheduled'");
  const archivedIndex = primaryNav.indexOf("key: 'archived'");
  if (!(runtimeIndex < scheduledIndex && scheduledIndex < archivedIndex)) {
    throw new Error('Active AionUI primary navigation must order Runtime before Scheduled tasks and Archived');
  }
  assertShellTextIncludesAll(
    shellPaths,
    'tests/unit/layout/SiderNavigation.dom.test.tsx',
    [
      'keeps Runtime, Scheduled, and Archived visible in the primary navigation order',
      "['New task', 'Runtime', 'Scheduled Tasks', 'Archived', 'Settings']",
      "getByRole('button', { name: 'Runtime' })",
    ],
    'Active AionUI Runtime navigation visibility and order regression',
  );
  assertShellTextIncludesAll(
    shellPaths,
    'packages/desktop/src/renderer/components/layout/Router.tsx',
    ["path='/runtime'", 'element={withRouteFallback(RuntimePage)}'],
    'Active shell cross-project Runtime page route',
  );
  const runtimePage = assertShellTextIncludesAll(
    shellPaths,
    'packages/desktop/src/renderer/pages/runtime/index.tsx',
    runtimePageExpected,
    'Active shell Runtime page user-task-first grouped display',
  );
  assertShellTextIncludesAll(
    shellPaths,
    'packages/desktop/src/renderer/pages/runtime/projection.ts',
    runtimeProjectionExpected,
    'Active shell Runtime v2 canonical work-item projection',
  );
  assertShellTextIncludesAll(
    shellPaths,
    'packages/desktop/src/renderer/pages/runtime/components/RuntimeStagePopover.tsx',
    runtimeStagePopoverExpected,
    'Active shell Runtime Stage popover',
  );
  const runtimeStatusBar = assertShellTextIncludesAll(
    shellPaths,
    'packages/desktop/src/renderer/pages/runtime/components/RuntimeStatusBar.tsx',
    [
      "data-testid='runtime-status-view-select'",
      "data-testid='runtime-open-archive'",
      '<Select',
    ],
    'Active shell Runtime compact task toolbar',
  );
  assertTextExcludesAll(
    runtimeStatusBar,
    ['runtime-status-metrics', '<Radio.Group', 'metricGrid'],
    'Active shell Runtime metric-card and duplicate-filter surfaces',
  );
  const runtimeFocusedTests = [
    readShellText(shellPaths, 'tests/unit/opl-runtime/runtime-v2/RuntimePageV2.dom.test.tsx'),
    readShellText(shellPaths, 'tests/unit/opl-runtime/runtime-v2/projection.test.ts'),
  ].join('\n');
  assertTextIncludesAll(runtimeFocusedTests, runtimeFocusedTestsExpected, 'Active shell Runtime v2 focused regressions');
  assertRuntimePageSourceBoundary(runtimePage);

  const projection = assertShellTextIncludesAll(
    shellPaths,
    'packages/desktop/src/renderer/pages/runtime/projection.ts',
    [
      'const PRIMARY_STATUSES = new Set<RuntimePrimaryStatus>',
      'enumValue(lifecycle.primary_state, PRIMARY_STATUSES)',
      "projectedPrimaryStatus ?? 'sync_pending'",
      'const projectedAction = parseAction(value.action)',
      'const stageMap = parseStageMap(value.stage_map)',
    ],
    'Active shell Runtime V2 thin projection reader',
  );
  assertTextExcludesAll(
    projection,
    ['function primaryStatus(', 'statusByBusinessState'],
    'Active shell Runtime V2 status inference',
  );

  assertShellTextIncludesAll(
    shellPaths,
    'packages/desktop/src/renderer/pages/runtime/components/RuntimeScopeBar.tsx',
    [
      "data-testid='runtime-agent-selector'",
      "data-testid='runtime-project-selector'",
      'disabled={selectedAgentId === ALL_RUNTIME_SCOPES}',
      "t('common.runtime.scope.viewing')",
    ],
    'Active shell Runtime Agent then Project scope',
  );
  const statusBar = assertShellTextIncludesAll(
    shellPaths,
    'packages/desktop/src/renderer/pages/runtime/components/RuntimeStatusBar.tsx',
    [
      "id: 'all'",
      "id: 'automatically_advancing'",
      "id: 'awaiting_user_decision'",
      "id: 'system_attention'",
      "id: 'delivered_or_paused'",
      "id: 'stopped'",
      "id: 'sync_pending'",
      "data-testid='runtime-status-view-select'",
    ],
    'Active shell Runtime seven status-only saved views',
  );
  assertTextExcludesAll(statusBar, ["id: 'mas'", "id: 'med-autoscience'"], 'Active shell Runtime agent saved views');

  assertShellTextIncludesAll(
    shellPaths,
    'packages/desktop/src/renderer/pages/runtime/components/RuntimeWorkItemList.tsx',
    [
      "data-testid='runtime-task-row'",
      "data-responsive-columns='4'",
      '<RuntimeStagePopover item={item} locale={locale} t={t} />',
      'nextStageLabel(item, locale, t)',
      "t('common.runtime.stageUsageShort')",
      "t('common.runtime.totalUsageShort')",
    ],
    'Active shell Runtime one-row work item list',
  );
  const runtimeDetailDrawer = assertShellTextIncludesAll(
    shellPaths,
    'packages/desktop/src/renderer/pages/runtime/components/RuntimeDetailDrawer.tsx',
    [
      "data-testid='runtime-stage-map'",
      'currentStageLabel(item, locale, t)',
      'nextStageLabel(item, locale, t)',
      'stageDisplayName(stage, locale)',
      'item.execution.attemptId',
      'item.execution.lastHeartbeatAt',
      'formatTokenObservation(item.stageUsage',
      'formatTokenObservation(item.taskUsage',
      "data-testid='runtime-next-action'",
      "data-testid='runtime-system-attention'",
      "data-testid={archived ? 'runtime-restore-work-item' : 'runtime-archive-work-item'}",
    ],
    'Active shell Runtime minimal selected-work-item detail',
  );
  assertTextExcludesAll(
    runtimeDetailDrawer,
    [
      'Collapse',
      "runtime-detail-disclosure",
      "name='artifacts'",
      "name='timeline'",
      "name='evidence'",
      "name='diagnostics'",
      'ConditionList',
      'SourceRefList',
    ],
    'Active shell Runtime advanced detail surfaces',
  );
  assertShellTextIncludesAll(
    shellPaths,
    'packages/desktop/src/renderer/pages/runtime/RuntimePage.module.css',
    [
      'overflow-x: hidden',
      'box-sizing: border-box',
      '@container (max-width: 720px)',
      '@container (max-width: 360px)',
      '@media (max-width: 1180px)',
      'grid-template-columns: repeat(2, minmax(0, 1fr))',
      'grid-template-columns: minmax(0, 1fr)',
    ],
    'Active shell Runtime responsive semantic reflow',
  );
  assertShellTextIncludesAll(
    shellPaths,
    'tests/e2e/runtime-v2/runtime-v2.e2e.ts',
    [
      '{ width: 1440, height: 960, columns: 4 }',
      '{ width: 1024, height: 900, columns: 2 }',
      '{ width: 768, height: 900, columns: 2 }',
      '{ width: 375, height: 812, columns: 1 }',
      'assertNoHorizontalOverflow(page)',
      'assertElementsWithinViewport(page',
      'toHaveCount(9',
      'runtime-v2-${locale.id}-${viewport.width}.png',
      'runtime-v2-${locale.id}-${viewport.width}-stage-popover.png',
      'runtime-v2-${locale.id}-action-detail.png',
      'runtime-v2-1440-stage-popover.png',
      'runtime-v2-1440-minimal-detail.png',
      "keeps task details minimal without evidence or diagnostic surfaces",
      "toHaveCount(0)",
    ],
    'Active shell Runtime deterministic viewport evidence',
  );
}

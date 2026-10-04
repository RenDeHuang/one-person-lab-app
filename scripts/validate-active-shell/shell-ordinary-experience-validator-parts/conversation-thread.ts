import ts from 'typescript';
import { assertTextExcludesAll, assertTextIncludesAll } from '../shell-implementation-helpers.ts';

export function assertCanonicalThreadAffinityConvergenceSources({
  canonicalThreadLifecycle,
  conversationListSync,
  focusedTests,
  threadAdapter,
}: {
  canonicalThreadLifecycle: string;
  conversationListSync: string;
  focusedTests: string;
  threadAdapter: string;
}): void {
  assertTextIncludesAll(
    canonicalThreadLifecycle,
    [
      'function canonicalProjectId(',
      'canonical_project_id?.trim() ??',
      '!canonicalProjectId(conversation)',
      'const explicitProjectId = thread.projectId.trim() || canonicalProjectId(cached)',
      'workspace: thread.workspace',
      'custom_workspace: Boolean(explicitProjectId)',
    ],
    'Active shell canonical thread lifecycle explicit project affinity projection',
  );
  assertTextIncludesAll(
    conversationListSync,
    [
      "const canonicalProjectId = thread.projectId.trim() || cached.extra.canonical_project_id?.trim() || ''",
      'workspace: thread.workspace',
      'custom_workspace: Boolean(canonicalProjectId)',
      'canonical_project_id: canonicalProjectId || undefined',
    ],
    'Active shell canonical directory merge explicit project affinity projection',
  );
  for (const [label, source] of [
    ['canonical thread lifecycle', canonicalThreadLifecycle],
    ['canonical directory merge', conversationListSync],
  ] as const) {
    assertTextExcludesAll(
      source,
      [
        'const hasCanonicalRecordedCwd = Boolean(thread.workspace.trim())',
        'workspace: projectAffinityWorkspace',
        'custom_workspace: customWorkspace',
        'Boolean(thread.workspace.trim())',
      ],
      `Active shell ${label} recorded cwd authority boundary`,
    );
  }
  assertTextIncludesAll(
    threadAdapter,
    [
      'function recordedCwd(value: unknown): string',
      "if (value === undefined || value === null) return ''",
      "if (typeof value !== 'string') throw new Error('Invalid Codex app-server thread cwd.')",
      'workspace: recordedCwd(raw.cwd)',
      'private readonly assignedProjectAffinities = new Map<string, string>()',
      'async assignProjectAffinity(threadId: string, projectIdValue: string)',
      'const existingProjectId = this.assignedProjectAffinities.get(threadId) ?? projectId(raw)',
      "if (existingProjectId) throw new Error('Canonical thread already has explicit project affinity.')",
      'this.assignedProjectAffinities.set(threadId, selectedProjectId)',
      'this.assignedProjectAffinities.get(threadId)',
    ],
    'Active shell canonical cwd parser and single-assignment project affinity adapter boundary',
  );
  assertTextExcludesAll(
    threadAdapter,
    ["workspace: optionalString(raw.cwd) ?? ''"],
    'Active shell canonical cwd parser must not treat malformed values as projectless',
  );
  assertTextIncludesAll(
    focusedTests,
    [
      'keeps a managed Documents Codex task projectless and ungrouped',
      'keeps an OPL channel temporary task projectless and ungrouped',
      'assigns explicit project affinity once without changing the recorded cwd',
      'rejects project affinity reassignment',
      'keeps canonical adoption successful when the rebuildable local projection update fails',
      'keeps canonical adoption successful when a stub projection cannot be materialized',
      'requires exact projectId readback instead of path-normalized equivalence',
      'keeps the conversation projectless when assignment changes canonical cwd',
      'does not change turn pwd or sandbox writable roots during adoption',
      'keeps an existing explicit affinity stable across shell cache refreshes',
      'rejects malformed canonical cwd instead of treating it as projectless',
      'rejects a malformed cwd returned by canonical thread read',
    ],
    'Active shell project affinity convergence focused regressions',
  );
}

export function assertCanonicalThreadDirectoryGroupingSources({
  focusedTests,
  groupingHelpers,
}: {
  focusedTests: string;
  groupingHelpers: string;
}): void {
  assertTextIncludesAll(
    groupingHelpers,
    [
      'const MANAGED_CODEX_SCRATCH_PATTERNS = [',
      '/^\\/Users\\/[^/]+\\/Documents\\/Codex(?:\\/|$)/i',
      '/^\\/Users\\/[^/]+\\/\\.codex\\/worktrees\\/[^/]+(?:\\/|$)/i',
      '/^\\/home\\/[^/]+\\/Documents\\/Codex(?:\\/|$)/i',
      '/^\\/home\\/[^/]+\\/\\.codex\\/worktrees\\/[^/]+(?:\\/|$)/i',
      '/^[a-z]:\\/Users\\/[^/]+\\/Documents\\/Codex(?:\\/|$)/i',
      '/^[a-z]:\\/Users\\/[^/]+\\/\\.codex\\/worktrees\\/[^/]+(?:\\/|$)/i',
      '/^\\/mnt\\/[a-z]\\/Users\\/[^/]+\\/Documents\\/Codex(?:\\/|$)/i',
      '/^\\/mnt\\/[a-z]\\/Users\\/[^/]+\\/\\.codex\\/worktrees\\/[^/]+(?:\\/|$)/i',
      "replaceAll('\\\\', '/')",
      'export const getConversationDirectoryGroup =',
      "const explicitProjectId = conversation.extra.canonical_project_id?.trim() ?? ''",
      'if (explicitProjectId) return explicitProjectId',
      'if (!workspace || isManagedCodexScratchWorkspace(workspace)) return null',
      'return workspace',
      'const projectWorkspace = getConversationDirectoryGroup(conv)',
      '(conversation.extra as { is_temporary_workspace?: boolean }).is_temporary_workspace === true',
    ],
    'Active shell canonical cwd directory grouping fallback',
  );
  assertTextExcludesAll(
    groupingHelpers,
    ['canonical_project_id: workspace', 'custom_workspace: true', 'assignProjectAffinity'],
    'Active shell canonical cwd grouping must remain a presentation-only fallback',
  );
  assertTextIncludesAll(
    focusedTests,
    [
      'projects a canonical task from explicit project affinity rather than recorded cwd',
      'auto-loads an unregistered canonical cwd as a directory group',
      'keeps a managed Documents Codex task projectless and ungrouped',
      'does not create duplicate leaf-name groups for Codex-managed worktrees',
      'keeps explicit project affinity authoritative for a Codex-managed worktree',
      'keeps an OPL channel temporary task projectless and ungrouped',
      'keeps a canonical task without cwd projectless and ungrouped',
      'keeps Linux, Windows, and WSL managed Codex scratch paths ungrouped',
      'groups a canonical recorded cwd without rebuilding project affinity',
    ],
    'Active shell canonical cwd directory grouping focused regressions',
  );
}

export function assertCanonicalThreadDirectoryTimeoutBoundarySources({
  focusedTests,
  threadAdapter,
}: {
  focusedTests: string;
  threadAdapter: string;
}): void {
  const sourceFile = ts.createSourceFile('codex-app-server-adapter.ts', threadAdapter, ts.ScriptTarget.Latest, true);
  const threadListOptions: ts.ObjectLiteralExpression[] = [];
  const staticOptionObjects = new Map<string, ts.ObjectLiteralExpression | null>();
  const collectStaticOptionObjects = (node: ts.Node): void => {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.initializer &&
      ts.isObjectLiteralExpression(node.initializer) &&
      ts.isVariableDeclarationList(node.parent) &&
      (node.parent.flags & ts.NodeFlags.Const) !== 0
    ) {
      const name = node.name.text;
      staticOptionObjects.set(name, staticOptionObjects.has(name) ? null : node.initializer);
    }
    ts.forEachChild(node, collectStaticOptionObjects);
  };
  collectStaticOptionObjects(sourceFile);
  const visit = (node: ts.Node): void => {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === 'request' &&
      ts.isStringLiteralLike(node.arguments[0]) &&
      node.arguments[0].text === 'thread/list'
    ) {
      const optionsExpression = node.arguments[1];
      const options = optionsExpression && ts.isObjectLiteralExpression(optionsExpression)
        ? optionsExpression
        : optionsExpression && ts.isIdentifier(optionsExpression)
          ? staticOptionObjects.get(optionsExpression.text)
          : undefined;
      if (!options) {
        throw new Error(
          'Active shell canonical thread directory must pass an inline or uniquely named const thread/list options object',
        );
      }
      threadListOptions.push(options);
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  if (threadListOptions.length === 0) {
    throw new Error('Active shell canonical thread directory must call thread/list');
  }
  const propertyName = (property: ts.ObjectLiteralElementLike): string | null => {
    const name = property.name;
    if (!name) return null;
    if (ts.isIdentifier(name) || ts.isStringLiteralLike(name) || ts.isNumericLiteral(name)) return name.text;
    if (ts.isComputedPropertyName(name) && ts.isStringLiteralLike(name.expression)) return name.expression.text;
    return null;
  };
  const assertNoSourceKindsExpression = (expression: ts.Expression): void => {
    if (ts.isParenthesizedExpression(expression)) {
      assertNoSourceKindsExpression(expression.expression);
      return;
    }
    if (ts.isConditionalExpression(expression)) {
      assertNoSourceKindsExpression(expression.whenTrue);
      assertNoSourceKindsExpression(expression.whenFalse);
      return;
    }
    if (!ts.isObjectLiteralExpression(expression)) {
      throw new Error(
        'Active shell canonical thread directory thread/list spreads must use statically inspectable inline objects',
      );
    }
    assertNoSourceKindsProperties(expression.properties);
  };
  const assertNoSourceKindsProperties = (
    properties: ts.NodeArray<ts.ObjectLiteralElementLike>,
    allowGuardedDirectProperties = false,
  ): void => {
    for (const property of properties) {
      if (ts.isSpreadAssignment(property)) {
        assertNoSourceKindsExpression(property.expression);
        continue;
      }
      const name = propertyName(property);
      if (name === null) {
        throw new Error(
          'Active shell canonical thread directory thread/list option names must be statically inspectable',
        );
      }
      if (name === 'sourceKinds') {
        throw new Error('Active shell canonical thread directory thread/list options must not include sourceKinds');
      }
      if (!allowGuardedDirectProperties && (name === 'archived' || name === 'useStateDbOnly')) {
        throw new Error(
          'Active shell canonical thread directory thread/list option spreads must not override archived or useStateDbOnly',
        );
      }
    }
  };
  for (const options of threadListOptions) {
    const archivedProperties = options.properties.filter((property) => propertyName(property) === 'archived');
    const stateDbOnlyProperties = options.properties.filter((property) => propertyName(property) === 'useStateDbOnly');
    if (archivedProperties.length !== 1) {
      throw new Error('Active shell canonical thread directory thread/list options must include exactly one archived selector');
    }
    if (stateDbOnlyProperties.length !== 1) {
      throw new Error('Active shell canonical thread directory thread/list options must include exactly one useStateDbOnly selector');
    }
    const archived = archivedProperties[0];
    const stateDbOnly = stateDbOnlyProperties[0];
    if (
      !ts.isShorthandPropertyAssignment(archived) &&
      (!ts.isPropertyAssignment(archived) ||
        !ts.isIdentifier(archived.initializer) ||
        archived.initializer.text !== 'archived')
    ) {
      throw new Error(
        'Active shell canonical thread directory thread/list options must use the dynamic archived selector rather than a constant',
      );
    }
    if (
      !stateDbOnly ||
      !ts.isPropertyAssignment(stateDbOnly) ||
      stateDbOnly.initializer.kind !== ts.SyntaxKind.TrueKeyword
    ) {
      throw new Error('Active shell canonical thread directory thread/list options must set useStateDbOnly to true');
    }
    assertNoSourceKindsProperties(options.properties, true);
  }
  assertTextIncludesAll(
    focusedTests,
    [
      'lists active and archived threads through bounded app-server pagination',
      'useStateDbOnly: true',
      "not.toHaveProperty('sourceKinds')",
    ],
    'Active shell canonical thread directory timeout/archive regressions',
  );
}

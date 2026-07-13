import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import {
  buildReleaseSourceGateReport,
  type CommandRunner,
  type ReleaseSourceGateOptions,
} from '../../scripts/validate-release-source-gate.ts';

const repoRoot = '/tmp/opl-app';
const shellRoot = path.join(repoRoot, 'shells', 'aionui');
const frameworkRoot = '/tmp/one-person-lab';
const repoLocalFrameworkRoot = path.join(repoRoot, 'one-person-lab');
const appHead = '0123456789abcdef0123456789abcdef01234567';
const shellHead = 'abcdef0123456789abcdef0123456789abcdef01';
const frameworkHead = '789abcdef0123456789abcdef0123456789abcde';
const managedUpdateProviders = {
  opl_base: 'runtime_substrate',
  opl_app: 'installation_carrier',
  opl_packages: 'capability_packages',
};

function readSourceJson(candidatePath: string, shellName = 'one-person-lab-aion-shell'): any {
  if (candidatePath.endsWith('package.json')) return { name: shellName };
  if (candidatePath.endsWith('app-release-channel.json')) {
    return {
      managed_update_plane: {
        software_lifecycle: {
          public_component_keys: Object.keys(managedUpdateProviders),
          objects: Object.fromEntries(Object.entries(managedUpdateProviders).map(([id, provider_id]) => [id, { provider_id }])),
        },
      },
    };
  }
  if (candidatePath.endsWith('managed-update-kernel-contract.json')) {
    return {
      providers: Object.entries(managedUpdateProviders).map(([lifecycle_owner, provider_id]) => ({
        lifecycle_owner,
        provider_id,
      })),
    };
  }
  throw new Error(`unexpected JSON path: ${candidatePath}`);
}

function options(overrides: Partial<ReleaseSourceGateOptions> = {}): ReleaseSourceGateOptions {
  return {
    version: '26.6.99',
    expectedAppHead: appHead,
    shellRef: 'main',
    frameworkRef: 'main',
    requireShellFormat: false,
    runShellTests: false,
    repoRoot,
    frameworkRoot,
    output: '',
    json: true,
    ...overrides,
  };
}

function runner(overrides: Record<string, { status: number; stdout?: string; stderr?: string }> = {}): CommandRunner {
  return (command, args, commandOptions) => {
    const key = `${commandOptions.cwd} $ ${command} ${args.join(' ')}`;
    const result = overrides[key];
    if (result) {
      return {
        status: result.status,
        stdout: result.stdout ?? '',
        stderr: result.stderr ?? '',
      };
    }
    if (command === 'git' && args.join(' ') === 'rev-parse HEAD' && commandOptions.cwd === repoRoot) {
      return { status: 0, stdout: `${appHead}\n`, stderr: '' };
    }
    if (command === 'git' && args.join(' ') === 'status --porcelain --untracked-files=normal' && commandOptions.cwd === repoRoot) {
      return { status: 0, stdout: '', stderr: '' };
    }
    if (command === 'npm' && args.join(' ') === 'run validate:release-boundary' && commandOptions.cwd === repoRoot) {
      return { status: 0, stdout: 'release boundary ok\n', stderr: '' };
    }
    if (
      command === 'git'
      && args[0] === 'rev-parse'
      && args[1] === '--verify'
      && args[2] === '--quiet'
      && commandOptions.cwd === shellRoot
    ) {
      return { status: 0, stdout: `${shellHead}\n`, stderr: '' };
    }
    if (
      command === 'git'
      && args[0] === 'rev-parse'
      && args[1] === '--verify'
      && args[2] === '--quiet'
      && commandOptions.cwd === frameworkRoot
    ) {
      return { status: 0, stdout: `${frameworkHead}\n`, stderr: '' };
    }
    if (command === 'bun' && args.join(' ') === 'run format:check' && commandOptions.cwd === shellRoot) {
      return { status: 0, stdout: 'format ok\n', stderr: '' };
    }
    if (
      command === process.execPath
      && args.join(' ') === '--experimental-strip-types scripts/run-active-shell-tests.ts --project all --chunk-size 8 --max-workers 2'
      && commandOptions.cwd === repoRoot
    ) {
      return { status: 0, stdout: 'active shell tests ok\n', stderr: '' };
    }
    return { status: 1, stdout: '', stderr: `unexpected command: ${key}` };
  };
}

function checkStatus(report: ReturnType<typeof buildReleaseSourceGateReport>, id: string) {
  const check = report.checks.find((candidate) => candidate.id === id);
  assert.ok(check, `missing check ${id}`);
  return check.status;
}

function reportFor(overrides: Partial<ReleaseSourceGateOptions> = {}) {
  return buildReleaseSourceGateReport(
    options(overrides),
    runner(),
    '2026-06-30T00:00:00.000Z',
    {
      pathExists: (candidatePath) => candidatePath === shellRoot || candidatePath === frameworkRoot,
      readJson: (candidatePath) => readSourceJson(candidatePath),
    },
  );
}

test('release source gate fails stale expected App HEAD before expensive release work', () => {
  const report = reportFor({ expectedAppHead: 'fedcba9876543210fedcba9876543210fedcba98' });

  assert.equal(report.status, 'failed');
  assert.equal(checkStatus(report, 'expected_app_head'), 'failed');
  assert.equal(checkStatus(report, 'app_worktree_clean'), 'passed');
  assert.equal(checkStatus(report, 'active_shell_ref_resolved'), 'passed');
  assert.equal(checkStatus(report, 'framework_ref_resolved'), 'passed');
});

test('release source gate passes for clean current App checkout and resolvable source refs', () => {
  const report = reportFor({ expectedAppHead: appHead.slice(0, 12), shellRef: 'main' });

  assert.equal(report.status, 'passed');
  assert.equal(report.version, '26.6.99');
  assert.equal(report.app_head, appHead);
  assert.equal(report.shell_sha, shellHead);
  assert.equal(report.framework_sha, frameworkHead);
  assert.equal(checkStatus(report, 'expected_app_head'), 'passed');
  assert.equal(checkStatus(report, 'app_worktree_clean'), 'passed');
  assert.equal(checkStatus(report, 'app_release_boundary_contract'), 'passed');
  assert.equal(checkStatus(report, 'active_shell_ref_resolved'), 'passed');
  assert.equal(checkStatus(report, 'active_shell_type'), 'passed');
  assert.equal(checkStatus(report, 'framework_ref_resolved'), 'passed');
  assert.equal(checkStatus(report, 'managed_update_provider_contract_aligned'), 'passed');
});

test('release source gate rejects managed update provider contract drift before packaging', () => {
  const report = buildReleaseSourceGateReport(
    options(),
    runner(),
    '2026-06-30T00:00:00.000Z',
    {
      pathExists: (candidatePath) => candidatePath === shellRoot || candidatePath === frameworkRoot,
      readJson: (candidatePath) => {
        const value = readSourceJson(candidatePath);
        if (candidatePath.endsWith('managed-update-kernel-contract.json')) {
          value.providers[0].provider_id = 'drifted-provider';
        }
        return value;
      },
    },
  );

  assert.equal(report.status, 'failed');
  assert.equal(checkStatus(report, 'managed_update_provider_contract_aligned'), 'failed');
});

test('release source gate emits shell format policy and executes it only when required', () => {
  const policyOnly = reportFor({ requireShellFormat: false });
  const requiredGate = policyOnly.required_gates.find((gate) => gate.id === 'active_shell_format_check');
  assert.equal(requiredGate?.required, true);
  assert.equal(requiredGate?.command, 'bun run format:check');
  assert.equal(requiredGate?.cwd, shellRoot);
  assert.equal(requiredGate?.executed, false);
  assert.equal(checkStatus(policyOnly, 'active_shell_format_check'), 'skipped');

  const executed = reportFor({ requireShellFormat: true });
  assert.equal(executed.status, 'passed');
  assert.equal(executed.required_gates.find((gate) => gate.id === 'active_shell_format_check')?.executed, true);
  assert.equal(checkStatus(executed, 'active_shell_format_check'), 'passed');
});

test('release source gate runs active shell node/dom tests before expensive release work when required', () => {
  const policyOnly = reportFor({ runShellTests: false });
  const requiredGate = policyOnly.required_gates.find((gate) => gate.id === 'active_shell_node_dom_tests');
  assert.equal(requiredGate?.required, true);
  assert.equal(
    requiredGate?.command,
    'node --experimental-strip-types scripts/run-active-shell-tests.ts --project all --chunk-size 8 --max-workers 2',
  );
  assert.equal(requiredGate?.cwd, repoRoot);
  assert.equal(requiredGate?.executed, false);
  assert.equal(checkStatus(policyOnly, 'active_shell_node_dom_tests'), 'skipped');

  const executed = reportFor({ runShellTests: true });
  assert.equal(executed.status, 'passed');
  assert.equal(executed.required_gates.find((gate) => gate.id === 'active_shell_node_dom_tests')?.executed, true);
  assert.equal(checkStatus(executed, 'active_shell_node_dom_tests'), 'passed');
});

test('release source gate fails active shell node/dom regressions before expensive release work', () => {
  const report = buildReleaseSourceGateReport(
    options({ runShellTests: true }),
    runner({
      [`${repoRoot} $ ${process.execPath} --experimental-strip-types scripts/run-active-shell-tests.ts --project all --chunk-size 8 --max-workers 2`]: {
        status: 1,
        stdout: 'dom chunk 10/12 failed\n',
        stderr: "TypeError: Cannot read properties of undefined (reading 'configureCodexInvoke')\n",
      },
    }),
    '2026-06-30T00:00:00.000Z',
    {
      pathExists: (candidatePath) => candidatePath === shellRoot || candidatePath === frameworkRoot,
      readJson: (candidatePath) => readSourceJson(candidatePath),
    },
  );

  assert.equal(report.status, 'failed');
  assert.equal(checkStatus(report, 'active_shell_node_dom_tests'), 'failed');
  assert.match(
    report.checks.find((check) => check.id === 'active_shell_node_dom_tests')?.message ?? '',
    /configureCodexInvoke/,
  );
});

test('release source gate fails dirty App worktree before expensive release work', () => {
  const report = buildReleaseSourceGateReport(
    options(),
    runner({
      [`${repoRoot} $ git status --porcelain --untracked-files=normal`]: {
        status: 0,
        stdout: ' M .github/workflows/desktop-release.yml\n?? tmp.txt\n',
      },
    }),
    '2026-06-30T00:00:00.000Z',
    {
      pathExists: (candidatePath) => candidatePath === shellRoot || candidatePath === frameworkRoot,
      readJson: (candidatePath) => readSourceJson(candidatePath),
    },
  );

  assert.equal(report.status, 'failed');
  assert.equal(checkStatus(report, 'app_worktree_clean'), 'failed');
});

test('release source gate ignores declared framework checkout inside App workspace only', () => {
  const report = buildReleaseSourceGateReport(
    options({ frameworkRoot: repoLocalFrameworkRoot }),
    runner({
      [`${repoRoot} $ git status --porcelain --untracked-files=normal`]: {
        status: 0,
        stdout: '?? one-person-lab/\n',
      },
      [`${repoLocalFrameworkRoot} $ git rev-parse --verify --quiet main^{commit}`]: {
        status: 0,
        stdout: `${frameworkHead}\n`,
      },
    }),
    '2026-06-30T00:00:00.000Z',
    {
      pathExists: (candidatePath) => candidatePath === shellRoot || candidatePath === repoLocalFrameworkRoot,
      readJson: (candidatePath) => readSourceJson(candidatePath),
    },
  );

  assert.equal(report.status, 'passed');
  assert.equal(checkStatus(report, 'app_worktree_clean'), 'passed');

  const stillDirty = buildReleaseSourceGateReport(
    options({ frameworkRoot: repoLocalFrameworkRoot }),
    runner({
      [`${repoRoot} $ git status --porcelain --untracked-files=normal`]: {
        status: 0,
        stdout: '?? one-person-lab/\n M .github/workflows/desktop-release.yml\n',
      },
      [`${repoLocalFrameworkRoot} $ git rev-parse --verify --quiet main^{commit}`]: {
        status: 0,
        stdout: `${frameworkHead}\n`,
      },
    }),
    '2026-06-30T00:00:00.000Z',
    {
      pathExists: (candidatePath) => candidatePath === shellRoot || candidatePath === repoLocalFrameworkRoot,
      readJson: (candidatePath) => readSourceJson(candidatePath),
    },
  );

  assert.equal(stillDirty.status, 'failed');
  assert.equal(checkStatus(stillDirty, 'app_worktree_clean'), 'failed');
  assert.match(stillDirty.checks.find((check) => check.id === 'app_worktree_clean')?.actual ?? '', /desktop-release/);

  const similarlyNamedUntracked = buildReleaseSourceGateReport(
    options({ frameworkRoot: repoLocalFrameworkRoot }),
    runner({
      [`${repoRoot} $ git status --porcelain --untracked-files=normal`]: {
        status: 0,
        stdout: '?? one-person-lab/\n?? one-person-lab-extra/\n',
      },
      [`${repoLocalFrameworkRoot} $ git rev-parse --verify --quiet main^{commit}`]: {
        status: 0,
        stdout: `${frameworkHead}\n`,
      },
    }),
    '2026-06-30T00:00:00.000Z',
    {
      pathExists: (candidatePath) => candidatePath === shellRoot || candidatePath === repoLocalFrameworkRoot,
      readJson: (candidatePath) => readSourceJson(candidatePath),
    },
  );

  assert.equal(similarlyNamedUntracked.status, 'failed');
  assert.equal(checkStatus(similarlyNamedUntracked, 'app_worktree_clean'), 'failed');
  assert.match(
    similarlyNamedUntracked.checks.find((check) => check.id === 'app_worktree_clean')?.actual ?? '',
    /one-person-lab-extra/,
  );
});

test('release source gate fails unresolved framework ref and wrong shell type', () => {
  const report = buildReleaseSourceGateReport(
    options({ frameworkRef: 'missing-framework-ref' }),
    runner({
      [`${frameworkRoot} $ git rev-parse --verify --quiet missing-framework-ref^{commit}`]: { status: 1 },
      [`${frameworkRoot} $ git rev-parse --verify --quiet refs/heads/missing-framework-ref^{commit}`]: { status: 1 },
      [`${frameworkRoot} $ git rev-parse --verify --quiet refs/remotes/origin/missing-framework-ref^{commit}`]: { status: 1 },
      [`${frameworkRoot} $ git rev-parse --verify --quiet refs/tags/missing-framework-ref^{commit}`]: { status: 1 },
    }),
    '2026-06-30T00:00:00.000Z',
    {
      pathExists: (candidatePath) => candidatePath === shellRoot || candidatePath === frameworkRoot,
      readJson: (candidatePath) => readSourceJson(candidatePath, 'unexpected-shell'),
    },
  );

  assert.equal(report.status, 'failed');
  assert.equal(checkStatus(report, 'active_shell_type'), 'failed');
  assert.equal(checkStatus(report, 'framework_ref_resolved'), 'failed');
});

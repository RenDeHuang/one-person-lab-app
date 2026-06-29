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
const appHead = '0123456789abcdef0123456789abcdef01234567';
const shellHead = 'abcdef0123456789abcdef0123456789abcdef01';

function options(overrides: Partial<ReleaseSourceGateOptions> = {}): ReleaseSourceGateOptions {
  return {
    expectedAppHead: appHead,
    shellRef: 'main',
    requireShellFormat: false,
    repoRoot,
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
    if (
      command === 'git'
      && args[0] === 'rev-parse'
      && args[1] === '--verify'
      && args[2] === '--quiet'
      && commandOptions.cwd === shellRoot
    ) {
      return { status: 0, stdout: `${shellHead}\n`, stderr: '' };
    }
    if (command === 'bun' && args.join(' ') === 'run format:check' && commandOptions.cwd === shellRoot) {
      return { status: 0, stdout: 'format ok\n', stderr: '' };
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
    { pathExists: (candidatePath) => candidatePath === shellRoot },
  );
}

test('release source gate fails stale expected App HEAD before expensive release work', () => {
  const report = reportFor({ expectedAppHead: 'fedcba9876543210fedcba9876543210fedcba98' });

  assert.equal(report.status, 'failed');
  assert.equal(checkStatus(report, 'expected_app_head'), 'failed');
  assert.equal(checkStatus(report, 'app_worktree_clean'), 'passed');
  assert.equal(checkStatus(report, 'active_shell_ref_resolved'), 'passed');
});

test('release source gate passes for clean current App checkout and resolvable active shell ref', () => {
  const report = reportFor({ expectedAppHead: appHead.slice(0, 12), shellRef: 'main' });

  assert.equal(report.status, 'passed');
  assert.equal(report.app_head, appHead);
  assert.equal(checkStatus(report, 'expected_app_head'), 'passed');
  assert.equal(checkStatus(report, 'app_worktree_clean'), 'passed');
  assert.equal(checkStatus(report, 'active_shell_ref_resolved'), 'passed');
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

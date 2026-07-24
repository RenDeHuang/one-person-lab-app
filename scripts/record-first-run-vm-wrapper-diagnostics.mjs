import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const diagnosticsPath = 'artifacts/opl-first-run-vm/app-wrapper-diagnostics.json';
const startedAt = new Date();
const diagnosticScope = process.env.DIAGNOSTIC_SCOPE || 'release_gate';

function run(command, args = []) {
  const started = new Date();
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    timeout: 120000,
  });
  const ended = new Date();
  return {
    command: [command, ...args].join(' '),
    available: result.error?.code !== 'ENOENT',
    exit_code: typeof result.status === 'number' ? result.status : null,
    signal: result.signal || null,
    error: result.error ? String(result.error.message || result.error) : null,
    stdout: (result.stdout || '').trim(),
    stderr: (result.stderr || '').trim(),
    started_at: started.toISOString(),
    ended_at: ended.toISOString(),
    duration_ms: ended.getTime() - started.getTime(),
  };
}

const nodeVersion = run('node', ['--version']);
const npmVersion = run('npm', ['--version']);
const curlVersion = run('curl', ['--version']);
const npmRegistry = run('npm', ['config', 'get', 'registry']);

function skippedDiagnostic(label) {
  const now = new Date().toISOString();
  return {
    command: label,
    available: false,
    exit_code: 0,
    signal: null,
    error: null,
    stdout: '',
    stderr: '',
    skipped: true,
    reason: diagnosticScope,
    started_at: now,
    ended_at: now,
    duration_ms: 0,
  };
}

const codexPackagePreflight = (() => {
  const artifactPath = process.env.CODEX_PACKAGE_PREFLIGHT_JSON;
  if (!artifactPath) {
    if (diagnosticScope === 'bootstrap_only') {
      return {
        path: '',
        available: false,
        parsed: false,
        exit_code: 0,
        skipped: true,
        reason: 'bootstrap_only',
      };
    }
    return {
      path: '',
      available: false,
      parsed: false,
      exit_code: 1,
      error: 'CODEX_PACKAGE_PREFLIGHT_JSON is not configured',
    };
  }
  try {
    const available = fs.existsSync(artifactPath);
    return {
      path: artifactPath,
      available,
      parsed: true,
      exit_code: available ? 0 : 1,
      data: JSON.parse(fs.readFileSync(artifactPath, 'utf8')),
    };
  } catch (error) {
    return {
      path: artifactPath,
      available: fs.existsSync(artifactPath),
      parsed: false,
      exit_code: 1,
      error: String(error.message || error),
    };
  }
})();
const frozenCodexSpec = codexPackagePreflight.data?.package?.requested_spec || '@openai/codex@<missing-frozen-version>';
const codexPackageMetadata =
  diagnosticScope === 'bootstrap_only'
    ? skippedDiagnostic(`npm view ${frozenCodexSpec}`)
    : run('npm', [
        'view',
        frozenCodexSpec,
        'name',
        'version',
        'dist-tags',
        'dist.tarball',
        'dist.integrity',
        'bin',
        'engines',
        '--json',
      ]);

const endedAt = new Date();
const diagnostics = {
  schema_version: 1,
  owner: 'one-person-lab-app',
  purpose: 'first_run_vm_app_wrapper_diagnostics',
  generated_at: endedAt.toISOString(),
  workflow: {
    name: 'OPL GUI First-Run VM',
    job: 'clean-vm-first-run',
    run_id: process.env.GITHUB_RUN_ID || null,
    run_attempt: process.env.GITHUB_RUN_ATTEMPT || null,
    repository: process.env.GITHUB_REPOSITORY || null,
    ref: process.env.GITHUB_REF || null,
    sha: process.env.GITHUB_SHA || null,
  },
  release_inputs: {
    package_profile: process.env.PACKAGE_PROFILE,
    diagnostic_scope: diagnosticScope,
    install_mode: process.env.INSTALL_MODE,
    runtime_profile: process.env.RUNTIME_PROFILE,
    release_tag: process.env.RELEASE_TAG || '',
    release_dmg_url_configured: process.env.RELEASE_DMG_URL_CONFIGURED === 'true',
    release_artifact_name: process.env.RELEASE_ARTIFACT_NAME || '',
    release_artifact_run_id: process.env.RELEASE_ARTIFACT_RUN_ID || '',
    artifact_app_sha: process.env.ARTIFACT_APP_SHA || '',
    product_shell_ref: process.env.PRODUCT_SHELL_REF || 'main',
    product_shell_sha: process.env.PRODUCT_SHELL_SHA || '',
    smoke_harness_ref: process.env.SMOKE_HARNESS_REF || process.env.PRODUCT_SHELL_REF || 'main',
    smoke_harness_sha: process.env.SMOKE_HARNESS_SHA || '',
  },
  vm: {
    source_vm: process.env.SOURCE_VM,
    guest_user: process.env.GUEST_USER,
    ssh_key_configured: process.env.SSH_KEY_CONFIGURED === 'true',
    runner_labels: process.env.RUNNER_LABELS,
    no_graphics: process.env.NO_GRAPHICS === 'true',
    keep_vm: process.env.KEEP_VM === 'true',
    guide_screenshots: process.env.GUIDE_SCREENSHOTS === 'true',
  },
  timeouts: {
    job_timeout_minutes: 75,
    run_timeout_ms: Number(process.env.RUN_TIMEOUT_MS),
    smoke_timeout_ms: Number(process.env.SMOKE_TIMEOUT_MS),
    codex_install_phase_timeout_ms: Number(process.env.CODEX_INSTALL_PHASE_TIMEOUT_MS),
    codex_readiness_phase_timeout_ms: Number(process.env.CODEX_READINESS_PHASE_TIMEOUT_MS),
    codex_phase_timeout_interface: 'opl_aion_shell_phase_options',
  },
  host: {
    node: nodeVersion,
    npm: npmVersion,
    curl: curlVersion,
    npm_registry: npmRegistry,
    codex_package_preflight: codexPackagePreflight,
    codex_package_metadata: codexPackageMetadata,
  },
  artifact_paths: {
    diagnostics: 'app-wrapper-diagnostics.json',
    preflight_log: 'app-wrapper-preflight.log',
    codex_package_preflight: 'codex-package-preflight.json',
    codex_package_registry_response: 'codex-package-registry-response.json',
    codex_package_tarball: 'codex-package-tarballs/openai-codex.tgz',
    codex_platform_package_tarball: 'codex-package-tarballs/openai-codex-darwin-arm64.tgz',
    codex_npm_cache_dir: 'codex-npm-cache',
    smoke_command_preview: 'app-wrapper-smoke-command-preview.txt',
    smoke_stdout: 'app-wrapper-smoke.stdout.log',
    smoke_stderr: 'app-wrapper-smoke.stderr.log',
    tart_smoke_summary: 'tart-smoke-summary.json',
  },
  phase_timings: {
    app_wrapper_preflight: {
      started_at: startedAt.toISOString(),
      ended_at: endedAt.toISOString(),
      duration_ms: endedAt.getTime() - startedAt.getTime(),
    },
  },
  codex_install: {
    current_app_scope: 'required_from_tart_smoke_summary_or_shell_companion_diagnostics',
    shell_interface_status: 'implemented_opl_aion_shell_phase_options',
    install_asset_preseed: {
      preflight_json: process.env.CODEX_PACKAGE_PREFLIGHT_JSON,
      tarball_path: process.env.CODEX_PACKAGE_TARBALL,
      platform_tarball_path: process.env.CODEX_PLATFORM_PACKAGE_TARBALL,
      npm_cache_dir: process.env.CODEX_NPM_CACHE_DIR,
      truth_boundary: 'install_asset_cache_preseed_not_app_readiness_truth_or_owner_receipt',
    },
    required_fields: ['command_preview', 'stdout', 'stderr', 'exit_code', 'phase_timings'],
  },
};

fs.writeFileSync(diagnosticsPath, `${JSON.stringify(diagnostics, null, 2)}\n`);
console.log(
  JSON.stringify(
    {
      diagnostics: diagnosticsPath,
      npm_registry_exit_code: npmRegistry.exit_code,
      codex_package_metadata_exit_code: codexPackageMetadata.exit_code,
    },
    null,
    2
  )
);

const requiredFailures = [
  ['node --version', nodeVersion],
  ['npm --version', npmVersion],
  ['curl --version', curlVersion],
  ['npm config get registry', npmRegistry],
  ['codex-package-preflight.json', codexPackagePreflight],
  [`npm view ${frozenCodexSpec}`, codexPackageMetadata],
].filter(
  ([, result]) =>
    result.skipped !== true &&
    (result.exit_code !== 0 || result.error || result.parsed === false || result.available === false)
);

if (requiredFailures.length > 0) {
  console.error('Required first-run VM wrapper diagnostics failed:');
  for (const [label, result] of requiredFailures) {
    console.error(`- ${label}: exit=${result.exit_code} error=${result.error || ''}`);
  }
  process.exit(1);
}

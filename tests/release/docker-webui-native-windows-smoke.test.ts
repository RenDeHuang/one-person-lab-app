import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { parse as parseYaml } from 'yaml';
import {
  buildComposeYaml,
  cleanupEvidence,
  commandRunner,
  parseImmutableImageRef,
  probeWebui,
  renderWindowsUi,
  validateNativeWindowsSmokeReceipt,
  verifyPriorExactPullEvidence,
} from '../../scripts/docker-webui-native-windows-smoke.ts';

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const cliPath = path.join(appRoot, 'scripts', 'docker-webui-native-windows-smoke.ts');
const digest = `sha256:${'a'.repeat(64)}`;
const imageRef = `ghcr.io/gaofeng21cn/one-person-lab-webui@${digest}`;
const labels = {
  'org.opencontainers.image.source': 'https://github.com/gaofeng21cn/one-person-lab-app',
  'org.opencontainers.image.revision': '1'.repeat(40),
  'org.opencontainers.image.version': '26.7.25-r1',
  'dev.onepersonlab.release.bundle-digest': `sha256:${'b'.repeat(64)}`,
  'dev.onepersonlab.release.cohort-ref': `sha256:${'c'.repeat(64)}`,
  'dev.onepersonlab.release.shell-revision': '2'.repeat(40),
  'dev.onepersonlab.release.framework-revision': '3'.repeat(40),
};

function passedProbe(url: string) {
  return { status: 'passed', url, http_status: 200, content_type: 'application/json' };
}

function receipt() {
  return {
    schema: 'opl_app_webui_native_windows_smoke_receipt.v1',
    status: 'passed',
    run_id: 'native-test-abcdef',
    observed_at: '2026-07-25T03:00:00.000Z',
    lane: 'windows_wsl2_native_post_public_smoke',
    publication: {
      source_run_id: '30150000001',
      version: labels['org.opencontainers.image.version'],
      app_sha: labels['org.opencontainers.image.revision'],
      shell_sha: labels['dev.onepersonlab.release.shell-revision'],
      framework_sha: labels['dev.onepersonlab.release.framework-revision'],
      bundle_digest: labels['dev.onepersonlab.release.bundle-digest'],
      cohort_ref: labels['dev.onepersonlab.release.cohort-ref'],
      label_parity: 'passed',
    },
    image: {
      requested_ref: imageRef,
      repository: 'ghcr.io/gaofeng21cn/one-person-lab-webui',
      digest,
      image_id: `sha256:${'d'.repeat(64)}`,
      repo_digests: [imageRef],
      os: 'linux',
      architecture: 'amd64',
      labels: { ...labels },
    },
    host: { platform: 'windows_wsl2', wsl2: {}, docker: {}, storage: {} },
    runtime: {
      container_name: 'opl-native-test-webui',
      container_id: 'container-id',
      container_image_id: `sha256:${'d'.repeat(64)}`,
      container_labels: {
        ...labels,
        'dev.onepersonlab.validation.owner': 'native-windows-smoke',
        'dev.onepersonlab.validation.run-id': 'native-test-abcdef',
      },
      internal_network: true,
      internal_network_name: 'opl-native-test_native-smoke-internal',
      network_names: ['opl-native-test_native-smoke-internal'],
      ingress: {
        container_name: 'opl-native-test-webui-ingress',
        container_id: 'ingress-container-id',
        container_image_id: `sha256:${'d'.repeat(64)}`,
        container_labels: {
          ...labels,
          'dev.onepersonlab.validation.owner': 'native-windows-smoke',
          'dev.onepersonlab.validation.run-id': 'native-test-abcdef',
          'dev.onepersonlab.validation.role': 'ingress',
        },
        same_exact_image: true,
        read_only: true,
        host_volumes: 0,
        tmpfs_mounts: 3,
        non_root: true,
        fixed_node_tcp_proxy: true,
        cap_drop_all: true,
        no_new_privileges: true,
        proxy_environment_cleared: true,
        network_names: [
          'opl-native-test_native-smoke-ingress',
          'opl-native-test_native-smoke-internal',
        ],
      },
    },
    http: {
      root: passedProbe('http://127.0.0.1:33173/'),
      webmanifest: passedProbe('http://127.0.0.1:33173/manifest.webmanifest'),
      assets: [passedProbe('http://127.0.0.1:33173/assets/index.js')],
      login_session: {
        ...passedProbe('http://127.0.0.1:33173/api/auth/user'),
        session_cookie_observed: true,
        json_object: true,
      },
    },
    ui: {
      status: 'passed',
      browser: 'windows_chrome_headless',
      url: 'http://127.0.0.1:33173/',
      root_hydrated: true,
      visible_text_chars: 120,
      screenshot: {
        path: 'windows-ui.png',
        bytes: 2048,
        sha256: `sha256:${'e'.repeat(64)}`,
      },
    },
    persistence: { status: 'passed', data_marker: 'preserved', projects_marker: 'preserved', recreate_count: 1 },
    no_secondary_fetch: {
      status: 'passed',
      isolated_empty_docker_config: true,
      compose_pull_policy: 'never',
      compose_up_pull_mode: 'never',
      internal_network: true,
      image_pull_events_after_initial_pull: 0,
      ingress_uses_same_exact_image: true,
      webui_only_internal_network: true,
      pull_provenance: {
        mode: 'performed_in_this_run',
        exact_pull_ref: imageRef,
        exact_pull_count_total: 1,
        evidence_path: 'command-index.json',
        evidence_sha256: `sha256:${'f'.repeat(64)}`,
      },
    },
    cleanup: { status: 'passed', owned_containers_remaining: 0, owned_networks_remaining: 0, runtime_directory_remaining: false },
    bounded_execution: { pull_timeout_seconds: 1800, command_timeout_seconds: 60, health_timeout_seconds: 300, cleanup_always_runs: true },
    failure: null,
  };
}

test('Native Windows smoke accepts only the exact WebUI namespace and immutable digest', () => {
  assert.deepEqual(parseImmutableImageRef(imageRef), {
    repository: 'ghcr.io/gaofeng21cn/one-person-lab-webui',
    digest,
    requestedRef: imageRef,
  });
  for (const invalid of [
    'ghcr.io/gaofeng21cn/one-person-lab-webui:stable',
    'ghcr.io/gaofeng21cn/one-person-lab-webui:latest',
    `ghcr.io/other/one-person-lab-webui@${digest}`,
    'ghcr.io/gaofeng21cn/one-person-lab-webui@sha256:unknown',
  ]) assert.throws(() => parseImmutableImageRef(invalid), /must be .*@sha256/);
});

test('Native Windows compose pins the digest, disables pulls, uses both binds, and blocks outbound fetches', () => {
  const compose = buildComposeYaml({
    imageRef,
    containerName: 'opl-native-test-webui',
    dataDir: '/tmp/native/data',
    projectsDir: '/tmp/native/projects',
    port: 33173,
    runId: 'native-test-abcdef',
  });
  const parsed = parseYaml(compose);
  assert.deepEqual(Object.keys(parsed.services), ['webui', 'ingress']);
  assert.deepEqual(parsed.services.webui.networks, ['native-smoke-internal']);
  assert.equal(parsed.services.webui.ports, undefined);
  assert.equal(parsed.services.webui.image, imageRef);
  assert.equal(parsed.services.webui.pull_policy, 'never');
  assert.deepEqual(parsed.services.ingress.networks, ['native-smoke-internal', 'native-smoke-ingress']);
  assert.deepEqual(parsed.services.ingress.ports, ['127.0.0.1:33173:3000']);
  assert.deepEqual(parsed.services.ingress.entrypoint, ['/usr/local/bin/node', '-e']);
  assert.equal(parsed.services.ingress.command.length, 1);
  assert.equal(parsed.services.ingress.image, imageRef);
  assert.equal(parsed.services.ingress.pull_policy, 'never');
  assert.equal(parsed.services.ingress.user, '65532:65532');
  assert.equal(parsed.services.ingress.read_only, true);
  assert.deepEqual(parsed.services.ingress.cap_drop, ['ALL']);
  assert.deepEqual(parsed.services.ingress.security_opt, ['no-new-privileges:true']);
  assert.equal(parsed.services.ingress.tmpfs.length, 3);
  assert.equal(parsed.networks['native-smoke-internal'].internal, true);
  assert.equal(parsed.networks['native-smoke-ingress'].internal, undefined);
  assert.match(compose, new RegExp(imageRef.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(compose, /pull_policy: never/);
  assert.match(compose, /\/tmp\/native\/data:\/data/);
  assert.match(compose, /\/tmp\/native\/projects:\/projects/);
  assert.match(compose, /internal: true/);
  assert.match(compose, /fixed|\/usr\/local\/bin\/node/);
  assert.match(compose, /read_only: true/);
  assert.match(compose, /user: "65532:65532"/);
  assert.equal((compose.match(/rw,noexec,nosuid,nodev,size=64k,mode=1777/g) ?? []).length, 3);
  assert.match(compose, /cap_drop:\n\s+- ALL/);
  assert.match(compose, /no-new-privileges:true/);
  assert.match(compose, /native-smoke-ingress/);
  assert.equal((compose.match(/pull_policy: never/g) ?? []).length, 2);
  assert.equal((compose.match(/dev\.onepersonlab\.validation\.owner: native-windows-smoke/g) ?? []).length, 4);
  assert.equal((compose.match(/dev\.onepersonlab\.validation\.run-id:/g) ?? []).length, 4);
  for (const key of ['HTTP_PROXY', 'HTTPS_PROXY', 'ALL_PROXY', 'NO_PROXY', 'http_proxy', 'https_proxy', 'all_proxy', 'no_proxy']) {
    assert.match(compose, new RegExp(`${key}: ""`));
  }
  assert.doesNotMatch(compose.split('  ingress:')[0], /ports:/);
  assert.doesNotMatch(compose, /stable|latest|pull_policy: always/);
});

test('Native Windows smoke receipt validator accepts complete bounded evidence', () => {
  assert.deepEqual(validateNativeWindowsSmokeReceipt(receipt()), {
    schema: 'opl_app_webui_native_windows_smoke_receipt.v1',
    status: 'passed',
    image_ref: imageRef,
    run_id: 'native-test-abcdef',
    source_run_id: '30150000001',
  });
});

for (const [name, mutate, pattern] of [
  ['digest mismatch', (value: any) => { value.image.digest = `sha256:${'f'.repeat(64)}`; }, /identity does not match/],
  ['missing label', (value: any) => { delete value.image.labels['dev.onepersonlab.release.shell-revision']; }, /must be a non-empty string/],
  ['publication label mismatch', (value: any) => { value.publication.version = '26.7.25-r2'; }, /expected 26\.7\.25-r2/],
  ['invalid source run', (value: any) => { value.publication.source_run_id = '0'; }, /positive decimal/],
  ['container label mismatch', (value: any) => { value.runtime.container_labels['dev.onepersonlab.release.framework-revision'] = '4'.repeat(40); }, /expected 3{40}/],
  ['container run mismatch', (value: any) => { value.runtime.container_labels['dev.onepersonlab.validation.run-id'] = 'native-other-abcdef'; }, /bind the receipt run id/],
  ['failed login cookie', (value: any) => { value.http.login_session.session_cookie_observed = false; }, /must be true/],
  ['blank Windows UI', (value: any) => { value.ui.visible_text_chars = 0; }, /at least 20/],
  ['secondary pull', (value: any) => { value.no_secondary_fetch.image_pull_events_after_initial_pull = 1; }, /zero later image pull events/],
  ['different ingress image', (value: any) => { value.runtime.ingress.same_exact_image = false; }, /must bind the fixed ingress/],
  ['writable ingress', (value: any) => { value.runtime.ingress.read_only = false; }, /must bind the fixed ingress/],
  ['ingress proxy environment', (value: any) => { value.runtime.ingress.proxy_environment_cleared = false; }, /must bind the fixed ingress/],
  ['wrong ingress network', (value: any) => { value.runtime.ingress.network_names[0] = 'unrelated-network'; }, /must bind the fixed ingress/],
  ['invalid pull provenance', (value: any) => { value.no_secondary_fetch.pull_provenance.exact_pull_count_total = 2; }, /one exact digest pull/],
  ['cleanup residue', (value: any) => { value.cleanup.owned_containers_remaining = 1; }, /zero task-owned runtime/],
] as const) {
  test(`Native Windows smoke receipt rejects ${name}`, () => {
    const value = receipt();
    mutate(value);
    assert.throws(() => validateNativeWindowsSmokeReceipt(value), pattern);
  });
}

test('Native Windows prior pull evidence is exact-byte bound and permits no other pull', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-native-windows-pull-evidence-'));
  const evidencePath = path.join(root, 'command-index.json');
  const valid = {
    schema: 'opl_app_webui_native_windows_command_index.v1',
    commands: [
      { command: ['docker', 'pull', imageRef], status: 0, timed_out: false },
      { command: ['docker', 'compose', 'up', '-d', '--pull', 'never'], status: 0, timed_out: false },
    ],
  };
  fs.writeFileSync(evidencePath, `${JSON.stringify(valid, null, 2)}\n`);
  const evidenceSha = `sha256:${crypto.createHash('sha256').update(fs.readFileSync(evidencePath)).digest('hex')}`;
  assert.deepEqual(verifyPriorExactPullEvidence(evidencePath, imageRef, evidenceSha), {
    path: evidencePath,
    sha256: evidenceSha,
  });
  assert.throws(
    () => verifyPriorExactPullEvidence(evidencePath, imageRef, `sha256:${'0'.repeat(64)}`),
    /sha256 mismatch/,
  );

  valid.commands.push({
    command: ['docker', 'pull', `ghcr.io/gaofeng21cn/one-person-lab-webui@sha256:${'b'.repeat(64)}`],
    status: 0,
    timed_out: false,
  });
  fs.writeFileSync(evidencePath, `${JSON.stringify(valid, null, 2)}\n`);
  const changedSha = `sha256:${crypto.createHash('sha256').update(fs.readFileSync(evidencePath)).digest('hex')}`;
  assert.throws(
    () => verifyPriorExactPullEvidence(evidencePath, imageRef, changedSha),
    /exactly one successful bounded pull/,
  );

  valid.commands = [
    { command: ['docker', 'pull', imageRef], status: 0, timed_out: false },
    { command: ['docker', 'compose', '-p', 'other', 'pull'], status: 0, timed_out: false },
  ];
  fs.writeFileSync(evidencePath, `${JSON.stringify(valid, null, 2)}\n`);
  const composePullSha = `sha256:${crypto.createHash('sha256').update(fs.readFileSync(evidencePath)).digest('hex')}`;
  assert.throws(
    () => verifyPriorExactPullEvidence(evidencePath, imageRef, composePullSha),
    /exactly one successful bounded pull/,
  );

  valid.commands = [
    { command: ['docker', 'pull', imageRef], status: 0, timed_out: false },
    { command: ['docker', 'compose', 'up', '-d'], status: 0, timed_out: false },
  ];
  fs.writeFileSync(evidencePath, `${JSON.stringify(valid, null, 2)}\n`);
  const unpinnedSha = `sha256:${crypto.createHash('sha256').update(fs.readFileSync(evidencePath)).digest('hex')}`;
  assert.throws(
    () => verifyPriorExactPullEvidence(evidencePath, imageRef, unpinnedSha),
    /every compose up used --pull never/,
  );
});

test('Native Windows cleanup evidence fails closed on readback errors or owned residue', () => {
  assert.deepEqual(
    cleanupEvidence({ status: 0 }, { status: 0, stdout: '' }, { status: 0, stdout: '' }, false),
    {
      status: 'passed',
      owned_containers_remaining: 0,
      owned_networks_remaining: 0,
      runtime_directory_remaining: false,
    },
  );
  assert.equal(cleanupEvidence({ status: 1 }, { status: 0, stdout: '' }, { status: 0, stdout: '' }, false).status, 'failed');
  assert.equal(cleanupEvidence({ status: 0 }, { status: 1, stdout: '' }, { status: 0, stdout: '' }, false).status, 'failed');
  assert.equal(cleanupEvidence({ status: 0 }, { status: 0, stdout: 'container-id\n' }, { status: 0, stdout: '' }, false).status, 'failed');
  assert.equal(cleanupEvidence({ status: 0 }, { status: 0, stdout: '' }, { status: 0, stdout: 'network-id\n' }, false).status, 'failed');
  assert.equal(cleanupEvidence({ status: 0 }, { status: 0, stdout: '' }, { status: 0, stdout: '' }, true).status, 'failed');
});

test('Native Windows smoke plan does not invent a successor digest', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-native-windows-plan-'));
  const result = spawnSync(process.execPath, [
    '--experimental-strip-types', cliPath, '--plan-only', '--artifacts', root, '--json',
  ], { cwd: appRoot, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const plan = JSON.parse(result.stdout);
  assert.equal(plan.status, 'ready_for_successor_digest');
  assert.match(plan.image_template, /<successor_digest>/);
  assert.deepEqual(plan.required_resume_input, [
    'exact_index_digest',
    'source_run_id',
    'version',
    'app_sha',
    'shell_sha',
    'framework_sha',
    'bundle_digest',
    'cohort_ref',
  ]);
  assert.match(plan.execute_command, /--source-run-id <source_run_id>/);
  assert.match(plan.execute_command, /--expected-version <version>/);
  assert.match(plan.execute_command, /--expected-bundle-digest sha256:<64hex>/);
  assert.doesNotMatch(result.stdout, /e3cdd3806ef40f3414e81d990c718cc/);
  assert.ok(fs.existsSync(path.join(root, 'native-windows-smoke-plan.json')));
});

test('Native HTTP and Windows Chrome probes verify a hydrated local WebUI fixture', async (t) => {
  const chromePath = '/mnt/c/Program Files/Google/Chrome/Application/chrome.exe';
  if (!fs.existsSync('/proc/sys/fs/binfmt_misc/WSLInterop') || !fs.existsSync(chromePath)) {
    t.skip('Windows interop and Chrome are required');
    return;
  }
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-native-windows-ui-'));
  const serverPath = path.join(root, 'server.mjs');
  fs.writeFileSync(serverPath, `
import http from 'node:http';
const server = http.createServer((request, response) => {
  if (request.url === '/') {
    response.setHeader('content-type', 'text/html');
    response.setHeader('set-cookie', 'opl_session=fixture; Path=/; HttpOnly');
    response.end('<!doctype html><html><head><link rel="stylesheet" href="/assets/app.css"></head><body><div id="root"><main><h1>One Person Lab</h1><p>Windows native smoke fixture rendered successfully.</p></main></div><script src="/assets/app.js"></script></body></html>');
    return;
  }
  if (request.url === '/manifest.webmanifest') {
    response.setHeader('content-type', 'application/manifest+json');
    response.end(JSON.stringify({ name: 'One Person Lab', start_url: '/' }));
    return;
  }
  if (request.url === '/api/auth/user') {
    response.setHeader('content-type', 'application/json');
    response.end(JSON.stringify({ id: 'local-fixture', authenticated: true }));
    return;
  }
  if (request.url === '/assets/app.js') {
    response.setHeader('content-type', 'application/javascript');
    response.end('document.documentElement.dataset.fixture="ready";');
    return;
  }
  if (request.url === '/assets/app.css') {
    response.setHeader('content-type', 'text/css');
    response.end('body{font-family:sans-serif}');
    return;
  }
  response.statusCode = 404;
  response.end('not found');
});

server.listen(0, '0.0.0.0', () => console.log(JSON.stringify(server.address())));
`);
  const child = spawn(process.execPath, [serverPath], {
    cwd: root,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  t.after(() => {
    child.kill('SIGTERM');
    fs.rmSync(root, { recursive: true, force: true });
  });
  const address = await new Promise<{ port: number }>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('fixture server did not start')), 5_000);
    child.stdout.once('data', (chunk) => {
      clearTimeout(timer);
      resolve(JSON.parse(String(chunk)));
    });
    child.once('error', reject);
  });
  const url = `http://127.0.0.1:${address.port}`;
  const httpEvidence = await probeWebui(url, 10);
  assert.equal(httpEvidence.root.status, 'passed');
  assert.equal(httpEvidence.login_session.session_cookie_observed, true);
  const artifacts = path.join(root, 'artifacts');
  const runtime = path.join(root, 'runtime');
  fs.mkdirSync(artifacts);
  fs.mkdirSync(runtime);
  const run = commandRunner(artifacts, process.env, 30);
  const uiEvidence = renderWindowsUi({ run, artifactDir: artifacts, runtimeDir: runtime, url: `${url}/`, timeoutSeconds: 30 });
  assert.equal(uiEvidence.status, 'passed');
  assert.equal(uiEvidence.root_hydrated, true);
  assert.ok(uiEvidence.visible_text_chars >= 20);
  assert.ok(fs.statSync(path.join(artifacts, uiEvidence.screenshot.path)).size >= 1000);
});

test('Native HTTP qualification retries a transient abort across the full session flow', async (t) => {
  let rootRequests = 0;
  const server = (await import('node:http')).createServer((request, response) => {
    if (request.url === '/') {
      rootRequests += 1;
      response.setHeader('content-type', 'text/html');
      response.setHeader('set-cookie', 'opl_session=fixture; Path=/; HttpOnly');
      response.end('<!doctype html><div id="root">ready</div><script src="/assets/app.js"></script>');
      return;
    }
    if (request.url === '/assets/app.js' && rootRequests === 1) {
      request.socket.destroy();
      return;
    }
    if (request.url === '/assets/app.js') {
      response.setHeader('content-type', 'application/javascript');
      response.end('document.documentElement.dataset.ready="true"');
      return;
    }
    if (request.url === '/manifest.webmanifest') {
      response.setHeader('content-type', 'application/manifest+json');
      response.end(JSON.stringify({ name: 'One Person Lab' }));
      return;
    }
    if (request.url === '/api/auth/user') {
      response.setHeader('content-type', 'application/json');
      response.end(JSON.stringify({ authenticated: true }));
      return;
    }
    response.statusCode = 404;
    response.end('not found');
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => server.close());
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  const evidence = await probeWebui(`http://127.0.0.1:${address.port}`, 10);
  assert.equal(evidence.login_session.session_cookie_observed, true);
  assert.ok(rootRequests >= 2);
});

test('Native Windows smoke CLI validates receipts without Docker', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-native-windows-receipt-'));
  const receiptPath = path.join(root, 'receipt.json');
  fs.writeFileSync(receiptPath, JSON.stringify(receipt()));
  const result = spawnSync(process.execPath, [
    '--experimental-strip-types', cliPath, '--validate-receipt', receiptPath, '--json',
  ], { cwd: appRoot, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.equal(JSON.parse(result.stdout).status, 'passed');
});

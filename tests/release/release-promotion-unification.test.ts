import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

import { validateStableDistributionReceipt } from '../../scripts/release-saga-receipts.ts';

const appRoot = process.cwd();
const digest = `sha256:${'a'.repeat(64)}`;
const appDigest = `sha256:${'b'.repeat(64)}`;
const sourceCommit = 'c'.repeat(40);
const frameworkSourceCommit = 'e'.repeat(40);
const generation = '26.7.13-r4';
const requestId = 'd'.repeat(64);
const sourceAppRunId = '123456';
const frameworkRunId = '654321';

function workflowStep(source: string, name: string): string {
  const marker = `      - name: ${name}`;
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, `workflow step ${name} is missing`);
  const next = source.indexOf('\n      - name:', start + marker.length);
  return source.slice(start, next === -1 ? source.length : next);
}

function draftReleaseFilter(source: string): string {
  const step = workflowStep(source, 'Publish public non-latest release');
  const match = step.match(/jq -er --arg tag "\$tag" '\n([\s\S]*?)\n\s+' "\$releases_json"/);
  assert.ok(match, 'Draft release structured filter is missing');
  return match[1]!;
}

function packageComponent(packageId: string) {
  return {
    component_id: packageId,
    version: '0.2.0',
    source_commit: sourceCommit,
    artifact_ref: `ghcr.io/gaofeng21cn/one-person-lab-packages/${packageId}:0.2.0`,
    artifact_digest: digest,
  };
}

function promotionReceipt(target: 'candidate' | 'latest-stable') {
  const packages = Object.fromEntries([
    'mas', 'mag', 'rca', 'oma', 'obf', 'mas-scholar-skills', 'opl-flow',
  ].map((packageId) => [packageId, packageComponent(packageId)]));
  const channelRefs = [
    `ghcr.io/gaofeng21cn/one-person-lab-manifest:${target}`,
    `ghcr.io/gaofeng21cn/one-person-lab-framework:${target}`,
    ...Object.keys(packages).map((packageId) => `ghcr.io/gaofeng21cn/one-person-lab-packages/${packageId}:${target}`),
  ].sort();
  return {
    surface_kind: 'opl_release_set_promotion_receipt.v1',
    status: target === 'candidate' ? 'published_immutable_candidate' : 'promoted_latest_stable',
    promotion_target: target,
    promotion_request_id: requestId,
    release_gate: 'app_stable_promotion',
    release_set_generation: generation,
    carrier: {
      immutable_ref: `ghcr.io/gaofeng21cn/one-person-lab-manifest:${generation}`,
      digest,
      channel_ref: `ghcr.io/gaofeng21cn/one-person-lab-manifest:${target}`,
    },
    framework_run: {
      repository: 'gaofeng21cn/one-person-lab',
      run_id: frameworkRunId,
      run_attempt: '1',
    },
    source_app_run_id: sourceAppRunId,
    app: {
      component_id: 'opl-app',
      version: '26.7.13',
      source_commit: sourceCommit,
      artifact_ref: 'https://github.com/gaofeng21cn/one-person-lab-app/releases/download/v26.7.13/One-Person-Lab-26.7.13-mac-arm64.dmg',
      artifact_digest: appDigest,
    },
    components: {
      base: {
        component_id: 'opl-base',
        version: '0.2.1',
        source_commit: frameworkSourceCommit,
        artifact_ref: 'ghcr.io/gaofeng21cn/one-person-lab-framework:0.2.1',
        artifact_digest: digest,
      },
      packages,
    },
    anonymous_readback: { status: 'verified', verified_refs: channelRefs },
  };
}

function validatePromotion(receiptPath: string, target: 'candidate' | 'latest-stable', extra: string[] = []) {
  return spawnSync(process.execPath, [
    '--experimental-strip-types',
    'scripts/validate-framework-release-promotion-receipt.ts',
    '--receipt', receiptPath,
    '--target', target,
    '--promotion-request-id', requestId,
    '--release-set-generation', generation,
    '--release-gate', 'app_stable_promotion',
    '--source-app-run-id', sourceAppRunId,
    '--app-version', '26.7.13',
    '--app-source-commit', sourceCommit,
    '--app-artifact-digest', appDigest,
    '--framework-source-commit', frameworkSourceCommit,
    '--framework-run-id', frameworkRunId,
    ...extra,
  ], { cwd: appRoot, encoding: 'utf8' });
}

test('Framework candidate and latest-stable receipts preserve one immutable Release Set cohort', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-framework-promotion-'));
  const candidatePath = path.join(root, 'candidate.json');
  const stablePath = path.join(root, 'latest-stable.json');
  fs.writeFileSync(candidatePath, `${JSON.stringify(promotionReceipt('candidate'))}\n`);
  fs.writeFileSync(stablePath, `${JSON.stringify(promotionReceipt('latest-stable'))}\n`);

  const candidate = validatePromotion(candidatePath, 'candidate');
  assert.equal(candidate.status, 0, candidate.stderr);
  const stable = validatePromotion(stablePath, 'latest-stable', [
    '--expected-carrier-digest', digest,
    '--candidate-receipt', candidatePath,
  ]);
  assert.equal(stable.status, 0, stable.stderr);
  assert.equal(JSON.parse(stable.stdout).carrier_digest, digest);
});

test('Framework promotion receipt rejects a noncanonical Package artifact', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-framework-promotion-invalid-'));
  const receipt = promotionReceipt('candidate');
  receipt.components.packages.rca.artifact_ref = 'ghcr.io/gaofeng21cn/legacy/redcube-ai:0.2.0';
  const receiptPath = path.join(root, 'candidate.json');
  fs.writeFileSync(receiptPath, `${JSON.stringify(receipt)}\n`);
  const result = validatePromotion(receiptPath, 'candidate');
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /canonical Package repository|must use ghcr\.io\/gaofeng21cn\/one-person-lab-packages\/rca/);
});

test('Framework promotion receipt rejects Base built from a different Framework commit', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'opl-framework-promotion-stale-base-'));
  const receipt = promotionReceipt('candidate');
  receipt.components.base.source_commit = 'f'.repeat(40);
  const receiptPath = path.join(root, 'candidate.json');
  fs.writeFileSync(receiptPath, `${JSON.stringify(receipt)}\n`);
  const result = validatePromotion(receiptPath, 'candidate');
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /components\.base\.source_commit does not match the frozen Framework cohort SHA/);
});

test('Framework promotion readback carries the frozen Framework SHA through both broker receipts', () => {
  const workflow = fs.readFileSync(path.join(appRoot, '.github/workflows/desktop-release-promote.yml'), 'utf8');
  const helper = fs.readFileSync(path.join(appRoot, 'scripts/framework-release-promotion-step.sh'), 'utf8');
  assert.equal(
    workflow.match(/OPL_FRAMEWORK_SOURCE_COMMIT: \$\{\{ needs\.prepare\.outputs\.framework_sha \}\}/g)?.length,
    2,
  );
  assert.match(helper, /OPL_FRAMEWORK_SOURCE_COMMIT:\?OPL_FRAMEWORK_SOURCE_COMMIT is required/);
  assert.match(helper, /--framework-source-commit "\$OPL_FRAMEWORK_SOURCE_COMMIT"/);
  assert.doesNotMatch(helper, /gh workflow run/);
});

test('Homebrew Stable readback requires validated Standard VM receipt bytes without cross-repo dispatch', () => {
  const workflow = fs.readFileSync(path.join(appRoot, '.github/workflows/desktop-release-promote.yml'), 'utf8');
  assert.match(
    workflow,
    /standard_vm_evidence_base64: \$\{\{ steps\.standard-vm\.outputs\.evidence_base64 \}\}/,
  );
  assert.match(workflow, /const bytes = fs\.readFileSync\(receiptPath\)/);
  assert.match(workflow, /const encoded = bytes\.toString\('base64'\)/);
  assert.match(workflow, /evidence_base64=\$\{encoded\}/);
  assert.match(
    workflow,
    /STANDARD_VM_EVIDENCE_BASE64: \$\{\{ needs\.prepare\.outputs\.standard_vm_evidence_base64 \}\}/,
  );
  assert.match(workflow, /test -n "\$STANDARD_VM_EVIDENCE_BASE64"/);
  assert.match(workflow, /Reusing immutable brokered Stable distribution receipt/);
  assert.doesNotMatch(workflow, /gh workflow run/);
  assert.doesNotMatch(workflow, /repos\/\$TAP_REPO\/actions\/artifacts[\s\S]*artifact-qualification-receipt/);
});

test('promotion prepare rebuilds missing owner evidence from the exact qualified source and retained draft', () => {
  const workflow = fs.readFileSync(path.join(appRoot, '.github/workflows/desktop-release-promote.yml'), 'utf8');
  const prepare = workflow.slice(
    workflow.indexOf('  prepare:'),
    workflow.indexOf('\n  publish-nonlatest:'),
  );
  const rebuild = workflowStep(workflow, 'Rebuild missing owner-resolution evidence from exact qualified source');

  assert.match(prepare, /permissions:\n      contents: read\n      actions: read\n      id-token: write/);
  assert.doesNotMatch(prepare, /name: Download release candidate record/);
  assert.doesNotMatch(prepare, /name: Download owner-resolution readiness/);
  assert.doesNotMatch(prepare, /name: Download owner-resolution remote verification/);
  for (const binding of [
    'name: release-preflight-summary-${{ inputs.opl_version }}',
    'name: opl-first-run-vm-standard-${{ inputs.standard_vm_run_id }}',
    'name: one-shot-app-installer-smoke-${{ inputs.opl_version }}',
    'name: macos-build-arm64-dmg-cohort',
  ]) {
    assert.match(prepare, new RegExp(binding.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  assert.match(rebuild, /npm run verify-remote-release/);
  assert.match(rebuild, /scripts\/summarize-release-readiness\.ts/);
  assert.match(rebuild, /GITHUB_RUN_ID='\$\{\{ inputs\.standard_vm_run_id \}\}' node --experimental-strip-types scripts\/summarize-release-readiness\.ts/);
  assert.match(rebuild, /scripts\/write-release-candidate-record\.ts/);
  assert.match(rebuild, /--release-owner-receipt-ref "\$RELEASE_OWNER_RECEIPT_REF"/);
  assert.match(rebuild, /"standard-first-run-vm-smoke-after-standard-only": "success"/);
  assert.match(rebuild, /"one-shot-app-installer-smoke": "success"/);
  assert.match(prepare, /APP_SHA: \$\{\{ inputs\.artifact_app_sha \}\}/);
  assert.match(prepare, /SHELL_REF: \$\{\{ inputs\.shell_ref \}\}/);
  assert.match(prepare, /FRAMEWORK_REF: \$\{\{ inputs\.framework_ref \}\}/);
  assert.equal(
    (prepare.match(/GH_TOKEN: \$\{\{ secrets\.OPL_HOMEBREW_TAP_TOKEN \}\}/g) || []).length,
    3,
    'Draft reads use the administrator token without granting the prepare job write permission',
  );

  const framework = workflow.slice(
    workflow.indexOf('  framework-release-set:'),
    workflow.indexOf('\n  stable-distribution:'),
  );
  assert.equal((framework.match(/for attempt in \$\(seq 1 90\)/g) || []).length, 2);
  assert.match(framework, /bounded 15-minute discovery window/);
  assert.doesNotMatch(framework, /gh workflow run/);

  const distribution = workflow.slice(
    workflow.indexOf('  stable-distribution:'),
    workflow.indexOf('\n  homebrew-standard-vm:'),
  );
  assert.match(distribution, /for attempt in \$\(seq 1 90\)/);
  assert.match(distribution, /\[ "\$attempt" -lt 90 \] && sleep 10/);
  assert.match(distribution, /bounded 15-minute discovery window/);
  assert.doesNotMatch(distribution, /gh workflow run/);

  const homebrewVm = workflow.slice(
    workflow.indexOf('  homebrew-standard-vm:'),
    workflow.indexOf('\n  homebrew-activation:'),
  );
  assert.match(
    homebrewVm,
    /permissions:\n      contents: read\n      actions: read\n      id-token: write\n    uses: \.\/\.github\/workflows\/opl-first-run-vm\.yml/,
  );

  assert.equal(
    (workflow.match(/nowMs >= deadlineMs/g) || []).length,
    1,
    'the live deadline is checked only during durable promotion admission',
  );
  assert.equal(
    (workflow.match(/--mode historical/g) || []).length,
    2,
    'later App write jobs must revalidate the immutable historical admission',
  );
  assert.doesNotMatch(workflow, /Recheck immutable Standard deadline before promotion receipt upload/);
});

test('both Draft release mutations use the administrator token', () => {
  const workflow = fs.readFileSync(path.join(appRoot, '.github/workflows/desktop-release-promote.yml'), 'utf8');
  for (const stepName of ['Publish public non-latest release', 'Mark release latest and verify readback']) {
    const step = workflowStep(workflow, stepName);
    assert.match(step, /GH_TOKEN: \$\{\{ secrets\.OPL_HOMEBREW_TAP_TOKEN \}\}/);
    assert.doesNotMatch(step, /GH_TOKEN: \$\{\{ secrets\.GITHUB_TOKEN \}\}/);
  }
});

test('public non-latest resolves one retained Draft from the structured release list', () => {
  const workflow = fs.readFileSync(path.join(appRoot, '.github/workflows/desktop-release-promote.yml'), 'utf8');
  const step = workflowStep(workflow, 'Publish public non-latest release');
  const filter = draftReleaseFilter(workflow);
  const assets = Array.from({ length: 6 }, (_, index) => ({ name: `asset-${index}` }));
  const draft = { id: 355962544, tag_name: 'v26.7.18', draft: true, prerelease: false, assets };
  const resolve = (pages: unknown) => spawnSync('jq', ['-er', '--arg', 'tag', 'v26.7.18', filter], {
    input: JSON.stringify(pages),
    encoding: 'utf8',
  });

  assert.match(step, /gh api --paginate --slurp "repos\/\$GITHUB_REPOSITORY\/releases\?per_page=100"/);
  assert.doesNotMatch(step, /releases\/tags\/\$tag/);
  assert.match(step, /EXPECTED_APP_ARTIFACT_DIGEST/);
  assert.match(step, /EXPECTED_COMPONENT_MANIFEST_DIGEST/);
  assert.equal(resolve([[draft]]).stdout.trim(), '355962544');
  assert.notEqual(resolve([[]]).status, 0, 'zero exact Draft matches must fail closed');
  assert.notEqual(resolve([[draft, { ...draft, id: 355962545 }]]).status, 0, 'two exact Draft matches must fail closed');
  assert.notEqual(resolve([[{ ...draft, assets: assets.slice(1) }]]).status, 0, 'an incomplete Draft asset set must fail closed');
});

test('Homebrew Stable distribution v3 binds Formula and Standard App cask to the Framework Release Set digest', () => {
  const formula = {
    path: 'Formula/opl.rb',
    formula_name: 'opl',
    version: '0.2.1',
    source_head: sourceCommit,
    artifact_ref: 'ghcr.io/gaofeng21cn/one-person-lab-framework:0.2.1',
    artifact_digest: digest,
    transport_sha256: 'e'.repeat(64),
    sha256: 'f'.repeat(64),
  };
  const cask = (name: string, version = '26.7.13') => ({
    path: `Casks/${name}.rb`,
    version,
    sha256: '1'.repeat(64),
    url: `https://github.com/gaofeng21cn/one-person-lab-app/releases/download/v26.7.13/${name}.dmg`,
  });
  const receipt = {
    schema: 'opl_stable_distribution_receipt.v3',
    status: 'verified',
    stable_session_id: `sha256:${'2'.repeat(64)}`,
    release_set: {
      generation,
      manifest_ref: `ghcr.io/gaofeng21cn/one-person-lab-manifest:${generation}`,
      manifest_digest: digest,
      stable_channel_ref: 'ghcr.io/gaofeng21cn/one-person-lab-manifest:latest-stable',
      stable_channel_digest: digest,
      base: {
        component_id: 'opl-base', version: '0.2.1', source_commit: sourceCommit,
        artifact_ref: formula.artifact_ref, artifact_digest: digest,
      },
      app: {
        component_id: 'opl-app', version: '26.7.13', source_commit: sourceCommit,
        artifact_ref: 'https://github.com/gaofeng21cn/one-person-lab-app/releases/download/v26.7.13/One-Person-Lab-26.7.13-mac-arm64.dmg',
        artifact_digest: appDigest,
      },
      formula,
    },
    release: {
      repo: 'gaofeng21cn/one-person-lab-app', tag: 'v26.7.13', version: '26.7.13',
      public: true, latest: false, source_release_run_id: sourceAppRunId,
    },
    cohort: {
      release_cohort_ref: `sha256:${'3'.repeat(64)}`,
      app_sha: sourceCommit,
      shell_sha: sourceCommit,
      framework_sha: sourceCommit,
      release_set_generation: generation,
      release_set_manifest_digest: digest,
    },
    standard_vm: {
      run_id: frameworkRunId, evidence_ref: 'opl-first-run-vm-full-654321',
      evidence_sha256: '4'.repeat(64), result: 'passed',
    },
    tap: {
      repo: 'gaofeng21cn/homebrew-one-person-lab', commit_sha: sourceCommit,
      annotated_tag: 'stable-standard-distribution/v26.7.13', formula,
      standard_cask: cask('one-person-lab'),
    },
  };
  assert.deepEqual(validateStableDistributionReceipt(receipt, {
    stableSessionId: receipt.stable_session_id,
    version: '26.7.13',
    releaseCohortRef: receipt.cohort.release_cohort_ref,
    appSha: sourceCommit,
    shellSha: sourceCommit,
    frameworkSha: sourceCommit,
    releaseSetGeneration: generation,
    releaseSetManifestDigest: digest,
    sourceReleaseRunId: sourceAppRunId,
    standardVmRunId: frameworkRunId,
  }), []);
});

test('Standard promotion and Full add-on never mutate the independent WebUI Stable channel', () => {
  const source = fs.readFileSync(path.join(appRoot, '.github/workflows/desktop-release.yml'), 'utf8');
  const promote = fs.readFileSync(path.join(appRoot, '.github/workflows/desktop-release-promote.yml'), 'utf8');
  const addon = fs.readFileSync(path.join(appRoot, '.github/workflows/desktop-release-full-addon.yml'), 'utf8');
  assert.doesNotMatch(source, /\$\{ghcr_image\}:stable/);
  assert.doesNotMatch(promote, /oras tag [^\n]* stable/);
  assert.doesNotMatch(addon, /oras tag [^\n]* stable/);
  assert.doesNotMatch(addon, /make_latest/);
  assert.doesNotMatch(promote, /workflow run desktop-release-full-addon\.yml/);
  assert.match(addon, /Build frozen Full add-on/);
  assert.match(addon, /Resolve signed broker admission for this exact Full add-on run[\s\S]*?--mode lookup/);
  assert.match(addon, /Verify historical Full add-on broker admission in write job[\s\S]*?--mode historical/);
  assert.doesNotMatch(addon, /verify-release-session-lease|verify-release-mutation-payload|release_mutation_payload_base64/);
  assert.equal(fs.existsSync(path.join(appRoot, '.github/workflows/webui-ghcr-release.yml')), false);
  assert.equal(fs.existsSync(path.join(appRoot, '.github/workflows/homebrew-tap-update.yml')), false);
});

test('App latest mutation and promotion receipt stay bound to the exact historical admission', () => {
  const workflow = fs.readFileSync(path.join(appRoot, '.github/workflows/desktop-release-promote.yml'), 'utf8');
  const historicalAdmissionStep = workflowStep(workflow, 'Verify historical promotion broker admission in latest write job');
  const latestStep = workflowStep(workflow, 'Mark release latest and verify readback');
  const receiptStep = workflowStep(workflow, 'Write and validate promotion saga receipt');
  const uploadStep = workflowStep(workflow, 'Upload promotion saga receipt');

  assert.match(historicalAdmissionStep, /--mode historical/);
  assert.match(historicalAdmissionStep, /--expected-validation-sha256 "\$BROKER_ADMISSION_VALIDATION_SHA256"/);
  assert.ok(
    workflow.indexOf('Verify historical promotion broker admission in latest write job')
      < workflow.indexOf('Mark release latest and verify readback'),
    'latest mutation must follow exact historical admission verification',
  );
  assert.doesNotMatch(latestStep, /Date\.now\(\)|STANDARD_ADMISSION_DEADLINE_AT/);

  const receiptWrite = receiptStep.indexOf('scripts/write-release-saga-receipt.ts');
  const receiptValidate = receiptStep.indexOf('scripts/validate-release-saga-receipt.ts');
  assert.ok(receiptWrite < receiptValidate, 'promotion receipt must be written before exact validation');
  assert.doesNotMatch(receiptStep, /Date\.now\(\)|STANDARD_ADMISSION_DEADLINE_AT/);
  const writerCommand = receiptStep.slice(receiptWrite, receiptValidate);
  const validatorCommand = receiptStep.slice(receiptValidate);

  for (const binding of [
    '--standard-run-id "${{ github.run_id }}"',
    '--workflow-run-id "${{ github.run_id }}"',
    '--workflow-run-attempt "${{ github.run_attempt }}"',
    '--release-attempt-id "${{ inputs.release_attempt_id }}"',
    '--controller-workflow-sha "${{ github.sha }}"',
    '--source-release-run-id "${{ inputs.release_run_id }}"',
    '--standard-qualification-run-id "${{ inputs.standard_vm_run_id }}"',
    '--release-cohort-ref "${{ inputs.release_cohort_ref }}"',
    '--app-sha "${{ needs.prepare.outputs.app_sha }}"',
    '--shell-sha "${{ needs.prepare.outputs.shell_sha }}"',
    '--framework-sha "${{ needs.prepare.outputs.framework_sha }}"',
    '--release-set-generation "${{ inputs.release_set_generation }}"',
    '--release-set-manifest-digest "${{ needs.framework-release-set.outputs.carrier_digest }}"',
    '--release-owner-receipt-ref "${{ inputs.release_owner_receipt_ref }}"',
  ]) {
    assert.match(writerCommand, new RegExp(binding.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }

  for (const binding of [
    '--release-cohort-ref "${{ inputs.release_cohort_ref }}"',
    '--app-sha "${{ needs.prepare.outputs.app_sha }}"',
    '--shell-sha "${{ needs.prepare.outputs.shell_sha }}"',
    '--framework-sha "${{ needs.prepare.outputs.framework_sha }}"',
    '--source-release-run-id "${{ inputs.release_run_id }}"',
    '--release-set-generation "${{ inputs.release_set_generation }}"',
    '--release-set-manifest-digest "${{ needs.framework-release-set.outputs.carrier_digest }}"',
    '--standard-vm-run-id "${{ inputs.standard_vm_run_id }}"',
    '--promotion-run-id "${{ github.run_id }}"',
    '--promotion-run-attempt "${{ github.run_attempt }}"',
    '--promotion-attempt-id "${{ inputs.release_attempt_id }}"',
    '--controller-workflow-sha "${{ github.sha }}"',
    '--release-owner-receipt-ref "${{ inputs.release_owner_receipt_ref }}"',
  ]) {
    assert.match(validatorCommand, new RegExp(binding.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }

  assert.match(uploadStep, /actions\/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a/);
});

test('promotion startup failure creates a fresh controller attempt instead of replaying the workflow ticket', () => {
  const controller = fs.readFileSync(path.join(appRoot, 'scripts/run-stable-release.ts'), 'utf8');
  assert.match(
    controller,
    /session\.phase !== 'artifacts_qualified' && session\.phase !== 'promotion_failed'/,
  );
  assert.match(controller, /const retrying = session\.phase === 'promotion_failed'/);
  assert.match(controller, /planReleaseMutationAttempt\(session/);
  assert.doesNotMatch(controller, /gh run rerun/);
});

test('expired promotion recovery binds one exact historical admission and terminal zero-checkpoint run', () => {
  const workflow = fs.readFileSync(path.join(appRoot, '.github/workflows/desktop-release-promote.yml'), 'utf8');
  const controller = fs.readFileSync(path.join(appRoot, 'scripts/run-stable-release.ts'), 'utf8');
  const admission = workflowStep(workflow, 'Resolve signed broker admission for this exact promotion run');

  assert.match(workflow, /historical_predecessor_admission_receipt_base64:/);
  assert.match(admission, /prior\.stable_session_id !== request\.stable_session_id/);
  assert.match(admission, /prior\.mutation_payload_sha256 !== request\.mutation_payload_sha256/);
  assert.match(admission, /canonicalPayload\(prior\.mutation_payload\) !== canonicalPayload\(request\.mutation_payload\)/);
  assert.match(admission, /priorPersistedMs >= deadlineMs/);
  assert.match(admission, /matches\.length !== 1/);
  assert.match(admission, /\['failure', 'startup_failure'\]/);
  assert.match(admission, /Historical promotion predecessor already crossed a public mutation checkpoint/);
  assert.match(controller, /historicalPromotionRecoveryContext\(session, ownerReceiptRef, releaseSetGeneration\)/);
  assert.match(controller, /priorRunIds: historicalRecovery\?\.priorRunIds/);
  assert.match(controller, /historicalPredecessor \? \{/);
  assert.doesNotMatch(admission, /gh workflow run|gh run rerun|gh run cancel/);
});

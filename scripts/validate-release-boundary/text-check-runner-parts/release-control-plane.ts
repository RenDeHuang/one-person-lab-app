import fs from 'node:fs';
import path from 'node:path';
import {
  exactObject,
  hasStableMutationMutex,
  requestsWritePermission,
  jobRuns,
  jobEvidenceText,
  actionSteps,
  hasLocalStep,
  localActionUse,
  workflowJobs,
  needsExactly,
  parseWorkflow,
  reportFailure,
} from './report.ts';
import {
  exactReadPermissions,
  exactStableEntryPermissions,
  exactWebUiCompileCeilingPermissions,
  exactStableStandardPermissions,
  exactStableStandardBundlePermissions,
  manualPreviewWorkflowPath,
  manualFullPreviewWorkflowPath,
  manualFullPreviewMutationJob,
  webuiStablePromotionWorkflowPath,
  webuiStablePromotionMutationJob,
  webuiPromotionPublishEnvironment,
  webuiDevelopmentWorkflowPath,
  stableFollowupWorkflowPath,
  stableFollowupActionPaths,
  homebrewFullPublisherWorkflowPath,
  postPublicationOptionalCertificationWorkflowPath,
  stableDesktopFollowupWorkflowPath,
  desktopPlatformAddonWorkflowPath,
  fullAddonFollowerWorkflowPath,
  nightlyReleaseWorkflowPath,
  nightlyFollowupWorkflowPath,
  previewLatestPointerWorkflowPath,
  studioReleaseWorkflowPath,
  studioFullReleaseWorkflowPath,
  stableEntrySpecs,
  stableReleaseActionPaths,
  releaseWorkflowPaths,
  releaseWorkflowPathsForProfile,
  isAuthorizedInlineStableFollowups,
  isAuthorizedStableWebuiWriteJob,
} from './workflow-policy.ts';
import {
  workflowMutationCommandPattern,
  retiredLiveAuthorityPattern,
  standardUpdaterOrLatest,
} from './mutation-policy.ts';

function validateStableOperationControlArtifactConsumer(appRoot: string): number {
  const id = 'stable_operation_control_artifact_consumer';
  const parsed = parseWorkflow(appRoot, '.github/workflows/_release-bundle.yml', id);
  if (!parsed) return 1;
  const { text } = parsed;
  let failures = 0;
  for (const required of [
    'stable_operation_control_artifact:',
    'stable_operation_control_digest:',
    'Download protected Stable operation control',
    'Consume one protected Stable operation control before cold work',
    'stable-operation-control.ts consume',
    'opl-stable-operation-consumption-${{ github.run_id }}',
    'Require one matching consumed Stable operation control',
    '--input "$consumption"',
  ]) {
    if (!text.includes(required)) {
      failures += reportFailure(id, `Stable Bundle is missing durable control consumption ${required}`);
    }
  }
  if (
    text.includes('validate-release-source-gate.ts')
    || text.includes('release-dispatch-guard.ts preflight')
    || text.includes('release-source-qualification.yml')
  ) {
    failures += reportFailure(
      id,
      'Stable Bundle must consume the protected control artifact and must not rerun source-gate, pre-nonce guard, or source qualification.',
    );
  }
  return failures;
}

function validateStudioFullAppendTopology(
  appRoot: string,
  id: string,
  stableJobs: Record<string, Record<string, any>>,
): number {
  let failures = 0;
  const admission = stableJobs['studio-full-append-admission'];
  const execution = stableJobs['studio-full-append'];
  const admissionEvidence = jobEvidenceText(admission);

  if (
    !admission
    || admission.if !== "${{ inputs.entry == 'studio_full_append' }}"
    || Object.prototype.hasOwnProperty.call(admission, 'needs')
    || admission.environment !== 'release-stable'
    || !exactObject(admission.permissions, exactReadPermissions)
  ) {
    failures += reportFailure(id, 'studio-full-append-admission must be the initial read-only Full append gate');
  }
  if (workflowMutationCommandPattern.test(jobRuns(admission))) {
    failures += reportFailure(id, 'Studio Full admission must not perform public mutation');
  }
  for (const binding of [
    'Reject mutable or mixed Studio Full append request',
    'test "$GITHUB_EVENT_NAME" = workflow_dispatch',
    'test "$GITHUB_REF" = refs/heads/main',
    'test -z "$REQUESTED_APP_REF"',
    '[[ "$STUDIO_SHA" =~ ^[0-9a-f]{40}$ ]]',
    '[[ "$STUDIO_TREE" =~ ^[0-9a-f]{40}$ ]]',
    'Checkout exact App release authority',
    'Checkout exact Studio source',
    'opl_studio_full_append_admission.v1',
    'same_tag:true',
    'standard_assets_unchanged:true',
    'latest_unchanged:true',
    'Upload immutable Studio Full append admission',
  ]) {
    if (!admissionEvidence.includes(binding)) {
      failures += reportFailure(id, `Studio Full admission is missing ${binding}`);
    }
  }
  const admissionAppCheckout = admission?.steps?.find(
    (step: Record<string, any>) => step.name === 'Checkout exact App release authority',
  );
  if (
    admissionAppCheckout?.uses !== 'actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1'
    || admissionAppCheckout.with?.ref !== '${{ github.sha }}'
  ) {
    failures += reportFailure(id, 'Studio Full admission must checkout the App authority at github.sha');
  }
  if (/secrets\./.test(JSON.stringify(admission))) {
    failures += reportFailure(id, 'Studio Full admission must not access protected secret values');
  }

  const expectedExecutionIf =
    "${{ !cancelled() && inputs.entry == 'studio_full_append' && needs.studio-full-append-admission.result == 'success' }}";
  const expectedExecutionInputs = {
    app_ref: '${{ needs.studio-full-append-admission.outputs.app_ref }}',
    studio_sha: '${{ needs.studio-full-append-admission.outputs.studio_sha }}',
    studio_tree: '${{ needs.studio-full-append-admission.outputs.studio_tree }}',
    studio_tag: '${{ needs.studio-full-append-admission.outputs.studio_tag }}',
    studio_version: '${{ needs.studio-full-append-admission.outputs.studio_version }}',
    framework_ref: '${{ needs.studio-full-append-admission.outputs.framework_ref }}',
    mas_ref: '${{ needs.studio-full-append-admission.outputs.mas_ref }}',
    mas_scholar_skills_ref: '${{ needs.studio-full-append-admission.outputs.mas_scholar_skills_ref }}',
    mag_ref: '${{ needs.studio-full-append-admission.outputs.mag_ref }}',
    rca_ref: '${{ needs.studio-full-append-admission.outputs.rca_ref }}',
    meta_agent_ref: '${{ needs.studio-full-append-admission.outputs.meta_agent_ref }}',
    bookforge_ref: '${{ needs.studio-full-append-admission.outputs.bookforge_ref }}',
    opl_flow_ref: '${{ needs.studio-full-append-admission.outputs.opl_flow_ref }}',
    officecli_ref: '${{ needs.studio-full-append-admission.outputs.officecli_ref }}',
    mineru_ref: '${{ needs.studio-full-append-admission.outputs.mineru_ref }}',
    standard_release_id: '${{ needs.studio-full-append-admission.outputs.standard_release_id }}',
    standard_release_tag: '${{ needs.studio-full-append-admission.outputs.standard_release_tag }}',
    prior_studio_full_artifact_run_id: '${{ inputs.prior_studio_full_artifact_run_id }}',
    operation_deadline_at: '${{ needs.studio-full-append-admission.outputs.operation_deadline_at }}',
  };
  if (
    !execution
    || execution.if !== expectedExecutionIf
    || !needsExactly(execution, ['studio-full-append-admission'])
    || execution.uses !== `./${studioFullReleaseWorkflowPath}`
    || execution.secrets !== 'inherit'
    || Object.prototype.hasOwnProperty.call(execution, 'steps')
    || !exactObject(execution.permissions, exactReadPermissions)
    || !exactObject(execution.with, expectedExecutionInputs)
  ) {
    failures += reportFailure(id, 'Studio Full execution must be a step-free reusable call bound to the admitted Full inputs');
  }

  const fullWorkflow = parseWorkflow(appRoot, studioFullReleaseWorkflowPath, id);
  if (!fullWorkflow) return failures + 1;
  const fullJobs = workflowJobs(fullWorkflow.workflow);
  const expectedInputNames = [
    'app_ref', 'studio_sha', 'studio_tree', 'studio_tag', 'studio_version', 'framework_ref',
    'mas_ref', 'mas_scholar_skills_ref', 'mag_ref', 'rca_ref', 'meta_agent_ref', 'bookforge_ref',
    'opl_flow_ref', 'officecli_ref', 'mineru_ref', 'standard_release_id', 'standard_release_tag',
    'prior_studio_full_artifact_run_id', 'operation_deadline_at',
  ];
  const inputNames = Object.keys(fullWorkflow.workflow.on?.workflow_call?.inputs ?? {});
  if (
    JSON.stringify(Object.keys(fullWorkflow.workflow.on ?? {})) !== JSON.stringify(['workflow_call'])
    || fullWorkflow.workflow.concurrency !== undefined
    || !exactObject(fullWorkflow.workflow.permissions, exactReadPermissions)
    || JSON.stringify(inputNames) !== JSON.stringify(expectedInputNames)
    || JSON.stringify(Object.keys(fullJobs)) !== JSON.stringify([
      'build-full-signed-notarized',
      'restore-full',
      'publish-full',
      'public-readback',
    ])
  ) {
    failures += reportFailure(id, 'Studio Full reusable workflow must expose one exact four-job same-tag append topology');
  }

  const build = fullJobs['build-full-signed-notarized'];
  const restore = fullJobs['restore-full'];
  const publish = fullJobs['publish-full'];
  const readback = fullJobs['public-readback'];
  if (
    !build
    || build.if !== "${{ inputs.prior_studio_full_artifact_run_id == '' }}"
    || Object.prototype.hasOwnProperty.call(build, 'needs')
    || build['runs-on'] !== 'macos-15'
    || build.environment !== 'release-stable'
    || !exactObject(build.permissions, exactReadPermissions)
    || !restore
    || restore.if !== "${{ inputs.prior_studio_full_artifact_run_id != '' }}"
    || Object.prototype.hasOwnProperty.call(restore, 'needs')
    || restore['runs-on'] !== 'ubuntu-latest'
    || restore.environment !== undefined
    || !exactObject(restore.permissions, exactReadPermissions)
    || !publish
    || publish.if !== "${{ always() && (needs.build-full-signed-notarized.result == 'success' || needs.build-full-signed-notarized.result == 'skipped') && (needs.restore-full.result == 'success' || needs.restore-full.result == 'skipped') }}"
    || !needsExactly(publish, ['build-full-signed-notarized', 'restore-full'])
    || publish['runs-on'] !== 'ubuntu-latest'
    || publish.environment !== 'release-stable'
    || !exactObject(publish.permissions, exactReadPermissions)
    || !exactObject(publish.concurrency, { group: 'opl-studio-publication-global', 'cancel-in-progress': false })
    || !readback
    || readback.if !== "${{ always() && needs.publish-full.result == 'success' }}"
    || !needsExactly(readback, ['publish-full'])
    || readback['runs-on'] !== 'macos-15'
    || readback.environment !== undefined
    || !exactObject(readback.permissions, exactReadPermissions)
  ) {
    failures += reportFailure(id, 'Studio Full reusable jobs must preserve isolated build, append, and public readback ownership');
  }

  const fullEvidence = [build, restore, publish, readback].map(jobEvidenceText).join('\n');
  for (const binding of [
    'actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1',
    'scripts/verify-apple-release-credentials.ts',
    'security import',
    'npx electron-builder --mac --arm64 --dir',
    'npm --prefix app-source run release:full',
    'scripts/notarize-macos-dmg.ts',
    'xcrun stapler validate',
    'spctl --assess',
    'Append exactly two Studio Full assets with CAS and no overwrite',
    'studio-full-release-adapter.ts append',
    'one-person-lab-preview-full-',
    'opl-release-manifest.json',
    'Read back public Standard and Full bytes anonymously',
    'public-asset-readback.json',
    'standard_assets_unchanged',
  ]) {
    if (!fullEvidence.includes(binding)) {
      failures += reportFailure(id, `Studio Full reusable workflow is missing ${binding}`);
    }
  }
  const requiredCheckoutRepositories = [
    'gaofeng21cn/one-person-lab-app',
    'gaofeng21cn/opl-studio',
    'gaofeng21cn/one-person-lab',
  ];
  const buildCheckoutRepositories = new Set(
    (Array.isArray(build?.steps) ? build.steps : [])
      .map((step: Record<string, any>) => step.with?.repository)
      .filter((repository: unknown): repository is string => typeof repository === 'string'),
  );
  for (const repository of requiredCheckoutRepositories) {
    if (!buildCheckoutRepositories.has(repository)) {
      failures += reportFailure(id, `Studio Full reusable workflow is missing checkout repository ${repository}`);
    }
  }
  if (
    workflowMutationCommandPattern.test(jobRuns(build))
    || workflowMutationCommandPattern.test(jobRuns(restore))
    || workflowMutationCommandPattern.test(jobRuns(readback))
    || /gh\s+release\s+(?:create|edit|delete|upload)|--clobber/.test(fullWorkflow.text)
    || /bundled-aioncore|aioncore_codex_only|gaofeng21cn\/aionui/i.test(fullWorkflow.text)
    || requestsWritePermission(fullWorkflow.workflow.permissions)
    || Object.values(fullJobs).some((job) => requestsWritePermission(job.permissions))
  ) {
    failures += reportFailure(id, 'Studio Full reusable workflow must remain append-only, no-clobber, and independent of AionUI/AionCore');
  }
  return failures;
}

export function validateStableReleaseControlPlane(appRoot: string): number {
  const id = 'stable_release_control_plane';
  const parsed = parseWorkflow(appRoot, '.github/workflows/release-stable.yml', id);
  if (!parsed) return 1;
  const { workflow, text } = parsed;
  let failures = 0;

  if (JSON.stringify(Object.keys(workflow.on ?? {})) !== JSON.stringify(['workflow_dispatch'])) {
    failures += reportFailure(id, 'release-stable.yml must expose only workflow_dispatch');
  }
  const operationInput = workflow.on?.workflow_dispatch?.inputs?.operation;
  const expectedOperations = ['standard', 'resume_standard', 'append_full'];
  if (operationInput?.type !== 'choice' || operationInput?.required !== true ||
      JSON.stringify(operationInput?.options) !== JSON.stringify(expectedOperations)) {
    failures += reportFailure(id, `operation choices must be exactly ${expectedOperations.join(', ')}`);
  }
  if (workflow.concurrency !== undefined) {
    failures += reportFailure(id, 'Stable admission and qualification must not hold the public mutation mutex');
  }
  if (!exactObject(workflow.permissions, exactReadPermissions)) {
    failures += reportFailure(id, 'top-level Stable permissions must be exactly contents:read/actions:read');
  }
  if (retiredLiveAuthorityPattern.test(text)) {
    failures += reportFailure(id, 'Stable entry must not depend on retired broker/session/lease authority');
  }

  const jobs = workflowJobs(workflow);
  if (!hasStableMutationMutex(jobs['resume-standard'])) {
    failures += reportFailure(
      id,
      'resume-standard must acquire the public mutation mutex only around its reusable publisher',
    );
  }
  const authorityInputs = workflow.on?.workflow_dispatch?.inputs ?? {};
  if (
    authorityInputs.entry?.type !== 'choice'
    || authorityInputs.entry?.required !== false
    || authorityInputs.entry?.default !== 'framework_release'
    || JSON.stringify(authorityInputs.entry?.options) !== JSON.stringify([
      'framework_release',
      'studio_carrier_admission',
      'studio_full_append',
    ])
  ) {
    failures += reportFailure(id, 'Stable entry selector must separate Framework release from plan-only Studio admission');
  }
  for (const name of ['authority_id', 'operation_id', 'authority_carrier', 'authority_digest']) {
    if (authorityInputs[name]?.required !== false || authorityInputs[name]?.default !== '') {
      failures += reportFailure(
        id,
        `${name} must remain an optional recovery input with an empty default; Standard admission enforces it conditionally`,
      );
    }
  }
  for (const name of ['studio_sha', 'studio_tree', 'studio_tag']) {
    if (authorityInputs[name]?.required !== false || authorityInputs[name]?.default !== '') {
      failures += reportFailure(
        id,
        `${name} must remain empty unless the protected Studio admission operation is selected`,
      );
    }
  }
  if (
    !String(workflow['run-name'] ?? '').includes("inputs.operation == 'standard'")
    || !String(workflow['run-name'] ?? '').includes("format('OPL Stable standard operation:{0} authority:{1} run:{2}'")
    || !String(workflow['run-name'] ?? '').includes("format('OPL Stable {0} {1}', inputs.operation, github.run_id)")
    || authorityInputs.version !== undefined
  ) {
    failures += reportFailure(id, 'Stable run identity must retain Standard authority binding while recovery operations remain follower-compatible');
  }

  const expectedJobs = [
    'studio-protected-release-admission',
    'studio-protected-release',
    'studio-full-append-admission',
    'studio-full-append',
    'protected-operation-admission',
    'admission',
    'stable-admission-manifest',
    'webui-source-authority',
    'webui-carrier',
    'webui-promotion',
    'stable-followups',
    ...Object.keys(stableEntrySpecs),
  ].sort();
  if (JSON.stringify(Object.keys(jobs).sort()) !== JSON.stringify(expectedJobs)) {
    failures += reportFailure(id, `jobs must be exactly ${expectedJobs.join(', ')}`);
  }
  if (
    jobs['source-qualification']
    || text.includes('uses: ./.github/workflows/release-source-qualification.yml')
    || text.includes('source-qualification-receipt.ts')
    || text.includes('validate-source-qualification-receipt.ts')
  ) {
    failures += reportFailure(
      id,
      'Stable entry must not retain the legacy source-qualification job or receipt after protected operation admission owns the frozen source gate.',
    );
  }
  if (!isAuthorizedInlineStableFollowups('.github/workflows/release-stable.yml', 'stable-followups', jobs['stable-followups'] ?? {})) {
    failures += reportFailure(id, 'Stable followers must start after Standard publication without waiting for Docker');
  }
  const webuiSourceAuthority = jobs['webui-source-authority'];
  const webuiSourceAuthorityRun = jobRuns(webuiSourceAuthority);
  const webuiCheckpointDownload = webuiSourceAuthority?.steps?.find(
    (step: Record<string, any>) => step.name === 'Download exact published Standard checkpoint',
  );
  const webuiAdmissionDownload = webuiSourceAuthority?.steps?.find(
    (step: Record<string, any>) => step.name === 'Download same-run Stable admission',
  );
  if (
    !webuiSourceAuthority
    || !needsExactly(webuiSourceAuthority, ['admission', 'stable-admission-manifest', 'standard', 'resume-standard'])
    || webuiSourceAuthority.if !== "${{ always() && !cancelled() && needs.admission.result == 'success' && ((inputs.operation == 'standard' && needs.standard.result == 'success') || (inputs.operation == 'resume_standard' && needs.resume-standard.result == 'success')) }}"
    || !exactObject(webuiSourceAuthority.permissions, exactReadPermissions)
    || webuiCheckpointDownload?.with?.name !== "${{ inputs.operation == 'standard' && needs.standard.outputs.source_artifact || needs.admission.outputs.source_artifact }}"
    || webuiCheckpointDownload?.with?.['run-id'] !== "${{ inputs.operation == 'standard' && needs.standard.outputs.source_run_id || needs.admission.outputs.source_run_id }}"
    || webuiAdmissionDownload?.if !== "${{ inputs.operation == 'standard' }}"
    || !webuiSourceAuthorityRun.includes('--origin stable_standard')
    || !webuiSourceAuthorityRun.includes('.bundle_digest')
    || !webuiSourceAuthorityRun.includes('test "$OPERATION" = resume_standard')
    || !webuiSourceAuthorityRun.includes('source_cutoff_observed_at="$RESUME_SOURCE_CUTOFF_OBSERVED_AT"')
    || !isAuthorizedStableWebuiWriteJob('.github/workflows/release-stable.yml', 'webui-carrier', jobs['webui-carrier'])
    || !isAuthorizedStableWebuiWriteJob('.github/workflows/release-stable.yml', 'webui-promotion', jobs['webui-promotion'])
  ) {
    failures += reportFailure(id, 'Stable Standard must own one exact same-cohort Docker authority, carrier, and promotion chain');
  }
  const admission = jobs.admission;
  const admissionRun = jobRuns(admission);
  if (
    !admission
    || !needsExactly(admission, ['protected-operation-admission'])
    || admission.if !== "${{ always() && inputs.entry == 'framework_release' }}"
    || !exactObject(admission.permissions, exactReadPermissions)
  ) {
    failures += reportFailure(id, 'admission must have only contents:read/actions:read');
  }
  if (workflowMutationCommandPattern.test(admissionRun)) {
    failures += reportFailure(id, 'admission must remain mutation-free');
  }
  if (
    !admissionRun.includes('"opl-release-append-full-operation-checkpoint-v2-$SOURCE_RUN_ID"')
    || admissionRun.includes('"opl-release-append-full-operation-checkpoint-$SOURCE_RUN_ID"')
  ) {
    failures += reportFailure(
      id,
      'Stable admission must accept only the current v2 portable Full operation checkpoint for harness recovery',
    );
  }
  for (const binding of [
    'test "$GITHUB_RUN_ATTEMPT" = 1',
    'actions/runs/$GITHUB_RUN_ID" --jq .created_at',
    'release-operation-deadline.ts resolve',
    '--started-at "$operation_created_at"',
    'operation_started_at="$(jq -er .started_at release-operation-admission.json)"',
    'operation_deadline_at="$(jq -er .deadline_at release-operation-admission.json)"',
  ]) {
    if (!admissionRun.includes(binding)) {
      failures += reportFailure(id, `admission is missing immutable attempt/deadline binding ${binding}`);
    }
  }
  if (/Date\.now\(\).*operation_started_at|operation_started_at=.*date/i.test(admissionRun)) {
    failures += reportFailure(id, 'operation start must come from immutable Actions created_at');
  }
  if (!admissionRun.includes('if [ "$OPERATION" = standard ] || [ "$OPERATION" = resume_standard ] || [ "$OPERATION" = append_full ]; then')) {
    failures += reportFailure(id, 'standard, bounded resume_standard, and append_full operations must resolve their controller window from Actions created_at');
  }

  const studioAdmission = jobs['studio-protected-release-admission'];
  const studioAdmissionRun = jobRuns(studioAdmission);
  const studioAdmissionEvidence = jobEvidenceText(studioAdmission);
  if (
    !studioAdmission
    || studioAdmission.if !== "${{ inputs.entry == 'studio_carrier_admission' }}"
    || Object.prototype.hasOwnProperty.call(studioAdmission, 'needs')
    || studioAdmission.environment !== 'release-stable'
    || !exactObject(studioAdmission.permissions, exactReadPermissions)
  ) {
    failures += reportFailure(
      id,
      'studio-protected-release-admission must remain one initial read-only release-stable source gate',
    );
  }
  if (workflowMutationCommandPattern.test(studioAdmissionRun) || /openssl\s+rand/.test(studioAdmissionRun)) {
    failures += reportFailure(id, 'Studio protected source admission must not perform release or public mutation');
  }
  if (/secrets\./.test(JSON.stringify(studioAdmission)) || /\$\{\{\s*inputs\./.test(studioAdmissionRun)) {
    failures += reportFailure(id, 'Studio protected source admission must not map or read protected secret values');
  }
  for (const binding of [
    'Reject mutable or mixed Studio admission request',
    'test "$GITHUB_EVENT_NAME" = workflow_dispatch',
    'test "$GITHUB_REF" = refs/heads/main',
    '[[ "$STUDIO_SHA" =~ ^[0-9a-f]{40}$ ]]',
    '[[ "$STUDIO_TREE" =~ ^[0-9a-f]{40}$ ]]',
    '"repository":"gaofeng21cn/opl-studio"',
    '"persist-credentials":false',
    'studio-protected-release-admission.ts plan',
    '.public_mutation_authorized == false',
    '.external_mutation_attempted == false',
    'Upload immutable Studio protected admission receipt',
  ]) {
    if (!studioAdmissionEvidence.includes(binding)) {
      failures += reportFailure(id, `Studio protected source admission is missing ${binding}`);
    }
  }

  const studioRelease = jobs['studio-protected-release'];
  if (
    !studioRelease
    || studioRelease.if !== "${{ !cancelled() && inputs.entry == 'studio_carrier_admission' && needs.studio-protected-release-admission.result == 'success' }}"
    || !needsExactly(studioRelease, ['studio-protected-release-admission'])
    || studioRelease.uses !== './.github/workflows/_release-studio.yml'
    || studioRelease.secrets !== 'inherit'
    || !exactObject(studioRelease.permissions, exactReadPermissions)
    || Object.prototype.hasOwnProperty.call(studioRelease, 'steps')
    || studioRelease.with?.app_ref !== '${{ github.sha }}'
    || studioRelease.with?.studio_sha !== '${{ inputs.studio_sha }}'
    || studioRelease.with?.studio_tree !== '${{ inputs.studio_tree }}'
    || studioRelease.with?.studio_tag !== '${{ inputs.studio_tag }}'
    || studioRelease.with?.prior_studio_artifact_run_id !== '${{ inputs.prior_studio_artifact_run_id }}'
  ) {
    failures += reportFailure(
      id,
      'Studio execution must be one step-free reusable call after protected source admission',
    );
  }

  const studioWorkflow = parseWorkflow(appRoot, studioReleaseWorkflowPath, id);
  if (!studioWorkflow) {
    failures += 1;
  } else {
    const releaseJobs = workflowJobs(studioWorkflow.workflow);
    const build = releaseJobs['build-signed-notarized'];
    const resolve = releaseJobs['resolve-checkpoint'];
    const restore = releaseJobs['restore-checkpoint'];
    const qualify = releaseJobs['qualify-checkpoint'];
    const publish = releaseJobs.publish;
    const readback = releaseJobs['public-readback'];
    const buildEvidence = jobEvidenceText(build);
    const restoreEvidence = jobEvidenceText(restore);
    const qualifyEvidence = jobEvidenceText(qualify);
    const publishEvidence = jobEvidenceText(publish);
    const readbackEvidence = jobEvidenceText(readback);
    const releaseEvidence = [buildEvidence, restoreEvidence, qualifyEvidence, publishEvidence, readbackEvidence].join('\n');
    if (
      JSON.stringify(Object.keys(studioWorkflow.workflow.on ?? {})) !== JSON.stringify(['workflow_call'])
      || studioWorkflow.workflow.concurrency !== undefined
      || !exactObject(studioWorkflow.workflow.permissions, exactReadPermissions)
      || studioWorkflow.workflow.on?.workflow_call?.inputs?.prior_studio_artifact_run_id?.type !== 'string'
      || studioWorkflow.workflow.on?.workflow_call?.inputs?.prior_studio_artifact_run_id?.default !== ''
      || JSON.stringify(Object.keys(releaseJobs)) !== JSON.stringify([
        'build-signed-notarized',
        'resolve-checkpoint',
        'restore-checkpoint',
        'qualify-checkpoint',
        'publish',
        'public-readback',
      ])
      || !build
      || build.if !== "${{ inputs.prior_studio_artifact_run_id == '' }}"
      || build.environment !== 'release-stable'
      || !exactObject(build.permissions, exactReadPermissions)
      || build['runs-on'] !== 'macos-15'
      || !resolve
      || !needsExactly(resolve, ['build-signed-notarized'])
      || resolve.outputs?.restore_required !== '${{ steps.resolve.outputs.restore_required }}'
      || !restore
      || !needsExactly(restore, ['resolve-checkpoint'])
      || restore.if !== "${{ always() && needs.resolve-checkpoint.result == 'success' && needs.resolve-checkpoint.outputs.restore_required == 'true' }}"
      || !qualify
      || !needsExactly(qualify, ['resolve-checkpoint', 'restore-checkpoint'])
      || qualify.environment !== "${{ needs.resolve-checkpoint.outputs.terminal_preview == 'true' && 'release-stable' || null }}"
      || qualify['runs-on'] !== "${{ needs.resolve-checkpoint.outputs.terminal_preview == 'true' && fromJSON('[\"self-hosted\",\"macOS\",\"ARM64\",\"opl-cert-mac-tart\"]') || fromJSON('[\"macos-15\"]') }}"
      || resolve.outputs?.terminal_preview !== '${{ steps.terminal.outputs.enabled }}'
      || !qualifyEvidence.includes('scripts/desktop/stable-qualify-preview-upgrade.mjs')
      || !qualifyEvidence.includes('OPL_PREVIEW_UPGRADE_VM_RECEIPT')
      || !publish
      || !needsExactly(publish, ['resolve-checkpoint', 'restore-checkpoint', 'qualify-checkpoint'])
      || publish.environment !== 'release-stable'
      || publish['runs-on'] !== 'ubuntu-latest'
      || !exactObject(publish.permissions, exactReadPermissions)
      || !exactObject(publish.concurrency, { group: 'opl-studio-publication-global', 'cancel-in-progress': false })
      || !readback
      || !needsExactly(readback, ['resolve-checkpoint', 'publish'])
      || readback.if !== "${{ always() && needs.resolve-checkpoint.result == 'success' && needs.publish.result == 'success' }}"
      || readback.environment !== undefined
      || readback['runs-on'] !== 'macos-15'
      || !exactObject(readback.permissions, exactReadPermissions)
    ) {
      failures += reportFailure(id, 'Studio reusable release must expose recoverable build, qualification, thin publication, and independent public readback jobs');
    }
    for (const binding of [
      'scripts/studio-protected-release-admission.ts plan',
      'scripts/verify-apple-release-credentials.ts',
      'scripts/studio-release-checkpoint.ts seal',
      'scripts/studio-release-checkpoint.ts validate-qualification',
      'security import',
      'electron-builder --mac --arm64 --dir',
      'pwd -P',
      'notarytool submit',
      '--prepackaged "$app_path"',
      'scripts/notarize-macos-dmg.ts',
      'scripts/update-electron-updater-metadata.ts',
      '--require-release-trust',
      'gh release create',
      '--latest',
      'releases/latest',
      'git/ref/tags/$STUDIO_TAG',
      '--require-public-feed',
      'latest-arm64-mac.yml',
      '.zip.blockmap',
      'select(.draft == false)',
      'shasum -a 256',
      'public-asset-readback.json',
    ]) {
      if (!releaseEvidence.includes(binding)) {
        failures += reportFailure(id, `Studio protected execution is missing ${binding}`);
      }
    }
    if (
      requestsWritePermission(studioWorkflow.workflow.permissions)
      || Object.values(releaseJobs).some((job) => requestsWritePermission(job.permissions))
      || releaseEvidence.includes('secrets.GITHUB_TOKEN')
      || !JSON.stringify(publish).includes('OPL_GITHUB_RELEASE_ADMIN_TOKEN')
      || JSON.stringify(build).includes('OPL_GITHUB_RELEASE_ADMIN_TOKEN')
      || JSON.stringify(readback).includes('OPL_GITHUB_RELEASE_ADMIN_TOKEN')
      || workflowMutationCommandPattern.test(buildEvidence)
      || workflowMutationCommandPattern.test(qualifyEvidence)
      || workflowMutationCommandPattern.test(readbackEvidence)
      || /notarytool\s+submit/.test(publishEvidence)
      || !/gh\s+release\s+create/.test(publishEvidence)
      || !/gh\s+release\s+upload/.test(publishEvidence)
      || !/--clobber/.test(publishEvidence)
      || !releaseEvidence.includes('gaofeng21cn/opl-studio')
    ) {
      failures += reportFailure(id, 'Studio public mutation must remain isolated in one protected same-tag-capable job while build, qualification, and readback stay mutation-free');
    }
  }

  failures += validateStudioFullAppendTopology(appRoot, id, jobs);

  const protectedAdmission = jobs['protected-operation-admission'];
  const protectedAdmissionRun = jobRuns(protectedAdmission);
  const protectedAdmissionEvidence = jobEvidenceText(protectedAdmission);
  if (
    !protectedAdmission
    || protectedAdmission.if !== "${{ inputs.entry == 'framework_release' && inputs.operation == 'standard' }}"
    || Object.prototype.hasOwnProperty.call(protectedAdmission, 'needs')
    || protectedAdmission.environment !== 'release-stable'
    || !exactObject(protectedAdmission.permissions, exactReadPermissions)
  ) {
    failures += reportFailure(
      id,
      'protected-operation-admission must be the initial read-only protected Standard gate',
    );
  }
  if (workflowMutationCommandPattern.test(protectedAdmissionRun)) {
    failures += reportFailure(id, 'protected-operation-admission must not perform release or public mutation');
  }
  for (const binding of [
    'Reject bare or rerun Stable request before expensive work',
    'test "$GITHUB_EVENT_NAME" = workflow_dispatch',
    'test -n "$AUTHORITY_ID"',
    'test -n "$OPERATION_ID"',
    'test -n "$AUTHORITY_CARRIER"',
    '[[ "$AUTHORITY_DIGEST" =~ ^sha256:[0-9a-f]{64}$ ]]',
    'stable-operation-control.ts decode-carrier',
    'stable-operation-control.ts materialize-evidence',
    'stable-operation-control.ts verify-executor',
    'stable-operation-control.ts verify-authority',
    '--app-root app-executor --expected-actor "$GITHUB_ACTOR"',
    'Checkout frozen App authority cohort',
    'release-dispatch-guard.ts verify-evidence',
    'release-dispatch-guard.ts preflight',
    '--current-run-id "$GITHUB_RUN_ID"',
    '--authority-id',
    'stable-operation-control.ts bind',
    'stable-operation-control.ts verify',
    'Upload immutable operation control evidence',
    'opl-stable-operation-control-${{ github.run_id }}',
  ]) {
    if (!protectedAdmissionEvidence.includes(binding)) {
      failures += reportFailure(id, `protected-operation-admission is missing immutable authority binding ${binding}`);
    }
  }
  if (
    protectedAdmissionRun.includes('node --experimental-strip-types app-source/scripts/validate-release-source-gate.ts')
    || (protectedAdmissionRun.match(/release-dispatch-guard\.ts verify-evidence/g) ?? []).length !== 1
    || (protectedAdmissionRun.match(/release-dispatch-guard\.ts preflight/g) ?? []).length !== 1
  ) {
    failures += reportFailure(
      id,
      'protected-operation-admission must verify the frozen pre-submit evidence once and create exactly one distinct run-authority reconcile without rerunning the full source gate.',
    );
  }
  if (/openssl rand|operation_id="stable-\$\{?GITHUB_RUN_ID\}?"|stable-operation-control\.ts create(?:\s|$)/.test(protectedAdmissionRun)) {
    failures += reportFailure(id, 'protected-operation-admission must not self-issue an authority, nonce, or operation id');
  }
  if (/\$\{\{\s*inputs\./.test(protectedAdmissionRun)) {
    failures += reportFailure(id, 'protected-operation-admission must consume dispatch strings through quoted environment variables');
  }
  const protectedOutputs = protectedAdmission?.outputs ?? {};
  for (const [name, expected] of Object.entries({
    app_ref: '${{ steps.control.outputs.app_ref }}',
    shell_ref: '${{ steps.control.outputs.shell_ref }}',
    framework_ref: '${{ steps.control.outputs.framework_ref }}',
    operation_id: '${{ steps.control.outputs.operation_id }}',
    control_digest: '${{ steps.control.outputs.control_digest }}',
    authority_id: '${{ steps.authority.outputs.authority_id }}',
  })) {
    if (protectedOutputs[name] !== expected) {
      failures += reportFailure(id, `protected-operation-admission must bind ${name} to the decoded authority control`);
    }
  }

  const stableManifest = jobs['stable-admission-manifest'];
  const stableManifestRun = jobRuns(stableManifest);
  if (
    !stableManifest
    || stableManifest.if !== "${{ needs.admission.outputs.operation == 'standard' }}"
    || !needsExactly(stableManifest, ['admission', 'protected-operation-admission'])
    || stableManifest.environment !== 'release-stable'
    || !exactObject(stableManifest.permissions, exactReadPermissions)
  ) {
    failures += reportFailure(id, 'stable-admission-manifest must be a protected post-source-gate identity seal');
  }
  for (const binding of [
    'scripts/verify-apple-release-credentials.ts',
    'scripts/stable-operation-control.ts verify',
    '--run-authority-reconcile',
    'scripts/stable-release-admission-manifest.ts create',
    '--admission-run-id "$GITHUB_RUN_ID"',
    'opl-stable-admission-${{ github.run_id }}',
  ]) {
    if (!stableManifestRun.includes(binding) && !text.includes(binding)) {
      failures += reportFailure(id, `stable-admission-manifest is missing protected binding ${binding}`);
    }
  }
  failures += validateStableOperationControlArtifactConsumer(appRoot);

  for (const [jobId, spec] of Object.entries(stableEntrySpecs)) {
    const job = jobs[jobId];
    if (!job) continue;
    if (!needsExactly(job, [...spec.needs]) || job.if !== spec.if) {
      failures += reportFailure(id, `${jobId} must be selected only by the admitted ${spec.operation} operation`);
    }
    if (job.uses !== spec.workflow || Object.prototype.hasOwnProperty.call(job, 'steps')) {
      failures += reportFailure(id, `${jobId} must be a step-free call to ${spec.workflow}`);
    }
    if (!exactObject(job.permissions, spec.permissions)) {
      failures += reportFailure(
        id,
        jobId === 'standard'
          ? 'standard permissions must be exactly contents:write/actions:read/packages:read without packages:write'
          : `${jobId} permissions must be exactly contents:write/actions:read without packages:write`,
      );
    }
    if (job.secrets !== 'inherit') {
      failures += reportFailure(id, `${jobId} must pass release secrets only through the reusable boundary`);
    }
    const withInputs = job.with && typeof job.with === 'object'
      ? job.with as Record<string, unknown>
      : {};
    for (const [name, expected] of Object.entries(spec.requiredInputs)) {
      if (withInputs[name] !== expected) {
        failures += reportFailure(id, `${jobId} must bind ${name} to the admitted value`);
      }
    }
    if (Object.keys(withInputs).some((name) => retiredLiveAuthorityPattern.test(name))) {
      failures += reportFailure(id, `${jobId} must not forward broker/session/lease inputs`);
    }
  }
  return failures;
}

function validateReusableCall(
  id: string,
  jobs: Record<string, Record<string, any>>,
  jobId: string,
  workflowPath: string,
  expectedPermissions?: Record<string, unknown>,
): number {
  const job = jobs[jobId];
  if (!job || job.uses !== workflowPath || Object.prototype.hasOwnProperty.call(job, 'steps')) {
    return reportFailure(id, `${jobId} must be a step-free call to ${workflowPath}`);
  }
  if (expectedPermissions && !exactObject(job.permissions, expectedPermissions)) {
    return reportFailure(id, `${jobId} has broader or incomplete permissions`);
  }
  return 0;
}

function validateReusablePermissionInheritance(
  id: string,
  name: string,
  workflow: Record<string, any>,
  inheritedMutationJobs: string[],
): number {
  let failures = 0;
  if (workflow.permissions !== undefined) {
    failures += reportFailure(
      id,
      `${name} must inherit its caller permission ceiling so read-only Canary and Stable use the same graph`,
    );
  }
  const mutationJobs = new Set(inheritedMutationJobs);
  for (const [jobId, job] of Object.entries(workflowJobs(workflow))) {
    if (mutationJobs.has(jobId)) {
      if (job.permissions !== undefined) {
        failures += reportFailure(
          id,
          `${name}:${jobId} must inherit the admitted caller permission instead of statically requesting write`,
        );
      }
      continue;
    }
    const expectedPermissions = name === 'bundle' && jobId === 'webui-qualify'
      ? { contents: 'read', actions: 'read', packages: 'read' }
      : exactReadPermissions;
    if (!exactObject(job.permissions, expectedPermissions)) {
      failures += reportFailure(
        id,
        jobId === 'webui-qualify'
          ? `${name}:${jobId} must remain packages:read for qualify-only`
          : `${name}:${jobId} must explicitly downgrade to contents:read/actions:read`,
      );
    }
  }
  return failures;
}

export function validateReleaseBundleTopology(appRoot: string): number {
  const id = 'release_bundle_topology';
  const bundle = parseWorkflow(appRoot, '.github/workflows/_release-bundle.yml', id);
  const standard = parseWorkflow(appRoot, '.github/workflows/_release-standard-publish.yml', id);
  const full = parseWorkflow(appRoot, '.github/workflows/_release-full-addon.yml', id);
  if (!bundle || !standard || !full) return [bundle, standard, full].filter((value) => !value).length;
  let failures = 0;

  for (const [name, parsed] of Object.entries({ bundle, standard, full })) {
    if (JSON.stringify(Object.keys(parsed.workflow.on ?? {})) !== JSON.stringify(['workflow_call'])) {
      failures += reportFailure(id, `${name} workflow must expose only workflow_call`);
    }
    if (retiredLiveAuthorityPattern.test(parsed.text)) {
      failures += reportFailure(id, `${name} workflow still depends on retired broker/session/lease authority`);
    }
    if (parsed.workflow.on?.workflow_call?.inputs?.mode !== undefined || parsed.workflow.jobs?.['startup-canary']) {
      failures += reportFailure(id, `${name} workflow must not retain the retired reusable Canary control plane`);
    }
  }
  failures += validateReusablePermissionInheritance(
    id,
    'bundle',
    bundle.workflow,
    ['publish-standard'],
  );
  failures += validateReusablePermissionInheritance(
    id,
    'standard',
    standard.workflow,
    ['publish-standard-nonlatest', 'activate-latest'],
  );
  failures += validateReusablePermissionInheritance(id, 'full', full.workflow, ['publish-full']);

  const bundleJobs = workflowJobs(bundle.workflow);
  if (JSON.stringify(Object.keys(bundleJobs)) !== JSON.stringify([
    'resolve-platform-matrix',
    'admission',
    'freeze',
    'webui-source-authority',
    'webui-qualify',
    'prepare-standard-vm-inputs',
    'standard-build',
    'seal-standard-identity',
    'full-candidate',
    'standard-clean-vm-qualification',
    'checkpoint-standard',
    'publish-standard',
  ])) {
    failures += reportFailure(id, 'Bundle jobs must contain only the single Desktop Standard publication topology');
  }
  if (bundle.workflow.on?.workflow_call?.inputs?.operation?.default !== 'standard') {
    failures += reportFailure(id, 'Bundle workflow operation must be standard');
  }
  if (
    !bundle.text.includes('stable:stable|preview:preview')
    || /nightly:nightly|resolveNightlyReleaseVersion|nightly-operation-request/.test(bundle.text)
  ) {
    failures += reportFailure(
      id,
      'Bundle execute mode must admit Stable or Manual Preview while excluding scheduled Nightly allocation',
    );
  }
  for (const [jobId, command] of [
    ['freeze', 'opl release freeze'],
    ['checkpoint-standard', 'opl release build'],
    ['checkpoint-standard', 'opl release checkpoint export'],
  ]) {
    if (!jobRuns(bundleJobs[jobId]).includes(command)) {
      failures += reportFailure(id, `_release-bundle.yml ${jobId} is missing ${command}`);
    }
  }
  failures += validateReusableCall(id, bundleJobs, 'standard-build', './.github/workflows/_build-reusable.yml');
  failures += validateReusableCall(
    id,
    bundleJobs,
    'webui-qualify',
    './.github/workflows/_release-webui-carrier.yml',
    { contents: 'read', actions: 'read', packages: 'read' },
  );
  failures += validateReusableCall(
    id,
    bundleJobs,
    'full-candidate',
    './.github/workflows/full-first-install-release.yml',
    exactReadPermissions,
  );
  const webuiQualify = bundleJobs['webui-qualify'];
  if (
    !webuiQualify
    || webuiQualify.with?.mode !== 'qualify-only'
    || webuiQualify.with?.authority_mode !== 'independent_stable'
    || webuiQualify['continue-on-error'] !== undefined
    || !needsExactly(webuiQualify, ['freeze', 'webui-source-authority'])
    || webuiQualify.secrets !== 'inherit'
  ) {
    failures += reportFailure(id, 'webui-qualify must run qualify-only after freeze without GHCR write');
  }
  const webuiBuilder = parseWorkflow(appRoot, '.github/workflows/_release-webui-carrier.yml', id);
  const webuiBuild = webuiBuilder?.workflow?.jobs?.['build-and-qualify'];
  const webuiReceipt = webuiBuilder?.workflow?.jobs?.['qualify-receipt'];
  if (
    !webuiBuild
    || webuiBuild['continue-on-error'] !== "${{ inputs.mode == 'qualify-only' }}"
    || !webuiReceipt
    || webuiReceipt.if !== "${{ always() && inputs.mode == 'qualify-only' }}"
    || !needsExactly(webuiReceipt, ['build-and-qualify'])
  ) {
    failures += reportFailure(
      id,
      'qualify-only WebUI isolation must continue-on-error on the inner builder and emit an explicit receipt',
    );
  }
  const fullCandidate = bundleJobs['full-candidate'];
  if (
    !fullCandidate
    || fullCandidate.with?.candidate_only !== true
    || fullCandidate.with?.upload_full_package_artifact !== true
    || fullCandidate.with?.target_standard_release_id
    || fullCandidate['continue-on-error'] !== undefined
    || fullCandidate.if !== "${{ always() && inputs.include_full && inputs.channel == 'stable' && needs.freeze.result == 'success' && needs.seal-standard-identity.result == 'success' }}"
    || !needsExactly(fullCandidate, ['freeze', 'seal-standard-identity'])
    || fullCandidate.secrets !== 'inherit'
  ) {
    failures += reportFailure(id, 'legacy full-candidate must run only when explicitly requested and build signed bytes after Standard identity without public Release mutation');
  }
  const candidateBuilder = parseWorkflow(appRoot, '.github/workflows/full-first-install-release.yml', id);
  const candidateJob = candidateBuilder?.workflow?.jobs?.['full-first-install'];
  if (
    !candidateJob
    || candidateJob['continue-on-error'] !== '${{ inputs.candidate_only }}'
    || candidateJob['runs-on'] !== 'macos-latest'
    || Array.isArray(candidateJob.steps) === false
  ) {
    failures += reportFailure(
      id,
      'candidate-only Full isolation must continue-on-error on the regular inner builder, not the reusable caller',
    );
  }
  const sealStandardIdentity = bundleJobs['seal-standard-identity'];
  if (
    !sealStandardIdentity
    || !needsExactly(sealStandardIdentity, ['freeze', 'standard-build'])
    || !exactObject(sealStandardIdentity.permissions, exactReadPermissions)
    || !Array.isArray(sealStandardIdentity.steps)
    || !jobRuns(sealStandardIdentity).includes('bind-standard-release-track.ts')
    || !jobRuns(sealStandardIdentity).includes('standard_identity_sha256')
  ) {
    failures += reportFailure(
      id,
      'seal-standard-identity must bind the signed build to one immutable read-only identity',
    );
  }
  if (bundleJobs['standard-qualification'] || /\bopl\s+release\s+verify\b/.test(jobRuns(bundleJobs['checkpoint-standard']))) {
    failures += reportFailure(
      id,
      'Bundle publication must consume sealed identity without reintroducing the retired inline qualification gate',
    );
  }
  failures += validateReusableCall(
    id,
    bundleJobs,
    'standard-clean-vm-qualification',
    './.github/workflows/opl-first-run-vm.yml',
    exactReadPermissions,
  );
  const standardCleanVm = bundleJobs['standard-clean-vm-qualification'];
  if (
    !standardCleanVm
    || !needsExactly(standardCleanVm, ['freeze', 'seal-standard-identity', 'prepare-standard-vm-inputs'])
    || standardCleanVm.if !== "${{ always() && inputs.channel == 'stable' && needs.freeze.result == 'success' && needs.seal-standard-identity.result == 'success' }}"
    || Object.prototype.hasOwnProperty.call(standardCleanVm, 'continue-on-error')
    || standardCleanVm.with?.release_artifact_name !==
      '${{ needs.seal-standard-identity.outputs.standard_vm_artifact_name }}'
    || standardCleanVm.with?.release_artifact_run_id !==
      '${{ needs.seal-standard-identity.outputs.standard_artifact_run_id }}'
    || standardCleanVm.with?.package_profile !== 'standard'
    || standardCleanVm.with?.diagnostic_scope !== 'release_gate'
    || standardCleanVm.with?.require_macos_gatekeeper !== true
    || standardCleanVm.secrets !== 'inherit'
  ) {
    failures += reportFailure(
      id,
      'Standard clean-install qualification must consume the exact sealed candidate before publication',
    );
  }
  failures += validateReusableCall(
    id,
    bundleJobs,
    'publish-standard',
    './.github/workflows/_release-standard-publish.yml',
  );
  if (!hasStableMutationMutex(bundleJobs['publish-standard'])) {
    failures += reportFailure(
      id,
      'publish-standard must acquire the public mutation mutex after build and qualification',
    );
  }
  if (
    !needsExactly(bundleJobs['checkpoint-standard'], [
      'admission',
      'freeze',
      'seal-standard-identity',
      'standard-clean-vm-qualification',
    ])
    || !needsExactly(bundleJobs['publish-standard'], [
      'freeze',
      'checkpoint-standard',
    ])
  ) {
    failures += reportFailure(id, 'Standard checkpoint must require protected clean-VM qualification before publication');
  }
  if (/\bopl\s+release\s+(?:publish|reconcile|status)\b/.test(bundle.text)) {
    failures += reportFailure(id, '_release-bundle.yml must delegate publish/reconcile/status to Standard publish');
  }
  const standardJobs = workflowJobs(standard.workflow);
  if (
    standardJobs['nightly-terminal']
    || !standard.text.includes('reason=unsupported_publication_channel')
    || !standard.text.includes('preview)')
    || standard.text.includes('nightly)')
  ) {
    failures += reportFailure(
      id,
      'Standard publisher must admit only Stable or Manual Preview checkpoints and expose no scheduled Nightly terminal',
    );
  }
  for (const command of ['opl release publish', 'opl release reconcile', 'opl release status']) {
    if (!standard.text.includes(command)) {
      failures += reportFailure(id, `_release-standard-publish.yml is missing ${command}`);
    }
  }
  if (/\bopl\s+release\s+(?:freeze|build|verify)\b/.test(standard.text)) {
    failures += reportFailure(id, '_release-standard-publish.yml must not rebuild or reverify Bundle bytes');
  }
  for (const retiredInlineVmJob of [
    'updater-upgrade-qualification',
    'updater-upgrade-qualification-highest',
    'homebrew-standard-vm',
  ]) {
    if (standardJobs[retiredInlineVmJob]) {
      failures += reportFailure(
        id,
        `_release-standard-publish.yml must not restore retired inline VM job ${retiredInlineVmJob}`,
      );
    }
  }
  for (const jobId of [
    'publish-standard-nonlatest',
    'activate-latest',
  ]) {
    if (!standardJobs[jobId]) failures += reportFailure(id, `_release-standard-publish.yml is missing ${jobId}`);
  }
  for (const retiredInlineHomebrewJob of [
    'publish-homebrew-standard',
    'homebrew-standard-readback',
  ]) {
    if (standardJobs[retiredInlineHomebrewJob]) {
      failures += reportFailure(
        id,
        `_release-standard-publish.yml must not retain blocking Homebrew job ${retiredInlineHomebrewJob}`,
      );
    }
  }
  if (
    !needsExactly(standardJobs['activate-latest'], ['restore', 'remote-digest-verify'])
    || !String(standardJobs['activate-latest']?.if ?? '').includes("needs.restore.outputs.channel != 'stable'")
    || !String(standardJobs['remote-digest-verify']?.if ?? '').includes("needs.restore.outputs.channel != 'stable'")
    || !jobEvidenceText(standardJobs['publish-standard-nonlatest']).includes('Read back exact remote Standard digests')
    || !jobEvidenceText(standardJobs['publish-standard-nonlatest']).includes('Activate Latest after exact remote parity')
    || !jobRuns(standardJobs['remote-digest-verify']).includes('homebrew-standard-handoff.json')
    || /OPL_HOMEBREW_TAP_TOKEN|git -C tap-source push/.test(standard.text)
  ) {
    failures += reportFailure(
      id,
      'Standard Release and Latest must emit a handoff without depending on or writing Homebrew',
    );
  }
  const expectedStandardMutationEnvironments = {
    'publish-standard-nonlatest':
      "${{ needs.restore.outputs.channel == 'stable' && 'release-stable' || 'release-preview' }}",
    'activate-latest': 'release-preview-latest',
  };
  for (const [jobId, expectedEnvironment] of Object.entries(expectedStandardMutationEnvironments)) {
    const job = standardJobs[jobId];
    if (job && job.environment !== expectedEnvironment) {
      failures += reportFailure(
        id,
        `${jobId} must select the exact Stable or protected Preview environment`,
      );
    }
  }

  const fullJobs = workflowJobs(full.workflow);
  if (full.workflow.on?.workflow_call?.inputs?.operation?.default !== 'append_full') {
    failures += reportFailure(id, 'Full add-on workflow operation must be append_full');
  }
  for (const jobId of [
    'restore-standard',
    'full-build',
    'full-qualification',
    'full-clean-vm-qualification',
    'checkpoint-full',
    'publish-full',
    'publish-homebrew-full',
  ]) {
    if (!fullJobs[jobId]) failures += reportFailure(id, `_release-full-addon.yml is missing ${jobId}`);
  }
  for (const retiredJobId of ['homebrew-full-vm', 'homebrew-full-readback']) {
    if (fullJobs[retiredJobId]) {
      failures += reportFailure(id, `_release-full-addon.yml must not retain ${retiredJobId}`);
    }
  }
  failures += validateReusableCall(
    id,
    fullJobs,
    'publish-homebrew-full',
    './.github/workflows/_release-homebrew-full-publish.yml',
    exactReadPermissions,
  );
  if (
    !needsExactly(fullJobs['publish-homebrew-full'], ['publish-full'])
    || fullJobs['publish-homebrew-full']?.secrets !== 'inherit'
  ) {
    failures += reportFailure(id, 'Full owner must publish Homebrew Full through the existing reusable after publish-full');
  }
  if (fullJobs['full-build']) {
    failures += validateReusableCall(
      id,
      fullJobs,
      'full-build',
      './.github/workflows/full-first-install-release.yml',
      exactReadPermissions,
    );
  }
  const restoreStandard = fullJobs['restore-standard'];
  const restoreStandardRuns = jobRuns(restoreStandard);
  const originalFullCohortDownload = fullJobs['materialize-full-build']?.steps?.find(
    (step: Record<string, unknown>) => step.name === 'Download original Full build cohort identity',
  );
  if (
    restoreStandard?.outputs?.full_artifact_producer_run_id
      !== '${{ steps.operation.outputs.full_artifact_producer_run_id }}'
    || !restoreStandardRuns.includes('opl_release_bundle_executor_receipt.v1')
    || !restoreStandardRuns.includes('.bundle_digest == $bundle')
    || !restoreStandardRuns.includes('.track == "full"')
    || !restoreStandardRuns.includes('.release_operation == "append_full"')
    || !restoreStandardRuns.includes('A completed Full build checkpoint must contain its executor receipt')
    || originalFullCohortDownload?.with?.['run-id']
      !== '${{ needs.restore-standard.outputs.full_artifact_producer_run_id }}'
  ) {
    failures += reportFailure(
      id,
      'Full checkpoint recovery must derive the original artifact producer run from its Bundle-bound build receipt',
    );
  }
  if (fullJobs['full-qualification']) {
    const fullQualification = fullJobs['full-qualification'];
    const qualificationRuns = jobRuns(fullQualification);
    if (
      fullQualification['runs-on'] !== 'macos-latest'
      || fullQualification.uses !== undefined
      || !needsExactly(fullQualification, ['restore-standard', 'full-build', 'materialize-full-build'])
      || !exactObject(fullQualification.permissions, exactReadPermissions)
      || !Array.isArray(fullQualification.steps)
      || !qualificationRuns.includes('hdiutil attach "$dmg_path" -nobrowse -readonly')
      || !qualificationRuns.includes('codesign --verify --deep --strict')
      || !qualificationRuns.includes('xcrun stapler validate')
      || !qualificationRuns.includes('spctl --assess')
      || !qualificationRuns.includes('opl_app_hosted_full_core_qualification.v1')
      || /opl-first-run-vm|tart\\b/i.test(qualificationRuns)
    ) {
      failures += reportFailure(
        id,
        'full-qualification must be a GitHub-hosted read-only exact Full trust qualification with no VM or Tart dependency',
      );
    }
  }
  failures += validateReusableCall(
    id,
    fullJobs,
    'full-clean-vm-qualification',
    './.github/workflows/opl-first-run-vm.yml',
    exactReadPermissions,
  );
  const fullCleanVm = fullJobs['full-clean-vm-qualification'];
  if (
    !fullCleanVm
    || !needsExactly(fullCleanVm, [
      'restore-standard',
      'full-build',
      'materialize-full-build',
      'prepare-full-vm-inputs',
    ])
    || fullCleanVm.with?.release_artifact_run_id !== '${{ needs.materialize-full-build.outputs.artifact_producer_run_id || github.run_id }}'
    || fullCleanVm.with?.verification_app_ref !== '${{ inputs.verification_app_ref || inputs.full_content_app_ref }}'
    || fullCleanVm.with?.smoke_harness_ref !== '${{ inputs.smoke_harness_ref || inputs.full_content_shell_ref }}'
    || fullCleanVm.with?.package_profile !== 'full'
    || fullCleanVm.with?.diagnostic_scope !== 'release_gate'
    || fullCleanVm.with?.require_macos_gatekeeper !== true
    || fullCleanVm.secrets !== 'inherit'
  ) {
    failures += reportFailure(
      id,
      'Full clean-VM qualification must parallel hosted validation after a verified build and consume the exact original Full artifact run',
    );
  }
  const checkpointFullRuns = jobRuns(fullJobs['checkpoint-full']);
  if (
    !checkpointFullRuns.includes('--hosted-core-qualification "$hosted_receipt"')
    || !checkpointFullRuns.includes('full-clean-vm-qualification-receipt.json')
    || !checkpointFullRuns.includes('standard-clean-vm-qualification-receipt.json')
    || !checkpointFullRuns.includes("--arg source_artifact_run_id '${{ needs.materialize-full-build.outputs.artifact_producer_run_id || github.run_id }}'")
    || !checkpointFullRuns.includes('.qualification.source_artifact_run_id == $source_artifact_run_id')
    || checkpointFullRuns.includes('--legacy-qualification')
  ) {
    failures += reportFailure(
      id,
      'checkpoint-full must consume hosted Full trust plus Standard and Full protected clean-VM sidecars',
    );
  }
  if (fullJobs['publish-full'] && fullJobs['publish-full'].environment !== 'release-stable') {
    failures += reportFailure(id, 'publish-full must use the release-stable environment');
  }
  if (!hasStableMutationMutex(fullJobs['publish-full'])) {
    failures += reportFailure(
      id,
      'publish-full must acquire the public mutation mutex only after Full qualification',
    );
  }
  if (standardUpdaterOrLatest(full.text)) {
    failures += reportFailure(id, 'append_full must not qualify Standard updater or activate Latest');
  }
  if (/update-homebrew-tap|OPL_HOMEBREW_TAP_TOKEN|tap-source|Casks\/one-person-lab\.rb|git\b[^\n]*\bpush\b/.test(full.text)) {
    failures += reportFailure(id, 'append_full must not directly mutate Homebrew or touch the Standard Cask');
  }
  for (const required of [
    'opl_homebrew_full_follower_handoff.v1',
    'homebrew_modified:false',
    'latest_modified:false',
    'completed_stage:"full_qualified"',
    'qualification_receipt_sha256',
    'operation_control',
    'operation_id',
    'operation_started_at',
    'operation_deadline_at',
  ]) {
    if (!full.text.includes(required)) failures += reportFailure(id, `append_full handoff is missing ${required}`);
  }
  return failures;
}

import fs from 'node:fs';
import path from 'node:path';
import { parse as parseYaml } from 'yaml';
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
  isAuthorizedFullAddonFollowerWriteJob,
  isAuthorizedStableDesktopFollowupWriteJob,
} from './workflow-policy.ts';
import {
  workflowMutationCommandPattern,
  retiredLiveAuthorityPattern,
  standardUpdaterOrLatest,
} from './mutation-policy.ts';
import { validateExactActionPins } from './workflow-policy.ts';

export function validateStableFollowupTopology(appRoot: string): number {
  const id = 'stable_followup_topology';
  const hub = parseWorkflow(appRoot, stableFollowupWorkflowPath, id);
  const actions = Object.fromEntries(
    Object.entries(stableFollowupActionPaths).map(([name, relativePath]) => [
      name,
      parseWorkflow(appRoot, relativePath, id),
    ]),
  ) as Record<keyof typeof stableFollowupActionPaths, ReturnType<typeof parseWorkflow>>;
  const desktopPlatformAddon = parseWorkflow(appRoot, desktopPlatformAddonWorkflowPath, id);
  const optionalCertification = parseWorkflow(
    appRoot,
    postPublicationOptionalCertificationWorkflowPath,
    id,
  );
  const optionalCertificationVm = parseWorkflow(
    appRoot,
    '.github/workflows/opl-first-run-vm.yml',
    id,
  );
  const missing = [
    hub,
    ...Object.values(actions),
    desktopPlatformAddon,
    optionalCertification,
    optionalCertificationVm,
  ].filter((value) => !value).length;
  if (missing > 0 || !hub || !desktopPlatformAddon || !optionalCertification || !optionalCertificationVm) {
    return missing;
  }

  let failures = 0;
  const triggers = hub.workflow.on ?? {};
  const dispatchInputs = triggers.workflow_dispatch?.inputs ?? {};
  const expectedDispatchInputs = [
    'desktop_platform',
    'expected_old_asset_digest',
    'expected_old_asset_id',
    'operation',
    'operator_confirmation',
    'repair_source_commit',
    'smoke_harness_ref',
    'source_run_id',
  ];
  const expectedOperations = [
    'reconcile_full_addon',
    'reconcile_homebrew_standard',
    'reconcile_homebrew_full',
    'reconcile_desktop_platform',
    'repair_additive',
  ];
  const jobs = workflowJobs(hub.workflow);
  const expectedJobs = [
    'admit',
    'observe',
    'publish-homebrew-full',
    'publish-standard-cask',
    'receipt',
    'reconcile-desktop-platforms',
    'reconcile-full-addon',
    'repair-additive',
    'repair-admit',
    'resolve-homebrew-full',
    'route',
  ];
  if (
    JSON.stringify(Object.keys(triggers).sort()) !== JSON.stringify(['workflow_call', 'workflow_dispatch', 'workflow_run'])
    || JSON.stringify(triggers.workflow_run?.workflows) !== JSON.stringify(['OPL Stable Release Bundle'])
    || JSON.stringify(triggers.workflow_run?.types) !== JSON.stringify(['completed'])
    || JSON.stringify(Object.keys(dispatchInputs).sort()) !== JSON.stringify(expectedDispatchInputs)
    || JSON.stringify(dispatchInputs.operation?.options) !== JSON.stringify(expectedOperations)
    || !exactObject(hub.workflow.permissions, exactReadPermissions)
    || hub.workflow.concurrency !== undefined
    || JSON.stringify(Object.keys(jobs).sort()) !== JSON.stringify(expectedJobs)
  ) {
    failures += reportFailure(
      id,
      'Stable follow-ups must expose one automatic/manual hub with only the five independent additive operations',
    );
  }

  const route = jobs.route;
  if (
    !route
    || route['runs-on'] !== 'ubuntu-latest'
    || route['timeout-minutes'] !== 10
    || Object.prototype.hasOwnProperty.call(route, 'needs')
    || requestsWritePermission(route.permissions)
    || !jobRuns(route).includes('stable-followup-router.ts')
  ) {
    failures += reportFailure(id, 'Stable follow-up routing must be one read-only typed decision job');
  }

  const observe = jobs.observe;
  const standard = jobs['publish-standard-cask'];
  const resolveFull = jobs['resolve-homebrew-full'];
  const publishFull = jobs['publish-homebrew-full'];
  if (
    !observe
    || observe.if !== "${{ needs.route.outputs.observe == 'true' }}"
    || !needsExactly(observe, ['route'])
    || !exactObject(observe.permissions, exactReadPermissions)
    || !hasLocalStep(observe, localActionUse(stableFollowupActionPaths.observe))
    || !standard
    || standard.if !== "${{ needs.route.outputs.homebrew_standard == 'true' }}"
    || !needsExactly(standard, ['route'])
    || standard.environment !== 'release-stable'
    || !exactObject(standard.permissions, exactReadPermissions)
    || !exactObject(standard.concurrency, {
      group: 'opl-homebrew-standard-${{ needs.route.outputs.source_run_id }}',
      'cancel-in-progress': false,
    })
    || !hasLocalStep(standard, localActionUse(stableFollowupActionPaths.homebrewStandard))
    || !resolveFull
    || resolveFull.if !== "${{ needs.route.outputs.homebrew_full == 'true' }}"
    || !needsExactly(resolveFull, ['route'])
    || !exactObject(resolveFull.permissions, exactReadPermissions)
    || !hasLocalStep(resolveFull, localActionUse(stableFollowupActionPaths.homebrewFullHandoff))
    || !publishFull
    || !needsExactly(publishFull, ['resolve-homebrew-full'])
    || publishFull.uses !== './.github/workflows/_release-homebrew-full-publish.yml'
    || !exactObject(publishFull.permissions, exactReadPermissions)
    || publishFull.secrets !== 'inherit'
    || Object.prototype.hasOwnProperty.call(publishFull, 'steps')
  ) {
    failures += reportFailure(
      id,
      'Stable observation and Homebrew lanes must be mutually routed leaves with no second public entry',
    );
  }
  if (!isAuthorizedFullAddonFollowerWriteJob(stableFollowupWorkflowPath, 'reconcile-full-addon', jobs['reconcile-full-addon'])) {
    failures += reportFailure(id, 'Stable Full reconciliation must be one source-bound controller action');
  }
  if (
    !isAuthorizedStableDesktopFollowupWriteJob(
      stableFollowupWorkflowPath,
      'reconcile-desktop-platforms',
      jobs['reconcile-desktop-platforms'],
    )
    || !isAuthorizedStableDesktopFollowupWriteJob(
      stableFollowupWorkflowPath,
      'repair-additive',
      jobs['repair-additive'],
    )
  ) {
    failures += reportFailure(
      id,
      'Stable Desktop and additive repair writes must remain isolated protected leaves',
    );
  }
  if (
    jobs.admit?.if !== "${{ needs.route.outputs.desktop_platforms == 'true' }}"
    || !needsExactly(jobs.admit, ['route'])
    || jobs['repair-admit']?.if !== "${{ needs.route.outputs.repair_additive == 'true' }}"
    || !needsExactly(jobs['repair-admit'], ['route'])
  ) {
    failures += reportFailure(id, 'Stable Desktop and repair admission must be selected only by the typed router');
  }

  const observeAction = actions.observe;
  const fullAddonAction = actions.fullAddon;
  const homebrewStandardAction = actions.homebrewStandard;
  const homebrewFullAction = actions.homebrewFullHandoff;
  if (
    !observeAction || !fullAddonAction || !homebrewStandardAction || !homebrewFullAction
    || observeAction.workflow.runs?.using !== 'composite'
    || fullAddonAction.workflow.runs?.using !== 'composite'
    || homebrewStandardAction.workflow.runs?.using !== 'composite'
    || homebrewFullAction.workflow.runs?.using !== 'composite'
  ) {
    failures += reportFailure(id, 'Every Stable follower implementation leaf must be a local composite action');
  } else {
    for (const [name, action] of Object.entries(actions)) {
      if (!action) continue;
      failures += validateExactActionPins(
        stableFollowupActionPaths[name as keyof typeof stableFollowupActionPaths],
        'composite',
        actionSteps(action.workflow),
      );
    }
    for (const required of [
      'release-attempt-observability.ts',
      'opl-release-attempt-observation-${{ inputs.source_run_id }}',
    ]) {
      if (!observeAction.text.includes(required)) {
        failures += reportFailure(id, `Stable observation leaf is missing ${required}`);
      }
    }
    for (const required of [
      'RECONCILE_CONFIRMATION: reconcile_full_addon',
      'opl-release-standard-checkpoint-$SOURCE_RUN_ID',
      'opl-release-standard-operation-checkpoint-$SOURCE_RUN_ID',
      'stable-release-dispatch.ts',
      'append-full',
      '--execute',
      'published|owner_identified|dispatched',
      '.plan.source.run_id',
      'waits_for_owner_completion:false',
      'opl_app_full_addon_follower.v1',
    ]) {
      if (!fullAddonAction.text.includes(required)) {
        failures += reportFailure(id, `Stable Full action is missing ${required}`);
      }
    }
    if (
      /failed_(?:follower|recovery)_run_id|actions\/workflows\/release-stable\.yml\/dispatches|gh run (?:rerun|cancel)|seq 1 840/.test(
        fullAddonAction.text,
      )
    ) {
      failures += reportFailure(id, 'Stable Full action must reconcile target state without polling or a second dispatcher');
    }
    const homebrewStandardRuns = actionSteps(homebrewStandardAction.workflow)
      .map((step) => typeof step.run === 'string' ? step.run : '')
      .join('\n');
    for (const required of [
      'reconcile_published_homebrew_standard',
      'opl_homebrew_standard_follower_handoff.v1',
      'same_tag_replacement_allowed: true',
      'core_release_or_latest_blocking: false',
      '--remote-write-mode inspect_only',
      '--remote-write-mode direct_commit',
      '--expected-current-cask-sha256',
      'idempotent_concurrent',
      'core_release_or_latest_blocked:false',
      'second_push_attempted:false',
      'current-main.json',
    ]) {
      if (!homebrewStandardRuns.includes(required)) {
        failures += reportFailure(id, `Stable Homebrew Standard action is missing ${required}`);
      }
    }
    if ((homebrewStandardRuns.match(/git -C tap-source push --no-force/g) ?? []).length !== 1) {
      failures += reportFailure(id, 'Stable Homebrew Standard action must contain exactly one non-force push');
    }
    if (/for attempt in 1 2 3|new_release_revision_required|gh release (?:create|edit|upload|delete)/.test(homebrewStandardRuns)) {
      failures += reportFailure(
        id,
        'Stable Homebrew Standard action must use one same-tag CAS without release or version allocation',
      );
    }
    for (const required of [
      'reconcile_published_homebrew_full',
      'opl-release-full-published-${AUTHORITY_RUN_ID}',
      'homebrew-full-handoff.json',
      'opl_homebrew_full_follower_handoff.v1',
      '.source.completed_stage == "full_qualified"',
      '.source.checkpoint_transport_executor == "github_actions"',
      '.homebrew_modified == false',
      'test "$GITHUB_REF" = refs/heads/main',
    ]) {
      if (!homebrewFullAction.text.includes(required)) {
        failures += reportFailure(id, `Stable Homebrew Full handoff action is missing ${required}`);
      }
    }
    if (
      /git\b[^\n]*\bpush\b|OPL_HOMEBREW_TAP_TOKEN|failed_(?:follower|recovery)_run_id/.test(
        homebrewFullAction.text,
      )
    ) {
      failures += reportFailure(id, 'Stable Homebrew Full handoff must not own Tap mutation or recovery history');
    }
  }

  const desktopAddonJobs = workflowJobs(desktopPlatformAddon.workflow);
  const desktopBuild = desktopAddonJobs['build-platform'];
  const desktopAppend = desktopAddonJobs['append-platform'];
  const desktopReceipt = desktopAddonJobs.receipt;
  if (
    JSON.stringify(Object.keys(desktopPlatformAddon.workflow.on ?? {})) !== JSON.stringify(['workflow_call'])
    || !exactObject(desktopPlatformAddon.workflow.permissions, exactReadPermissions)
    || JSON.stringify(Object.keys(desktopAddonJobs)) !== JSON.stringify([
      'verify-standard-quality', 'build-platform', 'append-platform', 'receipt',
    ])
    || desktopBuild?.uses !== './.github/workflows/build-manual.yml'
    || desktopBuild?.concurrency !== undefined
    || typeof desktopBuild?.with?.platform_ids !== 'string'
    || !desktopBuild.with.platform_ids.includes('inputs.platform_id')
    || !desktopAppend
    || !needsExactly(desktopAppend, ['build-platform'])
    || desktopAppend.environment !== 'release-stable'
    || !exactObject(desktopAppend.permissions, exactStableEntryPermissions)
    || !hasStableMutationMutex(desktopAppend)
    || !desktopReceipt
    || desktopReceipt.if !== '${{ always() }}'
    || !needsExactly(desktopReceipt, ['build-platform', 'append-platform'])
  ) {
    failures += reportFailure(
      id,
      'Desktop add-on must keep build, same-tag append, and receipt as one reusable leaf',
    );
  }

  const certificationTriggers = optionalCertification.workflow.on ?? {};
  const certificationJobs = workflowJobs(optionalCertification.workflow);
  if (
    JSON.stringify(Object.keys(certificationTriggers).sort()) !==
      JSON.stringify(['workflow_dispatch', 'workflow_run'])
    || JSON.stringify(certificationTriggers.workflow_run?.workflows) !==
      JSON.stringify(['OPL Stable Follow-ups'])
    || JSON.stringify(certificationTriggers.workflow_run?.types) !== JSON.stringify(['completed'])
    || JSON.stringify(certificationTriggers.workflow_dispatch?.inputs?.operation?.options) !==
      JSON.stringify(['verify_existing_repair'])
    || !exactObject(optionalCertification.workflow.permissions, exactReadPermissions)
    || optionalCertification.workflow.concurrency?.group !==
      'opl-desktop-artifact-certification-${{ github.event_name == \'workflow_dispatch\' && inputs.followup_run_id || github.event.workflow_run.id }}'
    || optionalCertification.workflow.concurrency?.['cancel-in-progress'] !== false
    || JSON.stringify(Object.keys(certificationJobs)) !== JSON.stringify([
      'resolve-app-release',
      'certify-linux-x64',
      'admit-macos-vm',
      'certify-standard-vm',
      'receipt',
    ])
  ) {
    failures += reportFailure(
      id,
      'Optional certification must be a read-only follower of the single Stable follow-up hub',
    );
  }
  for (const jobId of ['resolve-app-release', 'certify-linux-x64', 'admit-macos-vm', 'receipt']) {
    const job = certificationJobs[jobId];
    if (!job || job['runs-on'] !== 'ubuntu-latest' || !Array.isArray(job.steps)) {
      failures += reportFailure(id, `Optional certification job ${jobId} must stay GitHub-hosted`);
    }
  }
  const certifyStandardVm = certificationJobs['certify-standard-vm'];
  if (
    !certifyStandardVm
    || certifyStandardVm.uses !== './.github/workflows/opl-first-run-vm.yml'
    || Object.prototype.hasOwnProperty.call(certifyStandardVm, 'steps')
    || Object.prototype.hasOwnProperty.call(certifyStandardVm, 'runs-on')
    || !exactObject(certifyStandardVm.permissions, exactReadPermissions)
    || !exactObject(certifyStandardVm.with, {
      release_tag: '${{ needs.resolve-app-release.outputs.tag }}',
      published_artifact_name: '${{ needs.resolve-app-release.outputs.standard_artifact_name }}',
      published_artifact_digest: '${{ needs.resolve-app-release.outputs.standard_artifact_digest }}',
      artifact_app_ref: '${{ needs.resolve-app-release.outputs.app_sha }}',
      shell_ref: '${{ needs.resolve-app-release.outputs.shell_sha }}',
      smoke_harness_ref: '${{ needs.resolve-app-release.outputs.shell_sha }}',
      framework_ref: '${{ needs.resolve-app-release.outputs.framework_sha }}',
      package_profile: 'standard',
      diagnostic_scope: 'post_publication_optional_certification',
      require_macos_gatekeeper: true,
    })
  ) {
    failures += reportFailure(id, 'Optional macOS certification must consume exact published Standard bytes');
  }
  for (const required of [
    '.path == ".github/workflows/release-stable-post-success-followups.yml"',
    'opl-stable-app-release-followup-${source_run_id}',
    'opl-stable-desktop-append-${source_run_id}',
    'opl_app_desktop_artifacts_certification.v1',
    'required_for_publication:false',
    'remaining:[]',
    'reason_code=operator_deferred',
  ]) {
    if (!optionalCertification.text.includes(required)) {
      failures += reportFailure(id, `Optional certification is missing ${required}`);
    }
  }
  if (
    /contents: write|packages: write|gh workflow run|gh run (?:rerun|cancel)|gh release (?:create|edit|upload|delete)|opl release (?:build|publish|reconcile)|codesign|notarize/.test(
      optionalCertification.text,
    )
  ) {
    failures += reportFailure(id, 'Optional certification must not dispatch, rebuild, sign, or publish');
  }
  for (const required of [
    'published_artifact_name',
    'published_artifact_digest',
    'post_publication_status',
    'post_publication_reason_code',
    'post_publication_job_started',
    'post_publication_execution_started',
    'post_publication_classification_valid',
    'PUBLISHED_ARTIFACT_NAME: ${{ inputs.published_artifact_name }}',
    'download_pattern="$PUBLISHED_ARTIFACT_NAME"',
    'keys == ["reason_code","schema","source_vm","status"]',
    '.source_vm == $source_vm',
    '.framework_source_archive == null',
    'clone_vm|configure_display|start_vm|wait_for_ip|wait_for_ssh',
    'actual_digest="sha256:$(shasum -a 256 "$dmg_path"',
    "diagnostic_scope != 'post_publication_optional_certification'",
  ]) {
    if (!optionalCertificationVm.text.includes(required)) {
      failures += reportFailure(id, `Optional certification VM path is missing ${required}`);
    }
  }
  if (optionalCertificationVm.text.includes("download_pattern='${{ inputs.published_artifact_name }}'")) {
    failures += reportFailure(id, 'Optional certification VM must pass published artifact names through step env');
  }

  return failures;
}

export function validateHomebrewFullPromotionTopology(appRoot: string): number {
  const id = 'homebrew_full_promotion_topology';
  const publisher = parseWorkflow(appRoot, homebrewFullPublisherWorkflowPath, id);
  if (!publisher) return 1;
  let failures = 0;
  const publisherJobs = workflowJobs(publisher.workflow);
  const publisherInputs = publisher.workflow.on?.workflow_call?.inputs ?? {};
  if (
    JSON.stringify(Object.keys(publisher.workflow.on ?? {})) !== JSON.stringify(['workflow_call'])
    || JSON.stringify(Object.keys(publisherInputs)) !== JSON.stringify(['authority_run_id', 'handoff_base64', 'handoff_sha256'])
    || !exactObject(publisher.workflow.permissions, exactReadPermissions)
    || JSON.stringify(Object.keys(publisherJobs)) !== JSON.stringify(['prepare-candidate', 'publish-cask', 'readback'])
  ) {
    failures += reportFailure(id, 'Full Homebrew reusable must expose only exact handoff inputs and candidate/publish/readback jobs');
  }
  const prepare = publisherJobs['prepare-candidate'];
  const publish = publisherJobs['publish-cask'];
  const readback = publisherJobs.readback;
  if (
    !prepare || prepare.if !== undefined || !exactObject(prepare.permissions, exactReadPermissions)
    || !publish || publish.if !== undefined || !needsExactly(publish, ['prepare-candidate'])
    || publish.environment !== 'release-stable' || !exactObject(publish.permissions, exactReadPermissions)
    || !readback || readback.if !== undefined || !needsExactly(readback, ['prepare-candidate', 'publish-cask'])
    || !exactObject(readback.permissions, exactReadPermissions)
  ) {
    failures += reportFailure(id, 'Full Homebrew reusable must publish the exact hosted-qualified candidate before protected Tap CAS and public readback');
  }
  if (
    /qualify-candidate|opl-first-run-vm\.yml|tart-smoke-summary\.json|smoke_harness_sha|shell-harness|opl-first-run-tart-smoke|--homebrew-cask-file/.test(
      publisher.text,
    )
  ) {
    failures += reportFailure(id, 'Full Homebrew publication must not depend on physical VM certification before protected Tap CAS');
  }
  const prepareRuns = jobRuns(prepare);
  const publishRuns = jobRuns(publish);
  for (const required of [
    'app_full_first_install',
    'inspect_only',
    'version_conflict',
    '--remote-write-mode none',
    'full_dmg_embedded_opl_base',
    'active_framework_count_target',
    'opl-homebrew-full-candidate-${GITHUB_RUN_ID}',
    'homebrew-full-follower-v3:${GITHUB_RUN_ID}',
    't+120*60_000',
    'opl_homebrew_full_observational_binding.v2',
    'workflow_cas_and_unified_attestation_observer',
    'release_mutation_authority_imported:false',
    'max_push_attempts:1',
    'standard_manifest_url=',
    'opl-app-component-manifest.json',
    '--expected-source-commit "$base_target_commitish"',
    'a1561bdf1dfe6f316dad22f16152a537ddfb69d5',
    'merge-base --is-ancestor "$embedded_base_floor" "$shell_sha"',
    'predates the embedded-Base fail-closed carrier',
    'qualification_receipt_sha256',
    'release-operation-deadline.ts check',
  ]) {
    if (!prepareRuns.includes(required)) failures += reportFailure(id, `Full Homebrew candidate preparation is missing ${required}`);
  }
  for (const required of [
    'release-operation-deadline.ts check',
    'git -C tap-source push --no-force origin "$result_commit:refs/heads/main"',
    'no second push was attempted',
    'opl_homebrew_full_unknown_outcome.v2',
    'required_action:"read_only_reconcile"',
    'git -C tap-source ls-remote origin refs/heads/main',
    'git -C tap-source fetch --no-tags --depth=1 origin "$remote_commit"',
    "git -C tap-source show 'FETCH_HEAD:Casks/one-person-lab-full.rb'",
    'opl_homebrew_full_publication_receipt.v2',
    'authority_model:"workflow_cas_and_unified_attestation_observer"',
    'build_provenance:{app_sha:$app,shell_sha:$shell,framework_sha:$framework}',
  ]) {
    if (!publishRuns.includes(required)) failures += reportFailure(id, `Full Homebrew protected publish is missing ${required}`);
  }
  for (const forbidden of [
    'clean_vm_receipt_sha256',
    'official_profile_first_install',
    'formula_opl_installed_before',
    'formula_opl_installed_after',
  ]) {
    if (publishRuns.includes(forbidden)) {
      failures += reportFailure(id, `Full Homebrew publication must not fabricate optional certification field ${forbidden}`);
    }
  }
  if (/restore-release-checkpoint|framework-executor|opl release (?:operation|publish|reconcile|checkpoint)/.test(publisher.text)) {
    failures += reportFailure(id, 'Full Homebrew observer must not import Framework checkpoint or release mutation authority');
  }
  if ((publishRuns.match(/git -C tap-source push --no-force/g) ?? []).length !== 1) {
    failures += reportFailure(id, 'Full Homebrew publisher must contain exactly one non-force Tap push call');
  }
  if (publisher.text.includes('contents/Casks/one-person-lab-full.rb?ref=main')) {
    failures += reportFailure(id, 'Full Homebrew readback must bind Cask bytes to a fetched exact Tap commit');
  }
  if (
    !publisher.text.includes(
      'OPL_HOMEBREW_TAP_TOKEN: ${{ secrets.OPL_HOMEBREW_TAP_TOKEN }}',
    )
  ) {
    failures += reportFailure(id, 'Full Homebrew token must be scoped to the protected publish job');
  }
  if (prepareRuns.includes('OPL_HOMEBREW_TAP_TOKEN')) {
    failures += reportFailure(id, 'Full Homebrew token must be unreachable before the protected publish job');
  }
  if (/workflow_dispatch:|depends_on formula: "opl"|github-activate-latest|make_latest|release-webui/.test(publisher.text)) {
    failures += reportFailure(id, 'Full Homebrew reusable must remain isolated from Formula, Latest, WebUI, and manual entry paths');
  }
  const vmWorkflow = parseWorkflow(appRoot, '.github/workflows/opl-first-run-vm.yml', id);
  const activeShell = JSON.parse(fs.readFileSync(path.join(appRoot, 'contracts/app-shell-adapter.json'), 'utf8')).active_shell;
  const carriesOfficialProfile = activeShell === 'opl-studio'
    ? Boolean(vmWorkflow?.text.includes('--product-profile "${{ github.workspace }}/contracts/app-product-profile.json"')
      && vmWorkflow.text.includes('scripts/desktop/stable-clean-vm.mjs')
      && vmWorkflow.text.includes("'${{ steps.verification_app.outputs.app_sha }}'"))
    : Boolean(vmWorkflow?.text.includes('oplProductProfile/oplProductProfile.generated.json'));
  if (!carriesOfficialProfile) {
    failures += reportFailure(
      id,
      'Qualification must carry the exact App-owned Official Profile roots into the selected Shell harness',
    );
  }
  return failures;
}

export function validateNightlyReleaseTopology(appRoot: string): number {
  const id = 'nightly_release_topology';
  const release = parseWorkflow(appRoot, nightlyReleaseWorkflowPath, id);
  const followup = parseWorkflow(appRoot, nightlyFollowupWorkflowPath, id);
  if (!release || !followup) return [release, followup].filter((value) => !value).length;
  let failures = 0;
  const scheduledNightlyDispatchers = fs.readdirSync(path.join(appRoot, '.github/workflows'))
    .filter((name) => name.endsWith('.yml'))
    .filter((name) => {
      const workflow = parseYaml(
        fs.readFileSync(path.join(appRoot, '.github/workflows', name), 'utf8'),
      ) as Record<string, any>;
      return typeof workflow.name === 'string'
        && /nightly/i.test(workflow.name)
        && Object.prototype.hasOwnProperty.call(workflow.on ?? {}, 'schedule');
    })
    .sort();
  if (JSON.stringify(scheduledNightlyDispatchers) !== JSON.stringify(['release-nightly.yml'])) {
    failures += reportFailure(id, 'Nightly must have exactly one scheduled dispatcher: release-nightly.yml');
  }
  const releaseJobs = workflowJobs(release.workflow);
  const developmentValidationInputs = release.workflow.on?.workflow_dispatch?.inputs ?? {};
  const developmentValidationConfirmation = developmentValidationInputs.operator_confirmation;
  if (
    JSON.stringify(Object.keys(release.workflow.on ?? {}).sort()) !==
      JSON.stringify(['schedule', 'workflow_dispatch'])
    || JSON.stringify(release.workflow.on?.schedule) !== JSON.stringify([{ cron: '17 19 * * *' }])
    || JSON.stringify(Object.keys(developmentValidationInputs)) !== JSON.stringify(['operator_confirmation'])
    || developmentValidationConfirmation?.required !== true
    || developmentValidationConfirmation?.type !== 'string'
    || !exactObject(release.workflow.permissions, exactReadPermissions)
    || !exactObject(release.workflow.concurrency, {
      group: 'opl-standard-nightly',
      'cancel-in-progress': false,
    })
    || JSON.stringify(Object.keys(releaseJobs)) !==
      JSON.stringify(['admission', 'standard-build', 'qualify-and-publish'])
  ) {
    failures += reportFailure(id, 'Nightly must keep one daily production schedule and one user-explicit development-validation entry on the same Standard prerelease lane');
  }
  const admission = releaseJobs.admission;
  const build = releaseJobs['standard-build'];
  const publish = releaseJobs['qualify-and-publish'];
  if (
    !admission
    || !exactObject(admission.permissions, exactReadPermissions)
    || !build
    || build.uses !== './.github/workflows/_build-reusable.yml'
    || !needsExactly(build, ['admission'])
    || !exactObject(build.permissions, exactReadPermissions)
    || build.secrets !== undefined
    || build.with?.require_macos_gatekeeper !== false
    || Object.prototype.hasOwnProperty.call(build.with ?? {}, 'release_bundle_digest')
    || Object.prototype.hasOwnProperty.call(build.with ?? {}, 'release_cohort_ref')
    || Object.prototype.hasOwnProperty.call(build.with ?? {}, 'operation')
    || !publish
    || !needsExactly(publish, ['admission', 'standard-build'])
    || publish.environment !== 'release-nightly'
    || !exactObject(publish.permissions, exactStableStandardPermissions)
  ) {
    failures += reportFailure(id, 'Nightly must reuse the physical build without Stable Bundle authority and protect only its thin publisher');
  }
  for (const required of [
    'test "$GITHUB_RUN_ATTEMPT" = 1',
    'GITHUB_EVENT_NAME',
    'publish_nonlatest_nightly',
    'invocation_mode=scheduled_production',
    'invocation_mode=development_validation',
    'authority_source=daily_schedule',
    'authority_source=user_explicit',
    '--invocation-mode "$invocation_mode"',
    '--event "$GITHUB_EVENT_NAME"',
    '--authority-source "$authority_source"',
    '.invocation.mode',
    '.invocation.event',
    '.invocation.authority_source',
    'refs/heads/main',
    'TZ=Asia/Shanghai',
    'resolve-nightly-release-request.ts',
    'nightly-release-qualification.ts',
    'nightly-release-notes.ts',
    'nightly-notes-baseline.json',
    'nightly-notes-evidence.json',
    '--qualification nightly-qualification.json',
    '--shell-root ${{ needs.admission.outputs.shell_root }}',
    '--framework-root framework-source',
    'nightly-release-publisher.ts',
    'require_macos_gatekeeper: false',
    'github_release.make_latest',
    '.include_full',
    'heavy_vm_required',
  ]) {
    if (!release.text.includes(required)) {
      failures += reportFailure(id, `Nightly release is missing ${required}`);
    }
  }
  if (
    /opl-release-bundle-global|uses: \.\/\.github\/workflows\/_release-bundle\.yml|uses: \.\/\.github\/workflows\/opl-first-run-vm\.yml|require_macos_gatekeeper: true|make_latest:\s*(?:true|'true')|_release-full-addon|release-webui|manual-full-preview|update-homebrew|homebrew.*(?:gate|publish|tap|cask)|(?:gate|publish|tap|cask).*homebrew|\btart\b/i.test(
      release.text,
    )
  ) {
    failures += reportFailure(id, 'Nightly source must not enter Stable Bundle, heavy VM, Full, WebUI, Latest, manual Preview, Homebrew, or Tart paths');
  }

  const followupJobs = workflowJobs(followup.workflow);
  const homebrewJob = followupJobs['publish-nightly-cask'];
  const resolve = followupJobs['resolve-sample'];
  const vm = followupJobs['sampled-standard-vm'];
  const followupInputs = followup.workflow.on?.workflow_dispatch?.inputs ?? {};
  if (
    JSON.stringify(Object.keys(followup.workflow.on ?? {}).sort()) !==
      JSON.stringify(['workflow_dispatch', 'workflow_run'])
    || JSON.stringify(followup.workflow.on?.workflow_run?.workflows) !==
      JSON.stringify(['OPL Standard Nightly Release'])
    || JSON.stringify(followup.workflow.on?.workflow_run?.types) !== JSON.stringify(['completed'])
    || JSON.stringify(Object.keys(followupInputs)) !== JSON.stringify(['operation', 'source_run_id', 'smoke_harness_ref'])
    || JSON.stringify(followupInputs.operation?.options) !== JSON.stringify([
      'reconcile_homebrew', 'run_sampled_vm',
    ])
    || followupInputs.source_run_id?.required !== true
    || followupInputs.source_run_id?.type !== 'string'
    || followupInputs.smoke_harness_ref?.required !== false
    || followupInputs.smoke_harness_ref?.type !== 'string'
    || !exactObject(followup.workflow.permissions, exactReadPermissions)
    || followup.workflow.concurrency !== undefined
    || JSON.stringify(Object.keys(followupJobs)) !== JSON.stringify([
      'publish-nightly-cask', 'resolve-sample', 'sampled-standard-vm',
    ])
    || !homebrewJob
    || homebrewJob.if !== "${{ (github.event_name == 'workflow_run' && github.event.workflow_run.conclusion == 'success') || (github.event_name == 'workflow_dispatch' && inputs.operation == 'reconcile_homebrew') }}"
    || homebrewJob.environment !== 'release-nightly'
    || !exactObject(homebrewJob.permissions, exactReadPermissions)
    || !resolve
    || resolve.if !== "${{ (github.event_name == 'workflow_run' && github.event.workflow_run.conclusion == 'success') || (github.event_name == 'workflow_dispatch' && inputs.operation == 'run_sampled_vm') }}"
    || !exactObject(resolve.permissions, exactReadPermissions)
    || !vm
    || vm.if !== "${{ needs.resolve-sample.outputs.sampled == 'true' }}"
    || vm.uses !== './.github/workflows/opl-first-run-vm.yml'
    || !needsExactly(vm, ['resolve-sample'])
    || !exactObject(vm.permissions, exactReadPermissions)
    || vm.with?.package_profile !== 'standard'
    || vm.with?.require_macos_gatekeeper !== false
    || Object.prototype.hasOwnProperty.call(vm.with ?? {}, 'release_bundle_digest')
    || Object.prototype.hasOwnProperty.call(vm.with ?? {}, 'operation')
  ) {
    failures += reportFailure(
      id,
      'Nightly follow-ups must expose one hub with mutually exclusive Homebrew and sampled VM lanes',
    );
  }
  const homebrewRuns = jobRuns(homebrewJob);
  for (const required of [
    '.path == ".github/workflows/release-nightly.yml"',
    '.event == "schedule" or .event == "workflow_dispatch"',
    '.actions.run_id == $run',
    '.actions.run_attempt == "1"',
    '.invocation.event == $event',
    'mode: "scheduled_production"',
    'mode: "development_validation"',
    '.cohort.app_sha == $head',
    '.run_attempt == 1',
    'OPL_HOMEBREW_TAP_DEPLOY_KEY',
    'git@github.com:${tap_repo}.git',
    'IdentitiesOnly=yes',
    'StrictHostKeyChecking=yes',
    'update-homebrew-tap.ts',
    '--channel nightly',
    'Casks/one-person-lab-nightly.rb',
    'Casks/one-person-lab.rb',
    'stable_before',
    'stable_after',
    'no retry is allowed',
    'retry_performed:false',
  ]) {
    if (!homebrewRuns.includes(required)) {
      failures += reportFailure(id, `Nightly Homebrew follower is missing ${required}`);
    }
  }
  if ((homebrewRuns.match(/git -C tap-source push --no-force/g) ?? []).length !== 1) {
    failures += reportFailure(id, 'Nightly Homebrew follower must contain exactly one ordinary non-force push');
  }
  if (
    /one-person-lab-full\.rb|make_latest:\s*(?:true|'true')|gh workflow run|gh run (?:rerun|cancel)|OPL_HOMEBREW_TAP_TOKEN|environment:\s*release-stable/.test(
      jobEvidenceText(homebrewJob),
    )
  ) {
    failures += reportFailure(
      id,
      'Nightly Homebrew follower must not contain VM, Full, Latest, dispatch, retry, or Stable credential paths',
    );
  }

  if (
    !jobEvidenceText(resolve).includes('TZ=Asia/Shanghai date +%u')
    || !jobEvidenceText(resolve).includes('.event == "schedule" or .event == "workflow_dispatch"')
    || !jobEvidenceText(resolve).includes('.actions.run_id == $run')
    || !jobEvidenceText(resolve).includes('.actions.run_attempt == "1"')
    || !jobEvidenceText(resolve).includes('.invocation.event == $event')
    || !jobEvidenceText(resolve).includes('mode:"scheduled_production"')
    || !jobEvidenceText(resolve).includes('mode:"development_validation"')
    || !jobEvidenceText(resolve).includes('authority_source:"user_explicit"')
    || !jobEvidenceText(resolve).includes('.cohort.app_sha == $head')
    || !jobEvidenceText(resolve).includes('heavy_vm_blocking == false')
    || /contents: write|packages: write|update-homebrew|make_latest:\s*(?:true|'true')|make_latest\s*==\s*true|gh release/.test(jobEvidenceText(resolve))
  ) {
    failures += reportFailure(id, 'Nightly sampled VM must stay low-frequency and mutation-free');
  }
  return failures;
}

export function validateReleaseBundleCanaryTopology(appRoot: string): number {
  const id = 'release_bundle_canary_topology';
  const parsed = parseWorkflow(appRoot, '.github/workflows/release-bundle-canary.yml', id);
  if (!parsed) return 1;
  const { workflow, text } = parsed;
  let failures = 0;
  const triggers = workflow.on ?? {};
  const schedule = triggers.schedule;
  if (JSON.stringify(Object.keys(triggers).sort()) !==
      JSON.stringify(['schedule', 'workflow_dispatch']) ||
      !Array.isArray(schedule) || schedule.length !== 1 ||
      schedule[0]?.cron !== '0 13 * * *') {
    failures += reportFailure(id, 'Canary must expose only explicit manual dispatch and the one daily schedule');
  }
  if (!exactObject(workflow.concurrency, {
    group: 'opl-release-validation-canary-${{ github.ref }}',
    'cancel-in-progress': true,
  })) {
    failures += reportFailure(id, 'Canary must use its own cancellable validation concurrency, not the Stable mutation mutex');
  }
  if (!exactObject(workflow.permissions, exactReadPermissions)) {
    failures += reportFailure(id, 'Canary permissions must be exactly contents:read/actions:read');
  }
  if (/^\s*secrets:/m.test(text) || workflowMutationCommandPattern.test(text) ||
      text.includes('opl-release-bundle-global')) {
    failures += reportFailure(id, 'Canary must not receive secrets or contain mutation commands');
  }

  const jobs = workflowJobs(workflow);
  if (JSON.stringify(Object.keys(jobs)) !== JSON.stringify([
    'framework-checkpoint-roundtrip', 'contract',
  ])) {
    failures += reportFailure(
      id,
      'Canary must contain only Framework checkpoint semantics and App contract verification',
    );
  }
  const framework = jobs['framework-checkpoint-roundtrip'];
  const contract = jobs.contract;
  if (
    !framework
    || framework['runs-on'] !== 'ubuntu-latest'
    || framework['timeout-minutes'] !== 20
    || !exactObject(framework.permissions, exactReadPermissions)
    || !jobRuns(framework).includes("--test-name-pattern='portable checkpoint switches executors|elapsed absolute deadline blocks'")
    || !jobRuns(framework).includes('tests/src/cli/cases/release-bundle.test.ts')
    || !contract
    || contract['runs-on'] !== 'ubuntu-latest'
    || requestsWritePermission(contract.permissions)
    || !jobRuns(contract).includes('tests/release/release-bundle-workflow-cutover.test.ts')
    || !jobRuns(contract).includes('tests/release/release-control-plane-boundary.test.ts')
  ) {
    failures += reportFailure(id, 'Canary jobs must run the two exact read-only contract checks');
  }
  for (const [jobId, job] of Object.entries(jobs)) {
    if (job.uses !== undefined || requestsWritePermission(job.permissions) || job.secrets !== undefined) {
      failures += reportFailure(
        id,
        `${jobId} must remain a local read-only check and cannot start a reusable release workflow`,
      );
    }
    failures += validateExactActionPins(
      '.github/workflows/release-bundle-canary.yml',
      jobId,
      Array.isArray(job.steps) ? job.steps : [],
    );
  }
  if (/uses:\s*\.\/\.github\/workflows\//.test(text)) {
    failures += reportFailure(id, 'Canary must not reintroduce reusable release workflow entry jobs');
  }
  return failures;
}

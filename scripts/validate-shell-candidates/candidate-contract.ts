import fs from 'node:fs';
import path from 'node:path';
import type {
  NativeP1BaselineBridge,
  NativeThreadAdapterBoundary,
  OPLStudioCarrierEvidenceContract,
  ShellCandidate,
  ShellCandidateEntry,
  ShellCandidateRegistry,
  ShellCandidateRoleTombstone,
  ValidationCommand,
} from './types.ts';
import {
  assertFile,
  assertStringArrayIncludes,
  expectedFrameworkSurfaces,
  forbiddenAuthority,
  requiredHomeEntries,
  requiredSeriesProgressFields,
  forbiddenSeriesDomainFields,
  readJson,
  requiredNativeCapabilities,
  requiredNativeP1Capabilities,
  requiredNativeThreadCapabilities,
  root,
  validateActiveProjectLineStateModel,
} from './shared.ts';
import { assertDeepEqualJson } from '../validate-active-shell/assertions.ts';

function assertCandidateFileContains(candidate: ShellCandidate, relativePath: string, snippets: string[], label: string): void {
  const filePath = path.join(root, candidate.candidate_root, relativePath);
  assertFile(filePath, `${candidate.id} ${label}`);
  const source = fs.readFileSync(filePath, 'utf8');
  for (const snippet of snippets) {
    if (!source.includes(snippet)) {
      throw new Error(`${candidate.id} ${label} must include ${snippet}`);
    }
  }
}

function assertCandidatePathAbsent(candidate: ShellCandidate, relativePath: string, label: string): void {
  const filePath = path.join(root, candidate.candidate_root, relativePath);
  if (fs.existsSync(filePath)) {
    throw new Error(`${candidate.id} must not retain ${label}: ${relativePath}`);
  }
}

function assertCandidateFileExcludes(candidate: ShellCandidate, relativePath: string, snippets: string[], label: string): void {
  const filePath = path.join(root, candidate.candidate_root, relativePath);
  assertFile(filePath, `${candidate.id} ${label}`);
  const source = fs.readFileSync(filePath, 'utf8');
  for (const snippet of snippets) {
    if (source.includes(snippet)) {
      throw new Error(`${candidate.id} ${label} must not include ${snippet}`);
    }
  }
}

function missingCandidateCheckoutCanBeBlocked(candidate: ShellCandidate): boolean {
  return Boolean(
    !fs.existsSync(path.join(root, candidate.candidate_root))
    && candidate.checkout_policy?.missing_checkout_status === 'blocked_missing_checkout'
    && candidate.build_wrapper?.missing_checkout_blocker_allowed === true
  );
}

type CandidateAdapterContract = {
  purpose?: string;
  state?: string;
  adapter_id?: string;
  candidate_shell?: string;
  adapter_role?: string;
  active_shell?: string;
  candidate_stage?: string;
  shell_root: string;
  shell_source: { owner_repo: string; history_policy: string; checkout_path: string };
  release_role: string;
  delivery_topology?: {
    product_profile_ref?: string;
    topology_authority?: boolean;
    renderer?: string;
    shared_host_core?: string;
    desktop_adapter?: string;
    desktop_platforms?: string[];
    web_adapter?: string;
    web_runtime_forms?: string[];
    bridge_abi?: string;
    carrier_evidence_manifest?: {
      schema?: string;
      path?: string;
      candidate_only?: boolean;
      release_authority?: boolean;
    };
    carrier_entries?: Record<string, Record<string, string>>;
    aionui_or_aioncore_dependency_allowed?: boolean;
    active_release_carrier?: boolean;
  };
  gui_authority?: { implementation_role?: string };
  codex_executable_contract?: {
    resolver_env?: string;
    carrier?: {
      kind?: string;
      manifest_parser_owner?: string | null;
      aioncore_required?: boolean;
    };
  };
  shell_contract: { source_topology: string; capabilities: string[] };
  validation_commands: ValidationCommand[];
  p1_baseline_bridge?: NativeP1BaselineBridge;
  thread_adapter_boundary?: NativeThreadAdapterBoundary;
};

type NativeVisualParityContract = NonNullable<ShellCandidate['visual_parity_contract']> & {
  regression_floor?: string;
  source_usage?: string;
  current_reference_status?: string;
  visual_style_baseline?: string;
  visual_style_scope?: string;
  visual_token_source?: string;
  font_asset_policy?: string;
  superseded_observations?: string[];
  model_policy_source?: string;
  default_model?: string;
  default_reasoning_effort?: string;
  required_surfaces?: string[];
};

export const requiredNativeVisualParitySurfaces = [
  'persistent_project_rail',
  'single_conversation_timeline',
  'composer_model_and_reasoning_controls',
  'on_demand_dsh_details_column',
  'settings_locale_surface',
  'text_only_opl_product_identity',
];

const requiredNativeThreadProtocols = [
  'thread/list',
  'thread/read',
  'thread/start',
  'thread/resume',
  'thread/fork',
  'thread/archive',
  'thread/unarchive',
  'turn/start',
  'turn/steer',
];

const forbiddenNativePrivateCapabilities = [
  'typed_cross_top_level_thread_host_bridge',
  'client_executed_dynamic_tools_coordination_bridge',
  'local_cross_thread_p0_p1',
  'thread_list_read_resume_fork_archive_unarchive',
  'turn_start_steer_with_host_queue',
  'cross_thread_codex_permission_and_advisory_audit',
  'bilateral_coordination_receipts',
  'desktop_webui_coordination_parity',
  'remote_host_aggregation_p2_deferred',
];

const requiredNativeSubagentMetadata = ['parentThreadId', 'agentRole', 'agentNickname'];
const requiredNativeSubagentSourceKinds = [
  'subAgent',
  'subAgentReview',
  'subAgentCompact',
  'subAgentThreadSpawn',
  'subAgentOther',
];
const requiredNativeSubagentItemTypes = ['collabAgentToolCall', 'subAgentActivity'];

const appProductProfile = readJson<{
  codex: { default_model: string; default_reasoning_effort: string };
}>(path.join(root, 'contracts', 'app-product-profile.json'));
const configuredDefaultModel = appProductProfile.codex.default_model;
const configuredDefaultReasoningEffort = appProductProfile.codex.default_reasoning_effort;

export type CandidateValidationPolicy = {
  onlyForegroundAlternative: string;
  defaultCandidateValidationScope: string[];
  explicitCandidateValidationScope: string[];
  archivedTechnicalProofs: string[];
  archivedProofUpdatePolicy: string;
};

export function candidateValidationPolicyFromRegistry(registry: ShellCandidateRegistry): CandidateValidationPolicy {
  const alternative = registry.alternative_gui_policy;
  if (!alternative) {
    throw new Error('candidate registry must declare alternative_gui_policy before candidate validation');
  }
  return {
    onlyForegroundAlternative: alternative.only_foreground_alternative,
    defaultCandidateValidationScope: alternative.default_candidate_validation_scope,
    explicitCandidateValidationScope: alternative.explicit_candidate_validation_scope,
    archivedTechnicalProofs: alternative.archived_technical_proofs,
    archivedProofUpdatePolicy: alternative.archived_proof_policy,
  };
}

function validateCandidateRegistryEntry(candidate: ShellCandidateEntry, policy: CandidateValidationPolicy): void {
  if (!candidate.id || !candidate.candidate_root) {
    throw new Error(`Invalid candidate entry: ${JSON.stringify(candidate)}`);
  }
  const isArchivedProof = policy.archivedTechnicalProofs.includes(candidate.id);
  const isForegroundAlternative = candidate.id === policy.onlyForegroundAlternative;
  const isDefaultCandidate = policy.defaultCandidateValidationScope.includes(candidate.id);
  const isExplicitCandidate = policy.explicitCandidateValidationScope.includes(candidate.id);
  const expectedState = isArchivedProof
    ? 'archived_technical_proof'
    : 'active_product_development';
  if (candidate.state !== expectedState) {
    throw new Error(`${candidate.id} must stay in ${expectedState} according to app-shell-candidates alternative_gui_policy`);
  }
  if (!isArchivedProof && !isForegroundAlternative) {
    throw new Error(`${candidate.id} must be the foreground alternative or an archived technical proof`);
  }
  if (!isExplicitCandidate) {
    throw new Error(`${candidate.id} must be listed in explicit_candidate_validation_scope`);
  }
  if (isArchivedProof && isDefaultCandidate) {
    throw new Error(`${candidate.id} archived technical proof must not enter default candidate validation scope`);
  }
  if (isForegroundAlternative && isDefaultCandidate) {
    throw new Error(`${candidate.id} foreground alternative detail must stay out of default candidate validation scope`);
  }
  if (isArchivedProof) {
    if (!candidate.archived_reason || candidate.archived_reason.trim().length < 40) {
      throw new Error(`${candidate.id} archived technical proof must record a meaningful retirement reason`);
    }
    if (candidate.default_update_policy !== policy.archivedProofUpdatePolicy) {
      throw new Error(`${candidate.id} archived proof update policy must match alternative_gui_policy.archived_proof_policy`);
    }
  }
  if (!candidate.candidate_root.startsWith('shells/') || candidate.candidate_root.split(/[\\/]+/).includes('..')) {
    throw new Error(`${candidate.id} candidate_root must be under shells/<candidate>`);
  }
  const expectedReleaseParticipation = isArchivedProof
    ? 'explicit_user_requested_technical_replay_only'
    : 'pre_adoption_explicit_build_only';
  if (candidate.release_participation !== expectedReleaseParticipation) {
    throw new Error(`${candidate.id} release participation must be ${expectedReleaseParticipation}`);
  }
  if (candidate.source_topology !== 'external_checkout_linked_shell_repo') {
    throw new Error(`${candidate.id} must declare external_checkout_linked_shell_repo topology`);
  }
}

export function isCandidateRoleTombstone(
  candidate: ShellCandidateEntry,
): candidate is ShellCandidateRoleTombstone {
  return 'role_tombstone' in candidate && candidate.role_tombstone === true;
}

function validateCandidateRoleTombstone(
  candidate: ShellCandidateRoleTombstone,
  policy: CandidateValidationPolicy,
): void {
  const expected = candidate.id === 'hermes-codex'
    ? {
        state: 'archived_technical_proof',
        mode: 'explicit_user_request_only',
        command: 'npm run validate:candidate:hermes',
      }
    : candidate.id === 'agui-codex'
      ? {
          state: 'archived_technical_proof',
          mode: 'explicit_user_request_only',
          command: 'npm run validate:candidate:agui',
        }
      : undefined;
  if (!expected) {
    throw new Error(`${candidate.id} must not use the archived-proof role tombstone schema`);
  }
  if (
    candidate.state !== expected.state ||
    candidate.replay.mode !== expected.mode ||
    candidate.replay.validator_command !== expected.command ||
    candidate.replay.source_checkout_policy !== 'optional_until_explicit_replay'
  ) {
    throw new Error(`${candidate.id} role tombstone must preserve its explicit replay route`);
  }
  if (
    candidate.id === policy.onlyForegroundAlternative ||
    policy.defaultCandidateValidationScope.includes(candidate.id)
  ) {
    throw new Error(`${candidate.id} role tombstone must never enter foreground or default detail validation`);
  }
  assertFile(path.join(root, candidate.adapter_contract), `${candidate.id} adapter contract`);
  assertFile(path.join(root, candidate.replay.runbook_ref), `${candidate.id} replay runbook`);
}

function readCandidateAdapterContract(candidate: ShellCandidate): CandidateAdapterContract {
  assertFile(path.join(root, candidate.adapter_contract), `${candidate.id} adapter contract`);
  return readJson<CandidateAdapterContract>(path.join(root, candidate.adapter_contract));
}

export function validateNativeThreadAdapterBoundary(
  boundary: NativeThreadAdapterBoundary | undefined,
): void {
  const expectedBoundaryKeys = [
    'adapter',
    'codex_subagent_projection',
    'private_coordination_layer_allowed',
    'protocol_owner',
    'source_ref',
    'supported_protocols',
    'thread_store_owner',
    'user_initiated_only',
  ];
  if (
    !boundary ||
    JSON.stringify(Object.keys(boundary).sort()) !== JSON.stringify(expectedBoundaryKeys) ||
    boundary.source_ref !==
      'contracts/app-gui-product-contract.json#interaction_baseline.thread_coordination' ||
    boundary.adapter !== 'single_codex_app_server_adapter' ||
    boundary.protocol_owner !== 'codex_core_app_server' ||
    boundary.thread_store_owner !== 'codex_core_app_server' ||
    boundary.user_initiated_only !== true ||
    boundary.private_coordination_layer_allowed !== false ||
    JSON.stringify(boundary.supported_protocols) !==
      JSON.stringify(requiredNativeThreadProtocols)
  ) {
    throw new Error(
      'native candidate thread adapter must stay a single user-initiated Codex App Server adapter with no private coordination layer',
    );
  }

  const subagents = boundary.codex_subagent_projection;
  if (
    JSON.stringify(Object.keys(subagents).sort()) !==
      JSON.stringify(['metadata_fields', 'mode', 'thread_item_types', 'thread_source_kinds']) ||
    subagents.mode !== 'read_only_thread_metadata_and_items' ||
    JSON.stringify(subagents.thread_source_kinds) !==
      JSON.stringify(requiredNativeSubagentSourceKinds) ||
    JSON.stringify(subagents.thread_item_types) !==
      JSON.stringify(requiredNativeSubagentItemTypes) ||
    JSON.stringify(subagents.metadata_fields) !==
      JSON.stringify(requiredNativeSubagentMetadata)
  ) {
    throw new Error(
      'native candidate must preserve Codex subagent metadata, source kinds, and thread items as read-only App Server projections',
    );
  }
}

export function validateNativeP1BaselineBridge(
  bridge: NativeP1BaselineBridge | undefined,
): void {
  const expectedKeys = [
    'active_turn_transport',
    'agent_launch_transport',
    'app_updater_ref',
    'contract_ref',
    'gateway_projection_ref',
    'gateway_secret_bridge_ref',
    'managed_update_ref',
    'package_action_source',
    'required_host_capabilities',
    'shell_owned_action_bus_allowed',
    'shell_owned_package_registry_allowed',
    'shell_owned_persistent_queue_allowed',
  ];
  const requiredHostCapabilities = [
    'loginGatewayAccount',
    'opl-runtime.get-managed-update-status',
    'opl-runtime.get-managed-update-check',
    'opl-runtime.get-managed-update-plan',
    'opl-runtime.run-managed-update-apply',
    'opl-runtime.run-managed-update-repair',
    'opl-runtime.run-managed-update-rollback',
    'app_update_check',
    'app_update_install_downloaded',
    'application_restart',
  ];
  if (
    !bridge ||
    JSON.stringify(Object.keys(bridge).sort()) !== JSON.stringify(expectedKeys) ||
    bridge.contract_ref !== 'contracts/app-runtime-bridge.json#native_minimum_product_bridge' ||
    bridge.agent_launch_transport !== 'codex_app_server_thread_start_then_turn_start' ||
    bridge.active_turn_transport !== 'codex_app_server_turn_steer_else_turn_start' ||
    bridge.gateway_projection_ref !== 'contracts/app-runtime-bridge.json#opl_gateway_account_projection' ||
    bridge.gateway_secret_bridge_ref !== 'contracts/app-runtime-bridge.json#opl_gateway_account_secret_bridge' ||
    bridge.package_action_source !== 'app_state.agent_packages.directory.entries[].available_actions[]' ||
    bridge.managed_update_ref !== 'contracts/app-release-channel.json#managed_update_plane.software_lifecycle' ||
    bridge.app_updater_ref !== 'contracts/app-release-channel.json#standard_updater' ||
    bridge.shell_owned_action_bus_allowed !== false ||
    bridge.shell_owned_package_registry_allowed !== false ||
    bridge.shell_owned_persistent_queue_allowed !== false
  ) {
    throw new Error('native candidate P1 bridge must bind existing owner transports without a parallel action bus, package registry, or persistent queue');
  }
  assertStringArrayIncludes(
    bridge.required_host_capabilities,
    requiredHostCapabilities,
    'native candidate P1 bridge required_host_capabilities',
  );
}

function validateCandidateAdapterContract(
  candidate: ShellCandidate,
  adapterContract: CandidateAdapterContract,
  policy: CandidateValidationPolicy,
): void {
  if (candidate.id !== policy.onlyForegroundAlternative) {
    throw new Error(`${candidate.id} detailed candidate contract must be the explicit foreground alternative`);
  }
  if ('active_shell' in adapterContract) {
    throw new Error(`${candidate.id} foreground candidate adapter must use candidate_shell, not active_shell; active release shell remains contracts/app-shell-adapter.json`);
  }
  if (
    adapterContract.adapter_id !== candidate.id ||
    adapterContract.candidate_shell !== candidate.id ||
    adapterContract.adapter_role !== 'foreground_alternative_candidate_adapter'
  ) {
    throw new Error(`${candidate.id} foreground candidate adapter must declare candidate_shell adapter identity`);
  }
  if (
    adapterContract.purpose !== 'active_shell_adapter' ||
    adapterContract.state !== 'active' ||
    adapterContract.candidate_stage !==
      'opl_studio_single_app_server_adapter_candidate_only' ||
    adapterContract.gui_authority?.implementation_role !==
      'foreground_alternative_candidate_implementation_carrier'
  ) {
    throw new Error(`${candidate.id} adapter must preserve the shared adapter schema and single App Server adapter candidate stage`);
  }
  if (adapterContract.shell_root !== candidate.candidate_root) {
    throw new Error(`${candidate.id} adapter contract must point at ${candidate.candidate_root}`);
  }
  if (adapterContract.shell_source.checkout_path !== candidate.candidate_root) {
    throw new Error(`${candidate.id} adapter checkout_path must match candidate_root`);
  }
  if (adapterContract.shell_source.history_policy !== 'external_checkout_not_merged_into_app_default_branch') {
    throw new Error(`${candidate.id} adapter must keep external checkout history policy`);
  }
  if (adapterContract.release_role !== 'experimental_candidate_shell') {
    throw new Error(`${candidate.id} adapter release_role must be experimental_candidate_shell`);
  }
  if (
    adapterContract.codex_executable_contract?.resolver_env !== 'OPL_CODEX_BIN' ||
    adapterContract.codex_executable_contract.carrier?.kind !==
      'candidate_owned_or_exact_external_binary' ||
    adapterContract.codex_executable_contract.carrier.manifest_parser_owner !== null ||
    adapterContract.codex_executable_contract.carrier.aioncore_required !== false
  ) {
    throw new Error(`${candidate.id} adapter must resolve Codex directly without an AionCore runtime or manifest dependency`);
  }
  if (adapterContract.shell_contract.source_topology !== candidate.source_topology) {
    throw new Error(`${candidate.id} adapter source_topology must match candidate registry`);
  }
  if (!adapterContract.shell_contract.capabilities.includes('candidate_app_bundle_package')) {
    throw new Error(`${candidate.id} adapter must declare candidate_app_bundle_package capability`);
  }
  assertStringArrayIncludes(
    adapterContract.shell_contract.capabilities,
    requiredNativeThreadCapabilities,
    `${candidate.id} adapter thread capabilities`,
  );
  assertStringArrayIncludes(
    adapterContract.shell_contract.capabilities,
    requiredNativeP1Capabilities,
    `${candidate.id} adapter P1 capabilities`,
  );
  if (
    'cross_top_level_thread_authority' in adapterContract ||
    'local_p0_p1_implementation_evidence' in candidate ||
    forbiddenNativePrivateCapabilities.some(
      (capability) =>
        candidate.required_capabilities.includes(capability) ||
        adapterContract.shell_contract.capabilities.includes(capability),
    )
  ) {
    throw new Error(`${candidate.id} registry and adapter must not retain private cross-thread coordination contracts or capabilities`);
  }
  validateNativeThreadAdapterBoundary(adapterContract.thread_adapter_boundary);
  validateNativeP1BaselineBridge(adapterContract.p1_baseline_bridge);
  assertDeepEqualJson(
    adapterContract.delivery_topology,
    {
      product_profile_ref: 'contracts/app-product-profile.json#delivery_topology',
      topology_authority: false,
      renderer: 'deepseek_harness_derived_react',
      shared_host_core: 'scripts/webui-host/host-core.mjs',
      desktop_adapter: 'desktop/main.mjs + desktop/preload.cjs',
      desktop_platforms: ['macos', 'windows', 'linux'],
      web_adapter: 'http_sse',
      web_runtime_forms: ['standalone_headless_webui', 'docker_webui'],
      bridge_abi: 'opl_app_host_bridge.v1',
      carrier_evidence_manifest: {
        schema: 'opl_studio_carrier_evidence.v1',
        path: 'out/opl-studio-carrier-evidence-manifest.json',
        candidate_only: true,
        release_authority: false,
      },
      carrier_entries: {
        electron_desktop: {
          host_adapter: 'desktop/main.mjs + desktop/preload.cjs',
          package_config: 'electron-builder.yml',
          update_adapter: 'desktop/updater.mjs',
        },
        standalone_headless_webui: {
          host_adapter: 'scripts/headless/run.mjs + scripts/headless/server.mjs',
          service_manager: 'scripts/headless/service-manager.mjs',
          installer: 'scripts/headless/installer.mjs',
          update_adapter: 'scripts/headless/update-runner.mjs',
        },
        docker_webui: {
          host_adapter: 'Dockerfile + docker-compose.distribution.yaml',
          distribution_manager: 'scripts/oci/manage.mjs',
          multi_arch_plan: 'scripts/oci/build-plan.mjs',
          update_adapter: 'scripts/oci/manage.mjs',
        },
      },
      aionui_or_aioncore_dependency_allowed: false,
      active_release_carrier: false,
    },
    `${candidate.id} adapter delivery topology`,
  );
  if (!adapterContract.validation_commands.some((entry) => entry.id === 'candidate_app_bundle_build')) {
    throw new Error(`${candidate.id} adapter validation_commands must include candidate_app_bundle_build`);
  }
}

function validateCandidateImplementationBasis(candidate: ShellCandidate): void {
  assertStringArrayIncludes(candidate.implementation_basis, [
    'one DeepSeek Harness-derived React renderer with a shared Node host core',
    'Electron thin desktop carrier for macOS Windows and Linux plus HTTP/SSE standalone and Docker adapters',
    'OPL App state/action contract first',
    'DeepSeek Harness AppFrame sidebar conversation composer Settings theme SlotCore createSlotRenderer and primitives reused from one pinned MIT source cohort',
    'OPL branding bridges and custom functions implemented outside the DSH vendor snapshot as adapters and slot plugins',
    'independent shell repo mounted under shells/opl-studio',
  ], `${candidate.id}.implementation_basis`);
}

const expectedCarrierEvidenceContract: OPLStudioCarrierEvidenceContract = {
  schema: 'opl_studio_carrier_evidence.v1',
  manifest_path: 'out/opl-studio-carrier-evidence-manifest.json',
  candidate_only: true,
  release_authority: false,
  product_profile_owner: 'one-person-lab-app',
  shared_renderer: 'deepseek_harness_derived_react',
  shared_host_core: 'scripts/webui-host/host-core.mjs',
  bridge_abi: 'opl_app_host_bridge.v1',
  required_entries: ['electron_desktop', 'standalone_headless_webui', 'docker_webui'],
  current_aionui_release_evidence_may_close_successor_entry: false,
  entries: {
    electron_desktop: {
      source_refs: [
        'src/workbench/App.tsx',
        'scripts/webui-host/host-core.mjs',
        'desktop/main.mjs',
        'desktop/preload.cjs',
        'electron-builder.yml',
      ],
      package_artifact_kind: 'electron_app_bundle',
      qualification_commands: ['npm run test:desktop', 'npm run package:desktop', 'npm run validate:package'],
      user_service_manager_source: { status: 'not_applicable', platforms: [] },
      distribution_wiring_status: 'not_wired',
      update_adapter_source: { status: 'implemented', ref: 'desktop/updater.mjs' },
      update_wiring_status: 'not_wired',
      release: {
        signed: 'not_proven',
        notarized: 'not_proven',
        public_feed: 'not_published',
        release_admission: 'not_admitted',
      },
    },
    standalone_headless_webui: {
      source_refs: [
        'src/workbench/App.tsx',
        'scripts/webui-host/host-core.mjs',
        'scripts/headless/run.mjs',
        'scripts/headless/server.mjs',
        'scripts/headless/installer.mjs',
        'scripts/headless/service-manager.mjs',
      ],
      package_artifact_kind: 'standalone_webui_bundle',
      qualification_commands: ['npm run test:headless', 'npm run smoke:webui'],
      user_service_manager_source: { status: 'implemented', platforms: ['macos', 'linux', 'windows'] },
      distribution_wiring_status: 'not_wired',
      update_adapter_source: { status: 'implemented', ref: 'scripts/headless/update-runner.mjs' },
      update_wiring_status: 'not_wired',
      release: {
        signed: 'not_applicable',
        notarized: 'not_applicable',
        public_feed: 'not_published',
        release_admission: 'not_admitted',
      },
    },
    docker_webui: {
      source_refs: [
        'src/workbench/App.tsx',
        'scripts/webui-host/host-core.mjs',
        'Dockerfile',
        'docker-compose.distribution.yaml',
        'scripts/oci/manage.mjs',
        'scripts/oci/build-plan.mjs',
      ],
      package_artifact_kind: 'local_oci_smoke_receipt',
      qualification_commands: ['node --test tests/oci/*.test.mjs', 'npm run smoke:docker'],
      user_service_manager_source: { status: 'not_applicable', platforms: [] },
      distribution_wiring_status: 'not_wired',
      update_adapter_source: { status: 'implemented', ref: 'scripts/oci/manage.mjs' },
      update_wiring_status: 'not_wired',
      release: {
        signed: 'not_applicable',
        notarized: 'not_applicable',
        public_feed: 'not_published',
        release_admission: 'not_admitted',
      },
      multi_arch_qualification: 'plan_only_not_qualified',
      signature_verification: 'not_implemented',
    },
  },
};

export function validateCandidateCarrierEvidenceContract(candidate: ShellCandidate): void {
  assertDeepEqualJson(
    candidate.carrier_evidence_contract,
    expectedCarrierEvidenceContract,
    `${candidate.id}.carrier_evidence_contract`,
  );
}

function validateCandidateTargetProductShape(candidate: ShellCandidate): void {
  if (
    candidate.target_product_shape.codex_cli_fixed_executor !== true ||
    candidate.target_product_shape.home_executor_selector_visible !== false ||
    candidate.target_product_shape.home_backend_selector_visible !== false ||
    candidate.target_product_shape.home_model_selector_visible !== true ||
    candidate.target_product_shape.permission_mode_selector_visible !== false ||
    candidate.target_product_shape.workspace_session_rail_default_visible !== true ||
    candidate.target_product_shape.inspector_default_visible !== false
  ) {
    throw new Error(`${candidate.id} must preserve Codex fixed-executor chat-first home with App-owned model selector, the candidate-specific project rail default, and no backend/permission/default inspector`);
  }
  assertStringArrayIncludes(candidate.target_product_shape.purpose_entries, requiredHomeEntries, `${candidate.id}.target_product_shape.purpose_entries`);
  if (candidate.target_product_shape.settings_policy !== 'app_state_refs_only') {
    throw new Error(`${candidate.id}.target_product_shape.settings_policy must keep Settings App-owned and refs-only`);
  }
  if (Object.hasOwn(candidate.target_product_shape, 'runtime_page_policy')) {
    throw new Error(`${candidate.id}.target_product_shape must keep run status in the on-demand right context instead of a separate core Runtime route`);
  }
  if (
    candidate.target_product_shape.default_visual_basis !== 'deepseek_harness_direct_source_chat_first' ||
    candidate.target_product_shape.right_context_user_request_only !== true ||
    candidate.target_product_shape.co_scientist_split_screen_default !== false ||
    candidate.target_product_shape.mas_autonomous_research_default !== true ||
    candidate.target_product_shape.right_context_default !== 'closed' ||
    candidate.target_product_shape.runtime_detail_slot !== 'ui_contributions.runtime.detail' ||
    candidate.target_product_shape.files_input_policy !== 'user_selected_files_and_directories_only' ||
    candidate.target_product_shape.results_policy !== 'owner_projected_artifacts_only_no_action_json' ||
    candidate.target_product_shape.package_lifecycle_surface !== 'settings'
  ) {
    throw new Error(`${candidate.id}.target_product_shape must encode the DSH direct-source chat-first basis and MAS autonomous research interaction`);
  }
  if (JSON.stringify(candidate.target_product_shape.left_rail_items) !== JSON.stringify(['projects', 'conversations', 'search', 'settings'])) {
    throw new Error(`${candidate.id}.target_product_shape.left_rail_items must be exactly projects, conversations, search, and settings`);
  }
  if (JSON.stringify(candidate.target_product_shape.right_context_modules) !== JSON.stringify(['run_status', 'files_results', 'agents_capabilities'])) {
    throw new Error(`${candidate.id}.target_product_shape.right_context_modules must be exactly run status, files and results, and agents and capabilities`);
  }
  assertStringArrayIncludes(candidate.target_product_shape.runtime_status_sources, [
    'codex_app_server_current_thread',
    'opl_app_state_active_project_lines',
  ], `${candidate.id}.target_product_shape.runtime_status_sources`);
  const identity = candidate.target_product_shape.product_identity;
  if (
    JSON.stringify(identity.visible_text) !== JSON.stringify(['One Person Lab']) ||
    identity.logo_visible !== false ||
    identity.bundle_icon_allowed !== true
  ) {
    throw new Error(`${candidate.id}.target_product_shape.product_identity must use One Person Lab text without an in-app Logo`);
  }
  validateCandidateAiFirstInteractionModel(candidate);
}

function validateCandidateAiFirstInteractionModel(candidate: ShellCandidate): void {
  const model = candidate.ai_first_interaction_model;
  if (
    !model ||
    model.default_visual_basis !== 'deepseek_harness_direct_source_chat_first' ||
    model.primary_policy !== 'maximize_direct_ai_interaction_on_the_chat_canvas' ||
    model.right_context_policy !== 'collapsed_user_requested_secondary_layer' ||
    model.mas_autonomy_policy !== 'MAS_runs_as_autonomous_research_execution_not_co_scientist_pair_work'
  ) {
    throw new Error(`${candidate.id}.ai_first_interaction_model must preserve composer-first interaction and collapsed secondary context`);
  }
  assertStringArrayIncludes(model.on_demand_context_policy, [
    'run_status_from_current_thread_and_active_project_lines',
    'hypotheses_and_roadmap_from_runtime_detail_contributions',
    'files_and_results_open_only_on_user_request',
    'agents_and_capabilities_render_as_a_searchable_live_catalog',
  ], `${candidate.id}.ai_first_interaction_model.on_demand_context_policy`);
  assertStringArrayIncludes(model.must_not, [
    'default_three_column_scientific_workbench',
    'default_open_artifact_inspector',
    'co_scientist_side_by_side_monitoring_assumption',
    'foreign_runtime_or_domain_authority_transfer',
  ], `${candidate.id}.ai_first_interaction_model.must_not`);
}

function validateCandidateMinimumAcceptance(candidate: ShellCandidate): void {
  assertStringArrayIncludes(candidate.technical_verification?.minimum_acceptance ?? [], [
    'default App release adapter still validates as aionui',
    'candidate registry validates without changing release_shell_contract',
    'candidate adapter can be selected only through OPL_APP_SHELL_ADAPTER_CONTRACT',
    'candidate consumes OPL App state/action contracts without owning runtime or domain truth',
    'candidate state-model validation proves active project line projection consumption from opl app state without domain-ready, production-ready, clean-VM-ready, Full-release-ready, or active-shell-adopted claims',
    'Electron desktop standalone WebUI and Docker WebUI use the same DSH-derived React renderer shared Node host core and App-owned bridge ABI',
    'ordinary UI keeps only projects, conversations, search, and Settings in the left rail and opens run status, files and results, or agents and capabilities in the DSH details column on demand',
    'runtime status consumes the current Codex thread and active_project_lines while hypotheses and roadmaps come from owner-projected runtime.detail contributions',
    'in-app identity is text-only One Person Lab while platform bundle icons remain allowed',
    'WebUI parity evidence proves the same renderer host core and product semantics as Electron desktop',
    'one Codex App Server adapter exposes canonical thread list, read, start, resume, fork, archive, unarchive, and ordinary turn start and steer',
    'standard Agent selection binds package_id, shortcut_id, codex_visible_entry, and required_skill_ids to thread/start plus turn/start without creating a Framework activation action',
    'running-turn submissions use turn/steer and idle submissions use turn/start while queued input stays renderer-ephemeral until App Server acceptance',
    'Gateway login uses loginGatewayAccount without generic action secret payloads and all other Gateway mutations use the projected action ids',
    'Agent Package lifecycle actions come dynamically from complete directory available_actions entries without a Shell allowlist or inferred semantics',
    'OPL Base and OPL Packages use Framework managed-update capabilities while OPL App uses one logical update contract with carrier-specific update and restart adapters plus fresh terminal readback',
    'Codex subagent metadata, source kinds, and thread items remain read-only projections from Codex Core and App Server',
    'successor source acceptance requires no private coordination host, model-triggered cross-thread tools, OPL-owned host queue, JSONL coordination ledger, bilateral receipts, write-set advisory, coordination idempotency, or cross-host handoff layer',
  ], `${candidate.id}.technical_verification.minimum_acceptance`);
}

function validateCandidateFrameworkSurfaces(candidate: ShellCandidate): void {
  for (const [surface, expected] of Object.entries(expectedFrameworkSurfaces)) {
    if (candidate.framework_surfaces[surface] !== expected) {
      throw new Error(`${candidate.id}.framework_surfaces.${surface} must be ${expected}`);
    }
  }
}

function validateCandidateStateModelCommand(candidate: ShellCandidate): void {
  validateActiveProjectLineStateModel(candidate.active_project_line_state_model, `${candidate.id}.active_project_line_state_model`);
  const stateModelTechnicalCommand = candidate.technical_verification?.candidate_shell_commands?.find((entry) => entry.id === 'state_model');
  if (
    !stateModelTechnicalCommand ||
    stateModelTechnicalCommand.cwd !== candidate.candidate_root ||
    stateModelTechnicalCommand.command !== 'npm run validate:state-model'
  ) {
    throw new Error(`${candidate.id}.technical_verification.candidate_shell_commands must include state_model running npm run validate:state-model from ${candidate.candidate_root}`);
  }
}

function validateCandidateSeriesDisplayContract(candidate: ShellCandidate): void {
  const seriesDisplay = candidate.foundry_agent_series_display_contract;
  if (!seriesDisplay) {
    throw new Error(`${candidate.id} must declare foundry_agent_series_display_contract`);
  }
  if (seriesDisplay.authority !== 'opl_framework_shared_progress_projection') {
    throw new Error(`${candidate.id}.foundry_agent_series_display_contract.authority must be opl_framework_shared_progress_projection`);
  }
  if (seriesDisplay.display_policy !== 'classification_only_no_domain_artifact_body') {
    throw new Error(`${candidate.id}.foundry_agent_series_display_contract.display_policy must forbid domain artifact body display`);
  }
  assertStringArrayIncludes(
    seriesDisplay.required_shared_progress_fields,
    requiredSeriesProgressFields,
    `${candidate.id}.foundry_agent_series_display_contract.required_shared_progress_fields`,
  );
  assertStringArrayIncludes(
    seriesDisplay.forbidden_domain_fields,
    forbiddenSeriesDomainFields,
    `${candidate.id}.foundry_agent_series_display_contract.forbidden_domain_fields`,
  );
}

function validateCandidateAuthorityBoundaries(candidate: ShellCandidate): void {
  assertStringArrayIncludes(candidate.required_capabilities, requiredNativeCapabilities, `${candidate.id}.required_capabilities`);
  if (candidate.required_capabilities.includes('runtime_summary_detail_action_bridge')) {
    throw new Error(`${candidate.id}.required_capabilities must omit the Runtime parity capability from Native phase one`);
  }
  assertStringArrayIncludes(candidate.must_not_own, forbiddenAuthority, `${candidate.id}.must_not_own`);
  assertStringArrayIncludes(candidate.forbidden_home_controls, [
    'Aion CLI backend choice',
    'Claude Code backend choice',
    'generic backend selector',
    'non-App-owned model override selector',
    'permission mode selector',
    'provider marketplace',
  ], `${candidate.id}.forbidden_home_controls`);
  assertStringArrayIncludes(candidate.non_goals, [
    'do not switch active_shell away from aionui',
    'do not enter default stable or nightly release packaging',
    'do not introduce runtime or domain truth into the App repo',
    'do not continue AGUI/CopilotKit implementation as the OPL Studio route',
    'do not add a private coordination host, model-triggered cross-thread tools, OPL-owned queue, coordination ledger, receipts, advisory, idempotency, or cross-host handoff layer',
    'do not claim release-ready from contract-only evidence',
  ], `${candidate.id}.non_goals`);
}

function validateCandidateValidationCommands(candidate: ShellCandidate): void {
  for (const entry of [
    ...candidate.validation_commands,
    ...(candidate.technical_verification?.manual_verification_commands ?? []),
  ]) {
    if (!entry.id || !entry.cwd || !entry.command) {
      throw new Error(`${candidate.id} has invalid validation command ${JSON.stringify(entry)}`);
    }
    const cwdPath = path.join(root, entry.cwd);
    if (!fs.existsSync(cwdPath)) {
      if (missingCandidateCheckoutCanBeBlocked(candidate) && entry.cwd === candidate.candidate_root) {
        continue;
      }
      assertFile(cwdPath, `${candidate.id} validation cwd ${entry.id}`);
    }
  }
  const bundleCommand = candidate.validation_commands.find((entry) => entry.id === 'candidate_app_bundle_build');
  if (!bundleCommand) {
    throw new Error(`${candidate.id} validation_commands must include candidate_app_bundle_build`);
  }
  const webUiSmokeCommand = candidate.validation_commands.find((entry) => entry.id === 'candidate_webui_smoke');
  if (!webUiSmokeCommand) {
    throw new Error(`${candidate.id} validation_commands must include candidate_webui_smoke`);
  }
  const stateModelCommand = candidate.validation_commands.find((entry) => entry.id === 'candidate_state_model');
  if (!stateModelCommand) {
    throw new Error(`${candidate.id} validation_commands must include candidate_state_model`);
  }
  if (stateModelCommand.cwd !== candidate.candidate_root || stateModelCommand.command !== 'npm run validate:state-model') {
    throw new Error(`${candidate.id} candidate_state_model must run npm run validate:state-model from ${candidate.candidate_root}`);
  }
  if (webUiSmokeCommand.cwd !== candidate.candidate_root || !webUiSmokeCommand.command.includes('npm run smoke:webui')) {
    throw new Error(`${candidate.id} candidate_webui_smoke must run npm run smoke:webui from ${candidate.candidate_root}`);
  }
  if (
    bundleCommand.cwd !== '.'
    || !bundleCommand.command.includes(`OPL_APP_SHELL_ADAPTER_CONTRACT=${candidate.adapter_contract} npm run package`)
  ) {
    throw new Error(`${candidate.id} candidate_app_bundle_build must run App-root npm package with the candidate adapter contract`);
  }
}

function validateCandidatePackageScriptSurfaces(candidate: ShellCandidate): void {
  if (missingCandidateCheckoutCanBeBlocked(candidate)) {
    return;
  }
  assertFile(path.join(root, candidate.candidate_root, 'scripts', 'validate-opl-studio-candidate.mjs'), `${candidate.id} self-check`);
  assertCandidateFileContains(candidate, 'package.json', [
    '"build:desktop"',
    '"package:desktop"',
    '"build:webui"',
    '"webui"',
    '"smoke:webui"',
    '"test:webui-host"',
    '"validate:state-model"',
  ], 'package scripts for the shared renderer, Electron desktop, and headless WebUI');
}

export function validateCandidate(candidate: ShellCandidateEntry, policy: CandidateValidationPolicy): void {
  validateCandidateRegistryEntry(candidate, policy);
  if (isCandidateRoleTombstone(candidate)) {
    validateCandidateRoleTombstone(candidate, policy);
    return;
  }
  if (candidate.id !== policy.onlyForegroundAlternative) {
    throw new Error(`${candidate.id} detailed candidate entry must be the explicit foreground alternative`);
  }
  const adapterContract = readCandidateAdapterContract(candidate);
  validateCandidateAdapterContract(candidate, adapterContract, policy);
  validateCandidateImplementationBasis(candidate);
  validateCandidateCarrierEvidenceContract(candidate);
  validateOPLStudioCandidateContract(candidate);
  validateCandidateChatTarget(candidate);
  validateCandidateWebUiTransport(candidate);
  validateCandidateTargetProductShape(candidate);
  validateCandidateMinimumAcceptance(candidate);
  validateCandidateFrameworkSurfaces(candidate);
  validateCandidateStateModelCommand(candidate);
  validateCandidateSeriesDisplayContract(candidate);
  validateCandidateAuthorityBoundaries(candidate);
  validateCandidateValidationCommands(candidate);
  validateCandidatePackageScriptSurfaces(candidate);
}

function validateOPLStudioCandidateContract(candidate: ShellCandidate): void {
  if (candidate.foreground_alternative_role !== 'only_foreground_alternative') {
    throw new Error(`${candidate.id}.foreground_alternative_role must be only_foreground_alternative`);
  }
  if (
    candidate.source_upstream?.repo !== 'gaofeng21cn/opl-studio' ||
    candidate.source_upstream.app_path !== '.' ||
    candidate.source_upstream.license !== 'Apache-2.0'
  ) {
    throw new Error(`${candidate.id}.source_upstream must point to gaofeng21cn/opl-studio under Apache-2.0`);
  }
  if (
    candidate.candidate_stage !==
    'opl_studio_single_app_server_adapter_candidate_only'
  ) {
    throw new Error(`${candidate.id}.candidate_stage must remain a single App Server adapter candidate only`);
  }
  const maintenance = candidate.maintenance_policy;
  if (
    maintenance?.mode !== 'active_product_development_release_admission_separate' ||
    maintenance.automatic_or_scheduled_work_allowed !== false ||
    maintenance.product_development_required !== true ||
    maintenance.current_mainline !== false ||
    maintenance.minimum_complete_product_obligation !== true ||
    maintenance.aionui_feature_parity_obligation !== false ||
    maintenance.release_blocking !== false
  ) {
    throw new Error(`${candidate.id}.maintenance_policy must require the OPL minimum-complete product without making release or AionUI parity implicit`);
  }
  if (candidate.minimum_complete_contract_ref !== 'contracts/app-product-profile.json#delivery_topology.minimum_complete_product') {
    throw new Error(`${candidate.id}.minimum_complete_contract_ref must point to the App-owned Native product contract`);
  }
  const p1 = candidate.p1_baseline_contract;
  if (
    p1?.runtime_bridge_ref !== 'contracts/app-runtime-bridge.json#native_minimum_product_bridge' ||
    p1.adapter_binding_ref !== 'contracts/shell-adapters/opl-studio.json#p1_baseline_bridge'
  ) {
    throw new Error(`${candidate.id}.p1_baseline_contract must bind the App runtime bridge and Native adapter without creating a second control plane`);
  }
  assertStringArrayIncludes(p1.required_user_outcomes, [
    'standard Agent selection launches a canonical Codex thread and first turn without a Framework activation action',
    'running-turn input uses Codex turn/steer while idle input uses turn/start and no persistent Shell queue exists',
    'Gateway login uses the dedicated secret bridge while non-secret account actions use projected App actions',
    'Agent Package lifecycle renders every complete projected available_action without an action-id allowlist',
    'OPL Base and OPL Packages updates use Framework managed-update host capabilities and terminal readback',
    'OPL App update check, apply, restart, and running-version readback stay App-owned behind carrier-specific adapters',
  ], `${candidate.id}.p1_baseline_contract.required_user_outcomes`);
  assertStringArrayIncludes(p1.forbidden_parallel_control_planes, [
    'shell_owned_action_bus',
    'shell_owned_package_registry',
    'shell_owned_persistent_turn_queue',
    'second_agent_runtime',
    'second_managed_updater',
  ], `${candidate.id}.p1_baseline_contract.forbidden_parallel_control_planes`);
  assertStringArrayIncludes(
    candidate.required_capabilities,
    requiredNativeP1Capabilities,
    `${candidate.id}.required_capabilities`,
  );
  const runtimeDependency = candidate.runtime_dependency_policy;
  if (
    runtimeDependency?.aioncore_required !== false ||
    runtimeDependency.aionui_required !== false ||
    runtimeDependency.codex_app_server_source !== 'OPL_CODEX_BIN_or_exact_external_codex' ||
    runtimeDependency.opl_integration !== 'framework_app_state_action_contracts_only' ||
    runtimeDependency.multi_backend_abstraction_required !== false ||
    runtimeDependency.thread_store_owner !== 'codex_core_app_server' ||
    !runtimeDependency.forbidden_dependencies.includes('AionUI runtime') ||
    !runtimeDependency.forbidden_dependencies.includes('AionCore runtime') ||
    !runtimeDependency.forbidden_dependencies.includes('AionCore managed-resources manifest') ||
    !runtimeDependency.forbidden_dependencies.includes('AionCore session or database state')
  ) {
    throw new Error(`${candidate.id}.runtime_dependency_policy must keep Native independent from AionUI/AionCore and scoped to Codex App Server`);
  }
  if (
    candidate.checkout_policy?.primary_path !== 'shells/opl-studio' ||
    candidate.checkout_policy.accepted_alternate_path !== '../opl-studio' ||
    candidate.checkout_policy.missing_checkout_status !== 'blocked_missing_checkout'
  ) {
    throw new Error(`${candidate.id}.checkout_policy must accept shells/opl-studio or ../opl-studio and report blocked_missing_checkout`);
  }
  if (
    candidate.build_wrapper?.adapter_contract !== candidate.adapter_contract ||
    candidate.build_wrapper.app_root_command !== `OPL_APP_SHELL_ADAPTER_CONTRACT=${candidate.adapter_contract} npm run package` ||
    candidate.build_wrapper.missing_checkout_blocker_allowed !== true
  ) {
    throw new Error(`${candidate.id}.build_wrapper must route through the App-root explicit adapter and allow missing-checkout blocker reporting`);
  }
  const visual = candidate.visual_parity_contract as NativeVisualParityContract | undefined;
  if (
    visual?.comparison_baseline !== 'DeepSeek Harness 47f943859bef60e4160492346772ded9b24f765a selected GUI source' ||
    visual.visual_style_baseline !== 'DeepSeek Harness selected MIT GUI source plus One Person Lab App-owned product constraints' ||
    visual.visual_style_scope !== 'light_workbench_palette_system_font_stack_type_scale_weight_line_height_sidebar_density_and_composer_surface' ||
    visual.visual_token_source !== 'deepseek-harness/packages/client/ui-theme/src/styles/design-platform.css@47f943859bef60e4160492346772ded9b24f765a' ||
    visual.font_asset_policy !== 'reuse_deepseek_harness_system_font_behavior_without_copying_unrelated_assets' ||
    visual.current_reference_status !== 'pinned_direct_source_reuse' ||
    visual.regression_floor !== 'AionUI active release shell' ||
    visual.source_usage !== 'direct_mit_package_and_selected_source_reuse' ||
    visual.minimum_bar !== 'direct_dsh_primitives_slots_layout_and_error_isolation_with_opl_owned_authority' ||
    visual.model_policy_source !== 'contracts/app-product-profile.json#gui.home.codex_model_display_options' ||
    visual.default_model !== configuredDefaultModel ||
    visual.default_reasoning_effort !== configuredDefaultReasoningEffort ||
    visual.docs_or_contract_only_completion_allowed !== false
  ) {
    throw new Error(`${candidate.id}.visual_parity_contract must consume the App-owned configured model policy, preserve the AionUI regression floor, and forbid docs-only completion`);
  }
  assertStringArrayIncludes(
    visual.superseded_observations ?? [],
    [
      'ChatGPT Codex macOS 26.707.31428 (2026-07-10)',
      'ChatGPT Codex macOS 26.707.31123 (2026-07-10)',
    ],
    `${candidate.id}.visual_parity_contract.superseded_observations`,
  );
  assertStringArrayIncludes(
    visual.required_surfaces ?? [],
    requiredNativeVisualParitySurfaces,
    `${candidate.id}.visual_parity_contract.required_surfaces`,
  );
  assertStringArrayIncludes(visual.required_evidence, [
    'desktop source provenance review against the pinned DeepSeek Harness selected GUI source',
    'desktop pixel regression against the App-owned approved visual baseline',
    'persistent project rail and single conversation timeline screenshot comparison',
    'composer model and reasoning controls screenshot comparison',
    'on-demand DeepSeek Harness details column screenshot comparison',
    'Settings locale surface screenshot comparison',
    'webui screenshot comparison against desktop renderer',
    'packaged app screenshot or VM smoke artifact',
  ], `${candidate.id}.visual_parity_contract.required_evidence`);
}

export function validateCandidateImplementationFiles(candidate: ShellCandidate): void {
  assertCandidateFileContains(candidate, 'src/vendor/deepseek-harness/packages/client/ui-layout/src/client/AppFrame.tsx', [
    'export function AppFrame',
    "renderSlot('sidebar'",
    "renderSlot('conversation'",
    "renderSlot('details'",
  ], 'vendored DeepSeek Harness AppFrame');
  assertCandidateFileContains(candidate, 'src/vendor/deepseek-harness/packages/client/ui-sidebar/src/client/SidebarRoot.tsx', [
    'export function SidebarRoot',
    "renderSlot('sidebar.workspaces'",
  ], 'vendored DeepSeek Harness SidebarRoot');
  assertCandidateFileContains(candidate, 'src/vendor/deepseek-harness/packages/client/ui-conversation/src/client/skeleton/ConversationRoot.tsx', [
    'export function ConversationRoot',
  ], 'vendored DeepSeek Harness ConversationRoot');
  assertCandidateFileContains(candidate, 'src/vendor/deepseek-harness/packages/client/ui-conversation/src/client/skeleton/InputBar.tsx', [
    'export function InputBar',
  ], 'vendored DeepSeek Harness InputBar');
  assertCandidateFileContains(candidate, 'src/vendor/deepseek-harness/packages/client/ui-settings-general/src/client/SettingsRoot.tsx', [
    'export function SettingsRoot',
    "renderSlot('settings.section'",
  ], 'vendored DeepSeek Harness SettingsRoot');
  assertCandidateFileContains(candidate, 'src/vendor/deepseek-harness/packages/client/ui-theme/src/styles/design-platform.css', [
    '--dsw-static-deepseek-450',
    '--dsw-specific-sidebar-fill',
  ], 'vendored DeepSeek Harness UI theme');
  assertCandidateFileContains(candidate, 'src/vendor/deepseek-harness/packages/client/ui-primitives/src/index.ts', [
    "export { Button } from './Button.tsx'",
    "export { Menu } from './Menu.tsx'",
    "export { RiskConfirmation } from './RiskConfirmation.tsx'",
    "export * from './icons/index.tsx'",
  ], 'vendored DeepSeek Harness UI primitives');
  assertCandidateFileContains(candidate, 'src/vendor/deepseek-harness/packages/client/ui-primitives/src/Button.tsx', [
    "import css from './Button.module.css'",
    'export function Button',
  ], 'vendored DeepSeek Harness Button primitive');
  assertCandidatePathAbsent(
    candidate,
    'src/integrations/deepseek-harness/uiPrimitives.tsx',
    'the handwritten DeepSeek Harness primitives replacement',
  );
  assertCandidateFileContains(candidate, 'src/composition/dshSlotHost.tsx', [
    'SlotCore',
    'createSlotRenderer',
    'AppFrame',
    'SidebarRoot',
    'ConversationRoot',
    'InputBar',
    'SettingsRoot',
    '<AppFrame',
    '<SidebarRoot',
    '<ConversationRoot',
    '<InputBar',
    '<SettingsRoot',
    'renderRoot()',
  ], 'DeepSeek Harness slot host and rendered GUI composition');
  assertCandidateFileContains(candidate, 'src/main.tsx', [
    'renderOplStudioRoot',
    'createRoot(rootElement).render(renderOplStudioRoot())',
  ], 'DeepSeek Harness composition entrypoint');
  assertCandidateFileContains(candidate, 'src/workbench/App.tsx', [
    'renderShell',
    'data-testid="opl-workspace-rail"',
    'data-testid="opl-session-list"',
    'data-testid="opl-context-tabs"',
    'data-testid="opl-runtime-status-panel"',
    'data-testid="opl-agent-run-status"',
    'data-testid="opl-runtime-contributions"',
    'data-testid="opl-files-results-panel"',
    'data-testid="opl-input-files-list"',
    'data-testid="opl-agents-capabilities-panel"',
    'data-testid="opl-current-agent-capabilities"',
    'data-testid="opl-codex-capability-catalog"',
    'renderContributionSlot?.("runtime.detail"',
    'data-testid="opl-web-transport"',
  ], 'OPL Studio surface producer and contextual content');
  assertCandidateFileExcludes(candidate, 'src/workbench/App.tsx', [
    'data-testid="opl-skills-panel"',
    'data-testid="opl-routing-panel"',
    'data-testid="opl-memory-panel"',
    'data-testid="opl-always-on-panel"',
    'branding/opl-app-logo.png',
  ], 'OPL Studio product layout');
  assertCandidateFileContains(candidate, 'src/workbench/SettingsPanel.tsx', [
    'data-testid="opl-locale-toggle"',
    'onSettingChange("locale", "zh")',
    'onSettingChange("locale", "en")',
  ], 'OPL Studio settings locale control');
  assertCandidateFileContains(candidate, 'src/bridge/oplBridge.ts', [
    'opl app state --profile fast --json',
    'opl app state --profile full --json',
    'opl app contribution read',
    'opl app action execute --action',
    'readContribution',
  ], 'OPL App state/action bridge');
  assertCandidateFileContains(candidate, 'src/workbench/workbenchModel.ts', [
    'results',
    'deliverables',
    'receipts',
    'activeProjectLines',
  ], 'results and delivery workbench model');
  assertCandidateFileContains(candidate, 'scripts/validate-opl-studio-candidate.mjs', [
    'src/candidateContractEvidence.json',
    'opl-workspace-rail',
    'opl-studio',
  ], 'OPL Studio self-validator');
}

function validateCandidateChatTarget(candidate: ShellCandidate): void {
  const target = candidate.codex_app_like_chat_target;
  if (!target) {
    throw new Error(`${candidate.id} must declare codex_app_like_chat_target`);
  }
  if (target.scope !== 'One Person Lab DSH-source chat-first desktop and WebUI product with contextual runtime, files, results, agents, and capabilities') {
    throw new Error(`${candidate.id} target must be the One Person Lab DSH-source chat-first product`);
  }
  assertStringArrayIncludes(target.capability_inventory, [
    'workspace directory picker',
    'new conversation and lightweight thread history rail',
    'Codex app-server backed chat turns',
    'shared DSH-derived React renderer for Electron desktop standalone WebUI and Docker WebUI',
    'shared Node host core with Electron IPC and HTTP/SSE transport adapters',
    'pinned DeepSeek Harness AppFrame SidebarRoot conversation composer Settings theme and primitives used directly',
    'chat-first main canvas with pinned composer',
    'left rail limited to projects, conversations, search, and Settings',
    'right-side on-demand Run status, Files and results, and Agents and capabilities modules',
    'current Codex agent state and active project lines rendered as run status',
    'hypotheses and roadmaps rendered from runtime.detail contribution readback',
    'user-selected files only and owner-projected artifacts without action JSON masquerading as results',
    'Agent Package lifecycle management remains in Settings',
    'text-only One Person Lab identity without an in-app Logo',
    'candidate Electron desktop packages through the App wrapper',
  ], `${candidate.id}.codex_app_like_chat_target.capability_inventory`);
}

function validateCandidateWebUiTransport(candidate: ShellCandidate): void {
  const transport = candidate.webui_transport;
  if (!transport) {
    throw new Error(`${candidate.id} must declare webui_transport`);
  }
  if (transport.shared_renderer !== true) {
    throw new Error(`${candidate.id} webui_transport.shared_renderer must be true`);
  }
  if (transport.shared_host_core !== 'scripts/webui-host/host-core.mjs') {
    throw new Error(`${candidate.id} transport must use the shared Node host core`);
  }
  if (transport.bridge_abi !== 'opl_app_host_bridge.v1') {
    throw new Error(`${candidate.id} transport must expose the App-owned bridge ABI`);
  }
  if (transport.desktop_surface !== 'Electron preload window.oplStudio') {
    throw new Error(`${candidate.id} desktop surface must expose window.oplStudio through Electron preload`);
  }
  if (transport.web_surface !== 'browser window.oplStudio HTTP/SSE adapter') {
    throw new Error(`${candidate.id} web surface must expose the browser window.oplStudio HTTP/SSE adapter`);
  }
  if (transport.desktop_adapter !== 'desktop/main.mjs + desktop/preload.cjs') {
    throw new Error(`${candidate.id} desktop adapter must use the Electron main and preload entrypoints`);
  }
  if (transport.web_bridge !== 'src/bridge/webTransport.ts') {
    throw new Error(`${candidate.id} web bridge must be src/bridge/webTransport.ts`);
  }
  if (transport.gateway !== 'scripts/dev-webui-server.mjs') {
    throw new Error(`${candidate.id} WebUI gateway must be scripts/dev-webui-server.mjs`);
  }
  if (transport.event_stream !== 'SSE /api/opl-events') {
    throw new Error(`${candidate.id} WebUI event stream must be SSE /api/opl-events`);
  }
  if (transport.desktop_picker_policy !== 'Electron desktop may use the platform directory picker; WebUI uses an explicit workspace path/action bridge without changing App product truth') {
    throw new Error(`${candidate.id} WebUI desktop picker policy must preserve App product truth`);
  }
  if (transport.electron_in_headless_or_container_allowed !== false) {
    throw new Error(`${candidate.id} must keep Electron out of headless and container runtime forms`);
  }
}

import { assertDeepEqualJson, assertIncludesAll } from './assertions.ts';

const scheduledTaskCapabilities = [
  'list',
  'get',
  'create',
  'update',
  'delete',
  'run_now',
  'pause',
  'resume',
  'history',
  'timezone_repair',
];

const legacyNonCodexJobPolicy = {
  visible: true,
  run_now_allowed: true,
  pause_resume_allowed: true,
  delete_allowed: true,
  editable_fields: ['schedule', 'prompt'],
  preserve_existing_agent_config: true,
  executor_mutation_allowed: false,
  silent_migration_allowed: false,
};

export function validateScheduledTasksProductPolicy(policy, label = 'Scheduled Tasks product policy') {
  assertDeepEqualJson(
    policy,
    {
      feature_id: 'B0-12',
      product_role: 'ordinary_scheduled_codex_tasks',
      route: '/scheduled',
      scheduler_authority: 'active_carrier_native_scheduler_and_store',
      single_scheduler_store_required: true,
      active_aionui_contract_ref:
        'contracts/app-shell-adapter.json#upstream_intake.managed_agent_api_contract.write_contracts.cron',
      navigation: {
        ordinary_sider_entry_visible: true,
        placement: 'primary_navigation_between_runtime_and_archived',
        job_section_visible_when_non_empty: true,
      },
      capabilities: scheduledTaskCapabilities,
      executor_composition: {
        executor: 'codex_cli',
        executor_selector_visible: false,
        executor_identity_source: 'active_carrier_canonical_runnable_codex_identity',
        executor_identity_requirements: [
          'canonical',
          'enabled',
          'runnable',
          'codex_cli',
        ],
        candidate_cardinality: 'exactly_one',
        unavailable_policy: 'disable_new_task_create_and_codex_executor_save_only_with_inline_guidance',
        existing_task_management_remains_available: true,
        ordinary_app_remains_available: true,
      },
      legacy_non_codex_job_policy: legacyNonCodexJobPolicy,
      forbidden_implementation_layers: [
        'second_scheduler',
        'second_task_store',
        'scheduler_migration_ledger',
        'scheduler_receipt_or_pending_state_machine',
      ],
      evidence_axes: {
        contract_implies_source: false,
        source_implies_pixel: false,
        source_implies_install: false,
        source_implies_release: false,
      },
    },
    label,
  );
}

export function validateScheduledTasksPageContract(page, productPolicy) {
  if (
    page?.state_source !== 'active_carrier_native_scheduler_projection' ||
    page?.action_source !== 'active_carrier_native_scheduler_actions' ||
    page?.policy_ref !== 'scheduled_tasks_policy' ||
    page?.route !== productPolicy?.route ||
    page?.page_kind !== 'ordinary_product_page' ||
    page?.ia_group !== 'automation'
  ) {
    throw new Error('Scheduled Tasks page must bind the ordinary route to the active carrier scheduler policy');
  }
  assertIncludesAll(
    page.must_show,
    [
      'ordinary Sider entry',
      'fixed Codex executor composition for new scheduled tasks',
      'legacy non-Codex tasks without silent executor migration',
    ],
    'Scheduled Tasks page required surfaces',
  );
  assertIncludesAll(
    page.must_not_show,
    [
      'executor selector for new OPL scheduled tasks',
      'second scheduler or task store',
      'global App blocking when the Codex scheduled-task assistant is missing or ambiguous',
    ],
    'Scheduled Tasks page forbidden surfaces',
  );
}

export function validateScheduledTasksPageState(page, productPolicy) {
  if (
    page?.expected_source !== 'active carrier native scheduler and App-owned Scheduled Tasks policy' ||
    page?.machine_source !==
      'contracts/app-gui-product-contract.json#scheduled_tasks_policy + contracts/app-shell-adapter.json#upstream_intake.managed_agent_api_contract.write_contracts.cron' ||
    page?.page_contract !== 'ordinary_scheduled_codex_tasks'
  ) {
    throw new Error('Scheduled Tasks page-state entry must reference the App product and active carrier adapter contracts');
  }
  const view = page.scheduled_tasks_view_model;
  assertDeepEqualJson(
    view,
    {
      product_policy_ref: 'contracts/app-gui-product-contract.json#scheduled_tasks_policy',
      route: productPolicy?.route,
      scheduler_authority: productPolicy?.scheduler_authority,
      ordinary_sider_entry_visible: true,
      sider_placement: 'primary_navigation_between_runtime_and_archived',
      job_section_visible_when_non_empty: true,
      executor: 'codex_cli',
      executor_selector_visible: false,
      executor_identity_source: 'active_carrier_canonical_runnable_codex_identity',
      assistant_candidate_cardinality: 'exactly_one',
      assistant_unavailable_scope: 'new_task_create_and_codex_executor_save_only',
      existing_task_management_remains_available: true,
      ordinary_app_remains_available: true,
      legacy_non_codex_jobs_remain_visible: true,
      legacy_edit_preserves_agent_config: true,
      legacy_executor_mutation_allowed: false,
      second_scheduler_store_allowed: false,
    },
    'Scheduled Tasks page-state view model',
  );
  assertDeepEqualJson(
    page.states,
    ['loading', 'empty', 'ready', 'scheduler_error', 'codex_assistant_unavailable_or_ambiguous'],
    'Scheduled Tasks page states',
  );
  assertIncludesAll(
    page.must_show,
    [
      'ordinary Sider Scheduled Tasks entry',
      'existing scheduled tasks even when new-task Codex composition is unavailable',
      'legacy non-Codex jobs without silent executor migration',
    ],
    'Scheduled Tasks page-state required surfaces',
  );
  assertIncludesAll(
    page.must_not_show,
    [
      'executor selector for new OPL scheduled tasks',
      'global App or existing-task management block caused by Codex scheduled-task assistant discovery',
      'silent rewrite of a legacy job executor during edit',
    ],
    'Scheduled Tasks page-state forbidden surfaces',
  );
}

export function validateScheduledTasksProfileProjection(nativeAutomation) {
  assertDeepEqualJson(
    nativeAutomation,
    {
      owner: 'app_automation_surface',
      cron_skill_packaged: false,
      exposure: 'automation_page_and_task_routing',
      product_policy_ref: 'contracts/app-gui-product-contract.json#scheduled_tasks_policy',
      route: '/scheduled',
      scheduler_authority: 'active_carrier_native_scheduler_and_store',
      single_scheduler_store_required: true,
      ordinary_sider_entry_visible: true,
      executor: 'codex_cli',
      executor_selector_visible: false,
    },
    'Product profile Scheduled Tasks projection',
  );
}

export function validateScheduledTasksAionuiAdapter(cron) {
  assertDeepEqualJson(
    cron,
    {
      product_policy_ref: 'contracts/app-gui-product-contract.json#scheduled_tasks_policy',
      authority: 'aioncore_cron_store_and_routes',
      route: '/scheduled',
      list_endpoint: 'listJobs',
      get_endpoint: 'getJob',
      create_endpoint: 'addJob',
      update_endpoint: 'updateJob',
      delete_endpoint: 'removeJob',
      run_now_endpoint: 'runNow',
      pause_resume_endpoint: 'updateJob.enabled',
      history_route_template: '/api/cron/jobs/{id}/conversations',
      timezone_policy: 'local_iana_timezone_on_write_and_fail_open_repair_for_missing_timezone',
      ordinary_sider_entry_visible: true,
      sider_placement: 'primary_navigation_between_runtime_and_archived',
      job_section_visible_when_non_empty: true,
      executor: 'codex_cli',
      executor_selector_visible: false,
      assistant_candidate_source: 'useConversationAgents.cliAgents',
      assistant_candidate_requirements: [
        'Assistant.source=generated',
        'Assistant.enabled=true',
        'managed_agent_runnable=true',
        'assistantRuntimeKey=codex',
      ],
      assistant_identity_source: 'Assistant.id',
      candidate_cardinality: 'exactly_one',
      assistant_unavailable_policy: 'disable_new_task_create_and_codex_executor_save_only_with_inline_guidance',
      existing_task_management_remains_available: true,
      identity_path: 'agent_config.assistant_id',
      schedule_field_map: {
        atMs: 'at_ms',
        everyMs: 'every_ms',
      },
      existing_conversation_update_agent_config: 'omit',
      aionrs_provider_identity_path: 'agent_config.model.provider_id',
      legacy_non_codex_job_policy: legacyNonCodexJobPolicy,
      second_scheduler_store_allowed: false,
    },
    'AionUI Scheduled Tasks adapter',
  );
}

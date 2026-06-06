export const firstRunCoreItems = ['workspace_root', 'codex_cli', 'codex_config'];

export const appOwnedProjectGroupExpansionPolicy = {
  running_group_default: 'expanded',
  attention_group_default: 'visible_when_nonempty',
  inactive_group_default: 'collapsed',
  inactive_states: ['queued', 'pending', 'waiting', 'stopped', 'parked', 'checkpointed', 'blocked', 'attention_needed'],
  inactive_summary_fields: ['count', 'status', 'next_visible_step'],
};

export const appOwnedRunningStatePolicy =
  'only explicit running, in_progress, or advancing status/state counts as running; active_run_id alone is context, not liveness proof';

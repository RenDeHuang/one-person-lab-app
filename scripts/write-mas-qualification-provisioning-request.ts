import crypto from 'node:crypto';
import fs from 'node:fs';

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  return `{${Object.keys(value as Record<string, unknown>).sort().map((key) => (
    `${JSON.stringify(key)}:${canonicalJson((value as Record<string, unknown>)[key])}`
  )).join(',')}}`;
}

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

const authorityFile = requiredEnv('AUTHORITY_FILE');
const requestFile = requiredEnv('REQUEST_FILE');
const runId = requiredEnv('MAS_PROVISIONING_RUN_ID');
const workspace = requiredEnv('MAS_PROVISIONING_WORKSPACE');
const issuedAt = new Date().toISOString();
const authority = {
  surface_kind: 'mas_qualification_work_item_provisioning_authority',
  schema_version: 1,
  authority_ref: `opl-release-full-vm-qualification:${runId}`,
  domain_owner: 'MedAutoScience',
  domain_id: 'medautoscience',
  canonical_workspace_root: workspace,
  qualification_scope: 'standard_agent_full_vm_qualification',
  issued_at: issuedAt,
  single_use: true,
  qualification_only: true,
  provisions_work_item: true,
  authorizes_stage_body: false,
  authorizes_business_action: false,
  authorizes_publication: false,
  authorizes_submission: false,
  provider_completion_is_domain_completion: false,
};
const authorityBytes = Buffer.from(canonicalJson(authority), 'utf8');
const authoritySha256 = crypto.createHash('sha256').update(authorityBytes).digest('hex');
const request = {
  surface_kind: 'mas_qualification_work_item_provisioning_authority_request',
  schema_version: 1,
  authority_context: {
    action_id: 'qualification_work_item_provisioning_authority_evaluate',
    handler_call_ref: `opl-handler-call:${runId}`,
    owner_ledger_ref: `opl-owner-ledger:${runId}`,
  },
  qualification_authority: {
    authority_sha256: authoritySha256,
    authority_bytes_base64: authorityBytes.toString('base64'),
    authority_byte_size: authorityBytes.byteLength,
    record: authority,
  },
  current_workspace_index: {
    exists: false,
    workspace_index_ref: 'workspace_index.json',
    workspace_index_sha256: null,
    workspace_index_bytes_base64: null,
    workspace_index_byte_size: null,
    record: null,
  },
};

fs.writeFileSync(authorityFile, authorityBytes, { mode: 0o600 });
fs.writeFileSync(requestFile, canonicalJson(request), { mode: 0o600 });

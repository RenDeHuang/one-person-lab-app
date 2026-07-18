#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs as parseNodeArgs } from 'node:util';
import { emitJsonSummary, parseJsonLines, runCleanupScript, runGh } from './release-cleanup-helpers.ts';

type ReleaseAsset = {
  name?: string;
  size?: number;
};

type ReleaseView = {
  id?: number;
  tagName?: string;
  tag_name?: string;
  name?: string;
  isDraft?: boolean;
  draft?: boolean;
  isPrerelease?: boolean;
  prerelease?: boolean;
  publishedAt?: string | null;
  published_at?: string | null;
  created_at?: string;
  html_url?: string;
  assets?: ReleaseAsset[];
};

type Options = {
  repo: string;
  version: string;
  executeRequested: boolean;
  executeRequestSource: 'implicit_dry_run' | 'dry_run' | 'legacy_execute_alias' | 'request_brokered_execute';
  releaseAttemptId: string;
  brokerAcceptanceReceiptPath: string;
  summaryPath: string;
};

type BrokerAcceptanceReceiptTrace = {
  schema?: unknown;
  status?: unknown;
  lease?: {
    attempt_id?: unknown;
    allowed_mutations?: unknown;
  };
  signature?: {
    algorithm?: unknown;
    key_id?: unknown;
    value_base64?: unknown;
  };
};

const digestRefPattern = /^sha256:[0-9a-f]{64}$/;

function parseArgs(argv: string[]): Options {
  const parsed: Options = {
    repo: process.env.OPL_RELEASE_REPO || 'gaofeng21cn/one-person-lab-app',
    version: process.env.OPL_RELEASE_VERSION || '',
    executeRequested: false,
    executeRequestSource: 'implicit_dry_run',
    releaseAttemptId: process.env.OPL_DRAFT_CLEANUP_RELEASE_ATTEMPT_ID || '',
    brokerAcceptanceReceiptPath: process.env.OPL_DRAFT_CLEANUP_BROKER_ACCEPTANCE_RECEIPT_PATH
      ? path.resolve(process.env.OPL_DRAFT_CLEANUP_BROKER_ACCEPTANCE_RECEIPT_PATH)
      : '',
    summaryPath: process.env.OPL_DRAFT_CLEANUP_SUMMARY_PATH || '',
  };

  const { values, tokens } = parseNodeArgs({
    args: argv,
    options: {
      repo: { type: 'string' },
      version: { type: 'string' },
      'summary-path': { type: 'string' },
      'release-attempt-id': { type: 'string' },
      'broker-acceptance-receipt': { type: 'string' },
      execute: { type: 'boolean' },
      'request-brokered-execute': { type: 'boolean' },
      'dry-run': { type: 'boolean' },
    },
    tokens: true,
  });
  parsed.repo = values.repo ?? parsed.repo;
  parsed.version = values.version ?? parsed.version;
  parsed.summaryPath = values['summary-path'] ? path.resolve(values['summary-path']) : parsed.summaryPath;
  parsed.releaseAttemptId = values['release-attempt-id'] ?? parsed.releaseAttemptId;
  parsed.brokerAcceptanceReceiptPath = values['broker-acceptance-receipt']
    ? path.resolve(values['broker-acceptance-receipt'])
    : parsed.brokerAcceptanceReceiptPath;
  for (const token of tokens) {
    if (token.kind !== 'option') continue;
    if (token.name === 'execute') {
      parsed.executeRequested = true;
      parsed.executeRequestSource = 'legacy_execute_alias';
    }
    if (token.name === 'request-brokered-execute') {
      parsed.executeRequested = true;
      parsed.executeRequestSource = 'request_brokered_execute';
    }
    if (token.name === 'dry-run') {
      parsed.executeRequested = false;
      parsed.executeRequestSource = 'dry_run';
    }
  }

  if (!/^[0-9]+\.[0-9]+\.[0-9]+([-+][0-9A-Za-z.-]+)?$/.test(parsed.version)) {
    throw new Error(`Invalid OPL release version: ${parsed.version}`);
  }
  return parsed;
}

function inspectBrokerAuthorization(options: Options) {
  const missing: string[] = [];
  const errors: string[] = [];
  let receiptSha256: string | null = null;
  let receiptSchema: string | null = null;
  let receiptStatus: string | null = null;
  let receiptAttemptId: string | null = null;
  let receiptAllowedMutations: string[] = [];

  if (!options.executeRequested) {
    return {
      missing,
      errors,
      receipt_sha256: receiptSha256,
      receipt_schema: receiptSchema,
      receipt_status: receiptStatus,
      receipt_attempt_id: receiptAttemptId,
      receipt_allowed_mutations: receiptAllowedMutations,
      trace_validation: 'not_requested',
    };
  }

  if (!options.releaseAttemptId) {
    missing.push('release_attempt_id');
  } else if (!digestRefPattern.test(options.releaseAttemptId)) {
    errors.push('release attempt id must be sha256:<64-lowercase-hex>');
  }
  if (!options.brokerAcceptanceReceiptPath) {
    missing.push('broker_acceptance_receipt');
  } else {
    try {
      const receiptBytes = fs.readFileSync(options.brokerAcceptanceReceiptPath);
      receiptSha256 = `sha256:${crypto.createHash('sha256').update(receiptBytes).digest('hex')}`;
      const receipt = JSON.parse(receiptBytes.toString('utf8')) as BrokerAcceptanceReceiptTrace;
      receiptSchema = typeof receipt.schema === 'string' ? receipt.schema : null;
      receiptStatus = typeof receipt.status === 'string' ? receipt.status : null;
      receiptAttemptId = typeof receipt.lease?.attempt_id === 'string' ? receipt.lease.attempt_id : null;
      receiptAllowedMutations = Array.isArray(receipt.lease?.allowed_mutations)
        ? receipt.lease.allowed_mutations.filter((value): value is string => typeof value === 'string')
        : [];
      if (receiptSchema !== 'opl_app_release_mutation_acceptance_receipt.v1' || receiptStatus !== 'accepted') {
        errors.push('broker acceptance receipt schema/status is invalid');
      }
      if (!receiptAttemptId || receiptAttemptId !== options.releaseAttemptId) {
        errors.push('broker acceptance receipt attempt id does not match the requested cleanup attempt');
      }
      if (receiptAllowedMutations.length !== 1 || receiptAllowedMutations[0] !== 'release_draft_cleanup') {
        errors.push('broker acceptance receipt is not scoped only to release_draft_cleanup');
      }
      if (
        receipt.signature?.algorithm !== 'Ed25519'
        || typeof receipt.signature.key_id !== 'string'
        || !receipt.signature.key_id
        || typeof receipt.signature.value_base64 !== 'string'
        || !receipt.signature.value_base64
      ) {
        errors.push('broker acceptance receipt signature trace is malformed');
      }
    } catch (error) {
      errors.push(`broker acceptance receipt cannot be read: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return {
    missing,
    errors,
    receipt_sha256: receiptSha256,
    receipt_schema: receiptSchema,
    receipt_status: receiptStatus,
    receipt_attempt_id: receiptAttemptId,
    receipt_allowed_mutations: receiptAllowedMutations,
    trace_validation: missing.length > 0
      ? 'missing'
      : errors.length > 0
        ? 'invalid'
        : 'structurally_bound_but_not_authorized',
  };
}

function releaseTag(release: ReleaseView) {
  return release.tag_name || release.tagName || '';
}

function releaseDraft(release: ReleaseView) {
  return release.draft ?? release.isDraft ?? false;
}

function releasePrerelease(release: ReleaseView) {
  return release.prerelease ?? release.isPrerelease ?? false;
}

function readStableRelease(options: Options) {
  const tag = `v${options.version}`;
  const result = runGh([
    'release',
    'view',
    tag,
    '--repo',
    options.repo,
    '--json',
    'tagName,name,isDraft,isPrerelease,publishedAt',
  ], { capture: true });
  const release = JSON.parse(result.stdout) as ReleaseView;
  if (releaseTag(release) !== tag || releaseDraft(release) || releasePrerelease(release)) {
    throw new Error(`${tag} must be a published stable release before draft candidates can be cleaned up.`);
  }
  return release;
}

function readAllReleases(options: Options) {
  const result = runGh([
    'api',
    `repos/${options.repo}/releases`,
    '--paginate',
    '--jq',
    '.[] | {id,tag_name,name,draft,prerelease,created_at,published_at,html_url,assets:[.assets[]? | {name,size}]}',
  ], { capture: true });
  return parseJsonLines<ReleaseView>(result.stdout);
}

function candidateTagPattern(version: string) {
  const escaped = version.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`^v${escaped}-(draft|readiness)\\.\\d{14}$`);
}

function selectCandidates(releases: ReleaseView[], version: string) {
  const pattern = candidateTagPattern(version);
  return releases
    .filter((release) => releaseDraft(release))
    .filter((release) => pattern.test(releaseTag(release)))
    .sort((left, right) => releaseTag(left).localeCompare(releaseTag(right)));
}

function summarizeCandidate(release: ReleaseView) {
  const assets = Array.isArray(release.assets) ? release.assets : [];
  return {
    id: release.id ?? null,
    tag_name: releaseTag(release),
    name: release.name ?? '',
    created_at: release.created_at ?? '',
    html_url: release.html_url ?? '',
    asset_count: assets.length,
    asset_size_bytes: assets.reduce((total, asset) => total + (Number.isFinite(asset.size) ? Number(asset.size) : 0), 0),
    assets: assets.map((asset) => ({ name: asset.name ?? '', size: asset.size ?? 0 })),
  };
}

function cleanup(options: Options) {
  const stable = readStableRelease(options);
  const releases = readAllReleases(options);
  const candidates = selectCandidates(releases, options.version).map(summarizeCandidate);
  const authorization = inspectBrokerAuthorization(options);
  const authorizationMissing = authorization.missing.length > 0;
  const authorizationInvalid = authorization.errors.length > 0;
  const blocker = !options.executeRequested
    ? null
    : authorizationMissing
      ? {
          code: 'brokered_release_draft_cleanup_authorization_required',
          retry_disposition: 'provide_independent_attempt_and_acceptance_receipt',
          reason: 'Brokered draft cleanup requires both an exact release attempt id and its signed acceptance receipt.',
          details: authorization.missing,
        }
      : authorizationInvalid
        ? {
            code: 'brokered_release_draft_cleanup_authorization_invalid',
            retry_disposition: 'replace_invalid_or_mismatched_broker_evidence',
            reason: 'The supplied broker cleanup evidence is malformed or is not bound to the requested attempt.',
            details: authorization.errors,
          }
        : {
            code: 'brokered_release_draft_cleanup_unavailable',
            retry_disposition: 'terminal_blocked_until_broker_mutation_is_provisioned',
            reason: 'The release mutation broker protocol has no signed release_draft_cleanup operation or cryptographic verifier.',
            details: [],
          };

  const summary = {
    schema: 'opl_release_draft_candidate_cleanup.v2',
    status: !options.executeRequested
      ? 'dry_run'
      : authorizationMissing
        ? 'broker_authorization_required'
        : authorizationInvalid
          ? 'broker_authorization_invalid'
          : 'brokered_cleanup_unavailable',
    repo: options.repo,
    version: options.version,
    stable_release: {
      tag_name: releaseTag(stable),
      name: stable.name ?? '',
      published_at: stable.publishedAt ?? stable.published_at ?? null,
    },
    execute_requested: options.executeRequested,
    execute_request_source: options.executeRequestSource,
    execute: false,
    deletion_performed: false,
    candidate_count: candidates.length,
    candidates,
    deleted_tags: [],
    mutation_authority: {
      required: 'independent_isolated_release_mutation_broker',
      required_mutation: 'release_draft_cleanup',
      broker_mutation_available: false,
      release_attempt_id_required: true,
      broker_acceptance_receipt_required: true,
      requested_release_attempt_id: options.releaseAttemptId || null,
      broker_acceptance_receipt: {
        path: options.brokerAcceptanceReceiptPath || null,
        sha256: authorization.receipt_sha256,
        schema: authorization.receipt_schema,
        status: authorization.receipt_status,
        lease_attempt_id: authorization.receipt_attempt_id,
        allowed_mutations: authorization.receipt_allowed_mutations,
        trace_validation: authorization.trace_validation,
      },
      authorization_verified: false,
      cryptographic_verifier: null,
      direct_github_release_delete_allowed: false,
      direct_tag_cleanup_allowed: false,
      ordinary_release_workflow_cleanup_allowed: false,
    },
    blocker,
  };
  emitJsonSummary(options.summaryPath, summary);
  if (options.executeRequested) {
    if (authorizationMissing) {
      throw new Error('Draft cleanup is blocked: --request-brokered-execute requires --release-attempt-id and --broker-acceptance-receipt.');
    }
    if (authorizationInvalid) {
      throw new Error(`Draft cleanup broker evidence is invalid: ${authorization.errors.join('; ')}`);
    }
    throw new Error('Draft cleanup is unavailable: release deletion requires a separately signed broker mutation that is not provisioned.');
  }
}

runCleanupScript((argv) => {
  cleanup(parseArgs(argv));
});

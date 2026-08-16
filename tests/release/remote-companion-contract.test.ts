import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { validateRemoteCompanionContract } from '../../scripts/validate-active-shell/remote-companion-validator.ts';

const readJson = (relativePath: string) => JSON.parse(fs.readFileSync(relativePath, 'utf8')) as Record<string, any>;

test('OPL AI Companion keeps the iOS product, transport, and authority boundaries', () => {
  const policy = readJson('contracts/app-remote-companion.json');
  assert.doesNotThrow(() => validateRemoteCompanionContract(policy));
  assert.equal(policy.product_identity.app_store_name, 'One Person Lab: AI Companion');
  assert.equal(policy.product_identity.home_screen_name, 'OPL');
  assert.equal(policy.transport.public_desktop_address_required, false);
  assert.equal(policy.transport.authentication.history_capability, false);
  assert.equal(policy.product_identity.local_ios_runtime, false);
});

test('remote companion validator rejects a second runtime or plaintext transport', () => {
  const policy = readJson('contracts/app-remote-companion.json');
  const mutations = [
    (candidate: Record<string, any>) => { candidate.product_identity.local_ios_runtime = true; },
    (candidate: Record<string, any>) => { candidate.transport.client_api_key_embedded = true; },
    (candidate: Record<string, any>) => { candidate.transport.payload_confidentiality.ably_plaintext_task_content = true; },
    (candidate: Record<string, any>) => { candidate.transport.channel_policy.namespace = 'opl.v1.pair.<opaque_pair_id>'; },
    (candidate: Record<string, any>) => {
      candidate.transport.authentication.requested_capabilities.ios['opl:v1:pair:<opaque_pair_id>:event'] = ['publish', 'subscribe'];
    },
    (candidate: Record<string, any>) => { candidate.transport.channel_policy.client_token_wildcard_capability = true; },
    (candidate: Record<string, any>) => { candidate.transport.authentication.push_admin_capability = true; },
    (candidate: Record<string, any>) => { candidate.pairing.qr_payload.push('displayed_confirmation_code'); },
    (candidate: Record<string, any>) => { candidate.pairing.broker_persistence.allowed.push('plaintext_qr_claim_secret'); },
    (candidate: Record<string, any>) => { candidate.pairing.manual_code_policy = 'six_digit_code_without_rate_limit'; },
    (candidate: Record<string, any>) => { candidate.action_policy.request_required_fields.push('action_id'); },
    (candidate: Record<string, any>) => { candidate.action_policy.idempotency.offline_command_queue = true; },
  ];
  for (const mutate of mutations) {
    const candidate = structuredClone(policy);
    mutate(candidate);
    assert.throws(() => validateRemoteCompanionContract(candidate));
  }
});

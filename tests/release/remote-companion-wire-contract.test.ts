import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const readJson = (relativePath: string) => JSON.parse(fs.readFileSync(relativePath, 'utf8')) as Record<string, any>;

test('OPL Link wire contract has one versioned broker and encrypted transport shape', () => {
  const product = readJson('contracts/app-remote-companion.json');
  const wire = readJson('contracts/app-remote-companion-wire.json');
  assert.equal(wire.schema, 'opl_app_remote_companion_wire.v1');
  assert.equal(wire.protocol_version, product.transport.protocol);
  assert.equal(product.source_refs.wire_contract, 'contracts/app-remote-companion-wire.json');
  assert.deepEqual(
    wire.transport_envelope.encrypted_payload_variants.command.allowed_action_ids,
    product.action_policy.mvp_allowed_actions,
  );

  const endpoints = wire.broker_http.endpoints as Array<Record<string, any>>;
  assert.equal(new Set(endpoints.map((endpoint) => endpoint.id)).size, endpoints.length);
  assert.equal(new Set(endpoints.map((endpoint) => `${endpoint.method} ${endpoint.path}`)).size, endpoints.length);
  assert.ok(endpoints.some((endpoint) => endpoint.id === 'desktop_create_pairing'));
  assert.ok(endpoints.some((endpoint) => endpoint.id === 'ios_claim_pairing'));
  assert.ok(endpoints.some((endpoint) => endpoint.id === 'desktop_confirm_pairing'));
  const credentialEndpoint = endpoints.find((endpoint) => endpoint.id === 'refresh_provider_credentials');
  assert.ok(credentialEndpoint);
  assert.ok(credentialEndpoint.response_fields.includes('provider_user_id'));
  assert.ok(credentialEndpoint.response_fields.includes('peer_provider_user_id'));
  const readPairingEndpoint = endpoints.find((endpoint) => endpoint.id === 'read_pairing');
  assert.ok(readPairingEndpoint);
  assert.ok(readPairingEndpoint.device_activation_fields.includes('peer_device_id'));
  assert.ok(readPairingEndpoint.device_activation_fields.includes('peer_public_key'));
  assert.ok(endpoints.some((endpoint) => endpoint.id === 'revoke_pair'));
  assert.ok(endpoints.some((endpoint) => endpoint.id === 'read_revocation'));
});

test('OPL Link wire keeps secrets out of QR, routes, logs, and provider plaintext', () => {
  const wire = readJson('contracts/app-remote-companion-wire.json');
  const qrFields = new Set(wire.pairing_qr.fields as string[]);
  for (const field of wire.pairing_qr.forbidden_fields as string[]) {
    assert.equal(qrFields.has(field), false, `${field} must not be present in pairing QR`);
  }
  assert.equal(wire.broker_http.tokens.transport, 'bearer_header_only_never_url_query_or_qr');
  assert.equal(wire.secret_and_log_policy.provider_or_cloud_plaintext_task_content, false);
  assert.equal(wire.desktop_dispatch.provider_history_read_for_business_state, false);
  assert.equal(wire.desktop_dispatch.cloud_task_store, false);

  const outer = new Set(wire.transport_envelope.outer_fields as string[]);
  for (const field of wire.transport_envelope.outer_plaintext_must_not_include as string[]) {
    assert.equal(outer.has(field), false, `${field} must remain encrypted`);
  }
  assert.equal(wire.transport_envelope.nonce_bytes, 12);
  assert.deepEqual(wire.transport_envelope.direction_values, ['ios_to_desktop', 'desktop_to_ios']);
  assert.equal(wire.transport_envelope.hkdf_salt, 'utf8_pair_id');
  assert.match(wire.transport_envelope.associated_data_serialization, /declared_order/);
  assert.equal(wire.transport_envelope.ordering.duplicate_nonce_rejected, true);
  assert.equal(wire.transport_envelope.ordering.duplicate_or_regressed_sequence_rejected, true);
  assert.equal(wire.transport_envelope.ordering.unknown_send_result_policy, 'do_not_resend_refresh_canonical_state');

  const command = wire.transport_envelope.encrypted_payload_variants.command;
  assert.deepEqual(command.payload_contracts['canonical_turn.stop'].payload_fields, []);
  assert.match(command.payload_contracts['canonical_turn.stop'].turn_selection, /desktop_resolves/);
  assert.deepEqual(command.payload_contracts['canonical_approval.respond'].payload_fields, [
    'approval_id',
    'decision',
  ]);

  const event = wire.transport_envelope.encrypted_payload_variants.event;
  assert.deepEqual(event.payload_contracts['task.list_snapshot'], ['tasks', 'complete']);
  assert.deepEqual(event.payload_contracts['thread.snapshot'], ['thread_id', 'messages', 'approval']);
  assert.deepEqual(event.projection_shapes.task, [
    'id',
    'title',
    'status',
    'updated_at',
    'needs_user_action',
    'active_turn_id',
  ]);
});

test('crypto and pairing test vectors pin cross-language byte compatibility', () => {
  const wire = readJson('contracts/app-remote-companion-wire.json');
  const crypto = wire.transport_envelope.test_vector;
  assert.equal(crypto.shared_secret_hex, '4a5d9d5ba4ce2de1728e3bf480350f25e07e21c947d19e3376f09b3c1e161742');
  assert.equal(crypto.derived_key_hex, '6017bf36ae1274c1168a217e69737e9792226ab555e0447dddec1b278f15de59');
  assert.equal(crypto.ciphertext_and_tag_hex, 'c90ce480a4b58bf4d5c076ee419a3661510728dcf87443d9c258b16492e6dc1c57c856cced4851');
  assert.equal(wire.pairing_authentication_string.test_vector.authentication_string, '867 604');
});

test('seat reclaim stays tied to provider absence readback', () => {
  const wire = readJson('contracts/app-remote-companion-wire.json');
  const endpoint = (wire.broker_http.endpoints as Array<Record<string, any>>)
    .find((candidate) => candidate.id === 'read_revocation');
  assert.ok(endpoint);
  assert.match(endpoint.terminal_rule, /both_provider_identities_are_absent/);
  assert.match(endpoint.terminal_rule, /seat_released_is_true/);
});

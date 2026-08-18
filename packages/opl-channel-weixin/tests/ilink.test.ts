import assert from 'node:assert/strict';
import test from 'node:test';

import {
  IlinkApi,
  IlinkError,
  boundedExponentialBackoffMs,
  loginWithWeixinQr,
  type FetchLike,
} from '../src/index.js';

const jsonResponse = (value: unknown, status = 200) => new Response(JSON.stringify(value), {
  status,
  headers: { 'Content-Type': 'application/json' },
});

test('iLink getupdates and sendmessage preserve the required wire shape', async () => {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const fetcher: FetchLike = async (input, init = {}) => {
    calls.push({ url: String(input), init });
    if (String(input).endsWith('/ilink/bot/getupdates')) {
      return jsonResponse({
        ret: 0,
        errcode: 0,
        msgs: [{
          from_user_id: 'weixin-user-1',
          context_token: 'context-1',
          item_list: [{ type: 1, text_item: { text: 'hello' } }],
        }],
        get_updates_buf: 'cursor-2',
      });
    }
    return jsonResponse({ ret: 0, errcode: 0 });
  };
  const api = new IlinkApi({ botToken: 'token-1', baseUrl: 'https://ilink.test', fetch: fetcher });

  const updates = await api.getUpdates('cursor-1');
  await api.sendText({
    to_user_id: 'weixin-user-1',
    text: 'reply',
    context_token: 'context-1',
  });

  assert.equal(updates.cursor, 'cursor-2');
  assert.equal(updates.messages[0]?.from_user_id, 'weixin-user-1');
  assert.equal(calls.length, 2);
  const pollHeaders = new Headers(calls[0]?.init.headers);
  assert.equal(pollHeaders.get('AuthorizationType'), 'ilink_bot_token');
  assert.equal(pollHeaders.get('Authorization'), 'Bearer token-1');
  assert.match(pollHeaders.get('X-WECHAT-UIN') ?? '', /^[A-Za-z0-9+/]{6}==$/);
  assert.deepEqual(JSON.parse(String(calls[0]?.init.body)), {
    get_updates_buf: 'cursor-1',
    base_info: {},
  });
  const sendBody = JSON.parse(String(calls[1]?.init.body));
  assert.equal(sendBody.msg.to_user_id, 'weixin-user-1');
  assert.equal(sendBody.msg.message_type, 2);
  assert.equal(sendBody.msg.message_state, 2);
  assert.equal(sendBody.msg.context_token, 'context-1');
  assert.deepEqual(sendBody.msg.item_list, [{ type: 1, text_item: { text: 'reply' } }]);
  assert.match(sendBody.msg.client_id, /^[0-9a-f-]{36}$/);
});

test('QR login returns explicit credentials without persistence', async () => {
  const urls: string[] = [];
  const fetcher: FetchLike = async (input) => {
    const url = String(input);
    urls.push(url);
    if (url.includes('get_bot_qrcode')) {
      return jsonResponse({ data: { qrcode: 'ticket-1', qrcode_img_content: 'weixin://qr/1' } });
    }
    return jsonResponse({
      status: 'confirmed',
      bot_token: 'token-confirmed',
      ilink_bot_id: 'account-confirmed',
      baseurl: 'https://ilink-confirmed.test',
    });
  };
  let presentedQr = '';

  const result = await loginWithWeixinQr({
    base_url: 'https://ilink.test',
    fetch: fetcher,
    onQrCode: (qr) => { presentedQr = qr.ticket; },
  });

  assert.equal(presentedQr, 'ticket-1');
  assert.deepEqual(result, {
    account_id: 'account-confirmed',
    bot_token: 'token-confirmed',
    base_url: 'https://ilink-confirmed.test',
  });
  assert.equal(urls.length, 2);
  assert.match(urls[0] ?? '', /bot_type=3/);
  assert.match(urls[1] ?? '', /qrcode=ticket-1/);
});

for (const [status, code] of [['expired', 'qr_expired'], ['failed', 'qr_failed']] as const) {
  test(`QR login reports ${status} without fabricating credentials`, async () => {
    const fetcher: FetchLike = async (input) => String(input).includes('get_bot_qrcode')
      ? jsonResponse({ qrcode: 'ticket-expiring' })
      : jsonResponse({ status });

    await assert.rejects(
      loginWithWeixinQr({ base_url: 'https://ilink.test', fetch: fetcher }),
      (error: unknown) => error instanceof IlinkError && error.code === code,
    );
  });
}

test('poll backoff is exponential and bounded', () => {
  assert.equal(boundedExponentialBackoffMs(1, 1_000, 10_000), 1_000);
  assert.equal(boundedExponentialBackoffMs(2, 1_000, 10_000), 2_000);
  assert.equal(boundedExponentialBackoffMs(5, 1_000, 10_000), 10_000);
  assert.equal(boundedExponentialBackoffMs(500, 1_000, 10_000), 10_000);
});

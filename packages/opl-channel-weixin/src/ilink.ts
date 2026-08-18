/**
 * iLink protocol semantics independently adapted from AionCore v0.1.57.
 * See NOTICE for the exact Apache-2.0 source identity and excluded surfaces.
 */
import { randomBytes, randomUUID } from 'node:crypto';

import { abortableSleep } from './backoff.js';
import type { FetchLike, Sleep } from './types.js';

export const DEFAULT_ILINK_BASE_URL = 'https://ilinkai.weixin.qq.com';

export type WeixinQrCode = {
  ticket: string;
  image_content?: string;
};

export type WeixinQrStatus = {
  status: string;
  bot_token?: string;
  account_id?: string;
  base_url?: string;
};

export type WeixinRawItem = {
  type?: number;
  text_item?: { text?: string };
  voice_item?: { text?: string };
};

export type WeixinRawMessage = {
  from_user_id?: string;
  context_token?: string;
  msg_id?: string;
  item_list?: WeixinRawItem[];
};

export type WeixinUpdates = {
  messages: WeixinRawMessage[];
  cursor: string;
};

export class IlinkError extends Error {
  constructor(
    readonly code:
      | 'invalid_config'
      | 'http_error'
      | 'invalid_response'
      | 'api_error'
      | 'timeout'
      | 'aborted'
      | 'qr_expired'
      | 'qr_failed',
    message: string,
  ) {
    super(message);
    this.name = 'IlinkError';
  }
}

type IlinkApiOptions = {
  botToken: string;
  baseUrl?: string;
  fetch?: FetchLike;
  apiTimeoutMs?: number;
  pollTimeoutMs?: number;
};

export class IlinkApi {
  private readonly baseUrl: string;
  private readonly botToken: string;
  private readonly fetcher: FetchLike;
  private readonly apiTimeoutMs: number;
  private readonly pollTimeoutMs: number;
  private readonly wechatUin = randomBytes(4).toString('base64');

  constructor(options: IlinkApiOptions) {
    this.baseUrl = normalizeBaseUrl(options.baseUrl ?? DEFAULT_ILINK_BASE_URL);
    this.botToken = options.botToken;
    this.fetcher = options.fetch ?? globalThis.fetch;
    this.apiTimeoutMs = positiveMilliseconds(options.apiTimeoutMs ?? 15_000, 'apiTimeoutMs');
    this.pollTimeoutMs = positiveMilliseconds(options.pollTimeoutMs ?? 45_000, 'pollTimeoutMs');
  }

  async getBotQrCode(signal?: AbortSignal): Promise<WeixinQrCode> {
    const url = this.url('/ilink/bot/get_bot_qrcode');
    url.searchParams.set('bot_type', '3');
    const raw = unwrapData(await this.requestJson(url, { method: 'GET' }, this.apiTimeoutMs, signal));
    const ticket = requiredString(raw.qrcode, 'qrcode');
    const imageContent = optionalString(raw.qrcode_img_content);
    return imageContent === undefined ? { ticket } : { ticket, image_content: imageContent };
  }

  async getQrCodeStatus(ticket: string, signal?: AbortSignal): Promise<WeixinQrStatus> {
    const url = this.url('/ilink/bot/get_qrcode_status');
    url.searchParams.set('qrcode', requiredString(ticket, 'ticket'));
    const raw = unwrapData(await this.requestJson(url, { method: 'GET' }, this.apiTimeoutMs, signal));
    const status = requiredString(raw.status, 'status');
    const botToken = optionalString(raw.bot_token);
    const accountId = optionalString(raw.ilink_bot_id);
    const baseUrl = optionalString(raw.baseurl);
    return {
      status,
      ...(botToken === undefined ? {} : { bot_token: botToken }),
      ...(accountId === undefined ? {} : { account_id: accountId }),
      ...(baseUrl === undefined ? {} : { base_url: normalizeBaseUrl(baseUrl) }),
    };
  }

  async getUpdates(cursor: string, signal?: AbortSignal): Promise<WeixinUpdates> {
    this.requireBotToken();
    const raw = asRecord(
      await this.requestJson(
        this.url('/ilink/bot/getupdates'),
        {
          method: 'POST',
          headers: this.authHeaders(),
          body: JSON.stringify({ get_updates_buf: cursor, base_info: {} }),
        },
        this.pollTimeoutMs,
        signal,
      ),
      'getupdates response',
    );
    assertApiSuccess(raw);
    const messages = raw.msgs === undefined ? [] : rawMessageArray(raw.msgs);
    const nextCursor = raw.get_updates_buf === undefined
      ? cursor
      : requiredString(raw.get_updates_buf, 'get_updates_buf');
    return { messages, cursor: nextCursor };
  }

  async sendText(
    input: { to_user_id: string; text: string; context_token?: string },
    signal?: AbortSignal,
  ): Promise<void> {
    this.requireBotToken();
    const toUserId = requiredString(input.to_user_id, 'to_user_id');
    const text = requiredString(input.text, 'text');
    const body = {
      msg: {
        to_user_id: toUserId,
        client_id: randomUUID(),
        message_type: 2,
        message_state: 2,
        item_list: [{ type: 1, text_item: { text } }],
        ...(input.context_token === undefined
          ? {}
          : { context_token: requiredString(input.context_token, 'context_token') }),
      },
      base_info: {},
    };
    const raw = asRecord(
      await this.requestJson(
        this.url('/ilink/bot/sendmessage'),
        { method: 'POST', headers: this.authHeaders(), body: JSON.stringify(body) },
        this.apiTimeoutMs,
        signal,
      ),
      'sendmessage response',
    );
    assertApiSuccess(raw);
  }

  private requireBotToken(): void {
    if (this.botToken.length === 0) {
      throw new IlinkError('invalid_config', 'An explicit bot token is required.');
    }
  }

  private authHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      AuthorizationType: 'ilink_bot_token',
      Authorization: `Bearer ${this.botToken}`,
      'X-WECHAT-UIN': this.wechatUin,
    };
  }

  private url(path: string): URL {
    return new URL(path, `${this.baseUrl}/`);
  }

  private async requestJson(
    url: URL,
    init: RequestInit,
    timeoutMs: number,
    externalSignal?: AbortSignal,
  ): Promise<unknown> {
    const controller = new AbortController();
    const onAbort = () => controller.abort();
    if (externalSignal?.aborted) controller.abort();
    externalSignal?.addEventListener('abort', onAbort, { once: true });
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const headers = new Headers(init.headers);
      if (init.method === 'GET') headers.set('iLink-App-ClientVersion', '1');
      const response = await this.fetcher(url, { ...init, headers, signal: controller.signal });
      if (!response.ok) {
        throw new IlinkError('http_error', `iLink request failed with HTTP ${response.status}.`);
      }
      try {
        return await response.json();
      } catch {
        throw new IlinkError('invalid_response', 'iLink returned invalid JSON.');
      }
    } catch (error) {
      if (error instanceof IlinkError) throw error;
      if (controller.signal.aborted) {
        if (externalSignal?.aborted) throw new IlinkError('aborted', 'iLink request was aborted.');
        throw new IlinkError('timeout', 'iLink request timed out.');
      }
      throw new IlinkError('http_error', 'iLink request failed.');
    } finally {
      clearTimeout(timeout);
      externalSignal?.removeEventListener('abort', onAbort);
    }
  }
}

export type WeixinQrLoginOptions = {
  base_url?: string;
  fetch?: FetchLike;
  signal?: AbortSignal;
  timeout_ms?: number;
  poll_interval_ms?: number;
  sleep?: Sleep;
  onQrCode?: (qrCode: WeixinQrCode) => void;
  onStatus?: (status: string) => void;
};

export type WeixinQrLoginResult = {
  account_id: string;
  bot_token: string;
  base_url: string;
};

export async function loginWithWeixinQr(options: WeixinQrLoginOptions = {}): Promise<WeixinQrLoginResult> {
  const timeoutMs = positiveMilliseconds(options.timeout_ms ?? 180_000, 'timeout_ms');
  const pollIntervalMs = positiveMilliseconds(options.poll_interval_ms ?? 1_000, 'poll_interval_ms');
  const sleep = options.sleep ?? abortableSleep;
  const api = new IlinkApi({
    botToken: '',
    ...(options.base_url === undefined ? {} : { baseUrl: options.base_url }),
    ...(options.fetch === undefined ? {} : { fetch: options.fetch }),
  });
  const qrCode = await api.getBotQrCode(options.signal);
  options.onQrCode?.(qrCode);
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const state = await api.getQrCodeStatus(qrCode.ticket, options.signal);
    options.onStatus?.(state.status);
    if (state.status === 'confirmed') {
      return {
        account_id: requiredString(state.account_id, 'confirmed account_id'),
        bot_token: requiredString(state.bot_token, 'confirmed bot_token'),
        base_url: state.base_url ?? options.base_url ?? DEFAULT_ILINK_BASE_URL,
      };
    }
    if (state.status === 'expired') {
      throw new IlinkError('qr_expired', 'The Weixin QR login challenge expired.');
    }
    if (state.status === 'failed' || state.status === 'cancelled') {
      throw new IlinkError('qr_failed', 'The Weixin QR login challenge failed.');
    }
    await sleep(pollIntervalMs, options.signal);
  }
  throw new IlinkError('qr_expired', 'The Weixin QR login challenge expired.');
}

function normalizeBaseUrl(value: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new IlinkError('invalid_config', 'The iLink base URL is invalid.');
  }
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) {
    throw new IlinkError('invalid_config', 'The iLink base URL must be an HTTPS origin or path.');
  }
  return url.toString().replace(/\/$/, '');
}

function positiveMilliseconds(value: number, field: string): number {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new IlinkError('invalid_config', `${field} must be a positive safe integer.`);
  }
  return value;
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.length === 0 || value !== value.trim()) {
    throw new IlinkError('invalid_response', `${field} must be a non-empty exact string.`);
  }
  return value;
}

function optionalString(value: unknown): string | undefined {
  return value === undefined || value === null ? undefined : requiredString(value, 'optional string');
}

function asRecord(value: unknown, field: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new IlinkError('invalid_response', `${field} must be an object.`);
  }
  return value as Record<string, unknown>;
}

function unwrapData(value: unknown): Record<string, unknown> {
  const record = asRecord(value, 'iLink response');
  return record.data === undefined ? record : asRecord(record.data, 'iLink response data');
}

function rawMessageArray(value: unknown): WeixinRawMessage[] {
  if (!Array.isArray(value)) {
    throw new IlinkError('invalid_response', 'msgs must be an array.');
  }
  return value.map((message) => asRecord(message, 'message') as WeixinRawMessage);
}

function assertApiSuccess(value: Record<string, unknown>): void {
  const ret = value.ret ?? 0;
  const errcode = value.errcode ?? 0;
  if (typeof ret !== 'number' || typeof errcode !== 'number') {
    throw new IlinkError('invalid_response', 'iLink API status fields must be numeric.');
  }
  if (ret !== 0 || errcode !== 0) {
    throw new IlinkError('api_error', 'iLink API rejected the request.');
  }
}

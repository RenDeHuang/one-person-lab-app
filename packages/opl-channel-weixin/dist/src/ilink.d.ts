import type { FetchLike, Sleep } from './types.js';
export declare const DEFAULT_ILINK_BASE_URL = "https://ilinkai.weixin.qq.com";
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
    text_item?: {
        text?: string;
    };
    voice_item?: {
        text?: string;
    };
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
export declare class IlinkError extends Error {
    readonly code: 'invalid_config' | 'http_error' | 'invalid_response' | 'api_error' | 'timeout' | 'aborted' | 'qr_expired' | 'qr_failed';
    constructor(code: 'invalid_config' | 'http_error' | 'invalid_response' | 'api_error' | 'timeout' | 'aborted' | 'qr_expired' | 'qr_failed', message: string);
}
type IlinkApiOptions = {
    botToken: string;
    baseUrl?: string;
    fetch?: FetchLike;
    apiTimeoutMs?: number;
    pollTimeoutMs?: number;
};
export declare class IlinkApi {
    private readonly baseUrl;
    private readonly botToken;
    private readonly fetcher;
    private readonly apiTimeoutMs;
    private readonly pollTimeoutMs;
    private readonly wechatUin;
    constructor(options: IlinkApiOptions);
    getBotQrCode(signal?: AbortSignal): Promise<WeixinQrCode>;
    getQrCodeStatus(ticket: string, signal?: AbortSignal): Promise<WeixinQrStatus>;
    getUpdates(cursor: string, signal?: AbortSignal): Promise<WeixinUpdates>;
    sendText(input: {
        to_user_id: string;
        text: string;
        context_token?: string;
    }, signal?: AbortSignal): Promise<void>;
    private requireBotToken;
    private authHeaders;
    private url;
    private requestJson;
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
export declare function loginWithWeixinQr(options?: WeixinQrLoginOptions): Promise<WeixinQrLoginResult>;
export {};

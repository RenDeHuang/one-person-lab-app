import type { Sleep } from './types.js';
export declare function boundedExponentialBackoffMs(consecutiveFailures: number, baseMilliseconds: number, maxMilliseconds: number): number;
export declare const abortableSleep: Sleep;

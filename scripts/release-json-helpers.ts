import fs from 'node:fs';

export function readJsonFile<T = unknown>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
}

export function recordOrNull(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

export function arrayOrEmpty(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

export function objectField(record: Record<string, unknown> | null | undefined, key: string) {
  return recordOrNull(record?.[key]);
}

export function arrayField(record: Record<string, unknown> | null | undefined, key: string) {
  return arrayOrEmpty(record?.[key]);
}

export function asRecord(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }
  return value as Record<string, unknown>;
}

export function stringArray(value: unknown, label: string): string[] {
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== 'string' || !entry.trim())) {
    throw new Error(`${label} must be a non-empty string array.`);
  }
  return value as string[];
}

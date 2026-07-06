import path from 'node:path';

export type ExpectedField = {
  actual: unknown;
  expected: unknown;
};

export function assertExpectedFields(checks: readonly ExpectedField[], message: string): void {
  if (checks.some(({ actual, expected }) => actual !== expected)) {
    throw new Error(message);
  }
}

export function assertRepositoryRelativePath(
  value: unknown,
  messages: { empty: string; unsafe: string },
): asserts value is string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(messages.empty);
  }
  if (path.isAbsolute(value) || value.split(/[\\/]+/).includes('..')) {
    throw new Error(messages.unsafe);
  }
}

export function assertStringArrayIncludes(actual: unknown, expected: string[], label: string): void {
  if (!Array.isArray(actual)) {
    throw new Error(`${label} must be an array`);
  }
  for (const item of expected) {
    if (!actual.includes(item)) {
      throw new Error(`${label} must include ${item}`);
    }
  }
}

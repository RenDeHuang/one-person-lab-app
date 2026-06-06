import { readFileSync } from 'node:fs';

export function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, 'utf8'));
}

export function assertIncludesAll(actual, expected, label) {
  if (!Array.isArray(actual)) {
    throw new Error(`${label} must be an array`);
  }
  for (const item of expected) {
    if (!actual.includes(item)) {
      throw new Error(`${label} must include ${item}`);
    }
  }
}

export function assertDeepEqualJson(actual, expected, label) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${label} must be ${JSON.stringify(expected)}; got ${JSON.stringify(actual)}`);
  }
}

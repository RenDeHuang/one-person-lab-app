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

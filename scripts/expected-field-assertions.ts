export type ExpectedField = {
  actual: unknown;
  expected: unknown;
};

export function assertExpectedFields(checks: readonly ExpectedField[], message: string): void {
  if (checks.some(({ actual, expected }) => actual !== expected)) {
    throw new Error(message);
  }
}

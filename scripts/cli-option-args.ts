export function requiredOptionValue(argv: string[], index: number, token: string): string {
  const value = argv[index + 1];
  if (!value || value.startsWith('--')) throw new Error(`Missing value for ${token}`);
  return value;
}

export function applyStringOptionArg(
  argv: string[],
  index: number,
  handlers: Record<string, (value: string) => void>,
): number | null {
  const token = argv[index];
  const handler = handlers[token];
  if (!handler) return null;
  handler(requiredOptionValue(argv, index, token));
  return index + 1;
}

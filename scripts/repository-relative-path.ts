import path from 'node:path';

type RelativePathMessages = {
  empty: string;
  unsafe: string;
};

export function assertRepositoryRelativePath(
  value: unknown,
  messages: RelativePathMessages,
): asserts value is string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(messages.empty);
  }
  if (path.isAbsolute(value) || value.split(/[\\/]+/).includes('..')) {
    throw new Error(messages.unsafe);
  }
}

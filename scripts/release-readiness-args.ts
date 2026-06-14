type SharedReleaseReadinessOptions = {
  version: string;
  releaseMode: string;
  includeFullPackage: boolean;
  runVmSmoke: boolean;
};

type BooleanParser = (value: string | undefined, fallback?: boolean) => boolean;

export function parseStrictBoolean(value: string | undefined, fallback = false): boolean {
  if (value === undefined || value === '') return fallback;
  if (value === 'true' || value === '1') return true;
  if (value === 'false' || value === '0') return false;
  throw new Error(`Boolean value must be true or false, got ${value}`);
}

export function buildSharedReleaseReadinessOptions(parseBoolean: BooleanParser): SharedReleaseReadinessOptions {
  return {
    version: process.env.OPL_RELEASE_VERSION || '',
    releaseMode: process.env.OPL_RELEASE_MODE || '',
    includeFullPackage: parseBoolean(process.env.OPL_INCLUDE_FULL_PACKAGE),
    runVmSmoke: parseBoolean(process.env.OPL_RUN_VM_SMOKE),
  };
}

export function applySharedReleaseReadinessArg(
  argv: string[],
  index: number,
  parsed: SharedReleaseReadinessOptions,
  parseBoolean: BooleanParser,
): number | null {
  const token = argv[index];
  if (token === '--include-full-package' || token === '--run-vm-smoke') {
    const value = requiredOptionValue(argv, index, token);
    if (token === '--include-full-package') parsed.includeFullPackage = parseBoolean(value);
    else parsed.runVmSmoke = parseBoolean(value);
    return index + 1;
  }
  if (token === '--version') {
    parsed.version = requiredOptionValue(argv, index, token);
    return index + 1;
  }
  if (token === '--release-mode') {
    parsed.releaseMode = requiredOptionValue(argv, index, token);
    return index + 1;
  }
  return null;
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

export function assertSharedReleaseReadinessOptions(parsed: SharedReleaseReadinessOptions): void {
  if (!parsed.version.trim()) throw new Error('Pass --version <version> or set OPL_RELEASE_VERSION.');
  if (!parsed.releaseMode.trim()) throw new Error('Pass --release-mode <mode> or set OPL_RELEASE_MODE.');
}

export function requiredOptionValue(argv: string[], index: number, token: string): string {
  const value = argv[index + 1];
  if (!value || value.startsWith('--')) throw new Error(`Missing value for ${token}`);
  return value;
}

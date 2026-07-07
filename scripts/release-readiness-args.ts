type SharedReleaseReadinessOptions = {
  version: string;
  releaseMode: string;
  includeFullPackage: boolean;
  runVmSmoke: boolean;
  publishDockerWebui: boolean;
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
    publishDockerWebui: parseBoolean(process.env.OPL_PUBLISH_DOCKER_WEBUI, true),
  };
}

export function assertSharedReleaseReadinessOptions(parsed: SharedReleaseReadinessOptions): void {
  if (!parsed.version.trim()) throw new Error('Pass --version <version> or set OPL_RELEASE_VERSION.');
  if (!parsed.releaseMode.trim()) throw new Error('Pass --release-mode <mode> or set OPL_RELEASE_MODE.');
}

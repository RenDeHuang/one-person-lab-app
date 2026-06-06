export function assertCommandSurface(value, expected, label) {
  if (value !== expected) {
    throw new Error(`${label} must be ${expected}`);
  }
}

export function lookupPath(value, dotPath) {
  return dotPath.split('.').reduce((current, key) => {
    if (!current || typeof current !== 'object' || Array.isArray(current)) {
      return undefined;
    }
    return current[key];
  }, value);
}

function resolveLiveGateEnabled(gate) {
  const envName = gate?.enable_env;
  return typeof envName === 'string' && process.env[envName]?.trim() === '1';
}

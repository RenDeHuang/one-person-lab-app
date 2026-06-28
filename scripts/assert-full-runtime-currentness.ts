#!/usr/bin/env node
import { parseArgs } from './build-full-first-install-package/env.ts';
import { assertFullRuntimeCurrentness } from './build-full-first-install-package/runtime-currentness.ts';

function valueAfter(flag: string, args: string[]): string | null {
  const index = args.indexOf(flag);
  if (index === -1) return null;
  return args[index + 1] ?? null;
}

function main() {
  const args = process.argv.slice(2);
  const runtimeRoot = valueAfter('--runtime-root', args);
  if (!runtimeRoot) {
    throw new Error('Usage: assert-full-runtime-currentness --runtime-root <runtime/current>');
  }

  const options = parseArgs(args.filter((arg, index) => arg !== '--runtime-root' && args[index - 1] !== '--runtime-root'));
  const report = assertFullRuntimeCurrentness(runtimeRoot, {
    frameworkRoot: options.frameworkRoot,
  });
  console.log(JSON.stringify(report, null, 2));
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

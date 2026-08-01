#!/usr/bin/env node
import { parseArgs as parseNodeArgs } from 'node:util';

import { parseArgs as parseFullPackageArgs } from './build-full-first-install-package/env.ts';
import { assertFullRuntimeCurrentness } from './build-full-first-install-package/runtime-currentness.ts';

function parseRuntimeRootArgs(args: string[]) {
  const runtimeRootKey = 'runtime-root';
  const { values, tokens } = parseNodeArgs({
    args,
    options: {
      [runtimeRootKey]: { type: 'string' },
    },
    allowPositionals: true,
    strict: false,
    tokens: true,
  });
  const runtimeRoot = values[runtimeRootKey];
  if (typeof runtimeRoot !== 'string' || !runtimeRoot) {
    throw new Error('Usage: assert-full-runtime-currentness --runtime-root <runtime/current>');
  }

  const consumedIndexes = new Set<number>();
  for (const token of tokens) {
    if (token.kind !== 'option' || token.name !== runtimeRootKey) {
      continue;
    }
    consumedIndexes.add(token.index);
    if (token.value !== undefined && token.inlineValue === false) {
      consumedIndexes.add(token.index + 1);
    }
  }
  return {
    runtimeRoot,
    forwardedArgs: args.filter((_, index) => !consumedIndexes.has(index)),
  };
}

function main() {
  const { runtimeRoot, forwardedArgs } = parseRuntimeRootArgs(process.argv.slice(2));
  const options = parseFullPackageArgs(forwardedArgs);
  const report = assertFullRuntimeCurrentness(runtimeRoot, {
    frameworkRoot: options.frameworkRoot,
    masRoot: options.masRoot,
    masScholarSkillsRoot: options.masScholarSkillsRoot,
    masScholarSkillsRef: options.masScholarSkillsRef,
  });
  console.log(JSON.stringify(report, null, 2));
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

#!/usr/bin/env node
import path from 'node:path';

import { prepareOfficeCliLatestStableCheckout } from './build-full-first-install-package/upstream-release.ts';

const root = process.argv[2]?.trim();
if (!root) {
  throw new Error('Usage: prepare-officecli-release-source.ts <OfficeCLI checkout>');
}

console.log(JSON.stringify(prepareOfficeCliLatestStableCheckout(path.resolve(root)), null, 2));

import fs from 'node:fs';
import path from 'node:path';

export function pushDirectoryEntries(stack: string[], directoryPath: string): void {
  for (const entry of fs.readdirSync(directoryPath)) {
    stack.push(path.join(directoryPath, entry));
  }
}

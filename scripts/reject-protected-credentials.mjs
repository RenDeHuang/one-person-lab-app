import fs from 'node:fs';
import path from 'node:path';

const secrets = [process.env.GATEWAY_ACCOUNT_PASSWORD || ''];
if (secrets.some((value) => !value)) throw new Error('Protected Gateway credentials are unavailable for evidence scanning.');
const visit = (entry) => {
  if (!fs.existsSync(entry)) return;
  const stat = fs.lstatSync(entry);
  if (stat.isSymbolicLink()) throw new Error(`Evidence path must not be a symlink: ${entry}`);
  if (stat.isDirectory()) {
    for (const child of fs.readdirSync(entry)) visit(path.join(entry, child));
    return;
  }
  const bytes = fs.readFileSync(entry);
  for (const secret of secrets) if (bytes.includes(Buffer.from(secret))) throw new Error(`Protected Gateway credential found in release evidence: ${entry}`);
};
visit('artifacts');

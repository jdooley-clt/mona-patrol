// Stages the exact published static files into _site/ with no bundler or transpiler.
import { cp, mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { PUBLISHED, root } from './serve.mjs';

const out = join(root, '_site');
await rm(out, { recursive: true, force: true });
await mkdir(out);
for (const entry of PUBLISHED) {
  await cp(join(root, entry), join(out, entry), { recursive: true });
}
await writeFile(join(out, '.nojekyll'), '');
console.log(`Staged ${PUBLISHED.join(', ')} in _site/`);

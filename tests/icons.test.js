import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { PNG_ICONS, check, ogImage, png, svg } from '../scripts/icons.mjs';
import { root, resolvePublished } from '../scripts/serve.mjs';

test('committed favicon, app icons, and og-image match scripts/icons.mjs output', async () => {
  check();
  const actualSvg = await readFile(join(root, 'assets', 'favicon.svg'), 'utf8');
  assert.equal(actualSvg, svg());

  for (const spec of PNG_ICONS) {
    const actual = await readFile(join(root, 'assets', spec.file));
    assert.equal(Buffer.compare(actual, png(spec)), 0, `${spec.file} matches generator`);
  }

  const actualOg = await readFile(join(root, 'assets', 'og-image.png'));
  assert.equal(Buffer.compare(actualOg, ogImage()), 0, 'og-image.png matches generator');
});

test('preview server resolves only published paths and blocks traversal', () => {
  assert.ok(resolvePublished(root, '/')?.endsWith('index.html'));
  assert.ok(resolvePublished(root, '/mona-patrol/')?.endsWith('index.html'));
  assert.ok(resolvePublished(root, '/src/engine.js')?.endsWith(join('src', 'engine.js')));
  assert.equal(resolvePublished(root, '/../package.json'), null);
  assert.equal(resolvePublished(root, '/package.json'), null);
  assert.equal(resolvePublished(root, '/scripts/serve.mjs'), null);
});

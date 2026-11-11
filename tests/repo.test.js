import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { root } from '../scripts/serve.mjs';
import { cabinetRoot, cabinetSha } from '../scripts/cabinet.mjs';

async function collectTrackedFiles(dir, prefix = '') {
  const entries = await readdir(dir, { withFileTypes: true });
  const out = [];
  for (const entry of entries) {
    if (['.git', 'node_modules', '_site', '.playwright-cabinet', 'test-results', 'playwright-report'].includes(entry.name)) {
      continue;
    }
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      out.push(...(await collectTrackedFiles(join(dir, entry.name), rel)));
    } else {
      out.push(rel);
    }
  }
  return out;
}

test('README lines stay <= 100 chars and include required sections and attribution', async () => {
  const readme = await readFile(join(root, 'README.md'), 'utf8');
  const lines = readme.replace(/\r\n/g, '\n').split('\n');
  for (const [idx, line] of lines.entries()) {
    assert.ok(
      line.length <= 100,
      `README.md line ${idx + 1} exceeds 100 chars (${line.length}): ${line}`,
    );
  }

  for (const heading of [
    '## Play',
    '## Controls',
    '## How it plays',
    '## Local dev',
    '## Tests',
    '## Cabinet compatibility',
    '## Origins',
    '## Licensing',
  ]) {
    assert.ok(readme.includes(heading), `README includes ${heading}`);
  }

  assert.ok(readme.includes('not published'), 'README states game is not published yet');
  assert.ok(readme.includes(cabinetSha.slice(0, 7)), 'README names pinned cabinet SHA');

  const normalized = readme.replace(/\s+/g, ' ');
  assert.ok(
    normalized.includes(
      'Created by Jeramiah Dooley ([@jdooley-clt](https://github.com/jdooley-clt)) for the [GitHub Arcade](https://jdooley-clt.github.io/arcade/), a cabinet created by Christina Warren ([@filmgirl](https://github.com/filmgirl)).',
    ),
    'README Origins carries exact creator credit',
  );
  assert.ok(
    normalized.includes("inspired by Irem's 1982 arcade game Moon Patrol"),
    'README includes single factual inspiration line',
  );
});

test('classic arcade title appears only once in README and nowhere in UI, metadata, or code', async () => {
  const files = await collectTrackedFiles(root);
  const phrase = new RegExp('Moon' + '\\s+' + 'Patrol', 'gi');
  for (const rel of files) {
    if (rel.endsWith('.png') || rel === 'tests/repo.test.js') continue;
    const text = await readFile(join(root, rel), 'utf8');
    const matches = [...text.matchAll(phrase)];
    if (rel === 'README.md') {
      assert.equal(matches.length, 1, 'README mentions inspiration at most once');
    } else {
      assert.equal(matches.length, 0, `${rel} must not contain original arcade title`);
    }
  }
});

test('LICENSE, NOTICE, SECURITY.md, dependabot.yml, and non-deploying CI workflow are valid', async () => {
  const license = await readFile(join(root, 'LICENSE'), 'utf8');
  assert.ok(license.includes('MIT License'));
  assert.ok(license.includes('Copyright (c) 2026 Jeramiah Dooley'));

  const notice = await readFile(join(root, 'NOTICE'), 'utf8');
  assert.ok(notice.includes('MIT License'));
  assert.ok(notice.includes('https://octodex.github.com/faq/'));
  assert.ok(notice.includes('GitHub, Inc.'));

  const security = await readFile(join(root, 'SECURITY.md'), 'utf8');
  assert.ok(security.includes('# Security Policy'));

  const dependabot = await readFile(join(root, '.github', 'dependabot.yml'), 'utf8');
  assert.ok(dependabot.includes('package-ecosystem: "npm"'));
  assert.ok(dependabot.includes('package-ecosystem: "github-actions"'));
  assert.ok(dependabot.includes('interval: "weekly"'));

  const ci = await readFile(join(root, '.github', 'workflows', 'ci.yml'), 'utf8');
  const activeLines = ci
    .split(/\r?\n/)
    .filter((line) => !line.trimStart().startsWith('#'))
    .join('\n');
  assert.ok(activeLines.includes('permissions:\n  contents: read'));
  assert.ok(activeLines.includes('persist-credentials: false'));
  assert.ok(!activeLines.includes('deploy-pages'), 'active CI must not deploy Pages');
  assert.ok(!activeLines.includes('upload-pages-artifact'), 'active CI must not upload Pages artifact');

  const usesMatches = [...activeLines.matchAll(/uses:\s*([^\s#]+)/g)];
  assert.ok(usesMatches.length >= 3);
  for (const [, actionRef] of usesMatches) {
    assert.match(actionRef, /^[^@]+@[0-9a-f]{40}$/, `Action ${actionRef} is SHA-pinned`);
  }
});

test('draft cabinet/games.json entry validates against pinned arcade src/catalog.js when present', async () => {
  const draftEntry = JSON.parse(await readFile(join(root, 'cabinet', 'games.json'), 'utf8'));
  assert.equal(draftEntry.id, 'mona-patrol');
  assert.equal(draftEntry.title, 'Mona Patrol');
  assert.equal(draftEntry.accent, 'lavender');

  try {
    const catalogMod = await import(new URL('../.playwright-cabinet/src/catalog.js', import.meta.url));
    const { games, errors } = catalogMod.validateCatalog(
      [draftEntry],
      'https://jdooley-clt.github.io/arcade/',
    );
    assert.deepEqual(errors, []);
    assert.equal(games.length, 1);
    assert.equal(games[0].id, 'mona-patrol');
  } catch (err) {
    if (err.code !== 'ERR_MODULE_NOT_FOUND') throw err;
  }

  // Verify all shipping cabinet artwork files exist in both cabinet/ and assets/, are byte-identical,
  // meet exact dimensions (640x360 gameplay PNG), and use self-contained SVGs with no external refs.
  for (const name of ['mona-patrol.png', 'mona-patrol-cover.svg', 'mona-patrol-character.svg']) {
    const cabBuf = await readFile(join(root, 'cabinet', name));
    const assetBuf = await readFile(join(root, 'assets', name));
    assert.ok(cabBuf.length > 0, `cabinet/${name} is non-empty`);
    assert.equal(Buffer.compare(cabBuf, assetBuf), 0, `cabinet/${name} matches assets/${name}`);
  }

  const pngBuf = await readFile(join(root, 'cabinet', 'mona-patrol.png'));
  assert.equal(pngBuf.readUInt32BE(16), 640, 'mona-patrol.png width is 640px');
  assert.equal(pngBuf.readUInt32BE(20), 360, 'mona-patrol.png height is 360px');

  for (const svgName of ['mona-patrol-cover.svg', 'mona-patrol-character.svg']) {
    const svgText = await readFile(join(root, 'cabinet', svgName), 'utf8');
    assert.match(svgText, /<svg\b[^>]*viewBox=/, `${svgName} declares viewBox`);
    assert.match(svgText, /<title>[^<]+<\/title>/, `${svgName} includes accessible <title>`);
    assert.ok(!/<script\b/i.test(svgText), `${svgName} contains no scripts`);
    assert.ok(!/<image\b/i.test(svgText), `${svgName} embeds no external raster images`);
    assert.ok(!/https?:\/\/(?!www\.w3\.org\/2000\/svg)/i.test(svgText), `${svgName} has no external URLs`);
  }
});

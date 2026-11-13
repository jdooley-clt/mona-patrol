import test from 'node:test';
import assert from 'node:assert/strict';
import { cp, mkdtemp, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { PUBLISHED, root } from '../scripts/serve.mjs';
import { cabinetSha } from '../scripts/cabinet.mjs';

const SITE_BASELINE_RAW_BYTES = 204_661;
const SITE_BASELINE_GZIP_BYTES = 68_859;
const EXPECTED_ACTION_NAMES = [
  'actions/checkout',
  'actions/setup-node',
  'actions/upload-pages-artifact',
  'actions/upload-artifact',
  'actions/configure-pages',
  'actions/deploy-pages',
];
const EXPECTED_PAGES_GUARD =
  "github.repository == 'jdooley-clt/mona-patrol' && !github.event.repository.private && github.event_name != 'pull_request' && github.ref == 'refs/heads/main'";

function webpDimensions(buf) {
  assert.equal(buf.subarray(0, 4).toString('ascii'), 'RIFF', 'WebP RIFF header');
  assert.equal(buf.subarray(8, 12).toString('ascii'), 'WEBP', 'WebP signature');
  const chunk = buf.subarray(12, 16).toString('ascii');
  if (chunk === 'VP8X') {
    return [buf.readUIntLE(24, 3) + 1, buf.readUIntLE(27, 3) + 1];
  }
  if (chunk === 'VP8 ') {
    return [buf.readUInt16LE(26) & 0x3fff, buf.readUInt16LE(28) & 0x3fff];
  }
  if (chunk === 'VP8L') {
    const bits = buf.readUInt32LE(21);
    return [(bits & 0x3fff) + 1, ((bits >>> 14) & 0x3fff) + 1];
  }
  throw new Error(`Unsupported WebP chunk: ${chunk}`);
}

function extractHrefs(text) {
  const hrefs = new Set();
  for (const [raw] of text.matchAll(/https?:\/\/[^\s)>`"]+/g)) {
    hrefs.add(new URL(raw.replace(/[.,;]+$/, '')).href);
  }
  return hrefs;
}

async function measureSiteBytes(dir) {
  let rawBytes = 0;
  let gzipBytes = 0;
  async function walk(current) {
    for (const entry of await readdir(current, { withFileTypes: true })) {
      const full = join(current, entry.name);
      if (entry.isDirectory()) {
        await walk(full);
      } else {
        const buf = await readFile(full);
        rawBytes += buf.length;
        if (buf.length > 0) gzipBytes += gzipSync(buf, { level: 9 }).length;
      }
    }
  }
  await walk(dir);
  return { rawBytes, gzipBytes };
}

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
    '## Deployment',
    '## Origins',
    '## Licensing',
  ]) {
    assert.ok(readme.includes(heading), `README includes ${heading}`);
  }

  const readmeHrefs = extractHrefs(readme);
  assert.ok(
    lines.some((line) => line === '- **Play:** <https://jdooley-clt.github.io/mona-patrol/>') &&
      readmeHrefs.has('https://jdooley-clt.github.io/mona-patrol/'),
    'README links to live GitHub Pages URL',
  );
  assert.ok(
    lines.some(
      (line) => line === '- **More games:** [GitHub Arcade](https://jdooley-clt.github.io/arcade/)',
    ) && readmeHrefs.has('https://jdooley-clt.github.io/arcade/'),
    'README links back to GitHub Arcade',
  );
  assert.match(readme, /Direct pushes\s+to `main` are blocked/);
  assert.ok(readme.includes('gh run rerun <run-id> --failed'));
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
    if (rel.endsWith('.png') || rel.endsWith('.webp') || rel === 'tests/repo.test.js') continue;
    const text = await readFile(join(root, rel), 'utf8');
    const matches = [...text.matchAll(phrase)];
    if (rel === 'README.md') {
      assert.equal(matches.length, 1, 'README mentions inspiration at most once');
    } else {
      assert.equal(matches.length, 0, `${rel} must not contain original arcade title`);
    }
  }
});

test('LICENSE, NOTICE, SECURITY.md, dependabot.yml, package-lock.json, and pages.yml are valid', async () => {
  const license = await readFile(join(root, 'LICENSE'), 'utf8');
  assert.ok(license.includes('MIT License'));
  assert.ok(license.includes('Copyright (c) 2026 Jeramiah Dooley'));

  const notice = await readFile(join(root, 'NOTICE'), 'utf8');
  const noticeHrefs = extractHrefs(notice);
  assert.ok(notice.includes('MIT License'));
  assert.ok(noticeHrefs.has('https://octodex.github.com/faq/'));
  assert.ok(notice.includes('GitHub, Inc.'));
  assert.ok(notice.includes('*.webp'));

  const security = await readFile(join(root, 'SECURITY.md'), 'utf8');
  assert.ok(security.includes('# Security Policy'));

  const dependabot = await readFile(join(root, '.github', 'dependabot.yml'), 'utf8');
  assert.ok(dependabot.includes('package-ecosystem: "npm"'));
  assert.ok(dependabot.includes('package-ecosystem: "github-actions"'));
  assert.ok(dependabot.includes('interval: "weekly"'));

  const lockfile = await readFile(join(root, 'package-lock.json'), 'utf8');
  for (const [, resolvedUrl] of lockfile.matchAll(/"resolved":\s*"([^"]+)"/g)) {
    assert.equal(
      new URL(resolvedUrl).origin,
      'https://registry.npmjs.org',
      `package-lock resolved URL uses public npm registry: ${resolvedUrl}`,
    );
  }

  const legacyCi = await stat(join(root, '.github', 'workflows', 'ci.yml')).catch(() => null);
  assert.equal(legacyCi, null, 'legacy ci.yml workflow is removed');

  const workflow = await readFile(join(root, '.github', 'workflows', 'pages.yml'), 'utf8');
  assert.ok(workflow.includes('name: Deploy game to GitHub Pages'));
  assert.ok(workflow.includes('name: Cabinet compatibility'));
  assert.ok(workflow.includes('permissions:\n  contents: read'));
  assert.ok(workflow.includes('persist-credentials: false'));

  const usesLines = workflow
    .split(/\r?\n/)
    .filter((line) => /^\s*(?:-\s*)?uses:\s*/.test(line));
  assert.equal(usesLines.length, EXPECTED_ACTION_NAMES.length);
  const actionNames = [];
  for (const line of usesLines) {
    const match = /^\s*(?:-\s*)?uses:\s*([a-z0-9-]+\/[a-z0-9-]+)@([0-9a-f]{40})\s+#\s*v\d+(?:\.\d+)*\s*$/.exec(
      line,
    );
    assert.ok(match, `Workflow uses line has 40-char SHA pin and version comment: ${line}`);
    actionNames.push(match[1]);
  }
  assert.deepEqual(actionNames, EXPECTED_ACTION_NAMES);

  const guardCount = workflow.split(EXPECTED_PAGES_GUARD).length - 1;
  assert.equal(
    guardCount,
    2,
    'Both upload-pages-artifact and deploy job carry !github.event.repository.private guard',
  );
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

  assert.equal(draftEntry.art, './assets/mona-patrol.webp');

  // Verify all shipping cabinet artwork files exist in both cabinet/ and assets/, are byte-identical,
  // meet exact dimensions (640x360 gameplay WebP <= 25 KB), and use self-contained SVGs.
  for (const name of ['mona-patrol.webp', 'mona-patrol-cover.svg', 'mona-patrol-character.svg']) {
    const cabBuf = await readFile(join(root, 'cabinet', name));
    const assetBuf = await readFile(join(root, 'assets', name));
    assert.ok(cabBuf.length > 0, `cabinet/${name} is non-empty`);
    assert.equal(Buffer.compare(cabBuf, assetBuf), 0, `cabinet/${name} matches assets/${name}`);
  }

  const webpBuf = await readFile(join(root, 'cabinet', 'mona-patrol.webp'));
  assert.ok(
    webpBuf.length <= 25_000,
    `mona-patrol.webp stays <= 25 KB (${webpBuf.length} bytes)`,
  );
  assert.deepEqual(webpDimensions(webpBuf), [640, 360], 'mona-patrol.webp is 640x360');

  for (const svgName of ['mona-patrol-cover.svg', 'mona-patrol-character.svg']) {
    const svgText = await readFile(join(root, 'cabinet', svgName), 'utf8');
    assert.match(svgText, /<svg\b[^>]*viewBox=/, `${svgName} declares viewBox`);
    assert.match(svgText, /<title>[^<]+<\/title>/, `${svgName} includes accessible <title>`);
    assert.ok(!/<script\b/i.test(svgText), `${svgName} contains no scripts`);
    assert.ok(!/<image\b/i.test(svgText), `${svgName} embeds no external raster images`);
    assert.ok(!/https?:\/\/(?!www\.w3\.org\/2000\/svg)/i.test(svgText), `${svgName} has no external URLs`);
  }
});

test('staged _site payload stays within +10% of the raw and gzipped baseline budget', async (t) => {
  const staged = await mkdtemp(join(tmpdir(), 'mona-patrol-site-'));
  t.after(() => rm(staged, { recursive: true, force: true }));
  for (const entry of PUBLISHED) {
    await cp(join(root, entry), join(staged, entry), { recursive: true });
  }
  await writeFile(join(staged, '.nojekyll'), '');

  const { rawBytes, gzipBytes } = await measureSiteBytes(staged);
  const maxRaw = Math.floor(SITE_BASELINE_RAW_BYTES * 1.1);
  const maxGzip = Math.floor(SITE_BASELINE_GZIP_BYTES * 1.1);
  assert.ok(
    rawBytes <= maxRaw,
    `staged _site raw payload ${rawBytes} B exceeds +10% budget ${maxRaw} B (baseline ${SITE_BASELINE_RAW_BYTES} B)`,
  );
  assert.ok(
    gzipBytes <= maxGzip,
    `staged _site gzip payload ${gzipBytes} B exceeds +10% budget ${maxGzip} B (baseline ${SITE_BASELINE_GZIP_BYTES} B)`,
  );

  const existingSite = join(root, '_site');
  const existingStat = await stat(existingSite).catch(() => null);
  if (existingStat?.isDirectory()) {
    assert.deepEqual(await measureSiteBytes(existingSite), { rawBytes, gzipBytes });
  }
});

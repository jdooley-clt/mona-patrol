// Same-origin harness matching GitHub Pages: pinned Commit Cabinet at /arcade/,
// candidate game staged in _site/ at /mona-patrol/, and candidate cover assets
// from cabinet/ mounted under /arcade/assets/mona-patrol* without dirtying .playwright-cabinet.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import {
  cabinetDraftRoot,
  cabinetRoot,
  cabinetSha,
  candidateCatalog,
  origin,
  port,
  siteRoot,
  verifyCabinet,
} from './cabinet.mjs';

verifyCabinet();
await readFile(resolve(siteRoot, 'index.html'));
const catalog = candidateCatalog(
  JSON.parse(await readFile(resolve(cabinetRoot, 'games.json'), 'utf8')),
);

const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=utf-8',
};

const DRAFT_ART_FILES = new Set([
  'mona-patrol.png',
  'mona-patrol-cover.svg',
  'mona-patrol-character.svg',
]);

createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, origin).pathname);
    res.setHeader('Cache-Control', 'no-store');
    if (pathname === '/health') {
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ cabinetSha }));
      return;
    }
    if (pathname === '/favicon.ico') {
      res.writeHead(204).end();
      return;
    }
    if (pathname === '/arcade/games.json') {
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(catalog));
      return;
    }
    if (pathname.startsWith('/arcade/assets/')) {
      const assetName = pathname.slice('/arcade/assets/'.length);
      if (DRAFT_ART_FILES.has(assetName)) {
        const draftFile = resolve(cabinetDraftRoot, assetName);
        const body = await readFile(draftFile);
        res.setHeader('Content-Type', types[extname(draftFile)] || 'application/octet-stream');
        res.end(body);
        return;
      }
    }

    const normalized = pathname === '/arcade' ? '/arcade/' : pathname === '/mona-patrol' ? '/mona-patrol/' : pathname;
    const mount = [
      ['/arcade/', cabinetRoot],
      ['/mona-patrol/', siteRoot],
    ].find(([prefix]) => normalized.startsWith(prefix));
    if (!mount) {
      res.writeHead(404).end('Not found');
      return;
    }
    const [prefix, base] = mount;
    const rel = normalized.slice(prefix.length) || 'index.html';
    const file = resolve(base, rel);
    if (!file.startsWith(base + sep) || file.includes(`${sep}.git`)) {
      res.writeHead(403).end('Forbidden');
      return;
    }
    const body = await readFile(file);
    res.setHeader('Content-Type', types[extname(file)] || 'application/octet-stream');
    res.end(body);
  } catch (error) {
    if (error.code === 'ENOENT' || error.code === 'EISDIR') {
      res.writeHead(404).end('Not found');
    } else {
      console.error(error);
      res.writeHead(500).end('Harness error');
    }
  }
}).listen(port, '127.0.0.1', () => console.log(`Cabinet harness: ${origin}/arcade/`));

// Generates the favicon, app icons, and Open Graph preview image from pixel maps,
// keeping every asset crisp and dependency-free. Run `npm run icons` after edits.
import { writeFile } from 'node:fs/promises';
import { deflateSync } from 'node:zlib';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const COLORS = {
  k: '#34313e', // graphite pixel outline
  i: '#fffdf4', // creamy ivory face & wheel hubs
  s: '#fff7df', // warm arcade cream sky
  l: '#ded4f1', // candy lavender trim
  p: '#ed9eb7', // candy pink 8-bit rover fender
  c: '#ffb7a5', // coral-peach road & blush
  q: '#96dce2', // aqua dome / steering
  m: '#c5e7b1', // mint beacon
  r: '#b11f4b', // ruby laser
};

const BACKGROUND = 's';

// 16x16 8-bit pixel Mona (tall Octocat ears, wide ivory face, vertical eyes, curling tentacle)
// seated openly in the candy-pink 6-wheel lunar rover.
export const MAP = [
  '.ssssssssssssss.',
  'ssskksssssskksss',
  'ssskkkkkkkkkksss',
  'sskkiiiiiiiikkss',
  'sskikkiissiikkss',
  'sskikkiissiikkss',
  'sskiciiikkiiciks',
  'sk.kkkkkkkkkkqqs',
  'kk..kkkkkkkkqqqs',
  'skppppppppppppcr',
  'skppllllllllppks',
  'skkkkkkkkkkkkkks',
  'sskksskkkksskkss',
  'sskksskkkksskkss',
  'cccccccccccccccc',
  '.cccccccccccccc.',
];

export const PNG_ICONS = [
  { file: 'icon-192.png', cell: 12, pad: 0, opaque: false },
  { file: 'icon-512.png', cell: 32, pad: 0, opaque: false },
  { file: 'icon-maskable-192.png', cell: 8, pad: 32, opaque: true },
  { file: 'icon-maskable-512.png', cell: 22, pad: 80, opaque: true },
  { file: 'apple-touch-icon.png', cell: 9, pad: 18, opaque: true },
];

export function check() {
  if (MAP.length !== 16 || MAP.some((row) => row.length !== 16)) {
    throw new Error('MAP must be 16x16.');
  }
  for (const row of MAP) {
    for (const ch of row) {
      if (ch !== '.' && !COLORS[ch]) throw new Error(`Unknown color "${ch}".`);
    }
  }
}

export function svg() {
  const paths = new Map();
  MAP.forEach((row, y) => {
    for (let x = 0; x < 16;) {
      const ch = row[x];
      let w = 1;
      while (x + w < 16 && row[x + w] === ch) w += 1;
      if (ch !== '.') paths.set(ch, (paths.get(ch) ?? '') + `M${x} ${y}h${w}v1h-${w}z`);
      x += w;
    }
  });
  const body = [...paths].map(([ch, d]) => `<path fill="${COLORS[ch]}" d="${d}"/>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" shape-rendering="crispEdges"><title>Mona Patrol: pixel Octocat in a lunar buggy</title>${body}</svg>\n`;
}

const CRC = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};

function chunk(type, data) {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 'ascii');
  data.copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
}

const rgba = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).concat(255);

export function encodePng(width, height, pixelAt) {
  const stride = width * 4 + 1;
  const raw = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) {
    raw[y * stride] = 0;
    for (let x = 0; x < width; x++) {
      raw.set(pixelAt(x, y), y * stride + 1 + x * 4);
    }
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header.set([8, 6, 0, 0, 0], 8);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

export function png({ cell, pad, opaque }) {
  const size = 16 * cell + 2 * pad;
  const bg = opaque ? rgba(COLORS[BACKGROUND]) : [0, 0, 0, 0];
  return encodePng(size, size, (x, y) => {
    const mx = Math.floor((x - pad) / cell);
    const my = Math.floor((y - pad) / cell);
    const ch = mx >= 0 && mx < 16 && my >= 0 && my < 16 ? MAP[my][mx] : '.';
    return ch === '.' ? bg : rgba(COLORS[ch]);
  });
}

// 1200x630 social preview card built from the same palette and 16x16 buggy sprite.
export function ogImage() {
  const width = 1200;
  const height = 630;
  const sky = rgba('#f7f4e9');
  const dot = rgba('#e6e0cf');
  const hillFar = rgba('#ded4f1');
  const hillMid = rgba('#c5e7d8');
  const ground = rgba('#e8e0f5');
  const groundDeep = rgba('#d5c8ec');
  const ink = rgba('#34313e');
  const coral = rgba('#ffb7a5');
  const ruby = rgba('#b11f4b');
  const ivory = rgba('#fffdf4');

  // Bug UFO 12x7 pixel stamp
  const ufo = [
    '....kkkk....',
    '..kkmmmmkk..',
    '.kcccccccck.',
    'kcckikikicck',
    'kkkkkkkkkkkk',
    '.k.k....k.k.',
    'k...k..k...k',
  ];

  return encodePng(width, height, (x, y) => {
    // Border frame
    if (x < 16 || x >= width - 16 || y < 16 || y >= height - 16) return ink;

    // Ground & merge-conflict crater around x=760..870
    const inCrater = x >= 760 && x <= 870;
    const roadY = 470;
    if (y >= roadY) {
      if (inCrater && y < 548) {
        const depth = 548 - Math.abs(x - 815) * 1.1;
        if (y < depth) {
          if (Math.abs(y - depth) < 5) return ink;
          return sky;
        }
      }
      if (y < roadY + 6 && !inCrater) return ink;
      if (((x + y) % 36) < 3 && y > roadY + 24) return groundDeep;
      return ground;
    }

    // Buggy sprite (scale 14 -> 224x224) leaping toward crater
    const bx = Math.floor((x - 310) / 14);
    const by = Math.floor((y - 238) / 14);
    if (bx >= 0 && bx < 16 && by >= 0 && by < 14) {
      const ch = MAP[by][bx];
      if (ch !== '.' && ch !== 's' && ch !== 'c') return rgba(COLORS[ch]);
    }

    // Forward laser beam
    if (y >= 364 && y < 376 && x >= 550 && x <= 690 && ((x >> 4) & 1) === 0) {
      return ruby;
    }

    // Upward plasma bolt
    if (x >= 468 && x < 480 && y >= 150 && y <= 230 && ((y >> 4) & 1) === 0) {
      return rgba('#62bc84');
    }

    // Two Bug UFOs overhead (scale 8)
    for (const [ux, uy] of [[440, 82], [790, 118]]) {
      const sx = Math.floor((x - ux) / 8);
      const sy = Math.floor((y - uy) / 8);
      if (sx >= 0 && sx < 12 && sy >= 0 && sy < 7) {
        const uch = ufo[sy][sx];
        if (uch === 'k') return ink;
        if (uch === 'c') return coral;
        if (uch === 'm') return hillMid;
        if (uch === 'i') return ivory;
      }
    }

    // Checkpoint B flag at x=980
    if (x >= 980 && x < 988 && y >= 370 && y < roadY) return ink;
    if (x >= 988 && x < 1044 && y >= 370 && y < 408) {
      if (x >= 1038 || y < 375 || y >= 403) return ink;
      return hillMid;
    }

    // Mid hills
    const mh = 390 + Math.sin(x / 115) * 34 + Math.cos(x / 53) * 12;
    if (y >= mh) {
      return Math.abs(y - mh) < 4 ? ink : hillMid;
    }

    // Far lunar mesas
    const fh = 310 + Math.sin((x + 90) / 170) * 44;
    if (y >= fh) {
      return Math.abs(y - fh) < 4 ? ink : hillFar;
    }

    // Sky dot grid
    if (x % 28 < 3 && y % 28 < 3) return dot;
    return sky;
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  check();
  const dir = new URL('../assets/', import.meta.url);
  await writeFile(new URL('favicon.svg', dir), svg());
  for (const icon of PNG_ICONS) {
    await writeFile(new URL(icon.file, dir), png(icon));
  }
  await writeFile(new URL('og-image.png', dir), ogImage());
  console.log(`Wrote favicon.svg, og-image.png, and ${PNG_ICONS.map((i) => i.file).join(', ')} to assets/`);
}

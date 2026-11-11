// Generates the favicon, app icons, and Open Graph preview image from pixel maps,
// keeping every asset crisp and dependency-free. Run `npm run icons` after edits.
import { writeFile } from 'node:fs/promises';
import { deflateSync } from 'node:zlib';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const COLORS = {
  k: '#34313e', // graphite pixel outline
  i: '#fffdf4', // creamy ivory face & wheel hubs
  l: '#e8dff7', // candy lavender background
  d: '#ded4f1', // lavender rover side panel
  p: '#f06aa7', // arcade pink 6-wheel rover hull
  c: '#ffb7a5', // peach blush
  t: '#f4a27e', // lunar terracotta road
  g: '#ffd15c', // gold laser nozzle
  q: '#70d6ff', // cyan turret & steering
  m: '#7bc96f', // lunar crust lip
  r: '#e02856', // crimson laser
};

const BACKGROUND = 'l';

// 16x16 pixel Mona (tall Octocat ears, wide ivory face, vertical eyes, curling tentacle)
// seated openly in the pink 6-wheel lunar patrol rover.
export const MAP = [
  '.llllllllllllll.',
  'lllkkllllllkklll',
  'lllkkkkkkkkkklll',
  'llkkiiiiiiiikkll',
  'llkiikkiikkiikll',
  'llkiikkiikkiikll',
  'llkiciiikkiicikl',
  'lk.kkkkkkkkkkqql',
  'kkqkkkkkkkkkqqql',
  'lkppppppppppppgr',
  'lkpddddddddddpkl',
  'lkkkkkkkkkkkkkkl',
  'llkkllkkkkllkkll',
  'llkkllkkkkllkkll',
  'mmmmmmmmmmmmmmmm',
  '.tttttttttttttt.',
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

// 1200x630 social preview card built from the finished palette, rover sprite,
// Cyan Tri-Orb Bug-Dropper, and Horned CVE-Bomber.
export function ogImage() {
  const width = 1200;
  const height = 630;
  const sky = rgba('#e8dff7');
  const dot = rgba('#cbbce6');
  const hillFar = rgba('#cbbce6');
  const hillMid = rgba('#9fd49c');
  const roadLip = rgba('#7bc96f');
  const ground = rgba('#f4a27e');
  const groundDeep = rgba('#dc8562');
  const ink = rgba('#34313e');
  const cyan = rgba('#3dc8ff');
  const gold = rgba('#ffd15c');
  const ruby = rgba('#e02856');
  const ivory = rgba('#fffdf4');

  // Cyan Tri-Orb Bug-Dropper (11x8)
  const triUfo = [
    '...kkkkk...',
    '..kqqiiqk..',
    '...kkkkk...',
    'kkkkk.kkkkk',
    'kqiqkkkqiiq',
    'kqqqkkkqqqq',
    'kkkkk.kkkkk',
    '...........',
  ];

  // Crimson & Gold Horned CVE-Bomber (12x7)
  const cveUfo = [
    'k..kkkkkk..k',
    '.kkggggggkk.',
    'kkkkkkkkkkkk',
    'krrrrrrrrrrk',
    'kriggrriigrk',
    'kkkkkkkkkkkk',
    '....kggk....',
  ];

  return encodePng(width, height, (x, y) => {
    if (x < 16 || x >= width - 16 || y < 16 || y >= height - 16) return ink;

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
      if (y < roadY + 5 && !inCrater) return ink;
      if (y < roadY + 12 && !inCrater) return roadLip;
      if (y > roadY + 46) return groundDeep;
      return ground;
    }

    // Buggy sprite (scale 14 -> 224x224) leaping toward crater
    const bx = Math.floor((x - 310) / 14);
    const by = Math.floor((y - 238) / 14);
    if (bx >= 0 && bx < 16 && by >= 0 && by < 14) {
      const ch = MAP[by][bx];
      if (ch !== '.' && ch !== 'l' && ch !== 'm' && ch !== 't') return rgba(COLORS[ch]);
    }

    // Forward laser beam
    if (y >= 364 && y < 376 && x >= 550 && x <= 690 && ((x >> 4) & 1) === 0) {
      return ruby;
    }

    // Upward cyan plasma bolt
    if (x >= 342 && x < 354 && y >= 150 && y <= 250 && ((y >> 4) & 1) === 0) {
      return cyan;
    }

    // Left Cyan Tri-Orb UFO (scale 9)
    {
      const sx = Math.floor((x - 190) / 9);
      const sy = Math.floor((y - 96) / 9);
      if (sx >= 0 && sx < 11 && sy >= 0 && sy < 8) {
        const uch = triUfo[sy][sx];
        if (uch === 'k') return ink;
        if (uch === 'q') return cyan;
        if (uch === 'i') return ivory;
      }
    }

    // Right Crimson-Gold CVE Bomber UFO (scale 9)
    {
      const sx = Math.floor((x - 790) / 9);
      const sy = Math.floor((y - 108) / 9);
      if (sx >= 0 && sx < 12 && sy >= 0 && sy < 7) {
        const uch = cveUfo[sy][sx];
        if (uch === 'k') return ink;
        if (uch === 'r') return ruby;
        if (uch === 'g') return gold;
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

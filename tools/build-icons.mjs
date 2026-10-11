// Downloads the game-icons.net glyphs listed in tools/icon-map.mjs and packs their SVG path data
// into assets/icons.json ({ name: [pathData, ...] }, 512x512 viewBox). Run: node tools/build-icons.mjs
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { ICON_MAP } from './icon-map.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CACHE = path.join(ROOT, 'tools/_src/game-icons');
fs.mkdirSync(CACHE, { recursive: true });
const BASE = 'https://raw.githubusercontent.com/game-icons/icons/master/';

const out = {};
const uniq = [...new Set(Object.values(ICON_MAP))];
const svgs = {};
await Promise.all(uniq.map(async p => {
  const f = path.join(CACHE, p.replace('/', '__') + '.svg');
  if (!fs.existsSync(f)) {
    const r = await fetch(BASE + p + '.svg');
    if (!r.ok) { console.warn('missing', p); return; }
    fs.writeFileSync(f, await r.text());
  }
  svgs[p] = fs.readFileSync(f, 'utf8');
}));
for (const [name, p] of Object.entries(ICON_MAP)) {
  const svg = svgs[p]; if (!svg) continue;
  const ds = [...svg.matchAll(/<path([^>]*)\sd="([^"]+)"/g)]
    .filter(m => !/^M0 0h512v512H0z$/.test(m[2].trim()) && !/fill="(#000|none)"/.test(m[1]))
    .map(m => m[2]);
  if (ds.length) out[name] = ds;
}
const file = path.join(ROOT, 'assets/icons.json');
fs.writeFileSync(file, JSON.stringify(out));
console.log(Object.keys(out).length, 'icons,', (fs.statSync(file).size / 1024).toFixed(0) + 'K');

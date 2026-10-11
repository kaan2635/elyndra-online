// Grid A* pathfinding over the current zone (terrain slope, water, static colliders).
import { G } from '../core/state.js';
import { Heap, clamp } from '../core/util.js';

const CELL = 2.5;
let grid = null, gW = 0, gHalf = 0, zoneKey = null;

function build() {
  const W = G.world, T = W.terrain;
  if (W.dungeon) { grid = null; return; }
  gHalf = T.half; gW = Math.ceil(T.size / CELL);
  grid = new Uint8Array(gW * gW);
  for (let j = 0; j < gW; j++) for (let i = 0; i < gW; i++) {
    const x = -gHalf + (i + 0.5) * CELL, z = -gHalf + (j + 0.5) * CELL;
    let cost = 1;
    const h = T.heightAt(x, z);
    if (Math.max(Math.abs(x), Math.abs(z)) > gHalf - 7) cost = 0;
    else if (T.slopeAt(x, z) > 1.0 && W.bridgeAt(x, z) == null) cost = 0;
    else if (W.blockedAt(x, z, 0.6)) cost = 0;
    else if (h < T.water - 0.6 && W.bridgeAt(x, z) == null) cost = 6; // swimming is slow but allowed
    else if (T.roadAt(x, z) > 0.4) cost = 1;
    else cost = 2;
    grid[j * gW + i] = cost;
  }
  zoneKey = G.zones.current?.id;
}

export function findPath(sx, sz, tx, tz, maxNodes = 20000) {
  if (G.world.dungeon) return G.world.dungeon.findPath?.(sx, sz, tx, tz) || [{ x: tx, z: tz }];
  if (!grid || zoneKey !== G.zones.current?.id) build();
  const toC = v => clamp(Math.floor((v + gHalf) / CELL), 0, gW - 1);
  const si = toC(sx), sj = toC(sz);
  let ti = toC(tx), tj = toC(tz);
  // if target blocked, search nearby open cell
  if (!grid[tj * gW + ti]) {
    let found = false;
    for (let r = 1; r < 6 && !found; r++) for (let dj = -r; dj <= r && !found; dj++) for (let di = -r; di <= r; di++) {
      const i = ti + di, j = tj + dj; if (i < 0 || j < 0 || i >= gW || j >= gW) continue;
      if (grid[j * gW + i]) { ti = i; tj = j; found = true; break; }
    }
  }
  const N = gW * gW;
  const gs = new Float32Array(N).fill(Infinity), from = new Int32Array(N).fill(-1), closed = new Uint8Array(N);
  const start = sj * gW + si, goal = tj * gW + ti;
  const hf = k => { const i = k % gW, j = (k / gW) | 0; const dx = Math.abs(i - ti), dz = Math.abs(j - tj); return (dx + dz + (Math.SQRT2 - 2) * Math.min(dx, dz)); };
  const heap = new Heap(n => n.f);
  gs[start] = 0; heap.push({ k: start, f: hf(start) });
  let n = 0, best = start, bestH = hf(start);
  const D = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2]];
  while (heap.size && n++ < maxNodes) {
    const { k } = heap.pop();
    if (closed[k]) continue; closed[k] = 1;
    if (k === goal) { best = goal; break; }
    const hk = hf(k); if (hk < bestH) { bestH = hk; best = k; }
    const i = k % gW, j = (k / gW) | 0;
    for (const [di, dj, dc] of D) {
      const a = i + di, b = j + dj; if (a < 0 || b < 0 || a >= gW || b >= gW) continue;
      const nk = b * gW + a; const c = grid[nk]; if (!c || closed[nk]) continue;
      if (di && dj && (!grid[j * gW + a] || !grid[b * gW + i])) continue; // no corner cutting
      const ng = gs[k] + dc * c;
      if (ng < gs[nk]) { gs[nk] = ng; from[nk] = k; heap.push({ k: nk, f: ng + hf(nk) * 1.1 }); }
    }
  }
  // reconstruct & simplify
  const pts = [];
  for (let k = best; k !== -1; k = from[k]) pts.push({ x: -gHalf + (k % gW + 0.5) * CELL, z: -gHalf + (((k / gW) | 0) + 0.5) * CELL });
  pts.reverse();
  const out = [];
  for (let i = 1; i < pts.length; i++) if (i % 3 === 0 || i === pts.length - 1) out.push(pts[i]);
  if (best === goal) out.push({ x: tx, z: tz });
  return out;
}
export function invalidatePathGrid() { grid = null; }
G.path = { find: findPath, invalidate: invalidatePathGrid };
G.events.on('zoneLoaded', () => { grid = null; });

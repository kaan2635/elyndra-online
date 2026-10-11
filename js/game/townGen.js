// Procedural town layout: plaza, ring of houses facing the centre, stalls, lamps,
// defensive wall with gates. Returns structures + named anchor points for NPCs.
import { rng } from '../core/util.js';

/**
 * t: {x,z,r,h,style,seed,gates:[angles in radians],special:{slot:'smithy'|...}, wall:'wall'|'palisade'|null, center:'fountain'|'well'|'statue'}
 */
export function genTown(t) {
  const r = rng(t.seed || 7);
  const S = [], A = {};
  const st = t.style || 'village';
  const R = t.r;
  const rp = R * 0.34;
  const gates = t.gates || [0, Math.PI];
  const nearGate = (a, w = 0.32) => gates.some(g => Math.abs(((a - g + Math.PI * 3) % (Math.PI * 2)) - Math.PI) < w);
  const P = (a, d) => [t.x + Math.sin(a) * d, t.z + Math.cos(a) * d];
  A.center = [t.x, t.z + rp * 0.55];
  // centre piece
  S.push({ type: t.center || (st === 'desert' ? 'well' : 'fountain'), x: t.x, z: t.z, rot: 0, style: st });
  // quest board next to the centre
  S.push({ type: 'board', x: t.x + 4.5, z: t.z - 3.5, rot: Math.PI * 0.75, style: st });
  A.board = [t.x + 3.2, t.z - 2.2];
  // houses ring
  const ringR = R * 0.64;
  const n = Math.max(5, Math.floor(Math.PI * 2 * ringR / 10.5));
  const specials = Object.entries(t.special || {});
  let si = 0;
  for (let i = 0; i < n; i++) {
    const a = i / n * Math.PI * 2 + (t.rot || 0);
    if (nearGate(a, 0.38)) continue;
    const [x, z] = P(a, ringR);
    const face = Math.atan2(t.x - x, t.z - z);
    const front = (d) => [x + Math.sin(face) * d, z + Math.cos(face) * d];
    let type = 'house';
    const sp = si < specials.length && i % 2 === 0 ? specials[si++] : null;
    const opts = { w: 4.6 + r() * 1.6, d: 4 + r() * 1.2, floors: r() > 0.7 ? 2 : 1 };
    if (st === 'desert') opts.dome = r() > 0.5;
    if (st === 'elven' && r() > 0.5) type = 'treehouse';
    if (st === 'dwarven' && r() > 0.6) type = 'hut';
    if (sp) {
      const [slot, kind] = sp;
      if (kind === 'temple') { S.push({ type: 'temple', x, z, rot: face, style: st, w: 9, d: 7 }); A[slot] = front(6.5); continue; }
      if (kind === 'tower') { S.push({ type: 'tower', x, z, rot: face, style: st, r: 2.6, h: 11, flag: 0x3a5aa8 }); A[slot] = front(4.2); continue; }
      if (kind === 'smithy') { S.push({ type: 'house', x, z, rot: face, style: st, ...opts, floors: 1 }); const [ax, az] = front(4.6); S.push({ type: 'anvil', x: ax, z: az, rot: face + Math.PI / 2, style: st }); A[slot] = front(6.2); continue; }
      if (kind === 'inn') { S.push({ type: 'house', x, z, rot: face, style: st, w: 7, d: 5, floors: 2 }); A[slot] = front(4.5); continue; }
      if (kind === 'stable') { S.push({ type: 'house', x, z, rot: face, style: st, w: 6, d: 4, floors: 1, chimney: false }); const [fx, fz] = front(5); S.push({ type: 'fence', x: fx, z: fz, rot: face + Math.PI / 2, style: st, l: 7 }); A[slot] = front(3.6); continue; }
      S.push({ type, x, z, rot: face, style: st, ...opts }); A[slot] = front(type === 'treehouse' ? 4 : 4.2); continue;
    }
    S.push({ type, x, z, rot: face, style: st, ...opts });
    if (r() > 0.55) { const [cx, cz] = P(a + 0.22, ringR + 1); S.push({ type: 'crates', x: cx, z: cz, rot: r() * 3, style: st }); }
  }
  // stalls around plaza
  const nStalls = t.stalls ?? 3;
  for (let i = 0; i < nStalls; i++) {
    const a = (i + 0.5) / nStalls * Math.PI * 2 + 0.6;
    if (nearGate(a, 0.3)) continue;
    const [x, z] = P(a, rp + 3.2);
    S.push({ type: st === 'desert' ? 'tent' : 'stall', x, z, rot: Math.atan2(t.x - x, t.z - z), style: st, s: st === 'desert' ? 0.8 : 1 });
    A['stall' + i] = P(a, rp + 0.8);
  }
  // lamps
  const nl = Math.floor(n * 0.8);
  for (let i = 0; i < nl; i++) {
    const a = (i + 0.5) / nl * Math.PI * 2;
    const [x, z] = P(a, R * 0.47);
    S.push({ type: 'lamp', x, z, rot: a + Math.PI, style: st });
  }
  // walls
  if (t.wall) {
    const segs = Math.max(8, Math.round(Math.PI * 2 * R / 11));
    for (let i = 0; i < segs; i++) {
      const a0 = i / segs * Math.PI * 2, a1 = (i + 1) / segs * Math.PI * 2, am = (a0 + a1) / 2;
      const [x0, z0] = P(a0, R), [x1, z1] = P(a1, R);
      const len = Math.hypot(x1 - x0, z1 - z0);
      const rot = Math.atan2(z1 - z0, x1 - x0);
      if (nearGate(am, 0.25)) {
        if (gates.some(g => Math.abs(((am - g + Math.PI * 3) % (Math.PI * 2)) - Math.PI) < Math.PI / segs + 0.01)) {
          const [gx, gz] = P(am, R);
          S.push({ type: t.wall === 'palisade' ? 'gate' : 'gate', x: gx, z: gz, rot: -rot, style: st, w: 6 });
        }
        continue;
      }
      S.push({ type: t.wall, x: (x0 + x1) / 2, z: (z0 + z1) / 2, rot: -rot, style: st, l: len + 0.6 });
      if (t.towers && i % 3 === 0) { S.push({ type: 'tower', x: x0, z: z0, rot: 0, style: st, r: 1.6, h: 6.5, roof: true }); }
    }
  }
  // gate anchors (for guards)
  gates.forEach((g, i) => { A['gate' + i] = P(g, R - 4); A['gateOut' + i] = P(g, R + 6); });
  return { structures: S, anchors: A, flat: { t: 'flat', x: t.x, z: t.z, r: R + 3, h: t.h ?? 0, edge: 12, plaza: rp + 4 } };
}

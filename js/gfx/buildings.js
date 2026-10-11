// Procedural low-poly architecture. Each builder fills a Builder for the solid
// part and another for emissive (glowing windows, lamps, runes).
import * as THREE from 'three';
import { Builder, box, cyl, cone, ico, octa, prism, pyramid, taper, torus, sphere, jitter, dodeca, extrudeShape } from './geom.js';
import { lambert, basic } from './materials.js';
import { shadeHex, rng } from '../core/util.js';

export const STYLES = {
  village: { wall: 0xe8dcc0, wall2: 0xd8c8a8, timber: 0x6a4a2e, roof: 0xa84a32, roof2: 0x8a3a28, stone: 0x9a948a, trim: 0x5a3a22, glow: 0xffc86a },
  elven: { wall: 0xe8e4d4, wall2: 0xc8d8c0, timber: 0x8a6a4a, roof: 0x4a8a5a, roof2: 0x3a6a4a, stone: 0xc8c4b4, trim: 0xd8b04a, glow: 0xb8ffd0 },
  desert: { wall: 0xe0c494, wall2: 0xd0b080, timber: 0x8a6a40, roof: 0xd8c09a, roof2: 0xb89870, stone: 0xc8a878, trim: 0x3a6aa8, glow: 0xffd08a, flat: true },
  dwarven: { wall: 0x8a8890, wall2: 0x6a6870, timber: 0x5a3a24, roof: 0x4a5a78, roof2: 0x3a4868, stone: 0x7a7880, trim: 0xd8a03a, glow: 0xffb04a, snow: true },
  fort: { wall: 0x4a3a38, wall2: 0x3a2a28, timber: 0x2a1a14, roof: 0x5a2a20, roof2: 0x3a1a14, stone: 0x5a4a44, trim: 0xd86a2a, glow: 0xff7a2a },
  holy: { wall: 0xe8e4ea, wall2: 0xd0ccd8, timber: 0x4a4458, roof: 0x3a4a7a, roof2: 0x2a3a68, stone: 0xb8b4c4, trim: 0xe8c860, glow: 0xffe8a0 },
  ruin: { wall: 0x5a5468, wall2: 0x4a4458, timber: 0x2a2430, roof: 0x3a2a4a, roof2: 0x2a1a3a, stone: 0x6a6478, trim: 0x8a5ad8, glow: 0xb87aff },
};

const B = () => new Builder(Math.random() * 1e6);

// ---------------------------------------------------------- glTF kit (KayKit Medieval Hexagon + Halloween)
import { Assets } from './assets.js';
import { bake, appendBaked } from './envmodels.js';
const TOWN = 'env/town.glb', GRAVE = 'env/grave.glb', ITEMS = 'items/items.glb';
// style -> roof colour variant of the kit and an overall colour multiplier
const KIT_STYLE = { village: ['red', null], elven: ['green', 0xf0fff0], desert: ['yellow', 0xfff4e0], dwarven: ['blue', 0xe8eef8], fort: ['red', 0x9a8c88], holy: ['blue', 0xffffff], ruin: ['blue', 0x9a96aa] };
// Which kit model to use for a structure. Returns [pack, name, fit, value, yaw] where fit is
// 'w' (scale so the footprint width = value), 'h' (height = value) or 's' (uniform scale).
function kitFor(it) {
  const [c] = KIT_STYLE[it.style || 'village'] || KIT_STYLE.village;
  const hash = Math.abs(Math.sin(it.x * 12.9898 + it.z * 78.233)) * 1e4 % 1;
  switch (it.type) {
    case 'house': {
      const k = it.kit || (it.floors >= 2 || (it.w ?? 5) >= 6.5 ? 'home_B' : 'home_A');
      return [TOWN, `${k.toLowerCase()}_${c}`, 'w', (it.w ?? 5) + 0.4, 0];
    }
    case 'hut': return [TOWN, `home_a_${c}`, 'w', 4.6, 0];
    case 'tower': return [TOWN, `${(it.r ?? 2) > 2.2 ? 'tower_b' : 'tower_a'}_${c}`, 'h', (it.h ?? 9) + (it.r ?? 2) * 1.6, 0];
    case 'temple': return it.style === 'ruin' ? null : [TOWN, `church_${c}`, 'h', Math.min(13, (it.w ?? 10) * 1.2), 0];
    case 'windmill': return [TOWN, `windmill_${c}`, 'h', 9.5, 0];
    case 'well': return [TOWN, `well_${c}`, 'w', 2.8, 0];
    case 'tent': return Assets.isLoaded(ITEMS) && Assets.template(ITEMS, 's_tent') ? [ITEMS, 's_tent', 'w', 4.2 * (it.s ?? 1), 0] : null;
    case 'stall': return [TOWN, `market_${c}`, 'w', 5.4, Math.PI];
    case 'fountain': return [TOWN, `well_${c}`, 'w', 3.8, 0];
    case 'crates': return [TOWN, ['crate_a_big', 'barrel', 'crate_long_a', 'sack', 'crate_b_big'][Math.floor(hash * 5)], 'h', 1.1, 0];
    case 'banner': return [TOWN, `flag_${c}`, 'h', 3.6, 0];
    case 'lamp': return Assets.isLoaded(GRAVE) ? [GRAVE, 'post_lantern', 'h', 3.3, 0] : null;
    case 'gate': return it.wallType === 'palisade' ? [TOWN, 'fence_wood_straight_gate', 's', 5, Math.PI / 2] : [TOWN, 'wall_straight_gate', 's', 3.1, 0];
    case 'cave': return it.style === 'ruin' || it.style === 'elven' ? null : [TOWN, `mine_${c}`, 'w', 11, Math.PI];
    default: return null;
  }
}
// walls & fences are tiled from short kit segments along local x
const TILE = { wall: [TOWN, 'wall_straight', 6.2], palisade: [TOWN, 'fence_wood_straight', 4.6], fence: [TOWN, 'fence_wood_straight', 2.8] };
const _km = new THREE.Matrix4(), _kq = new THREE.Quaternion(), _ky = new THREE.Vector3(0, 1, 0);
function kitPiece(target, b, x, y, z, rot, scale, mul) {
  _kq.setFromAxisAngle(_ky, rot);
  _km.compose(new THREE.Vector3(x, y, z), _kq, new THREE.Vector3(scale, scale, scale));
  appendBaked(target, b, _km, mul);
}

// ---------------------------------------------------------- builders
// Return {solid:Builder, glow:Builder, col:[{x,z,w,d}] (local, axis aligned before rotation)}
function house(st, o = {}) {
  const s = B(), g = B();
  const w = o.w ?? 5, d = o.d ?? 4, h = o.h ?? 2.8, floors = o.floors ?? 1;
  const H = h * floors;
  s.add(box(w + 0.3, 0.5, d + 0.3), { p: [0, 0.25, 0], color: st.stone });
  s.add(box(w, H, d), { p: [0, 0.5 + H / 2, 0], color: [st.wall2, st.wall], shade: 0.02 });
  if (!st.flat) {
    // timber frame
    for (const sx of [-1, 1]) s.add(box(0.18, H, 0.18), { p: [sx * (w / 2 - 0.02), 0.5 + H / 2, d / 2 + 0.01], color: st.timber });
    for (const sx of [-1, 1]) s.add(box(0.18, H, 0.18), { p: [sx * (w / 2 - 0.02), 0.5 + H / 2, -d / 2 - 0.01], color: st.timber });
    for (let f = 1; f <= floors; f++) s.add(box(w + 0.05, 0.16, d + 0.05), { p: [0, 0.5 + h * f, 0], color: st.timber });
    s.add(prism(w + 0.8, Math.min(2.4, d * 0.55), d + 0.9), { p: [0, 0.5 + H + 0.08, 0], color: [st.roof2, st.roof], shade: 0.04 });
    // gable walls
    s.add(prism(w - 0.05, Math.min(2.4, d * 0.55) - 0.1, d - 0.1), { p: [0, 0.5 + H, 0], color: st.wall });
    // chimney
    if (o.chimney !== false) s.add(box(0.6, 1.8, 0.6), { p: [w * 0.28, 0.5 + H + 0.9, -d * 0.15], color: st.stone });
  } else {
    s.add(box(w + 0.3, 0.3, d + 0.3), { p: [0, 0.5 + H + 0.15, 0], color: st.roof });
    for (let i = -2; i <= 2; i++) s.add(box(0.5, 0.35, 0.5), { p: [i * (w / 5), 0.5 + H + 0.45, d / 2], color: st.wall });
    if (o.dome) s.add(sphere(Math.min(w, d) * 0.35, 8, 5), { p: [0, 0.5 + H + 0.3, 0], s: [1, 0.8, 1], color: st.trim });
  }
  // door
  s.add(box(1.0, 1.8, 0.12), { p: [0, 0.5 + 0.9, d / 2 + 0.06], color: st.trim });
  s.add(box(1.2, 0.15, 0.2), { p: [0, 0.5 + 1.85, d / 2 + 0.08], color: st.timber });
  // windows (glow)
  for (let f = 0; f < floors; f++) {
    const y = 0.5 + h * f + h * 0.55;
    for (const sx of [-1, 1]) {
      if (f === 0 && Math.abs(sx * w * 0.3) < 0.9) continue;
      g.add(box(0.7, 0.8, 0.08), { p: [sx * w * 0.3, y, d / 2 + 0.04], color: st.glow, shade: 0 });
      s.add(box(0.85, 0.12, 0.14), { p: [sx * w * 0.3, y - 0.45, d / 2 + 0.07], color: st.timber });
    }
    g.add(box(0.08, 0.8, 0.7), { p: [w / 2 + 0.04, y, 0], color: st.glow, shade: 0 });
    g.add(box(0.08, 0.8, 0.7), { p: [-w / 2 - 0.04, y, 0], color: st.glow, shade: 0 });
  }
  if (st.snow && !st.flat) s.add(prism(w + 0.9, Math.min(2.4, d * 0.55) * 0.35, d + 1.0), { p: [0, 0.5 + H + 0.08 + Math.min(2.4, d * 0.55) * 0.66, 0], color: 0xf2f6fa });
  return { s, g, col: [{ x: 0, z: 0, w: w + 0.3, d: d + 0.3 }] };
}

function tower(st, o = {}) {
  const s = B(), g = B();
  const r = o.r ?? 2, h = o.h ?? 9;
  s.add(cyl(r, r * 1.1, h, 8), { p: [0, h / 2, 0], color: [shadeHex(st.stone, -0.15), st.stone] });
  s.add(cyl(r * 1.2, r * 1.2, 0.6, 8), { p: [0, h + 0.3, 0], color: shadeHex(st.stone, 0.05) });
  for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; s.add(box(0.6, 0.7, 0.6), { p: [Math.cos(a) * r * 1.05, h + 0.95, Math.sin(a) * r * 1.05], r: [0, -a, 0], color: st.stone }); }
  if (o.roof !== false) s.add(cone(r * 1.35, r * 1.8, 8), { p: [0, h + 0.6 + r * 0.9, 0], color: [st.roof2, st.roof] });
  for (let i = 0; i < 3; i++) g.add(box(0.4, 0.8, 0.1), { p: [Math.sin(i * 2.1) * (r + 0.02), 2 + i * (h / 3.5), Math.cos(i * 2.1) * (r + 0.02)], r: [0, i * 2.1, 0], color: st.glow, shade: 0 });
  s.add(box(1.2, 2, 0.2), { p: [0, 1, r * 1.04], color: st.trim });
  if (o.flag) { s.add(cyl(0.05, 0.05, 2.5, 4), { p: [0, h + r * 1.8 + 1.4, 0], color: 0x5a3a22 }); s.add(box(0.05, 0.7, 1.1), { p: [0, h + r * 1.8 + 2.2, 0.55], color: o.flag }); }
  return { s, g, col: [{ x: 0, z: 0, w: r * 2.1, d: r * 2.1 }] };
}

function wall(st, o = {}) {
  const s = B(), g = B();
  const L = o.l ?? 10, h = o.h ?? 3.2;
  s.add(box(L, h, 1.1), { p: [0, h / 2, 0], color: [shadeHex(st.stone, -0.15), st.stone], shade: 0.03 });
  for (let x = -L / 2 + 0.5; x <= L / 2 - 0.4; x += 1.4) s.add(box(0.7, 0.6, 1.2), { p: [x, h + 0.3, 0], color: st.stone });
  return { s, g, col: [{ x: 0, z: 0, w: L, d: 1.2 }] };
}

function palisade(st, o = {}) {
  const s = B(), g = B();
  const L = o.l ?? 10;
  for (let x = -L / 2 + 0.25; x <= L / 2; x += 0.5) {
    const h = 2.4 + Math.sin(x * 7) * 0.2;
    s.add(cyl(0.22, 0.24, h, 5), { p: [x, h / 2, 0], color: st.timber });
    s.add(cone(0.22, 0.4, 5), { p: [x, h + 0.2, 0], color: shadeHex(st.timber, 0.1) });
  }
  s.add(box(L, 0.15, 0.1), { p: [0, 1.6, 0.25], color: shadeHex(st.timber, -0.2) });
  return { s, g, col: [{ x: 0, z: 0, w: L, d: 0.6 }] };
}

function gate(st, o = {}) {
  const s = B(), g = B();
  const w = o.w ?? 6, h = o.h ?? 5;
  for (const sx of [-1, 1]) {
    s.add(box(1.6, h, 1.6), { p: [sx * (w / 2 + 0.8), h / 2, 0], color: [shadeHex(st.stone, -0.1), st.stone] });
    s.add(pyramid(1.9, 1.2, 1.9), { p: [sx * (w / 2 + 0.8), h, 0], color: st.roof });
    g.add(box(0.3, 0.4, 0.1), { p: [sx * (w / 2 + 0.8), h * 0.65, 0.82], color: st.glow, shade: 0 });
  }
  s.add(box(w + 0.4, 1.0, 1.4), { p: [0, h - 0.5, 0], color: st.stone });
  s.add(box(w, 0.4, 0.2), { p: [0, h - 1.2, 0.72], color: st.trim });
  return { s, g, col: [{ x: -(w / 2 + 0.8), z: 0, w: 1.6, d: 1.6 }, { x: (w / 2 + 0.8), z: 0, w: 1.6, d: 1.6 }] };
}

function well(st) {
  const s = B(), g = B();
  s.add(cyl(1.0, 1.1, 0.9, 10), { p: [0, 0.45, 0], color: st.stone });
  s.add(cyl(0.8, 0.8, 0.05, 10), { p: [0, 0.8, 0], color: 0x2a4a6a });
  for (const sx of [-1, 1]) s.add(box(0.15, 1.8, 0.15), { p: [sx * 0.9, 1.3, 0], color: st.timber });
  s.add(prism(2.4, 0.7, 1.4), { p: [0, 2.15, 0], color: st.roof });
  s.add(cyl(0.08, 0.08, 1.8, 5), { p: [0, 1.7, 0], r: [0, 0, Math.PI / 2], color: st.timber });
  return { s, g, col: [{ x: 0, z: 0, w: 2.2, d: 2.2 }] };
}

function fountain(st) {
  const s = B(), g = B();
  s.add(cyl(2.6, 2.8, 0.7, 12), { p: [0, 0.35, 0], color: st.stone });
  s.add(cyl(2.3, 2.3, 0.05, 12), { p: [0, 0.62, 0], color: 0x4ab0d8, shade: 0 });
  s.add(cyl(0.4, 0.55, 1.6, 8), { p: [0, 1.2, 0], color: st.stone });
  s.add(cyl(1.0, 0.8, 0.3, 10), { p: [0, 2.0, 0], color: st.stone });
  s.add(cyl(0.9, 0.9, 0.04, 10), { p: [0, 2.16, 0], color: 0x4ab0d8, shade: 0 });
  s.add(octa(0.35), { p: [0, 2.7, 0], s: [1, 1.6, 1], color: st.trim });
  return { s, g, col: [{ x: 0, z: 0, w: 5.4, d: 5.4 }] };
}

function stall(st, o = {}) {
  const s = B(), g = B();
  const c = o.c ?? [0xc84a3a, 0xf0e8d8][Math.floor(Math.random() * 2)];
  s.add(box(2.6, 0.9, 1.2), { p: [0, 0.45, 0.2], color: st.timber });
  for (const [x, z] of [[-1.25, -0.5], [1.25, -0.5], [-1.25, 0.8], [1.25, 0.8]]) s.add(box(0.12, 2.3, 0.12), { p: [x, 1.15, z], color: st.timber });
  for (let i = 0; i < 5; i++) s.add(box(0.55, 0.06, 1.5), { p: [-1.1 + i * 0.55, 2.35 + (i % 2) * 0.05, 0.15], r: [0.15, 0, 0], color: i % 2 ? c : 0xf0e8d8 });
  const goods = [0xd8402a, 0xf0c040, 0x6aa84f, 0xa86a3a, 0x8a6ad8];
  for (let i = 0; i < 6; i++) s.add(ico(0.13, 0), { p: [-0.9 + i * 0.36, 0.98, 0.2 + (i % 2) * 0.25], color: goods[i % goods.length] });
  return { s, g, col: [{ x: 0, z: 0.2, w: 2.8, d: 1.6 }] };
}

function lamp(st) {
  const s = B(), g = B();
  s.add(cyl(0.08, 0.12, 3, 5), { p: [0, 1.5, 0], color: 0x2a2a2a });
  s.add(box(0.7, 0.08, 0.08), { p: [0.3, 2.9, 0], color: 0x2a2a2a });
  g.add(box(0.28, 0.4, 0.28), { p: [0.55, 2.6, 0], color: st.glow, shade: 0 });
  s.add(pyramid(0.4, 0.2, 0.4), { p: [0.55, 2.8, 0], color: 0x2a2a2a });
  return { s, g, col: [{ x: 0, z: 0, w: 0.3, d: 0.3 }] };
}

function tent(st, o = {}) {
  const s = B(), g = B();
  const c = o.c ?? st.roof;
  s.add(pyramid(4, 3, 4), { p: [0, 0, 0], color: [shadeHex(c, -0.2), c] });
  s.add(box(1.0, 1.5, 0.1), { p: [0, 0.75, 1.55], color: 0x2a1a10 });
  s.add(cyl(0.05, 0.05, 1, 4), { p: [0, 3.3, 0], color: st.timber });
  s.add(box(0.05, 0.4, 0.6), { p: [0, 3.6, 0.3], color: st.trim });
  return { s, g, col: [{ x: 0, z: 0, w: 3.6, d: 3.6 }] };
}

function crates(st) {
  const s = B(), g = B();
  s.add(box(0.9, 0.9, 0.9), { p: [0, 0.45, 0], color: 0x9a7a4a });
  s.add(box(0.8, 0.8, 0.8), { p: [0.95, 0.4, 0.2], r: [0, 0.4, 0], color: 0x8a6a3a });
  s.add(box(0.7, 0.7, 0.7), { p: [0.3, 1.25, 0.1], r: [0, 0.2, 0], color: 0xa88a5a });
  s.add(cyl(0.38, 0.38, 1, 8), { p: [-0.9, 0.5, 0.3], color: 0x7a5a3a });
  s.add(torus(0.39, 0.04, 3, 8), { p: [-0.9, 0.75, 0.3], r: [Math.PI / 2, 0, 0], color: 0x3a3a3a });
  s.add(torus(0.39, 0.04, 3, 8), { p: [-0.9, 0.25, 0.3], r: [Math.PI / 2, 0, 0], color: 0x3a3a3a });
  return { s, g, col: [{ x: 0, z: 0.1, w: 2.8, d: 1.4 }] };
}

function campfire(st) {
  const s = B(), g = B();
  for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; s.add(dodeca(0.18), { p: [Math.cos(a) * 0.6, 0.1, Math.sin(a) * 0.6], color: 0x6a6a6a }); }
  for (let i = 0; i < 4; i++) s.add(cyl(0.07, 0.07, 1, 4), { p: [0, 0.2, 0], r: [Math.PI / 2 - 0.4, i * 0.8, 0], order: 'YXZ', color: 0x5a3a22 });
  g.add(cone(0.35, 0.8, 5), { p: [0, 0.5, 0], color: 0xff8a20, shade: 0 });
  g.add(cone(0.2, 0.55, 5), { p: [0.05, 0.45, 0.05], color: 0xffe060, shade: 0 });
  return { s, g, col: [{ x: 0, z: 0, w: 1.4, d: 1.4 }] };
}

function waystone(st) {
  const s = B(), g = B();
  s.add(cyl(1.3, 1.5, 0.4, 8), { p: [0, 0.2, 0], color: 0x8a8a90 });
  s.add(cyl(0.9, 1.1, 0.3, 8), { p: [0, 0.55, 0], color: 0x9a9aa0 });
  s.add(taper(0.7, 0.5, 0.3, 0.25, 3.2), { p: [0, 2.3, 0], color: [0x6a6a78, 0x9a9aa8] });
  g.add(box(0.12, 1.6, 0.05), { p: [0, 2.3, 0.26], color: 0x6ad8ff, shade: 0 });
  g.add(box(0.5, 0.1, 0.05), { p: [0, 2.6, 0.27], color: 0x6ad8ff, shade: 0 });
  g.add(octa(0.28), { p: [0, 4.3, 0], s: [1, 1.5, 1], color: 0x8ae8ff, shade: 0 });
  return { s, g, col: [{ x: 0, z: 0, w: 2, d: 2 }] };
}

function portal(st, o = {}) {
  const s = B(), g = B();
  const c = o.c ?? 0x8a6aff;
  for (const sx of [-1, 1]) s.add(box(0.9, 4.6, 0.9), { p: [sx * 2, 2.3, 0], color: [0x5a5a68, 0x8a8a98] });
  s.add(box(5, 0.9, 1.0), { p: [0, 4.9, 0], color: 0x7a7a88 });
  for (const sx of [-1, 1]) g.add(octa(0.25), { p: [sx * 2, 5.0, 0.55], color: c, shade: 0 });
  g.add(box(3.1, 4.2, 0.08), { p: [0, 2.3, 0], color: c, shade: 0 });
  return { s, g, col: [{ x: -2, z: 0, w: 0.9, d: 0.9 }, { x: 2, z: 0, w: 0.9, d: 0.9 }], portalGlow: c };
}

function cave(st, o = {}) {
  const s = B(), g = B();
  const c = o.rock ?? 0x6a6460;
  s.add(jitter(ico(4.5, 1), 0.8, 7), { p: [0, 1.2, -1.5], s: [1.3, 0.9, 1], color: [shadeHex(c, -0.2), c] });
  s.add(box(3.6, 3.4, 1.5), { p: [0, 1.7, 2.6], color: 0x0a0806 });
  for (const sx of [-1, 1]) s.add(jitter(dodeca(1.6), 0.4, 3 + sx), { p: [sx * 2.8, 1.4, 2.4], color: c });
  s.add(jitter(dodeca(1.8), 0.4, 9), { p: [0, 4.1, 2.2], s: [1.6, 0.6, 1], color: c });
  for (const sx of [-1, 1]) { s.add(cyl(0.08, 0.1, 1.6, 4), { p: [sx * 2.2, 0.8, 3.4], color: 0x5a3a22 }); g.add(cone(0.18, 0.4, 5), { p: [sx * 2.2, 1.75, 3.4], color: 0xff9a2a, shade: 0 }); }
  return { s, g, col: [{ x: 0, z: -1, w: 10, d: 6 }, { x: -2.9, z: 2.4, w: 2.4, d: 2 }, { x: 2.9, z: 2.4, w: 2.4, d: 2 }] };
}

function temple(st, o = {}) {
  const s = B(), g = B();
  const w = o.w ?? 10, d = o.d ?? 8;
  for (let i = 0; i < 3; i++) s.add(box(w + 2 - i * 0.8, 0.4, d + 2 - i * 0.8), { p: [0, 0.2 + i * 0.4, 0], color: shadeHex(st.stone, -0.05 * i) });
  for (let x = -1; x <= 1; x += 2) for (let z = -1; z <= 1; z += 0.66) s.add(cyl(0.35, 0.38, 4, 8), { p: [x * (w / 2 - 0.5), 3.2, z * (d / 2 - 0.5)], color: st.stone });
  s.add(box(w + 0.6, 0.6, d + 0.6), { p: [0, 5.5, 0], color: st.stone });
  s.add(prism(w + 0.6, 1.8, d + 0.6), { p: [0, 5.8, 0], r: [0, Math.PI / 2, 0], color: [st.roof2, st.roof] });
  s.add(box(w - 2, 3.5, d - 2), { p: [0, 2.9, 0], color: st.wall });
  g.add(box(1.4, 2.4, 0.1), { p: [0, 2.4, (d - 2) / 2 + 0.05], color: st.glow, shade: 0 });
  return { s, g, col: [{ x: 0, z: 0, w: w + 1, d: d + 1 }] };
}

function windmill(st) {
  const s = B(), g = B();
  s.add(taper(3.2, 3.2, 2.2, 2.2, 7), { p: [0, 3.5, 0], color: [st.wall2, st.wall] });
  s.add(pyramid(3, 2, 3), { p: [0, 7, 0], color: st.roof });
  s.add(box(1, 1.8, 0.1), { p: [0, 0.9, 1.6], color: st.trim });
  for (let i = 0; i < 4; i++) s.add(box(0.5, 4.2, 0.08), { p: [Math.cos(i * Math.PI / 2 + 0.4) * 2.1, 6.2 + Math.sin(i * Math.PI / 2 + 0.4) * 2.1, 1.8], r: [0, 0, i * Math.PI / 2 + 0.4 - Math.PI / 2], color: 0xe8dcc0 });
  return { s, g, col: [{ x: 0, z: 0, w: 3.2, d: 3.2 }] };
}

function statue(st, o = {}) {
  const s = B(), g = B();
  s.add(box(2, 1.2, 2), { p: [0, 0.6, 0], color: st.stone });
  s.add(taper(0.7, 0.5, 0.9, 0.6, 1.6), { p: [0, 2.0, 0], color: 0xb8b8b0 });
  s.add(sphere(0.35, 7, 5), { p: [0, 3.15, 0], color: 0xb8b8b0 });
  s.add(box(0.12, 2.6, 0.12), { p: [0.6, 2.4, 0.2], color: 0xb8b8b0 });
  s.add(box(0.6, 0.12, 0.12), { p: [0.6, 3.2, 0.2], color: 0xb8b8b0 });
  return { s, g, col: [{ x: 0, z: 0, w: 2, d: 2 }] };
}

function bridge(st, o = {}) {
  const s = B(), g = B();
  const L = o.l ?? 14;
  s.add(box(3.4, 0.4, L), { p: [0, 0.6, 0], color: st.timber });
  for (const sx of [-1, 1]) {
    s.add(box(0.15, 0.15, L), { p: [sx * 1.6, 1.6, 0], color: st.timber });
    for (let z = -L / 2; z <= L / 2; z += 2) s.add(box(0.18, 1.1, 0.18), { p: [sx * 1.6, 1.15, z], color: st.timber });
  }
  for (let z = -L / 2 + 2; z < L / 2; z += 4) for (const sx of [-1, 1]) s.add(cyl(0.25, 0.3, 4, 6), { p: [sx * 1.3, -1.2, z], color: st.timber });
  return { s, g, col: [], bridge: { L, w: 3.4, h: 0.8 } };
}

function anvil(st) {
  const s = B(), g = B();
  s.add(box(0.5, 0.6, 0.4), { p: [0, 0.3, 0], color: 0x5a3a22 });
  s.add(box(0.9, 0.25, 0.35), { p: [0, 0.72, 0], color: 0x3a3a40 });
  s.add(cone(0.15, 0.4, 4), { p: [0.6, 0.75, 0], r: [0, 0, -Math.PI / 2], color: 0x3a3a40 });
  s.add(box(1.4, 1.3, 1.0), { p: [1.5, 0.65, -0.5], color: st.stone });
  g.add(box(0.8, 0.3, 0.1), { p: [1.5, 0.6, 0.02], color: 0xff7a2a, shade: 0 });
  return { s, g, col: [{ x: 0.7, z: -0.2, w: 2.5, d: 1.4 }] };
}

function banner(st, o = {}) {
  const s = B(), g = B();
  s.add(cyl(0.07, 0.08, 4.2, 5), { p: [0, 2.1, 0], color: 0x3a2a1a });
  s.add(box(1.0, 1.8, 0.05), { p: [0, 3.0, 0.1], color: o.c ?? st.trim });
  s.add(box(1.1, 0.1, 0.1), { p: [0, 3.95, 0.1], color: 0xd8b04a });
  return { s, g, col: [{ x: 0, z: 0, w: 0.3, d: 0.3 }] };
}

function fence(st, o = {}) {
  const s = B(), g = B();
  const L = o.l ?? 6;
  for (let x = -L / 2; x <= L / 2 + 0.01; x += 1.5) s.add(box(0.15, 1.1, 0.15), { p: [x, 0.55, 0], color: st.timber });
  for (const y of [0.45, 0.85]) s.add(box(L, 0.1, 0.08), { p: [0, y, 0], color: shadeHex(st.timber, 0.1) });
  return { s, g, col: [{ x: 0, z: 0, w: L, d: 0.3 }] };
}

function obelisk(st, o = {}) {
  const s = B(), g = B();
  s.add(box(1.6, 0.5, 1.6), { p: [0, 0.25, 0], color: st.stone });
  s.add(taper(0.9, 0.9, 0.4, 0.4, 5), { p: [0, 3, 0], color: [shadeHex(st.stone, -0.2), st.stone] });
  s.add(pyramid(0.45, 0.6, 0.45), { p: [0, 5.5, 0], color: st.trim });
  g.add(box(0.1, 2.5, 0.05), { p: [0, 3, 0.36], color: o.glow ?? st.glow, shade: 0 });
  return { s, g, col: [{ x: 0, z: 0, w: 1.6, d: 1.6 }] };
}

function igloo(st) {
  const s = B(), g = B();
  s.add(new THREE.SphereGeometry(2.4, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), { color: [0xc8d8e8, 0xf2f6fa] });
  s.add(box(1.2, 1.4, 1.6), { p: [0, 0.7, 2.2], color: 0xe8f0f8 });
  s.add(box(0.8, 1.1, 0.1), { p: [0, 0.55, 3.0], color: 0x2a3040 });
  g.add(box(0.5, 0.4, 0.05), { p: [0, 0.6, 3.06], color: st.glow, shade: 0 });
  return { s, g, col: [{ x: 0, z: 0, w: 4.6, d: 4.6 }] };
}

function treehouse(st) {
  const s = B(), g = B();
  s.add(cyl(0.9, 1.3, 7, 8), { p: [0, 3.5, 0], color: [0x5a3a24, 0x7a5a3a] });
  s.add(cyl(3, 3, 0.3, 10), { p: [0, 4.2, 0], color: st.timber });
  s.add(cyl(2.4, 2.4, 2.4, 10), { p: [0, 5.5, 0], color: st.wall });
  s.add(cone(3.2, 2.6, 10), { p: [0, 7.9, 0], color: [st.roof2, st.roof] });
  for (let i = 0; i < 4; i++) g.add(box(0.5, 0.7, 0.1), { p: [Math.sin(i * 1.57) * 2.41, 5.6, Math.cos(i * 1.57) * 2.41], r: [0, i * 1.57, 0], color: st.glow, shade: 0 });
  for (let i = 0; i < 8; i++) s.add(box(1.2, 0.12, 0.5), { p: [Math.sin(i * 0.5) * 1.2, 0.4 + i * 0.48, Math.cos(i * 0.5) * 1.2], r: [0, i * 0.5, 0], color: st.timber });
  return { s, g, col: [{ x: 0, z: 0, w: 2.2, d: 2.2 }] };
}

function hut(st, o = {}) { // round thatched / stone hut
  const s = B(), g = B();
  s.add(cyl(2.2, 2.3, 2.6, 9), { p: [0, 1.3, 0], color: [st.wall2, st.wall] });
  s.add(cone(3, 2.4, 9), { p: [0, 3.8, 0], color: [st.roof2, st.roof] });
  s.add(box(1, 1.8, 0.2), { p: [0, 0.9, 2.2], color: st.trim });
  g.add(box(0.5, 0.5, 0.1), { p: [1.4, 1.6, 1.75], r: [0, 0.65, 0], color: st.glow, shade: 0 });
  if (st.snow) s.add(cone(2.4, 1.0, 9), { p: [0, 4.55, 0], color: 0xf2f6fa });
  return { s, g, col: [{ x: 0, z: 0, w: 4.4, d: 4.4 }] };
}

function rubble(st) {
  const s = B(), g = B();
  for (let i = 0; i < 6; i++) s.add(box(0.6 + Math.random() * 0.8, 0.4 + Math.random() * 0.5, 0.6 + Math.random() * 0.6), { p: [(Math.random() - 0.5) * 3, 0.2, (Math.random() - 0.5) * 3], r: [Math.random() * 0.3, Math.random() * 3, Math.random() * 0.3], color: st.stone });
  s.add(box(3, 2.2, 0.8), { p: [0, 1.1, -1.2], r: [0, 0, 0.05], color: st.wall });
  return { s, g, col: [{ x: 0, z: -1.2, w: 3, d: 0.8 }] };
}

function altar(st, o = {}) {
  const s = B(), g = B();
  s.add(cyl(2.5, 2.8, 0.5, 8), { p: [0, 0.25, 0], color: st.stone });
  s.add(box(1.8, 1.0, 1.0), { p: [0, 1.0, 0], color: shadeHex(st.stone, -0.15) });
  g.add(octa(0.4), { p: [0, 2.1, 0], s: [1, 1.6, 1], color: o.glow ?? st.glow, shade: 0 });
  for (let i = 0; i < 4; i++) { const a = i / 4 * Math.PI * 2 + 0.78; s.add(cyl(0.2, 0.25, 2.2, 6), { p: [Math.cos(a) * 2.2, 1.1, Math.sin(a) * 2.2], color: st.stone }); g.add(cone(0.15, 0.35, 5), { p: [Math.cos(a) * 2.2, 2.4, Math.sin(a) * 2.2], color: o.glow ?? st.glow, shade: 0 }); }
  return { s, g, col: [{ x: 0, z: 0, w: 2, d: 1.2 }] };
}

function boardTable(st) { // quest/bounty board
  const s = B(), g = B();
  for (const sx of [-1, 1]) s.add(box(0.15, 2.4, 0.15), { p: [sx * 0.9, 1.2, 0], color: st.timber });
  s.add(box(2.1, 1.3, 0.1), { p: [0, 1.55, 0], color: 0x8a6a3a });
  s.add(prism(2.4, 0.4, 0.5), { p: [0, 2.4, 0], color: st.roof });
  const cols = [0xf0e8d0, 0xe8dcc0, 0xf8f0e0];
  for (let i = 0; i < 5; i++) s.add(box(0.35, 0.45, 0.02), { p: [-0.7 + i * 0.35, 1.5 + (i % 2) * 0.2, 0.06], r: [0, 0, (i - 2) * 0.05], color: cols[i % 3] });
  return { s, g, col: [{ x: 0, z: 0, w: 2.2, d: 0.4 }] };
}

const BUILDERS = { house, tower, wall, palisade, gate, well, fountain, stall, lamp, tent, crates, campfire, waystone, portal, cave, temple, windmill, statue, bridge, anvil, banner, fence, obelisk, igloo, treehouse, hut, rubble, altar, board: boardTable };

/**
 * Build all structures of a zone into merged meshes.
 * list: [{type, x, z, rot, style, s, ...opts}], heightAt(x,z)
 * returns {solid: Mesh, glow: Mesh, colliders: [{x,z,hw,hd,rot}], extras: [...]}
 */
export function buildStructures(list, heightAt) {
  const solid = new Builder(5), glow = new Builder(6);
  const colliders = [], extras = [];
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
  for (const it of list) {
    if (buildKit(it, solid, colliders, extras, heightAt)) continue;
    const fn = BUILDERS[it.type]; if (!fn) continue;
    const st = STYLES[it.style || 'village'];
    const res = fn(st, it);
    const y = it.y ?? (it.type === 'bridge' ? (it.by ?? heightAt(it.x, it.z)) : minHeight(heightAt, it.x, it.z, 2.5));
    const sc = it.s ?? 1;
    q.setFromAxisAngle(up, it.rot || 0);
    m.compose(new THREE.Vector3(it.x, y, it.z), q, new THREE.Vector3(sc, sc, sc));
    mergeInto(solid, res.s, m); mergeInto(glow, res.g, m);
    for (const c of res.col) {
      const cr = Math.cos(it.rot || 0), sr = Math.sin(it.rot || 0);
      colliders.push({ x: it.x + (c.x * cr + c.z * sr) * sc, z: it.z + (-c.x * sr + c.z * cr) * sc, hw: c.w / 2 * sc, hd: c.d / 2 * sc, rot: it.rot || 0 });
    }
    extras.push({ ...it, y, portalGlow: res.portalGlow, bridge: res.bridge });
  }
  const sm = new THREE.Mesh(solid.build(), lambert('structures'));
  sm.castShadow = true; sm.receiveShadow = true;
  const gm = new THREE.Mesh(glow.build(), basic('glowStruct', { toneMapped: false }));
  return { solid: sm, glow: gm, colliders, extras };
}

// Place a kit model (or tiled kit segments). Returns false when the procedural builder should be used.
function buildKit(it, solid, colliders, extras, heightAt) {
  if (!Assets.isLoaded(TOWN) || it.procedural) return false;
  const mul = (KIT_STYLE[it.style || 'village'] || KIT_STYLE.village)[1];
  const rot = it.rot || 0, cr = Math.cos(rot), sr = Math.sin(rot);
  const T = TILE[it.type];
  if (T) {
    const b = bake(T[0], T[1]); if (!b) return false;
    const L = it.l ?? 10;
    // the segment's long axis may be x or z in the source model
    const along = b.sx >= b.sz ? b.sx : b.sz, seg = T[2], sc = seg / along, yaw0 = b.sx >= b.sz ? 0 : Math.PI / 2;
    const n = Math.max(1, Math.round(L / seg)), step = L / n;
    for (let i = 0; i < n; i++) {
      const lx = -L / 2 + step * (i + 0.5);
      const x = it.x + lx * cr, z = it.z - lx * sr;
      kitPiece(solid, b, x, minHeight(heightAt, x, z, 0.8), z, rot + yaw0, sc * (step / seg), mul);
    }
    colliders.push({ x: it.x, z: it.z, hw: L / 2, hd: Math.max(0.5, (b.sx >= b.sz ? b.sz : b.sx) * sc * 0.5), rot });
    extras.push({ ...it, y: heightAt(it.x, it.z) });
    return true;
  }
  const k = kitFor(it); if (!k) return false;
  const [pack, name, fit, val, yaw] = k;
  const b = bake(pack, name); if (!b) return false;
  const sc = fit === 'w' ? val / Math.max(b.sx, b.sz) : fit === 'h' ? val / b.h : val;
  const fr = Math.max(b.sx, b.sz) * sc * 0.5;
  const y = it.y ?? minHeight(heightAt, it.x, it.z, Math.min(4, fr * 0.7));
  kitPiece(solid, b, it.x, y, it.z, rot + yaw, sc, mul);
  const big = !['crates', 'lamp', 'banner', 'campfire'].includes(it.type);
  if (big) {
    // footprint (KayKit buildings sit on a base that is a little larger than the walls)
    const swap = Math.abs(Math.sin(yaw)) > 0.5, sxw = (swap ? b.sz : b.sx) * sc * 0.78, szw = (swap ? b.sx : b.sz) * sc * 0.78;
    if (it.type === 'gate') {
      for (const sx of [-1, 1]) colliders.push({ x: it.x + sx * sxw * 0.42 * cr, z: it.z - sx * sxw * 0.42 * sr, hw: sxw * 0.14, hd: szw / 2, rot });
    } else colliders.push({ x: it.x, z: it.z, hw: sxw / 2, hd: szw / 2, rot });
  } else if (it.type !== 'banner') colliders.push({ x: it.x, z: it.z, hw: 0.45, hd: 0.45, rot });
  extras.push({ ...it, y, kit: name });
  return true;
}

function minHeight(hAt, x, z, r) {
  let h = Infinity;
  for (const [dx, dz] of [[0, 0], [r, 0], [-r, 0], [0, r], [0, -r]]) h = Math.min(h, hAt(x + dx, z + dz));
  return h - 0.05;
}

function mergeInto(target, src, m) {
  const v = new THREE.Vector3();
  for (let i = 0; i < src.pos.length; i += 3) {
    v.set(src.pos[i], src.pos[i + 1], src.pos[i + 2]).applyMatrix4(m);
    target.pos.push(v.x, v.y, v.z);
  }
  for (let i = 0; i < src.col.length; i++) target.col.push(src.col[i]);
  for (let i = 0; i < src.sIdx.length; i++) target.sIdx.push(0);
}

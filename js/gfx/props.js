// Low-poly nature props + instanced scattering in spatial chunks.
import * as THREE from 'three';
import { Builder, box, cyl, cone, ico, octa, dodeca, sphere, taper, jitter, tetra, torus } from './geom.js';
import { lambert, foliage } from './materials.js';
import { rng, shadeHex, mixHex } from '../core/util.js';
import { Assets } from './assets.js';
import { bakedGeometry } from './envmodels.js';

// glTF replacements: KayKit Forest Nature Pack (itch.io, CC0) for temperate biomes, Quaternius nature pack
// for snowy variants and desert plants. type -> (zone prop opts) => [[model names], height, pack] (null = procedural)
const NAT = 'env/nature.glb', FOR = 'env/forest.glb';
const range = (p, n, a = 1) => Array.from({ length: n }, (_, i) => `${p}_${i + a}`);
const kk = (...n) => n.map(x => x.toLowerCase());
const GLTF_PROPS = {
  oak: o => o.snow ? [range('commontree_snow', 3), 6.2] : [kk('Tree_1_A', 'Tree_1_B', 'Tree_1_C', 'Tree_2_C'), 6.6, FOR],
  pine: o => o.snow ? [range('pinetree_snow', 4), 7.2] : [kk('Tree_4_A', 'Tree_4_B', 'Tree_4_C'), 7.8, FOR],
  birch: o => o.snow ? [['birchtree_snow_1'], 7] : [kk('Tree_2_A', 'Tree_2_B', 'Tree_2_D', 'Tree_2_E'), 7, FOR],
  willow: () => [kk('Tree_3_A', 'Tree_3_B', 'Tree_3_C'), 5.8, FOR],
  palm: () => [range('palmtree', 4), 7.4],
  dead: o => o.snow ? [['commontree_dead_snow_1'], 5.8] : [kk('Tree_Bare_1_A', 'Tree_Bare_1_B', 'Tree_Bare_1_C', 'Tree_Bare_2_B'), 5.6, FOR],
  shadowtree: () => [['tree_dead_large', 'tree_dead_medium', 'tree_dead_large_decorated', 'tree_dead_small'], 7.5, 'env/grave.glb'],
  bones: () => [['bone_a', 'bone_b', 'bone_c', 'ribcage', 'skull'], 0.55, 'env/grave.glb'],
  grave: () => [['gravestone', 'gravemarker_a', 'gravemarker_b', 'grave_a', 'grave_b'], 1.5, 'env/grave.glb'],
  cactus: () => [[...range('cactus', 5), 'cactusflowers_2', 'cactusflowers_3'], 2.6],
  rock: o => o.snow ? [range('rock_snow', 4), 1.3] : [kk('Rock_1_A', 'Rock_1_C', 'Rock_1_E', 'Rock_1_J'), 1.2, FOR],
  boulder: o => o.snow ? [range('rock_snow', 4), 3.2] : [kk('Rock_3_A', 'Rock_3_E', 'Rock_2_A', 'Rock_2_E'), 3.4, FOR],
  lavarock: () => [kk('Rock_3_C', 'Rock_3_H', 'Rock_1_G', 'Rock_2_C'), 1.8, FOR],
  bush: o => o.snow ? [range('bush_snow', 2), 1.4] : [kk('Bush_1_A', 'Bush_2_A', 'Bush_3_A', 'Bush_4_A'), 1.15, FOR],
  grass: o => o.snow ? null : [kk('Grass_1_A', 'Grass_1_B', 'Grass_2_A', 'Grass_2_B'), 0.75, FOR],
  flowers: () => [['flowers', 'plant_2', 'flowers'], 0.6],
  fern: () => [['plant_1', 'plant_3', 'plant_4'], 0.8],
  reeds: () => [['plant_5', 'grass_2', 'wheat'], 1.0],
  stump: o => [[o.snow ? 'treestump_snow' : o.moss ? 'treestump_moss' : 'treestump'], 0.9],
  log: o => [[o.snow ? 'woodlog_snow' : o.moss ? 'woodlog_moss' : 'woodlog'], 0.8],
};
// colour multipliers that let one model set serve several biomes
const GLTF_TINT = { lavarock: 0x6a5a58, shadowtree: 0x9a8ab8 };
export const usesGltf = type => !!GLTF_PROPS[type];
function gltfVariants(type, opts) {
  const f = GLTF_PROPS[type]; if (!f) return null;
  const spec = f(opts); if (!spec) return null;
  const [names, h, pack = NAT] = spec;
  if (!Assets.isLoaded(pack)) return null;
  // KayKit foliage takes the zone's leaf hue so one set of models serves every temperate biome
  const zc = type === 'bush' ? opts.bush ?? opts.leaf : type === 'grass' ? opts.grass ?? opts.leaf : opts.leaf;
  const leaf = pack === FOR && zc != null && !GLTF_TINT[type] ? zc : null;
  const out = names.slice(0, 4).map(n => bakedGeometry(pack, n, { height: h * (0.85 + (n.charCodeAt(n.length - 1) % 3) * 0.12), tint: GLTF_TINT[type] ?? null, leaf })).filter(Boolean);
  return out.length ? out : null;
}

// Each builder: (r, o) => BufferGeometry  (o: colour overrides). Origin at ground, +Y up.
export const PROP_BUILDERS = {
  grave(r, o) { const b = new Builder(r() * 1e6); b.add(box(0.7, 1.1, 0.22), { p: [0, 0.55, 0], color: 0x8a8a90 }); return b.build(); },
  oak(r, o) {
    const b = new Builder(r() * 1e6);
    const h = 1.6 + r() * 0.8;
    const leaf = o.leaf ?? 0x4a8a3a;
    b.add(cyl(0.16, 0.24, h, 6), { p: [0, h / 2, 0], color: [shadeHex(o.trunk ?? 0x6a4a2e, -0.2), o.trunk ?? 0x6a4a2e] });
    b.add(cyl(0.06, 0.1, 0.8, 5), { p: [0.3, h * 0.75, 0], r: [0, 0, -0.9], color: o.trunk ?? 0x6a4a2e });
    const n = 3 + Math.floor(r() * 2);
    for (let i = 0; i < n; i++) {
      const a = r() * Math.PI * 2, d = i === 0 ? 0 : 0.5 + r() * 0.35;
      const s = i === 0 ? 1.25 : 0.75 + r() * 0.35;
      b.add(jitter(ico(1, 0), 0.25, r() * 1e5), { p: [Math.cos(a) * d, h + 0.5 + (i === 0 ? 0.35 : r() * 0.5), Math.sin(a) * d], s, color: [shadeHex(leaf, -0.22), shadeHex(leaf, 0.12)], shade: 0.1 });
    }
    return b.build();
  },
  pine(r, o) {
    const b = new Builder(r() * 1e6);
    const h = 0.9 + r() * 0.5;
    const leaf = o.leaf ?? 0x2f6a3a;
    b.add(cyl(0.12, 0.18, h, 5), { p: [0, h / 2, 0], color: o.trunk ?? 0x5a3a24 });
    const tiers = 3 + Math.floor(r() * 2);
    for (let i = 0; i < tiers; i++) {
      const rad = 1.25 - i * 0.26, ch = 1.25 - i * 0.12;
      b.add(jitter(cone(rad, ch, 7), 0.08, r() * 1e5), { p: [0, h + i * 0.62 + ch / 2 - 0.15, 0], r: [0, r() * 3, 0], color: [shadeHex(leaf, -0.25), shadeHex(leaf, 0.1)], shade: 0.08 });
      if (o.snow) b.add(cone(rad * 0.62, ch * 0.42, 7), { p: [0, h + i * 0.62 + ch * 0.79 - 0.15, 0], color: 0xf2f6fa, shade: 0.04 });
    }
    return b.build();
  },
  birch(r, o) {
    const b = new Builder(r() * 1e6);
    const h = 2.4 + r() * 0.8;
    b.add(cyl(0.1, 0.14, h, 5), { p: [0, h / 2, 0], color: 0xe8e4dc });
    for (let i = 0; i < 4; i++) b.add(box(0.15, 0.04, 0.15), { p: [0, 0.4 + i * h / 4.5, 0], color: 0x2a2a2a });
    const leaf = o.leaf ?? 0x8ab04a;
    for (let i = 0; i < 3; i++) b.add(jitter(ico(0.7, 0), 0.2, r() * 1e5), { p: [(r() - 0.5) * 0.6, h + i * 0.45 - 0.2, (r() - 0.5) * 0.6], s: [1, 1.3, 1], color: [shadeHex(leaf, -0.2), shadeHex(leaf, 0.15)] });
    return b.build();
  },
  willow(r, o) {
    const b = new Builder(r() * 1e6);
    const h = 1.8 + r() * 0.5;
    const leaf = o.leaf ?? 0x6a9a4a;
    b.add(cyl(0.18, 0.3, h, 6), { p: [0, h / 2, 0], color: o.trunk ?? 0x5a4030 });
    b.add(jitter(ico(1.5, 0), 0.3, r() * 1e5), { p: [0, h + 0.4, 0], s: [1, 0.6, 1], color: leaf });
    for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; b.add(taper(0.35, 0.1, 0.15, 0.05, 1.7), { p: [Math.cos(a) * 1.2, h - 0.4, Math.sin(a) * 1.2], r: [0, -a, 0], color: [shadeHex(leaf, -0.25), leaf] }); }
    return b.build();
  },
  palm(r, o) {
    const b = new Builder(r() * 1e6);
    const segs = 6, lean = 0.12 + r() * 0.12;
    let x = 0, y = 0;
    for (let i = 0; i < segs; i++) {
      b.add(cyl(0.13 - i * 0.008, 0.16 - i * 0.008, 0.6, 6), { p: [x, y + 0.3, 0], r: [0, 0, -lean * (i / segs) * 1.5], color: i % 2 ? 0x8a6a3a : 0x7a5a30 });
      x += Math.sin(lean * (i / segs) * 1.5) * 0.6; y += 0.58;
    }
    const leaf = o.leaf ?? 0x4a9a3a;
    for (let i = 0; i < 7; i++) {
      const a = i / 7 * Math.PI * 2 + r() * 0.3;
      b.add(taper(0.5, 0.04, 0.08, 0.02, 1.8), { p: [x + Math.cos(a) * 0.85, y - 0.15, Math.sin(a) * 0.85], r: [Math.PI / 2 + 0.5, -a + Math.PI / 2, 0], order: 'YXZ', color: [shadeHex(leaf, -0.2), shadeHex(leaf, 0.1)] });
    }
    b.add(sphere(0.18, 5, 4), { p: [x, y - 0.1, 0], color: 0x6a4a2a });
    return b.build();
  },
  dead(r, o) {
    const b = new Builder(r() * 1e6);
    const h = 1.8 + r() * 1.2;
    const c = o.trunk ?? 0x4a3a30;
    b.add(cyl(0.1, 0.22, h, 5), { p: [0, h / 2, 0], r: [0, 0, (r() - 0.5) * 0.2], color: c });
    for (let i = 0; i < 4; i++) {
      const a = r() * Math.PI * 2, y = h * (0.45 + r() * 0.45);
      b.add(cyl(0.03, 0.07, 0.9 + r() * 0.5, 4), { p: [Math.cos(a) * 0.35, y, Math.sin(a) * 0.35], r: [Math.sin(a) * 0.9, 0, -Math.cos(a) * 0.9], color: c });
    }
    return b.build();
  },
  bigshroom(r, o) {
    const b = new Builder(r() * 1e6);
    const h = 1.6 + r() * 1.4;
    const cap = o.cap ?? 0xa83a6a;
    b.add(cyl(0.18, 0.3, h, 6), { p: [0, h / 2, 0], color: [0xb8b0a0, 0xe8e0d0] });
    b.add(sphere(1.2, 8, 4), { p: [0, h, 0], s: [1, 0.5, 1], color: [shadeHex(cap, -0.3), cap] });
    for (let i = 0; i < 5; i++) { const a = r() * Math.PI * 2; b.add(sphere(0.12, 4, 3), { p: [Math.cos(a) * 0.7, h + 0.4, Math.sin(a) * 0.7], color: o.spots ?? 0xf0e8f8, shade: 0 }); }
    return b.build();
  },
  crystal(r, o) {
    const b = new Builder(r() * 1e6);
    const c = o.crystal ?? 0x6ad0ff;
    const n = 3 + Math.floor(r() * 3);
    for (let i = 0; i < n; i++) {
      const hh = 0.8 + r() * 1.6, a = r() * Math.PI * 2;
      b.add(octa(0.35), { p: [Math.cos(a) * 0.3 * (i > 0), hh * 0.45, Math.sin(a) * 0.3 * (i > 0)], s: [0.6, hh * 1.5, 0.6], r: [(r() - 0.5) * 0.6, r() * 3, (r() - 0.5) * 0.6], color: [shadeHex(c, -0.2), shadeHex(c, 0.35)], shade: 0.12 });
    }
    return b.build();
  },
  cactus(r, o) {
    const b = new Builder(r() * 1e6);
    const h = 1.4 + r() * 1.2, c = o.cactus ?? 0x5a8a3a;
    b.add(cyl(0.22, 0.25, h, 7), { p: [0, h / 2, 0], color: [shadeHex(c, -0.15), c] });
    b.add(sphere(0.22, 7, 4), { p: [0, h, 0], s: [1, 0.6, 1], color: c });
    for (const s of [1, -1]) if (r() > 0.3) {
      const y = h * (0.35 + r() * 0.3), l = 0.5 + r() * 0.5;
      b.add(cyl(0.13, 0.13, 0.4, 6), { p: [0.3 * s, y, 0], r: [0, 0, Math.PI / 2], color: c });
      b.add(cyl(0.13, 0.13, l, 6), { p: [0.48 * s, y + l / 2, 0], color: c });
      b.add(sphere(0.13, 6, 3), { p: [0.48 * s, y + l, 0], s: [1, 0.6, 1], color: c });
    }
    if (r() > 0.6) b.add(sphere(0.1, 5, 3), { p: [0, h + 0.12, 0], color: 0xf06a8a, shade: 0 });
    return b.build();
  },
  rock(r, o) {
    const b = new Builder(r() * 1e6);
    const c = o.rock ?? 0x8a8a84;
    b.add(jitter(dodeca(0.8), 0.3, r() * 1e5), { p: [0, 0.3, 0], s: [1 + r() * 0.5, 0.6 + r() * 0.4, 1 + r() * 0.4], color: [shadeHex(c, -0.2), shadeHex(c, 0.1)], shade: 0.08 });
    if (r() > 0.5) b.add(jitter(dodeca(0.4), 0.15, r() * 1e5), { p: [0.7, 0.15, 0.3], color: c, shade: 0.08 });
    if (o.moss) b.add(jitter(ico(0.55, 0), 0.1, r() * 1e5), { p: [0, 0.62, 0], s: [1.2, 0.25, 1.1], color: o.moss });
    return b.build();
  },
  boulder(r, o) {
    const b = new Builder(r() * 1e6);
    const c = o.rock ?? 0x8a8a84;
    b.add(jitter(ico(1.6, 1), 0.45, r() * 1e5), { p: [0, 0.9, 0], s: [1.2, 0.9, 1], color: [shadeHex(c, -0.25), shadeHex(c, 0.1)], shade: 0.1 });
    if (o.snow) b.add(jitter(ico(1.3, 0), 0.2, r() * 1e5), { p: [0, 1.95, 0], s: [1.1, 0.3, 0.9], color: 0xf2f6fa });
    return b.build();
  },
  spire(r, o) {
    const b = new Builder(r() * 1e6);
    const c = o.rock ?? 0x5a4a44;
    const h = 3 + r() * 4;
    b.add(jitter(cone(1.1, h, 6), 0.3, r() * 1e5), { p: [0, h / 2, 0], color: [shadeHex(c, -0.2), shadeHex(c, 0.12)], shade: 0.1 });
    if (o.glow) b.add(octa(0.25), { p: [0.4, h * 0.4, 0.5], s: [1, 2, 1], color: o.glow, shade: 0 });
    return b.build();
  },
  bush(r, o) {
    const b = new Builder(r() * 1e6);
    const c = o.bush ?? o.leaf ?? 0x4a8a3a;
    const n = 2 + Math.floor(r() * 3);
    for (let i = 0; i < n; i++) b.add(jitter(ico(0.45 + r() * 0.2, 0), 0.15, r() * 1e5), { p: [(r() - 0.5) * 0.7, 0.35, (r() - 0.5) * 0.7], s: [1, 0.8, 1], color: [shadeHex(c, -0.25), shadeHex(c, 0.08)] });
    if (o.berries) for (let i = 0; i < 5; i++) b.add(ico(0.06, 0), { p: [(r() - 0.5) * 0.8, 0.45 + r() * 0.3, (r() - 0.5) * 0.8], color: o.berries, shade: 0 });
    return b.build();
  },
  grass(r, o) {
    const b = new Builder(r() * 1e6);
    const c = o.grass ?? 0x6aa84f;
    for (let i = 0; i < 5; i++) b.add(cone(0.07, 0.35 + r() * 0.3, 3), { p: [(r() - 0.5) * 0.4, 0.2, (r() - 0.5) * 0.4], r: [(r() - 0.5) * 0.5, r() * 3, (r() - 0.5) * 0.5], color: [shadeHex(c, -0.2), shadeHex(c, 0.2)], shade: 0.1 });
    return b.build();
  },
  flowers(r, o) {
    const b = new Builder(r() * 1e6);
    const cols = o.flowers ?? [0xf0d040, 0xf06a8a, 0xffffff, 0x9a6af0];
    const c = cols[Math.floor(r() * cols.length)];
    for (let i = 0; i < 4; i++) {
      const x = (r() - 0.5) * 0.6, z = (r() - 0.5) * 0.6, h = 0.25 + r() * 0.2;
      b.add(cyl(0.012, 0.012, h, 3), { p: [x, h / 2, z], color: 0x4a8a3a });
      b.add(octa(0.07), { p: [x, h, z], s: [1, 0.5, 1], color: c, shade: 0.05 });
    }
    return b.build();
  },
  reeds(r, o) {
    const b = new Builder(r() * 1e6);
    for (let i = 0; i < 6; i++) {
      const x = (r() - 0.5) * 0.5, z = (r() - 0.5) * 0.5, h = 0.8 + r() * 0.6;
      b.add(cyl(0.02, 0.025, h, 3), { p: [x, h / 2, z], r: [(r() - 0.5) * 0.2, 0, (r() - 0.5) * 0.2], color: 0x6a8a3a });
      if (r() > 0.5) b.add(cyl(0.04, 0.04, 0.2, 4), { p: [x, h, z], color: 0x6a4a2a });
    }
    return b.build();
  },
  stump(r, o) {
    const b = new Builder(r() * 1e6);
    b.add(cyl(0.35, 0.42, 0.45, 7), { p: [0, 0.22, 0], color: o.trunk ?? 0x6a4a2e });
    b.add(cyl(0.3, 0.3, 0.02, 7), { p: [0, 0.455, 0], color: 0xc8a878 });
    return b.build();
  },
  log(r, o) {
    const b = new Builder(r() * 1e6);
    b.add(cyl(0.25, 0.28, 2.4, 7), { p: [0, 0.25, 0], r: [0, 0, Math.PI / 2], color: o.trunk ?? 0x6a4a2e });
    if (o.moss) b.add(box(1.6, 0.06, 0.3), { p: [0, 0.5, 0], color: o.moss });
    return b.build();
  },
  bones(r, o) {
    const b = new Builder(r() * 1e6);
    b.add(cyl(0.05, 0.05, 1.2, 4), { p: [0, 0.05, 0], r: [0, 0, Math.PI / 2], color: 0xe8e0c8 });
    for (let i = 0; i < 5; i++) b.add(torus(0.35, 0.04, 3, 6, Math.PI), { p: [-0.4 + i * 0.2, 0.05, 0], r: [0, Math.PI / 2, 0], color: 0xe0d8c0 });
    b.add(sphere(0.18, 6, 4), { p: [0.75, 0.15, 0], color: 0xe8e0c8 });
    return b.build();
  },
  icespike(r, o) {
    const b = new Builder(r() * 1e6);
    for (let i = 0; i < 4; i++) { const h = 1 + r() * 2.2; b.add(cone(0.3 + r() * 0.2, h, 5), { p: [(r() - 0.5) * 1.1, h / 2, (r() - 0.5) * 1.1], r: [(r() - 0.5) * 0.4, 0, (r() - 0.5) * 0.4], color: [0x8ac8e8, 0xe8f8ff], shade: 0.1 }); }
    return b.build();
  },
  snowpile(r, o) {
    const b = new Builder(r() * 1e6);
    b.add(jitter(ico(0.9, 0), 0.2, r() * 1e5), { p: [0, 0.1, 0], s: [1.3, 0.45, 1.1], color: 0xf0f4fa });
    return b.build();
  },
  lavarock(r, o) {
    const b = new Builder(r() * 1e6);
    b.add(jitter(dodeca(0.9), 0.3, r() * 1e5), { p: [0, 0.35, 0], s: [1.2, 0.7, 1], color: [0x1a1414, 0x3a2a26] });
    for (let i = 0; i < 3; i++) b.add(box(0.8, 0.05, 0.08), { p: [(r() - 0.5) * 0.6, 0.6 + r() * 0.2, (r() - 0.5) * 0.6], r: [0, r() * 3, 0.3], color: 0xff6a1a, shade: 0 });
    return b.build();
  },
  shadowtree(r, o) {
    const b = new Builder(r() * 1e6);
    const h = 2.5 + r() * 1.5;
    b.add(cyl(0.12, 0.3, h, 5), { p: [0, h / 2, 0], r: [0, 0, (r() - 0.5) * 0.25], color: 0x2a2030 });
    for (let i = 0; i < 5; i++) {
      const a = r() * Math.PI * 2;
      b.add(cyl(0.02, 0.08, 1.4, 4), { p: [Math.cos(a) * 0.5, h * 0.8 + r() * 0.5, Math.sin(a) * 0.5], r: [Math.sin(a) * 1.1, 0, -Math.cos(a) * 1.1], color: 0x2a2030 });
    }
    b.add(jitter(ico(0.9, 0), 0.3, r() * 1e5), { p: [0, h + 0.3, 0], s: [1.2, 0.7, 1.2], color: o.leaf ?? 0x5a2a7a });
    return b.build();
  },
  fern(r, o) {
    const b = new Builder(r() * 1e6);
    const c = o.leaf ?? 0x3a8a3a;
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; b.add(taper(0.18, 0.02, 0.04, 0.01, 0.8), { p: [Math.cos(a) * 0.3, 0.25, Math.sin(a) * 0.3], r: [Math.PI / 2 - 0.6, -a + Math.PI / 2, 0], order: 'YXZ', color: [shadeHex(c, -0.2), shadeHex(c, 0.15)] }); }
    return b.build();
  },
  ruinpillar(r, o) {
    const b = new Builder(r() * 1e6);
    const h = 1.5 + r() * 2.5, c = o.stone ?? 0xb8b0a0;
    b.add(box(0.9, 0.3, 0.9), { p: [0, 0.15, 0], color: shadeHex(c, -0.1) });
    b.add(cyl(0.32, 0.34, h, 8), { p: [0, 0.3 + h / 2, 0], color: [shadeHex(c, -0.15), c] });
    if (r() > 0.5) b.add(box(0.85, 0.25, 0.85), { p: [0, 0.3 + h + 0.12, 0], r: [0, 0.3, 0.05], color: c });
    return b.build();
  },
  coral(r, o) {
    const b = new Builder(r() * 1e6);
    for (let i = 0; i < 5; i++) b.add(cyl(0.05, 0.1, 0.6 + r() * 0.6, 4), { p: [(r() - 0.5) * 0.6, 0.4, (r() - 0.5) * 0.6], r: [(r() - 0.5) * 0.8, 0, (r() - 0.5) * 0.8], color: o.coral ?? 0xf07a6a });
    return b.build();
  },
};

// Which props sway in the wind and which are colliders
const SWAY = { oak: 0.025, pine: 0.02, birch: 0.03, willow: 0.03, palm: 0.035, bush: 0.06, grass: 0.12, flowers: 0.12, reeds: 0.1, fern: 0.08, shadowtree: 0.02, bigshroom: 0.01 };
export const COLLIDE = { grave: 0.45, oak: 0.45, pine: 0.4, birch: 0.3, willow: 0.5, palm: 0.35, dead: 0.3, bigshroom: 0.45, crystal: 0.6, cactus: 0.35, rock: 0.75, boulder: 1.8, spire: 1.0, stump: 0.4, log: 0.6, icespike: 0.8, lavarock: 0.8, shadowtree: 0.35, ruinpillar: 0.55 };
const NO_SHADOW = new Set(['grass', 'flowers', 'reeds', 'fern', 'snowpile', 'bones', 'coral', 'rock', 'bush', 'stump', 'log', 'grave', 'lavarock']);

/**
 * Build instanced prop meshes.
 * list: [{type, x, y, z, rot, s, tint?}], opts: palette for builders
 * Returns THREE.Group with chunked InstancedMeshes.
 */
export function buildPropField(list, opts, zoneSize, seed = 1, chunks = 4) {
  const group = new THREE.Group(); group.name = 'props';
  const variants = {}; const VAR = 3;
  const r = rng(seed);
  const half = zoneSize / 2, cs = zoneSize / chunks;
  const buckets = new Map();
  for (const p of list) {
    if (!variants[p.type]) {
      variants[p.type] = gltfVariants(p.type, opts);
      if (!variants[p.type]) { variants[p.type] = []; for (let v = 0; v < VAR; v++) variants[p.type].push(PROP_BUILDERS[p.type](rng(seed * 31 + v * 7 + p.type.length * 101), opts)); }
    }
    const nv = variants[p.type].length;
    const v = p.v != null ? p.v % nv : Math.floor(r() * nv);
    const cx = Math.min(chunks - 1, Math.max(0, Math.floor((p.x + half) / cs))), cz = Math.min(chunks - 1, Math.max(0, Math.floor((p.z + half) / cs)));
    const key = p.type + '|' + v + '|' + cx + '|' + cz;
    if (!buckets.has(key)) buckets.set(key, { type: p.type, v, items: [] });
    buckets.get(key).items.push(p);
  }
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sv = new THREE.Vector3(), pv = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0), col = new THREE.Color();
  for (const [, bk] of buckets) {
    const geo = variants[bk.type][bk.v];
    const sway = SWAY[bk.type];
    const mat = sway ? foliage(sway, 'fol' + sway) : lambert('props');
    const im = new THREE.InstancedMesh(geo, mat, bk.items.length);
    bk.items.forEach((p, i) => {
      q.setFromAxisAngle(up, p.rot ?? 0);
      if (p.tilt) q.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(p.tilt[0], 0, p.tilt[1])));
      sv.setScalar(p.s ?? 1); pv.set(p.x, p.y, p.z);
      m4.compose(pv, q, sv); im.setMatrixAt(i, m4);
      col.setHex(p.tint ?? 0xffffff); im.setColorAt(i, col);
    });
    im.instanceMatrix.needsUpdate = true;
    if (im.instanceColor) im.instanceColor.needsUpdate = true;
    im.computeBoundingSphere();
    im.castShadow = !NO_SHADOW.has(bk.type); im.userData.cast = im.castShadow;
    im.receiveShadow = true;
    im.userData.small = NO_SHADOW.has(bk.type);
    group.add(im);
  }
  return group;
}

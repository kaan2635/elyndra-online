// Procedural low-poly skinned models. Every character/monster is ONE SkinnedMesh
// (one draw call) whose parts are rigidly bound to a handful of bones.
import * as THREE from 'three';
import { Builder, box, cyl, cone, ico, sphere, taper, octa, torus, tetra, dodeca, extrudeShape, jitter } from './geom.js';
import { charMaterial } from './materials.js';
import { shadeHex, mixHex, rng, hashStr } from '../core/util.js';

// ---------------------------------------------------------------- rigs
export const HB = { root: 0, hips: 1, chest: 2, head: 3, uArmL: 4, lArmL: 5, uArmR: 6, lArmR: 7, thighL: 8, shinL: 9, thighR: 10, shinR: 11, handR: 12, handL: 13, cape: 14, tail: 15, wingL: 16, wingR: 17 };
export const QB = { root: 0, body: 1, head: 2, legFL: 3, legFR: 4, legBL: 5, legBR: 6, tail: 7, jaw: 8, neck: 9 };
export const SB = { root: 0, body: 1, head: 2, abdomen: 3, l0: 4, tail: 12, clawL: 13, clawR: 14 }; // legs 4..11
export const BB = { root: 0, body: 1 };
export const FB = { root: 0, core: 1, armL: 2, armR: 3, head: 4, wingL: 5, wingR: 6 };
export const DB = { root: 0, body: 1, neck: 2, head: 3, jaw: 4, wingL: 5, wingR: 6, tail1: 7, tail2: 8, legFL: 9, legFR: 10, legBL: 11, legBR: 12 };
export const WB = { root: 0, s1: 1, s2: 2, s3: 3, s4: 4, s5: 5, head: 6, jaw: 7 };

function makeSkeleton(defs) {
  const bones = []; const world = [];
  defs.forEach((d, i) => {
    const b = new THREE.Bone(); b.name = d.n;
    const pw = d.p; world[i] = pw;
    if (d.parent != null && d.parent >= 0) {
      const pp = world[d.parent];
      b.position.set(pw[0] - pp[0], pw[1] - pp[1], pw[2] - pp[2]);
      bones[d.parent].add(b);
    } else b.position.set(pw[0], pw[1], pw[2]);
    bones.push(b);
  });
  return { bones, world };
}

function finish(builder, skel, opts = {}) {
  const geo = builder.build(true);
  const mat = charMaterial();
  const mesh = new THREE.SkinnedMesh(geo, mat);
  mesh.add(skel.bones[0]);
  mesh.bind(new THREE.Skeleton(skel.bones));
  mesh.castShadow = true; mesh.receiveShadow = false;
  // pad bounding sphere for animated poses
  geo.boundingSphere.radius *= 1.6;
  mesh.frustumCulled = true;
  const rest = skel.bones.map(b => ({ p: b.position.clone(), q: b.quaternion.clone() }));
  return { mesh, bones: skel.bones, rest, ...opts };
}

// ---------------------------------------------------------------- palettes
export const SKIN = [0xf3d0b0, 0xe6b48e, 0xc98e66, 0xa36a45, 0x7a4a2e, 0x55331f];
export const SKIN_ORC = [0x7aa05a, 0x5f8a48, 0x8a9a5a, 0x6a7a4a, 0x9a7a5a, 0x5a6a7a];
export const SKIN_ELF = [0xf6dcc4, 0xeac3a3, 0xd0a888, 0xb8c8e0, 0xa894c8, 0x8a6a58];
export const HAIR = [0x2a1d14, 0x5a3a22, 0x8a5a2a, 0xc89a4a, 0xe8d8a8, 0x9a2a1a, 0xd0d0d8, 0x1a1a24, 0x3a5aa8, 0x7a3aa8, 0x2a8a6a, 0xe86a9a];
export const EYES = [0x2a5aa8, 0x3a8a3a, 0x6a4a2a, 0x8a8a9a, 0xc8a02a, 0xa82a2a];

const RACE = {
  human: { h: 1.0, w: 1.0, leg: 1.0, head: 1.0, ears: 0, tusks: 0 },
  elf: { h: 1.06, w: 0.9, leg: 1.08, head: 0.96, ears: 1, tusks: 0 },
  dwarf: { h: 0.78, w: 1.22, leg: 0.72, head: 1.12, ears: 0, tusks: 0 },
  orc: { h: 1.1, w: 1.22, leg: 1.0, head: 1.05, ears: 2, tusks: 1 },
  goblin: { h: 0.62, w: 0.85, leg: 0.8, head: 1.45, ears: 3, tusks: 0 },
  skeleton: { h: 1.0, w: 0.75, leg: 1.0, head: 1.0, ears: 0, tusks: 0, thin: 0.6 },
  giant: { h: 1.6, w: 1.5, leg: 1.0, head: 0.9, ears: 0, tusks: 0 },
  imp: { h: 0.6, w: 0.8, leg: 0.8, head: 1.4, ears: 3, tusks: 0 },
};

// ---------------------------------------------------------------- humanoid
/**
 * spec: {race, body(0 male,1 female), skin, hair, hairColor, beard, eyes, scale,
 *        gear:{head,shoulders,chest,hands,legs,feet,cape,main,off}, feat:{horns,tail,wings,glowEyes,hood,crown,noLegs,bigArms,fur,bark,rock,wrap,flame}}
 */
export function buildHumanoid(spec = {}) {
  const R = RACE[spec.race] || RACE.human;
  const fem = spec.body === 1;
  const S = (spec.scale || 1) * R.h * (fem ? 0.96 : 1);
  const W = R.w * (fem ? 0.88 : 1) * (spec.feat?.bulk || 1);
  const thin = R.thin || 1;
  const gear = spec.gear || {};
  const f = spec.feat || {};
  const skin = spec.skin ?? SKIN[1];
  const r = rng(hashStr(JSON.stringify(spec).slice(0, 200)) + 5);

  // proportions (model space, before overall scale S applied via root scale)
  const legLen = 0.86 * R.leg;
  const hipY = legLen + 0.08;
  const torsoH = 0.58;
  const shY = hipY + torsoH - 0.07;
  const shX = 0.25 * W;
  const armU = 0.3, armL = 0.3;
  const headS = 0.3 * R.head;
  const neckY = hipY + torsoH;
  const hipX = 0.1 * W;

  const defs = [
    { n: 'root', p: [0, 0, 0] },
    { n: 'hips', p: [0, hipY, 0], parent: 0 },
    { n: 'chest', p: [0, hipY + 0.12, 0], parent: 1 },
    { n: 'head', p: [0, neckY + 0.02, 0], parent: 2 },
    { n: 'uArmL', p: [shX, shY, 0], parent: 2 },
    { n: 'lArmL', p: [shX, shY - armU, 0], parent: 4 },
    { n: 'uArmR', p: [-shX, shY, 0], parent: 2 },
    { n: 'lArmR', p: [-shX, shY - armU, 0], parent: 6 },
    { n: 'thighL', p: [hipX, hipY, 0], parent: 1 },
    { n: 'shinL', p: [hipX, hipY - legLen / 2, 0], parent: 8 },
    { n: 'thighR', p: [-hipX, hipY, 0], parent: 1 },
    { n: 'shinR', p: [-hipX, hipY - legLen / 2, 0], parent: 10 },
    { n: 'handR', p: [-shX, shY - armU - armL - 0.04, 0.02], parent: 7 },
    { n: 'handL', p: [shX, shY - armU - armL - 0.04, 0.02], parent: 5 },
    { n: 'cape', p: [0, shY + 0.02, -0.15 * W], parent: 2 },
    { n: 'tail', p: [0, hipY - 0.02, -0.12], parent: 1 },
    { n: 'wingL', p: [0.1, shY - 0.05, -0.14], parent: 2 },
    { n: 'wingR', p: [-0.1, shY - 0.05, -0.14], parent: 2 },
  ];
  const skel = makeSkeleton(defs);
  const B = new Builder(hashStr(spec.race || 'h') + 3);
  const add = (g, o) => B.add(g, o);

  const chest = gear.chest || {};
  const legs = gear.legs || {};
  const shirt = chest.c ?? spec.shirt ?? 0x8a7a5a;
  const shirt2 = chest.c2 ?? shadeHex(shirt, -0.25);
  const pants = legs.c ?? spec.pants ?? 0x5a4a3a;
  const boots = gear.feet?.c ?? 0x4a3424;
  const gloves = gear.hands?.c;
  const cm = chest.m || 'cloth';

  // ---- legs
  if (!f.noLegs) {
    for (const side of [1, -1]) {
      const tb = side > 0 ? 8 : 10, sb = side > 0 ? 9 : 11;
      const x = hipX * side;
      const lw = 0.15 * W * thin;
      add(taper(lw * 1.1, lw * 1.05, lw * 0.85, lw * 0.85, legLen / 2), { p: [x, hipY - legLen / 4, 0], color: pants, bone: tb });
      add(taper(lw * 0.85, lw * 0.85, lw * 0.8, lw * 0.8, legLen / 2 - 0.06), { p: [x, hipY - legLen * 0.75 + 0.03, 0], color: f.bones ? skin : pants, bone: sb });
      // boots
      add(box(lw * 0.95, 0.2, lw * 1.0), { p: [x, 0.16, 0.0], color: boots, bone: sb });
      add(box(lw * 0.95, 0.09, lw * 1.6), { p: [x, 0.045, 0.05], color: shadeHex(boots, -0.1), bone: sb });
      if (legs.m === 'plate') add(box(lw * 1.05, 0.09, 0.06), { p: [x, hipY - legLen / 2, lw * 0.5], color: shadeHex(pants, 0.25), bone: sb });
    }
  } else {
    // floating spirit tail instead of legs
    const c = f.flame ?? shirt;
    add(cone(0.22 * W, 0.9, 7), { p: [0, hipY - 0.35, 0], r: [Math.PI, 0, 0], color: [shadeHex(c, -0.3), c], bone: 1 });
  }

  // ---- torso
  const tw = 0.42 * W * thin, td = 0.24 * W;
  if (fem) {
    add(taper(tw * 0.92, td, tw * 0.75, td * 0.95, 0.22), { p: [0, hipY + 0.06, 0], color: pants, bone: 1 }); // hips/pelvis
    add(taper(tw * 0.72, td * 0.95, tw * 0.95, td * 1.05, torsoH - 0.12), { p: [0, hipY + 0.12 + (torsoH - 0.12) / 2, 0], color: shirt, bone: 2 });
    add(box(tw * 0.62, 0.11, 0.1), { p: [0, shY - 0.13, td * 0.5], color: shadeHex(shirt, 0.04), bone: 2 });
  } else {
    add(taper(tw * 0.85, td, tw * 0.8, td * 0.95, 0.22), { p: [0, hipY + 0.06, 0], color: pants, bone: 1 });
    add(taper(tw * 0.8, td * 0.95, tw * (f.bigArms ? 1.25 : 1.05), td * 1.1, torsoH - 0.12), { p: [0, hipY + 0.12 + (torsoH - 0.12) / 2, 0], color: shirt, bone: 2 });
  }
  // belt
  add(box(tw * 0.88, 0.07, td * 1.08), { p: [0, hipY + 0.14, 0], color: chest.belt ?? 0x3a2a1a, bone: 1 });
  add(box(0.07, 0.06, 0.03), { p: [0, hipY + 0.14, td * 0.56], color: 0xd8b04a, bone: 1 });
  // chest armour variants
  if (cm === 'plate') {
    add(taper(tw * 0.9, td * 0.5, tw * 1.05, td * 0.55, 0.32), { p: [0, shY - 0.17, td * 0.3], color: [shadeHex(shirt, -0.1), shadeHex(shirt, 0.15)], bone: 2 });
    add(box(0.05, 0.3, 0.02), { p: [0, shY - 0.18, td * 0.6], color: shirt2, bone: 2 });
    add(box(tw * 0.95, 0.08, td * 1.12), { p: [0, hipY + 0.24, 0], color: shirt2, bone: 2 });
  } else if (cm === 'mail') {
    for (let i = 0; i < 3; i++) add(box(tw * 0.98, 0.04, td * 1.12), { p: [0, hipY + 0.24 + i * 0.12, 0], color: shirt2, bone: 2, shade: 0.02 });
  } else if (cm === 'leather') {
    add(box(0.05, torsoH - 0.12, td * 1.14), { p: [0.06, hipY + 0.12 + (torsoH - 0.12) / 2, 0], r: [0, 0, 0.5], color: shirt2, bone: 2 });
    add(box(tw * 0.7, 0.05, td * 1.12), { p: [0, shY - 0.05, 0], color: shirt2, bone: 2 });
  } else if (cm === 'robe') {
    // long skirt hanging from the waist (bound to hips so legs stride under it)
    add(taper(tw * 1.25, td * 1.5, tw * 0.9, td * 1.1, legLen * 0.8), { p: [0, hipY - legLen * 0.35, 0], color: [shadeHex(shirt, -0.12), shirt], bone: 1 });
    add(box(0.06, legLen * 0.75, 0.02), { p: [0, hipY - legLen * 0.35, td * 0.72], color: shirt2, bone: 1 });
    add(box(tw * 0.5, 0.05, td * 1.12), { p: [0, shY - 0.02, 0], color: shirt2, bone: 2 });
  }
  if (f.fur) for (let i = 0; i < 6; i++) add(tetra(0.1), { p: [(r() - 0.5) * tw, hipY + 0.2 + r() * 0.4, -td * 0.5], s: [1, 1.6, 1], color: f.fur, bone: 2 });
  if (f.wrap) for (let i = 0; i < 5; i++) add(box(tw * 1.02, 0.035, td * 1.12), { p: [0, hipY + 0.15 + i * 0.1, 0], r: [0, 0, (r() - 0.5) * 0.3], color: f.wrap, bone: 2 });
  if (f.rock) for (let i = 0; i < 5; i++) add(dodeca(0.09 + r() * 0.06), { p: [(r() - 0.5) * tw, hipY + 0.2 + r() * 0.35, (r() > 0.5 ? 1 : -1) * td * 0.5], color: f.rock, bone: 2 });
  if (f.core) add(octa(0.09), { p: [0, shY - 0.18, td * 0.58], color: f.core, bone: 2, shade: 0 });
  if (f.bark) for (let i = 0; i < 4; i++) add(box(0.05, 0.3, 0.05), { p: [(r() - 0.5) * tw, hipY + 0.3, td * 0.55], r: [0, 0, (r() - 0.5) * 0.4], color: f.bark, bone: 2 });
  if (f.ribs) for (let i = 0; i < 3; i++) add(box(tw * 0.9, 0.03, td * 1.05), { p: [0, hipY + 0.3 + i * 0.08, 0], color: shadeHex(skin, -0.15), bone: 2 });

  // ---- arms
  const aw = 0.12 * W * thin * (f.bigArms ? 1.5 : 1);
  for (const side of [1, -1]) {
    const ub = side > 0 ? 4 : 6, lb = side > 0 ? 5 : 7;
    const x = shX * side;
    const sleeve = cm === 'plate' || cm === 'mail' ? shadeHex(shirt, -0.05) : shirt;
    add(taper(aw, aw, aw * 1.05, aw * 1.05, armU), { p: [x, shY - armU / 2, 0], color: f.bones ? skin : sleeve, bone: ub });
    const forearmCol = gloves ?? (cm === 'robe' || cm === 'cloth' ? sleeve : skin);
    add(taper(aw * 0.85, aw * 0.85, aw * 0.95, aw * 0.95, armL), { p: [x, shY - armU - armL / 2, 0], color: f.bones ? skin : forearmCol, bone: lb });
    if (gloves != null) add(box(aw * 1.15, 0.08, aw * 1.15), { p: [x, shY - armU - 0.05, 0], color: shadeHex(gloves, 0.12), bone: lb });
    // hand
    add(box(aw * 0.9, 0.1, aw * 1.0), { p: [x, shY - armU - armL - 0.04, 0.0], color: gloves ?? skin, bone: lb });
    if (f.claws) for (let k = -1; k <= 1; k++) add(cone(0.015, 0.08, 4), { p: [x + k * 0.025, shY - armU - armL - 0.12, 0.02], r: [Math.PI, 0, 0], color: 0xe8e0d0, bone: lb });
  }

  // ---- shoulders
  const sh = gear.shoulders;
  if (sh) {
    for (const side of [1, -1]) {
      const ub = side > 0 ? 4 : 6;
      const x = shX * side + 0.03 * side;
      if (sh.m === 'plate' || sh.m === 'spiked') {
        add(sphere(0.13 * W, 6, 4), { p: [x, shY + 0.02, 0], s: [1.15, 0.75, 1.1], color: [shadeHex(sh.c, -0.15), shadeHex(sh.c, 0.12)], bone: ub });
        add(torus(0.1 * W, 0.025, 4, 8), { p: [x, shY - 0.04, 0], r: [Math.PI / 2, 0, 0], color: sh.c2 ?? 0xd8b04a, bone: ub });
        if (sh.m === 'spiked') add(cone(0.04, 0.16, 5), { p: [x + 0.04 * side, shY + 0.13, 0], r: [0, 0, -0.5 * side], color: sh.c2 ?? 0xd0d0d0, bone: ub });
      } else if (sh.m === 'leather') {
        add(box(0.17 * W, 0.07, 0.2 * W), { p: [x, shY + 0.03, 0], r: [0, 0, -0.35 * side], color: sh.c, bone: ub });
      } else { // cloth mantle
        add(taper(0.17 * W, 0.22 * W, 0.12 * W, 0.18 * W, 0.08), { p: [x - 0.02 * side, shY + 0.02, 0], color: sh.c, bone: ub });
        add(box(0.16 * W, 0.03, 0.2 * W), { p: [x, shY - 0.03, 0], color: sh.c2 ?? 0xd8b04a, bone: ub });
      }
    }
  }

  // ---- head
  const hy = neckY + 0.02 + headS * 0.55;
  const headC = f.skull ? 0xe8e0c8 : skin;
  add(cyl(0.06, 0.07, 0.08, 6), { p: [0, neckY + 0.04, 0], color: shadeHex(headC, -0.1), bone: 3 });
  add(sphere(headS * 0.5, 8, 6), { p: [0, hy, 0.01], s: [0.95, 1.05, 1.0], color: headC, bone: 3, shade: 0.03 });
  // jaw / chin shape
  add(box(headS * 0.62, headS * 0.28, headS * 0.55), { p: [0, hy - headS * 0.28, 0.035], color: shadeHex(headC, -0.03), bone: 3, shade: 0.02 });
  // nose
  if (!f.skull) add(box(0.04, 0.06, 0.05), { p: [0, hy - 0.02, headS * 0.5], color: shadeHex(headC, -0.06), bone: 3 });
  // eyes
  const eyeC = f.glowEyes ?? (f.skull ? 0x111111 : 0x1a1a1a);
  const eyeY = hy + 0.02, eyeZ = headS * 0.47;
  for (const s of [1, -1]) {
    if (f.skull) add(box(0.07, 0.06, 0.03), { p: [0.055 * s, eyeY, eyeZ], color: 0x1a1410, bone: 3 });
    if (!f.skull && !f.glowEyes) add(box(0.06, 0.045, 0.02), { p: [0.055 * s, eyeY, eyeZ - 0.003], color: 0xf8f8f8, bone: 3 });
    add(box(f.glowEyes ? 0.055 : 0.032, f.glowEyes ? 0.035 : 0.042, 0.022), { p: [0.055 * s, eyeY, eyeZ + 0.004], color: f.glowEyes ? eyeC : (spec.eyes ?? 0x2a5aa8), bone: 3, shade: 0 });
    // brows
    if (!f.skull) add(box(0.075, 0.018, 0.02), { p: [0.055 * s, eyeY + 0.045, eyeZ], r: [0, 0, f.angry ? -0.35 * s : -0.08 * s], color: spec.hairColor ?? 0x3a2a1a, bone: 3 });
  }
  if (f.skull) add(box(0.12, 0.03, 0.03), { p: [0, hy - 0.1, eyeZ - 0.01], color: 0x2a2018, bone: 3 });
  // mouth
  if (!f.skull) add(box(0.07, 0.014, 0.01), { p: [0, hy - 0.085, headS * 0.47], color: shadeHex(headC, -0.35), bone: 3 });
  // ears
  const ears = f.ears ?? R.ears;
  for (const s of [1, -1]) {
    if (ears === 1) add(cone(0.035, 0.2, 4), { p: [headS * 0.5 * s, hy + 0.03, -0.02], r: [-0.3, 0, -1.25 * s], color: headC, bone: 3 });
    else if (ears === 2) add(cone(0.04, 0.12, 4), { p: [headS * 0.5 * s, hy + 0.01, 0], r: [0, 0, -1.4 * s], color: headC, bone: 3 });
    else if (ears === 3) add(cone(0.07, 0.3, 4), { p: [headS * 0.55 * s, hy + 0.04, -0.02], r: [-0.2, 0, -1.35 * s], s: [1, 1, 0.5], color: headC, bone: 3 });
    else if (!f.skull) add(box(0.03, 0.07, 0.05), { p: [headS * 0.48 * s, hy, 0], color: shadeHex(headC, -0.05), bone: 3 });
  }
  if (f.tusks ?? R.tusks) for (const s of [1, -1]) add(cone(0.022, 0.09, 4), { p: [0.05 * s, hy - 0.1, headS * 0.42], r: [0.2, 0, 0], color: 0xf0ead0, bone: 3 });
  if (f.horns) for (const s of [1, -1]) {
    add(cone(0.05, 0.25 * (f.hornSize || 1), 5), { p: [0.1 * s, hy + headS * 0.38, -0.02], r: [-0.4, 0, -0.5 * s], color: [f.horns, shadeHex(f.horns, 0.3)], bone: 3 });
  }
  // hair / helm
  const helm = gear.head;
  const hairC = spec.hairColor ?? HAIR[0];
  const hairStyle = spec.hair ?? 0;
  const cap = (sc = 1.08, col = hairC, part = 0.52) => new THREE.SphereGeometry(headS * 0.5 * sc, 8, 5, 0, Math.PI * 2, 0, Math.PI * part).toNonIndexed();
  const showHair = !f.skull && (!helm || helm.m === 'circlet' || helm.m === 'crown');
  if (showHair && hairStyle !== 5) {
    add(cap(1.1), { p: [0, hy + 0.005, -0.012], r: [-0.25, 0, 0], color: hairC, bone: 3 });
    add(box(headS * 0.95, headS * 0.5, 0.06), { p: [0, hy - 0.03, -headS * 0.42], color: hairC, bone: 3 });
    if (hairStyle === 1 || (fem && hairStyle === 0)) add(box(headS * 0.95, 0.42, 0.08), { p: [0, hy - 0.2, -headS * 0.4], color: shadeHex(hairC, -0.05), bone: 3 });
    if (hairStyle === 2) add(cyl(0.05, 0.03, 0.38, 5), { p: [0, hy - 0.12, -headS * 0.62], r: [0.35, 0, 0], color: hairC, bone: 3 });
    if (hairStyle === 3) add(box(0.06, 0.16, headS * 0.85), { p: [0, hy + headS * 0.5, -0.02], color: hairC, bone: 3 });
    if (hairStyle === 4) add(sphere(0.09, 6, 4), { p: [0, hy + headS * 0.42, -headS * 0.3], color: hairC, bone: 3 });
    if (hairStyle === 6) for (let i = 0; i < 6; i++) add(cone(0.05, 0.16, 4), { p: [(i % 3 - 1) * 0.08, hy + headS * 0.42, (i < 3 ? 0.04 : -0.06)], r: [i < 3 ? 0.3 : -0.4, 0, (i % 3 - 1) * -0.5], color: hairC, bone: 3 });
    if (hairStyle === 7) for (const s of [1, -1]) add(cyl(0.035, 0.025, 0.4, 5), { p: [headS * 0.45 * s, hy - 0.2, -0.02], color: hairC, bone: 3 });
    // fringe
    if (hairStyle !== 3) add(box(headS * 0.8, 0.06, 0.06), { p: [0, hy + headS * 0.33, headS * 0.38], r: [0.3, 0, 0], color: hairC, bone: 3 });
  }
  // beard
  const beard = spec.beard ?? 0;
  if (beard && !f.skull) {
    if (beard >= 1) add(box(headS * 0.7, 0.1, 0.1), { p: [0, hy - 0.12, headS * 0.4], color: hairC, bone: 3 });
    if (beard >= 2) add(taper(headS * 0.7, 0.12, 0.08, 0.06, 0.3), { p: [0, hy - 0.3, headS * 0.38], color: hairC, bone: 3 });
    if (beard >= 3) for (let i = 0; i < 2; i++) add(box(0.1, 0.03, 0.1), { p: [0, hy - 0.26 - i * 0.1, headS * 0.42], color: 0xd8b04a, bone: 3 });
  }
  if (helm) buildHelm(add, helm, hy, headS);

  // ---- cape
  if (gear.cape) {
    const cc = gear.cape.c;
    add(box(0.42 * W, 0.04, 0.12), { p: [0, shY + 0.02, -0.13 * W], color: gear.cape.c2 ?? shadeHex(cc, -0.2), bone: 14 });
    add(taper(0.42 * W, 0.03, 0.5 * W, 0.03, hipY * 0.95), { p: [0, shY - hipY * 0.47, -0.17 * W], color: [shadeHex(cc, -0.25), cc], bone: 14 });
  }
  // ---- tail / wings
  if (f.tail) add(cone(0.05, 0.7, 5), { p: [0, hipY - 0.1, -0.45], r: [-1.9, 0, 0], color: f.tail, bone: 15 });
  if (f.wings) for (const s of [1, -1]) {
    const shape = [[0, 0], [0.5, 0.25], [0.75, 0.05], [0.7, -0.25], [0.45, -0.15], [0.3, -0.35], [0.12, -0.18]];
    const wg = extrudeShape(shape.map(([x, y]) => [x * s, y]), 0.02);
    add(wg, { p: [0.1 * s, shY - 0.05, -0.16], s: f.wingSize || 1, r: [0.2, -0.5 * s, 0], color: f.wings, bone: s > 0 ? 16 : 17 });
  }

  // ---- weapons
  if (gear.main) { const lh = gear.main.m === 'bow'; buildWeapon(add, gear.main, skel.world[lh ? 13 : 12], lh ? 13 : 12, false); }
  if (gear.off) buildWeapon(add, gear.off, skel.world[13], 13, true);

  const res = finish(B, skel, { rig: 'humanoid', height: (hy + headS * 0.6) * S, radius: 0.45 * W * S });
  res.mesh.scale.setScalar(S);
  res.scale = S;
  res.weaponKind = gear.main?.m || null;
  res.offKind = gear.off?.m || null;
  res.handR = res.bones[12]; res.handL = res.bones[13];
  return res;
}

function buildHelm(add, h, hy, headS) {
  const c = h.c ?? 0x8a8a90, c2 = h.c2 ?? 0xd8b04a;
  const r0 = headS * 0.5;
  if (h.m === 'helm' || h.m === 'horned') {
    add(new THREE.SphereGeometry(r0 * 1.2, 8, 5, 0, Math.PI * 2, 0, Math.PI * 0.6), { p: [0, hy + 0.0, 0], color: [shadeHex(c, -0.1), shadeHex(c, 0.18)], bone: 3 });
    add(box(r0 * 2.1, 0.18, 0.05), { p: [0, hy - 0.03, r0 * 1.05], color: shadeHex(c, -0.15), bone: 3 });
    add(box(r0 * 1.6, 0.03, 0.06), { p: [0, hy + 0.025, r0 * 1.09], color: 0x111111, bone: 3 });
    add(box(0.04, 0.2, 0.04), { p: [0, hy + r0 * 0.75, r0 * 0.5], color: c2, bone: 3 });
    for (const s of [1, -1]) add(box(0.05, 0.22, r0 * 1.6), { p: [r0 * 1.12 * s, hy - 0.06, 0], color: shadeHex(c, -0.05), bone: 3 });
    if (h.m === 'horned') for (const s of [1, -1]) add(cone(0.05, 0.3, 5), { p: [r0 * 1.15 * s, hy + 0.12, 0], r: [0, 0, -1.0 * s], color: [0xe8e0c8, 0xb8a888], bone: 3 });
  } else if (h.m === 'hood') {
    add(new THREE.SphereGeometry(r0 * 1.25, 8, 5, 0, Math.PI * 2, 0, Math.PI * 0.62), { p: [0, hy - 0.01, -0.03], r: [-0.2, 0, 0], color: c, bone: 3 });
    add(cone(r0 * 0.8, 0.25, 5), { p: [0, hy + 0.05, -r0 * 1.05], r: [-1.8, 0, 0], color: shadeHex(c, -0.1), bone: 3 });
    add(box(r0 * 2.3, 0.3, 0.06), { p: [0, hy - 0.12, -r0 * 0.6], color: shadeHex(c, -0.08), bone: 3 });
  } else if (h.m === 'hat') {
    add(cyl(r0 * 2.0, r0 * 2.0, 0.03, 10), { p: [0, hy + r0 * 0.55, 0], color: c, bone: 3 });
    add(cone(r0 * 1.05, 0.5, 8), { p: [0, hy + r0 * 0.55 + 0.25, -0.03], r: [-0.18, 0, 0.05], color: [c, shadeHex(c, 0.2)], bone: 3 });
    add(cyl(r0 * 1.06, r0 * 1.06, 0.05, 8), { p: [0, hy + r0 * 0.6, 0], color: c2, bone: 3 });
  } else if (h.m === 'cap') {
    add(new THREE.SphereGeometry(r0 * 1.14, 8, 4, 0, Math.PI * 2, 0, Math.PI * 0.5), { p: [0, hy + 0.02, 0], color: c, bone: 3 });
    add(box(r0 * 2.2, 0.03, r0 * 2.2), { p: [0, hy + 0.02, 0], color: shadeHex(c, -0.15), bone: 3 });
  } else if (h.m === 'circlet' || h.m === 'crown') {
    add(torus(r0 * 1.05, 0.02, 4, 10), { p: [0, hy + r0 * 0.35, 0], r: [Math.PI / 2, 0, 0], color: c2, bone: 3 });
    if (h.m === 'crown') for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; add(cone(0.035, 0.12, 4), { p: [Math.sin(a) * r0 * 1.03, hy + r0 * 0.5, Math.cos(a) * r0 * 1.03], color: c2, bone: 3 }); }
    add(octa(0.03), { p: [0, hy + r0 * 0.38, r0 * 1.05], color: h.gem ?? 0x3ad0ff, bone: 3, shade: 0 });
  } else if (h.m === 'mask') {
    add(box(r0 * 1.7, r0 * 0.9, 0.06), { p: [0, hy - 0.06, r0 * 0.95], color: c, bone: 3 });
  } else if (h.m === 'headdress') { // pharaoh
    add(new THREE.SphereGeometry(r0 * 1.2, 8, 5, 0, Math.PI * 2, 0, Math.PI * 0.55), { p: [0, hy, 0], color: c, bone: 3 });
    for (const s of [1, -1]) add(taper(0.16, 0.06, 0.2, 0.06, 0.4), { p: [r0 * 1.05 * s, hy - 0.2, 0], color: [c2, c], bone: 3 });
    add(cone(0.04, 0.12, 4), { p: [0, hy + r0 * 0.9, r0 * 0.8], color: c2, bone: 3 });
  }
}

// weapon geometry in hand-local layout: grip at hand, blade along +Z
export function buildWeapon(add, w, at, bone, off) {
  const [hx, hy, hz] = at;
  const c = w.c ?? 0xc8ccd4, c2 = w.c2 ?? 0x5a3a22, gl = w.glow;
  const P = (x, y, z) => [hx + x, hy + y, hz + z];
  switch (w.m) {
    case 'sword': case 'greatsword': {
      const big = w.m === 'greatsword' ? 1.45 : 1;
      add(cyl(0.025, 0.025, 0.2 * big, 5), { p: P(0, 0, -0.03), r: [Math.PI / 2, 0, 0], color: c2, bone });
      add(sphere(0.035 * big, 5, 4), { p: P(0, 0, -0.14 * big), color: w.c3 ?? 0xd8b04a, bone });
      add(box(0.24 * big, 0.045, 0.05), { p: P(0, 0, 0.08 * big), color: w.c3 ?? 0xd8b04a, bone });
      add(taper(0.075 * big, 0.022, 0.06 * big, 0.018, 0.75 * big), { p: P(0, 0, 0.08 * big + 0.375 * big + 0.02), r: [Math.PI / 2, 0, 0], color: [shadeHex(c, -0.1), shadeHex(c, 0.25)], bone, shade: 0.02 });
      add(cone(0.042 * big, 0.12 * big, 4), { p: P(0, 0, 0.08 * big + 0.75 * big + 0.08), r: [Math.PI / 2, Math.PI / 4, 0], s: [1, 1, 0.35], color: shadeHex(c, 0.25), bone });
      if (gl) add(box(0.012, 0.025, 0.65 * big), { p: P(0, 0, 0.08 * big + 0.4 * big), color: gl, bone, shade: 0 });
      break;
    }
    case 'axe': {
      add(cyl(0.028, 0.028, 0.85, 5), { p: P(0, 0, 0.25), r: [Math.PI / 2, 0, 0], color: c2, bone });
      const blade = extrudeShape([[0, -0.08], [0.26, -0.18], [0.3, 0], [0.26, 0.18], [0, 0.08]], 0.03);
      add(blade, { p: P(0.02, 0, 0.58), r: [0, -Math.PI / 2, Math.PI / 2], color: [shadeHex(c, -0.1), shadeHex(c, 0.2)], bone });
      add(box(0.06, 0.06, 0.1), { p: P(0, 0, 0.6), color: 0x5a5a60, bone });
      if (gl) add(box(0.02, 0.32, 0.03), { p: P(0.0, 0.2, 0.6), color: gl, bone, shade: 0 });
      break;
    }
    case 'mace': case 'hammer': {
      add(cyl(0.028, 0.028, 0.6, 5), { p: P(0, 0, 0.18), r: [Math.PI / 2, 0, 0], color: c2, bone });
      if (w.m === 'mace') {
        add(ico(0.1, 0), { p: P(0, 0, 0.52), color: c, bone });
        for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; add(cone(0.03, 0.09, 4), { p: P(Math.cos(a) * 0.1, Math.sin(a) * 0.1, 0.52), r: [0, 0, a - Math.PI / 2], color: shadeHex(c, 0.2), bone }); }
      } else {
        add(box(0.24, 0.14, 0.14), { p: P(0, 0, 0.5), color: [shadeHex(c, -0.1), shadeHex(c, 0.2)], bone });
        add(box(0.26, 0.04, 0.16), { p: P(0, 0, 0.5), color: w.c3 ?? 0xd8b04a, bone });
      }
      if (gl) add(octa(0.06), { p: P(0, 0, 0.52), color: gl, bone, shade: 0 });
      break;
    }
    case 'dagger': {
      add(cyl(0.022, 0.022, 0.12, 5), { p: P(0, 0, -0.01), r: [Math.PI / 2, 0, 0], color: c2, bone });
      add(box(0.12, 0.03, 0.03), { p: P(0, 0, 0.06), color: w.c3 ?? 0x8a8a90, bone });
      add(taper(0.05, 0.015, 0.02, 0.01, 0.32), { p: P(0, 0, 0.23), r: [Math.PI / 2, 0, 0], color: [shadeHex(c, -0.1), shadeHex(c, 0.3)], bone });
      if (gl) add(box(0.01, 0.02, 0.25), { p: P(0, 0, 0.22), color: gl, bone, shade: 0 });
      break;
    }
    case 'staff': {
      add(cyl(0.03, 0.035, 1.75, 6), { p: P(0, 0.22, 0.04), color: [shadeHex(c2, -0.15), c2], bone });
      add(torus(0.08, 0.02, 4, 8), { p: P(0, 1.08, 0.04), color: w.c3 ?? 0xd8b04a, bone });
      add(octa(0.09), { p: P(0, 1.12, 0.04), s: [1, 1.5, 1], color: gl ?? c, bone, shade: 0 });
      for (let i = 0; i < 3; i++) { const a = i / 3 * Math.PI * 2; add(cone(0.02, 0.18, 4), { p: P(Math.cos(a) * 0.08, 1.04, 0.04 + Math.sin(a) * 0.08), r: [Math.sin(a) * 0.4, 0, -Math.cos(a) * 0.4], color: c2, bone }); }
      break;
    }
    case 'wand': {
      add(cyl(0.018, 0.024, 0.38, 5), { p: P(0, 0, 0.12), r: [Math.PI / 2, 0, 0], color: c2, bone });
      add(octa(0.05), { p: P(0, 0, 0.34), s: [1, 1, 1.4], color: gl ?? c, bone, shade: 0 });
      break;
    }
    case 'bow': {
      // vertical arc in left hand; belly bulges forward
      const pts = 7; let prev = null;
      for (let i = 0; i <= pts; i++) {
        const a = -1 + 2 * i / pts;
        const y = a * 0.62, z = 0.16 * (1 - a * a) + 0.02;
        if (prev) {
          const mx = (prev[0] + y) / 2, mz = (prev[1] + z) / 2;
          const len = Math.hypot(y - prev[0], z - prev[1]);
          const ang = Math.atan2(z - prev[1], y - prev[0]);
          add(box(0.04, len + 0.02, 0.04 * (1.4 - Math.abs(a))), { p: P(0, mx, mz), r: [ang, 0, 0], color: i === pts / 2 + 0.5 ? c2 : c, bone });
        }
        prev = [y, z];
      }
      add(box(0.06, 0.12, 0.06), { p: P(0, 0, 0.16), color: c2, bone });
      add(box(0.006, 1.24, 0.006), { p: P(0, 0, 0.0), color: 0xe8e0d0, bone });
      if (gl) add(box(0.02, 0.5, 0.02), { p: P(0, 0.3, 0.13), r: [0.3, 0, 0], color: gl, bone, shade: 0 });
      break;
    }
    case 'shield': {
      if (w.shape === 'kite') {
        const s = extrudeShape([[0, 0.32], [0.22, 0.22], [0.2, -0.1], [0, -0.4], [-0.2, -0.1], [-0.22, 0.22]], 0.05);
        add(s, { p: P(0.09, 0.05, 0.05), r: [0, Math.PI / 2, 0], color: [shadeHex(c, -0.1), shadeHex(c, 0.1)], bone });
        add(box(0.06, 0.6, 0.05), { p: P(0.12, 0.0, 0.05), color: c2, bone });
        add(box(0.06, 0.05, 0.36), { p: P(0.12, 0.12, 0.05), color: c2, bone });
      } else {
        add(cyl(0.3, 0.3, 0.06, 10), { p: P(0.09, 0, 0.05), r: [0, 0, Math.PI / 2], color: [shadeHex(c, -0.1), shadeHex(c, 0.1)], bone });
        add(torus(0.29, 0.03, 4, 12), { p: P(0.12, 0, 0.05), r: [0, Math.PI / 2, 0], color: c2, bone });
        add(sphere(0.07, 6, 4), { p: P(0.13, 0, 0.05), color: c2, bone });
      }
      if (gl) add(octa(0.06), { p: P(0.16, 0.05, 0.05), color: gl, bone, shade: 0 });
      break;
    }
    case 'orb': {
      add(ico(0.11, 1), { p: P(0, 0.12, 0.2), color: gl ?? c, bone, shade: 0.02 });
      add(torus(0.15, 0.012, 4, 12), { p: P(0, 0.12, 0.2), r: [1.2, 0.3, 0], color: w.c3 ?? 0xd8b04a, bone });
      break;
    }
    case 'tome': {
      add(box(0.06, 0.26, 0.2), { p: P(0.03, 0, 0.06), color: c, bone });
      add(box(0.065, 0.24, 0.17), { p: P(0.035, 0, 0.065), color: 0xf0e8d0, bone });
      add(box(0.07, 0.06, 0.06), { p: P(0.04, 0, 0.06), color: gl ?? 0xd8b04a, bone, shade: 0 });
      break;
    }
    case 'torch': {
      add(cyl(0.03, 0.025, 0.45, 5), { p: P(0, 0.12, 0.05), color: 0x5a3a22, bone });
      add(cone(0.06, 0.15, 5), { p: P(0, 0.42, 0.05), color: 0xffa020, bone, shade: 0 });
      break;
    }
    case 'pickaxe': {
      add(cyl(0.025, 0.025, 0.7, 5), { p: P(0, 0, 0.2), r: [Math.PI / 2, 0, 0], color: 0x6a4a2a, bone });
      add(taper(0.04, 0.04, 0.01, 0.01, 0.6), { p: P(0, 0, 0.52), r: [0, 0, Math.PI / 2], color: 0x9a9aa0, bone });
      break;
    }
    case 'rod': {
      add(cyl(0.012, 0.025, 1.6, 5), { p: P(0, 0, 0.75), r: [Math.PI / 2, 0, 0], color: 0x8a6a3a, bone });
      add(cyl(0.035, 0.035, 0.05, 6), { p: P(0, -0.04, 0.1), r: [0, 0, Math.PI / 2], color: 0x9a9aa0, bone });
      break;
    }
    case 'club': {
      add(cyl(0.07, 0.035, 0.7, 5), { p: P(0, 0, 0.3), r: [Math.PI / 2, 0, 0], color: [c2, shadeHex(c2, 0.15)], bone });
      break;
    }
    case 'scythe': {
      add(cyl(0.028, 0.028, 1.6, 5), { p: P(0, 0.3, 0.02), color: c2, bone });
      const blade = extrudeShape([[0, 0], [0.55, 0.12], [0.75, 0.0], [0.5, 0.04], [0, -0.06]], 0.02);
      add(blade, { p: P(0, 1.08, 0.02), r: [0, Math.PI / 2, 0], color: [shadeHex(c, -0.1), shadeHex(c, 0.25)], bone });
      if (gl) add(box(0.02, 0.03, 0.5), { p: P(0, 1.1, 0.3), color: gl, bone, shade: 0 });
      break;
    }
  }
}

// ---------------------------------------------------------------- quadrupeds
/** spec: {kind:'wolf'|'boar'|'bear'|'horse'|'deer'|'rabbit'|'sheep'|'lizard'|'cat'|'croc', c, c2, scale, feat:{horns,mane,spikes,glow,saddle,fire}} */
export function buildQuad(spec) {
  const k = spec.kind || 'wolf';
  const c = spec.c ?? 0x7a7a80, c2 = spec.c2 ?? shadeHex(c, -0.3);
  const S = spec.scale || 1;
  const f = spec.feat || {};
  const D = {
    wolf: { bl: 0.95, bw: 0.42, bh: 0.42, legH: 0.46, legW: 0.12, headL: 0.42, headH: 0.26, neck: 0.22, tail: 0.5 },
    boar: { bl: 0.9, bw: 0.5, bh: 0.5, legH: 0.32, legW: 0.12, headL: 0.42, headH: 0.32, neck: 0.1, tail: 0.15 },
    bear: { bl: 1.25, bw: 0.7, bh: 0.65, legH: 0.5, legW: 0.2, headL: 0.42, headH: 0.36, neck: 0.18, tail: 0.1 },
    horse: { bl: 1.35, bw: 0.48, bh: 0.55, legH: 0.85, legW: 0.11, headL: 0.6, headH: 0.26, neck: 0.55, tail: 0.6 },
    deer: { bl: 0.95, bw: 0.32, bh: 0.38, legH: 0.7, legW: 0.07, headL: 0.36, headH: 0.18, neck: 0.4, tail: 0.12 },
    rabbit: { bl: 0.32, bw: 0.2, bh: 0.2, legH: 0.08, legW: 0.06, headL: 0.18, headH: 0.15, neck: 0.04, tail: 0.06 },
    sheep: { bl: 0.75, bw: 0.48, bh: 0.45, legH: 0.32, legW: 0.07, headL: 0.25, headH: 0.2, neck: 0.1, tail: 0.1 },
    lizard: { bl: 1.2, bw: 0.4, bh: 0.24, legH: 0.22, legW: 0.1, headL: 0.45, headH: 0.18, neck: 0.12, tail: 1.1 },
    croc: { bl: 1.5, bw: 0.5, bh: 0.26, legH: 0.18, legW: 0.12, headL: 0.75, headH: 0.18, neck: 0.1, tail: 1.3 },
    cat: { bl: 1.1, bw: 0.4, bh: 0.4, legH: 0.55, legW: 0.11, headL: 0.36, headH: 0.28, neck: 0.18, tail: 0.75 },
    raptor: { bl: 0.8, bw: 0.32, bh: 0.4, legH: 0.7, legW: 0.1, headL: 0.5, headH: 0.22, neck: 0.4, tail: 0.9 },
  }[k] || {};
  const legY = D.legH, bodyY = legY + D.bh * 0.45;
  const defs = [
    { n: 'root', p: [0, 0, 0] },
    { n: 'body', p: [0, bodyY, 0], parent: 0 },
    { n: 'head', p: [0, bodyY + D.neck * 0.8, D.bl / 2 + D.neck * 0.4], parent: 1 },
    { n: 'legFL', p: [D.bw * 0.38, legY, D.bl * 0.36], parent: 1 },
    { n: 'legFR', p: [-D.bw * 0.38, legY, D.bl * 0.36], parent: 1 },
    { n: 'legBL', p: [D.bw * 0.38, legY, -D.bl * 0.36], parent: 1 },
    { n: 'legBR', p: [-D.bw * 0.38, legY, -D.bl * 0.36], parent: 1 },
    { n: 'tail', p: [0, bodyY + D.bh * 0.25, -D.bl / 2], parent: 1 },
    { n: 'jaw', p: [0, bodyY + D.neck * 0.8 - D.headH * 0.2, D.bl / 2 + D.neck * 0.4 + 0.05], parent: 2 },
    { n: 'neck', p: [0, bodyY, D.bl / 2], parent: 1 },
  ];
  const skel = makeSkeleton(defs);
  const B = new Builder(hashStr(k) + 1);
  const add = (g, o) => B.add(g, o);
  const hp = skel.world[2];
  // body
  if (k === 'sheep') add(ico(0.36, 1), { p: [0, bodyY, 0], s: [D.bw * 2.4, D.bh * 2.2, D.bl * 1.45], color: 0xf2efe6, bone: 1, shade: 0.08 });
  else add(taper(D.bw * 0.95, D.bl * 0.95, D.bw, D.bl, D.bh), { p: [0, bodyY, 0], r: [0, 0, 0], color: [c2, c], bone: 1 });
  if (k === 'boar' || k === 'bear') add(taper(D.bw * 0.9, D.bl * 0.5, D.bw * 0.7, D.bl * 0.45, D.bh * 0.35), { p: [0, bodyY + D.bh * 0.62, D.bl * 0.1], color: c, bone: 1 });
  // neck
  if (D.neck > 0.15) add(taper(D.bw * 0.55, D.bw * 0.6, D.bw * 0.42, D.bw * 0.45, D.neck * 1.25), { p: [0, bodyY + D.neck * 0.4, D.bl / 2 + D.neck * 0.15], r: [k === 'horse' || k === 'deer' || k === 'raptor' ? 0.55 : 0.9, 0, 0], color: c, bone: 1 });
  // head
  add(taper(D.bw * 0.6, D.headH, D.bw * 0.42, D.headH * 0.85, D.headL), { p: [hp[0], hp[1], hp[2] + D.headL * 0.35], r: [Math.PI / 2, 0, 0], color: c, bone: 2 });
  // snout + nose
  add(box(D.bw * 0.34, D.headH * 0.5, D.headL * 0.35), { p: [hp[0], hp[1] - D.headH * 0.12, hp[2] + D.headL * 0.78], color: shadeHex(c, k === 'boar' ? 0.15 : -0.1), bone: 2 });
  add(box(D.bw * 0.2, D.headH * 0.15, 0.03), { p: [hp[0], hp[1] - D.headH * 0.02, hp[2] + D.headL * 0.96], color: 0x1a1a1a, bone: 2 });
  // jaw
  add(box(D.bw * 0.32, D.headH * 0.2, D.headL * 0.55), { p: [hp[0], hp[1] - D.headH * 0.42, hp[2] + D.headL * 0.62], color: shadeHex(c, -0.15), bone: 8 });
  // eyes
  for (const s of [1, -1]) add(box(0.04, 0.04, 0.03), { p: [hp[0] + D.bw * 0.2 * s, hp[1] + D.headH * 0.15, hp[2] + D.headL * 0.45], color: f.glow ?? 0x111111, bone: 2, shade: 0 });
  // ears / horns / tusks
  if (['wolf', 'horse', 'deer', 'cat', 'rabbit'].includes(k)) for (const s of [1, -1]) add(cone(k === 'rabbit' ? 0.04 : 0.06, k === 'rabbit' ? 0.22 : 0.16, 4), { p: [hp[0] + D.bw * 0.2 * s, hp[1] + D.headH * 0.55, hp[2] + D.headL * 0.15], r: [-0.25, 0, -0.2 * s], s: [1, 1, 0.6], color: c, bone: 2 });
  if (k === 'boar') for (const s of [1, -1]) add(cone(0.03, 0.16, 4), { p: [hp[0] + 0.08 * s, hp[1] - 0.08, hp[2] + D.headL * 0.85], r: [0.6, 0, 0.3 * s], color: 0xf0e8d0, bone: 8 });
  if (k === 'deer' || f.horns) for (const s of [1, -1]) {
    const hc = f.horns ?? 0xc8b088;
    add(cyl(0.02, 0.025, 0.35, 4), { p: [hp[0] + 0.08 * s, hp[1] + D.headH * 0.5 + 0.15, hp[2]], r: [-0.3, 0, -0.4 * s], color: hc, bone: 2 });
    add(cyl(0.015, 0.02, 0.2, 4), { p: [hp[0] + 0.18 * s, hp[1] + D.headH * 0.5 + 0.28, hp[2] + 0.05], r: [0.4, 0, -0.9 * s], color: hc, bone: 2 });
  }
  if (k === 'sheep') add(sphere(0.1, 5, 4), { p: [hp[0], hp[1] + 0.08, hp[2] + 0.05], color: 0xf2efe6, bone: 2 });
  // mane
  if (k === 'horse' || f.mane) for (let i = 0; i < 5; i++) add(box(0.05, 0.12, 0.12), { p: [0, bodyY + D.neck * (0.2 + i * 0.17) + 0.12, D.bl / 2 + D.neck * (-0.05 + i * 0.1)], r: [0.5, 0, 0], color: f.mane ?? c2, bone: i > 3 ? 2 : 1 });
  if (f.spikes) for (let i = 0; i < 5; i++) add(cone(0.05, 0.2, 4), { p: [0, bodyY + D.bh * 0.5, D.bl * (0.35 - i * 0.18)], r: [-0.4, 0, 0], color: f.spikes, bone: 1 });
  // legs
  const legBones = [3, 4, 5, 6];
  for (let li = 0; li < 4; li++) {
    const lp = skel.world[legBones[li]];
    const lw = D.legW * (k === 'bear' ? 1.2 : 1);
    if (k === 'rabbit' && li >= 2) { add(box(lw * 1.2, 0.12, 0.22), { p: [lp[0], 0.06, lp[2] + 0.02], color: c, bone: legBones[li] }); continue; }
    add(taper(lw * 1.2, lw * 1.3, lw, lw, legY), { p: [lp[0], legY / 2, lp[2]], color: [shadeHex(c2, -0.1), c], bone: legBones[li] });
    add(box(lw * 1.15, 0.07, lw * 1.3), { p: [lp[0], 0.035, lp[2] + 0.02], color: k === 'horse' || k === 'deer' ? 0x2a2018 : shadeHex(c2, -0.2), bone: legBones[li] });
  }
  // tail
  const tp = skel.world[7];
  if (D.tail > 0.3) add(cone(D.bw * (k === 'lizard' || k === 'croc' ? 0.38 : 0.14), D.tail, 5), { p: [tp[0], tp[1] - D.tail * 0.25, tp[2] - D.tail * 0.42], r: [k === 'lizard' || k === 'croc' || k === 'raptor' ? -1.55 : -2.2, 0, 0], color: k === 'horse' ? c2 : c, bone: 7 });
  else add(sphere(D.tail * 0.8 + 0.03, 5, 4), { p: [tp[0], tp[1], tp[2] - 0.02], color: k === 'rabbit' ? 0xf8f8f8 : c, bone: 7 });
  if (k === 'croc') for (let i = 0; i < 6; i++) add(cone(0.04, 0.08, 4), { p: [0, bodyY + D.bh * 0.5, D.bl * (0.4 - i * 0.15)], color: c2, bone: 1 });
  if (f.saddle) {
    add(box(D.bw * 1.05, 0.1, 0.5), { p: [0, bodyY + D.bh * 0.52, 0.0], color: f.saddle, bone: 1 });
    add(box(D.bw * 1.1, 0.04, 0.6), { p: [0, bodyY + D.bh * 0.46, 0.0], color: f.saddle2 ?? 0xa83a2a, bone: 1 });
    add(box(D.bw * 0.3, 0.12, 0.08), { p: [0, bodyY + D.bh * 0.62, 0.2], color: f.saddle, bone: 1 });
  }
  if (f.armor) add(taper(D.bw * 1.08, D.bl * 0.7, D.bw * 1.05, D.bl * 0.6, D.bh * 0.5), { p: [0, bodyY + D.bh * 0.3, 0.05], color: f.armor, bone: 1 });
  if (f.fire) for (let i = 0; i < 4; i++) add(cone(0.06, 0.2, 4), { p: [0, bodyY + D.bh * 0.55, D.bl * (0.25 - i * 0.17)], color: f.fire, bone: 1, shade: 0 });
  const res = finish(B, skel, { rig: 'quad', kind: k, height: (hp[1] + D.headH) * S + 0.1, radius: Math.max(D.bw, D.bl * 0.5) * S, saddleY: bodyY + D.bh * 0.55 });
  res.mesh.scale.setScalar(S); res.scale = S;
  return res;
}

// ---------------------------------------------------------------- spider / scorpion
export function buildSpider(spec) {
  const c = spec.c ?? 0x3a2a2a, c2 = spec.c2 ?? 0xa83a2a, S = spec.scale || 1;
  const scorp = spec.kind === 'scorpion';
  const bodyY = 0.42;
  const defs = [
    { n: 'root', p: [0, 0, 0] },
    { n: 'body', p: [0, bodyY, 0], parent: 0 },
    { n: 'head', p: [0, bodyY, 0.32], parent: 1 },
    { n: 'abdomen', p: [0, bodyY + 0.05, -0.25], parent: 1 },
  ];
  for (let i = 0; i < 8; i++) { const side = i < 4 ? 1 : -1; const j = i % 4; defs.push({ n: 'l' + i, p: [0.18 * side, bodyY, 0.2 - j * 0.15], parent: 1 }); }
  defs.push({ n: 'tail', p: [0, bodyY + 0.1, -0.45], parent: 3 });
  defs.push({ n: 'clawL', p: [0.2, bodyY, 0.4], parent: 1 });
  defs.push({ n: 'clawR', p: [-0.2, bodyY, 0.4], parent: 1 });
  const skel = makeSkeleton(defs);
  const B = new Builder(77);
  const add = (g, o) => B.add(g, o);
  add(ico(0.26, 0), { p: [0, bodyY, 0.05], s: [1.1, 0.7, 1.2], color: c, bone: 1 });
  add(ico(0.16, 0), { p: [0, bodyY + 0.02, 0.36], s: [1, 0.8, 1], color: shadeHex(c, 0.1), bone: 2 });
  for (const s of [1, -1]) {
    add(box(0.05, 0.05, 0.03), { p: [0.06 * s, bodyY + 0.08, 0.5], color: spec.eyes ?? 0xff3a2a, bone: 2, shade: 0 });
    add(box(0.035, 0.035, 0.03), { p: [0.11 * s, bodyY + 0.1, 0.46], color: spec.eyes ?? 0xff3a2a, bone: 2, shade: 0 });
    add(cone(0.03, 0.14, 4), { p: [0.05 * s, bodyY - 0.08, 0.5], r: [2.6, 0, 0], color: 0x1a1a1a, bone: 2 });
  }
  if (scorp) {
    add(taper(0.36, 0.5, 0.3, 0.42, 0.18), { p: [0, bodyY + 0.02, -0.25], color: [c, shadeHex(c, 0.12)], bone: 3 });
    // tail segments arc up over the back
    for (let i = 0; i < 5; i++) {
      const a = i / 5 * 2.2;
      add(sphere(0.09 - i * 0.008, 6, 4), { p: [0, bodyY + 0.1 + Math.sin(a) * 0.55, -0.48 - Math.sin(a * 0.5) * 0.2 + (i > 2 ? (i - 2) * 0.12 : 0)], color: c, bone: 12 });
    }
    add(cone(0.06, 0.22, 5), { p: [0, bodyY + 0.62, -0.08], r: [2.2, 0, 0], color: c2, bone: 12 });
    for (const s of [1, -1]) {
      add(box(0.06, 0.06, 0.32), { p: [0.22 * s, bodyY, 0.55], color: c, bone: s > 0 ? 13 : 14 });
      add(box(0.12, 0.08, 0.2), { p: [0.22 * s, bodyY, 0.76], color: shadeHex(c, 0.1), bone: s > 0 ? 13 : 14 });
      add(cone(0.04, 0.18, 4), { p: [0.18 * s, bodyY, 0.9], r: [Math.PI / 2, 0, 0], color: c2, bone: s > 0 ? 13 : 14 });
      add(cone(0.035, 0.16, 4), { p: [0.27 * s, bodyY, 0.88], r: [Math.PI / 2, 0, 0], color: c2, bone: s > 0 ? 13 : 14 });
    }
  } else {
    add(ico(0.34, 1), { p: [0, bodyY + 0.12, -0.42], s: [1, 0.85, 1.2], color: [shadeHex(c, -0.1), shadeHex(c, 0.1)], bone: 3, shade: 0.05 });
    add(box(0.18, 0.04, 0.28), { p: [0, bodyY + 0.42, -0.42], color: c2, bone: 3 });
    for (const s of [1, -1]) add(box(0.12, 0.04, 0.04), { p: [0.1 * s, bodyY + 0.38, -0.32], r: [0, 0, 0.5 * s], color: c2, bone: 3 });
  }
  for (let i = 0; i < 8; i++) {
    if (scorp && (i % 4) === 0) continue;
    const side = i < 4 ? 1 : -1, j = i % 4;
    const base = [0.18 * side, bodyY, 0.2 - j * 0.15];
    const spread = (j - 1.5) * 0.35;
    // upper leg goes out & up, lower leg down to ground
    const kx = base[0] + side * 0.35, ky = bodyY + 0.25, kz = base[2] + spread * 0.3;
    const fx = base[0] + side * 0.65, fz = base[2] + spread * 0.5;
    const seg = (a, b, w) => {
      const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2, mz = (a[2] + b[2]) / 2;
      const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2];
      const len = Math.hypot(dx, dy, dz);
      const g = cyl(w, w * 0.8, len, 4);
      const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(dx, dy, dz).normalize());
      const m = new THREE.Matrix4().compose(new THREE.Vector3(mx, my, mz), q, new THREE.Vector3(1, 1, 1));
      add(g, { mat: m, color: c, bone: 4 + i });
    };
    seg(base, [kx, ky, kz], 0.035);
    seg([kx, ky, kz], [fx, 0.0, fz], 0.028);
  }
  const res = finish(B, skel, { rig: 'spider', kind: spec.kind || 'spider', height: (scorp ? 1.0 : 0.8), radius: 0.6 });
  res.mesh.scale.setScalar(S); res.scale = S; res.height *= S; res.radius *= S;
  return res;
}

// ---------------------------------------------------------------- blob (slime)
export function buildBlob(spec) {
  const c = spec.c ?? 0x5ad04a, S = spec.scale || 1;
  const skel = makeSkeleton([{ n: 'root', p: [0, 0, 0] }, { n: 'body', p: [0, 0, 0], parent: 0 }]);
  const B = new Builder(9);
  const g = jitter(ico(0.5, 1), 0.06, 4);
  B.add(g, { p: [0, 0.4, 0], s: [1, 0.8, 1], color: [shadeHex(c, -0.25), shadeHex(c, 0.15)], bone: 1, shade: 0.05 });
  B.add(ico(0.2, 0), { p: [0.12, 0.62, 0.1], color: shadeHex(c, 0.35), bone: 1, shade: 0 });
  for (const s of [1, -1]) {
    B.add(box(0.1, 0.13, 0.05), { p: [0.13 * s, 0.5, 0.42], color: 0xf8f8f8, bone: 1, shade: 0 });
    B.add(box(0.06, 0.08, 0.05), { p: [0.13 * s, 0.49, 0.45], color: spec.eyes ?? 0x1a1a1a, bone: 1, shade: 0 });
  }
  B.add(box(0.14, 0.03, 0.05), { p: [0, 0.36, 0.44], color: shadeHex(c, -0.45), bone: 1 });
  if (spec.crown) for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; B.add(cone(0.05, 0.14, 4), { p: [Math.sin(a) * 0.14, 0.82, Math.cos(a) * 0.14], color: 0xf0c040, bone: 1 }); }
  if (spec.inner) B.add(octa(0.12), { p: [0, 0.38, 0], color: spec.inner, bone: 1, shade: 0 });
  const res = finish(B, skel, { rig: 'blob', kind: 'slime', height: 0.95 * S, radius: 0.5 * S });
  res.mesh.scale.setScalar(S); res.scale = S;
  res.mesh.material.transparent = true; res.mesh.material.opacity = 0.9;
  return res;
}

// ---------------------------------------------------------------- floaters (wisp, wraith, eye, elemental, bat)
export function buildFloater(spec) {
  const k = spec.kind || 'wisp';
  const c = spec.c ?? 0x8ad8ff, c2 = spec.c2 ?? shadeHex(c, -0.3), S = spec.scale || 1;
  const cy = k === 'bat' ? 1.4 : 1.25;
  const skel = makeSkeleton([
    { n: 'root', p: [0, 0, 0] }, { n: 'core', p: [0, cy, 0], parent: 0 },
    { n: 'armL', p: [0.3, cy + 0.1, 0], parent: 1 }, { n: 'armR', p: [-0.3, cy + 0.1, 0], parent: 1 },
    { n: 'head', p: [0, cy + 0.4, 0], parent: 1 },
    { n: 'wingL', p: [0.12, cy + 0.05, -0.05], parent: 1 }, { n: 'wingR', p: [-0.12, cy + 0.05, -0.05], parent: 1 },
  ]);
  const B = new Builder(hashStr(k));
  const add = (g, o) => B.add(g, o);
  if (k === 'wisp') {
    add(ico(0.28, 1), { p: [0, cy, 0], color: [c, shadeHex(c, 0.4)], bone: 1, shade: 0.02 });
    for (let i = 0; i < 4; i++) { const a = i / 4 * Math.PI * 2; add(octa(0.07), { p: [Math.cos(a) * 0.45, cy + 0.1, Math.sin(a) * 0.45], color: shadeHex(c, 0.3), bone: i < 2 ? 2 : 3, shade: 0 }); }
  } else if (k === 'wraith' || k === 'ghost') {
    add(cone(0.38, 1.2, 7), { p: [0, cy - 0.35, 0], r: [Math.PI, 0, 0], color: [shadeHex(c, 0.1), c2], bone: 1 });
    add(new THREE.SphereGeometry(0.24, 8, 5, 0, Math.PI * 2, 0, Math.PI * 0.65), { p: [0, cy + 0.38, 0], color: c, bone: 4 });
    add(box(0.26, 0.2, 0.05), { p: [0, cy + 0.3, 0.17], color: 0x05050a, bone: 4 });
    for (const s of [1, -1]) add(box(0.05, 0.03, 0.03), { p: [0.06 * s, cy + 0.33, 0.2], color: spec.eyes ?? 0x7af0ff, bone: 4, shade: 0 });
    for (const s of [1, -1]) {
      add(taper(0.12, 0.12, 0.06, 0.06, 0.55), { p: [0.3 * s, cy - 0.15, 0.05], r: [0, 0, 0.2 * s], color: c2, bone: s > 0 ? 2 : 3 });
      add(box(0.06, 0.12, 0.06), { p: [0.36 * s, cy - 0.45, 0.06], color: 0xd8d0c0, bone: s > 0 ? 2 : 3 });
    }
    if (spec.weapon) add(cyl(0.025, 0.025, 1.4, 5), { p: [-0.38, cy - 0.2, 0.15], color: 0x3a2a2a, bone: 3 });
  } else if (k === 'eye') {
    add(ico(0.42, 1), { p: [0, cy, 0], color: [c2, c], bone: 1, shade: 0.04 });
    add(sphere(0.22, 8, 6), { p: [0, cy, 0.32], s: [1, 1, 0.5], color: 0xf8f0e0, bone: 1, shade: 0 });
    add(sphere(0.12, 6, 5), { p: [0, cy, 0.43], s: [1, 1, 0.4], color: spec.eyes ?? 0xff3020, bone: 1, shade: 0 });
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; add(cone(0.04, 0.4, 4), { p: [Math.cos(a) * 0.25, cy + 0.38 + Math.sin(a) * 0.08, -0.1 + Math.sin(a) * 0.15], r: [-0.4 + Math.sin(a) * 0.3, 0, -Math.cos(a) * 0.6], color: c2, bone: 4 }); }
  } else if (k === 'elemental') {
    // rocky/icy/fiery chunks orbiting a core
    add(octa(0.26), { p: [0, cy, 0], s: [1, 1.3, 1], color: spec.core ?? shadeHex(c, 0.4), bone: 1, shade: 0 });
    add(jitter(ico(0.38, 0), 0.08, 3), { p: [0, cy + 0.05, 0], color: c, bone: 1 });
    add(jitter(ico(0.2, 0), 0.05, 5), { p: [0, cy + 0.5, 0.02], color: c, bone: 4 });
    for (const s of [1, -1]) {
      add(jitter(ico(0.16, 0), 0.04, 7), { p: [0.42 * s, cy + 0.1, 0], color: c2, bone: s > 0 ? 2 : 3 });
      add(jitter(ico(0.13, 0), 0.04, 8), { p: [0.52 * s, cy - 0.2, 0.05], color: c, bone: s > 0 ? 2 : 3 });
    }
    for (let i = 0; i < 3; i++) add(cone(0.12 - i * 0.03, 0.3, 5), { p: [0, cy - 0.45 - i * 0.2, 0], r: [Math.PI, 0, 0], color: c2, bone: 1 });
    for (const s of [1, -1]) add(box(0.06, 0.04, 0.03), { p: [0.07 * s, cy + 0.53, 0.18], color: spec.eyes ?? 0xffffff, bone: 4, shade: 0 });
  } else if (k === 'bat') {
    add(ico(0.18, 0), { p: [0, cy, 0], s: [1, 1.1, 1.2], color: c, bone: 1 });
    add(ico(0.12, 0), { p: [0, cy + 0.15, 0.12], color: c, bone: 4 });
    for (const s of [1, -1]) {
      add(cone(0.04, 0.12, 4), { p: [0.07 * s, cy + 0.3, 0.1], color: c, bone: 4 });
      add(box(0.03, 0.03, 0.02), { p: [0.05 * s, cy + 0.17, 0.23], color: spec.eyes ?? 0xff3020, bone: 4, shade: 0 });
      const wg = extrudeShape([[0, 0], [0.3 * s, 0.15], [0.6 * s, 0.05], [0.55 * s, -0.15], [0.4 * s, -0.05], [0.25 * s, -0.18], [0.1 * s, -0.05]], 0.015);
      add(wg, { p: [0.1 * s, cy + 0.05, -0.02], r: [Math.PI / 2, 0, 0], color: c2, bone: s > 0 ? 5 : 6 });
    }
  }
  const res = finish(B, skel, { rig: 'floater', kind: k, height: cy + 0.7, radius: 0.5 });
  res.mesh.scale.setScalar(S); res.scale = S; res.height *= S; res.radius *= S;
  if (k === 'wisp' || k === 'wraith' || k === 'ghost') { res.mesh.material.transparent = true; res.mesh.material.opacity = 0.82; res.mesh.castShadow = false; }
  return res;
}

// ---------------------------------------------------------------- worm
export function buildWorm(spec) {
  const c = spec.c ?? 0xc8a868, c2 = spec.c2 ?? shadeHex(c, -0.25), S = spec.scale || 1;
  const defs = [{ n: 'root', p: [0, 0, 0] }];
  for (let i = 0; i < 5; i++) defs.push({ n: 's' + (i + 1), p: [0, 0.4 + i * 0.5, 0], parent: i });
  defs.push({ n: 'head', p: [0, 2.9, 0], parent: 5 });
  defs.push({ n: 'jaw', p: [0, 3.1, 0.1], parent: 6 });
  const skel = makeSkeleton(defs);
  const B = new Builder(13);
  for (let i = 0; i < 6; i++) {
    const rr = 0.55 - i * 0.04;
    B.add(cyl(rr, rr * 1.05, 0.52, 8), { p: [0, 0.3 + i * 0.5, 0], color: i % 2 ? c : c2, bone: Math.min(i + 1, 6) });
  }
  B.add(cyl(0.5, 0.36, 0.5, 8), { p: [0, 3.2, 0], color: c, bone: 6 });
  for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; B.add(cone(0.06, 0.3, 4), { p: [Math.cos(a) * 0.32, 3.55, Math.sin(a) * 0.32], r: [Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5], color: 0xf0e8d0, bone: 7 }); }
  B.add(cyl(0.3, 0.3, 0.05, 8), { p: [0, 3.46, 0], color: 0x4a1010, bone: 6 });
  const res = finish(B, skel, { rig: 'worm', kind: 'worm', height: 3.8, radius: 0.8 });
  res.mesh.scale.setScalar(S); res.scale = S; res.height *= S; res.radius *= S;
  return res;
}

// ---------------------------------------------------------------- dragon
export function buildDragon(spec) {
  const c = spec.c ?? 0xa82a1a, c2 = spec.c2 ?? 0xe8c070, S = spec.scale || 1;
  const bodyY = 1.4;
  const defs = [
    { n: 'root', p: [0, 0, 0] },
    { n: 'body', p: [0, bodyY, 0], parent: 0 },
    { n: 'neck', p: [0, bodyY + 0.3, 1.0], parent: 1 },
    { n: 'head', p: [0, bodyY + 1.3, 1.9], parent: 2 },
    { n: 'jaw', p: [0, bodyY + 1.15, 2.05], parent: 3 },
    { n: 'wingL', p: [0.5, bodyY + 0.5, 0.3], parent: 1 },
    { n: 'wingR', p: [-0.5, bodyY + 0.5, 0.3], parent: 1 },
    { n: 'tail1', p: [0, bodyY, -1.1], parent: 1 },
    { n: 'tail2', p: [0, bodyY - 0.3, -2.4], parent: 7 },
    { n: 'legFL', p: [0.55, bodyY - 0.1, 0.7], parent: 1 },
    { n: 'legFR', p: [-0.55, bodyY - 0.1, 0.7], parent: 1 },
    { n: 'legBL', p: [0.6, bodyY - 0.1, -0.6], parent: 1 },
    { n: 'legBR', p: [-0.6, bodyY - 0.1, -0.6], parent: 1 },
  ];
  const skel = makeSkeleton(defs);
  const B = new Builder(21);
  const add = (g, o) => B.add(g, o);
  add(jitter(ico(1, 1), 0.05, 2), { p: [0, bodyY, 0], s: [0.95, 0.85, 1.5], color: [c2, c], bone: 1 });
  for (let i = 0; i < 5; i++) add(cone(0.1, 0.35, 4), { p: [0, bodyY + 0.8, 0.6 - i * 0.4], r: [-0.4, 0, 0], color: c2, bone: 1 });
  add(taper(0.5, 0.5, 0.35, 0.35, 1.4), { p: [0, bodyY + 0.75, 1.4], r: [0.75, 0, 0], color: c, bone: 2 });
  for (let i = 0; i < 4; i++) add(cone(0.08, 0.3, 4), { p: [0, bodyY + 0.75 + i * 0.25, 0.8 + i * 0.3], r: [-0.5, 0, 0], color: c2, bone: 2 });
  // head
  add(taper(0.5, 0.45, 0.35, 0.3, 0.8), { p: [0, bodyY + 1.35, 2.2], r: [Math.PI / 2, 0, 0], color: c, bone: 3 });
  add(box(0.36, 0.14, 0.6), { p: [0, bodyY + 1.05, 2.35], color: shadeHex(c, -0.2), bone: 4 });
  for (const s of [1, -1]) {
    add(cone(0.08, 0.6, 5), { p: [0.18 * s, bodyY + 1.6, 1.9], r: [-1.1, 0, -0.3 * s], color: 0xe8e0c8, bone: 3 });
    add(box(0.08, 0.06, 0.05), { p: [0.17 * s, bodyY + 1.45, 2.35], color: spec.eyes ?? 0xffe040, bone: 3, shade: 0 });
    for (let t = 0; t < 3; t++) add(cone(0.025, 0.1, 4), { p: [0.13 * s, bodyY + 1.18, 2.3 + t * 0.12], r: [Math.PI, 0, 0], color: 0xf8f8f0, bone: 3 });
  }
  // wings
  for (const s of [1, -1]) {
    const shape = [[0, 0], [1.2, 0.9], [2.6, 0.6], [2.4, -0.2], [1.9, 0.1], [1.6, -0.5], [1.1, -0.1], [0.7, -0.6], [0.3, -0.2]];
    const wg = extrudeShape(shape.map(([x, y]) => [x * s, y]), 0.04);
    add(wg, { p: [0.5 * s, bodyY + 0.5, 0.3], r: [Math.PI / 2, 0, 0.45 * s], order: 'ZXY', color: spec.wing ?? shadeHex(c, -0.3), bone: s > 0 ? 5 : 6 });
    const spar = extrudeShape([[0, 0.08], [1.2, 0.98], [2.65, 0.66], [2.6, 0.52], [1.2, 0.8], [0, -0.08]].map(([x, y]) => [x * s, y]), 0.12);
    add(spar, { p: [0.5 * s, bodyY + 0.5, 0.3], r: [Math.PI / 2, 0, 0.45 * s], order: 'ZXY', color: c, bone: s > 0 ? 5 : 6 });
  }
  // tail
  add(cone(0.45, 1.6, 6), { p: [0, bodyY - 0.1, -1.8], r: [-Math.PI / 2 - 0.15, 0, 0], color: c, bone: 7 });
  add(cone(0.22, 1.5, 6), { p: [0, bodyY - 0.45, -3.0], r: [-Math.PI / 2 - 0.1, 0, 0], color: c, bone: 8 });
  add(tetra(0.25), { p: [0, bodyY - 0.55, -3.8], s: [0.3, 1, 1], color: c2, bone: 8 });
  // legs
  for (let li = 0; li < 4; li++) {
    const lp = skel.world[9 + li];
    add(taper(0.32, 0.36, 0.2, 0.22, bodyY - 0.1), { p: [lp[0], (bodyY - 0.1) / 2, lp[2]], color: [shadeHex(c, -0.2), c], bone: 9 + li });
    for (let t = -1; t <= 1; t++) add(cone(0.05, 0.18, 4), { p: [lp[0] + t * 0.1, 0.06, lp[2] + 0.2], r: [Math.PI / 2, 0, 0], color: 0xe8e0c8, bone: 9 + li });
  }
  const res = finish(B, skel, { rig: 'dragon', kind: 'dragon', height: bodyY + 2.0, radius: 1.6 });
  res.mesh.scale.setScalar(S); res.scale = S; res.height *= S; res.radius *= S;
  return res;
}

// ---------------------------------------------------------------- dispatcher
export function buildModel(spec) {
  switch (spec.rig) {
    case 'quad': return buildQuad(spec);
    case 'spider': return buildSpider(spec);
    case 'blob': return buildBlob(spec);
    case 'floater': return buildFloater(spec);
    case 'worm': return buildWorm(spec);
    case 'dragon': return buildDragon(spec);
    default: return buildHumanoid(spec);
  }
}

export function disposeModel(m) {
  if (!m) return;
  m.mesh.geometry.dispose();
  m.mesh.material.dispose();
  m.mesh.removeFromParent();
}

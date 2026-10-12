// Asset pipeline: downloads CC0 source packs (KayKit, Quaternius) into tools/_src and builds the
// optimised runtime files under assets/models. Run with:  node tools/build-assets.mjs
// Everything here is public domain (CC0); see assets/CREDITS.md.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { NodeIO, Document } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { mergeDocuments, dedup, prune, resample, weld, meshopt, unpartition, simplify, join, palette } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptDecoder, MeshoptSimplifier } from 'meshoptimizer';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'tools/_src');
const OUT = path.join(ROOT, 'assets/models');
await MeshoptEncoder.ready; await MeshoptDecoder.ready; await MeshoptSimplifier.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });

const KK = 'https://raw.githubusercontent.com/KayKit-Game-Assets';
const ADV = `${KK}/KayKit-Character-Pack-Adventures-1.0/main/addons/kaykit_character_pack_adventures/Characters/gltf`;
const SKEL = `${KK}/KayKit-Character-Pack-Skeletons-1.0/main/addons/kaykit_character_pack_skeletons/Characters/gltf`;
const HEX = `${KK}/KayKit-Medieval-Hexagon-Pack-1.0/main/addons/kaykit_medieval_hexagon_pack/Assets/gltf`;
const DUN = `${KK}/KayKit-Dungeon-Remastered-1.0/main/addons/kaykit_dungeon_remastered/Assets/gltf`;
const HAL = `${KK}/KayKit-Halloween-Bits-1.0/main/addons/kaykit_halloween_bits/Assets/gltf`;
const QS = 'https://raw.githubusercontent.com/trebeljahr/quaternius-showcase/main/public/glb';
const PP = id => `https://static.poly.pizza/${id}.glb`;

// ------------------------------------------------------------------ download helpers
async function get(url, file) {
  if (fs.existsSync(file) && fs.statSync(file).size > 0) return file;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  fs.writeFileSync(file, Buffer.from(await r.arrayBuffer()));
  return file;
}
// .gltf with sidecar buffers/images
async function getGltf(base, name, dir) {
  const f = await get(`${base}/${name}.gltf`, path.join(dir, name + '.gltf'));
  const j = JSON.parse(fs.readFileSync(f, 'utf8'));
  for (const b of j.buffers || []) if (b.uri && !b.uri.startsWith('data:')) await get(`${base}/${encodeURI(b.uri)}`, path.join(dir, decodeURI(b.uri)));
  for (const im of j.images || []) if (im.uri && !im.uri.startsWith('data:')) await get(`${base}/${encodeURI(im.uri)}`, path.join(dir, decodeURI(im.uri)));
  return f;
}
const pool = async (items, n, fn) => { const out = []; let i = 0; await Promise.all(Array.from({ length: n }, async () => { while (i < items.length) { const k = i++; out[k] = await fn(items[k]); } })); return out; };

// ------------------------------------------------------------------ processing helpers
const kb = f => (fs.statSync(f).size / 1024).toFixed(0) + 'K';
async function finish(doc, file, { anim = false } = {}) {
  await doc.transform(dedup(), prune({ keepLeaves: false, keepAttributes: false }), ...(anim ? [resample()] : []), weld(), unpartition(), meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
  fs.mkdirSync(path.dirname(file), { recursive: true });
  await io.write(file, doc);
  console.log('  wrote', path.relative(ROOT, file), kb(file));
}
// Merge skinned sibling meshes that share skin + material into one primitive (one draw call).
// Skinned vertices live in bind space, so node transforms don't matter and buffers concatenate directly.
function mergeSkinned(doc) {
  const root = doc.getRoot();
  const groups = new Map();
  for (const n of root.listNodes()) {
    const m = n.getMesh(), sk = n.getSkin(); if (!m || !sk || m.listPrimitives().length !== 1) continue;
    const prim = m.listPrimitives()[0];
    const parent = root.listNodes().find(p => p.listChildren().includes(n)) || root.getDefaultScene();
    const key = [sk, prim.getMaterial(), parent].map(o => o && root.listNodes().indexOf(o) + ':' + (o.getName?.() || '')).join('|') + '|' + prim.listSemantics().sort().join(',');
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(n);
  }
  for (const nodes of groups.values()) {
    if (nodes.length < 2) continue;
    const prims = nodes.map(n => n.getMesh().listPrimitives()[0]);
    const base = prims[0];
    const out = {};
    for (const sem of base.listSemantics()) {
      const accs = prims.map(p => p.getAttribute(sem));
      const A = accs[0].getArray().constructor;
      const total = accs.reduce((a, x) => a + x.getArray().length, 0);
      const arr = new A(total); let o = 0;
      for (const x of accs) { arr.set(x.getArray(), o); o += x.getArray().length; }
      out[sem] = doc.createAccessor().setType(accs[0].getType()).setArray(arr).setNormalized(accs[0].getNormalized()).setBuffer(accs[0].getBuffer());
    }
    let vOff = 0; const idx = [];
    for (const p of prims) { const ia = p.getIndices().getArray(); for (let i = 0; i < ia.length; i++) idx.push(ia[i] + vOff); vOff += p.getAttribute('POSITION').getCount(); }
    const IA = vOff > 65535 ? Uint32Array : Uint16Array;
    const merged = doc.createPrimitive().setMaterial(base.getMaterial()).setIndices(doc.createAccessor().setType('SCALAR').setArray(new IA(idx)).setBuffer(base.getIndices().getBuffer()));
    for (const [sem, acc] of Object.entries(out)) merged.setAttribute(sem, acc);
    const mesh = doc.createMesh(nodes[0].getMesh().getName() + '_merged').addPrimitive(merged);
    nodes[0].setMesh(mesh).setName(nodes[0].getName().replace(/_(Body|ArmLeft|ArmRight|LegLeft|LegRight|Head)$/, '') + '_Body');
    for (const n of nodes.slice(1)) n.dispose();
  }
}
// Concatenate primitives (same material & attribute set) into one; returns the merged primitive.
function concatPrims(doc, prims) {
  const base = prims[0];
  const merged = doc.createPrimitive().setMaterial(base.getMaterial());
  const widest = arrs => arrs.some(a => a instanceof Float32Array) ? Float32Array : arrs.some(a => a instanceof Uint32Array) ? Uint32Array : arrs.some(a => a instanceof Uint16Array || a instanceof Int16Array) ? (arrs.some(a => a instanceof Int16Array) ? Int16Array : Uint16Array) : arrs[0].constructor;
  for (const sem of base.listSemantics()) {
    const accs = prims.map(p => p.getAttribute(sem));
    const norm = accs.some(a => a.getNormalized());
    // normalised integer data mixed with floats must be expanded to real values
    const arrs = accs.map(a => (norm && !(a.getArray() instanceof Float32Array)) || accs.some(b => b.getArray().constructor !== a.getArray().constructor) ? Float32Array.from({ length: a.getCount() * a.getElementSize() }, (_, i) => a.getElement(Math.floor(i / a.getElementSize()), [])[i % a.getElementSize()]) : a.getArray());
    const A = widest(arrs);
    const arr = new A(arrs.reduce((t, x) => t + x.length, 0)); let o = 0;
    for (const x of arrs) { arr.set(x, o); o += x.length; }
    merged.setAttribute(sem, doc.createAccessor().setType(accs[0].getType()).setArray(arr).setNormalized(A !== Float32Array && norm).setBuffer(accs[0].getBuffer()));
  }
  let vOff = 0; const idx = [];
  for (const p of prims) { const ia = p.getIndices() ? p.getIndices().getArray() : Array.from({ length: p.getAttribute('POSITION').getCount() }, (_, i) => i); for (let i = 0; i < ia.length; i++) idx.push(ia[i] + vOff); vOff += p.getAttribute('POSITION').getCount(); }
  merged.setIndices(doc.createAccessor().setType('SCALAR').setArray(vOff > 65535 ? new Uint32Array(idx) : new Uint16Array(idx)).setBuffer(base.getAttribute('POSITION').getBuffer()));
  return merged;
}
// within each mesh, merge primitives that share a material and attribute layout
function mergeMeshPrims(doc) {
  for (const mesh of doc.getRoot().listMeshes()) {
    const prims = mesh.listPrimitives(); if (prims.length < 2) continue;
    const groups = new Map();
    for (const p of prims) { const k = (p.getMaterial()?.getName() || '') + '|' + p.listSemantics().sort().join(',') + '|' + p.getMode(); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(p); }
    for (const g of groups.values()) { if (g.length < 2) continue; const m = concatPrims(doc, g); for (const p of g) { mesh.removePrimitive(p); p.dispose(); } mesh.addPrimitive(m); }
  }
}
const killAnim = a => { a.listChannels().forEach(c => c.dispose()); a.listSamplers().forEach(x => x.dispose()); a.dispose(); };
// keep only listed animations, renaming them: map = { srcName: dstName }
function filterAnims(doc, map) {
  const seen = new Set();
  for (const a of doc.getRoot().listAnimations()) {
    const n = a.getName().replace(/^.*\|/, '');
    const dst = map === true ? n : map[n];
    if (!dst || seen.has(dst)) { killAnim(a); continue; }
    seen.add(dst); a.setName(dst);
  }
}
const stripAnims = doc => doc.getRoot().listAnimations().forEach(killAnim);
// pack many single-model documents into one: each model becomes a root node named by its key
async function buildPack(entries, file, { simplifyRe = null, ratio = 0.5 } = {}) {
  const doc = new Document(); doc.createBuffer();
  const scene = doc.createScene('pack');
  for (const [key, srcFile] of entries) {
    const src = await io.read(srcFile);
    stripAnims(src);
    if (simplifyRe && simplifyRe.test(key)) {
      // flat-shaded sources split every vertex by normal; drop normals (the game recomputes them) so welding can merge
      for (const m of src.getRoot().listMeshes()) for (const p of m.listPrimitives()) p.setAttribute('NORMAL', null);
    }
    if (simplifyRe && simplifyRe.test(key)) await src.transform(weld({ tolerance: 0.001 }), simplify({ simplifier: MeshoptSimplifier, ratio, error: 0.012, lockBorder: false }));
    const map = mergeDocuments(doc, src);
    const holder = doc.createNode(key);
    for (const s of src.getRoot().listScenes()) {
      const ts = map.get(s);
      for (const n of ts.listChildren()) holder.addChild(n);
      ts.dispose();
    }
    scene.addChild(holder);
  }
  // merge buffers into one
  const buf = doc.getRoot().listBuffers()[0];
  for (const acc of doc.getRoot().listAccessors()) acc.setBuffer(buf);
  for (const b of doc.getRoot().listBuffers()) if (b !== buf) b.dispose();
  doc.getRoot().setDefaultScene(scene);
  await finish(doc, file);
}

// ------------------------------------------------------------------ 1. characters (KayKit, shared rig)
const HUMANOID_CLIPS = ['Idle', 'Idle_B', 'Idle_Combat', 'Unarmed_Idle', '2H_Melee_Idle', 'Walking_A', 'Walking_B', 'Walking_C', 'Walking_D_Skeletons', 'Walking_Backwards', 'Running_A', 'Running_B', 'Running_C',
  '1H_Melee_Attack_Chop', '1H_Melee_Attack_Slice_Diagonal', '1H_Melee_Attack_Slice_Horizontal', '1H_Melee_Attack_Stab', '1H_Melee_Attack_Jump_Chop',
  '2H_Melee_Attack_Chop', '2H_Melee_Attack_Slice', '2H_Melee_Attack_Spin', '2H_Melee_Attack_Spinning', '2H_Melee_Attack_Stab',
  'Dualwield_Melee_Attack_Chop', 'Dualwield_Melee_Attack_Slice', 'Dualwield_Melee_Attack_Stab', 'Unarmed_Melee_Attack_Punch_A', 'Unarmed_Melee_Attack_Kick',
  '1H_Ranged_Shoot', '2H_Ranged_Shoot', '2H_Ranged_Aiming', 'Throw', 'Spellcast_Shoot', 'Spellcast_Raise', 'Spellcast_Long', 'Spellcasting', 'Spellcast_Summon',
  'Block', 'Blocking', 'Block_Hit', 'Block_Attack', 'Dodge_Forward', 'Dodge_Backward', 'Dodge_Left', 'Dodge_Right', 'Hit_A', 'Hit_B', 'Death_A', 'Death_B', 'Death_C_Skeletons',
  'Jump_Start', 'Jump_Idle', 'Jump_Land', 'Jump_Full_Short', 'Cheer', 'Interact', 'PickUp', 'Use_Item', 'Taunt', 'Sit_Floor_Down', 'Sit_Floor_Idle', 'Sit_Chair_Idle', 'Lie_Idle',
  'Spawn_Ground_Skeletons', 'Skeletons_Awaken_Standing'];
async function characters() {
  console.log('characters');
  const dir = path.join(SRC, 'kaykit');
  const advs = ['Knight', 'Barbarian', 'Mage', 'Rogue', 'Rogue_Hooded'], skels = ['Skeleton_Mage', 'Skeleton_Minion', 'Skeleton_Rogue', 'Skeleton_Warrior'];
  for (const c of advs) await get(`${ADV}/${c}.glb`, path.join(dir, c + '.glb'));
  for (const c of skels) await get(`${SKEL}/${c}.glb`, path.join(dir, c + '.glb'));
  // weapons: every mesh hanging off a hand slot becomes its own pack entry (local transform = relative to the slot)
  const wdir = path.join(SRC, 'weapons'), wentries = [], seen = new Set();
  fs.mkdirSync(wdir, { recursive: true });
  for (const c of advs) {
    const probe = await io.read(path.join(dir, c + '.glb'));
    const names = probe.getRoot().listNodes().filter(n => /^handslot/.test(n.getName())).flatMap(h => h.listChildren().map(ch => ch.getName()));
    for (const wn of names) {
      if (seen.has(wn)) continue; seen.add(wn);
      const doc = await io.read(path.join(dir, c + '.glb'));
      stripAnims(doc);
      const scene = doc.getRoot().getDefaultScene() || doc.getRoot().listScenes()[0];
      const w = doc.getRoot().listNodes().find(n => n.getName() === wn);
      for (const n of doc.getRoot().listNodes()) if (n.listChildren().includes(w)) n.removeChild(w);
      for (const ch of scene.listChildren()) scene.removeChild(ch);
      scene.addChild(w);
      await doc.transform(prune());
      const f = path.join(wdir, wn + '.glb'); await io.write(f, doc);
      wentries.push([wn.toLowerCase(), f]);
    }
  }
  const SK = `${KK}/KayKit-Character-Pack-Skeletons-1.0/main/addons/kaykit_character_pack_skeletons/Assets/gltf`;
  for (const n of ['Skeleton_Axe', 'Skeleton_Blade', 'Skeleton_Crossbow', 'Skeleton_Staff', 'Skeleton_Shield_Large_A', 'Skeleton_Shield_Large_B', 'Skeleton_Shield_Small_A', 'Skeleton_Shield_Small_B', 'Skeleton_Quiver'])
    wentries.push([n.toLowerCase(), await getGltf(SK, n, path.join(SRC, 'skelweapons'))]);
  await buildPack(wentries, path.join(OUT, 'chars', 'weapons.glb'));
  for (const c of [...advs, ...skels]) {
    const doc = await io.read(path.join(dir, c + '.glb'));
    stripAnims(doc);
    // weapons live in weapons.glb now
    for (const h of doc.getRoot().listNodes().filter(n => /^handslot/.test(n.getName()))) for (const ch of h.listChildren()) { h.removeChild(ch); ch.dispose(); }
    // one draw call for the whole skinned body: merge the sibling part meshes (same skin & material)
    mergeSkinned(doc);
    await finish(doc, path.join(OUT, 'chars', c.toLowerCase() + '.glb'));
  }
  // one shared animation library (skeleton pack has the superset of clips)
  const doc = await io.read(path.join(dir, 'Skeleton_Minion.glb'));
  const keep = Object.fromEntries(HUMANOID_CLIPS.map(n => [n, n]));
  filterAnims(doc, keep);
  // drop control/IK bones (not skinned) and channels that never change (scale, most translations)
  const constant = acc => { const a = acc.getArray(), k = acc.getElementSize(); for (let i = k; i < a.length; i++) if (Math.abs(a[i] - a[i % k]) > 1e-4) return false; return true; };
  for (const an of doc.getRoot().listAnimations()) for (const c of an.listChannels()) {
    const n = c.getTargetNode()?.getName() || '', s = c.getSampler();
    if (/IK|control-/.test(n) || ((c.getTargetPath() === 'scale' || (c.getTargetPath() === 'translation' && !/^(root|hips)$/.test(n))) && constant(s.getOutput()))) { c.dispose(); if (!s.listParents().some(p => p.propertyType === 'AnimationChannel')) s.dispose(); }
  }
  for (const n of doc.getRoot().listNodes()) if (n.getMesh()) { n.setMesh(null); n.setSkin(null); }
  for (const m of doc.getRoot().listMeshes()) m.dispose();
  await finish(doc, path.join(OUT, 'chars', 'anims.glb'), { anim: true });
}

// ------------------------------------------------------------------ 2. creatures (Quaternius CC0)
const QUAD = { Idle: 'idle', Walk: 'walk', Gallop: 'run', Attack: 'attack', Attack_Headbutt: 'attack', Attack_Kick: 'attack2', Idle_HitReact_Left: 'hit', Death: 'death', Eating: 'eat', Gallop_Jump: 'jump' };
const FLY = { Flying_Idle: 'idle', Fast_Flying: 'run', Punch: 'attack', Headbutt: 'attack2', HitReact: 'hit', Death: 'death', Yes: 'emote' };
const BIPED = { Idle: 'idle', Walk: 'walk', Run: 'run', Punch: 'attack', Weapon: 'attack2', HitReact: 'hit', Death: 'death', Jump: 'jump', Wave: 'emote' };
const BLOB = { Idle: 'idle', Walk: 'walk', Bite_Front: 'attack', Bite_InPlace: 'attack2', HitRecieve: 'hit', Death: 'death', Jump: 'jump', Dance: 'emote' };
const pre = (p, m) => Object.fromEntries(Object.entries(m).map(([k, v]) => [p + k, v]));
const CREATURES = {
  wolf: [`${QS}/animals_pack/Wolf.glb`, QUAD], fox: [`${QS}/animals_pack/Fox.glb`, QUAD], stag: [`${QS}/animals_pack/Stag.glb`, QUAD], deer: [PP('4b6c2a41-43c7-404c-ae37-e8c4645ff93b'), QUAD],
  horse: [`${QS}/animals_pack/Horse.glb`, QUAD], horse_white: [`${QS}/animals_pack/Horse_White.glb`, QUAD], bull: [`${QS}/animals_pack/Bull.glb`, QUAD], cow: [`${QS}/animals_pack/Cow.glb`, QUAD],
  alpaca: [`${QS}/animals_pack/Alpaca.glb`, QUAD], donkey: [`${QS}/animals_pack/Donkey.glb`, QUAD], husky: [`${QS}/animals_pack/Husky.glb`, QUAD], shiba: [`${QS}/animals_pack/ShibaInu.glb`, QUAD],
  sheep: [PP('a4bd2c4e-fe71-4dbd-9881-cf3ac8a00bbf'), { Idle: 'idle', Jump: 'walk' }],
  rat: [PP('64cb7150-8031-44ab-a0c9-e1529a572b23'), pre('Rat_', { Idle: 'idle', Walk: 'walk', Run: 'run', Attack: 'attack', Death: 'death', Jump: 'jump' })],
  spider: [PP('4259fbdb-afb5-4d40-9108-363625dd6b6e'), pre('Spider_', { Idle: 'idle', Walk: 'walk', Attack: 'attack', Death: 'death', Jump: 'jump' })],
  bat: [PP('4ae13ae9-c257-41ed-86b5-1b4760924ebc'), pre('Bat_', { Flying: 'idle', Attack: 'attack', Attack2: 'attack2', Hit: 'hit', Death: 'death' })],
  wasp: [PP('71cadefd-8e65-423a-9a95-3cdf7e012586'), pre('Wasp_', { Flying: 'idle', Attack: 'attack', Death: 'death' })],
  frog: [PP('08416495-b056-4ed7-b23b-5a10e82277a0'), pre('Frog_', { Idle: 'idle', Jump: 'walk', Attack: 'attack', Death: 'death' })],
  snake: [PP('0f3a551e-743e-48f5-936f-804c6c3b88bd'), pre('Snake_', { Idle: 'idle', Walk: 'walk', Attack: 'attack', Jump: 'jump' })],
  crab: [PP('b9bbf6bd-2b21-4013-bc38-0f5e524ac12c'), BLOB],
  bunny: [PP('084b5ebe-c3eb-4e64-9b17-06e2d1e3da5d'), BIPED],
  imp: [PP('c2e39eb4-4b8e-4d31-b014-d637bf4e15c6'), FLY], demon: [PP('46b52ba4-5d2a-4fc8-85cc-3e980f199141'), BIPED],
  drake: [PP('ae5b8510-1fa5-4d53-b943-a4f3b88fb629'), FLY], dragon: [PP('90ed3740-d8c4-4910-88ce-ac2ed426022d'), FLY],
  ghost: [PP('810f60a2-6e45-4c4e-a0d5-da91cd7288bd'), FLY], ghost_skull: [PP('0716bf8e-1894-4a90-8d10-34868975a239'), FLY],
  slime: [PP('93e6c3e3-75f8-441f-86d0-b223f7829005'), BLOB], blob: [PP('64ab590e-1f77-4678-b357-78c430fd73bf'), BLOB],
  mushroom: [PP('798301fb-b950-460c-9c67-526621ad8500'), BIPED], mushnub: [PP('55c64684-49a4-4fcc-b393-113126add89b'), BLOB],
  yeti: [PP('40a831b3-686a-4af8-b189-a13b38a3c26a'), BIPED], orc: [PP('52a479b3-a635-4a23-92cb-6697eaa5eed5'), BIPED],
  zombie: [PP('cf4368cf-b39e-4c9a-8a83-a9c637740eb8'), { Idle: 'idle', Walk: 'walk', Run: 'run', Punch: 'attack', Run_Attack: 'attack2', HitReact: 'hit', Death: 'death', Jump: 'jump', Crawl: 'crawl' }],
  golem: [PP('d6308fbf-fa2e-4cfe-b235-def7ede1ab90'), FLY], tentacle: [PP('6500a805-0588-4823-bb8d-2f8ffdf338ab'), FLY],
  squid: [PP('cbe8419d-59d4-4ee8-92f1-8bccb25af378'), FLY], cactus: [PP('625862f9-590e-4fbd-88bc-9056047885dd'), BLOB],
};
async function creatures() {
  console.log('creatures');
  await pool(Object.entries(CREATURES), 6, async ([key, [url, map]]) => {
    const f = await get(url, path.join(SRC, 'mobs', key + '.glb'));
    const doc = await io.read(f);
    filterAnims(doc, map);
    // many flat-coloured materials -> one palette-textured material, then fewer draw calls
    await doc.transform(dedup(), palette({ min: 2 }));
    mergeMeshPrims(doc);
    mergeSkinned(doc);
    await finish(doc, path.join(OUT, 'mobs', key + '.glb'), { anim: true });
  });
}

// ------------------------------------------------------------------ 3. environment packs
const NATURE = ['CommonTree_1', 'CommonTree_2', 'CommonTree_3', 'CommonTree_4', 'CommonTree_5', 'CommonTree_Autumn_1', 'CommonTree_Autumn_2', 'CommonTree_Autumn_3', 'CommonTree_Snow_1', 'CommonTree_Snow_2', 'CommonTree_Snow_3',
  'CommonTree_Dead_1', 'CommonTree_Dead_2', 'CommonTree_Dead_3', 'CommonTree_Dead_Snow_1', 'BirchTree_1', 'BirchTree_2', 'BirchTree_3', 'BirchTree_Autumn_1', 'BirchTree_Autumn_2', 'BirchTree_Snow_1',
  'PineTree_1', 'PineTree_2', 'PineTree_3', 'PineTree_4', 'PineTree_5', 'PineTree_Snow_1', 'PineTree_Snow_2', 'PineTree_Snow_3', 'PineTree_Snow_4', 'PineTree_Autumn_1', 'PineTree_Autumn_2',
  'Willow_1', 'Willow_2', 'Willow_3', 'Willow_Dead_1', 'Willow_Dead_2', 'PalmTree_1', 'PalmTree_2', 'PalmTree_3', 'PalmTree_4', 'Cactus_1', 'Cactus_2', 'Cactus_3', 'Cactus_4', 'Cactus_5', 'CactusFlowers_2', 'CactusFlowers_3',
  'Bush_1', 'Bush_2', 'BushBerries_1', 'BushBerries_2', 'Bush_Snow_1', 'Bush_Snow_2', 'Rock_1', 'Rock_2', 'Rock_3', 'Rock_4', 'Rock_5', 'Rock_6', 'Rock_7', 'Rock_Moss_1', 'Rock_Moss_2', 'Rock_Moss_3', 'Rock_Moss_4',
  'Rock_Snow_1', 'Rock_Snow_2', 'Rock_Snow_3', 'Rock_Snow_4', 'TreeStump', 'TreeStump_Moss', 'TreeStump_Snow', 'Plant_1', 'Plant_2', 'Plant_3', 'Plant_4', 'Plant_5', 'Flowers', 'Grass', 'Grass_2', 'Grass_Short',
  'Lilypad', 'Wheat', 'Corn_1', 'WoodLog', 'WoodLog_Moss', 'WoodLog_Snow'];
const HEX_COLORS = ['blue', 'green', 'red', 'yellow'];
const HEX_BUILD = ['home_A', 'home_B', 'tavern', 'blacksmith', 'church', 'market', 'tower_A', 'tower_B', 'tower_base', 'well', 'windmill', 'watermill', 'barracks', 'castle', 'mine', 'lumbermill', 'archeryrange'];
const HEX_NEUTRAL = ['building_bridge_A', 'building_bridge_B', 'building_destroyed', 'building_scaffolding', 'building_stage_A', 'building_stage_B', 'building_stage_C', 'building_grain',
  'fence_stone_straight', 'fence_stone_straight_gate', 'fence_wood_straight', 'fence_wood_straight_gate', 'wall_straight', 'wall_straight_gate', 'wall_corner_A_inside', 'wall_corner_A_outside', 'wall_corner_B_inside', 'wall_corner_B_outside'];
const HEX_NATURE = ['mountain_A', 'mountain_B', 'mountain_C', 'mountain_A_grass', 'mountain_B_grass', 'mountain_C_grass', 'mountain_A_grass_trees', 'mountain_B_grass_trees', 'mountain_C_grass_trees',
  'hill_single_A', 'hill_single_B', 'hill_single_C', 'cloud_big', 'cloud_small', 'rock_single_A', 'rock_single_B', 'rock_single_C', 'rock_single_D', 'rock_single_E',
  'trees_A_large', 'trees_A_medium', 'trees_A_small', 'trees_B_large', 'trees_B_medium', 'trees_B_small', 'tree_single_A', 'tree_single_B', 'waterlily_A', 'waterplant_A', 'waterplant_B'];
const HEX_PROPS = ['barrel', 'bucket_arrows', 'bucket_water', 'crate_A_big', 'crate_A_small', 'crate_B_big', 'crate_long_A', 'crate_open', 'flag_blue', 'flag_green', 'flag_red', 'flag_yellow', 'ladder', 'pallet',
  'resource_lumber', 'resource_stone', 'sack', 'target', 'tent', 'weaponrack', 'wheelbarrow'];
const GRAVE = ['arch', 'arch_gate', 'bench', 'bone_A', 'bone_B', 'bone_C', 'candle_triple', 'coffin', 'coffin_decorated', 'crypt', 'fence', 'fence_broken', 'fence_gate', 'fence_pillar', 'grave_A', 'grave_B',
  'gravemarker_A', 'gravemarker_B', 'gravestone', 'lantern_hanging', 'lantern_standing', 'post_lantern', 'post_skull', 'ribcage', 'shrine', 'shrine_candles', 'skull', 'skull_candle',
  'tree_dead_large', 'tree_dead_large_decorated', 'tree_dead_medium', 'tree_dead_small', 'tree_pine_orange_large', 'tree_pine_orange_medium', 'tree_pine_yellow_large', 'tree_pine_yellow_medium'];
const DUNGEON = ['wall', 'wall_arched', 'wall_broken', 'wall_corner', 'wall_cracked', 'wall_doorway_sides', 'wall_endcap', 'wall_half', 'wall_pillar', 'wall_window_open', 'wall_shelves', 'wall_gated',
  'floor_tile_large', 'floor_tile_large_rocks', 'floor_tile_small', 'floor_tile_small_broken_A', 'floor_tile_small_decorated', 'floor_tile_small_weeds_A', 'floor_dirt_large', 'floor_dirt_large_rocky', 'floor_wood_large', 'floor_tile_big_grate',
  'pillar', 'pillar_decorated', 'column', 'torch_mounted', 'torch_lit', 'barrel_large', 'barrel_small', 'barrel_small_stack', 'box_large', 'box_stacked', 'crates_stacked', 'candle_lit', 'candle_triple',
  'banner_red', 'banner_blue', 'banner_green', 'banner_patternA_red', 'banner_patternB_blue', 'banner_shield_red', 'banner_triple_red', 'table_long_decorated_A', 'table_medium', 'chair', 'stool', 'shelves', 'rubble_large', 'rubble_half',
  'sword_shield', 'trunk_large_A', 'trunk_medium_A', 'keg', 'stairs', 'coin_stack_large', 'coin_stack_medium', 'bed_decorated', 'barrier', 'barrier_column', 'bottle_A_green', 'plate_food_A'];
const ITEMS_Q = ['Potion1_Filled', 'Potion2_Filled', 'Potion3_Filled', 'Potion4_Filled', 'Potion5_Filled', 'Potion6_Filled', 'Potion7_Filled', 'Potion8_Filled', 'Potion9_Filled', 'Potion10_Filled', 'Potion11_Filled',
  'Sword', 'Sword_Golden', 'Sword_big', 'Sword_big_Golden', 'Axe_small', 'Axe_Double', 'Axe_Double_Golden', 'Hammer_Double', 'Dagger', 'Dagger_Golden', 'Bow_Wooden', 'Bow_Golden', 'Arrow',
  'Armor_Leather', 'Armor_Metal', 'Armor_Metal2', 'Armor_Golden', 'Armor_Black', 'Glove', 'Crown', 'Crown2', 'Ring1', 'Ring2', 'Ring3', 'Ring4', 'Ring5', 'Necklace1', 'Necklace2', 'Necklace3',
  'Book1_Closed', 'Book2_Closed', 'Book3_Closed', 'Book4_Closed', 'Scroll', 'Parchment', 'Key1', 'Key3', 'Chest_Closed', 'Chest_Ingots', 'Coin', 'Coin_Star', 'Gold_Ingots', 'Mineral',
  'Crystal1', 'Crystal2', 'Crystal3', 'Skull', 'Bone', 'Heart', 'ChickenLeg', 'FishBone', 'Pouch', 'Bag', 'Backpack', 'Chalice', 'Star', 'Snowflake1', 'Padlock'];
const WEAPONS_Q = ['Axe', 'Bow_Evil', 'Claymore', 'Dagger_2', 'Hammer_Small', 'Scythe', 'Shield_Celtic_Golden', 'Shield_Heater', 'Shield_Round', 'Spear', 'Sword_2', 'Sword_Big', 'Sword_Golden'];
const SURV = ['Bonfire_Fire', 'Tent', 'WoodenTorch_Fire', 'Pot'];

async function env() {
  console.log('environment');
  const q = (pack, names, prefix = '') => pool(names, 8, async n => [prefix + n.toLowerCase(), await get(`${QS}/${pack}/${n}.glb`, path.join(SRC, 'q', pack, n + '.glb')).catch(e => { console.warn('  skip', n, e.message); return null; })]);
  const clean = list => list.filter(([, f]) => f);
  await buildPack(clean(await q('nature_pack', NATURE)), path.join(OUT, 'env', 'nature.glb'), { simplifyRe: /tree|willow|palm|cactus|bush|plant|flowers|wheat|corn|woodlog/, ratio: 0.45 });
  const hexDir = path.join(SRC, 'hex');
  const hex = [];
  for (const c of HEX_COLORS) for (const b of HEX_BUILD) hex.push([`${b.toLowerCase()}_${c}`, await getGltf(`${HEX}/buildings/${c}`, `building_${b}_${c}`, path.join(hexDir, c))]);
  for (const n of HEX_NEUTRAL) hex.push([n.replace('building_', '').toLowerCase(), await getGltf(`${HEX}/buildings/neutral`, n, path.join(hexDir, 'neutral'))]);
  for (const n of HEX_PROPS) hex.push([n.toLowerCase(), await getGltf(`${HEX}/decoration/props`, n, path.join(hexDir, 'props'))]);
  await buildPack(hex, path.join(OUT, 'env', 'town.glb'));
  const hexN = [];
  for (const n of HEX_NATURE) hexN.push([n.toLowerCase(), await getGltf(`${HEX}/decoration/nature`, n, path.join(hexDir, 'nature'))]);
  await buildPack(hexN, path.join(OUT, 'env', 'terrain.glb'));
  const gr = [];
  for (const n of GRAVE) gr.push([n.toLowerCase(), await getGltf(HAL, n, path.join(SRC, 'halloween'))]);
  await buildPack(gr, path.join(OUT, 'env', 'grave.glb'));
  const dn = [];
  for (const n of DUNGEON) dn.push([n.toLowerCase(), await get(`${DUN}/${n}.gltf.glb`, path.join(SRC, 'dungeon', n + '.glb'))]);
  await buildPack(dn, path.join(OUT, 'env', 'dungeon.glb'));
  const it = [...clean(await q('rpg_items_pack', ITEMS_Q, '')), ...clean(await q('medieval_weapons_pack', WEAPONS_Q, 'w_')), ...clean(await q('survival_pack', SURV, 's_'))];
  await buildPack(it, path.join(OUT, 'items', 'items.glb'));
}

// ------------------------------------------------------------------ KayKit Forest Nature Pack (itch.io free tier, CC0)
// Downloaded manually into tools/_src/itch/kaykit/forest (kaylousberg.itch.io/kaykit-forest).
const FOREST_DIR = path.join(SRC, 'itch/kaykit/forest/KayKit_Forest_Nature_Pack_1.0_FREE/Assets/gltf');
const FOREST = [
  'Tree_1_A', 'Tree_1_B', 'Tree_1_C', 'Tree_2_A', 'Tree_2_B', 'Tree_2_C', 'Tree_2_D', 'Tree_2_E', 'Tree_3_A', 'Tree_3_B', 'Tree_3_C', 'Tree_4_A', 'Tree_4_B', 'Tree_4_C',
  'Tree_Bare_1_A', 'Tree_Bare_1_B', 'Tree_Bare_1_C', 'Tree_Bare_2_A', 'Tree_Bare_2_B', 'Tree_Bare_2_C',
  'Bush_1_A', 'Bush_1_C', 'Bush_1_E', 'Bush_2_A', 'Bush_2_C', 'Bush_3_A', 'Bush_3_B', 'Bush_4_A', 'Bush_4_C', 'Bush_4_E',
  'Rock_1_A', 'Rock_1_C', 'Rock_1_E', 'Rock_1_G', 'Rock_1_J', 'Rock_1_M', 'Rock_2_A', 'Rock_2_C', 'Rock_2_E', 'Rock_2_G', 'Rock_3_A', 'Rock_3_C', 'Rock_3_E', 'Rock_3_H', 'Rock_3_K', 'Rock_3_N',
  'Grass_1_A', 'Grass_1_B', 'Grass_1_C', 'Grass_2_A', 'Grass_2_B', 'Grass_2_C'];
async function forest() {
  console.log('forest');
  const list = FOREST.map(n => [n.toLowerCase(), path.join(FOREST_DIR, n + '_Color1.gltf')]).filter(([, f]) => fs.existsSync(f) || console.warn('  missing', f));
  await buildPack(list, path.join(OUT, 'env', 'forest.glb'));
}

const only = process.argv[2];
if (!only || only === 'chars') await characters();
if (!only || only === 'mobs') await creatures();
if (!only || only === 'env') await env();
if (!only || only === 'env' || only === 'forest') await forest();
let total = 0; const walk = d => { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); if (fs.statSync(p).isDirectory()) walk(p); else total += fs.statSync(p).size; } };
walk(OUT); console.log('total', (total / 1048576).toFixed(2), 'MB');

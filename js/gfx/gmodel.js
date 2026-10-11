// glTF-based character & creature models (KayKit adventurers/skeletons, Quaternius creatures).
// A "look" describes which asset to use and how to dress/tint it; buildGModel returns the same
// model interface the procedural builder used ({mesh, rig, scale, height, radius, ...}) plus an
// animation controller that turns the game's anim state into blended animation clips.
import * as THREE from 'three';
import { Assets, recolorAtlas } from './assets.js';

export const ANIMS = 'chars/anims.glb', WEAPONS = 'chars/weapons.glb', ITEMS = 'items/items.glb';
// asset key -> [file, target height in world units, animation family]
export const ASSETS = {
  'char:knight': ['chars/knight.glb', 1.95, 'hum'], 'char:barbarian': ['chars/barbarian.glb', 1.95, 'hum'], 'char:mage': ['chars/mage.glb', 1.95, 'hum'],
  'char:rogue': ['chars/rogue.glb', 1.95, 'hum'], 'char:rogue_hooded': ['chars/rogue_hooded.glb', 1.95, 'hum'],
  'char:skeleton_mage': ['chars/skeleton_mage.glb', 1.95, 'hum'], 'char:skeleton_minion': ['chars/skeleton_minion.glb', 1.85, 'hum'],
  'char:skeleton_rogue': ['chars/skeleton_rogue.glb', 1.95, 'hum'], 'char:skeleton_warrior': ['chars/skeleton_warrior.glb', 1.95, 'hum'],
  'mob:wolf': ['mobs/wolf.glb', 1.25, 'quad'], 'mob:fox': ['mobs/fox.glb', 0.85, 'quad'], 'mob:deer': ['mobs/deer.glb', 1.7, 'quad'], 'mob:stag': ['mobs/stag.glb', 2.1, 'quad'],
  'mob:horse': ['mobs/horse.glb', 2.0, 'quad'], 'mob:horse_white': ['mobs/horse_white.glb', 2.0, 'quad'], 'mob:bull': ['mobs/bull.glb', 1.7, 'quad'], 'mob:cow': ['mobs/cow.glb', 1.6, 'quad'],
  'mob:sheep': ['mobs/sheep.glb', 1.1, 'quad'], 'mob:alpaca': ['mobs/alpaca.glb', 1.9, 'quad'], 'mob:donkey': ['mobs/donkey.glb', 1.6, 'quad'], 'mob:husky': ['mobs/husky.glb', 1.05, 'quad'],
  'mob:shiba': ['mobs/shiba.glb', 0.85, 'quad'], 'mob:rat': ['mobs/rat.glb', 0.45, 'quad'], 'mob:spider': ['mobs/spider.glb', 0.85, 'bug'], 'mob:bat': ['mobs/bat.glb', 0.9, 'fly'],
  'mob:wasp': ['mobs/wasp.glb', 0.9, 'fly'], 'mob:frog': ['mobs/frog.glb', 0.6, 'quad'], 'mob:snake': ['mobs/snake.glb', 0.55, 'quad'], 'mob:crab': ['mobs/crab.glb', 0.7, 'blob'],
  'mob:bunny': ['mobs/bunny.glb', 0.9, 'biped'], 'mob:imp': ['mobs/imp.glb', 1.5, 'fly'], 'mob:demon': ['mobs/demon.glb', 2.2, 'biped'], 'mob:drake': ['mobs/drake.glb', 2.2, 'fly'],
  'mob:dragon': ['mobs/dragon.glb', 3.0, 'fly'], 'mob:ghost': ['mobs/ghost.glb', 2.0, 'fly'], 'mob:ghost_skull': ['mobs/ghost_skull.glb', 2.0, 'fly'], 'mob:slime': ['mobs/slime.glb', 1.1, 'blob'],
  'mob:blob': ['mobs/blob.glb', 1.0, 'blob'], 'mob:mushroom': ['mobs/mushroom.glb', 1.6, 'biped'], 'mob:mushnub': ['mobs/mushnub.glb', 1.0, 'blob'], 'mob:yeti': ['mobs/yeti.glb', 2.4, 'biped'],
  'mob:orc': ['mobs/orc.glb', 2.0, 'biped'], 'mob:zombie': ['mobs/zombie.glb', 1.95, 'biped'], 'mob:golem': ['mobs/golem.glb', 2.0, 'fly'], 'mob:tentacle': ['mobs/tentacle.glb', 2.0, 'fly'],
  'mob:squid': ['mobs/squid.glb', 1.8, 'fly'], 'mob:cactus': ['mobs/cactus.glb', 1.4, 'blob'],
};
export const assetFile = key => ASSETS[key]?.[0];
export const lookReady = look => !!look && !!ASSETS[look.a] && Assets.isLoaded(ASSETS[look.a][0]) && (ASSETS[look.a][2] !== 'hum' || (Assets.isLoaded(ANIMS) && Assets.isLoaded(WEAPONS)));

// ------------------------------------------------------------------ humanoid clip selection
const UPPER = new Set(['spine', 'chest', 'upperarm.l', 'lowerarm.l', 'wrist.l', 'hand.l', 'handslot.l', 'upperarm.r', 'lowerarm.r', 'wrist.r', 'hand.r', 'handslot.r', 'head']);
const LOWER = new Set(['root', 'hips', 'upperleg.l', 'lowerleg.l', 'foot.l', 'toes.l', 'upperleg.r', 'lowerleg.r', 'foot.r', 'toes.r']);
let _humClips = null;
function humClips() {
  if (_humClips) return _humClips;
  const all = Assets.clips(ANIMS);
  const full = new Map(), upper = new Map(), lower = new Map();
  const filt = (c, set, tag) => new THREE.AnimationClip(c.name + tag, c.duration, c.tracks.filter(t => set.has(t.name.slice(0, t.name.lastIndexOf('.')))));
  for (const c of all) { full.set(c.name, c); upper.set(c.name, filt(c, UPPER, '#u')); lower.set(c.name, filt(c, LOWER, '#l')); }
  _humClips = { full, upper, lower };
  return _humClips;
}
// game action -> KayKit clip (weapon style aware)
function humActClip(type, style, ex) {
  const two = style === '2h', dual = style === 'dual', staff = style === 'staff', ranged = style === 'bow' || style === 'xbow';
  switch (type) {
    case 'slash': return dual ? 'Dualwield_Melee_Attack_Slice' : two ? '2H_Melee_Attack_Slice' : staff ? '2H_Melee_Attack_Slice' : '1H_Melee_Attack_Slice_Diagonal';
    case 'slash2': return dual ? 'Dualwield_Melee_Attack_Chop' : two ? '2H_Melee_Attack_Chop' : '1H_Melee_Attack_Slice_Horizontal';
    case 'overhead': return two || staff ? '2H_Melee_Attack_Chop' : '1H_Melee_Attack_Chop';
    case 'thrust': return dual ? 'Dualwield_Melee_Attack_Stab' : two ? '2H_Melee_Attack_Stab' : '1H_Melee_Attack_Stab';
    case 'dual': return 'Dualwield_Melee_Attack_Slice';
    case 'spin': return ex?.turns > 1 ? '2H_Melee_Attack_Spinning' : '2H_Melee_Attack_Spin';
    case 'slam': return '1H_Melee_Attack_Jump_Chop';
    case 'leap': return '1H_Melee_Attack_Jump_Chop';
    case 'block': return 'Block';
    case 'roar': return 'Taunt';
    case 'bite': return 'Unarmed_Melee_Attack_Punch_A';
    case 'kick': return 'Unarmed_Melee_Attack_Kick';
    case 'throw': return 'Throw';
    case 'raise': return 'Spellcast_Raise';
    case 'summon': return 'Spellcast_Summon';
    case 'release': case 'cast': return ranged ? (style === 'bow' ? '2H_Ranged_Shoot' : '1H_Ranged_Shoot') : 'Spellcast_Shoot';
    case 'bow': return style === 'xbow' ? '1H_Ranged_Shoot' : '2H_Ranged_Shoot';
    case 'roll': return 'Dodge_Forward';
    case 'pick': return 'PickUp';
    case 'gather': return 'Interact';
    case 'fish': return 'Interact';
    case 'drink': return 'Use_Item';
    case 'breath': case 'tail': return 'Taunt';
    default: return two ? '2H_Melee_Attack_Slice' : '1H_Melee_Attack_Slice_Diagonal';
  }
}
const EMOTE_CLIP = { wave: 'Cheer', dance: 'Cheer', cheer: 'Cheer', bow: 'Interact', point: 'Interact', laugh: 'Taunt', salute: 'Cheer', kneel: 'Sit_Floor_Idle' };
// creature family action mapping (standardised names from tools/build-assets.mjs)
function mobActClip(type) {
  switch (type) {
    case 'slam': case 'overhead': case 'roar': case 'tail': case 'breath': case 'raise': case 'throw': case 'spin': return ['attack2', 'attack'];
    case 'leap': return ['jump', 'attack'];
    default: return ['attack', 'attack2'];
  }
}

// ------------------------------------------------------------------ animation controller
class AnimCtl {
  constructor(root, family, clips, model) {
    this.mixer = new THREE.AnimationMixer(root);
    this.family = family; this.model = model;
    this.hum = family === 'hum';
    this.mob = this.hum ? null : new Map(clips.map(c => [c.name, c]));
    this.actions = new Map();
    this.base = null; this.baseKey = ''; this.upper = null; this.full = null; this._act = null; this._hit = 0; this._dead = false;
  }
  action(clip) {
    let a = this.actions.get(clip);
    if (!a) { a = this.mixer.clipAction(clip); this.actions.set(clip, a); }
    return a;
  }
  clip(name, part) {
    if (this.hum) { const H = humClips(); return (part === 'u' ? H.upper : part === 'l' ? H.lower : H.full).get(name) || null; }
    return this.mob.get(name) || null;
  }
  has(name) { return !!this.clip(name); }
  // crossfade the looping base layer
  setBase(name, part, timeScale = 1, fade = 0.2) {
    const key = name + '|' + part;
    const clip = this.clip(name, part); if (!clip) return;
    const a = this.action(clip);
    a.timeScale = timeScale;
    if (key === this.baseKey) return;
    a.reset(); a.setLoop(THREE.LoopRepeat, Infinity); a.clampWhenFinished = false; a.enabled = true;
    a.setEffectiveWeight(1); a.fadeIn(fade); a.play();
    if (this.base && this.base !== a) this.base.fadeOut(fade);
    // keep the gait phase when only the body part changes
    if (this.base && this.baseKey.split('|')[0] === name) a.time = this.base.time;
    this.base = a; this.baseKey = key;
  }
  // one-shot layer (full body or upper body while moving)
  playOnce(name, part, dur, fade = 0.08) {
    const clip = this.clip(name, part); if (!clip) return null;
    const a = this.action(clip);
    a.reset(); a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = true; a.enabled = true;
    a.timeScale = dur ? THREE.MathUtils.clamp(clip.duration / dur, 0.55, 2.6) : 1;
    a.setEffectiveWeight(1); a.fadeIn(fade); a.play();
    return a;
  }
  stopOnce(fade = 0.15) {
    if (this.full) { this.full.fadeOut(fade); this.full = null; }
    if (this.upper) { this.upper.fadeOut(fade); this.upper = null; }
  }
  update(a, dt) {
    const m = this.model;
    // ---------------- death
    if (a.dead > 0) {
      if (!this._dead) {
        this._dead = true; this.stopOnce(0.1);
        const name = this.hum ? (Math.random() < 0.5 ? 'Death_A' : 'Death_B') : 'death';
        const clip = this.clip(name, ''); if (clip) {
          const act = this.action(clip); act.reset(); act.setLoop(THREE.LoopOnce, 1); act.clampWhenFinished = true; act.fadeIn(0.12); act.play();
          if (this.base) this.base.fadeOut(0.12); this.base = act; this.baseKey = 'death';
        } else if (!this.hum) { this._sink = true; }
      }
      if (this._sink) m.inner.rotation.z = Math.min(Math.PI / 2, m.inner.rotation.z + dt * 4);
      this.mixer.update(dt);
      return;
    }
    if (this._dead) { this._dead = false; this._sink = false; m.inner.rotation.z = 0; this.baseKey = ''; }
    const moving = a.move > 0.08;
    const style = m.style;
    // ---------------- base layer
    let bName, bPart = '', bTs = 1;
    if (this.hum) {
      if (a.ride) bName = 'Sit_Chair_Idle';
      else if (a.sit) bName = 'Sit_Floor_Idle';
      else if (a.swim) { bName = 'Running_B'; bTs = 0.55; }
      else if ((m.unit?.airY || 0) > 0.05) bName = 'Jump_Idle';
      else if (a.stun) { bName = 'Hit_B'; bTs = 0.4; }
      else if (moving) {
        const run = a.run || a.move > 0.8;
        bName = run ? 'Running_A' : 'Walking_A';
        bTs = run ? THREE.MathUtils.clamp(a.move * 1.05, 0.7, 1.6) : THREE.MathUtils.clamp(a.move * 1.6, 0.6, 1.4);
        if (a.move > 1.3) { bName = 'Running_B'; }
      } else if (a.cast) bName = a.cast === 'bow' ? '2H_Ranged_Aiming' : 'Spellcasting';
      else if (a.emote) bName = EMOTE_CLIP[a.emote.type] || 'Cheer';
      else bName = m.combatIdle && m.unit?.inCombat ? (style === '2h' ? '2H_Melee_Idle' : 'Idle') : 'Idle';
      // while an upper-body action plays over locomotion, only the legs come from the base clip
      if (this.upper && moving) bPart = 'l';
    } else {
      const fam = this.family;
      if (a.dead > 0) bName = 'death';
      else if (fam === 'fly') bName = moving && a.move > 0.5 && this.has('run') ? 'run' : 'idle';
      else if (moving) { const run = (a.run || a.move > 0.75) && this.has('run'); bName = run ? 'run' : (this.has('walk') ? 'walk' : 'idle'); bTs = THREE.MathUtils.clamp(a.move * (run ? 1.0 : 1.5), 0.6, 1.8) / (m.scale ** 0.35); }
      else if (a.emote && this.has('emote')) bName = 'emote';
      else bName = 'idle';
    }
    this.setBase(bName, bPart, bTs);
    // ---------------- actions
    if (a.act && a.act !== this._act) {
      this._act = a.act;
      this.stopOnce(0.06);
      if (this.hum) {
        const name = humActClip(a.act.type, style, a.act);
        if (moving && !['roll', 'leap', 'slam', 'spin'].includes(a.act.type)) { this.upper = this.playOnce(name, 'u', a.act.dur); this.setBase(bName, 'l', bTs, 0.08); }
        else this.full = this.playOnce(name, '', a.act.dur);
      } else {
        const name = mobActClip(a.act.type).find(n => this.has(n));
        if (name) this.full = this.playOnce(name, '', a.act.dur);
      }
      if (this.full && this.base) this.base.setEffectiveWeight(0.0001);
    }
    if (!a.act && this._act) { this._act = null; this.stopOnce(0.18); if (this.base) { this.base.setEffectiveWeight(1); } if (this.hum) this.setBase(bName, '', bTs, 0.18); }
    // finished one-shots hand back to the base layer
    for (const k of ['full', 'upper']) { const x = this[k]; if (x && x.time >= x.getClip().duration - 1e-3 && !a.act) { x.fadeOut(0.18); this[k] = null; } }
    if (!this.full && this.base && this.base.getEffectiveWeight() < 0.5 && this.base.weight < 1) this.base.setEffectiveWeight(1);
    // flinch when hit (only if nothing else is playing)
    if (a.hit > 0.7 && !this.full && !this.upper && !a.cast && this._hit <= 0) {
      this._hit = 0.6;
      const hn = this.hum ? (Math.random() < 0.5 ? 'Hit_A' : 'Hit_B') : 'hit';
      if (this.has(hn)) { this.full = this.playOnce(hn, moving && this.hum ? 'u' : '', 0.45, 0.05); if (this.full && moving && this.hum) { this.upper = this.full; this.full = null; this.setBase(bName, 'l', bTs, 0.05); } }
    }
    this._hit -= dt;
    this.mixer.update(dt);
  }
}

// ------------------------------------------------------------------ build
const _box = new THREE.Box3(), _v = new THREE.Vector3();
const sizeCache = new Map();
function measure(key, obj) {
  if (sizeCache.has(key)) return sizeCache.get(key);
  obj.updateMatrixWorld(true);
  _box.makeEmpty();
  obj.traverse(o => {
    if (!o.isMesh || !o.visible) return;
    let b;
    // skinned meshes: bounds of the posed (bind) vertices in mesh space, not the raw geometry
    if (o.isSkinnedMesh) { o.computeBoundingBox(); b = o.boundingBox.clone(); }
    else { o.geometry.computeBoundingBox(); b = o.geometry.boundingBox.clone(); }
    _box.union(b.applyMatrix4(o.matrixWorld));
  });
  const s = _box.getSize(new THREE.Vector3());
  const r = { h: s.y || 1, w: Math.max(s.x, s.z) || 1, minY: _box.min.y };
  sizeCache.set(key, r);
  return r;
}

const WEAPON_STYLE = { '2h_sword': '2h', '2h_axe': '2h', '2h_staff': 'staff', skeleton_staff: 'staff', '2h_crossbow': 'xbow', '1h_crossbow': 'xbow', skeleton_crossbow: 'xbow', bow: 'bow' };
// extra (non-KayKit) weapons from the items pack: [item node, hand, position, euler, scale]
const ITEM_WEAPONS = {
  bow: ['bow_wooden', 'l', [0, 0.05, 0], [0, Math.PI / 2, 0], 0.55], bow_golden: ['bow_golden', 'l', [0, 0.05, 0], [0, Math.PI / 2, 0], 0.55],
  hammer: ['w_hammer_small', 'r', [0, -0.05, 0], [Math.PI, 0, 0], 0.5], mace: ['w_hammer_small', 'r', [0, -0.05, 0], [Math.PI, 0, 0], 0.5],
  scythe: ['w_scythe', 'r', [0, -0.25, 0], [Math.PI, 0, 0], 0.55], spear: ['w_spear', 'r', [0, -0.3, 0], [Math.PI, 0, 0], 0.6],
  orb: ['crystal2', 'l', [0, 0.12, 0], [0, 0, 0], 0.45],
  claymore: ['w_claymore', 'r', [0, -0.05, 0], [Math.PI, 0, 0], 0.5], golden_sword: ['w_sword_golden', 'r', [0, -0.05, 0], [Math.PI, 0, 0], 0.5],
};

function cloneMaterials(root) {
  const mats = [];
  root.traverse(o => {
    if (!o.isMesh) return;
    o.material = Array.isArray(o.material) ? o.material.map(m => m.clone()) : o.material.clone();
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) mats.push(m);
  });
  return mats;
}

export function buildGModel(look, spec = {}) {
  const [file, targetH, family] = ASSETS[look.a];
  const src = Assets.loaded(file).scene;
  const inner = Assets.clone(src);
  inner.name = look.a;
  const mats = cloneMaterials(inner);
  // ---- dressing (humanoids)
  let style = '1h';
  if (family === 'hum') {
    inner.traverse(o => {
      if (!o.isMesh || o.isSkinnedMesh) return;
      const n = o.name;
      if (/Hat|Helmet|Hood$/.test(n)) o.visible = look.hat !== false;
      if (/Cape|Cloak/.test(n) && !o.isSkinnedMesh) o.visible = look.cape !== false;
    });
    // palette recolor (skin / outfit) on the shared atlas
    if (look.skin != null || look.outfit != null) {
      const key = `${look.skin ?? 'x'}|${look.outfit ?? 'x'}|${look.outfitSat ?? 1}|${look.dark ?? 0}`;
      for (const m of mats) if (m.map && m.map.image) m.map = recolorAtlas(m.map, { skin: look.skin, outfit: look.outfit, outfitSat: look.outfitSat, dark: look.dark }, key);
    }
    const slotR = inner.getObjectByName('handslot.r'), slotL = inner.getObjectByName('handslot.l');
    const attach = (name, slot) => {
      if (!name || !slot) return;
      const iw = ITEM_WEAPONS[name];
      if (iw && Assets.isLoaded(ITEMS)) {
        const t = Assets.template(ITEMS, iw[0]); if (!t) return;
        const w = t.clone(true); const s = iw === undefined ? 1 : iw[4];
        w.position.set(...iw[2]); w.rotation.set(...iw[3]); w.scale.setScalar(s);
        (iw[1] === 'l' ? slotL : slotR).add(w); w.traverse(o => { if (o.isMesh) { o.castShadow = true; mats.push(...[o.material = o.material.clone()]); } });
        return;
      }
      const t = Assets.template(WEAPONS, name); if (!t) return;
      const w = t.clone(true);
      // KayKit skeleton weapons are modelled at the origin; right hand ones need the same flip as the adventurers' weapons
      if (/^skeleton_/.test(name) && slot === slotR) w.rotation.y = Math.PI;
      slot.add(w);
      w.traverse(o => { if (o.isMesh) { o.castShadow = true; o.material = o.material.clone(); mats.push(o.material); } });
    };
    attach(look.r, slotR); attach(look.l, slotL);
    style = WEAPON_STYLE[look.r] || (look.r && look.l && /knife|axe_offhand|sword_offhand/.test(look.l) ? 'dual' : (look.l === 'bow' ? 'bow' : '1h'));
  }
  // ---- tint & glow (creatures, special humanoids)
  if (look.tint != null) {
    const tc = new THREE.Color(look.tint), amt = look.tintAmt ?? 0.55;
    for (const m of mats) { if (m.name === 'Glow') continue; m.color.lerp(tc, amt); }
  }
  if (look.mul != null) { const mc = new THREE.Color(look.mul); for (const m of mats) m.color.multiply(mc); }
  if (look.glow != null) for (const m of mats) if (m.name === 'Glow' || /eye/i.test(m.name)) { m.emissive = new THREE.Color(look.glow); m.emissiveIntensity = 2.2; }
  if (look.emissive != null) for (const m of mats) { m.emissive = new THREE.Color(look.emissive); m.emissiveIntensity = look.emissiveI ?? 0.5; }
  if (look.opacity != null) for (const m of mats) { m.transparent = true; m.opacity = look.opacity; m.depthWrite = false; }
  for (const m of mats) { m.userData.baseEmissive = m.emissive ? m.emissive.clone() : new THREE.Color(0); if (!m.emissive) m.emissive = new THREE.Color(0); }
  // ---- size
  const sz = measure(look.a, src);
  const scale = (targetH / sz.h) * (look.scale ?? 1) * (spec.scale ?? 1);
  const root = new THREE.Group();
  const holder = new THREE.Group(); // for death-sink fallback rotations
  inner.scale.setScalar(scale);
  inner.position.y = -sz.minY * scale + (look.y ?? 0);
  if (look.sx) inner.scale.x *= look.sx;
  holder.add(inner); root.add(holder);
  root.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = false; o.frustumCulled = !o.isSkinnedMesh; } });
  const height = sz.h * scale, radius = sz.w * scale * 0.4;
  const model = {
    gltf: true, rig: family === 'hum' ? 'humanoid' : family, look, mesh: root, inner: holder, materials: mats, style,
    scale: (look.scale ?? 1) * (spec.scale ?? 1), height, radius: Math.max(0.35, radius), saddleY: height * 0.62 / ((look.scale ?? 1) * (spec.scale ?? 1)),
    head: inner.getObjectByName('head') || null,
    bones: [], rest: [],
    setFlash(v) { for (const m of mats) m.emissive.copy(m.userData.baseEmissive).addScalar(v * 0.8); },
    dispose() { root.removeFromParent(); this.anim.mixer.stopAllAction(); },
  };
  const clips = family === 'hum' ? Assets.clips(ANIMS) : Assets.loaded(file).animations;
  model.anim = new AnimCtl(inner, family, clips, model);
  return model;
}

export function updateGModel(model, a, dt) { model.anim.update(a, dt); }

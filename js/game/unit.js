// Unit: anything that lives in the world (players, bots, monsters, NPCs, pets, critters).
import * as THREE from 'three';
import { G } from '../core/state.js';
import { clamp, dampAngle, uid, angleDiff } from '../core/util.js';
import { buildModel, disposeModel as disposeProc } from '../gfx/models.js';
import { buildGModel, lookReady, ASSETS, ANIMS, WEAPONS } from '../gfx/gmodel.js';
import { Assets } from '../gfx/assets.js';
import { resolveLook } from '../data/looks.js';
// glTF models when their assets are loaded, procedural otherwise (then swapped in once loaded)
export function makeModel(spec, onLater) {
  const look = resolveLook(spec);
  if (look && ASSETS[look.a]) {
    if (lookReady(look)) { try { return buildGModel(look, spec); } catch (e) { console.warn('model', look.a, e); } }
    else if (onLater) Assets.preload([ASSETS[look.a][0], ...(ASSETS[look.a][2] === 'hum' ? [ANIMS, WEAPONS] : [])]).then(onLater, () => {});
  }
  return buildModel(spec);
}
const disposeModel = m => { if (!m) return; if (m.gltf) m.dispose(); else disposeProc(m); };
import { createAnimState, updateAnim, playAct } from '../gfx/anim.js';
import { blobShadowMaterial } from '../gfx/materials.js';
import { RES } from '../data/classes.js';

const _shadowGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);

export class Unit {
  constructor(o = {}) {
    this.id = o.id || uid('u');
    this.kind = o.kind || 'monster';      // player | bot | monster | npc | pet | critter | remote
    this.team = o.team || (this.kind === 'monster' ? 'enemy' : this.kind === 'critter' || this.kind === 'npc' ? 'neutral' : 'player');
    this.name = o.name || '???';
    this.level = o.level || 1;
    this.pos = new THREE.Vector3(o.x || 0, 0, o.z || 0);
    this.yaw = o.yaw || 0;
    this.vel = new THREE.Vector3();       // external impulses (knockback)
    this.radius = o.radius || 0.5;
    this.height = 2;
    this.speed = o.speed || 6;            // base move speed (units/sec)
    this.stats = { maxHp: 100, maxRes: 100, power: 10, armor: 0, crit: 5, critDmg: 50, haste: 0, dodge: 0, block: 0, leech: 0, speed: 100, hpRegen: 0, dmgPct: 0, dmgTakenPct: 0, healPct: 0 };
    this.hp = 100; this.res = 0; this.resType = o.resType || null;
    this.buffs = [];
    this.cds = {}; this.gcd = 0;
    this.cast = null;                     // {skill, t, dur, target, ground, channel}
    this.target = null;
    this.threat = new Map();
    this.combatT = 99;                    // seconds since last combat action
    this.dead = false; this.deathT = 0;
    this.absorb = 0;
    this.combo = 0;                       // rogue combo points
    this.summons = [];
    this.owner = o.owner || null;
    this.ai = null;
    this.moving = false; this.moveDir = new THREE.Vector3();
    this.group = new THREE.Group();
    this.group.userData.unit = this;
    this.anim = createAnimState();
    this.model = null; this.mount = null;
    this.flash = 0;
    this.visible = true;
    this.interact = o.interact || null;   // npc interaction handler id
    this.data = o.data || {};
    this.vy = 0; this.airY = 0;           // jump
    // blob shadow
    this.shadow = new THREE.Mesh(_shadowGeo, blobShadowMaterial());
    this.shadow.renderOrder = 1;
    this.group.add(this.shadow);
    if (o.model) this.setModel(o.model);
  }

  setModel(spec) {
    if (this.model) disposeModel(this.model);
    this.modelSpec = spec;
    this.model = makeModel(spec, () => { if (!this.removed && this.modelSpec === spec) this.setModel(spec); });
    this.model.unit = this;
    this.group.add(this.model.mesh);
    this.height = this.model.height || 2;
    this.radius = Math.max(0.35, (this.model.radius || 0.5) * 0.9);
    const sr = Math.max(0.9, this.radius * 2.4);
    this.shadow.scale.set(sr, 1, sr);
    if (this.mount) this._placeRider();
  }
  setMount(spec) {
    if (this.mount) { disposeModel(this.mount); this.mount = null; this.mountAnim = null; }
    if (spec) {
      this.mount = makeModel(spec);
      this.mountAnim = createAnimState();
      this.group.add(this.mount.mesh);
      this.anim.ride = true;
    } else this.anim.ride = false;
    this._placeRider();
  }
  _placeRider() {
    if (!this.model) return;
    if (this.mount) {
      const sy = (this.mount.saddleY || 1.1) * (this.mount.scale || 1);
      this.model.mesh.position.set(0, sy - (this.model.gltf ? this.model.height * 0.33 : 0.62 * (this.model.scale || 1)), this.model.gltf && this.mount.gltf ? 0.28 : -0.1);
    } else this.model.mesh.position.set(0, 0, 0);
  }

  get alive() { return !this.dead; }
  get hpPct() { return this.stats.maxHp ? this.hp / this.stats.maxHp : 0; }
  get inCombat() { return this.combatT < 5; }
  get isHero() { return this.kind === 'player' || this.kind === 'bot' || this.kind === 'remote'; }
  get resInfo() { return RES[this.resType]; }

  isEnemy(u) {
    if (!u || u === this) return false;
    if (this.team === 'neutral' || u.team === 'neutral' || this.team === 'remote' || u.team === 'remote') return false;
    if (this.team === 'arenaA' || this.team === 'arenaB') return u.team !== this.team && (u.team === 'arenaA' || u.team === 'arenaB');
    return this.team !== u.team;
  }
  isFriend(u) { return u && !this.isEnemy(u) && u.team === this.team; }

  // ---------------- buffs
  hasFlag(f) { for (const b of this.buffs) if (b.flags && b.flags[f]) return b.flags[f]; return 0; }
  getBuff(id) { return this.buffs.find(b => b.id === id); }
  hasBuff(id) { return this.buffs.some(b => b.id === id); }
  removeBuff(id) {
    const i = this.buffs.findIndex(b => b.id === id);
    if (i >= 0) { const b = this.buffs[i]; this.buffs.splice(i, 1); b.onExpire?.(this, b); this.recalc(); }
  }
  dispel(debuff = true, count = 1) {
    let n = 0;
    for (let i = this.buffs.length - 1; i >= 0 && n < count; i--) {
      const b = this.buffs[i];
      if (!!b.debuff === debuff && !b.noDispel) { this.buffs.splice(i, 1); b.onExpire?.(this, b); n++; }
    }
    if (n) this.recalc();
    return n;
  }
  get stunned() { return this.hasFlag('stun') || this.hasFlag('fear') || this.hasFlag('sleep'); }
  get rooted() { return this.hasFlag('root') || this.stunned; }
  get silenced() { return this.hasFlag('silence') || this.stunned; }

  // recompute stats (overridden by heroes/monsters)
  recalc() { G.stats?.recalc(this); }

  // ---------------- movement helpers
  faceTo(x, z, dt = 0, rate = 14) {
    const a = Math.atan2(x - this.pos.x, z - this.pos.z);
    this.yaw = dt ? dampAngle(this.yaw, a, rate, dt) : a;
  }
  distTo(u) { const dx = u.pos.x - this.pos.x, dz = u.pos.z - this.pos.z; return Math.sqrt(dx * dx + dz * dz); }
  edgeDist(u) { return Math.max(0, this.distTo(u) - this.radius - u.radius); }
  get moveSpeed() {
    let s = this.speed * (this.stats.speed / 100);
    const slow = this.hasFlag('slow'); if (slow) s *= (1 - Math.min(0.8, slow));
    if (this.mount) s *= this.mountSpeed || 1.6;
    if (this.powers?.has('pw_speed') && !this.inCombat) s *= 1.25;
    if (this.anim.swim) s *= 0.65;
    if (this.cast && !this.cast.canMove) s *= 0;
    return s;
  }
  // move by vector (world units), with collision
  step(dx, dz) {
    const w = G.world; if (!w) return;
    const nx = this.pos.x + dx, nz = this.pos.z + dz;
    const r = w.resolve(nx, nz, this.radius * 0.8, this.pos.x, this.pos.z, this);
    this.pos.x = r.x; this.pos.z = r.z;
  }

  // ---------------- per-frame
  update(dt) {
    // buffs
    for (let i = this.buffs.length - 1; i >= 0; i--) {
      const b = this.buffs[i];
      if (b.interval && b.tick) {
        b._acc = (b._acc || 0) + dt;
        while (b._acc >= b.interval && !this.dead) { b._acc -= b.interval; b.tick(this, b); }
      }
      if (b.dur !== Infinity) {
        b.left -= dt;
        if (b.left <= 0) { this.buffs.splice(i, 1); b.onExpire?.(this, b); this.recalc(); }
      }
    }
    if (this.dead) { this.deathT += dt; this.anim.dead = Math.min(1, this.deathT * 1.6); }
    else {
      this.combatT += dt;
      this.regen(dt);
      for (const k in this.cds) { this.cds[k] -= dt; if (this.cds[k] <= 0) delete this.cds[k]; }
      this.gcd = Math.max(0, this.gcd - dt);
    }
    // knockback velocity
    if (this.vel.lengthSq() > 0.01) {
      this.step(this.vel.x * dt, this.vel.z * dt);
      this.vel.multiplyScalar(Math.max(0, 1 - dt * 6));
    }
    // ground / jump
    const w = G.world;
    if (w) {
      const gh = w.groundAt(this.pos.x, this.pos.z, this);
      const water = w.waterLevel ?? -999;
      const swimY = water - 1.15 * (this.model?.scale || 1);
      if (this.airY > 0 || this.vy > 0) { this.vy -= 22 * dt; this.airY = Math.max(0, this.airY + this.vy * dt); if (this.airY <= 0) this.vy = 0; }
      let y = gh;
      const canSwim = this.isHero || this.kind === 'pet';
      this.anim.swim = canSwim && !this.mount && gh < swimY - 0.05 && !w.lava;
      if (this.anim.swim) y = swimY;
      if (this.kind === 'monster' && this.data.fly) y = gh + 0.5;
      this.pos.y = y + this.airY;
    }
    // visuals
    this.group.position.copy(this.pos);
    this.group.rotation.y = this.yaw;
    if (this.shadow) { this.shadow.position.y = 0.06 - this.airY + (this.anim.swim ? 99 : 0); this.shadow.visible = !this.anim.swim; }
    if (this.model && this.visible) {
      this.anim.stun = this.stunned;
      updateAnim(this.model, this.anim, dt);
      if (this.mount) {
        this.mountAnim.move = this.anim.move; this.mountAnim.run = true; this.mountAnim.phase = this.anim.phase * 0.8;
        updateAnim(this.mount, this.mountAnim, dt);
      }
      // hit flash
      const md = this.model;
      if (md.gltf) {
        if (this.flash > 0) { this.flash = Math.max(0, this.flash - dt * 5); md.setFlash(this.flash); md._fl = true; }
        else if (md._fl) { md.setFlash(0); md._fl = false; }
      } else if (this.flash > 0) {
        this.flash = Math.max(0, this.flash - dt * 5);
        md.mesh.material.emissive.setRGB(this.flash * 0.9, this.flash * 0.85, this.flash * 0.8);
      } else if (md.mesh.material.emissive.r !== 0 && !this._glowE) md.mesh.material.emissive.setRGB(0, 0, 0);
      // stealth transparency
      const st = this.hasFlag('stealth');
      if (st !== !!md._st) {
        md._st = st;
        const mats = md.gltf ? md.materials : [md.mesh.material];
        for (const m of mats) {
          if (st) { m.userData.t0 = m.transparent; m.userData.o0 = m.opacity; m.transparent = true; m.opacity = this.kind === 'player' ? 0.45 : 0.2; }
          else { m.transparent = !!m.userData.t0; m.opacity = m.userData.o0 ?? 1; }
          m.needsUpdate = true;
        }
      }
    }
  }

  regen(dt) {
    const s = this.stats;
    const ooc = !this.inCombat;
    if (this.hp < s.maxHp) this.hp = Math.min(s.maxHp, this.hp + (s.hpRegen || 0) * (ooc ? 4 : 1) * dt + (ooc && this.isHero ? s.maxHp * 0.012 * dt : 0));
    const R = RES[this.resType];
    if (!R) return;
    if (this.resType === 'mana') this.res = Math.min(s.maxRes, this.res + s.maxRes * (ooc ? R.ooc : R.regen) * (1 + (s.manaRegen || 0) / 100) * dt);
    else if (this.resType === 'rage') { if (ooc) this.res = Math.max(0, this.res - R.decay * dt); }
    else this.res = Math.min(s.maxRes, this.res + R.regen * (1 + (s.haste || 0) / 100) * dt * (ooc ? 1.5 : 1));
  }

  playAct(type, dur = 0.5, extra) { playAct(this.anim, type, dur, extra); }

  enterCombat() { this.combatT = 0; }

  destroy() {
    if (this.model) disposeModel(this.model);
    if (this.mount) disposeModel(this.mount);
    this.group.removeFromParent();
    this.removed = true;
  }
}

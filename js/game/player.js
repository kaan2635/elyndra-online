// Player controller: input → movement, targeting, skills, interaction, dodge, jump.
import * as THREE from 'three';
import { G, emit } from '../core/state.js';
import { clamp, dampAngle, distSq2, dist2 } from '../core/util.js';
import { L, t } from '../core/i18n.js';
import { useSkill, skillRange, updateCasting } from './skillsys.js';
import { SKILLS } from '../data/skills.js';
import { CLASSES } from '../data/classes.js';
import { interrupt, buff, sfxAt } from './combat.js';
import { Audio } from '../audio.js';

const ray = new THREE.Raycaster();
const _v = new THREE.Vector3();

export class PlayerCtl {
  constructor(u) {
    this.u = u; G.playerCtl = this;
    this.moveTarget = null; this.pending = null; this.autoRun = false;
    this.vx = 0; this.vz = 0;
    this.isMoving = false;
    this.dodgeCd = 0;
    this.stepT = 0;
    this.interactT = 0;
    this.nearby = null;
    this.follow = null;
  }

  setTarget(t) {
    const u = this.u;
    if (u.target === t) return;
    u.target = t;
    if (!t || !u.isEnemy(t)) u.autoAttack = false;
    emit('targetChanged', t);
    if (t) Audio.sfx('ui_click', { vol: 0.25, pitch: 1.3 });
  }

  // ------------------------------------------------------------ skills
  cast(id, opts = {}) {
    const u = this.u;
    if (u.dead) return;
    if (u.sitting) this.stand();
    const err = useSkill(u, id, opts);
    if (!err) { this.pending = null; return true; }
    if (err.startsWith('range:')) {
      // approach the target then cast (tap-to-attack friendly)
      const tgt = u.target && u.target.id === err.slice(6) ? u.target : G.world.units.find(x => x.id === err.slice(6));
      if (tgt) { this.pending = { id, target: tgt, t: 4 }; this.moveTarget = null; return false; }
    }
    if (err === 'gcd' || err === 'busy') { this.queued = { id, opts, t: 0.6 }; return false; }
    if (err !== 'invalid') G.ui?.error(err);
    return false;
  }
  stopForCast() { this.vx = 0; this.vz = 0; this.moveTarget = null; this.isMoving = false; }

  attackTarget(t) {
    const u = this.u;
    this.setTarget(t);
    u.autoAttack = true;
    if (u.hasFlag('stealth') && u.cls === 'rogue') return;
  }

  // ------------------------------------------------------------ tap / click
  tap(cx, cy, btn) {
    const u = this.u;
    if (u.dead || G.mode !== 'game') return;
    // pick unit on screen
    const hit = this.pickUnit(cx, cy);
    if (hit) {
      if (hit.kind === 'npc') {
        this.setTarget(hit);
        if (u.distTo(hit) < 5) G.npcs?.interact(hit);
        else { this.moveTarget = { x: hit.pos.x, z: hit.pos.z, then: () => G.npcs?.interact(hit), stop: 3 }; }
        return;
      }
      if (u.isEnemy(hit)) {
        if (u.target === hit) {
          // second tap = attack / approach
          this.attackTarget(hit);
          const C = CLASSES[u.cls];
          if (!C.ranged && u.edgeDist(hit) > 2.5) this.pending = { attack: true, target: hit, t: 5 };
        } else {
          this.attackTarget(hit);
        }
        return;
      }
      if (hit.lootable && hit.dead) { this.moveTarget = { x: hit.pos.x, z: hit.pos.z, then: () => G.loot?.open(hit), stop: 2.5 }; this.setTarget(hit); return; }
      this.setTarget(hit);
      return;
    }
    // interactables
    const ia = this.pickInteractable(cx, cy);
    if (ia) {
      if (dist2(u.pos.x, u.pos.z, ia.x, ia.z) < (ia.r || 3) + 0.5) this.useInteractable(ia);
      else this.moveTarget = { x: ia.x, z: ia.z, then: () => this.useInteractable(ia), stop: Math.max(1.2, (ia.r || 3) - 0.5) };
      return;
    }
    // ground: click-to-move
    const g = this.groundPoint(cx, cy);
    if (g) {
      this.moveTarget = { x: g.x, z: g.z, stop: 0.4 };
      this.pending = null;
      G.vfx?.ring({ x: g.x, y: G.world.groundAt(g.x, g.z), z: g.z }, 0.9, 0x8affb0, 0.45);
    }
  }
  pickUnit(cx, cy) {
    let best = null, bd = 48 * 48;
    for (const o of G.world.units) {
      if (o === this.u || !o.group.visible || o.removed) continue;
      if (o.dead && !o.lootable) continue;
      const sp = G.overlay.project(o.pos.x, o.pos.y + o.height * 0.5, o.pos.z);
      if (!sp) continue;
      const rad = Math.max(30, (o.height * 26) / Math.max(0.3, G.engine.cam.dist / 14));
      const d = (sp.x - cx) ** 2 + (sp.y - cy) ** 2;
      const lim = Math.max(bd, rad * rad * 0.55);
      if (d < lim && d < bd + (o.kind === 'monster' ? 400 : 0)) { bd = d; best = o; }
    }
    return best;
  }
  pickInteractable(cx, cy) {
    let best = null, bd = 50 * 50;
    for (const ia of G.world.interactables) {
      if (ia.hidden) continue;
      const sp = G.overlay.project(ia.x, (ia.y ?? G.world.groundAt(ia.x, ia.z)) + (ia.h || 1), ia.z);
      if (!sp) continue;
      const d = (sp.x - cx) ** 2 + (sp.y - cy) ** 2;
      if (d < bd) { bd = d; best = ia; }
    }
    return best;
  }
  groundPoint(cx, cy) {
    const ndc = new THREE.Vector2(cx / window.innerWidth * 2 - 1, -(cy / window.innerHeight) * 2 + 1);
    ray.setFromCamera(ndc, G.camera);
    const tgt = G.world.dungeon ? G.world.dungeon.floorMesh : G.world.terrain?.mesh;
    if (!tgt) return null;
    const hits = ray.intersectObject(tgt, false);
    return hits[0]?.point || null;
  }
  useInteractable(ia) {
    if (ia.hidden) return;
    this.u.faceTo(ia.x, ia.z);
    ia.action?.(ia);
  }

  // ------------------------------------------------------------ actions
  jump() {
    const u = this.u;
    if (u.dead || u.airY > 0 || u.rooted || u.anim.swim) return;
    u.vy = 8.5; u.airY = 0.01;
    if (u.sitting) this.stand();
  }
  dodge() {
    const u = this.u;
    if (u.dead || this.dodgeCd > 0 || u.rooted || u.mount) return;
    this.dodgeCd = 2.2;
    if (u.cast) interrupt(u);
    const m = this.lastMoveDir || { x: -Math.sin(u.yaw), z: -Math.cos(u.yaw) };
    const yaw = this.isMoving ? Math.atan2(m.x, m.z) : u.yaw + Math.PI;
    u.yaw = yaw;
    u.dash = { tx: u.pos.x + Math.sin(yaw) * 7, tz: u.pos.z + Math.cos(yaw) * 7, speed: 20, time: 0, face: false };
    u.playAct('roll', 0.4);
    buff(u, { id: 'dodgeroll', name: L('Takla|Roll'), icon: 'sprint', dur: 0.4, flags: { invuln: 1 } }, u);
    sfxAt('dodge', u.pos, { vol: 0.6 });
    emit('dodged');
  }
  sit() { const u = this.u; if (u.inCombat || u.mount) return; u.sitting = true; u.anim.sit = true; }
  stand() { const u = this.u; u.sitting = false; u.anim.sit = false; }

  // ------------------------------------------------------------ update
  update(dt) {
    const u = this.u, inp = G.input;
    this.dodgeCd = Math.max(0, this.dodgeCd - dt);
    if (u.dead) { u.anim.move = 0; return; }
    updateCasting(u, dt);
    if (this.queued) { this.queued.t -= dt; if (this.queued.t <= 0) this.queued = null; else if (u.gcd <= 0 && !u.cast) { const q = this.queued; this.queued = null; this.cast(q.id, q.opts); } }
    // fear: forced movement
    const fear = u.buffs.find(b => b.flags?.fear);
    let mi = inp.enabled && !G.ui?.chatFocused ? inp.moveIntent() : { x: 0, y: 0, m: 0 };
    if (this.autoRun) { mi.y = Math.max(mi.y, 1); mi.m = 1; }
    if (u.stunned || u.dash) mi = { x: 0, y: 0, m: 0 };
    const cy = G.engine.cam.yaw;
    const fx = -Math.sin(cy), fz = -Math.cos(cy);
    // forward = (fx, fz), right = (-fz, fx)
    let mx = -fz * mi.x + fx * mi.y;
    let mz = fx * mi.x + fz * mi.y;
    let speedMul = mi.m;
    if (fear) { const s = fear.data?.from || fear.src; if (s) { const a = Math.atan2(u.pos.x - s.pos.x, u.pos.z - s.pos.z); mx = Math.sin(a); mz = Math.cos(a); speedMul = 0.8; } }
    if (speedMul > 0.05) {
      this.moveTarget = null; this.pending = null; this.follow = null;
      if (u.sitting) this.stand();
    } else if (this.moveTarget || this.pending || this.follow) {
      // click-to-move / approach target / follow
      let tx, tz, stop;
      if (this.pending) {
        const tg = this.pending.target;
        this.pending.t -= dt;
        if (!tg || tg.dead || this.pending.t <= 0) this.pending = null;
        else {
          const range = this.pending.attack ? (CLASSES[u.cls].ranged ? CLASSES[u.cls].range : 2.4) : skillRange(u, SKILLS[this.pending.id]);
          if (u.edgeDist(tg) <= range - 0.4) {
            const p = this.pending; this.pending = null;
            if (p.id) this.cast(p.id, { target: tg });
          } else { tx = tg.pos.x; tz = tg.pos.z; stop = range * 0.8 + u.radius + tg.radius; }
        }
      } else if (this.moveTarget) {
        tx = this.moveTarget.x; tz = this.moveTarget.z; stop = this.moveTarget.stop ?? 0.4;
        if (dist2(u.pos.x, u.pos.z, tx, tz) <= stop) { const cb = this.moveTarget.then; this.moveTarget = null; cb?.(); tx = undefined; }
      } else if (this.follow) {
        const f = this.follow;
        if (f.dead || f.removed) this.follow = null;
        else if (u.distTo(f) > 3.5) { tx = f.pos.x; tz = f.pos.z; stop = 3; }
      }
      if (tx !== undefined) {
        const dx = tx - u.pos.x, dz = tz - u.pos.z, d = Math.hypot(dx, dz);
        if (d > (stop ?? 0.4)) { mx = dx / d; mz = dz / d; speedMul = 1; }
      }
    } else if (u.autoAttack && u.target && !u.target.dead && !CLASSES[u.cls].ranged && !u.cast) {
      // melee auto-chase (mobile friendly)
      const tg = u.target;
      const d = u.edgeDist(tg);
      if (d > 2.4 && d < 30) { const dx = tg.pos.x - u.pos.x, dz = tg.pos.z - u.pos.z, dd = Math.hypot(dx, dz); mx = dx / dd; mz = dz / dd; speedMul = 1; }
    }
    // casting blocks movement intent from click/approach, but WASD cancels cast
    if (u.cast && speedMul > 0.05) {
      if (mi.m > 0.05 && !u.cast.sk?.canMove) interrupt(u);
      else { speedMul = 0; }
    }
    if (u.rooted) speedMul = 0;
    const sp = u.moveSpeed * speedMul;
    const tvx = mx * sp, tvz = mz * sp;
    const acc = 1 - Math.exp(-14 * dt);
    this.vx += (tvx - this.vx) * acc; this.vz += (tvz - this.vz) * acc;
    const vmag = Math.hypot(this.vx, this.vz);
    this.isMoving = vmag > 0.3;
    if (this.isMoving && !u.dash) {
      u.step(this.vx * dt, this.vz * dt);
      this.lastMoveDir = { x: this.vx / vmag, z: this.vz / vmag };
      if (!u.cast) u.yaw = dampAngle(u.yaw, Math.atan2(this.vx, this.vz), 14, dt);
      u.anim.move = vmag / 6.5; u.anim.run = vmag > 4.5;
      u.anim.phase += dt * (u.mount ? 9 : 10.5) * Math.max(0.5, vmag / (u.mount ? 11 : 7));
      // footsteps
      this.stepT -= dt * vmag / 7;
      if (this.stepT <= 0 && u.airY <= 0) { this.stepT = u.mount ? 0.25 : 0.36; Audio.footstep(u.anim.swim ? 'water' : G.world.dungeon ? 'stone' : (G.world.terrain?.surfaceAt(u.pos.x, u.pos.z) || 'grass')); }
    } else if (!u.dash) {
      u.anim.move = 0;
      // face target when standing in combat
      if (u.target && u.isEnemy(u.target) && u.autoAttack && !u.target.dead) u.faceTo(u.target.pos.x, u.target.pos.z, dt, 10);
    }
    if (u.dash) { u.anim.move = 1.4; u.anim.phase += dt * 14; }
    // nearby interaction hint
    this.interactT -= dt;
    if (this.interactT <= 0) { this.interactT = 0.2; this.nearby = this.findNearby(); G.ui?.setInteract?.(this.nearby); }
  }
  findNearby() {
    const u = this.u;
    let best = null, bd = 16;
    for (const o of G.world.units) {
      if (o.kind !== 'npc' && !(o.dead && o.lootable)) continue;
      const d = distSq2(u.pos.x, u.pos.z, o.pos.x, o.pos.z);
      if (d < bd) { bd = d; best = { unit: o }; }
    }
    for (const ia of G.world.interactables) {
      if (ia.hidden) continue;
      const r = (ia.r || 3);
      const d = distSq2(u.pos.x, u.pos.z, ia.x, ia.z);
      if (d < r * r && d < bd + 4) { bd = d; best = { ia }; }
    }
    return best;
  }
  interactNearest() {
    const n = this.nearby || this.findNearby();
    if (!n) return;
    if (n.unit) { if (n.unit.kind === 'npc') { this.setTarget(n.unit); G.npcs?.interact(n.unit); } else G.loot?.open(n.unit); }
    else if (n.ia) this.useInteractable(n.ia);
  }
  cycleTarget() {
    const u = this.u;
    const list = G.world.units.filter(o => !o.dead && u.isEnemy(o) && o.group.visible && u.distTo(o) < 35)
      .sort((a, b) => u.distTo(a) - u.distTo(b));
    if (!list.length) return;
    const i = list.indexOf(u.target);
    this.setTarget(list[(i + 1) % list.length]);
  }
}

// Skill runtime: validation, casting/channeling, cooldowns, auto-attacks and the X API.
import { G, emit } from '../core/state.js';
import { clamp, dist2 } from '../core/util.js';
import { L, t } from '../core/i18n.js';
import { SKILLS } from '../data/skills.js';
import { CLASSES, S } from '../data/classes.js';
import { Combat, amount, dmg, heal, buff, dot, hot, interrupt, enemiesNear, alliesNear, coneEnemies, lineEnemies, sfxAt } from './combat.js';
import { Audio } from '../audio.js';

// ------------------------------------------------------------ buff presets
export const B = {
  stun: d => ({ id: 'stun', name: L('Sersemledi|Stunned'), icon: 'stun', dur: d, debuff: true, flags: { stun: 1 }, fx: 'stun' }),
  root: d => ({ id: 'root', name: L('Donmuş|Frozen'), icon: 'frost_nova', dur: d, debuff: true, flags: { root: 1 }, fx: 'frozen' }),
  slow: (p, d) => ({ id: 'slow', name: L('Yavaşladı|Slowed'), icon: 'snowflake', dur: d, debuff: true, flags: { slow: p }, fx: 'chill' }),
  silence: d => ({ id: 'silence', name: L('Susturuldu|Silenced'), icon: 'chains', dur: d, debuff: true, flags: { silence: 1 } }),
};

const pending = [];
export function later(t0, fn) { pending.push({ t: t0, fn }); }
export function updateTimers(dt) {
  for (let i = pending.length - 1; i >= 0; i--) {
    const p = pending[i]; p.t -= dt;
    if (p.t <= 0) { pending.splice(i, 1); try { p.fn(); } catch (e) { console.error(e); } }
  }
}
export function clearTimers() { pending.length = 0; }

// ------------------------------------------------------------ X API passed to skills
export const X = {
  amount, dmg, heal, buff, dot, hot, B, later,
  get fx() { return G.vfx; },
  enemies: (c, r) => enemiesNear(c, c.pos.x, c.pos.z, r),
  allies: (c, r) => { const a = alliesNear(c, c.pos.x, c.pos.z, r); if (!a.includes(c)) a.push(c); return a.filter(u => u.kind !== 'pet' || u.owner === c || true); },
  enemiesAt: (c, x, z, r) => enemiesNear(c, x, z, r),
  cone: (c, range, half) => coneEnemies(c, range, half),
  line: (c, yaw, len, w) => lineEnemies(c, yaw, len, w),
  h: (x, z) => G.world.groundAt(x, z),
  sfx(name, at, o) { sfxAt(name, at?.pos || at, o); },
  shake(c, a) { if (c === G.player || c?.owner === G.player) G.engine.shake(a); },
  taunt(c, e) {
    if (!e.threat) return;
    let max = 0; for (const v of e.threat.values()) max = Math.max(max, v);
    e.threat.set(c, max * 1.1 + 10);
    e.target = c; e.ai?.onTaunt?.(c);
    G.overlay?.text(e, '!', { color: '#ff4040' });
  },
  proj(c, t, kind, speed, onHit) {
    if (!G.vfx) { onHit(); return; }
    G.vfx.projectile({ from: c, to: t, kind, speed, onHit: () => { if (!t.dead) onHit(); } });
  },
  dash(c, t, speed, onArrive) {
    c.dash = { tx: t.pos.x, tz: t.pos.z, target: t, speed, onArrive, time: 0 };
  },
  leap(c, yaw, dist) {
    const tx = c.pos.x + Math.sin(yaw) * dist, tz = c.pos.z + Math.cos(yaw) * dist;
    c.dash = { tx, tz, speed: 26, time: 0, leap: true, face: false };
    c.vy = 7; c.airY = 0.01;
  },
  blink(c, dist) {
    // step forward in small increments respecting collision
    const n = 12;
    for (let i = 0; i < n; i++) c.step(Math.sin(c.yaw) * dist / n, Math.cos(c.yaw) * dist / n);
  },
  behind(c, t) {
    const bx = t.pos.x - Math.sin(t.yaw) * (t.radius + 1.2), bz = t.pos.z - Math.cos(t.yaw) * (t.radius + 1.2);
    const r = G.world.resolve(bx, bz, c.radius, bx, bz, null, true);
    c.pos.x = r.x; c.pos.z = r.z; c.faceTo(t.pos.x, t.pos.z);
  },
  zone(c, x, z, r, dur, interval, fn, color) {
    G.vfx?.groundFx({ x, z }, r, color, dur);
    let n = Math.floor(dur / interval);
    const tick = () => { if (n-- <= 0) return; for (const e of enemiesNear(c, x, z, r)) fn(e); later(interval, tick); };
    later(interval, tick);
  },
  summon(c, tpl, opts) { return G.factory?.summon(c, tpl, opts); },
  poisonProc(c, t) {
    if (!c.hasBuff('poisonblades') || t.dead) return;
    const b = dot(c, t, { id: 'deadlypoison', name: L('Ölümcül Zehir|Deadly Poison'), icon: 'poison_drop', dur: 6, coef: 0.5, ticks: 3, school: 'nature', stacks: 5, fx: 'poison' });
    if (b && b.stacks >= 5 && c.powers?.has('pw_poison_burst')) { t.removeBuff(b.id); dmg(c, t, { coef: 3, school: 'nature' }); G.vfx?.burst(t.pos, 'poison', { n: 30 }); }
  },
};
G.X = X;

// ------------------------------------------------------------ helpers
export function skillCost(u, sk) {
  if (!sk.cost) return 0;
  if (u.hasFlag('freeCast')) return 0;
  let c = sk.cost * (sk.costFn ? sk.costFn(u) : 1);
  if (u.resType === 'mana') c = sk.cost / 100 * (u.stats.baseMana || u.stats.maxRes);
  return c * (u.costMult?.(sk) ?? 1);
}
export function castTime(u, sk) { return (sk.cast || 0) / (1 + (u.stats.haste || 0) / 100) * (u.castMult?.(sk) ?? 1); }
export function skillRange(u, sk) {
  if (sk.range) return sk.range;
  if (sk.melee) return Math.max(2.6, CLASSES[u.cls]?.range ?? 2.6);
  if (sk.target === 'enemy' || sk.target === 'ally') return CLASSES[u.cls]?.range ?? 25;
  return 30;
}
export function gcdTime(u) { return clamp(1.0 / (1 + (u.stats.haste || 0) / 100), 0.75, 1.0); }

/**
 * Attempt to use a skill. Returns null on success or an error string.
 * opts: {target, ground:{x,z}, quiet}
 */
export function useSkill(u, id, opts = {}) {
  const sk = SKILLS[id];
  if (!sk || u.dead) return 'invalid';
  if (u.stunned) return t('stunned');
  if (u.silenced && (sk.cast || sk.channel || sk.school)) return t('silenced');
  if (u.cast) { if (u.cast.sk === sk) return 'busy'; if (sk.gcd === false && !sk.cast) { /* off-gcd instants can be used while casting */ } else return 'busy'; }
  if (sk.gcd !== false && u.gcd > 0) return 'gcd';
  if (u.cds[id] > 0) return t('onCooldown');
  const cost = skillCost(u, sk);
  if (u.res < cost - 0.01) return t('notEnoughRes', L(u.resInfo?.name || ''));
  // ---- target resolution
  let tgt = null, ground = opts.ground || null;
  const range = skillRange(u, sk);
  if (sk.target === 'enemy') {
    tgt = opts.target && u.isEnemy(opts.target) && !opts.target.dead ? opts.target : (u.target && u.isEnemy(u.target) && !u.target.dead ? u.target : null);
    if (!tgt) {
      tgt = G.world.nearestEnemy(u, Math.max(range + 4, 12));
      if (tgt && u === G.player) G.playerCtl?.setTarget(tgt);
    }
    if (!tgt) return t('noTarget');
    const d = u.edgeDist(tgt);
    if (d > range + 0.3) return 'range:' + tgt.id;
    if (sk.minRange && d < sk.minRange) return L('Çok yakın|Too close');
  } else if (sk.target === 'ally') {
    const ft = opts.target || u.target;
    tgt = ft && !ft.dead && !u.isEnemy(ft) && ft.team === u.team && ft.kind !== 'npc' && ft.kind !== 'critter' ? ft : u;
    if (tgt !== u && u.edgeDist(tgt) > range + 0.3) return t('outOfRange');
  } else if (sk.target === 'ground') {
    if (!ground) {
      const et = (opts.target && u.isEnemy(opts.target)) ? opts.target : (u.target && u.isEnemy(u.target) && !u.target.dead ? u.target : G.world.nearestEnemy(u, range + 2));
      if (et && u.distTo(et) <= range + 2) ground = { x: et.pos.x, z: et.pos.z };
      else ground = { x: u.pos.x + Math.sin(u.yaw) * Math.min(range, 10), z: u.pos.z + Math.cos(u.yaw) * Math.min(range, 10) };
    }
    if (dist2(u.pos.x, u.pos.z, ground.x, ground.z) > range + 1) return t('outOfRange');
  } else tgt = u;
  if (sk.can) { const e = sk.can(u, tgt); if (e) return e; }
  // face target
  if (tgt && tgt !== u) u.faceTo(tgt.pos.x, tgt.pos.z);
  else if (ground) u.faceTo(ground.x, ground.z);
  if (sk.target === 'enemy' && tgt) { u.target = tgt; u.autoAttack = true; }
  // casting
  if ((sk.cast || sk.channel) && u === G.player && G.playerCtl?.isMoving && !sk.canMove) G.playerCtl.stopForCast();
  if (sk.gcd !== false) u.gcd = gcdTime(u);
  if (u.hasFlag('stealth') && id !== 'g_stealth' && sk.target !== 'self') u.removeBuff('stealth');
  const ctx = { ground };
  if (sk.cast) {
    u.cast = { sk, id, t: 0, dur: castTime(u, sk), target: tgt, ctx, cost };
    u.anim.cast = sk.castAnim || (sk.anim === 'raise' ? 'up' : 'forward');
    if (u === G.player) { G.ui?.castBar?.(u.cast); }
    sfxAt(sk.theme === 'fire' ? 'fire_cast' : sk.theme === 'frost' ? 'frost_cast' : sk.theme === 'holy' || sk.theme === 'gold' ? 'holy_cast' : sk.theme === 'shadow' ? 'shadow_cast' : 'arcane', u.pos, { vol: 0.35 });
    G.vfx?.castGlow?.(u, sk.theme);
    return null;
  }
  if (sk.channel) {
    u.res -= cost;
    u.cast = { sk, id, t: 0, dur: sk.channel / (1 + (u.stats.haste || 0) / 200), target: tgt, ctx, channel: true, ticks: sk.ticks, done: 0 };
    u.anim.cast = sk.castAnim || 'forward';
    if (sk.cd) u.cds[id] = sk.cd * (u.cdMult?.(sk) ?? 1);
    if (u === G.player) G.ui?.castBar?.(u.cast);
    return null;
  }
  execute(u, sk, tgt, ctx, cost);
  return null;
}

function execute(u, sk, tgt, ctx, cost) {
  u.res -= cost;
  if (sk.cd && !sk.channel) u.cds[sk.id] = sk.cd * (u.cdMult?.(sk) ?? 1);
  if (sk.anim) u.playAct(sk.anim, sk.animDur || (sk.melee ? 0.5 : 0.55), sk.animOpts);
  try { sk.run?.(u, tgt, X, ctx); } catch (e) { console.error('skill', sk.id, e); }
  if (sk.combo) u.combo = Math.min(5, u.combo + sk.combo + (u.tal?.('ruthless') && Math.random() < 0.2 * u.tal('ruthless') ? 1 : 0));
  if (sk.finisher) { u._lastCombo = u.combo; u.combo = 0; }
  // consume "next hit" buffs
  for (const b of [...u.buffs]) if (b.consumeOnHit && sk.target === 'enemy') u.removeBuff(b.id);
  // blade flurry cleave
  const cl = u.hasFlag('cleave');
  if (cl && sk.melee && tgt) for (const e of enemiesNear(u, tgt.pos.x, tgt.pos.z, 6).filter(e => e !== tgt).slice(0, cl)) dmg(u, e, { coef: 0.6, aoe: true });
  u.enterCombat?.call(u);
  if (sk.target !== 'enemy' && sk.target !== 'ground') u.combatT = u.combatT; // buffs don't start combat
  emit('skillUsed', u, sk, tgt);
}

// per-frame for every unit that can cast (heroes + casters)
export function updateDash(u, dt) {
  if (u.dash) {
    const d = u.dash;
    if (d.target && !d.target.dead) { d.tx = d.target.pos.x; d.tz = d.target.pos.z; }
    const dx = d.tx - u.pos.x, dz = d.tz - u.pos.z;
    const dist = Math.hypot(dx, dz);
    const stopAt = d.target ? d.target.radius + u.radius + 0.6 : 0.3;
    d.time += dt;
    if (dist <= stopAt || d.time > 1.5) {
      const cb = d.onArrive; u.dash = null; u.anim.move = 0;
      cb?.();
    } else {
      const s = Math.min(dist - stopAt + 0.01, d.speed * dt);
      const ox = u.pos.x, oz = u.pos.z;
      u.step(dx / dist * s, dz / dist * s);
      if (d.face !== false) u.faceTo(d.tx, d.tz);
      u.anim.move = 1.6; u.anim.run = true; u.anim.phase += dt * 16;
      if (Math.hypot(u.pos.x - ox, u.pos.z - oz) < s * 0.2 && d.time > 0.15) { const cb = d.onArrive; u.dash = null; cb?.(); }
    }
  }
}

export function updateCasting(u, dt) {
  updateDash(u, dt);
  const c = u.cast;
  if (!c || c.mob) return;
  if (u.stunned || u.dead) { interrupt(u); return; }
  if (c.target && c.target.dead && c.sk.target === 'enemy') { interrupt(u); return; }
  if (c.target && c.target !== u) u.faceTo(c.target.pos.x, c.target.pos.z, dt);
  c.t += dt;
  if (c.channel) {
    const interval = c.dur / c.ticks;
    while (c.done < c.ticks && c.t >= interval * (c.done + 0.5)) {
      c.done++;
      try { c.sk.tick?.(u, c.target, X, c.ctx); } catch (e) { console.error(e); }
    }
    if (c.t >= c.dur) { u.cast = null; u.anim.cast = null; if (u === G.player) G.ui?.castBar?.(null); }
    return;
  }
  if (c.t >= c.dur) {
    // re-check resources and range at completion
    u.cast = null; u.anim.cast = null;
    if (u === G.player) G.ui?.castBar?.(null);
    const cost = skillCost(u, c.sk);
    if (u.res < cost - 0.01) { if (u === G.player) G.ui?.error(t('notEnoughRes', L(u.resInfo?.name || ''))); return; }
    if (c.target && c.target !== u && u.edgeDist(c.target) > skillRange(u, c.sk) + 4) { if (u === G.player) G.ui?.error(t('outOfRange')); return; }
    execute(u, c.sk, c.target, c.ctx, cost);
  }
}

// Basic auto-attack for heroes
export function updateAutoAttack(u, dt) {
  if (!u.autoAttack || u.dead || u.cast || u.stunned || u.dash) { u.swing = Math.max(0, (u.swing || 0) - dt); return; }
  const tgt = u.target;
  if (!tgt || tgt.dead || !u.isEnemy(tgt)) { u.autoAttack = false; return; }
  u.swing = (u.swing || 0) - dt * (1 + (u.stats.haste || 0) / 100);
  if (u.swing > 0) return;
  const C = CLASSES[u.cls];
  const range = C.ranged ? C.range : Math.max(2.6, C.range);
  if (u.edgeDist(tgt) > range + 0.3) return;
  if (u.hasFlag('stealth')) return;
  if (u.anim.act && !C.ranged) return;
  u.swing = C.ranged ? 2.2 : 1.8;
  u.faceTo(tgt.pos.x, tgt.pos.z);
  const coef = C.ranged ? 0.5 : 0.6;
  if (u.cls === 'ranger') {
    u.playAct('bow', 0.4);
    sfxAt('bow_shot', u.pos, { vol: 0.4 });
    X.proj(u, tgt, 'arrow', 40, () => dmg(u, tgt, { coef, rage: 0 }));
  } else if (C.ranged) {
    u.playAct('cast', 0.35);
    const kind = u.cls === 'mage' ? 'arcaneSmall' : u.cls === 'necro' ? 'shadowSmall' : 'holySmall';
    const school = u.cls === 'mage' ? 'arcane' : u.cls === 'necro' ? 'shadow' : 'holy';
    X.proj(u, tgt, kind, 30, () => dmg(u, tgt, { coef: coef * 0.9, school }));
  } else {
    const anim = u.cls === 'rogue' ? 'dual' : (Math.random() < 0.5 ? 'slash' : 'slash2');
    u.playAct(anim, 0.45);
    sfxAt('swing', u.pos, { vol: 0.45 });
    later(0.18, () => {
      if (u.dead || tgt.dead) return;
      dmg(u, tgt, { coef, rage: u.resType === 'rage' ? 6 : 0 });
      if (u.cls === 'rogue') X.poisonProc(u, tgt);
    });
  }
}

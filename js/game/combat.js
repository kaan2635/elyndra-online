// Combat core: damage/heal pipeline, buffs, projectiles, area effects, death.
import * as THREE from 'three';
import { G, emit } from '../core/state.js';
import { clamp, rand, distSq2, dist2, angleDiff } from '../core/util.js';
import { L, t } from '../core/i18n.js';
import { S } from '../data/classes.js';
import { Audio } from '../audio.js';

export const SCHOOL_COL = { phys: '#ffffff', fire: '#ff8a3a', frost: '#8ad8ff', arcane: '#d68aff', holy: '#ffe68a', shadow: '#b48aff', nature: '#8aff6a', poison: '#a8f05a' };

// raw amount for a skill coefficient (before crit / mitigation)
export function amount(src, coef, o = {}) {
  const L = src.level || 1;
  const base = 6 * S(L);
  const pw = src.stats.power || 0;
  const k = o.heal ? 0.35 : 0.3;
  let a = coef * (base + pw * k);
  if (o.heal) a *= 1 + (src.stats.healPct || 0) / 100;
  return a;
}

export function sfxAt(name, pos, o = {}) {
  const p = G.player;
  if (!p) return Audio.sfx(name, o);
  const d = pos ? dist2(pos.x, pos.z, p.pos.x, p.pos.z) : 0;
  if (d > 45) return;
  const vol = (o.vol ?? 1) * clamp(1 - d / 45, 0.1, 1);
  let pan = 0;
  if (pos && G.camera) {
    const v = new THREE.Vector3(pos.x, pos.y, pos.z).project(G.camera);
    pan = clamp(v.x * 0.6, -0.8, 0.8);
  }
  Audio.sfx(name, { ...o, vol, pan });
}

function involvesPlayer(a, b) {
  const p = G.player;
  return a === p || b === p || a?.owner === p || (a?.inParty && G.party?.has(a)) || (b?.inParty && G.party?.has(b));
}

/**
 * Deal damage. o: {coef, amount, school='phys', canCrit=true, canDodge, dot=false, threat=1, skill, critBonus, silent, aoe, leech}
 */
export function dmg(src, tgt, o = {}) {
  if (!tgt || tgt.dead || (src && src.dead && !o.dot)) return 0;
  const school = o.school || 'phys';
  const show = involvesPlayer(src, tgt) && !o.silent;
  if (tgt.hasFlag('invuln')) { if (show) G.overlay?.text(tgt, L('Bağışık|Immune'), { color: '#ccc' }); return 0; }
  let a = o.amount ?? amount(src, o.coef ?? 1);
  // stealth opener bonus
  if (src?.hasFlag && src.hasFlag('stealth') && !o.dot) { a *= 1.8; src.removeBuff('stealth'); o.critBonus = (o.critBonus || 0) + 50; }
  // dodge (physical, direct only)
  if (school === 'phys' && !o.dot && o.canDodge !== false && Math.random() * 100 < (tgt.stats.dodge || 0)) {
    if (show) G.overlay?.text(tgt, L('Kaçındı|Dodge'), { color: '#ddd', small: true });
    sfxAt('dodge', tgt.pos, { vol: 0.5 });
    tgt.ai?.onDamaged?.(src, 0);
    return 0;
  }
  let crit = false;
  if (o.canCrit !== false && src && Math.random() * 100 < (src.stats.crit || 0) + (o.critBonus || 0)) { crit = true; a *= 1 + (src.stats.critDmg || 50) / 100; }
  if (src) a *= 1 + (src.stats.dmgPct || 0) / 100;
  if (o.mult) a *= o.mult;
  a *= 1 + (tgt.stats.dmgTakenPct || 0) / 100;
  // PvP dampening in the arena
  if (src?.isHero && tgt.isHero && (tgt.team === 'arenaA' || tgt.team === 'arenaB')) a *= 0.55;
  // level difference
  if (src && tgt) {
    const dl = (src.level || 1) - (tgt.level || 1);
    a *= clamp(1 + dl * 0.035, 0.55, 1.4);
  }
  // mitigation
  if (school === 'phys') {
    const armor = Math.max(0, tgt.stats.armor || 0);
    const red = Math.min(0.75, armor / (armor + 30 * S(src?.level || 1) + 50));
    a *= 1 - red;
  } else {
    const r = tgt.stats.resist || 0;
    a *= 1 - Math.min(0.5, r / (r + 40 * S(src?.level || 1) + 50));
  }
  // block
  let blocked = false;
  if (school === 'phys' && !o.dot && tgt.stats.block && Math.random() * 100 < tgt.stats.block) { a *= 0.55; blocked = true; }
  a = Math.max(1, Math.round(a));
  // absorb shields
  let absorbed = 0;
  if (tgt.absorb > 0) {
    absorbed = Math.min(tgt.absorb, a);
    tgt.absorb -= absorbed; a -= absorbed;
    if (tgt.absorb <= 0) { for (const b of [...tgt.buffs]) if (b.absorb) tgt.removeBuff(b.id); }
  }
  tgt.hp -= a;
  // combat bookkeeping
  if (src) {
    src.enterCombat(); tgt.enterCombat();
    if (tgt.threat) {
      const th = (a + absorbed) * (src.threatMult || 1) * (o.threat ?? 1);
      const owner = src.owner && src.kind === 'pet' ? src : src;
      tgt.threat.set(owner, (tgt.threat.get(owner) || 0) + th);
    }
    // rage
    if (src.resType === 'rage' && !o.dot) src.res = Math.min(src.stats.maxRes, src.res + (o.rage ?? 0));
    if (tgt.resType === 'rage') tgt.res = Math.min(tgt.stats.maxRes, tgt.res + Math.min(12, 70 * (a + absorbed) / Math.max(1, tgt.stats.maxHp)));
    // leech
    const lc = (src.stats.leech || 0) + (o.leech || 0);
    if (lc > 0 && !src.dead) heal(src, src, { amount: a * lc / 100, silent: true, noThreat: true });
    // thorns
    if (tgt.stats.thorns && school === 'phys' && !o.dot && src !== tgt) dmg(tgt, src, { amount: tgt.stats.thorns, school: 'nature', canCrit: false, silent: false, dot: true });
  }
  tgt.ai?.onDamaged?.(src, a);
  // feedback
  if (!o.dot) { tgt.flash = crit ? 1 : 0.7; if (tgt.anim && !tgt.anim.act && !tgt.isBoss) tgt.anim.hit = 1; }
  if (show) {
    const col = tgt === G.player || (tgt.team === 'player' && tgt.kind !== 'monster') ? '#ff5050' : (SCHOOL_COL[school] || '#fff');
    if (blocked) G.overlay?.text(tgt, L('Blok|Block'), { color: '#aaa', small: true });
    if (absorbed && !a) G.overlay?.text(tgt, L('Emildi|Absorb'), { color: '#9cf', small: true });
    else G.overlay?.text(tgt, String(a), { color: col, crit, dot: o.dot, src });
    if (!o.dot && !o.noSound) {
      if (school === 'phys') sfxAt(blocked ? 'hit_metal' : crit ? 'crit' : 'hit', tgt.pos, { vol: 0.7 });
      if (crit && (src === G.player)) G.engine.shake(0.25);
    }
    if (tgt === G.player && a > tgt.stats.maxHp * 0.15) G.engine.shake(0.35);
  }
  if (!o.dot && G.vfx) G.vfx.hit(tgt, school, crit);
  emit('damage', src, tgt, a, crit, school, o);
  if (tgt.hp <= 0) kill(tgt, src);
  else G.powers?.afterTaken(tgt, src, a, o);
  if (src && !tgt.dead || src) G.powers?.afterDamage(src, tgt, a, crit, o);
  return a;
}

export function heal(src, tgt, o = {}) {
  if (!tgt || tgt.dead) return 0;
  let a = o.amount ?? amount(src, o.coef ?? 1, { heal: true });
  let crit = false;
  if (!o.amount && o.canCrit !== false && Math.random() * 100 < (src.stats.crit || 0)) { crit = true; a *= 1.5; }
  if (o.mult) a *= o.mult;
  if (tgt.hasFlag('healRed')) a *= 0.5;
  a = Math.round(a);
  const before = tgt.hp;
  tgt.hp = Math.min(tgt.stats.maxHp, tgt.hp + a);
  const eff = tgt.hp - before;
  if (!o.noThreat && src && eff > 0) {
    // healing threat on every monster fighting the healed unit
    for (const u of G.world.units) if (u.threat && u.threat.has(tgt)) u.threat.set(src, (u.threat.get(src) || 0) + eff * 0.5);
  }
  if (!o.silent && involvesPlayer(src, tgt) && (eff > 0 || !o.hot)) G.overlay?.text(tgt, '+' + Math.max(eff, 0), { color: '#5dff7a', crit, dot: o.hot, heal: true });
  emit('heal', src, tgt, eff, crit);
  G.powers?.afterHeal(src, tgt, eff, o);
  return eff;
}

/**
 * Apply a buff/debuff. def: {id, name, icon, dur, debuff, mods, pct, flags, tick(u,b), interval, stacks, maxStacks, absorb, onApply, onExpire, school, unique}
 */
export function buff(tgt, def, src) {
  if (!tgt || tgt.dead) return null;
  if (def.debuff && tgt.hasFlag('ccImmune') && def.flags && (def.flags.stun || def.flags.root || def.flags.fear || def.flags.slow || def.flags.silence)) {
    if (involvesPlayer(src, tgt)) G.overlay?.text(tgt, L('Bağışık|Immune'), { color: '#ccc', small: true });
    return null;
  }
  // bosses: diminishing CC
  if (def.flags && (def.flags.stun || def.flags.fear) && tgt.isBoss) return null;
  const id = def.id + (def.perSource && src ? '@' + src.id : '');
  let b = tgt.buffs.find(x => x.id === id);
  if (b) {
    b.left = def.dur ?? Infinity; b.src = src;
    if (def.maxStacks) b.stacks = Math.min(def.maxStacks, (b.stacks || 1) + 1);
    if (def.absorb) { tgt.absorb = Math.max(0, tgt.absorb - (b.absorbLeft || 0)) + def.absorb; b.absorbLeft = def.absorb; }
    if (def.data) b.data = { ...b.data, ...def.data };
  } else {
    b = { ...def, id, left: def.dur ?? Infinity, src, stacks: 1, _acc: 0 };
    if (def.absorb) { tgt.absorb += def.absorb; b.absorbLeft = def.absorb; }
    tgt.buffs.push(b);
    def.onApply?.(tgt, b);
    if (def.flags?.stun || def.flags?.fear) { if (tgt.cast) interrupt(tgt); }
    if (def.fx && G.vfx) G.vfx.aura(tgt, def.fx, def.dur ?? 9999, id);
  }
  tgt.recalc();
  emit('buff', tgt, b);
  return b;
}

// Damage over time convenience
export function dot(src, tgt, { id, name, icon, dur, coef, school = 'phys', ticks, fx, perSource = true, stacks, extra }) {
  const tickCoef = coef / ticks;
  const interval = dur / ticks;
  const per = amount(src, tickCoef);
  return buff(tgt, {
    id, name, icon, dur, debuff: true, interval, school, perSource, fx, maxStacks: stacks,
    tick: (u, b) => { dmg(b.src, u, { amount: per * (b.stacks || 1), school, dot: true, canCrit: true }); },
    ...extra,
  }, src);
}
export function hot(src, tgt, { id, name, icon, dur, coef, ticks, fx }) {
  const per = amount(src, coef / ticks, { heal: true });
  return buff(tgt, {
    id, name, icon, dur, interval: dur / ticks, perSource: true, fx,
    tick: (u, b) => heal(b.src, u, { amount: per, hot: true }),
  }, src);
}

export function interrupt(u, lockout = 0) {
  if (!u.cast) return;
  u.cast = null; u.anim.cast = null;
  if (u === G.player) G.ui?.castBar?.(null);
  if (lockout) buff(u, { id: 'lockout', name: L('Susturuldu|Locked out'), icon: 'chains', dur: lockout, debuff: true, flags: { silence: 1 } });
  emit('interrupted', u);
}

export function kill(tgt, src) {
  if (tgt.dead) return;
  if (tgt.powers?.has('pw_cheat_death') && !(tgt.cds.cheatDeath > 0)) { tgt.cds.cheatDeath = 180; tgt.hp = Math.round(tgt.stats.maxHp * 0.3); G.overlay?.text(tgt, L('Ölüme Meydan Okudu!|Cheated Death!'), { color: '#ffd24a' }); return; }
  tgt.hp = 0; tgt.dead = true; tgt.deathT = 0;
  tgt.cast = null; tgt.anim.cast = null; tgt.anim.act = null;
  tgt.buffs = tgt.buffs.filter(b => b.persistDeath);
  tgt.absorb = 0;
  tgt.recalc();
  if (tgt.kind === 'monster') sfxAt(tgt.data.deathSfx || (tgt.isBoss ? 'roar' : 'death_monster'), tgt.pos, { vol: 0.8, pitch: tgt.isBoss ? 0.7 : 1 });
  G.vfx?.burst(tgt.pos, 'death', { y: tgt.height * 0.5 });
  // release summons
  for (const s of tgt.summons) if (!s.dead) kill(s, null);
  emit('unitDied', tgt, src);
}

// ---------------------------------------------------------- spatial helpers
export function enemiesNear(src, x, z, r) { return G.world.unitsNear(x, z, r, u => !u.dead && src.isEnemy(u)); }
export function alliesNear(src, x, z, r) { return G.world.unitsNear(x, z, r, u => !u.dead && !src.isEnemy(u) && u.team === src.team && u.kind !== 'critter' && u.kind !== 'npc'); }
export function inCone(src, u, range, halfAngle) {
  const dx = u.pos.x - src.pos.x, dz = u.pos.z - src.pos.z;
  const d = Math.hypot(dx, dz) - u.radius;
  if (d > range) return false;
  const a = Math.atan2(dx, dz);
  return Math.abs(angleDiff(src.yaw, a)) <= halfAngle + Math.atan2(u.radius, Math.max(0.5, d));
}
export function coneEnemies(src, range, halfAngle) { return enemiesNear(src, src.pos.x, src.pos.z, range + 3).filter(u => inCone(src, u, range, halfAngle)); }

// line (rectangle) query from src along yaw
export function lineEnemies(src, yaw, len, width) {
  const sx = Math.sin(yaw), sz = Math.cos(yaw);
  return enemiesNear(src, src.pos.x, src.pos.z, len + 2).filter(u => {
    const dx = u.pos.x - src.pos.x, dz = u.pos.z - src.pos.z;
    const along = dx * sx + dz * sz; const side = Math.abs(dx * sz - dz * sx);
    return along > -1 && along < len && side < width / 2 + u.radius;
  });
}

export const Combat = { amount, dmg, heal, buff, dot, hot, interrupt, kill, enemiesNear, alliesNear, coneEnemies, lineEnemies, inCone, sfxAt };
G.combat = Combat;

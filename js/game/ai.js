// AI controllers: monsters (with telegraphed abilities), heroes (bots/party/arena), pets, critters, NPCs.
import { G, emit } from '../core/state.js';
import { rand, randi, choice, clamp, dist2, distSq2, angleDiff, dampAngle } from '../core/util.js';
import { L } from '../core/i18n.js';
import { S, CLASSES } from '../data/classes.js';
import { SKILLS, CLASS_SKILLS } from '../data/skills.js';
import { dmg, heal, buff, dot, interrupt, enemiesNear, alliesNear, inCone, sfxAt } from './combat.js';
import { useSkill, later, B, skillCost, skillRange, updateDash } from './skillsys.js';

// active danger zones (for bots to dodge)
G.dangers = [];
function danger(o) { const d = { ...o, until: G.time + o.dur }; G.dangers.push(d); return d; }
export function pruneDangers() { const t = G.time; G.dangers = G.dangers.filter(d => d.until > t); }
export function inDanger(x, z) {
  for (const d of G.dangers) {
    if (d.shape === 'circle' && distSq2(x, z, d.x, d.z) < (d.r + 0.6) ** 2) return d;
    if (d.shape === 'cone') { const dx = x - d.x, dz = z - d.z; const dd = Math.hypot(dx, dz); if (dd < d.r + 0.5 && Math.abs(angleDiff(d.yaw, Math.atan2(dx, dz))) < d.angle / 2 + 0.15) return d; }
  }
  return null;
}

// monster raw hit amount
export const mobAmt = (u, mult = 1) => (u.stats.power || 7 * S(u.level)) * mult;

// generic movement helper with stuck detection
function moveTowards(u, tx, tz, dt, speedMul = 1, stopDist = 0.2) {
  const dx = tx - u.pos.x, dz = tz - u.pos.z;
  const d = Math.hypot(dx, dz);
  if (d <= stopDist || u.rooted) { u.anim.move = 0; return true; }
  const sp = u.moveSpeed * speedMul;
  const s = Math.min(d - stopDist + 0.01, sp * dt);
  let ang = Math.atan2(dx, dz);
  if (u._side && u._sideT > 0) { ang += u._side; u._sideT -= dt; }
  const ox = u.pos.x, oz = u.pos.z;
  u.step(Math.sin(ang) * s, Math.cos(ang) * s);
  const moved = Math.hypot(u.pos.x - ox, u.pos.z - oz);
  if (moved < s * 0.3) { u._stuck = (u._stuck || 0) + dt; if (u._stuck > 0.4) { u._side = (Math.random() < 0.5 ? 1 : -1) * rand(0.9, 1.5); u._sideT = 0.7; u._stuck = 0; } }
  else u._stuck = 0;
  u.yaw = dampAngle(u.yaw, Math.atan2(u.pos.x - ox || dx, u.pos.z - oz || dz), 12, dt);
  u.anim.move = sp / 6; u.anim.run = speedMul > 1.05 || sp > 7;
  u.anim.phase += dt * (u.anim.run ? 11 : 8) * Math.max(0.6, sp / 7);
  return false;
}
export { moveTowards };

// ================================================================== monster abilities
const tele = (o) => G.vfx?.tele(o);
const A = {
  charge: { cd: 12, cond: (u, t) => { const d = u.distTo(t); return d > 6 && d < 24; }, use(u, t) {
    sfxAt('growl', u.pos); u.dash = { target: t, tx: t.pos.x, tz: t.pos.z, speed: 22, time: 0, onArrive: () => { if (!t.dead && u.edgeDist(t) < 2) { dmg(u, t, { amount: mobAmt(u, 1.3) }); buff(t, B.stun(1)); G.vfx?.burst(t.pos, 'dust'); } } };
  } },
  stomp: { cd: 13, cond: (u, t) => u.edgeDist(t) < 4, use(u) {
    const r = 5 * Math.max(1, u.model?.scale || 1) ** 0.5;
    tele({ x: u.pos.x, z: u.pos.z, r, dur: 1.2 }); danger({ shape: 'circle', x: u.pos.x, z: u.pos.z, r, dur: 1.2 });
    u.playAct('slam', 1.2); castLock(u, 1.2, L('Yer Sarsıntısı|Stomp'));
    later(1.2, () => { if (u.dead) return; for (const e of enemiesNear(u, u.pos.x, u.pos.z, r)) { dmg(u, e, { amount: mobAmt(u, 1.5) }); buff(e, B.stun(1.5)); } G.vfx?.ring(u.pos, r, 0xc8a070); G.vfx?.burst(u.pos, 'dust', { n: 25, r: r * 0.6 }); sfxAt('explosion', u.pos, { pitch: 0.6, vol: 0.7 }); shakeNear(u, 0.4); });
  } },
  slam: { cd: 10, cond: (u, t) => u.distTo(t) < 18, use(u, t) {
    const x = t.pos.x, z = t.pos.z, r = 4;
    tele({ x, z, r, dur: 1.4 }); danger({ shape: 'circle', x, z, r, dur: 1.4 });
    u.playAct('overhead', 1.4); castLock(u, 1.4, L('Ezici Darbe|Crushing Slam'));
    later(1.4, () => { if (u.dead) return; for (const e of enemiesNear(u, x, z, r)) dmg(u, e, { amount: mobAmt(u, 2.0) }); G.vfx?.burst({ x, y: G.world.groundAt(x, z), z }, 'dust', { n: 25, r: 3 }); sfxAt('explosion', { x, y: 0, z }, { pitch: 0.8 }); shakeNear(u, 0.35); });
  } },
  cleave: { cd: 7, cond: (u, t) => u.edgeDist(t) < 3.5, use(u, t) {
    u.faceTo(t.pos.x, t.pos.z);
    const r = 5 + u.radius, ang = 1.8;
    tele({ shape: 'cone', x: u.pos.x, z: u.pos.z, r, angle: ang, yaw: u.yaw, dur: 0.9 }); danger({ shape: 'cone', x: u.pos.x, z: u.pos.z, r, angle: ang, yaw: u.yaw, dur: 0.9 });
    castLock(u, 0.9, L('Yarma|Cleave'));
    const yaw = u.yaw, x = u.pos.x, z = u.pos.z;
    later(0.9, () => { if (u.dead) return; u.playAct('slash2', 0.5); for (const e of enemiesNear(u, x, z, r + 1)) { const a = Math.atan2(e.pos.x - x, e.pos.z - z); if (Math.abs(angleDiff(yaw, a)) < ang / 2 + 0.1) dmg(u, e, { amount: mobAmt(u, 1.6) }); } G.vfx?.slash(u, 0xff6a5a); sfxAt('swing_heavy', u.pos); });
  } },
  whirl: { cd: 15, cond: (u, t) => u.edgeDist(t) < 4, use(u) {
    const r = 5.5;
    tele({ x: u.pos.x, z: u.pos.z, r, dur: 1.0 }); danger({ shape: 'circle', x: u.pos.x, z: u.pos.z, r, dur: 2.2 });
    castLock(u, 1.0, L('Kasırga|Bladestorm'));
    later(1.0, () => { if (u.dead) return; u.playAct('spin', 1.2, { turns: 3 }); for (let i = 0; i < 3; i++) later(i * 0.4, () => { if (u.dead) return; for (const e of enemiesNear(u, u.pos.x, u.pos.z, r)) dmg(u, e, { amount: mobAmt(u, 0.8) }); sfxAt('swing', u.pos); }); });
  } },
  howl: { cd: 25, cond: () => true, use(u) {
    u.playAct('roar', 1); sfxAt('howl', u.pos);
    for (const a of G.world.unitsNear(u.pos.x, u.pos.z, 15, x => x.kind === 'monster' && !x.dead)) buff(a, { id: 'howl', name: L('Uluma|Howl'), icon: 'wolf', dur: 10, mods: { dmgPct: 25 }, fx: 'berserk' }, u);
  } },
  leap: { cd: 12, cond: (u, t) => { const d = u.distTo(t); return d > 6 && d < 20; }, use(u, t) {
    const x = t.pos.x, z = t.pos.z;
    tele({ x, z, r: 3, dur: 0.9 }); danger({ shape: 'circle', x, z, r: 3, dur: 0.9 });
    u.dash = { tx: x, tz: z, speed: u.distTo(t) / 0.9, time: 0, onArrive: () => { if (u.dead) return; for (const e of enemiesNear(u, x, z, 3)) dmg(u, e, { amount: mobAmt(u, 1.4) }); G.vfx?.burst({ x, y: G.world.groundAt(x, z), z }, 'dust', { n: 15 }); } };
    u.vy = 8; u.airY = 0.01; u.playAct('leap', 0.9);
  } },
  poisonSpit: { cd: 8, cond: (u, t) => u.distTo(t) < 18, use(u, t) {
    u.playAct('bite', 0.5); G.vfx?.projectile({ from: u, to: t, kind: 'spit', speed: 20, onHit: () => dot(u, t, { id: 'mobpoison', name: L('Zehir|Poison'), icon: 'poison_drop', dur: 8, coef: 0, ticks: 4, school: 'nature', fx: 'poison', extra: { tick: (x, b) => dmg(u, x, { amount: mobAmt(u, 0.25), school: 'nature', dot: true }) } }) });
  } },
  poisonSting: { cd: 9, cond: (u, t) => u.edgeDist(t) < 3, use(u, t) {
    u.playAct('thrust', 0.6); later(0.35, () => { if (u.dead || t.dead) return; dmg(u, t, { amount: mobAmt(u, 1.1) }); buff(t, { id: 'sting', name: L('Akrep Zehri|Scorpion Venom'), icon: 'poison_drop', dur: 9, debuff: true, interval: 1.5, fx: 'poison', tick: x => dmg(u, x, { amount: mobAmt(u, 0.3), school: 'nature', dot: true }) }, u); });
  } },
  web: { cd: 16, cond: (u, t) => u.distTo(t) < 18, use(u, t) {
    u.playAct('bite', 0.5); sfxAt('screech', u.pos, { vol: 0.5 });
    G.vfx?.projectile({ from: u, to: t, kind: 'web', speed: 18, onHit: () => buff(t, { ...B.root(3), id: 'web', name: L('Ağ|Webbed'), icon: 'net' }) });
  } },
  heal: { cd: 10, cond: (u) => !!woundedAlly(u, 0.55), use(u) {
    const a = woundedAlly(u, 0.55);
    mobCast(u, 1.6, L('Şifa|Heal'), () => { if (!a.dead) { heal(u, a, { amount: a.stats.maxHp * 0.25, silent: false }); G.vfx?.burst(a.pos, 'heal'); } });
  } },
  roots: { cd: 14, cond: (u, t) => u.distTo(t) < 20, use(u, t) {
    mobCast(u, 1.2, L('Kökler|Entangling Roots'), () => { if (t.dead) return; buff(t, { ...B.root(3), id: 'roots', name: L('Kökler|Roots'), icon: 'vines', interval: 1, tick: x => dmg(u, x, { amount: mobAmt(u, 0.25), school: 'nature', dot: true }) }, u); G.vfx?.burst(t.pos, 'nature', { n: 15 }); });
  } },
  sporeCloud: { cd: 12, cond: (u, t) => u.edgeDist(t) < 5, use(u) {
    const x = u.pos.x, z = u.pos.z;
    G.vfx?.groundFx({ x, z }, 4, 0x8ae83a, 5); danger({ shape: 'circle', x, z, r: 4, dur: 5 });
    let n = 5; const tick = () => { if (n-- <= 0) return; for (const e of enemiesNear(u, x, z, 4)) dmg(u, e, { amount: mobAmt(u, 0.35), school: 'nature', dot: true }); later(1, tick); }; later(1, tick);
  } },
  hex: { cd: 18, cond: (u, t) => u.distTo(t) < 20, use(u, t) {
    mobCast(u, 1.4, L('Lanet|Hex'), () => buff(t, { id: 'hex', name: L('Lanetlendi|Hexed'), icon: 'skull', dur: 6, debuff: true, flags: { slow: 0.5 }, mods: { dmgPct: -20 }, fx: 'shadowDot' }, u));
  } },
  enrage: { cd: 999, once: true, cond: (u) => u.hpPct < 0.3, use(u) {
    buff(u, { id: 'enrage', name: L('Öfke|Enrage'), icon: 'rage', dur: 9999, mods: { dmgPct: 50, speed: 25 }, fx: 'berserk' }, u);
    u.playAct('roar', 1); sfxAt('roar', u.pos, { pitch: 1.2 });
    if (u.isBoss) G.ui?.bossEmote?.(L(`${u.name} öfkeleniyor!|${u.name} becomes enraged!`));
  } },
  sandstorm: { cd: 16, cond: (u, t) => u.edgeDist(t) < 6, use(u) {
    const r = 7;
    tele({ x: u.pos.x, z: u.pos.z, r, dur: 1.2, color: 0xd8a040 }); danger({ shape: 'circle', x: u.pos.x, z: u.pos.z, r, dur: 4 });
    castLock(u, 1.2, L('Kum Fırtınası|Sandstorm'));
    later(1.2, () => { let n = 4; const tick = () => { if (n-- <= 0 || u.dead) return; for (const e of enemiesNear(u, u.pos.x, u.pos.z, r)) { dmg(u, e, { amount: mobAmt(u, 0.5) }); buff(e, B.slow(0.4, 2)); } G.vfx?.burst(u.pos, 'dust', { n: 25, r: r * 0.8 }); later(0.7, tick); }; tick(); });
  } },
  curse: { cd: 15, cond: (u, t) => u.distTo(t) < 20, use(u, t) {
    mobCast(u, 1.3, L('Firavun Laneti|Pharaoh\'s Curse'), () => buff(t, { id: 'curse', name: L('Lanet|Curse'), icon: 'skull', dur: 10, debuff: true, interval: 2, flags: { healRed: 1 }, fx: 'shadowDot', tick: x => dmg(u, x, { amount: mobAmt(u, 0.35), school: 'shadow', dot: true }) }, u));
  } },
  shield: { cd: 20, cond: (u) => u.hpPct < 0.75, use(u) { buff(u, { id: 'mobshield', name: L('Kalkan|Shield'), icon: 'barrier', dur: 10, absorb: u.stats.maxHp * 0.25, fx: 'arcaneShield' }, u); sfxAt('shield_up', u.pos); } },
  burrow: { cd: 15, cond: (u, t) => u.distTo(t) > 3, use(u, t) {
    u.anim.emerge = 0; buff(u, { id: 'burrow', name: L('Toprağa Gömüldü|Burrowed'), icon: 'earthquake', dur: 2.2, flags: { invuln: 1 } }, u);
    const x = t.pos.x, z = t.pos.z;
    tele({ x, z, r: 4, dur: 2.0, color: 0xd8a040 }); danger({ shape: 'circle', x, z, r: 4, dur: 2.0 });
    later(1.2, () => { if (u.dead) return; u.pos.x = x; u.pos.z = z; });
    later(2.0, () => { if (u.dead) return; u.anim.emerge = null; for (const e of enemiesNear(u, x, z, 4)) { dmg(u, e, { amount: mobAmt(u, 2) }); e.vy = 6; e.airY = 0.01; } G.vfx?.burst({ x, y: G.world.groundAt(x, z), z }, 'dust', { n: 40, r: 3 }); sfxAt('roar', u.pos, { pitch: 0.8 }); shakeNear(u, 0.5); });
  } },
  rockThrow: { cd: 9, cond: (u, t) => u.distTo(t) > 5 && u.distTo(t) < 24, use(u, t) {
    u.playAct('throw', 0.8); later(0.45, () => G.vfx?.projectile({ from: u, to: t, kind: 'rock', speed: 18, onHit: () => { dmg(u, t, { amount: mobAmt(u, 1.5) }); } }));
  } },
  frostNova: { cd: 15, cond: (u, t) => u.edgeDist(t) < 6, use(u) {
    const r = 7;
    tele({ x: u.pos.x, z: u.pos.z, r, dur: 1.0, color: 0x6ad8ff }); danger({ shape: 'circle', x: u.pos.x, z: u.pos.z, r, dur: 1.0 });
    castLock(u, 1.0, L('Buz Halkası|Frost Nova'));
    later(1.0, () => { if (u.dead) return; for (const e of enemiesNear(u, u.pos.x, u.pos.z, r)) { dmg(u, e, { amount: mobAmt(u, 1.0), school: 'frost' }); buff(e, B.root(2.5)); } G.vfx?.ring(u.pos, r, 0x8ad8ff); G.vfx?.burst(u.pos, 'frost', { n: 40, r: 5 }); sfxAt('ice_shatter', u.pos); });
  } },
  firebreath: { cd: 11, cond: (u, t) => u.distTo(t) < 9, use(u, t) { breath(u, t, 'fire', 0xff6a1a, 9, 1.2); } },
  breathFrost: { cd: 12, cond: (u, t) => u.distTo(t) < 14, use(u, t) { breath(u, t, 'frost', 0x6ad8ff, 14, 1.5); } },
  breathShadow: { cd: 12, cond: (u, t) => u.distTo(t) < 14, use(u, t) { breath(u, t, 'shadow', 0xb86aff, 14, 1.5); } },
  fireNova: { cd: 12, cond: (u, t) => u.edgeDist(t) < 6, use(u) {
    const r = 6 + u.radius;
    tele({ x: u.pos.x, z: u.pos.z, r, dur: 1.2, color: 0xff6a1a }); danger({ shape: 'circle', x: u.pos.x, z: u.pos.z, r, dur: 1.2 });
    castLock(u, 1.2, L('Ateş Dalgası|Fire Nova'));
    later(1.2, () => { if (u.dead) return; for (const e of enemiesNear(u, u.pos.x, u.pos.z, r)) dmg(u, e, { amount: mobAmt(u, 1.6), school: 'fire' }); G.vfx?.ring(u.pos, r, 0xff7a2a); G.vfx?.burst(u.pos, 'fire', { n: 50, r: r * 0.7 }); sfxAt('explosion', u.pos); });
  } },
  meteor: { cd: 14, cond: (u, t) => u.distTo(t) < 28, use(u, t) {
    const x = t.pos.x, z = t.pos.z, r = 5;
    tele({ x, z, r, dur: 2.0, color: 0xff6a1a }); danger({ shape: 'circle', x, z, r, dur: 2.0 });
    G.vfx?.meteor({ x, z }, 2.0); u.playAct('raise', 1);
    later(2.0, () => { if (u.dead) return; for (const e of enemiesNear(u, x, z, r)) dmg(u, e, { amount: mobAmt(u, 2.6), school: 'fire' }); G.vfx?.burst({ x, y: G.world.groundAt(x, z), z }, 'explosion', { n: 40, r: 4 }); sfxAt('explosion', { x, y: 0, z }); shakeNear(u, 0.5); });
  } },
  tailSwipe: { cd: 11, cond: (u, t) => u.edgeDist(t) < 6, use(u) {
    const r = 6 + u.radius;
    tele({ x: u.pos.x, z: u.pos.z, r, dur: 1.1 }); danger({ shape: 'circle', x: u.pos.x, z: u.pos.z, r, dur: 1.1 });
    castLock(u, 1.1, L('Kuyruk Savuruşu|Tail Swipe'));
    later(1.1, () => { if (u.dead) return; u.playAct('tail', 0.8); for (const e of enemiesNear(u, u.pos.x, u.pos.z, r)) { dmg(u, e, { amount: mobAmt(u, 1.4) }); knock(e, u.pos.x, u.pos.z, 12); } sfxAt('swing_heavy', u.pos, { pitch: 0.6 }); });
  } },
  blizzard: { cd: 20, cond: (u, t) => u.distTo(t) < 25, use(u, t) {
    u.playAct('raise', 1.5); castLock(u, 0.8, L('Tipi|Blizzard'));
    for (let i = 0; i < 4; i++) {
      const x = t.pos.x + rand(-6, 6) * (i ? 1 : 0), z = t.pos.z + rand(-6, 6) * (i ? 1 : 0);
      tele({ x, z, r: 4, dur: 2.2, color: 0x6ad8ff }); danger({ shape: 'circle', x, z, r: 4, dur: 2.2 });
      later(2.2, () => { if (u.dead) return; for (const e of enemiesNear(u, x, z, 4)) { dmg(u, e, { amount: mobAmt(u, 1.4), school: 'frost' }); buff(e, B.slow(0.5, 3)); } G.vfx?.burst({ x, y: G.world.groundAt(x, z), z }, 'frost', { n: 25, r: 3 }); });
    }
    sfxAt('frost_cast', u.pos);
  } },
  voidZone: { cd: 10, cond: (u, t) => u.distTo(t) < 28, use(u, t) {
    const x = t.pos.x, z = t.pos.z, r = 3.5;
    tele({ x, z, r, dur: 1.0, color: 0x8a3aff });
    later(1.0, () => {
      if (u.dead) return;
      G.vfx?.groundFx({ x, z }, r, 0x8a3aff, 8); danger({ shape: 'circle', x, z, r, dur: 8 });
      let n = 16; const tick = () => { if (n-- <= 0) return; for (const e of enemiesNear(u, x, z, r)) dmg(u, e, { amount: mobAmt(u, 0.45), school: 'shadow', dot: true }); later(0.5, tick); }; tick();
    });
  } },
  fear: { cd: 20, cond: (u, t) => u.distTo(t) < 10 && !t.isBoss, use(u, t) {
    mobCast(u, 1.0, L('Dehşet Çığlığı|Terrifying Shriek'), () => { for (const e of enemiesNear(u, u.pos.x, u.pos.z, 10).slice(0, 3)) buff(e, { id: 'fear', name: L('Dehşet|Fear'), icon: 'ghost', dur: 3, debuff: true, flags: { fear: 1 }, data: { from: u }, fx: 'fear' }, u); sfxAt('screech', u.pos); });
  } },
  drain: { cd: 12, cond: (u, t) => u.distTo(t) < 18, use(u, t) {
    castLock(u, 3, L('Can Emme|Drain Life'));
    let n = 6; const tick = () => { if (n-- <= 0 || u.dead || t.dead || u.stunned) return; const d = dmg(u, t, { amount: mobAmt(u, 0.4), school: 'shadow', dot: true }); heal(u, u, { amount: d * 2, silent: true }); G.vfx?.beam(t, u, 0xb84aff, 0.45); later(0.5, tick); }; tick();
  } },
  deathGrip: { cd: 15, cond: (u, t) => u.distTo(t) > 6 && u.distTo(t) < 25, use(u, t) {
    G.vfx?.beam(u, t, 0x6ad8ff, 0.5); sfxAt('shadow_cast', u.pos);
    const ang = Math.atan2(t.pos.x - u.pos.x, t.pos.z - u.pos.z);
    const tx = u.pos.x + Math.sin(ang) * (u.radius + 1.5), tz = u.pos.z + Math.cos(ang) * (u.radius + 1.5);
    t.dash = { tx, tz, speed: 30, time: 0, face: false, onArrive: () => dmg(u, t, { amount: mobAmt(u, 0.8), school: 'shadow' }) };
  } },
  spitVolley: { cd: 10, cond: () => true, use(u) {
    const tg = enemiesNear(u, u.pos.x, u.pos.z, 30).slice(0, 5);
    u.playAct('bite', 0.6);
    for (const e of tg) G.vfx?.projectile({ from: u, to: e, kind: 'spit', speed: 16, onHit: () => dmg(u, e, { amount: mobAmt(u, 0.9), school: 'nature' }) });
  } },
  shadowNova: { cd: 25, cond: () => true, use(u) {
    const r = 12;
    tele({ x: u.pos.x, z: u.pos.z, r, dur: 3.0, color: 0x8a3aff }); danger({ shape: 'circle', x: u.pos.x, z: u.pos.z, r, dur: 3.0 });
    castLock(u, 3.0, L('Gölge Patlaması|Shadow Cataclysm'));
    G.ui?.bossEmote?.(L(`${u.name} karanlık enerji topluyor! Uzaklaş!|${u.name} gathers dark energy! Get away!`));
    later(3.0, () => { if (u.dead) return; for (const e of enemiesNear(u, u.pos.x, u.pos.z, r)) dmg(u, e, { amount: mobAmt(u, 4), school: 'shadow' }); G.vfx?.ring(u.pos, r, 0x8a3aff, 1); G.vfx?.burst(u.pos, 'shadow', { n: 80, r: 8 }); shakeNear(u, 0.8); sfxAt('explosion', u.pos, { pitch: 0.5 }); });
  } },
  poisonNova: { cd: 14, cond: (u, t) => u.edgeDist(t) < 7, use(u) {
    const r = 8;
    tele({ x: u.pos.x, z: u.pos.z, r, dur: 1.4, color: 0x8ae83a }); danger({ shape: 'circle', x: u.pos.x, z: u.pos.z, r, dur: 1.4 });
    castLock(u, 1.4, L('Zehir Bulutu|Venom Burst'));
    later(1.4, () => { if (u.dead) return; for (const e of enemiesNear(u, u.pos.x, u.pos.z, r)) { dmg(u, e, { amount: mobAmt(u, 1.0), school: 'nature' }); buff(e, { id: 'venom', name: L('Zehir|Venom'), icon: 'poison_drop', dur: 8, debuff: true, interval: 1, fx: 'poison', tick: x => dmg(u, x, { amount: mobAmt(u, 0.2), school: 'nature', dot: true }) }, u); } G.vfx?.burst(u.pos, 'poison', { n: 50, r: 6 }); });
  } },
  // summons
  summonSlimes: summonAb('slime', 4, 25), summonGoblins: summonAb('goblin', 3, 30), summonWisps: summonAb('wisp', 3, 30),
  summonBroodlings: summonAb('broodling', 5, 22), summonSand: summonAb('sand_elemental', 2, 35), summonScarabs: summonAb('scarab_beetle', 5, 25),
  summonImps: summonAb('imp', 3, 28), summonSkeletons: summonAb('skeleton', 3, 30), summonFiends: summonAb('shadow_fiend', 2, 30),
};
function summonAb(tpl, n, cd) {
  return { cd, cond: (u) => u.inCombat && (u._summoned || 0) < 6, use(u) {
    u.playAct('roar', 1); sfxAt('summon', u.pos);
    G.ui?.bossEmote?.(L(`${u.name} yardım çağırıyor!|${u.name} calls for aid!`));
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, d = u.radius + 3 + Math.random() * 3;
      const m = G.factory.monster(tpl, Math.max(1, u.level - 2), u.pos.x + Math.sin(a) * d, u.pos.z + Math.cos(a) * d, { summoned: true, noLoot: true, xpMult: 0.3 });
      G.vfx?.burst(m.pos, 'smoke', { n: 10 });
      const t = u.target; if (t) m.ai.aggro(t);
      u._summoned = (u._summoned || 0) + 1;
      m.data.onDeath = () => { u._summoned--; };
    }
  } };
}
function breath(u, t, school, color, r, dur) {
  u.faceTo(t.pos.x, t.pos.z);
  const yaw = u.yaw, x = u.pos.x, z = u.pos.z, ang = 1.2;
  tele({ shape: 'cone', x, z, r, angle: ang, yaw, dur, color }); danger({ shape: 'cone', x, z, r, angle: ang, yaw, dur });
  castLock(u, dur + 0.6, L('Nefes|Breath'));
  u.playAct('breath', dur + 0.8);
  later(dur, () => {
    if (u.dead) return;
    for (const e of enemiesNear(u, x, z, r + 1)) { const a = Math.atan2(e.pos.x - x, e.pos.z - z); if (Math.abs(angleDiff(yaw, a)) < ang / 2 + 0.1) dmg(u, e, { amount: mobAmt(u, 2.2), school }); }
    for (let i = 0; i < 40; i++) { const a = yaw + rand(-ang / 2, ang / 2), sp = rand(8, 16); G.vfx?.emitOne(school === 'shadow' ? 'shadow' : school, x + Math.sin(yaw) * 1.5, u.pos.y + u.height * 0.6, z + Math.cos(yaw) * 1.5, Math.sin(a) * sp, rand(-1, 1), Math.cos(a) * sp, 2); }
    sfxAt(school === 'fire' ? 'fireball' : school === 'frost' ? 'frost_cast' : 'shadow_cast', u.pos);
  });
}
function knock(e, fx, fz, force) {
  if (e.isBoss || e.hasFlag('ccImmune')) return;
  const a = Math.atan2(e.pos.x - fx, e.pos.z - fz);
  e.vel.x += Math.sin(a) * force; e.vel.z += Math.cos(a) * force; e.vy = 5; e.airY = 0.01;
}
function shakeNear(u, a) { const p = G.player; if (p && u.distTo(p) < 25) G.engine.shake(a); }
function castLock(u, dur, name) { u.cast = { t: 0, dur, mob: true, name, noFace: true }; }
function mobCast(u, dur, name, fn) {
  u.cast = { t: 0, dur, mob: true, name, fn };
  u.anim.cast = 'forward';
}
function woundedAlly(u, th) {
  let best = null;
  for (const a of G.world.unitsNear(u.pos.x, u.pos.z, 20, x => x.kind === 'monster' && !x.dead && x.team === u.team)) if (a.hpPct < th && (!best || a.hpPct < best.hpPct)) best = a;
  return best;
}

// ================================================================== MonsterAI
export class MonsterAI {
  constructor(u) {
    this.u = u; u.ai = this;
    this.state = 'idle';
    this.home = { x: u.pos.x, z: u.pos.z };
    this.thinkT = Math.random() * 0.3;
    this.wanderT = rand(2, 8);
    this.wander = null;
    this.atkT = rand(0.5, 1.2);
    this.cds = {};
    this.tpl = u.data.tpl;
    for (const id of this.tpl.ab || []) this.cds[id] = rand(3, (A[id]?.cd || 10) * 0.6);
    this.combatTime = 0;
  }
  get leash() { return this.u.isBoss ? (this.u.data.leash || 60) : 42; }
  aggro(t) {
    if (!t || t.dead || this.state === 'return') return;
    const u = this.u;
    if (!u.threat.has(t)) u.threat.set(t, 1);
    if (this.state !== 'combat') {
      this.state = 'combat'; this.combatTime = 0;
      if (this.tpl.sfx || u.data.family === 'beast') sfxAt(this.tpl.sfx || 'growl', u.pos, { vol: 0.5, pitch: rand(0.9, 1.15) });
      // social pull
      const sr = this.tpl.social;
      if (sr) for (const o of G.world.unitsNear(u.pos.x, u.pos.z, sr, x => x.kind === 'monster' && !x.dead && x.ai && x.ai.state === 'idle' && !x.passive)) o.ai.aggro(t);
      emit('mobAggro', u, t);
    }
    u.enterCombat();
  }
  onDamaged(src) {
    if (!src || src === this.u) return;
    const atk = src.kind === 'pet' && src.owner ? src : src;
    if (this.state !== 'return') this.aggro(atk);
  }
  onTaunt(src) { this.tauntT = 3; this.u.target = src; }
  pickTarget() {
    const u = this.u;
    if (this.tauntT > 0 && u.target && !u.target.dead) return u.target;
    let best = null, bv = -1;
    for (const [t, v] of u.threat) {
      if (!t || t.dead || t.removed || distSq2(t.pos.x, t.pos.z, this.home.x, this.home.z) > (this.leash + 15) ** 2) { u.threat.delete(t); continue; }
      if (t.hasFlag('stealth')) continue;
      const vv = v * (t === u.target ? 1.1 : 1); // stickiness
      if (vv > bv) { bv = vv; best = t; }
    }
    return best;
  }
  scan() {
    const u = this.u;
    if (u.passive || !this.tpl.aggro) return null;
    let best = null, bd = 1e9;
    for (const t of G.world.units) {
      if (t.dead || !u.isEnemy(t) || t.kind === 'critter') continue;
      let r = this.tpl.aggro * (u.isBoss ? 1 : 1);
      if (t.isHero) { const dl = t.level - u.level; if (dl >= 6) r *= 0.4; else if (dl >= 3) r *= 0.7; }
      if (t.hasFlag('stealth')) r = Math.min(r, 2.5);
      if (t.data?.noAggro) continue;
      const d = distSq2(u.pos.x, u.pos.z, t.pos.x, t.pos.z);
      if (d < r * r && d < bd) { bd = d; best = t; }
    }
    return best;
  }
  update(dt) {
    const u = this.u;
    if (u.dead) return;
    if (this.tauntT > 0) this.tauntT -= dt;
    for (const k in this.cds) this.cds[k] -= dt;
    // monster casting
    if (u.cast && u.cast.mob) {
      u.cast.t += dt;
      if (u.target && !u.target.dead && !u.cast.noFace) u.faceTo(u.target.pos.x, u.target.pos.z, dt, 6);
      u.anim.move = 0;
      if (u.stunned) { u.cast = null; u.anim.cast = null; return; }
      if (u.cast.t >= u.cast.dur) { const fn = u.cast.fn; u.cast = null; u.anim.cast = null; if (fn) { u.playAct('release', 0.4); try { fn(); } catch (e) { console.error(e); } } }
      return;
    }
    if (u.dash) { updateDash(u, dt); return; }
    if (u.stunned) { u.anim.move = 0; return; }
    const fear = u.buffs.find(b => b.flags?.fear);
    if (fear) {
      const src = fear.data?.from || fear.src;
      if (src) { const a = Math.atan2(u.pos.x - src.pos.x, u.pos.z - src.pos.z); moveTowards(u, u.pos.x + Math.sin(a) * 5, u.pos.z + Math.cos(a) * 5, dt, 0.8); }
      return;
    }
    this.thinkT -= dt;
    if (this.thinkT <= 0) { this.thinkT = 0.25 + Math.random() * 0.1; this.think(); }
    if (this.state === 'idle') {
      if (this.wander) { if (moveTowards(u, this.wander.x, this.wander.z, dt, 0.45)) this.wander = null; }
      else u.anim.move = 0;
    } else if (this.state === 'return') {
      if (moveTowards(u, this.home.x, this.home.z, dt, 1.4, 0.5)) {
        this.state = 'idle'; u.hp = u.stats.maxHp; u.removeBuff('evade'); u.threat.clear(); u.target = null;
      }
    } else if (this.state === 'combat') this.combat(dt);
  }
  think() {
    const u = this.u;
    if (this.state === 'idle') {
      const t = this.scan();
      if (t) { this.aggro(t); return; }
      this.wanderT -= 0.3;
      if (this.wanderT <= 0 && !this.tpl.stationary) {
        this.wanderT = rand(4, 10);
        const a = Math.random() * Math.PI * 2, d = rand(1, u.data.wanderR ?? 7);
        const x = this.home.x + Math.sin(a) * d, z = this.home.z + Math.cos(a) * d;
        if (!G.world.terrain || !G.world.terrain.isWater(x, z) || u.data.swim) this.wander = { x, z };
      }
    } else if (this.state === 'combat') {
      const t = this.pickTarget();
      if (!t || distSq2(u.pos.x, u.pos.z, this.home.x, this.home.z) > this.leash ** 2 && !u.data.noLeash) { this.evade(); return; }
      u.target = t;
      // abilities
      for (const id of this.tpl.ab || []) {
        const ab = A[id]; if (!ab) continue;
        if (this.cds[id] > 0 || (ab.once && this['used_' + id])) continue;
        if (!ab.cond(u, t)) continue;
        this.cds[id] = ab.cd * (u.isBoss ? 0.85 : 1) + rand(0, 2);
        if (ab.once) this['used_' + id] = true;
        ab.use(u, t);
        return;
      }
    }
  }
  evade() {
    const u = this.u;
    if (u.isBoss && G.world.dungeon) { u.threat.clear(); u.target = null; this.state = 'idle'; u.hp = u.stats.maxHp; return; }
    this.state = 'return'; u.target = null; u.threat.clear();
    u.cast = null;
    buff(u, { id: 'evade', name: L('Kaçınıyor|Evading'), icon: 'shield', dur: 8, flags: { invuln: 1 }, mods: { speed: 60 } }, u);
    u.buffs = u.buffs.filter(b => !b.debuff);
  }
  combat(dt) {
    const u = this.u, t = u.target;
    if (!t || t.dead) { u.anim.move = 0; return; }
    this.combatTime += dt;
    const R = this.tpl.ranged;
    const reach = R ? R.range : u.radius + t.radius + 1.0;
    const d = u.distTo(t);
    if (d > reach - (R ? 2 : 0.1)) { moveTowards(u, t.pos.x, t.pos.z, dt, 1.12, R ? reach - 3 : u.radius + t.radius + 0.6); }
    else {
      u.anim.move = 0; u.faceTo(t.pos.x, t.pos.z, dt, 10);
      this.atkT -= dt;
      if (this.atkT <= 0) {
        this.atkT = (this.tpl.atk || 2.0) * rand(0.9, 1.1) / (1 + (u.stats.haste || 0) / 100);
        if (R) {
          const go = () => { u.playAct('release', 0.4); G.vfx?.projectile({ from: u, to: t, kind: R.kind, speed: R.kind === 'arrow' ? 36 : 22, onHit: () => dmg(u, t, { amount: mobAmt(u, 1.0), school: R.school || 'phys' }) }); if (R.kind === 'arrow') sfxAt('bow_shot', u.pos, { vol: 0.4 }); };
          if (R.cast) mobCast(u, R.cast, '', go); else { if (R.kind === 'arrow') u.playAct('bow', 0.5); go(); }
        } else {
          const anim = u.model?.rig === 'humanoid' ? choice(['slash', 'overhead', 'slash2']) : 'bite';
          u.playAct(anim, 0.6);
          later(0.28, () => { if (u.dead || t.dead || u.stunned) return; if (u.edgeDist(t) < 2.2) { dmg(u, t, { amount: mobAmt(u, rand(0.9, 1.1)) }); } });
        }
      }
    }
  }
}

// ================================================================== CritterAI
export class CritterAI {
  constructor(u) { this.u = u; u.ai = this; this.home = { x: u.pos.x, z: u.pos.z }; this.t = rand(1, 5); this.goal = null; this.flee = 0; }
  onDamaged(src) { this.flee = 4; this.src = src; }
  update(dt) {
    const u = this.u;
    if (u.dead) return;
    if (this.flee > 0 && this.src) {
      this.flee -= dt;
      const a = Math.atan2(u.pos.x - this.src.pos.x, u.pos.z - this.src.pos.z);
      moveTowards(u, u.pos.x + Math.sin(a) * 4, u.pos.z + Math.cos(a) * 4, dt, 1.4);
      return;
    }
    this.t -= dt;
    if (this.goal) { if (moveTowards(u, this.goal.x, this.goal.z, dt, 0.5)) this.goal = null; }
    else u.anim.move = 0;
    if (this.t <= 0) {
      this.t = rand(3, 9);
      const a = Math.random() * Math.PI * 2, d = rand(2, 10);
      const x = this.home.x + Math.sin(a) * d, z = this.home.z + Math.cos(a) * d;
      if (!G.world.terrain.isWater(x, z)) this.goal = { x, z };
      if (Math.random() < 0.3) u.anim.sit = !u.anim.sit && !this.goal;
    }
  }
}

// ================================================================== PetAI
export class PetAI {
  constructor(u, owner) { this.u = u; u.ai = this; this.owner = owner; this.atkT = 1; }
  onDamaged(src) { if (src && !this.u.target) this.u.target = src; }
  update(dt) {
    const u = this.u, o = this.owner;
    if (u.dead) return;
    if (!o || o.dead || o.removed) { u.anim.move = 0; return; }
    if (u.stunned) { u.anim.move = 0; return; }
    const dO = u.distTo(o);
    if (dO > 45) { u.pos.x = o.pos.x + rand(-2, 2); u.pos.z = o.pos.z + rand(-2, 2); }
    // choose target: owner's target if enemy and engaged, or whoever attacks owner
    let t = u.target;
    if (o.target && o.isEnemy(o.target) && !o.target.dead && (o.inCombat || o.autoAttack) && o.target.kind !== 'critter') t = o.target;
    if (t && (t.dead || !u.isEnemy(t) || t.distTo(o) > 35)) t = null;
    if (!t && o.inCombat) t = G.world.nearestEnemy(o, 12, e => e.target === o || e.target?.inParty);
    u.target = t;
    if (t) {
      const reach = u.radius + t.radius + 0.8;
      if (u.distTo(t) > reach) moveTowards(u, t.pos.x, t.pos.z, dt, 1.25, reach - 0.3);
      else {
        u.anim.move = 0; u.faceTo(t.pos.x, t.pos.z, dt);
        this.atkT -= dt;
        if (this.atkT <= 0) {
          this.atkT = 1.6;
          u.playAct(u.model.rig === 'humanoid' ? 'slash' : 'bite', 0.5);
          later(0.25, () => { if (!u.dead && !t.dead) { dmg(u, t, { amount: mobAmt(u, 1) * (1 + ((o.skillMods?.pet) || 0) / 100), threat: 1.2 }); } });
        }
      }
    } else {
      const fa = o.yaw + Math.PI + (u.data.slot || 0) * 0.7 - 0.35;
      const fx = o.pos.x + Math.sin(fa) * 2.6, fz = o.pos.z + Math.cos(fa) * 2.6;
      if (distSq2(u.pos.x, u.pos.z, fx, fz) > 1.5) moveTowards(u, fx, fz, dt, dO > 8 ? 1.6 : 1.05, 0.5);
      else { u.anim.move = 0; }
    }
  }
}

// ================================================================== NPC idle
export class NpcAI {
  constructor(u) { this.u = u; u.ai = this; this.t = rand(3, 10); this.baseYaw = u.yaw; this.path = u.data.patrol; this.pi = 0; }
  update(dt) {
    const u = this.u, p = G.player;
    if (this.path) {
      const wp = this.path[this.pi];
      if (moveTowards(u, wp[0], wp[1], dt, 0.5)) { this.pi = (this.pi + 1) % this.path.length; }
      return;
    }
    u.anim.move = 0;
    if (p && u.distTo(p) < 7) u.faceTo(p.pos.x, p.pos.z, dt, 4);
    else u.yaw = dampAngle(u.yaw, this.baseYaw, 2, dt);
    this.t -= dt;
    if (this.t <= 0) { this.t = rand(6, 16); if (Math.random() < 0.4) u.anim.emote = { type: choice(['wave', 'point', 'laugh', 'salute']), t: 0, dur: 2 }; }
  }
}
export { A as MOB_ABILITIES, knock };

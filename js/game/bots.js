// Hero bots: AI adventurers that populate the world, join parties, fill dungeons and fight in the arena.
import { G, emit, on } from '../core/state.js';
import { L, t, getLang } from '../core/i18n.js';
import { rand, randi, choice, chance, clamp, distSq2, dist2, rng, uid } from '../core/util.js';
import { CLASSES, RACES, CLASS_IDS, RACE_IDS, randomName, S } from '../data/classes.js';
import { SKILLS, CLASS_SKILLS } from '../data/skills.js';
import { TALENTS } from '../data/talents.js';
import { HAIR, EYES } from '../gfx/models.js';
import { createHero, refreshHero } from './hero.js';
import { genEquip } from './items.js';
import { useSkill, skillCost, skillRange } from './skillsys.js';
import { moveTowards, inDanger } from './ai.js';
import { heal, buff } from './combat.js';

const ROLE = { warrior: 'tank', cleric: 'healer', mage: 'dps', ranger: 'dps', rogue: 'dps', necro: 'dps' };
const GUILDS = ['Ejderhanlar', 'Kızıl Şafak', 'Gölge Kurtları', 'Ay Muhafızları', 'Demir Yemin', 'Fırtına', 'Altın Kartal', 'Kayıp Ruhlar', 'Silverwind', 'Night Watch', 'Crimson Order', 'Valhalla TR'];

export function makeBotChar(level, cls, o = {}) {
  cls = cls || choice(CLASS_IDS);
  const race = o.race || choice(RACE_IDS);
  const R = RACES[race];
  const ch = {
    name: o.name || randomName(), race, cls, body: chance(0.45) ? 1 : 0, skin: choice(R.skins), hair: randi(0, 7), hairColor: choice(HAIR), beard: race === 'dwarf' ? randi(1, 3) : chance(0.25) ? randi(1, 2) : 0, eyes: choice(EYES),
    level, equip: {}, talents: {},
  };
  const q = o.quality ?? 0.5;
  const rar = () => chance(q * 0.35) ? 'epic' : chance(0.5 + q * 0.3) ? 'rare' : 'uncommon';
  for (const slot of ['head', 'shoulders', 'chest', 'hands', 'legs', 'feet', 'main', 'cape', 'neck', 'ring', 'trinket']) {
    if (slot !== 'main' && chance(0.12)) continue;
    const it = genEquip({ slot, ilvl: Math.max(1, level + (o.ilvlBonus || 0)), rarity: rar(), cls, armorType: undefined });
    if (slot === 'main' || it.armorType === undefined || it.armorType === ({ warrior: 'plate', mage: 'cloth', ranger: 'mail', cleric: 'mail', rogue: 'leather', necro: 'cloth' })[cls]) ch.equip[slot === 'ring' ? 'ring' : slot] = it;
  }
  const main = ch.equip.main;
  if (main && !main.twoHand) { const off = CLASSES[cls].offhands[0]; if (off) ch.equip.off = genEquip({ slot: 'off', kind: off, ilvl: level, rarity: rar(), cls }); }
  // talents: spend points mostly in one branch
  const pts = Math.max(0, level - 9);
  const tree = TALENTS[cls];
  let left = pts;
  for (const br of [choice(tree), ...tree]) for (const n of br.nodes) { if (left <= 0) break; const r = Math.min(n.max, left); ch.talents[n.id] = (ch.talents[n.id] || 0) + r; left -= r; }
  return ch;
}

export function spawnBot(ch, x, z, mode, o = {}) {
  const u = createHero(ch, 'bot');
  u.pos.set(x, 0, z);
  u.team = o.team || 'player';
  u.guildTag = o.guildTag ?? (chance(0.55) ? choice(GUILDS) : null);
  u.title = o.title || null;
  u.data.botChar = ch;
  u.role = ROLE[ch.cls];
  new HeroAI(u, mode, o);
  G.world.addUnit(u);
  return u;
}

// ------------------------------------------------------------ rotations
const near = (u, r) => G.combat.enemiesNear(u, u.pos.x, u.pos.z, r).length;
const clustered = (t, r = 6) => t ? G.combat.enemiesNear(G.player || t, t.pos.x, t.pos.z, r).length : 0;
const hasDot = (t, id, u) => t.buffs.some(b => b.id === id + '@' + u.id);
const ROT = {
  warrior: [
    ['w_avatar', (u, t) => t.isBoss || t.elite], ['w_wall', u => u.hpPct < 0.35], ['w_charge', (u, t) => u.distTo(t) > 7],
    ['w_shout', (u, t, c) => (u.role === 'tank' && c.loose > 0) || u.res < 15], ['w_slam', u => near(u, 6) >= 3], ['w_whirl', u => near(u, 5) >= 2 && u.res >= 30],
    ['w_execute', (u, t) => t.hpPct < 0.3], ['w_rend', (u, t) => !hasDot(t, 'rend', u) && t.hp > u.stats.power * 4], ['w_cleave', u => near(u, 4) >= 2], ['w_strike', () => true],
  ],
  mage: [
    ['m_timewarp', (u, t) => t.isBoss], ['m_shield', u => u.hpPct < 0.6 && u.inCombat], ['m_nova', u => near(u, 6) >= 1 && u.hpPct < 0.7], ['m_meteor', (u, t) => clustered(t) >= 3 || t.isBoss],
    ['m_flamestrike', (u, t) => clustered(t) >= 2], ['m_chain', (u, t) => clustered(t, 10) >= 2], ['m_missiles', () => true], ['m_frostbolt', (u, t) => t.target === u], ['m_fireball', () => true],
  ],
  ranger: [
    ['r_wolf', u => !u.summons.some(s => !s.dead)], ['r_rapid', (u, t) => t.isBoss || t.elite], ['r_mark', (u, t) => (t.elite || t.isBoss) && !t.hasBuff('huntmark')], ['r_disengage', (u, t) => near(u, 3) > 0 && u.hpPct < 0.5],
    ['r_rain', (u, t) => clustered(t) >= 3], ['r_multi', (u, t) => clustered(t, 10) >= 2], ['r_sting', (u, t) => !hasDot(t, 'sting', u)], ['r_aimed', u => u.res >= 45], ['r_shot', () => true],
  ],
  cleric: [
    ['c_blessing', u => !u.hasBuff('blessing') && !u.inCombat], ['c_ascend', (u, t, c) => c.avgHp < 0.5], ['c_divine', (u, t, c) => c.low && c.low.hpPct < 0.35, 'low'],
    ['c_shield', (u, t, c) => c.low && c.low.hpPct < 0.7 && !c.low.hasBuff('weakSoul'), 'low'], ['c_nova', (u, t, c) => c.hurt >= 3], ['c_heal', (u, t, c) => c.low && c.low.hpPct < 0.72, 'low'],
    ['c_renew', (u, t, c) => c.low2 && c.low2.hpPct < 0.92 && !c.low2.buffs.some(b => b.id === 'renew@' + u.id), 'low2'],
    ['c_hammer', (u, t) => t.target === u], ['c_fire', (u, t, c) => c.avgHp > 0.8], ['c_smite', (u, t, c) => c.avgHp > 0.75],
  ],
  rogue: [
    ['g_flurry', (u, t) => t.isBoss || t.elite], ['g_evasion', u => u.hpPct < 0.4], ['g_poison', u => !u.hasBuff('poisonblades')], ['g_step', (u, t) => u.distTo(t) > 6],
    ['g_kidney', (u, t) => u.combo >= 4 && (t.cast || t.elite) && !t.isBoss], ['g_rupture', (u, t) => u.combo >= 5 && !hasDot(t, 'rupture', u) && t.hpPct > 0.4], ['g_evis', u => u.combo >= 5],
    ['g_fan', u => near(u, 6) >= 3], ['g_strike', () => true],
  ],
  necro: [
    ['n_lich', (u, t) => t.isBoss], ['n_skeleton', u => u.summons.filter(s => !s.dead).length < 2 + u.tal('legion')], ['n_bonearmor', u => u.inCombat && !u.hasBuff('bonearmor')],
    ['n_fear', (u, t) => t.target === u && !t.isBoss && u.edgeDist(t) < 3], ['n_harvest', u => near(u, 8) >= 2 && u.hpPct < 0.8], ['n_spear', () => true], ['n_explosion', (u, t) => clustered(t, 5) >= 2],
    ['n_corrupt', (u, t) => !hasDot(t, 'corruption', u) && t.hp > u.stats.power * 3], ['n_drain', u => u.hpPct < 0.6], ['n_bolt', () => true],
  ],
};

export class HeroAI {
  constructor(u, mode = 'world', o = {}) {
    this.u = u; u.ai = this; this.mode = mode; this.o = o;
    this.thinkT = rand(0, 0.3); this.state = 'idle'; this.goal = null; this.timer = rand(2, 6);
    this.home = { x: u.pos.x, z: u.pos.z };
    this.deadT = 0; this.slot = o.slot ?? 0;
  }
  onDamaged(src) { if (this.mode === 'world' && src && !this.u.target && src.kind === 'monster') this.u.target = src; }
  get leader() { return this.mode === 'party' ? G.player : null; }
  partyUnits() {
    if (this.mode === 'arena') return G.world.units.filter(x => x.team === this.u.team && x.isHero && !x.dead);
    if (this.mode !== 'party') return [this.u];
    return [G.player, ...G.party.members()].filter(x => x && !x.dead);
  }
  engaged() {
    const party = this.partyUnits();
    const set = new Set(party);
    for (const p of party) for (const s of p.summons || []) set.add(s);
    const list = [];
    for (const m of G.world.units) {
      if (m.dead || !this.u.isEnemy(m) || m.kind === 'critter') continue;
      if (this.mode === 'arena') { list.push(m); continue; }
      if ((m.target && set.has(m.target)) || (this.mode === 'party' && G.player.target === m && G.player.autoAttack)) list.push(m);
    }
    return list;
  }
  update(dt) {
    const u = this.u;
    if (u.dead) return;
    if (u.cast || u.dash) { u.anim.move = 0; return; }
    if (u.stunned) { u.anim.move = 0; return; }
    // dodge telegraphs
    const dz = inDanger(u.pos.x, u.pos.z);
    if (dz && this.mode !== 'world') {
      let ax, az;
      if (dz.shape === 'circle') { const a = Math.atan2(u.pos.x - dz.x, u.pos.z - dz.z) || rand(0, 6); ax = dz.x + Math.sin(a) * (dz.r + 2.5); az = dz.z + Math.cos(a) * (dz.r + 2.5); }
      else { const a = dz.yaw + Math.PI / 2 * (Math.random() < 0.5 ? 1 : -1); ax = u.pos.x + Math.sin(a) * 6; az = u.pos.z + Math.cos(a) * 6; }
      moveTowards(u, ax, az, dt, 1.2, 0.2);
      return;
    }
    this.thinkT -= dt;
    if (this.thinkT <= 0) { this.thinkT = 0.25 + Math.random() * 0.15; this.think(); }
    if (this.dest) {
      const d = this.dest;
      if (moveTowards(u, d.x, d.z, dt, d.speed || 1, d.stop ?? 0.5)) { this.dest = null; u.anim.move = 0; }
    } else u.anim.move = 0;
    if (this.faceT && u.target) u.faceTo(u.target.pos.x, u.target.pos.z, dt, 10);
  }
  think() {
    const u = this.u;
    if (this.mode === 'world') return this.thinkWorld();
    const foes = this.engaged();
    if (foes.length) return this.fight(foes);
    u.autoAttack = false; u.target = null;
    // out of combat: follow the leader / regroup
    if (this.mode === 'party') {
      const L0 = G.player;
      if (u.distTo(L0) > 70) { u.pos.x = L0.pos.x + rand(-2, 2); u.pos.z = L0.pos.z + rand(-2, 2); return; }
      const ang = L0.yaw + Math.PI + (this.slot - 1.5) * 0.55;
      const fx = L0.pos.x + Math.sin(ang) * (3 + (this.slot % 2)), fz = L0.pos.z + Math.cos(ang) * (3 + (this.slot % 2));
      const d = dist2(u.pos.x, u.pos.z, fx, fz);
      if (d > 1.5) this.dest = { x: fx, z: fz, speed: d > 12 ? (L0.mount ? 2.2 : 1.5) : 1.05, stop: 0.6 };
      // healers top off out of combat, everyone sits to regen when low
      if (u.role === 'healer') { const low = this.partyUnits().filter(x => x.hpPct < 0.85).sort((a, b) => a.hpPct - b.hpPct)[0]; if (low) useSkill(u, low.hpPct < 0.5 ? 'c_heal' : 'c_renew', { target: low }); }
      if (!u.hasBuff('blessing') && u.cls === 'cleric' && u.level >= 24) useSkill(u, 'c_blessing');
      if (u.cls === 'rogue' && !u.hasBuff('poisonblades') && u.level >= 10) useSkill(u, 'g_poison');
      if (u.cls === 'ranger' && u.level >= 10 && !u.summons.some(s => !s.dead)) useSkill(u, 'r_wolf');
      if (u.cls === 'necro' && u.level >= 5 && u.summons.filter(s => !s.dead).length < 2) useSkill(u, 'n_skeleton');
    }
  }
  fight(foes) {
    const u = this.u, C = CLASSES[u.cls];
    const party = this.partyUnits();
    // choose target
    let t = null;
    const lt = G.player?.target;
    if (u.role === 'tank') {
      t = foes.find(f => f.target && f.target !== u && f.target.kind !== 'pet' && !f.isBoss) || (lt && foes.includes(lt) ? lt : null) || foes.sort((a, b) => a.distTo(u) - b.distTo(u))[0];
    } else if (this.mode === 'party' && lt && foes.includes(lt)) t = lt;
    else {
      const tank = party.find(p => p.role === 'tank' && p !== u);
      t = (tank?.target && foes.includes(tank.target)) ? tank.target : foes.sort((a, b) => a.distTo(u) - b.distTo(u))[0];
    }
    if (!t) return;
    u.target = t; u.autoAttack = true;
    // context for rotations
    const hurt = party.filter(p => p.hpPct < 0.8);
    const sorted = [...party].sort((a, b) => a.hpPct - b.hpPct);
    const ctx = { loose: foes.filter(f => f.target && f.target !== u && f.target.role !== 'tank').length, low: sorted[0], low2: sorted.find(p => !p.buffs.some(b => b.id === 'renew@' + u.id)), hurt: hurt.length, avgHp: party.reduce((a, p) => a + p.hpPct, 0) / Math.max(1, party.length) };
    // skills
    for (const [id, cond, tgtKey] of ROT[u.cls]) {
      const sk = SKILLS[id];
      if (!sk || sk.lvl > u.level || (u.cds[id] > 0) || (sk.gcd !== false && u.gcd > 0)) continue;
      if (u.res < skillCost(u, sk)) continue;
      let ok; try { ok = cond(u, t, ctx); } catch (e) { ok = false; }
      if (!ok) continue;
      const target = tgtKey ? ctx[tgtKey] : (sk.target === 'enemy' || sk.target === 'ground') ? t : undefined;
      if (sk.target === 'enemy' && u.edgeDist(t) > skillRange(u, sk)) continue;
      const err = useSkill(u, id, { target });
      if (!err) { this.dest = null; return; }
    }
    // positioning
    const melee = !C.ranged;
    const range = melee ? 2.2 : Math.min(C.range - 4, 20);
    const d = u.edgeDist(t);
    if (u.role === 'healer') {
      const anchor = party.find(p => p.role === 'tank') || G.player || t;
      const dd = u.distTo(anchor);
      if (dd > 16) this.dest = { x: anchor.pos.x, z: anchor.pos.z, stop: 12, speed: 1.1 };
      else if (d > range) this.dest = { x: t.pos.x, z: t.pos.z, stop: range, speed: 1.05 };
      this.faceT = true;
      return;
    }
    if (d > range) this.dest = { x: t.pos.x, z: t.pos.z, stop: melee ? t.radius + u.radius + 0.8 : range - 2, speed: 1.1 };
    else if (!melee && d < 5 && t.target === u && u.role !== 'tank') {
      const a = Math.atan2(u.pos.x - t.pos.x, u.pos.z - t.pos.z);
      this.dest = { x: u.pos.x + Math.sin(a) * 6, z: u.pos.z + Math.cos(a) * 6, speed: 1 };
    } else if (melee && u.role !== 'tank' && t.target && t.target !== u && !t.isBoss) {
      // dps stand behind the target
      const a = t.yaw + Math.PI + (this.slot - 1.5) * 0.4;
      const bx = t.pos.x + Math.sin(a) * (t.radius + 1.4), bz = t.pos.z + Math.cos(a) * (t.radius + 1.4);
      if (dist2(u.pos.x, u.pos.z, bx, bz) > 1.5) this.dest = { x: bx, z: bz, speed: 1, stop: 0.3 };
    } else if (t.isBoss && u.role !== 'tank' && melee) {
      const a = t.yaw + Math.PI + (this.slot - 1.5) * 0.5;
      const bx = t.pos.x + Math.sin(a) * (t.radius + 1.5), bz = t.pos.z + Math.cos(a) * (t.radius + 1.5);
      if (dist2(u.pos.x, u.pos.z, bx, bz) > 2) this.dest = { x: bx, z: bz, speed: 1, stop: 0.3 };
    }
    this.faceT = true;
  }
  // ------------------------------------------------------------ open-world life
  thinkWorld() {
    const u = this.u;
    const zone = G.zones.current;
    if (u.target && !u.target.dead && u.isEnemy(u.target)) {
      if (u.hpPct < 0.2 && chance(0.3)) { buff(u, { id: 'botpot', name: 'Potion', dur: 0.1 }); heal(u, u, { amount: u.stats.maxHp * 0.35, silent: true }); }
      if (u.target.distTo(u) > 40) { u.target = null; u.autoAttack = false; return; }
      return this.fight([u.target]);
    }
    u.autoAttack = false; u.target = null;
    // join world boss fights
    const boss = G.world.units.find(m => m.worldBoss && !m.dead && m.inCombat);
    if (boss && u.distTo(boss) < 160 && u.level >= boss.level - 6) { this.state = 'boss'; if (u.distTo(boss) < 30) { u.target = boss; return this.fight([boss]); } this.dest = { x: boss.pos.x, z: boss.pos.z, stop: 20, speed: 1.4 }; return; }
    this.timer -= 0.3;
    if (this.state === 'rest') { if (u.hpPct > 0.95 && u.res >= u.stats.maxRes * 0.9) { this.state = 'idle'; u.anim.sit = false; } return; }
    if (u.hpPct < 0.45) { this.state = 'rest'; u.anim.sit = true; this.dest = null; return; }
    if (this.state === 'hunt' && this.area) {
      const m = G.world.nearestEnemy(u, 22, e => e.kind === 'monster' && !e.passive && Math.abs(e.level - u.level) <= 4 && !e.worldBoss && (!e.target || e.target === u));
      if (m) { u.target = m; m.ai?.aggro?.(u); return; }
      if (!this.dest || this.timer <= 0) { this.timer = rand(4, 10); const a = Math.random() * 6.28, r = Math.random() * this.area.r; this.dest = { x: this.area.x + Math.sin(a) * r, z: this.area.z + Math.cos(a) * r, speed: 0.75 }; }
      if (this.timer < -60) this.state = 'idle';
      return;
    }
    if (this.timer <= 0 || this.state === 'idle') {
      this.timer = rand(30, 90);
      const r = Math.random();
      const spawns = (zone.spawns || []).filter(s => { const l = Array.isArray(s.lvl) ? s.lvl : [s.lvl, s.lvl]; return Math.abs((l[0] + l[1]) / 2 - u.level) <= 3 && s.n > 1; });
      if (r < 0.65 && spawns.length) { const s = choice(spawns); this.area = { x: s.x, z: s.z, r: s.r }; this.state = 'hunt'; this.dest = { x: s.x, z: s.z, stop: 4, speed: 1 }; this.timer = rand(60, 160); }
      else if (r < 0.85 && zone.towns?.length) { const tw = zone.towns[0]; this.state = 'town'; this.dest = { x: tw.x + rand(-tw.r * 0.4, tw.r * 0.4), z: tw.z + rand(-tw.r * 0.4, tw.r * 0.4), speed: 0.8 }; }
      else { const poi = choice(zone.pois || [{ x: 0, z: 0 }]); this.state = 'wander'; this.dest = { x: poi.x + rand(-6, 6), z: poi.z + rand(-6, 6), speed: 0.8 }; }
    }
    if (this.state === 'town' && !this.dest && chance(0.05)) u.anim.emote = { type: choice(['wave', 'dance', 'cheer', 'laugh', 'point']), t: 0, dur: 3 };
  }
}

// ------------------------------------------------------------ world population & chatter
const CHAT = {
  tr: {
    lfg: ['{d} için grup arıyorum, {r} olarak katılabilirim', 'LFG {d}, {r} burada', '{d} gidecek var mı? 2 kişi daha lazım', 'Tank lazım {d} için!', 'şifacı arıyoruz {d}, acil :)'],
    trade: ['{i} satıyorum, ucuz! pazara koydum', 'WTB {i}, fiyat söyle', '{i} alacak var mı?', 'Pazarda {i} var, hızlı alan kazanır'],
    talk: ['selam millet', 'bu oyun cidden bağımlılık yapıyor', 'lag var mı sizde de?', 'balık tutmak çok rahatlatıcı ya', 'efsanevi düşürdüm!!! 🎉', 'Kara Murat beni 3 kez öldürdü...', 'güçlendirmede +10 yaptım sonunda', 'kim loncaya katılmak ister? her seviye kabul', 'gece manzarası çok güzel', 'ding! {l}. seviye oldum', 'bu dünya patronunu kaç kişi kestik?', 'ilk zindanımı tamamladım, Grukk zormuş', 'nekromant iskeletleri çok tatlı', 'savaşçı mı rahip mi açsam?', 'gg', 'iyi geceler herkese', 'pazarda fiyatlar uçmuş', 'kristal parçası lore\'u çok iyi', 'atımı aldım sonunda!'],
    welcome: ['hoş geldin {n}!', 'selam {n} :)', '{n} hoş geldin, yardım lazım olursa yaz'],
    ding: ['tebrikler {n}!', 'gz {n}', 'grats!'],
    boss: ['DÜNYA PATRONU ÇIKTI! herkes gelsin', 'patron geldi koşun!', 'herkes patrona, kırmızı alanlardan kaçın!'],
    reply: ['selam!', 'aleyküm selam', 'naber?', ':)', 'eyvallah', 'haha', 'aynen', 'katılıyorum', 'bilmiyorum valla', 'iyi şanslar!'],
  },
  en: {
    lfg: ['LFG {d}, can go as {r}', 'anyone up for {d}? need 2 more', 'need a tank for {d}!', 'healer LF group {d}', 'LF1M {d}, {r} pls'],
    trade: ['selling {i}, cheap! on the market', 'WTB {i}, name your price', 'anyone need {i}?', '{i} on the market, first come first served'],
    talk: ['hey all', 'this game is seriously addictive', 'anyone else lagging?', 'fishing is so relaxing', 'just dropped a legendary!!! 🎉', 'Kara Murat killed me 3 times...', 'finally hit +10 enhancement', 'who wants to join our guild? all levels welcome', 'the night sky looks amazing', 'ding! level {l}', 'how many of us killed that world boss?', 'first dungeon done, Grukk was tough', 'necro skeletons are so cute', 'should I roll warrior or cleric?', 'gg', 'good night everyone', 'market prices are crazy', 'the crystal shard lore is great', 'finally got my horse!'],
    welcome: ['welcome {n}!', 'hi {n} :)', 'welcome {n}, ask if you need help'],
    ding: ['grats {n}!', 'gz {n}', 'congrats!'],
    boss: ['WORLD BOSS IS UP! everyone come', 'boss spawned, run!', 'everyone to the boss, dodge the red areas!'],
    reply: ['hi!', 'hello', 'sup?', ':)', 'thanks', 'haha', 'true', 'agreed', 'no idea tbh', 'good luck!'],
  },
};
const fill = (s, o) => s.replace(/\{(\w)\}/g, (_, k) => o[k] ?? '');

export const Bots = {
  world: [],
  chatT: 8,
  spawnZone(def) {
    this.world = [];
    if (!G.settings.bots || def.dungeonLayout) return;
    const [lo, hi] = def.level;
    const n = G.engine.qName === 'low' ? 7 : 11;
    const town = def.towns?.[0];
    for (let i = 0; i < n; i++) {
      const lvl = clamp(randi(lo, hi + 2), 1, 60);
      const ch = makeBotChar(lvl);
      const sp = choice(def.spawns || [{ x: 0, z: 0 }]);
      const at = i < 3 && town ? { x: town.x + rand(-12, 12), z: town.z + rand(-12, 12) } : { x: sp.x + rand(-8, 8), z: sp.z + rand(-8, 8) };
      const u = spawnBot(ch, at.x, at.z, 'world');
      this.world.push(u);
    }
  },
  clearWorld() { for (const u of this.world) if (!u.inParty) G.world.removeUnit(u); this.world = this.world.filter(u => u.inParty); },
  update(dt) {
    if (G.mode !== 'game') return;
    // dead world bots revive in town after a while
    for (const u of this.world) {
      if (!u.dead || u.inParty) continue;
      u._deadT = (u._deadT || 0) + dt;
      if (u._deadT > 15) { u._deadT = 0; const tw = G.zones.current.towns?.[0] || { x: 0, z: 0 }; G.progress.revive(u, { x: tw.x + rand(-6, 6), z: tw.z + rand(-6, 6) }, 1); u.ai.state = 'idle'; }
    }
    // chatter
    this.chatT -= dt;
    if (this.chatT <= 0) { this.chatT = rand(14, 40); this.chatter(); }
  },
  pick() { const live = this.world.filter(u => !u.dead); return live.length ? choice(live) : null; },
  line(kind, o = {}) { const P = CHAT[getLang()] || CHAT.tr; return fill(choice(P[kind]), o); },
  chatter() {
    const b = this.pick(); if (!b) return;
    const z = G.zones.current;
    const r = Math.random();
    const D = G.dungeons?.list?.() || [];
    const d = D.length ? L(choice(D).name) : 'zindan';
    const roles = { tank: 'tank', healer: L('şifacı|healer'), dps: 'dps' };
    let txt, ch = 'world';
    if (r < 0.25) txt = this.line('lfg', { d, r: roles[b.role] });
    else if (r < 0.4) { const ids = ['ore2', 'herb3', 'enhance_stone', 'leather2', 'gem1', 'hp2']; txt = this.line('trade', { i: L(G.itemName?.(ids[Math.floor(Math.random() * ids.length)]) || 'eşya') }); }
    else { txt = this.line('talk', { l: b.level }); ch = chance(0.5) ? 'world' : 'zone'; }
    G.chat.post(b.name, txt, ch, b);
  },
  react(kind, o) {
    const b = this.pick(); if (!b) return;
    setTimeout(() => G.chat.post(b.name, this.line(kind, o), 'world', b), rand(1500, 5000));
  },
};
G.bots = Bots;
G.addSystem(dt => Bots.update(dt));
on('levelUp', l => { if (chance(0.7)) Bots.react('ding', { n: G.char.name }); });
on('sessionStart', () => { setTimeout(() => Bots.react('welcome', { n: G.char.name }), 6000); });
on('worldBossSpawned', () => Bots.react('boss', {}));
on('playerChat', (text, ch) => {
  const lower = text.toLowerCase();
  const target = Bots.world.find(b => lower.includes(b.name.toLowerCase()));
  if (target || chance(0.35)) { const b = target || Bots.pick(); if (b) setTimeout(() => G.chat.post(b.name, Bots.line('reply', {}), ch === 'party' ? 'party' : 'world', b), rand(1200, 3500)); }
});

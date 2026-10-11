// Arena (1v1 / 3v3 against AI heroes, rating) and the Endless Tower (scaling floors).
import { G, emit, on } from '../core/state.js';
import { L, t } from '../core/i18n.js';
import { rand, randi, choice, chance, clamp, fmtTime, shuffle } from '../core/util.js';
import { S, CLASS_IDS, CLASSES, xpNeed } from '../data/classes.js';
import { MONSTERS } from '../data/monsters.js';
import { DungeonLayout } from './dungeons.js';
import { makeBotChar, spawnBot, HeroAI } from './bots.js';
import { spawnMonster } from './factory.js';
import { makeStack, genEquip } from './items.js';
import { h, UI } from '../ui/ui.js';
import { iconURL, ICON_THEMES } from '../gfx/icons.js';
import { Audio } from '../audio.js';

function arenaEnv(theme = 'tomb') {
  const T = { tomb: { fog: 0x1a140c, light: 0xffe0a8 }, shadow: { fog: 0x0c0814, light: 0xc8a8ff }, fire: { fog: 0x1a0806, light: 0xffa060 }, ice: { fog: 0x0c1420, light: 0xc8e8ff }, cave: { fog: 0x14100c, light: 0xffc88a }, web: { fog: 0x100c10, light: 0xd8b0ff } }[theme];
  return { indoor: true, sky: [T.fog, T.fog, T.fog], fog: T.fog, fogNear: 18, fogFar: 70, sun: T.light, sunI: 1.1, hemiSky: T.light, hemiGround: T.fog, hemiI: 0.8, exposure: 1.15 };
}
async function enterInstance(id, name, theme, music) {
  const p = G.player;
  const layout = new DungeonLayout({ id, theme, rooms: 1 }, randi(1, 1e6));
  const def = { id: 'inst:' + id, name, level: [p.level, p.level], music, ambient: 'cave', dungeonLayout: layout, env: arenaEnv(theme), start: layout.start };
  const back = G.world.dungeon ? null : { zone: G.zones.current.id, x: p.pos.x, z: p.pos.z };
  G.dungeons.current = null;
  Inst.cur = { def, layout, back: back || Inst.cur?.back };
  G.dungeons._instDef = def;
  await G.zones.enter(def.id, layout.start);
  const c = G.engine.cam; c.minPitch = 0.6; c.pitch = Math.max(c.pitch, 0.85); c.maxDist = 24;
  return layout;
}
const Inst = { cur: null };
// let ZoneSys find our instance defs
const origDef = G.dungeons.def.bind(G.dungeons);
G.dungeons.def = zid => (Inst.cur && zid === Inst.cur.def.id ? Inst.cur.def : origDef(zid));
async function leaveInstance() {
  const back = Inst.cur?.back || { zone: G.char.zone || 'vale', x: 0, z: 100 };
  Inst.cur = null;
  const c = G.engine.cam; c.minPitch = 0.12; c.maxDist = 34;
  await G.zones.enter(back.zone, { x: back.x, z: back.z });
}

// ================================================================== ARENA
export const Arena = {
  match: null,
  async start(mode = '1v1') {
    const p = G.player, ch = G.char;
    if (p.level < 10) { G.ui.error(L('Arena 10. seviyede açılır|The arena unlocks at level 10')); return; }
    if (p.inCombat || G.world.dungeon) { G.ui.error(L('Şu an giremezsin|You cannot enter right now')); return; }
    G.party.disband(true);
    const layout = await enterInstance('arena', 'Arena|Arena', choice(['tomb', 'shadow', 'fire']), 'arena');
    const ctr = layout.toWorld(layout.rooms[0].x, layout.rooms[0].z);
    // gear quality matched to the player's gear (equalised competition)
    const items = Object.values(p.equip).filter(Boolean);
    const avgIl = items.length ? items.reduce((s, i) => s + i.ilvl, 0) / items.length : p.level;
    const q = items.filter(i => i.rarity === 'epic' || i.rarity === 'legendary').length / Math.max(1, items.length);
    const n = mode === '3v3' ? 3 : 1;
    p.team = 'arenaA';
    p.pos.set(ctr.x - 9, 0, ctr.z); p.yaw = Math.PI / 2;
    const allies = [], foes = [];
    for (let i = 0; i < n - 1; i++) { const c = makeBotChar(p.level, i === 0 ? 'cleric' : choice(['warrior', 'mage', 'ranger']), { quality: q + 0.3 }); const u = spawnBot(c, ctr.x - 9, ctr.z + (i ? 3 : -3), 'arena', { team: 'arenaA', guildTag: null }); allies.push(u); }
    const comp = n === 1 ? [choice(CLASS_IDS)] : shuffle(['cleric', choice(['warrior', 'rogue']), choice(['mage', 'ranger', 'necro'])]);
    comp.forEach((cls, i) => { const c = makeBotChar(p.level, cls, { quality: q + 0.3, ilvlBonus: Math.round(avgIl - p.level) }); const u = spawnBot(c, ctr.x + 9, ctr.z + (i - 1) * 3, 'arena', { team: 'arenaB', guildTag: null }); u.yaw = -Math.PI / 2; foes.push(u); });
    for (const u of [p, ...allies, ...foes]) G.combat.buff(u, { id: 'arenaprep', name: L('Hazırlık|Preparation'), icon: 'hourglass', dur: 3.2, flags: { stun: 1, invuln: 1 }, persistDeath: true });
    this.match = { mode, allies, foes, t: 0, ctr, done: false };
    G.ui.banner(L('Arena|Arena'), mode + ' · ' + L('3… 2… 1…|3… 2… 1…'), 3);
    Audio.sfx('gong');
  },
  update(dt) {
    const m = this.match; if (!m || m.done) return;
    m.t += dt;
    const p = G.player;
    const aliveA = [p, ...m.allies].filter(u => !u.dead).length, aliveB = m.foes.filter(u => !u.dead).length;
    if (aliveB === 0) this.finish(true);
    else if (aliveA === 0 || p.dead && m.allies.every(u => u.dead)) this.finish(false);
    else if (m.t > 240) this.finish(m.foes.reduce((s, u) => s + u.hpPct, 0) < [p, ...m.allies].reduce((s, u) => s + u.hpPct, 0));
  },
  finish(win) {
    const m = this.match; m.done = true;
    const ch = G.char, a = ch.arena = ch.arena || { rating: 1000, wins: 0, losses: 0 };
    const opp = 1000 + (G.player.level - 10) * 10 + randi(-60, 60);
    const exp = 1 / (1 + Math.pow(10, (opp - a.rating) / 400));
    const delta = Math.round(32 * ((win ? 1 : 0) - exp));
    a.rating = Math.max(0, a.rating + delta);
    if (win) a.wins++; else a.losses++;
    const tokens = win ? (m.mode === '3v3' ? 20 : 12) : 4;
    G.progress.giveItem(makeStack('token_honor', tokens));
    if (win) { ch.gold += Math.round(8 * S(ch.level)); G.progress.giveXp(Math.round(xpNeed(Math.min(ch.level, 59)) * 0.06), null); emit('arenaWin'); }
    Audio.sfx(win ? 'victory' : 'defeat');
    G.ui.banner(win ? L('Zafer!|Victory!') : L('Yenilgi|Defeat'), L('Puan: |Rating: ') + a.rating + ` (${delta >= 0 ? '+' : ''}${delta})`, 4);
    setTimeout(() => this.cleanup(), 4000);
  },
  async cleanup() {
    const m = this.match; if (!m) return;
    for (const u of [...m.allies, ...m.foes]) { for (const s of u.summons) G.world.removeUnit(s); G.world.removeUnit(u); }
    const p = G.player; p.team = 'player';
    if (p.dead) G.progress.revive(p, null, 1); else { p.hp = p.stats.maxHp; }
    this.match = null;
    await leaveInstance();
  },
};
G.arena = Arena;

// ================================================================== ENDLESS TOWER
const TOWER_POOL = [
  ['slime', 'boar', 'wolf', 'goblin', 'spider_forest', 'bandit', 'skeleton'],
  ['wisp', 'treant_small', 'spider_giant', 'bear', 'shadow_wolf', 'druid', 'mushroom_man'],
  ['scorpion', 'lizard', 'sand_elemental', 'mummy', 'desert_bandit', 'cultist'],
  ['frost_wolf', 'yeti', 'ice_elemental', 'frost_giant', 'ice_troll'],
  ['imp', 'salamander', 'lava_golem', 'hellhound', 'fire_elemental', 'demon'],
  ['wraith', 'ghoul', 'shadow_fiend', 'death_knight', 'void_eye', 'malakar_cultist'],
];
const TOWER_BOSSES = ['old_tusk', 'greyclaw', 'bandit_chief', 'grave_warden', 'grukk', 'elder_treant', 'moonclaw', 'zeyra', 'sandworm', 'anuket', 'frostfang_alpha', 'frost_wyrm', 'pyrelord', 'infernus', 'bone_dragon', 'vorath'];
const THEMES = ['cave', 'web', 'tomb', 'ice', 'fire', 'shadow'];

export const Tower = {
  run: null,
  async start(floor = 1) {
    const p = G.player;
    if (p.level < 15) { G.ui.error(L('Sonsuz Kule 15. seviyede açılır|The Endless Tower unlocks at level 15')); return; }
    if (p.inCombat) return;
    this.run = { floor, wave: 0, waves: 0, alive: [], t: 0, startFloor: floor };
    if (G.party.members().length < 4) G.party.recruitFor();
    await this.enterFloor();
  },
  async enterFloor() {
    const r = this.run; const f = r.floor;
    const layout = await enterInstance('tower', `Sonsuz Kule — Kat ${f}|Endless Tower — Floor ${f}`, THEMES[Math.floor((f - 1) / 3) % THEMES.length], f % 5 === 0 ? 'boss' : 'dungeon');
    r.ctr = layout.toWorld(layout.rooms[0].x, layout.rooms[0].z);
    r.wave = 0; r.waves = f % 5 === 0 ? 1 : 2 + Math.min(3, Math.floor(f / 6));
    r.next = 3; r.cleared = false;
    G.ui.banner(L(`Kat ${f}|Floor ${f}`), f % 5 === 0 ? L('Koruyucu Kat — Patron!|Guardian Floor — Boss!') : L(`${r.waves} dalga|${r.waves} waves`), 3);
  },
  spawnWave() {
    const r = this.run, p = G.player, f = r.floor;
    const lvl = clamp(p.level + Math.floor(f / 4), 1, 75);
    const tier = clamp(Math.floor((lvl - 1) / 10), 0, 5);
    const mult = 1 + f * 0.04;
    r.alive = [];
    if (f % 5 === 0) {
      const id = TOWER_BOSSES[(f / 5 - 1) % TOWER_BOSSES.length];
      const b = spawnMonster(id, lvl + 1, r.ctr.x + 6, r.ctr.z, { hpMult: MONSTERS[id].boss ? 0.5 * mult : 2.4 * mult, dmgMult: mult });
      b.ai.aggro(p); r.alive.push(b);
    } else {
      const n = 3 + Math.min(4, Math.floor(f / 4));
      for (let i = 0; i < n; i++) {
        const a = i / n * Math.PI * 2;
        const m = spawnMonster(choice(TOWER_POOL[tier]), lvl, r.ctr.x + Math.cos(a) * 8, r.ctr.z + Math.sin(a) * 8, { elite: f > 8 && chance(0.15), hpMult: mult * 1.3, dmgMult: mult });
        if (m) { m.ai.aggro(p); r.alive.push(m); }
      }
    }
    r.wave++;
    Audio.sfx('warn');
  },
  update(dt) {
    const r = this.run; if (!r || !Inst.cur || !G.zones.current?.id?.startsWith('inst:tower')) return;
    r.t += dt;
    const p = G.player;
    if (p.dead && G.party.members().every(m => m.dead)) { this.end(false); return; }
    if (r.cleared) return;
    if (r.alive.length && r.alive.every(u => u.dead)) { r.alive = []; r.next = 2.5; }
    if (!r.alive.length) {
      r.next -= dt;
      if (r.next <= 0) {
        if (r.wave < r.waves) this.spawnWave();
        else this.clearFloor();
      }
    }
  },
  clearFloor() {
    const r = this.run, ch = G.char, f = r.floor;
    r.cleared = true;
    ch.tower = ch.tower || { best: 0 };
    if (f > ch.tower.best) ch.tower.best = f;
    emit('towerFloor', f);
    G.progress.giveItem(makeStack('token_valor', 2 + Math.floor(f / 3)));
    G.progress.giveXp(Math.round(xpNeed(Math.min(ch.level, 59)) * 0.04), null);
    if (f % 5 === 0) { G.progress.giveItem(genEquip({ ilvl: ch.level + Math.floor(f / 5), cls: ch.cls, rarity: f >= 30 && chance(0.25) ? 'legendary' : 'epic' })); G.progress.giveItem(makeStack('chest_dungeon', 1)); }
    Audio.sfx('victory');
    G.ui.banner(L(`Kat ${f} Tamamlandı!|Floor ${f} Cleared!`), '', 2.5);
    // exit/next portals
    const L0 = Inst.cur.layout;
    G.world.interactables.push({ kind: 'exit', x: r.ctr.x - 4, z: r.ctr.z, r: 3, h: 2, label: L('Sonraki Kat|Next Floor'), verb: L('İlerle|Ascend'), icon: 'arrow_up', action: () => { r.floor++; for (const m of G.party.members()) if (m.dead) G.progress.revive(m, null, 1); this.enterFloor(); } });
    G.world.interactables.push({ kind: 'exit', x: r.ctr.x + 4, z: r.ctr.z, r: 3, h: 2, label: L('Kuleden Çık|Leave Tower'), verb: L('Ayrıl|Leave'), icon: 'portal', action: () => this.end(true) });
    G.vfx?.pillar({ x: r.ctr.x - 4, z: r.ctr.z }, 0x6ad8ff, 2); G.vfx?.pillar({ x: r.ctr.x + 4, z: r.ctr.z }, 0xb86aff, 2);
  },
  async end(ok) {
    const r = this.run; if (!r) return;
    this.run = null;
    G.ui.banner(L('Kule Koşusu Bitti|Tower Run Over'), L(`Ulaşılan kat: ${r.floor}|Reached floor: ${r.floor}`), 3);
    if (G.player.dead) G.progress.revive(G.player, null, 0.6);
    G.party.disband(true);
    await leaveInstance();
  },
};
G.tower = Tower;
G.addSystem(dt => { Arena.update(dt); Tower.update(dt); });
// tower player death: revive at the floor start rather than in the world
const origRespawn = G.progress.respawn.bind(G.progress);
G.progress.respawn = () => { if (Tower.run || Arena.match) { if (Arena.match) return; Tower.end(false); return; } origRespawn(); };

UI.register('arena', {
  title: () => t('menuArena') + ' & ' + t('menuTower'), icon: 'sword_cross', w: 520,
  build(w) {
    const ch = G.char, a = ch.arena || { rating: 1000, wins: 0, losses: 0 };
    w.tab = w.tab || 'arena';
    UI.setTabs(w, [['arena', t('menuArena')], ['tower', t('menuTower')]], w.tab, k => { w.tab = k; UI.refresh('arena'); });
    if (w.tab === 'arena') {
      w.body.append(h('div.row', h('img.ico.xl', { src: iconURL('sword_cross', { size: 64, ...ICON_THEMES.blood }) }), h('div', h('div.gold', { style: { fontSize: '22px' } }, a.rating), h('div.muted', `${a.wins} ${L('galibiyet|wins')} · ${a.losses} ${L('mağlubiyet|losses')}`))));
      w.body.append(h('div.muted', { style: { fontSize: '12.5px', margin: '10px 0', lineHeight: '1.5' } }, L('Diğer maceracılarla (yapay zekâ) dengeli maçlar yap. Rakiplerin ekipmanı seninkine göre eşitlenir; beceri kazanır. Zaferler Onur Nişanı ve puan kazandırır.|Fight balanced matches against other adventurers (AI). Opponents\' gear is matched to yours — skill wins. Victories award Marks of Honor and rating.')));
      w.body.append(h('div.row', h('button.btn.primary.big', { onclick: () => { UI.close('arena'); Arena.start('1v1'); } }, '1v1'), h('button.btn.primary.big', { onclick: () => { UI.close('arena'); Arena.start('3v3'); } }, '3v3')));
      w.body.append(h('div.title', { style: { marginTop: '12px', fontSize: '14px' } }, L('Puan Ödülleri|Rating Rewards')), h('div.kv', h('div.k', '1300'), h('div.v', L('Unvan: Gladyatör (100 zafer)|Title: Gladiator (100 wins)')), h('div.k', '1500'), h('div.v', L('Başarım: Düellocu|Achievement: Duelist'))));
    } else {
      const best = ch.tower?.best || 0;
      w.body.append(h('div.row', h('img.ico.xl', { src: iconURL('tower', { size: 64, ...ICON_THEMES.arcane }) }), h('div', h('div.gold', { style: { fontSize: '22px' } }, L('En iyi kat: |Best floor: ') + best), h('div.muted', L('Her 5 katta bir koruyucu patron|A guardian boss every 5 floors')))));
      w.body.append(h('div.muted', { style: { fontSize: '12.5px', margin: '10px 0', lineHeight: '1.5' } }, L('Sonsuz Kule her katta biraz daha zorlaşır. Yoldaşların seninle gelir. Her katta Cesaret Amblemi, her 5 katta destansı ekipman kazanırsın. Kontrol noktaları her 5 kattadır.|The Endless Tower grows harder every floor. Your companions join you. Earn Emblems of Valor each floor and epic gear every 5 floors. Checkpoints are every 5 floors.')));
      const cps = [1]; for (let f = 5; f <= best; f += 5) cps.push(f + 1);
      w.body.append(h('div.row.wrap', ...cps.slice(-4).map(f => h('button.btn' + (f === 1 ? '' : '.primary'), { onclick: () => { UI.close('arena'); Tower.start(f); } }, L(`Kat ${f}'den başla|Start at floor ${f}`)))));
    }
  },
});

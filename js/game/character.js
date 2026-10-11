// New character creation and session start/stop.
import { G, emit } from '../core/state.js';
import { uid } from '../core/util.js';
import { L } from '../core/i18n.js';
import { CLASSES, RACES } from '../data/classes.js';
import { CLASS_SKILLS, SKILLS } from '../data/skills.js';
import { CLASS_ARMOR, CLASS_PRIMARY } from '../data/items.js';
import { genEquip, makeStack, bagSize } from './items.js';
import { createHero } from './hero.js';
import { PlayerCtl } from './player.js';

export function newCharacter(o) {
  const C = CLASSES[o.cls];
  const ch = {
    id: uid('c'), name: o.name, race: o.race, cls: o.cls, body: o.body || 0, skin: o.skin, hair: o.hair, hairColor: o.hairColor, beard: o.beard || 0, eyes: o.eyes,
    outfit: o.outfit ?? null, outfitSat: o.outfitSat ?? null, outfitDark: o.outfitDark || 0, hideHelm: !!o.hideHelm,
    level: 1, xp: 0, rested: 0, gold: 15, zone: 'vale', x: 0, z: 100,
    equip: {}, bag: [], bagUpgrades: 0, bar: [], talents: {},
    quests: { active: {}, done: {}, tracked: [] }, prof: {}, recipes: [], rep: {}, waystones: [], zonesSeen: [],
    stats: {}, created: Date.now(), lastSeen: Date.now(), playtime: 0, bind: { zone: 'vale', x: 0, z: 96, name: 'Aydınköy|Dawnhollow' },
    transmog: {}, mastery: { lvl: 0, xp: 0, pts: {} }, arena: { rating: 1000, wins: 0, losses: 0 }, tower: { best: 0 },
  };
  // starter gear: common items of the class's armour type
  const armor = CLASS_ARMOR[o.cls];
  ch.equip.chest = genEquip({ slot: 'chest', ilvl: 1, rarity: 'common', armorType: armor, cls: o.cls });
  ch.equip.legs = genEquip({ slot: 'legs', ilvl: 1, rarity: 'common', armorType: armor, cls: o.cls });
  ch.equip.feet = genEquip({ slot: 'feet', ilvl: 1, rarity: 'common', armorType: armor, cls: o.cls });
  ch.equip.main = genEquip({ slot: 'main', kind: C.start.main === 'scythe' ? 'scythe' : C.start.main, ilvl: 1, rarity: 'common', cls: o.cls });
  if (C.start.off) ch.equip.off = genEquip({ slot: 'off', kind: C.start.off, ilvl: 1, rarity: 'common', cls: o.cls });
  ch.bag.length = bagSize(ch);
  ch.bag[0] = makeStack('hp1', 5);
  if (C.res === 'mana') ch.bag[1] = makeStack('mp1', 5);
  ch.bag[2] = makeStack('bread', 5);
  ch.bag[3] = makeStack('scroll_home', 2);
  // action bar: first skills + potions in the last two slots
  const sk = CLASS_SKILLS[o.cls];
  ch.bar = new Array(10).fill(null);
  sk.filter(id => SKILLS[id].lvl <= 1).forEach((id, i) => { ch.bar[i] = id; });
  ch.bar[8] = 'item:hp'; ch.bar[9] = C.res === 'mana' ? 'item:mp' : null;
  return ch;
}

export async function startSession(ch) {
  G.char = ch;
  G.account.lastChar = ch.id;
  G.progress.applyRested(ch);
  ch.bag.length = bagSize(ch);
  // make sure every unlocked skill has a place on the bar
  ch.bar = ch.bar || new Array(10).fill(null);
  for (const id of CLASS_SKILLS[ch.cls]) {
    if (SKILLS[id].lvl > ch.level || ch.bar.includes(id)) continue;
    const i = ch.bar.findIndex((x, k) => !x && k < 8); if (i >= 0) ch.bar[i] = id;
  }
  const p = createHero(ch, 'player');
  G.player = p;
  new PlayerCtl(p);
  G.mode = 'game';
  G.ui.closeAll();
  if (!G.hud.root) G.hud.build(); else { G.hud.root.style.display = ''; G.hud.refreshBar(); }
  document.getElementById('mobile')?.style.removeProperty('display');
  G.quests?.onSession(ch);
  G.party?.restore?.(ch);
  await G.zones.enter(ch.zone || 'vale', { x: ch.x, z: ch.z });
  G.chat.system(L(`Elyndra'ya hoş geldin, ${ch.name}!|Welcome to Elyndra, ${ch.name}!`), 'system');
  emit('sessionStart', ch);
}

export function saveSessionState() {
  const ch = G.char, p = G.player; if (!ch || !p) return;
  if (!G.world.dungeon) { ch.x = Math.round(p.pos.x * 10) / 10; ch.z = Math.round(p.pos.z * 10) / 10; ch.zone = G.zones.current?.id || ch.zone; }
  ch.hp = p.dead ? Math.round(p.stats.maxHp * 0.5) : Math.round(p.hp);
  ch.lastSeen = Date.now();
}

export function endSession() {
  saveSessionState();
  G.save.save();
  G.party?.disband?.(true);
  G.ui.closeAll();
  G.mode = 'title';
  if (G.player) { G.world.removeUnit(G.player, true); }
  G.player = null; G.char = null;
  if (G.hud.root) G.hud.root.style.display = 'none';
  const m = document.getElementById('mobile'); if (m) m.style.display = 'none';
  emit('sessionEnd');
}

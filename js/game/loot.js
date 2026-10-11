// Loot rolling for monsters and reward boxes.
import { G } from '../core/state.js';
import { rand, randi, chance, choice } from '../core/util.js';
import { S } from '../data/classes.js';
import { LOOT } from '../data/monsters.js';
import { ITEMS } from '../data/items.js';
import { genEquip, makeStack, tierOf, rollRarity } from './items.js';

const matTier = lvl => Math.min(5, Math.max(1, Math.floor((lvl - 1) / 10) + 1));
const potTier = lvl => lvl >= 45 ? 4 : lvl >= 30 ? 3 : lvl >= 15 ? 2 : 1;

export function rollDrops(u, killer) {
  const out = { gold: 0, items: [] };
  const tpl = u.data.tpl || {};
  const L = u.level;
  const mf = killer?.stats?.mf || 0;
  out.gold = Math.round(2 * S(L) * rand(0.6, 1.4) * (u.elite ? 4 : 1) * (u.rare ? 3 : 1) * (u.isBoss ? 20 : 1));
  if (tpl.family === 'beast' || tpl.family === 'slime') out.gold = Math.round(out.gold * 0.5);
  const cls = killer?.cls;
  // equipment
  if (u.isBoss) {
    const n = tpl.raid ? 3 : tpl.worldBoss ? 2 : 2;
    for (let i = 0; i < n; i++) out.items.push(genEquip({ ilvl: L + (tpl.raid ? 4 : 2), cls, rarity: rollRarity(tpl.raid ? 3 : 2, mf) === 'legendary' ? 'legendary' : (Math.random() < 0.55 ? 'epic' : 'rare'), mf }));
    out.items.push(makeStack('enhance_stone', randi(2, 4)));
    if (tpl.raid) out.items.push(makeStack('essence_g', randi(2, 4)));
    out.items.push(makeStack('chest_boss', 1));
  } else if (u.rare) {
    out.items.push(genEquip({ ilvl: L + 1, cls, rarity: Math.random() < 0.3 ? 'epic' : 'rare', mf }));
    out.items.push(makeStack('enhance_stone', 1));
  } else if (u.elite) {
    if (chance(0.7)) out.items.push(genEquip({ ilvl: L, cls, bonus: 1, mf }));
  } else if (chance(0.085 * (1 + mf / 100))) {
    out.items.push(genEquip({ ilvl: L, cls, mf }));
  }
  // materials
  const table = LOOT[tpl.loot] || [];
  for (const e of table) {
    if (!chance(e.c * (u.elite ? 1.5 : 1))) continue;
    const id = e.id.replace('{T}', matTier(L)).replace('{P}', potTier(L));
    if (!ITEMS[id]) continue;
    out.items.push(makeStack(id, randi(1, u.elite ? 3 : 2)));
  }
  if (chance(0.02 + (u.elite ? 0.1 : 0))) out.items.push(makeStack('enhance_stone', 1));
  if (chance(0.006)) out.items.push(makeStack(choice(['gem1', 'gem2', 'gem3']), 1));
  // quest drops
  const q = G.quests?.dropsFor(u) || [];
  for (const it of q) out.items.push(it);
  return out;
}

// Reward boxes
export function openBox(kind, lvl, cls) {
  const items = [];
  let gold = 0;
  if (kind === 'daily') {
    gold = Math.round(15 * S(lvl));
    items.push(genEquip({ ilvl: lvl, cls, rarity: chance(0.2) ? 'epic' : 'rare' }));
    items.push(makeStack('enhance_stone', randi(1, 3)));
    if (chance(0.3)) items.push(makeStack('lucky_charm', 1));
  } else if (kind === 'dungeon') {
    gold = Math.round(25 * S(lvl));
    items.push(genEquip({ ilvl: lvl + 1, cls, rarity: chance(0.35) ? 'epic' : 'rare' }));
    items.push(makeStack('enhance_stone', randi(2, 4)));
    items.push(makeStack('essence', randi(3, 8)));
  } else {
    gold = Math.round(40 * S(lvl));
    items.push(genEquip({ ilvl: lvl + 2, cls, rarity: chance(0.08) ? 'legendary' : 'epic' }));
    items.push(makeStack('enhance_stone', randi(3, 6)));
    items.push(makeStack('lucky_charm', 1));
  }
  return { gold, items };
}

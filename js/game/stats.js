// Stat computation for heroes (players/bots) and monsters.
import { G } from '../core/state.js';
import { S, CLASSES, RACES, RES } from '../data/classes.js';

const ZERO = () => ({
  str: 0, agi: 0, int: 0, sta: 0, spi: 0, armor: 0, power: 0, crit: 5, critDmg: 50, haste: 0, dodge: 3, block: 0, leech: 0, speed: 100,
  hpFlat: 0, hpPct: 0, dmgPct: 0, dmgTakenPct: 0, healPct: 0, manaRegen: 0, xpPct: 0, goldPct: 0, mf: 0, resist: 0, powerPct: 0, thorns: 0,
});

export function recalcHero(u) {
  const C = CLASSES[u.cls], R = RACES[u.race] || RACES.human, L = u.level, s = S(L);
  const st = ZERO();
  for (const k of ['str', 'agi', 'int', 'sta', 'spi']) st[k] = C.base[k] * s;
  // gear
  if (u.equip) for (const slot in u.equip) {
    const it = u.equip[slot]; if (!it || !it.stats) continue;
    for (const k in it.stats) st[k] = (st[k] || 0) + it.stats[k];
  }
  // race
  for (const k in R.bonus) {
    if (k === 'crit') st.crit += R.bonus[k];
    else if (k === 'hpPct') st.hpPct += R.bonus[k];
    else if (k === 'dmgPct') st.dmgPct += R.bonus[k];
    else if (k === 'xpPct') st.xpPct += R.bonus[k];
  }
  // talents & set bonuses & mastery (flat adds)
  for (const src of [u.talentStats, u.setStats, u.masteryStats, u.titleStats]) if (src) for (const k in src) st[k] = (st[k] || 0) + src[k];
  // buffs
  let pct = {};
  for (const b of u.buffs) {
    if (b.mods) for (const k in b.mods) st[k] = (st[k] || 0) + b.mods[k] * (b.stacks || 1);
    if (b.pct) for (const k in b.pct) pct[k] = (pct[k] || 0) + b.pct[k] * (b.stacks || 1);
  }
  for (const k of ['str', 'agi', 'int', 'sta', 'spi']) if (pct.stats) st[k] *= 1 + pct.stats / 100;
  for (const k in pct) if (k !== 'stats' && st[k] != null) st[k] *= 1 + pct[k] / 100;
  if (st.intPct) st.int *= 1 + st.intPct / 100;
  if (st.armorPct) st.armor *= 1 + st.armorPct / 100;
  // derived
  const prim = st[C.primary];
  st.power += prim * 2 + (C.primary === 'str' ? st.agi * 0.3 : C.primary === 'agi' ? st.str * 0.3 : st.spi * 0.5);
  st.power *= 1 + st.powerPct / 100;
  if (u.powers?.has('pw_thorns')) st.thorns = st.power * 0.4;
  st.crit += st.agi / (s * 22);
  st.maxHp = Math.round((st.sta * 10 + 40 * s + st.hpFlat) * (1 + st.hpPct / 100));
  const res = C.res;
  if (res === 'mana') { st.baseMana = 100 * s; st.maxRes = Math.round(st.baseMana + st.int * 3 + st.spi * 2); }
  else st.maxRes = RES[res].max;
  st.hpRegen = s * 0.4 + st.spi * 0.04 + st.sta * 0.02;
  st.manaRegen += st.spi / (s * 2);
  st.crit = Math.min(75, st.crit); st.dodge = Math.min(60, st.dodge); st.haste = Math.min(100, st.haste);
  const hpRatio = u.stats.maxHp ? u.hp / u.stats.maxHp : 1;
  const prevMax = u.stats.maxHp;
  u.stats = st;
  if (prevMax && prevMax !== st.maxHp && !u.dead) u.hp = Math.min(st.maxHp, Math.max(1, Math.round(hpRatio * st.maxHp)));
  u.hp = Math.min(u.hp, st.maxHp);
  u.res = Math.min(u.res, st.maxRes);
}

// Monster base stats are stored on u.base by the factory: {hp, dmg, armor, speed...}
export function recalcMonster(u) {
  const b = u.base || {};
  const st = ZERO();
  st.maxHp = b.hp || 100; st.power = b.dmg || 5; st.armor = b.armor || 0; st.crit = b.crit ?? 5; st.dodge = b.dodge ?? 2;
  st.critDmg = 50; st.resist = b.resist || 0;
  let pct = {};
  for (const bf of u.buffs) {
    if (bf.mods) for (const k in bf.mods) st[k] = (st[k] || 0) + bf.mods[k] * (bf.stacks || 1);
    if (bf.pct) for (const k in bf.pct) pct[k] = (pct[k] || 0) + bf.pct[k] * (bf.stacks || 1);
  }
  for (const k in pct) if (st[k] != null) st[k] *= 1 + pct[k] / 100;
  st.maxHp = Math.round(st.maxHp);
  const ratio = u.stats.maxHp ? u.hp / u.stats.maxHp : 1;
  const prev = u.stats.maxHp;
  u.stats = st;
  if (prev && prev !== st.maxHp && !u.dead) u.hp = Math.max(1, Math.round(ratio * st.maxHp));
  u.hp = Math.min(u.hp, st.maxHp);
}

G.stats = {
  recalc(u) { if (u.cls) recalcHero(u); else recalcMonster(u); },
};

// Gear score: used for matchmaking difficulty and the character sheet
export function gearScore(u) {
  if (!u.equip) return 0;
  let s = 0, n = 0;
  for (const k in u.equip) { const it = u.equip[k]; if (it) { s += it.ilvl * (it.slot === 'main' && it.twoHand ? 2 : 1); n += it.slot === 'main' && it.twoHand ? 2 : 1; } }
  return Math.round(s / Math.max(1, 12) * 10);
}

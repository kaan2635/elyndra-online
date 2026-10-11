// Item generation, naming, visuals, inventory & equipment operations, enhancement, salvage.
import { G, emit } from '../core/state.js';
import { L, t } from '../core/i18n.js';
import { uid, clamp, weighted, rand, randi, choice, shadeHex } from '../core/util.js';
import { S, CLASSES, TIER_COL, TIER_TRIM, WEAPON_COL } from '../data/classes.js';
import { RARITY, RARITY_COL, RARITY_HEX, RARITY_MULT, RARITY_AFFIX, RARITY_VALUE, SLOTS, ARMOR_SLOTS, SLOT_MULT, ARMOR_TYPE_MULT, MATERIALS, NOUNS, WEAPONS, CLASS_WEAPONS, CLASS_ARMOR, CLASS_PRIMARY, AFFIXES, EPIC_ADJ, LEGENDARIES, ITEMS } from '../data/items.js';

export const tierOf = ilvl => clamp(Math.floor((ilvl - 1) / 10), 0, 7);

export function rollRarity(bonus = 0, mf = 0) {
  // bonus: 0 normal, 1 elite, 2 rare/dungeon boss, 3 raid boss
  const m = 1 + mf / 100;
  const W = [
    { r: 'common', w: Math.max(5, 52 - bonus * 18) },
    { r: 'uncommon', w: 32 },
    { r: 'rare', w: (10 + bonus * 10) * m },
    { r: 'epic', w: (2.2 + bonus * 4) * m },
    { r: 'legendary', w: (0.25 + bonus * 0.9) * m },
  ];
  return weighted(W).r;
}

function pickArmorType(cls) { return cls && Math.random() < 0.8 ? CLASS_ARMOR[cls] : choice(['plate', 'mail', 'leather', 'cloth']); }

/**
 * Generate an equipment item.
 * o: {ilvl, rarity, slot, kind, armorType, cls (smart loot), legendary (id), mythic}
 */
export function genEquip(o = {}) {
  let ilvl = Math.max(1, Math.round(o.ilvl || 1));
  let rarity = o.rarity || rollRarity(o.bonus || 0, o.mf || 0);
  let leg = o.legendary ? LEGENDARIES[o.legendary] : null;
  if (rarity === 'legendary' && !leg) {
    // pick a legendary matching the class when possible
    const pool = Object.entries(LEGENDARIES).filter(([, l]) => !l.cls || !o.cls || l.cls.includes(o.cls));
    const [lid, l] = choice(pool); leg = l; o.legendary = lid;
  }
  if (leg) rarity = o.rarity === 'mythic' ? 'mythic' : 'legendary';
  let slot = leg ? leg.slot : o.slot;
  let kind = leg ? leg.kind : o.kind;
  if (!slot) {
    const r = Math.random();
    slot = r < 0.22 ? 'main' : r < 0.3 ? 'off' : choice(['head', 'shoulders', 'chest', 'hands', 'legs', 'feet', 'chest', 'legs', 'cape', 'neck', 'ring', 'trinket']);
  }
  if (slot === 'ring2') slot = 'ring';
  if ((slot === 'main' || slot === 'off') && !kind) {
    const cw = o.cls && Math.random() < 0.8 ? CLASS_WEAPONS[o.cls] : null;
    const pool = slot === 'main' ? (cw ? cw.main : Object.keys(WEAPONS).filter(k => WEAPONS[k].slot === 'main')) : (cw && cw.off.length ? cw.off : ['shield', 'orb', 'tome', 'dagger']);
    kind = choice(pool);
  }
  const tier = tierOf(ilvl);
  const it = { uid: uid('i'), type: 'equip', slot, ilvl, rarity, tier, plus: 0, pity: 0 };
  if (leg) it.legendary = o.legendary;
  if (o.set) it.set = o.set;
  if (slot === 'main' || slot === 'off') {
    it.kind = kind;
    const W = WEAPONS[kind];
    if (kind === 'dagger' && slot === 'off') it.slot = 'off';
    it.twoHand = !!W.twoHand && slot === 'main';
  } else if (ARMOR_SLOTS.includes(slot)) it.armorType = o.armorType || pickArmorType(o.cls);
  it.reqLevel = Math.min(60, Math.max(1, ilvl - (rarity === 'common' ? 1 : 0)));
  // ---- stats
  const prim = primaryFor(it, o.cls);
  it.prim = prim;
  const s = S(ilvl);
  const sm = SLOT_MULT[slot] * (it.twoHand ? 2 : 1);
  const rm = RARITY_MULT[rarity];
  const B = s * sm * rm;
  const st = {};
  if (prim !== 'sta') st[prim] = Math.round(B * 1.0 * rand(0.92, 1.08) * 10) / 10;
  st.sta = Math.round(B * 0.8 * rand(0.9, 1.1) * 10) / 10;
  if (it.armorType) st.armor = Math.round(s * sm * ARMOR_TYPE_MULT[it.armorType] * (0.8 + rm * 0.3));
  if (slot === 'main') st.power = Math.round(4 * s * rm * (it.twoHand ? 1.8 : 1) * rand(0.95, 1.05));
  if (kind === 'shield') { st.armor = Math.round(s * 4 * rm); st.block = Math.round((8 + tier) * 10) / 10; st.sta = Math.round(B * 1.3); }
  if (kind === 'dagger' && slot === 'off') st.power = Math.round(2 * s * rm);
  // affixes
  const [a0, a1] = RARITY_AFFIX[rarity];
  const n = randi(a0, a1);
  const pool = Object.entries(AFFIXES).filter(([k, a]) => (!a.slots || a.slots.includes(slot)) && !(k === 'armor' && !it.armorType));
  const chosen = [];
  for (let i = 0; i < n && pool.length; i++) {
    const pick = weighted(pool.map(([k, a]) => ({ k, a, w: a.w })));
    pool.splice(pool.findIndex(p => p[0] === pick.k), 1);
    chosen.push(pick.k);
    const a = pick.a;
    let stat = a.stat === 'primary' ? (prim === 'sta' ? 'str' : prim) : a.stat;
    let v;
    if (a.pct) v = Math.round(rand(a.pct[0], a.pct[1]) * (0.7 + rm * 0.3) * (0.6 + sm * 0.4) * 10) / 10;
    else v = Math.round(B * a.budget * rand(0.85, 1.15) * (stat === 'armor' ? s / Math.max(1, s) * 1.5 : 1) * 10) / 10;
    st[stat] = Math.round(((st[stat] || 0) + v) * 10) / 10;
  }
  it.affixes = chosen;
  it.bs = st;           // base stats (before enhancement)
  computeStats(it);
  // ---- naming
  it.name = makeName(it, leg);
  it.visual = makeVisual(it, leg);
  if (leg) { it.power = leg.power; }
  it.value = Math.max(1, Math.round(S(ilvl) * 3 * RARITY_VALUE[rarity] * (it.twoHand ? 1.5 : 1)));
  return it;
}

function primaryFor(it, cls) {
  if (it.kind) {
    const W = WEAPONS[it.kind];
    if (it.kind === 'sword' && cls === 'rogue') return 'agi';
    if (it.kind === 'mace' && cls === 'cleric') return 'int';
    if (it.kind === 'dagger') return 'agi';
    if (it.kind === 'shield' && cls === 'cleric') return 'int';
    return W.stat;
  }
  if (it.armorType === 'plate') return 'str';
  if (it.armorType === 'leather') return 'agi';
  if (it.armorType === 'cloth') return 'int';
  if (it.armorType === 'mail') return cls === 'cleric' ? 'int' : cls === 'ranger' ? 'agi' : choice(['agi', 'int']);
  return cls ? CLASS_PRIMARY[cls] : choice(['str', 'agi', 'int']);
}

export function computeStats(it) {
  const k = 1 + 0.045 * (it.plus || 0);
  it.stats = {};
  for (const s in it.bs) {
    const scale = ['str', 'agi', 'int', 'sta', 'spi', 'armor', 'power'].includes(s) ? k : 1;
    it.stats[s] = Math.round(it.bs[s] * scale * 10) / 10;
  }
}

function makeName(it, leg) {
  if (leg) return leg.name;
  let mat, noun;
  if (it.kind) {
    const W = WEAPONS[it.kind];
    mat = MATERIALS[W.mat][it.tier]; noun = W.noun;
  } else if (it.armorType) { mat = MATERIALS[it.armorType][it.tier]; noun = NOUNS[it.armorType][it.slot]; }
  else if (it.slot === 'cape') { mat = MATERIALS.cloth[it.tier]; noun = NOUNS.cape; }
  else { mat = MATERIALS.gem[it.tier]; noun = NOUNS[it.slot] || NOUNS.ring; }
  const [mt, me] = mat.split('|'), [nt, ne] = noun.split('|');
  let pt = '', pe = '';
  if (it.rarity === 'epic' || it.rarity === 'mythic') { const a = choice(EPIC_ADJ).split('|'); pt = a[0] + ' '; pe = a[1] + ' '; }
  else if (it.affixes?.length && it.rarity !== 'common') { const a = AFFIXES[it.affixes[0]].name.split('|'); pt = a[0] + ' '; pe = a[1] + ' '; }
  return `${pt}${mt} ${nt}|${pe}${me} ${ne}`;
}

function makeVisual(it, leg) {
  const tier = Math.min(it.tier, 6);
  const glow = leg ? leg.glow : it.rarity === 'mythic' ? 0xffe08a : it.rarity === 'epic' ? [0xb45aff, 0x6ad8ff, 0xff7a2a, 0x8aff6a][it.tier % 4] : null;
  if (it.kind) {
    const W = WEAPONS[it.kind];
    let c = W.mat === 'wood' ? [0x8a6a3a, 0x7a5a30, 0x6a4a28, 0xe8dcc0, 0x8a2a1a, 0x3a2a2a, 0x4a2a6a][tier] : WEAPON_COL[tier];
    let c2 = W.mat === 'wood' ? shadeHex(c, -0.3) : [0x5a3a22, 0x4a3020, 0x2a2a30, 0x3a5a8a, 0x8a2a1a, 0x1a1a1a, 0x3a1a5a][tier];
    if (it.kind === 'orb') c = [0x8ad8ff, 0xd68aff, 0xff8a6a, 0x8aff8a, 0xffe68a, 0xff5a3a, 0xb46aff][tier];
    if (it.kind === 'tome') c = [0x6a3a2a, 0x2a4a8a, 0x5a1a5a, 0x1a6a5a, 0x8a1a1a, 0x2a1a3a, 0xe8e0c8][tier];
    if (it.kind === 'shield') { c = TIER_COL.plate[tier]; c2 = TIER_TRIM[tier]; }
    const m = it.kind === 'scythe' ? 'scythe' : it.kind;
    return { m, c, c2, c3: TIER_TRIM[tier], glow, shape: it.kind === 'shield' && (it.tier % 2) ? 'kite' : 'round' };
  }
  if (it.armorType) {
    const base = TIER_COL[it.armorType][tier];
    const c = it.rarity === 'epic' || it.rarity === 'legendary' ? shadeHex(base, 0.08) : base;
    const helm = { plate: tier >= 3 && it.tier % 2 ? 'horned' : 'helm', mail: 'helm', leather: 'hood', cloth: tier % 3 === 0 ? 'hat' : tier % 3 === 1 ? 'hood' : 'circlet' }[it.armorType];
    const sh = { plate: tier >= 4 ? 'spiked' : 'plate', mail: 'leather', leather: 'leather', cloth: 'cloth' }[it.armorType];
    const ch = { plate: 'plate', mail: 'mail', leather: 'leather', cloth: 'robe' }[it.armorType];
    return { c, c2: TIER_TRIM[tier], m: it.slot === 'head' ? helm : it.slot === 'shoulders' ? sh : it.slot === 'chest' ? ch : it.armorType === 'plate' ? 'plate' : null, glow };
  }
  if (it.slot === 'cape') return { c: [0x8a2a2a, 0x2a4a8a, 0x2a6a3a, 0x5a2a8a, 0xc84a1a, 0x1a1a2a, 0xe8e0c8][tier], c2: TIER_TRIM[tier] };
  return { c: TIER_TRIM[tier] };
}

// ------------------------------------------------------------ display helpers
export function itemName(it) {
  if (!it) return '';
  if (it.id) return L(ITEMS[it.id]?.name || it.id);
  return L(it.name) + (it.plus ? ' +' + it.plus : '');
}
export function itemColor(it) { return it.id ? (ITEMS[it.id]?.rare ? RARITY_COL.epic : RARITY_COL.common) : RARITY_COL[it.rarity]; }
export function itemIconOpts(it) {
  if (it.id) {
    const T = ITEMS[it.id] || {};
    return { name: T.icon || 'bag', fill: T.fill, frame: T.rare ? RARITY_COL.epic : null, badge: it.qty > 1 ? String(it.qty) : null };
  }
  let name = it.kind ? WEAPONS[it.kind].icon : it.slot === 'ring' || it.slot === 'ring2' ? 'ring' : it.slot === 'head' ? 'helmet' : it.slot === 'legs' ? 'pants' : it.slot === 'hands' ? 'gloves' : it.slot === 'feet' ? 'boots' : it.slot === 'neck' ? 'necklace' : it.slot;
  if (it.kind === 'scythe') name = 'staff';
  const v = it.visual || {};
  const col = v.c ?? 0x9a9aa0;
  const hex = h => '#' + (h >>> 0).toString(16).padStart(6, '0');
  return { name, fill: [hex(shadeHex(col, 0.25)), hex(shadeHex(col, -0.25))], frame: RARITY_COL[it.rarity], glow: v.glow ? hex(v.glow) : null, badge: it.plus ? '+' + it.plus : null };
}

G.itemName = id => ITEMS[id]?.name || id;
export function makeStack(id, qty = 1) { return { uid: uid('s'), id, qty }; }
export const stackMax = it => it.id ? (ITEMS[it.id]?.stack || 1) : 1;
export function sellValue(it) {
  if (!it) return 0;
  if (it.id) return (ITEMS[it.id]?.value || 0) * (it.qty || 1);
  return it.value || 1;
}

// ------------------------------------------------------------ inventory ops (operate on G.char)
export function bagSize(ch) { return 30 + (ch.bagUpgrades || 0) * 6; }
export function addItem(ch, item, silent = false) {
  if (!item) return false;
  ch.bag.length = bagSize(ch);
  if (item.id) {
    const max = stackMax(item);
    for (let i = 0; i < ch.bag.length && item.qty > 0; i++) {
      const s = ch.bag[i];
      if (s && s.id === item.id && s.qty < max) { const n = Math.min(max - s.qty, item.qty); s.qty += n; item.qty -= n; }
    }
    while (item.qty > 0) {
      const i = ch.bag.findIndex(x => !x);
      if (i < 0) { if (!silent) G.ui?.error(t('bagFull')); emit('bagChanged'); return false; }
      const n = Math.min(max, item.qty);
      ch.bag[i] = { uid: uid('s'), id: item.id, qty: n };
      item.qty -= n;
    }
    emit('bagChanged'); emit('itemGained', item.id);
    return true;
  }
  const i = ch.bag.findIndex(x => !x);
  if (i < 0) { if (!silent) G.ui?.error(t('bagFull')); return false; }
  ch.bag[i] = item;
  emit('bagChanged'); emit('itemGained', item);
  return true;
}
export function freeSlots(ch) { ch.bag.length = bagSize(ch); return ch.bag.filter(x => !x).length; }
export function countItem(ch, id) { let n = 0; for (const s of ch.bag) if (s && s.id === id) n += s.qty; return n; }
export function removeItem(ch, id, qty = 1) {
  if (countItem(ch, id) < qty) return false;
  for (let i = ch.bag.length - 1; i >= 0 && qty > 0; i--) {
    const s = ch.bag[i];
    if (s && s.id === id) { const n = Math.min(s.qty, qty); s.qty -= n; qty -= n; if (s.qty <= 0) ch.bag[i] = null; }
  }
  emit('bagChanged');
  return true;
}
export function sortBag(ch) {
  const rOrder = { mythic: 0, legendary: 1, epic: 2, rare: 3, uncommon: 4, common: 5 };
  const tOrder = { equip: 0, consumable: 1, material: 2, currency: 3, quest: 4, junk: 5 };
  // merge stacks first
  const items = ch.bag.filter(Boolean);
  const merged = [];
  for (const it of items) {
    if (it.id) { const m = merged.find(x => x.id === it.id && x.qty < stackMax(x)); if (m) { const n = Math.min(stackMax(m) - m.qty, it.qty); m.qty += n; it.qty -= n; if (it.qty <= 0) continue; } }
    merged.push(it);
  }
  merged.sort((a, b) => {
    const ta = a.id ? tOrder[ITEMS[a.id]?.type] ?? 9 : 0, tb = b.id ? tOrder[ITEMS[b.id]?.type] ?? 9 : 0;
    if (ta !== tb) return ta - tb;
    if (!a.id && !b.id) return (rOrder[a.rarity] - rOrder[b.rarity]) || (b.ilvl - a.ilvl);
    return String(a.id).localeCompare(String(b.id));
  });
  ch.bag = merged;
  ch.bag.length = bagSize(ch);
  emit('bagChanged');
}

// can this hero equip the item?
export function canEquip(u, it) {
  if (!it || it.type !== 'equip') return L('Kuşanılamaz|Cannot be equipped');
  if (it.reqLevel > u.level) return L(`Seviye ${it.reqLevel} gerekli|Requires level ${it.reqLevel}`);
  if (it.armorType && CLASS_ARMOR[u.cls] !== it.armorType) {
    // allow lighter armour than your class? keep strict to class type for clarity
    return L('Sınıfın bu zırh türünü giyemez|Your class cannot wear this armour type');
  }
  if (it.kind) {
    const cw = CLASS_WEAPONS[u.cls];
    if (it.slot === 'main' && !cw.main.includes(it.kind)) return L('Sınıfın bu silahı kullanamaz|Your class cannot use this weapon');
    if (it.slot === 'off' && !cw.off.includes(it.kind)) return L('Sınıfın bunu kullanamaz|Your class cannot use this');
  }
  return null;
}
export function slotFor(u, it) {
  if (it.slot === 'ring') return !u.equip.ring ? 'ring' : !u.equip.ring2 ? 'ring2' : 'ring';
  return it.slot;
}
// equip from bag index; returns error string or null
export function equipFromBag(ch, u, idx) {
  const it = ch.bag[idx];
  const err = canEquip(u, it); if (err) return err;
  const slot = slotFor(u, it);
  ch.bag[idx] = null;
  const old = u.equip[slot];
  u.equip[slot] = it;
  if (old) ch.bag[idx] = old;
  if (it.twoHand && u.equip.off) {
    const off = u.equip.off; u.equip.off = null;
    if (!addItem(ch, off, true)) { u.equip.off = off; u.equip[slot] = old; ch.bag[idx] = it; return t('bagFull'); }
  }
  if (slot === 'off' && u.equip.main?.twoHand) {
    const mh = u.equip.main; u.equip.main = null;
    if (!addItem(ch, mh, true)) { u.equip.main = mh; u.equip.off = old; ch.bag[idx] = it; return t('bagFull'); }
  }
  ch.wardrobe = ch.wardrobe || {};
  emit('equipChanged', u, it);
  return null;
}
export function unequip(ch, u, slot) {
  const it = u.equip[slot]; if (!it) return null;
  if (freeSlots(ch) < 1) return t('bagFull');
  u.equip[slot] = null;
  addItem(ch, it, true);
  emit('equipChanged', u, null);
  return null;
}

// Build the humanoid gear spec for a hero from equipment (+ transmog overrides)
export function gearSpec(u, ch) {
  const C = CLASSES[u.cls];
  const eq = u.equip || {};
  const tm = ch?.transmog || {};
  const vis = s => (tm[s] && tm[s].hidden) ? null : (tm[s]?.visual || eq[s]?.visual);
  const g = {};
  const chest = vis('chest');
  g.chest = chest ? { m: chest.m || 'cloth', c: chest.c, c2: chest.c2 } : { m: C.armor === 'cloth' ? 'robe' : 'cloth', c: C.startShirt, c2: shadeHex(C.startShirt, -0.3) };
  const legs = vis('legs'); g.legs = legs ? { c: legs.c, m: legs.m } : { c: shadeHex(C.startShirt, -0.45) };
  const feet = vis('feet'); g.feet = { c: feet ? feet.c : 0x4a3424 };
  const hands = vis('hands'); if (hands) g.hands = { c: hands.c };
  const head = vis('head'); if (head && !ch?.hideHelm) g.head = { m: head.m || 'helm', c: head.c, c2: head.c2 };
  const sh = vis('shoulders'); if (sh) g.shoulders = { m: sh.m || 'leather', c: sh.c, c2: sh.c2 };
  const cape = vis('cape'); if (cape && !ch?.hideCape) g.cape = { c: cape.c, c2: cape.c2 };
  const main = vis('main'); g.main = main ? { ...main } : null;
  const off = vis('off'); g.off = off ? { ...off } : null;
  if (!g.main && C.start.main) g.main = { m: C.start.main, c: WEAPON_COL[0] };
  if (!g.off && !eq.main?.twoHand && C.start.off && !eq.main) g.off = { m: C.start.off, c: 0x6a4a2a };
  if (g.main && g.main.m === 'dagger' && u.cls === 'rogue' && !g.off) g.off = { m: 'dagger', c: g.main.c };
  return g;
}

// ------------------------------------------------------------ enhancement & salvage
export const ENH_CHANCE = [100, 95, 90, 82, 74, 66, 58, 50, 44, 38, 32, 27, 23, 19, 16];
export const ENH_MAX = 15;
export function enhanceCost(it) {
  const p = it.plus || 0;
  return { stones: 1 + Math.floor(p / 2) + (it.rarity === 'legendary' || it.rarity === 'mythic' ? 2 : it.rarity === 'epic' ? 1 : 0), gold: Math.round(S(it.ilvl) * 4 * (1 + p * 0.6)) };
}
export function enhanceChance(it, charm) { return Math.min(100, (ENH_CHANCE[it.plus || 0] ?? 10) + (it.pity || 0) + (charm ? 15 : 0)); }
export function enhance(ch, it, useCharm) {
  if ((it.plus || 0) >= ENH_MAX) return { err: L('Azami seviye|Maximum level') };
  const c = enhanceCost(it);
  if (ch.gold < c.gold) return { err: L('Yeterli altın yok|Not enough gold') };
  if (countItem(ch, 'enhance_stone') < c.stones) return { err: L('Yeterli güçlendirme taşı yok|Not enough enhancement stones') };
  if (useCharm && countItem(ch, 'lucky_charm') < 1) return { err: L('Şans muskası yok|No lucky charm') };
  const chance = enhanceChance(it, useCharm);
  ch.gold -= c.gold; removeItem(ch, 'enhance_stone', c.stones); if (useCharm) removeItem(ch, 'lucky_charm', 1);
  const ok = Math.random() * 100 < chance;
  if (ok) { it.plus = (it.plus || 0) + 1; it.pity = 0; computeStats(it); }
  else { it.pity = (it.pity || 0) + 6; } // failure never destroys or downgrades — it raises the next chance
  emit('bagChanged'); emit('enhanced', it, ok);
  return { ok, chance };
}
export function salvageResult(it) {
  if (it.id) return [];
  const out = [{ id: 'essence', qty: Math.max(1, Math.round((1 + it.tier) * RARITY_VALUE[it.rarity] * 0.6)) }];
  if (it.rarity === 'epic' || it.rarity === 'legendary' || it.rarity === 'mythic') out.push({ id: 'essence_g', qty: it.rarity === 'epic' ? 1 : 3 });
  if (Math.random() < 0.25 + RARITY_VALUE[it.rarity] * 0.02) out.push({ id: 'enhance_stone', qty: 1 });
  return out;
}

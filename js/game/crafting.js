// Crafting recipes (generated per tier) and the craft action.
import { G, emit } from '../core/state.js';
import { L, t } from '../core/i18n.js';
import { chance } from '../core/util.js';
import { ITEMS, MATERIALS, NOUNS, WEAPONS } from '../data/items.js';
import { genEquip, makeStack, addItem, countItem, removeItem, freeSlots } from './items.js';
import { Prof } from './gathering.js';
import { Audio } from '../audio.js';

export const RECIPES = [];
const R = r => { r.id = r.id || (r.prof + '_' + RECIPES.length); RECIPES.push(r); };

for (let T = 1; T <= 6; T++) {
  const ilvl = T * 10 - 1, req = (T - 1) * 15 + 1;
  const ore = 'ore' + T, wood = 'wood' + T, lea = 'leather' + Math.min(5, T), clo = 'cloth' + Math.min(5, T);
  // smithing: weapons + plate/mail
  for (const k of ['sword', 'axe', 'mace', 'greatsword', 'dagger', 'shield', 'staff', 'wand', 'bow', 'scythe', 'orb', 'tome']) {
    const W = WEAPONS[k];
    const mats = W.mat === 'wood' ? [{ id: wood, qty: 6 + T }, { id: ore, qty: 2 }] : W.mat === 'gem' ? [{ id: ore, qty: 4 }, { id: 'gem' + Math.min(5, Math.ceil(T / 1.5)), qty: 1 }] : W.mat === 'cloth' ? [{ id: clo, qty: 6 }, { id: lea, qty: 2 }] : [{ id: ore, qty: (W.twoHand ? 10 : 6) + T }, { id: lea, qty: 2 }];
    R({ prof: 'smithing', lvl: req + (W.twoHand ? 5 : 0), tier: T, gear: { slot: W.slot, kind: k, ilvl }, mats: [...mats, { id: 'essence', qty: T }], name: `${MATERIALS[W.mat][T].split('|')[0]} ${W.noun.split('|')[0]}|${MATERIALS[W.mat][T].split('|')[1]} ${W.noun.split('|')[1]}` });
  }
  for (const slot of ['chest', 'legs', 'head', 'shoulders', 'hands', 'feet']) {
    for (const at of ['plate', 'mail']) R({ prof: 'smithing', lvl: req + (slot === 'chest' ? 3 : 0), tier: T, gear: { slot, armorType: at, ilvl }, mats: [{ id: ore, qty: (slot === 'chest' || slot === 'legs' ? 8 : 5) + T }, { id: lea, qty: 2 }, { id: 'essence', qty: T }], name: `${MATERIALS[at][T].split('|')[0]} ${NOUNS[at][slot].split('|')[0]}|${MATERIALS[at][T].split('|')[1]} ${NOUNS[at][slot].split('|')[1]}` });
    for (const at of ['cloth', 'leather']) R({ prof: 'tailoring', lvl: req + (slot === 'chest' ? 3 : 0), tier: T, gear: { slot, armorType: at, ilvl }, mats: [{ id: at === 'cloth' ? clo : lea, qty: (slot === 'chest' || slot === 'legs' ? 8 : 5) + T }, { id: at === 'cloth' ? lea : clo, qty: 2 }, { id: 'essence', qty: T }], name: `${MATERIALS[at][T].split('|')[0]} ${NOUNS[at][slot].split('|')[0]}|${MATERIALS[at][T].split('|')[1]} ${NOUNS[at][slot].split('|')[1]}` });
  }
  R({ prof: 'tailoring', lvl: req + 5, tier: T, gear: { slot: 'cape', ilvl }, mats: [{ id: clo, qty: 8 + T }, { id: 'silk', qty: 2 }, { id: 'essence', qty: T }], name: `${MATERIALS.cloth[T].split('|')[0]} Pelerin|${MATERIALS.cloth[T].split('|')[1]} Cloak` });
  // jewelcrafting
  const gem = 'gem' + Math.min(5, Math.max(1, Math.ceil(T / 1.4)));
  for (const slot of ['ring', 'neck', 'trinket']) R({ prof: 'jewelcrafting', lvl: req + (slot === 'trinket' ? 6 : 0), tier: T, gear: { slot, ilvl }, mats: [{ id: ore, qty: 4 + T }, { id: gem, qty: slot === 'trinket' ? 2 : 1 }, { id: 'essence', qty: T + 1 }], name: `${MATERIALS.gem[T].split('|')[0]} ${NOUNS[slot].split('|')[0]}|${MATERIALS.gem[T].split('|')[1]} ${NOUNS[slot].split('|')[1]}` });
}
// enhancement stones & bags
R({ prof: 'smithing', lvl: 1, out: { id: 'enhance_stone', qty: 1 }, mats: [{ id: 'ore1', qty: 3 }, { id: 'essence', qty: 2 }] });
R({ prof: 'smithing', lvl: 40, out: { id: 'enhance_stone', qty: 3 }, mats: [{ id: 'ore4', qty: 3 }, { id: 'essence', qty: 4 }] });
R({ prof: 'jewelcrafting', lvl: 30, out: { id: 'lucky_charm', qty: 1 }, mats: [{ id: 'gem4', qty: 1 }, { id: 'essence_g', qty: 1 }] });
// alchemy
const POT = [['hp1', 1, [['herb1', 2], ['slime_gel', 1]]], ['mp1', 1, [['herb1', 2], ['fish1', 1]]], ['hp2', 15, [['herb2', 2], ['herb1', 1]]], ['mp2', 15, [['herb2', 2], ['fish2', 1]]],
  ['hp3', 35, [['herb3', 2], ['herb4', 1]]], ['mp3', 35, [['herb4', 2], ['fish3', 1]]], ['hp4', 55, [['herb5', 2], ['herb6', 1]]], ['mp4', 55, [['herb6', 2], ['fish5', 1]]],
  ['elixir_power', 20, [['herb2', 3], ['ember', 1]]], ['elixir_fort', 20, [['herb3', 3], ['bone', 2]]], ['elixir_wisdom', 10, [['herb1', 4], ['essence', 2]]]];
for (const [id, lvl, mats] of POT) R({ prof: 'alchemy', lvl, out: { id, qty: id.startsWith('elixir') ? 1 : 2 }, mats: mats.map(([m, q]) => ({ id: m, qty: q })) });
// cooking
const FOOD = [['bread', 1, [['herb1', 1]]], ['food1', 1, [['meat', 2]]], ['food2', 10, [['fish1', 2], ['herb1', 1]]], ['food3', 25, [['meat', 3], ['herb3', 1]]], ['food4', 50, [['fish4', 2], ['fish5', 1], ['herb5', 1]]]];
for (const [id, lvl, mats] of FOOD) R({ prof: 'cooking', lvl, out: { id, qty: 2 }, mats: mats.map(([m, q]) => ({ id: m, qty: q })) });

export const Crafting = {
  canCraft(r, n = 1) {
    const ch = G.char;
    if (!Prof.has(r.prof)) return L('Meslek öğrenilmedi|Profession not learned');
    if (Prof.level(r.prof) < r.lvl) return L(`Beceri ${r.lvl} gerekli|Requires skill ${r.lvl}`);
    for (const m of r.mats) if (countItem(ch, m.id) < m.qty * n) return L('Malzeme eksik|Missing materials');
    if (freeSlots(ch) < 1) return t('bagFull');
    return null;
  },
  craft(r, n = 1) {
    const err = this.canCraft(r, n);
    if (err) { G.ui.error(err); return false; }
    const ch = G.char;
    for (let i = 0; i < n; i++) {
      for (const m of r.mats) removeItem(ch, m.id, m.qty);
      if (r.gear) {
        const skill = Prof.level(r.prof);
        const master = chance(0.12 + Math.max(0, skill - r.lvl) * 0.004);
        const it = genEquip({ ...r.gear, rarity: master ? 'epic' : 'rare', cls: ch.cls });
        it.crafted = ch.name;
        G.progress.giveItem(it);
        if (master) { G.ui.toast('star', L('Ustalık işi! Destansı eşya ürettin.|Masterwork! You crafted an epic item.'), '#b45aff'); Audio.sfx('loot_rare'); }
      } else G.progress.giveItem(makeStack(r.out.id, r.out.qty));
      const gap = Prof.level(r.prof) - r.lvl;
      Prof.addXp(r.prof, gap > 25 ? 2 : gap > 12 ? 6 : 12);
    }
    Audio.sfx({ smithing: 'craft_hammer', jewelcrafting: 'craft_hammer', tailoring: 'cloth', alchemy: 'craft_brew', cooking: 'craft_cook' }[r.prof] || 'craft_hammer');
    G.player.playAct(r.prof === 'smithing' ? 'overhead' : 'cast', 0.6);
    emit('crafted', r); emit('bagChanged');
    return true;
  },
  recipeName(r) { return r.out ? L(ITEMS[r.out.id].name) + (r.out.qty > 1 ? ' x' + r.out.qty : '') : L(r.name); },
};
G.crafting = Crafting;

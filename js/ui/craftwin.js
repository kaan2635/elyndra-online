// Crafting window.
import { G, emit } from '../core/state.js';
import { L, t } from '../core/i18n.js';
import { h, UI } from './ui.js';
import { iconURL, ICON_THEMES } from '../gfx/icons.js';
import { ITEMS, WEAPONS } from '../data/items.js';
import { RECIPES, Crafting } from '../game/crafting.js';
import { PROFS, Prof } from '../game/gathering.js';
import { countItem, makeStack } from '../game/items.js';
import { slotEl } from './windows.js';

const gearIcon = g => g.kind ? WEAPONS[g.kind].icon : { head: 'helmet', shoulders: 'shoulders', chest: 'chest', hands: 'gloves', legs: 'pants', feet: 'boots', cape: 'cape', ring: 'ring', neck: 'necklace', trinket: 'trinket' }[g.slot] || 'chest';

UI.register('craft', {
  title: () => t('menuCraft'), icon: 'hammer_anvil', w: 620, listen: ['bagChanged', 'profLevel', 'profUnlocked'],
  build(w) {
    const ch = G.char;
    const learned = Object.keys(PROFS).filter(id => Prof.has(id));
    // profession overview
    const ov = h('div.row.wrap', { style: { gap: '6px', marginBottom: '8px' } });
    for (const id of Object.keys(PROFS)) {
      const p = Prof.get(id);
      ov.append(h('div.chip', { style: { opacity: p ? 1 : 0.45 } }, h('img', { src: iconURL(PROFS[id].icon, { size: 32, ...ICON_THEMES.ui }), style: { width: '16px', height: '16px' } }), L(PROFS[id].name) + (p ? ` ${p.lvl}` : '')));
    }
    w.body.append(ov);
    const crafts = ['smithing', 'tailoring', 'alchemy', 'cooking', 'jewelcrafting'];
    const avail = crafts.filter(id => Prof.has(id));
    if (!avail.length) {
      w.body.append(h('div.card', L('Henüz bir üretim mesleği öğrenmedin. Aydınköy\'de Demirci Hasan (Demircilik), Simyacı Nur (Simya), Hancı Zeynep (Aşçılık) ve Pazarcı Elif (Terzilik, Kuyumculuk) sana ücretsiz öğretir.|You haven\'t learned a crafting profession yet. In Dawnhollow, Hasan the Smith (Blacksmithing), Nur the Alchemist (Alchemy), Zeynep the Innkeeper (Cooking) and Elif the Broker (Tailoring, Jewelcrafting) teach them for free.')));
      return;
    }
    w.prof = avail.includes(w.prof) ? w.prof : avail[0];
    UI.setTabs(w, avail.map(id => [id, L(PROFS[id].name).split(' ')[0] + ' ' + Prof.level(id)]), w.prof, k => { w.prof = k; UI.refresh('craft'); });
    const skill = Prof.level(w.prof);
    const list = RECIPES.filter(r => r.prof === w.prof && r.lvl <= skill + 15).sort((a, b) => b.lvl - a.lvl);
    w.onlyCan = w.onlyCan ?? false;
    w.body.append(h('label.row', { style: { marginBottom: '6px' } }, h('input', { type: 'checkbox', checked: w.onlyCan ? 'checked' : null, onchange: e => { w.onlyCan = e.target.checked; UI.refresh('craft'); } }), L('Sadece üretebileceklerimi göster|Only show what I can craft')));
    const box = h('div.list');
    for (const r of list) {
      const can = !Crafting.canCraft(r);
      if (w.onlyCan && !can) continue;
      const locked = skill < r.lvl;
      const icon = r.out ? iconURL(ITEMS[r.out.id].icon, { size: 64, fill: ITEMS[r.out.id].fill }) : iconURL(gearIcon(r.gear), { size: 64, ...ICON_THEMES.ui, frame: '#3a9aff' });
      const mats = h('div.row.wrap', { style: { gap: '4px' } }, ...r.mats.map(m => {
        const have = countItem(G.char, m.id);
        return h('span.chip', { style: { color: have >= m.qty ? 'var(--good)' : 'var(--bad)' } }, h('img', { src: iconURL(ITEMS[m.id]?.icon || 'bag', { size: 32, fill: ITEMS[m.id]?.fill }), style: { width: '16px', height: '16px' } }), `${L(ITEMS[m.id]?.name || m.id)} ${have}/${m.qty}`);
      }));
      const row = h('div.card', { style: { opacity: locked ? 0.5 : 1 } },
        h('div.row', h('img.ico.l', { src: icon }), h('div', { style: { flex: 1, minWidth: 0 } },
          h('div', { style: { fontWeight: 800, color: r.gear ? '#6ab4ff' : '' } }, Crafting.recipeName(r)),
          h('div.muted', { style: { fontSize: '11.5px' } }, (r.gear ? L(`Eşya seviyesi ${r.gear.ilvl} · Nadir (Ustalık işi: Destansı)|Item level ${r.gear.ilvl} · Rare (Masterwork: Epic)`) : '') + ' · ' + L('Beceri |Skill ') + r.lvl)),
          h('div.row', h('button.btn.small' + (can ? '.primary' : '.disabled'), { onclick: () => Crafting.craft(r) }, L('Üret|Craft')), r.out ? h('button.btn.small' + (!Crafting.canCraft(r, 5) ? '' : '.disabled'), { onclick: () => Crafting.craft(r, 5) }, 'x5') : null)),
        mats);
      box.append(row);
    }
    if (!box.children.length) box.append(h('div.muted', L('Uygun tarif yok.|No matching recipes.')));
    w.body.append(box);
    w.body.append(h('div.muted', { style: { fontSize: '11.5px', marginTop: '8px' } }, L('Beceri seviyeni yükseltmek için tarifleri üret. Seviyenin çok altındaki tarifler daha az tecrübe verir.|Craft recipes to raise your skill. Recipes far below your level give less experience.')));
  },
});

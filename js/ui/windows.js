// Core windows: bags, character, skills, talents, item tooltips, item actions, enhancement.
import { G, emit } from '../core/state.js';
import { L, t } from '../core/i18n.js';
import { fmtNum, fmtGold, clamp } from '../core/util.js';
import { h, icon, UI, skillIcon, uiIcon, themeOf } from './ui.js';
import { iconURL, ICON_THEMES } from '../gfx/icons.js';
import { CLASSES, RACES, RES, S, xpNeed } from '../data/classes.js';
import { SKILLS, CLASS_SKILLS } from '../data/skills.js';
import { TALENTS, TALENT_INDEX, talentPoints, ROW_REQ } from '../data/talents.js';
import { ITEMS, RARITY_COL, LEGENDARIES, SLOTS, WEAPONS } from '../data/items.js';
import { itemName, itemColor, itemIconOpts, canEquip, slotFor, equipFromBag, unequip, sellValue, salvageResult, addItem, removeItem, sortBag, bagSize, countItem, enhance, enhanceCost, enhanceChance, ENH_MAX, makeStack, freeSlots } from '../game/items.js';
import { refreshHero, rebuildHeroModel, applyTalents } from '../game/hero.js';
import { gearScore } from '../game/stats.js';
import { Audio } from '../audio.js';

const STAT_ORDER = ['str', 'agi', 'int', 'sta', 'spi', 'armor', 'power', 'crit', 'critDmg', 'haste', 'dodge', 'block', 'leech', 'speed', 'healPct', 'mf', 'goldPct', 'xpPct'];
const PCT = new Set(['crit', 'critDmg', 'haste', 'dodge', 'block', 'leech', 'speed', 'healPct', 'mf', 'goldPct', 'xpPct']);
const STAT_NAME = k => ({ str: t('st_str'), agi: t('st_agi'), int: t('st_int'), sta: t('st_sta'), spi: t('st_spi'), armor: t('st_armor'), power: t('st_power') === 'st_power' ? 'Güç' : L('Saldırı/Büyü Gücü|Attack/Spell Power'), crit: t('st_crit'), critDmg: t('st_critDmg'), haste: t('st_haste'), dodge: t('st_dodge'), block: t('st_block'), leech: t('st_leech'), speed: t('st_speed'), healPct: t('st_heal'), mf: L('Sihirli Eşya Bulma|Magic Find'), goldPct: L('Altın Bulma|Gold Find'), xpPct: L('Tecrübe Kazanımı|Experience Gain') }[k] || k);
export const statLine = (k, v) => (v > 0 ? '+' : '') + (PCT.has(k) ? (Math.round(v * 10) / 10) + '% ' : fmtNum(v) + ' ') + STAT_NAME(k);

export function itemIcon(it, cls = 'ico') {
  const o = itemIconOpts(it);
  return h('img.' + cls, { src: iconURL(o.name, { size: 64, fill: o.fill, frame: o.frame, glow: o.glow }) });
}
export function itemScore(it, cls) {
  if (!it || !it.stats) return 0;
  const C = CLASSES[cls]; const pr = C?.primary;
  let s = 0;
  for (const k in it.stats) {
    const v = it.stats[k];
    if (k === pr) s += v * 2; else if (k === 'sta') s += v * 1.2; else if (k === 'power') s += v * 0.9; else if (k === 'armor') s += v * 0.12;
    else if (['str', 'agi', 'int'].includes(k)) s += v * 0.15; else if (k === 'spi') s += v * (cls === 'cleric' ? 1 : 0.4);
    else if (PCT.has(k)) s += v * S(it.ilvl) * 0.35;
  }
  if (it.power) s *= 1.15;
  return s;
}
export function isUpgrade(it, u) {
  if (!it || it.type !== 'equip' || canEquip(u, it)) return false;
  const slot = it.slot === 'ring' ? (!u.equip.ring ? 'ring' : !u.equip.ring2 ? 'ring2' : (itemScore(u.equip.ring, u.cls) < itemScore(u.equip.ring2, u.cls) ? 'ring' : 'ring2')) : it.slot;
  const cur = u.equip[slot];
  return itemScore(it, u.cls) > itemScore(cur, u.cls) * 1.02 + 0.5;
}

// ------------------------------------------------------------ tooltip
export function itemTip(it, opts = {}) {
  if (!it) return null;
  const u = G.player;
  const root = h('div');
  if (it.id) {
    const T = ITEMS[it.id] || {};
    root.append(h('div.tn', { style: { color: itemColor(it) } }, itemName(it)),
      h('div.ts', h('span', { tr: '', en: '' }[0] || L({ consumable: 'Tüketilebilir|Consumable', material: 'Malzeme|Material', junk: 'Hurda|Junk', quest: 'Görev Eşyası|Quest Item', currency: 'Para Birimi|Currency' }[T.type] || '')), h('span', it.qty > 1 ? 'x' + it.qty : '')));
    if (T.desc) root.append(h('div.desc', L(T.desc)));
    if (T.use?.potion) root.append(h('div.sec', L(`Kullan: Azami ${T.use.potion === 'hp' ? 'canının' : 'manandaki'} %${Math.round(T.use.pct * 100)}'ini yeniler. (30 sn bekleme)|Use: Restores ${Math.round(T.use.pct * 100)}% of maximum ${T.use.potion === 'hp' ? 'health' : 'mana'}. (30 sec cooldown)`)));
    if (T.use?.buff) root.append(h('div.sec', L('Kullan: |Use: ') + L(T.use.buff.name) + ' (' + Math.round(T.use.buff.dur / 60) + L(' dk| min') + ')'));
    if (T.use?.food) root.append(h('div.muted', L('Savaş dışında yenebilir.|Eat out of combat.')));
    if (T.value) root.append(h('div.ts', h('span', L('Satış: |Sell: ')), h('span.gold', fmtGold(sellValue(it)))));
    return root;
  }
  const leg = it.legendary ? LEGENDARIES[it.legendary] : null;
  root.append(h('div.tn', { style: { color: RARITY_COL[it.rarity] } }, itemName(it)));
  root.append(h('div.ts', h('span', t('r_' + it.rarity) + ' · ' + (it.kind ? L(WEAPONS[it.kind].noun) : it.armorType ? L({ plate: 'Plaka|Plate', mail: 'Zincir|Mail', leather: 'Deri|Leather', cloth: 'Kumaş|Cloth' }[it.armorType]) : '')), h('span', t('s_' + it.slot))));
  root.append(h('div.ts', h('span', t('st_ilvl') + ' ' + it.ilvl), it.twoHand ? h('span', L('İki El|Two-Hand')) : null));
  const main = ['str', 'agi', 'int', 'sta', 'armor', 'power'];
  for (const k of STAT_ORDER) {
    const v = it.stats[k]; if (!v) continue;
    root.append(h('div.' + (main.includes(k) && !it.affixes?.some(a => k === a) ? 'st' : 'sec'), statLine(k, v)));
  }
  if (it.plus) root.append(h('div.sec', { style: { color: '#8ad8ff' } }, L(`Güçlendirme +${it.plus} (ana özellikler +%${Math.round(it.plus * 4.5)})|Enhanced +${it.plus} (main stats +${Math.round(it.plus * 4.5)}%)`)));
  if (leg) root.append(h('div.pw', '★ ' + L(leg.desc)));
  if (it.set && G.sets) root.append(G.sets.tip(it.set, u));
  const err = u ? canEquip(u, it) : null;
  root.append(h('div.ts', h('span', { class: err && it.reqLevel > (u?.level || 1) ? 'bad' : '' }, L('Gereken seviye |Requires level ') + it.reqLevel), h('span.gold', fmtGold(it.value))));
  if (err && !(it.reqLevel > u.level)) root.append(h('div.bad', err));
  // comparison
  if (u && opts.compare !== false) {
    const slot = slotFor(u, it);
    const cur = u.equip[slot];
    if (cur && cur !== it) {
      const diff = {};
      for (const k of new Set([...Object.keys(it.stats), ...Object.keys(cur.stats)])) { const d = (it.stats[k] || 0) - (cur.stats[k] || 0); if (Math.abs(d) >= 0.1) diff[k] = d; }
      const cmp = h('div.cmp', h('div.muted', L('Kuşanılanla karşılaştırma:|Compared to equipped:')));
      for (const k of STAT_ORDER) if (diff[k]) cmp.append(h('div', { style: { color: diff[k] > 0 ? 'var(--good)' : 'var(--bad)' } }, statLine(k, diff[k])));
      root.append(cmp);
    }
  }
  return root;
}

// ------------------------------------------------------------ item action popup
export function itemActions(it, ctx = {}) {
  const ch = G.char, u = G.player;
  UI.modal((box, close) => {
    box.append(h('div.row', itemIcon(it, 'ico l'), h('div', { style: { flex: 1 } }, itemTip(it))));
    const row = h('div.row.wrap', { style: { justifyContent: 'flex-end' } });
    const idx = ch.bag.indexOf(it);
    const where = ctx.slot ? 'equip' : idx >= 0 ? 'bag' : ctx.where;
    if (where === 'equip') {
      row.append(h('button.btn', { onclick: () => { const e = unequip(ch, u, ctx.slot); if (e) UI.error(e); else afterEquip(); close(); } }, t('unequip')));
      row.append(h('button.btn.blue', { onclick: () => { close(); UI.open('enhance', it); } }, L('Güçlendir|Enhance')));
    } else if (where === 'bag') {
      if (it.type === 'equip') {
        const err = canEquip(u, it);
        row.append(h('button.btn.primary' + (err ? '.disabled' : ''), { onclick: () => { const e = equipFromBag(ch, u, idx); if (e) UI.error(e); else { Audio.sfx('equip'); afterEquip(); } close(); } }, t('equip')));
        row.append(h('button.btn.blue', { onclick: () => { close(); UI.open('enhance', it); } }, L('Güçlendir|Enhance')));
        row.append(h('button.btn', { onclick: () => { close(); doSalvage([it]); } }, t('salvage')));
      } else if (ITEMS[it.id]?.use) {
        row.append(h('button.btn.primary', { onclick: () => { G.inv.useItemId(it.id); close(); } }, t('use')));
      }
      if (G.vendorOpen) row.append(h('button.btn.green', { onclick: () => { sellItem(it); close(); } }, t('sell') + ' (' + fmtGold(sellValue(it)) + ')'));
      if (UI.isOpen('bank')) row.append(h('button.btn', { onclick: () => { G.bank?.deposit(it); close(); } }, L('Depoya Koy|Deposit')));
      if (UI.isOpen('market') && it.type !== 'quest') row.append(h('button.btn', { onclick: () => { close(); G.market?.listDialog(it); } }, L('Pazarda Sat|List on Market')));
      if (!it.id || ITEMS[it.id]?.type === 'junk' || ITEMS[it.id]?.type === 'material') row.append(h('button.btn.red.small', { onclick: () => UI.confirm(L(`${itemName(it)} yok edilsin mi?|Destroy ${itemName(it)}?`), () => { ch.bag[ch.bag.indexOf(it)] = null; emit('bagChanged'); close(); }, { danger: true }) }, L('Yok Et|Destroy')));
    }
    row.append(h('button.btn.ghost', { onclick: close }, t('close')));
    box.append(row);
  }, { w: 420 });
}
function afterEquip() {
  const u = G.player;
  refreshHero(u); rebuildHeroModel(u);
  emit('bagChanged'); emit('charChanged');
  G.portraitDirty = true;
}
export function sellItem(it) {
  const ch = G.char; const i = ch.bag.indexOf(it); if (i < 0) return;
  const v = sellValue(it);
  ch.bag[i] = null; ch.gold += v;
  G.buyback = G.buyback || []; G.buyback.unshift(it); G.buyback.length = Math.min(G.buyback.length, 8);
  Audio.sfx('sell');
  emit('bagChanged'); emit('goldGained', v);
}
export function doSalvage(list) {
  const ch = G.char;
  const got = {};
  for (const it of list) {
    const i = ch.bag.indexOf(it); if (i < 0) continue;
    ch.bag[i] = null;
    for (const r of salvageResult(it)) got[r.id] = (got[r.id] || 0) + r.qty;
  }
  for (const id in got) addItem(ch, makeStack(id, got[id]), true);
  Audio.sfx('craft_hammer');
  G.ui.toast('essence', L('Parçalandı: |Salvaged: ') + Object.entries(got).map(([id, q]) => L(ITEMS[id].name) + ' x' + q).join(', '), '#d68aff');
  emit('bagChanged'); emit('salvaged', list.length);
}

// ------------------------------------------------------------ slot element
export function slotEl(it, opts = {}) {
  const u = G.player;
  const el = h('div.slot' + (it ? '' : '.empty'), { 'data-ph': opts.ph || '' });
  if (it) {
    el.append(itemIcon(it, 'ico'));
    const o = itemIconOpts(it);
    if (o.badge) el.append(h('span.q', { style: { color: it.plus && !it.id ? '#8ad8ff' : '#fff' } }, o.badge));
    if (!it.id && u && opts.bag) {
      if (canEquip(u, it)) el.classList.add('cant'); else if (isUpgrade(it, u)) el.classList.add('up');
      if (G.char.newItems?.[it.uid]) el.classList.add('new');
    }
    UI.tip(el, () => itemTip(it, { compare: opts.compare }));
  }
  el.addEventListener('click', () => { if (G.char.newItems && it) delete G.char.newItems[it.uid]; opts.onClick?.(it, el); });
  if (opts.onRight) el.addEventListener('contextmenu', e => { e.preventDefault(); opts.onRight(it); });
  return el;
}

// ------------------------------------------------------------ BAG
UI.register('bag', {
  title: () => t('menuBag'), icon: 'backpack', w: 400, side: 'right', listen: ['bagChanged', 'goldGained'],
  build(w) {
    const ch = G.char, u = G.player;
    ch.bag.length = bagSize(ch);
    w.tab = w.tab || 'all';
    UI.setTabs(w, [['all', t('all')], ['equip', L('Ekipman|Gear')], ['use', L('Tüketilebilir|Consumables')], ['mat', L('Malzeme|Materials')]], w.tab, k => { w.tab = k; UI.refresh('bag'); });
    const top = h('div.row', { style: { marginBottom: '8px' } },
      h('img', { src: iconURL('coins', { size: 32, ...ICON_THEMES.gold }), style: { width: '20px' } }), h('span.gold', fmtGold(ch.gold)),
      h('span.spacer'), h('span.muted', `${bagSize(ch) - freeSlots(ch)}/${bagSize(ch)}`),
      h('button.btn.small', { onclick: () => { sortBag(ch); } }, L('Sırala|Sort')));
    w.body.append(top);
    const grid = h('div.grid', { style: { gridTemplateColumns: 'repeat(auto-fill, minmax(48px, 1fr))' } });
    const filt = it => {
      if (!it || w.tab === 'all') return true;
      const T = it.id ? ITEMS[it.id] : null;
      if (w.tab === 'equip') return !it.id;
      if (w.tab === 'use') return T?.type === 'consumable';
      return T && T.type !== 'consumable';
    };
    ch.bag.forEach((it, i) => {
      if (w.tab !== 'all' && (!it || !filt(it))) return;
      grid.append(slotEl(it, { bag: true, onClick: x => x && itemActions(x), onRight: x => { if (!x) return; if (x.type === 'equip') { const e = equipFromBag(ch, u, ch.bag.indexOf(x)); if (e) UI.error(e); else { Audio.sfx('equip'); afterEquip(); } } else if (G.vendorOpen) sellItem(x); else if (ITEMS[x.id]?.use) G.inv.useItemId(x.id); } }));
    });
    w.body.append(grid);
    const act = h('div.row.wrap', { style: { marginTop: '10px' } });
    if (G.vendorOpen) {
      const junk = ch.bag.filter(x => x && x.id && ITEMS[x.id]?.type === 'junk');
      act.append(h('button.btn.green.small' + (junk.length ? '' : '.disabled'), { onclick: () => { let g = 0; for (const j of junk) { g += sellValue(j); ch.bag[ch.bag.indexOf(j)] = null; } ch.gold += g; Audio.sfx('sell'); G.ui.toast('coins', L('Hurdalar satıldı: +|Junk sold: +') + g, '#ffd660'); emit('bagChanged'); } }, L('Hurdaları Sat|Sell Junk')));
      const greys = ch.bag.filter(x => x && !x.id && (x.rarity === 'common') && !isUpgrade(x, u));
      act.append(h('button.btn.green.small' + (greys.length ? '' : '.disabled'), { onclick: () => UI.confirm(L(`${greys.length} sıradan eşya satılsın mı?|Sell ${greys.length} common items?`), () => { for (const j of greys) sellItem(j); }) }, L('Sıradanları Sat|Sell Commons')));
    }
    const salv = ch.bag.filter(x => x && !x.id && (x.rarity === 'common' || x.rarity === 'uncommon') && !isUpgrade(x, u) && !x.plus);
    act.append(h('button.btn.small' + (salv.length ? '' : '.disabled'), { onclick: () => UI.confirm(L(`${salv.length} sıradan/kaliteli eşya parçalansın mı?|Salvage ${salv.length} common/uncommon items?`), () => doSalvage(salv)) }, L('Toplu Parçala|Salvage Low')));
    act.append(h('span.muted', { style: { fontSize: '11px' } }, UI.touch ? L('Dokun: işlemler · Basılı tut: bilgi|Tap: actions · Hold: info') : L('Sol tık: işlemler · Sağ tık: kuşan/kullan|Left-click: actions · Right-click: equip/use')));
    w.body.append(act);
  },
});

// ------------------------------------------------------------ CHARACTER
UI.register('char', {
  title: () => G.char?.name || t('menuChar'), icon: 'person', w: 520, side: 'left', listen: ['charChanged', 'levelUp', 'bagChanged'],
  build(w) {
    const ch = G.char, u = G.player, C = CLASSES[u.cls];
    w.tab = w.tab || 'gear';
    UI.setTabs(w, [['gear', L('Ekipman|Equipment')], ['stats', L('Özellikler|Statistics')], ['rep', L('İtibar|Reputation')]], w.tab, k => { w.tab = k; UI.refresh('char'); });
    w.body.append(h('div.row', { style: { marginBottom: '8px' } }, h('img.ico.l', { src: iconURL(C.icon, { size: 64, ...ICON_THEMES.ui, frame: C.color }) }),
      h('div', h('div', { style: { fontWeight: 900, fontSize: '16px' } }, ch.name, ch.activeTitle ? h('span.muted', ' · ' + L(G.titles?.name(ch.activeTitle) || '')) : null), h('div.muted', `${t('level')} ${u.level} ${L(RACES[u.race].name)} ${L(C.name)}`)),
      h('span.spacer'), h('div', { style: { textAlign: 'right' } }, h('div.muted', { style: { fontSize: '11px' } }, t('st_power')), h('div.gold', { style: { fontSize: '18px' } }, fmtNum(gearScore(u))))));
    if (w.tab === 'gear') {
      const L1 = ['head', 'shoulders', 'chest', 'cape', 'hands', 'legs', 'feet'], R1 = ['main', 'off', 'neck', 'ring', 'ring2', 'trinket'];
      const col = list => h('div.list', ...list.map(s => {
        const it = u.equip[s];
        return h('div.row', { style: { gap: '6px' } }, slotEl(it, { ph: t('s_' + s), compare: false, onClick: x => x && itemActions(x, { slot: s }) }),
          h('div', { style: { minWidth: 0, flex: 1, fontSize: '12px' } }, it ? h('div', { style: { color: RARITY_COL[it.rarity], fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } }, itemName(it)) : h('div.muted', t('s_' + s)), it ? h('div.muted', t('st_ilvl') + ' ' + it.ilvl) : null));
      }));
      w.body.append(h('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' } }, col(L1), col(R1)));
      w.body.append(h('div.row', { style: { marginTop: '8px' } },
        h('label.row', h('input', { type: 'checkbox', checked: ch.hideHelm ? 'checked' : null, onchange: e => { ch.hideHelm = e.target.checked; rebuildHeroModel(u); } }), L('Miğferi gizle|Hide helm')),
        h('label.row', h('input', { type: 'checkbox', checked: ch.hideCape ? 'checked' : null, onchange: e => { ch.hideCape = e.target.checked; rebuildHeroModel(u); } }), L('Pelerini gizle|Hide cape'))));
    } else if (w.tab === 'stats') {
      const s = u.stats;
      const kv = h('div.kv');
      const add = (k, v) => kv.append(h('div.k', k), h('div.v', v));
      add(t('st_hp'), fmtNum(s.maxHp)); add(L(RES[u.resType].name), fmtNum(s.maxRes));
      for (const k of ['str', 'agi', 'int', 'sta', 'spi']) add(STAT_NAME(k), fmtNum(s[k]));
      add(L('Saldırı/Büyü Gücü|Attack/Spell Power'), fmtNum(s.power)); add(t('st_armor'), fmtNum(s.armor));
      const mit = Math.min(75, s.armor / (s.armor + 30 * S(u.level) + 50) * 100);
      add(L('Fiziksel Azaltma|Physical Reduction'), mit.toFixed(1) + '%');
      for (const k of ['crit', 'critDmg', 'haste', 'dodge', 'block', 'leech', 'healPct', 'speed', 'mf', 'goldPct', 'xpPct']) if (s[k] || ['crit', 'critDmg', 'haste', 'dodge'].includes(k)) add(STAT_NAME(k), (Math.round((s[k] || 0) * 10) / 10) + '%');
      add(L('Hasar Bonusu|Damage Bonus'), (s.dmgPct || 0) + '%'); add(L('Alınan Hasar|Damage Taken'), (s.dmgTakenPct || 0) + '%');
      w.body.append(kv);
      const st = ch.stats || {};
      w.body.append(h('hr.sep'), h('div.title', L('Kayıtlar|Records')), h('div.kv',
        h('div.k', L('Öldürülen düşman|Enemies slain')), h('div.v', fmtNum(st.kills || 0)), h('div.k', L('Elit/Patron|Elites/Bosses')), h('div.v', (st.elites || 0) + ' / ' + (st.bosses || 0)),
        h('div.k', L('Ölüm|Deaths')), h('div.v', st.deaths || 0), h('div.k', L('Tamamlanan görev|Quests completed')), h('div.v', Object.keys(ch.quests.done).length),
        h('div.k', L('Oyun süresi|Time played')), h('div.v', Math.floor((ch.playtime || 0) / 3600) + L('sa |h ') + Math.floor((ch.playtime || 0) % 3600 / 60) + L('dk|m'))));
    } else {
      G.rep?.build?.(w.body) || w.body.append(h('div.muted', L('Henüz itibar kazanmadın.|No reputation yet.')));
    }
  },
});

// ------------------------------------------------------------ SKILLS (spellbook)
UI.register('skills', {
  title: () => t('menuSkills'), icon: 'book_open', w: 520, listen: ['levelUp', 'barChanged'],
  build(w) {
    const ch = G.char, u = G.player;
    w.body.append(h('div.muted', { style: { marginBottom: '8px', fontSize: '12.5px' } }, L('Bir yeteneği çubuğa yerleştirmek için yuvayı seç. Yetenekler seviye atladıkça açılır ve gücün arttıkça güçlenir.|Pick a slot to place a skill on your bar. Skills unlock as you level and grow with your power.')));
    const list = h('div.list');
    for (const id of CLASS_SKILLS[u.cls]) {
      const sk = SKILLS[id];
      const locked = sk.lvl > u.level;
      const onBar = ch.bar.indexOf(id);
      const slots = h('div.row.wrap', { style: { gap: '3px' } });
      for (let i = 0; i < 8; i++) slots.append(h('button.btn.small' + (ch.bar[i] === id ? '.primary' : '.ghost'), { style: { minWidth: '30px', padding: '2px 6px' }, onclick: () => { if (locked) return; const j = ch.bar.indexOf(id); if (j >= 0) ch.bar[j] = ch.bar[i]; ch.bar[i] = id; emit('barChanged'); } }, String(i + 1)));
      list.append(h('div.card' + (locked ? '' : ''), { style: { opacity: locked ? 0.55 : 1 } },
        h('div.row', h('img.ico.l', { src: skillIcon(sk, locked ? { dim: true } : {}) }),
          h('div', { style: { flex: 1, minWidth: 0 } }, h('div', { style: { fontWeight: 900, color: sk.ult ? '#ffd24a' : 'var(--ink)' } }, L(sk.name), locked ? h('span.chip', { style: { marginLeft: '6px' } }, t('level') + ' ' + sk.lvl) : null),
            h('div.muted', { style: { fontSize: '11.5px' } }, [sk.cost ? `${sk.cost}${u.resType === 'mana' ? '%' : ''} ${L(RES[u.resType].name)}` : t('free'), sk.cast ? sk.cast + L(' sn döküm| sec cast') : sk.channel ? L('Kanal |Channel ') + sk.channel + L(' sn| sec') : L('Anında|Instant'), sk.cd ? L('Bekleme |Cooldown ') + sk.cd + L(' sn| sec') : ''].filter(Boolean).join(' · ')))),
        h('div', { style: { fontSize: '12.5px', margin: '6px 0', color: '#ffd890', lineHeight: '1.4' } }, sk.desc(u, G.X)),
        locked ? null : slots));
    }
    w.body.append(list);
    w.body.append(h('hr.sep'), h('div.title', L('Genel|General')), h('div.kv',
      h('div.k', L('Otomatik saldırı|Auto-attack')), h('div.v', L('Düşmana dokun/tıkla|Tap/click an enemy')),
      h('div.k', L('Takla (kaçınma)|Roll (dodge)')), h('div.v', 'Shift'), h('div.k', L('Zıpla|Jump')), h('div.v', 'Space'),
      h('div.k', L('Binek|Mount')), h('div.v', 'T'), h('div.k', L('Otomatik koşu|Auto-run')), h('div.v', 'R')));
  },
});

// ------------------------------------------------------------ TALENTS
UI.register('talents', {
  title: () => t('menuTalents'), icon: 'talent', w: 640, listen: ['levelUp', 'talentsChanged'],
  build(w) {
    const ch = G.char, u = G.player;
    const trees = TALENTS[u.cls];
    const total = talentPoints(u.level) + (ch.mastery?.talentBonus || 0);
    const spent = Object.values(ch.talents).reduce((a, b) => a + b, 0);
    const left = total - spent;
    w.body.append(h('div.row', { style: { marginBottom: '8px' } }, h('div', L('Kullanılabilir puan: |Points available: '), h('b.gold', String(left)), h('span.muted', ` / ${total}`)), h('span.spacer'),
      h('button.btn.small', { onclick: () => UI.confirm(L('Tüm yetenek puanları ücretsiz sıfırlansın mı?|Reset all talent points for free?'), () => { ch.talents = {}; applyTalents(u, ch.talents); refreshHero(u); emit('talentsChanged'); }) }, L('Sıfırla (Ücretsiz)|Reset (Free)'))));
    if (u.level < 10) w.body.append(h('div.card.muted', L('Yetenek ağacı 10. seviyede açılır. Her seviyede 1 puan kazanırsın.|The talent tree unlocks at level 10. You earn 1 point per level.')));
    const grid = h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px' } });
    for (const br of trees) {
      const inBr = br.nodes.reduce((a, n) => a + (ch.talents[n.id] || 0), 0);
      const col = h('div.card', h('div.row', h('img.ico.s', { src: uiIcon(br.icon) }), h('b', L(br.name)), h('span.spacer'), h('span.chip', String(inBr))));
      for (let row = 0; row < 6; row++) {
        const n = br.nodes.find(x => x.row === row); if (!n) continue;
        const rk = ch.talents[n.id] || 0;
        const reqOk = !n.req || (ch.talents[n.req] || 0) >= TALENT_INDEX[n.req].max;
        const rowOk = inBr >= row * ROW_REQ;
        const can = left > 0 && rk < n.max && reqOk && rowOk;
        const tal = h('div.talent' + (rk >= n.max ? '.maxed' : '') + (!rowOk || !reqOk ? '.locked' : '') + (can ? '.avail' : ''), h('img', { src: iconURL(n.icon, { size: 64, ...ICON_THEMES.ui, frame: rk ? '#ffd24a' : null }) }), h('span.rk', `${rk}/${n.max}`));
        const desc = r => L(n.desc).replace(/\{([\d.]+)\}/g, (_, v) => String(Math.round(parseFloat(v) * Math.max(1, r) * 10) / 10));
        UI.tip(tal, () => h('div', h('div.tn', L(n.name)), h('div.ts', `${rk}/${n.max}`), h('div.desc', desc(rk || 1)), rk && rk < n.max ? h('div.muted', L('Sonraki: |Next: ') + desc(rk + 1)) : null, !rowOk ? h('div.bad', L(`Bu dalda ${row * ROW_REQ} puan gerekli|Requires ${row * ROW_REQ} points in this tree`)) : null, !reqOk ? h('div.bad', L('Gerekli: |Requires: ') + L(TALENT_INDEX[n.req].name)) : null));
        tal.addEventListener('click', () => {
          if (!can) { if (UI.touch) UI.showTip(h('div', h('div.tn', L(n.name)), h('div.desc', desc(rk || 1))), innerWidth / 2 - 100, innerHeight / 2); return; }
          ch.talents[n.id] = rk + 1; applyTalents(u, ch.talents); refreshHero(u); Audio.sfx('buff', { vol: 0.6 }); emit('talentsChanged');
        });
        col.append(h('div.row', { style: { margin: '6px 0' } }, tal, h('div', { style: { fontSize: '12px', lineHeight: '1.3' } }, h('div', { style: { fontWeight: 800 } }, L(n.name)), h('div.muted', desc(Math.max(1, rk))))));
      }
      grid.append(col);
    }
    w.body.append(grid);
    if (u.level >= 60) G.mastery?.panel(w.body);
    else w.body.append(h('div.muted', { style: { fontSize: '12px', marginTop: '8px' } }, L('60. seviyeden sonra Ustalık sistemi açılır: sınırsız ilerleme ve kalıcı bonuslar.|After level 60 the Mastery system unlocks: endless progression and permanent bonuses.')));
  },
});

// ------------------------------------------------------------ ENHANCEMENT
UI.register('enhance', {
  title: () => L('Güçlendirme|Enhancement'), icon: 'anvil', w: 400, listen: ['bagChanged'],
  build(w, it) {
    const ch = G.char;
    if (!it) { w.body.append(h('div.muted', L('Bir eşya seç.|Choose an item.'))); return; }
    const c = enhanceCost(it);
    w.charm = w.charm || false;
    const chance = enhanceChance(it, w.charm);
    w.body.append(h('div.row', itemIcon(it, 'ico xl'), h('div', h('div', { style: { color: RARITY_COL[it.rarity], fontWeight: 900, fontSize: '15px' } }, itemName(it)), h('div.muted', `+${it.plus || 0} → +${Math.min(ENH_MAX, (it.plus || 0) + 1)}`))));
    w.body.append(h('div.card', { style: { margin: '10px 0' } }, h('div.kv',
      h('div.k', L('Başarı şansı|Success chance')), h('div.v', { style: { color: chance > 60 ? 'var(--good)' : chance > 30 ? 'var(--warn)' : 'var(--bad)' } }, chance + '%'),
      h('div.k', L('Taş|Stones')), h('div.v', `${countItem(ch, 'enhance_stone')} / ${c.stones}`),
      h('div.k', t('gold')), h('div.v.gold', fmtGold(c.gold)),
      h('div.k', L('Birikmiş şans bonusu|Pity bonus')), h('div.v', '+' + (it.pity || 0) + '%')),
      h('div.good', { style: { fontSize: '12px', marginTop: '6px' } }, L('✔ Başarısızlıkta eşyan asla kırılmaz veya seviye düşmez; bir sonraki denemenin şansı %6 artar.|✔ On failure your item never breaks or loses levels; your next attempt gains +6% chance.'))));
    if (countItem(ch, 'lucky_charm')) w.body.append(h('label.row', h('input', { type: 'checkbox', checked: w.charm ? 'checked' : null, onchange: e => { w.charm = e.target.checked; UI.refresh('enhance'); } }), L(`Şans Muskası kullan (+%15) — ${countItem(ch, 'lucky_charm')} adet|Use Lucky Charm (+15%) — ${countItem(ch, 'lucky_charm')} owned`)));
    const btn = h('button.btn.primary.big', { style: { width: '100%', marginTop: '8px' }, onclick: () => {
      const r = enhance(ch, it, w.charm);
      if (r.err) { UI.error(r.err); return; }
      if (r.ok) { Audio.sfx('enhance_success'); UI.toast('arrow_up', L('Başarılı! |Success! ') + itemName(it), '#8affb0'); G.vfx?.burst(G.player.pos, 'levelup', { n: 25 }); }
      else { Audio.sfx('enhance_fail'); UI.toast('refresh', L('Başarısız — sonraki şans arttı.|Failed — next chance increased.'), '#ffb02a'); }
      if (Object.values(G.player.equip).includes(it)) { refreshHero(G.player); rebuildHeroModel(G.player); }
      emit('charChanged');
    } }, (it.plus || 0) >= ENH_MAX ? L('Azami Seviye|Max Level') : L('Güçlendir|Enhance'));
    if ((it.plus || 0) >= ENH_MAX) btn.classList.add('disabled');
    w.body.append(btn, h('div', { style: { marginTop: '10px' } }, itemTip(it, { compare: false })));
  },
});

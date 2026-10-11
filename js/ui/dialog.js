// NPC dialog panel, quest offer/turn-in, vendors, inn, bank.
import { G, emit } from '../core/state.js';
import { L, t } from '../core/i18n.js';
import { fmtGold, fmtNum } from '../core/util.js';
import { h, icon, UI, uiIcon } from './ui.js';
import { iconURL, ICON_THEMES } from '../gfx/icons.js';
import { NPCS, SHOPS } from '../data/npcs.js';
import { QUESTS } from '../data/quests.js';
import { ITEMS, RARITY_COL } from '../data/items.js';
import { S, CLASSES } from '../data/classes.js';
import { itemTip, itemIcon, slotEl, itemActions, sellItem } from './windows.js';
import { genEquip, makeStack, addItem, itemName, bagSize, freeSlots, countItem } from '../game/items.js';
import { Audio } from '../audio.js';

let dlgEl = null, dlgUnit = null;

export function closeDialog() {
  if (!dlgEl) return false;
  dlgEl.remove(); dlgEl = null; dlgUnit = null;
  if (G.vendorOpen) { G.vendorOpen = null; UI.close('vendor'); }
  return true;
}
UI.closeDialog = closeDialog;

function shell(npc, text) {
  closeDialog();
  const el = h('div.dlg.panel');
  const head = h('div.dh', h('img.ico.l', { src: iconURL(npc?.roles?.includes('shop') ? 'scales' : npc?.roles?.includes('quest') ? 'quest_exclaim' : 'person', { size: 64, ...ICON_THEMES.ui }) }),
    h('div', { style: { flex: 1 } }, h('div.who', L(npc?.name || '')), npc?.title ? h('div.ttl', L(npc.title)) : null),
    h('button.btn.ghost.small', { onclick: closeDialog }, '✕'));
  const body = h('div.dt.qtext', text || '');
  const opts = h('div.opts');
  el.append(head, body, opts);
  UI.root.append(el);
  dlgEl = el;
  return { el, body, opts };
}
const opt = (iconName, label, fn, color) => h('button.opt', { onclick: fn }, h('img.ico', { src: iconURL(iconName, { size: 48, ...ICON_THEMES.ui }) }), h('span', { style: color ? { color } : null }, label));

export function openDialog(unit, o = {}) {
  if (o.quest) return questView(o.quest, unit);
  const npc = unit.npc; dlgUnit = unit;
  const Q = G.quests;
  const d = shell(npc, L(npc.greet || ''));
  const done = Q.turnInsAt(npc.id).filter(q => Q.isComplete(q.id));
  const offers = Q.offeredBy(npc.id);
  const prog = Q.turnInsAt(npc.id).filter(q => !Q.isComplete(q.id));
  for (const q of done) d.opts.append(opt('quest_question', L(q.name), () => questView(q.id, unit), '#ffd23a'));
  for (const q of offers) d.opts.append(opt('quest_exclaim', L(q.name) + (q.main ? '  ★' : '') + (q.repeat ? L('  (Günlük)|  (Daily)') : ''), () => questView(q.id, unit), q.repeat ? '#6ab4ff' : '#ffe08a'));
  for (const q of prog) d.opts.append(opt('quest_question', L(q.name) + L(' (devam ediyor)| (in progress)'), () => questView(q.id, unit), '#9a9a9a'));
  const r = npc.roles || [];
  if (r.includes('shop')) d.opts.append(opt('scales', L('Satıcı — alışveriş yap|Vendor — browse goods'), () => openVendor(npc)));
  if (r.includes('enhance')) d.opts.append(opt('anvil', L('Eşya güçlendir|Enhance items'), () => { closeDialog(); UI.open('bag'); G.ui.toast('anvil', L('Çantandan bir eşya seçip "Güçlendir"e bas.|Pick an item in your bag and press "Enhance".'), '#8ad8ff'); }));
  if (r.includes('train') && npc.prof) d.opts.append(opt('hammer_anvil', L('Zanaat eğitimi|Profession training'), () => { closeDialog(); G.prof?.trainDialog(npc); }));
  if (r.includes('inn')) d.opts.append(opt('house', L('Burayı evim yap (Dönüş noktası)|Make this inn my home (Hearth)'), () => {
    G.char.bind = { zone: G.zones.current.id, x: unit.pos.x, z: unit.pos.z + 2, name: G.zones.current.towns?.[0]?.name || G.zones.current.name };
    Audio.sfx('buff'); G.ui.toast('house', L('Dönüş noktan burası oldu.|This is now your home.'), '#8affb0'); closeDialog();
  }));
  if (r.includes('bank')) d.opts.append(opt('chest_box', L('Banka / Ortak Depo|Bank / Shared Stash'), () => { closeDialog(); UI.open('bank'); UI.open('bag'); }));
  if (r.includes('market')) d.opts.append(opt('scales', L('Pazar (Müzayede)|Market (Auction House)'), () => { closeDialog(); UI.open('market'); }));
  if (r.includes('guild')) d.opts.append(opt('guild', L('Lonca işlemleri|Guild services'), () => { closeDialog(); UI.open('social', 'guild'); }));
  if (r.includes('stable')) d.opts.append(opt('horse', L('Binekler|Mounts'), () => { closeDialog(); UI.open('collect', 'mounts'); }));
  if (r.includes('dungeon')) d.opts.append(opt('dungeon', L('Zindan Bulucu|Dungeon Finder'), () => { closeDialog(); UI.open('dungeon'); }));
  if (r.includes('arena')) d.opts.append(opt('sword_cross', L('Arena ve Sonsuz Kule|Arena & Endless Tower'), () => { closeDialog(); UI.open('arena'); }));
  d.opts.append(opt('close', L('Hoşça kal|Goodbye'), closeDialog));
}
UI.openDialog = openDialog;

function rewardsView(q, sel, onSel) {
  const Q = G.quests, rw = Q.rewardsFor(q);
  const wrap = h('div');
  const line = h('div.rewards');
  if (rw.xp) line.append(h('span.chip', { style: { color: '#c8a0ff' } }, '+' + fmtNum(rw.xp) + ' ' + t('xp')));
  if (rw.gold) line.append(h('span.chip', { style: { color: '#ffd660' } }, '+' + fmtGold(rw.gold) + ' ' + L('altın|gold')));
  for (const it of rw.items) line.append(h('div.row', { style: { gap: '4px' } }, slotEl(it), h('span', { style: { fontSize: '12px' } }, itemName(it) + (it.qty > 1 ? ' x' + it.qty : ''))));
  if (rw.unlock) line.append(h('span.chip', { style: { color: '#8affb0' } }, '★ ' + (G.prof?.unlockName?.(rw.unlock) || rw.unlock)));
  wrap.append(line);
  if (rw.choice.length) {
    wrap.append(h('div.muted', { style: { padding: '0 16px', fontSize: '12px' } }, L('Bir ödül seç:|Choose a reward:')));
    const cl = h('div.rewards');
    rw.choice.forEach((it, i) => {
      const s = slotEl(it, { onClick: () => onSel?.(i) });
      if (i === sel) s.style.boxShadow = '0 0 0 2px #ffd24a, 0 0 10px #ffb02a';
      cl.append(h('div', { style: { textAlign: 'center', fontSize: '10px', maxWidth: '70px' } }, s, h('div', { style: { color: RARITY_COL[it.rarity] } }, itemName(it))));
    });
    wrap.append(cl);
  }
  return wrap;
}

function questView(qid, unit) {
  const Q = G.quests, q = QUESTS[qid]; if (!q) return;
  const npc = NPCS[q.giver];
  const st = Q.state(qid), complete = Q.isComplete(qid);
  const d = shell(unit?.npc || npc, '');
  d.body.innerHTML = '';
  d.body.append(h('div.title', { style: { fontSize: '17px', marginBottom: '6px' } }, L(q.name), q.main ? h('span.chip', { style: { marginLeft: '8px' } }, L('Ana Hikâye|Main Story')) : null));
  let sel = 0;
  const render = () => {
    d.body.querySelectorAll('.rwrap').forEach(e => e.remove());
    const r = rewardsView(q, sel, i => { sel = i; render(); });
    r.className = 'rwrap';
    d.body.append(h('div.title.rwrap', { style: { fontSize: '13px', marginTop: '10px' } }, L('Ödüller|Rewards')), r);
  };
  if (complete) d.body.append(h('div', L(q.done || '')));
  else if (st) {
    d.body.append(h('div', L(q.progress || q.text)));
    d.body.append(h('ul.obj-list', ...q.obj.map((o, i) => h('li', `${Q.objText(o)}: ${Q.objCount(q, i)}/${o.n || 1}`))));
  } else {
    d.body.append(h('div', L(q.text)));
    d.body.append(h('div.title', { style: { fontSize: '13px', marginTop: '10px' } }, L('Hedefler|Objectives')), h('ul.obj-list', ...q.obj.map(o => h('li', Q.objText(o) + (o.n > 1 ? ' (' + o.n + ')' : '')))));
  }
  render();
  if (complete) d.opts.append(h('button.btn.primary.big', { onclick: () => { if (Q.complete(qid, sel)) { closeDialog(); if (unit) setTimeout(() => openDialog(unit), 200); } } }, L('Görevi Tamamla|Complete Quest')));
  else if (!st) {
    d.opts.append(h('div.row', h('button.btn.primary.big', { style: { flex: 1 }, onclick: () => { Q.accept(qid); closeDialog(); if (unit && Q.offeredBy(unit.npcId).length) setTimeout(() => openDialog(unit), 150); } }, t('accept')), h('button.btn.ghost', { onclick: () => unit ? openDialog(unit) : closeDialog() }, t('decline'))));
  } else d.opts.append(h('div.row', h('button.btn', { onclick: () => { closeDialog(); Q.autoPath(qid); } }, L('Hedefe Git|Go to Objective')), h('button.btn.ghost', { onclick: () => unit ? openDialog(unit) : closeDialog() }, t('back'))));
}

// ------------------------------------------------------------ vendor
const shopCache = {};
export function vendorStock(npc) {
  const sh = SHOPS[npc.shop]; const p = G.player;
  const key = npc.id + '|' + p.level + '|' + Math.floor(Date.now() / 6e5);
  if (!shopCache[key]) {
    const gear = [];
    if (sh.gear) {
      for (let i = 0; i < 8; i++) gear.push(genEquip({ ilvl: p.level, cls: p.cls, rarity: i < 5 ? 'uncommon' : 'rare' }));
    }
    shopCache[key] = gear;
  }
  return { items: sh.items || [], gear: shopCache[key], bags: sh.bags, rod: sh.rod };
}
export const buyPrice = it => it.id ? Math.max(1, Math.round((ITEMS[it.id].value || 1) * 4 * (ITEMS[it.id].type === 'material' ? 1.5 : 1))) : Math.round(it.value * 4);

function openVendor(npc) {
  closeDialog();
  G.vendorOpen = npc;
  UI.open('vendor', npc);
  UI.open('bag');
}
UI.register('vendor', {
  title: (npc) => L(SHOPS[npc?.shop]?.name || 'Satıcı|Vendor'), icon: 'scales', w: 430, side: 'left', listen: ['bagChanged', 'goldGained'],
  onClose() { G.vendorOpen = null; },
  build(w, npc) {
    const ch = G.char;
    const st = vendorStock(npc);
    w.tab = w.tab || 'buy';
    UI.setTabs(w, [['buy', L('Satın Al|Buy')], ['back', L('Geri Al|Buyback')]], w.tab, k => { w.tab = k; UI.refresh('vendor'); });
    w.body.append(h('div.row', { style: { marginBottom: '8px' } }, h('span.muted', L('Altının: |Your gold: ')), h('span.gold', fmtGold(ch.gold)), h('span.spacer'), h('span.muted', { style: { fontSize: '11px' } }, L('Satmak için çantadan eşyaya dokun.|Tap a bag item to sell it.'))));
    const list = h('div.list');
    const row = (it, price, onBuy, extra) => {
      const affordable = ch.gold >= price;
      list.append(h('div.card.row', slotEl(it), h('div', { style: { flex: 1, minWidth: 0 } }, h('div', { style: { fontWeight: 800, color: it.id ? '#fff' : RARITY_COL[it.rarity] } }, extra || itemName(it)), h('div.gold', { style: { fontSize: '12px', color: affordable ? '' : 'var(--bad)' } }, fmtGold(price) + ' ' + L('altın|gold'))),
        h('button.btn.small' + (affordable ? '.primary' : '.disabled'), { onclick: onBuy }, t('buy'))));
    };
    if (w.tab === 'buy') {
      for (const id of st.items) {
        const T = ITEMS[id]; if (!T) continue;
        if (T.lvl && T.lvl > G.player.level + 5) continue;
        const it = makeStack(id, 1); const price = buyPrice(it);
        row(it, price, () => {
          const n = T.stack > 1 ? 5 : 1;
          const cnt = Math.min(n, Math.floor(ch.gold / price)); if (cnt < 1) { G.ui.error(L('Yeterli altın yok|Not enough gold')); return; }
          if (addItem(ch, makeStack(id, cnt))) { ch.gold -= price * cnt; Audio.sfx('buy'); emit('goldGained', 0); }
        }, itemName(it) + (T.stack > 1 ? ' (x5)' : ''));
      }
      for (const it of st.gear) row(it, buyPrice(it), () => {
        const price = buyPrice(it);
        if (ch.gold < price) { G.ui.error(L('Yeterli altın yok|Not enough gold')); return; }
        if (addItem(ch, it)) { ch.gold -= price; st.gear.splice(st.gear.indexOf(it), 1); Audio.sfx('buy'); emit('goldGained', 0); }
      });
      if (st.bags) {
        const n = ch.bagUpgrades || 0;
        if (n < 8) {
          const price = Math.round(40 * Math.pow(2.2, n));
          list.append(h('div.card.row', h('img.ico.l', { src: iconURL('bag', { size: 64, ...ICON_THEMES.gold }) }), h('div', { style: { flex: 1 } }, h('div', { style: { fontWeight: 800 } }, L('Çanta Genişletme (+6 yuva)|Bag Expansion (+6 slots)')), h('div.gold', { style: { fontSize: '12px' } }, fmtGold(price))),
            h('button.btn.small.primary', { onclick: () => { if (ch.gold < price) { G.ui.error(L('Yeterli altın yok|Not enough gold')); return; } ch.gold -= price; ch.bagUpgrades = n + 1; ch.bag.length = bagSize(ch); Audio.sfx('buy'); emit('bagChanged'); } }, t('buy'))));
        }
      }
      if (st.rod && !ch.hasRod) list.append(h('div.card.row', h('img.ico.l', { src: iconURL('fishing_rod', { size: 64, ...ICON_THEMES.ui }) }), h('div', { style: { flex: 1, fontWeight: 800 } }, L('Balıkçı Oltası|Fishing Rod')), h('button.btn.small.primary', { onclick: () => { ch.hasRod = true; G.prof?.unlock('fishing'); Audio.sfx('buy'); UI.refresh('vendor'); } }, t('free'))));
    } else {
      const bb = G.buyback || [];
      if (!bb.length) list.append(h('div.muted', L('Geri alınacak eşya yok.|Nothing to buy back.')));
      for (const it of bb) {
        const price = it.id ? (ITEMS[it.id].value || 1) * (it.qty || 1) : it.value;
        row(it, price, () => { if (ch.gold < price) return; if (addItem(ch, it)) { ch.gold -= price; bb.splice(bb.indexOf(it), 1); emit('goldGained', 0); UI.refresh('vendor'); } });
      }
    }
    w.body.append(list);
  },
});

// ------------------------------------------------------------ bank (account-wide stash)
UI.register('bank', {
  title: () => L('Ortak Depo|Shared Stash'), icon: 'chest_box', w: 420, side: 'left', listen: ['bagChanged'],
  build(w) {
    const acc = G.account, ch = G.char;
    acc.stash = acc.stash || []; acc.stash.length = Math.max(48, acc.stash.length);
    w.body.append(h('div.muted', { style: { fontSize: '12px', marginBottom: '8px' } }, L('Depodaki eşyalar tüm karakterlerin tarafından paylaşılır. Almak için eşyaya dokun.|Items in the stash are shared by all your characters. Tap an item to withdraw it.')));
    const grid = h('div.grid', { style: { gridTemplateColumns: 'repeat(auto-fill, minmax(48px, 1fr))' } });
    acc.stash.forEach((it, i) => grid.append(slotEl(it, { onClick: x => { if (!x) return; if (addItem(ch, x)) { acc.stash[i] = null; emit('bagChanged'); } } })));
    w.body.append(grid);
  },
});
G.bank = {
  deposit(it) {
    const acc = G.account, ch = G.char;
    acc.stash = acc.stash || []; acc.stash.length = Math.max(48, acc.stash.length);
    const i = acc.stash.findIndex(x => !x); if (i < 0) { G.ui.error(L('Depo dolu|Stash is full')); return; }
    const bi = ch.bag.indexOf(it); if (bi < 0) return;
    ch.bag[bi] = null; acc.stash[i] = it; emit('bagChanged');
  },
};

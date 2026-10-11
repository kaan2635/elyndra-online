// Market (auction house): listings from other adventurers with living prices; the player can buy and sell.
import { G, emit, on } from '../core/state.js';
import { L, t } from '../core/i18n.js';
import { rand, randi, choice, chance, fmtGold, fmtTime, clamp, uid } from '../core/util.js';
import { S, randomName } from '../data/classes.js';
import { ITEMS, RARITY_COL } from '../data/items.js';
import { genEquip, makeStack, addItem, itemName, sellValue, countItem, canEquip } from './items.js';
import { h, UI } from '../ui/ui.js';
import { slotEl, itemTip } from '../ui/windows.js';
import { Audio } from '../audio.js';

const MATS = ['ore1', 'ore2', 'ore3', 'ore4', 'ore5', 'ore6', 'herb1', 'herb2', 'herb3', 'herb4', 'herb5', 'herb6', 'wood1', 'wood2', 'wood3', 'wood4', 'wood5', 'wood6', 'leather1', 'leather2', 'leather3', 'leather4', 'leather5', 'cloth1', 'cloth2', 'cloth3', 'cloth4', 'cloth5', 'essence', 'essence_g', 'enhance_stone', 'lucky_charm', 'gem1', 'gem2', 'gem3', 'gem4', 'gem5', 'silk', 'ember', 'frost_shard', 'void_dust', 'fish1', 'fish2', 'fish3', 'fish4', 'fish5', 'fish6', 'hp2', 'hp3', 'hp4', 'mp2', 'mp3', 'mp4', 'food2', 'food3', 'food4', 'elixir_power', 'elixir_fort', 'elixir_wisdom'];
export const fairPrice = it => it.id ? (ITEMS[it.id].value || 1) * 3 * (it.qty || 1) : Math.round(sellValue(it) * (it.rarity === 'epic' ? 5 : it.rarity === 'legendary' ? 6 : 3.5) * (1 + (it.plus || 0) * 0.15));

export const Market = {
  get st() { const a = G.account; a.market = a.market || { listings: [], mine: [], earned: 0, gen: 0, history: [] }; return a.market; },
  refresh(force) {
    const st = this.st, now = Date.now();
    if (!force && now - st.gen < 10 * 60 * 1000 && st.listings.length) return;
    st.gen = now;
    const lvl = G.char?.level || 1;
    const out = [];
    // materials & consumables
    for (let i = 0; i < 28; i++) {
      const id = choice(MATS); const T = ITEMS[id];
      const qty = T.stack > 1 ? randi(1, Math.min(20, T.stack)) : 1;
      const it = makeStack(id, qty);
      out.push({ id: uid('m'), item: it, price: Math.max(1, Math.round(fairPrice(it) * rand(0.7, 1.5))), seller: randomName(), t: now - randi(0, 36e5 * 20) });
    }
    // gear around the player's level
    for (let i = 0; i < 26; i++) {
      const il = clamp(lvl + randi(-6, 4), 1, 65);
      const it = genEquip({ ilvl: il, rarity: chance(0.12) ? 'epic' : chance(0.5) ? 'rare' : 'uncommon', cls: chance(0.5) ? G.char?.cls : undefined });
      if (chance(0.15)) { it.plus = randi(1, 6); }
      out.push({ id: uid('m'), item: it, price: Math.round(fairPrice(it) * rand(0.8, 1.6)), seller: randomName(), t: now - randi(0, 36e5 * 20) });
    }
    st.listings = out;
  },
  // simulate buyers for the player's listings (also catches up after being offline)
  simulate() {
    const st = this.st, now = Date.now();
    for (const l of [...st.mine]) {
      const fair = fairPrice(l.item);
      const ratio = l.price / Math.max(1, fair);
      const hours = (now - (l.checked || l.t)) / 36e5;
      l.checked = now;
      const pPerHour = ratio <= 0.8 ? 0.9 : ratio <= 1.0 ? 0.55 : ratio <= 1.3 ? 0.28 : ratio <= 1.8 ? 0.1 : 0.02;
      const p = 1 - Math.pow(1 - pPerHour, hours * 6);
      if (Math.random() < p) {
        st.mine.splice(st.mine.indexOf(l), 1);
        const net = Math.round(l.price * 0.95);
        st.earned += net;
        st.history.unshift({ name: itemName(l.item), price: l.price, t: now }); st.history.length = Math.min(30, st.history.length);
        G.chat?.system(L(`Pazar: ${itemName(l.item)} ${fmtGold(l.price)} altına satıldı! Kazancını Pazar\'dan topla.|Market: ${itemName(l.item)} sold for ${fmtGold(l.price)} gold! Collect your earnings at the Market.`), 'system');
        Audio.sfx('coin', { vol: 0.5 });
        emit('marketSold', l);
      } else if (now - l.t > 48 * 36e5) {
        // expired: return to the player
        st.mine.splice(st.mine.indexOf(l), 1);
        st.returned = st.returned || []; st.returned.push(l.item);
      }
    }
  },
  buy(l) {
    const ch = G.char;
    if (ch.gold < l.price) { G.ui.error(L('Yeterli altın yok|Not enough gold')); return; }
    if (!addItem(ch, l.item)) return;
    ch.gold -= l.price;
    this.st.listings = this.st.listings.filter(x => x !== l);
    Audio.sfx('buy');
    emit('goldGained', 0); emit('marketChanged');
  },
  list(item, price) {
    const ch = G.char;
    const i = ch.bag.indexOf(item); if (i < 0) return;
    const fee = Math.max(1, Math.round(price * 0.02));
    if (ch.gold < fee) { G.ui.error(L('Listeleme ücreti için altın yok|Not enough gold for the listing fee')); return; }
    ch.gold -= fee; ch.bag[i] = null;
    this.st.mine.push({ id: uid('m'), item, price, t: Date.now(), checked: Date.now() });
    Audio.sfx('sell');
    emit('bagChanged'); emit('marketChanged');
  },
  listDialog(item) {
    const fair = fairPrice(item);
    UI.modal((box, close) => {
      const inp = h('input.txt-in', { type: 'number', min: 1, value: fair });
      inp.addEventListener('keydown', e => e.stopPropagation());
      box.append(h('h3', L('Pazarda Sat|List on Market')), h('div.row', slotEl(item), h('div', itemName(item))),
        h('div.muted', { style: { fontSize: '12px' } }, L(`Önerilen fiyat: ${fmtGold(fair)} · Listeleme ücreti %2 · Satış komisyonu %5. Ucuz fiyatlar daha hızlı satar.|Suggested price: ${fmtGold(fair)} · Listing fee 2% · Sales commission 5%. Lower prices sell faster.`)),
        inp, h('div.row', h('button.btn.ghost', { onclick: close }, t('cancel')), h('button.btn.primary', { onclick: () => { const p = Math.max(1, Math.round(+inp.value || fair)); this.list(item, p); close(); } }, L('Listele|List'))));
    });
  },
};
G.market = Market;
G.addSystem(dt => { Market._t = (Market._t || 0) - dt; if (Market._t <= 0) { Market._t = 45; if (G.char) Market.simulate(); } });
on('sessionStart', () => { Market.simulate(); });

UI.register('market', {
  title: () => t('menuMarket'), icon: 'scales', w: 640, listen: ['marketChanged', 'goldGained'],
  build(w) {
    const M = Market, st = M.st, ch = G.char;
    M.refresh();
    w.tab = w.tab || 'browse';
    UI.setTabs(w, [['browse', L('Göz At|Browse')], ['mine', L('İlanlarım|My Listings') + ` (${st.mine.length})`], ['history', L('Geçmiş|History')]], w.tab, k => { w.tab = k; UI.refresh('market'); });
    const top = h('div.row.wrap', { style: { marginBottom: '8px' } }, h('span.muted', t('gold') + ':'), h('span.gold', fmtGold(ch.gold)), h('span.spacer'));
    if (st.earned > 0) top.append(h('button.btn.small.green', { onclick: () => { ch.gold += st.earned; G.ui.toast('coins', '+' + fmtGold(st.earned) + ' ' + L('altın|gold'), '#ffd660'); st.earned = 0; Audio.sfx('coin'); UI.refresh('market'); } }, L('Kazancı Topla: |Collect: ') + fmtGold(st.earned)));
    if (st.returned?.length) top.append(h('button.btn.small', { onclick: () => { for (const it of [...st.returned]) if (addItem(ch, it)) st.returned.splice(st.returned.indexOf(it), 1); UI.refresh('market'); } }, L('Süresi dolanları al|Take expired') + ` (${st.returned.length})`));
    w.body.append(top);
    if (w.tab === 'browse') {
      w.filter = w.filter || 'all';
      const f = h('div.row.wrap', { style: { gap: '4px', marginBottom: '8px' } }, ...[['all', t('all')], ['gear', L('Ekipman|Gear')], ['mat', L('Malzeme|Materials')], ['use', L('Tüketilebilir|Consumables')], ['mine', L('Sınıfıma uygun|For my class')]].map(([k, l]) => h('button.btn.small' + (w.filter === k ? '.primary' : '.ghost'), { onclick: () => { w.filter = k; UI.refresh('market'); } }, l)));
      w.body.append(f);
      let list = st.listings;
      if (w.filter === 'gear') list = list.filter(l => !l.item.id);
      if (w.filter === 'mat') list = list.filter(l => l.item.id && ITEMS[l.item.id].type === 'material');
      if (w.filter === 'use') list = list.filter(l => l.item.id && ITEMS[l.item.id].type === 'consumable');
      if (w.filter === 'mine') list = list.filter(l => !l.item.id && !canEquip(G.player, { ...l.item, reqLevel: 1 }));
      const box = h('div.list');
      for (const l of list.slice(0, 60)) {
        const it = l.item;
        box.append(h('div.card.row', slotEl(it), h('div', { style: { flex: 1, minWidth: 0 } },
          h('div', { style: { fontWeight: 800, color: it.id ? '#fff' : RARITY_COL[it.rarity], whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } }, itemName(it) + (it.qty > 1 ? ' x' + it.qty : '')),
          h('div.muted', { style: { fontSize: '11px' } }, (it.id ? '' : t('st_ilvl') + ' ' + it.ilvl + ' · ') + L('Satıcı: |Seller: ') + l.seller)),
          h('div.gold', { style: { marginRight: '6px' } }, fmtGold(l.price)), h('button.btn.small' + (ch.gold >= l.price ? '.primary' : '.disabled'), { onclick: () => M.buy(l) }, t('buy'))));
      }
      w.body.append(box, h('div.row', { style: { marginTop: '8px' } }, h('span.muted', { style: { fontSize: '11px' } }, L('İlanlar her 10 dakikada yenilenir.|Listings refresh every 10 minutes.')), h('span.spacer'), h('button.btn.small.ghost', { onclick: () => { M.refresh(true); UI.refresh('market'); } }, L('Yenile|Refresh'))));
    } else if (w.tab === 'mine') {
      w.body.append(h('div.muted', { style: { fontSize: '12px', marginBottom: '8px' } }, L('Satmak için çantandaki bir eşyaya dokun ve "Pazarda Sat"ı seç. İlanlar 48 saat açık kalır; oyunda olmasan da satış devam eder.|To sell, tap an item in your bag and choose "List on Market". Listings last 48 hours and keep selling while you are offline.')));
      UI.open('bag');
      for (const l of st.mine) w.body.append(h('div.card.row', slotEl(l.item), h('div', { style: { flex: 1 } }, itemName(l.item), h('div.muted', { style: { fontSize: '11px' } }, fmtTime(48 * 3600 - (Date.now() - l.t) / 1000) + L(' kaldı| left'))), h('div.gold', fmtGold(l.price)),
        h('button.btn.small.ghost', { onclick: () => { if (addItem(ch, l.item)) { st.mine.splice(st.mine.indexOf(l), 1); UI.refresh('market'); } } }, L('Geri Çek|Cancel'))));
      if (!st.mine.length) w.body.append(h('div.muted', L('Aktif ilanın yok.|No active listings.')));
    } else {
      for (const hs of st.history) w.body.append(h('div.card.row', h('div', { style: { flex: 1 } }, hs.name), h('div.gold', '+' + fmtGold(Math.round(hs.price * 0.95))), h('div.muted', { style: { fontSize: '11px' } }, new Date(hs.t).toLocaleString())));
      if (!st.history.length) w.body.append(h('div.muted', L('Henüz satış yok.|No sales yet.')));
    }
  },
});

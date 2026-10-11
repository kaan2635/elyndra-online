// "Evim" (My Home): a real-time garden and timed expeditions that progress while offline.
import { G, emit, on } from '../core/state.js';
import { L, t } from '../core/i18n.js';
import { randi, choice, chance, fmtTime, clamp } from '../core/util.js';
import { S, randomName, CLASS_IDS, CLASSES } from '../data/classes.js';
import { ITEMS } from '../data/items.js';
import { makeStack, removeItem, countItem, genEquip } from './items.js';
import { h, UI } from '../ui/ui.js';
import { iconURL, ICON_THEMES } from '../gfx/icons.js';
import { Audio } from '../audio.js';

const SEEDS = ['herb1', 'herb2', 'herb3', 'herb4', 'herb5', 'herb6'];
const GROW = { herb1: 20, herb2: 35, herb3: 50, herb4: 70, herb5: 90, herb6: 120 }; // minutes
const MISSIONS = [
  { id: 'scout', hours: 1, name: 'Keşif Turu|Scouting Run', desc: 'Kısa bir devriye. Az ama hızlı ganimet.|A short patrol. Small but quick spoils.', mult: 1 },
  { id: 'hunt', hours: 4, name: 'Canavar Avı|Monster Hunt', desc: 'Yoldaşların uzak topraklarda avlanır.|Your companions hunt in distant lands.', mult: 3.2 },
  { id: 'delve', hours: 8, name: 'Derin Sefer|Deep Expedition', desc: 'Uzun ve tehlikeli; nadir ekipman şansı.|Long and dangerous; a chance at rare gear.', mult: 6, gear: true },
];

export const Home = {
  get st() {
    const a = G.account; a.home = a.home || { plots: Array.from({ length: 6 }, () => null), exp: [], crew: null };
    if (!a.home.crew) a.home.crew = Array.from({ length: 3 }, () => ({ name: randomName(), cls: choice(CLASS_IDS), busy: false }));
    return a.home;
  },
  plant(i, seed) {
    const st = this.st;
    if (st.plots[i]) return;
    if (countItem(G.char, seed) < 2) { G.ui.error(L('2 tohum (aynı bitkiden) gerekli|Requires 2 of that herb as seeds')); return; }
    removeItem(G.char, seed, 2);
    st.plots[i] = { seed, t: Date.now(), dur: GROW[seed] * 60 * 1000 };
    Audio.sfx('herb'); emit('homeChanged');
  },
  harvest(i) {
    const st = this.st, p = st.plots[i]; if (!p) return;
    if (Date.now() - p.t < p.dur) return;
    st.plots[i] = null;
    G.progress.giveItem(makeStack(p.seed, randi(4, 7)));
    if (chance(0.25)) G.progress.giveItem(makeStack('essence', randi(1, 3)));
    if (chance(0.08)) G.progress.giveItem(makeStack('elixir_wisdom', 1));
    G.prof?.addXp('herbalism', 6);
    Audio.sfx('loot'); emit('homeChanged');
  },
  send(mi, crewIdx) {
    const st = this.st, m = MISSIONS[mi], c = st.crew[crewIdx];
    if (!c || c.busy) return;
    if (st.exp.length >= 3) { G.ui.error(L('Aynı anda en fazla 3 sefer|At most 3 expeditions at once')); return; }
    c.busy = true;
    st.exp.push({ mission: m.id, crew: crewIdx, t: Date.now(), dur: m.hours * 3600 * 1000, lvl: G.char.level });
    Audio.sfx('mount'); emit('homeChanged');
  },
  collect(e) {
    const st = this.st;
    if (Date.now() - e.t < e.dur) return;
    st.exp.splice(st.exp.indexOf(e), 1);
    st.crew[e.crew].busy = false;
    const m = MISSIONS.find(x => x.id === e.mission);
    const lvl = e.lvl, tier = clamp(Math.floor((lvl - 1) / 10) + 1, 1, 6);
    G.char.gold += Math.round(6 * S(lvl) * m.mult);
    const mats = ['ore' + tier, 'herb' + tier, 'wood' + tier, 'leather' + Math.min(5, tier), 'cloth' + Math.min(5, tier)];
    for (let i = 0; i < Math.ceil(m.mult); i++) G.progress.giveItem(makeStack(choice(mats), randi(2, 4)));
    G.progress.giveItem(makeStack('essence', randi(2, 4) * Math.ceil(m.mult / 2)));
    if (m.gear || chance(0.15 * m.mult)) G.progress.giveItem(genEquip({ ilvl: lvl, cls: G.char.cls, rarity: chance(0.2) ? 'epic' : 'rare' }));
    if (chance(0.1 * m.mult)) G.progress.giveItem(makeStack('enhance_stone', randi(1, 3)));
    Audio.sfx('quest_complete'); emit('homeChanged');
  },
  readyCount() {
    const st = this.st, now = Date.now();
    return st.plots.filter(p => p && now - p.t >= p.dur).length + st.exp.filter(e => now - e.t >= e.dur).length;
  },
};
G.home = Home;
on('sessionStart', () => { const n = Home.readyCount(); if (n) setTimeout(() => G.ui.toast('house', L(`Evinde toplanmayı bekleyen ${n} şey var!|${n} things are ready at your home!`), '#8affb0'), 4000); });
G.addSystem(dt => { Home._t = (Home._t || 0) - dt; if (Home._t <= 0) { Home._t = 1; if (UI.isOpen('home')) UI.refresh('home'); } });

UI.register('home', {
  title: () => L('Evim|My Home'), icon: 'house', w: 560, listen: ['homeChanged', 'bagChanged'],
  build(w) {
    const st = Home.st, now = Date.now();
    w.tab = w.tab || 'garden';
    UI.setTabs(w, [['garden', L('Bahçe|Garden')], ['exp', L('Seferler|Expeditions')]], w.tab, k => { w.tab = k; UI.refresh('home'); });
    if (w.tab === 'garden') {
      w.body.append(h('div.muted', { style: { fontSize: '12.5px', marginBottom: '8px' } }, L('İki şifalı ot tohum olarak ekilir, gerçek zamanda büyür ve 4-7 ot olarak hasat edilir. Oyunda olmasan da büyümeye devam eder.|Plant two herbs as seeds; they grow in real time and are harvested as 4-7 herbs. They keep growing while you are offline.')));
      const grid = h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '8px' } });
      st.plots.forEach((p, i) => {
        if (!p) {
          const opts = SEEDS.filter(s => countItem(G.char, s) >= 2);
          grid.append(h('div.card', h('div', { style: { fontWeight: 800 } }, L('Boş Tarla|Empty Plot')),
            opts.length ? h('div.row.wrap', { style: { gap: '4px', marginTop: '6px' } }, ...opts.map(s => h('button.btn.small', { onclick: () => Home.plant(i, s) }, h('img', { src: iconURL(ITEMS[s].icon, { size: 32, fill: ITEMS[s].fill }), style: { width: '18px' } }), L(ITEMS[s].name).split(' ')[0])))
              : h('div.muted', { style: { fontSize: '11.5px', marginTop: '6px' } }, L('Ekmek için 2 şifalı ot gerekir.|You need 2 herbs to plant.'))));
        } else {
          const left = (p.dur - (now - p.t)) / 1000, ready = left <= 0;
          grid.append(h('div.card', { style: { borderColor: ready ? 'var(--good)' : '' } }, h('div.row', h('img.ico', { src: iconURL(ITEMS[p.seed].icon, { size: 48, fill: ITEMS[p.seed].fill }) }), h('div', h('div', { style: { fontWeight: 800 } }, L(ITEMS[p.seed].name)), h('div.muted', { style: { fontSize: '11.5px' } }, ready ? L('Hasada hazır!|Ready to harvest!') : fmtTime(left)))),
            h('div.progress', { style: { margin: '6px 0' } }, h('i', { style: { width: clamp((now - p.t) / p.dur * 100, 0, 100) + '%' } })),
            h('button.btn.small' + (ready ? '.primary' : '.disabled'), { onclick: () => Home.harvest(i) }, L('Hasat Et|Harvest'))));
        }
      });
      w.body.append(grid);
    } else {
      w.body.append(h('div.muted', { style: { fontSize: '12.5px', marginBottom: '8px' } }, L('Ekibini seferlere gönder; döndüklerinde malzeme, altın ve bazen ekipman getirirler. Ödüller gönderdiğin andaki seviyene göre belirlenir.|Send your crew on expeditions; they return with materials, gold and sometimes gear. Rewards scale with your level when you sent them.')));
      for (const e of st.exp) {
        const m = MISSIONS.find(x => x.id === e.mission); const left = (e.dur - (now - e.t)) / 1000, ready = left <= 0;
        const c = st.crew[e.crew];
        w.body.append(h('div.card.row', { style: { marginBottom: '6px', borderColor: ready ? 'var(--good)' : '' } }, h('img.ico', { src: iconURL(CLASSES[c.cls].icon, { size: 48, ...ICON_THEMES.ui }) }),
          h('div', { style: { flex: 1 } }, h('div', { style: { fontWeight: 800 } }, L(m.name) + ' — ' + c.name), h('div.progress', { style: { marginTop: '4px' } }, h('i', { style: { width: clamp((now - e.t) / e.dur * 100, 0, 100) + '%' } })), h('div.muted', { style: { fontSize: '11.5px' } }, ready ? L('Döndüler!|They\'re back!') : fmtTime(left))),
          h('button.btn.small' + (ready ? '.primary' : '.disabled'), { onclick: () => Home.collect(e) }, L('Ganimeti Al|Collect'))));
      }
      w.body.append(h('div.title', { style: { fontSize: '14px', margin: '10px 0 6px' } }, L('Yeni Sefer|New Expedition')));
      const free = st.crew.map((c, i) => [c, i]).filter(([c]) => !c.busy);
      MISSIONS.forEach((m, mi) => w.body.append(h('div.card', { style: { marginBottom: '6px' } }, h('div', { style: { fontWeight: 800 } }, L(m.name) + ` (${m.hours} ${L('saat|h')})`), h('div.muted', { style: { fontSize: '12px' } }, L(m.desc)),
        h('div.row.wrap', { style: { gap: '4px', marginTop: '6px' } }, ...(free.length ? free.map(([c, i]) => h('button.btn.small', { onclick: () => Home.send(mi, i) }, L('Gönder: |Send: ') + c.name)) : [h('span.muted', L('Tüm ekip seferde.|The whole crew is away.'))])))));
    }
  },
});

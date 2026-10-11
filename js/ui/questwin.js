// Quest log window.
import { G, emit } from '../core/state.js';
import { L, t } from '../core/i18n.js';
import { fmtGold, fmtNum } from '../core/util.js';
import { h, UI, uiIcon } from './ui.js';
import { QUESTS } from '../data/quests.js';
import { ZONES } from '../data/zones.js';
import { NPCS } from '../data/npcs.js';
import { itemName } from '../game/items.js';
import { slotEl } from './windows.js';

UI.register('quests', {
  title: () => t('menuQuests'), icon: 'quest_exclaim', w: 620, listen: ['questsChanged'],
  build(w, focusId) {
    const Q = G.quests, ch = G.char;
    w.tab = w.tab || 'active';
    UI.setTabs(w, [['active', L('Aktif|Active') + ` (${Object.keys(ch.quests.active).length})`], ['avail', L('Bilinen|Available')], ['done', L('Tamamlanan|Completed')]], w.tab, k => { w.tab = k; UI.refresh('quests'); });
    const wrap = h('div', { style: { display: 'grid', gridTemplateColumns: UI.touch && innerWidth < 700 ? '1fr' : '230px 1fr', gap: '12px' } });
    const list = h('div.list');
    let ids = [];
    if (w.tab === 'active') ids = Q.trackedList().map(q => q.id);
    else if (w.tab === 'avail') ids = Object.values(QUESTS).filter(q => Q.canAccept(q) && q.zone === G.zones.current?.id).map(q => q.id);
    else ids = Object.keys(ch.quests.done).filter(id => QUESTS[id]).reverse();
    const sel = w.sel && ids.includes(w.sel) ? w.sel : (focusId && ids.includes(focusId) ? focusId : ids[0]);
    w.sel = sel;
    if (!ids.length) list.append(h('div.muted', w.tab === 'active' ? L('Aktif görevin yok. Başlarında "!" olan karakterlerle konuş.|No active quests. Talk to characters with a "!" above them.') : L('Liste boş.|Nothing here.')));
    for (const id of ids) {
      const q = QUESTS[id];
      const done = w.tab === 'active' && Q.isComplete(id);
      list.append(h('div.card.click' + (id === sel ? '.sel' : ''), { onclick: () => { w.sel = id; UI.refresh('quests'); } },
        h('div', { style: { fontWeight: 800, fontSize: '13px', color: done ? 'var(--good)' : q.main ? '#ffd24a' : 'var(--ink)' } }, (q.main ? '★ ' : '') + L(q.name)),
        h('div.muted', { style: { fontSize: '11px' } }, L(ZONES[q.zone]?.name || '') + ' · ' + t('lv') + ' ' + q.lvl + (q.repeat ? ' · ' + L('Günlük|Daily') : ''))));
    }
    const det = h('div');
    if (sel) {
      const q = QUESTS[sel];
      det.append(h('div.title', { style: { fontSize: '18px' } }, L(q.name)));
      det.append(h('div.muted', { style: { fontSize: '12px', marginBottom: '8px' } }, L('Veren: |Giver: ') + L(NPCS[q.giver]?.name || '') + ' · ' + L('Teslim: |Turn in: ') + L(NPCS[q.turnin || q.giver]?.name || '')));
      det.append(h('div.qtext', { style: { lineHeight: '1.5', fontSize: '13.5px' } }, L(w.tab === 'done' ? (q.done || q.text) : q.text)));
      if (w.tab !== 'done') {
        det.append(h('div.title', { style: { fontSize: '13px', marginTop: '10px' } }, L('Hedefler|Objectives')));
        det.append(h('ul.obj-list', ...q.obj.map((o, i) => { const n = Q.objCount(q, i); return h('li', { style: { color: n >= (o.n || 1) ? 'var(--good)' : '' } }, `${Q.objText(o)}: ${n}/${o.n || 1}`); })));
        const rw = Q.rewardsFor(q);
        det.append(h('div.title', { style: { fontSize: '13px', marginTop: '10px' } }, L('Ödüller|Rewards')),
          h('div.row.wrap', rw.xp ? h('span.chip', { style: { color: '#c8a0ff' } }, '+' + fmtNum(rw.xp) + ' ' + t('xp')) : null, rw.gold ? h('span.chip.gold', '+' + fmtGold(rw.gold)) : null, ...rw.items.map(it => slotEl(it)), ...rw.choice.map(it => slotEl(it))));
        if (w.tab === 'active') {
          const tracked = ch.quests.tracked.includes(sel);
          det.append(h('div.row.wrap', { style: { marginTop: '12px' } },
            h('button.btn.primary', { onclick: () => { UI.close('quests'); Q.autoPath(sel); } }, L('Hedefe Git|Go to Objective')),
            h('button.btn', { onclick: () => { ch.quests.tracked = tracked ? ch.quests.tracked.filter(x => x !== sel) : [sel, ...ch.quests.tracked]; emit('questsChanged'); } }, tracked ? L('Takibi Bırak|Untrack') : L('Takip Et|Track')),
            q.main ? null : h('button.btn.red.small', { onclick: () => UI.confirm(L('Görevden vazgeçilsin mi? İlerleme kaybolur.|Abandon the quest? Progress will be lost.'), () => Q.abandon(sel), { danger: true }) }, L('Vazgeç|Abandon'))));
        }
      }
    }
    wrap.append(list, det);
    w.body.append(wrap);
  },
});

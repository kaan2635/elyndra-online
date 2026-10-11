// Bounty boards in every town: up to 3 open bounties per zone. They never expire (no FOMO);
// a fresh bounty replaces a claimed one after a short rest.
import { G, emit, on } from '../core/state.js';
import { L, t } from '../core/i18n.js';
import { choice, randi, uid, fmtTime } from '../core/util.js';
import { S, xpNeed } from '../data/classes.js';
import { MONSTERS } from '../data/monsters.js';
import { ITEMS } from '../data/items.js';
import { makeStack } from './items.js';
import { h, UI } from '../ui/ui.js';
import { iconURL, ICON_THEMES } from '../gfx/icons.js';
import { Audio } from '../audio.js';

export const Bounties = {
  get list() { const ch = G.char; ch.bounties = ch.bounties || {}; return ch.bounties; },
  forZone(zid) {
    const all = this.list; all[zid] = all[zid] || [];
    const z = G.zones.current;
    const now = Date.now();
    while (all[zid].length < 3 && (!all[zid]._next || now > all[zid]._next)) {
      const b = this.make(z); if (!b) break;
      all[zid].push(b);
    }
    return all[zid];
  },
  make(z) {
    const mons = [...new Set((z.spawns || []).flatMap(s => Array.isArray(s.m) ? s.m : [s.m]).filter(m => MONSTERS[m] && !MONSTERS[m].boss))];
    const rares = mons.filter(m => MONSTERS[m].rare);
    const normal = mons.filter(m => !MONSTERS[m].rare && !MONSTERS[m].elite);
    const nodes = (z.nodes || []).map(n => n.type);
    const r = Math.random();
    if (r < 0.55 && normal.length) { const m = choice(normal); return { id: uid('b'), kind: 'kill', m, n: randi(10, 18), p: 0, name: L('Avla: |Hunt: ') + L(MONSTERS[m].name) }; }
    if (r < 0.8 && nodes.length) { const nd = choice(nodes); return { id: uid('b'), kind: 'gather', node: nd, n: randi(6, 10), p: 0, name: L('Topla: |Gather: ') + L(ITEMS[nd].name) }; }
    if (rares.length) { const m = choice(rares); return { id: uid('b'), kind: 'kill', m, n: 1, p: 0, elite: true, name: L('Ödül Avı: |Wanted: ') + L(MONSTERS[m].name) }; }
    if (normal.length) { const m = choice(normal); return { id: uid('b'), kind: 'kill', m, n: 12, p: 0, name: L('Avla: |Hunt: ') + L(MONSTERS[m].name) }; }
    return null;
  },
  bump(pred) {
    const all = this.list; let ch = false;
    for (const zid in all) for (const b of all[zid]) if (b.p < b.n && pred(b)) { b.p++; ch = true; if (b.p >= b.n) G.ui.toast('scroll', L('Ödül avı tamamlandı: |Bounty complete: ') + b.name, '#8affb0'); }
    if (ch) emit('bountiesChanged');
  },
  claim(zid, b) {
    const all = this.list[zid]; if (!all || b.p < b.n) return;
    all.splice(all.indexOf(b), 1);
    all._next = Date.now() + 5 * 60 * 1000;
    const p = G.player;
    G.progress.giveXp(Math.round(xpNeed(Math.min(p.level, 59)) * (b.elite ? 0.12 : 0.08)), null);
    G.char.gold += Math.round(S(p.level) * (b.elite ? 16 : 8));
    G.progress.giveItem(makeStack('chest_daily', 1));
    G.progress.giveItem(makeStack('token_honor', b.elite ? 8 : 4));
    Audio.sfx('quest_complete');
    emit('bountiesChanged'); emit('questCompleted', 'bounty');
  },
};
G.bounties = Bounties;
on('killed', u => Bounties.bump(b => b.kind === 'kill' && b.m === u.tplId));
on('gathered', type => Bounties.bump(b => b.kind === 'gather' && b.node === type));
// make every town's notice board interactable
on('zonePopulated', def => {
  for (const tw of def.towns || []) {
    const a = G.world.anchors[tw.id + '.board']; if (!a) continue;
    G.world.interactables.push({ kind: 'board', x: a[0], z: a[1], r: 3.2, h: 2, label: L('İlan Panosu|Bounty Board'), verb: L('Oku|Read'), icon: 'scroll', action: () => UI.open('bounties') });
  }
});

UI.register('bounties', {
  title: () => L('İlan Panosu|Bounty Board'), icon: 'scroll', w: 460, listen: ['bountiesChanged'],
  build(w) {
    const z = G.zones.current; if (!z || z.dungeonLayout) return;
    const list = Bounties.forZone(z.id);
    w.body.append(h('div.muted', { style: { fontSize: '12.5px', marginBottom: '8px' } }, L('Ödül avları süresiz açık kalır; dilediğin zaman tamamla. Teslim edilen her ilanın yerine kısa süre sonra yenisi asılır.|Bounties never expire; finish them whenever you like. A new notice is posted shortly after each one you claim.')));
    for (const b of list) {
      const done = b.p >= b.n;
      w.body.append(h('div.card.row', { style: { marginBottom: '6px', borderColor: done ? 'var(--good)' : '' } },
        h('img.ico.l', { src: iconURL(b.kind === 'gather' ? 'pickaxe' : b.elite ? 'skull_crown' : 'sword_cross', { size: 64, ...(b.elite ? ICON_THEMES.blood : ICON_THEMES.ui) }) }),
        h('div', { style: { flex: 1 } }, h('div', { style: { fontWeight: 800 } }, b.name), h('div.muted', { style: { fontSize: '12px' } }, `${b.p}/${b.n}`), h('div.progress', { style: { marginTop: '4px' } }, h('i', { style: { width: (b.p / b.n * 100) + '%' } }))),
        h('button.btn.small' + (done ? '.primary' : '.disabled'), { onclick: () => Bounties.claim(z.id, b) }, L('Ödülü Al|Claim'))));
    }
    const nx = Bounties.list[z.id]?._next;
    if (list.length < 3 && nx) w.body.append(h('div.muted', { style: { fontSize: '12px' } }, L('Yeni ilan: |Next notice: ') + fmtTime((nx - Date.now()) / 1000)));
  },
});

// Waystones (fast travel), portals between zones, hearth / return home.
import { G, emit } from '../core/state.js';
import { L, t } from '../core/i18n.js';
import { S } from '../data/classes.js';
import { ZONES, ZONE_ORDER } from '../data/zones.js';
import { UI, h, icon, uiIcon } from '../ui/ui.js';
import { Audio } from '../audio.js';

export const Travel = {
  attuned(id) { return (G.char.waystones || []).includes(id); },
  useWaystone(w) {
    const ch = G.char;
    ch.waystones = ch.waystones || [];
    if (!ch.waystones.includes(w.id)) {
      ch.waystones.push(w.id);
      Audio.sfx('portal', { vol: 0.6 });
      G.vfx?.pillar({ x: w.x, z: w.z }, 0x6ad8ff, 1);
      G.ui.toast('portal', t('waystoneFound') + ': ' + L(w.name), '#8ae8ff');
      emit('waystoneAttuned', w.id);
    }
    this.openWaystones(w.id);
  },
  cost(zoneId) { return G.char.level < 10 ? 0 : Math.round(2 * S(G.char.level)); },
  openWaystones(fromId) {
    if (G.world.dungeon) { G.ui.error(L('Zindanda kullanılamaz|Not usable in a dungeon')); return; }
    UI.open('waystones', fromId);
  },
  teleport(zoneId, w) {
    const p = G.player, ch = G.char;
    if (p.inCombat) { G.ui.error(L('Savaştayken ışınlanamazsın|You cannot teleport in combat')); return; }
    const c = this.cost(zoneId);
    if (ch.gold < c) { G.ui.error(L('Yeterli altın yok|Not enough gold')); return; }
    ch.gold -= c;
    UI.close('waystones');
    const done = () => {
      const pos = { x: w.x + 2, z: w.z + 3 };
      if (G.zones.current.id === zoneId) {
        p.pos.x = pos.x; p.pos.z = pos.z; G.vfx?.burst(p.pos, 'arcane', { n: 30 });
        for (const s of p.summons) { s.pos.x = pos.x; s.pos.z = pos.z; }
        for (const m of G.party?.members() || []) { m.pos.x = pos.x + 1; m.pos.z = pos.z + 1; for (const s of m.summons) { s.pos.x = pos.x; s.pos.z = pos.z; } }
      } else G.zones.enter(zoneId, pos);
    };
    this.channel(L('Işınlanma|Teleport'), 2.5, done);
  },
  // generic self-cast with a cast bar (interrupted by moving)
  channel(name, dur, fn) {
    const p = G.player;
    p.cast = { sk: { id: 'tp', name, theme: 'arcane', run: () => fn() }, id: 'tp', t: 0, dur, target: p, ctx: {} };
    p.anim.cast = 'up';
    G.ui.castBar(p.cast);
    G.vfx?.castGlow(p, 'arcane');
    Audio.sfx('teleport', { vol: 0.6 });
  },
  usePortal(pt) {
    const p = G.player;
    if (p.inCombat) { G.ui.error(L('Savaştayken kullanılamaz|Not usable in combat')); return; }
    const z = ZONES[pt.to];
    if (!z) { G.ui.error(L('Bu diyar henüz keşfedilmedi.|This realm is not yet reachable.')); return; }
    const go = () => {
      Audio.sfx('portal');
      const back = (z.portals || []).find(x => x.to === G.zones.current.id);
      const pos = back ? { x: back.x + (back.ox ?? 0), z: back.z + (back.oz ?? (back.z < 0 ? 8 : -8)) } : z.start;
      G.zones.enter(pt.to, pos);
    };
    if (p.level < (pt.lvl || 1) - 1) UI.confirm(L(`${L(z.name)} bölgesi ${z.level[0]}-${z.level[1]}. seviyeler içindir. Yine de gitmek istiyor musun?|${L(z.name)} is meant for levels ${z.level[0]}-${z.level[1]}. Go anyway?`), go);
    else go();
  },
  goHome() {
    const ch = G.char, p = G.player;
    const bind = ch.bind || { zone: 'vale', x: 0, z: 96 };
    if (p.inCombat) { G.ui.error(L('Savaştayken kullanılamaz|Not usable in combat')); return; }
    if (G.world.dungeon) { G.dungeons?.leave(); return; }
    Audio.sfx('teleport');
    if (G.zones.current.id === bind.zone) { p.pos.x = bind.x; p.pos.z = bind.z; G.vfx?.burst(p.pos, 'arcane', { n: 30 }); }
    else G.zones.enter(bind.zone, { x: bind.x, z: bind.z });
  },
};
G.travel = Travel;

UI.register('waystones', {
  title: 'Işınlanma Taşları|Waystones', icon: 'portal', w: 440,
  build(w, fromId) {
    const ch = G.char;
    const b = w.body;
    b.append(h('div.muted', { style: { marginBottom: '8px' } }, L('Aktifleştirdiğin ışınlanma taşları arasında yolculuk edebilirsin.|Travel between the waystones you have attuned.')));
    const cost = Travel.cost();
    for (const zid of ZONE_ORDER) {
      const z = ZONES[zid]; if (!z) continue;
      const ws = (z.waystones || []).filter(x => (ch.waystones || []).includes(x.id));
      if (!ws.length) continue;
      b.append(h('div.title', { style: { margin: '8px 0 4px', fontSize: '14px' } }, L(z.name) + `  (${z.level[0]}-${z.level[1]})`));
      for (const x of ws) {
        const here = x.id === fromId;
        b.append(h('div.card.click.row', { onclick: () => !here && Travel.teleport(zid, x) }, icon('portal', { fill: ['#effcff', '#4fb2ef'], bg: ['#1c5a8c', '#05132a'] }, 'ico s'), h('div', { style: { flex: 1 } }, L(x.name)), here ? h('span.chip', L('Buradasın|You are here')) : h('span.gold', cost ? cost + ' ' + L('altın|g') : t('free'))));
      }
    }
    b.append(h('hr.sep'), h('div.row', h('button.btn', { onclick: () => { UI.close('waystones'); Travel.goHome(); } }, icon('house', {}, 'ico s'), L('Eve Dön|Return Home')), h('span.muted', L('Bağlı kasaba: |Bound town: ') + (ch.bind?.name ? L(ch.bind.name) : L('Aydınköy|Dawnhollow')))));
  },
});

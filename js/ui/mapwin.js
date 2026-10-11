// World map window: zone map with POIs, NPCs, waystones, quest targets; plus a realm overview.
import { G } from '../core/state.js';
import { L, t } from '../core/i18n.js';
import { clamp, fmtTime } from '../core/util.js';
import { h, UI } from './ui.js';
import { ZONES, ZONE_ORDER } from '../data/zones.js';
import { NPCS } from '../data/npcs.js';
import { findPath } from '../game/path.js';

UI.register('map', {
  title: () => t('menuMap'), icon: 'map', w: 700,
  build(w) {
    w.tab = w.tab || 'zone';
    UI.setTabs(w, [['zone', L(G.zones.current?.name || '')], ['realm', L('Diyarlar|Realms')]], w.tab, k => { w.tab = k; UI.refresh('map'); });
    if (w.tab === 'realm') return realm(w);
    const W = G.world, z = G.zones.current;
    const wrap = h('div.mapwrap');
    const cv = h('canvas', { width: 640, height: 640 });
    wrap.append(cv);
    w.body.append(wrap);
    w.body.append(h('div.muted', { style: { fontSize: '12px', textAlign: 'center', marginTop: '6px' } }, L('Haritaya dokunarak oraya otomatik yürü.|Tap the map to auto-walk there.') + (z?.worldBoss && !W.dungeon ? '  ·  ' + L('Dünya patronu: |World boss: ') + L(z.worldBoss.name) + ' ~' + fmtTime(Math.max(0, G.zones.timeToBoss())) : '')));
    const size = W.dungeon ? W.dungeon.size : W.terrain.size;
    const draw = () => {
      if (!UI.isOpen('map')) return;
      const c = cv.getContext('2d'), S = cv.width;
      c.clearRect(0, 0, S, S);
      const map = W.dungeon ? W.dungeon.mapCanvas : W.mapCanvas;
      if (map) { c.imageSmoothingEnabled = true; c.drawImage(map, 0, 0, S, S); }
      const k = S / size;
      const P = (x, zz) => [(x + size / 2) * k, (zz + size / 2) * k];
      c.textAlign = 'center'; c.textBaseline = 'middle';
      const label = (x, zz, txt, col = '#ffe8b8', sz = 13) => { const [mx, my] = P(x, zz); c.font = `800 ${sz}px "Nunito Sans", sans-serif`; c.lineWidth = 4; c.strokeStyle = 'rgba(0,0,0,.85)'; c.strokeText(txt, mx, my); c.fillStyle = col; c.fillText(txt, mx, my); };
      const dot = (x, zz, col, r = 5) => { const [mx, my] = P(x, zz); c.fillStyle = col; c.beginPath(); c.arc(mx, my, r, 0, Math.PI * 2); c.fill(); c.strokeStyle = '#000'; c.lineWidth = 1.5; c.stroke(); };
      if (!W.dungeon) {
        for (const p of z.pois || []) if (G.char.poiSeen?.includes(p.id) || p.town) label(p.x, p.z + (p.r || 10) * 0.2, L(p.name), p.town ? '#ffe08a' : p.dungeon ? '#ff9a6a' : '#e8e0d0', p.town ? 15 : 12);
        for (const ia of W.interactables) {
          if (ia.kind === 'waystone') { dot(ia.x, ia.z, G.travel.attuned(ia.id) ? '#6ad8ff' : '#3a6a7a', 6); }
          if (ia.kind === 'portal') { dot(ia.x, ia.z, '#b86aff', 8); label(ia.x, ia.z - 9, '→ ' + ia.label, '#d8b0ff', 12); }
          if (ia.kind === 'dungeon') { dot(ia.x, ia.z, '#ff6a3a', 8); }
          if (ia.kind === 'node' && !ia.hidden) dot(ia.x, ia.z, ia.col || '#c8a060', 2.5);
        }
        if (z.worldBoss) { const [mx, my] = P(z.worldBoss.x, z.worldBoss.z); c.font = '900 20px serif'; c.fillStyle = W.units.some(u => u.worldBoss && !u.dead) ? '#ff3a2a' : 'rgba(255,90,60,.45)'; c.fillText('☠', mx, my); }
      }
      for (const u of W.units) {
        if (u.kind === 'npc') { const mk = G.quests.npcMarker(u); if (mk) label(u.pos.x, u.pos.z, mk === '!b' ? '!' : mk[0], mk === '?g' ? '#aaa' : mk === '!b' ? '#4ab8ff' : '#ffd23a', 18); else dot(u.pos.x, u.pos.z, '#e8e0c0', 3); }
        else if ((u.kind === 'bot' || u.kind === 'remote') && !u.dead) dot(u.pos.x, u.pos.z, u.inParty ? '#5dd87a' : '#6ab4ff', 3.5);
        else if (u.kind === 'monster' && u.worldBoss && !u.dead) dot(u.pos.x, u.pos.z, '#ff2020', 9);
      }
      for (const m of G.quests.mapMarkers()) label(m.x, m.z, m.turnin ? '?' : '◆', m.turnin ? '#ffd23a' : '#ffb02a', 20);
      // route preview
      if (w.route) { c.strokeStyle = 'rgba(140,255,170,.8)'; c.lineWidth = 3; c.setLineDash([6, 6]); c.beginPath(); const p0 = P(G.player.pos.x, G.player.pos.z); c.moveTo(...p0); for (const p of w.route) c.lineTo(...P(p.x, p.z)); c.stroke(); c.setLineDash([]); }
      // player
      const u = G.player; const [px, py] = P(u.pos.x, u.pos.z);
      c.save(); c.translate(px, py); c.rotate(-u.yaw + Math.PI); c.fillStyle = '#fff'; c.strokeStyle = '#000'; c.lineWidth = 3;
      c.beginPath(); c.moveTo(0, -12); c.lineTo(8, 9); c.lineTo(0, 4); c.lineTo(-8, 9); c.closePath(); c.stroke(); c.fill(); c.restore();
      requestAnimationFrame(draw);
    };
    draw();
    cv.addEventListener('click', e => {
      const r = cv.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width * size - size / 2, zz = (e.clientY - r.top) / r.height * size - size / 2;
      const p = G.player;
      const pts = findPath(p.pos.x, p.pos.z, x, zz);
      w.route = pts;
      if (Math.hypot(x - p.pos.x, zz - p.pos.z) > 45) G.mounts?.autoMount();
      const step = i => { if (i >= pts.length) { w.route = null; return; } G.playerCtl.moveTarget = { x: pts[i].x, z: pts[i].z, stop: 1.5, then: () => step(i + 1) }; };
      step(0);
      if (UI.touch) setTimeout(() => UI.close('map'), 300);
    });
  },
});

function realm(w) {
  const grid = h('div.list');
  ZONE_ORDER.forEach((id, i) => {
    const z = ZONES[id];
    const seen = G.char.zonesSeen?.includes(id);
    grid.append(h('div.card.row', { style: { opacity: z ? 1 : 0.5 } },
      h('div', { style: { width: '42px', height: '42px', borderRadius: '10px', background: z ? '#' + z.terrain.palette.ground[1].toString(16).padStart(6, '0') : '#333', border: '2px solid var(--gold3)', flex: 'none' } }),
      h('div', { style: { flex: 1 } }, h('div', { style: { fontWeight: 900 } }, z ? L(z.name) : '???', G.zones.current?.id === id ? h('span.chip', { style: { marginLeft: '6px' } }, L('Buradasın|You are here')) : null),
        h('div.muted', { style: { fontSize: '12px' } }, z ? `${t('level')} ${z.level[0]}-${z.level[1]} · ${L(z.desc || '')}` : L('Yakında|Coming soon'))),
      seen ? h('span.good', '✔') : h('span.muted', '—')));
  });
  w.body.append(grid);
}

// Dynamic world events: invasions, treasure goblins, rampaging elites, crystal showers.
import * as THREE from 'three';
import { G, emit, on } from '../core/state.js';
import { L, t } from '../core/i18n.js';
import { rand, randi, choice, chance, distSq2, dist2, fmtTime } from '../core/util.js';
import { S, xpNeed } from '../data/classes.js';
import { MONSTERS } from '../data/monsters.js';
import { spawnMonster } from './factory.js';
import { makeStack, genEquip } from './items.js';
import { moveTowards } from './ai.js';
import { Builder, octa } from '../gfx/geom.js';
import { basic } from '../gfx/materials.js';
import { h, UI } from '../ui/ui.js';
import { Audio } from '../audio.js';

export const Events = {
  cur: null, timer: rand(150, 280), box: null,
  ui() {
    if (!this.box) { this.box = h('div.panel', { style: { position: 'absolute', right: 'calc(12px + var(--safe-r))', top: 'calc(186px + var(--safe-t))', width: '250px', padding: '8px 10px', fontSize: '12.5px', display: 'none', zIndex: 13, pointerEvents: 'auto', cursor: 'pointer' } }); G.hud?.root?.append(this.box); this.box.addEventListener('click', () => { if (this.cur) { const pc = G.playerCtl; G.mounts?.autoMount(); const pts = G.path.find(G.player.pos.x, G.player.pos.z, this.cur.x, this.cur.z); const step = i => { if (i < pts.length) pc.moveTarget = { x: pts[i].x, z: pts[i].z, stop: 3, then: () => step(i + 1) }; }; step(0); } }); }
    const c = this.cur;
    if (!c) { this.box.style.display = 'none'; return; }
    this.box.style.display = 'block';
    const d = Math.round(dist2(G.player.pos.x, G.player.pos.z, c.x, c.z));
    this.box.innerHTML = '';
    this.box.append(h('div', { style: { fontFamily: 'var(--title)', color: '#ff9a4a', fontWeight: 700 } }, '⚔ ' + c.title), h('div.muted', c.desc), h('div.row', h('span', c.progressText?.() || ''), h('span.spacer'), h('span.muted', d + 'm · ' + fmtTime(c.left))));
    if (G.ui.touch && innerHeight > innerWidth) this.box.style.top = 'calc(120px + var(--safe-t))';
  },
  update(dt) {
    if (G.mode !== 'game' || !G.zones.current || G.world.dungeon) { if (this.cur) this.fail(true); this.ui(); return; }
    const z = G.zones.current;
    if (!this.cur) {
      this.timer -= dt;
      if (this.timer <= 0) { this.timer = rand(240, 420); this.startRandom(z); }
      this._ut = (this._ut || 0) - dt; if (this._ut <= 0) { this._ut = 0.5; this.ui(); }
      return;
    }
    const c = this.cur;
    c.left -= dt;
    c.tick?.(dt);
    if (c.left <= 0) this.fail();
    this._ut = (this._ut || 0) - dt; if (this._ut <= 0) { this._ut = 0.5; this.ui(); }
  },
  pool(z) {
    const mons = [...new Set((z.spawns || []).flatMap(s => Array.isArray(s.m) ? s.m : [s.m]).filter(m => !MONSTERS[m].elite && !MONSTERS[m].boss))];
    return mons;
  },
  pickPoi(z) {
    const pois = (z.pois || []).filter(p => !p.dungeon);
    const p = G.player;
    // prefer places near the player so events are noticeable
    const near = pois.filter(q => distSq2(q.x, q.z, p.pos.x, p.pos.z) < 140 * 140 && !q.town);
    return choice(near.length ? near : pois);
  },
  startRandom(z) {
    const r = Math.random();
    if (r < 0.4) this.invasion(z);
    else if (r < 0.62) this.treasure(z);
    else if (r < 0.82) this.rampage(z);
    else this.shower(z);
  },
  reward(mult = 1) {
    const p = G.player, ch = G.char;
    G.progress.giveXp(Math.round(xpNeed(Math.min(p.level, 59)) * 0.08 * mult), null);
    ch.gold += Math.round(10 * S(p.level) * mult);
    G.progress.giveItem(makeStack('chest_daily', 1));
    G.progress.giveItem(makeStack('token_honor', Math.round(5 * mult)));
    Audio.sfx('victory');
    emit('eventCompleted');
  },
  begin(c) {
    this.cur = c;
    G.ui.banner(L('Dünya Etkinliği|World Event'), c.title, 3);
    G.chat.system('⚔ ' + c.title + ' — ' + c.desc, 'event');
    Audio.sfx('warn');
    G.events.emit('mapPing', { x: c.x, z: c.z, kind: 'event' });
    // bots rush in
    for (const b of (G.bots?.world || []).filter(b => !b.dead && Math.random() < 0.5)) { b.ai.state = 'hunt'; b.ai.area = { x: c.x, z: c.z, r: 15 }; b.ai.dest = { x: c.x + rand(-8, 8), z: c.z + rand(-8, 8), speed: 1.3 }; b.ai.timer = 120; }
  },
  done() { const c = this.cur; this.cur = null; G.ui.banner(L('Etkinlik Tamamlandı!|Event Complete!'), c.title, 3); c.cleanup?.(); },
  fail(silent) { const c = this.cur; this.cur = null; c?.cleanup?.(); if (!silent) G.chat.system(L('Etkinlik sona erdi.|The event has ended.'), 'event'); },
  participated(c) { return c.hit || distSq2(G.player.pos.x, G.player.pos.z, c.x, c.z) < 45 * 45; },
  // ------------------------------------------------------------ invasion: 3 waves
  invasion(z) {
    const poi = this.pickPoi(z), pool = this.pool(z);
    if (!poi || !pool.length) return;
    const lvl = Math.max(z.level[0], Math.min(z.level[1], G.player.level));
    const c = { kind: 'invasion', x: poi.x, z: poi.z, left: 240, wave: 0, alive: [], hit: false,
      title: L(`${L(poi.name)} Saldırı Altında!|${L(poi.name)} Under Attack!`), desc: L('3 dalga saldırganı püskürt.|Repel 3 waves of attackers.'),
      progressText: () => L(`Dalga ${c.wave}/3 · Kalan: ${c.alive.filter(u => !u.dead).length}|Wave ${c.wave}/3 · Left: ${c.alive.filter(u => !u.dead).length}`) };
    c.spawn = () => {
      c.wave++;
      c.alive = [];
      const n = 4 + c.wave * 2;
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2, d = rand(6, 14);
        const m = spawnMonster(choice(pool), lvl + (c.wave === 3 && i === 0 ? 2 : 0), poi.x + Math.sin(a) * d, poi.z + Math.cos(a) * d, { elite: c.wave === 3 && i === 0, xpMult: 0.6 });
        if (!m) continue;
        m.alwaysUpdate = true; m.data.wanderR = 6; m.data.event = true;
        c.alive.push(m);
      }
    };
    c.tick = dt => {
      if (c.wave === 0) { if (distSq2(G.player.pos.x, G.player.pos.z, c.x, c.z) < 60 * 60 || c.left < 200) c.spawn(); return; }
      if (c.alive.some(u => u.threat?.has(G.player))) c.hit = true;
      if (c.alive.every(u => u.dead)) { if (c.wave >= 3) { if (this.participated(c)) this.reward(1.2); this.done(); } else c.spawn(); }
    };
    c.cleanup = () => { for (const u of c.alive) if (!u.dead) G.world.removeUnit(u); };
    this.begin(c);
  },
  // ------------------------------------------------------------ treasure goblin
  treasure(z) {
    const p = G.player;
    const a = Math.random() * Math.PI * 2;
    let x = p.pos.x + Math.sin(a) * 30, zz = p.pos.z + Math.cos(a) * 30;
    if (G.world.terrain.isWater(x, zz)) { x = p.pos.x + 10; zz = p.pos.z + 10; }
    const g = spawnMonster('goblin', p.level + 2, x, zz, { name: 'Hazine Goblini|Treasure Goblin', hpMult: 2.5, xpMult: 2, noLoot: true });
    if (!g) return;
    g.setModel({ ...MONSTERS.goblin.model, look: { a: 'mob:orc', scale: 0.8, tint: 0xd8b04a, tintAmt: 0.45 }, skin: 0xd8b04a, scale: 0.9, gear: { chest: { m: 'leather', c: 0x8a5a2a }, main: { m: 'club', c2: 0x6a4a2a }, head: { m: 'crown', c2: 0xffd040 } } });
    g.speed = 7.5; g.data.wanderR = 30; g.alwaysUpdate = true;
    // flees instead of fighting
    g.ai.update = dt => {
      if (g.dead) return;
      const pl = G.player;
      const d = g.distTo(pl);
      if (d < 26 || g.inCombat) { const an = Math.atan2(g.pos.x - pl.pos.x, g.pos.z - pl.pos.z) + Math.sin(G.time) * 0.8; moveTowards(g, g.pos.x + Math.sin(an) * 5, g.pos.z + Math.cos(an) * 5, dt, 0.95); if (Math.random() < dt * 4) G.vfx?.emitOne('gold', g.pos.x, g.pos.y + 1, g.pos.z, 0, 2, 0); }
      else g.anim.move = 0;
    };
    g.ai.onDamaged = () => { };
    const c = { kind: 'treasure', x, z: zz, left: 75, g, title: L('Hazine Goblini!|Treasure Goblin!'), desc: L('Kaçmadan önce yakala!|Catch it before it escapes!'), progressText: () => g.dead ? '' : Math.ceil(g.hpPct * 100) + '%' };
    c.tick = () => {
      c.x = g.pos.x; c.z = g.pos.z;
      if (g.dead) {
        const ch = G.char; const gold = Math.round(40 * S(G.player.level));
        ch.gold += gold; G.overlay?.text(g, '+' + gold, { color: '#ffd660', big: true, force: true });
        G.vfx?.burst(g.pos, 'gold', { n: 60, r: 2 }); Audio.sfx('loot_legendary');
        G.progress.giveItem(genEquip({ ilvl: G.player.level + 1, cls: G.player.cls, rarity: chance(0.15) ? 'legendary' : 'epic' }));
        G.progress.giveItem(makeStack('enhance_stone', randi(3, 6)));
        emit('eventCompleted');
        this.done();
      }
    };
    c.cleanup = () => { if (!g.dead) { G.vfx?.burst(g.pos, 'smoke', { n: 20 }); G.world.removeUnit(g); } };
    this.begin(c);
  },
  // ------------------------------------------------------------ rampaging elite
  rampage(z) {
    const poi = this.pickPoi(z), pool = this.pool(z);
    if (!poi || !pool.length) return;
    const id = choice(pool);
    const lvl = Math.max(z.level[0], Math.min(z.level[1], G.player.level)) + 2;
    const m = spawnMonster(id, lvl, poi.x, poi.z, { elite: true, name: L('Kudurmuş |Rampaging ') + L(MONSTERS[id].name), hpMult: 1.6 });
    if (!m) return;
    m.setModel({ ...m.modelSpec, scale: (m.modelSpec.scale || 1) * 1.6 });
    m.alwaysUpdate = true;
    const c = { kind: 'rampage', x: poi.x, z: poi.z, left: 300, m, title: L('Kudurmuş Canavar|Rampaging Beast'), desc: m.name, progressText: () => Math.ceil(m.hpPct * 100) + '%' };
    c.tick = () => { c.x = m.pos.x; c.z = m.pos.z; if (m.threat?.has(G.player)) c.hit = true; if (m.dead) { if (this.participated(c)) this.reward(1); this.done(); } };
    c.cleanup = () => { if (!m.dead) G.world.removeUnit(m); };
    this.begin(c);
  },
  // ------------------------------------------------------------ crystal shower: gather shards
  shower(z) {
    const poi = this.pickPoi(z); if (!poi) return;
    const shards = [];
    const b = new Builder(2); b.add(octa(0.45), { s: [1, 2, 1], color: 0x8ae8ff, shade: 0.1 });
    const geo = b.build();
    for (let i = 0; i < 8; i++) {
      const a = Math.random() * Math.PI * 2, d = rand(3, 16);
      const x = poi.x + Math.sin(a) * d, zz = poi.z + Math.cos(a) * d;
      if (G.world.terrain.isWater(x, zz)) continue;
      const mesh = new THREE.Mesh(geo, basic('shard', { toneMapped: false }));
      mesh.position.set(x, G.world.groundAt(x, zz) + 0.9, zz);
      G.world.root.add(mesh);
      const ia = { kind: 'node', x, z: zz, r: 3, h: 1, label: L('Aether Kırığı|Aether Splinter'), verb: L('Topla|Collect'), mesh, col: '#8ae8ff',
        action: () => { if (ia.hidden) return; ia.hidden = true; mesh.visible = false; G.progress.giveItem(makeStack(chance(0.3) ? 'enhance_stone' : 'essence', randi(1, 3))); Audio.sfx('loot_rare', { vol: 0.6 }); G.vfx?.burst({ x, y: mesh.position.y, z: zz }, 'arcane', { n: 15 }); } };
      G.world.interactables.push(ia); shards.push(ia);
      G.vfx?.meteor({ x, z: zz }, 1 + i * 0.2);
    }
    const c = { kind: 'shower', x: poi.x, z: poi.z, left: 120, title: L('Aether Yağmuru|Aether Shower'), desc: L('Gökten düşen kristal kırıklarını topla.|Collect crystal splinters fallen from the sky.'), progressText: () => `${shards.filter(s => s.hidden).length}/${shards.length}` };
    c.tick = () => { if (shards.length && shards.every(s => s.hidden)) { this.reward(0.6); this.done(); } };
    c.cleanup = () => { for (const s of shards) { s.mesh.removeFromParent(); s.hidden = true; } G.world.interactables = G.world.interactables.filter(i => !shards.includes(i)); };
    this.begin(c);
  },
};
G.worldEvents = Events;
G.addSystem(dt => Events.update(dt));
on('zoneEntered', () => { if (Events.cur) Events.fail(true); Events.timer = rand(90, 200); });

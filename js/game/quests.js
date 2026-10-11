// Quest engine: availability, progress tracking, rewards, quest objects, auto-pathing.
import * as THREE from 'three';
import { G, emit, on } from '../core/state.js';
import { L, t } from '../core/i18n.js';
import { dist2, distSq2, rand, chance } from '../core/util.js';
import { S, xpNeed } from '../data/classes.js';
import { QUESTS, QUEST_OBJECTS } from '../data/quests.js';
import { MONSTERS } from '../data/monsters.js';
import { NPCS } from '../data/npcs.js';
import { ITEMS } from '../data/items.js';
import { ZONES } from '../data/zones.js';
import { genEquip, makeStack, countItem, removeItem, addItem, freeSlots } from './items.js';
import { findPath } from './path.js';
import { Builder, box, cyl, octa, torus } from '../gfx/geom.js';
import { lambert } from '../gfx/materials.js';
import { Audio } from '../audio.js';

const today = () => new Date().toDateString();
const weekKey = () => { const d = new Date(); const j = new Date(d.getFullYear(), 0, 1); return d.getFullYear() + '-' + Math.ceil(((d - j) / 864e5 + j.getDay() + 1) / 7); };

export const Quests = {
  rewardCache: {},
  init() {
    on('killed', u => this.onKill(u));
    on('bagChanged', () => this.changed(true));
    on('gathered', type => this.bump(o => o.t === 'gather' && o.node === type));
    on('fishCaught', id => this.bump(o => o.t === 'fish' && (!o.item || o.item === id)));
    on('crafted', () => this.bump(o => o.t === 'craft'));
    on('dungeonCleared', (id, o) => this.bump(ob => ob.t === 'dungeon' && (ob.id === id || (ob.id === 'heroic' && o?.heroic))));
    on('levelUp', () => this.changed());
    on('zoneEntered', () => this.changed());
    G.addSystem(dt => this.update(dt));
  },
  get ch() { return G.char; },
  onSession(ch) {
    ch.quests = ch.quests || { active: {}, done: {}, tracked: [] };
    ch.quests.tracked = ch.quests.tracked || [];
    // daily/weekly reset
    for (const id in ch.quests.done) {
      const q = QUESTS[id]; if (!q?.repeat) continue;
      const stamp = ch.quests.done[id];
      if (q.repeat === 'daily' && stamp !== today()) delete ch.quests.done[id];
      if (q.repeat === 'weekly' && stamp !== weekKey()) delete ch.quests.done[id];
    }
    this.changed();
  },
  def(id) { return QUESTS[id]; },
  state(id) { return this.ch?.quests.active[id]; },
  isDone(id) { return !!this.ch?.quests.done[id]; },
  prevDone(q) { const p = q.prev; if (!p) return true; return (Array.isArray(p) ? p : [p]).every(x => this.isDone(x)); },
  canAccept(q) {
    const ch = this.ch;
    if (ch.quests.active[q.id] || ch.quests.done[q.id]) return false;
    if (!this.prevDone(q)) return false;
    if (ch.level < (q.minLvl ?? Math.max(1, q.lvl - 4))) return false;
    if (q.cls && q.cls !== ch.cls) return false;
    return true;
  },
  offeredBy(npcId) { return Object.values(QUESTS).filter(q => q.giver === npcId && this.canAccept(q)); },
  turnInsAt(npcId) { return Object.keys(this.ch.quests.active).map(id => QUESTS[id]).filter(q => q && (q.turnin || q.giver) === npcId); },
  npcMarker(u) {
    if (!this.ch || !u.npcId) return null;
    const ti = this.turnInsAt(u.npcId);
    if (ti.some(q => this.isComplete(q.id))) return '?';
    const off = this.offeredBy(u.npcId);
    if (off.some(q => !q.repeat)) return '!';
    if (off.length) return '!b';
    if (ti.length) return '?g';
    return null;
  },
  objCount(q, i) {
    const o = q.obj[i], st = this.state(q.id);
    if (o.t === 'have') return Math.min(o.n, countItem(this.ch, o.item));
    if (o.t === 'level') return Math.min(o.n, this.ch.level);
    return st ? st.p[i] || 0 : 0;
  },
  isComplete(id) {
    const q = QUESTS[id], st = this.state(id);
    if (!q || !st) return false;
    return q.obj.every((o, i) => this.objCount(q, i) >= (o.n || 1));
  },
  objText(o) {
    const mon = id => L(MONSTERS[id]?.name || id);
    switch (o.t) {
      case 'kill': return L('Öldür: |Slay: ') + o.m.map(mon).filter((v, i, a) => a.indexOf(v) === i).join(' / ');
      case 'boss': return L('Yen: |Defeat: ') + mon(o.m);
      case 'collect': case 'have': return L('Topla: |Collect: ') + L(ITEMS[o.item]?.name || o.item);
      case 'gather': return L('Topla: |Gather: ') + L(ITEMS[o.node]?.name || o.node);
      case 'fish': return L('Balık tut: |Catch: ') + (o.item ? L(ITEMS[o.item].name) : L('Herhangi bir balık|Any fish'));
      case 'talk': return L('Konuş: |Speak with: ') + L(NPCS[o.npc]?.name || o.npc);
      case 'explore': { const p = this.findPoi(o.poi); return L('Keşfet: |Explore: ') + (p ? L(p.name) : o.poi); }
      case 'interact': return L(QUEST_OBJECTS[o.obj]?.label || o.obj);
      case 'dungeon': return o.id === 'heroic' ? L('Herhangi bir zindanı kahraman zorlukta temizle|Clear any dungeon on heroic') : L('Zindanı tamamla: |Clear dungeon: ') + L(G.dungeons?.name(o.id) || o.id);
      case 'level': return L(`${o.n}. seviyeye ulaş|Reach level ${o.n}`);
      case 'craft': return L('Bir eşya üret|Craft an item');
    }
    return '';
  },
  turnInName(q) { return L(NPCS[q.turnin || q.giver]?.name || ''); },
  findPoi(id) { for (const z of Object.values(ZONES)) { const p = (z.pois || []).find(p => p.id === id); if (p) return { ...p, zone: z.id }; } return null; },
  // ------------------------------------------------------------ rewards
  rewardsFor(q) {
    if (this.rewardCache[q.id]) return this.rewardCache[q.id];
    const ch = this.ch, r = q.rew || {};
    const lvl = Math.min(ch.level + 1, (q.lvl || 1) + 3);
    const out = {
      xp: Math.round((r.xp || 0) * xpNeed(Math.max(1, Math.min(ch.level, q.lvl + 3))) * 0.25),
      gold: Math.round((r.gold || 0) * S(Math.max(q.lvl, 1))),
      items: (r.items || []).map(i => makeStack(i.id, i.qty || 1)),
      choice: (r.choice || []).map(c => genEquip({ slot: c.slot, rarity: c.rarity, ilvl: Math.max(lvl, q.lvl + 1), cls: ch.cls })),
      unlock: r.unlock,
    };
    this.rewardCache[q.id] = out;
    return out;
  },
  accept(id) {
    const q = QUESTS[id]; if (!q || !this.canAccept(q)) return false;
    const ch = this.ch;
    ch.quests.active[id] = { p: q.obj.map(() => 0), t: Date.now() };
    if (!ch.quests.tracked.includes(id)) ch.quests.tracked.unshift(id);
    if (q.accept?.unlock) G.prof?.unlock(q.accept.unlock);
    Audio.sfx('quest_accept');
    G.ui.toast('quest_exclaim', t('questAccepted') + ': ' + L(q.name), '#ffe08a');
    // talk objectives satisfied instantly if the target is the giver
    this.changed();
    emit('questAccepted', id);
    return true;
  },
  abandon(id) { delete this.ch.quests.active[id]; this.ch.quests.tracked = this.ch.quests.tracked.filter(x => x !== id); delete this.rewardCache[id]; this.changed(); },
  complete(id, choiceIdx = 0) {
    const q = QUESTS[id]; if (!q || !this.isComplete(id)) return false;
    const ch = this.ch, rw = this.rewardsFor(q);
    const need = rw.items.length + (rw.choice.length ? 1 : 0);
    if (freeSlots(ch) < need) { G.ui.error(t('bagFull')); return false; }
    for (let i = 0; i < q.obj.length; i++) { const o = q.obj[i]; if (o.t === 'have') removeItem(ch, o.item, o.n); if (o.t === 'collect' && ITEMS[o.item]?.type === 'quest') removeItem(ch, o.item, countItem(ch, o.item)); }
    delete ch.quests.active[id];
    ch.quests.done[id] = q.repeat === 'daily' ? today() : q.repeat === 'weekly' ? weekKey() : Date.now();
    ch.quests.tracked = ch.quests.tracked.filter(x => x !== id);
    ch.gold += rw.gold;
    for (const it of rw.items) G.progress.giveItem({ ...it });
    if (rw.choice.length) G.progress.giveItem(rw.choice[Math.min(choiceIdx, rw.choice.length - 1)]);
    if (rw.unlock) { if (rw.unlock.startsWith('mount_')) G.mounts?.grant(rw.unlock.slice(6)); else G.prof?.unlock(rw.unlock); }
    if (q.rew?.rep) for (const f in q.rew.rep) G.rep?.add(f, q.rew.rep[f]);
    delete this.rewardCache[id];
    Audio.sfx('quest_complete');
    G.ui.banner(t('questComplete'), L(q.name), 2.6);
    G.chat.system(t('questComplete') + ' ' + L(q.name) + (rw.gold ? ` (+${rw.gold} ${L('altın|gold')})` : ''), 'system');
    G.progress.giveXp(rw.xp, null);
    ch.stats.quests = (ch.stats.quests || 0) + 1;
    this.changed();
    emit('questCompleted', id, q);
    // auto-accept follow-up from the same NPC for smooth story flow
    const next = Object.values(QUESTS).find(n => n.prev === id && n.main && n.giver === (q.turnin || q.giver) && this.canAccept(n));
    if (next) setTimeout(() => G.npcs?.offerQuest(next.id), 400);
    G.save.save();
    return true;
  },
  // ------------------------------------------------------------ progress
  bump(pred, by = 1, filterQ) {
    const ch = this.ch; if (!ch) return;
    let changed = false;
    for (const id in ch.quests.active) {
      const q = QUESTS[id]; if (!q || (filterQ && !filterQ(q))) continue;
      const st = ch.quests.active[id];
      q.obj.forEach((o, i) => {
        if (!pred(o) || (st.p[i] || 0) >= (o.n || 1)) return;
        st.p[i] = Math.min(o.n || 1, (st.p[i] || 0) + by);
        changed = true;
        G.ui.toast(null, `${this.objText(o)}: ${st.p[i]}/${o.n || 1}`, '#ffe08a');
        if (this.isComplete(id)) { G.ui.toast('check', L(q.name) + ' — ' + L('Tamamlandı! Teslim et.|Complete! Turn it in.'), '#8affb0'); Audio.sfx('quest_accept', { pitch: 1.3 }); }
      });
    }
    if (changed) this.changed();
  },
  onKill(u) {
    const id = u.tplId;
    this.bump(o => (o.t === 'kill' && o.m.includes(id)) || (o.t === 'boss' && o.m === id));
  },
  dropsFor(u) {
    const out = [], ch = this.ch; if (!ch) return out;
    for (const qid in ch.quests.active) {
      const q = QUESTS[qid];
      q.obj.forEach((o, i) => {
        if (o.t !== 'collect' || !o.from?.includes(u.tplId)) return;
        if (countItem(ch, o.item) >= o.n) return;
        if (chance(o.chance ?? 0.6)) out.push(makeStack(o.item, 1));
      });
    }
    return out;
  },
  talkTo(npcId) {
    // completes talk objectives on active quests
    this.bump(o => o.t === 'talk' && o.npc === npcId);
  },
  changed(soft) {
    if (!this.ch) return;
    // collect objectives mirror bag counts
    for (const id in this.ch.quests.active) {
      const q = QUESTS[id], st = this.ch.quests.active[id]; if (!q) continue;
      q.obj.forEach((o, i) => { if (o.t === 'collect') st.p[i] = Math.min(o.n, countItem(this.ch, o.item)); });
    }
    this.refreshObjects();
    emit('questsChanged');
  },
  // ------------------------------------------------------------ world objects (chests, sparkles)
  spawnZoneObjects(def) {
    this.objs = [];
    for (const [id, o] of Object.entries(QUEST_OBJECTS)) {
      if (o.zone !== def.id) continue;
      const b = new Builder(3);
      if (o.model === 'chest') {
        b.add(box(1.2, 0.7, 0.8), { p: [0, 0.35, 0], color: 0x8a5a2a });
        b.add(box(1.25, 0.12, 0.85), { p: [0, 0.72, 0], color: 0xd8b04a });
        b.add(cyl(0.42, 0.42, 1.2, 8, false), { p: [0, 0.72, 0], r: [0, 0, Math.PI / 2], s: [1, 1, 0.95], color: 0x7a4a22 });
      } else {
        b.add(octa(0.18), { p: [0, 0.3, 0], color: o.glow || 0xffe08a });
        b.add(torus(0.3, 0.04, 4, 10), { p: [0, 0.05, 0], r: [Math.PI / 2, 0, 0], color: 0xd8b04a });
      }
      const mesh = new THREE.Mesh(b.build(), lambert('qobj'));
      const y = G.world.groundAt(o.x, o.z);
      mesh.position.set(o.x, y, o.z);
      G.world.root.add(mesh);
      const beam = G.vfx?.lootBeam({ x: o.x, y, z: o.z }, o.glow || 0xffe08a);
      const ia = { kind: 'quest', id, x: o.x, z: o.z, r: 3, h: 1, label: L(o.label), verb: L('İncele|Examine'), mesh, beam, hidden: true,
        action: () => { this.bump(ob => ob.t === 'interact' && ob.obj === id); Audio.sfx(o.model === 'chest' ? 'door' : 'loot'); G.vfx?.burst({ x: o.x, y, z: o.z }, 'gold', { n: 20 }); this.refreshObjects(); } };
      G.world.interactables.push(ia);
      this.objs.push({ ia, o, id });
    }
    this.refreshObjects();
  },
  refreshObjects() {
    for (const { ia, o, id } of this.objs || []) {
      const q = QUESTS[o.quest]; const st = this.state(o.quest);
      let need = false;
      if (st) q.obj.forEach((ob, i) => { if (ob.t === 'interact' && ob.obj === id && (st.p[i] || 0) < ob.n) need = true; });
      ia.hidden = !need; ia.mesh.visible = need;
      if (ia.beam?.mesh) ia.beam.mesh.visible = need;
    }
  },
  // ------------------------------------------------------------ explore detection & tracking helpers
  update(dt) {
    this._t = (this._t || 0) - dt;
    if (this._t > 0 || !this.ch || !G.player) return;
    this._t = 1;
    const p = G.player, z = G.zones.current; if (!z || z.dungeonLayout) return;
    for (const poi of z.pois || []) {
      if (distSq2(p.pos.x, p.pos.z, poi.x, poi.z) < (poi.r || 15) ** 2) {
        const seen = this.ch.poiSeen = this.ch.poiSeen || [];
        if (!seen.includes(poi.id)) { seen.push(poi.id); G.ui.toast('map_marker', L('Keşfedildi: |Discovered: ') + L(poi.name), '#8ad8ff'); G.progress.giveXp(Math.round(xpNeed(p.level) * 0.02), null); emit('poiDiscovered', poi.id); }
        this.bump(o => o.t === 'explore' && o.poi === poi.id);
      }
    }
  },
  trackedList() {
    const ch = this.ch; if (!ch) return [];
    const act = Object.keys(ch.quests.active);
    const order = [...ch.quests.tracked.filter(id => act.includes(id)), ...act.filter(id => !ch.quests.tracked.includes(id))];
    return order.map(id => QUESTS[id]).filter(Boolean).sort((a, b) => (b.main ? 1 : 0) - (a.main ? 1 : 0) || (this.isComplete(b.id) ? 1 : 0) - (this.isComplete(a.id) ? 1 : 0));
  },
  // where to go for a quest (current zone only, else the zone portal)
  target(qid) {
    const q = QUESTS[qid]; if (!q) return null;
    const zone = G.zones.current; const p = G.player;
    if (this.isComplete(qid)) return this.npcPos(q.turnin || q.giver);
    for (let i = 0; i < q.obj.length; i++) {
      const o = q.obj[i]; if (this.objCount(q, i) >= (o.n || 1)) continue;
      if (o.t === 'talk') return this.npcPos(o.npc);
      if (o.t === 'kill' || o.t === 'boss' || (o.t === 'collect' && o.from)) {
        const ms = o.m ? (Array.isArray(o.m) ? o.m : [o.m]) : o.from;
        const live = G.world.units.filter(u => u.kind === 'monster' && !u.dead && ms.includes(u.tplId)).sort((a, b) => a.distTo(p) - b.distTo(p))[0];
        if (live) return { x: live.pos.x, z: live.pos.z, zone: zone.id };
        const sp = (zone.spawns || []).find(s => (Array.isArray(s.m) ? s.m : [s.m]).some(m => ms.includes(m)));
        if (sp) return { x: sp.x, z: sp.z, zone: zone.id };
        if (o.t === 'boss' && G.dungeons) { const d = G.dungeons.byBoss(o.m); if (d) return { ...G.dungeons.entrance(d), zone: d.zone }; }
      }
      if (o.t === 'have') {
        const drop = (zone.spawns || []).find(s => (Array.isArray(s.m) ? s.m : [s.m]).some(m => ['beast', 'spider'].includes(MONSTERS[m]?.loot) && (o.item === 'meat' || o.item === 'fang' ? MONSTERS[m].loot === 'beast' : o.item === 'silk' ? MONSTERS[m].loot === 'spider' : false)));
        if (drop) return { x: drop.x, z: drop.z, zone: zone.id };
        if (ITEMS[o.item]?.fish && zone.fishing?.[0]) return { x: zone.fishing[0].x + zone.fishing[0].r * 0.85, z: zone.fishing[0].z, zone: zone.id };
      }
      if (o.t === 'gather') { const n = G.gather?.nearest(o.node); if (n) return { x: n.x, z: n.z, zone: zone.id }; }
      if (o.t === 'fish' && zone.fishing?.[0]) return { x: zone.fishing[0].x + zone.fishing[0].r * 0.85, z: zone.fishing[0].z, zone: zone.id };
      if (o.t === 'explore') { const poi = this.findPoi(o.poi); if (poi) return poi; }
      if (o.t === 'interact') { const ob = QUEST_OBJECTS[o.obj]; if (ob) return { x: ob.x, z: ob.z, zone: ob.zone }; }
      if (o.t === 'dungeon' && G.dungeons) { const e = G.dungeons.entrance(o.id); if (e) return e; }
    }
    return null;
  },
  npcPos(npcId) {
    const d = NPCS[npcId]; if (!d) return null;
    const u = G.world.units.find(x => x.npcId === npcId);
    if (u) return { x: u.pos.x, z: u.pos.z, zone: G.zones.current.id, npc: true };
    if (Array.isArray(d.at)) return { x: d.at[0], z: d.at[1], zone: d.zone, npc: true };
    const z = ZONES[d.zone]; const town = z?.towns?.[0];
    return town ? { x: town.x, z: town.z, zone: d.zone, npc: true } : null;
  },
  mapMarkers() {
    const out = [];
    for (const q of this.trackedList().slice(0, 3)) {
      const tg = this.target(q.id);
      if (tg && (!tg.zone || tg.zone === G.zones.current?.id)) out.push({ x: tg.x, z: tg.z, turnin: this.isComplete(q.id), q });
    }
    return out;
  },
  autoPath(qid) {
    const p = G.player; if (!p || p.dead) return;
    let tg = this.target(qid);
    if (!tg) { G.ui.error(L('Hedef bu bölgede değil.|The objective is not in this zone.')); return; }
    if (tg.zone && tg.zone !== G.zones.current.id) {
      // head to the portal leading towards that zone
      const portal = (G.zones.current.portals || []).find(pt => pt.to === tg.zone) || (G.zones.current.portals || [])[0];
      if (!portal) { G.ui.error(L('Hedef başka bir bölgede.|The objective is in another zone.')); return; }
      G.ui.toast('map_marker', L('Hedef başka bölgede — portala gidiliyor.|Objective is in another zone — heading to the portal.'), '#8ad8ff');
      tg = { x: portal.x, z: portal.z };
    }
    const d = dist2(p.pos.x, p.pos.z, tg.x, tg.z);
    if (d > 45) G.mounts?.autoMount();
    const pts = findPath(p.pos.x, p.pos.z, tg.x, tg.z);
    const pc = G.playerCtl;
    const step = i => {
      if (i >= pts.length) return;
      pc.moveTarget = { x: pts[i].x, z: pts[i].z, stop: i === pts.length - 1 ? (tg.npc ? 3 : 2.5) : 1.5, then: () => step(i + 1) };
    };
    step(0);
    Audio.sfx('ui_click');
  },
};
G.quests = Quests;
Quests.init();

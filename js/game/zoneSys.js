// Zone transitions: load a zone, populate it, place the player, set environment/music.
import { G, emit } from '../core/state.js';
import { rand, randi, choice, distSq2, dist2 } from '../core/util.js';
import { L, t } from '../core/i18n.js';
import { ZONES } from '../data/zones.js';
import { MONSTERS } from '../data/monsters.js';
import { Spawner, spawnMonster } from './factory.js';
import { clearTimers } from './skillsys.js';
import { Audio } from '../audio.js';
import { dmg } from './combat.js';

export const ZoneSys = {
  current: null,
  bossTimer: 0,
  async enter(zoneId, spawn = null, opts = {}) {
    const def = ZONES[zoneId] || G.dungeons?.def(zoneId);
    if (!def) { console.error('unknown zone', zoneId); return; }
    G.ui?.loading?.(true, L(def.name));
    await new Promise(r => setTimeout(r, 30));
    const p = G.player;
    // carry party & pets
    const keep = [p, ...(p.summons || []), ...(G.party?.members?.() || []).flatMap(m => [m, ...(m.summons || [])])].filter(Boolean);
    for (const u of keep) G.world.removeUnit(u, false);
    clearTimers();
    G.vfx?.clear();
    G.dangers = [];
    this.current = def;
    G.world.load(def);
    G.engine.setEnv(def.env);
    // place player
    let pos = spawn || def.start;
    if (typeof spawn === 'string') pos = this.anchor(spawn) || def.start;
    p.pos.set(pos.x, 0, pos.z);
    p.vel.set(0, 0, 0); p.dash = null; p.cast = null;
    G.world.addUnit(p);
    let i = 0;
    for (const u of keep) {
      if (u === p || u.dead && u.kind === 'pet') continue;
      const a = (i++ / Math.max(1, keep.length)) * Math.PI * 2;
      u.pos.set(pos.x + Math.sin(a) * 2.5, 0, pos.z + Math.cos(a) * 2.5);
      u.dash = null; u.cast = null;
      G.world.addUnit(u);
    }
    if (G.char) { G.char.zone = def.dungeonLayout ? G.char.zone : zoneId; }
    this.populate(def);
    G.engine.cam.yaw = opts.yaw ?? G.engine.cam.yaw;
    Audio.music(def.music || 'meadow');
    Audio.ambient(def.ambient || 'none');
    G.weather?.set(def);
    this.bossTimer = (def.worldBoss?.every ?? 600) * rand(0.25, 0.6);
    emit('zoneEntered', def);
    setTimeout(() => G.ui?.loading?.(false), 250);
    if (!def.dungeonLayout && G.char) {
      G.char.zonesSeen = G.char.zonesSeen || [];
      if (!G.char.zonesSeen.includes(zoneId)) { G.char.zonesSeen.push(zoneId); G.ui?.banner?.(t('newZone'), L(def.name)); emit('zoneDiscovered', zoneId); }
      else G.ui?.banner?.(L(def.name), L(def.desc || ''), 2.5);
    }
  },
  anchor(name) {
    const a = G.world.anchors[name];
    if (a) return { x: a[0], z: a[1] };
    const w = this.current?.waystones?.find(w => w.id === name);
    if (w) return { x: w.x + 2, z: w.z + 3 };
    return null;
  },
  populate(def) {
    const W = G.world;
    // spawners
    for (const sp of def.spawns || []) new Spawner(sp, def);
    // critters scattered
    for (const c of def.critters || []) {
      for (let i = 0; i < c.n; i++) {
        let x, z, ok = false;
        for (let k = 0; k < 15 && !ok; k++) {
          if (c.area) { const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * c.area.r; x = c.area.x + Math.sin(a) * r; z = c.area.z + Math.cos(a) * r; }
          else { x = rand(-W.terrain.half * 0.8, W.terrain.half * 0.8); z = rand(-W.terrain.half * 0.8, W.terrain.half * 0.8); }
          ok = !W.terrain.isWater(x, z) && !W.blockedAt(x, z, 0.5) && W.terrain.slopeAt(x, z) < 0.6 && W.terrain.plazaAt(x, z) < 0.1;
        }
        if (ok) { const u = spawnMonster(c.m, 1, x, z); if (u) u.data.wanderR = 12; }
      }
    }
    // waystones
    for (const w of def.waystones || []) {
      W.interactables.push({ kind: 'waystone', id: w.id, x: w.x, z: w.z, r: 4, h: 3, label: L(w.name), icon: 'portal', action: () => G.travel?.useWaystone(w) });
    }
    // portals
    for (const p of def.portals || []) {
      W.interactables.push({ kind: 'portal', x: p.x, z: p.z, r: p.r || 4, h: 2.5, label: L(p.label), icon: 'portal', action: () => G.travel?.usePortal(p) });
    }
    // dungeon entrances
    for (const d of def.dungeons || []) {
      W.interactables.push({ kind: 'dungeon', id: d.id, x: d.x, z: d.z, r: d.r || 4, h: 2.5, label: L(G.dungeons?.name(d.id) || 'Zindan|Dungeon'), icon: 'dungeon', action: () => G.ui?.openDungeon?.(d.id) });
    }
    // exits inside dungeons
    if (def.exit) W.interactables.push({ kind: 'exit', x: def.exit.x, z: def.exit.z, r: 3.5, h: 2, label: L('Çıkış|Exit'), icon: 'portal', action: () => G.dungeons?.leave() });
    G.npcs?.spawnZone(def);
    G.gather?.spawnZone(def);
    G.quests?.spawnZoneObjects(def);
    G.bots?.spawnZone(def);
    G.events.emit('zonePopulated', def);
  },
  update(dt) {
    const def = this.current; if (!def) return;
    // molten lava burns anyone who wades into it
    const w = G.world, p = G.player;
    if (w?.lava && p && !p.dead) {
      this._lavaT = (this._lavaT || 0) - dt;
      if (!w.dungeon && w.groundAt(p.pos.x, p.pos.z) < w.waterLevel - 0.15 && this._lavaT <= 0) {
        this._lavaT = 0.5;
        dmg(null, p, { amount: Math.round(p.stats.maxHp * 0.08), school: 'fire', canCrit: false });
        G.vfx?.burst?.(p.pos, 'fire', { n: 8 });
        if (!this._lavaWarn || G.time - this._lavaWarn > 6) { this._lavaWarn = G.time; G.ui?.error?.(L('Lav seni yakıyor!|The lava is burning you!')); }
      }
    }
    // world boss timer
    if (def.worldBoss && !def.dungeonLayout) {
      this.bossTimer -= dt;
      const wb = def.worldBoss;
      if (this.bossTimer <= 60 && !this._warned) { this._warned = true; G.chat?.system(L(`${L(wb.name)} 1 dakika içinde ortaya çıkacak!|${L(wb.name)} will appear in 1 minute!`), 'event'); G.ui?.banner?.(L('Dünya Patronu|World Boss'), L(`${L(wb.name)} yaklaşıyor...|${L(wb.name)} approaches...`), 3); }
      if (this.bossTimer <= 0) {
        this.bossTimer = wb.every; this._warned = false;
        if (!G.world.units.some(u => u.worldBoss && !u.dead)) {
          const b = spawnMonster(wb.m, wb.lvl, wb.x, wb.z, {});
          b.data.leash = 70; b.alwaysUpdate = true;
          G.chat?.system(L(`${b.name} ortaya çıktı! Tüm maceracılar savaşa!|${b.name} has appeared! All adventurers to arms!`), 'event');
          G.ui?.banner?.(L('Dünya Patronu|World Boss'), b.name, 3);
          emit('worldBossSpawned', b);
          G.events.emit('mapPing', { x: wb.x, z: wb.z, kind: 'boss' });
        }
      }
    }
  },
  timeToBoss() { return this.bossTimer; },
};
G.zones = ZoneSys;

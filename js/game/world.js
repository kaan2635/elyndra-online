// World manager: loads zones (terrain, water, props, structures), collision,
// unit registry, spawners and per-frame updates.
import * as THREE from 'three';
import { G, emit } from '../core/state.js';
import { rng, clamp, dist2, distSq2, smoothstep } from '../core/util.js';
import { Terrain } from '../gfx/terrain.js';
import { makeWater } from '../gfx/water.js';
import { buildPropField, COLLIDE } from '../gfx/props.js';
import { buildStructures } from '../gfx/buildings.js';
import { genTown } from './townGen.js';
import { U, basic } from '../gfx/materials.js';

const CELL = 8;

export class World {
  constructor() {
    this.root = new THREE.Group(); this.root.name = 'world';
    G.scene.add(this.root);
    this.units = [];
    this.zone = null;
    this.grid = new Map();
    this.boxes = [];
    this.bridges = [];
    this.spawners = [];
    this.nodes = [];
    this.interactables = [];
    this.waterLevel = -999;
    this.anchors = {};
    this.activeR = 95;
    G.world = this;
  }

  // ------------------------------------------------------------ loading
  load(zoneDef) {
    this.unload();
    this.zone = zoneDef;
    if (zoneDef.dungeonLayout) {
      // instanced interior: no terrain/water/props
      this.dungeon = zoneDef.dungeonLayout;
      this.dungeon.build(this.root);
      this.terrain = null; this.water = null; this.waterLevel = -999; this.lava = false;
      this.boxes = []; this.grid = new Map(); this.bridges = []; this.props = null; this.glowMesh = null;
      this.anchors = {}; this.towns = []; this.structures = [];
      this.mapCanvas = this.dungeon.mapCanvas;
      emit('zoneLoaded', zoneDef);
      return;
    }
    const T = { ...zoneDef.terrain };
    T.features = [...(T.features || [])];
    const structures = [...(zoneDef.structures || [])];
    this.anchors = {};
    this.towns = [];
    for (const town of zoneDef.towns || []) {
      const g = genTown(town);
      T.features.push(g.flat);
      structures.push(...g.structures);
      for (const k in g.anchors) this.anchors[town.id + '.' + k] = g.anchors[k];
      this.towns.push({ ...town });
    }
    for (const f of zoneDef.flats || []) T.features.push({ t: 'flat', edge: 8, ...f });
    this.dungeon = null;
    if (zoneDef.dungeonLayout) {
      // dungeon zones supply their own geometry builder
      this.dungeon = zoneDef.dungeonLayout;
    }
    // terrain
    this.terrain = new Terrain(T);
    this.root.add(this.terrain.mesh);
    this.waterLevel = T.water ?? -999;
    this.lava = !!T.lava;
    if (T.water != null) {
      this.water = makeWater(this.terrain, { lava: T.lava, shallow: T.waterShallow, deep: T.waterDeep });
      this.root.add(this.water);
    }
    // structures
    this.boxes = []; this.grid = new Map(); this.bridges = [];
    const st = buildStructures(structures, (x, z) => this.terrain.heightAt(x, z));
    this.root.add(st.solid, st.glow);
    this.glowMesh = st.glow;
    for (const c of st.colliders) this.addBox(c);
    for (const e of st.extras) {
      if (e.bridge) this.bridges.push({ x: e.x, z: e.z, rot: e.rot || 0, hl: e.bridge.L / 2, hw: e.bridge.w / 2, y: e.y + e.bridge.h * (e.s ?? 1) });
    }
    this.structures = st.extras;
    // props
    const props = this.scatterProps(zoneDef, structures);
    for (const p of props) { const cr = COLLIDE[p.type]; if (cr) this.addCircle(p.x, p.z, cr * (p.s ?? 1)); }
    this.props = buildPropField(props, zoneDef.propColors || {}, T.size, T.seed || 1, 5);
    this.root.add(this.props);
    // minimap colour map
    this.mapCanvas = this.terrain.mapCanvas(256);
    emit('zoneLoaded', zoneDef);
  }

  unload() {
    for (const u of [...this.units]) if (u.kind !== 'player') this.removeUnit(u, true);
    for (const n of this.nodes) n.mesh?.removeFromParent();
    this.nodes = []; this.spawners = []; this.interactables = [];
    this.root.traverse(o => {
      if (o.isMesh || o.isInstancedMesh) { o.geometry?.dispose(); }
    });
    this.root.clear();
    this.terrain = null; this.water = null;
  }

  scatterProps(z, structures) {
    const list = [];
    const T = this.terrain, half = T.half;
    const r = rng((z.terrain.seed || 1) * 13 + 7);
    const clears = [...(z.clear || [])];
    for (const t of z.towns || []) clears.push({ x: t.x, z: t.z, r: t.r + 5 });
    for (const s of structures) clears.push({ x: s.x, z: s.z, r: s.type === 'wall' || s.type === 'palisade' ? 3 : s.type === 'bridge' ? 9 : 4.5 });
    for (const sp of z.spawns || []) if (sp.camp) clears.push({ x: sp.x, z: sp.z, r: sp.r * 0.6 });
    const nz = T.noise;
    for (const rule of z.scatter || []) {
      const area = T.size * T.size * 0.8;
      const count = Math.round(area * rule.d * (rule.type === 'grass' || rule.type === 'flowers' ? (G.engine?.q.grass ?? 1) : 1));
      let placed = 0, tries = 0;
      while (placed < count && tries < count * 4) {
        tries++;
        const x = (r() - 0.5) * T.size * 0.94, zz = (r() - 0.5) * T.size * 0.94;
        if (rule.mask) {
          const n = nz.n2(x * (rule.mask.s || 0.02) + (rule.mask.o || 0), zz * (rule.mask.s || 0.02) - (rule.mask.o || 0));
          if (n < (rule.mask.min ?? -1) || n > (rule.mask.max ?? 1)) continue;
        }
        if (rule.area && distSq2(x, zz, rule.area.x, rule.area.z) > rule.area.r * rule.area.r) continue;
        const h = T.heightAt(x, zz);
        const water = T.water;
        if (rule.shore) { if (h > water + 0.6 || h < water - 0.6) continue; }
        else if (!rule.inWater && h < water + 0.25) continue;
        if (rule.minH != null && h < rule.minH) continue;
        if (rule.maxH != null && h > rule.maxH) continue;
        const slope = T.slopeAt(x, zz);
        if (slope > (rule.maxSlope ?? 0.7)) continue;
        if (!rule.onRoad && T.roadAt(x, zz) > 0.15) continue;
        if (T.plazaAt(x, zz) > 0.05) continue;
        const bd = Math.max(Math.abs(x), Math.abs(zz)) / half;
        if (!rule.border && bd > 0.9) continue;
        let bad = false;
        if (!rule.small) for (const c of clears) if (distSq2(x, zz, c.x, c.z) < c.r * c.r) { bad = true; break; }
        if (rule.small) for (const c of clears) if (distSq2(x, zz, c.x, c.z) < (c.r * 0.6) ** 2) { bad = true; break; }
        if (bad) continue;
        const s = (rule.s ? rule.s[0] + r() * (rule.s[1] - rule.s[0]) : 1);
        const tint = rule.tint ? rule.tint[Math.floor(r() * rule.tint.length)] : undefined;
        list.push({ type: rule.type, x, z: zz, y: h - 0.05, rot: r() * Math.PI * 2, s, tint });
        placed++;
      }
    }
    return list;
  }

  // ------------------------------------------------------------ collision
  key(cx, cz) { return cx * 4096 + cz; }
  addCircle(x, z, r) {
    const c = { x, z, r, t: 0 };
    this._insert(c, x, z, r);
  }
  addBox(b) {
    const c = { x: b.x, z: b.z, hw: b.hw, hd: b.hd, rot: b.rot, cos: Math.cos(b.rot), sin: Math.sin(b.rot), t: 1 };
    this.boxes.push(c);
    this._insert(c, b.x, b.z, Math.hypot(b.hw, b.hd));
  }
  _insert(c, x, z, r) {
    const x0 = Math.floor((x - r) / CELL), x1 = Math.floor((x + r) / CELL), z0 = Math.floor((z - r) / CELL), z1 = Math.floor((z + r) / CELL);
    for (let i = x0; i <= x1; i++) for (let j = z0; j <= z1; j++) {
      const k = this.key(i, j);
      if (!this.grid.has(k)) this.grid.set(k, []);
      this.grid.get(k).push(c);
    }
  }
  blockedAt(x, z, r = 0.4) {
    const p = this.resolve(x, z, r, x, z, null, true);
    return p.hit;
  }
  resolve(x, z, r, ox, oz, unit, testOnly = false) {
    let hit = false;
    const T = this.terrain;
    if (this.dungeon) {
      const res = this.dungeon.resolve(x, z, r, ox, oz);
      return res;
    }
    // world bounds
    const lim = T.half - 5;
    if (x > lim) { x = lim; hit = true; } if (x < -lim) { x = -lim; hit = true; }
    if (z > lim) { z = lim; hit = true; } if (z < -lim) { z = -lim; hit = true; }
    // static colliders
    for (let iter = 0; iter < 2; iter++) {
      const cx = Math.floor(x / CELL), cz = Math.floor(z / CELL);
      for (let i = cx - 1; i <= cx + 1; i++) for (let j = cz - 1; j <= cz + 1; j++) {
        const arr = this.grid.get(this.key(i, j)); if (!arr) continue;
        for (const c of arr) {
          if (c.t === 0) {
            const dx = x - c.x, dz = z - c.z, rr = r + c.r;
            const d2 = dx * dx + dz * dz;
            if (d2 < rr * rr) {
              hit = true; const d = Math.sqrt(d2) || 0.001;
              x = c.x + dx / d * rr; z = c.z + dz / d * rr;
            }
          } else {
            const dx = x - c.x, dz = z - c.z;
            const lx = dx * c.cos - dz * c.sin, lz = dx * c.sin + dz * c.cos;
            const qx = clamp(lx, -c.hw, c.hw), qz = clamp(lz, -c.hd, c.hd);
            let ex = lx - qx, ez = lz - qz;
            let d2 = ex * ex + ez * ez;
            if (d2 < r * r) {
              hit = true;
              let nlx, nlz;
              if (d2 < 1e-6) {
                // inside the box: push out along the smallest axis
                const px = c.hw - Math.abs(lx), pz = c.hd - Math.abs(lz);
                if (px < pz) { nlx = Math.sign(lx || 1) * (c.hw + r); nlz = lz; } else { nlx = lx; nlz = Math.sign(lz || 1) * (c.hd + r); }
              } else {
                const d = Math.sqrt(d2);
                nlx = qx + ex / d * r; nlz = qz + ez / d * r;
              }
              x = c.x + nlx * c.cos + nlz * c.sin; z = c.z - nlx * c.sin + nlz * c.cos;
            }
          }
        }
      }
    }
    // steep slopes / lava
    if (!testOnly && unit) {
      const h0 = T.heightAt(ox, oz), h1 = T.heightAt(x, z);
      const dd = Math.hypot(x - ox, z - oz) || 0.001;
      const onBridge = this.bridgeAt(x, z) != null;
      if (!onBridge && (h1 - h0) / dd > 1.25 && h1 > (this.waterLevel ?? -99) + 1) { hit = true; x = ox; z = oz; }
    }
    return { x, z, hit };
  }
  bridgeAt(x, z) {
    for (const b of this.bridges) {
      const dx = x - b.x, dz = z - b.z;
      const c = Math.cos(b.rot), s = Math.sin(b.rot);
      const lx = dx * c - dz * s, lz = dx * s + dz * c;
      if (Math.abs(lx) < b.hw && Math.abs(lz) < b.hl) return b.y;
    }
    return null;
  }
  heightAt(x, z) { return this.dungeon ? this.dungeon.floorAt(x, z) : (this.terrain ? this.terrain.heightAt(x, z) : 0); }
  groundAt(x, z) {
    if (this.dungeon) return this.dungeon.floorAt(x, z);
    const h = this.terrain.heightAt(x, z);
    const b = this.bridgeAt(x, z);
    return b != null ? Math.max(h, b) : h;
  }

  // ------------------------------------------------------------ units
  addUnit(u) {
    if (this.units.includes(u)) return u;
    this.units.push(u);
    this.root.add(u.group);
    u.pos.y = this.groundAt(u.pos.x, u.pos.z);
    u.group.position.copy(u.pos);
    return u;
  }
  removeUnit(u, destroy = true) {
    const i = this.units.indexOf(u);
    if (i >= 0) this.units.splice(i, 1);
    if (destroy) u.destroy(); else u.group.removeFromParent();
  }
  unitsNear(x, z, r, filter) {
    const out = [], r2 = r * r;
    for (const u of this.units) {
      if (u.removed) continue;
      const dx = u.pos.x - x, dz = u.pos.z - z;
      if (dx * dx + dz * dz <= r2 && (!filter || filter(u))) out.push(u);
    }
    return out;
  }
  nearestEnemy(src, r, extra) {
    let best = null, bd = r * r;
    for (const u of this.units) {
      if (u.dead || !src.isEnemy(u) || u.hasFlag('stealth') && src.kind !== 'player' && src.distTo(u) > 3) continue;
      if (extra && !extra(u)) continue;
      const d = distSq2(src.pos.x, src.pos.z, u.pos.x, u.pos.z);
      if (d < bd) { bd = d; best = u; }
    }
    return best;
  }

  // ------------------------------------------------------------ update
  update(dt) {
    U.time.value = G.time;
    const p = G.player;
    const fx = p ? p.pos.x : 0, fz = p ? p.pos.z : 0;
    const R2 = this.activeR * this.activeR;
    for (let i = this.units.length - 1; i >= 0; i--) {
      const u = this.units[i];
      if (u.removed) { this.units.splice(i, 1); continue; }
      const d2 = distSq2(u.pos.x, u.pos.z, fx, fz);
      const active = d2 < R2 || u.kind === 'player' || u.kind === 'bot' && u.inParty || u.isBoss || u.owner === p;
      u.group.visible = active && u.visible !== false;
      if (!active && !u.alwaysUpdate) continue;
      if (u.ai && !u.dead) u.ai.update(dt);
      u.update(dt);
    }
    // soft separation among nearby living units (not the player against monsters too strongly)
    this.separate(dt);
    // spawners
    for (const sp of this.spawners) sp.update?.(dt);
    // gather nodes
    for (const n of this.nodes) n.update?.(dt);
    // hide small props far away
    if (this.props && this.terrain && (this._propT = (this._propT || 0) - dt) <= 0) {
      this._propT = 0.5;
      const lim = (G.engine.q.far * 0.42) ** 2;
      for (const im of this.props.children) {
        if (!im.userData.small) continue;
        const c = im.boundingSphere?.center; if (!c) continue;
        im.visible = distSq2(c.x, c.z, fx, fz) < lim + im.boundingSphere.radius ** 2;
      }
    }
    // emissive windows brighter at night
    if (this.glowMesh) {
      const d = G.engine.daylight ?? 1;
      this.glowMesh.material.color.setScalar(0.55 + (1 - d) * 0.9);
    }
    if (this.water?.userData.setLight) this.water.userData.setLight(G.engine.sun.position.clone().sub(G.engine.sun.target.position).normalize(), 0.45 + 0.55 * (G.engine.daylight ?? 1));
  }

  separate(dt) {
    const us = this.units;
    for (let i = 0; i < us.length; i++) {
      const a = us[i]; if (a.dead || !a.group.visible || a.kind === 'npc' || a.kind === 'critter') continue;
      for (let j = i + 1; j < us.length; j++) {
        const b = us[j]; if (b.dead || !b.group.visible || b.kind === 'npc' || b.kind === 'critter') continue;
        const dx = b.pos.x - a.pos.x, dz = b.pos.z - a.pos.z;
        const rr = (a.radius + b.radius) * 0.8;
        const d2 = dx * dx + dz * dz;
        if (d2 < rr * rr && d2 > 1e-5) {
          const d = Math.sqrt(d2), push = (rr - d) * 0.5 * Math.min(1, dt * 10);
          const nx = dx / d, nz = dz / d;
          const wa = a.kind === 'player' ? 0.15 : (a.isBoss ? 0.05 : 1), wb = b.kind === 'player' ? 0.15 : (b.isBoss ? 0.05 : 1);
          a.step(-nx * push * wa, -nz * push * wa); b.step(nx * push * wb, nz * push * wb);
        }
      }
    }
  }
}

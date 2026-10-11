// Instanced dungeons: procedural interior layouts, themed geometry, packs, bosses, finder UI.
import * as THREE from 'three';
import { G, emit, on } from '../core/state.js';
import { L, t } from '../core/i18n.js';
import { rng, rand, randi, choice, clamp, distSq2, shadeHex, mixHex, Heap, fmtTime } from '../core/util.js';
import { S, xpNeed } from '../data/classes.js';
import { Builder, box, cyl, cone, octa, dodeca, jitter, ico, torus, sphere } from '../gfx/geom.js';
import { lambert, basic } from '../gfx/materials.js';
import { Assets } from '../gfx/assets.js';
import { bake, appendBaked } from '../gfx/envmodels.js';
import { spawnMonster } from './factory.js';
import { genEquip, makeStack } from './items.js';
import { h, UI, icon, uiIcon } from '../ui/ui.js';
import { iconURL, ICON_THEMES } from '../gfx/icons.js';
import { ZONES } from '../data/zones.js';
import { Audio } from '../audio.js';

export const DUNGEONS = {
  d_goblin: { name: 'Goblin Mağarası|Goblin Warren', zone: 'vale', lvl: [8, 12], theme: 'cave', rooms: 6, boss: 'grukk', packs: [['goblin', 'goblin_spear', 'goblin'], ['goblin_brute', 'goblin'], ['cave_bat', 'cave_bat', 'cave_bat'], ['goblin_shaman', 'goblin', 'goblin_spear']], desc: 'Goblin Kral Grukk\'un çaldığı kristal parçasını sakladığı yeraltı inleri.|The underground warrens where Goblin King Grukk hoards the stolen crystal shard.' },
  d_spider: { name: 'Örümcek Yuvası|The Brood Den', zone: 'forest', lvl: [18, 22], theme: 'web', rooms: 7, boss: 'zeyra', packs: [['broodling', 'broodling', 'broodling', 'spider_giant'], ['spider_weaver', 'spider_giant'], ['spider_giant', 'spider_giant']], desc: 'Kraliçe Zeyra\'nın yozlaşmış yavrularıyla dolu ağlarla kaplı mağaralar.|Web-choked caverns teeming with Broodmother Zeyra\'s corrupted spawn.' },
  d_pyramid: { name: 'Kayıp Piramit|The Lost Pyramid', zone: 'desert', lvl: [28, 32], theme: 'tomb', rooms: 7, boss: 'anuket', packs: [['mummy', 'scarab_beetle', 'scarab_beetle'], ['tomb_guard', 'mummy'], ['mummy', 'mummy', 'cultist']], desc: 'Kumların altında yatan, uyanmış bir firavunun lanetli mezarı.|The cursed tomb of an awakened pharaoh, buried beneath the sands.' },
  d_frost: { name: 'Buzul Derinlikleri|Frozen Depths', zone: 'frost', lvl: [38, 42], theme: 'ice', rooms: 7, boss: 'frost_wyrm', packs: [['frost_dwarf', 'ice_elemental'], ['frost_bat', 'frost_bat', 'frost_dwarf'], ['ice_elemental', 'frost_dwarf', 'frost_dwarf']], desc: 'Buz ejderi Kryos\'un uyuduğu, cücelerin terk ettiği donmuş madenler.|Frozen mines abandoned by the dwarves, where the frost wyrm Kryos slumbers.' },
  d_molten: { name: 'Erimiş Kale|The Molten Citadel', zone: 'ember', lvl: [48, 52], theme: 'fire', rooms: 7, boss: 'infernus', packs: [['demon_guard', 'imp', 'imp'], ['fire_elemental', 'imp', 'demon_guard'], ['hellhound', 'hellhound', 'demon_guard']], desc: 'Zincirlerinden kurtulmuş iblis Infernus\'un lav kalesi.|The lava fortress of Infernus, a demon unbound from his chains.' },
  r_throne: { name: 'Gölge Tahtı (Baskın)|Throne of Shadows (Raid)', zone: 'shadow', lvl: [60, 60], theme: 'shadow', rooms: 9, raid: true, bosses: ['ossyrion', 'vorath', 'malakar'], packs: [['death_knight', 'wraith', 'wraith'], ['shadow_fiend', 'malakar_cultist', 'malakar_cultist'], ['void_eye', 'death_knight', 'ghoul', 'ghoul']], desc: 'Gölge Lordu Malakar\'ın tahtı. Aether Kristali\'nin son parçası burada.|The throne of Malakar the Shadow Lord. The final shard of the Aether Crystal lies here.' },
};
for (const id in DUNGEONS) DUNGEONS[id].id = id;

const THEMES = {
  cave: { floor: [0x5a4e42, 0x6a5e50], wall: [0x4a4038, 0x7a6e60], deco: 'stalag', glow: 0xff9a3a, fog: 0x14100c, light: 0xffc88a },
  web: { floor: [0x3a3230, 0x4a4038], wall: [0x2a2420, 0x5a4e48], deco: 'web', glow: 0xb86aff, fog: 0x100c10, light: 0xd8b0ff },
  tomb: { floor: [0xb89868, 0xc8a878], wall: [0xa88a5a, 0xd8b888], deco: 'pillar', glow: 0x6ad8ff, fog: 0x1a140c, light: 0xffe0a8 },
  ice: { floor: [0x8aa8c0, 0xa8c8e0], wall: [0x6a8aa8, 0xc8e8ff], deco: 'crystal', glow: 0x6ad8ff, fog: 0x0c1420, light: 0xc8e8ff },
  fire: { floor: [0x2a1e1c, 0x3a2a26], wall: [0x2a1a18, 0x5a3a30], deco: 'lava', glow: 0xff6a1a, fog: 0x1a0806, light: 0xffa060 },
  shadow: { floor: [0x2a2434, 0x3a3048], wall: [0x241e30, 0x4a3e60], deco: 'void', glow: 0xb86aff, fog: 0x0c0814, light: 0xc8a8ff },
};

// ------------------------------------------------------------ layout
// KayKit Dungeon Remastered (CC0) pieces, tinted per theme
const DKIT = 'env/dungeon.glb';
const KIT_TINT = { cave: 0xb8a890, web: 0x9a8c8a, tomb: 0xffe2b0, ice: 0xc4dcff, fire: 0x9a7a70, shadow: 0xa898c8 };

export class DungeonLayout {
  constructor(d, seed) {
    this.d = d; this.theme = THEMES[d.theme];
    const r = rng(seed);
    this.cell = 2; this.N = 72; this.size = this.N * this.cell; this.half = this.size / 2;
    const N = this.N;
    this.grid = new Uint8Array(N * N); // 0 wall, 1 floor
    const rooms = [];
    const nRooms = d.rooms || 6;
    let cx = 10, cz = N - 10;
    let dir = 0;
    for (let i = 0; i < nRooms; i++) {
      const boss = i === nRooms - 1 || (d.bosses && [Math.floor(nRooms / 3), Math.floor(nRooms * 2 / 3), nRooms - 1].includes(i));
      const w = boss ? 13 : r.int(7, 10), hgt = boss ? 13 : r.int(7, 10);
      const room = { x: clamp(cx, w / 2 + 2, N - w / 2 - 2), z: clamp(cz, hgt / 2 + 2, N - hgt / 2 - 2), w, h: hgt, boss, idx: i };
      rooms.push(room);
      this.carveRoom(room, r);
      // next room direction: snake across the map
      const step = r.int(14, 18);
      if (dir === 0) { cx += step; if (cx > N - 14) { dir = 1; cx = N - 12; } }
      else if (dir === 1) { cz -= step; dir = cx > N / 2 ? 2 : 0; }
      else { cx -= step; if (cx < 14) { dir = 1; cx = 12; } }
      if (dir === 1 && i % 2) cz -= 0;
    }
    for (let i = 1; i < rooms.length; i++) this.carveCorridor(rooms[i - 1], rooms[i], r);
    this.rooms = rooms;
    this.start = this.toWorld(rooms[0].x, rooms[0].z);
  }
  carveRoom(rm, r) {
    const N = this.N;
    const round = rm.boss || r() < 0.4;
    for (let j = Math.floor(rm.z - rm.h / 2); j <= Math.ceil(rm.z + rm.h / 2); j++) for (let i = Math.floor(rm.x - rm.w / 2); i <= Math.ceil(rm.x + rm.w / 2); i++) {
      if (i < 1 || j < 1 || i >= N - 1 || j >= N - 1) continue;
      if (round && ((i - rm.x) / (rm.w / 2 + 0.5)) ** 2 + ((j - rm.z) / (rm.h / 2 + 0.5)) ** 2 > 1) continue;
      this.grid[j * N + i] = 1;
    }
  }
  carveCorridor(a, b, r) {
    const N = this.N;
    let x = Math.round(a.x), z = Math.round(a.z);
    const tx = Math.round(b.x), tz = Math.round(b.z);
    const w = 1;
    const dig = (i, j) => { for (let dj = -w; dj <= w; dj++) for (let di = -w; di <= w; di++) { const ii = i + di, jj = j + dj; if (ii > 0 && jj > 0 && ii < N - 1 && jj < N - 1) this.grid[jj * N + ii] = 1; } };
    const xFirst = r() < 0.5;
    if (xFirst) { while (x !== tx) { dig(x, z); x += Math.sign(tx - x); } while (z !== tz) { dig(x, z); z += Math.sign(tz - z); } }
    else { while (z !== tz) { dig(x, z); z += Math.sign(tz - z); } while (x !== tx) { dig(x, z); x += Math.sign(tx - x); } }
    dig(x, z);
  }
  toWorld(i, j) { return { x: -this.half + (i + 0.5) * this.cell, z: -this.half + (j + 0.5) * this.cell }; }
  cellOf(x, z) { return [Math.floor((x + this.half) / this.cell), Math.floor((z + this.half) / this.cell)]; }
  isFloor(i, j) { return i >= 0 && j >= 0 && i < this.N && j < this.N && this.grid[j * this.N + i] === 1; }
  walkable(x, z) { const [i, j] = this.cellOf(x, z); return this.isFloor(i, j); }
  floorAt() { return 0; }
  randomFloor() { for (let k = 0; k < 200; k++) { const i = randi(1, this.N - 2), j = randi(1, this.N - 2); if (this.isFloor(i, j) && this.isFloor(i + 1, j) && this.isFloor(i, j + 1)) return this.toWorld(i, j); } return this.start; }
  resolve(x, z, r, ox, oz) {
    let hit = false;
    const c = this.cell;
    for (let it = 0; it < 2; it++) {
      const [ci, cj] = this.cellOf(x, z);
      for (let j = cj - 1; j <= cj + 1; j++) for (let i = ci - 1; i <= ci + 1; i++) {
        if (this.isFloor(i, j)) continue;
        const minx = -this.half + i * c, minz = -this.half + j * c;
        const qx = clamp(x, minx, minx + c), qz = clamp(z, minz, minz + c);
        const dx = x - qx, dz = z - qz, d2 = dx * dx + dz * dz;
        if (d2 < r * r) {
          hit = true;
          if (d2 < 1e-6) { x = ox; z = oz; continue; }
          const d = Math.sqrt(d2); x = qx + dx / d * r; z = qz + dz / d * r;
        }
      }
    }
    return { x, z, hit };
  }
  findPath(sx, sz, tx, tz) {
    const N = this.N;
    const [si, sj] = this.cellOf(sx, sz), [ti, tj] = this.cellOf(tx, tz);
    if (!this.isFloor(ti, tj)) return [{ x: tx, z: tz }];
    const from = new Int32Array(N * N).fill(-1), g = new Float32Array(N * N).fill(1e9), closed = new Uint8Array(N * N);
    const heap = new Heap(n => n.f); const s = sj * N + si, goal = tj * N + ti;
    g[s] = 0; heap.push({ k: s, f: 0 });
    while (heap.size) {
      const { k } = heap.pop(); if (closed[k]) continue; closed[k] = 1; if (k === goal) break;
      const i = k % N, j = (k / N) | 0;
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const a = i + di, b = j + dj; if (!this.isFloor(a, b)) continue; const nk = b * N + a;
        if (g[k] + 1 < g[nk]) { g[nk] = g[k] + 1; from[nk] = k; heap.push({ k: nk, f: g[nk] + Math.abs(a - ti) + Math.abs(b - tj) }); }
      }
    }
    const pts = []; for (let k = goal; k !== -1 && k !== s; k = from[k]) pts.push(this.toWorld(k % N, (k / N) | 0));
    pts.reverse(); return pts.filter((_, i) => i % 3 === 2 || i === pts.length - 1);
  }
  // ------------------------------------------------------------ geometry
  build(root) {
    const N = this.N, c = this.cell, T = this.theme;
    const r = rng(7);
    const fb = new Builder(3), wb = new Builder(4), gb = new Builder(5);
    const kit = Assets.isLoaded(DKIT);
    const mul = KIT_TINT[this.d.theme] ?? null;
    const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), UP = new THREE.Vector3(0, 1, 0), V = new THREE.Vector3(), S = new THREE.Vector3();
    const put = (target, name, x, y, z, rot = 0, sx = 1, sy = sx, sz = sx) => {
      const bk = bake(DKIT, name); if (!bk) return false;
      Q.setFromAxisAngle(UP, rot); M.compose(V.set(x, y, z), Q, S.set(sx, sy, sz));
      appendBaked(target, bk, M, mul); return true;
    };
    const FLOORS = this.d.theme === 'cave' || this.d.theme === 'web' ? ['floor_dirt_large', 'floor_dirt_large_rocky'] : this.d.theme === 'ice' ? ['floor_tile_large', 'floor_tile_small'] : ['floor_tile_small', 'floor_tile_small', 'floor_tile_small', 'floor_tile_small_broken_a', 'floor_tile_small_decorated', 'floor_tile_small_weeds_a'];
    // floor: one kit tile per 2x2 cell
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      if (!this.isFloor(i, j)) continue;
      const p = this.toWorld(i, j);
      if (kit) {
        const name = FLOORS[Math.floor(r() * FLOORS.length)];
        const big = /large/.test(name);
        put(fb, name, p.x, -0.15, p.z, Math.floor(r() * 4) * Math.PI / 2, big ? 0.5 : 1, 1, big ? 0.5 : 1);
      } else fb.add(box(c, 0.2, c), { p: [p.x, -0.1, p.z], color: mixHex(T.floor[0], T.floor[1], r()), shade: 0.04 });
    }
    // walls: a 2m kit segment on every floor/wall edge, its inner face flush with the edge
    const H = 3.6;
    const WALLS = ['wall_half', 'wall_half', 'wall_half', 'wall_half'];
    const corners = new Map();
    const torchSpots = [];
    if (kit) {
      for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
        if (!this.isFloor(i, j)) continue;
        const p = this.toWorld(i, j);
        for (const [di, dj, rot] of [[0, -1, 0], [1, 0, -Math.PI / 2], [0, 1, Math.PI], [-1, 0, Math.PI / 2]]) {
          if (this.isFloor(i + di, j + dj)) continue;
          // edge midpoint, pushed outward by half the wall thickness
          const ex = p.x + di * (c / 2 + 0.5), ez = p.z + dj * (c / 2 + 0.5);
          // wall_half spans local x 0..2; centre it on the edge
          const ax = Math.cos(rot), az = -Math.sin(rot);
          put(wb, WALLS[(i * 7 + j * 13) % WALLS.length], ex - ax * 1, 0, ez - az * 1, rot, 1, 1.05, 1);
          // corner posts where edges meet
          for (const sgn of [-1, 1]) {
            const vx = p.x + di * c / 2 + ax * sgn * c / 2, vz = p.z + dj * c / 2 + az * sgn * c / 2;
            const k = Math.round(vx * 2) + ',' + Math.round(vz * 2);
            corners.set(k, (corners.get(k) || 0) + 1);
          }
          if ((i * 31 + j * 17 + di * 5 + dj * 3) % 11 === 0) torchSpots.push({ x: p.x + di * (c / 2 - 0.05), z: p.z + dj * (c / 2 - 0.05), rot });
        }
      }
      for (const [k, n] of corners) { if (n < 2) continue; const [x2, z2] = k.split(',').map(Number); put(wb, 'column', x2 / 2, 0, z2 / 2, 0, 1.15, 2.9, 1.15); }
      // wall torches (the flame itself is an unlit glow sprite so it reads in the dark)
      for (const t of torchSpots) {
        put(wb, 'torch_mounted', t.x, 1.9, t.z, t.rot + Math.PI);
        gb.add(cone(0.16, 0.42, 5), { p: [t.x - Math.sin(t.rot + Math.PI) * 0.0, 2.95, t.z], color: T.glow, shade: 0 });
      }
    } else {
      for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
        if (this.isFloor(i, j)) continue;
        let touch = false;
        for (let dj = -1; dj <= 1 && !touch; dj++) for (let di = -1; di <= 1; di++) if (this.isFloor(i + di, j + dj)) { touch = true; break; }
        if (!touch) continue;
        const p = this.toWorld(i, j);
        const hh = H + r() * 1.2;
        wb.add(box(c, hh, c), { p: [p.x, hh / 2, p.z], color: [T.wall[0], T.wall[1]], shade: 0.06 });
      }
    }
    // decorations
    const PROPS = ['barrel_large', 'barrel_small_stack', 'crates_stacked', 'box_stacked', 'keg', 'trunk_large_a', 'rubble_half', 'sword_shield', 'candle_triple', 'coin_stack_medium'];
    for (const rm of this.rooms) {
      const ctr = this.toWorld(rm.x, rm.z);
      const n = rm.boss ? 8 : 4;
      if (!kit) for (let k = 0; k < n; k++) {
        const a = k / n * Math.PI * 2;
        const rr = Math.min(rm.w, rm.h) * c * 0.5 - 1.2;
        const x = ctr.x + Math.cos(a) * rr, z = ctr.z + Math.sin(a) * rr;
        if (!this.walkable(x, z)) continue;
        wb.add(cyl(0.08, 0.1, 2.4, 5), { p: [x, 1.2, z], color: 0x3a2a1a });
        gb.add(cone(0.22, 0.5, 5), { p: [x, 2.6, z], color: T.glow, shade: 0 });
      }
      if (kit) {
        // clutter hugging the walls of each room
        for (let k = 0; k < (rm.boss ? 4 : 6); k++) {
          const a = r() * Math.PI * 2, rr = Math.min(rm.w, rm.h) * c * 0.5 - 1.4;
          const x = ctr.x + Math.cos(a) * rr, z = ctr.z + Math.sin(a) * rr;
          if (!this.walkable(x, z) || !this.walkable(x + 1, z) || !this.walkable(x - 1, z)) continue;
          const name = PROPS[Math.floor(r() * PROPS.length)];
          put(wb, name, x, 0, z, r() * Math.PI * 2, /stack|crates|rubble/.test(name) ? 0.6 : 0.7);
        }
        // boss room: pillars around the arena
        if (rm.boss) for (let k = 0; k < 6; k++) {
          const a = k / 6 * Math.PI * 2, rr = Math.min(rm.w, rm.h) * c * 0.5 - 2.2;
          const x = ctr.x + Math.cos(a) * rr, z = ctr.z + Math.sin(a) * rr;
          if (this.walkable(x, z)) put(wb, 'pillar_decorated', x, 0, z, -a, 0.8);
        }
      }
      for (let k = 0; k < (rm.boss ? 6 : 3); k++) {
        const x = ctr.x + rand(-rm.w * 0.7, rm.w * 0.7), z = ctr.z + rand(-rm.h * 0.7, rm.h * 0.7);
        if (!this.walkable(x, z) || distSq2(x, z, ctr.x, ctr.z) < 16) continue;
        if (T.deco === 'stalag') wb.add(jitter(cone(0.5, 2 + r() * 2, 5), 0.2, k), { p: [x, 1.2, z], color: T.wall });
        else if (T.deco === 'web') { wb.add(torus(1.2, 0.04, 3, 10), { p: [x, 2.5, z], r: [r(), r(), 0], color: 0xe8e8f0 }); wb.add(dodeca(0.4), { p: [x, 0.3, z], color: 0xe8e0d0 }); }
        else if (T.deco === 'pillar') { if (!kit || !put(wb, 'pillar', x, 0, z, r() * 3, 0.7)) wb.add(cyl(0.5, 0.55, 4, 8), { p: [x, 2, z], color: [0xb89868, 0xe8c898] }); }
        else if (T.deco === 'crystal') gb.add(octa(0.5), { p: [x, 1, z], s: [1, 2.5, 1], color: 0x8ae8ff, shade: 0.1 });
        else if (T.deco === 'lava') gb.add(box(1.5, 0.05, 1.5), { p: [x, 0.02, z], color: 0xff5a1a, shade: 0 });
        else gb.add(octa(0.4), { p: [x, 1.5, z], s: [1, 2, 1], color: 0xb86aff, shade: 0.1 });
      }
      // boss room: rune circle
      if (rm.boss) gb.add(torus(5, 0.12, 3, 32), { p: [ctr.x, 0.05, ctr.z], r: [Math.PI / 2, 0, 0], color: T.glow, shade: 0 });
    }
    const floor = new THREE.Mesh(fb.build(), lambert('dfloor'));
    floor.receiveShadow = true;
    const walls = new THREE.Mesh(wb.build(), lambert('dwall'));
    walls.castShadow = true; walls.receiveShadow = true;
    const glow = new THREE.Mesh(gb.build(), basic('dglow', { toneMapped: false }));
    root.add(floor, walls, glow);
    this.floorMesh = floor;
    // flicker light following the player
    this.light = new THREE.PointLight(T.light, 30, 22, 1.6);
    root.add(this.light);
    // minimap
    const cv = document.createElement('canvas'); cv.width = cv.height = 288;
    const g = cv.getContext('2d'); g.fillStyle = '#0a080c'; g.fillRect(0, 0, 288, 288);
    const k = 288 / N;
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) if (this.isFloor(i, j)) { g.fillStyle = '#' + shadeHex(T.floor[1], 0.25).toString(16).padStart(6, '0'); g.fillRect(i * k, j * k, k + 0.5, k + 0.5); }
    this.mapCanvas = cv;
  }
  update(dt) {
    const p = G.player; if (!p || !this.light) return;
    this.light.position.set(p.pos.x, p.pos.y + 3.5, p.pos.z);
    this.light.intensity = 26 + Math.sin(G.time * 13) * 2 + Math.sin(G.time * 7.3) * 2;
  }
}

// ------------------------------------------------------------ manager
export const Dungeons = {
  current: null,
  list() { return Object.values(DUNGEONS); },
  name(id) { return DUNGEONS[id]?.name || id; },
  byBoss(m) { return Object.values(DUNGEONS).find(d => d.boss === m || d.bosses?.includes(m)); },
  entrance(dOrId) {
    const d = typeof dOrId === 'string' ? DUNGEONS[dOrId] : dOrId;
    const z = ZONES[d?.zone]; const e = z?.dungeons?.find(x => x.id === d.id);
    return e ? { x: e.x, z: e.z, zone: d.zone } : null;
  },
  unlocked(d) { const p = G.player; return p.level >= d.lvl[0] - 2; },
  def(zid) { return this.current && zid === this.current.zoneId ? this.current.def : null; },
  modeLevel(d, heroic) { const p = G.player; return heroic ? Math.max(60, p.level) + 2 : clamp(p.level, d.lvl[0], d.lvl[1]); },
  async enter(id, heroic = false) {
    const d = DUNGEONS[id]; const p = G.player;
    if (!d) return;
    if (p.inCombat) { G.ui.error(L('Savaştayken giremezsin|Cannot enter in combat')); return; }
    if (!this.unlocked(d)) { G.ui.error(L(`Seviye ${d.lvl[0] - 2} gerekli|Requires level ${d.lvl[0] - 2}`)); return; }
    if (heroic && p.level < 60) { G.ui.error(L('Kahramanlık modu 60. seviyede açılır|Heroic mode unlocks at level 60')); return; }
    const lvl = this.modeLevel(d, heroic);
    const layout = new DungeonLayout(d, randi(1, 1e6));
    const zoneId = 'dun:' + id;
    const T = THEMES[d.theme];
    const def = {
      id: zoneId, name: d.name + (heroic ? L(' (Kahramanlık)| (Heroic)') : ''), level: [lvl, lvl], music: 'dungeon', ambient: 'cave', dungeonLayout: layout, theme: d.theme, packs: d.packs, boss: d.boss, bosses: d.bosses,
      env: { indoor: true, sky: [T.fog, T.fog, T.fog], fog: T.fog, fogNear: 14, fogFar: 62, sun: T.light, sunI: 0.9, hemiSky: shadeHex(T.light, -0.35), hemiGround: T.fog, hemiI: 0.7, exposure: 1.15 },
      start: layout.start, exit: { x: layout.start.x - 2, z: layout.start.z },
    };
    this.current = { id, d, def, zoneId, heroic, lvl, layout, startT: G.time, returnTo: { zone: G.zones.current.dungeonLayout ? (G.char.zone || 'vale') : G.zones.current.id, x: p.pos.x, z: p.pos.z + 4 }, bossesLeft: (d.bosses || [d.boss]).length };
    // companions
    if (G.party.members().length < 4) G.party.recruitFor();
    await G.zones.enter(zoneId, layout.start);
    // camera suits interiors
    const c = G.engine.cam; c.minPitch = 0.65; c.pitch = Math.max(c.pitch, 0.9); c.maxDist = 22; c.tDist = Math.min(c.tDist, 16);
    this.populate();
    G.ui.banner(L(d.name), L(`Seviye ${lvl}|Level ${lvl}`) + (heroic ? ' · ' + L('Kahramanlık|Heroic') : ''), 3);
    G.chat.system(L('Zindana girdin. Yoldaşların seninle. Kırmızı alanlardan kaçınmayı unutma!|You entered the dungeon. Your companions are with you. Remember to avoid red areas!'), 'system');
    emit('dungeonEntered', id);
  },
  populate() {
    const cur = this.current; const lay = cur.layout, d = cur.d;
    const bosses = d.bosses ? [...d.bosses] : [d.boss];
    for (const rm of lay.rooms) {
      if (rm.idx === 0) continue;
      const ctr = lay.toWorld(rm.x, rm.z);
      if (rm.boss) {
        const id = bosses.shift(); if (!id) continue;
        const b = spawnMonster(id, cur.lvl + (d.raid ? 1 : 1), ctr.x, ctr.z, { hpMult: (d.raid ? 2.2 : 1.7) * (cur.heroic ? 1.4 : 1), dmgMult: cur.heroic ? 1.3 : 1 });
        b.data.leash = 60; b.data.dungeonBoss = true; b.yaw = Math.PI;
        if (bosses.length) b.data.miniBoss = true;
        continue;
      }
      const packs = rm.idx % 2 === 0 ? 2 : 1;
      for (let k = 0; k < packs; k++) {
        const pack = choice(d.packs);
        const px = ctr.x + rand(-rm.w * 0.4, rm.w * 0.4), pz = ctr.z + rand(-rm.h * 0.4, rm.h * 0.4);
        for (const m of pack) {
          let x = px + rand(-2.5, 2.5), z = pz + rand(-2.5, 2.5);
          if (!lay.walkable(x, z)) { x = ctr.x; z = ctr.z; }
          const u = spawnMonster(m, cur.lvl - (Math.random() < 0.3 ? 1 : 0), x, z, { elite: rm.idx >= lay.rooms.length - 2 && Math.random() < 0.25, hpMult: 1.6 * (cur.heroic ? 1.3 : 1), dmgMult: 1.45 * (cur.heroic ? 1.3 : 1) });
          if (u) { u.ai.tpl = { ...u.ai.tpl, social: 12 }; u.data.wanderR = 2; }
        }
      }
    }
  },
  update(dt) {
    const cur = this.current; if (!cur || G.zones.current?.id !== cur.zoneId) return;
    cur.layout.update(dt);
    // player death handling: companion healer resurrects after combat
    const p = G.player;
    if (p.dead) {
      const healer = G.party.members().find(m => m.role === 'healer' && !m.dead);
      const fighting = G.world.units.some(u => u.kind === 'monster' && !u.dead && u.inCombat && u.threat?.size);
      cur.deadT = (cur.deadT || 0) + dt;
      if (healer && !fighting && cur.deadT > 3) { cur.deadT = 0; G.progress.revive(p, null, 0.6); G.chat.post(healer.name, L('Kalk bakalım, işimiz bitmedi!|Get up, we\'re not done yet!'), 'party', healer); }
      const allDead = G.party.members().every(m => m.dead);
      if (allDead && cur.deadT > 4) { this.wipe(); }
    } else cur.deadT = 0;
  },
  wipe() {
    const cur = this.current;
    G.ui.banner(L('Grup Yenildi|Party Wiped'), L('Girişte yeniden toplanıyorsunuz…|Regrouping at the entrance…'), 3);
    for (const u of [G.player, ...G.party.members()]) G.progress.revive(u, { x: cur.layout.start.x + rand(-2, 2), z: cur.layout.start.z + rand(-2, 2) }, 1);
    for (const m of G.world.units) if (m.kind === 'monster' && !m.dead) { m.threat.clear(); m.target = null; m.hp = m.stats.maxHp; if (m.ai) { m.ai.state = 'return'; } }
  },
  respawnPlayer() { const cur = this.current; G.progress.revive(G.player, cur.layout.start, 0.6); },
  onKill(u) {
    const cur = this.current; if (!cur || G.zones.current?.id !== cur.zoneId) return;
    if (!u.data.dungeonBoss) return;
    cur.bossesLeft--;
    if (cur.bossesLeft > 0) { G.ui.banner(L('Patron Yenildi!|Boss Defeated!'), u.name, 2.5); return; }
    // dungeon complete
    const ch = G.char, d = cur.d;
    const time = G.time - cur.startT;
    ch.dungeons = ch.dungeons || {};
    const rec = ch.dungeons[cur.id + (cur.heroic ? '_h' : '')] = ch.dungeons[cur.id + (cur.heroic ? '_h' : '')] || { clears: 0, best: 0 };
    rec.clears++; rec.best = rec.best ? Math.min(rec.best, time) : time;
    const firstWeekly = rec.week !== weekKey(); rec.week = weekKey();
    G.ui.banner(L('Zindan Tamamlandı!|Dungeon Complete!'), L(d.name) + '  ·  ' + fmtTime(time), 4);
    Audio.sfx('victory');
    const lvl = cur.lvl;
    G.progress.giveXp(Math.round(xpNeed(Math.min(G.player.level, 59)) * (d.raid ? 0.6 : 0.3)), null);
    G.progress.giveItem(makeStack('chest_dungeon', firstWeekly ? 2 : 1));
    G.progress.giveItem(makeStack('token_valor', (d.raid ? 30 : 10) * (cur.heroic ? 2 : 1)));
    if (firstWeekly) G.ui.toast('gift', L('Haftalık ilk tamamlama bonusu!|Weekly first-clear bonus!'), '#ffd660');
    // exit portal at the boss
    G.world.interactables.push({ kind: 'exit', x: u.pos.x + 3, z: u.pos.z, r: 3.5, h: 2, label: L('Çıkış|Exit'), icon: 'portal', action: () => this.leave() });
    G.vfx?.pillar({ x: u.pos.x + 3, z: u.pos.z }, 0xb86aff, 2);
    emit('dungeonCleared', cur.id, { heroic: cur.heroic, time, raid: d.raid });
  },
  async leave() {
    const cur = this.current; if (!cur) return;
    const back = cur.returnTo;
    this.current = null;
    const c = G.engine.cam; c.minPitch = 0.12; c.maxDist = 34;
    for (const m of [...G.party.members()]) if (m.title && !m._keep) G.party.remove(m, true);
    G.party.disband(true);
    await G.zones.enter(back.zone, { x: back.x, z: back.z });
  },
};
const weekKey = () => { const d = new Date(); const j = new Date(d.getFullYear(), 0, 1); return d.getFullYear() + '-' + Math.ceil(((d - j) / 864e5 + j.getDay() + 1) / 7); };
G.dungeons = Dungeons;
G.addSystem(dt => Dungeons.update(dt));
on('killed', u => Dungeons.onKill(u));

// ------------------------------------------------------------ dungeon finder
UI.register('dungeon', {
  title: () => t('menuDungeon'), icon: 'dungeon', w: 560,
  build(w, focus) {
    const p = G.player, ch = G.char;
    w.body.append(h('div.muted', { style: { fontSize: '12.5px', marginBottom: '8px' } }, L('Zindanlara istediğin zaman girebilirsin: eksik roller (tank, şifacı, hasar) yapay zekâ yoldaşlarla doldurulur. Grubundaki maceracılar seninle gelir.|Enter dungeons any time: missing roles (tank, healer, damage) are filled with AI companions. Adventurers in your party come along.')));
    if (G.world.dungeon) w.body.append(h('button.btn.red', { style: { marginBottom: '10px' }, onclick: () => { UI.close('dungeon'); Dungeons.leave(); } }, L('Zindandan Ayrıl|Leave Dungeon')));
    for (const d of Object.values(DUNGEONS)) {
      const ok = Dungeons.unlocked(d);
      const rec = ch.dungeons?.[d.id];
      const recH = ch.dungeons?.[d.id + '_h'];
      const bossIcon = iconURL(d.raid ? 'skull_crown' : 'dungeon', { size: 64, ...(d.raid ? ICON_THEMES.shadow : ICON_THEMES.fire) });
      w.body.append(h('div.card' + (focus === d.id ? '.sel' : ''), { style: { marginBottom: '8px', opacity: ok ? 1 : 0.55 } },
        h('div.row', h('img.ico.l', { src: bossIcon }), h('div', { style: { flex: 1 } },
          h('div', { style: { fontWeight: 900, fontSize: '15px', color: d.raid ? '#d8a0ff' : '#ffe08a' } }, L(d.name)),
          h('div.muted', { style: { fontSize: '12px' } }, `${t('level')} ${d.lvl[0]}-${d.lvl[1]} · ${L(ZONES[d.zone]?.name || '')}` + (rec ? ' · ' + L('Tamamlama: |Clears: ') + rec.clears + ' · ' + L('En iyi: |Best: ') + fmtTime(rec.best) : ''))),
        ),
        h('div', { style: { fontSize: '12.5px', margin: '6px 0', color: 'var(--ink2)' } }, L(d.desc)),
        h('div.row.wrap',
          h('button.btn.primary' + (ok ? '' : '.disabled'), { onclick: () => { UI.close('dungeon'); Dungeons.enter(d.id, false); } }, L('Gir (Normal)|Enter (Normal)')),
          h('button.btn.red' + (p.level >= 60 ? '' : '.disabled'), { onclick: () => { UI.close('dungeon'); Dungeons.enter(d.id, true); } }, L('Kahramanlık (60+)|Heroic (60+)')),
          recH ? h('span.chip', L('Kahramanlık: |Heroic: ') + recH.clears) : null,
          !ok ? h('span.bad', L(`Seviye ${d.lvl[0] - 2} gerekli|Requires level ${d.lvl[0] - 2}`)) : null)));
    }
  },
});
UI.openDungeon = id => UI.open('dungeon', id);

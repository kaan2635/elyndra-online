// Heightfield terrain: generation from a zone definition, flat-shaded mesh,
// exact height queries, surface types, minimap rendering.
import * as THREE from 'three';
import { makeNoise } from '../core/noise.js';
import { clamp, lerp, smoothstep, rng, mixHex, shadeHex } from '../core/util.js';
import { lambert } from './materials.js';

// Terrain material: vertex colours + procedural detail (mottled ground, cobblestone plazas, dirt roads).
const terrainMats = {};
function terrainMaterial(surface) {
  if (terrainMats[surface]) return terrainMats[surface];
  const m = new THREE.MeshLambertMaterial({ vertexColors: true });
  const snow = surface === 'snow' ? 1 : 0, sand = surface === 'sand' ? 1 : 0;
  m.onBeforeCompile = sh => {
    sh.vertexShader = 'attribute vec2 surf;\nvarying vec2 vSurf;\nvarying vec3 vWP;\n' + sh.vertexShader.replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvSurf = surf; vWP = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = 'varying vec2 vSurf;\nvarying vec3 vWP;\n' + `
      float th(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float tn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(th(i), th(i + vec2(1, 0)), f.x), mix(th(i + vec2(0, 1)), th(i + vec2(1, 1)), f.x), f.y); }
    ` + sh.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
      {
        vec2 q = vWP.xz;
        float n1 = tn(q * 0.11), n2 = tn(q * 0.55 + 17.0), n3 = tn(q * 2.3 + 5.0);
        // mottled ground: large soft patches + fine grain
        float mott = 0.86 + 0.18 * n1 + 0.1 * n2 + 0.06 * n3;
        diffuseColor.rgb *= mix(mott, 0.94 + 0.06 * n2 + 0.05 * n3, ${snow.toFixed(1)});
        // grass blade streaks
        diffuseColor.rgb *= 1.0 - 0.07 * smoothstep(0.55, 0.95, tn(vec2(q.x * 6.0, q.y * 1.4) + n2 * 3.0)) * (1.0 - ${(snow + sand).toFixed(1)});
        // roads: packed dirt with pebbles and wheel ruts
        float road = smoothstep(0.25, 0.75, vSurf.x);
        float peb = smoothstep(0.78, 0.92, tn(q * 3.1 + 40.0));
        diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * (0.9 + 0.16 * n2) * (1.0 - 0.18 * peb) + vec3(0.03) * peb, road);
        // plazas: offset cobblestones with darker grout
        float pl = smoothstep(0.2, 0.6, vSurf.y);
        if (pl > 0.001) {
          vec2 g = q * vec2(0.85, 1.05);
          float row = floor(g.y);
          g.x += mod(row, 2.0) * 0.5 + (tn(vec2(row, 3.0)) - 0.5) * 0.3;
          vec2 id = floor(g), f = fract(g);
          float e = min(min(f.x, 1.0 - f.x) * 1.4, min(f.y, 1.0 - f.y));
          float grout = smoothstep(0.02, 0.12, e);
          float stone = 0.82 + 0.3 * th(id) + 0.08 * n3;
          vec3 cob = diffuseColor.rgb * stone * mix(0.5, 1.0, grout);
          diffuseColor.rgb = mix(diffuseColor.rgb, cob, pl);
        }
      }`);
  };
  m.customProgramCacheKey = () => 'terrain-' + surface;
  terrainMats[surface] = m;
  return m;
}

function segDist(px, pz, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az;
  const l2 = dx * dx + dz * dz;
  let t = l2 ? ((px - ax) * dx + (pz - az) * dz) / l2 : 0;
  t = clamp(t, 0, 1);
  const x = ax + dx * t - px, z = az + dz * t - pz;
  return Math.sqrt(x * x + z * z);
}
export function polyDist(px, pz, pts) {
  let d = Infinity;
  for (let i = 0; i < pts.length - 1; i++) d = Math.min(d, segDist(px, pz, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]));
  return d;
}

export class Terrain {
  constructor(def) {
    this.def = def;
    const T = def;
    this.size = T.size; this.half = T.size / 2; this.res = T.res; this.cell = T.size / T.res;
    this.water = T.water ?? -999;
    this.lava = !!T.lava;
    const N = this.res, W = N + 1;
    this.H = new Float32Array(W * W);
    this.road = new Float32Array(W * W);
    this.plaza = new Float32Array(W * W);
    const nz = makeNoise(T.seed || 1);
    this.noise = nz;
    const roads = T.roads || [], rivers = T.rivers || [], feats = T.features || [];

    for (let j = 0; j <= N; j++) {
      for (let i = 0; i <= N; i++) {
        const x = -this.half + i * this.cell, z = -this.half + j * this.cell;
        // macro + detail
        let macro = (T.base || 0) + nz.fbm(x * (T.scale || 0.01), z * (T.scale || 0.01), 4) * (T.amp ?? 6);
        if (T.ridgeAmp) macro += (nz.ridged(x * (T.ridgeScale || 0.01) + 50, z * (T.ridgeScale || 0.01) - 30, 4) - 0.5) * T.ridgeAmp;
        let detail = nz.fbm(x * (T.detailScale || 0.06) + 100, z * (T.detailScale || 0.06) + 100, 3) * (T.detailAmp ?? 1.2);
        // roads: flatten detail, slightly sink
        let rf = 0;
        for (const r of roads) { const d = polyDist(x, z, r.pts); rf = Math.max(rf, 1 - smoothstep(r.w * 0.5, r.w * 0.5 + 3.5, d)); }
        let pf = 0;
        let h = macro + detail * (1 - rf * 0.85);
        h -= rf * 0.15;
        for (const f of feats) {
          const d = Math.hypot(x - f.x, z - f.z);
          if (f.t === 'flat') {
            const k = 1 - smoothstep(f.r, f.r + (f.edge ?? 10), d);
            h = lerp(h, f.h, k);
            if (f.plaza) pf = Math.max(pf, 1 - smoothstep(f.plaza * 0.7, f.plaza, d));
          } else if (f.t === 'hill') {
            const k = 1 - smoothstep(0, f.r, d); h += f.h * k * k * (3 - 2 * k);
          } else if (f.t === 'mesa') {
            const k = 1 - smoothstep(f.r * 0.8, f.r, d); h = lerp(h, Math.max(h, f.h + detail * 0.3), k);
          } else if (f.t === 'lake') {
            const k = 1 - smoothstep(f.r * 0.45, f.r, d); h = lerp(h, this.water - (f.depth ?? 3), k);
          } else if (f.t === 'crater') {
            const k = 1 - smoothstep(0, f.r, d); const rim = Math.exp(-Math.pow((d - f.r) / (f.r * 0.25), 2));
            h += rim * (f.rim ?? 3) - k * (f.depth ?? 4);
          }
        }
        // keep roads dry: raise low ground under a road above the water line (rivers still cut through below)
        if (rf > 0 && h < this.water + 0.6) h = lerp(h, this.water + 0.6, smoothstep(0, 0.6, rf));
        for (const r of rivers) {
          const d = polyDist(x, z, r.pts);
          const k = 1 - smoothstep(r.w * 0.35, r.w * 0.5 + 4, d);
          h = lerp(h, this.water - (r.depth ?? 2), k);
          rf *= 1 - k;
        }
        // border wall: mountains / cliffs around the playable area
        const bd = Math.max(Math.abs(x), Math.abs(z)) / this.half;
        const bs = T.borderStart ?? 0.84;
        if (bd > bs) {
          const k = smoothstep(bs, 1.0, bd);
          const bn = 0.6 + 0.4 * nz.ridged(x * 0.03, z * 0.03, 3);
          h += k * k * (T.borderH ?? 30) * bn;
        }
        const idx = j * W + i;
        this.H[idx] = h; this.road[idx] = rf; this.plaza[idx] = pf;
      }
    }
    // re-flatten exact plateaus so towns are perfectly walkable
    this.buildMesh();
  }

  idx(i, j) { return j * (this.res + 1) + i; }
  vh(i, j) { const N = this.res; i = clamp(i, 0, N); j = clamp(j, 0, N); return this.H[j * (N + 1) + i]; }

  // exact height on the triangulated mesh
  heightAt(x, z) {
    const fx = (x + this.half) / this.cell, fz = (z + this.half) / this.cell;
    let i = Math.floor(fx), j = Math.floor(fz);
    if (i < 0 || j < 0 || i >= this.res || j >= this.res) return this.vh(clamp(Math.round(fx), 0, this.res), clamp(Math.round(fz), 0, this.res));
    const u = fx - i, v = fz - j;
    const h00 = this.vh(i, j), h10 = this.vh(i + 1, j), h01 = this.vh(i, j + 1), h11 = this.vh(i + 1, j + 1);
    const alt = (i + j) & 1;
    if (!alt) { // diagonal from (0,0) to (1,1)
      if (u >= v) return h00 + (h10 - h00) * u + (h11 - h10) * v;
      return h00 + (h11 - h01) * u + (h01 - h00) * v;
    } else { // diagonal from (1,0) to (0,1)
      if (u + v <= 1) return h00 + (h10 - h00) * u + (h01 - h00) * v;
      return h11 + (h01 - h11) * (1 - u) + (h10 - h11) * (1 - v);
    }
  }
  slopeAt(x, z) {
    const e = 1.2;
    const dx = this.heightAt(x + e, z) - this.heightAt(x - e, z);
    const dz = this.heightAt(x, z + e) - this.heightAt(x, z - e);
    return Math.sqrt(dx * dx + dz * dz) / (2 * e);
  }
  roadAt(x, z) {
    const i = clamp(Math.round((x + this.half) / this.cell), 0, this.res), j = clamp(Math.round((z + this.half) / this.cell), 0, this.res);
    return this.road[this.idx(i, j)];
  }
  plazaAt(x, z) {
    const i = clamp(Math.round((x + this.half) / this.cell), 0, this.res), j = clamp(Math.round((z + this.half) / this.cell), 0, this.res);
    return this.plaza[this.idx(i, j)];
  }
  isWater(x, z) { return this.heightAt(x, z) < this.water - 0.05; }
  surfaceAt(x, z) {
    const h = this.heightAt(x, z);
    if (h < this.water - 0.3) return 'water';
    if (this.plazaAt(x, z) > 0.4) return 'stone';
    const s = this.def.surface || 'grass';
    if (this.roadAt(x, z) > 0.5) return s === 'snow' ? 'snow' : (s === 'sand' ? 'sand' : 'stone');
    if (this.def.snowLine != null && h > this.def.snowLine) return 'snow';
    if (h < this.water + 0.6) return 'sand';
    return s;
  }

  faceColor(cx, cz, h, ny, vertex = false) {
    const T = this.def, P = T.palette, nz = this.noise;
    const n1 = nz.n2(cx * 0.045, cz * 0.045), n2 = nz.n2(cx * 0.13 + 40, cz * 0.13 - 20);
    const slope = 1 - ny;
    const ri = clamp(Math.round((cx + this.half) / this.cell), 0, this.res), rj = clamp(Math.round((cz + this.half) / this.cell), 0, this.res);
    const rf = this.road[this.idx(ri, rj)], pf = this.plaza[this.idx(ri, rj)];
    let c;
    // base ground: blend of grass tones via noise
    const g = P.ground;
    const t = clamp(n1 * 0.5 + 0.5, 0, 1);
    c = t < 0.5 ? mixHex(g[0], g[1], t * 2) : mixHex(g[1], g[2], (t - 0.5) * 2);
    if (P.patch && n2 > 0.45) c = mixHex(c, P.patch, clamp((n2 - 0.45) * 3, 0, 0.85));
    if (T.snowLine != null && h > T.snowLine + n1 * 2) c = mixHex(c, P.snow, clamp((h - T.snowLine) / 3, 0.4, 1));
    if (slope > 0.32) c = mixHex(c, P.rock, smoothstep(0.32, 0.5, slope));
    if (h < this.water + 0.7) c = mixHex(c, P.shore ?? P.sand, smoothstep(this.water + 0.7, this.water + 0.1, h));
    if (h < this.water - 0.2) c = mixHex(P.shore ?? P.sand, P.under ?? 0x4a5a40, smoothstep(this.water - 0.2, this.water - 2.5, h));
    if (rf > 0.25) c = mixHex(c, P.road, smoothstep(0.25, 0.7, rf) * 0.95);
    if (pf > 0.2) {
      // cobblestone pattern
      const k = vertex ? 0 : ((Math.floor(cx / 2.5) + Math.floor(cz / 2.5)) & 1) ? 0.05 : -0.04;
      c = mixHex(c, shadeHex(P.plaza, k), smoothstep(0.2, 0.6, pf));
    }
    return c;
  }

  buildMesh() {
    // Indexed grid with per-vertex colours and smooth normals; fine detail (grass mottling,
    // cobblestones, dirt) is added in the fragment shader from world position.
    const N = this.res, cell = this.cell, half = this.half, W = N + 1;
    const pos = new Float32Array(W * W * 3), col = new Float32Array(W * W * 3), surf = new Float32Array(W * W * 2);
    const r = rng(this.def.seed * 7 + 3);
    const cA = new THREE.Color();
    for (let j = 0; j <= N; j++) for (let i = 0; i <= N; i++) {
      const k = j * W + i, x = -half + i * cell, z = -half + j * cell, h = this.vh(i, j);
      pos[k * 3] = x; pos[k * 3 + 1] = h; pos[k * 3 + 2] = z;
      // slope from neighbours
      const hx = this.vh(Math.min(N, i + 1), j) - this.vh(Math.max(0, i - 1), j), hz = this.vh(i, Math.min(N, j + 1)) - this.vh(i, Math.max(0, j - 1));
      const ny = 1 / Math.sqrt(1 + (hx * hx + hz * hz) / (4 * cell * cell));
      cA.setHex(this.faceColor(x, z, h, ny, true));
      const kk = 0.97 + r() * 0.06;
      col[k * 3] = cA.r * kk; col[k * 3 + 1] = cA.g * kk; col[k * 3 + 2] = cA.b * kk;
      surf[k * 2] = this.road[this.idx(i, j)]; surf[k * 2 + 1] = this.plaza[this.idx(i, j)];
    }
    const idx = new Uint32Array(N * N * 6); let p = 0;
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const a = j * W + i, b = (j + 1) * W + i, c = (j + 1) * W + i + 1, d = j * W + i + 1;
      // same diagonal pattern as heightAt()
      if (!((i + j) & 1)) { idx[p++] = a; idx[p++] = b; idx[p++] = c; idx[p++] = a; idx[p++] = c; idx[p++] = d; }
      else { idx[p++] = a; idx[p++] = b; idx[p++] = d; idx[p++] = d; idx[p++] = b; idx[p++] = c; }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.setAttribute('surf', new THREE.BufferAttribute(surf, 2));
    g.setIndex(new THREE.BufferAttribute(idx, 1));
    g.computeVertexNormals();
    g.computeBoundingSphere();
    this.mesh = new THREE.Mesh(g, terrainMaterial(this.def.surface || 'grass'));
    this.mesh.receiveShadow = true;
    this.mesh.name = 'terrain';
  }

  // Height texture for water shader (shore foam / depth tint)
  heightTexture() {
    const W = this.res + 1;
    const data = new Float32Array(W * W);
    data.set(this.H);
    const tex = new THREE.DataTexture(data, W, W, THREE.RedFormat, THREE.FloatType);
    tex.magFilter = THREE.LinearFilter; tex.minFilter = THREE.LinearFilter;
    tex.needsUpdate = true;
    return tex;
  }

  // Render a top-down colour map for the minimap/world map
  mapCanvas(px = 256) {
    const c = document.createElement('canvas'); c.width = c.height = px;
    const g = c.getContext('2d');
    const img = g.createImageData(px, px);
    const P = this.def.palette;
    for (let y = 0; y < px; y++) {
      for (let x = 0; x < px; x++) {
        const wx = -this.half + (x + 0.5) / px * this.size, wz = -this.half + (y + 0.5) / px * this.size;
        const h = this.heightAt(wx, wz);
        const s = this.slopeAt(wx, wz);
        let hex = this.faceColor(wx, wz, h, 1 / Math.sqrt(1 + s * s));
        if (h < this.water) hex = mixHex(this.lava ? 0xff6a1a : (P.waterMap ?? 0x3a7ab8), this.lava ? 0xffa040 : 0x1a3a68, clamp((this.water - h) / 5, 0, 1));
        // hill shading
        const hl = this.heightAt(wx - 1.5, wz - 1.5);
        const sh = clamp((h - hl) * 0.12, -0.25, 0.25);
        hex = shadeHex(hex, sh);
        const o = (y * px + x) * 4;
        img.data[o] = (hex >> 16) & 255; img.data[o + 1] = (hex >> 8) & 255; img.data[o + 2] = hex & 255; img.data[o + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
    return c;
  }
}

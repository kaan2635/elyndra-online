// Low-poly geometry toolkit: primitive shapes + a builder that merges parts into one
// flat-shaded, vertex-coloured BufferGeometry (optionally skinned to bones).
import * as THREE from 'three';
import { rng } from '../core/util.js';

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _v = new THREE.Vector3();
const _s = new THREE.Vector3();
const _c = new THREE.Color();

// ---------- primitive shapes (all return non-indexed geometry)
const ni = g => (g.index ? g.toNonIndexed() : g);
export const box = (w = 1, h = 1, d = 1) => ni(new THREE.BoxGeometry(w, h, d));
export const cyl = (rt = 0.5, rb = 0.5, h = 1, seg = 6, open = false) => ni(new THREE.CylinderGeometry(rt, rb, h, seg, 1, open));
export const cone = (r = 0.5, h = 1, seg = 6) => ni(new THREE.ConeGeometry(r, h, seg));
export const ico = (r = 0.5, detail = 0) => ni(new THREE.IcosahedronGeometry(r, detail));
export const octa = (r = 0.5) => ni(new THREE.OctahedronGeometry(r, 0));
export const dodeca = (r = 0.5) => ni(new THREE.DodecahedronGeometry(r, 0));
export const sphere = (r = 0.5, ws = 7, hs = 5) => ni(new THREE.SphereGeometry(r, ws, hs));
export const torus = (r = 0.5, t = 0.15, rs = 5, ts = 8, arc = Math.PI * 2) => ni(new THREE.TorusGeometry(r, t, rs, ts, arc));
export const tetra = (r = 0.5) => ni(new THREE.TetrahedronGeometry(r, 0));
export const plane = (w = 1, h = 1) => ni(new THREE.PlaneGeometry(w, h));
// tapered box: square frustum (top w/d may differ from bottom)
export function taper(wb, db, wt, dt, h) {
  const g = ni(new THREE.CylinderGeometry(Math.SQRT1_2, Math.SQRT1_2, h, 4, 1));
  g.rotateY(Math.PI / 4);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i); const top = y > 0;
    p.setX(i, p.getX(i) * (top ? wt : wb));
    p.setZ(i, p.getZ(i) * (top ? dt : db));
  }
  g.computeVertexNormals();
  return g;
}
// triangular prism (gable roof) — ridge along X
export function prism(w, h, d) {
  const hw = w / 2, hd = d / 2;
  const v = [
    // front tri
    -hw, 0, hd, hw, 0, hd, 0, h, hd,
    // back tri
    hw, 0, -hd, -hw, 0, -hd, 0, h, -hd,
    // left slope
    -hw, 0, -hd, -hw, 0, hd, 0, h, hd, -hw, 0, -hd, 0, h, hd, 0, h, -hd,
    // right slope
    hw, 0, hd, hw, 0, -hd, 0, h, -hd, hw, 0, hd, 0, h, -hd, 0, h, hd,
    // bottom
    -hw, 0, -hd, hw, 0, -hd, hw, 0, hd, -hw, 0, -hd, hw, 0, hd, -hw, 0, hd,
  ];
  // rotate so ridge runs along X (front/back faces are at ±z → ridge along z). swap to X:
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
  g.rotateY(Math.PI / 2);
  g.computeVertexNormals();
  return g;
}
// pyramid roof (4 sided)
export function pyramid(w, h, d) {
  const g = ni(new THREE.ConeGeometry(Math.SQRT1_2, h, 4, 1));
  g.rotateY(Math.PI / 4);
  g.scale(w, 1, d);
  g.translate(0, h / 2, 0);
  return g;
}
// lathe from a profile [[r,y],...]
export function lathe(profile, seg = 8) {
  return ni(new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), seg));
}
// extrude a 2D shape (array of [x,y]) along z by depth, centred
export function extrudeShape(pts, depth, bevel = 0) {
  const sh = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)));
  const g = new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 1, curveSegments: 3 });
  g.translate(0, 0, -depth / 2);
  return g.index ? g.toNonIndexed() : g;
}

// Randomly displace vertices (keeps shared positions consistent by hashing positions)
export function jitter(g, amt, seed = 1, keepBottom = false) {
  const r = rng(seed);
  const p = g.attributes.position;
  const map = new Map();
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const k = x.toFixed(3) + ',' + y.toFixed(3) + ',' + z.toFixed(3);
    let d = map.get(k);
    if (!d) { d = [(r() - 0.5) * amt, (r() - 0.5) * amt, (r() - 0.5) * amt]; map.set(k, d); }
    if (keepBottom && y <= p.array[1] - 1e9) continue;
    p.setXYZ(i, x + d[0], y + (keepBottom && y < 0.001 ? 0 : d[1]), z + d[2]);
  }
  g.computeVertexNormals();
  return g;
}

// ---------- builder ----------
export class Builder {
  constructor(seed = 7) {
    this.pos = []; this.col = []; this.sIdx = []; this.r = rng(seed);
  }
  /**
   * Add geometry.
   * o: {color (hex|[hex,hex] gradient bottom->top), p:[x,y,z], r:[x,y,z], s:[x,y,z]|number,
   *     bone (int), shade (per-face random brightness amount), grad (darken bottom amount 0..1), mat (Matrix4)}
   */
  add(geo, o = {}) {
    const g = geo.index ? geo.toNonIndexed() : geo;
    if (o.mat) _m.copy(o.mat);
    else {
      const rr = o.r || [0, 0, 0];
      _e.set(rr[0], rr[1], rr[2], o.order || 'XYZ');
      _q.setFromEuler(_e);
      const s = o.s == null ? [1, 1, 1] : (typeof o.s === 'number' ? [o.s, o.s, o.s] : o.s);
      _m.compose(_v.set(...(o.p || [0, 0, 0])), _q, _s.set(...s));
    }
    const p = g.attributes.position;
    const n = p.count;
    let minY = Infinity, maxY = -Infinity;
    const tmp = [];
    for (let i = 0; i < n; i++) {
      _v.set(p.getX(i), p.getY(i), p.getZ(i)).applyMatrix4(_m);
      tmp.push(_v.x, _v.y, _v.z);
      if (_v.y < minY) minY = _v.y; if (_v.y > maxY) maxY = _v.y;
    }
    const shade = o.shade ?? 0.06;
    const grad = o.grad ?? 0;
    const col = o.color ?? 0xffffff;
    const c0 = new THREE.Color(Array.isArray(col) ? col[0] : col);
    const c1 = new THREE.Color(Array.isArray(col) ? col[1] : col);
    const bone = o.bone ?? 0;
    for (let f = 0; f < n; f += 3) {
      const k = 1 + (this.r() - 0.5) * 2 * shade;
      for (let j = 0; j < 3; j++) {
        const i = f + j;
        const y = tmp[i * 3 + 1];
        const t = maxY > minY ? (y - minY) / (maxY - minY) : 1;
        _c.copy(c0).lerp(c1, t);
        const g2 = 1 - grad * (1 - t);
        this.pos.push(tmp[i * 3], tmp[i * 3 + 1], tmp[i * 3 + 2]);
        this.col.push(_c.r * k * g2, _c.g * k * g2, _c.b * k * g2);
        this.sIdx.push(bone);
      }
    }
    return this;
  }
  get count() { return this.pos.length / 3; }
  build(skinned = false) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    if (skinned) {
      const n = this.sIdx.length;
      const si = new Uint16Array(n * 4), sw = new Float32Array(n * 4);
      for (let i = 0; i < n; i++) { si[i * 4] = this.sIdx[i]; sw[i * 4] = 1; }
      g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
      g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4));
    }
    g.computeVertexNormals();
    g.computeBoundingSphere();
    g.computeBoundingBox();
    return g;
  }
}

// Convert a hex/number color into linear THREE.Color quickly
export const col = h => new THREE.Color(h);

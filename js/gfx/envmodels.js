// Bridges glTF environment packs (KayKit / Quaternius) into the engine's merged, vertex-coloured
// geometry: each model is "baked" into a triangle soup whose colours come from its materials and
// (for palette-atlas textures) from the texture sampled at each vertex's UV. Baked models can be
// instanced (props) or merged into a zone's static structure mesh (buildings).
import * as THREE from 'three';
import { Assets } from './assets.js';

const bakeCache = new Map();
const texData = new Map();
const _m = new THREE.Matrix4(), _v = new THREE.Vector3(), _c = new THREE.Color(), _inv = new THREE.Matrix4();

function sampler(tex) {
  let d = texData.get(tex);
  if (!d) {
    const img = tex.image;
    const cv = document.createElement('canvas'); cv.width = img.width; cv.height = img.height;
    const ctx = cv.getContext('2d', { willReadFrequently: true }); ctx.drawImage(img, 0, 0);
    d = { w: img.width, h: img.height, px: ctx.getImageData(0, 0, img.width, img.height).data, flipY: tex.flipY };
    texData.set(tex, d);
  }
  return (u, v, out) => {
    u = u - Math.floor(u); v = v - Math.floor(v);
    if (d.flipY) v = 1 - v;
    const x = Math.min(d.w - 1, Math.floor(u * d.w)), y = Math.min(d.h - 1, Math.floor(v * d.h)), i = (y * d.w + x) * 4;
    return out.setRGB(d.px[i] / 255, d.px[i + 1] / 255, d.px[i + 2] / 255, THREE.SRGBColorSpace);
  };
}

/** Bake one pack entry into {pos, col, min, max} (local to the entry root, y-up). */
export function bake(url, name) {
  const key = url + '#' + name;
  if (bakeCache.has(key)) return bakeCache.get(key);
  const root = Assets.template(url, name);
  if (!root) { bakeCache.set(key, null); return null; }
  root.updateMatrixWorld(true);
  _inv.copy(root.matrixWorld).invert();
  const pos = [], col = [];
  const min = new THREE.Vector3(Infinity, Infinity, Infinity), max = new THREE.Vector3(-Infinity, -Infinity, -Infinity);
  root.traverse(o => {
    if (!o.isMesh) return;
    const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry;
    const P = g.attributes.position, UV = g.attributes.uv, VC = g.attributes.color;
    _m.multiplyMatrices(_inv, o.matrixWorld);
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    // material per vertex via groups (non-indexed groups index into vertices)
    const groups = g.groups.length ? g.groups : [{ start: 0, count: P.count, materialIndex: 0 }];
    for (const gr of groups) {
      const mat = mats[gr.materialIndex] || mats[0];
      const samp = mat.map && mat.map.image ? sampler(mat.map) : null;
      const base = mat.color || _c.set(1, 1, 1);
      for (let i = gr.start; i < gr.start + gr.count && i < P.count; i++) {
        _v.fromBufferAttribute(P, i).applyMatrix4(_m);
        pos.push(_v.x, _v.y, _v.z); min.min(_v); max.max(_v);
        if (samp && UV) samp(UV.getX(i), UV.getY(i), _c); else _c.setRGB(1, 1, 1);
        _c.multiply(base);
        if (VC) _c.multiply(new THREE.Color(VC.getX(i), VC.getY(i), VC.getZ(i)));
        if (mat.emissive && (mat.emissive.r + mat.emissive.g + mat.emissive.b) > 0.05) _c.add(mat.emissive);
        col.push(_c.r, _c.g, _c.b);
      }
    }
  });
  const res = { pos: new Float32Array(pos), col: new Float32Array(col), min, max, h: max.y - min.y, w: Math.max(max.x - min.x, max.z - min.z), sx: max.x - min.x, sz: max.z - min.z };
  bakeCache.set(key, res);
  return res;
}

/** BufferGeometry of a baked entry, base at y=0, uniformly scaled to `height` (or by `scale`). */
const geoCache = new Map();
export function bakedGeometry(url, name, { height, scale = 1, tint = null } = {}) {
  const key = url + '#' + name + '|' + height + '|' + scale + '|' + tint;
  if (geoCache.has(key)) return geoCache.get(key);
  const b = bake(url, name); if (!b) return null;
  const s = height ? height / (b.h || 1) : scale;
  const pos = new Float32Array(b.pos.length);
  for (let i = 0; i < b.pos.length; i += 3) { pos[i] = b.pos[i] * s; pos[i + 1] = (b.pos[i + 1] - b.min.y) * s; pos[i + 2] = b.pos[i + 2] * s; }
  let col = b.col;
  if (tint != null) { const t = new THREE.Color(tint); col = new Float32Array(b.col); for (let i = 0; i < col.length; i += 3) { col[i] *= t.r; col[i + 1] *= t.g; col[i + 2] *= t.b; } }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.computeVertexNormals(); g.computeBoundingSphere(); g.computeBoundingBox();
  g.userData.size = { h: b.h * s, sx: b.sx * s, sz: b.sz * s };
  geoCache.set(key, g);
  return g;
}

/** Append a baked entry to a Builder-like {pos,col,sIdx} with a transform and optional colour multiplier. */
export function appendBaked(target, b, matrix, mul = null) {
  const m = mul ? new THREE.Color(mul) : null;
  for (let i = 0; i < b.pos.length; i += 3) {
    _v.set(b.pos[i], b.pos[i + 1] - b.min.y, b.pos[i + 2]).applyMatrix4(matrix);
    target.pos.push(_v.x, _v.y, _v.z);
    if (m) target.col.push(b.col[i] * m.r, b.col[i + 1] * m.g, b.col[i + 2] * m.b);
    else target.col.push(b.col[i], b.col[i + 1], b.col[i + 2]);
    target.sIdx.push(0);
  }
}

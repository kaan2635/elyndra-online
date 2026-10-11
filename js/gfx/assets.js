// Asset manager for the glTF model packs in assets/models (CC0 — KayKit & Quaternius, see assets/CREDITS.md).
// Loads once, caches, and hands out clones. Packs are GLBs whose root children are named models.
import * as THREE from 'three';
import { GLTFLoader } from '../../lib/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from '../../lib/addons/libs/meshopt_decoder.module.js';
import { clone as skeletonClone } from '../../lib/addons/utils/SkeletonUtils.js';

const BASE = './assets/models/';
const loader = new GLTFLoader();
loader.setMeshoptDecoder(MeshoptDecoder);

const cache = new Map();   // url -> Promise<gltf>
const done = new Map();    // url -> gltf (resolved)
const packs = new Map();   // url -> Map(name -> Object3D template)

export const Assets = {
  load(url) {
    if (!cache.has(url)) {
      const p = loader.loadAsync(BASE + url).then(g => {
        done.set(url, g);
        // every material gets sane defaults for this art style
        g.scene.traverse(o => {
          if (!o.isMesh) return;
          o.castShadow = true; o.receiveShadow = true;
          for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
            if (m.map) { m.map.anisotropy = 4; m.map.colorSpace = THREE.SRGBColorSpace; }
            m.metalness = Math.min(m.metalness ?? 0, 0.15); m.roughness = Math.max(m.roughness ?? 1, 0.6);
          }
        });
        return g;
      });
      cache.set(url, p);
    }
    return cache.get(url);
  },
  /** Load many files; onProgress(fraction, url) */
  async preload(urls, onProgress) {
    let n = 0;
    await Promise.all(urls.map(u => this.load(u).then(() => { n++; onProgress?.(n / urls.length, u); })));
  },
  loaded(url) { return done.get(url) || null; },
  isLoaded(url) { return done.has(url); },
  /** Map of named templates inside a pack file */
  pack(url) {
    let m = packs.get(url);
    if (m) return m;
    const g = done.get(url); if (!g) return null;
    m = new Map();
    for (const c of g.scene.children) m.set(c.name, c);
    packs.set(url, m);
    return m;
  },
  /** Template object for one model in a pack (not cloned) */
  template(url, name) { return this.pack(url)?.get(name) || null; },
  /** Deep clone that also rebinds skinned meshes */
  clone(obj) { return skeletonClone(obj); },
  clips(url) { return done.get(url)?.animations || []; },
};

// Recoloring of KayKit palette atlases (8x4 cells of gradient swatches). We classify each cell by
// its colour and remap whole cells, so the hand-made gradients survive.
const recolorCache = new Map();
const rgb2hsv = (r, g, b) => { const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn; let h = 0; if (d) { h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h *= 60; if (h < 0) h += 360; } return [h, mx ? d / mx : 0, mx]; };
const hsv2rgb = (h, s, v) => { const c = v * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = v - c; const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x]; return [r + m, g + m, b + m]; };
export const isSkinHSV = (h, s, v) => h >= 12 && h <= 38 && s >= 0.12 && s <= 0.55 && v >= 0.62;

/**
 * texture: THREE.Texture with an HTMLImage/ImageBitmap
 * opts: { skin: 0xRRGGBB (target mid skin tone) , outfit: hueDegrees | null, outfitSat, dark: 0..1 }
 */
export function recolorAtlas(texture, opts, key) {
  const k = texture.uuid + '|' + key;
  if (recolorCache.has(k)) return recolorCache.get(k);
  const img = texture.image;
  const W = img.width, Hh = img.height;
  const cv = document.createElement('canvas'); cv.width = W; cv.height = Hh;
  const ctx = cv.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0);
  const data = ctx.getImageData(0, 0, W, Hh); const px = data.data;
  const cols = 8, rows = 4, cw = W / cols, ch = Hh / rows;
  const skinT = opts.skin != null ? rgb2hsv(((opts.skin >> 16) & 255) / 255, ((opts.skin >> 8) & 255) / 255, (opts.skin & 255) / 255) : null;
  for (let cy = 0; cy < rows; cy++) for (let cx = 0; cx < cols; cx++) {
    // sample the cell centre to classify it
    const sx = Math.floor(cx * cw + cw * 0.3), sy = Math.floor(cy * ch + ch * 0.5), si = (sy * W + sx) * 4;
    const [h, s, v] = rgb2hsv(px[si] / 255, px[si + 1] / 255, px[si + 2] / 255);
    let mode = null;
    if (skinT && isSkinHSV(h, s, v)) mode = 'skin';
    else if (opts.outfit != null && s > 0.32 && v > 0.18) mode = 'outfit';
    if (!mode) continue;
    for (let y = Math.floor(cy * ch); y < Math.floor((cy + 1) * ch); y++) for (let x = Math.floor(cx * cw); x < Math.floor((cx + 1) * cw); x++) {
      const i = (y * W + x) * 4;
      let [ph, ps, pv] = rgb2hsv(px[i] / 255, px[i + 1] / 255, px[i + 2] / 255);
      if (mode === 'skin') { ph = skinT[0]; ps = Math.min(1, ps * (skinT[1] / 0.3)); pv = Math.min(1, pv * (skinT[2] / 0.94)); }
      else { ph = opts.outfit; ps = Math.min(1, ps * (opts.outfitSat ?? 1)); pv *= 1 - (opts.dark || 0); }
      const [r, g, b] = hsv2rgb(ph, ps, pv);
      px[i] = r * 255; px[i + 1] = g * 255; px[i + 2] = b * 255;
    }
  }
  ctx.putImageData(data, 0, 0);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace; t.flipY = texture.flipY; t.anisotropy = 4;
  t.magFilter = texture.magFilter; t.minFilter = texture.minFilter; t.generateMipmaps = true;
  recolorCache.set(k, t);
  return t;
}

// Distant scenery: a ring of stylised mountains just outside each zone and drifting clouds.
// Mountains use a fixed "atmospheric perspective" blend toward the fog colour instead of distance fog,
// so they read as soft silhouettes on the horizon at any view distance.
import * as THREE from 'three';
import { Assets } from './assets.js';
import { bake, appendBaked } from './envmodels.js';
import { rng } from '../core/util.js';

const PACK = 'env/terrain.glb';
// the hex-based mountain models read as blocks at a distance; the terrain's own border ridge is used instead
const SHOW_MOUNTAINS = false;
// per-zone mountain set and colour multiplier
const STYLE = {
  vale: [['mountain_a_grass', 'mountain_b_grass_trees', 'mountain_c_grass', 'mountain_a_grass_trees'], 0xe8f0e0],
  forest: [['mountain_b_grass_trees', 'mountain_c_grass_trees', 'mountain_a_grass_trees'], 0xc8dcc8],
  desert: [['mountain_a', 'mountain_b', 'mountain_c'], 0xf0c890],
  frost: [['mountain_a', 'mountain_b', 'mountain_c'], 0xf4f8ff],
  ember: [['mountain_a', 'mountain_b', 'mountain_c'], 0x5a4440],
  shadow: [['mountain_a', 'mountain_b', 'mountain_c'], 0x7a6e9a],
};

let mountainMat = null, cloudMat = null;
function mountainMaterial() {
  if (mountainMat) return mountainMat;
  mountainMat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  mountainMat.onBeforeCompile = sh => {
    sh.vertexShader = 'varying float vH;\n' + sh.vertexShader.replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvH = (modelMatrix * vec4(transformed, 1.0)).y;');
    sh.fragmentShader = 'varying float vH;\n' + sh.fragmentShader.replace('#include <fog_fragment>', `
      #ifdef USE_FOG
        float haze = mix(0.72, 0.38, clamp((vH - 10.0) / 60.0, 0.0, 1.0));
        gl_FragColor.rgb = mix(gl_FragColor.rgb, fogColor, haze);
      #endif`);
  };
  mountainMat.customProgramCacheKey = () => 'mountains';
  return mountainMat;
}

export function buildBackdrop(def) {
  if (!Assets.isLoaded(PACK) || def.dungeonLayout || def.env?.indoor) return null;
  const group = new THREE.Group(); group.name = 'backdrop';
  const [names, tint] = STYLE[def.id] || STYLE.vale;
  const r = rng((def.terrain?.seed || 1) * 13 + 5);
  const half = (def.terrain?.size || 400) / 2;
  const B = { pos: [], col: [], sIdx: [] };
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
  // walk the square perimeter just beyond the playable border
  const ring = [];
  for (let side = 0; side < 4; side++) for (let k = 0; k < 9; k++) {
    const t = (k + 0.5) / 9 * 2 - 1;
    const off = half + 22 + r() * 30;
    const [x, z] = [[t * (half + 40), -off], [off, t * (half + 40)], [t * (half + 40), off], [-off, t * (half + 40)]][side];
    ring.push([x, z]);
  }
  for (const [x, z] of SHOW_MOUNTAINS ? ring : []) {
    const b = bake(PACK, names[Math.floor(r() * names.length)]); if (!b) continue;
    const s = 26 + r() * 22;
    q.setFromAxisAngle(up, r() * Math.PI * 2);
    m.compose(new THREE.Vector3(x, 8 + r() * 10, z), q, new THREE.Vector3(s, s * (0.9 + r() * 0.5), s));
    appendBaked(B, b, m, tint);
  }
  if (B.pos.length) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(B.pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(B.col, 3));
    g.computeVertexNormals(); g.computeBoundingSphere();
    const mesh = new THREE.Mesh(g, mountainMaterial());
    mesh.frustumCulled = false;
    group.add(mesh);
  }
  // clouds (skipped in the ash- and shadow-choked zones)
  if (!['ember', 'shadow'].includes(def.id)) {
    if (!cloudMat) cloudMat = new THREE.MeshLambertMaterial({ vertexColors: true, emissive: 0x9aa4b4, flatShading: true, transparent: true, opacity: 0.92, fog: false });
    const clouds = new THREE.Group(); clouds.name = 'clouds';
    for (let i = 0; i < 16; i++) {
      const b = bake(PACK, r() < 0.5 ? 'cloud_big' : 'cloud_small'); if (!b) continue;
      const C = { pos: [], col: [], sIdx: [] };
      const s = 7 + r() * 9;
      m.compose(new THREE.Vector3(0, 0, 0), q.setFromAxisAngle(up, r() * 6.28), new THREE.Vector3(s, s * 0.6, s));
      appendBaked(C, b, m);
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(C.pos, 3));
      g.setAttribute('color', new THREE.Float32BufferAttribute(C.col, 3));
      g.computeVertexNormals();
      const cm = new THREE.Mesh(g, cloudMat);
      cm.position.set((r() * 2 - 1) * half * 1.1, 62 + r() * 30, (r() * 2 - 1) * half * 1.1);
      cm.userData.v = 0.6 + r() * 0.8;
      clouds.add(cm);
    }
    group.add(clouds);
    group.userData.update = (dt) => {
      for (const c of clouds.children) { c.position.x += c.userData.v * dt; if (c.position.x > half * 1.2) c.position.x = -half * 1.2; }
    };
  }
  return group;
}

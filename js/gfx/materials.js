// Shared materials. Everything is vertex-coloured low-poly with flat shading.
import * as THREE from 'three';

export const U = { time: { value: 0 } }; // shared animated uniforms

const cache = {};
export function lambert(key = 'base', extra = {}) {
  if (!cache[key]) cache[key] = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, ...extra });
  return cache[key];
}
export function basic(key = 'basic', extra = {}) {
  if (!cache[key]) cache[key] = new THREE.MeshBasicMaterial({ vertexColors: true, ...extra });
  return cache[key];
}

// Foliage with wind sway (vertex shader patch)
export function foliage(amount = 0.06, key = 'foliage') {
  if (cache[key]) return cache[key];
  const m = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  m.onBeforeCompile = sh => {
    sh.uniforms.uTime = U.time;
    sh.vertexShader = 'uniform float uTime;\n' + sh.vertexShader.replace('#include <begin_vertex>', `
      #include <begin_vertex>
      #ifdef USE_INSTANCING
        vec3 wpS = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;
      #else
        vec3 wpS = (modelMatrix * vec4(transformed, 1.0)).xyz;
      #endif
      float hS = max(transformed.y, 0.0);
      float sw = sin(uTime * 1.6 + wpS.x * 0.31 + wpS.z * 0.23) + 0.45 * sin(uTime * 2.7 + wpS.x * 0.9 + wpS.z * 0.4);
      transformed.x += sw * ${amount.toFixed(3)} * hS;
      transformed.z += sw * ${(amount * 0.6).toFixed(3)} * hS;
    `);
  };
  m.customProgramCacheKey = () => 'foliage' + amount;
  cache[key] = m;
  return m;
}

export function charMaterial() {
  return new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, emissive: 0x000000 });
}

// Soft round blob texture for particles / blob shadows
let _blob;
export function blobTexture() {
  if (_blob) return _blob;
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,0.75)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  _blob = new THREE.CanvasTexture(c);
  return _blob;
}
let _shadowMat;
export function blobShadowMaterial() {
  if (!_shadowMat) _shadowMat = new THREE.MeshBasicMaterial({ map: blobTexture(), color: 0x000000, transparent: true, opacity: 0.38, depthWrite: false });
  return _shadowMat;
}

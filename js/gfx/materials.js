// Shared materials. Everything is vertex-coloured low-poly with flat shading.
import * as THREE from 'three';

// shared animated uniforms; camPos/focus drive the "see-through" fade of occluders (set each frame)
export const U = { time: { value: 0 }, camPos: { value: new THREE.Vector3() }, focus: { value: new THREE.Vector3() }, occ: { value: 0 } };

const cache = {};
// Objects right in front of the camera, or between the camera and the hero, dissolve with an
// ordered dither so trees and buildings never block the view.
export function camFadeChunks(sh) {
  sh.uniforms.uCamPos = U.camPos; sh.uniforms.uFocus = U.focus; sh.uniforms.uOcc = U.occ;
  sh.vertexShader = sh.vertexShader
    .replace('#include <project_vertex>', `#include <project_vertex>
  vCamD = -mvPosition.z;
  vec4 cfw = vec4(transformed, 1.0);
  #ifdef USE_INSTANCING
    cfw = instanceMatrix * cfw;
  #endif
  vCFW = (modelMatrix * cfw).xyz;`)
    .replace('void main() {', 'varying float vCamD;\nvarying vec3 vCFW;\nvoid main() {');
  sh.fragmentShader = sh.fragmentShader.replace('void main() {', `varying float vCamD;
    varying vec3 vCFW;
    uniform vec3 uCamPos; uniform vec3 uFocus; uniform float uOcc;
    float bayer4(vec2 p){ vec2 q = mod(floor(p), 4.0); float i = q.x + q.y * 4.0; return (mod(i * 7.0, 16.0) + 0.5) / 16.0; }
    void main() {
      {
        float cf = smoothstep(1.2, 3.6, vCamD);
        if (uOcc > 0.5) {
          vec3 ab = uFocus - uCamPos; float t = clamp(dot(vCFW - uCamPos, ab) / max(dot(ab, ab), 0.001), 0.0, 1.0);
          float dd = length(vCFW - (uCamPos + ab * t));
          float occ = (1.0 - smoothstep(1.4, 3.4, dd)) * (1.0 - smoothstep(0.8, 0.93, t)) * step(0.02, t);
          cf = min(cf, 1.0 - occ * 0.8);
        }
        if (cf < 0.999 && bayer4(gl_FragCoord.xy) > cf) discard;
      }`);
}
export function withCamFade(m, key) {
  const prev = m.onBeforeCompile;
  m.onBeforeCompile = (sh, r) => { prev?.call(m, sh, r); camFadeChunks(sh); };
  const pk = m.customProgramCacheKey?.bind(m);
  m.customProgramCacheKey = () => (pk ? pk() : '') + '|camfade' + (key || '');
  return m;
}
export function lambert(key = 'base', extra = {}) {
  if (!cache[key]) {
    cache[key] = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, ...extra });
    if (key === 'props' || key === 'structures') withCamFade(cache[key], key);
  }
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
  withCamFade(m, 'fol' + amount);
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

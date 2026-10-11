// Live 3D portrait of the player's head, rendered once (and after gear changes) into a 2D canvas.
import * as THREE from 'three';
import { G, on } from '../core/state.js';

const SIZE = 128;
let rt = null, scene = null, cam = null, canvas = null;

function setup() {
  rt = new THREE.WebGLRenderTarget(SIZE, SIZE, { samples: 0 });
  rt.texture.colorSpace = THREE.SRGBColorSpace;
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x2a2030);
  scene.add(new THREE.HemisphereLight(0xfff0e0, 0x302030, 2.2));
  const d = new THREE.DirectionalLight(0xffffff, 2.2); d.position.set(1, 2, 3); scene.add(d);
  cam = new THREE.PerspectiveCamera(30, 1, 0.05, 20);
  canvas = document.createElement('canvas'); canvas.width = canvas.height = SIZE;
}

export function renderPortrait(u) {
  if (!u?.model) return canvas;
  if (!rt) setup();
  const R = G.engine.renderer;
  const mesh = u.model.mesh;
  const parent = mesh.parent;
  const savedPos = mesh.position.clone(), savedRot = mesh.rotation.clone();
  scene.add(mesh);
  mesh.position.set(0, 0, 0); mesh.rotation.set(0, 0, 0);
  mesh.updateMatrixWorld(true);
  const head = u.model.bones[3];
  const hp = new THREE.Vector3(); head.getWorldPosition(hp);
  const hs = (u.model.scale || 1);
  cam.position.set(hp.x + 0.25 * hs, hp.y + 0.22 * hs, hp.z + 1.25 * hs);
  cam.lookAt(hp.x, hp.y + 0.18 * hs, hp.z);
  const prevTarget = R.getRenderTarget();
  const prevTone = R.toneMappingExposure;
  R.setRenderTarget(rt);
  R.clear();
  R.render(scene, cam);
  const buf = new Uint8Array(SIZE * SIZE * 4);
  R.readRenderTargetPixels(rt, 0, 0, SIZE, SIZE, buf);
  R.setRenderTarget(prevTarget);
  R.toneMappingExposure = prevTone;
  // restore the model
  parent.add(mesh); mesh.position.copy(savedPos); mesh.rotation.copy(savedRot);
  // flip vertically into the canvas
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(SIZE, SIZE);
  for (let y = 0; y < SIZE; y++) img.data.set(buf.subarray((SIZE - 1 - y) * SIZE * 4, (SIZE - y) * SIZE * 4), y * SIZE * 4);
  ctx.putImageData(img, 0, 0);
  return canvas;
}

let el = null;
G.portrait = u => {
  if (!el) { el = document.createElement('canvas'); el.width = el.height = SIZE; }
  try { const c = renderPortrait(u); el.getContext('2d').drawImage(c, 0, 0); } catch (e) { console.warn('portrait', e); }
  return el;
};
on('equipChanged', () => { G.portraitDirty = true; });
G.addSystem(() => { if (G.portraitDirty && G.player && el) { G.portraitDirty = false; G.portrait(G.player); } });

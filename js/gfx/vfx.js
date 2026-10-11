// Visual effects: GPU point particles, projectiles, telegraphs, rings, beams, auras.
import * as THREE from 'three';
import { G } from '../core/state.js';
import { rand, clamp, lerp, TAU } from '../core/util.js';
import { blobTexture } from './materials.js';
import { box, cyl, ico, octa, cone, Builder } from './geom.js';

const MAX = 3000;
const PRESET = {
  fire: { c: [0xffd040, 0xff6a1a, 0xc02a0a], v: 2.5, up: 2.5, g: -1, life: [0.4, 0.9], s: [0.35, 0.8], add: true },
  frost: { c: [0xe8f8ff, 0x8ad8ff, 0x3a8ae8], v: 3, up: 1, g: 2, life: [0.4, 0.9], s: [0.25, 0.55], add: true },
  arcane: { c: [0xf0c0ff, 0xc06aff, 0x6a3aff], v: 3, up: 0.5, g: 0, life: [0.3, 0.8], s: [0.25, 0.5], add: true },
  holy: { c: [0xfff8d0, 0xffe68a, 0xffc040], v: 2, up: 2, g: -0.5, life: [0.5, 1.0], s: [0.3, 0.6], add: true },
  shadow: { c: [0xd0a0ff, 0x8a3aff, 0x2a0a4a], v: 2.2, up: 1, g: -0.5, life: [0.4, 0.9], s: [0.35, 0.7], add: true },
  poison: { c: [0xd8ff8a, 0x8ae83a, 0x3a8a1a], v: 1.5, up: 1.5, g: -0.5, life: [0.5, 1.0], s: [0.2, 0.45], add: true },
  nature: { c: [0xd8ffb0, 0x8ae86a, 0x4aa83a], v: 1.8, up: 1.5, g: -0.5, life: [0.5, 1.0], s: [0.2, 0.45], add: true },
  blood: { c: [0xff4a3a, 0xc01a1a, 0x6a0a0a], v: 3.5, up: 2.5, g: 9, life: [0.3, 0.7], s: [0.15, 0.35], add: false },
  sparks: { c: [0xffffff, 0xffe8a0, 0xffa040], v: 6, up: 2, g: 8, life: [0.15, 0.4], s: [0.1, 0.22], add: true },
  smoke: { c: [0x8a8a8a, 0x5a5a5a, 0x3a3a3a], v: 1, up: 1.5, g: -0.4, life: [0.8, 1.6], s: [0.8, 1.6], add: false, grow: 1.5 },
  dust: { c: [0xc8b090, 0xa89070, 0x8a7050], v: 4, up: 1, g: 1, life: [0.5, 1.0], s: [0.5, 1.1], add: false, grow: 1.2 },
  heal: { c: [0xd0ffd0, 0x6aff8a, 0x2ad86a], v: 1.2, up: 2.5, g: -1, life: [0.6, 1.1], s: [0.25, 0.45], add: true },
  levelup: { c: [0xffffff, 0xffe68a, 0xffc040], v: 3, up: 5, g: -1, life: [0.8, 1.6], s: [0.3, 0.6], add: true },
  death: { c: [0xd8d0c0, 0xa8a090, 0x787060], v: 1.5, up: 1.2, g: -0.2, life: [0.6, 1.2], s: [0.4, 0.9], add: false, grow: 1.4 },
  explosion: { c: [0xffe080, 0xff7a1a, 0xa82a0a], v: 8, up: 4, g: 3, life: [0.4, 1.0], s: [0.6, 1.4], add: true, grow: 1.3 },
  lightning: { c: [0xffffff, 0xc8e8ff, 0x8ac8ff], v: 5, up: 1, g: 0, life: [0.1, 0.3], s: [0.15, 0.3], add: true },
  gold: { c: [0xfff0a0, 0xffd040, 0xd8a020], v: 2, up: 3, g: 4, life: [0.5, 1.0], s: [0.15, 0.3], add: true },
  bone: { c: [0xf0e8d0, 0xd8d0b8, 0xa8a088], v: 3, up: 2, g: 7, life: [0.4, 0.8], s: [0.15, 0.3], add: false },
  water: { c: [0xe8f8ff, 0xa8d8ff, 0x6ab0e8], v: 2, up: 3, g: 9, life: [0.4, 0.8], s: [0.15, 0.3], add: true },
  ember: { c: [0xffd040, 0xff7a1a, 0xff4a0a], v: 0.6, up: 1.4, g: -0.3, life: [1.0, 2.0], s: [0.08, 0.16], add: true },
  snow: { c: [0xffffff, 0xf0f8ff, 0xe0f0ff], v: 0.4, up: -1.5, g: 0.2, life: [3, 5], s: [0.08, 0.16], add: false },
  ash: { c: [0x6a6060, 0x4a4040, 0x8a7a70], v: 0.4, up: -0.8, g: 0.1, life: [3, 5], s: [0.08, 0.14], add: false },
  rain: { c: [0xc8d8f0, 0xa8c0e0, 0x88a8d0], v: 0, up: -22, g: 0, life: [0.6, 0.9], s: [0.06, 0.1], add: false, streak: 1 },
  spark_purple: { c: [0xffffff, 0xd8a0ff, 0xa060ff], v: 1, up: 1, g: -0.3, life: [1, 2], s: [0.08, 0.16], add: true },
  firefly: { c: [0xf8ffb0, 0xd8ff6a, 0xb0f040], v: 0.5, up: 0.2, g: 0, life: [2, 4], s: [0.1, 0.18], add: true },
  leaf: { c: [0x8ac84a, 0x6aa83a, 0xc8a83a], v: 0.6, up: -0.6, g: 0.1, life: [3, 5], s: [0.1, 0.18], add: false },
};
const SCHOOL_PRESET = { phys: 'sparks', fire: 'fire', frost: 'frost', arcane: 'arcane', holy: 'holy', shadow: 'shadow', nature: 'nature', poison: 'poison' };

class Particles {
  constructor(additive) {
    const g = new THREE.BufferGeometry();
    this.pos = new Float32Array(MAX * 3); this.col = new Float32Array(MAX * 3); this.size = new Float32Array(MAX); this.alpha = new Float32Array(MAX);
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('color', new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('size', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('alpha', new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage));
    this.geo = g;
    const mat = new THREE.ShaderMaterial({
      uniforms: { tex: { value: blobTexture() }, scale: { value: 400 } },
      vertexShader: `attribute float size; attribute float alpha; varying vec3 vC; varying float vA;
        void main(){ vC = color; vA = alpha; vec4 mv = modelViewMatrix * vec4(position,1.0); gl_PointSize = size * 400.0 / max(0.5, -mv.z); gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `uniform sampler2D tex; varying vec3 vC; varying float vA;
        void main(){ vec4 t = texture2D(tex, gl_PointCoord); gl_FragColor = vec4(vC, t.a * vA); if (gl_FragColor.a < 0.01) discard; }`,
      transparent: true, depthWrite: false, vertexColors: true,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.points = new THREE.Points(g, mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 5;
    this.p = []; // particle objects
    for (let i = 0; i < MAX; i++) this.p.push({ life: 0 });
    this.next = 0;
  }
  emit(x, y, z, vx, vy, vz, c, s, life, g, grow, drag) {
    let i = this.next; this.next = (this.next + 1) % MAX;
    const p = this.p[i];
    p.x = x; p.y = y; p.z = z; p.vx = vx; p.vy = vy; p.vz = vz; p.c = c; p.s = s; p.life = p.max = life; p.g = g; p.grow = grow || 1; p.drag = drag ?? 1.2;
  }
  update(dt) {
    let n = 0;
    const P = this.pos, C = this.col, Sz = this.size, A = this.alpha;
    for (let i = 0; i < MAX; i++) {
      const p = this.p[i];
      if (p.life <= 0) { if (Sz[i] !== 0) { Sz[i] = 0; A[i] = 0; } continue; }
      p.life -= dt;
      const k = Math.max(0, 1 - p.drag * dt);
      p.vx *= k; p.vz *= k; p.vy = p.vy * k - p.g * dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      const f = Math.max(0, p.life / p.max);
      P[i * 3] = p.x; P[i * 3 + 1] = p.y; P[i * 3 + 2] = p.z;
      C[i * 3] = p.c.r; C[i * 3 + 1] = p.c.g; C[i * 3 + 2] = p.c.b;
      Sz[i] = p.s * lerp(p.grow, 1, f);
      A[i] = f < 0.3 ? f / 0.3 : 1;
      n++;
    }
    for (const a of ['position', 'color', 'size', 'alpha']) this.geo.attributes[a].needsUpdate = true;
    return n;
  }
}

const _cols = {};
const colOf = h => _cols[h] || (_cols[h] = new THREE.Color(h));

export class VFX {
  constructor(scene) {
    this.scene = scene;
    this.add = new Particles(true); this.norm = new Particles(false);
    scene.add(this.add.points, this.norm.points);
    this.items = []; // generic animated objects {obj, t, dur, update(o, k, dt)}
    this.projs = [];
    this.auras = [];
    this.root = new THREE.Group(); scene.add(this.root);
    G.vfx = this;
    this._matCache = {};
  }
  basicMat(color, opacity = 1, additive = true, side = THREE.FrontSide) {
    return new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending, side, toneMapped: false });
  }

  // ---------------------------------------------------------- particles
  burst(pos, preset, o = {}) {
    const P = PRESET[preset] || PRESET.sparks;
    const sys = P.add ? this.add : this.norm;
    const n = Math.round((o.n ?? 16) * (G.engine?.qName === 'low' ? 0.5 : 1));
    const r = o.r ?? 0.4;
    const y = (pos.y ?? 0) + (o.y ?? 0.8);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU, rr = Math.random() * r;
      const sp = P.v * (o.speed ?? 1) * (0.4 + Math.random() * 0.8);
      const c = colOf(P.c[Math.floor(Math.random() * P.c.length)]);
      sys.emit(pos.x + Math.cos(a) * rr, y + (Math.random() - 0.5) * 0.4, pos.z + Math.sin(a) * rr,
        Math.cos(a) * sp, P.up * (0.5 + Math.random() * 0.8) * (o.upMul ?? 1), Math.sin(a) * sp,
        c, rand(P.s[0], P.s[1]) * (o.size ?? 1), rand(P.life[0], P.life[1]), P.g, P.grow, P.drag);
    }
  }
  emitOne(preset, x, y, z, vx = 0, vy = 0, vz = 0, sizeMul = 1) {
    const P = PRESET[preset]; const sys = P.add ? this.add : this.norm;
    sys.emit(x, y, z, vx, vy, vz, colOf(P.c[Math.floor(Math.random() * P.c.length)]), rand(P.s[0], P.s[1]) * sizeMul, rand(P.life[0], P.life[1]), P.g, P.grow, P.drag);
  }
  hit(u, school, crit) {
    const p = u.pos;
    this.burst({ x: p.x, y: p.y + u.height * 0.55, z: p.z }, SCHOOL_PRESET[school] || 'sparks', { n: crit ? 18 : 9, y: 0, r: 0.25 });
    if (school === 'phys' && u.kind === 'monster' && !u.data.noBlood) this.burst({ x: p.x, y: p.y + u.height * 0.5, z: p.z }, u.data.blood || 'blood', { n: crit ? 10 : 5, y: 0, r: 0.2 });
  }

  // ---------------------------------------------------------- generic timed objects
  timed(obj, dur, update, parent = this.root) {
    parent.add(obj);
    this.items.push({ obj, t: 0, dur, update });
    return obj;
  }
  ring(pos, r, color = 0xffffff, dur = 0.6) {
    const m = new THREE.Mesh(new THREE.RingGeometry(0.85, 1, 48).rotateX(-Math.PI / 2), this.basicMat(color, 0.9));
    m.position.set(pos.x, (pos.y ?? G.world.groundAt(pos.x, pos.z)) + 0.25, pos.z);
    this.timed(m, dur, (o, k) => { const s = lerp(0.3, r, 1 - Math.pow(1 - k, 3)); o.scale.set(s, 1, s); o.material.opacity = 0.9 * (1 - k); });
  }
  slash(u, color = 0xffffff) {
    const g = new THREE.RingGeometry(1.2, 2.6, 24, 1, -1.2, 2.4).rotateX(-Math.PI / 2);
    const m = new THREE.Mesh(g, this.basicMat(color, 0.55, true, THREE.DoubleSide));
    m.position.set(u.pos.x, u.pos.y + 1.1, u.pos.z);
    m.rotation.y = u.yaw + Math.PI / 2;
    this.timed(m, 0.3, (o, k) => { o.material.opacity = 0.55 * (1 - k); o.rotation.y = u.yaw + Math.PI / 2 - k * 1.2; o.scale.setScalar(1 + k * 0.4); });
  }
  pillar(pos, color = 0xffe68a, dur = 0.8) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 14, 16, 1, true), this.basicMat(color, 0.6, true, THREE.DoubleSide));
    const y = pos.y ?? G.world.groundAt(pos.x, pos.z);
    m.position.set(pos.x, y + 7, pos.z);
    this.timed(m, dur, (o, k) => { o.scale.set(lerp(1.4, 0.2, k), 1, lerp(1.4, 0.2, k)); o.material.opacity = 0.6 * (1 - k); });
    this.burst({ x: pos.x, y, z: pos.z }, color === 0xff7a2a ? 'fire' : 'holy', { n: 30, r: 2 });
  }
  beam(a, b, color = 0xa8d8ff, dur = 0.35) {
    const pa = a.pos ? new THREE.Vector3(a.pos.x, a.pos.y + (a.height || 2) * 0.6, a.pos.z) : new THREE.Vector3(a.x, a.y, a.z);
    const pb = b.pos ? new THREE.Vector3(b.pos.x, b.pos.y + (b.height || 2) * 0.55, b.pos.z) : new THREE.Vector3(b.x, b.y, b.z);
    const pts = [pa];
    const segs = 7;
    for (let i = 1; i < segs; i++) { const p = pa.clone().lerp(pb, i / segs); p.x += rand(-0.4, 0.4); p.y += rand(-0.4, 0.4); p.z += rand(-0.4, 0.4); pts.push(p); }
    pts.push(pb);
    const grp = new THREE.Group();
    const mat = this.basicMat(color, 1);
    for (let i = 0; i < pts.length - 1; i++) {
      const s = pts[i], e = pts[i + 1];
      const len = s.distanceTo(e);
      const m = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, len, 4, 1, true), mat);
      m.position.copy(s).lerp(e, 0.5);
      m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), e.clone().sub(s).normalize());
      grp.add(m);
    }
    this.timed(grp, dur, (o, k) => { mat.opacity = 1 - k; });
    this.burst({ x: pb.x, y: pb.y - 0.8, z: pb.z }, 'lightning', { n: 6, y: 0.8 });
  }
  groundFx(pos, r, color = 0xff6a1a, dur = 6) {
    const geo = this.conformDisc(pos.x, pos.z, r, 0.15);
    const m = new THREE.Mesh(geo, this.basicMat(color, 0.45));
    this.timed(m, dur, (o, k, dt) => {
      o.material.opacity = 0.35 + Math.sin(G.time * 8) * 0.08 * (1 - k);
      if (k > 0.85) o.material.opacity *= (1 - k) / 0.15;
      if (Math.random() < dt * 20) { const a = Math.random() * TAU, d = Math.sqrt(Math.random()) * r; this.emitOne(color === 0xff6a1a ? 'fire' : 'arcane', pos.x + Math.cos(a) * d, G.world.groundAt(pos.x, pos.z) + 0.2, pos.z + Math.sin(a) * d, 0, 2, 0); }
    });
  }
  conformDisc(x, z, r, lift = 0.12, seg = 32, rings = 4) {
    const g = new THREE.CircleGeometry(r, seg).rotateX(-Math.PI / 2);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const vx = p.getX(i) + x, vz = p.getZ(i) + z; p.setXYZ(i, vx, G.world.groundAt(vx, vz) + lift, vz); }
    return g;
  }
  meteor(pos, dur) {
    const m = new THREE.Mesh(new THREE.IcosahedronGeometry(1.1, 1), this.basicMat(0xff8a2a, 1, false));
    const gy = G.world.groundAt(pos.x, pos.z);
    this.timed(m, dur, (o, k) => {
      o.position.set(pos.x - 10 * (1 - k), gy + 30 * (1 - k), pos.z - 6 * (1 - k));
      this.emitOne('fire', o.position.x, o.position.y, o.position.z, rand(-1, 1), rand(0, 2), rand(-1, 1), 2);
      this.emitOne('smoke', o.position.x, o.position.y + 0.5, o.position.z, 0, 1, 0, 1);
    });
  }
  smite(t) {
    const p = t.pos;
    this.pillar({ x: p.x, y: p.y, z: p.z }, 0xffe68a, 0.5);
  }
  arrowRain(pos, r) {
    for (let i = 0; i < 6; i++) {
      const a = Math.random() * TAU, d = Math.sqrt(Math.random()) * r;
      const x = pos.x + Math.cos(a) * d, z = pos.z + Math.sin(a) * d, gy = G.world.groundAt(x, z);
      const m = new THREE.Mesh(this.arrowGeo(), new THREE.MeshLambertMaterial({ vertexColors: true }));
      m.rotation.x = Math.PI / 2;
      this.timed(m, 0.35, (o, k) => { o.position.set(x - 1 + k, gy + 12 * (1 - k) + 0.3, z); if (k > 0.95) this.burst({ x, y: gy, z }, 'dust', { n: 2, y: 0.1 }); });
    }
  }
  knives(u) {
    for (let i = 0; i < 10; i++) {
      const a = i / 10 * TAU;
      const m = new THREE.Mesh(box(0.06, 0.06, 0.5), this.basicMat(0xe8e8f0, 1, false));
      this.timed(m, 0.3, (o, k) => { const d = 0.5 + k * 7; o.position.set(u.pos.x + Math.sin(a) * d, u.pos.y + 1.1, u.pos.z + Math.cos(a) * d); o.rotation.y = a; o.material.opacity = 1 - k; });
    }
  }
  spear(u, yaw, len) {
    const b = new Builder(1);
    b.add(cone(0.25, 1.2, 5), { p: [0, 0, 0.6], r: [Math.PI / 2, 0, 0], color: 0xf0e8d0 });
    b.add(cyl(0.12, 0.12, 2.5, 5), { p: [0, 0, -1.2], r: [Math.PI / 2, 0, 0], color: 0xd8d0b8 });
    const m = new THREE.Mesh(b.build(), new THREE.MeshLambertMaterial({ vertexColors: true, emissive: 0x3a1a5a }));
    const sx = u.pos.x, sz = u.pos.z, sy = u.pos.y + 1.2;
    m.rotation.y = yaw;
    this.timed(m, 0.45, (o, k) => { const d = k * len; o.position.set(sx + Math.sin(yaw) * d, sy, sz + Math.cos(yaw) * d); this.emitOne('shadow', o.position.x, o.position.y, o.position.z); });
  }
  tele(o) {
    // telegraph: shape circle|cone|rect|donut; returns object (call cancel to remove)
    const { shape = 'circle', x, z, r = 5, dur = 1.5, color = 0xff2a1a, angle = 0, w = 4, len = 12, inner = 0, friendly } = o;
    const grp = new THREE.Group();
    let geo, fillGeo;
    const y = G.world.groundAt(x, z);
    if (shape === 'circle' || shape === 'donut') {
      geo = this.conformDisc(x, z, r, 0.14, 40);
      grp.add(new THREE.Mesh(new THREE.RingGeometry(r - 0.18, r, 48).rotateX(-Math.PI / 2).translate(x, y + 0.2, z), this.basicMat(color, 0.9, false)));
      if (shape === 'donut') grp.add(new THREE.Mesh(new THREE.RingGeometry(inner - 0.1, inner + 0.1, 40).rotateX(-Math.PI / 2).translate(x, y + 0.2, z), this.basicMat(0x40ff60, 0.9, false)));
    } else if (shape === 'cone') {
      geo = new THREE.CircleGeometry(r, 24, Math.PI / 2 - angle / 2, angle).rotateX(-Math.PI / 2);
    } else {
      geo = new THREE.PlaneGeometry(w, len).rotateX(-Math.PI / 2).translate(0, 0, len / 2);
    }
    const base = new THREE.Mesh(geo, this.basicMat(color, 0.22, false));
    grp.add(base);
    const fill = new THREE.Mesh(geo.clone(), this.basicMat(color, 0.35, false));
    grp.add(fill);
    if (shape === 'cone' || shape === 'rect') {
      grp.position.set(x, y + 0.2, z);
      // cone geometry points along -Z, rect along +Z; unit forward is (sin yaw, cos yaw)
      grp.rotation.y = (o.yaw ?? 0) + (shape === 'cone' ? Math.PI : 0);
    }
    const item = { obj: grp, t: 0, dur, update: (ob, k) => {
      if (shape === 'circle') { fill.scale.set(k, 1, k); fill.position.set(x * (1 - k), 0, z * (1 - k)); }
      else if (shape === 'donut') { fill.material.opacity = 0.2 + 0.3 * k; }
      else if (shape === 'rect') fill.scale.set(1, 1, k);
      else fill.scale.set(k, 1, k);
      base.material.opacity = 0.18 + 0.12 * Math.sin(G.time * 12);
    } };
    this.root.add(grp);
    this.items.push(item);
    return { cancel: () => { item.t = item.dur; } };
  }
  lootBeam(pos, color, dur = 9999) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.35, 6, 8, 1, true), this.basicMat(color, 0.55, true, THREE.DoubleSide));
    m.position.set(pos.x, pos.y + 3, pos.z);
    const it = this.timed(m, dur, (o, k) => { o.material.opacity = 0.35 + Math.sin(G.time * 3) * 0.15; o.rotation.y += 0.02; });
    return { mesh: m, remove: () => { const x = this.items.find(i => i.obj === m); if (x) x.t = x.dur; } };
  }
  castGlow(u, theme) {
    const col = { fire: 0xff7a2a, frost: 0x8ad8ff, arcane: 0xd68aff, holy: 0xffe68a, gold: 0xffe68a, shadow: 0xb48aff, nature: 0x8aff6a, poison: 0x8aff6a, blood: 0xff4a4a, lightning: 0xc8e8ff }[theme] || 0xffffff;
    const preset = { fire: 'fire', frost: 'frost', arcane: 'arcane', holy: 'holy', gold: 'holy', shadow: 'shadow', nature: 'nature', poison: 'poison', blood: 'blood', lightning: 'lightning' }[theme] || 'arcane';
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.7, 0.95, 32).rotateX(-Math.PI / 2), this.basicMat(col, 0.7));
    this.timed(ring, 99, (o, k, dt) => {
      if (!u.cast || u.dead) { const it = this.items.find(i => i.obj === o); if (it) it.t = it.dur; return; }
      o.position.set(u.pos.x, u.pos.y + 0.12, u.pos.z); o.rotation.y += dt * 2; o.scale.setScalar(1 + Math.sin(G.time * 6) * 0.08);
      if (Math.random() < dt * 25) { const a = Math.random() * TAU; this.emitOne(preset, u.pos.x + Math.cos(a) * 0.8, u.pos.y + 0.2, u.pos.z + Math.sin(a) * 0.8, 0, 1.6, 0, 0.8); }
    });
  }
  levelUp(u) {
    this.pillar(u.pos, 0xffe68a, 1.6);
    this.ring(u.pos, 6, 0xffe68a, 1);
    this.burst(u.pos, 'levelup', { n: 60, r: 1.2 });
  }

  // ---------------------------------------------------------- projectiles
  arrowGeo() {
    if (this._arrow) return this._arrow;
    const b = new Builder(3);
    b.add(cyl(0.025, 0.025, 0.9, 4), { r: [Math.PI / 2, 0, 0], color: 0x8a6a3a });
    b.add(cone(0.05, 0.14, 4), { p: [0, 0, 0.5], r: [Math.PI / 2, 0, 0], color: 0xc8c8d0 });
    b.add(box(0.12, 0.01, 0.16), { p: [0, 0, -0.4], color: 0xf0f0f0 });
    b.add(box(0.01, 0.12, 0.16), { p: [0, 0, -0.4], color: 0xf0f0f0 });
    return (this._arrow = b.build());
  }
  projectile({ from, to, kind = 'magic', speed = 25, onHit }) {
    const start = new THREE.Vector3(from.pos.x + Math.sin(from.yaw) * 0.5, from.pos.y + (from.height || 2) * 0.62, from.pos.z + Math.cos(from.yaw) * 0.5);
    let mesh, trail = null, col = 0xffffff, scale = 0.3;
    const K = {
      fireball: [0xff8a2a, 'fire', 0.45], frostbolt: [0x8ad8ff, 'frost', 0.35], arcane: [0xd68aff, 'arcane', 0.25], arcaneSmall: [0xd68aff, 'arcane', 0.18],
      holy: [0xffe68a, 'holy', 0.35], holySmall: [0xffe68a, 'holy', 0.18], shadow: [0xa86aff, 'shadow', 0.4], shadowSmall: [0xa86aff, 'shadow', 0.2],
      poison: [0x8aff6a, 'poison', 0.25], magic: [0xffffff, 'arcane', 0.25], fire: [0xff8a2a, 'fire', 0.3], rock: [0x8a7a6a, 'dust', 0.5], web: [0xf0f0f0, 'smoke', 0.4],
      spit: [0x8aff6a, 'poison', 0.3], ice: [0x8ad8ff, 'frost', 0.4], void: [0x8a3aff, 'shadow', 0.45],
    }[kind];
    if (kind === 'arrow' || kind === 'arrowBig') {
      mesh = new THREE.Mesh(this.arrowGeo(), new THREE.MeshLambertMaterial({ vertexColors: true }));
      if (kind === 'arrowBig') { mesh.scale.setScalar(1.4); trail = 'sparks'; }
    } else {
      col = K ? K[0] : 0xffffff; trail = K ? K[1] : 'arcane'; scale = K ? K[2] : 0.3;
      mesh = new THREE.Mesh(new THREE.IcosahedronGeometry(scale, 1), this.basicMat(col, 1, false));
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: blobTexture(), color: col, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.8 }));
      glow.scale.setScalar(scale * 5);
      mesh.add(glow);
    }
    mesh.position.copy(start);
    this.root.add(mesh);
    this.projs.push({ mesh, to, speed, onHit, trail, t: 0, kind });
  }
  updateProjectiles(dt) {
    const tmp = new THREE.Vector3();
    for (let i = this.projs.length - 1; i >= 0; i--) {
      const p = this.projs[i];
      p.t += dt;
      const tgt = p.to.pos ? tmp.set(p.to.pos.x, p.to.pos.y + (p.to.height || 2) * 0.55, p.to.pos.z) : tmp.set(p.to.x, p.to.y, p.to.z);
      const d = p.mesh.position.distanceTo(tgt);
      const step = p.speed * dt;
      if (d <= step + 0.3 || p.t > 4) {
        this.projs.splice(i, 1);
        p.mesh.removeFromParent(); p.mesh.geometry !== this._arrow && p.mesh.geometry.dispose();
        try { p.onHit?.(); } catch (e) { console.error(e); }
        if (p.trail && p.kind !== 'arrow') this.burst(tgt, p.trail, { n: 12, y: 0, r: 0.2 });
        continue;
      }
      const dir = tgt.clone().sub(p.mesh.position).normalize();
      p.mesh.position.addScaledVector(dir, step);
      if (p.kind.startsWith('arrow')) { p.mesh.lookAt(tgt); }
      if (p.trail) {
        const n = p.kind.startsWith('arrow') ? 1 : 3;
        for (let k = 0; k < n; k++) this.emitOne(p.trail, p.mesh.position.x + rand(-0.1, 0.1), p.mesh.position.y + rand(-0.1, 0.1), p.mesh.position.z + rand(-0.1, 0.1), rand(-0.4, 0.4), rand(-0.2, 0.6), rand(-0.4, 0.4), 0.8);
      }
    }
  }

  // ---------------------------------------------------------- auras (buff visuals)
  aura(u, type, dur, buffId) {
    let obj = null;
    const mk = (col, op = 0.25) => { const m = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 2), this.basicMat(col, op)); m.scale.set(u.radius * 2 + 0.4, u.height * 0.65, u.radius * 2 + 0.4); m.position.y = u.height * 0.5; return m; };
    switch (type) {
      case 'shield': obj = mk(0xc8d8ff, 0.18); break;
      case 'holyShield': obj = mk(0xffe68a, 0.22); break;
      case 'arcaneShield': obj = mk(0xd68aff, 0.2); break;
      case 'bone': {
        obj = new THREE.Group();
        for (let i = 0; i < 4; i++) { const b = new THREE.Mesh(box(0.08, 0.5, 0.08), new THREE.MeshLambertMaterial({ color: 0xf0e8d0 })); b.userData.a = i / 4 * TAU; obj.add(b); }
        break;
      }
      case 'stun': {
        obj = new THREE.Group();
        for (let i = 0; i < 3; i++) { const s = new THREE.Mesh(octa(0.12), this.basicMat(0xffe040, 1, false)); s.userData.a = i / 3 * TAU; obj.add(s); }
        obj.position.y = u.height + 0.2;
        break;
      }
      case 'frozen': { const m = new THREE.Mesh(new THREE.CylinderGeometry(u.radius + 0.25, u.radius + 0.4, 0.9, 6), this.basicMat(0xa8e8ff, 0.4, false)); m.position.y = 0.4; obj = m; break; }
      case 'mark': { const m = new THREE.Mesh(new THREE.ConeGeometry(0.25, 0.5, 4).rotateX(Math.PI), this.basicMat(0xff3a2a, 0.9, false)); m.position.y = u.height + 0.7; obj = m; break; }
      case 'wings': {
        obj = new THREE.Group();
        for (const s of [1, -1]) { const w = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.8), this.basicMat(0xffe68a, 0.45, true, THREE.DoubleSide)); w.position.set(0.8 * s, u.height * 0.7, -0.3); w.rotation.y = 0.5 * s; w.rotation.z = -0.3 * s; obj.add(w); }
        break;
      }
    }
    if (obj) u.group.add(obj);
    this.auras.push({ u, type, obj, buffId, t: 0, dur });
  }
  updateAuras(dt) {
    for (let i = this.auras.length - 1; i >= 0; i--) {
      const a = this.auras[i];
      a.t += dt;
      const u = a.u;
      const alive = !u.removed && !u.dead && (a.buffId ? u.buffs.some(b => b.id === a.buffId) : a.t < a.dur);
      if (!alive) { this.auras.splice(i, 1); if (a.obj) { a.obj.removeFromParent(); a.obj.traverse(o => o.geometry?.dispose()); } continue; }
      if (!u.group.visible) continue;
      const p = u.pos, h = u.height;
      const em = (preset, rate, spread = u.radius + 0.2, y0 = 0.2, y1 = h) => { if (Math.random() < dt * rate) { const an = Math.random() * TAU; this.emitOne(preset, p.x + Math.cos(an) * spread, p.y + rand(y0, y1), p.z + Math.sin(an) * spread, 0, 0.6, 0); } };
      switch (a.type) {
        case 'stun': a.obj.rotation.y += dt * 4; a.obj.children.forEach(c => { c.position.set(Math.cos(c.userData.a + G.time * 4) * 0.35, 0, Math.sin(c.userData.a + G.time * 4) * 0.35); }); break;
        case 'bone': a.obj.children.forEach(c => { const an = c.userData.a + G.time * 2; c.position.set(Math.cos(an) * (u.radius + 0.6), h * 0.55 + Math.sin(an * 2) * 0.2, Math.sin(an) * (u.radius + 0.6)); c.rotation.z = an; }); break;
        case 'shield': case 'holyShield': case 'arcaneShield': a.obj.rotation.y += dt; a.obj.material.opacity = 0.15 + Math.sin(G.time * 4) * 0.05; break;
        case 'mark': a.obj.position.y = h + 0.7 + Math.sin(G.time * 4) * 0.12; a.obj.rotation.y += dt * 2; break;
        case 'burn': em('fire', 18); break;
        case 'burnHoly': em('holy', 14); break;
        case 'poison': em('poison', 10); break;
        case 'bleed': em('blood', 6, 0.3, h * 0.4, h * 0.8); break;
        case 'shadowDot': em('shadow', 10); break;
        case 'renew': em('heal', 8); break;
        case 'berserk': em('fire', 25); break;
        case 'haste': em('lightning', 12); break;
        case 'lich': em('shadow', 30); break;
        case 'chill': em('frost', 8); break;
        case 'fear': em('shadow', 12, 0.3, h, h + 0.3); break;
        case 'wings': em('holy', 15); break;
      }
    }
  }

  update(dt) {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i];
      it.t += dt;
      const k = clamp(it.t / it.dur, 0, 1);
      if (it.t >= it.dur) {
        this.items.splice(i, 1); it.obj.removeFromParent();
        it.obj.traverse(o => { if (o.geometry && o.geometry !== this._arrow) o.geometry.dispose(); if (o.material && o.material.dispose) o.material.dispose(); });
        continue;
      }
      it.update?.(it.obj, k, dt);
    }
    this.updateProjectiles(dt);
    this.updateAuras(dt);
    this.add.update(dt); this.norm.update(dt);
  }
  clear() {
    for (const it of this.items) it.obj.removeFromParent();
    for (const p of this.projs) p.mesh.removeFromParent();
    this.items = []; this.projs = [];
  }
}

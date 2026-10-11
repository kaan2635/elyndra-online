// Shared math / misc helpers used across the whole game.

export const TAU = Math.PI * 2;
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const invLerp = (a, b, v) => clamp((v - a) / (b - a), 0, 1);
export const smoothstep = (a, b, v) => { const t = invLerp(a, b, v); return t * t * (3 - 2 * t); };
export const damp = (a, b, lambda, dt) => lerp(a, b, 1 - Math.exp(-lambda * dt));
export const rand = (a = 0, b = 1) => a + Math.random() * (b - a);
export const randi = (a, b) => Math.floor(a + Math.random() * (b - a + 1));
export const chance = p => Math.random() < p;
export const choice = arr => arr[Math.floor(Math.random() * arr.length)];
export const dist2 = (ax, az, bx, bz) => { const dx = ax - bx, dz = az - bz; return Math.sqrt(dx * dx + dz * dz); };
export const distSq2 = (ax, az, bx, bz) => { const dx = ax - bx, dz = az - bz; return dx * dx + dz * dz; };

export function angleDiff(a, b) {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
}
export function dampAngle(a, b, lambda, dt) { return a + angleDiff(a, b) * (1 - Math.exp(-lambda * dt)); }

// Seeded RNG (mulberry32)
export function rng(seed) {
  let s = seed >>> 0;
  const r = () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  r.range = (a, b) => a + r() * (b - a);
  r.int = (a, b) => Math.floor(a + r() * (b - a + 1));
  r.pick = arr => arr[Math.floor(r() * arr.length)];
  r.chance = p => r() < p;
  return r;
}

export function hashStr(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

let _uid = Date.now() % 1e6;
export const uid = (p = '') => p + (++_uid).toString(36) + Math.floor(Math.random() * 1296).toString(36);

export function weighted(list, wKey = 'w', r = Math.random) {
  let total = 0;
  for (const it of list) total += it[wKey];
  let x = r() * total;
  for (const it of list) { x -= it[wKey]; if (x <= 0) return it; }
  return list[list.length - 1];
}

export function shuffle(arr, r = Math.random) {
  for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; }
  return arr;
}

export function fmtNum(n) {
  n = Math.round(n);
  if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(n >= 1e7 ? 0 : 1) + 'M';
  if (Math.abs(n) >= 1e4) return (n / 1e3).toFixed(n >= 1e5 ? 0 : 1) + 'k';
  return String(n);
}
export function fmtGold(n) { return fmtNum(n); }
export function fmtTime(sec) {
  sec = Math.max(0, Math.ceil(sec));
  if (sec >= 3600) return Math.floor(sec / 3600) + 'h ' + Math.floor((sec % 3600) / 60) + 'm';
  if (sec >= 60) return Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0');
  return sec + 's';
}
export function fmtCd(sec) {
  if (sec >= 60) return Math.ceil(sec / 60) + 'm';
  if (sec >= 10) return String(Math.ceil(sec));
  return sec.toFixed(1);
}

export const isTouch = () => (typeof window !== 'undefined') && (/[?&]touch=1/.test(location.search) || ('ontouchstart' in window) || matchMedia('(pointer: coarse)').matches);

// Simple emitter
export class Emitter {
  constructor() { this._h = new Map(); }
  on(ev, fn) { if (!this._h.has(ev)) this._h.set(ev, new Set()); this._h.get(ev).add(fn); return () => this.off(ev, fn); }
  off(ev, fn) { this._h.get(ev)?.delete(fn); }
  emit(ev, ...args) { const s = this._h.get(ev); if (s) for (const fn of [...s]) { try { fn(...args); } catch (e) { console.error(e); } } }
}

// Hex <-> rgb helpers (numbers)
export function hexToRgb(h) { return [(h >> 16) & 255, (h >> 8) & 255, h & 255]; }
export function mixHex(a, b, t) {
  const A = hexToRgb(a), B = hexToRgb(b);
  return (Math.round(lerp(A[0], B[0], t)) << 16) | (Math.round(lerp(A[1], B[1], t)) << 8) | Math.round(lerp(A[2], B[2], t));
}
export function shadeHex(h, f) {
  const [r, g, b] = hexToRgb(h);
  const c = v => clamp(Math.round(f >= 0 ? v + (255 - v) * f : v * (1 + f)), 0, 255);
  return (c(r) << 16) | (c(g) << 8) | c(b);
}
export const hexCss = h => '#' + h.toString(16).padStart(6, '0');

// Min-heap used by A* and schedulers
export class Heap {
  constructor(score) { this.a = []; this.score = score; }
  get size() { return this.a.length; }
  push(x) { const a = this.a; a.push(x); let i = a.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (this.score(a[i]) >= this.score(a[p])) break; [a[i], a[p]] = [a[p], a[i]]; i = p; } }
  pop() {
    const a = this.a; const top = a[0]; const last = a.pop();
    if (a.length) {
      a[0] = last; let i = 0;
      for (;;) {
        const l = i * 2 + 1, r = l + 1; let m = i;
        if (l < a.length && this.score(a[l]) < this.score(a[m])) m = l;
        if (r < a.length && this.score(a[r]) < this.score(a[m])) m = r;
        if (m === i) break; [a[i], a[m]] = [a[m], a[i]]; i = m;
      }
    }
    return top;
  }
}

export function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function deepClone(o) { return JSON.parse(JSON.stringify(o)); }

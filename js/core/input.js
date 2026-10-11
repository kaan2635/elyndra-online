// Unified keyboard / mouse / touch input with a floating virtual joystick.
import { G } from './state.js';
import { clamp, isTouch } from './util.js';

export class Input {
  constructor(el) {
    this.el = el;
    this.keys = new Set();
    this.down = new Set();     // pressed this frame
    this.touch = isTouch();
    this.joy = { active: false, id: null, sx: 0, sy: 0, x: 0, y: 0, vx: 0, vy: 0 };
    this.cam = { id: null, lx: 0, ly: 0 };
    this.pinch = null;
    this.pointers = new Map();
    this.onTap = null;         // (clientX, clientY, button) => void
    this.onKey = null;         // (code, event) => bool handled
    this.onWheel = null;
    this.mouseDrag = null;
    this.enabled = true;
    this.fixedJoy = false;
    G.input = this;

    window.addEventListener('keydown', e => {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
      if (!this.keys.has(e.code)) this.down.add(e.code);
      this.keys.add(e.code);
      if (this.onKey && this.onKey(e.code, e)) e.preventDefault();
      if (['Tab', 'Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
    });
    window.addEventListener('keyup', e => this.keys.delete(e.code));
    window.addEventListener('blur', () => { this.keys.clear(); this.resetJoy(); });

    el.addEventListener('contextmenu', e => e.preventDefault());
    el.addEventListener('pointerdown', e => this.pDown(e));
    window.addEventListener('pointermove', e => this.pMove(e), { passive: false });
    window.addEventListener('pointerup', e => this.pUp(e));
    window.addEventListener('pointercancel', e => this.pUp(e, true));
    el.addEventListener('wheel', e => { e.preventDefault(); this.onWheel?.(e.deltaY); }, { passive: false });
  }

  resetJoy() { this.joy.active = false; this.joy.id = null; this.joy.vx = this.joy.vy = 0; G.ui?.joystick?.(null); }

  pDown(e) {
    if (!this.enabled) return;
    this.el.setPointerCapture?.(e.pointerId);
    const p = { id: e.pointerId, x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, t: performance.now(), btn: e.button, type: e.pointerType, moved: 0 };
    this.pointers.set(e.pointerId, p);
    const W = window.innerWidth, H = window.innerHeight;
    if (e.pointerType !== 'mouse') {
      // left-lower region starts the joystick
      if (!this.joy.active && e.clientX < W * 0.42 && e.clientY > H * 0.3) {
        this.joy.active = true; this.joy.id = e.pointerId;
        if (this.fixedJoy) { this.joy.sx = Math.min(W * 0.2, 150); this.joy.sy = H - Math.min(H * 0.25, 150); }
        else { this.joy.sx = e.clientX; this.joy.sy = e.clientY; }
        this.joy.x = e.clientX; this.joy.y = e.clientY; this.updJoy();
        p.joy = true;
        return;
      }
      const others = [...this.pointers.values()].filter(q => !q.joy && q.id !== e.pointerId);
      if (others.length === 1) {
        const o = others[0];
        this.pinch = { a: o.id, b: e.pointerId, d: Math.hypot(o.x - e.clientX, o.y - e.clientY) };
      }
    }
  }
  pMove(e) {
    const p = this.pointers.get(e.pointerId);
    if (!p) return;
    const dx = e.clientX - p.x, dy = e.clientY - p.y;
    p.x = e.clientX; p.y = e.clientY;
    p.moved += Math.abs(dx) + Math.abs(dy);
    if (p.joy) { this.joy.x = e.clientX; this.joy.y = e.clientY; this.updJoy(); return; }
    if (this.pinch && (e.pointerId === this.pinch.a || e.pointerId === this.pinch.b)) {
      const A = this.pointers.get(this.pinch.a), B = this.pointers.get(this.pinch.b);
      if (A && B) {
        const d = Math.hypot(A.x - B.x, A.y - B.y);
        const k = this.pinch.d / Math.max(10, d);
        const c = G.engine.cam; c.tDist = clamp(c.tDist * k, c.minDist, c.maxDist);
        this.pinch.d = d;
      }
      return;
    }
    // camera drag (mouse: any button held; touch: non-joystick finger)
    if (p.type === 'mouse' && e.buttons === 0) return;
    if (p.moved > 4) {
      const c = G.engine.cam;
      const sens = p.type === 'mouse' ? 0.0055 : 0.0075;
      c.yaw -= dx * sens;
      c.pitch = clamp(c.pitch + dy * sens * 0.8, c.minPitch, c.maxPitch);
      e.preventDefault?.();
    }
  }
  pUp(e, cancel) {
    const p = this.pointers.get(e.pointerId);
    if (!p) return;
    this.pointers.delete(e.pointerId);
    if (p.joy) { this.resetJoy(); return; }
    if (this.pinch && (e.pointerId === this.pinch.a || e.pointerId === this.pinch.b)) { this.pinch = null; return; }
    const dt = performance.now() - p.t;
    if (!cancel && p.moved < 12 && dt < 450) this.onTap?.(e.clientX, e.clientY, p.btn, p.type);
  }
  updJoy() {
    const j = this.joy, R = 56;
    let dx = j.x - j.sx, dy = j.y - j.sy;
    const d = Math.hypot(dx, dy);
    if (d > R) {
      if (!this.fixedJoy) { j.sx = j.x - dx / d * R; j.sy = j.y - dy / d * R; }
      dx = dx / d * R; dy = dy / d * R;
    }
    j.vx = dx / R; j.vy = dy / R;
    const m = Math.hypot(j.vx, j.vy);
    if (m < 0.12) { j.vx = 0; j.vy = 0; }
    G.ui?.joystick?.(j);
  }

  // Movement intent in camera space: {x: right, y: forward} each -1..1
  moveIntent() {
    let x = 0, y = 0;
    const k = this.keys;
    if (k.has('KeyW') || k.has('ArrowUp')) y += 1;
    if (k.has('KeyS') || k.has('ArrowDown')) y -= 1;
    if (k.has('KeyD') || k.has('ArrowRight')) x += 1;
    if (k.has('KeyA') || k.has('ArrowLeft')) x -= 1;
    if (this.joy.active) { x += this.joy.vx; y -= this.joy.vy; }
    const m = Math.hypot(x, y);
    if (m > 1) { x /= m; y /= m; }
    return { x, y, m: Math.min(1, m) };
  }
  pressed(code) { return this.down.has(code); }
  endFrame() { this.down.clear(); }
}

/* ==========================================================================
 *  audio.js - fully procedural audio engine (Web Audio API, no asset files)
 *  ------------------------------------------------------------------------
 *  - SFX      : ~80 synthesized one-shots (filtered noise, FM, detuned oscs)
 *  - Music    : generative themes scheduled with a lookahead scheduler on
 *               AudioContext time, plus a crossfaded combat layer
 *  - Ambience : looping filtered-noise beds with random events
 *  - Mix      : per-bus volumes, shared convolution reverb (procedural IR),
 *               tempo-synced echo, glue compressor and brick-wall limiter
 *  Safe to import anywhere: when Web Audio is missing every call is a no-op.
 * ========================================================================== */

/* -------------------------------------------------------------------------- */
/* 1. Utilities                                                               */
/* -------------------------------------------------------------------------- */

const HAS_WIN = typeof window !== 'undefined';
const HAS_DOC = typeof document !== 'undefined';
const AC = HAS_WIN ? (window.AudioContext || window.webkitAudioContext || null) : null;

const rand = (a, b) => a + Math.random() * (b - a);
const randi = (a, b) => Math.floor(a + Math.random() * (b - a + 1));
const pick = (arr) => arr[(Math.random() * arr.length) | 0];
const chance = (p) => Math.random() < p;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const mod = (n, m) => ((n % m) + m) % m;
const N = (m) => 440 * Math.pow(2, (m - 69) / 12);            // midi -> Hz
const msNow = () => (typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now());
const EPS = 0.0001;
const volCurve = (v) => Math.pow(clamp(Number(v) || 0, 0, 1), 1.6); // perceptual slider curve
const PENTA = [0, 2, 4, 7, 9];

/* -------------------------------------------------------------------------- */
/* 2. Engine state                                                            */
/* -------------------------------------------------------------------------- */

let ctx = null;            // AudioContext (created lazily, inside a user gesture)
let G = null;              // master graph nodes
let NB = null;             // shared noise buffers { white, pink, brown }
let everUnlocked = false;
let listening = false;
let initDone = false;
let hidden = false;
let tickTimer = 0;
let activeVoices = 0;

const vols = { master: 0.8, music: 0.6, sfx: 0.8, ambient: 0.6 };
const want = { music: null, ambient: 'none', combat: false };   // latest requests
const songs = [];          // live Song instances (current + fading out)
const beds = [];           // live ambience beds (current + fading out)
let curSong = null;
let curBed = null;

const MAX_VOICES = 40;     // concurrent SFX voices
const THROTTLE_MS = 80;
const THROTTLE_N = 6;
const recent = new Map();  // sfx name -> recent start times (ms)

const isRunning = () => !!(ctx && G && ctx.state === 'running' && !hidden);

/* -------------------------------------------------------------------------- */
/* 3. Context, master graph, shared buffers                                   */
/* -------------------------------------------------------------------------- */

function gn(v = 1) { const g = ctx.createGain(); g.gain.value = v; return g; }
function bq(type, f, q) {
  const b = ctx.createBiquadFilter();
  b.type = type; b.frequency.value = f;
  if (q != null) b.Q.value = q;
  return b;
}
function off(n) { try { n.disconnect(); } catch (e) { /* already disconnected */ } }

function createContext() {
  if (ctx || !AC) return ctx;
  try { ctx = new AC({ latencyHint: 'interactive' }); }
  catch (e) { try { ctx = new AC(); } catch (e2) { ctx = null; } }
  if (!ctx) return null;
  try {
    NB = makeNoise();
    G = buildGraph();
  } catch (e) {
    try { ctx.close(); } catch (e2) { /* ignore */ }
    ctx = null; G = null; NB = null;
    return null;
  }
  ctx.onstatechange = onStateChange;
  return ctx;
}

// Noise buffers: 4 s each, with a crossfaded loop seam so looping never clicks.
function makeNoise() {
  const sr = ctx.sampleRate, len = Math.floor(sr * 4), fade = 4096, total = len + fade;
  const w = new Float32Array(total), p = new Float32Array(total), b = new Float32Array(total);
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, br = 0;
  for (let i = 0; i < total; i++) {
    const x = Math.random() * 2 - 1;
    w[i] = x;
    // Paul Kellet's pink filter
    b0 = 0.99886 * b0 + x * 0.0555179; b1 = 0.99332 * b1 + x * 0.0750759;
    b2 = 0.96900 * b2 + x * 0.1538520; b3 = 0.86650 * b3 + x * 0.3104856;
    b4 = 0.55000 * b4 + x * 0.5329522; b5 = -0.7616 * b5 - x * 0.0168980;
    p[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + x * 0.5362) * 0.11; b6 = x * 0.115926;
    // leaky-integrated brown noise
    br = (br + 0.02 * x) / 1.02; b[i] = br * 3.5;
  }
  const toBuf = (src) => {
    const buf = ctx.createBuffer(1, len, sr), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = src[i];
    for (let i = 0; i < fade; i++) { const k = i / fade; d[i] = src[i] * k + src[len + i] * (1 - k); }
    return buf;
  };
  return { white: toBuf(w), pink: toBuf(p), brown: toBuf(b) };
}

// Procedural stereo impulse response: early reflections + darkening exponential tail.
function makeIR(sec = 2.8, rt60 = 2.3) {
  const sr = ctx.sampleRate, len = Math.floor(sr * sec), pre = Math.floor(sr * 0.012);
  const buf = ctx.createBuffer(2, len, sr);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    let lp = 0;
    for (let i = pre; i < len; i++) {
      const t = (i - pre) / sr, k = i / len;
      const env = Math.exp(-6.9 * t / rt60) * (1 - k * k);
      lp += (0.8 - 0.65 * k) * ((Math.random() * 2 - 1) - lp);   // high end decays faster
      d[i] = lp * env;
    }
    for (let i = 0; i < 256; i++) d[pre + i] *= i / 256;            // soft onset
    for (let r = 0; r < 14; r++) {                                   // early reflections
      const i = pre + Math.floor(sr * rand(0.005, 0.085));
      d[i] += (chance(0.5) ? -1 : 1) * rand(0.25, 0.7) * (1 - r / 16);
    }
  }
  return buf;
}

function buildGraph() {
  const mix = gn(0.85);
  const hp = bq('highpass', 30, 0.6);                       // remove sub rumble / DC
  const comp = ctx.createDynamicsCompressor();              // gentle glue
  comp.threshold.value = -16; comp.knee.value = 10; comp.ratio.value = 3.5;
  comp.attack.value = 0.006; comp.release.value = 0.22;
  const lim = ctx.createDynamicsCompressor();               // brick-wall safety
  lim.threshold.value = -3; lim.knee.value = 0; lim.ratio.value = 20;
  lim.attack.value = 0.0008; lim.release.value = 0.08;
  const master = gn(volCurve(vols.master));
  // Final safety: transparent below -2 dBFS, soft-saturates above so output never hard-clips.
  const clip = ctx.createWaveShaper();
  const curve = new Float32Array(1025);
  for (let i = 0; i < curve.length; i++) {
    const x = (i / 512) - 1, ax = Math.abs(x);
    curve[i] = ax < 0.8 ? x : Math.sign(x) * (0.8 + 0.18 * Math.tanh((ax - 0.8) / 0.18));
  }
  clip.curve = curve;
  mix.connect(hp); hp.connect(comp); comp.connect(lim); lim.connect(master); master.connect(clip); clip.connect(ctx.destination);

  // Shared reverb
  const revIn = gn(1), revHp = bq('highpass', 180, 0.7), conv = ctx.createConvolver(), revOut = gn(0.7);
  conv.buffer = makeIR();
  revIn.connect(revHp); revHp.connect(conv); conv.connect(revOut); revOut.connect(mix);

  // Tempo echo (used by music), filtered feedback, feeds the reverb as well
  const dIn = gn(1), dly = ctx.createDelay(1.5), fb = gn(0.32), dlp = bq('lowpass', 2400, 0.5), dOut = gn(0.55);
  dly.delayTime.value = 0.4;
  dIn.connect(dly); dly.connect(dlp); dlp.connect(fb); fb.connect(dly);
  dlp.connect(dOut); dOut.connect(mix); dOut.connect(revIn);

  const bus = (v) => {
    const dry = gn(v), wet = gn(v);
    dry.connect(mix); wet.connect(revIn);
    return { in: dry, rev: wet };
  };
  const music = bus(volCurve(vols.music));
  music.dly = gn(volCurve(vols.music)); music.dly.connect(dIn);
  const sfx = bus(volCurve(vols.sfx));
  const amb = bus(volCurve(vols.ambient));
  return { mix, master, comp, lim, revIn, dly, music, sfx, amb };
}

function applyVolumes() {
  if (!G) return;
  const t = ctx.currentTime;
  const set = (p, v) => { p.cancelScheduledValues(t); p.setTargetAtTime(v, t, 0.04); };
  set(G.master.gain, volCurve(vols.master));
  const pairs = [[G.music, 'music'], [G.sfx, 'sfx'], [G.amb, 'ambient']];
  for (const [b, k] of pairs) {
    const v = volCurve(vols[k]);
    set(b.in.gain, v); set(b.rev.gain, v);
    if (b.dly) set(b.dly.gain, v);
  }
}

/* -------------------------------------------------------------------------- */
/* 4. The synth primitive                                                     */
/* -------------------------------------------------------------------------- */
/*
 * synth(dest, T, D, o) - one voice: sources -> [filter] -> [lp2] -> [AM] -> env
 * Absolute times. Every node is disconnected when the voice ends.
 *   o.f, o.type | o.osc [[type, ratio, detuneCents, level], ...]
 *   o.noise 'white'|'pink'|'brown', o.rate (playback rate)
 *   o.vol peak, o.a attack, o.h hold        -> exponential decay to T+D
 *   o.r release, o.sus, o.d (decay time)   -> sustained envelope instead
 *   o.to + o.gt pitch glide | o.fp [[t, Hz], ...] pitch points (relative t)
 *   o.lp | o.hp | o.bp | o.pk start cutoff, o.q, o.fto + o.ft sweep, o.ffp points
 *   o.lp2 extra lowpass, o.vib [rate, cents, delay], o.am [rate, depth 0..1]
 *   o.fm [ratio, index, indexEnd]  (index = modulation depth as multiple of f)
 */
function shape(p, T, D, peak, o) {
  const a = Math.max(0.001, o.a || 0.005);
  p.setValueAtTime(0, T);
  p.linearRampToValueAtTime(peak, T + a);
  if (o.r != null) {
    const sus = peak * (o.sus != null ? o.sus : 1);
    if (o.d) p.setTargetAtTime(sus, T + a, o.d / 3);
    const rs = Math.max(T + a + 0.01, T + D - o.r);
    p.setTargetAtTime(0, rs, Math.max(0.01, o.r / 5));
  } else {
    if (o.h) p.setValueAtTime(peak, T + a + o.h);
    p.exponentialRampToValueAtTime(EPS, T + D);
  }
}

function synth(dest, T, D, o) {
  const c = ctx;
  D = Math.max(D, (o.a || 0.005) + (o.h || 0) + 0.02);
  const stopAt = T + D + 0.03;
  const nodes = [];
  const srcs = [];
  const out = c.createGain();
  nodes.push(out);
  let head = out;

  // Amplitude modulation (tremolo / growl / crackle)
  if (o.am) {
    const depth = clamp(o.am[1], 0, 1);
    const amg = c.createGain(); amg.gain.value = 1 - depth / 2;
    const l = c.createOscillator(); l.frequency.value = o.am[0];
    const lg = c.createGain(); lg.gain.value = depth / 2;
    l.connect(lg); lg.connect(amg.gain); amg.connect(head); head = amg;
    l.start(T); l.stop(stopAt);
    nodes.push(amg, lg); srcs.push(l);
  }
  // Optional second lowpass (for band-limited noise)
  if (o.lp2) { const f2 = bq('lowpass', o.lp2, 0.5); f2.connect(head); head = f2; nodes.push(f2); }
  // Main filter
  const ft = o.lp ? 'lowpass' : o.hp ? 'highpass' : o.bp ? 'bandpass' : o.pk ? 'peaking' : null;
  if (ft) {
    const f0 = o.lp || o.hp || o.bp || o.pk;
    const f = c.createBiquadFilter(); f.type = ft;
    f.Q.value = o.q != null ? o.q : (ft === 'bandpass' ? 1.2 : 0.7);
    if (ft === 'peaking') f.gain.value = o.pkg || 9;
    f.frequency.setValueAtTime(f0, T);
    if (o.ffp) for (const [t, v] of o.ffp) f.frequency.exponentialRampToValueAtTime(clamp(v, 20, 20000), T + Math.max(0.002, t));
    else if (o.fto) f.frequency.exponentialRampToValueAtTime(clamp(o.fto, 20, 20000), T + (o.ft != null ? o.ft : D));
    f.connect(head); head = f; nodes.push(f);
  }

  let vol = o.vol != null ? o.vol : 0.2;
  if (o.noise) {
    const s = c.createBufferSource();
    s.buffer = NB[o.noise] || NB.white; s.loop = true;
    s.playbackRate.value = o.rate || 1;
    s.connect(head); s.start(T, Math.random() * 3.5); s.stop(stopAt);
    srcs.push(s);
  } else {
    const list = o.osc || [[o.type || 'sine', 1, 0]];
    vol /= Math.sqrt(list.length);                 // detuned stacks sum incoherently
    const f = o.f || 440;
    let fmg = null, vibG = null;
    if (o.fm) {
      const m = c.createOscillator(); m.frequency.setValueAtTime(f * o.fm[0], T);
      if (o.to) m.frequency.exponentialRampToValueAtTime(Math.max(1, o.to * o.fm[0]), T + (o.gt != null ? o.gt : D));
      fmg = c.createGain();
      fmg.gain.setValueAtTime(f * o.fm[1], T);
      fmg.gain.exponentialRampToValueAtTime(Math.max(0.01, f * (o.fm[2] != null ? o.fm[2] : 0.01)), T + D);
      m.connect(fmg); m.start(T); m.stop(stopAt);
      srcs.push(m); nodes.push(fmg);
    }
    if (o.vib) {
      const l = c.createOscillator(); l.frequency.value = o.vib[0];
      vibG = c.createGain();
      const vd = T + (o.vib[2] || 0);
      vibG.gain.setValueAtTime(0, T); vibG.gain.setValueAtTime(0, vd);
      vibG.gain.linearRampToValueAtTime(o.vib[1], vd + 0.25);
      l.connect(vibG); l.start(T); l.stop(stopAt);
      srcs.push(l); nodes.push(vibG);
    }
    for (const [type, ratio = 1, det = 0, lvl = 1] of list) {
      const s = c.createOscillator(); s.type = type;
      s.frequency.setValueAtTime(f * ratio, T);
      if (o.fp) for (const [t, hz] of o.fp) s.frequency.exponentialRampToValueAtTime(Math.max(1, hz * ratio), T + Math.max(0.002, t));
      else if (o.to) s.frequency.exponentialRampToValueAtTime(Math.max(1, o.to * ratio), T + (o.gt != null ? o.gt : D));
      if (det) s.detune.value = det;
      if (fmg) fmg.connect(s.frequency);
      if (vibG) vibG.connect(s.detune);
      if (lvl !== 1) { const lg = c.createGain(); lg.gain.value = lvl; s.connect(lg); lg.connect(head); nodes.push(lg); }
      else s.connect(head);
      s.start(T); s.stop(stopAt);
      srcs.push(s);
    }
  }
  shape(out.gain, T, D, vol, o);
  out.connect(dest);
  const last = srcs[srcs.length - 1];
  last.onended = () => { for (const s of srcs) off(s); for (const n of nodes) off(n); };
  return T + D;
}

/* -------------------------------------------------------------------------- */
/* 5. SFX voice wrapper (relative time, pitch, pan, reverb send, cleanup)     */
/* -------------------------------------------------------------------------- */

const SCALE_T = ['a', 'h', 'r', 'd', 'gt', 'ft'];
const SCALE_F = ['f', 'to', 'lp', 'hp', 'bp', 'pk', 'fto', 'lp2'];

class Voice {
  constructor(opts, name) {
    const pitch = clamp(Number(opts.pitch) || 1, 0.25, 4);
    this.p = pitch * rand(0.975, 1.025);        // slight random detune per play
    this.ts = 1 / pitch;                         // playback-rate-like time scale
    this.t0 = ctx.currentTime + 0.006 + Math.max(0, Number(opts.delay) || 0);
    this.end = this.t0;
    this.out = gn(clamp(opts.vol != null ? Number(opts.vol) : 1, 0, 2) * SFX_MAKEUP * (SFX_TRIM[name] || 1));
    this.send = gn(0.18);
    this.nodes = [this.out, this.send];
    let tail = this.out;
    const pan = clamp(Number(opts.pan) || 0, -1, 1);
    if (pan && ctx.createStereoPanner) {
      const pn = ctx.createStereoPanner(); pn.pan.value = pan;
      this.out.connect(pn); tail = pn; this.nodes.push(pn);
    }
    tail.connect(G.sfx.in); tail.connect(this.send); this.send.connect(G.sfx.rev);
  }
  wet(v) { this.send.gain.value = v; }
  // Schedule one synth voice at relative time t (seconds) for d seconds.
  s(t, d, o) {
    const p = this.p, ts = this.ts;
    for (const k of SCALE_F) if (o[k]) o[k] = Math.min(o[k] * p, 19000);
    for (const k of SCALE_T) if (o[k] != null) o[k] *= ts;
    if (o.fp) o.fp = o.fp.map(([tt, hz]) => [tt * ts, hz * p]);
    if (o.ffp) o.ffp = o.ffp.map(([tt, hz]) => [tt * ts, Math.min(hz * p, 19000)]);
    if (o.vib && o.vib[2]) o.vib = [o.vib[0], o.vib[1], o.vib[2] * ts];
    if (o.noise) o.rate = (o.rate || 1) * Math.sqrt(p);
    const e = synth(this.out, this.t0 + t * ts, d * ts, o);
    if (e > this.end) this.end = e;
    return e;
  }
  done() {
    activeVoices++;
    const ms = Math.max(0.1, this.end - ctx.currentTime + 0.3) * 1000;
    setTimeout(() => { for (const n of this.nodes) off(n); activeVoices--; }, ms);
  }
}

/* Reusable sound-design building blocks (all take a Voice + relative time). */
const whoosh = (v, t, d, f0, f1, f2, vol, q = 1.4, color = 'pink') =>
  v.s(t, d, { noise: color, bp: f0, q, ffp: [[d * 0.45, f1], [d, f2]], vol, a: d * 0.45 });
const thump = (v, t, f0, f1, d, vol) => v.s(t, d, { f: f0, to: f1, vol, a: 0.002 });
const tick = (v, t, f, d, vol, q = 2) => v.s(t, d, { noise: 'white', bp: f, q, vol, a: 0.0008 });
const bell = (v, t, f, d, vol, ratio = 3.5, idx = 1.2) =>
  v.s(t, d, { f, fm: [ratio, idx, 0.02], vol, a: 0.0015 });
const bubble = (v, t, f, vol) => v.s(t, 0.075, { f, to: f * 2.4, gt: 0.06, vol, a: 0.006 });
const pluck = (v, t, f, d, vol) =>
  v.s(t, d, { f, osc: [['triangle', 1, 0], ['sawtooth', 1, 4, 0.4]], lp: 3600, fto: 700, ft: d * 0.5, q: 1, vol, a: 0.002 });
const brass = (v, t, m, d, vol) =>
  v.s(t, d, { f: N(m), osc: [['sawtooth', 1, -7], ['sawtooth', 1, 7]], lp: 500, ffp: [[0.07, 2600], [d, 900]], q: 0.9, vol, a: 0.025, r: d * 0.45, sus: 0.8, d: 0.2 });
function metal(v, t, f, d, vol) {
  const parts = [[1, 1, 1], [2.76, 0.55, 0.7], [5.4, 0.32, 0.45], [8.93, 0.18, 0.3]];
  for (const [r, a, dd] of parts) v.s(t, d * dd, { f: f * r, vol: vol * a, a: 0.0008 });
}
function crackle(v, t, d, n, vol) {
  for (let i = 0; i < n; i++) v.s(t + rand(0, d), rand(0.006, 0.02), { noise: 'white', hp: rand(2500, 6500), vol: vol * rand(0.35, 1), a: 0.0008 });
}
function sparkle(v, t, n, base, step, vol, up = true) {
  for (let i = 0; i < n; i++) {
    const k = up ? i : n - 1 - i;
    const m = base + 12 * Math.floor(k / 5) + PENTA[k % 5];
    bell(v, t + i * step + rand(0, step * 0.25), N(m), rand(0.35, 0.6), vol * rand(0.75, 1), pick([3, 3.5, 4]), 0.9);
  }
}
const pad = (v, t, notes, d, vol, lp = 1200) => {
  for (const m of notes) v.s(t, d, { f: N(m), osc: [['sawtooth', 1, -8], ['sawtooth', 1, 8]], lp, q: 0.4, vol, a: Math.min(0.4, d * 0.3), r: d * 0.5 });
};

/* -------------------------------------------------------------------------- */
/* 6. SFX recipes - UI, items, rewards, physical combat                       */
/* -------------------------------------------------------------------------- */
/* Each recipe receives a Voice `v`; times are relative seconds. */

const SFX = {
  /* ---------- UI ---------- */
  ui_click(v) {
    v.wet(0.05);
    v.s(0, 0.05, { f: rand(1650, 1850), to: 1150, type: 'triangle', vol: 0.11, a: 0.001 });
    tick(v, 0, 4200, 0.018, 0.035, 0.8);
  },
  ui_hover(v) {
    v.wet(0.06);
    v.s(0, 0.04, { f: rand(2500, 2700), vol: 0.022, a: 0.004 });
  },
  ui_open(v) {
    v.wet(0.2);
    v.s(0, 0.24, { noise: 'pink', bp: 600, q: 1.2, fto: 2800, vol: 0.05, a: 0.1 });
    v.s(0.02, 0.2, { f: N(76), type: 'triangle', vol: 0.075, a: 0.004 });
    v.s(0.085, 0.34, { f: N(83), type: 'triangle', vol: 0.075, a: 0.004 });
    v.s(0.085, 0.3, { f: N(95), vol: 0.02, a: 0.004 });
  },
  ui_close(v) {
    v.wet(0.18);
    v.s(0, 0.22, { noise: 'pink', bp: 2600, q: 1.2, fto: 600, vol: 0.045, a: 0.06 });
    v.s(0.0, 0.18, { f: N(83), type: 'triangle', vol: 0.065, a: 0.004 });
    v.s(0.075, 0.28, { f: N(76), type: 'triangle', vol: 0.065, a: 0.004 });
  },
  ui_error(v) {
    v.wet(0.08);
    const o = () => ({ osc: [['sawtooth', 1, -6], ['sawtooth', 1, 6]], lp: 850, q: 1, vol: 0.075, a: 0.004 });
    v.s(0, 0.12, { ...o(), f: 196 });
    v.s(0.13, 0.2, { ...o(), f: 164.8 });
  },
  ui_tab(v) {
    v.wet(0.06);
    v.s(0, 0.06, { f: rand(1350, 1450), to: 1000, type: 'triangle', vol: 0.07, a: 0.001 });
    tick(v, 0, 5200, 0.015, 0.03, 1);
  },

  /* ---------- Items ---------- */
  equip(v) {
    v.wet(0.15);
    v.s(0, 0.13, { noise: 'pink', bp: 1800, q: 0.8, vol: 0.07, a: 0.012 });
    metal(v, 0.025, rand(1300, 1600), 0.4, 0.06);
    thump(v, 0, 170, 90, 0.09, 0.1);
  },
  unequip(v) {
    v.wet(0.12);
    v.s(0, 0.2, { noise: 'pink', bp: 1300, q: 0.7, fto: 900, vol: 0.07, a: 0.03 });
    metal(v, 0.06, rand(850, 1000), 0.22, 0.035);
  },
  coin(v) {
    v.wet(0.18);
    const f = rand(1900, 2150);
    v.s(0, 0.12, { f, fm: [2.0, 0.5, 0.05], vol: 0.07, a: 0.001 });
    v.s(0.065, 0.5, { f: f * 1.335, fm: [3.01, 0.45, 0.02], vol: 0.085, a: 0.001 });
    v.s(0.065, 0.3, { f: f * 2.67, vol: 0.02, a: 0.001 });
  },
  loot(v) {
    v.wet(0.2);
    v.s(0, 0.17, { noise: 'pink', bp: 1200, q: 0.7, vol: 0.06, a: 0.02 });
    pluck(v, 0.03, N(72), 0.4, 0.07);
    pluck(v, 0.1, N(pick([79, 76])), 0.5, 0.07);
  },
  loot_rare(v) {
    v.wet(0.4);
    sparkle(v, 0, 7, pick([81, 84]), 0.045, 0.05);
    v.s(0, 0.7, { noise: 'white', hp: 6000, vol: 0.03, a: 0.25 });
    pluck(v, 0, N(72), 0.6, 0.05);
  },
  loot_legendary(v) {
    v.wet(0.5);
    thump(v, 0, 72, 40, 1.1, 0.26);
    v.s(0, 0.5, { noise: 'brown', lp: 900, fto: 140, vol: 0.18, a: 0.003 });
    pad(v, 0.02, [48, 60, 64, 67, 71, 74], 2.1, 0.03, 1800);
    sparkle(v, 0.08, 10, 79, 0.055, 0.045);
    sparkle(v, 0.75, 6, 91, 0.05, 0.025, false);
    v.s(0.05, 1.8, { noise: 'white', hp: 5000, fto: 9000, vol: 0.035, a: 0.7 });
    bell(v, 0.08, N(96), 1.8, 0.03, 4, 0.8);
  },
  potion(v) {
    v.wet(0.1);
    bell(v, 0, rand(2600, 3000), 0.15, 0.035, 2.4, 0.5);          // glass clink
    let t = 0.13;
    for (let i = 0; i < 3; i++) {
      v.s(t, 0.1, { f: rand(210, 250), to: rand(470, 560), gt: 0.08, vol: 0.13, a: 0.012, lp: 1400 });
      v.s(t, 0.08, { noise: 'pink', bp: 650, q: 3, fto: 1300, vol: 0.045, a: 0.01 });
      t += rand(0.16, 0.21);
    }
  },
  eat(v) {
    v.wet(0.06);
    for (let b = 0; b < 3; b++) {
      const t0 = b * rand(0.2, 0.25);
      for (let i = 0; i < 4; i++) v.s(t0 + rand(0, 0.07), rand(0.02, 0.04), { noise: 'white', bp: rand(1600, 3200), q: 1.4, vol: 0.06, a: 0.002 });
      v.s(t0, 0.06, { noise: 'pink', lp: 700, vol: 0.05, a: 0.004 });
    }
  },

  /* ---------- Rewards / progression ---------- */
  levelup(v) {
    v.wet(0.38);
    [60, 64, 67, 72].forEach((m, i) => brass(v, i * 0.11, m, 0.32, 0.075));
    [60, 64, 67, 72, 76].forEach((m) => brass(v, 0.46, m, 1.15, 0.045));
    v.s(0.46, 1.1, { f: N(48), type: 'triangle', vol: 0.12, a: 0.01, r: 0.6 });
    [84, 88, 91, 96].forEach((m, i) => bell(v, 0.46 + i * 0.07, N(m), 1.0, 0.032, 4, 0.9));
    v.s(0.38, 1.1, { noise: 'white', hp: 6500, vol: 0.03, a: 0.3 });
    thump(v, 0.46, 110, 45, 0.5, 0.15);
  },
  quest_accept(v) {
    v.wet(0.3);
    pluck(v, 0, N(67), 0.45, 0.08);
    pluck(v, 0.1, N(74), 0.6, 0.08);
    bell(v, 0.1, N(86), 0.7, 0.03, 4, 0.8);
    v.s(0, 0.5, { f: N(55), type: 'triangle', vol: 0.06, a: 0.01 });
  },
  quest_complete(v) {
    v.wet(0.38);
    [72, 76, 79].forEach((m, i) => pluck(v, i * 0.1, N(m), 0.5, 0.075));
    brass(v, 0.3, 84, 0.8, 0.05);
    pad(v, 0.3, [60, 64, 67], 0.9, 0.03, 1500);
    [88, 91, 96].forEach((m, i) => bell(v, 0.3 + i * 0.06, N(m), 0.8, 0.025, 4, 0.8));
    thump(v, 0.3, 100, 50, 0.35, 0.1);
  },
  achievement(v) {
    v.wet(0.45);
    brass(v, 0, 67, 0.55, 0.06); brass(v, 0, 74, 0.55, 0.05);
    brass(v, 0.28, 72, 1.0, 0.055); brass(v, 0.28, 79, 1.0, 0.045); brass(v, 0.28, 64, 1.0, 0.04);
    [84, 88, 91, 96, 100].forEach((m, i) => bell(v, 0.32 + i * 0.06, N(m), 0.9, 0.03, 3.5, 1));
    thump(v, 0.28, 90, 40, 0.6, 0.18);
    v.s(0.2, 1.1, { noise: 'white', hp: 6000, vol: 0.035, a: 0.35 });
  },

  /* ---------- Physical combat ---------- */
  swing(v) {
    v.wet(0.06);
    whoosh(v, 0, rand(0.18, 0.24), rand(400, 600), rand(2000, 2600), 700, 0.17);
  },
  swing_heavy(v) {
    v.wet(0.08);
    whoosh(v, 0, rand(0.32, 0.38), 220, rand(1000, 1300), 300, 0.22, 1.0);
    v.s(0, 0.35, { f: 70, to: 48, vol: 0.08, a: 0.12 });
  },
  hit(v) {
    v.wet(0.08);
    thump(v, 0, rand(125, 160), 52, 0.15, 0.32);
    v.s(0, 0.09, { noise: 'pink', lp: 1800, fto: 380, vol: 0.2, a: 0.001 });
    v.s(0, 0.04, { noise: 'white', bp: rand(1000, 1300), q: 1.5, vol: 0.07, a: 0.001 });
  },
  hit_metal(v) {
    v.wet(0.2);
    metal(v, 0, rand(680, 900), 0.55, 0.12);
    v.s(0, 0.05, { noise: 'white', hp: 2500, vol: 0.13, a: 0.0008 });
    thump(v, 0, 220, 110, 0.07, 0.1);
  },
  crit(v) {
    v.wet(0.15);
    v.s(0, 0.07, { noise: 'white', hp: 1800, vol: 0.2, a: 0.0008 });
    thump(v, 0, 190, 40, 0.24, 0.38);
    v.s(0, 0.11, { noise: 'pink', lp: 2200, fto: 400, vol: 0.2, a: 0.001 });
    metal(v, 0.005, rand(1800, 2100), 0.32, 0.05);
    v.s(0.01, 0.28, { noise: 'white', bp: 3200, q: 3, fto: 5500, vol: 0.05, a: 0.004 });
  },
  bow_shot(v) {
    v.wet(0.1);
    v.s(0, 0.26, { f: rand(150, 170), to: 140, osc: [['triangle', 1, 0], ['sawtooth', 1, 0, 0.3]], lp: 2400, fto: 380, ft: 0.15, vol: 0.12, a: 0.002 });
    v.s(0.01, 0.17, { noise: 'white', bp: 3000, q: 0.8, fto: 1400, vol: 0.06, a: 0.025 });
  },
  arrow_hit(v) {
    v.wet(0.1);
    thump(v, 0, 240, 90, 0.08, 0.2);
    v.s(0, 0.05, { noise: 'pink', bp: 900, q: 1.5, vol: 0.13, a: 0.001 });
    v.s(0, 0.13, { f: rand(400, 440), to: 370, type: 'triangle', vol: 0.05, a: 0.001 });
  },
  dash(v) {
    v.wet(0.08);
    whoosh(v, 0, 0.17, 800, 3000, 1200, 0.13, 1);
    v.s(0, 0.13, { noise: 'white', hp: 5000, vol: 0.025, a: 0.04 });
  },
  dodge(v) {
    v.wet(0.06);
    whoosh(v, 0, 0.13, 1200, 2700, 900, 0.09, 1.6);
    tick(v, 0.02, 2600, 0.05, 0.03, 0.8);
  },
  stun(v) {
    v.wet(0.3);
    thump(v, 0, 140, 60, 0.11, 0.2);
    v.s(0, 0.06, { noise: 'pink', bp: 1200, vol: 0.09, a: 0.001 });
    for (let i = 0; i < 3; i++) v.s(0.08 + i * 0.17, 0.32, { f: N(i % 2 ? 95 : 91), vib: [14, 60, 0], vol: 0.028, a: 0.01 });
  },
  death_monster(v) {
    v.wet(0.2);
    const f = rand(105, 140);
    v.s(0, 0.8, { f, to: f * 0.45, osc: [['sawtooth', 1, 0], ['sawtooth', 1.01, 0]], bp: 520, fto: 200, q: 2, vol: 0.11, a: 0.03, am: [rand(18, 26), 0.6] });
    thump(v, 0.55, 95, 40, 0.3, 0.24);
    v.s(0.55, 0.2, { noise: 'pink', lp: 600, vol: 0.12, a: 0.002 });
  },
  death_player(v) {
    v.wet(0.5);
    [69, 67, 65, 64].forEach((m, i) => v.s(i * 0.32, 0.62, { f: N(m), osc: [['triangle', 1, 0], ['sine', 2, 0, 0.2]], lp: 1600, vol: 0.075, a: 0.03, r: 0.25 }));
    pad(v, 1.2, [45, 52, 57, 60, 64], 1.9, 0.028, 700);
    bell(v, 1.2, N(81), 1.7, 0.028, 3.5, 0.8);
    v.s(1.2, 1.6, { f: N(33), type: 'triangle', vol: 0.09, a: 0.05, r: 0.9 });
  },
};

/* -------------------------------------------------------------------------- */
/* 7. SFX recipes - magic, creatures, gathering, crafting, world, footsteps   */
/* -------------------------------------------------------------------------- */

Object.assign(SFX, {
  /* ---------- Magic ---------- */
  fire_cast(v) {
    v.wet(0.2);
    v.s(0, 0.7, { noise: 'pink', bp: 300, q: 0.9, fto: 2200, ft: 0.6, vol: 0.12, a: 0.45 });
    crackle(v, 0.05, 0.6, 12, 0.055);
    v.s(0, 0.7, { f: 90, to: 170, type: 'sawtooth', lp: 320, vol: 0.05, a: 0.4 });
  },
  fireball(v) {
    v.wet(0.2);
    v.s(0, 0.9, { noise: 'brown', lp: 300, ffp: [[0.25, 1400], [0.9, 250]], q: 0.8, vol: 0.34, a: 0.15 });
    v.s(0, 0.6, { noise: 'pink', bp: 800, q: 1, ffp: [[0.2, 2500], [0.6, 600]], vol: 0.09, a: 0.12 });
    crackle(v, 0.1, 0.6, 10, 0.045);
    v.s(0, 0.8, { f: 62, to: 40, vol: 0.12, a: 0.2 });
  },
  explosion(v) {
    v.wet(0.3);
    thump(v, 0, 88, 28, 0.95, 0.5);
    v.s(0, 1.6, { noise: 'brown', lp: 2200, fto: 120, ft: 1.2, vol: 0.5, a: 0.004 });
    v.s(0, 0.18, { noise: 'white', lp: 6000, fto: 900, vol: 0.24, a: 0.001 });
    crackle(v, 0.15, 1.0, 14, 0.04);
  },
  frost_cast(v) {
    v.wet(0.42);
    v.s(0, 0.7, { noise: 'white', hp: 4000, fto: 7500, vol: 0.045, a: 0.4 });
    const base = pick([83, 86]);
    [0, 7, 12, 14, 19].forEach((iv, i) => bell(v, i * 0.07 + rand(0, 0.02), N(base + iv), 0.7, 0.032, 3, 1.2));
    v.s(0, 0.6, { f: N(base + 24), vib: [7, 30, 0], vol: 0.012, a: 0.3 });
  },
  ice_shatter(v) {
    v.wet(0.3);
    v.s(0, 0.12, { noise: 'white', hp: 2500, vol: 0.22, a: 0.0008 });
    for (let i = 0; i < 9; i++) bell(v, rand(0, 0.25), rand(2500, 6500), rand(0.08, 0.25), 0.028, rand(2.3, 3.7), 0.8);
    v.s(0, 0.3, { noise: 'pink', bp: 3500, q: 2, fto: 1500, vol: 0.08, a: 0.002 });
  },
  lightning(v) {
    v.wet(0.25);
    v.s(0, 0.35, { f: 1800, fp: [[0.35, 60]], osc: [['sawtooth', 1, 0], ['square', 1.01, 0]], lp: 5000, fto: 500, vol: 0.06, a: 0.001, am: [rand(40, 70), 0.9] });
    v.s(0, 0.4, { noise: 'white', hp: 1500, vol: 0.17, a: 0.001, am: [rand(25, 45), 1] });
    crackle(v, 0, 0.35, 16, 0.11);
    v.s(0.05, 1.8, { noise: 'brown', lp: 260, fto: 90, vol: 0.38, a: 0.12 });
  },
  arcane(v) {
    v.wet(0.45);
    const root = pick([69, 71, 72]);
    [0, 4, 6, 11, 14].forEach((iv, i) => v.s(i * 0.06, 0.7, { f: N(root + iv), osc: [['sine', 1, -8], ['sine', 1, 8]], vib: [6, 18, 0], vol: 0.034, a: 0.04 }));
    v.s(0, 0.8, { noise: 'white', bp: 5000, q: 3, ffp: [[0.4, 8000], [0.8, 4000]], vol: 0.04, a: 0.3 });
    v.s(0, 0.6, { f: N(root - 12), fm: [2, 2, 0.2], vol: 0.045, a: 0.1 });
  },
  holy_cast(v) {
    v.wet(0.5);
    const ch = [60, 64, 67, 72];
    for (const m of ch) v.s(0, 1.2, { f: N(m), osc: [['sawtooth', 1, -9], ['sawtooth', 1, 9]], bp: 900, q: 1.6, vib: [5, 10, 0.2], vol: 0.045, a: 0.4, r: 0.6 });
    for (const m of [64, 72]) v.s(0, 1.2, { f: N(m), type: 'sawtooth', bp: 2400, q: 3, vol: 0.018, a: 0.45, r: 0.6 });
    bell(v, 0.35, N(96), 0.9, 0.024, 4, 0.8);
    v.s(0.1, 1.0, { noise: 'white', hp: 7000, vol: 0.022, a: 0.5 });
  },
  heal(v) {
    v.wet(0.42);
    [72, 76, 79, 84, 88, 91].forEach((m, i) => bell(v, i * 0.055, N(m), 0.6, 0.038, 4, 0.9));
    pad(v, 0, [60, 64, 67], 0.8, 0.025, 1600);
    v.s(0.05, 0.8, { noise: 'white', hp: 6500, fto: 9500, vol: 0.03, a: 0.3 });
  },
  shield_up(v) {
    v.wet(0.3);
    v.s(0, 0.6, { f: 110, to: 220, gt: 0.25, osc: [['sawtooth', 1, -5], ['sawtooth', 1, 5]], lp: 400, fto: 1800, ft: 0.25, q: 4, vol: 0.07, a: 0.02 });
    metal(v, 0.18, 1200, 0.7, 0.045);
    v.s(0, 0.3, { noise: 'pink', bp: 400, fto: 2000, q: 1, vol: 0.08, a: 0.15 });
    v.s(0.15, 0.6, { f: 440, fm: [1.5, 0.8, 0.1], vib: [8, 15, 0], vol: 0.035, a: 0.05 });
  },
  shadow_cast(v) {
    v.wet(0.4);
    v.s(0, 0.9, { noise: 'brown', lp: 1400, fto: 120, vol: 0.3, a: 0.35 });
    v.s(0, 0.9, { f: 82, to: 55, osc: [['sawtooth', 1, -12], ['sawtooth', 1, 12]], lp: 600, fto: 150, vol: 0.06, a: 0.3 });
    v.s(0.05, 0.7, { f: N(66), to: N(54), osc: [['sine', 1, 0], ['sine', 1.06, 0]], vol: 0.03, a: 0.2 });
  },
  poison(v) {
    v.wet(0.15);
    v.s(0, 0.6, { noise: 'white', hp: 3000, fto: 5000, vol: 0.055, a: 0.08 });
    for (let i = 0; i < 6; i++) bubble(v, rand(0, 0.5), rand(300, 800), 0.055);
    v.s(0, 0.5, { noise: 'pink', bp: 500, q: 4, vol: 0.04, a: 0.1, am: [12, 0.8] });
  },
  stealth(v) {
    v.wet(0.4);
    v.s(0, 0.8, { noise: 'pink', bp: 2500, fto: 400, q: 0.7, vol: 0.08, a: 0.1 });
    v.s(0, 0.7, { f: N(62), to: N(50), osc: [['sine', 1, -6], ['sine', 1, 6]], vol: 0.035, a: 0.15 });
  },
  buff(v) {
    v.wet(0.35);
    [67, 71, 74, 79].forEach((m, i) => pluck(v, i * 0.06, N(m), 0.5, 0.055));
    bell(v, 0.18, N(91), 0.6, 0.025, 4, 0.8);
    v.s(0, 0.5, { noise: 'white', hp: 5000, fto: 8000, vol: 0.025, a: 0.25 });
  },
  debuff(v) {
    v.wet(0.3);
    [72, 68, 65, 61].forEach((m, i) => v.s(i * 0.08, 0.4, { f: N(m), osc: [['sawtooth', 1, -8], ['sawtooth', 1, 8]], lp: 1300, fto: 400, q: 1, vol: 0.045, a: 0.005 }));
    v.s(0, 0.55, { noise: 'pink', bp: 1500, fto: 250, q: 1, vol: 0.06, a: 0.05 });
  },
  summon(v) {
    v.wet(0.5);
    v.s(0, 1.3, { f: N(38), osc: [['sawtooth', 1, -10], ['sawtooth', 1, 10]], lp: 200, ffp: [[0.8, 1500], [1.3, 400]], vol: 0.1, a: 0.7 });
    [50, 57, 62, 69, 74].forEach((m, i) => v.s(0.2 + i * 0.13, 0.8, { f: N(m), fm: [2, 1.5, 0.1], vol: 0.038, a: 0.05 }));
    v.s(0, 1.2, { noise: 'pink', bp: 300, ffp: [[0.9, 3000], [1.2, 800]], q: 1.2, vol: 0.08, a: 0.8 });
    thump(v, 0.95, 90, 40, 0.4, 0.2);
  },
  portal(v) {
    v.wet(0.5);
    v.s(0, 1.6, { noise: 'pink', bp: 500, q: 4, ffp: [[0.4, 2500], [0.8, 700], [1.2, 3000], [1.6, 900]], vol: 0.12, a: 0.4 });
    v.s(0, 1.6, { f: N(50), osc: [['sawtooth', 1, -14], ['sawtooth', 1, 14]], lp: 500, ffp: [[0.8, 1800], [1.6, 600]], vib: [3, 40, 0], vol: 0.05, a: 0.5 });
    v.s(0.1, 1.4, { f: N(74), fm: [1.5, 2, 0.3], vib: [4, 30, 0], vol: 0.028, a: 0.4 });
  },
  teleport(v) {
    v.wet(0.4);
    v.s(0, 0.6, { f: 220, to: 1760, fm: [2, 1, 0.1], vol: 0.06, a: 0.05 });
    v.s(0, 0.6, { noise: 'white', bp: 800, fto: 7000, q: 2, vol: 0.08, a: 0.4 });
    thump(v, 0.55, 140, 50, 0.3, 0.2);
    sparkle(v, 0.55, 5, 86, 0.04, 0.035);
  },
  enhance_success(v) {
    v.wet(0.38);
    metal(v, 0, 1400, 0.45, 0.06);
    [72, 76, 79, 84, 88].forEach((m, i) => bell(v, 0.08 + i * 0.05, N(m), 0.65, 0.04, 4, 0.9));
    pad(v, 0.08, [60, 67, 72, 76], 0.8, 0.025, 1800);
    v.s(0.05, 0.8, { noise: 'white', hp: 6000, vol: 0.035, a: 0.3 });
  },
  enhance_fail(v) {
    v.wet(0.2);
    metal(v, 0, 700, 0.3, 0.06);
    v.s(0.08, 0.6, { f: N(55), to: N(43), osc: [['sawtooth', 1, -10], ['sawtooth', 1, 10]], lp: 900, fto: 250, vol: 0.08, a: 0.01 });
    v.s(0.08, 0.4, { noise: 'brown', lp: 900, fto: 200, vol: 0.15, a: 0.005 });
    crackle(v, 0.1, 0.35, 8, 0.035);
  },

  /* ---------- Creatures ---------- */
  growl(v) {
    v.wet(0.12);
    const f = rand(70, 95), d = rand(0.6, 0.8);
    v.s(0, d, { f, fp: [[0.15, f * 1.25], [d, f * 0.8]], osc: [['sawtooth', 1, 0], ['sawtooth', 1.5, 8, 0.5]], bp: 450, q: 1.5, ffp: [[0.2, 700], [d, 300]], vol: 0.16, a: 0.05, am: [rand(24, 34), 0.8] });
    v.s(0, d, { noise: 'brown', lp: 700, vol: 0.13, a: 0.06, am: [rand(18, 26), 0.6] });
  },
  slime(v) {
    v.wet(0.1);
    v.s(0, 0.25, { noise: 'pink', lp: 300, ffp: [[0.06, 1800], [0.25, 250]], q: 6, vol: 0.18, a: 0.01 });
    v.s(0.02, 0.2, { f: 180, fp: [[0.06, 520], [0.2, 140]], vol: 0.09, a: 0.01 });
    bubble(v, 0.12, rand(400, 600), 0.05);
  },
  howl(v) {
    v.wet(0.45);
    const f = rand(380, 430);
    const fp = [[0.25, f * 1.55], [0.9, f * 1.6], [1.4, f * 1.1]];
    v.s(0, 1.5, { f, fp, osc: [['triangle', 1, 0], ['sine', 2, 0, 0.25]], vib: [5.5, 18, 0.3], vol: 0.1, a: 0.2, r: 0.35 });
    v.s(0, 1.5, { noise: 'pink', bp: f * 2, ffp: fp.map(([t, h]) => [t, h * 2]), q: 6, vol: 0.05, a: 0.2, r: 0.35 });
  },
  screech(v) {
    v.wet(0.15);
    v.s(0, 0.35, { f: rand(1800, 2400), fp: [[0.08, 3200], [0.35, 1500]], osc: [['sawtooth', 1, 0], ['sawtooth', 1.02, 0]], bp: 2500, q: 3, vol: 0.06, a: 0.01, am: [rand(45, 60), 0.8] });
    v.s(0, 0.3, { noise: 'white', hp: 4000, vol: 0.045, a: 0.02 });
  },
  roar(v) {
    v.wet(0.3);
    const f = rand(55, 65);
    const fp = [[0.3, f * 1.4], [0.9, f * 1.2], [1.25, f * 0.7]];
    v.s(0, 1.3, { f, fp, osc: [['sawtooth', 1, -10], ['sawtooth', 1, 10], ['sawtooth', 2, 5, 0.5]], bp: 400, q: 1, ffp: [[0.3, 900], [1.25, 250]], vol: 0.2, a: 0.15, am: [30, 0.7] });
    v.s(0, 1.3, { noise: 'brown', lp: 400, ffp: [[0.3, 1400], [1.25, 200]], vol: 0.38, a: 0.15 });
    v.s(0, 1.3, { noise: 'pink', bp: 1200, q: 2, vol: 0.06, a: 0.2, am: [22, 0.6] });
    v.s(0, 1.0, { f: 45, to: 32, vol: 0.18, a: 0.2 });
  },
  bone(v) {
    v.wet(0.15);
    for (let i = 0; i < 10; i++) {
      const t = rand(0, 0.3);
      tick(v, t, rand(1500, 3500), 0.03, 0.09, 6);
      if (i % 2) v.s(t, 0.04, { f: rand(700, 1300), type: 'triangle', vol: 0.035, a: 0.001 });
    }
  },

  /* ---------- Gathering ---------- */
  mining(v) {
    v.wet(0.2);
    metal(v, 0, rand(2200, 2600), 0.35, 0.085);
    v.s(0, 0.06, { noise: 'white', bp: 2500, q: 1, vol: 0.18, a: 0.0008 });
    thump(v, 0, 180, 80, 0.12, 0.14);
    for (let i = 0; i < 4; i++) tick(v, 0.06 + rand(0, 0.2), rand(1500, 3000), 0.03, 0.035, 3);
  },
  chop(v) {
    v.wet(0.15);
    thump(v, 0, rand(170, 200), 95, 0.16, 0.27);
    v.s(0, 0.08, { noise: 'pink', bp: 900, q: 1.5, vol: 0.19, a: 0.001 });
    v.s(0, 0.25, { f: rand(380, 420), to: 360, type: 'triangle', vol: 0.055, a: 0.001 });
    v.s(0, 0.03, { noise: 'white', hp: 4000, vol: 0.07, a: 0.0008 });
  },
  herb(v) {
    v.wet(0.12);
    for (let i = 0; i < 4; i++) v.s(rand(0, 0.15), rand(0.05, 0.1), { noise: 'white', bp: rand(3000, 6000), q: 0.9, vol: 0.05, a: 0.01 });
    v.s(0.2, 0.07, { f: 620, to: 300, vol: 0.09, a: 0.002 });
    tick(v, 0.2, 2200, 0.03, 0.06, 2);
  },
  fish_cast(v) {
    v.wet(0.15);
    whoosh(v, 0, 0.3, 700, 2500, 900, 0.1);
    v.s(0.12, 0.45, { noise: 'white', bp: 3000, q: 4, vol: 0.035, a: 0.02, am: [60, 0.8] });
  },
  fish_splash(v) {
    v.wet(0.2);
    v.s(0, 0.5, { noise: 'white', lp: 4000, fto: 500, vol: 0.19, a: 0.005 });
    v.s(0, 0.25, { noise: 'pink', bp: 800, q: 1, vol: 0.12, a: 0.002 });
    for (let i = 0; i < 5; i++) bubble(v, rand(0.05, 0.4), rand(400, 1200), 0.035);
  },
  fish_bite(v) {
    v.wet(0.2);
    v.s(0, 0.08, { f: 350, to: 1100, gt: 0.05, vol: 0.15, a: 0.002 });
    v.s(0, 0.1, { noise: 'pink', lp: 2000, vol: 0.05, a: 0.002 });
    bubble(v, 0.1, 900, 0.03);
  },
  fish_reel(v) {
    v.wet(0.05);
    for (let i = 0; i < 8; i++) {
      tick(v, i * 0.035, 3500, 0.015, 0.09, 4);
      v.s(i * 0.035, 0.02, { f: 2800, type: 'triangle', vol: 0.018, a: 0.0005 });
    }
  },

  /* ---------- Crafting & trade ---------- */
  craft_hammer(v) {
    v.wet(0.3);
    const f = rand(950, 1100);
    for (const [r, a, d] of [[1, 1, 1.2], [2.76, 0.5, 0.8], [5.4, 0.3, 0.5], [8.93, 0.2, 0.3], [1.5, 0.25, 0.9]])
      v.s(0, d, { f: f * r, vol: 0.09 * a, a: 0.0008 });
    v.s(0, 0.04, { noise: 'white', hp: 3000, vol: 0.18, a: 0.0005 });
    thump(v, 0, 200, 90, 0.1, 0.14);
  },
  craft_brew(v) {
    v.wet(0.18);
    for (let i = 0; i < 9; i++) bubble(v, rand(0, 1.0), rand(250, 700), rand(0.03, 0.05));
    v.s(0, 1.1, { noise: 'pink', bp: 400, q: 2, vol: 0.04, a: 0.2, am: [8, 0.7] });
  },
  craft_cook(v) {
    v.wet(0.08);
    v.s(0, 1.2, { noise: 'white', hp: 3500, vol: 0.075, a: 0.05, am: [rand(10, 17), 0.6] });
    crackle(v, 0, 1.1, 14, 0.045);
    for (let i = 0; i < 3; i++) bubble(v, rand(0.1, 1), rand(200, 400), 0.025);
  },
  buy(v) {
    v.wet(0.2);
    for (let i = 0; i < 3; i++) bell(v, i * 0.06, rand(1900, 2500), 0.3, 0.05, 3.01, 0.5);
    bell(v, 0.2, N(88), 0.7, 0.045, 4, 1); bell(v, 0.2, N(95), 0.6, 0.025, 4, 1);
  },
  sell(v) {
    v.wet(0.18);
    let t = 0, gap = 0.12;
    for (let i = 0; i < 4; i++) { bell(v, t, rand(2400, 2700) - i * 150, 0.25, 0.05 * (1 - i * 0.15), 3.01, 0.5); t += gap; gap *= 0.7; }
    v.s(0, 0.2, { noise: 'pink', bp: 1200, q: 0.7, vol: 0.05, a: 0.02 });
  },

  /* ---------- World / social ---------- */
  mount(v) {
    v.wet(0.15);
    v.s(0, 0.3, { noise: 'pink', bp: 900, q: 1.2, ffp: [[0.1, 1600], [0.3, 600]], vol: 0.09, a: 0.02, am: [30, 0.7] });
    [0.3, 0.38, 0.5, 0.75, 0.83, 0.95, 1.2, 1.28, 1.4].forEach((t, i) => {
      const a = 1 - i * 0.08;
      thump(v, t, rand(130, 160), 80, 0.09, 0.15 * a);
      v.s(t, 0.04, { noise: 'pink', bp: rand(500, 800), q: 2, vol: 0.11 * a, a: 0.001 });
    });
  },
  chat(v) {
    v.wet(0.2);
    bell(v, 0, N(88), 0.4, 0.035, 2, 0.4);
    bell(v, 0, N(95), 0.3, 0.012, 4, 0.4);
  },
  whisper(v) {
    v.wet(0.25);
    bell(v, 0, N(84), 0.3, 0.032, 2, 0.4);
    bell(v, 0.11, N(91), 0.45, 0.032, 2, 0.4);
  },
  door(v) {
    v.wet(0.25);
    v.s(0, 0.6, { f: rand(90, 110), fp: [[0.3, 140], [0.6, 100]], type: 'sawtooth', bp: 900, q: 6, vol: 0.05, a: 0.05, am: [rand(25, 35), 0.9] });
    thump(v, 0.55, 110, 60, 0.2, 0.2);
    v.s(0.55, 0.1, { noise: 'pink', lp: 900, vol: 0.14, a: 0.001 });
  },
  warn(v) {
    v.wet(0.15);
    for (let i = 0; i < 2; i++) {
      v.s(i * 0.16, 0.12, { f: 880, osc: [['square', 1, -8], ['square', 1, 8]], lp: 2400, vol: 0.045, a: 0.005 });
      v.s(i * 0.16, 0.12, { f: 1244, type: 'triangle', vol: 0.03, a: 0.005 });
    }
  },
  gong(v) {
    v.wet(0.45);
    const f = rand(95, 110);
    for (const [r, a, d] of [[1, 0.5, 3.5], [1.48, 0.35, 3.0], [2.0, 0.3, 2.6], [2.66, 0.25, 2.2], [3.2, 0.2, 1.8], [4.1, 0.15, 1.4], [5.4, 0.1, 1.0]])
      v.s(0, d, { f: f * r, vol: 0.12 * a, a: 0.01 + r * 0.01, vib: [rand(0.5, 2), 6, 0] });
    v.s(0, 0.25, { noise: 'brown', lp: 400, vol: 0.28, a: 0.002 });
    v.s(0.05, 3.0, { noise: 'pink', bp: 1800, q: 2, vol: 0.022, a: 1.0 });
  },
  victory(v) {
    v.wet(0.38);
    [67, 72, 76, 79].forEach((m, i) => pluck(v, i * 0.09, N(m), 0.4, 0.075));
    brass(v, 0.36, 84, 0.9, 0.045);
    pad(v, 0.36, [60, 64, 67, 72], 1.1, 0.028, 1600);
    [88, 91, 96].forEach((m, i) => bell(v, 0.36 + i * 0.08, N(m), 0.9, 0.028, 4, 0.8));
    thump(v, 0.36, 100, 45, 0.4, 0.14);
  },
  defeat(v) {
    v.wet(0.45);
    [64, 63, 62].forEach((m, i) => brass(v, i * 0.3, m, 0.38, 0.05));
    pad(v, 0.9, [40, 47, 52, 55, 59], 1.6, 0.03, 650);
    v.s(0.9, 1.4, { f: N(28), type: 'triangle', vol: 0.1, a: 0.04, r: 0.8 });
  },

  /* ---------- Footsteps (played via Audio.footstep) ---------- */
  step_grass(v) {
    v.wet(0.04);
    for (let i = 0; i < 2; i++) v.s(rand(0, 0.03), rand(0.05, 0.08), { noise: 'white', bp: rand(2500, 4000), q: 0.8, vol: 0.045, a: 0.006 });
    thump(v, 0, 90, 60, 0.05, 0.035);
  },
  step_stone(v) {
    v.wet(0.08);
    v.s(0, 0.04, { noise: 'pink', bp: rand(1200, 1800), q: 2, vol: 0.065, a: 0.001 });
    thump(v, 0, rand(140, 180), 90, 0.06, 0.055);
  },
  step_sand(v) {
    v.wet(0.03);
    v.s(0, 0.12, { noise: 'pink', bp: rand(700, 1200), q: 0.7, vol: 0.055, a: 0.02, am: [rand(40, 70), 0.7] });
  },
  step_snow(v) {
    v.wet(0.04);
    for (let i = 0; i < 4; i++) v.s(rand(0, 0.08), 0.03, { noise: 'white', bp: rand(1800, 3200), q: 1.5, vol: 0.045, a: 0.002 });
    v.s(0, 0.12, { noise: 'pink', lp: 900, vol: 0.03, a: 0.02 });
  },
  step_wood(v) {
    v.wet(0.08);
    v.s(0, 0.08, { f: rand(200, 240), to: 150, type: 'triangle', vol: 0.075, a: 0.001 });
    v.s(0, 0.04, { noise: 'pink', bp: 900, q: 2, vol: 0.055, a: 0.001 });
  },
  step_water(v) {
    v.wet(0.08);
    v.s(0, 0.15, { noise: 'white', lp: 2500, fto: 500, vol: 0.065, a: 0.01 });
    bubble(v, rand(0.02, 0.08), rand(500, 900), 0.022);
  },
});

const LOW_PRIORITY = new Set(['ui_hover', 'step_grass', 'step_stone', 'step_sand', 'step_snow', 'step_wood', 'step_water']);

/* Loudness trims (measured offline: short-term RMS / peak per sound, theme, bed).
 * SFX sit ~10 dB above calm music; UI and footsteps stay subtle. */
const SFX_MAKEUP = 2;
const SFX_TRIM = {
  ui_click: 1.6, ui_hover: 1.4, ui_tab: 1.4, unequip: 1.3, eat: 3.5, chat: 1.3, whisper: 1.4, sell: 1.4,
  swing: 3.5, dash: 3, dodge: 5, fish_cast: 3.5, fish_reel: 2.2, bone: 2.8, herb: 1.4, craft_brew: 1.5,
  growl: 1.8, screech: 1.8, stealth: 1.4, fire_cast: 1.4, explosion: 0.75, crit: 0.85,
  step_sand: 6, step_snow: 2, step_water: 1.5, step_grass: 1.3,
};

/* -------------------------------------------------------------------------- */
/* 8. Music - scales, instruments, drum kits                                  */
/* -------------------------------------------------------------------------- */

const SC = {
  ionian: [0, 2, 4, 5, 7, 9, 11],
  lydian: [0, 2, 4, 6, 7, 9, 11],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  aeolian: [0, 2, 3, 5, 7, 8, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  hijaz: [0, 1, 4, 5, 7, 8, 10],          // phrygian dominant
  harmonic: [0, 2, 3, 5, 7, 8, 11],       // harmonic minor
  locrian: [0, 1, 3, 5, 6, 8, 10],
};

// Melodic voices: (dest, T, midi, lengthSeconds, volume)
const INS = {
  lute: (d, T, m, len, v) => synth(d, T, Math.max(0.9, len), { f: N(m), osc: [['triangle', 1, 0], ['sawtooth', 1, 4, 0.45]], lp: 3200, fto: 600, ft: 0.35, q: 1.2, vol: v, a: 0.003 }),
  oud: (d, T, m, len, v) => synth(d, T, Math.max(1, len), { f: N(m) * 0.975, fp: [[0.05, N(m)]], osc: [['sawtooth', 1, 0], ['square', 1, 6, 0.3]], lp: 2600, fto: 450, ft: 0.3, q: 4, vol: v, a: 0.002 }),
  harp: (d, T, m, len, v) => synth(d, T, 1.7, { f: N(m), osc: [['triangle', 1, 0], ['sine', 2, 0, 0.3]], lp: 5000, fto: 1500, ft: 0.6, vol: v, a: 0.002 }),
  celesta: (d, T, m, len, v) => synth(d, T, 2.2, { f: N(m), fm: [4, 1.4, 0.02], vol: v, a: 0.002 }),
  bell: (d, T, m, len, v) => synth(d, T, 2.8, { f: N(m), fm: [3.5, 1.6, 0.02], vol: v, a: 0.002 }),
  musicbox: (d, T, m, len, v) => synth(d, T, 1.5, { f: N(m), fm: [5, 0.9, 0.01], vol: v, a: 0.0015 }),
  flute: (d, T, m, len, v) => {
    const D = Math.max(0.25, len);
    synth(d, T, D, { f: N(m), osc: [['sine', 1, 0], ['triangle', 1, 3, 0.25]], vib: [5, 14, 0.22], vol: v, a: 0.07, d: 0.25, sus: 0.85, r: Math.min(0.2, D * 0.4) });
    synth(d, T, 0.22, { noise: 'pink', bp: Math.min(N(m) * 2, 9000), q: 3, vol: v * 0.12, a: 0.03 });
  },
  horn: (d, T, m, len, v) => {
    const D = Math.max(0.3, len);
    synth(d, T, D, { f: N(m), osc: [['sawtooth', 1, -6], ['sawtooth', 1, 6]], lp: 400, ffp: [[0.12, 1500], [D, 900]], q: 0.8, vol: v, a: 0.09, d: 0.3, sus: 0.8, r: Math.min(0.3, D * 0.4) });
  },
  ghost: (d, T, m, len, v) => synth(d, T, Math.max(1.5, len), { f: N(m), osc: [['sine', 1, -6], ['sine', 1, 6]], vib: [4.5, 25, 0.3], vol: v, a: 0.5, r: 0.9 }),
  bass: (d, T, m, len, v) => synth(d, T, Math.max(0.4, len), { f: N(m), osc: [['sine', 1, 0], ['triangle', 1, 0, 0.6]], lp: 700, vol: v, a: 0.02, d: 0.4, sus: 0.75, r: 0.25 }),
  pbass: (d, T, m, len, v) => synth(d, T, 0.28, { f: N(m), type: 'sawtooth', lp: 900, fto: 160, ft: 0.18, q: 3, vol: v, a: 0.004 }),
};

// Sustained pads (one synth voice per chord tone)
const PADS = {
  strings: { osc: [['sawtooth', 1, -8], ['sawtooth', 1, 8]], lp: 1300, q: 0.4, a: 1.2, r: 1.6 },
  warm: { osc: [['triangle', 1, -5], ['sawtooth', 1, 5, 0.35]], lp: 900, q: 0.5, a: 0.9, r: 1.4 },
  glass: { osc: [['sine', 1, -4], ['triangle', 2, 4, 0.2]], a: 1.8, r: 2.2, vib: [0.4, 6, 0] },
  dark: { osc: [['sawtooth', 1, -10], ['sawtooth', 1, 10]], lp: 380, q: 0.6, a: 2.0, r: 2.0, sweep: 750 },
  choir: { osc: [['sawtooth', 1, -9], ['sawtooth', 1, 9]], bp: 850, q: 1.3, a: 1.0, r: 1.5, vib: [5, 9, 0.4] },
};
function padNote(kind, dest, T, D, m, v) {
  const k = PADS[kind] || PADS.strings;
  const o = { ...k, f: N(m), vol: v };
  if (k.sweep) o.ffp = [[D * 0.5, k.sweep], [D, k.lp]];
  synth(dest, T, D, o);
}

// Percussion: (dest, T, volume)
const DRUM = {
  kick(d, T, v) { synth(d, T, 0.32, { f: 120, to: 42, gt: 0.1, vol: v, a: 0.002 }); synth(d, T, 0.02, { noise: 'white', hp: 2500, vol: v * 0.2, a: 0.001 }); },
  taiko(d, T, v) { synth(d, T, 0.9, { f: 92, to: 52, gt: 0.25, vol: v, a: 0.003 }); synth(d, T, 0.35, { noise: 'brown', lp: 600, fto: 150, vol: v * 0.8, a: 0.002 }); },
  tom(d, T, v) { const f = rand(140, 170); synth(d, T, 0.4, { f, to: f * 0.6, gt: 0.3, vol: v, a: 0.002 }); synth(d, T, 0.08, { noise: 'pink', bp: 500, q: 1, vol: v * 0.4, a: 0.001 }); },
  doum(d, T, v) { synth(d, T, 0.45, { f: 88, to: 64, gt: 0.2, vol: v, a: 0.003 }); synth(d, T, 0.12, { noise: 'pink', lp: 400, vol: v * 0.4, a: 0.002 }); },
  tek(d, T, v) { synth(d, T, 0.07, { noise: 'white', bp: rand(2600, 3200), q: 1.4, vol: v, a: 0.001 }); synth(d, T, 0.05, { f: 420, to: 380, type: 'triangle', vol: v * 0.35, a: 0.001 }); },
  shaker(d, T, v) { synth(d, T, 0.07, { noise: 'white', hp: 6500, vol: v, a: 0.025 }); },
  snare(d, T, v) { synth(d, T, 0.18, { noise: 'white', bp: 2200, q: 0.7, vol: v, a: 0.001 }); synth(d, T, 0.1, { f: 200, to: 170, type: 'triangle', vol: v * 0.5, a: 0.001 }); },
  hat(d, T, v) { synth(d, T, 0.04, { noise: 'white', hp: 8000, vol: v, a: 0.001 }); },
};

// 16-step patterns: 'x' = accent, 'o' = ghost note
const KITS = {
  taiko: [['taiko', 'x.......x..o....', 0.42], ['tom', '....o.......x.o.', 0.26], ['shaker', '..o...o...o...o.', 0.1]],
  frame: [['doum', 'x.....o...x.....', 0.4], ['tek', '....x.......x.o.', 0.16], ['shaker', 'o.o.o.o.o.o.o.o.', 0.08]],
  darbuka: [['doum', 'x.......x.......', 0.42], ['tek', '..x...x.....x...', 0.2], ['tek', '.....o.....o.o.o', 0.08], ['shaker', 'o.o.o.o.o.o.o.o.', 0.05]],
  drums: [['kick', 'x.....x...x.....', 0.42], ['snare', '....x.......x...', 0.24], ['hat', 'x.o.x.o.x.o.x.o.', 0.07]],
  boss: [['kick', 'x..x..x.x..x..x.', 0.4], ['snare', '....x.......x..o', 0.24], ['hat', 'xoxoxoxoxoxoxoxo', 0.06]],
  bossx: [['taiko', 'x.......x...x...', 0.36], ['tom', '......o.....o.oo', 0.22]],
};

// Lead rhythms: [startStep, lengthSteps] within a 16-step bar
const RH_SLOW = [
  [[0, 8], [8, 8]], [[0, 12], [12, 4]], [[0, 6], [6, 2], [8, 8]], [[0, 4], [4, 4], [8, 8]],
  [[0, 16]], [[4, 4], [8, 4], [12, 4]], [[0, 4], [4, 2], [6, 2], [8, 8]], [[2, 6], [8, 6], [14, 2]],
];
const RH_FAST = [
  [[0, 2], [2, 2], [4, 4], [8, 2], [10, 2], [12, 4]], [[0, 3], [3, 3], [6, 2], [8, 8]],
  [[0, 4], [4, 4], [8, 4], [12, 4]], [[0, 2], [2, 2], [4, 2], [6, 2], [8, 8]], [[0, 6], [6, 2], [8, 4], [12, 2], [14, 2]],
];
const ARP_PATS = [[0, 1, 2, 3, 4, 5, 4, 3], [0, 1, 2, 3], [0, 2, 1, 3, 2, 4, 3, 5], [0, 2, 1, 2], [2, 1, 0, 1], [0, 1, 2, 1], [0, 2, 4, 2]];
// Bass: step -> [lengthSteps, chordTone (0 root, 1 third, 2 fifth)]
const BASS_PATS = {
  whole: { 0: [16, 0] },
  half: { 0: [8, 0], 8: [8, 2] },
  walk: { 0: [6, 0], 6: [2, 2], 8: [6, 1], 14: [2, 2] },
  pulse8: { 0: [1.6, 0], 2: [1.6, 0], 4: [1.6, 0], 6: [1.6, 0], 8: [1.6, 0], 10: [1.6, 0], 12: [1.6, 2], 14: [1.6, 0] },
  desert: { 0: [3, 0], 3: [3, 0], 6: [2, 2], 8: [4, 0], 12: [4, 1] },
};

/* -------------------------------------------------------------------------- */
/* 9. Music - themes                                                          */
/* -------------------------------------------------------------------------- */
/* root: midi note; progs: chords as scale degrees (0-based, triads built in
 * the mode); bpc: bars per chord; layer `min` = section level (0..2) needed. */

const PERC = 0.7;          // combat percussion trim (keeps drums inside the mix)
// Per-theme output trims so every theme lands near the same calm loudness.
const THEME_TRIM = {
  title: 0.9, town: 1.2, meadow: 1.15, forest: 1.2, desert: 1.35, snow: 2.4,
  volcano: 0.9, shadow: 1.15, dungeon: 1.9, boss: 1.15, arena: 2.1, home: 1.4,
};

const THEMES = {
  title: {
    bpm: 66, root: 50, scale: SC.ionian, bpc: 2, start: 1, wet: 0.5, echo: 0.25, kit: 'taiko',
    progs: [[0, 4, 5, 3], [5, 3, 0, 4], [0, 3, 5, 4], [3, 4, 2, 5]],
    pad: { k: 'strings', v: 0.1 }, bass: { pat: 'whole', v: 0.16 },
    arp: { ins: 'harp', r: 2, v: 0.06, dens: 0.85, min: 1 },
    lead: { ins: 'horn', v: 0.075, min: 2, lo: 7, hi: 15 },
    bells: { v: 0.03, dens: 0.1 },
  },
  town: {
    bpm: 84, root: 53, scale: SC.ionian, bpc: 1, start: 1, wet: 0.35, echo: 0.15, kit: 'frame',
    progs: [[0, 3, 4, 0], [0, 5, 3, 4], [1, 4, 0, 0], [0, 3, 1, 4]],
    pad: { k: 'warm', v: 0.07 }, bass: { pat: 'walk', v: 0.14 },
    arp: { ins: 'lute', r: 2, v: 0.075, dens: 0.75, min: 0 },
    lead: { ins: 'flute', v: 0.05, min: 2, lo: 9, hi: 16 },
  },
  meadow: {
    bpm: 96, root: 55, scale: SC.lydian, bpc: 2, start: 1, wet: 0.4, echo: 0.22, kit: 'frame',
    progs: [[0, 1, 0, 4], [0, 1, 5, 4], [5, 1, 0, 0], [0, 4, 1, 0]],
    pad: { k: 'warm', v: 0.065 }, bass: { pat: 'half', v: 0.13 },
    arp: { ins: 'harp', r: 2, v: 0.055, dens: 0.7, min: 1 },
    lead: { ins: 'flute', v: 0.055, min: 1, lo: 9, hi: 16 },
    bells: { ins: 'celesta', v: 0.025, dens: 0.08 },
  },
  forest: {
    bpm: 72, root: 50, scale: SC.dorian, bpc: 2, start: 1, wet: 0.5, echo: 0.3, kit: 'frame',
    progs: [[0, 3, 0, 3], [0, 6, 3, 0], [0, 2, 6, 3], [0, 4, 3, 6]],
    pad: { k: 'choir', v: 0.06 }, bass: { pat: 'whole', v: 0.13 },
    arp: { ins: 'harp', r: 1, v: 0.042, dens: 0.7, min: 0 },
    lead: { ins: 'flute', v: 0.05, min: 2, lo: 9, hi: 16 },
    bells: { ins: 'celesta', v: 0.022, dens: 0.1 },
  },
  desert: {
    bpm: 88, root: 52, scale: SC.hijaz, bpc: 2, start: 1, wet: 0.35, echo: 0.2, kit: 'darbuka',
    progs: [[0, 1, 0, 0], [0, 3, 1, 0], [0, 6, 1, 0], [3, 1, 0, 0]],
    pad: { k: 'warm', v: 0.04 }, drone: { v: 0.06 }, bass: { pat: 'desert', v: 0.12 },
    arp: { ins: 'oud', r: 2, v: 0.07, dens: 0.65, min: 0, sc: true, orn: true, c: 64 },
    lead: { ins: 'flute', v: 0.05, min: 2, lo: 7, hi: 14 },
  },
  snow: {
    bpm: 60, root: 57, scale: SC.aeolian, bpc: 2, start: 0, wet: 0.6, echo: 0.4, kit: 'frame', cmb: 0.6,
    progs: [[0, 5, 2, 6], [0, 3, 0, 5], [0, 6, 5, 4], [5, 6, 0, 0]],
    pad: { k: 'glass', v: 0.06, c: 69 }, bass: { pat: 'whole', v: 0.09, min: 1 },
    arp: { ins: 'celesta', r: 4, v: 0.035, dens: 0.5, min: 1, c: 81 },
    bells: { v: 0.03, dens: 0.16, c: 81 },
  },
  volcano: {
    bpm: 70, root: 40, scale: SC.phrygian, bpc: 2, start: 1, wet: 0.4, echo: 0.15, kit: 'taiko',
    progs: [[0, 1, 0, 1], [0, 5, 1, 0], [0, 6, 5, 1], [0, 3, 1, 0]],
    pad: { k: 'dark', v: 0.09 }, drone: { v: 0.07 }, bass: { pat: 'half', v: 0.16, lo: 33 },
    arp: { ins: 'lute', r: 4, v: 0.05, dens: 0.5, min: 2, c: 59 },
    lead: { ins: 'horn', v: 0.06, min: 2, lo: 7, hi: 13 },
    bells: { v: 0.018, dens: 0.05 },
  },
  shadow: {
    bpm: 52, root: 47, scale: SC.locrian, bpc: 2, start: 0, wet: 0.65, echo: 0.4, kit: 'taiko',
    progs: [[0, 1, 0, 4], [0, 5, 1, 0], [0, 3, 4, 1]],
    pad: { k: 'dark', v: 0.09, add2: true }, bass: { pat: 'whole', v: 0.11 },
    lead: { ins: 'ghost', v: 0.04, min: 1, lo: 7, hi: 13 },
    bells: { v: 0.022, dens: 0.08, det: 0.4 },
  },
  dungeon: {
    bpm: 76, root: 50, scale: SC.harmonic, bpc: 2, start: 1, wet: 0.5, echo: 0.25, kit: 'taiko', tension: false,
    progs: [[0, 5, 4, 0], [0, 3, 4, 0], [0, 5, 3, 4], [0, 1, 4, 0]],
    pad: { k: 'dark', v: 0.08 }, bass: { pat: 'pulse8', ins: 'pbass', v: 0.09, lo: 34 },
    arp: { ins: 'harp', r: 4, v: 0.04, dens: 0.5, min: 1, c: 69 },
    lead: { ins: 'horn', v: 0.045, min: 2 },
    bells: { v: 0.02, dens: 0.06 },
  },
  boss: {
    bpm: 138, root: 52, scale: SC.harmonic, bpc: 1, start: 2, minLevel: 1, wet: 0.3, echo: 0.1, tension: false,
    drumsAlways: true, kit: 'boss', cmbKit: 'bossx',
    progs: [[0, 5, 3, 4], [0, 3, 5, 4], [0, 0, 5, 4], [0, 5, 0, 4]],
    pad: { k: 'strings', v: 0.065 }, bass: { pat: 'pulse8', ins: 'pbass', v: 0.12, lo: 38 },
    arp: { ins: 'lute', r: 1, v: 0.035, dens: 0.9, min: 1, dry: true },
    lead: { ins: 'horn', v: 0.065, min: 1, fast: true },
  },
  arena: {
    bpm: 120, root: 57, scale: SC.mixolydian, bpc: 1, start: 1, wet: 0.35, echo: 0.15, kit: 'drums',
    progs: [[0, 6, 3, 0], [0, 3, 6, 0], [0, 4, 3, 6], [5, 6, 0, 0]],
    pad: { k: 'strings', v: 0.06 }, bass: { pat: 'pulse8', ins: 'pbass', v: 0.1 },
    arp: { ins: 'lute', r: 2, v: 0.055, dens: 0.85, min: 0 },
    lead: { ins: 'horn', v: 0.06, min: 1, fast: true, lo: 5, hi: 12 },
  },
  home: {
    bpm: 70, root: 48, scale: SC.ionian, bpc: 2, start: 1, wet: 0.4, echo: 0.2, kit: 'frame',
    progs: [[0, 5, 1, 4], [0, 3, 2, 5], [3, 4, 0, 0], [0, 4, 5, 3]],
    pad: { k: 'warm', v: 0.065 }, bass: { pat: 'walk', v: 0.11 },
    arp: { ins: 'musicbox', r: 2, v: 0.035, dens: 0.6, min: 1, c: 72 },
    lead: { ins: 'flute', v: 0.042, min: 2, lo: 9, hi: 16 },
  },
};

/* -------------------------------------------------------------------------- */
/* 10. Music - generative song player                                         */
/* -------------------------------------------------------------------------- */

const place = (m, lo) => { while (m < lo) m += 12; while (m >= lo + 12) m -= 12; return m; };

class Song {
  constructor(name) {
    const d = (this.d = THEMES[name]);
    this.name = name;
    this.out = gn(0); this.out.connect(G.music.in);
    this.wet = gn(d.wet != null ? d.wet : 0.4); this.out.connect(this.wet); this.wet.connect(G.music.rev);
    this.echo = gn(1); this.echo.connect(this.out);                       // voices that also feed the echo
    this.echoSend = gn(d.echo != null ? d.echo : 0.25); this.echo.connect(this.echoSend); this.echoSend.connect(G.music.dly);
    this.cmb = gn(0); this.cmb.connect(this.out);                         // combat layer
    this.cmbLevel = (d.cmb || 1) / Math.sqrt(THEME_TRIM[name] || 1);      // similar combat lift in every theme
    this.spb = 60 / d.bpm / 4;                                            // one 16th note
    this.step = 0;
    this.next = ctx.currentTime + 0.15;
    this.ci = -1; this.prog = pick(d.progs); this.deg = 0; this.pcs = [0, 4, 7];
    this.level = d.start != null ? d.start : 1;
    this.phase = 0;
    this.combat = false; this.cmbUntil = 0;
    this.li = (d.lead && d.lead.lo != null ? d.lead.lo : 7) + 2;
    this.lead = null; this.arpPat = ARP_PATS[0]; this.arpNotes = [60];
    this.dying = false; this.dieAt = Infinity;
    G.dly.delayTime.setTargetAtTime(Math.min(1.2, 0.75 * 60 / d.bpm), ctx.currentTime, 0.3); // dotted 8th
  }
  sn(i) { const s = this.d.scale, L = s.length; return this.d.root + 12 * Math.floor(i / L) + s[mod(i, L)]; }
  inScale(m) { return this.d.scale.includes(mod(m - this.d.root, 12)); }
  upper(m) { for (let k = 1; k <= 3; k++) if (this.inScale(m + k)) return m + k; return m + 2; }
  // Chord tones placed close to `center` -> automatic inversions, smooth voice leading
  voicing(deg, center, n = 3) {
    const out = [];
    for (let k = 0; k < n; k++) out.push(place(this.sn(deg + 2 * k), center - 6));
    return out.sort((a, b) => a - b);
  }
  fade(to, sec) {
    const p = this.out.gain, t = ctx.currentTime;
    p.cancelScheduledValues(t); p.setValueAtTime(p.value, t); p.linearRampToValueAtTime(to, t + sec);
  }
  fadeOut() { this.fade(0, 2.5); this.dying = true; this.dieAt = ctx.currentTime + 2.8; }
  setCombat(on, instant) {
    on = !!on;
    if (on === this.combat && !instant) return;
    this.combat = on;
    const t = ctx.currentTime, p = this.cmb.gain;
    p.cancelScheduledValues(t);
    if (instant) p.setValueAtTime(on ? this.cmbLevel : 0, t);
    else { p.setValueAtTime(p.value, t); p.linearRampToValueAtTime(on ? this.cmbLevel : 0, t + 1.5); }
    if (!on) this.cmbUntil = t + 1.7;
    else this.level = Math.max(this.level, 1);
  }
  schedule(until) {
    const now = ctx.currentTime;
    if (this.next < now - 0.2) this.next = now + 0.05;                    // fell behind (pause / jank)
    while (this.next < until) { this.play(this.next); this.next += this.spb; this.step++; }
  }
  newSection() {
    const d = this.d;
    const l = this.level + pick([-1, -1, 0, 1, 1]);
    this.level = clamp(l, this.combat ? 1 : (d.minLevel || 0), 2);
    this.phase = randi(0, 3);
  }
  newChord(T, len) {
    const d = this.d;
    if (++this.ci >= this.prog.length) {
      this.ci = 0;
      let p = pick(d.progs); if (p === this.prog) p = pick(d.progs);  // vary progressions
      this.prog = p;
    }
    this.deg = this.prog[this.ci];
    this.pcs = [0, 2, 4].map((k) => mod(this.sn(this.deg + 2 * k), 12));
    const P = d.pad;
    if (P) {
      const center = P.c != null ? P.c : d.root + 14;
      const notes = this.voicing(this.deg, center, 3);
      if (P.add2) notes.push(place(this.sn(this.deg + 1), center - 6));   // eerie cluster
      const D = len + (PADS[P.k] || PADS.strings).r * 0.8;
      const v = P.v / Math.sqrt(notes.length);
      for (const m of notes) padNote(P.k, this.out, T, D, m, v);
    }
    if (d.drone) for (const m of [d.root - 12, d.root - 5]) padNote('dark', this.out, T, len + 1.6, m, d.drone.v);
    const A = d.arp;
    if (A) {
      const c = A.c != null ? A.c : d.root + 19;
      if (A.sc) {                                                         // scale runs (oud)
        const base = place(this.sn(this.deg), c - 6), shift = base - this.sn(this.deg);
        this.arpNotes = [];
        for (let k = 0; k < 8; k++) this.arpNotes.push(this.sn(this.deg + k) + shift);
      } else {
        const v = this.voicing(this.deg, c, 3);
        this.arpNotes = v.concat(v.map((m) => m + 12));
      }
    }
  }
  newBar(bar) {
    const L = this.d.lead;
    if (bar % 2 === 0 || chance(0.25)) this.arpPat = pick(ARP_PATS);
    this.lead = null;
    if (L && this.level >= (L.min != null ? L.min : 2)) {
      const ph = (bar + this.phase) % 4;                                  // 2 bars call, 2 bars rest
      if (ph < 2) this.lead = this.genLead(ph === 1);
    }
  }
  snapChord(i) {
    for (const o of [0, -1, 1, -2, 2, -3, 3]) if (this.pcs.includes(mod(this.sn(i + o), 12))) return i + o;
    return i;
  }
  genLead(endOfPhrase) {
    const L = this.d.lead, lo = L.lo != null ? L.lo : 7, hi = L.hi != null ? L.hi : 15;
    const rh = pick(L.fast ? RH_FAST : RH_SLOW);
    const map = new Map();
    rh.forEach(([st, len], i) => {
      const strong = i === 0 || st % 8 === 0;
      if (!strong) this.li += pick([-2, -1, -1, -1, 0, 1, 1, 1, 2, 3, -3]);
      if (this.li < lo) this.li = lo + 1;
      if (this.li > hi) this.li = hi - 1;
      if (strong || (endOfPhrase && i === rh.length - 1)) this.li = this.snapChord(this.li);
      map.set(st, [len, this.sn(this.li) + 12 * (L.oct || 0)]);
    });
    return map;
  }
  drums(kit, s, bar, T, dest, fills) {
    if (!kit) return;
    for (const [ins, pat, v] of kit) {
      const ch = pat[s];
      if (ch === 'x') DRUM[ins](dest, T, v * PERC * rand(0.9, 1.05));
      else if (ch === 'o') DRUM[ins](dest, T, v * PERC * rand(0.4, 0.55));
    }
    if (fills && bar % 4 === 3 && s >= 12 && chance(0.45)) {
      const soft = kit === KITS.frame || kit === KITS.darbuka;
      DRUM[soft ? 'tek' : 'tom'](dest, T, soft ? 0.16 : 0.22);
    }
  }
  play(T) {
    const d = this.d, s = this.step % 16, bar = Math.floor(this.step / 16), spb = this.spb;
    const bpc = d.bpc || 2;
    if (s === 0) {
      if (bar > 0 && bar % 8 === 0) this.newSection();
      if (bar % bpc === 0) this.newChord(T, bpc * 16 * spb);
      this.newBar(bar);
    }
    const hum = () => T + rand(0, 0.008);
    const lvl = this.level;

    // Bass
    const Bs = d.bass;
    if (Bs && lvl >= (Bs.min || 0)) {
      const ev = BASS_PATS[Bs.pat][s];
      if (ev) {
        const m = place(this.sn(this.deg + 2 * ev[1]), Bs.lo != null ? Bs.lo : d.root - 14);
        INS[Bs.ins || 'bass'](this.out, T, m, ev[0] * spb, Bs.v * (s === 0 ? 1 : 0.85));
      }
    }
    // Arpeggio / plucked accompaniment
    const A = d.arp;
    if (A && lvl >= (A.min != null ? A.min : 1) && s % A.r === 0 && chance(A.dens)) {
      const m = this.arpNotes[this.arpPat[(s / A.r) % this.arpPat.length] % this.arpNotes.length];
      const dest = A.dry ? this.out : this.echo;
      INS[A.ins](dest, hum(), m, A.r * spb, A.v * rand(0.8, 1.05));
      if (A.orn && chance(0.2)) {                                         // mordent ornament
        INS[A.ins](dest, T + 0.07, this.upper(m), 0.1, A.v * 0.55);
        INS[A.ins](dest, T + 0.14, m, 0.1, A.v * 0.6);
      }
    }
    // Lead melody
    if (this.lead) {
      const ev = this.lead.get(s);
      if (ev) INS[d.lead.ins](this.echo, hum(), ev[1], ev[0] * spb * 0.95, d.lead.v * rand(0.85, 1.05));
    }
    // Bells / sparkles
    const B = d.bells;
    if (B && s % 4 === 0 && chance(B.dens * (0.6 + 0.4 * lvl))) {
      const c = B.c != null ? B.c : d.root + 24;
      const m = pick(this.voicing(this.deg, c + 6, 3));
      const ins = INS[B.ins || 'bell'];
      ins(this.echo, hum(), m, 2, B.v * rand(0.7, 1));
      if (B.det) ins(this.echo, T + 0.02, m + B.det, 2, B.v * 0.5);
    }
    // Percussion & combat tension layer
    if (d.drumsAlways) this.drums(KITS[d.kit], s, bar, T, this.out, true);
    if (this.combat || ctx.currentTime < this.cmbUntil) {
      if (d.cmbKit) this.drums(KITS[d.cmbKit], s, bar, T, this.cmb, false);
      else if (!d.drumsAlways) this.drums(KITS[d.kit], s, bar, T, this.cmb, true);
      if (d.tension !== false && s % 2 === 0) {
        const m = place(this.sn(this.deg), d.root - 14);
        INS.pbass(this.cmb, T, m, spb * 2, s % 4 === 0 ? 0.1 : 0.065);
      }
    }
  }
  destroy() { for (const n of [this.out, this.wet, this.echo, this.echoSend, this.cmb]) off(n); }
}

/* -------------------------------------------------------------------------- */
/* 11. Ambience - beds of looping filtered noise + random events              */
/* -------------------------------------------------------------------------- */

class Bed {
  constructor(type) {
    this.type = type;
    this.out = gn(0); this.out.connect(G.amb.in);
    this.wet = gn(0.3); this.out.connect(this.wet); this.wet.connect(G.amb.rev);
    this.nodes = [this.out, this.wet];
    this.srcs = [];
    this.evs = [];
    this.pans = [-0.8, -0.4, 0, 0.4, 0.8].map((p) => {
      if (!ctx.createStereoPanner) return this.out;
      const n = ctx.createStereoPanner(); n.pan.value = p; n.connect(this.out); this.nodes.push(n);
      return n;
    });
    this.dying = false; this.dieAt = Infinity;
    BEDS[type](this);
  }
  pan() { return pick(this.pans); }
  // Looping noise layer. o: { vol, hp, bp, lp, q, pan, rate, lfoG: [rate, depth], lfoF: [rate, depth] }
  loop(color, o) {
    const s = ctx.createBufferSource();
    s.buffer = NB[color]; s.loop = true; s.playbackRate.value = o.rate || 1;
    let head = s, main = null;
    const add = (n) => { head.connect(n); head = n; this.nodes.push(n); return n; };
    if (o.hp) main = add(bq('highpass', o.hp, 0.7));
    if (o.bp) main = add(bq('bandpass', o.bp, o.q != null ? o.q : 1));
    if (o.lp) { const f = add(bq('lowpass', o.lp, 0.7)); if (!o.bp) main = f; }
    const g = add(gn(o.vol));
    if (o.pan && ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = o.pan; add(p); }
    head.connect(this.out);
    if (o.lfoG) this.lfo(g.gain, o.lfoG[0], o.lfoG[1]);
    if (o.lfoF && main) this.lfo(main.frequency, o.lfoF[0], o.lfoF[1]);
    s.start(ctx.currentTime, rand(0, 3.5));
    this.srcs.push(s);
  }
  lfo(param, rate, depth) {
    const l = ctx.createOscillator(); l.frequency.value = rate * rand(0.8, 1.2);
    const lg = gn(depth); l.connect(lg); lg.connect(param);
    l.start(ctx.currentTime);
    this.srcs.push(l); this.nodes.push(lg);
  }
  drone(f, vol, det = 0) {
    const o = ctx.createOscillator(); o.frequency.value = f; o.detune.value = det;
    const g = gn(vol); o.connect(g); g.connect(this.out);
    o.start(ctx.currentTime);
    this.srcs.push(o); this.nodes.push(g);
  }
  every(min, max, fn, first) {
    this.evs.push({ min, max, fn, next: ctx.currentTime + (first != null ? first : rand(min * 0.3, max)) });
  }
  tick(now, until) {
    for (const e of this.evs) {
      if (e.next < now - 0.5) e.next = now + rand(0, e.min);           // resync after a pause
      while (e.next < until) {
        try { e.fn(this, Math.max(e.next, now + 0.01)); } catch (err) { /* keep going */ }
        e.next += rand(e.min, e.max);
      }
    }
  }
  fade(to, sec) {
    const p = this.out.gain, t = ctx.currentTime;
    p.cancelScheduledValues(t); p.setValueAtTime(p.value, t); p.linearRampToValueAtTime(to, t + sec);
  }
  fadeOut() { this.fade(0, 2.5); this.dying = true; this.dieAt = ctx.currentTime + 2.7; }
  destroy() {
    for (const s of this.srcs) { try { s.stop(); } catch (e) { /* not started */ } off(s); }
    for (const n of this.nodes) off(n);
  }
}

// Ambient one-shot events: (bed, absoluteTime)
const EV = {
  gust(b, T) {
    const d = rand(2.5, 5);
    synth(b.pan(), T, d, { noise: 'pink', bp: rand(300, 600), q: 1.2, ffp: [[d * 0.5, rand(900, 1500)], [d, 400]], vol: rand(0.05, 0.1), a: d * 0.45 });
  },
  whistle(b, T) {
    const d = rand(3, 5), f = rand(700, 1200);
    synth(b.pan(), T, d, { noise: 'white', bp: f, q: 18, ffp: [[d * 0.5, f * 1.3], [d, f * 0.9]], vol: 0.05, a: d * 0.5 });
  },
  bird(b, T) {
    const p = b.pan(), kind = randi(0, 3), f = rand(2400, 4200), v = rand(0.016, 0.032);
    if (kind === 0) {
      const n = randi(2, 5);
      for (let i = 0; i < n; i++) synth(p, T + i * rand(0.09, 0.14), 0.07, { f, fp: [[0.03, f * 1.3], [0.07, f * 0.9]], vol: v, a: 0.005 });
    } else if (kind === 1) {
      synth(p, T, rand(0.3, 0.6), { f, to: f * 0.85, vib: [rand(18, 28), 150, 0], vol: v * 0.8, a: 0.02 });
    } else if (kind === 2) {
      synth(p, T, 0.25, { f: f * 0.8, to: f * 0.95, vol: v, a: 0.02 });
      synth(p, T + 0.3, 0.3, { f: f * 0.95, to: f * 0.7, vol: v, a: 0.02 });
    } else {
      const n = randi(3, 6);
      for (let i = 0; i < n; i++) synth(p, T + i * 0.06, 0.04, { f: f * 1.1, to: f * 1.5, vol: v * 0.7, a: 0.003 });
    }
  },
  rustle(b, T) {
    const d = rand(0.8, 2);
    synth(b.pan(), T, d, { noise: 'white', bp: rand(2500, 5000), q: 0.8, vol: rand(0.015, 0.03), a: d * 0.4, am: [rand(6, 12), 0.6] });
  },
  hawk(b, T) {
    const f = rand(1700, 2000);
    synth(b.pan(), T, 1.0, { f, fp: [[0.15, f * 1.08], [1.0, f * 0.75]], osc: [['sine', 1, 0], ['sine', 2, 0, 0.15]], vib: [9, 25, 0.1], vol: 0.014, a: 0.06 });
  },
  sand(b, T) {
    const d = rand(1.5, 3);
    synth(b.pan(), T, d, { noise: 'white', hp: 3500, lp2: 9000, vol: rand(0.015, 0.03), a: d * 0.4 });
  },
  tinkle(b, T) {
    const n = randi(2, 4);
    for (let i = 0; i < n; i++) synth(b.pan(), T + i * rand(0.08, 0.2), 1.2, { f: rand(3000, 6000), fm: [3.2, 0.8, 0.02], vol: 0.007, a: 0.002 });
  },
  lavaBubble(b, T) {
    const f = rand(60, 120);
    synth(b.pan(), T, 0.14, { f, to: f * 2.6, gt: 0.12, lp: 500, vol: rand(0.06, 0.12), a: 0.01 });
    synth(b.pan(), T + 0.12, 0.05, { noise: 'pink', lp: 900, vol: 0.05, a: 0.002 });
  },
  hiss(b, T) {
    const d = rand(0.4, 1.0);
    synth(b.pan(), T, d, { noise: 'white', hp: 4000, vol: rand(0.015, 0.03), a: d * 0.3 });
  },
  rumble(b, T) {
    const d = rand(3, 6);
    synth(b.pan(), T, d, { noise: 'brown', lp: 160, vol: rand(0.12, 0.2), a: d * 0.4 });
  },
  whisper(b, T) {
    const d = rand(0.8, 1.6), f = rand(1400, 2600);
    synth(b.pan(), T, d, { noise: 'pink', bp: f, q: 5, ffp: [[d * 0.3, f * 1.4], [d * 0.6, f * 0.8], [d, f * 1.1]], vol: 0.03, a: d * 0.4, am: [rand(5, 8), 0.8] });
  },
  moan(b, T) {
    const d = rand(3, 5), f = rand(100, 160);
    synth(b.pan(), T, d, { f, to: f * rand(0.8, 1.2), osc: [['sine', 1, -8], ['sine', 1, 8]], vib: [rand(3, 5), 30, 0.5], vol: 0.03, a: d * 0.5 });
  },
  chime(b, T) {
    const f = N(randi(76, 88)), p = b.pan();
    synth(p, T, 3, { f, fm: [3.5, 1.2, 0.02], vol: 0.015, a: 0.002 });
    synth(p, T, 3, { f: f * 1.03, fm: [3.5, 1.0, 0.02], vol: 0.009, a: 0.002 });
  },
  drip(b, T) {
    const f = rand(1100, 2600), p = b.pan();
    synth(p, T, 0.08, { f, to: f * 1.7, gt: 0.04, vol: rand(0.02, 0.045), a: 0.002 });
    if (chance(0.4)) synth(p, T + rand(0.15, 0.4), 0.06, { f: f * 1.2, to: f * 2, gt: 0.03, vol: 0.012, a: 0.002 });
  },
  rocks(b, T) {
    const p = b.pan(), n = randi(3, 7);
    for (let i = 0; i < n; i++) synth(p, T + i * rand(0.05, 0.15), 0.06, { noise: 'pink', bp: rand(500, 1500), q: 2, vol: rand(0.02, 0.05), a: 0.002 });
  },
  caveWind(b, T) {
    const d = rand(4, 7);
    synth(b.pan(), T, d, { noise: 'pink', bp: rand(200, 320), q: 8, vol: 0.06, a: d * 0.5 });
  },
  smithy(b, T) {
    const p = b.pan(), n = randi(1, 3), f = rand(900, 1200);
    for (let i = 0; i < n; i++) {
      const t = T + i * rand(0.45, 0.6);
      for (const [r, a, d] of [[1, 1, 0.9], [2.76, 0.5, 0.6], [5.4, 0.3, 0.4]]) synth(p, t, d, { f: f * r, vol: 0.02 * a, a: 0.001 });
    }
  },
  townBell(b, T) {
    const f = N(pick([55, 57, 60])), p = b.pan(), n = randi(1, 3);
    for (let i = 0; i < n; i++)
      for (const [r, a, d] of [[1, 1, 4], [2, 0.5, 3], [2.4, 0.4, 2.5], [3, 0.3, 2], [4.2, 0.2, 1.5]])
        synth(p, T + i * 1.6, d, { f: f * r, vol: 0.016 * a, a: 0.003 });
  },
  knock(b, T) {
    const p = b.pan(), n = randi(2, 4);
    for (let i = 0; i < n; i++) synth(p, T + i * rand(0.12, 0.25), 0.07, { f: rand(180, 260), to: 120, type: 'triangle', vol: 0.03, a: 0.001 });
  },
  bark(b, T) {
    const p = b.pan(), n = randi(1, 3);
    for (let i = 0; i < n; i++) synth(p, T + i * 0.3, 0.14, { f: rand(350, 450), fp: [[0.04, 600], [0.14, 300]], type: 'sawtooth', bp: 900, q: 2, vol: 0.014, a: 0.008 });
  },
  patter(b, T) {
    for (let i = 0; i < 2; i++) synth(b.pan(), T + rand(0, 0.1), 0.012, { noise: 'white', bp: rand(2500, 7000), q: 2, vol: rand(0.01, 0.03), a: 0.0008 });
  },
  thunder(b, T) {
    const d = rand(4, 7);
    if (chance(0.5)) synth(b.pan(), T, 0.6, { noise: 'white', lp: 3500, fto: 400, vol: 0.1, a: 0.005 });
    synth(b.pan(), T + rand(0.1, 0.5), d, { noise: 'brown', lp: 220, fto: 80, vol: rand(0.3, 0.45), a: 0.35, am: [rand(3, 6), 0.4] });
  },
};

// Per-bed output trims (narrow band-passed noise loses a lot of energy).
const BED_TRIM = { wind: 2.8, forest: 3.5, meadow: 4.5, desert: 0.9, snow: 4.5, lava: 0.6, shadow: 0.9, cave: 1.4, town: 3.5, rain: 1 };

const BEDS = {
  wind(b) {
    b.loop('pink', { bp: 420, q: 0.8, vol: 0.14, lfoF: [0.07, 220], lfoG: [0.11, 0.06], pan: -0.4 });
    b.loop('pink', { bp: 700, q: 0.9, vol: 0.1, lfoF: [0.05, 300], lfoG: [0.083, 0.05], pan: 0.4 });
    b.loop('white', { bp: 1500, q: 10, vol: 0.02, lfoF: [0.13, 400], lfoG: [0.09, 0.015] });
    b.every(5, 12, EV.gust); b.every(9, 20, EV.whistle);
  },
  forest(b) {
    b.loop('pink', { bp: 500, q: 0.7, vol: 0.06, lfoG: [0.08, 0.03] });
    b.loop('white', { hp: 2500, lp: 7000, vol: 0.018, lfoG: [0.15, 0.01], pan: 0.3 });
    b.every(1.5, 6, EV.bird, 0.5); b.every(6, 14, EV.rustle); b.every(10, 25, EV.gust);
  },
  meadow(b) {
    b.loop('pink', { bp: 600, q: 0.6, vol: 0.05, lfoG: [0.07, 0.025] });
    b.every(1.2, 5, EV.bird, 0.3); b.every(8, 18, EV.gust);
  },
  desert(b) {
    b.loop('brown', { lp: 350, vol: 0.16, lfoG: [0.06, 0.07] });
    b.loop('white', { hp: 3500, lp: 9000, vol: 0.012, lfoG: [0.1, 0.008] });
    b.every(5, 11, EV.gust); b.every(4, 9, EV.sand); b.every(25, 50, EV.hawk);
  },
  snow(b) {
    b.loop('pink', { bp: 800, q: 1.4, vol: 0.09, lfoF: [0.06, 350], lfoG: [0.09, 0.05] });
    b.loop('white', { bp: 1900, q: 12, vol: 0.015, lfoF: [0.11, 500], lfoG: [0.07, 0.01], pan: -0.3 });
    b.every(5, 10, EV.gust); b.every(7, 15, EV.whistle); b.every(8, 18, EV.tinkle);
  },
  lava(b) {
    b.loop('brown', { lp: 120, vol: 0.3, lfoG: [0.05, 0.1] });
    b.loop('brown', { lp: 450, vol: 0.06, lfoG: [0.13, 0.03] });
    b.every(0.4, 2.0, EV.lavaBubble); b.every(3, 8, EV.hiss); b.every(10, 22, EV.rumble);
  },
  shadow(b) {
    b.loop('brown', { lp: 200, vol: 0.12, lfoG: [0.04, 0.05] });
    b.loop('pink', { bp: 900, q: 3, vol: 0.03, lfoF: [0.05, 400], lfoG: [0.07, 0.02] });
    b.drone(55, 0.03); b.drone(55, 0.025, 14);
    b.every(5, 12, EV.whisper); b.every(8, 18, EV.moan); b.every(10, 24, EV.chime);
  },
  cave(b) {
    b.loop('brown', { lp: 180, vol: 0.1, lfoG: [0.03, 0.03] });
    b.every(0.8, 3.5, EV.drip, 0.3); b.every(12, 30, EV.rocks); b.every(8, 16, EV.caveWind);
  },
  town(b) {
    b.loop('pink', { lp: 500, vol: 0.05 });
    for (const [f, r, pan] of [[380, 3.3, -0.5], [650, 4.4, 0.4], [1100, 5.6, 0]])
      b.loop('pink', { bp: f, q: 2.2, vol: 0.025, lfoG: [r, 0.018], lfoF: [r * 0.37, f * 0.25], pan });   // crowd murmur
    b.every(6, 16, EV.smithy); b.every(30, 70, EV.townBell); b.every(5, 14, EV.knock);
    b.every(4, 12, EV.bird); b.every(20, 45, EV.bark);
  },
  rain(b) {
    b.loop('white', { hp: 1500, lp: 9000, vol: 0.06, lfoG: [0.1, 0.015] });
    b.loop('pink', { lp: 1200, vol: 0.08, lfoG: [0.07, 0.02], pan: -0.3 });
    b.loop('pink', { bp: 3000, q: 0.6, vol: 0.03, pan: 0.4 });
    b.every(0.05, 0.12, EV.patter, 0.1); b.every(18, 40, EV.thunder, rand(6, 15)); b.every(8, 16, EV.gust);
  },
};

/* -------------------------------------------------------------------------- */
/* 12. Scheduler, crossfades, lifecycle & unlock                              */
/* -------------------------------------------------------------------------- */

const LOOKAHEAD = 0.3;     // seconds scheduled ahead on AudioContext time
const TICK_MS = 50;        // wake-up period of the scheduler (timing comes from ctx time)
const GESTURES = ['pointerdown', 'pointerup', 'touchend', 'keydown', 'click'];

const quiet = (p) => { if (p && p.then) p.then(null, () => {}); return p; };

function schedulerTick() {
  if (!isRunning()) return;
  const now = ctx.currentTime, until = now + LOOKAHEAD;
  for (let i = songs.length - 1; i >= 0; i--) {
    const s = songs[i];
    if (s.dying && now > s.dieAt) { s.destroy(); songs.splice(i, 1); continue; }
    try { s.schedule(until); }
    catch (e) { s.destroy(); songs.splice(i, 1); if (s === curSong) curSong = null; }
  }
  for (let i = beds.length - 1; i >= 0; i--) {
    const b = beds[i];
    if (b.dying && now > b.dieAt) { b.destroy(); beds.splice(i, 1); continue; }
    b.tick(now, until);
  }
}
function startTicker() { if (!tickTimer && HAS_WIN) tickTimer = setInterval(schedulerTick, TICK_MS); }

function switchMusic(name) {
  if (curSong && !curSong.dying && curSong.name === name) return;
  if (curSong) curSong.fadeOut();
  curSong = null;
  if (name && THEMES[name]) {
    curSong = new Song(name);
    songs.push(curSong);
    curSong.fade(THEME_TRIM[name] || 1, 2.5);
    curSong.setCombat(want.combat, true);
  }
}
function switchAmbient(type) {
  if (curBed && !curBed.dying && curBed.type === type) return;
  if (curBed) curBed.fadeOut();
  curBed = null;
  if (type && BEDS[type]) {
    curBed = new Bed(type);
    beds.push(curBed);
    curBed.fade(BED_TRIM[type] || 1, 2.5);
  }
}
function applyWanted() {
  if (!isRunning()) return;
  const m = want.music && want.music !== 'none' ? want.music : null;
  if ((curSong ? curSong.name : null) !== m) switchMusic(m);
  const a = want.ambient && want.ambient !== 'none' ? want.ambient : null;
  if ((curBed ? curBed.type : null) !== a) switchAmbient(a);
  if (curSong) curSong.setCombat(want.combat);
}

function addListeners() {
  if (listening || !HAS_WIN) return;
  listening = true;
  for (const e of GESTURES) window.addEventListener(e, unlock, { capture: true, passive: true });
}
function removeListeners() {
  if (!listening) return;
  listening = false;
  for (const e of GESTURES) window.removeEventListener(e, unlock, { capture: true });
}

// Must run inside a user gesture (iOS Safari / Android Chrome autoplay policy).
function unlock() {
  if (!AC) return;
  try {
    if (!ctx) createContext();
    if (!ctx) return;
    if (ctx.state !== 'running') {
      const p = ctx.resume();
      if (p && p.then) p.then(onRunning, () => {});
    }
    // iOS: start a silent buffer inside the gesture to fully unlock output
    const s = ctx.createBufferSource();
    s.buffer = ctx.createBuffer(1, 1, ctx.sampleRate);
    s.connect(ctx.destination); s.start(0);
    s.onended = () => off(s);
    onRunning();
  } catch (e) { /* ignore */ }
}
function onRunning() {
  if (!ctx || ctx.state !== 'running') return;
  everUnlocked = true;
  removeListeners();
  startTicker();
  applyWanted();
}
function onStateChange() {
  if (!ctx) return;
  if (ctx.state === 'running') onRunning();
  else if (!hidden && ctx.state !== 'closed') addListeners();   // e.g. iOS "interrupted": wait for a gesture
}
function onVisibility() {
  hidden = !!document.hidden;
  if (!ctx) return;
  if (hidden) {
    if (ctx.state === 'running') quiet(ctx.suspend());          // pauses music scheduling + saves battery
  } else if (everUnlocked) {
    addListeners();                                             // fallback if resume needs a gesture
    const p = ctx.resume();
    if (p && p.then) p.then(onRunning, () => {});
  }
}

/* -------------------------------------------------------------------------- */
/* 13. Public API                                                             */
/* -------------------------------------------------------------------------- */

const STEP_SURFACES = new Set(['grass', 'stone', 'sand', 'snow', 'wood', 'water']);

export const Audio = {
  init() {
    try {
      if (!AC) return;
      if (!initDone) {
        initDone = true;
        if (HAS_DOC) {
          hidden = !!document.hidden;
          document.addEventListener('visibilitychange', onVisibility);
        }
      }
      if (!ctx || ctx.state !== 'running') addListeners();
      // Called from inside a gesture handler? Unlock right away.
      const ua = typeof navigator !== 'undefined' ? navigator.userActivation : null;
      if (!hidden && !isRunning() && ua && ua.isActive) unlock();
    } catch (e) { /* never throw into game code */ }
  },

  setVolumes(v) {
    try {
      if (!v) return;
      for (const k of ['master', 'music', 'sfx', 'ambient']) {
        const x = Number(v[k]);
        if (v[k] != null && isFinite(x)) vols[k] = clamp(x, 0, 1);
      }
      applyVolumes();
    } catch (e) { /* ignore */ }
  },

  sfx(name, opts) {
    try {
      const fn = SFX[name];
      if (!fn || !isRunning()) return;
      const o = opts || {};
      if (o.vol != null && !(Number(o.vol) > 0)) return;
      // throttle identical sounds: max THROTTLE_N within THROTTLE_MS
      const t = msNow();
      let arr = recent.get(name);
      if (!arr) { arr = []; recent.set(name, arr); }
      while (arr.length && t - arr[0] > THROTTLE_MS) arr.shift();
      if (arr.length >= THROTTLE_N) return;
      // polyphony limit (low-priority sounds give way first)
      if (activeVoices >= (LOW_PRIORITY.has(name) ? MAX_VOICES * 0.6 : MAX_VOICES)) return;
      arr.push(t);
      const v = new Voice(o, name);
      fn(v);
      v.done();
    } catch (e) { /* ignore */ }
  },

  music(theme) {
    try {
      if (theme != null && theme !== 'none' && !THEMES[theme]) return;   // unknown theme: ignore
      want.music = theme || null;
      Audio.init();
      applyWanted();
    } catch (e) { /* ignore */ }
  },

  setCombat(on) {
    try {
      want.combat = !!on;
      if (isRunning() && curSong) curSong.setCombat(want.combat);
    } catch (e) { /* ignore */ }
  },

  ambient(type) {
    try {
      if (type != null && type !== 'none' && !BEDS[type]) return;       // unknown bed: ignore
      want.ambient = type || 'none';
      Audio.init();
      applyWanted();
    } catch (e) { /* ignore */ }
  },

  footstep(surface) {
    const s = STEP_SURFACES.has(surface) ? surface : 'grass';
    Audio.sfx('step_' + s, { vol: rand(0.75, 1), pitch: rand(0.92, 1.08) });
  },

  get unlocked() { return !!(everUnlocked && ctx && ctx.state === 'running'); },
};

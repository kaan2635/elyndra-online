// Procedural animation for every rig. Each frame we compute target joint angles
// from the unit's animation state, then smoothly blend bones toward them.
import { clamp, lerp, angleDiff } from '../core/util.js';

const PI = Math.PI;
const wrap = v => (v > PI ? v - PI * 2 : v < -PI ? v + PI * 2 : v);
const ease = t => t * t * (3 - 2 * t);
const outBack = t => { const c = 1.70158; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };
// piecewise keyframe helper: keys = [[t,v],...]
function kf(keys, t) {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    if (t <= keys[i][0]) {
      const [t0, v0] = keys[i - 1], [t1, v1] = keys[i];
      return lerp(v0, v1, ease((t - t0) / (t1 - t0)));
    }
  }
  return keys[keys.length - 1][1];
}

// Pose buffer: per bone [rx, ry, rz, px, py, pz] offsets (pos offsets added to rest)
function newPose(n) { const p = []; for (let i = 0; i < n; i++) p.push([0, 0, 0, 0, 0, 0]); return p; }

export function createAnimState() {
  return { time: Math.random() * 10, move: 0, run: false, phase: 0, act: null, dead: 0, sit: false, ride: false, swim: false, emote: null, hit: 0, stun: false, cast: null, scaleY: 1, fly: 0 };
}

// start an action (attack/cast/etc.)
export function playAct(a, type, dur = 0.5, extra = {}) { a.act = { type, t: 0, dur, ...extra }; }

export function updateAnim(model, a, dt) {
  a.time += dt;
  if (a.act) { a.act.t += dt; if (a.act.t >= a.act.dur && !a.act.loop) a.act = null; }
  if (a.emote) { a.emote.t += dt; if (a.emote.t > (a.emote.dur ?? 9999)) a.emote = null; }
  if (a.hit > 0) a.hit = Math.max(0, a.hit - dt * 4);
  const bones = model.bones;
  if (!model._pose) model._pose = newPose(bones.length);
  const P = model._pose;
  for (const p of P) p.fill(0);
  switch (model.rig) {
    case 'humanoid': poseHumanoid(model, a, P); break;
    case 'quad': poseQuad(model, a, P); break;
    case 'spider': poseSpider(model, a, P); break;
    case 'blob': poseBlob(model, a, P); break;
    case 'floater': poseFloater(model, a, P); break;
    case 'worm': poseWorm(model, a, P); break;
    case 'dragon': poseDragon(model, a, P); break;
  }
  // blend
  const k = a.dead > 0 ? 1 - Math.exp(-14 * dt) : 1 - Math.exp(-18 * dt);
  const fast = a.act ? 1 - Math.exp(-30 * dt) : k;
  for (let i = 0; i < bones.length; i++) {
    const b = bones[i], p = P[i], rest = model.rest[i];
    const kk = i <= 1 ? k : fast;
    // shortest-arc blending so full spins/rolls never unwind backwards
    b.rotation.x = wrap(b.rotation.x + angleDiff(b.rotation.x, p[0]) * kk);
    b.rotation.y = wrap(b.rotation.y + angleDiff(b.rotation.y, p[1]) * kk);
    b.rotation.z = wrap(b.rotation.z + angleDiff(b.rotation.z, p[2]) * kk);
    b.position.x = lerp(b.position.x, rest.p.x + p[3], kk);
    b.position.y = lerp(b.position.y, rest.p.y + p[4], kk);
    b.position.z = lerp(b.position.z, rest.p.z + p[5], kk);
  }
  if (model.rig === 'blob') {
    const body = bones[1];
    body.scale.set(lerp(body.scale.x, a._sx || 1, k), lerp(body.scale.y, a._sy || 1, k), lerp(body.scale.z, a._sx || 1, k));
  }
}

// ------------------------------------------------------------------ humanoid
function poseHumanoid(m, a, P) {
  const t = a.time;
  const [ROOT, HIPS, CHEST, HEAD, UAL, LAL, UAR, LAR, TL, SL, TR, SR, HR, HL, CAPE, TAIL, WL, WR] = P;
  const wk = m.weaponKind, ok = m.offKind;
  // --- idle / stance
  const br = Math.sin(t * 2.1) * 0.025;
  CHEST[0] += br * 0.5; HEAD[0] -= br * 0.3;
  UAL[2] += 0.1 + br; UAR[2] -= 0.1 + br;
  if (wk && wk !== 'staff' && wk !== 'bow') { LAR[0] = -0.55; UAR[0] = -0.1; }
  if (wk === 'staff' || wk === 'scythe') { LAR[0] = -0.35; UAR[2] = -0.18; }
  if (wk === 'bow') { LAL[0] = -0.25; UAL[0] = -0.1; }
  if (ok === 'shield') { LAL[0] = -0.75; UAL[0] = -0.15; UAL[2] = 0.2; }
  if (ok === 'orb' || ok === 'tome') { LAL[0] = -0.9; }
  if (ok === 'dagger' || ok === 'sword') { LAL[0] = -0.55; }
  CAPE[0] = 0.08 + Math.sin(t * 1.7) * 0.03;
  TAIL[1] = Math.sin(t * 1.8) * 0.4;
  WL[1] = 0.3 + Math.sin(t * 3) * 0.2; WR[1] = -0.3 - Math.sin(t * 3) * 0.2;

  // --- locomotion
  const mv = clamp(a.move, 0, 1.8);
  if (mv > 0.02 && !a.sit && !a.ride && a.dead <= 0) {
    const ph = a.phase, s = Math.sin(ph), c = Math.cos(ph);
    const amp = Math.min(1, mv) * (a.run ? 0.85 : 0.6);
    TL[0] = -s * amp; TR[0] = s * amp;
    SL[0] = Math.max(0, s) * amp * 1.3 + 0.05; SR[0] = Math.max(0, -s) * amp * 1.3 + 0.05;
    UAL[0] += s * amp * 0.85; UAR[0] -= s * amp * 0.85 * (wk && wk !== 'staff' && wk !== 'bow' ? 0.5 : 1);
    LAL[0] -= 0.2 * amp; LAR[0] -= 0.2 * amp;
    HIPS[4] = Math.abs(c) * 0.06 * amp - 0.02 * amp;
    HIPS[1] = s * 0.08 * amp; CHEST[1] = -s * 0.14 * amp;
    CHEST[0] += (a.run ? 0.16 : 0.05) * amp;
    CAPE[0] += 0.35 * amp + Math.sin(ph * 2) * 0.06;
  }
  // --- swim
  if (a.swim && a.dead <= 0) {
    HIPS[0] = -1.15; HIPS[4] = -0.55; HEAD[0] = 0.9;
    const s = Math.sin(t * 4);
    UAL[0] = -2.2 + s * 0.8; UAR[0] = -2.2 - s * 0.8; UAL[2] = 0.5; UAR[2] = -0.5;
    TL[0] = s * 0.35; TR[0] = -s * 0.35;
  }
  // --- sit / ride
  if (a.sit) {
    ROOT[4] = -0.45; TL[0] = -1.5; TR[0] = -1.5; SL[0] = 1.5; SR[0] = 1.5; UAL[0] = -0.4; UAR[0] = -0.4; LAL[0] = -0.6; LAR[0] = -0.6; CHEST[0] = 0.1;
  }
  if (a.ride) {
    TL[0] = -1.25; TR[0] = -1.25; TL[2] = 0.45; TR[2] = -0.45; SL[0] = 1.3; SR[0] = 1.3;
    UAL[0] = -0.5; UAR[0] = -0.5; LAL[0] = -0.7; LAR[0] = -0.7; CHEST[0] = 0.12 + Math.sin(t * 9) * 0.03 * Math.min(1, a.move);
  }
  // --- casting (channel)
  if (a.cast) {
    const s = Math.sin(t * 6) * 0.08;
    if (a.cast === 'up') { UAL[0] = -2.6; UAR[0] = -2.6; UAL[2] = 0.35; UAR[2] = -0.35; LAL[0] = -0.2; LAR[0] = -0.2; HEAD[0] = -0.3; }
    else if (a.cast === 'bow') { UAL[0] = -1.5; UAL[2] = 0.15; LAL[0] = 0; UAR[0] = -1.45; UAR[2] = -0.2; LAR[0] = -1.9; CHEST[1] = -0.5; HEAD[1] = 0.5; }
    else { UAL[0] = -1.25 + s; UAR[0] = -1.25 - s; UAL[2] = -0.25; UAR[2] = 0.25; LAL[0] = -0.6; LAR[0] = -0.6; CHEST[0] -= 0.08; }
  }
  // --- actions
  const A = a.act;
  if (A) {
    const p = clamp(A.t / A.dur, 0, 1);
    switch (A.type) {
      case 'slash': {
        UAR[0] = kf([[0, -0.4], [0.3, -1.6], [0.55, -1.2], [1, -0.4]], p);
        UAR[2] = kf([[0, -0.1], [0.3, -1.3], [0.55, 0.7], [1, -0.1]], p);
        LAR[0] = kf([[0, -0.5], [0.3, -0.9], [0.55, -0.2], [1, -0.5]], p);
        CHEST[1] = kf([[0, 0], [0.3, 0.55], [0.55, -0.6], [1, 0]], p);
        HIPS[1] = CHEST[1] * 0.3;
        break;
      }
      case 'slash2': { // backhand
        UAR[0] = kf([[0, -0.4], [0.3, -1.3], [0.55, -1.5], [1, -0.4]], p);
        UAR[2] = kf([[0, -0.1], [0.3, 0.7], [0.55, -1.3], [1, -0.1]], p);
        CHEST[1] = kf([[0, 0], [0.3, -0.5], [0.55, 0.6], [1, 0]], p);
        break;
      }
      case 'overhead': {
        UAR[0] = kf([[0, -0.4], [0.35, -2.9], [0.55, -0.5], [1, -0.4]], p);
        LAR[0] = kf([[0, -0.5], [0.35, -0.8], [0.55, 0], [1, -0.5]], p);
        UAL[0] = kf([[0, 0], [0.35, -2.6], [0.55, -0.6], [1, 0]], p) * (ok ? 0.3 : 1);
        CHEST[0] = kf([[0, 0], [0.35, -0.25], [0.55, 0.35], [1, 0]], p);
        HIPS[4] = kf([[0, 0], [0.55, -0.1], [1, 0]], p);
        break;
      }
      case 'thrust': {
        UAR[0] = kf([[0, -0.3], [0.3, 0.5], [0.5, -1.6], [1, -0.3]], p);
        LAR[0] = kf([[0, -0.5], [0.3, -1.4], [0.5, 0], [1, -0.5]], p);
        CHEST[1] = kf([[0, 0], [0.3, 0.3], [0.5, -0.3], [1, 0]], p);
        break;
      }
      case 'dual': {
        UAR[0] = kf([[0, -0.3], [0.2, 0.4], [0.35, -1.5], [0.6, -0.4], [1, -0.3]], p);
        LAR[0] = kf([[0, -0.5], [0.2, -1.4], [0.35, 0], [1, -0.5]], p);
        UAL[0] = kf([[0, -0.3], [0.45, 0.4], [0.65, -1.5], [1, -0.3]], p);
        LAL[0] = kf([[0, -0.5], [0.45, -1.4], [0.65, 0], [1, -0.5]], p);
        CHEST[1] = kf([[0, 0], [0.35, -0.35], [0.65, 0.35], [1, 0]], p);
        break;
      }
      case 'spin': {
        ROOT[1] = p * PI * 2 * (A.turns || 1);
        UAR[2] = -1.4; UAL[2] = 1.4; UAR[0] = -0.3; LAR[0] = -0.2;
        break;
      }
      case 'slam': {
        UAR[0] = kf([[0, -0.3], [0.45, -2.9], [0.65, -0.7], [1, -0.3]], p);
        UAL[0] = kf([[0, -0.3], [0.45, -2.9], [0.65, -0.7], [1, -0.3]], p);
        HIPS[4] = kf([[0, 0], [0.45, 0.08], [0.65, -0.25], [1, 0]], p);
        TL[0] = kf([[0, 0], [0.65, -0.6], [1, 0]], p); TR[0] = TL[0]; SL[0] = -TL[0] * 1.6; SR[0] = SL[0];
        CHEST[0] = kf([[0, 0], [0.45, -0.3], [0.65, 0.5], [1, 0]], p);
        break;
      }
      case 'cast': case 'release': {
        const q = A.type === 'release' ? 0.6 + p * 0.4 : p;
        UAR[0] = kf([[0, -0.5], [0.55, -1.2], [0.7, -1.7], [1, -0.4]], q);
        LAR[0] = kf([[0, -0.6], [0.55, -0.9], [0.7, 0], [1, -0.5]], q);
        UAL[0] = kf([[0, -0.3], [0.55, -1.1], [0.7, -0.8], [1, -0.2]], q);
        CHEST[0] = kf([[0, 0], [0.55, -0.12], [0.7, 0.15], [1, 0]], q);
        break;
      }
      case 'raise': {
        UAR[0] = kf([[0, 0], [0.4, -2.7], [0.8, -2.7], [1, 0]], p); UAL[0] = UAR[0];
        UAR[2] = -0.35; UAL[2] = 0.35; HEAD[0] = kf([[0, 0], [0.4, -0.35], [1, 0]], p);
        break;
      }
      case 'bow': {
        UAL[0] = kf([[0, -0.2], [0.25, -1.55], [0.85, -1.55], [1, -0.3]], p); UAL[2] = 0.15;
        LAL[0] = kf([[0, -0.3], [0.25, 0], [1, -0.3]], p);
        UAR[0] = kf([[0, -0.2], [0.25, -1.5], [0.8, -1.45], [0.85, -1.3], [1, -0.2]], p);
        LAR[0] = kf([[0, -0.3], [0.25, -0.5], [0.8, -2.0], [0.85, -0.2], [1, -0.3]], p);
        UAR[2] = kf([[0, -0.1], [0.8, -0.3], [1, -0.1]], p);
        CHEST[1] = kf([[0, 0], [0.25, -0.5], [0.85, -0.5], [1, 0]], p); HEAD[1] = -CHEST[1];
        break;
      }
      case 'throw': {
        UAR[0] = kf([[0, -0.3], [0.4, -2.6], [0.6, -0.9], [1, -0.3]], p);
        UAR[2] = kf([[0, 0], [0.4, -0.5], [1, 0]], p);
        CHEST[1] = kf([[0, 0], [0.4, 0.5], [0.6, -0.4], [1, 0]], p);
        break;
      }
      case 'block': { UAL[0] = -1.3; LAL[0] = -1.0; UAL[2] = 0.1; CHEST[1] = 0.2; break; }
      case 'kick': {
        TR[0] = kf([[0, 0], [0.3, -1.6], [0.6, -1.6], [1, 0]], p); SR[0] = kf([[0, 0], [0.2, 1.4], [0.35, 0.1], [1, 0]], p);
        CHEST[0] = kf([[0, 0], [0.3, -0.2], [1, 0]], p);
        break;
      }
      case 'roll': {
        HIPS[0] = -p * PI * 2; HIPS[4] = -Math.sin(p * PI) * 0.45;
        TL[0] = -1.4; TR[0] = -1.4; SL[0] = 1.6; SR[0] = 1.6; UAL[0] = -1; UAR[0] = -1; LAL[0] = -1.2; LAR[0] = -1.2;
        break;
      }
      case 'leap': {
        HIPS[4] = Math.sin(p * PI) * 0.0; TL[0] = -0.9; TR[0] = 0.4; SL[0] = 1.2; SR[0] = 0.6;
        UAR[0] = kf([[0, -1.8], [0.7, -2.6], [1, -0.4]], p); UAL[0] = -1.4;
        break;
      }
      case 'gather': {
        UAR[0] = kf([[0, -0.3], [0.45, -2.6], [0.65, -0.6], [1, -0.3]], p); UAL[0] = UAR[0];
        LAR[0] = -0.4; LAL[0] = -0.4; CHEST[0] = kf([[0, 0.2], [0.45, -0.1], [0.65, 0.5], [1, 0.2]], p);
        HIPS[4] = -0.08; TL[0] = -0.3; TR[0] = -0.3; SL[0] = 0.5; SR[0] = 0.5;
        break;
      }
      case 'pick': {
        CHEST[0] = kf([[0, 0], [0.4, 0.9], [0.7, 0.9], [1, 0]], p); HIPS[4] = kf([[0, 0], [0.5, -0.35], [1, 0]], p);
        TL[0] = -0.9 * Math.sin(p * PI); TR[0] = TL[0]; SL[0] = -TL[0] * 1.6; SR[0] = SL[0];
        UAR[0] = kf([[0, 0], [0.5, -1.2], [1, 0]], p);
        break;
      }
      case 'fish': {
        UAR[0] = kf([[0, -0.4], [0.3, -2.6], [0.55, -0.9], [1, -0.9]], p); LAR[0] = -0.3;
        UAL[0] = -0.7; LAL[0] = -0.8;
        break;
      }
      case 'hit': {
        CHEST[0] = -0.28 * Math.sin(p * PI); HEAD[0] = -0.2 * Math.sin(p * PI); HIPS[5] = -0.06 * Math.sin(p * PI);
        break;
      }
      case 'roar': {
        CHEST[0] = kf([[0, 0], [0.3, -0.35], [0.8, -0.35], [1, 0]], p); HEAD[0] = -0.4 * Math.sin(p * PI);
        UAL[2] = 1.0 * Math.sin(p * PI); UAR[2] = -1.0 * Math.sin(p * PI); UAL[0] = -0.6; UAR[0] = -0.6;
        break;
      }
      case 'drink': {
        UAR[0] = kf([[0, 0], [0.3, -1.4], [0.8, -1.4], [1, 0]], p); LAR[0] = kf([[0, 0], [0.3, -2.2], [0.8, -2.2], [1, 0]], p); HEAD[0] = -0.3 * Math.sin(p * PI);
        break;
      }
    }
  }
  // --- emotes
  if (a.emote && !A) {
    const et = a.emote.t;
    switch (a.emote.type) {
      case 'wave': UAR[0] = -2.8; UAR[2] = -0.3 + Math.sin(et * 10) * 0.35; LAR[0] = -0.2; break;
      case 'dance': {
        const s = Math.sin(et * 7);
        HIPS[1] = s * 0.3; HIPS[4] = Math.abs(Math.cos(et * 7)) * 0.08; CHEST[2] = s * 0.15;
        UAL[0] = -2.5 + s * 0.5; UAR[0] = -2.5 - s * 0.5; UAL[2] = 0.4; UAR[2] = -0.4;
        TL[0] = Math.max(0, s) * -0.5; TR[0] = Math.max(0, -s) * -0.5; SL[0] = -TL[0]; SR[0] = -TR[0];
        break;
      }
      case 'cheer': { const s = Math.abs(Math.sin(et * 6)); UAL[0] = -2.9 + s * 0.4; UAR[0] = -2.9 + s * 0.4; HIPS[4] = s * 0.08; break; }
      case 'bow': CHEST[0] = 0.8 * Math.min(1, et * 3) * (et < 1.8 ? 1 : 0); UAR[0] = 0.2; break;
      case 'point': UAR[0] = -1.55; LAR[0] = 0; break;
      case 'laugh': CHEST[0] = -0.2 + Math.abs(Math.sin(et * 12)) * 0.12; HEAD[0] = -0.25; break;
      case 'salute': UAR[0] = -2.2; UAR[2] = -1.0; LAR[0] = -2.2; break;
      case 'kneel': ROOT[4] = -0.35; TL[0] = -1.4; SL[0] = 1.5; TR[0] = 0.1; SR[0] = 1.5; CHEST[0] = 0.2; break;
    }
  }
  // --- stun / hit
  if (a.stun && a.dead <= 0) { HEAD[2] = Math.sin(t * 5) * 0.25; CHEST[0] += 0.2; UAL[0] = 0.1; UAR[0] = 0.1; }
  if (a.hit > 0 && !A) { CHEST[0] -= a.hit * 0.25; HEAD[0] -= a.hit * 0.15; }
  // --- death
  if (a.dead > 0) {
    const d = outBack(clamp(a.dead, 0, 1));
    ROOT[0] = -PI / 2 * Math.min(1, d); ROOT[4] = 0.12 * d;
    UAL[2] = 1.2; UAR[2] = -1.2; UAL[0] = -0.4; UAR[0] = -0.4; TL[0] = -0.2; SL[0] = 0.3; HEAD[1] = 0.4;
  }
}

// ------------------------------------------------------------------ quadruped
function poseQuad(m, a, P) {
  const t = a.time;
  const [ROOT, BODY, HEAD, FL, FR, BL, BR, TAIL, JAW] = P;
  HEAD[0] = Math.sin(t * 1.3) * 0.05;
  BODY[4] = Math.sin(t * 2) * 0.01;
  TAIL[1] = Math.sin(t * 3) * 0.25;
  const mv = clamp(a.move, 0, 2);
  if (mv > 0.02 && a.dead <= 0) {
    const ph = a.phase, amp = Math.min(1, mv) * (a.run ? 0.75 : 0.5);
    if (a.run) {
      const s = Math.sin(ph);
      FL[0] = -s * amp; FR[0] = -Math.sin(ph + 0.6) * amp; BL[0] = Math.sin(ph + 0.4) * amp; BR[0] = Math.sin(ph + 1) * amp;
      BODY[0] = Math.cos(ph) * 0.08 * amp; BODY[4] = Math.abs(Math.sin(ph)) * 0.08 * amp;
    } else {
      const s = Math.sin(ph);
      FL[0] = -s * amp; BR[0] = -s * amp; FR[0] = s * amp; BL[0] = s * amp;
      BODY[4] = Math.abs(Math.cos(ph)) * 0.03;
    }
    HEAD[0] += Math.sin(ph * 2) * 0.05; TAIL[1] = Math.sin(ph) * 0.35;
  }
  if (a.sit) { BODY[0] = 0.3; BL[0] = -1.2; BR[0] = -1.2; ROOT[4] = -0.15; }
  const A = a.act;
  if (A) {
    const p = clamp(A.t / A.dur, 0, 1);
    switch (A.type) {
      case 'bite': case 'slash': case 'thrust': case 'overhead': case 'dual': case 'slash2':
        BODY[0] = kf([[0, 0], [0.35, -0.2], [0.55, 0.25], [1, 0]], p);
        BODY[5] = kf([[0, 0], [0.35, -0.12], [0.55, 0.25], [1, 0]], p);
        HEAD[0] = kf([[0, 0], [0.35, -0.45], [0.55, 0.35], [1, 0]], p);
        JAW[0] = kf([[0, 0], [0.35, 0.7], [0.55, 0.0], [1, 0]], p);
        FL[0] = kf([[0, 0], [0.35, -0.6], [0.55, 0.3], [1, 0]], p); FR[0] = FL[0];
        break;
      case 'roar': case 'howl': case 'cast': case 'raise':
        HEAD[0] = -0.8 * Math.sin(p * PI); JAW[0] = 0.6 * Math.sin(p * PI); BODY[0] = -0.15 * Math.sin(p * PI);
        break;
      case 'slam': case 'charge':
        BODY[0] = kf([[0, 0], [0.4, -0.5], [0.6, 0.2], [1, 0]], p); FL[0] = kf([[0, 0], [0.4, -1.2], [0.6, 0.3], [1, 0]], p); FR[0] = FL[0];
        break;
      case 'hit': BODY[0] = -0.12 * Math.sin(p * PI); HEAD[0] = -0.3 * Math.sin(p * PI); break;
    }
  }
  if (a.hit > 0 && !A) HEAD[0] -= a.hit * 0.3;
  if (a.dead > 0) {
    const d = outBack(clamp(a.dead, 0, 1));
    ROOT[2] = PI / 2 * Math.min(1, d); ROOT[4] = 0.05;
    FL[0] = -0.4; FR[0] = -0.2; BL[0] = 0.4; BR[0] = 0.2; HEAD[0] = 0.3; JAW[0] = 0.3;
  }
}

// ------------------------------------------------------------------ spider / scorpion
function poseSpider(m, a, P) {
  const t = a.time;
  const BODY = P[1], HEAD = P[2], ABD = P[3], TAIL = P[12], CL = P[13], CR = P[14];
  BODY[4] = Math.sin(t * 2.5) * 0.02;
  ABD[0] = Math.sin(t * 2) * 0.05;
  const mv = clamp(a.move, 0, 2);
  for (let i = 0; i < 8; i++) {
    const L = P[4 + i];
    const side = i < 4 ? 1 : -1;
    const ph = a.phase * 1.4 + (i % 2) * PI + (i >= 4 ? PI / 2 : 0);
    if (mv > 0.02 && a.dead <= 0) {
      L[1] = Math.sin(ph) * 0.35 * Math.min(1, mv);
      L[2] = Math.max(0, Math.cos(ph)) * 0.3 * side * Math.min(1, mv);
    }
  }
  TAIL[0] = Math.sin(t * 1.5) * 0.08;
  const A = a.act;
  if (A) {
    const p = clamp(A.t / A.dur, 0, 1);
    if (m.kind === 'scorpion' && (A.type === 'thrust' || A.type === 'overhead' || A.type === 'cast')) {
      TAIL[0] = kf([[0, 0], [0.4, -0.4], [0.6, 0.9], [1, 0]], p);
      BODY[0] = kf([[0, 0], [0.6, 0.12], [1, 0]], p);
    } else {
      BODY[0] = kf([[0, 0], [0.4, -0.35], [0.6, 0.15], [1, 0]], p);
      P[4][2] = P[8][2] = 0; P[4][0] = kf([[0, 0], [0.4, -1.1], [0.6, 0.2], [1, 0]], p); P[8][0] = P[4][0];
      CL[1] = kf([[0, 0], [0.4, 0.5], [0.6, -0.3], [1, 0]], p); CR[1] = -CL[1];
      HEAD[0] = kf([[0, 0], [0.4, -0.2], [0.6, 0.3], [1, 0]], p);
    }
  }
  if (a.hit > 0 && !A) BODY[0] -= a.hit * 0.2;
  if (a.dead > 0) {
    const d = clamp(a.dead, 0, 1);
    P[0][4] = -0.2 * d; P[0][2] = PI * d * 0.95;
    for (let i = 0; i < 8; i++) P[4 + i][2] = (i < 4 ? -1 : 1) * 0.9 * d;
  }
}

// ------------------------------------------------------------------ blob
function poseBlob(m, a, P) {
  const t = a.time;
  const ROOT = P[0];
  let sy = 1 + Math.sin(t * 3) * 0.06, sx = 1 - Math.sin(t * 3) * 0.04;
  const mv = clamp(a.move, 0, 2);
  if (mv > 0.02 && a.dead <= 0) {
    const ph = a.phase * 0.8;
    const hop = Math.abs(Math.sin(ph));
    ROOT[4] = hop * 0.4 * Math.min(1, mv);
    sy = 0.8 + hop * 0.35; sx = 1.15 - hop * 0.2;
  }
  const A = a.act;
  if (A) {
    const p = clamp(A.t / A.dur, 0, 1);
    sy = kf([[0, 1], [0.35, 0.6], [0.55, 1.35], [1, 1]], p); sx = kf([[0, 1], [0.35, 1.3], [0.55, 0.85], [1, 1]], p);
    ROOT[5] = kf([[0, 0], [0.55, 0.4], [1, 0]], p);
    ROOT[4] = kf([[0, 0], [0.5, 0.35], [0.7, 0], [1, 0]], p);
  }
  if (a.hit > 0) { sy -= a.hit * 0.25; sx += a.hit * 0.15; }
  if (a.dead > 0) { const d = clamp(a.dead, 0, 1); sy = lerp(1, 0.12, d); sx = lerp(1, 1.6, d); }
  a._sx = sx; a._sy = sy;
}

// ------------------------------------------------------------------ floater
function poseFloater(m, a, P) {
  const t = a.time;
  const [ROOT, CORE, AL, AR, HEAD, WL, WR] = P;
  CORE[4] = Math.sin(t * 2) * 0.12;
  CORE[1] = m.kind === 'wisp' ? t * 1.5 % (PI * 2) : 0;
  AL[2] = 0.2 + Math.sin(t * 1.7) * 0.15; AR[2] = -0.2 - Math.sin(t * 1.7) * 0.15;
  HEAD[0] = Math.sin(t * 1.2) * 0.08;
  if (m.kind === 'bat') { const f = Math.sin(t * 22); WL[2] = f * 0.9; WR[2] = -f * 0.9; CORE[4] += f * 0.04; }
  const mv = clamp(a.move, 0, 2);
  if (mv > 0.02) CORE[0] = 0.25 * Math.min(1, mv);
  const A = a.act;
  if (A) {
    const p = clamp(A.t / A.dur, 0, 1);
    CORE[5] = kf([[0, 0], [0.35, -0.25], [0.55, 0.5], [1, 0]], p);
    CORE[0] = kf([[0, 0], [0.35, -0.3], [0.55, 0.35], [1, 0]], p);
    AL[0] = kf([[0, 0], [0.35, -1.5], [0.55, -0.4], [1, 0]], p); AR[0] = AL[0];
  }
  if (a.hit > 0 && !A) CORE[0] -= a.hit * 0.3;
  if (a.dead > 0) { const d = clamp(a.dead, 0, 1); ROOT[4] = -1.0 * d; ROOT[0] = 0.8 * d; }
}

// ------------------------------------------------------------------ worm
function poseWorm(m, a, P) {
  const t = a.time;
  for (let i = 1; i <= 5; i++) {
    P[i][2] = Math.sin(t * 1.6 + i * 0.8) * 0.12;
    P[i][0] = Math.cos(t * 1.3 + i * 0.6) * 0.06;
  }
  P[7][0] = 0.2 + Math.sin(t * 3) * 0.1;
  const A = a.act;
  if (A) {
    const p = clamp(A.t / A.dur, 0, 1);
    const k = kf([[0, 0], [0.4, -0.25], [0.6, 0.5], [1, 0]], p);
    for (let i = 2; i <= 5; i++) P[i][0] = k;
    P[7][0] = kf([[0, 0.2], [0.4, 0.8], [0.6, 0], [1, 0.2]], p);
  }
  if (a.dead > 0) { const d = clamp(a.dead, 0, 1); for (let i = 1; i <= 5; i++) P[i][0] = 0.3 * d; P[0][4] = -2.5 * d; }
  if (a.emerge != null) P[0][4] = -3.5 * (1 - a.emerge);
}

// ------------------------------------------------------------------ dragon
function poseDragon(m, a, P) {
  const t = a.time;
  const [ROOT, BODY, NECK, HEAD, JAW, WL, WR, T1, T2, FL, FR, BL, BR] = P;
  BODY[4] = Math.sin(t * 1.5) * 0.04; NECK[0] = Math.sin(t * 1.2) * 0.05;
  T1[1] = Math.sin(t * 1.1) * 0.25; T2[1] = Math.sin(t * 1.1 - 0.8) * 0.35;
  WL[2] = 0.15 + Math.sin(t * 1.4) * 0.05; WR[2] = -WL[2];
  const mv = clamp(a.move, 0, 2);
  if (mv > 0.02 && a.dead <= 0) {
    const ph = a.phase * 0.7, s = Math.sin(ph), amp = Math.min(1, mv) * 0.45;
    FL[0] = -s * amp; BR[0] = -s * amp; FR[0] = s * amp; BL[0] = s * amp;
    BODY[2] = s * 0.05;
  }
  if (a.fly > 0) { const f = Math.sin(t * 5); WL[2] = f * 0.9; WR[2] = -f * 0.9; ROOT[4] = a.fly * 3 + f * 0.2; FL[0] = FR[0] = BL[0] = BR[0] = 0.6; }
  const A = a.act;
  if (A) {
    const p = clamp(A.t / A.dur, 0, 1);
    switch (A.type) {
      case 'breath': case 'cast':
        NECK[0] = kf([[0, 0], [0.2, -0.4], [0.35, 0.35], [0.9, 0.35], [1, 0]], p);
        HEAD[0] = kf([[0, 0], [0.2, -0.3], [0.35, 0.2], [1, 0]], p);
        JAW[0] = kf([[0, 0], [0.3, 0.8], [0.9, 0.8], [1, 0]], p);
        break;
      case 'roar': case 'raise':
        NECK[0] = -0.5 * Math.sin(p * PI); HEAD[0] = -0.4 * Math.sin(p * PI); JAW[0] = 0.8 * Math.sin(p * PI);
        WL[2] = 0.9 * Math.sin(p * PI); WR[2] = -WL[2]; BODY[0] = -0.2 * Math.sin(p * PI);
        break;
      case 'slam': case 'overhead':
        BODY[0] = kf([[0, 0], [0.45, -0.5], [0.6, 0.15], [1, 0]], p); ROOT[4] = kf([[0, 0], [0.45, 0.6], [0.6, 0], [1, 0]], p);
        FL[0] = FR[0] = kf([[0, 0], [0.45, -1.0], [0.6, 0.2], [1, 0]], p);
        break;
      case 'tail': case 'spin':
        ROOT[1] = kf([[0, 0], [0.5, PI], [1, PI * 2]], p); T1[1] = 0.6; T2[1] = 0.8;
        break;
      default:
        NECK[0] = kf([[0, 0], [0.35, -0.3], [0.55, 0.45], [1, 0]], p);
        JAW[0] = kf([[0, 0], [0.35, 0.8], [0.55, 0], [1, 0]], p);
    }
  }
  if (a.dead > 0) { const d = clamp(a.dead, 0, 1); ROOT[2] = PI / 2 * d * 0.9; NECK[0] = 0.5 * d; WL[2] = 0.6 * d; WR[2] = 0.6 * d; }
}

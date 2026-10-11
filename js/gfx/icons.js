/**
 * icons.js - procedural "painterly-flat" fantasy MMO icons.
 *
 * Self-contained ES module: no images, no libraries. Every glyph is hand-authored
 * vector path data in a 64x64 design space (SVG path syntax -> Path2D), split in
 * layers that carry a material "tone". Tones are resolved against opts.fill at
 * draw time, so one glyph can be re-tinted for different themes / materials.
 *
 *   drawGlyph(ctx, name, x, y, size, opts)  - glyph only, into box (x,y,size,size)
 *   makeIcon(name, opts)                    - framed icon canvas (HiDPI aware)
 *   iconURL(name, opts)                     - cached PNG data URL of makeIcon()
 *   GLYPH_NAMES, ICON_THEMES
 *
 * Layer format: [tone, pathData, opts?]
 *   tone : base light dark deep accent metal steel gold wood leather stone bone
 *          paper white ink glass flesh meat red blue green purple yellow orange
 *          cyan pink fire ice
 *   opts : l   - stroke-only layer of that width (lines, strings, motion streaks)
 *          o:0 - no outline        hi:0 - no rim light     g:1/0 - gloss on/off
 *          a   - alpha             eo:1 - even-odd fill    fx:1 - additive glow
 *          dash, cap               - line dash / line cap for l-layers
 */

/* ======================================================================
 * 1. Path toolkit (all coordinates in the 64x64 design space)
 * ==================================================================== */
const DEG = Math.PI / 180;
const K = 0.5522847498;
const r2 = (n) => Math.round(n * 100) / 100;
const pt = (p) => r2(p[0]) + ' ' + r2(p[1]);
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

/** Parse SVG path data (M L H V C S Q T Z, abs + rel) into subpaths. */
function parsePath(d) {
  const tok = String(d).match(/[MLHVCSQTZmlhvcsqtz]|[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g) || [];
  const subs = [];
  let sub = null, i = 0, cmd = '', x = 0, y = 0, sx = 0, sy = 0;
  const num = () => parseFloat(tok[i++]);
  const need = () => { if (!sub) { sub = { s: [x, y], g: [], z: false }; subs.push(sub); } };
  while (i < tok.length) {
    if (/^[A-Za-z]$/.test(tok[i])) cmd = tok[i++];
    else if (!cmd) { i++; continue; }
    const rel = cmd >= 'a', U = cmd.toUpperCase();
    const ox = rel ? x : 0, oy = rel ? y : 0;
    if (U !== 'Z' && i >= tok.length) break;
    switch (U) {
      case 'M': x = ox + num(); y = oy + num(); sub = { s: [x, y], g: [], z: false }; subs.push(sub); sx = x; sy = y; cmd = rel ? 'l' : 'L'; break;
      case 'L': need(); x = ox + num(); y = oy + num(); sub.g.push(['L', x, y]); break;
      case 'H': need(); x = ox + num(); sub.g.push(['L', x, y]); break;
      case 'V': need(); y = oy + num(); sub.g.push(['L', x, y]); break;
      case 'C': { need(); const a = ox + num(), b = oy + num(), c = ox + num(), e = oy + num(); x = ox + num(); y = oy + num(); sub.g.push(['C', a, b, c, e, x, y]); break; }
      case 'S': {
        need(); const l = sub.g[sub.g.length - 1];
        const a = l && l[0] === 'C' ? 2 * x - l[3] : x, b = l && l[0] === 'C' ? 2 * y - l[4] : y;
        const c = ox + num(), e = oy + num(); x = ox + num(); y = oy + num(); sub.g.push(['C', a, b, c, e, x, y]); break;
      }
      case 'Q': { need(); const a = ox + num(), b = oy + num(); x = ox + num(); y = oy + num(); sub.g.push(['Q', a, b, x, y]); break; }
      case 'T': {
        need(); const l = sub.g[sub.g.length - 1];
        const a = l && l[0] === 'Q' ? 2 * x - l[1] : x, b = l && l[0] === 'Q' ? 2 * y - l[2] : y;
        x = ox + num(); y = oy + num(); sub.g.push(['Q', a, b, x, y]); break;
      }
      case 'Z': if (sub) sub.z = true; x = sx; y = sy; sub = null; cmd = ''; break;
      default: i++; cmd = '';
    }
  }
  return subs;
}

function toD(subs) {
  let s = '';
  for (const p of subs) {
    s += 'M' + pt(p.s);
    for (const g of p.g) {
      s += g[0];
      for (let k = 1; k < g.length; k += 2) s += (k > 1 ? ' ' : '') + r2(g[k]) + ' ' + r2(g[k + 1]);
    }
    if (p.z) s += 'Z';
  }
  return s;
}

const endOf = (g) => [g[g.length - 2], g[g.length - 1]];

function revSub(p) {
  const pts = [p.s];
  for (const g of p.g) pts.push(endOf(g));
  const out = { s: pts[pts.length - 1].slice(), g: [], z: p.z };
  for (let k = p.g.length - 1; k >= 0; k--) {
    const g = p.g[k], to = pts[k];
    if (g[0] === 'L') out.g.push(['L', to[0], to[1]]);
    else if (g[0] === 'C') out.g.push(['C', g[3], g[4], g[1], g[2], to[0], to[1]]);
    else out.g.push(['Q', g[1], g[2], to[0], to[1]]);
  }
  return out;
}

/** Apply affine matrix [a,b,c,d,e,f]; mirrored transforms keep winding. */
function tfSubs(subs, m) {
  const A = (x, y) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
  const out = subs.map((p) => ({
    s: A(p.s[0], p.s[1]), z: p.z,
    g: p.g.map((g) => { const r = [g[0]]; for (let k = 1; k < g.length; k += 2) r.push(...A(g[k], g[k + 1])); return r; }),
  }));
  return m[0] * m[3] - m[1] * m[2] < 0 ? out.map(revSub) : out;
}

function sampleSub(p, n = 8) {
  const out = [p.s];
  let c = p.s;
  for (const g of p.g) {
    if (g[0] === 'L') out.push([g[1], g[2]]);
    else {
      for (let k = 1; k <= n; k++) {
        const t = k / n, u = 1 - t;
        if (g[0] === 'C') out.push([
          u * u * u * c[0] + 3 * u * u * t * g[1] + 3 * u * t * t * g[3] + t * t * t * g[5],
          u * u * u * c[1] + 3 * u * u * t * g[2] + 3 * u * t * t * g[4] + t * t * t * g[6]]);
        else out.push([u * u * c[0] + 2 * u * t * g[1] + t * t * g[3], u * u * c[1] + 2 * u * t * g[2] + t * t * g[4]]);
      }
    }
    c = endOf(g);
  }
  return out;
}

function areaSub(p) {
  const q = sampleSub(p, 4);
  let a = 0;
  for (let i = 0; i < q.length; i++) { const u = q[i], v = q[(i + 1) % q.length]; a += u[0] * v[1] - v[0] * u[1]; }
  return a;
}

function bboxSubs(subs, pad = 0, bb = [1e9, 1e9, -1e9, -1e9]) {
  for (const p of subs) for (const q of sampleSub(p)) {
    if (q[0] - pad < bb[0]) bb[0] = q[0] - pad;
    if (q[1] - pad < bb[1]) bb[1] = q[1] - pad;
    if (q[0] + pad > bb[2]) bb[2] = q[0] + pad;
    if (q[1] + pad > bb[3]) bb[3] = q[1] + pad;
  }
  return bb;
}

/* ---- matrices + string transforms ---- */
const Mrot = (deg, cx = 32, cy = 32) => {
  const c = Math.cos(deg * DEG), s = Math.sin(deg * DEG);
  return [c, s, -s, c, cx - c * cx + s * cy, cy - s * cx - c * cy];
};
const Msc = (sx, sy = sx, cx = 32, cy = 32) => [sx, 0, 0, sy, cx - sx * cx, cy - sy * cy];
const Mmv = (dx, dy) => [1, 0, 0, 1, dx, dy];
const Mflip = (cx = 32) => [-1, 0, 0, 1, 2 * cx, 0];
function tf(d, ...ms) { let s = parsePath(d); for (const m of ms) s = tfSubs(s, m); return toD(s); }
const rot = (d, deg, cx = 32, cy = 32) => tf(d, Mrot(deg, cx, cy));
const mv = (d, dx, dy) => tf(d, Mmv(dx, dy));
const scl = (d, sx, sy = sx, cx = 32, cy = 32) => tf(d, Msc(sx, sy, cx, cy));
const flip = (d, cx = 32) => tf(d, Mflip(cx));
/** shape + its mirror image (about x = cx) */
const mir = (d, cx = 32) => d + flip(d, cx);
/** Close a right-half outline (starts and ends on x = cx) into a symmetric shape. */
function sym(half, cx = 32) {
  const p = parsePath(half)[0];
  const m = tfSubs([p], Mflip(cx))[0];
  return toD([{ s: p.s, g: p.g.concat(m.g), z: true }]);
}

/* ---- primitive shapes ---- */
function E(cx, cy, rx, ry = rx, deg = 0) {
  const p = [[rx, 0], [rx, ry * K], [rx * K, ry], [0, ry], [-rx * K, ry], [-rx, ry * K], [-rx, 0],
    [-rx, -ry * K], [-rx * K, -ry], [0, -ry], [rx * K, -ry], [rx, -ry * K], [rx, 0]];
  const c = Math.cos(deg * DEG), s = Math.sin(deg * DEG);
  const q = p.map(([x, y]) => [cx + x * c - y * s, cy + x * s + y * c]);
  let d = 'M' + pt(q[0]);
  for (let k = 1; k < 13; k += 3) d += 'C' + pt(q[k]) + ' ' + pt(q[k + 1]) + ' ' + pt(q[k + 2]);
  return d + 'Z';
}
const O = (cx, cy, r) => E(cx, cy, r, r);
/** even-odd ring (use with {eo:1}) */
const ring = (cx, cy, ro, ri) => O(cx, cy, ro) + O(cx, cy, ri);
function R(x, y, w, h, r = 0) {
  r = Math.min(r, w / 2, h / 2);
  if (r <= 0) return P(x, y, x + w, y, x + w, y + h, x, y + h);
  const k = r * (1 - K);
  return `M${r2(x + r)} ${r2(y)}L${r2(x + w - r)} ${r2(y)}C${r2(x + w - k)} ${r2(y)} ${r2(x + w)} ${r2(y + k)} ${r2(x + w)} ${r2(y + r)}` +
    `L${r2(x + w)} ${r2(y + h - r)}C${r2(x + w)} ${r2(y + h - k)} ${r2(x + w - k)} ${r2(y + h)} ${r2(x + w - r)} ${r2(y + h)}` +
    `L${r2(x + r)} ${r2(y + h)}C${r2(x + k)} ${r2(y + h)} ${r2(x)} ${r2(y + h - k)} ${r2(x)} ${r2(y + h - r)}` +
    `L${r2(x)} ${r2(y + r)}C${r2(x)} ${r2(y + k)} ${r2(x + k)} ${r2(y)} ${r2(x + r)} ${r2(y)}Z`;
}
/** closed polygon from flat coordinate list */
function P(...a) { let s = 'M' + r2(a[0]) + ' ' + r2(a[1]); for (let i = 2; i < a.length; i += 2) s += 'L' + r2(a[i]) + ' ' + r2(a[i + 1]); return s + 'Z'; }
/** open polyline */
function line(...a) { let s = 'M' + r2(a[0]) + ' ' + r2(a[1]); for (let i = 2; i < a.length; i += 2) s += 'L' + r2(a[i]) + ' ' + r2(a[i + 1]); return s; }
/** independent line segments x1 y1 x2 y2 ... */
function segs(...a) { let s = ''; for (let i = 0; i + 3 < a.length; i += 4) s += `M${r2(a[i])} ${r2(a[i + 1])}L${r2(a[i + 2])} ${r2(a[i + 3])}`; return s; }
/** radial polygon: count points, radii cycle through the radii array */
function rad(cx, cy, count, radii, deg = -90) {
  const a = [];
  for (let i = 0; i < count; i++) { const r = radii[i % radii.length], t = (deg + (i * 360) / count) * DEG; a.push(cx + r * Math.cos(t), cy + r * Math.sin(t)); }
  return P(...a);
}
const star = (cx, cy, n, ro, ri, deg = -90) => rad(cx, cy, n * 2, [ro, ri], deg);
const ngon = (cx, cy, n, r, deg = -90) => rad(cx, cy, n, [r], deg);
/** 4-point sparkle with concave sides */
function spark(cx, cy, r, w = 0.2, deg = 0) {
  const tip = (i) => [cx + r * Math.cos((deg - 90 + i * 90) * DEG), cy + r * Math.sin((deg - 90 + i * 90) * DEG)];
  const mid = (i) => [cx + r * w * Math.cos((deg - 45 + i * 90) * DEG), cy + r * w * Math.sin((deg - 45 + i * 90) * DEG)];
  let d = 'M' + pt(tip(0));
  for (let i = 0; i < 4; i++) d += 'Q' + pt(mid(i)) + ' ' + pt(tip(i + 1));
  return d + 'Z';
}
/** capsule (rounded stick) from p1 to p2 with radius r */
function cap(x1, y1, x2, y2, r) {
  const L = Math.hypot(x2 - x1, y2 - y1) || 1, ux = (x2 - x1) / L, uy = (y2 - y1) / L;
  const nx = -uy * r, ny = ux * r, kx = ux * r, ky = uy * r;
  const A = [x1 + nx, y1 + ny], B = [x2 + nx, y2 + ny], Cc = [x2 - nx, y2 - ny], D = [x1 - nx, y1 - ny];
  return 'M' + pt(A) + 'L' + pt(B) +
    'C' + pt([B[0] + kx * K, B[1] + ky * K]) + ' ' + pt([x2 + kx + nx * K, y2 + ky + ny * K]) + ' ' + pt([x2 + kx, y2 + ky]) +
    'C' + pt([x2 + kx - nx * K, y2 + ky - ny * K]) + ' ' + pt([Cc[0] + kx * K, Cc[1] + ky * K]) + ' ' + pt(Cc) +
    'L' + pt(D) +
    'C' + pt([D[0] - kx * K, D[1] - ky * K]) + ' ' + pt([x1 - kx - nx * K, y1 - ky - ny * K]) + ' ' + pt([x1 - kx, y1 - ky]) +
    'C' + pt([x1 - kx + nx * K, y1 - ky + ny * K]) + ' ' + pt([A[0] - kx * K, A[1] - ky * K]) + ' ' + pt(A) + 'Z';
}
/** tapered quad from p1 (width w1) to p2 (width w2) */
function taper(x1, y1, x2, y2, w1, w2) {
  const L = Math.hypot(x2 - x1, y2 - y1) || 1, nx = -(y2 - y1) / L, ny = (x2 - x1) / L;
  return P(x1 + (nx * w1) / 2, y1 + (ny * w1) / 2, x2 + (nx * w2) / 2, y2 + (ny * w2) / 2,
    x2 - (nx * w2) / 2, y2 - (ny * w2) / 2, x1 - (nx * w1) / 2, y1 - (ny * w1) / 2);
}

/* ---- curves: Catmull-Rom, bands, arcs, spirals ---- */
function crSegs(pts, closed) {
  const n = pts.length;
  const Q = (i) => (closed ? pts[(i + n) % n] : pts[Math.max(0, Math.min(n - 1, i))]);
  let s = '';
  for (let i = 0; i < (closed ? n : n - 1); i++) {
    const p0 = Q(i - 1), p1 = Q(i), p2 = Q(i + 1), p3 = Q(i + 2);
    s += 'C' + pt([p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6]) + ' ' +
      pt([p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6]) + ' ' + pt(p2);
  }
  return s;
}
/** smooth curve through points */
const cr = (pts, closed = true) => 'M' + pt(pts[0]) + crSegs(pts, closed) + (closed ? 'Z' : '');
/** variable-width ribbon along a centre line; w = number | (t) => width */
function band(pts, w) {
  const n = pts.length, Lf = [], Rt = [];
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
    let dx = b[0] - a[0], dy = b[1] - a[1];
    const len = Math.hypot(dx, dy) || 1; dx /= len; dy /= len;
    const hw = (typeof w === 'function' ? w(i / (n - 1)) : w) / 2;
    Lf.push([pts[i][0] - dy * hw, pts[i][1] + dx * hw]);
    Rt.push([pts[i][0] + dy * hw, pts[i][1] - dx * hw]);
  }
  Rt.reverse();
  return 'M' + pt(Lf[0]) + crSegs(Lf, false) + 'L' + pt(Rt[0]) + crSegs(Rt, false) + 'Z';
}
const apt = (cx, cy, r, a, ry = r) => [cx + r * Math.cos(a * DEG), cy + ry * Math.sin(a * DEG)];
/** cubic arc segments (continuation, no M) from angle a0 to a1 (degrees, clockwise +) */
function arcSeg(cx, cy, r, a0, a1, ry = r) {
  let s = '';
  const n = Math.max(1, Math.ceil(Math.abs(a1 - a0) / 90)), da = (a1 - a0) / n;
  for (let i = 0; i < n; i++) {
    const t0 = (a0 + da * i) * DEG, t1 = (a0 + da * (i + 1)) * DEG, k = (4 / 3) * Math.tan((t1 - t0) / 4);
    const x0 = Math.cos(t0), y0 = Math.sin(t0), x1 = Math.cos(t1), y1 = Math.sin(t1);
    s += 'C' + pt([cx + r * (x0 - k * y0), cy + ry * (y0 + k * x0)]) + ' ' + pt([cx + r * (x1 + k * y1), cy + ry * (y1 - k * x1)]) + ' ' + pt([cx + r * x1, cy + ry * y1]);
  }
  return s;
}
const arcD = (cx, cy, r, a0, a1, ry = r) => 'M' + pt(apt(cx, cy, r, a0, ry)) + arcSeg(cx, cy, r, a0, a1, ry);
const arcBand = (cx, cy, ro, ri, a0, a1) => arcD(cx, cy, ro, a0, a1) + 'L' + pt(apt(cx, cy, ri, a1)) + arcSeg(cx, cy, ri, a1, a0) + 'Z';
function arcP(cx, cy, r, a0, a1, n = 16, ry = r) { const o = []; for (let i = 0; i <= n; i++) o.push(apt(cx, cy, r, a0 + ((a1 - a0) * i) / n, ry)); return o; }
function spiralP(cx, cy, r0, r1, a0, a1, n = 36) {
  const o = [];
  for (let i = 0; i <= n; i++) { const t = i / n; o.push(apt(cx, cy, r0 + (r1 - r0) * t, a0 + (a1 - a0) * t)); }
  return o;
}
/** crescent-shaped tapered swipe along an arc */
const swoosh = (cx, cy, r, a0, a1, w, n = 20, pw = 0.8) => band(arcP(cx, cy, r, a0, a1, n), (t) => w * Math.pow(Math.sin(Math.PI * t), pw));
/** circle (cx,cy,r) minus circle (cx+ox, cy+oy, r2) */
function crescent(cx, cy, r, ox, oy, rr) {
  const d = Math.hypot(ox, oy), ux = ox / d, uy = oy / d;
  const a = (r * r - rr * rr + d * d) / (2 * d), h = Math.sqrt(Math.max(0, r * r - a * a));
  const mx = cx + ux * a, my = cy + uy * a;
  const A = [mx - uy * h, my + ux * h], B = [mx + uy * h, my - ux * h];
  const ang = (p, c) => Math.atan2(p[1] - c[1], p[0] - c[0]) / DEG;
  const sweep = (from, to, through) => {
    const s = (((to - from) % 360) + 360) % 360, t = (((through - from) % 360) + 360) % 360;
    return t < s ? s : s - 360;
  };
  const toward = Math.atan2(-uy, -ux) / DEG, c2 = [cx + ox, cy + oy];
  const a0 = ang(A, [cx, cy]), s1 = sweep(a0, ang(B, [cx, cy]), toward);
  const b0 = ang(B, c2), s2 = sweep(b0, ang(A, c2), toward);
  return 'M' + pt(A) + arcSeg(cx, cy, r, a0, a0 + s1) + arcSeg(c2[0], c2[1], rr, b0, b0 + s2) + 'Z';
}
/** tear drop, tip at (cx,ty), total height h */
function drop(cx, ty, h) {
  const r = h * 0.34, by = ty + h;
  return sym(`M${cx} ${ty}C${cx + r * 0.25} ${ty + h * 0.25} ${cx + r} ${by - r * 1.55} ${cx + r} ${by - r}C${cx + r} ${by - r * 0.45} ${cx + r * 0.55} ${by} ${cx} ${by}`, cx);
}
/** pointed leaf from base (x1,y1) to tip (x2,y2) */
function leaf(x1, y1, x2, y2, w, bend = 0) {
  const dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L, nx = -uy, ny = ux, hw = (w / 2) * 1.33;
  const Pp = (t, o) => { const b = o + bend * Math.sin(Math.PI * t); return pt([x1 + ux * L * t + nx * b, y1 + uy * L * t + ny * b]); };
  return `M${r2(x1)} ${r2(y1)}C${Pp(0.18, hw)} ${Pp(0.62, hw)} ${r2(x2)} ${r2(y2)}C${Pp(0.62, -hw)} ${Pp(0.18, -hw)} ${r2(x1)} ${r2(y1)}Z`;
}
/** head + shoulders bust centred on cx; cy = neck line */
function bust(cx, cy, s = 1) {
  return [O(cx, cy - 12 * s, 9 * s),
    `M${r2(cx - 19 * s)} ${r2(cy + 22 * s)}C${r2(cx - 19 * s)} ${r2(cy + 6 * s)} ${r2(cx - 10 * s)} ${r2(cy + 1 * s)} ${r2(cx)} ${r2(cy + 1 * s)}` +
    `C${r2(cx + 10 * s)} ${r2(cy + 1 * s)} ${r2(cx + 19 * s)} ${r2(cy + 6 * s)} ${r2(cx + 19 * s)} ${r2(cy + 22 * s)}Z`];
}
/** gear outline with n teeth */
function gearD(cx, cy, n, ro, ri) {
  const a = [], st = 360 / n;
  for (let i = 0; i < n; i++) {
    const b = -90 + i * st;
    for (const [f, r] of [[-0.3, ri], [-0.17, ro], [0.17, ro], [0.3, ri]]) a.push(...apt(cx, cy, r, b + f * st));
  }
  return P(...a);
}

/* ======================================================================
 * 2. Colour helpers + tone palette
 * ==================================================================== */
const WHITE = [255, 255, 255], BLACK = [0, 0, 0];
let _cctx = null;
function rgb(c) {
  if (Array.isArray(c)) return c;
  let s = String(c == null ? '#888' : c).trim();
  if (s[0] !== '#' && typeof document !== 'undefined') {
    _cctx = _cctx || document.createElement('canvas').getContext('2d');
    _cctx.fillStyle = '#888'; _cctx.fillStyle = s; s = String(_cctx.fillStyle);
  }
  if (s[0] === '#') {
    let h = s.slice(1);
    if (h.length <= 4) h = [...h].map((ch) => ch + ch).join('');
    const n = parseInt(h.slice(0, 6), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  const m = s.match(/[\d.]+/g);
  return m && m.length >= 3 ? [+m[0], +m[1], +m[2]] : [136, 136, 136];
}
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const css = (c, a = 1) => {
  const v = c.map((x) => Math.round(clamp(x, 0, 255)));
  return a >= 1 ? `rgb(${v[0]},${v[1]},${v[2]})` : `rgba(${v[0]},${v[1]},${v[2]},${r2(a)})`;
};
function toHsl([r, g, b]) {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
  let h = 0, s = 0;
  if (mx !== mn) {
    const d = mx - mn;
    s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
    h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h *= 60;
  }
  return [h, s, l];
}
function fromHsl([h, s, l]) {
  h = ((h % 360) + 360) % 360 / 360;
  if (!s) return [l * 255, l * 255, l * 255];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
  const f = (t) => { t = (t + 1) % 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < 0.5 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; };
  return [f(h + 1 / 3) * 255, f(h) * 255, f(h - 1 / 3) * 255];
}
const hueShift = (c, d) => { const h = toHsl(c); return fromHsl([h[0] + d, Math.min(1, h[1] * 1.1 + 0.05), h[2]]); };
const saturate = (c, k) => { const h = toHsl(c); return fromHsl([h[0], clamp(h[1] + k, 0, 1), h[2]]); };

const TONE_ALPHA = { glass: 0.42 };
const GLOSSY = { metal: 1, gold: 1, glass: 1 };
const PAL_CACHE = new Map();
/** Resolve every tone to a [light, mid, dark] gradient triple derived from fill. */
function palette(fill) {
  const key = JSON.stringify(fill == null ? null : fill);
  let p = PAL_CACHE.get(key);
  if (p) return p;
  const arr = Array.isArray(fill) ? fill : [fill || '#c8ccd4'];
  const c1 = rgb(arr[0]), c2 = arr[1] ? rgb(arr[1]) : null, m = c2 ? mix(c1, c2, 0.5) : c1;
  const tri = (c, k = 1) => [mix(c, WHITE, 0.4 * k), c, mix(c, BLACK, 0.45 * k)];
  const tint = (hex, a) => mix(rgb(hex), m, a);
  p = {
    base: c2 ? [mix(c1, WHITE, 0.15), mix(c1, c2, 0.55), mix(c2, BLACK, 0.2)] : tri(c1),
    light: tri(mix(m, WHITE, 0.5), 0.6),
    dark: tri(mix(m, BLACK, 0.42)),
    deep: tri(mix(m, BLACK, 0.68), 0.8),
    accent: tri(c2 ? mix(c2, WHITE, 0.1) : hueShift(m, 38)),
    metal: tri(tint('#d4dce4', 0.14)),
    steel: tri(tint('#7c8894', 0.12)),
    gold: tri(tint('#f2bf3e', 0.08)),
    wood: tri(tint('#9a6234', 0.08)),
    leather: tri(tint('#6e4329', 0.08)),
    stone: tri(tint('#8a8e96', 0.1)),
    bone: tri(rgb('#eadcbc')),
    paper: tri(rgb('#eedcae'), 0.8),
    white: tri(rgb('#f8f6ef'), 0.45),
    ink: tri(rgb('#22170f'), 0.3),
    glass: tri(tint('#e4f5ff', 0.2), 0.5),
    flesh: tri(rgb('#e8b08a')),
    meat: tri(rgb('#b5512c')),
    red: tri(rgb('#e2352c')),
    blue: tri(rgb('#3a7fe6')),
    green: tri(rgb('#4dbf3a')),
    purple: tri(rgb('#9a4ee2')),
    yellow: tri(rgb('#ffd43c'), 0.8),
    orange: tri(rgb('#ff8a1e')),
    cyan: tri(rgb('#6fe2ff')),
    pink: tri(rgb('#ff74b0')),
    fire: tri(rgb('#ff7a1a')),
    ice: tri(rgb('#a6e6ff')),
  };
  PAL_CACHE.set(key, p);
  return p;
}

/* ======================================================================
 * 3. Glyph registry
 * ==================================================================== */
const RAW = Object.create(null);
/**
 * def(name, defaultFill, layers, meta)
 * meta: rot (deg, applied to authored layers), fit (target extent, default 56, 0 = off),
 *       dx/dy (nudge after fitting), bg (default background pair)
 */
function def(name, fill, layers, meta = {}) { RAW[name] = { fill, L: layers, m: meta }; }
/** copy of another glyph's authored (un-rotated) layers */
const lay = (name) => RAW[name].L.map((l) => [l[0], l[1], l[2] ? { ...l[2] } : undefined]);
/** transform a layer list by matrices (applied in order) */
function xf(layers, ...ms) {
  let s = 1;
  for (const m of ms) s *= Math.sqrt(Math.abs(m[0] * m[3] - m[1] * m[2]));
  return layers.map(([t, d, o]) => [t, tf(d, ...ms), o && o.l ? { ...o, l: o.l * s } : o]);
}
/** retone a layer list */
const retone = (layers, map) => layers.map(([t, d, o]) => [map[t] || t, d, o]);

const BUILT = new Map();
function getGlyph(name) {
  let g = BUILT.get(name);
  if (g) return g;
  const raw = RAW[name] || RAW.__unknown;
  const meta = raw.m || {};
  const layers = raw.L.map(([tone, d, o]) => ({ tone, o: o || {}, lw: (o && o.l) || 0, subs: parsePath(d) }));
  if (meta.rot) for (const L of layers) L.subs = tfSubs(L.subs, Mrot(meta.rot));
  const fit = meta.fit === undefined ? 58 : meta.fit;
  if (fit) {
    const bb = [1e9, 1e9, -1e9, -1e9];
    for (const L of layers) if (!L.o.fx) bboxSubs(L.subs, L.lw / 2, bb);
    const s = fit / Math.max(bb[2] - bb[0], bb[3] - bb[1], 1);
    const m = [s, 0, 0, s, 32 - (s * (bb[0] + bb[2])) / 2 + (meta.dx || 0), 32 - (s * (bb[1] + bb[3])) / 2 + (meta.dy || 0)];
    for (const L of layers) { L.subs = tfSubs(L.subs, m); L.lw *= s; }
  }
  const hasP2D = typeof Path2D !== 'undefined';
  const outline = hasP2D ? new Path2D() : null, solid = hasP2D ? new Path2D() : null, lines = [];
  for (const L of layers) {
    const o = L.o;
    L.line = !!o.l;
    if (!L.line && !o.eo) L.subs = L.subs.map((p) => (areaSub(p) < 0 ? revSub(p) : p));
    L.bb = bboxSubs(L.subs, L.lw / 2);
    L.d = toD(L.subs);
    L.path = hasP2D ? new Path2D(L.d) : null;
    L.rule = o.eo ? 'evenodd' : 'nonzero';
    L.alpha = o.a != null ? o.a : TONE_ALPHA[L.tone] || 1;
    L.outlined = o.o !== 0 && !o.fx;
    L.hi = o.hi !== 0 && !L.line && !o.fx;
    L.gloss = !L.line && !o.fx && (o.g === 1 || (o.g !== 0 && !!GLOSSY[L.tone]));
    if (L.outlined && hasP2D) {
      if (L.line) lines.push(L);
      else { outline.addPath(L.path); if (L.alpha >= 1 && !o.eo) solid.addPath(L.path); }
    }
  }
  g = { layers, outline, solid, lines, fill: raw.fill, bg: meta.bg };
  BUILT.set(name, g);
  return g;
}

/* ======================================================================
 * 4. Rendering
 * ==================================================================== */
function paintLayer(ctx, L, pal, sw, ink, opts) {
  const [x0, y0, x1, y1] = L.bb, w = x1 - x0, h = y1 - y0;
  const tri = pal[L.tone] || pal.base;
  ctx.globalAlpha = L.alpha;
  if (L.o.fx) {
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, r = Math.max(w, h) / 2;
    const gr = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    gr.addColorStop(0, css(tri[0], 0.9));
    gr.addColorStop(0.4, css(tri[1], 0.45));
    gr.addColorStop(1, css(tri[1], 0));
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = gr;
    ctx.fill(L.path);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    return;
  }
  const lg = ctx.createLinearGradient(x0 + w * 0.22, y0, x1 - w * 0.22, y1);
  lg.addColorStop(0, css(tri[0]));
  lg.addColorStop(0.5, css(tri[1]));
  lg.addColorStop(1, css(tri[2]));
  if (L.line) {
    ctx.lineCap = L.o.cap || 'round';
    if (L.outlined && sw > 0) { ctx.strokeStyle = ink; ctx.lineWidth = L.lw + sw; ctx.stroke(L.path); }
    ctx.strokeStyle = lg;
    ctx.lineWidth = L.lw;
    if (L.o.dash) ctx.setLineDash(L.o.dash);
    ctx.stroke(L.path);
    if (L.o.dash) ctx.setLineDash([]);
    ctx.globalAlpha = 1;
    return;
  }
  if (L.outlined && sw > 0) { ctx.strokeStyle = ink; ctx.lineWidth = sw * 1.1; ctx.stroke(L.path); }
  ctx.fillStyle = lg;
  ctx.fill(L.path, L.rule);
  if ((L.hi || L.gloss) && opts.highlight !== false) {
    ctx.save();
    ctx.clip(L.path, L.rule);
    if (L.hi) {
      const hw = clamp(Math.min(w, h) * 0.13, 0.6, 2.4);
      ctx.save();
      ctx.translate(hw * 0.6, hw * 0.85);
      ctx.lineWidth = hw * 1.5;
      ctx.strokeStyle = 'rgba(255,255,255,0.42)';
      ctx.stroke(L.path);
      ctx.translate(-hw * 1.4, -hw * 1.85);
      ctx.lineWidth = hw * 2;
      ctx.strokeStyle = 'rgba(0,0,0,0.28)';
      ctx.stroke(L.path);
      ctx.restore();
    }
    if (L.gloss) {
      const gx = x0 + w * 0.34, gy = y0 + h * 0.28, gr = Math.max(2, Math.min(w, h) * 0.45);
      const rg = ctx.createRadialGradient(gx, gy, 0, gx, gy, gr);
      rg.addColorStop(0, 'rgba(255,255,255,0.7)');
      rg.addColorStop(0.45, 'rgba(255,255,255,0.22)');
      rg.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = rg;
      ctx.fillRect(x0, y0, w, h);
    }
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}

/**
 * Draw a glyph (no background) into the box (x, y, size, size).
 * opts: fill (css colour | [c1, c2]), stroke ('#120c08'), strokeWidth (px, default size/24),
 *       shadow (true), highlight (true)
 */
export function drawGlyph(ctx, name, x, y, size, opts = {}) {
  if (typeof Path2D === 'undefined' || !ctx) return;
  const g = getGlyph(name);
  const pal = palette(opts.fill != null ? opts.fill : g.fill);
  const s = size / 64;
  const sw = opts.strokeWidth != null ? opts.strokeWidth / s : 64 / 24;
  const ink = opts.stroke || '#120c08';
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  const T = ctx.getTransform ? ctx.getTransform() : { a: s, b: 0 };
  const px = Math.hypot(T.a, T.b) || 1;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  // pass 1: dark silhouette + outer outline, casting the soft drop shadow
  if (opts.shadow !== false) {
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = 2.6 * px;
    ctx.shadowOffsetX = 0.9 * px;
    ctx.shadowOffsetY = 1.7 * px;
  }
  ctx.fillStyle = ctx.strokeStyle = ink;
  if (sw > 0) { ctx.lineWidth = sw * 2; ctx.stroke(g.outline); }
  ctx.fill(g.solid);
  for (const L of g.lines) {
    ctx.lineCap = L.o.cap || 'round';
    ctx.lineWidth = L.lw + sw * 2;
    ctx.stroke(L.path);
  }
  ctx.shadowColor = 'rgba(0,0,0,0)';
  ctx.shadowBlur = ctx.shadowOffsetX = ctx.shadowOffsetY = 0;
  // pass 2: shaded layers
  for (const L of g.layers) paintLayer(ctx, L, pal, sw, ink, opts);
  ctx.restore();
}

/* ---- icon background / frame ---- */
let NOISE = null;
function noiseCanvas() {
  if (NOISE) return NOISE;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const x = c.getContext('2d');
  const id = x.createImageData(64, 64);
  let seed = 1234567;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < id.data.length; i += 4) {
    const v = 128 + (rnd() - 0.5) * 200 + (rnd() - 0.5) * 55;
    id.data[i] = id.data[i + 1] = id.data[i + 2] = clamp(v, 0, 255);
    id.data[i + 3] = 255;
  }
  x.putImageData(id, 0, 0);
  return (NOISE = c);
}
function rrPath(ctx, x, y, w, h, r) {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
const defaultDpr = () => (typeof devicePixelRatio === 'number' && devicePixelRatio > 0 ? Math.min(2, devicePixelRatio) : 1);

function renderIcon(name, o, cpu = false) {
  const size = o.size || 64, dpr = o.dpr || defaultDpr();
  const g = getGlyph(name);
  const fill = o.fill != null ? o.fill : g.fill;
  const fa = Array.isArray(fill) ? fill : [fill];
  const c1 = rgb(fa[0]), m = fa[1] ? mix(c1, rgb(fa[1]), 0.5) : c1;
  const bgPair = o.bg || g.bg || [mix(saturate(m, 0.12), BLACK, 0.55), mix(m, BLACK, 0.87)];
  const b0 = rgb(bgPair[0]), b1 = rgb(bgPair[1] != null ? bgPair[1] : mix(b0, BLACK, 0.7));
  const cv = document.createElement('canvas');
  cv.width = cv.height = Math.max(1, Math.round(size * dpr));
  cv.style.width = cv.style.height = size + 'px';
  const ctx = cv.getContext('2d', cpu ? { willReadFrequently: true } : undefined);
  ctx.scale(cv.width / size, cv.height / size);
  const rad = o.round != null ? o.round : size * 0.14;
  const frame = o.frame === undefined ? '#8a7350' : o.frame;
  const fw = frame ? (o.frameWidth != null ? o.frameWidth : Math.max(2.2, size * 0.055)) : 0;

  // --- face: gradient, grain, glow, vignette
  ctx.save();
  ctx.beginPath(); rrPath(ctx, 0, 0, size, size, rad); ctx.clip();
  let gr = ctx.createRadialGradient(size * 0.4, size * 0.32, size * 0.04, size * 0.5, size * 0.5, size * 0.8);
  gr.addColorStop(0, css(mix(b0, WHITE, 0.14)));
  gr.addColorStop(0.42, css(b0));
  gr.addColorStop(1, css(b1));
  ctx.fillStyle = gr;
  ctx.fillRect(0, 0, size, size);
  const pat = ctx.createPattern(noiseCanvas(), 'repeat');
  if (pat) {
    if (pat.setTransform && typeof DOMMatrix !== 'undefined') pat.setTransform(new DOMMatrix().scale(Math.max(0.5, 1 / dpr)));
    ctx.globalAlpha = 0.16;
    ctx.globalCompositeOperation = 'overlay';
    ctx.fillStyle = pat;
    ctx.fillRect(0, 0, size, size);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
  }
  if (o.glow) {
    const gc = rgb(o.glow);
    const gg = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size * 0.47);
    gg.addColorStop(0, css(gc, 0.7));
    gg.addColorStop(0.5, css(gc, 0.25));
    gg.addColorStop(1, css(gc, 0));
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = gg;
    ctx.fillRect(0, 0, size, size);
    ctx.globalCompositeOperation = 'source-over';
  }
  gr = ctx.createRadialGradient(size * 0.5, size * 0.44, size * 0.22, size * 0.5, size * 0.5, size * 0.74);
  gr.addColorStop(0, 'rgba(0,0,0,0)');
  gr.addColorStop(1, 'rgba(0,0,0,0.62)');
  ctx.fillStyle = gr;
  ctx.fillRect(0, 0, size, size);
  // top sheen
  gr = ctx.createLinearGradient(0, 0, 0, size * 0.55);
  gr.addColorStop(0, 'rgba(255,255,255,0.13)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gr;
  ctx.beginPath(); ctx.ellipse(size * 0.5, size * 0.02, size * 0.66, size * 0.44, 0, 0, Math.PI * 2); ctx.fill();

  // --- glyph
  const pad = fw + size * 0.07, gs = size - pad * 2;
  drawGlyph(ctx, name, pad, pad, gs, {
    fill, stroke: o.stroke, strokeWidth: o.strokeWidth != null ? o.strokeWidth : gs / 24,
    shadow: o.shadow, highlight: o.highlight,
  });
  // inner rim shadow (depth)
  ctx.beginPath(); rrPath(ctx, fw + 0.5, fw + 0.5, size - 2 * fw - 1, size - 2 * fw - 1, Math.max(0, rad - fw * 0.7));
  ctx.lineWidth = Math.max(0.8, size * 0.03);
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.stroke();
  ctx.restore();

  // --- frame
  const hair = clamp(size / 64, 0.5, 1.5);
  if (fw > 0) {
    const fc = rgb(frame);
    ctx.beginPath();
    rrPath(ctx, 0.5 * hair, 0.5 * hair, size - hair, size - hair, rad);
    rrPath(ctx, fw, fw, size - 2 * fw, size - 2 * fw, Math.max(0, rad - fw * 0.7));
    const lg = ctx.createLinearGradient(0, 0, size * 0.25, size);
    lg.addColorStop(0, css(mix(fc, WHITE, 0.5)));
    lg.addColorStop(0.18, css(mix(fc, WHITE, 0.15)));
    lg.addColorStop(0.55, css(fc));
    lg.addColorStop(0.85, css(mix(fc, BLACK, 0.32)));
    lg.addColorStop(1, css(mix(fc, BLACK, 0.55)));
    ctx.fillStyle = lg;
    ctx.fill('evenodd');
    // bevel: light upper-left edge, dark lower-right edge
    const bl = ctx.createLinearGradient(0, 0, size, size);
    bl.addColorStop(0, 'rgba(255,255,255,0.7)');
    bl.addColorStop(0.45, 'rgba(255,255,255,0)');
    bl.addColorStop(0.55, 'rgba(0,0,0,0)');
    bl.addColorStop(1, 'rgba(0,0,0,0.45)');
    const bw = Math.max(0.5, fw * 0.28), bi = hair * 0.9 + bw / 2;
    ctx.beginPath(); rrPath(ctx, bi, bi, size - 2 * bi, size - 2 * bi, Math.max(0, rad - bi));
    ctx.lineWidth = bw;
    ctx.strokeStyle = bl;
    ctx.stroke();
    const il = hair * 0.8;
    ctx.beginPath(); rrPath(ctx, fw - il / 2, fw - il / 2, size - 2 * fw + il, size - 2 * fw + il, Math.max(0, rad - fw * 0.7));
    ctx.lineWidth = il;
    ctx.strokeStyle = 'rgba(0,0,0,0.8)';
    ctx.stroke();
  }
  ctx.beginPath(); rrPath(ctx, 0.5 * hair, 0.5 * hair, size - hair, size - hair, rad);
  ctx.lineWidth = hair;
  ctx.strokeStyle = 'rgba(4,2,1,0.9)';
  ctx.stroke();

  // --- badge (stack count etc.)
  if (o.badge != null && o.badge !== '') {
    const fs = Math.max(8, Math.round(size * 0.27));
    ctx.font = `800 ${fs}px system-ui, "Segoe UI", Roboto, sans-serif`;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'alphabetic';
    const bx = size - fw - size * 0.07, by = size - fw - size * 0.07;
    ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(2, fs * 0.24);
    ctx.strokeStyle = 'rgba(0,0,0,0.92)';
    ctx.strokeText(String(o.badge), bx, by);
    ctx.fillStyle = '#fff';
    ctx.fillText(String(o.badge), bx, by);
  }

  // --- locked / unavailable: greyscale + darken
  if (o.dim) {
    ctx.save();
    ctx.beginPath(); rrPath(ctx, 0, 0, size, size, rad); ctx.clip();
    ctx.globalCompositeOperation = 'saturation';
    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, size, size);
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(0, 0, size, size);
    ctx.restore();
  }
  return cv;
}

const ICON_CACHE = new Map(), URL_CACHE = new Map();
function masterCanvas(name, opts) {
  const key = name + '|' + JSON.stringify(opts);
  let c = ICON_CACHE.get(key);
  if (!c) {
    c = renderIcon(name, opts);
    if (ICON_CACHE.size > 1500) ICON_CACHE.delete(ICON_CACHE.keys().next().value);
    ICON_CACHE.set(key, c);
  }
  return c;
}

/**
 * Framed icon canvas (backing store = size * dpr, CSS size = size).
 * opts: size=64, fill, bg:[c1,c2], frame (css | null), frameWidth, round, dpr,
 *       glow, badge, dim, stroke, strokeWidth
 */
export function makeIcon(name, opts = {}) {
  const src = masterCanvas(name, opts);
  const c = document.createElement('canvas');
  c.width = src.width;
  c.height = src.height;
  c.style.width = src.style.width;
  c.style.height = src.style.height;
  c.getContext('2d').drawImage(src, 0, 0);
  return c;
}

/** Cached PNG data URL of makeIcon(name, opts). */
export function iconURL(name, opts = {}) {
  const key = name + '|' + JSON.stringify(opts);
  let u = URL_CACHE.get(key);
  if (!u) {
    // CPU-backed canvas: avoids a GPU read-back per icon, which dominates toDataURL cost
    u = renderIcon(name, opts, true).toDataURL('image/png');
    URL_CACHE.set(key, u);
  }
  return u;
}

/* ======================================================================
 * 5. Theme presets
 * ==================================================================== */
export const ICON_THEMES = {
  fire: { fill: ['#ffd862', '#ff5216'], bg: ['#8c2a0c', '#1d0602'], glow: '#ff7a2a', frame: '#b8582c' },
  frost: { fill: ['#effcff', '#4fb2ef'], bg: ['#1c5a8c', '#05132a'], glow: '#7fd6ff', frame: '#5f9ccb' },
  arcane: { fill: ['#f4d2ff', '#9a4cff'], bg: ['#4b1f88', '#0f0626'], glow: '#b36bff', frame: '#8a5ccb' },
  holy: { fill: ['#fff7cc', '#ffbf2e'], bg: ['#946515', '#271803'], glow: '#ffe07a', frame: '#d6ad4a' },
  nature: { fill: ['#d8ff8c', '#3dab28'], bg: ['#2e681b', '#091b05'], glow: '#9cff6a', frame: '#6b9a3b' },
  shadow: { fill: ['#cfb0ff', '#5a2a9c'], bg: ['#2b1642', '#07030e'], glow: '#7a3ad2', frame: '#5c4b7a' },
  poison: { fill: ['#e6ff7c', '#56bf1c'], bg: ['#3a5a10', '#0b1404'], glow: '#a6f03a', frame: '#7b9b2b' },
  physical: { fill: ['#f2f4f6', '#97a3af'], bg: ['#5c4a3a', '#16100a'], frame: '#8b7458' },
  blood: { fill: ['#ff8c8c', '#b0101f'], bg: ['#6b0d15', '#160204'], glow: '#ff3a4a', frame: '#9b2b2b' },
  lightning: { fill: ['#fffbd2', '#ffcf26'], bg: ['#28398c', '#060a24'], glow: '#9ad6ff', frame: '#6a7bd2' },
  gold: { fill: ['#fff2a8', '#e0a11c'], bg: ['#6b4a10', '#1a1004'], glow: '#ffd24a', frame: '#c99b3b' },
  ui: { fill: ['#f6ebd2', '#c9a45a'], bg: ['#2c3551', '#0c111e'], frame: '#7b6a4b' },
  rarity: { common: '#9d9d9d', uncommon: '#1eff00', rare: '#0070dd', epic: '#a335ee', legendary: '#ff8000', mythic: '#e6cc80' },
};

/* ======================================================================
 * 6. GLYPHS
 * ==================================================================== */

// Fallback rune for unknown names
def('__unknown', '#8a8fa0', [
  ['stone', O(32, 32, 27)],
  ['dark', O(32, 32, 21.5), { o: 0 }],
  ['light', 'M23 24C23 15 28 11 33 11C40 11 44 15.5 44 21.5C44 28.5 35.5 30 33 35.5L33 40', { l: 6.5 }],
  ['light', O(33, 50.5, 4.4)],
]);

/* ----------------------------------------------------------------------
 * 6a. Weapons & armour (blades authored upright, rotated via meta.rot)
 * -------------------------------------------------------------------- */
def('sword', '#6fa8dc', [
  ['metal', sym('M32 -8L37.6 1L37.6 47L32 48')],
  ['steel', P(32, -2, 33.2, 2, 33.2, 42, 32, 44, 30.8, 42, 30.8, 2), { o: 0, hi: 0, a: 0.7 }],
  ['gold', cap(19.5, 48.2, 44.5, 48.2, 2.9), { g: 1 }],
  ['leather', R(29.2, 51, 5.6, 14, 1.6)],
  ['dark', segs(29.4, 54, 34.6, 56.4, 29.4, 58, 34.6, 60.4, 29.4, 62, 34.6, 64.4), { l: 0.9, o: 0, a: 0.55 }],
  ['gold', O(32, 68, 4), { g: 1 }],
  ['base', P(32, 45, 35.2, 48.2, 32, 51.4, 28.8, 48.2), { g: 1 }],
], { rot: 45 });

def('greatsword', '#8fb4d8', [
  ['metal', sym('M32 -14L39.5 -4L39.5 42L32 43')],
  ['steel', P(32, -7, 33.6, -3, 33.6, 38, 32, 40, 30.4, 38, 30.4, -3), { o: 0, hi: 0, a: 0.7 }],
  ['gold', sym('M32 40.5L44 40.5C48 40.5 51 38 53.5 34C57 39 56 45.5 49 47.5L32 48.5'), { g: 1 }],
  ['leather', R(28.8, 48, 6.4, 19, 1.8)],
  ['dark', segs(29, 51, 35, 54, 29, 55, 35, 58, 29, 59, 35, 62, 29, 63, 35, 66), { l: 1, o: 0, a: 0.55 }],
  ['gold', P(32, 65.5, 37, 70.5, 32, 75.5, 27, 70.5), { g: 1 }],
  ['base', O(32, 44.5, 2.8), { g: 1 }],
], { rot: 45 });

def('axe', '#c0d0e0', [
  ['wood', cap(32, 6, 32, 70, 3)],
  ['metal', 'M29 10C24 10 17 6 12 1C4 9 2 24 8 35C14 30 22 26 29 26Z'],
  ['white', 'M12 1C4 9 2 24 8 35C7.6 25 9.4 13 14.6 3.6Z', { o: 0, hi: 0, a: 0.6 }],
  ['metal', 'M35 11L46 14.5C47.4 16.5 47.4 19.5 46 21.5L35 25Z'],
  ['steel', R(28.4, 7, 7.2, 21, 2)],
  ['gold', R(28, 26.5, 8, 3.6, 1.2)],
  ['leather', R(28.8, 50, 6.4, 16, 1.6)],
  ['gold', O(32, 70, 3.2)],
], { rot: 35 });

def('mace', '#c8d2dc', [
  ['wood', cap(32, 26, 32, 68, 2.8)],
  ['leather', R(28.8, 49, 6.4, 15, 1.6)],
  ['gold', O(32, 69, 3.6), { g: 1 }],
  ['steel', star(32, 17, 8, 19.5, 10.5)],
  ['metal', O(32, 17, 11.5), { g: 1 }],
  ['gold', R(27.2, 27.5, 9.6, 4.6, 1.6), { g: 1 }],
], { rot: 40 });

def('hammer', '#c8d2dc', [
  ['wood', cap(32, 14, 32, 70, 2.8)],
  ['leather', R(28.8, 52, 6.4, 14, 1.6)],
  ['gold', O(32, 70, 3.3)],
  ['metal', R(13, 5, 38, 20, 3)],
  ['steel', R(8.5, 7.5, 6, 15, 1.6)],
  ['steel', R(49.5, 7.5, 6, 15, 1.6)],
  ['gold', R(27.5, 3.4, 9, 23.2, 1.6), { g: 1 }],
  ['base', O(32, 15, 2.6), { g: 1 }],
], { rot: 35 });

def('dagger', '#9ab8d8', [
  ['metal', sym('M32 3C34.8 10 38.6 20 38.6 29.5L37 40L32 41')],
  ['steel', P(32, 9, 33.1, 14, 33.1, 37, 32, 38.6, 30.9, 37, 30.9, 14), { o: 0, hi: 0, a: 0.7 }],
  ['gold', sym('M32 39L42 39C45 39 46.4 37 47.2 34.6C49.6 38 48.4 42.4 44 43.4L32 44'), { g: 1 }],
  ['leather', R(29.2, 44, 5.6, 12, 1.6)],
  ['gold', P(32, 54.6, 35.8, 59, 32, 63.4, 28.2, 59), { g: 1 }],
  ['red', O(32, 59, 1.5), { o: 0, hi: 0 }],
], { rot: 45, fit: 50 });

def('staff', '#8a5cff', [
  ['base', O(32, 12, 19), { fx: 1, a: 0.7 }],
  ['wood', 'M29.2 24L34.8 24L35.6 68C35.6 70.6 28.4 70.6 28.4 68Z'],
  ['gold', R(28.4, 42, 7.2, 3, 1)],
  ['leather', R(28.6, 46, 6.8, 12, 1.6)],
  ['base', O(32, 12, 10.6), { g: 1 }],
  ['light', band(spiralP(32, 12, 1, 8, -90, 300, 24), (t) => 3 * Math.sin(Math.PI * t)), { o: 0, hi: 0, a: 0.6 }],
  ['wood', mir('M30.6 28C19 26 14.6 15 18.6 4.6L23 -1.4C21.6 7 21.6 14.6 25.6 20.8C27 23 29.4 24.4 32 24.6Z')],
  ['gold', R(27.2, 22.6, 9.6, 5.4, 1.8), { g: 1 }],
  ['white', spark(37.6, 7, 4.4), { o: 0, hi: 0 }],
], { rot: 30 });

def('wand', '#ff8fe0', [
  ['base', O(32, 12, 15), { fx: 1, a: 0.7 }],
  ['wood', 'M30.4 24L33.6 24L35 67C35 70 29 70 29 67Z'],
  ['gold', R(28.4, 21, 7.2, 4.2, 1.6), { g: 1 }],
  ['gold', R(28.8, 50, 6.4, 3, 1)],
  ['base', star(32, 12, 5, 12.5, 5.4), { g: 1 }],
  ['white', spark(32, 12, 4.4), { o: 0, hi: 0 }],
  ['white', spark(46, 4, 4.4), { o: 0, hi: 0 }],
], { rot: 40 });

def('bow', '#c8a060', [
  ['white', line(33.6, 1.8, 33.6, 62.2), { l: 1.1 }],
  ['wood', band([[34.2, 0.4], ...arcP(52, 32, 36, 231, 129, 22), [34.2, 63.6]], (t) => 2.2 + 3.6 * Math.sin(Math.PI * t))],
  ['leather', R(12.2, 26, 8.4, 12, 2.6)],
  ['gold', R(12.2, 24.8, 8.4, 2.2, 1) + R(12.2, 37, 8.4, 2.2, 1), { o: 0 }],
], { rot: 40 });

def('crossbow', '#c8a060', [
  ['white', line(7.5, 26, 32, 38.5, 56.5, 26), { l: 1.1 }],
  ['wood', 'M28.4 19L35.6 19L36.6 57C36.6 61.6 34.6 63.6 32 63.6C29.4 63.6 27.4 61.6 27.4 57Z'],
  ['metal', band(arcP(32, 58, 42, 232, 308, 18), (t) => 2.6 + 3 * Math.sin(Math.PI * t))],
  ['steel', R(26.6, 17.5, 10.8, 8, 2)],
  ['wood', cap(32, 9, 32, 38, 1.3)],
  ['metal', sym('M32 0.5L36 10.5L32 8.6')],
  ['base', sym('M32 31L35.4 35L35.4 40.5L32 38')],
  ['dark', R(33.6, 44, 4, 8, 1.6)],
]);

const SHIELD = sym('M32 4C38 7 46 9 54 8C56 30 50 48 32 61');
def('shield', '#2f6fd0', [
  ['metal', SHIELD],
  ['base', tf(SHIELD, Msc(0.8, 0.8, 32, 30))],
  ['gold', star(32, 29.5, 4, 13.5, 4.4), { g: 1 }],
  ['gold', O(32, 29.5, 4.2), { g: 1 }],
  ['gold', O(16, 13, 1.8) + O(48, 13, 1.8) + O(32, 55, 1.8), { o: 0 }],
]);

def('orb', '#7a5cff', [
  ['base', O(32, 26, 28), { fx: 1, a: 0.6 }],
  ['gold', 'M17 50C20 46.4 26 45 32 45C38 45 44 46.4 47 50L51 60L13 60Z'],
  ['dark', E(32, 50, 12.5, 2.6), { o: 0, hi: 0 }],
  ['base', O(32, 27, 20), { g: 1 }],
  ['light', band(spiralP(32, 27, 2, 15, -100, 330, 36), (t) => 4.6 * Math.sin(Math.PI * t)), { o: 0, hi: 0, a: 0.6 }],
  ['white', spark(39, 18, 5.5), { o: 0, hi: 0 }],
]);

def('tome', '#8a2a2a', [
  ['paper', R(14, 7.5, 40.5, 54.5, 2.4)],
  ['dark', segs(51.5, 12, 51.5, 58, 48.6, 59.5, 18, 59.5), { l: 0.8, o: 0, a: 0.4 }],
  ['base', R(9, 4, 41, 54, 3)],
  ['dark', R(9, 4, 7.5, 54, 2.6)],
  ['gold', P(50, 4, 50, 13.5, 40.5, 4) + P(50, 58, 50, 48.5, 40.5, 58), { g: 1 }],
  ['gold', ring(33, 30.5, 10.5, 7.6), { eo: 1, g: 1 }],
  ['gold', star(33, 30.5, 4, 7.4, 2.4), { g: 1 }],
  ['gold', R(16, 9, 2, 44, 1), { o: 0, a: 0.8 }],
]);

const HELM = sym('M32 4C44 4 52.6 12 53.4 24L54.4 40C54.6 48 50.6 54 44 57.4L36.4 61.4L32 61.4');
def('helmet', '#c0392b', [
  ['base', 'M34 8C32 -1 39 -6.6 48.6 -6.6C57 -6 62 0.6 61.4 9C57.4 5.4 51.6 4.6 47.6 6.4C43.4 7.8 39.6 10 37 13.4Z'],
  ['metal', HELM],
  ['steel', mir('M11.4 27L20 27L22.6 48C24.6 53 28 57.6 32 61.4L27.6 59.6C19 55 13 49 11.8 40Z'), { o: 0, hi: 0, a: 0.5 }],
  ['gold', sym('M32 19.6L53.3 20.6L53.6 25L32 24.4'), { g: 1 }],
  ['ink', mir(P(13.6, 28, 29.4, 28, 29.4, 32.6, 14.4, 32.6)), { o: 0, hi: 0 }],
  ['ink', O(21, 40, 1.4) + O(21, 45.4, 1.4) + O(25.4, 42.8, 1.4) + O(43, 40, 1.4) + O(43, 45.4, 1.4) + O(38.6, 42.8, 1.4), { o: 0, hi: 0 }],
  ['gold', R(29.6, 19.6, 4.8, 28, 1.8), { g: 1 }],
  ['gold', R(30.2, 3.6, 3.6, 16.6, 1.6), { g: 1 }],
]);

def('shoulders', '#b8892f', [
  ['gold', mir(P(45.6, 12, 52.6, -3, 55, 12.6))],
  ['steel', 'M24 18L40 18L41.6 32C36 35.6 28 35.6 22.4 32Z'],
  ['dark', E(32, 19.6, 7.4, 2.6), { o: 0, hi: 0, a: 0.8 }],
  ['metal', mir('M35 26C36 15 43 9 51 9C58 9 62.6 15 62.6 23L62.6 35C56 31 47 31 37 35Z')],
  ['steel', mir('M51 9.6C58 10.6 62.6 16 62.6 23L62.6 35C60 33.6 57 32.6 54 32.4C56 24 55 15.6 51 9.6Z'), { o: 0, hi: 0, a: 0.5 }],
  ['base', mir('M37 35C47 31 56 31 62.6 35L62 39.6C55 36.6 47 36.6 38 40Z')],
  ['steel', mir('M38.6 42C47 38.6 55 38.6 61.6 42L60.4 47.4C54 44.6 47 44.6 40.4 47.6Z')],
  ['steel', mir('M41 49.6C47 47 54 47 59.6 49.6L58 54.6C53 52.6 47.6 52.6 42.6 55Z')],
  ['gold', mir(O(44, 21, 1.8) + O(54.6, 19, 1.8)), { o: 0 }],
]);

def('chest', '#2f6fd0', [
  ['metal', sym('M32 17C36 17 40 14 41 8L51 5L59 12C56 16 53 19 51 23L50 42C50 52 44 58 32 61')],
  ['steel', mir('M51.6 21.6L50.4 42C50.4 50 46.6 55 41.6 58C44.6 50 45.6 40 45.6 29Z'), { o: 0, hi: 0, a: 0.7 }],
  ['steel', mir('M51 5.4L59 12C56 16 53.6 18.6 51.4 22.4C49.6 16 47 11 43.6 7.6Z')],
  ['gold', sym('M32 15.6C36 15.6 39 12.6 40 7.6L42.6 7.2C41.6 15 37 19.8 32 19.8'), { g: 1 }],
  ['base', sym('M32 25L40.6 27.4C40.6 35 38 41 32 46'), { g: 1 }],
  ['gold', segs(32, 46, 32, 58), { l: 1.4, o: 0, a: 0.7 }],
]);

def('gloves', '#8a5a34', [
  ['base', R(17, 25, 26, 27, 6)],
  ['base', cap(12.6, 28.6, 21, 41, 3.7)],
  ['base', cap(21.6, 13, 21.6, 33, 3)],
  ['base', cap(27.6, 8.4, 27.6, 31, 3.1)],
  ['base', cap(33.6, 9.4, 33.6, 31, 3.1)],
  ['base', cap(39.4, 14.4, 39.4, 33, 2.9)],
  ['metal', R(17, 27, 26, 7, 2.6)],
  ['metal', 'M15 47L45 47L48.4 62L11.6 62Z'],
  ['gold', R(13.6, 46, 32.8, 3.6, 1.2), { g: 1 }],
]);

def('boots', '#7a4a2a', [
  ['base', 'M17 6L37 6L37 37C37 41 41 43 47 45C55 47 59 51 59 56L59 58L13 58L13 50C15 44 17 37 17 30Z'],
  ['metal', 'M44.6 44.4C52 45.6 59 50 59 56L59 58L50.4 58C50.4 52 48.4 48.4 43 46.4Z'],
  ['deep', R(11.6, 55.4, 49, 6.6, 2.2)],
  ['dark', R(14, 2.6, 26, 10, 2.6)],
  ['leather', R(15, 26, 24, 4, 1.2)],
  ['gold', R(23.6, 24.2, 6.4, 7.6, 1.4) + R(25.2, 25.8, 3.2, 4.4, 0.6), { eo: 1, g: 1 }],
]);

def('pants', '#4a6aa8', [
  ['base', sym('M32 6L49 6L51 13C53 30 55 46 56 61L40 61L34 24L32 22')],
  ['dark', segs(23, 30, 21.5, 58, 41, 30, 42.5, 58), { l: 1, o: 0, a: 0.4 }],
  ['dark', R(10, 54.6, 18.4, 6.4, 1.4) + R(35.6, 54.6, 18.4, 6.4, 1.4), { o: 0, a: 0.5 }],
  ['leather', R(12.6, 4, 38.8, 7.4, 2)],
  ['gold', R(28.4, 2.6, 7.2, 10.2, 1.6) + R(30.2, 4.6, 3.6, 6.2, 0.6), { eo: 1, g: 1 }],
]);

def('belt', '#7a4a2a', [
  ['base', 'M3 25C20 31 44 31 61 25L61 38C44 44 20 44 3 38Z'],
  ['light', 'M4 28.4C20 34.2 44 34.2 60 28.4M4 34.8C20 40.6 44 40.6 60 34.8', { l: 0.8, o: 0, dash: [1.8, 1.8], a: 0.7 }],
  ['ink', O(49, 33.6, 1.4) + O(55.5, 32.5, 1.4), { o: 0, hi: 0 }],
  ['gold', R(21, 21, 22, 24.6, 4.4) + R(25.6, 25.6, 12.8, 15.4, 2), { eo: 1 }],
  ['metal', cap(24, 33.4, 40, 33.4, 1.3)],
]);

def('cape', '#a02a3a', [
  ['dark', sym('M32 16L47 16C50 29 54 44 58.6 58C50 61 41 59.6 32 61')],
  ['base', sym('M32 11C37 11 42 10 46 7.6L51.6 10C53.4 13 54 17 54 21C56 34 58.6 46 61.4 58C55.6 60.6 50.6 58 45.6 60.6C40.6 58 36.6 60.6 32 58.6')],
  ['dark', 'M21 26C20 38 17 49 13 58M42 32C43.4 42 46 50 50 58M31 36L31 57', { l: 1.4, o: 0, a: 0.45 }],
  ['base', sym('M32 8C39 8 45 11 46 16C46.4 25 40.4 31.6 32 33.6')],
  ['dark', sym('M32 12C36.6 12 41 14 42 17.4C42 23 38 27.6 32 29'), { o: 0, hi: 0, a: 0.55 }],
  ['light', sym('M32 3C37 3 42 2.4 46 0.6C48 3.4 48.6 6.6 48 10C43 12.6 37.6 13.6 32 13.6')],
  ['gold', O(32, 12.4, 4.4), { g: 1 }],
  ['red', O(32, 12.4, 2), { o: 0 }],
]);

def('ring', '#40c0ff', [
  ['gold', E(32, 41, 19, 17) + E(32, 42, 13, 11), { eo: 1 }],
  ['gold', 'M22.6 24L41.4 24L37 31.4L27 31.4Z'],
  ['base', P(23, 13.6, 41, 13.6, 45.4, 20, 32, 30.4, 18.6, 20), { g: 1 }],
  ['white', P(25, 14.8, 39, 14.8, 41.4, 19, 22.6, 19), { o: 0, hi: 0, a: 0.45 }],
  ['white', spark(42, 12, 4), { o: 0, hi: 0 }],
]);

{
  let beads = '';
  for (let i = 0; i <= 16; i++) {
    const th = 180 - (i * 180) / 16;
    if (Math.abs(th - 90) < 14) continue;
    const p = apt(32, 4, 23, th, 30);
    beads += O(p[0], p[1], 2.5);
  }
  def('necklace', '#e03a6a', [
    ['gold', beads],
    ['gold', ring(32, 35.6, 3.6, 1.6), { eo: 1 }],
    ['gold', drop(32, 36, 26)],
    ['base', drop(32, 41.4, 17.6), { g: 1 }],
    ['white', spark(27.6, 51, 3.4), { o: 0, hi: 0 }],
  ]);
}

def('trinket', '#3fd6a0', [
  ['gold', ring(32, 7, 5, 2.6), { eo: 1 }],
  ['gold', P(32, 10.6, 52.4, 33, 32, 60.4, 11.6, 33)],
  ['dark', P(32, 16, 47, 33, 32, 54, 17, 33), { o: 0 }],
  ['base', P(32, 19, 44.4, 33, 32, 50.6, 19.6, 33), { g: 1 }],
  ['light', P(32, 19, 44.4, 33, 32, 33, 19.6, 33), { o: 0, hi: 0, a: 0.45 }],
  ['gold', O(32, 33, 3.6), { g: 1 }],
  ['gold', O(52.4, 33, 2.4) + O(11.6, 33, 2.4) + O(32, 60.4, 2.4)],
]);

/* ----------------------------------------------------------------------
 * 6b. Consumables & materials
 * -------------------------------------------------------------------- */
function flask() {
  const glass = 'M27 8L37 8L37 20.64' + arcSeg(32, 40, 20, -75.52, 255.52) + 'L27 8Z';
  const liquid = 'M16.51 33C24 35.6 40 30.4 47.49 33' + arcSeg(32, 40, 17, -24.31, 204.31) + 'Z';
  return [
    ['glass', glass],
    ['base', liquid, { o: 0 }],
    ['light', E(32, 33.2, 15, 2.3), { o: 0, hi: 0, a: 0.7 }],
    ['white', O(25, 47, 2.1) + O(35.5, 52, 1.5) + O(39.5, 43, 1.2), { o: 0, hi: 0, a: 0.55 }],
    ['white', band(arcP(32, 40, 15.4, 148, 232, 10), (t) => 3.2 * Math.sin(Math.PI * t)), { o: 0, hi: 0, a: 0.85 }],
    ['wood', R(27.6, 0.4, 8.8, 7.6, 2)],
    ['glass', R(24.6, 5.8, 14.8, 4.4, 2), { a: 0.9 }],
  ];
}
def('potion_red', '#e8322b', flask());
def('potion_blue', '#2f6fe8', flask());
def('potion_green', '#3fcf3a', flask());
def('potion_purple', '#9b44e6', flask());

def('elixir', ['#fff07a', '#ff9a1e'], [
  ['base', O(32, 44, 22), { fx: 1, a: 0.45 }],
  ['glass', sym('M32 12L35.4 12L35.4 20L46.4 38C49.4 44 48.6 52 44.4 56C41.4 59 37 60.4 32 60.4')],
  ['base', sym('M32 33.6C35.6 34.6 38.4 32.4 40.5 33L43.6 38C46.6 44 46 51 42.6 54C40.4 56.2 36.6 57.8 32 57.8'), { o: 0 }],
  ['light', E(32, 33.4, 8.4, 1.5), { o: 0, hi: 0, a: 0.7 }],
  ['white', band([[24.4, 53], [21.2, 47], [21.6, 40.6]], (t) => 2.8 * Math.sin(Math.PI * t)), { o: 0, hi: 0, a: 0.85 }],
  ['white', O(35, 48, 1.6) + O(30, 52, 1.2), { o: 0, hi: 0, a: 0.6 }],
  ['gold', R(27.4, 9.6, 9.2, 4.2, 1.4), { g: 1 }],
  ['gold', P(32, -1, 37.8, 5.2, 32, 11.4, 26.2, 5.2), { g: 1 }],
  ['red', P(32, 2.2, 34.8, 5.2, 32, 8.2, 29.2, 5.2), { g: 1 }],
]);

def('food', '#b9532c', [
  ['bone', cap(13, 51.4, 27.4, 37.4, 3.6)],
  ['bone', O(9.4, 50.6, 4.7) + O(13.6, 56.4, 4.7)],
  ['base', 'M26 37C21 29 23 14.4 33 8.4C43 2.4 57 7 59 19C61 31 51 40 40 41C35 41.4 30 40.6 26 37Z', { g: 1 }],
  ['light', 'M33.6 12.4C42 7.6 52 9.6 55.4 17C50 14 42 14.4 36 17.4Z', { o: 0, hi: 0, a: 0.6 }],
  ['dark', segs(35, 24, 44, 17, 39, 32, 51, 22, 47, 35, 54.6, 28.6), { l: 1.6, o: 0, a: 0.5 }],
]);

def('bread', '#d08a3c', [
  ['base', 'M5 38C5 23 17 15 32 15C47 15 59 23 59 38C59 46 53 50 45 50L19 50C11 50 5 46 5 38Z', { g: 1 }],
  ['dark', 'M6.4 42C8.4 47 12.4 50 19 50L45 50C51.6 50 55.6 47 57.6 42C54 45.6 50 46.6 45 46.6L19 46.6C14 46.6 10 45.6 6.4 42Z', { o: 0, hi: 0, a: 0.5 }],
  ['paper', leaf(13.4, 37, 22.4, 22, 5.4, 1)],
  ['paper', leaf(26, 37.6, 34.6, 20.6, 5.6, 1)],
  ['paper', leaf(38.6, 37, 46.6, 22, 5.4, 1)],
]);

def('fish', '#4f9ccf', [
  ['dark', 'M20 21C23 12 32 9 39 13.4L37.6 21C32 19 26 19.4 20 21Z'],
  ['dark', 'M26 42C27 49 32 52.4 37.4 51.4L36 43Z'],
  ['base', 'M6 33C12 21 26 16 38 20C42 22 45 24 47 26L58 16C56 25 56 33 58 44L47 36C44 40 40 43 36 45C24 49 11 44 6 33Z'],
  ['light', 'M10 36C18 42.6 30 44 40 40.4C32 46.4 18 46.6 10 36Z', { o: 0, hi: 0, a: 0.75 }],
  ['dark', 'M22.4 24C25.4 28 25.4 36 22.4 40.4', { l: 1.4, o: 0, a: 0.6 }],
  ['dark', 'M29 27C31 29 31 32 29 34M35 26C37 28 37 31 35 33M32 32C34 34 34 37 32 39M38 32C40 34 40 36 38.4 37.6', { l: 0.9, o: 0, a: 0.35 }],
  ['dark', segs(50.4, 27.6, 55.4, 22, 50.4, 33.6, 55.4, 38.6), { l: 1, o: 0, a: 0.5 }],
  ['white', O(14.6, 29.4, 3.4)],
  ['ink', O(15.2, 29.4, 1.8), { o: 0, hi: 0 }],
]);

def('ore', '#e8a040', [
  ['stone', P(7, 45, 13, 25, 27, 13, 44, 15, 57, 29, 55, 47, 41, 56, 19, 55)],
  ['white', P(13, 25, 27, 13, 44, 15, 35, 27, 19, 31), { o: 0, hi: 0, a: 0.22 }],
  ['ink', P(44, 15, 57, 29, 55, 47, 41, 56, 38, 38, 35, 27), { o: 0, hi: 0, a: 0.25 }],
  ['ink', line(19, 31, 35, 27, 44, 15) + line(35, 27, 38, 38, 41, 56) + line(38, 38, 55, 47), { l: 0.9, o: 0, a: 0.35 }],
  ['base', P(16.6, 36.4, 24, 31.6, 28.6, 37.6, 22, 43), { g: 1 }],
  ['base', P(32.6, 21.6, 39.6, 18.6, 41.4, 25, 35, 27.6), { g: 1 }],
  ['base', P(40, 39.4, 47.4, 35.6, 50, 43.4, 43, 47.6), { g: 1 }],
  ['base', P(26.6, 46.4, 31.6, 44, 33.2, 49.4, 28.4, 51), { g: 1 }],
]);

{
  const L = [];
  const ingot = (x, y) => {
    L.push(['base', P(x, y, x + 26, y, x + 23, y - 9, x + 3, y - 9), { g: 1 }]);
    L.push(['light', P(x + 3, y - 9, x + 23, y - 9, x + 20, y - 14, x + 6, y - 14)]);
    L.push(['dark', R(x + 8.6, y - 12.6, 8.8, 2.6, 0.8), { o: 0, hi: 0, a: 0.4 }]);
  };
  ingot(4, 58); ingot(34, 58); ingot(19, 44);
  L.push(['white', spark(52, 30, 4.6), { o: 0, hi: 0 }]);
  def('ingot', '#f2c14e', L);
}

def('gem', '#ff3d6e', [
  ['base', P(18, 12, 46, 12, 58, 26, 32, 56, 6, 26)],
  ['light', P(18, 12, 46, 12, 58, 26, 6, 26), { o: 0, hi: 0, a: 0.5 }],
  ['white', P(24, 12, 40, 12, 44, 26, 20, 26), { o: 0, hi: 0, a: 0.3 }],
  ['dark', P(32, 26, 58, 26, 32, 56), { o: 0, hi: 0, a: 0.45 }],
  ['dark', segs(6, 26, 58, 26, 20, 26, 32, 56, 44, 26, 32, 56, 18, 12, 20, 26, 46, 12, 44, 26), { l: 0.8, o: 0, a: 0.5 }],
  ['white', spark(21, 17, 5.4), { o: 0, hi: 0 }],
]);

def('crystal', '#a46bff', [
  ['base', P(32, 35, 58, 35, 58, 46, 6, 46, 6, 35), { fx: 1, a: 0.5 }],
  ['base', P(10.6, 35, 16.6, 24, 25, 30.6, 27, 55, 19, 58, 12, 52)],
  ['light', P(10.6, 35, 16.6, 24, 18.4, 56, 12, 52), { o: 0, hi: 0, a: 0.45 }],
  ['base', P(39, 30.6, 47.4, 22, 53.4, 30.4, 52, 52, 45, 58, 37, 55)],
  ['light', P(39, 30.6, 47.4, 22, 44.6, 57.6, 37, 55), { o: 0, hi: 0, a: 0.45 }],
  ['base', P(25, 15, 32, 3, 39, 15, 39, 52, 32, 59, 25, 52)],
  ['light', P(25, 15, 32, 3, 32, 59, 25, 52), { o: 0, hi: 0, a: 0.5 }],
  ['white', P(32, 3, 39, 15, 32, 13), { o: 0, hi: 0, a: 0.5 }],
  ['stone', 'M5 57C9 52 19 52.4 32 54.4C45 52.4 55 52 59 57C57 62 7 62 5 57Z'],
]);

def('herb', '#5cb83a', [
  ['dark', 'M30 62C28 48 31 30 34 6', { l: 2.4 }],
  ['base', leaf(30.4, 52, 12.6, 43, 10, 2)],
  ['base', leaf(30.2, 46, 48.6, 37, 10, -2)],
  ['base', leaf(31, 35, 14.6, 23, 9, 2)],
  ['base', leaf(32.2, 27, 48.4, 16, 9, -2)],
  ['base', leaf(33.6, 12.4, 29, 0, 8, 1)],
  ['light', segs(30.4, 52, 15, 43.8, 30.2, 46, 46, 37.8, 31, 35, 17, 24.6, 32.2, 27, 46, 17.4, 33.6, 12.4, 29.6, 2.4), { l: 0.9, o: 0, a: 0.6 }],
]);

{
  const petals = [];
  for (let k = 0; k < 5; k++) petals.push(['base', rot(E(32, 12.5, 7.4, 10.6), k * 72, 32, 23)]);
  def('flower', '#ff6fae', [
    ['green', 'M32 30C31 42 33.6 52 30.4 62', { l: 3 }],
    ['green', leaf(31.6, 50, 13, 41, 10, 2)],
    ['green', leaf(31.8, 46, 50, 38, 9, -2)],
    ...petals,
    ['light', O(32, 23, 9), { o: 0, hi: 0, a: 0.5 }],
    ['gold', O(32, 23, 6.2), { g: 1 }],
    ['orange', O(30, 21.4, 1) + O(34, 22, 1) + O(31.6, 25, 1), { o: 0, hi: 0 }],
  ]);
}

def('mushroom', '#e03a2e', [
  ['bone', sym('M32 27L38.4 27C39.4 40 41.4 52 44.4 58C40.4 61.4 36 62 32 62')],
  ['dark', E(32, 29.8, 17, 3.4), { o: 0, hi: 0, a: 0.85 }],
  ['base', sym('M32 5C46 5 58 15 58 27C58 31 55 32.4 50 31.4C44 30.2 38 29.6 32 29.6')],
  ['white', O(22, 15, 3.8) + O(40, 11.6, 3.2) + O(47.4, 22, 2.9) + O(30, 23.6, 2.6) + O(14.6, 24, 2.3) + O(31, 9.6, 1.8), { o: 0, a: 0.92 }],
  ['green', leaf(28, 62, 20, 52, 4) + leaf(36, 62, 46, 54, 4)],
]);

def('log', '#9a6234', [
  ['base', 'M35.6 21L38.6 10.6L44 10.6L42.4 21Z'],
  ['green', leaf(41.4, 11, 50, 4, 5)],
  ['base', 'M10 20L50 20C54.4 20 57 26 57 32C57 38 54.4 44 50 44L10 44Z'],
  ['dark', 'M18 25.4L44 25.4M24 31.4L52 31.4M16 38.4L46 38.4', { l: 1.2, o: 0, a: 0.45 }],
  ['light', E(10, 32, 7, 12)],
  ['dark', E(10, 32, 4.4, 7.8) + E(10, 32, 1.8, 3.2), { l: 0.8, o: 0, a: 0.55 }],
], { rot: -20 });

def('plank', '#b07840', [
  ['dark', R(6, 40, 52, 11.6, 1.6)],
  ['base', R(6, 26, 52, 11.6, 1.6)],
  ['light', R(6, 12, 52, 11.6, 1.6)],
  ['dark', 'M10 16C24 14.6 34 18.4 54 16.4M12 20C26 19 38 21 52 19.6M10 30C24 28.6 34 32.4 54 30.4M12 34C26 33 38 35 52 33.6M10 44C24 42.6 34 46.4 54 44.4M12 48C26 47 38 49 52 47.6', { l: 0.8, o: 0, a: 0.4 }],
  ['steel', O(10.4, 17.8, 1.4) + O(53.6, 17.8, 1.4) + O(10.4, 31.8, 1.4) + O(53.6, 31.8, 1.4) + O(10.4, 45.8, 1.4) + O(53.6, 45.8, 1.4), { o: 0 }],
], { rot: -14 });

{
  const HIDE = sym('M32 7C35 9 39 8 43 4.6C45 9 50 10.4 56 8C53.6 14 53.4 20 58 24C53.6 30 52 36 54.6 42C50.4 44.6 48.6 50 50.6 56C45 54 40.6 55.6 36.6 60.6C35 59 33.6 58.6 32 58.6');
  def('leather', '#a0623a', [
    ['base', HIDE],
    ['light', tf(HIDE, Msc(0.78, 0.78, 32, 33)), { l: 0.9, o: 0, dash: [2, 2], a: 0.8 }],
    ['dark', E(26, 26, 5, 3, 20) + E(39, 40, 4, 2.6, -15), { o: 0, hi: 0, a: 0.25 }],
  ]);
}

def('cloth', '#4a7fd0', [
  ['dark', R(9, 44, 46, 12.4, 5.6)],
  ['accent', R(6, 31, 48, 13.4, 6)],
  ['base', R(10, 18, 46, 13.4, 6)],
  ['dark', 'M15 21.4C13 24 13 27 15 29.6M11 34.4C9 37 9 40 11 42.6M14 47.4C12 50 12 52.6 14 54.6', { l: 1, o: 0, a: 0.45 }],
  ['light', 'M14 49.4L50 49.4M11 36.4L50 36.4M15 23.4L52 23.4', { l: 0.8, o: 0, dash: [1.6, 1.6], a: 0.7 }],
  ['gold', R(38.4, 15.4, 5, 43.2, 1.2), { g: 1 }],
  ['gold', P(43.4, 15.4, 50, 9.4, 51.4, 13.6, 45.4, 18.6), { g: 1 }],
]);

def('bone', '#eadcbc', [
  ['base', R(13, 28.4, 38, 7.2, 2) + O(12, 26, 6.4) + O(12, 38, 6.4) + O(52, 26, 6.4) + O(52, 38, 6.4)],
  ['dark', segs(22, 30.4, 42, 30.4), { l: 1, o: 0, a: 0.25 }],
], { rot: -40 });

def('fang', '#f0e6cc', [
  ['red', 'M13 4C24 1 40 1 51 4L49 15C38 12 26 12 15 15Z'],
  ['base', 'M15.6 11.6C26 8.6 40 8.6 48.6 11.6C49.6 22 44.6 34 36.6 44C30.6 51 24.6 56 17.6 60.6C20.6 50.6 21.6 40 19.6 30C18.6 22 16.6 16 15.6 11.6Z'],
  ['dark', 'M33 15C34 25 31 37 25 48', { l: 1.1, o: 0, a: 0.3 }],
]);

{
  let notches = '';
  for (const [t, sg] of [[0.32, 1], [0.48, -1], [0.62, 1], [0.74, -1]]) {
    const sx = 12 + 40 * t, sy = 56 - 50 * t;
    notches += segs(sx + 0.78 * sg * 8.6, sy + 0.625 * sg * 8.6, sx - 2.6 + 0.78 * sg * 1.6, sy + 3.2 + 0.625 * sg * 1.6);
  }
  def('feather', '#7ec0ff', [
    ['base', leaf(12, 56, 53, 5, 21, 2)],
    ['light', leaf(14, 54, 50, 9, 8, 0), { o: 0, hi: 0, a: 0.35 }],
    ['deep', notches, { l: 1.2, o: 0, a: 0.75 }],
    ['white', 'M7 61C20 45 36 25 52.4 5.6', { l: 1.7 }],
  ]);
}

def('essence', ['#cfa6ff', '#6a2ee0'], [
  ['base', O(32, 32, 31), { fx: 1, a: 0.7 }],
  ['base', O(32, 32, 19.5), { g: 1 }],
  ['light', band(spiralP(32, 32, 1, 17, 0, 520, 44), (t) => 5.5 * Math.sin(Math.PI * Math.pow(t, 0.7))), { o: 0, hi: 0, a: 0.95 }],
  ['white', O(32, 32, 3), { o: 0, hi: 0 }],
  ['white', spark(51, 12, 5.6) + spark(13, 51, 4.2), { o: 0, hi: 0 }],
]);

def('dust', '#c58cff', [
  ['base', O(32, 42, 26), { fx: 1, a: 0.5 }],
  ['dark', 'M3 56C9 52 14 47 19 43C24 39 27 33.6 32 32.6C37 33.6 40 39 45 43C50 47 55 52 61 56C51 60.6 13 60.6 3 56Z'],
  ['base', 'M10 54.6C15 51 19 47 23 44C27 41 29 37 32 36.4C35 37 37 41 41 44C45 47 49 51 54 54.6C46 57 18 57 10 54.6Z', { o: 0 }],
  ['white', O(20, 47.6, 1.2) + O(30, 44.6, 1) + O(40, 48, 1.3) + O(46, 51, 0.9) + O(26, 51, 0.9) + O(35, 50.6, 0.8), { o: 0, hi: 0 }],
  ['light', spark(32, 19, 9.5)],
  ['light', spark(47, 27, 5.6) + spark(17, 27, 5)],
  ['base', O(24, 34, 1.6) + O(40.6, 33, 1.3) + O(44, 14, 1.4) + O(20, 12, 1.1), { o: 0, hi: 0 }],
]);

def('scroll', '#c8342a', [
  ['paper', R(15, 11, 34, 42, 0)],
  ['dark', segs(21, 22, 43, 22, 21, 28, 43, 28, 21, 34, 39, 34), { l: 1.3, o: 0, a: 0.4 }],
  ['paper', cap(11, 11, 53, 11, 5.6)],
  ['paper', cap(11, 53, 53, 53, 5.6)],
  ['dark', E(11, 11, 2.4, 5.2) + E(11, 53, 2.4, 5.2), { o: 0, hi: 0, a: 0.4 }],
  ['wood', O(6.4, 11, 3.2) + O(57.6, 11, 3.2) + O(6.4, 53, 3.2) + O(57.6, 53, 3.2)],
  ['base', P(38.6, 46, 42.6, 46, 44, 58, 41, 55.6, 37.6, 58), { g: 1 }],
  ['base', O(40.6, 44, 5.4), { g: 1 }],
  ['dark', star(40.6, 44, 5, 3, 1.3), { o: 0, hi: 0, a: 0.6 }],
], { rot: -12 });

def('map', '#c8342a', [
  ['paper', P(6, 14, 22, 8, 38, 14, 58, 8, 58, 52, 38, 58, 22, 52, 6, 58)],
  ['ink', P(22, 8, 38, 14, 38, 58, 22, 52), { o: 0, hi: 0, a: 0.13 }],
  ['ink', segs(22, 8, 22, 52, 38, 14, 38, 58), { l: 0.9, o: 0, a: 0.35 }],
  ['blue', E(14, 24, 5, 4.4) + E(17, 28, 3, 2.4), { o: 0, hi: 0, a: 0.45 }],
  ['green', E(46, 40, 6, 4.4) + E(41, 44, 3.6, 2.6), { o: 0, hi: 0, a: 0.5 }],
  ['base', 'M11 48C17 41 23 45 28 38C33 31 38 38 43 30', { l: 1.7, o: 0, dash: [2.6, 2.4] }],
  ['base', segs(43.6, 19, 51, 26.4, 51, 19, 43.6, 26.4), { l: 2.8 }],
]);

def('key', '#f2c14e', [
  ['base', ring(32, 14, 11.4, 5.6), { eo: 1 }],
  ['base', R(29.2, 24.6, 5.6, 33.6, 1.6)],
  ['base', P(34.6, 43.6, 43.4, 43.6, 43.4, 48.4, 38.6, 48.4, 38.6, 51, 43.4, 51, 43.4, 56.6, 34.6, 56.6)],
  ['base', R(26.6, 23.4, 10.8, 4.2, 1.4), { g: 1 }],
], { rot: -45 });

def('chest_box', '#9a6234', [
  ['dark', R(7, 31, 50, 26, 2.4)],
  ['base', 'M7 31C7 18 16 11 32 11C48 11 57 18 57 31Z'],
  ['ink', R(7, 29.6, 50, 3.4, 1), { o: 0, hi: 0, a: 0.6 }],
  ['ink', segs(10, 44, 54, 44, 12, 22, 52, 22), { l: 0.9, o: 0, a: 0.3 }],
  ['gold', mir('M14.6 15.8C16 14.6 17.8 13.6 19.6 13L19.6 57L14.6 57Z'), { g: 1 }],
  ['gold', R(27.2, 25.6, 9.6, 11.4, 1.8), { g: 1 }],
  ['ink', O(32, 30, 1.7) + P(31.1, 30.8, 32.9, 30.8, 33.5, 34.6, 30.5, 34.6), { o: 0, hi: 0 }],
]);

def('bag', '#b07a3e', [
  ['base', sym('M32 21C40 21 44 20.4 46 21.4C54 27 58 39 56.4 49C55 57 47 60 32 60')],
  ['base', sym('M32 6.4C37 6.4 42 5 46 3C46.4 9 43 15 38.6 19.6L32 19.6')],
  ['dark', 'M27 8.4L28.4 18M37 8.4L35.6 18', { l: 1, o: 0, a: 0.45 }],
  ['dark', 'M20 30C22 40 22 48 24 56M44 30C42 40 42 48 40 56', { l: 1, o: 0, a: 0.3 }],
  ['gold', cap(21.6, 20.6, 42.4, 20.6, 2.7)],
  ['gold', 'M40.6 22.6C44.6 26.6 44.6 32.6 41.6 36.6', { l: 2 }],
  ['gold', O(32, 41, 7), { g: 1 }],
  ['dark', star(32, 41, 5, 4, 1.7), { o: 0, hi: 0, a: 0.5 }],
]);

def('coin', '#f2c14e', [
  ['base', O(32, 32, 26), { g: 1 }],
  ['ink', ring(32, 32, 21, 18.8), { eo: 1, o: 0, hi: 0, a: 0.28 }],
  ['light', star(32, 32.6, 5, 12.4, 5.2)],
  ['white', spark(18, 17, 5.4), { o: 0, hi: 0 }],
]);

{
  const L = [];
  const stack = (cx, by, n, rx = 14.6, ry = 4.4, h = 5.6) => {
    for (let i = 0; i < n; i++) {
      const y = by - i * h;
      L.push(['dark', `M${cx - rx} ${y - h}L${cx - rx} ${y}` + arcSeg(cx, y, rx, 180, 0, ry) + `L${cx + rx} ${y - h}` + arcSeg(cx, y - h, rx, 0, 180, ry) + 'Z']);
      L.push(['base', E(cx, y - h, rx, ry)]);
    }
    L.push(['light', E(cx, by - n * h, rx * 0.62, ry * 0.55), { o: 0, hi: 0, a: 0.6 }]);
  };
  stack(23, 54, 5);
  stack(42, 60, 3);
  L.push(['white', spark(50, 30, 5), { o: 0, hi: 0 }]);
  def('coins', '#f2c14e', L);
}

def('token', '#d23b3b', [
  ['base', P(15.6, 3, 27, 3, 37.4, 30, 26, 30)],
  ['dark', P(37, 3, 48.4, 3, 38, 30, 26.6, 30)],
  ['gold', O(32, 42, 17.4), { g: 1 }],
  ['ink', ring(32, 42, 13.6, 12), { eo: 1, o: 0, hi: 0, a: 0.3 }],
  ['base', star(32, 42.6, 5, 10.4, 4.3), { g: 1 }],
]);

/* ----------------------------------------------------------------------
 * 6c. Skill & magic symbols (part 1: elements, light, shadow)
 * -------------------------------------------------------------------- */
const FLAME_O = 'M32 2C35 12 47 18 50 32C52.5 46 44 58 32 60C20 58 11.5 48 14 36C15.5 29 20 25 22 18C24.5 23 26.5 25 28.5 27.5C26.5 18 28 9 32 2Z';
const FLAME_I = 'M32.5 24C36 31 42.5 36 42.5 44.5C42.5 52 37.5 56.5 32 56.5C26.5 56.5 21.5 52.5 21.5 46.5C21.5 41 25 38.5 27.5 34.5C29 38 30.5 40 32 41C30.5 35 30.5 29.5 32.5 24Z';
const FLAME_C = 'M32 40C35 44 37.5 47 37.5 50.5C37.5 54 35 56 32 56C29 56 26.5 54 26.5 50.5C26.5 47 29.5 44.5 32 40Z';
def('flame', ['#ffd04a', '#ff4a12'], [
  ['base', O(32, 38, 28), { fx: 1, a: 0.55 }],
  ['accent', FLAME_O],
  ['base', FLAME_I, { o: 0 }],
  ['white', FLAME_C, { o: 0, hi: 0, a: 0.85 }],
]);

def('fireball', ['#ffd04a', '#ff4a12'], [
  ['base', O(40, 24, 24), { fx: 1, a: 0.6 }],
  ['accent', O(40, 24, 15) + 'M29 13C19 21 11 33 5 58C13 50 19 47 25 46C21 51 19 55 18 61C27 52 37 46 48 37Z'],
  ['base', O(41, 23, 10) + 'M34 16C27 23 21 32 16.6 44.6C22.6 40 29.6 37 38.6 33Z', { o: 0 }],
  ['white', O(42.4, 21.6, 5.2), { o: 0, hi: 0, a: 0.9 }],
]);

def('meteor', ['#ffc23a', '#ff3d0e'], [
  ['base', O(24, 40, 22), { fx: 1, a: 0.5 }],
  ['accent', band([[22, 42], [32, 30], [44, 17], [60, 2]], (t) => 30 * Math.pow(1 - t, 1.1) + 1)],
  ['base', band([[24, 40], [33, 29], [43, 18], [54, 7]], (t) => 16 * Math.pow(1 - t, 1.2) + 0.6), { o: 0 }],
  ['stone', P(9, 38, 15, 28, 27, 25.6, 36, 33, 36.6, 45, 28.6, 54, 16, 54.6, 8.4, 47)],
  ['ink', P(27, 25.6, 36, 33, 36.6, 45, 28.6, 54, 25, 40), { o: 0, hi: 0, a: 0.25 }],
  ['orange', 'M14 36L21 40L19 47M26 33L29 41L34 43', { l: 1.4, o: 0 }],
]);

function flakeArms(cx, cy, R1, w) {
  let d = '';
  for (let k = 0; k < 6; k++) {
    const arm = cap(cx, cy, cx, cy - R1, w) +
      cap(cx, cy - R1 * 0.48, cx - R1 * 0.24, cy - R1 * 0.74, w * 0.85) + cap(cx, cy - R1 * 0.48, cx + R1 * 0.24, cy - R1 * 0.74, w * 0.85) +
      cap(cx, cy - R1 * 0.74, cx - R1 * 0.15, cy - R1 * 0.92, w * 0.75) + cap(cx, cy - R1 * 0.74, cx + R1 * 0.15, cy - R1 * 0.92, w * 0.75);
    d += rot(arm, k * 60, cx, cy);
  }
  return d;
}
def('snowflake', ['#f2fcff', '#62bff2'], [
  ['base', O(32, 32, 29), { fx: 1, a: 0.45 }],
  ['base', flakeArms(32, 32, 27, 2.6)],
  ['light', ngon(32, 32, 6, 7.6, 0)],
  ['white', O(32, 32, 2.6), { o: 0, hi: 0 }],
]);

def('ice_shard', ['#e8fbff', '#58b6f0'], [
  ['base', O(34, 30, 26), { fx: 1, a: 0.45 }],
  ['base', P(9, 47, 11, 29, 24, 39, 19, 57)],
  ['light', P(9, 47, 11, 29, 16, 45), { o: 0, hi: 0, a: 0.5 }],
  ['base', P(31, 57, 49, 35, 58, 41, 43, 59)],
  ['light', P(31, 57, 49, 35, 48, 47), { o: 0, hi: 0, a: 0.5 }],
  ['base', P(19, 53, 24, 29, 53, 5, 41, 37, 29, 58)],
  ['light', P(19, 53, 24, 29, 53, 5, 30, 40), { o: 0, hi: 0, a: 0.55 }],
  ['white', P(24, 29, 53, 5, 34, 26), { o: 0, hi: 0, a: 0.5 }],
  ['white', spark(50, 18, 4.6), { o: 0, hi: 0 }],
]);

def('frost_nova', ['#effbff', '#55b4f0'], [
  ['base', O(32, 32, 31), { fx: 1, a: 0.5 }],
  ['base', star(32, 32, 12, 30, 16.4)],
  ['light', O(32, 32, 16)],
  ['dark', ring(32, 32, 12.4, 11.2), { eo: 1, o: 0, hi: 0, a: 0.35 }],
  ['white', star(32, 32, 6, 10.6, 3.6)],
]);

const BOLT = 'M38 2L13 36L28.5 36L21 62L51 25L34.5 25L45 2Z';
def('lightning', ['#fffbd6', '#ffc81a'], [
  ['base', O(32, 32, 30), { fx: 1, a: 0.55 }],
  ['base', BOLT],
  ['white', tf(BOLT, Msc(0.52, 0.72, 32, 31)), { o: 0, hi: 0, a: 0.8 }],
]);

def('arcane_star', ['#f6d6ff', '#a04cff'], [
  ['base', O(32, 32, 30), { fx: 1, a: 0.55 }],
  ['base', rad(32, 32, 16, [29, 8, 18, 8])],
  ['light', rad(32, 32, 16, [16, 4.6, 9.6, 4.6]), { o: 0 }],
  ['white', O(32, 32, 3.6), { o: 0, hi: 0 }],
  ['white', spark(50, 12, 4) + spark(13, 51, 3.4), { o: 0, hi: 0 }],
]);

function missile(x, y, r, len, ang = -45) {
  const ux = Math.cos(ang * DEG), uy = Math.sin(ang * DEG);
  return O(x, y, r) + band([[x - ux * len, y - uy * len], [x - ux * len * 0.5, y - uy * len * 0.5], [x, y]], (t) => 2 * r * Math.pow(t, 0.9));
}
{
  const L = [['base', O(36, 28, 28), { fx: 1, a: 0.5 }]];
  for (const [x, y, r, len] of [[47, 16, 7.6, 30], [24, 31, 6.2, 24], [46, 42, 5.6, 21]]) {
    L.push(['base', missile(x, y, r, len)]);
    L.push(['light', O(x, y, r * 0.62), { o: 0 }]);
    L.push(['white', O(x + r * 0.12, y - r * 0.12, r * 0.32), { o: 0, hi: 0 }]);
  }
  def('arcane_missiles', ['#f2d0ff', '#9c4cff'], L);
}

function figure(cx, cy, s = 1) {
  return O(cx, cy - 21 * s, 5.6 * s) + P(cx - 7 * s, cy - 14 * s, cx + 7 * s, cy - 14 * s, cx + 9.6 * s, cy + 2 * s, cx + 5.6 * s, cy + 3 * s,
    cx + 5.6 * s, cy + 22 * s, cx + 0.8 * s, cy + 22 * s, cx, cy + 8 * s, cx - 0.8 * s, cy + 22 * s, cx - 5.6 * s, cy + 22 * s, cx - 5.6 * s, cy + 3 * s, cx - 9.6 * s, cy + 2 * s);
}
def('blink', ['#e8d4ff', '#8a4cff'], [
  ['base', O(44, 32, 24), { fx: 1, a: 0.55 }],
  ['base', figure(15, 34), { o: 0, hi: 0, a: 0.3 }],
  ['base', figure(27, 34), { o: 0, hi: 0, a: 0.55 }],
  ['light', segs(4, 26, 22, 26, 8, 36, 26, 36, 4, 46, 22, 46), { l: 1.8, o: 0, a: 0.8 }],
  ['base', figure(44, 34)],
  ['white', spark(56, 14, 5) + spark(33, 56, 3.6), { o: 0, hi: 0 }],
]);

def('holy_cross', ['#fff4c0', '#ffbe2a'], [
  ['base', O(32, 24, 30), { fx: 1, a: 0.55 }],
  ['gold', ring(32, 23.4, 15.6, 11.8), { eo: 1 }],
  ['base', sym('M32 3L35.5 3C36 8 36.5 12 37.6 17.6C43 18.6 47.5 19 52 19L52 27.6C47.5 27.6 43 28 37.6 29C36.6 40 36 50 35.6 61L32 61')],
  ['white', P(32, 6, 33.6, 6, 34.4, 18.6, 32, 20), { o: 0, hi: 0, a: 0.6 }],
]);

def('sun', ['#fff3b0', '#ffae1e'], [
  ['base', O(32, 32, 31), { fx: 1, a: 0.6 }],
  ['base', rad(32, 32, 32, [30, 15.6, 22, 15.6])],
  ['light', O(32, 32, 14.4)],
  ['white', O(28.6, 28.6, 5.6), { o: 0, hi: 0, a: 0.55 }],
]);

def('halo', ['#fff6c8', '#ffc62e'], [
  ['base', E(32, 17, 30, 15), { fx: 1, a: 0.6 }],
  ['dark', bust(32, 46, 1.05)[1]],
  ['dark', bust(32, 46, 1.05)[0]],
  ['base', E(32, 15, 22, 7.6) + E(32, 15, 16.2, 4.4), { eo: 1, g: 1 }],
  ['white', spark(10, 6, 4.2) + spark(54, 25, 3.4), { o: 0, hi: 0 }],
]);

function hand(tone, dy = 0) {
  return [
    [tone, R(17, 28 + dy, 26, 24, 7)],
    [tone, cap(12.4, 30 + dy, 21, 44 + dy, 3.6)],
    [tone, cap(21.6, 15 + dy, 21.6, 34 + dy, 3)],
    [tone, cap(27.6, 10 + dy, 27.6, 32 + dy, 3.1)],
    [tone, cap(33.6, 11 + dy, 33.6, 32 + dy, 3.1)],
    [tone, cap(39.4, 16 + dy, 39.4, 34 + dy, 2.9)],
  ];
}
def('heal_hand', ['#c8ffb0', '#36c84a'], [
  ['base', O(30, 30, 30), { fx: 1, a: 0.55 }],
  ['light', R(21, 47, 18, 15, 3)],
  ...hand('light'),
  ['base', R(26.6, 31, 6.8, 18, 1.6) + R(21, 36.6, 18, 6.8, 1.6), { g: 1 }],
  ['white', spark(51, 10, 5.4) + spark(51, 30, 3.4) + spark(8, 16, 3.6), { o: 0, hi: 0 }],
]);

def('heart', ['#ff7a8a', '#d4142c'], [
  ['base', sym('M32 17C35 9 42 5 49 6C57 7.5 61 15 59 24C56 38 43 48 32 58'), { g: 1 }],
  ['white', E(19.6, 17.6, 5, 3.2, -35), { o: 0, hi: 0, a: 0.75 }],
]);

{
  let veins = '';
  for (const t of [0.28, 0.46, 0.64]) {
    const mx = 10 + 44 * t, my = 56 - 46 * t, ex = 10 + 44 * (t + 0.13), ey = 56 - 46 * (t + 0.13);
    veins += segs(mx, my, ex + 0.72 * 9.6, ey + 0.69 * 9.6) + segs(mx, my, ex - 0.72 * 9.6, ey - 0.69 * 9.6);
  }
  def('renew', ['#ccff8a', '#3aaa28'], [
    ['base', O(32, 32, 30), { fx: 1, a: 0.5 }],
    ['dark', 'M11 55L4 62', { l: 2.6 }],
    ['base', leaf(10, 56, 54, 10, 30, 3)],
    ['light', 'M10 56C22 44 36 28 54 10', { l: 1.6, o: 0, a: 0.8 }],
    ['light', veins, { l: 1, o: 0, a: 0.6 }],
    ['white', spark(50, 46, 7.6)],
    ['white', spark(15, 17, 5.4)],
    ['white', spark(57, 31, 3.4), { o: 0, hi: 0 }],
  ]);
}

def('shield_glow', ['#e6f8ff', '#46aaff'], [
  ['base', O(32, 32, 31), { fx: 1, a: 0.6 }],
  ['base', SHIELD],
  ['light', tf(SHIELD, Msc(0.74, 0.74, 32, 30)), { o: 0 }],
  ['white', star(32, 29.5, 4, 12.4, 3.6), { o: 0, hi: 0 }],
  ['white', spark(52, 8, 4.4) + spark(11, 48, 3.4), { o: 0, hi: 0 }],
]);

{
  const L = [['base', O(32, 32, 31), { fx: 1, a: 0.5 }]];
  const r = 10.4, d = r * Math.sqrt(3);
  const cs = [[32, 32]];
  for (let k = 0; k < 6; k++) cs.push(apt(32, 32, d, -90 + k * 60));
  cs.forEach(([x, y], i) => L.push([i ? 'base' : 'light', ngon(x, y, 6, r - 1, 0)]));
  cs.forEach(([x, y]) => L.push(['white', ngon(x, y, 6, r - 4.2, 0), { o: 0, hi: 0, a: 0.18 }]));
  def('barrier', ['#d8f4ff', '#3a9cf0'], L);
}

const SKULL_L = [
  ['base', sym('M32 6C46 6 55 15 55 28C55 36 51 40 47 42L47 50C47 53 45 55 42 55L32 55')],
  ['ink', E(22.6, 29, 6.4, 7.2) + E(41.4, 29, 6.4, 7.2), { o: 0, hi: 0 }],
  ['ink', P(32, 35, 35.6, 42.4, 28.4, 42.4), { o: 0, hi: 0 }],
  ['ink', segs(26.6, 47, 26.6, 55, 32, 47, 32, 55, 37.4, 47, 37.4, 55), { l: 1.6, o: 0, cap: 'butt' }],
];
def('skull', '#ece0c4', SKULL_L);

def('death_coil', ['#dcff9a', '#46c82a'], [
  ['base', O(32, 32, 31), { fx: 1, a: 0.5 }],
  ['base', band(spiralP(32, 32, 14, 29, 200, 560, 44), (t) => 1 + 8.6 * Math.sin(Math.PI * Math.pow(t, 0.8)))],
  ['light', band(spiralP(32, 32, 14, 29, 200, 560, 44), (t) => 2.6 * Math.sin(Math.PI * Math.pow(t, 0.8))), { o: 0, hi: 0, a: 0.7 }],
  ...retone(xf(SKULL_L, Msc(0.46, 0.46, 32, 31)), { base: 'light' }),
]);

def('poison_drop', ['#e0ff7a', '#40b41a'], [
  ['base', drop(28, 4, 56)],
  ['deep', O(28, 40, 6.2) + R(24.4, 43, 7.2, 5.4, 1.6), { o: 0, hi: 0, a: 0.5 }],
  ['light', O(25.6, 40, 1.7) + O(30.4, 40, 1.7), { o: 0, hi: 0 }],
  ['white', E(19.6, 36, 2.6, 6.4, 15), { o: 0, hi: 0, a: 0.6 }],
  ['light', O(47, 14, 5.2)],
  ['light', O(52, 28, 3.4)],
  ['light', O(43.6, 3.6, 2.6)],
]);

def('dagger_throw', '#9ab8d8', [
  ['light', segs(4, 47, 18, 33, 10, 57, 24, 43, 19, 61, 30, 50), { l: 2.4, o: 0, a: 0.75 }],
  ...xf(lay('dagger'), Msc(0.8, 0.8, 32, 32), Mrot(45), Mmv(8, -8)),
]);

def('smoke', '#a6abb6', [
  ['dark', O(20, 47, 11) + O(40, 48, 12) + O(52, 42, 8)],
  ['base', O(14, 44, 9) + O(28, 40, 12.6) + O(43, 38, 11) + O(31, 51, 9.4) + O(50, 49, 7.6)],
  ['base', O(30, 23, 8.4) + O(38, 18, 7) + O(24, 18, 5.6)],
  ['light', O(36, 7, 4.6) + O(27.6, 6, 3)],
  ['white', 'M18 40C22 34 30 34 34 38M27 20C30 16 35 16 37 19', { l: 1.3, o: 0, a: 0.5 }],
]);

def('eye', ['#ffd76a', '#ff8a1a'], [
  ['base', O(32, 32, 30), { fx: 1, a: 0.45 }],
  ['white', sym('M32 15C45 15 55 23 61 32C55 41 45 49 32 49')],
  ['base', O(32, 32, 11.6), { g: 1 }],
  ['ink', E(32, 32, 3.2, 8.6), { o: 0, hi: 0 }],
  ['white', O(36, 28, 2.2), { o: 0, hi: 0 }],
  ['deep', sym('M32 11.6C46 11.6 56 21 62 32C56 25 46 18.4 32 18.4')],
]);

def('stealth', '#4a3a6a', [
  ['base', sym('M32 4C45 4 53 16 53 29C53 40 56 51 61 61L32 61')],
  ['ink', sym('M32 16C40 16 44.6 23 44.6 31C44.6 39 40 46 32 50'), { o: 0, hi: 0 }],
  ['dark', 'M20 44C21.4 52 19.6 57 16.4 61M44 44C42.6 52 44.4 57 47.6 61', { l: 1.3, o: 0, a: 0.5 }],
  ['dark', sym('M32 38.6C37 38.6 41 37.6 43.4 36.4C43 42.4 38.6 47.6 32 50'), { o: 0 }],
  ['yellow', O(26, 33.4, 6) + O(38, 33.4, 6), { fx: 1, a: 0.6 }],
  ['yellow', mir(P(22.4, 30.8, 29.4, 32.8, 28.6, 35, 23, 33.2)), { o: 0, hi: 0 }],
]);

/* ----------------------------------------------------------------------
 * 6d. Skill & magic symbols (part 2: hunter, warrior, nature, misc)
 * -------------------------------------------------------------------- */
const ARROW_L = [
  ['wood', cap(32, 12, 32, 63, 1.8)],
  ['base', sym('M32 45L38.6 50.4L39 63.6L32 59')],
  ['dark', segs(32, 47, 32, 60), { l: 0.8, o: 0, a: 0.5 }],
  ['metal', sym('M32 -0.5L39.4 15L32 12.4')],
];
def('arrow', '#d8443a', ARROW_L, { rot: 45 });

{
  const L = [];
  for (const a of [-24, 0, 24]) L.push(...xf(ARROW_L, Mrot(a, 32, 96)));
  def('multi_arrows', '#d8443a', L, { rot: 45 });
}

{
  const L = [];
  for (const [x, y] of [[15, 27], [32, 19], [49, 29]]) {
    L.push(['light', segs(x + 4.2, y - 36, x + 1.2, y - 26, x + 9.2, y - 30, x + 6.8, y - 22), { l: 1.6, o: 0, a: 0.7 }]);
    L.push(...xf(ARROW_L, Msc(0.56, 0.56, 32, 32), Mrot(196), Mmv(x - 32, y - 32)));
  }
  L.push(['stone', E(10, 50, 5, 1.6) + E(27, 42, 5, 1.6) + E(44, 52, 5, 1.6), { o: 0, hi: 0, a: 0.5 }]);
  def('rain_arrows', '#d8443a', L);
}

{
  let teeth = '';
  for (let k = 0; k < 7; k++) {
    const a = 192 + k * 26;
    teeth += P(...apt(32, 44, 20, a - 8.6), ...apt(32, 44, 20, a + 8.6), ...apt(32, 44, 10.6, a));
  }
  def('trap', '#9aa4ae', [
    ['steel', ring(53, 55, 4.4, 2) + ring(58.6, 60.4, 4.4, 2), { eo: 1 }],
    ['metal', teeth],
    ['base', arcBand(32, 44, 26.4, 19.4, 180, 360)],
    ['metal', (() => { let d = ''; for (let k = 0; k < 6; k++) { const x = 13 + k * 7.6; d += P(x - 3.4, 43, x + 3.4, 43, x, 35.6); } return d; })()],
    ['steel', R(1.6, 42, 60.8, 7.4, 2.6)],
    ['metal', E(7.6, 45.6, 3.6, 5.6) + E(56.4, 45.6, 3.6, 5.6)],
    ['dark', E(32, 45.6, 9.6, 3.8)],
    ['metal', E(32, 44.8, 7, 2.4), { o: 0 }],
  ]);
}

def('paw', '#d8a060', [
  ['base', sym('M32 30C40 30 46.4 37.6 48.4 44C50.4 52 44.6 57 38.6 56.6C36 56.4 34 55.4 32 55.4')],
  ['base', E(15.6, 30, 6, 8, -22)],
  ['base', E(25, 17.6, 6.2, 8.6, -6)],
  ['base', E(39, 17.6, 6.2, 8.6, 6)],
  ['base', E(48.4, 30, 6, 8, 22)],
]);

def('wolf', '#8f99ab', [
  ['base', sym('M32 22C34 21.5 36 20.5 38 19L47 5C50 11 51 17 50 23C55 27 58.5 33 58.5 39L52.5 41C51 47 45 53 39 56.5L32 61')],
  ['dark', mir(P(39.6, 18.4, 46.4, 9.4, 47.6, 20.4)), { o: 0, hi: 0 }],
  ['light', mir('M52.5 41C54 36 52 31 47 28C50 34 50 38 52.5 41Z'), { o: 0, hi: 0, a: 0.7 }],
  ['light', sym('M32 35C36.4 35 39.6 40 40.4 46C40.4 52 37 57 32 58.4'), { o: 0 }],
  ['ink', sym('M32 49.6L36.4 49C37 52 35 54.4 32 55')],
  ['dark', mir('M22.6 28L29.4 31.8'), { l: 1.8, o: 0 }],
  ['yellow', mir(P(22.4, 33.4, 28.6, 35.6, 27.6, 38, 22.8, 36.4)), { o: 0, hi: 0 }],
]);

def('raven', ['#6a6290', '#1c182c'], [
  ['gold', 'M36 50L34 60M41.4 51L41.4 60', { l: 1.6 }],
  ['base', 'M15 21C19 15.6 25 13.6 30 15C35 16.6 38 21 39 25.6C46 28 53 34 58 44L63 52L55 50.6L58.6 58L48.6 52C42 53 34 51 29.6 47C25.4 43 23.6 37 24 31C22 28.6 18.6 27 15 26Z'],
  ['gold', 'M15.4 20.6L2.6 25.4L15 26.6Z'],
  ['dark', 'M28.6 29C38 27.6 48 33 56.6 45.6C46 46 36 42 30 36.4Z'],
  ['light', 'M34 33C40 34 46 38 50 42.6M32 36.6C38 38.6 43 41 47 44', { l: 0.9, o: 0, a: 0.4 }],
  ['red', O(23.6, 20.4, 1.9), { o: 0, hi: 0 }],
]);

{
  const fingers = cap(26, 33, 22.4, 22, 2) + cap(22.4, 22, 20.4, 13, 1.7) + cap(30, 32, 29.4, 18, 2) + cap(29.4, 18, 28.6, 8, 1.7) +
    cap(34.4, 32, 35.6, 18.4, 2) + cap(35.6, 18.4, 37, 9.4, 1.7) + cap(38.4, 34, 42.4, 23, 1.9) + cap(42.4, 23, 45.4, 15, 1.6) +
    cap(39.4, 39, 47, 33.6, 2) + cap(47, 33.6, 52.6, 28, 1.7);
  def('summon', ['#c8ffb0', '#3acf6a'], [
    ['base', O(32, 40, 28), { fx: 1, a: 0.6 }],
    ['bone', cap(28, 64, 28.4, 40, 2.6) + cap(36, 64, 35.6, 40, 2.6)],
    ['bone', R(24, 32, 16, 10, 3.4)],
    ['bone', fingers],
    ['stone', 'M2 60C8 51 20 48 32 51C44 48 56 51 62 60L62 64L2 64Z'],
    ['stone', P(5, 52, 11, 48.6, 13.4, 53.4) + P(50, 49.6, 56, 47.6, 57.4, 52.6)],
    ['base', 'M18 58L24 54L28 58M37 57L43 53.6L47 57', { l: 1.3, o: 0 }],
  ]);
}

def('bone_spear', ['#e6ffd0', '#62d04a'], [
  ['base', O(32, 6, 15), { fx: 1, a: 0.6 }],
  ['bone', cap(32, 16, 32, 72, 2.5)],
  ['bone', E(32, 36, 4.4, 3) + E(32, 54, 4.4, 3) + E(32, 71, 4.6, 3.6)],
  ['dark', R(28.4, 17, 7.2, 7.4, 1.6)],
  ['bone', sym('M32 -10L35.8 -1L34 0.6L38.4 6L36.2 7.6L40 14.4L36.6 16.6L32 18.4')],
  ['base', segs(32, -4, 32, 14), { l: 1, o: 0, a: 0.6 }],
], { rot: 45 });

def('ghost', ['#f2fbff', '#9ccfff'], [
  ['base', O(32, 30, 29), { fx: 1, a: 0.45 }],
  ['base', sym('M32 4C46 4 54 15 54 29L54 52C54 57 51 59 48 56L44 52L39.6 59L35.6 53L32 58'), { a: 0.95 }],
  ['ink', E(24, 26, 4, 6) + E(40, 26, 4, 6), { o: 0, hi: 0 }],
  ['ink', E(32, 40, 4, 5.6), { o: 0, hi: 0 }],
  ['white', O(25, 24, 1.2) + O(41, 24, 1.2), { o: 0, hi: 0 }],
]);

{
  const L = [];
  const pts = [[12, 52], [22, 42], [32, 32], [42, 22], [52, 12]];
  pts.forEach(([x, y], i) => { if (i % 2) L.push(['steel', cap(x - 6.4, y + 6.4, x + 6.4, y - 6.4, 3.3)]); });
  pts.forEach(([x, y], i) => { if (!(i % 2)) L.push(['base', E(x, y, 12, 7.6, -45) + E(x, y, 6.8, 2.8, -45), { eo: 1 }]); });
  def('chains', '#b8c2cc', L);
}

def('fist', '#e3a678', [
  ['metal', R(19, 46, 26, 16, 3)],
  ['base', R(14, 21, 36, 28, 7)],
  ['base', R(14.4, 13.6, 9.6, 16, 4.8)],
  ['base', R(23.4, 11.4, 9.6, 17, 4.8)],
  ['base', R(32.4, 11.4, 9.6, 17, 4.8)],
  ['base', R(41.2, 14.4, 9, 15.6, 4.5)],
  ['base', 'M13.6 33C18 29 29 29.4 35.4 34C37.4 38.4 34 42.4 28 42.6L15 44Z'],
  ['gold', R(17.6, 45, 28.8, 3.6, 1.2), { g: 1 }],
]);

const comet = (cx, cy, r, a0, a1, w) => band(arcP(cx, cy, r, a0, a1, 20), (t) => w * Math.pow(t, 0.85) * Math.sqrt(Math.max(0, 1 - Math.pow(t, 10))));
def('whirlwind', ['#f2f8ff', '#9ab4d8'], [
  ['base', O(32, 32, 30), { fx: 1, a: 0.35 }],
  ['base', comet(32, 32, 24, -40, 130, 10)],
  ['base', comet(32, 32, 24, 80, 250, 10)],
  ['base', comet(32, 32, 24, 200, 370, 10)],
  ['light', comet(32, 32, 14, 30, 170, 6.4)],
  ['light', comet(32, 32, 14, 150, 290, 6.4)],
  ['light', comet(32, 32, 14, 270, 410, 6.4)],
  ['white', O(32, 32, 3.8)],
]);

def('charge', '#c8843a', [
  ['light', segs(2, 22, 15, 22, 0, 32, 12, 32, 3, 42, 14, 42), { l: 2.6, o: 0, a: 0.85 }],
  ...xf(lay('boots'), Msc(0.8, 0.8, 32, 32), Mrot(-14), Mmv(8, 0)),
  ['stone', O(15, 57, 4) + O(8.4, 53, 3) + O(21, 60, 2.6), { a: 0.85 }],
]);

def('taunt', '#e8a070', [
  ['base', E(7.6, 30, 3.6, 6) + E(56.4, 30, 3.6, 6)],
  ['base', O(32, 30, 24)],
  ['ink', mir(P(13.6, 13.6, 27.4, 19.6, 26.6, 22.6, 14, 17.4)), { o: 0, hi: 0 }],
  ['ink', E(21.4, 24, 2.6, 2) + E(42.6, 24, 2.6, 2), { o: 0, hi: 0 }],
  ['ink', sym('M32 28.6C38.6 28.6 44 30 47 33C47.4 42.6 41 50.6 32 52')],
  ['white', sym('M32 28.6C38.6 28.6 44 30 47 33L45.6 36L32 35.4'), { o: 0 }],
  ['red', sym('M32 42.6C37 42.6 41 44.4 42.6 46.6C40 50 36 51.6 32 51.8'), { o: 0 }],
  ['white', segs(6, 44, 1, 48, 9, 50, 5, 56, 58, 44, 63, 48, 55, 50, 59, 56), { l: 2.4 }],
]);

{
  const H = arcP(44, 52, 30, 200, 268, 18);
  const w = (t) => 3.4 + 12.4 * t * t;
  const hoop = (i) => {
    const [x, y] = H[i], [x2, y2] = H[i + 1], L = Math.hypot(x2 - x, y2 - y), nx = -(y2 - y) / L, ny = (x2 - x) / L, hw = w(i / 18) / 2 + 0.6;
    return cap(x - nx * hw, y - ny * hw, x + nx * hw, y + ny * hw, 1.5);
  };
  def('war_cry', ['#ffd56a', '#e0731e'], [
    ['base', arcD(46, 22, 13, -58, 58) + arcD(46, 22, 20, -52, 52) + arcD(46, 22, 27, -46, 46), { l: 2.6 }],
    ['leather', cr([[17, 44], [24, 53], [36, 51], [43, 38]], false), { l: 1.8 }],
    ['bone', band(H, w)],
    ['gold', hoop(5) + hoop(11)],
    ['gold', E(43.6, 22, 3.8, 9.2)],
    ['dark', E(44.2, 22, 2, 6.8), { o: 0, hi: 0 }],
    ['gold', O(15.6, 41.8, 2.4)],
  ]);
}

def('slash', ['#ffffff', '#8fb2ff'], [
  ['base', O(32, 32, 26), { fx: 1, a: 0.35 }],
  ['base', swoosh(42, 42, 34, 150, 300, 14, 24, 0.7)],
  ['white', swoosh(42, 42, 31.4, 166, 288, 4.6, 20, 0.7), { o: 0, hi: 0 }],
  ['light', spark(11, 57, 3.6) + spark(57, 11, 3.6), { o: 0, hi: 0 }],
]);

def('cleave', ['#ffe6c8', '#e85a26'], [
  ['base', O(32, 44, 28), { fx: 1, a: 0.35 }],
  ['base', swoosh(32, 50, 28.6, 182, 358, 12.6, 24, 0.6)],
  ['light', swoosh(32, 50, 18.6, 194, 346, 7, 20, 0.6)],
  ['white', swoosh(32, 50, 26.4, 200, 340, 3.4), { o: 0, hi: 0 }],
  ['white', spark(4, 52, 4) + spark(60, 52, 4), { o: 0, hi: 0 }],
]);

def('bleed', ['#ff6a6a', '#b0101e'], [
  ['base', swoosh(60, 60, 50, 182, 268, 9.6)],
  ['white', swoosh(60, 60, 48.6, 195, 255, 2.4), { o: 0, hi: 0, a: 0.6 }],
  ['base', drop(15, 47, 13), { g: 1 }],
  ['base', drop(30, 29, 17), { g: 1 }],
  ['base', drop(46, 18, 12), { g: 1 }],
]);

def('stun', '#ffd23a', [
  ['deep', bust(32, 50, 0.92)[1]],
  ['deep', bust(32, 50, 0.92)[0]],
  ['light', E(32, 30, 27, 8.4) + E(32, 30, 23.4, 5.8), { eo: 1 }],
  ['base', star(8, 31, 5, 7.6, 3.2)],
  ['base', star(32, 20, 5, 9.4, 4)],
  ['base', star(56, 31, 5, 7.6, 3.2)],
]);

def('sprint', '#c8843a', [
  ['light', segs(2, 50, 12, 50, 4, 58, 16, 58), { l: 2.4, o: 0, a: 0.85 }],
  ...xf(lay('boots'), Msc(0.82, 0.82, 32, 32), Mmv(6, 2)),
  ['white', 'M28 31C22 23 12 17 2 17C7 21 10 23 12 25C7 25 3 27 1 31C8 31 13 31 17 33C13 35 10 37 8 41C15 40 21 38 28 36Z'],
  ['dark', 'M26 31C20 28 14 27 8 27M26 34C21 33 16 33.4 12 35', { l: 0.9, o: 0, a: 0.35 }],
]);

{
  let mesh = '';
  const R0 = 23.6;
  for (let d = -20; d <= 20; d += 8) {
    const h = Math.sqrt(R0 * R0 - d * d);
    for (const [ux, uy] of [[0.7071, 0.7071], [0.7071, -0.7071]]) {
      const nx = -uy, ny = ux;
      mesh += segs(32 + nx * d - ux * h, 32 + ny * d - uy * h, 32 + nx * d + ux * h, 32 + ny * d + uy * h);
    }
  }
  def('net', '#d8c08a', [
    ['base', mesh, { l: 1.9 }],
    ['wood', ring(32, 32, 27.4, 23.4), { eo: 1 }],
    ['stone', O(32, 4.6, 3.8) + O(59.4, 32, 3.8) + O(32, 59.4, 3.8) + O(4.6, 32, 3.8)],
  ]);
}

def('mark', '#ff3a3a', [
  ['base', ring(32, 32, 22.6, 18.2), { eo: 1 }],
  ['base', ring(32, 32, 10.6, 6.8), { eo: 1 }],
  ['base', R(29.8, 2, 4.4, 14, 1.4) + R(29.8, 48, 4.4, 14, 1.4) + R(2, 29.8, 14, 4.4, 1.4) + R(48, 29.8, 14, 4.4, 1.4)],
  ['white', O(32, 32, 2.6)],
]);

def('tornado', '#a8bccf', [
  ['base', 'M6 8C20 4 44 4 58 8C58 14 50 18 46 20C48 26 42 30 38 32C40 38 36 42 32 46C34 50 32 54 28 60C28 54 26 50 24 46C22 42 24 38 22 34C18 30 16 24 18 20C12 18 6 14 6 8Z'],
  ['light', 'M10 9C24 13 42 13 55 9M19 21C28 24 40 24 46 20M23 34C28 36 34 36 38 32M25 46C27.6 47 30 47 32 46', { l: 1.8, o: 0 }],
  ['dark', 'M14 15C26 19 40 18 50 14M21 28C27 30 34 30 41 27M24 40C27 41 31 41 34.6 39', { l: 1.2, o: 0, a: 0.5 }],
  ['stone', P(52, 34, 57, 32, 58, 37, 54, 38) + P(8, 40, 12, 38, 13, 42, 9, 43) + P(44, 52, 48, 51, 48, 55, 45, 55)],
]);

def('earthquake', '#b08758', [
  ['fire', O(28, 46, 14), { fx: 1, a: 0.8 }],
  ['fire', P(22, 30, 31, 40, 28, 46, 33, 54, 30, 62, 26, 62, 29, 54, 24, 46, 28, 38), { o: 0, hi: 0 }],
  ['base', P(2, 36, 22, 30, 28, 38, 24, 46, 29, 54, 26, 62, 2, 62)],
  ['light', P(2, 36, 22, 30, 23.4, 32, 2, 39.4), { o: 0, hi: 0, a: 0.8 }],
  ['dark', P(31, 40, 62, 36, 62, 62, 30, 62, 33, 54, 28, 46)],
  ['base', P(31, 40, 62, 36, 62, 39.4, 32.4, 42.6), { o: 0, hi: 0, a: 0.8 }],
  ['stone', P(12, 14, 19, 10, 23.4, 16, 17, 21) + P(36, 8, 43, 5.6, 46, 11.6, 39, 14) + P(48, 21, 54, 18.6, 56, 24, 50.6, 25.6)],
  ['light', segs(18, 24, 18, 28, 41, 17, 41, 21.6, 52, 28.6, 52, 32), { l: 1.2, o: 0, a: 0.7 }],
]);

{
  const vine = [[8, 61], [12, 49], [22, 41], [33, 33], [30, 22], [37, 13], [48, 9]];
  def('vines', '#4caf3a', [
    ['dark', band(vine, (t) => 6.4 - 3.4 * t)],
    ['dark', cr(spiralP(51.6, 14.4, 6, 1, 150, 520, 18), false), { l: 1.6 }],
    ['dark', P(10.4, 52, 6, 50, 10.8, 47.6) + P(25.4, 41.4, 27, 46, 22.6, 43.4) + P(31.4, 26, 26.6, 24.4, 30.4, 22) + P(38, 15.6, 40, 19.6, 41, 14.4)],
    ['base', leaf(14, 47, 3, 40, 10, 2)],
    ['base', leaf(25, 39, 37, 46, 10, -2)],
    ['base', leaf(33, 30, 46, 28, 9, 2)],
    ['base', leaf(31, 20, 19, 15, 9, -2)],
    ['light', segs(14, 47, 5, 41.4, 25, 39, 35.4, 45, 33, 30, 44.4, 28.4, 31, 20, 21, 16), { l: 0.8, o: 0, a: 0.6 }],
  ]);
}

def('moon', ['#fff8d6', '#e6c46a'], [
  ['base', O(30, 32, 30), { fx: 1, a: 0.45 }],
  ['base', crescent(30, 32, 26, 13, -9, 22), { g: 1 }],
  ['dark', O(14, 38, 3.4) + O(20, 50, 2.4) + O(13, 26, 2), { o: 0, hi: 0, a: 0.3 }],
  ['white', spark(50, 46, 5.4) + spark(56, 12, 3.6), { o: 0, hi: 0 }],
]);

def('star', ['#fff2a0', '#ffbe1e'], [
  ['base', O(32, 33, 30), { fx: 1, a: 0.45 }],
  ['base', rad(32, 34, 10, [29, 12.4]), { g: 1 }],
  ['light', rad(32, 34, 10, [16, 6.8]), { o: 0, a: 0.8 }],
]);

def('blood_drop', ['#ff7a7a', '#b0101e'], [
  ['base', drop(30, 4, 56), { g: 1 }],
  ['white', E(22, 38, 3, 7, 15), { o: 0, hi: 0, a: 0.6 }],
  ['base', drop(50, 40, 18)],
]);

def('soul', ['#e0fbff', '#46d0ff'], [
  ['base', O(32, 32, 29), { fx: 1, a: 0.55 }],
  ['base', 'M32 6C42 8 48 18 46 30C44 42 35 49 27 52C31 55.6 31 59.6 25 62C27 58 23 54.6 19 52.6C14.6 48.6 14 40.6 18 34C22 26 23.6 14 32 6Z'],
  ['light', 'M32 16C38 19 41 26 39.6 33C38 40 33 44 28 45C24 41 23 35 25.6 30C28 25 28 20 32 16Z', { o: 0 }],
  ['white', O(31, 34, 4.4), { o: 0, hi: 0 }],
  ['white', spark(50, 12, 3.6) + spark(12, 22, 2.8), { o: 0, hi: 0 }],
]);

def('drain', ['#ff7a8a', '#b8102c'], [
  ['purple', O(46, 18, 22), { fx: 1, a: 0.7 }],
  ['base', band([[6, 58], [14, 49], [18, 41], [28, 35], [35, 27], [40, 21]], (t) => 1 + 5.6 * t)],
  ['base', band([[3, 36], [13, 37], [21, 31], [29, 31], [37, 23]], (t) => 1 + 4.4 * t)],
  ['base', band([[25, 61], [31, 52], [37, 47], [41, 37], [44, 27]], (t) => 1 + 4.4 * t)],
  ['purple', O(46, 18, 11.6), { g: 1 }],
  ['white', spark(46, 18, 6), { o: 0, hi: 0 }],
  ['base', drop(12, 24, 8) + drop(46, 46, 7)],
]);

def('explosion', ['#ffe066', '#ff4a14'], [
  ['base', O(32, 32, 30), { fx: 1, a: 0.55 }],
  ['base', rad(32, 32, 24, [29, 17, 25, 15.6, 30, 18, 23, 16])],
  ['light', rad(32, 32, 16, [19, 10, 16, 9.4], -80), { o: 0 }],
  ['white', O(32, 32, 6.6), { o: 0, hi: 0 }],
  ['stone', P(5, 9, 10, 7, 11, 12, 6, 13) + P(55, 53, 60, 51, 61, 56, 56, 58) + P(53, 6, 58, 7.4, 56, 12, 51.6, 10.6)],
]);

def('rage', ['#ff6a4a', '#c8141e'], [
  ['base', O(32, 34, 30), { fx: 1, a: 0.45 }],
  ['fire', rad(32, 35, 18, [31, 22.6, 28, 21.6])],
  ['base', O(32, 35, 21.6)],
  ['ink', mir(P(13.6, 25, 28.6, 31.4, 27.6, 34.4, 14.6, 29)), { o: 0, hi: 0 }],
  ['yellow', mir(P(18.4, 32.4, 27.6, 35.6, 26, 38, 19.4, 35.6)), { o: 0, hi: 0 }],
  ['white', R(21, 43, 22, 9, 3)],
  ['ink', segs(26.6, 43.4, 26.6, 51.6, 32, 43.4, 32, 51.6, 37.4, 43.4, 37.4, 51.6, 21.4, 47.5, 42.6, 47.5), { l: 1, o: 0 }],
]);

/* ----------------------------------------------------------------------
 * 6e. UI symbols (part 1)
 * -------------------------------------------------------------------- */
def('crown', '#f2c14e', [
  ['base', sym('M32 6L38.6 27L49 11L50.6 29L60 18L55 45L32 45')],
  ['red', P(32, 21, 35.4, 29, 32, 37, 28.6, 29), { g: 1 }],
  ['base', O(32, 6, 3.4) + O(49, 11, 3) + O(15, 11, 3) + O(60, 18, 2.8) + O(4, 18, 2.8), { g: 1 }],
  ['base', R(9, 43, 46, 11, 2.6), { g: 1 }],
  ['red', O(32, 48.5, 3.6), { g: 1 }],
  ['blue', O(19.6, 48.5, 2.8) + O(44.4, 48.5, 2.8), { g: 1 }],
]);

def('trophy', '#f2c14e', [
  ['base', 'M17.6 11C7 11 7 28 21 30.6M46.4 11C57 11 57 28 43 30.6', { l: 3.6 }],
  ['base', sym('M32 6L48 6C48 22 44 32 36 36L35 44L32 44'), { g: 1 }],
  ['base', sym('M32 43L38.6 43C39.6 46 41.6 48 44 48.4L44 52.4L32 52.4')],
  ['wood', R(16.6, 52, 30.8, 9.6, 2)],
  ['base', R(26, 54.6, 12, 4.4, 1), { o: 0 }],
  ['dark', E(32, 6.8, 14.4, 1.8), { o: 0, hi: 0, a: 0.5 }],
  ['white', star(32, 19, 5, 6.6, 2.8), { o: 0, a: 0.85 }],
]);

def('banner', '#c0392b', [
  ['gold', 'M20 8L32 1.6L44 8', { l: 1.3 }],
  ['base', sym('M32 9L49 9L49 54L40.6 45.6L32 54')],
  ['dark', R(15, 9, 34, 4, 0), { o: 0, hi: 0, a: 0.5 }],
  ['gold', 'M18.6 13L18.6 49M45.4 13L45.4 49', { l: 1.3, o: 0, a: 0.9 }],
  ['gold', star(32, 28, 5, 9.6, 4), { g: 1 }],
  ['wood', cap(9, 8, 55, 8, 2.6)],
  ['gold', O(7.4, 8, 3.4) + O(56.6, 8, 3.4), { g: 1 }],
]);

def('sword_cross', '#6fa8dc', [...xf(lay('sword'), Mrot(-45)), ...xf(lay('sword'), Mrot(45))]);

def('map_marker', '#e2402e', [
  ['ink', E(32, 58.4, 12, 3.4), { o: 0, hi: 0, a: 0.35 }],
  ['base', sym('M32 4C44 4 52 13 52 24C52 36 41 47 32 59'), { g: 1 }],
  ['white', O(32, 24, 7.4)],
]);

def('compass', '#c8342a', [
  ['gold', ring(32, 5, 4.4, 2.2), { eo: 1 }],
  ['gold', O(32, 33, 26), { g: 1 }],
  ['paper', O(32, 33, 20.6)],
  ['ink', segs(32, 14.6, 32, 18, 32, 48, 32, 51.4, 13.6, 33, 17, 33, 47, 33, 50.4, 33), { l: 1.4, o: 0, a: 0.55 }],
  ['base', rot(P(32, 14.6, 36.4, 33, 27.6, 33), 35, 32, 33)],
  ['metal', rot(P(32, 51.4, 36.4, 33, 27.6, 33), 35, 32, 33)],
  ['gold', O(32, 33, 3), { g: 1 }],
]);

def('gear', '#b8c2cc', [
  ['base', gearD(32, 32, 9, 28.6, 21.6) + O(32, 32, 8.6), { eo: 1, g: 1 }],
  ['dark', ring(32, 32, 15.6, 13.6), { eo: 1, o: 0, hi: 0, a: 0.35 }],
]);

def('quest_exclaim', ['#fff19a', '#ffb81e'], [
  ['base', O(32, 30, 30), { fx: 1, a: 0.5 }],
  ['base', sym('M32 4L38.4 4C40.6 4 41.8 6 41.4 8.4L37 41L32 41')],
  ['base', O(32, 52, 6.6)],
]);

def('quest_question', ['#fff19a', '#ffb81e'], [
  ['base', O(32, 30, 30), { fx: 1, a: 0.5 }],
  ['base', 'M19.6 21C19.6 11 26 5.6 33 5.6C41 5.6 46.4 11 46.4 18.4C46.4 27.6 35 29.6 33 37.6L33 40', { l: 8.6 }],
  ['base', O(33, 52.6, 6.2)],
]);

def('chat', '#eef4ff', [
  ['base', R(5, 7, 54, 38, 11) + P(14, 40, 12, 58, 30, 43)],
  ['ink', O(20, 26, 3.6) + O(32, 26, 3.6) + O(44, 26, 3.6), { o: 0, hi: 0, a: 0.75 }],
], { bg: ['#2b5a96', '#0b1730'] });

def('users', '#d4dcea', [
  ['dark', bust(42, 34, 0.86)[1]],
  ['dark', bust(42, 34, 0.86)[0]],
  ['base', bust(24, 40, 1)[1]],
  ['base', bust(24, 40, 1)[0]],
], { bg: ['#2c4a6e', '#0b1424'] });

def('guild', '#2f6fd0', [
  ['wood', cap(12, 6, 12, 62, 2.4)],
  ['base', 'M14 8C24 3 32 12 42 8C48 5.6 52 5.6 57 8L57 38C52 35.6 48 35.6 42 38C32 42 24 33 14 38Z'],
  ['dark', 'M14 33C24 28 32 37 42 33C48 30.6 52 30.6 57 33L57 38C52 35.6 48 35.6 42 38C32 42 24 33 14 38Z', { o: 0, hi: 0, a: 0.5 }],
  ['gold', tf(SHIELD, Msc(0.36, 0.36, 0, 0), Mmv(24, 9.6)), { g: 1 }],
  ['base', tf(SHIELD, Msc(0.24, 0.24, 0, 0), Mmv(27.8, 13.6))],
  ['gold', O(12, 5, 3.4), { g: 1 }],
]);

const ANVIL = 'M2 20L58 20L58 28.6L46 30.6L42 33L42 41L48 49L16 49L22 41L22 33C13 31 6 26 2 20Z';
const ANVIL_L = [
  ['steel', ANVIL],
  ['metal', P(2.6, 20, 58, 20, 58, 23.6, 9.6, 23.6), { o: 0, hi: 0, a: 0.7 }],
  ['dark', R(13, 48, 38, 7, 2)],
];
def('hammer_anvil', '#c88a3a', [
  ...ANVIL_L,
  ...xf(lay('hammer'), Msc(0.56, 0.56, 32, 32), Mrot(-40), Mmv(4, -15)),
  ['yellow', spark(50, 12, 4.4) + spark(57, 4, 2.8), { o: 0, hi: 0 }],
]);

def('pickaxe', '#c0ccd8', [
  ['wood', cap(32, 12, 32, 70, 2.8)],
  ['leather', R(28.8, 52, 6.4, 13, 1.6)],
  ['metal', 'M2 24C12 13 22 8.6 32 8.6C42 8.6 52 13 62 24C52 19 42 16.6 32 16.6C22 16.6 12 19 2 24Z'],
  ['steel', R(27.6, 5.6, 8.8, 14, 2)],
], { rot: -40 });

def('axe_tool', '#c0a070', [
  ['paper', P(2, 38, 8, 35, 9, 40, 4, 42) + P(10, 48, 15, 46, 15.6, 51, 11, 52) + P(3, 54, 7, 53, 7, 57, 3.6, 57.6)],
  ['wood', 'M30 8C31 24 31.4 46 30.6 70L34.6 70C35.6 46 35.4 24 34 8Z'],
  ['leather', R(29.4, 52, 6.6, 14, 1.8)],
  ['metal', 'M30 9L19 6.6C14.6 11 12.4 19 13.4 28L30 23.6Z'],
  ['white', 'M19 6.6C14.6 11 12.4 19 13.4 28L16.4 27C15.6 20 17 13 21 7.2Z', { o: 0, hi: 0, a: 0.6 }],
  ['steel', R(28.6, 6.4, 7.4, 17.6, 2)],
  ['steel', R(35.6, 9.4, 4.4, 11.4, 1.4)],
  ['gold', R(28.6, 22.4, 7.4, 3, 1)],
], { rot: 38 });

def('fishing_rod', '#9a6234', [
  ['white', 'M52.6 7C55.6 18 53.6 30 50 38.6', { l: 0.9 }],
  ['wood', band([[7, 61], [20, 46], [35, 27], [53, 6]], (t) => 4.4 - 2.8 * t)],
  ['leather', band([[7, 61], [11.4, 56], [16, 50.6]], 5)],
  ['steel', O(19, 50, 4.6)],
  ['metal', O(19, 50, 2), { o: 0 }],
  ['metal', 'M50 47.4L50 52.6C50 56.6 45 57 44.4 53', { l: 1.3 }],
  ['white', O(50, 43, 4.6)],
  ['red', arcD(50, 43, 4.6, 0, 180) + 'Z', { o: 0 }],
]);

def('sickle', '#c0ccd8', [
  ['wood', cap(27, 47, 11, 62, 3.4)],
  ['metal', crescent(36, 26, 22, 4.6, 6, 19)],
  ['white', crescent(36, 26, 20.4, 3, 3.6, 19), { o: 0, hi: 0, a: 0.3 }],
  ['gold', O(27.6, 46.4, 3.6), { g: 1 }],
]);

def('horse', '#8b5a33', [
  ['dark', 'M38 5C49 6 57 14 60 28L62 55L56.4 51C55 37 52 24 42 13Z'],
  ['base', 'M38 4L41 9C47 12 52 18 54 26L57 50C57.6 56 54 60 48 60L37 60L35.6 45C32 41 26 40.6 20 42.6L12 45C7.6 46 4.6 42 6.6 37.6L19 18C22.6 12 28.6 8.6 35 7.6Z'],
  ['dark', P(35.6, 8, 38.4, 4.6, 39.6, 9.4), { o: 0, hi: 0 }],
  ['light', 'M12 45C7.6 46 4.6 42 6.6 37.6L10 32C12 36 14 40 18 42.8Z', { o: 0, hi: 0, a: 0.4 }],
  ['ink', O(27.6, 21, 2.2) + E(10.6, 39.6, 1.4, 2, 30), { o: 0, hi: 0 }],
  ['leather', 'M20.6 17.6L28 30.4L13 39.6M28 30.4L39 26', { l: 1.8 }],
  ['gold', O(28, 30.4, 2.2)],
]);

/* ----------------------------------------------------------------------
 * 6f. UI symbols (part 2)
 * -------------------------------------------------------------------- */
def('tower', '#8a8e96', [
  ['wood', segs(32, -6, 32, 6), { l: 1.4 }],
  ['red', P(33, -6, 44, -3, 33, 0.2)],
  ['base', sym('M32 22L46 22L48.6 60L32 60')],
  ['base', sym('M32 6L35.6 6L35.6 12L41.6 12L41.6 6L50 6L50 22L32 22')],
  ['ink', segs(17, 30, 47, 30, 16.6, 38, 47.4, 38, 16.2, 46, 47.8, 46, 16, 53, 48, 53, 24, 22, 24, 30, 40, 22, 40, 30, 28, 30, 28, 38, 22, 38, 22, 46, 42, 38, 42, 46, 26, 46, 26, 53),
    { l: 0.8, o: 0, a: 0.3 }],
  ['ink', 'M26.4 60L26.4 51C26.4 46 37.6 46 37.6 51L37.6 60Z', { o: 0, hi: 0 }],
  ['ink', R(29.6, 27.6, 4.8, 9, 2.4), { o: 0, hi: 0 }],
  ['yellow', R(30.4, 28.6, 3.2, 7, 1.6), { o: 0, hi: 0, a: 0.75 }],
]);

def('house', '#c0392b', [
  ['stone', R(42, 8, 7, 16, 1)],
  ['paper', R(12, 29, 40, 29)],
  ['wood', R(26.6, 40, 10.8, 18, 1.6)],
  ['gold', O(34.6, 49.6, 1.1), { o: 0 }],
  ['yellow', R(15.6, 36, 8.4, 8.4, 1) + R(40, 36, 8.4, 8.4, 1)],
  ['ink', segs(19.8, 36, 19.8, 44.4, 15.6, 40.2, 24, 40.2, 44.2, 36, 44.2, 44.4, 40, 40.2, 48.4, 40.2), { l: 0.9, o: 0, a: 0.6 }],
  ['base', P(3, 32, 32, 5, 61, 32)],
  ['dark', segs(10, 27, 32, 8.6, 32, 8.6, 54, 27), { l: 1, o: 0, a: 0.35 }],
]);

def('scales', '#f2c14e', [
  ['dark', 'M11 16L5 38M11 16L19 38M53 16L45 38M53 16L59 38', { l: 1, o: 0 }],
  ['base', cap(32, 10, 32, 52, 2.2)],
  ['base', R(20, 51.6, 24, 7.4, 2)],
  ['base', cap(9, 16, 55, 16, 2.2)],
  ['base', 'M2.6 38L21.4 38C21.4 44 17 48.4 12 48.4C7 48.4 2.6 44 2.6 38Z', { g: 1 }],
  ['base', 'M42.6 38L61.4 38C61.4 44 57 48.4 52 48.4C47 48.4 42.6 44 42.6 38Z', { g: 1 }],
  ['base', O(32, 9, 3.6), { g: 1 }],
]);

def('mail', '#c8342a', [
  ['paper', R(5, 14, 54, 36, 3)],
  ['dark', 'M6 48L26 31M58 48L38 31', { l: 1, o: 0, a: 0.4 }],
  ['paper', P(6, 15, 58, 15, 32, 36)],
  ['base', O(32, 34, 5.8), { g: 1 }],
  ['dark', star(32, 34, 5, 3.2, 1.4), { o: 0, hi: 0, a: 0.5 }],
]);

def('lock', '#f2c14e', [
  ['metal', 'M20 30L20 20C20 12 26 7 32 7C38 7 44 12 44 20L44 30', { l: 6 }],
  ['base', R(12, 28, 40, 31, 4.6), { g: 1 }],
  ['ink', O(32, 40, 4.2) + P(30, 42, 34, 42, 35.4, 52, 28.6, 52), { o: 0, hi: 0 }],
]);

def('plus', ['#8cf57a', '#1d9a2a'], [['base', R(25.4, 6, 13.2, 52, 3.4) + R(6, 25.4, 52, 13.2, 3.4)]]);
def('close', ['#ff8484', '#c81e2e'], [['base', cap(13, 13, 51, 51, 6.6) + cap(51, 13, 13, 51, 6.6)]]);
def('check', ['#8cf57a', '#1d9a2a'], [['base', 'M10 34L25.6 49.6L54 15', { l: 10 }]]);

{
  const arc = arcBand(32, 32, 24, 16, -150, 30) + P(...apt(32, 32, 10.4, 26), ...apt(32, 32, 29.6, 26), ...apt(32, 32, 20, 64));
  def('refresh', ['#9cd6ff', '#1f7ee0'], [['base', arc], ['base', rot(arc, 180)]]);
}

def('info', ['#8cc6ff', '#2a74d8'], [
  ['base', O(32, 32, 28), { g: 1 }],
  ['white', O(32, 17, 4.6)],
  ['white', R(28, 25, 8, 22, 2) + R(24.6, 25, 7, 4.6, 1.6) + R(24.4, 43.6, 15.2, 5.2, 2)],
]);

def('bell', '#f2c14e', [
  ['base', ring(32, 6.4, 4, 2), { eo: 1 }],
  ['dark', O(32, 56.6, 4.8)],
  ['base', sym('M32 7.6C37 7.6 39 9.6 39.6 11.6C47 14 51 21 51 31L51 41C51 45 54 47.6 58 50L58 53.4L32 53.4'), { g: 1 }],
  ['dark', R(10, 47.6, 44, 2.4, 1), { o: 0, hi: 0, a: 0.45 }],
]);

def('gift', '#d23b3b', [
  ['gold', E(23.4, 14, 9.4, 5.6, -28) + E(23.4, 14, 4.4, 1.8, -28), { eo: 1 }],
  ['gold', E(40.6, 14, 9.4, 5.6, 28) + E(40.6, 14, 4.4, 1.8, 28), { eo: 1 }],
  ['base', R(10, 29, 44, 29, 2)],
  ['light', R(7, 20, 50, 10, 2)],
  ['gold', R(28, 20, 8, 38, 0.6), { g: 1 }],
  ['gold', O(32, 18.6, 4.6), { g: 1 }],
]);

{
  let grid = '';
  for (let r = 0; r < 3; r++) for (let c = 0; c < 5; c++) grid += R(11.6 + c * 8.6, 27.6 + r * 9.4, 5.6, 5.6, 1);
  def('calendar', '#d23b3b', [
    ['paper', R(7, 10, 50, 48, 4.4)],
    ['base', 'M7 22L7 14.4C7 12 9 10 11.4 10L52.6 10C55 10 57 12 57 14.4L57 22Z'],
    ['ink', grid, { o: 0, hi: 0, a: 0.28 }],
    ['base', ring(40.2, 40.2, 5.8, 3.8), { eo: 1 }],
    ['metal', R(16.6, 4, 5.4, 12, 2.6) + R(42, 4, 5.4, 12, 2.6)],
  ]);
}

def('hourglass', '#f0c060', [
  ['glass', sym('M32 10L47 10C47 22 38 27.6 35.4 32C38 36.4 47 42 47 54L32 54')],
  ['base', sym('M32 18.6L41.6 18.6C40 24 36 27.6 33 30.6L32 30.6'), { o: 0 }],
  ['base', sym('M32 40.6C36 40.6 41 45 43.4 51.6L32 51.6'), { o: 0 }],
  ['base', segs(32, 30, 32, 44), { l: 1.2, o: 0 }],
  ['white', band([[21.6, 14], [23, 22], [28, 28.4]], (t) => 2.4 * Math.sin(Math.PI * t)), { o: 0, hi: 0, a: 0.7 }],
  ['wood', cap(14.6, 10, 14.6, 54, 1.8) + cap(49.4, 10, 49.4, 54, 1.8)],
  ['wood', R(10.4, 4, 43.2, 7, 2) + R(10.4, 53, 43.2, 7, 2)],
]);

def('dice', '#f4f2ec', [
  ['light', P(32, 5, 56, 17, 32, 29, 8, 17)],
  ['base', P(8, 17, 32, 29, 32, 59, 8, 47)],
  ['dark', P(32, 29, 56, 17, 56, 47, 32, 59)],
  ['red', E(32, 17, 4.6, 2.6), { o: 0, hi: 0 }],
  ['ink', E(14.7, 29.4, 2.6, 3.4, -20) + E(25.3, 46.6, 2.6, 3.4, -20), { o: 0, hi: 0 }],
  ['ink', E(38, 33.5, 2.6, 3.4, 20) + E(44, 38, 2.6, 3.4, 20) + E(50, 42.5, 2.6, 3.4, 20), { o: 0, hi: 0 }],
]);

def('backpack', '#a8703a', [
  ['dark', 'M23 12C23 3 41 3 41 12', { l: 2.6 }],
  ['base', sym('M32 10C42 10 50 16 50 26L50 54C50 58 46 60 42 60L32 60')],
  ['leather', R(15.6, 24, 4, 32, 1.6) + R(44.4, 24, 4, 32, 1.6), { o: 0 }],
  ['base', R(19, 38, 26, 17, 4.4)],
  ['light', R(21.6, 40.6, 20.8, 11.8, 3), { l: 0.8, o: 0, dash: [1.8, 1.8], a: 0.8 }],
  ['dark', sym('M32 10C42 10 50 16 50 26L50 30C44 32 38 32.6 32 32.6')],
  ['gold', R(29, 28, 6, 8, 1.4) + R(30.6, 29.6, 2.8, 4.8, 0.6), { eo: 1, g: 1 }],
]);

def('person', '#d4dcea', [
  ['base', bust(32, 38, 1.25)[1]],
  ['base', bust(32, 38, 1.25)[0]],
], { bg: ['#2c4a6e', '#0b1424'] });

{
  const L = [['gold', 'M32 56L32 36M32 36L12 19M32 36L32 11M32 36L52 19', { l: 3.4 }]];
  for (const [x, y, r] of [[32, 56, 5.4], [32, 36, 4.8], [12, 19, 6.6], [32, 11, 7.4], [52, 19, 6.6]]) {
    L.push(['gold', O(x, y, r + 1.8), { g: 1 }]);
    L.push(['base', O(x, y, r), { g: 1 }]);
  }
  L.push(['white', spark(32, 11, 4.4), { o: 0, hi: 0 }]);
  def('talent', ['#e6f6ff', '#3aa0ff'], L);
}

{
  const txt = 'M12 18C18 17 23 17.6 28 19.6M12 24C18 23 23 23.6 28 25.6M12 30C18 29 23 29.6 28 31.6M12 36C18 35 22 35.6 26 37M12 42C17 41 21 41.6 25 43';
  def('book_open', '#8a2a2a', [
    ['base', 'M3 14L3 54C14 52 24 52.6 32 58C40 52.6 50 52 61 54L61 14C50 12 40 12.6 32 16C24 12.6 14 12 3 14Z'],
    ['paper', 'M32 16C24 10 14 9.6 7 11L7 50C15 48.6 24 49.4 32 54Z'],
    ['paper', 'M32 16C40 10 50 9.6 57 11L57 50C49 48.6 40 49.4 32 54Z'],
    ['dark', mir(txt), { l: 1.2, o: 0, a: 0.4 }],
    ['dark', 'M32 16L32 54', { l: 1, o: 0, a: 0.5 }],
    ['red', P(40, 50, 44.4, 50, 44.4, 61, 42.2, 58.6, 40, 61)],
  ]);
}

{
  let joints = '';
  for (let k = 0; k < 8; k++) {
    const a = k * 45 + 22.5;
    joints += segs(32 + 16.4 * Math.cos(a * DEG), 32 + 23.4 * Math.sin(a * DEG), 32 + 22 * Math.cos(a * DEG), 32 + 29 * Math.sin(a * DEG));
  }
  def('portal', ['#ecd8ff', '#7a3cff'], [
    ['base', E(32, 32, 28, 31), { fx: 1, a: 0.6 }],
    ['stone', E(32, 32, 22, 29) + E(32, 32, 16, 23), { eo: 1 }],
    ['ink', joints, { l: 1, o: 0, a: 0.5 }],
    ['base', E(32, 32, 16.4, 23.4)],
    ['light', tf(band(spiralP(32, 32, 1, 14, 0, 560, 48), (t) => 4.4 * Math.sin(Math.PI * Math.pow(t, 0.8))), Msc(1, 1.55, 32, 32)), { o: 0, hi: 0, a: 0.8 }],
    ['white', O(32, 32, 3), { o: 0, hi: 0 }],
  ]);
}

const FLAME_L = [['accent', FLAME_O], ['base', FLAME_I, { o: 0 }], ['white', FLAME_C, { o: 0, hi: 0, a: 0.85 }]];
def('campfire', ['#ffd04a', '#ff4a12'], [
  ['base', O(32, 36, 26), { fx: 1, a: 0.55 }],
  ['stone', O(7, 56, 4.6) + O(17, 59.4, 4.6) + O(47, 59.4, 4.6) + O(57, 56, 4.6)],
  ['wood', cap(10, 58, 50, 46, 3.8)],
  ['wood', cap(14, 46, 54, 58, 3.8)],
  ['paper', O(14, 46, 2.4) + O(50, 46, 2.4), { o: 0 }],
  ...xf(FLAME_L, Msc(0.72, 0.72, 32, 0), Mmv(0, 4)),
]);

def('anvil', '#9aa4ae', [
  ...ANVIL_L,
  ['orange', spark(46, 10, 4.6) + spark(54, 4, 3) + spark(38, 6, 2.6), { o: 0, hi: 0 }],
]);

def('cauldron', '#7de34a', [
  ['base', O(32, 20, 22), { fx: 1, a: 0.5 }],
  ['steel', P(13, 50, 21, 53, 17, 61, 11, 61) + P(51, 50, 43, 53, 47, 61, 53, 61)],
  ['steel', 'M7 27L57 27C59 40 55 52 44 56L20 56C9 52 5 40 7 27Z'],
  ['base', E(32, 25.6, 22.6, 4.2), { o: 0 }],
  ['steel', E(32, 25.6, 26, 6.6) + E(32, 25.6, 22.6, 4.2), { eo: 1 }],
  ['light', O(24, 18, 3.6)],
  ['light', O(37, 12, 2.8)],
  ['light', O(42, 20, 2.2)],
]);

def('cooking_pot', '#d07a3a', [
  ['white', 'M22 13C18 9 26 5 22 -1M32 11C28 7 36 3 32 -3M42 13C38 9 46 5 42 -1', { l: 2, o: 0, a: 0.6 }],
  ['base', cap(3.6, 33, 12, 33, 2.6) + cap(52, 33, 60.4, 33, 2.6)],
  ['base', R(10, 27, 44, 28, 7)],
  ['dark', R(10, 44, 44, 3.4, 0), { o: 0, hi: 0, a: 0.4 }],
  ['light', 'M8 28C10 20 20 16 32 16C44 16 54 20 56 28Z'],
  ['gold', R(28.6, 11.4, 6.8, 5.6, 2), { g: 1 }],
]);

def('ruby_ring', '#e0283a', [
  ['gold', E(32, 46, 22, 13) + E(32, 47.6, 16, 8), { eo: 1 }],
  ['gold', P(19, 30, 45, 30, 40, 39, 24, 39)],
  ['gold', E(32, 24, 15.6, 12.6), { g: 1 }],
  ['base', E(32, 23.4, 12, 9.4), { g: 1 }],
  ['light', E(32, 21.4, 6.6, 4.2), { o: 0, hi: 0, a: 0.5 }],
  ['gold', O(19.6, 16.4, 2) + O(44.4, 16.4, 2) + O(19.6, 31, 2) + O(44.4, 31, 2)],
  ['white', spark(27, 19, 3.6), { o: 0, hi: 0 }],
], { rot: -12 });

def('sparkles', ['#fff6c0', '#ffd23a'], [
  ['base', O(34, 28, 28), { fx: 1, a: 0.45 }],
  ['base', spark(36, 26, 24, 0.22)],
  ['base', spark(15, 46, 12, 0.24)],
  ['base', spark(49, 51, 8.6, 0.26)],
  ['white', O(36, 26, 3), { o: 0, hi: 0 }],
]);

def('arrow_up', ['#8cf57a', '#1d9a2a'], [['base', sym('M32 4L57 31L43 31L43 60L32 60')]]);

def('skull_crown', '#ece0c4', [
  ['red', O(32, 40, 26), { fx: 1, a: 0.45 }],
  ...xf(SKULL_L, Msc(0.78, 0.78, 32, 66)),
  ['red', O(24.67, 37.14, 2.4) + O(39.33, 37.14, 2.4), { o: 0, hi: 0 }],
  ...xf(retone(lay('crown'), { base: 'gold' }), Msc(0.54, 0.54, 32, 0)),
]);

{
  let joints = '';
  for (const a of [-162, -134, -106, -74, -46, -18]) joints += segs(...apt(32, 31, 15.8, a), ...apt(32, 31, 26.4, a));
  def('dungeon', '#8a8e96', [
    ['base', sym('M32 4C46 4 58 14 58 30L58 60L32 60')],
    ['ink', joints + segs(6, 42, 16.6, 42, 47.4, 42, 58, 42, 6, 52, 16.6, 52, 47.4, 52, 58, 52), { l: 0.9, o: 0, a: 0.4 }],
    ['ink', sym('M32 15C40.6 15 47.4 21 47.4 31L47.4 60L32 60'), { o: 0, hi: 0 }],
    ['red', O(28, 40, 1.4) + O(36, 40, 1.4), { o: 0, hi: 0 }],
    ['steel', 'M20.6 23L20.6 60M26.2 17.6L26.2 60M32 15.6L32 60M37.8 17.6L37.8 60M43.4 23L43.4 60M16.6 34L47.4 34M16.6 46L47.4 46', { l: 2.2, o: 0 }],
    ['light', P(28.4, 3.4, 35.6, 3.4, 34.6, 15.6, 29.4, 15.6)],
    ['dark', R(3, 58, 58, 5, 1.4)],
  ]);
}

/* ======================================================================
 * 7. Public glyph list
 * ==================================================================== */
export const GLYPH_NAMES = Object.freeze(Object.keys(RAW).filter((n) => !n.startsWith('__')));

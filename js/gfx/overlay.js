// 2D overlay canvas: nameplates, health bars, floating combat text, quest markers,
// plus the 3D selection ring under the current target.
import * as THREE from 'three';
import { G } from '../core/state.js';
import { clamp, fmtNum } from '../core/util.js';
import { L } from '../core/i18n.js';

const _v = new THREE.Vector3();

export class Overlay {
  constructor(canvas) {
    this.cv = canvas;
    this.ctx = canvas.getContext('2d');
    this.texts = [];
    this.dpr = 1;
    this.resize();
    G.events.on('resize', () => this.resize());
    G.overlay = this;
    // selection ring
    const g = new THREE.RingGeometry(0.9, 1.05, 40).rotateX(-Math.PI / 2);
    this.ring = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: 0xff3030, transparent: true, opacity: 0.85, depthWrite: false, toneMapped: false }));
    this.ring.renderOrder = 3;
    const g2 = new THREE.CircleGeometry(0.9, 40).rotateX(-Math.PI / 2);
    this.ringFill = new THREE.Mesh(g2, new THREE.MeshBasicMaterial({ color: 0xff3030, transparent: true, opacity: 0.12, depthWrite: false, toneMapped: false }));
    this.ring.add(this.ringFill);
    G.scene.add(this.ring);
    this.hover = null;
  }
  resize() {
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.w = window.innerWidth; this.h = window.innerHeight;
    this.cv.width = this.w * this.dpr; this.cv.height = this.h * this.dpr;
    this.cv.style.width = this.w + 'px'; this.cv.style.height = this.h + 'px';
  }
  project(x, y, z) {
    _v.set(x, y, z).project(G.camera);
    if (_v.z > 1 || _v.z < -1) return null;
    return { x: (_v.x * 0.5 + 0.5) * this.w, y: (-_v.y * 0.5 + 0.5) * this.h, z: _v.z };
  }

  // floating combat text. u: unit or {x,y,z}
  text(u, str, o = {}) {
    if (G.settings && G.settings.dmgNumbers === false && !o.force) return;
    if (this.texts.length > 70) this.texts.shift();
    const isP = u === G.player;
    this.texts.push({
      u, x: u.pos ? u.pos.x : u.x, y: u.pos ? u.pos.y + (u.height || 2) + 0.2 : u.y, z: u.pos ? u.pos.z : u.z,
      str, color: o.color || '#fff', crit: !!o.crit, small: !!o.small || !!o.dot, t: 0, dur: o.dur || (o.crit ? 1.4 : 1.1),
      ox: (Math.random() - 0.5) * 40 + (isP ? -30 : 0), vy: o.big ? 30 : 55, big: o.big, heal: o.heal,
    });
  }

  update(dt) {
    const c = this.ctx, d = this.dpr;
    c.setTransform(d, 0, 0, d, 0, 0);
    c.clearRect(0, 0, this.w, this.h);
    const p = G.player;
    if (!p || G.mode !== 'game') { this.ring.visible = false; return; }
    // selection ring
    const tg = p.target;
    if (tg && !tg.removed && tg.group.visible) {
      this.ring.visible = true;
      this.ring.position.set(tg.pos.x, tg.pos.y + 0.08, tg.pos.z);
      const s = tg.radius * 1.4 + 0.4;
      this.ring.scale.set(s, 1, s);
      const col = tg.dead ? 0x888888 : p.isEnemy(tg) ? 0xff3030 : tg.kind === 'npc' ? 0xffd040 : 0x40ff70;
      this.ring.material.color.setHex(col); this.ringFill.material.color.setHex(col);
      this.ring.rotation.y += dt * 0.8;
    } else this.ring.visible = false;

    const showNames = G.settings?.nameplates !== false;
    const units = G.world?.units || [];
    c.textAlign = 'center'; c.textBaseline = 'alphabetic';
    const cam = G.camera.position;
    const plates = [];
    for (const u of units) {
      if (!u.group.visible || u === p && !u.showOwnName || u.kind === 'critter' && u !== tg) continue;
      const dx = u.pos.x - cam.x, dz = u.pos.z - cam.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      const maxD = u.kind === 'npc' ? 45 : u.isBoss ? 70 : 34;
      if (dist > maxD && u !== tg) continue;
      if (u.dead && u !== tg && !u.lootable) continue;
      const sp = this.project(u.pos.x, u.pos.y + u.height + (u.mount ? 1.1 : 0.35), u.pos.z);
      if (!sp) continue;
      plates.push({ u, sp, dist });
    }
    plates.sort((a, b) => b.dist - a.dist);
    for (const { u, sp, dist } of plates) this.drawPlate(c, u, sp, dist, u === tg, showNames);
    // floating texts
    for (let i = this.texts.length - 1; i >= 0; i--) {
      const t = this.texts[i];
      t.t += dt;
      if (t.t >= t.dur) { this.texts.splice(i, 1); continue; }
      if (t.u && t.u.pos) { t.x = t.u.pos.x; t.z = t.u.pos.z; t.y = t.u.pos.y + (t.u.height || 2) + 0.3; }
      const sp = this.project(t.x, t.y, t.z);
      if (!sp) continue;
      const k = t.t / t.dur;
      const pop = t.crit ? (t.t < 0.12 ? 1 + (0.12 - t.t) * 8 : 1) : 1;
      const size = (t.big ? 24 : t.crit ? 26 : t.small ? 14 : 18) * pop;
      c.globalAlpha = k > 0.7 ? (1 - k) / 0.3 : 1;
      c.font = `${t.crit ? 900 : 800} ${size}px "Nunito Sans", system-ui, sans-serif`;
      const x = sp.x + t.ox * (t.crit ? 0.5 : 1) * Math.min(1, t.t * 4), y = sp.y - t.t * t.vy - (t.big ? 20 : 0);
      c.lineWidth = t.crit ? 4 : 3; c.strokeStyle = 'rgba(0,0,0,0.85)';
      c.strokeText(t.str + (t.crit ? '!' : ''), x, y);
      c.fillStyle = t.color; c.fillText(t.str + (t.crit ? '!' : ''), x, y);
    }
    c.globalAlpha = 1;
  }

  drawPlate(c, u, sp, dist, targeted, showNames) {
    const p = G.player;
    const hostile = p.isEnemy(u);
    const fade = clamp(1 - (dist - 22) / 14, 0.35, 1);
    c.globalAlpha = targeted ? 1 : fade;
    let y = sp.y;
    // quest marker
    if (u.kind === 'npc') {
      const st = G.quests?.npcMarker(u);
      if (st) {
        const bob = Math.sin(G.time * 3) * 3;
        c.font = '900 30px "Cinzel", serif';
        c.lineWidth = 5; c.strokeStyle = 'rgba(30,18,0,0.9)';
        const col = st === '?' ? '#ffd23a' : st === '!' ? '#ffd23a' : st === '!b' ? '#4ab8ff' : '#9a9a9a';
        const ch = st === '!b' ? '!' : st === '?g' ? '?' : st;
        c.strokeText(ch, sp.x, y - 26 + bob); c.fillStyle = col; c.fillText(ch, sp.x, y - 26 + bob);
      }
    }
    const showHp = !u.dead && (targeted || (hostile && (u.inCombat || u.hp < u.stats.maxHp)) || (u.inParty && u !== p) || u.isBoss);
    if (showHp && u.kind !== 'npc') {
      const w = u.isBoss ? 110 : u.elite ? 78 : 62, h = u.isBoss ? 8 : 6;
      const x = sp.x - w / 2;
      c.fillStyle = 'rgba(0,0,0,0.7)'; c.fillRect(x - 1, y - 1, w + 2, h + 2);
      const pct = clamp(u.hp / u.stats.maxHp, 0, 1);
      c.fillStyle = hostile ? (u.isBoss ? '#c8202a' : '#d8342c') : '#3ac85a';
      c.fillRect(x, y, w * pct, h);
      if (u.absorb > 0) { c.fillStyle = 'rgba(220,230,255,0.7)'; c.fillRect(x + w * pct, y, Math.min(w * (1 - pct), w * u.absorb / u.stats.maxHp), h); }
      c.fillStyle = 'rgba(255,255,255,0.18)'; c.fillRect(x, y, w * pct, h / 2);
      if (u.cast && hostile) {
        const cp = clamp(u.cast.t / u.cast.dur, 0, 1);
        c.fillStyle = 'rgba(0,0,0,0.7)'; c.fillRect(x - 1, y + h + 2, w + 2, 5);
        c.fillStyle = '#ffb02a'; c.fillRect(x, y + h + 3, w * cp, 3);
      }
      y -= 6;
    }
    if (!showNames && !targeted) { c.globalAlpha = 1; return; }
    // name
    let col = '#fff';
    if (u.kind === 'npc') col = '#ffe08a';
    else if (u.kind === 'monster') col = u.dead ? '#999' : (u.passive && !u.inCombat ? '#ffd84a' : '#ff6a5a');
    else if (u.kind === 'bot' || u.kind === 'remote') col = u.inParty ? '#7affb0' : '#7ac8ff';
    else if (u.kind === 'pet') col = '#a8ffb8';
    const sz = u.isBoss ? 16 : 13;
    c.font = `800 ${sz}px "Nunito Sans", system-ui, sans-serif`;
    let name = u.name;
    if (u.kind === 'monster' && !u.dead) name = (u.elite ? '★ ' : '') + u.name + '  ' + (u.level > p.level + 9 ? '??' : u.level);
    if ((u.kind === 'bot' || u.kind === 'remote') && u.guildTag) name = u.name + ' <' + u.guildTag + '>';
    c.lineWidth = 3; c.strokeStyle = 'rgba(0,0,0,0.85)';
    c.strokeText(name, sp.x, y - 4); c.fillStyle = col; c.fillText(name, sp.x, y - 4);
    if (u.title && (u.kind === 'npc' || u.kind === 'bot')) {
      c.font = `600 11px "Nunito Sans", system-ui, sans-serif`;
      c.strokeText('<' + u.title + '>', sp.x, y + 9); c.fillStyle = u.kind === 'npc' ? '#d8c8a0' : '#a8c8e8'; c.fillText('<' + u.title + '>', sp.x, y + 9);
    }
    if (u.chatBubble && u.chatBubble.t > G.time) this.bubble(c, sp.x, y - 22, u.chatBubble.text);
    c.globalAlpha = 1;
  }
  bubble(c, x, y, text) {
    c.font = '600 12px "Nunito Sans", system-ui, sans-serif';
    const words = text.split(' '); const lines = []; let cur = '';
    for (const w of words) { if (c.measureText(cur + ' ' + w).width > 170 && cur) { lines.push(cur); cur = w; } else cur = cur ? cur + ' ' + w : w; }
    if (cur) lines.push(cur);
    const lh = 15, h = lines.length * lh + 10;
    const w = Math.max(...lines.map(l => c.measureText(l).width)) + 16;
    c.fillStyle = 'rgba(255,252,240,0.94)'; c.strokeStyle = 'rgba(60,40,20,0.6)'; c.lineWidth = 1;
    c.beginPath(); c.roundRect(x - w / 2, y - h, w, h, 7); c.fill(); c.stroke();
    c.beginPath(); c.moveTo(x - 5, y); c.lineTo(x + 5, y); c.lineTo(x, y + 6); c.fill();
    c.fillStyle = '#2a2018'; c.textAlign = 'center';
    lines.forEach((l, i) => c.fillText(l, x, y - h + 17 + i * lh));
  }
}

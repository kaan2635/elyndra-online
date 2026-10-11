// Serverless multiplayer presence over WebRTC (Trystero + Nostr signalling).
// Real players in the same zone see each other move, chat and emote.
import { G, on, emit } from '../core/state.js';
import { L } from '../core/i18n.js';
import { clamp, dampAngle, lerp } from '../core/util.js';
import { Unit } from '../game/unit.js';
import { appearanceSpec } from '../game/hero.js';
import { CLASSES } from '../data/classes.js';

const RELAYS = ['wss://relay.damus.io', 'wss://nos.lol', 'wss://relay.primal.net', 'wss://relay.nostr.band', 'wss://nostr.mom'];
const APP_ID = 'elyndra-online-v1';
let trystero = null;

export const Net = {
  status: 'off', room: null, roomName: null, peers: new Map(), sendT: 0, actions: null,
  statusText() { return { off: L('Kapalı|Off'), connecting: L('Bağlanıyor…|Connecting…'), connected: L('Bağlı|Connected'), error: L('Bağlanamadı|Unavailable') }[this.status] || this.status; },
  peerCount() { return this.peers.size; },
  async load() {
    if (trystero) return trystero;
    trystero = await import('../../lib/trystero-nostr.min.js');
    return trystero;
  },
  setEnabled(v) { if (!v) this.leave(); else this.join(); },
  async join() {
    if (!G.settings.online || G.mode !== 'game' || !G.zones.current) return;
    const zid = G.zones.current.id;
    if (zid.startsWith('dun:') || zid.startsWith('inst:')) { this.leave(); return; }
    const name = 'zone-' + zid;
    if (this.roomName === name) return;
    this.leave();
    this.status = 'connecting';
    try {
      const T = await this.load();
      // well-established public relays only (the library's rotating default list includes dead ones)
      const room = T.joinRoom({ appId: APP_ID, relayConfig: { urls: RELAYS, warnOnRelayFailure: false } }, name);
      this.room = room; this.roomName = name;
      // Trystero >=0.26: actions are objects with send(data, {target}) and an onMessage property
      const act = id => {
        const a = room.makeAction(id);
        if (Array.isArray(a)) return { send: (d, target) => a[0](d, target), on: fn => a[1](fn) };
        return { send: (d, target) => a.send(d, target ? { target } : undefined), on: fn => { a.onMessage = (d, meta) => fn(d, meta?.peerId ?? meta); } };
      };
      const st = act('st'), hi = act('hi'), chA = act('ch'), em = act('em');
      this.actions = { sendSt: d => st.send(d), sendHi: (d, id) => hi.send(d, id), sendCh: d => chA.send(d), sendEm: d => em.send(d) };
      const onJoin = id => { this.status = 'connected'; this.actions?.sendHi(this.hello(), id); };
      const onLeave = id => this.drop(id);
      if (typeof room.onPeerJoin === 'function') { room.onPeerJoin(onJoin); room.onPeerLeave(onLeave); }
      else { room.onPeerJoin = onJoin; room.onPeerLeave = onLeave; }
      hi.on((d, id) => this.onHello(d, id));
      st.on((d, id) => this.onState(d, id));
      chA.on((d, id) => { const p = this.peers.get(id); if (!p || typeof d?.t !== 'string') return; const txt = d.t.slice(0, 160); G.chat.post(p.name, txt, d.c === 'say' ? 'say' : 'online', p.unit); });
      em.on((d, id) => { const p = this.peers.get(id); if (p?.unit && typeof d?.e === 'string') p.unit.anim.emote = { type: d.e, t: 0, dur: 4 }; });
      setTimeout(() => { if (this.status === 'connecting') this.status = 'connected'; }, 4000);
    } catch (e) {
      console.warn('p2p unavailable', e);
      this.status = 'error';
    }
  },
  leave() {
    for (const id of [...this.peers.keys()]) this.drop(id);
    try { this.room?.leave(); } catch (e) { }
    this.room = null; this.roomName = null; this.actions = null;
    this.status = G.settings?.online ? 'off' : 'off';
  },
  hello() {
    const ch = G.char, u = G.player;
    return { n: ch.name.slice(0, 16), c: ch.cls, r: ch.race, l: ch.level, spec: appearanceSpec(ch, u), g: G.account.guild?.tag || null, v: 1 };
  },
  onHello(d, id) {
    if (!d || typeof d.n !== 'string' || !CLASSES[d.c]) return;
    let p = this.peers.get(id);
    if (!p) { p = { id }; this.peers.set(id, p); G.chat.system(L(`${d.n} bu bölgeye geldi (çevrimiçi oyuncu).|${d.n} arrived in this zone (online player).`), 'online'); }
    p.name = d.n.replace(/[<>]/g, ''); p.cls = d.c; p.level = clamp(d.l | 0, 1, 60);
    if (!p.unit) {
      const u = new Unit({ kind: 'remote', name: p.name, level: p.level, x: G.player.pos.x, z: G.player.pos.z, team: 'remote' });
      u.cls = d.c; u.race = d.r; u.base = { hp: 1000, dmg: 0, armor: 0 }; u.recalc(); u.hp = u.stats.maxHp;
      u.guildTag = d.g; u.speed = 7; u.alwaysUpdate = true;
      try { u.setModel(sanitizeSpec(d.spec)); } catch (e) { u.setModel({ rig: 'humanoid', race: 'human' }); }
      u.ai = { update: dt => this.drive(u, p, dt), onDamaged() { } };
      p.unit = u;
      G.world.addUnit(u);
    }
    if (this.actions) this.actions.sendHi(this.hello(), id); // reply so both sides know each other
  },
  onState(d, id) {
    const p = this.peers.get(id); if (!p || !p.unit || !d) return;
    if (!Number.isFinite(d.x) || !Number.isFinite(d.z)) return;
    p.tx = d.x; p.tz = d.z; p.ty = d.y; p.mv = d.m; p.dead = !!d.d; p.mount = d.mt; p.act = d.a; p.lastT = performance.now();
    if (d.l) p.unit.level = clamp(d.l | 0, 1, 60);
  },
  drive(u, p, dt) {
    if (p.tx == null) return;
    const dx = p.tx - u.pos.x, dz = p.tz - u.pos.z, d = Math.hypot(dx, dz);
    if (d > 40) { u.pos.x = p.tx; u.pos.z = p.tz; }
    else { const k = 1 - Math.exp(-8 * dt); u.pos.x += dx * k; u.pos.z += dz * k; }
    u.yaw = dampAngle(u.yaw, p.ty ?? u.yaw, 10, dt);
    u.anim.move = d > 0.15 ? Math.min(1.6, p.mv || 1) : 0; u.anim.run = u.anim.move > 0.8;
    u.anim.phase += dt * 10 * u.anim.move;
    u.dead = false; u.anim.dead = p.dead ? 1 : 0;
    if (p.act && p.act !== p._lastAct) { p._lastAct = p.act; u.playAct(p.act.split(':')[0], 0.5); }
    if (performance.now() - (p.lastT || 0) > 15000) this.drop(p.id);
  },
  drop(id) {
    const p = this.peers.get(id); if (!p) return;
    if (p.unit) G.world.removeUnit(p.unit);
    this.peers.delete(id);
  },
  update(dt) {
    if (!this.actions || G.mode !== 'game') return;
    this.sendT -= dt;
    if (this.sendT > 0) return;
    this.sendT = 0.25;
    const u = G.player;
    const act = u.anim.act ? u.anim.act.type + ':' + Math.floor(G.time * 2) : null;
    try { this.actions.sendSt({ x: Math.round(u.pos.x * 10) / 10, z: Math.round(u.pos.z * 10) / 10, y: Math.round(u.yaw * 100) / 100, m: Math.round(u.anim.move * 10) / 10, d: u.dead ? 1 : 0, l: u.level, a: act }); } catch (e) { }
  },
  chat(text, ch) { if (this.actions && (ch === 'world' || ch === 'say' || ch === 'zone')) try { this.actions.sendCh({ t: text.slice(0, 160), c: ch }); } catch (e) { } },
  emote(e) { if (this.actions) try { this.actions.sendEm({ e }); } catch (er) { } },
  whisper(u, text) { this.chat(text, 'say'); },
};

// only allow known model fields from peers
function sanitizeSpec(s) {
  if (!s || typeof s !== 'object') return { rig: 'humanoid', race: 'human' };
  const num = v => (Number.isFinite(v) ? v : undefined);
  const gear = {};
  for (const k of ['head', 'shoulders', 'chest', 'hands', 'legs', 'feet', 'cape', 'main', 'off']) {
    const g = s.gear?.[k]; if (!g || typeof g !== 'object') continue;
    gear[k] = { m: typeof g.m === 'string' ? g.m.slice(0, 12) : undefined, c: num(g.c), c2: num(g.c2), c3: num(g.c3), glow: num(g.glow), shape: g.shape === 'kite' ? 'kite' : undefined };
  }
  return { rig: 'humanoid', race: ['human', 'elf', 'dwarf', 'orc'].includes(s.race) ? s.race : 'human', body: s.body ? 1 : 0, skin: num(s.skin), hair: clamp(num(s.hair) || 0, 0, 7), hairColor: num(s.hairColor), beard: clamp(num(s.beard) || 0, 0, 3), eyes: num(s.eyes), gear };
}

G.net = Net;
G.addSystem(dt => Net.update(dt));
on('zoneEntered', () => { setTimeout(() => Net.join(), 600); });
on('sessionEnd', () => Net.leave());

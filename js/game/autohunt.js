// Auto-hunt ("Oto Av"): hunts monsters inside a chosen area, keeps buffs and pets up, drinks potions,
// rests between fights, walks to the zone merchant to sell junk / restock potions, revives after death
// and reports per-hour statistics. Settings are saved per character.
import { G, emit, on } from '../core/state.js';
import { L } from '../core/i18n.js';
import { dist2, fmtNum, fmtTime } from '../core/util.js';
import { SKILLS, CLASS_SKILLS } from '../data/skills.js';
import { CLASSES } from '../data/classes.js';
import { ITEMS } from '../data/items.js';
import { useSkill, skillCost, skillRange } from './skillsys.js';
import { countItem, freeSlots, addItem, makeStack, sellValue } from './items.js';
import { findPath } from './path.js';
import { UI, h, icon, uiIcon, skillIcon } from '../ui/ui.js';
import { Audio } from '../audio.js';

// how the bot uses each skill; anything not listed that targets an enemy / the ground is an attack
const ROLE = {
  w_shout: 'cbuff', m_shield: 'buff', c_shield: 'buff', c_blessing: 'buff', g_poison: 'buff', n_bonearmor: 'buff',
  r_wolf: 'pet', n_skeleton: 'pet',
  c_heal: 'heal', c_divine: 'heal', c_renew: 'hot',
  w_wall: 'save', g_evasion: 'save',
  w_avatar: 'ult', m_timewarp: 'ult', r_rapid: 'ult', c_ascend: 'ult', g_flurry: 'ult', n_lich: 'ult',
  w_whirl: 'aoe', w_slam: 'aoe', m_nova: 'aoe', c_nova: 'aoe', g_fan: 'aoe', n_harvest: 'aoe',
  m_blink: 'skip', r_disengage: 'skip', g_stealth: 'skip', n_fear: 'skip',
};
const BUFF_ID = { w_shout: 'warcry', m_shield: 'manashield', c_shield: 'holyshield', c_blessing: 'blessing', g_poison: 'poisonblades', n_bonearmor: 'bonearmor', c_renew: 'renew' };
const RARITY = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'];
const roleOf = id => ROLE[id] || (SKILLS[id].target === 'enemy' || SKILLS[id].target === 'ground' ? 'atk' : 'skip');
const ROLE_NAME = { atk: 'Saldırı|Attack', aoe: 'Alan|Area', buff: 'Güçlendirme|Buff', cbuff: 'Savaş güçlendirmesi|Combat buff', pet: 'Yoldaş|Companion', heal: 'İyileştirme|Heal', hot: 'İyileştirme|Heal', save: 'Acil durum|Emergency', ult: 'Nihai|Ultimate', skip: 'Kullanılmaz|Not used' };

const DEFAULTS = {
  r: 30, order: [], off: {}, ult: 'elite',
  hpPct: 50, mpPct: 30, healPct: 65, savePct: 35,
  rest: true, restHp: 60, restMp: 40, eat: true,
  prio: 'near', avoid: { elite: true, rare: false, boss: true }, maxAbove: 4, skipGray: true, noKS: true, ignore: {},
  town: true, potBelow: 3, buyHp: 20, buyMp: 20, freeBelow: 2, sellJunk: true, sellGear: 'uncommon', mount: true,
  onDeath: 'continue', stopLevel: 0, stopMin: 0,
};
const STATE_NAME = { flee: 'Geri çekiliyor|Retreating', hunt: 'Avlanıyor|Hunting', fight: 'Savaşıyor|Fighting', rest: 'Dinleniyor|Resting', toTown: 'Kasabaya gidiyor|Going to town', back: 'Av alanına dönüyor|Returning to area', dead: 'Öldü — diriliyor|Died — reviving', off: 'Kapalı|Off' };

export const AutoHunt = {
  on: false, state: 'off', cfg: null, area: null, st: null, bestTime: 0,
  tickT: 0, path: null, dest: null, black: new Map(), fail: {},

  // ------------------------------------------------------------ settings
  key() { return 'elyndra.autohunt.' + (G.char?.id || G.char?.name || 'x'); },
  load() {
    let c = {};
    try { c = JSON.parse(localStorage.getItem(this.key()) || '{}'); } catch (e) { c = {}; }
    this.cfg = { ...structuredClone(DEFAULTS), ...c, avoid: { ...DEFAULTS.avoid, ...(c.avoid || {}) } };
    this.cfgFor = G.char?.id;
    this.syncSkills();
    return this.cfg;
  },
  save() { try { localStorage.setItem(this.key(), JSON.stringify(this.cfg)); } catch (e) { /* storage unavailable */ } },
  get c() { if (!this.cfg || this.cfgFor !== G.char?.id) this.load(); return this.cfg; },
  // every learned class skill gets a place in the priority order (bar order first)
  syncSkills() {
    const p = G.player, ch = G.char; if (!ch) return;
    const known = (CLASS_SKILLS[ch.cls] || []).filter(id => SKILLS[id] && SKILLS[id].lvl <= ch.level);
    const order = this.cfg.order.filter(id => known.includes(id));
    const barFirst = [...new Set([...(ch.bar || []).filter(id => known.includes(id)), ...known])];
    // cooldown skills go before spammable fillers (Heavy Strike, Fireball…), otherwise they would never fire
    for (const id of barFirst) {
      if (order.includes(id)) continue;
      const filler = order.findIndex(x => !SKILLS[x].cd);
      if (SKILLS[id].cd && filler >= 0) order.splice(filler, 0, id); else order.push(id);
    }
    this.cfg.order = order;
    if (p) for (const id of order) if (roleOf(id) === 'skip' && this.cfg.off[id] === undefined) this.cfg.off[id] = true;
  },
  skillOn(id) { return !this.c.off[id]; },

  // ------------------------------------------------------------ control
  toggle(force) {
    const want = force ?? !this.on;
    if (want) this.start(); else this.stop();
  },
  start() {
    const p = G.player;
    if (!p || G.mode !== 'game') return;
    if (p.dead) { G.ui.error(L('Önce dirilmelisin|Revive first')); return; }
    this.c; this.syncSkills();
    if (!this.area || this.area.zone !== G.zones.current?.id) this.setArea(true);
    this.on = true; this.state = 'hunt'; this.tickT = 0; this.path = null; this.black.clear(); this.fail = {};
    this.lastTrip = -999; this.stuck = { x: p.pos.x, z: p.pos.z, t: 0 };
    this.st = { t: 0, kills: 0, xp: 0, gold: 0, items: 0, deaths: 0, trips: 0, sold: 0, spent: 0, lvl0: p.level };
    G.playerCtl.autoRun = false;
    G.ui.toast('autohunt', L('Oto av başladı|Auto-hunt started'), '#8affb0');
    Audio.sfx('ui_open', { vol: 0.5 });
    emit('autohunt', true);
  },
  stop(reason) {
    if (!this.on) return;
    this.on = false; this.state = 'off'; this.path = null;
    const pc = G.playerCtl; if (pc) { pc.moveTarget = null; pc.pending = null; }
    G.ui?.toast('autohunt', reason || L('Oto av durduruldu|Auto-hunt stopped'), '#ffcf6a');
    emit('autohunt', false);
  },
  setArea(silent) {
    const p = G.player; if (!p) return;
    this.area = { x: p.pos.x, z: p.pos.z, zone: G.zones.current?.id, dungeon: !!G.world.dungeon };
    if (!silent) { G.ui.toast('map_marker', L('Av alanı buraya ayarlandı|Hunting area set here'), '#8ad8ff'); G.vfx?.ring({ x: p.pos.x, y: G.world.groundAt(p.pos.x, p.pos.z), z: p.pos.z }, this.c.r, 0x8affb0, 1.2); }
    emit('autohunt');
  },
  get stateName() { return L(STATE_NAME[this.state] || STATE_NAME.off); },

  // ------------------------------------------------------------ helpers
  attackers() {
    const p = G.player, out = [];
    for (const m of G.world.units) {
      if (m.dead || m.removed || m.kind !== 'monster' || !p.isEnemy(m)) continue;
      if (m.target === p || m.target?.owner === p || m.threat?.has?.(p)) { if (m.ai?.state !== 'return' && p.distTo(m) < 45) out.push(m); }
    }
    return out;
  },
  valid(m, attacking) {
    const p = G.player, c = this.c;
    if (!m || m.dead || m.removed || m.kind !== 'monster' || !p.isEnemy(m)) return false;
    if (m.data?.tpl?.critter || m.ai?.state === 'return') return false;
    if (attacking) return true;
    if ((this.black.get(m) || 0) > G.time) return false;
    if ((m.isBoss && c.avoid.boss) || (m.elite && c.avoid.elite) || (m.rare && c.avoid.rare)) return false;
    if (m.level > p.level + c.maxAbove) return false;
    if (c.skipGray && m.level < p.level - 8) return false;
    if (c.ignore[m.tplId]) return false;
    if (c.noKS && m.threat?.size && ![...m.threat.keys()].some(k => k === p || k.owner === p || G.party?.has?.(k))) return false;
    const a = this.area;
    if (a && dist2(m.pos.x, m.pos.z, a.x, a.z) > c.r) return false;
    return true;
  },
  pickTarget() {
    const p = G.player, c = this.c;
    const att = this.attackers().filter(m => this.valid(m, true));
    if (att.length) return att.sort((a, b) => a.hp - b.hp)[0];
    let best = null, bs = Infinity;
    for (const m of G.world.units) {
      if (!this.valid(m)) continue;
      const d = p.distTo(m);
      const s = c.prio === 'weak' ? m.level * 100 + d : c.prio === 'strong' ? -m.level * 100 + d : d;
      if (s < bs) { bs = s; best = m; }
    }
    return best;
  },
  enemiesNear(r) { const p = G.player; let n = 0; for (const m of G.world.units) if (!m.dead && m.kind === 'monster' && p.isEnemy(m) && p.distTo(m) <= r) n++; return n; },
  potion(kind) {
    const p = G.player;
    for (const id of kind === 'hp' ? ['hp4', 'hp3', 'hp2', 'hp1'] : ['mp4', 'mp3', 'mp2', 'mp1']) if (countItem(G.char, id) > 0 && (ITEMS[id].lvl || 1) <= p.level + 5) return id;
    for (const id of kind === 'hp' ? ['hp1', 'hp2', 'hp3', 'hp4'] : ['mp1', 'mp2', 'mp3', 'mp4']) if (countItem(G.char, id) > 0) return id;
    return null;
  },
  potCount(kind) { let n = 0; for (let i = 1; i <= 4; i++) n += countItem(G.char, kind + i); return n; },
  usesMana() { return G.player.resType === 'mana'; },
  hpPct() { const p = G.player; return p.hp / p.stats.maxHp * 100; },
  mpPct() { const p = G.player; return p.res / Math.max(1, p.stats.maxRes) * 100; },

  // can this skill be used right now on tgt? (no error toasts)
  ready(id, tgt) {
    const p = G.player, sk = SKILLS[id];
    if (!sk || sk.lvl > p.level || !this.skillOn(id)) return false;
    if ((this.fail[id] || 0) > G.time) return false;
    if (p.cds[id] > 0 || (sk.gcd !== false && p.gcd > 0)) return false;
    if (p.cast && !(sk.gcd === false && !sk.cast)) return false;
    if (p.res < skillCost(p, sk) - 0.01) return false;
    if (sk.finisher && (p.combo || 0) < 3 && !(tgt && tgt.hp / tgt.stats.maxHp < 0.25)) return false;
    try { if (sk.can && sk.can(p, tgt || p)) return false; } catch (e) { return false; }
    if (tgt && sk.target === 'enemy') { const d = p.edgeDist(tgt); if (d > skillRange(p, sk) + 0.2 || (sk.minRange && d < sk.minRange)) return false; }
    if (tgt && sk.target === 'ground' && p.distTo(tgt) > skillRange(p, sk) + 1) return false;
    return true;
  },
  cast(id, tgt) {
    const p = G.player, pc = G.playerCtl;
    if (p.sitting) pc.stand();
    const err = useSkill(p, id, tgt ? { target: tgt } : {});
    if (err) { this.fail[id] = G.time + 2.5; return false; }
    return true;
  },

  // ------------------------------------------------------------ movement
  goTo(x, z, stop = 2, mount = false, force = false) {
    const p = G.player;
    const d = dist2(p.pos.x, p.pos.z, x, z);
    let pts = null;
    if (d > 16 || force) { try { pts = findPath(p.pos.x, p.pos.z, x, z); } catch (e) { pts = null; } }
    this.path = pts && pts.length ? pts : [{ x, z }];
    this.pi = 0; this.dest = { x, z, stop };
    if (mount && this.c.mount && d > 40) G.mounts?.autoMount();
  },
  follow() {
    const p = G.player, pc = G.playerCtl;
    if (!this.path) return true;
    if (dist2(p.pos.x, p.pos.z, this.dest.x, this.dest.z) <= this.dest.stop) { this.path = null; pc.moveTarget = null; return true; }
    let pt = this.path[this.pi];
    while (pt && this.pi < this.path.length - 1 && dist2(p.pos.x, p.pos.z, pt.x, pt.z) < 1.8) pt = this.path[++this.pi];
    if (!pt) { this.path = null; return true; }
    const last = this.pi === this.path.length - 1;
    pc.moveTarget = { x: pt.x, z: pt.z, stop: last ? Math.max(0.4, this.dest.stop * 0.7) : 1 };
    pc.pending = null;
    return false;
  },

  // ------------------------------------------------------------ main loop
  update(dt) {
    if (!this.on) return;
    const p = G.player, pc = G.playerCtl;
    if (!p || !pc || G.mode !== 'game') { this.on = false; this.state = 'off'; return; }
    this.st.t += dt;
    // the player taking the controls stops the bot
    const mi = G.input?.enabled && !UI.chatFocused ? G.input.moveIntent() : null;
    if ((mi && mi.m > 0.05) || pc.autoRun) { this.stop(L('Elle hareket ettin — oto av durdu|You moved manually — auto-hunt stopped')); return; }
    if (p.dead) {
      if (this.state !== 'dead') { this.state = 'dead'; this.deadT = 4; this.path = null; }
      this.deadT -= dt;
      if (this.deadT <= 0) {
        if (this.c.onDeath === 'stop') { this.stop(L('Öldün — oto av durdu|You died — auto-hunt stopped')); return; }
        G.respawn?.(); this.state = 'back'; this.path = null;
      }
      return;
    }
    // stop conditions
    const c = this.c;
    if (c.stopLevel > 0 && p.level >= c.stopLevel) { this.stop(L(`Seviye ${c.stopLevel} oldu — oto av tamamlandı|Reached level ${c.stopLevel} — auto-hunt finished`)); return; }
    if (c.stopMin > 0 && this.st.t >= c.stopMin * 60) { this.stop(L('Süre doldu — oto av tamamlandı|Time is up — auto-hunt finished')); return; }
    // path following runs every frame for smooth movement
    if (this.path) this.follow();
    this.tickT -= dt;
    if (this.tickT > 0) return;
    this.tickT = 0.2;
    this.checkStuck(0.2);
    this.protect();
    switch (this.state) {
      case 'rest': return this.doRest();
      case 'toTown': return this.doToTown();
      case 'back': return this.doBack();
      case 'flee': return this.doFlee();
      default: return this.doHunt();
    }
  },
  checkStuck(dt) {
    const p = G.player, s = this.stuck, pc = G.playerCtl;
    const wants = !!(pc.moveTarget || pc.pending || (p.autoAttack && p.target && !CLASSES[p.cls].ranged && p.edgeDist(p.target) > 3 && !p.cast));
    if (!wants || p.cast || p.sitting) { s.x = p.pos.x; s.z = p.pos.z; s.t = 0; return; }
    s.t += dt;
    if (s.t < 2.5) return;
    const moved = dist2(p.pos.x, p.pos.z, s.x, s.z);
    s.x = p.pos.x; s.z = p.pos.z; s.t = 0;
    if (moved > 1) return;
    // stuck chasing a target behind an obstacle: walk around it with A*, give up after repeated failures
    const tg = p.target;
    if (tg && tg.kind === 'monster' && !tg.dead) {
      this.stuckN = (this.stuckTarget === tg ? this.stuckN : 0) + 1; this.stuckTarget = tg;
      if (this.stuckN <= 3) { this.chase = G.time + 5; pc.pending = null; this.goTo(tg.pos.x, tg.pos.z, 2, false, true); return; }
      this.black.set(tg, G.time + 60); pc.setTarget(null); pc.pending = null; this.chase = 0;
      if (this.attackers().includes(tg)) { this.path = null; this.goTo(this.area.x, this.area.z, 3, false, true); }
      return;
    }
    if (this.path) { if (this.pi < this.path.length - 1) this.pi++; else this.path = null; }
    pc.moveTarget = null;
  },
  // potions, heals and emergency skills — run in every state
  protect() {
    const p = G.player, c = this.c;
    const hp = this.hpPct();
    const inFight = p.inCombat || this.attackers().length > 0;
    if (inFight && hp < c.savePct) for (const id of c.order) if (roleOf(id) === 'save' && this.ready(id)) { this.cast(id); break; }
    if (hp < c.hpPct && G.inv.potionCd <= 0) { const id = this.potion('hp'); if (id) { G.inv.useItemId(id); return; } }
    if (this.usesMana() && this.mpPct() < c.mpPct && G.inv.potionCd <= 0 && inFight) { const id = this.potion('mp'); if (id) { G.inv.useItemId(id); return; } }
    if (hp < c.healPct && !p.cast) {
      for (const id of c.order) {
        const r = roleOf(id);
        if (r === 'hot' && p.hasBuff(BUFF_ID[id])) continue;
        if ((r === 'heal' || r === 'hot') && this.ready(id, p)) { this.cast(id, p); return; }
      }
    }
  },
  // losing badly with no potion left → run away from the attackers (they give up past their leash)
  shouldFlee(att) {
    const c = this.c;
    if (!att.length || this.hpPct() > Math.min(30, c.savePct)) return false;
    if (G.inv.potionCd <= 0 && this.potion('hp')) return false;
    const strong = att.some(m => m.isBoss || m.elite || m.rare || m.level > G.player.level + 2);
    return strong || att.length >= 3;
  },
  doFlee() {
    const p = G.player, att = this.attackers();
    if (!att.length || G.time > this.fleeUntil) { this.state = 'hunt'; this.path = null; return; }
    if (!this.path) {
      let cx = 0, cz = 0; for (const m of att) { cx += m.pos.x; cz += m.pos.z; } cx /= att.length; cz /= att.length;
      let dx = p.pos.x - cx, dz = p.pos.z - cz; const d = Math.hypot(dx, dz) || 1; dx /= d; dz /= d;
      this.goTo(p.pos.x + dx * 55, p.pos.z + dz * 55, 3);
      G.playerCtl.setTarget(null); p.autoAttack = false;
    }
    // block anything that chased us down from being picked again soon
    for (const m of att) if (m.elite || m.rare || m.isBoss) this.black.set(m, G.time + 120);
  },
  needTown() {
    const c = this.c, ch = G.char;
    if (!c.town || G.world.dungeon || !this.merchant()) return false;
    const since = G.time - this.lastTrip;
    if (since > 60 && freeSlots(ch) < c.freeBelow && this.sellList().length) return 'bag';
    if (since < 180) return false;
    // only worth the walk if we can afford a decent restock
    const canBuy = (kind, want) => { const id = this.buyId(kind); return ch.gold >= Math.max(1, Math.round((ITEMS[id].value || 1) * 4)) * Math.max(5, (want - this.potCount(kind)) / 2); };
    if (c.buyHp > 0 && this.potCount('hp') < c.potBelow && canBuy('hp', c.buyHp)) return 'pots';
    if (this.usesMana() && c.buyMp > 0 && this.potCount('mp') < c.potBelow && canBuy('mp', c.buyMp)) return 'pots';
    return false;
  },
  merchant() {
    let best = null, bd = Infinity;
    const p = G.player;
    for (const u of G.world.units) {
      if (u.kind !== 'npc' || !u.npc?.shop) continue;
      const rank = u.npc.shop === 'general' ? 0 : u.npc.shop === 'alchemy' ? 1 : u.npc.shop === 'inn' ? 2 : 9;
      if (rank > 2) continue;
      const d = rank * 1000 + p.distTo(u);
      if (d < bd) { bd = d; best = u; }
    }
    return best;
  },
  buyId(kind) { const lvl = G.player.level; let id = kind + '1'; for (let i = 1; i <= 4; i++) if ((ITEMS[kind + i].lvl || 1) <= lvl) id = kind + i; return id; },
  sellList() {
    const c = this.c, ch = G.char, maxR = RARITY.indexOf(c.sellGear);
    return ch.bag.filter(it => it && (it.id ? (c.sellJunk && ITEMS[it.id]?.type === 'junk') : (maxR >= 0 && RARITY.indexOf(it.rarity) <= maxR && !it.locked)));
  },

  // ------------------------------------------------------------ states
  doHunt() {
    const p = G.player, pc = G.playerCtl, c = this.c;
    const attackers = this.attackers();
    // keep the current fight going
    if (this.shouldFlee(attackers)) { this.state = 'flee'; this.fleeUntil = G.time + 12; this.path = null; G.ui.toast('sprint', L('Oto av: can kritik, geri çekiliyor!|Auto-hunt: health critical, retreating!'), '#ff8a6a'); return this.doFlee(); }
    let t = p.target && this.valid(p.target, attackers.includes(p.target)) ? p.target : null;
    if (!attackers.length && !t) {
      const need = this.needTown();
      if (need) { this.state = 'toTown'; this.path = null; this.townWhy = need; return; }
      if (c.rest && (this.hpPct() < c.restHp || (this.usesMana() && this.mpPct() < c.restMp))) { this.state = 'rest'; this.path = null; pc.moveTarget = null; return; }
      if (this.buffs(false)) return;
    }
    if (!t) t = this.pickTarget();
    if (!t) {
      this.state = 'hunt';
      this.idleT = (this.idleT || 0) + 0.2;
      if (this.idleT > 20 && !this.idleWarned) { this.idleWarned = true; G.ui.toast('autohunt', L('Av alanında uygun canavar yok — yarıçapı büyüt ya da canavarların yanında başlat.|No suitable monsters in the area — widen the radius or start next to monsters.'), '#ffcf6a'); }
      return this.wander();
    }
    this.idleT = 0; this.idleWarned = false;
    this.state = 'fight';
    if (this.chase > G.time && this.path && this.stuckTarget === t && p.edgeDist(t) > 2.6) return; // walking around an obstacle
    this.chase = 0; this.path = null; pc.moveTarget = null;
    if (p.target !== t) { pc.setTarget(t); this.engaged = { t, hp: t.hp, time: G.time }; }
    p.autoAttack = true;
    // a target we cannot damage for a long time is unreachable → skip it
    const e = this.engaged;
    if (e && e.t === t) { if (t.hp < e.hp - 1) { e.hp = t.hp; e.time = G.time; } else if (G.time - e.time > 20 && !attackers.includes(t)) { this.black.set(t, G.time + 90); pc.setTarget(null); return; } }
    if (!p.cast && this.buffs(true)) return;
    this.rotation(t, attackers.length);
    // approach when out of range
    const C = CLASSES[p.cls];
    const range = C.ranged ? C.range : 2.4;
    if (!p.cast && !p.dash && !pc.pending && (C.ranged || p.edgeDist(t) > 25) && p.edgeDist(t) > range - 0.5) pc.pending = { attack: true, target: t, t: 3 };
  },
  buffs(inFight) {
    const p = G.player, c = this.c;
    if (p.cast) return false;
    for (const id of c.order) {
      const r = roleOf(id);
      if (r === 'buff' && !p.hasBuff(BUFF_ID[id]) && this.ready(id, p)) { if (this.cast(id, p)) return true; }
      if (r === 'cbuff' && inFight && !p.hasBuff(BUFF_ID[id]) && this.ready(id, p)) { if (this.cast(id, p)) return true; }
      if (r === 'pet' && !inFight && this.ready(id, p)) {
        const kind = id === 'r_wolf' ? 'wolf' : 'skeleton';
        const have = (p.summons || []).filter(s => !s.dead && s.data?.petType === kind).length;
        if (kind === 'wolf' ? have === 0 : true) { if (this.cast(id, p)) return true; }
      }
    }
    return false;
  },
  rotation(t, nAtt) {
    const p = G.player, c = this.c;
    const big = t.elite || t.rare || t.isBoss || nAtt >= 3;
    for (const id of c.order) {
      const r = roleOf(id), sk = SKILLS[id];
      if (r === 'ult') { if (c.ult === 'never' || (c.ult === 'elite' && !big)) continue; if (this.ready(id, p) && this.cast(id, p)) return; continue; }
      if (r === 'aoe') { if (p.edgeDist(t) < 5 && this.enemiesNear(sk.range || 7) >= 1 && this.ready(id, p) && this.cast(id, p)) return; continue; }
      if (r === 'atk') { if (this.ready(id, t) && this.cast(id, t)) return; }
    }
  },
  wander() {
    const p = G.player, a = this.area, c = this.c;
    if (!a) return;
    if (this.path) return;
    const d = dist2(p.pos.x, p.pos.z, a.x, a.z);
    if (d > c.r * 0.9) { this.goTo(a.x, a.z, 3, true); return; }
    for (let i = 0; i < 8; i++) {
      const ang = Math.random() * Math.PI * 2, rr = Math.sqrt(Math.random()) * c.r * 0.85;
      const x = a.x + Math.sin(ang) * rr, z = a.z + Math.cos(ang) * rr;
      if (G.world.dungeon || !G.world.terrain?.isWater?.(x, z)) { this.goTo(x, z, 2); return; }
    }
  },
  doRest() {
    const p = G.player, pc = G.playerCtl, c = this.c;
    if (this.attackers().length) { pc.stand(); this.state = 'hunt'; return this.doHunt(); }
    const full = this.hpPct() >= 97 && (!this.usesMana() || this.mpPct() >= 97);
    if (full) { pc.stand(); this.state = 'hunt'; return; }
    if (p.inCombat || p.mount) return; // wait for combat to drop
    if (!p.sitting) {
      if (c.eat && !p.hasBuff('eating')) {
        const food = Object.keys(ITEMS).filter(id => ITEMS[id].use?.food && ITEMS[id].use?.regen && countItem(G.char, id) > 0).sort((a, b) => (ITEMS[b].lvl || 0) - (ITEMS[a].lvl || 0))[0];
        if (food && G.inv.useItemId(food)) return;
      }
      pc.sit();
    }
  },
  doToTown() {
    const p = G.player;
    if (this.attackers().length) { this.state = 'hunt'; this.path = null; return this.doHunt(); }
    const m = this.merchant();
    if (!m) { this.lastTrip = G.time; this.state = 'back'; return; }
    if (p.distTo(m) <= 4.5) { this.shop(m); this.lastTrip = G.time; this.state = 'back'; this.path = null; return; }
    if (!this.path) this.goTo(m.pos.x, m.pos.z, 3.5, true);
  },
  doBack() {
    const a = this.area;
    if (this.attackers().length) { this.state = 'hunt'; this.path = null; return this.doHunt(); }
    if (!a || a.zone !== G.zones.current?.id) { this.stop(L('Av alanı bu bölgede değil — oto av durdu|The hunting area is not in this zone — auto-hunt stopped')); return; }
    if (dist2(G.player.pos.x, G.player.pos.z, a.x, a.z) < Math.min(12, this.c.r * 0.6)) { this.state = 'hunt'; this.path = null; return; }
    if (!this.path) this.goTo(a.x, a.z, 4, true);
  },
  // sell junk, restock potions (runs instantly at the merchant)
  shop(npc) {
    const ch = G.char, c = this.c, st = this.st;
    npc.faceTo?.(G.player.pos.x, G.player.pos.z);
    let sold = 0, got = 0, n = 0;
    for (const it of this.sellList()) { const i = ch.bag.indexOf(it); if (i < 0) continue; const v = sellValue(it); ch.bag[i] = null; ch.gold += v; got += v; n++; }
    const buy = (kind, want) => {
      const id = this.buyId(kind); const price = Math.max(1, Math.round((ITEMS[id].value || 1) * 4));
      let cnt = Math.max(0, want - this.potCount(kind));
      cnt = Math.min(cnt, Math.floor(ch.gold / price));
      if (cnt > 0 && addItem(ch, makeStack(id, cnt), true)) { ch.gold -= price * cnt; st.spent += price * cnt; sold += cnt; }
    };
    buy('hp', c.buyHp);
    if (this.usesMana()) buy('mp', c.buyMp);
    st.sold += got; st.trips++;
    Audio.sfx(n ? 'sell' : 'buy');
    emit('bagChanged'); emit('goldGained', 0);
    G.ui.toast('scales', L(`Kasaba: ${n} eşya satıldı (+${fmtNum(got)} altın), ${sold} iksir alındı|Town: sold ${n} items (+${fmtNum(got)} gold), bought ${sold} potions`), '#ffd660');
    G.chat?.system(L(`[Oto Av] ${n} eşya satıldı, ${sold} iksir alındı.|[Auto-hunt] Sold ${n} items, bought ${sold} potions.`), 'system');
  },
};
G.autohunt = AutoHunt;
G.addSystem(dt => AutoHunt.update(dt));

// statistics
on('killed', () => { if (AutoHunt.on) AutoHunt.st.kills++; });
on('xpGained', n => { if (AutoHunt.on) AutoHunt.st.xp += n; });
on('goldGained', g => { if (AutoHunt.on && g > 0) AutoHunt.st.gold += g; });
on('playerDied', () => { if (AutoHunt.on) AutoHunt.st.deaths++; });
on('zoneEntered', () => { if (AutoHunt.on && AutoHunt.area && AutoHunt.state !== 'dead' && AutoHunt.area.zone !== G.zones.current?.id) AutoHunt.stop(L('Bölge değişti — oto av durdu|Zone changed — auto-hunt stopped')); });
on('levelUp', () => { if (AutoHunt.cfg) { AutoHunt.syncSkills(); AutoHunt.save(); } });
const giveItem = G.progress.giveItem.bind(G.progress);
G.progress.giveItem = (it, src) => { const ok = giveItem(it, src); if (ok && AutoHunt.on && src) AutoHunt.st.items += it.qty || 1; return ok; };

// ------------------------------------------------------------ status pill on the HUD
let pill = null, pillT = 0;
G.addSystem(dt => {
  pillT -= dt; if (pillT > 0) return; pillT = 0.25;
  const hud = document.getElementById('hud'); if (!hud) return;
  if (!pill || !pill.isConnected) {
    pill = h('div#ahpill', { onclick: e => { if (!e.target.closest('button')) UI.open('autohunt'); } },
      h('img', { src: uiIcon('autohunt') }), h('div.ah-txt', h('b'), h('span')),
      h('button.ah-stop', { onclick: () => AutoHunt.stop(), title: L('Durdur (Q)|Stop (Q)') }, '■'));
    hud.append(pill);
  }
  pill.classList.toggle('on', AutoHunt.on);
  if (!AutoHunt.on) return;
  const s = AutoHunt.st;
  pill.querySelector('b').textContent = L('OTO AV|AUTO') + ' · ' + AutoHunt.stateName;
  pill.querySelector('span').textContent = `⚔ ${s.kills}   ⏱ ${fmtTime(s.t)}   ✦ ${fmtNum(Math.round(s.xp / Math.max(s.t, 60) * 3600))}/${L('sa|h')}`;
});

// ------------------------------------------------------------ settings window
const per = (v, t) => fmtNum(Math.round(v / Math.max(t, 60) * 3600));
UI.register('autohunt', {
  title: 'Oto Av|Auto-Hunt', icon: 'autohunt', w: 470, listen: ['autohunt', 'levelUp'],
  build(w) {
    const A = AutoHunt, c = A.c, b = w.body;
    const save = () => A.save();
    const row = (lab, ctrl, hint) => h('div.ah-row', h('div.ah-lab', lab, hint ? h('small', hint) : null), ctrl);
    const check = (obj, k) => { const i = h('input', { type: 'checkbox', checked: obj[k] ? 'checked' : null }); i.addEventListener('change', () => { obj[k] = i.checked; save(); }); return h('label.ah-sw', i, h('i')); };
    const slider = (k, min, max, step, fmt = v => v) => {
      const val = h('span.ah-val', fmt(c[k]));
      const i = h('input', { type: 'range', min, max, step, value: c[k] });
      i.addEventListener('input', () => { c[k] = +i.value; val.textContent = fmt(c[k]); });
      i.addEventListener('change', save);
      return h('div.ah-sl', i, val);
    };
    const seg = (k, opts) => h('div.ah-seg', ...opts.map(([v, lab]) => h('button' + (c[k] === v ? '.on' : ''), { onclick: () => { c[k] = v; save(); UI.refresh('autohunt'); } }, lab)));
    w.tab = w.tab || 'main';
    UI.setTabs(w, [['main', L('Genel|General')], ['skills', L('Yetenekler|Skills')], ['prot', L('Koruma|Protection')], ['tgt', L('Hedef|Targets')], ['town', L('Kasaba|Town')]], w.tab, k => { w.tab = k; UI.refresh('autohunt'); });

    if (w.tab === 'main') {
      const s = A.st;
      b.append(h('div.ah-head' + (A.on ? '.on' : ''),
        h('div.ah-state', h('i.dot'), h('div', h('b', A.on ? A.stateName : L('Oto av kapalı|Auto-hunt is off')), h('small', A.on ? L('Hareket tuşlarına basarsan bot durur.|Moving manually stops the bot.') : L('Bulunduğun yer av alanı olur. Kısayol: Q|Your current spot becomes the hunting area. Hotkey: Q')))),
        h('button.btn.big' + (A.on ? '.red' : '.green'), { onclick: () => { A.toggle(); UI.refresh('autohunt'); } }, A.on ? '■ ' + L('Durdur|Stop') : '▶ ' + L('Başlat|Start'))));
      if (s) {
        const cell = (k, v, sub) => h('div.ah-cell', h('small', k), h('b', v), sub ? h('em', sub) : null);
        b.append(h('div.ah-stats',
          cell(L('Süre|Time'), fmtTime(s.t)),
          cell(L('Av|Kills'), fmtNum(s.kills), per(s.kills, s.t) + '/' + L('sa|h')),
          cell(L('Tecrübe|XP'), fmtNum(s.xp), per(s.xp, s.t) + '/' + L('sa|h')),
          cell(L('Altın|Gold'), fmtNum(s.gold), per(s.gold, s.t) + '/' + L('sa|h')),
          cell(L('Ganimet|Loot'), fmtNum(s.items)),
          cell(L('Kasaba|Trips'), s.trips, s.sold ? '+' + fmtNum(s.sold) + ' / −' + fmtNum(s.spent) : null),
          cell(L('Ölüm|Deaths'), s.deaths),
          cell(L('Seviye|Level'), (G.player.level - s.lvl0 > 0 ? '+' : '') + (G.player.level - s.lvl0))));
        if (A.on) { clearTimeout(w._t); w._t = setTimeout(() => UI.wins.autohunt === w && w.tab === 'main' && UI.refresh('autohunt'), 1000); }
      }
      const zoneName = A.area ? (A.area.zone === G.zones.current?.id ? L('bu bölgede|in this zone') : L('başka bölgede|in another zone')) : L('ayarlanmadı|not set');
      b.append(h('h4.ah-h', L('Av Alanı|Hunting Area')),
        row(L('Merkez|Centre'), h('button.btn.small', { onclick: () => { A.setArea(); UI.refresh('autohunt'); } }, icon('map_marker', {}, 'ico s'), L('Buraya ayarla|Set here')), A.area ? `${Math.round(A.area.x)}, ${Math.round(A.area.z)} — ${zoneName}` : zoneName),
        row(L('Yarıçap|Radius'), slider('r', 10, 80, 5, v => v + ' m')),
        h('h4.ah-h', L('Ölüm ve Durma|Death & Stop')),
        row(L('Ölünce|On death'), seg('onDeath', [['continue', L('Dirilip devam et|Revive & continue')], ['stop', L('Durdur|Stop')]])),
        row(L('Seviyede dur|Stop at level'), slider('stopLevel', 0, 60, 1, v => v ? v : L('kapalı|off'))),
        row(L('Süre sınırı|Time limit'), slider('stopMin', 0, 240, 10, v => v ? v + ' ' + L('dk|min') : L('kapalı|off'))));
    }

    if (w.tab === 'skills') {
      A.syncSkills();
      b.append(h('div.muted.ah-note', L('Bot yetenekleri yukarıdan aşağıya öncelik sırasıyla kullanır. Okla sırayı değiştir, anahtarla aç/kapat.|The bot uses skills top to bottom by priority. Reorder with the arrow, toggle with the switch.')));
      b.append(row(L('Nihai yetenekler|Ultimates'), seg('ult', [['elite', L('Güçlü düşmana|Strong foes')], ['always', L('Her zaman|Always')], ['never', L('Asla|Never')]])));
      const list = h('div.ah-skills');
      c.order.forEach((id, i) => {
        const sk = SKILLS[id], r = roleOf(id);
        const sw = h('input', { type: 'checkbox', checked: A.skillOn(id) ? 'checked' : null });
        sw.addEventListener('change', () => { c.off[id] = !sw.checked; save(); });
        list.append(h('div.ah-sk' + (r === 'skip' ? '.dim' : ''),
          h('img', { src: skillIcon(sk) }),
          h('div.ah-skn', h('b', L(sk.name)), h('small', L(ROLE_NAME[r]))),
          h('button.ah-up', { disabled: i === 0 ? 'disabled' : null, onclick: () => { c.order.splice(i, 1); c.order.splice(i - 1, 0, id); save(); UI.refresh('autohunt'); }, title: L('Yukarı taşı|Move up') }, '▲'),
          h('label.ah-sw', sw, h('i'))));
      });
      b.append(list);
    }

    if (w.tab === 'prot') {
      const mana = A.usesMana();
      b.append(h('h4.ah-h', L('İksirler|Potions')),
        row(L('Can iksiri|Health potion'), slider('hpPct', 10, 90, 5, v => L('can <|HP <') + ' ' + v + '%'), L(`Elinde ${A.potCount('hp')} adet|${A.potCount('hp')} in bag`)),
        mana ? row(L('Mana iksiri|Mana potion'), slider('mpPct', 5, 90, 5, v => L('mana <|MP <') + ' ' + v + '%'), L(`Elinde ${A.potCount('mp')} adet|${A.potCount('mp')} in bag`)) : null,
        h('h4.ah-h', L('Yetenekler|Skills')),
        row(L('İyileştirme büyüsü|Healing spells'), slider('healPct', 10, 95, 5, v => L('can <|HP <') + ' ' + v + '%')),
        row(L('Acil durum yeteneği|Emergency skill'), slider('savePct', 10, 80, 5, v => L('can <|HP <') + ' ' + v + '%')),
        h('h4.ah-h', L('Dinlenme|Resting')),
        row(L('Savaş dışında otur ve dinlen|Sit and rest out of combat'), check(c, 'rest')),
        row(L('Can şunun altındaysa|When HP below'), slider('restHp', 10, 95, 5, v => v + '%')),
        mana ? row(L('Mana şunun altındaysa|When mana below'), slider('restMp', 10, 95, 5, v => v + '%')) : null,
        row(L('Dinlenirken yemek ye|Eat while resting'), check(c, 'eat'), L('Ekmek vb. yenilenme sağlar|Bread etc. speeds up regeneration')));
    }

    if (w.tab === 'tgt') {
      b.append(row(L('Öncelik|Priority'), seg('prio', [['near', L('En yakın|Nearest')], ['weak', L('En zayıf|Weakest')], ['strong', L('En güçlü|Strongest')]])),
        row(L('Seviye farkı (üst)|Max levels above'), slider('maxAbove', 0, 10, 1, v => '+' + v)),
        row(L('Gri canavarları atla|Skip grey monsters'), check(c, 'skipGray'), L('Tecrübe vermeyenler|Those giving no XP')),
        row(L('Başkasının avına dokunma|Don\'t steal kills'), check(c, 'noKS')),
        h('h4.ah-h', L('Kaçınılacaklar|Avoid')),
        row(L('Elit canavarlar|Elite monsters'), check(c.avoid, 'elite')),
        row(L('Nadir canavarlar|Rare monsters'), check(c.avoid, 'rare')),
        row(L('Patronlar|Bosses'), check(c.avoid, 'boss')),
        h('div.muted.ah-note', L('Sana saldıran her düşmana karşılık verilir.|Any enemy attacking you is always fought back.')));
      // monsters around the area: tick to ignore
      const seen = {};
      const a = A.area || { x: G.player.pos.x, z: G.player.pos.z };
      for (const m of G.world.units) if (m.kind === 'monster' && !m.data?.tpl?.critter && dist2(m.pos.x, m.pos.z, a.x, a.z) < c.r + 40) seen[m.tplId] = seen[m.tplId] || { name: m.name, lvl: m.level, n: 0, elite: m.elite };
      for (const m of G.world.units) if (seen[m.tplId] && m.kind === 'monster') seen[m.tplId].n++;
      const ids = Object.keys(seen);
      b.append(h('h4.ah-h', L('Alandaki Canavarlar|Monsters in the Area')));
      if (!ids.length) b.append(h('div.muted', L('Yakında canavar yok.|No monsters nearby.')));
      for (const id of ids) {
        const m = seen[id];
        const i = h('input', { type: 'checkbox', checked: c.ignore[id] ? null : 'checked' });
        i.addEventListener('change', () => { if (i.checked) delete c.ignore[id]; else c.ignore[id] = 1; save(); });
        b.append(row(h('span', m.name, ' ', h('span.chip', L('Sv|Lv') + ' ' + m.lvl)), h('label.ah-sw', i, h('i'))));
      }
    }

    if (w.tab === 'town') {
      const m = A.merchant();
      b.append(row(L('Kasaba döngüsü|Town trips'), check(c, 'town'), m ? L('Tüccar: |Merchant: ') + m.name : L('Bu bölgede tüccar yok|No merchant in this zone')),
        row(L('Binekle yolculuk|Ride while travelling'), check(c, 'mount')),
        h('h4.ah-h', L('Ne zaman dönülsün?|When to go back?')),
        row(L('Can iksiri şundan azsa|Health potions below'), slider('potBelow', 0, 20, 1)),
        row(L('Boş çanta yeri şundan azsa|Free bag slots below'), slider('freeBelow', 0, 10, 1)),
        h('h4.ah-h', L('Alışveriş|Shopping')),
        row(L('Can iksiri tamamla|Top up health potions'), slider('buyHp', 0, 60, 5)),
        A.usesMana() ? row(L('Mana iksiri tamamla|Top up mana potions'), slider('buyMp', 0, 60, 5)) : null,
        row(L('Çöp eşyaları sat|Sell junk'), check(c, 'sellJunk')),
        row(L('Ekipman sat (en fazla)|Sell gear (up to)'), seg('sellGear', [['none', L('Hiçbiri|None')], ['common', L('Sıradan|Common')], ['uncommon', L('Yaygın|Uncommon')], ['rare', L('Nadir|Rare')]])),
        h('div.muted.ah-note', L('Takılı eşyalar ve malzemeler asla satılmaz.|Equipped items and materials are never sold.')));
    }
  },
});

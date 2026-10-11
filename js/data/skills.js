// All class skills. run(c, t, X, ctx) executes the effect using the combat API X.
// cost: rage/energy/focus are absolute; mana costs are % of base mana.
import { L } from '../core/i18n.js';
import { fmtNum } from '../core/util.js';

const N = v => fmtNum(v);
// description helper: d(u, coef) → formatted damage number
const D = (X, u, coef, heal) => N(X.amount(u, coef, heal ? { heal: true } : undefined));

export const SKILLS = {
  // ================================================================ WARRIOR
  w_strike: {
    cls: 'warrior', lvl: 1, name: 'Ağır Darbe|Heavy Strike', icon: 'slash', theme: 'physical', target: 'enemy', melee: true, cost: 0, cd: 0, anim: 'slash', gen: 12,
    desc: (u, X) => L(`Silahınla güçlü bir darbe indirerek ${D(X, u, 1.3)} hasar verir ve 12 öfke kazanırsın.|Strike with your weapon for ${D(X, u, 1.3)} damage and generate 12 rage.`),
    run(c, t, X) { X.dmg(c, t, { coef: 1.3 * c.tm('w_strike'), rage: 12 * c.tm('rageGen'), threat: 1.5 }); X.sfx('swing', c); },
  },
  w_cleave: {
    cls: 'warrior', lvl: 3, name: 'Yarma|Cleave', icon: 'cleave', theme: 'physical', target: 'enemy', melee: true, cost: 20, cd: 5, anim: 'slash2',
    desc: (u, X) => L(`Önündeki tüm düşmanlara ${D(X, u, 1.1)} hasar verir.|Sweep through all enemies in front of you for ${D(X, u, 1.1)} damage.`),
    run(c, t, X) { for (const e of X.cone(c, 4, 1.1)) X.dmg(c, e, { coef: 1.1 * c.tm('w_cleave'), threat: 1.3 }); X.fx.slash(c, 0xffffff); X.sfx('swing_heavy', c); },
  },
  w_charge: {
    cls: 'warrior', lvl: 5, name: 'Hücum|Charge', icon: 'charge', theme: 'physical', target: 'enemy', minRange: 5, range: 25, cost: 0, cd: 14, gcd: false, anim: 'leap',
    desc: (u, X) => L(`Hedefe atılır, 1.5 sn sersemletir ve 20 öfke kazanırsın.|Charge an enemy, stunning it for 1.5 sec and generating 20 rage.`),
    run(c, t, X) {
      X.sfx('dash', c);
      X.dash(c, t, 34, () => { X.dmg(c, t, { coef: 0.6, rage: 20, threat: 2 }); X.buff(t, X.B.stun(1.5)); X.fx.burst(t.pos, 'dust'); X.shake(c, 0.25); });
    },
  },
  w_shout: {
    cls: 'warrior', lvl: 8, name: 'Savaş Narası|War Cry', icon: 'war_cry', theme: 'blood', target: 'self', cost: 0, cd: 18, anim: 'roar',
    desc: () => L('Yakındaki tüm düşmanları üzerine çeker, 20 öfke kazanır ve grubunun gücünü 30 sn boyunca %10 artırır.|Taunts all nearby enemies, generates 20 rage and increases your party\'s power by 10% for 30 sec.'),
    run(c, t, X) {
      for (const e of X.enemies(c, 12)) X.taunt(c, e);
      c.res = Math.min(c.stats.maxRes, c.res + 20);
      for (const a of X.allies(c, 30)) X.buff(a, { id: 'warcry', name: L('Savaş Narası|War Cry'), icon: 'war_cry', dur: 30, pct: { power: 10 } }, c);
      X.fx.ring(c.pos, 12, 0xff6a3a); X.sfx('roar', c, { pitch: 1.4, vol: 0.7 });
    },
  },
  w_wall: {
    cls: 'warrior', lvl: 10, name: 'Kalkan Duvarı|Shield Wall', icon: 'shield', theme: 'physical', target: 'self', cost: 0, cd: 40, gcd: false, anim: 'block',
    desc: () => L('8 sn boyunca aldığın hasarı %50 azaltır.|Reduces damage taken by 50% for 8 sec.'),
    run(c, t, X) { X.buff(c, { id: 'shieldwall', name: L('Kalkan Duvarı|Shield Wall'), icon: 'shield', dur: 8 * c.tm('w_wall_dur'), mods: { dmgTakenPct: -50 }, fx: 'shield' }, c); X.sfx('shield_up', c); },
  },
  w_whirl: {
    cls: 'warrior', lvl: 14, name: 'Kasırga|Whirlwind', icon: 'whirlwind', theme: 'physical', target: 'self', cost: 30, cd: 8, anim: 'spin', animDur: 0.9, animOpts: { turns: 2 },
    desc: (u, X) => L(`Dönerek etrafındaki tüm düşmanlara 3 kez ${D(X, u, 0.7)} hasar verirsin.|Spin, hitting all nearby enemies 3 times for ${D(X, u, 0.7)} damage.`),
    run(c, t, X) {
      for (let i = 0; i < 3; i++) X.later(i * 0.3, () => { if (c.dead) return; for (const e of X.enemies(c, 5.5)) X.dmg(c, e, { coef: 0.7 * c.tm('w_whirl'), threat: 1.2, aoe: true }); X.sfx('swing', c, { pitch: 1 + i * 0.1 }); });
      X.fx.ring(c.pos, 5.5, 0xffffff, 0.9);
    },
  },
  w_rend: {
    cls: 'warrior', lvl: 18, name: 'Parçala|Rend', icon: 'bleed', theme: 'blood', target: 'enemy', melee: true, cost: 15, cd: 0, anim: 'slash',
    desc: (u, X) => L(`Hedefi yaralar: anında ${D(X, u, 0.4)} ve 12 sn içinde ${D(X, u, 2.2)} kanama hasarı.|Wound the target for ${D(X, u, 0.4)} damage plus ${D(X, u, 2.2)} bleed over 12 sec.`),
    run(c, t, X) { X.dmg(c, t, { coef: 0.4 }); X.dot(c, t, { id: 'rend', name: L('Parçalandı|Rend'), icon: 'bleed', dur: 12, coef: 2.2 * c.tm('w_rend'), ticks: 6, fx: 'bleed' }); X.sfx('swing', c); },
  },
  w_execute: {
    cls: 'warrior', lvl: 24, name: 'İnfaz|Execute', icon: 'skull', theme: 'blood', target: 'enemy', melee: true, cost: 30, cd: 6, anim: 'overhead',
    desc: (u, X) => L(`${D(X, u, 1.5)} hasar verir. Canı %30'un altındaki hedeflere ${D(X, u, 4.5)} hasar.|Deal ${D(X, u, 1.5)} damage, or ${D(X, u, 4.5)} to targets below 30% health.`),
    run(c, t, X) { const low = t.hpPct < 0.3; X.dmg(c, t, { coef: (low ? 4.5 : 1.5) * c.tm('w_execute'), critBonus: low ? 15 : 0 }); X.sfx('swing_heavy', c); if (low) X.shake(c, 0.3); },
  },
  w_slam: {
    cls: 'warrior', lvl: 32, name: 'Yer Sarsıntısı|Ground Slam', icon: 'earthquake', theme: 'physical', target: 'self', cost: 25, cd: 20, anim: 'slam', animDur: 0.8,
    desc: (u, X) => L(`Yere vurarak 7 metre içindeki düşmanlara ${D(X, u, 1.2)} hasar verir ve 2 sn sersemletir.|Slam the ground, dealing ${D(X, u, 1.2)} damage to enemies within 7 yards and stunning them for 2 sec.`),
    run(c, t, X) {
      X.later(0.5, () => { if (c.dead) return; for (const e of X.enemies(c, 7)) { X.dmg(c, e, { coef: 1.2, threat: 1.5, aoe: true }); X.buff(e, X.B.stun(2)); } X.fx.ring(c.pos, 7, 0xc8a070); X.fx.burst(c.pos, 'dust', { n: 30 }); X.shake(c, 0.6); X.sfx('explosion', c, { pitch: 0.7 }); });
    },
  },
  w_avatar: {
    cls: 'warrior', lvl: 40, name: 'Avatar|Avatar', icon: 'rage', theme: 'fire', target: 'self', cost: 0, cd: 120, gcd: false, anim: 'roar', ult: true,
    desc: () => L('15 sn boyunca devleşirsin: +%30 hasar, kontrol etkilerine bağışıklık.|Become a giant for 15 sec: +30% damage and immunity to crowd control.'),
    run(c, t, X) { X.buff(c, { id: 'avatar', name: 'Avatar', icon: 'rage', dur: 15, mods: { dmgPct: 30 }, flags: { ccImmune: 1 }, fx: 'berserk', onApply: u => u.group.scale.setScalar(1.25), onExpire: u => u.group.scale.setScalar(1) }, c); X.sfx('roar', c, { pitch: 1.1 }); X.shake(c, 0.4); },
  },

  // ================================================================ MAGE
  m_fireball: {
    cls: 'mage', lvl: 1, name: 'Ateş Topu|Fireball', icon: 'fireball', theme: 'fire', target: 'enemy', cost: 4, cast: 1.6, cd: 0, anim: 'release',
    desc: (u, X) => L(`Hedefe ${D(X, u, 1.6)} ateş hasarı veren bir ateş topu fırlatır.|Hurl a fireball that deals ${D(X, u, 1.6)} fire damage.`),
    run(c, t, X) {
      X.sfx('fireball', c);
      X.proj(c, t, 'fireball', 24, () => { X.dmg(c, t, { coef: 1.6 * c.tm('m_fireball'), school: 'fire' }); X.sfx('explosion', t, { vol: 0.5 }); if (c.powers?.has('pw_fire_split')) { for (const e of X.enemiesAt(c, t.pos.x, t.pos.z, 4)) if (e !== t) X.dmg(c, e, { coef: 1.0, school: 'fire', aoe: true }); X.fx.burst(t.pos, 'explosion', { n: 25, r: 3 }); } if (c.tal('ignite')) X.dot(c, t, { id: 'ignite', name: L('Tutuşma|Ignite'), icon: 'flame', dur: 6, coef: 0.4 * c.tal('ignite'), ticks: 3, school: 'fire', fx: 'burn' }); });
    },
  },
  m_frostbolt: {
    cls: 'mage', lvl: 3, name: 'Buz Oku|Frostbolt', icon: 'ice_shard', theme: 'frost', target: 'enemy', cost: 4, cast: 1.3, cd: 0, anim: 'release',
    desc: (u, X) => L(`${D(X, u, 1.25)} buz hasarı verir ve hedefi 4 sn %50 yavaşlatır.|Deal ${D(X, u, 1.25)} frost damage and slow the target by 50% for 4 sec.`),
    run(c, t, X) { X.sfx('frost_cast', c); X.proj(c, t, 'frostbolt', 26, () => { X.dmg(c, t, { coef: 1.25 * c.tm('m_frostbolt') * (c.powers?.has('pw_frost_shatter') && t.rooted ? 1.8 : 1), school: 'frost' }); X.buff(t, X.B.slow(0.5, 4)); X.sfx('ice_shatter', t, { vol: 0.5 }); }); },
  },
  m_missiles: {
    cls: 'mage', lvl: 5, name: 'Gizemli Füzeler|Arcane Missiles', icon: 'arcane_missiles', theme: 'arcane', target: 'enemy', cost: 6, channel: 1.8, ticks: 4, cd: 6, castAnim: 'forward',
    desc: (u, X) => L(`1.8 sn boyunca her biri ${D(X, u, 0.55)} hasar veren 4 gizemli füze fırlatır.|Channel 4 arcane missiles over 1.8 sec, each dealing ${D(X, u, 0.55)} damage.`),
    tick(c, t, X) { X.sfx('arcane', c, { vol: 0.5 }); X.proj(c, t, 'arcane', 30, () => X.dmg(c, t, { coef: 0.55 * c.tm('m_missiles'), school: 'arcane' })); },
  },
  m_nova: {
    cls: 'mage', lvl: 8, name: 'Buz Halkası|Frost Nova', icon: 'frost_nova', theme: 'frost', target: 'self', cost: 6, cd: 18, anim: 'raise',
    desc: (u, X) => L(`Etrafındaki düşmanlara ${D(X, u, 0.6)} buz hasarı verip 4 sn yerinde dondurur.|Blast nearby enemies for ${D(X, u, 0.6)} frost damage and freeze them in place for 4 sec.`),
    run(c, t, X) { for (const e of X.enemies(c, 8)) { X.dmg(c, e, { coef: 0.6, school: 'frost', aoe: true }); X.buff(e, X.B.root(4)); } X.fx.ring(c.pos, 8, 0x8ad8ff); X.fx.burst(c.pos, 'frost', { n: 40, r: 6 }); X.sfx('ice_shatter', c); },
  },
  m_blink: {
    cls: 'mage', lvl: 10, name: 'Işınlan|Blink', icon: 'blink', theme: 'arcane', target: 'self', cost: 3, cd: 14, gcd: false,
    desc: () => L('12 metre ileri ışınlanır ve tüm yavaşlatma/kök etkilerinden kurtulursun.|Teleport 12 yards forward, removing all slows and roots.'),
    run(c, t, X) { X.fx.burst(c.pos, 'arcane', { n: 20 }); X.blink(c, 12); for (const b of [...c.buffs]) if (b.flags && (b.flags.root || b.flags.slow)) c.removeBuff(b.id); X.fx.burst(c.pos, 'arcane', { n: 20 }); X.sfx('teleport', c); },
  },
  m_flamestrike: {
    cls: 'mage', lvl: 14, name: 'Alev Sütunu|Flamestrike', icon: 'flame', theme: 'fire', target: 'ground', range: 30, radius: 4.5, cost: 8, cast: 1.5, cd: 8, anim: 'raise',
    desc: (u, X) => L(`Hedef alana alev indirir: ${D(X, u, 1.4)} ateş hasarı ve 6 sn boyunca yanan zemin.|Call down flames on an area: ${D(X, u, 1.4)} fire damage, leaving the ground burning for 6 sec.`),
    run(c, t, X, ctx) {
      const { x, z } = ctx.ground;
      for (const e of X.enemiesAt(c, x, z, 4.5)) X.dmg(c, e, { coef: 1.4 * c.tm('m_flamestrike'), school: 'fire', aoe: true });
      X.fx.pillar({ x, z }, 0xff7a2a); X.sfx('fire_cast', { pos: { x, y: 0, z } });
      X.zone(c, x, z, 4.5, 6, 1, e => X.dmg(c, e, { coef: 0.22, school: 'fire', dot: true }), 0xff6a1a);
    },
  },
  m_shield: {
    cls: 'mage', lvl: 18, name: 'Mana Kalkanı|Mana Shield', icon: 'barrier', theme: 'arcane', target: 'self', cost: 6, cd: 25, gcd: true,
    desc: (u, X) => L(`15 sn boyunca ${D(X, u, 3)} hasarı emen bir kalkan.|A shield that absorbs ${D(X, u, 3)} damage for 15 sec.`),
    run(c, t, X) { X.buff(c, { id: 'manashield', name: L('Mana Kalkanı|Mana Shield'), icon: 'barrier', dur: 15, absorb: X.amount(c, 3), fx: 'arcaneShield' }, c); X.sfx('shield_up', c); },
  },
  m_chain: {
    cls: 'mage', lvl: 24, name: 'Zincirleme Şimşek|Chain Lightning', icon: 'lightning', theme: 'lightning', target: 'enemy', cost: 7, cast: 1.4, cd: 4, anim: 'release',
    desc: (u, X) => L(`Hedefe ${D(X, u, 1.3)} hasar veren ve 4 düşmana sıçrayan şimşek.|Lightning that deals ${D(X, u, 1.3)} damage and jumps to 4 more enemies.`),
    run(c, t, X) {
      let cur = t, prev = c, hit = new Set(), mult = 1;
      for (let i = 0; i < 5 && cur; i++) {
        X.fx.beam(prev, cur, 0xa8d8ff); X.dmg(c, cur, { coef: 1.3 * mult, school: 'arcane', aoe: i > 0 }); hit.add(cur);
        prev = cur; mult *= 0.82;
        cur = X.enemies(c, 40).filter(e => !hit.has(e)).sort((a, b) => a.distTo(prev) - b.distTo(prev)).find(e => e.distTo(prev) < 10);
      }
      X.sfx('lightning', c);
    },
  },
  m_meteor: {
    cls: 'mage', lvl: 32, name: 'Meteor|Meteor', icon: 'meteor', theme: 'fire', target: 'ground', range: 32, radius: 6, cost: 10, cd: 25, anim: 'raise',
    desc: (u, X) => L(`1.6 sn sonra hedef alana düşen meteor: ${D(X, u, 3.2)} ateş hasarı.|A meteor crashes into the area after 1.6 sec, dealing ${D(X, u, 3.2)} fire damage.`),
    run(c, t, X, ctx) {
      const { x, z } = ctx.ground;
      X.fx.tele({ shape: 'circle', x, z, r: 6, dur: 1.6, color: 0xff6a1a, friendly: true });
      X.fx.meteor({ x, z }, 1.6);
      X.later(1.6, () => { for (const e of X.enemiesAt(c, x, z, 6)) X.dmg(c, e, { coef: 3.2, school: 'fire', aoe: true }); X.fx.burst({ x, y: X.h(x, z), z }, 'explosion', { n: 50, r: 6 }); X.shake(c, 0.7); X.sfx('explosion', { pos: { x, y: 0, z } }, { vol: 1 }); });
    },
  },
  m_timewarp: {
    cls: 'mage', lvl: 40, name: 'Zaman Bükülmesi|Time Warp', icon: 'hourglass', theme: 'arcane', target: 'self', cost: 0, cd: 120, gcd: false, ult: true,
    desc: () => L('Tüm yetenek bekleme sürelerini sıfırlar ve 12 sn boyunca hızını %30 artırır.|Resets all cooldowns and grants 30% haste for 12 sec.'),
    run(c, t, X) { for (const k in c.cds) if (k !== 'm_timewarp') delete c.cds[k]; X.buff(c, { id: 'timewarp', name: L('Zaman Bükülmesi|Time Warp'), icon: 'hourglass', dur: 12, mods: { haste: 30 }, fx: 'haste' }, c); X.sfx('portal', c); },
  },

  // ================================================================ RANGER
  r_shot: {
    cls: 'ranger', lvl: 1, name: 'Hızlı Atış|Quick Shot', icon: 'arrow', theme: 'nature', target: 'enemy', cost: 0, cd: 0, anim: 'bow', animDur: 0.45,
    desc: (u, X) => L(`Anında ${D(X, u, 1.15)} hasar veren bir ok atar ve 8 odak kazanırsın.|Instantly fire an arrow for ${D(X, u, 1.15)} damage and gain 8 focus.`),
    run(c, t, X) { X.sfx('bow_shot', c); c.res = Math.min(c.stats.maxRes, c.res + 8); X.proj(c, t, 'arrow', 40, () => { X.dmg(c, t, { coef: 1.15 * c.tm('r_shot') }); X.sfx('arrow_hit', t, { vol: 0.5 }); }); },
  },
  r_aimed: {
    cls: 'ranger', lvl: 3, name: 'Nişanlı Atış|Aimed Shot', icon: 'mark', theme: 'nature', target: 'enemy', cost: 30, cast: 1.8, cd: 0, castAnim: 'bow', anim: 'bow', animDur: 0.3,
    desc: (u, X) => L(`Dikkatlice nişan alıp ${D(X, u, 2.6)} hasar veren güçlü bir ok atar.|Take careful aim and fire a powerful shot for ${D(X, u, 2.6)} damage.`),
    run(c, t, X) { X.sfx('bow_shot', c, { pitch: 0.8 }); X.proj(c, t, 'arrowBig', 50, () => { X.dmg(c, t, { coef: 2.6 * c.tm('r_aimed'), critBonus: c.tal('sniper') * 5 }); X.sfx('crit', t, { vol: 0.5 }); }); },
  },
  r_multi: {
    cls: 'ranger', lvl: 5, name: 'Çoklu Atış|Multi-Shot', icon: 'multi_arrows', theme: 'nature', target: 'enemy', cost: 30, costFn: c => c.powers?.has('pw_multi_free') ? 0 : 1, cd: 6, anim: 'bow', animDur: 0.45,
    desc: (u, X) => L(`Önündeki 5 düşmana kadar her birine ${D(X, u, 0.9)} hasar veren oklar.|Fire arrows at up to 5 enemies in front of you for ${D(X, u, 0.9)} damage each.`),
    run(c, t, X) { const list = [t, ...X.cone(c, 28, 0.5).filter(e => e !== t)].slice(0, c.powers?.has('pw_multi_free') ? 8 : 5); X.sfx('bow_shot', c); for (const e of list) X.proj(c, e, 'arrow', 40, () => X.dmg(c, e, { coef: 0.9 * c.tm('r_multi'), aoe: true })); },
  },
  r_disengage: {
    cls: 'ranger', lvl: 8, name: 'Geri Sıçra|Disengage', icon: 'sprint', theme: 'nature', target: 'self', cost: 0, cd: 14, gcd: false,
    desc: () => L('11 metre geriye sıçrarsın.|Leap 11 yards backwards.'),
    run(c, t, X) { X.leap(c, c.yaw + Math.PI, 11); X.sfx('dash', c); },
  },
  r_wolf: {
    cls: 'ranger', lvl: 10, name: 'Kurt Yoldaş|Wolf Companion', icon: 'wolf', theme: 'nature', target: 'self', cost: 0, cast: 1.5, cd: 10, castAnim: 'up',
    desc: () => L('Senin için savaşan sadık bir kurt çağırır. Kurt ölene kadar yanında kalır.|Summon a loyal wolf that fights for you until it falls.'),
    can: c => c.summons.some(s => !s.dead && s.data.petType === 'wolf') ? L('Kurdun zaten yanında.|Your wolf is already with you.') : null,
    run(c, t, X) { X.summon(c, 'pet_wolf', { petType: 'wolf', count: 1 }); X.sfx('howl', c, { vol: 0.6 }); },
  },
  r_sting: {
    cls: 'ranger', lvl: 14, name: 'Engerek İğnesi|Serpent Sting', icon: 'poison_drop', theme: 'poison', target: 'enemy', cost: 20, cd: 0, anim: 'bow', animDur: 0.45,
    desc: (u, X) => L(`Hedefi zehirler: 15 sn içinde ${D(X, u, 2.6)} doğa hasarı.|Poison the target for ${D(X, u, 2.6)} nature damage over 15 sec.`),
    run(c, t, X) { X.proj(c, t, 'poison', 40, () => X.dot(c, t, { id: 'sting', name: L('Engerek İğnesi|Serpent Sting'), icon: 'poison_drop', dur: 15, coef: 2.6 * c.tm('r_sting'), ticks: 5, school: 'nature', fx: 'poison' })); X.sfx('bow_shot', c); },
  },
  r_trap: {
    cls: 'ranger', lvl: 18, name: 'Buz Tuzağı|Frost Trap', icon: 'trap', theme: 'frost', target: 'ground', range: 26, radius: 4.5, cost: 15, cd: 20, anim: 'throw',
    desc: () => L('Hedef alandaki düşmanları 4 sn donduran bir tuzak fırlatır.|Throw a trap that freezes enemies in the area for 4 sec.'),
    run(c, t, X, ctx) { const { x, z } = ctx.ground; X.later(0.4, () => { for (const e of X.enemiesAt(c, x, z, 4.5)) { X.buff(e, X.B.root(4)); X.dmg(c, e, { coef: 0.3, school: 'frost', aoe: true }); } X.fx.ring({ x, y: X.h(x, z), z }, 4.5, 0x8ad8ff); X.fx.burst({ x, y: X.h(x, z), z }, 'frost', { n: 30, r: 4 }); X.sfx('ice_shatter', { pos: { x, y: 0, z } }); }); },
  },
  r_rain: {
    cls: 'ranger', lvl: 24, name: 'Ok Yağmuru|Rain of Arrows', icon: 'rain_arrows', theme: 'nature', target: 'ground', range: 30, radius: 6, cost: 40, cd: 15, channel: 3, ticks: 6, castAnim: 'up',
    desc: (u, X) => L(`3 sn boyunca hedef alana ok yağdırır: saniyede ${D(X, u, 1.0)} hasar.|Rain arrows on an area for 3 sec, dealing ${D(X, u, 1.0)} damage per second.`),
    tick(c, t, X, ctx) { const { x, z } = ctx.ground; X.fx.arrowRain({ x, z }, 6); for (const e of X.enemiesAt(c, x, z, 6)) X.dmg(c, e, { coef: 0.5 * c.tm('r_rain'), aoe: true, noSound: true }); X.sfx('arrow_hit', { pos: { x, y: 0, z } }, { vol: 0.5 }); },
  },
  r_mark: {
    cls: 'ranger', lvl: 32, name: 'Avcı İşareti|Hunter\'s Mark', icon: 'eye', theme: 'blood', target: 'enemy', cost: 10, cd: 10, gcd: false,
    desc: () => L('Hedefi işaretler: 20 sn boyunca aldığı tüm hasar %20 artar.|Mark the target: it takes 20% more damage from all sources for 20 sec.'),
    run(c, t, X) { X.buff(t, { id: 'huntmark', name: L('Avcı İşareti|Hunter\'s Mark'), icon: 'eye', dur: 20, debuff: true, mods: { dmgTakenPct: 20 }, fx: 'mark' }, c); X.sfx('debuff', t); },
  },
  r_rapid: {
    cls: 'ranger', lvl: 40, name: 'Fırtına Atışı|Rapid Fire', icon: 'tornado', theme: 'lightning', target: 'self', cost: 0, cd: 90, gcd: false, ult: true,
    desc: () => L('12 sn boyunca %60 hız ve odak harcamadan atış.|For 12 sec, gain 60% haste and your shots cost no focus.'),
    run(c, t, X) { X.buff(c, { id: 'rapid', name: L('Fırtına Atışı|Rapid Fire'), icon: 'tornado', dur: 12, mods: { haste: 60 }, flags: { freeCast: 1 }, fx: 'haste' }, c); X.sfx('buff', c); },
  },

  // ================================================================ CLERIC
  c_smite: {
    cls: 'cleric', lvl: 1, name: 'Kutsal Çarpma|Smite', icon: 'sun', theme: 'holy', target: 'enemy', cost: 3, cast: 1.4, cd: 0, anim: 'release',
    desc: (u, X) => L(`Hedefe ${D(X, u, 1.35)} kutsal hasar verir.|Smite an enemy for ${D(X, u, 1.35)} holy damage.`),
    run(c, t, X) { X.fx.smite(t); X.dmg(c, t, { coef: 1.35 * c.tm('c_smite'), school: 'holy' }); X.sfx('holy_cast', t, { vol: 0.6 }); if (c.tal('atonement')) for (const a of X.allies(c, 30).sort((a, b) => a.hpPct - b.hpPct).slice(0, 1)) X.heal(c, a, { coef: 0.5 * c.tal('atonement') }); },
  },
  c_heal: {
    cls: 'cleric', lvl: 1, name: 'İyileştir|Heal', icon: 'heal_hand', theme: 'holy', target: 'ally', cost: 6, cast: 1.6, cd: 0, anim: 'raise',
    desc: (u, X) => L(`Dost bir hedefi ${D(X, u, 2.4, 1)} iyileştirir.|Heal a friendly target for ${D(X, u, 2.4, 1)}.`),
    run(c, t, X) { X.heal(c, t, { coef: 2.4 * c.tm('c_heal') }); X.fx.burst(t.pos, 'heal', { y: 1 }); X.sfx('heal', t); },
  },
  c_renew: {
    cls: 'cleric', lvl: 4, name: 'Yenilenme|Renew', icon: 'renew', theme: 'nature', target: 'ally', cost: 5, cd: 0,
    desc: (u, X) => L(`12 sn içinde ${D(X, u, 2.2, 1)} iyileştirir.|Heal the target for ${D(X, u, 2.2, 1)} over 12 sec.`),
    run(c, t, X) { X.hot(c, t, { id: 'renew', name: L('Yenilenme|Renew'), icon: 'renew', dur: 12, coef: 2.2 * c.tm('c_renew'), ticks: 4, fx: 'renew' }); X.sfx('heal', t, { pitch: 1.3, vol: 0.6 }); },
  },
  c_shield: {
    cls: 'cleric', lvl: 6, name: 'Kutsal Kalkan|Holy Shield', icon: 'shield_glow', theme: 'holy', target: 'ally', cost: 7, cd: 6,
    desc: (u, X) => L(`Hedefe 15 sn boyunca ${D(X, u, 2.6, 1)} hasarı emen bir kalkan verir.|Shield an ally, absorbing ${D(X, u, 2.6, 1)} damage for 15 sec.`),
    can: (c, t) => t?.hasBuff('weakSoul') ? L('Hedefin ruhu henüz zayıf.|Target\'s soul is still weakened.') : null,
    run(c, t, X) { X.buff(t, { id: 'holyshield', name: L('Kutsal Kalkan|Holy Shield'), icon: 'shield_glow', dur: 15, absorb: X.amount(c, 2.6 * c.tm('c_shield'), { heal: true }), fx: 'holyShield' }, c); X.buff(t, { id: 'weakSoul', name: L('Zayıf Ruh|Weakened Soul'), icon: 'soul', dur: 12, debuff: true, noDispel: true }); X.sfx('shield_up', t); },
  },
  c_fire: {
    cls: 'cleric', lvl: 10, name: 'Kutsal Ateş|Holy Fire', icon: 'halo', theme: 'holy', target: 'enemy', cost: 6, cast: 1.0, cd: 8, anim: 'release',
    desc: (u, X) => L(`${D(X, u, 1.0)} kutsal hasar ve 8 sn içinde ${D(X, u, 1.3)} yanma hasarı.|Deal ${D(X, u, 1.0)} holy damage plus ${D(X, u, 1.3)} over 8 sec.`),
    run(c, t, X) { X.fx.smite(t); X.dmg(c, t, { coef: 1.0, school: 'holy' }); X.dot(c, t, { id: 'holyfire', name: L('Kutsal Ateş|Holy Fire'), icon: 'halo', dur: 8, coef: 1.3, ticks: 4, school: 'holy', fx: 'burnHoly' }); X.sfx('fire_cast', t, { pitch: 1.4 }); },
  },
  c_nova: {
    cls: 'cleric', lvl: 14, name: 'Kutsal Dalga|Holy Nova', icon: 'sparkles', theme: 'holy', target: 'self', cost: 8, cd: 0, anim: 'raise',
    desc: (u, X) => L(`8 metre içindeki dostları ${D(X, u, 0.9, 1)} iyileştirir, düşmanlara ${D(X, u, 0.7)} hasar verir.|Heal allies within 8 yards for ${D(X, u, 0.9, 1)} and damage enemies for ${D(X, u, 0.7)}.`),
    run(c, t, X) { for (const a of X.allies(c, 8)) X.heal(c, a, { coef: 0.9 * c.tm('c_nova') }); for (const e of X.enemies(c, 8)) X.dmg(c, e, { coef: 0.7, school: 'holy', aoe: true }); X.fx.ring(c.pos, 8, 0xffe68a); X.fx.burst(c.pos, 'holy', { n: 40, r: 6 }); X.sfx('holy_cast', c); },
  },
  c_divine: {
    cls: 'cleric', lvl: 18, name: 'İlahi Işık|Divine Light', icon: 'sun', theme: 'gold', target: 'ally', cost: 10, cast: 2.5, cd: 0, anim: 'raise',
    desc: (u, X) => L(`Yavaş ama çok güçlü bir iyileştirme: ${D(X, u, 5, 1)}.|A slow but powerful heal for ${D(X, u, 5, 1)}.`),
    run(c, t, X) { X.heal(c, t, { coef: 5 * c.tm('c_divine') }); X.fx.pillar(t.pos, 0xffe68a); X.sfx('heal', t, { pitch: 0.8 }); },
  },
  c_blessing: {
    cls: 'cleric', lvl: 24, name: 'Takdis|Blessing', icon: 'star', theme: 'gold', target: 'self', cost: 10, cd: 5,
    desc: () => L('Grubundaki herkesin tüm özelliklerini 30 dk boyunca %8 artırır.|Increases all stats of your party by 8% for 30 min.'),
    run(c, t, X) { for (const a of X.allies(c, 40)) X.buff(a, { id: 'blessing', name: L('Takdis|Blessing'), icon: 'star', dur: 1800, pct: { stats: 8 }, persistDeath: true }, c); X.fx.burst(c.pos, 'holy', { n: 30 }); X.sfx('buff', c); },
  },
  c_hammer: {
    cls: 'cleric', lvl: 32, name: 'Adalet Çekici|Hammer of Justice', icon: 'hammer', theme: 'gold', target: 'enemy', range: 20, cost: 5, cd: 30, anim: 'throw',
    desc: (u, X) => L(`Hedefe ${D(X, u, 0.8)} hasar verip 4 sn sersemletir.|Deal ${D(X, u, 0.8)} damage and stun the target for 4 sec.`),
    run(c, t, X) { X.proj(c, t, 'holy', 30, () => { X.dmg(c, t, { coef: 0.8, school: 'holy' }); X.buff(t, X.B.stun(4)); }); X.sfx('holy_cast', c); },
  },
  c_ascend: {
    cls: 'cleric', lvl: 40, name: 'İlahi Yükseliş|Divine Ascension', icon: 'halo', theme: 'holy', target: 'self', cost: 0, cd: 120, gcd: false, ult: true,
    desc: () => L('12 sn boyunca iyileştirmelerin %50 güçlenir ve mana harcamazsın.|For 12 sec, your heals are 50% stronger and cost no mana.'),
    run(c, t, X) { X.buff(c, { id: 'ascend', name: L('İlahi Yükseliş|Divine Ascension'), icon: 'halo', dur: 12, mods: { healPct: 50 }, flags: { freeCast: 1 }, fx: 'wings' }, c); X.sfx('holy_cast', c, { pitch: 0.8 }); },
  },

  // ================================================================ ROGUE
  g_strike: {
    cls: 'rogue', lvl: 1, name: 'Sinsi Darbe|Sinister Strike', icon: 'dagger', theme: 'physical', target: 'enemy', melee: true, cost: 40, cd: 0, anim: 'dual', combo: 1,
    desc: (u, X) => L(`${D(X, u, 1.25)} hasar verir ve 1 kombo puanı kazandırır.|Deal ${D(X, u, 1.25)} damage and award 1 combo point.`),
    run(c, t, X) { X.dmg(c, t, { coef: 1.25 * c.tm('g_strike') }); X.poisonProc(c, t); X.sfx('swing', c); },
  },
  g_evis: {
    cls: 'rogue', lvl: 3, name: 'Parçalama|Eviscerate', icon: 'slash', theme: 'blood', target: 'enemy', melee: true, cost: 35, cd: 0, anim: 'thrust', finisher: true,
    desc: (u, X) => L(`Bitirici: kombo puanı başına ${D(X, u, 0.8)} hasar (5 puanla ${D(X, u, 4.6)}).|Finisher: deals ${D(X, u, 0.8)} damage per combo point (${D(X, u, 4.6)} at 5 points).`),
    can: c => c.combo < 1 ? L('Kombo puanı gerekli.|Requires combo points.') : null,
    run(c, t, X) { X.dmg(c, t, { coef: (0.6 + 0.8 * c.combo) * c.tm('g_evis'), critBonus: c.combo * 3 }); X.sfx('crit', c); if (c.combo >= 5) X.shake(c, 0.25); },
  },
  g_stealth: {
    cls: 'rogue', lvl: 5, name: 'Gizlen|Stealth', icon: 'stealth', theme: 'shadow', target: 'self', cost: 0, cd: 8, gcd: false,
    desc: () => L('Gölgelere karışırsın. Düşmanlar seni fark etmez; gizlenmişken ilk saldırın %80 daha fazla hasar verir. Savaşta bekleme süresi 30 sn.|Melt into the shadows. Enemies won\'t notice you, and your first attack from stealth deals 80% more damage. 30 sec cooldown in combat.'),
    run(c, t, X) {
      if (c.inCombat) { c.cds.g_stealth = 30; for (const u of X.enemies(c, 40)) if (u.target === c) { u.threat?.delete(c); u.target = null; } }
      X.buff(c, { id: 'stealth', name: L('Gizlenme|Stealth'), icon: 'stealth', dur: 60, mods: { speed: -15 }, flags: { stealth: 1 } }, c); X.sfx('stealth', c);
      c.combatT = 99;
    },
  },
  g_kidney: {
    cls: 'rogue', lvl: 8, name: 'Böbrek Darbesi|Kidney Shot', icon: 'stun', theme: 'physical', target: 'enemy', melee: true, cost: 25, cd: 20, anim: 'thrust', finisher: true,
    desc: () => L('Bitirici: hedefi 1 sn + kombo puanı başına 0.6 sn sersemletir.|Finisher: stuns the target for 1 sec plus 0.6 sec per combo point.'),
    can: c => c.combo < 1 ? L('Kombo puanı gerekli.|Requires combo points.') : null,
    run(c, t, X) { X.dmg(c, t, { coef: 0.4 }); X.buff(t, X.B.stun(1 + 0.6 * c.combo)); X.sfx('hit', t); },
  },
  g_poison: {
    cls: 'rogue', lvl: 10, name: 'Zehirli Bıçaklar|Poisoned Blades', icon: 'poison_drop', theme: 'poison', target: 'self', cost: 0, cd: 3,
    desc: (u, X) => L(`30 dk boyunca saldırıların 5 kata kadar birikebilen zehir uygular (kat başına 6 sn'de ${D(X, u, 0.5)}).|For 30 min, your attacks apply poison stacking up to 5 times (${D(X, u, 0.5)} over 6 sec per stack).`),
    run(c, t, X) { X.buff(c, { id: 'poisonblades', name: L('Zehirli Bıçaklar|Poisoned Blades'), icon: 'poison_drop', dur: 1800, persistDeath: true }, c); X.sfx('poison', c); },
  },
  g_fan: {
    cls: 'rogue', lvl: 14, name: 'Bıçak Yelpazesi|Fan of Knives', icon: 'dagger_throw', theme: 'physical', target: 'self', cost: 50, cd: 0, anim: 'spin', animDur: 0.5, combo: 1,
    desc: (u, X) => L(`Etrafındaki tüm düşmanlara ${D(X, u, 0.8)} hasar veren bıçaklar fırlatır. +1 kombo.|Throw knives at all nearby enemies for ${D(X, u, 0.8)} damage. +1 combo point.`),
    run(c, t, X) { const es = X.enemies(c, 7); for (const e of es) { X.dmg(c, e, { coef: 0.8 * c.tm('g_fan'), aoe: true }); X.poisonProc(c, e); } X.fx.knives(c); X.sfx('swing', c, { pitch: 1.4 }); if (es.length && !c.target) c.target = es[0]; },
  },
  g_step: {
    cls: 'rogue', lvl: 18, name: 'Gölge Adımı|Shadowstep', icon: 'smoke', theme: 'shadow', target: 'enemy', range: 25, cost: 0, cd: 15, gcd: false,
    desc: () => L('Hedefin arkasına ışınlanırsın; sonraki saldırın %30 daha fazla hasar verir.|Step behind the target; your next attack deals 30% more damage.'),
    run(c, t, X) { X.fx.burst(c.pos, 'shadow', { n: 20 }); X.behind(c, t); X.buff(c, { id: 'shadowstep', name: L('Gölge Adımı|Shadowstep'), icon: 'smoke', dur: 5, mods: { dmgPct: 30 }, consumeOnHit: true }, c); X.fx.burst(c.pos, 'shadow', { n: 20 }); X.sfx('stealth', c); },
  },
  g_evasion: {
    cls: 'rogue', lvl: 24, name: 'Kaçınma|Evasion', icon: 'sprint', theme: 'shadow', target: 'self', cost: 0, cd: 60, gcd: false,
    desc: () => L('10 sn boyunca kaçınma şansın %50 artar.|Increases your dodge chance by 50% for 10 sec.'),
    run(c, t, X) { X.buff(c, { id: 'evasion', name: L('Kaçınma|Evasion'), icon: 'sprint', dur: 10, mods: { dodge: 50 }, fx: 'haste' }, c); X.sfx('buff', c); },
  },
  g_rupture: {
    cls: 'rogue', lvl: 32, name: 'Kanatma|Rupture', icon: 'blood_drop', theme: 'blood', target: 'enemy', melee: true, cost: 25, cd: 0, anim: 'slash', finisher: true,
    desc: (u, X) => L(`Bitirici: 12 sn içinde kombo puanı başına ${D(X, u, 0.9)} kanama hasarı.|Finisher: causes ${D(X, u, 0.9)} bleed damage per combo point over 12 sec.`),
    can: c => c.combo < 1 ? L('Kombo puanı gerekli.|Requires combo points.') : null,
    run(c, t, X) { X.dot(c, t, { id: 'rupture', name: L('Kanatma|Rupture'), icon: 'blood_drop', dur: 12, coef: (1 + 0.9 * c.combo) * c.tm('g_rupture'), ticks: 6, fx: 'bleed' }); X.sfx('swing', c); },
  },
  g_flurry: {
    cls: 'rogue', lvl: 40, name: 'Bıçak Fırtınası|Blade Flurry', icon: 'tornado', theme: 'physical', target: 'self', cost: 0, cd: 90, gcd: false, ult: true,
    desc: () => L('15 sn boyunca %30 hız; saldırıların yakındaki 2 düşmana daha sıçrar.|For 15 sec, gain 30% haste and your attacks strike 2 additional nearby enemies.'),
    run(c, t, X) { X.buff(c, { id: 'flurry', name: L('Bıçak Fırtınası|Blade Flurry'), icon: 'tornado', dur: 15, mods: { haste: 30 }, flags: { cleave: 2 }, fx: 'haste' }, c); X.sfx('buff', c); },
  },

  // ================================================================ NECROMANCER
  n_bolt: {
    cls: 'necro', lvl: 1, name: 'Gölge Oku|Shadow Bolt', icon: 'death_coil', theme: 'shadow', target: 'enemy', cost: 4, cast: 1.5, cd: 0, anim: 'release',
    desc: (u, X) => L(`Hedefe ${D(X, u, 1.5)} gölge hasarı veren bir ok fırlatır.|Launch a bolt of shadow that deals ${D(X, u, 1.5)} damage.`),
    run(c, t, X) { X.sfx('shadow_cast', c); X.proj(c, t, 'shadow', 22, () => X.dmg(c, t, { coef: 1.5 * c.tm('n_bolt'), school: 'shadow' })); },
  },
  n_corrupt: {
    cls: 'necro', lvl: 3, name: 'Yozlaşma|Corruption', icon: 'skull', theme: 'shadow', target: 'enemy', cost: 4, cd: 0, anim: 'cast', animDur: 0.4,
    desc: (u, X) => L(`14 sn içinde ${D(X, u, 2.2)} gölge hasarı veren lanet.|A curse dealing ${D(X, u, 2.2)} shadow damage over 14 sec.`),
    run(c, t, X) { X.dot(c, t, { id: 'corruption', name: L('Yozlaşma|Corruption'), icon: 'skull', dur: 14, coef: 2.2 * c.tm('n_corrupt'), ticks: 7, school: 'shadow', fx: 'shadowDot' }); X.sfx('shadow_cast', t, { vol: 0.5 }); },
  },
  n_skeleton: {
    cls: 'necro', lvl: 5, name: 'İskelet Çağır|Raise Skeleton', icon: 'summon', theme: 'shadow', target: 'self', cost: 8, cast: 1.5, cd: 3, castAnim: 'up',
    desc: u => L(`Senin için savaşan bir iskelet savaşçı çağırırsın (en fazla ${2 + (u.tal?.('legion') || 0)}).|Raise a skeleton warrior to fight for you (max ${2 + (u.tal?.('legion') || 0)}).`),
    can: c => c.summons.filter(s => !s.dead && s.data.petType === 'skeleton').length >= 2 + c.tal('legion') + (c.powers?.has('pw_extra_skeleton') ? 1 : 0) ? L('En fazla iskelet sayısına ulaştın.|You have the maximum number of skeletons.') : null,
    run(c, t, X) { X.summon(c, 'pet_skeleton', { petType: 'skeleton' }); X.sfx('summon', c); },
  },
  n_drain: {
    cls: 'necro', lvl: 8, name: 'Can Emme|Drain Life', icon: 'drain', theme: 'blood', target: 'enemy', cost: 7, channel: 3, ticks: 6, cd: 0, castAnim: 'forward',
    desc: (u, X) => L(`3 sn boyunca saniyede ${D(X, u, 0.8)} hasar verir ve verdiğin hasar kadar iyileşirsin.|Drain ${D(X, u, 0.8)} health per second for 3 sec, healing yourself for the damage dealt.`),
    tick(c, t, X) { const d = X.dmg(c, t, { coef: 0.4 * c.tm('n_drain'), school: 'shadow', noSound: true }); if (d > 0) X.heal(c, c, { amount: d, silent: false }); X.fx.beam(c, t, 0xb84aff, 0.4); },
  },
  n_bonearmor: {
    cls: 'necro', lvl: 10, name: 'Kemik Zırhı|Bone Armor', icon: 'bone', theme: 'shadow', target: 'self', cost: 6, cd: 20,
    desc: (u, X) => L(`20 sn boyunca ${D(X, u, 2.6)} hasarı emen kemik zırh.|Bone armour absorbing ${D(X, u, 2.6)} damage for 20 sec.`),
    run(c, t, X) { X.buff(c, { id: 'bonearmor', name: L('Kemik Zırhı|Bone Armor'), icon: 'bone', dur: 20, absorb: X.amount(c, 2.6), fx: 'bone' }, c); X.sfx('bone', c); },
  },
  n_explosion: {
    cls: 'necro', lvl: 14, name: 'Ceset Patlaması|Corpse Explosion', icon: 'explosion', theme: 'blood', target: 'enemy', cost: 7, cd: 8, anim: 'release',
    desc: (u, X) => L(`Hedefin etrafında patlama: 5 metre içindeki düşmanlara ${D(X, u, 1.4)} gölge hasarı.|An explosion around the target dealing ${D(X, u, 1.4)} shadow damage to enemies within 5 yards.`),
    run(c, t, X) { const p = t.pos; for (const e of X.enemiesAt(c, p.x, p.z, 5)) X.dmg(c, e, { coef: 1.4 * c.tm('n_explosion'), school: 'shadow', aoe: true }); X.fx.burst(p, 'blood', { n: 40, r: 5 }); X.fx.ring(p, 5, 0x8a1a3a); X.sfx('explosion', t, { pitch: 1.2 }); },
  },
  n_fear: {
    cls: 'necro', lvl: 18, name: 'Dehşet|Terror', icon: 'ghost', theme: 'shadow', target: 'enemy', cost: 5, cd: 20, anim: 'cast', animDur: 0.4,
    desc: () => L('Hedef 4 sn boyunca dehşet içinde kaçar.|The target flees in terror for 4 sec.'),
    run(c, t, X) { X.buff(t, { id: 'fear', name: L('Dehşet|Terror'), icon: 'ghost', dur: 4, debuff: true, flags: { fear: 1 }, data: { from: c }, fx: 'fear' }, c); X.sfx('shadow_cast', t); },
  },
  n_harvest: {
    cls: 'necro', lvl: 24, name: 'Ruh Hasadı|Soul Harvest', icon: 'soul', theme: 'shadow', target: 'self', cost: 9, cd: 15, anim: 'raise',
    desc: (u, X) => L(`8 metre içindeki düşmanlara ${D(X, u, 0.9)} hasar verir, toplam hasarın yarısı kadar iyileşirsin.|Deal ${D(X, u, 0.9)} damage to enemies within 8 yards and heal for half the total.`),
    run(c, t, X) { let tot = 0; for (const e of X.enemies(c, 8)) { tot += X.dmg(c, e, { coef: 0.9, school: 'shadow', aoe: true }); X.fx.beam(e, c, 0x8affc8, 0.5); } if (tot) X.heal(c, c, { amount: tot * 0.5 }); X.fx.ring(c.pos, 8, 0x6affb8); X.sfx('shadow_cast', c, { pitch: 0.7 }); },
  },
  n_spear: {
    cls: 'necro', lvl: 32, name: 'Kemik Mızrağı|Bone Spear', icon: 'bone_spear', theme: 'physical', target: 'enemy', cost: 8, cd: 10, anim: 'release',
    desc: (u, X) => L(`Hedef yönünde ilerleyen ve yolundaki herkesi delip geçen mızrak: ${D(X, u, 2.6)} hasar.|A spear that pierces everything in a line for ${D(X, u, 2.6)} damage.`),
    run(c, t, X) { const yaw = Math.atan2(t.pos.x - c.pos.x, t.pos.z - c.pos.z); X.fx.spear(c, yaw, 28); for (const e of X.line(c, yaw, 28, 2.5)) X.dmg(c, e, { coef: 2.6, school: 'shadow', aoe: true }); X.sfx('bone', c); },
  },
  n_lich: {
    cls: 'necro', lvl: 40, name: 'Lich Formu|Lich Form', icon: 'skull_crown', theme: 'shadow', target: 'self', cost: 0, cd: 120, gcd: false, ult: true,
    desc: () => L('15 sn boyunca lich\'e dönüşürsün: +%40 hasar, iskeletlerin +%50 hasar.|Become a lich for 15 sec: +40% damage, and your skeletons deal +50% damage.'),
    run(c, t, X) {
      X.buff(c, { id: 'lich', name: L('Lich Formu|Lich Form'), icon: 'skull_crown', dur: 15, mods: { dmgPct: 40 }, fx: 'lich' }, c);
      for (const s of c.summons) if (!s.dead) X.buff(s, { id: 'lichPet', name: 'Lich', icon: 'skull', dur: 15, mods: { dmgPct: 50 } }, c);
      X.sfx('roar', c, { pitch: 1.6, vol: 0.6 });
    },
  },
};

// Class skill lists in unlock order
export const CLASS_SKILLS = {};
for (const id in SKILLS) {
  const s = SKILLS[id]; s.id = id;
  (CLASS_SKILLS[s.cls] ||= []).push(id);
}
for (const k in CLASS_SKILLS) CLASS_SKILLS[k].sort((a, b) => SKILLS[a].lvl - SKILLS[b].lvl);

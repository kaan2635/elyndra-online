// Legendary item powers, hooked into the combat pipeline.
import { G, on } from '../core/state.js';
import { L } from '../core/i18n.js';
import { chance } from '../core/util.js';

export const Powers = {
  // called by combat.dmg after damage is applied (direct or dot)
  afterDamage(src, tgt, a, crit, o) {
    if (!src || !src.powers || o.dot || o.fromPower) return;
    const P = src.powers;
    if (crit && P.has('pw_crit_heal')) G.combat.heal(src, src, { amount: src.stats.maxHp * 0.02, silent: true, noThreat: true });
    if (P.has('pw_lightning_proc') && !tgt.dead && chance(0.15)) {
      G.vfx?.beam(src, tgt, 0xa8d8ff, 0.3);
      G.combat.dmg(src, tgt, { coef: 0.6, school: 'arcane', fromPower: true, canCrit: true });
    }
  },
  afterTaken(tgt, src, a, o) {
    const P = tgt.powers; if (!P || tgt.dead) return;
    if (P.has('pw_wall_reflect') && tgt.hasBuff('shieldwall') && src && !src.dead && !o.fromPower) G.combat.dmg(tgt, src, { amount: a * 0.3, school: 'holy', canCrit: false, fromPower: true });
    if (P.has('pw_low_shield') && tgt.hpPct < 0.35 && !(tgt.cds.pw_low_shield > 0)) {
      tgt.cds.pw_low_shield = 60;
      G.combat.buff(tgt, { id: 'mountainheart', name: L('Dağın Kalbi|Heart of the Mountain'), icon: 'shield_glow', dur: 10, absorb: tgt.stats.maxHp * 0.3, fx: 'holyShield' }, tgt);
    }
  },
  afterHeal(src, tgt, eff, o) {
    if (!src?.powers || o.echo || eff <= 0) return;
    if (src.powers.has('pw_heal_echo')) {
      const allies = G.combat.alliesNear(src, src.pos.x, src.pos.z, 30).filter(x => x !== tgt && x.hpPct < 1).sort((a, b) => a.hpPct - b.hpPct);
      if (allies[0]) G.combat.heal(src, allies[0], { amount: eff * 0.35, echo: true });
    }
  },
};
G.powers = Powers;

on('skillUsed', (u, sk, t) => {
  const P = u.powers; if (!P) return;
  if (sk.finisher && P.has('pw_finisher_refund')) u.res = Math.min(u.stats.maxRes, u.res + 8 * Math.max(1, u._lastCombo || 1));
  if (sk.id === 'c_renew' && P.has('pw_renew_spread')) {
    const o = G.combat.alliesNear(u, t.pos.x, t.pos.z, 15).filter(x => x !== t && x.hpPct < 1).sort((a, b) => a.hpPct - b.hpPct)[0];
    if (o) G.combat.hot(u, o, { id: 'renew', name: L('Yenilenme|Renew'), icon: 'renew', dur: 12, coef: 2.2, ticks: 4, fx: 'renew' });
  }
  if (sk.id === 'w_whirl' && P.has('pw_whirl_storm')) {
    for (let i = 0; i < 3; i++) G.X.later(i * 0.3 + 0.05, () => { const e = G.combat.enemiesNear(u, u.pos.x, u.pos.z, 12)[Math.floor(Math.random() * 3)]; if (e) { G.vfx?.beam(u, e, 0xa8d8ff, 0.3); G.combat.dmg(u, e, { coef: 0.5, school: 'arcane', fromPower: true }); } });
  }
});

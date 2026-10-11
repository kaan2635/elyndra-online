// Using items: potions, food, elixirs, scrolls, reward boxes.
import { G, emit } from '../core/state.js';
import { L, t } from '../core/i18n.js';
import { ITEMS } from '../data/items.js';
import { removeItem, countItem, addItem, makeStack } from './items.js';
import { openBox } from './loot.js';
import { buff, heal } from './combat.js';
import { Audio } from '../audio.js';

export const Inv = {
  potionCd: 0,
  update(dt) { this.potionCd = Math.max(0, this.potionCd - dt); },
  useItemId(id) {
    const ch = G.char, p = G.player;
    const T = ITEMS[id]; if (!T || !T.use) return false;
    if (countItem(ch, id) < 1) return false;
    if (p.dead) return false;
    const u = T.use;
    if (T.lvl && p.level < T.lvl - 5 && u.potion) { /* allow lower potions always */ }
    if (u.potion) {
      if (this.potionCd > 0) { G.ui.error(t('onCooldown')); return false; }
      if (u.potion === 'mp' && p.resType !== 'mana') { G.ui.error(L('Mana kullanmıyorsun|You don\'t use mana')); return false; }
      this.potionCd = 30;
      if (u.potion === 'hp') heal(p, p, { amount: p.stats.maxHp * u.pct });
      else { const a = p.stats.maxRes * u.pct; p.res = Math.min(p.stats.maxRes, p.res + a); G.overlay?.text(p, '+' + Math.round(a), { color: '#6ab4ff' }); }
      p.playAct('drink', 0.8); Audio.sfx('potion');
      G.vfx?.burst(p.pos, u.potion === 'hp' ? 'heal' : 'frost', { n: 14 });
    } else if (u.food) {
      if (p.inCombat) { G.ui.error(L('Savaşta yemek yiyemezsin|Can\'t eat in combat')); return false; }
      G.playerCtl.sit();
      Audio.sfx('eat');
      if (u.buff) buff(p, { ...u.buff, name: L(u.buff.name), persistDeath: true }, p);
      if (u.regen) buff(p, { id: 'eating', name: L('Yemek Yiyor|Eating'), icon: T.icon, dur: 10, interval: 1, tick: x => { if (!x.sitting) { x.removeBuff('eating'); return; } heal(x, x, { amount: x.stats.maxHp * u.regen, silent: true }); } }, p);
    } else if (u.buff) {
      buff(p, { ...u.buff, name: L(u.buff.name), persistDeath: true }, p);
      Audio.sfx('potion'); p.playAct('drink', 0.8);
    } else if (u.teleportHome) {
      if (p.inCombat) { G.ui.error(L('Savaşta kullanılamaz|Cannot use in combat')); return false; }
      G.travel?.goHome();
    } else if (u.openBox) {
      const r = openBox(u.openBox, p.level, p.cls);
      removeItem(ch, id, 1);
      ch.gold += r.gold;
      G.ui.toast('chest_box', L('Sandık açıldı: |Opened: ') + L(T.name) + ' (+' + r.gold + ' ' + L('altın|gold') + ')', '#ffd660');
      for (const it of r.items) G.progress.giveItem(it);
      Audio.sfx('loot_rare');
      emit('bagChanged');
      return true;
    } else return false;
    removeItem(ch, id, 1);
    emit('itemUsed', id);
    return true;
  },
};
G.inv = Inv;

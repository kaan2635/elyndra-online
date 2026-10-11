// Experience, levelling, kill rewards, death & respawn, rested XP.
import { G, emit, on } from '../core/state.js';
import { L, t } from '../core/i18n.js';
import { clamp, fmtNum } from '../core/util.js';
import { S, xpNeed, mobXp, MAX_LEVEL, CLASSES } from '../data/classes.js';
import { SKILLS, CLASS_SKILLS } from '../data/skills.js';
import { refreshHero } from './hero.js';
import { rollDrops } from './loot.js';
import { addItem, makeStack, itemName, itemColor } from './items.js';
import { Audio } from '../audio.js';

export const Progress = {
  init() {
    on('unitDied', (u, killer) => this.onDeath(u, killer));
  },
  // who gets credit: player if player/pet/party participated
  creditPlayer(u, killer) {
    const p = G.player; if (!p) return false;
    if (killer === p || killer?.owner === p) return true;
    if (u.threat && (u.threat.has(p) || [...u.threat.keys()].some(k => k.owner === p || (k.inParty && G.party?.has(k))))) return true;
    if (killer?.inParty && G.party?.has(killer)) return true;
    return false;
  },
  onDeath(u, killer) {
    if (u === G.player) { this.playerDied(killer); return; }
    if (u.kind === 'pet') { if (u.owner?.powers?.has('pw_skel_explode') && u.data.petType === 'skeleton') { for (const e of G.combat.enemiesNear(u.owner, u.pos.x, u.pos.z, 5)) G.combat.dmg(u.owner, e, { coef: 1.2, school: 'shadow', aoe: true }); G.vfx?.burst(u.pos, 'shadow', { n: 30 }); } return; }
    u.data.onDeath?.();
    if (u.kind !== 'monster' || u.data.tpl?.critter) { if (u.data.tpl?.critter && this.creditPlayer(u, killer)) emit('killed', u); return; }
    if (!this.creditPlayer(u, killer)) return;
    const p = G.player, ch = G.char;
    // xp
    const dl = u.level - p.level;
    let mult = dl >= 0 ? 1 + Math.min(dl, 5) * 0.06 : dl >= -4 ? 1 + dl * 0.08 : dl >= -8 ? 0.4 + (dl + 8) * 0.05 : 0;
    const partyN = G.party ? G.party.members().filter(m => !m.dead).length : 0;
    if (partyN > 0 && !G.world.dungeon) mult *= 1 / (1 + partyN * 0.25);
    if (G.world.dungeon) mult *= 1.15;
    const xp = Math.round(u.xp * mult);
    if (xp > 0) this.giveXp(xp, u);
    // loot
    if (!u.data.noLoot) {
      const drops = rollDrops(u, p);
      if (drops.gold) { const g = Math.round(drops.gold * (1 + (p.stats.goldPct || 0) / 100) * (p.powers.has('pw_gold') ? 1.5 : 1)); ch.gold += g; G.overlay?.text(u, '+' + g + ' ' + L('altın|gold'), { color: '#ffd660', small: true }); Audio.sfx('coin', { vol: 0.35 }); emit('goldGained', g); }
      for (const it of drops.items) this.giveItem(it, u);
    }
    ch.stats = ch.stats || {}; ch.stats.kills = (ch.stats.kills || 0) + 1;
    if (u.elite) ch.stats.elites = (ch.stats.elites || 0) + 1;
    if (u.isBoss) ch.stats.bosses = (ch.stats.bosses || 0) + 1;
    if (p.powers.has('pw_kill_haste')) G.combat.buff(p, { id: 'pw_haste', name: L('Zamanın Halkası|Band of Hours'), icon: 'hourglass', dur: 6, mods: { haste: 25 } }, p);
    emit('killed', u);
  },
  giveItem(it, src) {
    const ch = G.char;
    const name = itemName(it), qty = it.qty || 1;
    if (addItem(ch, it)) {
      const rar = it.rarity;
      G.chat?.system(L('Ganimet: |Loot: ') + name + (qty > 1 ? ' x' + qty : ''), 'loot');
      if (!it.id) {
        G.ui?.toast(null, name, itemColor(it));
        if (rar === 'legendary' || rar === 'mythic') { Audio.sfx('loot_legendary'); G.ui?.banner(L('Efsanevi Ganimet!|Legendary Loot!'), name, 3); G.vfx?.pillar(G.player.pos, 0xff9a2a, 1.4); }
        else if (rar === 'epic' || rar === 'rare') Audio.sfx('loot_rare', { vol: 0.7 });
        else Audio.sfx('loot', { vol: 0.5 });
        G.char.newItems = G.char.newItems || {}; G.char.newItems[it.uid] = 1;
      } else Audio.sfx('loot', { vol: 0.35 });
      return true;
    }
    return false;
  },
  giveXp(amount, src) {
    const p = G.player, ch = G.char;
    if (p.level >= MAX_LEVEL) { G.mastery?.addXp(amount); return; }
    let bonus = 0;
    if (ch.rested > 0 && src) { bonus = Math.min(ch.rested, amount); ch.rested -= bonus; }
    const pct = (p.stats.xpPct || 0) + (G.guild?.xpBonus?.() || 0);
    const total = Math.round((amount + bonus) * (1 + pct / 100));
    ch.xp += total;
    if (src) G.overlay?.text(src.pos ? src : p, '+' + fmtNum(total) + ' ' + t('xp'), { color: '#c8a0ff', small: true });
    emit('xpGained', total);
    while (ch.xp >= xpNeed(p.level) && p.level < MAX_LEVEL) { ch.xp -= xpNeed(p.level); this.levelUp(); }
    if (p.level >= MAX_LEVEL) ch.xp = 0;
  },
  levelUp() {
    const p = G.player, ch = G.char;
    ch.level++; p.level = ch.level;
    refreshHero(p);
    p.hp = p.stats.maxHp; if (p.resType === 'mana') p.res = p.stats.maxRes;
    G.vfx?.levelUp(p);
    Audio.sfx('levelup');
    G.ui?.banner(t('levelUp'), t('reachedLevel', ch.level), 3.5);
    G.chat?.system(t('reachedLevel', ch.level), 'system');
    // auto-place newly unlocked skills
    const newly = (CLASS_SKILLS[ch.cls] || []).filter(id => SKILLS[id].lvl === ch.level);
    for (const id of newly) {
      G.ui?.toast(SKILLS[id].icon, L('Yeni yetenek: |New skill: ') + L(SKILLS[id].name), '#ffe08a');
      if (!ch.bar.includes(id)) { const i = ch.bar.findIndex((x, k) => !x && k < 8); if (i >= 0) ch.bar[i] = id; }
    }
    if (ch.level >= 10) G.ui?.toast('talent', L('Yetenek puanı kazandın!|You earned a talent point!'), '#8affb0');
    emit('barChanged'); emit('levelUp', ch.level);
    for (const m of G.party?.members() || []) G.party.syncLevel?.(m);
    G.save.save();
  },
  playerDied(killer) {
    const ch = G.char;
    ch.stats = ch.stats || {}; ch.stats.deaths = (ch.stats.deaths || 0) + 1;
    Audio.sfx('death_player');
    Audio.setCombat(false);
    G.playerCtl.moveTarget = null; G.playerCtl.pending = null;
    emit('playerDied', killer);
  },
  respawn() {
    const p = G.player; if (!p.dead) return;
    if (G.world.dungeon) { G.dungeons?.respawnPlayer(); return; }
    // nearest attuned waystone in this zone, or zone start
    const z = G.zones.current;
    let best = z.start, bd = 1e9;
    for (const w of z.waystones || []) { const d = (w.x - p.pos.x) ** 2 + (w.z - p.pos.z) ** 2; if (d < bd) { bd = d; best = { x: w.x + 2, z: w.z + 3 }; } }
    this.revive(p, best, 0.6);
  },
  revive(u, pos, pct = 0.6) {
    u.dead = false; u.deathT = 0; u.anim.dead = 0;
    u.hp = Math.round(u.stats.maxHp * pct); if (u.resType === 'mana') u.res = u.stats.maxRes * pct;
    if (pos) { u.pos.x = pos.x; u.pos.z = pos.z; }
    u.threat?.clear?.();
    for (const m of G.world.units) if (m.threat?.has(u)) { m.threat.delete(u); if (m.target === u) m.target = null; }
    u.recalc();
    G.vfx?.burst(u.pos, 'holy', { n: 30 });
    if (u === G.player) { Audio.sfx('heal'); G.combat.buff(u, { id: 'revived', name: L('Diriliş|Resurrected'), icon: 'halo', dur: 6, flags: { invuln: 1 } }, u); emit('playerRevived'); }
  },
  // rested XP accumulates offline: 5% of a level per 8h, up to 1.5 levels
  applyRested(ch) {
    const now = Date.now();
    if (ch.lastSeen) {
      const hours = (now - ch.lastSeen) / 3.6e6;
      if (hours > 0.2) {
        const gain = Math.round(xpNeed(ch.level) * 0.05 * hours / 8 * 8);
        ch.rested = Math.min(Math.round(xpNeed(ch.level) * 1.5), (ch.rested || 0) + gain);
      }
    }
    ch.lastSeen = now;
  },
};
G.progress = Progress;
G.respawn = () => Progress.respawn();

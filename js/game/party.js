// Party: up to 4 companions (AI heroes) alongside the player.
import { G, emit, on } from '../core/state.js';
import { L, t } from '../core/i18n.js';
import { rand, chance, choice } from '../core/util.js';
import { CLASSES } from '../data/classes.js';
import { makeBotChar, spawnBot, HeroAI, Bots } from './bots.js';
import { refreshHero, rebuildHeroModel } from './hero.js';

const ROLE_OF = { warrior: 'tank', cleric: 'healer', mage: 'dps', ranger: 'dps', rogue: 'dps', necro: 'dps' };

export const Party = {
  list: [],
  members() { this.list = this.list.filter(u => !u.removed); return this.list; },
  has(u) { return this.list.includes(u); },
  full() { return this.members().length >= 4; },
  add(u) {
    if (this.has(u) || this.full()) return false;
    u.inParty = true;
    u.ai = new HeroAI(u, 'party', { slot: this.list.length });
    u.alwaysUpdate = true;
    this.list.push(u);
    const wi = Bots.world.indexOf(u); if (wi >= 0) Bots.world.splice(wi, 1);
    G.chat.system(L(`${u.name} gruba katıldı.|${u.name} joined the party.`), 'party');
    emit('partyChanged');
    return true;
  },
  remove(u, silent) {
    const i = this.list.indexOf(u); if (i < 0) return;
    this.list.splice(i, 1);
    u.inParty = false; u.alwaysUpdate = false;
    if (!silent) G.chat.system(L(`${u.name} gruptan ayrıldı.|${u.name} left the party.`), 'party');
    for (const s of u.summons) G.world.removeUnit(s);
    G.world.removeUnit(u);
    this.list.forEach((m, k) => { if (m.ai) m.ai.slot = k; });
    emit('partyChanged');
  },
  disband(silent) { for (const u of [...this.list]) this.remove(u, silent); },
  invite(u) {
    if (this.full()) { G.ui.error(L('Grup dolu (en fazla 5 kişi).|Party is full (max 5).')); return; }
    if (Math.abs(u.level - G.player.level) > 8) { G.chat.post(u.name, L('Seviyelerimiz çok farklı, kusura bakma.|Our levels are too far apart, sorry.'), 'whisper', u); return; }
    if (chance(0.15)) { G.chat.post(u.name, L('Şu an meşgulüm, sonra belki!|Busy right now, maybe later!'), 'whisper', u); return; }
    // scale the companion to the player's level so groups stay balanced
    this.syncLevel(u);
    this.add(u);
    G.chat.post(u.name, choice([L('Tamamdır, geliyorum!|Sure, on my way!'), L('Hadi gidelim!|Let\'s go!'), L('Selam takım!|Hi team!')]), 'party', u);
  },
  syncLevel(u) {
    const lvl = G.player.level;
    if (u.level === lvl) return;
    const ch = makeBotChar(lvl, u.cls, { name: u.name, race: u.race, quality: 0.6 });
    Object.assign(u.data.botChar, { level: lvl, equip: ch.equip, talents: ch.talents });
    u.level = lvl; u.equip = ch.equip; u.char = u.data.botChar;
    u.talents = ch.talents;
    refreshHero(u); u.hp = u.stats.maxHp; u.res = u.resType === 'rage' ? 0 : u.stats.maxRes;
    rebuildHeroModel(u);
  },
  // companions for a dungeon: fill missing roles
  recruitFor(roles = null) {
    const p = G.player;
    const need = roles || this.neededRoles();
    const classes = { tank: ['warrior'], healer: ['cleric'], dps: ['mage', 'ranger', 'rogue', 'necro'] };
    for (const role of need) {
      if (this.full()) break;
      const cls = choice(classes[role]);
      const ch = makeBotChar(p.level, cls, { quality: 0.65 });
      const u = spawnBot(ch, p.pos.x + rand(-3, 3), p.pos.z + rand(-3, 3), 'party', { slot: this.list.length });
      u.title = L({ tank: 'Tank|Tank', healer: 'Şifacı|Healer', dps: 'Hasar|Damage' }[role]);
      this.add(u);
    }
  },
  neededRoles() {
    const have = [ROLE_OF[G.player.cls], ...this.members().map(m => m.role)];
    const out = [];
    const want = ['tank', 'healer', 'dps', 'dps', 'dps'];
    for (const r of want) { const i = have.indexOf(r); if (i >= 0) have.splice(i, 1); else out.push(r); }
    return out.slice(0, 4 - this.members().length);
  },
  update(dt) {
    // companions revive after combat
    const p = G.player; if (!p) return;
    const anyCombat = p.inCombat || this.list.some(m => m.inCombat && !m.dead);
    for (const m of this.list) {
      if (m.dead) {
        m._rez = (m._rez || 0) + dt;
        if (!anyCombat && m._rez > 4) { m._rez = 0; G.progress.revive(m, { x: p.pos.x + rand(-2, 2), z: p.pos.z + rand(-2, 2) }, 0.7); G.chat.post(m.name, L('Teşekkürler, geri döndüm!|Thanks, I\'m back!'), 'party', m); }
      }
    }
    // player revive by party healer if the whole party isn't dead (open world)
  },
};
G.party = Party;
G.addSystem(dt => Party.update(dt));
on('sessionEnd', () => Party.disband(true));

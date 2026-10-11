// Guilds (account-wide): found or join, members, levels, perks, weekly contracts, guild chat.
import { G, emit, on } from '../core/state.js';
import { L, t, getLang } from '../core/i18n.js';
import { rand, randi, choice, chance, fmtNum, uid } from '../core/util.js';
import { CLASS_IDS, CLASSES, randomName, S, xpNeed } from '../data/classes.js';
import { makeStack } from './items.js';
import { Audio } from '../audio.js';

const PERKS = [
  { lvl: 2, name: 'Hızlı Öğrenme|Fast Learner', desc: '+%3 tecrübe|+3% experience', xp: 3 },
  { lvl: 3, name: 'Altın Kese|Golden Purse', desc: '+%5 altın|+5% gold', gold: 5 },
  { lvl: 4, name: 'Bilgelik|Wisdom', desc: '+%5 tecrübe (toplam %8)|+5% experience (8% total)', xp: 5 },
  { lvl: 5, name: 'Zanaat Birliği|Craft Guild', desc: '+%10 zanaat tecrübesi|+10% crafting experience', craft: 10 },
  { lvl: 6, name: 'Hazine Avcıları|Treasure Hunters', desc: '+%5 sihirli eşya bulma|+5% magic find', mf: 5 },
  { lvl: 8, name: 'Kahramanlar Loncası|Guild of Heroes', desc: '+%7 tecrübe (toplam %15)|+7% experience (15% total)', xp: 7 },
  { lvl: 10, name: 'Efsane Lonca|Legendary Guild', desc: '+%10 altın, +%5 sihirli eşya bulma|+10% gold, +5% magic find', gold: 10, mf: 5 },
];
const GCHAT = {
  tr: ['herkese iyi oyunlar!', 'bu hafta sözleşmeyi bitirelim', 'zindan için 2 kişi lazım', 'efsanevi düşürdüm loncam!', 'lonca seviyesi yükseliyor 💪', '{n} hoş geldin loncaya', 'yarın baskına gidiyoruz', 'güçlendirme taşı lazım olan var mı?', 'gece balık turnuvası yapalım :)', 'gg millet'],
  en: ['have fun everyone!', 'let\'s finish the contract this week', 'need 2 for a dungeon', 'just dropped a legendary guildies!', 'guild level is climbing 💪', 'welcome to the guild {n}', 'raid tomorrow', 'anyone need enhancement stones?', 'fishing contest tonight :)', 'gg all'],
};
const weekKey = () => { const d = new Date(); const j = new Date(d.getFullYear(), 0, 1); return d.getFullYear() + '-' + Math.ceil(((d - j) / 864e5 + j.getDay() + 1) / 7); };

export const Guild = {
  get g() { return G.account.guild; },
  needXp(l) { return 1000 * l * l; },
  create(name, tag) {
    const ch = G.char;
    if (ch.gold < 100) { G.ui.error(L('100 altın gerekli|Requires 100 gold')); return; }
    ch.gold -= 100;
    G.account.guild = { name, tag: tag.toUpperCase().slice(0, 4), lvl: 1, xp: 0, leader: 'me', members: this.genMembers(6), created: Date.now(), contract: null, motd: L('Hoş geldiniz!|Welcome!') };
    this.newContract();
    G.player.guildTag = G.account.guild.tag;
    Audio.sfx('achievement');
    G.ui.toast('guild', L('Lonca kuruldu: |Guild founded: ') + name, '#8affb0');
    emit('guildChanged');
  },
  joinBotGuild(name) {
    G.account.guild = { name, tag: name.slice(0, 3).toUpperCase(), lvl: randi(2, 6), xp: 0, leader: randomName(), members: this.genMembers(randi(12, 24)), created: Date.now(), contract: null, motd: L('Lonca kurallarına uyun, eğlenin!|Follow the rules, have fun!') };
    this.newContract();
    G.player.guildTag = G.account.guild.tag;
    G.ui.toast('guild', L('Loncaya katıldın: |You joined: ') + name, '#8affb0');
    emit('guildChanged');
  },
  leave() { G.account.guild = null; if (G.player) G.player.guildTag = null; emit('guildChanged'); },
  genMembers(n) {
    const lvl = G.char?.level || 10;
    return Array.from({ length: n }, () => ({ name: randomName(), cls: choice(CLASS_IDS), lvl: Math.max(1, Math.min(60, lvl + randi(-12, 12))), rank: chance(0.1) ? 'officer' : 'member', online: chance(0.35) }));
  },
  newContract() {
    const g = this.g; if (!g) return;
    const kinds = [
      { k: 'kills', n: 300, name: 'Canavar Avı|Monster Hunt', desc: 'Lonca olarak 300 düşman öldürün.|Slay 300 enemies as a guild.' },
      { k: 'quests', n: 25, name: 'Yardım Eli|Helping Hands', desc: '25 görev tamamlayın.|Complete 25 quests.' },
      { k: 'gathers', n: 120, name: 'Kaynak Seferi|Resource Drive', desc: '120 kaynak toplayın.|Gather 120 resources.' },
      { k: 'dungeons', n: 6, name: 'Zindan Haftası|Dungeon Week', desc: '6 zindan tamamlayın.|Complete 6 dungeons.' },
    ];
    const c = choice(kinds);
    g.contract = { ...c, p: 0, week: weekKey(), claimed: false };
  },
  contribute(k, n = 1, xp = 0) {
    const g = this.g; if (!g) return;
    if (g.contract?.week !== weekKey()) this.newContract();
    if (g.contract?.k === k) g.contract.p = Math.min(g.contract.n, g.contract.p + n);
    if (xp) this.addXp(xp);
  },
  addXp(x) {
    const g = this.g; if (!g || g.lvl >= 10) return;
    g.xp += x;
    while (g.lvl < 10 && g.xp >= this.needXp(g.lvl)) { g.xp -= this.needXp(g.lvl); g.lvl++; G.ui.toast('banner', L(`Lonca ${g.lvl}. seviyeye ulaştı!|Guild reached level ${g.lvl}!`), '#8affb0'); Audio.sfx('levelup', { vol: 0.5 }); emit('guildChanged'); }
  },
  perk(key) { const g = this.g; if (!g) return 0; return PERKS.filter(p => g.lvl >= p.lvl).reduce((s, p) => s + (p[key] || 0), 0); },
  xpBonus() { return this.perk('xp'); },
  perks: PERKS,
  claimContract() {
    const g = this.g, c = g?.contract; if (!c || c.p < c.n || c.claimed) return;
    c.claimed = true;
    const lvl = G.char.level;
    G.char.gold += Math.round(30 * S(lvl));
    G.progress.giveItem(makeStack('chest_daily', 2));
    G.progress.giveItem(makeStack('token_honor', 25));
    this.addXp(1500);
    Audio.sfx('quest_complete');
    emit('guildChanged');
  },
  chatter() {
    const g = this.g; if (!g) return;
    const on = g.members.filter(m => m.online); if (!on.length) return;
    const m = choice(on);
    const P = GCHAT[getLang()] || GCHAT.tr;
    G.chat.post(m.name, choice(P).replace('{n}', G.char.name), 'guild');
  },
};
G.guild = Guild;
G.addSystem(dt => {
  Guild._t = (Guild._t || 40) - dt;
  if (Guild._t <= 0) { Guild._t = rand(45, 120); if (Guild.g) { for (const m of Guild.g.members) if (chance(0.1)) m.online = !m.online; Guild.chatter(); } }
});
on('killed', u => Guild.contribute('kills', 1, u.elite ? 6 : 2));
on('questCompleted', () => Guild.contribute('quests', 1, 25));
on('gathered', () => Guild.contribute('gathers', 1, 3));
on('dungeonCleared', () => Guild.contribute('dungeons', 1, 200));
on('sessionStart', () => { if (Guild.g && G.player) G.player.guildTag = Guild.g.tag; });
// occasional invitations from bot guilds
on('levelUp', l => {
  if (Guild.g || l < 5 || !chance(0.35)) return;
  const b = G.bots?.pick(); if (!b?.guildTag) return;
  G.ui.confirm(L(`${b.name} seni "${b.guildTag}" loncasına davet ediyor. Katılmak ister misin?|${b.name} invites you to the guild "${b.guildTag}". Join?`), () => Guild.joinBotGuild(b.guildTag), { title: L('Lonca Daveti|Guild Invitation'), yes: L('Katıl|Join'), no: L('Hayır|No') });
});

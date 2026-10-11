// Social window: party, nearby adventurers, friends, guild, leaderboards.
import { G, emit } from '../core/state.js';
import { L, t } from '../core/i18n.js';
import { fmtNum, choice, randi } from '../core/util.js';
import { h, UI } from './ui.js';
import { iconURL, ICON_THEMES } from '../gfx/icons.js';
import { CLASSES, RACES, randomName, CLASS_IDS } from '../data/classes.js';

const clsIcon = c => iconURL(CLASSES[c].icon, { size: 48, ...ICON_THEMES.ui, frame: CLASSES[c].color });

UI.register('social', {
  title: () => t('menuSocial'), icon: 'users', w: 560, listen: ['partyChanged', 'guildChanged', 'friendsChanged'],
  build(w, tab) {
    if (tab) w.tab = tab;
    w.tab = w.tab || 'party';
    UI.setTabs(w, [['party', L('Grup|Party')], ['near', L('Yakındakiler|Nearby')], ['friends', L('Arkadaşlar|Friends')], ['guild', t('menuGuild')], ['online', L('Çevrimiçi|Online')], ['ladder', L('Sıralama|Leaderboard')]], w.tab, k => { w.tab = k; UI.refresh('social'); });
    const b = w.body, p = G.player;
    if (w.tab === 'party') {
      const ms = G.party.members();
      b.append(h('div.muted', { style: { fontSize: '12px', marginBottom: '8px' } }, L('En fazla 4 yoldaşla grup kurabilirsin. Yakındaki maceracıları davet et ya da zindan bulucunun otomatik yoldaşlarını kullan.|Party up with to 4 companions. Invite nearby adventurers or use the dungeon finder\'s automatic companions.')));
      b.append(h('div.card.row', h('img.ico', { src: clsIcon(p.cls) }), h('div', { style: { flex: 1 } }, h('b', p.name), h('div.muted', `${t('level')} ${p.level} ${L(CLASSES[p.cls].name)} · ` + L('Lider|Leader')))));
      for (const m of ms) b.append(h('div.card.row', { style: { marginTop: '6px' } }, h('img.ico', { src: clsIcon(m.cls) }), h('div', { style: { flex: 1 } }, h('b', m.name), h('div.muted', `${t('level')} ${m.level} ${L(CLASSES[m.cls].name)} · ${L({ tank: 'Tank|Tank', healer: 'Şifacı|Healer', dps: 'Hasar|Damage' }[m.role])}`)),
        h('button.btn.small.ghost', { onclick: () => { addFriend(m); } }, L('Arkadaş Ekle|Add Friend')), h('button.btn.small.red', { onclick: () => G.party.remove(m) }, L('Çıkar|Kick'))));
      b.append(h('div.row.wrap', { style: { marginTop: '10px' } },
        h('button.btn' + (G.party.full() ? '.disabled' : ''), { onclick: () => { G.party.recruitFor(); } }, L('Eksik Rolleri Doldur|Fill Missing Roles')),
        ms.length ? h('button.btn.red', { onclick: () => G.party.disband() }, L('Grubu Dağıt|Disband')) : null));
    } else if (w.tab === 'near') {
      const near = G.world.units.filter(u => (u.kind === 'bot' || u.kind === 'remote') && !u.inParty && u.distTo(p) < 120).sort((a, c) => a.distTo(p) - c.distTo(p));
      if (!near.length) b.append(h('div.muted', L('Yakında maceracı yok.|No adventurers nearby.')));
      for (const u of near) b.append(h('div.card.row', { style: { marginBottom: '6px' } }, h('img.ico', { src: clsIcon(u.cls) }),
        h('div', { style: { flex: 1 } }, h('b', u.name, u.guildTag ? h('span.muted', ' <' + u.guildTag + '>') : null, u.kind === 'remote' ? h('span.chip', { style: { marginLeft: '6px', color: '#7ae8ff' } }, L('Gerçek oyuncu|Real player')) : null), h('div.muted', `${t('level')} ${u.level} ${L(CLASSES[u.cls].name)} · ${Math.round(u.distTo(p))}m`)),
        u.kind === 'bot' ? h('button.btn.small.primary' + (G.party.full() ? '.disabled' : ''), { onclick: () => { G.party.invite(u); UI.refresh('social'); } }, L('Davet Et|Invite')) : null,
        h('button.btn.small.ghost', { onclick: () => addFriend(u) }, '+'),
        h('button.btn.small.ghost', { onclick: () => UI.prompt(L('Fısılda: |Whisper: ') + u.name, '', v => { if (!v) return; G.chat.post(G.player.name + ' → ' + u.name, v, 'whisper'); if (u.kind === 'bot') setTimeout(() => G.chat.post(u.name, G.bots.line('reply', {}), 'whisper', u), 1500 + Math.random() * 2000); else G.net?.whisper?.(u, v); }) }, '✉')));
    } else if (w.tab === 'friends') {
      const fr = G.account.friends || [];
      if (!fr.length) b.append(h('div.muted', L('Arkadaş listen boş. Grup veya Yakındakiler sekmesinden ekleyebilirsin.|Your friend list is empty. Add people from the Party or Nearby tabs.')));
      for (const f of fr) {
        const online = f.online ?? (f.online = Math.random() < 0.4);
        b.append(h('div.card.row', { style: { marginBottom: '6px' } }, h('img.ico', { src: clsIcon(f.cls) }), h('div', { style: { flex: 1 } }, h('b', f.name), h('div.muted', `${t('level')} ${f.lvl} ${L(CLASSES[f.cls].name)} · `, h('span', { style: { color: online ? 'var(--good)' : 'var(--ink3)' } }, online ? L('Çevrimiçi|Online') : L('Çevrimdışı|Offline')))),
          online && !G.party.full() ? h('button.btn.small.primary', { onclick: () => { const ch = G.bots ? null : null; inviteFriend(f); } }, L('Davet|Invite')) : null,
          h('button.btn.small.ghost', { onclick: () => { G.account.friends = fr.filter(x => x !== f); UI.refresh('social'); } }, '✕')));
      }
    } else if (w.tab === 'guild') guildTab(b);
    else if (w.tab === 'online') {
      const n = G.net?.peerCount?.() || 0;
      b.append(h('div.card', h('div', { style: { fontWeight: 800 } }, L('Gerçek Oyuncular (P2P)|Real Players (P2P)')),
        h('div.muted', { style: { fontSize: '12px', marginTop: '4px', lineHeight: '1.45' } }, L('Elyndra, sunucusuz eşler arası (WebRTC) bağlantıyla aynı bölgedeki gerçek oyuncuları birbirine gösterir. Birbirinizi görebilir, sohbet edebilir ve selamlaşabilirsiniz. Ayarlar > Oyun\'dan kapatılabilir.|Elyndra shows real players in the same zone to each other over a serverless peer-to-peer (WebRTC) connection. You can see each other, chat and emote. It can be turned off in Settings > Game.')),
        h('div', { style: { marginTop: '8px' } }, L('Durum: |Status: '), h('b', { style: { color: G.net?.status === 'connected' ? 'var(--good)' : 'var(--warn)' } }, G.net?.statusText?.() || L('Kapalı|Off'))),
        h('div', L('Bu bölgedeki gerçek oyuncular: |Real players in this zone: '), h('b', String(n)))));
      for (const u of G.world.units.filter(x => x.kind === 'remote')) b.append(h('div.card.row', { style: { marginTop: '6px' } }, h('img.ico', { src: clsIcon(u.cls) }), h('div', { style: { flex: 1 } }, h('b', u.name), h('div.muted', `${t('level')} ${u.level} ${L(CLASSES[u.cls].name)}`))));
    } else {
      // leaderboard: player vs simulated realm
      if (!G.account.ladder) {
        G.account.ladder = Array.from({ length: 30 }, () => ({ name: randomName(), cls: choice(CLASS_IDS), lvl: randi(20, 60), ach: randi(50, 900), tower: randi(1, 45), rating: randi(900, 2100) }));
      }
      w.board = w.board || 'lvl';
      b.append(h('div.row', { style: { gap: '4px', marginBottom: '8px' } }, ...[['lvl', t('level')], ['ach', L('Başarım|Achievements')], ['tower', L('Kule|Tower')], ['rating', 'Arena']].map(([k, l]) => h('button.btn.small' + (w.board === k ? '.primary' : '.ghost'), { onclick: () => { w.board = k; UI.refresh('social'); } }, l))));
      const me = { name: G.char.name, cls: G.char.cls, lvl: G.char.level, ach: G.ach?.points() || 0, tower: G.account.stats?.towerBest || 0, rating: G.char.arena?.rating || 1000, me: true };
      const rows = [...G.account.ladder, me].sort((a, c) => c[w.board] - a[w.board]);
      rows.slice(0, 25).forEach((r, i) => b.append(h('div.card.row', { style: { marginBottom: '4px', borderColor: r.me ? 'var(--gold)' : '' } }, h('b', { style: { width: '28px', color: i < 3 ? '#ffd24a' : 'var(--ink3)' } }, '#' + (i + 1)), h('img.ico.s', { src: clsIcon(r.cls) }), h('div', { style: { flex: 1, fontWeight: r.me ? 900 : 600 } }, r.name), h('div.gold', fmtNum(r[w.board])))));
      const myRank = rows.indexOf(me) + 1;
      if (myRank > 25) b.append(h('div.muted', L('Senin sıran: #|Your rank: #') + myRank));
    }
  },
});

function addFriend(u) {
  const fr = G.account.friends = G.account.friends || [];
  if (fr.some(f => f.name === u.name)) { G.ui.error(L('Zaten arkadaşın|Already your friend')); return; }
  fr.push({ name: u.name, cls: u.cls, lvl: u.level, race: u.race, online: true });
  G.ui.toast('users', L('Arkadaş eklendi: |Friend added: ') + u.name, '#8affb0');
  emit('friendsChanged');
}
function inviteFriend(f) {
  const p = G.player;
  const ch = G.bots ? null : null;
  import('../game/bots.js').then(({ makeBotChar, spawnBot }) => {
    const c = makeBotChar(Math.max(1, p.level), f.cls, { name: f.name, race: f.race, quality: 0.6 });
    const u = spawnBot(c, p.pos.x + 2, p.pos.z + 2, 'world');
    G.vfx?.burst(u.pos, 'arcane', { n: 20 });
    G.party.add(u);
    G.chat.post(f.name, L('Geldim! Nereye gidiyoruz?|I\'m here! Where are we going?'), 'party', u);
  });
}

function guildTab(b) {
  const g = G.account.guild, Gd = G.guild;
  if (!g) {
    b.append(h('div.card', h('div', { style: { fontWeight: 800 } }, L('Bir loncada değilsin.|You are not in a guild.')), h('div.muted', { style: { fontSize: '12px', marginTop: '4px' } }, L('Kendi loncanı kurabilir (100 altın) ya da seviye atladıkça gelen davetleri kabul edebilirsin. Loncalar tecrübe ve altın bonusları verir.|Found your own guild (100 gold) or accept invitations that arrive as you level. Guilds grant experience and gold bonuses.'))));
    b.append(h('button.btn.primary', { style: { marginTop: '10px' }, onclick: () => UI.prompt(L('Lonca Adı|Guild Name'), '', name => { if (!name || name.length < 3) return; UI.prompt(L('Lonca Etiketi (2-4 harf)|Guild Tag (2-4 letters)'), name.slice(0, 3).toUpperCase(), tag => { if (!tag) return; Gd.create(name.slice(0, 22), tag); }); }) }, L('Lonca Kur (100 altın)|Found Guild (100 gold)')));
    const bg = ['Ejderhanlar', 'Ay Muhafızları', 'Kızıl Şafak', 'Silverwind'];
    b.append(h('div.title', { style: { marginTop: '12px', fontSize: '14px' } }, L('Üye arayan loncalar|Guilds recruiting')));
    for (const n of bg) b.append(h('div.card.row', { style: { marginTop: '6px' } }, h('img.ico.s', { src: iconURL('guild', { size: 48, ...ICON_THEMES.ui }) }), h('div', { style: { flex: 1 } }, n), h('button.btn.small', { onclick: () => Gd.joinBotGuild(n) }, L('Katıl|Join'))));
    return;
  }
  b.append(h('div.row', h('img.ico.l', { src: iconURL('guild', { size: 64, ...ICON_THEMES.gold }) }), h('div', { style: { flex: 1 } }, h('div', { style: { fontWeight: 900, fontSize: '17px' } }, g.name + ' <' + g.tag + '>'), h('div.muted', L('Seviye |Level ') + g.lvl + ' · ' + g.members.length + L(' üye| members') + ' · ' + L('Lider: |Leader: ') + (g.leader === 'me' ? G.char.name : g.leader)))));
  if (g.lvl < 10) b.append(h('div.progress', { style: { margin: '8px 0' } }, h('i', { style: { width: (g.xp / Gd.needXp(g.lvl) * 100) + '%' } })), h('div.muted', { style: { fontSize: '11px' } }, `${fmtNum(g.xp)} / ${fmtNum(Gd.needXp(g.lvl))} ` + L('lonca tecrübesi|guild xp')));
  const c = g.contract;
  if (c) b.append(h('div.card', { style: { marginTop: '8px' } }, h('div', { style: { fontWeight: 800 } }, '📜 ' + L('Haftalık Sözleşme: |Weekly Contract: ') + L(c.name)), h('div.muted', { style: { fontSize: '12px' } }, L(c.desc)),
    h('div.progress', { style: { margin: '6px 0' } }, h('i', { style: { width: (c.p / c.n * 100) + '%' } })), h('div.row', h('span', `${c.p}/${c.n}`), h('span.spacer'), h('button.btn.small' + (c.p >= c.n && !c.claimed ? '.primary' : '.disabled'), { onclick: () => { Gd.claimContract(); UI.refresh('social'); } }, c.claimed ? L('Alındı|Claimed') : L('Ödülü Al|Claim')))));
  b.append(h('div.title', { style: { marginTop: '10px', fontSize: '14px' } }, L('Lonca Avantajları|Guild Perks')));
  for (const pk of Gd.perks) b.append(h('div.row', { style: { opacity: g.lvl >= pk.lvl ? 1 : 0.45, fontSize: '12.5px', margin: '3px 0' } }, h('span.chip', 'Sv ' + pk.lvl), h('b', L(pk.name)), h('span.muted', L(pk.desc))));
  b.append(h('div.title', { style: { marginTop: '10px', fontSize: '14px' } }, L('Üyeler|Members')));
  for (const m of [...g.members].sort((a, c) => (c.online - a.online) || c.lvl - a.lvl)) b.append(h('div.row', { style: { fontSize: '12.5px', margin: '3px 0' } }, h('img.ico.s', { src: clsIcon(m.cls) }), h('span', { style: { flex: 1, fontWeight: 700 } }, m.name, m.rank === 'officer' ? h('span.muted', ' ★') : null), h('span.muted', t('lv') + ' ' + m.lvl), h('span', { style: { color: m.online ? 'var(--good)' : 'var(--ink3)', width: '70px', textAlign: 'right' } }, m.online ? L('Çevrimiçi|Online') : L('Çevrimdışı|Offline'))));
  b.append(h('button.btn.red.small', { style: { marginTop: '10px' }, onclick: () => UI.confirm(L('Loncadan ayrılmak istediğine emin misin?|Leave the guild?'), () => Gd.leave(), { danger: true }) }, L('Loncadan Ayrıl|Leave Guild')));
}

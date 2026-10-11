// Achievements: account-wide, with points and rewards (titles, mounts, pets, gold).
import { G, emit, on } from '../core/state.js';
import { L, t } from '../core/i18n.js';
import { fmtNum } from '../core/util.js';
import { h, UI } from '../ui/ui.js';
import { iconURL, ICON_THEMES } from '../gfx/icons.js';
import { Audio } from '../audio.js';

// counters live in account.stats (summed across characters) and character state
const A = [];
const def = (id, cat, name, desc, icon, pts, check, reward) => A.push({ id, cat, name, desc, icon, pts, check, reward });
const S = k => G.account.stats?.[k] || 0;
const CH = () => G.char;
const lvl = () => Math.max(CH()?.level || 0, ...(G.account.characters || []).map(c => c.level));

// ---- leveling
for (const [n, p] of [[5, 5], [10, 10], [20, 10], [30, 10], [40, 15], [50, 15], [60, 25]]) def('lvl' + n, 'level', `Seviye ${n}|Level ${n}`, `Bir karakterle ${n}. seviyeye ulaş.|Reach level ${n} with a character.`, 'arrow_up', p, () => lvl() >= n, n === 60 ? { title: 'legend' } : n === 10 ? { pet: 'bunny' } : null);
// ---- combat
for (const [n, p, r] of [[10, 5], [100, 10], [1000, 15, { title: 'slayer' }], [5000, 25], [20000, 40, { title: 'unstoppable' }]]) def('kill' + n, 'combat', `${fmtNum(n)} Düşman|${fmtNum(n)} Foes`, `${fmtNum(n)} düşman öldür.|Slay ${fmtNum(n)} enemies.`, 'sword_cross', p, () => S('kills') >= n, r);
def('wolves', 'combat', 'Kurt Avcısı|Wolf Hunter', '100 kurt öldür.|Slay 100 wolves.', 'wolf', 15, () => S('kill_wolf') >= 100, { mount: 'wolf' });
def('undead', 'combat', 'Ölümsüzler Avcısı|Undead Slayer', '250 ölümsüz öldür.|Slay 250 undead.', 'skull', 15, () => S('fam_undead') >= 250, { pet: 'skelly' });
def('elite10', 'combat', 'Elit Avcı|Elite Hunter', '10 elit veya nadir düşman öldür.|Slay 10 elite or rare enemies.', 'skull_crown', 10, () => S('elites') >= 10);
def('rares', 'combat', 'Nadir Koleksiyoncu|Rare Collector', '8 farklı nadir elit düşmanı yen.|Defeat 8 different rare elites.', 'eye', 20, () => (G.account.rareKills || []).length >= 8);
def('worldboss', 'combat', 'Dev Avcısı|Giant Slayer', 'Bir dünya patronunu yen.|Defeat a world boss.', 'skull_crown', 15, () => S('worldbosses') >= 1, { pet: 'slimey' });
def('worldboss5', 'combat', 'Titan Katili|Titan Killer', '5 farklı dünya patronunu yen.|Defeat 5 different world bosses.', 'skull_crown', 30, () => (G.account.wbKills || []).length >= 5);
def('crit', 'combat', 'Ezici Darbe|Crushing Blow', 'Tek vuruşta 1000+ hasar ver.|Deal 1000+ damage in a single hit.', 'explosion', 10, () => S('maxHit') >= 1000);
def('dodge', 'combat', 'Çevik|Nimble', '100 kez takla at.|Roll 100 times.', 'sprint', 5, () => S('dodges') >= 100);
def('nodeath', 'combat', 'Ölümsüz|Undying', 'Hiç ölmeden 20. seviyeye ulaş.|Reach level 20 without dying.', 'heart', 25, () => CH() && CH().level >= 20 && !(CH().stats?.deaths), { title: 'immortal' });
// ---- quests & story
for (const [n, p] of [[1, 5], [10, 10], [50, 15], [100, 20], [200, 30]]) def('quest' + n, 'quest', `${n} Görev|${n} Quests`, `${n} görev tamamla.|Complete ${n} quests.`, 'quest_exclaim', p, () => S('quests') >= n);
def('ch1', 'quest', 'Aydınköy Kahramanı|Hero of Dawnhollow', 'Goblin Kral Grukk\'u yen ve ilk parçayı kurtar.|Defeat Goblin King Grukk and recover the first shard.', 'crystal', 10, () => !!CH()?.quests.done.q_warren, { title: 'hero' });
def('ch_bearer', 'quest', 'Kristal Taşıyıcı|Crystal Bearer', 'Üç kristal parçasını kurtar.|Recover three crystal shards.', 'crystal', 20, () => (CH()?.shards || 0) >= 3, { title: 'bearer' });
def('savior', 'quest', 'Elyndra\'nın Kurtarıcısı|Savior of Elyndra', 'Gölge Lordu Malakar\'ı yen.|Defeat Malakar the Shadow Lord.', 'sun', 50, () => S('kill_malakar') >= 1, { title: 'savior', mount: 'golden' });
// ---- exploration
def('zones3', 'explore', 'Gezgin|Wanderer', '3 bölge keşfet.|Discover 3 zones.', 'map', 10, () => (CH()?.zonesSeen || []).length >= 3);
def('zones6', 'explore', 'Diyarların Kâşifi|Explorer of Realms', 'Tüm bölgeleri keşfet.|Discover every zone.', 'compass', 25, () => (CH()?.zonesSeen || []).length >= 6, { title: 'explorer', pet: 'fox_pet' });
def('poi20', 'explore', 'Meraklı|Curious', '20 önemli yer keşfet.|Discover 20 points of interest.', 'map_marker', 10, () => (CH()?.poiSeen || []).length >= 20);
def('waystones', 'explore', 'Taş Ustası|Stonewalker', '15 ışınlanma taşını aktifleştir.|Attune 15 waystones.', 'portal', 10, () => (CH()?.waystones || []).length >= 15);
def('frostexp', 'explore', 'Buzdoruk Kâşifi|Frostpeak Explorer', 'Buzdoruk Dağları\'nın tüm önemli yerlerini keşfet.|Discover all of Frostpeak\'s points of interest.', 'snowflake', 15, () => ['fr_town', 'fr_peak', 'fr_glacier', 'fr_camp'].every(p => (CH()?.poiSeen || []).includes(p)), { mount: 'frostwolf' });
def('swim', 'explore', 'Su Kuşu|Waterfowl', '500 metre yüz.|Swim 500 yards.', 'fish', 5, () => S('swum') >= 500);
// ---- dungeons
def('dun1', 'dungeon', 'Zindan Kaşifi|Dungeon Delver', 'İlk zindanını tamamla.|Complete your first dungeon.', 'dungeon', 10, () => S('dungeons') >= 1, { pet: 'batling' });
def('dun_all', 'dungeon', 'Zindan Ustası|Dungeon Master', 'Tüm zindanları tamamla.|Complete every dungeon.', 'dungeon', 25, () => ['d_goblin', 'd_spider', 'd_pyramid', 'd_frost', 'd_molten'].every(d => (G.account.dungeonClears || []).includes(d)));
def('dun_heroic', 'dungeon', 'Kahraman|Heroic', 'Bir zindanı Kahramanlık modunda tamamla.|Complete a dungeon on Heroic.', 'skull_crown', 20, () => S('heroic') >= 1);
def('dun_fast', 'dungeon', 'Hızlı Koşucu|Speed Runner', 'Bir zindanı 6 dakikadan kısa sürede bitir.|Finish a dungeon in under 6 minutes.', 'hourglass', 15, () => S('fastDungeon') >= 1);
def('raid', 'dungeon', 'Gölgelerin Sonu|End of Shadows', 'Gölge Tahtı baskınını tamamla.|Clear the Throne of Shadows raid.', 'skull_crown', 50, () => (G.account.dungeonClears || []).includes('r_throne'), { mount: 'bonehorse' });
def('dragon', 'dungeon', 'Ejderha Avcısı|Dragonslayer', 'Bir ejderha yen.|Slay a dragon.', 'skull_crown', 20, () => S('fam_dragon') >= 1, { title: 'dragonslayer', pet: 'drakeling' });
// ---- professions
for (const [n, p] of [[1, 5], [25, 10], [50, 15], [100, 25]]) def('craft' + n, 'prof', `${n} Üretim|${n} Crafts`, `${n} eşya üret.|Craft ${n} items.`, 'hammer_anvil', p, () => S('crafts') >= n, n === 100 ? { title: 'master' } : null);
for (const [n, p] of [[25, 5], [100, 10], [500, 20]]) def('gath' + n, 'prof', `${n} Kaynak|${n} Resources`, `${n} kez kaynak topla.|Gather resources ${n} times.`, 'pickaxe', p, () => S('gathers') >= n);
for (const [n, p] of [[10, 5], [100, 15], [300, 25]]) def('fish' + n, 'prof', `${n} Balık|${n} Fish`, `${n} balık tut.|Catch ${n} fish.`, 'fish', p, () => S('fish') >= n, n === 100 ? { title: 'fisher' } : null);
def('koi', 'prof', 'Altın Şans|Golden Luck', 'Bir Altın Balık yakala.|Catch a Golden Koi.', 'fish', 15, () => S('koi') >= 1);
def('prof100', 'prof', 'Büyük Usta|Grandmaster', 'Bir mesleği 100. seviyeye çıkar.|Raise a profession to 100.', 'star', 30, () => Object.values(CH()?.prof || {}).some(p => p.lvl >= 100));
def('enh10', 'prof', 'Güçlendirici|Enhancer', 'Bir eşyayı +10\'a yükselt.|Enhance an item to +10.', 'anvil', 15, () => S('maxEnh') >= 10);
def('enh15', 'prof', 'Mükemmeliyetçi|Perfectionist', 'Bir eşyayı +15\'e yükselt.|Enhance an item to +15.', 'anvil', 30, () => S('maxEnh') >= 15);
// ---- collections & economy
def('leg1', 'collect', 'Efsanevi!|Legendary!', 'Bir efsanevi eşya bul.|Find a legendary item.', 'star', 20, () => S('legendaries') >= 1);
def('mounts3', 'collect', 'Ahır Sahibi|Stable Owner', '3 binek edin.|Own 3 mounts.', 'horse', 15, () => (G.account.mounts || []).length >= 3);
def('pets5', 'collect', 'Hayvan Dostu|Animal Friend', '5 evcil hayvan edin.|Own 5 pets.', 'paw', 15, () => (G.account.pets || []).length >= 5, { pet: 'lamb' });
def('gold1k', 'collect', 'Kesesi Dolu|Full Purse', '1.000 altına sahip ol.|Hold 1,000 gold.', 'coins', 10, () => (CH()?.gold || 0) >= 1000);
def('gold50k', 'collect', 'Zengin|Wealthy', '50.000 altına sahip ol.|Hold 50,000 gold.', 'coins', 25, () => (CH()?.gold || 0) >= 50000, { title: 'rich' });
def('market', 'collect', 'Tüccar|Trader', 'Pazarda 10 eşya sat.|Sell 10 items on the market.', 'scales', 10, () => S('marketSold') >= 10);
// ---- social & pvp
def('party', 'social', 'Takım Oyuncusu|Team Player', 'Bir gruba katıl.|Join a party.', 'users', 5, () => S('parties') >= 1);
def('guild', 'social', 'Lonca Üyesi|Guild Member', 'Bir loncaya katıl veya kur.|Join or found a guild.', 'guild', 10, () => !!G.account.guild);
def('guildlvl5', 'social', 'Lonca Lideri|Guildmaster', 'Loncanı 5. seviyeye çıkar.|Raise your guild to level 5.', 'banner', 25, () => (G.account.guild?.lvl || 0) >= 5 && G.account.guild?.leader === 'me', { title: 'guildmaster' });
def('emote', 'social', 'Dansçı|Dancer', '/dance ile dans et.|Dance with /dance.', 'sparkles', 5, () => S('dances') >= 1);
def('helper', 'social', 'Yardımsever|Helpful', 'Dünya etkinliklerinde 10 kez yer al.|Take part in 10 world events.', 'gift', 15, () => S('events') >= 10, { title: 'helper' });
for (const [n, p, r] of [[1, 10], [25, 20], [100, 30, { title: 'gladiator' }]]) def('arena' + n, 'pvp', `${n} Arena Zaferi|${n} Arena Wins`, `Arenada ${n} maç kazan.|Win ${n} arena matches.`, 'sword_cross', p, () => S('arenaWins') >= n, r);
def('rating1500', 'pvp', 'Düellocu|Duelist', 'Arena puanında 1500\'e ulaş.|Reach 1500 arena rating.', 'trophy', 20, () => (CH()?.arena?.rating || 0) >= 1500);
for (const [n, p, r] of [[5, 10], [20, 20], [50, 35, { title: 'climber' }]]) def('tower' + n, 'pvp', `Kule Katı ${n}|Tower Floor ${n}`, `Sonsuz Kule'de ${n}. kata ulaş.|Reach floor ${n} of the Endless Tower.`, 'tower', p, () => S('towerBest') >= n, r);

export const CATS = { level: 'Seviye|Level', combat: 'Savaş|Combat', quest: 'Görevler|Quests', explore: 'Keşif|Exploration', dungeon: 'Zindanlar|Dungeons', prof: 'Meslekler|Professions', collect: 'Koleksiyon|Collections', social: 'Sosyal|Social', pvp: 'Arena & Kule|Arena & Tower' };

export const Ach = {
  list: A,
  has(id) { return !!G.account.achievements?.[id]; },
  points() { return A.filter(a => this.has(a.id)).reduce((s, a) => s + a.pts, 0); },
  inc(k, n = 1) { const s = G.account.stats = G.account.stats || {}; s[k] = (s[k] || 0) + n; this.dirty = true; },
  max(k, v) { const s = G.account.stats = G.account.stats || {}; if (v > (s[k] || 0)) { s[k] = v; this.dirty = true; } },
  check() {
    if (!G.char) return;
    this.dirty = false;
    for (const a of A) {
      if (this.has(a.id)) continue;
      let ok = false; try { ok = a.check(); } catch (e) { }
      if (ok) this.unlock(a);
    }
    if (this.points() >= 500) G.mounts?.grant('golden');
  },
  unlock(a) {
    G.account.achievements = G.account.achievements || {};
    G.account.achievements[a.id] = Date.now();
    G.account.achPoints = this.points();
    Audio.sfx('achievement');
    G.ui.toast('trophy', L('Başarım: |Achievement: ') + L(a.name) + ` (+${a.pts})`, '#ffd24a', ICON_THEMES.gold);
    G.chat.system('🏆 ' + L(a.name) + ' — ' + L(a.desc), 'system');
    const r = a.reward;
    if (r?.title) G.titles.grant(r.title);
    if (r?.mount) G.mounts.grant(r.mount);
    if (r?.pet) G.pets.grant(r.pet);
    if (r?.gold && G.char) G.char.gold += r.gold;
    emit('achievement', a.id);
  },
};
G.ach = Ach;

// ------------------------------------------------------------ hooks
on('killed', u => {
  Ach.inc('kills');
  if (u.data.family) Ach.inc('fam_' + u.data.family);
  if (u.tplId === 'wolf' || u.tplId === 'frost_wolf' || u.tplId === 'shadow_wolf') Ach.inc('kill_wolf');
  if (u.elite || u.rare) Ach.inc('elites');
  if (u.rare) { const r = G.account.rareKills = G.account.rareKills || []; if (!r.includes(u.tplId)) r.push(u.tplId); }
  if (u.worldBoss) { Ach.inc('worldbosses'); const r = G.account.wbKills = G.account.wbKills || []; if (!r.includes(u.tplId)) r.push(u.tplId); }
  if (u.tplId === 'malakar') Ach.inc('kill_malakar');
});
on('damage', (src, tgt, a) => { if (src === G.player) Ach.max('maxHit', a); });
on('dodged', () => Ach.inc('dodges'));
on('questCompleted', () => Ach.inc('quests'));
on('crafted', () => Ach.inc('crafts'));
on('gathered', () => Ach.inc('gathers'));
on('fishCaught', id => { Ach.inc('fish'); if (id === 'fish_gold') Ach.inc('koi'); });
on('enhanced', it => Ach.max('maxEnh', it.plus || 0));
on('itemGained', it => { if (it && typeof it === 'object' && it.rarity === 'legendary') Ach.inc('legendaries'); });
on('dungeonCleared', (id, o) => { Ach.inc('dungeons'); const c = G.account.dungeonClears = G.account.dungeonClears || []; if (!c.includes(id)) c.push(id); if (o?.heroic) Ach.inc('heroic'); if (o?.time < 360) Ach.inc('fastDungeon'); });
on('partyChanged', () => { if (G.party?.members().length) Ach.inc('parties'); });
on('emote', e => { if (e === 'dance') Ach.inc('dances'); });
on('eventCompleted', () => Ach.inc('events'));
on('marketSold', () => Ach.inc('marketSold'));
on('arenaWin', () => Ach.inc('arenaWins'));
on('towerFloor', f => Ach.max('towerBest', f));
for (const ev of ['levelUp', 'zoneDiscovered', 'poiDiscovered', 'waystoneAttuned', 'goldGained', 'collectionChanged', 'profLevel', 'sessionStart']) on(ev, () => { Ach.dirty = true; });
G.addSystem(dt => { Ach._t = (Ach._t || 0) - dt; if (Ach._t <= 0) { Ach._t = 2; if (Ach.dirty) Ach.check(); } });

// ------------------------------------------------------------ window
UI.register('ach', {
  title: () => t('menuAch'), icon: 'trophy', w: 600, listen: ['achievement'],
  build(w) {
    w.cat = w.cat || 'level';
    UI.setTabs(w, Object.entries(CATS).map(([k, v]) => [k, L(v).split(' ')[0]]), w.cat, k => { w.cat = k; UI.refresh('ach'); });
    const done = A.filter(a => Ach.has(a.id)).length;
    w.body.append(h('div.row', { style: { marginBottom: '10px' } }, h('img.ico.l', { src: iconURL('trophy', { size: 64, ...ICON_THEMES.gold }) }), h('div', h('div.gold', { style: { fontSize: '20px' } }, Ach.points() + ' ' + L('puan|points')), h('div.muted', `${done} / ${A.length} ` + L('başarım|achievements'))),
      h('div', { style: { flex: 1, marginLeft: '12px' } }, h('div.progress', h('i', { style: { width: (done / A.length * 100) + '%' } })))));
    for (const a of A.filter(x => x.cat === w.cat)) {
      const has = Ach.has(a.id);
      const rw = a.reward ? [a.reward.title ? L('Unvan: |Title: ') + L(G.titles ? (G.titles.name(a.reward.title)) : '') : null, a.reward.mount ? L('Binek|Mount') : null, a.reward.pet ? L('Evcil hayvan|Pet') : null].filter(Boolean).join(' · ') : '';
      w.body.append(h('div.card.row', { style: { marginBottom: '6px', opacity: has ? 1 : 0.6, borderColor: has ? 'var(--gold3)' : '' } },
        h('img.ico.l', { src: iconURL(a.icon, { size: 64, ...(has ? ICON_THEMES.gold : ICON_THEMES.ui), dim: !has }) }),
        h('div', { style: { flex: 1 } }, h('div', { style: { fontWeight: 900, color: has ? '#ffe08a' : 'var(--ink)' } }, L(a.name)), h('div.muted', { style: { fontSize: '12px' } }, L(a.desc)), rw ? h('div', { style: { fontSize: '11.5px', color: '#8affb0' } }, '🎁 ' + rw) : null),
        h('div', { style: { textAlign: 'right' } }, h('div.gold', String(a.pts)), has ? h('div.good', { style: { fontSize: '11px' } }, new Date(G.account.achievements[a.id]).toLocaleDateString()) : null)));
    }
  },
});

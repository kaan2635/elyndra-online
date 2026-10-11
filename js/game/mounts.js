// Mounts, cosmetic pets, titles and the wardrobe (transmog). Account-wide collections.
import { G, emit, on } from '../core/state.js';
import { L, t } from '../core/i18n.js';
import { rand, distSq2, fmtGold } from '../core/util.js';
import { S } from '../data/classes.js';
import { Unit } from './unit.js';
import { moveTowards } from './ai.js';
import { h, UI } from '../ui/ui.js';
import { iconURL, ICON_THEMES } from '../gfx/icons.js';
import { rebuildHeroModel } from './hero.js';
import { itemName } from './items.js';
import { RARITY_COL } from '../data/items.js';
import { Audio } from '../audio.js';

export const MOUNTS = {
  horse: { name: 'Kahverengi At|Brown Horse', spec: { rig: 'quad', kind: 'horse', c: 0x8a5a3a, c2: 0x2a1a10, feat: { saddle: 0x5a3a22 } }, speed: 1.7, src: 'Görev: Kendi Atın|Quest: A Horse of Your Own' },
  horse_white: { name: 'Beyaz Savaş Atı|White Warhorse', spec: { rig: 'quad', kind: 'horse', c: 0xf0ece4, c2: 0xc8c0b0, feat: { saddle: 0x3a5aa8, saddle2: 0xd8b04a, armor: 0xa8b0c0 } }, speed: 1.8, price: 1500, lvl: 20, src: 'Seyis Ali (20. seviye)|Ali the Stablemaster (level 20)' },
  horse_black: { name: 'Kara Küheylan|Black Stallion', spec: { rig: 'quad', kind: 'horse', c: 0x1a1a1e, c2: 0x0a0a0c, feat: { saddle: 0x8a1a1a, mane: 0x3a3a3a } }, speed: 1.8, price: 4000, lvl: 30, src: 'Seyis Ali (30. seviye)|Ali the Stablemaster (level 30)' },
  wolf: { name: 'Savaş Kurdu|War Wolf', spec: { rig: 'quad', kind: 'wolf', c: 0x5a5a60, c2: 0x2a2a30, scale: 1.9, feat: { saddle: 0x5a3a22 } }, speed: 1.8, src: 'Başarım: Kurt Avcısı|Achievement: Wolf Hunter' },
  raptor: { name: 'Çöl Raptoru|Desert Raptor', spec: { rig: 'quad', kind: 'raptor', c: 0xc8903a, c2: 0x6a4a1a, scale: 1.7, feat: { saddle: 0x8a2a1a } }, speed: 1.8, price: 3000, lvl: 25, src: 'Serap Ahırı|Mirage Stables' },
  frostwolf: { name: 'Buzdiş Bineği|Frostfang Mount', spec: { rig: 'quad', kind: 'wolf', c: 0xf0f4f8, c2: 0x8a9ab0, scale: 1.9, feat: { saddle: 0x3a5a8a, glow: 0x6ad8ff } }, speed: 1.85, src: 'Başarım: Buzdoruk Kâşifi|Achievement: Frostpeak Explorer' },
  bear: { name: 'Zırhlı Ayı|Armored Bear', spec: { rig: 'quad', kind: 'bear', c: 0x5a3a2a, c2: 0x3a2418, scale: 1.3, feat: { saddle: 0x5a3a22, armor: 0x8a8a90 } }, speed: 1.75, price: 5000, lvl: 35, src: 'Ayazkale Ahırı|Frosthold Stables' },
  nightmare: { name: 'Kâbus|Nightmare', spec: { rig: 'quad', kind: 'horse', c: 0x1a0a0a, c2: 0x0a0505, feat: { saddle: 0x2a1a1a, mane: 0xff5a1a, fire: 0xff7a1a, glow: 0xff5a1a } }, speed: 2.0, src: 'Infernus (nadir ganimet)|Infernus (rare drop)' },
  bonehorse: { name: 'Kemik At|Skeletal Steed', spec: { rig: 'quad', kind: 'horse', c: 0xe8e0c8, c2: 0x8a8070, feat: { saddle: 0x2a2a3a, glow: 0x6ad8ff, mane: 0x6ad8ff } }, speed: 2.0, src: 'Gölge Tahtı (nadir ganimet)|Throne of Shadows (rare drop)' },
  golden: { name: 'Altın Yeleli|Goldenmane', spec: { rig: 'quad', kind: 'horse', c: 0xf0c040, c2: 0xc88a1a, feat: { saddle: 0xf0f0f0, saddle2: 0xd8b04a, mane: 0xfff0a0, glow: 0xffd040 } }, speed: 2.0, src: 'Başarım puanı 500|500 achievement points' },
  ram: { name: 'Dağ Koçu|Mountain Ram', spec: { rig: 'quad', kind: 'deer', c: 0xd8d0c0, c2: 0x8a7a60, scale: 1.7, feat: { saddle: 0x5a3a22, horns: 0xc8b088 } }, speed: 1.8, price: 2500, lvl: 30, src: 'Ayazkale Ahırı|Frosthold Stables' },
  salamander: { name: 'Lav Semenderi|Lava Salamander', spec: { rig: 'quad', kind: 'lizard', c: 0xd8501a, c2: 0x5a1a0a, scale: 1.7, feat: { saddle: 0x2a1a1a, fire: 0xffa020 } }, speed: 1.9, price: 8000, lvl: 45, src: 'Küllükale|Ashen Bastion' },
};
export const PETS = {
  bunny: { name: 'Pofuduk|Fluffy Bunny', spec: { rig: 'quad', kind: 'rabbit', c: 0xf0e8e0, scale: 1.1 }, src: 'Başarım: İlk Adımlar|Achievement: First Steps' },
  fox_pet: { name: 'Kızıl Tilki|Ember Fox', spec: { rig: 'quad', kind: 'wolf', c: 0xd8743a, c2: 0xf0e8e0, scale: 0.45 }, src: 'Başarım: Kâşif|Achievement: Explorer' },
  slimey: { name: 'Balçıkcık|Slimey', spec: { rig: 'blob', c: 0x8aff6a, scale: 0.4 }, src: 'Balçık Kral|The Slime King' },
  wispy: { name: 'Periş|Wisplet', spec: { rig: 'floater', kind: 'wisp', c: 0xb8ffe8, scale: 0.5 }, src: 'Fısıltı Ormanı|Whisperwood' },
  batling: { name: 'Yarasa Yavrusu|Batling', spec: { rig: 'floater', kind: 'bat', c: 0x5a3a5a, c2: 0x3a1a3a, scale: 0.7 }, src: 'Goblin Mağarası|Goblin Warren' },
  drakeling: { name: 'Yavru Ejder|Drakeling', spec: { rig: 'dragon', c: 0xc83a2a, c2: 0xf0c070, scale: 0.18 }, src: 'Başarım: Ejder Avcısı|Achievement: Dragonslayer' },
  scarab_pet: { name: 'Altın Böcek|Golden Scarab', spec: { rig: 'spider', kind: 'scorpion', c: 0xf0c040, c2: 0xf0c040, scale: 0.3 }, src: 'Kayıp Piramit|The Lost Pyramid' },
  lamb: { name: 'Kuzucuk|Little Lamb', spec: { rig: 'quad', kind: 'sheep', scale: 0.6 }, src: 'Değirmen Çiftliği|Millbrook Farm' },
  skelly: { name: 'Kemik Dost|Bonebuddy', spec: { rig: 'humanoid', race: 'skeleton', skin: 0xe8e0c8, shirt: 0xe8e0c8, pants: 0xe8e0c8, scale: 0.4, feat: { skull: true, bones: true, glowEyes: 0x8affc8 }, gear: {} }, src: 'Başarım: Ölümsüzler Avcısı|Achievement: Undead Slayer' },
  penguin_pet: { name: 'Kar Topu|Snowball', spec: { rig: 'quad', kind: 'rabbit', c: 0xffffff, scale: 1.0 }, src: 'Buzdoruk|Frostpeak' },
};
export const TITLES = {
  bearer: 'Kristal Taşıyıcı|the Crystal Bearer', slayer: 'Canavar Avcısı|the Monster Slayer', explorer: 'Kâşif|the Explorer', fisher: 'Balıkçı Reis|the Angler',
  rich: 'Zengin|the Wealthy', hero: 'Aydınköy Kahramanı|Hero of Dawnhollow', dragonslayer: 'Ejderha Avcısı|the Dragonslayer', savior: 'Elyndra\'nın Kurtarıcısı|Savior of Elyndra',
  gladiator: 'Gladyatör|the Gladiator', climber: 'Kule Fatihi|Tower Conqueror', master: 'Usta Zanaatkâr|Master Artisan', immortal: 'Ölümsüz|the Undying', legend: 'Efsane|the Legend',
  guildmaster: 'Lonca Lideri|Guildmaster', helper: 'Yardımsever|the Helpful', unstoppable: 'Durdurulamaz|the Unstoppable',
};

export const Mounts = {
  owned(id) { return (G.account.mounts || []).includes(id); },
  grant(id) {
    const a = G.account; a.mounts = a.mounts || [];
    if (a.mounts.includes(id)) return;
    a.mounts.push(id);
    if (!G.char.mount) G.char.mount = id;
    G.ui.toast('horse', L('Yeni binek: |New mount: ') + L(MOUNTS[id].name), '#ffd24a');
    Audio.sfx('achievement');
    emit('collectionChanged');
  },
  mounted() { return !!G.player?.mount; },
  toggle() {
    const p = G.player; if (!p || p.dead) return;
    if (p.mount) return this.dismount();
    const id = G.char.mount || (G.account.mounts || [])[0];
    if (!id) { G.ui.error(L('Henüz bir bineğin yok. Aydınköy\'deki Seyis Ali\'yi ziyaret et.|You have no mount yet. Visit Ali the Stablemaster in Dawnhollow.')); return; }
    if (p.inCombat) { G.ui.error(L('Savaşta binemezsin|Cannot mount in combat')); return; }
    if (G.world.dungeon) { G.ui.error(L('Zindanda binek kullanılamaz|No mounts in dungeons')); return; }
    if (p.anim.swim) { G.ui.error(L('Yüzerken binemezsin|Cannot mount while swimming')); return; }
    if (p.cast) return;
    p.cast = { sk: { id: 'mount', name: L('Binek Çağır|Summon Mount'), theme: 'nature', run: () => this.mount(id) }, id: 'mount', t: 0, dur: 1.0, target: p, ctx: {} };
    G.ui.castBar(p.cast);
  },
  mount(id) {
    const p = G.player, M = MOUNTS[id]; if (!M) return;
    p.setMount(M.spec);
    p.mountSpeed = M.speed;
    Audio.sfx('mount');
    G.vfx?.burst(p.pos, 'smoke', { n: 14 });
    emit('mounted', id);
  },
  dismount() { const p = G.player; if (!p.mount) return; p.setMount(null); p.mountSpeed = 1; G.vfx?.burst(p.pos, 'smoke', { n: 10 }); },
  autoMount() { if (!this.mounted() && G.char?.mount && !G.player.inCombat && !G.world.dungeon) this.mount(G.char.mount); },
};
G.mounts = Mounts;
on('damage', (src, tgt) => { if (tgt === G.player && Mounts.mounted() && !src?.isHero) Mounts.dismount(); if (src === G.player && Mounts.mounted()) Mounts.dismount(); });
on('skillUsed', u => { if (u === G.player && Mounts.mounted()) Mounts.dismount(); });
on('zoneEntered', () => { if (G.world.dungeon && Mounts.mounted()) Mounts.dismount(); Pets.respawn(); });

// ------------------------------------------------------------ cosmetic pets
export const Pets = {
  unit: null,
  owned(id) { return (G.account.pets || []).includes(id); },
  grant(id) {
    const a = G.account; a.pets = a.pets || [];
    if (a.pets.includes(id)) return;
    a.pets.push(id);
    G.ui.toast('paw', L('Yeni evcil hayvan: |New pet: ') + L(PETS[id].name), '#ffd24a');
    Audio.sfx('achievement');
    emit('collectionChanged');
  },
  summon(id) {
    G.char.pet = id === G.char.pet ? null : id;
    this.respawn();
  },
  respawn() {
    if (this.unit) { G.world.removeUnit(this.unit); this.unit = null; }
    const id = G.char?.pet; if (!id || !PETS[id]) return;
    const p = G.player;
    const u = new Unit({ kind: 'critter', name: L(PETS[id].name), level: 1, x: p.pos.x + 1.5, z: p.pos.z + 1.5, team: 'neutral' });
    u.base = { hp: 999999, dmg: 0, armor: 0 }; u.recalc(); u.hp = u.stats.maxHp;
    u.speed = 8; u.setModel(PETS[id].spec);
    u.data.cosmetic = true; u.alwaysUpdate = true;
    u.ai = { update: dt => { const o = G.player; if (!o) return; const d2 = distSq2(u.pos.x, u.pos.z, o.pos.x, o.pos.z); if (d2 > 1600) { u.pos.x = o.pos.x + 1; u.pos.z = o.pos.z + 1; } const fx = o.pos.x + Math.sin(o.yaw + 2.4) * 1.8, fz = o.pos.z + Math.cos(o.yaw + 2.4) * 1.8; if (distSq2(u.pos.x, u.pos.z, fx, fz) > 1) moveTowards(u, fx, fz, dt, d2 > 64 ? (o.mount ? 2.2 : 1.6) : 1, 0.6); else u.anim.move = 0; }, onDamaged() { } };
    u.dead = false;
    this.unit = u;
    G.world.addUnit(u);
  },
};
G.pets = Pets;

export const Titles = {
  name(id) { return TITLES[id] || ''; },
  grant(id) { const a = G.account; a.titles = a.titles || []; if (a.titles.includes(id)) return; a.titles.push(id); G.ui.toast('crown', L('Yeni unvan: |New title: ') + L(TITLES[id]), '#ffd24a'); emit('collectionChanged'); },
};
G.titles = Titles;

// wardrobe: remember appearances of equipped items
on('equipChanged', (u, it) => {
  if (u !== G.player || !it?.visual) return;
  const w = G.account.wardrobe = G.account.wardrobe || {};
  const slot = it.slot === 'ring2' ? 'ring' : it.slot;
  w[slot] = w[slot] || [];
  if (!w[slot].some(x => x.name === it.name)) { w[slot].push({ name: it.name, visual: it.visual, rarity: it.rarity }); if (w[slot].length > 60) w[slot].shift(); }
});

// ------------------------------------------------------------ collections window
UI.register('collect', {
  title: () => t('menuCollect'), icon: 'horse', w: 560, listen: ['collectionChanged'],
  build(w, tab) {
    if (tab) w.tab = tab;
    w.tab = w.tab || 'mounts';
    UI.setTabs(w, [['mounts', L('Binekler|Mounts')], ['pets', L('Evcil Hayvanlar|Pets')], ['titles', L('Unvanlar|Titles')], ['wardrobe', L('Gardırop|Wardrobe')]], w.tab, k => { w.tab = k; UI.refresh('collect'); });
    const ch = G.char, acc = G.account, b = w.body;
    if (w.tab === 'mounts') {
      b.append(h('div.muted', { style: { fontSize: '12px', marginBottom: '8px' } }, L('Binekler tüm karakterlerin tarafından paylaşılır. Binmek için T tuşu veya mini harita yanındaki at düğmesi.|Mounts are shared by all your characters. Ride with T or the horse button by the minimap.')));
      for (const [id, M] of Object.entries(MOUNTS)) {
        const own = Mounts.owned(id);
        const canBuy = !own && M.price && G.char.level >= (M.lvl || 1);
        b.append(h('div.card.row', { style: { marginBottom: '6px', opacity: own ? 1 : 0.65 } }, h('img.ico.l', { src: iconURL('horse', { size: 64, ...(own ? ICON_THEMES.gold : ICON_THEMES.ui) }) }),
          h('div', { style: { flex: 1 } }, h('div', { style: { fontWeight: 800 } }, L(M.name), ch.mount === id ? h('span.chip', { style: { marginLeft: '6px' } }, L('Seçili|Selected')) : null), h('div.muted', { style: { fontSize: '12px' } }, L(M.src) + ' · ' + L('Hız |Speed ') + '+' + Math.round((M.speed - 1) * 100) + '%')),
          own ? h('button.btn.small', { onclick: () => { ch.mount = id; if (Mounts.mounted()) { Mounts.dismount(); Mounts.mount(id); } UI.refresh('collect'); } }, L('Seç|Select'))
            : M.price ? h('button.btn.small' + (canBuy && ch.gold >= M.price ? '.primary' : '.disabled'), { onclick: () => { if (ch.gold < M.price) return; ch.gold -= M.price; Mounts.grant(id); ch.mount = id; } }, fmtGold(M.price) + ' ' + L('altın|g')) : h('span.muted', '🔒')));
      }
    } else if (w.tab === 'pets') {
      for (const [id, P] of Object.entries(PETS)) {
        const own = Pets.owned(id);
        b.append(h('div.card.row', { style: { marginBottom: '6px', opacity: own ? 1 : 0.6 } }, h('img.ico.l', { src: iconURL('paw', { size: 64, ...(own ? ICON_THEMES.nature : ICON_THEMES.ui) }) }),
          h('div', { style: { flex: 1 } }, h('div', { style: { fontWeight: 800 } }, L(P.name)), h('div.muted', { style: { fontSize: '12px' } }, L(P.src))),
          own ? h('button.btn.small' + (ch.pet === id ? '.primary' : ''), { onclick: () => { Pets.summon(id); UI.refresh('collect'); } }, ch.pet === id ? L('Gönder|Dismiss') : L('Çağır|Summon')) : h('span.muted', '🔒')));
      }
    } else if (w.tab === 'titles') {
      const own = acc.titles || [];
      b.append(h('div.card.row', { style: { marginBottom: '6px' } }, h('div', { style: { flex: 1 } }, L('Unvan yok|No title')), h('button.btn.small' + (!ch.activeTitle ? '.primary' : ''), { onclick: () => { ch.activeTitle = null; G.player.title = null; UI.refresh('collect'); } }, L('Seç|Select'))));
      for (const [id, name] of Object.entries(TITLES)) {
        const has = own.includes(id);
        b.append(h('div.card.row', { style: { marginBottom: '6px', opacity: has ? 1 : 0.5 } }, h('img.ico', { src: iconURL('crown', { size: 48, ...(has ? ICON_THEMES.gold : ICON_THEMES.ui) }) }), h('div', { style: { flex: 1, fontWeight: 800 } }, ch.name + ' ' + L(name)),
          has ? h('button.btn.small' + (ch.activeTitle === id ? '.primary' : ''), { onclick: () => { ch.activeTitle = id; G.player.title = L(name); UI.refresh('collect'); } }, L('Seç|Select')) : h('span.muted', '🔒')));
      }
    } else {
      const wr = acc.wardrobe || {};
      b.append(h('div.muted', { style: { fontSize: '12px', marginBottom: '8px' } }, L('Kuşandığın her eşyanın görünümü gardıroba eklenir. Bir yuvaya görünüm uygula; özellikler değişmez.|Every item you equip adds its look to the wardrobe. Apply a look to a slot; stats do not change.')));
      for (const slot of ['head', 'shoulders', 'chest', 'hands', 'legs', 'feet', 'cape', 'main', 'off']) {
        const list = wr[slot] || [];
        const cur = ch.transmog?.[slot];
        const row = h('div.card', { style: { marginBottom: '6px' } }, h('div.row', h('b', t('s_' + slot)), h('span.spacer'), cur ? h('button.btn.small.ghost', { onclick: () => { delete ch.transmog[slot]; rebuildHeroModel(G.player); UI.refresh('collect'); } }, L('Sıfırla|Reset')) : null,
          ['head', 'cape', 'shoulders'].includes(slot) ? h('button.btn.small.ghost', { onclick: () => { ch.transmog = ch.transmog || {}; ch.transmog[slot] = { hidden: true }; rebuildHeroModel(G.player); UI.refresh('collect'); } }, L('Gizle|Hide')) : null));
        const wrap = h('div.row.wrap', { style: { gap: '4px', marginTop: '6px' } });
        if (!list.length) wrap.append(h('span.muted', { style: { fontSize: '12px' } }, L('Henüz görünüm yok|No appearances yet')));
        for (const v of list) wrap.append(h('button.btn.small' + (cur?.visual === v.visual || (cur && cur.name === v.name) ? '.primary' : '.ghost'), { style: { color: RARITY_COL[v.rarity] }, onclick: () => { ch.transmog = ch.transmog || {}; ch.transmog[slot] = { visual: v.visual, name: v.name }; rebuildHeroModel(G.player); UI.refresh('collect'); } }, L(v.name)));
        row.append(wrap); b.append(row);
      }
    }
  },
});

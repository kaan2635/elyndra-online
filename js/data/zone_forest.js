// ZONE 2 — Fısıltı Ormanı / Whisperwood (levels 10-20). Registers zone, NPCs, quests and quest objects.
import { ZONES } from './zones.js';
import { NPCS, SHOPS } from './npcs.js';
import { QUESTS, QUEST_OBJECTS } from './quests.js';
import { SKIN, SKIN_ELF, HAIR } from '../gfx/models.js';
import { ITEMS } from './items.js';

const H = o => ({ rig: 'humanoid', ...o });
const elf = (o = {}) => H({ race: 'elf', skin: SKIN_ELF[o.s ?? 1], hair: o.hair ?? 1, hairColor: o.hc ?? HAIR[4], body: o.body || 0, eyes: 0x3a8a3a, gear: { chest: { m: o.cm || 'robe', c: o.c ?? 0x3a6a4a, c2: o.c2 ?? 0xd8b04a }, legs: { c: o.lc ?? 0x2a4a3a }, ...(o.gear || {}) } });

ZONES.forest = {
  id: 'forest', name: 'Fısıltı Ormanı|Whisperwood', level: [10, 20], music: 'forest', ambient: 'forest', weather: ['clear', 'clear', 'rain', 'fireflies', 'leaves', 'mist'],
  desc: 'Kadim ağaçların fısıldadığı, elflerin yurdu olan yoğun orman.|A dense forest of whispering ancient trees, home of the elves.',
  env: {
    sky: [0x3a6aa8, 0xa8d0c8, 0x4a6a4a], fog: 0x9ac0b0, sun: 0xfff0d0, sunI: 2.0, hemiSky: 0xb8e0d0, hemiGround: 0x3a4a2a, hemiI: 1.1, dusk: 0xff9a7a, fogFar: 150,
    night: { skyTop: 0x080c20, skyHor: 0x1a2a40, fog: 0x101a24, sun: 0x6a80c0, hemiSky: 0x3a5a80, hemiGround: 0x101810 },
  },
  terrain: {
    size: 400, res: 160, seed: 23, base: 4.5, amp: 10, scale: 0.008, detailAmp: 2.0, detailScale: 0.05, borderH: 38, water: -0.4, surface: 'grass',
    palette: { ground: [0x3f7a35, 0x528a3a, 0x6a9a45], patch: 0x6a5a8a, rock: 0x6a6a64, sand: 0xa8a070, shore: 0x8a8a5a, road: 0x8a7656, plaza: 0xa8a090, under: 0x3a4a2a },
    roads: [
      { pts: [[0, 168], [5, 120], [-10, 70], [0, 20], [10, -40], [0, -100], [0, -168]], w: 4.5 },
      { pts: [[0, 20], [60, 30], [110, 10]], w: 3.5 },
      { pts: [[-10, 70], [-70, 85], [-120, 110]], w: 3.5 },
      { pts: [[10, -40], [-60, -60], [-110, -40]], w: 3.5 },
    ],
    rivers: [{ pts: [[-200, -10], [-140, 0], [-90, 30], [-40, 40], [20, 55], [80, 80], [140, 120], [200, 140]], w: 9, depth: 2.2 }],
    features: [
      { t: 'lake', x: 95, z: -95, r: 26, depth: 3 },
      { t: 'lake', x: -120, z: 115, r: 30, depth: 1.6 },
      { t: 'hill', x: -100, z: -120, r: 50, h: 14 },
      { t: 'hill', x: 140, z: 40, r: 40, h: 12 },
      { t: 'hill', x: 30, z: -140, r: 30, h: 8 },
      { t: 'flat', x: 110, z: 10, r: 18, h: 6, edge: 10 },
      { t: 'flat', x: -60, z: -60, r: 18, h: 5, edge: 10 },
      { t: 'flat', x: 0, z: -168, r: 12, h: 4, edge: 8 },
      { t: 'flat', x: 0, z: 168, r: 12, h: 4, edge: 8 },
    ],
  },
  propColors: { leaf: 0x3a7a35, trunk: 0x5a4030, rock: 0x7a7a74, moss: 0x4a7a3a, grass: 0x4a8a3a, flowers: [0xd0a0ff, 0xffffff, 0x8ad8ff, 0xffd060], cap: 0x8a3a9a, spots: 0xf0e8ff, berries: 0x6a3ad0 },
  towns: [{ id: 'leafhome', name: 'Yaprakevi|Leafhome', x: -10, z: 95, r: 28, h: 4, style: 'elven', seed: 9, gates: [Math.PI, 0, -Math.PI / 2], wall: null, center: 'fountain', special: { smithy: 'smithy', inn: 'inn', temple: 'temple', stable: 'stable' } }],
  structures: [
    // moonwell
    { type: 'altar', x: 95, z: -95, rot: 0, style: 'elven', glow: 0x8ae8ff, y: -0.4 },
    { type: 'ruinpillar', x: 70, z: -88, style: 'elven' }, { type: 'obelisk', x: 118, z: -78, rot: 0.6, style: 'elven', glow: 0x8ae8ff },
    // elven ruins
    { type: 'temple', x: -60, z: -60, rot: 0.8, style: 'ruin', w: 12, d: 9 }, { type: 'rubble', x: -44, z: -70, rot: 1.4, style: 'ruin' }, { type: 'rubble', x: -78, z: -48, rot: 0.2, style: 'ruin' },
    // ranger camp
    { type: 'tent', x: 104, z: 4, rot: -1.0, style: 'elven', c: 0x3a6a4a }, { type: 'tent', x: 116, z: 16, rot: 2.5, style: 'elven', c: 0x5a7a3a }, { type: 'campfire', x: 110, z: 10, style: 'elven' }, { type: 'banner', x: 100, z: 14, style: 'elven', c: 0x2a6a4a },
    // bridges over the river
    { type: 'bridge', x: -5.5, z: 49, rot: 0.1, style: 'elven', l: 21, by: 0.4 },
    { type: 'bridge', x: 8, z: -35, rot: 0, style: 'elven', l: 10 },
    // spider den
    { type: 'cave', x: 140, z: -140, rot: -0.8, style: 'ruin', rock: 0x4a4440 },
    // swamp hut
    { type: 'hut', x: -140, z: 140, rot: 0.7, style: 'ruin' },
    // portals
    { type: 'portal', x: 0, z: 172, rot: Math.PI, style: 'elven', c: 0x6affb0 },
    { type: 'portal', x: 0, z: -172, rot: 0, style: 'desert', c: 0xffc86a },
    // waystones
    { type: 'waystone', x: 8, z: 128, style: 'elven' }, { type: 'waystone', x: 96, z: 24, style: 'elven' }, { type: 'waystone', x: -46, z: -40, style: 'elven' },
    { type: 'waystone', x: 70, z: -110, style: 'elven' }, { type: 'waystone', x: -100, z: 100, style: 'elven' }, { type: 'waystone', x: 10, z: -155, style: 'elven' },
  ],
  scatter: [
    { type: 'pine', d: 0.0022, mask: { s: 0.01, min: -0.3 }, s: [1.0, 1.7] },
    { type: 'oak', d: 0.0014, mask: { s: 0.012, min: -0.2 }, s: [1.0, 1.7] },
    { type: 'birch', d: 0.0007, s: [1.0, 1.4] },
    { type: 'willow', d: 0.0004, s: [1.1, 1.5] },
    { type: 'bigshroom', d: 0.0006, area: { x: 60, z: -30, r: 45 }, s: [0.8, 1.6] },
    { type: 'bigshroom', d: 0.0003, mask: { s: 0.015, min: 0.4 }, s: [0.7, 1.3] },
    { type: 'dead', d: 0.0012, area: { x: -120, z: 120, r: 55 }, s: [0.9, 1.4], tint: [0xa8a0b0, 0x8a8090] },
    { type: 'bush', d: 0.002, s: [0.8, 1.4] },
    { type: 'fern', d: 0.004, s: [0.8, 1.5], small: true },
    { type: 'rock', d: 0.0006, s: [0.6, 1.4] },
    { type: 'boulder', d: 0.0002, s: [0.8, 1.3] },
    { type: 'log', d: 0.0003, s: [0.8, 1.2] },
    { type: 'stump', d: 0.0002 },
    { type: 'grass', d: 0.009, s: [0.8, 1.5], small: true },
    { type: 'flowers', d: 0.003, s: [0.8, 1.2], small: true },
    { type: 'reeds', d: 0.004, shore: true, s: [0.8, 1.3], small: true },
    { type: 'ruinpillar', d: 0.00005, s: [0.8, 1.2] },
  ],
  clear: [{ x: 95, z: -95, r: 30 }, { x: -60, z: -60, r: 20 }, { x: 110, z: 10, r: 18 }, { x: 0, z: 168, r: 14 }, { x: 0, z: -168, r: 14 }, { x: 140, z: -138, r: 12 }],
  spawns: [
    { m: 'wisp', x: 80, z: -70, r: 26, n: 8, lvl: [10, 12] },
    { m: 'treant_small', x: -30, z: 20, r: 26, n: 7, lvl: [11, 13] },
    { m: 'bear', x: 70, z: 60, r: 28, n: 6, lvl: [12, 14] },
    { m: 'spider_giant', x: 125, z: -125, r: 22, n: 8, lvl: [12, 15] },
    { m: 'shadow_wolf', x: -100, z: -10, r: 26, n: 8, lvl: [14, 16] },
    { m: ['druid', 'druid', 'treant_small'], x: -60, z: -60, r: 18, n: 8, lvl: [15, 17], camp: true },
    { m: 'mushroom_man', x: 60, z: -30, r: 26, n: 8, lvl: [16, 18] },
    { m: ['swamp_witch', 'spider_giant'], x: -120, z: 125, r: 26, n: 7, lvl: [18, 20] },
    { m: 'shadow_wolf', x: -90, z: -130, r: 20, n: 5, lvl: [17, 19] },
    { m: 'elder_treant', x: -20, z: -110, r: 6, n: 1, lvl: 16, respawn: 300 },
    { m: 'moonclaw', x: 150, z: 60, r: 6, n: 1, lvl: 17, respawn: 300 },
  ],
  critters: [{ m: 'deer', n: 12 }, { m: 'rabbit', n: 10 }, { m: 'fox', n: 6 }],
  worldBoss: { m: 'forest_guardian', x: 30, z: -60, lvl: 20, every: 660, name: 'Yozlaşmış Orman Muhafızı|Corrupted Grove Guardian' },
  waystones: [
    { id: 'w_leaf', name: 'Yaprakevi|Leafhome', x: 8, z: 128 }, { id: 'w_ranger', name: 'Korucu Kampı|Ranger Camp', x: 96, z: 24 }, { id: 'w_ruins', name: 'Elf Harabeleri|Elven Ruins', x: -46, z: -40 },
    { id: 'w_moon', name: 'Ay Kuyusu|Moonwell', x: 70, z: -110 }, { id: 'w_swamp', name: 'Sisli Bataklık|Mistfen', x: -100, z: 100 }, { id: 'w_fnorth', name: 'Kuzey Kapısı|Northern Gate', x: 10, z: -155 },
  ],
  portals: [{ to: 'vale', x: 0, z: 172, r: 3.5, lvl: 1, label: 'Yeşilvadi|Verdant Vale', oz: -8 }, { to: 'desert', x: 0, z: -172, r: 3.5, lvl: 20, label: 'Kavruk Çöl|Scorched Sands', oz: 8 }],
  dungeons: [{ id: 'd_spider', x: 137, z: -135, r: 4 }],
  nodes: [{ type: 'herb2', n: 16 }, { type: 'herb1', n: 6 }, { type: 'ore2', n: 12 }, { type: 'wood2', n: 14 }],
  fishing: [{ x: 95, z: -95, r: 22, fish: ['fish2', 'fish2', 'fish1'] }, { x: -120, z: 115, r: 25, fish: ['fish2', 'fish1'] }],
  pois: [
    { id: 'f_leaf', name: 'Yaprakevi|Leafhome', x: -10, z: 95, r: 30, town: true },
    { id: 'f_moon', name: 'Ay Kuyusu|Moonwell', x: 95, z: -95, r: 28 },
    { id: 'f_ruins', name: 'Elf Harabeleri|Elven Ruins', x: -60, z: -60, r: 22 },
    { id: 'f_camp', name: 'Korucu Kampı|Ranger Camp', x: 110, z: 10, r: 18 },
    { id: 'f_shroom', name: 'Mantar Vadisi|Mushroom Hollow', x: 60, z: -30, r: 30 },
    { id: 'f_swamp', name: 'Sisli Bataklık|Mistfen', x: -120, z: 120, r: 35 },
    { id: 'f_den', name: 'Örümcek Yuvası|The Brood Den', x: 140, z: -140, r: 14, dungeon: true },
    { id: 'f_river', name: 'Gümüş Irmak|Silverstream', x: -40, z: 40, r: 20 },
  ],
  start: { x: 0, z: 160 },
};

// ---------------------------------------------------------------- NPCs
Object.assign(NPCS, {
  aelora: { zone: 'forest', at: 'leafhome.center', name: 'Bilge Aelora|Sage Aelora', title: 'Yaprakevi Bilgesi|Sage of Leafhome', roles: ['quest'], model: elf({ s: 0, hair: 1, hc: 0xe8e0f8, body: 1, c: 0xe8e4f0, c2: 0x8ae8ff, gear: { head: { m: 'circlet', c2: 0x8ae8ff, gem: 0x8ae8ff }, main: { m: 'staff', glow: 0x8ae8ff, c2: 0xd8c8a0 } } }), greet: 'Orman ağlıyor, Kristal Taşıyıcı. Fısıltıları duyuyor musun?|The forest weeps, Crystal Bearer. Do you hear the whispers?' },
  thalion: { zone: 'forest', at: [108, 4], rot: -2.4, name: 'Korucu Thalion|Ranger Thalion', title: 'Orman Korucuları|Wardens of the Wood', roles: ['quest'], model: elf({ s: 2, hair: 2, hc: HAIR[0], cm: 'leather', c: 0x3a5a2a, gear: { head: { m: 'hood', c: 0x2a4a2a }, main: { m: 'bow', c: 0xe8dcc0 }, cape: { c: 0x2a4a2a } } }), greet: 'Ok ve yay, sessizlik ve sabır. Ormanı böyle koruruz.|Bow and arrow, silence and patience. That\'s how we guard the forest.' },
  elfsmith: { zone: 'forest', at: 'leafhome.smithy', name: 'Ustaca Faelin|Faelin the Artisan', title: 'Elf Zanaatkârı|Elven Artisan', roles: ['shop', 'enhance', 'train', 'quest'], shop: 'smith', prof: ['smithing', 'mining', 'jewelcrafting'], model: elf({ s: 1, hair: 0, hc: HAIR[3], cm: 'leather', c: 0x6a5a3a, gear: { main: { m: 'hammer', c: 0xc8e0f0 } } }), greet: 'Elf çeliği hafif ama ölümcüldür.|Elven steel is light but deadly.' },
  elfinn: { zone: 'forest', at: 'leafhome.inn', name: 'Hancı Lirien|Lirien the Innkeeper', title: 'Gümüş Yaprak Hanı|The Silver Leaf', roles: ['shop', 'inn', 'quest', 'train'], shop: 'inn', prof: ['cooking', 'alchemy', 'herbalism'], model: elf({ s: 1, hair: 4, hc: HAIR[2], body: 1, c: 0x8a5a3a, c2: 0xf0e8d8, cm: 'cloth' }), greet: 'Ay çiçeği çayı ister misin? Yorgunluğunu alır.|Moonblossom tea? It washes the weariness away.' },
  elfmerchant: { zone: 'forest', at: 'leafhome.stall0', name: 'Tüccar Nimra|Nimra the Trader', title: 'Genel Mallar & Pazar|Goods & Market', roles: ['shop', 'bank', 'market', 'guild', 'train'], shop: 'general', prof: ['tailoring'], model: elf({ s: 3, hair: 2, hc: HAIR[0], body: 1, c: 0xa86a2a, c2: 0x2a6a5a, cm: 'cloth' }), greet: 'Her diyardan mallar! Bir göz at.|Goods from every realm! Take a look.' },
  elfpriest: { zone: 'forest', at: 'leafhome.temple', name: 'Ay Rahibesi Selwyn|Moon Priestess Selwyn', title: 'Ay Tapınağı|Temple of the Moon', roles: ['quest', 'dungeon', 'arena', 'stable'], model: elf({ s: 4, hair: 1, hc: 0xd0d0f0, body: 1, c: 0xd8d8f0, c2: 0xb8c8ff, gear: { head: { m: 'circlet', c2: 0xc8d8ff } } }), greet: 'Ay ışığı yolunu aydınlatsın.|May moonlight guide your path.' },
  hermit: { zone: 'forest', at: [-136, 132], rot: 0.7, name: 'Münzevi Orin|Orin the Hermit', title: 'Bataklık Münzevisi|Hermit of the Fen', roles: ['quest'], model: H({ race: 'human', skin: SKIN[2], hair: 5, beard: 3, hairColor: 0xa8a8a8, gear: { chest: { m: 'robe', c: 0x4a5a3a, c2: 0x6a8a3a }, head: { m: 'hood', c: 0x3a4a2a }, main: { m: 'staff', c2: 0x4a3a2a, glow: 0x8aff6a } } }), greet: 'Bataklık sırlarla dolu... ve sırlar tehlikelidir.|The fen is full of secrets... and secrets are dangerous.' },
});

// ---------------------------------------------------------------- quests
const Q = (id, o) => { QUESTS[id] = { id, zone: 'forest', ...o }; };
// main story, chapter II
Q('q_f_moonwell', { main: true, lvl: 10, giver: 'aelora', prev: 'q_onward', name: 'Kirlenen Kuyu|The Tainted Well',
  text: 'İkinci parça Ay Kuyusu\'na düştü ve onu kirletti. Kuyunun ruhları, periler, artık kudurmuş durumda. Kuzeydoğudaki Ay Kuyusu\'na git ve 8 Orman Perisini huzura kavuştur.|The second shard fell into the Moonwell and tainted it. The well\'s spirits, the wisps, have gone mad. Go to the Moonwell in the northeast and put 8 Forest Wisps to rest.',
  progress: 'Periler hâlâ acı içinde.|The wisps still suffer.', done: 'Peri ruhları özgür... ama parça kuyuda değil. Biri onu almış.|The wisp spirits are free... but the shard is not in the well. Someone has taken it.',
  obj: [{ t: 'kill', m: ['wisp'], n: 8 }], rew: { xp: 1, gold: 8, choice: [{ slot: 'chest', rarity: 'uncommon' }, { slot: 'legs', rarity: 'uncommon' }] } });
Q('q_f_tracks', { main: true, lvl: 11, giver: 'aelora', prev: 'q_f_moonwell', name: 'Gümüş İzler|Silver Tracks',
  text: 'Kuyunun etrafında ipeksi, gümüşi izler var. Korucu Thalion bu izleri tanıyabilir. Doğudaki Korucu Kampı\'nda onu bul.|There are silky, silver trails around the well. Ranger Thalion may recognise them. Find him at the Ranger Camp to the east.',
  done: 'Örümcek ipeği... ve devasa. Bu sadece bir şey demek: Kraliçe Zeyra.|Spider silk... and enormous. That can only mean one thing: Broodmother Zeyra.',
  obj: [{ t: 'talk', npc: 'thalion' }], turnin: 'thalion', rew: { xp: 0.4, gold: 4 } });
Q('q_f_druids', { main: true, lvl: 13, giver: 'thalion', prev: 'q_f_tracks', name: 'Yoz Druidler|The Corrupted Druids',
  text: 'Elf Harabeleri\'ndeki druidler parçanın gücüne kapıldı ve Zeyra\'ya hizmet ediyor. 6 Yoz Druid\'i durdur ve taşıdıkları 4 Yozlaşmış Tılsım\'ı getir.|The druids at the Elven Ruins have been seduced by the shard\'s power and now serve Zeyra. Stop 6 Corrupted Druids and bring back 4 of the Corrupted Totems they carry.',
  progress: 'Tılsımları buldun mu?|Have you found the totems?', done: 'Bu tılsımlar Zeyra\'nın yuvasına işaret ediyor... kuzeydoğu, Ağlı Çukur\'un altı.|These totems point to Zeyra\'s den... northeast, beneath the Webbed Hollow.',
  obj: [{ t: 'kill', m: ['druid'], n: 6 }, { t: 'collect', item: 'q_totem', n: 4, from: ['druid'], chance: 0.6 }], rew: { xp: 1.1, gold: 12, choice: [{ slot: 'main', rarity: 'uncommon' }, { slot: 'head', rarity: 'rare' }] } });
Q('q_f_brood', { main: true, lvl: 15, giver: 'thalion', prev: 'q_f_druids', name: 'Yuvanın Eşiği|Threshold of the Brood',
  text: 'Yuvanın girişini dev örümcekler koruyor. Girmeden önce sayılarını azalt: 10 Dev Örümcek.|Giant spiders guard the den\'s entrance. Thin their numbers before going in: 10 Giant Spiders.',
  progress: 'Örümcekler hâlâ girişi tutuyor.|Spiders still hold the entrance.', done: 'Giriş açık. Şimdi Selwyn\'e git; Ay Tapınağı sana yoldaş bulacak.|The way is open. Now go to Selwyn; the Moon Temple will find you companions.',
  obj: [{ t: 'kill', m: ['spider_giant'], n: 10 }], rew: { xp: 1.1, gold: 14, choice: [{ slot: 'feet', rarity: 'rare' }, { slot: 'hands', rarity: 'rare' }] } });
Q('q_f_zeyra', { main: true, lvl: 18, giver: 'elfpriest', prev: 'q_f_brood', name: 'Kraliçe Zeyra|Broodmother Zeyra',
  text: 'Zeyra, ikinci parçayı yumurtalarının arasına sakladı; onun gücüyle sonsuz bir ordu doğuruyor. Örümcek Yuvası\'na gir ve onu yok et!|Zeyra hid the second shard among her eggs, birthing an endless army with its power. Enter the Brood Den and destroy her!',
  progress: 'Zeyra hâlâ yaşıyor.|Zeyra still lives.', done: 'İkinci parça! Işığı Ay Kuyusu\'nu yeniden arındırıyor. Bilge Aelora seni bekliyor.|The second shard! Its light purifies the Moonwell once more. Sage Aelora awaits you.',
  obj: [{ t: 'boss', m: 'zeyra' }], turnin: 'aelora', rew: { xp: 1.6, gold: 40, choice: [{ slot: 'main', rarity: 'rare' }, { slot: 'chest', rarity: 'rare' }, { slot: 'ring', rarity: 'rare' }], items: [{ id: 'enhance_stone', qty: 4 }] } });
Q('q_f_onward', { main: true, lvl: 20, giver: 'aelora', prev: 'q_f_zeyra', name: 'Kumlara Doğru|Towards the Sands',
  text: 'Üçüncü parça güneydeki çöllere, Kavruk Çöl\'e düştü. Kuzey Kapısı\'ndaki portaldan geç; Serap vahasında Vezir Kerem seni karşılayacak.|The third shard fell into the Scorched Sands. Pass through the portal at the Northern Gate; Vizier Kerem will meet you at the Mirage oasis.',
  progress: 'Kerem seni bekliyor.|Kerem awaits.', done: 'Kristal Taşıyıcı! Kumların fısıltısı geleceğini söylemişti.|Crystal Bearer! The whisper of the sands foretold your coming.',
  obj: [{ t: 'talk', npc: 'kerem' }], turnin: 'kerem', rew: { xp: 0.5, gold: 12 } });
// side quests
Q('q_f_bears', { lvl: 12, giver: 'thalion', name: 'Ayı Mevsimi|Bear Season', text: 'Ayılar korucuların erzak depolarını basıyor. 6 Boz Ayı avla.|Bears are raiding the rangers\' food stores. Hunt 6 Brown Bears.', progress: 'Ayılar hâlâ ortalıkta.|The bears are still about.', done: 'Kışı rahat geçireceğiz, sağ ol.|We\'ll have an easy winter, thanks.', obj: [{ t: 'kill', m: ['bear'], n: 6 }], rew: { xp: 0.9, gold: 10, choice: [{ slot: 'shoulders', rarity: 'uncommon' }, { slot: 'cape', rarity: 'uncommon' }] } });
Q('q_f_saplings', { lvl: 11, giver: 'aelora', name: 'Öfkeli Fidanlar|Angry Saplings', text: 'Genç ağaççıklar yozlaşmanın etkisiyle yürümeye başladı. 8 Ağaççık\'ı sakinleştir... kalıcı olarak.|Young saplings have started walking under the corruption. Calm 8 Saplings... permanently.', progress: 'Ağaççıklar hâlâ yolda.|The saplings still roam.', done: 'Toprak onları yeniden kabul edecek.|The earth will take them back.', obj: [{ t: 'kill', m: ['treant_small'], n: 8 }], rew: { xp: 0.9, gold: 9, choice: [{ slot: 'hands', rarity: 'uncommon' }, { slot: 'feet', rarity: 'uncommon' }] } });
Q('q_f_wolves', { lvl: 14, giver: 'thalion', name: 'Gölge Sürüsü|The Shadow Pack', text: 'Batıda gölgelerden doğmuş kurtlar dolaşıyor. 8 Gölge Kurt avla ve 5 Keskin Diş getir.|Wolves born of shadow roam the west. Hunt 8 Shadow Wolves and bring 5 Sharp Fangs.', progress: 'Sürü hâlâ avlanıyor.|The pack still hunts.', done: 'Bu dişler karanlıkta parlıyor... Ürpertici.|These fangs glow in the dark... Eerie.', obj: [{ t: 'kill', m: ['shadow_wolf'], n: 8 }, { t: 'have', item: 'fang', n: 5 }], rew: { xp: 1, gold: 12, choice: [{ slot: 'main', rarity: 'uncommon' }, { slot: 'trinket', rarity: 'rare' }] } });
Q('q_f_shrooms', { lvl: 16, giver: 'elfinn', name: 'Mantar Ziyafeti|A Mushroom Feast', text: 'Mantar Vadisi\'ndeki mantar adamlar çorbamın malzemelerini çaldı! 8 Mantar Adam\'ı yen ve 6 Gümüş Yaprak topla.|The Shroomlings of Mushroom Hollow stole my soup ingredients! Defeat 8 Shroomlings and gather 6 Silverleaf.', progress: 'Çorbam bekliyor!|My soup is waiting!', done: 'Harika! Bu akşam herkese çorba benden.|Wonderful! Soup is on me tonight.', obj: [{ t: 'kill', m: ['mushroom_man'], n: 8 }, { t: 'gather', node: 'herb2', n: 6 }], accept: { unlock: 'herbalism' }, rew: { xp: 1, gold: 12, items: [{ id: 'food2', qty: 6 }, { id: 'hp2', qty: 4 }] } });
Q('q_f_witch', { lvl: 18, giver: 'hermit', name: 'Bataklık Cadısı|The Swamp Hag', text: 'Sisli Bataklık\'taki cadılar Zeyra ile anlaşma yaptı. 5 Bataklık Cadısı\'nın lanetini sonlandır.|The hags of Mistfen struck a pact with Zeyra. End the curse of 5 Swamp Hags.', progress: 'Cadılar hâlâ zehir kaynatıyor.|The hags still brew poison.', done: 'Bataklık nefes alıyor. Al, bu bastonun gücü sana yardım eder.|The fen breathes again. Take this — the staff\'s power will aid you.', obj: [{ t: 'kill', m: ['swamp_witch'], n: 5 }], rew: { xp: 1.1, gold: 16, choice: [{ slot: 'main', rarity: 'rare' }, { slot: 'neck', rarity: 'rare' }] } });
Q('q_f_ancient', { lvl: 16, giver: 'aelora', name: 'Kadim Ağaç Yaşlısı|The Ancient Treant', text: 'Ormanın en yaşlı ağacı yozlaştı ve batı tepelerinde öfkeyle dolaşıyor. Onu durdur; ruhu bize teşekkür edecek.|The forest\'s oldest tree has been corrupted and stalks the western hills in rage. Stop it; its spirit will thank us.', progress: 'Yaşlı ağaç hâlâ öfkeli.|The ancient one still rages.', done: 'Ruhu özgür. Kalbinden bir parça bıraktı sana.|Its spirit is free. It left you a piece of its heart.', obj: [{ t: 'kill', m: ['elder_treant'], n: 1 }], rew: { xp: 1.3, gold: 20, choice: [{ slot: 'trinket', rarity: 'rare' }, { slot: 'off', rarity: 'rare' }] } });
Q('q_f_moonclaw', { lvl: 17, giver: 'thalion', name: 'Ay Pençe|Moonclaw', text: 'Beyaz bir ayı, Ay Pençe, doğu tepelerinde korucularımı yaraladı. Bu efsanevi hayvanı avla.|A white bear, Moonclaw, wounded my rangers in the eastern hills. Hunt this legendary beast.', progress: 'Ay Pençe hâlâ yaşıyor.|Moonclaw still lives.', done: 'Efsaneler doğruymuş. Postunu sen al, hak ettin.|The legends were true. Take its pelt, you\'ve earned it.', obj: [{ t: 'kill', m: ['moonclaw'], n: 1 }], rew: { xp: 1.3, gold: 20, choice: [{ slot: 'cape', rarity: 'rare' }, { slot: 'chest', rarity: 'rare' }] } });
Q('q_f_petals', { lvl: 12, giver: 'elfpriest', name: 'Ay Taçyaprakları|Moon Petals', text: 'Tapınağın ritüeli için Gümüş Yaprak lazım. Ormandan 8 tane topla.|The temple\'s ritual needs Silverleaf. Gather 8 from the forest.', progress: 'Taçyapraklar nerede?|Where are the petals?', done: 'Ritüel tamamlanabilir. Ay seni kutsasın.|The ritual can be completed. May the moon bless you.', obj: [{ t: 'gather', node: 'herb2', n: 8 }], accept: { unlock: 'herbalism' }, rew: { xp: 0.8, gold: 8, items: [{ id: 'elixir_wisdom', qty: 2 }] } });
Q('q_f_ore', { lvl: 13, giver: 'elfsmith', name: 'Elf Çeliği|Elven Steel', text: 'Elf çeliği için demir lazım. Tepelerden 10 Demir Cevheri kaz.|Elven steel needs iron. Mine 10 Iron Ore from the hills.', progress: 'Cevher?|Ore?', done: 'Güzel demir. Sana elflerin dövme sırrını göstereyim.|Fine iron. Let me show you the elven forging secret.', obj: [{ t: 'gather', node: 'ore2', n: 10 }], accept: { unlock: 'mining' }, rew: { xp: 0.8, gold: 10, items: [{ id: 'enhance_stone', qty: 3 }] } });
Q('q_f_explore', { lvl: 12, giver: 'thalion', name: 'Ormanın Sırları|Secrets of the Wood', text: 'Ormanı tanı: Mantar Vadisi, Elf Harabeleri, Sisli Bataklık ve Gümüş Irmak.|Know the forest: Mushroom Hollow, the Elven Ruins, Mistfen and Silverstream.', progress: 'Keşfedilecek yerler var.|There\'s more to explore.', done: 'Artık gerçek bir korucu gibi düşünüyorsun.|You think like a true ranger now.', obj: [{ t: 'explore', poi: 'f_shroom' }, { t: 'explore', poi: 'f_ruins' }, { t: 'explore', poi: 'f_swamp' }, { t: 'explore', poi: 'f_river' }], rew: { xp: 1, gold: 10 } });
Q('q_f_guardian', { lvl: 20, giver: 'elfpriest', repeat: 'daily', name: 'Orman Muhafızı (Dünya Patronu)|Grove Guardian (World Boss)', text: 'Yozlaşmış Orman Muhafızı belirli aralıklarla Mantar Vadisi\'nin batısında uyanıyor. Diğer maceracılarla onu durdur.|The Corrupted Grove Guardian periodically awakens west of Mushroom Hollow. Stop it with other adventurers.', progress: 'Muhafızın uyanmasını bekle.|Wait for the Guardian to awaken.', done: 'Orman bir kez daha nefes alıyor.|The forest breathes once more.', obj: [{ t: 'kill', m: ['forest_guardian'], n: 1 }], rew: { xp: 1, gold: 40, items: [{ id: 'chest_boss', qty: 1 }] } });

ITEMS.q_totem = { name: 'Yozlaşmış Tılsım|Corrupted Totem', icon: 'skull', fill: ['#c8a0ff', '#4a1a6a'], type: 'quest', stack: 20, value: 0 };

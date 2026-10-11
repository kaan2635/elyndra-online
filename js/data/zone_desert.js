// ZONE 3 — Kavruk Çöl / Scorched Sands (levels 20-30). Registers zone, NPCs, quests and quest objects.
import { ZONES } from './zones.js';
import { NPCS } from './npcs.js';
import { QUESTS, QUEST_OBJECTS } from './quests.js';
import { SKIN, HAIR } from '../gfx/models.js';
import { ITEMS } from './items.js';

const H = o => ({ rig: 'humanoid', ...o });
const human = (o = {}) => H({ race: o.race || 'human', skin: SKIN[o.s ?? 3], hair: o.hair ?? 5, beard: o.beard ?? 0, hairColor: o.hc ?? HAIR[0], body: o.body || 0, gear: { chest: { m: o.cm || 'robe', c: o.c ?? 0xe8dcc0, c2: o.c2 ?? 0x3a6aa8 }, legs: { c: o.lc ?? 0xc8b890 }, head: o.head ?? { m: 'hood', c: o.hcol ?? 0xf0e8d8 }, ...(o.gear || {}) } });

ZONES.desert = {
  id: 'desert', name: 'Kavruk Çöl|Scorched Sands', level: [20, 30], music: 'desert', ambient: 'desert', weather: ['clear', 'clear', 'clear', 'sand', 'sand'],
  desc: 'Kavurucu güneşin altında uzanan altın kumlar, unutulmuş krallıkların mezarları ve gizemli bir tarikat.|Golden sands beneath a merciless sun, tombs of forgotten kingdoms and a secretive cult.',
  env: {
    sky: [0x3a7ad0, 0xf0dcb0, 0xb89a6a], fog: 0xf0d8a8, sun: 0xfff0c8, sunI: 2.6, hemiSky: 0xfff0d0, hemiGround: 0x9a7a4a, hemiI: 1.2, dusk: 0xff7a3a, fogFar: 190,
    night: { skyTop: 0x0a0c28, skyHor: 0x2a2440, fog: 0x1e1a2e, sun: 0x8090c8, hemiSky: 0x4a4a80, hemiGround: 0x2a2018 },
  },
  terrain: {
    size: 400, res: 160, seed: 37, base: 4.5, amp: 9, scale: 0.007, detailAmp: 1.6, detailScale: 0.03, borderH: 34, water: -0.8, surface: 'sand',
    palette: { ground: [0xd8b878, 0xe4c68a, 0xcfa86a], patch: 0xc89a5a, rock: 0xa87a4a, sand: 0xe8d098, shore: 0x8a9a4a, road: 0xb8945a, plaza: 0xc8b08a, under: 0x5a7a4a, waterMap: 0x2a8aa8 },
    roads: [
      { pts: [[0, 168], [10, 130], [20, 95], [10, 40], [-10, -10], [0, -60], [10, -120], [0, -168]], w: 4.5 },
      { pts: [[10, 40], [60, 50], [110, 60]], w: 3.5 },
      { pts: [[-10, -10], [-60, -40], [-80, -60]], w: 3.5 },
      { pts: [[0, -60], [60, -90], [100, -110]], w: 3.5 },
      { pts: [[-60, -40], [-110, -100], [-128, -122]], w: 3 },
    ],
    features: [
      { t: 'lake', x: -60, z: 75, r: 30, depth: 2.5 },
      { t: 'mesa', x: 130, z: -30, r: 30, h: 13 },
      { t: 'mesa', x: -140, z: 20, r: 24, h: 11 },
      { t: 'mesa', x: 60, z: 140, r: 18, h: 9 },
      { t: 'hill', x: -40, z: -120, r: 40, h: 8 },
      { t: 'hill', x: 150, z: 120, r: 35, h: 7 },
      { t: 'crater', x: 40, z: -150, r: 22, depth: 4, rim: 2 },
      { t: 'flat', x: 20, z: 95, r: 30, h: 3, edge: 10, plaza: 9 },
      { t: 'flat', x: 110, z: 60, r: 18, h: 3, edge: 10 },
      { t: 'flat', x: -80, z: -60, r: 18, h: 3.5, edge: 10 },
      { t: 'flat', x: 100, z: -110, r: 22, h: 4, edge: 10 },
      { t: 'flat', x: -128, z: -125, r: 18, h: 5, edge: 10 },
      { t: 'flat', x: 0, z: -168, r: 12, h: 4, edge: 8 },
      { t: 'flat', x: 0, z: 168, r: 12, h: 4, edge: 8 },
    ],
  },
  propColors: { leaf: 0x5a9a3a, trunk: 0x8a6a40, rock: 0xb88a5a, moss: 0x9a8a4a, grass: 0xb8a860, flowers: [0xff8a3a, 0xffd040, 0xe84a6a], cactus: 0x4a8a4a, bush: 0x8a8a4a, stone: 0xd0b890 },
  towns: [{ id: 'serap', name: 'Serap Vahası|Mirage Oasis', x: 20, z: 95, r: 28, h: 3, style: 'desert', seed: 13, gates: [Math.PI, 0, Math.PI / 2], wall: 'wall', center: 'well', special: { smithy: 'smithy', inn: 'inn', temple: 'temple', stable: 'stable' } }],
  structures: [
    // raider camp
    { type: 'tent', x: 102, z: 54, rot: 0.6, style: 'desert', c: 0x8a2a1a }, { type: 'tent', x: 118, z: 64, rot: -2.2, style: 'desert', c: 0x6a3a1a },
    { type: 'tent', x: 108, z: 70, rot: 2.8, style: 'desert', c: 0xa84a2a, s: 0.85 }, { type: 'campfire', x: 110, z: 60, style: 'desert' },
    { type: 'crates', x: 98, z: 64, rot: 0.3, style: 'desert' }, { type: 'banner', x: 116, z: 52, style: 'desert', c: 0x8a1a1a },
    // archaeologist camp
    { type: 'tent', x: 66, z: 16, rot: -0.8, style: 'desert', c: 0xe8dcc0 }, { type: 'campfire', x: 58, z: 10, style: 'desert' }, { type: 'crates', x: 70, z: 6, rot: 1.2, style: 'desert' },
    // cult temple
    { type: 'temple', x: -80, z: -60, rot: 0.9, style: 'desert', w: 12, d: 10 }, { type: 'obelisk', x: -64, z: -48, rot: 0.2, style: 'desert', glow: 0xff5a2a },
    { type: 'obelisk', x: -96, z: -72, rot: 0.5, style: 'desert', glow: 0xff5a2a }, { type: 'altar', x: -70, z: -70, rot: 0.9, style: 'desert', glow: 0xff5a2a },
    // necropolis
    { type: 'obelisk', x: 88, z: -98, rot: 0, style: 'desert', glow: 0x6af0ff }, { type: 'obelisk', x: 112, z: -122, rot: 0.4, style: 'desert', glow: 0x6af0ff },
    { type: 'ruinpillar', x: 96, z: -122, style: 'desert' }, { type: 'rubble', x: 108, z: -100, rot: 1.2, style: 'desert' }, { type: 'statue', x: 100, z: -110, rot: 0.8, style: 'desert' },
    { type: 'rubble', x: 84, z: -114, rot: 2.1, style: 'desert' },
    // pyramid entrance
    { type: 'temple', x: -120, z: -136, rot: 0.8, style: 'desert', w: 14, d: 12 }, { type: 'cave', x: -132, z: -128, rot: 0.8, style: 'desert', rock: 0xc8a06a },
    { type: 'obelisk', x: -112, z: -116, rot: 0.8, style: 'desert', glow: 0xffd060 }, { type: 'obelisk', x: -140, z: -108, rot: 0.8, style: 'desert', glow: 0xffd060 },
    // oasis
    { type: 'bridge', x: -38, z: 74, rot: Math.PI / 2 + 0.2, style: 'desert', l: 10, by: 0.2 }, { type: 'hut', x: -86, z: 104, rot: -0.8, style: 'desert' },
    // portals
    { type: 'portal', x: 0, z: 172, rot: Math.PI, style: 'elven', c: 0x6affb0 },
    { type: 'portal', x: 0, z: -172, rot: 0, style: 'dwarven', c: 0x8ad8ff },
    // waystones
    { type: 'waystone', x: 34, z: 128, style: 'desert' }, { type: 'waystone', x: 90, z: 40, style: 'desert' }, { type: 'waystone', x: -60, z: -30, style: 'desert' },
    { type: 'waystone', x: 76, z: -86, style: 'desert' }, { type: 'waystone', x: -104, z: -104, style: 'desert' }, { type: 'waystone', x: 10, z: -155, style: 'desert' },
  ],
  scatter: [
    { type: 'palm', d: 0.004, area: { x: -60, z: 75, r: 48 }, s: [0.9, 1.4] },
    { type: 'palm', d: 0.002, area: { x: 20, z: 95, r: 45 }, s: [0.9, 1.3] },
    { type: 'palm', d: 0.00008, s: [0.9, 1.2] },
    { type: 'cactus', d: 0.0012, s: [0.8, 1.5] },
    { type: 'dead', d: 0.0003, s: [0.7, 1.1], tint: [0x8a6a4a, 0x6a5038] },
    { type: 'rock', d: 0.0008, s: [0.6, 1.5] },
    { type: 'boulder', d: 0.0003, s: [0.8, 1.4] },
    { type: 'spire', d: 0.00015, s: [0.8, 1.4] },
    { type: 'bones', d: 0.0004, s: [0.8, 1.3] },
    { type: 'bush', d: 0.0006, s: [0.6, 1.0] },
    { type: 'grass', d: 0.002, s: [0.6, 1.1], small: true },
    { type: 'grass', d: 0.012, area: { x: -60, z: 75, r: 50 }, s: [0.8, 1.3], small: true },
    { type: 'reeds', d: 0.006, shore: true, s: [0.8, 1.3], small: true },
    { type: 'flowers', d: 0.002, area: { x: -60, z: 75, r: 45 }, s: [0.8, 1.2], small: true },
    { type: 'ruinpillar', d: 0.00007, s: [0.8, 1.3] },
  ],
  clear: [{ x: 110, z: 60, r: 18 }, { x: 62, z: 12, r: 12 }, { x: -80, z: -60, r: 20 }, { x: 100, z: -110, r: 24 }, { x: -128, z: -125, r: 20 }, { x: 0, z: 168, r: 14 }, { x: 0, z: -168, r: 14 }],
  spawns: [
    { m: 'lizard', x: -10, z: 50, r: 26, n: 8, lvl: [20, 22] },
    { m: ['desert_bandit', 'desert_bandit'], x: 110, z: 60, r: 20, n: 9, lvl: [20, 22], camp: true },
    { m: 'vulture', x: 50, z: -20, r: 30, n: 7, lvl: [21, 23] },
    { m: 'croc', x: -60, z: 75, r: 26, n: 6, lvl: [21, 23] },
    { m: 'scorpion', x: 130, z: 0, r: 30, n: 9, lvl: [22, 24] },
    { m: 'scorpion', x: -130, z: 60, r: 24, n: 6, lvl: [23, 25] },
    { m: 'mummy', x: 100, z: -110, r: 22, n: 9, lvl: [23, 26], camp: true },
    { m: ['cultist', 'cultist', 'sand_elemental'], x: -80, z: -60, r: 20, n: 9, lvl: [24, 26], camp: true },
    { m: 'sand_elemental', x: -20, z: -100, r: 28, n: 8, lvl: [25, 27] },
    { m: ['mummy', 'scarab_beetle', 'scarab_beetle'], x: -110, z: -110, r: 18, n: 7, lvl: [27, 29] },
    { m: ['desert_bandit', 'scorpion'], x: 140, z: 120, r: 26, n: 7, lvl: [26, 28] },
    { m: 'sandworm', x: 40, z: -140, r: 8, n: 1, lvl: 27, respawn: 300 },
  ],
  critters: [{ m: 'scarab', n: 14 }, { m: 'crab', n: 6, area: { x: -60, z: 75, r: 30 } }, { m: 'rabbit', n: 4 }],
  worldBoss: { m: 'sand_titan', x: 20, z: -60, lvl: 30, every: 720, name: 'Kum Devi|The Sand Titan' },
  waystones: [
    { id: 'w_serap', name: 'Serap Vahası|Mirage Oasis', x: 34, z: 128 }, { id: 'w_raider', name: 'Yağmacı Kampı|Raider Camp', x: 90, z: 40 }, { id: 'w_cult', name: 'Güneş Tapınağı|Sun Temple', x: -60, z: -30 },
    { id: 'w_necro', name: 'Ölüler Şehri|The Necropolis', x: 76, z: -86 }, { id: 'w_pyramid', name: 'Kayıp Piramit|The Lost Pyramid', x: -104, z: -104 }, { id: 'w_dnorth', name: 'Kuzey Kervan Yolu|Northern Caravan Road', x: 10, z: -155 },
  ],
  portals: [{ to: 'forest', x: 0, z: 172, r: 3.5, lvl: 1, label: 'Fısıltı Ormanı|Whisperwood', oz: -8 }, { to: 'frost', x: 0, z: -172, r: 3.5, lvl: 30, label: 'Buzdoruk Dağları|Frostpeak Mountains', oz: 8 }],
  dungeons: [{ id: 'd_pyramid', x: -129, z: -125, r: 4 }],
  nodes: [{ type: 'herb3', n: 16 }, { type: 'ore3', n: 14 }, { type: 'wood3', n: 10 }],
  fishing: [{ x: -60, z: 75, r: 25, fish: ['fish3', 'fish3', 'fish2'] }],
  pois: [
    { id: 'd_serap', name: 'Serap Vahası|Mirage Oasis', x: 20, z: 95, r: 30, town: true },
    { id: 'd_oasis', name: 'Zümrüt Gölü|Emerald Pool', x: -60, z: 75, r: 32 },
    { id: 'd_raider', name: 'Yağmacı Kampı|Raider Camp', x: 110, z: 60, r: 20 },
    { id: 'd_digsite', name: 'Kazı Alanı|The Dig Site', x: 62, z: 12, r: 14 },
    { id: 'd_temple', name: 'Güneş Tapınağı|Sun Temple', x: -80, z: -60, r: 22 },
    { id: 'd_necro', name: 'Ölüler Şehri|The Necropolis', x: 100, z: -110, r: 26 },
    { id: 'd_pyramid', name: 'Kayıp Piramit|The Lost Pyramid', x: -128, z: -125, r: 16, dungeon: true },
    { id: 'd_mesa', name: 'Kızıl Yayla|Red Mesa', x: 130, z: -30, r: 28 },
    { id: 'd_crater', name: 'Yıldız Çukuru|Starfall Crater', x: 40, z: -150, r: 22 },
  ],
  start: { x: 0, z: 160 },
};

// ---------------------------------------------------------------- NPCs
Object.assign(NPCS, {
  kerem: { zone: 'desert', at: 'serap.center', name: 'Vezir Kerem|Vizier Kerem', title: 'Serap Vahası Veziri|Vizier of Mirage Oasis', roles: ['quest'], model: human({ s: 3, hair: 5, beard: 3, hc: HAIR[0], c: 0x2a4a8a, c2: 0xd8b04a, head: { m: 'headdress', c: 0xf0e8d8, c2: 0xd8b04a }, gear: { main: { m: 'staff', c2: 0xd8b04a, glow: 0xffd060 } } }), greet: 'Kumlar her şeyi hatırlar, Kristal Taşıyıcı. Her şeyi.|The sands remember everything, Crystal Bearer. Everything.' },
  rustem: { zone: 'desert', at: [60, 16], rot: 1.2, name: 'Kâşif Rüstem|Rustem the Explorer', title: 'Kraliyet Arkeoloji Derneği|Royal Archaeological Society', roles: ['quest'], model: human({ s: 1, hair: 2, beard: 1, hc: HAIR[2], cm: 'leather', c: 0xa8885a, c2: 0x5a3a1a, head: { m: 'hat', c: 0xc8a878 } }), greet: 'Şu yazıtlara bak! Dört bin yıllık!|Look at these inscriptions! Four thousand years old!' },
  dsmith: { zone: 'desert', at: 'serap.smithy', name: 'Usta Halil|Master Halil', title: 'Vaha Demircisi|Oasis Smith', roles: ['shop', 'enhance', 'train', 'quest'], shop: 'smith', prof: ['smithing', 'mining', 'jewelcrafting'], model: human({ s: 4, hair: 0, beard: 2, cm: 'leather', c: 0x5a3a2a, c2: 0x8a6a4a, head: null, gear: { main: { m: 'hammer', c: 0xc8c8d0 } } }), greet: 'Çöl çeliği güneşte dövülür.|Desert steel is forged under the sun.' },
  dinn: { zone: 'desert', at: 'serap.inn', name: 'Hancı Leyla|Leyla the Innkeeper', title: 'Serin Gölge Hanı|The Cool Shade', roles: ['shop', 'inn', 'quest', 'train'], shop: 'inn', prof: ['cooking', 'alchemy', 'herbalism'], model: human({ s: 2, hair: 4, hc: HAIR[0], body: 1, c: 0xa83a5a, c2: 0xd8b04a, cm: 'cloth', head: { m: 'hood', c: 0xd84a6a } }), greet: 'Hurma şerbeti? Serinletir.|Date sherbet? It cools you down.' },
  dmerchant: { zone: 'desert', at: 'serap.stall0', name: 'Tüccar Davut|Davut the Trader', title: 'Kervan Pazarı|Caravan Bazaar', roles: ['shop', 'bank', 'market', 'guild', 'train'], shop: 'general', prof: ['tailoring'], model: human({ s: 3, hair: 5, beard: 2, c: 0x6a2a8a, c2: 0xd8b04a, cm: 'cloth', head: { m: 'headdress', c: 0x6a2a8a, c2: 0xd8b04a } }), greet: 'Kervanlar uzak diyarlardan nadir mallar getirdi!|The caravans brought rare goods from distant lands!' },
  nefer: { zone: 'desert', at: 'serap.temple', name: 'Kâhin Nefer|Oracle Nefer', title: 'Güneş Kâhini|Oracle of the Sun', roles: ['quest', 'dungeon', 'arena', 'stable'], model: human({ s: 4, hair: 1, hc: HAIR[0], body: 1, c: 0xf0e8d8, c2: 0xd8b04a, head: { m: 'circlet', c2: 0xd8b04a, gem: 0x3a8ad8 } }), greet: 'Güneş her şeyi görür... ama piramidin içini değil.|The sun sees everything... except inside the pyramid.' },
  zara: { zone: 'desert', at: [-50, 98], rot: -2.2, name: 'Balıkçı Zara|Zara the Angler', title: 'Zümrüt Gölü|Emerald Pool', roles: ['quest', 'shop'], shop: 'fish', model: human({ s: 2, hair: 2, hc: HAIR[1], body: 1, cm: 'cloth', c: 0x3a8a8a, c2: 0xe8dcc0, head: { m: 'hat', c: 0xd8c8a0 } }), greet: 'Çölde balık mı? Bu gölde her şey olur!|Fish in the desert? Anything goes in this pool!' },
});

// ---------------------------------------------------------------- quests
const Q = (id, o) => { QUESTS[id] = { id, zone: 'desert', ...o }; };
// main story, chapter III
Q('q_d_caravans', { main: true, lvl: 20, giver: 'kerem', prev: 'q_f_onward', name: 'Yağmalanan Kervanlar|Plundered Caravans',
  text: 'Parçayı aramadan önce bir sorunumuz var: doğudaki yağmacılar kervanlarımızı basıyor. 8 Çöl Yağmacısı\'nı durdur ve çalınan 5 Kervan Sandığı\'nı geri getir.|Before we seek the shard, we have a problem: raiders in the east are plundering our caravans. Stop 8 Desert Raiders and bring back 5 stolen Caravan Crates.',
  progress: 'Kervanlar hâlâ tehlikede.|The caravans are still in danger.', done: 'Mallarımız geri döndü! Şimdi parçadan bahsedelim...|Our goods are back! Now, about that shard...',
  obj: [{ t: 'kill', m: ['desert_bandit'], n: 8 }, { t: 'collect', item: 'q_cargo', n: 5, from: ['desert_bandit'], chance: 0.6 }], rew: { xp: 1, gold: 14, choice: [{ slot: 'chest', rarity: 'uncommon' }, { slot: 'legs', rarity: 'uncommon' }] } });
Q('q_d_digsite', { main: true, lvl: 21, giver: 'kerem', prev: 'q_d_caravans', name: 'Kazı Alanı|The Dig Site',
  text: 'Parça çöle düştüğünde Kâşif Rüstem kazı alanında bir ışık gördüğünü söylüyor. Doğudaki kazı alanında onu bul.|When the shard fell, Rustem the Explorer says he saw a light over his dig site. Find him at the dig site to the east.',
  done: 'Kristal Taşıyıcı mı? Mükemmel! Tam da ihtiyacım olan kişi!|The Crystal Bearer? Perfect! Just the person I needed!',
  obj: [{ t: 'talk', npc: 'rustem' }], turnin: 'rustem', rew: { xp: 0.4, gold: 6 } });
Q('q_d_tablets', { main: true, lvl: 23, giver: 'rustem', prev: 'q_d_digsite', name: 'Ölülerin Yazıtları|Tablets of the Dead',
  text: 'Ölüler Şehri\'ndeki üç yazıt, Firavun Anuket\'in mezarının yerini anlatıyor. Ama mumyalar uyandı! 6 Mumya\'yı yok et ve üç yazıtı incele.|Three tablets in the Necropolis tell where Pharaoh Anuket\'s tomb lies. But the mummies have awoken! Destroy 6 Mummies and study the three tablets.',
  progress: 'Yazıtları okudun mu?|Did you read the tablets?', done: 'Piramit... kumların altında, batıda! Ve parça onun asasında!|The pyramid... beneath the sands, in the west! And the shard is in his staff!',
  obj: [{ t: 'kill', m: ['mummy'], n: 6 }, { t: 'interact', obj: 'qo_tablet1', n: 1 }, { t: 'interact', obj: 'qo_tablet2', n: 1 }, { t: 'interact', obj: 'qo_tablet3', n: 1 }], rew: { xp: 1.1, gold: 16, choice: [{ slot: 'head', rarity: 'uncommon' }, { slot: 'hands', rarity: 'rare' }] } });
Q('q_d_cult', { main: true, lvl: 25, giver: 'rustem', prev: 'q_d_tablets', name: 'Güneş Tarikatı|The Sun Cult',
  text: 'Güneş Tapınağı\'ndaki tarikatçılar parçanın gücüyle Anuket\'i uyandırdı. 8 Kum Tarikatçısı\'nı durdur ve liderlerinin taşıdığı Tarikat Mührü\'nü al.|The cultists of the Sun Temple woke Anuket with the shard\'s power. Stop 8 Sand Cultists and take the Cult Sigil their leaders carry.',
  progress: 'Mühür hâlâ onlarda.|They still hold the sigil.', done: 'Bu mühür piramidin kapısını açar. Ama dikkat, kapıyı kum ruhları koruyor.|This sigil opens the pyramid\'s gate. But beware, sand spirits guard the door.',
  obj: [{ t: 'kill', m: ['cultist'], n: 8 }, { t: 'collect', item: 'q_sigil', n: 1, from: ['cultist'], chance: 0.35 }], rew: { xp: 1.2, gold: 18, choice: [{ slot: 'main', rarity: 'rare' }, { slot: 'off', rarity: 'rare' }] } });
Q('q_d_elementals', { main: true, lvl: 26, giver: 'kerem', prev: 'q_d_cult', name: 'Kum Ruhları|Spirits of the Sand',
  text: 'Tarikat kum ruhlarını da uyandırdı; piramide giden yolu tutuyorlar. 8 Kum Elementali\'ni dağıt.|The cult also woke the sand spirits; they hold the road to the pyramid. Scatter 8 Sand Elementals.',
  progress: 'Kum fırtınası dinmedi.|The sandstorm has not settled.', done: 'Yol açık. Kâhin Nefer sana piramit için yoldaşlar bulacak.|The road is open. Oracle Nefer will find you companions for the pyramid.',
  obj: [{ t: 'kill', m: ['sand_elemental'], n: 8 }], rew: { xp: 1.2, gold: 18, choice: [{ slot: 'feet', rarity: 'rare' }, { slot: 'shoulders', rarity: 'rare' }] } });
Q('q_d_anuket', { main: true, lvl: 28, giver: 'nefer', prev: 'q_d_elementals', name: 'Firavunun Laneti|The Pharaoh\'s Curse',
  text: 'Firavun Anuket üçüncü parçayı asasına yerleştirdi ve ölüler ordusunu yönetiyor. Kayıp Piramit\'e gir ve onu sonsuz uykusuna geri gönder.|Pharaoh Anuket set the third shard into his staff and commands an army of the dead. Enter the Lost Pyramid and return him to his eternal sleep.',
  progress: 'Firavun hâlâ hüküm sürüyor.|The pharaoh still reigns.', done: 'Üçüncü parça! Kumlar sessizleşti. Vezir Kerem sana minnettar olacak.|The third shard! The sands have fallen silent. Vizier Kerem will be grateful.',
  obj: [{ t: 'boss', m: 'anuket' }], turnin: 'kerem', rew: { xp: 1.7, gold: 60, choice: [{ slot: 'main', rarity: 'rare' }, { slot: 'chest', rarity: 'rare' }, { slot: 'neck', rarity: 'rare' }], items: [{ id: 'enhance_stone', qty: 5 }] } });
Q('q_d_onward', { main: true, lvl: 30, giver: 'kerem', prev: 'q_d_anuket', name: 'Buzun Çağrısı|The Call of the Ice',
  text: 'Dördüncü parça kuzeyin donmuş dağlarına düştü. Kuzey Kervan Yolu\'ndaki portaldan geç; Demirkale\'de Kral Thorgrim seni bekliyor.|The fourth shard fell into the frozen mountains of the north. Pass through the portal on the Northern Caravan Road; King Thorgrim awaits you in Ironhold.',
  progress: 'Thorgrim seni bekliyor.|Thorgrim awaits.', done: 'Hah! Demek sen o kristalci kahramansın. Gel, ısın biraz.|Hah! So you\'re the crystal hero. Come, warm yourself.',
  obj: [{ t: 'talk', npc: 'thorgrim' }], turnin: 'thorgrim', rew: { xp: 0.5, gold: 16 } });
// side quests
Q('q_d_lizards', { lvl: 20, giver: 'dinn', name: 'Kertenkele Kebabı|Lizard Kebab', text: 'Hanın meşhur kebabı için kertenkele eti lazım. 8 Kum Kertenkelesi avla.|The inn\'s famous kebab needs lizard meat. Hunt 8 Sand Lizards.', progress: 'Müşteriler aç!|The customers are hungry!', done: 'Mis gibi! Al, bunlar senin için.|Smells delicious! Here, these are for you.', obj: [{ t: 'kill', m: ['lizard'], n: 8 }], rew: { xp: 0.9, gold: 12, items: [{ id: 'food3', qty: 6 }] } });
Q('q_d_vultures', { lvl: 21, giver: 'kerem', name: 'Leş Kargaları|Carrion Birds', text: 'Akbabalar yaralı kervancılara saldırıyor. 8 Akbaba\'yı gökten indir.|Vultures attack wounded caravaneers. Bring down 8 Vultures.', progress: 'Gökyüzü hâlâ kara.|The sky is still dark with them.', done: 'Kervanlar daha güvende.|The caravans are safer now.', obj: [{ t: 'kill', m: ['vulture'], n: 8 }], rew: { xp: 0.9, gold: 12, choice: [{ slot: 'cape', rarity: 'uncommon' }, { slot: 'hands', rarity: 'uncommon' }] } });
Q('q_d_crocs', { lvl: 22, giver: 'zara', name: 'Gölün Dişleri|Teeth of the Pool', text: 'Timsahlar balık tutmamı engelliyor! 6 Vaha Timsahı\'nı uzaklaştır.|Crocodiles keep me from fishing! Drive off 6 Oasis Crocodiles.', progress: 'Timsahlar hâlâ kıyıda.|The crocs are still on the shore.', done: 'Şimdi rahatça olta atabilirim!|Now I can cast in peace!', obj: [{ t: 'kill', m: ['croc'], n: 6 }], rew: { xp: 1, gold: 14, choice: [{ slot: 'feet', rarity: 'uncommon' }, { slot: 'legs', rarity: 'uncommon' }] } });
Q('q_d_fish', { lvl: 22, giver: 'zara', name: 'Çöl Balıkları|Desert Fish', text: 'Zümrüt Gölü\'nden 5 balık tut. Sabır, sabır!|Catch 5 fish from the Emerald Pool. Patience, patience!', progress: 'Olta hazır mı?|Rod ready?', done: 'İşte gerçek bir balıkçı!|Now that\'s a real angler!', obj: [{ t: 'fish', n: 5 }], accept: { unlock: 'fishing' }, rew: { xp: 0.8, gold: 10, items: [{ id: 'food3', qty: 4 }, { id: 'hp3', qty: 4 }] } });
Q('q_d_scorpions', { lvl: 23, giver: 'rustem', name: 'Zehirli Kumlar|Venomous Sands', text: 'Akrepler kazı işçilerimi sokuyor. Kızıl Yayla civarında 10 Çöl Akrebi\'ni temizle.|Scorpions keep stinging my diggers. Clear 10 Desert Scorpions around the Red Mesa.', progress: 'İşçiler korkuyor.|The workers are scared.', done: 'Kazı devam edebilir!|The dig can continue!', obj: [{ t: 'kill', m: ['scorpion'], n: 10 }], rew: { xp: 1, gold: 16, choice: [{ slot: 'trinket', rarity: 'uncommon' }, { slot: 'ring', rarity: 'uncommon' }] } });
Q('q_d_herbs', { lvl: 22, giver: 'dinn', name: 'Çöl Çiçeği|Desert Bloom', text: 'Şifa iksirleri için 8 Çöl Gülü topla.|Gather 8 Desert Rose for healing draughts.', progress: 'Güller?|The roses?', done: 'Bunlarla bir sürü iksir yaparım.|I can make plenty of draughts with these.', obj: [{ t: 'gather', node: 'herb3', n: 8 }], accept: { unlock: 'herbalism' }, rew: { xp: 0.8, gold: 10, items: [{ id: 'hp3', qty: 5 }, { id: 'mp3', qty: 5 }] } });
Q('q_d_ore', { lvl: 24, giver: 'dsmith', name: 'Güneş Çeliği|Sunsteel', text: 'Yaylalardan 10 cevher kaz; sana güneş çeliğinin sırrını öğreteyim.|Mine 10 ore from the mesas; I\'ll teach you the secret of sunsteel.', progress: 'Cevher?|Ore?', done: 'İyi iş! Al, bunlar ekipmanını güçlendirir.|Good work! Take these, they\'ll strengthen your gear.', obj: [{ t: 'gather', node: 'ore3', n: 10 }], accept: { unlock: 'mining' }, rew: { xp: 0.9, gold: 12, items: [{ id: 'enhance_stone', qty: 3 }] } });
Q('q_d_explore', { lvl: 22, giver: 'kerem', name: 'Çölün Haritası|Map of the Sands', text: 'Kâşiflerimiz için çölü haritala: Zümrüt Gölü, Kızıl Yayla, Ölüler Şehri ve Yıldız Çukuru.|Chart the desert for our explorers: the Emerald Pool, Red Mesa, the Necropolis and Starfall Crater.', progress: 'Harita eksik.|The map is incomplete.', done: 'Bu harita bir servet eder!|This map is worth a fortune!', obj: [{ t: 'explore', poi: 'd_oasis' }, { t: 'explore', poi: 'd_mesa' }, { t: 'explore', poi: 'd_necro' }, { t: 'explore', poi: 'd_crater' }], rew: { xp: 1, gold: 14 } });
Q('q_d_raiders2', { lvl: 27, giver: 'dmerchant', name: 'Doğu Tepelerinin Yağmacıları|Raiders of the Eastern Dunes', text: 'Güneydoğudaki tepelerde yeni bir yağmacı çetesi kuruldu. 8 Çöl Yağmacısı daha!|A new raider gang set up in the south-eastern dunes. Another 8 Desert Raiders!', progress: 'Pazar tehlikede!|The bazaar is in danger!', done: 'Ticaret yeniden güvende.|Trade is safe once more.', obj: [{ t: 'kill', m: ['desert_bandit'], n: 8 }], rew: { xp: 1.1, gold: 20, choice: [{ slot: 'main', rarity: 'rare' }, { slot: 'ring', rarity: 'rare' }] } });
Q('q_d_tomb', { lvl: 28, giver: 'nefer', name: 'Mezar Böcekleri|Tomb Scarabs', text: 'Piramidin dışına taşan böcekler ve mumyalar kâhinleri tehdit ediyor. 8 Dev Böcek ezin.|Scarabs and mummies spilling from the pyramid threaten the oracles. Crush 8 Giant Scarabs.', progress: 'Böcekler hâlâ kaynıyor.|The scarabs still swarm.', done: 'Güneş seni korusun.|May the sun protect you.', obj: [{ t: 'kill', m: ['scarab_beetle'], n: 8 }], rew: { xp: 1.1, gold: 20, choice: [{ slot: 'head', rarity: 'rare' }, { slot: 'trinket', rarity: 'rare' }] } });
Q('q_d_worm', { lvl: 27, giver: 'rustem', name: 'Dev Kum Solucanı|The Great Sandworm', text: 'Yıldız Çukuru\'nda kumların altında devasa bir şey dolaşıyor. Onu avla, ama dikkatli ol!|Something huge moves beneath the sands of Starfall Crater. Hunt it, but be careful!', progress: 'Solucan hâlâ yaşıyor.|The worm still lives.', done: 'İnanılmaz! Bu dişi müzeye bağışlayacağım... ama sen bunu al.|Incredible! I\'ll donate this tooth to the museum... but you take this.', obj: [{ t: 'kill', m: ['sandworm'], n: 1 }], rew: { xp: 1.4, gold: 30, choice: [{ slot: 'cape', rarity: 'rare' }, { slot: 'off', rarity: 'rare' }] } });
Q('q_d_titan', { lvl: 30, giver: 'nefer', repeat: 'daily', name: 'Kum Devi (Dünya Patronu)|The Sand Titan (World Boss)', text: 'Kum Devi belirli aralıklarla çölün kalbinde yükseliyor. Diğer maceracılarla onu durdur.|The Sand Titan periodically rises in the heart of the desert. Stop it with other adventurers.', progress: 'Devin yükselmesini bekle.|Wait for the Titan to rise.', done: 'Kumlar yeniden yatıştı.|The sands are calm again.', obj: [{ t: 'kill', m: ['sand_titan'], n: 1 }], rew: { xp: 1, gold: 60, items: [{ id: 'chest_boss', qty: 1 }] } });

Object.assign(QUEST_OBJECTS, {
  qo_tablet1: { zone: 'desert', x: 90, z: -104, model: 'sparkle', label: 'Antik Yazıt|Ancient Tablet', quest: 'q_d_tablets', glow: 0x6af0ff },
  qo_tablet2: { zone: 'desert', x: 112, z: -112, model: 'sparkle', label: 'Antik Yazıt|Ancient Tablet', quest: 'q_d_tablets', glow: 0x6af0ff },
  qo_tablet3: { zone: 'desert', x: 98, z: -128, model: 'sparkle', label: 'Antik Yazıt|Ancient Tablet', quest: 'q_d_tablets', glow: 0x6af0ff },
});

ITEMS.q_cargo = { name: 'Kervan Sandığı|Caravan Crate', icon: 'chest_box', fill: ['#e8c88a', '#6a4a2a'], type: 'quest', stack: 20, value: 0 };
ITEMS.q_sigil = { name: 'Tarikat Mührü|Cult Sigil', icon: 'sun', fill: ['#ffb04a', '#8a2a1a'], type: 'quest', stack: 1, value: 0 };

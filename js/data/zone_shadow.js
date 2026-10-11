// ZONE 6 — Gölge Diyarı / The Shadowlands (levels 50-60). Final zone: Malakar's realm, the raid and the epilogue.
import { ZONES } from './zones.js';
import { NPCS } from './npcs.js';
import { QUESTS, QUEST_OBJECTS } from './quests.js';
import { SKIN, SKIN_ELF, HAIR } from '../gfx/models.js';
import { ITEMS } from './items.js';

const H = o => ({ rig: 'humanoid', ...o });
const npc = (o = {}) => H({ race: o.race || 'human', skin: o.skin ?? SKIN[o.s ?? 0], hair: o.hair ?? 1, beard: o.beard ?? 0, hairColor: o.hc ?? HAIR[4], body: o.body || 0, gear: { chest: { m: o.cm || 'plate', c: o.c ?? 0xe8e4f0, c2: o.c2 ?? 0xe8c860 }, legs: { c: o.lc ?? 0x3a3a4a }, ...(o.head ? { head: o.head } : {}), ...(o.gear || {}) } });

ZONES.shadow = {
  id: 'shadow', name: 'Gölge Diyarı|The Shadowlands', level: [50, 60], music: 'shadow', ambient: 'shadow', weather: ['mist', 'mist', 'clear', 'ash'],
  desc: 'Güneşin hiç doğmadığı, ölülerin yürüdüğü ve Gölge Lordu Malakar\'ın tahtının yükseldiği lanetli topraklar.|Cursed lands where the sun never rises, the dead walk, and the throne of Malakar the Shadow Lord looms.',
  env: {
    sky: [0x241a44, 0x7a6a9a, 0x2a2238], fog: 0x52467a, sun: 0xd8c8ff, sunI: 2.1, hemiSky: 0xa898d8, hemiGround: 0x2e2838, hemiI: 1.35, dusk: 0xb86aff, fogFar: 130,
    night: { skyTop: 0x06040e, skyHor: 0x1a1030, fog: 0x120c1e, sun: 0x8a70d0, hemiSky: 0x4a3a7a, hemiGround: 0x0a0810 },
  },
  terrain: {
    size: 400, res: 160, seed: 89, base: 5, amp: 9, scale: 0.008, detailAmp: 1.8, detailScale: 0.05, ridgeAmp: 5, ridgeScale: 0.012, borderH: 44, water: -0.7, surface: 'grass',
    palette: { ground: [0x4c4a5a, 0x5c5868, 0x464250], patch: 0x5a4a6a, rock: 0x3a3644, sand: 0x5a5460, shore: 0x4a4458, road: 0x6a6270, plaza: 0x8a8494, under: 0x1a1428, waterMap: 0x3a2a5a },
    waterShallow: 0x5a3a8a, waterDeep: 0x140a24,
    roads: [
      { pts: [[0, 168], [-6, 130], [0, 95], [10, 40], [-10, -10], [0, -60], [-10, -110], [0, -150]], w: 4.5 },
      { pts: [[10, 40], [60, 50], [110, 60]], w: 3.5 },
      { pts: [[-10, -10], [-60, -10], [-110, 0]], w: 3.5 },
      { pts: [[0, -60], [60, -80], [110, -90]], w: 3.5 },
      { pts: [[-10, -110], [-70, -110], [-120, -120]], w: 3 },
    ],
    features: [
      { t: 'lake', x: -90, z: 90, r: 32, depth: 3 },
      { t: 'lake', x: 120, z: -20, r: 18, depth: 2 },
      { t: 'hill', x: 140, z: 130, r: 40, h: 12 },
      { t: 'hill', x: -150, z: -40, r: 35, h: 14 },
      { t: 'hill', x: 130, z: -140, r: 40, h: 16 },
      { t: 'crater', x: 60, z: -80, r: 26, depth: 3, rim: 4 },
      { t: 'flat', x: 0, z: 95, r: 30, h: 4, edge: 12, plaza: 9 },
      { t: 'flat', x: 110, z: 60, r: 18, h: 4, edge: 10 },
      { t: 'flat', x: -110, z: 0, r: 18, h: 5, edge: 10 },
      { t: 'flat', x: -120, z: -120, r: 18, h: 5, edge: 10 },
      { t: 'flat', x: 0, z: -150, r: 22, h: 6, edge: 12, plaza: 12 },
      { t: 'flat', x: 0, z: 168, r: 12, h: 4, edge: 8 },
    ],
  },
  propColors: { leaf: 0x3a2a4a, trunk: 0x2a2230, rock: 0x3a3644, moss: 0x4a3a5a, grass: 0x3a3a48, flowers: [0xb86aff, 0x6ad8ff, 0xd68aff], crystal: 0xb86aff, glow: 0xd68aff, cap: 0x4a2a6a, spots: 0xb86aff, stone: 0x5a5468 },
  towns: [{ id: 'lastlight', name: 'Son Işık|Lastlight', x: 0, z: 95, r: 28, h: 4, style: 'holy', seed: 29, gates: [Math.PI, 0, Math.PI / 2], wall: 'wall', center: 'statue', special: { smithy: 'smithy', inn: 'inn', temple: 'temple', stable: 'stable' } }],
  structures: [
    // hunters' vigil
    { type: 'tent', x: 104, z: 54, rot: -0.6, style: 'holy', c: 0x3a3a5a }, { type: 'tent', x: 118, z: 66, rot: 2.4, style: 'holy', c: 0x2a2a4a }, { type: 'campfire', x: 110, z: 60, style: 'holy' },
    { type: 'banner', x: 100, z: 66, style: 'holy', c: 0xe8c860 }, { type: 'lamp', x: 116, z: 52, style: 'holy' },
    // cursed graveyard
    { type: 'temple', x: -110, z: 0, rot: 1.2, style: 'ruin', w: 11, d: 9 }, { type: 'obelisk', x: -96, z: 12, rot: 0.3, style: 'ruin', glow: 0x8aff6a },
    { type: 'fence', x: -94, z: -10, rot: 0.4, style: 'ruin', l: 12 }, { type: 'rubble', x: -124, z: 10, rot: 1.1, style: 'ruin' }, { type: 'statue', x: -102, z: -14, rot: 1.0, style: 'ruin' },
    // cult sanctum
    { type: 'altar', x: 110, z: -90, rot: 0.4, style: 'ruin', glow: 0xd68aff }, { type: 'obelisk', x: 96, z: -78, rot: 0.6, style: 'ruin', glow: 0xd68aff },
    { type: 'obelisk', x: 124, z: -102, rot: 0.2, style: 'ruin', glow: 0xd68aff }, { type: 'ruinpillar', x: 100, z: -100, style: 'ruin' },
    // death knight barracks
    { type: 'tower', x: -128, z: -128, rot: 0.6, style: 'ruin' }, { type: 'wall', x: -110, z: -134, rot: 0.2, style: 'ruin', l: 16 }, { type: 'banner', x: -112, z: -112, style: 'ruin', c: 0x2a1a3a },
    { type: 'tent', x: -104, z: -120, rot: 1.6, style: 'ruin', c: 0x1a1a2a },
    // throne of shadows (raid)
    { type: 'gate', x: 0, z: -160, rot: 0, style: 'ruin' }, { type: 'tower', x: -14, z: -160, style: 'ruin' }, { type: 'tower', x: 14, z: -160, style: 'ruin' },
    { type: 'statue', x: -10, z: -146, rot: 0, style: 'ruin', s: 1.4 }, { type: 'statue', x: 10, z: -146, rot: 0, style: 'ruin', s: 1.4 },
    { type: 'obelisk', x: -18, z: -140, style: 'ruin', glow: 0xd68aff }, { type: 'obelisk', x: 18, z: -140, style: 'ruin', glow: 0xd68aff },
    { type: 'portal', x: 0, z: -166, rot: 0, style: 'ruin', c: 0xd68aff },
    { type: 'bridge', x: -61, z: -110, rot: Math.PI / 2, style: 'ruin', l: 14, by: 0.4 },
    // portals
    { type: 'portal', x: 0, z: 172, rot: Math.PI, style: 'fort', c: 0xff6a2a },
    // waystones
    { type: 'waystone', x: 16, z: 126, style: 'holy' }, { type: 'waystone', x: 92, z: 40, style: 'holy' }, { type: 'waystone', x: -80, z: -16, style: 'ruin' },
    { type: 'waystone', x: 80, z: -66, style: 'ruin' }, { type: 'waystone', x: -96, z: -100, style: 'ruin' }, { type: 'waystone', x: 14, z: -128, style: 'ruin' },
  ],
  scatter: [
    { type: 'shadowtree', d: 0.0022, mask: { s: 0.01, min: -0.25 }, s: [0.9, 1.6] },
    { type: 'dead', d: 0.0012, s: [0.8, 1.4], tint: [0x3a3440, 0x2a2430] },
    { type: 'bigshroom', d: 0.0004, mask: { s: 0.015, min: 0.35 }, s: [0.7, 1.3] },
    { type: 'crystal', d: 0.0006, s: [0.6, 1.3] },
    { type: 'rock', d: 0.0008, s: [0.6, 1.4] },
    { type: 'boulder', d: 0.0003, s: [0.8, 1.3] },
    { type: 'spire', d: 0.00025, s: [0.8, 1.5] },
    { type: 'bones', d: 0.0007, s: [0.8, 1.3] },
    { type: 'grave', d: 0.0003, s: [0.8, 1.2] },
    { type: 'grave', d: 0.012, area: { x: -110, z: 0, r: 26 }, s: [0.8, 1.2] },
    { type: 'grave', d: 0.004, area: { x: -120, z: -120, r: 22 }, s: [0.8, 1.1] },
    { type: 'ruinpillar', d: 0.0001, s: [0.8, 1.3] },
    { type: 'grass', d: 0.005, s: [0.7, 1.2], small: true, tint: [0x4a4458, 0x3a3a4a] },
    { type: 'fern', d: 0.0015, s: [0.7, 1.2], small: true, tint: [0x4a3a5a, 0x3a3048] },
    { type: 'reeds', d: 0.003, shore: true, s: [0.8, 1.2], small: true },
    { type: 'flowers', d: 0.0006, s: [0.7, 1.0], small: true },
  ],
  clear: [{ x: 110, z: 60, r: 18 }, { x: -110, z: 0, r: 20 }, { x: 110, z: -90, r: 18 }, { x: -120, z: -122, r: 18 }, { x: 0, z: -150, r: 26 }, { x: 0, z: 168, r: 14 }],
  spawns: [
    { m: 'ghoul', x: 40, z: 50, r: 26, n: 9, lvl: [50, 52] },
    { m: 'ghoul', x: -50, z: 130, r: 22, n: 6, lvl: [50, 51] },
    { m: ['wraith', 'ghoul'], x: -110, z: 0, r: 22, n: 9, lvl: [51, 53], camp: true },
    { m: 'wraith', x: -50, z: 55, r: 24, n: 7, lvl: [52, 54] },
    { m: ['malakar_cultist', 'malakar_cultist', 'void_eye'], x: 110, z: -90, r: 20, n: 9, lvl: [53, 55], camp: true },
    { m: 'shadow_fiend', x: 40, z: -30, r: 26, n: 8, lvl: [54, 56] },
    { m: 'void_eye', x: 60, z: -110, r: 24, n: 7, lvl: [55, 57] },
    { m: ['death_knight', 'death_knight', 'ghoul'], x: -120, z: -120, r: 20, n: 9, lvl: [56, 58], camp: true },
    { m: ['death_knight', 'shadow_fiend', 'wraith'], x: -50, z: -90, r: 24, n: 8, lvl: [57, 59] },
    { m: ['shadow_fiend', 'void_eye'], x: 130, z: 120, r: 24, n: 7, lvl: [55, 57] },
    { m: 'bone_dragon', x: -150, z: -40, r: 8, n: 1, lvl: 57, respawn: 360 },
  ],
  critters: [{ m: 'rabbit', n: 4 }],
  worldBoss: { m: 'void_colossus', x: 60, z: -80, lvl: 60, every: 900, name: 'Boşluk Devi|The Void Colossus' },
  waystones: [
    { id: 'w_last', name: 'Son Işık|Lastlight', x: 16, z: 126 }, { id: 'w_vigil', name: 'Avcı Nöbeti|Hunters\' Vigil', x: 92, z: 40 }, { id: 'w_grave', name: 'Lanetli Mezarlık|Cursed Graveyard', x: -80, z: -16 },
    { id: 'w_sanctum', name: 'Tarikat Mabedi|Cult Sanctum', x: 80, z: -66 }, { id: 'w_barracks', name: 'Ölüm Kışlası|Deathguard Barracks', x: -96, z: -100 }, { id: 'w_throne', name: 'Gölge Tahtı|Throne of Shadows', x: 14, z: -128 },
  ],
  portals: [{ to: 'ember', x: 0, z: 172, r: 3.5, lvl: 1, label: 'Kor Diyarı|The Emberlands', oz: -8 }],
  dungeons: [{ id: 'r_throne', x: 0, z: -163, r: 4.5 }],
  nodes: [{ type: 'herb6', n: 14 }, { type: 'ore6', n: 16 }, { type: 'wood6', n: 12 }],
  fishing: [{ x: -90, z: 90, r: 26, fish: ['fish6', 'fish5', 'fish5'] }, { x: 120, z: -20, r: 14, fish: ['fish5', 'fish6'] }],
  pois: [
    { id: 's_last', name: 'Son Işık|Lastlight', x: 0, z: 95, r: 30, town: true },
    { id: 's_vigil', name: 'Avcı Nöbeti|Hunters\' Vigil', x: 110, z: 60, r: 18 },
    { id: 's_lake', name: 'Ağıt Gölü|Lake of Laments', x: -90, z: 90, r: 34 },
    { id: 's_grave', name: 'Lanetli Mezarlık|Cursed Graveyard', x: -110, z: 0, r: 22 },
    { id: 's_sanctum', name: 'Tarikat Mabedi|Cult Sanctum', x: 110, z: -90, r: 20 },
    { id: 's_scar', name: 'Boşluk Yarası|The Void Scar', x: 60, z: -80, r: 26 },
    { id: 's_barracks', name: 'Ölüm Kışlası|Deathguard Barracks', x: -120, z: -120, r: 20 },
    { id: 's_throne', name: 'Gölge Tahtı|Throne of Shadows', x: 0, z: -152, r: 22, dungeon: true },
  ],
  start: { x: 0, z: 160 },
};

// ---------------------------------------------------------------- NPCs
Object.assign(NPCS, {
  seraphine: { zone: 'shadow', at: 'lastlight.center', name: 'Işık Şövalyesi Seraphine|Light-Knight Seraphine', title: 'Son Işık Tarikatı|Order of the Last Light', roles: ['quest'], model: npc({ race: 'elf', skin: SKIN_ELF[0], hair: 1, hc: 0xf0e0b0, body: 1, c: 0xe8e4f0, c2: 0xe8c860, head: { m: 'circlet', c2: 0xe8c860, gem: 0xffe8a0 }, gear: { shoulders: { m: 'plate', c: 0xe8e4f0 }, main: { m: 'greatsword', c: 0xf0f0ff, glow: 0xffe8a0 }, cape: { c: 0xf0ece0 } } }), greet: 'Karanlık ne kadar derin olursa olsun, tek bir ışık yeter.|However deep the darkness, a single light is enough.' },
  riven: { zone: 'shadow', at: [106, 58], rot: -1.4, name: 'Gölge Avcısı Riven|Riven the Shadowhunter', title: 'Avcı Nöbeti|Hunters\' Vigil', roles: ['quest'], model: npc({ s: 2, hair: 2, hc: HAIR[7], cm: 'leather', c: 0x2a2a3a, c2: 0xe8c860, head: { m: 'hood', c: 0x1a1a2a }, gear: { main: { m: 'bow', c: 0xd8d8e8 }, cape: { c: 0x1a1a2a } } }), greet: 'Gölgeleri avlamak için gölge olmalısın.|To hunt shadows, you must become one.' },
  ssmith: { zone: 'shadow', at: 'lastlight.smithy', name: 'Usta Dorin|Master Dorin', title: 'Kutsal Örs|The Hallowed Anvil', roles: ['shop', 'enhance', 'train', 'quest'], shop: 'smith', prof: ['smithing', 'mining', 'jewelcrafting'], model: npc({ race: 'dwarf', s: 1, hair: 0, beard: 3, hc: HAIR[6], cm: 'leather', c: 0x4a3a2a, gear: { main: { m: 'hammer', c: 0xf0f0ff, glow: 0xffe8a0 } } }), greet: 'Kutsanmış çelik gölgeleri keser.|Blessed steel cuts through shadow.' },
  sinn: { zone: 'shadow', at: 'lastlight.inn', name: 'Hancı Mira|Mira the Innkeeper', title: 'Son Mum Hanı|The Last Candle', roles: ['shop', 'inn', 'quest', 'train'], shop: 'inn', prof: ['cooking', 'alchemy', 'herbalism'], model: npc({ s: 1, hair: 4, hc: HAIR[2], body: 1, cm: 'cloth', c: 0x6a4a3a, c2: 0xf0e8d8 }), greet: 'Burada mumlar hiç sönmez. Söndüremezler.|The candles never go out here. They can\'t.' },
  smerchant: { zone: 'shadow', at: 'lastlight.stall0', name: 'Tüccar Ezra|Ezra the Trader', title: 'Sınır Pazarı|Frontier Market', roles: ['shop', 'bank', 'market', 'guild', 'train'], shop: 'general', prof: ['tailoring'], model: npc({ s: 3, hair: 5, beard: 2, cm: 'cloth', c: 0x3a2a5a, c2: 0xe8c860, head: { m: 'hat', c: 0x2a1a3a } }), greet: 'Dünyanın sonunda bile ticaret sürer!|Even at the end of the world, trade goes on!' },
  lumen: { zone: 'shadow', at: 'lastlight.temple', name: 'Yüce Rahip Lumen|High Priest Lumen', title: 'Işık Tapınağı|Temple of Light', roles: ['quest', 'dungeon', 'arena', 'stable'], model: npc({ s: 0, hair: 5, beard: 3, hc: HAIR[6], cm: 'robe', c: 0xf0ece0, c2: 0xe8c860, head: { m: 'crown', c2: 0xe8c860, gem: 0xffe8a0 }, gear: { main: { m: 'staff', glow: 0xffe8a0, c2: 0xe8c860 } } }), greet: 'Işık seninle, Kristal Taşıyıcı. Son savaşa hazır mısın?|The Light is with you, Crystal Bearer. Are you ready for the final battle?' },
});

// ---------------------------------------------------------------- quests
const Q = (id, o) => { QUESTS[id] = { id, zone: 'shadow', ...o }; };
// main story, chapter VI — finale
Q('q_s_ghouls', { main: true, lvl: 50, giver: 'seraphine', prev: 'q_e_onward', name: 'Ölülerin Açlığı|Hunger of the Dead',
  text: 'Gulyabaniler sığınağın kapılarını her gece zorluyor. Kuzeydeki 10 Gulyabani\'yi yok et.|Ghouls batter the sanctuary gates every night. Destroy 10 Ghouls to the north.',
  progress: 'Kapılar hâlâ zorlanıyor.|The gates are still under siege.', done: 'Kehanetin kahramanı gerçekten de güçlü. Şimdi gerçek düşmanı konuşalım.|The hero of the prophecy truly is strong. Now let us speak of the real enemy.',
  obj: [{ t: 'kill', m: ['ghoul'], n: 10 }], rew: { xp: 1, gold: 28, choice: [{ slot: 'chest', rarity: 'rare' }, { slot: 'legs', rarity: 'rare' }] } });
Q('q_s_wraiths', { main: true, lvl: 52, giver: 'seraphine', prev: 'q_s_ghouls', name: 'Tutsak Ruhlar|Captive Souls',
  text: 'Malakar, ölülerin ruhlarını hayaletlere dönüştürüp kendine bağlıyor. Lanetli Mezarlık\'taki 8 Hayalet\'i özgür bırak ve 5 Hayalet Özü topla.|Malakar turns the souls of the dead into wraiths and binds them to himself. Free 8 Wraiths at the Cursed Graveyard and gather 5 Ectoplasm.',
  progress: 'Ruhlar hâlâ tutsak.|The souls are still captive.', done: 'Bu özlerle Malakar\'ın büyüsünü çözebiliriz. Riven\'e git; tarikatın planını biliyor.|With this ectoplasm we can unravel Malakar\'s spell. Go to Riven; he knows the cult\'s plan.',
  obj: [{ t: 'kill', m: ['wraith'], n: 8 }, { t: 'collect', item: 'q_ecto', n: 5, from: ['wraith'], chance: 0.55 }], rew: { xp: 1.1, gold: 30, choice: [{ slot: 'head', rarity: 'rare' }, { slot: 'hands', rarity: 'rare' }] } });
Q('q_s_riven', { main: true, lvl: 53, giver: 'seraphine', prev: 'q_s_wraiths', name: 'Gölge Avcısı|The Shadowhunter',
  text: 'Gölge Avcısı Riven doğudaki Avcı Nöbeti\'nde. Tarikatı yıllardır izliyor.|Riven the Shadowhunter is at the Hunters\' Vigil to the east. He has watched the cult for years.',
  done: 'Seraphine seni gönderdi demek. İyi. Tarikat bir ritüel hazırlıyor ve zamanımız az.|So Seraphine sent you. Good. The cult is preparing a ritual, and we\'re short on time.',
  obj: [{ t: 'talk', npc: 'riven' }], turnin: 'riven', rew: { xp: 0.4, gold: 12 } });
Q('q_s_ritual', { main: true, lvl: 54, giver: 'riven', prev: 'q_s_riven', name: 'Karanlık Ritüel|The Dark Ritual',
  text: 'Tarikat Mabedi\'ndeki müritler, Malakar\'a beş parçanın gücünü çekecek bir ritüel yapıyor. 8 Malakar Müridi\'ni durdur ve ritüel sunağını boz.|The disciples at the Cult Sanctum perform a ritual to draw the power of the five shards to Malakar. Stop 8 Disciples of Malakar and disrupt the ritual altar.',
  progress: 'Ritüel sürüyor!|The ritual continues!', done: 'Ritüel bozuldu! Malakar öfkeden kuduruyor olmalı.|The ritual is broken! Malakar must be mad with rage.',
  obj: [{ t: 'kill', m: ['malakar_cultist'], n: 8 }, { t: 'interact', obj: 'qo_ritual', n: 1 }], rew: { xp: 1.2, gold: 34, choice: [{ slot: 'main', rarity: 'rare' }, { slot: 'neck', rarity: 'rare' }] } });
Q('q_s_void', { main: true, lvl: 55, giver: 'riven', prev: 'q_s_ritual', name: 'Boşluğun Gözleri|Eyes of the Void',
  text: 'Malakar\'ın gözcüleri ve iblisleri her adımımızı izliyor. 8 Gölge İblisi ve 6 Boşluk Gözü yok et.|Malakar\'s watchers and fiends follow our every step. Destroy 8 Shadowfiends and 6 Void Watchers.',
  progress: 'Hâlâ izleniyoruz.|We are still being watched.', done: 'Artık kör. Seraphine son hazırlıkları yapıyor.|Now he is blind. Seraphine is making the final preparations.',
  obj: [{ t: 'kill', m: ['shadow_fiend'], n: 8 }, { t: 'kill', m: ['void_eye'], n: 6 }], rew: { xp: 1.3, gold: 36, choice: [{ slot: 'feet', rarity: 'rare' }, { slot: 'shoulders', rarity: 'rare' }] } });
Q('q_s_knights', { main: true, lvl: 57, giver: 'seraphine', prev: 'q_s_void', name: 'Düşmüş Şövalyeler|The Fallen Knights',
  text: 'Ölüm Şövalyeleri bir zamanlar bizim kardeşlerimizdi. Ölüm Kışlası\'nda 8 tanesini huzura kavuştur. Bu acı ama gerekli.|The Death Knights were once our brothers and sisters. Put 8 of them to rest at the Deathguard Barracks. It is bitter, but necessary.',
  progress: 'Kardeşlerimiz hâlâ lanetli.|Our kin are still cursed.', done: 'Ruhları Işığa döndü. Teşekkür ederim... onlar adına.|Their souls have returned to the Light. Thank you... on their behalf.',
  obj: [{ t: 'kill', m: ['death_knight'], n: 8 }], rew: { xp: 1.3, gold: 40, choice: [{ slot: 'main', rarity: 'epic' }, { slot: 'off', rarity: 'rare' }, { slot: 'ring', rarity: 'rare' }] } });
Q('q_s_ready', { main: true, lvl: 58, giver: 'seraphine', prev: 'q_s_knights', name: 'Son Hazırlık|The Final Preparation',
  text: 'Gölge Tahtı\'na girmeden önce gücünün zirvesine ulaşmalısın. 60. seviyeye ulaş ve Yüce Rahip Lumen ile konuş.|Before entering the Throne of Shadows you must reach the height of your power. Reach level 60 and speak with High Priest Lumen.',
  progress: 'Henüz hazır değilsin.|You are not ready yet.', done: 'Işık seninle. Tahta giden yol açık; yoldaşların hazır.|The Light is with you. The way to the throne is open; your companions are ready.',
  obj: [{ t: 'level', n: 60 }, { t: 'talk', npc: 'lumen' }], turnin: 'lumen', rew: { xp: 0.5, gold: 40, items: [{ id: 'enhance_stone', qty: 8 }, { id: 'elixir_power', qty: 3 }] } });
Q('q_s_throne', { main: true, lvl: 60, giver: 'lumen', prev: 'q_s_ready', name: 'Gölge Tahtı|The Throne of Shadows',
  text: 'Malakar son parçayı tahtında tutuyor. Gölge Tahtı baskınına gir: Kemikkanat Ossyrion\'u, Lich Vorath\'ı ve sonunda Gölge Lordu Malakar\'ı yen. Aether Kristali\'ni tamamla!|Malakar holds the final shard upon his throne. Enter the Throne of Shadows raid: defeat Ossyrion the Bonewing, Vorath the Lich King and finally Malakar the Shadow Lord. Make the Aether Crystal whole!',
  progress: 'Malakar hâlâ hüküm sürüyor.|Malakar still reigns.', done: 'Altıncı parça... Aether Kristali yeniden bütün! Gökyüzüne bak — güneş Gölge Diyarı\'nda ilk kez doğuyor!|The sixth shard... The Aether Crystal is whole again! Look at the sky — the sun rises over the Shadowlands for the first time!',
  obj: [{ t: 'boss', m: 'malakar' }], turnin: 'seraphine', rew: { xp: 2, gold: 300, choice: [{ slot: 'main', rarity: 'epic' }, { slot: 'chest', rarity: 'epic' }, { slot: 'trinket', rarity: 'epic' }], items: [{ id: 'enhance_stone', qty: 15 }, { id: 'chest_boss', qty: 2 }] } });
Q('q_s_epilogue', { main: true, lvl: 60, giver: 'seraphine', prev: 'q_s_throne', name: 'Eve Dönüş|Homecoming',
  text: 'Aether Kristali bütün ve diyarlar kurtuldu. Yolculuğunun başladığı yere, Aydınköy\'e dön. Muhtar Yusuf hikâyeni duymak isteyecek.|The Aether Crystal is whole and the realms are saved. Return to where your journey began, Dawnhollow. Elder Yusuf will want to hear your tale.',
  progress: 'Aydınköy seni bekliyor.|Dawnhollow awaits you.', done: 'Kristal Taşıyıcı... hayır, Diyarların Kahramanı! Geri döndün! Köyün tamamı seninle gurur duyuyor. Ama macera bitmez — zindanların kahraman zorlukları, Sonsuz Kule ve arena seni bekliyor.|Crystal Bearer... no, Hero of the Realms! You\'ve returned! The whole village is proud of you. But adventure never ends — heroic dungeons, the Endless Tower and the arena await you.',
  obj: [{ t: 'talk', npc: 'elder' }], turnin: 'elder', rew: { xp: 0.5, gold: 200, items: [{ id: 'chest_boss', qty: 1 }] } });
// side quests
Q('q_s_lake', { lvl: 51, giver: 'sinn', name: 'Ağıt Gölünün Balıkları|Fish of the Lake of Laments', text: 'Ağıt Gölü\'nde parlayan balıklar yaşar; han için 6 tane tut.|Glowing fish live in the Lake of Laments; catch 6 for the inn.', progress: 'Kazan bekliyor.|The pot is waiting.', done: 'Işıldayan balık çorbası! Sığınağın moralini yükseltir.|Glowing fish soup! It\'ll raise the sanctuary\'s spirits.', obj: [{ t: 'fish', n: 6 }], accept: { unlock: 'fishing' }, rew: { xp: 0.9, gold: 24, items: [{ id: 'food4', qty: 8 }] } });
Q('q_s_herbs', { lvl: 52, giver: 'lumen', name: 'Gölge Lotusu|Shadow Lotus', text: 'Kutsal su için 8 Gölge Lotusu topla.|Gather 8 Shadow Lotus for holy water.', progress: 'Lotuslar?|The lotuses?', done: 'Işık bu çiçekleri arındıracak.|The Light will purify these blossoms.', obj: [{ t: 'gather', node: 'herb6', n: 8 }], accept: { unlock: 'herbalism' }, rew: { xp: 0.9, gold: 24, items: [{ id: 'hp4', qty: 6 }, { id: 'mp4', qty: 6 }] } });
Q('q_s_ore', { lvl: 54, giver: 'ssmith', name: 'Yıldız Demiri|Star Iron', text: 'Boşluk Yarası\'nın çevresinden 10 Yıldız Demiri kaz.|Mine 10 Star Iron around the Void Scar.', progress: 'Cevher?|Ore?', done: 'Bununla gölgeyi kesen kılıçlar dövülür.|Blades that cut shadow are forged from this.', obj: [{ t: 'gather', node: 'ore6', n: 10 }], accept: { unlock: 'mining' }, rew: { xp: 0.9, gold: 26, items: [{ id: 'enhance_stone', qty: 6 }] } });
Q('q_s_explore', { lvl: 52, giver: 'riven', name: 'Karanlığın Haritası|Map of the Dark', text: 'Bölgeyi keşfet: Ağıt Gölü, Lanetli Mezarlık, Boşluk Yarası ve Ölüm Kışlası.|Scout the region: the Lake of Laments, the Cursed Graveyard, the Void Scar and the Deathguard Barracks.', progress: 'Harita eksik.|The map is incomplete.', done: 'Artık düşmanın topraklarını avucumuzun içi gibi biliyoruz.|Now we know the enemy\'s lands like the back of our hand.', obj: [{ t: 'explore', poi: 's_lake' }, { t: 'explore', poi: 's_grave' }, { t: 'explore', poi: 's_scar' }, { t: 'explore', poi: 's_barracks' }], rew: { xp: 1, gold: 26 } });
Q('q_s_drake', { lvl: 57, giver: 'riven', name: 'Kemik Ejderi|The Bone Drake', text: 'Batı tepelerinde bir kemik ejderi uçuyor. Onu yere indir.|A bone drake circles the western hills. Bring it down.', progress: 'Ejder hâlâ uçuyor.|The drake still flies.', done: 'Efsanevi bir av! Bu ganimeti hak ettin.|A legendary hunt! You\'ve earned this prize.', obj: [{ t: 'kill', m: ['bone_dragon'], n: 1 }], rew: { xp: 1.5, gold: 60, choice: [{ slot: 'cape', rarity: 'epic' }, { slot: 'trinket', rarity: 'rare' }] } });
Q('q_s_patrol', { lvl: 56, giver: 'smerchant', name: 'Sınır Devriyesi|Frontier Patrol', text: 'Güneydoğu tepelerindeki iblisler erzak yolunu tehdit ediyor. 8 Gölge İblisi veya Boşluk Gözü yen.|Fiends in the south-eastern hills threaten the supply road. Defeat 8 Shadowfiends or Void Watchers.', progress: 'Yol hâlâ tehlikede.|The road is still in danger.', done: 'Erzak akmaya devam edecek.|The supplies will keep flowing.', obj: [{ t: 'kill', m: ['shadow_fiend', 'void_eye'], n: 8 }], rew: { xp: 1.2, gold: 36, choice: [{ slot: 'head', rarity: 'rare' }, { slot: 'ring', rarity: 'rare' }] } });
Q('q_s_colossus', { lvl: 60, giver: 'lumen', repeat: 'daily', name: 'Boşluk Devi (Dünya Patronu)|The Void Colossus (World Boss)', text: 'Boşluk Devi belirli aralıklarla Boşluk Yarası\'ndan çıkıyor. Diğer maceracılarla onu durdur.|The Void Colossus periodically emerges from the Void Scar. Stop it with other adventurers.', progress: 'Devin çıkmasını bekle.|Wait for the Colossus to emerge.', done: 'Boşluk bir kez daha kapandı.|The void is sealed once more.', obj: [{ t: 'kill', m: ['void_colossus'], n: 1 }], rew: { xp: 1, gold: 150, items: [{ id: 'chest_boss', qty: 1 }] } });
Q('q_s_raid_weekly', { lvl: 60, giver: 'lumen', repeat: 'weekly', prev: 'q_s_throne', name: 'Haftalık: Gölge Tahtı|Weekly: Throne of Shadows', text: 'Malakar\'ın yankıları tahtta yeniden şekilleniyor. Bu hafta Gölge Tahtı baskınını yeniden temizle.|Malakar\'s echoes reform upon the throne. Clear the Throne of Shadows raid again this week.', progress: 'Taht hâlâ karanlık.|The throne is still dark.', done: 'Yankılar dağıldı... gelecek haftaya kadar.|The echoes are scattered... until next week.', obj: [{ t: 'dungeon', id: 'r_throne' }], rew: { xp: 1, gold: 250, items: [{ id: 'chest_boss', qty: 2 }, { id: 'enhance_stone', qty: 10 }] } });
Q('q_s_heroic_daily', { lvl: 60, giver: 'lumen', repeat: 'daily', prev: 'q_s_epilogue', name: 'Günlük: Kahraman Zindan|Daily: Heroic Dungeon', text: 'Diyarlarda karanlığın kalıntıları hâlâ var. Herhangi bir zindanı kahraman zorlukta temizle.|Remnants of darkness linger across the realms. Clear any dungeon on heroic difficulty.', progress: 'Kalıntılar hâlâ orada.|The remnants still linger.', done: 'Işık her gün biraz daha güçleniyor.|The Light grows a little stronger every day.', obj: [{ t: 'dungeon', id: 'heroic' }], rew: { xp: 1, gold: 120, items: [{ id: 'chest_daily', qty: 1 }, { id: 'token_honor', qty: 10 }] } });

Object.assign(QUEST_OBJECTS, {
  qo_ritual: { zone: 'shadow', x: 106, z: -86, model: 'sparkle', label: 'Ritüel Sunağı|Ritual Altar', quest: 'q_s_ritual', glow: 0xd68aff },
});

ITEMS.q_ecto = { name: 'Hayalet Özü|Ectoplasm', icon: 'ghost', fill: ['#c8f0ff', '#4a3a8a'], type: 'quest', stack: 20, value: 0 };

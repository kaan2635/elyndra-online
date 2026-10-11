// ZONE 5 — Kor Diyarı / The Emberlands (levels 40-50). Registers zone, NPCs, quests and quest objects.
import { ZONES } from './zones.js';
import { NPCS } from './npcs.js';
import { QUESTS, QUEST_OBJECTS } from './quests.js';
import { SKIN, SKIN_ORC, HAIR } from '../gfx/models.js';
import { ITEMS } from './items.js';

const H = o => ({ rig: 'humanoid', ...o });
const npc = (o = {}) => H({ race: o.race || 'human', skin: o.skin ?? SKIN[o.s ?? 1], hair: o.hair ?? 2, beard: o.beard ?? 0, hairColor: o.hc ?? HAIR[1], body: o.body || 0, gear: { chest: { m: o.cm || 'plate', c: o.c ?? 0x4a3a38, c2: o.c2 ?? 0xd86a2a }, legs: { c: o.lc ?? 0x2a2220 }, ...(o.head ? { head: o.head } : {}), ...(o.gear || {}) } });

ZONES.ember = {
  id: 'ember', name: 'Kor Diyarı|The Emberlands', level: [40, 50], music: 'volcano', ambient: 'lava', weather: ['clear', 'ash', 'ash', 'clear'],
  desc: 'Lav nehirleri, kül yağmuru ve zincirlerinden kurtulmuş iblislerle dolu volkanik bir cehennem.|A volcanic hell of lava rivers, falling ash and demons freed from their chains.',
  env: {
    sky: [0x3a1a1a, 0xc86a3a, 0x3a2420], fog: 0x8a4a34, sun: 0xffb080, sunI: 1.9, hemiSky: 0xffa070, hemiGround: 0x4a2018, hemiI: 1.05, dusk: 0xff5a2a, fogFar: 140,
    night: { skyTop: 0x120606, skyHor: 0x4a1a10, fog: 0x2a100a, sun: 0xc06040, hemiSky: 0x8a3a2a, hemiGround: 0x1a0806 },
  },
  terrain: {
    size: 400, res: 160, seed: 71, base: 5.5, amp: 10, scale: 0.009, detailAmp: 2.0, detailScale: 0.05, ridgeAmp: 6, ridgeScale: 0.014, borderH: 42, water: -0.5, lava: true, surface: 'stone',
    palette: { ground: [0x3a3230, 0x4a3e38, 0x2e2826], patch: 0x6a3a28, rock: 0x241e1c, sand: 0x5a4a40, shore: 0x8a3a1a, road: 0x6a5a4a, plaza: 0x5a504a, under: 0x3a1a0a },
    roads: [
      { pts: [[0, 168], [8, 130], [0, 95], [-10, 40], [0, -10], [20, -60], [0, -110], [0, -168]], w: 4.5 },
      { pts: [[-10, 40], [-60, 50], [-110, 40]], w: 3.5 },
      { pts: [[0, -10], [60, -20], [110, -30]], w: 3.5 },
      { pts: [[20, -60], [-40, -90], [-100, -110]], w: 3.5 },
    ],
    rivers: [
      { pts: [[-200, -40], [-150, -30], [-100, 0], [-60, 10], [-20, 5], [40, 20], [90, 50], [150, 60], [200, 80]], w: 9, depth: 2 },
      { pts: [[60, -200], [70, -150], [60, -110], [80, -70], [90, -40]], w: 7, depth: 1.8 },
    ],
    features: [
      { t: 'lake', x: 120, z: 120, r: 26, depth: 2.5 },
      { t: 'lake', x: -130, z: -150, r: 22, depth: 2 },
      { t: 'crater', x: -110, z: -110, r: 34, depth: 2, rim: 6 },
      { t: 'hill', x: 140, z: -120, r: 45, h: 18 },
      { t: 'hill', x: -150, z: 110, r: 40, h: 14 },
      { t: 'hill', x: 150, z: 10, r: 30, h: 10 },
      { t: 'flat', x: -9, z: 36, r: 12, h: 2.5, edge: 10 },
      { t: 'flat', x: 0, z: 95, r: 30, h: 4, edge: 12, plaza: 9 },
      { t: 'flat', x: -110, z: 40, r: 18, h: 4, edge: 10 },
      { t: 'flat', x: 110, z: -30, r: 18, h: 5, edge: 10 },
      { t: 'flat', x: -110, z: -110, r: 16, h: 3, edge: 6 },
      { t: 'flat', x: 0, z: -168, r: 12, h: 4, edge: 8 },
      { t: 'flat', x: 0, z: 168, r: 12, h: 4, edge: 8 },
    ],
  },
  propColors: { leaf: 0x3a2a24, trunk: 0x2a1e1a, rock: 0x3a3230, moss: 0x5a2a1a, grass: 0x5a4a38, flowers: [0xff6a2a, 0xffb040], crystal: 0xff6a1a, glow: 0xff7a1a },
  towns: [{ id: 'ashguard', name: 'Kül Kalesi|Ashguard', x: 0, z: 95, r: 30, h: 4, style: 'fort', seed: 23, gates: [Math.PI, 0, -Math.PI / 2], wall: 'wall', center: 'statue', special: { smithy: 'smithy', inn: 'inn', temple: 'temple', stable: 'stable' } }],
  structures: [
    // scout outpost
    { type: 'tower', x: -118, z: 34, rot: 0.6, style: 'fort' }, { type: 'tent', x: -102, z: 46, rot: 1.8, style: 'fort', c: 0x5a2a20 }, { type: 'campfire', x: -110, z: 44, style: 'fort' },
    { type: 'palisade', x: -110, z: 28, rot: 0, style: 'fort', l: 16 }, { type: 'banner', x: -98, z: 36, style: 'fort', c: 0xd86a2a },
    // demon rift
    { type: 'altar', x: 110, z: -30, rot: 0.3, style: 'fort', glow: 0xff3a1a }, { type: 'obelisk', x: 96, z: -20, rot: 0.6, style: 'fort', glow: 0xff3a1a },
    { type: 'obelisk', x: 124, z: -42, rot: 1.2, style: 'fort', glow: 0xff3a1a }, { type: 'rubble', x: 100, z: -42, rot: 0.4, style: 'fort' },
    // obsidian forge (ruined dwarf outpost)
    { type: 'anvil', x: 40, z: -110, rot: 0.2, style: 'dwarven' }, { type: 'house', x: 30, z: -122, rot: 0.4, style: 'fort', w: 6, d: 5 }, { type: 'rubble', x: 50, z: -124, rot: 2.2, style: 'fort' },
    // molten citadel
    { type: 'wall', x: -100, z: -96, rot: 0.8, style: 'fort', l: 18 }, { type: 'tower', x: -92, z: -104, style: 'fort' }, { type: 'tower', x: -118, z: -88, style: 'fort' },
    { type: 'gate', x: -108, z: -104, rot: 0.8, style: 'fort' }, { type: 'cave', x: -118, z: -118, rot: 0.8, style: 'fort', rock: 0x2a201c },
    // obsidian bridges over the lava
    { type: 'bridge', x: -4, z: 10, rot: -0.2, style: 'fort', l: 24, by: 0.6 },
    { type: 'bridge', x: 86, z: -25, rot: Math.PI / 2 + 0.2, style: 'fort', l: 16, by: 0.6 },
    // portals
    { type: 'portal', x: 0, z: 172, rot: Math.PI, style: 'dwarven', c: 0x8ad8ff },
    { type: 'portal', x: 0, z: -172, rot: 0, style: 'ruin', c: 0xb86aff },
    // waystones
    { type: 'waystone', x: 16, z: 128, style: 'fort' }, { type: 'waystone', x: -90, z: 30, style: 'fort' }, { type: 'waystone', x: 90, z: -10, style: 'fort' },
    { type: 'waystone', x: 30, z: -96, style: 'fort' }, { type: 'waystone', x: -80, z: -80, style: 'fort' }, { type: 'waystone', x: 10, z: -155, style: 'fort' },
  ],
  scatter: [
    { type: 'lavarock', d: 0.0018, s: [0.7, 1.6] },
    { type: 'dead', d: 0.0012, s: [0.8, 1.4], tint: [0x2a2220, 0x1a1412] },
    { type: 'spire', d: 0.0005, s: [0.8, 1.6] },
    { type: 'rock', d: 0.0012, s: [0.6, 1.5] },
    { type: 'boulder', d: 0.0004, s: [0.8, 1.4] },
    { type: 'crystal', d: 0.0004, s: [0.6, 1.2] },
    { type: 'bones', d: 0.0005, s: [0.8, 1.3] },
    { type: 'grass', d: 0.002, s: [0.6, 1.0], small: true, tint: [0x5a4a38, 0x6a4a2a] },
    { type: 'ruinpillar', d: 0.00006, s: [0.8, 1.2] },
  ],
  clear: [{ x: -110, z: 40, r: 18 }, { x: 110, z: -30, r: 20 }, { x: 40, z: -115, r: 16 }, { x: -108, z: -104, r: 22 }, { x: 0, z: 168, r: 14 }, { x: 0, z: -168, r: 14 }],
  spawns: [
    { m: 'imp', x: 40, z: 60, r: 26, n: 9, lvl: [40, 42] },
    { m: 'imp', x: -50, z: 110, r: 20, n: 5, lvl: [40, 41] },
    { m: 'salamander', x: 60, z: 72, r: 26, n: 8, lvl: [41, 43] },
    { m: 'magma_slime', x: -60, z: 0, r: 26, n: 8, lvl: [42, 44] },
    { m: 'hellhound', x: -140, z: 60, r: 26, n: 8, lvl: [43, 45] },
    { m: 'lava_golem', x: 40, z: -110, r: 22, n: 8, lvl: [44, 46], camp: true },
    { m: 'fire_elemental', x: 110, z: -30, r: 22, n: 8, lvl: [45, 47], camp: true },
    { m: ['demon', 'demon', 'imp'], x: -40, z: -60, r: 24, n: 9, lvl: [47, 49], camp: true },
    { m: ['demon_guard', 'hellhound'], x: -85, z: -70, r: 16, n: 6, lvl: [48, 50] },
    { m: ['salamander', 'magma_slime'], x: 84, z: 136, r: 26, n: 7, lvl: [44, 46] },
    { m: ['lava_golem', 'fire_elemental'], x: 140, z: -120, r: 26, n: 7, lvl: [46, 48] },
    { m: 'pyrelord', x: 150, z: 10, r: 8, n: 1, lvl: 46, respawn: 300 },
  ],
  critters: [{ m: 'scarab', n: 10 }],
  worldBoss: { m: 'magma_titan', x: 20, z: -40, lvl: 50, every: 840, name: 'Magma Devi|The Magma Colossus' },
  waystones: [
    { id: 'w_ash', name: 'Kül Kalesi|Ashguard', x: 16, z: 128 }, { id: 'w_outpost', name: 'Gözcü Karakolu|Scout Outpost', x: -90, z: 30 }, { id: 'w_rift', name: 'İblis Yarığı|Demon Rift', x: 90, z: -10 },
    { id: 'w_forge', name: 'Obsidyen Ocak|Obsidian Forge', x: 30, z: -96 }, { id: 'w_citadel', name: 'Erimiş Kale|The Molten Citadel', x: -80, z: -80 }, { id: 'w_enorth', name: 'Gölge Kapısı|Shadow Gate', x: 10, z: -155 },
  ],
  portals: [{ to: 'frost', x: 0, z: 172, r: 3.5, lvl: 1, label: 'Buzdoruk Dağları|Frostpeak Mountains', oz: -8 }, { to: 'shadow', x: 0, z: -172, r: 3.5, lvl: 50, label: 'Gölge Diyarı|The Shadowlands', oz: 8 }],
  dungeons: [{ id: 'd_molten', x: -115, z: -115, r: 4 }],
  nodes: [{ type: 'herb5', n: 12 }, { type: 'ore5', n: 18 }, { type: 'wood5', n: 10 }],
  fishing: [],
  pois: [
    { id: 'e_ash', name: 'Kül Kalesi|Ashguard', x: 0, z: 95, r: 32, town: true },
    { id: 'e_outpost', name: 'Gözcü Karakolu|Scout Outpost', x: -110, z: 40, r: 18 },
    { id: 'e_river', name: 'Ateş Irmağı|River of Fire', x: -20, z: 5, r: 24 },
    { id: 'e_rift', name: 'İblis Yarığı|Demon Rift', x: 110, z: -30, r: 22 },
    { id: 'e_forge', name: 'Obsidyen Ocak|Obsidian Forge', x: 40, z: -115, r: 20 },
    { id: 'e_lake', name: 'Kor Gölü|Cinder Lake', x: 120, z: 120, r: 28 },
    { id: 'e_horde', name: 'İblis Ordugâhı|Demon Warcamp', x: -40, z: -60, r: 24 },
    { id: 'e_citadel', name: 'Erimiş Kale|The Molten Citadel', x: -110, z: -110, r: 20, dungeon: true },
  ],
  start: { x: 0, z: 160 },
};

// ---------------------------------------------------------------- NPCs
Object.assign(NPCS, {
  aria: { zone: 'ember', at: 'ashguard.center', name: 'Komutan Aria|Commander Aria', title: 'Kül Muhafızları|The Ashguard', roles: ['quest'], model: npc({ s: 1, hair: 4, hc: HAIR[5], body: 1, c: 0x6a6a74, c2: 0xd86a2a, gear: { shoulders: { m: 'spiked', c: 0x5a5a64 }, main: { m: 'sword', c: 0xd8d8e0, glow: 0xff8a3a }, off: { m: 'shield', c: 0x8a2a1a }, cape: { c: 0x8a2a1a } } }), greet: 'Bu duvarlar düşerse tüm diyarlar yanar. Düşmeyecekler.|If these walls fall, every realm burns. They will not fall.' },
  kael: { zone: 'ember', at: [-106, 40], rot: 0.8, name: 'Gözcü Kael|Scout Kael', title: 'Gözcü Karakolu|Scout Outpost', roles: ['quest'], model: npc({ race: 'elf', skin: 0xd0a888, hair: 2, hc: HAIR[7], cm: 'leather', c: 0x3a2a24, c2: 0xd86a2a, head: { m: 'mask', c: 0x2a2220 }, gear: { main: { m: 'bow', c: 0x3a2a24 }, cape: { c: 0x3a2a24 } } }), greet: 'Alçak sesle konuş. İblislerin kulakları keskindir.|Speak softly. Demons have sharp ears.' },
  esmith: { zone: 'ember', at: 'ashguard.smithy', name: 'Demirci Volkan|Volkan the Smith', title: 'Lav Örsü|The Lava Anvil', roles: ['shop', 'enhance', 'train', 'quest'], shop: 'smith', prof: ['smithing', 'mining', 'jewelcrafting'], model: npc({ race: 'orc', skin: SKIN_ORC[1], hair: 3, hc: HAIR[0], cm: 'leather', c: 0x4a2a1a, c2: 0xd86a2a, gear: { main: { m: 'hammer', c: 0xc8c8d0, glow: 0xff7a1a } } }), greet: 'Obsidyen mi? Getir, sana efsane döverim.|Obsidian? Bring it, I\'ll forge you a legend.' },
  einn: { zone: 'ember', at: 'ashguard.inn', name: 'Aşçı Bora|Bora the Cook', title: 'Son Kıvılcım Kantini|The Last Spark Canteen', roles: ['shop', 'inn', 'quest', 'train'], shop: 'inn', prof: ['cooking', 'alchemy', 'herbalism'], model: npc({ s: 2, hair: 0, beard: 2, hc: HAIR[0], cm: 'cloth', c: 0xe8dcc0, c2: 0x8a2a1a }), greet: 'Acı biber yahnisi! Bu diyarda bile insanı ısıtır.|Chilli stew! Warms you up even in this place.' },
  emerchant: { zone: 'ember', at: 'ashguard.stall0', name: 'Levazımcı Selin|Quartermaster Selin', title: 'Ordu Levazımı|Army Supplies', roles: ['shop', 'bank', 'market', 'guild', 'train'], shop: 'general', prof: ['tailoring'], model: npc({ s: 0, hair: 1, hc: HAIR[3], body: 1, cm: 'mail', c: 0x5a5a64, c2: 0xd86a2a }), greet: 'İksir, sargı, erzak... Ne lazımsa.|Potions, bandages, rations... Whatever you need.' },
  ignis: { zone: 'ember', at: 'ashguard.temple', name: 'Alev Rahibi Ignatius|Flamepriest Ignatius', title: 'Arınma Alevi|The Purifying Flame', roles: ['quest', 'dungeon', 'arena', 'stable'], model: npc({ s: 3, hair: 5, beard: 1, hc: HAIR[6], cm: 'robe', c: 0x8a1a1a, c2: 0xffb040, head: { m: 'hood', c: 0x6a1a1a }, gear: { main: { m: 'staff', glow: 0xffb040, c2: 0x3a2a1a } } }), greet: 'Ateş yok eder, ama aynı zamanda arındırır.|Fire destroys, but it also purifies.' },
});

// ---------------------------------------------------------------- quests
const Q = (id, o) => { QUESTS[id] = { id, zone: 'ember', ...o }; };
// main story, chapter V
Q('q_e_imps', { main: true, lvl: 40, giver: 'aria', prev: 'q_fr_onward', name: 'Duvardaki İfritler|Imps on the Walls',
  text: 'Her gece ifrit sürüleri surlarımızı tırmanıyor. Kalenin kuzeyindeki 10 Ateş İfriti\'ni temizle, sonra konuşuruz.|Every night swarms of imps climb our walls. Clear 10 Fire Imps north of the fortress, then we\'ll talk.',
  progress: 'İfritler hâlâ duvarlarda.|The imps are still on the walls.', done: 'İyi savaştın. Muhafızlar sana güvenebileceğimi söylüyor.|You fought well. The guards say I can trust you.',
  obj: [{ t: 'kill', m: ['imp'], n: 10 }], rew: { xp: 1, gold: 22, choice: [{ slot: 'chest', rarity: 'uncommon' }, { slot: 'legs', rarity: 'uncommon' }] } });
Q('q_e_scout', { main: true, lvl: 41, giver: 'aria', prev: 'q_e_imps', name: 'Gözcünün Raporu|The Scout\'s Report',
  text: 'Gözcü Kael parçanın nereye düştüğünü biliyor olabilir. Batıdaki Gözcü Karakolu\'nda onu bul.|Scout Kael may know where the shard fell. Find him at the Scout Outpost to the west.',
  done: 'Parça mı? Erimiş Kale\'ye götürüldü. Infernus onu zincirlerini kırmak için kullandı.|The shard? It was taken to the Molten Citadel. Infernus used it to break his chains.',
  obj: [{ t: 'talk', npc: 'kael' }], turnin: 'kael', rew: { xp: 0.4, gold: 10 } });
Q('q_e_hounds', { main: true, lvl: 43, giver: 'kael', prev: 'q_e_scout', name: 'Cehennem Tazıları|Hounds of Hell',
  text: 'Cehennem köpekleri gözcülerimin kokusunu alıyor. Batı tepelerindeki 8 Cehennem Köpeği\'ni yok et.|The hellhounds catch my scouts\' scent. Destroy 8 Hellhounds in the western hills.',
  progress: 'Köpekler hâlâ iz sürüyor.|The hounds still track us.', done: 'Artık kalenin etrafında gözlerimizi açabiliriz.|Now we can open our eyes around the citadel.',
  obj: [{ t: 'kill', m: ['hellhound'], n: 8 }], rew: { xp: 1.1, gold: 24, choice: [{ slot: 'main', rarity: 'uncommon' }, { slot: 'head', rarity: 'rare' }] } });
Q('q_e_golems', { main: true, lvl: 44, giver: 'kael', prev: 'q_e_hounds', name: 'Obsidyen Kalpler|Obsidian Hearts',
  text: 'Kalenin kapısı yalnızca lav golemlerinin kalpleriyle eritilebilir. Obsidyen Ocak\'taki 6 Lav Golemi\'ni kır ve 5 Erimiş Çekirdek topla.|The citadel\'s gate can only be melted with the hearts of lava golems. Break 6 Lava Golems at the Obsidian Forge and gather 5 Molten Cores.',
  progress: 'Çekirdekler?|The cores?', done: 'Bunlarla kapıyı eritebiliriz. Ama önce yarığı kapatmalıyız...|We can melt the gate with these. But first we must close the rift...',
  obj: [{ t: 'kill', m: ['lava_golem'], n: 6 }, { t: 'collect', item: 'q_core', n: 5, from: ['lava_golem'], chance: 0.6 }], rew: { xp: 1.2, gold: 26, choice: [{ slot: 'feet', rarity: 'rare' }, { slot: 'shoulders', rarity: 'rare' }] } });
Q('q_e_rift', { main: true, lvl: 46, giver: 'aria', prev: 'q_e_golems', name: 'İblis Yarığı|The Demon Rift',
  text: 'Doğudaki yarıktan durmadan ateş elementalleri çıkıyor. 8 Ateş Elementali\'ni söndür ve yarığın üç mühür taşını mühürle.|Fire elementals pour endlessly from the rift in the east. Quench 8 Fire Elementals and seal the rift\'s three seal stones.',
  progress: 'Yarık hâlâ açık.|The rift is still open.', done: 'Yarık kapandı! Şimdi sıra ordugâhta.|The rift is closed! Now for the warcamp.',
  obj: [{ t: 'kill', m: ['fire_elemental'], n: 8 }, { t: 'interact', obj: 'qo_rift1', n: 1 }, { t: 'interact', obj: 'qo_rift2', n: 1 }, { t: 'interact', obj: 'qo_rift3', n: 1 }], rew: { xp: 1.3, gold: 28, choice: [{ slot: 'hands', rarity: 'rare' }, { slot: 'neck', rarity: 'rare' }] } });
Q('q_e_demons', { main: true, lvl: 47, giver: 'aria', prev: 'q_e_rift', name: 'İblis Ordugâhı|The Demon Warcamp',
  text: 'Infernus\'un ordusu kalenin önünde toplanıyor. İblis Ordugâhı\'na saldır ve 8 Kor İblisi\'ni yok et.|Infernus\'s army gathers before the citadel. Assault the Demon Warcamp and destroy 8 Ember Demons.',
  progress: 'Ordu hâlâ toplanıyor.|The army still gathers.', done: 'Ordusu dağıldı. Rahip Ignatius sana yoldaş bulacak; Infernus\'u bitirme zamanı.|His army is broken. Priest Ignatius will find you companions; it\'s time to finish Infernus.',
  obj: [{ t: 'kill', m: ['demon'], n: 8 }], rew: { xp: 1.3, gold: 30, choice: [{ slot: 'main', rarity: 'rare' }, { slot: 'off', rarity: 'rare' }] } });
Q('q_e_infernus', { main: true, lvl: 48, giver: 'ignis', prev: 'q_e_demons', name: 'Zincirsiz Infernus|Infernus the Unbound',
  text: 'Infernus beşinci parçayı göğsüne gömdü ve Erimiş Kale\'nin kalbinde bekliyor. İçeri gir ve onu sonsuza dek söndür!|Infernus buried the fifth shard in his chest and waits in the heart of the Molten Citadel. Go in and extinguish him forever!',
  progress: 'İblis hâlâ yanıyor.|The demon still burns.', done: 'Beşinci parça! Gökyüzündeki kül dağılıyor. Komutan Aria seni kahraman olarak karşılayacak.|The fifth shard! The ash in the sky is clearing. Commander Aria will greet you as a hero.',
  obj: [{ t: 'boss', m: 'infernus' }], turnin: 'aria', rew: { xp: 1.9, gold: 100, choice: [{ slot: 'main', rarity: 'epic' }, { slot: 'chest', rarity: 'rare' }, { slot: 'trinket', rarity: 'rare' }], items: [{ id: 'enhance_stone', qty: 8 }] } });
Q('q_e_onward', { main: true, lvl: 50, giver: 'aria', prev: 'q_e_infernus', name: 'Gölgelerin Eşiği|Threshold of Shadows',
  text: 'Son parça Gölge Diyarı\'nda, Malakar\'ın tahtında. Gölge Kapısı\'ndaki portaldan geç; Son Işık sığınağında Işık Şövalyesi Seraphine seni bekliyor.|The final shard lies in the Shadowlands, at Malakar\'s throne. Pass through the portal at the Shadow Gate; Light-Knight Seraphine awaits you at the Lastlight sanctuary.',
  progress: 'Seraphine seni bekliyor.|Seraphine awaits.', done: 'Beş parça... Kehanet doğruymuş. Hoş geldin, Kristal Taşıyıcı.|Five shards... The prophecy was true. Welcome, Crystal Bearer.',
  obj: [{ t: 'talk', npc: 'seraphine' }], turnin: 'seraphine', rew: { xp: 0.5, gold: 24 } });
// side quests
Q('q_e_salamanders', { lvl: 41, giver: 'einn', name: 'Semender Kebabı|Salamander Skewers', text: 'Askerlerin karnı aç. 8 Semender avla; eti şaşırtıcı derecede lezzetlidir.|The soldiers are hungry. Hunt 8 Salamanders; the meat is surprisingly tasty.', progress: 'Kazan boş!|The pot is empty!', done: 'Biraz acı, ama doyurucu!|A bit spicy, but filling!', obj: [{ t: 'kill', m: ['salamander'], n: 8 }], rew: { xp: 0.9, gold: 20, items: [{ id: 'food4', qty: 6 }] } });
Q('q_e_slimes', { lvl: 42, giver: 'emerchant', name: 'Yapışkan Durum|A Sticky Situation', text: 'Magma balçıkları erzak kervanlarının tekerleklerini eritiyor. 8 Magma Balçığı\'nı temizle.|Magma oozes are melting the wheels of supply wagons. Clear 8 Magma Oozes.', progress: 'Kervanlar bekliyor.|The wagons are waiting.', done: 'Erzak yolu yeniden açık.|The supply road is open again.', obj: [{ t: 'kill', m: ['magma_slime'], n: 8 }], rew: { xp: 1, gold: 22, choice: [{ slot: 'hands', rarity: 'uncommon' }, { slot: 'feet', rarity: 'uncommon' }] } });
Q('q_e_ore', { lvl: 44, giver: 'esmith', name: 'Kor Cevheri|Emberite', text: 'Volkanik kayalardan 10 Kor Cevheri kaz. Sana gerçek bir silahın nasıl dövüleceğini göstereyim.|Mine 10 Emberite from volcanic rock. I\'ll show you how a real weapon is forged.', progress: 'Cevher?|Ore?', done: 'Hâlâ sıcak! Al, bunlar hak edilmiş.|Still warm! Take these, they\'re earned.', obj: [{ t: 'gather', node: 'ore5', n: 10 }], accept: { unlock: 'mining' }, rew: { xp: 0.9, gold: 18, items: [{ id: 'enhance_stone', qty: 5 }] } });
Q('q_e_herbs', { lvl: 42, giver: 'ignis', name: 'Ateş Çiçeği|Firebloom', text: 'Arınma ayini için külün içinde açan 8 Ateş Çiçeği topla.|Gather 8 Firebloom that flowers in the ash, for the purification rite.', progress: 'Çiçekler?|The flowers?', done: 'Alev seni korusun.|May the flame protect you.', obj: [{ t: 'gather', node: 'herb5', n: 8 }], accept: { unlock: 'herbalism' }, rew: { xp: 0.8, gold: 16, items: [{ id: 'elixir_power', qty: 2 }, { id: 'hp4', qty: 4 }] } });
Q('q_e_explore', { lvl: 42, giver: 'kael', name: 'Ateşli Topraklar|Lands of Fire', text: 'Bölgeyi keşfet: Ateş Irmağı, Obsidyen Ocak, Kor Gölü ve İblis Yarığı.|Scout the region: the River of Fire, the Obsidian Forge, Cinder Lake and the Demon Rift.', progress: 'Rapor eksik.|The report is incomplete.', done: 'Aria bu raporu çok sevecek.|Aria will love this report.', obj: [{ t: 'explore', poi: 'e_river' }, { t: 'explore', poi: 'e_forge' }, { t: 'explore', poi: 'e_lake' }, { t: 'explore', poi: 'e_rift' }], rew: { xp: 1, gold: 20 } });
Q('q_e_pyrelord', { lvl: 46, giver: 'kael', name: 'Alevlord Vexar|Pyrelord Vexar', text: 'Infernus\'un generali Vexar doğu tepelerinde devriye geziyor. Onu düşür.|Infernus\'s general Vexar patrols the eastern hills. Bring him down.', progress: 'Vexar hâlâ yaşıyor.|Vexar still lives.', done: 'General düştü! Ordu başsız kaldı.|The general has fallen! The army is headless.', obj: [{ t: 'kill', m: ['pyrelord'], n: 1 }], rew: { xp: 1.5, gold: 44, choice: [{ slot: 'cape', rarity: 'rare' }, { slot: 'ring', rarity: 'rare' }] } });
Q('q_e_lake', { lvl: 45, giver: 'emerchant', name: 'Kor Gölü Devriyesi|Cinder Lake Patrol', text: 'Kor Gölü kıyısındaki yaratıklar madencilerimize saldırıyor. 8 Semender veya Magma Balçığı yen.|Creatures on the shore of Cinder Lake attack our miners. Defeat 8 Salamanders or Magma Oozes.', progress: 'Madenciler bekliyor.|The miners are waiting.', done: 'Madenler yeniden çalışıyor.|The mines are working again.', obj: [{ t: 'kill', m: ['salamander', 'magma_slime'], n: 8 }], rew: { xp: 1.1, gold: 26, choice: [{ slot: 'head', rarity: 'rare' }, { slot: 'legs', rarity: 'rare' }] } });
Q('q_e_guards', { lvl: 49, giver: 'ignis', name: 'Kalenin Bekçileri|Wardens of the Citadel', text: 'Kale kapısını iblis muhafızlar ve cehennem köpekleri koruyor. 8 İblis Muhafız veya Cehennem Köpeği yen.|Demon guards and hellhounds watch the citadel gate. Defeat 8 Demon Guards or Hellhounds.', progress: 'Kapı hâlâ korunuyor.|The gate is still guarded.', done: 'Yol açık. Arınma yakın.|The way is open. Purification is near.', obj: [{ t: 'kill', m: ['demon_guard', 'hellhound'], n: 8 }], rew: { xp: 1.2, gold: 30, choice: [{ slot: 'main', rarity: 'rare' }, { slot: 'neck', rarity: 'rare' }] } });
Q('q_e_titan', { lvl: 50, giver: 'ignis', repeat: 'daily', name: 'Magma Devi (Dünya Patronu)|The Magma Colossus (World Boss)', text: 'Magma Devi belirli aralıklarla lav nehrinden yükseliyor. Diğer maceracılarla onu durdur.|The Magma Colossus periodically rises from the lava river. Stop it with other adventurers.', progress: 'Devin yükselmesini bekle.|Wait for the Colossus to rise.', done: 'Lav yeniden sakinleşti.|The lava has calmed again.', obj: [{ t: 'kill', m: ['magma_titan'], n: 1 }], rew: { xp: 1, gold: 100, items: [{ id: 'chest_boss', qty: 1 }] } });

Object.assign(QUEST_OBJECTS, {
  qo_rift1: { zone: 'ember', x: 96, z: -24, model: 'sparkle', label: 'Mühür Taşı|Seal Stone', quest: 'q_e_rift', glow: 0xff5a1a },
  qo_rift2: { zone: 'ember', x: 122, z: -38, model: 'sparkle', label: 'Mühür Taşı|Seal Stone', quest: 'q_e_rift', glow: 0xff5a1a },
  qo_rift3: { zone: 'ember', x: 110, z: -16, model: 'sparkle', label: 'Mühür Taşı|Seal Stone', quest: 'q_e_rift', glow: 0xff5a1a },
});

ITEMS.q_core = { name: 'Erimiş Çekirdek|Molten Core', icon: 'orb', fill: ['#ffb040', '#8a1a0a'], type: 'quest', stack: 20, value: 0 };

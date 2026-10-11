// ZONE 4 — Buzdoruk Dağları / Frostpeak Mountains (levels 30-40). Registers zone, NPCs, quests and quest objects.
import { ZONES } from './zones.js';
import { NPCS } from './npcs.js';
import { QUESTS, QUEST_OBJECTS } from './quests.js';
import { SKIN, HAIR } from '../gfx/models.js';
import { ITEMS } from './items.js';

const H = o => ({ rig: 'humanoid', ...o });
const dwarf = (o = {}) => H({ race: o.race || 'dwarf', skin: SKIN[o.s ?? 1], hair: o.hair ?? 0, beard: o.beard ?? 3, hairColor: o.hc ?? HAIR[5], body: o.body || 0, gear: { chest: { m: o.cm || 'mail', c: o.c ?? 0x5a6a8a, c2: o.c2 ?? 0xd8a03a }, legs: { c: o.lc ?? 0x3a3a4a }, ...(o.head !== undefined ? (o.head ? { head: o.head } : {}) : { head: { m: 'helm', c: 0x8a8a98 } }), ...(o.gear || {}) } });

ZONES.frost = {
  id: 'frost', name: 'Buzdoruk Dağları|Frostpeak Mountains', level: [30, 40], music: 'snow', ambient: 'snow', weather: ['clear', 'snow', 'snow', 'snow', 'mist'],
  desc: 'Uçsuz bucaksız kar tarlaları, buzullar ve inatçı cücelerin taş kaleleri.|Endless snowfields, glaciers and the stone holds of stubborn dwarves.',
  env: {
    sky: [0x4a7ab8, 0xd8e8f4, 0x8a9ab0], fog: 0xd0dcea, sun: 0xf0f4ff, sunI: 2.1, hemiSky: 0xd8e8ff, hemiGround: 0x6a7a90, hemiI: 1.25, dusk: 0xff9ab0, fogFar: 160,
    night: { skyTop: 0x060c22, skyHor: 0x1a2a4a, fog: 0x141c30, sun: 0x8aa0e0, hemiSky: 0x4a6aa0, hemiGround: 0x1a2030 },
  },
  terrain: {
    size: 400, res: 160, seed: 53, base: 5.5, amp: 11, scale: 0.008, detailAmp: 1.8, detailScale: 0.045, ridgeAmp: 8, ridgeScale: 0.012, borderH: 46, water: -0.6, surface: 'snow', snowLine: 2,
    palette: { ground: [0xe8eef4, 0xd8e2ec, 0xf4f8fc], patch: 0xb8c8d8, rock: 0x6a707a, sand: 0xa8a8a0, shore: 0x8a9098, road: 0xb8b0a4, plaza: 0x9a98a0, under: 0x3a5a6a, snow: 0xf6f9fc, waterMap: 0x4a9ac8 },
    roads: [
      { pts: [[0, 168], [-5, 130], [0, 90], [10, 40], [0, -10], [-10, -60], [0, -110], [0, -168]], w: 4.5 },
      { pts: [[10, 40], [60, 30], [110, 20]], w: 3.5 },
      { pts: [[0, -10], [-60, -20], [-100, -40]], w: 3.5 },
      { pts: [[0, -110], [60, -100], [110, -100]], w: 3.5 },
    ],
    features: [
      { t: 'lake', x: 125, z: 45, r: 16, depth: 2 },
      { t: 'hill', x: -110, z: -120, r: 55, h: 26 },
      { t: 'hill', x: -140, z: 80, r: 40, h: 14 },
      { t: 'hill', x: 140, z: -40, r: 35, h: 12 },
      { t: 'hill', x: 70, z: 140, r: 30, h: 10 },
      { t: 'crater', x: 110, z: -100, r: 30, depth: 3, rim: 3 },
      { t: 'flat', x: 0, z: 90, r: 30, h: 4, edge: 12, plaza: 9 },
      { t: 'flat', x: 110, z: 20, r: 16, h: 3, edge: 10 },
      { t: 'flat', x: 60, z: -30, r: 18, h: 5, edge: 10 },
      { t: 'flat', x: -40, z: -70, r: 20, h: 6, edge: 10 },
      { t: 'flat', x: 140, z: -140, r: 14, h: 4, edge: 8 },
      { t: 'flat', x: 0, z: -168, r: 12, h: 4, edge: 8 },
      { t: 'flat', x: 0, z: 168, r: 12, h: 4, edge: 8 },
    ],
  },
  propColors: { leaf: 0x2a5a4a, trunk: 0x4a3a30, rock: 0x7a808a, moss: 0x8a9aa8, grass: 0xa8b0a0, flowers: [0x8ad8ff, 0xffffff], snow: true, crystal: 0x9ae0ff, glow: 0x6ad8ff },
  towns: [{ id: 'ironhold', name: 'Demirkale|Ironhold', x: 0, z: 90, r: 30, h: 4, style: 'dwarven', seed: 17, gates: [Math.PI, 0, Math.PI / 2], wall: 'wall', center: 'statue', special: { smithy: 'smithy', inn: 'inn', temple: 'temple', stable: 'stable' } }],
  structures: [
    // hunters' camp with hot spring
    { type: 'igloo', x: 102, z: 12, style: 'dwarven' }, { type: 'igloo', x: 116, z: 8, style: 'dwarven' }, { type: 'tent', x: 104, z: 28, rot: -1.6, style: 'dwarven', c: 0x6a4a3a },
    { type: 'campfire', x: 110, z: 20, style: 'dwarven' }, { type: 'banner', x: 96, z: 20, style: 'dwarven', c: 0x2a4a8a }, { type: 'crates', x: 120, z: 24, rot: 0.6, style: 'dwarven' },
    // troll caves
    { type: 'cave', x: 72, z: -40, rot: -2.2, style: 'dwarven', rock: 0x6a707a }, { type: 'campfire', x: 60, z: -30, style: 'fort' },
    // giant's hold
    { type: 'tower', x: -50, z: -78, rot: 0.4, style: 'dwarven' }, { type: 'rubble', x: -30, z: -62, rot: 1.0, style: 'dwarven' }, { type: 'statue', x: -40, z: -70, rot: 0.6, style: 'dwarven', s: 1.6 },
    { type: 'wall', x: -26, z: -80, rot: 1.3, style: 'dwarven', l: 14 },
    // glacier and frozen depths
    { type: 'obelisk', x: 96, z: -86, rot: 0.3, style: 'dwarven', glow: 0x6ad8ff }, { type: 'obelisk', x: 126, z: -112, rot: 0.9, style: 'dwarven', glow: 0x6ad8ff },
    { type: 'gate', x: 138, z: -132, rot: -0.8, style: 'dwarven' }, { type: 'cave', x: 144, z: -146, rot: -0.8, style: 'dwarven', rock: 0x8a98a8 },
    // peak shrine
    { type: 'altar', x: -110, z: -120, rot: 0.6, style: 'dwarven', glow: 0x8ad8ff }, { type: 'banner', x: -104, z: -114, style: 'dwarven', c: 0x2a4a8a },
    // portals
    { type: 'portal', x: 0, z: 172, rot: Math.PI, style: 'desert', c: 0xffc86a },
    { type: 'portal', x: 0, z: -172, rot: 0, style: 'fort', c: 0xff6a2a },
    // waystones
    { type: 'waystone', x: 16, z: 124, style: 'dwarven' }, { type: 'waystone', x: 92, z: 34, style: 'dwarven' }, { type: 'waystone', x: -70, z: -30, style: 'dwarven' },
    { type: 'waystone', x: 84, z: -104, style: 'dwarven' }, { type: 'waystone', x: -88, z: -98, style: 'dwarven' }, { type: 'waystone', x: 10, z: -155, style: 'dwarven' },
  ],
  scatter: [
    { type: 'pine', d: 0.0025, mask: { s: 0.01, min: -0.2 }, s: [0.9, 1.7] },
    { type: 'pine', d: 0.0006, s: [0.8, 1.3] },
    { type: 'dead', d: 0.0004, s: [0.8, 1.3], tint: [0x6a6a70, 0x5a5a60] },
    { type: 'icespike', d: 0.0007, s: [0.7, 1.5] },
    { type: 'icespike', d: 0.003, area: { x: 110, z: -100, r: 45 }, s: [0.8, 1.8] },
    { type: 'crystal', d: 0.0008, area: { x: 110, z: -100, r: 40 }, s: [0.8, 1.4] },
    { type: 'snowpile', d: 0.0025, s: [0.7, 1.4], small: true },
    { type: 'rock', d: 0.0008, s: [0.6, 1.4] },
    { type: 'boulder', d: 0.0004, s: [0.8, 1.5] },
    { type: 'spire', d: 0.0002, s: [0.8, 1.3] },
    { type: 'bush', d: 0.0005, s: [0.6, 1.0] },
    { type: 'grass', d: 0.003, s: [0.6, 1.0], small: true },
    { type: 'log', d: 0.0002, s: [0.8, 1.1] },
    { type: 'bones', d: 0.0002 },
  ],
  clear: [{ x: 110, z: 20, r: 18 }, { x: 60, z: -30, r: 16 }, { x: -40, z: -70, r: 20 }, { x: 140, z: -140, r: 14 }, { x: -110, z: -120, r: 10 }, { x: 0, z: 168, r: 14 }, { x: 0, z: -168, r: 14 }],
  spawns: [
    { m: 'frost_wolf', x: 40, z: 50, r: 28, n: 9, lvl: [30, 32] },
    { m: 'frost_wolf', x: -60, z: 120, r: 24, n: 6, lvl: [30, 32] },
    { m: 'frost_bat', x: -40, z: 10, r: 26, n: 8, lvl: [31, 33] },
    { m: 'mammoth', x: -90, z: 30, r: 30, n: 6, lvl: [32, 34] },
    { m: ['ice_troll', 'ice_troll', 'frost_wolf'], x: 60, z: -30, r: 20, n: 9, lvl: [33, 35], camp: true },
    { m: 'yeti', x: -110, z: -110, r: 28, n: 8, lvl: [34, 36] },
    { m: 'ice_elemental', x: 100, z: -90, r: 26, n: 8, lvl: [35, 37] },
    { m: ['frost_giant', 'frost_giant', 'frost_dwarf'], x: -40, z: -70, r: 22, n: 9, lvl: [36, 38], camp: true },
    { m: ['frost_bat', 'ice_elemental', 'frost_dwarf'], x: 130, z: -125, r: 18, n: 7, lvl: [37, 39] },
    { m: ['yeti', 'ice_troll'], x: 140, z: 110, r: 26, n: 7, lvl: [35, 37] },
    { m: 'frostfang_alpha', x: -140, z: 70, r: 8, n: 1, lvl: 35, respawn: 300 },
  ],
  critters: [{ m: 'penguin', n: 10 }, { m: 'rabbit', n: 8 }, { m: 'fox', n: 5 }, { m: 'deer', n: 4 }],
  worldBoss: { m: 'snow_titan', x: 0, z: -50, lvl: 40, every: 780, name: 'Kar Titanı|The Snow Titan' },
  waystones: [
    { id: 'w_iron', name: 'Demirkale|Ironhold', x: 16, z: 124 }, { id: 'w_hunt', name: 'Avcı Kampı|Hunters\' Camp', x: 92, z: 34 }, { id: 'w_plains', name: 'Mamut Ovası|Mammoth Plains', x: -70, z: -30 },
    { id: 'w_glacier', name: 'Kristal Buzul|Crystal Glacier', x: 84, z: -104 }, { id: 'w_peak', name: 'Buzdoruk Zirvesi|Frostpeak Summit', x: -88, z: -98 }, { id: 'w_frnorth', name: 'Kor Geçidi|Ember Pass', x: 10, z: -155 },
  ],
  portals: [{ to: 'desert', x: 0, z: 172, r: 3.5, lvl: 1, label: 'Kavruk Çöl|Scorched Sands', oz: -8 }, { to: 'ember', x: 0, z: -172, r: 3.5, lvl: 40, label: 'Kor Diyarı|The Emberlands', oz: 8 }],
  dungeons: [{ id: 'd_frost', x: 141, z: -143, r: 4 }],
  nodes: [{ type: 'herb4', n: 12 }, { type: 'ore4', n: 18 }, { type: 'wood4', n: 12 }],
  fishing: [{ x: 125, z: 45, r: 12, fish: ['fish4', 'fish4', 'fish3'] }],
  pois: [
    { id: 'fr_town', name: 'Demirkale|Ironhold', x: 0, z: 90, r: 32, town: true },
    { id: 'fr_camp', name: 'Avcı Kampı|Hunters\' Camp', x: 110, z: 20, r: 20 },
    { id: 'fr_spring', name: 'Sıcak Kaynak|The Hot Spring', x: 125, z: 45, r: 16 },
    { id: 'fr_plains', name: 'Mamut Ovası|Mammoth Plains', x: -90, z: 30, r: 32 },
    { id: 'fr_trolls', name: 'Trol Mağaraları|Troll Caves', x: 60, z: -30, r: 20 },
    { id: 'fr_giants', name: 'Dev Kalesi|Giant\'s Hold', x: -40, z: -70, r: 22 },
    { id: 'fr_peak', name: 'Buzdoruk Zirvesi|Frostpeak Summit', x: -110, z: -120, r: 26 },
    { id: 'fr_glacier', name: 'Kristal Buzul|Crystal Glacier', x: 110, z: -100, r: 30 },
    { id: 'fr_depths', name: 'Buzul Derinlikleri|Frozen Depths', x: 140, z: -140, r: 14, dungeon: true },
  ],
  start: { x: 0, z: 160 },
};

// ---------------------------------------------------------------- NPCs
Object.assign(NPCS, {
  thorgrim: { zone: 'frost', at: 'ironhold.center', name: 'Kral Thorgrim|King Thorgrim', title: 'Demirkale Kralı|King of Ironhold', roles: ['quest'], model: dwarf({ s: 1, hair: 0, beard: 3, hc: HAIR[5], cm: 'plate', c: 0x6a7a9a, c2: 0xd8a03a, head: { m: 'crown', c2: 0xd8a03a, gem: 0x6ad8ff }, gear: { main: { m: 'hammer', c: 0xa8c8e8, glow: 0x6ad8ff }, cape: { c: 0x2a3a7a } } }), greet: 'Dağların kemiği taştır, cücelerinki de inat!|The mountains\' bones are stone; the dwarves\' are stubbornness!' },
  bjorn: { zone: 'frost', at: [106, 22], rot: -1.2, name: 'Avcı Bjorn|Bjorn the Hunter', title: 'Avcı Kampı|Hunters\' Camp', roles: ['quest'], model: dwarf({ race: 'human', s: 0, hair: 3, beard: 2, hc: HAIR[3], cm: 'leather', c: 0x6a4a3a, c2: 0xe8e0d0, head: { m: 'hood', c: 0xe8e4dc }, gear: { main: { m: 'bow', c: 0xe8dcc0 }, cape: { c: 0xe8e4dc } } }), greet: 'Kar her izi saklar ama iyi bir avcıdan değil.|Snow hides every track, but not from a good hunter.' },
  fsmith: { zone: 'frost', at: 'ironhold.smithy', name: 'Usta Brokk|Master Brokk', title: 'Kraliyet Örsü|The Royal Anvil', roles: ['shop', 'enhance', 'train', 'quest'], shop: 'smith', prof: ['smithing', 'mining', 'jewelcrafting'], model: dwarf({ s: 2, beard: 2, hc: HAIR[0], cm: 'leather', c: 0x5a3a2a, head: null, gear: { main: { m: 'hammer', c: 0xc8c8d0 } } }), greet: 'Cüce çeliği asla kırılmaz. Asla!|Dwarven steel never breaks. Never!' },
  finn: { zone: 'frost', at: 'ironhold.inn', name: 'Hancı Helga|Helga the Innkeeper', title: 'Köpüklü Fıçı|The Foaming Barrel', roles: ['shop', 'inn', 'quest', 'train'], shop: 'inn', prof: ['cooking', 'alchemy', 'herbalism'], model: dwarf({ s: 0, hair: 4, beard: 0, hc: HAIR[3], body: 1, cm: 'cloth', c: 0x8a3a2a, c2: 0xe8dcc0, head: null }), greet: 'Bir kupa sıcak bal şarabı! Kemiklerini ısıtır.|A mug of hot mead! It warms the bones.' },
  fmerchant: { zone: 'frost', at: 'ironhold.stall0', name: 'Tüccar Sven|Sven the Trader', title: 'Kuzey Ticaret Evi|Northern Trading House', roles: ['shop', 'bank', 'market', 'guild', 'train'], shop: 'general', prof: ['tailoring'], model: dwarf({ race: 'human', s: 0, hair: 2, beard: 1, hc: HAIR[4], cm: 'cloth', c: 0x2a4a7a, c2: 0xe8e0d0, head: { m: 'cap', c: 0x8a4a2a } }), greet: 'Kürk, kehribar, cüce işi mücevher... Ne arıyorsun?|Furs, amber, dwarven jewellery... What are you after?' },
  ingrid: { zone: 'frost', at: 'ironhold.temple', name: 'Rün Rahibesi Ingrid|Runepriestess Ingrid', title: 'Rün Tapınağı|Temple of Runes', roles: ['quest', 'dungeon', 'arena', 'stable'], model: dwarf({ s: 0, hair: 1, beard: 0, hc: 0xe8e0d0, body: 1, cm: 'robe', c: 0xd8e0f0, c2: 0x6ad8ff, head: { m: 'circlet', c2: 0x6ad8ff, gem: 0x6ad8ff }, gear: { main: { m: 'staff', glow: 0x6ad8ff, c2: 0xd8c8a0 } } }), greet: 'Rünler buzun altında uyuyan bir ejderden söz ediyor.|The runes speak of a wyrm sleeping beneath the ice.' },
});

// ---------------------------------------------------------------- quests
const Q = (id, o) => { QUESTS[id] = { id, zone: 'frost', ...o }; };
// main story, chapter IV
Q('q_fr_wolves', { main: true, lvl: 30, giver: 'thorgrim', prev: 'q_d_onward', name: 'Ayaz Dişleri|Frost Fangs',
  text: 'Parçayı konuşmadan önce bir iyilik: Ayaz kurtları ticaret yolumuzu kesti. 9 Ayaz Kurdu avla, yol açılsın.|Before we talk shards, a favour: frost wolves have cut our trade road. Hunt 9 Frost Wolves and clear the way.',
  progress: 'Kurtlar hâlâ uluyor.|The wolves still howl.', done: 'Hah! Bir cüce kadar sağlamsın. Şimdi dinle...|Hah! You\'re as sturdy as a dwarf. Now listen...',
  obj: [{ t: 'kill', m: ['frost_wolf'], n: 9 }], rew: { xp: 1, gold: 18, choice: [{ slot: 'chest', rarity: 'uncommon' }, { slot: 'legs', rarity: 'uncommon' }] } });
Q('q_fr_camp', { main: true, lvl: 31, giver: 'thorgrim', prev: 'q_fr_wolves', name: 'Avcının İzi|The Hunter\'s Trail',
  text: 'Parça buzula düştüğü gece avcı Bjorn gökyüzünde mavi bir kuyruklu yıldız görmüş. Doğudaki Avcı Kampı\'nda onu bul.|The night the shard fell, Bjorn the hunter saw a blue comet in the sky. Find him at the Hunters\' Camp to the east.',
  done: 'Mavi ışık mı? Evet, buzula doğru düştü... ve o geceden beri her şey değişti.|The blue light? Aye, it fell towards the glacier... and everything changed that night.',
  obj: [{ t: 'talk', npc: 'bjorn' }], turnin: 'bjorn', rew: { xp: 0.4, gold: 8 } });
Q('q_fr_trolls', { main: true, lvl: 33, giver: 'bjorn', prev: 'q_fr_camp', name: 'Trol Rünleri|Troll Runes',
  text: 'Buz trolleri parçanın düştüğü yerden rün taşları çalmış. 8 Buz Trolü\'nü yen ve 4 Buz Rünü geri getir.|The ice trolls stole rune stones from where the shard fell. Defeat 8 Ice Trolls and recover 4 Frost Runes.',
  progress: 'Rünler hâlâ trollerde.|The trolls still have the runes.', done: 'Bu rünler buzulun derinliklerini gösteriyor... ve bir ejderi.|These runes point to the depths of the glacier... and to a wyrm.',
  obj: [{ t: 'kill', m: ['ice_troll'], n: 8 }, { t: 'collect', item: 'q_rune', n: 4, from: ['ice_troll'], chance: 0.5 }], rew: { xp: 1.1, gold: 20, choice: [{ slot: 'main', rarity: 'uncommon' }, { slot: 'head', rarity: 'rare' }] } });
Q('q_fr_peak', { main: true, lvl: 35, giver: 'bjorn', prev: 'q_fr_trolls', name: 'Zirvenin Gözcüleri|Watchers of the Summit',
  text: 'Rünleri okumak için zirvedeki eski cüce sunağına çıkmalıyız. Yetiler yolu tutuyor. Buzdoruk Zirvesi\'ne tırman ve 6 Yeti\'yi yen.|To read the runes we must climb to the old dwarven altar on the summit. Yetis hold the path. Climb to Frostpeak Summit and defeat 6 Yetis.',
  progress: 'Zirve hâlâ uzak.|The summit is still far.', done: 'Sunaktan her şey görünüyor... Kristal Buzul\'da mavi bir ışık atıyor!|Everything is visible from the altar... a blue light pulses at the Crystal Glacier!',
  obj: [{ t: 'explore', poi: 'fr_peak' }, { t: 'kill', m: ['yeti'], n: 6 }], rew: { xp: 1.2, gold: 22, choice: [{ slot: 'feet', rarity: 'rare' }, { slot: 'shoulders', rarity: 'rare' }] } });
Q('q_fr_giants', { main: true, lvl: 36, giver: 'thorgrim', prev: 'q_fr_peak', name: 'Devlerin Öfkesi|Wrath of the Giants',
  text: 'Buz devleri parçanın çağrısıyla uyandı ve Dev Kalesi\'nden Demirkale\'ye saldırmaya hazırlanıyor. 8 Buz Devi\'ni durdur!|The frost giants woke to the shard\'s call and prepare to march from the Giant\'s Hold against Ironhold. Stop 8 Frost Giants!',
  progress: 'Devler hâlâ toplanıyor.|The giants are still gathering.', done: 'Demirkale ayakta! Halkım sana borçlu.|Ironhold stands! My people are in your debt.',
  obj: [{ t: 'kill', m: ['frost_giant'], n: 8 }], rew: { xp: 1.2, gold: 24, choice: [{ slot: 'main', rarity: 'rare' }, { slot: 'off', rarity: 'rare' }] } });
Q('q_fr_glacier', { main: true, lvl: 37, giver: 'thorgrim', prev: 'q_fr_giants', name: 'Buzulun Mührü|Seal of the Glacier',
  text: 'Buz elementalleri buzulun derinliklerine giden mührü koruyor. 8 Buz Elementali\'ni dağıt ve Kristal Buzul\'daki kadim mührü kır.|Ice elementals guard the seal leading into the glacier\'s depths. Scatter 8 Ice Elementals and break the ancient seal on the Crystal Glacier.',
  progress: 'Mühür hâlâ sağlam.|The seal still holds.', done: 'Mühür kırıldı. Rahibe Ingrid sana ejdere karşı yoldaşlar bulacak.|The seal is broken. Priestess Ingrid will find you companions against the wyrm.',
  obj: [{ t: 'kill', m: ['ice_elemental'], n: 8 }, { t: 'interact', obj: 'qo_frost_seal', n: 1 }], rew: { xp: 1.2, gold: 24, choice: [{ slot: 'hands', rarity: 'rare' }, { slot: 'neck', rarity: 'rare' }] } });
Q('q_fr_kryos', { main: true, lvl: 38, giver: 'ingrid', prev: 'q_fr_glacier', name: 'Buz Ejderi Kryos|Kryos the Frost Wyrm',
  text: 'Kryos dördüncü parçayı yuttu; gücüyle tüm dağları sonsuz bir kışa gömmek üzere. Buzul Derinlikleri\'ne in ve onu yok et.|Kryos swallowed the fourth shard; with its power it will bury the mountains in endless winter. Descend into the Frozen Depths and destroy it.',
  progress: 'Ejder hâlâ uyanık.|The wyrm still wakes.', done: 'Dördüncü parça! Kar yağışı hafifledi. Kral Thorgrim bir ziyafet hazırlatıyor!|The fourth shard! The snowfall eases. King Thorgrim is preparing a feast!',
  obj: [{ t: 'boss', m: 'frost_wyrm' }], turnin: 'thorgrim', rew: { xp: 1.8, gold: 80, choice: [{ slot: 'main', rarity: 'rare' }, { slot: 'chest', rarity: 'rare' }, { slot: 'ring', rarity: 'rare' }], items: [{ id: 'enhance_stone', qty: 6 }] } });
Q('q_fr_onward', { main: true, lvl: 40, giver: 'thorgrim', prev: 'q_fr_kryos', name: 'Ateş ve Kül|Fire and Ash',
  text: 'Beşinci parça güneydeki volkanik Kor Diyarı\'na düştü; iblisler oraya üşüşüyor. Kor Geçidi\'ndeki portaldan geç. Kül Kalesi\'nde Komutan Aria seni bekliyor.|The fifth shard fell into the volcanic Emberlands, where demons now swarm. Pass through the portal at Ember Pass. Commander Aria awaits you at Ashguard.',
  progress: 'Aria seni bekliyor.|Aria awaits.', done: 'Sonunda! Kristal Taşıyıcı geldi. Duvarlarımız her gece biraz daha çatlıyor.|At last! The Crystal Bearer has come. Our walls crack a little more every night.',
  obj: [{ t: 'talk', npc: 'aria' }], turnin: 'aria', rew: { xp: 0.5, gold: 20 } });
// side quests
Q('q_fr_bats', { lvl: 31, giver: 'finn', name: 'Mahzendeki Yarasalar|Bats in the Cellar', text: 'Ayaz yarasaları hanın fıçılarına dadandı! Batıdaki sürüden 8 tanesini avla.|Frost bats have taken to the inn\'s barrels! Hunt 8 from the swarm to the west.', progress: 'Fıçılarım tehlikede!|My barrels are in danger!', done: 'Bal şarabı kurtuldu! Şerefe!|The mead is saved! Cheers!', obj: [{ t: 'kill', m: ['frost_bat'], n: 8 }], rew: { xp: 0.9, gold: 16, items: [{ id: 'food4', qty: 6 }] } });
Q('q_fr_mammoth', { lvl: 33, giver: 'bjorn', name: 'Mamut Avı|Mammoth Hunt', text: 'Kış için et ve kürk lazım. Mamut Ovası\'nda 4 Mamut avla. Dikkat et, kızınca hücum ederler!|We need meat and furs for winter. Hunt 4 Mammoths on the plains. Careful, they charge when angered!', progress: 'Kamp aç.|The camp is hungry.', done: 'Bu kış kimse aç kalmayacak.|No one will go hungry this winter.', obj: [{ t: 'kill', m: ['mammoth'], n: 4 }], rew: { xp: 1, gold: 18, choice: [{ slot: 'cape', rarity: 'uncommon' }, { slot: 'shoulders', rarity: 'uncommon' }] } });
Q('q_fr_spring', { lvl: 32, giver: 'bjorn', name: 'Sıcak Kaynağın Balıkları|Fish of the Hot Spring', text: 'Sıcak kaynakta buz balıkları yaşar. 5 tane tut, akşam yemeği olsun.|Ice fish live in the hot spring. Catch 5 for supper.', progress: 'Akşam yemeği?|Supper?', done: 'Ateşte kızarmış buz balığı... Muhteşem!|Ice fish roasted over a fire... Magnificent!', obj: [{ t: 'fish', n: 5 }], accept: { unlock: 'fishing' }, rew: { xp: 0.8, gold: 12, items: [{ id: 'hp4', qty: 4 }] } });
Q('q_fr_ore', { lvl: 34, giver: 'fsmith', name: 'Mitril Damarı|Mithril Vein', text: 'Dağlardan 10 Mitril Cevheri kaz; sana cüce dövme sanatını göstereyim.|Mine 10 Mithril Ore from the mountains; I\'ll show you dwarven forging.', progress: 'Cevher?|Ore?', done: 'Saf mitril! Al, bunlar silahlarını keskinleştirir.|Pure mithril! Take these, they\'ll hone your weapons.', obj: [{ t: 'gather', node: 'ore4', n: 10 }], accept: { unlock: 'mining' }, rew: { xp: 0.9, gold: 14, items: [{ id: 'enhance_stone', qty: 4 }] } });
Q('q_fr_herbs', { lvl: 32, giver: 'finn', name: 'Kar Çiçeği|Snowbloom', text: 'Kar altında açan 8 Kar Çiçeği topla; çorbam için lazım.|Gather 8 Snowbloom that flowers beneath the snow; I need them for my stew.', progress: 'Çiçekler?|The flowers?', done: 'Çorba hazır! Biraz da sen al.|The stew is ready! Have some yourself.', obj: [{ t: 'gather', node: 'herb4', n: 8 }], accept: { unlock: 'herbalism' }, rew: { xp: 0.8, gold: 12, items: [{ id: 'hp4', qty: 4 }, { id: 'mp4', qty: 4 }] } });
Q('q_fr_explore', { lvl: 32, giver: 'thorgrim', name: 'Kralın Haritası|The King\'s Map', text: 'Krallığımı yeniden haritala: Avcı Kampı, Sıcak Kaynak, Mamut Ovası ve Kristal Buzul.|Re-chart my kingdom: the Hunters\' Camp, the Hot Spring, the Mammoth Plains and the Crystal Glacier.', progress: 'Harita eksik.|The map is incomplete.', done: 'Mükemmel. Bunu taht odasına asacağım.|Excellent. I\'ll hang this in the throne room.', obj: [{ t: 'explore', poi: 'fr_camp' }, { t: 'explore', poi: 'fr_spring' }, { t: 'explore', poi: 'fr_plains' }, { t: 'explore', poi: 'fr_glacier' }], rew: { xp: 1, gold: 16 } });
Q('q_fr_alpha', { lvl: 35, giver: 'bjorn', name: 'Buzdiş Alfa|The Frostfang Alpha', text: 'Ayaz kurtlarının lideri, dev bir beyaz kurt, batı tepelerinde dolaşıyor. Onu avla.|The leader of the frost wolves, a giant white wolf, roams the western hills. Hunt it.', progress: 'Alfa hâlâ uluyor.|The alpha still howls.', done: 'Sürü dağıldı. Bu postu sen hak ettin.|The pack is scattered. You\'ve earned this pelt.', obj: [{ t: 'kill', m: ['frostfang_alpha'], n: 1 }], rew: { xp: 1.4, gold: 36, choice: [{ slot: 'cape', rarity: 'rare' }, { slot: 'trinket', rarity: 'rare' }] } });
Q('q_fr_northeast', { lvl: 36, giver: 'ingrid', name: 'Kuzeydoğu Sınırı|The North-Eastern Frontier', text: 'Kuzeydoğu tepelerinde yetiler ve troller birleşti. 8 Yeti veya Buz Trolü yen.|Yetis and trolls have banded together in the north-eastern hills. Defeat 8 Yetis or Ice Trolls.', progress: 'Sınır hâlâ tehlikede.|The frontier is still in danger.', done: 'Rünler sana minnettar.|The runes are grateful.', obj: [{ t: 'kill', m: ['yeti', 'ice_troll'], n: 8 }], rew: { xp: 1.1, gold: 24, choice: [{ slot: 'ring', rarity: 'rare' }, { slot: 'head', rarity: 'rare' }] } });
Q('q_fr_dwarves', { lvl: 38, giver: 'ingrid', name: 'Kayıp Kardeşler|Lost Brethren', text: 'Buzulun derinliklerindeki cüceler ejderin büyüsüyle yozlaştı. 8 Ayaz Cücesi\'ni huzura kavuştur.|The dwarves in the depths of the glacier were corrupted by the wyrm\'s magic. Put 8 Frostbeard Dwarves to rest.', progress: 'Kardeşlerimiz hâlâ acı çekiyor.|Our brethren still suffer.', done: 'Ruhları ataların salonuna ulaştı.|Their spirits have reached the halls of the ancestors.', obj: [{ t: 'kill', m: ['frost_dwarf'], n: 8 }], rew: { xp: 1.2, gold: 26, choice: [{ slot: 'main', rarity: 'rare' }, { slot: 'neck', rarity: 'rare' }] } });
Q('q_fr_titan', { lvl: 40, giver: 'ingrid', repeat: 'daily', name: 'Kar Titanı (Dünya Patronu)|The Snow Titan (World Boss)', text: 'Kar Titanı belirli aralıklarla dağların kalbinde uyanıyor. Diğer maceracılarla onu durdur.|The Snow Titan periodically wakes in the heart of the mountains. Stop it with other adventurers.', progress: 'Titanın uyanmasını bekle.|Wait for the Titan to wake.', done: 'Dağlar bir kez daha sessiz.|The mountains are silent once more.', obj: [{ t: 'kill', m: ['snow_titan'], n: 1 }], rew: { xp: 1, gold: 80, items: [{ id: 'chest_boss', qty: 1 }] } });

Object.assign(QUEST_OBJECTS, {
  qo_frost_seal: { zone: 'frost', x: 112, z: -104, model: 'sparkle', label: 'Kadim Buz Mührü|Ancient Ice Seal', quest: 'q_fr_glacier', glow: 0x6ad8ff },
});

ITEMS.q_rune = { name: 'Buz Rünü|Frost Rune', icon: 'snowflake', fill: ['#bfe8ff', '#2a5a8a'], type: 'quest', stack: 20, value: 0 };

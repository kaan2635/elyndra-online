// Races, classes and the global power curve.
import { SKIN, SKIN_ORC, SKIN_ELF, HAIR } from '../gfx/models.js';

// Global scaling curve used by every number in the game (damage, hp, gold, xp...)
export const S = L => (1 + 0.1 * (L - 1)) * Math.pow(1.035, L - 1);
export const MAX_LEVEL = 60;
export const mobXp = L => Math.round(8 * S(L) * (1 + L * 0.05));
export const xpNeed = L => Math.round(mobXp(L) * (14 + L * 0.9));

export const RACES = {
  human: { name: 'İnsan|Human', desc: 'Uyumlu ve azimli. Tüm sınıflarda dengeli.|Adaptable and driven. Balanced in every class.', bonus: { xpPct: 5 }, bonusText: '+%5 tecrübe kazanımı|+5% experience gain', skins: SKIN, hairs: HAIR, beardDefault: 0 },
  elf: { name: 'Elf|Elf', desc: 'Kadim ormanların zarif çocukları.|Graceful children of the ancient woods.', bonus: { crit: 2 }, bonusText: '+%2 kritik şansı|+2% critical chance', skins: SKIN_ELF, hairs: HAIR, beardDefault: 0 },
  dwarf: { name: 'Cüce|Dwarf', desc: 'Dağların sağlam ustaları. Zanaatta eşsiz.|Sturdy masters of the mountains. Unrivalled at crafting.', bonus: { hpPct: 5, craftPct: 10 }, bonusText: '+%5 can, +%10 zanaat tecrübesi|+5% health, +10% crafting experience', skins: SKIN, hairs: HAIR, beardDefault: 2 },
  orc: { name: 'Ork|Orc', desc: 'Bozkırların güçlü savaşçıları.|Mighty warriors of the steppes.', bonus: { dmgPct: 3 }, bonusText: '+%3 hasar|+3% damage', skins: SKIN_ORC, hairs: HAIR, beardDefault: 0 },
};

// resource types
export const RES = {
  mana: { name: 'Mana|Mana', color: '#3a8cff', regen: 0.022, ooc: 0.06 },
  rage: { name: 'Öfke|Rage', color: '#e03a2a', max: 100, decay: 4 },
  energy: { name: 'Enerji|Energy', color: '#f0d040', max: 100, regen: 13 },
  focus: { name: 'Odak|Focus', color: '#e8902a', max: 100, regen: 9 },
};

// armour colours per tier (index 0..6) used for item visuals
export const TIER_COL = {
  plate: [0x8a8a90, 0xa8b0c0, 0x9ac8e8, 0xc8402a, 0x3a3034, 0x5a3a8a, 0xf0e8c8],
  mail: [0x7a7a78, 0x8a9098, 0x6a8a9a, 0x8a5a2a, 0x5a2a20, 0x3a3a5a, 0xd8d0b0],
  leather: [0x8a5a3a, 0x6a4a30, 0x4a3a2a, 0x5a6a3a, 0x3a2a2a, 0x2a2238, 0x7a5a3a],
  cloth: [0xc8b898, 0x5a6aa8, 0x8a3aa8, 0x2a8a8a, 0xc8401a, 0x2a1a4a, 0xf0f0ff],
};
export const TIER_TRIM = [0x6a5a4a, 0xa8a8b0, 0xd8b04a, 0xf0d070, 0xff7a2a, 0xb87aff, 0x8ae8ff];
export const WEAPON_COL = [0x9a9aa0, 0xc8d0dc, 0xa8e0ff, 0xe8c8a0, 0x2a2228, 0x6a4a9a, 0xffffff];

export const CLASSES = {
  warrior: {
    name: 'Savaşçı|Warrior', role: 'tank', roleName: 'Tank / Yakın Dövüş|Tank / Melee', icon: 'sword', color: '#c79c6e',
    desc: 'Ağır zırhlı, ön safların yılmaz koruyucusu. Öfkesiyle güçlenir, düşmanları üzerine çeker.|Heavily armoured guardian of the front line. Fuelled by rage, draws enemies onto himself.',
    res: 'rage', armor: 'plate', primary: 'str', ranged: false, range: 2.6,
    weapons: ['sword', 'axe', 'mace', 'greatsword'], offhands: ['shield'],
    base: { str: 9, agi: 6, int: 3, sta: 9, spi: 4 }, armorMult: 1.0,
    start: { main: 'sword', off: 'shield' }, startShirt: 0x8a6a4a,
    attack: 'slash', difficulty: 1,
  },
  mage: {
    name: 'Büyücü|Mage', role: 'dps', roleName: 'Uzak Mesafe Büyü|Ranged Caster', icon: 'fireball', color: '#69ccf0',
    desc: 'Ateş, buz ve gizem büyülerinin ustası. Kırılgan ama yıkıcı.|Master of fire, frost and arcane. Fragile but devastating.',
    res: 'mana', armor: 'cloth', primary: 'int', ranged: true, range: 26,
    weapons: ['staff', 'wand'], offhands: ['orb', 'tome'],
    base: { str: 3, agi: 4, int: 10, sta: 7, spi: 7 }, armorMult: 1.0,
    start: { main: 'staff' }, startShirt: 0x4a5aa8,
    attack: 'cast', difficulty: 2,
  },
  ranger: {
    name: 'Korucu|Ranger', role: 'dps', roleName: 'Uzak Mesafe Fiziksel|Ranged Physical', icon: 'bow', color: '#abd473',
    desc: 'Keskin gözlü okçu ve vahşi doğanın dostu. Kurt yoldaşıyla avlanır.|Sharp-eyed archer and friend of the wild. Hunts alongside a wolf companion.',
    res: 'focus', armor: 'mail', primary: 'agi', ranged: true, range: 26,
    weapons: ['bow'], offhands: [],
    base: { str: 5, agi: 10, int: 4, sta: 8, spi: 5 }, armorMult: 1.0,
    start: { main: 'bow' }, startShirt: 0x5a6a3a,
    attack: 'bow', difficulty: 1,
  },
  cleric: {
    name: 'Rahip|Cleric', role: 'healer', roleName: 'Şifacı / Destek|Healer / Support', icon: 'holy_cross', color: '#f8f0c0',
    desc: 'Kutsal ışığın hizmetkârı. Dostlarını iyileştirir, karanlığı yakar.|Servant of the holy light. Mends allies and burns the darkness.',
    res: 'mana', armor: 'mail', primary: 'int', ranged: true, range: 24,
    weapons: ['mace', 'staff'], offhands: ['shield', 'tome'],
    base: { str: 5, agi: 4, int: 9, sta: 8, spi: 9 }, armorMult: 1.0,
    start: { main: 'mace', off: 'tome' }, startShirt: 0xe8e0c8,
    attack: 'cast', difficulty: 2,
  },
  rogue: {
    name: 'Suikastçı|Rogue', role: 'dps', roleName: 'Yakın Dövüş Patlama|Melee Burst', icon: 'dagger', color: '#fff569',
    desc: 'Gölgelerde süzülen ölüm. Kombo puanlarıyla ölümcül vuruşlar yapar.|Death gliding through shadows. Builds combo points into lethal finishers.',
    res: 'energy', armor: 'leather', primary: 'agi', ranged: false, range: 2.4,
    weapons: ['dagger', 'sword'], offhands: ['dagger'],
    base: { str: 5, agi: 10, int: 3, sta: 8, spi: 4 }, armorMult: 1.0,
    start: { main: 'dagger', off: 'dagger' }, startShirt: 0x3a3a40,
    attack: 'dual', difficulty: 3,
  },
  necro: {
    name: 'Nekromant|Necromancer', role: 'dps', roleName: 'Çağırıcı / Lanet|Summoner / Curses', icon: 'skull', color: '#9482c9',
    desc: 'Ölülerin efendisi. İskelet ordusu ve yaşam emen lanetlerle savaşır.|Master of the dead. Fights with a skeletal army and life-draining curses.',
    res: 'mana', armor: 'cloth', primary: 'int', ranged: true, range: 26,
    weapons: ['staff', 'scythe', 'wand'], offhands: ['orb', 'tome'],
    base: { str: 3, agi: 4, int: 10, sta: 8, spi: 6 }, armorMult: 1.0,
    start: { main: 'scythe' }, startShirt: 0x3a2a4a,
    attack: 'cast', difficulty: 2,
  },
};
export const CLASS_IDS = Object.keys(CLASSES);
export const RACE_IDS = Object.keys(RACES);

// name generator for bots / suggestions
const SYL_A = ['Ka', 'Ar', 'El', 'Mo', 'Ze', 'Ta', 'Lu', 'Ra', 'Ve', 'Da', 'Sel', 'Tor', 'Mir', 'Kay', 'Bar', 'Ay', 'Er', 'Al', 'Os', 'Fen', 'Gal', 'Yi', 'Nur', 'Bo', 'Ce', 'Is', 'Ul', 'Ty'];
const SYL_B = ['ra', 'len', 'dor', 'mir', 'kan', 'tan', 'rin', 'vel', 'sun', 'gor', 'na', 'lis', 'rek', 'dal', 'tay', 'han', 'ya', 'zen', 'ra', 'thas', 'win', 'kut', 'per'];
const SYL_C = ['', '', '', 'a', 'el', 'is', 'on', 'ar', 'us', 'e', 'in', 'ra'];
const GAMER = ['Kara', 'Ak', 'Gok', 'Demir', 'Kurt', 'Shadow', 'Dark', 'Storm', 'Fire', 'Ice', 'Night', 'Blood', 'Iron', 'Wolf', 'Ejder', 'Yildiz', 'Bozkurt', 'Ruzgar', 'Tilki', 'Ates', 'Buz', 'Simsek', 'Moon', 'Sun', 'Frost', 'Hex'];
const GAMER2 = ['Kurt', 'Han', 'Blade', 'Slayer', 'Mage', 'Hunter', 'Kilic', 'Ok', 'Ruh', 'Pala', 'Fang', 'Heart', 'Soul', 'Bane', 'Avci', 'Bey', 'Lord', 'Witch', 'Queen', 'King', 'Knight', 'Pence'];
export function randomName(r = Math.random) {
  const pick = a => a[Math.floor(r() * a.length)];
  if (r() < 0.35) {
    let n = pick(GAMER) + pick(GAMER2);
    if (r() < 0.3) n += Math.floor(r() * 99);
    if (r() < 0.12) n = 'x' + n + 'x';
    return n.slice(0, 14);
  }
  const n = pick(SYL_A) + pick(SYL_B) + pick(SYL_C);
  return n.charAt(0).toUpperCase() + n.slice(1);
}

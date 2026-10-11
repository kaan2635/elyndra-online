// Item bases, materials, affixes, legendaries and stackable item templates.

export const RARITY = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'];
export const RARITY_COL = { common: '#c8c8c8', uncommon: '#3ade4a', rare: '#3a9aff', epic: '#b45aff', legendary: '#ff9a2a', mythic: '#ffe08a' };
export const RARITY_HEX = { common: 0xc8c8c8, uncommon: 0x3ade4a, rare: 0x3a9aff, epic: 0xb45aff, legendary: 0xff9a2a, mythic: 0xffe08a };
export const RARITY_MULT = { common: 0.7, uncommon: 0.9, rare: 1.05, epic: 1.25, legendary: 1.45, mythic: 1.65 };
export const RARITY_AFFIX = { common: [0, 0], uncommon: [1, 1], rare: [2, 2], epic: [3, 3], legendary: [3, 4], mythic: [4, 5] };
export const RARITY_VALUE = { common: 1, uncommon: 2, rare: 4, epic: 10, legendary: 25, mythic: 50 };

export const SLOTS = ['head', 'shoulders', 'chest', 'hands', 'legs', 'feet', 'cape', 'neck', 'ring', 'ring2', 'trinket', 'main', 'off'];
export const ARMOR_SLOTS = ['head', 'shoulders', 'chest', 'hands', 'legs', 'feet'];
export const SLOT_MULT = { head: 0.85, shoulders: 0.75, chest: 1, hands: 0.7, legs: 0.95, feet: 0.7, cape: 0.6, neck: 0.6, ring: 0.55, ring2: 0.55, trinket: 0.65, main: 1, off: 0.6 };
export const ARMOR_TYPE_MULT = { plate: 3.0, mail: 2.2, leather: 1.6, cloth: 1.0 };

export const MATERIALS = {
  plate: ['Paslı|Rusty', 'Demir|Iron', 'Çelik|Steel', 'Mithril|Mithril', 'Ejderha|Dragonforged', 'Obsidyen|Obsidian', 'Gölge|Shadowforged', 'Göksel|Celestial'],
  mail: ['Halkalı|Ringed', 'Zincir|Chain', 'Pullu|Scaled', 'Gümüş|Silvered', 'Ejder Pulu|Dragonscale', 'Kor|Ember', 'Boşluk|Void', 'Yıldız|Starforged'],
  leather: ['Ham Deri|Rawhide', 'Tabaklanmış|Tanned', 'Sertleştirilmiş|Hardened', 'Gece|Nightstalker', 'Kurtpostu|Wolfhide', 'Kor Derisi|Emberhide', 'Gölge|Shadowhide', 'Yıldız|Stardust'],
  cloth: ['Keten|Linen', 'Yün|Wool', 'İpek|Silk', 'Büyülü|Mageweave', 'Ay Örgüsü|Moonweave', 'Alev Örgüsü|Flameweave', 'Boşluk|Voidweave', 'Yıldız|Starweave'],
  metal: ['Paslı|Rusty', 'Demir|Iron', 'Çelik|Steel', 'Mithril|Mithril', 'Ejderkemiği|Dragonbone', 'Obsidyen|Obsidian', 'Gölgeçelik|Shadowsteel', 'Göksel|Celestial'],
  wood: ['Budaklı|Knotted', 'Meşe|Oak', 'Porsuk|Yew', 'Elf|Elven', 'Ejder|Wyrmwood', 'Kor|Emberwood', 'Boşluk|Voidwood', 'Yıldız|Starwood'],
  gem: ['Bakır|Copper', 'Gümüş|Silver', 'Altın|Golden', 'Safir|Sapphire', 'Yakut|Ruby', 'Obsidyen|Obsidian', 'Ametist|Amethyst', 'Elmas|Diamond'],
};
export const NOUNS = {
  plate: { head: 'Miğfer|Helm', shoulders: 'Omuzluk|Pauldrons', chest: 'Göğüslük|Breastplate', hands: 'Eldiven|Gauntlets', legs: 'Dizlik|Legplates', feet: 'Çizme|Sabatons' },
  mail: { head: 'Başlık|Coif', shoulders: 'Omuzluk|Spaulders', chest: 'Zırh|Hauberk', hands: 'Eldiven|Gloves', legs: 'Dizlik|Leggings', feet: 'Çizme|Boots' },
  leather: { head: 'Kukuleta|Hood', shoulders: 'Omuzluk|Shoulderpads', chest: 'Yelek|Tunic', hands: 'Eldiven|Gloves', legs: 'Pantolon|Pants', feet: 'Çizme|Boots' },
  cloth: { head: 'Şapka|Hat', shoulders: 'Şal|Mantle', chest: 'Cübbe|Robe', hands: 'Eldiven|Gloves', legs: 'Pantolon|Leggings', feet: 'Terlik|Slippers' },
  cape: 'Pelerin|Cloak', neck: 'Kolye|Necklace', ring: 'Yüzük|Ring', trinket: 'Tılsım|Charm',
};

// weapons: kind → {noun, twoHand, mat, stat, classes, slot}
export const WEAPONS = {
  sword: { noun: 'Kılıç|Sword', mat: 'metal', stat: 'str', slot: 'main', speed: 1.8, icon: 'sword' },
  greatsword: { noun: 'Büyük Kılıç|Greatsword', mat: 'metal', stat: 'str', slot: 'main', twoHand: true, speed: 2.6, icon: 'greatsword' },
  axe: { noun: 'Balta|Axe', mat: 'metal', stat: 'str', slot: 'main', speed: 2.0, icon: 'axe' },
  mace: { noun: 'Gürz|Mace', mat: 'metal', stat: 'str', slot: 'main', speed: 2.0, icon: 'mace' },
  dagger: { noun: 'Hançer|Dagger', mat: 'metal', stat: 'agi', slot: 'main', speed: 1.4, icon: 'dagger' },
  staff: { noun: 'Asa|Staff', mat: 'wood', stat: 'int', slot: 'main', twoHand: true, speed: 2.8, icon: 'staff' },
  scythe: { noun: 'Tırpan|Scythe', mat: 'metal', stat: 'int', slot: 'main', twoHand: true, speed: 2.8, icon: 'staff' },
  wand: { noun: 'Değnek|Wand', mat: 'wood', stat: 'int', slot: 'main', speed: 1.6, icon: 'wand' },
  bow: { noun: 'Yay|Bow', mat: 'wood', stat: 'agi', slot: 'main', twoHand: true, speed: 2.4, icon: 'bow' },
  shield: { noun: 'Kalkan|Shield', mat: 'metal', stat: 'sta', slot: 'off', icon: 'shield' },
  orb: { noun: 'Küre|Orb', mat: 'gem', stat: 'int', slot: 'off', icon: 'orb' },
  tome: { noun: 'Kitap|Tome', mat: 'cloth', stat: 'int', slot: 'off', icon: 'tome' },
};
// which classes may use which weapon kinds
export const CLASS_WEAPONS = {
  warrior: { main: ['sword', 'axe', 'mace', 'greatsword'], off: ['shield'] },
  mage: { main: ['staff', 'wand'], off: ['orb', 'tome'] },
  ranger: { main: ['bow'], off: [] },
  cleric: { main: ['mace', 'staff'], off: ['shield', 'tome'] },
  rogue: { main: ['dagger', 'sword'], off: ['dagger'] },
  necro: { main: ['staff', 'scythe', 'wand'], off: ['orb', 'tome'] },
};
export const CLASS_ARMOR = { warrior: 'plate', mage: 'cloth', ranger: 'mail', cleric: 'mail', rogue: 'leather', necro: 'cloth' };
export const CLASS_PRIMARY = { warrior: 'str', mage: 'int', ranger: 'agi', cleric: 'int', rogue: 'agi', necro: 'int' };

// secondary affixes: per point of budget → value; [min,max] percentage per rarity scale
export const AFFIXES = {
  crit: { name: 'Keskin|Keen', stat: 'crit', pct: [0.8, 2.6], w: 10 },
  critDmg: { name: 'Ölümcül|Deadly', stat: 'critDmg', pct: [3, 9], w: 7 },
  haste: { name: 'Çevik|Swift', stat: 'haste', pct: [1, 3.2], w: 9 },
  dodge: { name: 'Kaçamak|Evasive', stat: 'dodge', pct: [0.8, 2.4], w: 5 },
  leech: { name: 'Vampirik|Vampiric', stat: 'leech', pct: [0.6, 2], w: 4 },
  speed: { name: 'Rüzgâr|Windswept', stat: 'speed', pct: [3, 7], w: 4, slots: ['feet'] },
  sta: { name: 'Sağlam|Sturdy', stat: 'sta', budget: 0.6, w: 9 },
  spi: { name: 'Bilge|Wise', stat: 'spi', budget: 0.6, w: 6 },
  prim: { name: 'Güçlü|Mighty', stat: 'primary', budget: 0.5, w: 8 },
  armor: { name: 'Takviyeli|Reinforced', stat: 'armor', budget: 1.4, w: 5 },
  mf: { name: 'Şanslı|Lucky', stat: 'mf', pct: [3, 10], w: 3 },
  gold: { name: 'Zengin|Opulent', stat: 'goldPct', pct: [3, 10], w: 3 },
  xp: { name: 'Bilgin|Learned', stat: 'xpPct', pct: [2, 6], w: 2 },
  heal: { name: 'Şifalı|Healing', stat: 'healPct', pct: [2, 6], w: 3 },
  block: { name: 'Muhafız|Guardian', stat: 'block', pct: [2, 6], w: 4, slots: ['off'] },
};
export const EPIC_ADJ = ['Kadim|Ancient', 'Kahraman|Heroic', 'Kutsanmış|Hallowed', 'Fırtına|Stormbound', 'Gölgeli|Shadowed', 'Alevli|Blazing', 'Ayazlı|Frostbitten', 'Kraliyet|Royal', 'Lanetli|Cursed', 'Destan|Fabled', 'Titan|Titanic', 'Ruhani|Ethereal'];

// Legendary uniques: each has a fixed slot/kind and a special power
export const LEGENDARIES = {
  ember_heart: { name: 'Kor Yürek|Emberheart', slot: 'main', kind: 'staff', cls: ['mage'], power: 'pw_fire_split', glow: 0xff7a2a, desc: 'Ateş Topu çarptığı yerde patlar ve 4 metre içindeki düşmanlara %60 hasar verir.|Fireball explodes on impact, dealing 60% damage to enemies within 4 yards.' },
  frostbite: { name: 'Ayazdiş|Frostbite', slot: 'main', kind: 'wand', cls: ['mage'], power: 'pw_frost_shatter', glow: 0x8ad8ff, desc: 'Buz Oku dondurulmuş hedeflere %80 fazla hasar verir.|Frostbolt deals 80% more damage to frozen targets.' },
  stormcleaver: { name: 'Fırtınayaran|Stormcleaver', slot: 'main', kind: 'greatsword', cls: ['warrior'], power: 'pw_whirl_storm', glow: 0xa8d8ff, desc: 'Kasırga her vuruşta yakındaki bir düşmana şimşek çarptırır.|Whirlwind strikes a nearby enemy with lightning on every hit.' },
  bulwark: { name: 'Yıkılmaz Sur|Unbroken Bulwark', slot: 'off', kind: 'shield', cls: ['warrior', 'cleric'], power: 'pw_wall_reflect', glow: 0xffe68a, desc: 'Kalkan Duvarı aktifken aldığın hasarın %30\'unu saldırgana yansıtırsın.|While Shield Wall is active, reflect 30% of damage taken to the attacker.' },
  windwhisper: { name: 'Rüzgârfısıltısı|Windwhisper', slot: 'main', kind: 'bow', cls: ['ranger'], power: 'pw_multi_free', glow: 0x8aff6a, desc: 'Çoklu Atış 8 hedefe kadar ok atar ve odak harcamaz.|Multi-Shot hits up to 8 targets and costs no focus.' },
  packleader: { name: 'Sürü Lideri|Pack Leader', slot: 'neck', cls: ['ranger'], power: 'pw_two_wolves', glow: 0x8aff6a, desc: 'Kurt Yoldaş iki kurt çağırır.|Wolf Companion summons two wolves.' },
  dawnbringer: { name: 'Şafakgetiren|Dawnbringer', slot: 'main', kind: 'mace', cls: ['cleric'], power: 'pw_heal_echo', glow: 0xffe68a, desc: 'İyileştirmelerin, en yaralı ikinci dostuna %35 yankılanır.|Your heals echo 35% to the second most injured ally.' },
  halo_of_saints: { name: 'Azizler Halesi|Halo of Saints', slot: 'head', cls: ['cleric'], power: 'pw_renew_spread', glow: 0xffe68a, desc: 'Yenilenme, yakındaki yaralı bir dosta da uygulanır.|Renew also applies to a nearby injured ally.' },
  whisper_blade: { name: 'Fısıltı Bıçağı|Whisperblade', slot: 'main', kind: 'dagger', cls: ['rogue'], power: 'pw_finisher_refund', glow: 0xb48aff, desc: 'Bitiricilerin harcanan kombo puanı başına 8 enerji iade eder.|Finishers refund 8 energy per combo point spent.' },
  venom_fang: { name: 'Zehirdiş|Venomfang', slot: 'off', kind: 'dagger', cls: ['rogue'], power: 'pw_poison_burst', glow: 0x8aff6a, desc: 'Ölümcül Zehir 5 kata ulaştığında patlayarak büyük hasar verir.|Deadly Poison bursts for heavy damage when it reaches 5 stacks.' },
  soulreaper: { name: 'Ruhbiçen|Soulreaper', slot: 'main', kind: 'scythe', cls: ['necro'], power: 'pw_skel_explode', glow: 0x8affc8, desc: 'İskeletlerin öldüğünde patlayarak gölge hasarı verir.|Your skeletons explode for shadow damage when they die.' },
  crown_of_bones: { name: 'Kemik Taç|Crown of Bones', slot: 'head', cls: ['necro'], power: 'pw_extra_skeleton', glow: 0x8affc8, desc: 'Bir iskelet daha çağırabilirsin ve iskeletlerin %25 daha dayanıklıdır.|You can command one more skeleton, and they are 25% sturdier.' },
  titans_grip: { name: 'Titan Kavrayışı|Titan\'s Grip', slot: 'hands', power: 'pw_crit_heal', glow: 0xff6a3a, desc: 'Kritik vuruşların seni azami canının %2\'si kadar iyileştirir.|Your critical hits heal you for 2% of maximum health.' },
  ring_of_haste: { name: 'Zamanın Halkası|Band of Hours', slot: 'ring', power: 'pw_kill_haste', glow: 0xd68aff, desc: 'Düşman öldürmek 6 sn boyunca %25 hız kazandırır.|Killing an enemy grants 25% haste for 6 sec.' },
  phoenix_cloak: { name: 'Anka Pelerini|Phoenix Cloak', slot: 'cape', power: 'pw_cheat_death', glow: 0xff7a2a, desc: 'Ölümcül bir darbe aldığında %30 canla dirilirsin (3 dk bekleme).|When struck by a fatal blow, revive with 30% health (3 min cooldown).' },
  thornmail: { name: 'Dikenli Zırh|Thornmail', slot: 'chest', power: 'pw_thorns', glow: 0x8aff6a, desc: 'Sana yakın dövüşte vuranlar gücünün %40\'ı kadar hasar alır.|Melee attackers take damage equal to 40% of your power.' },
  boots_of_wind: { name: 'Rüzgâr Yürüyüşçüsü|Windwalkers', slot: 'feet', power: 'pw_speed', glow: 0xc8e8ff, desc: 'Savaş dışında %25 hareket hızı.|25% movement speed while out of combat.' },
  midas_charm: { name: 'Midas Tılsımı|Midas Charm', slot: 'trinket', power: 'pw_gold', glow: 0xffd040, desc: 'Düşmanlardan %50 daha fazla altın düşer.|Enemies drop 50% more gold.' },
  eye_of_storm: { name: 'Fırtına Gözü|Eye of the Storm', slot: 'trinket', power: 'pw_lightning_proc', glow: 0xa8d8ff, desc: 'Saldırıların %15 ihtimalle hedefe şimşek çarptırır.|Your attacks have a 15% chance to strike the target with lightning.' },
  heart_of_mountain: { name: 'Dağın Kalbi|Heart of the Mountain', slot: 'neck', power: 'pw_low_shield', glow: 0xd8b04a, desc: 'Canın %35\'in altına düştüğünde büyük bir kalkan kazanırsın (60 sn bekleme).|Gain a large shield when falling below 35% health (60 sec cooldown).' },
};

// Stackable items: consumables, materials, quest items, junk
// fields: name, icon, theme/fill colour, type, stack, value, use, tier, desc
export const ITEMS = {
  // potions
  hp1: { name: 'Küçük Şifa İksiri|Minor Healing Potion', icon: 'potion_red', type: 'consumable', stack: 20, value: 5, use: { potion: 'hp', pct: 0.35 }, lvl: 1 },
  hp2: { name: 'Şifa İksiri|Healing Potion', icon: 'potion_red', type: 'consumable', stack: 20, value: 18, use: { potion: 'hp', pct: 0.4 }, lvl: 15 },
  hp3: { name: 'Büyük Şifa İksiri|Greater Healing Potion', icon: 'potion_red', type: 'consumable', stack: 20, value: 45, use: { potion: 'hp', pct: 0.45 }, lvl: 30 },
  hp4: { name: 'Üstün Şifa İksiri|Superior Healing Potion', icon: 'potion_red', type: 'consumable', stack: 20, value: 110, use: { potion: 'hp', pct: 0.5 }, lvl: 45 },
  mp1: { name: 'Küçük Mana İksiri|Minor Mana Potion', icon: 'potion_blue', type: 'consumable', stack: 20, value: 5, use: { potion: 'mp', pct: 0.35 }, lvl: 1 },
  mp2: { name: 'Mana İksiri|Mana Potion', icon: 'potion_blue', type: 'consumable', stack: 20, value: 18, use: { potion: 'mp', pct: 0.4 }, lvl: 15 },
  mp3: { name: 'Büyük Mana İksiri|Greater Mana Potion', icon: 'potion_blue', type: 'consumable', stack: 20, value: 45, use: { potion: 'mp', pct: 0.45 }, lvl: 30 },
  mp4: { name: 'Üstün Mana İksiri|Superior Mana Potion', icon: 'potion_blue', type: 'consumable', stack: 20, value: 110, use: { potion: 'mp', pct: 0.5 }, lvl: 45 },
  elixir_power: { name: 'Güç İksiri|Elixir of Power', icon: 'elixir', fill: ['#ff9a5a', '#c84a1a'], type: 'consumable', stack: 20, value: 30, use: { buff: { id: 'elixir', name: 'Güç İksiri|Elixir of Power', icon: 'elixir', dur: 1800, pct: { power: 8 } } }, lvl: 10 },
  elixir_fort: { name: 'Dayanıklılık İksiri|Elixir of Fortitude', icon: 'elixir', fill: ['#8aff6a', '#2a8a1a'], type: 'consumable', stack: 20, value: 30, use: { buff: { id: 'elixir2', name: 'Dayanıklılık İksiri|Elixir of Fortitude', icon: 'elixir', dur: 1800, pct: { hpPct: 10 } } }, lvl: 10 },
  elixir_wisdom: { name: 'Bilgelik İksiri|Elixir of Wisdom', icon: 'potion_purple', type: 'consumable', stack: 20, value: 40, use: { buff: { id: 'elixir3', name: 'Bilgelik İksiri|Elixir of Wisdom', icon: 'potion_purple', dur: 3600, mods: { xpPct: 10 } } }, lvl: 5 },
  // food
  food1: { name: 'Kızarmış Et|Roasted Meat', icon: 'food', type: 'consumable', stack: 20, value: 3, use: { food: true, buff: { id: 'wellfed', name: 'Tok|Well Fed', icon: 'food', dur: 1800, pct: { sta: 5 } } }, lvl: 1 },
  food2: { name: 'Balık Çorbası|Fish Stew', icon: 'cooking_pot', type: 'consumable', stack: 20, value: 12, use: { food: true, buff: { id: 'wellfed', name: 'Tok|Well Fed', icon: 'cooking_pot', dur: 1800, pct: { stats: 4 }, mods: { manaRegen: 15 } } }, lvl: 10 },
  food3: { name: 'Baharatlı Kebap|Spiced Kebab', icon: 'food', type: 'consumable', stack: 20, value: 30, use: { food: true, buff: { id: 'wellfed', name: 'Tok|Well Fed', icon: 'food', dur: 1800, pct: { power: 6, sta: 6 } } }, lvl: 25 },
  food4: { name: 'Ejder Ziyafeti|Dragon Feast', icon: 'cooking_pot', type: 'consumable', stack: 20, value: 80, use: { food: true, buff: { id: 'wellfed', name: 'Tok|Well Fed', icon: 'cooking_pot', dur: 3600, pct: { stats: 8 }, mods: { crit: 3 } } }, lvl: 45 },
  bread: { name: 'Taze Ekmek|Fresh Bread', icon: 'bread', type: 'consumable', stack: 20, value: 2, use: { food: true, regen: 0.06 }, lvl: 1 },
  // scrolls / misc
  scroll_home: { name: 'Dönüş Parşömeni|Scroll of Return', icon: 'scroll', type: 'consumable', stack: 10, value: 10, use: { teleportHome: true }, desc: 'Son bağlandığın kasabaya ışınlar.|Teleports you to your bound town.' },
  enhance_stone: { name: 'Güçlendirme Taşı|Enhancement Stone', icon: 'crystal', fill: ['#8ae8ff', '#2a6aa8'], type: 'material', stack: 200, value: 15, desc: 'Ekipmanları güçlendirmek için kullanılır.|Used to enhance equipment.' },
  lucky_charm: { name: 'Şans Muskası|Lucky Charm', icon: 'token', fill: ['#ffe68a', '#c88a1a'], type: 'material', stack: 50, value: 50, desc: 'Güçlendirme başarı şansını %15 artırır.|Increases enhancement success chance by 15%.' },
  essence: { name: 'Büyü Özü|Arcane Essence', icon: 'essence', fill: ['#d68aff', '#6a2aa8'], type: 'material', stack: 200, value: 4, desc: 'Ekipman parçalanınca elde edilir.|Obtained by salvaging equipment.' },
  essence_g: { name: 'Parlak Öz|Radiant Essence', icon: 'essence', fill: ['#ffe68a', '#c88a1a'], type: 'material', stack: 200, value: 25, desc: 'Destansı ve efsanevi eşyalardan elde edilir.|Obtained from epic and legendary items.' },
  // ores (mining)
  ore1: { name: 'Bakır Cevheri|Copper Ore', icon: 'ore', fill: ['#e89a5a', '#8a4a1a'], type: 'material', stack: 100, value: 2, tier: 0 },
  ore2: { name: 'Demir Cevheri|Iron Ore', icon: 'ore', fill: ['#c8c8d0', '#5a5a68'], type: 'material', stack: 100, value: 4, tier: 1 },
  ore3: { name: 'Gümüş Cevheri|Silver Ore', icon: 'ore', fill: ['#f0f4ff', '#8a9ab0'], type: 'material', stack: 100, value: 8, tier: 2 },
  ore4: { name: 'Mithril Cevheri|Mithril Ore', icon: 'ore', fill: ['#a8e8ff', '#3a7aa8'], type: 'material', stack: 100, value: 14, tier: 3 },
  ore5: { name: 'Obsidyen Parçası|Obsidian Shard', icon: 'ore', fill: ['#6a5a6a', '#1a141a'], type: 'material', stack: 100, value: 24, tier: 4 },
  ore6: { name: 'Boşluk Kristali|Void Crystal', icon: 'crystal', fill: ['#c88aff', '#4a1a8a'], type: 'material', stack: 100, value: 40, tier: 5 },
  // herbs
  herb1: { name: 'Barış Çiçeği|Peacebloom', icon: 'flower', fill: ['#ffe8f0', '#e86a9a'], type: 'material', stack: 100, value: 2, tier: 0 },
  herb2: { name: 'Gümüş Yaprak|Silverleaf', icon: 'herb', fill: ['#e8f8e8', '#6aa86a'], type: 'material', stack: 100, value: 4, tier: 1 },
  herb3: { name: 'Çöl Gülü|Desert Rose', icon: 'flower', fill: ['#ffd0a0', '#d86a3a'], type: 'material', stack: 100, value: 8, tier: 2 },
  herb4: { name: 'Buz Lotusu|Frost Lotus', icon: 'flower', fill: ['#e8f8ff', '#6ab0e8'], type: 'material', stack: 100, value: 14, tier: 3 },
  herb5: { name: 'Ateş Otu|Firebloom', icon: 'herb', fill: ['#ffd06a', '#d84a1a'], type: 'material', stack: 100, value: 24, tier: 4 },
  herb6: { name: 'Gece Mantarı|Nightcap', icon: 'mushroom', fill: ['#d8a0ff', '#5a2a8a'], type: 'material', stack: 100, value: 40, tier: 5 },
  // wood
  wood1: { name: 'Meşe Kütüğü|Oak Log', icon: 'log', type: 'material', stack: 100, value: 2, tier: 0 },
  wood2: { name: 'Porsuk Kütüğü|Yew Log', icon: 'log', fill: ['#c88a5a', '#6a3a1a'], type: 'material', stack: 100, value: 4, tier: 1 },
  wood3: { name: 'Palmiye Kütüğü|Palm Log', icon: 'log', fill: ['#e8c88a', '#8a6a3a'], type: 'material', stack: 100, value: 8, tier: 2 },
  wood4: { name: 'Kar Çamı|Frostpine Log', icon: 'log', fill: ['#d8e8f0', '#5a6a7a'], type: 'material', stack: 100, value: 14, tier: 3 },
  wood5: { name: 'Kül Ağacı|Ashwood Log', icon: 'log', fill: ['#6a5a5a', '#2a1a1a'], type: 'material', stack: 100, value: 24, tier: 4 },
  wood6: { name: 'Gölge Ağacı|Shadowwood Log', icon: 'log', fill: ['#a88ad8', '#3a2a5a'], type: 'material', stack: 100, value: 40, tier: 5 },
  // monster materials
  leather1: { name: 'Hafif Deri|Light Leather', icon: 'leather', type: 'material', stack: 100, value: 2, tier: 0 },
  leather2: { name: 'Orta Deri|Medium Leather', icon: 'leather', fill: ['#a86a3a', '#5a3a1a'], type: 'material', stack: 100, value: 5, tier: 1 },
  leather3: { name: 'Kalın Deri|Thick Leather', icon: 'leather', fill: ['#8a5a3a', '#3a2010'], type: 'material', stack: 100, value: 10, tier: 2 },
  leather4: { name: 'Yeti Postu|Yeti Fur', icon: 'leather', fill: ['#f0f4f8', '#8a9aa8'], type: 'material', stack: 100, value: 16, tier: 3 },
  leather5: { name: 'Semender Derisi|Salamander Hide', icon: 'leather', fill: ['#ff8a4a', '#8a2a0a'], type: 'material', stack: 100, value: 26, tier: 4 },
  cloth1: { name: 'Keten Parçası|Linen Scrap', icon: 'cloth', type: 'material', stack: 100, value: 2, tier: 0 },
  cloth2: { name: 'Yün Kumaş|Wool Cloth', icon: 'cloth', fill: ['#c8b8a8', '#6a5a4a'], type: 'material', stack: 100, value: 5, tier: 1 },
  cloth3: { name: 'İpek Kumaş|Silk Cloth', icon: 'cloth', fill: ['#f0e0ff', '#8a6aa8'], type: 'material', stack: 100, value: 10, tier: 2 },
  cloth4: { name: 'Büyülü Kumaş|Mageweave', icon: 'cloth', fill: ['#a8c8ff', '#3a5aa8'], type: 'material', stack: 100, value: 16, tier: 3 },
  cloth5: { name: 'Alev Kumaşı|Flameweave Cloth', icon: 'cloth', fill: ['#ffb07a', '#a83a1a'], type: 'material', stack: 100, value: 26, tier: 4 },
  meat: { name: 'Çiğ Et|Raw Meat', icon: 'food', fill: ['#e87a7a', '#8a2a2a'], type: 'material', stack: 100, value: 1 },
  bone: { name: 'Kemik|Bone', icon: 'bone', type: 'material', stack: 100, value: 2 },
  fang: { name: 'Keskin Diş|Sharp Fang', icon: 'fang', type: 'material', stack: 100, value: 3 },
  silk: { name: 'Örümcek İpeği|Spider Silk', icon: 'cloth', fill: ['#f8f8ff', '#a8a8c8'], type: 'material', stack: 100, value: 6 },
  slime_gel: { name: 'Balçık Jölesi|Slime Gel', icon: 'potion_green', type: 'material', stack: 100, value: 1 },
  feather: { name: 'Tüy|Feather', icon: 'feather', type: 'material', stack: 100, value: 2 },
  ember: { name: 'Kor Parçası|Ember Fragment', icon: 'flame', type: 'material', stack: 100, value: 12 },
  frost_shard: { name: 'Buz Parçası|Frost Shard', icon: 'ice_shard', type: 'material', stack: 100, value: 10 },
  void_dust: { name: 'Boşluk Tozu|Void Dust', icon: 'dust', fill: ['#c88aff', '#4a1a8a'], type: 'material', stack: 100, value: 20 },
  sand_core: { name: 'Kum Çekirdeği|Sand Core', icon: 'crystal', fill: ['#ffe0a0', '#c8902a'], type: 'material', stack: 100, value: 9 },
  // gems
  gem1: { name: 'Pürüzlü Yakut|Rough Ruby', icon: 'gem', fill: ['#ff6a6a', '#a81a1a'], type: 'material', stack: 50, value: 20 },
  gem2: { name: 'Pürüzlü Safir|Rough Sapphire', icon: 'gem', fill: ['#6aa8ff', '#1a3aa8'], type: 'material', stack: 50, value: 20 },
  gem3: { name: 'Pürüzlü Zümrüt|Rough Emerald', icon: 'gem', fill: ['#6aff8a', '#1a8a3a'], type: 'material', stack: 50, value: 20 },
  gem4: { name: 'Ametist|Amethyst', icon: 'gem', fill: ['#d08aff', '#5a1a8a'], type: 'material', stack: 50, value: 45 },
  gem5: { name: 'Elmas|Diamond', icon: 'gem', fill: ['#ffffff', '#8ab0d8'], type: 'material', stack: 50, value: 90 },
  // fish
  fish1: { name: 'Gümüş Sazan|Silver Carp', icon: 'fish', fill: ['#e8f0f8', '#7a8a9a'], type: 'material', stack: 100, value: 3, fish: true },
  fish2: { name: 'Gökkuşağı Alabalığı|Rainbow Trout', icon: 'fish', fill: ['#ffb8d8', '#5a8aa8'], type: 'material', stack: 100, value: 6, fish: true },
  fish3: { name: 'Çöl Yayın Balığı|Desert Catfish', icon: 'fish', fill: ['#e8c88a', '#6a5a3a'], type: 'material', stack: 100, value: 10, fish: true },
  fish4: { name: 'Buz Somonu|Ice Salmon', icon: 'fish', fill: ['#ffc8a0', '#4a6a8a'], type: 'material', stack: 100, value: 16, fish: true },
  fish5: { name: 'Lav Yılanbalığı|Lava Eel', icon: 'fish', fill: ['#ff8a3a', '#2a1a1a'], type: 'material', stack: 100, value: 26, fish: true },
  fish6: { name: 'Hayalet Balık|Ghostfin', icon: 'fish', fill: ['#e0d0ff', '#5a4a8a'], type: 'material', stack: 100, value: 40, fish: true },
  fish_gold: { name: 'Altın Balık|Golden Koi', icon: 'fish', fill: ['#fff0a0', '#d8901a'], type: 'material', stack: 20, value: 150, fish: true, rare: true },
  fish_boot: { name: 'Eski Çizme|Old Boot', icon: 'boots', fill: ['#7a5a3a', '#3a2a1a'], type: 'junk', stack: 20, value: 1 },
  // junk
  junk1: { name: 'Kırık Diş|Broken Tooth', icon: 'fang', type: 'junk', stack: 50, value: 3 },
  junk2: { name: 'Yırtık Kumaş|Torn Cloth', icon: 'cloth', type: 'junk', stack: 50, value: 3 },
  junk3: { name: 'Paslı Toka|Rusty Buckle', icon: 'ring', type: 'junk', stack: 50, value: 5 },
  junk4: { name: 'Antik Sikke|Ancient Coin', icon: 'coin', type: 'junk', stack: 50, value: 12 },
  // chest / reward boxes
  chest_daily: { name: 'Maceracı Sandığı|Adventurer\'s Cache', icon: 'chest_box', type: 'consumable', stack: 20, value: 0, use: { openBox: 'daily' } },
  chest_dungeon: { name: 'Zindan Sandığı|Dungeon Coffer', icon: 'chest_box', fill: ['#c8a0ff', '#5a2a8a'], type: 'consumable', stack: 20, value: 0, use: { openBox: 'dungeon' } },
  chest_boss: { name: 'Hazine Sandığı|Treasure Chest', icon: 'chest_box', fill: ['#ffe68a', '#c88a1a'], type: 'consumable', stack: 20, value: 0, use: { openBox: 'boss' } },
  token_honor: { name: 'Onur Nişanı|Mark of Honor', icon: 'token', fill: ['#ffe68a', '#a87a1a'], type: 'currency', stack: 9999, value: 0 },
  token_valor: { name: 'Cesaret Amblemi|Emblem of Valor', icon: 'token', fill: ['#c8a0ff', '#5a2a8a'], type: 'currency', stack: 9999, value: 0 },
};

export function itemTpl(id) { return ITEMS[id]; }

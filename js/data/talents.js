// Talent trees: 3 branches per class, 6 nodes each. 1 point per level from 10.
// effect kinds: st (talentStats per rank), sk (skill damage/heal % per rank), flag (checked by code via u.tal(id))

const T = (id, name, icon, max, row, desc, eff = {}, req = null) => ({ id, name, icon, max, row, desc, ...eff, req });

export const TALENTS = {
  warrior: [
    { name: 'Silah Ustalığı|Arms', icon: 'sword', nodes: [
      T('wa1', 'Keskin Kenar|Sharpened Edge', 'slash', 5, 0, 'Ağır Darbe hasarı +%{6}.|Heavy Strike damage +{6}%.', { sk: { w_strike: 6 } }),
      T('wa2', 'Kesinlik|Precision', 'mark', 5, 1, 'Kritik şansı +%{1}.|Critical chance +{1}%.', { st: { crit: 1 } }),
      T('wa3', 'Derin Yaralar|Deep Wounds', 'bleed', 3, 2, 'Parçala hasarı +%{15}.|Rend damage +{15}%.', { sk: { w_rend: 15 } }, 'wa1'),
      T('wa4', 'Cellat|Executioner', 'skull', 3, 3, 'İnfaz hasarı +%{12}.|Execute damage +{12}%.', { sk: { w_execute: 12 } }),
      T('wa5', 'Ölümcül Darbeler|Lethal Strikes', 'crit', 5, 4, 'Kritik hasar +%{6}.|Critical damage +{6}%.', { st: { critDmg: 6 } }, 'wa2'),
      T('wa6', 'Savaş Ustası|Weapon Master', 'sword_cross', 1, 5, 'Tüm hasarın +%10 artar.|All damage increased by 10%.', { st: { dmgPct: 10 } }, 'wa5'),
    ] },
    { name: 'Öfke|Fury', icon: 'rage', nodes: [
      T('wf1', 'Kızgınlık|Anger', 'rage', 5, 0, 'Öfke kazanımı +%{8}.|Rage generation +{8}%.', { sk: { rageGen: 8 } }),
      T('wf2', 'Gaddarlık|Cruelty', 'fist', 5, 1, 'Güç +%{3}.|Power +{3}%.', { st: { powerPct: 3 } }),
      T('wf3', 'Kasırga Ustası|Whirlwind Mastery', 'whirlwind', 3, 2, 'Kasırga hasarı +%{12}.|Whirlwind damage +{12}%.', { sk: { w_whirl: 12 } }, 'wf1'),
      T('wf4', 'Yarıcı|Cleaver', 'cleave', 3, 3, 'Yarma hasarı +%{12}.|Cleave damage +{12}%.', { sk: { w_cleave: 12 } }),
      T('wf5', 'Hız Çılgınlığı|Flurry', 'haste', 5, 4, 'Hız +%{2}.|Haste +{2}%.', { st: { haste: 2 } }, 'wf2'),
      T('wf6', 'Kan Susuzluğu|Bloodthirst', 'blood_drop', 1, 5, 'Can çalma +%4.|Lifesteal +4%.', { st: { leech: 4 } }, 'wf5'),
    ] },
    { name: 'Koruma|Protection', icon: 'shield', nodes: [
      T('wp1', 'Dayanıklılık|Toughness', 'shield', 5, 0, 'Zırh +%{5}.|Armor +{5}%.', { st: { armorPct: 5 } }),
      T('wp2', 'Demir Beden|Iron Body', 'heart', 5, 1, 'Can +%{3}.|Health +{3}%.', { st: { hpPct: 3 } }),
      T('wp3', 'Kalkan Ustası|Shield Mastery', 'shield_glow', 3, 2, 'Blok şansı +%{3}.|Block chance +{3}%.', { st: { block: 3 } }, 'wp1'),
      T('wp4', 'Uzun Duvar|Lasting Wall', 'barrier', 2, 3, 'Kalkan Duvarı süresi +%{25}.|Shield Wall duration +{25}%.', { sk: { w_wall_dur: 25 } }),
      T('wp5', 'Savuşturma|Parry', 'sprint', 5, 4, 'Kaçınma +%{1}.|Dodge +{1}%.', { st: { dodge: 1 } }, 'wp2'),
      T('wp6', 'Yılmaz|Unyielding', 'banner', 1, 5, 'Aldığın hasar %8 azalır.|Damage taken reduced by 8%.', { st: { dmgTakenPct: -8 } }, 'wp5'),
    ] },
  ],
  mage: [
    { name: 'Ateş|Fire', icon: 'flame', nodes: [
      T('mf1', 'Yakıcı Ateş|Searing Flames', 'fireball', 5, 0, 'Ateş Topu hasarı +%{6}.|Fireball damage +{6}%.', { sk: { m_fireball: 6 } }),
      T('mf2', 'Tutuşma|Ignite', 'flame', 3, 1, 'Ateş Topu hedefi tutuşturur (rütbe başına daha güçlü).|Fireball ignites the target (stronger per rank).', { flag: 1 }),
      T('mf3', 'Alev Sütunu Ustası|Flamestrike Mastery', 'flame', 3, 2, 'Alev Sütunu hasarı +%{12}.|Flamestrike damage +{12}%.', { sk: { m_flamestrike: 12 } }, 'mf1'),
      T('mf4', 'Kritik Kütle|Critical Mass', 'explosion', 5, 3, 'Kritik şansı +%{1}.|Critical chance +{1}%.', { st: { crit: 1 } }),
      T('mf5', 'Yanık|Burnout', 'meteor', 5, 4, 'Kritik hasar +%{6}.|Critical damage +{6}%.', { st: { critDmg: 6 } }, 'mf4'),
      T('mf6', 'Cehennem Ateşi|Hellfire', 'sun', 1, 5, 'Tüm hasarın +%10 artar.|All damage increased by 10%.', { st: { dmgPct: 10 } }, 'mf5'),
    ] },
    { name: 'Buz|Frost', icon: 'snowflake', nodes: [
      T('mi1', 'Buz Keskinliği|Ice Shards', 'ice_shard', 5, 0, 'Buz Oku hasarı +%{6}.|Frostbolt damage +{6}%.', { sk: { m_frostbolt: 6 } }),
      T('mi2', 'Buz Zırhı|Ice Armor', 'shield', 5, 1, 'Zırh +%{8}, can +%{2}.|Armor +{8}%, health +{2}%.', { st: { armorPct: 8, hpPct: 2 } }),
      T('mi3', 'Soğuk Hız|Cold Haste', 'hourglass', 5, 2, 'Hız +%{2}.|Haste +{2}%.', { st: { haste: 2 } }, 'mi1'),
      T('mi4', 'Kış Laneti|Winter\'s Chill', 'frost_nova', 3, 3, 'Gizemli Füzeler hasarı +%{10}.|Arcane Missiles damage +{10}%.', { sk: { m_missiles: 10 } }),
      T('mi5', 'Buz Bariyeri|Ice Barrier', 'barrier', 3, 4, 'Aldığın hasar -%{3}.|Damage taken -{3}%.', { st: { dmgTakenPct: -3 } }, 'mi2'),
      T('mi6', 'Buzul Ruhu|Glacial Spirit', 'crystal', 1, 5, 'Güç +%12.|Power +12%.', { st: { powerPct: 12 } }, 'mi5'),
    ] },
    { name: 'Gizem|Arcane', icon: 'arcane_star', nodes: [
      T('ma1', 'Gizem Bilgisi|Arcane Mind', 'book_open', 5, 0, 'Zeka +%{3}.|Intellect +{3}%.', { st: { intPct: 3 } }),
      T('ma2', 'Mana Akışı|Mana Flow', 'essence', 5, 1, 'Mana yenilenmesi +%{10}.|Mana regeneration +{10}%.', { st: { manaRegen: 10 } }),
      T('ma3', 'Füze Yağmuru|Missile Barrage', 'arcane_missiles', 3, 2, 'Gizemli Füzeler hasarı +%{12}.|Arcane Missiles damage +{12}%.', { sk: { m_missiles: 12 } }, 'ma1'),
      T('ma4', 'Gizem Odağı|Arcane Focus', 'eye', 5, 3, 'Kritik şansı +%{1}.|Critical chance +{1}%.', { st: { crit: 1 } }),
      T('ma5', 'Varlık|Presence of Mind', 'blink', 5, 4, 'Güç +%{3}.|Power +{3}%.', { st: { powerPct: 3 } }, 'ma4'),
      T('ma6', 'Gizem Gücü|Arcane Power', 'arcane_star', 1, 5, 'Tüm hasarın +%10 artar.|All damage increased by 10%.', { st: { dmgPct: 10 } }, 'ma5'),
    ] },
  ],
  ranger: [
    { name: 'Nişancılık|Marksmanship', icon: 'mark', nodes: [
      T('rm1', 'Keskin Ok|Sharp Arrows', 'arrow', 5, 0, 'Hızlı Atış hasarı +%{6}.|Quick Shot damage +{6}%.', { sk: { r_shot: 6 } }),
      T('rm2', 'Keskin Nişancı|Sniper', 'mark', 3, 1, 'Nişanlı Atış kritik şansı +%{5}.|Aimed Shot critical chance +{5}%.', { flag: 1 }),
      T('rm3', 'Odaklı Atış|Focused Aim', 'eye', 5, 2, 'Nişanlı Atış hasarı +%{6}.|Aimed Shot damage +{6}%.', { sk: { r_aimed: 6 } }, 'rm1'),
      T('rm4', 'Ölümcül Atışlar|Mortal Shots', 'crit', 5, 3, 'Kritik hasar +%{6}.|Critical damage +{6}%.', { st: { critDmg: 6 } }),
      T('rm5', 'Kartal Gözü|Eagle Eye', 'eye', 5, 4, 'Kritik şansı +%{1}.|Critical chance +{1}%.', { st: { crit: 1 } }, 'rm4'),
      T('rm6', 'Usta Okçu|Master Archer', 'bow', 1, 5, 'Tüm hasarın +%10 artar.|All damage increased by 10%.', { st: { dmgPct: 10 } }, 'rm5'),
    ] },
    { name: 'Hayatta Kalma|Survival', icon: 'trap', nodes: [
      T('rs1', 'Zehir Uzmanı|Venomous', 'poison_drop', 5, 0, 'Engerek İğnesi hasarı +%{8}.|Serpent Sting damage +{8}%.', { sk: { r_sting: 8 } }),
      T('rs2', 'Sağlam|Hardy', 'heart', 5, 1, 'Can +%{3}.|Health +{3}%.', { st: { hpPct: 3 } }),
      T('rs3', 'Ok Fırtınası|Arrow Storm', 'rain_arrows', 3, 2, 'Ok Yağmuru hasarı +%{12}.|Rain of Arrows damage +{12}%.', { sk: { r_rain: 12 } }, 'rs1'),
      T('rs4', 'Çevik Adımlar|Light Feet', 'sprint', 5, 3, 'Kaçınma +%{1}.|Dodge +{1}%.', { st: { dodge: 1 } }),
      T('rs5', 'Çoklu Atış Ustası|Barrage', 'multi_arrows', 3, 4, 'Çoklu Atış hasarı +%{12}.|Multi-Shot damage +{12}%.', { sk: { r_multi: 12 } }, 'rs3'),
      T('rs6', 'Hayatta Kalan|Survivalist', 'shield', 1, 5, 'Aldığın hasar %8 azalır.|Damage taken reduced by 8%.', { st: { dmgTakenPct: -8 } }, 'rs4'),
    ] },
    { name: 'Vahşi Doğa|Beast Mastery', icon: 'paw', nodes: [
      T('rb1', 'Sürü Ruhu|Pack Spirit', 'wolf', 5, 0, 'Evcil hayvanının hasarı +%{8}.|Pet damage +{8}%.', { sk: { pet: 8 } }),
      T('rb2', 'Kalın Post|Thick Hide', 'leather', 5, 1, 'Evcil hayvanının canı +%{10}.|Pet health +{10}%.', { sk: { petHp: 10 } }),
      T('rb3', 'Vahşi Güç|Feral Power', 'fist', 5, 2, 'Güç +%{3}.|Power +{3}%.', { st: { powerPct: 3 } }, 'rb1'),
      T('rb4', 'Yırtıcı|Predator', 'fang', 5, 3, 'Hız +%{2}.|Haste +{2}%.', { st: { haste: 2 } }),
      T('rb5', 'Kan Bağı|Blood Bond', 'heart', 3, 4, 'Can çalma +%{1}.|Lifesteal +{1}%.', { st: { leech: 1 } }, 'rb2'),
      T('rb6', 'Alfa|Alpha', 'crown', 1, 5, 'Evcil hayvanının hasarı +%25.|Pet damage +25%.', { sk: { pet: 25 } }, 'rb5'),
    ] },
  ],
  cleric: [
    { name: 'Kutsal|Holy', icon: 'holy_cross', nodes: [
      T('ch1', 'İyileştirme Ustası|Improved Healing', 'heal_hand', 5, 0, 'İyileştir gücü +%{6}.|Heal power +{6}%.', { sk: { c_heal: 6 } }),
      T('ch2', 'Kutsal Bağ|Divine Bond', 'heart', 5, 1, 'İyileştirme gücü +%{3}.|Healing power +{3}%.', { st: { healPct: 3 } }),
      T('ch3', 'Kalıcı Işık|Lasting Light', 'renew', 3, 2, 'Yenilenme gücü +%{12}.|Renew power +{12}%.', { sk: { c_renew: 12 } }, 'ch1'),
      T('ch4', 'Işık Dalgası|Holy Wave', 'sparkles', 3, 3, 'Kutsal Dalga gücü +%{12}.|Holy Nova power +{12}%.', { sk: { c_nova: 12 } }),
      T('ch5', 'İlahi Lütuf|Divine Grace', 'sun', 3, 4, 'İlahi Işık gücü +%{12}.|Divine Light power +{12}%.', { sk: { c_divine: 12 } }, 'ch2'),
      T('ch6', 'Aziz|Saint', 'halo', 1, 5, 'İyileştirme gücü +%12.|Healing power +12%.', { st: { healPct: 12 } }, 'ch5'),
    ] },
    { name: 'Disiplin|Discipline', icon: 'shield_glow', nodes: [
      T('cd1', 'Güçlü Kalkan|Improved Shield', 'shield_glow', 5, 0, 'Kutsal Kalkan emişi +%{8}.|Holy Shield absorb +{8}%.', { sk: { c_shield: 8 } }),
      T('cd2', 'İç Odak|Inner Focus', 'eye', 5, 1, 'Mana yenilenmesi +%{10}.|Mana regeneration +{10}%.', { st: { manaRegen: 10 } }),
      T('cd3', 'Kefaret|Atonement', 'heal_hand', 3, 2, 'Kutsal Çarpma, en yaralı dostunu iyileştirir.|Smite also heals your most injured ally.', { flag: 1 }, 'cd1'),
      T('cd4', 'Sabır|Patience', 'hourglass', 5, 3, 'Hız +%{2}.|Haste +{2}%.', { st: { haste: 2 } }),
      T('cd5', 'Sarsılmaz|Steadfast', 'barrier', 3, 4, 'Aldığın hasar -%{3}.|Damage taken -{3}%.', { st: { dmgTakenPct: -3 } }, 'cd2'),
      T('cd6', 'Işık Muhafızı|Lightwarden', 'star', 1, 5, 'Can +%12.|Health +12%.', { st: { hpPct: 12 } }, 'cd5'),
    ] },
    { name: 'Gazap|Retribution', icon: 'sun', nodes: [
      T('cr1', 'Yakıcı Işık|Searing Light', 'sun', 5, 0, 'Kutsal Çarpma hasarı +%{6}.|Smite damage +{6}%.', { sk: { c_smite: 6 } }),
      T('cr2', 'Kutsal Gazap|Holy Wrath', 'fist', 5, 1, 'Güç +%{3}.|Power +{3}%.', { st: { powerPct: 3 } }),
      T('cr3', 'Arındırma|Purge', 'halo', 5, 2, 'Kritik şansı +%{1}.|Critical chance +{1}%.', { st: { crit: 1 } }, 'cr1'),
      T('cr4', 'Kutsal Öfke|Zeal', 'rage', 5, 3, 'Kritik hasar +%{6}.|Critical damage +{6}%.', { st: { critDmg: 6 } }),
      T('cr5', 'Adalet|Justice', 'hammer', 3, 4, 'Kutsal Dalga gücü +%{10}.|Holy Nova power +{10}%.', { sk: { c_nova: 10 } }, 'cr3'),
      T('cr6', 'İlahi Gazap|Divine Wrath', 'sun', 1, 5, 'Tüm hasarın +%10 artar.|All damage increased by 10%.', { st: { dmgPct: 10 } }, 'cr5'),
    ] },
  ],
  rogue: [
    { name: 'Suikast|Assassination', icon: 'poison_drop', nodes: [
      T('ga1', 'Acımasız|Ruthlessness', 'dagger', 3, 0, 'Kombo kazandıran saldırılar %{20} ihtimalle ek puan verir.|Combo-generating attacks have a {20}% chance for an extra point.', { flag: 1 }),
      T('ga2', 'Öldürücü|Lethality', 'crit', 5, 1, 'Kritik hasar +%{6}.|Critical damage +{6}%.', { st: { critDmg: 6 } }),
      T('ga3', 'Usta Zehirci|Master Poisoner', 'poison_drop', 5, 2, 'Can çalma +%{0.6}.|Lifesteal +{0.6}%.', { st: { leech: 0.6 } }, 'ga1'),
      T('ga4', 'Parçalayıcı|Ripper', 'slash', 5, 3, 'Parçalama hasarı +%{6}.|Eviscerate damage +{6}%.', { sk: { g_evis: 6 } }),
      T('ga5', 'Kanayan Yara|Gushing Wound', 'blood_drop', 3, 4, 'Kanatma hasarı +%{12}.|Rupture damage +{12}%.', { sk: { g_rupture: 12 } }, 'ga4'),
      T('ga6', 'Suikastçı|Assassin', 'skull', 1, 5, 'Tüm hasarın +%10 artar.|All damage increased by 10%.', { st: { dmgPct: 10 } }, 'ga5'),
    ] },
    { name: 'Dövüş|Combat', icon: 'sword_cross', nodes: [
      T('gc1', 'Hançer Ustası|Dagger Mastery', 'dagger', 5, 0, 'Sinsi Darbe hasarı +%{6}.|Sinister Strike damage +{6}%.', { sk: { g_strike: 6 } }),
      T('gc2', 'Hızlı Eller|Quick Hands', 'haste', 5, 1, 'Hız +%{2}.|Haste +{2}%.', { st: { haste: 2 } }),
      T('gc3', 'Bıçak Dansı|Blade Dance', 'dagger_throw', 3, 2, 'Bıçak Yelpazesi hasarı +%{12}.|Fan of Knives damage +{12}%.', { sk: { g_fan: 12 } }, 'gc1'),
      T('gc4', 'Kesinlik|Precision', 'mark', 5, 3, 'Kritik şansı +%{1}.|Critical chance +{1}%.', { st: { crit: 1 } }),
      T('gc5', 'Saldırgan|Aggression', 'fist', 5, 4, 'Güç +%{3}.|Power +{3}%.', { st: { powerPct: 3 } }, 'gc2'),
      T('gc6', 'Kılıç Ustası|Swordmaster', 'sword_cross', 1, 5, 'Hız +%10.|Haste +10%.', { st: { haste: 10 } }, 'gc5'),
    ] },
    { name: 'Gölge|Subtlety', icon: 'stealth', nodes: [
      T('gs1', 'Gizli Adımlar|Camouflage', 'stealth', 5, 0, 'Hareket hızı +%{2}.|Movement speed +{2}%.', { st: { speed: 2 } }),
      T('gs2', 'Gölge Zırhı|Shadow Armor', 'smoke', 5, 1, 'Kaçınma +%{1}.|Dodge +{1}%.', { st: { dodge: 1 } }),
      T('gs3', 'Sinsi|Elusive', 'sprint', 5, 2, 'Can +%{3}.|Health +{3}%.', { st: { hpPct: 3 } }, 'gs2'),
      T('gs4', 'Pusu|Ambush', 'eye', 5, 3, 'Kritik şansı +%{1}.|Critical chance +{1}%.', { st: { crit: 1 } }),
      T('gs5', 'Karanlık|Darkness', 'moon', 3, 4, 'Aldığın hasar -%{3}.|Damage taken -{3}%.', { st: { dmgTakenPct: -3 } }, 'gs3'),
      T('gs6', 'Gölge Efendisi|Shadow Master', 'skull_crown', 1, 5, 'Tüm hasarın +%10 artar.|All damage increased by 10%.', { st: { dmgPct: 10 } }, 'gs5'),
    ] },
  ],
  necro: [
    { name: 'Lanet|Affliction', icon: 'skull', nodes: [
      T('na1', 'Yozlaşmış Ruh|Corrupted Soul', 'skull', 5, 0, 'Yozlaşma hasarı +%{8}.|Corruption damage +{8}%.', { sk: { n_corrupt: 8 } }),
      T('na2', 'Gölge Ustası|Shadow Mastery', 'death_coil', 5, 1, 'Gölge Oku hasarı +%{6}.|Shadow Bolt damage +{6}%.', { sk: { n_bolt: 6 } }),
      T('na3', 'Açgözlülük|Greed', 'drain', 3, 2, 'Can Emme hasarı +%{12}.|Drain Life damage +{12}%.', { sk: { n_drain: 12 } }, 'na1'),
      T('na4', 'Karanlık Bilgi|Dark Knowledge', 'book_open', 5, 3, 'Kritik şansı +%{1}.|Critical chance +{1}%.', { st: { crit: 1 } }),
      T('na5', 'Ruh Yiyen|Soul Eater', 'soul', 5, 4, 'Can çalma +%{0.8}.|Lifesteal +{0.8}%.', { st: { leech: 0.8 } }, 'na3'),
      T('na6', 'Ölüm Lordu|Deathlord', 'skull_crown', 1, 5, 'Tüm hasarın +%10 artar.|All damage increased by 10%.', { st: { dmgPct: 10 } }, 'na5'),
    ] },
    { name: 'Ordu|Legion', icon: 'summon', nodes: [
      T('nl1', 'Kemik Ordusu|Bone Army', 'summon', 5, 0, 'İskelet hasarı +%{8}.|Skeleton damage +{8}%.', { sk: { pet: 8 } }),
      T('nl2', 'Sağlam Kemikler|Sturdy Bones', 'bone', 5, 1, 'İskelet canı +%{10}.|Skeleton health +{10}%.', { sk: { petHp: 10 } }),
      T('nl3', 'Lejyon|Legion', 'skull', 2, 2, 'Bir iskelet daha çağırabilirsin (rütbe başına).|Command one more skeleton per rank.', { flag: 1 }, 'nl1'),
      T('nl4', 'Ceset Ustası|Corpse Master', 'explosion', 3, 3, 'Ceset Patlaması hasarı +%{12}.|Corpse Explosion damage +{12}%.', { sk: { n_explosion: 12 } }),
      T('nl5', 'Ölüm Bağı|Death Pact', 'heart', 5, 4, 'Can +%{3}.|Health +{3}%.', { st: { hpPct: 3 } }, 'nl2'),
      T('nl6', 'Ordu Komutanı|Commander', 'crown', 1, 5, 'İskelet hasarı +%25.|Skeleton damage +25%.', { sk: { pet: 25 } }, 'nl3'),
    ] },
    { name: 'Kan|Blood', icon: 'blood_drop', nodes: [
      T('nb1', 'Kan Büyüsü|Blood Magic', 'blood_drop', 5, 0, 'Güç +%{3}.|Power +{3}%.', { st: { powerPct: 3 } }),
      T('nb2', 'Kemik Kabuk|Bone Shell', 'bone', 5, 1, 'Zırh +%{8}.|Armor +{8}%.', { st: { armorPct: 8 } }),
      T('nb3', 'Kan Kaynağı|Blood Well', 'heart', 5, 2, 'Can +%{3}.|Health +{3}%.', { st: { hpPct: 3 } }, 'nb2'),
      T('nb4', 'Kan Fırtınası|Blood Storm', 'explosion', 5, 3, 'Kritik hasar +%{6}.|Critical damage +{6}%.', { st: { critDmg: 6 } }),
      T('nb5', 'Hasat|Reaping', 'soul', 3, 4, 'Ceset Patlaması hasarı +%{10}.|Corpse Explosion damage +{10}%.', { sk: { n_explosion: 10 } }, 'nb4'),
      T('nb6', 'Kan Lordu|Blood Lord', 'skull_crown', 1, 5, 'Güç +%12.|Power +12%.', { st: { powerPct: 12 } }, 'nb5'),
    ] },
  ],
};

export const TALENT_INDEX = {};
for (const cls in TALENTS) for (const br of TALENTS[cls]) for (const n of br.nodes) TALENT_INDEX[n.id] = { ...n, cls };

export const talentPoints = level => Math.max(0, level - 9);
// row unlock: points spent in that branch must be >= row * 3
export const ROW_REQ = 3;

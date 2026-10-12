// Bilingual text system. Content strings use the compact "Türkçe|English" form.
// UI strings live in the STR table below and are fetched with t(key, ...args).

let lang = 'tr';
try {
  const saved = localStorage.getItem('elyndra_lang');
  if (saved === 'tr' || saved === 'en') lang = saved;
  else lang = (navigator.language || 'tr').toLowerCase().startsWith('tr') ? 'tr' : 'en';
} catch (e) { /* storage blocked */ }

export const getLang = () => lang;
export function setLang(l) {
  lang = l === 'en' ? 'en' : 'tr';
  try { localStorage.setItem('elyndra_lang', lang); } catch (e) { }
  document.documentElement.lang = lang;
}

// Localise a "tr|en" string (or {tr,en} object). Strings without '|' are returned as-is.
export function L(s) {
  if (s == null) return '';
  if (typeof s === 'object') return s[lang] ?? s.tr ?? s.en ?? '';
  const i = s.indexOf('|');
  if (i < 0) return s;
  return lang === 'tr' ? s.slice(0, i) : s.slice(i + 1);
}

const STR = {
  // --- generic
  ok: 'Tamam|OK', cancel: 'İptal|Cancel', close: 'Kapat|Close', yes: 'Evet|Yes', no: 'Hayır|No', back: 'Geri|Back',
  confirm: 'Onayla|Confirm', accept: 'Kabul Et|Accept', decline: 'Reddet|Decline', continue: 'Devam|Continue',
  level: 'Seviye|Level', lv: 'Sv|Lv', gold: 'Altın|Gold', loading: 'Yükleniyor|Loading', play: 'Oyna|Play',
  delete: 'Sil|Delete', create: 'Oluştur|Create', random: 'Rastgele|Random', name: 'İsim|Name', buy: 'Satın Al|Buy',
  sell: 'Sat|Sell', equip: 'Kuşan|Equip', unequip: 'Çıkar|Unequip', use: 'Kullan|Use', salvage: 'Parçala|Salvage',
  learn: 'Öğren|Learn', locked: 'Kilitli|Locked', free: 'Ücretsiz|Free', all: 'Tümü|All', none: 'Yok|None',
  // --- title
  tagline: 'Kadim Diyarlar Online|Realms of Old Online', newChar: 'Yeni Karakter|New Character', enterWorld: 'Dünyaya Gir|Enter World',
  settings: 'Ayarlar|Settings', credits: 'Hakkında|About', selectChar: 'Karakter Seç|Select Character', noChars: 'Henüz karakterin yok. Maceraya başlamak için bir kahraman yarat!|No characters yet. Create a hero to begin your adventure!',
  charCreate: 'Karakter Yaratma|Character Creation', race: 'Irk|Race', class: 'Sınıf|Class', appearance: 'Görünüm|Appearance',
  body: 'Vücut|Body', skin: 'Ten|Skin', hair: 'Saç|Hair', hairColor: 'Saç Rengi|Hair Color', beard: 'Sakal|Beard', eyes: 'Gözler|Eyes',
  marks: 'Dövme|Markings', build: 'Yapı|Build', nameTaken: 'Bu isim kullanılıyor.|That name is taken.', nameInvalid: 'İsim 3-14 harf olmalı.|Name must be 3-14 letters.',
  deleteConfirm: '{0} kalıcı olarak silinsin mi?|Permanently delete {0}?', role: 'Rol|Role',
  // --- hud
  target: 'Hedef|Target', xp: 'TP|XP', rested: 'Dinlenmiş|Rested', inCombat: 'Savaşta|In Combat',
  menuChar: 'Karakter|Character', menuBag: 'Çanta|Bags', menuSkills: 'Yetenekler|Skills', menuTalents: 'Yetenek Ağacı|Talents',
  menuQuests: 'Görevler|Quests', menuMap: 'Harita|Map', menuSocial: 'Sosyal|Social', menuGuild: 'Lonca|Guild', menuCraft: 'Zanaat|Crafting',
  menuAch: 'Başarımlar|Achievements', menuCollect: 'Koleksiyon|Collection', menuMarket: 'Pazar|Market', menuMenu: 'Menü|Menu',
  menuDungeon: 'Zindanlar|Dungeons', menuArena: 'Arena|Arena', menuTower: 'Sonsuz Kule|Endless Tower', menuHome: 'Evim|My Home', menuAuto: 'Oto Av|Auto-Hunt',
  zoneEnter: '{0}|{0}', levelUp: 'Seviye Atladın!|Level Up!', reachedLevel: '{0}. seviyeye ulaştın|You reached level {0}',
  youDied: 'Öldün|You Died', respawn: 'Yeniden Doğ|Respawn', respawnHint: 'En yakın ışınlanma taşında dirileceksin.|You will revive at the nearest waystone.',
  notEnoughRes: 'Yeterli {0} yok|Not enough {0}', outOfRange: 'Menzil dışında|Out of range', noTarget: 'Hedef yok|No target',
  onCooldown: 'Henüz hazır değil|Not ready yet', cantWhileMoving: 'Hareket ederken yapılamaz|Can\'t do that while moving',
  bagFull: 'Çantan dolu|Your bags are full', interrupted: 'Kesildi|Interrupted', stunned: 'Sersemledin|Stunned', silenced: 'Susturuldun|Silenced',
  lootGold: '+{0} altın|+{0} gold', questUpdated: 'Görev güncellendi|Quest updated', questComplete: 'Görev Tamamlandı!|Quest Complete!',
  questAccepted: 'Yeni Görev|New Quest', newZone: 'Yeni Bölge Keşfedildi|New Zone Discovered', waystone: 'Işınlanma Taşı|Waystone',
  waystoneFound: 'Işınlanma taşı aktifleşti|Waystone attuned', saved: 'Kaydedildi|Saved', dodge: 'Kaçın|Dodge', jump: 'Zıpla|Jump',
  autoRun: 'Otomatik Koş|Auto Run', mount: 'Binek|Mount', interact: 'Etkileşim|Interact', attack: 'Saldır|Attack',
  talkTo: 'Konuş|Talk', gather: 'Topla|Gather', fish: 'Balık Tut|Fish', open: 'Aç|Open', enter: 'Gir|Enter',
  // stats
  st_str: 'Güç|Strength', st_agi: 'Çeviklik|Agility', st_int: 'Zeka|Intellect', st_sta: 'Dayanıklılık|Stamina', st_spi: 'Ruh|Spirit',
  st_hp: 'Can|Health', st_mp: 'Mana|Mana', st_ap: 'Saldırı Gücü|Attack Power', st_sp: 'Büyü Gücü|Spell Power', st_armor: 'Zırh|Armor',
  st_crit: 'Kritik Şans|Critical Chance', st_critDmg: 'Kritik Hasar|Critical Damage', st_haste: 'Hız|Haste', st_dodge: 'Savuşturma|Dodge',
  st_leech: 'Can Çalma|Lifesteal', st_speed: 'Hareket Hızı|Movement Speed', st_regen: 'Yenilenme|Regeneration', st_block: 'Blok|Block',
  st_dmg: 'Hasar|Damage', st_heal: 'İyileştirme Gücü|Healing Power', st_res: 'Direnç|Resistance', st_ilvl: 'Eşya Seviyesi|Item Level',
  st_dps: 'Saniye Başı Hasar|Damage per Second', st_power: 'Güç Puanı|Gear Score',
  // rarities
  r_common: 'Sıradan|Common', r_uncommon: 'Kaliteli|Uncommon', r_rare: 'Nadir|Rare', r_epic: 'Destansı|Epic', r_legendary: 'Efsanevi|Legendary', r_mythic: 'Mitik|Mythic',
  // slots
  s_head: 'Kafa|Head', s_shoulders: 'Omuz|Shoulders', s_chest: 'Göğüs|Chest', s_hands: 'Eller|Hands', s_legs: 'Bacaklar|Legs', s_feet: 'Ayaklar|Feet',
  s_main: 'Ana El|Main Hand', s_off: 'Yan El|Off Hand', s_neck: 'Kolye|Neck', s_ring: 'Yüzük|Ring', s_ring2: 'Yüzük|Ring', s_cape: 'Pelerin|Cape', s_trinket: 'Tılsım|Trinket',
  // settings
  set_lang: 'Dil|Language', set_quality: 'Grafik Kalitesi|Graphics Quality', set_low: 'Düşük|Low', set_med: 'Orta|Medium', set_high: 'Yüksek|High', set_ultra: 'Ultra|Ultra',
  set_master: 'Ana Ses|Master Volume', set_music: 'Müzik|Music', set_sfx: 'Efektler|Effects', set_ambient: 'Ortam Sesi|Ambience',
  set_shadows: 'Gölgeler|Shadows', set_dmgnum: 'Hasar Sayıları|Damage Numbers', set_names: 'İsim Etiketleri|Nameplates',
  set_camshake: 'Kamera Sarsıntısı|Camera Shake', set_online: 'Çevrimiçi Oyuncular (P2P)|Online Players (P2P)', set_fps: 'FPS Göster|Show FPS',
  set_uiscale: 'Arayüz Boyutu|UI Scale', set_autoloot: 'Otomatik Ganimet|Auto Loot', set_export: 'Kaydı Dışa Aktar|Export Save',
  set_import: 'Kaydı İçe Aktar|Import Save', set_quit: 'Karakter Seçimine Dön|Back to Character Select', set_fullscreen: 'Tam Ekran|Fullscreen',
  set_viewdist: 'Görüş Mesafesi|View Distance', set_joystick: 'Sabit Joystick|Fixed Joystick', set_bots: 'Diğer Maceracılar|Other Adventurers',
};

export function t(key, ...args) {
  let s = STR[key];
  if (s === undefined) return key;
  s = L(s);
  if (args.length) s = s.replace(/\{(\d+)\}/g, (_, i) => args[+i] ?? '');
  return s;
}

// Register extra UI strings from other modules (keeps this file manageable).
export function addStrings(obj) { Object.assign(STR, obj); }

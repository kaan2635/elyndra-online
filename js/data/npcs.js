// NPC definitions. at: "town.anchor" or [x, z]. roles drive the dialog options.
import { SKIN, HAIR } from '../gfx/models.js';

const H = o => ({ rig: 'humanoid', ...o });
const villager = (o = {}) => H({ race: 'human', skin: SKIN[o.s ?? 1], hair: o.hair ?? 0, hairColor: o.hc ?? HAIR[1], beard: o.beard || 0, body: o.body || 0, eyes: 0x3a5a2a, gear: { chest: { m: o.cm || 'cloth', c: o.c ?? 0x8a6a4a, c2: o.c2 ?? 0x5a3a22 }, legs: { c: o.lc ?? 0x5a4a3a }, ...(o.gear || {}) } });

export const NPCS = {
  // ================================================================ Aydınköy (vale)
  elder: { zone: 'vale', at: 'aydinkoy.center', name: 'Muhtar Yusuf|Elder Yusuf', title: 'Aydınköy Muhtarı|Elder of Dawnhollow', roles: ['quest'],
    model: villager({ s: 1, hair: 5, hc: 0xd0d0d8, beard: 2, c: 0x3a4a6a, cm: 'robe', c2: 0xd8b04a, gear: { main: { m: 'staff', c2: 0x6a4a2a } } }),
    greet: 'Hoş geldin, evlat. Bu topraklar eskisi kadar huzurlu değil.|Welcome, child. These lands are not as peaceful as they once were.' },
  captain: { zone: 'vale', at: 'aydinkoy.gate0', name: 'Yüzbaşı Leyla|Captain Leyla', title: 'Muhafız Komutanı|Guard Captain', roles: ['quest'],
    model: villager({ s: 2, hair: 2, hc: HAIR[0], body: 1, cm: 'plate', c: 0xa8b0c0, c2: 0x3a5aa8, gear: { head: { m: 'helm', c: 0xa8b0c0 }, shoulders: { m: 'plate', c: 0xa8b0c0 }, main: { m: 'sword' }, off: { m: 'shield', c: 0x3a5aa8, c2: 0xd8b04a }, cape: { c: 0x3a5aa8 } } }),
    greet: 'Dikkatli ol maceracı. Kurtlar, goblinler, haydutlar... Muhafızlarım yetmiyor.|Stay sharp, adventurer. Wolves, goblins, bandits... I don\'t have enough guards.' },
  smith: { zone: 'vale', at: 'aydinkoy.smithy', name: 'Demirci Hasan|Hasan the Smith', title: 'Demirci & Güçlendirme Ustası|Blacksmith & Enhancer', roles: ['quest', 'shop', 'enhance', 'train'], shop: 'smith', prof: ['mining', 'smithing'],
    model: villager({ s: 3, hair: 5, beard: 1, hc: HAIR[0], c: 0x5a3a22, cm: 'leather', gear: { main: { m: 'hammer', c: 0x8a8a90 }, hands: { c: 0x3a2a1a } } }),
    greet: 'Çeliğin sesi gibisi yok! Silah, zırh ya da güçlendirme mi lazım?|Nothing like the ring of steel! Need weapons, armour or enhancement?' },
  innkeeper: { zone: 'vale', at: 'aydinkoy.inn', name: 'Hancı Zeynep|Zeynep the Innkeeper', title: 'Altın Kaz Hanı|The Golden Goose Inn', roles: ['quest', 'shop', 'inn', 'train'], shop: 'inn', prof: ['cooking'],
    model: villager({ s: 1, hair: 4, hc: HAIR[2], body: 1, c: 0xa83a2a, c2: 0xf0e8d8 }),
    greet: 'Sıcak çorba, yumuşak yatak! Burada dinlenirsen tecrüben daha hızlı artar.|Warm stew and a soft bed! Rest here and your experience grows faster.' },
  merchant: { zone: 'vale', at: 'aydinkoy.stall0', name: 'Tüccar Selim|Selim the Merchant', title: 'Genel Mallar|General Goods', roles: ['shop', 'bank'], shop: 'general',
    model: villager({ s: 2, hair: 0, hc: HAIR[0], beard: 1, c: 0x2a6a5a, c2: 0xd8b04a, gear: { head: { m: 'cap', c: 0x8a2a2a } } }),
    greet: 'İksirler, çantalar, parşömenler! En iyi fiyatlar Selim\'de!|Potions, bags, scrolls! Best prices at Selim\'s!' },
  alchemist: { zone: 'vale', at: 'aydinkoy.stall1', name: 'Simyacı Nur|Nur the Alchemist', title: 'Simya & Bitkicilik|Alchemy & Herbalism', roles: ['quest', 'shop', 'train'], shop: 'alchemy', prof: ['herbalism', 'alchemy'],
    model: villager({ s: 0, hair: 1, hc: HAIR[3], body: 1, cm: 'robe', c: 0x5a3a8a, c2: 0x8aff8a }),
    greet: 'Doğanın her yaprağı bir mucize saklar. Ot toplamayı öğrenmek ister misin?|Every leaf of nature hides a miracle. Want to learn herb gathering?' },
  trader: { zone: 'vale', at: 'aydinkoy.stall2', name: 'Pazarcı Elif|Elif the Broker', title: 'Pazar & Lonca Kayıtları|Market & Guild Registry', roles: ['market', 'guild', 'tailor', 'train'], prof: ['tailoring', 'jewelcrafting'],
    model: villager({ s: 1, hair: 2, hc: HAIR[5], body: 1, c: 0xd8a03a, c2: 0x8a2a2a }),
    greet: 'Pazarda her şey bulunur! Eşyalarını satabilir, başka maceracılardan alışveriş yapabilirsin.|You can find anything at the market! Sell your items and trade with other adventurers.' },
  stablemaster: { zone: 'vale', at: 'aydinkoy.stable', name: 'Seyis Ali|Ali the Stablemaster', title: 'Binek Ahırı|Stables', roles: ['quest', 'stable'],
    model: villager({ s: 2, hair: 6, hc: HAIR[1], c: 0x6a5a3a, cm: 'leather', gear: { head: { m: 'cap', c: 0x5a4a2a } } }),
    greet: 'Sağlam bir at, maceracının en iyi dostudur!|A sturdy horse is an adventurer\'s best friend!' },
  priestess: { zone: 'vale', at: 'aydinkoy.temple', name: 'Rahibe Ayşe|Sister Ayşe', title: 'Işık Tapınağı|Temple of Light', roles: ['quest', 'dungeon', 'arena'],
    model: villager({ s: 0, hair: 1, hc: HAIR[4], body: 1, cm: 'robe', c: 0xf0e8d8, c2: 0xd8b04a, gear: { head: { m: 'circlet', c2: 0xffd040 } } }),
    greet: 'Işık seninle olsun. Zindanlar ve meydan okumalar hakkında bilgi verebilirim.|May the Light be with you. I can tell you about dungeons and trials.' },
  fisher: { zone: 'vale', at: [-44, 52], rot: 2.4, name: 'Balıkçı Osman|Osman the Fisherman', title: 'Balıkçılık Ustası|Fishing Trainer', roles: ['quest', 'shop', 'train'], shop: 'fish', prof: ['fishing'],
    model: villager({ s: 3, hair: 5, beard: 2, hc: 0xa8a8a8, c: 0x3a5a7a, gear: { head: { m: 'hat', c: 0xc8a868 }, main: { m: 'rod' } } }),
    greet: 'Göl sabırlı olanı ödüllendirir. Bir olta ister misin?|The lake rewards the patient. Want a fishing rod?' },
  farmer: { zone: 'vale', at: [90, 36], rot: 0.6, name: 'Çiftçi Mehmet|Farmer Mehmet', title: 'Değirmen Çiftliği|Millbrook Farm', roles: ['quest', 'shop'], shop: 'farm',
    model: villager({ s: 2, hair: 0, hc: HAIR[2], beard: 1, c: 0x8a6a3a, gear: { head: { m: 'hat', c: 0xd8c070 }, main: { m: 'pickaxe' } } }),
    greet: 'Şu domuzlar ekinlerimi mahvediyor! Yardım eder misin?|Those boars are ruining my crops! Will you help?' },
  scout: { zone: 'vale', at: [8, -8], rot: 3.0, name: 'İzci Can|Scout Can', title: 'Kral Muhafızı İzcisi|Royal Scout', roles: ['quest'],
    model: villager({ s: 1, hair: 2, hc: HAIR[0], c: 0x3a5a2a, cm: 'leather', gear: { head: { m: 'hood', c: 0x2a4a2a }, main: { m: 'bow', c: 0x6a4a2a }, cape: { c: 0x2a4a2a } } }),
    greet: 'Şşş! Kuzeydeki goblinleri izliyorum.|Shh! I\'m watching the goblins to the north.' },
  gravekeeper: { zone: 'vale', at: [100, 112], rot: -0.8, name: 'Mezarcı Hüseyin|Hüseyin the Gravekeeper', title: 'Eski Mezarlık|Old Cemetery', roles: ['quest'],
    model: villager({ s: 4, hair: 5, beard: 2, hc: 0x8a8a8a, c: 0x3a3a3a, cm: 'robe', gear: { main: { m: 'torch' } } }),
    greet: 'Ölüler huzursuz... Geceleri mezarlarından kalkıyorlar.|The dead are restless... They rise from their graves at night.' },
  widow: { zone: 'vale', at: 'aydinkoy.stall2', ox: 3, name: 'Fatma Teyze|Auntie Fatma', title: '', roles: ['quest'],
    model: villager({ s: 1, hair: 4, hc: 0xd0d0d8, body: 1, c: 0x6a3a5a, cm: 'robe' }),
    greet: 'Ah evladım, kocamın yüzüğünü gölde kaybettim...|Oh dear, I lost my late husband\'s ring by the lake...' },
  guard1: { zone: 'vale', at: 'aydinkoy.gate1', name: 'Muhafız|Town Guard', title: 'Aydınköy Muhafızı|Dawnhollow Guard', roles: [],
    model: villager({ s: 1, hair: 0, beard: 1, cm: 'plate', c: 0xa8b0c0, c2: 0x3a5aa8, gear: { head: { m: 'helm', c: 0xa8b0c0 }, main: { m: 'sword' }, off: { m: 'shield', c: 0x3a5aa8 }, cape: { c: 0x3a5aa8 } } }), greet: 'Aydınköy\'de huzur var. Sorun çıkarma.|There\'s peace in Dawnhollow. Don\'t make trouble.' },
  guard2: { zone: 'vale', at: 'aydinkoy.gate2', name: 'Muhafız|Town Guard', title: 'Aydınköy Muhafızı|Dawnhollow Guard', roles: [],
    model: villager({ s: 2, hair: 0, beard: 0, cm: 'plate', c: 0xa8b0c0, c2: 0x3a5aa8, gear: { head: { m: 'helm', c: 0xa8b0c0 }, main: { m: 'sword' }, off: { m: 'shield', c: 0x3a5aa8 }, cape: { c: 0x3a5aa8 } } }), greet: 'Güney yolu güvenli, kuzeye dikkat et.|The south road is safe; beware the north.' },
};

// Vendor inventories. Entries: stackable id, or {gen:{...}} for generated gear at the player's level.
export const SHOPS = {
  general: { name: 'Genel Mallar|General Goods', items: ['hp1', 'hp2', 'hp3', 'hp4', 'mp1', 'mp2', 'mp3', 'mp4', 'scroll_home', 'bread', 'elixir_wisdom', 'enhance_stone'], bags: true },
  inn: { name: 'Han|Inn', items: ['bread', 'food1', 'food2', 'food3', 'hp1', 'mp1'] },
  smith: { name: 'Demirci|Blacksmith', items: ['enhance_stone', 'lucky_charm'], gear: true },
  alchemy: { name: 'Simyacı|Alchemist', items: ['hp1', 'hp2', 'hp3', 'mp1', 'mp2', 'mp3', 'elixir_power', 'elixir_fort', 'elixir_wisdom'] },
  fish: { name: 'Balıkçı|Fisherman', items: ['bread', 'food2'], rod: true },
  farm: { name: 'Çiftlik|Farm', items: ['bread', 'food1', 'meat'] },
};

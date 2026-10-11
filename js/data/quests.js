// Quests. obj types: kill{m:[],n}, collect{item,n,from:[],chance}, gather{node,n}, fish{n,item?}, talk{npc}, explore{poi}, interact{obj,n},
// dungeon{id}, boss{m}, level{n}, have{item,n} (consumed), craft{n}. rew: {xp (fraction of level), gold (×S), items, choice, unlock}
export const QUESTS = {};
const Q = (id, o) => { QUESTS[id] = { id, ...o }; };

// ============================================================================ ZONE 1 — Yeşilvadi
// ---- Main story: Kristalin Çağrısı (The Crystal's Call), chapter I
Q('q_awaken', { zone: 'vale', main: true, lvl: 1, giver: 'elder', name: 'Uyanış|Awakening',
  text: 'Demek uyandın... Seni dün gece, Ayna Gölü kıyısında, parlayan bir kristal parçasının yanında baygın bulduk. Kadim Aether Kristali\'nin parçalandığı söylentileri doğruymuş demek.\n\nSen bir Kristal Taşıyıcısın, evlat. Ama önce kendini toparlamalısın. Muhafız Komutanı Yüzbaşı Leyla kuzey kapısında; sana savaşmayı ve bu toprakları tanımayı o öğretecek.|So you\'re awake... We found you last night on the shore of Mirror Lake, unconscious beside a glowing crystal shard. The rumours about the shattering of the ancient Aether Crystal were true.\n\nYou are a Crystal Bearer, child. But first you must recover your strength. Captain Leyla, our guard commander, waits at the north gate; she will teach you to fight and to know these lands.',
  done: 'Muhtar seni bana gönderdi, öyle mi? Güzel. Ellerin titremiyor, bu iyiye işaret.|The Elder sent you to me? Good. Your hands aren\'t shaking — that\'s a fine sign.',
  obj: [{ t: 'talk', npc: 'captain' }], turnin: 'captain', rew: { xp: 0.6, gold: 3 } });
Q('q_first_blood', { zone: 'vale', main: true, lvl: 1, giver: 'captain', prev: 'q_awaken', name: 'İlk Kan|First Blood',
  text: 'Kristal parçası etraftaki balçıkları kudurttu. Köyün hemen dışında, gölün yakınında yeşil balçıklar dolaşıyor. Onlardan 6 tanesini temizle, bakalım silahını ne kadar iyi kullanıyorsun.\n\nİpucu: Bir düşmana dokunarak veya tıklayarak hedef al; saldırı otomatik başlar.|The crystal shard has driven the slimes mad. Green slimes roam just outside the village, near the lake. Clear out 6 of them and let\'s see how well you handle your weapon.\n\nTip: Tap or click an enemy to target it; your attacks start automatically.',
  progress: 'Balçıklar hâlâ köyün etrafında dolaşıyor.|The slimes still roam around the village.',
  done: 'Fena değil! Bir savaşçının ruhu var sende. Al, bu seni koruyacak.|Not bad! You have a fighter\'s spirit. Here, this will protect you.',
  obj: [{ t: 'kill', m: ['slime', 'slime_blue'], n: 6 }], rew: { xp: 1.0, gold: 5, choice: [{ slot: 'chest', rarity: 'uncommon' }, { slot: 'legs', rarity: 'uncommon' }] } });
Q('q_wolves', { zone: 'vale', main: true, lvl: 3, giver: 'captain', prev: 'q_first_blood', name: 'Sürünün Tehdidi|Threat of the Pack',
  text: 'Kuzeybatıdaki Kurt Ormanı\'nın kurtları, kristalin enerjisiyle saldırganlaştı. Dün bir oduncumuzu yaraladılar. 8 Orman Kurdu avla ve kanıt olarak 4 Keskin Diş getir.|The wolves of Wolfwood to the northwest have grown vicious from the crystal\'s energy. Yesterday they wounded one of our woodcutters. Hunt 8 Forest Wolves and bring back 4 Sharp Fangs as proof.',
  progress: 'Kurtlar hâlâ yolları tehdit ediyor.|The wolves still threaten the roads.',
  done: 'Bu dişler... normalden iki kat büyük. Kristalin etkisi düşündüğümüzden de güçlü.|These fangs... twice the normal size. The crystal\'s influence is stronger than we thought.',
  obj: [{ t: 'kill', m: ['wolf'], n: 8 }, { t: 'have', item: 'fang', n: 4 }], rew: { xp: 1.0, gold: 8, choice: [{ slot: 'main', rarity: 'uncommon' }, { slot: 'feet', rarity: 'uncommon' }] } });
Q('q_scout', { zone: 'vale', main: true, lvl: 5, giver: 'captain', prev: 'q_wolves', name: 'Goblin İzleri|Goblin Tracks',
  text: 'İzcimiz Can, Dörtyol\'da goblinleri gözetliyor. Son zamanlarda kuzey tepelerde çok fazla hareket var. Git ve onunla konuş.|Our scout Can is watching the goblins from the Crossroads. There\'s been far too much movement in the northern hills lately. Go and speak with him.',
  done: 'Seni bekliyordum! Goblinler bir şey arıyor... ve bence ne olduğunu biliyorum.|I\'ve been waiting for you! The goblins are searching for something... and I think I know what.',
  obj: [{ t: 'talk', npc: 'scout' }], turnin: 'scout', rew: { xp: 0.4, gold: 2 } });
Q('q_goblin_camp', { zone: 'vale', main: true, lvl: 5, giver: 'scout', prev: 'q_scout', name: 'Goblin Kampı|The Goblin Camp',
  text: 'Kuzeydoğu tepelerindeki kampta goblinler toplanıyor. Şamanları kristal parçasının gücünü kullanmayı öğrenirse başımız büyük belada. Kampa saldır: 10 goblin ve 2 şaman yeter.|The goblins are gathering at the camp in the northeastern hills. If their shamans learn to wield the shard\'s power, we\'re in deep trouble. Raid the camp: 10 goblins and 2 shamans should do.',
  progress: 'Kamp hâlâ goblinlerle dolu.|The camp is still crawling with goblins.',
  done: 'Harika iş! Ama dönerken bir şey gördüm: şamanlar büyük bir sandığı korurken...|Great work! But on your way back I spotted something: the shamans were guarding a big chest...',
  obj: [{ t: 'kill', m: ['goblin', 'goblin_spear'], n: 10 }, { t: 'kill', m: ['goblin_shaman'], n: 2 }], rew: { xp: 1.0, gold: 10, choice: [{ slot: 'head', rarity: 'uncommon' }, { slot: 'hands', rarity: 'uncommon' }, { slot: 'shoulders', rarity: 'uncommon' }] } });
Q('q_shard', { zone: 'vale', main: true, lvl: 6, giver: 'scout', prev: 'q_goblin_camp', name: 'Parlayan Sandık|The Glowing Chest',
  text: 'Kampın ortasındaki sandık mavi bir ışıkla parlıyordu. Parçanın kendisi olabilir! Sandığı aç ve içindekini Muhtar Yusuf\'a götür.|The chest in the middle of the camp was glowing with a blue light. It might be the shard itself! Open the chest and take whatever is inside to Elder Yusuf.',
  progress: 'Sandığı buldun mu?|Did you find the chest?',
  done: 'Bu... bu bir kristal parçası değil, bir harita! Goblinler parçanın Goblin Mağarası\'nın derinliklerinde olduğunu biliyor. Kralları Grukk onu kendine saklıyor olmalı.|This... this isn\'t a shard, it\'s a map! The goblins know the shard lies deep within the Goblin Warren. Their king, Grukk, must be keeping it for himself.',
  obj: [{ t: 'interact', obj: 'qo_goblin_chest', n: 1 }], turnin: 'elder', rew: { xp: 0.8, gold: 8, items: [{ id: 'hp1', qty: 5 }] } });
Q('q_prepare', { zone: 'vale', main: true, lvl: 7, giver: 'elder', prev: 'q_shard', name: 'Savaşa Hazırlık|Preparing for Battle',
  text: 'Grukk\'un mağarasına tek başına girmek delilik olur. Rahibe Ayşe tapınakta; sana yoldaşlar bulabilir. Ama önce Demirci Hasan\'a uğra, silahını güçlendirmeyi öğret sana.|Entering Grukk\'s warren alone would be madness. Sister Ayşe at the temple can find you companions. But first visit Hasan the Smith — he\'ll teach you to enhance your weapon.',
  done: 'Muhtar seni gönderdi demek. Al şu taşları; güçlendirme başarısız olsa bile eşyan asla kırılmaz, merak etme.|The Elder sent you? Take these stones — even if an enhancement fails, your item never breaks, don\'t worry.',
  obj: [{ t: 'talk', npc: 'smith' }], turnin: 'smith', rew: { xp: 0.4, gold: 4, items: [{ id: 'enhance_stone', qty: 4 }] } });
Q('q_warren', { zone: 'vale', main: true, lvl: 8, giver: 'priestess', prev: 'q_prepare', name: 'Goblin Kral|The Goblin King',
  text: 'Işık sana yoldaşlar gönderecek. Zindanlar menüsünden (veya mağaranın girişinden) Goblin Mağarası\'na gir. Tank, şifacı ve savaşçılar seninle gelecek. Grukk\'u yen ve kristal parçasını geri al!|The Light will send you companions. Enter the Goblin Warren from the Dungeons menu (or the cave entrance). A tank, a healer and fighters will join you. Defeat Grukk and reclaim the crystal shard!',
  progress: 'Grukk hâlâ mağarasında oturuyor.|Grukk still sits in his warren.',
  done: 'Parça! Hissedebiliyorum... Aether\'in ilk parçası artık güvende. Ama bu sadece başlangıç, Kristal Taşıyıcı.|The shard! I can feel it... The first shard of the Aether is safe at last. But this is only the beginning, Crystal Bearer.',
  obj: [{ t: 'boss', m: 'grukk' }], turnin: 'elder', rew: { xp: 1.5, gold: 30, choice: [{ slot: 'main', rarity: 'rare' }, { slot: 'chest', rarity: 'rare' }, { slot: 'neck', rarity: 'rare' }], items: [{ id: 'enhance_stone', qty: 3 }] } });
Q('q_onward', { zone: 'vale', main: true, lvl: 10, giver: 'elder', prev: 'q_warren', name: 'Fısıltı Ormanına|Into the Whisperwood',
  text: 'Elfler ikinci parçanın Fısıltı Ormanı\'na düştüğünü söylüyor. Kuzey Geçidi\'ndeki kadim portalı kullan. Yaprakevi\'nde Elf Bilgesi Aelora seni bekliyor.|The elves say the second shard fell into the Whisperwood. Use the ancient portal at the Northern Pass. Elf Sage Aelora awaits you in Leafhome.',
  progress: 'Aelora seni bekliyor.|Aelora is waiting for you.',
  done: 'Demek Yusuf\'un bahsettiği Kristal Taşıyıcı sensin. Ormanımız hastalanıyor...|So you are the Crystal Bearer Yusuf spoke of. Our forest is sickening...',
  obj: [{ t: 'talk', npc: 'aelora' }], turnin: 'aelora', rew: { xp: 0.5, gold: 10 } });

// ---- side quests
Q('q_boars', { zone: 'vale', lvl: 2, giver: 'farmer', name: 'Ekin Düşmanları|Crop Destroyers',
  text: 'Yaban domuzları tarlamı talan ediyor! Çiftliğin güneyinde ve doğusunda dolaşıyorlar. 8 tanesini kovala... yani, kalıcı olarak.|Wild boars are ravaging my fields! They roam south and east of the farm. Chase off 8 of them... permanently.',
  progress: 'Domuzlar hâlâ havuçlarımı yiyor!|The boars are still eating my carrots!', done: 'Tarlam kurtuldu! Bu turtayı al, karım yaptı.|My fields are saved! Take this pie, my wife baked it.',
  obj: [{ t: 'kill', m: ['boar'], n: 8 }], rew: { xp: 0.8, gold: 6, items: [{ id: 'food1', qty: 5 }], choice: [{ slot: 'feet', rarity: 'uncommon' }, { slot: 'hands', rarity: 'uncommon' }] } });
Q('q_old_tusk', { zone: 'vale', lvl: 5, giver: 'farmer', prev: 'q_boars', name: 'Yaşlı Dişli|Old Tusk',
  text: 'Domuzların lideri, Yaşlı Dişli dediğimiz dev bir canavar. Çiftliğin güneyindeki çayırlarda dolaşıyor. Tek başına zor olabilir, dikkat et!|The leader of the boars is a giant beast we call Old Tusk. It roams the meadows south of the farm. It may be tough alone — be careful!',
  progress: 'Yaşlı Dişli hâlâ ortalıkta.|Old Tusk is still out there.', done: 'Onu gerçekten yendin mi? Efsaneler doğruymuş, sen bir kahramansın!|You actually beat it? The legends are true, you\'re a hero!',
  obj: [{ t: 'kill', m: ['old_tusk'], n: 1 }], rew: { xp: 1.2, gold: 15, choice: [{ slot: 'trinket', rarity: 'rare' }, { slot: 'cape', rarity: 'rare' }] } });
Q('q_meat', { zone: 'vale', lvl: 3, giver: 'innkeeper', name: 'Hanın Kileri|The Inn\'s Larder',
  text: 'Kilerim bomboş! Akşam yemeği için 6 Çiğ Et lazım. Domuzlar ve kurtlar iyi et verir. Getirirsen sana yemek pişirmeyi öğretirim.|My larder is empty! I need 6 Raw Meat for supper. Boars and wolves give good meat. Bring them and I\'ll teach you to cook.',
  progress: 'Et getirdin mi?|Did you bring the meat?', done: 'Mükemmel! Şimdi seni Aşçılık\'ta eğitebilirim.|Perfect! Now I can train you in Cooking.',
  obj: [{ t: 'have', item: 'meat', n: 6 }], rew: { xp: 0.7, gold: 6, unlock: 'cooking', items: [{ id: 'food2', qty: 3 }] } });
Q('q_spiders', { zone: 'vale', lvl: 4, giver: 'captain', name: 'Ağlı Koru|Webwood Grove',
  text: 'Doğudaki Ağlı Koru\'da örümcekler çoğaldı. Tüccarların yolunu kesiyorlar. 8 Orman Örümceği öldür ve Tüccar Selim için 5 Örümcek İpeği topla.|Spiders have multiplied in Webwood Grove to the east. They\'re ambushing merchants. Kill 8 Forest Spiders and gather 5 Spider Silk for Selim the Merchant.',
  progress: 'Örümcekler hâlâ yolları tutuyor.|The spiders still hold the roads.', done: 'Yollar temizlendi. Selim ipek için çok sevinecek!|The roads are clear. Selim will be thrilled about the silk!',
  obj: [{ t: 'kill', m: ['spider_forest'], n: 8 }, { t: 'have', item: 'silk', n: 5 }], rew: { xp: 1.0, gold: 9, choice: [{ slot: 'legs', rarity: 'uncommon' }, { slot: 'shoulders', rarity: 'uncommon' }] } });
Q('q_bandits', { zone: 'vale', lvl: 6, giver: 'captain', name: 'Haydut Belası|Bandit Trouble',
  text: 'Batıdaki eski harabelerde bir haydut çetesi yerleşti. Kervanları soyuyorlar. 8 haydut ve 3 okçu ile işini bitir.|A gang of bandits has settled in the old ruins to the west. They\'re robbing caravans. Finish off 8 bandits and 3 archers.',
  progress: 'Haydutlar hâlâ sığınaklarında.|The bandits are still in their hideout.', done: 'Yolcular artık daha güvende. Ama liderleri Kara Murat hâlâ kayıp...|Travellers are safer now. But their leader, Kara Murat, is still at large...',
  obj: [{ t: 'kill', m: ['bandit'], n: 8 }, { t: 'kill', m: ['bandit_archer'], n: 3 }], rew: { xp: 1.0, gold: 12, choice: [{ slot: 'head', rarity: 'uncommon' }, { slot: 'ring', rarity: 'uncommon' }] } });
Q('q_kara_murat', { zone: 'vale', lvl: 9, giver: 'captain', prev: 'q_bandits', name: 'Kara Murat|Kara Murat',
  text: 'Kara Murat, haydutların acımasız lideri. Sığınağın en derin köşesinde saklanıyor. O bir elit savaşçı; yanına yoldaş almanı tavsiye ederim.|Kara Murat is the ruthless leader of the bandits. He hides in the deepest corner of the hideout. He\'s an elite fighter — I advise bringing companions.',
  progress: 'Kara Murat hâlâ yaşıyor.|Kara Murat still lives.', done: 'Kara Murat\'ın sonu geldi! Aydınköy sana minnettar.|Kara Murat has met his end! Dawnhollow is in your debt.',
  obj: [{ t: 'kill', m: ['bandit_chief'], n: 1 }], rew: { xp: 1.4, gold: 25, choice: [{ slot: 'main', rarity: 'rare' }, { slot: 'off', rarity: 'rare' }, { slot: 'chest', rarity: 'rare' }] } });
Q('q_herbs', { zone: 'vale', lvl: 2, giver: 'alchemist', name: 'Şifalı Otlar|Healing Herbs',
  text: 'Şifa iksirleri için Barış Çiçeği lazım. Vadide pembe çiçekli bitkiler göreceksin; yanlarına gidip topla. Sana bitkiciliği öğretiyorum, 6 tane getir.|I need Peacebloom for healing potions. You\'ll see plants with pink flowers around the vale — walk up and gather them. I\'m teaching you herbalism; bring me 6.',
  progress: 'Barış Çiçeklerini topladın mı?|Have you gathered the Peacebloom?', done: 'Ne güzel kokuyorlar! Al, ilk iksirlerini ben hediye ediyorum.|They smell wonderful! Here, your first potions are on me.',
  obj: [{ t: 'gather', node: 'herb1', n: 6 }], accept: { unlock: 'herbalism' }, rew: { xp: 0.7, gold: 5, unlock: 'alchemy', items: [{ id: 'hp1', qty: 5 }, { id: 'mp1', qty: 3 }] } });
Q('q_ore', { zone: 'vale', lvl: 3, giver: 'smith', name: 'Demirciye Yardım|Helping the Smith',
  text: 'Ocağım soğuyor, bakır lazım! Tepelerdeki turuncu damarlı kayalardan 6 Bakır Cevheri kaz. Kazmayı ben veriyorum.|My forge is going cold — I need copper! Mine 6 Copper Ore from the orange-veined rocks in the hills. I\'ll lend you a pickaxe.',
  progress: 'Cevherler nerede?|Where\'s the ore?', done: 'İşte bu! Şimdi sana demircilik öğretebilirim.|That\'s the stuff! Now I can teach you blacksmithing.',
  obj: [{ t: 'gather', node: 'ore1', n: 6 }], accept: { unlock: 'mining' }, rew: { xp: 0.7, gold: 6, unlock: 'smithing', items: [{ id: 'enhance_stone', qty: 2 }] } });
Q('q_fish', { zone: 'vale', lvl: 2, giver: 'fisher', name: 'İlk Avım|My First Catch',
  text: 'Ayna Gölü balık kaynıyor! Al şu oltayı. Su kenarında, kabarcıkların çıktığı yere git ve balık tut. Şamandıra batınca hemen çek! 5 Gümüş Sazan getir.|Mirror Lake is teeming with fish! Take this rod. Go to the water\'s edge where bubbles rise and fish. Reel in as soon as the bobber dips! Bring 5 Silver Carp.',
  progress: 'Hiç balık tutamadın mı?|Haven\'t caught anything yet?', done: 'Doğuştan balıkçısın! Bu tarifi al, balık çorbası hem doyurur hem güç verir.|A natural! Take this recipe — fish stew fills you up and gives strength.',
  obj: [{ t: 'have', item: 'fish1', n: 5 }], accept: { unlock: 'fishing' }, rew: { xp: 0.6, gold: 5, items: [{ id: 'food2', qty: 5 }] } });
Q('q_ring', { zone: 'vale', lvl: 4, giver: 'widow', name: 'Kayıp Yüzük|The Lost Ring',
  text: 'Rahmetli kocamın yüzüğü... Ayna Gölü\'nün kuzeybatı kıyısında, eski söğüdün yanında düşürmüş olmalıyım. Bulursan çok mutlu olurum evladım.|My late husband\'s ring... I must have dropped it on the northwest shore of Mirror Lake, by the old willow. I\'d be so happy if you found it, dear.',
  progress: 'Yüzüğümü bulabildin mi?|Were you able to find my ring?', done: 'Bu o! Allah razı olsun evladım. Al, bu tılsım kocamındı, sana uğur getirsin.|That\'s it! Bless you, dear. Take this charm — it was my husband\'s, may it bring you luck.',
  obj: [{ t: 'interact', obj: 'qo_ring', n: 1 }], rew: { xp: 0.8, gold: 8, choice: [{ slot: 'trinket', rarity: 'rare' }] } });
Q('q_cemetery', { zone: 'vale', lvl: 8, giver: 'gravekeeper', name: 'Huzursuz Ölüler|The Restless Dead',
  text: 'Kristalin karanlık enerjisi ölüleri uyandırdı. Mezarlıkta dolaşan 10 İskelet Savaşçı ve 4 İskelet Büyücüyü toprağa geri gönder.|The crystal\'s dark energy has woken the dead. Send back to the earth 10 Skeleton Warriors and 4 Skeleton Mages roaming the cemetery.',
  progress: 'Ölüler hâlâ yürüyor...|The dead still walk...', done: 'Sessizlik geri döndü. Teşekkürler, ruhlar artık huzurlu.|Silence has returned. Thank you — the spirits are at peace.',
  obj: [{ t: 'kill', m: ['skeleton'], n: 10 }, { t: 'kill', m: ['skeleton_mage'], n: 4 }], rew: { xp: 1.0, gold: 14, choice: [{ slot: 'legs', rarity: 'rare' }, { slot: 'head', rarity: 'rare' }] } });
Q('q_warden', { zone: 'vale', lvl: 10, giver: 'gravekeeper', prev: 'q_cemetery', name: 'Mezar Bekçisi|The Grave Warden',
  text: 'Tapınak harabesinde Mezar Bekçisi uyandı; eski bir şövalyenin lanetli ruhu. O durdurulmazsa ölüler yeniden kalkacak.|The Grave Warden has awoken in the temple ruins — the cursed spirit of an ancient knight. Unless he\'s stopped, the dead will rise again.',
  progress: 'Mezar Bekçisi hâlâ nöbette.|The Grave Warden still keeps his vigil.', done: 'Lanet kırıldı. Bu kılıç onundu; artık senin.|The curse is broken. This was his — now it is yours.',
  obj: [{ t: 'kill', m: ['grave_warden'], n: 1 }], rew: { xp: 1.4, gold: 25, choice: [{ slot: 'main', rarity: 'rare' }, { slot: 'shoulders', rarity: 'rare' }, { slot: 'ring', rarity: 'rare' }] } });
Q('q_explore', { zone: 'vale', lvl: 3, giver: 'scout', name: 'Vadiyi Keşfet|Explore the Vale',
  text: 'İyi bir maceracı toprağını tanır. Değirmen Çiftliği\'ni, Ayna Gölü\'nü, Eski Mezarlık\'ı ve Haydut Sığınağı\'nı ziyaret et. Haritan (M) sana yol gösterecek.|A good adventurer knows the land. Visit Millbrook Farm, Mirror Lake, the Old Cemetery and the Bandit Hideout. Your map (M) will guide you.',
  progress: 'Hâlâ görmediğin yerler var.|There are places you haven\'t seen.', done: 'Artık vadiyi benim kadar iyi tanıyorsun!|Now you know the vale as well as I do!',
  obj: [{ t: 'explore', poi: 'p_farm' }, { t: 'explore', poi: 'p_lake' }, { t: 'explore', poi: 'p_cemetery' }, { t: 'explore', poi: 'p_bandit' }], rew: { xp: 1.0, gold: 8 } });
Q('q_mount', { zone: 'vale', lvl: 8, giver: 'stablemaster', name: 'Kendi Atın|A Horse of Your Own',
  text: 'Bu kadar yolu yürüyerek mi gideceksin? Ahırımdaki taylardan biri sana alıştı. Onu Değirmen Çiftliği\'ne götürüp Çiftçi Mehmet\'e göster, o da onaylarsa at senindir!|Will you walk all those roads? One of the foals in my stable has taken to you. Show it to Farmer Mehmet at Millbrook Farm — if he approves, the horse is yours!',
  progress: 'Mehmet\'e gittin mi?|Have you been to Mehmet?', done: 'Güzel bir hayvan! Sağlıklı ve güçlü. Atın hayırlı olsun! (T tuşu / binek butonu ile bin)|A fine animal! Healthy and strong. Enjoy your horse! (Ride with T / the mount button)',
  obj: [{ t: 'talk', npc: 'farmer' }], turnin: 'farmer', rew: { xp: 0.5, gold: 0, unlock: 'mount_horse' } });
Q('q_slime_king', { zone: 'vale', lvl: 10, giver: 'priestess', repeat: 'daily', name: 'Balçık Kral (Dünya Patronu)|The Slime King (World Boss)',
  text: 'Belirli aralıklarla Ayna Gölü\'nün güneyinde dev bir balçık beliriyor: Balçık Kral! Diğer maceracılarla birlikte onu yen. Bu görev her gün yenilenir.|Every so often a giant slime appears south of Mirror Lake: the Slime King! Defeat it together with other adventurers. This quest renews daily.',
  progress: 'Balçık Kral\'ın ortaya çıkmasını bekle. Harita bir sonraki doğuşu gösterir.|Wait for the Slime King to appear. The map shows the next spawn.', done: 'Muhteşem bir zafer! Işık seni ödüllendiriyor.|A magnificent victory! The Light rewards you.',
  obj: [{ t: 'kill', m: ['slime_king'], n: 1 }], rew: { xp: 1.0, gold: 30, items: [{ id: 'chest_boss', qty: 1 }] } });

export const QUEST_OBJECTS = {
  qo_goblin_chest: { zone: 'vale', x: 60, z: -104, model: 'chest', label: 'Parlayan Sandık|Glowing Chest', quest: 'q_shard', glow: 0x6ad8ff },
  qo_ring: { zone: 'vale', x: -112, z: 12, model: 'sparkle', label: 'Parıldayan Bir Şey|Something Glittering', quest: 'q_ring', glow: 0xffe08a },
};

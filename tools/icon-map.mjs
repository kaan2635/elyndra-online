// Maps the game's icon names to game-icons.net glyphs (CC BY 3.0, see assets/CREDITS.md).
// tools/build-icons.mjs downloads these SVGs and packs their path data into assets/icons.json.
export const ICON_MAP = {
  // weapons & armour
  sword: 'lorc/broadsword', greatsword: 'lorc/relic-blade', axe: 'lorc/battle-axe', mace: 'delapouite/flanged-mace', hammer: 'delapouite/warhammer', dagger: 'lorc/plain-dagger',
  staff: 'lorc/wizard-staff', wand: 'lorc/fairy-wand', bow: 'lorc/pocket-bow', crossbow: 'carl-olsen/crossbow', shield: 'sbed/shield', orb: 'lorc/crystal-ball', tome: 'delapouite/spell-book',
  helmet: 'lorc/visored-helm', shoulders: 'delapouite/shoulder-armor', chest: 'lorc/breastplate', gloves: 'delapouite/gloves', boots: 'lorc/leather-boot', pants: 'lorc/trousers',
  belt: 'lucasms/belt', cape: 'delapouite/cape', ring: 'delapouite/diamond-ring', ring2: 'skoll/big-diamond-ring', ruby_ring: 'skoll/big-diamond-ring', trinket: 'lorc/gem-pendant', mail: 'willdabeast/chain-mail', leather: 'delapouite/animal-hide',
  // consumables & materials
  potion_red: 'delapouite/health-potion', potion_blue: 'delapouite/magic-potion', potion_green: 'lorc/potion-ball', potion_purple: 'lorc/bubbling-flask', elixir: 'lorc/round-bottom-flask', health: 'delapouite/health-potion', mana: 'delapouite/magic-potion',
  food: 'lorc/meat', bread: 'lorc/sliced-bread', fish: 'delapouite/circling-fish', ore: 'faithtoken/ore', gem: 'lorc/emerald', crystal: 'lorc/crystal-growth', herb: 'delapouite/herbs-bundle', mushroom: 'lorc/mushroom-gills', flower: 'delapouite/flower-emblem',
  log: 'delapouite/wood-pile', plank: 'delapouite/wooden-crate', cloth: 'delapouite/rolled-cloth', bone: 'lorc/broken-bone', fang: 'lorc/bestial-fangs', feather: 'lorc/feather', essence: 'lorc/magic-swirl', dust: 'lorc/powder',
  scroll: 'lorc/scroll-unfurled', map: 'lorc/treasure-map', key: 'delapouite/house-keys', chest_box: 'lorc/locked-chest', bag: 'lorc/swap-bag', backpack: 'delapouite/backpack', coin: 'delapouite/two-coins', coins: 'delapouite/coins', token: 'lorc/laurel-crown',
  // magic & combat
  flame: 'carl-olsen/flame', fireball: 'lorc/fireball', meteor: 'lorc/meteor-impact', snowflake: 'lorc/snowflake-2', ice_shard: 'lorc/ice-spear', frost_nova: 'lorc/ice-bolt', lightning: 'lorc/lightning-helix', arcane_star: 'lorc/star-swirl',
  arcane_missiles: 'lorc/missile-swarm' , blink: 'lorc/teleport', holy_cross: 'lorc/holy-symbol', sun: 'lorc/sun', halo: 'lorc/angel-outfit', heal_hand: 'delapouite/healing', heart: 'skoll/hearts', shield_glow: 'lorc/magic-shield',
  barrier: 'lorc/bolt-shield', renew: 'sbed/regeneration', skull: 'lorc/skull-crack', death_coil: 'lorc/death-zone', poison_drop: 'lorc/poison-bottle', dagger_throw: 'lorc/thrown-daggers', smoke: 'darkzaitzev/smoke-bomb', eye: 'delapouite/eye-target',
  stealth: 'lorc/hood', arrow: 'lorc/arrow-flights', multi_arrows: 'lorc/striking-arrows', rain_arrows: 'lorc/arrow-cluster', paw: 'lorc/paw', wolf: 'lorc/wolf-howl', raven: 'lorc/raven', bone_spear: 'lorc/spiked-tail', ghost: 'lorc/ghost',
  fist: 'lorc/fist', whirlwind: 'lorc/spinning-sword', charge: 'delapouite/charging-bull', taunt: 'lorc/shouting', war_cry: 'lorc/screaming', slash: 'lorc/sword-slice', cleave: 'lorc/axe-swing', bleed: 'lorc/bleeding-wound', stun: 'skoll/knockout',
  sprint: 'lorc/sprint', mark: 'lorc/target-arrows', tornado: 'lorc/tornado', earthquake: 'lorc/earth-spit', moon: 'lorc/moon', star: 'lorc/staryu', blood_drop: 'lorc/drop', soul: 'delapouite/soul-vessel', drain: 'delapouite/vampire-dracula',
  explosion: 'lorc/explosion-rays', rage: 'delapouite/enrage', chains: 'lorc/crossed-chains', trap: 'lorc/wolf-trap', net: 'lorc/fishing-net', vines: 'lorc/vine-whip', summon: 'skoll/pentacle', crit: 'lorc/crossed-slashes', flex: 'delapouite/biceps',
  // ui & world
  crown: 'lorc/crown', skull_crown: 'lorc/crowned-skull', trophy: 'lorc/trophy', banner: 'lorc/flying-flag', sword_cross: 'lorc/crossed-swords', map_marker: 'delapouite/position-marker', compass: 'lorc/compass', gear: 'lorc/cog',
  quest_exclaim: 'delapouite/scroll-quill', quest_question: 'sbed/help', chat: 'skoll/talk', users: 'lorc/backup', guild: 'lorc/castle', hammer_anvil: 'lorc/anvil-impact', anvil: 'lorc/anvil',
  pickaxe: 'delapouite/war-pick', axe_tool: 'lorc/wood-axe', fishing_rod: 'delapouite/fishing-pole', sickle: 'delapouite/sickle', horse: 'delapouite/horse-head', tower: 'delapouite/castle', house: 'delapouite/house', scales: 'lorc/scales',
  lock: 'lorc/padlock', plus: 'badges/plus', close: 'sbed/cancel', check: 'delapouite/check-mark', info: 'delapouite/info', bell: 'lorc/ringing-bell', gift: 'delapouite/present', hourglass: 'lorc/hourglass', dice: 'delapouite/rolling-dices',
  person: 'delapouite/person', campfire: 'lorc/campfire', cauldron: 'lorc/cauldron', cooking_pot: 'delapouite/cooking-pot', sparkles: 'delapouite/sparkles', arrow_up: 'delapouite/plain-arrow', book_open: 'lorc/book-cover', talent: 'delapouite/upgrade',
  dungeon: 'delapouite/dungeon-gate', portal: 'lorc/magic-portal', create: 'lorc/hammer-nails', title: 'delapouite/scroll-quill', primary: 'delapouite/star-formation', select: 'skoll/click', rain: 'lorc/heavy-rain', feather2: 'lorc/feather',
  st: 'lorc/battle-gear', sec: 'delapouite/sparkles', rare: 'lorc/cut-diamond', uncommon: 'lorc/emerald', red: 'lorc/drop', none: 'sbed/cancel',
  __unknown: 'lorc/rune-stone',
};

// Visual "looks": which 3D asset (see gfx/gmodel.js ASSETS) and dressing each creature uses.
// Monsters are listed explicitly; humanoid NPC/hero specs are resolved from race + gear.
// A missing look falls back to the procedural builder (used for elementals and a few magical beings).

const M = (a, o = {}) => ({ a: 'mob:' + a, ...o });
const C = (a, o = {}) => ({ a: 'char:' + a, ...o });

export const MONSTER_LOOKS = {
  // critters
  rabbit: M('bunny', { scale: 0.55, tint: 0xc8a888, tintAmt: 0.35 }), deer: M('deer'), sheep: M('sheep'), fox: M('fox'),
  crab: M('crab', { scale: 0.6 }), penguin: M('bunny', { scale: 0.55, tint: 0xf8f8ff, tintAmt: 0.6 }), scarab: M('crab', { scale: 0.45, tint: 0x2a5a6a, tintAmt: 0.7 }),
  // zone 1
  slime: M('slime', { tint: 0x6ad04a, tintAmt: 0.6 }), slime_blue: M('slime', { tint: 0x4aa8e8, tintAmt: 0.65 }),
  boar: M('bull', { scale: 0.62, tint: 0x5a3a2a, tintAmt: 0.55 }), wolf: M('wolf'), spider_forest: M('spider', { tint: 0x5a3a24, tintAmt: 0.4 }),
  goblin: M('orc', { scale: 0.72 }), goblin_spear: M('orc', { scale: 0.72, tint: 0x8aa04a, tintAmt: 0.2 }), goblin_shaman: M('orc', { scale: 0.72, tint: 0x7a5aa8, tintAmt: 0.25 }),
  goblin_brute: M('orc', { scale: 1.05 }), grukk: M('orc', { scale: 1.55, tint: 0xd8b04a, tintAmt: 0.2 }),
  bandit: C('rogue', { outfit: 8, outfitSat: 0.9, r: '1h_sword' }), bandit_archer: C('rogue_hooded', { outfit: 25, outfitSat: 0.6, dark: 0.15, r: '2h_crossbow' }),
  bandit_chief: C('barbarian', { scale: 1.2, outfit: 0, dark: 0.1, r: '2h_axe' }),
  skeleton: C('skeleton_warrior', { r: 'skeleton_blade', l: 'skeleton_shield_small_a', glow: 0x6af0ff }), skeleton_mage: C('skeleton_mage', { r: 'skeleton_staff', glow: 0x6ad8ff }),
  old_tusk: M('bull', { scale: 0.95, tint: 0x4a3020, tintAmt: 0.65 }), greyclaw: M('wolf', { scale: 1.55, tint: 0xc8c8d0, tintAmt: 0.5 }),
  grave_warden: C('skeleton_warrior', { scale: 1.3, r: 'skeleton_axe', l: 'skeleton_shield_large_a', glow: 0x6af0ff }),
  slime_king: M('slime', { scale: 3.6, tint: 0x5ad04a, tintAmt: 0.55 }), cave_bat: M('bat'),
  // zone 2
  wisp: M('ghost', { scale: 0.55, tint: 0x8affc8, tintAmt: 0.75, emissive: 0x2a8a5a, emissiveI: 0.8, opacity: 0.8 }),
  treant_small: M('yeti', { scale: 0.75, tint: 0x5a4a2a, tintAmt: 0.75 }), spider_giant: M('spider', { scale: 1.4, tint: 0x3a2a4a, tintAmt: 0.55 }),
  bear: M('yeti', { scale: 0.85, tint: 0x6a4a30, tintAmt: 0.75 }), shadow_wolf: M('wolf', { scale: 1.12, tint: 0x2a2a3a, tintAmt: 0.8, emissive: 0x2a0a4a, emissiveI: 0.5 }),
  druid: C('mage', { outfit: 115, outfitSat: 0.8, dark: 0.15, skin: 0xa894c8, r: '2h_staff', hat: false }),
  mushroom_man: M('mushroom', { scale: 0.8 }), swamp_witch: C('mage', { outfit: 95, dark: 0.35, skin: 0x6a8a5a, r: '2h_staff' }),
  elder_treant: M('yeti', { scale: 1.4, tint: 0x4a3a20, tintAmt: 0.8 }), moonclaw: M('yeti', { scale: 1.25, tint: 0xe0e4f0, tintAmt: 0.6, emissive: 0x1a3a5a, emissiveI: 0.4 }),
  forest_guardian: M('yeti', { scale: 2.1, tint: 0x3a2a1a, tintAmt: 0.8, emissive: 0x3a0a5a, emissiveI: 0.4 }),
  broodling: M('spider', { scale: 0.65, tint: 0x4a2a4a, tintAmt: 0.5 }), spider_weaver: M('spider', { scale: 1.2, tint: 0xd8d8e0, tintAmt: 0.6 }),
  zeyra: M('spider', { scale: 3.2, tint: 0x6a1a5a, tintAmt: 0.6, emissive: 0x3a0a2a, emissiveI: 0.4 }),
  // zone 3
  scorpion: M('spider', { tint: 0xb88a4a, tintAmt: 0.7 }), lizard: M('snake', { scale: 1.5, tint: 0xc8a868, tintAmt: 0.6 }),
  mummy: C('skeleton_minion', { tint: 0xd8c8a0, tintAmt: 0.55, glow: 0x6af0ff }), desert_bandit: C('rogue_hooded', { outfit: 38, outfitSat: 0.5, r: '1h_sword' }),
  vulture: M('bat', { scale: 1.35, tint: 0x5a4a3a, tintAmt: 0.6 }), croc: M('snake', { scale: 2.4, tint: 0x3a5a2a, tintAmt: 0.7 }),
  cultist: C('mage', { outfit: 2, outfitSat: 1.1, dark: 0.2, r: '2h_staff' }), sandworm: M('snake', { scale: 4.2, tint: 0xc8a868, tintAmt: 0.7 }),
  scarab_beetle: M('crab', { scale: 0.8, tint: 0x2a5a6a, tintAmt: 0.7 }), tomb_guard: C('skeleton_warrior', { scale: 1.3, tint: 0xd8c8a0, tintAmt: 0.45, r: 'skeleton_axe', glow: 0x6af0ff }),
  anuket: C('skeleton_mage', { scale: 1.9, tint: 0xe8c860, tintAmt: 0.45, r: 'skeleton_staff', glow: 0x6af0ff }),
  // zone 4
  frost_wolf: M('wolf', { tint: 0xeef4fa, tintAmt: 0.7 }), yeti: M('yeti'), frost_giant: C('barbarian', { scale: 1.55, skin: 0x8ab0d8, outfit: 205, outfitSat: 0.5, r: '2h_axe' }),
  ice_troll: M('orc', { scale: 1.2, tint: 0x6a9ab8, tintAmt: 0.6 }), mammoth: M('bull', { scale: 1.6, tint: 0x5a3a2a, tintAmt: 0.65 }), frost_bat: M('bat', { tint: 0x8ab0d8, tintAmt: 0.6 }),
  snow_titan: C('barbarian', { scale: 2.3, skin: 0x8ab0d8, outfit: 205, outfitSat: 0.6, r: '2h_axe' }), frostfang_alpha: M('wolf', { scale: 1.7, tint: 0xf8f8ff, tintAmt: 0.75, emissive: 0x0a2a4a, emissiveI: 0.4 }),
  frost_dwarf: C('knight', { scale: 0.86, sx: 1.15, skin: 0x9ab8d8, outfit: 205, r: 'hammer', l: 'round_shield' }), frost_wyrm: M('dragon', { scale: 1.25, tint: 0x8ab8e0, tintAmt: 0.65 }),
  // zone 5
  imp: M('imp'), salamander: M('snake', { scale: 1.5, tint: 0xd8501a, tintAmt: 0.7, emissive: 0x501000, emissiveI: 0.6 }),
  lava_golem: M('yeti', { scale: 0.95, tint: 0x2a2220, tintAmt: 0.85, emissive: 0x6a1a00, emissiveI: 0.7 }), hellhound: M('wolf', { scale: 1.2, tint: 0x2a1010, tintAmt: 0.8, emissive: 0x6a1400, emissiveI: 0.6 }),
  demon: M('demon'), magma_slime: M('slime', { tint: 0xff6a1a, tintAmt: 0.7, emissive: 0x6a2000, emissiveI: 0.8 }),
  magma_titan: M('yeti', { scale: 2.2, tint: 0x1a1210, tintAmt: 0.85, emissive: 0x8a2a00, emissiveI: 0.8 }), pyrelord: M('demon', { scale: 1.45, tint: 0xff6a1a, tintAmt: 0.35, emissive: 0x4a1000, emissiveI: 0.5 }),
  demon_guard: M('demon', { scale: 1.1, tint: 0x6a1010, tintAmt: 0.45 }), infernus: M('demon', { scale: 2.3, tint: 0xc8301a, tintAmt: 0.35, emissive: 0x5a1000, emissiveI: 0.6 }),
  // zone 6
  wraith: M('ghost', { tint: 0x5a5a8a, tintAmt: 0.5, opacity: 0.85 }), ghoul: M('zombie'), shadow_fiend: M('imp', { scale: 1.3, tint: 0x5a2a8a, tintAmt: 0.65 }),
  death_knight: C('skeleton_warrior', { tint: 0x3a3a4a, tintAmt: 0.55, r: 'skeleton_blade', l: 'skeleton_shield_large_b', glow: 0x6ad8ff }),
  void_eye: M('tentacle', { tint: 0x6a3a8a, tintAmt: 0.5, emissive: 0x2a0a4a, emissiveI: 0.5 }),
  malakar_cultist: C('mage', { outfit: 275, dark: 0.3, skin: 0xa894c8, r: '2h_staff' }), bone_dragon: M('dragon', { scale: 1.0, tint: 0xd8d0b8, tintAmt: 0.75 }),
  ossyrion: M('dragon', { scale: 1.7, tint: 0xe8e0c8, tintAmt: 0.75, emissive: 0x2a0a4a, emissiveI: 0.3 }),
  vorath: C('skeleton_mage', { scale: 1.8, r: 'skeleton_staff', glow: 0x6ad8ff, tint: 0x8ab0e8, tintAmt: 0.25 }),
  malakar: C('knight', { scale: 2.5, outfit: 275, dark: 0.45, skin: 0x8a7aaa, r: '2h_sword', emissive: 0x2a0a3a, emissiveI: 0.35 }),
  // allies
  pet_wolf: M('wolf', { tint: 0x8a8a90, tintAmt: 0.3 }), pet_skeleton: C('skeleton_minion', { r: 'skeleton_blade', glow: 0x6af0ff }),
  guard: C('knight', { outfit: 220, r: '1h_sword', l: 'badge_shield' }),
};

// mounts (see game/mounts.js) — key by mount id or kind
export const MOUNT_LOOKS = { horse: M('horse'), horse_white: M('horse_white'), stag: M('stag'), wolf: M('wolf', { scale: 1.6 }), alpaca: M('alpaca'), donkey: M('donkey'), bull: M('bull') };

// ------------------------------------------------------------------ humanoid resolver
const CLASS_BODY = { warrior: 'knight', mage: 'mage', ranger: 'rogue_hooded', cleric: 'knight', rogue: 'rogue', necro: 'mage' };
export const CLASS_OUTFIT = { warrior: null, mage: null, ranger: null, rogue: null, cleric: { outfit: 44, outfitSat: 0.75 }, necro: { outfit: 272, dark: 0.4 } };
const RACE_SHAPE = { human: {}, elf: { scale: 1.03 }, dwarf: { scale: 0.86, sx: 1.16 }, orc: { scale: 1.07, sx: 1.06 }, giant: { scale: 1.5 } };
const WEAPON_R = { sword: '1h_sword', greatsword: '2h_sword', axe: '1h_axe', club: '1h_axe', mace: 'hammer', hammer: 'hammer', dagger: 'knife', staff: '2h_staff', wand: '1h_wand', bow: null, crossbow: '2h_crossbow', scythe: 'scythe', spear: 'spear' };
const WEAPON_L = { shield: 'round_shield', kite: 'badge_shield', tome: 'spellbook', book: 'spellbook', orb: 'orb', dagger: 'knife_offhand', sword: '1h_sword_offhand', axe: '1h_axe_offhand' };

const hexHSL = c => { const r = ((c >> 16) & 255) / 255, g = ((c >> 8) & 255) / 255, b = (c & 255) / 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn; let h = 0, s = 0; if (d) { s = d / (1 - Math.abs(2 * l - 1)); h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h *= 60; if (h < 0) h += 360; } return [h, s, l]; };

export function humanoidLook(spec) {
  const g = spec.gear || {};
  const race = spec.race || 'human';
  if (race === 'skeleton') return C(g.main?.m === 'staff' ? 'skeleton_mage' : 'skeleton_warrior', { r: g.main?.m === 'staff' ? 'skeleton_staff' : 'skeleton_blade', glow: spec.feat?.glowEyes ?? 0x6af0ff, scale: spec.scale });
  if (race === 'goblin') return M('orc', { scale: 0.72 * (spec.scale || 1) });
  if (race === 'imp') return M('imp', { scale: spec.scale });
  const chest = g.chest?.m;
  let body = spec.cls ? CLASS_BODY[spec.cls] : null;
  if (!body) body = race === 'giant' || race === 'orc' && !chest ? 'barbarian' : chest === 'robe' ? 'mage' : chest === 'plate' || chest === 'mail' ? 'knight' : chest === 'leather' ? (g.head?.m === 'hood' ? 'rogue_hooded' : 'rogue') : 'rogue';
  const look = C(body, { ...(RACE_SHAPE[race] || {}) });
  if (spec.scale) look.scale = (look.scale || 1) * spec.scale;
  if (spec.skin != null) look.skin = spec.skin;
  // headgear: knights/barbarians show the helmet only when a helmet is worn; mages show the hat unless hidden
  const hm = g.head?.m;
  look.hat = spec.hat === false ? false : body === 'mage' ? (spec.cls ? true : hm === 'hat' || hm === 'hood') : body === 'knight' ? (spec.cls ? spec.cls !== 'cleric' || !!hm : hm === 'helm' || hm === 'horned') : true;
  if (body === 'rogue' && !spec.cls && chest !== 'leather') look.cape = false;
  if (spec.cape === false) look.cape = false;
  // outfit colour
  if (spec.outfit != null) { look.outfit = spec.outfit; if (spec.outfitSat != null) look.outfitSat = spec.outfitSat; if (spec.outfitDark) look.dark = spec.outfitDark; }
  else if (spec.cls && CLASS_OUTFIT[spec.cls]) Object.assign(look, CLASS_OUTFIT[spec.cls]);
  else if (!spec.cls && g.chest?.c != null) { const [h, s, l] = hexHSL(g.chest.c); if (s > 0.15) { look.outfit = h; look.outfitSat = Math.min(1.2, s * 1.3); look.dark = Math.max(0, 0.45 - l) * 0.9; } }
  // weapons
  const mm = g.main?.m, om = g.off?.m;
  if (mm === 'bow') look.l = 'bow'; else look.r = WEAPON_R[mm] || null;
  if (om) look.l = om === 'shield' && g.off?.shape === 'kite' ? 'badge_shield' : WEAPON_L[om] || null;
  return look;
}

/** Look for any model spec; null means "use the procedural model". */
export function resolveLook(spec) {
  if (!spec) return null;
  if (spec.look) return spec.look;
  if (spec.mob && MONSTER_LOOKS[spec.mob]) return MONSTER_LOOKS[spec.mob];
  if (spec.rig === 'humanoid' || !spec.rig) return humanoidLook(spec);
  return null;
}

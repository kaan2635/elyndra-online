// Builds the recorded audio used on top of the procedural engine (js/audio.js):
// trims / normalises / encodes the itch.io sound packs cached in tools/_src/itch and writes
// assets/audio/{sfx,music,amb}/*.mp3 plus assets/audio/manifest.json.
// Run: node tools/build-audio.mjs   (needs ffmpeg + ffprobe on PATH)
// Sources & licences are listed in assets/CREDITS.md.
import fs from 'fs';
import path from 'path';
import { execFileSync, spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'tools/_src/itch');
const OUT = path.join(ROOT, 'assets/audio');

const C = 'heyheythere/combat/medieval-combat-sfx-free/OGG';
const U = 'heyheythere/ui/fantasy-ui-sfx-free/OGG';
const S = 'heyheythere/steps/footsteps-sfx-free/OGG';
const SR = 'soundrack/swords/Swords & Blades';
const AR = 'soundrack/archery/Archery';
const LB = 'lentikula/basic', LD = 'lentikula/druid', LH = 'lentikula/healing/Impacts';
const VW = 'voices/warrior/Warrior Pack', VM = 'voices/mage/Mage Pack', VO = 'voices/orc/Orc Pack';
const AB = 'abstraction/sel';

// list files in a folder matching a regex (sorted, optionally limited)
const pick = (dir, re = /./, n = 99) => fs.readdirSync(path.join(SRC, dir)).filter(f => re.test(f) && /\.(wav|ogg|flac)$/i.test(f)).sort((a, b) => a.localeCompare(b, 'en', { numeric: true })).slice(0, n).map(f => dir + '/' + f);
const one = (...f) => f;

// name → { src: [files], vol, max (seconds), layer (also play the synth recipe) }
const SFX = {
  ui_click: { src: one(`${U}/clicks/click_wood_01.ogg`, `${U}/clicks/click_stone_01.ogg`), vol: 0.45 },
  ui_hover: { src: one(`${U}/hover/hover_harp_01.ogg`), vol: 0.18 },
  ui_open: { src: one(`${U}/parchment/page_turn_01.ogg`), vol: 0.4 },
  ui_close: { src: one(`${U}/parchment/scroll_open_01.ogg`), vol: 0.25 },
  ui_error: { src: one(`${U}/error/error_01.ogg`), vol: 0.45 },
  ui_tab: { src: one(`${U}/slider/tick_01.ogg`), vol: 0.4 },
  equip: { src: one(`${U}/inventory/equip_armor_01.ogg`), vol: 0.6 },
  unequip: { src: one(`${C}/armor/chainmail_move_01.ogg`), vol: 0.5 },
  coin: { src: one(`${U}/coins/coin_01.ogg`), vol: 0.5 },
  buy: { src: one(`${U}/coins/coin_01.ogg`), vol: 0.55 },
  sell: { src: one(`${U}/coins/coin_01.ogg`), vol: 0.55 },
  loot: { src: one(`${U}/inventory/pick_up_01.ogg`), vol: 0.5 },
  loot_rare: { src: one(`${U}/notification/notify_01.ogg`), vol: 0.6 },
  loot_legendary: { src: one(`${U}/reward/quest_complete.ogg`), vol: 0.7, layer: true },
  potion: { src: one(`${U}/potions/drink_01.ogg`), vol: 0.7 },
  quest_accept: { src: one(`${U}/notification/quest_new.ogg`), vol: 0.6 },
  quest_complete: { src: one(`${U}/reward/quest_complete.ogg`), vol: 0.7 },
  levelup: { src: one(`${U}/reward/level_up.ogg`), vol: 0.75, layer: true },
  craft_hammer: { src: one(`${C}/forge/anvil_strike_01.ogg`, `${U}/crafting/anvil_01.ogg`), vol: 0.6 },
  enhance_success: { src: one(`${C}/forge/anvil_strike_01.ogg`), vol: 0.6, layer: true },
  gong: { src: one(`${C}/siege/war_horn_01.ogg`), vol: 0.8 },
  draw: { src: one(`${C}/draw/sword_draw_01.ogg`), vol: 0.45 },
  // physical combat
  swing: { src: pick(`${SR}/Sword Whoosh`), vol: 0.5, max: 0.9 },
  swing_heavy: { src: one(`${C}/swings/sword_heavy_swing_01.ogg`, `${C}/swings/axe_swing_01.ogg`), vol: 0.65 },
  hit: { src: [...one(`${C}/impacts/slash_flesh_01.ogg`, `${C}/impacts/stab_flesh_01.ogg`, `${C}/impacts/blunt_hit_01.ogg`, `${C}/impacts/punch_01.ogg`), ...pick(`${SR}/Sword Hit`, /./, 10)], vol: 0.55, max: 0.9 },
  hit_metal: { src: [...one(`${C}/blocks/shield_block_metal_01.ogg`, `${C}/impacts/hit_plate_01.ogg`, `${C}/clashes/sword_parry_01.ogg`), ...pick(`${SR}/Sword Impact`, /./, 5)], vol: 0.55, max: 1.2 },
  crit: { src: [...one(`${C}/clashes/sword_clash_01.ogg`), ...pick(`${SR}/Sword Impact`, /0[5-8]/)], vol: 0.7, max: 1.4, layer: true },
  bow_shot: { src: [...one(`${C}/bows/bow_release_01.ogg`), ...pick(`${AR}/Arrow Whoosh`, /./, 6)], vol: 0.5, max: 1 },
  arrow_hit: { src: [...pick(`${AR}/Arrow Impact`, /./, 12), `${C}/bows/arrow_hit_flesh_01.ogg`], vol: 0.5, max: 0.8 },
  death_monster: { src: one(`${C}/body/body_fall_01.ogg`), vol: 0.6, layer: true },
  // magic impacts
  fireball: { src: pick(`${LB}/Fire Spell Impacts`), vol: 0.55, max: 2.2 },
  explosion: { src: pick(`${LB}/Fire Spell Impacts`), vol: 0.7, max: 2.2, layer: true },
  ice_shatter: { src: pick(`${LB}/Ice Spell Impacts`), vol: 0.55, max: 2 },
  lightning: { src: pick(`${LB}/Lightning Spell Impacts`), vol: 0.55, max: 2 },
  heal: { src: pick(LH, /./, 8), vol: 0.45, max: 2.2 },
  poison: { src: pick(`${LD}/Plant Spell Impacts`), vol: 0.5, max: 2 },
  summon: { src: pick(`${LD}/Earth Spell Impacts`), vol: 0.55, max: 2.2 },
  buff: { src: one(`${U}/magic/spell_select_01.ogg`, `${U}/magic/heal_02.ogg`), vol: 0.5 },
  // footsteps (one take each, varied by pitch at runtime)
  step_grass: { src: one(`${S}/ground/walk_grass_01.ogg`, `${S}/ground/walk_leaves_01.ogg`, `${S}/ground/walk_dirt_01.ogg`), vol: 0.3 },
  step_stone: { src: one(`${S}/hard/walk_concrete_02.ogg`, `${S}/hard/walk_tile_01.ogg`, `${S}/hard/walk_marble_01.ogg`), vol: 0.3 },
  step_sand: { src: one(`${S}/ground/walk_sand_01.ogg`, `${S}/ground/walk_gravel_02.ogg`), vol: 0.3 },
  step_snow: { src: one(`${S}/wet/walk_snow_02.ogg`), vol: 0.32 },
  step_wood: { src: one(`${S}/wood/walk_wood_01.ogg`, `${S}/wood/walk_old_wood_01.ogg`), vol: 0.3 },
  step_water: { src: one(`${S}/wet/walk_puddle_01.ogg`, `${S}/wet/walk_wade_01.ogg`), vol: 0.32 },
};
// voices: vo_<w|m|o>_<category>
const VOICE = {
  w: { dir: VW, cats: { attack: /^(attack|lightattack)\d/, heavy: /^heavyattack\d/, hit: /^hit\d/, crit: /^crit\d/, death: /^death\d/, joy: /^(excited|joyous)\d/, hello: /^(hello|welcome)\d/, tired: /^tired\d/ } },
  m: { dir: VM, cats: { attack: /^(attack|lightattack|magicattack)\d/, heavy: /^(fire|thunder|blizzard)\d/, hit: /^hit\d/, crit: /^crit\d/, death: /^death\d/, joy: /^(satisfied|amused)\d/, hello: /^(hello|welcome)\d/, cast: /^casting\d/, summon: /^summoning\d/, tired: /^tired\d/ } },
  o: { dir: VO, cats: { attack: /^(attack|heavyattack)\d/, hit: /^hit\d/, death: /^(death\d|nooo)/, angry: /^(angry|irritated)\d/, laugh: /^laugh\d/ } },
};
for (const [k, v] of Object.entries(VOICE)) for (const [cat, re] of Object.entries(v.cats)) SFX[`vo_${k}_${cat}`] = { src: pick(v.dir, re, 6), vol: 0.55, max: 2.5 };

// music playlists per theme (Abstraction — Music Loop Bundle, CC0)
const T = n => `${AB}/Troubadeck ${n}.ogg`, A = n => `${AB}/${n}.ogg`;
const MUSIC = {
  title: [T('38 Lionheart'), A('The Verdant Grove')],
  town: [T('12 Good King'), T('04 Guinea Pig Jig'), T('24 Royal Blue'), T('36 End of the Rainbow')],
  meadow: [A('The Verdant Grove'), T('20 Long Lonely Road'), T('43 A Quest for Treats'), T('47 Hoof It')],
  forest: [T('26 Sorcerer\'s Spell'), A('Ludum Dare 38 05'), T('45 Esoteric Waterfowl'), A('The Verdant Grove')],
  desert: [T('30 Bandit\'s Ballad'), T('46 Boar\'s Day Out'), T('19 Triangles of Time')],
  snow: [T('23 Soldier\'s Lament'), A('Ludum Dare 32 02'), A('Patreon Challenge 09')],
  volcano: [T('52 The Firey Depths'), T('41 Firecat'), T('51 Height of Power')],
  shadow: [T('16 Cloak of Darkness'), A('Ludum Dare 32 05'), A('Patreon Challenge 01')],
  dungeon: [A('Ludum Dare 38 07'), T('25 Deep Dark Sea'), A('Ludum Dare 30 03'), A('Patreon Challenge 04')],
  boss: [A('Ludum Dare 30 04')],
  arena: [A('Ludum Dare 38 06'), A('Ludum Dare 30 04')],
  home: [T('01 A Simple Snail'), T('40 In My Shell')],
};
// ambience loops (made seamless with a crossfade)
const AMB = {
  rain: { src: 'rain/x/CluckFox - Rain and Thunder/02 - CluckFox - Porch 2.flac', len: 48, xf: 4, vol: 0.7 },
  hearth: { src: `${C}/forge/forge_fire_loop.ogg`, vol: 0.5, raw: true },
};

const slug = f => path.basename(f).replace(/\.[^.]+$/, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
const ff = args => execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], { stdio: ['ignore', 'ignore', 'inherit'] });
function peak(file) {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-i', file, '-af', 'volumedetect', '-f', 'null', '-'], { encoding: 'utf8' });
  const m = /max_volume: (-?[\d.]+) dB/.exec(r.stderr || '');
  return m ? parseFloat(m[1]) : 0;
}

fs.mkdirSync(path.join(OUT, 'sfx'), { recursive: true });
fs.mkdirSync(path.join(OUT, 'music'), { recursive: true });
fs.mkdirSync(path.join(OUT, 'amb'), { recursive: true });
const manifest = { sfx: {}, music: {}, amb: {} };
const done = new Map(); // source → output name (dedupe shared files)
let bytes = 0;

// ---- SFX: trim leading/trailing silence, peak-normalise to -1 dB, mono 44.1 kHz mp3
for (const [name, e] of Object.entries(SFX)) {
  const files = [];
  for (const rel of e.src) {
    const src = path.join(SRC, rel);
    if (!fs.existsSync(src)) { console.warn('missing', rel); continue; }
    const key = rel + '|' + (e.max || 0);
    let out = done.get(key);
    if (!out) {
      out = slug(path.dirname(rel)).slice(-12) + '_' + slug(rel);
      const tmp = path.join(OUT, 'sfx', '_tmp.wav');
      const trim = 'silenceremove=start_periods=1:start_threshold=-55dB,areverse,silenceremove=start_periods=1:start_threshold=-55dB,areverse';
      const af = [trim, e.max ? `atrim=0:${e.max},afade=t=out:st=${Math.max(0, e.max - 0.12)}:d=0.12` : null].filter(Boolean).join(',');
      ff(['-i', src, '-af', af, '-ac', '1', '-ar', '44100', tmp]);
      const gain = Math.min(18, -1 - peak(tmp));
      ff(['-i', tmp, '-af', `volume=${gain.toFixed(2)}dB`, '-vn', '-map_metadata', '-1', '-codec:a', 'libmp3lame', '-b:a', '96k', path.join(OUT, 'sfx', out + '.mp3')]);
      fs.unlinkSync(tmp);
      bytes += fs.statSync(path.join(OUT, 'sfx', out + '.mp3')).size;
      done.set(key, out);
    }
    files.push(out);
  }
  if (files.length) manifest.sfx[name] = { f: files, v: e.vol, ...(e.layer ? { layer: 1 } : {}) };
}

// ---- music: EBU R128 normalised, stereo 96 kbps
const musicDone = new Map();
for (const [theme, list] of Object.entries(MUSIC)) {
  manifest.music[theme] = [];
  for (const rel of list) {
    const src = path.join(SRC, rel);
    if (!fs.existsSync(src)) { console.warn('missing music', rel); continue; }
    let out = musicDone.get(rel);
    if (!out) {
      out = slug(rel);
      ff(['-i', src, '-af', 'loudnorm=I=-19:TP=-1.5:LRA=11', '-ar', '44100', '-ac', '2', '-vn', '-map_metadata', '-1', '-codec:a', 'libmp3lame', '-b:a', '96k', path.join(OUT, 'music', out + '.mp3')]);
      bytes += fs.statSync(path.join(OUT, 'music', out + '.mp3')).size;
      musicDone.set(rel, out);
    }
    manifest.music[theme].push(out);
  }
}

// ---- ambience: seamless loop = body with its head cross-faded into the tail
for (const [name, a] of Object.entries(AMB)) {
  const src = path.join(SRC, a.src), dst = path.join(OUT, 'amb', name + '.mp3');
  if (!fs.existsSync(src)) { console.warn('missing amb', a.src); continue; }
  if (a.raw) ff(['-i', src, '-ac', '1', '-ar', '44100', '-vn', '-map_metadata', '-1', '-codec:a', 'libmp3lame', '-b:a', '80k', dst]);
  else {
    const L = a.len, X = a.xf;
    const fc = `[0:a]atrim=0:${L + X},asetpts=PTS-STARTPTS,aformat=channel_layouts=mono,asplit=3[a][b][c];` +
      `[a]atrim=0:${X},asetpts=PTS-STARTPTS,afade=t=in:d=${X}[head];` +
      `[b]atrim=${L}:${L + X},asetpts=PTS-STARTPTS,afade=t=out:d=${X}[tail];` +
      `[head][tail]amix=inputs=2:normalize=0[mixed];` +
      `[c]atrim=${X}:${L},asetpts=PTS-STARTPTS[body];` +
      `[mixed][body]concat=n=2:v=0:a=1,loudnorm=I=-24:TP=-3[out]`;
    ff(['-i', src, '-filter_complex', fc, '-map', '[out]', '-ar', '44100', '-vn', '-map_metadata', '-1', '-codec:a', 'libmp3lame', '-b:a', '80k', dst]);
  }
  bytes += fs.statSync(dst).size;
  manifest.amb[name] = { f: name, v: a.vol };
}

fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify(manifest));
console.log(`sfx ${Object.keys(manifest.sfx).length} names / ${done.size} files, music ${musicDone.size} tracks, amb ${Object.keys(manifest.amb).length}; ${(bytes / 1048576).toFixed(1)} MB`);

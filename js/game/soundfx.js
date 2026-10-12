// Recorded voice barks and context music: hero grunts (attack / hurt / death / level up), NPC greetings,
// humanoid monster cries, sword draw when a fight starts, town music inside towns, boss music during boss fights.
import { G, on } from '../core/state.js';
import { dist2, rand } from '../core/util.js';
import { Audio } from '../audio.js';
import { sfxAt } from './combat.js';

// hero voice set by class (male bodies only: the recorded packs are male voices)
const VOICE_OF = { warrior: 'w', rogue: 'w', ranger: 'w', mage: 'm', cleric: 'm', necro: 'm' };
const voice = () => G.char && G.char.body !== 1 ? VOICE_OF[G.char.cls] : null;
const last = {};
function bark(cat, gap, opts = {}) {
  const v = voice(); if (!v) return;
  if (G.time - (last[cat] || -99) < gap) return;
  last[cat] = G.time;
  Audio.sfx(`vo_${v}_${cat}`, { vol: 0.75, ...opts });
}
// monster voices: the orc pack, pitched by size
const MOB_PITCH = { goblin: 1.4, goblin_spear: 1.4, goblin_shaman: 1.45, goblin_brute: 1.15, grukk: 1.1, bandit: 1.05, bandit_archer: 1.05, bandit_chief: 0.95, desert_bandit: 1.05, cultist: 1.05, malakar_cultist: 1, frost_dwarf: 1.2, frost_giant: 0.7, ice_troll: 0.75, snow_titan: 0.65 };

on('skillUsed', (u, sk) => {
  if (u !== G.player || !sk) return;
  const heavy = voice() === 'w' || G.char.cls === 'mage';   // mage "heavy" lines shout fire/thunder/blizzard
  if (sk.ult) bark(heavy ? 'heavy' : 'attack', 4);
  else if (sk.target === 'enemy' && Math.random() < (sk.melee ? 0.3 : 0.18)) bark(heavy && Math.random() < 0.25 ? 'heavy' : 'attack', 2.2);
  else if (sk.id && /summon|skeleton|wolf/.test(sk.id) && voice() === 'm') bark('summon', 6);
});
on('damage', (src, tgt, amount, crit) => {
  const p = G.player;
  if (tgt === p && !p.dead && amount > p.stats.maxHp * 0.07) bark('hit', 3.5);
  if (src === p && crit && Math.random() < 0.35) bark('crit', 4);
});
on('playerDied', () => { last.hit = G.time; bark('death', 0); });
on('levelUp', () => bark('joy', 2));
on('npcTalk', () => { if (Math.random() < 0.45) bark('hello', 20, { vol: 0.6 }); });
on('unitDied', (u) => {
  const pitch = MOB_PITCH[u.tplId];
  if (u.kind === 'monster' && pitch && Math.random() < 0.7) sfxAt('vo_o_death', u.pos, { vol: 0.6, pitch: pitch * rand(0.95, 1.05) });
});

// ------------------------------------------------------------ per-second checks: combat start, context music
let wasFighting = false, tickT = 0, bossT = 0;
G.addSystem(dt => {
  const p = G.player;
  if (!p || G.mode !== 'game') return;
  tickT -= dt; if (tickT > 0) return; tickT = 0.5;
  // drawing a blade when a fight starts (melee classes)
  const fighting = p.inCombat && !p.dead;
  if (fighting && !wasFighting && (p.cls === 'warrior' || p.cls === 'rogue') && G.time - (last.draw || -99) > 15) { last.draw = G.time; Audio.sfx('draw', { vol: 0.5 }); }
  wasFighting = fighting;
  // music: boss fight > town > zone theme
  const z = G.zones?.current; if (!z) return;
  let boss = false;
  if (fighting) for (const m of G.world.units) if (m.isBoss && !m.dead && (m.target === p || m.threat?.has?.(p)) && p.distTo(m) < 60) { boss = true; break; }
  bossT = boss ? 6 : Math.max(0, bossT - 0.5);   // linger a little after the boss dies
  let inTown = false;
  if (!G.world.dungeon) for (const t of z.towns || []) if (dist2(p.pos.x, p.pos.z, t.x, t.z) < (t.r || 30) + 6) { inTown = true; break; }
  Audio.music(bossT > 0 ? 'boss' : inTown ? 'town' : (z.music || 'meadow'));
});

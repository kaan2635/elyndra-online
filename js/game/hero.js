// Hero units (player, bots, arena opponents) built from character data.
import { G } from '../core/state.js';
import { S, CLASSES, RACES } from '../data/classes.js';
import { TALENTS, TALENT_INDEX } from '../data/talents.js';
import { CLASS_SKILLS, SKILLS } from '../data/skills.js';
import { Unit } from './unit.js';
import { gearSpec } from './items.js';

const FLAG_ALIAS = { ignite: 'mf2', sniper: 'rm2', atonement: 'cd3', legion: 'nl3', ruthless: 'ga1' };

export function appearanceSpec(ch, u) {
  return {
    rig: 'humanoid', race: ch.race, body: ch.body || 0, skin: ch.skin, hair: ch.hair, hairColor: ch.hairColor, beard: ch.beard, eyes: ch.eyes,
    cls: ch.cls, outfit: ch.outfit ?? undefined, outfitSat: ch.outfitSat ?? undefined, outfitDark: ch.outfitDark || 0, hat: ch.hideHelm ? false : undefined, cape: !ch.hideCape,
    gear: gearSpec(u, ch),
  };
}

export function applyTalents(u, talents) {
  u.talents = talents || {};
  const st = {}, sk = {};
  for (const id in u.talents) {
    const r = u.talents[id]; const n = TALENT_INDEX[id]; if (!n || !r) continue;
    if (n.st) for (const k in n.st) st[k] = (st[k] || 0) + n.st[k] * r;
    if (n.sk) for (const k in n.sk) sk[k] = (sk[k] || 0) + n.sk[k] * r;
  }
  u.talentStats = st; u.skillMods = sk;
}

export function createHero(ch, kind = 'player') {
  const C = CLASSES[ch.cls];
  const u = new Unit({ kind, name: ch.name, level: ch.level, x: ch.x || 0, z: ch.z || 0, team: ch.team || 'player', resType: C.res });
  u.cls = ch.cls; u.race = ch.race; u.char = ch;
  u.equip = ch.equip || {};
  u.speed = 7;
  u.threatMult = C.role === 'tank' ? 2.2 : 1;
  u.tal = id => u.talents?.[FLAG_ALIAS[id] || id] || 0;
  u.tm = key => 1 + (u.skillMods?.[key] || 0) / 100;
  u.powers = new Set();
  applyTalents(u, ch.talents);
  refreshHero(u);
  u.hp = u.stats.maxHp;
  u.res = C.res === 'mana' || C.res === 'energy' || C.res === 'focus' ? u.stats.maxRes : 0;
  if (ch.hp != null && kind === 'player') { u.hp = Math.max(1, Math.min(u.stats.maxHp, ch.hp)); }
  u.setModel(appearanceSpec(ch, u));
  return u;
}

// recompute powers/sets/stats after gear/talent changes
export function refreshHero(u) {
  u.powers = new Set();
  const sets = {};
  for (const s in u.equip) { const it = u.equip[s]; if (!it) continue; if (it.power) u.powers.add(it.power); if (it.set) sets[it.set] = (sets[it.set] || 0) + 1; }
  u.setCounts = sets;
  u.setStats = G.sets?.statsFor(sets) || null;
  u.data.cheatDeath = u.powers.has('pw_cheat_death') && !(u.cds.cheatDeath > 0);
  u.recalc();
}

export function rebuildHeroModel(u) {
  if (!u.char) return;
  u.setModel(appearanceSpec(u.char, u));
}

export function heroSkills(u) { return (CLASS_SKILLS[u.cls] || []).filter(id => SKILLS[id].lvl <= u.level); }

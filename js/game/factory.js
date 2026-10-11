// Creates monsters, summons, critters, NPCs and runs spawners.
import { G, emit } from '../core/state.js';
import { rand, randi, choice, weighted, distSq2 } from '../core/util.js';
import { L } from '../core/i18n.js';
import { S, mobXp } from '../data/classes.js';
import { MONSTERS } from '../data/monsters.js';
import { Unit } from './unit.js';
import { MonsterAI, CritterAI, PetAI, NpcAI } from './ai.js';

export function monsterStats(tpl, level, o = {}) {
  const s = S(level);
  let hp = 80 * s * (tpl.hp ?? 1), dmg = 18 * s * (tpl.dmg ?? 1), armor = 12 * s * (tpl.armor ?? 1);
  if (tpl.elite || o.elite) { hp *= 3; dmg *= 1.4; armor *= 1.2; }
  if (tpl.boss) {
    const k = tpl.raid ? 34 : tpl.worldBoss ? 28 : 16;
    hp = 80 * s * k * (o.hpMult ?? 1); dmg = 18 * s * (tpl.dmg ?? 1.3) * 1.15; armor = 15 * s;
  }
  if (o.hpMult && !tpl.boss) hp *= o.hpMult;
  if (o.dmgMult) dmg *= o.dmgMult;
  return { hp: Math.round(hp), dmg, armor, resist: 8 * s };
}

export function spawnMonster(id, level, x, z, o = {}) {
  const tpl = MONSTERS[id];
  if (!tpl) { console.warn('no monster', id); return null; }
  const u = new Unit({ kind: tpl.pet ? 'pet' : 'monster', name: L(o.name || tpl.name), level, x, z, team: tpl.critter ? 'neutral' : 'enemy' });
  u.data = { tpl, family: tpl.family, blood: tpl.blood, noBlood: tpl.noBlood, deathSfx: tpl.deathSfx, fly: tpl.fly, spawner: o.spawner, summoned: o.summoned, noLoot: o.noLoot, xpMult: o.xpMult ?? 1, questTag: o.questTag };
  u.tplId = id;
  u.elite = !!(tpl.elite || o.elite); u.isBoss = !!tpl.boss; u.rare = !!tpl.rare; u.worldBoss = !!tpl.worldBoss;
  u.passive = !!tpl.passive;
  u.base = monsterStats(tpl, level, o);
  u.speed = tpl.speed ?? 5;
  u.yaw = Math.random() * Math.PI * 2;
  u.recalc(); u.hp = u.stats.maxHp;
  const spec = { ...tpl.model, mob: id };
  if (tpl.scale && !spec.scale) spec.scale = tpl.scale;
  if (u.elite && !tpl.rare && !u.isBoss) spec.scale = (spec.scale || 1) * 1.25;
  u.setModel(spec);
  u.xp = tpl.critter ? 0 : Math.round(mobXp(level) * (u.elite ? 3 : 1) * (u.rare ? 2 : 1) * (u.isBoss ? (tpl.raid ? 40 : tpl.worldBoss ? 25 : 15) : 1) * (o.xpMult ?? 1));
  if (tpl.critter) new CritterAI(u); else new MonsterAI(u);
  G.world.addUnit(u);
  emit('monsterSpawned', u);
  return u;
}

let petSlot = 0;
export function summon(owner, id, o = {}) {
  const tpl = MONSTERS[id];
  const n = id === 'pet_wolf' && owner.powers?.has('pw_two_wolves') ? 2 : (o.count || 1);
  let last = null;
  for (let i = 0; i < n; i++) {
    const a = owner.yaw + Math.PI + rand(-0.8, 0.8);
    const x = owner.pos.x + Math.sin(a) * 2.2, z = owner.pos.z + Math.cos(a) * 2.2;
    const u = new Unit({ kind: 'pet', name: L(tpl.name), level: owner.level, x, z, team: owner.team, owner });
    u.data = { tpl, petType: o.petType, slot: (petSlot++ % 4) - 1.5, noBlood: tpl.noBlood };
    const hpBonus = 1 + (owner.skillMods?.petHp || 0) / 100 + (owner.powers?.has('pw_extra_skeleton') && id === 'pet_skeleton' ? 0.25 : 0);
    const s = S(owner.level);
    u.base = { hp: Math.round(80 * s * (tpl.hp ?? 1) * 1.6 * hpBonus), dmg: (owner.stats.power || 10) * 0.5 * (tpl.dmg ?? 0.5) + 4 * s * (tpl.dmg ?? 0.5), armor: 10 * s };
    u.speed = tpl.speed ?? 7;
    u.recalc(); u.hp = u.stats.maxHp;
    u.setModel({ ...tpl.model, mob: id });
    new PetAI(u, owner);
    owner.summons.push(u);
    G.world.addUnit(u);
    G.vfx?.burst(u.pos, id === 'pet_skeleton' ? 'shadow' : 'nature', { n: 20 });
    last = u;
  }
  owner.summons = owner.summons.filter(s => !s.dead && !s.removed);
  return last;
}

export function spawnNpc(def, x, z, yaw = 0) {
  const u = new Unit({ kind: 'npc', name: L(def.name), level: def.level || 30, x, z, team: 'neutral' });
  u.title = def.title ? L(def.title) : null;
  u.npcId = def.id; u.npc = def;
  u.yaw = yaw;
  u.data = { patrol: def.patrol };
  u.base = { hp: 99999, dmg: 1, armor: 1 }; u.recalc(); u.hp = u.stats.maxHp;
  u.setModel(def.model);
  new NpcAI(u);
  G.world.addUnit(u);
  return u;
}

// Spawner: keeps n monsters alive around a point
export class Spawner {
  constructor(def, zone) {
    this.def = def; this.alive = []; this.timer = 0; this.zone = zone;
    this.list = Array.isArray(def.m) ? def.m : [def.m];
    G.world.spawners.push(this);
    const n = def.n ?? 4;
    for (let i = 0; i < n; i++) this.spawnOne(true);
  }
  pickPoint() {
    const d = this.def, w = G.world;
    for (let k = 0; k < 12; k++) {
      const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * (d.r ?? 15);
      const x = d.x + Math.sin(a) * r, z = d.z + Math.cos(a) * r;
      if (w.dungeon) { if (!w.dungeon.walkable(x, z)) continue; return { x, z }; }
      if (w.terrain.isWater(x, z) && !d.water) continue;
      if (w.blockedAt(x, z, 0.6)) continue;
      if (w.terrain.slopeAt(x, z) > 0.8) continue;
      return { x, z };
    }
    return { x: d.x, z: d.z };
  }
  spawnOne(initial) {
    const d = this.def;
    const pick = typeof this.list[0] === 'string' ? choice(this.list) : weighted(this.list).id;
    const lvl = Array.isArray(d.lvl) ? randi(d.lvl[0], d.lvl[1]) : (d.lvl ?? 1);
    const p = this.pickPoint();
    const u = spawnMonster(pick, lvl, p.x, p.z, { spawner: this, elite: d.elite, questTag: d.tag });
    if (!u) return;
    if (d.wanderR) u.data.wanderR = d.wanderR;
    this.alive.push(u);
  }
  update(dt) {
    this.alive = this.alive.filter(u => !u.removed);
    const living = this.alive.filter(u => !u.dead).length;
    if (living < (this.def.n ?? 4)) {
      this.timer += dt;
      const rt = this.def.respawn ?? 25;
      if (this.timer >= rt) {
        this.timer = 0;
        // don't pop monsters right on top of the player
        const p = G.player;
        if (p && distSq2(p.pos.x, p.pos.z, this.def.x, this.def.z) < 10 * 10 && (this.def.r ?? 15) < 12) return;
        this.spawnOne();
      }
    }
    // remove corpses after a while
    for (const u of this.alive) if (u.dead && u.deathT > (u.lootable ? 60 : 12)) G.world.removeUnit(u);
  }
}

export const Factory = { monster: spawnMonster, summon, npc: spawnNpc };
G.factory = Factory;

// Which model files to load when: a core set at boot, plus each zone's creatures on entry.
import { Assets } from './assets.js';
import { ASSETS, ANIMS, WEAPONS, ITEMS } from './gmodel.js';
import { MONSTER_LOOKS } from '../data/looks.js';
import { MONSTERS } from '../data/monsters.js';

export const ENV = { nature: 'env/nature.glb', forest: 'env/forest.glb', town: 'env/town.glb', terrain: 'env/terrain.glb', grave: 'env/grave.glb', dungeon: 'env/dungeon.glb' };
// heroes, NPCs, mounts and the environment used everywhere
export const CORE = [ANIMS, WEAPONS, ITEMS, ENV.nature, ENV.forest, ENV.town, ENV.terrain, ENV.grave,
  ...Object.keys(ASSETS).filter(k => k.startsWith('char:')).map(k => ASSETS[k][0]),
  'mobs/horse.glb', 'mobs/horse_white.glb', 'mobs/wolf.glb', 'mobs/deer.glb', 'mobs/bunny.glb', 'mobs/sheep.glb', 'mobs/fox.glb'];

const fileOfLook = l => l && ASSETS[l.a]?.[0];
export function monsterFiles(ids) {
  const s = new Set();
  for (const id of ids) { const f = fileOfLook(MONSTER_LOOKS[id]); if (f) s.add(f); }
  return [...s];
}
export function zoneFiles(def) {
  const ids = new Set();
  for (const sp of def.spawns || []) for (const m of [].concat(sp.m)) ids.add(m);
  for (const c of def.critters || []) ids.add(c.m);
  if (def.worldBoss) ids.add(def.worldBoss.m);
  if (def.packs) for (const p of def.packs) for (const m of p) ids.add(m);
  if (def.boss) ids.add(def.boss);
  for (const b of def.bosses || []) ids.add(b);
  const files = monsterFiles([...ids].filter(id => MONSTERS[id]));
  if (def.dungeonLayout || def.theme) files.push(ENV.dungeon);
  if (def.id === 'shadow' || def.theme === 'shadow' || def.theme === 'tomb') files.push(ENV.grave);
  return files;
}
export const preloadZone = (def, onProgress) => Assets.preload(zoneFiles(def), onProgress);

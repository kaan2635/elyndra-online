// NPC spawning and interaction routing.
import { G, emit } from '../core/state.js';
import { L } from '../core/i18n.js';
import { NPCS } from '../data/npcs.js';
import { spawnNpc } from './factory.js';
import { Audio } from '../audio.js';

for (const id in NPCS) NPCS[id].id = id;

export const Npcs = {
  spawnZone(def) {
    for (const id in NPCS) {
      const n = NPCS[id]; n.id = n.id || id;
      if (n.zone !== def.id) continue;
      let x, z, yaw = n.rot ?? 0;
      if (Array.isArray(n.at)) [x, z] = n.at;
      else {
        const a = G.world.anchors[n.at];
        const town = (def.towns || []).find(t => n.at.startsWith(t.id + '.')) || def.towns?.[0];
        if (a) [x, z] = a;
        else if (town) {
          // fallback ring position around the plaza
          const k = Object.keys(NPCS).indexOf(id);
          const ang = k * 1.3; x = town.x + Math.sin(ang) * town.r * 0.3; z = town.z + Math.cos(ang) * town.r * 0.3;
        } else continue;
        if (town && n.rot == null) yaw = Math.atan2(town.x - x, town.z - z);
      }
      x += n.ox || 0; z += n.oz || 0;
      spawnNpc(n, x, z, yaw);
    }
  },
  interact(u) {
    if (!u?.npc) return;
    const p = G.player;
    if (p.distTo(u) > 6) { G.playerCtl.moveTarget = { x: u.pos.x, z: u.pos.z, stop: 3, then: () => this.interact(u) }; return; }
    u.faceTo(p.pos.x, p.pos.z);
    u.anim.emote = { type: 'wave', t: 0, dur: 1.2 };
    G.quests?.talkTo(u.npcId);
    Audio.sfx('ui_open', { vol: 0.4 });
    G.ui.openDialog?.(u);
    emit('npcTalk', u.npcId);
  },
  offerQuest(qid) { G.ui.openDialog?.(null, { quest: qid }); },
};
G.npcs = Npcs;

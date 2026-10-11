// Professions, gathering nodes (ore / herb / wood) and the fishing mini-game.
import * as THREE from 'three';
import { G, emit } from '../core/state.js';
import { L, t } from '../core/i18n.js';
import { rand, randi, chance, choice, clamp, distSq2, weighted } from '../core/util.js';
import { S } from '../data/classes.js';
import { ITEMS } from '../data/items.js';
import { addItem, makeStack } from './items.js';
import { Builder, box, cyl, cone, ico, octa, dodeca, jitter, sphere } from '../gfx/geom.js';
import { lambert } from '../gfx/materials.js';
import { h, UI } from '../ui/ui.js';
import { Audio } from '../audio.js';

export const PROFS = {
  mining: { name: 'Madencilik|Mining', icon: 'pickaxe', gather: true },
  herbalism: { name: 'Bitkicilik|Herbalism', icon: 'herb', gather: true },
  woodcutting: { name: 'Odunculuk|Woodcutting', icon: 'axe_tool', gather: true },
  fishing: { name: 'Balıkçılık|Fishing', icon: 'fishing_rod', gather: true },
  smithing: { name: 'Demircilik|Blacksmithing', icon: 'anvil' },
  tailoring: { name: 'Terzilik & Dericilik|Tailoring & Leatherwork', icon: 'cloth' },
  alchemy: { name: 'Simya|Alchemy', icon: 'cauldron' },
  cooking: { name: 'Aşçılık|Cooking', icon: 'cooking_pot' },
  jewelcrafting: { name: 'Kuyumculuk|Jewelcrafting', icon: 'ruby_ring' },
};
const NODE_PROF = t => t.startsWith('ore') ? 'mining' : t.startsWith('herb') ? 'herbalism' : 'woodcutting';
export const nodeReq = type => (parseInt(type.slice(-1)) - 1) * 15;

export const Prof = {
  get(id) { const p = G.char?.prof || {}; return p[id]; },
  has(id) { return !!this.get(id); },
  level(id) { return this.get(id)?.lvl || 0; },
  unlock(id) {
    const ch = G.char; ch.prof = ch.prof || {};
    if (ch.prof[id]) return;
    ch.prof[id] = { lvl: 1, xp: 0 };
    if (id === 'fishing') ch.hasRod = true;
    G.ui.toast(PROFS[id]?.icon || 'star', L('Yeni meslek: |New profession: ') + L(PROFS[id]?.name || id), '#8affb0');
    Audio.sfx('achievement', { vol: 0.6 });
    emit('profUnlocked', id);
  },
  unlockName(id) { if (id.startsWith('mount_')) return L('Binek: At|Mount: Horse'); return L(PROFS[id]?.name || id); },
  addXp(id, amount) {
    const p = this.get(id); if (!p) return;
    if (p.lvl >= 100) return;
    const race = G.char.race === 'dwarf' && !PROFS[id].gather ? 1.1 : 1;
    p.xp += amount * race;
    const need = 20 + p.lvl * 6;
    while (p.xp >= need && p.lvl < 100) { p.xp -= 20 + p.lvl * 6; p.lvl++; G.ui.toast(PROFS[id].icon, `${L(PROFS[id].name)} ${p.lvl}`, '#8ad8ff'); emit('profLevel', id, p.lvl); }
  },
  trainDialog(npc) {
    UI.modal((box, close) => {
      box.append(h('h3', L(npc.name) + ' — ' + L('Eğitim|Training')));
      for (const id of npc.prof || []) {
        const P = PROFS[id], have = this.get(id);
        box.append(h('div.card.row', h('img.ico', { src: G.iconURL?.(P.icon) || '' }), h('div', { style: { flex: 1 } }, h('div', { style: { fontWeight: 800 } }, L(P.name)), h('div.muted', { style: { fontSize: '12px' } }, have ? L(`Seviye ${have.lvl}/100|Level ${have.lvl}/100`) : L('Öğrenilmedi|Not learned'))),
          have ? h('span.good', '✔') : h('button.btn.small.primary', { onclick: () => { this.unlock(id); close(); } }, t('learn') + ' (' + t('free') + ')')));
      }
      box.append(h('div.muted', { style: { fontSize: '12px' } }, L('Meslekler ücretsizdir; hepsini öğrenebilirsin. Toplama meslekleri dünyadaki kaynak noktalarında, üretim meslekleri Zanaat (J) penceresinde kullanılır.|Professions are free and you can learn them all. Gathering skills are used at resource nodes in the world; crafting skills in the Crafting (J) window.')),
        h('div.row', h('button.btn', { onclick: () => { close(); UI.open('craft'); } }, L('Zanaat Penceresi|Crafting Window')), h('button.btn.ghost', { onclick: close }, t('close'))));
    });
  },
};
G.prof = Prof;

// ------------------------------------------------------------ node models
function nodeMesh(type) {
  const b = new Builder(type.length * 7);
  const T = ITEMS[type];
  const col = T?.fill ? parseInt(T.fill[0].slice(1), 16) : 0xe8c060;
  if (type.startsWith('ore')) {
    b.add(jitter(dodeca(0.9), 0.25, 3), { p: [0, 0.45, 0], s: [1.2, 0.8, 1], color: [0x5a5650, 0x8a8478] });
    for (let i = 0; i < 6; i++) b.add(octa(0.16 + Math.random() * 0.1), { p: [Math.cos(i) * 0.6, 0.4 + Math.random() * 0.5, Math.sin(i * 1.7) * 0.5], r: [Math.random(), Math.random(), 0], s: [1, 1.6, 1], color: col, shade: 0.05 });
  } else if (type.startsWith('herb')) {
    for (let i = 0; i < 6; i++) b.add(cone(0.08, 0.6, 4), { p: [Math.cos(i) * 0.15, 0.3, Math.sin(i) * 0.15], r: [Math.cos(i) * 0.5, 0, Math.sin(i) * 0.5], color: 0x3a8a3a });
    for (let i = 0; i < 5; i++) b.add(octa(0.11), { p: [Math.cos(i * 1.3) * 0.25, 0.55 + Math.random() * 0.15, Math.sin(i * 1.3) * 0.25], s: [1, 0.6, 1], color: col, shade: 0 });
  } else {
    b.add(cyl(0.3, 0.4, 2.6, 7), { p: [0, 1.3, 0], color: [0x5a3a24, 0x8a6a44] });
    const lc = col;
    for (let i = 0; i < 3; i++) b.add(jitter(ico(0.9, 0), 0.2, i + 2), { p: [Math.cos(i * 2) * 0.4, 2.8 + i * 0.3, Math.sin(i * 2) * 0.4], color: [lc, 0xf0e090] });
  }
  return new THREE.Mesh(b.build(), lambert('nodes'));
}

// ------------------------------------------------------------ gathering
export const Gather = {
  nodes: [],
  spawnZone(def) {
    this.nodes = [];
    const W = G.world;
    for (const spec of def.nodes || []) {
      for (let i = 0; i < spec.n; i++) {
        const pos = this.findSpot(spec.type, spec.area);
        if (!pos) continue;
        const mesh = nodeMesh(spec.type);
        mesh.position.set(pos.x, W.groundAt(pos.x, pos.z) - 0.05, pos.z);
        mesh.rotation.y = Math.random() * 6;
        mesh.castShadow = true;
        W.root.add(mesh);
        const prof = NODE_PROF(spec.type);
        const T = ITEMS[spec.type];
        const ia = {
          kind: 'node', type: spec.type, prof, x: pos.x, z: pos.z, r: 3, h: 1.2, mesh, label: L(T.name), col: T.fill?.[0] || '#c8a060',
          verb: { mining: L('Kaz|Mine'), herbalism: L('Topla|Gather'), woodcutting: L('Kes|Chop') }[prof],
          action: ia2 => this.gather(ia2),
        };
        if (!W.dungeon && spec.type.startsWith('wood')) W.addCircle(pos.x, pos.z, 0.4);
        W.interactables.push(ia);
        this.nodes.push(ia);
      }
    }
    // fishing spots along shores
    for (const f of def.fishing || []) {
      let made = 0;
      for (let k = 0; k < 40 && made < Math.max(3, Math.round(f.r / 7)); k++) {
        const a = Math.random() * Math.PI * 2;
        for (let d = f.r * 0.5; d < f.r * 1.4; d += 1) {
          const x = f.x + Math.cos(a) * d, z = f.z + Math.sin(a) * d;
          const h = W.terrain.heightAt(x, z);
          if (h > W.waterLevel + 0.05 && h < W.waterLevel + 0.9 && !W.blockedAt(x, z, 0.5)) {
            if (W.interactables.some(o => o.kind === 'fish' && distSq2(o.x, o.z, x, z) < 100)) break;
            const wx = f.x + Math.cos(a) * (d - 5), wz = f.z + Math.sin(a) * (d - 5);
            W.interactables.push({ kind: 'fish', x, z, r: 3.5, h: 0.5, label: L('Balık Noktası|Fishing Spot'), verb: t('fish'), water: { x: wx, z: wz }, pool: f.fish, action: ia => Fishing.start(ia) });
            made++;
            break;
          }
        }
      }
    }
  },
  findSpot(type, area) {
    const W = G.world, T = W.terrain;
    for (let k = 0; k < 60; k++) {
      let x, z;
      if (area) { const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * area.r; x = area.x + Math.cos(a) * r; z = area.z + Math.sin(a) * r; }
      else if (W.dungeon) { const p = W.dungeon.randomFloor(); x = p.x; z = p.z; }
      else { x = rand(-T.half * 0.8, T.half * 0.8); z = rand(-T.half * 0.8, T.half * 0.8); }
      if (W.dungeon) return { x, z };
      if (T.isWater(x, z) || T.roadAt(x, z) > 0.2 || T.plazaAt(x, z) > 0.05) continue;
      const sl = T.slopeAt(x, z);
      if (type.startsWith('ore') ? sl > 0.9 : sl > 0.5) continue;
      if (W.blockedAt(x, z, 1.2)) continue;
      if ((G.zones.current?.towns || []).some(t => distSq2(x, z, t.x, t.z) < (t.r + 8) ** 2)) continue;
      return { x, z };
    }
    return null;
  },
  nearest(type) {
    const p = G.player; let best = null, bd = 1e12;
    for (const n of this.nodes) { if (n.hidden || n.type !== type) continue; const d = distSq2(p.pos.x, p.pos.z, n.x, n.z); if (d < bd) { bd = d; best = n; } }
    return best;
  },
  gather(ia) {
    const p = G.player;
    if (ia.hidden) return;
    if (p.inCombat) { G.ui.error(L('Savaştayken toplayamazsın|Cannot gather in combat')); return; }
    if (!Prof.has(ia.prof)) { G.ui.error(L(`Önce ${L(PROFS[ia.prof].name)} öğrenmelisin (Aydınköy eğitmenleri).|You must learn ${L(PROFS[ia.prof].name)} first (Dawnhollow trainers).`)); if (ia.prof === 'woodcutting') { Prof.unlock('woodcutting'); } else return; }
    const req = nodeReq(ia.type);
    if (Prof.level(ia.prof) < req) { G.ui.error(L(`${L(PROFS[ia.prof].name)} ${req} gerekli|Requires ${L(PROFS[ia.prof].name)} ${req}`)); return; }
    if (G.mounts?.mounted()) G.mounts.dismount();
    p.faceTo(ia.x, ia.z);
    const dur = 2.2;
    const sfx = { mining: 'mining', herbalism: 'herb', woodcutting: 'chop' }[ia.prof];
    p.cast = { sk: { id: 'gather', name: ia.verb + ': ' + ia.label, theme: 'nature', run: () => this.finish(ia) }, id: 'gather', t: 0, dur, target: p, ctx: {} };
    G.ui.castBar(p.cast);
    p.anim.cast = null;
    const swing = () => { if (p.cast?.id !== 'gather') return; p.playAct(ia.prof === 'herbalism' ? 'pick' : 'gather', 0.7); G.combat.sfxAt(sfx, ia, { vol: 0.6 }); G.vfx?.burst({ x: ia.x, y: G.world.groundAt(ia.x, ia.z) + 0.3, z: ia.z }, ia.prof === 'herbalism' ? 'nature' : 'dust', { n: 6 }); setTimeout(swing, 720); };
    swing();
  },
  finish(ia) {
    if (ia.hidden) return;
    const p = Prof.get(ia.prof);
    const lvl = p?.lvl || 1;
    const req = nodeReq(ia.type);
    const qty = 1 + (chance(0.5) ? 1 : 0) + (lvl > req + 25 && chance(0.4) ? 1 : 0);
    G.progress.giveItem(makeStack(ia.type, qty));
    if (chance(0.05)) G.progress.giveItem(makeStack(ia.prof === 'mining' ? choice(['gem1', 'gem2', 'gem3']) : ia.prof === 'herbalism' ? 'essence' : 'feather', 1));
    Prof.addXp(ia.prof, Math.max(2, 12 - Math.max(0, lvl - req - 20) * 0.3));
    G.progress.giveXp(Math.round(S(G.player.level) * 3), null);
    emit('gathered', ia.type);
    ia.hidden = true; ia.mesh.visible = false;
    setTimeout(() => { ia.hidden = false; if (ia.mesh) ia.mesh.visible = true; }, randi(50, 90) * 1000);
  },
};
G.gather = Gather;

// ------------------------------------------------------------ fishing
export const Fishing = {
  active: null,
  start(ia) {
    const p = G.player;
    if (!G.char.hasRod && !Prof.has('fishing')) { G.ui.error(L('Oltan yok. Balıkçı Osman\'dan alabilirsin.|You have no rod. Get one from Osman the Fisherman.')); return; }
    if (!Prof.has('fishing')) Prof.unlock('fishing');
    if (p.inCombat) { G.ui.error(L('Savaştayken balık tutamazsın|Cannot fish in combat')); return; }
    if (this.active) return;
    if (G.mounts?.mounted()) G.mounts.dismount();
    p.faceTo(ia.water.x, ia.water.z);
    p.playAct('fish', 1.2);
    G.combat.sfxAt('fish_cast', p.pos);
    // temporary rod in hand
    this.oldModel = p.modelSpec;
    const spec = JSON.parse(JSON.stringify(p.modelSpec)); spec.gear.main = { m: 'rod' }; spec.gear.off = null;
    p.setModel(spec);
    const bob = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 6), new THREE.MeshLambertMaterial({ color: 0xff3a2a }));
    const top = new THREE.Mesh(new THREE.SphereGeometry(0.09, 6, 4), new THREE.MeshLambertMaterial({ color: 0xffffff })); top.position.y = 0.12; bob.add(top);
    bob.position.set(ia.water.x, G.world.waterLevel + 0.05, ia.water.z);
    G.world.root.add(bob);
    const panel = h('div.panel', { style: { position: 'fixed', left: '50%', bottom: 'calc(170px + var(--safe-b))', transform: 'translateX(-50%)', width: 'min(360px, 86vw)', padding: '12px', zIndex: 36, display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'center' } });
    const msg = h('div', { style: { fontWeight: 800 } }, L('Balık bekleniyor…|Waiting for a bite…'));
    const bar = h('div.fishbar'); const zone = h('div.zone'); const fish = h('img.fish', { src: G.iconURL?.('fish') || '' }); bar.append(zone, fish);
    bar.style.display = 'none';
    const btn = h('button.btn.primary.big', { style: { width: '100%' } }, L('Çek!|Reel!'));
    const cancel = h('button.btn.ghost.small', { onclick: () => this.end(false) }, t('cancel'));
    panel.append(msg, bar, btn, cancel);
    UI.root.append(panel);
    const pool = ia.pool || ['fish1'];
    this.active = { ia, bob, panel, msg, bar, zone, fish, btn, state: 'wait', t: rand(2.5, 6.5), pos: 0, dir: 1, pool, round: 0 };
    const press = e => { e.preventDefault(); this.press(); };
    btn.addEventListener('pointerdown', press);
    this._key = G.input.onKey; // space also reels
    G.events.emit('fishingStart');
  },
  press() {
    const a = this.active; if (!a) return;
    if (a.state === 'wait') { a.msg.textContent = L('Çok erken! Balık kaçtı.|Too early! The fish got away.'); Audio.sfx('ui_error'); setTimeout(() => this.end(false), 700); a.state = 'done'; return; }
    if (a.state === 'bite') {
      // start reel timing game
      a.state = 'reel'; a.bar.style.display = 'block'; a.btn.textContent = L('Şimdi!|Now!');
      const skill = Prof.level('fishing');
      const tier = Math.max(...a.pool.map(id => parseInt(id.slice(-1)) || 1));
      a.width = clamp(28 + skill * 0.35 - tier * 3, 14, 55);
      a.zoneX = rand(5, 95 - a.width);
      a.zone.style.left = a.zoneX + '%'; a.zone.style.width = a.width + '%';
      a.speed = 70 + tier * 15; a.pos = 0; a.dir = 1;
      a.msg.textContent = L('İbre yeşil alandayken bas!|Press while the marker is in the green zone!');
      Audio.sfx('fish_reel');
      return;
    }
    if (a.state === 'reel') {
      const inZone = a.pos >= a.zoneX && a.pos <= a.zoneX + a.width;
      if (!inZone) { a.msg.textContent = L('Misina koptu!|The line snapped!'); Audio.sfx('ui_error'); a.state = 'done'; setTimeout(() => this.end(false), 800); return; }
      const rare = a.rare;
      if (rare && a.round < 1) { a.round++; a.zoneX = rand(5, 95 - a.width * 0.8); a.width *= 0.8; a.zone.style.left = a.zoneX + '%'; a.zone.style.width = a.width + '%'; a.speed *= 1.3; a.msg.textContent = L('Güçlü bir balık! Bir kez daha!|A strong one! Once more!'); Audio.sfx('fish_reel'); return; }
      a.state = 'done';
      this.catch();
    }
  },
  catch() {
    const a = this.active;
    const lvl = Prof.level('fishing');
    let id;
    const r = Math.random();
    if (r < 0.04 + lvl * 0.0006) id = 'fish_gold';
    else if (r < 0.09) id = 'fish_boot';
    else id = choice(a.pool);
    if (r > 0.97) { G.char.gold += Math.round(S(G.player.level) * 6); G.ui.toast('chest_box', L('Batık bir kese buldun!|You fished up a sunken pouch!'), '#ffd660'); }
    G.progress.giveItem(makeStack(id, 1));
    Prof.addXp('fishing', 10);
    G.progress.giveXp(Math.round(S(G.player.level) * 4), null);
    Audio.sfx('fish_splash');
    G.vfx?.burst({ x: a.bob.position.x, y: a.bob.position.y, z: a.bob.position.z }, 'water', { n: 20, y: 0 });
    a.msg.textContent = L('Yakaladın: |Caught: ') + L(ITEMS[id].name);
    emit('fishCaught', id);
    setTimeout(() => this.end(true), 900);
  },
  update(dt) {
    const a = this.active; if (!a) return;
    const p = G.player;
    if (p.dead || p.inCombat || G.playerCtl.isMoving) { this.end(false); return; }
    a.bob.position.y = G.world.waterLevel + 0.05 + Math.sin(G.time * 3) * 0.04 - (a.state === 'bite' ? 0.18 + Math.sin(G.time * 30) * 0.06 : 0);
    if (a.state === 'wait') {
      a.t -= dt;
      if (a.t <= 0) { a.state = 'bite'; a.biteT = 1.3; a.rare = Math.random() < 0.15; a.msg.textContent = '❗ ' + L('Vurdu! ÇEK!|A bite! REEL!'); Audio.sfx('fish_bite'); G.vfx?.burst({ x: a.bob.position.x, y: a.bob.position.y, z: a.bob.position.z }, 'water', { n: 10, y: 0 }); }
    } else if (a.state === 'bite') {
      a.biteT -= dt;
      if (a.biteT <= 0) { a.state = 'done'; a.msg.textContent = L('Balık kaçtı…|The fish got away…'); setTimeout(() => this.end(false), 800); }
    } else if (a.state === 'reel') {
      a.pos += a.dir * a.speed * dt;
      if (a.pos > 100) { a.pos = 100; a.dir = -1; } if (a.pos < 0) { a.pos = 0; a.dir = 1; }
      a.fish.style.left = a.pos + '%';
    }
  },
  end(ok) {
    const a = this.active; if (!a) return;
    a.bob.removeFromParent(); a.panel.remove();
    this.active = null;
    const p = G.player;
    if (p && this.oldModel) { p.setModel(this.oldModel); this.oldModel = null; }
  },
};
G.fishing = Fishing;
G.addSystem(dt => Fishing.update(dt));
G.input && (G.input._fishKey = true);
G.events.on('sessionEnd', () => Fishing.end(false));

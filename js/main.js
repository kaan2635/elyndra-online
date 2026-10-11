// Elyndra Online — boot & main loop
import * as THREE from 'three';
import { G, emit } from './core/state.js';
import { L, t } from './core/i18n.js';
import { Save } from './core/save.js';
import { Input } from './core/input.js';
import { Engine } from './gfx/engine.js';
import { Overlay } from './gfx/overlay.js';
import { VFX } from './gfx/vfx.js';
import { World } from './game/world.js';
import './game/stats.js';
import './game/combat.js';
import { updateTimers, updateCasting, updateAutoAttack } from './game/skillsys.js';
import { pruneDangers } from './game/ai.js';
import './game/factory.js';
import { Progress } from './game/progress.js';
import './game/inventory.js';
import './game/travel.js';
import './game/chat.js';
import { ZoneSys } from './game/zoneSys.js';
import { newCharacter, startSession, saveSessionState, endSession } from './game/character.js';
import { UI } from './ui/ui.js';
import { HUD } from './ui/hud.js';
import { Audio } from './audio.js';

const bootEl = document.getElementById('boot');
const setBoot = (p, txt) => { const b = bootEl?.querySelector('.loadbar > i'); if (b) b.style.width = p + '%'; const tx = bootEl?.querySelector('.loadtext'); if (tx && txt) tx.textContent = txt; };

let last = performance.now(), saveT = 0, acc = 0;

async function boot() {
  setBoot(10, L('Ayarlar yükleniyor…|Loading settings…'));
  Save.load();
  Audio.init();
  Audio.setVolumes({ master: G.settings.master, music: G.settings.music, sfx: G.settings.sfx, ambient: G.settings.ambient });
  setBoot(25, L('Grafik motoru başlatılıyor…|Starting renderer…'));
  const engine = new Engine(document.getElementById('gl'));
  new Overlay(document.getElementById('overlay'));
  new VFX(engine.scene);
  new World();
  const input = new Input(document.getElementById('gl'));
  input.fixedJoy = !!G.settings.fixedJoy;
  UI.init();
  Progress.init();
  G.inv.update(0);
  setBoot(45, L('Sistemler hazırlanıyor…|Preparing systems…'));
  // optional modules (loaded lazily so a failure in one doesn't break boot)
  const mods = ['./data/zone_forest.js', './data/zone_desert.js', './data/zone_frost.js', './data/zone_ember.js', './data/zone_shadow.js', './game/npcs.js', './game/quests.js', './game/gathering.js', './game/bots.js', './game/party.js', './game/mounts.js', './game/weather.js',
    './game/dungeons.js', './game/crafting.js', './game/market.js', './game/guild.js', './game/achievements.js', './game/arena.js',
    './game/mastery.js', './game/events.js', './game/bounties.js', './game/home.js', './game/powers.js', './game/portrait.js', './net/p2p.js',
    './ui/windows.js', './ui/questwin.js', './ui/mapwin.js', './ui/settingswin.js', './ui/dialog.js', './ui/socialwin.js', './ui/craftwin.js', './ui/title.js'];
  let i = 0;
  for (const m of mods) {
    try { await import(m); } catch (e) { if (!String(e).includes('Failed to fetch') && !String(e).includes('404')) console.warn('module', m, e); }
    setBoot(45 + (++i / mods.length) * 45);
  }
  setupInput(input);
  setBoot(100, L('Hazır!|Ready!'));
  requestAnimationFrame(loop);
  setTimeout(() => { if (bootEl) { bootEl.style.opacity = 0; setTimeout(() => bootEl.remove(), 600); } }, 200);
  // test mode: ?test=warrior jumps straight into the world
  const qs = new URLSearchParams(location.search);
  if (qs.get('test')) {
    const cls = qs.get('test');
    const ch = newCharacter({ name: 'Test' + cls.slice(0, 3), race: qs.get('race') || 'human', cls, skin: 0xe6b48e, hair: 0, hairColor: 0x5a3a22, eyes: 0x2a5aa8 });
    if (qs.get('lvl')) { ch.level = +qs.get('lvl'); }
    if (qs.get('zone')) ch.zone = qs.get('zone');
    G.account.characters.push(ch);
    await startSession(ch);
    if (qs.get('x')) { G.player.pos.x = +qs.get('x'); G.player.pos.z = +qs.get('z'); }
  } else {
    G.mode = 'title';
    G.title?.show();
  }
  window.addEventListener('beforeunload', () => { if (G.mode === 'game') { saveSessionState(); Save.save(); } });
  document.addEventListener('visibilitychange', () => { if (document.hidden && G.mode === 'game') { saveSessionState(); Save.save(); } });
}

function setupInput(input) {
  input.onTap = (x, y, btn, type) => {
    if (G.mode === 'game') { if (btn === 2) G.playerCtl?.tap(x, y, 2); else G.playerCtl?.tap(x, y, btn); }
    else G.title?.tap?.(x, y);
  };
  input.onWheel = dy => { const c = G.engine.cam; c.tDist = Math.max(c.minDist, Math.min(c.maxDist, c.tDist * (dy > 0 ? 1.12 : 0.89))); };
  input.onKey = (code, e) => {
    if (G.mode !== 'game') return false;
    if (UI.chatFocused) return false;
    const pc = G.playerCtl;
    const map = { KeyC: 'char', KeyB: 'bag', KeyI: 'bag', KeyK: 'skills', KeyP: 'skills', KeyN: 'talents', KeyL: 'quests', KeyM: 'map', KeyJ: 'craft', KeyO: 'social', KeyG: 'social', KeyH: 'dungeon', KeyU: 'market', KeyY: 'ach', KeyV: 'collect', KeyE: 'home', KeyZ: 'arena' };
    if (map[code]) { UI.toggle(map[code]); return true; }
    const n = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7', 'Digit8', 'Digit9', 'Digit0'].indexOf(code);
    if (n >= 0) { HUD.press(n); const b = HUD.btns[n]; b?.classList.remove('flash'); void b?.offsetWidth; b?.classList.add('flash'); return true; }
    switch (code) {
      case 'Space': pc?.jump(); return true;
      case 'ShiftLeft': case 'ShiftRight': pc?.dodge(); return true;
      case 'Tab': pc?.cycleTarget(); return true;
      case 'KeyF': pc?.interactNearest(); return true;
      case 'KeyR': if (pc) pc.autoRun = !pc.autoRun; return true;
      case 'KeyT': G.mounts?.toggle(); return true;
      case 'KeyX': if (G.player?.sitting) pc.stand(); else pc?.sit(); return true;
      case 'Enter': HUD.focusChat(); return true;
      case 'Escape':
        if (UI.closeDialog?.()) return true;
        if (UI.anyOpen()) { UI.closeAll(); return true; }
        if (G.player?.target) { pc.setTarget(null); return true; }
        UI.open('settings'); return true;
    }
    return false;
  };
}

function loop(now) {
  requestAnimationFrame(loop);
  let dt = Math.min(0.1, (now - last) / 1000);
  // optional frame cap (battery saver on mobile)
  const cap = G.settings?.fpsCap || 0;
  if (cap && cap < 60) { acc += dt; if (acc < 1 / cap - 0.002) return; dt = Math.min(0.1, acc); acc = 0; }
  last = now;
  if (document.hidden) return;
  G.dt = dt; G.time += dt;
  try { frame(dt); } catch (e) { console.error(e); }
  G.input.endFrame();
}

function frame(dt, noRender) {
  const E = G.engine;
  if (G.mode === 'game' && G.player) {
    const p = G.player;
    G.playerCtl.update(dt);
    updateAutoAttack(p, dt);
    for (const u of G.world.units) if (u.kind === 'bot' && !u.dead && u.group.visible) { updateCasting(u, dt); updateAutoAttack(u, dt); }
    G.world.update(dt);
    updateTimers(dt);
    pruneDangers();
    ZoneSys.update(dt);
    G.inv.update(dt);
    G.systemsUpdate?.forEach(f => f(dt));
    E.updateCamera(dt, p.pos);
    E.updateLighting(dt, p.pos);
    G.weather?.update(dt);
    G.vfx.update(dt);
    G.overlay.update(dt);
    HUD.update(dt);
    Audio.setCombat(p.inCombat && !p.dead);
    saveT += dt;
    if (saveT > 30) { saveT = 0; saveSessionState(); Save.save(); }
    if (G.char) G.char.playtime = (G.char.playtime || 0) + dt;
  } else {
    G.title?.update?.(dt);
    G.vfx.update(dt);
    G.overlay.update(dt);
  }
  if (!noRender) E.render();
}

// registry for per-frame system updates added by optional modules
G.systemsUpdate = [];
G.addSystem = fn => G.systemsUpdate.push(fn);
G.startSession = startSession; G.endSession = endSession; G.newCharacter = newCharacter;
window.ELYNDRA = G; // handy for debugging from the console
// deterministic stepping for automated tests (works while the tab is hidden)
G.step = (n = 1, dt = 1 / 30) => { for (let i = 0; i < n; i++) { G.dt = dt; G.time += dt; frame(dt, i < n - 1); G.input.endFrame(); } };

boot().catch(e => {
  console.error(e);
  if (bootEl) { bootEl.querySelector('.loadtext').textContent = 'Error: ' + e.message; }
});

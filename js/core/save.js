// Persistence: account (characters, collections, settings) in localStorage, with export/import.
import { G } from './state.js';
import { isTouch, deepClone } from './util.js';

const KEY = 'elyndra_save_v1';
const BACKUP = 'elyndra_save_backup';

export function defaultSettings() {
  const touch = isTouch();
  const small = Math.min(window.innerWidth, window.innerHeight) < 500;
  return {
    quality: touch ? (small ? 'low' : 'med') : 'high', master: 0.8, music: 0.45, sfx: 0.8, ambient: 0.55,
    dmgNumbers: true, nameplates: true, camShake: true, online: true, post: true, showFps: false, uiScale: touch && small ? 0.9 : 1,
    autoLoot: true, fixedJoy: false, bots: true, fpsCap: touch ? 60 : 0,
  };
}

export function defaultAccount() {
  return {
    v: 1, created: Date.now(), characters: [], settings: defaultSettings(),
    achievements: {}, achPoints: 0, mounts: [], pets: [], titles: [], wardrobe: {}, stash: [], stashGold: 0, stats: {},
    guild: null, friends: [], lastChar: null, seenTips: {}, realm: 'Elyndra-1',
  };
}

export const Save = {
  data: null,
  load() {
    let d = null;
    try { d = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { console.warn('save corrupt', e); }
    if (!d) { try { d = JSON.parse(localStorage.getItem(BACKUP) || 'null'); } catch (e) { } }
    if (!d) d = defaultAccount();
    d.settings = { ...defaultSettings(), ...(d.settings || {}) };
    const def = defaultAccount();
    for (const k in def) if (d[k] === undefined) d[k] = def[k];
    this.data = d;
    G.account = d; G.settings = d.settings;
    return d;
  },
  save() {
    if (!this.data) return;
    try {
      if (G.char && G.player) G.events.emit('beforeSave');
      const s = JSON.stringify(this.data);
      const prev = localStorage.getItem(KEY);
      if (prev) localStorage.setItem(BACKUP, prev);
      localStorage.setItem(KEY, s);
      return true;
    } catch (e) { console.warn('save failed', e); return false; }
  },
  exportString() {
    this.save();
    return btoa(unescape(encodeURIComponent(JSON.stringify(this.data))));
  },
  importString(str) {
    const d = JSON.parse(decodeURIComponent(escape(atob(str.trim()))));
    if (!d || !Array.isArray(d.characters)) throw new Error('invalid');
    localStorage.setItem(KEY, JSON.stringify(d));
    this.load();
  },
  wipe() { localStorage.removeItem(KEY); this.load(); },
};
G.save = Save;

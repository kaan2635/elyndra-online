// Global game registry. Systems attach themselves here to avoid import cycles.
import { Emitter } from './util.js';

export const G = {
  version: '1.0.0',
  events: new Emitter(),
  time: 0,          // seconds since start (real)
  dt: 0,
  paused: false,
  mode: 'boot',     // boot | title | game
  // filled in by systems
  engine: null, scene: null, camera: null, input: null,
  world: null, player: null, units: [], ui: null, save: null, char: null, account: null,
  settings: null,
};

export const on = (ev, fn) => G.events.on(ev, fn);
export const emit = (ev, ...a) => G.events.emit(ev, ...a);

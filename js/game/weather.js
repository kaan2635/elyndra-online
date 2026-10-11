// Weather: rain with thunder, snow, sandstorms, ash fall, shadow mist. Purely atmospheric.
import { G, on } from '../core/state.js';
import { rand, choice, lerp } from '../core/util.js';
import { Audio } from '../audio.js';

export const Weather = {
  kind: 'clear', t: 0, intensity: 0, target: 0, flash: 0,
  set(def) {
    this.def = def;
    this.kind = def.dungeonLayout ? 'clear' : choice(def.weather || ['clear']);
    this.target = this.kind === 'clear' ? 0 : 1;
    this.intensity = this.target;
    this.t = rand(150, 320);
    this.applyAudio();
  },
  applyAudio() {
    if (!this.def || this.def.dungeonLayout) return;
    if (this.kind === 'rain') Audio.ambient('rain');
    else Audio.ambient(this.def.ambient || 'none');
  },
  update(dt) {
    if (G.mode !== 'game' || !this.def || G.world.dungeon) return;
    this.t -= dt;
    if (this.t <= 0) {
      this.t = rand(150, 320);
      const next = choice(this.def.weather || ['clear']);
      if (next !== this.kind) { this.kind = next; this.target = next === 'clear' ? 0 : 1; this.intensity = Math.min(this.intensity, 0.05); this.applyAudio(); }
    }
    this.intensity = lerp(this.intensity, this.target, 1 - Math.exp(-dt * 0.4));
    const k = this.intensity;
    const E = G.engine, p = G.player; if (!p || !G.vfx) return;
    const low = E.qName === 'low';
    const cam = G.camera.position;
    const spawn = (preset, rate, spread, h0, h1) => {
      const n = rate * dt * k * (low ? 0.4 : 1);
      for (let i = 0; i < n || Math.random() < n - i; i++) {
        const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * spread;
        G.vfx.emitOne(preset, p.pos.x + Math.cos(a) * r, p.pos.y + rand(h0, h1), p.pos.z + Math.sin(a) * r, preset === 'rain' ? 1.5 : rand(-0.5, 0.5), 0, preset === 'rain' ? 0.5 : rand(-0.5, 0.5), preset === 'rain' ? 1 : 1);
        if (i > 200) break;
      }
    };
    switch (this.kind) {
      case 'rain':
        spawn('rain', 260, 22, 6, 14);
        if (Math.random() < dt * 0.04 * k) { this.flash = 1; setTimeout(() => Audio.sfx('explosion', { vol: 0.35, pitch: 0.4 }), rand(300, 1500)); }
        break;
      case 'snow': spawn('snow', 90, 24, 4, 12); break;
      case 'sand': spawn('dust', 40, 18, 0.5, 4); break;
      case 'ash': spawn('ash', 70, 24, 4, 12); spawn('ember', 10, 18, 0, 3); break;
      case 'mist': spawn('spark_purple', 25, 20, 0.3, 4); break;
      case 'fireflies': if (E.daylight < 0.5) spawn('firefly', 8, 20, 0.5, 3); break;
      case 'leaves': spawn('leaf', 14, 22, 4, 10); break;
    }
    // darker fog and lightning flashes
    const fogMul = this.kind === 'rain' ? 0.7 : this.kind === 'sand' ? 0.55 : this.kind === 'snow' ? 0.8 : this.kind === 'ash' ? 0.75 : this.kind === 'mist' ? 0.7 : 1;
    E.scene.fog.far *= lerp(1, fogMul, k);
    if (this.flash > 0) { this.flash = Math.max(0, this.flash - dt * 4); E.renderer.toneMappingExposure += this.flash * 1.4; }
    if (this.kind === 'rain' || this.kind === 'sand' || this.kind === 'ash') E.sun.intensity *= lerp(1, 0.6, k);
  },
};
G.weather = Weather; // updated by the main loop right after lighting

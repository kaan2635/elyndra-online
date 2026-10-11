// Renderer, scene, camera rig, lights, sky dome and day/night cycle.
import * as THREE from 'three';
import { G } from '../core/state.js';
import { clamp, lerp, damp, smoothstep } from '../core/util.js';
import { EffectComposer } from '../../lib/addons/postprocessing/EffectComposer.js';
import { RenderPass } from '../../lib/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from '../../lib/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from '../../lib/addons/postprocessing/ShaderPass.js';
import { OutputPass } from '../../lib/addons/postprocessing/OutputPass.js';

// Final grade (linear HDR, before tone mapping): gentle contrast/saturation and a soft vignette.
const GradeShader = {
  uniforms: { tDiffuse: { value: null }, sat: { value: 1.1 }, contrast: { value: 1.05 }, vignette: { value: 0.32 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform float sat; uniform float contrast; uniform float vignette; varying vec2 vUv;
    void main(){
      vec4 c = texture2D(tDiffuse, vUv);
      float l = dot(c.rgb, vec3(0.2126, 0.7152, 0.0722));
      c.rgb = mix(vec3(l), c.rgb, sat);
      c.rgb = max(vec3(0.0), (c.rgb - 0.18) * contrast + 0.18);
      vec2 d = vUv - 0.5; float v = smoothstep(0.85, 0.25, length(d * vec2(1.0, 0.85)));
      c.rgb *= mix(1.0 - vignette, 1.0, v);
      gl_FragColor = c;
    }`,
};

const QUALITY = {
  low: { pr: 0.85, shadows: false, shadowSize: 512, far: 120, grass: 0.25, antialias: false, post: false },
  med: { pr: 1.25, shadows: true, shadowSize: 1024, far: 170, grass: 0.6, antialias: false, post: true },
  high: { pr: 1.75, shadows: true, shadowSize: 2048, far: 220, grass: 1, antialias: true, post: true },
  ultra: { pr: 2, shadows: true, shadowSize: 2048, far: 280, grass: 1.3, antialias: true, post: true },
};

export class Engine {
  constructor(canvas) {
    this.canvas = canvas;
    const q = G.settings?.quality || 'med';
    this.qName = q;
    this.q = QUALITY[q] || QUALITY.med;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: this.q.antialias, powerPreference: 'high-performance', stencil: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.q.pr));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.NeutralToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = this.q.shadows;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(55, 1, 0.3, this.q.far + 200);
    G.scene = this.scene; G.camera = this.camera; G.engine = this;

    // lights
    this.hemi = new THREE.HemisphereLight(0xbfd8ff, 0x5a4a32, 1.1);
    this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xfff2d8, 2.2);
    this.sun.castShadow = this.q.shadows;
    this.sun.shadow.mapSize.set(this.q.shadowSize, this.q.shadowSize);
    const sc = this.sun.shadow.camera;
    sc.left = -34; sc.right = 34; sc.top = 34; sc.bottom = -34; sc.near = 1; sc.far = 160;
    this.sun.shadow.bias = -0.0006;
    this.sun.shadow.normalBias = 0.04;
    this.scene.add(this.sun, this.sun.target);
    this.ambientBoost = new THREE.AmbientLight(0xffffff, 0.15);
    this.scene.add(this.ambientBoost);

    this.scene.fog = new THREE.Fog(0xa8c8e8, 40, this.q.far);
    this.sky = makeSky();
    this.scene.add(this.sky);

    // Camera rig state
    this.cam = { yaw: Math.PI * 0.25, pitch: 0.62, dist: 15, tDist: 15, target: new THREE.Vector3(), shake: 0, minDist: 4, maxDist: 34, minPitch: 0.12, maxPitch: 1.35 };
    this._camPos = new THREE.Vector3();

    // day/night
    this.dayTime = 0.35; // 0..1 (0.25 sunrise, 0.5 noon, 0.75 sunset)
    this.dayLength = 24 * 60; // real seconds for a full day
    this.env = null; // zone environment palette
    this.indoor = false;

    this.setupPost();
    this.resize();
    window.addEventListener('resize', () => this.resize());
    window.visualViewport?.addEventListener('resize', () => this.resize());
  }

  setupPost() {
    const R = this.renderer;
    const rt = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples: this.q.antialias ? 4 : 0 });
    this.composer = new EffectComposer(R, rt);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.38, 0.5, 1.25);
    this.composer.addPass(this.bloom);
    this.grade = new ShaderPass(GradeShader);
    this.composer.addPass(this.grade);
    this.composer.addPass(new OutputPass());
  }
  setQuality(name) {
    this.qName = name;
    this.q = QUALITY[name] || QUALITY.med;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.q.pr));
    this.renderer.shadowMap.enabled = this.q.shadows;
    this.sun.castShadow = this.q.shadows;
    if (this.sun.shadow.map) { this.sun.shadow.map.dispose(); this.sun.shadow.map = null; }
    this.sun.shadow.mapSize.set(this.q.shadowSize, this.q.shadowSize);
    this.camera.far = this.q.far + 200; this.camera.updateProjectionMatrix();
    this.scene.traverse(o => { if (o.material) { const m = Array.isArray(o.material) ? o.material : [o.material]; m.forEach(mm => mm.needsUpdate = true); } });
    this.resize();
  }

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    if (this.composer) {
      this.composer.setPixelRatio(this.renderer.getPixelRatio());
      this.composer.setSize(w, h);
      // bloom at reduced resolution keeps it cheap on phones
      this.bloom.resolution.set(w * 0.5, h * 0.5);
    }
    this.camera.aspect = w / h;
    // wider FOV on portrait phones so you can still see around you
    this.camera.fov = w < h ? 68 : 55;
    this.camera.updateProjectionMatrix();
    G.events.emit('resize', w, h);
  }

  // Apply a zone environment: {sky:[top,horizon,bottom], fog, fogNear, fogFar, sun, hemiSky, hemiGround, night:{...}}
  setEnv(env) { this.env = env; this.indoor = !!env.indoor; this.sky.visible = !env.indoor; }

  updateCamera(dt, focus) {
    const c = this.cam;
    c.dist = damp(c.dist, c.tDist, 10, dt);
    c.target.set(focus.x, focus.y + 1.5, focus.z);
    const cp = Math.cos(c.pitch);
    const x = c.target.x + Math.sin(c.yaw) * cp * c.dist;
    const z = c.target.z + Math.cos(c.yaw) * cp * c.dist;
    let y = c.target.y + Math.sin(c.pitch) * c.dist;
    if (G.world?.heightAt) {
      // keep the camera above the ground (sample a couple of points along the boom)
      let minY = G.world.heightAt(x, z) + 0.8;
      const mx = (x + c.target.x) / 2, mz = (z + c.target.z) / 2;
      minY = Math.max(minY, G.world.heightAt(mx, mz) + 0.6 - (y - c.target.y) * 0.5);
      if (y < minY) y = minY;
    }
    this._camPos.set(x, y, z);
    if (c.shake > 0) {
      c.shake = Math.max(0, c.shake - dt * 2.5);
      const s = c.shake * c.shake * 0.5 * (G.settings?.camShake === false ? 0 : 1);
      this._camPos.x += (Math.random() - 0.5) * s; this._camPos.y += (Math.random() - 0.5) * s; this._camPos.z += (Math.random() - 0.5) * s;
    }
    this.camera.position.copy(this._camPos);
    this.camera.lookAt(c.target);
  }
  shake(amount) { this.cam.shake = Math.min(1.2, this.cam.shake + amount); }

  updateLighting(dt, focus) {
    const env = this.env; if (!env) return;
    if (!env.indoor && !env.fixedTime) this.dayTime = (this.dayTime + dt / this.dayLength) % 1;
    const t = env.fixedTime ?? this.dayTime;
    // sun angle: 0.25 rise, 0.75 set
    const ang = (t - 0.25) * Math.PI * 2;
    const sunH = Math.sin(ang); // >0 day
    const dayF = env.indoor ? 1 : smoothstep(-0.18, 0.25, sunH);
    const duskF = env.indoor ? 0 : clamp(1 - Math.abs(sunH) / 0.35, 0, 1) * (sunH > -0.25 ? 1 : 0);
    this.daylight = dayF;
    const n = env.night || {};
    const lerpC = (a, b, f, out) => out.set(a).lerp(_tc.set(b), f);

    // Sky colours
    const skyTop = lerpC(n.skyTop ?? 0x0a1030, env.sky[0], dayF, _c1);
    const skyHor = lerpC(n.skyHor ?? 0x1a2448, env.sky[1], dayF, _c2);
    if (duskF > 0 && !env.indoor) skyHor.lerp(_tc.set(env.dusk ?? 0xff9a5a), duskF * 0.55);
    this.sky.material.uniforms.top.value.copy(skyTop);
    this.sky.material.uniforms.horizon.value.copy(skyHor);
    this.sky.material.uniforms.bottom.value.set(env.sky[2]).multiplyScalar(0.3 + 0.7 * dayF);
    this.sky.material.uniforms.night.value = 1 - dayF;
    this.sky.material.uniforms.time.value = G.time;
    // Sun direction
    const sx = Math.cos(ang) * 0.8, sy = Math.max(0.12, Math.abs(sunH)), sz = 0.45;
    _v1.set(sx, sy, sz).normalize();
    this.sky.material.uniforms.sunDir.value.copy(_v1).multiplyScalar(sunH > 0 ? 1 : -1);
    this.sky.material.uniforms.sunDir.value.y = Math.abs(this.sky.material.uniforms.sunDir.value.y);
    this.sky.material.uniforms.sunVis.value = env.indoor ? 0 : clamp(sunH * 4 + 0.3, 0, 1);
    this.sky.position.copy(this.camera.position);

    // fog
    const fogC = lerpC(n.fog ?? 0x141a30, env.fog, dayF, _c3);
    if (duskF > 0) fogC.lerp(_tc.set(env.dusk ?? 0xff9a5a), duskF * 0.25);
    this.scene.fog.color.copy(fogC);
    const far = Math.min(this.q.far, env.fogFar ?? this.q.far);
    this.scene.fog.near = env.fogNear ?? far * 0.3;
    this.scene.fog.far = far * (env.indoor ? 1 : lerp(0.75, 1, dayF));
    if (!env.indoor) this.renderer.setClearColor(fogC);
    else this.renderer.setClearColor(env.fog);

    // lights — the "moon" keeps the scene readable at night
    const sunCol = lerpC(n.sun ?? 0x8090d0, env.sun ?? 0xfff0d8, dayF, _c4);
    if (duskF > 0) sunCol.lerp(_tc.set(0xffa070), duskF * 0.5);
    this.sun.color.copy(sunCol);
    this.sun.intensity = env.indoor ? (env.sunI ?? 1.2) : lerp(0.55, env.sunI ?? 2.3, dayF);
    this.hemi.color.copy(lerpC(n.hemiSky ?? 0x5060a0, env.hemiSky ?? 0xbfd8ff, dayF, _c5));
    this.hemi.groundColor.copy(lerpC(n.hemiGround ?? 0x202030, env.hemiGround ?? 0x5a4a32, dayF, _c6));
    this.hemi.intensity = lerp(env.indoor ? 1 : 0.85, env.hemiI ?? 1.15, dayF);
    this.ambientBoost.intensity = env.indoor ? 0.35 : lerp(0.32, 0.12, dayF);
    this.renderer.toneMappingExposure = env.exposure ?? 1.05;

    // shadow camera follows the focus point
    const lightDir = sunH > 0 ? _v1 : _v2.set(-_v1.x, Math.max(0.35, _v1.y), -_v1.z).normalize();
    if (env.indoor) _v2.set(0.3, 1, 0.4).normalize();
    const d = env.indoor ? _v2 : lightDir;
    this.sun.position.set(focus.x + d.x * 70, focus.y + d.y * 70, focus.z + d.z * 70);
    this.sun.target.position.set(focus.x, focus.y, focus.z);
    // snap shadow camera to texel grid to avoid shimmering
    this.sun.target.updateMatrixWorld();
  }

  render() {
    if (this.composer && this.q.post && G.settings?.post !== false) this.composer.render();
    else this.renderer.render(this.scene, this.camera);
  }
}

const _c1 = new THREE.Color(), _c2 = new THREE.Color(), _c3 = new THREE.Color(), _c4 = new THREE.Color(), _c5 = new THREE.Color(), _c6 = new THREE.Color(), _tc = new THREE.Color();
const _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3();

function makeSky() {
  const geo = new THREE.SphereGeometry(400, 24, 12);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: {
      top: { value: new THREE.Color(0x3a78c8) }, horizon: { value: new THREE.Color(0xbfdcf0) }, bottom: { value: new THREE.Color(0x6a7a5a) },
      sunDir: { value: new THREE.Vector3(0.3, 0.6, 0.4) }, sunVis: { value: 1 }, night: { value: 0 }, time: { value: 0 },
    },
    vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); vec4 p = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_Position = p.xyww; }`,
    fragmentShader: `
      uniform vec3 top; uniform vec3 horizon; uniform vec3 bottom; uniform vec3 sunDir; uniform float sunVis; uniform float night; uniform float time;
      varying vec3 vDir;
      float hash(vec3 p){ p = fract(p*0.3183099+.1); p*=17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
      void main(){
        vec3 d = normalize(vDir);
        float h = d.y;
        vec3 c = h > 0.0 ? mix(horizon, top, pow(smoothstep(0.0, 0.65, h), 0.8)) : mix(horizon, bottom, smoothstep(0.0, -0.25, h));
        float sd = max(dot(d, normalize(sunDir)), 0.0);
        c += vec3(1.0,0.85,0.6) * pow(sd, 18.0) * 0.35 * sunVis;
        c += vec3(1.0,0.95,0.85) * smoothstep(0.9985, 0.9995, sd) * 1.5 * sunVis;
        if (night > 0.01 && h > 0.0) {
          vec3 g = floor(d * 220.0);
          float s = hash(g);
          float tw = 0.6 + 0.4 * sin(time * 2.0 + s * 40.0);
          c += vec3(0.85,0.9,1.0) * step(0.9965, s) * night * tw * smoothstep(0.0, 0.25, h);
          // moon
          vec3 md = normalize(vec3(-sunDir.x, abs(sunDir.y)+0.2, -sunDir.z));
          float m = max(dot(d, md), 0.0);
          c += vec3(0.8,0.85,1.0) * (smoothstep(0.9990, 0.9994, m) * 0.9 + pow(m, 60.0) * 0.12) * night;
        }
        gl_FragColor = vec4(c, 1.0);
        #include <colorspace_fragment>
      }`,
  });
  const m = new THREE.Mesh(geo, mat);
  m.frustumCulled = false;
  m.renderOrder = -10;
  return m;
}

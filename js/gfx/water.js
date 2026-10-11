// Stylised low-poly water / lava surface with shore foam driven by a depth texture.
import * as THREE from 'three';
import { U } from './materials.js';
import { clamp } from '../core/util.js';

export function makeWater(terrain, opts = {}) {
  const size = terrain.size, W = terrain.res + 1, wl = terrain.water;
  // depth texture (RGBA8): depth below water mapped -2..10 → 0..255
  const data = new Uint8Array(W * W * 4);
  for (let i = 0; i < W * W; i++) {
    const d = clamp((wl - terrain.H[i] + 2) / 12, 0, 1);
    data[i * 4] = Math.round(d * 255); data[i * 4 + 3] = 255;
  }
  const tex = new THREE.DataTexture(data, W, W, THREE.RGBAFormat);
  tex.magFilter = THREE.LinearFilter; tex.minFilter = THREE.LinearFilter; tex.needsUpdate = true;

  const lava = !!opts.lava;
  const seg = Math.min(96, Math.round(size / 5));
  const geo = new THREE.PlaneGeometry(size, size, seg, seg);
  geo.rotateX(-Math.PI / 2);
  const uniforms = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
    dTex: { value: tex }, size: { value: size }, time: U.time,
    shallow: { value: new THREE.Color(opts.shallow ?? (lava ? 0xffb030 : 0x4ec0c8)) },
    deep: { value: new THREE.Color(opts.deep ?? (lava ? 0xc02808 : 0x1a4f8a)) },
    foam: { value: new THREE.Color(opts.foam ?? (lava ? 0xffe890 : 0xf2fbff)) },
    sunDir: { value: new THREE.Vector3(0.4, 0.7, 0.3).normalize() },
    light: { value: 1 }, lava: { value: lava ? 1 : 0 },
  }]);
  uniforms.time = U.time;
  uniforms.dTex = { value: tex }; // merge() clones textures; keep the original upload
  const mat = new THREE.ShaderMaterial({
    uniforms, transparent: !lava, fog: true, depthWrite: lava,
    extensions: { derivatives: true },
    vertexShader: `
      uniform float time; varying vec3 vW;
      #include <fog_pars_vertex>
      void main(){
        vec3 p = position;
        vec4 wp = modelMatrix * vec4(p, 1.0);
        wp.y += sin(wp.x * 0.35 + time * 1.2) * 0.08 + cos(wp.z * 0.42 + time * 0.9) * 0.08;
        vW = wp.xyz;
        vec4 mvPosition = viewMatrix * wp;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: `
      uniform sampler2D dTex; uniform float size; uniform float time; uniform vec3 shallow; uniform vec3 deep; uniform vec3 foam;
      uniform vec3 sunDir; uniform float light; uniform float lava;
      varying vec3 vW;
      #include <fog_pars_fragment>
      void main(){
        vec2 uv = (vW.xz + size * 0.5) / size;
        float depth = texture2D(dTex, uv).r * 12.0 - 2.0;
        vec3 n = normalize(cross(dFdx(vW), dFdy(vW)));
        if (n.y < 0.0) n = -n;
        float dk = clamp(depth / 5.0, 0.0, 1.0);
        vec3 c = mix(shallow, deep, dk);
        float w = sin(vW.x * 0.9 + time * 1.4) * sin(vW.z * 0.8 - time * 1.1);
        c += 0.035 * w;
        float diff = clamp(dot(n, sunDir), 0.0, 1.0);
        c *= (0.75 + 0.35 * diff) * light;
        vec3 vdir = normalize(cameraPosition - vW);
        vec3 h = normalize(vdir + sunDir);
        float spec = pow(max(dot(n, h), 0.0), 60.0);
        c += vec3(1.0, 0.95, 0.85) * spec * 0.6 * light * (1.0 - lava);
        float edge = depth + 0.18 * sin(time * 2.2 + vW.x * 0.6 + vW.z * 0.4);
        float f = smoothstep(0.55, 0.05, edge);
        float f2 = smoothstep(0.05, 0.0, abs(edge - 0.9 - 0.25 * sin(time * 0.8))) * 0.5;
        c = mix(c, foam, clamp(f + f2, 0.0, 1.0) * (lava > 0.5 ? 0.9 : 0.75));
        if (lava > 0.5) {
          float cr = sin(vW.x * 0.5 + time * 0.6) * sin(vW.z * 0.45 - time * 0.4) + sin((vW.x - vW.z) * 0.2 + time * 0.3);
          c = mix(c, vec3(1.0, 0.85, 0.35), smoothstep(0.9, 1.6, cr) * 0.6);
          c *= 1.4;
        }
        float fres = pow(1.0 - max(dot(vdir, n), 0.0), 3.0);
        float a = mix(0.62, 0.92, dk) + fres * 0.15;
        gl_FragColor = vec4(c, lava > 0.5 ? 1.0 : clamp(a, 0.0, 1.0));
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.y = wl;
  mesh.renderOrder = 2;
  mesh.name = 'water';
  mesh.userData.setLight = (sunDir, l) => { uniforms.sunDir.value.copy(sunDir); uniforms.light.value = l; };
  return mesh;
}

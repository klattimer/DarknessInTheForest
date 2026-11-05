import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const K = 0.001; // ly -> world units
const MAX_RINGS = 600, RING_SEG = 48, MAX_LINES = 300;

const STAR_VS = `
uniform float uTime; uniform float uSize;
attribute vec4 aOrbit;
void main() {
  float a = aOrbit.y + aOrbit.z * uTime;
  vec3 p = vec3(aOrbit.x * cos(a), aOrbit.w, aOrbit.x * sin(a)) * ${K.toFixed(3)};
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  gl_PointSize = uSize;
}`;
const STAR_FS = `
uniform vec3 uColor;
void main() {
  float d = length(gl_PointCoord - 0.5);
  if (d > 0.5) discard;
  gl_FragColor = vec4(uColor, (1.0 - d * 2.0) * 0.8);
}`;
const CIV_VS = `
attribute vec3 aColor; attribute float aSize; varying vec3 vColor;
void main() {
  vColor = aColor;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = aSize;
}`;
const CIV_FS = `
varying vec3 vColor;
void main() {
  float d = length(gl_PointCoord - 0.5);
  if (d > 0.5) discard;
  gl_FragColor = vec4(vColor, 1.0);
}`;

export class View {
  constructor(canvas) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(50, 1, 0.01, 5000);
    this.camera.position.set(0, 70, 70);
    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.rings = [];
    this.lines = [];
    this.tmp = new THREE.Color();
    addEventListener('resize', () => this.resize());
    this.resize();
  }

  resize() {
    this.renderer.setSize(innerWidth, innerHeight, false);
    this.camera.aspect = innerWidth / innerHeight;
    this.camera.updateProjectionMatrix();
  }

  build(sim) {
    if (this.group) {
      this.scene.remove(this.group);
      this.group.traverse(o => { o.geometry?.dispose(); o.material?.dispose(); });
    }
    this.group = new THREE.Group();
    this.scene.add(this.group);
    this.rings = [];
    this.lines = [];
    this.sim = sim;

    const n = sim.stars.length / 4;
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    sg.setAttribute('aOrbit', new THREE.BufferAttribute(sim.stars, 4));
    this.starUniforms = { uTime: { value: 0 }, uSize: { value: 1.6 }, uColor: { value: new THREE.Color() } };
    const stars = new THREE.Points(sg, new THREE.ShaderMaterial({
      uniforms: this.starUniforms, vertexShader: STAR_VS, fragmentShader: STAR_FS,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    stars.frustumCulled = false;
    this.group.add(stars);

    const m = sim.civs.length;
    this.civPos = new Float32Array(Math.max(m, 1) * 3);
    this.civColor = new Float32Array(Math.max(m, 1) * 3);
    this.civSize = new Float32Array(Math.max(m, 1));
    const cg = new THREE.BufferGeometry();
    cg.setAttribute('position', new THREE.BufferAttribute(this.civPos, 3));
    cg.setAttribute('aColor', new THREE.BufferAttribute(this.civColor, 3));
    cg.setAttribute('aSize', new THREE.BufferAttribute(this.civSize, 1));
    this.civGeom = cg;
    const civs = new THREE.Points(cg, new THREE.ShaderMaterial({
      vertexShader: CIV_VS, fragmentShader: CIV_FS, transparent: true, depthWrite: false,
    }));
    civs.frustumCulled = false;
    this.group.add(civs);

    const bh = new THREE.BufferGeometry();
    bh.setAttribute('position', new THREE.BufferAttribute(new Float32Array(3), 3));
    bh.setAttribute('aColor', new THREE.BufferAttribute(new Float32Array([1, 0.8, 0.4]), 3));
    bh.setAttribute('aSize', new THREE.BufferAttribute(new Float32Array([9]), 1));
    this.group.add(new THREE.Points(bh, civs.material));

    this.ringPos = new Float32Array(MAX_RINGS * RING_SEG * 6);
    this.ringCol = new Float32Array(MAX_RINGS * RING_SEG * 6);
    this.ringGeom = this.lineGeom(this.ringPos, this.ringCol);
    this.group.add(this.lineObject(this.ringGeom));

    this.linePos = new Float32Array(MAX_LINES * 6);
    this.lineCol = new Float32Array(MAX_LINES * 6);
    this.hitGeom = this.lineGeom(this.linePos, this.lineCol);
    this.group.add(this.lineObject(this.hitGeom));
  }

  lineGeom(pos, col) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.setDrawRange(0, 0);
    return g;
  }

  lineObject(g) {
    const o = new THREE.LineSegments(g, new THREE.LineBasicMaterial({
      vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    o.frustumCulled = false;
    return o;
  }

  spawnRing(civ, now) {
    if (this.rings.length >= MAX_RINGS) return;
    const p = this.sim.pos(civ, this.sim.t);
    this.rings.push({ x: p.x * K, y: p.y * K, z: p.z * K, range: civ.range * K, born: now });
  }

  spawnHit(h, now) {
    if (this.lines.length >= MAX_LINES) return;
    this.lines.push({ a: h.from, b: h.to, born: now });
  }

  update(cfg, now) {
    const sim = this.sim;
    this.renderer.setClearColor(cfg.colorBackground);
    this.starUniforms.uTime.value = (sim.t * cfg.orbitExaggeration) % 1e9;
    this.starUniforms.uSize.value = cfg.starSize;
    this.starUniforms.uColor.value.set(cfg.colorStar);

    const star = new THREE.Color(cfg.colorStar), emit = new THREE.Color(cfg.colorEmission), hit = new THREE.Color(cfg.colorHit);
    const flashMs = cfg.flashSeconds * 1000;
    const c = this.tmp, p = {};
    sim.civs.forEach((civ, i) => {
      sim.pos(civ, sim.t, p);
      this.civPos.set([p.x * K, p.y * K, p.z * K], i * 3);
      let size = 3;
      if (sim.t < civ.tFirst) c.copy(star).multiplyScalar(0.6);
      else if (sim.t <= civ.tEnd) { c.copy(star).lerp(emit, 0.5); size = 6; }
      else { c.copy(star).multiplyScalar(0.3); }
      const f = 1 - (now - civ.flash) / flashMs;
      if (f > 0) { c.lerp(hit, f); size += 12 * f; }
      this.civColor.set([c.r, c.g, c.b], i * 3);
      this.civSize[i] = size * this.renderer.getPixelRatio();
    });
    this.civGeom.attributes.position.needsUpdate = true;
    this.civGeom.attributes.aColor.needsUpdate = true;
    this.civGeom.attributes.aSize.needsUpdate = true;

    const life = cfg.ringSeconds * 1000;
    this.rings = this.rings.filter(r => now - r.born < life);
    let v = 0;
    for (const r of this.rings) {
      const age = (now - r.born) / life;
      const rad = r.range * cfg.ringScale * age, fade = 1 - age;
      for (let s = 0; s < RING_SEG; s++) {
        for (let e = 0; e < 2; e++) {
          const a = (s + e) / RING_SEG * Math.PI * 2;
          this.ringPos.set([r.x + rad * Math.cos(a), r.y, r.z + rad * Math.sin(a)], v * 3);
          this.ringCol.set([emit.r * fade, emit.g * fade, emit.b * fade], v * 3);
          v++;
        }
      }
    }
    this.ringGeom.setDrawRange(0, v);
    this.ringGeom.attributes.position.needsUpdate = true;
    this.ringGeom.attributes.color.needsUpdate = true;

    const lineLife = flashMs * 1.5;
    this.lines = this.lines.filter(l => now - l.born < lineLife);
    v = 0;
    for (const l of this.lines) {
      const fade = 1 - (now - l.born) / lineLife;
      this.linePos.set([l.a.x * K, l.a.y * K, l.a.z * K, l.b.x * K, l.b.y * K, l.b.z * K], v * 3);
      for (let e = 0; e < 2; e++) this.lineCol.set([hit.r * fade, hit.g * fade, hit.b * fade], (v + e) * 3);
      v += 2;
    }
    this.hitGeom.setDrawRange(0, v);
    this.hitGeom.attributes.position.needsUpdate = true;
    this.hitGeom.attributes.color.needsUpdate = true;

    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }
}

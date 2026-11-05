import { mulberry32, gauss, samplePosition, circularSpeed, drake, poisson, rangeLy } from './physics.js';

const MAX_SEGMENTS = 2000;
const MAX_STEP_SEGMENTS = 500;

export class Simulation {
  constructor(p) {
    this.p = { ...p };
    const rng = mulberry32(p.seed);

    const n = p.starCount;
    this.stars = new Float32Array(n * 4); // R, theta0, omega (rad/yr), z
    for (let i = 0; i < n; i++) {
      const s = samplePosition(rng, p);
      this.stars.set([s.R, s.theta, circularSpeed(s.R, p) / s.R, s.z], i * 4);
    }

    this.drake = drake(p);
    const count = Math.min(p.maxCivs, poisson(rng, this.drake.nSpan));
    this.civs = [];
    for (let i = 0; i < count; i++) {
      const s = samplePosition(rng, p);
      const emergence = rng() * p.historySpan;
      const delay = Math.exp(Math.log(p.radioDelayMedian) + p.radioDelaySigma * gauss(rng));
      const mean = rng() < p.pSelfDestruct ? p.selfDestructMean : p.survivorMean;
      const duration = -Math.log(1 - rng()) * mean;
      const power = 10 ** (Math.log10(p.txPower) + p.txPowerSigma * gauss(rng));
      const nSeg = Math.max(1, Math.min(MAX_SEGMENTS, Math.ceil(duration / p.segmentYears)));
      const tFirst = emergence + delay;
      this.civs.push({
        id: i, R: s.R, theta: s.theta, z: s.z, omega: circularSpeed(s.R, p) / s.R,
        tFirst, tEnd: tFirst + duration, duration, power,
        range: rangeLy(power, p), nSeg, segLen: duration / nSeg,
        flash: -1e9, lastRing: -1e9,
      });
    }

    this.t = 0;
    this.pairs = new Set();
    this.stats = { events: 0, selfHits: 0 };
    this.log = [];
  }

  pos(civ, tYears, out = {}) {
    const a = civ.theta + civ.omega * tYears * this.p.orbitExaggeration;
    out.x = civ.R * Math.cos(a);
    out.y = civ.z;
    out.z = civ.R * Math.sin(a);
    return out;
  }

  setExaggeration(v) { this.p.orbitExaggeration = v; }

  step(dt) {
    const prev = this.t, t = prev + dt;
    this.t = t;
    const live = [], recv = [], emitting = [];
    let ended = 0;
    for (const c of this.civs) {
      if (c.tFirst > t) continue;
      if (c.tEnd >= prev) recv.push(c);
      if (c.tEnd + c.range >= prev) live.push(c);
      if (c.tEnd >= t) emitting.push(c); else ended++;
    }
    this.counts = { emitting: emitting.length, ended };

    const hits = [];
    if (!recv.length) return { emitting, hits };
    const physical = this.p.orbitExaggeration === 1;
    const rp = recv.map(r => this.pos(r, t, {}));
    const o = {};

    for (const e of live) {
      const i1 = Math.min(e.nSeg - 1, Math.floor((t - e.tFirst) / e.segLen));
      let i0 = Math.max(0, Math.floor((prev - e.range - e.tFirst) / e.segLen));
      i0 = Math.max(i0, i1 - MAX_STEP_SEGMENTS);
      for (let i = i0; i <= i1; i++) {
        const tS = e.tFirst + i * e.segLen;
        this.pos(e, tS + e.segLen / 2, o);
        for (let k = 0; k < recv.length; k++) {
          const r = recv[k];
          if (r === e && !physical) continue;
          const q = rp[k];
          const d = Math.hypot(q.x - o.x, q.y - o.y, q.z - o.z);
          if (d > e.range) continue;
          const arrival = tS + d;
          if (arrival <= prev || arrival > t) continue;
          if (arrival < r.tFirst || arrival > r.tEnd) continue;
          this.stats.events++;
          if (r === e) this.stats.selfHits++;
          const key = e.id + '>' + r.id;
          if (!this.pairs.has(key)) {
            this.pairs.add(key);
            this.log.push({ t: arrival, from: e.id, to: r.id, d });
            if (this.log.length > 8) this.log.shift();
          }
          if (hits.length < 50) hits.push({ from: { x: o.x, y: o.y, z: o.z }, to: { x: q.x, y: q.y, z: q.z }, receiver: r });
        }
      }
    }
    return { emitting, hits };
  }
}

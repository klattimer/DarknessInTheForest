import { DEFAULTS } from './config.js';
import { Simulation } from './sim.js';
import { View } from './render.js';
import { buildPanel, exportConfig, importConfig } from './ui.js';
import { selfIntercept, rangeLy, expectedNeighbours, LY } from './physics.js';

const config = { ...DEFAULTS };
const view = new View(document.getElementById('view'));
const statsEl = document.getElementById('stats');
const panel = document.getElementById('panel');
let sim, playing = true, regenTimer = 0, lastFrame = performance.now(), lastStats = 0;

function regenerate() {
  sim = new Simulation(config);
  view.build(sim);
}

function renderPanel() {
  buildPanel(panel, config, (_key, live) => {
    if (live) return;
    clearTimeout(regenTimer);
    regenTimer = setTimeout(regenerate, 400);
  });
}

const fmt = (x, d = 3) => !Number.isFinite(x) ? String(x) : (x !== 0 && (Math.abs(x) >= 1e6 || Math.abs(x) < 1e-3)) ? x.toExponential(d - 1) : (+x.toFixed(d)).toString();

function updateStats() {
  const d = sim.drake;
  const si = selfIntercept(config, config.selfOrbitRadius, sim.civs.length);
  const medRange = rangeLy(config.txPower, config);
  const neigh = expectedNeighbours(d.nSpan, medRange, 26000, config);
  const c = sim.counts ?? { emitting: 0, ended: 0 };
  const rKm = si.rCrit * LY / 1000;
  const log = sim.log.map(h => `  t=${fmt(h.t, 4)} yr  #${h.from} -> #${h.to}  ${fmt(h.d, 4)} ly`).join('\n') || '  none yet';

  statsEl.innerHTML = `<h4>Drake</h4>` +
`N = R*·fp·ne·fl·fi·fc·L
P(civ per star) = ${fmt(d.pLife)}
Mean emission life L = ${fmt(d.L)} yr
N active at any time = ${fmt(d.nActive)}
Civs in span (simulated) = ${sim.civs.length}
<h4>Simulation</h4>` +
`Time = ${fmt(sim.t, 5)} yr
Emitting now = ${c.emitting}   Silent (ended) = ${c.ended}
Unique civ pairs that heard = ${sim.pairs.size}
Hit events = ${sim.stats.events}
Self-intercepts = ${sim.stats.selfHits}
Median signal range = ${fmt(medRange)} ly
Expected civs inside one range (at 26 kly) = ${fmt(neigh)}
Recent first contacts:
${log}
<h4>Self-intercept at r = ${fmt(config.selfOrbitRadius, 0)} ly</h4>` +
`Orbital speed = ${fmt(si.v * 299792.458)} km/s (${fmt(si.v)} c)
Orbital period = ${fmt(si.period)} yr
Signal shell radius at return = ${fmt(si.shellRadiusAtReturn)} ly
Max (distance/c·t) of orbiter = ${fmt(si.maxChordRatio)}
Intercept possible here: ${si.possibleAtRadius ? 'yes' : 'no (needs v ≥ c)'}
Critical radius (v = c) = ${fmt(si.rCrit)} ly = ${fmt(rKm)} km
Schwarzschild radius = ${fmt(si.rs * LY / 1000)} km
Fraction of stars inside = ${fmt(si.fraction)}
P(any civ inside) = ${fmt(si.pAny)}
Duration needed: unbounded. A c-speed shell stays ahead of any orbiter with v < c.`;
}

function frame(now) {
  const dt = Math.min((now - lastFrame) / 1000, 0.1);
  lastFrame = now;
  sim.setExaggeration(config.orbitExaggeration);
  if (playing) {
    const { emitting, hits } = sim.step(dt * config.timeScale);
    for (const civ of emitting) {
      if (now - civ.lastRing > 400) { civ.lastRing = now; view.spawnRing(civ, now); }
    }
    for (const h of hits) { h.receiver.flash = now; view.spawnHit(h, now); }
  }
  view.update(config, now);
  if (now - lastStats > 250) { lastStats = now; updateStats(); }
  requestAnimationFrame(frame);
}

document.getElementById('btnPlay').onclick = e => {
  playing = !playing;
  e.target.textContent = playing ? 'Pause' : 'Play';
};
document.getElementById('btnRegen').onclick = regenerate;
document.getElementById('btnExport').onclick = () => exportConfig(config);
document.getElementById('btnReset').onclick = () => { Object.assign(config, DEFAULTS); renderPanel(); regenerate(); };
const fileInput = document.getElementById('fileImport');
document.getElementById('btnImport').onclick = () => fileInput.click();
fileInput.onchange = async () => {
  const file = fileInput.files[0];
  if (!file) return;
  try {
    importConfig(await file.text(), config);
  } catch (err) {
    alert('Invalid config file: ' + err.message);
  }
  fileInput.value = '';
  renderPanel();
  regenerate();
};

renderPanel();
regenerate();
requestAnimationFrame(frame);

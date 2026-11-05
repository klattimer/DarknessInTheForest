// live: true = applied without regenerating the simulation.
export const SCHEMA = [
  { group: 'Galaxy', items: [
    { key: 'bhMass', label: 'Central black hole mass (M☉)', value: 4.3e6 },
    { key: 'baryonMass', label: 'Bulge+disc mass (M☉)', value: 6e10 },
    { key: 'plummerScale', label: 'Mass scale radius (ly)', value: 9800 },
    { key: 'haloVelocity', label: 'Halo flat speed (km/s)', value: 150 },
    { key: 'galaxyRadius', label: 'Galaxy radius (ly)', value: 50000 },
    { key: 'discScale', label: 'Disc scale length (ly)', value: 8500 },
    { key: 'discThickness', label: 'Disc scale height (ly)', value: 1000 },
    { key: 'bulgeScale', label: 'Bulge scale radius (ly)', value: 3000 },
    { key: 'bulgeFraction', label: 'Bulge star fraction', value: 0.2 },
    { key: 'starCount', label: 'Rendered stars', value: 40000 },
  ]},
  { group: 'Drake equation', items: [
    { key: 'starFormationRate', label: 'R* stars formed per year', value: 1.5 },
    { key: 'fp', label: 'fp stars with planets', value: 1 },
    { key: 'ne', label: 'ne habitable planets / system', value: 0.2 },
    { key: 'fl', label: 'fl life emerges', value: 0.1 },
    { key: 'fi', label: 'fi intelligence', value: 0.01 },
    { key: 'fc', label: 'fc becomes radio-capable', value: 0.1 },
    { key: 'historySpan', label: 'Simulated history span (yr)', value: 1e7 },
    { key: 'maxCivs', label: 'Max civilisations simulated', value: 20000 },
  ]},
  { group: 'Civilisation timeline', items: [
    { key: 'radioDelayMedian', label: 'Median time to first emission (yr)', value: 3000 },
    { key: 'radioDelaySigma', label: 'Delay log-normal sigma', value: 1.0 },
    { key: 'pSelfDestruct', label: 'P(self-destruct early)', value: 0.6 },
    { key: 'selfDestructMean', label: 'Mean emission time if self-destruct (yr)', value: 200 },
    { key: 'survivorMean', label: 'Mean emission time if survive (yr)', value: 1e5 },
  ]},
  { group: 'Signal', items: [
    { key: 'txPower', label: 'Median EIRP (W)', value: 1e13 },
    { key: 'txPowerSigma', label: 'EIRP spread (log10 sigma)', value: 1.0 },
    { key: 'backgroundFlux', label: 'Background threshold (W/m²)', value: 1e-26 },
    { key: 'segmentYears', label: 'Emission segment length (yr)', value: 500 },
  ]},
  { group: 'Simulation', items: [
    { key: 'seed', label: 'Random seed', value: 42 },
    { key: 'timeScale', label: 'Time scale (yr per real s)', value: 20000, live: true },
    { key: 'orbitExaggeration', label: 'Orbit speed multiplier (1 = physical)', value: 1000, live: true,
      hint: 'Values above 1 are cosmetic and disable self-intercept detection.' },
    { key: 'selfOrbitRadius', label: 'Self-intercept: orbit radius (ly)', value: 26000, live: true },
  ]},
  { group: 'Display', items: [
    { key: 'colorStar', label: 'Points', type: 'color', value: '#ffffff', live: true },
    { key: 'colorEmission', label: 'Radio emissions', type: 'color', value: '#ff2020', live: true },
    { key: 'colorHit', label: 'Hit flash', type: 'color', value: '#38ff7a', live: true },
    { key: 'colorBackground', label: 'Background', type: 'color', value: '#000000', live: true },
    { key: 'starSize', label: 'Star size (px)', value: 1.6, live: true },
    { key: 'ringScale', label: 'Ring radius multiplier (visual)', value: 60, live: true },
    { key: 'ringSeconds', label: 'Ring duration (real s)', value: 2, live: true },
    { key: 'flashSeconds', label: 'Hit flash duration (real s)', value: 2, live: true },
  ]},
];

export const DEFAULTS = Object.fromEntries(
  SCHEMA.flatMap(g => g.items.map(i => [i.key, i.value]))
);

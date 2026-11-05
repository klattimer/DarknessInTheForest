// Units: lengths in light-years, time in years, so c = 1.
export const G_SI = 6.6743e-11;
export const MSUN = 1.98847e30;
export const LY = 9.4607304725808e15;
export const YEAR = 31557600;
export const G_LY = G_SI * MSUN * YEAR * YEAR / LY ** 3; // ly^3 / (Msun yr^2)
const KMS_TO_LYYR = 1000 * YEAR / LY;

export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function gauss(rng) {
  return Math.sqrt(-2 * Math.log(1 - rng())) * Math.cos(2 * Math.PI * rng());
}

const expo = (rng, scale) => -Math.log(1 - rng()) * scale;

// Circular speed (ly/yr, i.e. fraction of c): black hole + Plummer mass + softened flat halo.
export function circularSpeed(r, p) {
  r = Math.max(r, 1e-9);
  const a = p.plummerScale;
  const vh = p.haloVelocity * KMS_TO_LYYR;
  const v2 = G_LY * p.bhMass / r
    + G_LY * p.baryonMass * r * r / (r * r + a * a) ** 1.5
    + vh * vh * r * r / (r * r + a * a);
  return Math.sqrt(v2);
}

export function samplePosition(rng, p) {
  for (;;) {
    let R, z;
    if (rng() < p.bulgeFraction) {
      const r = expo(rng, p.bulgeScale) + expo(rng, p.bulgeScale) + expo(rng, p.bulgeScale);
      const u = 2 * rng() - 1;
      R = r * Math.sqrt(1 - u * u);
      z = r * u;
    } else {
      R = expo(rng, p.discScale) + expo(rng, p.discScale);
      z = (rng() < 0.5 ? -1 : 1) * expo(rng, p.discThickness);
    }
    if (R <= p.galaxyRadius) return { R: Math.max(R, 1), theta: rng() * 2 * Math.PI, z };
  }
}

export function drake(p) {
  const pLife = p.fp * p.ne * p.fl * p.fi * p.fc;
  const L = p.pSelfDestruct * p.selfDestructMean + (1 - p.pSelfDestruct) * p.survivorMean;
  return {
    pLife,
    L,
    nActive: p.starFormationRate * pLife * L,
    nSpan: p.starFormationRate * pLife * p.historySpan,
  };
}

export function poisson(rng, mean) {
  if (mean > 50) return Math.max(0, Math.round(mean + Math.sqrt(mean) * gauss(rng)));
  const limit = Math.exp(-mean);
  let k = 0, prod = rng();
  while (prod > limit) { k++; prod *= rng(); }
  return k;
}

export function rangeLy(powerW, p) {
  return Math.sqrt(powerW / (4 * Math.PI * p.backgroundFlux)) / LY;
}

// Fraction of stars within a sphere of radius r of the centre.
export function fractionWithin(r, p) {
  const x = r / p.bulgeScale;
  const bulge = x < 1e-2 ? x ** 3 / 6 : 1 - Math.exp(-x) * (1 + x + x * x / 2);
  const disc = Math.min(1, r ** 3 / (3 * p.discScale ** 2 * p.discThickness));
  return p.bulgeFraction * bulge + (1 - p.bulgeFraction) * disc;
}

// Expected civilisations inside one median signal range at galactocentric radius R (disc density).
export function expectedNeighbours(nTotal, rangeLyValue, R, p) {
  const rho0 = nTotal / (4 * Math.PI * p.discScale ** 2 * p.discThickness);
  const rho = rho0 * Math.exp(-R / p.discScale);
  return rho * (4 / 3) * Math.PI * rangeLyValue ** 3;
}

// A signal at c can never reach an orbiter with v < c, so interception needs v >= c.
export function selfIntercept(p, r, nCivs) {
  const v = circularSpeed(r, p);
  const omega = v / r;
  const period = 2 * Math.PI / omega;
  let lo = 1e-12, hi = 1;
  for (let i = 0; i < 200; i++) {
    const mid = Math.sqrt(lo * hi);
    if (circularSpeed(mid, p) >= 1) lo = mid; else hi = mid;
  }
  const rCrit = lo;
  const rs = 2 * G_LY * p.bhMass;
  const F = fractionWithin(rCrit, p);
  return {
    v, period,
    maxChordRatio: v,
    shellRadiusAtReturn: period,
    rCrit, rs,
    fraction: F,
    pAny: nCivs > 0 ? -Math.expm1(nCivs * Math.log1p(-F)) : 0,
    possibleAtRadius: v >= 1,
  };
}

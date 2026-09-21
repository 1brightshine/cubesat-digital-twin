/**
 * Upper Atmosphere Density Models and Solar Activity Scaling
 * Based on US Standard Atmosphere 1976 / Jacchia-Roberts piecewise exponential model
 */

import { NasaAtmosphereModel } from '../types';

export interface AtmosphericLayer {
  baseAltKm: number;
  baseDensityKgM3: number;
  scaleHeightKm: number;
}

// US Standard Atmosphere / Jacchia piecewise exponential density table
export const ATMOSPHERE_LAYERS: AtmosphericLayer[] = [
  { baseAltKm: 0, baseDensityKgM3: 1.225, scaleHeightKm: 7.249 },
  { baseAltKm: 25, baseDensityKgM3: 3.899e-2, scaleHeightKm: 6.349 },
  { baseAltKm: 30, baseDensityKgM3: 1.774e-2, scaleHeightKm: 6.682 },
  { baseAltKm: 40, baseDensityKgM3: 3.972e-3, scaleHeightKm: 7.554 },
  { baseAltKm: 50, baseDensityKgM3: 1.057e-3, scaleHeightKm: 8.382 },
  { baseAltKm: 60, baseDensityKgM3: 3.206e-4, scaleHeightKm: 7.714 },
  { baseAltKm: 70, baseDensityKgM3: 8.770e-5, scaleHeightKm: 6.549 },
  { baseAltKm: 80, baseDensityKgM3: 1.905e-5, scaleHeightKm: 5.799 },
  { baseAltKm: 90, baseDensityKgM3: 3.396e-6, scaleHeightKm: 5.382 },
  { baseAltKm: 100, baseDensityKgM3: 5.297e-7, scaleHeightKm: 5.877 },
  { baseAltKm: 110, baseDensityKgM3: 9.661e-8, scaleHeightKm: 7.263 },
  { baseAltKm: 120, baseDensityKgM3: 2.438e-8, scaleHeightKm: 9.373 },
  { baseAltKm: 130, baseDensityKgM3: 8.484e-9, scaleHeightKm: 12.60 },
  { baseAltKm: 140, baseDensityKgM3: 3.845e-9, scaleHeightKm: 16.15 },
  { baseAltKm: 150, baseDensityKgM3: 2.070e-9, scaleHeightKm: 22.52 },
  { baseAltKm: 180, baseDensityKgM3: 5.464e-10, scaleHeightKm: 29.74 },
  { baseAltKm: 200, baseDensityKgM3: 2.789e-10, scaleHeightKm: 37.11 },
  { baseAltKm: 250, baseDensityKgM3: 7.248e-11, scaleHeightKm: 45.55 },
  { baseAltKm: 300, baseDensityKgM3: 2.418e-11, scaleHeightKm: 53.63 },
  { baseAltKm: 350, baseDensityKgM3: 9.518e-12, scaleHeightKm: 53.29 },
  { baseAltKm: 400, baseDensityKgM3: 3.725e-12, scaleHeightKm: 58.52 },
  { baseAltKm: 450, baseDensityKgM3: 1.585e-12, scaleHeightKm: 60.83 },
  { baseAltKm: 500, baseDensityKgM3: 6.967e-13, scaleHeightKm: 63.82 },
  { baseAltKm: 600, baseDensityKgM3: 1.454e-13, scaleHeightKm: 71.84 },
  { baseAltKm: 700, baseDensityKgM3: 3.614e-14, scaleHeightKm: 88.09 },
  { baseAltKm: 800, baseDensityKgM3: 1.170e-14, scaleHeightKm: 124.64 },
  { baseAltKm: 900, baseDensityKgM3: 5.245e-15, scaleHeightKm: 181.05 },
  { baseAltKm: 1000, baseDensityKgM3: 3.019e-15, scaleHeightKm: 268.00 },
];

/**
 * Computes NASA Jacchia / MSIS Exospheric Temperature T_infinity (in Kelvin)
 * T_inf = 379 + 3.24 * F10.7_bar + 1.3 * (F10.7 - F10.7_bar) + 28 * Ap^0.4
 */
export function computeNasaExosphericTemp(f107: number, f107Bar = f107, ap = 15): number {
  const tMin = 379 + 3.24 * f107Bar;
  const deltaEuv = 1.3 * (f107 - f107Bar);
  const deltaGeomagnetic = 28 * Math.pow(Math.max(1, ap), 0.4);
  const tInf = tMin + deltaEuv + deltaGeomagnetic;
  return Math.round(Math.max(600, Math.min(2400, tInf)));
}

/**
 * Computes dominant atmospheric constituents and dynamic mean molecular mass (g/mol)
 * based on NASA NRLMSISE-00 / Jacchia thermospheric diffusion profiles
 */
export function getNasaAtmosphericConstituents(altitudeKm: number): {
  meanMolecularWeight: number; // g/mol
  dominantGas: string;
} {
  if (altitudeKm < 100) {
    return { meanMolecularWeight: 28.96, dominantGas: 'N2 / O2' };
  }
  if (altitudeKm < 200) {
    // Photodissociation zone: O2 -> 2O
    const frac = (altitudeKm - 100) / 100;
    return { meanMolecularWeight: 28.96 - frac * (28.96 - 22.0), dominantGas: 'N2 / O' };
  }
  if (altitudeKm < 500) {
    // Atomic oxygen zone (200 - 500 km, primary LEO CubeSat environment)
    const frac = (altitudeKm - 200) / 300;
    return { meanMolecularWeight: 22.0 - frac * (22.0 - 16.0), dominantGas: 'Atomic Oxygen (O)' };
  }
  if (altitudeKm < 800) {
    // Transition from Atomic Oxygen to Helium
    const frac = (altitudeKm - 500) / 300;
    return { meanMolecularWeight: 16.0 - frac * (16.0 - 4.0), dominantGas: 'Helium (He) / O' };
  }
  // Exosphere: Helium and Hydrogen
  return { meanMolecularWeight: 4.0, dominantGas: 'Helium / Hydrogen' };
}

/**
 * Computes standard baseline atmospheric density at altitude (km)
 */
export function getBaseAtmosphericDensity(altitudeKm: number): number {
  if (altitudeKm < 0) return ATMOSPHERE_LAYERS[0].baseDensityKgM3;
  if (altitudeKm >= 1000) {
    const top = ATMOSPHERE_LAYERS[ATMOSPHERE_LAYERS.length - 1];
    return top.baseDensityKgM3 * Math.exp(-(altitudeKm - top.baseAltKm) / top.scaleHeightKm);
  }

  // Find layer
  for (let i = ATMOSPHERE_LAYERS.length - 1; i >= 0; i--) {
    const layer = ATMOSPHERE_LAYERS[i];
    if (altitudeKm >= layer.baseAltKm) {
      const dh = altitudeKm - layer.baseAltKm;
      return layer.baseDensityKgM3 * Math.exp(-dh / layer.scaleHeightKm);
    }
  }

  return ATMOSPHERE_LAYERS[0].baseDensityKgM3;
}

/**
 * Calculates solar activity correction factor based on F10.7 flux and geomagnetic Ap index.
 * F10.7 = 70 sfu (Solar Minimum)
 * F10.7 = 130 sfu (Solar Mean)
 * F10.7 = 200 sfu (Solar Maximum)
 */
export function getSolarActivityFactor(
  altitudeKm: number,
  f107Flux: number,
  apIndex = 15
): number {
  if (altitudeKm < 100) return 1.0;

  // Altitude sensitivity factor (peaks in thermosphere ~300 - 600 km)
  const altFactor = Math.min(1.0, Math.max(0, (altitudeKm - 100) / 300));
  
  // Normalized delta from mean solar flux (130 sfu)
  const dFlux = (f107Flux - 130) / 70;
  // Geomagnetic disturbance addition
  const dAp = (apIndex - 15) / 50;

  // Scale density factor: at 400km, flux 200 multiplies density by ~4.5x, flux 70 decreases to ~0.35x
  const exponent = (dFlux * 1.5 + dAp * 0.4) * altFactor;
  const factor = Math.exp(exponent);

  // Clamp within realistic physics bounds [0.1, 15]
  return Math.max(0.1, Math.min(15.0, factor));
}

/**
 * Calculates dynamic thermospheric scale height H (km) based on NASA DAS / Jacchia
 * H = (R_gas * T) / (M_bar * g)
 */
export function getNasaScaleHeight(
  altitudeKm: number,
  f107Flux = 130,
  apIndex = 15
): number {
  const R_gas = 8314.46; // J / (kmol K)
  const g0 = 9.80665;
  const Re = 6378.137;
  const g_local = g0 * Math.pow(Re / (Re + altitudeKm), 2); // m/s²

  const tInf = computeNasaExosphericTemp(f107Flux, f107Flux, apIndex);
  // Thermosphere temperature profile asymptotically approaching T_inf
  const tLocal = altitudeKm < 120 ? 180 + (altitudeKm - 80) * 4 : Math.min(tInf, 350 + (tInf - 350) * (1 - Math.exp(-(altitudeKm - 120) / 100)));

  const { meanMolecularWeight } = getNasaAtmosphericConstituents(altitudeKm);
  const H_meters = (R_gas * tLocal) / (meanMolecularWeight * g_local);
  return Math.max(5.0, Math.round((H_meters / 1000) * 10) / 10);
}

/**
 * Calculates total atmospheric density at altitude taking solar activity and NASA physics model into account
 */
export function getAtmosphericDensity(
  altitudeKm: number,
  f107Flux = 130,
  apIndex = 15,
  model: NasaAtmosphereModel = 'nasa-das'
): number {
  if (model === 'us-standard-1976') {
    return getBaseAtmosphericDensity(altitudeKm);
  }

  const base = getBaseAtmosphericDensity(altitudeKm);
  const solarFactor = getSolarActivityFactor(altitudeKm, f107Flux, apIndex);

  if (model === 'jacchia-roberts') {
    return base * solarFactor;
  }

  // NASA DAS 3.0 / NRLMSISE-00 model: incorporates dynamic thermospheric scale height expansion
  const baseScale = ATMOSPHERE_LAYERS.find(
    (l, idx) => altitudeKm >= l.baseAltKm && (idx === ATMOSPHERE_LAYERS.length - 1 || altitudeKm < ATMOSPHERE_LAYERS[idx + 1].baseAltKm)
  )?.scaleHeightKm || 60;

  const dynamicScale = getNasaScaleHeight(altitudeKm, f107Flux, apIndex);
  // Scale height correction factor: ratio modifies exponential decay above 120 km
  if (altitudeKm > 120) {
    const scaleRatio = Math.max(0.7, Math.min(1.6, dynamicScale / baseScale));
    const correctedSolarFactor = Math.pow(solarFactor, 0.9 + 0.1 * scaleRatio);
    return base * correctedSolarFactor;
  }

  return base * solarFactor;
}

/**
 * Computes NASA SGP4 Drag Parameter B* in (1 / Earth Radii)
 * B* = (rho_0 * Cd * A) / (2 * m)
 * where rho_0 = 0.1570 kg/(m² * R_earth)
 */
export function computeSgp4BStar(
  massKg: number,
  dragAreaM2: number,
  dragCd: number
): number {
  const rho0 = 0.1570; // NASA standard reference density
  const bStar = (rho0 * dragCd * dragAreaM2) / (2 * Math.max(0.01, massKg));
  return bStar;
}

/**
 * Computes Solar Radiation Pressure (SRP) acceleration in m/s² (NASA SP-8000 standard)
 * a_srp = P_sun * (1 + Cr) * (A / m)
 * P_sun at 1 AU = 4.56e-6 N/m²
 */
export function computeSolarRadiationPressureAccel(
  massKg: number,
  areaM2: number,
  reflectivity = 1.3
): number {
  const P_SUN_1AU = 4.56e-6; // N/m²
  const Cr = 1.0 + Math.max(0, Math.min(1, reflectivity - 1)); // Effective radiation pressure coefficient
  return (P_SUN_1AU * Cr * areaM2) / Math.max(0.01, massKg);
}

/**
 * Computes the instantaneous aerodynamic drag deceleration in m/s²
 * a_drag = 0.5 * rho * v^2 * (Cd * A / m)
 */
export function getDragDeceleration(
  altitudeKm: number,
  velocityKmS: number,
  massKg: number,
  dragAreaM2: number,
  dragCd: number,
  f107Flux = 130,
  apIndex = 15,
  model: NasaAtmosphereModel = 'nasa-das'
): number {
  const rho = getAtmosphericDensity(altitudeKm, f107Flux, apIndex, model);
  const vMs = velocityKmS * 1000;
  const aDragMs2 = 0.5 * rho * (vMs * vMs) * ((dragCd * dragAreaM2) / massKg);
  return aDragMs2;
}

/**
 * Predicts solar flux for dynamic 11-year solar cycle given days into simulation
 * Grounded in NOAA / NASA Solar Cycle 25 prediction curves
 */
export function getDynamicSolarFlux(daysSinceStart: number, baseFlux = 130): number {
  const cyclePeriodDays = 11 * 365.25;
  // Sinusoidal variation between ~70 (min) and ~200 (max)
  const angle = (2 * Math.PI * daysSinceStart) / cyclePeriodDays;
  const flux = 135 + 65 * Math.sin(angle);
  return Math.max(65, Math.min(220, flux));
}


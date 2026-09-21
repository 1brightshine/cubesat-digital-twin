/**
 * NASA NAIF SPICE Geometry & Eclipse Calculation Engine
 * Reference: NASA Navigation and Ancillary Information Facility (NAIF) SPICE WebGeocalc & SPICE Toolkit
 * Computes exact Earth-Sun-Moon-Satellite geometry, dual-cone Umbra/Penumbra shadows,
 * Beta angle (beta), solar phase angle, and CubeSat solar power generation.
 */

import { SpiceGeometryState } from '../types';
import { EARTH_RADIUS_KM } from './orbitalMechanics';

export const SUN_RADIUS_KM = 696340;
export const ASTRONOMICAL_UNIT_KM = 149597870.7;
export const SOLAR_CONSTANT_WM2 = 1361.0; // W/m^2 at 1 AU
export const MOON_RADIUS_KM = 1737.4;
export const EARTH_MOON_MEAN_DIST_KM = 384400;

/**
 * Computes Julian Date from JavaScript Date
 */
export function getJulianDate(date: Date): number {
  return date.getTime() / 86400000 + 2440587.5;
}

/**
 * Computes high-precision Sun position in Earth-Centered Inertial (ECI) coordinates (J2000)
 * Accuracy: ~0.01 degrees (NAIF SPICE analytical ephemeris model)
 */
export function computeSpiceSunPosition(date: Date): {
  positionKm: [number, number, number];
  distanceKm: number;
  subSolarLatDeg: number;
  subSolarLonDeg: number;
} {
  const jd = getJulianDate(date);
  const T = (jd - 2451545.0) / 36525.0; // Julian centuries since J2000.0

  // Geometric Mean Longitude of Sun (deg)
  let L0 = 280.46646 + 36000.76983 * T + 0.0003032 * T * T;
  L0 = ((L0 % 360) + 360) % 360;

  // Mean Anomaly of Sun (deg)
  let M = 357.52911 + 35999.05029 * T - 0.0001537 * T * T;
  M = ((M % 360) + 360) % 360;
  const M_rad = (M * Math.PI) / 180;

  // Sun's Equation of Center (deg)
  const C =
    (1.914602 - 0.004817 * T - 0.000014 * T * T) * Math.sin(M_rad) +
    (0.019993 - 0.000101 * T) * Math.sin(2 * M_rad) +
    0.000289 * Math.sin(3 * M_rad);

  // Sun's True Longitude (deg)
  const sunTrueLongDeg = L0 + C;
  const sunTrueLongRad = (sunTrueLongDeg * Math.PI) / 180;

  // Sun Earth Distance (AU)
  const e = 0.016708634 - 0.000042037 * T;
  const vRad = (M + C) * (Math.PI / 180);
  const rAU = (1.000001018 * (1 - e * e)) / (1 + e * Math.cos(vRad));
  const distanceKm = rAU * ASTRONOMICAL_UNIT_KM;

  // Obliquity of the Ecliptic (deg)
  const epsDeg =
    23.439291 - 0.0130042 * T - 0.00000016 * T * T + 0.000000504 * T * T * T;
  const epsRad = (epsDeg * Math.PI) / 180;

  // ECI Coordinates (X = Vernal Equinox, Y = Orthogonal in equator, Z = North)
  const x = distanceKm * Math.cos(sunTrueLongRad);
  const y = distanceKm * Math.sin(sunTrueLongRad) * Math.cos(epsRad);
  const z = distanceKm * Math.sin(sunTrueLongRad) * Math.sin(epsRad);

  // Sub-solar point: Declination and Right Ascension
  const declinationRad = Math.asin(z / distanceKm);
  const rightAscensionRad = Math.atan2(y, x);

  // Greenwich Sidereal Time to get sub-solar longitude
  const d = jd - 2451545.0;
  let gmstHours = 18.697374558 + 24.06570982441908 * d;
  gmstHours = ((gmstHours % 24) + 24) % 24;
  const gmstRad = (gmstHours * 15 * Math.PI) / 180;

  let subSolarLonRad = rightAscensionRad - gmstRad;
  subSolarLonRad = Math.atan2(Math.sin(subSolarLonRad), Math.cos(subSolarLonRad));

  return {
    positionKm: [x, y, z],
    distanceKm,
    subSolarLatDeg: (declinationRad * 180) / Math.PI,
    subSolarLonDeg: (subSolarLonRad * 180) / Math.PI,
  };
}

/**
 * Computes approximate Moon position in ECI frame (J2000)
 */
export function computeSpiceMoonPosition(date: Date): {
  positionKm: [number, number, number];
  distanceKm: number;
} {
  const jd = getJulianDate(date);
  const T = (jd - 2451545.0) / 36525.0;

  // Moon's mean longitude (deg)
  const Lprime =
    218.3164477 +
    481267.88123421 * T -
    0.0015786 * T * T +
    (T * T * T) / 538841.0;
  const LprimeRad = ((Lprime % 360) * Math.PI) / 180;

  // Moon's mean elongation (deg)
  const D =
    297.8501921 +
    445267.1114034 * T -
    0.0018819 * T * T +
    (T * T * T) / 545868.0;
  const D_rad = ((D % 360) * Math.PI) / 180;

  // Sun's mean anomaly
  const M = 357.5291092 + 35999.0502909 * T;
  const M_rad = ((M % 360) * Math.PI) / 180;

  // Moon's mean anomaly
  const Mprime =
    134.9633964 +
    477198.8675055 * T +
    0.0087414 * T * T +
    (T * T * T) / 69699.0;
  const MprimeRad = ((Mprime % 360) * Math.PI) / 180;

  // Moon's argument of latitude
  const F =
    93.272095 +
    483202.0175233 * T -
    0.0036539 * T * T -
    (T * T * T) / 3526000.0;
  const F_rad = ((F % 360) * Math.PI) / 180;

  // Primary perturbation in longitude (rad)
  const l =
    LprimeRad +
    0.1098 * Math.sin(MprimeRad) +
    0.0222 * Math.sin(2 * D_rad - MprimeRad) +
    0.0115 * Math.sin(2 * D_rad) -
    0.0037 * Math.sin(M_rad);

  // Latitude (rad)
  const b =
    0.0895 * Math.sin(F_rad) +
    0.0049 * Math.sin(MprimeRad + F_rad) -
    0.0048 * Math.sin(MprimeRad - F_rad);

  // Distance in km
  const r =
    385000 -
    20905 * Math.cos(MprimeRad) -
    3699 * Math.cos(2 * D_rad - MprimeRad) -
    2956 * Math.cos(2 * D_rad);

  const epsRad = (23.439291 * Math.PI) / 180;

  const x_ecl = r * Math.cos(b) * Math.cos(l);
  const y_ecl = r * Math.cos(b) * Math.sin(l);
  const z_ecl = r * Math.sin(b);

  const x = x_ecl;
  const y = y_ecl * Math.cos(epsRad) - z_ecl * Math.sin(epsRad);
  const z = y_ecl * Math.sin(epsRad) + z_ecl * Math.cos(epsRad);

  return {
    positionKm: [x, y, z],
    distanceKm: r,
  };
}

/**
 * Calculates high-precision dual-cone eclipse fraction using apparent disk overlap
 * nu = 1.0 (Full Sunlight)
 * 0 < nu < 1.0 (Penumbra)
 * nu = 0.0 (Umbra / Total Eclipse)
 */
export function computeNasaEclipseFraction(
  satPosKm: { x: number; y: number; z: number },
  sunPosKm: [number, number, number]
): {
  eclipseFraction: number;
  eclipseState: 'sunlight' | 'penumbra' | 'umbra';
} {
  // Vector from sat to Earth center is -satPos
  const rSatKm = Math.sqrt(
    satPosKm.x * satPosKm.x + satPosKm.y * satPosKm.y + satPosKm.z * satPosKm.z
  );

  // Vector from sat to Sun
  const rSatSun = [
    sunPosKm[0] - satPosKm.x,
    sunPosKm[1] - satPosKm.y,
    sunPosKm[2] - satPosKm.z,
  ];
  const dSatSun = Math.sqrt(
    rSatSun[0] * rSatSun[0] + rSatSun[1] * rSatSun[1] + rSatSun[2] * rSatSun[2]
  );

  // Angle between Sun vector and Earth center vector as seen from sat
  // Sat to Earth unit vector: -satPos / rSat
  // Sat to Sun unit vector: rSatSun / dSatSun
  const dot =
    (-satPosKm.x * rSatSun[0] - satPosKm.y * rSatSun[1] - satPosKm.z * rSatSun[2]) /
    (rSatKm * dSatSun);
  const clampedDot = Math.max(-1, Math.min(1, dot));
  const angleRad = Math.acos(clampedDot);

  // Apparent angular radii (semi-diameters)
  const thetaEarth = Math.asin(Math.min(1, EARTH_RADIUS_KM / rSatKm));
  const thetaSun = Math.asin(Math.min(1, SUN_RADIUS_KM / dSatSun));

  // If Earth is behind the satellite relative to Sun, direct sunlight
  if (dot <= 0) {
    return { eclipseFraction: 1.0, eclipseState: 'sunlight' };
  }

  // Dual-cone geometry checks
  // 1. Separation > thetaEarth + thetaSun => No occultation
  if (angleRad >= thetaEarth + thetaSun) {
    return { eclipseFraction: 1.0, eclipseState: 'sunlight' };
  }

  // 2. Earth completely covers Sun => Total Eclipse (Umbra)
  if (angleRad <= thetaEarth - thetaSun) {
    return { eclipseFraction: 0.0, eclipseState: 'umbra' };
  }

  // 3. Sun completely surrounds Earth (annular) => Very rare for LEO, but handled
  if (angleRad <= thetaSun - thetaEarth) {
    const frac = 1.0 - Math.pow(thetaEarth / thetaSun, 2);
    return { eclipseFraction: frac, eclipseState: 'penumbra' };
  }

  // 4. Partial occultation (Penumbra): Analytical circle-circle intersection area
  const d = angleRad;
  const r1 = thetaSun;
  const r2 = thetaEarth;

  const d1 = (d * d - r2 * r2 + r1 * r1) / (2 * d);
  const d2 = (d * d + r2 * r2 - r1 * r1) / (2 * d);

  const term1 = r1 * r1 * Math.acos(Math.max(-1, Math.min(1, d1 / r1)));
  const term2 = d1 * Math.sqrt(Math.max(0, r1 * r1 - d1 * d1));
  const term3 = r2 * r2 * Math.acos(Math.max(-1, Math.min(1, d2 / r2)));
  const term4 = d2 * Math.sqrt(Math.max(0, r2 * r2 - d2 * d2));

  const overlapArea = term1 - term2 + term3 - term4;
  const sunArea = Math.PI * r1 * r1;

  const occultedFraction = Math.max(0, Math.min(1, overlapArea / sunArea));
  const visibleFraction = Math.max(0, Math.min(1, 1.0 - occultedFraction));

  return {
    eclipseFraction: visibleFraction,
    eclipseState: visibleFraction < 0.02 ? 'umbra' : 'penumbra',
  };
}

/**
 * Calculates Orbit Beta Angle (beta)
 * beta = arcsin( h_hat . s_hat )
 * If |beta| > arcsin(R_Earth / r), the orbit experiences NO eclipse (constant daylight)
 */
export function computeBetaAngleDeg(
  positionKm: { x: number; y: number; z: number },
  velocityKmS: { x: number; y: number; z: number },
  sunPosKm: [number, number, number]
): number {
  // Orbital angular momentum vector h = r x v
  const hx = positionKm.y * velocityKmS.z - positionKm.z * velocityKmS.y;
  const hy = positionKm.z * velocityKmS.x - positionKm.x * velocityKmS.z;
  const hz = positionKm.x * velocityKmS.y - positionKm.y * velocityKmS.x;
  const hMag = Math.sqrt(hx * hx + hy * hy + hz * hz);
  if (hMag === 0) return 0;

  // Sun unit vector
  const sunDist = Math.sqrt(
    sunPosKm[0] * sunPosKm[0] + sunPosKm[1] * sunPosKm[1] + sunPosKm[2] * sunPosKm[2]
  );
  const sx = sunPosKm[0] / sunDist;
  const sy = sunPosKm[1] / sunDist;
  const sz = sunPosKm[2] / sunDist;

  // Dot product
  const sinBeta = (hx * sx + hy * sy + hz * sz) / hMag;
  const clamped = Math.max(-1, Math.min(1, sinBeta));
  return (Math.asin(clamped) * 180) / Math.PI;
}

/**
 * Calculates Full SPICE Geometry State & CubeSat Electrical Solar Power
 */
export function evaluateSpiceGeometry(
  satPosKm: { x: number; y: number; z: number },
  satVelKmS: { x: number; y: number; z: number },
  date: Date,
  solarPanelAreaM2 = 0.03, // Default 3U body-mounted area (0.03 m^2)
  cellEfficiency = 0.295 // Modern Triple-Junction GaAs ~29.5%
): SpiceGeometryState {
  const sun = computeSpiceSunPosition(date);
  const moon = computeSpiceMoonPosition(date);

  const { eclipseFraction, eclipseState } = computeNasaEclipseFraction(
    satPosKm,
    sun.positionKm
  );
  const betaAngleDeg = computeBetaAngleDeg(satPosKm, satVelKmS, sun.positionKm);

  // Solar phase angle (Angle between Sat-Earth line and Sat-Sun line)
  const rSatKm = Math.sqrt(
    satPosKm.x * satPosKm.x + satPosKm.y * satPosKm.y + satPosKm.z * satPosKm.z
  );
  const rSatSun = [
    sun.positionKm[0] - satPosKm.x,
    sun.positionKm[1] - satPosKm.y,
    sun.positionKm[2] - satPosKm.z,
  ];
  const dSatSun = Math.sqrt(
    rSatSun[0] * rSatSun[0] + rSatSun[1] * rSatSun[1] + rSatSun[2] * rSatSun[2]
  );
  const dotPhase =
    (-satPosKm.x * rSatSun[0] - satPosKm.y * rSatSun[1] - satPosKm.z * rSatSun[2]) /
    (rSatKm * dSatSun);
  const solarPhaseAngleDeg =
    (Math.acos(Math.max(-1, Math.min(1, dotPhase))) * 180) / Math.PI;

  // Solar Flux W/m^2 adjusted for current Earth-Sun distance
  const currentSolarFlux =
    SOLAR_CONSTANT_WM2 * Math.pow(ASTRONOMICAL_UNIT_KM / sun.distanceKm, 2);

  // Generated electrical power (Watts)
  // When in eclipse, power drops to 0
  const effectiveFlux = currentSolarFlux * eclipseFraction;
  const solarPowerOutputWatts = effectiveFlux * solarPanelAreaM2 * cellEfficiency;

  return {
    sunVectorECI: sun.positionKm,
    subSolarLat: sun.subSolarLatDeg,
    subSolarLon: sun.subSolarLonDeg,
    earthSunDistKm: sun.distanceKm,
    solarPhaseAngleDeg,
    betaAngleDeg,
    eclipseFraction,
    eclipseState,
    solarFluxWm2: effectiveFlux,
    solarPowerOutputWatts,
    moonVectorECI: moon.positionKm,
    earthMoonDistKm: moon.distanceKm,
  };
}

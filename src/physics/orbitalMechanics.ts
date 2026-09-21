/**
 * High-precision orbital mechanics physics calculations
 * Reference: David A. Vallado, Fundamentals of Astrodynamics and Applications (4th ed.)
 */

import { KeplerianElements, OrbitDerivedState, SolarConditions } from '../types';
import {
  computeNasaExosphericTemp,
  getNasaAtmosphericConstituents,
  getNasaScaleHeight,
  computeSgp4BStar,
  computeSolarRadiationPressureAccel,
  getDragDeceleration,
} from './atmosphere';

export const EARTH_RADIUS_KM = 6378.137; // WGS-84 equatorial radius
export const EARTH_FLATTENING = 1 / 298.257223563;
export const MU_EARTH = 398600.4418; // km³/s²
export const J2_EARTH = 1.08263e-3; // Second zonal gravitational harmonic
export const EARTH_ROTATION_RAD_PER_SEC = 7.2921159e-5; // Sidereal Earth rotation rate
export const SPEED_OF_LIGHT_KM_S = 299792.458;

export function degToRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

export function radToDeg(rad: number): number {
  return (rad * 180) / Math.PI;
}

/**
 * Solves Kepler's equation M = E - e*sin(E) for Eccentric Anomaly E
 * using Newton-Raphson iteration.
 */
export function solveKepler(meanAnomalyRad: number, eccentricity: number): number {
  // Normalize M to [0, 2pi)
  let M = meanAnomalyRad % (2 * Math.PI);
  if (M < 0) M += 2 * Math.PI;

  let E = eccentricity > 0.8 ? Math.PI : M;
  const tolerance = 1e-8;
  const maxIter = 40;

  for (let iter = 0; iter < maxIter; iter++) {
    const f = E - eccentricity * Math.sin(E) - M;
    if (Math.abs(f) < tolerance) break;
    const fPrime = 1 - eccentricity * Math.cos(E);
    E = E - f / fPrime;
  }

  return E;
}

/**
 * Converts Eccentric Anomaly (E) to True Anomaly (nu)
 */
export function eccentricToTrueAnomaly(E_rad: number, e: number): number {
  const beta = e / (1 + Math.sqrt(1 - e * e));
  const nu = E_rad + 2 * Math.atan((beta * Math.sin(E_rad)) / (1 - beta * Math.cos(E_rad)));
  return nu;
}

/**
 * Converts True Anomaly (nu) to Eccentric Anomaly (E)
 */
export function trueToEccentricAnomaly(nu_rad: number, e: number): number {
  const sinE = (Math.sqrt(1 - e * e) * Math.sin(nu_rad)) / (1 + e * Math.cos(nu_rad));
  const cosE = (e + Math.cos(nu_rad)) / (1 + e * Math.cos(nu_rad));
  let E = Math.atan2(sinE, cosE);
  if (E < 0) E += 2 * Math.PI;
  return E;
}

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/**
 * Computes the 3D position and velocity in Earth-Centered Inertial (ECI) frame
 */
export function keplerianToECI(
  elements: KeplerianElements,
  trueAnomalyDeg?: number
): { position: Vec3; velocity: Vec3 } {
  const { a, e } = elements;
  const iRad = degToRad(elements.i);
  const raanRad = degToRad(elements.raan);
  const argPerigeeRad = degToRad(elements.argPerigee);
  const nuRad = degToRad(trueAnomalyDeg !== undefined ? trueAnomalyDeg : elements.trueAnomaly);

  // Semi-latus rectum
  const p = a * (1 - e * e);
  // Radius distance from Earth center
  const r = p / (1 + e * Math.cos(nuRad));

  // Position in orbital plane (perifocal PQW frame)
  const r_orb = {
    x: r * Math.cos(nuRad),
    y: r * Math.sin(nuRad),
    z: 0,
  };

  // Velocity in orbital plane
  const h = Math.sqrt(MU_EARTH * p);
  const v_orb = {
    x: -(MU_EARTH / h) * Math.sin(nuRad),
    y: (MU_EARTH / h) * (e + Math.cos(nuRad)),
    z: 0,
  };

  // Transformation matrix from Perifocal to ECI: R = Rz(-raan) * Rx(-i) * Rz(-argPerigee)
  const cosO = Math.cos(raanRad);
  const sinO = Math.sin(raanRad);
  const cosi = Math.cos(iRad);
  const sini = Math.sin(iRad);
  const cosw = Math.cos(argPerigeeRad);
  const sinw = Math.sin(argPerigeeRad);

  const Px = cosO * cosw - sinO * sinw * cosi;
  const Py = -cosO * sinw - sinO * cosw * cosi;
  const Qx = sinO * cosw + cosO * sinw * cosi;
  const Qy = -sinO * sinw + cosO * cosw * cosi;
  const Wx = sinw * sini;
  const Wy = cosw * sini;

  const position: Vec3 = {
    x: Px * r_orb.x + Py * r_orb.y,
    y: Qx * r_orb.x + Qy * r_orb.y,
    z: Wx * r_orb.x + Wy * r_orb.y,
  };

  const velocity: Vec3 = {
    x: Px * v_orb.x + Py * v_orb.y,
    y: Qx * v_orb.x + Qy * v_orb.y,
    z: Wx * v_orb.x + Wy * v_orb.y,
  };

  return { position, velocity };
}

/**
 * Calculates Greenwich Mean Sidereal Time (GMST) in radians for a given Date
 */
export function getGMST(date: Date): number {
  // Julian Date
  const time = date.getTime();
  const jd = time / 86400000 + 2440587.5;
  const d = jd - 2451545.0; // Days since J2000.0
  let gmstHours = (18.697374558 + 24.06570982441908 * d) % 24;
  if (gmstHours < 0) gmstHours += 24;
  return (gmstHours * 15 * Math.PI) / 180;
}

/**
 * Converts ECI coordinates to Earth-Centered Earth-Fixed (ECEF) and geodetic Lat/Lon/Alt
 */
export function eciToLatLon(
  posECI: Vec3,
  gmstRad: number
): { latitude: number; longitude: number; altitude: number } {
  // Rotate around Z axis by GMST
  const cosG = Math.cos(gmstRad);
  const sinG = Math.sin(gmstRad);

  const xECEF = cosG * posECI.x + sinG * posECI.y;
  const yECEF = -sinG * posECI.x + cosG * posECI.y;
  const zECEF = posECI.z;

  const rXY = Math.sqrt(xECEF * xECEF + yECEF * yECEF);
  const rTotal = Math.sqrt(xECEF * xECEF + yECEF * yECEF + zECEF * zECEF);

  // Geocentric latitude & longitude
  const latRad = Math.atan2(zECEF, rXY);
  let lonRad = Math.atan2(yECEF, xECEF);

  let lonDeg = radToDeg(lonRad);
  let latDeg = radToDeg(latRad);

  // Normalize longitude to [-180, 180]
  lonDeg = ((lonDeg + 180) % 360) - 180;
  if (lonDeg < -180) lonDeg += 360;

  const altitude = rTotal - EARTH_RADIUS_KM;

  return {
    latitude: latDeg,
    longitude: lonDeg,
    altitude,
  };
}

/**
 * Computes the Sun vector in ECI for eclipse testing
 */
export function getSunVectorECI(date: Date): Vec3 {
  const jd = date.getTime() / 86400000 + 2440587.5;
  const n = jd - 2451545.0; // days since J2000
  const L = (280.46 + 0.9856474 * n) % 360;
  const g = ((357.528 + 0.9856003 * n) % 360) * (Math.PI / 180);
  const lambda = (L + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) * (Math.PI / 180);
  const eps = (23.439 - 0.0000004 * n) * (Math.PI / 180);

  return {
    x: Math.cos(lambda),
    y: Math.cos(eps) * Math.sin(lambda),
    z: Math.sin(eps) * Math.sin(lambda),
  };
}

/**
 * Checks if satellite is in Earth's shadow using NASA NAIF SPICE Conical Umbra Model
 * Reference: NASA SPICE Toolkit & Vallado Dual-Cone Shadow Algorithm
 * Sun Radius: 696,340 km | Earth WGS-84 Radius: 6,378.137 km | 1 AU: 149,597,870.7 km
 * Umbra Taper Rate: tan(alpha_u) = (R_sun - R_earth) / 1 AU = 0.004612 rad (0.26425 deg)
 * Apex Distance: 1,384,140 km (217.02 Earth radii)
 */
export function isSatelliteInEclipse(satECI: Vec3, date: Date): boolean {
  const sun = getSunVectorECI(date);
  // Dot product of satellite position with Sun unit vector
  const dot = satECI.x * sun.x + satECI.y * sun.y + satECI.z * sun.z;
  if (dot > 0) {
    // Satellite is in direct sunlight (day side of Earth)
    return false;
  }
  // Distance along anti-Sun shadow axis behind Earth (s > 0)
  const s = -dot;

  // NASA Conical Umbra: Earth radius tapers by tan(alpha_u) = (696340 - 6378.137) / 1.4959787e8 = 0.004612
  const rUmbraKm = Math.max(0, EARTH_RADIUS_KM - s * 0.004612);

  // Perpendicular distance from shadow axis
  const perpDistSq =
    (satECI.x - dot * sun.x) ** 2 +
    (satECI.y - dot * sun.y) ** 2 +
    (satECI.z - dot * sun.z) ** 2;

  return perpDistSq < rUmbraKm * rUmbraKm;
}

/**
 * Returns detailed NASA Umbra and Penumbra occultation data
 */
export function getNasaUmbraOccultation(satECI: Vec3, date: Date): {
  inUmbra: boolean;
  inPenumbra: boolean;
  inSunlight: boolean;
  distanceBehindEarthKm: number;
  perpDistanceKm: number;
  umbraRadiusKm: number;
  penumbraRadiusKm: number;
  umbraLengthKm: number;
  sunlightFraction: number;
} {
  const sun = getSunVectorECI(date);
  const dot = satECI.x * sun.x + satECI.y * sun.y + satECI.z * sun.z;
  const umbraLengthKm = 1384140; // 217.02 R_E

  if (dot > 0) {
    return {
      inUmbra: false,
      inPenumbra: false,
      inSunlight: true,
      distanceBehindEarthKm: 0,
      perpDistanceKm: Math.sqrt(satECI.x * satECI.x + satECI.y * satECI.y + satECI.z * satECI.z),
      umbraRadiusKm: EARTH_RADIUS_KM,
      penumbraRadiusKm: EARTH_RADIUS_KM,
      umbraLengthKm,
      sunlightFraction: 1.0,
    };
  }

  const s = -dot;
  const rUmbraKm = Math.max(0, EARTH_RADIUS_KM - s * 0.004612);
  const rPenumbraKm = EARTH_RADIUS_KM + s * 0.004697;

  const perpDistSq =
    (satECI.x - dot * sun.x) ** 2 +
    (satECI.y - dot * sun.y) ** 2 +
    (satECI.z - dot * sun.z) ** 2;
  const perpDist = Math.sqrt(perpDistSq);

  const inUmbra = perpDist < rUmbraKm;
  const inPenumbra = !inUmbra && perpDist < rPenumbraKm;
  const inSunlight = !inUmbra && !inPenumbra;

  let sunlightFraction = 1.0;
  if (inUmbra) {
    sunlightFraction = 0.0;
  } else if (inPenumbra) {
    // Linear fraction across penumbral fringe
    const delta = rPenumbraKm - rUmbraKm;
    sunlightFraction = delta > 0 ? Math.min(1, Math.max(0, (perpDist - rUmbraKm) / delta)) : 0.5;
  }

  return {
    inUmbra,
    inPenumbra,
    inSunlight,
    distanceBehindEarthKm: s,
    perpDistanceKm: perpDist,
    umbraRadiusKm: rUmbraKm,
    penumbraRadiusKm: rPenumbraKm,
    umbraLengthKm,
    sunlightFraction,
  };
}

/**
 * Computes full derived orbital dynamics and state
 */
export function computeOrbitDerivedState(
  elements: KeplerianElements,
  massKg: number,
  dragAreaM2: number,
  dragCd: number,
  simDate: Date,
  solar?: SolarConditions,
  reflectivity = 1.3
): OrbitDerivedState {
  const { a, e } = elements;
  const rPerigee = a * (1 - e);
  const rApogee = a * (1 + e);

  const perigeeAltKm = rPerigee - EARTH_RADIUS_KM;
  const apogeeAltKm = rApogee - EARTH_RADIUS_KM;

  // Orbital Period in seconds and minutes
  const periodSeconds = 2 * Math.PI * Math.sqrt(Math.pow(a, 3) / MU_EARTH);
  const orbitalPeriodMin = periodSeconds / 60;

  // Velocities at apsides
  const vPerigeeKmS = Math.sqrt(MU_EARTH * (2 / rPerigee - 1 / a));
  const vApogeeKmS = Math.sqrt(MU_EARTH * (2 / rApogee - 1 / a));

  // Current state at true anomaly
  const { position, velocity } = keplerianToECI(elements);
  const currentR = Math.sqrt(position.x ** 2 + position.y ** 2 + position.z ** 2);
  const currentAltKm = currentR - EARTH_RADIUS_KM;
  const currentVelocityKmS = Math.sqrt(velocity.x ** 2 + velocity.y ** 2 + velocity.z ** 2);

  // Mean motion
  const meanMotionRevsPerDay = 86400 / periodSeconds;

  // J2 Perturbations:
  // p = a(1 - e^2)
  const p = a * (1 - e * e);
  const n_rad_s = Math.sqrt(MU_EARTH / Math.pow(a, 3));
  const iRad = degToRad(elements.i);

  // Nodal precession rate dOmega/dt:
  // -1.5 * J2 * (R_E / p)^2 * n * cos(i)
  const dOmega_dt_rad_s =
    -1.5 * J2_EARTH * Math.pow(EARTH_RADIUS_KM / p, 2) * n_rad_s * Math.cos(iRad);
  const nodalPrecessionDegPerDay = radToDeg(dOmega_dt_rad_s) * 86400;

  // Apsidal precession rate dw/dt:
  // 0.75 * J2 * (R_E / p)^2 * n * (5 * cos^2(i) - 1)
  const dw_dt_rad_s =
    0.75 *
    J2_EARTH *
    Math.pow(EARTH_RADIUS_KM / p, 2) *
    n_rad_s *
    (5 * Math.pow(Math.cos(iRad), 2) - 1);
  const apsidalPrecessionDegPerDay = radToDeg(dw_dt_rad_s) * 86400;

  // Ballistic coefficient B = m / (Cd * A)
  const ballisticCoefficientKgM2 = massKg / (dragCd * Math.max(0.0001, dragAreaM2));

  // NASA Physics Calculations
  const f107 = solar?.f107 ?? 130;
  const ap = solar?.apIndex ?? 15;
  const model = solar?.atmosphereModel ?? 'nasa-das';

  const exosphericTempK = computeNasaExosphericTemp(f107, f107, ap);
  const thermosphericScaleHeightKm = getNasaScaleHeight(currentAltKm, f107, ap);
  const { meanMolecularWeight } = getNasaAtmosphericConstituents(currentAltKm);
  const sgp4BStar1PerEr = computeSgp4BStar(massKg, dragAreaM2, dragCd);
  const solarRadiationPressureAccelMs2 = computeSolarRadiationPressureAccel(massKg, dragAreaM2, reflectivity);
  const instantaneousDragDecelMs2 = getDragDeceleration(
    currentAltKm,
    currentVelocityKmS,
    massKg,
    dragAreaM2,
    dragCd,
    f107,
    ap,
    model
  );
  const diurnalBulgeRatio = currentAltKm > 150 ? Math.min(1.5, 1.0 + 0.35 * Math.min(1.0, (currentAltKm - 150) / 300)) : 1.0;

  // Eclipse geometry
  const gmst = getGMST(simDate);
  const inEclipse = isSatelliteInEclipse(position, simDate);

  // Eclipse fraction approximation
  // beta angle: angle between orbit plane and Earth-Sun vector
  const sunVec = getSunVectorECI(simDate);
  // Orbit normal in ECI
  const orbitNormal: Vec3 = {
    x: Math.sin(degToRad(elements.raan)) * Math.sin(iRad),
    y: -Math.cos(degToRad(elements.raan)) * Math.sin(iRad),
    z: Math.cos(iRad),
  };
  const sinBeta =
    orbitNormal.x * sunVec.x + orbitNormal.y * sunVec.y + orbitNormal.z * sunVec.z;
  const betaRad = Math.asin(Math.max(-1, Math.min(1, sinBeta)));
  const betaDeg = Math.abs(radToDeg(betaRad));

  // Umbral angle theta:
  const rho_r = Math.asin(Math.min(1, EARTH_RADIUS_KM / a));
  let eclipseFraction = 0;
  if (Math.abs(betaDeg) < radToDeg(rho_r)) {
    const cosTheta =
      Math.sqrt(Math.max(0, 1 - Math.pow(Math.sin(rho_r) / Math.cos(betaRad), 2)));
    const theta = Math.acos(Math.max(-1, Math.min(1, cosTheta)));
    eclipseFraction = theta / Math.PI;
  }
  const eclipseDurationMin = orbitalPeriodMin * eclipseFraction;
  const sunlitDurationMin = orbitalPeriodMin - eclipseDurationMin;

  const latLon = eciToLatLon(position, gmst);

  return {
    orbitalPeriodMin,
    perigeeAltKm,
    apogeeAltKm,
    vPerigeeKmS,
    vApogeeKmS,
    currentAltKm,
    currentVelocityKmS,
    meanMotionRevsPerDay,
    nodalPrecessionDegPerDay,
    apsidalPrecessionDegPerDay,
    ballisticCoefficientKgM2,
    inEclipse,
    eclipseDurationMin,
    sunlitDurationMin,
    subSatelliteLatitude: latLon.latitude,
    subSatelliteLongitude: latLon.longitude,
    exosphericTempK,
    thermosphericScaleHeightKm,
    meanMolecularWeightGPerMol: meanMolecularWeight,
    sgp4BStar1PerEr,
    solarRadiationPressureAccelMs2,
    instantaneousDragDecelMs2,
    diurnalBulgeRatio,
  };
}

/**
 * Samples 3D coordinates for rendering the complete orbit ellipse
 */
export function generateOrbitCurvePoints(
  elements: KeplerianElements,
  samples = 160
): Vec3[] {
  const points: Vec3[] = [];
  for (let step = 0; step <= samples; step++) {
    const nu = (step / samples) * 360;
    const { position } = keplerianToECI(elements, nu);
    points.push(position);
  }
  return points;
}

/**
 * Propagates Ground Track coordinates for N orbits taking into account
 * Earth rotation and J2 nodal drift.
 */
export function generateGroundTrack(
  elements: KeplerianElements,
  startDate: Date,
  numOrbits = 2.5,
  stepsPerOrbit = 120
): Array<{ lat: number; lon: number; alt: number; inEclipse: boolean; timestamp: number }> {
  const points: Array<{ lat: number; lon: number; alt: number; inEclipse: boolean; timestamp: number }> = [];

  const { a, e } = elements;
  const periodSec = 2 * Math.PI * Math.sqrt(Math.pow(a, 3) / MU_EARTH);
  const totalDurationSec = periodSec * numOrbits;
  const totalSteps = Math.round(numOrbits * stepsPerOrbit);
  const dtSec = totalDurationSec / totalSteps;

  // Initial mean anomaly from true anomaly
  const nu0Rad = degToRad(elements.trueAnomaly);
  const E0Rad = trueToEccentricAnomaly(nu0Rad, e);
  const M0Rad = E0Rad - e * Math.sin(E0Rad);
  const n_rad_s = Math.sqrt(MU_EARTH / Math.pow(a, 3));

  const p = a * (1 - e * e);
  const iRad = degToRad(elements.i);
  const dOmega_dt_rad_s =
    -1.5 * J2_EARTH * Math.pow(EARTH_RADIUS_KM / p, 2) * n_rad_s * Math.cos(iRad);
  const dw_dt_rad_s =
    0.75 *
    J2_EARTH *
    Math.pow(EARTH_RADIUS_KM / p, 2) *
    n_rad_s *
    (5 * Math.pow(Math.cos(iRad), 2) - 1);

  const startGMST = getGMST(startDate);
  const startTimeMs = startDate.getTime();

  for (let step = 0; step <= totalSteps; step++) {
    const tSec = step * dtSec;
    const M_current = M0Rad + n_rad_s * tSec;
    const E_current = solveKepler(M_current, e);
    const nu_current = eccentricToTrueAnomaly(E_current, e);

    // Update RAAN and argPerigee with J2 secular drift
    const currentRAANDeg = elements.raan + radToDeg(dOmega_dt_rad_s * tSec);
    const currentArgPerigeeDeg = elements.argPerigee + radToDeg(dw_dt_rad_s * tSec);

    const tempElements: KeplerianElements = {
      ...elements,
      raan: currentRAANDeg,
      argPerigee: currentArgPerigeeDeg,
      trueAnomaly: radToDeg(nu_current),
    };

    const { position } = keplerianToECI(tempElements);
    const gmst = startGMST + EARTH_ROTATION_RAD_PER_SEC * tSec;
    const latLon = eciToLatLon(position, gmst);
    const curDate = new Date(startTimeMs + tSec * 1000);
    const inEclipse = isSatelliteInEclipse(position, curDate);

    points.push({
      lat: latLon.latitude,
      lon: latLon.longitude,
      alt: latLon.altitude,
      inEclipse,
      timestamp: startTimeMs + tSec * 1000,
    });
  }

  return points;
}

/**
 * Calculates line-of-sight distance and elevation from ground station to satellite
 */
export function getGroundStationPass(
  satLat: number,
  satLon: number,
  satAltKm: number,
  stationLat: number,
  stationLon: number,
  minElevationDeg = 5
): { inContact: boolean; elevationDeg: number; distanceKm: number } {
  const phi1 = degToRad(stationLat);
  const lam1 = degToRad(stationLon);
  const phi2 = degToRad(satLat);
  const lam2 = degToRad(satLon);

  // Great circle central angle
  const cosGamma =
    Math.sin(phi1) * Math.sin(phi2) + Math.cos(phi1) * Math.cos(phi2) * Math.cos(lam2 - lam1);
  const gamma = Math.acos(Math.max(-1, Math.min(1, cosGamma)));

  const rSat = EARTH_RADIUS_KM + satAltKm;
  const rStation = EARTH_RADIUS_KM;

  // Slant range
  const slantRangeSq =
    rStation * rStation + rSat * rSat - 2 * rStation * rSat * cosGamma;
  const slantRange = Math.sqrt(Math.max(0, slantRangeSq));

  // Elevation angle
  const cosEl = (rSat * Math.sin(gamma)) / slantRange;
  const sinEl = (rSat * Math.cos(gamma) - rStation) / slantRange;
  const elRad = Math.atan2(sinEl, cosEl);
  const elDeg = radToDeg(elRad);

  return {
    inContact: elDeg >= minElevationDeg,
    elevationDeg: elDeg,
    distanceKm: slantRange,
  };
}

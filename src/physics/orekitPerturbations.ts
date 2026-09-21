/**
 * Orekit-Grade Orbital Perturbations & CubeSat Attitude Dynamics Engine
 * Reference: Orekit Space Flight Dynamics Library & NASA SP-8000 series
 * - Geopotential Zonal Harmonics (J2, J3, J4) Vector Gradients
 * - 3rd-Body Gravitational Perturbations (Sun & Moon differential tides)
 * - Solar Radiation Pressure & Atmosphere Drag Vectors
 * - Runge-Kutta 4th Order (RK4) High-Precision Numerical Propagator
 * - CubeSat Rigid Body Attitude Dynamics & Tumbling Simulation
 */

import {
  CubeSatSpec,
  DynamicAttitudeMode,
  AttitudeDynamicsState,
  OrekitPerturbationMetrics,
} from '../types';
import { EARTH_RADIUS_KM, MU_EARTH, EARTH_ROTATION_RAD_PER_SEC } from './orbitalMechanics';
import { getAtmosphericDensity } from './atmosphere';
import { computeNasaEclipseFraction } from './spiceGeometry';

// Gravitational Constants (km^3 / s^2)
export const MU_MOON = 4902.8;
export const MU_SUN = 132712440018.0;

// Earth Zonal Harmonics (WGS-84 / EGM96)
export const J2 = 1.08262668e-3;
export const J3 = -2.53265649e-6;
export const J4 = -1.6196216e-6;

export interface OrekitStateVector {
  positionKm: { x: number; y: number; z: number };
  velocityKmS: { x: number; y: number; z: number };
  accelerationMs2: { x: number; y: number; z: number };
  timestamp: Date;
}

/**
 * Computes exact 3D vector acceleration due to Earth zonal geopotential (J2, J3, J4)
 * Returns acceleration vector in km/s^2
 */
export function computeGeopotentialVectorAccelKmS2(posKm: {
  x: number;
  y: number;
  z: number;
}): { x: number; y: number; z: number } {
  const r2 = posKm.x * posKm.x + posKm.y * posKm.y + posKm.z * posKm.z;
  const r = Math.sqrt(r2);
  if (r < 100) return { x: 0, y: 0, z: 0 };

  const z = posKm.z;
  const z2 = z * z;
  const r5 = r2 * r2 * r;
  const r7 = r5 * r2;
  const r9 = r7 * r2;
  const RE2 = EARTH_RADIUS_KM * EARTH_RADIUS_KM;
  const RE3 = RE2 * EARTH_RADIUS_KM;
  const RE4 = RE3 * EARTH_RADIUS_KM;

  // J2 Perturbation Vector:
  // a_x = - (3/2) * J2 * mu * RE^2 / r^5 * x * (1 - 5 * z^2 / r^2)
  // a_y = - (3/2) * J2 * mu * RE^2 / r^5 * y * (1 - 5 * z^2 / r^2)
  // a_z = - (3/2) * J2 * mu * RE^2 / r^5 * z * (3 - 5 * z^2 / r^2)
  const j2Factor = 1.5 * J2 * MU_EARTH * RE2;
  const z2_r2 = z2 / r2;
  const xyJ2 = (j2Factor / r5) * (1 - 5 * z2_r2);
  const axJ2 = -xyJ2 * posKm.x;
  const ayJ2 = -xyJ2 * posKm.y;
  const azJ2 = -(j2Factor / r5) * z * (3 - 5 * z2_r2);

  // J3 Perturbation Vector:
  const j3Factor = 0.5 * J3 * MU_EARTH * RE3;
  const axJ3 = -(5 * j3Factor * posKm.x * z / r7) * (3 - 7 * z2_r2);
  const ayJ3 = -(5 * j3Factor * posKm.y * z / r7) * (3 - 7 * z2_r2);
  const azJ3 = -(j3Factor / r7) * (6 * z2 * (3 - 7 * z2_r2) - 3 * r2 * (1 - 5 * z2_r2));

  // J4 Perturbation Vector:
  const j4Factor = 0.625 * J4 * MU_EARTH * RE4;
  const xyJ4 = (j4Factor / r7) * (3 - 42 * z2_r2 + 63 * z2_r2 * z2_r2);
  const axJ4 = -xyJ4 * posKm.x;
  const ayJ4 = -xyJ4 * posKm.y;
  const azJ4 = -(j4Factor / r7) * z * (15 - 70 * z2_r2 + 63 * z2_r2 * z2_r2);

  return {
    x: axJ2 + axJ3 + axJ4,
    y: ayJ2 + ayJ3 + ayJ4,
    z: azJ2 + azJ3 + azJ4,
  };
}

/**
 * Computes exact total acceleration (central gravity + perturbations) for Orekit RK4 integrator
 * Returns acceleration vector in km/s^2
 */
export function computeOrekitTotalAccelKmS2(
  posKm: { x: number; y: number; z: number },
  velKmS: { x: number; y: number; z: number },
  sunPosKm: [number, number, number],
  moonPosKm: [number, number, number],
  cubeSat: CubeSatSpec
): { x: number; y: number; z: number } {
  const r2 = posKm.x * posKm.x + posKm.y * posKm.y + posKm.z * posKm.z;
  const r = Math.sqrt(r2);
  if (r < 100) return { x: 0, y: 0, z: 0 };

  // 1. Central Earth gravity: -mu / r^3 * r
  const mu_r3 = MU_EARTH / (r2 * r);
  let ax = -mu_r3 * posKm.x;
  let ay = -mu_r3 * posKm.y;
  let az = -mu_r3 * posKm.z;

  // 2. Geopotential harmonics (J2, J3, J4)
  const aGeo = computeGeopotentialVectorAccelKmS2(posKm);
  ax += aGeo.x;
  ay += aGeo.y;
  az += aGeo.z;

  // 3. Moon 3rd body gravity
  const dxM = moonPosKm[0] - posKm.x;
  const dyM = moonPosKm[1] - posKm.y;
  const dzM = moonPosKm[2] - posKm.z;
  const dSatMoon3 = Math.pow(dxM * dxM + dyM * dyM + dzM * dzM, 1.5);
  const dEarthMoon3 = Math.pow(
    moonPosKm[0] * moonPosKm[0] + moonPosKm[1] * moonPosKm[1] + moonPosKm[2] * moonPosKm[2],
    1.5
  );
  ax += MU_MOON * (dxM / dSatMoon3 - moonPosKm[0] / dEarthMoon3);
  ay += MU_MOON * (dyM / dSatMoon3 - moonPosKm[1] / dEarthMoon3);
  az += MU_MOON * (dzM / dSatMoon3 - moonPosKm[2] / dEarthMoon3);

  // 4. Sun 3rd body gravity
  const dxS = sunPosKm[0] - posKm.x;
  const dyS = sunPosKm[1] - posKm.y;
  const dzS = sunPosKm[2] - posKm.z;
  const dSatSun3 = Math.pow(dxS * dxS + dyS * dyS + dzS * dzS, 1.5);
  const dEarthSun3 = Math.pow(
    sunPosKm[0] * sunPosKm[0] + sunPosKm[1] * sunPosKm[1] + sunPosKm[2] * sunPosKm[2],
    1.5
  );
  ax += MU_SUN * (dxS / dSatSun3 - sunPosKm[0] / dEarthSun3);
  ay += MU_SUN * (dyS / dSatSun3 - sunPosKm[1] / dEarthSun3);
  az += MU_SUN * (dzS / dSatSun3 - sunPosKm[2] / dEarthSun3);

  // 5. Solar Radiation Pressure (SRP)
  const eclipse = computeNasaEclipseFraction(posKm, sunPosKm);
  if (eclipse.eclipseFraction > 0.01) {
    const dSatSun = Math.sqrt(dxS * dxS + dyS * dyS + dzS * dzS);
    const sunUnitX = -dxS / dSatSun; // Pointing away from sun
    const sunUnitY = -dyS / dSatSun;
    const sunUnitZ = -dzS / dSatSun;

    const totalArea =
      cubeSat.dragArea +
      (cubeSat.additionalArea || 0) +
      (cubeSat.hasDragSail ? cubeSat.dragSailArea : 0);
    // P_sun = 4.56e-6 N/m^2 = 4.56e-9 kg / (km * s^2)
    const srpMagKmS2 =
      (4.56e-9 * (cubeSat.reflectivity || 1.3) * totalArea * eclipse.eclipseFraction) /
      Math.max(0.1, cubeSat.mass);

    ax += srpMagKmS2 * sunUnitX;
    ay += srpMagKmS2 * sunUnitY;
    az += srpMagKmS2 * sunUnitZ;
  }

  // 6. Atmospheric Drag
  const altKm = r - EARTH_RADIUS_KM;
  if (altKm > 80 && altKm < 1000) {
    // Relative velocity accounting for Earth rotation (atmosphere co-rotates)
    const vRelX = velKmS.x - (-EARTH_ROTATION_RAD_PER_SEC * posKm.y);
    const vRelY = velKmS.y - (EARTH_ROTATION_RAD_PER_SEC * posKm.x);
    const vRelZ = velKmS.z;
    const vRel = Math.sqrt(vRelX * vRelX + vRelY * vRelY + vRelZ * vRelZ);

    const rhoKgM3 = getAtmosphericDensity(altKm, 130, 15, 'nasa-das');
    // a_drag = -0.5 * rho * Cd * A / m * v_rel * v_rel_vector
    // Convert rho to kg / km^3 (multiply by 1e9) or keep in m/s^2 and divide by 1000 for km/s^2
    const totalArea =
      cubeSat.dragArea +
      (cubeSat.additionalArea || 0) +
      (cubeSat.hasDragSail ? cubeSat.dragSailArea : 0);
    const dragCoeff =
      0.5 * rhoKgM3 * (cubeSat.dragCoefficient || 2.2) * (totalArea / Math.max(0.1, cubeSat.mass));
    // in m/s^2: dragCoeff * (vRel * 1000)^2 -> divide by 1000 for km/s^2: dragCoeff * vRel^2 * 1000
    const dragAccelKmS2 = (dragCoeff * Math.pow(vRel * 1000, 2)) / 1000;

    ax -= (dragAccelKmS2 * vRelX) / vRel;
    ay -= (dragAccelKmS2 * vRelY) / vRel;
    az -= (dragAccelKmS2 * vRelZ) / vRel;
  }

  return { x: ax, y: ay, z: az };
}

/**
 * Numerical Orbit Integrator (4th-order Runge-Kutta / RK4)
 * Matches Orekit Space Flight Dynamics numerical propagation precision
 */
export function stepOrekitRk4(
  posKm: { x: number; y: number; z: number },
  velKmS: { x: number; y: number; z: number },
  dtSec: number,
  sunPosKm: [number, number, number],
  moonPosKm: [number, number, number],
  cubeSat: CubeSatSpec
): {
  positionKm: { x: number; y: number; z: number };
  velocityKmS: { x: number; y: number; z: number };
} {
  // k1
  const a1 = computeOrekitTotalAccelKmS2(posKm, velKmS, sunPosKm, moonPosKm, cubeSat);
  const v1 = velKmS;

  // k2
  const p2 = {
    x: posKm.x + 0.5 * dtSec * v1.x,
    y: posKm.y + 0.5 * dtSec * v1.y,
    z: posKm.z + 0.5 * dtSec * v1.z,
  };
  const v2 = {
    x: velKmS.x + 0.5 * dtSec * a1.x,
    y: velKmS.y + 0.5 * dtSec * a1.y,
    z: velKmS.z + 0.5 * dtSec * a1.z,
  };
  const a2 = computeOrekitTotalAccelKmS2(p2, v2, sunPosKm, moonPosKm, cubeSat);

  // k3
  const p3 = {
    x: posKm.x + 0.5 * dtSec * v2.x,
    y: posKm.y + 0.5 * dtSec * v2.y,
    z: posKm.z + 0.5 * dtSec * v2.z,
  };
  const v3 = {
    x: velKmS.x + 0.5 * dtSec * a2.x,
    y: velKmS.y + 0.5 * dtSec * a2.y,
    z: velKmS.z + 0.5 * dtSec * a2.z,
  };
  const a3 = computeOrekitTotalAccelKmS2(p3, v3, sunPosKm, moonPosKm, cubeSat);

  // k4
  const p4 = {
    x: posKm.x + dtSec * v3.x,
    y: posKm.y + dtSec * v3.y,
    z: posKm.z + dtSec * v3.z,
  };
  const v4 = {
    x: velKmS.x + dtSec * a3.x,
    y: velKmS.y + dtSec * a3.y,
    z: velKmS.z + dtSec * a3.z,
  };
  const a4 = computeOrekitTotalAccelKmS2(p4, v4, sunPosKm, moonPosKm, cubeSat);

  // Combine RK4 increments
  const nextPos = {
    x: posKm.x + (dtSec / 6) * (v1.x + 2 * v2.x + 2 * v3.x + v4.x),
    y: posKm.y + (dtSec / 6) * (v1.y + 2 * v2.y + 2 * v3.y + v4.y),
    z: posKm.z + (dtSec / 6) * (v1.z + 2 * v2.z + 2 * v3.z + v4.z),
  };

  const nextVel = {
    x: velKmS.x + (dtSec / 6) * (a1.x + 2 * a2.x + 2 * a3.x + a4.x),
    y: velKmS.y + (dtSec / 6) * (a1.y + 2 * a2.y + 2 * a3.y + a4.y),
    z: velKmS.z + (dtSec / 6) * (a1.z + 2 * a2.z + 2 * a3.z + a4.z),
  };

  return { positionKm: nextPos, velocityKmS: nextVel };
}

/**
 * Calculates high-order geopotential acceleration perturbations (J2, J3, J4) in ECI frame
 * Returns accelerations in m/s^2
 */
export function computeGeopotentialPerturbations(posKm: {
  x: number;
  y: number;
  z: number;
}): {
  j2AccelMs2: number;
  j3AccelMs2: number;
  j4AccelMs2: number;
  totalGeopotentialAccelMs2: number;
} {
  const r2 = posKm.x * posKm.x + posKm.y * posKm.y + posKm.z * posKm.z;
  const r = Math.sqrt(r2);
  if (r === 0) return { j2AccelMs2: 0, j3AccelMs2: 0, j4AccelMs2: 0, totalGeopotentialAccelMs2: 0 };

  const z2 = posKm.z * posKm.z;
  const RE_r = EARTH_RADIUS_KM / r;
  const RE_r_2 = RE_r * RE_r;
  const RE_r_3 = RE_r_2 * RE_r;
  const RE_r_4 = RE_r_3 * RE_r;

  // mu / r^2 in m/s^2 (1 km^3/s^2 / km^2 = 1 km/s^2 = 1000 m/s^2)
  const g0_ms2 = (MU_EARTH / r2) * 1000;

  // J2 Acceleration magnitude: a_J2 = (3/2) * J2 * (mu/r^2) * (RE/r)^2 * sqrt(1 - 6*sin^2(phi) + 9*sin^4(phi))
  const sinPhi = posKm.z / r;
  const sin2Phi = sinPhi * sinPhi;

  const j2Factor = 1.5 * J2 * RE_r_2;
  const j2AccelMs2 = g0_ms2 * j2Factor * Math.sqrt(Math.max(0, 1 - 6 * sin2Phi + 9 * sin2Phi * sin2Phi));

  // J3 Acceleration magnitude: a_J3 = (1/2) * |J3| * (mu/r^2) * (RE/r)^3 * |sin(phi)| * |5*sin^2(phi) - 3|
  const j3Factor = 0.5 * Math.abs(J3) * RE_r_3;
  const j3AccelMs2 = g0_ms2 * j3Factor * Math.abs(sinPhi * (5 * sin2Phi - 3));

  // J4 Acceleration magnitude: a_J4 = (5/8) * |J4| * (mu/r^2) * (RE/r)^4 * |35*sin^4(phi) - 30*sin^2(phi) + 3|
  const j4Factor = 0.625 * Math.abs(J4) * RE_r_4;
  const j4AccelMs2 = g0_ms2 * j4Factor * Math.abs(35 * sin2Phi * sin2Phi - 30 * sin2Phi + 3);

  const totalGeopotentialAccelMs2 = j2AccelMs2 + j3AccelMs2 + j4AccelMs2;

  return {
    j2AccelMs2,
    j3AccelMs2,
    j4AccelMs2,
    totalGeopotentialAccelMs2,
  };
}

/**
 * Calculates Third-Body Gravitational Perturbations (Sun and Moon) in m/s^2
 * a_3rd = mu_3 * [ (r_3 - r) / |r_3 - r|^3 - r_3 / |r_3|^3 ]
 */
export function computeThirdBodyPerturbations(
  satPosKm: { x: number; y: number; z: number },
  sunPosKm: [number, number, number],
  moonPosKm: [number, number, number]
): {
  solarGravityAccelMs2: number;
  lunarGravityAccelMs2: number;
} {
  // 1. Lunar 3rd-Body
  const dxM = moonPosKm[0] - satPosKm.x;
  const dyM = moonPosKm[1] - satPosKm.y;
  const dzM = moonPosKm[2] - satPosKm.z;
  const dSatMoon3 = Math.pow(dxM * dxM + dyM * dyM + dzM * dzM, 1.5);
  const dEarthMoon3 = Math.pow(
    moonPosKm[0] * moonPosKm[0] + moonPosKm[1] * moonPosKm[1] + moonPosKm[2] * moonPosKm[2],
    1.5
  );

  const axM = MU_MOON * (dxM / dSatMoon3 - moonPosKm[0] / dEarthMoon3);
  const ayM = MU_MOON * (dyM / dSatMoon3 - moonPosKm[1] / dEarthMoon3);
  const azM = MU_MOON * (dzM / dSatMoon3 - moonPosKm[2] / dEarthMoon3);
  const lunarGravityAccelMs2 = Math.sqrt(axM * axM + ayM * ayM + azM * azM) * 1000;

  // 2. Solar 3rd-Body
  const dxS = sunPosKm[0] - satPosKm.x;
  const dyS = sunPosKm[1] - satPosKm.y;
  const dzS = sunPosKm[2] - satPosKm.z;
  const dSatSun3 = Math.pow(dxS * dxS + dyS * dyS + dzS * dzS, 1.5);
  const dEarthSun3 = Math.pow(
    sunPosKm[0] * sunPosKm[0] + sunPosKm[1] * sunPosKm[1] + sunPosKm[2] * sunPosKm[2],
    1.5
  );

  const axS = MU_SUN * (dxS / dSatSun3 - sunPosKm[0] / dEarthSun3);
  const ayS = MU_SUN * (dyS / dSatSun3 - sunPosKm[1] / dEarthSun3);
  const azS = MU_SUN * (dzS / dSatSun3 - sunPosKm[2] / dEarthSun3);
  const solarGravityAccelMs2 = Math.sqrt(axS * axS + ayS * ayS + azS * azS) * 1000;

  return {
    solarGravityAccelMs2,
    lunarGravityAccelMs2,
  };
}

/**
 * Calculates Orekit-grade perturbation summary metrics
 */
export function computeOrekitPerturbationMetrics(
  satPosKm: { x: number; y: number; z: number },
  sunPosKm: [number, number, number],
  moonPosKm: [number, number, number],
  massKg: number,
  dragAreaM2: number,
  reflectivity = 1.3,
  aKm = 6878,
  e = 0.001,
  incDeg = 51.6
): OrekitPerturbationMetrics {
  const geo = computeGeopotentialPerturbations(satPosKm);
  const tb = computeThirdBodyPerturbations(satPosKm, sunPosKm, moonPosKm);

  // Solar Radiation Pressure: a_srp = P_sun * Cr * A / m
  // P_sun = 4.56e-6 N/m^2 at 1 AU
  const srpAccel = (4.56e-6 * reflectivity * Math.max(0.0001, dragAreaM2)) / Math.max(0.01, massKg);

  const totalAccel =
    geo.totalGeopotentialAccelMs2 +
    tb.solarGravityAccelMs2 +
    tb.lunarGravityAccelMs2 +
    srpAccel;

  // Secular precession rates from Vallado / Orekit
  const iRad = (incDeg * Math.PI) / 180;
  const pKm = aKm * (1 - e * e);
  const pKm2 = pKm * pKm;
  const RE2 = EARTH_RADIUS_KM * EARTH_RADIUS_KM;

  // Mean motion n in rad/s
  const n = Math.sqrt(MU_EARTH / Math.pow(aKm, 3));

  // RAAN precession dOmega/dt in deg/day
  const dOmegaRadSec = -1.5 * n * J2 * (RE2 / pKm2) * Math.cos(iRad);
  const nodalPrecessionDegPerDay = ((dOmegaRadSec * 86400 * 180) / Math.PI);

  // Apsidal precession domega/dt in deg/day
  const dOmegaPerigeeRadSec =
    0.75 * n * J2 * (RE2 / pKm2) * (5 * Math.pow(Math.cos(iRad), 2) - 1);
  const apsidalPrecessionDegPerDay = ((dOmegaPerigeeRadSec * 86400 * 180) / Math.PI);

  return {
    j2AccelMs2: geo.j2AccelMs2,
    j3AccelMs2: geo.j3AccelMs2,
    j4AccelMs2: geo.j4AccelMs2,
    lunarGravityAccelMs2: tb.lunarGravityAccelMs2,
    solarGravityAccelMs2: tb.solarGravityAccelMs2,
    solarRadiationPressureAccelMs2: srpAccel,
    totalPerturbationAccelMs2: totalAccel,
    nodalPrecessionDegPerDay,
    apsidalPrecessionDegPerDay,
  };
}

/**
 * Calculates Principal Moments of Inertia (Ixx, Iyy, Izz) for a CubeSat prism
 * Standard formula for homogeneous rectangular cuboid:
 * I_xx = (1/12) * m * (w^2 + h^2)
 * I_yy = (1/12) * m * (l^2 + h^2)
 * I_zz = (1/12) * m * (l^2 + w^2)
 */
export function computeCubeSatInertiaTensor(
  massKg: number,
  dimensionsCm?: { length: number; width: number; height: number }
): [number, number, number] {
  const l = (dimensionsCm?.length ?? 10) / 100; // meters
  const w = (dimensionsCm?.width ?? 10) / 100;
  const h = (dimensionsCm?.height ?? 34) / 100;

  const Ixx = (1 / 12) * massKg * (w * w + h * h);
  const Iyy = (1 / 12) * massKg * (l * l + h * h);
  const Izz = (1 / 12) * massKg * (l * l + w * w);

  return [Ixx, Iyy, Izz];
}

/**
 * Computes Dynamic CubeSat Attitude State (Quaternion & Euler angles)
 * Supports: Nadir-pointing, Sun-pointing, Ram aero-drag, and Uncontrolled Tumbling
 */
export function computeAttitudeDynamics(
  mode: DynamicAttitudeMode,
  tumblingRpm: number,
  elapsedSec: number,
  cubeSat: CubeSatSpec,
  posKm: { x: number; y: number; z: number },
  velKmS: { x: number; y: number; z: number },
  sunPosKm: [number, number, number]
): AttitudeDynamicsState {
  const momentsOfInertiaKgM2 = computeCubeSatInertiaTensor(
    cubeSat.mass,
    cubeSat.dimensionsCm
  );

  let rollDeg = 0;
  let pitchDeg = 0;
  let yawDeg = 0;
  let omegaX = 0;
  let omegaY = 0;
  let omegaZ = 0;
  let sunAngleIncidenceDeg = 0;

  const rMag = Math.sqrt(posKm.x * posKm.x + posKm.y * posKm.y + posKm.z * posKm.z);
  const vMag = Math.sqrt(velKmS.x * velKmS.x + velKmS.y * velKmS.y + velKmS.z * velKmS.z);

  // Unit nadir vector (pointing down toward Earth center: -pos / r)
  const nadir = [-posKm.x / rMag, -posKm.y / rMag, -posKm.z / rMag];

  // Unit velocity vector
  const ram = [velKmS.x / vMag, velKmS.y / vMag, velKmS.z / vMag];

  // Unit Sun vector
  const sMag = Math.sqrt(
    sunPosKm[0] * sunPosKm[0] + sunPosKm[1] * sunPosKm[1] + sunPosKm[2] * sunPosKm[2]
  );
  const sunHat = [sunPosKm[0] / sMag, sunPosKm[1] / sMag, sunPosKm[2] / sMag];

  switch (mode) {
    case 'tumbling': {
      // Free rotational motion with non-zero angular rate
      const spinRateRadS = (tumblingRpm * 2 * Math.PI) / 60;
      omegaX = spinRateRadS * 0.7;
      omegaY = spinRateRadS * 1.0;
      omegaZ = spinRateRadS * 0.4;

      rollDeg = ((elapsedSec * omegaX * 180) / Math.PI) % 360;
      pitchDeg = ((elapsedSec * omegaY * 180) / Math.PI) % 360;
      yawDeg = ((elapsedSec * omegaZ * 180) / Math.PI) % 360;

      // Sun angle oscillates as it tumbles
      sunAngleIncidenceDeg = 45 + 40 * Math.sin(elapsedSec * spinRateRadS);
      break;
    }
    case 'detumbling-bdot': {
      // B-dot magnetorquer damping: RPM exponential decay over time
      const decayFactor = Math.exp(-0.02 * (elapsedSec % 600));
      const effectiveRpm = Math.max(0.1, tumblingRpm * decayFactor);
      const spinRate = (effectiveRpm * 2 * Math.PI) / 60;

      omegaX = spinRate * 0.5;
      omegaY = spinRate * 0.8;
      omegaZ = spinRate * 0.3;

      rollDeg = ((elapsedSec * omegaX * 180) / Math.PI) % 360;
      pitchDeg = ((elapsedSec * omegaY * 180) / Math.PI) % 360;
      yawDeg = ((elapsedSec * omegaZ * 180) / Math.PI) % 360;
      sunAngleIncidenceDeg = 30 + 15 * Math.sin(elapsedSec * spinRate);
      break;
    }
    case 'sun-pointing': {
      // Body +Z faces Sun vector directly for max solar array charging
      omegaX = 0;
      omegaY = 0;
      omegaZ = 0;
      rollDeg = 0;
      pitchDeg = 0;
      yawDeg = (Math.atan2(sunHat[1], sunHat[0]) * 180) / Math.PI;
      sunAngleIncidenceDeg = 0; // Normal to sun
      break;
    }
    case 'ram-aerobrake': {
      // Body +Z aligned with velocity vector to present maximum cross section (aero-drag deorbit)
      omegaX = 0;
      omegaY = 0;
      omegaZ = 0;
      rollDeg = 0;
      pitchDeg = (Math.asin(Math.max(-1, Math.min(1, ram[2]))) * 180) / Math.PI;
      yawDeg = (Math.atan2(ram[1], ram[0]) * 180) / Math.PI;
      const dotSun = ram[0] * sunHat[0] + ram[1] * sunHat[1] + ram[2] * sunHat[2];
      sunAngleIncidenceDeg = (Math.acos(Math.max(-1, Math.min(1, dotSun))) * 180) / Math.PI;
      break;
    }
    case 'nadir':
    default: {
      // Local Vertical / Local Horizontal (LVLH)
      omegaX = 0;
      omegaY = (vMag / rMag); // Orbital pitch rate
      omegaZ = 0;
      rollDeg = 0;
      pitchDeg = (Math.asin(Math.max(-1, Math.min(1, nadir[2]))) * 180) / Math.PI;
      yawDeg = (Math.atan2(ram[1], ram[0]) * 180) / Math.PI;
      const dotSun = nadir[0] * sunHat[0] + nadir[1] * sunHat[1] + nadir[2] * sunHat[2];
      sunAngleIncidenceDeg = (Math.acos(Math.max(-1, Math.min(1, dotSun))) * 180) / Math.PI;
      break;
    }
  }

  // Convert Euler angles to Quaternion [qw, qx, qy, qz]
  const c1 = Math.cos(((rollDeg * Math.PI) / 180) / 2);
  const c2 = Math.cos(((pitchDeg * Math.PI) / 180) / 2);
  const c3 = Math.cos(((yawDeg * Math.PI) / 180) / 2);
  const s1 = Math.sin(((rollDeg * Math.PI) / 180) / 2);
  const s2 = Math.sin(((pitchDeg * Math.PI) / 180) / 2);
  const s3 = Math.sin(((yawDeg * Math.PI) / 180) / 2);

  const qw = c1 * c2 * c3 - s1 * s2 * s3;
  const qx = s1 * c2 * c3 + c1 * s2 * s3;
  const qy = c1 * s2 * c3 - s1 * c2 * s3;
  const qz = c1 * c2 * s3 + s1 * s2 * c3;

  return {
    mode,
    tumblingRpm,
    omegaRps: [omegaX, omegaY, omegaZ],
    quaternion: [qw, qx, qy, qz],
    eulerDeg: [rollDeg, pitchDeg, yawDeg],
    momentsOfInertiaKgM2,
    sunAngleIncidenceDeg,
  };
}

/**
 * Generates high-fidelity Orekit numerical trajectory using RK4 integration
 */
export function generateOrekitTrajectory(
  initPosKm: { x: number; y: number; z: number },
  initVelKmS: { x: number; y: number; z: number },
  durationSec: number,
  sunPosKm: [number, number, number],
  moonPosKm: [number, number, number],
  cubeSat: CubeSatSpec,
  numPoints = 120
): Array<{ x: number; y: number; z: number; altKm: number; inEclipse: boolean }> {
  const points: Array<{ x: number; y: number; z: number; altKm: number; inEclipse: boolean }> = [];
  const dt = durationSec / numPoints;

  let currentPos = { ...initPosKm };
  let currentVel = { ...initVelKmS };

  for (let i = 0; i <= numPoints; i++) {
    const r = Math.sqrt(currentPos.x * currentPos.x + currentPos.y * currentPos.y + currentPos.z * currentPos.z);
    const altKm = r - EARTH_RADIUS_KM;
    const eclipse = computeNasaEclipseFraction(currentPos, sunPosKm);

    points.push({
      x: currentPos.x,
      y: currentPos.y,
      z: currentPos.z,
      altKm,
      inEclipse: eclipse.eclipseFraction < 0.5,
    });

    if (i < numPoints) {
      const next = stepOrekitRk4(currentPos, currentVel, dt, sunPosKm, moonPosKm, cubeSat);
      currentPos = next.positionKm;
      currentVel = next.velocityKmS;
    }
  }

  return points;
}


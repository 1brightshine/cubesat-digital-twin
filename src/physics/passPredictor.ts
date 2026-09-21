/**
 * Ground Station Pass Prediction Engine
 * Computes topocentric Azimuth, Elevation, Range, and exact AOS / TCA / LOS
 * for upcoming satellite passes over any Earth ground station based on real orbital mechanics.
 * 
 * References:
 * - David A. Vallado, "Fundamentals of Astrodynamics and Applications" (4th ed.), Section 4.4 Topocentric Horizon Coordinates.
 * - Montenbruck & Gill, "Satellite Orbits: Models, Methods and Applications", Springer.
 */

import { KeplerianElements, GroundStation } from '../types';
import {
  EARTH_RADIUS_KM,
  MU_EARTH,
  J2_EARTH,
  EARTH_ROTATION_RAD_PER_SEC,
  degToRad,
  radToDeg,
  solveKepler,
  eccentricToTrueAnomaly,
  trueToEccentricAnomaly,
  getGMST,
  keplerianToECI,
  isSatelliteInEclipse,
} from './orbitalMechanics';

export interface PassPrediction {
  passNumber: number;
  stationId: string;
  stationName: string;
  aosTime: Date;
  tcaTime: Date;
  losTime: Date;
  durationSec: number;
  maxElevationDeg: number;
  minDistanceKm: number;
  aosAzimuthDeg: number;
  losAzimuthDeg: number;
  tcaAzimuthDeg: number;
  maxDopplerShiftKHz: number;
  inSunlightAtTca: boolean;
  status: 'active' | 'upcoming';
  timeUntilAosSec: number;
}

/**
 * Transforms geodetic station coordinates and satellite geocentric position to Topocentric SEZ frame
 * Returns Azimuth [0, 360), Elevation [-90, 90], and Slant Range (km).
 */
export function calculateTopocentricPosition(
  satEci: { x: number; y: number; z: number },
  gmstRad: number,
  stationLatDeg: number,
  stationLonDeg: number,
  stationAltKm = 0
): { azimuthDeg: number; elevationDeg: number; slantRangeKm: number } {
  // Convert sat from ECI to ECEF (rotate by GMST)
  const cosG = Math.cos(gmstRad);
  const sinG = Math.sin(gmstRad);
  const satEcef = {
    x: satEci.x * cosG + satEci.y * sinG,
    y: -satEci.x * sinG + satEci.y * cosG,
    z: satEci.z,
  };

  // Convert station lat/lon to ECEF
  const phi = degToRad(stationLatDeg);
  const lam = degToRad(stationLonDeg);
  const rStation = EARTH_RADIUS_KM + stationAltKm;
  const stationEcef = {
    x: rStation * Math.cos(phi) * Math.cos(lam),
    y: rStation * Math.cos(phi) * Math.sin(lam),
    z: rStation * Math.sin(phi),
  };

  // Relative vector from ground station to satellite in ECEF
  const dx = satEcef.x - stationEcef.x;
  const dy = satEcef.y - stationEcef.y;
  const dz = satEcef.z - stationEcef.z;

  // Transform ECEF slant vector into Topocentric SEZ (South, East, Zenith) frame
  const sinPhi = Math.sin(phi);
  const cosPhi = Math.cos(phi);
  const sinLam = Math.sin(lam);
  const cosLam = Math.cos(lam);

  const south = sinPhi * cosLam * dx + sinPhi * sinLam * dy - cosPhi * dz;
  const east = -sinLam * dx + cosLam * dy;
  const zenith = cosPhi * cosLam * dx + cosPhi * sinLam * dy + sinPhi * dz;

  const slantRangeKm = Math.sqrt(south * south + east * east + zenith * zenith);
  if (slantRangeKm === 0) {
    return { azimuthDeg: 0, elevationDeg: 90, slantRangeKm: 0 };
  }

  // Elevation angle above local astronomical horizon
  const elevationRad = Math.asin(Math.max(-1, Math.min(1, zenith / slantRangeKm)));
  const elevationDeg = radToDeg(elevationRad);

  // Azimuth measured clockwise from North (0° = North, 90° = East, 180° = South, 270° = West)
  // In SEZ: North is -South, East is +East.
  let azimuthRad = Math.atan2(east, -south);
  if (azimuthRad < 0) azimuthRad += 2 * Math.PI;
  const azimuthDeg = radToDeg(azimuthRad);

  return { azimuthDeg, elevationDeg, slantRangeKm };
}

/**
 * Predicts the next N upcoming ground station passes starting from startDate.
 * Uses realistic two-body astrodynamics with J2 secular nodal and apsidal drift
 * and Greenwich Mean Sidereal Time Earth rotation.
 */
export function predictUpcomingPasses(
  elements: KeplerianElements,
  startDate: Date,
  station: GroundStation,
  passCount = 3,
  maxSearchHours = 48
): PassPrediction[] {
  const passes: PassPrediction[] = [];
  const { a, e, i, raan, argPerigee, trueAnomaly } = elements;

  const periodSec = 2 * Math.PI * Math.sqrt(Math.pow(a, 3) / MU_EARTH);
  const n_rad_s = Math.sqrt(MU_EARTH / Math.pow(a, 3));
  const p = a * (1 - e * e);
  const iRad = degToRad(i);

  // J2 secular perturbations on RAAN and argument of perigee
  const dOmega_dt_rad_s =
    -1.5 * J2_EARTH * Math.pow(EARTH_RADIUS_KM / p, 2) * n_rad_s * Math.cos(iRad);
  const dw_dt_rad_s =
    0.75 *
    J2_EARTH *
    Math.pow(EARTH_RADIUS_KM / p, 2) *
    n_rad_s *
    (5 * Math.pow(Math.cos(iRad), 2) - 1);

  // Initial mean anomaly from true anomaly
  const nu0Rad = degToRad(trueAnomaly);
  const E0Rad = trueToEccentricAnomaly(nu0Rad, e);
  const M0Rad = E0Rad - e * Math.sin(E0Rad);

  const startGMST = getGMST(startDate);
  const startTimeMs = startDate.getTime();

  // Search parameters
  const stepSec = 25; // coarse search step
  const maxSearchSec = maxSearchHours * 3600;
  const minElDeg = station.minElevationDeg || 5;

  let inPass = false;
  let currentAosMs = 0;
  let currentAosAz = 0;
  let maxEl = -90;
  let maxElTimeMs = 0;
  let maxElAz = 0;
  let minRange = Infinity;
  let tcaPos = { x: 0, y: 0, z: 0 };

  const evalAtTime = (tSec: number) => {
    const M_current = M0Rad + n_rad_s * tSec;
    const E_current = solveKepler(M_current, e);
    const nu_current = eccentricToTrueAnomaly(E_current, e);

    const currentRAAN = raan + radToDeg(dOmega_dt_rad_s * tSec);
    const currentArgP = argPerigee + radToDeg(dw_dt_rad_s * tSec);

    const tempElements: KeplerianElements = {
      ...elements,
      raan: currentRAAN,
      argPerigee: currentArgP,
      trueAnomaly: radToDeg(nu_current),
    };

    const { position } = keplerianToECI(tempElements);
    const gmst = startGMST + EARTH_ROTATION_RAD_PER_SEC * tSec;

    const topo = calculateTopocentricPosition(
      position,
      gmst,
      station.lat,
      station.lon,
      0
    );

    return {
      position,
      gmst,
      elevationDeg: topo.elevationDeg,
      azimuthDeg: topo.azimuthDeg,
      slantRangeKm: topo.slantRangeKm,
      timeMs: startTimeMs + tSec * 1000,
    };
  };

  // Check if currently inside a pass at t=0
  const initialSample = evalAtTime(0);
  if (initialSample.elevationDeg >= minElDeg) {
    inPass = true;
    currentAosMs = startTimeMs;
    currentAosAz = initialSample.azimuthDeg;
    maxEl = initialSample.elevationDeg;
    maxElTimeMs = startTimeMs;
    maxElAz = initialSample.azimuthDeg;
    minRange = initialSample.slantRangeKm;
    tcaPos = initialSample.position;
  }

  for (let tSec = 0; tSec <= maxSearchSec; tSec += stepSec) {
    const sample = evalAtTime(tSec);

    if (sample.elevationDeg >= minElDeg) {
      if (!inPass) {
        // Acquisition of Signal (AOS) detected
        inPass = true;
        // Refine AOS time with fine search (1-second steps between tSec - stepSec and tSec)
        let refinedAosMs = sample.timeMs;
        let refinedAosAz = sample.azimuthDeg;
        for (let subT = Math.max(0, tSec - stepSec); subT <= tSec; subT += 2) {
          const subSample = evalAtTime(subT);
          if (subSample.elevationDeg >= minElDeg) {
            refinedAosMs = subSample.timeMs;
            refinedAosAz = subSample.azimuthDeg;
            break;
          }
        }
        currentAosMs = refinedAosMs;
        currentAosAz = refinedAosAz;
        maxEl = sample.elevationDeg;
        maxElTimeMs = sample.timeMs;
        maxElAz = sample.azimuthDeg;
        minRange = sample.slantRangeKm;
        tcaPos = sample.position;
      } else {
        // Track maximum elevation (TCA)
        if (sample.elevationDeg > maxEl) {
          maxEl = sample.elevationDeg;
          maxElTimeMs = sample.timeMs;
          maxElAz = sample.azimuthDeg;
          minRange = sample.slantRangeKm;
          tcaPos = sample.position;
        }
      }
    } else {
      if (inPass) {
        // Loss of Signal (LOS) detected
        inPass = false;

        // Refine LOS time
        let refinedLosMs = sample.timeMs;
        let refinedLosAz = sample.azimuthDeg;
        for (let subT = Math.max(0, tSec - stepSec); subT <= tSec; subT += 2) {
          const subSample = evalAtTime(subT);
          if (subSample.elevationDeg < minElDeg) {
            refinedLosMs = subSample.timeMs;
            refinedLosAz = subSample.azimuthDeg;
            break;
          }
        }

        const durationSec = Math.round((refinedLosMs - currentAosMs) / 1000);

        // Only keep passes with positive duration
        if (durationSec > 10) {
          const tcaDate = new Date(maxElTimeMs);
          const inSunlight = !isSatelliteInEclipse(tcaPos, tcaDate);

          // Doppler shift estimation at 437.5 MHz (UHF Amateur satellite band)
          // Max Doppler frequency ~ (v_sat / c) * f0 * cos(gamma)
          const satSpeedKmS = Math.sqrt(MU_EARTH / a);
          const c_km_s = 299792.458;
          const f0_MHz = 437.5;
          const maxDopplerKHz = (satSpeedKmS / c_km_s) * f0_MHz * 1000;

          const isCurrentlyActive =
            startTimeMs >= currentAosMs && startTimeMs <= refinedLosMs;
          const timeUntilAosSec = Math.max(0, Math.round((currentAosMs - startTimeMs) / 1000));

          passes.push({
            passNumber: passes.length + 1,
            stationId: station.id,
            stationName: station.name,
            aosTime: new Date(currentAosMs),
            tcaTime: tcaDate,
            losTime: new Date(refinedLosMs),
            durationSec,
            maxElevationDeg: maxEl,
            minDistanceKm: minRange,
            aosAzimuthDeg: currentAosAz,
            losAzimuthDeg: refinedLosAz,
            tcaAzimuthDeg: maxElAz,
            maxDopplerShiftKHz: Number(maxDopplerKHz.toFixed(1)),
            inSunlightAtTca: inSunlight,
            status: isCurrentlyActive ? 'active' : 'upcoming',
            timeUntilAosSec,
          });

          if (passes.length >= passCount) {
            break;
          }
        }
      }
    }
  }

  return passes;
}

/**
 * Returns a human-friendly azimuth cardinal direction (e.g. N, NNE, NE, ENE, E...)
 */
export function azimuthToCompass(azDeg: number): string {
  const directions = [
    'N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE',
    'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW',
  ];
  const index = Math.round(((azDeg % 360) / 22.5)) % 16;
  return directions[index];
}

/**
 * Formats a duration in seconds to "Xm Ys"
 */
export function formatPassDuration(sec: number): string {
  const mins = Math.floor(sec / 60);
  const secs = sec % 60;
  return `${mins}m ${secs.toString().padStart(2, '0')}s`;
}

/**
 * Formats countdown time until pass
 */
export function formatTimeUntilPass(sec: number): string {
  if (sec <= 0) return 'Active Now';
  if (sec < 60) return `in ${sec}s`;
  const mins = Math.floor(sec / 60);
  if (mins < 60) {
    const s = sec % 60;
    return `in ${mins}m ${s > 0 ? `${s}s` : ''}`;
  }
  const hours = Math.floor(mins / 60);
  const remMins = mins % 60;
  return `in ${hours}h ${remMins}m`;
}

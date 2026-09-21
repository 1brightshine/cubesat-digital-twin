/**
 * SGP4 / SDP4 Orbital Propagator Engine
 * Powered by satellite.js (David A. Vallado SGP4 / Spacetrack Report #3 standard)
 */

import * as satellite from 'satellite.js';
import { KeplerianElements, Sgp4PropagationResult } from '../types';
import { EARTH_RADIUS_KM, MU_EARTH, eccentricToTrueAnomaly } from './orbitalMechanics';
import { computeSpiceSunPosition, computeNasaEclipseFraction } from './spiceGeometry';

export interface SatRecObj {
  satrec: satellite.SatRec;
  name: string;
  noradId: number;
}

/**
 * Initializes a satellite record from Two-Line Element (TLE) lines
 */
export function initSgp4Satrec(line1: string, line2: string, name = 'CubeSat'): SatRecObj | null {
  try {
    const trimmedL1 = line1.trim();
    const trimmedL2 = line2.trim();
    const satrec = satellite.twoline2satrec(trimmedL1, trimmedL2);
    if (!satrec) return null;

    let noradId = 99999;
    const parts = trimmedL1.split(/\s+/);
    if (parts.length >= 2) {
      const parsedId = parseInt(parts[1].replace(/[^0-9]/g, ''), 10);
      if (!isNaN(parsedId)) noradId = parsedId;
    }

    return { satrec, name, noradId };
  } catch (err) {
    console.error('Failed to parse TLE with SGP4:', err);
    return null;
  }
}

/**
 * Propagates SGP4 state to an exact Date
 */
export function propagateSgp4AtTime(
  satrec: satellite.SatRec,
  date: Date
): Sgp4PropagationResult | null {
  try {
    const positionAndVelocity = satellite.propagate(satrec, date);
    if (!positionAndVelocity || typeof positionAndVelocity !== 'object') {
      return null;
    }

    const pos = (positionAndVelocity as { position?: { x: number; y: number; z: number } }).position;
    const vel = (positionAndVelocity as { velocity?: { x: number; y: number; z: number } }).velocity;

    if (!pos || !vel || typeof pos.x !== 'number' || typeof vel.x !== 'number') {
      return null;
    }

    // Distance from Earth center in km
    const distKm = Math.sqrt(pos.x * pos.x + pos.y * pos.y + pos.z * pos.z);
    const speedKmS = Math.sqrt(vel.x * vel.x + vel.y * vel.y + vel.z * vel.z);

    // Greenwich Mean Sidereal Time (GMST)
    const gmst = satellite.gstime(date);

    // Convert ECI to Geodetic
    const geodetic = satellite.eciToGeodetic(pos, gmst);
    const latDeg = satellite.degreesLat(geodetic.latitude);
    const lonDeg = satellite.degreesLong(geodetic.longitude);
    const altKm = geodetic.height;

    // Check eclipse using NASA SPICE dual-cone geometry
    let inEclipse = false;
    try {
      const sun = computeSpiceSunPosition(date);
      const eclipse = computeNasaEclipseFraction(pos, sun.positionKm);
      inEclipse = eclipse.eclipseFraction < 0.5;
    } catch {
      inEclipse = altKm < 1000 && pos.x < 0 && Math.sqrt(pos.y * pos.y + pos.z * pos.z) < EARTH_RADIUS_KM;
    }

    return {
      positionECI: { x: pos.x, y: pos.y, z: pos.z },
      velocityECI: { x: vel.x, y: vel.y, z: vel.z },
      geodetic: {
        latitude: latDeg,
        longitude: lonDeg,
        altitudeKm: altKm,
      },
      speedKmS,
      distanceKm: distKm,
      gmstRad: gmst,
      inEclipse,
      timestamp: date,
    };
  } catch (err) {
    console.error('SGP4 propagation error:', err);
    return null;
  }
}

/**
 * Extracts approximate osculating/mean Keplerian elements from SGP4 satrec
 */
export function extractKeplerianFromSatrec(satrec: satellite.SatRec): KeplerianElements {
  // Mean motion in revs per day
  const no = (satrec.no * 1440) / (2 * Math.PI); // rad/min to rev/day
  const meanMotionRadsSec = (satrec.no * 2 * Math.PI) / 86400;

  // Semi-major axis a = (mu / n^2)^(1/3)
  const aKm = Math.pow(MU_EARTH / Math.pow(meanMotionRadsSec, 2), 1 / 3);

  const e = satrec.ecco;
  const incDeg = (satrec.inclo * 180) / Math.PI;
  const raanDeg = ((satrec.nodeo * 180) / Math.PI) % 360;
  const argPerigeeDeg = ((satrec.argpo * 180) / Math.PI) % 360;
  const meanAnomalyDeg = ((satrec.mo * 180) / Math.PI) % 360;

  // Approximate true anomaly from mean anomaly using Kepler's equation
  const M_rad = (meanAnomalyDeg * Math.PI) / 180;
  let E = M_rad;
  for (let i = 0; i < 6; i++) {
    E = E - (E - e * Math.sin(E) - M_rad) / (1 - e * Math.cos(E));
  }
  const nuRad = eccentricToTrueAnomaly(E, e);
  const trueAnomalyDeg = ((nuRad * 180) / Math.PI + 360) % 360;

  // Epoch date from satrec
  let epochDate = new Date();
  if (satrec.jdsatepoch) {
    // Julian date to JS Date
    const epochMs = (satrec.jdsatepoch - 2440587.5) * 86400000;
    epochDate = new Date(epochMs);
  }

  return {
    a: Math.max(6500, Math.min(42164, aKm)),
    e: Math.max(0.00001, Math.min(0.8, e)),
    i: Math.max(0, Math.min(180, incDeg)),
    raan: (raanDeg + 360) % 360,
    argPerigee: (argPerigeeDeg + 360) % 360,
    trueAnomaly: trueAnomalyDeg,
    epochDate,
  };
}

/**
 * Calculates a complete SGP4 3D orbital trajectory curve over one orbital period
 */
export function generateSgp4OrbitPoints(
  satrec: satellite.SatRec,
  baseDate: Date,
  numPoints = 120
): Array<{ x: number; y: number; z: number; altKm: number; inEclipse: boolean }> {
  const points: Array<{ x: number; y: number; z: number; altKm: number; inEclipse: boolean }> = [];

  // Orbital period in minutes
  const periodMin = satrec.no > 0 ? (2 * Math.PI) / satrec.no : 95;
  const stepMs = (periodMin * 60 * 1000) / numPoints;

  for (let i = 0; i <= numPoints; i++) {
    const t = new Date(baseDate.getTime() + i * stepMs);
    const state = propagateSgp4AtTime(satrec, t);
    if (state) {
      points.push({
        x: state.positionECI.x,
        y: state.positionECI.y,
        z: state.positionECI.z,
        altKm: state.geodetic.altitudeKm,
        inEclipse: state.inEclipse,
      });
    }
  }

  return points;
}

/**
 * Calculates SGP4 Ground Track points (lat/lon) over specified duration
 * Handles anti-meridian longitude wrapping cleanly into continuous segments
 */
export function generateSgp4GroundTrack(
  satrec: satellite.SatRec,
  startDate: Date,
  durationMinutes: number,
  stepSeconds = 30
): Array<Array<{ lat: number; lon: number; alt: number; time: Date }>> {
  const segments: Array<Array<{ lat: number; lon: number; alt: number; time: Date }>> = [];
  let currentSegment: Array<{ lat: number; lon: number; alt: number; time: Date }> = [];

  const totalSteps = Math.floor((durationMinutes * 60) / stepSeconds);
  let prevLon: number | null = null;

  for (let i = 0; i <= totalSteps; i++) {
    const t = new Date(startDate.getTime() + i * stepSeconds * 1000);
    const state = propagateSgp4AtTime(satrec, t);
    if (!state) continue;

    const lat = state.geodetic.latitude;
    const lon = state.geodetic.longitude;
    const alt = state.geodetic.altitudeKm;

    if (prevLon !== null && Math.abs(lon - prevLon) > 180) {
      // Crossed the anti-meridian (+180 / -180)
      if (currentSegment.length > 0) {
        segments.push(currentSegment);
        currentSegment = [];
      }
    }

    currentSegment.push({ lat, lon, alt, time: t });
    prevLon = lon;
  }

  if (currentSegment.length > 0) {
    segments.push(currentSegment);
  }

  return segments;
}

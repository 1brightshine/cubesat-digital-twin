/**
 * Orbital Lifetime and Secular Atmospheric Drag Decay Engine
 * Uses King-Hele secular equations and orbit-averaged energy dissipation
 * Fully grounded in SI astrodynamics units for realistic de-orbit predictions
 */

import {
  KeplerianElements,
  CubeSatSpec,
  SolarConditions,
  LifetimeSimulationResult,
  DecayHistoryPoint,
  SailTradePoint,
  NasaAtmosphereModel,
} from '../types';
import { EARTH_RADIUS_KM, MU_EARTH } from './orbitalMechanics';
import {
  getAtmosphericDensity,
  getDynamicSolarFlux,
  ATMOSPHERE_LAYERS,
  getNasaScaleHeight,
  computeSolarRadiationPressureAccel,
} from './atmosphere';

const REENTRY_ALTITUDE_KM = 120; // Critical re-entry threshold (mesosphere / Kármán interface)
const MAX_SIMULATION_YEARS = 100;

/**
 * Calculates current scale height H (in km) at given altitude
 */
function getScaleHeightAtAlt(
  altitudeKm: number,
  f107Flux = 130,
  apIndex = 15,
  model: NasaAtmosphereModel = 'nasa-das'
): number {
  if (model === 'nasa-das' || model === 'jacchia-roberts') {
    return getNasaScaleHeight(altitudeKm, f107Flux, apIndex);
  }

  for (let i = ATMOSPHERE_LAYERS.length - 1; i >= 0; i--) {
    if (altitudeKm >= ATMOSPHERE_LAYERS[i].baseAltKm) {
      return ATMOSPHERE_LAYERS[i].scaleHeightKm;
    }
  }
  return 60;
}

/**
 * Calculates secular rate of change of semi-major axis (km/day) and eccentricity (1/day)
 * using NASA DAS 3.0 / King-Hele modified Bessel quadrature.
 * All intermediate physical equations use SI units (m, s, kg) to ensure physical accuracy.
 */
function computeSecularDecayRates(
  aKm: number,
  e: number,
  bStarM2Kg: number, // (Cd * A) / m in m²/kg
  f107Flux: number,
  apIndex = 15,
  model: NasaAtmosphereModel = 'nasa-das',
  srpAccelMs2 = 0
): { da_dt_km_day: number; de_dt_day: number; currentDensityKgM3: number } {
  const hpKm = aKm * (1 - e) - EARTH_RADIUS_KM;

  if (hpKm <= REENTRY_ALTITUDE_KM) {
    const rhoReentry = getAtmosphericDensity(REENTRY_ALTITUDE_KM, f107Flux, apIndex, model);
    return { da_dt_km_day: -500, de_dt_day: -0.1, currentDensityKgM3: rhoReentry };
  }

  // Convert to standard SI units
  const aMeters = aKm * 1000;
  const muSI = 3.986004418e14; // Earth gravitational parameter in m³/s²
  const vCircMS = Math.sqrt(muSI / aMeters); // Mean orbital velocity in m/s

  const rhoPerigee = getAtmosphericDensity(hpKm, f107Flux, apIndex, model); // kg/m³
  const H_km = getScaleHeightAtAlt(hpKm, f107Flux, apIndex, model); // Scale height in km
  const c = (aKm * e) / Math.max(0.5, H_km); // King-Hele dimensionless parameter

  let da_dt_ms = 0; // rate of change of semi-major axis in m/s
  let de_dt_s = 0;  // rate of change of eccentricity in 1/s
  let effectiveRho = rhoPerigee;

  if (e < 0.005 || c < 0.1) {
    // Near-circular orbit: constant density at mean altitude h = a - R_E
    const hMeanKm = aKm - EARTH_RADIUS_KM;
    effectiveRho = getAtmosphericDensity(hMeanKm, f107Flux, apIndex, model);
    // da/dt = - a * v * rho * B* (in m/s)
    da_dt_ms = -aMeters * vCircMS * effectiveRho * bStarM2Kg;
    // Circularization rate
    de_dt_s = -e * vCircMS * effectiveRho * bStarM2Kg;
  } else if (c < 3.0) {
    // Small to moderate eccentricity: King-Hele Bessel function expansion (NASA DAS 3.0 formulation)
    // I_0(c), I_1(c), I_2(c) modified Bessel functions of the first kind
    const c2 = c * c;
    const c4 = c2 * c2;
    const I0 = 1 + c2 / 4 + c4 / 64 + (c4 * c2) / 2304;
    const I1 = c / 2 + (c * c2) / 16 + (c * c4) / 384;
    const I2 = c2 / 8 + c4 / 96;
    const exp_c = Math.exp(-c);

    // Orbit-averaged effective drag density
    effectiveRho = rhoPerigee * exp_c * (I0 + 2 * e * I1 + 0.75 * e * e * (I0 + I2));

    da_dt_ms = -aMeters * vCircMS * bStarM2Kg * rhoPerigee * exp_c * (I0 + 2 * e * I1 + 0.75 * e * e * (I0 + I2));
    de_dt_s = -vCircMS * bStarM2Kg * rhoPerigee * exp_c * (2 * I1 + e * (I0 + I2) + 0.25 * e * e * (3 * I1));
  } else {
    // Higher eccentricity: drag is strongly peaked around perigee
    // Asymptotic expansion: exp(-c) * I0(c) ~ 1 / sqrt(2 * pi * c) * (1 + 1/(8c))
    const factor = (1 / Math.sqrt(2 * Math.PI * c)) * (1 + 1 / (8 * c));
    effectiveRho = rhoPerigee * factor * (1 + 2 * e);

    da_dt_ms = -aMeters * vCircMS * bStarM2Kg * effectiveRho;
    // In high eccentricity, perigee altitude drops much more slowly than apogee
    de_dt_s = -((1 - e * e) / aMeters) * vCircMS * bStarM2Kg * effectiveRho * 0.82;
  }

  // NASA DAS Solar Radiation Pressure (SRP) perturbation: slight secular eccentricity modulation for high altitudes
  if (hpKm > 350 && srpAccelMs2 > 0) {
    // Periodic SRP amplitude factor: ~ 1.5 * sqrt(a/mu) * a_srp
    const srpFactor = 1.5 * Math.sqrt(aMeters / muSI) * srpAccelMs2 * 0.05;
    de_dt_s += srpFactor * 1e-7 * (Math.sin(aKm) > 0 ? 1 : -1);
  }

  // Convert da/dt from m/s to km/day:
  // (m/s) * (86400 s/day) / (1000 m/km) = * 86.4
  const da_dt_km_day = da_dt_ms * 86.4;
  // Convert de/dt from 1/s to 1/day:
  const de_dt_day = de_dt_s * 86400;

  return {
    da_dt_km_day,
    de_dt_day,
    currentDensityKgM3: effectiveRho,
  };
}

/**
 * Runs adaptive multi-step secular integration to predict CubeSat lifetime
 */
export function simulateLifetime(
  elements: KeplerianElements,
  cubeSat: CubeSatSpec,
  solar: SolarConditions,
  overrideTotalAreaM2?: number
): LifetimeSimulationResult {
  const additionalArea = cubeSat.additionalArea || 0;
  const isNadirTimeAvg = cubeSat.useNadirTimeAveragedArea !== false;
  let effectiveAddnl = additionalArea;
  if (cubeSat.attitudeMode === 'nadir') {
    if (isNadirTimeAvg && (cubeSat.nadirAdditionalMode === 'in-plane-average' || cubeSat.nadirAdditionalMode === 'sun-tracking')) {
      // Astrodynamics orbit time-averaged projection: (2 / pi) * A_add
      effectiveAddnl = (2 / Math.PI) * additionalArea;
    } else if (!isNadirTimeAvg && cubeSat.nadirAdditionalMode === 'in-plane-average') {
      const pitchRad = ((cubeSat.nadirPitchAngleDeg ?? 0) * Math.PI) / 180;
      effectiveAddnl = additionalArea * Math.abs(Math.cos(pitchRad));
    }
  }

  const totalArea =
    overrideTotalAreaM2 !== undefined
      ? overrideTotalAreaM2
      : cubeSat.dragArea +
        effectiveAddnl +
        (cubeSat.hasDragSail ? cubeSat.dragSailArea : 0);

  // Ballistic coefficient parameter B* = (Cd * A) / m in m²/kg
  const bStarM2Kg = (cubeSat.dragCoefficient * Math.max(0.0001, totalArea)) / cubeSat.mass;

  // NASA Solar Radiation Pressure acceleration
  const srpAccelMs2 = computeSolarRadiationPressureAccel(cubeSat.mass, totalArea, cubeSat.reflectivity);
  const atmosphereModel: NasaAtmosphereModel = solar.atmosphereModel || 'nasa-das';
  const apIndex = solar.apIndex ?? 15;

  let currentA = elements.a;
  let currentE = Math.max(0, Math.min(0.95, elements.e));
  let currentDays = 0;

  const history: DecayHistoryPoint[] = [];
  const maxDays = MAX_SIMULATION_YEARS * 365.25;

  const initialHp = currentA * (1 - currentE) - EARTH_RADIUS_KM;
  const initialHa = currentA * (1 + currentE) - EARTH_RADIUS_KM;
  const initialRates = computeSecularDecayRates(
    currentA,
    currentE,
    bStarM2Kg,
    solar.f107,
    apIndex,
    atmosphereModel,
    srpAccelMs2
  );
  const initialDecayRateKmPerDay = Math.abs(initialRates.da_dt_km_day);

  // Handle immediate re-entry if perigee is already at or below critical threshold (120 km)
  if (initialHp <= REENTRY_ALTITUDE_KM) {
    const promptDays = 0.08; // ~2 hours (approx 1 orbital revolution)
    for (let step = 0; step <= 10; step++) {
      const frac = step / 10;
      const tDays = promptDays * frac;
      const curAlt = Math.max(REENTRY_ALTITUDE_KM, initialHp - (initialHp - REENTRY_ALTITUDE_KM + 10) * frac);
      history.push({
        timeDays: Math.round(tDays * 1000) / 1000,
        timeYears: Math.round((tDays / 365.25) * 1000) / 1000,
        altitudeKm: Math.round(curAlt * 10) / 10,
        perigeeKm: Math.round(curAlt * 10) / 10,
        apogeeKm: Math.round(Math.max(curAlt, initialHa * (1 - frac)) * 10) / 10,
        eccentricity: Math.max(0, currentE * (1 - frac)),
        densityKgM3: getAtmosphericDensity(curAlt, solar.f107, apIndex, atmosphereModel),
        velocityKmS: Math.round(Math.sqrt(MU_EARTH / (EARTH_RADIUS_KM + curAlt)) * 1000) / 1000,
        solarFlux: solar.f107,
      });
    }

    return {
      lifetimeDays: 0.1,
      lifetimeYears: 0.0003,
      decayRateKmPerDay: Math.max(10, initialDecayRateKmPerDay),
      decayRateKmPerYear: Math.max(3650, initialDecayRateKmPerDay * 365.25),
      reentryDate: 'Prompt Re-entry (< 2 Hours)',
      isCompliantIADC25Yr: true,
      isCompliantFCC5Yr: true,
      history,
      sailTradeStudy: [],
    };
  }

  // Record initial orbital state point
  history.push({
    timeDays: 0,
    timeYears: 0,
    altitudeKm: Math.round((currentA - EARTH_RADIUS_KM) * 10) / 10,
    perigeeKm: Math.round(initialHp * 10) / 10,
    apogeeKm: Math.round(initialHa * 10) / 10,
    eccentricity: Math.round(currentE * 10000) / 10000,
    densityKgM3: initialRates.currentDensityKgM3,
    velocityKmS: Math.round(Math.sqrt(MU_EARTH / currentA) * 1000) / 1000,
    solarFlux: solar.f107,
  });

  let stepCount = 0;
  const maxSteps = 4000;
  let lastRecordedDays = 0;
  let lastRecordedAlt = currentA - EARTH_RADIUS_KM;

  while (currentDays < maxDays && stepCount < maxSteps) {
    stepCount++;
    const hp = currentA * (1 - currentE) - EARTH_RADIUS_KM;

    if (hp <= REENTRY_ALTITUDE_KM) {
      break;
    }

    // Solar flux: dynamic cycle vs static
    let currentFlux = solar.f107;
    if (solar.modelType === 'cycle') {
      currentFlux = getDynamicSolarFlux(currentDays, solar.f107);
    }

    const { da_dt_km_day, de_dt_day, currentDensityKgM3 } = computeSecularDecayRates(
      currentA,
      currentE,
      bStarM2Kg,
      currentFlux,
      apIndex,
      atmosphereModel,
      srpAccelMs2
    );

    const dailyDrop = Math.abs(da_dt_km_day);

    // Adaptive step sizing: limit altitude loss per integration step to preserve numerical stability
    // Aim for ~0.8 to 1.5 km drop per step, bounded between 0.001 days and 30 days
    let dtDays = 1.0;
    if (dailyDrop > 0.0001) {
      dtDays = Math.min(30.0, Math.max(0.001, 1.2 / dailyDrop));
    } else {
      dtDays = 30.0;
    }

    // Ensure we do not step past maxDays
    if (currentDays + dtDays > maxDays) {
      dtDays = maxDays - currentDays;
    }

    // Advance orbital state
    const deltaA = da_dt_km_day * dtDays;
    const deltaE = de_dt_day * dtDays;

    currentA += deltaA;
    currentE = Math.max(0, currentE + deltaE);
    currentDays += dtDays;

    const currentHp = currentA * (1 - currentE) - EARTH_RADIUS_KM;
    const currentHa = currentA * (1 + currentE) - EARTH_RADIUS_KM;
    const currentMeanAlt = currentA - EARTH_RADIUS_KM;

    // Check if re-entry occurred during this step
    if (currentHp <= REENTRY_ALTITUDE_KM) {
      // Re-entry reached
      break;
    }

    // Record sample points for clean UI charting (~80-120 points total)
    const altDelta = Math.abs(lastRecordedAlt - currentMeanAlt);
    const timeDelta = currentDays - lastRecordedDays;
    const totalExpectedDays = maxDays;

    const shouldRecord =
      altDelta >= Math.max(1.0, (initialHp - REENTRY_ALTITUDE_KM) / 80) ||
      timeDelta >= Math.max(0.2, totalExpectedDays / 100) ||
      currentHp <= 160 ||
      stepCount % 10 === 0;

    if (shouldRecord) {
      history.push({
        timeDays: Math.round(currentDays * 10) / 10,
        timeYears: Math.round((currentDays / 365.25) * 100) / 100,
        altitudeKm: Math.round(currentMeanAlt * 10) / 10,
        perigeeKm: Math.round(currentHp * 10) / 10,
        apogeeKm: Math.round(currentHa * 10) / 10,
        eccentricity: Math.round(currentE * 10000) / 10000,
        densityKgM3: currentDensityKgM3,
        velocityKmS: Math.round(Math.sqrt(MU_EARTH / currentA) * 1000) / 1000,
        solarFlux: Math.round(currentFlux),
      });
      lastRecordedDays = currentDays;
      lastRecordedAlt = currentMeanAlt;
    }
  }

  // Append re-entry interface point if orbit re-entered
  const finalHp = currentA * (1 - currentE) - EARTH_RADIUS_KM;
  if (finalHp <= REENTRY_ALTITUDE_KM) {
    history.push({
      timeDays: Math.round(currentDays * 10) / 10,
      timeYears: Math.round((currentDays / 365.25) * 100) / 100,
      altitudeKm: REENTRY_ALTITUDE_KM,
      perigeeKm: REENTRY_ALTITUDE_KM,
      apogeeKm: REENTRY_ALTITUDE_KM,
      eccentricity: 0,
      densityKgM3: getAtmosphericDensity(REENTRY_ALTITUDE_KM, solar.f107, apIndex, atmosphereModel),
      velocityKmS: Math.round(Math.sqrt(MU_EARTH / (EARTH_RADIUS_KM + REENTRY_ALTITUDE_KM)) * 1000) / 1000,
      solarFlux: solar.f107,
    });
  }

  const lifetimeDays = currentDays;
  const lifetimeYears = currentDays / 365.25;

  // Re-entry projected date
  const now = new Date();
  const reentryDateObj = new Date(now.getTime() + lifetimeDays * 86400000);
  const reentryDate =
    lifetimeYears >= MAX_SIMULATION_YEARS
      ? '> 100 Years (Stable Orbit)'
      : reentryDateObj.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        });

  // Regulatory compliance checks
  const isCompliantIADC25Yr = lifetimeYears <= 25;
  const isCompliantFCC5Yr = lifetimeYears <= 5;

  // Calculate sail trade study if in top-level call
  const sailTradeStudy: SailTradePoint[] = [];
  if (overrideTotalAreaM2 === undefined) {
    const sailAreas = [0, 0.25, 0.5, 1.0, 1.5, 2.0, 3.0, 5.0];
    for (const sArea of sailAreas) {
      const simArea = cubeSat.dragArea + sArea;
      const res = simulateLifetime(elements, cubeSat, solar, simArea);
      sailTradeStudy.push({
        sailArea: sArea,
        totalArea: simArea,
        lifetimeYears: Math.round(res.lifetimeYears * 100) / 100,
        lifetimeDays: Math.round(res.lifetimeDays),
        iadcCompliant: res.isCompliantIADC25Yr,
        fccCompliant: res.isCompliantFCC5Yr,
      });
    }
  }

  return {
    lifetimeDays: Math.round(lifetimeDays * 10) / 10,
    lifetimeYears: Math.round(lifetimeYears * 100) / 100,
    decayRateKmPerDay: Math.round(initialDecayRateKmPerDay * 10000) / 10000,
    decayRateKmPerYear: Math.round(initialDecayRateKmPerDay * 365.25 * 100) / 100,
    reentryDate,
    isCompliantIADC25Yr,
    isCompliantFCC5Yr,
    history,
    sailTradeStudy,
  };
}



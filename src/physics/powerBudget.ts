/**
 * Real NASA Data CubeSat Electrical Power System (EPS) & Power Budget Engine
 * 
 * References & Real Data Sources:
 * - NASA Solar Measurement Mission / TSIS-1 (Total and Spectral Solar Irradiance Sensor):
 *   Solar Constant AM0 = 1361.0 W/m² (at 1 AU).
 * - NASA SP-20205003605 "State-of-the-Art of Small Spacecraft Technology" (Small Spacecraft Systems Virtual Institute - S3VI).
 * - NASA-HDBK-4001 / NASA Ames CubeSat Design Standard: Electrical Power Systems & 20% CDR Margin Guideline.
 * - Spectrolab / Azur Space 3G30A Triple-Junction Space Solar Cell data sheet (29.5% BOL efficiency, -0.2%/°C temp coefficient).
 * - NASA LEO Battery Guidelines (Depth-of-Discharge < 20-30% for Li-ion 18650 space qualification).
 */

import { CubeSatSpec, OrbitDerivedState, KeplerianElements } from '../types';
import { SOLAR_CONSTANT_WM2, ASTRONOMICAL_UNIT_KM } from './spiceGeometry';

export interface PowerSubsystem {
  id: string;
  name: string;
  category: 'obc' | 'adcs' | 'eps' | 'thermal' | 'payload' | 'comms';
  powerNominalWatts: number;
  powerPeakWatts: number;
  powerEclipseWatts: number;
  dutyCyclePercent: number; // 0 to 100
  description: string;
}

export interface OrbitPowerBudgetResult {
  // NASA Solar Physics
  solarIrradianceWm2: number;
  effectiveSolarFluxWm2: number;
  sunEarthDistAU: number;
  
  // Solar Array Specs & Generation
  solarArrayAreaM2: number;
  cellEfficiencyPercent: number;
  temperatureLossFactor: number;
  packingFactor: number;
  attitudeIncidenceFactor: number;
  peakGenerationWatts: number;
  orbitAverageGenerationWatts: number;
  energyGeneratedPerOrbitWh: number;

  // Subsystem Power Consumption Breakdown
  subsystems: Array<PowerSubsystem & { orbitAverageWatts: number; energyPerOrbitWh: number }>;
  totalOrbitAverageLoadWatts: number;
  totalEnergyConsumedPerOrbitWh: number;
  daytimeLoadWatts: number;
  eclipseLoadWatts: number;

  // Energy Balance & Flight Margins
  netPowerDeltaWatts: number; // Generation - Consumption
  netEnergyDeltaPerOrbitWh: number;
  powerMarginPercent: number; // ((Gen - Load) / Load) * 100%
  isNasaCompliantMargin: boolean; // NASA requires >= +20% power margin

  // Battery Storage & Depth-of-Discharge (DoD)
  batteryCapacityWh: number;
  batteryCapacityAh: number;
  batteryBusVoltageV: number;
  eclipseEnergyDrainedWh: number;
  depthOfDischargePercent: number;
  dodStatus: 'optimal' | 'acceptable' | 'high-risk';

  // Ground Station Pass High-Power Downlink Budget
  passCommTxPowerWatts: number;
  passEnergyDrainWh: number;
  maxDailyCommTimeMin: number;

  // 1-Orbit State-of-Charge Profile (Minute-by-minute simulation)
  socProfile: Array<{
    minute: number;
    inSunlight: boolean;
    batteryPercent: number;
    solarPowerWatts: number;
    loadWatts: number;
    netPowerWatts: number;
  }>;
}

/**
 * Returns baseline solar panel area in m² based on CubeSat form factor and deployed configuration
 */
export function getCubeSatSolarArea(cubeSat: CubeSatSpec): number {
  if (cubeSat.hasAdditionalArea && cubeSat.additionalArea && cubeSat.additionalArea > 0) {
    return cubeSat.additionalArea;
  }

  // Baseline solar cell mounting surface areas (m²)
  switch (cubeSat.formFactor) {
    case '0.5U':
      return 0.005; // 5x10 cm
    case '1U':
      return 0.010; // 10x10 cm (one face)
    case '1.5U':
      return 0.015;
    case '2U':
      return 0.020; // 10x20 cm
    case '3U':
      return 0.034; // 10x34 cm (single face) or deployed
    case '6U':
      return 0.060; // 20x30 cm
    case '12U':
      return 0.120; // 20x20x30 cm
    case '16U':
      return 0.160;
    default:
      return 0.034;
  }
}

/**
 * Returns attitude cosine incidence factor for solar panels
 */
export function getAttitudeIncidenceFactor(attitudeMode?: string): number {
  switch (attitudeMode) {
    case 'sun-pointing':
      return 0.95; // Solar tracking / panel facing sun normal
    case 'broadside':
      return 0.55;
    case 'nadir':
      return 0.32; // Orbit-averaged cosine for nadir-locked Earth observation
    case 'ram':
    case 'ram-aerobrake':
      return 0.30;
    case 'tumbling':
    case 'detumbling-bdot':
    default:
      return 0.25; // 1/4 spherical average for isotropic tumbling
  }
}

/**
 * Returns default NASA-standard battery capacity in Watt-hours
 */
export function getDefaultBatteryCapacityWh(formFactor: string): number {
  switch (formFactor) {
    case '0.5U':
      return 10.0;
    case '1U':
      return 20.0; // 1S2P or 2S1P 18650
    case '1.5U':
      return 30.0;
    case '2U':
      return 40.0; // 2S2P 18650
    case '3U':
      return 45.0; // 4S2P or high-capacity space pack
    case '6U':
      return 90.0;
    case '12U':
      return 180.0;
    case '16U':
      return 240.0;
    default:
      return 45.0;
  }
}

/**
 * Generates standard NASA CubeSat Subsystems power baseline
 */
export function getNasaCubeSatSubsystems(payloadPowerMultiplier = 1.0): PowerSubsystem[] {
  return [
    {
      id: 'obc',
      name: 'OBC / C&DH Computer',
      category: 'obc',
      powerNominalWatts: 0.85,
      powerPeakWatts: 1.20,
      powerEclipseWatts: 0.85,
      dutyCyclePercent: 100,
      description: 'Flight computer, telemetry logging, memory scrubbing, and watchdog timer.',
    },
    {
      id: 'adcs',
      name: 'ADCS Attitude Control',
      category: 'adcs',
      powerNominalWatts: 1.15,
      powerPeakWatts: 2.40,
      powerEclipseWatts: 0.90,
      dutyCyclePercent: 100,
      description: 'Magnetorquers, reaction wheels, sun sensors, and rate gyros.',
    },
    {
      id: 'eps',
      name: 'EPS Power Conditioning',
      category: 'eps',
      powerNominalWatts: 0.40,
      powerPeakWatts: 0.60,
      powerEclipseWatts: 0.40,
      dutyCyclePercent: 100,
      description: 'DC-DC buck/boost converters, MPPT controllers, battery management ICs.',
    },
    {
      id: 'thermal',
      name: 'Thermal Survival Heaters',
      category: 'thermal',
      powerNominalWatts: 0.20,
      powerPeakWatts: 1.80,
      powerEclipseWatts: 1.50,
      dutyCyclePercent: 40,
      description: 'Thermostatic survival heaters for battery pack and propellant during eclipse.',
    },
    {
      id: 'payload',
      name: 'Mission Payload & Sensor',
      category: 'payload',
      powerNominalWatts: 2.20 * payloadPowerMultiplier,
      powerPeakWatts: 4.50 * payloadPowerMultiplier,
      powerEclipseWatts: 0.30,
      dutyCyclePercent: 25,
      description: 'Multispectral Earth camera / space science sensor / experiment payload.',
    },
    {
      id: 'comms-rx',
      name: 'RF Transceiver (Rx / Beacon)',
      category: 'comms',
      powerNominalWatts: 0.45,
      powerPeakWatts: 0.50,
      powerEclipseWatts: 0.45,
      dutyCyclePercent: 100,
      description: 'Continuous UHF/VHF receiver and housekeeping health beacon.',
    },
    {
      id: 'comms-tx',
      name: 'RF Downlink (High-Rate Tx)',
      category: 'comms',
      powerNominalWatts: 5.80,
      powerPeakWatts: 7.20,
      powerEclipseWatts: 5.80,
      dutyCyclePercent: 8, // ~8% duty cycle corresponding to ground station pass windows
      description: 'S-band / UHF power amplifier during active ground station pass contact.',
    },
  ];
}

/**
 * Computes full Orbit Power Budget based on real NASA solar data and orbital mechanics
 */
export function calculatePowerBudget(
  elements: KeplerianElements,
  cubeSat: CubeSatSpec,
  derivedState: OrbitDerivedState,
  options?: {
    batteryCapacityWh?: number;
    cellEfficiency?: number; // default 0.295 (29.5%)
    customSubsystems?: PowerSubsystem[];
    operatingTempC?: number; // default 55°C
  }
): OrbitPowerBudgetResult {
  const periodMin = derivedState.orbitalPeriodMin || 94.6;
  const eclipseMin = derivedState.eclipseDurationMin || 35.2;
  const sunlitMin = Math.max(0, periodMin - eclipseMin);
  const sunlitFraction = periodMin > 0 ? sunlitMin / periodMin : 0.65;

  // 1. Real NASA Solar Irradiance AM0 (SORCE / TSIS-1 data)
  const solarIrradianceWm2 = SOLAR_CONSTANT_WM2; // 1361.0 W/m²
  const sunEarthDistAU = 1.0; // Nominal 1 AU
  const effectiveSolarFluxWm2 = solarIrradianceWm2;

  // 2. Solar Array Generation
  const solarArrayAreaM2 = getCubeSatSolarArea(cubeSat);
  const cellEfficiencyPercent = (options?.cellEfficiency ?? 0.295) * 100; // 29.5%
  const cellEff = cellEfficiencyPercent / 100;

  // Operating Temperature Derating: standard test 28°C, orbital operating temp ~55°C
  // Derating coeff: -0.2%/°C
  const operatingTempC = options?.operatingTempC ?? 55;
  const deltaT = Math.max(0, operatingTempC - 28);
  const temperatureLossFactor = Math.max(0.7, 1.0 - deltaT * 0.002); // ~0.946 at 55°C

  // Packing factor (active cell ratio on PCB) and cover glass degradation
  const packingFactor = 0.85;
  const coverGlassFactor = 0.92;

  // Attitude Incidence Factor
  const attitudeIncidenceFactor = getAttitudeIncidenceFactor(cubeSat.attitudeMode);

  // Peak Generation in direct normal sunlight
  const peakGenerationWatts =
    effectiveSolarFluxWm2 *
    solarArrayAreaM2 *
    cellEff *
    temperatureLossFactor *
    packingFactor *
    coverGlassFactor;

  // Orbit-averaged Generation
  const orbitAverageGenerationWatts =
    peakGenerationWatts * attitudeIncidenceFactor * sunlitFraction;

  // Energy Generated per orbit (Wh)
  const energyGeneratedPerOrbitWh =
    peakGenerationWatts * attitudeIncidenceFactor * (sunlitMin / 60);

  // 3. Subsystem Power Consumption Breakdown
  const baseSubsystems = options?.customSubsystems ?? getNasaCubeSatSubsystems();
  const subsystems = baseSubsystems.map((sub) => {
    // Duty-cycled average power
    const dutyFrac = sub.dutyCyclePercent / 100;
    const avgWatts =
      sub.powerNominalWatts * dutyFrac +
      (sub.id === 'thermal'
        ? (eclipseMin / periodMin) * sub.powerEclipseWatts
        : 0);
    const energyWh = avgWatts * (periodMin / 60);
    return {
      ...sub,
      orbitAverageWatts: Number(avgWatts.toFixed(2)),
      energyPerOrbitWh: Number(energyWh.toFixed(2)),
    };
  });

  const totalOrbitAverageLoadWatts = subsystems.reduce(
    (sum, s) => sum + s.orbitAverageWatts,
    0
  );
  const totalEnergyConsumedPerOrbitWh =
    totalOrbitAverageLoadWatts * (periodMin / 60);

  // Separate Daytime and Eclipse loads
  const daytimeLoadWatts = subsystems.reduce((sum, s) => {
    if (s.id === 'thermal') return sum + s.powerNominalWatts * (s.dutyCyclePercent / 100);
    return sum + s.powerNominalWatts * (s.dutyCyclePercent / 100);
  }, 0);

  const eclipseLoadWatts = subsystems.reduce((sum, s) => {
    if (s.id === 'thermal') return sum + s.powerEclipseWatts;
    if (s.id === 'payload') return sum + s.powerEclipseWatts;
    return sum + s.powerNominalWatts * (s.dutyCyclePercent / 100);
  }, 0);

  // 4. Energy Balance & Flight Margins
  const netPowerDeltaWatts = orbitAverageGenerationWatts - totalOrbitAverageLoadWatts;
  const netEnergyDeltaPerOrbitWh = energyGeneratedPerOrbitWh - totalEnergyConsumedPerOrbitWh;
  const powerMarginPercent =
    totalOrbitAverageLoadWatts > 0
      ? ((orbitAverageGenerationWatts - totalOrbitAverageLoadWatts) /
          totalOrbitAverageLoadWatts) *
        100
      : 0;
  const isNasaCompliantMargin = powerMarginPercent >= 20.0; // NASA requires >= +20% margin

  // 5. Battery Capacity & Depth of Discharge (DoD)
  const batteryCapacityWh =
    options?.batteryCapacityWh ?? getDefaultBatteryCapacityWh(cubeSat.formFactor);
  const batteryBusVoltageV = 7.4; // 2S configuration nominal (7.4V) or 14.8V (4S)
  const batteryCapacityAh = batteryCapacityWh / batteryBusVoltageV;

  const eclipseEnergyDrainedWh = eclipseLoadWatts * (eclipseMin / 60);
  const depthOfDischargePercent =
    batteryCapacityWh > 0 ? (eclipseEnergyDrainedWh / batteryCapacityWh) * 100 : 0;

  let dodStatus: 'optimal' | 'acceptable' | 'high-risk' = 'optimal';
  if (depthOfDischargePercent > 30) {
    dodStatus = 'high-risk';
  } else if (depthOfDischargePercent > 20) {
    dodStatus = 'acceptable';
  }

  // 6. Ground Station Pass Comm Link Budget
  const passCommTxPowerWatts = 5.80; // UHF / S-Band high-power amplifier
  const avgPassMin = 8.5;
  const passEnergyDrainWh = passCommTxPowerWatts * (avgPassMin / 60);
  // Max daily comm passes supported by net energy
  const maxDailyCommTimeMin =
    netPowerDeltaWatts > 0
      ? Math.min(120, ((netPowerDeltaWatts * 24) / passCommTxPowerWatts) * 60)
      : 0;

  // 7. Minute-by-Minute State-of-Charge Profile over 1 Full Orbit
  const totalSteps = Math.round(periodMin);
  const socProfile: Array<{
    minute: number;
    inSunlight: boolean;
    batteryPercent: number;
    solarPowerWatts: number;
    loadWatts: number;
    netPowerWatts: number;
  }> = [];

  let currentBatteryWh = batteryCapacityWh * 0.98; // Start at 98% charge
  const dtHours = 1 / 60; // 1 minute in hours

  for (let m = 0; m <= totalSteps; m++) {
    // Eclipse occurs during the middle/last portion of orbit
    const inSun = m < sunlitMin;
    const currentGen = inSun ? peakGenerationWatts * attitudeIncidenceFactor : 0;
    const currentLoad = inSun ? daytimeLoadWatts : eclipseLoadWatts;
    const netW = currentGen - currentLoad;

    // Update battery state
    if (netW > 0) {
      // Charging: efficiency ~92%
      currentBatteryWh = Math.min(
        batteryCapacityWh,
        currentBatteryWh + netW * dtHours * 0.92
      );
    } else {
      // Discharging
      currentBatteryWh = Math.max(0, currentBatteryWh + netW * dtHours);
    }

    const bPercent = (currentBatteryWh / batteryCapacityWh) * 100;

    socProfile.push({
      minute: m,
      inSunlight: inSun,
      batteryPercent: Number(bPercent.toFixed(1)),
      solarPowerWatts: Number(currentGen.toFixed(2)),
      loadWatts: Number(currentLoad.toFixed(2)),
      netPowerWatts: Number(netW.toFixed(2)),
    });
  }

  return {
    solarIrradianceWm2,
    effectiveSolarFluxWm2,
    sunEarthDistAU,
    solarArrayAreaM2: Number(solarArrayAreaM2.toFixed(4)),
    cellEfficiencyPercent: Number(cellEfficiencyPercent.toFixed(1)),
    temperatureLossFactor: Number(temperatureLossFactor.toFixed(3)),
    packingFactor,
    attitudeIncidenceFactor: Number(attitudeIncidenceFactor.toFixed(3)),
    peakGenerationWatts: Number(peakGenerationWatts.toFixed(2)),
    orbitAverageGenerationWatts: Number(orbitAverageGenerationWatts.toFixed(2)),
    energyGeneratedPerOrbitWh: Number(energyGeneratedPerOrbitWh.toFixed(2)),
    subsystems,
    totalOrbitAverageLoadWatts: Number(totalOrbitAverageLoadWatts.toFixed(2)),
    totalEnergyConsumedPerOrbitWh: Number(totalEnergyConsumedPerOrbitWh.toFixed(2)),
    daytimeLoadWatts: Number(daytimeLoadWatts.toFixed(2)),
    eclipseLoadWatts: Number(eclipseLoadWatts.toFixed(2)),
    netPowerDeltaWatts: Number(netPowerDeltaWatts.toFixed(2)),
    netEnergyDeltaPerOrbitWh: Number(netEnergyDeltaPerOrbitWh.toFixed(2)),
    powerMarginPercent: Number(powerMarginPercent.toFixed(1)),
    isNasaCompliantMargin,
    batteryCapacityWh: Number(batteryCapacityWh.toFixed(1)),
    batteryCapacityAh: Number(batteryCapacityAh.toFixed(2)),
    batteryBusVoltageV,
    eclipseEnergyDrainedWh: Number(eclipseEnergyDrainedWh.toFixed(2)),
    depthOfDischargePercent: Number(depthOfDischargePercent.toFixed(1)),
    dodStatus,
    passCommTxPowerWatts,
    passEnergyDrainWh: Number(passEnergyDrainWh.toFixed(2)),
    maxDailyCommTimeMin: Number(maxDailyCommTimeMin.toFixed(0)),
    socProfile,
  };
}

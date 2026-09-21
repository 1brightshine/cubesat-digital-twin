/**
 * Keplerian orbital elements and CubeSat simulation types
 */

export interface KeplerianElements {
  /** Semi-major axis in km (Earth center to ellipse center) */
  a: number;
  /** Eccentricity (0 <= e < 1 for elliptical orbits) */
  e: number;
  /** Inclination in degrees (0 to 180) */
  i: number;
  /** Right Ascension of the Ascending Node (RAAN) in degrees (0 to 360) */
  raan: number;
  /** Argument of Perigee in degrees (0 to 360) */
  argPerigee: number;
  /** True anomaly in degrees (0 to 360) */
  trueAnomaly: number;
  /** Simulation epoch timestamp */
  epochDate: Date;
}

export type CubeSatFormFactor =
  | '0.5U'
  | '1U'
  | '1.5U'
  | '2U'
  | '3U'
  | '6U'
  | '12U'
  | '16U'
  | 'Custom';

export type CubeSatAttitudeMode =
  | 'tumbling'
  | 'ram'
  | 'broadside'
  | 'nadir'
  | 'sun-pointing'
  | 'ram-aerobrake'
  | 'detumbling-bdot';

export interface CubeSatSpec {
  name: string;
  formFactor: CubeSatFormFactor;
  /** Mass in kilograms */
  mass: number;
  /** Effective cross-sectional drag area in m² */
  dragArea: number;
  /** Atmospheric drag coefficient (Cd, usually 2.0 - 2.4, default 2.2) */
  dragCoefficient: number;
  /** Whether a deorbit drag sail or augmentation device is deployed */
  hasDragSail: boolean;
  /** Deployed drag sail area in m² */
  dragSailArea: number;
  /** Reflectivity coefficient for solar radiation pressure (Cr, usually 1.2 - 1.5) */
  reflectivity: number;
  /** Physical body dimensions in centimeters (Length x Width x Height) */
  dimensionsCm?: { length: number; width: number; height: number };
  /** Aerodynamic attitude projection mode */
  attitudeMode?: DynamicAttitudeMode;
  /** Additional external appendage / panel drag area in m² */
  additionalArea?: number;
  /** Whether additional area is included in calculations */
  hasAdditionalArea?: boolean;
  /** Method for computing additional area under Nadir pointing */
  nadirAdditionalMode?: 'direct' | 'in-plane-average' | 'sun-tracking';
  /** Primary body axis pointing towards Earth Nadir (default 'Z') */
  nadirAxis?: 'Z' | 'X' | 'Y';
  /** Whether to use orbit time-averaged area for Nadir pointing (default: true) */
  useNadirTimeAveragedArea?: boolean;
  /** Instantaneous pitch angle in degrees relative to velocity vector for Nadir pointing when time-average is disabled (default: 0) */
  nadirPitchAngleDeg?: number;
  /** Whether 3D exploded view mode is active for structural inspection */
  explodedView?: boolean;
  /** Exploded separation distance multiplier (0 to 1) */
  explodedDistance?: number;
}

export type SolarActivityModel = 'min' | 'mean' | 'max' | 'cycle';
export type NasaAtmosphereModel = 'nasa-das' | 'jacchia-roberts' | 'us-standard-1976';

export interface SolarConditions {
  modelType: SolarActivityModel;
  /** Solar 10.7 cm radio flux in solar flux units (10^-22 W/m²/Hz), e.g. 70=min, 130=moderate, 200=max */
  f107: number;
  /** Geomagnetic activity Ap index (4=quiet, 15=moderate, 45=active) */
  apIndex: number;
  /** NASA Atmospheric Physics Engine Model */
  atmosphereModel?: NasaAtmosphereModel;
}

export interface OrbitDerivedState {
  orbitalPeriodMin: number;
  perigeeAltKm: number;
  apogeeAltKm: number;
  vPerigeeKmS: number;
  vApogeeKmS: number;
  currentAltKm: number;
  currentVelocityKmS: number;
  meanMotionRevsPerDay: number;
  nodalPrecessionDegPerDay: number;
  apsidalPrecessionDegPerDay: number;
  ballisticCoefficientKgM2: number;
  inEclipse: boolean;
  eclipseDurationMin: number;
  sunlitDurationMin: number;
  subSatelliteLatitude: number;
  subSatelliteLongitude: number;
  /** NASA Physics Engine telemetry metrics */
  exosphericTempK?: number;
  thermosphericScaleHeightKm?: number;
  meanMolecularWeightGPerMol?: number;
  sgp4BStar1PerEr?: number;
  solarRadiationPressureAccelMs2?: number;
  instantaneousDragDecelMs2?: number;
  diurnalBulgeRatio?: number;
}

export interface DecayHistoryPoint {
  timeDays: number;
  timeYears: number;
  altitudeKm: number;
  perigeeKm: number;
  apogeeKm: number;
  eccentricity: number;
  densityKgM3: number;
  velocityKmS: number;
  solarFlux: number;
}

export interface SailTradePoint {
  sailArea: number;
  totalArea: number;
  lifetimeYears: number;
  lifetimeDays: number;
  iadcCompliant: boolean;
  fccCompliant: boolean;
}

export interface LifetimeSimulationResult {
  lifetimeDays: number;
  lifetimeYears: number;
  decayRateKmPerDay: number;
  decayRateKmPerYear: number;
  reentryDate: string;
  isCompliantIADC25Yr: boolean; // NASA/IADC 25-year deorbit guideline
  isCompliantFCC5Yr: boolean;   // FCC 5-year deorbit rule (effective 2024)
  history: DecayHistoryPoint[];
  sailTradeStudy: SailTradePoint[];
}

export interface GroundStation {
  id: string;
  name: string;
  lat: number;
  lon: number;
  minElevationDeg: number;
  isInContact?: boolean;
}

export type PropagatorEngine = 'sgp4' | 'keplerian' | 'orekit-numerical';

export type DynamicAttitudeMode =
  | 'nadir'
  | 'sun-pointing'
  | 'ram-aerobrake'
  | 'tumbling'
  | 'detumbling-bdot'
  | 'ram'
  | 'broadside';

export interface LiveSatelliteOrbit {
  noradId: number;
  name: string;
  intlDesig: string;
  category: 'cubesat' | 'station' | 'earth-obs' | 'amateur' | 'scientific';
  description: string;
  tleLine1: string;
  tleLine2: string;
  inclinationDeg: number;
  apogeeKm: number;
  perigeeKm: number;
  periodMin: number;
  launchYear?: number;
  operationalStatus?: string;
  formFactor?: CubeSatFormFactor;
}

export interface SpiceGeometryState {
  sunVectorECI: [number, number, number];
  subSolarLat: number;
  subSolarLon: number;
  earthSunDistKm: number;
  solarPhaseAngleDeg: number;
  betaAngleDeg: number;
  eclipseFraction: number; // 0 = full umbra, 0..1 = penumbra, 1 = direct sunlight
  eclipseState: 'sunlight' | 'penumbra' | 'umbra';
  solarFluxWm2: number;
  solarPowerOutputWatts: number;
  moonVectorECI: [number, number, number];
  earthMoonDistKm: number;
  inEclipse?: boolean;
  sunlightFraction?: number;
}

export interface AttitudeDynamicsState {
  mode: DynamicAttitudeMode;
  tumblingRpm: number;
  omegaRps: [number, number, number]; // angular velocity vector [wx, wy, wz]
  quaternion: [number, number, number, number]; // [w, x, y, z]
  eulerDeg: [number, number, number]; // [roll, pitch, yaw]
  momentsOfInertiaKgM2: [number, number, number]; // [Ixx, Iyy, Izz]
  sunAngleIncidenceDeg: number;
}

export interface OrekitPerturbationMetrics {
  j2AccelMs2: number;
  j3AccelMs2: number;
  j4AccelMs2: number;
  lunarGravityAccelMs2: number;
  solarGravityAccelMs2: number;
  solarRadiationPressureAccelMs2: number;
  totalPerturbationAccelMs2: number;
  nodalPrecessionDegPerDay: number;
  apsidalPrecessionDegPerDay: number;
}

export interface Sgp4PropagationResult {
  positionECI: { x: number; y: number; z: number }; // km
  velocityECI: { x: number; y: number; z: number }; // km/s
  geodetic: { latitude: number; longitude: number; altitudeKm: number };
  speedKmS: number;
  distanceKm: number;
  gmstRad: number;
  inEclipse: boolean;
  timestamp: Date;
}


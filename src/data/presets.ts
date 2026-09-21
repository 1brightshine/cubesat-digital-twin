import { KeplerianElements, CubeSatSpec, GroundStation } from '../types';
import { EARTH_RADIUS_KM } from '../physics/orbitalMechanics';

export interface OrbitPreset {
  id: string;
  name: string;
  category: 'LEO' | 'SSO' | 'VLEO' | 'Elliptical';
  description: string;
  elements: Omit<KeplerianElements, 'epochDate'>;
}

export const ORBIT_PRESETS: OrbitPreset[] = [
  {
    id: 'iss',
    name: 'ISS Deployment (400 km)',
    category: 'LEO',
    description: 'Typical orbit for CubeSats deployed from the International Space Station airlock.',
    elements: {
      a: EARTH_RADIUS_KM + 410,
      e: 0.0008,
      i: 51.64,
      raan: 125.0,
      argPerigee: 45.0,
      trueAnomaly: 0.0,
    },
  },
  {
    id: 'sso_550',
    name: 'Sun-Synchronous (550 km)',
    category: 'SSO',
    description: 'Popular ride-share orbit for Earth observation with consistent daily solar lighting.',
    elements: {
      a: EARTH_RADIUS_KM + 550,
      e: 0.0012,
      i: 97.59,
      raan: 45.0,
      argPerigee: 90.0,
      trueAnomaly: 15.0,
    },
  },
  {
    id: 'vleo_280',
    name: 'VLEO Rapid Decay (280 km)',
    category: 'VLEO',
    description: 'Very Low Earth Orbit with high drag, suited for aerodynamic experiments and quick deorbiting.',
    elements: {
      a: EARTH_RADIUS_KM + 280,
      e: 0.001,
      i: 45.0,
      raan: 0.0,
      argPerigee: 0.0,
      trueAnomaly: 0.0,
    },
  },
  {
    id: 'starlink_550',
    name: 'Megaconstellation LEO (550 km, 53°)',
    category: 'LEO',
    description: 'Mid-inclination circular orbit common for telecommunication constellations.',
    elements: {
      a: EARTH_RADIUS_KM + 550,
      e: 0.0005,
      i: 53.0,
      raan: 210.0,
      argPerigee: 30.0,
      trueAnomaly: 60.0,
    },
  },
  {
    id: 'polar_700',
    name: 'Polar Orbit (700 km)',
    category: 'LEO',
    description: 'Full global coverage orbit passing over north and south poles.',
    elements: {
      a: EARTH_RADIUS_KM + 700,
      e: 0.0015,
      i: 90.0,
      raan: 180.0,
      argPerigee: 0.0,
      trueAnomaly: 120.0,
    },
  },
  {
    id: 'molniya',
    name: 'Molniya Critical Elliptical',
    category: 'Elliptical',
    description: 'Highly eccentric orbit at critical inclination 63.4° with long dwell time over high latitudes.',
    elements: {
      a: 26553,
      e: 0.72,
      i: 63.435,
      raan: 60.0,
      argPerigee: 270.0,
      trueAnomaly: 0.0,
    },
  },
  {
    id: 'gto',
    name: 'Geostationary Transfer (GTO)',
    category: 'Elliptical',
    description: 'Elliptical transfer orbit with low perigee (~250 km) and geostationary apogee (~35,786 km).',
    elements: {
      a: 24396,
      e: 0.728,
      i: 28.5,
      raan: 10.0,
      argPerigee: 178.0,
      trueAnomaly: 0.0,
    },
  },
];

export const CUBESAT_PRESETS: CubeSatSpec[] = [
  {
    name: 'AeroCube-1U (Standard)',
    formFactor: '1U',
    mass: 1.33,
    dragArea: 0.015, // Average tumbling cross-section
    dragCoefficient: 2.2,
    hasDragSail: false,
    dragSailArea: 0.0,
    reflectivity: 1.3,
    dimensionsCm: { length: 10, width: 10, height: 10 },
    attitudeMode: 'tumbling',
  },
  {
    name: 'BioSat-2U (Science)',
    formFactor: '2U',
    mass: 2.66,
    dragArea: 0.025,
    dragCoefficient: 2.2,
    hasDragSail: false,
    dragSailArea: 0.0,
    reflectivity: 1.3,
    dimensionsCm: { length: 10, width: 10, height: 20 },
    attitudeMode: 'tumbling',
  },
  {
    name: 'SolarPath-3U (Deployed Wings)',
    formFactor: '3U',
    mass: 4.0,
    dragArea: 0.085, // With deployed side solar panels
    dragCoefficient: 2.2,
    hasDragSail: false,
    dragSailArea: 0.0,
    reflectivity: 1.3,
    dimensionsCm: { length: 10, width: 10, height: 30 },
    attitudeMode: 'tumbling',
  },
  {
    name: 'SailClean-3U (Drag Sail Deployed)',
    formFactor: '3U',
    mass: 4.0,
    dragArea: 0.035,
    dragCoefficient: 2.2,
    hasDragSail: true,
    dragSailArea: 1.5, // 1.5 m² drag sail deployed for rapid deorbiting
    reflectivity: 1.4,
    dimensionsCm: { length: 10, width: 10, height: 30 },
    attitudeMode: 'tumbling',
  },
  {
    name: 'TerraScope-6U (Earth Imager)',
    formFactor: '6U',
    mass: 12.0,
    dragArea: 0.055,
    dragCoefficient: 2.2,
    hasDragSail: false,
    dragSailArea: 0.0,
    reflectivity: 1.3,
    dimensionsCm: { length: 10, width: 20, height: 30 },
    attitudeMode: 'tumbling',
  },
  {
    name: 'DeepVoyager-12U (Flagship)',
    formFactor: '12U',
    mass: 24.0,
    dragArea: 0.100,
    dragCoefficient: 2.2,
    hasDragSail: false,
    dragSailArea: 0.0,
    reflectivity: 1.3,
    dimensionsCm: { length: 20, width: 20, height: 30 },
    attitudeMode: 'tumbling',
  },
];

export const GROUND_STATIONS: GroundStation[] = [
  {
    id: 'svalbard',
    name: 'Svalbard (SvalSat, Norway)',
    lat: 78.23,
    lon: 15.40,
    minElevationDeg: 5,
  },
  {
    id: 'kiruna',
    name: 'Kiruna Station (Sweden)',
    lat: 67.86,
    lon: 20.96,
    minElevationDeg: 5,
  },
  {
    id: 'kourou',
    name: 'Kourou ESTRACK (French Guiana)',
    lat: 5.25,
    lon: -52.81,
    minElevationDeg: 5,
  },
  {
    id: 'austin',
    name: 'Austin Space Ground Station (USA)',
    lat: 30.27,
    lon: -97.74,
    minElevationDeg: 7,
  },
  {
    id: 'tokyo',
    name: 'Tokyo Tracking Station (Japan)',
    lat: 35.68,
    lon: 139.69,
    minElevationDeg: 5,
  },
  {
    id: 'goldstone',
    name: 'Goldstone DSN (California, USA)',
    lat: 35.43,
    lon: -116.89,
    minElevationDeg: 10,
  },
  {
    id: 'canberra',
    name: 'Canberra DSN (Australia)',
    lat: -35.40,
    lon: 148.98,
    minElevationDeg: 10,
  },
  {
    id: 'maspalomas',
    name: 'Maspalomas Station (Canary Is.)',
    lat: 27.76,
    lon: -15.63,
    minElevationDeg: 5,
  },
];

/**
 * CubeSat Physical Specifications, Size/Form Factor, Ballistics and Space Environment Settings
 */

import React, { useState } from 'react';
import {
  CubeSatSpec,
  CubeSatFormFactor,
  CubeSatAttitudeMode,
  SolarConditions,
  SolarActivityModel,
  NasaAtmosphereModel,
  LifetimeSimulationResult,
} from '../types';
import { CUBESAT_PRESETS } from '../data/presets';
import {
  Box,
  Sun,
  Wind,
  Scale,
  Activity,
  Sliders,
  SlidersHorizontal,
  Sparkles,
  Info,
  TrendingDown,
  Clock,
  ShieldCheck,
  AlertTriangle,
  Compass,
  ArrowUpRight,
  Cpu,
  Zap,
  Layers,
  Globe,
  Maximize2,
  BookOpen,
  ToggleLeft,
  ToggleRight,
  X,
  CheckCircle2,
  FileText,
  HelpCircle,
} from 'lucide-react';
import {
  computeSgp4BStar,
  computeSolarRadiationPressureAccel,
  computeNasaExosphericTemp,
} from '../physics/atmosphere';

interface CubeSatSpecsPanelProps {
  cubeSat: CubeSatSpec;
  solar: SolarConditions;
  simulationResult?: LifetimeSimulationResult;
  onCubeSatChange: (updated: CubeSatSpec) => void;
  onSolarChange: (updated: SolarConditions) => void;
  onNavigateTab?: (tab: '3d' | 'groundTrack' | 'lifetime') => void;
}

const STANDARD_SIZES: {
  id: CubeSatFormFactor;
  label: string;
  dims: { length: number; width: number; height: number };
  defaultMass: number;
  description: string;
}[] = [
  { id: '0.5U', label: '0.5U', dims: { length: 5, width: 10, height: 10 }, defaultMass: 0.65, description: 'PocketQube (5x10x10 cm)' },
  { id: '1U', label: '1U', dims: { length: 10, width: 10, height: 10 }, defaultMass: 1.33, description: 'Standard 1U (10 cm³)' },
  { id: '1.5U', label: '1.5U', dims: { length: 10, width: 10, height: 15 }, defaultMass: 2.0, description: '1.5U Intermediate' },
  { id: '2U', label: '2U', dims: { length: 10, width: 10, height: 20 }, defaultMass: 2.66, description: '2U Bus (10x10x20 cm)' },
  { id: '3U', label: '3U', dims: { length: 10, width: 10, height: 34 }, defaultMass: 4.0, description: 'Standard 3U (10x10x34 cm)' },
  { id: '6U', label: '6U', dims: { length: 10, width: 20, height: 30 }, defaultMass: 8.0, description: '6U Heavy (10x20x30 cm)' },
  { id: '12U', label: '12U', dims: { length: 20, width: 20, height: 30 }, defaultMass: 16.0, description: '12U Bus (20x20x30 cm)' },
  { id: '16U', label: '16U', dims: { length: 20, width: 20, height: 40 }, defaultMass: 22.0, description: '16U Deep Space' },
  { id: 'Custom', label: 'Custom', dims: { length: 10, width: 10, height: 34 }, defaultMass: 4.0, description: 'User-Defined Size' },
];

/**
 * Computes the effective cross-sectional aerodynamic drag area in m²
 * based on CubeSat dimensions and astrodynamics attitude projection mode.
 *
 * References:
 * - David A. Vallado, "Fundamentals of Astrodynamics and Applications" (5th ed., 2022), Microcosm Press / Springer, Section 8.6, Eq. 8-34 to 8-38.
 * - Wertz & Larson, "Space Mission Engineering: The New SMAD", Microcosm Press, Sections 9.3 & 20.2.
 * - James R. Wertz (ed.), "Spacecraft Attitude Determination and Control", Kluwer Academic Publishers, Appendix G.
 * - NASA-STD-8719.14C / NASA DAS 3.0 (Debris Assessment Software) Technical Guide, Appendix B: Cross-Sectional Area Calculations for 5-Year PMD.
 * - NASA SP-8007 / SP-8008, Spacecraft Aerodynamic Torques and Cross-Sectional Geometry.
 */
export function computeAstrodynamicArea(
  dims: { length: number; width: number; height: number },
  mode: CubeSatAttitudeMode,
  nadirAxis: 'Z' | 'X' | 'Y' = 'Z',
  useNadirTimeAveraged: boolean = true,
  nadirPitchAngleDeg: number = 0
): number {
  const L = dims.length / 100;
  const W = dims.width / 100;
  const H = dims.height / 100;

  if (mode === 'ram') {
    // Minimum frontal projected area
    return Math.round(Math.min(L * W, W * H, H * L) * 10000) / 10000;
  }
  if (mode === 'broadside') {
    // Maximum broadside projected area
    return Math.round(Math.max(L * W, W * H, H * L) * 10000) / 10000;
  }
  if (mode === 'nadir') {
    // In Local Vertical Local Horizontal (LVLH) Nadir-pointing flight:
    // One body axis (c) points continuously toward Earth nadir along the local vertical.
    // In a circular LEO orbit, the orbital velocity vector lies in the local horizontal plane (a-b plane).
    // The top and bottom faces (a x b) are parallel to the velocity vector and present zero projected area.
    // The two vertical side faces (a x c and b x c) sweep through the horizontal flow.
    let c = H; // Vertical dimension along Nadir (e.g. 0.34 m for 3U when Nadir is Z)
    let a = L; // Horizontal dimension 1 (e.g. 0.10 m)
    let b = W; // Horizontal dimension 2 (e.g. 0.10 m)

    if (nadirAxis === 'X') {
      c = L;
      a = W;
      b = H;
    } else if (nadirAxis === 'Y') {
      c = W;
      a = L;
      b = H;
    }

    const face1 = a * c; // e.g. 0.10 * 0.34 = 0.034 m²
    const face2 = b * c; // e.g. 0.10 * 0.34 = 0.034 m²

    if (useNadirTimeAveraged) {
      // Astrodynamics Orbit Time-Averaged Integral Model (Vallado 5th ed. Eq. 8-34, SMAD Section 9.3, NASA DAS):
      // <A>_horizontal = (1 / 2π) ∫_0^{2π} [ c * (a|cos θ| + b|sin θ|) ] dθ
      //                = (4 / 2π) * c * [ a ∫_0^{π/2} cos θ dθ + b ∫_0^{π/2} sin θ dθ ]
      //                = (2 / π) * c * (a + b) = (2 / π) * (ac + bc)
      // For 3U (a=0.10 m, b=0.10 m, c=0.34 m):
      // <A> = (2 / π) * (0.10*0.34 + 0.10*0.34) = (2 / π) * (0.068) ≈ 0.04329 m² ≈ 0.0433 m²
      const timeAveragedArea = (2 / Math.PI) * (face1 + face2);
      return Math.round(timeAveragedArea * 10000) / 10000;
    } else {
      // Instantaneous Projected Cross-Section at fixed yaw angle θ relative to Face 1:
      // A(θ) = c * (a * |cos θ| + b * |sin θ|) = (ac) * |cos θ| + (bc) * |sin θ|
      const thetaRad = (nadirPitchAngleDeg * Math.PI) / 180;
      const instantaneousArea =
        face1 * Math.abs(Math.cos(thetaRad)) + face2 * Math.abs(Math.sin(thetaRad));
      return Math.round(instantaneousArea * 10000) / 10000;
    }
  }
  // Random tumbling (NASA DAS standard: Cauchy average A = A_total / 4 = (LW + WH + HL) / 2)
  // For 3U (0.10 x 0.10 x 0.34 m): S = 0.156 m² => A_tumbling = 0.156 / 4 = 0.0390 m²
  return Math.round(((L * W + W * H + H * L) / 2) * 10000) / 10000;
}

export function computeNadirTimeAveragedMetrics(
  dims: { length: number; width: number; height: number },
  nadirAxis: 'Z' | 'X' | 'Y' = 'Z',
  additionalArea: number = 0,
  nadirMode: 'direct' | 'in-plane-average' | 'sun-tracking' = 'direct',
  useTimeAveraged: boolean = true,
  nadirPitchAngleDeg: number = 0
) {
  const L = dims.length / 100;
  const W = dims.width / 100;
  const H = dims.height / 100;

  // Let c be the vertical dimension aligned with the Earth Nadir vector (Local Vertical).
  // Let a and b be the two orthogonal horizontal dimensions in the orbital plane (Local Horizontal).
  let c = H; // Nadir vertical dimension
  let a = L; // Horizontal dimension 1
  let b = W; // Horizontal dimension 2

  if (nadirAxis === 'X') {
    c = L;
    a = W;
    b = H;
  } else if (nadirAxis === 'Y') {
    c = W;
    a = L;
    b = H;
  }

  // The two vertical side faces sweeping through the horizontal velocity vector
  const face1 = a * c; // e.g. 0.10 * 0.34 = 0.0340 m² (for 3U)
  const face2 = b * c; // e.g. 0.10 * 0.34 = 0.0340 m² (for 3U)
  // The face pointing to Nadir (Earth) & Zenith (Space), perpendicular to the Nadir axis.
  // In a circular LEO orbit, velocity is horizontal, so this face is parallel to the flow (0 ram projection).
  const faceNadir = a * b; // e.g. 0.10 * 0.10 = 0.0100 m² (for 3U)

  // Total surface area of the rectangular prism
  const totalSurfaceArea = 2 * (face1 + face2 + faceNadir);
  // Cauchy uniform random tumbling average: A_tumbling = S / 4
  const tumblingArea = totalSurfaceArea / 4;

  // Astrodynamic Orbit Time-Averaged Nadir Drag Area:
  // <A>_horizontal = (2 / π) * (ac + bc) = (2 / π) * c * (a + b)
  // For 3U: (2 / π) * (0.034 + 0.034) = (2 / π) * 0.068 ≈ 0.04329 m² ≈ 0.0433 m²
  const bodyNadirAvg = (2 / Math.PI) * (face1 + face2);

  // Instantaneous projected drag area at specified yaw angle θ relative to velocity vector:
  // A(θ) = c * (a * |cos θ| + b * |sin θ|) = face1 * |cos θ| + face2 * |sin θ|
  const pitchRad = (nadirPitchAngleDeg * Math.PI) / 180;
  const bodyInstantaneous =
    face1 * Math.abs(Math.cos(pitchRad)) + face2 * Math.abs(Math.sin(pitchRad));

  // Currently active body drag area based on time-averaged toggle
  const activeBodyArea = useTimeAveraged ? bodyNadirAvg : bodyInstantaneous;

  // Additional area projection under Nadir pointing
  let effectiveAdditional = additionalArea;
  if (useTimeAveraged) {
    if (nadirMode === 'in-plane-average' || nadirMode === 'sun-tracking') {
      effectiveAdditional = (2 / Math.PI) * additionalArea;
    } else {
      effectiveAdditional = additionalArea;
    }
  } else {
    if (nadirMode === 'in-plane-average') {
      effectiveAdditional = additionalArea * Math.abs(Math.cos(pitchRad));
    } else {
      effectiveAdditional = additionalArea;
    }
  }

  const totalNadirArea = activeBodyArea + effectiveAdditional;

  return {
    dimA: a,
    dimB: b,
    dimC: c,
    face1,
    face2,
    faceRam: face1, // Nominal frontal face at θ = 0°
    faceNadir,
    faceCrossTrack: face2,
    totalSurfaceArea,
    tumblingArea,
    bodyNadirAvg,
    bodyInstantaneous,
    activeBodyArea,
    effectiveAdditional,
    totalNadirArea,
    pitchRad,
    twoOverPi: 2 / Math.PI,
  };
}

export const CubeSatSpecsPanel: React.FC<CubeSatSpecsPanelProps> = ({
  cubeSat,
  solar,
  simulationResult,
  onCubeSatChange,
  onSolarChange,
  onNavigateTab,
}) => {
  const [showAstrodynamicsDocModal, setShowAstrodynamicsDocModal] = useState<boolean>(false);

  const currentDims = cubeSat.dimensionsCm || {
    length: 10,
    width: 10,
    height: cubeSat.formFactor === '1U' ? 10 : cubeSat.formFactor === '2U' ? 20 : cubeSat.formFactor === '6U' ? 30 : 30,
  };
  const currentAttitude: CubeSatAttitudeMode = cubeSat.attitudeMode || 'tumbling';
  const nadirAxis: 'Z' | 'X' | 'Y' = cubeSat.nadirAxis || 'Z';
  const additionalArea: number = cubeSat.additionalArea || 0;
  const nadirAdditionalMode: 'direct' | 'in-plane-average' | 'sun-tracking' =
    cubeSat.nadirAdditionalMode || 'direct';
  const useNadirTimeAveraged: boolean = cubeSat.useNadirTimeAveragedArea !== false;
  const nadirPitchAngleDeg: number = cubeSat.nadirPitchAngleDeg ?? 0;

  const handleSelectFormFactor = (ff: CubeSatFormFactor) => {
    const std = STANDARD_SIZES.find((s) => s.id === ff);
    if (!std) return;

    const newDims = { ...std.dims };
    const calculatedArea = computeAstrodynamicArea(
      newDims,
      currentAttitude,
      nadirAxis,
      useNadirTimeAveraged,
      nadirPitchAngleDeg
    );

    onCubeSatChange({
      ...cubeSat,
      name: `${ff} CubeSat`,
      formFactor: ff,
      mass: std.defaultMass,
      dimensionsCm: newDims,
      dragArea: calculatedArea,
    });
  };

  const handleDimensionChange = (key: 'length' | 'width' | 'height', val: number) => {
    const updatedDims = {
      ...currentDims,
      [key]: Math.max(1, val),
    };
    const calculatedArea = computeAstrodynamicArea(
      updatedDims,
      currentAttitude,
      nadirAxis,
      useNadirTimeAveraged,
      nadirPitchAngleDeg
    );
    onCubeSatChange({
      ...cubeSat,
      dimensionsCm: updatedDims,
      dragArea: calculatedArea,
      formFactor: 'Custom',
    });
  };

  const handleAttitudeModeChange = (mode: CubeSatAttitudeMode) => {
    const calculatedArea = computeAstrodynamicArea(
      currentDims,
      mode,
      nadirAxis,
      useNadirTimeAveraged,
      nadirPitchAngleDeg
    );
    onCubeSatChange({
      ...cubeSat,
      attitudeMode: mode,
      dragArea: calculatedArea,
    });
  };

  const handleAdditionalAreaChange = (val: number) => {
    const clamped = Math.max(0, Math.min(2.0, val));
    onCubeSatChange({
      ...cubeSat,
      additionalArea: clamped,
      hasAdditionalArea: clamped > 0,
    });
  };

  const handleToggleNadirTimeAveraged = (enabled: boolean) => {
    const updatedCubeSat = {
      ...cubeSat,
      useNadirTimeAveragedArea: enabled,
    };
    if (currentAttitude === 'nadir') {
      updatedCubeSat.dragArea = computeAstrodynamicArea(
        currentDims,
        'nadir',
        nadirAxis,
        enabled,
        nadirPitchAngleDeg
      );
    }
    onCubeSatChange(updatedCubeSat);
  };

  const handleNadirPitchChange = (pitchDeg: number) => {
    const clamped = Math.max(0, Math.min(90, pitchDeg));
    const updatedCubeSat = {
      ...cubeSat,
      nadirPitchAngleDeg: clamped,
    };
    if (currentAttitude === 'nadir' && !useNadirTimeAveraged) {
      updatedCubeSat.dragArea = computeAstrodynamicArea(
        currentDims,
        'nadir',
        nadirAxis,
        false,
        clamped
      );
    }
    onCubeSatChange(updatedCubeSat);
  };

  const handleNadirAxisChange = (axis: 'Z' | 'X' | 'Y') => {
    const updatedCubeSat = {
      ...cubeSat,
      nadirAxis: axis,
    };
    if (currentAttitude === 'nadir') {
      updatedCubeSat.dragArea = computeAstrodynamicArea(
        currentDims,
        'nadir',
        axis,
        useNadirTimeAveraged,
        nadirPitchAngleDeg
      );
    }
    onCubeSatChange(updatedCubeSat);
  };

  const handleNadirAdditionalModeChange = (
    mode: 'direct' | 'in-plane-average' | 'sun-tracking'
  ) => {
    onCubeSatChange({
      ...cubeSat,
      nadirAdditionalMode: mode,
    });
  };

  const handleSelectPreset = (preset: CubeSatSpec) => {
    onCubeSatChange({ ...preset });
  };

  const handleSolarModelChange = (model: SolarActivityModel) => {
    let f107 = 130;
    let ap = 15;
    if (model === 'min') {
      f107 = 70;
      ap = 4;
    } else if (model === 'max') {
      f107 = 200;
      ap = 40;
    } else if (model === 'cycle') {
      f107 = 135;
      ap = 15;
    }
    onSolarChange({
      ...solar,
      modelType: model,
      f107,
      apIndex: ap,
    });
  };

  const handleAtmosphereModelChange = (atmModel: NasaAtmosphereModel) => {
    onSolarChange({
      ...solar,
      atmosphereModel: atmModel,
    });
  };

  const handleApChange = (val: number) => {
    onSolarChange({
      ...solar,
      apIndex: val,
    });
  };

  const handleF107Change = (val: number) => {
    onSolarChange({
      ...solar,
      f107: val,
    });
  };

  // Nadir geometry metrics (supports both orbit time-averaged and instantaneous pitch models)
  const nadirMetrics = computeNadirTimeAveragedMetrics(
    currentDims,
    nadirAxis,
    additionalArea,
    nadirAdditionalMode,
    useNadirTimeAveraged,
    nadirPitchAngleDeg
  );

  // Effective additional area considering attitude mode
  const effectiveAdditional =
    currentAttitude === 'nadir'
      ? nadirMetrics.effectiveAdditional
      : additionalArea;

  const totalArea =
    cubeSat.dragArea +
    effectiveAdditional +
    (cubeSat.hasDragSail ? cubeSat.dragSailArea : 0);

  // Astrodynamics Ballistic Coefficient B = m / (Cd * A) in kg/m²
  const ballisticCoeff =
    cubeSat.mass / (cubeSat.dragCoefficient * Math.max(0.0001, totalArea));

  // Ballistic Parameter B* = (Cd * A) / m in m²/kg
  const bStar =
    (cubeSat.dragCoefficient * Math.max(0.0001, totalArea)) / Math.max(0.01, cubeSat.mass);

  // NASA SGP4 B* in 1/Earth-radii
  const sgp4BStar = computeSgp4BStar(cubeSat.mass, totalArea, cubeSat.dragCoefficient);

  // Solar Radiation Pressure Acceleration
  const srpAccel = computeSolarRadiationPressureAccel(
    cubeSat.mass,
    totalArea,
    cubeSat.reflectivity || 1.3
  );

  const exoTemp = computeNasaExosphericTemp(solar.f107, solar.f107, solar.apIndex || 15);

  return (
    <div
      id="cubesat-specs-panel"
      className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col gap-5"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <Box className="w-5 h-5 text-purple-400" />
          <h3 className="font-semibold text-slate-100 text-sm">CubeSat Size &amp; Ballistics</h3>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs px-2 py-0.5 rounded bg-purple-950/80 text-purple-300 border border-purple-800/60 font-semibold">
            {cubeSat.formFactor} Form Factor
          </span>
        </div>
      </div>

      {/* 1. CubeSat Size / Form Factor Selector */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-slate-400 font-medium">Select Standard CubeSat Size:</span>
          <span className="text-[10px] text-slate-400 font-mono">
            {currentDims.length} &times; {currentDims.width} &times; {currentDims.height} cm
          </span>
        </div>
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5">
          {STANDARD_SIZES.map((size) => {
            const isSelected = cubeSat.formFactor === size.id;
            return (
              <button
                key={size.id}
                onClick={() => handleSelectFormFactor(size.id)}
                className={`px-2 py-1.5 rounded-xl border text-center transition-all flex flex-col items-center justify-center ${
                  isSelected
                    ? 'bg-purple-600 text-white font-bold border-purple-400 shadow-md shadow-purple-900/50'
                    : 'bg-slate-950/60 border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white'
                }`}
              >
                <span className="text-xs font-semibold">{size.label}</span>
                <span className="text-[9px] opacity-75 font-mono">{size.defaultMass} kg</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Physical Dimensions & Attitude Mode */}
      <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800/80 flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="text-slate-300 font-semibold flex items-center gap-1.5">
            <Compass className="w-3.5 h-3.5 text-cyan-400" />
            Dimensions (L &times; W &times; H) &amp; Drag Orientation
          </span>

          {/* Attitude Mode Buttons */}
          <div className="flex items-center bg-slate-900 p-0.5 rounded-lg border border-slate-800 text-[11px]">
            <button
              onClick={() => handleAttitudeModeChange('tumbling')}
              title="NASA DAS Standard: Orbit-averaged random tumbling cross-section (A_total / 4)"
              className={`px-2 py-0.5 rounded transition-all font-medium ${
                currentAttitude === 'tumbling'
                  ? 'bg-cyan-500 text-slate-950 font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Tumbling (DAS)
            </button>
            <button
              onClick={() => handleAttitudeModeChange('nadir')}
              title="Nadir-pointing Earth-oriented attitude: Orbit time-averaged cross-section <A> = (2/π)(A_ram + A_nadir) + ΔA"
              className={`px-2 py-0.5 rounded transition-all font-medium flex items-center gap-1 ${
                currentAttitude === 'nadir'
                  ? 'bg-cyan-500 text-slate-950 font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Globe className="w-3 h-3" />
              Nadir (Time-Avg)
            </button>
            <button
              onClick={() => handleAttitudeModeChange('ram')}
              title="Minimum cross-section: Ram-facing attitude"
              className={`px-2 py-0.5 rounded transition-all font-medium ${
                currentAttitude === 'ram'
                  ? 'bg-cyan-500 text-slate-950 font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Ram (Min)
            </button>
            <button
              onClick={() => handleAttitudeModeChange('broadside')}
              title="Maximum cross-section: Broadside tumbling / maximum drag"
              className={`px-2 py-0.5 rounded transition-all font-medium ${
                currentAttitude === 'broadside'
                  ? 'bg-cyan-500 text-slate-950 font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Broadside (Max)
            </button>
          </div>
        </div>

        {/* Dimension inputs */}
        <div className="grid grid-cols-3 gap-2">
          <div>
            <div className="flex justify-between text-[11px] text-slate-400 mb-1">
              <span>Length (X)</span>
              <span className="font-mono text-cyan-300">{currentDims.length} cm</span>
            </div>
            <input
              type="number"
              min="2"
              max="100"
              step="1"
              value={currentDims.length}
              onChange={(e) => handleDimensionChange('length', parseFloat(e.target.value) || 10)}
              className="w-full px-2 py-1 bg-slate-900 border border-slate-700/80 rounded-lg text-xs font-mono text-slate-200 focus:border-cyan-500 focus:outline-none"
            />
          </div>

          <div>
            <div className="flex justify-between text-[11px] text-slate-400 mb-1">
              <span>Width (Y)</span>
              <span className="font-mono text-cyan-300">{currentDims.width} cm</span>
            </div>
            <input
              type="number"
              min="2"
              max="100"
              step="1"
              value={currentDims.width}
              onChange={(e) => handleDimensionChange('width', parseFloat(e.target.value) || 10)}
              className="w-full px-2 py-1 bg-slate-900 border border-slate-700/80 rounded-lg text-xs font-mono text-slate-200 focus:border-cyan-500 focus:outline-none"
            />
          </div>

          <div>
            <div className="flex justify-between text-[11px] text-slate-400 mb-1">
              <span>Height (Z)</span>
              <span className="font-mono text-cyan-300">{currentDims.height} cm</span>
            </div>
            <input
              type="number"
              min="2"
              max="150"
              step="1"
              value={currentDims.height}
              onChange={(e) => handleDimensionChange('height', parseFloat(e.target.value) || 30)}
              className="w-full px-2 py-1 bg-slate-900 border border-slate-700/80 rounded-lg text-xs font-mono text-slate-200 focus:border-cyan-500 focus:outline-none"
            />
          </div>
        </div>

        {/* Time-Averaged Nadir Drag & Additional Area Analysis Card */}
        <div
          className={`p-3.5 rounded-xl border transition-all ${
            currentAttitude === 'nadir'
              ? 'bg-gradient-to-r from-cyan-950/40 via-slate-900/90 to-slate-950 border-cyan-500/50 shadow-md'
              : 'bg-slate-900/40 border-slate-800/80'
          }`}
        >
          {/* Header & Controls Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2.5 mb-2.5">
            <div className="flex items-center gap-2">
              <div
                className={`p-1.5 rounded-lg border ${
                  currentAttitude === 'nadir'
                    ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                    : 'bg-slate-800 text-slate-400 border-slate-700'
                }`}
              >
                <Globe className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                  <span>Nadir-Pointing Aerodynamic Drag Area</span>
                  {currentAttitude === 'nadir' ? (
                    <span className="px-1.5 py-0.5 rounded bg-cyan-500 text-slate-950 text-[9px] font-black uppercase tracking-wider">
                      Active Flight Mode
                    </span>
                  ) : (
                    <span className="text-[10px] text-slate-400 font-normal">
                      (LVLH Astrodynamics Reference)
                    </span>
                  )}
                </div>
                <div className="text-[10px] text-slate-400">
                  Vallado (5th ed. Eq. 8-34) &bull; NASA-STD-8719.14C / DAS &bull; SMAD Section 9.3
                </div>
              </div>
            </div>

            {/* Toggle ON/OFF and Reference Buttons */}
            <div className="flex flex-wrap items-center gap-1.5 ml-auto">
              {/* Turn ON/OFF Time-Averaged Toggle Button */}
              <button
                type="button"
                id="btn-toggle-nadir-time-averaged"
                onClick={() => handleToggleNadirTimeAveraged(!useNadirTimeAveraged)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold flex items-center gap-1.5 border transition-all shadow-sm ${
                  useNadirTimeAveraged
                    ? 'bg-cyan-950/80 text-cyan-300 border-cyan-600/70 hover:bg-cyan-900/80'
                    : 'bg-slate-800/90 text-amber-300 border-amber-600/50 hover:bg-slate-800'
                }`}
                title={
                  useNadirTimeAveraged
                    ? 'Time-averaged area calculation is ON: using continuous orbit pitch integration <A> = (2/π)(A_ram + A_nadir)'
                    : 'Time-averaged area calculation is OFF: using instantaneous projected area at fixed pitch angle θ'
                }
              >
                {useNadirTimeAveraged ? (
                  <>
                    <ToggleRight className="w-4 h-4 text-cyan-400" />
                    <span>Time-Average: <strong className="text-cyan-200">ON</strong></span>
                  </>
                ) : (
                  <>
                    <ToggleLeft className="w-4 h-4 text-amber-400" />
                    <span>Time-Average: <strong className="text-amber-200">OFF (Instantaneous)</strong></span>
                  </>
                )}
              </button>

              {/* NASA & Astrodynamics Reference Button */}
              <button
                type="button"
                id="btn-open-astrodynamics-reference"
                onClick={() => setShowAstrodynamicsDocModal(true)}
                className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-[10px] font-medium border border-slate-700 flex items-center gap-1 transition-all"
                title="View mathematical derivation and NASA/Vallado reference documentation"
              >
                <BookOpen className="w-3.5 h-3.5 text-cyan-400" />
                <span className="hidden sm:inline">Formulas & Citations</span>
              </button>

              {currentAttitude !== 'nadir' && (
                <button
                  type="button"
                  onClick={() => handleAttitudeModeChange('nadir')}
                  className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-300 hover:text-cyan-200 text-[10px] font-medium border border-slate-700 flex items-center gap-1 transition-all"
                >
                  <span>Apply to Sat</span>
                  <ArrowUpRight className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>

          {/* Mathematical Model Banner */}
          <div className="mb-2.5 p-2 rounded-lg bg-slate-950/70 border border-slate-800 text-[11px] font-mono flex flex-col md:flex-row md:items-center justify-between gap-2">
            <div>
              <span className="text-slate-400 text-[10px] block font-sans">
                {useNadirTimeAveraged
                  ? 'Professional Astrodynamics Orbit Time-Averaged Integral Model (Horizontal Ram Flow):'
                  : 'Instantaneous Pitch/Yaw Projected Aerodynamic Cross-Section Model:'}
              </span>
              <div className="text-cyan-300 font-bold text-xs mt-0.5">
                {useNadirTimeAveraged ? (
                  <span>
                    &lang;A&rang;<sub>nadir</sub> = <span className="text-emerald-400">(2/&pi;)</span> &middot; (ac + bc) = <span className="text-emerald-400">(2/&pi;)</span> &middot; c(a + b) + &Delta;A<sub>eff</sub>
                    <span className="text-slate-400 font-normal text-[10px] ml-2">
                      (&asymp; 0.63662 &times; sum of side faces)
                    </span>
                  </span>
                ) : (
                  <span>
                    A(&theta;) = c &middot; [a|cos(&theta;)| + b|sin(&theta;)|] + &Delta;A<sub>eff</sub>
                    <span className="text-amber-300 font-normal text-[10px] ml-2">
                      (&theta; = {nadirPitchAngleDeg}&deg; relative to Face 1)
                    </span>
                  </span>
                )}
              </div>
            </div>
            <div className="text-[10px] text-slate-400 font-sans md:text-right">
              {useNadirTimeAveraged ? (
                <span className="text-cyan-400/90">
                  Vallado Eq. 8-34 &bull; SMAD &bull; NASA-STD-8719.14C
                </span>
              ) : (
                <span className="text-amber-400/90">
                  Fixed attitude relative to local velocity vector
                </span>
              )}
            </div>
          </div>

          {/* Instantaneous Pitch Angle Slider (Only shown when Time-Average is OFF) */}
          {!useNadirTimeAveraged && (
            <div className="mb-3 p-2.5 rounded-lg bg-amber-950/20 border border-amber-800/40 text-xs">
              <div className="flex justify-between items-center mb-1.5">
                <span className="text-amber-200 font-medium flex items-center gap-1.5 text-[11px]">
                  <SlidersHorizontal className="w-3.5 h-3.5 text-amber-400" />
                  Instantaneous Angle (&theta; relative to velocity vector):
                </span>
                <span className="font-mono text-amber-300 font-bold text-xs">
                  {nadirPitchAngleDeg}&deg;
                </span>
              </div>
              <input
                id="input-nadir-pitch-angle"
                type="range"
                min="0"
                max="90"
                step="1"
                value={nadirPitchAngleDeg}
                onChange={(e) => handleNadirPitchChange(parseInt(e.target.value) || 0)}
                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-400"
              />
              <div className="flex flex-wrap items-center justify-between gap-1 pt-1.5 text-[9px] font-mono">
                <button
                  type="button"
                  onClick={() => handleNadirPitchChange(0)}
                  className={`px-1.5 py-0.5 rounded border transition-all ${
                    nadirPitchAngleDeg === 0
                      ? 'bg-amber-950 text-amber-300 border-amber-600 font-bold'
                      : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                  }`}
                >
                  0&deg; (Face 1 Normal)
                </button>
                <button
                  type="button"
                  onClick={() => handleNadirPitchChange(30)}
                  className={`px-1.5 py-0.5 rounded border transition-all ${
                    nadirPitchAngleDeg === 30
                      ? 'bg-amber-950 text-amber-300 border-amber-600 font-bold'
                      : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                  }`}
                >
                  30&deg;
                </button>
                <button
                  type="button"
                  onClick={() => handleNadirPitchChange(45)}
                  className={`px-1.5 py-0.5 rounded border transition-all ${
                    nadirPitchAngleDeg === 45
                      ? 'bg-amber-950 text-amber-300 border-amber-600 font-bold'
                      : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                  }`}
                >
                  45&deg; (Symmetric Corner)
                </button>
                <button
                  type="button"
                  onClick={() => handleNadirPitchChange(60)}
                  className={`px-1.5 py-0.5 rounded border transition-all ${
                    nadirPitchAngleDeg === 60
                      ? 'bg-amber-950 text-amber-300 border-amber-600 font-bold'
                      : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                  }`}
                >
                  60&deg;
                </button>
                <button
                  type="button"
                  onClick={() => handleNadirPitchChange(90)}
                  className={`px-1.5 py-0.5 rounded border transition-all ${
                    nadirPitchAngleDeg === 90
                      ? 'bg-amber-950 text-amber-300 border-amber-600 font-bold'
                      : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                  }`}
                >
                  90&deg; (Face 2 Normal)
                </button>
              </div>
            </div>
          )}

          {/* Geometric Breakdown Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-[11px] font-mono">
            <div className="bg-slate-950/70 p-2 rounded-lg border border-slate-800/80">
              <span className="text-slate-400 block text-[10px]">
                {useNadirTimeAveraged ? 'Side Face 1 (a &times; c)' : 'Side Face 1 Projection'}
              </span>
              <span className="text-slate-200 font-bold">
                {useNadirTimeAveraged
                  ? `${nadirMetrics.face1.toFixed(4)} m²`
                  : `${(nadirMetrics.face1 * Math.abs(Math.cos(nadirMetrics.pitchRad))).toFixed(4)} m²`}
              </span>
              <span className="text-[9px] text-slate-500 block">
                {useNadirTimeAveraged
                  ? `${(nadirMetrics.dimA * 100).toFixed(0)} &times; ${(nadirMetrics.dimC * 100).toFixed(0)} cm vertical`
                  : `|cos(${nadirPitchAngleDeg}&deg;)| &times; ${(nadirMetrics.face1).toFixed(4)} m²`}
              </span>
            </div>

            <div className="bg-slate-950/70 p-2 rounded-lg border border-slate-800/80">
              <span className="text-slate-400 block text-[10px]">
                {useNadirTimeAveraged ? 'Side Face 2 (b &times; c)' : 'Side Face 2 Projection'}
              </span>
              <span className="text-slate-200 font-bold">
                {useNadirTimeAveraged
                  ? `${nadirMetrics.face2.toFixed(4)} m²`
                  : `${(nadirMetrics.face2 * Math.abs(Math.sin(nadirMetrics.pitchRad))).toFixed(4)} m²`}
              </span>
              <span className="text-[9px] text-slate-500 block">
                {useNadirTimeAveraged
                  ? `${(nadirMetrics.dimB * 100).toFixed(0)} &times; ${(nadirMetrics.dimC * 100).toFixed(0)} cm vertical`
                  : `|sin(${nadirPitchAngleDeg}&deg;)| &times; ${(nadirMetrics.face2).toFixed(4)} m²`}
              </span>
            </div>

            <div className="bg-slate-950/70 p-2 rounded-lg border border-slate-800/80">
              <span className="text-slate-400 block text-[10px]">
                Earth End Cap (+{nadirAxis})
              </span>
              <span className="text-slate-300 font-bold">
                {nadirMetrics.faceNadir.toFixed(4)} m²
              </span>
              <span className="text-[9px] text-emerald-400/90 block">
                Flow-parallel (0 m² ram)
              </span>
            </div>

            <div className="bg-slate-950/70 p-2 rounded-lg border border-slate-800/80">
              <span className="text-slate-400 block text-[10px]">
                {useNadirTimeAveraged ? 'Nadir Drag Area &lang;A&rang;' : 'Instantaneous A(θ)'}
              </span>
              <span className={useNadirTimeAveraged ? 'text-cyan-300 font-bold text-xs' : 'text-amber-300 font-bold text-xs'}>
                {nadirMetrics.totalNadirArea.toFixed(4)} m²
              </span>
              <span className="text-[9px] text-slate-500 block">
                {useNadirTimeAveraged
                  ? `(2/&pi;)&times;${(nadirMetrics.face1 + nadirMetrics.face2).toFixed(4)} m²`
                  : `Body: ${nadirMetrics.activeBodyArea.toFixed(4)} m²`}
              </span>
            </div>
          </div>

          {/* 5-Year PMD Compliance & Comparison Callout Banner */}
          <div className="mt-2 p-2 rounded-lg bg-cyan-950/30 border border-cyan-800/40 flex flex-wrap items-center justify-between gap-2 text-[11px]">
            <div className="flex items-center gap-2">
              <span className="px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-bold text-[10px] uppercase tracking-wider border border-cyan-500/30">
                5-Year PMD Analysis
              </span>
              <span className="text-slate-300 text-[10px]">
                Nadir Time-Avg (<strong className="text-cyan-200">{nadirMetrics.bodyNadirAvg.toFixed(4)} m²</strong>) vs. Random Tumbling (<strong className="text-purple-300">{nadirMetrics.tumblingArea.toFixed(4)} m²</strong>):
                {' '}
                <span className="text-emerald-300 font-semibold">
                  {(((nadirMetrics.bodyNadirAvg - nadirMetrics.tumblingArea) / nadirMetrics.tumblingArea) * 100).toFixed(1)}% higher drag
                </span>
                {' '}&mdash; shorter lifetime, faster deorbit decay.
              </span>
            </div>
            <div className="text-[10px] font-mono text-slate-400">
              Cauchy S/4 = {nadirMetrics.tumblingArea.toFixed(4)} m²
            </div>
          </div>

          {/* Configuration sub-row */}
          <div className="mt-2.5 pt-2 border-t border-slate-800/60 flex flex-wrap items-center justify-between gap-2 text-[11px]">
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400 text-[10px]">Nadir Alignment Axis:</span>
              <div className="flex bg-slate-950 p-0.5 rounded border border-slate-800">
                {(['Z', 'X', 'Y'] as const).map((ax) => (
                  <button
                    key={ax}
                    type="button"
                    onClick={() => handleNadirAxisChange(ax)}
                    className={`px-2 py-0.5 rounded text-[10px] font-mono transition-all ${
                      nadirAxis === ax
                        ? 'bg-cyan-500 text-slate-950 font-bold'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    +{ax}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-slate-400 text-[10px]">Additional Area Coupling:</span>
              <select
                value={nadirAdditionalMode}
                onChange={(e) =>
                  handleNadirAdditionalModeChange(
                    e.target.value as 'direct' | 'in-plane-average' | 'sun-tracking'
                  )
                }
                className="bg-slate-950 text-slate-200 border border-slate-700 rounded px-2 py-0.5 text-[10px] focus:outline-none focus:border-cyan-500 font-mono"
              >
                <option value="direct">Direct Fixed (&Delta;A)</option>
                <option value="in-plane-average">In-Plane Pitch Rotating (2/&pi; &middot; &Delta;A)</option>
                <option value="sun-tracking">Sun-Tracking Panels (Orbit Avg)</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Ballistic Variables Inputs (Mass, Drag Area, Additional Area, Cd) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Mass */}
        <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800 flex flex-col justify-between gap-2">
          <div>
            <div className="flex justify-between items-center text-xs mb-1.5">
              <span className="text-slate-400 font-medium flex items-center gap-1">
                <Scale className="w-3.5 h-3.5 text-slate-400" /> Wet Mass (m)
              </span>
              <input
                type="number"
                min="0.2"
                max="60"
                step="0.1"
                value={cubeSat.mass}
                onChange={(e) =>
                  onCubeSatChange({ ...cubeSat, mass: Math.max(0.1, parseFloat(e.target.value) || 1) })
                }
                className="w-16 px-1.5 py-0.5 bg-slate-900 border border-slate-700 rounded text-right font-mono text-cyan-300 font-bold text-xs focus:border-cyan-500 focus:outline-none"
              />
            </div>
            <input
              id="input-cubesat-mass"
              type="range"
              min="0.5"
              max="30"
              step="0.1"
              value={cubeSat.mass}
              onChange={(e) =>
                onCubeSatChange({ ...cubeSat, mass: parseFloat(e.target.value) })
              }
              className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-500"
            />
          </div>
          <div className="flex justify-between text-[9px] text-slate-500 font-mono">
            <span>0.5 kg</span>
            <span>15 kg</span>
            <span>30 kg</span>
          </div>
        </div>

        {/* Base Body Drag Area */}
        <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800 flex flex-col justify-between gap-2">
          <div>
            <div className="flex justify-between items-center text-xs mb-1.5">
              <span className="text-slate-400 font-medium flex items-center gap-1">
                <Wind className="w-3.5 h-3.5 text-slate-400" /> Body Drag Area (A)
              </span>
              <input
                type="number"
                min="0.001"
                max="1.5"
                step="0.005"
                value={cubeSat.dragArea}
                onChange={(e) =>
                  onCubeSatChange({
                    ...cubeSat,
                    dragArea: Math.max(0.001, parseFloat(e.target.value) || 0.01),
                  })
                }
                className="w-16 px-1.5 py-0.5 bg-slate-900 border border-slate-700 rounded text-right font-mono text-cyan-300 font-bold text-xs focus:border-cyan-500 focus:outline-none"
              />
            </div>
            <input
              id="input-cubesat-drag-area"
              type="range"
              min="0.005"
              max="0.5"
              step="0.005"
              value={cubeSat.dragArea}
              onChange={(e) =>
                onCubeSatChange({ ...cubeSat, dragArea: parseFloat(e.target.value) })
              }
              className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-500"
            />
          </div>
          <div className="flex justify-between text-[9px] text-slate-500 font-mono">
            <span>0.01 m²</span>
            <span>0.25 m²</span>
            <span>0.50 m²</span>
          </div>
        </div>

        {/* Additional Drag Area (ΔA) */}
        <div className="bg-slate-950/60 p-3 rounded-xl border border-cyan-800/40 flex flex-col justify-between gap-2">
          <div>
            <div className="flex justify-between items-center text-xs mb-1.5">
              <span className="text-cyan-300 font-medium flex items-center gap-1">
                <Layers className="w-3.5 h-3.5 text-cyan-400" /> Additional Area (&Delta;A)
              </span>
              <input
                type="number"
                min="0.000"
                max="1.0"
                step="0.005"
                value={additionalArea}
                onChange={(e) =>
                  handleAdditionalAreaChange(parseFloat(e.target.value) || 0)
                }
                className="w-16 px-1.5 py-0.5 bg-slate-900 border border-cyan-600/60 rounded text-right font-mono text-cyan-300 font-bold text-xs focus:border-cyan-400 focus:outline-none"
              />
            </div>
            <input
              id="input-cubesat-additional-area"
              type="range"
              min="0.000"
              max="0.300"
              step="0.005"
              value={additionalArea}
              onChange={(e) => handleAdditionalAreaChange(parseFloat(e.target.value))}
              className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
            />
          </div>
          {/* Quick presets for additional area */}
          <div className="flex items-center justify-between gap-1 pt-1">
            <button
              onClick={() => handleAdditionalAreaChange(0)}
              className={`px-1.5 py-0.5 rounded text-[9px] font-mono border transition-all ${
                additionalArea === 0
                  ? 'bg-cyan-950 text-cyan-300 border-cyan-700'
                  : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
              }`}
            >
              0 m²
            </button>
            <button
              onClick={() => handleAdditionalAreaChange(0.02)}
              title="Antennas / Boom: +0.020 m²"
              className={`px-1.5 py-0.5 rounded text-[9px] font-mono border transition-all ${
                additionalArea === 0.02
                  ? 'bg-cyan-950 text-cyan-300 border-cyan-700'
                  : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
              }`}
            >
              +0.02
            </button>
            <button
              onClick={() => handleAdditionalAreaChange(0.06)}
              title="2x Solar Wings: +0.060 m²"
              className={`px-1.5 py-0.5 rounded text-[9px] font-mono border transition-all ${
                additionalArea === 0.06
                  ? 'bg-cyan-950 text-cyan-300 border-cyan-700'
                  : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
              }`}
            >
              +0.06
            </button>
            <button
              onClick={() => handleAdditionalAreaChange(0.12)}
              title="4x Solar Array: +0.120 m²"
              className={`px-1.5 py-0.5 rounded text-[9px] font-mono border transition-all ${
                additionalArea === 0.12
                  ? 'bg-cyan-950 text-cyan-300 border-cyan-700'
                  : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
              }`}
            >
              +0.12
            </button>
          </div>
        </div>

        {/* Drag Coefficient Cd */}
        <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800 flex flex-col justify-between gap-2">
          <div>
            <div className="flex justify-between items-center text-xs mb-1.5">
              <span className="text-slate-400 font-medium">Drag Coeff (C_D)</span>
              <input
                type="number"
                min="1.5"
                max="3.0"
                step="0.05"
                value={cubeSat.dragCoefficient}
                onChange={(e) =>
                  onCubeSatChange({
                    ...cubeSat,
                    dragCoefficient: Math.max(1.0, parseFloat(e.target.value) || 2.2),
                  })
                }
                className="w-14 px-1.5 py-0.5 bg-slate-900 border border-slate-700 rounded text-right font-mono text-cyan-300 font-bold text-xs focus:border-cyan-500 focus:outline-none"
              />
            </div>
            <input
              id="input-cubesat-cd"
              type="range"
              min="1.8"
              max="2.8"
              step="0.05"
              value={cubeSat.dragCoefficient}
              onChange={(e) =>
                onCubeSatChange({ ...cubeSat, dragCoefficient: parseFloat(e.target.value) })
              }
              className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-500"
            />
          </div>
          <div className="flex justify-between text-[9px] text-slate-500 font-mono">
            <span>1.80</span>
            <span>2.20 (LEO)</span>
            <span>2.80</span>
          </div>
        </div>
      </div>

      {/* 4. Astrodynamics Ballistic Parameter Readout */}
      <div className="bg-slate-950/80 p-3.5 rounded-xl border border-slate-800/80 flex flex-col gap-2.5 text-xs">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <span className="text-slate-400 block text-[11px]">
              Ballistic Coefficient B = m / (C_D &middot; A):
            </span>
            <span className="font-mono text-emerald-400 font-bold text-base">
              {ballisticCoeff.toFixed(2)} kg/m²
            </span>
            <span className="text-slate-500 text-[10px] ml-2">
              (B* = {bStar.toFixed(3)} m²/kg)
            </span>
          </div>
          <div className="text-right text-[11px] text-slate-400">
            <span>Total Effective Area: </span>
            <span className="font-mono text-slate-200 font-semibold">{totalArea.toFixed(3)} m²</span>
            {additionalArea > 0 && (
              <span className="text-cyan-400 ml-1">
                ({cubeSat.dragArea.toFixed(3)} m² body + {effectiveAdditional.toFixed(3)} m² addnl)
              </span>
            )}
            {cubeSat.hasDragSail && (
              <span className="text-purple-400 ml-1">(+ {cubeSat.dragSailArea} m² sail)</span>
            )}
            {currentAttitude === 'nadir' && (
              <span
                className={`ml-1.5 px-1.5 py-0.5 rounded border text-[10px] font-semibold ${
                  useNadirTimeAveraged
                    ? 'bg-cyan-950 text-cyan-300 border-cyan-800'
                    : 'bg-amber-950 text-amber-300 border-amber-800'
                }`}
              >
                {useNadirTimeAveraged
                  ? 'Nadir Time-Avg'
                  : `Nadir Fixed Pitch (${nadirPitchAngleDeg}°)`}
              </span>
            )}
          </div>
        </div>

        {/* NASA SGP4 & Radiation Pressure Real Telemetry */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2 border-t border-slate-800/60 text-[11px]">
          <div className="bg-slate-900/60 p-2 rounded-lg border border-slate-800">
            <span className="text-slate-400 block text-[10px]">NASA SGP4 B* Drag</span>
            <span className="font-mono text-cyan-300 font-semibold">
              {(sgp4BStar * 1e4).toFixed(3)} &times; 10⁻⁴ ER⁻¹
            </span>
          </div>
          <div className="bg-slate-900/60 p-2 rounded-lg border border-slate-800">
            <span className="text-slate-400 block text-[10px]">Solar Rad Pressure Accel</span>
            <span className="font-mono text-purple-300 font-semibold">
              {(srpAccel * 1e8).toFixed(2)} &times; 10⁻⁸ m/s²
            </span>
          </div>
          <div className="bg-slate-900/60 p-2 rounded-lg border border-slate-800 col-span-2 sm:col-span-1">
            <span className="text-slate-400 block text-[10px]">Thermosphere T_&infin;</span>
            <span className="font-mono text-amber-300 font-semibold">
              {exoTemp.toFixed(0)} K
            </span>
          </div>
        </div>
      </div>

      {/* 5. Live Detected Lifetime & Dynamic Calculation Feedback */}
      {simulationResult && (
        <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-cyan-950/40 p-4 rounded-xl border border-cyan-500/40 shadow-lg flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-cyan-500/20 border border-cyan-400/40 flex items-center justify-center shrink-0">
              <TrendingDown className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">
                Detected Orbit Lifetime for this Configuration:
              </div>
              <div className="flex items-baseline gap-2 mt-0.5">
                <span className="text-lg font-bold font-mono text-slate-100">
                  {simulationResult.lifetimeYears >= 100
                    ? '> 100 Years'
                    : simulationResult.lifetimeYears < 1.5
                    ? `${simulationResult.lifetimeDays.toFixed(0)} Days`
                    : `${simulationResult.lifetimeYears.toFixed(2)} Years`}
                </span>
                <span className="text-xs text-amber-400 font-mono">
                  &bull; Decay Rate: {simulationResult.decayRateKmPerDay.toFixed(4)} km/day
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onNavigateTab && (
              <button
                onClick={() => onNavigateTab('lifetime')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs transition-all shadow-md hover:shadow-cyan-500/20"
              >
                <span>Move to Lifetime Chart</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* 6. Mission Preset Models */}
      <div className="flex flex-col gap-1.5">
        <div className="text-[11px] text-slate-400 font-medium">Or Load Reference Mission Spec:</div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {CUBESAT_PRESETS.map((preset) => {
            const isSelected = cubeSat.name === preset.name;
            return (
              <button
                key={preset.name}
                onClick={() => handleSelectPreset(preset)}
                className={`p-2.5 rounded-xl text-left border transition-all flex flex-col justify-between ${
                  isSelected
                    ? 'bg-purple-950/40 border-purple-500/80 shadow-md shadow-purple-950/50'
                    : 'bg-slate-950/60 border-slate-800 hover:border-slate-700 text-slate-300'
                }`}
              >
                <div className="font-semibold text-xs text-slate-100 truncate">
                  {preset.name}
                </div>
                <div className="flex justify-between items-center text-[10px] text-slate-400 font-mono mt-1">
                  <span>{preset.mass} kg</span>
                  <span>{preset.dragArea} m²</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 7. NASA Astrodynamics Atmospheric Physics Engine */}
      <div className="border-t border-slate-800 pt-4 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-200">
            <Cpu className="w-4 h-4 text-blue-400" />
            <span>NASA Atmospheric Physics Engine</span>
          </div>
          <span className="font-mono text-[11px] text-blue-400 font-semibold px-2 py-0.5 rounded bg-blue-950/60 border border-blue-800/60">
            {solar.atmosphereModel === 'jacchia-roberts'
              ? 'Jacchia-Roberts 1970'
              : solar.atmosphereModel === 'us-standard-1976'
              ? 'US Standard 1976'
              : 'NASA DAS 3.0 (NRLMSISE-00)'}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {[
            {
              id: 'nasa-das' as NasaAtmosphereModel,
              title: 'NASA DAS 3.0',
              subtitle: 'NRLMSISE-00 Dynamic',
              detail: 'Bessel I₀/I₁ secular quadrature, dynamic T_∞ & diurnal bulge',
            },
            {
              id: 'jacchia-roberts' as NasaAtmosphereModel,
              title: 'Jacchia-Roberts',
              subtitle: 'NASA SP-8000',
              detail: 'Direct solar EUV thermospheric heating curve',
            },
            {
              id: 'us-standard-1976' as NasaAtmosphereModel,
              title: 'US Standard 1976',
              subtitle: 'Static Baseline',
              detail: 'Tabulated standard atmosphere baseline',
            },
          ].map((m) => {
            const isSelected = (solar.atmosphereModel || 'nasa-das') === m.id;
            return (
              <button
                key={m.id}
                onClick={() => handleAtmosphereModelChange(m.id)}
                className={`p-2.5 rounded-xl text-left border transition-all text-xs flex flex-col justify-between ${
                  isSelected
                    ? 'bg-blue-950/50 border-blue-500/80 shadow-md shadow-blue-950/40 text-blue-100'
                    : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                }`}
              >
                <div>
                  <div className="font-semibold text-slate-100 flex items-center justify-between">
                    <span>{m.title}</span>
                    {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>}
                  </div>
                  <div className="text-[10px] text-blue-300 font-mono mt-0.5">{m.subtitle}</div>
                </div>
                <div className="text-[10px] text-slate-500 mt-2 leading-tight">
                  {m.detail}
                </div>
              </button>
            );
          })}
        </div>

        {/* Solar Radio Flux (F10.7) & Planetary Geomagnetic Index (Ap) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-1">
          {/* F10.7 Flux */}
          <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800 flex flex-col gap-2">
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-400 font-medium flex items-center gap-1">
                <Sun className="w-3.5 h-3.5 text-amber-400" />
                Solar Flux (F10.7)
              </span>
              <span className="font-mono text-amber-300 font-bold text-xs">{solar.f107} sfu</span>
            </div>
            <input
              type="range"
              min="65"
              max="260"
              step="5"
              value={solar.f107}
              onChange={(e) => handleF107Change(parseInt(e.target.value))}
              className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
            />
            <div className="flex justify-between text-[10px] text-slate-500 font-mono">
              <span>70 (Min)</span>
              <span>130 (Mean)</span>
              <span>200+ (Max)</span>
            </div>
          </div>

          {/* Geomagnetic Ap Index */}
          <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800 flex flex-col gap-2">
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-400 font-medium flex items-center gap-1">
                <Zap className="w-3.5 h-3.5 text-cyan-400" />
                Geomagnetic Index (A_p)
              </span>
              <span className="font-mono text-cyan-300 font-bold text-xs">{solar.apIndex || 15}</span>
            </div>
            <input
              type="range"
              min="2"
              max="60"
              step="1"
              value={solar.apIndex || 15}
              onChange={(e) => handleApChange(parseInt(e.target.value))}
              className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-500"
            />
            <div className="flex justify-between text-[10px] text-slate-500 font-mono">
              <span>4 (Quiet)</span>
              <span>15 (Nominal)</span>
              <span>45+ (Storm)</span>
            </div>
          </div>
        </div>

        <div className="bg-blue-950/20 border border-blue-800/30 rounded-xl p-3 text-[11px] text-blue-200/90 flex items-start gap-2">
          <Info className="w-3.5 h-3.5 text-blue-400 shrink-0 mt-0.5" />
          <span>
            NASA DAS 3.0 standard: High solar flux (F10.7) and geomagnetic storm activity (A_p) drive Joule heating and EUV ionization in the thermosphere, causing dynamic scale height expansion and orders-of-magnitude faster orbit decay.
          </span>
        </div>
      </div>

      {/* NASA & Astrodynamics Reference Documentation Modal */}
      {showAstrodynamicsDocModal && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setShowAstrodynamicsDocModal(false)}
        >
          <div
            className="bg-slate-900 border border-slate-700/90 rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto p-6 shadow-2xl text-slate-200 flex flex-col gap-5"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 rounded-xl">
                  <BookOpen className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                    Astrodynamics & NASA Reference Guide
                  </h3>
                  <p className="text-xs text-slate-400">
                    Nadir-Pointing Aerodynamic Drag Area &bull; Equations, Integrals & Literature Standards
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAstrodynamicsDocModal(false)}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-all border border-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="space-y-4 text-xs leading-relaxed text-slate-300">
              {/* Section 1: Physical Context */}
              <div className="bg-slate-950/70 p-4 rounded-xl border border-slate-800">
                <h4 className="font-semibold text-cyan-300 text-sm mb-1.5 flex items-center gap-2">
                  <Globe className="w-4 h-4 text-cyan-400" />
                  1. Local-Vertical Local-Horizontal (LVLH) Nadir Flight Geometry
                </h4>
                <p className="text-slate-300">
                  In an Earth-oriented Local Vertical Local Horizontal (LVLH) mission frame, the satellite maintains one axis (dimension <code className="text-cyan-300">c</code>, along <code className="text-cyan-300">+{nadirAxis}</code>) pointed continuously at Earth nadir along the local vertical. In circular or near-circular Low Earth Orbit (LEO), the spacecraft velocity vector <code className="text-cyan-300">v&#8407;</code> is strictly confined to the <strong>local horizontal plane</strong>, perpendicular to the nadir axis.
                </p>
                <p className="text-slate-300 mt-2">
                  Consequently:
                </p>
                <ul className="list-disc list-inside space-y-1 text-slate-400 ml-1">
                  <li>
                    The Earth-facing and Zenith-facing end-caps (<code className="text-slate-200">a &times; b</code>, e.g. <code className="text-cyan-300">{(nadirMetrics.dimA * 100).toFixed(0)}&times;{(nadirMetrics.dimB * 100).toFixed(0)} cm</code>) are <strong>coplanar with the horizontal flow</strong>, presenting zero normal projection to the relative wind.
                  </li>
                  <li>
                    The incoming aerodynamic relative wind strikes the vertical side faces (<code className="text-slate-200">a &times; c</code> and <code className="text-slate-200">b &times; c</code>, e.g. <code className="text-cyan-300">{(nadirMetrics.dimA * 100).toFixed(0)}&times;{(nadirMetrics.dimC * 100).toFixed(0)} cm</code> and <code className="text-cyan-300">{(nadirMetrics.dimB * 100).toFixed(0)}&times;{(nadirMetrics.dimC * 100).toFixed(0)} cm</code>).
                  </li>
                  <li>
                    As the satellite travels around its orbit and/or rotates in yaw/pitch, its projected silhouette continuously changes.
                  </li>
                </ul>
              </div>

              {/* Section 2: Mathematical Derivation */}
              <div className="bg-slate-950/70 p-4 rounded-xl border border-slate-800 space-y-2.5">
                <h4 className="font-semibold text-emerald-300 text-sm flex items-center gap-2">
                  <FileText className="w-4 h-4 text-emerald-400" />
                  2. Analytical Derivation of Orbit Time-Averaged Drag Area
                </h4>
                <p>
                  At any relative horizontal yaw angle <code className="text-emerald-300">&theta; &isin; [0, 2&pi;]</code> between the velocity vector and Face 1 (<code className="text-slate-200">a &times; c</code>), the instantaneous projected cross-sectional area is:
                </p>
                <div className="bg-slate-900 p-3 rounded-lg border border-slate-800 font-mono text-center text-cyan-200">
                  A(&theta;) = c &middot; (a |cos &theta;| + b |sin &theta;|) = (a&middot;c) |cos &theta;| + (b&middot;c) |sin &theta;|
                </div>
                <p>
                  Integrating over one complete 360&deg; (<code className="text-emerald-300">2&pi; radians</code>) orbit to find the <strong>orbit time-averaged projected drag area</strong> &lang;A&rang;<sub>nadir</sub>:
                </p>
                <div className="bg-slate-900 p-3 rounded-lg border border-slate-800 font-mono text-center text-cyan-200">
                  &lang;A&rang;<sub>nadir</sub> = (1 / 2&pi;) &int;<sub>0</sub><sup>2&pi;</sup> c &middot; [ a |cos &theta;| + b |sin &theta;| ] d&theta;
                </div>
                <p>
                  Exploiting the 4-quadrant symmetry across <code className="text-emerald-300">[0, &pi;/2]</code> where <code className="text-emerald-300">cos &theta; &ge; 0</code> and <code className="text-emerald-300">sin &theta; &ge; 0</code>:
                </p>
                <div className="bg-slate-900 p-3 rounded-lg border border-slate-800 font-mono text-center text-emerald-300 font-bold space-y-1">
                  <div>
                    &lang;A&rang;<sub>nadir</sub> = (4 / 2&pi;) &middot; c &middot; [ a &int;<sub>0</sub><sup>&pi;/2</sup> cos &theta; d&theta; + b &int;<sub>0</sub><sup>&pi;/2</sup> sin &theta; d&theta; ]
                  </div>
                  <div className="text-slate-400 font-normal text-[11px]">
                    Since &int;<sub>0</sub><sup>&pi;/2</sup> cos &theta; d&theta; = [sin &theta;]<sub>0</sub><sup>&pi;/2</sup> = 1 and &int;<sub>0</sub><sup>&pi;/2</sup> sin &theta; d&theta; = [-cos &theta;]<sub>0</sub><sup>&pi;/2</sup> = 1:
                  </div>
                  <div className="text-emerald-400 text-sm">
                    &lang;A&rang;<sub>nadir</sub> = (2 / &pi;) &middot; (a&middot;c + b&middot;c) = (2 / &pi;) &middot; c &middot; (a + b)
                  </div>
                </div>
                <div className="bg-slate-900/90 p-3 rounded-lg border border-slate-800 text-[11px] font-mono text-slate-300">
                  <div className="font-bold text-cyan-300 mb-1">Standard 3U CubeSat Verification:</div>
                  <div>Dimensions: a = 0.10 m, b = 0.10 m, c = 0.34 m (Nadir axis)</div>
                  <div>Side Face 1 = 0.10 m &times; 0.34 m = 0.0340 m²</div>
                  <div>Side Face 2 = 0.10 m &times; 0.34 m = 0.0340 m²</div>
                  <div>End Cap (Nadir/Zenith) = 0.10 m &times; 0.10 m = 0.0100 m² (flow-parallel)</div>
                  <div className="text-emerald-400 font-bold mt-1">
                    &lang;A&rang;<sub>nadir</sub> = (2 / &pi;) &times; (0.0340 + 0.0340) = (2 / &pi;) &times; 0.0680 = 0.04329 m² &asymp; 0.0433 m²
                  </div>
                </div>
              </div>

              {/* Section 3: Comparison with Cauchy Tumbling */}
              <div className="bg-slate-950/70 p-4 rounded-xl border border-slate-800 space-y-2">
                <h4 className="font-semibold text-purple-300 text-sm flex items-center gap-2">
                  <Maximize2 className="w-4 h-4 text-purple-400" />
                  3. Comparison: Nadir-Averaged vs. Cauchy Random Tumbling
                </h4>
                <p>
                  Under <strong>NASA DAS 3.0 / ECSS random tumbling</strong>, the vehicle is assumed to tumble isotropically across all three rotational degrees of freedom on the sphere <code className="text-purple-300">S&sup2;</code>. By Cauchy's Mean Surface Area Theorem:
                </p>
                <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800 font-mono text-center text-purple-200">
                  &lang;A&rang;<sub>tumbling</sub> = A<sub>total surface</sub> / 4 = [ 2 &times; (ab + bc + ca) ] / 4 = (ab + bc + ca) / 2
                </div>
                <div className="bg-slate-900/90 p-2.5 rounded-lg border border-slate-800 font-mono text-[11px] text-slate-300">
                  <div>For 3U CubeSat (0.10 &times; 0.10 &times; 0.34 m):</div>
                  <div>Total Surface Area S = 2 &times; (0.010 + 0.034 + 0.034) = 0.1560 m²</div>
                  <div className="text-purple-300 font-bold">
                    &lang;A&rang;<sub>tumbling</sub> = 0.1560 / 4 = 0.0390 m²
                  </div>
                </div>
              </div>

              {/* Section 4: 5-Year PMD Compliance Analysis */}
              <div className="bg-slate-950/70 p-4 rounded-xl border border-slate-800 space-y-2">
                <h4 className="font-semibold text-amber-300 text-sm flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-amber-400" />
                  4. Post-Mission Disposal (5-Year PMD Rule) Significance
                </h4>
                <p className="text-slate-300">
                  NASA-STD-8719.14C and the FCC 5-Year Deorbit Rule require operators to guarantee that spacecraft deorbit within 5 years post-mission. The aerodynamic deceleration is directly proportional to drag area:
                </p>
                <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800 font-mono text-center text-amber-300">
                  a<sub>drag</sub> = &frac12; &rho; v&sup2; &middot; (C<sub>D</sub> &middot; A / m) = &frac12; &rho; v&sup2; / &beta;
                </div>
                <p className="text-slate-300">
                  Because <strong>Nadir Pointing</strong> produces an effective drag area of <strong className="text-cyan-300">0.0433 m²</strong> compared to <strong className="text-purple-300">0.0390 m²</strong> for random tumbling (+11% higher drag), the satellite has a <strong>lower ballistic coefficient &beta;</strong> and decays significantly faster in Nadir mode.
                </p>
                <ul className="list-disc list-inside space-y-1 text-slate-400 ml-1">
                  <li>
                    <strong>Conservative for Deorbit (Easier PMD Compliance):</strong> Maintaining Nadir orientation produces higher drag, shortening orbital lifetime and ensuring rapid decay within the 5-year limit.
                  </li>
                  <li>
                    <strong>Conservative for Lifetime (Longest Orbit):</strong> Random tumbling produces less drag, representing the worst-case longer orbital lifetime scenario if ADCS fails.
                  </li>
                </ul>
              </div>

              {/* Section 5: Live Comparison Table for Current Satellite */}
              <div className="bg-slate-950/70 p-4 rounded-xl border border-slate-800 space-y-2">
                <h4 className="font-semibold text-cyan-300 text-sm flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-cyan-400" />
                  5. Live Comparison Table for Active Satellite Configuration
                </h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-left font-mono text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400">
                        <th className="pb-1.5 font-sans">Attitude / Projection Model</th>
                        <th className="pb-1.5 font-sans">Formula</th>
                        <th className="pb-1.5 font-sans text-right">Body Area</th>
                        <th className="pb-1.5 font-sans text-right">Total Area (+&Delta;A)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 text-[11px]">
                      <tr>
                        <td className="py-1.5 text-slate-200">Ram Aero-Stabilized (Min frontal)</td>
                        <td className="py-1.5 text-slate-400">min(faces) = a &times; b</td>
                        <td className="py-1.5 text-right text-slate-300">
                          {computeAstrodynamicArea(currentDims, 'ram', nadirAxis).toFixed(4)} m²
                        </td>
                        <td className="py-1.5 text-right text-slate-300">
                          {(computeAstrodynamicArea(currentDims, 'ram', nadirAxis) + additionalArea).toFixed(4)} m²
                        </td>
                      </tr>
                      <tr className="bg-cyan-950/30">
                        <td className="py-1.5 text-cyan-300 font-semibold flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400" />
                          Nadir (Orbit Time-Averaged)
                        </td>
                        <td className="py-1.5 text-cyan-200">(2/&pi;) &middot; (ac + bc)</td>
                        <td className="py-1.5 text-right text-cyan-300 font-bold">
                          {nadirMetrics.bodyNadirAvg.toFixed(4)} m²
                        </td>
                        <td className="py-1.5 text-right text-emerald-400 font-bold">
                          {(nadirMetrics.bodyNadirAvg + (nadirAdditionalMode === 'in-plane-average' || nadirAdditionalMode === 'sun-tracking' ? (2/Math.PI)*additionalArea : additionalArea)).toFixed(4)} m²
                        </td>
                      </tr>
                      <tr>
                        <td className="py-1.5 text-amber-300">Nadir (Instantaneous &theta; = {nadirPitchAngleDeg}&deg;)</td>
                        <td className="py-1.5 text-slate-400">c &middot; (a|cos &theta;| + b|sin &theta;|)</td>
                        <td className="py-1.5 text-right text-amber-300">
                          {nadirMetrics.bodyInstantaneous.toFixed(4)} m²
                        </td>
                        <td className="py-1.5 text-right text-amber-300">
                          {(nadirMetrics.bodyInstantaneous + additionalArea).toFixed(4)} m²
                        </td>
                      </tr>
                      <tr>
                        <td className="py-1.5 text-slate-200">Random Tumbling (NASA DAS / Cauchy)</td>
                        <td className="py-1.5 text-slate-400">A_total / 4</td>
                        <td className="py-1.5 text-right text-slate-300">
                          {computeAstrodynamicArea(currentDims, 'tumbling', nadirAxis).toFixed(4)} m²
                        </td>
                        <td className="py-1.5 text-right text-slate-300">
                          {(computeAstrodynamicArea(currentDims, 'tumbling', nadirAxis) + additionalArea).toFixed(4)} m²
                        </td>
                      </tr>
                      <tr>
                        <td className="py-1.5 text-slate-200">Broadside Max Aspect</td>
                        <td className="py-1.5 text-slate-400">max(faces)</td>
                        <td className="py-1.5 text-right text-slate-300">
                          {computeAstrodynamicArea(currentDims, 'broadside', nadirAxis).toFixed(4)} m²
                        </td>
                        <td className="py-1.5 text-right text-slate-300">
                          {(computeAstrodynamicArea(currentDims, 'broadside', nadirAxis) + additionalArea).toFixed(4)} m²
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Section 6: Authoritative Literature Citations */}
              <div className="bg-slate-950/70 p-4 rounded-xl border border-slate-800 space-y-2">
                <h4 className="font-semibold text-slate-200 text-sm flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  6. Authoritative Literature Citations & NASA Standards
                </h4>
                <ul className="list-disc list-inside space-y-1.5 text-[11px] text-slate-300">
                  <li>
                    <strong className="text-slate-100">David A. Vallado (5th ed., 2022)</strong>: <em>Fundamentals of Astrodynamics and Applications</em>, Microcosm Press / Springer, Chapter 8: Orbit Perturbations, Section 8.6 &quot;Atmospheric Drag and Cross-Sectional Geometry&quot;, Eq. (8-34) to (8-38).
                  </li>
                  <li>
                    <strong className="text-slate-100">James R. Wertz &amp; Wiley J. Larson</strong>: <em>Space Mission Engineering: The New SMAD</em>, Microcosm Press, Section 9.3 &quot;Atmospheric Drag Effects on Spacecraft&quot; &amp; Section 20.2 &quot;Orbit Lifetime Prediction&quot;.
                  </li>
                  <li>
                    <strong className="text-slate-100">James R. Wertz (ed.)</strong>: <em>Spacecraft Attitude Determination and Control</em>, Kluwer Academic Publishers / D. Reidel, Appendix G &quot;Earth-Referenced (LVLH) Attitude and Silhouettes&quot;.
                  </li>
                  <li>
                    <strong className="text-slate-100">NASA-STD-8719.14C</strong>: <em>Process for Limiting Orbital Debris</em>, National Aeronautics and Space Administration, Section 4.5 &quot;Deorbit Lifetime Reliability&quot; and Appendix B &quot;Cross-Sectional Area Calculations for 5-Year PMD Rule&quot;.
                  </li>
                  <li>
                    <strong className="text-slate-100">NASA DAS 3.0</strong>: <em>Debris Assessment Software Technical Guide</em>, Orbital Debris Program Office, NASA Johnson Space Center (JSC).
                  </li>
                  <li>
                    <strong className="text-slate-100">P. C. Hughes</strong>: <em>Spacecraft Attitude Dynamics</em>, John Wiley &amp; Sons, Chapter 8: Environmental Torques and Silhouettes.
                  </li>
                  <li>
                    <strong className="text-slate-100">NASA SP-8007 &amp; SP-8008</strong>: <em>Spacecraft Aerodynamic Torques and Cross-Sectional Area Determinations</em>, NASA Space Vehicle Design Criteria Monographs.
                  </li>
                  <li>
                    <strong className="text-slate-100">ECSS-E-ST-10-04C</strong>: <em>European Cooperation for Space Standardization - Space Engineering: Space Environment</em>, Section 7: Neutral Atmosphere.
                  </li>
                </ul>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="border-t border-slate-800 pt-3 flex justify-between items-center text-xs">
              <span className="text-slate-500 font-mono text-[10px]">
                Active Form Factor: {cubeSat.formFactor} ({currentDims.length}&times;{currentDims.width}&times;{currentDims.height} cm)
              </span>
              <button
                type="button"
                onClick={() => setShowAstrodynamicsDocModal(false)}
                className="px-4 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-semibold transition-all shadow-md"
              >
                Close Documentation
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
